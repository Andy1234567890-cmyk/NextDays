"""Der Reconciler muss den Mindestaufenthalt heilen können, nicht nur den Preis.

Live gemessen am 23.08.2026 an zwei verbundenen Objekten (Feriehus Line
0875c029…, FeWo Lille Vidstrup baef82f5…) mit je zwei Rate-Plans:

    rate_plans.min_stay            = 2   (alle vier Pläne)
    rate_plan_min_stay_overrides   = 0   Zeilen
    channex_ari_shadow (min_stay)  = 505…513 Tage je Plan

`_load_desired_rate_plan_min_stays` las AUSSCHLIESSLICH die Override-Tabelle.
Das Soll war damit leer, `min_drift` in `reconcile_rate_plan_prices` folglich
immer 0 — obwohl der Schatten für jeden Plan über 500 Tage mit min_stay führte.
Ginge der Mindestaufenthalt bei Channex verloren, hätte der Abgleich es nie
bemerkt und nie nachgesendet; die Selbstheilungs-Zusage des Docstrings galt nur
für den Preis (Wurzel 1). Der einzige Weg, wie min_stay überhaupt zu Channex
kam, war `sync_content` — kein periodischer Lauf.

Geprüft wird deshalb der Soll-Stand selbst: dass der Grundwert die Kurve füllt,
dass Overrides ihn tagesgenau ausstechen, und dass ohne echten Grundwert kein
Fantasie-Wert entsteht (Wurzel 4).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin

PLAN_A = "69fa5398-4d21-4f00-b89b-a5a58b8f4f98"
PLAN_B = "38210b86-6b05-4afa-8f1d-6a3e56d840ea"
PROP_ID = "0875c029-07cf-42b5-8187-e71edd0d8286"


class _FakeTable:
    """Liefert je Tabellenname eine feste Zeilenliste; Filter sind No-ops.

    Die Filter müssen hier nichts tun: geprüft wird die Vorrang- und
    Kurvenbildung, nicht PostgREST. Die Datumsfilter des Overrides-Reads
    schneiden im Test nichts weg, weil alle Testzeilen im Horizont liegen.
    """

    def __init__(self, rows: list[dict[str, Any]], fehler: bool) -> None:
        self._rows = rows
        self._fehler = fehler

    def select(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def eq(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def in_(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def gte(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def lte(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def limit(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    @property
    def not_(self) -> _FakeTable:
        return self

    def is_(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def execute(self) -> Any:
        if self._fehler:
            raise RuntimeError("relation does not exist")
        return type("R", (), {"data": list(self._rows)})()


class _FakeDb:
    def __init__(
        self,
        plans: list[dict[str, Any]],
        overrides: list[dict[str, Any]],
        av: dict[str, Any] | None = None,
        *,
        overrides_fehlen: bool = False,
    ) -> None:
        self._tabellen = {
            "rate_plans": (plans, False),
            "rate_plan_min_stay_overrides": (overrides, overrides_fehlen),
            "properties": (
                [{"type_attributes": {"availability": av}}] if av else [],
                False,
            ),
        }

    def table(self, name: str) -> _FakeTable:
        rows, fehler = self._tabellen[name]
        return _FakeTable(rows, fehler)


def _soll(db: _FakeDb, start: date, end: date) -> dict[str, dict[str, int]]:
    """`_load_desired_rate_plan_min_stays` ohne Channex-Client aufrufen.

    Die Methode braucht vom Mixin nur `_to_int` und den Logger, keinen
    Konstruktor — deshalb an einer leeren Hülle gebunden.
    """
    mixin = AriPushMixin.__new__(AriPushMixin)
    return AriPushMixin._load_desired_rate_plan_min_stays(
        mixin, db, PROP_ID, [PLAN_A, PLAN_B], start, end
    )


# --- Der Grundwert füllt die Kurve ------------------------------------------


def test_plan_grundwert_fuellt_jeden_tag() -> None:
    """Der eigentliche Befund: min_stay=2 ohne Override MUSS ins Soll.

    Vorher war `out` hier leer und der Reconciler sah nie Drift.
    """
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": 2}, {"id": PLAN_B, "min_stay": 2}],
        overrides=[],
    )
    start, end = date(2026, 9, 1), date(2026, 9, 5)
    soll = _soll(db, start, end)
    assert set(soll) == {PLAN_A, PLAN_B}
    assert soll[PLAN_A] == {
        "2026-09-01": 2, "2026-09-02": 2, "2026-09-03": 2,
        "2026-09-04": 2, "2026-09-05": 2,
    }
    assert soll[PLAN_B] == soll[PLAN_A]


def test_formularwert_gilt_ohne_plan_wert() -> None:
    """Kein `rate_plans.min_stay` → der Objekt-Grundwert aus dem
    Verfügbarkeits-Formular, dieselbe Kette wie im Full-Sync."""
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": None}],
        overrides=[],
        av={"minStay": 3},
    )
    soll = _soll(db, date(2026, 9, 1), date(2026, 9, 2))
    assert soll[PLAN_A] == {"2026-09-01": 3, "2026-09-02": 3}


def test_plan_wert_sticht_den_formularwert() -> None:
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": 5}],
        overrides=[],
        av={"minStay": 3},
    )
    soll = _soll(db, date(2026, 9, 1), date(2026, 9, 1))
    assert soll[PLAN_A] == {"2026-09-01": 5}


# --- Overrides liegen darüber ------------------------------------------------


def test_override_sticht_den_grundwert_tagesgenau() -> None:
    """Der Kalender ist die Ausnahme, das Formular die Regel — und die
    umliegenden Tage behalten den Grundwert (nicht wie vorher: gar nichts)."""
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": 2}],
        overrides=[{"rate_plan_id": PLAN_A, "date": "2026-09-03", "min_stay": 7}],
    )
    soll = _soll(db, date(2026, 9, 1), date(2026, 9, 4))
    assert soll[PLAN_A] == {
        "2026-09-01": 2, "2026-09-02": 2, "2026-09-03": 7, "2026-09-04": 2,
    }


def test_override_ohne_grundwert_bleibt_allein_im_soll() -> None:
    """Kein Grundwert irgendwo → nur der Override-Tag, KEIN erfundenes min_stay=1
    für den Rest (Wurzel 4). Sonst schriebe der Reconciler 1 an die Portale."""
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": None}],
        overrides=[{"rate_plan_id": PLAN_A, "date": "2026-09-02", "min_stay": 4}],
    )
    soll = _soll(db, date(2026, 9, 1), date(2026, 9, 3))
    assert soll[PLAN_A] == {"2026-09-02": 4}


def test_kein_grundwert_und_kein_override_bleibt_leer() -> None:
    db = _FakeDb(plans=[{"id": PLAN_A, "min_stay": 0}], overrides=[])
    assert _soll(db, date(2026, 9, 1), date(2026, 9, 3)) == {}


# --- Fehlende Override-Tabelle darf den Grundwert nicht mitnehmen -----------


def test_fehlende_override_tabelle_laesst_den_grundwert_stehen() -> None:
    """Umgebung vor 0150: kein Crash, und der Grundwert bleibt trotzdem im
    Soll — sonst wäre die Selbstheilung dort wieder abgeschaltet."""
    db = _FakeDb(
        plans=[{"id": PLAN_A, "min_stay": 2}],
        overrides=[],
        overrides_fehlen=True,
    )
    soll = _soll(db, date(2026, 9, 1), date(2026, 9, 2))
    assert soll[PLAN_A] == {"2026-09-01": 2, "2026-09-02": 2}


# --- Drift-Erkennung: genau das, was vorher unmöglich war -------------------


def test_verlorener_min_stay_im_schatten_ist_drift() -> None:
    """Die Rechnung aus `reconcile_rate_plan_prices` nachgestellt: hält der
    Schatten für einen Tag keinen/einen falschen Mindestaufenthalt, muss das
    Drift sein. Mit dem alten leeren Soll war `min_drift` hier immer {}."""
    db = _FakeDb(plans=[{"id": PLAN_A, "min_stay": 2}], overrides=[])
    want_min = _soll(db, date(2026, 9, 1), date(2026, 9, 3))[PLAN_A]
    # Schatten: Tag 1 stimmt, Tag 2 steht auf 1 (bei Channex verloren),
    # Tag 3 fehlt ganz.
    have_days: dict[str, dict[str, int | None]] = {
        "2026-09-01": {"rate_cents": 100, "min_stay": 2},
        "2026-09-02": {"rate_cents": 100, "min_stay": 1},
    }
    min_drift = {
        iso: ms
        for iso, ms in want_min.items()
        if (have_days.get(iso) or {}).get("min_stay") != ms
    }
    assert min_drift == {"2026-09-02": 2, "2026-09-03": 2}
