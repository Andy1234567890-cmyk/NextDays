"""Airbnb-OAuth-Flow (white-label).

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from . import airbnb_oauth
from .channex_client import ChannexError
from .common import ChannelManagerError, log


class OAuthChannelsMixin:
    """Airbnb-OAuth-Flow (white-label)."""


    # -- Airbnb-OAuth (white-label, ohne iFrame) -------------------------------
    # Airbnb hat kein eingebbares Credential; Verbindung über eine echte
    # airbnb.com-OAuth-URL (Kunde öffnet sie selbst ODER schickt sie dem
    # Eigentümer). Flow: Channel inaktiv anlegen → OAuth-URL holen → (Kunde
    # autorisiert) → Status pollen → Mapping + activate über den bestehenden Pfad.
    # Verifiziert: docs/CHANNEX-FELDER.md §4a.
    def begin_channel_oauth(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        title: str | None, settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """OAuth-Start: inaktiven Channel anlegen + echte OAuth-URL erzeugen.

        Gibt {channel_id, oauth_url, portal, status:"pending"} zurück. Der Kunde
        öffnet die URL oder schickt sie dem Eigentümer; Mapping/activate folgen
        nach erfolgreicher Verbindung (refresh_channel_oauth_status → finalize)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._OAUTH_PORTALS:
            raise ChannelManagerError(
                "Dieses Portal nutzt keinen OAuth-Verbindungsweg.", status_code=400
            )

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)

        # Idempotenz (Wurzel 2): existiert für (property_id, portal_code) bereits ein
        # Channex-Kanal, ihn wiederverwenden statt bei Doppelklick/Retry einen zweiten
        # anzulegen (sonst verwaister Zweit-Kanal bei Channex vor dem DB-UNIQUE).
        existing = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        existing_channel_id = (
            existing[0].get("channex_channel_id") if existing else None
        )

        group_id = self._require_group(db, tenant_id, channex_property_id)
        channel_title = title or self._portal_label(portal_code)

        if existing_channel_id:
            channel_id = existing_channel_id
        else:
            # 1) Channel inaktiv anlegen (ohne rate_plans/settings — Mapping folgt).
            try:
                created = self._channex.create_channel(
                    {
                        "channel": portal_code,
                        "group_id": group_id,
                        "is_active": False,
                        "title": channel_title,
                        "properties": [channex_property_id],
                    }
                )
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            channel_id = (created.get("data") or {}).get("id")
            if not channel_id:
                raise ChannelManagerError(
                    "Channex hat keinen Kanal angelegt.", status_code=502
                )

        # 2) Frischer JWT (pro Connect, kein Cache) → echte OAuth-URL.
        try:
            one_time = self._channex.create_one_time_token(
                property_id=channex_property_id,
                group_id=group_id,
                username=ctx.user_id,
            )
            jwt = self._channex.exchange_one_time_token(one_time)
            oauth_url = self._channex.create_airbnb_connection_link(
                jwt=jwt,
                connection_link=airbnb_oauth.connection_link_body(
                    group_id=group_id,
                    channex_property_id=channex_property_id,
                    channel_id=channel_id,
                    title=channel_title,
                    settings=settings,
                ),
            )
        except ChannexError as exc:
            # Channel bleibt angelegt (inaktiv) — der Kunde kann den Link erneut
            # anfordern; nichts geht verloren.
            raise self._wrap_channex(exc) from exc

        # 3) Verbindung persistieren (noch nicht verbunden: kein host_id, inaktiv).
        self._save_oauth_connection(
            db, tenant_id,
            property_id=property_id,
            channex_property_id=channex_property_id,
            portal_code=portal_code,
            channel_id=channel_id,
            host_id=None,
            is_active=False,
            last_error=None,
        )
        log.info(
            "channex_oauth_begin",
            tenant_id=tenant_id, property_id=property_id,
            portal_code=portal_code, channel_id=channel_id,
        )
        return {
            "channel_id": channel_id,
            "oauth_url": oauth_url,
            "portal": self._portal_label(portal_code),
            "status": "pending",
        }

    def refresh_channel_oauth_status(
        self, ctx: AuthContext, *, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Verbindungsstatus aus Channex lesen (Poll — Channex liefert keine
        Channel-Webhooks). Schreibt host_id/Status in channex_channel_connection
        → Realtime-Update. `is_active` bleibt false bis Mapping+activate."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        row = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        if not row or not row[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Keine OAuth-Verbindung für dieses Objekt.", status_code=404
            )
        channel_id = row[0]["channex_channel_id"]
        try:
            got = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        status = airbnb_oauth.parse_connection_status(got)
        host_id = status["host_id"]
        connected = status["connected"]
        last_error = status["last_error"]

        # host_id/Fehler persistieren (Realtime). is_active NICHT hier setzen.
        db.table("channex_channel_connection").update(
            {"ota_hotel_id": host_id, "last_error": last_error}
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).eq(
            "ota_portal_code", portal_code
        ).execute()
        log.info(
            "channex_oauth_status",
            tenant_id=tenant_id, property_id=property_id,
            portal_code=portal_code, connected=connected,
        )
        return {
            "connected": connected,
            "host_id": host_id,
            "portal": self._portal_label(portal_code),
        }

    def finalize_oauth_channel(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        mappings: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Nach erfolgreicher OAuth-Verbindung: Mapping setzen + Channel aktivieren.

        Nutzt update_channel (statt create) auf dem in begin_channel_oauth
        angelegten Channel, dann activate. Erst danach is_active=true."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if not mappings:
            raise ChannelManagerError(
                "Mindestens eine Zimmer/Raten-Zuordnung ist nötig.", status_code=422
            )
        row = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        if not row or not row[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Keine OAuth-Verbindung für dieses Objekt.", status_code=404
            )
        channel_id = row[0]["channex_channel_id"]

        rate_plans = self._build_rate_plans(db, tenant_id, portal_code, mappings)

        # Mapping auf den bestehenden Channel setzen + aktivieren.
        try:
            self._channex.update_channel(channel_id, {"rate_plans": rate_plans})
            self._channex.activate_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        db.table("channex_channel_connection").update(
            {"is_active": True, "last_error": None}
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).eq(
            "ota_portal_code", portal_code
        ).execute()

        # Initial-Vollimport (best effort) wie beim credential-Connect.
        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)
        try:
            self.import_bookings_for_property(tenant_id, channex_property_id)
            self.import_rooms_rates_for_property(tenant_id, channex_property_id)
            self.import_ari_for_property(tenant_id, channex_property_id)
        except (ChannexError, ChannelManagerError) as exc:
            log.warning(
                "channex_oauth_initial_import_failed",
                channex_property_id=channex_property_id,
                error=getattr(exc, "message", str(exc)),
            )
        log.info(
            "channex_oauth_finalize",
            tenant_id=tenant_id, property_id=property_id, channel_id=channel_id,
        )
        return {
            "id": channel_id,
            "portal": self._portal_label(portal_code),
            "title": self._portal_label(portal_code),
            "is_active": True,
        }

    def _save_oauth_connection(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, channel_id: str,
        host_id: str | None, is_active: bool, last_error: str | None,
    ) -> None:
        """Upsert einer OAuth-Verbindung (Airbnb): kein hotel_id-Credential, sondern
        host_id (erst nach Verbindung). Anders als _save_channel_connection, das
        eine eingegebene Hotel-ID voraussetzt."""
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_property_id,
            "ota_portal_code": portal_code,
            "ota_hotel_id": host_id,
            "channex_channel_id": channel_id,
            "is_active": is_active,
            "last_error": last_error,
        }
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict="property_id,ota_portal_code"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz darf Connect nicht killen
            log.warning(
                "channex_oauth_connection_persist_failed",
                property_id=property_id, portal_code=portal_code, error=str(exc),
            )
