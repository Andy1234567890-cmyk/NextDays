"""Service für guest_stay (Gastmodul / Self-Check-in, /plattform).

Der eingeloggte Gast (GuestContext) ruft für SEINE Buchung das Gastmodul ab und
checkt selbst ein. Der Service läuft mit Service-Role (RLS umgangen) → JEDER
Zugriff scopet EXPLIZIT über die Gast-E-Mail (reservations.guest_email ==
ctx.email, case-insensitiv); eine fremde/fehlende Buchung → 404 (Wurzel 3/9,
kein Existenz-Leak).

Der door_code ist ein Geheimnis (wie Türcode/Dossier in CLAUDE.md). Seine
Freigabe entscheidet ausschließlich `_resolve_door_code` — FAIL-CLOSED: sobald
eine Regel-Voraussetzung unklar ist oder Daten fehlen, wird der Code NICHT
ausgeliefert (Wurzel 5/6).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, time
from uuid import UUID

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    GuestCheckInResponse,
    GuestStayMessaging,
    GuestStayResponse,
    SliceHealth,
)

log = get_logger("nextdays.guest_stay")

# Zahlstatus, die als „bezahlt" für die Türcode-Freigabe zählen (0082).
_PAID_STATUSES = frozenset({"paid", "deposit_held"})

# Abbildung messaging-Key (type_attributes.messaging) → Response-Feld.
# Allowlist gast-relevanter Keys (Wurzel 8): NUR diese Keys werden durchgereicht.
_MESSAGING_KEYS: tuple[tuple[str, str], ...] = (
    ("checkIn", "check_in"),
    ("checkOut", "check_out"),
    ("directions", "directions"),
    ("doorInstructions", "door_instructions"),
    ("rules", "rules"),
    ("wifi", "wifi"),
    ("localGuide", "local_guide"),
    ("emergency", "emergency"),
)

# Freigabe-Gründe (Türcode bleibt None). Deutscher Klartext für die Gast-UI.
_REASON_BEFORE_CHECKIN = "erst ab Check-in sichtbar"
_REASON_NOT_PAID = "erst nach Zahlung sichtbar"


class GuestStayError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GuestStayService:
    slice_name = "guest_stay"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise GuestStayError("Gast-DB nicht verfügbar.", status_code=500)
        return self._client

    # --- Scope: Buchung des Gasts laden (E-Mail-Match) --------------------
    def _own_reservation(self, reservation_id: str, email: str) -> dict:
        """Reservierung laden UND auf die Gast-E-Mail scopen (Wurzel 3/9).

        Service-Role umgeht RLS, daher ist dieser E-Mail-Match der EINZIGE
        Cross-Gast-Schutz: eine Buchung, deren guest_email nicht (case-insensitiv)
        der Token-E-Mail entspricht, wird als „nicht gefunden" behandelt (404,
        kein Existenz-Leak an einen fremden Gast).
        """
        try:
            UUID(str(reservation_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise GuestStayError("Buchung nicht gefunden.", status_code=404) from exc
        rows = (
            self._db()
            .table("reservations")
            .select(
                "id, property_id, check_in, check_out, checked_in_at, "
                "checked_out_at, status, payment_status, guest_email"
            )
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise GuestStayError("Buchung nicht gefunden.", status_code=404)
        res = rows[0]
        if (res.get("guest_email") or "").strip().lower() != email.strip().lower():
            raise GuestStayError("Buchung nicht gefunden.", status_code=404)
        return res

    def _property(self, property_id: str) -> dict:
        """Objekt-Basis (title/address/currency/messaging) laden."""
        rows = (
            self._db()
            .table("properties")
            .select("id, title, address, currency, type_attributes")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            # Reservierung ohne Objekt ist ein Datenfehler — klar fehlschlagen,
            # kein erfundener Ersatz (Wurzel 4/5).
            raise GuestStayError("Objekt nicht gefunden.", status_code=404)
        return rows[0]

    def _portal(self, property_id: str) -> dict | None:
        """property_guest_portal-Zeile des Objekts (oder None, wenn nicht angelegt)."""
        rows = (
            self._db()
            .table("property_guest_portal")
            .select(
                "enabled, contact_name, contact_phone, self_checkin, door_code, "
                "show_code_only_if_paid, hide_code_until_checkin, code_visible_from, "
                "maintenance_phone, header_image_path"
            )
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    # --- Türcode-Freigabe (fail-CLOSED) ----------------------------------
    def _resolve_door_code(
        self, portal_row: dict, reservation: dict
    ) -> tuple[str | None, str | None]:
        """Entscheidet, ob der Türcode ausgeliefert werden darf.

        Rückgabe: (code, grund). Bei Freigabe (code, None); bei Sperre
        (None, grund). Der door_code ist ein Geheimnis → FAIL-CLOSED: sobald
        eine Voraussetzung unklar ist oder eine benötigte Angabe fehlt, wird
        NICHTS ausgeliefert (Wurzel 5/6).

        Regeln (jede greift eigenständig, beide müssen erfüllt sein):
          1. hide_code_until_checkin: der Code wird erst ab dem Anreisetag
             sichtbar — und, falls code_visible_from gesetzt ist, erst ab dieser
             Uhrzeit am Anreisetag. Vorher → gesperrt.
          2. show_code_only_if_paid: der Code wird erst sichtbar, wenn die
             Buchung bezahlt ist (payment_status in paid/deposit_held). Sonst
             → gesperrt.
        """
        # Kein Code hinterlegt → nichts zu zeigen (kein Grund, kein Leak).
        code = portal_row.get("door_code")
        if not code:
            return None, None

        # Regel 2 zuerst: Zahlung ist hart — payment_status muss bekannt UND in
        # der Bezahlt-Menge sein. Unbekannt/fehlend → fail-closed (gesperrt).
        if portal_row.get("show_code_only_if_paid"):
            payment_status = reservation.get("payment_status")
            if payment_status not in _PAID_STATUSES:
                return None, _REASON_NOT_PAID

        # Regel 1: erst ab Check-in (Datum, optional Uhrzeit).
        if portal_row.get("hide_code_until_checkin"):
            visible_from = self._checkin_visible_from(portal_row, reservation)
            if visible_from is None:
                # Anreisedatum unlesbar → wir können die Regel nicht sicher
                # auswerten → fail-closed, Code NICHT zeigen.
                return None, _REASON_BEFORE_CHECKIN
            if datetime.now(UTC) < visible_from:
                return None, _REASON_BEFORE_CHECKIN

        return code, None

    @staticmethod
    def _checkin_visible_from(
        portal_row: dict, reservation: dict
    ) -> datetime | None:
        """Frühester Sichtbarkeits-Zeitpunkt des Codes (UTC) für Regel 1.

        Anreisetag um 00:00 UTC, bzw. — falls code_visible_from (HH:MM) gesetzt
        und parsebar — an diesem Tag zu dieser Uhrzeit (als UTC interpretiert).
        Ist das Anreisedatum unlesbar, liefert die Methode None → der Aufrufer
        behandelt das fail-closed. Eine unlesbare code_visible_from-Zeit wird
        bewusst ignoriert (die Datums-Untergrenze bleibt) statt zu raten.
        """
        raw_check_in = reservation.get("check_in")
        if not raw_check_in:
            return None
        try:
            check_in_day = date.fromisoformat(str(raw_check_in))
        except ValueError:
            return None
        visible_time = time(0, 0)
        raw_time = portal_row.get("code_visible_from")
        if raw_time:
            try:
                visible_time = time.fromisoformat(str(raw_time))
            except ValueError:
                # Ungültige Uhrzeit-Angabe → Datums-Untergrenze bleibt (00:00),
                # kein Fantasie-Default (Wurzel 4).
                visible_time = time(0, 0)
        return datetime.combine(check_in_day, visible_time, tzinfo=UTC)

    # --- Info-Texte (messaging) ------------------------------------------
    @staticmethod
    def _messaging(type_attributes: dict | None) -> GuestStayMessaging:
        """Gast-relevante messaging-Texte gefiltert durchreichen (Wurzel 8).

        NUR die bekannten Allowlist-Keys werden übernommen; jeder Wert muss ein
        Objekt (mehrsprachig, `{lang: text}`) mit String-Werten sein — sonst wird
        das Feld weggelassen (None). Kein serverseitiges HTML-Rendern: die Texte
        sind Plaintext (die UI escaped beim Anzeigen).
        """
        raw = {}
        if isinstance(type_attributes, dict):
            candidate = type_attributes.get("messaging")
            if isinstance(candidate, dict):
                raw = candidate
        out: dict[str, dict[str, str]] = {}
        for src_key, dst_key in _MESSAGING_KEYS:
            field = raw.get(src_key)
            if not isinstance(field, dict):
                continue
            cleaned = {
                lang: text
                for lang, text in field.items()
                if isinstance(lang, str) and isinstance(text, str) and text
            }
            if cleaned:
                out[dst_key] = cleaned
        return GuestStayMessaging(**out)

    # --- Endpunkt 1: Gastmodul einer Buchung -----------------------------
    def get_stay(self, email: str, reservation_id: str) -> GuestStayResponse:
        """Das Gastmodul für EINE Buchung des Gasts (E-Mail-Match, sonst 404).

        Ist kein property_guest_portal-Eintrag vorhanden oder enabled=False, ist
        das Gastmodul für dieses Objekt nicht freigeschaltet → 404 mit klarer
        Meldung (der Gast hat schlicht nichts abzurufen).
        """
        res = self._own_reservation(reservation_id, email)
        portal = self._portal(res["property_id"])
        if portal is None or not portal.get("enabled"):
            raise GuestStayError(
                "Für diese Buchung ist kein Gastmodul freigeschaltet.",
                status_code=404,
            )
        prop = self._property(res["property_id"])
        door_code, hidden_reason = self._resolve_door_code(portal, res)
        return GuestStayResponse(
            reservation_id=str(res["id"]),
            property_id=str(res["property_id"]),
            property_title=prop.get("title") or "",
            property_address=prop.get("address"),
            # Währung aus dem Objekt (Wurzel 4 — kein €-Hardcode; fehlt sie,
            # bleibt das Feld leer, die UI rendert symbollos).
            currency=prop.get("currency") or None,
            check_in=str(res["check_in"]),
            check_out=str(res["check_out"]),
            checked_in_at=res.get("checked_in_at"),
            checked_out_at=res.get("checked_out_at"),
            payment_status=str(res.get("payment_status") or "unpaid"),
            self_checkin=bool(portal.get("self_checkin")),
            contact_name=portal.get("contact_name"),
            contact_phone=portal.get("contact_phone"),
            maintenance_phone=portal.get("maintenance_phone"),
            header_image_path=portal.get("header_image_path"),
            messaging=self._messaging(prop.get("type_attributes")),
            door_code=door_code,
            door_code_hidden_reason=hidden_reason,
        )

    # --- Endpunkt 2: Self-Check-in durch den Gast ------------------------
    def self_check_in(
        self, email: str, reservation_id: str, *, today: date
    ) -> GuestCheckInResponse:
        """Self-Check-in durch den Gast (E-Mail-gescopet, idempotent).

        Bedingungen: self_checkin am Objekt aktiv, Buchung bestätigt (nicht
        pending/cancelled/abgereist), Anreisetag erreicht. Idempotent (Wurzel 2):
        ist der Gast bereits eingecheckt, liefern wir 200 mit dem bestehenden
        Zeitstempel statt eines Fehlers — Doppelklick/Retry ist harmlos.
        """
        res = self._own_reservation(reservation_id, email)
        portal = self._portal(res["property_id"])
        if portal is None or not portal.get("enabled"):
            raise GuestStayError(
                "Für diese Buchung ist kein Gastmodul freigeschaltet.",
                status_code=404,
            )
        if not portal.get("self_checkin"):
            raise GuestStayError(
                "Self-Check-in ist für dieses Objekt nicht aktiviert.",
                status_code=403,
            )

        # Idempotenz-Guard VOR dem Seiteneffekt: schon eingecheckt → bestehenden
        # Zustand zurückgeben (kein Fehler, kein zweiter Event).
        existing = res.get("checked_in_at")
        if existing:
            return GuestCheckInResponse(
                reservation_id=str(res["id"]),
                checked_in_at=str(existing),
                already_checked_in=True,
            )

        status = res.get("status")
        if status == "cancelled":
            raise GuestStayError(
                "Stornierte Buchung kann nicht eingecheckt werden.", status_code=409
            )
        if status == "pending":
            raise GuestStayError(
                "Buchung ist noch nicht bestätigt.", status_code=409
            )
        if res.get("checked_out_at") or status == "completed":
            raise GuestStayError("Buchung ist bereits abgereist.", status_code=409)

        # Anreisetag muss erreicht sein (Gast darf nicht vorab einchecken — die
        # Rezeptions-Route erlaubt Early-Check-in, der Self-Service bewusst nicht).
        try:
            check_in_day = date.fromisoformat(str(res["check_in"]))
        except ValueError as exc:
            raise GuestStayError(
                "Anreisedatum unlesbar.", status_code=422
            ) from exc
        if today < check_in_day:
            raise GuestStayError(
                "Self-Check-in ist erst am Anreisetag möglich.", status_code=409
            )

        now_iso = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update({"checked_in_at": now_iso})
            # Doppelter Backstop gegen Races: nur setzen, solange noch nicht
            # eingecheckt (idempotent auch bei zwei parallelen Requests).
            .eq("id", reservation_id)
            .is_("checked_in_at", "null")
            .execute()
        ).data
        if not upd:
            # Kein Treffer → zwischenzeitlich schon eingecheckt (Race): erneut
            # laden und den bestehenden Zustand zurückgeben (idempotent, 200).
            latest = self._own_reservation(reservation_id, email)
            existing = latest.get("checked_in_at")
            if existing:
                return GuestCheckInResponse(
                    reservation_id=str(latest["id"]),
                    checked_in_at=str(existing),
                    already_checked_in=True,
                )
            raise GuestStayError(
                "Check-in konnte nicht gespeichert werden.", status_code=500
            )

        # Zeitleiste (0122): „eingecheckt". Best-effort — ein fehlgeschlagener
        # Log-Insert darf den erfolgten Check-in nicht kippen (Wurzel 5).
        self._log_checked_in(res["property_id"], reservation_id)
        log.info("guest_self_check_in", reservation_id=reservation_id)
        return GuestCheckInResponse(
            reservation_id=str(res["id"]),
            checked_in_at=now_iso,
            already_checked_in=False,
        )

    def _log_checked_in(self, property_id: str, reservation_id: str) -> None:
        """reservation_events 'checked_in' schreiben (Muster reservations/_base).

        Append-only, best-effort (Wurzel 5): der Gast hat keinen tenant_id/
        by_user_id — die tenant_id holen wir aus dem Objekt, damit die Zeitleiste
        korrekt gescopet ist; detail markiert die Quelle (Self-Check-in).
        """
        try:
            owner = (
                self._db()
                .table("properties")
                .select("tenant_id")
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data or []
            tenant_id = owner[0].get("tenant_id") if owner else None
            if not tenant_id:
                return
            self._db().table("reservation_events").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "kind": "checked_in",
                    "by_user_id": None,
                    "detail": {"source": "guest_self_check_in"},
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
            log.warning(
                "guest_stay_event_log_failed",
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )
