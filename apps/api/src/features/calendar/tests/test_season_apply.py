"""Tests für „Saison auf andere Objekte übertragen" (POST /seasons/{id}/apply).

Schwerpunkt sind die Wurzeln, an denen genau dieses Feature real scheitern würde:
* Wurzel 2 — der zweite Klick auf „Übertragen" darf nicht am UNIQUE
  (property_id, name) scheitern und keine Dublette anlegen.
* Wurzel 1 — die alten Zeiträume der gleichnamigen Ziel-Saison müssen VOR den
  neuen freigegeben werden, überlappende ANDERE Saisons müssen überleben.
* Wurzel 3 — jede Ziel-ID einzeln tenant-gescopt; eine fremde ID ist 404.
* Wurzel 4/5 — ein Ziel ohne Rate-Plan-Basispreis erfindet keinen Preis, wird
  aber auch nicht still weggelassen, sondern als `uebersprungen` benannt.

In-Memory-Fake-DB (kein Netz, keine Test-DB).
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from src.features.calendar.service import CalendarError, CalendarService


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Nachbau: eq/in_/gte/lt/lte + select/insert/update/
    upsert/delete. Reicht für die Query-Ketten dieses Pfads UND für den
    Preis-Resolver, der dieselbe Fake-DB liest."""

    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: object = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._lt: tuple[str, str] | None = None
        self._select = ""
        self._conflict: list[str] = []

    def select(self, cols: str = "*", *_a: object, **_k: object) -> _Query:
        self._op = "select"
        self._select = cols
        return self

    def insert(self, payload: object) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: object, *, on_conflict: str = "", **_k: object) -> _Query:
        self._op = "upsert"
        self._payload = payload
        # Der Konfliktschlüssel entscheidet, welche Zeile getroffen wird. Ihn zu
        # ignorieren und immer auf (property_id, date) zu matchen, hieße für
        # property_seasons: jeder Upsert legt neu an — der UNIQUE-Backstop, den
        # der Produktionscode gerade gegen die Race einsetzt, bliebe ungetestet.
        self._conflict = [c.strip() for c in on_conflict.split(",") if c.strip()]
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

    def in_(self, col: str, vals: list) -> _Query:
        self._in = (col, list(vals))
        return self

    def gte(self, col: str, val: str) -> _Query:
        self._gte = (col, val)
        return self

    def lte(self, col: str, val: str) -> _Query:
        self._lte = (col, val)
        return self

    def lt(self, col: str, val: str) -> _Query:
        self._lt = (col, val)
        return self

    def gt(self, *_a: object) -> _Query:
        return self

    def neq(self, *_a: object) -> _Query:
        return self

    @property
    def not_(self) -> _Query:
        return self

    def is_(self, *_a: object) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def limit(self, *_a: object) -> _Query:
        return self

    def range(self, *_a: object) -> _Query:
        return self

    def _match(self, row: dict) -> bool:
        # Join-Spalten ("properties.tenant_id") hängen NICHT an der Zeile selbst —
        # sie entstehen erst durch _nested_tenant. Hier mitzuprüfen hieße
        # row.get(...) is None für JEDE Zeile, also alles rauswerfen, bevor der
        # Join überhaupt läuft: _rematerialize_overlaps wäre in jedem Test ein
        # stiller No-Op und die Tests grün aus dem falschen Grund.
        ok = all(
            str(row.get(c)) == str(v)
            for c, v in self._filters if "." not in c
        )
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0])) <= self._lte[1]
        if ok and self._lt:
            ok = str(row.get(self._lt[0])) < self._lt[1]
        return ok

    def _unique_backstop(self, row: dict) -> None:
        """Der echte UNIQUE (property_id, name) auf property_seasons — ohne ihn
        würde ein Test „idempotent" bestehen, den die Live-DB mit 23505 abweist."""
        if self._table != "property_seasons":
            return
        doppelt = any(
            r.get("property_id") == row.get("property_id")
            and r.get("name") == row.get("name")
            for r in self._db.tables.get(self._table, [])
        )
        if doppelt:
            raise RuntimeError(
                'duplicate key value violates unique constraint (23505)'
            )

    def _nested_tenant(self, rows: list[dict]) -> list[dict]:
        """`properties!inner(tenant_id)` nachbilden: der Join hängt am
        property_id, der Tenant-Filter kommt als eq('properties.tenant_id', …)."""
        if "properties!inner(tenant_id)" not in self._select:
            return rows
        props = {p["id"]: p for p in self._db.tables.get("properties", [])}
        out: list[dict] = []
        for row in rows:
            prop = props.get(row.get("property_id"))
            if prop is None:
                continue
            out.append({**row, "properties": {"tenant_id": prop["tenant_id"]}})
        return out

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            payload = self._payload
            neu = payload if isinstance(payload, list) else [payload]
            angelegt: list[dict] = []
            for eintrag in neu:
                row = dict(eintrag)  # type: ignore[arg-type]
                self._unique_backstop(row)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-08-01T00:00:00Z")
                rows.append(row)
                angelegt.append(row)
            return _Result(angelegt)
        if self._op == "upsert":
            payload = self._payload
            neu = payload if isinstance(payload, list) else [payload]
            schluessel = self._conflict or ["property_id", "date"]
            heraus: list[dict] = []
            for eintrag in neu:  # type: ignore[union-attr]
                treffer = [
                    r for r in rows
                    if all(r.get(k) == eintrag.get(k) for k in schluessel)
                ]
                if treffer:
                    treffer[0].update(eintrag)
                    heraus.append(treffer[0])
                else:
                    row = dict(eintrag)
                    row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                    rows.append(row)
                    heraus.append(row)
            # Wie PostgREST die Zeile MIT id zurückgibt — auch im Konfliktfall die
            # der BESTEHENDEN. Der Produktionscode hängt daran: mit einer neu
            # erfundenen id würden die Zeiträume an einer Geistersaison landen.
            return _Result(heraus)
        if self._op == "update":
            getroffen = [r for r in rows if self._match(r)]
            for r in getroffen:
                r.update(self._payload or {})  # type: ignore[arg-type]
            return _Result(getroffen)
        if self._op == "delete":
            getroffen = [r for r in rows if self._match(r)]
            self._db.tables[self._table] = [r for r in rows if r not in getroffen]
            return _Result(getroffen)
        treffer = self._nested_tenant([r for r in rows if self._match(r)])
        # Tenant-Filter des Joins (eq("properties.tenant_id", …)) nachziehen.
        for col, val in self._filters:
            if col == "properties.tenant_id":
                treffer = [
                    r for r in treffer
                    if r.get("properties", {}).get("tenant_id") == val
                ]
        return _Result(treffer)


class _DB:
    """Der Zähler ist bewusst KLASSENWEIT, nicht je Instanz.

    Live vergibt Postgres `gen_random_uuid()` — eine vergebene id kommt nie ein
    zweites Mal. Ein Zähler je Instanz bricht genau diese Zusage, sobald ein Test
    einen ZWEITEN Service auf DENSELBEN Tabellen aufmacht (das Muster für „der
    erneute Versuch heilt": frischer Service, gleiche Daten). Der zweite Lauf
    begann wieder bei 1 und vergab die id einer noch existierenden Zeile erneut —
    ein gezieltes `delete().in_("id", …)` traf damit die gerade eingefügte Zeile
    statt der alten. Das ist kein Produktionsfehler, sondern eine Test-Attrappe,
    die einen korrekten Fix als kaputt aussehen lässt (und umgekehrt einen
    id-Verwechsler decken würde)."""

    _counter = 0

    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def next_id(self) -> int:
        _DB._counter += 1
        return _DB._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _tables() -> dict[str, list[dict]]:
    """Quelle p-1 (Basis 100) + Ziele p-2 (Basis 200) / p-3 (ohne Rate-Plan)
    sowie ein fremdes Objekt p-9 (Mandant t-9)."""
    return {
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Quelle"},
            {"id": "p-2", "tenant_id": "t-1", "title": "Ziel mit Preis"},
            {"id": "p-3", "tenant_id": "t-1", "title": "Ziel ohne Rate-Plan"},
            {"id": "p-4", "tenant_id": "t-1", "title": "Zweites Ziel mit Preis"},
            {"id": "p-9", "tenant_id": "t-9", "title": "Fremd"},
        ],
        "rate_plans": [
            {"id": "rp-1", "property_id": "p-1", "base_price": 100,
             "min_stay": 2, "currency": "DKK",
             "created_at": "2026-01-01T00:00:00Z"},
            {"id": "rp-2", "property_id": "p-2", "base_price": 200,
             "min_stay": 2, "currency": "DKK",
             "created_at": "2026-01-01T00:00:00Z"},
            {"id": "rp-4", "property_id": "p-4", "base_price": 400,
             "min_stay": 2, "currency": "DKK",
             "created_at": "2026-01-01T00:00:00Z"},
        ],
        "property_seasons": [
            {"id": "s-1", "property_id": "p-1", "name": "Hochsaison",
             "color": "#ff0000", "mode": "percent", "amount": 30,
             "created_at": "2026-01-01T00:00:00Z"},
            {"id": "s-fix", "property_id": "p-1", "name": "Silvester",
             "color": "#00ff00", "mode": "fixed", "amount": 140,
             "created_at": "2026-01-01T00:00:00Z"},
        ],
        "property_season_assignments": [
            # 3 Nächte: 01.07. bis 03.07. (end_date INKLUSIV).
            {"id": "a-1", "property_id": "p-1", "season_id": "s-1",
             "start_date": "2026-07-01", "end_date": "2026-07-03"},
        ],
        "price_overrides": [],
        "dynamic_prices": [],
        "property_pricing_config": [],
        "jobs": [],
        "ari_outbox": [],
        "channex_property_map": [],
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> CalendarService:
    return CalendarService(client=_DB(tables or _tables()))


def _preise(tables: dict[str, list[dict]], property_id: str) -> dict[str, float]:
    return {
        r["date"]: r["price"]
        for r in tables["price_overrides"]
        if r["property_id"] == property_id
    }


# --- Fail-closed: nur Prozent-Saisons ---------------------------------------

def test_fixed_saison_422() -> None:
    """Ein Fixbetrag ist objektspezifisch — 140 DKK fürs Studio sind fürs
    8-Personen-Haus falsch. Deshalb 422 statt einer plausiblen Kopie."""
    with pytest.raises(CalendarError) as exc:
        _svc().apply_season_to_properties("t-1", "s-fix", ["p-2"])
    assert exc.value.status_code == 422


def test_fremde_saison_404() -> None:
    with pytest.raises(CalendarError) as exc:
        _svc().apply_season_to_properties("t-9", "s-1", ["p-9"])
    assert exc.value.status_code == 404


# --- Wurzel 3: jede Ziel-ID einzeln gescopt ---------------------------------

def test_fremdes_ziel_404() -> None:
    """Der Service-Role-Key umgeht RLS: eine fremde property_id ist ein Fehler,
    kein stilles Überspringen."""
    tables = _tables()
    with pytest.raises(CalendarError) as exc:
        _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-9"])
    assert exc.value.status_code == 404
    assert not [s for s in tables["property_seasons"] if s["property_id"] == "p-9"]


# --- Materialisierung gegen den Basispreis DES ZIELS -------------------------

def test_uebertragen_materialisiert_mit_ziel_basispreis() -> None:
    tables = _tables()
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert res["uebertragen"] == 1
    assert res["uebersprungen"] == []

    kopie = [s for s in tables["property_seasons"] if s["property_id"] == "p-2"]
    assert len(kopie) == 1
    assert kopie[0]["name"] == "Hochsaison"
    assert kopie[0]["mode"] == "percent"
    assert kopie[0]["amount"] == 30

    zuweisungen = [
        a for a in tables["property_season_assignments"]
        if a["property_id"] == "p-2"
    ]
    assert len(zuweisungen) == 1
    assert zuweisungen[0]["start_date"] == "2026-07-01"
    assert zuweisungen[0]["end_date"] == "2026-07-03"  # inklusiv

    # 200 (Basis des ZIELS) * 1,30 = 260 — nicht 130 (Basis der Quelle).
    assert _preise(tables, "p-2") == {
        "2026-07-01": 260.0, "2026-07-02": 260.0, "2026-07-03": 260.0,
    }


def test_ohne_zeitraeume_nur_definition() -> None:
    tables = _tables()
    res = _svc(tables).apply_season_to_properties(
        "t-1", "s-1", ["p-2"], mit_zeitraeumen=False
    )
    assert res["uebertragen"] == 1
    assert [s["name"] for s in tables["property_seasons"]
            if s["property_id"] == "p-2"] == ["Hochsaison"]
    assert not [a for a in tables["property_season_assignments"]
                if a["property_id"] == "p-2"]
    assert _preise(tables, "p-2") == {}


# --- Wurzel 5: Ziel ohne Basispreis wird BENANNT, nicht verschluckt ----------

def test_ziel_ohne_rate_plan_wird_uebersprungen() -> None:
    tables = _tables()
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2", "p-3"])
    assert res["uebertragen"] == 1
    assert res["uebersprungen"] == [
        {"property_id": "p-3", "grund": "kein_basispreis"}
    ]
    # p-3 bekommt weder Saison noch erfundenen Preis.
    assert not [s for s in tables["property_seasons"] if s["property_id"] == "p-3"]
    assert _preise(tables, "p-3") == {}


# --- Wurzel 2: der zweite Klick ---------------------------------------------

def test_zweimal_anwenden_keine_dublette_kein_23505() -> None:
    """Der Doppelklick ist der Normalfall. UNIQUE (property_id, name) würde eine
    zweite Einfügung mit 23505 abweisen — vorhandenes wird aktualisiert."""
    tables = _tables()
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    kopien = [s for s in tables["property_seasons"] if s["property_id"] == "p-2"]
    assert len(kopien) == 1
    zuweisungen = [
        a for a in tables["property_season_assignments"]
        if a["property_id"] == "p-2"
    ]
    assert len(zuweisungen) == 1
    assert _preise(tables, "p-2") == {
        "2026-07-01": 260.0, "2026-07-02": 260.0, "2026-07-03": 260.0,
    }


def test_geaenderte_quelle_aktualisiert_die_kopie() -> None:
    """Zweite Übertragung nach einer Änderung an der Quelle: die gleichnamige
    Ziel-Saison wird aktualisiert (Betrag UND materialisierte Tage)."""
    tables = _tables()
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    quelle = next(s for s in tables["property_seasons"] if s["id"] == "s-1")
    quelle["amount"] = 50
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    kopie = next(s for s in tables["property_seasons"] if s["property_id"] == "p-2")
    assert kopie["amount"] == 50
    assert _preise(tables, "p-2")["2026-07-01"] == 300.0  # 200 * 1,50


# --- Wurzel 1: Gegenzustand -------------------------------------------------

def test_alte_zeitraeume_der_zielsaison_werden_freigegeben() -> None:
    """Zweite Übertragung mit anderem Zeitraum: die Tage der ersten Übertragung
    dürfen NICHT als Saisonpreis stehen bleiben."""
    tables = _tables()
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    # Quelle umgemalt: Juli raus, August rein.
    tables["property_season_assignments"] = [
        a for a in tables["property_season_assignments"] if a["id"] != "a-1"
    ]
    tables["property_season_assignments"].append({
        "id": "a-2", "property_id": "p-1", "season_id": "s-1",
        "start_date": "2026-08-01", "end_date": "2026-08-02",
    })
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    zuweisungen = [
        a for a in tables["property_season_assignments"]
        if a["property_id"] == "p-2"
    ]
    assert [(a["start_date"], a["end_date"]) for a in zuweisungen] == [
        ("2026-08-01", "2026-08-02")
    ]
    preise = _preise(tables, "p-2")
    # Juli fällt auf den Basispreis zurück (Override weg), August trägt +30 %.
    assert "2026-07-01" not in preise
    assert preise["2026-08-01"] == 260.0
    assert preise["2026-08-02"] == 260.0


def _ferien_am_ziel(
    tables: dict[str, list[dict]], start: str, end: str,
) -> None:
    """Eine ANDERE, bereits bemalte Saison am Ziel: „Ferien" (+10 %) über
    [start, end] inklusive ihrer materialisierten Tagespreise.

    Die Overrides gehören dazu: `assign_season` schreibt sie beim Bemalen mit,
    eine Saison ohne sie gibt es live nicht. Ohne diesen Schritt prüfte der Test
    nur, dass ein Preis wiederkommt, den es vorher nie gab."""
    tables["property_seasons"].append({
        "id": "s-2", "property_id": "p-2", "name": "Ferien",
        "color": "#0000ff", "mode": "percent", "amount": 10,
        "created_at": "2026-01-01T00:00:00Z",
    })
    tables["property_season_assignments"].append({
        "id": "a-3", "property_id": "p-2", "season_id": "s-2",
        "start_date": start, "end_date": end,
    })
    tag = date.fromisoformat(start)
    letzter = date.fromisoformat(end)
    while tag <= letzter:
        tables["price_overrides"].append({
            "property_id": "p-2", "date": tag.isoformat(), "price": 220.0,
        })
        tag += timedelta(days=1)


def test_ueberlappende_fremdsaison_am_ziel_ueberlebt() -> None:
    """Der Basispreis-Reset über den ALTEN Zeitraum ist zeitraumweit — die Tage
    einer ANDEREN Saison des Ziels müssen danach wieder materialisiert sein.

    Der geprüfte Tag muss zwei Bedingungen zugleich erfüllen, sonst beweist der
    Test nichts:
    * er liegt im ALTEN (zurückgesetzten) Zeitraum der Ziel-Saison — sonst wird
      er nie angefasst und behält seinen Preis aus dem Aufbau;
    * er liegt NICHT im NEUEN Zeitraum — sonst überschreibt ihn die
      abschließende Materialisierung der übertragenen Saison ohnehin mit 260
      (last win, 0138), und die Wiederherstellung bliebe wirkungslos.

    Genau daran scheiterte die frühere Fassung: „Ferien" lag auf dem 03.–05.07.,
    der Reset lief nur über den 01.–03.07. — der 04./05.07. wurde nie angefasst
    und behielt seine 220 aus dem Aufbau. Mit `_rematerialize_overlaps` als
    No-Op blieb der Test grün, obwohl sein Docstring das Gegenteil behauptete.

    Aufbau daher: die Quelle wird zwischen den beiden Übertragungen von
    01.–03.07. auf den 01.07. VERKÜRZT. Der 02.07. gehört danach nur noch
    „Ferien" (+10 % → 220), liegt aber im alten, komplett zurückgesetzten
    Zeitraum — seine 220 kann nur die Wiederherstellung gerettet haben."""
    tables = _tables()
    _ferien_am_ziel(tables, "2026-07-02", "2026-07-02")
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    # Quelle verkürzt: nur noch der 01.07. Der 02./03.07. wird beim zweiten
    # Übertragen freigegeben — „Ferien" darf dabei nicht mit untergehen.
    for a in tables["property_season_assignments"]:
        if a["id"] == "a-1":
            a["end_date"] = "2026-07-01"
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    # Die Zuweisung der Fremd-Saison ist unangetastet.
    fremd = [a for a in tables["property_season_assignments"]
             if a["season_id"] == "s-2"]
    assert [(a["start_date"], a["end_date"]) for a in fremd] == [
        ("2026-07-02", "2026-07-02")
    ]
    preise = _preise(tables, "p-2")
    assert preise["2026-07-01"] == 260.0
    # Der 02.07. lag im gelöschten Zeitraum und gehört NUR „Ferien" — seine 220
    # stammen zwingend aus `_rematerialize_overlaps`.
    assert preise["2026-07-02"] == 220.0
    # Der 03.07. gehörte NUR der übertragenen Saison und ist jetzt zu Recht frei.
    assert "2026-07-03" not in preise


def test_fremdsaison_ueberlebt_das_umgemalte_uebertragen() -> None:
    """Das Szenario aus dem Review: die Quelle wird von Juli auf August umgemalt,
    danach ein zweites Mal übertragen. Der Juli-Zeitraum der Ziel-Saison wird
    dabei komplett freigegeben — die darunterliegende Fremd-Saison „Ferien"
    (02.–04.07.) darf NICHT auf den nackten Basispreis 200 fallen, sondern muss
    ihren eigenen Preis 220 zurückbekommen (Gegenzustand, Wurzel 1)."""
    tables = _tables()
    _ferien_am_ziel(tables, "2026-07-02", "2026-07-04")
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    # Quelle umgemalt: Juli raus, August rein.
    tables["property_season_assignments"] = [
        a for a in tables["property_season_assignments"] if a["id"] != "a-1"
    ]
    tables["property_season_assignments"].append({
        "id": "a-2", "property_id": "p-1", "season_id": "s-1",
        "start_date": "2026-08-01", "end_date": "2026-08-02",
    })
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    preise = _preise(tables, "p-2")
    # Kein einziger Ferien-Tag fällt auf 200 zurück.
    assert preise["2026-07-02"] == 220.0
    assert preise["2026-07-03"] == 220.0
    assert preise["2026-07-04"] == 220.0
    # Der 01.07. gehörte NUR der übertragenen Saison → jetzt zu Recht Basispreis.
    assert "2026-07-01" not in preise
    assert preise["2026-08-01"] == 260.0


def test_quelle_ist_kein_ziel() -> None:
    """Das Quellobjekt in der Auswahl darf sich nicht selbst überschreiben."""
    tables = _tables()
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-1", "p-2"])
    assert res["uebertragen"] == 1
    assert len([s for s in tables["property_seasons"]
                if s["property_id"] == "p-1"]) == 2  # unverändert


def test_doppelte_ziel_id_wird_einmal_gezaehlt() -> None:
    tables = _tables()
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2", "p-2"])
    assert res["uebertragen"] == 1


def test_zeitspanne_der_quelle_bleibt_unveraendert() -> None:
    """Die Quelle wird nur GELESEN — ihre Tage dürfen die Übertragung nicht
    verlieren (die Ziel-Saison teilt denselben Namen, nicht dieselbe Zeile)."""
    tables = _tables()
    svc = _svc(tables)
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert [a["id"] for a in tables["property_season_assignments"]
            if a["property_id"] == "p-1"] == ["a-1"]


def test_datum_der_zuweisung_ist_end_exklusiv_umgerechnet() -> None:
    """DB speichert end_date INKLUSIV — die Kopie darf keinen Tag verlieren
    oder dazuerfinden."""
    tables = _tables()
    _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])
    a = next(x for x in tables["property_season_assignments"]
             if x["property_id"] == "p-2")
    start = date.fromisoformat(a["start_date"])
    ende = date.fromisoformat(a["end_date"])
    assert (ende - start).days == 2  # drei Tage, inklusiv gespeichert


# --- Wurzel 5: ein Ziel scheitert, die anderen laufen weiter ------------------

def _sprengt_bei(svc: CalendarService, property_id: str, exc: Exception) -> None:
    """`_rematerialize_season` für GENAU EIN Zielobjekt scheitern lassen.

    Der Fehler sitzt bewusst NACH `_upsert_season_copy` und nach den Zeiträumen —
    genau dort, wo der halbe Zustand entstand, den Befund 1 meint (Saison und
    Zuweisungen geschrieben, price_overrides leer)."""
    original = svc._rematerialize_season  # noqa: SLF001 — Testdoppel

    def _stub(tenant_id: str, season: dict) -> None:
        if season["property_id"] == property_id:
            raise exc
        original(tenant_id, season)

    svc._rematerialize_season = _stub  # type: ignore[method-assign]  # noqa: SLF001


def test_fehler_an_einem_ziel_reisst_die_anderen_nicht_mit() -> None:
    """Ohne Klammer um EIN Ziel propagierte der Fehler als 500: die vorher
    bedienten Ziele waren geschrieben, das gescheiterte halb, und der Betrieb
    erfuhr nicht, welches Objekt betroffen ist."""
    tables = _tables()
    svc = _svc(tables)
    _sprengt_bei(svc, "p-2", RuntimeError("DB-Timeout"))
    res = svc.apply_season_to_properties("t-1", "s-1", ["p-2", "p-4"])

    # p-4 ist trotz des Fehlers an p-2 vollständig bedient.
    assert res["uebertragen"] == 1
    assert _preise(tables, "p-4") == {
        "2026-07-01": 520.0, "2026-07-02": 520.0, "2026-07-03": 520.0,
    }
    # p-2 kommt BENANNT zurück statt als 500 (Wurzel 5).
    assert res["uebersprungen"] == [
        {"property_id": "p-2", "grund": "teilweise_uebertragen"}
    ]


def test_gescheitertes_ziel_wird_ehrlich_als_teilweise_gemeldet() -> None:
    """Der Teilzustand wird BENANNT statt weggeräumt.

    Früher rollte der Fehlerpfad zurück — und löschte dabei alles, was unter dem
    Namen der Saison am Ziel stand (Befund A1). Jetzt bleibt der Zustand stehen:
    die Saison samt Zeiträumen, deren Tage noch auf dem Basispreis liegen. Das
    ist zu wenig Aufschlag, aber kein erfundener Preis (Wurzel 4) — und der
    Grund-Slug sagt genau das, statt „nichts passiert" zu behaupten."""
    tables = _tables()
    svc = _svc(tables)
    _sprengt_bei(svc, "p-2", RuntimeError("Channex 500"))
    res = svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res["uebersprungen"] == [
        {"property_id": "p-2", "grund": "teilweise_uebertragen"}
    ]
    # Die Zeiträume stehen — ein erneuter Versuch materialisiert sie fertig.
    assert [(a["start_date"], a["end_date"])
            for a in tables["property_season_assignments"]
            if a["property_id"] == "p-2"] == [("2026-07-01", "2026-07-03")]
    # Kein erfundener Preis: die Tage liegen auf dem Basispreis, nicht auf 0.
    assert _preise(tables, "p-2") == {}


def test_erneuter_versuch_vervollstaendigt_den_teilzustand() -> None:
    """Der Teilzustand ist SELBSTHEILEND — das ist die Begründung dafür, ihn
    stehen zu lassen statt zu rollbacken. Gescheitert ist die Materialisierung,
    also genau der idempotente Schritt: derselbe Aufruf ohne Fehler zieht die
    Tagespreise nach."""
    tables = _tables()
    svc = _svc(tables)
    _sprengt_bei(svc, "p-2", RuntimeError("Channex 500"))
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert _preise(tables, "p-2") == {}

    # Zweiter Anlauf, diesmal ohne Störung (frischer Service, gleiche Tabellen).
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert res == {"uebertragen": 1, "uebersprungen": []}
    assert _preise(tables, "p-2") == {
        "2026-07-01": 260.0, "2026-07-02": 260.0, "2026-07-03": 260.0,
    }


def test_budget_signal_schlaegt_durch_statt_uebersprungen() -> None:
    """ChannexBudgetExhausted ist ein STEUER-Signal, kein Zielproblem: der Job
    muss verzögert werden. Als `uebersprungen` gemeldet hieße „erledigt,
    Objekt hatte Pech" — der Push wäre nie passiert und niemand käme wieder."""
    from src.features.channel_manager.channex_client import ChannexBudgetExhausted

    svc = _svc()
    _sprengt_bei(svc, "p-2", ChannexBudgetExhausted("Budget leer", retry_after=60))
    with pytest.raises(ChannexBudgetExhausted):
        svc.apply_season_to_properties("t-1", "s-1", ["p-2"])


def test_fachfehler_am_ziel_schlaegt_durch() -> None:
    """Ein CalendarError (Scope/Fachlage) ist eine Aussage über die Anfrage, kein
    Ausfall EINES Ziels — er darf nicht als Grund-Slug verschwinden."""
    svc = _svc()
    _sprengt_bei(svc, "p-2", CalendarError("Objekt nicht gefunden.", status_code=404))
    with pytest.raises(CalendarError) as exc:
        svc.apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert exc.value.status_code == 404


# --- Der VORBESTEHENDE Kalender des Ziels darf nie verschwinden --------------

def _eigene_hochsaison_am_ziel(
    tables: dict[str, list[dict]], start: str, end: str,
) -> None:
    """Das Ziel p-2 hat eine EIGENE, GLEICHNAMIGE „Hochsaison" (+40 % → 280),
    seit Monaten von Hand bemalt.

    Der gleiche Name ist der gefährliche Teil: `_upsert_season_copy` trifft
    genau diese Zeile, und jeder Griff an ihre Zeiträume greift damit an einen
    Kalender, den dieser Aufruf nie angelegt hat."""
    tables["property_seasons"].append({
        "id": "s-ziel-eigen", "property_id": "p-2", "name": "Hochsaison",
        "color": "#abcdef", "mode": "percent", "amount": 40,
        "created_at": "2026-01-01T00:00:00Z",
    })
    tables["property_season_assignments"].append({
        "id": "a-ziel-eigen", "property_id": "p-2", "season_id": "s-ziel-eigen",
        "start_date": start, "end_date": end,
    })
    tag = date.fromisoformat(start)
    letzter = date.fromisoformat(end)
    while tag <= letzter:
        tables["price_overrides"].append({
            "property_id": "p-2", "date": tag.isoformat(), "price": 280.0,
        })
        tag += timedelta(days=1)


def test_fehler_vernichtet_nicht_den_vorbestehenden_ziel_kalender() -> None:
    """Befund A1: der „Rollback" löschte den Kalender, den er nie angefasst hat.

    Nachgestellt: p-2 führt eine eigene „Hochsaison" (+40 %) über den 15.–20.06.
    mit 6 bemalten Tagen zu 280. Beim Übertragen scheitert das Materialisieren.
    Der alte Rollback rief `_replace_season_spans(..., [])` und ließ p-2 ohne
    Zuweisungen und ohne Preise zurück — die UI meldete „übersprungen — erneut
    versuchen", real war ein Monat Hochsaison weg und die Portale hatten den
    Basispreis. Es darf KEIN Pfad geben, der still Daten vernichtet."""
    tables = _tables()
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-20")
    svc = _svc(tables)
    _sprengt_bei(svc, "p-2", RuntimeError("Channex 500"))
    res = svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res["uebersprungen"] == [
        {"property_id": "p-2", "grund": "teilweise_uebertragen"}
    ]
    # Zuweisungen: der Juni-Zeitraum wurde durch den Juli der Quelle ERSETZT
    # (das ist die gewollte Wurzel-1-Semantik), aber nichts steht leer da.
    zuweisungen = [
        (a["start_date"], a["end_date"])
        for a in tables["property_season_assignments"]
        if a["property_id"] == "p-2"
    ]
    assert zuweisungen == [("2026-07-01", "2026-07-03")]
    assert zuweisungen != []  # genau der Zustand nach dem alten Rollback


def _sprengt_im_zeitraum_tausch(svc: CalendarService, property_id: str) -> None:
    """MITTEN in `_replace_season_spans` scheitern lassen — zwischen den beiden
    Schreibschritten an `property_season_assignments`.

    Das ist die Lücke, die `_sprengt_bei` NICHT abdeckt: das dortige Testdoppel
    hängt an `_rematerialize_season`, also am letzten und ausgerechnet
    idempotenten Schritt. Genau deshalb belegte die Suite die Selbstheilungs-
    These nur für den Fall, in dem sie ohnehin stimmt, während der Tausch der
    Zeiträume — eine mehrstufige Schreibfolge OHNE Transaktion (PostgREST) —
    ungetestet blieb.

    Gesprengt wird über `_clear_overrides_to_base`: dieser Aufruf sitzt in
    `_replace_season_spans` NACH dem Insert und NACH dem Delete der alten Zeilen,
    also an der spätestmöglichen Stelle, an der ein Timeout die Tabelle noch in
    einem Zwischenstand hinterlässt."""
    original = svc._clear_overrides_to_base  # noqa: SLF001 — Testdoppel

    def _stub(pid: str, start: date, end: date) -> None:
        if pid == property_id:
            raise RuntimeError("PostgREST 504 im Zeitraum-Tausch")
        original(pid, start, end)

    svc._clear_overrides_to_base = _stub  # type: ignore[method-assign]  # noqa: SLF001


def test_abbruch_im_zeitraum_tausch_vernichtet_den_ziel_kalender_nicht() -> None:
    """DER Befund aus Runde 3: ein Abbruch INNERHALB des Zeitraum-Tauschs.

    Live nachgestellt: p-2 führt eine eigene, gleichnamige „Hochsaison" (+40 %)
    über den 15.–20.06. mit sechs von Hand bemalten Tagen zu 280. Beim Übertragen
    bricht die Schreibfolge mitten im Tausch ab (PostgREST-Timeout).

    Mit der alten Reihenfolge (erst Delete, dann Insert) war das Ergebnis
    TOTALVERLUST: Zuweisungen von p-2 leer, Preise leer — der Juni-Kalender weg,
    die Portale mit dem Basispreis. Und der erneute Versuch heilte NICHT, er
    schrieb den Juli der Quelle; der Juni war unwiederbringlich.

    Geprüft wird deshalb die EINE Eigenschaft, die zählt: der Kalender des Ziels
    darf nach dem Abbruch nicht LEER sein. Ein Zwischenstand mit zu vielen
    Zeiträumen ist erlaubt (0138 lässt Overlaps ausdrücklich zu, „last win") —
    zu viel ist reparabel, zu wenig nicht."""
    tables = _tables()
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-20")
    svc = _svc(tables)
    _sprengt_im_zeitraum_tausch(svc, "p-2")
    res = svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res["uebersprungen"] == [
        {"property_id": "p-2", "grund": "teilweise_uebertragen"}
    ]
    zuweisungen = [
        (a["start_date"], a["end_date"])
        for a in tables["property_season_assignments"]
        if a["property_id"] == "p-2"
    ]
    # Der Kern: NICHT leer. Genau das war der Totalverlust.
    assert zuweisungen != []
    # Die neuen Zeiträume stehen bereits — der Insert läuft VOR dem Löschen.
    assert ("2026-07-01", "2026-07-03") in zuweisungen


def test_abbruch_im_zeitraum_tausch_heilt_beim_zweiten_versuch() -> None:
    """Die Gegenprobe: der Zwischenstand muss sich auch wirklich auflösen.

    „Nicht leer" allein genügt nicht — bliebe der überzählige alte Zeitraum für
    immer stehen, hätte der Fix nur einen Datenverlust gegen eine Dauer-Dublette
    getauscht. Der zweite, ungestörte Aufruf muss die Zuweisungen auf denselben
    Stand bringen, den ein störungsfreier erster Aufruf ergeben hätte.

    Was der zweite Lauf NICHT mehr einsammelt, ist der Rest, den der Abbruch in
    `price_overrides` hinterlassen hat: das Zurücksetzen der Juni-Tage kam nicht
    mehr dazu, und der Juni gehört zu keiner Zuweisung mehr. Diese Tage tragen
    also weiter 280 statt des Basispreises. Das ist die bewusst gewählte Seite
    des Fixes und wird hier festgeschrieben, damit sie niemand später für einen
    Zufall hält: zu VIEL Aufschlag (im Kalender sichtbar, über
    `clear_season_range` korrigierbar) statt eines gelöschten Kalenders."""
    tables = _tables()
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-20")
    svc = _svc(tables)
    _sprengt_im_zeitraum_tausch(svc, "p-2")
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"])

    # Zweiter Anlauf ohne Störung (frischer Service, gleiche Tabellen).
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert res == {"uebertragen": 1, "uebersprungen": []}
    assert [(a["start_date"], a["end_date"])
            for a in tables["property_season_assignments"]
            if a["property_id"] == "p-2"] == [("2026-07-01", "2026-07-03")]
    preise = _preise(tables, "p-2")
    # Der Juli trägt +30 % auf den Basispreis DES ZIELS (200).
    assert preise["2026-07-01"] == 260.0
    assert preise["2026-07-02"] == 260.0
    assert preise["2026-07-03"] == 260.0
    # Der Juni-Rest: zu viel Aufschlag, nie ein erfundener Preis (Wurzel 4).
    assert preise["2026-06-15"] == 280.0
    assert preise["2026-06-20"] == 280.0


def test_zeitraum_tausch_loescht_nur_die_alten_zeilen() -> None:
    """Der Insert-vor-Delete-Fix hängt daran, dass das Löschen die GERADE
    geschriebenen Zeilen verschont.

    Ein `delete().eq("season_id", …)` nach dem Insert hätte die neuen Zuweisungen
    gleich mit abgeräumt — der Erfolgspfad wäre still zu „Saison ohne Zeiträume"
    geworden. Deshalb löscht der Tausch gezielt die vorher gelesenen ids."""
    tables = _tables()
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-20")
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res == {"uebertragen": 1, "uebersprungen": []}
    assert [(a["start_date"], a["end_date"])
            for a in tables["property_season_assignments"]
            if a["property_id"] == "p-2"] == [("2026-07-01", "2026-07-03")]
    # Der alte Juni ist weg UND seine Preise sind zurückgenommen.
    assert _preise(tables, "p-2") == {
        "2026-07-01": 260.0, "2026-07-02": 260.0, "2026-07-03": 260.0,
    }


def test_ohne_zeitraeume_laesst_die_tage_des_ziels_unangetastet() -> None:
    """Befund A2: bei `mit_zeitraeumen=False` hat der Nutzer „nur die Definition,
    keine Tage" gewählt. Der Erfolgspfad hielt sich daran, der Rollback-Pfad
    nicht — ein Fehler löschte die Tage, die niemand anfassen wollte.

    Es gibt an den Zeiträumen gar keinen halben Zustand, den man zurücknehmen
    könnte: sie wurden nie berührt."""
    tables = _tables()
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-17")
    svc = _svc(tables)
    _sprengt_bei(svc, "p-2", RuntimeError("Channex 500"))
    svc.apply_season_to_properties("t-1", "s-1", ["p-2"], mit_zeitraeumen=False)

    # Die eigenen Tage des Ziels stehen unverändert.
    assert [(a["start_date"], a["end_date"])
            for a in tables["property_season_assignments"]
            if a["property_id"] == "p-2"] == [("2026-06-15", "2026-06-17")]
    assert _preise(tables, "p-2") == {
        "2026-06-15": 280.0, "2026-06-16": 280.0, "2026-06-17": 280.0,
    }


def test_unbemalte_quelle_loescht_nichts_und_meldet_keinen_erfolg() -> None:
    """Befund A3: eine Quelle ohne Zuweisungen „mit Zeiträumen" zu übertragen war
    faktisch „Zeiträume am Ziel löschen" — mit grünem Erfolgs-Toast
    ({'uebertragen': 1}), während am Ziel Tage gelöscht und Basispreise an die
    Portale gingen. Jetzt 422 statt stillem Datenverlust."""
    tables = _tables()
    tables["property_season_assignments"] = [
        a for a in tables["property_season_assignments"]
        if a["season_id"] != "s-1"
    ]
    _eigene_hochsaison_am_ziel(tables, "2026-06-15", "2026-06-17")

    with pytest.raises(CalendarError) as exc:
        _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])
    assert exc.value.status_code == 422

    # Der Kalender des Ziels ist vollständig unangetastet.
    assert [(a["start_date"], a["end_date"])
            for a in tables["property_season_assignments"]
            if a["property_id"] == "p-2"] == [("2026-06-15", "2026-06-17")]
    assert _preise(tables, "p-2") == {
        "2026-06-15": 280.0, "2026-06-16": 280.0, "2026-06-17": 280.0,
    }


def test_unbemalte_quelle_ohne_zeitraeume_ist_erlaubt() -> None:
    """Die Gegenprobe zu A3: NUR die Definition zu übertragen ist auch bei einer
    unbemalten Quelle sinnvoll (der Betrieb malt am Ziel selbst) — und fasst die
    Tage des Ziels nicht an. Die 422 oben darf diesen Weg nicht mit sperren."""
    tables = _tables()
    tables["property_season_assignments"] = [
        a for a in tables["property_season_assignments"]
        if a["season_id"] != "s-1"
    ]
    res = _svc(tables).apply_season_to_properties(
        "t-1", "s-1", ["p-2"], mit_zeitraeumen=False
    )
    assert res == {"uebertragen": 1, "uebersprungen": []}
    assert [s["name"] for s in tables["property_seasons"]
            if s["property_id"] == "p-2"] == ["Hochsaison"]


def test_basispreis_null_pusht_keine_0_an_die_portale() -> None:
    """Befund A4: `base_price = 0` (Datenfehler, Objekt in Vorbereitung) bestand
    den `is None`-Guard. `0 * 1,30 = 0,0` landete als Nachtpreis in
    price_overrides und ging an die Portale — ein Objekt für 0,00 bei
    Booking.com ist der teuerste denkbare Ausgang. Kein Preis ist besser als ein
    falscher (Wurzel 4)."""
    tables = _tables()
    for rp in tables["rate_plans"]:
        if rp["property_id"] == "p-2":
            rp["base_price"] = 0
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res["uebertragen"] == 0
    assert res["uebersprungen"] == [
        {"property_id": "p-2", "grund": "basispreis_null"}
    ]
    assert _preise(tables, "p-2") == {}
    # Auch keine Saison-Zeile: das Ziel bleibt völlig unberührt.
    assert not [s for s in tables["property_seasons"]
                if s["property_id"] == "p-2"]


# --- Wurzel 2: der UNIQUE entscheidet, nicht unser Lesestand ------------------

def test_kopie_nutzt_unique_backstop_statt_select_dann_insert() -> None:
    """Select-dann-Insert war eine Race: zwei gleichzeitige Klicks lesen beide
    „nicht vorhanden" und laufen beide in den Insert — der zweite bekäme 23505
    als 500. Deshalb entscheidet der Konflikt in der DB.

    Nachgestellt wird der Wettlauf, indem die gleichnamige Ziel-Saison ZWISCHEN
    einem gedachten Lesen und dem Schreiben entsteht: sie liegt hier schon in der
    Tabelle. Der Aufruf darf sie aktualisieren, nicht an ihr scheitern."""
    tables = _tables()
    tables["property_seasons"].append({
        "id": "s-fremd-parallel", "property_id": "p-2", "name": "Hochsaison",
        "color": "#123456", "mode": "percent", "amount": 5,
        "created_at": "2026-01-01T00:00:00Z",
    })
    res = _svc(tables).apply_season_to_properties("t-1", "s-1", ["p-2"])

    assert res["uebertragen"] == 1
    kopien = [s for s in tables["property_seasons"] if s["property_id"] == "p-2"]
    assert len(kopien) == 1
    # Die BESTEHENDE Zeile wurde aktualisiert — ihre id bleibt, sonst hingen die
    # Zeiträume an einer Geistersaison.
    assert kopien[0]["id"] == "s-fremd-parallel"
    assert kopien[0]["amount"] == 30
    assert _preise(tables, "p-2")["2026-07-01"] == 260.0
