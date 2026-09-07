"""Tests für Sonder-Events (GET/POST/PATCH/DELETE /calendar/events, 0583).

Schwerpunkte:
* Perioden-Validierung (422 statt Selbst-DoS, Wurzel 8): end < start, mehr als
  366 Tage je Zeitraum, mehr als 50 Zeiträume.
* Wurzel 1 — jede Änderung reiht den Recompute für die betroffenen Objekte
  ein, bei geänderter Zuweisung für ALTE und NEUE Objekte.
* Wurzel 3 — fremdes Event 404, fremde Objekt-ID in der Zuweisung 404.
* Recompute liest die Zuweisung: ein Event, das ANDERE Objekte nennt, wirkt
  nicht auf dieses.

Fake-DB aus test_season_apply (Filter-treu, kein Netz).
"""
from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from src.features.calendar import events as events_mod
from src.features.calendar.events import EventService
from src.features.calendar.schemas import EventCreate, EventPeriod, EventUpdate
from src.features.calendar.service import CalendarError
from src.features.pricing.recompute import DynamicPricingRecompute

from .test_season_apply import _DB


def _tables() -> dict[str, list[dict]]:
    return {
        "properties": [
            {"id": "p-1", "tenant_id": "t-1"},
            {"id": "p-2", "tenant_id": "t-1"},
            {"id": "p-3", "tenant_id": "t-1"},
            {"id": "p-9", "tenant_id": "t-9"},
        ],
        "dp_settings": [
            {"property_id": "p-1", "enabled": True},
            {"property_id": "p-2", "enabled": True},
            {"property_id": "p-3", "enabled": False},
        ],
        "events": [],
        "event_periods": [],
        "event_property_assignments": [],
    }


@pytest.fixture(name="eingereiht")
def _eingereiht(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Protokolliert, für welche Objekte ein Recompute eingereiht wurde."""
    ziel: list[str] = []
    monkeypatch.setattr(
        events_mod, "try_enqueue_recompute",
        lambda _db, _tenant, pid: ziel.append(pid),
    )
    return ziel


def _svc(tables: dict) -> EventService:
    return EventService(client=_DB(tables))


# --- Validierung -------------------------------------------------------------

def test_periode_end_vor_start_422() -> None:
    with pytest.raises(ValidationError):
        EventPeriod(start_date=date(2026, 7, 10), end_date=date(2026, 7, 1))


def test_periode_laenger_als_366_tage_422() -> None:
    with pytest.raises(ValidationError):
        EventPeriod(start_date=date(2026, 1, 1), end_date=date(2027, 1, 2))
    # Genau 366 Tage sind erlaubt (Schaltjahr-Grenze).
    EventPeriod(start_date=date(2028, 1, 1), end_date=date(2028, 12, 31))


def test_mehr_als_50_perioden_422() -> None:
    perioden = [
        {"start_date": "2026-01-01", "end_date": "2026-01-02"} for _ in range(51)
    ]
    with pytest.raises(ValidationError):
        EventCreate(name="Zu viel", percent=10, periods=perioden)


def test_prozent_grenzen_422() -> None:
    with pytest.raises(ValidationError):
        EventCreate(name="x", percent=-101)


# --- Anlegen mit unterbrochenen Zeiträumen -----------------------------------

def test_anlegen_mit_zwei_getrennten_zeitraeumen(eingereiht: list[str]) -> None:
    tables = _tables()
    ev = _svc(tables).create_event("t-1", EventCreate(
        name="DANA CUP", percent=25, color="#aabbcc",
        periods=[
            EventPeriod(start_date=date(2026, 7, 20), end_date=date(2026, 7, 26)),
            EventPeriod(start_date=date(2026, 8, 8), end_date=date(2026, 8, 9)),
        ],
        property_ids=["p-1"],
    ))
    assert ev["name"] == "DANA CUP"
    assert ev["percent"] == 25.0
    assert [(p["start_date"], p["end_date"]) for p in ev["periods"]] == [
        ("2026-07-20", "2026-07-26"), ("2026-08-08", "2026-08-09"),
    ]
    assert ev["property_ids"] == ["p-1"]
    assert len(tables["event_periods"]) == 2
    # Wurzel 1: nur das zugewiesene Objekt wird neu gerechnet.
    assert eingereiht == ["p-1"]


def test_ohne_zuweisung_rechnet_alle_dp_objekte(eingereiht: list[str]) -> None:
    tables = _tables()
    _svc(tables).create_event("t-1", EventCreate(name="Silvester", percent=40))
    # p-3 hat DP aus → dort wirkt kein Event, kein Job. p-9 ist fremd.
    assert sorted(eingereiht) == ["p-1", "p-2"]


# --- Wurzel 3 -----------------------------------------------------------------

def test_fremde_objekt_id_in_zuweisung_404(eingereiht: list[str]) -> None:
    tables = _tables()
    with pytest.raises(CalendarError) as exc:
        _svc(tables).create_event(
            "t-1", EventCreate(name="x", percent=5, property_ids=["p-9"])
        )
    assert exc.value.status_code == 404
    assert tables["events"] == []
    assert eingereiht == []


def test_fremdes_event_404(eingereiht: list[str]) -> None:
    tables = _tables()
    svc = _svc(tables)
    ev = svc.create_event("t-1", EventCreate(name="x", percent=5))
    with pytest.raises(CalendarError) as exc:
        svc.update_event("t-9", ev["id"], EventUpdate(name="y"))
    assert exc.value.status_code == 404
    with pytest.raises(CalendarError):
        svc.delete_event("t-9", ev["id"])
    assert len(tables["events"]) == 1
    assert svc.list_events("t-9") == []


# --- Wurzel 1: Update ersetzt Perioden komplett, rechnet alt UND neu ---------

def test_update_ersetzt_perioden_und_rechnet_alte_und_neue_objekte(
    eingereiht: list[str],
) -> None:
    tables = _tables()
    svc = _svc(tables)
    ev = svc.create_event("t-1", EventCreate(
        name="Festival", percent=15,
        periods=[EventPeriod(start_date=date(2026, 6, 1), end_date=date(2026, 6, 3))],
        property_ids=["p-1"],
    ))
    eingereiht.clear()
    neu = svc.update_event("t-1", ev["id"], EventUpdate(
        periods=[EventPeriod(start_date=date(2026, 9, 1), end_date=date(2026, 9, 2))],
        property_ids=["p-2"],
    ))
    # Alte Periode weg, neue da — kein Überschuss nach Abschluss.
    assert [(p["start_date"], p["end_date"]) for p in neu["periods"]] == [
        ("2026-09-01", "2026-09-02"),
    ]
    assert len(tables["event_periods"]) == 1
    assert neu["property_ids"] == ["p-2"]
    # p-1 verliert den Aufschlag, p-2 bekommt ihn: BEIDE neu rechnen.
    assert sorted(eingereiht) == ["p-1", "p-2"]


def test_update_leere_liste_ist_echte_angabe(eingereiht: list[str]) -> None:
    tables = _tables()
    svc = _svc(tables)
    ev = svc.create_event("t-1", EventCreate(
        name="x", percent=5,
        periods=[EventPeriod(start_date=date(2026, 6, 1), end_date=date(2026, 6, 3))],
        property_ids=["p-1"],
    ))
    eingereiht.clear()
    neu = svc.update_event("t-1", ev["id"], EventUpdate(periods=[], property_ids=[]))
    assert neu["periods"] == []
    assert neu["property_ids"] == []  # wieder „alle Objekte"
    # Zuweisung von „nur p-1" auf „alle" → alle DP-Objekte des Mandanten.
    assert sorted(eingereiht) == ["p-1", "p-2"]


def test_update_ohne_perioden_laesst_sie_stehen(eingereiht: list[str]) -> None:
    tables = _tables()
    svc = _svc(tables)
    ev = svc.create_event("t-1", EventCreate(
        name="x", percent=5,
        periods=[EventPeriod(start_date=date(2026, 6, 1), end_date=date(2026, 6, 3))],
    ))
    neu = svc.update_event("t-1", ev["id"], EventUpdate(percent=12))
    assert neu["percent"] == 12.0
    assert len(neu["periods"]) == 1


def test_delete_rechnet_betroffene_objekte(eingereiht: list[str]) -> None:
    tables = _tables()
    svc = _svc(tables)
    ev = svc.create_event("t-1", EventCreate(name="x", percent=5, property_ids=["p-2"]))
    eingereiht.clear()
    svc.delete_event("t-1", ev["id"])
    assert tables["events"] == []
    assert eingereiht == ["p-2"]


# --- Recompute liest die Zuweisung -------------------------------------------

def _recompute(tables: dict) -> DynamicPricingRecompute:
    return DynamicPricingRecompute(service_client=_DB(tables))


def test_recompute_event_ohne_zuweisung_wirkt_ueberall() -> None:
    tables = _tables()
    tables["events"] = [{"id": "e-1", "tenant_id": "t-1", "percent": 20}]
    tables["event_periods"] = [
        {"id": "ep-1", "event_id": "e-1", "start_date": "2026-07-01",
         "end_date": "2026-07-02"},
    ]
    pct = _recompute(tables)._event_pct_by_date(  # pylint: disable=protected-access
        "t-1", date(2026, 7, 1), date(2026, 7, 4), property_id="p-2"
    )
    assert pct == {"2026-07-01": 20.0, "2026-07-02": 20.0}


def test_recompute_event_mit_zuweisung_wirkt_nur_dort() -> None:
    tables = _tables()
    tables["events"] = [{"id": "e-1", "tenant_id": "t-1", "percent": 20}]
    tables["event_periods"] = [
        {"id": "ep-1", "event_id": "e-1", "start_date": "2026-07-01",
         "end_date": "2026-07-02"},
    ]
    tables["event_property_assignments"] = [
        {"id": "a-1", "event_id": "e-1", "property_id": "p-1"},
    ]
    rc = _recompute(tables)
    # pylint: disable=protected-access
    assert rc._event_pct_by_date(
        "t-1", date(2026, 7, 1), date(2026, 7, 4), property_id="p-1"
    ) == {"2026-07-01": 20.0, "2026-07-02": 20.0}
    assert rc._event_pct_by_date(
        "t-1", date(2026, 7, 1), date(2026, 7, 4), property_id="p-2"
    ) == {}
