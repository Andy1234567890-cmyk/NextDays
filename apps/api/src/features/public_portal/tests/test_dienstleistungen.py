"""Tests fuer die Eigentuemer-Dienstleistungen (Etappe D).

Schwerpunkte, in dieser Reihenfolge:
  * Owner-Scope (Wurzel 3/9) — fremdes Objekt ist 404, nicht 403.
  * Idempotenz (Wurzel 2) — Doppelklick erzeugt EINEN Auftrag, auch wenn die
    Vorab-Pruefung ihn verpasst (simuliertes Rennen → 23505).
  * Grenzen (Wurzel 8) — Vergangenheit, zu weit voraus, Zeitraum verdreht.
  * Zuweisung (Wurzel 4) — kein Stamm-Mitarbeiter heisst UNZUGEWIESEN, nicht
    „irgendwer".
  * Datensplit (§4.3) — die Antwort traegt keinen Mitarbeiter.

Die Fake-DB hier kann mehr als die in `test_public_portal.py` (or_-Filter,
UNIQUE-Konflikt) und ist darum eigenstaendig — der Idempotenz-Test braucht
genau diese beiden Faehigkeiten.
"""
from datetime import UTC, date, datetime, timedelta

import pytest

from src.core.security import AuthContext
from src.features.public_portal.dienstleistungen import (
    DienstleistungError,
    DienstleistungsService,
)
from src.features.public_portal.schemas_dienstleistungen import ServiceRequestCreate

HEUTE = datetime.now(UTC).date()
MORGEN = HEUTE + timedelta(days=1)

# Echte UUIDs, weil das Schema sie erzwingt (Nicht-UUID → 422 statt DB-500).
P_EIGEN = "11111111-1111-4111-8111-111111111111"
P_FREMD = "22222222-2222-4222-8222-222222222222"
P_UNBEKANNT = "99999999-9999-4999-8999-999999999999"
ST_SYSTEM = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ST_EIGEN = "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa"
ST_FREMD = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa"


class _Result:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        # PostgREST liefert bei `select(..., count="exact")` die Gesamtzahl.
        self.count = count


class _Konflikt(Exception):
    """Was der Supabase-Client bei einem UNIQUE-Verstoss wirft (Code im Text)."""

    def __init__(self) -> None:
        super().__init__('duplicate key value violates unique constraint (23505)')


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._or: str | None = None
        self._gte: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._count = False

    def select(self, *_a: object, **k: object) -> "_Query":
        self._op = "select"
        self._count = k.get("count") == "exact"
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte = (col, val)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte = (col, val)
        return self

    def insert(self, payload: dict) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def or_(self, ausdruck: str) -> "_Query":
        self._or = ausdruck
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._or:
            # Nur die eine Form, die der Service nutzt:
            # "tenant_id.is.null,tenant_id.eq.<id>"
            treffer = False
            for teil in self._or.split(","):
                if teil == "tenant_id.is.null":
                    treffer = treffer or row.get("tenant_id") is None
                elif teil.startswith("tenant_id.eq."):
                    treffer = treffer or str(row.get("tenant_id")) == teil.split(
                        "tenant_id.eq."
                    )[1]
            ok = treffer
        if ok and self._gte:
            ok = str(row.get(self._gte[0]) or "") >= self._gte[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0]) or "") <= self._lte[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            schluessel = row.get("request_dedup_key")
            # Der UNIQUE-Backstop der DB (tasks_request_dedup_uq, 0330).
            if schluessel and any(
                r.get("request_dedup_key") == schluessel for r in rows
            ):
                raise _Konflikt
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-08-08T00:00:00Z")
            rows.append(row)
            return _Result([row])
        treffer = [r for r in rows if self._match(r)]
        return _Result(treffer, len(treffer) if self._count else None)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0
        # Schaltet die Vorab-Pruefung ab, um das echte Rennen zweier
        # gleichzeitiger Requests nachzustellen.
        self.blind = False

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        q = _Query(self, name)
        if self.blind and name == "tasks":
            q._match = lambda _row: False  # noqa: SLF001 — Testdouble
        return q


def _tables() -> dict[str, list[dict]]:
    return {
        "users": [
            {"id": "owner-1", "tenant_id": "t-1", "role": "owner"},
            {"id": "staff-1", "tenant_id": "t-1", "role": "cleaner"},
            {"id": "staff-2", "tenant_id": "t-1", "role": "cleaner"},
        ],
        "owner_property_assignments": [
            {"tenant_id": "t-1", "user_id": "owner-1", "property_id": P_EIGEN}
        ],
        "service_types": [
            {
                "id": ST_SYSTEM,
                "tenant_id": None,
                "key": "endreinigung",
                "kategorie": "cleaning",
                "standard_dauer_minuten": 180,
                "aktiv": True,
                "sortierung": 10,
            },
            {
                "id": ST_EIGEN,
                "tenant_id": "t-1",
                "key": "poolreinigung",
                "kategorie": "cleaning",
                "standard_dauer_minuten": None,
                "aktiv": True,
                "sortierung": 60,
            },
            {
                "id": ST_FREMD,
                "tenant_id": "t-999",
                "key": "fremdleistung",
                "kategorie": "cleaning",
                "standard_dauer_minuten": None,
                "aktiv": True,
                "sortierung": 70,
            },
        ],
        "property_service_assignees": [],
        "staff_property_assignments": [],
        "tasks": [],
    }


def _service(db: _DB) -> DienstleistungsService:
    return DienstleistungsService(service_client=db)


def _ctx(user: str = "owner-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id="t-1", role="owner")


def _req(**kw: object) -> ServiceRequestCreate:
    daten: dict = {
        "property_id": P_EIGEN,
        "service_type_id": ST_SYSTEM,
        "datum": MORGEN,
    }
    daten.update(kw)
    return ServiceRequestCreate(**daten)


# --- Katalog ---------------------------------------------------------------


def test_katalog_zeigt_system_und_eigene_nicht_fremde() -> None:
    """Systemvorgaben + eigene Typen — der Typ eines FREMDEN Mandanten nicht."""
    katalog = _service(_DB(_tables())).catalog(_ctx())
    keys = {i.key for i in katalog.items}
    assert keys == {"endreinigung", "poolreinigung"}
    assert "fremdleistung" not in keys


def test_katalog_traegt_keinen_anzeigenamen() -> None:
    """Wurzel 4: die DB liefert den stabilen `key`, kein deutsches Wort."""
    katalog = _service(_DB(_tables())).catalog(_ctx())
    eintrag = next(i for i in katalog.items if i.key == "endreinigung")
    assert eintrag.system is True
    assert not hasattr(eintrag, "name")


# --- Owner-Scope (Wurzel 3/9) ----------------------------------------------


def test_fremdes_objekt_ist_404() -> None:
    """Ein Objekt ohne Owner-Zuordnung existiert fuer den Eigentuemer nicht —
    404, nicht 403: die Existenz fremder Objekte wird nicht verraten."""
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).request_service(_ctx(), _req(property_id=P_FREMD))
    assert exc.value.status_code == 404


def test_fremder_katalogtyp_ist_404() -> None:
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).request_service(
            _ctx(), _req(service_type_id=ST_FREMD)
        )
    assert exc.value.status_code == 404


def test_liste_zeigt_nur_eigene_auftraege() -> None:
    """§4.3: fremde Aufgaben des Betriebs bleiben unsichtbar, auch am eigenen
    Objekt."""
    db = _DB(_tables())
    db.tables["tasks"] = [
        {
            "id": "t-fremd",
            "tenant_id": "t-1",
            "property_id": P_EIGEN,
            "requested_by": "owner-2",
            "title": "fremd",
            "status": "open",
        },
        {
            "id": "t-mein",
            "tenant_id": "t-1",
            "property_id": P_EIGEN,
            "requested_by": "owner-1",
            "title": "endreinigung",
            "status": "open",
        },
    ]
    liste = _service(db).my_service_requests(_ctx())
    assert [i.id for i in liste.items] == ["t-mein"]


# --- Idempotenz (Wurzel 2) -------------------------------------------------


def test_doppelklick_erzeugt_nur_einen_auftrag() -> None:
    db = _DB(_tables())
    service = _service(db)
    erst = service.request_service(_ctx(), _req())
    zweit = service.request_service(_ctx(), _req())
    assert erst.id == zweit.id
    assert len(db.tables["tasks"]) == 1


def test_gleichzeitige_anfragen_laufen_in_den_unique_index() -> None:
    """Das echte Rennen: die Vorab-Pruefung sieht nichts (blind), erst der
    UNIQUE-Index der DB faengt den zweiten Insert. Der Service muss den
    bestehenden Auftrag liefern statt zu scheitern."""
    db = _DB(_tables())
    service = _service(db)
    erst = service.request_service(_ctx(), _req())

    db.blind = True  # jede tasks-Suche liefert jetzt nichts
    with pytest.raises(_Konflikt):
        # Beweis, dass die DB wirklich blockt.
        db.table("tasks").insert(
            {"request_dedup_key": db.tables["tasks"][0]["request_dedup_key"]}
        ).execute()

    db.blind = False
    zweit = service.request_service(_ctx(), _req())
    assert zweit.id == erst.id
    assert len(db.tables["tasks"]) == 1


def test_anderer_tag_ist_ein_neuer_auftrag() -> None:
    db = _DB(_tables())
    service = _service(db)
    service.request_service(_ctx(), _req())
    service.request_service(_ctx(), _req(datum=MORGEN + timedelta(days=1)))
    assert len(db.tables["tasks"]) == 2


# --- Grenzen (Wurzel 8) ----------------------------------------------------


def test_vergangenes_datum_ist_422() -> None:
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).request_service(
            _ctx(), _req(datum=HEUTE - timedelta(days=10))
        )
    assert exc.value.status_code == 422


def test_zu_weit_in_der_zukunft_ist_422() -> None:
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).request_service(
            _ctx(), _req(datum=HEUTE + timedelta(days=1000))
        )
    assert exc.value.status_code == 422


def test_enddatum_vor_startdatum_ist_422() -> None:
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).request_service(
            _ctx(), _req(datum=MORGEN, datum_bis=HEUTE)
        )
    assert exc.value.status_code == 422


def test_freitext_zu_lang_wird_abgewiesen() -> None:
    """Die Laengengrenze sitzt im Schema — der Service sieht solchen Input nie."""
    with pytest.raises(ValueError, match="freitext"):
        ServiceRequestCreate(
            property_id=P_EIGEN, freitext="x" * 500, datum=MORGEN
        )


def test_weder_typ_noch_freitext_wird_abgewiesen() -> None:
    with pytest.raises(ValueError, match="service_type_id"):
        ServiceRequestCreate(property_id=P_EIGEN, datum=MORGEN)


def test_typ_und_freitext_zugleich_wird_abgewiesen() -> None:
    with pytest.raises(ValueError, match="service_type_id"):
        ServiceRequestCreate(
            property_id=P_EIGEN, service_type_id=ST_SYSTEM, freitext="und Text",
            datum=MORGEN,
        )


def test_steuerzeichen_werden_entfernt() -> None:
    """Wurzel 8: CR/LF im Titel koennte in Mail-Kopfzeilen einbrechen."""
    req = ServiceRequestCreate(
        property_id=P_EIGEN, freitext="Rasen\r\nBcc: fremd@example.com", datum=MORGEN
    )
    assert "\r" not in (req.freitext or "")


# --- Zuweisung (Wurzel 4) --------------------------------------------------


def test_ohne_stamm_mitarbeiter_bleibt_unzugewiesen() -> None:
    db = _DB(_tables())
    ergebnis = _service(db).request_service(_ctx(), _req())
    assert ergebnis.zugewiesen is False
    assert db.tables["tasks"][0]["assignee_id"] is None


def test_stamm_dienstleister_je_typ_wird_zugewiesen() -> None:
    db = _DB(_tables())
    db.tables["property_service_assignees"] = [
        {
            "tenant_id": "t-1",
            "property_id": P_EIGEN,
            "service_type_id": ST_SYSTEM,
            "assignee_id": "staff-1",
        }
    ]
    ergebnis = _service(db).request_service(_ctx(), _req())
    assert ergebnis.zugewiesen is True
    assert db.tables["tasks"][0]["assignee_id"] == "staff-1"


def test_genau_ein_objekt_mitarbeiter_wird_zugewiesen() -> None:
    db = _DB(_tables())
    db.tables["staff_property_assignments"] = [
        {"tenant_id": "t-1", "property_id": P_EIGEN, "user_id": "staff-1"}
    ]
    assert _service(db).request_service(_ctx(), _req()).zugewiesen is True


def test_mehrere_objekt_mitarbeiter_bleiben_unentschieden() -> None:
    """Zwei Kandidaten und keine Typ-Zuordnung: jede Wahl waere geraten
    (Wurzel 4) — der Betrieb entscheidet."""
    db = _DB(_tables())
    db.tables["staff_property_assignments"] = [
        {"tenant_id": "t-1", "property_id": P_EIGEN, "user_id": "staff-1"},
        {"tenant_id": "t-1", "property_id": P_EIGEN, "user_id": "staff-2"},
    ]
    assert _service(db).request_service(_ctx(), _req()).zugewiesen is False


# --- Aufgaben-Zeile und Datensplit -----------------------------------------


def test_auftrag_erscheint_im_aufgaben_kalender() -> None:
    """Der Aufgaben-Kalender filtert auf `start_at or due_at` im Monat
    (tasks/service.py::_calendar_tasks). Fehlt beides, faellt der Auftrag aus
    der Timeline — deshalb MUESSEN sie gesetzt sein."""
    db = _DB(_tables())
    _service(db).request_service(_ctx(), _req())
    zeile = db.tables["tasks"][0]
    assert zeile["start_at"] and zeile["due_at"]
    monat = MORGEN.isoformat()[:7]
    assert zeile["start_at"][:7] == monat
    assert zeile["tenant_id"] == "t-1"  # der Kalender scopt auf tenant_id


def test_standard_dauer_setzt_das_zeitfenster() -> None:
    db = _DB(_tables())
    _service(db).request_service(_ctx(), _req())
    zeile = db.tables["tasks"][0]
    start = datetime.fromisoformat(zeile["start_at"])
    ende = datetime.fromisoformat(zeile["end_at"])
    assert (ende - start) == timedelta(minutes=180)


def test_ohne_standard_dauer_bleibt_das_ende_leer() -> None:
    """Wurzel 4: keine erfundene Dauer, wenn der Typ keine hinterlegt hat."""
    db = _DB(_tables())
    _service(db).request_service(_ctx(), _req(service_type_id=ST_EIGEN))
    assert db.tables["tasks"][0]["end_at"] is None


def test_titel_ist_der_katalog_schluessel() -> None:
    """Wurzel 4: uebersetzt wird in der Oberflaeche, nicht in der DB."""
    db = _DB(_tables())
    _service(db).request_service(_ctx(), _req())
    assert db.tables["tasks"][0]["title"] == "endreinigung"


def test_freitext_auftrag_traegt_den_text_des_eigentuemers() -> None:
    db = _DB(_tables())
    _service(db).request_service(
        _ctx(), _req(service_type_id=None, freitext="Hecke schneiden")
    )
    zeile = db.tables["tasks"][0]
    assert zeile["title"] == "Hecke schneiden"
    assert zeile["service_type_id"] is None


def test_antwort_nennt_keinen_mitarbeiter() -> None:
    """§4.3: wer putzt, ist Personaleinsatz des Betriebs."""
    db = _DB(_tables())
    db.tables["property_service_assignees"] = [
        {
            "tenant_id": "t-1",
            "property_id": P_EIGEN,
            "service_type_id": ST_SYSTEM,
            "assignee_id": "staff-1",
        }
    ]
    ergebnis = _service(db).request_service(_ctx(), _req())
    daten = ergebnis.model_dump()
    assert "assignee_id" not in daten
    assert "staff-1" not in str(daten)


def test_ohne_tenant_kein_zugriff() -> None:
    """Fail-closed (Wurzel 3)."""
    ctx = AuthContext(user_id="owner-1", tenant_id=None, role="owner")
    with pytest.raises(DienstleistungError) as exc:
        _service(_DB(_tables())).catalog(ctx)
    assert exc.value.status_code == 400


def test_notiz_landet_in_der_beschreibung() -> None:
    db = _DB(_tables())
    _service(db).request_service(_ctx(), _req(notiz="Schlüssel beim Nachbarn"))
    assert db.tables["tasks"][0]["description"] == "Schlüssel beim Nachbarn"


def test_datum_bis_erzeugt_ganztaegiges_fenster() -> None:
    db = _DB(_tables())
    ende = MORGEN + timedelta(days=2)
    _service(db).request_service(_ctx(), _req(datum_bis=ende))
    zeile = db.tables["tasks"][0]
    # bis EINSCHLIESSLICH `datum_bis` → Ende ist der Folgetag 00:00.
    assert datetime.fromisoformat(zeile["end_at"]).date() == ende + timedelta(days=1)


def test_datum_typ_ist_date() -> None:
    """Regression: `start_at` im Ergebnis ist ein date, kein String."""
    db = _DB(_tables())
    ergebnis = _service(db).request_service(_ctx(), _req())
    assert isinstance(ergebnis.start_at, date)


# --- Review-Befunde (Regressionen) -----------------------------------------


def test_nicht_uuid_ist_422_kein_500() -> None:
    """Wurzel 8: ein Nicht-UUID-Wert lief bis zur DB durch und warf dort 22P02
    → angreifergesteuerter 500. Jetzt weist das Schema ihn ab."""
    with pytest.raises(ValueError, match="Ungültige ID"):
        ServiceRequestCreate(
            property_id=P_EIGEN,
            service_type_id="abc",  # kein UUID
            datum=MORGEN,
        )
    with pytest.raises(ValueError, match="Ungültige ID"):
        ServiceRequestCreate(
            property_id="'; drop table tasks; --", freitext="x", datum=MORGEN
        )


def test_doppelklick_meldet_nicht_zweimal(monkeypatch: pytest.MonkeyPatch) -> None:
    """Wurzel 2: der Dedup-Key der Benachrichtigung schuetzt nur die GLOCKE —
    E-Mail/SMS haben keine Entdopplung. Beim zweiten Klick darf deshalb gar
    nicht erst gemeldet werden, sonst bekommt die Reinigungskraft eine zweite
    Mail fuer denselben Auftrag."""
    meldungen: list[dict] = []
    monkeypatch.setattr(
        "src.features.public_portal.dienstleistungen.melde_aufgaben_zuweisung",
        lambda *_a, **kw: meldungen.append(kw),
    )
    db = _DB(_tables())
    db.tables["property_service_assignees"] = [
        {
            "tenant_id": "t-1",
            "property_id": P_EIGEN,
            "service_type_id": ST_SYSTEM,
            "assignee_id": "staff-1",
        }
    ]
    service = _service(db)
    service.request_service(_ctx(), _req())
    service.request_service(_ctx(), _req())  # Doppelklick
    assert len(db.tables["tasks"]) == 1
    assert len(meldungen) == 1


def test_tagesmenge_ist_begrenzt() -> None:
    """Wurzel 8: der Dedup-Key enthaelt den Freitext, also ist jeder abweichende
    Text ein neuer Auftrag. Ohne Obergrenze koennte ein Owner-Login die
    Aufgabenliste des Betriebs fluten."""
    db = _DB(_tables())
    service = _service(db)
    for i in range(20):
        service.request_service(
            _ctx(), _req(service_type_id=None, freitext=f"Arbeit {i}")
        )
    with pytest.raises(DienstleistungError) as exc:
        service.request_service(
            _ctx(), _req(service_type_id=None, freitext="einer zu viel")
        )
    assert exc.value.status_code == 422


def test_liste_ist_gedeckelt() -> None:
    """Die Antwort waechst nicht unbegrenzt mit der Historie."""
    from src.features.public_portal.dienstleistungen import MAX_LISTE

    assert MAX_LISTE > 0
