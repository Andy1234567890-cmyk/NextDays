"""Airbnb-OAuth-Flow (white-label).

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from typing import Any, TypeVar
from uuid import uuid4

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

        `property_id` ist PFLICHT — auch für den Wechselkunden, der eigentlich
        nur übernehmen will. Grund ist Channex, nicht unsere Wahl: der
        Airbnb-Flow braucht ein Objekt, an dem die Autorisierung hängt.
        Live geprüft gegen app.channex.io (04.08.2026):
          POST meta/airbnb/connection_link ohne `properties`  → 422
          dito mit `properties: []`                           → 422
              {"properties": ["should have at least 1 item(s)"]}
          dito mit genau einem Property                       → 200 + OAuth-URL
        `POST channels` selbst akzeptiert 0 Properties (201) — der Kanal wäre
        also anlegbar, aber der Link, den der Kunde braucht, nicht. Ein
        objektloser Start hinterließe deshalb nur einen tauben Kanal bei Channex.
        `property_mapping: "multiple"` im Katalog widerspricht dem nicht: es
        sagt, dass EIN Kanal MEHRERE Objekte tragen darf — nicht, dass er mit
        keinem beginnen darf.

        Der Zirkelschluss ("zum Importieren erst anlegen, was man importieren
        will") ist damit nicht auflösbar, aber auf EIN Objekt begrenzt: das
        erste Objekt trägt die Autorisierung, alle weiteren Listings kommen
        danach über `reconcile_properties_for_tenant` von selbst — der Kanal
        wird per PUT channels/{id} um deren Properties erweitert (ebenfalls live
        geprüft: HTTP 200). Niemand muss Listing für Listing abtippen.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._OAUTH_PORTALS:
            raise ChannelManagerError(
                "Dieses Portal nutzt keinen OAuth-Verbindungsweg.", status_code=400
            )

        # Fail-closed VOR dem ersten Channex-Aufruf (Wurzel 5): ohne Objekt
        # liefert connection_link ohnehin 422, ein vorher angelegter Kanal wäre
        # dann ein tauber Rest bei Channex. Die Meldung nennt den Grund und den
        # nächsten Schritt — der Kunde soll nicht raten, warum "Verbinden" nicht
        # geht, während daneben "Objekte übernehmen" steht.
        if not property_id:
            raise ChannelManagerError(
                "Airbnb verbindet sich immer über ein Objekt. Lege dein erstes "
                "Objekt an (Name und Art genügen) und verbinde Airbnb dort — "
                "deine weiteren Airbnb-Objekte holst du danach mit "
                "„Objekte übernehmen“, ohne sie einzeln anzulegen.",
                status_code=422,
            )

        # Registrierung NACHHOLEN statt 409 zu werfen. Vorher stand hier
        # `_require_property_mapping`, das eine bestehende Registrierung
        # verlangte — dadurch scheiterte jeder Airbnb-Connect eines noch nicht
        # registrierten Objekts mit "Objekt ist noch nicht mit dem
        # Channel-Manager verbunden" (im Serverlog belegt), obwohl der Nutzer
        # nichts falsch gemacht hatte: Verbinden IST der Schritt, der die
        # Registrierung auslösen soll.
        #
        # Zwei Wege, weil zwei Zustände möglich sind:
        #  - Objekt mit Preisplan → `_ensure_property_registered` (der normale
        #    Content-Sync mit Zimmertyp und Raten, damit später verkauft werden
        #    kann).
        #  - Gerüst der Airbnb-Übernahme (kein Preis, verkauft nichts) → der
        #    preisfreie Weg. `sync_content` bräche hier mit 422 ab, und ein
        #    erfundener Preis ist verboten (Wurzel 4). Der echte Preis kommt aus
        #    dem Airbnb-Listing, also NACH der Autorisierung.
        channex_property_id = self._lookup_property_mapping(
            db, tenant_id, property_id
        )
        if channex_property_id is None:
            self._registrierung_nachholen(db, tenant_id, property_id)
            channex_property_id = self._require_property_mapping(
                db, tenant_id, property_id
            )

        # Idempotenz (Wurzel 2): existiert für (property_id, portal_code) bereits ein
        # Channex-Kanal, ihn wiederverwenden statt bei Doppelklick/Retry einen zweiten
        # anzulegen (sonst verwaister Zweit-Kanal bei Channex vor dem DB-UNIQUE).
        existing = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        existing_channel_id = (
            existing[0].get("channex_channel_id") if existing else None
        )

        group_id = self._require_group(db, tenant_id, channex_property_id)
        channel_title = title or self._portal_label(portal_code)

        # Jeden Channex-Aufruf dieses Starts in channex_debug_log schreiben
        # (Kanal-Anlage, Token-Tausch, connection_link). Ohne den Trace-Kontext
        # schreibt der Sink nichts, und Fehler dieses Pfads waren nur im
        # Serverlog sichtbar — nicht im Debug-Bereich der Anwendung.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="oauth_begin"
        )

        if existing_channel_id:
            channel_id = existing_channel_id
        else:
            # 1) Channel inaktiv anlegen (ohne rate_plans/settings — Mapping folgt).
            attribute: dict[str, Any] = {
                "channel": portal_code,
                "group_id": group_id,
                "is_active": False,
                "title": channel_title,
                "properties": [channex_property_id],
            }
            try:
                created = self._channex.create_channel(attribute)
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            channel_id = (created.get("data") or {}).get("id")
            if not channel_id:
                raise ChannelManagerError(
                    "Channex hat keinen Kanal angelegt.", status_code=502
                )
            # SOFORT persistieren, nicht erst am Ende (Wurzel 2). Bricht der
            # Link-Aufruf danach ab, existierte der Channex-Kanal, aber keine
            # DB-Zeile — und der nächste Klick legte einen ZWEITEN an. Genau so
            # entstanden vier leere Airbnb-Kanäle für einen Betrieb.
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

        # Offene Pflichtpunkte prüfen, BEVOR der Kunde zu Airbnb geschickt wird.
        # Channex gibt den Connect nur frei, wenn der Kanal vollständig ist
        # ("Once all required fields are filled, the Connect to Airbnb button
        # becomes active"). Fehlt etwas, entstehen Kanal und Link trotzdem —
        # aber es kommen nie Tokens, und der Kunde wartet ohne Grund. Best
        # effort: ein Fehler dieser Prüfung darf den Connect nicht blockieren.
        try:
            offen = self._channex.check_readiness(channel_id)
            if offen:
                log.warning(
                    "channex_oauth_readiness_offen",
                    tenant_id=tenant_id, property_id=property_id,
                    channel_id=channel_id, offene_punkte=offen,
                )
        except ChannexError as exc:  # noqa: BLE001 — nur Diagnose
            log.warning(
                "channex_oauth_readiness_pruefung_fehlgeschlagen",
                tenant_id=tenant_id, channel_id=channel_id,
                error=exc.message,
            )

        # 2) Frischer JWT (pro Connect, kein Cache) → echte OAuth-URL.
        try:
            one_time = self._channex.create_one_time_token(
                property_id=channex_property_id,
                group_id=group_id,
                username=ctx.user_id,
            )
            jwt = self._channex.exchange_one_time_token(one_time)
            # Frische request_id je Versuch (NICHT die channel_id): Channex
            # korreliert damit seine Rückmeldung zu genau diesem Autorisierungs-
            # Versuch. Vorher stand hier die Kanal-ID, und die Autorisierung
            # landete an keinem Kanal — alle blieben ohne Tokens.
            request_id = str(uuid4())
            oauth_url = self._channex.create_airbnb_connection_link(
                jwt=jwt,
                connection_link=airbnb_oauth.connection_link_body(
                    group_id=group_id,
                    channex_property_id=channex_property_id,
                    channel_id=channel_id,
                    request_id=request_id,
                    title=channel_title,
                    settings=settings,
                ),
            )
            log.info(
                "channex_oauth_link_erzeugt",
                tenant_id=tenant_id, property_id=property_id,
                channel_id=channel_id, request_id=request_id,
                group_id=group_id,
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

    def _registrierung_nachholen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> None:
        """Objekt bei Channex registrieren, damit der OAuth-Start greifen kann.

        Ein Objekt MIT Preisplan läuft über den normalen Content-Sync
        (`_ensure_property_registered`): Property, Zimmertyp und Raten entstehen,
        damit später wirklich verkauft werden kann.

        Ein Objekt OHNE Preisplan ist das Gerüst der Airbnb-Übernahme. Es
        verkauft nichts (`status='draft'`) und trägt nur die Autorisierung; seine
        echten Daten und Preise kommen aus dem Airbnb-Listing, also erst NACH
        diesem Schritt. Für es wird nur die Channex-Property angelegt — ohne
        Zimmertyp/Rate, weil dafür ein Preis nötig wäre und ein erfundener
        verboten ist (Wurzel 4).
        """
        hat_preis = bool(
            (
                db.table("rate_plans")
                .select("id")
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data
        )
        if hat_preis:
            self._ensure_property_registered(db, tenant_id, property_id)
            return

        prop = (
            db.table("properties")
            .select("title, currency")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        titel = str(prop[0].get("title") or "").strip()
        if not titel:
            raise ChannelManagerError(
                "Objekt hat keinen Titel.", status_code=422
            )

        # Währung: Objekt zuerst (properties.currency, 0161 — die Wahrheit),
        # sonst die des Betriebs. Fehlt beides, ist das ein Datenfehler → klar
        # fehlschlagen statt "EUR" zu raten (Wurzel 4); Channex verlangt die
        # Währung an der Property.
        waehrung = prop[0].get("currency") or self._tenant_currency(
            db, tenant_id
        )
        if not waehrung:
            raise ChannelManagerError(
                "Für diesen Betrieb ist keine Währung hinterlegt. Ergänze sie "
                "unter „Konto“, dann kann das Portal verbunden werden.",
                status_code=422,
            )

        # Verwaiste Channex-Property wiederverwenden, statt eine zweite anzulegen
        # (Wurzel 2). Real passiert: `_upsert_channex_property` legt bei Channex
        # an und schreibt DANACH die Map-Zeile. Bricht der Ablauf dazwischen ab
        # (z.B. connection_link scheitert), bleibt die Property bei Channex, aber
        # unsere Map ist leer — der nächste Klick legte dann die nächste an. So
        # entstanden für EIN Objekt drei Channex-Properties „Airbnb-Übernahme
        # läuft", die im Channex-UI nicht unterscheidbar sind.
        verwaist = self._verwaiste_channex_property(db, tenant_id, titel)
        if verwaist:
            db.table("channex_property_map").insert({
                "tenant_id": tenant_id,
                "property_id": property_id,
                "channex_property_id": verwaist,
                "sync_enabled": True,
                "last_sync_status": "ok",
                "last_sync_error": None,
            }).execute()
            log.info(
                "channex_verwaiste_property_wiederverwendet",
                tenant_id=tenant_id, property_id=property_id,
                channex_property_id=verwaist,
            )
            return

        self._upsert_channex_property(
            db, tenant_id, property_id, titel, str(waehrung).upper()
        )
        log.info(
            "channex_registrierung_ohne_preis",
            tenant_id=tenant_id, property_id=property_id,
        )

    def _verwaiste_channex_property(
        self, db: Client, tenant_id: str, titel: str
    ) -> str | None:
        """Channex-Property, die zu diesem Titel gehört, aber in KEINER Map-Zeile
        steht — Rest eines abgebrochenen Registrierungs-Versuchs.

        Nur solche gelten als verwaist: eine Property, die noch irgendwo
        zugeordnet ist, wird nie angefasst (fail-closed, Wurzel 5). Channex-Ausfall
        → None, dann läuft der normale Anlege-Pfad und im schlimmsten Fall
        entsteht wieder eine Zweit-Property; das ist besser, als eine fremde zu
        kapern."""
        try:
            live = self._channex.list_properties().get("data") or []
        except ChannexError:
            return None

        vergeben = {
            zeile["channex_property_id"]
            for zeile in (
                db.table("channex_property_map")
                .select("channex_property_id")
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
        }
        for eintrag in live:
            pid = eintrag.get("id")
            attrs = eintrag.get("attributes") or {}
            if pid and pid not in vergeben and attrs.get("title") == titel:
                return str(pid)
        return None

    @staticmethod
    def _tenant_currency(db: Client, tenant_id: str) -> str | None:
        """Währung des Betriebs (`tenants.currency`) — Rückfall für ein Objekt
        ohne eigene Währung. Kein Default: fehlt sie, gibt None zurück und der
        Aufrufer meldet einen Datenfehler statt zu raten."""
        res = (
            db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return res[0].get("currency") if res else None

    def refresh_channel_oauth_status(
        self, ctx: AuthContext, *, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Verbindungsstatus aus Channex lesen (Poll — Channex liefert keine
        Channel-Webhooks). Schreibt host_id/Status in channex_channel_connection
        → Realtime-Update. `is_active` bleibt false bis Mapping+activate."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        def _scope(frage: _Q) -> _Q:
            """Denselben Scope auf Lese- und Schreibpfad anwenden — getrennt
            formuliert wäre er beim nächsten Eingriff auseinandergelaufen."""
            return (
                frage.eq("tenant_id", tenant_id)
                .eq("ota_portal_code", portal_code)
                .eq("property_id", property_id)
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
        # Trace-Kontext setzen, damit die ANTWORT von Channex in
        # channex_debug_log landet. Ohne ihn schrieb der Sink nichts (er braucht
        # einen Tenant) — und genau dieser Antwortinhalt ist der einzige Ort, an
        # dem steht, WARUM eine Autorisierung nicht zustande kommt. Ohne das Log
        # war der Fehler nur an der endlos wartenden UI zu erkennen.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="oauth_status"
        )
        try:
            got = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            # Kanal bei Channex weg (404) → die lokale Zeile ist entwertet und
            # wird GESCHLOSSEN (Gegenzustand, Wurzel 1). Ohne das fragte der
            # Status-Poll endlos denselben verschwundenen Kanal ab: im Log
            # hunderte 404er im Sekundentakt, die auf das kontoweite
            # Channex-Ratelimit gehen, und die UI wartete auf eine Bestätigung,
            # die niemals kommen kann. Passiert real, wenn die zugehörige
            # Channex-Property entfernt wird — Channex räumt ihre Kanäle mit.
            if exc.status_code == 404:
                _scope(
                    db.table("channex_channel_connection").update({
                        "channex_channel_id": None,
                        "is_active": False,
                        "last_error": "Der Kanal existiert beim Channel-Manager "
                                      "nicht mehr. Bitte neu verbinden.",
                    })
                ).execute()
                log.warning(
                    "channex_oauth_kanal_verschwunden",
                    tenant_id=tenant_id, property_id=property_id,
                    channel_id=channel_id,
                )
                raise ChannelManagerError(
                    "Die Portal-Verbindung besteht nicht mehr. Verbinde Airbnb "
                    "erneut — der bisherige Kanal wurde beim Channel-Manager "
                    "entfernt.",
                    status_code=409,
                ) from exc
            raise self._wrap_channex(exc) from exc

        status = airbnb_oauth.parse_connection_status(got)
        host_id = status["host_id"]
        connected = status["connected"]
        last_error = status["last_error"]
        # Die vollständigen Channel-Settings mitloggen: dort stehen `tokens`,
        # `token_invalid` und alles, was Channex vom Portal zurückmeldet. Nur so
        # ist nachvollziehbar, ob das Portal abgelehnt hat oder der Kunde die
        # Autorisierung noch nicht abgeschlossen hat.
        log.info(
            "channex_oauth_status_roh",
            tenant_id=tenant_id, property_id=property_id,
            channel_id=channel_id, connected=connected, host_id=host_id,
            settings=((got.get("data") or {}).get("attributes") or {}).get(
                "settings"
            ),
        )

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
            # Durchreichen, nicht nur speichern: die UI muss den Grund zeigen
            # können, statt endlos "warten" anzuzeigen (Wurzel 5).
            "last_error": last_error,
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
        #
        # Die Settings kommen vom KANAL bei Channex (dort liegen die Tokens).
        # Vorher stand hier `{"hotel_id": ota_hotel_id}` — ein Feld, das der
        # Airbnb-Katalog überhaupt nicht kennt (`params` = code, email,
        # min_stay_type, send_email_notifications, booking_amount_settings,
        # cohost_payout_calculations). Bei OAuth steckt die Konto-Identität in
        # den Tokens, nicht in einer Kennung; mit dem falschen Feld antwortet
        # Channex mit 400.
        kanal_settings = self._oauth_channel_settings(
            db, tenant_id, property_id, portal_code
        )
        settings = self._inject_sandbox_settings(
            portal_code, property_id,
            kanal_settings or {"hotel_id": row[0].get("ota_hotel_id")},
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
