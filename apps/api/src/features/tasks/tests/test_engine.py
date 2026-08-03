"""Tests der Regel-Engine (0272).

Geprüft wird das, was ohne DB entscheidbar ist und wo die teuren Fehler sitzen:
die Zeitanker der planmäßigen Regeln und das Ausrollen der Wiederholungsmuster.
Die Idempotenz selbst hängt am UNIQUE-Index der Live-DB — sie wird gegen die
echte Datenbank verifiziert, nicht gegen einen Mock (der bewiese nur den Mock).
"""
from datetime import UTC, date, datetime, time

import pytest

from src.features.tasks.engine import (
    RuleEngineError,
    _monthly_day,
    _occurrences,
    _parse_clock,
    _reservation_anchors,
    _trigger_time,
)

_RESERVATION = {
    "id": "r1",
    "check_in": "2026-08-10",
    "check_out": "2026-08-14",
    "checkin_time": "16:00",
    "checkout_time": "10:00",
    "created_at": "2026-07-01T09:30:00+00:00",
}


def _anchors() -> tuple[datetime, datetime]:
    anchors = _reservation_anchors(_RESERVATION)
    assert anchors is not None
    return anchors


# --- Uhrzeiten ------------------------------------------------------------


def test_parse_clock_erfindet_keine_uhrzeit() -> None:
    assert _parse_clock("16:00") == time(16, 0)
    assert _parse_clock("16:00:00") == time(16, 0)
    # Unlesbares bleibt None statt still auf eine Standardstunde zu fallen.
    assert _parse_clock("nachmittags") is None
    assert _parse_clock("") is None
    assert _parse_clock(None) is None


def test_reservation_ohne_zeitraum_hat_keine_anker() -> None:
    assert _reservation_anchors({"id": "r1", "check_in": None, "check_out": None}) is None


# --- Trigger --------------------------------------------------------------


def test_check_in_und_check_out_nutzen_die_zeiten_der_buchung() -> None:
    anchors = _anchors()
    assert _trigger_time("check_in", 0, _RESERVATION, anchors) == datetime(
        2026, 8, 10, 16, 0, tzinfo=UTC
    )
    assert _trigger_time("check_out", 0, _RESERVATION, anchors) == datetime(
        2026, 8, 14, 10, 0, tzinfo=UTC
    )


def test_offset_verschiebt_mit_vorzeichen() -> None:
    anchors = _anchors()
    # „2 Tage vor Anreise" = −2880 Minuten.
    assert _trigger_time(
        "days_before_check_in", -2880, _RESERVATION, anchors
    ) == datetime(2026, 8, 8, 16, 0, tzinfo=UTC)
    assert _trigger_time(
        "days_after_check_out", 1440, _RESERVATION, anchors
    ) == datetime(2026, 8, 15, 10, 0, tzinfo=UTC)


def test_after_check_in_24h_endet_spaetestens_zum_check_out() -> None:
    kurz = {**_RESERVATION, "check_out": "2026-08-11", "checkout_time": "10:00"}
    anchors = _reservation_anchors(kurz)
    assert anchors is not None
    # Check-in 10.8. 16:00 + 24 h wäre der 11.8. 16:00 — der Gast ist aber um
    # 10:00 weg. Die Aufgabe endet mit der Abreise, nicht danach.
    assert _trigger_time("after_check_in_24h", 0, kurz, anchors) == datetime(
        2026, 8, 11, 10, 0, tzinfo=UTC
    )


def test_ohne_trigger_gibt_es_keinen_zeitpunkt() -> None:
    assert _trigger_time(None, 0, _RESERVATION, _anchors()) is None


def test_unbekannter_trigger_faellt_hart_durch() -> None:
    with pytest.raises(RuleEngineError):
        _trigger_time("irgendwann", 0, _RESERVATION, _anchors())


# --- Wiederholungsmuster --------------------------------------------------


def test_taeglich_rastet_auf_das_anfangsdatum_ein() -> None:
    days = _occurrences(
        {"frequency": "daily", "interval": 3},
        date(2026, 8, 1),
        None,
        date(2026, 8, 5),
        date(2026, 8, 14),
    )
    # Raster ab 1.8.: 1, 4, 7, 10, 13 — im Fenster ab dem 5.8. bleiben 7/10/13.
    assert days == [date(2026, 8, 7), date(2026, 8, 10), date(2026, 8, 13)]


def test_woechentlich_nur_die_markierten_tage() -> None:
    mask = (1 << 0) | (1 << 4)  # Montag + Freitag
    days = _occurrences(
        {"frequency": "weekly", "interval": 1, "weekday_mask": mask},
        date(2026, 8, 1),
        None,
        date(2026, 8, 1),
        date(2026, 8, 14),
    )
    assert days == [
        date(2026, 8, 3),
        date(2026, 8, 7),
        date(2026, 8, 10),
        date(2026, 8, 14),
    ]


def test_woechentlich_ohne_maske_ergibt_nichts() -> None:
    # Unfertiges Muster → keine Aufgabe. Lieber gar keine als eine geratene.
    assert (
        _occurrences(
            {"frequency": "weekly", "interval": 1},
            date(2026, 8, 1),
            None,
            date(2026, 8, 1),
            date(2026, 8, 31),
        )
        == []
    )


def test_monatlich_erster_montag() -> None:
    rec = {
        "frequency": "monthly",
        "interval": 1,
        "weekday_pattern_position": "first",
        "weekday_pattern_weekday": 0,
    }
    days = _occurrences(rec, date(2026, 8, 1), None, date(2026, 8, 1), date(2026, 10, 31))
    assert days == [date(2026, 8, 3), date(2026, 9, 7), date(2026, 10, 5)]


def test_monatstag_31_rutscht_auf_den_monatsletzten() -> None:
    # Sonst hätte die Regel in jedem kurzen Monat eine stumme Lücke.
    assert _monthly_day(2026, 9, {"day_of_month": 31}) == date(2026, 9, 30)
    assert _monthly_day(2026, 2, {"day_of_month": 30}) == date(2026, 2, 28)


def test_enddatum_schneidet_das_fenster() -> None:
    days = _occurrences(
        {"frequency": "daily", "interval": 1},
        date(2026, 8, 1),
        date(2026, 8, 3),
        date(2026, 8, 1),
        date(2026, 8, 31),
    )
    assert days == [date(2026, 8, 1), date(2026, 8, 2), date(2026, 8, 3)]


def test_jaehrlich_haelt_den_monat_des_anfangsdatums() -> None:
    days = _occurrences(
        {"frequency": "yearly", "interval": 1, "day_of_month": 15},
        date(2026, 4, 15),
        None,
        date(2026, 1, 1),
        date(2028, 12, 31),
    )
    assert days == [date(2026, 4, 15), date(2027, 4, 15), date(2028, 4, 15)]
