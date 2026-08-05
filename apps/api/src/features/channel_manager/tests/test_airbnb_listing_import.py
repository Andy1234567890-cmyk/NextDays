"""Airbnb-Listing übernehmen: Airbnbs Werte, nicht unsere Annahmen.

Die Erwartungswerte in diesen Tests sind KEINE Erfindung: sie stammen aus der
Live-Antwort von `channels/{id}/action/listing_details` für das Listing
„013 Rævlingevej · The Fox House" (Konto AirSmil, 05.08.2026, 38 Felder).
Kontrolltest im gleichen Namensraum: `action/erfundene_aktion_zzz` → 400
„action is not supported" — die 200 war also echt.
"""
from __future__ import annotations

import pytest

from src.features.channel_manager import airbnb_listing_import as ali

# Gemessene Live-Antwort, auf die geprüften Felder gekürzt.
BUCHUNG_LIVE = {
    "check_in_time_start": "16",
    "check_in_time_end": "FLEXIBLE",
    "check_out_time": 10,
    "instant_booking_allowed_category": "everyone",
    "instant_book_welcome_message": None,
    "listing_expectations_for_guests": [],
    "cancellation_policy_settings": {
        "cancellation_policy_category": "better_strict_with_grace_period",
        "lts_cancellation_policy_id": "CANCEL_LONG_TERM_FAIR",
        "non_refundable_price_factor": None,
    },
    "guest_controls": {
        "allows_children_as_host": True,
        "allows_infants_as_host": True,
        "allows_pets_as_host": False,
        "allows_smoking_as_host": False,
        "allows_events_as_host": False,
        "children_not_allowed_details": None,
        "pet_capacity": None,
    },
}

PREISE_LIVE = {
    "default_daily_price": 840,
    "listing_currency": "DKK",
    "guests_included": 1,
    "price_per_extra_person": 0,
    "monthly_price_factor": 0.0,
    "cleaning_fee": None,
    "security_deposit": None,
    "pass_through_taxes": [],
    "standard_fees": [
        {
            "amount": 25.0,
            "amount_type": "flat",
            "charge_period": "PER_NIGHT",
            "charge_type": "PER_GROUP",
            "fee_type": "PASS_THROUGH_RESORT_FEE",
            "offline": False,
        },
        {
            "amount": 955.0,
            "amount_type": "flat",
            "charge_period": "PER_BOOKING",
            "charge_type": "PER_GROUP",
            "fee_type": "PASS_THROUGH_CLEANING_FEE",
            "offline": False,
        },
    ],
}

LISTING_LIVE = {
    "bedrooms": 3,
    "beds": 3,
    "bathrooms": 1.0,
    "person_capacity": 6,
    "state": None,
    "total_inventory_count": None,
    "availability_rules": {
        "allow_rtb_above_max_nights": False,
        "booking_lead_time": 12,
        "default_max_nights": 1125,
        "default_min_nights": 3,
        "max_days_notice": 365,
        "seasonal_min_nights": None,
        "turnover_days": 0,
        "day_of_week_check_in": [True] * 7,
        "day_of_week_check_out": [True] * 7,
        "day_of_week_min_nights": [-1] * 7,
    },
    "quality_standards": {
        "score": {"is_guest_favorite": False, "quality_percentage": 7.0},
        "state": "EDUCATE",
    },
    "descriptions": {
        "locale": "en",
        "name": "The Fox House",
        "description": "Beautiful and bright holiday home in Tversted for 6 people.",
        "summary": "Beautiful and bright holiday home in Tversted for 6 people.",
    },
    "rooms": [
        {"room_type": "bedroom", "beds": [], "room_amenities": None},
        {"room_type": "bedroom", "beds": [], "room_amenities": None},
        {"room_type": "full_bathroom", "beds": [], "room_amenities": None},
        {"room_type": "kitchen", "beds": [], "room_amenities": None},
    ],
}


# --- Check-in/-out: die Asymmetrie ist echt --------------------------------


def test_zeiten_wie_gemessen():
    assert ali.check_in_start(BUCHUNG_LIVE) == "16:00"
    assert ali.check_in_ende(BUCHUNG_LIVE) == "FLEXIBLE"
    assert ali.check_out(BUCHUNG_LIVE) == "10:00"


def test_flexible_und_ungesetzt_bleiben_erhalten():
    """„FLEXIBLE"/„NOT_SELECTED" sind Aussagen, keine fehlenden Werte."""
    assert ali.check_in_start({"check_in_time_start": "NOT_SELECTED"}) == "NOT_SELECTED"
    assert ali.check_in_ende({"check_in_time_end": "flexible"}) == "FLEXIBLE"


def test_stunde_26_erlaubt_27_nur_am_ende():
    """Airbnb: start bis 26, end bis 27. Genau diese Grenze, kein Rundungsspiel.

    Vorher galt eine harte 0..23-Prüfung — ein Check-in um 1 Uhr nachts („25")
    wurde stillschweigend verworfen.
    """
    assert ali.check_in_start({"check_in_time_start": "26"}) == "26"
    assert ali.check_in_start({"check_in_time_start": "27"}) is None
    assert ali.check_in_ende({"check_in_time_end": "27"}) == "27"
    assert ali.check_in_ende({"check_in_time_end": "28"}) is None


def test_check_out_ist_eine_zahl_bis_23():
    assert ali.check_out({"check_out_time": 0}) == "00:00"
    assert ali.check_out({"check_out_time": 23}) == "23:00"
    assert ali.check_out({"check_out_time": 24}) is None


@pytest.mark.parametrize("wert", [None, "", "  ", "abc", [], {}])
def test_unsinn_wird_nicht_geraten(wert):
    assert ali.check_in_start({"check_in_time_start": wert}) is None


# --- Storno ----------------------------------------------------------------


def test_storno_wie_gemessen():
    """Der Airbnb-Originalwert bleibt erhalten — unser Modell ist gröber."""
    assert ali.storno_uebernehmen(BUCHUNG_LIVE) == {
        "airbnbKategorie": "better_strict_with_grace_period",
        "modus": "partial",
        "langzeitPolicy": "CANCEL_LONG_TERM_FAIR",
    }


def test_strikt_ist_nicht_erstattungsfrei():
    """„strict" heißt teilweise erstattbar. „non_refundable" wäre eine
    Falschaussage, die dem Gast ein Recht nimmt, das er bei Airbnb hat."""
    for kategorie in ("strict", "super_strict_60", "strict_14_with_grace_period"):
        ergebnis = ali.storno_uebernehmen(
            {"cancellation_policy_settings": {"cancellation_policy_category": kategorie}}
        )
        assert ergebnis is not None
        assert ergebnis["modus"] == "partial"


def test_alle_zwoelf_kategorien_bekannt():
    """Airbnb nennt 12 — jede muss abbildbar sein, sonst fällt sie durchs Raster."""
    assert len(ali.STORNO_KATEGORIEN) == 12
    for kategorie in ali.STORNO_KATEGORIEN:
        ergebnis = ali.storno_uebernehmen(
            {"cancellation_policy_settings": {"cancellation_policy_category": kategorie}}
        )
        assert ergebnis is not None and ergebnis["modus"] in ("refundable", "partial")


def test_unbekannte_kategorie_wird_verworfen():
    assert (
        ali.storno_uebernehmen(
            {"cancellation_policy_settings": {"cancellation_policy_category": "mega"}}
        )
        is None
    )


# --- Sofortbuchung ---------------------------------------------------------


def test_sofortbuchung_wie_gemessen():
    assert ali.sofortbuchung_uebernehmen(BUCHUNG_LIVE) == {
        "airbnbKategorie": "everyone",
        "modus": "instant",
    }


def test_off_wird_zur_anfrage():
    ergebnis = ali.sofortbuchung_uebernehmen(
        {"instant_booking_allowed_category": "off"}
    )
    assert ergebnis == {"airbnbKategorie": "off", "modus": "request"}


def test_alle_fuenf_sofortbuchungswerte():
    assert len(ali.SOFORTBUCHUNG_KATEGORIEN) == 5
    for wert in ali.SOFORTBUCHUNG_KATEGORIEN:
        ergebnis = ali.sofortbuchung_uebernehmen(
            {"instant_booking_allowed_category": wert}
        )
        assert ergebnis is not None


# --- Gastregeln ------------------------------------------------------------


def test_gastregeln_wie_gemessen():
    assert ali.gastregeln_uebernehmen(BUCHUNG_LIVE) == {
        "kinderErlaubt": True,
        "babysErlaubt": True,
        "haustiereErlaubt": False,
        "rauchenErlaubt": False,
        "feiernErlaubt": False,
    }


def test_null_ist_nicht_nein():
    """Wurzel 4: „nicht gesetzt" darf nicht zu „verboten" werden."""
    ergebnis = ali.gastregeln_uebernehmen(
        {"guest_controls": {"allows_pets_as_host": None, "pet_capacity": None}}
    )
    assert ergebnis == {}


def test_haustierzahl_und_kinderhinweis():
    ergebnis = ali.gastregeln_uebernehmen(
        {
            "guest_controls": {
                "allows_pets_as_host": True,
                "pet_capacity": 2,
                "children_not_allowed_details": "Treppe ohne Geländer.",
            }
        }
    )
    assert ergebnis["haustiereErlaubt"] is True
    assert ergebnis["haustiereMax"] == 2
    assert ergebnis["kinderHinweis"] == "Treppe ohne Geländer."


# --- Gebühren: die Geldstelle ---------------------------------------------


def test_gebuehren_wie_gemessen_ohne_umrechnung():
    """955.0 bleibt 955.0.

    Airbnbs Schema sagt für `flat` „in cents", die LIVE-Antwort liefert aber
    Haupteinheiten (955 DKK Reinigung). Eine Division durch 100 wäre ein
    Faktor-100-Fehler zu Lasten des Betriebs — hier schlägt die Messung das
    Schema.
    """
    ergebnis = ali.gebuehren_uebernehmen(PREISE_LIVE)
    nach_art = {g["art"]: g for g in ergebnis}
    assert nach_art["cleaning_fee"]["betrag"] == 955.0
    assert nach_art["cleaning_fee"]["zeitraum"] == "per_stay"
    assert nach_art["resort_fee"]["betrag"] == 25.0
    assert nach_art["resort_fee"]["zeitraum"] == "per_night"
    assert all(g["prozentual"] is False for g in ergebnis)


def test_alle_dreizehn_gebuehrenarten_bekannt():
    """Airbnb nennt 13 fee_type-Werte — jeder braucht ein Ziel."""
    assert len(ali.GEBUEHR_AUF_UNSERE_ART) == 13


def test_unbekannte_gebuehrenart_wird_uebersprungen():
    ergebnis = ali.gebuehren_uebernehmen(
        {"standard_fees": [{"fee_type": "PASS_THROUGH_MONDGEBUEHR", "amount": 10}]}
    )
    assert ergebnis == []


def test_nullbetrag_ist_keine_gebuehr():
    """Live gemessen: Airbnb führt nicht erhobene Gebühren mit 0 — die sind keine."""
    ergebnis = ali.gebuehren_uebernehmen(
        {"standard_fees": [{"fee_type": "PASS_THROUGH_PET_FEE", "amount": 0.0}]}
    )
    assert ergebnis == []


def test_prozentuale_gebuehr_wird_markiert():
    ergebnis = ali.gebuehren_uebernehmen(
        {
            "standard_fees": [
                {
                    "fee_type": "PASS_THROUGH_MANAGEMENT_FEE",
                    "amount": 12,
                    "amount_type": "percent",
                }
            ]
        }
    )
    assert ergebnis[0]["prozentual"] is True


def test_zusatzgast_nur_echte_werte():
    """`price_per_extra_person: 0` ist kein Aufpreis."""
    assert ali.zusatzgast_uebernehmen(PREISE_LIVE) == {"abGast": 1}
    assert ali.zusatzgast_uebernehmen(
        {"guests_included": 2, "price_per_extra_person": 150}
    ) == {"abGast": 2, "betrag": 150.0}


# --- Kapazität, Räume ------------------------------------------------------


def test_kapazitaet_wie_gemessen():
    assert ali.kapazitaet_uebernehmen(LISTING_LIVE) == {
        "schlafzimmer": 3,
        "betten": 3,
        "maxGaeste": 6,
        "badezimmer": 1.0,
    }


def test_halbes_bad_bleibt_float():
    """1.5 Bäder sind bei Airbnb üblich — int() würde ein halbes Bad schlucken."""
    assert ali.kapazitaet_uebernehmen({"bathrooms": 1.5})["badezimmer"] == 1.5


def test_raeume_ohne_erfundene_betten():
    """Live gemessen: die Bettenlisten sind LEER. Dann gibt es keine Betten."""
    raeume = ali.raeume_uebernehmen(LISTING_LIVE)
    assert [r["art"] for r in raeume] == [
        "bedroom", "bedroom", "full_bathroom", "kitchen",
    ]
    assert all("betten" not in r for r in raeume)


def test_betten_werden_uebernommen_wenn_da():
    raeume = ali.raeume_uebernehmen(
        {
            "rooms": [
                {
                    "room_type": "bedroom",
                    "room_number": 1,
                    "beds": [
                        {"type": "double_bed", "quantity": 1},
                        {"type": "couch", "quantity": 2},
                    ],
                }
            ]
        }
    )
    assert raeume[0]["nummer"] == 1
    assert raeume[0]["betten"] == [
        {"art": "double_bed", "anzahl": 1},
        {"art": "couch", "anzahl": 2},
    ]


# --- Verfügbarkeitsregeln --------------------------------------------------


def test_verfuegbarkeit_wie_gemessen():
    assert ali.verfuegbarkeit_uebernehmen(LISTING_LIVE) == {
        "minNaechte": 3,
        "maxNaechte": 1125,
        "vorlaufStunden": 12,
        "vorausbuchungTage": 365,
        "wechseltage": 0,
        "anfrageUeberMaxNaechte": False,
    }


def test_unerlaubte_werte_werden_nicht_uebernommen():
    """Airbnb erlaubt nur bestimmte Zahlen — ein 37-Stunden-Vorlauf existiert nicht."""
    ergebnis = ali.verfuegbarkeit_uebernehmen(
        {
            "availability_rules": {
                "booking_lead_time": 37,
                "max_days_notice": 45,
                "turnover_days": 5,
                "default_min_nights": 2000,
            }
        }
    )
    assert ergebnis == {}


def test_saisonale_mindestaufenthalte():
    ergebnis = ali.verfuegbarkeit_uebernehmen(
        {
            "availability_rules": {
                "seasonal_min_nights": [
                    {"start_date": "2026-07-01", "end_date": "2026-08-31",
                     "min_nights": 7},
                    {"start_date": "kaputt", "end_date": "", "min_nights": 0},
                ]
            }
        }
    )
    assert ergebnis["saisonMinNaechte"] == [
        {"von": "2026-07-01", "bis": "2026-08-31", "minNaechte": 7}
    ]


# --- Qualität --------------------------------------------------------------


def test_qualitaet_wie_gemessen():
    """„EDUCATE" bei 7 % — eine Warnung von Airbnb, die der Betrieb sehen muss."""
    assert ali.qualitaet_uebernehmen(LISTING_LIVE) == {
        "zustand": "EDUCATE",
        "prozent": 7.0,
        "gaesteliebling": False,
    }


def test_alle_acht_qualitaetszustaende():
    assert len(ali.QUALITAETS_ZUSTAENDE) == 8
    for zustand in ali.QUALITAETS_ZUSTAENDE:
        ergebnis = ali.qualitaet_uebernehmen({"quality_standards": {"state": zustand}})
        assert ergebnis["zustand"] == zustand


# --- Texte: die Sprachfalle ----------------------------------------------


def test_texte_mit_gemessener_sprache():
    """Live ist die Sprache `en` — nicht `de`.

    Genau diese Annahme hat schon die Bildtexte unter der falschen Sprache
    abgelegt: die Oberfläche liest `de`, fand nichts und zeigte Platzhalter.
    """
    ergebnis = ali.texte_uebernehmen(LISTING_LIVE)
    assert ergebnis["sprache"] == "en"
    assert ergebnis["name"] == "The Fox House"
    assert "beschreibung" in ergebnis and "kurzfassung" in ergebnis


def test_ohne_sprache_keine_texte():
    """Ohne `locale` wird die Sprache NICHT geraten (Wurzel 4)."""
    assert ali.texte_uebernehmen({"descriptions": {"description": "Text"}}) == {}


def test_alle_beschreibungsfelder_werden_gelesen():
    """Airbnb kann bis zu zehn Textfelder liefern — nicht nur `description`."""
    ergebnis = ali.texte_uebernehmen(
        {
            "descriptions": {
                "locale": "da",
                "machine_translated": True,
                "name": "N", "description": "B", "summary": "K", "space": "R",
                "access": "Z", "interaction": "Ko", "neighborhood_overview": "U",
                "transit": "A", "notes": "H", "house_rules": "HR",
            }
        }
    )
    assert ergebnis["sprache"] == "da"
    assert ergebnis["maschinellUebersetzt"] is True
    for feld in ("name", "beschreibung", "kurzfassung", "raum", "zugang",
                 "kontakt", "umgebung", "anreise", "hinweise", "hausregeln"):
        assert feld in ergebnis


# --- Nachträge: was Lodgify zeigt und wir zuerst verworfen hatten -----------
# Alle Werte hier sind die Live-Antwort für Objekt 020 („Lille Lægehus"),
# gemessen am 05.08.2026. Der Anlass: die Objekt-Maske zeigte „Noch keine
# Zimmer" und „Noch keine Schlafgelegenheiten", während Lodgify daneben
# „Schlafzimmer (privat) … Doppelbett, Schlafsofa" auswies.

LISTING_020 = {
    "bedrooms": 1,
    "beds": 2,
    "bathrooms": 1.0,
    "person_capacity": 3,
    "total_inventory_count": 1,
    "apt": "lejlighed t.v.",
    "wifi_network": "NOKIA-BC71",
    "wifi_password": "geheim",
    "directions": "",
    # Neu gemessen 05.08.2026: Airbnb liefert die Fläche, sobald der Gastgeber
    # sie pflegt. Vorher stand hier `{}` — die alte Messung war der Zustand
    # „nicht gepflegt", nicht „Airbnb kann es nicht".
    "property_details": {
        "listing_size": {"size": 33, "size_unit": "SQUARE_METERS"},
        "year_built": 1928,
        "number_of_floors": 1,
        "listing_floor": 1,
    },
    "check_in_option": {
        "category": "lockbox",
        "instruction": "Der Check-in erfolgt über eine Schlüsselbox.",
    },
    "rooms": [
        {"id": "661696087", "room_type": "bedroom", "is_private": True, "beds": []},
        {"id": "661696088", "room_type": "full_bathroom", "is_private": True,
         "beds": []},
        {"id": "665667247", "room_type": "living_room", "is_private": True,
         "beds": []},
    ],
    "amenities": {
        "COFFEE_MAKER": {"instruction": "", "is_present": True},
        "HAIR_DRYER": {
            "instruction": "Im Bad.",
            "is_present": True,
            "room_attachment_infos": [
                {"is_attached": True, "room_id": "661696088"}
            ],
        },
        "POOL": {"instruction": "", "is_present": False},
    },
}


def test_einheiten_aus_total_inventory_count():
    """Lodgifys „1 Einheit" — die Stückzahl des Typs, unser `property_units`."""
    assert ali.kapazitaet_uebernehmen(LISTING_020)["einheiten"] == 1


def test_wohnflaeche_nicht_in_der_kapazitaet():
    """Die Fläche steht in `property_details`, nicht bei den Zählwerten.

    Getrennt, damit klar bleibt, welcher Teil der Antwort sie trägt — sie kommt
    über `gebaeudedaten_uebernehmen` und geht in ECHTE Spalten.
    """
    ergebnis = ali.kapazitaet_uebernehmen(LISTING_020)
    assert not any("flaeche" in k.lower() or "size" in k.lower() for k in ergebnis)


def test_wohnflaeche_wird_uebernommen():
    """Live gemessen: `{"size": 33, "size_unit": "SQUARE_METERS"}`.

    Vorher stand im Code, Airbnb habe kein Größenfeld — belegt mit einer Messung,
    bei der `listing_size` leer war. Das war der Zustand „Gastgeber hat es nicht
    gepflegt". Sobald er es pflegt (33 m², Baujahr 1928), liefert Airbnb alles,
    und unser Pflichtfeld „Größe (m²)" blieb trotzdem leer.
    """
    g = ali.gebaeudedaten_uebernehmen(LISTING_020)
    assert g["flaeche"] == 33.0
    assert g["flaecheEinheit"] == "sqm"
    assert g["baujahr"] == 1928
    assert g["etagenImGebaeude"] == 1
    assert g["etage"] == 1


def test_quadratfuss_wird_als_sqft_uebernommen():
    """Airbnb kennt beide Einheiten; 0197 speichert 'sqm' | 'sqft'."""
    g = ali.gebaeudedaten_uebernehmen(
        {"property_details": {"listing_size": {"size": 850, "size_unit": "SQUARE_FEET"}}}
    )
    assert g["flaeche"] == 850.0
    assert g["flaecheEinheit"] == "sqft"


def test_unbekannte_einheit_ergibt_keine_flaeche():
    """Wurzel 4: „33" in einer unbekannten Einheit ist keine Fläche.

    Würde man auf m² raten, wäre der Wert bei Quadratfuß um Faktor 10 falsch —
    und die Zahl sähe genauso plausibel aus wie eine richtige.
    """
    g = ali.gebaeudedaten_uebernehmen(
        {"property_details": {"listing_size": {"size": 33, "size_unit": "TATAMI"}}}
    )
    assert "flaeche" not in g
    assert "flaecheEinheit" not in g


def test_leere_groesse_bleibt_leer():
    """Der ALTE gemessene Zustand — ein ungepflegtes Feld erfindet nichts."""
    g = ali.gebaeudedaten_uebernehmen({"property_details": {"listing_size": {}}})
    assert "flaeche" not in g


def test_fehlende_gebaeudedaten():
    assert ali.gebaeudedaten_uebernehmen({}) == {}
    assert ali.gebaeudedaten_uebernehmen({"property_details": None}) == {}


def test_null_werte_werden_nicht_uebernommen():
    """Airbnb schickt `null`, wenn der Gastgeber ein Feld nicht gesetzt hat."""
    g = ali.gebaeudedaten_uebernehmen(
        {"property_details": {"year_built": None, "number_of_floors": 0}}
    )
    assert "baujahr" not in g
    assert "etagenImGebaeude" not in g


def test_zimmer_mit_privat_und_raum_id():
    """`is_private` ist Lodgifys „(privat)"; die Raum-ID verknüpft Foto+Ausstattung."""
    raeume = ali.raeume_uebernehmen(LISTING_020)
    assert raeume[0] == {
        "art": "bedroom", "privat": True, "airbnbRaumId": "661696087",
    }
    assert [r["art"] for r in raeume] == ["bedroom", "full_bathroom", "living_room"]


def test_privat_unbekannt_wird_nicht_zu_gemeinschaftlich():
    """`None` heißt „Airbnb sagt nichts dazu" — nicht „gemeinschaftlich"."""
    raeume = ali.raeume_uebernehmen(
        {"rooms": [{"room_type": "bedroom", "is_private": None}]}
    )
    assert "privat" not in raeume[0]


def test_zugangsdaten_wie_gemessen():
    """WLAN und Schlüsselbox-Hinweis standen bisher im Negativ-Katalog."""
    ergebnis = ali.zugangsdaten_uebernehmen(LISTING_020)
    assert ergebnis["wlanName"] == "NOKIA-BC71"
    assert ergebnis["wlanPasswort"] == "geheim"
    assert ergebnis["wohnungszusatz"] == "lejlighed t.v."
    assert ergebnis["checkInArt"] == "lockbox"
    assert "Schlüsselbox" in ergebnis["checkInHinweis"]
    # Leerer `directions`-String ist kein Wert.
    assert "anfahrt" not in ergebnis


def test_ausstattung_mit_hinweis_und_raum():
    """`instruction` und der Raumbezug gingen bisher verloren."""
    aus = {a["airbnbName"]: a for a in ali.ausstattung_uebernehmen(LISTING_020)}
    assert aus["HAIR_DRYER"]["hinweis"] == "Im Bad."
    assert aus["HAIR_DRYER"]["raeume"] == ["661696088"]
    assert aus["COFFEE_MAKER"] == {"airbnbName": "COFFEE_MAKER"}


def test_nicht_vorhandene_ausstattung_wird_ausgelassen():
    """`is_present: false` heißt „gibt es hier nicht" — keine Ausstattung."""
    namen = {a["airbnbName"] for a in ali.ausstattung_uebernehmen(LISTING_020)}
    assert "POOL" not in namen


# --- Texte in ALLEN Sprachen, die Airbnb pflegt -----------------------------
# Live gemessen (Objekt 020, `api_proxy` → `listing_descriptions`): DREI
# Sprachversionen, und `house_rules` nur in der deutschen. Kontrolltest:
# ein erfundener Proxy-Endpunkt → 422 `route_not_found`.

DESCRIPTIONS_LIVE = {
    "data": {
        "listing_descriptions": [
            {
                "locale": "de",
                "listing_id": "1378994948547697321",
                "name": "FeWo Lille Lægehus",
                "summary": "Wunderschönes kleines Appartment.",
                "description": "Wunderschönes kleines Appartment.",
                "house_rules": "MIETVEREINBARUNG & GRUNDREGELN",
            },
            {
                "locale": "en",
                "name": "FeWo Lille Lægehus",
                "summary": "A beautiful, small apartment.",
                "description": "A beautiful, small apartment.",
            },
            {
                "locale": "da",
                "name": "FeWo Lille Lægehus",
                "summary": "Skøn lille lejlighed.",
                "description": "Skøn lille lejlighed.",
            },
        ]
    }
}


def test_texte_in_drei_sprachen():
    """Alle gepflegten Sprachen, je Feld — nicht nur eine."""
    ergebnis = ali.texte_mehrsprachig(DESCRIPTIONS_LIVE)
    assert sorted(ergebnis["kurzfassung"]) == ["da", "de", "en"]
    assert ergebnis["kurzfassung"]["da"] == "Skøn lille lejlighed."
    assert ergebnis["name"]["en"] == "FeWo Lille Lægehus"


def test_hausregeln_nur_wo_vorhanden():
    """Airbnb pflegt die Hausregeln hier nur auf Deutsch — kein erfundenes `en`."""
    ergebnis = ali.texte_mehrsprachig(DESCRIPTIONS_LIVE)
    assert list(ergebnis["hausregeln"]) == ["de"]


def test_zeile_ohne_sprache_wird_uebersprungen():
    """Die Sprache wird NIE geraten.

    Das ist derselbe Fehler, der die Bildtexte betraf: sie lagen unter `en`,
    die deutsche Oberfläche las `de` und zeigte Platzhalter.
    """
    ergebnis = ali.texte_mehrsprachig(
        {"data": {"listing_descriptions": [{"summary": "Ohne Sprache"}]}}
    )
    assert ergebnis == {}


def test_leere_antwort_ergibt_nichts():
    assert ali.texte_mehrsprachig({}) == {}
    assert ali.texte_mehrsprachig({"data": {}}) == {}
    assert ali.texte_mehrsprachig({"data": {"listing_descriptions": "kaputt"}}) == {}


# --- Zimmer und Betten im Format der Objekt-Maske ---------------------------


def test_zimmer_zaehlwerk_im_maskenformat():
    """`{"privat": {slug: n}, "gemeinschaftlich": {}}` — genau was die Maske liest."""
    zimmer = ali.zimmer_zaehlwerk(LISTING_020)
    assert zimmer == {
        "privat": {"schlafzimmer": 1, "badezimmer": 1, "wohnzimmer": 1},
        "gemeinschaftlich": {},
    }


def test_gleiche_zimmerart_wird_gezaehlt():
    """Drei Schlafzimmer sind „schlafzimmer: 3", nicht dreimal derselbe Eintrag."""
    zimmer = ali.zimmer_zaehlwerk(
        {"rooms": [{"room_type": "bedroom", "is_private": True}] * 3}
    )
    assert zimmer["privat"] == {"schlafzimmer": 3}


def test_gemeinschaftliche_zimmer_getrennt():
    """In einer Anlage ist ein Gemeinschaftsbad etwas anderes als ein eigenes."""
    zimmer = ali.zimmer_zaehlwerk(
        {
            "rooms": [
                {"room_type": "bedroom", "is_private": True},
                {"room_type": "full_bathroom", "is_private": False},
            ]
        }
    )
    assert zimmer == {
        "privat": {"schlafzimmer": 1},
        "gemeinschaftlich": {"badezimmer": 1},
    }


def test_unbekannte_zimmerart_wird_nicht_geraten():
    """Airbnbs `common_spaces` und `exterior` haben keinen Slug — kein Ratespiel."""
    zimmer = ali.zimmer_zaehlwerk(
        {
            "rooms": [
                {"room_type": "common_spaces"},
                {"room_type": "exterior"},
                {"room_type": "voelliger_unsinn"},
            ]
        }
    )
    assert zimmer == {"privat": {}, "gemeinschaftlich": {}}


def test_betten_leer_wenn_airbnb_keine_pflegt():
    """Der gemessene Fall: `beds: []` bei jedem Raum.

    `bedrooms: 1` und `beds: 2` sagen NICHT, welche Art von Bett das ist. Aus
    „2" ein „Doppelbett" zu machen wäre eine Falschaussage über das Objekt
    (Wurzel 4) — die Maske bleibt lieber leer.
    """
    assert ali.betten_zaehlwerk(LISTING_020) == {}


def test_betten_werden_gelesen_wenn_da():
    """Sobald Airbnb Betten pflegt, landen sie mit Anzahl in der Maske."""
    zaehlwerk = ali.betten_zaehlwerk(
        {
            "rooms": [
                {
                    "room_type": "bedroom",
                    "beds": [
                        {"type": "double_bed", "quantity": 1},
                        {"type": "single_bed", "quantity": 2},
                    ],
                },
                {"room_type": "living_room", "beds": [{"type": "couch", "quantity": 1}]},
            ]
        }
    )
    assert zaehlwerk == {"doppelbett": 1, "einzelbett": 2, "schlafsofa": 1}


def test_unbekannte_bettart_wird_uebersprungen():
    assert ali.betten_zaehlwerk(
        {"rooms": [{"beds": [{"type": "himmelbett_xxl", "quantity": 1}]}]}
    ) == {}


def test_bettanzahl_null_ist_kein_bett():
    assert ali.betten_zaehlwerk(
        {"rooms": [{"beds": [{"type": "double_bed", "quantity": 0}]}]}
    ) == {}


def test_interner_name_wird_uebernommen():
    """`listing_nickname` ist der interne Titel — live „020 Lille Lægehus (1966)".

    Er liegt auf Listing-Ebene, NICHT in `listing_descriptions`. Genau deshalb
    hat ihn der mehrsprachige Textimport nicht mitgenommen.
    """
    assert ali.interner_name(
        {"listing_nickname": "020 Lille Lægehus (1966)"}
    ) == "020 Lille Lægehus (1966)"


def test_interner_name_fehlt_oder_leer():
    """Kein Rateversuch, kein Ersatz aus dem Gast-Titel (Wurzel 4)."""
    assert ali.interner_name({}) is None
    assert ali.interner_name({"listing_nickname": "   "}) is None
    assert ali.interner_name({"listing_nickname": None}) is None
    assert ali.interner_name({"listing_nickname": 42}) is None


def test_interner_name_getrennt_vom_gast_titel():
    """Beide Titel gleichzeitig: der eine mehrsprachig, der andere nicht.

    Der Gast-Titel („FeWo Lille Lægehus") steht in drei Sprachen; der interne
    Name ist EIN Wert. Sie dürfen sich nicht vermischen.
    """
    listing = {"listing_nickname": "020 Lille Lægehus (1966)"}
    antwort = {
        "data": {
            "listing_descriptions": [
                {"locale": "de", "name": "FeWo Lille Lægehus"},
                {"locale": "da", "name": "FeWo Lille Lægehus"},
                {"locale": "en", "name": "FeWo Lille Lægehus"},
            ]
        }
    }
    texte = ali.texte_mehrsprachig(antwort)
    assert texte["name"] == {
        "de": "FeWo Lille Lægehus",
        "da": "FeWo Lille Lægehus",
        "en": "FeWo Lille Lægehus",
    }
    assert ali.interner_name(listing) == "020 Lille Lægehus (1966)"
    assert "internal_name" not in texte


def test_titel_trennen_live_gemessene_faelle():
    """Die echten Anzeigenamen des Kontos (05.08.2026, alle 18 Listings).

    Airbnbs `title` in der Listen-Antwort ist „interner Name · Gast-Titel".
    Unverändert übernommen stand die interne Bezeichnung im Gast-Titel — bei
    „012 Oddenvej 3 (kode 1753)" also ein TÜRCODE in dem Feld, das der Gast
    im Marktplatz sieht.
    """
    assert ali.titel_trennen("020 Lille Lægehus (1966) · FeWo Lille Lægehus") == (
        "FeWo Lille Lægehus", "020 Lille Lægehus (1966)"
    )
    assert ali.titel_trennen("013 Rævlingevej · The Fox House") == (
        "The Fox House", "013 Rævlingevej"
    )
    assert ali.titel_trennen("010 Lærkevej  · The Lark House-Bindslev") == (
        "The Lark House-Bindslev", "010 Lærkevej"
    )


def test_titel_ohne_trenner_bleibt_ganz():
    """Kein Trenner = kein interner Name. Nichts erfinden (Wurzel 4)."""
    assert ali.titel_trennen("Ferienhaus Nordsee") == ("Ferienhaus Nordsee", None)


def test_titel_nur_am_ersten_trenner():
    """Ein Mittelpunkt IM Gast-Titel darf ihn nicht weiter zerschneiden."""
    assert ali.titel_trennen("020 Haus · Ferienhaus · am Meer") == (
        "Ferienhaus · am Meer", "020 Haus"
    )


def test_titel_leere_seite_bleibt_ganz():
    """Ein Trenner ohne Text daneben trennt nichts — kein leerer Titel."""
    assert ali.titel_trennen("· Nur Gast-Titel") == ("· Nur Gast-Titel", None)
    assert ali.titel_trennen("Nur intern ·") == ("Nur intern ·", None)
    assert ali.titel_trennen("  ·  ") == ("·", None)


def test_klartext_wird_zu_absaetzen():
    """Airbnb liefert KLARTEXT mit `\\n` — das Zielfeld rendert HTML.

    Gemessen am Mietvertrag von Objekt 020: 10.487 Zeichen, 37 Zeilenumbrüche,
    null Tags. Ohne Umwandlung stand alles als eine Textwand in der Oberfläche.
    """
    html = ali.klartext_zu_absaetzen("Erste Regel\nZweite Regel")
    assert html == "<p>Erste Regel</p><p>Zweite Regel</p>"


def test_leerzeilen_erzeugen_keine_leeren_absaetze():
    """Sonst entstünden im Editor Lücken, die im Original keine sind."""
    html = ali.klartext_zu_absaetzen("Eins\n\n\nZwei\n")
    assert html == "<p>Eins</p><p>Zwei</p>"


def test_windows_umbrueche():
    assert ali.klartext_zu_absaetzen("A\r\nB") == "<p>A</p><p>B</p>"


def test_leerer_text_bleibt_leer():
    """Kein `<p></p>`: ein leeres Feld muss leer BLEIBEN, sonst sieht die
    Oberfläche einen gefüllten Mietvertrag, wo keiner ist (Wurzel 4)."""
    assert ali.klartext_zu_absaetzen("") == ""
    assert ali.klartext_zu_absaetzen("   \n  \n ") == ""


def test_portal_text_wird_escapt_nicht_verschluckt():
    """Wurzel 8: Fremd-Eingabe darf kein Markup werden — aber auch nicht
    stillschweigend verschwinden.

    Erst escapen, dann `<p>` bauen: so bleibt der Text LESBAR und ist harmlos.
    Hätte man erst `<p>` gebaut und dann sanitisiert, wäre das `<script>` samt
    Inhalt spurlos entfernt worden — ein verstümmelter Mietvertrag.
    """
    html = ali.klartext_zu_absaetzen("Regel <script>alert(1)</script> Ende")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "alert(1)" in html


def test_kaufmaennisches_und_bleibt_erhalten():
    """„Strom & Wasser" steht wörtlich im echten Mietvertrag."""
    html = ali.klartext_zu_absaetzen("Strom & Wasser")
    assert "&amp;" in html
    assert "Strom" in html and "Wasser" in html
