"""Channex-Kanalraten dürfen weder gespiegelt noch überschrieben werden.

Live-Befund vom 11.08.2026 (19 Properties gelesen): Channex legt je Eintrag im
Kanal-Mapping eine eigene Rate an — Kind unseres Plans, `rate_mode: derived`,
Eigenpreis `0.00`, Titel „<unser Plan> - AirBNB Airbnb". Der Import hielt sie
für fremden Portalbestand und spiegelte 32 davon als lokale `rate_plans` mit
Preis 0; `sync_content` schrieb sie danach als `manual` zurück und nahm ihnen
die Ableitung. Kenntlich sind sie NUR an `relationships.channel`.
"""
from typing import Any

from src.features.channel_manager.bookings_sync import BookingsSyncMixin
from src.features.channel_manager.common import kanal_plan_id
from src.features.channel_manager.content_sync import ContentSyncMixin

KANAL_ID = "9a46827b-7b6a-4be2-bbd6-611794f785fb"
ELTERN_ID = "12d0e499-9047-464f-a623-77107ccea33c"
KLON_ID = "a689e9bf-be2c-4767-a083-b4fad3144aff"
RAUM_ID = "83f1cb64-7f56-476b-8f91-966f70694dc8"
PROP_ID = "b02f3d49-568a-40a5-bbaa-8eb1c2273d11"

# Gekürzte Live-Antwort: der echte Plan und Channex' Kanalrate darunter.
BASIS_PLAN = {
    "id": ELTERN_ID,
    "attributes": {"title": "Grundpreis (von Airbnb)", "currency": "DKK",
                   "rate_mode": "manual",
                   "options": [{"is_primary": True, "rate": "1380.00"}]},
    "relationships": {"room_type": {"data": {"id": RAUM_ID}}},
}
KANALRATE = {
    "id": KLON_ID,
    "attributes": {"title": "Grundpreis (von Airbnb) - AirBNB Airbnb",
                   "currency": "DKK", "rate_mode": "derived",
                   "options": [{"is_primary": True, "rate": "0.00"}]},
    "relationships": {"room_type": {"data": {"id": RAUM_ID}},
                      "channel": {"data": {"id": KANAL_ID}},
                      "parent_rate_plan": {"data": {"id": ELTERN_ID}}},
}


# --- Erkennung ---------------------------------------------------------------

def test_kanalrate_wird_an_der_beziehung_erkannt() -> None:
    assert kanal_plan_id(KANALRATE) == KANAL_ID
    assert kanal_plan_id(BASIS_PLAN) is None
    assert kanal_plan_id({}) is None
    assert kanal_plan_id({"relationships": {"channel": {"data": {}}}}) is None


# --- Import ------------------------------------------------------------------

class _FakeTable:
    def __init__(self, name: str, protokoll: list[tuple[str, str, Any]]) -> None:
        self.name = name
        self.protokoll = protokoll
        self.rows: list[dict[str, Any]] = []

    def select(self, *_a: object, **_k: object) -> "_FakeTable":
        return self

    def eq(self, *_a: object, **_k: object) -> "_FakeTable":
        return self

    def is_(self, *_a: object, **_k: object) -> "_FakeTable":
        return self

    def limit(self, *_a: object, **_k: object) -> "_FakeTable":
        return self

    def order(self, *_a: object, **_k: object) -> "_FakeTable":
        return self

    def insert(self, werte: dict[str, Any]) -> "_FakeTable":
        self.protokoll.append(("insert", self.name, werte))
        return self

    def upsert(self, werte: dict[str, Any], **_k: object) -> "_FakeTable":
        self.protokoll.append(("upsert", self.name, werte))
        return self

    def update(self, werte: dict[str, Any]) -> "_FakeTable":
        self.protokoll.append(("update", self.name, werte))
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self.rows})()


class _FakeDb:
    """Nur so viel Zustand, wie der Import-Pfad liest."""

    def __init__(self, zeilen: dict[str, list[dict[str, Any]]]) -> None:
        self.zeilen = zeilen
        self.protokoll: list[tuple[str, str, Any]] = []

    def table(self, name: str) -> _FakeTable:
        t = _FakeTable(name, self.protokoll)
        t.rows = list(self.zeilen.get(name, []))
        return t


class _FakeChannex:
    is_configured = True

    def __init__(self, rate_plans: list[dict[str, Any]]) -> None:
        self._rate_plans = rate_plans
        self.geschrieben: list[str] = []

    def get_room_types(self, _pid: str) -> dict[str, Any]:
        return {"data": [{"id": RAUM_ID, "attributes": {"title": "FeWo"}}]}

    def get_rate_plans(self, _pid: str) -> dict[str, Any]:
        return {"data": self._rate_plans}

    def update_rate_plan(self, plan_id: str, _attrs: dict[str, Any]) -> dict[str, Any]:
        self.geschrieben.append(plan_id)
        return {"data": {"id": plan_id}}

    def delete_rate_plan(self, plan_id: str, **_k: object) -> dict[str, Any]:
        self.geschrieben.append(f"delete:{plan_id}")
        return {}


def _import_mixin(db: _FakeDb, channex: _FakeChannex) -> BookingsSyncMixin:
    m = BookingsSyncMixin()
    m._db = db  # type: ignore[attr-defined]  # noqa: SLF001
    m._channex = channex  # type: ignore[attr-defined]  # noqa: SLF001
    return m


def test_import_spiegelt_nur_den_echten_plan_nicht_die_kanalrate() -> None:
    db = _FakeDb({
        "channex_property_map": [
            {"id": "pm1", "property_id": PROP_ID, "created_at": "2026-08-05"},
        ],
        "channex_room_type_map": [{"id": "rt1", "local_unit_ref": PROP_ID}],
        "rate_plans": [{"id": "neu"}],
    })
    channex = _FakeChannex([BASIS_PLAN, KANALRATE])
    ergebnis = _import_mixin(db, channex).import_rooms_rates_for_property("t1", "cxp")

    angelegt = [w for art, tab, w in db.protokoll if art == "insert" and tab == "rate_plans"]
    assert [w["name"] for w in angelegt] == ["Grundpreis (von Airbnb)"]
    assert ergebnis["rate_plans"] == 1
    # Auch keine Map auf die Kanalrate — sonst greift sie der nächste Sync ab.
    gemappt = [w["channex_rate_plan_id"]
               for art, tab, w in db.protokoll
               if art == "upsert" and tab == "channex_rate_plan_map"]
    assert KLON_ID not in gemappt


# --- Rückschreibewege --------------------------------------------------------

def _content_mixin(channex: _FakeChannex) -> ContentSyncMixin:
    m = ContentSyncMixin()
    m._channex = channex  # type: ignore[attr-defined]  # noqa: SLF001
    return m


def test_titelsuche_uebernimmt_keine_kanalrate() -> None:
    """Der Klon trägt denselben Titel-Stamm am selben Room-Type.

    Ein Treffer hier hätte einen PUT auf Channex' Kanalrate ausgelöst — genau
    der Weg, der 32 Raten von `derived` auf `manual` mit Preis 0 gekippt hat.
    """
    channex = _FakeChannex([KANALRATE])
    treffer = _content_mixin(channex)._channex_rate_plan_nach_titel(  # noqa: SLF001
        PROP_ID, RAUM_ID, "Grundpreis (von Airbnb) - AirBNB Airbnb"
    )
    assert treffer is None
    assert channex.geschrieben == []


def test_titelsuche_findet_den_echten_plan_weiterhin() -> None:
    treffer = _content_mixin(_FakeChannex([BASIS_PLAN, KANALRATE]))._channex_rate_plan_nach_titel(  # noqa: SLF001
        PROP_ID, RAUM_ID, "Grundpreis (von Airbnb)"
    )
    assert treffer == ELTERN_ID


def test_prune_loescht_keine_kanalrate() -> None:
    """Alt-Maps auf Kanalraten: lokal weg, bei Channex trotzdem unantastbar.

    Die Kanalrate IST das Mapping des Portals — ein Löschen nähme dem Objekt
    den Kanal.
    """
    db = _FakeDb({"channex_rate_plan_map": [
        {"id": "m1", "local_rate_plan_id": None, "channex_rate_plan_id": KLON_ID},
    ]})
    channex = _FakeChannex([KANALRATE])
    _content_mixin(channex)._prune_orphan_rate_plans(  # noqa: SLF001
        db, "t1", "rt1", PROP_ID, local_ids=set()
    )
    assert channex.geschrieben == []
    assert [art for art, tab, _ in db.protokoll if tab == "channex_rate_plan_map"] == []


def test_prune_loescht_verwaisten_eigenen_plan_weiterhin() -> None:
    """Der Aufräumweg bleibt für echte Pläne erhalten."""
    db = _FakeDb({"channex_rate_plan_map": [
        {"id": "m1", "local_rate_plan_id": None, "channex_rate_plan_id": ELTERN_ID},
    ]})
    channex = _FakeChannex([BASIS_PLAN, KANALRATE])
    _content_mixin(channex)._prune_orphan_rate_plans(  # noqa: SLF001
        db, "t1", "rt1", PROP_ID, local_ids=set()
    )
    assert channex.geschrieben == [f"delete:{ELTERN_ID}"]
