"""Tests des Sperrantrags-Workflows (Etappe A).

Schwerpunkt sind die Wurzeln, an denen dieser Workflow real scheitern würde:
* Wurzel 2 — Doppelklick auf „genehmigen" darf nicht zweimal sperren.
* Wurzel 1 — der Widerruf muss die Nächte wieder freigeben.
* Wurzel 3/9 — ein fremder Mandant darf den Antrag nicht sehen/entscheiden.
* Der 409-Fall: gebuchte Tage im Zeitraum → Antrag bleibt OFFEN.

In-Memory-Fake-DB (kein Netz, keine Test-DB).
"""
from __future__ import annotations

from datetime import date

import pytest

from src.core.security import AuthContext
from src.features.calendar.schemas import BlockRequestDecision
from src.features.calendar.service import CalendarError
from src.features.calendar.sperrantraege import (
    SperrantragService,
    melde_neuen_antrag,
)


def _ctx(user: str = "admin-1", tenant: str = "t-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=tenant, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Nachbau: eq/in_/gte/lt + select/insert/update/delete."""

    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lt: tuple[str, str] | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        self._op = "select"
        return self

    def insert(self, payload: dict) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: object, **_k: object) -> _Query:
        self._op = "upsert"
        self._payload = payload  # type: ignore[assignment]
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
        self._in = (col, vals)
        return self

    def gte(self, col: str, val: str) -> _Query:
        self._gte = (col, val)
        return self

    def lt(self, col: str, val: str) -> _Query:
        self._lt = (col, val)
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

    def neq(self, *_a: object) -> _Query:
        return self

    def lte(self, *_a: object) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def range(self, *_a: object) -> _Query:
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._lt:
            ok = str(row.get(self._lt[0])) < self._lt[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-06-25T00:00:00Z")
            rows.append(row)
            return _Result([row])
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


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _tables() -> dict[str, list[dict]]:
    return {
        "users": [
            {"id": "admin-1", "tenant_id": "t-1", "role": "admin", "name": "Chefin"},
            {"id": "owner-1", "tenant_id": "t-1", "role": "owner", "name": "Herr Ohm"},
            # Reinigungskraft: KEIN APPROVE_BLOCK → bekommt keine Meldung.
            {"id": "clean-1", "tenant_id": "t-1", "role": "cleaner", "name": "Putz"},
        ],
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
            {"id": "p-9", "tenant_id": "t-9", "title": "Fremd"},
        ],
        "property_units": [{"id": "u-1", "property_id": "p-1"}],
        "availability": [],
        "block_requests": [
            {
                "id": "b-1",
                "tenant_id": "t-1",
                "property_id": "p-1",
                "requested_by": "owner-1",
                "start_date": "2026-03-01",
                "end_date": "2026-03-03",  # INKLUSIV → 3 Nächte
                "status": "pending",
                "reason": "Eigennutzung",
                "created_at": "2026-02-01T00:00:00Z",
            },
            {
                "id": "b-9",
                "tenant_id": "t-9",  # FREMDER Mandant
                "property_id": "p-9",
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
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> SperrantragService:
    return SperrantragService(db=_DB(tables or _tables()))


def _entscheidung(note: str | None = None) -> BlockRequestDecision:
    return BlockRequestDecision(note=note)


# --- Scope (Wurzel 3 / 9) ----------------------------------------------------

def test_liste_nur_eigener_mandant() -> None:
    res = _svc().liste(_ctx())
    assert [i.id for i in res.items] == ["b-1"]  # b-9 (t-9) fehlt
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
        _svc().genehmigen(_ctx(), "b-9", _entscheidung())
    assert exc.value.status_code == 404


# --- Genehmigen --------------------------------------------------------------

def test_genehmigen_sperrt_die_naechte() -> None:
    tables = _tables()
    svc = _svc(tables)
    item = svc.genehmigen(_ctx(), "b-1", _entscheidung("passt"))
    assert item.status == "approved"
    assert item.decided_by == "admin-1"
    assert item.decided_at is not None
    assert item.decision_note == "passt"
    # end_date ist INKLUSIV → 1., 2. und 3. März gesperrt (3 Nächte).
    gesperrt = sorted(
        r["date"] for r in tables["availability"] if r["status"] == "blocked"
    )
    assert gesperrt == ["2026-03-01", "2026-03-02", "2026-03-03"]
    assert all(r["source"] == "manual" for r in tables["availability"])


def test_genehmigen_ist_idempotent() -> None:
    """Wurzel 2: der zweite Klick bekommt 409 und sperrt NICHT erneut."""
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    anzahl = len(tables["availability"])
    with pytest.raises(CalendarError) as exc:
        svc.genehmigen(_ctx(), "b-1", _entscheidung())
    assert exc.value.status_code == 409
    assert "bereits genehmigt" in exc.value.message
    assert len(tables["availability"]) == anzahl  # kein zweiter Write


def test_genehmigen_bei_gebuchtem_tag_409_und_bleibt_offen() -> None:
    """Der Antrag darf NICHT still als genehmigt gelten, wenn nicht gesperrt
    werden konnte (sonst zeigt das Portal eine Sperre, die es nicht gibt)."""
    tables = _tables()
    tables["availability"].append(
        {
            "property_id": "p-1",
            "date": "2026-03-02",
            "status": "booked",
            "source": "airbnb",
            "unit_id": "u-1",
        }
    )
    svc = _svc(tables)
    with pytest.raises(CalendarError) as exc:
        svc.genehmigen(_ctx(), "b-1", _entscheidung())
    assert exc.value.status_code == 409
    antrag = tables["block_requests"][0]
    assert antrag["status"] == "pending"  # zurückgerollt
    assert antrag["decided_by"] is None
    assert antrag["decided_at"] is None


def test_ablehnen_sperrt_nichts() -> None:
    tables = _tables()
    item = _svc(tables).ablehnen(_ctx(), "b-1", _entscheidung("leider nein"))
    assert item.status == "rejected"
    assert item.decision_note == "leider nein"
    assert tables["availability"] == []


def test_ablehnen_nach_genehmigung_409() -> None:
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    with pytest.raises(CalendarError) as exc:
        svc.ablehnen(_ctx(), "b-1", _entscheidung())
    assert exc.value.status_code == 409


# --- Widerruf (Wurzel 1: Gegenzustand) ---------------------------------------

def test_zuruecknehmen_gibt_naechte_frei() -> None:
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    assert len(tables["availability"]) == 3
    item = svc.zuruecknehmen(_ctx(), "b-1", _entscheidung("doch nicht"))
    assert item.status == "rejected"
    # Die manuelle Sperre ist weg — das Objekt ist wieder verkäuflich.
    assert [r for r in tables["availability"] if r["status"] == "blocked"] == []


def test_zuruecknehmen_nur_aus_genehmigt() -> None:
    with pytest.raises(CalendarError) as exc:
        _svc().zuruecknehmen(_ctx(), "b-1", _entscheidung())
    assert exc.value.status_code == 409


def test_zuruecknehmen_laesst_gebuchte_nacht_stehen() -> None:
    """Der Unblock-Weg löscht nur manuelle Sperren — eine zwischenzeitlich
    eingegangene Buchung bleibt gebucht (kein Doppelverkauf)."""
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    # Zwischendurch kommt eine OTA-Buchung auf einen der Tage.
    for r in tables["availability"]:
        if r["date"] == "2026-03-02":
            r["status"] = "booked"
            r["source"] = "airbnb"
    svc.zuruecknehmen(_ctx(), "b-1", _entscheidung())
    verbleibend = [r for r in tables["availability"] if r["date"] == "2026-03-02"]
    assert verbleibend and verbleibend[0]["status"] == "booked"


def test_rollback_auch_bei_nicht_fachlichem_fehler() -> None:
    """Wurzel 1/5: NICHT nur der 409 lässt die Sperre ausfallen — auch ein
    Netz-/DB-Fehler. Der Antrag darf dann nicht 'approved' ohne Sperre bleiben.
    """
    tables = _tables()
    svc = _svc(tables)

    class _Kaputt:
        def block(self, *_a: object, **_k: object) -> int:
            raise RuntimeError("PostgREST weg")

    svc._calendar = _Kaputt()  # noqa: SLF001 — gezielt den Seiteneffekt kippen
    with pytest.raises(RuntimeError):
        svc.genehmigen(_ctx(), "b-1", _entscheidung())
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
    svc._zuruecksetzen(_ctx(), "b-9")  # noqa: SLF001 — gezielt der Rollback
    fremd = next(r for r in tables["block_requests"] if r["id"] == "b-9")
    assert fremd["status"] == "pending"
    assert "decided_at" not in fremd  # unverändert


# --- Grenzen -----------------------------------------------------------------

def test_zu_langer_zeitraum_422() -> None:
    """Wurzel 8: ein Tippfehler im Jahr darf nicht Zehntausende Zeilen erzeugen."""
    tables = _tables()
    tables["block_requests"][0]["end_date"] = "2099-03-01"
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), "b-1", _entscheidung())
    assert exc.value.status_code == 422


def test_end_vor_start_422() -> None:
    tables = _tables()
    tables["block_requests"][0]["end_date"] = "2026-02-01"
    with pytest.raises(CalendarError) as exc:
        _svc(tables).genehmigen(_ctx(), "b-1", _entscheidung())
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
                "property_id": "p-1",
                "date": tag,
                "status": "blocked",
                "source": "manual",
                "unit_id": "u-1",
                # KEIN Antragsbezug: eine Betriebssperre entsteht ohne Antrag
                # (0337). Genau daran wird sie jetzt erkannt.
                "block_request_id": None,
            }
        )


def test_genehmigen_haengt_die_antrags_id_an_die_naechte() -> None:
    """0337: die gesperrten Nächte tragen, WELCHER Antrag sie gesperrt hat."""
    tables = _tables()
    _svc(tables).genehmigen(_ctx(), "b-1", _entscheidung())
    gesperrt = [r for r in tables["availability"] if r["status"] == "blocked"]
    assert len(gesperrt) == 3
    assert {r["block_request_id"] for r in gesperrt} == {"b-1"}


def test_widerruf_laesst_agentur_sperre_stehen() -> None:
    """BEFUND 6 — der Widerruf riss die Sperre des BETRIEBS mit auf.

    Ablauf: Die Agentur sperrt 1.–5. März wegen Handwerkern. Ein Eigentümer
    beantragt 1.–3., die Agentur genehmigt und nimmt später zurück. Vorher
    löschte `_unblock` ALLES mit `status='blocked' AND source='manual'` im
    Zeitraum — die Handwerker-Sperre für 1.–3. war mit weg und das Objekt über
    die Portale wieder buchbar.
    """
    tables = _tables()
    _agentur_sperre(
        tables, "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
        "2026-03-05",
    )
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    svc.zuruecknehmen(_ctx(), "b-1", _entscheidung("doch nicht"))

    verbleibend = sorted(
        r["date"] for r in tables["availability"] if r["status"] == "blocked"
    )
    # Die Agentur-Sperre steht für ALLE fünf Tage weiter.
    assert verbleibend == [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ]
    # Und keine dieser Zeilen trägt noch einen Antragsbezug.
    assert all(
        r.get("block_request_id") is None
        for r in tables["availability"]
        if r["status"] == "blocked"
    )


def test_widerruf_meldet_weiter_gesperrte_tage_nicht_als_frei() -> None:
    """Der Fehler darf auch nicht eine Ebene tiefer wandern: bleibt die
    Agentur-Sperre in der DB stehen, darf an Channex trotzdem KEIN
    `availability=1` für diese Tage gehen — sonst wäre die Nacht bei den
    Portalen wieder verkäuflich, obwohl der Kalender sie sperrt."""
    tables = _tables()
    _agentur_sperre(tables, "2026-03-01", "2026-03-02", "2026-03-03")
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    vorher = len(tables["ari_outbox"])
    svc.zuruecknehmen(_ctx(), "b-1", _entscheidung())
    # Kein einziger Freigabe-Job für die weiterhin gesperrten Tage.
    neue = tables["ari_outbox"][vorher:]
    freigaben = [
        j for j in neue
        if (j.get("payload") or {}).get("availability") == 1
    ]
    assert freigaben == []


def test_widerruf_ohne_fremde_sperre_gibt_weiterhin_frei() -> None:
    """Die Gegenprobe: ohne konkurrierende Sperre bleibt der Widerruf, was er
    war — die Nächte werden frei. Der Fix darf den Normalfall nicht lähmen."""
    tables = _tables()
    svc = _svc(tables)
    svc.genehmigen(_ctx(), "b-1", _entscheidung())
    svc.zuruecknehmen(_ctx(), "b-1", _entscheidung())
    assert [r for r in tables["availability"] if r["status"] == "blocked"] == []


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
