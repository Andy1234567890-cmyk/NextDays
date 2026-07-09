"""Reservations-Service: Lesepfad (Liste, Dashboard, Statistiken, Detail).

Mixin auf `ReservationsBase`; `service.py` komponiert es in `ReservationsService`.
Alle Methoden sind tenant-/owner-gescoped (§4.2) und maskierungskonform (§4).
"""
from __future__ import annotations

from datetime import date, timedelta

from src.core.security import AuthContext

from ._base import (
    ReservationError,
    ReservationsBase,
    _as_date,
    _require_uuid,
    load_guest_mask,
)
from .property_stats import (
    DETAIL_METRICS as _DETAIL_METRICS,
)
from .property_stats import (
    compute_metric_detail,
    compute_property_stats,
)
from .schemas import (
    DashboardEntry,
    DashboardKpi,
    DashboardResponse,
    PropertyStats,
    QuoteItem,
    ReservationDetail,
    ReservationInvoiceInfo,
    ReservationListResponse,
    StatMetricDetail,
)


class ReadsMixin(ReservationsBase):
    """Lese-Endpunkte des reservations-Slice."""

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

    def _load_property_stats_rows(
        self, ctx: AuthContext, property_id: str, date_from: date, date_to: date
    ) -> tuple[str, list[dict], bool]:
        """Gemeinsames Laden für Statistiken + KPI-Detail: Objekt tenant-/owner-
        scoped prüfen, dessen Reservierungen laden, Betrags-Sichtbarkeit lösen.

        Rückgabe: (property_title, rows, show_amounts). Fremdes/fehlendes Objekt
        → 404 (§4.2). Load und Scope bleiben zusammen (Wurzel 3)."""
        tenant_id = self._require_tenant(ctx)
        _require_uuid(property_id)
        if date_to < date_from:
            raise ReservationError(
                "date_to muss nach date_from liegen.", status_code=422
            )

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
        return prop[0].get("title") or "", rows, mask.amounts

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
        """KPI-Detailseite (Lodgify): Tagesreihe + vier Vergleichsperioden +
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
        if date_to < date_from:
            raise ReservationError(
                "date_to muss nach date_from liegen.", status_code=422
            )
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

        rows = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("property_id", sorted(allowed))
            .execute()
        ).data or []
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
