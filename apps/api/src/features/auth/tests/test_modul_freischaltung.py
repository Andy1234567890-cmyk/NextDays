"""Tests für die Pfad→Modul-Zuordnung des Freischalt-Riegels (0572).

Angelegt am 11.09.2026 mit dem dritten Modul `buchhaltung`. Der Riegel hatte
bis dahin keinen Test — und genau hier steckt die eine Stelle, an der ein
falscher Präfix still alles freigibt (`/hr` statt `/personal`, s. Modul-Doku)
oder eine fehlende Ausnahme jedem Betrieb sein Konto zerlegt.
"""
import pytest

from src.features.auth.modul_freischaltung import (
    MODUL_AUSNAHMEN,
    MODUL_PRAEFIXE,
    _pfad_modul,
)


@pytest.mark.parametrize(
    ("pfad", "modul"),
    [
        ("/api/v1/buchhaltung/invoices", "buchhaltung"),
        ("/api/v1/buchhaltung", "buchhaltung"),
        ("/api/v1/buchhaltung/customers/abc", "buchhaltung"),
        ("/api/v1/buchhaltung/number-sequences/t1", "buchhaltung"),
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
        # Firmenstammdaten: /konto und Onboarding JEDES Betriebs.
        "/api/v1/buchhaltung/companies/me",
        "/api/v1/buchhaltung/companies/me/logo",
        "/api/v1/buchhaltung/companies/t1/stripe-sync",
        "/api/v1/buchhaltung/vat-check",
        "/api/v1/buchhaltung/health",
        # Kein gesperrtes Modul.
        "/api/v1/reservations",
        "/api/v1/buchhaltungx/irgendwas",
        # Der uebrige taxpayer-Slice ist kein Modul, nur DAC7 darunter.
        "/api/v1/taxpayer/profile",
    ],
)
def test_offene_pfade(pfad: str) -> None:
    assert _pfad_modul(pfad) is None


def test_segmentgrenze() -> None:
    # `/buchhaltung/companiesX` ist KEINE Ausnahme — nur echte Segmente zählen.
    assert _pfad_modul("/api/v1/buchhaltung/companiesX") == "buchhaltung"


def test_jede_ausnahme_liegt_unter_ihrem_modul() -> None:
    # Eine Ausnahme, die nicht unter dem Präfix ihres Moduls liegt, ist toter
    # Text und täuscht Schutz vor, den es nicht gibt.
    for modul, ausnahmen in MODUL_AUSNAHMEN.items():
        praefixe = MODUL_PRAEFIXE[modul]
        for a in ausnahmen:
            assert any(a == p or a.startswith(p + "/") for p in praefixe), (modul, a)
