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

import pathlib
from datetime import date, timedelta
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.calendar.schemas import BlockRequestDecision, LeistungEntscheidung
from src.features.calendar.service import CalendarError
from src.features.calendar.sperrantraege import SperrantragService
from src.features.calendar.sperrantrag_meldung import melde_neuen_antrag

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
        self._not_in: tuple[str, list] | None = None
        # Setzt `.not_`; gilt für den unmittelbar folgenden Operator.
        self._negiert = False
        self._gte: tuple[str, str] | None = None
        self._gt: tuple[str, str] | None = None
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
        # Nach `.not_` ist es ein AUSSCHLUSS. Ohne diese Unterscheidung hätte
        # der Fake `not_.in_(status, [cancelled, …])` wie ein normales `in_`
        # behandelt und damit GENAU DAS GEGENTEIL gefiltert: nur stornierte
        # Buchungen wären Hindernisse gewesen und keine einzige echte.
        if self._negiert:
            self._not_in = (col, vals)
            self._negiert = False
        else:
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

    def gt(self, col: str, val: str) -> _Query:
        # Wirkt WIRKLICH (verwarf früher still): der Kollisions-Check fragt
        # Überlappung als `check_out > von` — ein ignoriertes `gt` hätte jede
        # abgereiste Buchung als Hindernis gemeldet und den Test grün gelogen.
        self._gt = (col, val)
        return self

    @property
    def not_(self) -> _Query:
        # PostgREST-Kette `.not_.is_(...)`/`.not_.in_(...)` — `not_` ist eine
        # PROPERTY, keine Methode (siehe pricing/resolver.py:444). Sie merkt
        # sich nur, dass der NÄCHSTE Operator negiert gilt.
        self._negiert = True
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
        if ok and self._not_in:
            col, vals = self._not_in
            ok = str(row.get(col)) not in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._gt:
            ok = str(row.get(self._gt[0])) > self._gt[1]
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
                # Wie der DB-Default (0389): ein Antrag des Eigentümers selbst
                # braucht keine Familien-Freigabe und ist für die Agentur
                # sofort sichtbar. Ohne das Feld filterte `_laden` die Zeile
                # heraus — in der echten DB kann es NULL nicht geben
                # (`not null default 'nicht_noetig'`).
                "owner_freigabe": "nicht_noetig",
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
                "owner_freigabe": "nicht_noetig",
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
        "task_rules": [
            # Zwei bestellbare Leistungen (0538): die Regelnamen braucht der
            # Listenpfad, sonst faellt die Bestellung als „geloescht" heraus.
            {"id": "rule-rein", "tenant_id": "t-1", "name": "Endreinigung",
             "kind": "auto", "active": True},
            {"id": "rule-waesche", "tenant_id": "t-1", "name": "Waesche",
             "kind": "auto", "active": True},
        ],
        "tasks": [],
        "block_request_services": [],
    }


def _bestellt(tables: dict[str, list[dict]], *rule_ids: str) -> None:
    """Der Eigentuemer hat zu ANTRAG diese Leistungen bestellt (Zustand wie
    nach `request_block`: `angefragt`)."""
    for rid in rule_ids:
        tables["block_request_services"].append(
            {"id": f"brs-{rid}", "block_request_id": ANTRAG, "rule_id": rid,
             "status": "angefragt"}
        )


def _leistung(rule_id: str, genehmigt: bool, notiz: str | None = None) -> LeistungEntscheidung:
    return LeistungEntscheidung(rule_id=rule_id, genehmigt=genehmigt, notiz=notiz)


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


# --- Leistungen je Zeile genehmigen (0538) ------------------------------------
#
# Vorgabe des Betriebs (03.09.2026): „ein Eigentuemer muss eine Reinigung buchen
# und eine Endreinigung. Die muss genehmigt werden von der Agentur." Bis 0538
# fuhr die Bestellung mit der Genehmigung des Antrags blind mit.


def _status(tables: dict[str, list[dict]]) -> dict[str, str]:
    return {
        str(z["rule_id"]): str(z.get("status"))
        for z in tables["block_request_services"]
    }


def test_genehmigen_entscheidet_jede_leistung_einzeln() -> None:
    """Sperre genehmigt, Endreinigung genehmigt, Waesche abgelehnt."""
    tables = _tables()
    _bestellt(tables, "rule-rein", "rule-waesche")
    req = BlockRequestDecision(
        leistungen=[
            _leistung("rule-rein", True),
            _leistung("rule-waesche", False, "diese Woche nicht"),
        ]
    )
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, req)
    assert item.status == "approved"
    assert _status(tables) == {"rule-rein": "genehmigt", "rule-waesche": "abgelehnt"}
    # Die Antwort traegt den Zustand je Leistung samt Begruendung.
    je = {b.rule_id: b for b in item.bestellte_leistungen}
    assert je["rule-rein"].status == "genehmigt"
    assert je["rule-waesche"].status == "abgelehnt"
    assert je["rule-waesche"].entscheidungsnotiz == "diese Woche nicht"
    # Entscheidungsspur an der Zeile.
    abgelehnt = next(z for z in tables["block_request_services"] if z["rule_id"] == "rule-waesche")
    assert abgelehnt["entschieden_von"] == "admin-1"


def test_genehmigen_ohne_entscheidung_zu_bestellter_leistung_422() -> None:
    """Die blinde Mitgenehmigung von vor 0538 — jetzt ein Fehler, VOR dem Claim.

    Ein Client, der die Leistungen nicht kennt (Altstand), scheitert laut,
    statt eine Endreinigung zu genehmigen, die niemand gesehen hat.
    """
    tables = _tables()
    _bestellt(tables, "rule-rein")
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 422
    # Nichts angefasst: Antrag offen, Zeile unveraendert, keine Eigennutzung.
    assert tables["block_requests"][0]["status"] == "pending"
    assert _status(tables) == {"rule-rein": "angefragt"}
    assert _eigennutzungen(tables) == []


def test_genehmigen_entscheidung_zu_nicht_bestellter_leistung_422() -> None:
    tables = _tables()
    _bestellt(tables, "rule-rein")
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(
            _ctx(), ANTRAG,
            BlockRequestDecision(
                leistungen=[_leistung("rule-rein", True), _leistung("rule-waesche", True)]
            ),
        )
    assert exc.value.status_code == 422
    assert tables["block_requests"][0]["status"] == "pending"


def test_genehmigen_ohne_bestellung_braucht_keine_entscheidung() -> None:
    """Der Normalfall: nichts bestellt, `leistungen` leer, alles wie bisher."""
    tables = _tables()
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert item.status == "approved"
    assert item.bestellte_leistungen == []


def test_rollback_setzt_leistungen_zurueck() -> None:
    """Scheitert die Belegung, gehen die Leistungsentscheidungen mit dem Claim
    zurueck (Wurzel 1) — sonst faende der naechste Lauf eine Entscheidung vor,
    die niemand in diesem Lauf getroffen hat."""
    tables = _tables()
    _bestellt(tables, "rule-rein")
    tables["availability"].append(
        {"property_id": OBJEKT, "date": "2026-03-02", "status": "booked",
         "source": "airbnb", "unit_id": EINHEIT_A}
    )
    svc = _svc(tables)
    with pytest.raises(Exception):  # noqa: PT011,B017 — Fehlerklasse ist hier egal
        svc.genehmigen(
            _ctx(), ANTRAG,
            BlockRequestDecision(leistungen=[_leistung("rule-rein", True)]),
        )
    assert tables["block_requests"][0]["status"] == "pending"
    assert _status(tables) == {"rule-rein": "angefragt"}
    zeile = tables["block_request_services"][0]
    assert zeile["entschieden_von"] is None


def test_ablehnen_lehnt_auch_die_leistungen_ab() -> None:
    tables = _tables()
    _bestellt(tables, "rule-rein", "rule-waesche")
    item = _svc(tables).ablehnen(_ctx(), ANTRAG, _entscheidung("leider nein"))
    assert item.status == "rejected"
    assert _status(tables) == {"rule-rein": "abgelehnt", "rule-waesche": "abgelehnt"}
    assert all(b.status == "abgelehnt" for b in item.bestellte_leistungen)


def test_zuruecknehmen_lehnt_die_leistungen_ab() -> None:
    tables = _tables()
    _bestellt(tables, "rule-rein")
    svc = _svc(tables)
    svc.genehmigen(
        _ctx(), ANTRAG, BlockRequestDecision(leistungen=[_leistung("rule-rein", True)])
    )
    assert _status(tables) == {"rule-rein": "genehmigt"}
    svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung("doch nicht"))
    assert _status(tables) == {"rule-rein": "abgelehnt"}


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


def test_zuruecknehmen_vermerkt_den_betrieb_als_storno_partei() -> None:
    """0410 — WER hat storniert? Hier der BETRIEB, nicht der Eigentümer.

    Beantragt hat die Sperre der Eigentümer; zurückgenommen wird die
    GENEHMIGUNG, und die trägt nur admin/co_admin (Capability APPROVE_BLOCK).
    Stünde hier `eigentuemer`, sähe es in der Storno-Historie aus, als hätte er
    seine Sperre selbst zurückgezogen — eine Falschaussage, auf deren Grundlage
    ab Etappe 3 über Provision entschieden wird.
    """
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung())
    svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung("doch nicht"))
    storniert = [
        r for r in tables["reservations"] if r.get("status") == "cancelled"
    ]
    assert storniert, "keine stornierte Eigennutzung gefunden"
    assert storniert[0]["cancelled_by_party"] == "betrieb"
    assert storniert[0]["cancel_reason_code"] == "eigennutzung_aufgeloest"


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


# --- Kollisionsprüfung (Vorschau + Riegel) -----------------------------------
#
# Warum diese Tests: der Riegel ersetzt einen nackten 409 aus dem
# Reservierungs-Pfad durch eine AUSSAGE. Was hier schiefgehen kann, ist nicht
# „gar keine Prüfung", sondern eine FALSCHE Aussage — ein Hindernis melden, das
# der Schreibpfad gar nicht sieht (Antrag bliebe grundlos liegen), oder „frei"
# sagen und beim Klick 409 kassieren.


def _buchung(
    tables: dict[str, list[dict]],
    *,
    check_in: str = "2026-03-02",
    check_out: str = "2026-03-05",
    unit_id: str = EINHEIT_A,
    status: str = "confirmed",
    source: str = "airbnb",
) -> str:
    """Eine echte Gastbuchung samt ihrer Kalenderzeilen.

    Beides zusammen, weil die Prüfung beides liest: `reservations` für die
    Aufzählung im Dialog, `availability` für die Frage, ob eine Einheit
    durchgehend frei ist.
    """
    rid = f"res-{len(tables['reservations']) + 1}"
    tables["reservations"].append(
        {
            "id": rid,
            "tenant_id": "t-1",
            "property_id": OBJEKT,
            "guest_id": "gast-1",
            "unit_id": unit_id,
            "check_in": check_in,
            "check_out": check_out,
            "status": status,
            "channel": "airbnb",
            "ota_name": "Airbnb",
            "total_amount": 640.0,
            "currency": "DKK",
            "is_owner_stay": False,
        }
    )
    tag = date.fromisoformat(check_in)
    ende = date.fromisoformat(check_out)
    while tag < ende:
        # KEINE `reservation_id`: die Spalte gibt es in `availability` nicht
        # (live geprüft — sie warf `42703 column availability.reservation_id
        # does not exist`). Dass hier eine Buchung dahintersteht, sagt allein
        # `status='booked'`. Ein Fake mit einer erfundenen Spalte hätte den
        # Fehler grün gemacht — genau wie zuvor bei `users.name`.
        tables["availability"].append(
            {
                "property_id": OBJEKT,
                "date": tag.isoformat(),
                "status": "booked",
                "source": source,
                "unit_id": unit_id,
            }
        )
        tag += timedelta(days=1)
    tables.setdefault("guests", []).append(
        {
            "id": "gast-1",
            "tenant_id": "t-1",
            "first_name": "Mette",
            "last_name": "Zempel",
        }
    )
    return rid


def test_kollisionen_zeigt_die_buchung_mit_allem_zum_entscheiden() -> None:
    """Der Dialog muss sagen WER, WANN, WIEVIEL — sonst muss man doch suchen."""
    tables = _tables()
    rid = _buchung(tables)
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.grund == "belegt"
    assert k.buchungen_gesamt == 1
    treffer = k.buchungen[0]
    assert treffer.reservation_id == rid
    assert treffer.art == "buchung"
    assert treffer.bezeichnung == "Mette Zempel"
    assert treffer.unit_name == "Studio 1"
    assert treffer.total_amount == 640.0
    # Währung aus der Zeile, kein €-Ersatz (Wurzel 4).
    assert treffer.currency == "DKK"


def test_kollisionen_meldet_frei_wenn_nichts_im_weg() -> None:
    k = _svc().kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.grund is None
    assert k.buchungen_gesamt == 0
    assert k.freie_einheit_id == EINHEIT_A
    assert k.min_freie_einheiten == 1
    assert k.naechte == 3
    # Nach außen INKLUSIV, wie der Antrag gestellt wurde.
    assert k.end_date == date(2026, 3, 3)


def test_kollisionen_ignoriert_reine_ota_sperre() -> None:
    """Wurzel 3: derselbe Kanal-Filter wie der Schreibpfad.

    Eine `source='portal'`-Sperre stammt aus dem Channex-Import und gilt nur
    für OTAs — die Rezeption (und damit die Eigennutzung) darf trotzdem
    belegen. Meldete die Vorschau sie als Hindernis, bliebe der Antrag
    grundlos liegen, obwohl der Klick funktioniert hätte.
    """
    tables = _tables()
    tables["availability"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "status": "blocked",
            "source": "portal",
            "unit_id": EINHEIT_A,
        }
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.sperrtage_gesamt == 0


def test_kollisionen_sieht_manuelle_sperre_ohne_buchung() -> None:
    """Handwerker-Sperre: kein Storno, sondern im Kalender aufheben."""
    tables = _tables()
    tables["availability"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "status": "blocked",
            "source": "manual",
            "unit_id": EINHEIT_A,
        }
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.buchungen_gesamt == 0  # nichts zu stornieren
    assert k.sperrtage_gesamt == 1
    assert k.sperrtage[0].source == "manual"
    assert k.sperrtage[0].unit_name == "Studio 1"


def test_kollisionen_sieht_stop_sell_der_in_availability_fehlt() -> None:
    """Stop-Sell blockt den Schreibpfad, steht aber NICHT in `availability`.

    Ohne eigene Abfrage sagte die Vorschau „frei" und der Klick kassierte 409.
    """
    tables = _tables()
    tables["stop_sell"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "scope": "all",
            "channels": [],
            "rate_plan_id": None,
        }
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.grund == "stop_sell"
    assert k.stop_sell_gesamt == 1
    assert k.stop_sell_tage == ["2026-03-02"]


def test_kollisionen_abgereiste_buchung_ist_kein_hindernis() -> None:
    """Check-out ist EXKLUSIV: wer am Anreisetag abreist, kollidiert nicht."""
    tables = _tables()
    _buchung(tables, check_in="2026-02-25", check_out="2026-03-01")
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.buchungen_gesamt == 0


@pytest.mark.parametrize("status", ["cancelled", "declined", "expired"])
def test_kollisionen_tote_buchung_ist_kein_hindernis(status: str) -> None:
    """Alle drei Zustände, die den Kalender NICHT belegen — gegen das echte
    Enum `reservation_status` geprüft (es gibt kein `checked_in`)."""
    tables = _tables()
    _buchung(tables, status=status)
    # Der Kalender ist bei einem Storno freigegeben — hier ohne die Zeilen.
    tables["availability"] = []
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.buchungen_gesamt == 0


def test_kollisionen_lebende_buchung_zaehlt_trotz_leerem_kalender() -> None:
    """Beweist, dass der Ausschluss-Filter RICHTIG HERUM wirkt.

    Ohne diesen Test wäre eine Umkehrung (`in_` statt `not_.in_`) unentdeckt
    geblieben: dann hätte nur eine STORNIERTE Buchung als Hindernis gezählt
    und keine einzige echte. Hier ist der Kalender bewusst leer, damit der
    Befund allein aus der Reservierungs-Abfrage stammt.
    """
    tables = _tables()
    _buchung(tables, status="confirmed")
    tables["availability"] = []
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    # Der Kalender ist leer → nicht blockiert (die Einheit ist frei), aber die
    # Buchung MUSS ausgewiesen sein, sonst filtert die Abfrage falsch.
    assert k.buchungen_gesamt == 1
    assert k.buchungen[0].status == "confirmed"


def test_kollisionen_zweite_einheit_bleibt_frei() -> None:
    """0265: ein belegter Tag ist bei n Einheiten KEIN Hindernis.

    Bei zwei Studios und einer Buchung in Studio 1 kann die Eigennutzung in
    Studio 2 — genau das entscheidet auch die RPC (0275).
    """
    tables = _tables(einheiten=2)
    _buchung(tables, unit_id=EINHEIT_A)
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.freie_einheit_id == EINHEIT_B
    assert k.einheiten_gesamt == 2
    # Die Buchung wird trotzdem AUSGEWIESEN — der Entscheider soll sehen, dass
    # das Objekt nicht leer ist, auch wenn es nicht blockiert.
    assert k.buchungen_gesamt == 1


def test_kollisionen_verzahnte_buchungen_lassen_keine_einheit_durchgehend_frei() -> None:
    """Tageweise „eine frei" genügt NICHT — die Eigennutzung braucht EINE
    Einheit für ALLE Nächte. Zwei versetzte Buchungen über zwei Einheiten
    lassen jeden Tag eine frei, aber keine durchgehend."""
    tables = _tables(einheiten=2)
    _buchung(tables, check_in="2026-03-01", check_out="2026-03-03", unit_id=EINHEIT_A)
    _buchung(tables, check_in="2026-03-03", check_out="2026-03-04", unit_id=EINHEIT_B)
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.freie_einheit_id is None
    assert k.buchungen_gesamt == 2


def test_kollisionen_bei_vorgegebener_einheit_nur_diese_zaehlt() -> None:
    """Der Antrag meint „Studio 2" — eine Buchung in Studio 1 steht nicht
    im Weg und darf nicht als Hindernis erscheinen."""
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_B
    _buchung(tables, unit_id=EINHEIT_A)
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is False
    assert k.unit_name == "Studio 2"
    assert k.buchungen_gesamt == 0


def test_kollisionen_vorgegebene_einheit_belegt_blockiert() -> None:
    tables = _tables(einheiten=2)
    tables["block_requests"][0]["unit_id"] = EINHEIT_B
    _buchung(tables, unit_id=EINHEIT_B)
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.buchungen_gesamt == 1


def test_kollisionen_eigennutzung_wird_als_solche_ausgewiesen() -> None:
    """Eine fremde Eigennutzung löst man über den Widerruf ihres Antrags auf,
    nicht über einen Storno — darum eine eigene `art`."""
    tables = _tables()
    tables["reservations"].append(
        {
            "id": "res-own",
            "tenant_id": "t-1",
            "property_id": OBJEKT,
            "guest_id": None,
            "unit_id": EINHEIT_A,
            "check_in": "2026-03-02",
            "check_out": "2026-03-04",
            "status": "confirmed",
            "channel": "direct",
            "total_amount": 0,
            "is_owner_stay": True,
            "owner_id": EIGENTUEMER,
            "stay_name": "Familie Ohm",
            "block_request_id": "ein-anderer-antrag",
        }
    )
    tables["availability"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "status": "booked",
            "source": "manual",
            "unit_id": EINHEIT_A,
        }
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.buchungen[0].art == "eigennutzung"
    assert k.buchungen[0].bezeichnung == "Familie Ohm"
    assert k.buchungen[0].is_owner_stay is True
    # `booked` gehört zu einer Buchung, die schon oben steht — sie darf nicht
    # zusätzlich als „gesperrte Nacht" erscheinen, sonst zeigt der Dialog
    # alles doppelt. Das trennt der STATUS, nicht eine reservation_id.
    assert k.sperrtage_gesamt == 0


def test_kollisionen_vertragsende_wird_als_solches_benannt() -> None:
    """Live gelernt (Kornblomst, Antrag „2027 komplett", 12.08.2026):

    Dort lagen 365 `contract_end`-Nächte UND 223 Stop-Sell-Tage. „Verkaufsstopp"
    zu melden wäre wahr, aber irreführend gewesen — die 223 Tage aufzuheben
    hätte nichts geändert, weil der Verwaltungsvertrag vor 2027 endet. Die
    Vertragssperre MUSS die genannte Ursache sein.
    """
    tables = _tables()
    for tag in ("2026-03-01", "2026-03-02", "2026-03-03"):
        tables["availability"].append(
            {
                "property_id": OBJEKT,
                "date": tag,
                "status": "blocked",
                "source": "contract_end",
                "unit_id": EINHEIT_A,
            }
        )
    tables["stop_sell"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "scope": "all",
            "channels": [],
            "rate_plan_id": None,
        }
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.grund == "vertragsende"  # NICHT stop_sell
    assert k.sperrtage_gesamt == 3


def test_genehmigen_nennt_vertragsende_und_nicht_den_stop_sell() -> None:
    tables = _tables()
    tables["availability"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "status": "blocked",
            "source": "contract_end",
            "unit_id": EINHEIT_A,
        }
    )
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409
    assert "Verwaltungsvertrag" in exc.value.message
    assert tables["block_requests"][0]["status"] == "pending"


def test_kollisionen_fremder_mandant_404() -> None:
    """Wurzel 9: derselbe Scope wie List- und Approve-Pfad."""
    with pytest.raises(CalendarError) as exc:
        _svc().kollisionen(_ctx(), ANTRAG_FREMD)
    assert exc.value.status_code == 404


def test_kollisionen_schlaegt_freie_spanne_vor() -> None:
    """Sagt der Dialog nur „belegt", muss die Entscheiderin selbst suchen."""
    tables = _tables()
    _buchung(tables, check_in="2026-03-01", check_out="2026-03-02")
    k = _svc(tables).kollisionen(_ctx(), ANTRAG)
    assert k.blockiert is True
    assert k.frei_von == date(2026, 3, 2)
    assert k.frei_bis == date(2026, 3, 3)


def test_genehmigen_nennt_die_kollidierende_buchung_im_409() -> None:
    """Der Kern des Auftrags: statt „enthält belegte Tage" steht im Fehler,
    WAS im Weg ist — und der Antrag bleibt offen (Wurzel 1)."""
    tables = _tables()
    _buchung(tables)
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409
    assert "Mette Zempel" in exc.value.message
    antrag = tables["block_requests"][0]
    assert antrag["status"] == "pending"  # Claim zurückgerollt
    assert antrag["decided_by"] is None
    assert _eigennutzungen(tables) == []


def test_genehmigen_nennt_stop_sell_im_409() -> None:
    tables = _tables()
    tables["stop_sell"].append(
        {
            "property_id": OBJEKT,
            "date": "2026-03-02",
            "scope": "all",
            "channels": [],
            "rate_plan_id": None,
        }
    )
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert exc.value.status_code == 409
    assert "Stop-Sell" in exc.value.message
    assert tables["block_requests"][0]["status"] == "pending"


def test_genehmigen_laeuft_bei_buchung_in_anderer_einheit_durch() -> None:
    """Der Riegel darf nicht strenger sein als der Schreibpfad."""
    tables = _tables(einheiten=2)
    _buchung(tables, unit_id=EINHEIT_A)
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert item.status == "approved"
    assert len(_eigennutzungen(tables)) == 1


# --- Vertragskündigung (0377) ------------------------------------------------
#
# Der reale Fall: Der Eigentümer von „Feriehus Kornblomst" beantragte
# 2027-01-01 bis 2027-12-31 mit „Vi er ikke interesseret i udlejning 2027" — er
# wollte kündigen, gespeichert wurde eine Jahres-Sperre. Ohne dieses Feld musste
# die Agentur den dänischen Freitext deuten und `contract_end_date` von Hand
# nachtragen; wird das vergessen, läuft der Vertrag mit Provision und
# Portal-Distribution weiter, während der Kalender ein Jahr zu ist.


def _entscheidung_kuendigung(
    note: str | None = None, ende: date | None = None
) -> BlockRequestDecision:
    return BlockRequestDecision(
        note=note, als_kuendigung=True, vertragsende=ende
    )


def _property(tables: dict[str, list[dict]]) -> dict:
    return next(p for p in tables["properties"] if p["id"] == OBJEKT)


# Der Antragszeitraum der Standard-Fixture liegt im März 2026 und damit in der
# VERGANGENHEIT (heute ist der 12.08.2026). Für eine Sperre ist das gleichgültig
# — die Tests prüfen dort die Zustandslogik. Eine Kündigung dagegen lehnt ein
# Datum vor heute bewusst ab (ein Vertrag, der seit Monaten beendet wäre,
# während das Objekt verkauft wurde). Darum ein eigener, in der Zukunft
# liegender Zeitraum, statt die Prüfung für die Tests aufzuweichen.
KUENDIGUNG_START = date.today() + timedelta(days=140)
KUENDIGUNG_ENDE = KUENDIGUNG_START + timedelta(days=2)


def _kuendigungs_antrag(**kwargs: object) -> dict[str, list[dict]]:
    """Tabellen mit einem Antrag, dessen Zeitraum in der Zukunft liegt."""
    tables = _tables(**kwargs)  # type: ignore[arg-type]
    tables["block_requests"][0]["start_date"] = KUENDIGUNG_START.isoformat()
    tables["block_requests"][0]["end_date"] = KUENDIGUNG_ENDE.isoformat()
    return tables


def test_kuendigung_setzt_vertragsende_auf_start_date() -> None:
    """Ohne ausdrückliches Datum gilt der Antragsbeginn: „ab da nicht mehr
    vermieten" heißt „ab da kein Vertrag" — nichts wird gerundet oder
    geraten (Wurzel 4)."""
    tables = _kuendigungs_antrag()
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    assert item.status == "approved"
    assert item.als_kuendigung_gewertet is True
    assert item.vertragsende_gesetzt_auf == KUENDIGUNG_START
    assert _property(tables)["contract_end_date"] == KUENDIGUNG_START.isoformat()


def test_kuendigung_nimmt_ausdrueckliches_datum() -> None:
    """Der Vertrag kann noch bis Monatsende laufen — dann entscheidet die
    Agentur das Datum, nicht der Antragszeitraum."""
    tables = _kuendigungs_antrag()
    item = _svc(tables).genehmigen(
        _ctx(), ANTRAG, _entscheidung_kuendigung(ende=KUENDIGUNG_ENDE)
    )
    assert item.vertragsende_gesetzt_auf == KUENDIGUNG_ENDE
    assert _property(tables)["contract_end_date"] == KUENDIGUNG_ENDE.isoformat()


def test_kuendigung_legt_keine_eigennutzung_an() -> None:
    """Eine Kündigung ist keine Belegung. Der normale Pfad legte eine
    Reservierung an — hier wäre das doppelt falsch: er verlangte einen
    Personenbezug für einen Aufenthalt, den es nicht gibt, und sperrte GENAU
    den beantragten Zeitraum, während ein Vertragsende unbefristet gilt."""
    tables = _kuendigungs_antrag()
    _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    assert _eigennutzungen(tables) == []


def test_kuendigung_braucht_keinen_eigentuemer_eintrag() -> None:
    """Der Sperr-Pfad verlangt einen `owners`-Eintrag (der Aufenthalt braucht
    einen Personenbezug). Eine Kündigung nicht — sie kündigt einen Vertrag am
    OBJEKT. Ohne diese Trennung wäre eine Kündigung an einem Objekt ohne
    Eigentümer-Zuordnung mit 422 gescheitert, obwohl sie nichts davon braucht.
    """
    tables = _kuendigungs_antrag(mit_eigentuemer=False)
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    assert item.status == "approved"


def test_kuendigung_ist_idempotent() -> None:
    """Wurzel 2: der zweite Klick bekommt 409 und setzt das Datum NICHT
    erneut — sonst überschriebe er einen inzwischen von Hand korrigierten
    Wert."""
    tables = _kuendigungs_antrag()
    _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    _property(tables)["contract_end_date"] = "2026-06-01"  # Handkorrektur
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    assert exc.value.status_code == 409
    assert _property(tables)["contract_end_date"] == "2026-06-01"


def test_kuendigung_in_der_vergangenheit_422() -> None:
    """Ein Vertragsende in der Vergangenheit hieße, das Objekt sei seit Monaten
    nicht unter Vertrag — während es verkauft wurde. Klar fehlschlagen statt
    glattbügeln (Wurzel 4)."""
    tables = _kuendigungs_antrag()
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(
            _ctx(), ANTRAG, _entscheidung_kuendigung(ende=date(2020, 1, 1))
        )
    assert exc.value.status_code == 422
    assert tables["block_requests"][0]["status"] == "pending"


def test_kuendigung_des_eigentuemers_braucht_kein_agentur_haekchen() -> None:
    """Hat der Eigentümer es selbst erklärt (`ist_kuendigung`), handelt der
    Genehmigen-Pfad ohnehin danach — die Agentur bestätigt nur."""
    tables = _kuendigungs_antrag()
    tables["block_requests"][0]["ist_kuendigung"] = True
    item = _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert item.vertragsende_gesetzt_auf == KUENDIGUNG_START
    # Die Wertung der Agentur bleibt FALSE: es war seine Erklärung, nicht ihre
    # Auslegung. Beides zu vermischen hieße hinterher behaupten, die Agentur
    # habe ausgelegt, wo der Eigentümer erklärt hat.
    assert item.als_kuendigung_gewertet is False
    assert item.ist_kuendigung is True


def test_kuendigung_ohne_haekchen_bleibt_eine_sperre() -> None:
    """Der Normalfall darf sich NICHT ändern: ohne beide Merkmale ist ein
    Antrag eine Nächte-Sperre und kein Vertragsende."""
    tables = _kuendigungs_antrag()
    _svc(tables).genehmigen(_ctx(), ANTRAG, _entscheidung())
    assert len(_eigennutzungen(tables)) == 1
    assert _property(tables).get("contract_end_date") is None


def test_widerruf_nimmt_das_vertragsende_zurueck() -> None:
    """Wurzel 1 — der Gegenzustand: bleibt das Ende stehen, ist das Objekt für
    immer aus dem Verkauf, ohne dass ein Antrag darauf hinweist."""
    tables = _kuendigungs_antrag()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    assert _property(tables)["contract_end_date"] == KUENDIGUNG_START.isoformat()
    item = svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung("doch nicht"))
    assert item.status == "rejected"
    assert _property(tables)["contract_end_date"] is None


def test_widerruf_laesst_ein_fremdes_vertragsende_stehen() -> None:
    """NUR der eigene Gegenzustand (Wurzel 1): hat jemand nach der Genehmigung
    ein anderes Ende eingetragen, ist das eine jüngere Entscheidung. Der
    Widerruf DIESES Antrags darf sie nicht überschreiben."""
    tables = _kuendigungs_antrag()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), ANTRAG, _entscheidung_kuendigung())
    _property(tables)["contract_end_date"] = "2027-01-01"  # jüngere Entscheidung
    svc.zuruecknehmen(_ctx(), ANTRAG, _entscheidung())
    assert _property(tables)["contract_end_date"] == "2027-01-01"


def test_kollisionen_als_kuendigung_ist_contract_end_kein_hindernis() -> None:
    """Der live gefundene Fall: Kornblomst war 2027 komplett gesperrt, weil das
    Vertragsende 09.10.2026 längst am Objekt stand. Als SPERRE geprüft ist das
    ein Hindernis, als KÜNDIGUNG geprüft ist es der Zielzustand."""
    tables = _kuendigungs_antrag()
    for tag in [
        (KUENDIGUNG_START + timedelta(days=i)).isoformat() for i in range(3)
    ]:
        tables["availability"].append(
            {
                "property_id": OBJEKT,
                "date": tag,
                "status": "blocked",
                "source": "contract_end",
                "unit_id": EINHEIT_A,
            }
        )
    svc = _svc(tables)
    assert svc.kollisionen(_ctx(), ANTRAG).grund == "vertragsende"
    als_k = svc.kollisionen(_ctx(), ANTRAG, als_kuendigung=True)
    assert als_k.blockiert is False
    assert als_k.als_kuendigung is True


def test_kollisionen_als_kuendigung_weist_buchungen_dahinter_aus() -> None:
    """Buchungen VERHINDERN die Kündigung nicht (0359 — eine bestätigte Buchung
    wird bedient, der Vertrag läuft für sie aus), müssen aber sichtbar sein:
    sonst steht das Objekt gesperrt, mit Gästen darin, und niemand weiß welche.
    """
    tables = _kuendigungs_antrag()
    _buchung(
        tables,
        check_in=KUENDIGUNG_START.isoformat(),
        check_out=(KUENDIGUNG_ENDE + timedelta(days=1)).isoformat(),
    )
    k = _svc(tables).kollisionen(_ctx(), ANTRAG, als_kuendigung=True)
    assert k.blockiert is False  # kein Hindernis
    assert k.buchungen_gesamt == 1  # aber ausgewiesen
    assert k.buchungen[0].bezeichnung == "Mette Zempel"


def test_kuendigung_laeuft_trotz_belegtem_zeitraum() -> None:
    """Der Belegungs-Riegel darf eine Kündigung nicht abweisen: sie belegt
    nichts. Ein Vertrag endet unabhängig davon, wer nächste Woche anreist."""
    tables = _kuendigungs_antrag()
    _buchung(
        tables,
        check_in=KUENDIGUNG_START.isoformat(),
        check_out=(KUENDIGUNG_ENDE + timedelta(days=1)).isoformat(),
    )
    item = _svc(tables).genehmigen(
        _ctx(), ANTRAG, _entscheidung_kuendigung()
    )
    assert item.status == "approved"
    assert item.vertragsende_gesetzt_auf == KUENDIGUNG_START


# --- Empfängerkreis der Meldung ---------------------------------------------

def test_nur_entscheider_bekommen_die_meldung() -> None:
    """Die Reinigungskraft (kein APPROVE_BLOCK) darf nichts erfahren."""
    from src.features.calendar.sperrantrag_meldung import (  # noqa: PLC0415
        _darf_entscheiden,
    )

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


# --- Startseiten-Kennzahl und die stumme Aufhebungs-Ablehnung (03.09.2026) ---


def test_vorgaenge_zaehlt_nur_was_die_agentur_sehen_darf() -> None:
    """Drei Bestaende, und die Familien-Stufe bleibt aussen vor.

    Ein Antrag in `owner_freigabe='offen'` existiert fuer die Agentur nicht
    (0389) — ihn auf der Startseite zu zaehlen hiesse, eine Entscheidung
    anzukuendigen, die sie nicht treffen kann.
    """
    from src.features.calendar.sperrantraege import SperrantragService

    zeilen = [
        # offen und sichtbar
        {"status": "pending", "aufhebung": "keine", "created_at": "2026-08-01T10:00:00+00:00",
         "owner_freigabe": "nicht_noetig", "vertragsende_gesetzt_auf": None},
        {"status": "pending", "aufhebung": "keine", "created_at": "2026-08-20T10:00:00+00:00",
         "owner_freigabe": "freigegeben", "vertragsende_gesetzt_auf": None},
        # genehmigt mit Aufhebungswunsch
        {"status": "approved", "aufhebung": "beantragt", "created_at": "2026-07-01T10:00:00+00:00",
         "owner_freigabe": "nicht_noetig", "vertragsende_gesetzt_auf": None},
        # genehmigte Kuendigung
        {"status": "approved", "aufhebung": "keine", "created_at": "2026-06-01T10:00:00+00:00",
         "owner_freigabe": "nicht_noetig", "vertragsende_gesetzt_auf": "2027-01-01"},
        # abgelehnt mit Aufhebungswunsch → zaehlt NICHT (nichts freizugeben)
        {"status": "rejected", "aufhebung": "beantragt", "created_at": "2026-05-01T10:00:00+00:00",
         "owner_freigabe": "nicht_noetig", "vertragsende_gesetzt_auf": None},
    ]

    class _Q:
        def __getattr__(self, name):
            if name.startswith("_"):
                raise AttributeError(name)
            return lambda *_a, **_k: self

        def execute(self):
            return type("R", (), {"data": zeilen})()

    class _Db:
        def table(self, _name):
            return _Q()

    svc = SperrantragService.__new__(SperrantragService)
    svc._db = _Db()  # noqa: SLF001
    res = svc.vorgaenge(_ctx())

    assert res.offen == 2
    assert res.aufhebung_offen == 1, "nur an GENEHMIGTEN Sperren"
    assert res.kuendigungen == 1
    # Das Alter ist die Dringlichkeit: der aelteste OFFENE, nicht der aelteste.
    assert res.aeltester_offen_am is not None
    assert res.aeltester_offen_am.date().isoformat() == "2026-08-01"


def test_abgelehnte_aufhebung_meldet_und_hat_eigenen_dedup() -> None:
    """Der stumme Uebergang (03.09.2026): Ablehnung des Aufhebungswunsches.

    Zwei Fehler in einem: es ging KEINE Meldung hinaus, und der Dedup-Schluessel
    haengt am `status` — der bleibt hier 'approved'. Ueber `status` waere die
    Ablehnung derselbe Schluessel wie die Genehmigung von damals und am
    Unique-Index (0287) verschluckt worden.
    """
    from src.features.calendar import sperrantraege as modul

    quelle = (
        pathlib.Path(modul.__file__).read_text(encoding="utf-8")
        if hasattr(modul, "__file__") else ""
    )
    assert "AUFHEBUNG_ABGELEHNT" in quelle
    assert "self._melde_entscheidung(ctx, neu, AUFHEBUNG_ABGELEHNT)" in quelle, (
        "aufhebung_ablehnen meldet nicht — der Eigentuemer erfaehrt nie, dass "
        "seine Sperre bestehen bleibt."
    )
    assert 'dedup_key=f"block_decision:{antrag[\'id\']}:{entscheidung}"' in quelle, (
        "Der Dedup-Schluessel muss die ENTSCHEIDUNG tragen, nicht den Status."
    )
    # Die Notiz kommt aus der richtigen Spalte: sonst stuende zur
    # Aufhebungs-Ablehnung die Begruendung der Genehmigung von damals.
    assert modul._NOTIZ_SPALTE[modul.AUFHEBUNG_ABGELEHNT] == (  # noqa: SLF001
        "aufhebung_entscheidungsnotiz"
    )
    # Und der Text existiert in allen 24 Sprachen (eigener Test dafuer in
    # core/tests/test_mail_texte.py; hier nur die Verdrahtung).
    from src.core.mail_texte import TEXTE

    for key in modul._ENTSCHEIDUNGS_TEXTE[modul.AUFHEBUNG_ABGELEHNT]:  # noqa: SLF001
        assert key in TEXTE, key
