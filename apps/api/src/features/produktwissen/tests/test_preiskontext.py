"""Tests des Preiskontexts.

WARUM DIESE DATEI EXISTIERT: Zwei Fehler sind hier live aufgetreten und beide
wären ohne Test wieder passiert.

1. ZWEI EINHEITEN IN EINER LISTE. Die Stripe-Beträge stehen in Cent, der
   Provisionsdeckel (`COMMISSION_CAP_EUR`) in Euro. Beide durch 100 zu teilen
   machte aus 250 EUR Deckel „2,50 EUR" — eine Zahl, die plausibel aussieht
   und um den Faktor 100 falsch ist.
2. DATENBANKSCHLÜSSEL ALS PRODUKTNAME. Ohne Zuordnung nannte der Bot
   „modul3 buchhaltung" statt „Buchhaltung".

Dazu die Wurzel-4-Fälle: fehlt die Währung oder die Staffel, darf KEIN Text
entstehen — lieber keine Preisauskunft als eine erfundene.
"""

from __future__ import annotations

import pytest

from src.features.produktwissen.preiskontext import (
    ist_preisfrage,
    preistext,
)

_LISTE = {
    "currency": "EUR",
    "grundtarif_tiers": [
        {"up_to": 1, "flat_amount": 1990, "unit_amount": None},
        {"up_to": 50, "flat_amount": None, "unit_amount": 600},
        {"up_to": None, "flat_amount": None, "unit_amount": 400},
    ],
    "modules": [
        {
            "module_key": "modul3_buchhaltung",
            "unit_amount": 2990,
            "per_unit_label": None,
        },
        {
            "module_key": "modul4_per_seat",
            "unit_amount": 250,
            "per_unit_label": "Nutzer",
        },
    ],
    "commission_marketplace_percent": 8.0,
    "commission_external_percent": 0.5,
    "commission_external_cap_amount": 250.0,
    "commission_external_cap_currency": "EUR",
}


def test_deckel_wird_nicht_durch_hundert_geteilt() -> None:
    """Der Provisionsdeckel steht in EURO, nicht in Cent.

    Der Live-Fehler vom 10.09.2026: aus 250 EUR wurde „2,50 EUR".
    """
    text = preistext(_LISTE)

    assert text is not None
    assert "250,00 EUR" in text
    assert "2,50 EUR im Monat" not in text


def test_stripe_betraege_werden_durch_hundert_geteilt() -> None:
    """Die Stripe-Beträge stehen dagegen SEHR WOHL in Cent."""
    text = preistext(_LISTE)

    assert text is not None
    assert "19,90 EUR" in text  # 1990 Cent
    assert "6,00 EUR" in text  # 600 Cent
    assert "29,90 EUR" in text  # Modul, 2990 Cent


def test_module_tragen_lesbare_namen() -> None:
    """Kein Datenbankschlüssel in einer Antwort an Besucher."""
    text = preistext(_LISTE)

    assert text is not None
    assert "Buchhaltung" in text
    assert "modul3" not in text
    assert "modul4_per_seat" not in text


def test_ohne_waehrung_kein_text() -> None:
    """Wurzel 4: ein Betrag ohne Währung ist bedeutungslos."""
    ohne = {**_LISTE, "currency": None}

    assert preistext(ohne) is None


def test_ohne_staffel_kein_text() -> None:
    """Ohne Grundpreis gibt es nichts zu sagen."""
    ohne = {**_LISTE, "grundtarif_tiers": []}

    assert preistext(ohne) is None


def test_keine_liste_kein_text() -> None:
    """Stripe nicht erreichbar → keine erfundenen Preise."""
    assert preistext(None) is None


def test_staffelgrenzen_stehen_im_text() -> None:
    """Ohne die Grenze kann das Modell nicht richtig rechnen."""
    text = preistext(_LISTE)

    assert text is not None
    assert "bis 50 Objekte" in text


@pytest.mark.parametrize(
    "frage",
    [
        "Was kostet myNextDays?",
        "Wie hoch ist die Provision?",
        "What does it cost?",
        "How much is the subscription?",
        "Hvad koster det?",
        "Quel est le prix ?",
        "Welche Gebühren fallen an?",
    ],
)
def test_preisfragen_werden_erkannt(frage: str) -> None:
    assert ist_preisfrage(frage) is True


@pytest.mark.parametrize(
    "frage",
    [
        "Wie verbinde ich Airbnb?",
        "Wie lege ich ein Objekt an?",
        "Kann mein Team eigene Zugänge bekommen?",
    ],
)
def test_sachfragen_sind_keine_preisfragen(frage: str) -> None:
    """Sonst hinge an jeder Frage ein zusätzlicher Stripe-Abruf."""
    assert ist_preisfrage(frage) is False
