"""Airbnb-Listing vollständig übernehmen — Airbnb ist die Wahrheit.

WARUM DIESES MODUL EXISTIERT:
Der Betrieb soll NICHTS abtippen. Bisher wurde aus einem Airbnb-Listing nur ein
Bruchteil übernommen (Adresse, Titel, Beschreibung, Fotos, Gästezahl) — und zwar
über Airbnbs private API mit dem Kanal-Token. Der VON AIRBNB DOKUMENTIERTE Weg
liefert deutlich mehr und war nie geprüft worden:

    GET channels/{channel_id}/action/listing_details?listing_id=…

LIVE GEMESSEN (05.08.2026, Konto AirSmil, „013 Rævlingevej · The Fox House"):
200 mit 38 Feldern. Kontrolltest im gleichen Namensraum
(`action/erfundene_aktion_zzz`) → 400 „action is not supported"; die 200 ist also
echt. Was dort steht und bisher NICHT übernommen wurde:

    booking_settings.cancellation_policy_settings   „better_strict_with_grace_period"
    booking_settings.check_in_time_start/_end       „16" / „FLEXIBLE"
    booking_settings.check_out_time                 10
    booking_settings.instant_booking_allowed_cat.   „everyone"
    booking_settings.guest_controls.*               Kinder ja, Babys ja,
                                                    Haustiere nein, Rauchen nein,
                                                    Feiern nein
    pricing_settings.standard_fees[]                Reinigung 955, Resort 25 (DKK)
    pricing_settings.guests_included                1
    pricing_settings.price_per_extra_person         0
    availability_rules.default_min_nights           3
    availability_rules.booking_lead_time            12
    bedrooms / beds / bathrooms                     3 / 3 / 1.0
    rooms[]                                         9 Räume
    quality_standards.state                         „EDUCATE"

ZWEI MESSBEFUNDE, DIE ANNAHMEN KORRIGIEREN:
1. `state` ist auch hier `null`. Airbnb liefert die Region also wirklich nirgends
   — die Rückwärts-Geokodierung aus lat/lng bleibt der richtige Weg.
2. `standard_fees[].amount` kommt als HAUPTEINHEIT (`955.0` DKK), obwohl Airbnbs
   Schema für `flat` „in cents" sagt. Hier gilt die Messung, nicht das Schema —
   deshalb wird NICHT durch 100 geteilt (das wäre ein Faktor-100-Fehler beim
   Geld). Der Wert wird geprüft, nicht umgerechnet.

WAS DIESES MODUL NICHT TUT:
Es überschreibt nichts, was der Betrieb selbst gepflegt hat (Wurzel 1) — jedes
Feld wird nur gesetzt, wenn unser Wert leer ist. Und es erfindet nichts: fehlt
ein Wert bei Airbnb, bleibt er leer (Wurzel 4).
"""
from __future__ import annotations

from html import escape
from typing import Any, Final

import nh3

from .common import log

# --- Storno: Airbnbs 12 Kategorien -----------------------------------------
# Wörtlich aus „Booking Settings Airbnb". Unser eigenes Modell kennt nur
# non_refundable/refundable/partial — die Zuordnung ist deshalb eine Abbildung,
# keine Gleichsetzung, und der Airbnb-Originalwert wird DANEBEN aufbewahrt, damit
# nichts verloren geht.
STORNO_KATEGORIEN: Final[frozenset[str]] = frozenset(
    {
        "flexible",
        "moderate",
        "strict",
        "better_strict_with_grace_period",
        "strict_14_with_grace_period",
        "super_strict_30",
        "super_strict_60",
        "flexible_new",
        "moderate_new",
        "strict_new",
        "super_strict_30_new",
        "super_strict_60_new",
    }
)

# Grobe Einordnung in unser Modell. „strict"-Familien sind nicht erstattungsfrei,
# sondern teilweise erstattbar — „non_refundable" wäre falsch und würde dem Gast
# ein Recht nehmen, das er bei Airbnb hat.
_STORNO_AUF_UNSER_MODELL: Final[dict[str, str]] = {
    "flexible": "refundable",
    "flexible_new": "refundable",
    "moderate": "refundable",
    "moderate_new": "refundable",
    "strict": "partial",
    "strict_new": "partial",
    "better_strict_with_grace_period": "partial",
    "strict_14_with_grace_period": "partial",
    "super_strict_30": "partial",
    "super_strict_30_new": "partial",
    "super_strict_60": "partial",
    "super_strict_60_new": "partial",
}

# --- Sofortbuchung ---------------------------------------------------------
SOFORTBUCHUNG_KATEGORIEN: Final[frozenset[str]] = frozenset(
    {
        "off",
        "everyone",
        "well_reviewed_guests",
        "guests_with_verified_identity",
        "well_reviewed_guests_with_verified_identity",
    }
)

# Unser Modell kennt nur instant/request. „off" heißt: jede Buchung ist eine
# Anfrage. Alle anderen Werte erlauben Sofortbuchung — für WEN, kann unser Modell
# nicht ausdrücken; der Airbnb-Wert bleibt deshalb daneben erhalten.
_SOFORT_AUF_UNSER_MODELL: Final[dict[str, str]] = {
    "off": "request",
    "everyone": "instant",
    "well_reviewed_guests": "instant",
    "guests_with_verified_identity": "instant",
    "well_reviewed_guests_with_verified_identity": "instant",
}

# --- Klartext → Absätze ----------------------------------------------------
# Airbnb liefert seine Texte als KLARTEXT mit `\n`, nicht als HTML. Gemessen am
# Mietvertrag von Objekt 020: 10.487 Zeichen, 37 Zeilenumbrüche, NULL Tags.
# Unser Zielfeld (`policies.rentalAgreement`) ist dagegen ein Rich-Text-Feld und
# rendert HTML — die `\n` sind dort bedeutungslos. Ohne Umwandlung stand der
# ganze Mietvertrag als eine einzige Textwand in der Oberfläche.
#
# Nur diese Tags, und sie werden GEBAUT statt durchgelassen: der Text kommt von
# einem Portal, ist also Fremd-Eingabe (Wurzel 8). `nh3` (Allowlist-Parser, im
# Projekt schon für Beschreibungen und Website-Texte im Einsatz) räumt zum
# Schluss auf, damit auch ein Text, der doch einmal Markup enthält, nichts
# ausführt.
_ABSATZ_TAGS: Final[frozenset[str]] = frozenset({"p", "br", "b", "strong", "i", "em", "u"})


def klartext_zu_absaetzen(text: str) -> str:
    """Airbnb-Klartext → HTML-Absätze, wie das Rich-Text-Feld sie erwartet.

    Jede nicht-leere Zeile wird ein `<p>`. Leerzeilen trennen nur und werden
    nicht zu leeren Absätzen — sonst entstünden im Editor Lücken, die im
    Original keine sind.

    Der Zeileninhalt wird ZUERST escapt und erst danach in `<p>` gefasst. Die
    Reihenfolge ist der Punkt: würde man erst `<p>` bauen und dann `nh3` darüber
    laufen lassen, entfernte der Parser ein `<script>` aus dem Portal-Text
    stillschweigend — der Text wäre verstümmelt, statt sichtbar zu bleiben.
    Escapt bleibt er lesbar UND harmlos (Wurzel 8). `nh3` läuft zum Schluss als
    zweite Absicherung über das fertige Markup.
    """
    zeilen = [z.strip() for z in text.replace("\r\n", "\n").split("\n")]
    absaetze = [z for z in zeilen if z]
    if not absaetze:
        return ""
    roh = "".join(f"<p>{escape(z)}</p>" for z in absaetze)
    return nh3.clean(roh, tags=set(_ABSATZ_TAGS), attributes={}, url_schemes=set())


# --- Check-in-Zeiten -------------------------------------------------------
# Airbnb: `check_in_time_start` als STRING „8".."26", `check_in_time_end` „8".."27",
# jeweils zusätzlich „FLEXIBLE"/„NOT_SELECTED"; `check_out_time` als INTEGER 0..23.
# Die Stunden 24..27 sind Zeiten NACH Mitternacht (24 = 0 Uhr des Folgetags) —
# eine harte 0..23-Prüfung verwirft sie stillschweigend, und genau das ist bisher
# passiert.
ZEIT_FLEXIBEL: Final = "FLEXIBLE"
ZEIT_UNGESETZT: Final = "NOT_SELECTED"

_CHECK_IN_START_MAX: Final = 26
_CHECK_IN_ENDE_MAX: Final = 27
_CHECK_OUT_MAX: Final = 23


def _stunde_ziffern(text: str, *, max_stunde: int) -> int | None:
    """Die Stundenzahl, falls sie in Airbnbs erlaubtem Bereich liegt."""
    try:
        stunde = int(float(text))
    except (TypeError, ValueError):
        return None
    if not 0 <= stunde <= max_stunde:
        log.info("airbnb_stunde_ausserhalb", wert=text, max_stunde=max_stunde)
        return None
    return stunde


def _stunde_als_text(wert: object, *, max_stunde: int) -> str | None:
    """Airbnb-Stundenangabe → „HH:00", oder FLEXIBLE/NOT_SELECTED unverändert.

    Stunden über 23 werden NICHT verworfen (Airbnb erlaubt bis 26 bzw. 27), aber
    auch nicht auf 0 zurückgerechnet — sonst würde aus „1 Uhr nachts" ein
    Check-in um Mitternacht. Sie behalten die Airbnb-Schreibweise.
    """
    text = str(wert).strip() if wert is not None else ""
    if not text:
        return None
    if text.upper() in (ZEIT_FLEXIBEL, ZEIT_UNGESETZT):
        return text.upper()
    stunde = _stunde_ziffern(text, max_stunde=max_stunde)
    if stunde is None:
        return None
    # Nach Mitternacht: als Airbnb-Zahl behalten, nicht als Uhrzeit lügen.
    return str(stunde) if stunde > _CHECK_OUT_MAX else f"{stunde:02d}:00"


def check_in_start(booking_settings: dict[str, Any]) -> str | None:
    return _stunde_als_text(
        booking_settings.get("check_in_time_start"), max_stunde=_CHECK_IN_START_MAX
    )


def check_in_ende(booking_settings: dict[str, Any]) -> str | None:
    return _stunde_als_text(
        booking_settings.get("check_in_time_end"), max_stunde=_CHECK_IN_ENDE_MAX
    )


def check_out(booking_settings: dict[str, Any]) -> str | None:
    """`check_out_time` ist bei Airbnb ein INTEGER 0..23 — kein String."""
    return _stunde_als_text(
        booking_settings.get("check_out_time"), max_stunde=_CHECK_OUT_MAX
    )


def storno_uebernehmen(booking_settings: dict[str, Any]) -> dict[str, Any] | None:
    """Airbnbs Storno-Einstellung → unser Modell + Originalwert daneben."""
    roh = booking_settings.get("cancellation_policy_settings")
    if not isinstance(roh, dict):
        return None
    kategorie = roh.get("cancellation_policy_category")
    if not isinstance(kategorie, str) or kategorie not in STORNO_KATEGORIEN:
        if kategorie:
            log.info("airbnb_storno_unbekannt", kategorie=str(kategorie)[:60])
        return None
    ergebnis: dict[str, Any] = {
        "airbnbKategorie": kategorie,
        "modus": _STORNO_AUF_UNSER_MODELL[kategorie],
    }
    lts = roh.get("lts_cancellation_policy_id")
    if isinstance(lts, str) and lts.strip():
        ergebnis["langzeitPolicy"] = lts.strip()
    faktor = roh.get("non_refundable_price_factor")
    if isinstance(faktor, (int, float)) and not isinstance(faktor, bool):
        ergebnis["nichtErstattbarFaktor"] = float(faktor)
    return ergebnis


def sofortbuchung_uebernehmen(booking_settings: dict[str, Any]) -> dict[str, Any] | None:
    """`instant_booking_allowed_category` → unser buchungsmodus + Originalwert."""
    kategorie = booking_settings.get("instant_booking_allowed_category")
    if not isinstance(kategorie, str) or kategorie not in SOFORTBUCHUNG_KATEGORIEN:
        if kategorie:
            log.info("airbnb_sofortbuchung_unbekannt", kategorie=str(kategorie)[:60])
        return None
    return {
        "airbnbKategorie": kategorie,
        "modus": _SOFORT_AUF_UNSER_MODELL[kategorie],
    }


# --- Gastregeln ------------------------------------------------------------
# Airbnbs `guest_controls` sind Booleans; `pet_capacity` eine Zahl. Ein `null`
# heißt „nicht gesetzt" und ist NICHT „nein" — deshalb wird None durchgelassen
# statt zu False gemacht (Wurzel 4).
_GASTREGEL_FELDER: Final[dict[str, str]] = {
    "allows_children_as_host": "kinderErlaubt",
    "allows_infants_as_host": "babysErlaubt",
    "allows_pets_as_host": "haustiereErlaubt",
    "allows_smoking_as_host": "rauchenErlaubt",
    "allows_events_as_host": "feiernErlaubt",
}


def gastregeln_uebernehmen(booking_settings: dict[str, Any]) -> dict[str, Any]:
    """`guest_controls` → unsere Regel-Flags. Nicht gesetzt bleibt weg."""
    roh = booking_settings.get("guest_controls")
    if not isinstance(roh, dict):
        return {}
    regeln: dict[str, Any] = {}
    for airbnb_feld, unser_feld in _GASTREGEL_FELDER.items():
        wert = roh.get(airbnb_feld)
        if isinstance(wert, bool):
            regeln[unser_feld] = wert
    kapazitaet = roh.get("pet_capacity")
    if isinstance(kapazitaet, int) and not isinstance(kapazitaet, bool):
        if kapazitaet >= 0:
            regeln["haustiereMax"] = kapazitaet
    details = roh.get("children_not_allowed_details")
    if isinstance(details, str) and details.strip():
        regeln["kinderHinweis"] = details.strip()
    return regeln


# --- Gebühren --------------------------------------------------------------
# Airbnbs 13 Gebührenarten → unsere Kategorien. Die Namen stehen wörtlich im
# Pricing-Settings-Schema; ein unbekannter Wert wird NICHT geraten.
GEBUEHR_AUF_UNSERE_ART: Final[dict[str, str]] = {
    "PASS_THROUGH_CLEANING_FEE": "cleaning_fee",
    "PASS_THROUGH_SHORT_TERM_CLEANING_FEE": "short_term_cleaning_fee",
    "PASS_THROUGH_PET_FEE": "pet_fee",
    "PASS_THROUGH_RESORT_FEE": "resort_fee",
    "PASS_THROUGH_LINEN_FEE": "linen_fee",
    "PASS_THROUGH_COMMUNITY_FEE": "community_fee",
    "PASS_THROUGH_MANAGEMENT_FEE": "management_fee",
    "PASS_THROUGH_ELECTRICITY_FEE": "electricity_fee",
    "PASS_THROUGH_WATER_FEE": "water_fee",
    "PASS_THROUGH_HEATING_FEE": "heating_fee",
    "PASS_THROUGH_AIR_CONDITIONING_FEE": "air_conditioning_fee",
    "PASS_THROUGH_UTILITY_FEE": "utility_fee",
    "PASS_THROUGH_SECURITY_DEPOSIT": "security_deposit",
}

# Wie oft die Gebühr anfällt (Airbnb: charge_period × charge_type).
_ZEITRAUM: Final[dict[str, str]] = {
    "PER_BOOKING": "per_stay",
    "PER_NIGHT": "per_night",
}


def gebuehren_uebernehmen(pricing_settings: dict[str, Any]) -> list[dict[str, Any]]:
    """`standard_fees[]` → unsere Gebührenliste.

    Der Betrag wird NICHT umgerechnet: live gemessen kommt er als Haupteinheit
    (955.0 DKK für die Reinigung), obwohl Airbnbs Schema bei `flat` „in cents"
    sagt. Eine Division durch 100 wäre hier ein Faktor-100-Fehler zu Lasten des
    Betriebs — die Messung schlägt das Schema.
    """
    rohe = pricing_settings.get("standard_fees")
    if not isinstance(rohe, list):
        return []
    ergebnis: list[dict[str, Any]] = []
    for eintrag in rohe:
        if not isinstance(eintrag, dict):
            continue
        art = eintrag.get("fee_type")
        unsere_art = GEBUEHR_AUF_UNSERE_ART.get(str(art))
        if not unsere_art:
            log.info("airbnb_gebuehrenart_unbekannt", art=str(art)[:60])
            continue
        betrag = eintrag.get("amount")
        if not isinstance(betrag, (int, float)) or isinstance(betrag, bool):
            continue
        if betrag <= 0:
            # 0-Beträge sind bei Airbnb „Platzhalter für nicht erhoben" (live so
            # gemessen) — keine Gebühr anlegen.
            continue
        gebuehr: dict[str, Any] = {
            "art": unsere_art,
            "betrag": float(betrag),
            "airbnbArt": str(art),
            "prozentual": eintrag.get("amount_type") == "percent",
        }
        zeitraum = _ZEITRAUM.get(str(eintrag.get("charge_period") or ""))
        if zeitraum:
            gebuehr["zeitraum"] = zeitraum
        typ = eintrag.get("charge_type")
        if isinstance(typ, str) and typ.strip():
            gebuehr["berechnung"] = typ.strip()
        ergebnis.append(gebuehr)
    return ergebnis


def zusatzgast_uebernehmen(pricing_settings: dict[str, Any]) -> dict[str, Any]:
    """`guests_included` + `price_per_extra_person` → unser Zusatzgast-Modell."""
    ergebnis: dict[str, Any] = {}
    inklusive = pricing_settings.get("guests_included")
    if isinstance(inklusive, int) and not isinstance(inklusive, bool):
        if inklusive >= 1:
            ergebnis["abGast"] = inklusive
    preis = pricing_settings.get("price_per_extra_person")
    if isinstance(preis, (int, float)) and not isinstance(preis, bool):
        if preis > 0:
            ergebnis["betrag"] = float(preis)
    return ergebnis


# --- Räume und Betten ------------------------------------------------------
# Airbnbs `rooms[]` trägt `room_type` und `beds[{quantity,type}]`. Live gemessen
# waren die Bettenlisten LEER und `room_number` null — die Räume sind also nur als
# Typen bekannt. Das wird so übernommen und nicht mit erfundenen Betten gefüllt.
_RAUM_ARTEN_MIT_BETT: Final[frozenset[str]] = frozenset({"bedroom", "living_room"})


def raeume_uebernehmen(listing: dict[str, Any]) -> list[dict[str, Any]]:
    """`rooms[]` → unsere Raumliste (Art, Nummer, privat, Betten, Ausstattung).

    `is_private` ist der Wert, den Lodgify als „(privat)" bzw.
    „(gemeinschaftlich)" hinter jedem Raum anzeigt. Live gemessen liefert Airbnb
    ihn je Raum mit — er wurde bisher nicht übernommen.
    """
    rohe = listing.get("rooms")
    if not isinstance(rohe, list):
        return []
    ergebnis: list[dict[str, Any]] = []
    for eintrag in rohe:
        if not isinstance(eintrag, dict):
            continue
        art = eintrag.get("room_type")
        if not isinstance(art, str) or not art.strip():
            continue
        raum: dict[str, Any] = {"art": art.strip()}
        nummer = eintrag.get("room_number")
        if isinstance(nummer, int) and not isinstance(nummer, bool):
            raum["nummer"] = nummer
        # `None` heißt „Airbnb sagt nichts dazu" und ist NICHT „gemeinschaftlich"
        # (Wurzel 4) — nur ein echtes Boolean wird übernommen.
        privat = eintrag.get("is_private")
        if isinstance(privat, bool):
            raum["privat"] = privat
        kennung = eintrag.get("id")
        if kennung is not None and str(kennung).strip():
            # Die Airbnb-Raum-ID: `images[].room_id` und
            # `amenities[].room_attachment_infos[].room_id` zeigen darauf, also
            # ist sie der Schlüssel, um Foto und Ausstattung einem Raum
            # zuzuordnen.
            raum["airbnbRaumId"] = str(kennung).strip()
        betten = [
            {"art": str(b.get("type")), "anzahl": int(b.get("quantity") or 0)}
            for b in (eintrag.get("beds") or [])
            if isinstance(b, dict)
            and b.get("type")
            and isinstance(b.get("quantity"), int)
            and b.get("quantity")
        ]
        if betten:
            raum["betten"] = betten
        ausstattung = eintrag.get("room_amenities")
        if isinstance(ausstattung, list) and ausstattung:
            raum["ausstattung"] = [str(a) for a in ausstattung if a]
        ergebnis.append(raum)
    return ergebnis


def kapazitaet_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """`bedrooms`/`beds`/`bathrooms`/`person_capacity`/`total_inventory_count`.

    `bathrooms` ist bei Airbnb ein Float (1.0, 1.5 = „halbes Bad") und wird
    deshalb NICHT auf int gezwungen.

    `total_inventory_count` ist die STÜCKZAHL des Typs — genau die Zahl, die
    Lodgify als „1 Einheit" zeigt und die unser Datenmodell als `property_units`
    führt. Live gemessen liefert Airbnb sie (`1` bei Objekt 020), in einer
    anderen Antwort fehlte das Feld ganz; beides wird unterschieden.

    Die WOHNFLÄCHE steht nicht hier, sondern in `property_details` — siehe
    `gebaeudedaten_uebernehmen`.
    """
    ergebnis: dict[str, Any] = {}
    for airbnb_feld, unser_feld in (
        ("bedrooms", "schlafzimmer"),
        ("beds", "betten"),
        ("person_capacity", "maxGaeste"),
        ("total_inventory_count", "einheiten"),
    ):
        wert = listing.get(airbnb_feld)
        if isinstance(wert, int) and not isinstance(wert, bool) and wert > 0:
            ergebnis[unser_feld] = wert
    bad = listing.get("bathrooms")
    if isinstance(bad, (int, float)) and not isinstance(bad, bool) and bad > 0:
        ergebnis["badezimmer"] = float(bad)
    return ergebnis


# Airbnbs Einheit → unser `properties.size_unit` (0197: 'sqm' | 'sqft').
# Nur diese zwei; ein unbekannter Wert wird NICHT auf m² geraten, weil eine
# falsch gedeutete Einheit die Fläche um Faktor 10 verfehlt (Wurzel 4).
_FLAECHE_EINHEIT: Final[dict[str, str]] = {
    "SQUARE_METERS": "sqm",
    "SQUARE_FEET": "sqft",
}


def gebaeudedaten_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """`property_details` → Wohnfläche, Baujahr, Etagen.

    KORREKTUR EINER FRÜHEREN MESSUNG: hier stand, Airbnb habe kein Größenfeld —
    `property_details.listing_size` sei ein leeres Objekt. Das galt nur, solange
    der Gastgeber die Fläche nicht gepflegt hatte. Neu gemessen am 05.08.2026
    (Konto AirSmil, Objekt 020, `GET v2/listings/{id}`):

        property_details: {
            "listing_size": {"size": 33, "size_unit": "SQUARE_METERS"},
            "year_built": 1928,
            "number_of_floors": 1,
            "listing_floor": 1
        }

    In Airbnbs Oberfläche stehen genau diese vier unter „Property type"
    („Property size 33 / Unit: Square meters", „Year built", „How many floors in
    the building?", „Which floor is the listing on?"). Weil die alte Annahme im
    Code festgeschrieben war, blieb unser Pflichtfeld „Größe (m²)" leer, obwohl
    Airbnb den Wert liefert.

    Die Fläche geht in die ECHTEN Spalten `size_value`/`size_unit` (0197), nicht
    in `type_attributes`: sie ist ein Verkaufsargument und wird gefiltert.
    Baujahr und Etagen haben keine Spalte und bleiben in `type_attributes`.
    """
    roh = listing.get("property_details")
    if not isinstance(roh, dict):
        return {}
    ergebnis: dict[str, Any] = {}

    groesse = roh.get("listing_size")
    if isinstance(groesse, dict):
        wert = groesse.get("size")
        einheit = _FLAECHE_EINHEIT.get(str(groesse.get("size_unit") or "").upper())
        if (
            isinstance(wert, (int, float))
            and not isinstance(wert, bool)
            and wert > 0
            and einheit
        ):
            # Ohne bekannte Einheit KEINE Fläche: „33" könnte m² oder sq ft sein,
            # und der Unterschied ist Faktor 10.
            ergebnis["flaeche"] = float(wert)
            ergebnis["flaecheEinheit"] = einheit
        elif wert and not einheit:
            log.info(
                "airbnb_flaeche_einheit_unbekannt",
                einheit=str(groesse.get("size_unit"))[:40],
            )

    for airbnb_feld, unser_feld in (
        ("year_built", "baujahr"),
        ("number_of_floors", "etagenImGebaeude"),
        ("listing_floor", "etage"),
    ):
        wert = roh.get(airbnb_feld)
        if isinstance(wert, int) and not isinstance(wert, bool) and wert > 0:
            ergebnis[unser_feld] = wert
    return ergebnis


def interner_name(listing: dict[str, Any]) -> str | None:
    """`listing_nickname` → der interne Name des Objekts.

    Airbnb führt ZWEI Arten von Titel, und nur die erste ist mehrsprachig:
      * den Gast-Titel je Sprache — er steht in `listing_descriptions[].name`
        und kommt über `texte_mehrsprachig` herein (live: de/en/da).
      * den internen Namen — EIN Wert auf Listing-Ebene, den der Gast nie sieht
        („The internal title is just for you—guests won't see it").

    Weil der interne Name neben `listing_descriptions` liegt und nicht darin,
    hat ihn der Textimport nicht mitgenommen: bei Objekt 020 heißt der
    Gast-Titel „FeWo Lille Lægehus", intern aber „020 Lille Lægehus (1966)" —
    also die Hausnummer und das Baujahr, mit denen der Betrieb sein Objekt
    wiedererkennt. Genau die Angabe fehlte nach dem Import.

    Nicht mehrsprachig behandeln: Airbnb liefert hier keine `locale`, und eine
    zu erfinden würde den Wert unter einer geratenen Sprache ablegen.
    """
    wert = listing.get("listing_nickname")
    if isinstance(wert, str) and wert.strip():
        return wert.strip()
    return None


# Airbnb setzt seinen Anzeigenamen aus internem Namen und Gast-Titel zusammen
# und trennt sie mit einem Mittelpunkt (U+00B7), umgeben von Leerzeichen.
_TITEL_TRENNER: Final = "·"


def titel_trennen(anzeigename: str) -> tuple[str, str | None]:
    """Airbnbs Anzeigename → (Gast-Titel, interner Name).

    Die LISTEN-Antwort (`listing_id_dictionary.values[].title`) liefert keinen
    reinen Titel, sondern beides in einem String:

        "020 Lille Lægehus (1966) · FeWo Lille Lægehus"
         └─ interner Name ────────┘   └─ Gast-Titel ─┘

    Live gemessen an allen Objekten des Kontos (05.08.2026) — auch
    „013 Rævlingevej · The Fox House" und „012 Oddenvej 3 (kode 1753) · …".
    Übernahm man den String unverändert als `properties.title`, stand die
    interne Bezeichnung (Hausnummer, Baujahr, teils ein TÜRCODE) im
    Gast-Titel — und damit in dem Feld, das der Gast im Marktplatz sieht.

    Die Reihenfolge ist NICHT geraten: die Detail-Antwort desselben Listings
    führt `listing_nickname` („020 Lille Lægehus (1966)") und
    `descriptions.name` („FeWo Lille Lægehus") getrennt, was den vorderen Teil
    als internen Namen belegt.

    Ohne Trenner ist der ganze String der Gast-Titel — dann gibt es keinen
    internen Namen, und es wird auch keiner erfunden (Wurzel 4). Mehr als ein
    Trenner: nur am ERSTEN getrennt, damit ein Mittelpunkt im Gast-Titel
    („Haus · am Meer") diesen nicht weiter zerschneidet.
    """
    text = anzeigename.strip()
    if _TITEL_TRENNER not in text:
        return text, None
    vorn, _, hinten = text.partition(_TITEL_TRENNER)
    intern, gast = vorn.strip(), hinten.strip()
    # Ein Trenner ohne Text auf einer Seite trennt nichts Sinnvolles — dann gilt
    # der ganze String, statt einen leeren Titel zu erzeugen.
    if not intern or not gast:
        return text, None
    return gast, intern


def zugangsdaten_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """WLAN, Anfahrt und Check-in-Art — was der Gast zur Anreise braucht.

    Live gemessen liefert Airbnb `wifi_network: "NOKIA-BC71"`, ein gesetztes
    `wifi_password` und `check_in_option: {category: "lockbox", instruction:
    "Der Check-in erfolgt … über eine Schlüsselbox …"}`. Das stand bisher im
    Negativ-Katalog („kein Zielfeld") und wurde verworfen.
    """
    ergebnis: dict[str, Any] = {}
    for airbnb_feld, unser_feld in (
        ("wifi_network", "wlanName"),
        ("wifi_password", "wlanPasswort"),
        ("directions", "anfahrt"),
        ("apt", "wohnungszusatz"),
    ):
        wert = listing.get(airbnb_feld)
        if isinstance(wert, str) and wert.strip():
            ergebnis[unser_feld] = wert.strip()
    zugang = listing.get("check_in_option")
    if isinstance(zugang, dict):
        art = zugang.get("category")
        if isinstance(art, str) and art.strip():
            ergebnis["checkInArt"] = art.strip()
        hinweis = zugang.get("instruction")
        if isinstance(hinweis, str) and hinweis.strip():
            ergebnis["checkInHinweis"] = hinweis.strip()
    return ergebnis


# --- Verfügbarkeitsregeln --------------------------------------------------
# Airbnbs erlaubte Werte, wörtlich aus dem Availability-Settings-Schema. Wir
# LESEN hier nur — die Allowlists dienen dazu, offensichtlichen Unsinn nicht als
# Geschäftsregel zu übernehmen.
VORLAUF_STUNDEN: Final[frozenset[int]] = frozenset(
    set(range(0, 25)) | {48, 72, 168}
)
VORAUSBUCHUNG_TAGE: Final[frozenset[int]] = frozenset(
    {-1, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365}
)
WECHSELTAGE: Final[frozenset[int]] = frozenset({0, 1, 2})
_NAECHTE_MAX: Final = 1125


def verfuegbarkeit_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """`availability_rules` → unsere Regeln, nur gültige Werte."""
    rohe = listing.get("availability_rules")
    if not isinstance(rohe, dict):
        return {}
    ergebnis: dict[str, Any] = {}

    for feld, ziel in (("default_min_nights", "minNaechte"),
                       ("default_max_nights", "maxNaechte")):
        wert = rohe.get(feld)
        if isinstance(wert, int) and not isinstance(wert, bool):
            if 1 <= wert <= _NAECHTE_MAX:
                ergebnis[ziel] = wert

    vorlauf = rohe.get("booking_lead_time")
    if isinstance(vorlauf, int) and not isinstance(vorlauf, bool):
        if vorlauf in VORLAUF_STUNDEN:
            ergebnis["vorlaufStunden"] = vorlauf

    voraus = rohe.get("max_days_notice")
    if isinstance(voraus, int) and not isinstance(voraus, bool):
        if voraus in VORAUSBUCHUNG_TAGE:
            ergebnis["vorausbuchungTage"] = voraus

    wechsel = rohe.get("turnover_days")
    if isinstance(wechsel, int) and not isinstance(wechsel, bool):
        if wechsel in WECHSELTAGE:
            ergebnis["wechseltage"] = wechsel

    rtb = rohe.get("allow_rtb_above_max_nights")
    if isinstance(rtb, bool):
        ergebnis["anfrageUeberMaxNaechte"] = rtb

    saison = rohe.get("seasonal_min_nights")
    if isinstance(saison, list) and saison:
        gueltig = [
            {
                "von": str(s.get("start_date")),
                "bis": str(s.get("end_date")),
                "minNaechte": int(s.get("min_nights")),
            }
            for s in saison
            if isinstance(s, dict)
            and s.get("start_date")
            and s.get("end_date")
            and isinstance(s.get("min_nights"), int)
            and 1 <= int(s["min_nights"]) <= _NAECHTE_MAX
        ]
        if gueltig:
            ergebnis["saisonMinNaechte"] = gueltig
    return ergebnis


# --- Qualität und Betriebszustand -----------------------------------------
QUALITAETS_ZUSTAENDE: Final[frozenset[str]] = frozenset(
    {
        "GOOD",
        "WARN",
        "PROBATION",
        "SUSPEND",
        "ADDITIONAL_WARN",
        "PENDING_REMOVAL",
        "EDUCATE",
        "REMOVED",
    }
)


def qualitaet_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """`quality_standards` → Zustand + Punktzahl.

    Live gemessen: `state: "EDUCATE"`, `quality_percentage: 7.0`. Das ist eine
    Warnung von Airbnb, die der Betrieb sehen MUSS — im schlimmsten Fall wird das
    Objekt bei Airbnb entfernt.
    """
    rohe = listing.get("quality_standards")
    if not isinstance(rohe, dict):
        return {}
    ergebnis: dict[str, Any] = {}
    zustand = rohe.get("state")
    if isinstance(zustand, str) and zustand.strip().upper() in QUALITAETS_ZUSTAENDE:
        ergebnis["zustand"] = zustand.strip().upper()
    punkte = rohe.get("score")
    if isinstance(punkte, dict):
        prozent = punkte.get("quality_percentage")
        if isinstance(prozent, (int, float)) and not isinstance(prozent, bool):
            ergebnis["prozent"] = float(prozent)
        favorit = punkte.get("is_guest_favorite")
        if isinstance(favorit, bool):
            ergebnis["gaesteliebling"] = favorit
    return ergebnis


# --- Zimmer und Betten in das Format der Objekt-Maske ----------------------
# Die Maske speichert Zimmer als `type_attributes.rooms`
# = {"privat": {slug: anzahl}, "gemeinschaftlich": {slug: anzahl}} und Betten als
# `type_attributes.beds` = {slug: anzahl} (web/lib/property-meta.ts). Airbnbs
# `room_type` muss deshalb auf unsere Slugs übersetzt werden — ein unbekannter
# Wert wird NICHT geraten, sondern übersprungen und geloggt.
AIRBNB_RAUM_AUF_SLUG: Final[dict[str, str]] = {
    "bedroom": "schlafzimmer",
    "full_bathroom": "badezimmer",
    "bathroom": "badezimmer",
    "half_bathroom": "wc",
    "toilet": "wc",
    "living_room": "wohnzimmer",
    "dining_room": "esszimmer",
    "kitchen": "kueche",
    "patio": "terrasse",
    "balcony": "balkon",
    "terrace": "terrasse",
    "office": "arbeitszimmer",
    "game_room": "spielzimmer",
    "sleeping_area": "schlafbereich",
    # Nachtrag aus der Live-Messung aller 18 Anzeigen (`GET v2/listing_rooms`,
    # 05.08.2026, 157 Zimmer): diese Arten kamen real vor und hatten hier keinen
    # Eintrag — sie fielen unter `airbnb_raumart_unbekannt` und gingen verloren.
    "workspace": "arbeitszimmer",
    "deck": "terrasse",
    "laundry_room": "hauswirtschaftsraum",
    # Airbnbs Sammelraum „common_spaces" ist KEIN Zimmer unserer Liste — er
    # beschreibt geteilte Flächen allgemein. Er wird bewusst übersprungen, statt
    # willkürlich auf „Wohnzimmer" gelegt zu werden.
}

# Airbnbs Bettentypen → unsere BED_SLUGS.
AIRBNB_BETT_AUF_SLUG: Final[dict[str, str]] = {
    "double_bed": "doppelbett",
    "single_bed": "einzelbett",
    "queen_bed": "breites_doppelbett",
    "king_bed": "kingsize",
    "bunk_bed": "etagenbett",
    "couch": "schlafsofa",
    "sofa_bed": "schlafsofa",
    "murphy_bed": "schrankbett",
    "air_mattress": "ausziehbett",
    "floor_mattress": "futon",
    "toddler_bed": "kinderbett",
    "crib": "babybett",
    "water_bed": "wasserbett",
    "hammock": "futon",
}

# Räume, die keine Zimmer im Sinne der Maske sind. „exterior" ist nur „draußen"
# und hat keinen eigenen Slug; `backyard`/`garden`/`sunroom` sind ebenfalls
# Außenflächen (live gemessen, je 1× im Konto). Sie auf `terrasse` zu legen wäre
# eine Behauptung, kein Messwert — sie werden bewusst übersprungen und stehen
# hier, damit sie nicht dauerhaft als „unbekannt" protokolliert werden.
_RAUM_UEBERSPRINGEN: Final[frozenset[str]] = frozenset(
    {"exterior", "common_spaces", "backyard", "garden", "sunroom"}
)


def zimmer_zaehlwerk(listing: dict[str, Any]) -> dict[str, dict[str, int]]:
    """`rooms[]` → `{"privat": {slug: n}, "gemeinschaftlich": {slug: n}}`.

    Genau das Format, das die Objekt-Maske liest. `is_private` entscheidet die
    Ebene; fehlt es, gilt der Raum als privat — das ist bei einer ganzen Wohnung
    (`room_type_category: "entire_home"`) der Normalfall und die Angabe, die
    Airbnb selbst für alle gemessenen Räume liefert.
    """
    rohe = listing.get("rooms")
    if not isinstance(rohe, list):
        return {"privat": {}, "gemeinschaftlich": {}}
    privat: dict[str, int] = {}
    geteilt: dict[str, int] = {}
    for eintrag in rohe:
        if not isinstance(eintrag, dict):
            continue
        art = str(eintrag.get("room_type") or "").strip()
        if not art or art in _RAUM_UEBERSPRINGEN:
            continue
        slug = AIRBNB_RAUM_AUF_SLUG.get(art)
        if not slug:
            log.info("airbnb_raumart_unbekannt", art=art)
            continue
        ziel = geteilt if eintrag.get("is_private") is False else privat
        ziel[slug] = ziel.get(slug, 0) + 1
    return {"privat": privat, "gemeinschaftlich": geteilt}


def betten_zaehlwerk(listing: dict[str, Any]) -> dict[str, int]:
    """`rooms[].beds[]` → `{slug: anzahl}` für die Schlafgelegenheiten.

    Airbnbs Bettenlisten sind bei diesem Konto durchgehend LEER — dann kommt
    hier {} zurück und die Maske bleibt leer. Es wird nichts aus `beds: 2`
    hochgerechnet: welche ART von Bett das ist, sagt Airbnb dort nicht, und ein
    geratenes „2 Doppelbetten" wäre eine Falschaussage über das Objekt.
    """
    rohe = listing.get("rooms")
    if not isinstance(rohe, list):
        return {}
    zaehlwerk: dict[str, int] = {}
    for eintrag in rohe:
        if not isinstance(eintrag, dict):
            continue
        for bett in eintrag.get("beds") or []:
            if not isinstance(bett, dict):
                continue
            art = str(bett.get("type") or "").strip()
            anzahl = bett.get("quantity")
            if not art or not isinstance(anzahl, int) or isinstance(anzahl, bool):
                continue
            if anzahl <= 0:
                continue
            slug = AIRBNB_BETT_AUF_SLUG.get(art)
            if not slug:
                log.info("airbnb_bettart_unbekannt", art=art)
                continue
            zaehlwerk[slug] = zaehlwerk.get(slug, 0) + anzahl
    return zaehlwerk


def ausstattung_uebernehmen(listing: dict[str, Any]) -> list[dict[str, Any]]:
    """`amenities` → Liste mit Anleitung und Raumbezug.

    Airbnbs Form je Ausstattung: `{instruction, is_present, metadata,
    room_attachment_infos}`. Bisher wurde NUR `is_present` gelesen und der Name
    kleingeschrieben — `instruction` („wo/wie zu benutzen") und der Raumbezug
    gingen verloren. Live gemessen: `HAIR_DRYER` hängt an Raum `661696088`
    (dem Bad), was Airbnbs eigene Raum-ID ist.

    Nur wirklich vorhandene Ausstattung wird übernommen: `is_present: false`
    heißt „gibt es hier nicht" und ist keine Ausstattung.
    """
    rohe = listing.get("amenities")
    if not isinstance(rohe, dict):
        return []
    ergebnis: list[dict[str, Any]] = []
    for name, wert in rohe.items():
        if not isinstance(name, str) or not name.strip():
            continue
        if not isinstance(wert, dict) or wert.get("is_present") is not True:
            continue
        eintrag: dict[str, Any] = {"airbnbName": name.strip()}
        hinweis = wert.get("instruction")
        if isinstance(hinweis, str) and hinweis.strip():
            eintrag["hinweis"] = hinweis.strip()
        raeume = [
            str(r.get("room_id")).strip()
            for r in (wert.get("room_attachment_infos") or [])
            if isinstance(r, dict)
            and r.get("is_attached") is True
            and r.get("room_id") is not None
        ]
        if raeume:
            eintrag["raeume"] = raeume
        ergebnis.append(eintrag)
    return ergebnis


# Airbnbs Textfelder → unsere. Zehn Felder, wörtlich aus der Listing-Antwort.
_TEXT_FELDER: Final[dict[str, str]] = {
    "name": "name",
    "description": "beschreibung",
    "summary": "kurzfassung",
    "space": "raum",
    "access": "zugang",
    "interaction": "kontakt",
    "neighborhood_overview": "umgebung",
    "transit": "anreise",
    "notes": "hinweise",
    "house_rules": "hausregeln",
}


def texte_mehrsprachig(antwort: dict[str, Any]) -> dict[str, dict[str, str]]:
    """`listing_descriptions[]` → `{unser_feld: {sprache: text}}`.

    Airbnb liefert je Sprache einen eigenen Eintrag mit `locale`. Live gemessen
    für Objekt 020: DREI Sprachen (de, en, da) — und `house_rules` steht nur in
    der deutschen Fassung.

    Das ist der Grund für diese Form: unsere Textfelder sind mehrsprachig
    (`{locale: text}`), und wer nur eine Sprache holt, verliert die anderen. Genau
    dieser Fehler hat schon die Bildtexte betroffen: sie lagen unter `en`, die
    deutsche Oberfläche las `de` und zeigte Platzhalter.

    Die Sprache wird NIE geraten — ein Eintrag ohne `locale` wird übersprungen.
    """
    zeilen = (antwort.get("data") or {}).get("listing_descriptions")
    if not isinstance(zeilen, list):
        return {}
    ergebnis: dict[str, dict[str, str]] = {}
    for zeile in zeilen:
        if not isinstance(zeile, dict):
            continue
        sprache = zeile.get("locale")
        if not isinstance(sprache, str) or not sprache.strip():
            log.info("airbnb_textzeile_ohne_sprache")
            continue
        sprache = sprache.strip().lower()
        for airbnb_feld, unser_feld in _TEXT_FELDER.items():
            wert = zeile.get(airbnb_feld)
            if isinstance(wert, str) and wert.strip():
                ergebnis.setdefault(unser_feld, {})[sprache] = wert.strip()
    return ergebnis


def texte_uebernehmen(listing: dict[str, Any]) -> dict[str, Any]:
    """`descriptions` → Texte MIT ihrer Sprache.

    Die Sprache kommt aus `locale` und wird NICHT auf „de" geraten: bei diesem
    Konto ist sie `en`. Wer sie annimmt, legt englische Texte unter `de` ab — der
    Fehler, an dem schon die Bildtexte gescheitert sind.
    """
    rohe = listing.get("descriptions")
    if not isinstance(rohe, dict):
        return {}
    sprache = rohe.get("locale")
    sprache = sprache.strip().lower() if isinstance(sprache, str) and sprache else None
    if not sprache:
        log.info("airbnb_texte_ohne_sprache")
        return {}

    ergebnis: dict[str, Any] = {"sprache": sprache}
    if isinstance(rohe.get("machine_translated"), bool):
        ergebnis["maschinellUebersetzt"] = rohe["machine_translated"]
    for airbnb_feld, unser_feld in (
        ("name", "name"),
        ("description", "beschreibung"),
        ("summary", "kurzfassung"),
        ("space", "raum"),
        ("access", "zugang"),
        ("interaction", "kontakt"),
        ("neighborhood_overview", "umgebung"),
        ("transit", "anreise"),
        ("notes", "hinweise"),
        ("house_rules", "hausregeln"),
    ):
        wert = rohe.get(airbnb_feld)
        if isinstance(wert, str) and wert.strip():
            ergebnis[unser_feld] = wert.strip()
    return ergebnis
