"""OTA-Zusatzflächen: Reviews/Scores, Availability Rules, Reporting (Booking.com
No-Show/Invalid Card), Message-Threads, Booking CRS und die Webhook-Ereignisliste.

Mixin des ChannelManagerService (Fassade in service.py). Alle Methoden sind
tenant-gescopt (Wurzel 3): jede Channex-Ressource wird VOR der Aktion gegen die
Channex-Property-IDs des Tenants geprüft — die Channex-APIs selbst sind kontoweit
(white-label, ein Konto für alle Mandanten) und dürfen nie roh durchgereicht
werden.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log, nur_uuids

if TYPE_CHECKING:
    from .schemas import AirbnbAnfrageAntwort


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

    # Interne Blätter-Obergrenze für kontoweite Channex-Listen (Reviews/Threads):
    # der Property-Filter ist bei Channex für diese Endpunkte nicht dokumentiert
    # verifiziert (unbekannte Query-Keys werden still ignoriert) — deshalb wird
    # serverseitig geblättert und HIER tenant-gefiltert, bis `limit` eigene
    # Einträge gesammelt sind.
    _ACCOUNT_LIST_MAX_PAGES = 10

    # -- Reviews & Scores --------------------------------------------------------
    def list_reviews(
        self, ctx: AuthContext, *, page: int = 1, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Gäste-Bewertungen (Booking.com/Airbnb/Expedia) der Tenant-Objekte.

        FAIL-CLOSED (Wurzel 5): Zeilen ohne property-Relationship werden
        verworfen — der Channex-Account ist kontoweit, eine Zeile ohne belegbare
        Objekt-Zuordnung darf nie bei einem Tenant landen."""
        own = self._own_channex_property_ids(ctx)
        # Nur echte UUIDs an Channex geben: ein synthetischer Demo-Wert lässt den
        # ganzen Request mit 422 `filter is_invalid` scheitern (live beobachtet).
        # Die Tenant-Zuordnung prüfen wir ohnehin unten selbst.
        gefiltert = nur_uuids(own)
        if not gefiltert:
            return []
        out: list[dict[str, Any]] = []
        # `page` des Aufrufers = Seite über die GEFILTERTE Liste; intern wird
        # kontoweit geblättert (Filterwirkung bei Channex nicht garantiert).
        needed = page * limit
        for feed_page in range(1, self._ACCOUNT_LIST_MAX_PAGES + 1):
            try:
                res = self._channex.list_reviews(
                    property_ids=gefiltert, page=feed_page, limit=100
                )
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            rows = _rows(res)
            for row in rows:
                prop_id = _related_property_id(row)
                if not prop_id or prop_id not in own:
                    continue  # fail-closed: keine belegbare Zuordnung → raus
                attrs = _attrs(row)
                out.append({"id": row.get("id") or attrs.get("id"), **attrs})
            if len(out) >= needed or len(rows) < 100:
                break
        else:
            # Deckel erreicht, ohne `needed` zu füllen: sichtbar machen (kein
            # stilles Abschneiden) — Rest liegt jenseits des Blätter-Deckels.
            if len(out) < needed:
                log.warning(
                    "channex_account_list_cap_reached",
                    max_pages=self._ACCOUNT_LIST_MAX_PAGES, collected=len(out),
                )
        start = (page - 1) * limit
        return out[start:start + limit]

    def _require_own_review(self, ctx: AuthContext, review_id: str) -> dict[str, Any]:
        own = self._own_channex_property_ids(ctx)
        try:
            res = self._channex.get_review(review_id)
        except ChannexError as exc:
            # KEIN Durchreichen der Portal-Meldung: die ist technisch und
            # kontextlos („is invalid") und im Kundentext hat Provider-Sprache
            # nichts zu suchen. Ein 4xx heißt fachlich: die Bewertung liegt beim
            # Portal nicht (mehr) vor — alles andere ist eine Störung dort.
            if 400 <= exc.status_code < 500:
                raise ChannelManagerError(
                    "Diese Bewertung ist beim Portal nicht mehr verfügbar.",
                    status_code=404,
                ) from exc
            raise ChannelManagerError(
                "Das Portal antwortet gerade nicht. Bitte später erneut versuchen.",
                status_code=502,
            ) from exc
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
            res = self._channex.reply_review(review_id, reply)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        # Gegenzustand (Wurzel 1): erst ist die Antwort beim Portal, dann im
        # eigenen Bestand — sonst bleibt die Bewertung im Cockpit bis zum
        # nächsten Sync „unbeantwortet".
        self._mark_review_replied(review_id, reply)
        return res

    def send_guest_review(
        self, ctx: AuthContext, review_id: str, review: dict[str, Any]
    ) -> dict[str, Any]:
        """Gast bewerten (nur Airbnb): scores/tags/public+private review."""
        self._require_own_review(ctx, review_id)
        try:
            res = self._channex.send_airbnb_guest_review(review_id, review)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        # Wurzel 1/2: abgeschickt festhalten, sonst schickt die Automatik beim
        # nächsten Lauf eine zweite Bewertung — die lässt sich nicht zurückholen.
        self._mark_guest_review_sent(review_id)
        return res

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

    def _require_own_channel_and_room_ids(
        self, ctx: AuthContext, channels: list[str], room_types: list[str]
    ) -> None:
        """affected_channels/affected_room_types gegen die Channex-IDs des
        Tenants prüfen (Wurzel 3): der Channex-Account ist kontoweit — auf
        Channex-Validierung gegen fremde IDs wird NICHT vertraut („200 reicht
        nicht")."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        own_channels = {
            r["channex_channel_id"]
            for r in (
                db.table("channex_channel_connection")
                .select("channex_channel_id")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data or []
            if r.get("channex_channel_id")
        }
        own_rooms = {
            r["channex_room_type_id"]
            for r in (
                db.table("channex_room_type_map")
                .select("channex_room_type_id")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            if r.get("channex_room_type_id")
        }
        foreign_ch = [c for c in channels if c not in own_channels]
        foreign_rt = [r for r in room_types if r not in own_rooms]
        # channex_channel_connection ist best-effort persistiert (der Connect
        # loggt Persistenzfehler nur). Bei Miss die LIVE-Kanalliste der eigenen
        # Objekte gegenprüfen, bevor eine legitime Regel fälschlich abgelehnt
        # wird (Import-/Bestandskanäle ohne lokale Zeile).
        if foreign_ch:
            live = self._live_own_channel_ids(ctx)
            foreign_ch = [c for c in foreign_ch if c not in live]
        if foreign_ch or foreign_rt:
            raise ChannelManagerError(
                "Regel verweist auf Kanäle/Zimmertypen, die nicht zu diesem "
                "Konto gehören.",
                status_code=422,
            )

    def _live_own_channel_ids(self, ctx: AuthContext) -> set[str]:
        """Channex-Channel-IDs der eigenen Objekte LIVE von Channex (Fallback
        zur best-effort persistierten channex_channel_connection)."""
        own_props = self._own_channex_property_ids(ctx)
        ids: set[str] = set()
        for pid in own_props:
            try:
                for ch in _rows(self._channex.list_channels(property_id=pid)):
                    cid = ch.get("id") or _attrs(ch).get("id")
                    if cid:
                        ids.add(str(cid))
            except ChannexError:
                continue  # ein Objekt ohne Kanäle/Fehler → überspringen
        return ids

    def create_availability_rule(
        self, ctx: AuthContext, map_id: str, attributes: dict[str, Any]
    ) -> dict[str, Any]:
        """Regel (close_out | availability_offset | max_availability) anlegen.
        property_id wird SERVERSEITIG gesetzt (nie aus dem Request übernommen);
        affected_channels/room_types müssen dem Tenant gehören."""
        pm = self._require_own_property_map(ctx, map_id)
        self._require_own_channel_and_room_ids(
            ctx,
            list(attributes.get("affected_channels") or []),
            list(attributes.get("affected_room_types") or []),
        )
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
        self._require_own_rule(ctx, rule_id)
        self._require_own_channel_and_room_ids(
            ctx,
            list(attributes.get("affected_channels") or []),
            list(attributes.get("affected_room_types") or []),
        )
        # property_id der Regel beibehalten (kein Umhängen auf fremde Objekte).
        attrs = dict(attributes)
        attrs.pop("property_id", None)
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
        # Nur echte UUIDs an Channex geben: ein synthetischer Demo-Wert lässt den
        # ganzen Request mit 422 `filter is_invalid` scheitern (live beobachtet).
        # Die Tenant-Zuordnung prüfen wir ohnehin unten selbst.
        gefiltert = nur_uuids(own)
        if not gefiltert:
            return []
        out: list[dict[str, Any]] = []
        needed = page * limit
        for feed_page in range(1, self._ACCOUNT_LIST_MAX_PAGES + 1):
            try:
                res = self._channex.list_message_threads(page=feed_page, limit=100)
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            rows = _rows(res)
            for row in rows:
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
            if len(out) >= needed or len(rows) < 100:
                break
        else:
            # Deckel erreicht, ohne `needed` zu füllen: sichtbar machen (kein
            # stilles Abschneiden) — Rest liegt jenseits des Blätter-Deckels.
            if len(out) < needed:
                log.warning(
                    "channex_account_list_cap_reached",
                    max_pages=self._ACCOUNT_LIST_MAX_PAGES, collected=len(out),
                )
        start = (page - 1) * limit
        return out[start:start + limit]

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
    def _require_own_crs_room_refs(
        self, ctx: AuthContext, booking: dict[str, Any]
    ) -> None:
        """rooms[].room_type_id / rate_plan_id des CRS-Payloads gegen die
        Channex-IDs des Tenants prüfen (Wurzel 3) — der Channex-Account ist
        kontoweit; auf eine Channex-seitige Fremd-ID-Ablehnung wird NICHT
        vertraut."""
        rooms = booking.get("rooms")
        if not isinstance(rooms, list) or not rooms:
            return
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        own_rooms = {
            r["channex_room_type_id"]
            for r in (
                db.table("channex_room_type_map")
                .select("channex_room_type_id")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            if r.get("channex_room_type_id")
        }
        own_plans = {
            r["channex_rate_plan_id"]
            for r in (
                db.table("channex_rate_plan_map")
                .select("channex_rate_plan_id")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            if r.get("channex_rate_plan_id")
        }
        for room in rooms:
            if not isinstance(room, dict):
                continue
            rt = room.get("room_type_id")
            rp = room.get("rate_plan_id")
            if (rt and str(rt) not in own_rooms) or (
                rp and str(rp) not in own_plans
            ):
                raise ChannelManagerError(
                    "Buchung verweist auf Zimmer/Preispläne, die nicht zu "
                    "diesem Konto gehören.",
                    status_code=422,
                )

    def crs_create_booking(
        self, ctx: AuthContext, booking: dict[str, Any]
    ) -> dict[str, Any]:
        """Offline-/PMS-Buchung in Channex anlegen. property_id im Payload MUSS
        ein Channex-Objekt dieses Tenants sein (Wurzel 3); rooms[]-Referenzen
        werden gegen die Tenant-Mappings geprüft."""
        own = self._own_channex_property_ids(ctx)
        prop_id = booking.get("property_id")
        if not prop_id or str(prop_id) not in own:
            raise ChannelManagerError(
                "property_id fehlt oder gehört nicht zu diesem Konto.",
                status_code=422,
            )
        self._require_own_crs_room_refs(ctx, booking)
        try:
            return self._channex.crs_create_booking(booking)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def crs_update_booking(
        self, ctx: AuthContext, channex_booking_id: str, booking: dict[str, Any]
    ) -> dict[str, Any]:
        """Bestehende (auch OTA-)Buchung in Channex modifizieren/stornieren —
        Channex mergt spätere OTA-Revisionen diff-basiert (Overrides-Logik).
        Eine mitgeschickte property_id muss dem Tenant gehören; rooms[]-
        Referenzen werden gegen die Tenant-Mappings geprüft."""
        self._require_own_channex_booking(ctx, channex_booking_id)
        prop_id = booking.get("property_id")
        if prop_id and str(prop_id) not in self._own_channex_property_ids(ctx):
            raise ChannelManagerError(
                "property_id gehört nicht zu diesem Konto.", status_code=422
            )
        self._require_own_crs_room_refs(ctx, booking)
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
            .select(
                "id, property_id, event, payload, severity, resolved, created_at, "
                "live_feed_event_id, resolution, resolved_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 200)))
        )
        if only_unresolved:
            q = q.eq("resolved", False)
        return q.execute().data or []

    def resolve_webhook_event(self, ctx: AuthContext, event_id: str) -> None:
        """Ereignis als erledigt markieren (tenant-gescopt über das Update-Filter
        selbst — kein ungescoptes Load).

        Das ist die reine LOKALE Quittung („gesehen, kümmert sich jemand"). Eine
        Airbnb-Anfredge zu BEANTWORTEN ist etwas anderes und läuft über
        `airbnb_anfrage_aufloesen` — sonst hielte der Betrieb ein Ereignis für
        erledigt, während der Gast bei Airbnb weiter wartet.
        """
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

    # -- Airbnb-Anfragen beantworten (LiveFeedEvents) --------------------------
    def _require_airbnb_anfrage(
        self, ctx: AuthContext, event_id: str
    ) -> tuple[str, dict[str, Any]]:
        """Die eine Anfrage laden — gescopt, und nur wenn sie auflösbar ist.

        Wurzel 3: Load und Scope bleiben zusammen. Wurzel 9: dieselbe Prüfung wie
        im Listenpfad (tenant), plus die Sachprüfungen, ohne die ein Aufruf bei
        Airbnb sinnlos oder schädlich wäre.
        """
        from .airbnb_anfragen import AUFLOESBARE_EVENTS

        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        zeilen = (
            db.table("channex_webhook_event")
            .select("id, event, severity, resolved, live_feed_event_id, property_id")
            .eq("id", event_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise ChannelManagerError("Ereignis nicht gefunden.", status_code=404)
        zeile = zeilen[0]

        if zeile.get("event") not in AUFLOESBARE_EVENTS:
            raise ChannelManagerError(
                f"Ereignis {zeile.get('event')!r} ist keine beantwortbare "
                "Airbnb-Anfrage.",
                status_code=422,
            )
        # Wurzel 2: der Doppelklick ist real. Ein zweites „annehmen" wäre bei
        # Airbnb ein Fehler — und zwei widersprüchliche Entscheidungen auf
        # dieselbe Anfrage darf es gar nicht geben. Status-Guard VOR dem
        # Seiteneffekt, UNIQUE-Index als Backstop (0284).
        if zeile.get("resolved"):
            raise ChannelManagerError(
                "Diese Anfrage wurde bereits beantwortet.", status_code=409
            )
        live_id = zeile.get("live_feed_event_id")
        if not isinstance(live_id, str) or not live_id.strip():
            # Kein erfundener Ersatzwert (Wurzel 4): ohne die Channex-Ereignis-ID
            # gibt es keinen Weg zu Airbnb. Das passiert bei Altbestand, der vor
            # 0284 eintraf.
            raise ChannelManagerError(
                "Zu dieser Anfrage fehlt die Channex-Ereignis-ID — sie kann "
                "nicht mehr an Airbnb übermittelt werden.",
                status_code=409,
            )
        return tenant_id, zeile

    def airbnb_anfrage_beantworten(
        self, ctx: AuthContext, event_id: str, antwort: AirbnbAnfrageAntwort
    ) -> dict[str, Any]:
        """Eine Airbnb-Anfrage beantworten (Route-Eingang).

        Die Sachprüfungen laufen VOR dem Bau der Antwort, damit ein unpassender
        Wunsch (z. B. „alteration_annehmen" auf eine Voranfrage) nicht erst bei
        Airbnb auffällt.
        """
        from . import airbnb_anfragen as aa

        _tenant_id, zeile = self._require_airbnb_anfrage(ctx, event_id)
        aktion = str(antwort.aktion)
        event = str(zeile.get("event"))

        # Jede Aktion passt zu genau EINER Anfrageart — sonst würde etwa ein
        # „alteration_annehmen" auf eine Voranfrage erst bei Airbnb auffallen.
        erwartet = aa.AKTION_ZU_EVENT.get(aktion)
        if erwartet is None:
            raise ChannelManagerError(f"Aktion {aktion!r} unbekannt.", status_code=422)
        if erwartet != event:
            raise ChannelManagerError(
                f"Aktion {aktion!r} passt nicht zu einem Ereignis vom Typ "
                f"{event!r}.",
                status_code=422,
            )
        try:
            resolution = aa.resolution_bauen(
                aktion,
                grund=antwort.grund,
                nachricht_an_gast=antwort.nachricht_an_gast,
                nachricht_an_airbnb=antwort.nachricht_an_airbnb,
                sofortbuchung_sperren=antwort.sofortbuchung_sperren,
                gesamtpreis_minor=antwort.gesamtpreis_minor,
            )
        except aa.AnfrageFehler as exc:
            raise ChannelManagerError(str(exc), status_code=422) from exc
        return self.airbnb_anfrage_aufloesen(ctx, event_id, resolution)

    def airbnb_anfrage_aufloesen(
        self, ctx: AuthContext, event_id: str, resolution: dict[str, Any]
    ) -> dict[str, Any]:
        """Die Entscheidung an Airbnb senden und lokal festschreiben.

        Reihenfolge mit Absicht: erst Airbnb, dann unsere Quittung. Kippt der
        Aufruf, bleibt die Anfrage OFFEN und kann erneut beantwortet werden —
        andersherum hielte der Betrieb sie für erledigt, während der Gast wartet
        (fail-closed, Wurzel 5).
        """
        tenant_id, zeile = self._require_airbnb_anfrage(ctx, event_id)
        live_id = str(zeile["live_feed_event_id"]).strip()

        client = self._channex
        try:
            antwort = client.resolve_live_feed_event(live_id, resolution)
        except ChannexError as exc:
            log.warning(
                "airbnb_anfrage_aufloesen_fehlgeschlagen",
                event=zeile.get("event"), live_feed_event_id=live_id,
                error=str(exc)[:200],
            )
            raise ChannelManagerError(
                f"Airbnb hat die Antwort abgelehnt: {exc}", status_code=502
            ) from exc

        db = self._require_db()
        try:
            db.table("channex_webhook_event").update(
                {
                    "resolved": True,
                    "resolution": resolution,
                    "resolved_at": "now()",
                    "resolved_by": getattr(ctx, "user_id", None),
                }
            ).eq("id", event_id).eq("tenant_id", tenant_id).execute()
        except Exception as exc:  # noqa: BLE001 — Airbnb hat schon quittiert
            # Der Seiteneffekt ist passiert; unsere Quittung fehlt nur lokal.
            # Nicht werfen, sonst versucht der Betrieb es erneut und schickt
            # dieselbe Entscheidung zweimal an Airbnb.
            log.warning(
                "airbnb_anfrage_quittung_fehlgeschlagen",
                event_id=event_id, error=str(exc)[:200],
            )
        return antwort if isinstance(antwort, dict) else {}

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
