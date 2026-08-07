"""Ein EINZELNES Airbnb-Objekt abrufen: zuordnen, dann Preise von Airbnb holen.

WARUM DIESES MODUL EXISTIERT — und was daran vorher falsch verstanden war:

Nach der Übernahme (`airbnb_uebernahme`) standen am Beta-Betrieb 18 Objekte in
der DB und 18 Properties bei Channex, aber im Channex-UI ALLE 18 auf
„Not mapped". Der Grund ist eine Kette, die an einer Stelle reißt:

    Währung fehlt → kein Preisplan möglich (`rate_plans.currency` NOT NULL)
                  → kein Tarif → Channex verweigert die Zuordnung
                  → kein Mapping → kein Preisabruf

Channex verlangt beim Zuordnen ausdrücklich BEIDES, Zimmer UND Tarif
(Channex-Mapping-Anleitung: „Sie müssen sowohl ein Zimmer als auch einen Tarif
auswählen"). Ohne Preisplan gibt es keinen Tarif.

DIE KORREKTUR EINER FALSCHEN ANNAHME: Vorher stand hier im Slice, Airbnb liefere
über Channex keine Preise, der Kunde müsse sie zuerst selbst eintragen. Das ist
WIDERLEGT. Live gemessen am autorisierten Kanal (04.08.2026):

    GET channels/{id}/execute/load_listing_price_settings?listing_id=<id>   → 200
    GET channels/{id}/execute/load_listing_availability_rule?listing_id=<id> → 200
    GET channels/{id}/execute/load_listing_booking_settings?listing_id=<id>  → 200

Die früheren Fehlversuche trafen den falschen Namensraum und das falsche Verb
(`POST action/get_pricing_settings` → 400 „action is not supported"). Es gibt bei
Channex ZWEI Namensräume, `channels/{id}/action/<name>` und
`channels/{id}/execute/<name>`; die Lade-Aktionen liegen im zweiten und werden
per GET mit `listing_id` als Query-Parameter gerufen.

Und das Channex-Protokoll (`channel_events`) sagt wörtlich, woran der Abruf ohne
Mapping scheitert:

    NotFoundError{entity: ChannelRatePlan, query: %{listing_id: "1133…"}}

`ChannelRatePlan` fehlt — BEI UNS, nicht bei Airbnb. Daraus folgt die Reihenfolge
dieses Moduls: erst zuordnen, DANN kommen die Preise von Airbnb.

DER PLATZHALTER-PREIS UND WARUM ER KEIN ERFUNDENER WERT IST (Wurzel 4):
Um überhaupt zuordnen zu können, braucht es einen Preisplan, und der braucht eine
Zahl. Angelegt wird er mit `base_price = 0` — ausdrücklich als Platzhalter, der
im selben Aufruf durch Airbnbs echten Preis ersetzt wird. Das ist kein geratener
Ersatzwert („plausible 89 €"), sondern ein leeres Feld in Zahlenform. Die
Absicherung dagegen, dass 0 verkauft wird, ist der Objekt-Status: das Objekt
bleibt `draft`, und `draft` verkauft nichts. Kommt kein Preis von Airbnb zurück,
sagt die Antwort das (`preis_uebernommen: false`) statt Erfolg zu behaupten
(Wurzel 5).

KORREKTUR EINER ZWEITEN FALSCHEN ANNAHME (05.08.2026): Hier stand, Channex gebe
über Airbnb KEINEN Content heraus — kein Content-Endpunkt, kein Content-Webhook.
Das ist ebenfalls widerlegt. Der von Airbnb selbst dokumentierte Weg
(„Airbnb Connection API", `docs/OTA/Airbnb/`) war in den früheren Messreihen
nie geprüft worden; getestet wurden nur `proxy/v2/listings`,
`proxy/v2/calendars` und `channels/{id}/listings` (alle 500/404):

    GET channels/{id}/action/listing_details?listing_id=<id>  → 200, 41 Felder

Live gemessen an „020 Lille Lægehus": 6 Räume mit `is_private`, `bedrooms: 1`,
`beds: 2`, `bathrooms: 1.0`, `total_inventory_count: 1`, Storno
`better_strict_with_grace_period`, alle `guest_controls`, WLAN-Name und
-Passwort, Schlüsselbox-Hinweis, 11 Ausstattungen (eine davon einem Raum
zugeordnet) und die Gebühren (Reinigung 795, Haustier 150, Resort 25 DKK).
Kontrolltest im gleichen Namensraum: `action/erfundene_aktion_zzz` → 400
„action is not supported" — die 200 ist also echt.

Übernommen wird das in `airbnb_listing_details_uebernehmen` (siehe unten), und
zwar in das Format, das die Objekt-Maske liest.

WAS AIRBNB WIRKLICH NICHT HERGIBT: die Wohnfläche in m². In keinem der zwölf
Airbnb-Dokumente kommt ein Größenfeld vor, und live ist
`property_details.listing_size` ein leeres Objekt. Auch `state` (Bundesland/
Region) bleibt leer — dafür gibt es die Rückwärts-Geokodierung aus lat/lng.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import airbnb_listing_import as ali
from .airbnb_verfuegbarkeit import VORLAUF_ZU_OPTION
from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    _currency_for_country,
    _timezone_speicherbar,
    log,
)
from .content_builder import locale_order_for_country
from .ota_abgaben import AIRBNB

# Name des Preisplans, den der Abruf anlegt. Bewusst sprechend: der Kunde soll in
# der Preisliste sehen, woher der Plan kommt, und ihn nicht für einen eigenen
# halten.
PLAN_NAME = "Grundpreis (von Airbnb)"

# Airbnbs Mindestpreis, aus dem Kanal-Katalog gelesen
# (`channel_restrictions: {"currency": "USD", "min_price": 1000}`). Der Wert ist
# in Minor Units, also 10,00 USD. Ein Preis darunter wird von Airbnb abgelehnt —
# geprüft wird das hier NICHT umgerechnet, weil uns keine Wechselkurse vorliegen;
# stattdessen wird der Grenzwert protokolliert, wenn der übernommene Preis
# auffällig niedrig ist. Kein erfundener Umrechnungskurs (Wurzel 4).
AIRBNB_MIN_PRICE_MINOR = 1000

# Die Kanäle, die `type_attributes.availability` je Feld führt — Gegenstück zu
# `PerChannel` in `web/lib/availability-meta.ts`. Ein Wert ohne diese Form fällt
# in der Maske auf den Vorgabewert zurück, weil `mergePerChannel` ihn nicht
# erkennt.
_AVAILABILITY_KANAELE = ("direct", "airbnb", "booking", "google")

# Die Vorgabewerte der Maske (`DEFAULT_AVAILABILITY` in
# `web/lib/availability-meta.ts`). Ein Feld, das noch exakt darauf steht, hat
# der Betrieb NICHT gesetzt — die Maske schreibt beim ersten Öffnen den ganzen
# Block. Nur die Felder, die der Airbnb-Abruf füllt.
_AVAILABILITY_VORGABE: dict[str, int | str] = {
    "minStay": 1,
    "maxStay": 365,
    "bookingWindowDays": 365,
    "advanceNotice": "00:00",
    "preparationDays": 0,
}


def _je_kanal(wert: int | str) -> dict[str, Any]:
    """Einen Wert in die `PerChannel`-Form der Maske bringen."""
    return {
        "custom": False,
        "global": wert,
        "channels": dict.fromkeys(_AVAILABILITY_KANAELE, wert),
    }


class AirbnbObjektAbrufMixin:
    """Ein einzelnes Airbnb-Objekt abrufen. Mixin des ChannelManagerService."""

    def airbnb_objekt_abrufen(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Route-Einstieg: EIN Objekt bei Airbnb abrufen.

        Bewusst pro Objekt und nicht für alle: der Betrieb will ein Haus prüfen,
        bevor 18 auf einmal angefasst werden — und ein Fehler an einem Objekt darf
        die anderen nicht mitziehen.

        Schritte, in dieser Reihenfolge (Begründung im Modul-Docstring):
          1. Währung/Zeitzone aus dem Land nachtragen, falls leer
          2. Preisplan anlegen, falls keiner existiert (Platzhalter 0)
          3. bei Channex registrieren + zuordnen
          4. Preise von Airbnb holen und den Platzhalter ersetzen
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        # Wurzel 3: per-ID-Zugriff immer gescopt laden, nie roh + nachträglich
        # vergleichen.
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, country, currency, timezone, airbnb_listing_id, status",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = prop.get("airbnb_listing_id")
        if not listing_id:
            raise ChannelManagerError(
                "Dieses Objekt ist keine Airbnb-Anzeige — es gibt dort nichts "
                "abzurufen.",
                status_code=422,
            )
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id, property_id)
        if not channel_id:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden. Verbinde zuerst Airbnb im "
                "Kanalmanager.",
                status_code=409,
            )

        stammdaten = self._stammdaten_nachtragen(db, prop)

        # Content ZUERST — vor der Zuordnung. Grund: `_zuordnen` schickt
        # Property und Zimmertyp an Channex und kann dort scheitern (live
        # gemessen: 422 „Room type photos limit exceeded"). Stand der
        # Content-Abruf danach, war bei einem solchen Abbruch auch die ADRESSE
        # weg, obwohl Airbnb sie geliefert hatte — der Nutzer sah ein leeres
        # Straßenfeld und keinen Grund. Jetzt ist die echte Hausadresse in
        # unserer DB, bevor irgendetwas nach außen geht.
        content: dict[str, Any] = {"uebernommen": [], "fotos": 0}
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        hausregeln: list[str] = []
        if zugang:
            token, _host = zugang
            content = self.airbnb_content_uebernehmen(  # type: ignore[attr-defined]
                db, tenant_id, property_id, str(listing_id), token
            )
            # Die Hausregeln kommen NUR über Airbnbs eigene API — Channex liefert
            # sie in der Mapping-Antwort unvollständig (siehe
            # `airbnb_booking_settings_direkt`). Deshalb hier, wo der Token ist.
            hausregeln = self._hausregeln_direkt_uebernehmen(
                db, tenant_id, property_id, str(listing_id), token
            )
            # Nach dem Content neu laden: Adresse, Beschreibung und Ausstattung
            # gehen im nächsten Schritt an Channex mit.
            frisch = (
                db.table("properties").select("*")
                .eq("tenant_id", tenant_id).eq("id", property_id)
                .limit(1).execute()
            ).data
            if frisch:
                prop = frisch[0]

        # Der vollständige Content-Weg (`action/listing_details`): Zimmer,
        # Betten, Storno, Gastregeln, WLAN, Gebühren, Einheiten. Läuft VOR der
        # Zuordnung, damit ein Fehler dort die schon geholten Details nicht
        # wieder wegnimmt (gleiche Begründung wie beim Content oben).
        details = self.airbnb_listing_details_uebernehmen(
            db, tenant_id, property_id, channel_id, str(listing_id)
        )

        plan = self._preisplan_sicherstellen(db, tenant_id, prop, stammdaten)
        # Die Zuordnung IST der Lesevorgang: ihre Antwort trägt Airbnbs Preise,
        # Gebühren und Regeln zurück. `None` = keine Zuordnung möglich.
        settings = self._zuordnen(
            db, tenant_id, property_id, channel_id, str(listing_id)
        )
        if settings is None:
            preis: dict[str, Any] = {
                "uebernommen": False,
                "hinweis": (
                    "Die Zuordnung bei Airbnb ist nicht zustande gekommen. Prüfe "
                    "im Kanalmanager, ob das Airbnb-Konto verbunden ist."
                ),
            }
        else:
            preis = self._preise_von_airbnb(
                db, tenant_id, property_id, str(listing_id), plan, settings,
                ersatz_preisteil=details.get("pricing_settings") or {},
            )

        log.info(
            "airbnb_objekt_abruf_fertig",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, stammdaten=stammdaten,
            plan_angelegt=plan.get("angelegt"),
            zugeordnet=settings is not None,
            preis_uebernommen=preis.get("uebernommen"),
            content_felder=content["uebernommen"], fotos=content["fotos"],
            details_felder=details.get("uebernommen"),
        )
        return {
            "property_id": property_id,
            "listing_id": str(listing_id),
            # Airbnbs Währung schlägt die abgeleitete (echte vor hergeleiteter).
            "waehrung": (
                preis.get("waehrung")
                or stammdaten.get("currency")
                or prop.get("currency")
            ),
            "zeitzone": stammdaten.get("timezone") or prop.get("timezone"),
            "plan_angelegt": bool(plan.get("angelegt")),
            "zugeordnet": settings is not None,
            "preis_uebernommen": bool(preis.get("uebernommen")),
            "base_price": preis.get("base_price"),
            "min_stay": preis.get("min_stay"),
            "uebernommene_felder": sorted(
                set((preis.get("weitere") or {}).keys())
                | set(content["uebernommen"])
                | set(details.get("uebernommen") or [])
                | set(hausregeln)
            ),
            "fotos_uebernommen": content["fotos"],
            # Getrennt ausgewiesen, damit sichtbar ist, was aus dem
            # `listing_details`-Weg kam (Zimmer, Betten, Storno, WLAN …).
            "details_uebernommen": details.get("uebernommen") or [],
            "hinweis": preis.get("hinweis") or details.get("fehler"),
        }

    # --- Schritt 1: Stammdaten -------------------------------------------------

    def _stammdaten_nachtragen(
        self, db: Client, prop: dict[str, Any]
    ) -> dict[str, Any]:
        """Währung und Zeitzone aus dem Land nachtragen — nur wo sie LEER sind.

        Beides kommt aus demselben `country_code`, den Airbnb liefert. Ein
        gepflegter Wert wird nie überschrieben (Wurzel 1): auf Teneriffa hat der
        Kunde Atlantic/Canary gesetzt, und ein Abruf darf das nicht auf
        Europe/Madrid zurückdrehen.
        """
        land = prop.get("country")
        gesetzt: dict[str, Any] = {}
        if not prop.get("currency"):
            waehrung = _currency_for_country(land)
            if waehrung:
                gesetzt["currency"] = waehrung
        if not prop.get("timezone"):
            zone = _timezone_speicherbar(land)
            if zone:
                gesetzt["timezone"] = zone
        if gesetzt:
            db.table("properties").update(gesetzt).eq("id", prop["id"]).execute()
            log.info(
                "airbnb_objekt_stammdaten_nachgetragen",
                property_id=prop["id"], land=land, gesetzt=gesetzt,
            )
        return gesetzt

    # --- Schritt 2: Preisplan --------------------------------------------------

    def _preisplan_sicherstellen(
        self, db: Client, tenant_id: str, prop: dict[str, Any],
        stammdaten: dict[str, Any],
    ) -> dict[str, Any]:
        """Preisplan des Objekts holen oder als Platzhalter anlegen.

        Gibt `{"id": …, "angelegt": bool}`. Idempotent (Wurzel 2): existiert schon
        ein property-weiter Plan, wird er verwendet und NICHT ein zweiter angelegt
        — zwei Grundpreise wären zwei Wahrheiten.
        """
        property_id = str(prop["id"])
        vorhanden = (
            db.table("rate_plans")
            .select("id, base_price")
            .eq("property_id", property_id)
            .is_("portal_scope", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return {"id": str(vorhanden[0]["id"]), "angelegt": False}

        waehrung = stammdaten.get("currency") or prop.get("currency")
        if not waehrung:
            # Kein erfundenes „EUR" (Wurzel 4): ohne Währung ist der Preis
            # bedeutungslos, und der Kunde muss wissen, was zu tun ist.
            raise ChannelManagerError(
                "Für dieses Objekt fehlt die Währung, und sie lässt sich aus dem "
                "Land nicht ableiten. Setze die Währung am Objekt, dann läuft der "
                "Abruf durch.",
                status_code=422,
            )
        neu = (
            db.table("rate_plans")
            .insert({
                "property_id": property_id,
                "name": PLAN_NAME,
                # Platzhalter, siehe Modul-Docstring. Wird in Schritt 4 durch
                # Airbnbs echten Preis ersetzt; bis dahin schützt `status=draft`.
                "base_price": 0,
                "currency": waehrung,
                "min_stay": 1,
                "rate_mode": "manual",
                "send_to_portals": False,
            })
            .execute()
        ).data
        if not neu:
            raise ChannelManagerError(
                "Preisplan konnte nicht angelegt werden.", status_code=500
            )
        log.info(
            "airbnb_objekt_preisplan_angelegt",
            tenant_id=tenant_id, property_id=property_id, currency=waehrung,
        )
        return {"id": str(neu[0]["id"]), "angelegt": True}

    # --- Schritt 3: zuordnen ---------------------------------------------------

    def _zuordnen(
        self, db: Client, tenant_id: str, property_id: str, channel_id: str,
        listing_id: str,
    ) -> dict[str, Any] | None:
        """Objekt bei Channex anlegen UND die Anzeige zuordnen.

        Rueckgabe sind die Airbnb-Settings der Zuordnung, oder None, wenn keine
        zustande kam. ZWEI Schritte, und der zweite fehlte zuerst:

          1. `sync_content` legt Property, Room-Type und Rate-Plan bei Channex an
          2. `POST channels/{id}/mappings` verbindet den Rate-Plan mit der Anzeige

        Ohne Schritt 2 standen `room_types` und `rate_plans` mit 201 bei Channex,
        aber am Kanal blieb `rate_plans: []` und im Airbnb-UI alles auf
        "Not mapped". Gemeldet wurde trotzdem Erfolg, weil `sync_content`
        durchlief - angelegt ist nicht verbunden (Wurzel 5).
        """
        try:
            self.sync_content(tenant_id, property_id=property_id)  # type: ignore[attr-defined]
        except (ChannexError, ChannelManagerError) as exc:
            # Kein stilles „done" (Wurzel 5): der Grund geht an den Aufrufer.
            log.warning(
                "airbnb_objekt_zuordnung_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
                error=getattr(exc, "message", str(exc)),
            )
            raise
        return self._listing_mapping_setzen(
            db, tenant_id, property_id, channel_id, listing_id
        )

    def _listing_mapping_setzen(
        self, db: Client, tenant_id: str, property_id: str, channel_id: str,
        listing_id: str,
    ) -> dict[str, Any] | None:
        """Preisplan mit der Airbnb-Anzeige verbinden → die Airbnb-Settings.

        Rückgabe sind die `settings` der Zuordnung (die Airbnb-Daten) oder None,
        wenn keine Zuordnung möglich war. Der Rückgabewert IST der Lesekanal: die
        Antwort von `POST channels/{id}/mappings` trägt Preis, Gebühren,
        Aufenthalts- und Buchungsregeln des Listings zurück.

        Idempotent (Wurzel 2): besteht die Zuordnung schon, werden ihre Settings
        aus dem Kanal-Objekt gelesen, statt eine zweite anzulegen.
        """
        # Ist-Stand: der einzige Ort, an dem Mappings lesbar sind (kein GET-Pfad
        # für `channels/{id}/mappings`, live geprüft → 404).
        kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        attrs = (kanal.get("data") or {}).get("attributes") or {}
        for rp in (attrs.get("rate_plans") or []):
            if not isinstance(rp, dict):
                continue
            settings = rp.get("settings") or {}
            if str(settings.get("listing_id") or "") == listing_id:
                return settings  # schon zugeordnet — Settings mitnehmen

        # Die Channex-Rate-Plan-IDs dieses Objekts. Existieren jetzt, weil
        # `_preisplan_sicherstellen` + `sync_content` sie erzeugt haben.
        eigene = self._selected_rate_plan_ids(  # type: ignore[attr-defined]
            db, tenant_id, property_id, AIRBNB
        )
        if not eigene:
            log.warning(
                "airbnb_objekt_ohne_channex_rate_plan",
                tenant_id=tenant_id, property_id=property_id,
            )
            return None

        # Airbnb nimmt EINEN Preis je Anzeige („Airbnb allows you to map only 1
        # rate plan") — der Grundpreis, also der erste.
        antwort = self._channex.create_channel_mapping(  # type: ignore[attr-defined]
            channel_id, eigene[0], {"listing_id": listing_id}
        )
        settings = (
            ((antwort.get("data") or {}).get("attributes") or {}).get("settings")
            or {}
        )
        log.info(
            "airbnb_listing_mapping_gesetzt",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, channel_id=channel_id,
            rate_plan_id=eigene[0],
            gelieferte_felder=sorted(settings.keys()),
        )
        return settings or None

    # --- Schritt 4: Preise von Airbnb -----------------------------------------

    def _preise_von_airbnb(
        self, db: Client, tenant_id: str, property_id: str, listing_id: str,
        plan: dict[str, Any], settings: dict[str, Any],
        ersatz_preisteil: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Airbnbs Einstellungen übernehmen — Preis, Währung, Regeln.

        `settings` sind die Werte, die `POST channels/{id}/mappings` beim Zuordnen
        ZURÜCKGELIEFERT hat. Es braucht keinen zweiten Abruf: die Zuordnung IST
        der Lesevorgang. Genau daran war der erste Bauversuch gescheitert — er
        rief `execute/load_listing_price_settings`, bekam 200 „Success" und keine
        Daten, weil dieser Namensraum auf jeden Namen so antwortet.

        ABER: die Mapping-Antwort trägt den Preis nicht immer. Live gemessen an
        Objekt 020 fehlte er dort, während `action/listing_details` ihn führte
        (`default_daily_price: 504` DKK) — die Oberfläche meldete „Airbnb hat
        keinen Preis übergeben", obwohl er vorlag. Deshalb der zweite,
        gleichwertige Messwert als `ersatz_preisteil`. Das ist KEIN geratener
        Ersatzwert (Wurzel 4): es ist dieselbe Angabe aus einer zweiten,
        belegten Quelle.

        Kommt aus BEIDEN kein Preis, wird das GESAGT (`uebernommen: false` +
        Hinweis) und der Platzhalter bleibt stehen — statt Erfolg zu behaupten
        (Wurzel 5).
        """
        preisteil = settings.get("pricing_setting") or {}
        regeln = settings.get("availability_rule") or {}
        buchung = settings.get("booking_setting") or {}

        preis = self._nachtpreis(preisteil)
        if preis is None and ersatz_preisteil:
            # Entschieden wird am WERT, nicht am Vorhandensein des Blocks: ein
            # `pricing_setting` ohne Preis ist genauso preislos wie gar keins.
            ersatz = self._nachtpreis(ersatz_preisteil)
            if ersatz is not None:
                preisteil = ersatz_preisteil
                preis = ersatz
        if preis is None:
            return {
                "uebernommen": False,
                "hinweis": (
                    "Airbnb hat für diese Anzeige keinen Preis übergeben. Die "
                    "Zuordnung steht — trage den Grundpreis unter „Preise“ ein "
                    "oder prüfe den Preis in deinem Airbnb-Konto."
                ),
            }

        # Währung von Airbnb schlägt die aus dem Land abgeleitete: sie ist die
        # Währung, in der die Anzeige TATSÄCHLICH verkauft (Wurzel 4 — die echte
        # Angabe gewinnt über die abgeleitete).
        waehrung = str(preisteil.get("listing_currency") or "").upper() or None

        aenderung: dict[str, Any] = {"base_price": preis}
        if waehrung:
            aenderung["currency"] = waehrung
        min_stay = self._ganzzahl(regeln.get("default_min_nights"))
        if min_stay and min_stay >= 1:
            aenderung["min_stay"] = min_stay
        db.table("rate_plans").update(aenderung).eq("id", plan["id"]).execute()
        self._abgeleitete_mitziehen(db, str(plan["id"]), aenderung)
        if waehrung:
            # Objektwährung mitziehen (0161: `properties.currency` ist die
            # Wahrheit) — sonst rechnen Preisplan und Objekt in verschiedenem Geld
            # und der Content-Sync wirft 422.
            db.table("properties").update({"currency": waehrung}).eq(
                "id", property_id
            ).execute()

        uebrige = self._weitere_felder_uebernehmen(
            db, property_id, preisteil, regeln, buchung
        )
        # Airbnbs Mindestpreis benennen, statt ihn stillschweigend zu verletzen:
        # der Katalog nennt 1000 Minor Units (10,00) als Untergrenze. Wir rechnen
        # nicht um (keine Wechselkurse vorhanden, Wurzel 4), aber ein auffällig
        # niedriger Preis kommt ins Protokoll — sonst lehnt Airbnb später ab und
        # niemand weiß, warum.
        if preis * 100 < AIRBNB_MIN_PRICE_MINOR:
            log.warning(
                "airbnb_preis_unter_mindestgrenze",
                property_id=property_id, base_price=preis, currency=waehrung,
                grenze_minor=AIRBNB_MIN_PRICE_MINOR,
            )

        # Der echte Preis muss auch bei den Portalen ankommen — sonst steht bei
        # Airbnb weiter der Platzhalter (Wurzel 1: der Gegenzustand zum lokalen
        # Schreiben ist der Push).
        self.sync_content(tenant_id, property_id=property_id)  # type: ignore[attr-defined]
        log.info(
            "airbnb_objekt_preis_uebernommen",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, base_price=preis, currency=waehrung,
            min_stay=min_stay, weitere=uebrige,
        )
        return {
            "uebernommen": True, "base_price": preis, "min_stay": min_stay,
            "waehrung": waehrung, "weitere": uebrige,
        }

    def airbnb_listing_details_uebernehmen(
        self, db: Client, tenant_id: str, property_id: str,
        channel_id: str, listing_id: str,
    ) -> dict[str, Any]:
        """Alles übernehmen, was `action/listing_details` liefert.

        DAS IST DER VOLLSTÄNDIGE CONTENT-WEG, und er war bis hierher nicht
        angebunden: der Abruf holte nur Preise/Regeln aus der Mapping-Antwort,
        weshalb die Objekt-Maske „Noch keine Zimmer" und „Noch keine
        Schlafgelegenheiten" zeigte, obwohl Airbnb 6 Räume liefert.

        Geschrieben wird dorthin, wo die Maske WIRKLICH liest — und das sind zwei
        verschiedene Orte: die Zimmer als Zeilen in `property_rooms` (0246/0251,
        gelesen über `listPropertyRooms`), die Betten als Zählwerk in
        `type_attributes.beds` = {slug: n}. Ein früherer Stand füllte
        `type_attributes.rooms`; das las niemand, weshalb die Karte weiter „Noch
        keine Zimmer" zeigte, obwohl die Werte in der Spalte standen.

        Wurzel 1: nur LEERE Felder werden gefüllt. Was der Betrieb selbst
        gepflegt hat, bleibt unangetastet.
        """
        try:
            antwort = self._channex.get_airbnb_listing_details(  # type: ignore[attr-defined]
                channel_id, listing_id
            )
        except ChannexError as exc:
            # Kein stiller Erfolg (Wurzel 5): der Aufrufer erfährt den Grund.
            log.warning(
                "airbnb_listing_details_fehlgeschlagen",
                property_id=property_id, listing_id=listing_id,
                error=str(exc)[:200],
            )
            return {"uebernommen": [], "fehler": str(exc)[:200]}

        listing = ((antwort.get("data") or {}).get("listing")) or {}
        if not isinstance(listing, dict) or not listing:
            log.warning(
                "airbnb_listing_details_leer",
                property_id=property_id, listing_id=listing_id,
            )
            return {"uebernommen": [], "fehler": "Airbnb lieferte kein Listing."}

        rows = (
            db.table("properties")
            .select("type_attributes, max_guests, title, country")
            .eq("tenant_id", tenant_id).eq("id", property_id)
            .limit(1).execute()
        ).data or []
        if not rows:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        alt = rows[0].get("type_attributes")
        alt = alt if isinstance(alt, dict) else {}
        neu = dict(alt)
        gesetzt: list[str] = []

        self._details_zimmer_betten(listing, alt, neu, gesetzt)
        self._details_interner_name(listing, alt, neu, gesetzt)
        self._details_kapazitaet(listing, alt, neu, gesetzt)
        self._details_regeln(listing, alt, neu, gesetzt)
        self._details_zugang(listing, alt, neu, gesetzt)
        self._details_texte(channel_id, listing_id, alt, neu, gesetzt)
        # Die Registrierungsnummer (DK: BFE) steht in einem EIGENEN Endpunkt
        # (`v2/listing_permits`) — nicht im Listing. Sie fehlte deshalb, obwohl
        # der Betrieb sie bei Airbnb gepflegt hatte.
        self._registrierung_uebernehmen(
            db, tenant_id, property_id, alt, neu, gesetzt
        )

        # Zimmer sind eine eigene Tabelle, keine Spalte — deshalb getrennt vom
        # type_attributes-Update (siehe `_zimmer_zeilen_anlegen`).
        if self._zimmer_zeilen_anlegen(db, tenant_id, property_id, listing):
            gesetzt.append("zimmer")

        spalten: dict[str, Any] = {}
        if gesetzt:
            spalten["type_attributes"] = neu
        # Der Titel ist eine SPALTE, kein `type_attributes`-Feld — deshalb hier
        # und nicht in `_details_texte`.
        airbnb_texte = neu.get("airbnbTexte")
        landestitel = self._landestitel(
            airbnb_texte if isinstance(airbnb_texte, dict) else {},
            rows[0].get("country"), rows[0].get("title"),
        )
        if landestitel:
            spalten["title"] = landestitel
            gesetzt.append("titel")
        if spalten:
            db.table("properties").update(spalten).eq(
                "tenant_id", tenant_id
            ).eq("id", property_id).execute()
        log.info(
            "airbnb_listing_details_uebernommen",
            property_id=property_id, listing_id=listing_id, felder=gesetzt,
        )
        # Die Preiseinstellungen werden MITGEGEBEN, nicht hier verarbeitet: der
        # Preis-Schritt liest sie sonst nur aus der Mapping-Antwort, und die
        # trägt sie nicht immer. Live gemessen an Objekt 020: Mapping ohne Preis,
        # `listing_details` mit `default_daily_price: 504` DKK — die Oberfläche
        # meldete „Airbnb hat keinen Preis übergeben", obwohl er da war.
        preise = listing.get("pricing_settings")
        return {
            "uebernommen": gesetzt,
            "pricing_settings": preise if isinstance(preise, dict) else {},
        }

    @staticmethod
    def _landestitel(
        texte: dict[str, Any], land: str | None, titel_jetzt: str | None
    ) -> str | None:
        """Der Anzeigename in der Sprache des Objekt-LANDES, sonst None.

        WARUM: Der Erstimport nimmt den Titel aus der Channex-Mapping-Liste, und
        die trägt nur Airbnbs ENGLISCHEN Anzeigenamen. Live gemessen am
        Beta-Betrieb (DK, 05.08.2026) standen dadurch 10 von 18 Objekten
        englisch in unserer DB, während der Gastgeber sie dänisch benannt hat:

            DB „Holiday house Fox's Den"       Airbnb da „Feriehus Rævehulen"
            DB „The Fox House"                 Airbnb da „Rævlingehuset"
            DB „Grandpa's little forest house" Airbnb da „Bedstefars lille skovhus"

        Der Gastgeber erkannte seine eigenen Häuser in der Liste nicht wieder.
        Die Sprachfassungen liegen nach `_details_texte` bereits vor
        (`airbnbTexte.name`, je Sprache) — es fehlte nur die Übernahme in die
        Spalte.

        Die Sprache wird NICHT geraten (Wurzel 4): sie kommt aus
        `locale_order_for_country` — derselbe Baustein, der schon den
        Channex-Content in der richtigen Sprache wählt. Unbekanntes Land →
        nur `en` in der Reihenfolge, dann bleibt es beim bisherigen Titel.

        Kein Rückschreiben, wenn der Wert gleich ist oder der Landestitel fehlt:
        ein Update ohne Änderung wäre ein leerer Realtime-Ausschlag und im
        Ergebnis-Feld ein „übernommen", das nichts übernommen hat.
        """
        namen = texte.get("name")
        if not isinstance(namen, dict) or not namen:
            return None
        for sprache in locale_order_for_country(land):
            wert = namen.get(sprache)
            if isinstance(wert, str) and wert.strip():
                gewuenscht = wert.strip()
                return gewuenscht if gewuenscht != (titel_jetzt or "") else None
        return None

    @staticmethod
    def _details_zimmer_betten(
        listing: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """Schlafgelegenheiten und Airbnbs Rohform der Räume.

        Die ZIMMER stehen NICHT hier: sie sind Zeilen in `property_rooms` und
        werden von `_zimmer_zeilen_anlegen` geschrieben. `type_attributes.rooms`
        wurde zwar gefüllt, aber von niemandem gelesen — die Karte „Zimmer" liest
        die Tabelle (`listPropertyRooms`), und genau deshalb stand dort weiter
        „Noch keine Zimmer", obwohl die Zählwerte in der Spalte lagen.
        """
        # Wurzel 1 (Gegenzustand): hier wird ABGEGLICHEN, nicht nur aufgefüllt.
        # Ein „nur wenn leer"-Import bekommt eine ÄNDERUNG bei Airbnb nie mit:
        # aus zwei Schlafsofas wurde eines, unsere DB zeigte weiter zwei. Der
        # Abruf ist eine bewusste Handlung des Betriebs („Von Airbnb abrufen") —
        # dann ist Airbnb die Wahrheit, auch wenn bei uns schon etwas steht.
        betten = ali.betten_zaehlwerk(listing)
        if betten and betten != (alt.get("beds") or {}):
            neu["beds"] = betten
            gesetzt.append("beds")

        raeume = ali.raeume_uebernehmen(listing)
        if raeume and raeume != alt.get("airbnbRaeume"):
            # Airbnbs Rohform daneben: sie trägt die Raum-IDs, über die Fotos und
            # Ausstattung einem Raum zugeordnet sind.
            neu["airbnbRaeume"] = raeume
            gesetzt.append("airbnbRaeume")

    @staticmethod
    def _abgeleitete_mitziehen(
        db: Client, eltern_id: str, aenderung: dict[str, Any]
    ) -> int:
        """Währung und Mindestaufenthalt an die abgeleiteten Kanal-Pläne.

        Wurzel 1 (Gegenzustand): ein Kanal-Plan (`portal_scope`, 0272) ist eine
        ABLEITUNG des Grundplans. Ändert der Airbnb-Abruf dort Währung oder
        Mindestaufenthalt, muss das Kind mit — sonst geht an das Portal ein
        anderer Wert als der, den Airbnb selbst führt. Live gemessen an
        „Feriehus Grævlinge": Grundplan nach dem Abruf `min_stay: 1`, Kanal-Plan
        weiter `min_stay: 2` — und `min_stay` des KIND-Plans ist genau der Wert,
        den `_upsert_channex_rate_plan` an Channex schickt.

        `base_price` bleibt bewusst AUSSEN VOR: der Resolver rechnet die
        Kindkurve immer aus der Elternkurve plus Offset
        (`resolver._rate_plan_curve`), die Spalte im Kind ist eine tote Kopie.
        Sie mitzuschreiben würde eine zweite Preis-Wahrheit vortäuschen
        (Wurzel 4).

        Rückgabe: Anzahl der angepassten Kinder.
        """
        felder = {k: v for k, v in aenderung.items() if k in ("currency", "min_stay")}
        if not felder:
            return 0
        kinder = (
            db.table("rate_plans")
            .select("id")
            .eq("derived_from_rate_plan_id", eltern_id)
            .execute()
        ).data or []
        if not kinder:
            return 0
        db.table("rate_plans").update(felder).eq(
            "derived_from_rate_plan_id", eltern_id
        ).execute()
        log.info(
            "airbnb_abgeleitete_mitgezogen",
            eltern_id=eltern_id, kinder=len(kinder), felder=sorted(felder),
        )
        return len(kinder)

    @staticmethod
    def _zimmer_zeilen_anlegen(
        db: Client, tenant_id: str, property_id: str, listing: dict[str, Any]
    ) -> int:
        """Airbnbs Räume als Zeilen in `property_rooms`.

        Das ist der Ort, den die Objekt-Maske liest — eine Zeile = ein Zimmer
        (0246/0251). Ein Zählwerk in `type_attributes` sieht sie nicht.

        `tenant_id` ist Pflicht (NOT NULL) und wird durchgereicht, nicht aus dem
        Objekt nachgeschlagen: der Aufrufer hat es bereits gescopt geladen
        (Wurzel 3), ein zweiter Weg dorthin wäre eine zweite Wahrheit.

        Wurzel 1 (Gegenzustand): ABGLEICH, nicht nur Erstbefüllung. Ein Import,
        der bei vorhandenen Zeilen abbricht, bekommt eine Änderung bei Airbnb nie
        mit — ein gelöschtes Zimmer bliebe für immer stehen. Der Abruf ist eine
        bewusste Handlung des Betriebs, also gilt Airbnbs Stand.

        Wurzel 2 (Idempotenz): verglichen wird der SOLL-Bestand je (Typ, Gruppe)
        mit dem Ist. Nur die Differenz wird eingefügt bzw. gelöscht — zweimal
        abrufen ändert nichts und verdoppelt nichts.

        Rückgabe: Anzahl der tatsächlichen Änderungen (0 = alles war schon gleich).
        """
        zaehlwerk = ali.zimmer_zaehlwerk(listing)
        soll: dict[tuple[str, bool], int] = {}
        for gruppe, privat in (("privat", True), ("gemeinschaftlich", False)):
            for slug, anzahl in (zaehlwerk.get(gruppe) or {}).items():
                soll[(slug, privat)] = int(anzahl)
        if not soll:
            # Airbnb liefert keine Räume → nichts anfassen. Alles zu löschen wäre
            # aus einer leeren Antwort geschlossen, nicht gemessen (Wurzel 4).
            return 0

        ist_zeilen = (
            db.table("property_rooms")
            .select("id, raum_typ, privat")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        ist: dict[tuple[str, bool], list[str]] = {}
        for zeile in ist_zeilen:
            schluessel = (str(zeile["raum_typ"]), bool(zeile["privat"]))
            ist.setdefault(schluessel, []).append(str(zeile["id"]))

        neue: list[dict[str, Any]] = []
        zu_loeschen: list[str] = []
        for schluessel in set(soll) | set(ist):
            slug, privat = schluessel
            vorhandene = ist.get(schluessel, [])
            fehlend = soll.get(schluessel, 0) - len(vorhandene)
            if fehlend > 0:
                neue.extend(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "raum_typ": slug,
                        "privat": privat,
                        "position": len(vorhandene) + i,
                    }
                    for i in range(fehlend)
                )
            elif fehlend < 0:
                zu_loeschen.extend(vorhandene[fehlend:])

        if neue:
            db.table("property_rooms").insert(neue).execute()
        if zu_loeschen:
            db.table("property_rooms").delete().eq("tenant_id", tenant_id).in_(
                "id", zu_loeschen
            ).execute()
        return len(neue) + len(zu_loeschen)

    def _hausregeln_direkt_uebernehmen(
        self, db: Client, tenant_id: str, property_id: str,
        listing_id: str, token: str,
    ) -> list[str]:
        """Airbnbs Hausregeln über die EIGENE API holen und speichern.

        Warum nicht über Channex: die Mapping-Antwort liefert `booking_setting`
        nur als Beifang, und die Felder aus Airbnbs „House rules"-Maske fehlen
        darin. `v2/booking_settings/{id}` gibt sie vollständig — live verifiziert,
        siehe `airbnb_booking_settings_direkt`.

        Ziel ist `type_attributes.policies`, denn dort liest sie sowohl das
        Frontend (`web/lib/policy-meta.ts`) als auch der Channex-Push
        (`content_sync`). Der Airbnb-Rohblock wird daneben abgelegt: er ist der
        Beleg, woher die Werte kommen.

        Nur LEERE Felder werden gefüllt (Wurzel 1) — was der Betrieb selbst
        eingestellt hat, gilt. Rückgabe: die Namen der wirklich gesetzten Felder,
        damit die UI nicht „übernommen" meldet, wo nichts übernommen wurde.
        """
        roh = self.airbnb_booking_settings_direkt(  # type: ignore[attr-defined]
            token, listing_id
        )
        if not roh:
            return []

        rows = (
            db.table("properties").select("type_attributes")
            .eq("tenant_id", tenant_id).eq("id", property_id)
            .limit(1).execute()
        ).data or []
        if not rows:
            return []
        attrs = rows[0].get("type_attributes") or {}
        if not isinstance(attrs, dict):
            attrs = {}
        policies = attrs.get("policies")
        policies = dict(policies) if isinstance(policies, dict) else {}

        gesetzt: list[str] = []
        # Check-in/-out: Airbnbs Zeitwerte inklusive „FLEXIBLE"/„NOT_SELECTED"
        # und der Stunden über 23 (Doku: start bis 26, Ende bis 27).
        for feld, wert in (
            ("checkInTime", ali.check_in_start(roh)),
            ("checkInTimeEnd", ali.check_in_ende(roh)),
            ("checkOutTime", ali.check_out(roh)),
        ):
            if wert and not policies.get(feld):
                policies[feld] = wert
                gesetzt.append(feld)

        regeln = ali.gastregeln_uebernehmen(roh)
        for feld, wert in regeln.items():
            if feld not in policies:
                policies[feld] = wert
                gesetzt.append(feld)

        storno = ali.storno_uebernehmen(roh)
        if storno and not policies.get("airbnbStorno"):
            policies["airbnbStorno"] = storno
            gesetzt.append("airbnbStorno")

        sofort = ali.sofortbuchung_uebernehmen(roh)
        if sofort and not policies.get("airbnbSofortbuchung"):
            policies["airbnbSofortbuchung"] = sofort
            gesetzt.append("airbnbSofortbuchung")

        if not gesetzt:
            return []

        neue_attrs = {
            **attrs,
            "policies": policies,
            # Rohform daneben (wie bei `airbnb.booking_setting`): Beleg der
            # Herkunft und Vergleichsgrundlage für einen späteren Abruf.
            "airbnbHausregeln": roh,
        }
        db.table("properties").update({"type_attributes": neue_attrs}).eq(
            "tenant_id", tenant_id
        ).eq("id", property_id).execute()
        log.info(
            "airbnb_hausregeln_uebernommen",
            property_id=property_id, felder=gesetzt,
        )
        return gesetzt

    @staticmethod
    def _details_interner_name(
        listing: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """Airbnbs internen Namen übernehmen (`listing_nickname`).

        Der Gast-Titel kommt sprachweise über `_details_texte`; dies ist der
        zweite, einsprachige Titel, den nur der Betrieb sieht. Er landet in
        `type_attributes.internal_name`, weil `properties` dafür keine eigene
        Spalte hat — dort liegen alle Objekt-Details ohne Spalte.

        Nur ergänzen (Wurzel 1): ein selbst vergebener interner Name ist die
        Bezeichnung, unter der der Betrieb sein Objekt kennt, und darf von einem
        späteren Abruf nicht überschrieben werden.
        """
        name = ali.interner_name(listing)
        if name and not alt.get("internal_name"):
            neu["internal_name"] = name
            gesetzt.append("internal_name")

    @staticmethod
    def _details_kapazitaet(
        listing: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """Schlafzimmer-/Bad-Anzahl und Einheiten."""
        kapazitaet = ali.kapazitaet_uebernehmen(listing)
        for schluessel in ("schlafzimmer", "betten", "badezimmer", "einheiten"):
            wert = kapazitaet.get(schluessel)
            if wert is not None and alt.get(schluessel) in (None, "", 0):
                neu[schluessel] = wert
                gesetzt.append(schluessel)

    @staticmethod
    def _details_regeln(
        listing: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """Storno, Sofortbuchung, Gastregeln, Verfügbarkeit, Qualität."""
        buchung = listing.get("booking_settings")
        buchung = buchung if isinstance(buchung, dict) else {}
        preise = listing.get("pricing_settings")
        preise = preise if isinstance(preise, dict) else {}

        for schluessel, wert in (
            ("airbnbStorno", ali.storno_uebernehmen(buchung)),
            ("airbnbSofortbuchung", ali.sofortbuchung_uebernehmen(buchung)),
            ("airbnbGastregeln", ali.gastregeln_uebernehmen(buchung) or None),
            ("airbnbVerfuegbarkeit", ali.verfuegbarkeit_uebernehmen(listing) or None),
            ("airbnbQualitaet", ali.qualitaet_uebernehmen(listing) or None),
            ("airbnbGebuehren", ali.gebuehren_uebernehmen(preise) or None),
            ("airbnbZusatzgast", ali.zusatzgast_uebernehmen(preise) or None),
            ("airbnbAusstattung", ali.ausstattung_uebernehmen(listing) or None),
        ):
            # Diese `airbnb*`-Blöcke sind AIRBNBS Stand, kein eigener Wert des
            # Betriebs — sie werden abgeglichen, nicht nur einmal befüllt
            # (Wurzel 1). Bliebe hier „nur wenn leer" stehen, zeigte der Spiegel
            # für immer den Stand des ersten Abrufs. Die daraus abgeleiteten
            # `policies` unten bleiben dagegen ergänzend: dort pflegt der Betrieb
            # selbst.
            if wert and wert != alt.get(schluessel):
                neu[schluessel] = wert
                gesetzt.append(schluessel)

        # Check-in-Zeiten dorthin, wo die Maske sie liest: `policies`.
        start = ali.check_in_start(buchung)
        ende = ali.check_in_ende(buchung)
        aus = ali.check_out(buchung)
        policies = dict(alt.get("policies") or {})
        vorher = dict(policies)
        if start and not policies.get("checkInTime"):
            policies["checkInTime"] = start
        if ende and not policies.get("checkInTimeEnd"):
            policies["checkInTimeEnd"] = ende
        if aus and not policies.get("checkOutTime"):
            policies["checkOutTime"] = aus
        if policies != vorher:
            neu["policies"] = policies
            gesetzt.append("policies")

        # Airbnbs Verfügbarkeitsregeln in das Feld, das die MASKE liest.
        AirbnbObjektAbrufMixin._verfuegbarkeit_in_maske(alt, neu, gesetzt)

    @staticmethod
    def _verfuegbarkeit_in_maske(
        alt: dict[str, Any], neu: dict[str, Any], gesetzt: list[str]
    ) -> None:
        """`airbnbVerfuegbarkeit` → `availability`, wo die Oberfläche liest.

        DER FEHLER, DEN DAS BEHEBT (Beta-Betrieb, 05.08.2026): Der Spiegel
        `airbnbVerfuegbarkeit` war bei ALLEN 18 Objekten korrekt gefüllt
        (Mindestaufenthalt, Buchungsfenster, Vorlaufzeit) — und wurde von
        NIEMANDEM gelesen. Die Maske liest `type_attributes.availability`
        (`web/lib/availability-meta.ts: readAvailability`); dort stand bei 14
        von 18 Objekten gar nichts, also zeigte sie ihre Vorgabewerte. Der
        Betrieb meldete „Mindestaufenthalt und Buchungsfenster weiter falsch",
        obwohl die richtigen Werte in der Nachbarspalte lagen.

        GEFÜLLT WIRD, WAS LEER ODER NOCH AUF DER VORGABE STEHT (Wurzel 1):
        `availability` ist ein vom Betrieb bearbeitbarer Bereich. Wer dort
        bewusst 3 Nächte einstellt, obwohl Airbnb 2 sagt, darf das beim
        nächsten Abruf nicht verlieren.

        Der Vorgabewert zählt aber NICHT als solche Entscheidung: die Maske
        schreibt beim ersten Öffnen den kompletten Default-Block
        (`DEFAULT_AVAILABILITY`, 15 Felder). Live standen dadurch bei vier
        Objekten `minStay: 1`, während Airbnb UND unsere eigenen Rate-Pläne 2
        führten — der Betrieb meldete „Mindestaufenthalt weiter falsch". Ein
        Feld, das noch exakt auf der Vorgabe steht, hat niemand gesetzt.
        """
        spiegel = neu.get("airbnbVerfuegbarkeit") or alt.get("airbnbVerfuegbarkeit")
        if not isinstance(spiegel, dict) or not spiegel:
            return
        vorhanden = alt.get("availability")
        vorhanden = dict(vorhanden) if isinstance(vorhanden, dict) else {}
        ziel = dict(vorhanden)

        def offen(feld: str) -> bool:
            """Leer oder noch auf dem Vorgabewert — also nicht selbst gesetzt."""
            wert = ziel.get(feld)
            if not wert:
                return True
            vorgabe = _AVAILABILITY_VORGABE.get(feld)
            if isinstance(wert, dict) and isinstance(vorgabe, (int, str)):
                # `PerChannel`: die Vorgabe erkennt man am globalen Wert.
                return not wert.get("custom") and wert.get("global") == vorgabe
            return wert == vorgabe

        for quelle, feld in (("minNaechte", "minStay"), ("maxNaechte", "maxStay")):
            wert = spiegel.get(quelle)
            if isinstance(wert, int) and not isinstance(wert, bool) and offen(feld):
                ziel[feld] = wert

        # Buchungsfenster und Vorlaufzeit führt die Maske je Kanal
        # (`PerChannel`): ein globaler Wert plus dieselbe Zahl in allen Kanälen.
        # Ohne diese Form fällt `readAvailability` auf seine Vorgabe zurück.
        voraus = spiegel.get("vorausbuchungTage")
        if isinstance(voraus, int) and not isinstance(voraus, bool):
            if offen("bookingWindowDays"):
                ziel["bookingWindowDays"] = _je_kanal(voraus)
        stunden = spiegel.get("vorlaufStunden")
        if isinstance(stunden, int) and not isinstance(stunden, bool):
            if offen("advanceNotice"):
                # Airbnb zählt STUNDEN Vorlauf, die Maske führt eine Uhrzeit
                # bzw. „24h"/„168h" (`ADVANCE_NOTICE_OPTIONS`). Nur die Werte
                # übernehmen, die es dort wirklich gibt — kein erfundener
                # Zwischenwert (Wurzel 4). Die Tabelle ist die UMKEHRUNG der
                # Schreibrichtung und liegt bewusst nur EINMAL vor
                # (`airbnb_verfuegbarkeit`): zwei getrennte Tabellen driften
                # auseinander und verschieben dann bei jedem Rundlauf die
                # Einstellung des Betriebs.
                passend = VORLAUF_ZU_OPTION.get(stunden)
                if passend:
                    ziel["advanceNotice"] = _je_kanal(passend)

        wechsel = spiegel.get("wechseltage")
        if isinstance(wechsel, int) and not isinstance(wechsel, bool):
            if offen("preparationDays"):
                ziel["preparationDays"] = _je_kanal(wechsel)

        if ziel != vorhanden:
            neu["availability"] = ziel
            gesetzt.append("availability")

    def _details_texte(
        self, channel_id: str, listing_id: str, alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """Die Texte in ALLEN Sprachen, die Airbnb pflegt.

        Live gemessen liefert Airbnb für Objekt 020 drei Sprachversionen
        (de, en, da) — und die Hausregeln NUR auf Deutsch. Der bisherige Import
        holte hart eine Sprache (`de`); bei einem dänischen Gastgeber, der nur
        `da`/`en` gepflegt hat, kam damit gar nichts an.

        Best effort: der Proxy ist ein zusätzlicher Aufruf. Fällt er aus, bleiben
        die übrigen Details erhalten — der Grund steht im Log.
        """
        try:
            antwort = self._channex.get_airbnb_listing_descriptions(  # type: ignore[attr-defined]
                channel_id, listing_id
            )
        except ChannexError as exc:
            log.info(
                "airbnb_texte_nicht_abrufbar",
                listing_id=listing_id, error=str(exc)[:200],
            )
            return
        texte = ali.texte_mehrsprachig(antwort)
        if not texte:
            return
        # `airbnbTexte` ist ein SPIEGEL von Airbnb, kein eigener Text — er MUSS
        # dem Original folgen, sonst friert er auf dem Stand des ersten Abrufs
        # ein.
        #
        # Bis 05.08.2026 stand hier `if not ziel.get(sprache)` („nur ergänzen").
        # Damit war ein einmal geholter Wert für immer festgeschrieben: der
        # Beta-Betrieb benannte „Sommerhus Dora" bei Airbnb in „Feriehus Dora"
        # um, synchronisierte erneut — und bei uns blieb der alte Name stehen,
        # weil der Spiegel „schon gefüllt" war. Der Titel wird aus genau diesem
        # Spiegel abgeleitet (`_landestitel`), also blieb auch er alt.
        #
        # Der Unterschied zu `policies.rentalAgreement` weiter unten: DAS ist
        # ein vom Betrieb bearbeitbarer Text und wird deshalb weiterhin nur
        # ergänzt, nie ersetzt. Hier gibt es nichts zu schützen — was der
        # Betrieb selbst schreibt, steht in `title`/`description`, nicht im
        # Spiegel.
        vorher = alt.get("airbnbTexte")
        vorher = vorher if isinstance(vorher, dict) else {}
        zusammen = {k: dict(v) for k, v in vorher.items() if isinstance(v, dict)}
        geaendert = False
        for feld, je_sprache in texte.items():
            ziel = zusammen.setdefault(feld, {})
            for sprache, text in je_sprache.items():
                if ziel.get(sprache) == text:
                    continue
                # Eine Sprache, die Airbnb NICHT (mehr) liefert, bleibt stehen:
                # `texte` enthält nur, was heute abrufbar war, und ein
                # Netzwerkausfall in einer Sprache darf keinen Text löschen.
                ziel[sprache] = text
                geaendert = True
        if geaendert:
            neu["airbnbTexte"] = zusammen
            gesetzt.append("airbnbTexte")

        # Airbnbs Hausregeln SIND der Mietvertrag: bei diesem Konto stehen dort
        # 10.487 Zeichen „MIETVEREINBARUNG & GRUNDREGELN" (Nebenkosten, Haustiere,
        # Endreinigung, Strafgebühren). Sie lagen bisher nur unter
        # `airbnbTexte.hausregeln` — die Oberfläche liest aber
        # `policies.rentalAgreement`, und der Block blieb leer, obwohl der Text
        # importiert war. Das ist derselbe Ort, an dem Lodgify sie führt
        # („Mietvereinbarung"), also gehören sie dorthin.
        self._mietvertrag_aus_hausregeln(zusammen, alt, neu, gesetzt)

    @staticmethod
    def _mietvertrag_aus_hausregeln(
        texte: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """`airbnbTexte.hausregeln` → `policies.rentalAgreement` (je Sprache).

        Nur LEERE Sprachen werden gefüllt (Wurzel 1): ein selbst geschriebener
        Mietvertrag ist die Fassung, die der Betrieb seinen Gästen zeigt, und
        darf von einem erneuten Abruf nicht ersetzt werden.
        """
        hausregeln = texte.get("hausregeln")
        if not isinstance(hausregeln, dict) or not hausregeln:
            return
        policies = alt.get("policies")
        policies = dict(policies) if isinstance(policies, dict) else {}
        vertrag = policies.get("rentalAgreement")
        vertrag = dict(vertrag) if isinstance(vertrag, dict) else {}
        geaendert = False
        for sprache, text in hausregeln.items():
            if isinstance(text, str) and text.strip() and not vertrag.get(sprache):
                # Airbnb schickt KLARTEXT mit `\n`; das Zielfeld rendert HTML.
                # Ohne Umwandlung stand der ganze Vertrag als eine Textwand da.
                vertrag[sprache] = ali.klartext_zu_absaetzen(text)
                geaendert = True
        if not geaendert:
            return
        policies["rentalAgreement"] = vertrag
        neu["policies"] = policies
        gesetzt.append("rentalAgreement")

    @staticmethod
    def _details_zugang(
        listing: dict[str, Any], alt: dict[str, Any],
        neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """WLAN, Anfahrt, Check-in-Art — die Anreise-Infos für den Gast."""
        zugang = ali.zugangsdaten_uebernehmen(listing)
        if not zugang:
            return
        messaging = dict(alt.get("messaging") or {})
        vorher = dict(messaging)
        for quelle, ziel in (
            ("wlanName", "wifiName"),
            ("wlanPasswort", "wifiPassword"),
            ("anfahrt", "directions"),
            ("checkInHinweis", "checkIn"),
        ):
            wert = zugang.get(quelle)
            if wert and not messaging.get(ziel):
                messaging[ziel] = wert
        if messaging != vorher:
            neu["messaging"] = messaging
            gesetzt.append("messaging")
        for quelle, ziel in (
            ("checkInArt", "checkInArt"),
            ("wohnungszusatz", "apt"),
        ):
            wert = zugang.get(quelle)
            if wert and not alt.get(ziel):
                neu[ziel] = wert
                gesetzt.append(ziel)

    def _weitere_felder_uebernehmen(
        self, db: Client, property_id: str, preisteil: dict[str, Any],
        regeln: dict[str, Any], buchung: dict[str, Any],
    ) -> dict[str, Any]:
        """Alles außer dem Nachtpreis, was Airbnb mitliefert — live gemessen.

        Was in der Mapping-Antwort steht (Objekt 020, 04.08.2026):
          pricing_setting   → default_daily_price, listing_currency,
                              standard_fees[] (Reinigung/Haustier/Resort),
                              price_per_extra_person, guests_included
          availability_rule → default_min_nights, default_max_nights,
                              booking_lead_time, max_days_notice, turnover_days
          booking_setting   → check_in_time_start, check_out_time,
                              cancellation_policy_category, guest_controls
                              (Haustiere/Kinder/Events/Rauchen, pet_capacity)

        Geschrieben wird in `properties.type_attributes` — dort liegen die
        Objekt-Details ohne eigene Spalte. Nur NICHT gepflegte Werte werden
        gesetzt (Wurzel 1): was der Betrieb selbst eingestellt hat, bleibt.
        """
        rows = (
            db.table("properties").select("type_attributes")
            .eq("id", property_id).limit(1).execute()
        ).data or []
        vorhanden = (rows[0].get("type_attributes") or {}) if rows else {}
        if not isinstance(vorhanden, dict):
            vorhanden = {}

        # Airbnbs Rohwerte unangetastet ablegen: sie sind der Beleg, woher unsere
        # Zahlen kommen, und ein späterer Abruf kann dagegen vergleichen.
        neu = dict(vorhanden)
        neu["airbnb"] = {
            "pricing_setting": preisteil,
            "availability_rule": regeln,
            "booking_setting": buchung,
        }

        gesetzt: dict[str, Any] = {}
        # Check-in/-out: Airbnb liefert Stunden als Zahl oder "FLEXIBLE".
        checkin = self._stunde(buchung.get("check_in_time_start"))
        checkout = self._stunde(buchung.get("check_out_time"))
        if checkin is not None and not vorhanden.get("check_in_from"):
            neu["check_in_from"] = f"{checkin:02d}:00"
            gesetzt["check_in_from"] = neu["check_in_from"]
        if checkout is not None and not vorhanden.get("check_out_until"):
            neu["check_out_until"] = f"{checkout:02d}:00"
            gesetzt["check_out_until"] = neu["check_out_until"]

        # Haustiere: Airbnb sagt es ausdrücklich, inkl. Anzahl.
        kontrollen = buchung.get("guest_controls") or {}
        if isinstance(kontrollen, dict) and "allows_pets_as_host" in kontrollen:
            if "pets_allowed" not in vorhanden:
                neu["pets_allowed"] = bool(kontrollen["allows_pets_as_host"])
                gesetzt["pets_allowed"] = neu["pets_allowed"]
            anzahl = self._ganzzahl(kontrollen.get("pet_capacity"))
            if anzahl and "pets_max" not in vorhanden:
                neu["pets_max"] = anzahl
                gesetzt["pets_max"] = anzahl
        if isinstance(kontrollen, dict) and "allows_smoking_as_host" in kontrollen:
            if "smoking_allowed" not in vorhanden:
                neu["smoking_allowed"] = bool(kontrollen["allows_smoking_as_host"])
                gesetzt["smoking_allowed"] = neu["smoking_allowed"]

        # Maximale Aufenthaltsdauer.
        max_naechte = self._ganzzahl(regeln.get("default_max_nights"))
        if max_naechte and not vorhanden.get("max_nights"):
            neu["max_nights"] = max_naechte
            gesetzt["max_nights"] = max_naechte

        db.table("properties").update({"type_attributes": neu}).eq(
            "id", property_id
        ).execute()
        return gesetzt

    @staticmethod
    def _ganzzahl(wert: object) -> int | None:
        """Zahl aus einem Airbnb-Feld — None bei allem, was keine ist.

        Airbnb nutzt `-1` als „nicht gesetzt" (z. B. `day_of_week_min_nights`),
        das darf nie als echter Wert durchgehen (Wurzel 4)."""
        try:
            zahl = int(wert)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        return zahl if zahl >= 0 else None

    @classmethod
    def _stunde(cls, wert: object) -> int | None:
        """Uhrzeit-Stunde aus Airbnbs Check-in/-out — None bei „FLEXIBLE".

        Live gemessen: `check_in_time_start: "16"` (String!), `check_out_time: 10`
        (Zahl), `check_in_time_end: "FLEXIBLE"`. Beide Formen kommen vor."""
        zahl = cls._ganzzahl(wert)
        if zahl is None or not 0 <= zahl <= 23:
            return None
        return zahl

    @staticmethod
    def _nachtpreis(preisteil: dict[str, Any]) -> float | None:
        """Nachtpreis aus Airbnbs `pricing_setting` — None, wenn keiner da ist.

        Live gemessen (Objekt 020): `default_daily_price: 504` neben
        `listing_currency: "DKK"`. Der Feldname ist damit belegt, nicht geraten;
        die Alternativen bleiben als Absicherung stehen, falls Channex die Form
        je Kanal anders schreibt. Fehlt der Wert oder ist er 0, gibt es None —
        kein geratener Preis (Wurzel 4).

        Airbnb setzt `default_daily_price: 0`, solange es noch nichts geladen hat.
        0 ist deshalb KEIN Preis, sondern „unbekannt" — sonst stünde eine Nacht
        für 0 im Preisplan.
        """
        for schluessel in (
            "default_daily_price", "daily_price", "base_price", "price",
        ):
            wert = preisteil.get(schluessel)
            if wert in (None, ""):
                continue
            try:
                zahl = float(wert)
            except (TypeError, ValueError):
                continue
            if zahl > 0:
                return zahl
        return None

    @staticmethod
    def _airbnb_kanal_des_betriebs(
        db: Client, tenant_id: str, property_id: str | None = None
    ) -> str | None:
        """Die Airbnb-Kanal-ID FÜR DIESES OBJEKT.

        Airbnb autorisiert das KONTO, nicht das Objekt: ein Kanal trägt alle
        Objekte des Kontos (Channex-Doku `channel-mapping-guides/airbnb.md`,
        live bestätigt — Kanal 9a46827b-… hält 19 Objekte). Deshalb darf hier
        NICHT je Objekt ein eigener Kanal entstehen; eine frühere Fassung tat
        das und erzeugte einen zweiten, leeren Kanal, an dem die Autorisierung
        nie ankam.

        Der Kanal wird trotzdem ÜBER DAS OBJEKT gesucht, denn ein Betrieb kann
        mehrere Konten je Portal haben (0304): eine Agentur betreut hunderte
        Vermieter mit je eigenem Airbnb-Zugang. Ein tenant-weites „nimm den
        ersten Kanal" träfe dort ein zufälliges fremdes Konto — und weil die
        Abfrage keine Sortierung hatte, bei zwei Aufrufen womöglich zwei
        verschiedene.

        Ohne `property_id` (Aufrufer ohne Objektbezug) gilt weiterhin der
        tenant-weite Weg — aber nur, solange es GENAU EIN Konto gibt. Bei
        mehreren ist die Antwort nicht bestimmbar, und dann ist `None` richtig:
        lieber „nicht verbunden" als der Push in ein fremdes Konto.
        """
        if property_id:
            treffer = (
                db.table("channex_channel_connection")
                .select("channex_channel_id")
                .eq("tenant_id", tenant_id)
                .eq("property_id", str(property_id))
                .eq("ota_portal_code", AIRBNB)
                .not_.is_("channex_channel_id", "null")
                .limit(1)
                .execute()
            ).data or []
            if treffer:
                return str(treffer[0]["channex_channel_id"])
            return None

        konten = (
            db.table("ota_account")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", AIRBNB)
            .not_.is_("channex_channel_id", "null")
            .limit(2)
            .execute()
        ).data or []
        if len(konten) == 1:
            return str(konten[0]["channex_channel_id"])
        return None
