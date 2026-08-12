"""Datumsrechnung der geplanten Berichte — DB-frei und damit als Einheit prüfbar.

Zwei Fragen, die nichts mit Datenbank oder HTTP zu tun haben:

* ``periode`` — welchen Zeitraum wertet ein Lauf am Tag X aus?
* ``laeuft_heute`` — ist X überhaupt der Lauftag dieses Plans?

``heute`` kommt IMMER vom Aufrufer und nie aus ``date.today()`` in der Tiefe:
sonst ließe sich kein vergangener Lauf nachstellen und kein Test schreiben, der
den Monatswechsel prüft.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta

# Der erste Monat jedes Quartals — die eine Stelle, an der diese Zuordnung
# steht. Sie zweimal auszuschreiben (Start und Lauftag) ist genau die Art
# Doppelpflege, die beim nächsten Rhythmus auseinanderläuft.
_QUARTALS_START = (1, 4, 7, 10)
_QUARTALS_ENDE = (3, 6, 9, 12)


def _monatsende(tag: date) -> date:
    return tag.replace(day=calendar.monthrange(tag.year, tag.month)[1])


def _woche(heute: date, laufend: bool) -> tuple[date, date]:
    start = heute - timedelta(days=heute.weekday())
    if not laufend:
        start -= timedelta(days=7)
    return start, start + timedelta(days=6)


def _monat(heute: date, laufend: bool) -> tuple[date, date]:
    erster = heute.replace(day=1)
    if not laufend:
        erster = (erster - timedelta(days=1)).replace(day=1)
    return erster, _monatsende(erster)


def _quartal(heute: date, laufend: bool) -> tuple[date, date]:
    erster = date(heute.year, ((heute.month - 1) // 3) * 3 + 1, 1)
    if not laufend:
        # Einen Tag vor den Quartalsanfang zurück, dann wieder auf den
        # Quartalsanfang — das trägt auch über den Jahreswechsel.
        vortag = erster - timedelta(days=1)
        erster = date(vortag.year, ((vortag.month - 1) // 3) * 3 + 1, 1)
    return erster, _monatsende(date(erster.year, erster.month + 2, 1))


def _jahr(heute: date, laufend: bool) -> tuple[date, date]:
    jahr = heute.year if laufend else heute.year - 1
    return date(jahr, 1, 1), date(jahr, 12, 31)


_RHYTHMEN = {
    "woche": _woche,
    "monat": _monat,
    "quartal": _quartal,
    "jahr": _jahr,
}


def periode(rhythmus: str, zeitraum: str, heute: date) -> tuple[date, date]:
    """Der auszuwertende Zeitraum eines Plan-Laufs am Tag ``heute``.

    ``zeitraum='vergangener'`` nimmt die eben abgeschlossene Periode
    (Normalfall einer Abrechnung), ``'laufender'`` die noch offene
    (Zwischenstand). Ein unbekannter Rhythmus ist ein Programmierfehler, kein
    Rückfall auf „Monat": ein stillschweigend anderer Zeitraum ergäbe eine
    Abrechnung über die falschen Wochen.
    """
    fn = _RHYTHMEN.get(rhythmus)
    if fn is None:
        raise ValueError(f"Unbekannter Rhythmus: {rhythmus!r}")
    return fn(heute, zeitraum == "laufender")


def laeuft_heute(am_tag: str, rhythmus: str, heute: date) -> bool:
    """Ist ``heute`` der Lauftag dieses Plans?

    ``letzte`` löst am letzten Tag der PERIODE aus, nicht am letzten Tag des
    Monats — bei einem Quartalsplan wären das drei verschiedene Tage.
    """
    if am_tag == "erste":
        return _ist_periodenanfang(rhythmus, heute)
    return _ist_periodenende(rhythmus, heute)


def _ist_periodenanfang(rhythmus: str, heute: date) -> bool:
    if rhythmus == "woche":
        return heute.weekday() == 0
    if heute.day != 1:
        return False
    return {
        "monat": True,
        "quartal": heute.month in _QUARTALS_START,
    }.get(rhythmus, heute.month == 1)


def _ist_periodenende(rhythmus: str, heute: date) -> bool:
    if rhythmus == "woche":
        return heute.weekday() == 6
    if heute != _monatsende(heute):
        return False
    return {
        "monat": True,
        "quartal": heute.month in _QUARTALS_ENDE,
    }.get(rhythmus, heute.month == 12)
