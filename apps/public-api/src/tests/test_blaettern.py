"""Cursor-Blättern: Ausdruck, Position, Umschlag — und der Beweis am Endpunkt.

Warum das eigene Datei bekommt: Blättern ist die Stelle, an der eine API still
falsch sein kann. Offset überspringt eine Zeile, wenn sich die Liste zwischen
zwei Seiten ändert — niemand bemerkt die eine Buchung, die nie ankam. Die Tests
hier prüfen deshalb nicht nur „es kommt etwas zurück", sondern dass genau die
Fälle greifen, in denen Offset versagt.
"""
from __future__ import annotations

import pytest

from src.core import errors, pagination
from src.core.auth import ApiKontext
from src.v1 import properties as objekte
from src.v1 import tasks as aufgaben

from .fake_db import FakeDB

_CTX = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["properties:read", "tasks:read"],
    property_ids=[],
)


# ---------------------------------------------------------------------------
# Der Ausdruck selbst
# ---------------------------------------------------------------------------
def test_aufsteigend_mit_wert_schliesst_den_null_block_ein() -> None:
    """Bei aufsteigender Ordnung stehen NULLs am Ende — sie gehören also hinter
    jeden Wert. Ohne den `is.null`-Zweig bliebe das Blättern vor den Zeilen ohne
    Sortierwert stehen (Aufgaben ohne Fälligkeit)."""
    a = pagination.keyset_ausdruck("due_at", "2026-09-01", "abc", aufsteigend=True)
    assert a == (
        'due_at.gt."2026-09-01",and(due_at.eq."2026-09-01",id.gt.abc),'
        "due_at.is.null"
    )


def test_absteigend_mit_wert_laesst_den_null_block_weg() -> None:
    """Bei absteigender Ordnung stehen NULLs am Anfang — sie sind schon vorbei.
    Sie einzuschließen würde bereits gelieferte Zeilen erneut ausspielen."""
    a = pagination.keyset_ausdruck("check_in", "2026-09-01", "abc", aufsteigend=False)
    assert a == 'check_in.lt."2026-09-01",and(check_in.eq."2026-09-01",id.lt.abc)'
    assert "is.null" not in a


def test_cursor_im_null_block_blaettert_ueber_die_id() -> None:
    """Steht der Cursor selbst auf NULL, ist der Sortierwert als Kriterium
    verbraucht — weiter geht es nur über die eindeutige ID."""
    a = pagination.keyset_ausdruck("due_at", None, "abc", aufsteigend=True)
    assert a == "and(due_at.is.null,id.gt.abc)"


# ---------------------------------------------------------------------------
# Prüfung der Parameter
# ---------------------------------------------------------------------------
def test_cursor_und_offset_zusammen_sind_422() -> None:
    """Zwei Positionsangaben in einer Anfrage haben keine widerspruchsfreie
    Bedeutung. Eine stillschweigend zu ignorieren wäre schlimmer als der Fehler:
    der Client bekäme eine Seite, die er nicht bestellt hat."""
    with pytest.raises(errors.ApiFehler) as exc:
        pagination.blaettern_pruefen(50, 100, False, "abc")
    assert exc.value.status == 422


def test_cursor_seite_beginnt_bei_null() -> None:
    """Mit Cursor steckt die Position im FILTER. Würde `range` zusätzlich einen
    Offset setzen, übersprünge jede Seite ihre eigenen ersten Zeilen."""
    blatt = pagination.blaettern_pruefen(10, None, False, "abc")
    assert (blatt.range_von, blatt.range_bis) == (0, 10)

    ohne = pagination.blaettern_pruefen(10, 30, False, None)
    assert (ohne.range_von, ohne.range_bis) == (30, 40)


def test_leerer_cursor_gilt_als_keiner() -> None:
    """`?starting_after=` (leer) ist ein häufiger Client-Fehler und soll die
    erste Seite liefern, nicht einen 422 über eine unbekannte ID."""
    assert pagination.blaettern_pruefen(10, None, False, "  ").starting_after is None


# ---------------------------------------------------------------------------
# Umschlag
# ---------------------------------------------------------------------------
def test_next_starting_after_nur_wenn_es_weitergeht() -> None:
    """Fehlt das Feld, ist der Durchgang fertig — daran erkennt der Client das
    Ende, ohne eine Leerseite abholen zu müssen."""
    blatt = pagination.blaettern_pruefen(2, None, False, None)
    voll = pagination.seite_bauen(
        [{"id": "a"}, {"id": "b"}, {"id": "c"}], blatt
    )
    assert voll["pagination"]["has_more"] is True
    # Der Cursor ist die ID der LETZTEN AUSGELIEFERTEN Zeile, nicht der
    # zusätzlich geholten — sonst würde eine Zeile übersprungen.
    assert voll["pagination"]["next_starting_after"] == "b"

    ende = pagination.seite_bauen([{"id": "a"}], blatt)
    assert ende["pagination"]["has_more"] is False
    assert "next_starting_after" not in ende["pagination"]


def test_cursor_position_fremder_id_ist_422() -> None:
    """Eine unbekannte oder fremde ID ergibt einen Fehler, KEINE leere Seite.
    Eine leere Seite läse der Client als „fertig" und bräche den Durchgang ab."""
    db = FakeDB({"properties": [{"id": "p1", "tenant_id": "t1", "title": "A"}]})
    with pytest.raises(errors.ApiFehler) as exc:
        pagination.cursor_position(
            db,  # type: ignore[arg-type]
            "properties",
            cursor_id="gibt-es-nicht",
            tenant_id="t1",
            sortier_spalte="title",
        )
    assert exc.value.status == 422
    assert exc.value.extra["starting_after"] == "gibt-es-nicht"


# ---------------------------------------------------------------------------
# Am Endpunkt: der Fall, in dem Offset versagt
# ---------------------------------------------------------------------------
def _objekt(pid: str, titel: str) -> dict:
    return {
        "id": pid,
        "tenant_id": "t1",
        "title": titel,
        "status": "active",
        "currency": "DKK",
        "max_guests": 2,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "archived_at": None,
    }


@pytest.fixture
def _db(monkeypatch: pytest.MonkeyPatch) -> FakeDB:
    db = FakeDB(
        {
            "properties": [
                _objekt("p2", "Bravo"),
                _objekt("p4", "Delta"),
                _objekt("p1", "Alfa"),
                _objekt("p3", "Charlie"),
            ],
            "property_units": [],
        }
    )
    monkeypatch.setattr(objekte, "service_db", lambda: db)
    monkeypatch.setattr(aufgaben, "service_db", lambda: db)
    monkeypatch.setattr("src.core.db.service_db", lambda: db)
    return db


def test_cursor_ueberspringt_nichts_wenn_vorne_etwas_dazukommt(_db: FakeDB) -> None:
    """DER Grund für Cursor-Blättern.

    Zwischen Seite 1 und Seite 2 kommt ein Objekt dazu, das VOR den bisherigen
    einsortiert wird. Mit `offset=2` läge die zweite Seite dann eine Position
    daneben und würde „Charlie" überspringen. Der Cursor beschreibt keine
    Position, sondern den letzten gesehenen Datensatz — er kann nicht verrutschen.
    """
    seite1 = objekte.liste(_CTX, limit=2)
    titel1 = [o["title"] for o in seite1["data"]]
    assert titel1 == ["Alfa", "Bravo"]
    cursor = seite1["pagination"]["next_starting_after"]
    assert cursor == "p2"

    # Ein neues Objekt schiebt sich VOR die bereits gelieferten.
    _db.speicher["properties"].append(_objekt("p0", "Aaron"))

    seite2 = objekte.liste(_CTX, limit=2, starting_after=cursor)
    titel2 = [o["title"] for o in seite2["data"]]
    assert titel2 == ["Charlie", "Delta"]

    # Gegenprobe, was Offset an derselben Stelle tut: die Liste ist jetzt
    # [Aaron, Alfa, Bravo, Charlie, Delta], also liefert `offset=2` „Bravo"
    # ein ZWEITES Mal — und der Client, der beide Seiten aneinanderhängt, hat
    # Bravo doppelt und würde beim Weiterblättern Delta verlieren.
    mit_offset = objekte.liste(_CTX, limit=2, offset=2)
    titel_offset = [o["title"] for o in mit_offset["data"]]
    assert titel_offset == ["Bravo", "Charlie"]
    assert "Bravo" in titel1 and "Bravo" in titel_offset  # doppelt
    # Der Cursor-Weg liefert dagegen keine Zeile zweimal.
    assert not set(titel1) & set(titel2)


def test_cursor_laeuft_bis_zum_ende_durch(_db: FakeDB) -> None:
    """Ein vollständiger Durchgang liefert jedes Objekt genau einmal."""
    gesehen: list[str] = []
    cursor: str | None = None
    for _ in range(10):  # Schleifenbremse, nicht die erwartete Zahl
        seite = objekte.liste(_CTX, limit=2, starting_after=cursor)
        gesehen.extend(o["title"] for o in seite["data"])
        cursor = seite["pagination"].get("next_starting_after")
        if not cursor:
            break
    assert gesehen == ["Alfa", "Bravo", "Charlie", "Delta"]
    assert len(gesehen) == len(set(gesehen))


def test_aufgaben_ohne_faelligkeit_werden_nicht_verschluckt(_db: FakeDB) -> None:
    """Der NULL-Block muss erreichbar sein.

    Aufgaben ohne `due_at` stehen am Ende. Ein Keyset-Filter ohne
    NULL-Behandlung käme dort nie an: das Blättern würde vor ihnen stehen
    bleiben, und der Client hielte sie für nicht existent.
    """
    _db.speicher["tasks"] = [
        {
            "id": f"t{i}",
            "tenant_id": "t1",
            "property_id": None,
            "title": titel,
            "status": "open",
            "due_at": faellig,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        for i, (titel, faellig) in enumerate(
            [
                ("Früh", "2026-09-01T08:00:00+00:00"),
                ("Später", "2026-09-05T08:00:00+00:00"),
                ("Ohne Termin A", None),
                ("Ohne Termin B", None),
            ]
        )
    ]
    gesehen: list[str] = []
    cursor: str | None = None
    for _ in range(10):
        seite = aufgaben.liste(_CTX, limit=2, starting_after=cursor)
        gesehen.extend(a["title"] for a in seite["data"])
        cursor = seite["pagination"].get("next_starting_after")
        if not cursor:
            break
    assert gesehen == ["Früh", "Später", "Ohne Termin A", "Ohne Termin B"]


# ---------------------------------------------------------------------------
# Welche der beiden Formen greift?
# ---------------------------------------------------------------------------
def test_not_null_spalte_nutzt_die_range_form(_db: FakeDB) -> None:
    """Bei einer NOT-NULL-Sortierspalte MUSS die Grenze als eigener Vergleich
    gesetzt werden — nur so wird sie zum Index-Startpunkt.

    Der Test hält fest, was `EXPLAIN` live zeigt: mit der Grenze steht
    `Index Cond: (tenant_id = … AND title >= 'M')`, ohne sie trägt der Index nur
    den Mandanten und die ganze Bedingung wird nachgefiltert. Fällt die Grenze
    bei einem Umbau weg, bleibt das Ergebnis richtig und wird still langsam —
    genau die Art Regression, die niemand bemerkt.
    """
    blatt = pagination.blaettern_pruefen(2, None, False, "p2")
    protokoll: list[tuple[str, object]] = []

    class _Spion:
        def gte(self, spalte: str, wert: object) -> _Spion:
            protokoll.append(("gte", (spalte, wert)))
            return self

        def lte(self, spalte: str, wert: object) -> _Spion:
            protokoll.append(("lte", (spalte, wert)))
            return self

        def or_(self, ausdruck: str) -> _Spion:
            protokoll.append(("or_", ausdruck))
            return self

    pagination.keyset_anwenden(
        _Spion(), _db, "properties", blatt,  # type: ignore[arg-type]
        tenant_id="t1", sortier_spalte="title", aufsteigend=True,
    )
    arten = [a for a, _ in protokoll]
    assert arten == ["gte", "or_"], arten
    assert protokoll[0][1] == ("title", "Bravo")
    # Innerhalb der Spanne entscheidet der Wert oder die ID — ein erneutes
    # `title.eq` ist unnötig, weil die Spanne den Gleichstand schon einschließt.
    assert protokoll[1][1] == 'title.gt."Bravo",id.gt.p2'


def test_nullable_spalte_nutzt_die_oder_form(_db: FakeDB) -> None:
    """Bei einer NULL-fähigen Spalte darf KEINE Range-Grenze gesetzt werden.

    `due_at >= wert` würde jede Aufgabe ohne Fälligkeit ausschließen — der
    NULL-Block wäre unerreichbar, und der Client hielte diese Aufgaben für nicht
    existent. Hier ist die langsamere Form die einzig richtige.
    """
    _db.speicher["tasks"] = [
        {
            "id": "t1",
            "tenant_id": "t1",
            "title": "Früh",
            "due_at": "2026-09-01T08:00:00+00:00",
            "status": "open",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    ]
    blatt = pagination.blaettern_pruefen(2, None, False, "t1")
    protokoll: list[str] = []

    class _Spion:
        def gte(self, *_a: object, **_k: object) -> _Spion:
            protokoll.append("gte")
            return self

        def or_(self, ausdruck: str) -> _Spion:
            protokoll.append(f"or_:{ausdruck}")
            return self

    pagination.keyset_anwenden(
        _Spion(), _db, "tasks", blatt,  # type: ignore[arg-type]
        tenant_id="t1", sortier_spalte="due_at", aufsteigend=True, nullable=True,
    )
    assert not any(p == "gte" for p in protokoll), protokoll
    assert protokoll[0].startswith("or_:")
    # Der NULL-Zweig MUSS dabei sein, sonst bleibt das Blättern davor stehen.
    assert "due_at.is.null" in protokoll[0]

