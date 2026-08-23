"""Airbnb-OAuth-Flow (white-label).

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
# pylint: disable=too-many-lines
# 1713 Zeilen (Limit 1500). Der OAuth-Weg jedes Portals ist eine eigene
# Sonderlocke (Airbnb-Zugaenge, Booking, Expedia), und die Faelle teilen den
# Token-/Refresh-/Mapping-Pfad. Getrennt nach Portal waere derselbe Pfad
# dreimal kopiert — die teuerste Fehlerklasse laut ADR-0016.
from __future__ import annotations

from typing import Any, TypeVar
from urllib.parse import urlparse
from uuid import uuid4

from supabase import Client

from src.core.config import get_settings
from src.core.security import AuthContext

from . import airbnb_oauth
from .channex_client import ChannexError
from .common import ChannelManagerError, _timezone_for_country, log
from .ota_konten import (
    kanal_ans_konto_schreiben,
    konto_sicherstellen,
    konto_status_setzen,
    konto_zum_kanal_loesen,
)

# PostgREST-Query-Builder. Select- und Update-Builder haben keinen gemeinsamen
# Basistyp in den Stubs, tragen aber beide `.eq()`/`.is_()` und geben sich selbst
# zurück — ein TypeVar hält deshalb den konkreten Typ über den Scope-Helfer
# hinweg fest, ohne ihn auf `Any` zu verlieren.
_Q = TypeVar("_Q")


def _geprueftes_ziel(url: str | None) -> str | None:
    """Rücksprung-URL nur zu einem erlaubten Frontend-Origin zulassen.

    Sonst wäre der Verbindungslink ein offener Weiterleiter: der Kunde klickt
    einen Link, der nach unserer Domain aussieht, und landet nach dem
    Airbnb-Login irgendwo. Geprüft wird gegen die konfigurierten CORS-Origins —
    kein Hardcode einer Domain im Backend (Wurzel 4), dasselbe Muster wie bei
    Stripe (`payments/identity._validate_return_url`).

    Kein Ziel angegeben = keine Rückleitung. Eine ungültige Angabe ist dagegen
    ein Fehler und wird gemeldet, nicht stillschweigend verworfen (Wurzel 5).
    """
    if not url:
        return None
    zerlegt = urlparse(url)
    if zerlegt.scheme not in ("http", "https") or not zerlegt.netloc:
        raise ChannelManagerError("Ungültige Rücksprung-Adresse.", status_code=422)
    origin = f"{zerlegt.scheme}://{zerlegt.netloc}"
    if origin not in get_settings().cors_origin_list:
        raise ChannelManagerError(
            "Rücksprung-Adresse gehört nicht zu dieser Anwendung.",
            status_code=422,
        )
    return url


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
        neues_konto: bool = False, redirect_uri: str | None = None,
        account_id: str | None = None,
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
        # Die Registrierung GEGENPRÜFEN, nicht nur nachschlagen. Unsere Zeile
        # sagt „registriert", Channex ist aber die Wahrheit: dort kann die
        # Property inzwischen gelöscht sein (von Hand in der Oberfläche, oder
        # weil Channex sie mit einem entfernten Kanal mitnimmt). Unsere
        # Mapping-Zeile bleibt davon unberührt — sie weiß es schlicht nicht.
        #
        # Ohne diese Prüfung ging die tote ID an Channex und der Kanal-Anlage-
        # Aufruf scheiterte mit `422 {"property_id": ["does not exist"]}` (live
        # am 07.08.2026 an `1060923f`, dem Übernahme-Gerüst). Der Kunde sah nur
        # „Unprocessable Entity" und hatte keine Möglichkeit, das zu beheben:
        # die Registrierung, die ihm fehlte, galt bei uns ja als vorhanden.
        if channex_property_id and not self._property_bei_channex_da(
            channex_property_id
        ):
            log.warning(
                "channex_property_verschwunden",
                tenant_id=tenant_id, property_id=property_id,
                channex_property_id=channex_property_id,
            )
            # Gegenzustand (Wurzel 1): die entwertete Zeile schließen, sonst
            # findet der nächste Durchlauf sie wieder und scheitert erneut.
            self._mapping_schliessen(db, tenant_id, channex_property_id)
            channex_property_id = None
        if channex_property_id is None:
            self._registrierung_nachholen(db, tenant_id, property_id)
            channex_property_id = self._require_property_mapping(
                db, tenant_id, property_id
            )

        # Idempotenz (Wurzel 2): existiert für dieses Portal bereits ein
        # Channex-Kanal, ihn WIEDERVERWENDEN statt einen zweiten anzulegen.
        #
        # ACHTUNG — der Scope ist der BETRIEB, nicht das Objekt. Bei Airbnb hängt
        # die Verbindung am Airbnb-KONTO: ein Konto = ein Kanal, und alle Objekte
        # hängen über „Affected Properties" an DIESEM einen Kanal (Channex-
        # Anleitung: „Wenn Sie mehrere Objekte haben, … Fügen Sie alle Objekte
        # dem Kanal hinzu"). Vorher filterte diese Suche auf `property_id` —
        # damit fand ein ZWEITES Objekt den bestehenden Kanal nicht und legte
        # einen neuen an. Airbnb lehnt das ab (nur EINE verbundene Software,
        # Channex-Fehlercode `has_already_channel`), also kam für diesen zweiten
        # Kanal nie eine Autorisierung an — und die UI zeigte fälschlich
        # „in deinem Airbnb-Konto ist bereits eine andere Software verbunden",
        # obwohl WIR selbst diese andere Verbindung waren.
        # Live nachgewiesen am Beta-Betrieb: Objekt e34fc9fb → Kanal 9a46827b
        # (verbunden, Host-ID 529591717), Objekt ed885e62 → Kanal f729554c
        # (leer, ohne Tokens, mit genau dieser irreführenden Meldung).
        vorhandene = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .not_.is_("channex_channel_id", "null")
            .execute()
        ).data or []
        # WELCHER Kanal gewinnt: der AUTORISIERTE — nicht der, der in unserer
        # DB-Zeile steht. Das ist der Kern des Fehlers: sobald für ein Objekt
        # (durch den alten property_id-Filter) ein leerer Zweit-Kanal entstanden
        # war, zeigte dessen eigene Zeile darauf, und jeder weitere Versuch lief
        # wieder in genau diesen leeren Kanal. Der Kunde sah endlos „warte auf
        # die Bestätigung", während die echte Autorisierung am ERSTEN Kanal hing.
        # Live gemessen: 9a46827b hat tokens/host_id 529591717, f729554c ist leer
        # — und das Objekt ed885e62 zeigte auf f729554c.
        # Die Tokens sind die Wahrheit (Airbnb autorisiert das KONTO, also genau
        # einen Kanal), deshalb wird der Kanal-Zustand bei Channex geprüft und
        # nicht geraten.
        kandidaten = sorted(
            {str(r["channex_channel_id"]) for r in vorhandene
             if r.get("channex_channel_id")}
        )
        autorisiert = self._autorisierter_kanal(kandidaten)
        eigener_kanal = next(
            (str(r["channex_channel_id"]) for r in vorhandene
             if r.get("property_id") == property_id
             and r.get("channex_channel_id")),
            None,
        )
        # WELCHES KONTO wird gerade verbunden? Diese Frage entscheidet den Kanal,
        # und sie muss aus einem ZUSTAND beantwortet werden, nicht aus einem
        # Flag des laufenden Requests.
        #
        # Warum: `neues_konto` lebt nur für einen Aufruf. Jeder Folge-Aufruf
        # (Seite neu geladen, Link erneut angefordert, Status geprüft) kam ohne
        # das Flag und fiel unten auf `autorisiert` zurück — also auf den Kanal,
        # der bereits Tokens hat, mithin IMMER auf Konto A.
        #
        # Live gemessen am 07.08.2026 (channex_debug_log, Tenant AirSmil):
        #   13:08:39  connection_link  channel_id 8e3292d3  ← Konto B, richtig
        #   13:09:08  connection_link  channel_id 9a46827b  ← Konto A
        #   13:09:34  connection_link  channel_id 9a46827b  ← Konto A
        #   13:14:35  connection_link  channel_id 9a46827b  ← Konto A
        # Channex merkt sich je Verbindung nur den ZULETZT erzeugten `state`.
        # Der eine richtige Link lebte damit 29 Sekunden; danach führte jeder
        # Link nach Konto A. Kanal 8e3292d3 stand deshalb dauerhaft auf
        # `settings: null` — nie autorisiert —, während der Betrieb dreißigmal
        # bestätigte. Der Fehlgriff hängte zusätzlich das Gerüst per PUT an
        # Kanal A (13:09:07), was dort 19 statt 18 Properties ergab.
        #
        # `account_id` ist der Gegenentwurf: es benennt das Konto explizit, steht
        # in `ota_account` (0304) und überlebt jeden Seitenwechsel.
        if account_id:
            existing_channel_id = self._kanal_des_kontos(
                db, tenant_id, account_id, portal_code
            )
        elif neues_konto:
            # Ein ZWEITES Portal-Konto verbinden (0304): dann darf gerade NICHT
            # wiederverwendet werden. Die Wiederverwendung unten ist richtig,
            # solange es um dasselbe Konto geht — sie war der Fix gegen den
            # leeren Zweit-Kanal. Für ein anderes Konto ist sie die Sperre:
            # `autorisiert` gäbe den Kanal von Konto A zurück, der Kunde landete
            # wieder in dessen Airbnb-Login und käme nie zu Konto B.
            #
            # Airbnb selbst erlaubt das: die Kopplung „nur EINE Software" gilt je
            # KONTO, nicht je Channex-Zugang (`has_already_channel` bezieht sich
            # auf das Airbnb-Konto). Zwei Konten = zwei Kanäle ist der Normalfall
            # jeder Agentur.
            existing_channel_id = None
        else:
            existing_channel_id = autorisiert or eigener_kanal or (
                kandidaten[0] if kandidaten else None
            )
        eigener = existing_channel_id is not None and (
            existing_channel_id == eigener_kanal
        )
        log.info(
            "channex_oauth_kanal_wahl",
            tenant_id=tenant_id, property_id=property_id,
            portal_code=portal_code,
            kanaele_im_betrieb=kandidaten,
            autorisierter_kanal=autorisiert,
            kanal_dieses_objekts=eigener_kanal,
            konto_id=account_id,
            gewaehlt=existing_channel_id,
            grund=(
                "konto benannt" if account_id
                else "neues konto" if neues_konto
                else "autorisiert" if autorisiert
                else "eigene zeile" if eigener_kanal
                else "erster im betrieb" if kandidaten
                else "keiner - neu anlegen"
            ),
            neu_anlegen=existing_channel_id is None,
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
            if not eigener:
                # Der gewählte Kanal ist NICHT der aus der Zeile dieses Objekts:
                # entweder der Kanal eines Geschwister-Objekts oder — der
                # eigentliche Fall — der autorisierte Kanal, während die Zeile
                # noch auf einen leeren Zweit-Kanal zeigte.
                #
                # Beides erfordert dasselbe: das Objekt an diesen Kanal hängen
                # („Affected Properties"), sonst kann seine Airbnb-Anzeige dort
                # nicht zugeordnet werden, UND die Verbindungszeile auf diesen
                # Kanal umschreiben — sonst pollt der Status-Pfad weiter den
                # falschen Kanal und meldet ewig „warte auf die Bestätigung"
                # (Wurzel 1: der Gegenzustand zum Wechsel ist das Nachziehen der
                # alten Zeile).
                self._objekt_an_kanal_haengen(
                    channel_id, channex_property_id
                )
                # KEINE Verbindungszeile, wenn das Konto benannt ist: dann ist
                # `property_id` nur der Aufhänger für den Link und gehört einem
                # ANDEREN Zugang. Eine Zeile darauf behauptet „dieses Objekt
                # verkauft über dieses Konto" — und die Oberfläche zählt es dem
                # falschen Konto zu.
                #
                # Live am 07.08.2026, 13:09:07: das Gerüst bekam hier eine Zeile
                # mit dem Konto von Zugang A und wurde per PUT an dessen Kanal
                # gehängt. Ergebnis: 19 Properties an Kanal A statt 18, und
                # Konto B stand mit null Objekten da, obwohl gerade IHM der
                # Aufhänger dienen sollte.
                host = None
                if not account_id:
                    # Host-ID des gewählten Kanals MITSCHREIBEN. Steht dort None,
                    # zeigt die UI „nicht verbunden", obwohl das Konto
                    # autorisiert ist — der Kanal trägt die Tokens ja bereits
                    # (Wurzel 4: den echten Wert nehmen, nicht leer lassen und
                    # später raten).
                    if channel_id == autorisiert:
                        host = self._kanal_host_id(channel_id)
                    self._save_oauth_connection(
                        db, tenant_id,
                        property_id=property_id,
                        channex_property_id=channex_property_id,
                        portal_code=portal_code,
                        channel_id=channel_id,
                        host_id=host,
                        is_active=False,
                        last_error=None,
                    )
                log.info(
                    "channex_oauth_kanal_geteilt",
                    tenant_id=tenant_id, property_id=property_id,
                    channel_id=channel_id,
                    channex_property_id=channex_property_id,
                    host_id=host,
                    konto_benannt=bool(account_id),
                    war_autorisiert=channel_id == autorisiert,
                )
        elif account_id or neues_konto:
            # NEUE Verbindung: KEINEN Kanal anlegen.
            #
            # Channex legt ihn selbst an, sobald die Autorisierung eintrifft —
            # Airbnb Connection API, Notes: „when the User connects Airbnb to
            # Channex we will automatically create a new inactive Channel."
            # Das Feld `channel_id` im Link gehört ausschließlich zum
            # Wiederverbinden: „Used in case of re-connection flow for already
            # existed channel."
            #
            # Vorher legten wir hier per `POST /channels` selbst einen an und
            # gaben dessen ID mit. Für Channex war das ein Re-Connect auf einen
            # Kanal, der nie autorisiert war — es gab keinen Vorgang, dem die
            # eintreffenden Tokens zuzuordnen gewesen wären. Vier so erzeugte
            # Kanäle blieben nacheinander auf `settings: null` stehen
            # (8e3292d3, 14601790, 9df93e43, da4730bc am 07.08.2026), während
            # Airbnb den Dienst als verbunden führte. Der Kunde bestätigte
            # dreißigmal und es passierte nichts.
            channel_id = None
            log.info(
                "channex_oauth_kanal_ueberlassen",
                tenant_id=tenant_id, property_id=property_id,
                konto_id=account_id,
            )
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
        # Nur, wenn es schon einen Kanal gibt. Bei einer neuen Verbindung
        # entsteht er erst mit der Autorisierung (Channex legt ihn an) — es gibt
        # zu diesem Zeitpunkt nichts zu prüfen.
        if channel_id:
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
            # Womit ordnen wir den Rücksprung wieder zu? Airbnb-Doku zum Feld
            # `token`: „Free form token which can be used to associate incoming
            # redirect with specific User at PMS". Bei einer Agentur mit hundert
            # Zugängen ist das der Unterschied zwischen Zuordnen und Raten —
            # alle hundert Rücksprünge landen sonst auf derselben Seite ohne
            # Hinweis, welcher Vermieter gerade autorisiert hat.
            #
            # Das KONTO, nicht der Kanal: bei einer neuen Verbindung gibt es
            # noch keinen Kanal (Channex legt ihn erst mit der Autorisierung
            # an). Die Kontozeile existiert dagegen schon und überlebt den
            # ganzen Vorgang.
            ziel = _geprueftes_ziel(redirect_uri)
            rueckweg_token = account_id or channel_id
            oauth_url = self._channex.create_airbnb_connection_link(
                jwt=jwt,
                connection_link=airbnb_oauth.connection_link_body(
                    group_id=group_id,
                    channex_property_id=channex_property_id,
                    channel_id=channel_id,
                    request_id=request_id,
                    title=channel_title,
                    settings=settings,
                    konto_token=rueckweg_token,
                    redirect_uri=ziel,
                    # Derselbe Weg zurück, aber mit `success=false` — Channex
                    # hängt das an. Ohne dieses Ziel bliebe der Kunde bei einem
                    # Fehlschlag auf einer Airbnb-Seite stehen und wir erführen
                    # es nie (Wurzel 5).
                    failure_redirect_uri=ziel,
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
        #
        # NICHT beim zweiten Konto: dort ist `property_id` nur der Aufhänger für
        # den Link und gehört einem ANDEREN Zugang. Eine Zeile darauf hieße „das
        # Objekt hängt an diesem Kanal" — die Oberfläche zeigte es daraufhin als
        # „Pausiert" (live am 07.08.2026 an „Rævlingehuset"). Das Konto ist oben
        # schon gespeichert; seine Objekte kommen aus seinen eigenen Listings.
        if not neues_konto and not account_id:
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
            "account_id": account_id,
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

        # GANZE Zeile lesen, nicht nur Titel/Währung: `_property_attrs` baut daraus
        # Adresse, Land, Geo UND die `timezone` (aus dem Land, `_timezone_for_country`).
        # Vorher stand hier `select("title, currency")` und der Upsert unten bekam
        # kein `prop_row` — die Channex-Property entstand also OHNE Zeitzone. Live
        # gemessen am Beta-Betrieb (04.08.2026):
        #     GET properties/cf7ff6f4-… → country='DK', timezone=None
        #     POST channels/{id}/check_readiness →
        #         {"field": "timezone", "error_code": "required", "entity": "Property"}
        # Solange die Readiness-Liste nicht leer ist, gibt Channex den Kanal nicht
        # frei — die Verbindung stand, blieb aber „Disabled". Die Doku führt
        # timezone als optional; maßgeblich ist der Readiness-Check.
        prop = (
            db.table("properties")
            .select("*")
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
            # Die wiederverwendete Property auf den STAND unseres Objekts
            # bringen. Vorher wurde nur die Map-Zeile geschrieben und die
            # Property bei Channex blieb, wie sie beim abgebrochenen Versuch
            # entstand — im Beta-Betrieb hieß das `timezone=None`, und damit
            # meldet Channex' Readiness `timezone required` und der Kanal bleibt
            # „Disabled" (live geprüft: die alte Property cf7ff6f4… hatte keine
            # Zeitzone, die danach neu angelegte f86cb4d8… hatte
            # `Europe/Copenhagen`). Der Upsert ist idempotent und macht aus dem
            # Wiederverwenden ein echtes Aktualisieren (Wurzel 1).
            self._upsert_channex_property(
                db, tenant_id, property_id, titel, str(waehrung).upper(),
                prop_row=prop[0],
            )
            return

        self._upsert_channex_property(
            db, tenant_id, property_id, titel, str(waehrung).upper(),
            prop_row=prop[0],
        )
        log.info(
            "channex_registrierung_ohne_preis",
            tenant_id=tenant_id, property_id=property_id,
            land=prop[0].get("country"),
            # Dieselbe Vorrangkette wie `_property_attrs`: gepflegte Spalte
            # zuerst, Land nur als Rückfall. Steht hier None, wird Channex
            # `timezone required` melden — dann ist DAS der Grund.
            zeitzone=(
                prop[0].get("timezone")
                or (_timezone_for_country(str(prop[0].get("country")))
                    if prop[0].get("country") else None)
            ),
        )

    # Channex-Readiness-Feldnamen → Klartext für den Kunden. Die Liste stammt aus
    # dem gemessenen Verhalten und der Channex-Doku („To activate the channel we
    # will check: country, address, phone, latitude & longitude, timezone,
    # hotel_policy, cancellation_policy, facility, photo, property_description").
    # Ein unbekannter Schlüssel wird UNVERÄNDERT durchgereicht statt geschluckt —
    # ein Kunde soll nie „irgendwas fehlt" lesen (Wurzel 5).
    _READINESS_KLARTEXT: dict[str, str] = {
        "timezone": "Zeitzone des Objekts",
        "country": "Land",
        "address": "Straße und Hausnummer",
        "phone": "Telefonnummer",
        "latitude": "Standort auf der Karte",
        "longitude": "Standort auf der Karte",
        "photos": "Fotos",
        "facilities": "Ausstattung",
        "description": "Beschreibung",
        "property_descriptions": "Beschreibung",
        "hotel_policy_id": "Hausregeln",
        "default_cancellation_policy_id": "Stornobedingungen",
        "bedrooms_count": "Anzahl Schlafzimmer",
        "bathrooms_count": "Anzahl Badezimmer",
        "beds_count": "Anzahl Betten",
    }
    _READINESS_RELATION_KLARTEXT: dict[str, str] = {
        "Mapping": "Zuordnung der Anzeigen zu deinen Objekten",
    }

    def kanal_des_kontos_nachtragen(
        self, ctx: AuthContext, *, account_id: str, portal_code: str = "AirBNB"
    ) -> dict[str, Any]:
        """Den von Channex angelegten Kanal einem wartenden Konto zuordnen.

        Bei einer neuen Verbindung legen WIR keinen Kanal an — Channex tut es,
        sobald die Autorisierung eintrifft. Danach steht bei Channex ein Kanal,
        den unsere DB nicht kennt, und das Konto wartet ohne Kanal-ID. Diese
        Methode schließt die Lücke.

        Erkannt wird er als der einzige Kanal des Portals, der bei Channex
        existiert und in `ota_account` noch keinem Konto gehört. Gibt es
        mehrere, wird KEINER genommen: eine Verwechslung hier hängt hundert
        Objekte an den falschen Zugang (Wurzel 4 — lieber nichts als geraten).
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        konto = self._kanal_des_kontos(db, tenant_id, account_id, portal_code)
        if konto:
            # Kanal steht schon — dann fehlt evtl. nur noch die Host-ID.
            self._host_id_nachtragen(db, tenant_id, account_id, konto)
            return {"channel_id": konto, "neu": False}

        bekannt = {
            str(r["channex_channel_id"])
            for r in (
                db.table("ota_account")
                .select("channex_channel_id")
                .eq("tenant_id", tenant_id)
                .not_.is_("channex_channel_id", "null")
                .execute()
            ).data or []
            if r.get("channex_channel_id")
        }
        try:
            liste = self._channex.list_channels()
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        offen = [
            str(c["id"])
            for c in (liste.get("data") or [])
            if c.get("id")
            and str(c["id"]) not in bekannt
            and ((c.get("attributes") or {}).get("channel") == portal_code)
        ]
        if len(offen) != 1:
            log.info(
                "channex_neuer_kanal_nicht_eindeutig",
                tenant_id=tenant_id, account_id=account_id, gefunden=offen,
            )
            return {"channel_id": None, "neu": False}

        kanal_ans_konto_schreiben(
            db, tenant_id, account_id=account_id, channel_id=offen[0]
        )
        self._host_id_nachtragen(db, tenant_id, account_id, offen[0])
        log.info(
            "channex_neuer_kanal_uebernommen",
            tenant_id=tenant_id, account_id=account_id, channel_id=offen[0],
        )
        return {"channel_id": offen[0], "neu": True}

    def _host_id_nachtragen(
        self, db: Client, tenant_id: str, account_id: str, channel_id: str
    ) -> None:
        """Die Kennung des Kontos beim Portal aus dem Kanal übernehmen.

        Airbnb gibt die Host-ID erst NACH dem Autorisieren heraus („once
        connection is active it will show the Host ID here", Channex-Anleitung);
        sie steht dann in den Tokens des Kanals. Bisher holte sie nur der
        Status-Poll — und der läuft je OBJEKT. Ein frisch verbundenes Konto hat
        aber noch keine Objekte, also blieb die Kennung leer.

        Sichtbare Folge: die Kontoliste zeigte statt eines Namens die rohe
        UUID, und die Kanal-Kachel meldete „nicht verbunden", obwohl Channex
        gültige Tokens führte (live am 07.08.2026, Konto ba30b6f2 / Host
        226976381).

        Best effort (Wurzel 5): der Kanal ist die Verbindung, die Kennung nur
        ihre Beschriftung. Ein Fehler hier darf das Nachtragen nicht kippen.
        """
        host = self._kanal_host_id(channel_id)   # meldet Lesefehler selbst
        if not host:
            return
        try:
            db.table("ota_account").update({"ota_hotel_id": str(host)}).eq(
                "tenant_id", tenant_id
            ).eq("id", account_id).is_("ota_hotel_id", "null").execute()
        except Exception as exc:  # noqa: BLE001 — best effort
            log.warning(
                "channex_host_id_nicht_gespeichert",
                account_id=account_id, error=str(exc)[:200],
            )

    def _autorisierter_kanal(self, kandidaten: list[str]) -> str | None:
        """Der Kanal aus `kandidaten`, der bei Channex TOKENS trägt.

        Airbnb autorisiert das KONTO, nicht das Objekt — es gibt also höchstens
        einen autorisierten Kanal je Betrieb, und der ist der einzige, an dem
        eine Verbindung wirklich hängt. Best effort: ist der Zustand nicht
        lesbar, gibt es None und der Aufrufer nimmt seinen bisherigen Weg (der
        Kanal-Zustand darf den Start nicht blockieren).
        """
        for channel_id in kandidaten:
            try:
                kanal = self._channex.get_channel(channel_id)
            except ChannexError as exc:  # noqa: BLE001 — nur Auswahlhilfe
                log.warning(
                    "channex_kanal_zustand_nicht_lesbar",
                    channel_id=channel_id, error=exc.message,
                )
                continue
            attrs = (kanal.get("data") or {}).get("attributes") or {}
            settings = attrs.get("settings") or {}
            tokens = settings.get("tokens")
            if isinstance(tokens, dict) and tokens.get("user_id") \
                    and not settings.get("token_invalid"):
                return channel_id
        return None

    def _kanal_host_id(self, channel_id: str) -> str | None:
        """Airbnb-Host-ID aus den Kanal-Settings (`settings.tokens.user_id`).

        Best effort: ist der Kanal nicht lesbar, gibt es None — die Host-ID ist
        eine Anzeige, sie darf den Start nicht blockieren.
        """
        try:
            kanal = self._channex.get_channel(channel_id)
        except ChannexError as exc:  # noqa: BLE001 — nur Anzeige
            log.warning(
                "channex_host_id_nicht_lesbar",
                channel_id=channel_id, error=exc.message,
            )
            return None
        return airbnb_oauth.parse_connection_status(kanal).get("host_id")

    def _objekt_an_kanal_haengen(
        self, channel_id: str, channex_property_id: str
    ) -> None:
        """Eine Channex-Property an einen bestehenden Kanal hängen.

        Der PUT ERSETZT die `properties`-Liste (kein Merge) → erst lesen, dann
        vereinigt schreiben, sonst fallen die schon verbundenen Objekte heraus
        (Wurzel 1). Ist sie schon dabei, passiert nichts (Wurzel 2).
        """
        try:
            kanal = self._channex.get_channel(channel_id)
            attrs = (kanal.get("data") or {}).get("attributes") or {}
            vorhanden = {str(p) for p in (attrs.get("properties") or [])}
            if channex_property_id in vorhanden:
                return
            self._channex.update_channel(
                channel_id,
                {"properties": sorted(vorhanden | {channex_property_id})},
            )
            log.info(
                "channex_objekt_an_kanal_gehaengt",
                channel_id=channel_id,
                channex_property_id=channex_property_id,
                vorher=len(vorhanden), nachher=len(vorhanden) + 1,
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def _objekt_vom_kanal_loesen(
        self, channel_id: str, channex_property_id: str
    ) -> None:
        """Gegenstück zu `_objekt_an_kanal_haengen` (Wurzel 1).

        Nötig, weil Channex beim Anlegen eines Kanals mindestens eine Property
        verlangt, diese Property beim Verbinden eines ZWEITEN Kontos aber einem
        FREMDEN Zugang gehört. Sie ist nur der Aufhänger für den
        Autorisierungslink und darf nicht am Kanal hängen bleiben.

        Best effort: schlägt das Lösen fehl, ist der Kanal trotzdem entstanden
        und der Kunde kann autorisieren — die überzählige Property fällt beim
        nächsten Abgleich auf. Ein harter Fehler hier würde den ganzen
        Verbindungsvorgang kippen, obwohl sein Ziel bereits erreicht ist.
        """
        try:
            kanal = self._channex.get_channel(channel_id)
            attrs = (kanal.get("data") or {}).get("attributes") or {}
            vorhanden = {str(p) for p in (attrs.get("properties") or [])}
            if channex_property_id not in vorhanden:
                return
            rest = sorted(vorhanden - {channex_property_id})
            self._channex.update_channel(channel_id, {"properties": rest})
            log.info(
                "channex_aufhaenger_geloest",
                channel_id=channel_id,
                channex_property_id=channex_property_id,
                nachher=len(rest),
            )
        except ChannexError as exc:  # noqa: BLE001 — Aufräumen kippt den Connect nicht
            log.warning(
                "channex_aufhaenger_loesen_fehlgeschlagen",
                channel_id=channel_id,
                channex_property_id=channex_property_id,
                error=exc.message,
            )

    def _readiness_offen(self, channel_id: str) -> str:
        """Offene Pflichtpunkte des Kanals als lesbare, kommagetrennte Liste.

        Leerer String = alles bereit. Die Prüfung selbst ist best effort: fällt
        der Aufruf aus, wird NICHT blockiert (sonst hinge die Aktivierung an
        einem Diagnose-Endpunkt) — der Fehler geht dann ins Log und Channex
        entscheidet beim `activate` selbst.
        """
        try:
            punkte = self._channex.check_readiness(channel_id)
        except ChannexError as exc:  # noqa: BLE001 — nur Diagnose, nicht blockieren
            log.warning(
                "channex_readiness_pruefung_fehlgeschlagen",
                channel_id=channel_id, error=exc.message,
            )
            return ""
        namen: list[str] = []
        for p in punkte:
            if not isinstance(p, dict):
                continue
            feld = p.get("field")
            relation = p.get("relation")
            if feld:
                namen.append(self._READINESS_KLARTEXT.get(str(feld), str(feld)))
            elif relation:
                namen.append(
                    self._READINESS_RELATION_KLARTEXT.get(
                        str(relation), str(relation)
                    )
                )
        if punkte:
            log.info(
                "channex_readiness_offen",
                channel_id=channel_id, roh=punkte, klartext=namen,
            )
        # Reihenfolge erhalten, Doppelte raus (latitude/longitude ergeben denselben Text).
        return ", ".join(dict.fromkeys(namen))

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

    def _property_bei_channex_da(self, channex_property_id: str) -> bool:
        """Existiert diese Property bei Channex noch? (404 = nein)

        Fail-CLOSED nur beim 404 — genau der sagt „gibt es nicht". Jeder andere
        Fehler (Netz, 5xx, Ratelimit) bedeutet „unbekannt", und daraus „gelöscht"
        zu folgern wäre falsch: der Aufrufer verwürfe eine gültige Registrierung
        und legte bei Channex eine zweite Property an. Im Zweifel gilt sie also
        als vorhanden, und der eigentliche Aufruf meldet den echten Fehler.
        """
        try:
            self._channex.get_property(channex_property_id)
        except ChannexError as exc:
            if exc.status_code == 404:
                return False
            log.warning(
                "channex_property_pruefung_unklar",
                channex_property_id=channex_property_id, error=exc.message,
            )
        return True

    @staticmethod
    def _mapping_schliessen(
        db: Client, tenant_id: str, channex_property_id: str
    ) -> None:
        """Eine Registrierung als beendet markieren, deren Property bei Channex
        nicht mehr existiert.

        `deleted_at` statt Löschen: die Zeile trägt die Historie (welche
        Channex-ID unser Objekt einmal hatte), und ein hartes Löschen nähme sie
        mit. Best effort — misslingt es, scheitert nur der nächste Versuch
        wieder an derselben Stelle, es geht nichts kaputt.

        `sync_enabled` MUSS mit (Wurzel 1 — Gegenzustand): eine geschlossene
        Registrierung ist keine eingeschaltete. Hier stand einmal NUR
        `deleted_at`, und damit blieben Zeilen mit `deleted_at is not null AND
        sync_enabled = true` stehen — ein Zustand, den es fachlich nicht gibt.
        Live gemessen am 23.08.2026: „FeWo *Stjerneskud*" trug drei Map-Zeilen,
        zwei davon geschlossen, beide weiter `sync_enabled = true` und
        `last_sync_status = 'ok'`. Jeder Leseweg, der (wie
        `airbnb_historie_dienst.verbundene_objekte_des_tenants` vor seinem Fix)
        nur auf `sync_enabled` filtert, hielt das Objekt damit für dreifach
        verbunden und zeigte auf zwei Channex-Properties, die es nicht mehr gibt.
        `last_sync_status`/`last_sync_error` werden bewusst NICHT angefasst: sie
        sind der Beleg, wie die Registrierung endete.
        """
        try:
            db.table("channex_property_map").update(
                {"deleted_at": "now()", "sync_enabled": False}
            ).eq("tenant_id", tenant_id).eq(
                "channex_property_id", channex_property_id
            ).is_("deleted_at", "null").execute()
        except Exception as exc:  # noqa: BLE001 — Aufräumen kippt den Start nicht
            log.warning(
                "channex_mapping_nicht_geschlossen",
                channex_property_id=channex_property_id, error=str(exc)[:200],
            )

    @staticmethod
    def _kanal_des_kontos(
        db: Client, tenant_id: str, account_id: str, portal_code: str
    ) -> str | None:
        """Der Channex-Kanal GENAU dieses Kontos (0304), tenant-gescopet.

        Rückgabe `None` heißt: das Konto besteht, hat aber noch keinen Kanal —
        dann legt der Aufrufer einen an und schreibt ihn ans Konto. Das ist der
        normale Zustand direkt nach „Konto verbinden".

        Ein UNBEKANNTES Konto ist dagegen ein Fehler und wird abgewiesen (Wurzel
        3: per-ID-Zugriff explizit auf den Mandanten scopen, Wurzel 5:
        fail-closed). Stillschweigend auf „kein Kanal" zurückzufallen hieße,
        einen weiteren Kanal für ein Konto anzulegen, das dem Betrieb gar nicht
        gehört — bei einer Agentur mit hundert Zugängen der Unterschied zwischen
        Zuordnen und Raten.
        """
        zeile = (
            db.table("ota_account")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("id", account_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        if not zeile:
            raise ChannelManagerError(
                "Dieses Portal-Konto gibt es nicht.", status_code=404
            )
        kanal = zeile[0].get("channex_channel_id")
        return str(kanal) if kanal else None

    def _doppeltes_konto_abraeumen(
        self, db: Client, tenant_id: str, *, channel_id: str, host_id: str,
        property_id: str | None,
    ) -> bool:
        """Wurde DASSELBE Portal-Konto ein zweites Mal verbunden? Dann aufräumen.

        True = Dublette (der Aufrufer meldet 409). Erkannt an der Host-ID: sie
        ist die Kennung des Kontos beim Portal, und dieselbe Kennung an zwei
        Kanälen bedeutet zwangsläufig denselben Zugang.

        Aufgeräumt wird SOFORT und vollständig (Wurzel 1 — der Gegenzustand
        gehört zur Aktion): der überflüssige Kanal bei Channex, seine
        Kontozeile und das Gerüst-Objekt, das nur für diesen Versuch entstanden
        ist. Sonst bliebe nach jedem Fehlversuch ein „Airbnb-Übernahme läuft"
        in der Objektliste stehen — live genau so passiert.

        Das Gerüst wird nur gelöscht, solange es unbenutzt ist (Gerüsttitel,
        `draft`): ein Objekt, das die Übernahme schon gefüllt hat, gehört dem
        Betrieb und wird nie automatisch entfernt.
        """
        andere = (
            db.table("ota_account")
            .select("id, channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_hotel_id", host_id)
            .neq("channex_channel_id", channel_id)
            .limit(1)
            .execute()
        ).data or []
        if not andere:
            return False

        log.warning(
            "airbnb_konto_doppelt_verbunden",
            tenant_id=tenant_id, host_id=host_id, kanal_neu=channel_id,
            kanal_bestehend=andere[0].get("channex_channel_id"),
        )
        # Den überflüssigen Kanal bei Channex entfernen — er wäre sonst ein
        # zweiter Zugang zu denselben Inseraten.
        try:
            self._channex.delete_channel(channel_id)
        except ChannexError as exc:  # noqa: BLE001 — Aufräumen kippt den 409 nicht
            log.warning(
                "airbnb_doppelkanal_nicht_geloescht",
                channel_id=channel_id, error=exc.message,
            )
        db.table("channex_channel_connection").delete().eq(
            "tenant_id", tenant_id
        ).eq("channex_channel_id", channel_id).execute()
        konto_zum_kanal_loesen(db, tenant_id, channel_id)
        if property_id:
            self._geruest_verwerfen(db, tenant_id, property_id)
        return True

    @staticmethod
    def _geruest_verwerfen(db: Client, tenant_id: str, property_id: str) -> None:
        """Ein unbenutztes Übernahme-Gerüst löschen (nur Titel + `draft`)."""
        from .airbnb_uebernahme import GERUEST_TITEL

        try:
            db.table("properties").delete().eq("tenant_id", tenant_id).eq(
                "id", property_id
            ).eq("title", GERUEST_TITEL).eq("status", "draft").execute()
        except Exception as exc:  # noqa: BLE001 — best effort
            log.warning(
                "airbnb_geruest_nicht_verworfen",
                property_id=property_id, error=str(exc)[:200],
            )

    def refresh_channel_oauth_status(
        self, ctx: AuthContext, *, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Verbindungsstatus aus Channex lesen (Poll — Channex liefert keine
        Channel-Webhooks). Schreibt host_id/Status in channex_channel_connection
        → Realtime-Update. `is_active` bleibt false bis Mapping+activate."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        def _lesen(frage: _Q) -> _Q:
            """Scope zum SUCHEN der Verbindung dieses Objekts."""
            return (
                frage.eq("tenant_id", tenant_id)
                .eq("ota_portal_code", portal_code)
                .eq("property_id", property_id)
            )

        row = (
            _lesen(
                db.table("channex_channel_connection").select(
                    "id, channex_channel_id"
                )
            )
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        if not row or not row[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Keine OAuth-Verbindung gefunden.", status_code=404
            )
        channel_id = row[0]["channex_channel_id"]

        def _scope(frage: _Q) -> _Q:
            """Scope zum SCHREIBEN: genau die Zeile, deren Kanal geprüft wurde.

            Vorher war das derselbe Scope wie beim Lesen — gelesen wurde EINE
            Zeile (`limit(1)`), geschrieben aber auf alle Zeilen des Tripels.
            Bei zwei Konten am selben Objekt (0304) bekäme Konto B die Host-ID
            von Konto A eingetragen, und der 404-Pfad nullte dessen Kanal-ID
            mit, obwohl nur Konto A verschwunden ist.
            """
            return frage.eq("tenant_id", tenant_id).eq("id", row[0]["id"])
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
        # SCHUTZ vor dem doppelt verbundenen Konto (0304): kommt aus der
        # Autorisierung eine Host-ID zurück, die schon einem ANDEREN Konto
        # gehört, hat der Kunde versehentlich denselben Airbnb-Zugang erneut
        # verbunden — im Browser war er dort noch angemeldet, und Airbnb nimmt
        # dann ohne Rückfrage das laufende Konto.
        #
        # Ohne diese Prüfung entstünde ein zweites Konto mit derselben Host-ID,
        # dessen Objekte in Wahrheit dem ersten gehören. Der Fehler wird hier
        # BENANNT und der angefangene Zugang abgeräumt, statt ihn zu behalten.
        if host_id and self._doppeltes_konto_abraeumen(
            db, tenant_id, channel_id=str(channel_id), host_id=str(host_id),
            property_id=property_id,
        ):
            raise ChannelManagerError(
                "Dieses Portal-Konto ist bereits verbunden. Melde dich im "
                "Browser beim Portal ab und verbinde dann das andere Konto.",
                status_code=409,
            )

        # Dasselbe am KONTO nachziehen: die Kontoliste zeigt Host-ID, Fehler und
        # Verbindungszeitpunkt: sie stünde sonst dauerhaft auf „verbinde…",
        # obwohl die Autorisierung längst durch ist.
        konto_status_setzen(
            db, tenant_id, channel_id=str(channel_id),
            host_id=host_id, connected=connected, last_error=last_error,
        )
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
        mappings: list[dict[str, Any]], account_id: str | None = None,
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
        # `id` mitlesen: aktiviert wird EIN Kanal, also darf auch nur DESSEN
        # Zeile auf aktiv gehen (0304) — sonst meldeten bei zwei Konten beide
        # „aktiv", obwohl nur eines wirklich läuft.
        frage = (
            db.table("channex_channel_connection")
            .select("id, channex_channel_id, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
        )
        # Ist ein Konto BENANNT, zählt nur dessen Zeile. Sonst nähme die
        # Reihenfolge die Entscheidung ab: das Übernahme-Gerüst trägt die Zeile
        # des ERSTEN Zugangs (es diente ihm als Aufhänger), und `finalize` lief
        # damit gegen dessen Kanal. Live am 07.08.2026: `prepare` holte richtig
        # Torstens Listing „FeWo *Stjerneskud*" von Kanal 21ec5429, `finalize`
        # ging auf Kanal 9a46827b, fand dort nur die 17 AirSmil-Anzeigen und
        # antwortete „Zugeordnetes Portal-Zimmer nicht gefunden" (422).
        if account_id:
            frage = frage.eq("ota_account_id", account_id)
        row = (frage.order("created_at").limit(1).execute()).data
        channel_id = row[0]["channex_channel_id"] if row else None
        if not channel_id and account_id:
            # Für ein neu verbundenes Konto gibt es noch KEINE Verbindungszeile
            # — seine Objekte entstehen erst mit dieser Zuordnung. Der Kanal
            # steht aber am Konto (0304), und das ist die maßgebliche Quelle.
            channel_id = self._kanal_des_kontos(
                db, tenant_id, account_id, portal_code
            )
        if not channel_id:
            raise ChannelManagerError(
                "Keine OAuth-Verbindung für dieses Objekt.", status_code=404
            )
        # Die Verbindungszeile kann fehlen (neu verbundenes Konto, s. o.) —
        # dann gibt es nichts nachzulesen und nichts nachzuziehen.
        zeile = row[0] if row else {}
        log.info(
            "airbnb_finalize_start",
            tenant_id=tenant_id, property_id=property_id,
            portal_code=portal_code, channel_id=channel_id,
            konto_id=account_id,
            host_id=zeile.get("ota_hotel_id"),
            zuordnungen_vom_client=mappings,
        )

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
            db, tenant_id, property_id, portal_code, account_id=account_id
        )
        settings = self._inject_sandbox_settings(
            portal_code, property_id,
            kanal_settings or {"hotel_id": zeile.get("ota_hotel_id")},
        )
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        ota_rooms = self._normalize_mapping_rooms(details)
        log.info(
            "airbnb_finalize_ota_zimmer",
            property_id=property_id, channel_id=channel_id,
            anzahl=len(ota_rooms),
            ota_zimmer=[
                {"id": r.get("id"), "title": r.get("title"),
                 "raten": [x.get("id") for x in (r.get("rates") or [])]}
                for r in ota_rooms
            ],
        )

        # Preisplan sicherstellen, BEVOR die Nutzlast gebaut wird.
        #
        # Channex verlangt beim Zuordnen Zimmer UND Tarif; ohne Rate-Plan bricht
        # `_selected_rate_plan_ids` mit 422 ab („Setze unter „Preise“ den
        # Grundpreis"). Für ein aus Airbnb übernommenes Objekt ist das eine
        # Sackgasse: der Kunde soll den Preis nicht abtippen, den Airbnb längst
        # führt. Airbnb LIEFERT den Grundpreis — dokumentiert
        # (`GET channels/{id}/mappings/{mappingId}/pricing_settings`,
        # docs/OTA/Airbnb/Pricing Settings.pdf) und live gemessen (05.08.2026,
        # „FeWo Lille Lægehus": `default_daily_price: 500`, `currency: "DKK"`).
        # Die frühere Annahme „Airbnb übergibt keine Preise" war falsch.
        #
        # Geholt wird über den bestehenden, belegten Weg `airbnb_objekt_abrufen`
        # (zuordnen → Preis übernehmen → Plan füllen). Kein erfundener Preis
        # (Wurzel 4): liefert Airbnb keinen, bleibt der 422 aus dem Nutzlast-Bau
        # mit seiner umsetzbaren Meldung stehen.
        if portal_code in self._OAUTH_PORTALS:
            # Die Anzeigen-Nummer ZUERST ans Objekt schreiben. Sie steht in der
            # Zuordnung, die der Betrieb gerade getroffen hat — und der
            # Preis-Abruf braucht sie: ohne `airbnb_listing_id` lehnt er mit
            # „Dieses Objekt ist keine Airbnb-Anzeige" ab (live am 07.08.2026
            # beim Übernahme-Gerüst, das die Nummer noch nicht trug).
            #
            # Sonst bliebe ein Zirkel: die Nummer entsteht erst durch die
            # Zuordnung, der Preis wird aber währenddessen gebraucht.
            self._listing_id_uebernehmen(db, tenant_id, property_id, mappings)
            if not zeile:
                # Auch die Verbindungszeile muss JETZT stehen, nicht erst am
                # Ende: der Preis-Abruf sucht den Kanal über sie
                # (`_airbnb_kanal_des_betriebs`) und meldete sonst „Es ist kein
                # Airbnb-Konto verbunden" — bei einem Konto, das gerade
                # verbunden wurde. Noch INAKTIV; aktiv wird sie erst, wenn
                # Channex die Zuordnung bestätigt hat (Wurzel 5: nichts als
                # fertig ausweisen, bevor es das ist).
                self._save_oauth_connection(
                    db, tenant_id,
                    property_id=property_id,
                    channex_property_id=self._require_property_mapping(
                        db, tenant_id, property_id
                    ),
                    portal_code=portal_code,
                    channel_id=channel_id,
                    host_id=self._kanal_host_id(channel_id),
                    is_active=False,
                    last_error=None,
                )
            self._preis_von_airbnb_nachholen(db, ctx, tenant_id, property_id)

        rate_plans = self._build_rate_plans(
            db, tenant_id, portal_code, mappings, ota_rooms
        )
        log.info(
            "airbnb_finalize_nutzlast_gebaut",
            property_id=property_id, channel_id=channel_id,
            anzahl=len(rate_plans), rate_plans=rate_plans,
        )

        # Zuordnung schreiben — je Eintrag EIN `POST channels/{id}/mappings`,
        # NICHT `PUT channels/{id}` mit einem `rate_plans`-Array.
        #
        # Der PUT-Weg antwortet 200 und speichert bei Airbnb NICHTS. Live
        # gemessen (05.08.2026) am Kanal 9a46827b des Beta-Betriebs: nach
        # „Verbunden und aktiviert" für „FeWo Lille Lægehus" trug der Kanal
        # weiter genau EINEN Eintrag (Grævlinge, listing 1654285285861524234);
        # der Eintrag für 1378994948547697321 fehlte. Der Fehler war nicht die
        # Nutzlast: jedes Objekt hat seinen eigenen Rate-Plan, der Merge hängt
        # ihn also korrekt an — der WEG speichert nicht.
        # `create_channel_mapping` ist der belegte Weg (dort dokumentiert und
        # per Rücklesen verifiziert), denselben nutzt `_kanal_zuordnung_anlegen`.
        #
        # Danach ZURÜCKLESEN, bevor irgendetwas als erfolgreich gilt: eine 200
        # von Channex ist kein Beweis. Fehlt der Eintrag anschließend am Kanal,
        # bricht dieser Aufruf ab (fail-closed, Wurzel 5) statt den Kanal zu
        # aktivieren und „verbunden" zu melden — genau das ist live passiert.
        self._zuordnung_schreiben_und_pruefen(channel_id, rate_plans)

        # VOR der Aktivierung prüfen, was Channex noch fehlt, und den Grund
        # NENNEN. Channex lässt einen Kanal ohne vollständige Angaben nicht live
        # gehen („You cant Activate the channel unless you do mapping of rooms
        # and rates first"), und der Kanal bleibt dann still auf „Disabled" —
        # genau so stand die Airbnb-Verbindung des Beta-Betriebs da, ohne dass
        # irgendwo ein Grund auftauchte. Live gemessen (04.08.2026):
        #     [{"relation":"Mapping","error_code":"required","entity":"Channel"},
        #      {"field":"timezone","error_code":"required","entity":"Property"}]
        offene = self._readiness_offen(channel_id)
        log.info(
            "airbnb_finalize_readiness",
            property_id=property_id, channel_id=channel_id,
            offene_punkte=offene or "keine",
        )
        if offene:
            raise ChannelManagerError(
                "Das Portal kann noch nicht aktiviert werden, weil Angaben "
                f"fehlen: {offene}. Ergänze sie am Objekt und versuche es "
                "erneut.",
                status_code=422,
            )
        try:
            self._channex.activate_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        log.info(
            "airbnb_finalize_kanal_aktiviert",
            property_id=property_id, channel_id=channel_id,
        )

        # Genau die Zeile dieses Kanals aktivieren — nicht alle des Objekts.
        # Bei zwei Konten am selben Objekt (0304) meldeten sonst beide „aktiv",
        # obwohl nur eines wirklich verkauft.
        db.table("channex_channel_connection").update(
            {"is_active": True, "last_error": None}
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).eq(
            "ota_portal_code", portal_code
        ).eq("channex_channel_id", channel_id).execute()

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

    @staticmethod
    def _listing_id_uebernehmen(
        db: Client, tenant_id: str, property_id: str,
        mappings: list[dict[str, Any]],
    ) -> None:
        """Die zugeordnete Airbnb-Anzeigen-Nummer am Objekt festhalten.

        Bei Airbnb IST `room_type_code` die Listing-ID (Channex mappt Anzeigen
        als Zimmertypen, `mapping_mode: "listing"`). Sie ist die Verbindung
        zwischen unserem Objekt und der Anzeige und wird an mehreren Stellen
        gebraucht — Preis-Abruf, Buchungszuordnung, Status („ist bei Channex
        wirklich gemappt", `_objekte_mit_channex_ziel`).

        NICHT überschreiben, wenn schon eine steht: eine andere Nummer hieße,
        das Objekt zeigt plötzlich auf eine fremde Anzeige (Wurzel 1). Nur die
        Zuordnung DIESES Objekts zählt — bei einer Sammelzuordnung stehen in
        `mappings` auch die der anderen.
        """
        nummer = next(
            (
                str(m["room_type_code"])
                for m in mappings
                if m.get("local_property_id") == property_id
                and m.get("room_type_code")
            ),
            None,
        )
        if not nummer:
            return
        try:
            db.table("properties").update(
                {"airbnb_listing_id": nummer}
            ).eq("tenant_id", tenant_id).eq("id", property_id).is_(
                "airbnb_listing_id", "null"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Hauptpfad läuft weiter
            log.warning(
                "airbnb_listing_id_nicht_gespeichert",
                property_id=property_id, error=str(exc)[:200],
            )

    def _preis_von_airbnb_nachholen(
        self, db: Client, ctx: AuthContext, tenant_id: str, property_id: str
    ) -> None:
        """Fehlt der Preisplan, ihn über den Airbnb-Abruf holen (best effort).

        Betrifft jedes per „Objekte übernehmen" entstandene Objekt: die Übernahme
        bringt Titel, Ort, Land und Kapazität, aber keinen Preis — der steht in
        den Pricing-Settings der Anzeige und kommt erst mit dem Abruf.

        Nur wenn NICHTS da ist: existiert ein Plan, ist er die Wahrheit und wird
        nicht überschrieben (Wurzel 2 — und ein Preis, den der Betrieb selbst
        gesetzt hat, darf Airbnb nicht überschreiben).

        Best effort: schlägt der Abruf fehl, wird das GELOGGT und der Hauptpfad
        läuft weiter — dann greift der 422 aus dem Nutzlast-Bau mit seiner
        umsetzbaren Meldung. Ein Abruf-Fehler darf das Verbinden nicht mit einem
        unverständlichen Grund abbrechen (Wurzel 5).
        """
        vorhanden = (
            db.table("rate_plans")
            .select("id")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return
        log.info(
            "airbnb_finalize_preis_fehlt_abruf_startet",
            tenant_id=tenant_id, property_id=property_id,
        )
        try:
            ergebnis = self.airbnb_objekt_abrufen(  # type: ignore[attr-defined]
                ctx, property_id
            )
        except (ChannexError, ChannelManagerError) as exc:
            log.warning(
                "airbnb_finalize_preis_abruf_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
                error=getattr(exc, "message", str(exc)),
            )
            return
        log.info(
            "airbnb_finalize_preis_abruf_fertig",
            tenant_id=tenant_id, property_id=property_id,
            preis_uebernommen=ergebnis.get("preis_uebernommen"),
            base_price=ergebnis.get("base_price"),
            waehrung=ergebnis.get("waehrung"),
        )

    def _zuordnung_schreiben_und_pruefen(
        self, channel_id: str, rate_plans: list[dict[str, Any]],
    ) -> None:
        """Jede Zuordnung einzeln am Kanal anlegen und das Ergebnis ZURÜCKLESEN.

        Zwei Teile, die zusammengehören:

        1. Geschrieben wird über `POST channels/{id}/mappings` (je Eintrag ein
           Aufruf). Der naheliegende `PUT channels/{id}` mit `rate_plans`
           antwortet 200 und speichert bei Airbnb nichts.
        2. Danach wird der Kanal per GET gelesen und geprüft, ob JEDE gewünschte
           `rate_plan_id` dort steht. Erst dieser Vergleich beweist das
           Speichern. Fehlt einer, wirft die Methode — der Aufrufer darf dann
           nicht aktivieren und nicht „verbunden" melden (Wurzel 5).

        Idempotent (Wurzel 2): bereits vorhandene Einträge werden übersprungen,
        und Channex' „already exists" gilt als Zielzustand, nicht als Fehler.
        """
        vorhanden = self._kanal_rate_plan_ids(channel_id)
        log.info(
            "airbnb_zuordnung_vorher",
            channel_id=channel_id,
            am_kanal=sorted(vorhanden),
            soll=[str(p.get("rate_plan_id")) for p in rate_plans],
        )
        for plan in rate_plans:
            rate_plan_id = plan.get("rate_plan_id")
            if not rate_plan_id:
                log.warning(
                    "airbnb_zuordnung_ohne_rate_plan_id",
                    channel_id=channel_id, eintrag=plan,
                )
                continue
            if rate_plan_id in vorhanden:
                log.info(
                    "airbnb_zuordnung_uebersprungen_schon_da",
                    channel_id=channel_id, rate_plan_id=str(rate_plan_id),
                )
                continue
            log.info(
                "airbnb_zuordnung_post_mappings",
                channel_id=channel_id, rate_plan_id=str(rate_plan_id),
                settings=plan.get("settings") or {},
            )
            try:
                self._channex.create_channel_mapping(
                    channel_id, str(rate_plan_id), plan.get("settings") or {}
                )
            except ChannexError as exc:
                if "already exists" in str(exc).lower():
                    log.info(
                        "channex_oauth_zuordnung_bestand_bereits",
                        channel_id=channel_id, rate_plan_id=rate_plan_id,
                    )
                    continue
                raise self._wrap_channex(exc) from exc

        # Beweis statt Statuscode: der Ist-Stand steht ausschließlich im
        # Kanal-Objekt unter `rate_plans[]` (einen GET-Pfad für Mappings gibt es
        # nicht — alle 404, siehe `create_channel_mapping`).
        nachher = self._kanal_rate_plan_ids(channel_id)
        fehlend = [
            str(p.get("rate_plan_id"))
            for p in rate_plans
            if p.get("rate_plan_id") and p["rate_plan_id"] not in nachher
        ]
        if fehlend:
            log.error(
                "channex_oauth_zuordnung_nicht_gespeichert",
                channel_id=channel_id, fehlende_rate_plans=fehlend,
                rate_plans_am_kanal=sorted(nachher),
            )
            raise ChannelManagerError(
                "Das Portal hat die Zuordnung nicht gespeichert. Die Verbindung "
                "wurde deshalb nicht aktiviert — bitte erneut versuchen.",
                status_code=502,
            )
        log.info(
            "channex_oauth_zuordnung_geschrieben",
            channel_id=channel_id,
            rate_plans=[str(p.get("rate_plan_id")) for p in rate_plans],
        )

    def _kanal_rate_plan_ids(self, channel_id: str) -> set[str]:
        """Die `rate_plan_id`s, die am Kanal WIRKLICH zugeordnet sind.

        Kein best-effort: dieser Wert ist der Beweis für das Speichern, ein
        stiller Fallback auf „leer" würde eine gelungene Zuordnung als
        fehlgeschlagen ausweisen (und umgekehrt).
        """
        try:
            kanal = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        attrs = ((kanal.get("data") or {}).get("attributes")) or {}
        return {
            str(p["rate_plan_id"])
            for p in attrs.get("rate_plans") or []
            if (p or {}).get("rate_plan_id")
        }

    # `konto_sicherstellen` liegt in `airbnb_konten`, gilt aber portal-neutral —
    # die Kontoidentität ist überall der Channex-Kanal.
    def _save_oauth_connection(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, channel_id: str,
        host_id: str | None, is_active: bool, last_error: str | None,
    ) -> None:
        """Upsert einer OAuth-Verbindung (Airbnb): kein hotel_id-Credential, sondern
        host_id (erst nach Verbindung). Anders als _save_channel_connection, das
        eine eingegebene Hotel-ID voraussetzt."""
        # Das Konto zuerst: die Verbindung zeigt darauf, und der Konflikt-Key
        # des Upserts enthält es (0304). Ohne Konto-Zeile überschriebe ein
        # zweites Konto die Verbindung des ersten, statt danebenzustehen.
        konto_id = konto_sicherstellen(
            db, tenant_id,
            portal_code=portal_code, channel_id=channel_id, host_id=host_id,
        )
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_property_id,
            "ota_portal_code": portal_code,
            "ota_hotel_id": host_id,
            "channex_channel_id": channel_id,
            "ota_account_id": konto_id,
            "is_active": is_active,
            "last_error": last_error,
        }
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict="property_id,ota_portal_code,ota_account_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz darf Connect nicht killen
            log.warning(
                "channex_oauth_connection_persist_failed",
                property_id=property_id, portal_code=portal_code, error=str(exc),
            )
