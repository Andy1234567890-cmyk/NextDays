"""Service-Schicht für calendar — das Herzstück (Lastenheft §2.2).

Verfügbarkeitslogik + Double-Booking-Schutz über die availability-Tabelle
(eine Zeile pro property_id/date). Manuelle Preisüberschreibung pro Tag.

Der Supabase-Client wird injiziert → im Test mockbar; echte DB-Calls beim
laufenden Stack. Kein stilles Exception-Swallowing (PROJECT.md).
"""
from datetime import date, timedelta
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.jobs.queue import try_enqueue_ari

from .schemas import (
    AvailabilityCheck,
    AvailabilitySource,
    AvailabilityStatus,
    BlockRequest,
    BoardProperty,
    BoardResponse,
    BulkEditRequest,
    BulkEditResult,
    DateRange,
    DayAvailability,
    PriceOverrideRequest,
    SliceHealth,
    StopSellDay,
)

if TYPE_CHECKING:
    from src.features.pricing.resolver import PricingResolver

log = get_logger("nextdays.calendar")


def _contiguous_open_spans(
    rng: "DateRange", booked_iso: set[str]
) -> list[tuple[date, date]]:
    """Zusammenhängende [start, end)-Zeiträume der Tage in `rng`, die NICHT in
    `booked_iso` (belegte ISO-Tage) liegen. Für den tag-genauen Channex-Freigabe-
    Push: gebuchte Tage unterbrechen einen Span, sodass availability=1 nie für einen
    belegten Tag gesendet wird. `end` ist exklusiv (wie DateRange)."""
    spans: list[tuple[date, date]] = []
    span_start: date | None = None
    for day in rng.nights():
        if day.isoformat() in booked_iso:
            if span_start is not None:
                spans.append((span_start, day))  # end exklusiv = erster belegter Tag
                span_start = None
        elif span_start is None:
            span_start = day
    if span_start is not None:
        spans.append((span_start, rng.end))
    return spans


class CalendarError(Exception):
    """Fachlicher Kalender-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class CalendarService:
    slice_name = "calendar"

    def __init__(self, client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise CalendarError("Kalender-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """Stellt sicher, dass das Objekt sichtbar ist (sonst 404).

        Der Service nutzt den Service-Role-Key und umgeht damit RLS — der Scope
        MUSS hier explizit erzwungen werden, sonst lassen sich über geratene
        property_id fremde Verfügbarkeiten/Preise/Stop-Sells lesen oder ändern.
        Zwei Ebenen: (1) Tenant-Scope für alle, (2) Owner sieht laut §4.2 NUR
        seine zugeordneten Objekte (owner_property_assignments), nicht die
        anderer Eigentümer desselben Tenants. Einmal am Eintritt geprüft, sind
        die nachgelagerten property_id-Reads sicher.
        """
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)
        # Eigentümer dürfen nur ihre zugeordneten Objekte sehen (§4.2) — fremde
        # Objekte wie „nicht gefunden" behandeln (keine Existenz verraten).
        if is_owner(ctx) and property_id not in owner_property_ids(self._db(), ctx):
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

    def _require_tenant_property(self, tenant_id: str, property_id: str) -> None:
        """Tenant-Scope-Prüfung für SCHREIB-Pfade (block/price/stop-sell/season).

        Diese Endpunkte verlangen MANAGE_CALENDAR/EDIT_CALENDAR_BOOKINGS — die
        owner-Rolle besitzt keine davon und erreicht sie nie. Deshalb reicht hier
        der reine Tenant-Scope; der Owner-Self-Scope liegt auf den Lese-Pfaden
        (_require_own_property mit ctx)."""
        if not tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

    @staticmethod
    def _strip_prices_for_owner(
        ctx: AuthContext, days: list[DayAvailability]
    ) -> list[DayAvailability]:
        """Eigentümer haben kein Preis-Recht (§4.2, kein VIEW_GUEST_FULL) — die
        Tagespreise/Preisfaktoren werden für sie entfernt (Verfügbarkeit +
        Min-Stay + Belegung bleiben sichtbar)."""
        if not is_owner(ctx):
            return days
        return [
            d.model_copy(
                update={"price": None, "price_source": "none", "price_factors": None}
            )
            for d in days
        ]

    def _resolver(self) -> "PricingResolver":
        """Zentraler Preis-Resolver (eine Preis-Wahrheit für Kalender + Quote)."""
        from src.features.pricing.resolver import PricingResolver

        return PricingResolver(service_client=self._db())

    def get_availability(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[DayAvailability]:
        """Tagesstatus im Zeitraum inkl. Preis + Min-Stay. Fehlende Tage = offen.

        Preis je Tag kommt aus dem zentralen Preis-Resolver (override > weekday >
        base) — DIESELBE Wahrheit wie der Buchungs-Quote, damit Kalender und Quote
        nie auseinanderlaufen. Min-Stay kommt aus dem Rate-Plan (per-Tag-
        Restriktionen sind v2). Ohne Rate-Plan/Override bleibt der Preis None
        (kein erfundener Fallback-Preis).
        """
        self._require_own_property(ctx, property_id)
        days = self._days_for(property_id, rng)
        return self._strip_prices_for_owner(ctx, days)

    def _days_for(self, property_id: str, rng: DateRange) -> list[DayAvailability]:
        """Tagesstatus + Preis + Min-Stay OHNE Scope-Prüfung — interner Helfer für
        get_availability (nach Scope-Check) und die Schreib-Pfade (block), die den
        Scope bereits über _require_tenant_property erzwungen haben."""
        rows = self._fetch_days(property_id, rng)
        effective = {
            d.date.isoformat(): d
            for d in self._resolver().effective_prices(property_id, rng.start, rng.end)
        }
        _base, min_stay = self._fetch_rate_plan(property_id)
        return self._build_days(rng, rows, effective, min_stay)

    @staticmethod
    def _build_days(
        rng: DateRange,
        rows: list[dict],
        effective: dict,
        min_stay: int | None,
    ) -> list[DayAvailability]:
        """Tagesliste aus availability-Zeilen + effektiven Preisen bauen. Eine
        Quelle für Einzel- (get_availability) und Batch-Pfad (get_board), damit
        beide identische DayAvailability liefern."""
        by_date = {r["date"]: r for r in rows}
        result: list[DayAvailability] = []
        for day in rng.nights():
            key = day.isoformat()
            row = by_date.get(key)
            eff = effective.get(key)
            result.append(
                DayAvailability(
                    date=day,
                    status=(
                        AvailabilityStatus(row["status"])
                        if row is not None
                        else AvailabilityStatus.open
                    ),
                    source=(
                        AvailabilitySource(row["source"])
                        if row is not None
                        else AvailabilitySource.manual
                    ),
                    price=eff.price if eff else None,
                    price_source=eff.source if eff else "none",
                    price_factors=eff.factors if eff else None,
                    min_stay=min_stay,
                    closed_to_arrival=bool(
                        row.get("closed_to_arrival") if row else False
                    ),
                    closed_to_departure=bool(
                        row.get("closed_to_departure") if row else False
                    ),
                )
            )
        return result

    def get_board(
        self, ctx: AuthContext, property_ids: list[str], rng: DateRange
    ) -> BoardResponse:
        """Kalender-Batch: Availability + Preise + Min-Stay + Stop-Sell für ALLE
        angefragten Objekte des Tenants in EINEM Aufruf.

        Ersetzt die N+1-Einzelabrufe (früher 2 HTTP-Calls × je 6 DB-Queries pro
        Objekt) durch wenige gebündelte `.in_(property_ids)`-Queries. Nur Objekte,
        die DIESEM Tenant gehören, werden geladen (Tenant-Scope wie überall, da der
        Service-Role-Key RLS umgeht); ein Eigentümer sieht laut §4.2 zusätzlich
        NUR seine zugeordneten Objekte. Fremde/unbekannte IDs werden still
        verworfen; Tagespreise werden für Eigentümer entfernt (kein Preis-Recht).
        """
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        if not property_ids:
            return BoardResponse(items=[])
        # 1 Query: eigene Objekte des Tenants (zugleich Scope-Filter).
        owned = {
            r["id"]
            for r in (
                self._db()
                .table("properties")
                .select("id")
                .eq("tenant_id", ctx.tenant_id)
                .in_("id", property_ids)
                .execute()
            ).data or []
        }
        # Owner: zusätzlich auf die zugeordneten Objekte einschränken (§4.2).
        if is_owner(ctx):
            owned &= owner_property_ids(self._db(), ctx)
        # Eingabereihenfolge beibehalten, aber nur sichtbare IDs.
        pids = [p for p in property_ids if p in owned]
        if not pids:
            return BoardResponse(items=[])

        start_iso, end_iso = rng.start.isoformat(), rng.end.isoformat()
        # 1 Query: availability aller Objekte im Zeitraum.
        avail_rows = (
            self._db()
            .table("availability")
            .select("property_id,date,status,source,closed_to_arrival,closed_to_departure")
            .in_("property_id", pids)
            .gte("date", start_iso)
            .lt("date", end_iso)
            .execute()
        ).data or []
        avail_by_pid: dict[str, list[dict]] = {}
        for r in avail_rows:
            avail_by_pid.setdefault(r["property_id"], []).append(r)

        # 1 Query: Rate-Plans (Min-Stay + Währung je Objekt; ältester gewinnt).
        min_stay_by_pid, currency_by_pid = self._fetch_rate_plan_bulk(pids)
        # 4 Queries (im Resolver): effektive Preise aller Objekte.
        prices = self._resolver().effective_prices_bulk(pids, rng.start, rng.end)
        # 1 Query: Stop-Sells aller Objekte im Zeitraum.
        stop_by_pid = self._list_stop_sell_bulk(pids, rng)

        items: list[BoardProperty] = []
        for pid in pids:
            effective = {d.date.isoformat(): d for d in prices.get(pid, [])}
            days = self._build_days(
                rng, avail_by_pid.get(pid, []), effective, min_stay_by_pid.get(pid)
            )
            items.append(
                BoardProperty(
                    property_id=pid,
                    # Owner sehen keine Preise — dann auch keine Währung nötig.
                    currency=None if is_owner(ctx) else currency_by_pid.get(pid),
                    days=self._strip_prices_for_owner(ctx, days),
                    stop_sell=stop_by_pid.get(pid, []),
                )
            )
        return BoardResponse(items=items)

    def _fetch_rate_plan_bulk(
        self, property_ids: list[str]
    ) -> tuple[dict[str, int | None], dict[str, str | None]]:
        """Min-Stay UND Währung je Objekt aus dem ältesten Rate-Plan (eine
        `.in_()`-Query). Die Währung reicht das Board ans Frontend durch, damit
        die Tagespreise korrekt formatiert werden (nicht mehr aus Reservierungen
        abgeleitet — Objekte ohne Buchung hätten sonst keine Währung)."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id,min_stay,currency,created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        min_stay: dict[str, int | None] = {}
        currency: dict[str, str | None] = {}
        for r in rows:
            pid = r.get("property_id")
            if isinstance(pid, str) and pid not in min_stay:  # erster = ältester
                ms = r.get("min_stay")
                min_stay[pid] = int(ms) if ms is not None else None
                currency[pid] = r.get("currency") or None
        return min_stay, currency

    def _list_stop_sell_bulk(
        self, property_ids: list[str], rng: DateRange
    ) -> dict[str, list[StopSellDay]]:
        """Stop-Sells aller Objekte im Zeitraum (eine `.in_()`-Query) inkl.
        travel_agencies-Name fürs Balken-Label — gruppiert nach property_id."""
        rows = (
            self._db()
            .table("stop_sell")
            .select(
                "id,property_id,date,reason,source,agency_id,travel_agencies(name)"
            )
            .in_("property_id", property_ids)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .order("date")
            .execute()
        ).data or []
        out: dict[str, list[StopSellDay]] = {}
        for row in rows:
            agency = row.pop("travel_agencies", None) or {}
            row["agency_name"] = agency.get("name") if isinstance(agency, dict) else None
            out.setdefault(row["property_id"], []).append(StopSellDay(**row))
        return out

    def check_availability(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> AvailabilityCheck:
        """Double-Booking-Schutz: frei nur, wenn KEIN Tag booked/blocked ist."""
        conflicts: list[date] = [
            d.date
            for d in self.get_availability(ctx, property_id, rng)
            if d.status != AvailabilityStatus.open
        ]
        return AvailabilityCheck(
            property_id=property_id,
            available=not conflicts,
            conflicting_days=conflicts,
        )

    def block(self, tenant_id: str, req: BlockRequest) -> int:
        """Tage sperren (manuell). Idempotenter Upsert pro Tag. Gibt Anzahl zurück.

        Schützt vor Double-Booking: bereits gebuchte Tage werden NICHT überschrieben.
        """
        self._require_tenant_property(tenant_id, req.property_id)
        booked = [
            d.date
            for d in self._days_for(req.property_id, req.range)
            if d.status == AvailabilityStatus.booked
        ]
        if booked:
            raise CalendarError(
                "Zeitraum enthält bereits gebuchte Tage.", status_code=409
            )
        payload = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": AvailabilityStatus.blocked.value,
                "source": AvailabilitySource.manual.value,
            }
            for day in req.range.nights()
        ]
        self._db().table("availability").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Realtime: gesperrte Tage sofort an Channex/OTAs (availability=0).
        self._push_channex_availability(
            req.property_id, req.range.start, req.range.end, 0
        )
        log.info("calendar_block", property_id=req.property_id, days=len(payload))
        return len(payload)

    def set_price_override(self, tenant_id: str, req: PriceOverrideRequest) -> None:
        """Tagespreis im Kalenderblatt setzen/zurücknehmen (Lastenheft §2.2).

        price=None nimmt die Überschreibung zurück (Tag folgt wieder dem Rate-Plan).
        In beiden Fällen wird der jetzt gültige Tagespreis an Channex gepusht: beim
        Setzen der neue Wert, beim Zurücknehmen der wieder greifende Rate-Plan-Preis
        (Gegenzustand, Wurzel 1) — sonst behielten die OTAs den alten Override.
        """
        self._require_tenant_property(tenant_id, req.property_id)
        self._db().table("price_overrides").upsert(
            {
                "property_id": req.property_id,
                "date": req.date.isoformat(),
                "price": req.price,
            },
            on_conflict="property_id,date",
        ).execute()
        # Realtime an Channex: EIN Tag = [date, date+1). Beim Setzen der Override,
        # beim Zurücknehmen der neu aufgelöste effektive Preis (dynamic/weekday/base).
        end = req.date + timedelta(days=1)
        if req.price is not None:
            self._push_channex_rate(
                req.property_id, req.date, end, round(req.price * 100)
            )
        else:
            days = self._resolver().effective_prices(req.property_id, req.date, end)
            eff = days[0].price if days and days[0].price is not None else None
            if eff is not None:
                self._push_channex_rate(
                    req.property_id, req.date, end, round(eff * 100)
                )
        log.info(
            "calendar_price_override",
            property_id=req.property_id,
            date=req.date.isoformat(),
            cleared=req.price is None,
        )

    def _fetch_days(self, property_id: str, rng: DateRange) -> list[dict[str, str]]:
        res = (
            self._db()
            .table("availability")
            .select("date,status,source,closed_to_arrival,closed_to_departure")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .execute()
        )
        return res.data or []

    def _booked_dates(self, property_id: str, rng: DateRange) -> set[str]:
        """Gebuchte Tage (availability.status='booked') im Range als ISO-Strings.
        Eine Quelle der Wahrheit für „welche Tage sind belegt" — jeder Buchungs-
        pfad schreibt synchron booked, jeder Storno setzt zurück auf open, also
        ist die availability-Tabelle die kanonische, für-Range-abfragbare Wahrheit.
        Genutzt vom Stop-Sell-Guard: auf einem gebuchten Tag darf NIE ein
        Stop-Sell liegen (der Tag ist bereits verkauft)."""
        return {
            row["date"]
            for row in self._fetch_days(property_id, rng)
            if row.get("status") == AvailabilityStatus.booked.value
        }

    def _fetch_rate_plan(
        self, property_id: str
    ) -> tuple[float | None, int | None]:
        """Basispreis + Min-Stay aus dem (ersten) Rate-Plan des Objekts.

        Ohne Rate-Plan → (None, None); es wird kein Preis erfunden.
        """
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price,min_stay")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None, None
        row = rows[0]
        base = row.get("base_price")
        min_stay = row.get("min_stay")
        return (
            float(base) if base is not None else None,
            int(min_stay) if min_stay is not None else None,
        )

    # -- Stop-Sell (Verkaufsstopp je Tag) -------------------------------------
    def list_stop_sell(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        self._require_own_property(ctx, property_id)
        res = (
            self._db()
            .table("stop_sell")
            # travel_agencies-Embed: der Kalender zeigt am Stop-Sale-Balken,
            # an WEN sich der Stopp richtet (z. B. TUI) — nicht nur „Gesperrt".
            .select(
                "id,property_id,date,reason,source,agency_id,"
                "travel_agencies(name)"
            )
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .order("date")
            .execute()
        )
        rows = res.data or []
        for row in rows:
            agency = row.pop("travel_agencies", None) or {}
            row["agency_name"] = (
                agency.get("name") if isinstance(agency, dict) else None
            )
        return rows

    # Channex-Wochentags-Codes (Index = date.weekday(): 0=Montag … 6=Sonntag).
    _CHANNEX_DAYS = ("mo", "tu", "we", "th", "fr", "sa", "su")

    def set_stop_sell(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        reason: str | None,
        weekdays: list[int] | None = None,
        agency_id: str | None = None,
    ) -> dict[str, int]:
        """Verkaufsstopp manuell setzen (idempotent pro Tag) und als
        stop_sell-Restriction an Channex pushen. `weekdays` (ISO 0=Mo … 6=So)
        beschränkt optional auf Wochentage im Zeitraum (z. B. nur Wochenenden).
        `agency_id` dokumentiert den Adressaten der Stop-Sale-Meldung
        (Reisebüro/Veranstalter); None = gilt allen Kanälen.

        Gibt ``{stopped_days, skipped_booked}`` zurück: gebuchte Tage werden
        NIE gestoppt (der Tag ist bereits verkauft) und stattdessen gemeldet,
        damit die UI die Überschneidung anzeigen kann."""
        self._require_tenant_property(tenant_id, property_id)
        if agency_id is not None:
            # Tenant-Scope explizit prüfen (Service-Role umgeht RLS) — sonst
            # ließen sich fremde Agenturen referenzieren/als Orakel abfragen.
            owned = (
                self._db()
                .table("travel_agencies")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("id", agency_id)
                .limit(1)
                .execute()
            ).data
            if not owned:
                raise CalendarError("Reisebüro nicht gefunden.", status_code=404)
        days = [d for d in rng.nights() if not weekdays or d.weekday() in weekdays]
        if not days:
            return {"stopped_days": 0, "skipped_booked": 0}
        # Gebuchte Tage NIE stoppen: ein gebuchter Tag ist verkauft, ein
        # Stop-Sell darüber wäre bedeutungslos und würde die Verfügbarkeits-
        # Wahrheit verfälschen. Übersprungene Tage separat melden (UI-Hinweis).
        booked = self._booked_dates(property_id, rng)
        before = len(days)
        days = [d for d in days if d.isoformat() not in booked]
        skipped_booked = before - len(days)
        # Channex-seitige Stops (source=channex) nie überschreiben — der Upsert
        # würde sonst ihre source auf manual kippen und ein späteres Aufheben
        # würde OTA-Stops öffnen. Diese Tage sind ohnehin bereits gestoppt.
        channex_days = {
            row["date"]
            for row in (
                self._db()
                .table("stop_sell")
                .select("date")
                .eq("property_id", property_id)
                .eq("source", "channex")
                .gte("date", rng.start.isoformat())
                .lt("date", rng.end.isoformat())
                .execute()
            ).data
            or []
        }
        days = [d for d in days if d.isoformat() not in channex_days]
        if not days:
            return {"stopped_days": 0, "skipped_booked": skipped_booked}
        payload = [
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "date": day.isoformat(),
                "reason": reason,
                "source": "manual",
                "agency_id": agency_id,
            }
            for day in days
        ]
        self._db().table("stop_sell").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Push NUR die tatsächlich gesetzten Tage (gebuchte/channex-Tage sind
        # raus) — als komprimierte Spannen. Kein roher Range-Push mehr, sonst
        # würde Stop-Sell für gebuchte Tage an die OTAs gemeldet.
        self._push_channex_stop_sell(
            property_id,
            self._date_spans(days),
            stop_sell=True,
        )
        log.info(
            "calendar_stop_sell_set",
            property_id=property_id,
            days=len(payload),
            skipped_booked=skipped_booked,
        )
        return {"stopped_days": len(payload), "skipped_booked": skipped_booked}

    def clear_stop_sell(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        weekdays: list[int] | None = None,
    ) -> None:
        """Manuellen Verkaufsstopp aufheben. Channex-Stops (source=channex) bleiben
        unangetastet — die spiegeln den OTA-Stand und werden per Import gepflegt.
        An Channex wird stop_sell=false NUR für Tage gepusht, die danach wirklich
        keinen Stop mehr haben (sonst würden OTA-seitige Stops geöffnet)."""
        self._require_tenant_property(tenant_id, property_id)
        wanted = [d for d in rng.nights() if not weekdays or d.weekday() in weekdays]
        if not wanted:
            return
        query = (
            self._db()
            .table("stop_sell")
            .delete()
            .eq("property_id", property_id)
            .eq("source", "manual")
        )
        if weekdays:
            query = query.in_("date", [d.isoformat() for d in wanted])
        else:
            query = query.gte("date", rng.start.isoformat()).lt(
                "date", rng.end.isoformat()
            )
        query.execute()
        # Verbleibende Stops (z. B. source=channex) dürfen nicht geöffnet werden.
        remaining = {
            row["date"]
            for row in (
                self._db()
                .table("stop_sell")
                .select("date")
                .eq("property_id", property_id)
                .gte("date", rng.start.isoformat())
                .lt("date", rng.end.isoformat())
                .execute()
            ).data
            or []
        }
        open_days = [d for d in wanted if d.isoformat() not in remaining]
        if not remaining:
            # Nichts bleibt gesperrt → EIN Range-Push (mit nativer Wochentags-Maske).
            self._push_channex_stop_sell(
                property_id,
                [(rng.start, rng.end - timedelta(days=1))],
                stop_sell=False,
                days=[self._CHANNEX_DAYS[w] for w in weekdays] if weekdays else None,
            )
        else:
            self._push_channex_stop_sell(
                property_id, self._date_spans(open_days), stop_sell=False
            )
        log.info("calendar_stop_sell_cleared", property_id=property_id)

    @staticmethod
    def _date_spans(days: list[date]) -> list[tuple[date, date]]:
        """Sortierte Tagesliste zu zusammenhängenden (start, end)-Spannen
        komprimieren (end inklusiv) — Ranges statt Einzeltage pushen
        (Channex-Skill: „batch via ranges")."""
        spans: list[tuple[date, date]] = []
        for d in sorted(days):
            if spans and d == spans[-1][1] + timedelta(days=1):
                spans[-1] = (spans[-1][0], d)
            else:
                spans.append((d, d))
        return spans

    def _tenant_of(self, property_id: str) -> str | None:
        """tenant_id eines Objekts (für die ARI-Push-Jobs). None, wenn das Objekt
        nicht existiert, keine tenant_id trägt oder keine DB verfügbar ist —
        best-effort, damit das Einreihen die Kalenderaktion nie kippt."""
        if self._client is None:
            return None
        rows = (
            self._db()
            .table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        return rows[0].get("tenant_id") if rows else None

    def _push_channex_stop_sell(
        self,
        property_id: str,
        spans: list[tuple[date, date]],
        *,
        stop_sell: bool,
        days: list[str] | None = None,
    ) -> None:
        """Verkaufsstopp als stop_sell-ARI-Push-Job einreihen (Phase 2). Die `spans`
        sind bereits gefiltert (gebuchte/channex-Tage raus) → als ISO-Paare
        serialisiert ins Payload. KEIN coalesce (span-spezifisch)."""
        tenant_id = self._tenant_of(property_id) if spans else None
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "stop_sell",
            {"spans": [[a.isoformat(), b.isoformat()] for a, b in spans],
             "stop_sell": stop_sell, "days": days},
        )

    # -- Saisonpreise (Tagespreise je Zeitraum → price_overrides + Channex) ----
    def list_season_prices(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        self._require_own_property(ctx, property_id)
        # Eigentümer haben kein Preis-Recht (§4.2) — Saisonpreise bestehen NUR aus
        # Preisen, daher für Owner leer (die anderen Kalender-Reads maskieren die
        # Tagespreise über _strip_prices_for_owner; hier gibt es nichts anderes).
        if is_owner(ctx):
            return []
        res = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .not_.is_("price", "null")
            .order("date")
            .execute()
        )
        return res.data or []

    def set_season_price(
        self, tenant_id: str, property_id: str, rng: DateRange, price: float,
        *, push_channex: bool = True,
    ) -> int:
        """Tagespreis für jeden Tag im Zeitraum setzen (price_overrides) und an
        Channex pushen (Restrictions/rate). `push_channex=False`, wenn der Preis
        in einer kombinierten Bulk-Aktion bereits mit Min-Stay/CTA/CTD in EINEM
        Call gepusht wird (Test 8). Gibt Anzahl Tage zurück."""
        self._require_tenant_property(tenant_id, property_id)
        payload = [
            {
                "property_id": property_id,
                "date": day.isoformat(),
                "price": price,
            }
            for day in rng.nights()
        ]
        self._db().table("price_overrides").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Realtime an Channex: Tagespreis (Cent) für den Zeitraum.
        if push_channex:
            self._push_channex_rate(
                property_id, rng.start, rng.end, round(price * 100)
            )
        log.info(
            "calendar_season_price_set", property_id=property_id, days=len(payload)
        )
        return len(payload)

    def adjust_season_price_pct(
        self, tenant_id: str, property_id: str, rng: DateRange, pct: float
    ) -> int:
        """Effektiven Tagespreis je Tag um `pct` Prozent anpassen (z. B. +10/-15)
        und als Override schreiben — derselbe Pfad wie set_season_price, nur mit
        je Tag individuellem Preis. Tage ohne auflösbaren Preis werden übersprungen
        (kein Crash, kein erfundener Basiswert). Gibt Anzahl geänderter Tage zurück.
        """
        self._require_tenant_property(tenant_id, property_id)
        days = self._resolver().effective_prices(property_id, rng.start, rng.end)
        factor = 1 + pct / 100
        payload = [
            {
                "property_id": property_id,
                "date": d.date.isoformat(),
                "price": round(d.price * factor, 2),
            }
            for d in days
            if d.price is not None
        ]
        if not payload:
            return 0
        self._db().table("price_overrides").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Channex je Tag (unterschiedliche Preise) — Best-Effort, wie sonst auch.
        for row in payload:
            day = date.fromisoformat(row["date"])
            self._push_channex_rate(
                property_id, day, day + timedelta(days=1), round(row["price"] * 100)
            )
        log.info(
            "calendar_season_price_pct",
            property_id=property_id, pct=pct, days=len(payload),
        )
        return len(payload)

    def set_restrictions(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        *,
        cta: bool | None = None,
        ctd: bool | None = None,
        min_stay: int | None = None,
        rate_cents: int | None = None,
    ) -> int:
        """CTA/CTD-Restriktionen je Tag setzen (availability-Upsert pro Tag) und
        an Channex pushen. Nur gesetzte Felder ändern sich (None = unverändert).
        `min_stay`/`rate_cents` werden — falls gesetzt — im SELBEN Channex-Call
        mitgepusht (kombinierte Bulk-Aktion, Zertifizierung Test 7/8); die lokale
        Persistenz von Min-Stay/Preis macht der Aufrufer (_set_min_stay /
        set_season_price). availability-Zeilen werden wie bei Preis/Block auch
        für offene Tage angelegt. Gibt Anzahl Tage zurück."""
        self._require_tenant_property(tenant_id, property_id)
        if cta is None and ctd is None:
            return 0
        flags: dict[str, bool] = {}
        if cta is not None:
            flags["closed_to_arrival"] = cta
        if ctd is not None:
            flags["closed_to_departure"] = ctd
        payload = [
            {"property_id": property_id, "date": day.isoformat(), **flags}
            for day in rng.nights()
        ]
        self._db().table("availability").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        self._push_channex_restrictions(
            property_id, rng.start, rng.end, cta, ctd,
            min_stay=min_stay, rate_cents=rate_cents,
        )
        log.info(
            "calendar_set_restrictions",
            property_id=property_id, cta=cta, ctd=ctd, days=len(payload),
        )
        return len(payload)

    def _push_channex_restrictions(
        self,
        property_id: str,
        start: date,
        end: date,
        cta: bool | None,
        ctd: bool | None,
        *,
        min_stay: int | None = None,
        rate_cents: int | None = None,
    ) -> None:
        """CTA/CTD (+ optional Min-Stay/Preis, kombinierte Bulk-Aktion) als EINEN
        ARI-Push-Job einreihen (Phase 2). KEIN coalesce (zeitraum-spezifisch)."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        fields: dict[str, object] = {
            "date_from": start.isoformat(),
            "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv→inkl.
            "closed_to_arrival": cta, "closed_to_departure": ctd,
        }
        if min_stay is not None:
            fields["min_stay"] = min_stay
        if rate_cents is not None:
            fields["rate_cents"] = rate_cents
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "restrictions", fields,
        )

    # -- Bulk-Edit (mehrere Objekte × ein Zeitraum) ---------------------------
    def _set_min_stay(
        self, property_id: str, rng: DateRange, min_stay: int,
        *, push_channex: bool = True,
    ) -> None:
        """Mindestaufenthalt des Objekts setzen (rate_plans, property-weit) und
        als Restriktion für den Zeitraum an Channex pushen. Per-Tag-Min-Stay
        ist v2 — hier gilt der Wert objektweit (so wie der Rate-Plan).
        `push_channex=False`, wenn der Wert in einer kombinierten Bulk-Aktion
        bereits mit CTA/CTD in EINEM Call gepusht wird (Test 7)."""
        self._db().table("rate_plans").update({"min_stay": min_stay}).eq(
            "property_id", property_id
        ).execute()
        if push_channex:
            self._push_channex_rate(
                property_id, rng.start, rng.end, None, min_stay=min_stay
            )

    def bulk_edit(self, tenant_id: str, req: BulkEditRequest) -> BulkEditResult:
        """Preis/Min-Stay/Sperre/Verkaufsstopp über mehrere Objekte × Zeitraum
        in einem Rutsch setzen. Nur gesetzte Felder werden angewendet. Jedes
        Objekt muss DIESEM Tenant gehören (sonst 404 für die ganze Operation).
        """
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", req.property_ids)
            .execute()
        ).data or []
        owned_ids = {p["id"] for p in owned}
        missing = [pid for pid in req.property_ids if pid not in owned_ids]
        if missing:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

        applied: list[str] = []
        for pid in req.property_ids:
            if req.block is True:
                self.block(tenant_id, BlockRequest(property_id=pid, range=req.range))
            elif req.block is False:
                self._unblock(pid, req.range)
            if req.stop_sell is True:
                self.set_stop_sell(tenant_id, pid, req.range, None)
            elif req.stop_sell is False:
                self.clear_stop_sell(tenant_id, pid, req.range)
            # Eine Bulk-Aktion = EIN Channex-Call (Zertifizierung Test 7/8):
            # Preis und Min-Stay wandern mit in den CTA/CTD-Push; ohne CTA/CTD
            # gehen Preis+Min-Stay gemeinsam in einen Rate-Push.
            has_cta_ctd = (
                req.closed_to_arrival is not None
                or req.closed_to_departure is not None
            )
            price_cents = (
                round(req.price * 100) if req.price is not None else None
            )
            combine_into_restrictions = has_cta_ctd and (
                req.min_stay is not None or price_cents is not None
            )
            combine_rate_min_stay = (
                not has_cta_ctd
                and price_cents is not None
                and req.min_stay is not None
            )
            combined = combine_into_restrictions or combine_rate_min_stay
            if req.price is not None:
                self.set_season_price(
                    tenant_id, pid, req.range, req.price,
                    push_channex=not combined,
                )
            elif req.price_adjust_pct is not None:
                self.adjust_season_price_pct(
                    tenant_id, pid, req.range, req.price_adjust_pct
                )
            if req.min_stay is not None:
                self._set_min_stay(
                    pid, req.range, req.min_stay,
                    push_channex=not combined,
                )
            if has_cta_ctd:
                self.set_restrictions(
                    tenant_id, pid, req.range,
                    cta=req.closed_to_arrival, ctd=req.closed_to_departure,
                    min_stay=req.min_stay,
                    rate_cents=price_cents if combine_into_restrictions else None,
                )
            elif combine_rate_min_stay:
                self._push_channex_rate(
                    pid, req.range.start, req.range.end,
                    price_cents, min_stay=req.min_stay,
                )

        if req.block is True:
            applied.append("block")
        elif req.block is False:
            applied.append("unblock")
        if req.stop_sell is True:
            applied.append("stop_sell")
        elif req.stop_sell is False:
            applied.append("clear_stop_sell")
        if req.price is not None:
            applied.append("price")
        elif req.price_adjust_pct is not None:
            applied.append("price_pct")
        if req.min_stay is not None:
            applied.append("min_stay")
        if req.closed_to_arrival is not None:
            applied.append(
                "cta_on" if req.closed_to_arrival else "cta_off"
            )
        if req.closed_to_departure is not None:
            applied.append(
                "ctd_on" if req.closed_to_departure else "ctd_off"
            )

        log.info(
            "calendar_bulk_edit",
            properties=len(req.property_ids),
            applied=applied,
        )
        return BulkEditResult(
            properties=len(req.property_ids),
            days=len(req.range.nights()),
            applied=applied,
        )

    def _unblock(self, property_id: str, rng: DateRange) -> None:
        """Manuelle Sperre im Zeitraum aufheben (nur source=manual; gebuchte Tage
        bleiben unberührt). Gibt an Channex NUR die Tage frei (availability=1), die
        danach WIRKLICH offen sind — NICHT den ganzen Range."""
        self._db().table("availability").delete().eq(
            "property_id", property_id
        ).eq("status", "blocked").eq("source", "manual").gte(
            "date", rng.start.isoformat()
        ).lt("date", rng.end.isoformat()).execute()
        # Tag-genau: Tage, die im Range noch belegt sind (echte Direkt-/Plattform-
        # Reservierung ODER importierte OTA-Buchung, status='booked'), NICHT als
        # availability=1 an Channex melden — sonst würde das Portal einen gebuchten
        # Tag erneut verkaufbar machen (Überbuchung). Nur die tatsächlich offenen
        # Tage freigeben, gruppiert in zusammenhängende Zeiträume.
        still_booked = {
            r["date"]
            for r in (
                self._db()
                .table("availability")
                .select("date")
                .eq("property_id", property_id)
                .eq("status", "booked")
                .gte("date", rng.start.isoformat())
                .lt("date", rng.end.isoformat())
                .execute()
            ).data or []
        }
        for span_start, span_end in _contiguous_open_spans(rng, still_booked):
            self._push_channex_availability(property_id, span_start, span_end, 1)

    def _push_channex_rate(
        self,
        property_id: str,
        start: date,
        end: date,
        rate_cents: int | None,
        *,
        min_stay: int | None = None,
    ) -> None:
        """Tagespreis und/oder Min-Stay als ARI-Push-Job einreihen (Phase 2). KEIN
        coalesce (zeitraum-/wert-spezifisch). tenant_id über die property."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "rate",
            {"date_from": start.isoformat(),
             "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv
             "rate_cents": rate_cents, "min_stay": min_stay},
        )

    def _push_channex_availability(
        self, property_id: str, start: date, end: date, availability: int
    ) -> None:
        """Verfügbarkeit der Tage [start, end) als ARI-Push-Job einreihen (Phase 2).
        Doppelbuchungsschutz ohne Request-Blockade. KEIN coalesce — verschiedene
        Kalenderaktionen betreffen disjunkte Zeiträume. tenant_id über die property."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "availability",
            {"date_from": start.isoformat(),
             "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv
             "availability": availability},
        )
