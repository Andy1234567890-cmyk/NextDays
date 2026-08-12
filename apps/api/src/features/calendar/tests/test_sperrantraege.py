"""Tests des Sperrantrags-Workflows (Etappe A + Eigentümer-Sperrzeiten 0353).

Schwerpunkt sind die Wurzeln, an denen dieser Workflow real scheitern würde:
* Wurzel 2 — Doppelklick auf „genehmigen" darf nicht zweimal belegen.
* Wurzel 1 — der Widerruf muss die Nächte wieder freigeben, und NUR die eigenen.
* Wurzel 3/9 — ein fremder Mandant darf den Antrag nicht sehen/entscheiden;
  eine `unit_id` aus dem Request wird serverseitig gescopt.
* Der 409-Fall: gebuchte Tage im Zeitraum → Antrag bleibt OFFEN.
* 0353 — die Genehmigung erzeugt eine Reservierung mit `is_owner_stay=true` und
  `owner_id`, keine anonyme Sperre mehr.

In-Memory-Fake-DB (kein Netz, keine Test-DB). Sie bildet inzwischen auch den
Reservierungs-Pfad ab (RPC `create_reservation_atomic`), weil die Genehmigung
über ihn läuft — genau das ist die Aussage von 0353: EIN Weg.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.calendar.schemas import BlockRequestDecision
from src.features.calendar.service import CalendarError
from src.features.calendar.sperrantraege import (
    SperrantragService,
    melde_neuen_antrag,
)

# Feste UUIDs: `reservations`-Pfade prüfen die ID-Form (`_require_uuid`), ein
# „b-1" käme dort nie an.
ANTRAG = "11111111-1111-4111-8111-111111111111"
ANTRAG_FREMD = "99999999-9999-4999-8999-999999999999"
OBJEKT = "22222222-2222-4222-8222-222222222222"
OBJEKT_FREMD = "88888888-8888-4888-8888-888888888888"
EINHEIT_A = "33333333-3333-4333-8333-333333333333"
EINHEIT_B = "44444444-4444-4444-8444-444444444444"
EINHEIT_FREMD = "77777777-7777-4777-8777-777777777777"
EIGENTUEMER = "55555555-5555-4555-8555-555555555555"


def _ctx(user: str = "admin-1", tenant: str = "t-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=tenant, role="admin")


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Nachbau: eq/neq/in_/gte/lt/lte + CRUD.

    Kennt zusätzlich den `!inner`-Embed in der Form, in der der Code ihn nutzt
    (`owners!inner(tenant_id)` + `.eq("owners.tenant_id", …)`): der Filter wird
    über die verknüpfte Tabelle aufgelöst statt ignoriert. Würde er ignoriert,
    liefen die Scope-Tests ins Leere und bewiesen nichts.
    """

    # Embed-Spalte → (Zieltabelle, Fremdschlüssel in der eigenen Zeile).
    _EMBEDS = {
        "owners": ("owners", "owner_id"),
        "properties": ("properties", "property_id"),
    }

    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: Any = None
        self._filters: list[tuple[str, object]] = []
        self._neq: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lt: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        self._op = "select"
        return self

    def insert(self, payload: dict) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: object, **_k: object) -> _Query:
        self._op = "upsert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> _Query:
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, val))
        return self

    def neq(self, col: str, val: object) -> _Query:
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._in = (col, vals)
        return self

    def gte(self, col: str, val: str) -> _Query:
        self._gte = (col, val)
        return self

    def lt(self, col: str, val: str) -> _Query:
        self._lt = (col, val)
        return self

    def lte(self, col: str, val: str) -> _Query:
        self._lte = (col, val)
        return self

    def gt(self, *_a: object) -> _Query:
        return self

    @property
    def not_(self) -> _Query:
        # PostgREST-Kette `.not_.is_(...)` — `not_` ist eine PROPERTY, keine
        # Methode (siehe pricing/resolver.py:444).
        return self

    def is_(self, *_a: object) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def range(self, *_a: object) -> _Query:
        return self

    def _feld(self, row: dict, col: str) -> object:
        """Spaltenwert — auch über einen `!inner`-Embed („owners.tenant_id")."""
        if "." not in col:
            return row.get(col)
        embed, feld = col.split(".", 1)
        ziel, fk = self._EMBEDS.get(embed, (embed, f"{embed}_id"))
        treffer = [
            r
            for r in self._db.tables.get(ziel, [])
            if str(r.get("id")) == str(row.get(fk))
        ]
        return treffer[0].get(feld) if treffer else None

    def _match(self, row: dict) -> bool:
        ok = all(
            str(self._feld(row, c)) == str(v) for c, v in self._filters
        )
        ok = ok and all(
            str(self._feld(row, c)) != str(v) for c, v in self._neq
        )
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._lt:
            ok = str(row.get(self._lt[0])) < self._lt[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0])) <= self._lte[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            angelegt = []
            for eintrag in neu:
                row = dict(eintrag)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-06-25T00:00:00Z")
                rows.append(row)
                angelegt.append(row)
            return _Result(angelegt)
        if self._op == "upsert":
            payload = self._payload
            neu = payload if isinstance(payload, list) else [payload]
            for eintrag in neu:
                treffer = [
                    r
                    for r in rows
                    if r.get("property_id") == eintrag.get("property_id")
                    and r.get("date") == eintrag.get("date")
                    and r.get("unit_id") == eintrag.get("unit_id")
                ]
                if treffer:
                    treffer[0].update(eintrag)
                else:
                    rows.append(dict(eintrag))
            return _Result(list(neu))
        if self._op == "update":
            getroffen = [r for r in rows if self._match(r)]
            for r in getroffen:
                r.update(self._payload or {})
            return _Result(getroffen)
        if self._op == "delete":
            getroffen = [r for r in rows if self._match(r)]
            self._db.tables[self._table] = [r for r in rows if r not in getroffen]
            return _Result(getroffen)
        return _Result([r for r in rows if self._match(r)])


class _RPC:
    """`create_reservation_atomic` (0275/0318/0351) in der Fake-DB.

    Bildet ab, worauf die Tests sich stützen: Einheitenwahl (Vorgabe gewinnt,
    sonst erste freie), Ablehnung bei belegter Einheit, Reservierungszeile und
    `availability`-Belegung je Einheit. Der Rest der echten Funktion (Stop-Sell,
    Advisory-Lock, Outbox-Minimum) ist hier nicht Gegenstand.
    """

    def __init__(self, db: _DB, name: str, params: dict) -> None:
        self._db = db
        self._name = name
        self._params = params

    def execute(self) -> _Result:
        if self._name != "create_reservation_atomic":
            raise AssertionError(f"Unerwartete RPC: {self._name}")
        res = dict(self._params["p_reservation"])
        pid = str(res["property_id"])
        tage = _tage(str(res["check_in"]), str(res["check_out"]))
        belegt = {
            (str(r.get("unit_id")), str(r.get("date")))
            for r in self._db.tables.get("availability", [])
            if r.get("property_id") == pid and r.get("status") != "open"
        }
        einheiten = [
            str(u["id"])
            for u in self._db.tables.get("property_units", [])
            if u.get("property_id") == pid
        ]
        vorgabe = res.get("unit_id")
        if vorgabe:
            kandidaten = [str(vorgabe)]
        else:
            kandidaten = einheiten
        unit = next(
            (u for u in kandidaten if all((u, t) not in belegt for t in tage)),
            None,
        )
        if unit is None:
            raise _RPCKonflikt("Zeitraum enthält bereits belegte/gesperrte Tage.")
        res["unit_id"] = unit
        # UUID-Form, weil der Storno-Pfad die ID prüft (`_require_uuid`).
        res.setdefault("id", f"aaaaaaaa-0000-4000-8000-{self._db.next_id():012d}")
        res.setdefault("status", "confirmed")
        self._db.tables.setdefault("reservations", []).append(res)
        for tag in tage:
            self._db.tables.setdefault("availability", []).append(
                {
                    "property_id": pid,
                    "unit_id": unit,
                    "date": tag,
                    "status": "booked",
                    "source": self._params.get("p_source") or "direct",
                }
            )
        return _Result({"reservation": res, "outbox_id": None})


class _RPCKonflikt(Exception):
    """Der RS409 der echten RPC — vom Aufrufer als 409 gemappt."""


def _tage(von: str, bis_exkl: str) -> list[str]:
    start, ende = date.fromisoformat(von), date.fromisoformat(bis_exkl)
    return [
        (start + timedelta(days=i)).isoformat()
        for i in range((ende - start).days)
    ]


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, params: dict) -> _RPC:
        return _RPC(self, name, params)


def _tables(*, einheiten: int = 1, mit_eigentuemer: bool = True) -> dict[str, list[dict]]:
    units = [
        {
            "id": uid,
            "tenant_id": "t-1",
            "property_id": OBJEKT,
            "name": name,
            "position": pos,
        }
        for pos, (uid, name) in enumerate(
            [(EINHEIT_A, "Studio 1"), (EINHEIT_B, "Studio 2")][:einheiten]
        )
    ]
    return {
        # `full_name`, NICHT `name`: eine `users.name` gibt es nicht. Der Fake
        # trug hier lange `name` und deckte damit genau den Fehler zu, der live
        # als `42703 column users.name does not exist` einen 500 auf
        # `GET /calendar/block-requests` warf (12.08.2026). Ein Fake, der die DB
        # falsch nachbildet, ist schlimmer als keiner — er macht den Test grün.
        "users": [
            {
                "id": "admin-1", "tenant_id": "t-1", "role": "admin",
                "full_name": "Chefin",
            },
            {
                "id": "owner-1", "tenant_id": "t-1", "role": "owner",
                "full_name": "Herr Ohm",
            },
            # Reinigungskraft: KEIN APPROVE_BLOCK → bekommt keine Meldung.
            {
                "id": "clean-1", "tenant_id": "t-1", "role": "cleaner",
                "full_name": "Putz",
            },
        ],
        "properties": [
            {"id": OBJEKT, "tenant_id": "t-1", "title": "Villa"},
            {"id": OBJEKT_FREMD, "tenant_id": "t-9", "title": "Fremd"},
        ],
        "property_units": [
            *units,
            # Einheit eines FREMDEN Objekts — Zielscheibe der Scope-Tests.
            {
                "id": EINHEIT_FREMD,
                "tenant_id": "t-9",
                "property_id": OBJEKT_FREMD,
                "name": "Fremdstudio",
                "position": 0,
            },
        ],
        "owners": (
            [{"id": EIGENTUEMER, "tenant_id": "t-1", "name": "Herr Ohm"}]
            if mit_eigentuemer
            else []
        ),
        "owner_properties": (
            [{"id": "op-1", "owner_id": EIGENTUEMER, "property_id": OBJEKT}]
            if mit_eigentuemer
            else []
        ),
        "availability": [],
        "reservations": [],
        "block_requests": [
            {
                "id": ANTRAG,
                "tenant_id": "t-1",
                "property_id": OBJEKT,
                "unit_id": None,
                "requested_by": "owner-1",
                "start_date": "2026-03-01",
                "end_date": "2026-03-03",  # INKLUSIV → 3 Nächte
                "status": "pending",
                "reason": "Eigennutzung",
                "created_at": "2026-02-01T00:00:00Z",
            },
            {
                "id": ANTRAG_FREMD,
                "tenant_id": "t-9",  # FREMDER Mandant
                "property_id": OBJEKT_FREMD,
                "unit_id": None,
                "requested_by": "owner-9",
                "start_date": "2026-03-01",
                "end_date": "2026-03-03",
                "status": "pending",
                "created_at": "2026-02-01T00:00:00Z",
            },
        ],
        "notification_settings": [],
        "notifications": [],
        "ari_outbox": [],
        "channex_property_map": [],
        "rate_plans": [],
        "price_overrides": [],
        "stop_sell": [],
        "reservation_events": [],
        "reservation_cancellation_log": [],
        "task_rules": [],
        "tasks": [],
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> SperrantragService:
    return SperrantragService(db=_DB(tables or _tables()))


def _entscheidung(note: str | None = None) -> BlockRequestDecision:
    return BlockRequestDecision(note=note)


def _eigennutzungen(tables: dict[str, list[dict]]) -> list[dict]:
    return [
        r
        for r in tables["reservations"]
        if r.get("is_owner_stay") and r.get("status") != "cancelled"
    ]


def _belegte_tage(tables: dict[str, list[dict]]) -> list[str]:
    return sorted(
        r["date"] for r in tables["availability"] if r["status"] == "booked"
    )


# --- Scope (Wurzel 3 / 9) ----------------------------------------------------

def test_liste_nur_eigener_mandant() -> None:
    res = _svc().liste(_ctx())
    assert [i.id for i in res.items] == [ANTRAG]  # der fremde fehlt
    assert res.items[0].property_title == "Villa"
    assert res.items[0].requested_by_name == "Herr Ohm"


def test_liste_filtert_status() -> None:
    res = _svc().liste(_ctx(), status="approved")
    assert res.total == 0


def test_liste_unbekannter_status_422() -> None:
    with pytest.raises(CalendarError) as exc:
        _svc().liste(_ctx(), status="quatsch")
    assert exc.value.status_code == 422


def test_fremder_antrag_404() -> None:
    """Wurzel 9: die {id}-Aktion prüft denselben Scope wie die Liste."""
    with pytest.raises(CalendarError) as exc:
        _svc().genehmigen(_ctx(), ANTRAG_FREMD, _entscheidung())
    assert exc.value.status_code == 404


# --- Genehmigen (0353: Eigentümer-Aufenthalt statt anonymer Sperre) ----------

def test_genehmigen_legt_eigentuemer_aufenthalt_an() -> None:
    """Der Kern von 0353: die Genehmigung erzeugt eine ZUORDENBARE Belegung.

    Vorher entstand eine anonyme `blocked`-Nacht — der Kalender war zu, aber
    weder Buchungsliste noch Abrechnung noch Statistik konnten sagen, WER das
    Objekt genutzt hat. Genau die Lücke sollte 0241 (`is_owner_stay`) schließen;
    der Sperrantrag hat sie nie benutzt.
    """
    tables = _tables()
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung("passt"))
    assert item.status == "approved"
    assert item.decided_by == "admin-1"
    assert item.decided_at is not None
    assert item.decision_note == "passt"

    aufenthalte = _eigennutzungen(tables)
    assert len(aufenthalte) == 1
    res = aufenthalte[0]
    assert res["owner_id"] == EIGENTUEMER      # der Personenbezug
    assert res["block_request_id"] == ANTRAG   # der Anker für den Widerruf
    assert res["guest_id"] is None             # ein Eigentümer ist kein Gast
    assert res["total_amount"] == 0            # kein Umsatz (0241)
    # end_date ist INKLUSIV → 1., 2. und 3. März belegt (3 Nächte).
    assert _belegte_tage(tables) == [
        "2026-03-01", "2026-03-02", "2026-03-03",
    ]


def test_genehmigen_ohne_eigentuemer_422_und_bleibt_offen() -> None:
    """Wurzel 4: eine Eigennutzung ohne Eigentümer wäre wieder die anonyme
    Sperre. Kein Ersatzwert — klar fehlschlagen, und der Antrag bleibt offen."""
    tables = _tables(mit_eigentuemer=False)
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 422
    assert tables["reservations"] == []
    assert tables["block_requests"][0]["status"] == "pending"
    # Der Antrag wurde nicht einmal geclaimt — kein Zustand zum Zurückrollen.
    assert "decided_at" not in tables["block_requests"][0]


def test_genehmigen_ist_idempotent() -> None:
    """Wurzel 2: der zweite Klick bekommt 409 und belegt NICHT erneut."""
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    anzahl = len(tables["reservations"])
    with pytest.raises(CalendarError) as exc:
        svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409
    assert "bereits genehmigt" in exc.value.message
    assert len(tables["reservations"]) == anzahl  # keine zweite Belegung


def test_genehmigen_bei_gebuchtem_tag_409_und_bleibt_offen() -> None:
    """Der Antrag darf NICHT still als genehmigt gelten, wenn nicht belegt
    werden konnte (sonst zeigt das Portal eine Sperre, die es nicht gibt)."""
    tables = _tables()
    tables["availability"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "status": "booked",
            "source": "airbnb",
            "unit_id": EINHEIT_A,
        }
    )
    svc = _svc(tables)
    with pytest.raises(Exception) as exc:  # noqa: PT011 — Fehlerklasse ist hier egal
        svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert not isinstance(exc.value, AssertionError)
    antrag = tables["block_requests"][0]
    assert antrag["status"] == "pending"  # zurückgerollt
    assert antrag["decided_by"] is None
    assert antrag["decided_at"] is None
    assert _eigennutzungen(tables) == []


def test_ablehnen_sperrt_nichts() -> None:
    tables = _tables()
    item = _svc(tables).ablehnen(_ctx(), ANTRAG, _entscheidung("leider nein"))
    assert item.status == "rejected"
    assert item.decision_note == "leider nein"
    assert tables["availability"] == []
    assert tables["reservations"] == []


def test_ablehnen_nach_genehmigung_409() -> None:
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    with pytest.raises(CalendarError) as exc:
        svc.ablehnen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409


# --- Widerruf (Wurzel 1: Gegenzustand) ---------------------------------------

def test_zuruecknehmen_gibt_naechte_frei() -> None:
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert len(_belegte_tage(tables)) == 3
    item = svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung("doch nicht"))
    assert item.status == "rejected"
    # Die Eigennutzung ist storniert und die Nächte sind wieder offen.
    assert _eigennutzungen(tables) == []
    assert _belegte_tage(tables) == []


def test_zuruecknehmen_trifft_nur_die_eigene_eigennutzung() -> None:
    """WURZEL 1 — nur der EIGENE Gegenzustand.

    Eine zweite, unabhängig erfasste Eigennutzung im selben Zeitraum (anderes
    Objekt derselben Agentur, oder von Hand angelegt) darf der Widerruf NICHT
    mitstornieren. Gefunden wird ausschließlich über `block_request_id`.
    """
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    fremde = {
        "id": "bbbbbbbb-0000-4000-8000-000000000001",
        "tenant_id": "t-1",
        "property_id": OBJEKT,
        "unit_id": EINHEIT_A,
        "check_in": "2026-03-01",
        "check_out": "2026-03-04",
        "status": "confirmed",
        "is_owner_stay": True,
        "owner_id": EIGENTUEMER,
        # KEIN Antragsbezug: von Hand erfasst.
        "block_request_id": None,
    }
    tables["reservations"].append(fremde)
    svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung())
    assert [r["id"] for r in _eigennutzungen(tables)] == [fremde["id"]]


def test_zuruecknehmen_nur_aus_genehmigt() -> None:
    with pytest.raises(CalendarError) as exc:
        _svc().zuruecknehmen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409


def test_rollback_auch_bei_nicht_fachlichem_fehler() -> None:
    """Wurzel 1/5: NICHT nur der 409 lässt die Belegung ausfallen — auch ein
    Netz-/DB-Fehler. Der Antrag darf dann nicht 'approved' ohne Belegung
    bleiben.
    """
    tables = _tables()
    svc = _svc(tables)

    def _kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("PostgREST weg")

    svc._eigennutzung_anlegen = _kaputt  # type: ignore[method-assign]  # noqa: SLF001
    with pytest.raises(RuntimeError):
        svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    antrag = tables["block_requests"][0]
    assert antrag["status"] == "pending"  # zurückgerollt, nicht „approved"
    assert antrag["decided_at"] is None


def test_rollback_ist_tenant_gescopt() -> None:
    """Wurzel 3: auch der Rollback filtert auf den Mandanten — er darf keine
    fremde Zeile anfassen, selbst wenn die id stimmte."""
    tables = _tables()
    svc = _svc(tables)
    # Fremder Antrag steht auf pending; ein Rollback mit unserem ctx darf ihn
    # nicht berühren (anderer tenant + anderer Status).
    svc._zuruecksetzen(_ctx(), ANTRAG_FREMD)  # noqa: SLF001 — gezielt der Rollback
    fremd = next(
        r for r in tables["block_requests"] if r["id"] == ANTRAG_FREMD
    )
    assert fremd["status"] == "pending"
    assert "decided_at" not in fremd  # unverändert


# --- Einheiten (0353, Stufe 3) -----------------------------------------------

def test_antrag_auf_eine_einheit_belegt_nur_diese() -> None:
    """Der Kern von Stufe 3: bei einem Typ mit zwei Studios nimmt die
    Eigennutzung eines Studios nur DIESES aus dem Verkauf."""
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_B
    _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())

    res = _eigennutzungen(tables)[0]
    assert res["unit_id"] == EINHEIT_B
    belegte_einheiten = {
        r["unit_id"] for r in tables["availability"] if r["status"] == "booked"
    }
    assert belegte_einheiten == {EINHEIT_B}  # Studio 1 bleibt verkäuflich


def test_antrag_ohne_einheit_belegt_weiterhin_eine_freie() -> None:
    """Gegenprobe: ohne Angabe bleibt es beim bisherigen Verhalten — die RPC
    wählt eine Einheit. Der Fix darf den Normalfall nicht ändern."""
    tables = _tables(einheiten=2)
    _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    res = _eigennutzungen(tables)[0]
    assert res["unit_id"] in {EINHEIT_A, EINHEIT_B}


def test_zwei_antraege_auf_verschiedene_einheiten_gehen_beide() -> None:
    """Zwei Eigentümer-Wünsche auf VERSCHIEDENE Studios desselben Typs sind
    gleichzeitig erfüllbar — vorher nahm der erste Antrag den ganzen Typ."""
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_A
    zweiter = dict(tables["block_requests"][0])
    zweiter["id"] = "66666666-6666-4666-8666-666666666666"
    zweiter["unit_id"] = EINHEIT_B
    zweiter["status"] = "pending"
    tables["block_requests"].append(zweiter)

    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    svc.genehmigen(_ctx(), zweiter["id"], _entscheidung())

    assert {r["unit_id"] for r in _eigennutzungen(tables)} == {
        EINHEIT_A, EINHEIT_B,
    }


def test_liste_zeigt_den_einheitennamen() -> None:
    """Eine nackte UUID in der Warteschlange wäre keine Entscheidungsgrundlage."""
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_B
    item = _svc(tables).liste(_ctx()).items[0]
    assert item.unit_id == EINHEIT_B
    assert item.unit_name == "Studio 2"


def test_entscheidung_liefert_den_einheitennamen_mit() -> None:
    """Direkt nach dem Klick darf die Oberfläche nicht auf eine UUID
    zurückfallen, wo eine Sekunde vorher „Studio 2" stand."""
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_B
    item = _svc(tables).ablehnen(_ctx(), ANTRAG, _entscheidung())
    assert item.unit_name == "Studio 2"


# --- Grenzen -----------------------------------------------------------------

def test_zu_langer_zeitraum_422() -> None:
    """Wurzel 8: ein Tippfehler im Jahr darf nicht Zehntausende Zeilen erzeugen."""
    tables = _tables()
    tables["block_requests"][0]["end_date"] = "2099-03-01"
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 422


def test_end_vor_start_422() -> None:
    tables = _tables()
    tables["block_requests"][0]["end_date"] = "2026-02-01"
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 422


def test_range_ist_inklusiv_bis_end_date() -> None:
    """Ein off-by-one hier ließe je Antrag die letzte Nacht ungesperrt."""
    rng = SperrantragService._range(  # noqa: SLF001 — gezielt die Umrechnung
        {"start_date": "2026-03-01", "end_date": "2026-03-03"}
    )
    assert rng.start == date(2026, 3, 1)
    assert rng.end == date(2026, 3, 4)  # exklusiv
    assert len(rng.nights()) == 3


# --- Empfängerkreis der Meldung ---------------------------------------------

def test_nur_entscheider_bekommen_die_meldung() -> None:
    """Die Reinigungskraft (kein APPROVE_BLOCK) darf nichts erfahren."""
    from src.features.calendar.sperrantraege import _darf_entscheiden  # noqa: PLC0415

    assert _darf_entscheiden("admin") is True
    assert _darf_entscheiden("co_admin") is True
    assert _darf_entscheiden("cleaner") is False
    assert _darf_entscheiden("owner") is False
    # Fail-closed (Wurzel 6): unbekannte/fehlende Rolle bekommt nichts.
    assert _darf_entscheiden("phantasie") is False
    assert _darf_entscheiden(None) is False


# --- Widerruf reißt fremde Sperren NICHT auf (Befund 6, Wurzel 1) ------------

def _agentur_sperre(tables: dict[str, list[dict]], *tage: str) -> None:
    """Eine von der AGENTUR gesetzte manuelle Sperre (Renovierung).

    Sie trägt exakt dieselbe Signatur wie eine Antragssperre —
    `status='blocked'`, `source='manual'` — und war deshalb vom Widerruf eines
    Eigentümer-Antrags nicht zu unterscheiden.
    """
    for tag in tage:
        tables["availability"].append(
            {
                "property_id": OBJEKT,
                "date": tag,
                "status": "blocked",
                "source": "manual",
                "unit_id": EINHEIT_A,
                # KEIN Antragsbezug: eine Betriebssperre entsteht ohne Antrag
                # (0337). Genau daran wird sie jetzt erkannt.
                "block_request_id": None,
            }
        )


def test_widerruf_laesst_agentur_sperre_stehen() -> None:
    """BEFUND 6 — der Widerruf riss die Sperre des BETRIEBS mit auf.

    Ablauf: Die Agentur sperrt 1.–5. März wegen Handwerkern. Ein Eigentümer
    beantragt 1.–3. Seit 0353 scheitert die Genehmigung daran, dass die Einheit
    im Zeitraum gesperrt ist (die Sperre steht ja) — der Antrag bleibt offen,
    und die Handwerker-Sperre steht unangetastet. Vorher entstand daneben eine
    zweite `blocked`-Zeile, deren Widerruf die Handwerker-Sperre mitriss.
    """
    tables = _tables(einheiten=2)
    _agentur_sperre(
        tables, "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
        "2026-03-05",
    )
    tables["block_requests"][0]["unit_id"] = EINHEIT_A
    svc = _svc(tables)
    with pytest.raises(Exception) as exc:  # noqa: PT011 — Klasse hier nebensächlich
        svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert not isinstance(exc.value, AssertionError)

    verbleibend = sorted(
        r["date"] for r in tables["availability"] if r["status"] == "blocked"
    )
    # Die Agentur-Sperre steht für ALLE fünf Tage weiter.
    assert verbleibend == [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ]
    assert tables["block_requests"][0]["status"] == "pending"


def test_widerruf_eines_altbestand_antrags_raeumt_die_blocked_zeilen() -> None:
    """Anträge, die VOR 0353 genehmigt wurden, haben eine anonyme
    `blocked`-Nacht mit `availability.block_request_id` (0337) hinterlassen.

    Ihr Widerruf muss weiter funktionieren — ohne den Unblock-Weg wäre jeder
    dieser Anträge unwiderrufbar und das Objekt dauerhaft gesperrt.
    """
    tables = _tables()
    antrag = tables["block_requests"][0]
    antrag["status"] = "approved"
    for tag in ("2026-03-01", "2026-03-02", "2026-03-03"):
        tables["availability"].append(
            {
                "property_id": OBJEKT,
                "date": tag,
                "status": "blocked",
                "source": "manual",
                "unit_id": EINHEIT_A,
                "block_request_id": ANTRAG,
            }
        )
    _svc(tables).zuruecknehmen(_ctx(), ANTRAG, _entscheidung())
    assert [
        r for r in tables["availability"] if r["status"] == "blocked"
    ] == []


# --- Sprache der Entscheider-Meldung (0335) ---

def test_neuer_antrag_meldet_mit_uebersetzbaren_schluesseln(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Die Meldung an die Entscheider muss ÜBERSETZBAR rausgehen.

    Hier stand ein hart deutscher f-String („Ein Eigentümer möchte … sperren"),
    während der Gegenpart (Entscheidung an den Antragsteller) längst Schlüssel
    übergab. Ein dänischer Betrieb bekam damit für JEDEN neuen Antrag eine
    deutsche Mail — unabhängig von seiner Sprachwahl. Der Test hält fest, dass
    Betreff und Rumpf als KATALOGSCHLÜSSEL übergeben werden (der Dispatcher
    übersetzt sie in die Sprache des Empfängers) und die Platzhalterwerte
    mitkommen.
    """
    gesendet: list[dict] = []

    class _FakeDispatcher:
        def __init__(self, _db: object) -> None:
            pass

        def sende(self, **kwargs: object) -> None:
            gesendet.append(kwargs)

    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.NotificationDispatcher",
        _FakeDispatcher,
    )
    tables = _tables()
    antrag = tables["block_requests"][0]
    melde_neuen_antrag(_DB(tables), "t-1", antrag, "Villa")

    # Nur die Entscheiderin (admin), NICHT die Reinigungskraft/der Eigentümer.
    assert [m["user_id"] for m in gesendet] == ["admin-1"]
    meldung = gesendet[0]
    assert meldung["betreff_key"] == "sperrantrag.neu"
    # Die Begründung steht als EIGENER Absatz-Schlüssel dahinter, damit sie
    # entfallen kann, ohne ein leeres „Begründung:" zu hinterlassen.
    assert meldung["text_key"] == [
        "sperrantrag.rumpf_neu", "sperrantrag.begruendung",
    ]
    assert meldung["betreff_werte"]["titel"] == "Villa"
    assert meldung["text_werte"]["grund"] == "Eigennutzung"
    # Kein deutscher Rohtext mehr im übersetzbaren Teil.
    assert "Ein Eigentümer möchte" not in str(meldung["betreff_key"])


def test_neuer_antrag_ohne_begruendung_laesst_absatz_weg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fehlt die Begründung, darf kein leerer „Begründung:"-Absatz entstehen."""
    gesendet: list[dict] = []

    class _FakeDispatcher:
        def __init__(self, _db: object) -> None:
            pass

        def sende(self, **kwargs: object) -> None:
            gesendet.append(kwargs)

    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.NotificationDispatcher",
        _FakeDispatcher,
    )
    tables = _tables()
    antrag = dict(tables["block_requests"][0])
    antrag["reason"] = "   "  # nur Leerzeichen = keine Begründung
    melde_neuen_antrag(_DB(tables), "t-1", antrag, "Villa")

    meldung = gesendet[0]
    assert meldung["text_key"] == ["sperrantrag.rumpf_neu"]
    assert "grund" not in meldung["text_werte"]
