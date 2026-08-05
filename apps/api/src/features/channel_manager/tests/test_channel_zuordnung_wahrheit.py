"""Zugeordnet ist nur, was CHANNEX zuordnet — nicht was unsere Tabelle behauptet.

Der Fall ist live gemessen (04.08.2026, Konto AirSmil): `013 Rævlingevej` und
`020 Lille Lægehus` sind in `channex_channel_connection` Feld für Feld identisch
— gleiche `channex_channel_id`, `is_active = true`, `sync_enabled = true`, leerer
`ota_room_type_code`. Aus UNSEREN Daten ist der Unterschied nicht erkennbar.

Bei Channex ist aber nur 020 zugeordnet; 013 steht dort auf „Not mapped", und
Channex' Zuordnungsmaske meldet „Count: 1". Die Oberfläche zeigte trotzdem beide
als „Synchronisiert" und zählte „2 von 18 verbunden".

Das ist die gefährlichste Sorte Falschaussage: ein grünes „Synchronisiert" auf
einer Zeile, die nichts sendet — dort prüft der Betrieb nicht mehr nach.

Die Wahrheit steht ausschließlich im Kanal-Objekt unter `rate_plans[]`; einen
GET-Pfad für Mappings gibt es nicht (alle 404, gemessen). Jeder Eintrag trägt
`settings.listing_id`, und das verbindet über `properties.airbnb_listing_id` mit
unserem Objekt.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin

# Kanal-Antwort wie live gemessen: EIN Mapping, und es trägt nur die listing_id
# (kein `rate_plan_id`, kein `room_type_id` — geprüft).
KANAL_MIT_EINEM_MAPPING: dict[str, Any] = {
    "data": {
        "attributes": {
            "id": "9a46827b-7b6a-4be2-bbd6-611794f785fb",
            "channel": "AirBNB",
            "is_active": True,
            "rate_plans": [
                {
                    "id": "f37d5d54-7808-43c2-b36e-30f2e34cccd5",
                    "settings": {
                        "listing_id": "1378994948547697321",  # nur 020
                        "published": False,
                        "sync_category": "sync_all",
                    },
                }
            ],
        }
    }
}

PROP_013 = "e34fc9fb-0000-0000-0000-000000000013"
PROP_020 = "ed885e62-74d5-4be2-b7e9-3945ee523d2c"


class _FakeTable:
    """Supabase-Tabelle, die immer dieselben Objektzeilen liefert."""

    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def select(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def eq(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def in_(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self.rows})()


class _FakeDb:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def table(self, _name: str) -> _FakeTable:
        return _FakeTable(self.rows)


class _FakeChannex:
    def __init__(self, antwort: dict | Exception) -> None:
        self.antwort = antwort

    def get_channel(self, _channel_id: str) -> dict[str, Any]:
        if isinstance(self.antwort, Exception):
            raise self.antwort
        return self.antwort


def _mixin(antwort: dict | Exception) -> ChannelsMixin:
    m = ChannelsMixin()
    m._channex = _FakeChannex(antwort)  # type: ignore[attr-defined]  # noqa: SLF001
    return m


ZEILEN = [
    {"id": PROP_013, "airbnb_listing_id": "1133122057704952480"},
    {"id": PROP_020, "airbnb_listing_id": "1378994948547697321"},
]


def test_nur_das_bei_channex_zugeordnete_objekt_zaehlt() -> None:
    """Der Kern: 013 hat eine Verbindungszeile, aber KEIN Mapping bei Channex."""
    ziel = _mixin(KANAL_MIT_EINEM_MAPPING)._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(ZEILEN), "t1", [PROP_013, PROP_020], {"kanal-1"}
    )
    assert ziel == {PROP_020}
    assert PROP_013 not in (ziel or set())


def test_ohne_kanal_kein_ziel() -> None:
    """Eine Verbindungszeile ohne `channex_channel_id` ist keine Verbindung."""
    ziel = _mixin(KANAL_MIT_EINEM_MAPPING)._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(ZEILEN), "t1", [PROP_013, PROP_020], set()
    )
    assert ziel == set()


def test_channex_nicht_erreichbar_gibt_none_statt_leer() -> None:
    """Wurzel 4/5: fällt der Abruf aus, ist die Antwort „unbekannt" — NICHT
    „nichts zugeordnet". Sonst zeigte ein Channex-Ausfall alle 18 Objekte als
    getrennt, und der Betrieb würde sie neu verbinden."""
    from src.features.channel_manager.channex_client import ChannexError

    ziel = _mixin(ChannexError("boom"))._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(ZEILEN), "t1", [PROP_013, PROP_020], {"kanal-1"}
    )
    assert ziel is None


def test_kanal_ohne_mappings_ergibt_leere_menge() -> None:
    """Verbundener Kanal, aber `rate_plans: []` — so stand der Kanal vor der
    ersten Zuordnung. Dann ist KEIN Objekt zugeordnet (nicht None: der Abruf
    hat ja funktioniert)."""
    leer = {"data": {"attributes": {"rate_plans": []}}}
    ziel = _mixin(leer)._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(ZEILEN), "t1", [PROP_013, PROP_020], {"kanal-1"}
    )
    assert ziel == set()


def test_objekt_ohne_listing_id_zaehlt_nie() -> None:
    """Ein Objekt ohne `airbnb_listing_id` kann keinem Airbnb-Listing entsprechen."""
    ohne = [{"id": PROP_013, "airbnb_listing_id": None}]
    ziel = _mixin(KANAL_MIT_EINEM_MAPPING)._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(ohne), "t1", [PROP_013], {"kanal-1"}
    )
    assert ziel == set()


def test_listing_id_vergleich_ist_typunabhaengig() -> None:
    """Channex liefert die listing_id als String, unsere Spalte kann sie als Zahl
    führen. Ein Vergleich ohne Normalisierung fände nichts."""
    als_zahl = [{"id": PROP_020, "airbnb_listing_id": 1378994948547697321}]
    ziel = _mixin(KANAL_MIT_EINEM_MAPPING)._objekte_mit_channex_ziel(  # noqa: SLF001
        _FakeDb(als_zahl), "t1", [PROP_020], {"kanal-1"}
    )
    assert ziel == {PROP_020}
