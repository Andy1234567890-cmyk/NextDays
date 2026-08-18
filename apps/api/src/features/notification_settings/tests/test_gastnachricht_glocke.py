"""Tests für die Glocke bei neuen Gastnachrichten (0406).

Die Kategorie `messages` stand seit jeher im Katalog, hatte aber keinen
Auslöser: die Glocke schwieg zu Nachrichten, und das Sidebar-Abzeichen hörte
auf ein Signal, das nie kam.

Geprüft wird deshalb genau das, was den Unterschied macht:
  - die Meldung geht an die Betriebsleitung, nicht an jeden im Betrieb,
  - sie trägt den Thread-Bezug (0406), damit das Lesen sie stilllegen kann,
  - sie entdoppelt über den THREAD, nicht die einzelne Nachricht,
  - ein Fehler im Melden kippt den Nachrichteneingang nicht.
"""
from types import SimpleNamespace
from typing import Any

import pytest

from src.features.notification_settings.ereignisse import melde_gastnachricht

TENANT = "t-1"
THREAD = "thr-9"


class _Kette:  # pylint: disable=too-few-public-methods
    """Kettenbare Abfrage; protokolliert Filter und eingefügte Zeilen."""

    def __init__(self, db: "_DB", tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._filter: list[tuple[str, Any]] = []

    def select(self, *_a: Any, **_k: Any) -> "_Kette":
        return self

    def insert(self, zeile: dict) -> "_Kette":
        self._db.eingefuegt.append((self._tabelle, zeile))
        return self

    def eq(self, feld: str, wert: Any) -> "_Kette":
        self._filter.append((feld, wert))
        return self

    def in_(self, feld: str, werte: list) -> "_Kette":
        self._filter.append((feld, werte))
        return self

    def limit(self, _n: int) -> "_Kette":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._db.tabellen.get(self._tabelle, []))


class _DB:  # pylint: disable=too-few-public-methods
    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen
        self.eingefuegt: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Kette:
        return _Kette(self, name)


def _db(**over: Any) -> _DB:
    basis: dict[str, list[dict]] = {
        # Zwei aus der Leitung, eine Reinigungskraft — die Rollenfilterung
        # passiert in der Abfrage, der Fake liefert das gefilterte Ergebnis.
        "users": [
            {"id": "u-admin", "email": "a@b.de", "preferred_language": "de"},
            {"id": "u-co", "email": "c@b.de", "preferred_language": "de"},
        ],
        "notifications": [],
    }
    basis.update(over)
    return _DB(basis)


@pytest.fixture(autouse=True)
def _ohne_versand(monkeypatch: pytest.MonkeyPatch) -> None:
    """Kein echter Mail-/SMS-Versand in den Tests.

    Ohne das laeuft jeder Fall in die Zustell-Timeouts der Fremddienste — die
    Suite brauchte damit 55 statt 0,5 Sekunden. Geprueft wird hier die Glocke,
    also genau die Zeile in `notifications`.
    """
    import src.features.notification_settings.dispatcher as d  # noqa: PLC0415

    monkeypatch.setattr(
        d.NotificationDispatcher, "_sende_kanal", lambda *a, **k: None
    )


def _glocken(db: _DB) -> list[dict]:
    return [z for t, z in db.eingefuegt if t == "notifications"]


def test_meldung_geht_an_die_betriebsleitung() -> None:
    """Jeder aus der Leitung bekommt die Meldung — genau einmal."""
    db = _db()
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT,
        thread_id=THREAD,
        absender="Anna Berg",
        vorschau="Wann koennen wir einchecken?",
    )
    zeilen = _glocken(db)
    assert {z["user_id"] for z in zeilen} == {"u-admin", "u-co"}
    assert all(z["kategorie"] == "messages" for z in zeilen)


def test_meldung_traegt_den_thread_bezug() -> None:
    """`thread_ref` ist der Grund für 0406: ohne ihn kann das Lesen die
    Meldung nicht stilllegen."""
    db = _db()
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT,
        thread_id=THREAD,
        absender="Anna Berg",
        vorschau="Hallo",
    )
    zeile = _glocken(db)[0]
    assert zeile["thread_ref"] == THREAD
    assert zeile["ziel_pfad"] == f"/posteingang/{THREAD}"


def test_entdopplung_ueber_den_thread_nicht_die_nachricht() -> None:
    """Drei Nachrichten hintereinander sind EIN offener Vorgang.

    Der `dedup_key` nennt deshalb den Thread. Trüge er die Nachricht-ID,
    stünden nach einem Gespräch fünf Glocken für dieselbe Konversation.
    """
    db = _db()
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT, thread_id=THREAD, absender="A", vorschau="x",
    )
    assert _glocken(db)[0]["dedup_key"] == f"nachricht:{THREAD}"


def test_ohne_absender_meldet_es_trotzdem() -> None:
    """Fehlt der Name, ist die Meldung immer noch besser als keine."""
    db = _db()
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT, thread_id=THREAD, absender=None, vorschau=None,
    )
    zeile = _glocken(db)[0]
    assert zeile["titel"] == "Neue Gastnachricht"


def test_vorschau_wird_gekuerzt() -> None:
    """Die Glocke ist eine Zeile, kein Nachrichtenfenster."""
    db = _db()
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT, thread_id=THREAD, absender="A", vorschau="x" * 500,
    )
    assert len(_glocken(db)[0]["text"] or "") <= 140


def test_ohne_empfaenger_passiert_nichts() -> None:
    """Kein Leitungszugang → keine Meldung, kein Fehler (fail-closed)."""
    db = _db(users=[])
    melde_gastnachricht(
        db,  # type: ignore[arg-type]
        tenant_id=TENANT, thread_id=THREAD, absender="A", vorschau="x",
    )
    assert _glocken(db) == []


def test_fehler_kippt_den_eingang_nicht() -> None:
    """Der Nachrichteneingang ist die Hauptsache — die Meldung ist Beiwerk.

    Wirft die Zustellung, darf das nicht bis in den Ingest durchschlagen:
    sonst verlöre der Betrieb die Nachricht selbst statt nur ihrer Meldung.
    """

    class _Kaputt:  # pylint: disable=too-few-public-methods
        def table(self, _name: str) -> Any:
            raise RuntimeError("DB weg")

    melde_gastnachricht(
        _Kaputt(),  # type: ignore[arg-type]
        tenant_id=TENANT, thread_id=THREAD, absender="A", vorschau="x",
    )  # kein raise = bestanden
