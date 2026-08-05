"""Airbnbs `standard_fees` → unsere Gebühren.

Die Beispieldaten sind live gemessen (05.08.2026, Konto AirSmil, 18 Listings mit
43 Gebühren, alle DKK) — nicht erfunden:

    PASS_THROUGH_CLEANING_FEE   795.0   flat  PER_BOOKING  PER_GROUP
    PASS_THROUGH_RESORT_FEE      25.0   flat  PER_NIGHT    PER_GROUP
    PASS_THROUGH_PET_FEE        150.0   flat  PER_BOOKING  PER_GROUP
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_gebuehren_import import (
    AIRBNB_FEE_AUF_ART,
    KATEGORIE_AUF_AIRBNB,
    airbnb_fee_signatur,
    fee_aus_airbnb,
    fees_aus_airbnb,
)
from src.features.properties.gebuehren import (
    FEE_BASES,
    FEE_CATEGORIES,
    FEE_TYPES,
    fee_category,
)

# Genau die Antwort von Listing 1675950565421151420 (Holiday house Cornflower).
LIVE = [
    {"amount": 25.0, "amount_type": "flat", "charge_period": "PER_NIGHT",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_RESORT_FEE",
     "offline": False},
    {"amount": 795.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_CLEANING_FEE",
     "offline": False},
    {"amount": 150.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
     "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_PET_FEE",
     "offline": False},
]


def test_live_antwort_wird_vollstaendig_uebersetzt() -> None:
    """Die drei echten Gebühren, mit richtiger Basis je Zeile."""
    fees = fees_aus_airbnb(LIVE)
    assert len(fees) == 3
    nach_art = {f["feeType"]: f for f in fees}
    assert nach_art["resort"]["basis"] == "per_night"
    assert nach_art["resort"]["amount"] == 25.0
    assert nach_art["cleaning_fee"]["basis"] == "per_stay"
    assert nach_art["cleaning_fee"]["amount"] == 795.0
    assert nach_art["pet_fee"]["amount"] == 150.0


def test_betrag_wird_nicht_durch_hundert_geteilt() -> None:
    """Airbnbs Spec sagt „cents", geliefert wird die HAUPTEINHEIT.

    Live: eine Reinigungsgebühr von 1150.0 steht im Extranet als „1.150 kr DKK"
    (Listing 1654285285861524234). Durch 100 geteilt wären es 11,50 kr — der
    Betrieb würde 99 % seiner Reinigungskosten verlieren.
    """
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": 1150.0,
         "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP"}
    )
    assert fee is not None
    assert fee["amount"] == 1150.0


def test_nullbetrag_wird_verworfen() -> None:
    """Airbnb führt „nicht erhoben" als 0 — das ist keine Gebühr.

    Live gemessen: `PASS_THROUGH_RESORT_FEE 0.0` und `PASS_THROUGH_PET_FEE 0.0`
    an mehreren Listings. Als Gebühr angelegt stünde in jeder Rechnung eine
    0-Zeile.
    """
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_PET_FEE", "amount": 0.0,
         "amount_type": "flat"}
    ) is None


def test_offline_gebuehr_geht_nicht_in_den_preis() -> None:
    """`offline: true` heißt: nicht über die Buchung eingezogen."""
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": 500.0,
         "amount_type": "flat", "offline": True}
    ) is None


def test_unbekannte_art_wird_nicht_geraten() -> None:
    """Wurzel 4: lieber keine Gebühr als eine erfundene Art."""
    assert fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_ETWAS_NEUES", "amount": 50.0,
         "amount_type": "flat"}
    ) is None


def test_prozent_landet_in_amount_nicht_in_percent() -> None:
    """Es gibt KEIN Feld `percent` — `amount` trägt beides.

    `normalize_fees` liest bei `mode: percent` ebenfalls `amount`
    (`_clean_percent(eintrag.get("amount"))`). Ein eigenes `percent`-Feld würde
    beim Speichern verworfen und der Satz stünde auf 0.
    """
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_RESORT_FEE", "amount": 5,
         "amount_type": "percent", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP"}
    )
    assert fee is not None
    assert fee["mode"] == "percent"
    assert fee["amount"] == 5
    assert "percent" not in fee


def test_pet_kombination_ergibt_tier_basis() -> None:
    """PER_PET gibt es bei Airbnb nur an der Haustiergebühr — bei uns auch."""
    fee = fee_aus_airbnb(
        {"fee_type": "PASS_THROUGH_PET_FEE", "amount": 150.0,
         "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_PET"}
    )
    assert fee is not None
    assert fee["basis"] == "per_pet_stay"


def test_alle_zielarten_sind_gueltige_gebuehrenarten() -> None:
    """Sonst wirft `normalize_fees` beim Speichern 422 — und der Import wäre tot.

    Genau daran wäre ein direkter Durchreichversuch gescheitert: Airbnbs
    `..._SHORT_TERM_CLEANING_FEE` heißt bei uns `short_term_cleaning`, nicht
    `short_term_cleaning_fee`.
    """
    for art in AIRBNB_FEE_AUF_ART.values():
        assert art in FEE_TYPES, art


def test_jede_zielart_traegt_eine_exportierbare_kategorie() -> None:
    """Jede importierte Art muss beim Export wieder an Airbnb gehen können.

    Sonst importierte man eine Gebühr, die danach an kein Portal mehr geht.
    """
    for unsere in AIRBNB_FEE_AUF_ART.values():
        kategorie = fee_category({"feeType": unsere})
        assert kategorie in FEE_CATEGORIES, (unsere, kategorie)
        assert kategorie in KATEGORIE_AUF_AIRBNB, (unsere, kategorie)


def test_der_kreis_ist_nicht_verlustfrei_und_das_ist_gewollt() -> None:
    """Fünf Airbnb-Arten kommen als `COMMUNITY_FEE` zurück, nicht als sie selbst.

    Airbnb trennt Strom, Wasser, Heizung, Klima und Nebenkosten; unsere
    Kategorie-Ebene fasst sie zu `community` zusammen
    (`gebuehren.FEE_TYPE_CATEGORY`). Beim Export landen sie deshalb alle unter
    `PASS_THROUGH_COMMUNITY_FEE`.

    Das ist eine bewusste Vergröberung und kein Fehler: die feine Art bleibt in
    `feeType` erhalten (Rechnung, Gastanzeige), nur das Portal sieht die
    Sammelkategorie. Der Test hält fest, WELCHE Arten das betrifft — wird die
    Kategorie-Tabelle geändert, muss man hier bewusst hinsehen.
    """
    vergroebert = {
        airbnb_art
        for airbnb_art, unsere in AIRBNB_FEE_AUF_ART.items()
        if KATEGORIE_AUF_AIRBNB[fee_category({"feeType": unsere})] != airbnb_art
    }
    assert vergroebert == {
        "PASS_THROUGH_ELECTRICITY_FEE",
        "PASS_THROUGH_WATER_FEE",
        "PASS_THROUGH_HEATING_FEE",
        "PASS_THROUGH_AIR_CONDITIONING_FEE",
        "PASS_THROUGH_UTILITY_FEE",
    }


def test_alle_basen_sind_gueltig() -> None:
    """Eine Basis außerhalb von `FEE_BASES` wäre ein 422 beim Speichern."""
    for roh in LIVE:
        fee = fee_aus_airbnb(roh)
        assert fee is not None
        assert fee["basis"] in FEE_BASES


def test_signatur_ignoriert_den_namen() -> None:
    """Derselbe Betrag unter anderem Namen ist dieselbe Gebühr.

    Airbnb liefert überhaupt keinen Namen — würde er zählen, meldete der
    Vergleich jede Gebühr als „fehlt", und jede Übernahme legte Doubletten an.
    """
    a = {"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
         "amount": 795.0, "name": "Reinigungsgebühr"}
    b = {**a, "name": "Endreinigung"}
    assert airbnb_fee_signatur(a) == airbnb_fee_signatur(b)


def test_signatur_trennt_verschiedene_betraege() -> None:
    """795 und 1150 sind zwei verschiedene Gebühren — sonst bliebe eine unsichtbar."""
    a = {"feeType": "cleaning_fee", "mode": "amount", "basis": "per_stay",
         "amount": 795.0}
    b = {**a, "amount": 1150.0}
    assert airbnb_fee_signatur(a) != airbnb_fee_signatur(b)
