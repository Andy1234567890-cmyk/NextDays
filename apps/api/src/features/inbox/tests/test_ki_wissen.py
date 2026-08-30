"""Tests der Wissensdatenbank — Filter, Deckel und die Zugehörigkeit.

Drei Dinge sind hier teuer, wenn sie falsch sind:

1. **Ein Filter, der durchreicht.** `sortierung` und `kategorie` kommen aus der
   Anfrage. Ein durchgereichter Spaltenname liesse den Client nach etwas
   sortieren, das ihn nichts angeht; darum eine Allowlist. Ohne Test wäre die
   Allowlist beim nächsten Feld schnell vergessen.
2. **Ein fehlender Deckel.** Die Faktenliste ist frei paginierbar; ohne
   Obergrenze wäre `pro_seite=100000` eine kostenlose Vollabfrage (Wurzel 8).
3. **Ein Fakt am fremden Objekt.** Der Service-Role-Key umgeht RLS — die
   Objekt-Zugehörigkeit muss der Code selbst erzwingen (Wurzel 3).
"""

from __future__ import annotations

import pytest

from src.features.inbox.errors import InboxError
from src.features.inbox.ki_wissen import (
    KATEGORIEN,
    MAX_PRO_SEITE,
    KiWissenMixin,
    _erstes_foto,
)
from src.features.inbox.schemas import KnowledgeFactUpsert


class _Res:
    def __init__(self, data: list, count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    """Ein Double, das die AUFRUFE mitschreibt statt zu filtern.

    Geprüft wird hier, WELCHE Einschränkung der Code setzt — ob PostgREST sie
    dann richtig ausführt, ist dessen Sache und nicht Gegenstand eines
    Unit-Tests."""

    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self.aufrufe: list[tuple] = []
        db.protokoll.append((tabelle, self.aufrufe))

    def _merken(self, name: str, *a: object) -> _Query:
        self.aufrufe.append((name, *a))
        return self

    def select(self, *a, **k) -> _Query:
        return self._merken("select", *a)

    def eq(self, *a) -> _Query:
        return self._merken("eq", *a)

    def is_(self, *a) -> _Query:
        return self._merken("is_", *a)

    def or_(self, *a) -> _Query:
        return self._merken("or_", *a)

    def in_(self, *a) -> _Query:
        return self._merken("in_", *a)

    def order(self, *a, **k) -> _Query:
        return self._merken("order", *a, k.get("desc"))

    def range(self, *a) -> _Query:
        return self._merken("range", *a)

    def limit(self, *a) -> _Query:
        return self._merken("limit", *a)

    def insert(self, werte: dict) -> _Query:
        return self._merken("insert", werte)

    def update(self, werte: dict) -> _Query:
        return self._merken("update", werte)

    def delete(self) -> _Query:
        return self._merken("delete")

    def execute(self) -> _Res:
        rows = self._db.tabellen.get(self._tabelle, [])
        return _Res(list(rows), len(rows))


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.protokoll: list[tuple[str, list]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def aufrufe(self, tabelle: str) -> list[tuple]:
        """Alle Aufrufe der LETZTEN Abfrage auf diese Tabelle."""
        treffer = [a for t, a in self.protokoll if t == tabelle]
        return treffer[-1] if treffer else []


class _Ctx:
    tenant_id = "t1"
    user_id = "u1"


class _Dienst(KiWissenMixin):
    def __init__(self, db: _FakeDb) -> None:
        self._db = db

    def _require(self, ctx):  # noqa: ANN001
        return self._db, ctx.tenant_id


def _db_mit_fakten(*fakten: dict) -> _FakeDb:
    return _FakeDb(
        inbox_knowledge_fact=list(fakten) or [_fakt()],
        properties=[{"id": "p1", "title": "FeWo", "city": "Hirtshals", "photos": []}],
        ki_wissen_quelle=[],
    )


def _fakt(**felder: object) -> dict:
    basis = {
        "id": "f1",
        "property_id": "p1",
        "titel": "WLAN-Passwort",
        "fact": "Netz MERCUSYS, Passwort 2347",
        "kategorie": "ausstattung",
        "source": "manual",
        "source_ref": None,
        "quelle_id": None,
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T10:00:00Z",
    }
    return {**basis, **felder}


# --- Die Sortier-Allowlist --------------------------------------------------
def test_unbekannte_sortierung_faellt_auf_die_vorgabe_zurueck() -> None:
    """Ein durchgereichter Spaltenname wäre ein Datenausgang (Wurzel 3)."""
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), sortierung="tenant_id")
    order = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "order"]
    assert order and order[0][1] == "updated_at"


@pytest.mark.parametrize(
    ("eingabe", "spalte"),
    [
        ("titel", "titel"),
        ("kategorie", "kategorie"),
        ("quelle", "source"),
        ("geaendert", "updated_at"),
    ],
)
def test_erlaubte_sortierungen_kommen_durch(eingabe: str, spalte: str) -> None:
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), sortierung=eingabe)
    order = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "order"]
    assert order[0][1] == spalte


# --- Deckel (Wurzel 8) ------------------------------------------------------
def test_pro_seite_ist_gedeckelt() -> None:
    db = _db_mit_fakten()
    ergebnis = _Dienst(db).list_knowledge(_Ctx(), pro_seite=100_000)
    assert ergebnis.pro_seite == MAX_PRO_SEITE
    bereich = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "range"]
    assert bereich[0][2] == MAX_PRO_SEITE - 1


def test_seite_null_wird_zu_eins() -> None:
    """Seite 0 ergäbe einen negativen Bereich — PostgREST antwortet darauf
    mit einem 416, den niemand als „falscher Parameter" erkennt."""
    db = _db_mit_fakten()
    assert _Dienst(db).list_knowledge(_Ctx(), seite=0).seite == 1


def test_sammelloeschen_hat_eine_obergrenze() -> None:
    dienst = _Dienst(_db_mit_fakten())
    with pytest.raises(InboxError) as exc:
        dienst.delete_knowledge_bulk(_Ctx(), [f"id{i}" for i in range(MAX_PRO_SEITE + 1)])
    assert exc.value.status_code == 422


def test_sammelloeschen_ohne_ids_ist_kein_fehler() -> None:
    assert _Dienst(_db_mit_fakten()).delete_knowledge_bulk(_Ctx(), []) == 0


def test_sammelloeschen_scoped_auf_den_tenant() -> None:
    """Der Tenant-Filter steht IM Aufruf, nicht als nachträgliche Prüfung."""
    db = _db_mit_fakten()
    _Dienst(db).delete_knowledge_bulk(_Ctx(), ["f1", "fremd"])
    aufrufe = db.aufrufe("inbox_knowledge_fact")
    assert ("eq", "tenant_id", "t1") in aufrufe
    assert ("in_", "id", ["f1", "fremd"]) in aufrufe


# --- Filter -----------------------------------------------------------------
def test_betriebsweit_filtert_auf_null() -> None:
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), betriebsweit=True)
    assert ("is_", "property_id", "null") in db.aufrufe("inbox_knowledge_fact")


def test_objekt_ohne_flag_nimmt_die_betriebsweiten_mit() -> None:
    """Der KI-Pfad braucht beide zusammen — beim Beantworten gelten sie
    gemeinsam. Die Oberfläche setzt `nur_dieses_objekt`."""
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), property_id="p1")
    oder = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "or_"]
    assert "property_id.is.null" in oder[0][1]


def test_nur_dieses_objekt_laesst_die_betriebsweiten_weg() -> None:
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), property_id="p1", nur_dieses_objekt=True)
    aufrufe = db.aufrufe("inbox_knowledge_fact")
    assert ("eq", "property_id", "p1") in aufrufe
    assert not [a for a in aufrufe if a[0] == "or_"]


def test_erfundene_kategorie_filtert_nicht() -> None:
    """Eine unbekannte Kategorie darf nicht als Filter durchgehen — sonst
    liefert die Liste stumm nichts, statt den Filter zu ignorieren."""
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), kategorien=["gibtsnicht"])
    assert not [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "in_"]


def test_gemischte_kategorien_behalten_die_gueltigen() -> None:
    db = _db_mit_fakten()
    _Dienst(db).list_knowledge(_Ctx(), kategorien=["ausstattung", "quatsch"])
    im = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "in_"]
    assert im[0][2] == ["ausstattung"]


# --- Anlegen und Ändern -----------------------------------------------------
def test_leerer_fakt_wird_abgewiesen() -> None:
    dienst = _Dienst(_db_mit_fakten())
    with pytest.raises(InboxError) as exc:
        dienst.create_knowledge(_Ctx(), KnowledgeFactUpsert(fact="   "))
    assert exc.value.status_code == 422


def test_zu_langer_fakt_wird_abgewiesen() -> None:
    dienst = _Dienst(_db_mit_fakten())
    with pytest.raises(InboxError):
        dienst.create_knowledge(_Ctx(), KnowledgeFactUpsert(fact="x" * 2001))


def test_unbekannte_kategorie_wird_abgewiesen() -> None:
    """Vor der DB, mit klarer Meldung: der CHECK-Verstoß 23514 kommt sonst als
    500 an, und dessen Text versteht niemand."""
    dienst = _Dienst(_db_mit_fakten())
    with pytest.raises(InboxError) as exc:
        dienst.create_knowledge(
            _Ctx(), KnowledgeFactUpsert(fact="Text", kategorie="wlan")
        )
    assert exc.value.status_code == 422


@pytest.mark.parametrize("kategorie", KATEGORIEN)
def test_jede_katalog_kategorie_geht_durch(kategorie: str) -> None:
    db = _FakeDb(
        inbox_knowledge_fact=[_fakt(kategorie=kategorie)],
        properties=[{"id": "p1", "title": "FeWo", "city": "H", "photos": []}],
        ki_wissen_quelle=[],
    )
    fakt = _Dienst(db).create_knowledge(
        _Ctx(), KnowledgeFactUpsert(fact="Text", kategorie=kategorie)
    )
    assert fakt.kategorie == kategorie


def test_zu_langer_titel_wird_abgewiesen() -> None:
    dienst = _Dienst(_db_mit_fakten())
    with pytest.raises(InboxError):
        dienst.create_knowledge(
            _Ctx(), KnowledgeFactUpsert(fact="Text", titel="x" * 201)
        )


def test_leerer_titel_wird_zu_none() -> None:
    """Ein leerer String verstiesse gegen den CHECK (btrim length >= 1) —
    NULL ist der richtige Ausdruck für „kein Titel"."""
    db = _db_mit_fakten()
    _Dienst(db).create_knowledge(_Ctx(), KnowledgeFactUpsert(fact="Text", titel="  "))
    eingefuegt = [a for a in db.aufrufe("inbox_knowledge_fact") if a[0] == "insert"]
    assert eingefuegt[0][1]["titel"] is None


def test_fremdes_objekt_wird_abgewiesen() -> None:
    """Wurzel 3: der Service-Role-Key umgeht RLS — die Zugehörigkeit muss der
    Code selbst erzwingen."""
    db = _FakeDb(inbox_knowledge_fact=[], properties=[], ki_wissen_quelle=[])
    dienst = _Dienst(db)
    with pytest.raises(InboxError) as exc:
        dienst.create_knowledge(
            _Ctx(), KnowledgeFactUpsert(fact="Text", property_id="fremd")
        )
    assert exc.value.status_code == 404


def test_aendern_eines_unbekannten_fakts_ist_404() -> None:
    db = _FakeDb(inbox_knowledge_fact=[], properties=[], ki_wissen_quelle=[])
    with pytest.raises(InboxError) as exc:
        _Dienst(db).update_knowledge(_Ctx(), "weg", KnowledgeFactUpsert(fact="Neu"))
    assert exc.value.status_code == 404


# --- Objektliste ------------------------------------------------------------
def test_objektliste_zaehlt_betriebsweite_getrennt() -> None:
    """Ohne die eigene Zeile wären betriebsweite Fakten unerreichbar."""
    db = _FakeDb(
        properties=[{"id": "p1", "title": "FeWo", "city": "H", "photos": []}],
        inbox_knowledge_fact=[
            _fakt(id="a", property_id="p1"),
            _fakt(id="b", property_id="p1"),
            _fakt(id="c", property_id=None),
        ],
    )
    liste = _Dienst(db).wissen_objekte(_Ctx())
    assert liste.items[0].fakten == 2
    assert liste.betriebsweit_fakten == 1


def test_objektliste_nimmt_das_juengste_datum() -> None:
    db = _FakeDb(
        properties=[{"id": "p1", "title": "FeWo", "city": "H", "photos": []}],
        inbox_knowledge_fact=[
            _fakt(id="a", updated_at="2026-01-01T00:00:00Z"),
            _fakt(id="b", updated_at="2026-08-30T00:00:00Z"),
        ],
    )
    assert _Dienst(db).wissen_objekte(_Ctx()).items[0].geaendert_at.startswith("2026-08-30")


def test_objekt_ohne_fakten_zeigt_null_und_kein_datum() -> None:
    db = _FakeDb(
        properties=[{"id": "p9", "title": "Leer", "city": None, "photos": []}],
        inbox_knowledge_fact=[],
    )
    zeile = _Dienst(db).wissen_objekte(_Ctx()).items[0]
    assert zeile.fakten == 0
    assert zeile.geaendert_at is None


# --- Fotos (Wurzel 4: kein erfundenes Bild) ---------------------------------
@pytest.mark.parametrize(
    ("eingabe", "erwartet"),
    [
        (["  https://x/1.jpg ", "b"], "https://x/1.jpg"),
        (["", "https://x/2.jpg"], "https://x/2.jpg"),
        ([], None),
        (None, None),
        (["   "], None),
        ("kein-array", None),
    ],
)
def test_erstes_foto(eingabe: object, erwartet: str | None) -> None:
    assert _erstes_foto(eingabe) == erwartet
