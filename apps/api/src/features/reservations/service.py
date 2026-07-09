"""Service-Schicht für reservations.

Legt Reservierungen tenant-gescoped an (tenant_id immer aus dem JWT). Eine
Reservierung belegt den Zeitraum im Kalender: alle Übernachtungstage werden in
der availability-Tabelle auf `booked` gesetzt. Vorher Double-Booking-Schutz —
ist ein Tag bereits booked/blocked, schlägt das Anlegen mit 409 fehl.

Gleiches Muster wie properties.service: Service-Role-Client + explizites
tenant-Filtern (PROJECT.md §2 — Business-Logik im Backend).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.guest_masking import GuestMask, load_guest_mask
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.guests.identity import (
    GuestContact as ResolverContact,
)
from src.features.guests.identity import (
    resolve_or_create_guest,
)
from src.jobs.queue import try_enqueue_ari, try_enqueue_recompute

from .property_stats import compute_property_stats
from .schemas import (
    CheckOutRequest,
    CheckOutResponse,
    DashboardEntry,
    DashboardKpi,
    DashboardResponse,
    PropertyStats,
    QuoteItem,
    ReservationCreate,
    ReservationDetail,
    ReservationInvoiceInfo,
    ReservationListResponse,
    ReservationMove,
    ReservationResponse,
    SliceHealth,
)

if TYPE_CHECKING:
    from src.features.pricing.schemas import QuoteResponse

log = get_logger("nextdays.reservations")


def _as_date(value: object) -> date:
    """Supabase liefert Datumsspalten als ISO-String; date bleibt date."""
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _require_uuid(reservation_id: str) -> None:
    """Reservierungs-ID MUSS eine UUID sein → sonst 404 (nicht 500).

    Die Route /reservierungen/{id} fängt in Next.js auch nicht existierende
    Unterpfade (z. B. „einstellungen"). Ohne diesen Guard reicht Postgres den
    Nicht-UUID-Wert bis zur DB durch und wirft 22P02 → ein nutzer-/pfad-
    getriebener 500 (CLAUDE.md Wurzel 5: Fehl-Input darf keinen 500 werfen,
    fail-closed). Fachlich ist eine unbekannte ID schlicht „nicht gefunden"."""
    try:
        UUID(str(reservation_id))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ReservationError(
            "Reservierung nicht gefunden.", status_code=404
        ) from exc


class ReservationError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _map_booking_conflict(exc: APIError) -> Exception:
    """Fehler der atomaren Buchung (RPC 0104) auf fachliche Fehler mappen.

    RS409 = Konflikt aus create_reservation_atomic (belegt bzw. Stop-Sell, die
    Message unterscheidet die Fälle). 23P01 = EXCLUDE-Constraint
    reservations_no_local_overlap (DB-Backstop gegen Doppelbuchung). Alles
    andere unverändert weiterreichen.
    """
    if exc.code == "RS409":
        return ReservationError(exc.message, status_code=409)
    if exc.code == "23P01":
        return ReservationError(
            "Zeitraum enthält bereits belegte/gesperrte Tage.", status_code=409
        )
    return exc


def _nights(check_in: date, check_out: date) -> list[date]:
    days: list[date] = []
    cur = check_in
    while cur < check_out:
        days.append(cur)
        cur += timedelta(days=1)
    return days


class ReservationsService:
    slice_name = "reservations"

    def __init__(self, service_client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise ReservationError("Reservierungs-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ReservationError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _days_still_booked_by_others(
        self, property_id: str, days: list[str], exclude_reservation_id: str
    ) -> set[str]:
        """Von `days` diejenigen, die noch durch eine ANDERE aktive Reservierung
        desselben Objekts belegt sind (z. B. eine importierte OTA-Buchung — die
        darf mit einer lokalen Buchung überlappen, der EXCLUDE-Constraint nimmt
        OTA-Buchungen aus). Solche Tage dürfen beim Stornieren/Verschieben der
        lokalen Reservierung NICHT freigegeben und NICHT an Channex zurück-
        gemeldet werden, sonst werden real belegte Tage wieder verkaufbar."""
        if not days:
            return set()
        lo, hi = min(days), max(days)
        rows = (
            self._db()
            .table("reservations")
            .select("check_in, check_out")
            .eq("property_id", property_id)
            .neq("id", exclude_reservation_id)
            .neq("status", "cancelled")
            .lte("check_in", hi)
            .gt("check_out", lo)
            .execute()
        ).data or []
        occupied: set[str] = set()
        wanted = set(days)
        for r in rows:
            for d in _nights(_as_date(r["check_in"]), _as_date(r["check_out"])):
                iso = d.isoformat()
                if iso in wanted:
                    occupied.add(iso)
        return occupied

    def _owner_scope_pids(self, ctx: AuthContext) -> list[str] | None:
        """Objekt-IDs, auf die ein Eigentümer eingeschränkt ist (§4.2).

        None = keine Einschränkung (admin/co_admin sehen den ganzen Tenant).
        Liste (ggf. leer) = nur diese Objekte. Der Service läuft mit Service-
        Role (RLS umgangen), also muss der Owner-Self-Scope hier greifen — sonst
        sieht ein Eigentümer die Buchungen fremder Objekte desselben Tenants."""
        if not is_owner(ctx):
            return None
        return list(owner_property_ids(self._db(), ctx))

    def _write_ari_outbox(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to_incl: date,
        availability: int,
    ) -> str | None:
        """Push-Absicht VOR dem Job-Enqueue in der ari_outbox persistieren:
        scheitert das Einreihen (DB-Hiccup), zieht der process_ari_outbox-Tick
        die Zeile nach — der Push geht nie ersatzlos verloren. Best-effort:
        ohne Outbox-Zeile legt der Worker beim Push selbst eine an (Altpfad)."""
        try:
            ins = (
                self._db()
                .table("ari_outbox")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "date_from": date_from.isoformat(),
                        "date_to": date_to_incl.isoformat(),
                        "availability": availability,
                        "status": "pending",
                    }
                )
                .execute()
            )
            return ins.data[0]["id"] if ins.data else None
        except Exception as exc:  # noqa: BLE001 — Outbox darf den Request nie kippen
            log.warning(
                "ari_outbox_write_failed",
                property_id=property_id,
                error=str(exc)[:200],
            )
            return None

    def _push_channex_availability(
        self,
        tenant_id: str,
        property_id: str,
        check_in: date,
        check_out: date,
        availability: int,
        outbox_id: str | None = None,
    ) -> None:
        """Verfügbarkeit der belegten/freigegebenen Nächte als ARI-Push-Job
        einreihen (Phase 2). Doppelbuchungsschutz: die Belegung geht so ohne
        Request-Blockade an Channex. KEIN coalesce — jede Buchung/Freigabe betrifft
        einen eigenen Zeitraum, ein pauschaler dedup_key würde disjunkte Ranges
        verschmelzen. Die Push-Absicht liegt VOR dem Enqueue in der ari_outbox
        (übergeben oder hier geschrieben) — verlorene Enqueues holt der Cron nach."""
        if self._client is None:
            return
        if outbox_id is None:
            outbox_id = self._write_ari_outbox(
                tenant_id, property_id, check_in,
                check_out - timedelta(days=1), availability,
            )
        fields: dict[str, object] = {
            "date_from": check_in.isoformat(),
            "date_to": (check_out - timedelta(days=1)).isoformat(),  # Abreise exkl.
            "availability": availability,
        }
        if outbox_id:
            fields["outbox_id"] = outbox_id
        try_enqueue_ari(
            self._client, tenant_id, property_id, "availability", fields,
        )

    def _recompute_dynamic_pricing(self, tenant_id: str, property_id: str) -> None:
        """Dynamic-Pricing-Recompute als Job einreihen (Phase 2) — eine Buchung/
        Storno ändert Auslastung + Orphan-Lücken. Der Worker rechnet den Horizont
        neu und pusht die Tagespreise. Coalesced je Objekt: mehrere Buchungen
        desselben Objekts kurz hintereinander erzeugen nur EINEN Recompute. Der Job
        rechnet den vollen Horizont — funktional eine Obermenge des früheren
        ±2-Tage-Fensters um die Buchung."""
        if self._client is None:
            return
        try_enqueue_recompute(self._client, tenant_id, property_id)

    def list(self, ctx: AuthContext, property_id: str | None = None) -> ReservationListResponse:
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2): Eigentümer sehen NUR Buchungen ihrer zugeordneten
        # Objekte. Leere Zuordnung → leere Liste (fail-closed).
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and not owner_pids:
            return ReservationListResponse(items=[], total=0)
        query = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("tenant_id", tenant_id)
        )
        if owner_pids is not None:
            # Ein vom Client übergebener property_id-Filter darf den Owner-Scope
            # nicht ausweiten — Schnittmenge bilden.
            scoped = (
                [property_id] if property_id and property_id in owner_pids
                else [] if property_id else owner_pids
            )
            if not scoped:
                return ReservationListResponse(items=[], total=0)
            query = query.in_("property_id", scoped)
        elif property_id:
            query = query.eq("property_id", property_id)
        res = query.order("check_in", desc=True).execute()
        mask = load_guest_mask(self._client, ctx.user_id)
        items = [self._row(r, mask) for r in (res.data or [])]
        return ReservationListResponse(items=items, total=len(items))

    def dashboard(self, ctx: AuthContext) -> DashboardResponse:
        """Startseiten-Kennzahlen aus echten Reservierungen (kein Fallback).

        Listen: heutige Check-outs/-ins und die nächsten anstehenden Anreisen.
        KPIs: Check-ins, Umsatz und bestätigte Reservierungen der letzten 30
        Tage, jeweils mit prozentualer Veränderung gegenüber den 30 Tagen davor.
        """
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2): KPIs + Listen nur über die eigenen Objekte, damit
        # ein Eigentümer nicht den tenant-weiten Umsatz/Buchungsfluss sieht.
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and not owner_pids:
            return self._empty_dashboard()
        base_rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("tenant_id", tenant_id)
        )
        if owner_pids is not None:
            base_rows = base_rows.in_("property_id", owner_pids)
        rows = base_rows.execute().data or []

        # Objekttitel je property_id nachladen (Liste zeigt den Objektnamen).
        prop_ids = sorted({r["property_id"] for r in rows if r.get("property_id")})
        titles: dict[str, str] = {}
        if prop_ids:
            props = (
                self._db()
                .table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", prop_ids)
                .execute()
            ).data or []
            for p in props:
                titles[p["id"]] = p.get("title") or ""

        # Währung trägt die Reservierung selbst (properties hat keine currency-Spalte).
        # Betreibt ein Tenant Objekte in mehreren Währungen, darf der Umsatz NICHT
        # zu einer Mischsumme mit beliebigem Label addiert werden (wie R4 für die
        # Kalender-KPIs): nur bei GENAU EINER Währung im Datensatz gibt es eine
        # echte Umsatzzahl, sonst mixed_currency → keine Umsatz-KPI.
        currencies = {r["currency"] for r in rows if r.get("currency")}
        currency = next(iter(currencies)) if len(currencies) == 1 else ""
        mixed_currency = len(currencies) > 1

        today = date.today()
        mask = load_guest_mask(self._client, ctx.user_id)

        def entry(r: dict) -> DashboardEntry:
            guest = r.get("guests") or {}
            name = guest.get("name", "") if isinstance(guest, dict) else ""
            return DashboardEntry(
                reservation_id=r["id"],
                guest_name=mask.name(name) or "",
                property_title=titles.get(r["property_id"], ""),
                channel=r["channel"],
                ota_name=mask.source_value(r.get("ota_name")),
                check_in=r["check_in"],
                check_out=r["check_out"],
                status=r["status"],
            )

        active = [r for r in rows if r.get("status") != "cancelled"]

        checkouts_today = sorted(
            (entry(r) for r in active if _as_date(r["check_out"]) == today),
            key=lambda e: e.check_out,
        )
        checkins_today = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) == today),
            key=lambda e: e.check_in,
        )
        upcoming = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) > today),
            key=lambda e: e.check_in,
        )

        # KPIs: laufende 30-Tage-Periode (inkl. heute) vs. die 30 Tage davor.
        cur_start = today - timedelta(days=29)  # 30 Tage inkl. heute
        prev_start = today - timedelta(days=59)

        def in_window(r: dict, start: date, end: date) -> bool:
            ci = _as_date(r["check_in"])
            return start <= ci <= end

        cur = [r for r in active if in_window(r, cur_start, today)]
        prev = [r for r in active if in_window(r, prev_start, cur_start - timedelta(days=1))]

        def kpi(cur_val: float, prev_val: float) -> DashboardKpi:
            if prev_val == 0:
                return DashboardKpi(value=cur_val, change_pct=None)
            change = (cur_val - prev_val) / prev_val * 100
            return DashboardKpi(value=cur_val, change_pct=round(change, 1))

        checkins_30d = kpi(len(cur), len(prev))
        # Umsatz-KPI NUR für Nutzer mit Betrags-Sichtbarkeit (mask.amounts).
        # Ein Owner ohne PM_BOOKING_TOTAL darf laut §4.2 keinen Gesamtpreis sehen —
        # weder einzeln (überall sonst gegated) noch aggregiert hier. Sonst würde
        # der aggregierte 30-Tage-Umsatz seiner Objekte die Preis-Maskierung
        # durchlöchern. None statt eines maskierten 0-Werts (kein erfundener Betrag).
        # Bei gemischten Währungen ebenfalls None — eine addierte Mischsumme mit
        # einem beliebig herausgegriffenen Label wäre schlicht falsch.
        revenue_30d = (
            kpi(
                sum(float(r.get("total_amount") or 0) for r in cur),
                sum(float(r.get("total_amount") or 0) for r in prev),
            )
            if mask.amounts and not mixed_currency
            else None
        )
        confirmed_30d = kpi(
            sum(1 for r in cur if r.get("status") == "confirmed"),
            sum(1 for r in prev if r.get("status") == "confirmed"),
        )

        return DashboardResponse(
            today=today,
            checkouts_today=checkouts_today,
            checkins_today=checkins_today,
            upcoming=upcoming,
            checkins_30d=checkins_30d,
            revenue_30d=revenue_30d,
            confirmed_30d=confirmed_30d,
            currency=currency if mask.amounts else "",
        )

    @staticmethod
    def _empty_dashboard() -> DashboardResponse:
        """Leeres Dashboard (Owner ohne zugeordnete Objekte) — keine tenant-
        weiten Zahlen leaken, sondern ehrlich Null zeigen."""
        zero = DashboardKpi(value=0, change_pct=None)
        return DashboardResponse(
            today=date.today(),
            checkouts_today=[],
            checkins_today=[],
            upcoming=[],
            checkins_30d=zero,
            revenue_30d=zero,
            confirmed_30d=zero,
            currency="",
        )

    def property_stats(
        self,
        ctx: AuthContext,
        property_id: str,
        date_from: date,
        date_to: date,
    ) -> PropertyStats:
        """Objekt-Kennzahlen für den Statistiken-Reiter (Lodgify „Kontrollzentrum").

        Aggregiert AUSSCHLIESSLICH über die Buchungen DIESES Objekts im Zeitraum
        [date_from, date_to]. Owner-Scope (§4.2): ein Eigentümer erhält nur Zahlen
        seiner eigenen Objekte (fremdes Objekt → 404 wie „nicht gefunden"). Beträge
        sind maskiert (§4.2 „kein Gesamtpreis" → None); die Währung kommt aus den
        Daten (leer bei gemischten Währungen — keine Mischsumme). Jede KPI
        vergleicht die Periode mit der gleich langen Vorperiode.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(property_id)
        if date_to < date_from:
            raise ReservationError(
                "date_to muss nach date_from liegen.", status_code=422
            )

        # Objekt tenant-scoped laden (Titel + Existenz). Owner-Scope zusätzlich.
        prop = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and property_id not in owner_pids:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        rows = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []

        mask = load_guest_mask(self._client, ctx.user_id)
        # Reine Aggregation (property_stats.py) — hält service.py schlank und
        # trennt Rechenlogik von Scope/DB.
        return compute_property_stats(
            property_id=property_id,
            property_title=prop[0].get("title") or "",
            rows=rows,
            date_from=date_from,
            date_to=date_to,
            show_amounts=mask.amounts,
        )

    def create(self, ctx: AuthContext, req: ReservationCreate) -> ReservationResponse:
        tenant_id = self._require_tenant(ctx)

        # 1) Property gehört dem Tenant? (sonst fremde Belegung möglich)
        prop = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        # 2) Double-Booking-Schutz: kein Tag darf booked/blocked sein.
        nights = _nights(req.check_in, req.check_out)
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        taken = [r["date"] for r in (avail.data or []) if r["status"] != "open"]
        if taken:
            raise ReservationError(
                "Zeitraum enthält bereits belegte/gesperrte Tage.", status_code=409
            )
        # Stop-Sell-Schutz: ein von Mitarbeitern gesetzter Stop-Sell sperrt den
        # Tag auf ALLEN Kanälen — auch die interne Rezeptions-Buchung. Der Stopp
        # muss erst aufgehoben werden, bevor hier gebucht werden kann.
        stopped = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if stopped:
            raise ReservationError(
                "Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell "
                "aufheben.", status_code=409
            )

        # 3) Gast anlegen (oder bestehenden per E-Mail wiederverwenden).
        guest_id = self._upsert_guest(tenant_id, req)

        # 4) Preis aus dem zentralen Resolver (eine Preis-Wahrheit). Wird KEIN
        #    Betrag übergeben (total_amount=0), berechnet der Quote die Summe +
        #    Aufschlüsselung automatisch aus Basispreis/Saison/Aufschlägen — ein
        #    manuell gesetzter Betrag (>0) gewinnt weiterhin (Überschreibung).
        total_guests = (
            req.guests.adults + req.guests.children + req.guests.infants
        )
        quote = self._quote(
            req.property_id, req.check_in, req.check_out, total_guests, req.channel.value
        )
        total_amount = req.total_amount if req.total_amount > 0 else quote.total
        currency = quote.currency
        quote_items = [
            # kind klassifiziert die Zeile für die spätere Rechnungserstellung
            # (Booking→Invoice: 'tax' = Abgabe 0 % USt, sonst Übernachtungssatz).
            # tax_rate = zeilen-eigener Satz-Snapshot (Gebühr mit eigener USt).
            {
                "label": line.label,
                "amount": line.amount,
                "kind": line.kind,
                "tax_rate": line.tax_rate,
            }
            for line in quote.lines
        ]
        # 5) Reservierung + Kalender-Belegung + ari_outbox ATOMAR über die RPC
        #    (Migration 0104): Advisory-Lock je Objekt + guarded Upsert schließen
        #    das TOCTOU-Fenster zwischen Check und Write; der EXCLUDE-Constraint
        #    reservations_no_local_overlap ist der DB-seitige Backstop. Die
        #    ari_outbox-Zeile (availability=0) entsteht in derselben Transaktion —
        #    der Channex-Push kann nicht mehr ersatzlos verloren gehen.
        reservation_row = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "guest_id": guest_id,
            "channel": req.channel.value,
            "check_in": req.check_in.isoformat(),
            "check_out": req.check_out.isoformat(),
            "status": req.status.value,
            "total_amount": total_amount,
            "quote_items": quote_items,
            "currency": currency,
            # Belegung (Gästezahl) für Balken + Detailansicht.
            "num_guests": (
                req.guests.adults
                + req.guests.children
                + req.guests.infants
            ),
            "adults": req.guests.adults,
            "children": req.guests.children,
            "infants": req.guests.infants,
            "pets": req.guests.pets,
            # Denormalisierte Kontaktdaten (für OTA-Buchungen ohne guests).
            "guest_email": req.contact.email or None,
            "guest_phone": req.contact.phone or None,
            "guest_language": req.contact.language or None,
            "guest_country": req.contact.country or None,
        }
        try:
            ins = (
                self._db()
                .rpc(
                    "create_reservation_atomic",
                    {
                        "p_reservation": reservation_row,
                        "p_source": req.channel.value,
                        "p_with_outbox": True,
                    },
                )
                .execute()
            )
        except APIError as exc:
            raise _map_booking_conflict(exc) from exc
        result = ins.data or {}
        row = result.get("reservation")
        if not row:
            raise ReservationError("Reservierung konnte nicht angelegt werden.", status_code=500)

        # Realtime: belegte Tage sofort an Channex/OTAs sperren (availability=0),
        # damit keine OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit.
        self._push_channex_availability(
            tenant_id, req.property_id, req.check_in, req.check_out, 0,
            outbox_id=result.get("outbox_id"),
        )
        # Dynamic Pricing der betroffenen Tage neu rechnen (Auslastung/Orphan).
        self._recompute_dynamic_pricing(tenant_id, req.property_id)

        # Loyalty-Aggregate des Gastes (Aufenthalte/Umsatz) neu berechnen.
        if guest_id:
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(self._db(), tenant_id, guest_id)

        log.info(
            "reservation_created",
            property_id=req.property_id,
            nights=len(nights),
            reservation_id=row["id"],
        )

        mask = load_guest_mask(self._client, ctx.user_id)
        guest_name = f"{req.contact.first_name} {req.contact.last_name}".strip()
        return ReservationResponse(
            id=row["id"],
            property_id=row["property_id"],
            guest_id=row.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=row["channel"],
            check_in=row["check_in"],
            check_out=row["check_out"],
            status=row["status"],
            total_amount=mask.amount(float(row.get("total_amount") or 0)),
            currency=(row.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(row.get("ota_name")),
            external_ref=row.get("external_ref"),
        )

    def move(
        self, ctx: AuthContext, reservation_id: str, req: ReservationMove
    ) -> ReservationResponse:
        """Reservierung verschieben (Objekt/Zeitraum) oder resizen (Check-in/out).

        Doppelbuchungs-Schutz greift erneut: die NEUEN Nächte dürfen — außer den
        eigenen, bereits dieser Reservierung gehörenden Tagen — keinen booked/
        blocked-Tag treffen. Ablauf (kein Teil-Commit nach außen):
          1) Reservierung + Ziel-Objekt tenant-scoped prüfen.
          2) Ziel-Nächte gegen Fremdbelegung prüfen (eigene Alt-Tage ausgenommen).
          3) Alte Belegung freigeben (availability=open, Channex availability=1).
          4) Neue Nächte belegen (booked, Channex availability=0).
          5) reservations-Zeile aktualisieren.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        res = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        current = res.data[0]
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Stornierte Reservierungen lassen sich nicht verschieben.",
                status_code=409,
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Aufenthalt ist abgeschlossen (ausgecheckt + fakturiert) — "
                "Zeitraum/Objekt lassen sich nicht mehr ändern.",
                status_code=409,
            )
        # Ein eingecheckter (physisch anwesender) Gast darf NICHT verschoben werden:
        # bei einem Objektwechsel würden die Alt-Nächte freigegeben und als
        # availability=1 an die OTAs gepusht, obwohl der Gast noch im Zimmer ist
        # (Doppelbelegungs-/Überbuchungsrisiko). Symmetrisch zu check_out(), das
        # checked_in_at ebenfalls als echten „im Haus"-Zustand behandelt.
        if current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist bereits eingecheckt — der Aufenthalt lässt sich nicht "
                "mehr verschieben. Bitte zuerst auschecken.",
                status_code=409,
            )
        # Eine OTA-importierte Buchung (source_channex_booking_id gesetzt) darf
        # lokal NICHT verschoben werden: der Move hebt die Buchung beim Portal
        # (Booking/Airbnb) NICHT auf, gibt aber die Alt-Nächte lokal frei und pusht
        # availability=1 an Channex → das Portal verkauft die vom Gast dort weiter
        # gehaltenen Nächte erneut (Überbuchung). OTA-Rows sind zudem vom EXCLUDE-
        # Constraint (0104) ausgenommen, sodass der Ziel-Guard sie nicht abfängt.
        # Änderungen an OTA-Buchungen laufen ausschließlich über das Portal → Import.
        if current.get("source_channex_booking_id"):
            raise ReservationError(
                "OTA-Buchungen (Booking, Airbnb & Co.) lassen sich nicht lokal "
                "verschieben — bitte die Änderung im Portal vornehmen.",
                status_code=409,
            )

        old_property = current["property_id"]
        old_nights = {
            d.isoformat()
            for d in _nights(_as_date(current["check_in"]), _as_date(current["check_out"]))
        }
        new_nights = _nights(req.check_in, req.check_out)
        new_keys = {d.isoformat() for d in new_nights}

        # Ziel-Objekt gehört dem Tenant?
        prop = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        # Double-Booking-Schutz für die Ziel-Nächte. Eigene Alt-Tage am SELBEN
        # Objekt zählen nicht als Konflikt (Resize/Verkürzen am Platz).
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        same_property = req.property_id == old_property
        taken = [
            r["date"]
            for r in (avail.data or [])
            if r["status"] != "open"
            and not (same_property and r["date"] in old_nights)
        ]
        if taken:
            raise ReservationError(
                "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                status_code=409,
            )
        # Stop-Sell-Schutz für die Ziel-Nächte — wie create()/create_public_booking.
        # Ein Stop-Sell-Tag kann in availability noch als 'open' geführt sein
        # (Sync-Verzug), deshalb explizit die stop_sell-Tabelle prüfen; sonst
        # landet ein Move auf gesperrten Tagen, die auf OTAs weiter verkauft werden.
        stopped = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if stopped:
            raise ReservationError(
                "Ziel-Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den "
                "Stop-Sell aufheben.", status_code=409,
            )

        # Reservierungs-Zeile ZUERST umziehen: der EXCLUDE-Constraint
        # reservations_no_local_overlap (0104) validiert den Ziel-Zeitraum
        # atomar gegen alle anderen lokalen Buchungen. Kollidiert er, schlägt
        # das UPDATE fehl (23P01 → 409), BEVOR ein Kalendertag angefasst wurde
        # — kein halber Move (alte Tage frei, aber keine neue Belegung).
        try:
            upd = (
                self._db()
                .table("reservations")
                .update(
                    {
                        "property_id": req.property_id,
                        "check_in": req.check_in.isoformat(),
                        "check_out": req.check_out.isoformat(),
                    }
                )
                .eq("id", reservation_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        except APIError as exc:
            if exc.code == "23P01":
                raise ReservationError(
                    "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                    status_code=409,
                ) from exc
            raise
        if not upd.data:
            raise ReservationError(
                "Reservierung konnte nicht verschoben werden.", status_code=500
            )

        # Alte Belegung freigeben: nur Tage, die NICHT erneut belegt werden
        # (beim Resize am Platz bleiben überlappende Tage booked). Zentrale
        # Freigabe (gefiltert gegen Fremdbelegung, lokal + Channex); der Recompute
        # läuft weiter unten gebündelt für BEIDE betroffenen Objekte.
        release = sorted(old_nights - new_keys) if same_property else sorted(old_nights)
        self._release_nights(
            tenant_id, old_property, release, reservation_id, recompute=False
        )

        # Neue Nächte belegen — aber NICHT eine parallel importierte OTA-Belegung
        # überschreiben. Der EXCLUDE-Constraint befreit OTA-Buchungen
        # (source_channex_booking_id gesetzt, Migration 0104), sodass das UPDATE
        # oben nicht fehlschlägt, wenn zwischen Vorprüfung und Write eine OTA-Nacht
        # importiert wurde. Deshalb den Ist-Zustand der Zieltage frisch lesen und
        # nur die Tage belegen, die NICHT bereits von einer fremden Quelle als
        # 'booked' geführt werden (sonst würde source auf den lokalen Kanal
        # geklobbert und die OTA-Herkunft ginge verloren).
        occupied_now = {
            r["date"]: r.get("source")
            for r in (
                self._db()
                .table("availability")
                .select("date,status,source")
                .eq("property_id", req.property_id)
                .gte("date", req.check_in.isoformat())
                .lt("date", req.check_out.isoformat())
                .eq("status", "booked")
                .execute()
            ).data or []
        }
        own_source = current.get("channel") or "direct"
        occupy_rows = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": "booked",
                "source": own_source,
            }
            for day in new_nights
            # Tag von fremder Quelle belegt (nicht unser eigener Kanal, nicht ein
            # eigener Alt-Tag am selben Objekt) → nicht überschreiben.
            if not (
                day.isoformat() in occupied_now
                and occupied_now[day.isoformat()] not in (own_source, None)
                and not (same_property and day.isoformat() in old_nights)
            )
        ]
        if occupy_rows:
            self._db().table("availability").upsert(
                occupy_rows, on_conflict="property_id,date"
            ).execute()
        self._push_channex_availability(
            tenant_id, req.property_id, req.check_in, req.check_out, 0
        )
        # Dynamic Pricing für BEIDE betroffenen Objekte neu rechnen — ein Move
        # ändert Auslastung + Orphan-Lücken am freigegebenen Alt-Objekt UND am neu
        # belegten Ziel-Objekt genau wie eine Buchung/Storno. Ohne den Recompute
        # (den create()/cancel() bereits machen) drifteten die Tagespreise beider
        # Zeiträume bis zum nächsten 15-min-reconcile-Tick.
        self._recompute_dynamic_pricing(tenant_id, req.property_id)
        if not same_property:
            self._recompute_dynamic_pricing(tenant_id, old_property)
        log.info(
            "reservation_moved",
            reservation_id=reservation_id,
            property_id=req.property_id,
            nights=len(new_nights),
        )
        # guests(name) für die maskierte Antwort nachladen.
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row((full.data or [upd.data[0]])[0], mask)

    def cancel(
        self, ctx: AuthContext, reservation_id: str, reason: str
    ) -> ReservationResponse:
        """Reservierung stornieren — kanal-agnostisch (Direkt, eigene Plattform,
        alle Channex-OTAs). Begründung ist PFLICHT und wird dokumentiert.

        Ablauf:
          1) Reservierung tenant-scoped laden; nicht doppelt stornieren.
          2) Status=cancelled + Storno-Felder (wer/wann/warum) setzen.
          3) Belegte Nächte freigeben (availability=open) + an Channex zurück
             (availability=1), damit die Tage wieder an die OTAs gehen.
          4) Append-only Audit-Zeile (reservation_cancellation_log).

        Hinweis: Eine lokale Storno hebt eine OTA-Buchung NICHT beim Portal auf
        (das UI weist darauf hin) — wir geben nur die lokale Belegung frei.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        clean_reason = (reason or "").strip()
        if not clean_reason:
            raise ReservationError(
                "Eine Begründung ist für die Stornierung erforderlich.",
                status_code=422,
            )
        res = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        current = res.data[0]
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Reservierung ist bereits storniert.", status_code=409
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Aufenthalt ist abgeschlossen (ausgecheckt + fakturiert) — "
                "Korrekturen laufen über die Stornorechnung in der Buchhaltung.",
                status_code=409,
            )
        # Eine OTA-importierte Buchung (source_channex_booking_id gesetzt) darf lokal
        # NICHT storniert werden: der lokale Storno gibt die Nächte frei und pusht
        # availability=1 an Channex, während der Gast beim Portal (Booking/Airbnb)
        # weiter gebucht ist → das Portal verkauft die Nächte erneut (Überbuchung).
        # OTA-Stornos laufen ausschließlich über das Portal → Import (bookings_sync
        # gibt dann quellen-/tag-genau nur die wirklich frei gewordenen Tage frei).
        if current.get("source_channex_booking_id"):
            raise ReservationError(
                "OTA-Buchungen (Booking, Airbnb & Co.) lassen sich nicht lokal "
                "stornieren — bitte die Stornierung im Portal auslösen.",
                status_code=409,
            )

        now = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update(
                {
                    "status": "cancelled",
                    "cancel_reason": clean_reason,
                    "cancelled_by": ctx.user_id,
                    "cancelled_at": now,
                }
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Reservierung konnte nicht storniert werden.", status_code=500
            )

        # Belegte Nächte freigeben (nur die dieser Reservierung) — zentrale
        # Freigabe: gefiltert gegen Fremdbelegung, lokal + Channex + Recompute.
        property_id = current["property_id"]
        nights = _nights(_as_date(current["check_in"]), _as_date(current["check_out"]))
        self._release_nights(
            tenant_id, property_id, [d.isoformat() for d in nights], reservation_id
        )

        # Audit: append-only Storno-Historie (Best-Effort — Log-Fehler darf die
        # Stornierung nicht kippen).
        try:
            self._db().table("reservation_cancellation_log").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "by_user_id": ctx.user_id,
                    "reason": clean_reason,
                    "channel": current.get("channel"),
                    "ota_name": current.get("ota_name"),
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Audit ist best-effort
            log.warning("reservation_cancellation_log_failed", error=str(exc))

        # Loyalty-Aggregate des Gastes neu berechnen (Storno reduziert Umsatz).
        if current.get("guest_id"):
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(
                self._db(), tenant_id, str(current["guest_id"])
            )

        log.info(
            "reservation_cancelled",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
            channel=current.get("channel"),
        )
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row((full.data or upd.data)[0], mask)

    def _load_owned(self, tenant_id: str, reservation_id: str) -> dict:
        """Reservierung tenant-scoped laden (404, wenn fremd/fehlend)."""
        _require_uuid(reservation_id)
        rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        return rows[0]

    def check_in(self, ctx: AuthContext, reservation_id: str) -> ReservationResponse:
        """Gast einchecken: checked_in_at setzen (0091).

        Nur bestätigte Buchungen; kein Doppel-Check-in. Early-Check-in (vor dem
        Anreisetag) ist erlaubt — das Frontend zeigt dafür einen Hinweis, der
        Server blockiert bewusst nicht (Rezeption entscheidet).
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        status = current.get("status")
        if status == "cancelled":
            raise ReservationError(
                "Stornierte Buchung kann nicht eingecheckt werden.", status_code=409
            )
        if status == "pending":
            raise ReservationError(
                "Buchung ist noch nicht bestätigt — bitte zuerst bestätigen.",
                status_code=409,
            )
        if current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist bereits eingecheckt.", status_code=409
            )
        if current.get("checked_out_at") or status == "completed":
            raise ReservationError(
                "Buchung ist bereits abgereist.", status_code=409
            )

        upd = (
            self._db()
            .table("reservations")
            .update({"checked_in_at": datetime.now(UTC).isoformat()})
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Check-in konnte nicht gespeichert werden.", status_code=500
            )
        log.info(
            "reservation_checked_in",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def check_out(
        self,
        ctx: AuthContext,
        reservation_id: str,
        req: CheckOutRequest | None = None,
    ) -> CheckOutResponse:
        """Gast auschecken — erzeugt verpflichtend die finale Rechnung.

        Reihenfolge (kein halber Zustand, Supabase kennt keine Multi-Statement-
        Transaktion): (1) Guards ohne Write, (2) Rechnung über den Booking→
        Invoice-Builder (idempotent — bestehende aktive Rechnung wird
        wiederverwendet; jeder Builder-Fehler bricht den Check-out ab),
        (3) erst DANACH checked_out_at + status='completed' setzen. Ein Retry
        nach Fehler in (3) ist sicher, weil (2) die Rechnung wiederfindet.

        Die Rechnung entsteht serverseitig als System-Nebeneffekt des Check-outs
        (Front-Desk-Aktion) — bewusst OHNE OWNER_REPORTING-Anforderung.
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Stornierte Buchung kann nicht ausgecheckt werden.", status_code=409
            )
        if not current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist noch nicht eingecheckt.", status_code=409
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Gast ist bereits ausgecheckt.", status_code=409
            )
        # Check-out erst AM Abreisetag (oder später — z. B. vergessener
        # Check-out), nie vorher: die finale Rechnung bepreist den vollen
        # Aufenthalt. Reist der Gast früher ab, wird zuerst der Zeitraum
        # verkürzt (Buchung anpassen), dann ausgecheckt. Tagesvergleich in UTC
        # (pragmatisch; Objekt-Zeitzonen sind nicht modelliert).
        departure = _as_date(current["check_out"])
        if datetime.now(UTC).date() < departure:
            raise ReservationError(
                f"Check-out ist erst am Abreisetag "
                f"({departure.strftime('%d.%m.%Y')}) möglich. Reist der Gast "
                "früher ab, bitte zuerst den Aufenthalt verkürzen.",
                status_code=409,
            )

        # Lazy-Import über die Slice-Grenze (Muster guests/tasks-Imports).
        from src.features.buchhaltung.reservation_invoice import (  # noqa: PLC0415
            create_from_reservation,
        )
        from src.features.buchhaltung.service import (  # noqa: PLC0415
            BuchhaltungError,
        )

        payment = req or CheckOutRequest()
        try:
            invoice = create_from_reservation(
                self._db(),
                tenant_id,
                reservation_id,
                payment_method=payment.payment_method,
                card_brand=payment.card_brand,
            )
        except BuchhaltungError as exc:
            # Fehlertext 1:1 durchreichen (z. B. „Übernachtungs-Steuersatz
            # fehlt") — Check-out abgebrochen, nichts geschrieben.
            raise ReservationError(exc.message, status_code=exc.status_code) from exc

        update_fields: dict = {
            "checked_out_at": datetime.now(UTC).isoformat(),
            "status": "completed",
        }
        if payment.payment_method in ("cash", "card"):
            # Am Empfang beglichen → Buchung ist vollständig bezahlt (sonst
            # zeigte der Slider weiter „Noch offen").
            update_fields["paid_amount"] = current.get("total_amount")
        upd = (
            self._db()
            .table("reservations")
            .update(update_fields)
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Rechnung wurde erstellt, aber der Check-out konnte nicht "
                "gespeichert werden — bitte erneut auschecken (die Rechnung "
                "wird dabei wiederverwendet).",
                status_code=500,
            )
        log.info(
            "reservation_checked_out",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
            invoice_id=invoice["id"],
            invoice_already_existed=invoice["already_existed"],
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return CheckOutResponse(
            reservation=self._row(self._load_owned(tenant_id, reservation_id), mask),
            invoice_id=invoice["id"],
            invoice_number=invoice.get("invoice_number"),
            invoice_already_existed=bool(invoice["already_existed"]),
        )

    def detail(self, ctx: AuthContext, reservation_id: str) -> ReservationDetail:
        """Vollständige Reservierungs-Detailansicht (rechter Slider). Tenant-
        scoped; Beträge + Kontaktdaten werden maskierungskonform geliefert."""
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        res = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        r = res.data[0]

        # Owner-Scope (§4.2): fremdes Objekt → wie „nicht gefunden" behandeln.
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and r.get("property_id") not in owner_pids:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)

        title = ""
        prop = (
            self._db()
            .table("properties")
            .select("title")
            .eq("id", r["property_id"])
            .limit(1)
            .execute()
        ).data
        if prop:
            title = prop[0].get("title") or ""

        mask = load_guest_mask(self._client, ctx.user_id)
        guest = r.get("guests") or {}
        guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
        ci, co = _as_date(r["check_in"]), _as_date(r["check_out"])

        total = float(r.get("total_amount") or 0)
        paid = float(r.get("paid_amount") or 0)
        items = [
            QuoteItem(label=str(it.get("label", "")), amount=float(it.get("amount") or 0))
            for it in (r.get("quote_items") or [])
            if isinstance(it, dict)
        ]

        # Aktive Rechnung zur Buchung (Booking→Invoice-Brücke 0092) für den
        # Rechnungs-Abschnitt im Slider — Beträge hinter mask.amounts.
        invoice_info: ReservationInvoiceInfo | None = None
        inv_rows = (
            self._db()
            .table("invoices")
            .select("id, invoice_number, status, gross_amount, currency")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("invoice_type", "invoice")
            .neq("status", "cancelled")
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if inv_rows:
            inv = inv_rows[0]
            invoice_info = ReservationInvoiceInfo(
                id=inv["id"],
                invoice_number=inv.get("invoice_number"),
                status=inv.get("status") or "",
                gross_amount=mask.amount(float(inv.get("gross_amount") or 0)),
                currency=(inv.get("currency") or "") if mask.amounts else "",
            )
        return ReservationDetail(
            id=r["id"],
            property_id=r["property_id"],
            property_title=title,
            guest_id=r.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=r["channel"],
            ota_name=mask.source_value(r.get("ota_name")),
            external_ref=r.get("external_ref"),
            external_url=r.get("external_url"),
            check_in=ci,
            check_out=co,
            nights=(co - ci).days,
            status=r["status"],
            num_guests=int(r.get("num_guests") or 1),
            adults=int(r.get("adults") or 1),
            children=int(r.get("children") or 0),
            infants=int(r.get("infants") or 0),
            pets=int(r.get("pets") or 0),
            currency=(r.get("currency") or "") if mask.amounts else "",
            total_amount=mask.amount(total),
            paid_amount=mask.amount(paid),
            due_amount=mask.amount(max(0.0, total - paid)),
            quote_items=items if mask.amounts else [],
            checkin_time=r.get("checkin_time"),
            checkout_time=r.get("checkout_time"),
            note=r.get("note"),
            checked_in_at=r.get("checked_in_at"),
            checked_out_at=r.get("checked_out_at"),
            invoice=invoice_info,
            cancel_reason=r.get("cancel_reason"),
            cancelled_at=r.get("cancelled_at"),
            guest_email=mask.contact_value(r.get("guest_email")),
            guest_phone=mask.contact_value(r.get("guest_phone")),
            guest_language=r.get("guest_language"),
            guest_country=r.get("guest_country"),
            created_at=r.get("created_at"),
        )

    def _release_nights(
        self,
        tenant_id: str,
        property_id: str,
        nights: list[str],
        reservation_id: str,
        *,
        recompute: bool = True,
    ) -> None:
        """Gibt geräumte Nächte einer Reservierung frei — die EINE Stelle, an der
        eine Reservierung Kalendertage zurückgibt (move-Resize, cancel, künftig
        jeder weitere Pfad). Zusammengeführt aus den zuvor kopierten Blöcken in
        move()/cancel(), damit der Alt-/Neu-Diff nie an einer neuen Stelle
        vergessen werden kann (Wurzel: „Vorwärts-Schritt ohne Gegenzustand").

        Gibt lokal (availability='open') UND an Channex (availability=1) NUR die
        Tage frei, die NICHT noch von einer anderen aktiven Buchung (z. B. OTA)
        belegt sind — sonst würde ein real belegter Tag als verkaufbar gemeldet
        (Überbuchung). Rechnet danach Dynamic Pricing neu (Auslastung/Orphan
        ändern sich), sofern gewünscht.
        """
        if not nights:
            return
        still = self._days_still_booked_by_others(property_id, nights, reservation_id)
        release = [d for d in nights if d not in still]
        if not release:
            return
        self._db().table("availability").upsert(
            [
                {"property_id": property_id, "date": d,
                 "status": "open", "source": "manual"}
                for d in release
            ],
            on_conflict="property_id,date",
        ).execute()
        self._release_channex(tenant_id, property_id, release)
        if recompute:
            self._recompute_dynamic_pricing(tenant_id, property_id)

    def _release_channex(
        self, tenant_id: str, property_id: str, days: list[str]
    ) -> None:
        """Freigegebene Tage zusammenhängend an Channex melden (availability=1).

        Sortierte ISO-Tage werden zu Intervallen gebündelt; jedes Intervall wird
        als [von, bis] (inklusiv) gepusht. Best-effort (ari_outbox-Retry).
        """
        if not days:
            return
        ordered = [date.fromisoformat(d) for d in sorted(days)]
        start = prev = ordered[0]
        for cur in ordered[1:]:
            if (cur - prev).days == 1:
                prev = cur
                continue
            self._push_channex_availability(
                tenant_id, property_id, start, prev + timedelta(days=1), 1
            )
            start = prev = cur
        self._push_channex_availability(
            tenant_id, property_id, start, prev + timedelta(days=1), 1
        )

    def _quote(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        guests: int,
        channel: str,
    ) -> QuoteResponse:
        """Buchungs-Quote über den zentralen Resolver (eine Preis-Wahrheit)."""
        from src.features.pricing.resolver import PricingResolver
        from src.features.pricing.schemas import QuoteRequest

        return PricingResolver(service_client=self._db()).quote(
            QuoteRequest(
                property_id=property_id,
                check_in=check_in,
                check_out=check_out,
                guests=max(1, guests),
                channel=channel,
            )
        )

    def _upsert_guest(self, tenant_id: str, req: ReservationCreate) -> str | None:
        # 1) Fest zugeordneter Gast (z. B. aus der Gästekarte): nur übernehmen,
        #    wenn er DIESEM Tenant gehört — sonst ignorieren (kein Fremd-Link).
        if req.guest_id:
            owned = (
                self._db()
                .table("guests")
                .select("id")
                .eq("id", req.guest_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )
            if owned.data:
                return owned.data[0]["id"]
        # 2) Sonst zentraler Resolver (E-Mail→Telefon→Neuanlage), ein Pfad für
        #    alle Kanäle. Keine Dublette bei wiederkehrendem Gast.
        return resolve_or_create_guest(
            self._db(),
            tenant_id,
            ResolverContact(
                first_name=req.contact.first_name,
                last_name=req.contact.last_name,
                email=req.contact.email,
                phone=req.contact.phone,
                channel="direct",
                # Gästemappen-Stammdaten (0046): strukturiert mitgeben, damit
                # die Gästekartei nicht nur den zusammengesetzten Namen hat.
                language=req.contact.language,
                country=req.contact.country,
            ),
        )

    def _row(self, r: dict, mask: GuestMask) -> ReservationResponse:
        guest = r.get("guests") or {}
        guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
        amount = mask.amount(float(r.get("total_amount") or 0))
        paid = mask.amount(float(r.get("paid_amount") or 0))
        return ReservationResponse(
            id=r["id"],
            property_id=r["property_id"],
            guest_id=r.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=r["channel"],
            check_in=r["check_in"],
            check_out=r["check_out"],
            status=r["status"],
            total_amount=amount,
            paid_amount=paid,
            currency=(r.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(r.get("ota_name")),
            external_ref=r.get("external_ref"),
            num_guests=int(r.get("num_guests") or 1),
            checked_in_at=r.get("checked_in_at"),
            checked_out_at=r.get("checked_out_at"),
        )
