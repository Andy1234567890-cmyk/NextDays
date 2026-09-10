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
        self._patch: dict | None = None

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

    def lt(self, *_a, **_k) -> _Query:
        # Der Reaper grenzt verwaiste 'sendet'-Zeilen ueber `updated_at` ab.
        # Das Double filtert nicht — geprueft wird, DASS er laeuft, nicht seine
        # Zeitarithmetik (die gehoert zum Client).
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a, **_k) -> _Query:
        return self

    def update(self, werte: dict) -> _Query:
        self._db.updates.append((self._tabelle, werte))
        self._patch = werte
        return self

    def execute(self) -> _Res:
        # Ein `update` quittiert die betroffenen Zeilen — daran haengt das
        # atomare Claim (`if not claimed: return`). Gaebe das Double hier eine
        # leere Liste zurueck, kaeme kein Versand mehr zustande; gaebe es
        # unbesehen Zeilen zurueck, waere ein fehlendes Claim nicht bemerkbar.
        # Es antwortet daher mit den Zeilen, die es hat: der glueckliche Fall
        # claimt erfolgreich, und `_FakeDb(claim_leer=True)` erzwingt den
        # Gegenfall.
        if self._patch is not None and self._db.claim_leer:
            return _Res([])
        return _Res(self._rows)


class _FakeDb:
    def __init__(self, *, claim_leer: bool = False, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.updates: list[tuple[str, dict]] = []
        # `claim_leer=True` spielt den Fall „ein anderer Takt war schneller":
        # das bedingte UPDATE trifft keine Zeile mehr.
        self.claim_leer = claim_leer

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


def test_claim_steht_vor_dem_senden_und_verhindert_doppelversand() -> None:
    """Wurzel 2: Wer die Zeile nicht claimen konnte, sendet NICHT.

    ANLASS (live gemeldet 09.09.2026, „die e-mails gehen auch doppelt raus"):
    Der Versand waehlte `status='wartend'` aus, sendete, und setzte den Status
    ERST DANACH. Zwischen Auswahl und Statuswechsel liegt ein vollstaendiger
    Netzwerk-Roundtrip zum Portal — jeder Takt, der die Zeile in diesem Fenster
    sah, sendete sie erneut. Und Takte gab es mehrere: der Takt lief im
    FastAPI-Lifespan, also je uvicorn-Worker (Vorgabe: vier).

    Hier wird der verlorene Wettlauf gespielt: das bedingte UPDATE trifft keine
    Zeile mehr, weil ein anderer Takt sie bereits auf 'sendet' gesetzt hat.
    Dann darf NICHTS hinausgehen.
    """
    db = _FakeDb(
        claim_leer=True,
        ki_autoantwort_warteschlange=[_wartend()],
        portal_messages=[],
    )
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_ki_autoantworten()

    assert dienst.gesendet == [], "verlorener Claim darf nicht senden"
    assert ergebnis["gesendet"] == 0
    assert ergebnis["uebersprungen"] == 1
    # Und der Claim ist ein Zustandswechsel VOR dem Versand, kein Nachtrag.
    assert ("ki_autoantwort_warteschlange", {
        "status": "sendet",
    }) not in db.updates, "Claim muss `updated_at` mitschreiben (Reaper)"
    claims = [
        w for t, w in db.updates
        if t == "ki_autoantwort_warteschlange" and w.get("status") == "sendet"
    ]
    assert len(claims) == 1 and "updated_at" in claims[0]


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
    # Nach Inhalt suchen, nicht nach Position: der erste Schreibvorgang des
    # Ticks ist der Reaper (verwaiste 'sendet'-Zeilen → 'wartend'), und diese
    # Reihenfolge ist kein Vertrag.
    status = [w for tab, w in db.updates if tab == "ki_autoantwort_warteschlange"]
    assert any(w.get("status") == "abgebrochen" for w in status)


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
        # Zaehler der verlorenen Claims (0617): sichtbar, weil er verraet, wie
        # viele Takte parallel auf derselben Warteschlange arbeiten.
        "uebersprungen": 0,
    }


def test_ohne_db_passiert_nichts() -> None:
    """Der Sandbox-/Testpfad ohne DB darf nicht werfen."""
    dienst = _Dienst(_FakeDb())
    dienst._db = None  # noqa: SLF001
    assert dienst.dispatch_ki_autoantworten()["gesendet"] == 0
    assert dienst.autoantwort_abbrechen("t1", "th1", "egal") == 0
    assert dienst.autoantwort_planen("t1", "th1") is False
