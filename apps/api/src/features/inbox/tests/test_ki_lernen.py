"""Tests des Auto-Lernens aus gesendeten Nachrichten.

Der teuerste Fehler hier ist NICHT ein verpasster Fakt, sondern ein gelernter
aus der falschen Quelle: Lernt die KI aus ihren EIGENEN Antworten, schreibt sie
ihre Formulierungen als „Fakten" fort und verstärkt jeden Fehler, den sie einmal
gemacht hat. Aus einer falschen Antwort würde binnen Wochen ein Bestand
falscher Fakten, die alle richtig aussehen.

Der zweite ist eine fehlende Dublettenprüfung: das WLAN-Passwort stünde nach
zwanzig Antworten zwanzigmal da, jedes Mal etwas anders formuliert.
"""

from __future__ import annotations

import pytest

from src.core.ki import KiAntwort, KiError
from src.features.inbox.ki_lernen import (
    MAX_JE_NACHRICHT,
    MIN_ZEICHEN,
    QUELLEN_ZUM_LERNEN,
    _ist_dublette,
    _json_liste,
    aus_nachricht_lernen,
)


class _Res:
    def __init__(self, data: list) -> None:
        self.data = data
        self.count = len(data)


class _Query:
    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._rows = list(db.tabellen.get(tabelle, []))

    def select(self, *_a, **_k) -> _Query:
        return self

    def eq(self, *_a) -> _Query:
        return self

    def is_(self, *_a) -> _Query:
        return self

    def or_(self, *_a) -> _Query:
        return self

    def limit(self, *_a) -> _Query:
        return self

    def insert(self, werte) -> _Query:
        self._db.inserts.append((self._tabelle, werte))
        liste = werte if isinstance(werte, list) else [werte]
        self._rows = [{**w, "id": f"neu{i}"} for i, w in enumerate(liste)]
        return self

    def execute(self) -> _Res:
        return _Res(self._rows)


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.inserts: list[tuple] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def angelegte_fakten(self) -> list[dict]:
        for tab, werte in self.inserts:
            if tab == "inbox_knowledge_fact":
                return werte if isinstance(werte, list) else [werte]
        return []


class _KiDouble:
    def __init__(self, text: str) -> None:
        self.text = text
        self.aufrufe = 0

    def erzeuge(self, **_k) -> KiAntwort:
        self.aufrufe += 1
        return KiAntwort(
            text=self.text,
            modell="m",
            region="europe-west4",
            tokens_ein=1,
            tokens_aus=1,
            dauer_ms=5,
            abschlussgrund="STOP",
        )


class _KiKaputt(_KiDouble):
    def erzeuge(self, **_k) -> KiAntwort:
        raise KiError("Dienst weg", status_code=502)


def _db(*fakten: str) -> _FakeDb:
    return _FakeDb(
        inbox_knowledge_fact=[{"fact": f} for f in fakten],
        ki_wissen_quelle=[],
        site_ai_usage=[],
    )


_LANG = (
    "Das WLAN heisst MERCUSYS_E4E4, das Passwort steht auf der Rückseite des "
    "Routers im Flur. Der Check-in ist ab 15 Uhr möglich."
)
_EIN_FAKT = '[{"titel":"WLAN","text":"Das WLAN heisst MERCUSYS_E4E4.","kategorie":"ausstattung"}]'


# --- Die Quellen-Sperre: der wichtigste Test ---------------------------------
@pytest.mark.parametrize("quelle", ["ki", "automation", "system", "eingehend"])
def test_fremde_quellen_werden_nicht_gelernt(quelle: str) -> None:
    """Ohne diesen Ausschluss lernt die KI von sich selbst und verstärkt jeden
    eigenen Fehler."""
    ki = _KiDouble(_EIN_FAKT)
    db = _db()
    anzahl = aus_nachricht_lernen(
        db, "t1", text=_LANG, property_id="p1", thread_id="th1",
        quelle=quelle, client=ki,
    )
    assert anzahl == 0
    assert ki.aufrufe == 0  # gar kein bezahlter Aufruf
    assert db.angelegte_fakten() == []


def test_nur_manuell_ist_erlaubt() -> None:
    """Die Menge steht als POSITIVLISTE im Modul: eine neue Quelle lernt nicht
    versehentlich mit, sondern muss bewusst zugelassen werden."""
    assert QUELLEN_ZUM_LERNEN == frozenset({"manuell"})


def test_menschliche_nachricht_wird_gelernt() -> None:
    db = _db()
    anzahl = aus_nachricht_lernen(
        db, "t1", text=_LANG, property_id="p1", thread_id="th1",
        quelle="manuell", client=_KiDouble(_EIN_FAKT),
    )
    assert anzahl == 1
    fakt = db.angelegte_fakten()[0]
    assert fakt["source"] == "message"
    assert fakt["property_id"] == "p1"
    assert fakt["source_ref"] == "th1"


def test_herkunft_wird_festgehalten() -> None:
    """Ohne Quellenzeile stünde später nicht fest, AUS WELCHEM Gespräch ein
    Fakt stammt — ein zweifelhafter Fakt wäre nicht überprüfbar."""
    db = _db()
    aus_nachricht_lernen(
        db, "t1", text=_LANG, property_id="p1", thread_id="th7",
        quelle="manuell", client=_KiDouble(_EIN_FAKT),
    )
    quellen = [w for t, w in db.inserts if t == "ki_wissen_quelle"]
    assert quellen and quellen[0]["art"] == "nachricht"
    assert quellen[0]["thread_id"] == "th7"


# --- Grenzen ----------------------------------------------------------------
def test_kurze_nachricht_kostet_keinen_aufruf() -> None:
    """„Gerne!" trägt kein Wissen — und ein Vertex-Aufruf dafür wäre bezahlt."""
    ki = _KiDouble(_EIN_FAKT)
    assert (
        aus_nachricht_lernen(
            _db(), "t1", text="Gerne!", property_id=None, thread_id="t",
            quelle="manuell", client=ki,
        )
        == 0
    )
    assert ki.aufrufe == 0


def test_grenzwert_der_laenge() -> None:
    ki = _KiDouble("[]")
    aus_nachricht_lernen(
        _db(), "t1", text="x" * (MIN_ZEICHEN - 1), property_id=None,
        thread_id="t", quelle="manuell", client=ki,
    )
    assert ki.aufrufe == 0
    aus_nachricht_lernen(
        _db(), "t1", text="x" * MIN_ZEICHEN, property_id=None,
        thread_id="t", quelle="manuell", client=ki,
    )
    assert ki.aufrufe == 1


def test_hoechstens_fuenf_fakten_je_nachricht() -> None:
    viele = ",".join(
        f'{{"titel":"T{i}","text":"Ein ganz eigener Fakt Nummer {i} ueber Sache {i}.",'
        f'"kategorie":"sonstiges"}}'
        for i in range(MAX_JE_NACHRICHT + 5)
    )
    db = _db()
    anzahl = aus_nachricht_lernen(
        db, "t1", text=_LANG, property_id=None, thread_id="t",
        quelle="manuell", client=_KiDouble(f"[{viele}]"),
    )
    assert anzahl <= MAX_JE_NACHRICHT


# --- Dubletten ---------------------------------------------------------------
def test_bekannter_fakt_wird_nicht_doppelt_angelegt() -> None:
    """Sonst stünde das WLAN-Passwort nach zwanzig Antworten zwanzigmal da."""
    db = _db("Das WLAN heisst MERCUSYS_E4E4.")
    anzahl = aus_nachricht_lernen(
        db, "t1", text=_LANG, property_id="p1", thread_id="t",
        quelle="manuell", client=_KiDouble(_EIN_FAKT),
    )
    assert anzahl == 0


def test_zwei_gleiche_vorschlaege_ergeben_einen_fakt() -> None:
    """Der frisch angelegte Fakt zählt für die nächste Prüfung MIT."""
    doppelt = (
        '[{"titel":"A","text":"Das WLAN heisst MERCUSYS und steht am Router.",'
        '"kategorie":"ausstattung"},'
        '{"titel":"B","text":"Das WLAN heisst MERCUSYS und steht am Router.",'
        '"kategorie":"ausstattung"}]'
    )
    db = _db()
    assert (
        aus_nachricht_lernen(
            db, "t1", text=_LANG, property_id=None, thread_id="t",
            quelle="manuell", client=_KiDouble(doppelt),
        )
        == 1
    )


@pytest.mark.parametrize(
    ("neu", "bestand", "erwartet"),
    [
        ("Das WLAN heisst MERCUSYS.", ["Das WLAN heisst MERCUSYS."], True),
        ("Das WLAN heisst MERCUSYS.", ["Der Strand ist 300 Meter entfernt."], False),
        # Andere Worte, andere Aussage.
        (
            "Der Grill steht auf der Terrasse.",
            ["Die Waschmaschine steht im Keller."],
            False,
        ),
        # Nichts Bedeutungstragendes darin.
        ("Ja ok", [], True),
    ],
)
def test_dublettenpruefung(neu: str, bestand: list[str], erwartet: bool) -> None:
    assert _ist_dublette(neu, bestand) is erwartet


# --- Best effort -------------------------------------------------------------
def test_ki_fehler_kippt_den_versand_nicht() -> None:
    """Die Nachricht ist beim Gast — das ist das Wichtigere. Es darf keine
    Ausnahme aus dem Lernen kommen."""
    assert (
        aus_nachricht_lernen(
            _db(), "t1", text=_LANG, property_id=None, thread_id="t",
            quelle="manuell", client=_KiKaputt(""),
        )
        == 0
    )


def test_kaputte_antwort_ergibt_null_fakten() -> None:
    """Hier bewusst STILL (anders als beim Import): das Lernen läuft im
    Hintergrund hinter einem Versand, eine Ausnahme kippte den Hauptpfad."""
    assert _json_liste("Ich kann das leider nicht.") == []


def test_markdown_zaun_wird_gelesen() -> None:
    assert _json_liste('```json\n[{"a":1}]\n```') == [{"a": 1}]


def test_erfundene_kategorie_wird_zu_sonstiges() -> None:
    db = _db()
    aus_nachricht_lernen(
        db, "t1",
        text=_LANG,
        property_id=None,
        thread_id="t",
        quelle="manuell",
        client=_KiDouble(
            '[{"titel":"T","text":"Der Grill steht auf der hinteren Terrasse.",'
            '"kategorie":"grillen"}]'
        ),
    )
    assert db.angelegte_fakten()[0]["kategorie"] == "sonstiges"
