"""guest_bookings-Service — „Meine Buchungen" des Kunden-Dashboards (/plattform).

Ein eingeloggter Portal-Gast (CurrentGuest) sieht AUSSCHLIESSLICH die
Reservierungen, deren `reservations.guest_email` (case-insensitiv) seiner
Konto-E-Mail entspricht (E-Mail-Match, Index `reservations_guest_email_lower_idx`,
Migration 0181). Es gibt bewusst KEINE portal_guest_id-Spalte an reservations.

Sicherheit:
- Wurzel 3/9: JEDER Zugriff (Liste UND {id}) ist über den E-Mail-Match gescopet —
  eine fremde Buchung liefert 404 (kein Existenz-Leak), nicht nur den Tenant.
- Wurzel 4: Währung/Beträge kommen aus reservation/property (currency-Spalte);
  fehlt ein Betrag, bleibt er null (nie 0 erfunden), Währung ohne Fallback.
- Wurzel 8: die Liste ist hart gedeckelt (_MAX_ROWS) → 422 statt unbegrenzter Menge.
- Gast-Masking: die Zeitleiste liefert KEINE internen Auslöser-Namen (by_user_id)
  und keine tenant-internen Detailfelder.

Storno (Wurzel 1 + 2): der Service prüft NUR die Gast-Berechtigung (E-Mail-Match)
und delegiert dann an `ReservationsService.cancel` — dort liegt die EINE
Nächte-Freigabe (`_release_nights`) samt Channex-Sync + Refund. Wir kopieren die
Freigabe NICHT inline. `cancel(..., by_user_id=None)` vermerkt keinen internen
Auslöser (ein Gast ist keine users-Zeile).
"""
from __future__ import annotations

from datetime import date

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import escape_like
from src.features.reservations.schemas import CancelParty, CancelReasonCode
from src.features.reservations.service import (
    ReservationError,
    ReservationsService,
)

from .schemas import (
    BookingProperty,
    GuestBookingDetail,
    GuestBookingListResponse,
    GuestBookingSummary,
    GuestCancelResponse,
    GuestTimelineEvent,
    GuestTimelineResponse,
    SliceHealth,
)

log = get_logger("nextdays.guest_bookings")

# Wurzel 8: harte Obergrenze auf die zurückgelieferte Buchungsmenge. Ein Gast mit
# außergewöhnlich vielen Buchungen bekommt 422 statt einer unbegrenzten Antwort.
_MAX_ROWS = 200


# Status, in denen ein Gast selbst noch stornieren darf (frei stornierbar). „nicht
# eingecheckt" wird zusätzlich zur Laufzeit geprüft.
_CANCELLABLE_STATUSES = frozenset({"pending", "confirmed"})

# Spalten, die der Server für die Gast-Sicht braucht. tenant_id ist dabei — es
# wird NIE an den Gast serialisiert (kein Schema-Feld), dient nur dem serverseitig
# abgeleiteten Storno-Kontext (Wurzel 1). Bewusst OHNE tenant-interne Anzeige-
# Felder (Provision, interne Betriebsnotizen sind separat).
_RES_COLUMNS = (
    "id, tenant_id, property_id, guest_email, channel, check_in, check_out, "
    "status, "
    "payment_status, total_amount, paid_amount, currency, num_guests, adults, "
    "children, checkin_time, checkout_time, note, quote_items, checked_in_at, "
    "checked_out_at, cancelled_at, "
    "properties(id, title, address, photos, currency)"
)


class GuestBookingsError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GuestBookingsService:
    """Lese-/Storno-Endpunkte der Gast-Buchungssicht."""

    slice_name = "guest_bookings"

    def __init__(self, service_client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise GuestBookingsError(
                "Buchungs-DB nicht verfügbar.", status_code=500
            )
        return self._client

    # -- Laden (E-Mail-gescopet) ----------------------------------------------
    def _load_own(self, reservation_id: str, email: str) -> dict:
        """EINE Buchung laden UND den E-Mail-Match erzwingen (Wurzel 3/9).

        Fremde/fehlende Buchung → 404 (identische Meldung, kein Existenz-Leak).
        Der Vergleich läuft gegen den bereits klein geschriebenen ctx.email; die
        gespeicherte guest_email wird defensiv ebenfalls klein geschrieben.
        """
        try:
            rows = (
                self._db()
                .table("reservations")
                .select(_RES_COLUMNS)
                .eq("id", reservation_id)
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:
            # Nicht-UUID-ID etc.: fachlich „nicht gefunden" statt 500 (Wurzel 5).
            raise GuestBookingsError(
                "Buchung nicht gefunden.", status_code=404
            ) from exc
        if not rows:
            raise GuestBookingsError("Buchung nicht gefunden.", status_code=404)
        row = rows[0]
        if (row.get("guest_email") or "").strip().lower() != email:
            raise GuestBookingsError("Buchung nicht gefunden.", status_code=404)
        return row

    # -- Mapping ---------------------------------------------------------------
    @staticmethod
    def _amount(value: object) -> float | None:
        """Betrag als float ODER null — fehlt/leer bleibt null (nie 0 erfinden)."""
        if value is None:
            return None
        return float(value)

    @staticmethod
    def _property(row: dict) -> BookingProperty:
        prop = row.get("properties") or {}
        photos = prop.get("photos") or []
        return BookingProperty(
            id=prop.get("id") or row["property_id"],
            title=prop.get("title") or "",
            photo=photos[0] if photos else None,
            address=prop.get("address"),
            # Objektwährung ohne Fallback — fehlt sie, ist das ein Datenfehler,
            # der als leerer String sichtbar bleibt (Frontend rendert symbollos).
            currency=prop.get("currency") or "",
        )

    def _summary(self, row: dict) -> GuestBookingSummary:
        return GuestBookingSummary(
            id=row["id"],
            property=self._property(row),
            check_in=row["check_in"],
            check_out=row["check_out"],
            num_guests=int(row.get("num_guests") or 1),
            status=row["status"],
            payment_status=row.get("payment_status"),
            channel=row["channel"],
            total_amount=self._amount(row.get("total_amount")),
            paid_amount=self._amount(row.get("paid_amount")),
            currency=row.get("currency") or "",
        )

    def _detail(self, row: dict, *, today: date) -> GuestBookingDetail:
        total = self._amount(row.get("total_amount"))
        paid = self._amount(row.get("paid_amount"))
        balance = None
        if total is not None and paid is not None:
            diff = round(total - paid, 2)
            balance = diff if diff > 0 else None
        items = row.get("quote_items")
        return GuestBookingDetail(
            id=row["id"],
            property=self._property(row),
            check_in=row["check_in"],
            check_out=row["check_out"],
            num_guests=int(row.get("num_guests") or 1),
            adults=int(row.get("adults") or 1),
            children=int(row.get("children") or 0),
            status=row["status"],
            payment_status=row.get("payment_status"),
            channel=row["channel"],
            total_amount=total,
            paid_amount=paid,
            balance_due=balance,
            currency=row.get("currency") or "",
            checkin_time=row.get("checkin_time"),
            checkout_time=row.get("checkout_time"),
            note=row.get("note"),
            quote_items=items if isinstance(items, list) else [],
            checked_in_at=row.get("checked_in_at"),
            checked_out_at=row.get("checked_out_at"),
            cancelled_at=row.get("cancelled_at"),
            can_cancel=self._can_cancel(row, today=today),
        )

    @staticmethod
    def _can_cancel(row: dict, *, today: date) -> bool:
        """Ob der Gast selbst noch stornieren darf: frei stornierbarer Status,
        weder ein-/ausgecheckt, Anreise noch nicht überschritten."""
        if row.get("status") not in _CANCELLABLE_STATUSES:
            return False
        if row.get("checked_in_at") or row.get("checked_out_at"):
            return False
        try:
            check_in = date.fromisoformat(str(row["check_in"])[:10])
        except (ValueError, KeyError, TypeError):
            return False
        return check_in >= today

    # -- Liste -----------------------------------------------------------------
    def list_bookings(
        self, email: str, status_filter: str | None, *, today: date
    ) -> GuestBookingListResponse:
        """Alle Buchungen des Gasts (E-Mail-Match), optional nach Zeit-/Status-
        Kategorie gefiltert. Ergebnismenge hart gedeckelt (Wurzel 8)."""
        query = (
            self._db()
            .table("reservations")
            .select(_RES_COLUMNS)
            # Case-insensitiv (Wurzel 3): guest_email wird beim Schreiben NICHT
            # normalisiert (OTA-Importe speichern die Adresse roh), `email` ist
            # bereits lower-case. ilike = case-insensitiver Vergleich und nutzt den
            # lower(guest_email)-Index aus 0181. LIKE-Metazeichen (%, _) in der
            # Adresse werden escaped, damit ein `a_b@x.de` kein Wildcard-Match wird
            # (sonst fremde Buchungen — under-/over-permissive). Sonst fehlten
            # gemischt geschriebene (v. a. OTA-)Buchungen in der Liste.
            .ilike("guest_email", escape_like(email))
            .order("check_in", desc=True)
            # +1 über dem Limit: erkennt „zu viele" ohne Vollzählung.
            .limit(_MAX_ROWS + 1)
        )
        rows = (query.execute()).data or []
        if len(rows) > _MAX_ROWS:
            raise GuestBookingsError(
                "Zu viele Buchungen für eine Abfrage — bitte einen Filter setzen.",
                status_code=422,
            )
        items = [
            self._summary(r)
            for r in rows
            if self._matches_filter(r, status_filter, today=today)
        ]
        return GuestBookingListResponse(items=items, total=len(items))

    @staticmethod
    def _matches_filter(
        row: dict, status_filter: str | None, *, today: date
    ) -> bool:
        """upcoming = check_out>=heute & status pending/confirmed;
        past = check_out<heute ODER status completed;
        cancelled = status cancelled. Ohne Filter: alles."""
        if not status_filter:
            return True
        status = row.get("status")
        try:
            check_out = date.fromisoformat(str(row["check_out"])[:10])
        except (ValueError, KeyError, TypeError):
            return False
        if status_filter == "cancelled":
            return status == "cancelled"
        if status_filter == "upcoming":
            return check_out >= today and status in ("pending", "confirmed")
        if status_filter == "past":
            return check_out < today or status == "completed"
        # Unbekannter Filterwert → fail-closed (nichts zeigen wäre irreführend);
        # der Router validiert bereits die erlaubten Werte, das ist der Backstop.
        return False

    # -- Detail ----------------------------------------------------------------
    def get_booking(
        self, reservation_id: str, email: str, *, today: date
    ) -> GuestBookingDetail:
        row = self._load_own(reservation_id, email)
        return self._detail(row, today=today)

    # -- Zeitleiste (maskiert) -------------------------------------------------
    def timeline(
        self, reservation_id: str, email: str
    ) -> GuestTimelineResponse:
        """reservation_events dieser Buchung — guest-scoped und maskiert.

        Erst den E-Mail-Match erzwingen (sonst 404), dann die Ereignisse laden.
        An den Gast gehen NUR kind + created_at + ein gefiltertes detail — nie der
        interne Auslöser (by_user_id) oder tenant-interne Rohdaten.
        """
        self._load_own(reservation_id, email)  # 404 bei fremd
        rows = (
            self._db()
            .table("reservation_events")
            .select("kind, detail, created_at")
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .limit(_MAX_ROWS)
            .execute()
        ).data or []
        items = [
            GuestTimelineEvent(
                kind=r["kind"],
                created_at=r["created_at"],
                detail=self._mask_event_detail(r.get("detail")),
            )
            for r in rows
        ]
        return GuestTimelineResponse(items=items)

    @staticmethod
    def _mask_event_detail(detail: object) -> dict:
        """Aus dem Event-detail nur gast-unbedenkliche Schlüssel durchreichen.

        Interne Felder (Objekt-IDs beim Move, Storno-Begründung des Betriebs,
        interne Preis-Rohwerte) bleiben draußen — der Gast sieht die Art des
        Ereignisses, nicht die tenant-internen Details.
        """
        if not isinstance(detail, dict):
            return {}
        allowed = ("check_in", "check_out")
        return {k: detail[k] for k in allowed if k in detail}

    # -- Storno (delegiert) ----------------------------------------------------
    def cancel_booking(
        self, reservation_id: str, email: str, reason: str, *, today: date
    ) -> GuestCancelResponse:
        """Gast storniert SEINE Buchung.

        Ablauf: E-Mail-Match erzwingen → Stornierbarkeit prüfen (frei stornierbar,
        nicht eingecheckt) → an `ReservationsService.cancel` delegieren. Damit
        laufen Nächte-Freigabe (`_release_nights`, Wurzel 1), Channex-Sync und
        policy-Refund NICHT dupliziert, sondern über die EINE zentrale Stelle.

        Idempotenz (Wurzel 2): eine bereits stornierte Buchung liefert der
        delegierte `cancel` als 409 zurück (kein Doppel-Release) — wir mappen das
        auf einen freundlichen 409. Der tenant_id für den zentralen Storno wird
        serverseitig aus der (per E-Mail dem Gast zugeordneten) Reservierung
        abgeleitet (der Server hat service_role).
        """
        row = self._load_own(reservation_id, email)
        tenant_id = row.get("tenant_id")
        if not tenant_id:
            raise GuestBookingsError("Buchung nicht gefunden.", status_code=404)
        if row.get("status") == "cancelled":
            raise GuestBookingsError(
                "Diese Buchung ist bereits storniert.", status_code=409
            )
        if not self._can_cancel(row, today=today):
            raise GuestBookingsError(
                "Diese Buchung kann nicht mehr selbst storniert werden — bitte "
                "wenden Sie sich an den Gastgeber.",
                status_code=409,
            )
        clean_reason = (reason or "").strip() or "Vom Gast storniert."
        # Synthetischer Kontext: der Server delegiert mit dem abgeleiteten Tenant.
        # by_user_id=None → der Auslöser bleibt leer (ein Gast ist keine users-
        # Zeile; cancelled_by/by_user_id sind FK auf public.users).
        ctx = AuthContext(user_id=str(row.get("id")), tenant_id=str(tenant_id))
        try:
            res = ReservationsService(
                service_client=self._db()
            ).cancel(
                ctx,
                reservation_id,
                clean_reason,
                # Der Gast selbst — und das ist der Grund, warum 0410
                # überhaupt gebraucht wurde: `by_user_id=None` schreibt in
                # `cancelled_by` NULL (ein Portal-Gast ist keine users-Zeile),
                # damit war ein Gast-Storno von „Auslöser unbekannt" nicht mehr
                # zu unterscheiden. Die Partei sagt es jetzt ausdrücklich.
                partei=CancelParty.gast,
                reason_code=CancelReasonCode.gast_wunsch,
                by_user_id=None,
            )
        except ReservationError as exc:
            raise GuestBookingsError(
                exc.message, status_code=exc.status_code
            ) from exc
        log.info(
            "guest_cancelled_booking",
            reservation_id=reservation_id,
            tenant_id=str(tenant_id),
        )
        return GuestCancelResponse(id=res.id, status=res.status)
