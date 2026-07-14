"""OTA-Zusatzflächen: Reviews/Scores, Availability Rules, Reporting (Booking.com
No-Show/Invalid Card), Message-Threads, Booking CRS und die Webhook-Ereignisliste.

Mixin des ChannelManagerService (Fassade in service.py). Alle Methoden sind
tenant-gescopt (Wurzel 3): jede Channex-Ressource wird VOR der Aktion gegen die
Channex-Property-IDs des Tenants geprüft — die Channex-APIs selbst sind kontoweit
(white-label, ein Konto für alle Mandanten) und dürfen nie roh durchgereicht
werden.
"""
from __future__ import annotations

from typing import Any

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log


def _rows(res: dict[str, Any]) -> list[dict[str, Any]]:
    data = res.get("data")
    return data if isinstance(data, list) else []


def _attrs(row: dict[str, Any]) -> dict[str, Any]:
    attrs = row.get("attributes")
    return attrs if isinstance(attrs, dict) else row


def _related_property_id(row: dict[str, Any]) -> str | None:
    """relationships.property.data.id einer Channex-Ressource (Review/Thread/…)."""
    rel = row.get("relationships") or {}
    prop = (rel.get("property") or {}).get("data") or {}
    pid = prop.get("id")
    return str(pid) if pid else None


class OtaExtrasMixin:
    """Reviews, Availability Rules, Reporting, Threads, CRS, Ereignisliste."""

    # -- gemeinsame Scope-Helfer ------------------------------------------------
    def _own_channex_property_ids(self, ctx: AuthContext) -> set[str]:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        return self._tenant_channex_property_ids(db, tenant_id)

    def _require_own_property_map(
        self, ctx: AuthContext, map_id: str
    ) -> dict[str, Any]:
        """channex_property_map-Zeile per ID laden — tenant-gescopt (Wurzel 3:
        Load und Scope nicht trennen)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        rows = (
            db.table("channex_property_map")
            .select("id, tenant_id, property_id, channex_property_id")
            .eq("id", map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise ChannelManagerError("Verbindung nicht gefunden.", status_code=404)
        return rows[0]

    def _require_own_channex_booking(
        self, ctx: AuthContext, channex_booking_id: str
    ) -> dict[str, Any]:
        """channex_booking-Staging-Zeile tenant-gescopt laden (für Reporting/CRS)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        rows = (
            db.table("channex_booking")
            .select("id, tenant_id, channex_booking_id, ota_name")
            .eq("channex_booking_id", channex_booking_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise ChannelManagerError("Buchung nicht gefunden.", status_code=404)
        return rows[0]

    # -- Reviews & Scores --------------------------------------------------------
    def list_reviews(
        self, ctx: AuthContext, *, page: int = 1, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Gäste-Bewertungen (Booking.com/Airbnb/Expedia) der Tenant-Objekte."""
        own = self._own_channex_property_ids(ctx)
        if not own:
            return []
        try:
            res = self._channex.list_reviews(
                property_ids=sorted(own), page=page, limit=limit
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for row in _rows(res):
            # Doppelter Boden zum Channex-Filter: nur eigene Objekte durchlassen.
            prop_id = _related_property_id(row)
            if prop_id and prop_id not in own:
                continue
            attrs = _attrs(row)
            out.append({"id": row.get("id") or attrs.get("id"), **attrs})
        return out

    def _require_own_review(self, ctx: AuthContext, review_id: str) -> dict[str, Any]:
        own = self._own_channex_property_ids(ctx)
        try:
            res = self._channex.get_review(review_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        row = res.get("data") or {}
        prop_id = _related_property_id(row)
        if not prop_id or prop_id not in own:
            raise ChannelManagerError("Bewertung nicht gefunden.", status_code=404)
        return row

    def reply_review(
        self, ctx: AuthContext, review_id: str, reply: str
    ) -> dict[str, Any]:
        """Auf eine Gäste-Bewertung antworten (geht an die OTA zurück)."""
        self._require_own_review(ctx, review_id)
        try:
            return self._channex.reply_review(review_id, reply)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def send_guest_review(
        self, ctx: AuthContext, review_id: str, review: dict[str, Any]
    ) -> dict[str, Any]:
        """Gast bewerten (nur Airbnb): scores/tags/public+private review."""
        self._require_own_review(ctx, review_id)
        try:
            return self._channex.send_airbnb_guest_review(review_id, review)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def get_property_scores(
        self, ctx: AuthContext, map_id: str, *, detailed: bool = False
    ) -> dict[str, Any]:
        """Bewertungs-Scores eines Objekts (gesamt, optional je OTA)."""
        pm = self._require_own_property_map(ctx, map_id)
        try:
            res = self._channex.get_property_score(
                pm["channex_property_id"], detailed=detailed
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return res.get("data") or {}

    # -- Availability Rules (kanal-spezifische Kontingente) -----------------------
    def list_availability_rules(
        self, ctx: AuthContext, map_id: str
    ) -> list[dict[str, Any]]:
        pm = self._require_own_property_map(ctx, map_id)
        try:
            res = self._channex.list_availability_rules(pm["channex_property_id"])
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return [
            {"id": row.get("id") or _attrs(row).get("id"), **_attrs(row)}
            for row in _rows(res)
        ]

    def create_availability_rule(
        self, ctx: AuthContext, map_id: str, attributes: dict[str, Any]
    ) -> dict[str, Any]:
        """Regel (close_out | availability_offset | max_availability) anlegen.
        property_id wird SERVERSEITIG gesetzt (nie aus dem Request übernommen)."""
        pm = self._require_own_property_map(ctx, map_id)
        attrs = {**attributes, "property_id": pm["channex_property_id"]}
        try:
            res = self._channex.create_availability_rule(attrs)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return res.get("data") or {}

    def _require_own_rule(self, ctx: AuthContext, rule_id: str) -> dict[str, Any]:
        own = self._own_channex_property_ids(ctx)
        try:
            res = self._channex.get_availability_rule(rule_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        row = res.get("data") or {}
        prop_id = _related_property_id(row)
        if not prop_id or prop_id not in own:
            raise ChannelManagerError("Regel nicht gefunden.", status_code=404)
        return row

    def update_availability_rule(
        self, ctx: AuthContext, rule_id: str, attributes: dict[str, Any]
    ) -> dict[str, Any]:
        rule = self._require_own_rule(ctx, rule_id)
        # property_id der Regel beibehalten (kein Umhängen auf fremde Objekte).
        attrs = dict(attributes)
        attrs.pop("property_id", None)
        del rule
        try:
            res = self._channex.update_availability_rule(rule_id, attrs)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return res.get("data") or {}

    def delete_availability_rule(self, ctx: AuthContext, rule_id: str) -> None:
        self._require_own_rule(ctx, rule_id)
        try:
            self._channex.delete_availability_rule(rule_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    # -- Reporting API (Booking.com) ----------------------------------------------
    def report_no_show(
        self, ctx: AuthContext, channex_booking_id: str, *, waived_fees: bool
    ) -> dict[str, Any]:
        self._require_own_channex_booking(ctx, channex_booking_id)
        try:
            return self._channex.report_no_show(
                channex_booking_id, waived_fees=waived_fees
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def report_invalid_card(
        self, ctx: AuthContext, channex_booking_id: str
    ) -> dict[str, Any]:
        self._require_own_channex_booking(ctx, channex_booking_id)
        try:
            return self._channex.report_invalid_card(channex_booking_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def report_cancel_due_invalid_card(
        self, ctx: AuthContext, channex_booking_id: str
    ) -> dict[str, Any]:
        self._require_own_channex_booking(ctx, channex_booking_id)
        try:
            return self._channex.report_cancel_due_invalid_card(channex_booking_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    # -- Message-Threads (inkl. Airbnb-Inquiries ohne Buchung) ---------------------
    def list_message_threads(
        self, ctx: AuthContext, *, page: int = 1, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Threads der Tenant-Objekte. Der Channex-Endpunkt ist kontoweit —
        gefiltert wird hier über relationships.property (Wurzel 3)."""
        own = self._own_channex_property_ids(ctx)
        if not own:
            return []
        try:
            res = self._channex.list_message_threads(page=page, limit=limit)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for row in _rows(res):
            prop_id = _related_property_id(row)
            if not prop_id or prop_id not in own:
                continue
            attrs = _attrs(row)
            rel = row.get("relationships") or {}
            booking = (rel.get("booking") or {}).get("data") or {}
            out.append(
                {
                    "id": row.get("id") or attrs.get("id"),
                    "booking_id": booking.get("id"),
                    **attrs,
                }
            )
        return out

    def _require_own_thread(self, ctx: AuthContext, thread_id: str) -> dict[str, Any]:
        own = self._own_channex_property_ids(ctx)
        try:
            res = self._channex.get_message_thread(thread_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        row = res.get("data") or {}
        prop_id = _related_property_id(row)
        if not prop_id or prop_id not in own:
            raise ChannelManagerError("Unterhaltung nicht gefunden.", status_code=404)
        return row

    def get_thread_messages(
        self, ctx: AuthContext, thread_id: str, *, page: int = 1, limit: int = 50
    ) -> list[dict[str, Any]]:
        self._require_own_thread(ctx, thread_id)
        try:
            res = self._channex.get_thread_messages(thread_id, page=page, limit=limit)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return [
            {"id": row.get("id") or _attrs(row).get("id"), **_attrs(row)}
            for row in _rows(res)
        ]

    def send_thread_message(
        self, ctx: AuthContext, thread_id: str, message: str
    ) -> dict[str, Any]:
        self._require_own_thread(ctx, thread_id)
        try:
            return self._channex.send_thread_message(thread_id, message)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def close_message_thread(self, ctx: AuthContext, thread_id: str) -> dict[str, Any]:
        self._require_own_thread(ctx, thread_id)
        try:
            return self._channex.close_message_thread(thread_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def mark_thread_no_reply_needed(
        self, ctx: AuthContext, thread_id: str
    ) -> dict[str, Any]:
        self._require_own_thread(ctx, thread_id)
        try:
            return self._channex.mark_thread_no_reply_needed(thread_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    # -- Booking CRS (PMS-Änderungen an Channex zurückspiegeln; Beta) --------------
    def crs_create_booking(
        self, ctx: AuthContext, booking: dict[str, Any]
    ) -> dict[str, Any]:
        """Offline-/PMS-Buchung in Channex anlegen. property_id im Payload MUSS
        ein Channex-Objekt dieses Tenants sein (Wurzel 3)."""
        own = self._own_channex_property_ids(ctx)
        prop_id = booking.get("property_id")
        if not prop_id or str(prop_id) not in own:
            raise ChannelManagerError(
                "property_id fehlt oder gehört nicht zu diesem Konto.",
                status_code=422,
            )
        try:
            return self._channex.crs_create_booking(booking)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def crs_update_booking(
        self, ctx: AuthContext, channex_booking_id: str, booking: dict[str, Any]
    ) -> dict[str, Any]:
        """Bestehende (auch OTA-)Buchung in Channex modifizieren/stornieren —
        Channex mergt spätere OTA-Revisionen diff-basiert (Overrides-Logik)."""
        self._require_own_channex_booking(ctx, channex_booking_id)
        try:
            return self._channex.crs_update_booking(channex_booking_id, booking)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    # -- Webhook-Ereignisliste (Airbnb-Anfragen, Sync-Fehler, Reviews, …) ----------
    def list_webhook_events(
        self,
        ctx: AuthContext,
        *,
        only_unresolved: bool = False,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        q = (
            db.table("channex_webhook_event")
            .select("id, property_id, event, payload, severity, resolved, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 200)))
        )
        if only_unresolved:
            q = q.eq("resolved", False)
        return q.execute().data or []

    def resolve_webhook_event(self, ctx: AuthContext, event_id: str) -> None:
        """Ereignis als erledigt markieren (tenant-gescopt über das Update-Filter
        selbst — kein ungescoptes Load)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        updated = (
            db.table("channex_webhook_event")
            .update({"resolved": True})
            .eq("id", event_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        if not updated:
            raise ChannelManagerError("Ereignis nicht gefunden.", status_code=404)

    # -- Full-Sync manuell auslösen -------------------------------------------------
    def trigger_full_sync(self, ctx: AuthContext, map_id: str) -> dict[str, Any]:
        """Voll-Abgleich DB→Channex für ein Objekt sofort einreihen (zusätzlich
        zum nächtlichen Lauf) — z. B. nach einem vermuteten Drift."""
        pm = self._require_own_property_map(ctx, map_id)
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        try:
            from src.jobs.queue import dedup_key, enqueue

            enqueue(
                db, "full_sync_property", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": pm["property_id"]},
                dedup_key=dedup_key(
                    tenant_id, pm["property_id"], "full_sync_property"
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen sichtbar fehlschlagen
            log.warning("full_sync_enqueue_failed", error=str(exc)[:200])
            raise ChannelManagerError(
                "Full-Sync konnte nicht eingereiht werden.", status_code=502
            ) from exc
        return {"status": "queued", "property_id": pm["property_id"]}
