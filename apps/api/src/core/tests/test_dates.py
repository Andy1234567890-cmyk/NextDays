"""Tests für core.dates — die zusammengeführte Zeitraum-Logik.

Diese Tests halten die BEIDEN End-Konventionen fest. Sie sind der Grund, warum
die vier vorherigen Kopien gefahrlos zusammengelegt werden konnten: ein
Off-by-one in `merge_day_ranges` würde hier sofort auffallen.
"""
from datetime import date

from src.core.dates import merge_day_ranges, nights


def test_nights_ohne_abreisetag() -> None:
    assert nights(date(2026, 5, 1), date(2026, 5, 4)) == [
        date(2026, 5, 1),
        date(2026, 5, 2),
        date(2026, 5, 3),
    ]


def test_nights_leer_bei_gleichem_tag_oder_rueckwaerts() -> None:
    assert nights(date(2026, 5, 1), date(2026, 5, 1)) == []
    assert nights(date(2026, 5, 4), date(2026, 5, 1)) == []


def test_merge_inklusiv_letzter_belegter_tag() -> None:
    days = [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]
    assert merge_day_ranges(days, end_exclusive=False) == [
        (date(2026, 5, 1), date(2026, 5, 3))
    ]


def test_merge_exklusiv_erster_freier_tag() -> None:
    days = [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]
    assert merge_day_ranges(days, end_exclusive=True) == [
        (date(2026, 5, 1), date(2026, 5, 4))
    ]


def test_merge_trennt_bei_luecke() -> None:
    days = [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 5)]
    assert merge_day_ranges(days, end_exclusive=False) == [
        (date(2026, 5, 1), date(2026, 5, 2)),
        (date(2026, 5, 5), date(2026, 5, 5)),
    ]


def test_merge_sortiert_und_dedupliziert() -> None:
    days = [date(2026, 5, 3), date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 1)]
    assert merge_day_ranges(days, end_exclusive=False) == [
        (date(2026, 5, 1), date(2026, 5, 3))
    ]


def test_merge_einzeltag() -> None:
    days = [date(2026, 5, 7)]
    assert merge_day_ranges(days, end_exclusive=False) == [
        (date(2026, 5, 7), date(2026, 5, 7))
    ]
    assert merge_day_ranges(days, end_exclusive=True) == [
        (date(2026, 5, 7), date(2026, 5, 8))
    ]


def test_merge_leer() -> None:
    assert merge_day_ranges([], end_exclusive=False) == []
    assert merge_day_ranges([], end_exclusive=True) == []
