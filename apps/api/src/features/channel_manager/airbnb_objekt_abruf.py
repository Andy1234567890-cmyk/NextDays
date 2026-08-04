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

WAS AIRBNB NICHT HERGIBT: Fotos, Beschreibungen, Ausstattung, Adresse. Dafür
existiert bei Channex kein Weg — kein Content-Endpunkt, kein Content-Webhook,
und `load_listing_*` liefert ausschließlich Preis-, Verfügbarkeits- und
Buchungseinstellungen. Wer Fotos importiert (Hostaway, Guesty, Hospitable), ist
direkter Airbnb-Partner mit eigener Airbnb-API, nicht über einen Aggregator.
Der dokumentierte Weg für den Betrieb selbst ist die Airbnb-Datenauskunft
(Konto → Datenschutz → persönliche Daten anfordern): ZIP mit JSON/Excel plus
einem Ordner mit den Listing-Fotos.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    _currency_for_country,
    _timezone_speicherbar,
    log,
)
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
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id)
        if not channel_id:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden. Verbinde zuerst Airbnb im "
                "Kanalmanager.",
                status_code=409,
            )

        stammdaten = self._stammdaten_nachtragen(db, prop)
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
                db, tenant_id, property_id, str(listing_id), plan, settings
            )

        log.info(
            "airbnb_objekt_abruf_fertig",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, stammdaten=stammdaten,
            plan_angelegt=plan.get("angelegt"),
            zugeordnet=settings is not None,
            preis_uebernommen=preis.get("uebernommen"),
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
            "uebernommene_felder": sorted((preis.get("weitere") or {}).keys()),
            "hinweis": preis.get("hinweis"),
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
    ) -> dict[str, Any]:
        """Airbnbs Einstellungen übernehmen — Preis, Währung, Regeln.

        `settings` sind die Werte, die `POST channels/{id}/mappings` beim Zuordnen
        ZURÜCKGELIEFERT hat. Es braucht keinen zweiten Abruf: die Zuordnung IST
        der Lesevorgang. Genau daran war der erste Bauversuch gescheitert — er
        rief `execute/load_listing_price_settings`, bekam 200 „Success" und keine
        Daten, weil dieser Namensraum auf jeden Namen so antwortet.

        Kommt kein Preis, wird das GESAGT (`uebernommen: false` + Hinweis) und der
        Platzhalter bleibt stehen — statt Erfolg zu behaupten (Wurzel 5).
        """
        preisteil = settings.get("pricing_setting") or {}
        regeln = settings.get("availability_rule") or {}
        buchung = settings.get("booking_setting") or {}

        preis = self._nachtpreis(preisteil)
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
    def _airbnb_kanal_des_betriebs(db: Client, tenant_id: str) -> str | None:
        """Die EINE Airbnb-Kanal-ID des Betriebs.

        Tenant-weit, nicht je Objekt: Airbnb autorisiert das KONTO, ein Betrieb
        hat bei Channex genau einen Airbnb-Kanal, an dem alle Objekte hängen. Eine
        Suche je `property_id` hatte live einen zweiten, leeren Kanal erzeugt, an
        dem die Autorisierung nie ankam.
        """
        rows = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", AIRBNB)
            .execute()
        ).data or []
        for row in rows:
            if row.get("channex_channel_id"):
                return str(row["channex_channel_id"])
        return None
