"""Tests für tenant-weite Saison-Vorlagen (/calendar/season-templates, 0584).

Schwerpunkte:
* Wurzel 2 — Anwenden ist idempotent: der zweite Klick aktualisiert die
  gleichnamige Saison am Objekt, legt keine Dublette an und lässt genau EINEN
  Zeitraum je Kategorie stehen.
* Wurzel 1 — Anwenden materialisiert die Tagespreise gegen den Basispreis DES
  ZIELS (über den bestehenden Übertragungspfad, keine zweite Rechnung).
* Wurzel 3 — fremde Vorlage 404, fremdes Zielobjekt 404 ohne Teilzustand.
* Wurzel 5 — Ziel ohne Basispreis wird je Kategorie benannt, nicht
  verschluckt; Vorlage ohne Zeiträume „mit Zeiträumen" ist 422.
* „Als Vorlage speichern" nimmt Saisons + Zeiträume des Objekts und
  aktualisiert bei gleichem Namen.

Fake-DB aus test_season_apply — dieselbe, mit der der Übertragungspfad selbst
getestet ist.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.features.calendar.saison_vorlagen import SeasonTemplateService
from src.features.calendar.schemas import (
    SeasonTemplateCreate,
    SeasonTemplateFromPropertyRequest,
    SeasonTemplateUpdate,
)
from src.features.calendar.service import CalendarError, CalendarService

from .test_season_apply import _DB, _preise
from .test_season_apply import _tables as _basis_tabellen


def _tables() -> dict[str, list[dict]]:
    t = _basis_tabellen()
    t["season_templates"] = []
    return t


def _svc(tables: dict) -> SeasonTemplateService:
    db = _DB(tables)
    return SeasonTemplateService(client=db, kalender=CalendarService(client=db))


def _vorlage_standard() -> SeasonTemplateCreate:
    return SeasonTemplateCreate(
        name="Standard", farbe="#112233",
        kategorien=[
            {"name": "Hochsaison", "color": "#ff0000", "mode": "percent", "amount": 30},
            {"name": "Nebensaison", "color": "#00ff00", "mode": "percent", "amount": -10},
        ],
        zeitraeume=[
            {"kategorie_index": 0, "start_date": "2026-07-01", "end_date": "2026-07-03"},
            {"kategorie_index": 1, "start_date": "2026-10-01", "end_date": "2026-10-02"},
        ],
    )


def _saisons(tables: dict, property_id: str) -> list[dict]:
    return [s for s in tables["property_seasons"] if s["property_id"] == property_id]


def _zuweisungen(tables: dict, property_id: str) -> list[dict]:
    return [
        a for a in tables["property_season_assignments"]
        if a["property_id"] == property_id
    ]


# --- Schema ------------------------------------------------------------------

def test_zeitraum_auf_fehlende_kategorie_422() -> None:
    with pytest.raises(ValidationError):
        SeasonTemplateCreate(
            name="x",
            kategorien=[{"name": "A", "color": "#000000", "mode": "percent", "amount": 1}],
            zeitraeume=[{"kategorie_index": 1, "start_date": "2026-01-01",
                         "end_date": "2026-01-02"}],
        )


def test_doppelte_kategorienamen_422() -> None:
    with pytest.raises(ValidationError):
        SeasonTemplateCreate(
            name="x",
            kategorien=[
                {"name": "A", "color": "#000000", "mode": "percent", "amount": 1},
                {"name": "A", "color": "#000001", "mode": "percent", "amount": 2},
            ],
        )


# --- CRUD --------------------------------------------------------------------

def test_anlegen_und_listen() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    assert v["name"] == "Standard"
    assert len(v["kategorien"]) == 2
    assert len(v["zeitraeume"]) == 2
    assert [t["id"] for t in svc.list_templates("t-1")] == [v["id"]]
    assert svc.list_templates("t-9") == []


def test_fremde_vorlage_404() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    with pytest.raises(CalendarError) as exc:
        svc.apply_template("t-9", v["id"], ["p-9"])
    assert exc.value.status_code == 404
    with pytest.raises(CalendarError):
        svc.delete_template("t-9", v["id"])
    assert len(tables["season_templates"]) == 1


def test_update_kategorien_ohne_zeitraeume_prueft_bestand() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    # Nur noch eine Kategorie, aber ein gespeicherter Zeitraum zeigt auf Index 1.
    with pytest.raises(CalendarError) as exc:
        svc.update_template("t-1", v["id"], SeasonTemplateUpdate(
            kategorien=[{"name": "Nur eine", "color": "#000000",
                         "mode": "percent", "amount": 5}],
        ))
    assert exc.value.status_code == 422


# --- Anwenden ----------------------------------------------------------------

def test_anwenden_materialisiert_gegen_basispreis_des_ziels() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    res = svc.apply_template("t-1", v["id"], ["p-2"])
    assert res == {"uebertragen": 1, "uebersprungen": []}
    saisons = {s["name"]: s for s in _saisons(tables, "p-2")}
    assert set(saisons) == {"Hochsaison", "Nebensaison"}
    assert saisons["Hochsaison"]["amount"] == 30
    assert len(_zuweisungen(tables, "p-2")) == 2
    # Basis des Ziels 200: +30 % → 260, -10 % → 180.
    preise = _preise(tables, "p-2")
    assert preise["2026-07-01"] == 260.0
    assert preise["2026-07-03"] == 260.0
    assert preise["2026-10-01"] == 180.0
    assert "2026-10-03" not in preise


def test_anwenden_zweimal_ist_idempotent() -> None:
    """Wurzel 2: gleicher Name je Objekt → Update statt Dublette; ein Zeitraum
    je Kategorie, nicht zwei."""
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    svc.apply_template("t-1", v["id"], ["p-2", "p-4"])
    svc.apply_template("t-1", v["id"], ["p-2", "p-4"])
    for pid in ("p-2", "p-4"):
        assert sorted(s["name"] for s in _saisons(tables, pid)) == [
            "Hochsaison", "Nebensaison",
        ]
        assert len(_zuweisungen(tables, pid)) == 2
    assert _preise(tables, "p-4")["2026-07-01"] == 520.0  # 400 * 1,30


def test_geaenderte_vorlage_aktualisiert_beim_erneuten_anwenden() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    svc.apply_template("t-1", v["id"], ["p-2"])
    svc.update_template("t-1", v["id"], SeasonTemplateUpdate(
        kategorien=[
            {"name": "Hochsaison", "color": "#ff0000", "mode": "percent", "amount": 50},
            {"name": "Nebensaison", "color": "#00ff00", "mode": "percent", "amount": -10},
        ],
    ))
    svc.apply_template("t-1", v["id"], ["p-2"])
    hoch = next(s for s in _saisons(tables, "p-2") if s["name"] == "Hochsaison")
    assert hoch["amount"] == 50
    assert _preise(tables, "p-2")["2026-07-01"] == 300.0  # 200 * 1,50


def test_ohne_zeitraeume_nur_kategorien() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    res = svc.apply_template("t-1", v["id"], ["p-2"], zeitraeume_mitnehmen=False)
    assert res["uebertragen"] == 1
    assert len(_saisons(tables, "p-2")) == 2
    assert _zuweisungen(tables, "p-2") == []
    assert _preise(tables, "p-2") == {}


def test_vorlage_ohne_zeitraeume_mit_zeitraeumen_422() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", SeasonTemplateCreate(
        name="Leer", kategorien=[
            {"name": "A", "color": "#000000", "mode": "percent", "amount": 1},
        ],
    ))
    with pytest.raises(CalendarError) as exc:
        svc.apply_template("t-1", v["id"], ["p-2"])
    assert exc.value.status_code == 422


def test_fremdes_ziel_404_ohne_teilzustand() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    with pytest.raises(CalendarError) as exc:
        svc.apply_template("t-1", v["id"], ["p-2", "p-9"])
    assert exc.value.status_code == 404
    # Der Scope-Fehler kommt VOR dem ersten Schreiben: auch p-2 blieb unberührt.
    assert _saisons(tables, "p-2") == []
    assert _saisons(tables, "p-9") == []


def test_ziel_ohne_basispreis_wird_je_kategorie_benannt() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.create_template("t-1", _vorlage_standard())
    res = svc.apply_template("t-1", v["id"], ["p-3"])
    assert res["uebertragen"] == 0
    assert res["uebersprungen"] == [
        {"property_id": "p-3", "kategorie": "Hochsaison", "grund": "kein_basispreis"},
        {"property_id": "p-3", "kategorie": "Nebensaison", "grund": "kein_basispreis"},
    ]
    assert _saisons(tables, "p-3") == []


# --- Als Vorlage speichern ---------------------------------------------------

def test_from_property_nimmt_saisons_und_zeitraeume() -> None:
    tables = _tables()
    svc = _svc(tables)
    v = svc.from_property("t-1", SeasonTemplateFromPropertyRequest(
        property_id="p-1", name="Aus Quelle",
    ))
    assert [k["name"] for k in v["kategorien"]] == ["Hochsaison", "Silvester"]
    assert v["kategorien"][1]["mode"] == "fixed"
    assert v["zeitraeume"] == [
        {"kategorie_index": 0, "start_date": "2026-07-01", "end_date": "2026-07-03"},
    ]


def test_from_property_gleicher_name_aktualisiert() -> None:
    tables = _tables()
    svc = _svc(tables)
    a = svc.from_property("t-1", SeasonTemplateFromPropertyRequest(
        property_id="p-1", name="Aus Quelle",
    ))
    b = svc.from_property("t-1", SeasonTemplateFromPropertyRequest(
        property_id="p-1", name="Aus Quelle",
    ))
    assert a["id"] == b["id"]
    assert len(tables["season_templates"]) == 1


def test_from_property_ohne_saisons_422() -> None:
    tables = _tables()
    with pytest.raises(CalendarError) as exc:
        _svc(tables).from_property("t-1", SeasonTemplateFromPropertyRequest(
            property_id="p-2", name="Leer",
        ))
    assert exc.value.status_code == 422


def test_from_property_fremdes_objekt_404() -> None:
    tables = _tables()
    with pytest.raises(CalendarError) as exc:
        _svc(tables).from_property("t-1", SeasonTemplateFromPropertyRequest(
            property_id="p-9", name="Fremd",
        ))
    assert exc.value.status_code == 404
