"""Perioden-Schlüssel: Monat, Quartal, Jahr, Grenzen inklusiv, Unsinn → Fehler."""

from datetime import date

import pytest

from src.features.buchhaltung.bereiche.steuer.perioden import (
    PeriodeUngueltig,
    aktuelle_periode,
    periode_parsen,
)


def test_monat() -> None:
    p = periode_parsen("2026-02")
    assert (p.kind, p.start, p.end, p.key) == (
        "month",
        date(2026, 2, 1),
        date(2026, 2, 28),
        "2026-02",
    )


def test_quartal_kleinschreibung_normalisiert() -> None:
    p = periode_parsen("2026-q3")
    assert (p.kind, p.start, p.end, p.key) == (
        "quarter",
        date(2026, 7, 1),
        date(2026, 9, 30),
        "2026-Q3",
    )


def test_jahr() -> None:
    p = periode_parsen("2024")
    assert (p.kind, p.start, p.end) == ("year", date(2024, 1, 1), date(2024, 12, 31))


@pytest.mark.parametrize(
    "roh", ["2026-13", "2026-Q5", "26-01", "1999", "2101", "abc", "", "2026-08-01"]
)
def test_ungueltig(roh: str) -> None:
    with pytest.raises(PeriodeUngueltig):
        periode_parsen(roh)


def test_aktuelle_periode() -> None:
    heute = date(2026, 9, 12)
    assert aktuelle_periode(heute, "month") == "2026-09"
    assert aktuelle_periode(heute, "quarter") == "2026-Q3"
    assert aktuelle_periode(heute, "year") == "2026"
