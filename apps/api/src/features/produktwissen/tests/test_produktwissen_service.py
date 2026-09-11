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
    _UEBERBLICK_CACHE,
    MAX_FRAGE_ZEICHEN,
    MINDEST_AEHNLICHKEIT,
    UEBERBLICK_TITEL,
    ProduktwissenService,
    Treffer,
    _ist_allgemeine_frage,
    _ist_rechtsfrage,
    _nach_rang,
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


class _FakeTabelle:
    """Der Kettenaufruf `.select().eq().eq().eq().limit().execute()`."""

    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen

    def select(self, *_a: object, **_k: object) -> _FakeTabelle:
        return self

    def eq(self, *_a: object, **_k: object) -> _FakeTabelle:
        return self

    def limit(self, *_a: object, **_k: object) -> _FakeTabelle:
        return self

    def execute(self) -> Any:
        zeilen = self._zeilen

        class _Res:
            data = zeilen

        return _Res()


class _FakeDb:
    """`rpc` für die Suche, `table` für den Produktüberblick.

    `table` GEHÖRT HIERHER, auch wenn die Tests ohne es grün liefen: der
    Service fängt dort `Exception` ab (Auskunft ohne Rahmen ist besser als
    keine). Eine Fake-DB ohne `table` hätte diesen Pfad also nie geprüft,
    sondern nur bewiesen, dass der AttributeError geschluckt wird — genau die
    Sorte grüner Test, die nichts zusagt (Wurzel 5).
    """

    def __init__(
        self,
        zeilen: list[dict[str, Any]] | None = None,
        ueberblick: str | None = None,
    ) -> None:
        self.zeilen = zeilen or []
        self.rpc_argumente: list[dict[str, Any]] = []
        self._ueberblick = ueberblick
        self.table_aufrufe = 0

    def table(self, _name: str) -> _FakeTabelle:
        self.table_aufrufe += 1
        zeilen = [{"inhalt": self._ueberblick}] if self._ueberblick else []
        return _FakeTabelle(zeilen)

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
    ueberblick: str | None = None,
) -> tuple[ProduktwissenService, _FakeDb, _FakeText, _FakeEinbettung]:
    _UEBERBLICK_CACHE.clear()
    db = _FakeDb(zeilen, ueberblick=ueberblick)
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


# ─────────────────────────────────────────────────────────────────────────────
# Rangfolge: Rechtstexte hinter die Produktauskunft
#
# ANLASS (11.09.2026): „Was kann eure Software alles?" lieferte auf FÜNF von
# sechs Plätzen AGB- und Datenschutz-Abschnitte und keine einzige
# Funktionsseite. Die Rechtstexte sind die größte Quelle (72 Abschnitte je
# Sprache), und AGB § 2 ist eine dichte Aufzählung des Leistungsumfangs — für
# eine Vektorsuche klingt sie wie die Antwort, für den Fragenden ist sie
# Vertragsrecht statt Produktauskunft.
# ─────────────────────────────────────────────────────────────────────────────


def _t(quelle: str, aehnlichkeit: float, titel: str = "x") -> Treffer:
    return Treffer(
        quelle=quelle,
        quelle_id=titel,
        titel=titel,
        inhalt="Inhalt",
        pfad=None,
        aehnlichkeit=aehnlichkeit,
    )


def test_rechtstext_weicht_der_produktauskunft() -> None:
    """Der reale Fall: Rechtstext knapp vorn, Produktseite knapp dahinter."""
    geordnet = _nach_rang(
        [_t("legal", 0.683, "AGB § 2"), _t("funktion", 0.662, "Property-Management")],
        rechtsfrage=False,
    )

    assert geordnet[0].titel == "Property-Management"


def test_bei_einer_rechtsfrage_bleibt_die_reihenfolge() -> None:
    """„Ist das DSGVO-konform?" soll den Rechtstext bekommen, nicht die App."""
    treffer = [_t("legal", 0.683, "AVV"), _t("funktion", 0.662, "App")]

    assert _nach_rang(treffer, rechtsfrage=True) == treffer


def test_deutlich_besserer_rechtstext_bleibt_vorn() -> None:
    """Der Abschlag dreht knappe Fälle, nicht klare.

    Sonst bekäme „Wie kündige ich?" die App-Seite statt der Kündigungsregel.
    """
    geordnet = _nach_rang(
        [_t("legal", 0.80, "Kündigung"), _t("funktion", 0.70, "App")],
        rechtsfrage=False,
    )

    assert geordnet[0].titel == "Kündigung"


def test_kein_treffer_geht_beim_umsortieren_verloren() -> None:
    """Die Rangfolge ist eine Reihenfolge, keine Auswahl."""
    treffer = [_t("legal", 0.9), _t("faq", 0.8), _t("hilfe", 0.7)]

    assert sorted(t.aehnlichkeit for t in _nach_rang(treffer, rechtsfrage=False)) == [
        0.7,
        0.8,
        0.9,
    ]


@pytest.mark.parametrize(
    "frage",
    [
        "Ist das DSGVO-konform?",
        "Gibt es einen AV-Vertrag?",
        "Wie kündige ich meinen Vertrag?",
        "Where are your servers?",
        "What are your terms?",
        "Hvordan opsiger jeg aftalen?",
    ],
)
def test_rechtsfragen_werden_erkannt(frage: str) -> None:
    assert _ist_rechtsfrage(frage) is True


@pytest.mark.parametrize(
    "frage",
    [
        "Wie verbinde ich Airbnb?",
        "Was kann eure Software alles?",
        "Kann ich Dynamic Pricing nutzen?",
    ],
)
def test_produktfragen_sind_keine_rechtsfragen(frage: str) -> None:
    assert _ist_rechtsfrage(frage) is False


# ─────────────────────────────────────────────────────────────────────────────
# Der Produktüberblick hängt an JEDER Antwort
#
# ANLASS (11.09.2026): „kannst du mir das tool erklären" fand drei
# Entwickler-Artikel und den Website-Baukasten — das Wort „Tool" zieht zu
# „Fragen, Änderungen, WERKZEUGE". Der Bot antwortete daraufhin, myNextDays
# helfe „deine Website zu erstellen und zu verwalten": aus vier fachlich
# korrekten Auszügen eine falsche Gesamtaussage über das Produkt.
#
# Eine Vektorsuche kann das nicht lösen — sie findet Ähnlichkeit, und eine
# allgemeine Frage ähnelt allem ein bisschen. Der Rahmen gehört deshalb fest
# dazu, nicht in den Wettbewerb um sechs Plätze.
# ─────────────────────────────────────────────────────────────────────────────


def test_ueberblick_steht_im_prompt() -> None:
    s, _db, text, _e = _service(
        [_treffer(aehnlich=0.9)],
        ueberblick="myNextDays ist ein PMS und ein Channel-Manager.",
    )

    s.antworten("kannst du mir das tool erklären", sprache="de")

    prompt = text.aufrufe[0]["user"]
    assert "[myNextDays im Überblick]" in prompt
    assert "myNextDays ist ein PMS und ein Channel-Manager." in prompt


def test_ohne_ueberblick_antwortet_der_bot_trotzdem() -> None:
    """Eine fehlende Übersicht darf die Auskunft nicht verhindern.

    Neue Sprache, Wissen noch nicht aufgebaut: dann eben ohne Rahmen — aber
    keine erfundene Produktbeschreibung (Wurzel 4).
    """
    s, _db, text, _e = _service([_treffer(aehnlich=0.9)], ueberblick=None)

    antwort = s.antworten("Wie verbinde ich Airbnb?", sprache="de")

    assert antwort.uebergeben is False
    assert "[myNextDays im Überblick]" not in text.aufrufe[0]["user"]


def test_ueberblick_wird_nur_einmal_je_sprache_geholt() -> None:
    """Sonst eine Datenbankabfrage je Besucherfrage für einen festen Text."""
    s, db, _t, _e = _service([_treffer(aehnlich=0.9)], ueberblick="Überblick")

    s.antworten("Frage eins", sprache="de")
    s.antworten("Frage zwei", sprache="de")

    assert db.table_aufrufe == 1


def test_ohne_treffer_wird_das_modell_auch_mit_ueberblick_nicht_gefragt() -> None:
    """Der Überblick darf die Übergabe nicht aushebeln.

    Sonst beantwortete der Bot „Wie ist das Wetter?" aus der Produktübersicht,
    statt an den Support zu übergeben.
    """
    s, _db, text, _e = _service([], ueberblick="Überblick")

    antwort = s.antworten("Wie ist das Wetter?", sprache="de")

    assert antwort.uebergeben is True
    assert text.aufrufe == []


def test_ueberblick_erscheint_auch_als_quelle() -> None:
    """Sonst nennt die Antwort den Überblick und verlinkt Fremdes.

    Live gesehen (11.09.2026): der Text kam aus der Produktübersicht, darunter
    standen drei Entwickler-Artikel, in denen nichts davon steht.
    """
    s, _db, _t, _e = _service([_treffer(aehnlich=0.9)], ueberblick="Überblick")

    antwort = s.antworten("erklär mir das tool", sprache="de")

    titel = [q.titel for q in antwort.quellen]
    assert UEBERBLICK_TITEL in titel
    pfade = [q.pfad for q in antwort.quellen if q.titel == UEBERBLICK_TITEL]
    assert pfade == ["/funktionen"]


@pytest.mark.parametrize(
    "frage",
    [
        "kannst du mir das tool erklären",
        "Was kann eure Software alles?",
        "erkläre mir myNextDays",
        "Welche Funktionen habt ihr?",
        "explain your product",
    ],
)
def test_allgemeine_fragen_werden_erkannt(frage: str) -> None:
    assert _ist_allgemeine_frage(frage) is True


@pytest.mark.parametrize(
    "frage",
    [
        "Wie verbinde ich Airbnb?",
        "Kann ich Dynamic Pricing nutzen?",
        "Wie lege ich ein Objekt an?",
        "Wie funktioniert die Eigentümer-Abrechnung?",
    ],
)
def test_konkrete_fragen_sind_nicht_allgemein(frage: str) -> None:
    """Sonst hinge unter jeder Antwort eine siebte, unpassende Quelle."""
    assert _ist_allgemeine_frage(frage) is False


def test_bei_konkreter_frage_steht_der_ueberblick_nur_im_prompt() -> None:
    """Im Prompt ja (verhindert falsche Gesamtaussagen), als Quelle nein."""
    s, _db, text, _e = _service([_treffer(aehnlich=0.9)], ueberblick="Überblick")

    antwort = s.antworten("Wie verbinde ich Airbnb?", sprache="de")

    assert UEBERBLICK_TITEL in text.aufrufe[0]["user"]
    assert UEBERBLICK_TITEL not in [q.titel for q in antwort.quellen]
