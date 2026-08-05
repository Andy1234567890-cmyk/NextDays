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

from supabase import Client

from src.core.security import AuthContext

from . import airbnb_listing_import as ali
from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    _currency_for_country,
    _timezone_speicherbar,
    log,
)

# Titel des Gerüst-Objekts. Bewusst erkennbar und nicht geraten: solange die
# echten Airbnb-Daten fehlen, darf hier kein plausibler Fantasiename stehen
# (Wurzel 4) — der Kunde soll sehen, dass die Übernahme noch läuft.
_GERUEST_TITEL = "Airbnb-Übernahme läuft"

# Wie viele Listings eine Übernahme höchstens verarbeitet. Airbnb-Konten mit
# hunderten Listings sind real; ohne Obergrenze wäre der Request unbegrenzt
# (Wurzel 8). Darüber hinaus meldet der Ablauf ehrlich, was er NICHT übernommen
# hat, statt still abzuschneiden.
_MAX_LISTINGS = 100


class AirbnbUebernahmeMixin:
    """Bestehende Airbnb-Listings als Objekte übernehmen."""

    # -- a) Start: Gerüst-Objekt + OAuth-URL ----------------------------------
    def uebernahme_starten(
        self, ctx: AuthContext, *, portal_code: str = "AirBNB"
    ) -> dict[str, Any]:
        """Übernahme starten, OHNE dass der Kunde ein Objekt anlegt.

        Legt (idempotent, Wurzel 2) ein Gerüst-Objekt an, registriert es bei
        Channex und gibt die echte Airbnb-OAuth-URL zurück. Hat der Betrieb
        bereits Objekte, wird das erste davon genutzt — dann entsteht kein
        zweites Gerüst.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        property_id = self._geruest_objekt(db, tenant_id)
        # Ab hier der bestehende, erprobte OAuth-Pfad — kein zweiter Weg zu
        # Channex (der erste Anlauf dieser Funktion hatte genau das gebaut).
        # Die Channex-Registrierung des Gerüsts holt `begin_channel_oauth` selbst
        # nach; sie liegt dort, weil sie für JEDEN noch nicht registrierten
        # Connect nötig ist — nicht nur für den aus der Übernahme.
        return self.begin_channel_oauth(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            title=None,
        )

    def _geruest_objekt(self, db: Client, tenant_id: str) -> str:
        """Objekt-ID, an der die Airbnb-Autorisierung hängen kann.

        Reihenfolge: ein bestehendes Objekt (der Normalfall, wenn der Kunde
        schon eins hat) → ein früheres Gerüst (Doppelklick/Retry) → ein neues
        Gerüst. So entsteht bei mehrfachem Start kein Objekt-Wildwuchs.
        """
        vorhanden = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        if vorhanden:
            return vorhanden[0]["id"]

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
                "title": _GERUEST_TITEL,
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
        self._ensure_default_unit(db, tenant_id, property_id, _GERUEST_TITEL)
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
        self, ctx: AuthContext, *, portal_code: str = "AirBNB"
    ) -> dict[str, Any]:
        """Airbnb-Listings des verbundenen Kontos als Objekte übernehmen.

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

        # Nur Zeilen MIT Kanal-ID: die Tabelle trägt für jedes Objekt eine Zeile
        # je Portal, und solange dort kein Kanal angelegt wurde, ist
        # `channex_channel_id` leer. Ohne diesen Filter hätte `limit(1)` eine
        # leere Zeile erwischt und "nicht verbunden" gemeldet, obwohl eine andere
        # Zeile den Kanal trägt.
        verbindung = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .not_.is_("channex_channel_id", "null")
            .limit(1)
            .execute()
        ).data
        if not verbindung:
            raise ChannelManagerError(
                "Airbnb ist noch nicht verbunden. Starte die Übernahme und "
                "autorisiere Airbnb zuerst.",
                status_code=409,
            )
        channel_id = verbindung[0]["channex_channel_id"]

        # Jeden Channex-Aufruf dieses Ablaufs in channex_debug_log schreiben.
        # Ohne gesetzten Trace-Kontext schreibt der Sink nichts, und dann ist
        # NUR am Serverlog erkennbar, was Channex geantwortet hat — im
        # Debug-Bereich der Anwendung stand nichts.
        self._trace_step(
            tenant_id=tenant_id, property_id=verbindung[0].get("property_id"),
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
        for listing in listings[:_MAX_LISTINGS]:
            row = self._listing_zu_objekt(listing)
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
        am_kanal = self._kanal_properties_nachziehen(db, tenant_id, channel_id)

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

    def _kanal_properties_nachziehen(
        self, db: Client, tenant_id: str, channel_id: str
    ) -> int:
        """Alle Channex-Properties dieses Betriebs an den Kanal hängen.

        Liefert die Anzahl am Kanal. Der PUT ERSETZT die Liste (kein Merge), also
        wird die bestehende gelesen und vereinigt — sonst verlöre ein Nachzug die
        vorher verbundenen Objekte (Wurzel 1). Idempotent: dieselbe Menge zweimal
        gesetzt ändert nichts (Wurzel 2).
        """
        maps = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
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
        if not settings or settings.get("token_invalid"):
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
        if titel_alt and str(titel_alt).strip() != _GERUEST_TITEL:
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
            .eq("title", _GERUEST_TITEL)
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
