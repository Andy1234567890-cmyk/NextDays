"""Tests der Regelnamen-Uebersetzung (0511).

Geprueft wird, was ohne Modellaufruf entscheidbar ist — und das ist das
Wesentliche: WANN nicht uebersetzt wird. Ein Lauf, der zu viel uebersetzt,
kostet Geld; einer, der eine gepruefte Fassung ueberschreibt, kostet Arbeit.
"""
import pytest

from src.features.tasks.regel_uebersetzung import (
    TaskRegelUebersetzungError,
    namen_in_sprache,
    quelle_hash,
    regel_uebersetzen,
)

_REGEL = {
    "id": "r1",
    "name": "Reng T",
    "description": None,
    "quellsprache": "da",
}


class _KeinModell:
    """Ein Client, der beim ersten Aufruf auffliegt.

    Damit beweisen die Tests nicht nur „keine Fassung entstand", sondern dass
    das Modell gar nicht gefragt wurde — bei 24 Sprachen ist das der
    Unterschied zwischen null und 24 bezahlten Aufrufen.
    """

    is_configured = True

    def erzeuge(self, **_k: object) -> object:  # pragma: no cover
        raise AssertionError("Modellaufruf, der nicht haette passieren duerfen")


class _Db:
    """Minimale Fake-DB: liefert vorgegebene Fassungen, merkt sich Schreiber."""

    def __init__(self, fassungen: list[dict] | None = None) -> None:
        self.fassungen = fassungen or []
        self.geschrieben: list[dict] = []
        self._tabelle = ""

    def table(self, name: str) -> "_Db":
        self._tabelle = name
        return self

    def select(self, *_a: object, **_k: object) -> "_Db":
        return self

    def eq(self, *_a: object, **_k: object) -> "_Db":
        return self

    def in_(self, *_a: object, **_k: object) -> "_Db":
        return self

    def limit(self, *_a: object) -> "_Db":
        return self

    def upsert(self, payload: dict, **_k: object) -> "_Db":
        self.geschrieben.append(payload)
        return self

    def execute(self) -> object:
        class _R:
            def __init__(self, data: list[dict]) -> None:
                self.data = data

        return _R(list(self.fassungen))


def test_hash_haengt_nur_am_text() -> None:
    """Ein anderer Trigger darf keine Fassung veralten lassen.

    Sonst kostete jede Verstellung einer Uhrzeit 23 Modellaufrufe fuer Texte,
    die sich nicht geaendert haben.
    """
    a = quelle_hash({"name": "Reng T", "description": None})
    b = quelle_hash({"name": "Reng T", "description": None, "start_trigger": "x"})
    assert a == b
    c = quelle_hash({"name": "Reng J", "description": None})
    assert a != c


def test_ohne_quellsprache_wird_nicht_geraten() -> None:
    """Der Altbestand hat keine Quellsprache — und bekommt keine geratene.

    „Uebersetze aus dem Deutschen" auf ein daenisches „Vinduer 4-uger" wirft
    keinen Fehler, sondern liefert plausiblen Unsinn. Deshalb bricht der Lauf
    ab, statt zu raten (Wurzel 4).
    """
    with pytest.raises(TaskRegelUebersetzungError, match="Ausgangssprache"):
        regel_uebersetzen(
            _KeinModell(), _Db(), {**_REGEL, "quellsprache": None}, ["de"]
        )


def test_unveraenderter_hash_kostet_keinen_aufruf() -> None:
    """Wurzel 2: ein zweiter Lauf ueber dieselbe Regel macht NICHTS."""
    hash_jetzt = quelle_hash(_REGEL)
    db = _Db([{"sprache": "de", "name": "Reinigung T", "description": None,
               "geprueft": False, "quelle_hash": hash_jetzt}])
    lauf, antworten = regel_uebersetzen(_KeinModell(), db, _REGEL, ["de"])
    assert lauf.unveraendert == ["de"]
    assert lauf.uebersetzt == []
    assert antworten == []
    assert db.geschrieben == []


def test_gepruefte_fassung_wird_nicht_ueberschrieben() -> None:
    """Eine von Hand korrigierte Fassung ist die Wahrheit fuer ihre Sprache.

    Der Hash weicht ab (die Regel wurde umbenannt), also WOLLTE der Lauf
    uebersetzen — der Riegel haelt ihn auf, und die Sprache steht als
    `geschuetzt` in der Antwort statt still zu verschwinden.
    """
    db = _Db([{"sprache": "de", "name": "Endreinigung", "description": None,
               "geprueft": True, "quelle_hash": "veralteter-hash"}])
    lauf, _ = regel_uebersetzen(_KeinModell(), db, _REGEL, ["de"])
    assert lauf.geschuetzt == ["de"]
    assert db.geschrieben == []


def test_ausgangssprache_bekommt_keine_fassung() -> None:
    """Eine Fassung fuer die Quellsprache waere eine zweite Wahrheit.

    Der Name steht dort schon in `task_rules.name`.
    """
    lauf, _ = regel_uebersetzen(_KeinModell(), _Db(), _REGEL, ["da"])
    assert lauf.uebersetzt == []
    assert lauf.unveraendert == []


def test_zu_langer_name_ist_ein_datenfehler() -> None:
    lang = {**_REGEL, "name": "x" * 501}
    with pytest.raises(TaskRegelUebersetzungError, match="zu lang"):
        regel_uebersetzen(_KeinModell(), _Db(), lang, ["de"])


def test_namen_in_sprache_ohne_fassung_bleibt_leer() -> None:
    """Keine Fassung heisst FEHLT, nicht „leerer Name".

    Der Aufrufer faellt dann auf den Originalnamen zurueck. Stuende hier ein
    leerer String, zeigte die Oberflaeche eine leere Beschriftung.
    """
    assert namen_in_sprache(_Db([]), ["r1"], "de") == {}
    # Eine Fassung mit leerem Namen ist ebenfalls keine Fassung.
    db = _Db([{"rule_id": "r1", "name": "   "}])
    assert namen_in_sprache(db, ["r1"], "de") == {}


def test_namen_in_sprache_ohne_ids_fragt_nicht() -> None:
    """Kein Roundtrip fuer eine leere Liste."""
    assert namen_in_sprache(_Db([{"rule_id": "r1", "name": "X"}]), [], "de") == {}
    assert namen_in_sprache(_Db([{"rule_id": "r1", "name": "X"}]), ["r1"], "") == {}
