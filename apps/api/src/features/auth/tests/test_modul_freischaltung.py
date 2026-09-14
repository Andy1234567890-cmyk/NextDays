"""Tests für die Pfad→Modul-Zuordnung des Freischalt-Riegels (0572).

Angelegt am 14.09.2026 mit dem Modul `dac7`. Der Riegel hatte bis dahin keinen
Test — und genau hier steckt die eine Stelle, an der ein falscher Präfix still
alles freigibt (`/hr` statt `/personal`, s. Modul-Doku).
"""
import pytest

from src.features.auth.modul_freischaltung import _pfad_modul


@pytest.mark.parametrize(
    ("pfad", "modul"),
    [
        ("/api/v1/personal/mitarbeiter", "personal"),
        ("/api/v1/site-config", "website_builder"),
        ("/api/v1/taxpayer/dac7/meldungen", "dac7"),
        ("/api/v1/taxpayer/dac7", "dac7"),
    ],
)
def test_gesperrte_pfade(pfad: str, modul: str) -> None:
    assert _pfad_modul(pfad) == modul


@pytest.mark.parametrize(
    "pfad",
    [
        "/api/v1/reservations",
        # Der uebrige taxpayer-Slice ist kein Modul, nur DAC7 darunter.
        "/api/v1/taxpayer/profile",
        "/api/v1/taxpayer/dac7x",
    ],
)
def test_offene_pfade(pfad: str) -> None:
    assert _pfad_modul(pfad) is None
