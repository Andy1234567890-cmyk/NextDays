"""Reservations-Service: Lesepfad (Liste, Statistiken, Detail).

Das Dashboard der Startseite liegt in `dashboard.py` — es zog die Datei über
die 1500-Zeilen-Grenze von pylint.

Mixin auf `ReservationsBase`; `service.py` komponiert es in `ReservationsService`.
Alle Methoden sind tenant-/owner-gescoped (§4.2) und maskierungskonform (§4).
"""
from __future__ import annotations

from datetime import date, timedelta

from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.granular_permissions import Permission, load_permission
from src.features.booking_conditions.plan import (
    erste_zahlung,
    kaution,
    kondition_fuer,
    restzahlung_faellig_am,
    storno_regeln,
)

from ._base import (
    GuestMask,
    ReservationError,
    ReservationsBase,
    _as_date,
    _require_uuid,
    anzeigename,
    load_guest_mask,
)
from .property_stats import (
    COMPARE_PERIODS,
    compute_metric_detail,
    compute_property_stats,
)
from .property_stats import (
    DETAIL_METRICS as _DETAIL_METRICS,
)
from .schemas import (
    PropertyStats,
    QuoteItem,
    ReservationConditions,
    ReservationDeposit,
    ReservationDetail,
    ReservationInvoiceInfo,
    ReservationListResponse,
    ReservationNote,
    ReservationNoteListResponse,
    ReservationRefundRule,
    ReservationTransaction,
    StatMetricDetail,
    TimelineEvent,
    TimelineResponse,
)

# Obergrenzen (Wurzel 8): jeder unbegrenzte Bereich bekommt einen harten Deckel.
# `_LIST_MAX_LIMIT` deckelt die explizit angeforderte Seitengröße;
# `_STATS_MAX_SPAN_DAYS` den Aggregationszeitraum der Kennzahlen — beides sonst
# ein offener Hebel, über den ein einzelner Aufruf den halben Bestand zieht.
_LIST_MAX_LIMIT = 500
_STATS_MAX_SPAN_DAYS = 1830  # 5 Jahre, wie calendar.DateRange.MAX_NIGHTS


def _assert_stats_span(date_from: date, date_to: date) -> None:
    """Zeitfenster der Kennzahlen prüfen: Richtung UND Länge.

    Die Länge war bisher unbegrenzt — ein Aufruf mit `date_from=1900-01-01`
    aggregiert über den gesamten Bestand und lädt ihn dafür komplett (Wurzel 8).
    """
    if date_to < date_from:
        raise ReservationError(
            "date_to muss nach date_from liegen.", status_code=422
        )
    if (date_to - date_from).days > _STATS_MAX_SPAN_DAYS:
        raise ReservationError(
            f"Zeitraum zu groß (max. {_STATS_MAX_SPAN_DAYS} Tage).",
            status_code=422,
        )


def _stats_untergrenze(date_from: date, date_to: date) -> str:
    """Früheste `created_at`-Grenze, ab der Kennzahlen-Zeilen geladen werden.

    Die Aggregation ordnet Zeilen über das BUCHUNGSDATUM (`created_at`) zu, nicht
    über den Aufenthalt (`property_stats._booked_on`). `compute_metric_detail`
    bildet bis zu `COMPARE_PERIODS` gleich lange Vergleichsperioden VOR
    `date_from` — deren Zeilen müssen mitgeladen werden, sonst stünden die
    Vergleichswerte still auf 0 und jede Veränderungsrate wäre falsch.

    Bewusst NUR eine Untergrenze, keine Obergrenze: `days_booked_ahead` misst die
    weiteste ZUKÜNFTIGE Anreise (`check_in >= today`) aus Buchungen, die in der
    Periode entstanden sind. Ein `created_at <= date_to`-Filter wäre dafür
    unschädlich, ein `check_in`-Fenster dagegen würde die Kennzahl still kappen —
    daher bleibt die Zukunft offen und nur der unbegrenzte Altbestand fällt weg.
    """
    spanne = (date_to - date_from).days + 1
    return (date_from - timedelta(days=spanne * (COMPARE_PERIODS + 1))).isoformat()


class ReadsMixin(ReservationsBase):
    """Lese-Endpunkte des reservations-Slice."""

    def list(
        self,
        ctx: AuthContext,
        property_id: str | None = None,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int | None = None,
    ) -> ReservationListResponse:
        """Buchungsliste, tenant-/owner-gescoped und maskiert.

        `date_from`/`date_to` filtern auf `check_in` IN DER DB (nicht erst in
        Python), damit ein enger Zeitraum nicht erst den gesamten Bestand lädt.
        Ohne Zeitraum wird über `fetch_all_rows` paginiert: ein ungedeckelter
        PostgREST-Select liefert STILL nur `PGRST_DB_MAX_ROWS` (1000) Zeilen, und
        das daraus gebildete `total` wäre eine Falschaussage — der Aufrufer sähe
        eine plausible Zahl ohne Hinweis auf den Abschnitt (Wurzel 4/5).
        `limit` deckelt bewusst NACH dem Laden nicht, sondern ersetzt die
        Paginierung durch einen echten `.limit()`; `total` meldet dann die Zahl
        der gelieferten Zeilen und `truncated=True` sagt, dass es mehr gibt.
        """
        tenant_id = self._require_tenant(ctx)
        if date_from and date_to and date_to < date_from:
            raise ReservationError(
                "date_to muss nach date_from liegen.", status_code=422
            )
        if limit is not None and (limit < 1 or limit > _LIST_MAX_LIMIT):
            raise ReservationError(
                f"limit muss zwischen 1 und {_LIST_MAX_LIMIT} liegen.",
                status_code=422,
            )
        # Owner-Scope (§4.2): Eigentümer sehen NUR Buchungen ihrer zugeordneten
        # Objekte. Leere Zuordnung → leere Liste (fail-closed).
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and not owner_pids:
            return ReservationListResponse(items=[], total=0)
        query = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
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
        if date_from:
            query = query.gte("check_in", date_from.isoformat())
        if date_to:
            query = query.lte("check_in", date_to.isoformat())
        # Stabile Sortierung ist Voraussetzung für fetch_all_rows: check_in ist
        # nicht eindeutig, daher id als Tiebreaker — sonst kann eine Zeile über
        # Seitengrenzen doppelt oder gar nicht erscheinen.
        query = query.order("check_in", desc=True).order("id", desc=True)
        truncated = False
        if limit is not None:
            rows = query.limit(limit + 1).execute().data or []
            truncated = len(rows) > limit
            rows = rows[:limit]
        else:
            rows = fetch_all_rows(query)
        mask = load_guest_mask(self._client, ctx.user_id)
        items = [self._row(r, mask) for r in rows]
        return ReservationListResponse(
            items=items, total=len(items), truncated=truncated
        )

    def _load_property_stats_rows(
        self, ctx: AuthContext, property_id: str, date_from: date, date_to: date
    ) -> tuple[str, list[dict], bool]:
        """Gemeinsames Laden für Statistiken + KPI-Detail: Objekt tenant-/owner-
        scoped prüfen, dessen Reservierungen laden, Betrags-Sichtbarkeit lösen.

        Rückgabe: (property_title, rows, show_amounts). Fremdes/fehlendes Objekt
        → 404 (§4.2). Load und Scope bleiben zusammen (Wurzel 3)."""
        tenant_id = self._require_tenant(ctx)
        _require_uuid(property_id)
        _assert_stats_span(date_from, date_to)

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

        rows = fetch_all_rows(
            self._db()
            .table("reservations")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .gte("created_at", _stats_untergrenze(date_from, date_to))
            .order("created_at", desc=True)
            .order("id", desc=True)
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return prop[0].get("title") or "", rows, mask.amounts

    def property_stats(
        self,
        ctx: AuthContext,
        property_id: str,
        date_from: date,
        date_to: date,
    ) -> PropertyStats:
        """Objekt-Kennzahlen für den Statistiken-Reiter (Kontrollzentrum).

        Aggregiert AUSSCHLIESSLICH über die Buchungen DIESES Objekts im Zeitraum
        [date_from, date_to]. Owner-Scope (§4.2): ein Eigentümer erhält nur Zahlen
        seiner eigenen Objekte (fremdes Objekt → 404 wie „nicht gefunden"). Beträge
        sind maskiert (§4.2 „kein Gesamtpreis" → None); die Währung kommt aus den
        Daten (leer bei gemischten Währungen — keine Mischsumme). Jede KPI
        vergleicht die Periode mit der gleich langen Vorperiode.
        """
        title, rows, show_amounts = self._load_property_stats_rows(
            ctx, property_id, date_from, date_to
        )
        # Reine Aggregation (property_stats.py) — hält service.py schlank und
        # trennt Rechenlogik von Scope/DB.
        return compute_property_stats(
            property_id=property_id,
            property_title=title,
            rows=rows,
            date_from=date_from,
            date_to=date_to,
            show_amounts=show_amounts,
        )

    def property_metric_detail(
        self,
        ctx: AuthContext,
        property_id: str,
        metric: str,
        date_from: date,
        date_to: date,
    ) -> tuple[str, StatMetricDetail]:
        """KPI-Detailseite: Tagesreihe + vier Vergleichsperioden +
        Breakout für EINE Metrik eines Objekts. Gleiche Scope-/Masking-Regeln wie
        `property_stats`. Rückgabe: (property_title, detail)."""
        if metric not in _DETAIL_METRICS:
            raise ReservationError("Unbekannte Kennzahl.", status_code=422)
        title, rows, show_amounts = self._load_property_stats_rows(
            ctx, property_id, date_from, date_to
        )
        detail = compute_metric_detail(
            rows=rows,
            metric=metric,
            date_from=date_from,
            date_to=date_to,
            show_amounts=show_amounts,
        )
        return title, detail

    def _load_tenant_stats_rows(
        self,
        ctx: AuthContext,
        date_from: date,
        date_to: date,
        property_ids: list[str] | None,
    ) -> tuple[list[dict], bool, int]:
        """Gemeinsames Laden fürs GLOBALE Kontrollzentrum: alle Objekt-
        Reservierungen des Tenants (owner-gescoped, optional auf `property_ids`
        gefiltert), Betrags-Sichtbarkeit, und die Anzahl einbezogener Objekte
        (für die Belegungsrate). Load + Scope bleiben zusammen (Wurzel 3).

        Rückgabe: (rows, show_amounts, property_count). Leerer Owner-Scope oder
        eine Auswahl außerhalb des Scopes → (leer, …, 0)."""
        tenant_id = self._require_tenant(ctx)
        _assert_stats_span(date_from, date_to)
        # Fehl-IDs in der Auswahl → 404-Klasse „nicht gefunden" (kein 500 an die DB).
        for pid in property_ids or []:
            _require_uuid(pid)

        # Zugelassene Objekte = alle Tenant-Objekte, owner-gescoped, ∩ Auswahl.
        props = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        allowed = {p["id"] for p in props}
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None:
            allowed &= set(owner_pids)
        if property_ids is not None:
            allowed &= set(property_ids)
        if not allowed:
            return [], load_guest_mask(self._client, ctx.user_id).amounts, 0

        rows = fetch_all_rows(
            self._db()
            .table("reservations")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("property_id", sorted(allowed))
            .gte("created_at", _stats_untergrenze(date_from, date_to))
            .order("created_at", desc=True)
            .order("id", desc=True)
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return rows, mask.amounts, len(allowed)

    def tenant_stats(
        self,
        ctx: AuthContext,
        date_from: date,
        date_to: date,
        property_ids: list[str] | None = None,
    ) -> PropertyStats:
        """Globale Kontrollzentrum-Kennzahlen: dieselben KPIs + Kanal-Verteilung +
        Sparklines wie der Objekt-Reiter, aber über ALLE (owner-sichtbaren)
        Objekte des Tenants zusammengefasst. Optionaler `property_ids`-Filter
        („Ausgewählte Unterkünfte"). Belegungsrate durch die Objektanzahl geteilt.
        """
        rows, show_amounts, count = self._load_tenant_stats_rows(
            ctx, date_from, date_to, property_ids
        )
        return compute_property_stats(
            property_id="",
            property_title="",
            rows=rows,
            date_from=date_from,
            date_to=date_to,
            show_amounts=show_amounts,
            property_count=count,
        )

    def tenant_metric_detail(
        self,
        ctx: AuthContext,
        metric: str,
        date_from: date,
        date_to: date,
        property_ids: list[str] | None = None,
    ) -> StatMetricDetail:
        """KPI-Detailseite (Kontrollzentrum „ANSEHEN") tenant-weit: Tagesreihe +
        Vergleichsperioden + Breakout für EINE Metrik über alle (gefilterten)
        Objekte. Gleiche Scope-/Masking-Regeln wie `tenant_stats`."""
        if metric not in _DETAIL_METRICS:
            raise ReservationError("Unbekannte Kennzahl.", status_code=422)
        rows, show_amounts, _count = self._load_tenant_stats_rows(
            ctx, date_from, date_to, property_ids
        )
        return compute_metric_detail(
            rows=rows,
            metric=metric,
            date_from=date_from,
            date_to=date_to,
            show_amounts=show_amounts,
        )

    def detail(self, ctx: AuthContext, reservation_id: str) -> ReservationDetail:
        """Vollständige Reservierungs-Detailansicht (rechter Slider). Tenant-
        scoped; Beträge + Kontaktdaten werden maskierungskonform geliefert."""
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        res = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
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
        prop_row: dict = {}
        prop = (
            self._db()
            .table("properties")
            .select("title, street, postal_code, city, country, lat, lng")
            .eq("id", r["property_id"])
            .limit(1)
            .execute()
        ).data
        if prop:
            prop_row = prop[0]
            title = prop_row.get("title") or ""

        mask = load_guest_mask(self._client, ctx.user_id)
        guest_name = anzeigename(r)
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
            property_street=prop_row.get("street"),
            property_postal_code=prop_row.get("postal_code"),
            property_city=prop_row.get("city"),
            property_country=prop_row.get("country"),
            property_lat=prop_row.get("lat"),
            property_lng=prop_row.get("lng"),
            guest_id=r.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=r["channel"],
            ota_name=mask.source_value(r.get("ota_name")),
            external_ref=r.get("external_ref"),
            external_url=r.get("external_url"),
            # Zahlungsweg des Portals (0240). Die Provision ist ein Geldbetrag
            # und folgt derselben Maskierung wie alle übrigen Beträge — Rollen
            # ohne Finanzeinblick (§4.3) sehen sie nicht.
            payment_collect=r.get("payment_collect"),
            payment_method_ota=r.get("payment_method_ota"),
            ota_commission=(
                float(r["ota_commission"])
                if mask.amounts and r.get("ota_commission") is not None
                else None
            ),
            ota_withheld_taxes=(
                float(r["ota_withheld_taxes"])
                if mask.amounts and r.get("ota_withheld_taxes") is not None
                else None
            ),
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
            is_owner_stay=bool(r.get("is_owner_stay")),
            invoice=invoice_info,
            cancel_reason=r.get("cancel_reason"),
            cancelled_at=r.get("cancelled_at"),
            guest_email=mask.contact_value(r.get("guest_email")),
            guest_phone=mask.contact_value(r.get("guest_phone")),
            guest_language=r.get("guest_language"),
            guest_country=r.get("guest_country"),
            created_at=r.get("created_at"),
            booked_at=r.get("booked_at"),
            archived_at=r.get("archived_at"),
            # Konditionen des Portals (0384) — Geldbeträge stecken in der
            # Storno-Staffel, deshalb folgt sie der Betrags-Maskierung.
            ota_cancel_penalties=(
                r.get("ota_cancel_penalties") if mask.amounts else None
            ),
            ota_notes=r.get("ota_notes"),
            ota_details=r.get("ota_details"),
            message_thread_id=self._message_thread_id(tenant_id, r),
        )

    def _message_thread_id(self, tenant_id: str, r: dict) -> str | None:
        """Thread-Kennung dieser Buchung im Posteingang — oder None.

        Drei Herkünfte, in dieser Reihenfolge:
          1) OTA-Buchung über Channex: der Posteingang führt Threads über
             `channex_booking`, und die Reservierung trägt deren ID
             (`source_channex_booking_id`).
          2) Airbnb aus dem Historie-Import: dort steht im selben Feld NICHT die
             Channex-UUID, sondern der Airbnb-Bestätigungscode (z. B.
             „HMQTDAYHDS"). Der Thread existiert trotzdem — die Nachrichten
             kommen über Channex und hängen an `channex_booking`, dessen
             `ota_reservation_code` genau dieser Code ist. Ohne diesen Zweig
             fehlte der Nachrichten-Knopf bei Airbnb-Buchungen, obwohl der
             Verlauf im Posteingang sichtbar ist und beantwortet wird.
          3) Übernommener Bestand (0382): der Verlauf liegt je Buchung in
             `reservation_nachricht_uebernahme`; der Posteingang adressiert ihn
             als `ue:<reservation_id>`.

        None heisst „zu dieser Buchung gibt es keine Korrespondenz" — die UI
        zeigt dann keinen Nachrichten-Knopf, statt auf eine leere Ansicht zu
        verlinken (Wurzel 4: kein Element ohne Wirkung).
        """
        # Der Posteingang adressiert einen Thread über die ID UNSERER
        # Staging-Zeile (`channex_booking.id`). Die Buchung trägt dagegen die
        # ID, die CHANNEX der Buchung gegeben hat (`channex_booking_id`) —
        # beides sind UUIDs, weshalb ein Verwechseln nicht auffällt: der Link
        # führte auf eine ID, die der Posteingang nicht kennt.
        channex_id = r.get("source_channex_booking_id")
        if channex_id:
            thread = (
                self._db()
                .table("channex_booking")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("channex_booking_id", str(channex_id))
                .limit(1)
                .execute()
            ).data
            if thread:
                return str(thread[0]["id"])
            # Zweiter Versuch über den PORTAL-Code. Beim Airbnb-Historie-Import
            # steht in `source_channex_booking_id` der Bestätigungscode, keine
            # UUID — der Treffer oben bleibt dann leer, obwohl es den Thread
            # gibt. Auch `external_ref` wird geprüft, weil dort derselbe Code
            # steht und die beiden Felder je Importweg unterschiedlich gefüllt
            # sind; genau EINE Auskunft zählt, deshalb dieselbe Abfrage.
            codes = {
                str(channex_id),
                *([str(r["external_ref"])] if r.get("external_ref") else []),
            }
            thread = (
                self._db()
                .table("channex_booking")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("ota_reservation_code", sorted(codes))
                .limit(1)
                .execute()
            ).data
            if thread:
                return str(thread[0]["id"])
        vorhanden = (
            self._db()
            .table("reservation_nachricht_uebernahme")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", r["id"])
            .limit(1)
            .execute()
        ).data
        return f"ue:{r['id']}" if vorhanden else None

    def conditions(
        self, ctx: AuthContext, reservation_id: str
    ) -> ReservationConditions:
        """Buchungskonditionen + Zahlungsstand einer Buchung.

        Der Zahlungsplan wird NICHT hier gerechnet, sondern über den geteilten
        Helfer `booking_conditions.plan` — dieselbe Rechnung, die der Gast beim
        Checkout gesehen hat und die der Einzug vollzieht. Eine zweite Rechnung
        an dieser Stelle wäre genau die Abweichung, die dem Gast „30 % jetzt"
        zeigt und den vollen Betrag zieht.

        Ohne gepflegte Kondition bleiben die Plan-Felder None (es gilt „alles
        sofort fällig"), die Transaktionen kommen trotzdem — sie sind Tatsachen
        und hängen an keiner Kondition. Beträge folgen der Betrags-Maskierung:
        ohne Finanzeinblick (§4.3) liefert der Endpunkt gar keine Zahlen.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        # Scope wie im Detail-Pfad: Tenant UND (falls Eigentümer) Objektbindung.
        # Ein eigener {id}-Endpunkt muss denselben Scope prüfen wie die Liste
        # (Wurzel 9), sonst liest ein Eigentümer fremde Zahlungen.
        r = self._load_owned(tenant_id, reservation_id)
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and r.get("property_id") not in owner_pids:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)

        mask = load_guest_mask(self._client, ctx.user_id)
        if not mask.amounts:
            return ReservationConditions()

        total = float(r.get("total_amount") or 0)
        currency = r.get("currency") or ""
        db = self._db()

        condition = kondition_fuer(
            db, tenant_id=tenant_id, rate_plan_id=r.get("rate_plan_id")
        )
        antwort = ReservationConditions(currency=currency)
        if condition is not None:
            jetzt = erste_zahlung(condition, total)
            rest = round(total - jetzt, 2)
            faellig = (
                restzahlung_faellig_am(condition, _as_date(r["check_in"]))
                if rest > 0
                else None
            )
            kaution_daten = kaution(condition, total)
            antwort = ReservationConditions(
                condition_name=condition.get("internal_name"),
                installments=int(condition.get("installments") or 1),
                due_now=jetzt,
                due_later=max(rest, 0.0),
                balance_due_date=faellig,
                cancellation_mode=condition.get("cancellation_mode"),
                refund_rules=[
                    ReservationRefundRule(**regel)
                    for regel in storno_regeln(db, str(condition["id"]))
                ],
                deposit=(
                    ReservationDeposit(
                        **kaution_daten,
                        preauth_days_before_arrival=condition.get(
                            "preauth_days_before_arrival"
                        ),
                        release_days_after_departure=condition.get(
                            "release_days_after_departure"
                        ),
                    )
                    if kaution_daten
                    else None
                ),
                currency=currency,
            )

        # `payments` trägt selbst keine tenant_id (0008: Scope über die
        # Reservierung). Die ID oben ist bereits tenant-geprüft geladen, damit
        # ist der Filter auf reservation_id der vollständige Scope — ein
        # `eq("tenant_id", …)` hier wäre ein Fehler auf eine Spalte, die es
        # nicht gibt.
        zahlungen = (
            db.table("payments")
            .select("id, amount, currency, type, status, due_at, created_at")
            .eq("reservation_id", reservation_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []
        antwort.transactions = [
            ReservationTransaction(
                id=str(p["id"]),
                at=str(p.get("created_at") or ""),
                amount=mask.amount(float(p.get("amount") or 0)),
                currency=p.get("currency") or currency,
                status=str(p.get("status") or ""),
                type=str(p.get("type") or ""),
                due_at=p.get("due_at"),
            )
            for p in zahlungen
        ]
        return antwort

    def timeline(self, ctx: AuthContext, reservation_id: str) -> TimelineResponse:
        """Chronologische Ereignis-Zeitleiste einer Buchung (Zeitleiste).

        Tenant-/owner-scoped (Wurzel 3): die Reservierung wird zuerst als eigenes
        Objekt geladen — fremde → 404. Kombiniert:
          * echte reservation_events (0122) — ab Einführung protokolliert,
          * synthetische Basis-Events aus vorhandenen Zeitstempeln
            (created_at/checked_in_at/checked_out_at/cancelled_at) UND den
            Aufgaben (tasks.created_at), damit ALT-Buchungen ohne Log sofort eine
            Zeitleiste haben (kein DB-Backfill).
        Ein echtes Event verdrängt das synthetische derselben Art (die echte Zeile
        ist genauer). Rückgabe: neueste zuerst. Beträge im detail nur mit Freigabe.
        """
        tenant_id = self._require_tenant(ctx)
        r = self._load_owned(tenant_id, reservation_id)
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and r.get("property_id") not in owner_pids:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        mask = load_guest_mask(self._client, ctx.user_id)

        # Objekt-Kontext (Titel + Cover-Foto) — je Karte das Objekt-Thumbnail.
        # Einmal geladen für die ganze Zeitleiste.
        prop_title, prop_photo = self._property_context(str(r.get("property_id") or ""))

        # 1) Echte protokollierte Ereignisse.
        real_rows = (
            self._db()
            .table("reservation_events")
            .select("id, kind, by_user_id, detail, created_at")
            .eq("reservation_id", reservation_id)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []
        events: list[TimelineEvent] = []
        real_kinds: set[str] = set()
        for ev in real_rows:
            kind = str(ev.get("kind") or "")
            real_kinds.add(kind)
            events.append(
                TimelineEvent(
                    id=str(ev["id"]),
                    kind=kind,
                    at=str(ev.get("created_at")),
                    by_user_id=ev.get("by_user_id"),
                    detail=self._mask_event_detail(
                        ev.get("detail") or {}, mask, kind
                    ),
                    synthetic=False,
                )
            )

        # 2) Synthetische Basis-Events aus vorhandenen Zeitstempeln — nur, wenn für
        #    dieselbe Art noch KEIN echtes Event existiert (echt gewinnt).
        def add_synth(kind: str, at: object, detail: dict | None = None) -> None:
            if not at or kind in real_kinds:
                return
            events.append(
                TimelineEvent(
                    id=f"synth:{kind}:{reservation_id}",
                    kind=kind,
                    at=str(at),
                    detail=self._mask_event_detail(detail or {}, mask),
                    synthetic=True,
                )
            )

        # Das „Buchung erstellt"-Event trägt die Eckdaten (Ankunft/Abreise/Gäste/
        # Preis) — Betrag maskierungskonform.
        add_synth("created", r.get("created_at"), {
            "channel": r.get("channel"),
            "ota_name": r.get("ota_name"),
            "check_in": r.get("check_in"),
            "check_out": r.get("check_out"),
            "num_guests": int(r.get("num_guests") or 1),
            "total_amount": (
                mask.amount(float(r.get("total_amount") or 0))
                if mask.amounts else None
            ),
            "currency": (r.get("currency") or "") if mask.amounts else "",
        })
        add_synth("checked_in", r.get("checked_in_at"))
        add_synth(
            "checked_out",
            r.get("checked_out_at"),
            {"invoice_number": None},
        )
        if r.get("status") == "cancelled":
            add_synth(
                "cancelled",
                r.get("cancelled_at"),
                {"reason": r.get("cancel_reason"), "channel": r.get("channel")},
            )

        # 3) Der KOMPLETTE Buchungs-Flow aus allen an der Buchung hängenden
        #    Tabellen (Aufgaben, Nachrichten, Zahlungen, Zusatzleistungen). Jede
        #    Quelle liefert ein synthetisches Event aus ihrem created_at — so zeigt
        #    die Zeitleiste den ganzen Vorgang, nicht nur den Lifecycle.
        events.extend(
            self._flow_events(
                reservation_id,
                mask,
                str(r.get("source_channex_booking_id") or ""),
                r.get("channel"),
            )
        )

        # Neueste zuerst.
        events.sort(key=lambda e: e.at, reverse=True)
        return TimelineResponse(
            property_id=str(r.get("property_id") or ""),
            property_title=prop_title,
            property_photo=prop_photo,
            items=events,
        )

    def _portal_nachrichten(
        self, channex_booking_id: str, mask: GuestMask, kanal: str | None
    ) -> list[TimelineEvent]:
        """Der Gast-Host-Verlauf aus dem Portal-Chat (Booking/Airbnb).

        Eigene Methode, weil die Verknüpfung eine ANDERE ist als bei allen
        übrigen Flow-Quellen: `portal_messages` hängt über `booking_ref` an der
        CHANNEX-Buchung, nicht über `reservation_id` an der Reservierung. Wer
        das übersieht, filtert ins Leere und hält den Verlauf für leer — genau
        das war der Fehler.

        ZEITPUNKT (Wurzel 5b): eingeordnet wird über `sent_at` — wann die
        Nachricht im PORTAL stand. `created_at` ist unser Feed-Eingang und liegt
        bei nachgeholten Verläufen Monate daneben (live: drei Nachrichten vom
        08.06.2026 kamen am 15.08. herein, alle mit derselben `created_at`).
        Danach zu sortieren hieße, den Verlauf in falscher Reihenfolge zu
        zeigen. Fehlt `sent_at`, fällt die Zeile auf `created_at` zurück und ist
        damit wenigstens einsortiert.
        """
        if not channex_booking_id:
            return []
        zeilen = (
            self._db()
            .table("portal_messages")
            .select("id, sender, body, sent_at, created_at")
            .eq("booking_ref", channex_booking_id)
            .order("sent_at", desc=False)
            .execute()
        ).data or []
        out: list[TimelineEvent] = []
        for m in zeilen:
            zeitpunkt = m.get("sent_at") or m.get("created_at")
            if not zeitpunkt:
                continue
            body = mask.contact_value(m.get("body"))
            out.append(TimelineEvent(
                id=f"pmsg:{m['id']}",
                kind="message",
                at=str(zeitpunkt),
                detail={
                    "sender": m.get("sender"),
                    # Der Kanal kommt aus der BUCHUNG (`reservations.channel`),
                    # nicht aus einer Annahme über diese Tabelle. Hier stand
                    # hart `"portal"` — das Frontend übersetzt das zu
                    # „myBestDays", also unserem eigenen Marktplatz, und eine
                    # Booking.com-Nachricht wurde als myBestDays ausgewiesen
                    # (live 16.08.2026, Buchung 6766972124). Ein erfundener Wert
                    # ist auch dann falsch, wenn er plausibel aussieht
                    # (Wurzel 4); fehlt der Kanal, bleibt das Feld leer.
                    "channel": kanal,
                    "preview": (body[:120] if isinstance(body, str) else None),
                },
                synthetic=True,
            ))
        return out

    def _flow_events(
        self,
        reservation_id: str,
        mask: GuestMask,
        channex_booking_id: str = "",
        kanal: str | None = None,
    ) -> list[TimelineEvent]:
        """Synthetische Events aus allen an der Buchung hängenden Tabellen —
        der komplette Flow (Aufgaben/Nachrichten/Zahlungen/Add-ons). Jede Zeile
        wird über ihr created_at eingeordnet; Beträge/Kontakt maskierungskonform
        (Grund: Personal/Cleaner ohne Finanz-/Kontakt-Einblick, §4.3, Wurzel 3).

        Scope (Wurzel 3): der Aufrufer hat die Reservierung bereits tenant-/owner-
        scoped geladen; diese Tabellen (tasks/payments/reservation_addons) haben
        KEINE eigene tenant_id-Spalte, sondern hängen per FK an genau dieser
        Reservierung — deshalb reicht der reservation_id-Filter (kein tenant_id).

        `channex_booking_id` ist die Klammer zu den Portal-Nachrichten: sie
        hängen NICHT an der Reservierung, sondern per `booking_ref` an der
        Channex-Buchung (siehe `_portal_nachrichten`)."""
        out: list[TimelineEvent] = []

        def rows(table: str, cols: str) -> list[dict]:
            return (
                self._db()
                .table(table)
                .select(cols)
                .eq("reservation_id", reservation_id)
                .order("created_at", desc=False)
                .execute()
            ).data or []

        # Aufgaben → „Aufgabe erstellt" (mit Zuständigem + Fälligkeit).
        task_rows = rows("tasks", "id, title, status, assignee_id, due_at, created_at")
        assignee_names = self._user_names(
            [t["assignee_id"] for t in task_rows if t.get("assignee_id")]
        )
        for t in task_rows:
            if not t.get("created_at"):
                continue
            out.append(TimelineEvent(
                id=f"task:{t['id']}", kind="task_created", at=str(t["created_at"]),
                detail={
                    "title": t.get("title") or "",
                    "status": t.get("status"),
                    "assignee": assignee_names.get(t.get("assignee_id")),
                    "due_at": t.get("due_at"),
                },
                synthetic=True,
            ))

        # Nachrichten → „Nachricht" (Gast↔Host). Der Nachrichtentext ist Kontakt-
        # inhalt → nur mit Kontakt-Freigabe zeigen, sonst nur „Nachricht" + Kanal.
        #
        # ZWEI QUELLEN, und die zweite trägt live ALLES: `messages` ist die
        # Tabelle für eigene Direktnachrichten und steht systemweit auf 0 Zeilen,
        # während `portal_messages` 495 Zeilen hat — jeden Gast-Host-Verlauf aus
        # Booking/Airbnb. Die Zeitleiste las nur `messages` und zeigte deshalb
        # bei einer Portalbuchung ausschließlich „Buchung erstellt", obwohl der
        # Chat fünf Nachrichten hatte (live: Pia Koller, 16.08.2026). Der
        # Verlauf ist der Zweck dieser Ansicht — er darf nicht an der
        # Tabellenwahl scheitern.
        out.extend(self._portal_nachrichten(channex_booking_id, mask, kanal))
        for m in rows("messages", "id, sender, body, channel, created_at"):
            if not m.get("created_at"):
                continue
            body = mask.contact_value(m.get("body"))
            out.append(TimelineEvent(
                id=f"msg:{m['id']}", kind="message", at=str(m["created_at"]),
                detail={
                    "sender": m.get("sender"),
                    "channel": m.get("channel"),
                    "preview": (body[:120] if isinstance(body, str) else None),
                },
                synthetic=True,
            ))

        # Zahlungen → „Zahlung". Betrag/Währung nur mit Betrags-Freigabe.
        for p in rows("payments", "id, amount, currency, type, status, created_at"):
            if not p.get("created_at"):
                continue
            out.append(TimelineEvent(
                id=f"pay:{p['id']}", kind="payment", at=str(p["created_at"]),
                detail={
                    "amount": mask.amount(float(p.get("amount") or 0))
                    if mask.amounts else None,
                    "currency": (p.get("currency") or "") if mask.amounts else "",
                    "type": p.get("type"),
                    "status": p.get("status"),
                },
                synthetic=True,
            ))

        # Zusatzleistungen → „Zusatzleistung gebucht". Preis nur mit Freigabe.
        for a in rows("reservation_addons", "id, name, price, status, created_at"):
            if not a.get("created_at"):
                continue
            out.append(TimelineEvent(
                id=f"addon:{a['id']}", kind="addon", at=str(a["created_at"]),
                detail={
                    "name": a.get("name"),
                    "price": mask.amount(float(a.get("price") or 0))
                    if mask.amounts else None,
                    "status": a.get("status"),
                },
                synthetic=True,
            ))

        return out

    def _property_context(self, property_id: str) -> tuple[str, str | None]:
        """Objekt-Titel + Cover-Foto-URL für die Zeitleiste (je Karte gezeigt).
        Foto = Cover (is_cover), sonst das erste nach sort_order; keins → None
        (kein erfundenes Bild). property_photos.url ist bereits eine fertige URL."""
        if not property_id:
            return "", None
        prop = (
            self._db()
            .table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        title = (prop[0].get("title") or "") if prop else ""
        photos = (
            self._db()
            .table("property_photos")
            .select("url, is_cover, sort_order")
            .eq("property_id", property_id)
            .order("is_cover", desc=True)
            .order("sort_order", desc=False)
            .limit(1)
            .execute()
        ).data
        photo = photos[0].get("url") if photos else None
        return title, photo

    def _scoped_reservation(self, ctx: AuthContext, reservation_id: str) -> dict:
        """Reservierung tenant- UND owner-gescoped laden (Wurzel 9).

        `_load_owned` prüft nur den Tenant. Für Sub-Ressourcen (Notizen) muss
        derselbe Scope gelten wie für den List-/Detail-Pfad, sonst liest ein
        Eigentümer über die Notiz-Route Buchungen fremder Objekte.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._load_owned(tenant_id, reservation_id)
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and row.get("property_id") not in owner_pids:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        return row

    def list_notes(
        self, ctx: AuthContext, reservation_id: str
    ) -> ReservationNoteListResponse:
        """Notiz-Verlauf einer Buchung, neueste zuerst (0384).

        Verlangt PM_VIEW_NOTES: eine interne Notiz ist Freitext des Betriebs
        über einen Gast (Beschwerden, Zahlungsmoral) und gehört nicht zu den
        Daten, die jede Rolle mit Kalenderzugriff sehen darf. Fehlt das Recht,
        ist die Liste leer statt 403 — die Buchung selbst bleibt ja sichtbar,
        nur dieser Abschnitt nicht.
        """
        self._scoped_reservation(ctx, reservation_id)
        if not load_permission(self._client, ctx.user_id, Permission.PM_VIEW_NOTES):
            return ReservationNoteListResponse(items=[], total=0)
        rows = (
            self._db()
            .table("reservation_notes")
            .select("*")
            .eq("tenant_id", ctx.tenant_id)
            .eq("reservation_id", reservation_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        namen = self._user_names(
            [r["author_id"] for r in rows if r.get("author_id")]
        )
        items = [
            ReservationNote(
                id=str(r["id"]),
                reservation_id=reservation_id,
                author_id=r.get("author_id"),
                author_name=namen.get(r.get("author_id")) or None,
                category=r.get("category"),
                body=r.get("body") or "",
                # Leer statt geraten, wenn die Spalte fehlt (Wurzel 5b).
                created_at=str(r.get("created_at") or ""),
            )
            for r in rows
        ]
        return ReservationNoteListResponse(items=items, total=len(items))

    def _user_names(self, user_ids: list[str]) -> dict[str, str]:
        """full_name je Nutzer-ID (für „Zuständig" an Aufgaben-Events). Leere
        Eingabe → leeres Dict; unbekannte IDs fehlen einfach."""
        ids = [u for u in dict.fromkeys(user_ids) if u]
        if not ids:
            return {}
        rows = (
            self._db()
            .table("users")
            .select("id, full_name")
            .in_("id", ids)
            .execute()
        ).data or []
        return {row["id"]: (row.get("full_name") or "") for row in rows}

    # Ereignisarten, deren `reason` ein Freitext ÜBER EINEN GELDBETRAG ist
    # (Zusatzleistungen, 0397): „Kulanz 600 DKK erlassen", „Gast zahlt nur die
    # Hälfte". Ihn ungefiltert zu zeigen würde den `total`-Filter unten wieder
    # aufheben. Beim Buchungs-Storno (`cancelled`) bleibt der Grund sichtbar —
    # dort ist er betriebliche Information, kein Betrag.
    _MONEY_REASON_KINDS = frozenset(
        {"addon_marked_paid", "addon_unmarked_paid", "addon_cancelled"}
    )

    @classmethod
    def _mask_event_detail(
        cls, detail: dict, mask: GuestMask, kind: str = ""
    ) -> dict:
        """Betragsführende Detailfelder eines Events hinter der Betrags-Maske
        halten (Wurzel 4 — keine Beträge ohne Freigabe). Nicht-Geld-Felder
        (Objekt-IDs, Kanal, Titel) bleiben unverändert; der `reason` nur bei
        den Ereignisarten, in denen er keinen Betrag beschreibt."""
        if mask.amounts:
            return detail
        redacted = dict(detail)
        if kind in cls._MONEY_REASON_KINDS and "reason" in redacted:
            redacted["reason"] = None
        # `total` tragen die Zusatzleistungs-Ereignisse (addons, 0397); ohne den
        # Schlüssel hier hätte Personal ohne Finanzeinblick den Betrag einer
        # stornierten Position in der Zeitleiste gelesen (§4.3).
        for money_key in ("total_amount", "total"):
            if money_key in redacted:
                redacted[money_key] = None
        return redacted
