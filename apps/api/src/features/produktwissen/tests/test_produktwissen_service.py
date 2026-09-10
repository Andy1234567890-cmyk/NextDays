"""Tests des Produktberaters.

WAS HIER GEPRÜFT WIRD und was nicht: Die Trefferqualität der Vektorsuche ist
nicht mit Unit-Tests zu prüfen — sie hängt am Embedding-Modell und am echten
Bestand. Gemessen wurde sie live (10.09.2026): 10 echte Produktfragen trafen
0,672–0,889, 8 themenfremde 0,528–0,609, die Schwelle 0,64 liegt sauber
dazwischen.

Diese Tests sichern das VERHALTEN um die Suche herum, und zwar genau die
Stellen, an denen ein Fehler still bliebe:
* Ohne Treffer darf das Modell NICHT gefragt werden (sonst antwortet es aus
  Allgemeinwissen — plausibel und über unsere Software falsch).
* Der Ausfall des KI-Dienstes muss zur Übergabe führen, nicht zu einem 500.
* Die Frage des Besuchers muss gedeckelt in den Prompt gehen (Wurzel 8).
* Die Zielsprache muss im Prompt stehen, sonst antwortet das Modell in der
  Sprache der Auszüge — live so passiert.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from src.core.ki import KiError
from src.features.produktwissen.service import (
    MAX_FRAGE_ZEICHEN,
    MINDEST_AEHNLICHKEIT,
    ProduktwissenService,
)


@dataclass
class _FakeAntwort:
    text: str


class _FakeText:
    """Merkt sich den Prompt, statt Vertex zu rufen."""

    def __init__(self, antwort: str = "Ja, das geht.", fehler: bool = False) -> None:
        self.antwort = antwort
        self.fehler = fehler
        self.aufrufe: list[dict[str, Any]] = []
        self.is_configured = True

    def erzeuge(self, **kwargs: Any) -> _FakeAntwort:
        self.aufrufe.append(kwargs)
        if self.fehler:
            raise KiError("Dienst weg", status_code=502)
        return _FakeAntwort(text=self.antwort)


class _FakeEinbettung:
    def __init__(self) -> None:
        self.is_configured = True
        self.aufgaben: list[str] = []

    def einbetten_eines(self, text: str, *, aufgabe: str) -> list[float]:
        self.aufgaben.append(aufgabe)
        return [0.1] * 768


class _FakeDb:
    """Nur `rpc` — der Service liest nichts anderes."""

    def __init__(self, zeilen: list[dict[str, Any]] | None = None) -> None:
        self.zeilen = zeilen or []
        self.rpc_argumente: list[dict[str, Any]] = []

    def rpc(self, name: str, params: dict[str, Any]) -> Any:
        self.rpc_argumente.append({"name": name, **params})
        zeilen = self.zeilen

        class _Res:
            data = zeilen

        class _Exec:
            def execute(self) -> Any:
                return _Res()

        return _Exec()


def _treffer(titel: str = "Kanalmanager", aehnlich: float = 0.8) -> dict[str, Any]:
    return {
        "quelle": "hilfe",
        "quelle_id": "portale/was-ist-kanalmanager",
        "titel": titel,
        "inhalt": "Der Kanalmanager verteilt Verfügbarkeit an alle Portale.",
        "pfad": "/hilfe/portale/was-ist-kanalmanager",
        "aehnlichkeit": aehnlich,
    }


def _service(
    zeilen: list[dict[str, Any]] | None = None,
    *,
    ki_fehler: bool = False,
    antwort: str = "Ja, das geht.",
) -> tuple[ProduktwissenService, _FakeDb, _FakeText, _FakeEinbettung]:
    db = _FakeDb(zeilen)
    s = ProduktwissenService(db=db)  # type: ignore[arg-type]
    text = _FakeText(antwort=antwort, fehler=ki_fehler)
    einb = _FakeEinbettung()
    s._text = text  # type: ignore[assignment]
    s._einbettung = einb  # type: ignore[assignment]
    return s, db, text, einb


def test_ohne_treffer_wird_das_modell_nicht_gefragt() -> None:
    """Der wichtigste Test: kein Wissen → keine erfundene Antwort.

    Würde das Modell ohne Auszüge gefragt, käme eine plausibel klingende
    Antwort aus seinem Allgemeinwissen über Ferienvermietung — und die wäre
    über MYNEXTDAYS falsch, ohne dass es jemand am Text erkennt.
    """
    s, _db, text, _ = _service(zeilen=[])

    ergebnis = s.antworten("Wie ist das Wetter?", sprache="de")

    assert ergebnis.uebergeben is True
    assert ergebnis.text == ""
    assert ergebnis.quellen == ()
    assert text.aufrufe == [], "Ohne Treffer darf kein KI-Aufruf erfolgen"


def test_mit_treffer_wird_geantwortet_und_quellen_gemeldet() -> None:
    s, _db, text, _ = _service(zeilen=[_treffer()])

    ergebnis = s.antworten("Was ist der Kanalmanager?", sprache="de")

    assert ergebnis.uebergeben is False
    assert ergebnis.text == "Ja, das geht."
    assert len(ergebnis.quellen) == 1
    assert ergebnis.quellen[0].pfad == "/hilfe/portale/was-ist-kanalmanager"
    assert len(text.aufrufe) == 1


def test_ki_ausfall_fuehrt_zur_uebergabe_nicht_zum_fehler() -> None:
    """Ein 502 von Vertex darf den Besucher nicht ohne Weg stehen lassen."""
    s, _db, _text, _ = _service(zeilen=[_treffer()], ki_fehler=True)

    ergebnis = s.antworten("Was ist der Kanalmanager?", sprache="de")

    assert ergebnis.uebergeben is True
    assert ergebnis.text == ""
    # Die Quellen bleiben erhalten: der Besucher kann selbst nachlesen,
    # auch wenn die Formulierung ausgefallen ist.
    assert len(ergebnis.quellen) == 1


def test_leere_antwort_fuehrt_zur_uebergabe() -> None:
    """Ein leerer Text ist kein Erfolg (Wurzel 5: kein stiller Teilerfolg)."""
    s, _db, _text, _ = _service(zeilen=[_treffer()], antwort="   ")

    ergebnis = s.antworten("Was ist der Kanalmanager?", sprache="de")

    assert ergebnis.uebergeben is True


def test_leere_frage_fragt_nichts_ab() -> None:
    s, db, text, _ = _service(zeilen=[_treffer()])

    ergebnis = s.antworten("   ", sprache="de")

    assert ergebnis.uebergeben is True
    assert db.rpc_argumente == [], "Leere Frage darf keine Suche auslösen"
    assert text.aufrufe == []


def test_frage_wird_gedeckelt() -> None:
    """Wurzel 8: Fremdeingabe geht begrenzt in den Prompt."""
    s, _db, text, _ = _service(zeilen=[_treffer()])

    s.antworten("A" * (MAX_FRAGE_ZEICHEN + 500), sprache="de")

    prompt = text.aufrufe[0]["user"]
    assert "A" * MAX_FRAGE_ZEICHEN in prompt
    assert "A" * (MAX_FRAGE_ZEICHEN + 1) not in prompt


def test_zielsprache_steht_im_prompt() -> None:
    """Ohne diese Anweisung antwortet das Modell in der Sprache der Auszüge.

    Live gemessen (10.09.2026): eine englische Frage mit englischem Treffer
    wurde auf Deutsch beantwortet, weil der Systemprompt deutsch ist.
    """
    s, _db, text, _ = _service(zeilen=[_treffer()])

    s.antworten("Do you support multiple currencies?", sprache="en")

    prompt = text.aufrufe[0]["user"]
    assert "ANTWORTSPRACHE: English" in prompt


def test_suche_nutzt_die_query_aufgabe() -> None:
    """RETRIEVAL_QUERY, nicht RETRIEVAL_DOCUMENT.

    Google bettet dieselbe Zeichenkette je Aufgabe anders ein. Wer die Frage
    als Dokument einbettet, verliert Trefferqualität — ohne Fehlermeldung.
    """
    s, _db, _text, einb = _service(zeilen=[_treffer()])

    s.suchen("Was ist der Kanalmanager?", sprache="de")

    assert einb.aufgaben == ["RETRIEVAL_QUERY"]


def test_suche_uebergibt_schwelle_an_die_datenbank() -> None:
    s, db, _text, _ = _service(zeilen=[_treffer()])

    s.suchen("Was ist der Kanalmanager?", sprache="de")

    assert db.rpc_argumente[0]["name"] == "produktwissen_suchen"
    assert db.rpc_argumente[0]["p_mindest_aehnlichkeit"] == MINDEST_AEHNLICHKEIT
    assert db.rpc_argumente[0]["p_sprache"] == "de"


@pytest.mark.parametrize("sprache", ["de", "en", "da", "sv"])
def test_sprache_wird_durchgereicht(sprache: str) -> None:
    """Keine stille Ersetzung auf 'de' (Wurzel 4)."""
    s, db, _text, _ = _service(zeilen=[_treffer()])

    s.suchen("Frage", sprache=sprache)

    assert db.rpc_argumente[0]["p_sprache"] == sprache
