"""Bei Channex gefuehrt, bei uns archiviert/geloescht → dort abraeumen.

WARUM DAS EIN WAECHTER SEIN MUSS UND KEIN HANDGRIFF:
Channex rechnet je gefuehrter Property ab. Ein gekuendigtes Objekt, das dort
weiterlaeuft, kostet jeden Monat — und solange ein Kanal aktiv haengt, verkauft
die OTA weiter, waehrend von uns keine Pushes mehr kommen (Blindverkauf).

Das Archivieren raeumt sofort ab. Aber das kann scheitern: Channex nicht
erreichbar, Kanal-Abbau mit 502. Dann bleibt die Property stehen. Bei EINEM
Betrieb faellt das auf, bei tausend nicht — deshalb holt der Abgleich jeden
solchen Fall beim naechsten Tick nach, ohne dass jemand etwas tun muss.

Der Abgleich kannte bisher nur die eine Richtung („Channex weg → Map
schliessen"). Die Gegenrichtung fehlte vollstaendig, und genau die kostet Geld.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.property_mapping import PropertyMappingMixin

_TENANT = "t-1"


class _Kette:
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

    @property
    def not_(self) -> _Kette:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._s["rows"].get(self._t, [])})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {"rows": rows, "updates": []}

    def table(self, name: str) -> _Kette:
        return _Kette(name, self.store)


class _Mixin(PropertyMappingMixin):
    """Nur die Waechter-Methode; die Umgebung des Mixins wird nicht gebraucht."""


def test_archiviertes_objekt_wird_bei_channex_abgeraeumt(monkeypatch) -> None:
    """Der Kernfall: bei uns archiviert, bei Channex noch da → abräumen.

    `properties` liefert die Zeile NICHT zurueck, weil die Abfrage auf
    `archived_at is null` filtert — genau so erkennt der Waechter das Archiv.
    """
    db = _Db({"properties": []})  # nichts „gefuehrt" → alles abzuraeumen
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.channex_abraeumen",
        lambda _db, tenant, pid: gerufen.append(pid) or "abgeräumt",
    )
    mixin = _Mixin()

    anzahl = mixin._channex_verwaiste_abraeumen(  # noqa: SLF001
        db,
        _TENANT,
        active=[{"id": "map-1", "property_id": "p-1", "channex_property_id": "chx-1"}],
        live_by_id={"chx-1": {}},
    )

    assert anzahl == 1
    assert gerufen == ["p-1"]


def test_gefuehrtes_objekt_bleibt_unangetastet(monkeypatch) -> None:
    """Die Gegenprobe — sonst raeumte der Waechter den laufenden Bestand ab.

    Das waere der schlimmste Fehler dieser Klasse: 42 aktive Objekte bei
    Channex geloescht, weil eine Abfrage falsch filtert.
    """
    db = _Db({"properties": [{"id": "p-1"}]})  # gefuehrt
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.channex_abraeumen",
        lambda _db, tenant, pid: gerufen.append(pid) or "abgeräumt",
    )
    mixin = _Mixin()

    anzahl = mixin._channex_verwaiste_abraeumen(  # noqa: SLF001
        db,
        _TENANT,
        active=[{"id": "map-1", "property_id": "p-1", "channex_property_id": "chx-1"}],
        live_by_id={"chx-1": {}},
    )

    assert anzahl == 0
    assert gerufen == []


def test_bei_channex_schon_weg_wird_nicht_angefasst(monkeypatch) -> None:
    """Ist die Property bei Channex nicht mehr live, ist hier nichts zu tun.

    Diesen Fall schliesst der Zweig darueber („Channex weg → Map soft-loeschen").
    Ein zweiter Abraeum-Versuch waere ein Aufruf ins Leere und zaehlte eine
    Kostenaenderung ins Log, die nie stattfand.
    """
    db = _Db({"properties": []})
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.channex_abraeumen",
        lambda _db, tenant, pid: gerufen.append(pid) or "abgeräumt",
    )
    mixin = _Mixin()

    anzahl = mixin._channex_verwaiste_abraeumen(  # noqa: SLF001
        db,
        _TENANT,
        active=[{"id": "map-1", "property_id": "p-1", "channex_property_id": "chx-1"}],
        live_by_id={},  # nicht mehr live
    )

    assert anzahl == 0
    assert gerufen == []


def test_fehler_bei_einem_objekt_stoppt_die_uebrigen_nicht(monkeypatch) -> None:
    """Ein Channex-Fehler an einem Objekt darf die anderen nicht mitnehmen.

    Sonst haette ein einziges hängendes Objekt den Waechter fuer den ganzen
    Betrieb blockiert — und die Kosten der uebrigen liefen weiter (Wurzel 5).
    """
    db = _Db({"properties": []})
    gerufen: list[str] = []

    def _teils(_db: Any, _tenant: str, pid: str) -> str:
        gerufen.append(pid)
        if pid == "p-1":
            raise RuntimeError("Channex nicht erreichbar")
        return "abgeräumt"

    monkeypatch.setattr(
        "src.features.properties.archiv.channex_abraeumen", _teils
    )
    mixin = _Mixin()

    anzahl = mixin._channex_verwaiste_abraeumen(  # noqa: SLF001
        db,
        _TENANT,
        active=[
            {"id": "m1", "property_id": "p-1", "channex_property_id": "chx-1"},
            {"id": "m2", "property_id": "p-2", "channex_property_id": "chx-2"},
        ],
        live_by_id={"chx-1": {}, "chx-2": {}},
    )

    # Beide versucht, eines gezaehlt.
    assert gerufen == ["p-1", "p-2"]
    assert anzahl == 1
