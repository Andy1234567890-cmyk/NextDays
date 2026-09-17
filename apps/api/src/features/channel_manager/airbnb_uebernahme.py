"""Airbnb-Übernahme: bestehende Airbnb-Listings zu myNextDays holen.

Der Fall: ein Betrieb verkauft schon auf Airbnb und wechselt zu uns. Er hat
NULL Objekte bei uns und soll sie NICHT abtippen — seine Listings sind die
Wahrheit, wir holen sie.

Warum es diesen eigenen Ablauf braucht (alles live gegen app.channex.io am
04.08.2026 geprüft, nicht aus der Doku geschlossen):

1. `POST meta/airbnb/connection_link` verlangt `properties` mit mindestens
   einem Eintrag:
       ohne `properties`      → 422 {"properties": ["should have at least 1 item(s)"]}
       mit `properties: []`   → 422 dasselbe
       mit genau einem        → 200 + airbnb.com-OAuth-URL
   Die Autorisierung hängt bei Channex also zwingend an einem Property. Ein
   konto-weiter Airbnb-Connect ist NICHT möglich — `POST channels` allein
   akzeptiert zwar 0 Properties (201), aber der Link, den der Kunde öffnen
   muss, entsteht dann nie.

2. Der Katalog (`GET channels/list`) liefert für AirBNB
   `mapping_mode: "listing"` und `rate_params.listing_id` — Airbnb-Listings
   werden GEMAPPT, nicht von Channex als eigene Properties gespiegelt. Der
   Reconcile-Weg (Channex-Properties → unsere Objekte) allein reicht deshalb
   nicht: es entstehen dort keine neuen Properties, aus denen Objekte werden
   könnten.

3. Die Listing-Liste kommt aus `POST channels/mapping_details` mit den
   KANAL-Settings (dort liegen nach der Autorisierung die Airbnb-Tokens), und
   zwar unter `data.listing_id_dictionary.values[]`. Am autorisierten Kanal des
   Beta-Betriebs live gemessen: 18 Listings, je Listing genau die Felder
   `id, title, type, city, country_code, occupancies, quality_status,
   synchronization_category`.

   ACHTUNG — es kommen NICHT alle Anzeigen des Kontos. Airbnb führte beim
   Beta-Betrieb 19, `mapping_details` lieferte 18. Die fehlende
   (`021 Stjerneskud`) war genau die EINE, die in Airbnb den Sync-Status
   „Connected" trug, also schon an eine andere Software gebunden ist. Ebenfalls
   nicht geliefert werden laut Channex Anzeigen, die „disabled, unlisted, hidden
   or snoozed" sind, sowie alle Anzeigen, bei denen man nur CoHost ist. Die Zahl
   der gelieferten Anzeigen geht deshalb als `listings_gefunden` ans UI: der
   Betrieb muss sehen, wenn eine fehlt, statt sie vergeblich zu suchen.

   Jede dieser Anzeigen ist ein EIGENES Objekt an eigener Adresse (im
   Beta-Betrieb Ferienhäuser in Bindslev, Skagen, Mygdal, Sindal, Vidstrup,
   Ålbæk, Tversted, Hjørring) — NICHT mehrere Einheiten einer Kennung und kein
   gemeinsames Gebäude. Bei einem OAuth-Portal ist die Kennung das KONTO. Live
   bestätigt: 18 Objekte, kein `building_id`, 18 eigene Channex-Properties (1:1).

   Mehr gibt CHANNEX nicht her — kein Content, keine Preise:
   `channels/{id}/proxy/listings`, `.../proxy/v2/listings`,
   `.../proxy/v2/calendars`, `.../proxy/v2/pricing_settings`,
   `meta/airbnb/listings` und `meta/airbnb/full_sync_listing` antworten alle
   mit HTTP 500, `channels/{id}/listings` mit 404. Bei Channex ist Airbnb ein
   PUSH-Kanal: Preise/Verfügbarkeit gehen von uns dorthin, nicht zurück (wie
   beim ARI-Readback, `channex_ari_shadow`). Channex' eigene Doku kennt
   dementsprechend nur Mapping und ARI-Push.

   WICHTIG — das ist eine Grenze von Channex, NICHT von Airbnb: Airbnbs
   Partner-API gibt Content UND Preise heraus, belegt an den Hilfeartikeln der
   zugelassenen Partner. Hostfully importiert „Prices for next 3 years for each
   night" samt Adresse, Amenities und Fotos; Guesty „The listing's base price
   in Airbnb will be imported … Calendar prices will be imported"; Beds24 „Your
   prices are imported as daily prices"; Hostaway „initial availability and
   rates will be imported". Die zugehörigen Airbnb-Pfade (aus produktiven
   Partner-Clients, nicht aus der Doku — die ist login-gesperrt):
   `GET /v2/listings/{id}`, `/v2/listing_descriptions/{id}/{locale}`,
   `/v2/listing_photos?listing_id=`, `/v2/pricing_settings/{id}`,
   `/v2/calendars/{id}/{von}/{bis}` auf `https://api.airbnb.com`.
   Genau diese Pfade scheitern über den Channex-Proxy (500) — der Proxy gibt sie
   nicht durch, die Pfade selbst sind echt.

   Wer die Preise wirklich holen will, braucht also einen EIGENEN
   Airbnb-Partner-Zugang neben Channex (Zugang vergibt Airbnb, mit NDA und
   Security-Review) oder einen Content-Endpunkt von Channex — Channex ist selbst
   „Preferred+ Partner", hat die Daten also, gibt sie über die API aber nicht
   heraus. Das ist eine Support-Frage an Channex, kein Code-Problem.

   Zwei Randbedingungen aus denselben Quellen, falls das je gebaut wird: der
   Preis-Pull ist nur EINMALIG beim Import möglich (danach besitzt das PMS die
   Preise), und Airbnbs „Smart Pricing" muss vorher AUS sein — sonst kommen
   keine Preise mit (Hostfully wörtlich: „otherwise prices and min night
   requirements won't come in").

4. SPERRTERMINE KOMMEN NICHT MIT. Einheitlich bei allen Anbietern: Beds24
   („Blocked dates in Airbnb are NOT imported, you need to block in the Beds24
   Calendar"), Smoobu (der Nutzer muss „blocked dates" selbst nachtragen),
   Lodgify (nur selbst gesetzte Sperren). Das ist die reale
   ÜBERBUCHUNGS-Gefahr dieses Ablaufs: die Objekte stehen nach der Übernahme
   frei, obwohl bei Airbnb Termine gesperrt sind. Deshalb entstehen die Objekte
   `status='draft'` — sie verkaufen erst, wenn der Betrieb sie bewusst
   freischaltet, und bis dahin kann er die Sperren nachtragen.

Daraus der Ablauf — der Kunde gibt NICHTS ein:
    a) `uebernahme_starten`: Server legt ein Übernahme-Objekt an (lokal +
       Channex) und erzeugt damit die OAuth-URL.
    b) Kunde autorisiert bei Airbnb (ein Klick).
    c) `listings_uebernehmen`: Listings aus `mapping_details` lesen, das erste
       in das Übernahme-Objekt schreiben, für jedes weitere ein Objekt anlegen.
       Übernommen werden Titel, Stadt, Land und Kapazität (Maximum der
       `occupancies`); Preise setzt der Betrieb einmal selbst — siehe oben.

Das Übernahme-Objekt bleibt `status='draft'`: es ist ein Gerüst für die
Autorisierung, kein verkaufsfertiges Objekt. Erst die echten Airbnb-Daten
machen es zu einem — und ob es verkauft wird, entscheidet der Kunde.
"""
from __future__ import annotations

from typing import Any
from uuid import uuid4

from supabase import Client

from src.core.security import AuthContext

from . import airbnb_listing_import as ali
from . import airbnb_oauth
from .airbnb_konten import airbnb_konten
from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    _currency_for_country,
    _timezone_speicherbar,
    log,
)
from .content_builder import locale_order_for_country
from .ota_konten import konto_sicherstellen

# Titel des Gerüst-Objekts. Bewusst erkennbar und nicht geraten: solange die
# echten Airbnb-Daten fehlen, darf hier kein plausibler Fantasiename stehen
# (Wurzel 4) — der Kunde soll sehen, dass die Übernahme noch läuft.
GERUEST_TITEL = "Airbnb-Übernahme läuft"

# Wie viele Listings eine Übernahme höchstens verarbeitet. Airbnb-Konten mit
# hunderten Listings sind real; ohne Obergrenze wäre der Request unbegrenzt
# (Wurzel 8). Darüber hinaus meldet der Ablauf ehrlich, was er NICHT übernommen
# hat, statt still abzuschneiden.
_MAX_LISTINGS = 100


class AirbnbUebernahmeMixin:
    """Bestehende Airbnb-Listings als Objekte übernehmen."""

    # -- a) Start: Gerüst-Objekt + OAuth-URL ----------------------------------
    def uebernahme_starten(
        self, ctx: AuthContext, *, portal_code: str = "AirBNB",
        neues_konto: bool = False, redirect_uri: str | None = None,
        account_id: str | None = None,
    ) -> dict[str, Any]:
        """Übernahme starten, OHNE dass der Kunde selbst ein Objekt anlegt.

        Der vereinbarte Ablauf (29.08.2026, woertlich):
            „Objekt anlegen -> Handshake -> Inserate holen -> Objekt
             aktuallsesieren -> inaktive lassen das hat der user zu
             entscheiden nicht wir"

        Legt (idempotent, Wurzel 2) ein Gerüst-Objekt an, registriert es bei
        Channex und gibt die echte Airbnb-OAuth-URL zurück. Hat der Betrieb
        bereits Objekte, wird das erste davon genutzt — dann entsteht kein
        zweites Gerüst.

        `neues_konto=True` verbindet einen WEITEREN Portal-Zugang (0304): dann
        wird ein eigener Kanal angelegt statt des vorhandenen. Das OBJEKT, an
        dem der Autorisierungslink hängt, ist davon unberührt — es dient nur als
        Aufhänger und wird dem neuen Kanal nicht zugeordnet.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        log.info(
            "airbnb_uebernahme_start",
            tenant_id=tenant_id, portal_code=portal_code,
            neues_konto=neues_konto, konto_id=account_id,
        )

        # OHNE OBJEKT — Vorgabe des Betreibers vom 29.08.2026:
        #     „erst airbnb verbindung ohne objekt"
        #     „erst wenn eine verbindung succee da ist darf bei channex eine
        #      Property entstehen"
        #
        # Bis hierher legte diese Stelle ein Geruest-Objekt an, registrierte es
        # bei Channex und schrieb Konto + Verbindung — alles beim KLICK, vor
        # jedem Airbnb-Login. Wer den Login nie oeffnete oder abbrach (ein
        # gesperrtes Airbnb-Konto genuegt), hinterliess das alles. Gemessen am
        # 29.08.2026 nach drei Klicks ohne einen einzigen Login: 3 Konten,
        # 3 Verbindungen, 4 Registrierungen, mehrere Properties im Channex-UI.
        #
        # Jetzt entsteht hier NICHTS. Es wird ausschliesslich der
        # Autorisierungslink geholt. Objekt, Property, Konto und Verbindung
        # entstehen erst mit dem Ruecksprung `?success=true&channel_id=…`.
        # Gruppe ZUERST pruefen, bevor irgendetwas entsteht. Ohne sie gibt es
        # keinen Autorisierungslink — dann darf auch kein Objekt angelegt
        # werden, das anschliessend nutzlos herumsteht (Wurzel 1: kein halber
        # Zustand nach einem Abbruch).
        self._gruppe_des_betriebs(db, tenant_id)

        # SCHRITT 1 des vereinbarten Ablaufs:
        #     Objekt anlegen -> Handshake -> Inserate holen -> Objekt
        #     aktualisieren -> inaktiv lassen (der Betrieb aktiviert selbst).
        #
        # Warum hier ein Objekt entsteht, obwohl frueher „ohne Objekt" stand:
        # Channex nimmt den Autorisierungslink NUR mit mindestens einer
        # Property an. Dreimal live gemessen (29.08.2026, Testkonto):
        #     Feld weggelassen -> 422 properties: should have at least 1 item(s)
        #     properties: []   -> 422 dieselbe Meldung
        #     properties: null -> 500 link_generation_error
        # Es gibt keinen zweiten Endpunkt; `connection_link` ist der einzige
        # Weg in die Airbnb-OAuth.
        #
        # Kosten entstehen dadurch NICHT: Channex rechnet nach AKTIVEN
        # Kanalverbindungen ab, nicht nach angelegten Objekten
        # („Properties that are set up but have no active connection are not
        # billed", channex.io/pricing). Der Kanal entsteht inaktiv und bleibt
        # es — aktiviert wird ausschliesslich auf Klick des Betriebs
        # (`channels.activate_channel`).
        #
        # `_geruest_objekt` nimmt ein BESTEHENDES Objekt, wenn der Betrieb
        # eines hat, und legt nur sonst eines an (idempotent, Wurzel 2): ein
        # abgebrochener Anlauf erzeugt also kein zweites.
        property_id = self._geruest_objekt(db, tenant_id, neues_konto=neues_konto)
        channex_property_id = self._registrierung_nachholen_und_lesen(
            db, tenant_id, property_id
        )
        log.info(
            "airbnb_uebernahme_objekt_bereit",
            tenant_id=tenant_id, property_id=property_id,
            channex_property_id=channex_property_id,
            hinweis="Anker fuer den Handshake - Kanal entsteht inaktiv",
        )

        return self._airbnb_link_ohne_objekt(
            db, tenant_id,
            portal_code=portal_code,
            redirect_uri=redirect_uri,
            account_id=account_id,
            channex_property_id=channex_property_id,
        )

    def kanal_aus_ruecksprung(
        self, ctx: AuthContext, *, channel_id: str, portal_code: str = "AirBNB",
        token: str | None = None,
    ) -> dict[str, Any]:
        """Der Ruecksprung von Airbnb — HIER entsteht zum ersten Mal etwas.

        Channex haengt nach erfolgreicher Autorisierung
        `?success=true&channel_id=<uuid>&token=<token>` an die `redirect_uri`.
        Diese Methode nimmt die Kanal-ID entgegen, prueft sie GEGEN CHANNEX und
        legt danach das Konto an.

        Warum erst hier (Vorgabe des Betreibers, 29.08.2026): Bis dahin
        entstanden Objekt, Channex-Property, Konto und Verbindung schon beim
        KLICK auf „verbinden". Wer den Airbnb-Login nie oeffnete oder abbrach
        — ein gesperrtes Airbnb-Konto genuegt —, hinterliess all das. Nach drei
        Klicks ohne einen einzigen Login standen 3 Konten, 3 Verbindungen und
        4 Registrierungen in der DB, dazu mehrere Properties im Channex-UI.

        FAIL-CLOSED (Wurzel 5): Der Kanal wird bei Channex nachgelesen, bevor
        irgendetwas geschrieben wird. Eine Kanal-ID aus der URL ist
        Client-Eingabe — kaeme sie ungeprueft in die DB, koennte ein fremder
        Kanal an diesen Betrieb gebunden werden (Wurzel 3).
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        log.info(
            "airbnb_ruecksprung_start",
            tenant_id=tenant_id, channel_id=channel_id,
            portal_code=portal_code, token_da=bool(token),
        )

        # 1) Kanal bei Channex nachlesen. Das ist die Pruefung UND die Quelle
        #    fuer die Host-ID.
        try:
            kanal = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            log.warning(
                "airbnb_ruecksprung_kanal_nicht_lesbar",
                tenant_id=tenant_id, channel_id=channel_id,
                status=exc.status_code, grund=exc.message[:200],
            )
            raise self._wrap_channex(exc) from exc

        attrs = (kanal.get("data") or {}).get("attributes") or {}
        gruppe = str(attrs.get("group_id") or "")

        # 2) GEHOERT der Kanal diesem Betrieb? Channex' Gruppe muss unsere
        #    sein. Ohne diese Pruefung liesse sich per manipulierter URL ein
        #    fremder Kanal an den eigenen Betrieb haengen (Wurzel 3).
        eigene = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        eigene_gruppe = str(eigene[0]["channex_group_id"]) if eigene else ""
        if not eigene_gruppe or (gruppe and gruppe != eigene_gruppe):
            log.warning(
                "airbnb_ruecksprung_fremde_gruppe",
                tenant_id=tenant_id, channel_id=channel_id,
                kanal_gruppe=gruppe, eigene_gruppe=eigene_gruppe,
            )
            raise ChannelManagerError(
                "Dieser Kanal gehoert nicht zu deinem Betrieb.",
                status_code=403,
            )

        status = airbnb_oauth.parse_connection_status(kanal)
        host_id = status["host_id"]
        verbunden = bool(status["connected"])
        log.info(
            "airbnb_ruecksprung_kanal_zustand",
            tenant_id=tenant_id, channel_id=channel_id,
            host_id=host_id, verbunden=verbunden,
            settings_da=bool(attrs.get("settings")),
        )

        # 3) ERST JETZT das Konto. Idempotent ueber die Kanal-ID (Wurzel 2):
        #    derselbe Ruecksprung zweimal ergibt dieselbe Zeile.
        konto_id = konto_sicherstellen(
            db, tenant_id,
            portal_code=portal_code, channel_id=channel_id, host_id=host_id,
        )
        if not konto_id:
            log.warning(
                "airbnb_ruecksprung_kein_konto",
                tenant_id=tenant_id, channel_id=channel_id,
            )
            raise ChannelManagerError(
                "Das Portal-Konto konnte nicht angelegt werden.",
                status_code=502,
            )

        # `connected_at` NUR bei echter Verbindung — es ist der Zeitpunkt der
        # Bestaetigung durch das PORTAL, nicht unserer Verarbeitung
        # (Wurzel 5b). Ohne Tokens ist der Kanal zwar da, aber nichts bestaetigt.
        if verbunden:
            db.table("ota_account").update(
                {"connected_at": "now()", "is_active": True, "last_error": None}
            ).eq("tenant_id", tenant_id).eq("id", konto_id).is_(
                "connected_at", "null"
            ).execute()

        log.info(
            "airbnb_ruecksprung_fertig",
            tenant_id=tenant_id, channel_id=channel_id,
            konto_id=konto_id, host_id=host_id, verbunden=verbunden,
            hinweis="Konto angelegt - Objekte folgen mit der Uebernahme",
        )
        return {
            "account_id": konto_id,
            "channel_id": channel_id,
            "host_id": host_id,
            "verbunden": verbunden,
        }

    @staticmethod
    def _gruppe_des_betriebs(db: Client, tenant_id: str) -> str:
        """Channex-Gruppe des Betriebs — fail-closed, wenn es keine gibt.

        Sie haengt am TENANT, nicht an einer Property. Deshalb laesst sie sich
        pruefen, BEVOR ein Objekt entsteht: ohne Gruppe gibt es keinen
        Autorisierungslink, und dann darf auch kein Objekt angelegt werden, das
        anschliessend nutzlos herumsteht (Wurzel 1 — kein halber Zustand).
        """
        grp = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not grp:
            log.warning(
                "airbnb_link_ohne_gruppe",
                tenant_id=tenant_id,
                hinweis="channex_group_map leer - Betrieb nicht bei Channex angelegt",
            )
            raise ChannelManagerError(
                "Dieser Betrieb ist beim Channel-Manager noch nicht angelegt. "
                "Bitte den Support kontaktieren.",
                status_code=409,
            )
        return str(grp[0]["channex_group_id"])

    @staticmethod
    def _offene_registrierung(
        db: Client, tenant_id: str, property_id: str
    ) -> str | None:
        """Die Channex-UUID der OFFENEN Zuordnung des Objekts, sonst None.

        Der Filter `deleted_at is null` ist hier die ganze Methode (Wurzel 3:
        Load und Scope nicht trennen, sonst vergisst man den Scope). Ohne ihn
        entscheidet bei mehreren Zeilen der Planner, welche `limit(1)` liefert:
        gemessen am 17.09.2026 an „FeWo *Stjerneskud*" kam reproduzierbar die
        GESCHLOSSENE Zeile zurueck, deren Channex-Property bei Channex mit 404
        antwortet. Der Autorisierungslink waere damit gegen eine nicht mehr
        existierende Property gebaut worden — und weil der Idempotenz-Zweig
        genau diese UUID als „schon registriert" liest, haette der Fehler sich
        auch nie von selbst korrigiert.

        Nicht dasselbe wie der Backstop aus 0427: der verbietet geschlossen +
        `sync_enabled`. Hier fehlte der Filter auf `deleted_at`, der Fund beisst
        also auch bei sauber abgeschalteten Alt-Zeilen weiter.
        """
        zeilen = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        if not zeilen or not zeilen[0].get("channex_property_id"):
            return None
        return str(zeilen[0]["channex_property_id"])

    def _registrierung_nachholen_und_lesen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str:
        """Objekt bei Channex registrieren und dessen Channex-UUID liefern.

        `_registrierung_nachholen` (oauth_channels) legt die Channex-Property an
        und schreibt die Zuordnung nach `channex_property_map`, gibt die UUID
        aber nicht zurueck. Genau die braucht der Autorisierungslink.

        Idempotent (Wurzel 2): ist das Objekt schon registriert, wird die
        vorhandene UUID gelesen und NICHT neu angelegt — sonst entstuende bei
        jedem abgebrochenen Anlauf eine weitere Channex-Property.
        """
        channex_property_id = self._offene_registrierung(db, tenant_id, property_id)
        if channex_property_id:
            log.info(
                "airbnb_registrierung_vorhanden",
                tenant_id=tenant_id, property_id=property_id,
                channex_property_id=channex_property_id,
            )
            return channex_property_id

        self._registrierung_nachholen(db, tenant_id, property_id)

        channex_property_id = self._offene_registrierung(db, tenant_id, property_id)
        if not channex_property_id:
            # Fail-closed (Wurzel 5): ohne Channex-Property gibt es keinen Link.
            # Lieber hier mit Grund abbrechen als Channex mit leerem
            # `properties` anfragen und ein nacktes 422 durchreichen.
            log.warning(
                "airbnb_registrierung_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
            )
            raise ChannelManagerError(
                "Das Objekt konnte bei den Portalen nicht angelegt werden. "
                "Bitte versuche es erneut.",
                status_code=502,
            )
        log.info(
            "airbnb_registrierung_angelegt",
            tenant_id=tenant_id, property_id=property_id,
            channex_property_id=channex_property_id,
        )
        return channex_property_id

    def _airbnb_link_ohne_objekt(
        self, db: Client, tenant_id: str, *, portal_code: str,
        redirect_uri: str | None, account_id: str | None,
        channex_property_id: str,
    ) -> dict[str, Any]:
        """Airbnb-Autorisierungslink holen — mit dem Objekt als Anker.

        Es entsteht hier KEIN Konto und KEINE Verbindungszeile. Das Objekt und
        seine Channex-Property hat der Aufrufer (`uebernahme_starten`) bereits
        bereitgestellt; Channex nimmt den Link nur mit mindestens einer
        Property an (dreimal live gemessen: weglassen und `[]` -> 422,
        `null` -> 500).

        Kosten entstehen dadurch nicht: abgerechnet wird nach AKTIVEN
        Kanalverbindungen, und der Kanal entsteht inaktiv.

        Konto, Verbindung und die Objekte aus den Airbnb-Anzeigen entstehen
        erst mit dem Ruecksprung `?success=true&channel_id=…&token=…`.

        Jeder Schritt wird protokolliert: dieser Weg laeuft ueber vier
        Channex-Aufrufe, und faellt einer aus, muss ablesbar sein, welcher.
        """
        # 1) Gruppe des Betriebs. Sie haengt am TENANT, nicht an einer
        #    Property — die Property kommt separat als Anker dazu.
        group_id = self._gruppe_des_betriebs(db, tenant_id)
        log.info(
            "airbnb_link_gruppe", tenant_id=tenant_id, group_id=group_id
        )

        # 2) Frischer JWT je Versuch (kein Cache).
        try:
            one_time = self._channex.create_one_time_token(
                property_id=None, group_id=group_id, username=tenant_id
            )
            jwt = self._channex.exchange_one_time_token(one_time)
            log.info("airbnb_link_jwt_geholt", tenant_id=tenant_id)
        except ChannexError as exc:
            log.warning(
                "airbnb_link_jwt_fehlgeschlagen",
                tenant_id=tenant_id, status=exc.status_code,
                grund=exc.message[:200],
            )
            raise self._wrap_channex(exc) from exc

        # 3) Den Link holen. `channel_id` bleibt weg — Channex legt den Kanal
        #    selbst an, sobald die Autorisierung eintrifft.
        request_id = str(uuid4())
        # Lokaler Import: `oauth_channels` ist ein Mixin DERSELBEN Klasse,
        # ein Modul-Import waere ein Zirkel.
        from .oauth_channels import _geprueftes_ziel

        ziel = _geprueftes_ziel(redirect_uri)
        try:
            oauth_url = self._channex.create_airbnb_connection_link(
                jwt=jwt,
                connection_link=airbnb_oauth.connection_link_body(
                    group_id=group_id,
                    channex_property_id=channex_property_id,
                    channel_id=None,
                    request_id=request_id,
                    title=self._portal_label(portal_code),
                    settings=None,
                    konto_token=account_id,
                    redirect_uri=ziel,
                    failure_redirect_uri=ziel,
                ),
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_link_fehlgeschlagen",
                tenant_id=tenant_id, status=exc.status_code,
                grund=exc.message[:300], request_id=request_id,
            )
            raise self._wrap_channex(exc) from exc

        log.info(
            "airbnb_link_erzeugt",
            tenant_id=tenant_id, group_id=group_id, request_id=request_id,
            channex_property_id=channex_property_id, ziel=ziel,
            hinweis="Kanal entsteht erst beim Ruecksprung - und dann inaktiv",
        )
        return {
            "channel_id": None,
            "oauth_url": oauth_url,
            "portal": self._portal_label(portal_code),
            "status": "pending",
            "account_id": account_id,
        }

    def _geruest_objekt(
        self, db: Client, tenant_id: str, *, neues_konto: bool = False
    ) -> str:
        """Objekt-ID, an der die Airbnb-Autorisierung hängen kann.

        ERSTES Konto: ein bestehendes Objekt, wenn der Betrieb eines hat — es
        gehört ja demselben Zugang. Sonst ein Gerüst (der Weg, den auch das
        Onboarding nimmt: `ChannelConnectButton` ohne `presetPropertyId` →
        `startAirbnbUebernahme()`).

        ZWEITES Konto (`neues_konto=True`): IMMER ein eigenes Gerüst. Kein
        Objekt des ersten Zugangs darf herhalten, auch nicht vorübergehend —
        die 18 Objekte von Konto A haben mit Konto B nichts zu tun. Genau das
        war am 07.08.2026 der Fehler: der Aufhänger „Feriehus Line" landete am
        Kanal des zweiten Kontos und stand danach in der Oberfläche auf
        „Pausiert".

        Der Zirkel dahinter ist nicht auflösbar, nur eingrenzbar: Channex
        verlangt für den Autorisierungslink mindestens eine Property (live
        gemessen: `properties: []` → 422 „should have at least 1 item(s)"), das
        zu importierende Listing existiert bei uns aber erst NACH der
        Autorisierung. Das Gerüst überbrückt genau diese Lücke und wird beim
        Import mit dem ersten Listing dieses Kontos gefüllt — es bleibt also
        kein Geisterobjekt zurück (`_objekt_schreiben`).
        """
        if not neues_konto:
            vorhanden = (
                db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .neq("title", GERUEST_TITEL)
                .order("created_at")
                .limit(1)
                .execute()
            ).data
            if vorhanden:
                return vorhanden[0]["id"]

        # Ein früheres Gerüst wiederverwenden, bevor ein weiteres entsteht
        # (Wurzel 2). Der Weg zum zweiten Konto führt über Airbnb und zurück;
        # bricht der Kunde dort ab, legte sonst jeder Anlauf ein weiteres an.
        offen = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("title", GERUEST_TITEL)
            .eq("status", "draft")
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        if offen:
            log.info(
                "airbnb_uebernahme_geruest_wiederverwendet",
                tenant_id=tenant_id, property_id=offen[0]["id"],
            )
            return offen[0]["id"]

        # Land des BETRIEBS mitgeben — nicht geraten, sondern der echte Wert aus
        # `tenants.country` (im Onboarding erfasst). Nötig, weil Channex daraus
        # die `timezone` ableitet und sie für eine Property PFLICHT ist. Ohne sie
        # meldet Channex' Readiness-Check
        #     {"field": "timezone", "error_code": "required",
        #      "entity": "Property"}
        # und der Kanal bleibt unvollständig — dann wird der Airbnb-Connect gar
        # nicht erst freigegeben ("Once all required fields are filled, the
        # Connect to Airbnb button becomes active", help.channex.io). Genau
        # daran hing die Übernahme: Kanal und Link entstanden, aber Channex
        # vergab keine Tokens.
        land = self._tenant_country(db, tenant_id)
        if not land:
            # Fail-closed statt ein Property ohne Zeitzone anzulegen: das wäre
            # bei Channex dauerhaft unvollständig und der Connect bliebe
            # gesperrt — mit einer Fehlermeldung, die den Grund nicht nennt.
            raise ChannelManagerError(
                "Für diesen Betrieb ist kein Land hinterlegt. Ergänze es unter "
                "„Konto“ — Airbnb braucht daraus die Zeitzone des Objekts.",
                status_code=422,
            )
        neu = (
            db.table("properties")
            .insert({
                "tenant_id": tenant_id,
                "title": GERUEST_TITEL,
                "status": "draft",
                "country": land,
            })
            .execute()
        ).data
        if not neu:
            raise ChannelManagerError(
                "Übernahme-Objekt konnte nicht angelegt werden.", status_code=500
            )
        property_id = neu[0]["id"]
        # Einheit sofort mit (0265): ohne sie ist das Objekt unverkäuflich und
        # eine eingehende Airbnb-Buchung liefe in 22023.
        self._ensure_default_unit(db, tenant_id, property_id, GERUEST_TITEL)
        log.info(
            "airbnb_uebernahme_geruest_angelegt",
            tenant_id=tenant_id, property_id=property_id,
        )
        return property_id

    @staticmethod
    def _tenant_country(db: Client, tenant_id: str) -> str | None:
        """Land des Betriebs (`tenants.country`, ISO-2). Kein Default: fehlt es,
        gibt None zurück und der Aufrufer meldet einen Datenfehler statt ein
        Land zu raten (Wurzel 4) — ein falsches Land bedeutet eine falsche
        Zeitzone und damit falsche An-/Abreisetage an den Portalen."""
        res = (
            db.table("tenants")
            .select("country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return res[0].get("country") if res else None

    # -- c) Listings holen und Objekte daraus machen --------------------------
    def listings_uebernehmen(
        # `portal_code` gab es hier als Parameter, wurde aber nie gelesen und von
        # keinem Aufrufer gesetzt: die Methode arbeitet ausschliesslich mit
        # Airbnb (`channels/mapping_details` eines Airbnb-Zugangs). Ein Argument,
        # das aussieht als waehle es das Portal, aber nichts tut, ist
        # schlimmer als keines — wer "Booking" uebergibt, bekaeme trotzdem
        # Airbnb.
        self, ctx: AuthContext, *, account_id: str | None = None,
    ) -> dict[str, Any]:
        """Airbnb-Listings eines verbundenen Kontos als Objekte übernehmen.

        `account_id` wählt den Zugang. Pflicht, sobald der Betrieb mehr als
        einen führt — sonst landeten die Anzeigen des einen Vermieters unter
        dem Konto eines anderen.

        Liest die Listings über `channels/mapping_details` und schreibt sie in
        unsere DB: das erste füllt das Gerüst-Objekt, jedes weitere wird ein
        eigenes Objekt. Idempotent über `airbnb_listing_id` (Wurzel 2) — ein
        zweiter Aufruf aktualisiert, statt zu verdoppeln.

        WAS DIESER SCHRITT NICHT TUT — und WARUM (jetzt gemessen, nicht
        vermutet): Er legt KEINE Preise an, weil Airbnb über Channex keine
        liefert. Der einzige Weg an die Listings gibt genau sieben Felder her
        (`id, title, type, city, country_code, occupancies, quality_status`);
        jeder Content-/Preis-Pfad antwortet mit 500 bzw. 404 (Belege in
        `airbnb_listings_aus_mapping_details` und `_listing_zu_objekt`). Airbnb
        ist ein Push-Kanal: Preise und Verfügbarkeit gehen von uns DORTHIN.
        Die Objekte entstehen darum mit `status='draft'` und ohne Rate-Plan; der
        Betrieb setzt den Preis EINMAL, danach fließt er zu Airbnb. Ein
        geratener Preis wäre bei der ersten Buchung echtes Geld (Wurzel 4).
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # WELCHES Konto übernommen wird, muss der Aufrufer sagen können.
        #
        # Vorher stand hier ein `limit(1)` über die Verbindungen — bei einem
        # Betrieb mit zwei Zugängen (0304) traf das immer denselben Kanal, und
        # die Listings des zweiten Kontos kamen nie an. Für eine Agentur mit
        # hundert Vermietern wäre die Übernahme damit unbrauchbar.
        #
        # Quelle ist jetzt `ota_account` (das Konto trägt den Kanal), nicht die
        # Objekt-Verbindungen: ein frisch verbundenes Konto hat noch gar keine
        # Objekte — genau dann soll die Übernahme ja laufen.
        konten = [
            k for k in airbnb_konten(db, tenant_id) if k.get("channex_channel_id")
        ]
        if account_id:
            konten = [k for k in konten if str(k["id"]) == account_id]
            if not konten:
                raise ChannelManagerError("Konto nicht gefunden.", status_code=404)
        if not konten:
            raise ChannelManagerError(
                "Airbnb ist noch nicht verbunden. Starte die Übernahme und "
                "autorisiere Airbnb zuerst.",
                status_code=409,
            )
        if len(konten) > 1:
            # Nicht raten, welches gemeint ist (Wurzel 4): bei mehreren Zugängen
            # entscheidet der Betrieb, sonst importierte man Torstens Anzeigen
            # womöglich unter dem Konto eines anderen Vermieters.
            raise ChannelManagerError(
                "Es sind mehrere Airbnb-Konten verbunden. Wähle das Konto aus, "
                "dessen Anzeigen übernommen werden sollen.",
                status_code=409,
            )
        channel_id = konten[0]["channex_channel_id"]

        # Jeden Channex-Aufruf dieses Ablaufs in channex_debug_log schreiben.
        # Ohne gesetzten Trace-Kontext schreibt der Sink nichts, und dann ist
        # NUR am Serverlog erkennbar, was Channex geantwortet hat — im
        # Debug-Bereich der Anwendung stand nichts.
        self._trace_step(
            tenant_id=tenant_id, property_id=None,
            step="airbnb_uebernahme",
        )

        listings = self._airbnb_listings_lesen(channel_id)
        # Die ROHE Liste loggen, bevor sie übersetzt wird: die Feldnamen von
        # Channex/Airbnb sind nicht dokumentiert, und nur hier ist zu sehen,
        # welche Schlüssel wirklich kommen. Ohne dieses Log bliebe bei einem
        # unpassenden Namen nur "0 Objekte übernommen" ohne Grund.
        log.info(
            "airbnb_uebernahme_listings_roh",
            tenant_id=tenant_id, channel_id=channel_id,
            anzahl=len(listings),
            schluessel=sorted(listings[0].keys()) if listings else [],
            erstes_listing=listings[0] if listings else None,
        )
        if not listings:
            raise ChannelManagerError(
                "Airbnb hat keine Objekte zurückgegeben. Prüfe, ob die "
                "Verbindung bestätigt wurde und das Konto Objekte hat.",
                status_code=409,
            )

        uebersprungen = max(0, len(listings) - _MAX_LISTINGS)
        if uebersprungen:
            # Keine stille Kürzung: was über der Grenze liegt, wird benannt.
            log.warning(
                "airbnb_uebernahme_ueber_grenze",
                tenant_id=tenant_id, gesamt=len(listings), grenze=_MAX_LISTINGS,
            )
        angelegt = aktualisiert = 0
        # Die Objekte DIESES Kontos — nur sie gehören später an seinen Kanal.
        uebernommen: list[str] = []
        # Über den KANAL, nicht über ein Objekt: die Objekte dieses Kontos
        # entstehen hier gerade erst aus den Listings.
        zugang = self._airbnb_token_am_kanal(channel_id)
        for listing in listings[:_MAX_LISTINGS]:
            row = self._listing_zu_objekt(listing)
            if row is not None and zugang:
                self._titel_in_landessprache(row, zugang[0])
            if row is None:
                # WELCHES Listing übersprungen wurde und warum — sonst ist ein
                # fehlender Titel/eine fehlende ID nicht von einem Fehler in
                # unserer Feldzuordnung zu unterscheiden.
                log.warning(
                    "airbnb_uebernahme_listing_uebersprungen",
                    tenant_id=tenant_id,
                    grund="ohne id oder titel",
                    vorhandene_schluessel=sorted(listing.keys()),
                )
                uebersprungen += 1
                continue
            objekt_id, neu = self._objekt_schreiben(db, tenant_id, row)
            uebernommen.append(objekt_id)
            # JEDES übernommene Objekt bei Channex registrieren. Ohne diesen
            # Schritt existiert nur die lokale Zeile, aber keine
            # Channex-Property — und damit kein Ziel, auf das die Airbnb-Anzeige
            # gemappt werden könnte. Live nachgewiesen am Beta-Betrieb: 18
            # Objekte + 18 Einheiten in der DB, aber nur 2
            # `channex_property_map`-Zeilen, und im Channex-UI standen alle 18
            # Anzeigen auf „Not mapped".
            #
            # `_registrierung_nachholen` ist der richtige Weg (nicht
            # `_ensure_property_registered`): der verlangt über `sync_content`
            # einen Preis und wirft ohne einen 422 — und einen Preis liefert
            # Airbnb nicht. Die Übernahme registriert deshalb OHNE Preis, genau
            # wie beim Gerüst-Objekt: Property ja, Room-Type/Rate erst, wenn ein
            # Preis da ist (Wurzel 4 — kein erfundener Preis).
            registriert = True
            try:
                self._registrierung_nachholen(db, tenant_id, objekt_id)
            except (ChannexError, ChannelManagerError) as exc:
                # Ein Objekt, das sich nicht registrieren lässt, darf die
                # übrigen 17 nicht mitreißen — aber es wird GENANNT, nicht
                # still übergangen (Wurzel 5).
                registriert = False
                log.warning(
                    "airbnb_uebernahme_registrierung_fehlgeschlagen",
                    tenant_id=tenant_id, property_id=objekt_id,
                    titel=row.get("title"),
                    error=getattr(exc, "message", str(exc)),
                )
            log.info(
                "airbnb_uebernahme_objekt",
                tenant_id=tenant_id,
                property_id=objekt_id,
                airbnb_listing_id=row.get("airbnb_listing_id"),
                titel=row.get("title"),
                neu_angelegt=neu,
                bei_channex_registriert=registriert,
                uebernommene_felder=sorted(row.keys()),
            )
            if neu:
                angelegt += 1
            else:
                aktualisiert += 1

        # Alle registrierten Objekte an DEN Kanal hängen („Affected Properties").
        # Ein Airbnb-Konto hat bei Channex genau EINEN Kanal, und nur die
        # Properties, die an diesem Kanal hängen, können überhaupt eine Anzeige
        # zugeordnet bekommen. Ein zweiter Kanal ist keine Option — Airbnb
        # antwortet darauf mit `has_already_channel` („This Airbnb user is
        # already connected"); Channex' eigene Anleitung sagt genau das: den
        # bestehenden Kanal öffnen und die weiteren Objekte unter „Affected
        # Properties" ergänzen. Live nachgewiesen: am Kanal hing nur die eine
        # Gerüst-Property, während 18 Anzeigen auf „Not mapped" standen.
        am_kanal = self._kanal_properties_nachziehen(
            db, tenant_id, channel_id, uebernommen
        )

        # Den Aufhänger wieder abhängen (Wurzel 1: Gegenzustand).
        #
        # Beim Verbinden eines zweiten Kontos MUSS eine fremde Property am Kanal
        # hängen — Channex führt `properties` als Pflichtfeld und gibt den
        # Airbnb-Connect sonst nicht frei (live gemessen: check_readiness meldet
        # `{"field": "properties", "error_code": "required"}`, und der Link
        # entsteht zwar, bringt aber nie Tokens). Jetzt sind die echten Objekte
        # dieses Kontos da, und der Aufhänger hat seinen Zweck erfüllt. Bleibt er
        # hängen, steht ein Objekt an zwei Kanälen und fällt in unserer
        # Oberfläche auf „Pausiert".
        self._aufhaenger_abhaengen(db, tenant_id, channel_id, uebernommen)

        log.info(
            "airbnb_uebernahme_fertig",
            tenant_id=tenant_id, angelegt=angelegt,
            aktualisiert=aktualisiert, uebersprungen=uebersprungen,
            properties_am_kanal=am_kanal,
        )
        return {
            "created": angelegt,
            "updated": aktualisiert,
            "skipped": uebersprungen,
            "listings_gefunden": len(listings),
        }

    def _aufhaenger_abhaengen(
        self, db: Client, tenant_id: str, channel_id: str,
        objekt_ids: list[str],
    ) -> None:
        """Fremde Properties vom Kanal nehmen, sobald eigene da sind.

        Am Kanal darf nur stehen, was diesem Konto gehört. Alles andere ist der
        Aufhänger, den Channex beim Verbinden erzwungen hat.

        Sicherung gegen den Totalschaden: passiert NUR, wenn danach mindestens
        eine eigene Property übrig bleibt. Sonst stünde der Kanal wieder ohne
        `properties` da — unvollständig und ohne Connect-Freigabe. Lieber ein
        überzähliger Eintrag als ein toter Kanal (Wurzel 5).

        Best effort: schlägt es fehl, ist die Übernahme trotzdem gelaufen.
        """
        if not objekt_ids:
            return
        maps = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .in_("property_id", objekt_ids)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        eigene = {
            str(m["channex_property_id"]) for m in maps
            if m.get("channex_property_id")
        }
        if not eigene:
            return
        try:
            kanal = self._channex.get_channel(channel_id)
            attrs = (kanal.get("data") or {}).get("attributes") or {}
            vorhanden = {str(p) for p in (attrs.get("properties") or [])}
            fremd = vorhanden - eigene
            if not fremd:
                return
            self._channex.update_channel(
                channel_id, {"properties": sorted(vorhanden - fremd)}
            )
            log.info(
                "airbnb_uebernahme_aufhaenger_abgehaengt",
                tenant_id=tenant_id, channel_id=channel_id,
                abgehaengt=len(fremd), verbleibend=len(vorhanden - fremd),
            )
        except ChannexError as exc:  # noqa: BLE001 — Aufräumen kippt nicht die Übernahme
            log.warning(
                "airbnb_uebernahme_aufhaenger_abhaengen_fehlgeschlagen",
                tenant_id=tenant_id, channel_id=channel_id,
                error=exc.message,
            )

    def _kanal_properties_nachziehen(
        self, db: Client, tenant_id: str, channel_id: str,
        objekt_ids: list[str] | None = None,
    ) -> int:
        """Die Channex-Properties dieses Kontos an den Kanal hängen.

        Liefert die Anzahl am Kanal. Der PUT ERSETZT die Liste (kein Merge), also
        wird die bestehende gelesen und vereinigt — sonst verlöre ein Nachzug die
        vorher verbundenen Objekte (Wurzel 1). Idempotent: dieselbe Menge zweimal
        gesetzt ändert nichts (Wurzel 2).

        `objekt_ids` grenzt auf die gerade übernommenen Objekte ein. Ohne diese
        Grenze hing die Funktion ALLE Objekte des Betriebs an den Kanal — bei
        einem zweiten Zugang (0304) also auch die 18 des ersten. Ein Objekt
        gehört genau einem Airbnb-Konto; an einem fremden Kanal ist es dort
        bestenfalls „Not mapped" und in unserer Oberfläche „Pausiert" (live am
        07.08.2026 an „Rævlingehuset").
        """
        frage = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
        )
        if objekt_ids is not None:
            if not objekt_ids:
                return 0
            frage = frage.in_("property_id", objekt_ids)
        maps = (frage.execute()).data or []
        unsere = {
            str(m["channex_property_id"]) for m in maps
            if m.get("channex_property_id")
        }
        if not unsere:
            return 0
        try:
            kanal = self._channex.get_channel(channel_id)
            attrs = (kanal.get("data") or {}).get("attributes") or {}
            vorhanden = {str(p) for p in (attrs.get("properties") or [])}
            fehlend = unsere - vorhanden
            if fehlend:
                self._channex.update_channel(
                    channel_id, {"properties": sorted(vorhanden | unsere)}
                )
            log.info(
                "airbnb_uebernahme_kanal_properties",
                tenant_id=tenant_id, channel_id=channel_id,
                vorher=len(vorhanden), ergaenzt=len(fehlend),
                gesamt=len(vorhanden | unsere),
            )
            return len(vorhanden | unsere)
        except (ChannexError, ChannelManagerError) as exc:
            # Nicht den ganzen Import kippen: die Objekte sind angelegt und
            # registriert, nur die Kanal-Zuordnung fehlt noch. Der Grund wird
            # genannt, damit es nicht als „fertig" durchgeht (Wurzel 5).
            log.warning(
                "airbnb_uebernahme_kanal_properties_fehlgeschlagen",
                tenant_id=tenant_id, channel_id=channel_id,
                error=getattr(exc, "message", str(exc)),
            )
            return 0

    def _airbnb_listings_lesen(self, channel_id: str) -> list[dict[str, Any]]:
        """Listings des autorisierten Airbnb-Kontos holen.

        Weg: `POST channels/mapping_details` mit `{channel, settings}`. Die
        `settings` sind die des Kanals — dort liegen nach dem Autorisieren die
        Airbnb-Tokens, und ohne sie kennt Channex keine Listings.

        WARUM NICHT DER PROXY: Ein früherer Anlauf rief
        `channels/{id}/proxy/hosting/listings` auf und bekam 500. Der Pfad war
        von mir falsch abgeleitet — `hosting/listings` steht im Channex-Bundle
        nur als WEBLINK auf airbnb.com
        (`https://www.airbnb.com/hosting/listings/editor/{id}/details/`), nicht
        als API-Pfad. Die Bundle-Suche zeigt genau drei `meta/airbnb`-Routen
        (connection_link, full_sync_listing, disconnect_listing) und KEINE, die
        eine Listing-Liste liefert.

        Channex' eigene Zuordnungs-Maske macht es so (aus dem Bundle,
        `loadMappingDetails`):
            const { token_invalid } = model.settings || {}
            if (!selectedChannel || token_invalid) return   // Abbruch
            getMappingDetails({ settings, channel })
        Sie bricht also ab, solange keine Tokens da sind — dieselbe Bedingung
        wird hier geprüft, damit der Kunde eine verständliche Meldung bekommt
        statt eines rohen 400/422 von Channex (Wurzel 5).
        """
        try:
            kanal = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        attrs = (kanal.get("data") or {}).get("attributes") or {}
        settings = attrs.get("settings") or {}
        # Kanal-Zustand vollständig loggen: DAS ist die Stelle, an der sich
        # entscheidet, ob Airbnb autorisiert hat. `tokens` selbst wird NICHT
        # geloggt (Zugangsdaten gehören nicht ins Log) — nur, ob sie da sind.
        log.info(
            "airbnb_uebernahme_kanal_zustand",
            channel_id=channel_id,
            is_active=attrs.get("is_active"),
            titel=attrs.get("title"),
            properties=attrs.get("properties"),
            settings_schluessel=sorted(settings.keys()),
            hat_tokens=isinstance(settings.get("tokens"), dict),
            host_id=(settings.get("tokens") or {}).get("user_id")
            if isinstance(settings.get("tokens"), dict) else None,
            token_invalid=settings.get("token_invalid"),
        )
        # Fail-closed VOR dem Aufruf: ohne Tokens hat das Portal die
        # Autorisierung nicht bestätigt. Häufigster Grund bei Airbnb: dort ist
        # bereits eine andere Software verbunden — Airbnb erlaubt nur EINE
        # ("You may only authorize one property management app to manage your
        # account"). Das ist der Satz, den der Kunde auf airbnb.com sieht, und
        # er gehört hierher, statt ihn als "nicht lesbar" zu verschleiern.
        # ZWEI Faelle, die frueher DIESELBE Meldung bekamen — und das war
        # irrefuehrend (live am 29.08.2026 im frischen Testkonto: der Kanal war
        # gerade erst angelegt, `settings_schluessel=[]`, und der Kunde las
        # trotzdem „in deinem Airbnb-Konto ist bereits eine andere Software
        # verbunden". Er suchte daraufhin nach einer Verbindung, die es nie
        # gab).
        #
        #   settings LEER            → der OAuth-Durchlauf hat NIE
        #                              stattgefunden. Der Kanal ist eine
        #                              Huelle; es fehlt schlicht der Klick auf
        #                              „Airbnb verbinden".
        #   settings da, aber
        #   token_invalid gesetzt    → Airbnb hat die Autorisierung ABGELEHNT
        #                              oder zurueckgezogen. DAS ist der Fall,
        #                              in dem meist eine andere Software haengt
        #                              (Airbnb erlaubt nur EINE).
        if not settings:
            raise ChannelManagerError(
                "Dieses Portal ist noch nicht autorisiert. Klicke auf "
                "'Airbnb verbinden' und melde dich im Airbnb-Fenster an — "
                "erst danach können deine Inserate geholt werden.",
                status_code=409,
            )
        if settings.get("token_invalid"):
            raise ChannelManagerError(
                "Airbnb hat die Verbindung nicht bestätigt. Meist liegt es "
                "daran, dass in deinem Airbnb-Konto bereits eine andere "
                "Software verbunden ist — Airbnb erlaubt nur EINE. Trenne die "
                "alte Verbindung in deinem Airbnb-Konto (Konto → Datenschutz "
                "und Freigabe → Verbundene Apps) und verbinde dann hier erneut.",
                status_code=409,
            )

        try:
            res = self._channex.get_channel_mapping_details(
                channel="AirBNB", settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        return self.airbnb_listings_aus_mapping_details(res)

    @staticmethod
    def airbnb_listings_aus_mapping_details(
        res: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Listings aus einer Airbnb-`mapping_details`-Antwort ziehen.

        ECHTE Antwortform, live gemessen am autorisierten Kanal (04.08.2026,
        18 Listings):
            {"data": {"listing_id_dictionary": {"values": [
                {"id": "1133122057704952480", "type": "house",
                 "title": "013 Rævlingevej · The Fox House", "city": "Bindslev",
                 "country_code": "DK", "occupancies": [1,2,3,4,5,6],
                 "quality_status": "educate",
                 "synchronization_category": null}, …]}}}

        Das ist NICHT die Form, die `_normalize_mapping_rooms` für
        Booking.com (`data.rooms[]`) oder OpenChannel
        (`data.attributes.room_types[]`) kennt — Airbnb ist im Katalog
        `mapping_mode: "listing"`, und die Listing-Liste steht ausschließlich
        unter diesem Schlüssel. Vorher las der Code `listings`/`rooms`/
        `room_types` und bekam darum immer eine leere Liste, obwohl der Abruf
        200 lieferte („Das Portal liefert keine Zimmer").

        Fehlt der Schlüssel ganz, ist das ein Fehler und keine leere Übernahme
        (Wurzel 5) — sonst hieße es „0 Objekte übernommen", obwohl der Abruf
        misslang.
        """
        daten = res.get("data") if isinstance(res, dict) else None
        woerterbuch = (daten or {}).get("listing_id_dictionary")
        werte = (woerterbuch or {}).get("values")
        if isinstance(werte, list):
            return [w for w in werte if isinstance(w, dict)]
        raise ChannelManagerError(
            "Die Objektliste von Airbnb war nicht lesbar. Bitte später erneut "
            "versuchen.",
            status_code=502,
        )

    @staticmethod
    def _listing_zu_objekt(listing: dict[str, Any]) -> dict[str, Any] | None:
        """Ein Airbnb-Listing → properties-Spalten.

        WELCHE FELDER ES WIRKLICH GIBT (live gemessen, 04.08.2026, siehe
        `airbnb_listings_aus_mapping_details`): `id`, `title`, `type`, `city`,
        `country_code`, `occupancies`, `quality_status`,
        `synchronization_category`. Das ist ALLES, was Airbnb über Channex
        herausgibt.

        Was es damit NICHT gibt — und was der Kunde deshalb weiter selbst
        pflegt: Straße/PLZ, Koordinaten, Beschreibung, Fotos, Ausstattung und
        **Preise**. Es gibt bei Channex keinen Airbnb-Content-Abruf: die
        Proxy-Pfade (`proxy/listings`, `proxy/v2/listings`,
        `proxy/v2/calendars`, `proxy/v2/pricing_settings`) antworten alle mit
        HTTP 500, `channels/{id}/listings` mit 404. Airbnb ist ein
        Push-Kanal — Channex SENDET Preise/Verfügbarkeit dorthin, es liest sie
        nicht zurück (dieselbe Einbahnstraße wie beim ARI-Readback,
        `channex_ari_shadow`). Hier wird darum nichts erfunden (Wurzel 4).

        `max_guests` kommt aus `occupancies` — Airbnb liefert die belegbaren
        Personenzahlen als Liste (`[1,2,3,4,5,6]`), das Maximum davon IST die
        Kapazität des Listings.

        Die STÜCKZAHL der Einheiten kommt NICHT mit: jedes übernommene Objekt
        bekommt genau eine Einheit (`_ensure_default_unit`). Das ist keine
        Abkürzung, sondern die Grenze der Datenquelle — Lodgify sagt für seinen
        Airbnb-Import dasselbe („Room types or number of units ✖ — You need to
        set this up in your Overview section"). Wer mehrere identische Einheiten
        unter einem Typ führt, ergänzt sie unter „Objekte".

        Ohne ID oder Titel ist das Listing nicht übernehmbar → None
        (überspringen, nicht mit Platzhaltern anlegen).
        """
        listing_id = listing.get("id")
        titel = listing.get("title")
        if not listing_id or not titel or not str(titel).strip():
            return None

        # Airbnbs `title` ist ein Anzeigename aus internem Namen UND Gast-Titel
        # („020 Lille Lægehus (1966) · FeWo Lille Lægehus"). Unverändert
        # übernommen stand die interne Bezeichnung im Gast-Titel; getrennt
        # bleibt sie im internen Namen, wo sie hingehört.
        gast_titel, intern = ali.titel_trennen(str(titel))
        row: dict[str, Any] = {
            "airbnb_listing_id": str(listing_id),
            "title": gast_titel,
        }
        if intern:
            # NICHT als `type_attributes` in die Zeile: der Update-Pfad schreibt
            # `row` direkt, ein ganzes JSON-Objekt würde die übrigen
            # Objekt-Details ersetzen (Wurzel 1). `_objekt_schreiben` führt den
            # Wert unter diesem Sonderschlüssel getrennt zusammen.
            row["_internal_name"] = intern
        for spalte, schluessel in (("city", "city"), ("country", "country_code")):
            wert = listing.get(schluessel)
            if wert:
                row[spalte] = str(wert).strip()

        belegungen = [
            b for b in (listing.get("occupancies") or [])
            if isinstance(b, int) and b > 0
        ]
        if belegungen:
            row["max_guests"] = max(belegungen)

        # Währung UND Zeitzone kommen aus DEMSELBEN `country_code`. Beide sind
        # keine Erfindung (Wurzel 4), sondern Tatsachen über das Land: Dänemark
        # rechnet in DKK und liegt in Europe/Copenhagen. Ohne Währung lässt sich
        # kein Preisplan anlegen (`rate_plans.currency` NOT NULL), ohne Zeitzone
        # verweigert Channex die Aktivierung ("timezone required") — beides war
        # live der Grund, warum alle 18 übernommenen Objekte unbrauchbar blieben.
        # Unbekanntes oder mehrzoniges Land → Feld bleibt leer, nicht geraten.
        land = row.get("country")
        waehrung = _currency_for_country(land)
        if waehrung:
            row["currency"] = waehrung
        zone = _timezone_speicherbar(land)
        if zone:
            row["timezone"] = zone
        return row

    def _titel_in_landessprache(self, row: dict[str, Any], token: str) -> None:
        """Den Titel durch Airbnbs Namen in der LANDESSPRACHE ersetzen.

        Die Channex-Liste trägt nur Airbnbs englischen Anzeigenamen. Live
        gemessen am Beta-Betrieb (DK, 05.08.2026): 10 von 18 Objekten standen
        dadurch englisch bei uns, obwohl der Gastgeber sie dänisch benannt hat
        („Holiday house Fox's Den" statt „Feriehus Rævehulen", „The Fox House"
        statt „Rævlingehuset"). Der Gastgeber erkannte seine Häuser nicht wieder.

        Airbnbs eigene API hat den Namen je Sprache
        (`v2/listing_descriptions/{id}/{locale}` → `name`). Die Sprache kommt aus
        dem Land des Listings über `locale_order_for_country`, nicht geraten
        (Wurzel 4); ohne bekanntes Land bleibt der englische Titel stehen.

        Best effort: der Aufruf ist ein zusätzlicher Fremdzugriff. Antwortet er
        nicht, bleibt der bisherige Titel — die Übernahme darf daran nicht
        scheitern. Der interne Name (`_internal_name`) bleibt unberührt: er kommt
        aus dem Anzeigenamen und ist sprachneutral (Hausnummer/Code).
        """
        listing_id = row.get("airbnb_listing_id")
        sprachen = locale_order_for_country(row.get("country"))
        # Nur `en` in der Reihenfolge heißt: kein bekanntes Land → nichts zu tun.
        if not listing_id or sprachen == ["en"]:
            return
        for sprache in sprachen:
            if sprache == "en":
                break
            beschreibung = self.airbnb_beschreibung_direkt(
                token, str(listing_id), sprache
            )
            name = (beschreibung or {}).get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            gast_titel, _intern = ali.titel_trennen(name.strip())
            if gast_titel and gast_titel != row.get("title"):
                log.info(
                    "airbnb_titel_landessprache",
                    airbnb_listing_id=str(listing_id), sprache=sprache,
                    vorher=row.get("title"), nachher=gast_titel,
                )
                row["title"] = gast_titel
            return

    @staticmethod
    def _ohne_gepflegte_felder(
        row: dict[str, Any], vorhanden: dict[str, Any]
    ) -> dict[str, Any]:
        """Aus dem Land abgeleitete Felder nicht über gepflegte Werte schreiben.

        Währung und Zeitzone leitet die Übernahme aus `country_code` ab. Hat der
        Kunde sie am Objekt schon gesetzt, ist SEIN Wert die Wahrheit: ein Objekt
        auf Teneriffa mit Atlantic/Canary darf ein erneuter Abruf nicht auf
        Europe/Madrid zurückdrehen (Wurzel 1 — die Ableitung ist eine Starthilfe,
        keine dauernde Zuständigkeit). Nur LEERE Felder werden gefüllt.

        Dasselbe gilt für den TITEL: er ist der Name, unter dem das Objekt im
        Marktplatz und auf den Portalen steht. Wer ihn bei uns anpasst (etwa weil
        Airbnbs Gast-Titel Dänisch ist und der Betrieb Deutsch verkauft), darf
        ihn nicht beim nächsten Abruf zurückgesetzt bekommen. Das Gerüst-Objekt
        ist die Ausnahme — sein Platzhaltertitel IST der zu ersetzende Wert.
        """
        gefiltert = dict(row)
        for feld in ("currency", "timezone"):
            if vorhanden.get(feld):
                gefiltert.pop(feld, None)
        titel_alt = vorhanden.get("title")
        if titel_alt and str(titel_alt).strip() != GERUEST_TITEL:
            gefiltert.pop("title", None)
        return gefiltert

    def _objekt_schreiben(
        self, db: Client, tenant_id: str, row: dict[str, Any]
    ) -> tuple[str, bool]:
        """Objekt anlegen oder aktualisieren → (objekt_id, neu_angelegt).

        Die ID wird MITGEGEBEN, weil der Aufrufer das Objekt danach bei Channex
        registrieren muss — ohne Channex-Property gibt es kein Ziel, auf das
        eine Airbnb-Anzeige gemappt werden kann, und alle 18 blieben im
        Channex-UI auf „Not mapped".

        Idempotent über (tenant_id, airbnb_listing_id): derselbe Aufruf zweimal
        erzeugt kein zweites Objekt (Wurzel 2). Ein vorhandenes Gerüst-Objekt
        wird beim ERSTEN Listing gefüllt statt daneben ein weiteres anzulegen —
        sonst bliebe „Airbnb-Übernahme läuft" für immer als Geisterobjekt stehen
        (Wurzel 1: der Gegenzustand zum Anlegen ist das Füllen).
        """
        # Der interne Name ist keine Spalte, sondern ein Schlüssel IN
        # `type_attributes` — hier heraustrennen, damit er nie als Spalte an
        # PostgREST geht, und pro Pfad gezielt zusammenführen.
        row = dict(row)
        intern = row.pop("_internal_name", None)

        vorhanden = (
            db.table("properties")
            .select("id, currency, timezone, title")
            .eq("tenant_id", tenant_id)
            .eq("airbnb_listing_id", row["airbnb_listing_id"])
            .limit(1)
            .execute()
        ).data
        if vorhanden:
            db.table("properties").update(
                self._ohne_gepflegte_felder(row, vorhanden[0])
            ).eq("id", vorhanden[0]["id"]).execute()
            self._internen_namen_ergaenzen(db, vorhanden[0]["id"], intern)
            self._ensure_default_unit(
                db, tenant_id, vorhanden[0]["id"], row.get("title")
            )
            return str(vorhanden[0]["id"]), False

        geruest = (
            db.table("properties")
            .select("id, currency, timezone, title")
            .eq("tenant_id", tenant_id)
            .eq("title", GERUEST_TITEL)
            .is_("airbnb_listing_id", "null")
            .limit(1)
            .execute()
        ).data
        if geruest:
            db.table("properties").update(
                self._ohne_gepflegte_felder(row, geruest[0])
            ).eq("id", geruest[0]["id"]).execute()
            self._internen_namen_ergaenzen(db, geruest[0]["id"], intern)
            self._ensure_default_unit(
                db, tenant_id, geruest[0]["id"], row.get("title")
            )
            return str(geruest[0]["id"]), False

        # Beim Anlegen gibt es nichts zu erhalten — der interne Name kann direkt
        # mit in die neue Zeile.
        anlage = {**row, "tenant_id": tenant_id, "status": "draft"}
        if intern:
            anlage["type_attributes"] = {"internal_name": intern}
        neu = (db.table("properties").insert(anlage).execute()).data
        if not neu:
            raise ChannelManagerError(
                "Objekt konnte nicht angelegt werden.", status_code=500
            )
        self._ensure_default_unit(db, tenant_id, neu[0]["id"], row.get("title"))
        return str(neu[0]["id"]), True

    @staticmethod
    def _internen_namen_ergaenzen(
        db: Client, property_id: str, intern: str | None
    ) -> None:
        """Den internen Namen in `type_attributes` ergänzen, ohne den Rest zu verlieren.

        Zwei Regeln, beide aus Wurzel 1: das JSON-Objekt wird GELESEN und
        zusammengeführt (ein blindes Update ersetzte alle übrigen
        Objekt-Details), und ein bereits gepflegter interner Name bleibt stehen
        — der Betrieb kennt sein Objekt unter der eigenen Bezeichnung, ein
        erneuter Abruf darf sie nicht überschreiben.
        """
        if not intern:
            return
        rows = (
            db.table("properties").select("type_attributes")
            .eq("id", property_id).limit(1).execute()
        ).data or []
        vorhanden = (rows[0].get("type_attributes") or {}) if rows else {}
        if not isinstance(vorhanden, dict):
            vorhanden = {}
        if vorhanden.get("internal_name"):
            return
        db.table("properties").update(
            {"type_attributes": {**vorhanden, "internal_name": intern}}
        ).eq("id", property_id).execute()
