"""Airbnb-OAuth-Flow (white-label).

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from typing import Any, TypeVar

from supabase import Client

from src.core.security import AuthContext

from . import airbnb_oauth
from .channex_client import ChannexError
from .common import ChannelManagerError, log

# PostgREST-Query-Builder. Select- und Update-Builder haben keinen gemeinsamen
# Basistyp in den Stubs, tragen aber beide `.eq()`/`.is_()` und geben sich selbst
# zurück — ein TypeVar hält deshalb den konkreten Typ über den Scope-Helfer
# hinweg fest, ohne ihn auf `Any` zu verlieren.
_Q = TypeVar("_Q")


class OAuthChannelsMixin:
    """Airbnb-OAuth-Flow (white-label)."""


    # -- Airbnb-OAuth (white-label, ohne iFrame) -------------------------------
    # Airbnb hat kein eingebbares Credential; Verbindung über eine echte
    # airbnb.com-OAuth-URL (Kunde öffnet sie selbst ODER schickt sie dem
    # Eigentümer). Flow: Channel inaktiv anlegen → OAuth-URL holen → (Kunde
    # autorisiert) → Status pollen → Mapping + activate über den bestehenden Pfad.
    # Verifiziert: docs/CHANNEX-FELDER.md §4a.
    def begin_channel_oauth(
        self, ctx: AuthContext, *, property_id: str | None, portal_code: str,
        title: str | None, settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """OAuth-Start: inaktiven Channel anlegen + echte OAuth-URL erzeugen.

        Gibt {channel_id, oauth_url, portal, status:"pending"} zurück. Der Kunde
        öffnet die URL oder schickt sie dem Eigentümer; Mapping/activate folgen
        nach erfolgreicher Verbindung (refresh_channel_oauth_status → finalize).

        `property_id` ist OPTIONAL — das ist der Weg des WECHSELKUNDEN: er will
        seine bestehenden Airbnb-Objekte übernehmen und hat deshalb noch keins,
        an das ein Kanal hängen könnte. Ein Pflicht-Objekt war hier ein
        Zirkelschluss: zum Importieren erst anlegen, was man importieren will.
        Möglich ist der objektlose Kanal, weil der Channex-Katalog für Airbnb
        `property_mapping: "multiple"` liefert — ein Kanal trägt mehrere Objekte.
        Nach dem Autorisieren spiegelt Channex die Listings, und
        `reconcile_properties_for_tenant` legt daraus die Objekte an (EIN
        Import-Weg, kein zweiter).
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._OAUTH_PORTALS:
            raise ChannelManagerError(
                "Dieses Portal nutzt keinen OAuth-Verbindungsweg.", status_code=400
            )

        channex_property_id = (
            self._require_property_mapping(db, tenant_id, property_id)
            if property_id
            else None
        )

        # Idempotenz (Wurzel 2): existiert für (property_id, portal_code) bereits ein
        # Channex-Kanal, ihn wiederverwenden statt bei Doppelklick/Retry einen zweiten
        # anzulegen (sonst verwaister Zweit-Kanal bei Channex vor dem DB-UNIQUE).
        frage = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
        )
        # Ohne Objekt (Wechselkunde) ist der Kanal der KONTO-Kanal des Portals —
        # dann darf die Suche nicht auf ein Objekt filtern, sonst legt jeder
        # Klick einen weiteren Kanal bei Channex an (Wurzel 2).
        frage = (
            frage.eq("property_id", property_id)
            if property_id
            else frage.is_("property_id", "null")
        )
        existing = frage.limit(1).execute().data
        existing_channel_id = (
            existing[0].get("channex_channel_id") if existing else None
        )

        group_id = self._require_group(db, tenant_id, channex_property_id)
        channel_title = title or self._portal_label(portal_code)

        if existing_channel_id:
            channel_id = existing_channel_id
        else:
            # 1) Channel inaktiv anlegen (ohne rate_plans/settings — Mapping folgt).
            attribute: dict[str, Any] = {
                "channel": portal_code,
                "group_id": group_id,
                "is_active": False,
                "title": channel_title,
            }
            # `properties` NUR mitschicken, wenn es ein Objekt gibt. Beim
            # Wechselkunden-Connect existiert keins — eine Liste mit `null`
            # darin wäre für Channex ein Bad Request, eine leere Liste würde den
            # Kanal an KEIN Objekt binden und ihn beim späteren Mapping
            # überschreiben (PUT ersetzt, kein Merge).
            if channex_property_id:
                attribute["properties"] = [channex_property_id]
            try:
                created = self._channex.create_channel(attribute)
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
        self, ctx: AuthContext, *, property_id: str | None, portal_code: str
    ) -> dict[str, Any]:
        """Verbindungsstatus aus Channex lesen (Poll — Channex liefert keine
        Channel-Webhooks). Schreibt host_id/Status in channex_channel_connection
        → Realtime-Update. `is_active` bleibt false bis Mapping+activate.

        Ohne `property_id` wird die KONTO-Verbindung gepollt (Wechselkunde, der
        Airbnb vor dem ersten Objekt autorisiert hat)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        def _scope(frage: _Q) -> _Q:
            """Denselben Scope auf Lese- und Schreibpfad anwenden — getrennt
            formuliert wäre er beim nächsten Eingriff auseinandergelaufen."""
            frage = frage.eq("tenant_id", tenant_id).eq(
                "ota_portal_code", portal_code
            )
            return (
                frage.eq("property_id", property_id)
                if property_id
                else frage.is_("property_id", "null")
            )

        row = (
            _scope(
                db.table("channex_channel_connection").select("channex_channel_id")
            )
            .limit(1)
            .execute()
        ).data
        if not row or not row[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Keine OAuth-Verbindung gefunden.", status_code=404
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
        _scope(
            db.table("channex_channel_connection").update(
                {"ota_hotel_id": host_id, "last_error": last_error}
            )
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

        # OTA-Zimmer/Raten holen: die Zuordnung erfolgt auf Zimmer-Ebene, jede Rate
        # des OTA-Zimmers muss gemappt werden — _build_rate_plans expandiert das.
        settings = self._inject_sandbox_settings(
            portal_code, property_id, {"hotel_id": row[0].get("ota_hotel_id")}
        )
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        ota_rooms = self._normalize_mapping_rooms(details)

        rate_plans = self._build_rate_plans(
            db, tenant_id, portal_code, mappings, ota_rooms
        )

        # Mapping auf den bestehenden Channel setzen + aktivieren. PUT ERSETZT das
        # rate_plans-Array (verifiziert, kein Merge) → bestehende Einträge per GET
        # lesen und die neuen anhängen, damit weitere Zimmer unter derselben
        # Verbindung nicht verloren gehen (Wurzel 1). Idempotent: schon vorhandene
        # rate_plan_ids werden nicht dupliziert (Wurzel 2).
        merged = self._merge_channel_rate_plans(channel_id, rate_plans)
        try:
            self._channex.update_channel(channel_id, {"rate_plans": merged})
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
        self, db: Client, tenant_id: str, *, property_id: str | None,
        channex_property_id: str | None, portal_code: str, channel_id: str,
        host_id: str | None, is_active: bool, last_error: str | None,
    ) -> None:
        """Upsert einer OAuth-Verbindung (Airbnb): kein hotel_id-Credential, sondern
        host_id (erst nach Verbindung). Anders als _save_channel_connection, das
        eine eingegebene Hotel-ID voraussetzt.

        Ohne Objekt (Wechselkunde) ist es die KONTO-Verbindung: `property_id`
        bleibt NULL, und der Konflikt läuft über (tenant_id, ota_portal_code) —
        der Index `..._property_portal_uidx` greift bei NULL nicht, weil NULLs in
        Postgres voneinander verschieden sind. Ohne diesen Wechsel legte jeder
        Klick eine zweite Zeile und damit einen zweiten Kanal an (Wurzel 2)."""
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
        konflikt = (
            "property_id,ota_portal_code" if property_id
            else "tenant_id,ota_portal_code"
        )
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict=konflikt
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz darf Connect nicht killen
            log.warning(
                "channex_oauth_connection_persist_failed",
                property_id=property_id, portal_code=portal_code, error=str(exc),
            )
