"""Ein Portal, ein Objekt — alles, was zu diesem Paar gehört.

Die Kanal-Detailseite zeigt ALLE Objekte eines Portals, die Objekt-Sicht
„Synchronisierung" ALLE Portale eines Objekts. Hier steht das Paar selbst:
unter welcher Kennung dieses Objekt bei diesem Portal läuft, ob dorthin
verkauft wird und wann zuletzt abgeglichen wurde — dasselbe, was Lodgify hinter
dem Stift seiner Kanalzeile zeigt.

Bewusst NICHT enthalten: eine „Inserats-Qualität" — Channex kennt kein solches
Maß (die API-Doku führt „score" nur bei Gästebewertungen, und
`GET /properties/{id}/scores` antwortet am Staging-Server mit 404).

Alle Angaben kommen aus UNSEREN Daten, nicht aus einem Rückruf beim
Aggregator.
"""

from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.jobs.queue import dedup_key, enqueue, try_enqueue_tax_sync

from .channex_client import ChannexError
from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB, AIRBNB_SZENARIEN, SZENARIO_INELIGIBLE


class ObjektKanalMixin:
    """Detailsicht Portal × Objekt (`channel_property_detail`)."""

    def channel_property_detail(
        self, ctx: AuthContext, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Was dieses Objekt bei diesem einen Portal ist und tut.

        Wurzel 3: Objekt per ID NUR mit Tenant-Scope laden. Wurzel 9: derselbe
        Scope wie die Liste — `list_channel_connections` filtert auf
        (tenant_id, property_id), also tut es diese Detailsicht auch.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        prop = load_scoped(
            db,
            "properties",
            property_id,
            tenant_id,
            columns="id, title, currency",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )

        conn_rows = (
            db.table("channex_channel_connection")
            .select(
                "ota_hotel_id, ota_room_type_code, ota_room_title, "
                "channex_channel_id, channex_property_id, is_active, "
                "last_error, updated_at, airbnb_tax_scenario, "
                "airbnb_tax_acknowledged, airbnb_send_user_taxes"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not conn_rows:
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        conn = conn_rows[0]

        map_rows = (
            db.table("channex_property_map")
            .select("id, sync_enabled, last_sync_at, last_sync_status, last_sync_error")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        pmap = map_rows[0] if map_rows else {}

        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "property_id": property_id,
            "property_title": prop.get("title"),
            "currency": prop.get("currency"),
            "hotel_id": conn.get("ota_hotel_id"),
            "ota_room_type_code": conn.get("ota_room_type_code"),
            "ota_room_title": conn.get("ota_room_title"),
            "channel_id": conn.get("channex_channel_id"),
            "is_active": bool(conn.get("is_active")),
            "last_error": conn.get("last_error"),
            "updated_at": conn.get("updated_at"),
            "map_id": pmap.get("id"),
            "sync_enabled": bool(pmap.get("sync_enabled")),
            "last_sync_at": pmap.get("last_sync_at"),
            "last_sync_status": pmap.get("last_sync_status"),
            "last_sync_error": pmap.get("last_sync_error"),
            "property_photo": self._cover_photo(db, property_id),
            "rate_plans": self._rate_plans_of_property(db, tenant_id, property_id),
            "dynamic_pricing_enabled": self._dynamic_pricing_enabled(
                db, property_id
            ),
            # Preisänderung dieses Portals (Lodgify-Modell): der offset_percent
            # des automatisch gepflegten Kanal-Plans; 0 = kein Aufschlag.
            "price_adjustment_percent": self._portal_adjustment_percent(
                db, property_id, portal_code
            ),
            # Airbnb-Steuererhebung. Nur bei Airbnb gepflegt; bei anderen
            # Portalen bleiben die Werte auf ihren Spalten-Defaults und die
            # Oberfläche zeigt den Block nicht.
            "airbnb_tax_scenario": conn.get("airbnb_tax_scenario"),
            "airbnb_tax_acknowledged": bool(conn.get("airbnb_tax_acknowledged")),
            "airbnb_send_user_taxes": bool(conn.get("airbnb_send_user_taxes")),
        }

    def set_airbnb_tax_settings(  # pylint: disable=too-many-arguments
        self,
        ctx: AuthContext,
        property_id: str,
        portal_code: str,
        *,
        scenario: str | None,
        acknowledged: bool,
        send_user_taxes: bool,
    ) -> dict[str, Any]:
        """Airbnb-Steuererhebung dieses Inserats pflegen.

        Drei Werte, wie im Branchenstandard: das Szenario (was Airbnb selbst
        tut), die Bestätigung, es verstanden zu haben, und der Schalter
        „Benutzungssteuern senden". Erst wenn alle drei passen, gehen Steuern an
        Airbnb (siehe tax_sync._airbnb_steuern_erlaubt).

        Zwei Abhängigkeiten werden hier erzwungen, nicht nur in der Oberfläche
        (Wurzel 3 — der Anfrage nicht vertrauen):

        * `ineligible` heißt, Airbnb erhebt selbst bzw. unterstützt keine
          Beherbergungssteuern — ein Export ist dort GAR NICHT möglich, also
          fallen beide Schalter aus.
        * „Senden" ohne Bestätigung gibt es nicht.
        """
        if portal_code != AIRBNB:
            raise ChannelManagerError(
                "Steuererhebungs-Einstellungen gibt es nur für Airbnb.",
                status_code=422,
            )
        if scenario is not None and scenario not in AIRBNB_SZENARIEN:
            raise ChannelManagerError(
                f"Unbekanntes Steuererhebungsszenario: {scenario}",
                status_code=422,
            )
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # Wurzel 3/9: dieselbe Achse wie die Detailsicht — Tenant UND Objekt.
        vorhanden = (
            db.table("channex_channel_connection")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not vorhanden:
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        if scenario == SZENARIO_INELIGIBLE:
            acknowledged = False
            send_user_taxes = False
        elif not acknowledged:
            send_user_taxes = False
        db.table("channex_channel_connection").update(
            {
                "airbnb_tax_scenario": scenario,
                "airbnb_tax_acknowledged": acknowledged,
                "airbnb_send_user_taxes": send_user_taxes,
            }
        ).eq("id", vorhanden[0]["id"]).execute()
        # Der Schalter ändert, WAS Airbnb bekommt — also muss das Set neu
        # zusammengestellt werden. Ohne diesen Anstoß wirkte die Änderung erst
        # beim nächsten Preis-/Content-Update (Wurzel 1: Gegenzustand pflegen).
        try_enqueue_tax_sync(db, tenant_id, property_id)
        log.info(
            "airbnb_steuererhebung_gesetzt",
            tenant_id=tenant_id,
            property_id=property_id,
            scenario=scenario,
            acknowledged=acknowledged,
            send_user_taxes=send_user_taxes,
        )
        return {
            "portal_code": portal_code,
            "property_id": property_id,
            "airbnb_tax_scenario": scenario,
            "airbnb_tax_acknowledged": acknowledged,
            "airbnb_send_user_taxes": send_user_taxes,
        }

    @staticmethod
    def _portal_adjustment_percent(
        db: Client, property_id: str, portal_code: str
    ) -> float:
        """offset_percent des Kanal-Plans dieses Portals (0 = keiner).

        property_id ist beim Aufrufer bereits tenant-gescoped (Wurzel 3)."""
        rows = (
            db.table("rate_plans")
            .select("offset_percent")
            .eq("property_id", property_id)
            .eq("portal_scope", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return 0.0
        try:
            return float(rows[0].get("offset_percent") or 0)
        except (TypeError, ValueError):
            return 0.0

    def set_portal_price_adjustment(
        self, ctx: AuthContext, property_id: str, portal_code: str,
        percent: float,
    ) -> dict[str, Any]:
        """Preisänderung je Portal setzen (Lodgify-Modell) — EIN Mechanismus.

        Umgesetzt über einen automatisch gepflegten KANAL-PLAN: ein abgeleiteter
        Rate-Plan (derived vom Grundpreis-Plan, offset_percent = Aufschlag,
        `portal_scope` = Portal), dessen Channex-Rate am Kanal dieses Portals
        die Standard-Rate ERSETZT. Damit gilt der Aufschlag auf die komplette
        effektive Tageskurve (inkl. Dynamic Pricing) — der Resolver rechnet
        abgeleitete Kurven längst, der ARI-Push pusht sie längst.

        percent == 0 nimmt den Gegenzustand vollständig zurück (Wurzel 1):
        Mapping zurück auf den Standard, Kanal-Plan gelöscht, Channex-Rest
        über den Content-Sync abgeräumt.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        conn = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not conn or not conn[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        channel_id = conn[0]["channex_channel_id"]

        primary_id = self._primary_rate_plan_id(db, tenant_id, property_id)
        if not primary_id:
            raise ChannelManagerError(
                "Das Objekt hat keinen bei den Portalen registrierten Preisplan.",
                status_code=422,
            )
        standard_rows = (
            db.table("rate_plans")
            .select("id, name, base_price, currency, min_stay")
            .eq("id", primary_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not standard_rows:
            raise ChannelManagerError(
                "Grundpreis-Plan nicht gefunden.", status_code=422
            )
        standard = standard_rows[0]

        kanalplan = (
            db.table("rate_plans")
            .select("id, offset_percent")
            .eq("property_id", property_id)
            .eq("portal_scope", portal_code)
            .limit(1)
            .execute()
        ).data or []

        if percent == 0:
            if kanalplan:
                kp_id = kanalplan[0]["id"]
                # Gegenzustand: ERST das Mapping zurück auf den Standard —
                # ein am Kanal hängender Plan darf nicht gelöscht werden
                # (Löschkette fail-closed), und das Portal braucht lückenlos
                # eine Rate.
                self._swap_channel_rate_plan(
                    db, tenant_id, channel_id,
                    von_lokal=kp_id, nach_lokal=primary_id,
                )
                db.table("rate_plans").delete().eq("id", kp_id).execute()
                # Channex-seitigen Rest abräumen + Kurve neu abgleichen.
                self.sync_content(tenant_id, property_id=property_id)
                self._enqueue_price_reconcile(db, tenant_id, property_id)
            return {"portal_code": portal_code, "percent": 0.0}

        if kanalplan:
            db.table("rate_plans").update({"offset_percent": percent}).eq(
                "id", kanalplan[0]["id"]
            ).execute()
            self.sync_content(tenant_id, property_id=property_id)
        else:
            db.table("rate_plans").insert({
                "property_id": property_id,
                "name": (
                    f"{standard.get('name') or 'Standard'}"
                    f" · {self._portal_label(portal_code)}"
                ),
                "base_price": standard.get("base_price"),
                "currency": standard.get("currency"),
                "min_stay": standard.get("min_stay"),
                "rate_mode": "derived",
                "derived_from_rate_plan_id": primary_id,
                "offset_percent": percent,
                "offset_amount": None,
                # NICHT über die Zusatz-Freigabe mappen — der Kanal-Plan geht
                # ausschließlich über portal_scope an SEIN Portal.
                "send_to_portals": False,
                "portal_scope": portal_code,
            }).execute()
            # Channex-Rate-Plan synchron anlegen — gleich danach wird gemappt.
            self.sync_content(tenant_id, property_id=property_id)
            neu = (
                db.table("rate_plans")
                .select("id")
                .eq("property_id", property_id)
                .eq("portal_scope", portal_code)
                .limit(1)
                .execute()
            ).data or []
            if not neu:
                raise ChannelManagerError(
                    "Kanal-Plan konnte nicht angelegt werden.", status_code=500
                )
            self._swap_channel_rate_plan(
                db, tenant_id, channel_id,
                von_lokal=primary_id, nach_lokal=neu[0]["id"],
            )
        self._enqueue_price_reconcile(db, tenant_id, property_id)
        return {"portal_code": portal_code, "percent": float(percent)}

    def _swap_channel_rate_plan(
        self, db: Client, tenant_id: str, channel_id: str,
        *, von_lokal: str, nach_lokal: str,
    ) -> None:
        """Im rate_plans-Array eines Channex-Kanals jede Zuordnung von einem
        lokalen Plan auf einen anderen umhängen (Standard ↔ Kanal-Plan).

        PUT ersetzt das Array komplett — gelesen wird der Ist-Stand, nur die
        rate_plan_id der betroffenen Einträge wechselt, die OTA-settings
        (Zimmer-/Raten-Codes) bleiben unangetastet (Wurzel 1)."""
        von_cx = self._channex_id_for_local_plan(db, tenant_id, von_lokal)
        nach_cx = self._channex_id_for_local_plan(db, tenant_id, nach_lokal)
        if not von_cx or not nach_cx:
            raise ChannelManagerError(
                "Preisplan ist nicht bei den Portalen registriert.",
                status_code=422,
            )
        try:
            current = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        attrs = (current.get("data") or {}).get("attributes") or {}
        plans = attrs.get("rate_plans") or []
        getauscht = 0
        neu_plans: list[dict[str, Any]] = []
        for p in plans:
            rid = p.get("rate_plan_id")
            if rid == von_cx:
                rid = nach_cx
                getauscht += 1
            neu_plans.append(
                {"rate_plan_id": rid, "settings": p.get("settings") or {}}
            )
        if not getauscht:
            log.warning(
                "portal_adjustment_swap_ohne_treffer",
                channel_id=channel_id, von=von_cx, nach=nach_cx,
            )
            return
        try:
            self._channex.update_channel(channel_id, {"rate_plans": neu_plans})
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    @staticmethod
    def _channex_id_for_local_plan(
        db: Client, tenant_id: str, local_rate_plan_id: str
    ) -> str | None:
        rows = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("local_rate_plan_id", local_rate_plan_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("channex_rate_plan_id") if rows else None

    @staticmethod
    def _enqueue_price_reconcile(
        db: Client, tenant_id: str, property_id: str
    ) -> None:
        """Tageskurve bei Channex neu abgleichen (coalesced, wie rates-Slice)."""
        enqueue(
            db,
            "reconcile_rate_plan_prices",
            tenant_id=tenant_id,
            payload={"tenant_id": tenant_id, "property_id": property_id},
            dedup_key=dedup_key(
                tenant_id, property_id, "reconcile_rate_plan_prices"
            ),
        )

    @staticmethod
    def _dynamic_pricing_enabled(db: Client, property_id: str) -> bool:
        """Ist Dynamic Pricing für das Objekt an? Dann sind die Portalpreise
        die dynamischen Tagespreise — der base_price der Pläne ist nur der
        Anker. Ohne diese Angabe suggeriert die Seite, der statische
        Grundpreis stünde beim Portal. `dp_settings` hat keinen tenant —
        die property_id ist oben bereits tenant-gescoped geladen (Wurzel 3)."""
        rows = (
            db.table("dp_settings")
            .select("enabled")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows and rows[0].get("enabled"))

    @staticmethod
    def _primary_rate_plan_id(
        db: Client, tenant_id: str, property_id: str
    ) -> str | None:
        """Lokaler Plan hinter der ältesten Channex-Zuordnung des Objekts.

        Kette property_map → room_type_maps → älteste rate_plan_map — dieselbe
        Reihenfolge wie `channels._rate_plan_maps_for_property` (dort werden
        Map-IDs gebraucht, hier der lokale Plan dahinter)."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        rt_ids = [r["id"] for r in rts]
        if not rt_ids:
            return None
        rps = (
            db.table("channex_rate_plan_map")
            .select("local_rate_plan_id, created_at")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        return rps[0].get("local_rate_plan_id") if rps else None

    def _cover_photo(self, db: Client, property_id: str) -> str | None:
        """Titelbild des Objekts (Cover, sonst erstes Foto) — sonst None."""
        rows = (
            db.table("property_photos")
            .select("url, is_cover, sort_order")
            .eq("property_id", property_id)
            .order("is_cover", desc=True)
            .order("sort_order")
            .limit(1)
            .execute()
        ).data or []
        return rows[0]["url"] if rows else None

    def _rate_plans_of_property(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Aktive Tarifpläne dieses Objekts, wie sie ans Portal gehen.

        Drei Angaben, weil sie zusammen den Preis erklären: die KONDITION
        (Zahlungs-/Stornoregel, `booking_conditions`), der NAME samt Typ
        (`rate_mode`: eigener Preis oder abgeleitet) und die PREISÄNDERUNG
        (`offset_percent`/`offset_amount` eines abgeleiteten Plans).

        ALLE Tarifpläne des Objekts, nicht nur die freigegebenen: ein Filter auf
        `send_to_portals` ließ die Liste leer wirken, obwohl Pläne existieren —
        die Freigabe steht als eigene Angabe je Zeile.

        Kanal-Pläne (`portal_scope`, 0272) erscheinen NICHT als eigene Zeile:
        ihr Aufschlag ist die „Preisänderung" des Portals und steht in der
        Detailsicht editierbar am Grundpreis-Plan — eine zweite Zeile wäre
        dieselbe Information doppelt (und die anderer Portale falsch).
        """
        plans = (
            db.table("rate_plans")
            .select(
                "id, name, base_price, currency, min_stay, rate_mode, "
                "offset_amount, offset_percent, booking_condition_id, "
                "send_to_portals, portal_scope"
            )
            .eq("property_id", property_id)
            .order("name")
            .execute()
        ).data or []
        plans = [p for p in plans if not p.get("portal_scope")]
        if not plans:
            return []

        bedingungen: dict[str, str] = {}
        cond_ids = [p["booking_condition_id"] for p in plans if p.get("booking_condition_id")]
        if cond_ids:
            for c in (
                db.table("booking_conditions")
                .select("id, internal_name")
                .eq("tenant_id", tenant_id)
                .in_("id", cond_ids)
                .execute()
            ).data or []:
                bedingungen[c["id"]] = c.get("internal_name")

        # Grundpreis-Plan = älteste Channex-Zuordnung (dieselbe Definition wie
        # channels._selected_rate_plan_ids): er geht IMMER ans Portal,
        # `send_to_portals` schaltet nur ZUSÄTZLICHE Pläne frei. Ohne dieses
        # Wissen stünde am Standard-Plan „nicht für Portale freigegeben",
        # obwohl genau er die Portalpreise trägt.
        primary_id = self._primary_rate_plan_id(db, tenant_id, property_id)

        return [
            {
                "id": p["id"],
                "name": p.get("name"),
                "base_price": p.get("base_price"),
                "currency": p.get("currency"),
                "min_stay": p.get("min_stay"),
                "rate_mode": p.get("rate_mode"),
                "offset_amount": p.get("offset_amount"),
                "offset_percent": p.get("offset_percent"),
                "condition": bedingungen.get(p.get("booking_condition_id")),
                "send_to_portals": bool(p.get("send_to_portals")),
                "is_primary": p["id"] == primary_id,
            }
            for p in plans
        ]
