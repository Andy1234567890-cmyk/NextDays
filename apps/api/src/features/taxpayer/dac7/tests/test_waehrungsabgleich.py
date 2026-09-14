"""Objektwaehrung gegen Buchungswaehrung (`_taetigkeiten_bauen`).

DER LIVE-FALL (11.09.2026): Elf daenische Objekte standen auf DKK, ihre
1000 Buchungen auf EUR. Die Meldung entstand fehlerfrei — in EUR. Damit
fiel der ganze daenische Anhang weg: Die Bruttomieteinnahme ist zwingend
in DKK zu melden, und die BFE-Nummer haengt an demselben Zweig
(`_daenischer_anhang`). In der Vorschau stand deshalb bei jedem Objekt
„BFE-Nummer fehlt", obwohl sie an allen elf erfasst war.

Nichts davon war ein Fehler im Sinne der Vorlage — die Datei war
korrekt. Der Widerspruch lag in den Daten, und niemand sah ihn.

Kein Integrationstest: Hier wird eine reine Entscheidung geprueft, keine
Datenbankdeutung.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from src.features.taxpayer.dac7.aufbau import MeldungsAufbau, _Objektzeile
from src.features.taxpayer.dac7.modell import Anschrift, Pruefbericht
from src.features.taxpayer.dac7.rechner import Buchungswerte


def _zeile(waehrung: str | None) -> _Objektzeile:
    return _Objektzeile(
        property_id="p1",
        anschrift=Anschrift("DK", "Badevej", "12", "6950", "Søndervig"),
        objektart="DPI904",
        grundbuchnummer="14BK",
        bfe_nummer="5012847",
        waehrung=waehrung,
    )


def _werte(waehrung: str) -> Buchungswerte:
    werte = Buchungswerte()
    werte.waehrung = waehrung
    werte.verguetung = werte.verguetung.plus(1, Decimal(1000))
    return werte


def _bauen(objekt_waehrung: str | None, buchungs_waehrung: str):
    bericht = Pruefbericht()
    taetigkeiten = MeldungsAufbau._taetigkeiten_bauen(
        [(_zeile(objekt_waehrung), _werte(buchungs_waehrung))],
        "Testverkäufer",
        bericht,
    )
    return taetigkeiten, bericht


def test_gleiche_waehrung_ergibt_keinen_hinweis() -> None:
    taetigkeiten, bericht = _bauen("DKK", "DKK")
    assert len(taetigkeiten) == 1
    assert taetigkeiten[0].waehrung == "DKK"
    assert bericht.hinweise == []


def test_abweichung_wird_gemeldet_aber_nicht_verworfen() -> None:
    """Die Zeile entsteht — gemeldet wird die BUCHUNGSwaehrung.

    Ein Gast, der in EUR gezahlt hat, hat in EUR gezahlt. Die Zeile
    wegzulassen hiesse, echte Umsaetze nicht zu melden; die Waehrung zu
    tauschen hiesse, dieselbe Zahl mit falschem Etikett zu melden. Beides
    waere schlimmer als ein Hinweis.
    """
    taetigkeiten, bericht = _bauen("DKK", "EUR")
    assert len(taetigkeiten) == 1
    assert taetigkeiten[0].waehrung == "EUR"
    assert len(bericht.hinweise) == 1
    assert bericht.darf_melden is True


def test_hinweis_nennt_die_folge_fuer_die_daenischen_felder() -> None:
    """Sonst sucht jemand den Fehler bei der BFE-Nummer.

    Genau das ist live passiert: Die Vorschau meldete „BFE-Nummer fehlt",
    und die Ursache lag zwei Ebenen entfernt bei der Waehrung.
    """
    _, bericht = _bauen("DKK", "EUR")
    grund = bericht.hinweise[0].grund
    assert "DKK" in grund and "EUR" in grund
    assert "BFE" in grund


def test_objekt_ohne_waehrung_erzeugt_keinen_hinweis() -> None:
    """Kein Wert ist kein Widerspruch.

    Ein Objekt ohne hinterlegte Waehrung sagt nichts aus — daraus einen
    Mangel zu machen erzeugte Rauschen bei jedem Betrieb, der das Feld
    nie gefuellt hat.
    """
    _, bericht = _bauen(None, "EUR")
    assert bericht.hinweise == []


@pytest.mark.parametrize("objekt_waehrung", ["EUR", "SEK"])
def test_nicht_daenische_abweichung_nennt_keine_dk_felder(
    objekt_waehrung: str,
) -> None:
    """Die DK-Erklaerung gehoert nur dorthin, wo sie zutrifft."""
    _, bericht = _bauen(objekt_waehrung, "DKK")
    grund = bericht.hinweise[0].grund
    assert "BFE" not in grund
    assert "pruefen" in grund.lower()
