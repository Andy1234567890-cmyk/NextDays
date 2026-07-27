"""Validierung der Steuerzahler-Angaben — reine Regelprüfung, keine DB.

Die Regeln stammen aus DAC7: Für natürliche Personen und Rechtsträger gelten
unterschiedliche Pflichtfelder, und die Steuer-ID darf nur bei Privatpersonen
durch den Geburtsort ersetzt werden.
"""
from __future__ import annotations

from datetime import date

import pytest

from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind


def _person(**felder: object) -> dict:
    basis = {
        "country": "DE",
        "kind": TaxpayerKind.INDIVIDUAL,
        "first_name": "Anna",
        "last_name": "Muster",
        "date_of_birth": date(1985, 3, 12),
        "tin": "12345678901",
    }
    return {**basis, **felder}


def _firma(**felder: object) -> dict:
    basis = {
        "country": "DE",
        "kind": TaxpayerKind.ENTITY,
        "legal_name": "Muster GmbH",
        "tin": "DE123456789",
    }
    return {**basis, **felder}


def test_laenderkuerzel_wird_gross() -> None:
    assert TaxpayerCreate(**_firma(country="es")).country == "ES"


def test_tin_wird_normalisiert() -> None:
    """Behörden schreiben die Nummer unterschiedlich — gemeldet wird die reine."""
    assert TaxpayerCreate(**_firma(tin=" de 123.456-789 ")).tin == "DE123456789"


def test_leere_tin_wird_zu_none() -> None:
    eintrag = TaxpayerCreate(
        **_person(tin="   ", birth_place_city="Berlin", birth_place_country="DE")
    )
    assert eintrag.tin is None


@pytest.mark.parametrize("feld", ["first_name", "last_name", "date_of_birth"])
def test_person_braucht_name_und_geburtsdatum(feld: str) -> None:
    with pytest.raises(ValueError, match="natürliche Person"):
        TaxpayerCreate(**_person(**{feld: None}))


def test_firma_braucht_firmennamen() -> None:
    with pytest.raises(ValueError, match="Firmenname"):
        TaxpayerCreate(**_firma(legal_name=None))


def test_firma_braucht_steuernummer() -> None:
    """Die Geburtsort-Ausnahme gilt NUR für natürliche Personen."""
    with pytest.raises(ValueError, match="Steuernummer"):
        TaxpayerCreate(**_firma(tin=None))


def test_person_ohne_tin_braucht_geburtsort() -> None:
    with pytest.raises(ValueError, match="Geburtsort"):
        TaxpayerCreate(**_person(tin=None))


def test_person_ohne_tin_mit_geburtsort_ist_gueltig() -> None:
    """DAC7 lässt das zu, wenn das Wohnsitzland keine Steuer-ID vergibt."""
    eintrag = TaxpayerCreate(
        **_person(tin=None, birth_place_city="Milano", birth_place_country="it")
    )
    assert eintrag.tin is None
    assert eintrag.birth_place_country == "IT"


def test_person_ohne_tin_mit_halbem_geburtsort_scheitert() -> None:
    with pytest.raises(ValueError, match="Geburtsort"):
        TaxpayerCreate(**_person(tin=None, birth_place_city="Milano"))
