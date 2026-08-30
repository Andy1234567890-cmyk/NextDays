"""Tests der automatischen Antwort — vor allem der Gegenzustände.

Die Verzögerung vor dem Versand ist nur so viel wert wie das Abräumen danach:
Wer sie einbaut, aber die wartende Zeile nicht verwirft, sobald ein Mensch
antwortet, hat nichts gewonnen — der Gast bekommt dann beide Antworten. Genau
das prüfen die Tests hier (Wurzel 1).

Dazu die zwei Fälle, in denen NICHT gesendet wird, obwohl alles eingeschaltet
ist: eine Antwort, die eine Wissenslücke meldet (die ist an den Betrieb
gerichtet, nicht an den Gast), und eine Zeile, die zu lange lag.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from src.features.inbox.ki_autoantwort import (
    MAX_VERSPAETUNG_STUNDEN,
    KiAutoantwortMixin,
)


class _Res:
    def __init__(self, data: list) -> None:
        self.data = data


class _Query:
    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._rows = list(db.tabellen.get(tabelle, []))

    def select(self, *_a, **_k) -> _Query:
        return self

    def eq(self, *_a, **_k) -> _Query:
        return self

    def is_(self, *_a, **_k) -> _Query:
        return self

    def gt(self, *_a, **_k) -> _Query:
        return self

    def lte(self, *_a, **_k) -> _Query:
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a, **_k) -> _Query:
        return self

    def update(self, werte: dict) -> _Query:
        self._db.updates.append((self._tabelle, werte))
        return self

    def execute(self) -> _Res:
        return _Res(self._rows)


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.updates: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Dienst(KiAutoantwortMixin):
    """Nur das Mixin, mit einer Fake-DB und einem zählbaren Versand."""

    def __init__(self, db: _FakeDb) -> None:
        self._db = db
        self.gesendet: list[tuple[str, str]] = []

    def _autoantwort_senden(
        self, tenant_id: str, thread_id: str, quelle: str, text: str
    ) -> None:
        self.gesendet.append((thread_id, text))


def _wartend(**felder: object) -> dict:
    jetzt = datetime.now(UTC)
    basis = {
        "id": "w1",
        "tenant_id": "t1",
        "thread_id": "th1",
        "quelle": "inbox",
        "regel_id": None,
        "frage": "Wie ist das WLAN?",
        "antwort": "Das WLAN heißt Gast2024.",
        "send_at": (jetzt - timedelta(minutes=1)).isoformat(),
        "status": "wartend",
        "created_at": (jetzt - timedelta(minutes=6)).isoformat(),
    }
    return {**basis, **felder}


# --- Der glückliche Fall ----------------------------------------------------
def test_faellige_antwort_geht_hinaus() -> None:
    db = _FakeDb(ki_autoantwort_warteschlange=[_wartend()], portal_messages=[])
    dienst = _Dienst(db)
    ergebnis = dienst.dispatch_ki_autoantworten()
    assert ergebnis["gesendet"] == 1
    assert dienst.gesendet == [("th1", "Das WLAN heißt Gast2024.")]


# --- Die Gegenzustände ------------------------------------------------------
def test_neue_nachricht_im_thread_verhindert_den_versand() -> None:
    """Der Kern von Wurzel 1: hat sich der Thread bewegt, passt die Antwort nicht.

    Entweder hat ein Mensch geantwortet (dann wäre die KI-Antwort die zweite),
    oder der Gast hat nachgeschoben (dann beantwortet sie die falsche Frage).
    """
    db = _FakeDb(
        ki_autoantwort_warteschlange=[_wartend()],
        # Irgendeine neuere Zeile — das Double filtert nicht, das Vorhandensein
        # allein bildet „es kam etwas dazu" ab.
        portal_messages=[{"id": "m9"}],
    )
    dienst = _Dienst(db)
    ergebnis = dienst.dispatch_ki_autoantworten()
    assert ergebnis["abgebrochen"] == 1
    assert dienst.gesendet == []
    status = [w for tab, w in db.updates if tab == "ki_autoantwort_warteschlange"]
    assert status and status[0]["status"] == "abgebrochen"


def test_zu_spaete_antwort_wird_verworfen() -> None:
    """Nach einem Rückstau ist eine Antwort keine Antwort mehr, sondern Verwirrung."""
    zu_alt = datetime.now(UTC) - timedelta(hours=MAX_VERSPAETUNG_STUNDEN + 1)
    db = _FakeDb(
        ki_autoantwort_warteschlange=[_wartend(send_at=zu_alt.isoformat())],
        portal_messages=[],
    )
    dienst = _Dienst(db)
    ergebnis = dienst.dispatch_ki_autoantworten()
    assert ergebnis["abgebrochen"] == 1
    assert dienst.gesendet == []


def test_abbruch_setzt_status_und_grund() -> None:
    db = _FakeDb(ki_autoantwort_warteschlange=[_wartend()])
    dienst = _Dienst(db)
    dienst.autoantwort_abbrechen("t1", "th1", "Mensch hat geantwortet")
    tabelle, werte = db.updates[0]
    assert tabelle == "ki_autoantwort_warteschlange"
    assert werte["status"] == "abgebrochen"
    assert werte["abbruch_grund"] == "Mensch hat geantwortet"


def test_bewegungspruefung_ist_fail_closed() -> None:
    """Kann nicht geprüft werden, wird NICHT gesendet.

    Eine ausbleibende Antwort ist eine Rückfrage, eine doppelte ist peinlich.
    """

    from postgrest.exceptions import APIError

    class _ApiKaputt(_FakeDb):
        def table(self, name: str) -> _Query:
            if name == "portal_messages":
                raise APIError({"message": "weg"})
            return super().table(name)

    db = _ApiKaputt(ki_autoantwort_warteschlange=[_wartend()])
    dienst = _Dienst(db)
    ergebnis = dienst.dispatch_ki_autoantworten()
    assert ergebnis["gesendet"] == 0
    assert dienst.gesendet == []


# --- Leerlauf ---------------------------------------------------------------
def test_leere_warteschlange_ist_kein_fehler() -> None:
    dienst = _Dienst(_FakeDb(ki_autoantwort_warteschlange=[]))
    assert dienst.dispatch_ki_autoantworten() == {
        "gesendet": 0,
        "abgebrochen": 0,
        "fehler": 0,
    }


def test_ohne_db_passiert_nichts() -> None:
    """Der Sandbox-/Testpfad ohne DB darf nicht werfen."""
    dienst = _Dienst(_FakeDb())
    dienst._db = None  # noqa: SLF001
    assert dienst.dispatch_ki_autoantworten()["gesendet"] == 0
    assert dienst.autoantwort_abbrechen("t1", "th1", "egal") == 0
    assert dienst.autoantwort_planen("t1", "th1") is False
