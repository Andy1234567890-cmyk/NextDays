"""Ein Objekt = EINE aktive Channex-Registrierung (Wurzel 1 + Wurzel 2).

BEFUND (live gemessen 23.08.2026, Beta-Betrieb):
„FeWo *Stjerneskud*" (property 6efd2281…) trug DREI Zeilen in
`channex_property_map`. Zwei davon waren geschlossen (`deleted_at` gesetzt),
behielten aber `sync_enabled = true` und `last_sync_status = 'ok'` — ein
Zustand, den es fachlich nicht gibt. Ihre channex_property_ids (1060923f…,
7f4a5f2f…) zeigen auf Channex-Properties, die es dort nicht mehr gibt.

URSACHE: `oauth_channels._mapping_schliessen` schrieb NUR `deleted_at`. Jeder
andere Schließpfad (property_mapping, properties/archiv, content_sync) setzte
`sync_enabled = False` mit.

Zwei Tests, zwei Ebenen:
1. Die Quelle: der Schließpfad pflegt den Gegenzustand.
2. Der Melder: der ARI-Push bemerkt mehrere aktive Mappings laut, statt eine
   beliebige Zeile zu nehmen.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.oauth_channels import OAuthChannelsMixin


class _Kette:
    """Minimaler Supabase-Query-Builder-Ersatz; merkt Updates und Order."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._t = tabelle
        self._s = store

    def select(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def update(self, payload: dict[str, Any]) -> _Kette:
        self._s["updates"].append((self._t, payload))
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def in_(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def order(self, spalte: str, **_k: Any) -> _Kette:
        self._s["orders"].append((self._t, spalte))
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._s["rows"].get(self._t, [])})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {
            "rows": rows, "updates": [], "orders": [],
        }

    def table(self, name: str) -> _Kette:
        return _Kette(name, self.store)


class _Oauth(OAuthChannelsMixin):
    """Nur die Schließ-Methode; die Umgebung des Mixins wird nicht gebraucht."""


class _Ari(AriPushMixin):
    """Nur die Mapping-Auflösung."""


def test_mapping_schliessen_setzt_sync_enabled_mit() -> None:
    """Der Kernfall: geschlossen ⇒ nicht mehr eingeschaltet.

    Ohne `sync_enabled: False` bleibt genau die Zeile zurück, die live dreimal
    entstand: `deleted_at` gesetzt, `sync_enabled` weiter true. Jeder Leseweg,
    der auf `sync_enabled` filtert, hält das Objekt dann für verbunden — und
    zeigt auf eine Channex-Property, die es nicht mehr gibt.
    """
    db = _Db({})
    _Oauth._mapping_schliessen(db, "t-1", "cx-weg")

    updates = [p for t, p in db.store["updates"] if t == "channex_property_map"]
    assert len(updates) == 1
    assert updates[0]["deleted_at"] == "now()"
    assert updates[0]["sync_enabled"] is False
    # last_sync_status/-error bleiben unberührt: sie belegen, WIE die
    # Registrierung endete, und sind kein Gegenzustand.
    assert "last_sync_status" not in updates[0]


def test_mehrfach_aktives_mapping_wird_laut_geloggt(monkeypatch) -> None:
    """Der Melder: mehrere aktive Mappings sind ein Fehler-Log, kein Schweigen.

    Vorher nahm jeder Aufrufer `.limit(1)` ohne `order` — also eine beliebige
    Zeile. Der Push ging dann gegen eine willkürliche Channex-Property, im
    schlechten Fall gegen eine gelöschte: Budget verbraucht, Wirkung null,
    nirgends ein Fehler.
    """
    db = _Db({
        "channex_property_map": [
            {"id": "m-alt", "channex_property_id": "cx-alt"},
            {"id": "m-neu", "channex_property_id": "cx-neu"},
        ]
    })
    gemeldet: list[tuple[str, dict[str, Any]]] = []
    monkeypatch.setattr(
        "src.features.channel_manager.ari_push.log",
        type("L", (), {
            "error": staticmethod(
                lambda ereignis, **kw: gemeldet.append((ereignis, kw))
            ),
        })(),
    )

    row = _Ari._aktives_property_mapping(db, "t-1", "p-1")

    assert [e for e, _ in gemeldet] == ["channex_property_map_mehrfach_aktiv"]
    kw = gemeldet[0][1]
    assert kw["anzahl"] == 2
    assert kw["property_id"] == "p-1"
    assert kw["channex_property_ids"] == ["cx-alt", "cx-neu"]
    # Deterministisch: die ÄLTESTE Zeile gewinnt, nicht eine beliebige.
    assert ("channex_property_map", "created_at") in db.store["orders"]
    assert row is not None and row["id"] == "m-alt"


def test_ein_aktives_mapping_loggt_nichts(monkeypatch) -> None:
    """Der Normalfall bleibt still — ein Melder, der immer meldet, meldet nichts."""
    db = _Db({
        "channex_property_map": [{"id": "m-1", "channex_property_id": "cx-1"}]
    })
    gemeldet: list[str] = []
    monkeypatch.setattr(
        "src.features.channel_manager.ari_push.log",
        type("L", (), {
            "error": staticmethod(lambda ereignis, **_kw: gemeldet.append(ereignis)),
        })(),
    )

    row = _Ari._aktives_property_mapping(db, "t-1", "p-1")

    assert not gemeldet
    assert row is not None and row["channex_property_id"] == "cx-1"


def test_ohne_mapping_kein_treffer_und_kein_alarm(monkeypatch) -> None:
    """Nicht verbunden ist kein Fehler — None, ohne Log."""
    db = _Db({"channex_property_map": []})
    gemeldet: list[str] = []
    monkeypatch.setattr(
        "src.features.channel_manager.ari_push.log",
        type("L", (), {
            "error": staticmethod(lambda ereignis, **_kw: gemeldet.append(ereignis)),
        })(),
    )

    assert _Ari._aktives_property_mapping(db, "t-1", "p-1") is None
    assert not gemeldet
