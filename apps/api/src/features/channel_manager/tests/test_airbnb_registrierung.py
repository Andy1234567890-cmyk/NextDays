"""Registrierungsnummer (DK: BFE) aus `v2/listing_permits`.

Live gemessen (05.08.2026, Beta-Betrieb DK): 17 von 18 Listings tragen eine
Nummer, und zwar in einem Endpunkt, den der Import nie abgefragt hat. Der
Betrieb meldete „BFE-Nummer nicht mitgekommen beim neuen Synch" — sie lag die
ganze Zeit bei Airbnb.
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_registrierung import nummern_aus_permits

# Genau die Antwort von „Feriehus Kornblomst": ZWEI Regulierungsbehörden mit
# DERSELBEN Nummer.
LIVE_DOPPELT = {
    "listing_permits": [
        {
            "listing_id": "1675950565421151420",
            "regulatory_body": "denmark",
            "regulation_type": "residency_categorization",
            "status": "success",
            "finalized_answers": {"data_reporting_bbr": {"text_value": "3156623"}},
        },
        {
            "listing_id": "1675950565421151420",
            "regulatory_body": "european_union_lrn",
            "regulation_type": "tax_reporting",
            "status": "success",
            "finalized_answers": {"license_number": {"text_value": "3156623"}},
        },
    ]
}

# „Sommerhus Dora": nicht registriert (status `initial`) plus eine gültige
# EU-Nummer.
LIVE_TEILWEISE = {
    "listing_permits": [
        {
            "regulatory_body": "denmark",
            "status": "initial",
            "answers": {
                "attestation": {"attestation_value": False},
                "data_reporting_bbr": {"text_value": ""},
            },
        },
        {
            "regulatory_body": "european_union_lrn",
            "status": "success",
            "finalized_answers": {"license_number": {"text_value": "10099748"}},
        },
    ]
}


def test_dieselbe_nummer_kommt_nur_einmal() -> None:
    """DK meldet dieselbe BFE-Nummer über zwei Behörden — das ist eine Nummer.

    Ohne Dedupe stünde im Feld „3156623, 3156623".
    """
    assert nummern_aus_permits(LIVE_DOPPELT) == ["3156623"]


def test_nicht_registriertes_permit_liefert_nichts() -> None:
    """`status: initial` heißt „unregistered" — die Felder sind leer.

    Eine Nummer daraus zu lesen wäre erfunden (Wurzel 4).
    """
    assert nummern_aus_permits(LIVE_TEILWEISE) == ["10099748"]


def test_leere_antwort_ist_kein_befund() -> None:
    """Kein Permit → keine Nummer, kein Absturz."""
    assert nummern_aus_permits(None) == []
    assert nummern_aus_permits({}) == []
    assert nummern_aus_permits({"listing_permits": []}) == []


def test_kaputte_form_wird_uebersprungen() -> None:
    """Fremddaten dürfen nicht zum 500 führen (Wurzel 5)."""
    assert nummern_aus_permits(
        {"listing_permits": ["quatsch", None, {"status": "success"},
                             {"status": "success", "answers": "text"}]}
    ) == []


def test_status_gross_klein_egal() -> None:
    """Ein `SUCCESS` in Großbuchstaben ist derselbe Zustand."""
    assert nummern_aus_permits(
        {"listing_permits": [
            {"status": "SUCCESS",
             "finalized_answers": {"license_number": {"text_value": "42"}}}
        ]}
    ) == ["42"]


def test_finalized_schlaegt_answers() -> None:
    """Der bestätigte Stand gilt, nicht das halbfertige Formular."""
    assert nummern_aus_permits(
        {"listing_permits": [
            {"status": "success",
             "answers": {"license_number": {"text_value": "alt"}},
             "finalized_answers": {"license_number": {"text_value": "neu"}}}
        ]}
    ) == ["neu"]
