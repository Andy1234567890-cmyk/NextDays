"""Tests der Eskalation und der beiden Markierungszeilen.

Der teuerste Fehler hier ist eine Markierungszeile, die an einen GAST geht:
„[FEHLENDE ANGABE: Parkmöglichkeiten] Ich reiche das nach" liest sich wie ein
Systemfehler und ist genau der Eindruck, den eine KI-Antwort nie machen darf.

Der zweite ist eine Eskalation, die zweimal meldet: bei einem hin- und
hergehenden Beschwerdegespräch bekäme der Betrieb eine Mail je Nachricht und
schaltete danach die Kategorie ab — also ausgerechnet die Meldung, die zählt.
"""

from __future__ import annotations

import pytest
from postgrest.exceptions import APIError

from src.features.inbox.errors import InboxError
from src.features.inbox.ki_antwort import (
    luecke_trennen,
    markierungen_trennen,
    stimmung_trennen,
)
from src.features.inbox.ki_eskalation import KiEskalationMixin


# --- Die Markierungszeilen --------------------------------------------------
@pytest.mark.parametrize(
    ("roh", "text", "was"),
    [
        (
            "[FEHLENDE ANGABE: Ladestation] Ich reiche das nach.",
            "Ich reiche das nach.",
            "Ladestation",
        ),
        ("[fehlende angabe: Parkplatz]\nHallo", "Hallo", "Parkplatz"),
        ("[ FEHLENDE  ANGABE : WLAN ] Text", "Text", "WLAN"),
        ("Das WLAN heißt Gast2024.", "Das WLAN heißt Gast2024.", None),
        # Mitten im Text ist es KEINE Markierung — nur am Anfang.
        ("Hallo [FEHLENDE ANGABE: x]", "Hallo [FEHLENDE ANGABE: x]", None),
        ("", "", None),
    ],
)
def test_luecke_trennen(roh: str, text: str, was: str | None) -> None:
    assert luecke_trennen(roh) == (text, was)


@pytest.mark.parametrize(
    ("roh", "text", "grund"),
    [
        (
            "[STIMMUNG NEGATIV: kein warmes Wasser] Es tut mir leid.",
            "Es tut mir leid.",
            "kein warmes Wasser",
        ),
        ("Gerne, das WLAN heißt X.", "Gerne, das WLAN heißt X.", None),
    ],
)
def test_stimmung_trennen(roh: str, text: str, grund: str | None) -> None:
    assert stimmung_trennen(roh) == (text, grund)


def test_beide_zeilen_in_beliebiger_reihenfolge() -> None:
    """Der Grund, warum es EINEN Helfer gibt und kein `startswith`: stünde die
    Stimmungszeile zuerst, hätte ein `startswith("[FEHLENDE ANGABE")` die
    Wissenslücke übersehen — und BEIDE Markierungen wären an den Gast
    gegangen."""
    a = "[FEHLENDE ANGABE: Ladestation][STIMMUNG NEGATIV: verärgert] Text"
    b = "[STIMMUNG NEGATIV: verärgert][FEHLENDE ANGABE: Ladestation] Text"
    assert markierungen_trennen(a) == ("Text", "Ladestation", "verärgert")
    assert markierungen_trennen(b) == ("Text", "Ladestation", "verärgert")


def test_ohne_markierung_bleibt_der_text_ganz() -> None:
    assert markierungen_trennen("Das WLAN heißt X.") == ("Das WLAN heißt X.", None, None)


# --- Das Setzen -------------------------------------------------------------
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

    def eq(self, *_a) -> _Query:
        return self

    def is_(self, *_a) -> _Query:
        return self

    def in_(self, *_a) -> _Query:
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a) -> _Query:
        return self

    def insert(self, werte: dict) -> _Query:
        if self._db.doppelt:
            raise APIError({"code": "23505", "message": "duplicate key"})
        self._db.inserts.append((self._tabelle, werte))
        return self

    def update(self, werte: dict) -> _Query:
        self._db.updates.append((self._tabelle, werte))
        return self

    def execute(self) -> _Res:
        return _Res(self._rows)


class _FakeDb:
    def __init__(self, doppelt: bool = False, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.doppelt = doppelt
        self.inserts: list[tuple] = []
        self.updates: list[tuple] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Ctx:
    tenant_id = "t1"
    user_id = "u1"


class _Cron:
    tenant_id = "t1"
    user_id = "cron"


class _Dienst(KiEskalationMixin):
    def __init__(self, db: _FakeDb) -> None:
        self._db = db
        self.meldungen: list[str] = []

    def _require(self, ctx):  # noqa: ANN001
        return self._db, ctx.tenant_id


def _dienst(doppelt: bool = False, **tab) -> tuple[_Dienst, _FakeDb]:
    db = _FakeDb(doppelt=doppelt, ki_eskalation=tab.get("ki_eskalation", []))
    return _Dienst(db), db


def test_eskalation_wird_gesetzt() -> None:
    dienst, db = _dienst()
    neu = dienst.eskalation_setzen(
        db, "t1", thread_id="th1", quelle="inbox", ausloeser="stimmung",
        grund="Gast ist verärgert über fehlendes warmes Wasser",
    )
    assert neu is True
    tab, werte = db.inserts[0]
    assert tab == "ki_eskalation"
    assert werte["ausloeser"] == "stimmung"
    assert werte["thread_id"] == "th1"


def test_zweite_eskalation_desselben_threads_meldet_nicht_erneut() -> None:
    """Der partielle UNIQUE aus 0498 greift — und das ist der Normalfall bei
    einem Beschwerdegespräch, kein Fehler (Wurzel 2)."""
    dienst, _db = _dienst(doppelt=True)
    assert (
        dienst.eskalation_setzen(
            db=_FakeDb(doppelt=True, ki_eskalation=[]),
            tenant_id="t1",
            thread_id="th1",
            quelle="inbox",
            ausloeser="stimmung",
            grund="nochmal verärgert",
        )
        is False
    )


def test_fremder_db_fehler_wird_durchgereicht() -> None:
    """Nur 23505 ist der erwartete Fall. Alles andere darf NICHT als „schon
    eskaliert" durchgehen — sonst verschluckt der Zweig einen echten Fehler
    (Wurzel 5)."""

    class _Kaputt(_FakeDb):
        def table(self, name: str):  # noqa: ANN201
            class _Q(_Query):
                def insert(self, werte):  # noqa: ANN001, ANN202
                    raise APIError({"code": "42P01", "message": "no table"})

            return _Q(self, name)

    db = _Kaputt(ki_eskalation=[])
    with pytest.raises(APIError):
        _Dienst(db).eskalation_setzen(
            db, "t1", thread_id="th1", quelle="inbox",
            ausloeser="stimmung", grund="x",
        )


def test_eskalation_ohne_grund_wird_nicht_gesetzt() -> None:
    """Ein rotes Abzeichen ohne Aussage ist schlimmer als keines."""
    dienst, db = _dienst()
    assert (
        dienst.eskalation_setzen(
            db, "t1", thread_id="th1", quelle="inbox",
            ausloeser="stimmung", grund="   ",
        )
        is False
    )
    assert db.inserts == []


# --- Zurücknehmen -----------------------------------------------------------
def test_erledigen_setzt_beide_felder() -> None:
    """Der CHECK in 0498 verlangt `erledigt_at` UND `erledigt_von` — eine halbe
    Erledigung ist ein Datenfehler."""
    dienst, db = _dienst(ki_eskalation=[{"id": "e1"}])
    dienst.eskalation_erledigen(_Ctx(), "th1")
    _tab, werte = db.updates[0]
    assert werte["erledigt_at"] and werte["erledigt_von"] == "u1"


def test_cron_darf_nicht_erledigen() -> None:
    """Eine Eskalation erklärt ein MENSCH für erledigt. Ein automatisches
    Abräumen wäre genau die Markierung ohne Aufgabe, die diese Tabelle
    vermeiden soll."""
    dienst, _ = _dienst(ki_eskalation=[{"id": "e1"}])
    with pytest.raises(InboxError) as exc:
        dienst.eskalation_erledigen(_Cron(), "th1")
    assert exc.value.status_code == 403


def test_erledigen_ohne_offene_eskalation_ist_404() -> None:
    dienst, _ = _dienst(ki_eskalation=[])
    with pytest.raises(InboxError) as exc:
        dienst.eskalation_erledigen(_Ctx(), "th1")
    assert exc.value.status_code == 404


# --- Lesen ------------------------------------------------------------------
def test_liste_der_offenen() -> None:
    dienst, _ = _dienst(
        ki_eskalation=[
            {
                "id": "e1",
                "thread_id": "th1",
                "quelle": "inbox",
                "ausloeser": "stimmung",
                "regel_id": None,
                "grund": "verärgert",
                "nachricht_auszug": None,
                "created_at": "2026-08-30T10:00:00Z",
            }
        ]
    )
    liste = dienst.eskalationen_offen(_Ctx())
    assert liste.total == 1
    assert liste.items[0].grund == "verärgert"


def test_leere_id_liste_fragt_die_db_gar_nicht() -> None:
    dienst, db = _dienst()
    assert dienst.eskalierte_thread_ids(db, "t1", []) == set()
    assert db.inserts == [] and db.updates == []


# --- Schema-Vertrag ---------------------------------------------------------
def test_testantwort_ohne_grund_ist_gueltig() -> None:
    """`zustellart_entscheiden` gibt `grund=None` zurück, wenn NICHTS
    verhindert wurde — das ist der Normalfall, kein Fehler.

    Live am 30.08.2026: `grund: str` im Schema warf einen ValidationError, und
    der Test-Endpunkt antwortete mit 500, obwohl die Antwort fertig war. Ein
    Pflichtfeld, das die Quelle gar nicht immer füllt, ist ein Vertragsbruch
    im Schema, nicht in der Logik.
    """
    from src.features.inbox.schemas import KiKontextAntwort, KiTestAntwort

    antwort = KiTestAntwort(
        antwort="Das WLAN heißt Gast2024.",
        kontext=KiKontextAntwort(),
        zustellart="automatisch",
    )
    assert antwort.grund is None
