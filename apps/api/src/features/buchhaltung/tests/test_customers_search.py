"""Tests für die Kundensuche und den Einzelabruf (11.09.2026).

Fokus:
  * `GET /customers` filtert in der DATENBANK — vorher lieferte die Route immer
    alle Kunden, und zwei Aufrufer im Bestand nahmen `[0]` als Treffer;
  * Nutzereingabe wird zu einem sicheren LIKE-Muster: `%`/`_` sind Platzhalter,
    Komma und Anführungszeichen sind PostgREST-Syntax im `or_`-Filter;
  * `limit` hat eine harte Obergrenze (Wurzel 8);
  * `get_customer` scopt auf den Tenant (Wurzel 3) und behandelt Soft-Gelöschte
    wie nicht vorhanden.
"""
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import (
    BuchhaltungError,
    BuchhaltungService,
    _like_muster,
)

TENANT = "t1"
_CTX = AuthContext(user_id="u", tenant_id=TENANT)


class _Chain:
    """Zeichnet die Filterkette auf und liefert die hinterlegten Zeilen, nach
    `eq`-Filtern gefiltert. `ilike`/`or_`/`is_` werden nur PROTOKOLLIERT — die
    Tests prüfen, WAS an die Datenbank geht, nicht PostgREST selbst."""

    def __init__(self, rows: list[dict], protokoll: list[tuple]) -> None:
        self._rows = rows
        self._p = protokoll
        self._eq: list[tuple[str, object]] = []

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def eq(self, feld: str, wert: object) -> "_Chain":
        self._eq.append((feld, wert))
        self._p.append(("eq", feld, wert))
        return self

    def is_(self, feld: str, wert: object) -> "_Chain":
        self._p.append(("is_", feld, wert))
        return self

    def ilike(self, feld: str, muster: str) -> "_Chain":
        self._p.append(("ilike", feld, muster))
        return self

    def or_(self, ausdruck: str) -> "_Chain":
        self._p.append(("or_", ausdruck))
        return self

    def order(self, feld: str) -> "_Chain":
        self._p.append(("order", feld))
        return self

    def limit(self, n: int) -> "_Chain":
        self._p.append(("limit", n))
        return self

    def execute(self) -> SimpleNamespace:
        rows = [r for r in self._rows if all(r.get(f) == v for f, v in self._eq)]
        return SimpleNamespace(data=rows)


class _DB:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.protokoll: list[tuple] = []

    def table(self, name: str) -> _Chain:
        assert name == "customers"
        return _Chain(self.rows, self.protokoll)


def _service(rows: list[dict]) -> tuple[BuchhaltungService, _DB]:
    db = _DB(rows)
    return BuchhaltungService(db), db  # type: ignore[arg-type]


# --- LIKE-Muster -------------------------------------------------------------

def test_like_muster_maskiert_platzhalter() -> None:
    # `100%` darf nicht jeden Kunden treffen, `a_b` nicht `aXb`.
    assert _like_muster("100%", roh=True) == "%100\\%%"
    assert _like_muster("a_b", roh=True) == "%a\\_b%"
    assert _like_muster("x\\y", roh=True) == "%x\\\\y%"


def test_like_muster_setzt_anfuehrungszeichen_fuer_or_filter() -> None:
    # Komma ist im PostgREST-`or_` das Trennzeichen zwischen Bedingungen.
    assert _like_muster("Müller, Hans") == '"%Müller, Hans%"'
    assert _like_muster('Say "hi"') == '"%Say \\"hi\\"%"'


def test_like_muster_exakt_ohne_teiltreffer() -> None:
    assert _like_muster("a@b.de", roh=True, teiltreffer=False) == "a@b.de"


# --- Suche -------------------------------------------------------------------

def test_suche_ohne_parameter_liefert_alle_des_tenants() -> None:
    svc, _ = _service([
        {"id": "c1", "tenant_id": TENANT, "name": "A"},
        {"id": "c2", "tenant_id": "fremd", "name": "B"},
    ])
    ergebnis = svc.search_customers(_CTX)
    assert [r["id"] for r in ergebnis] == ["c1"]


def test_suche_schickt_filter_an_die_datenbank() -> None:
    svc, db = _service([])
    svc.search_customers(_CTX, search="Hans", name="Mü", email="H@X.de", limit=1)
    erwartet_or = 'name.ilike."%Hans%",email.ilike."%Hans%",customer_number.ilike."%Hans%"'
    assert ("or_", erwartet_or) in db.protokoll
    assert ("ilike", "name", "%Mü%") in db.protokoll
    assert ("ilike", "email", "H@X.de") in db.protokoll
    assert ("limit", 1) in db.protokoll
    # Soft-Gelöschte bleiben immer draußen.
    assert ("is_", "deleted_at", "null") in db.protokoll


def test_suche_ohne_filter_schickt_keine_like_bedingung() -> None:
    svc, db = _service([])
    svc.search_customers(_CTX)
    assert not [e for e in db.protokoll if e[0] in ("or_", "ilike", "limit")]


def test_lieferantenfilter() -> None:
    svc, db = _service([])
    svc.search_customers(_CTX, is_supplier=True)
    assert ("eq", "is_supplier", True) in db.protokoll


@pytest.mark.parametrize("limit", [0, 201, -5])
def test_limit_ausserhalb_der_grenze_ist_422_vor_jedem_db_zugriff(limit: int) -> None:
    svc, db = _service([])
    with pytest.raises(BuchhaltungError) as exc:
        svc.search_customers(_CTX, limit=limit)
    assert exc.value.status_code == 422
    assert db.protokoll == []


def test_suche_ohne_tenant_ist_fehler() -> None:
    svc, _ = _service([])
    with pytest.raises(BuchhaltungError) as exc:
        svc.search_customers(AuthContext(user_id="u", tenant_id=None))
    assert exc.value.status_code == 400


# --- Einzelabruf -------------------------------------------------------------

def test_get_customer_liefert_eigenen_kunden() -> None:
    svc, _ = _service([{"id": "c1", "tenant_id": TENANT, "name": "A", "deleted_at": None}])
    assert svc.get_customer(_CTX, "c1")["name"] == "A"


def test_get_customer_fremder_tenant_ist_404() -> None:
    # Dieselbe Meldung wie „gibt es nicht" — kein Existenz-Leak (Wurzel 3).
    svc, _ = _service([{"id": "c1", "tenant_id": "fremd", "name": "A"}])
    with pytest.raises(BuchhaltungError) as exc:
        svc.get_customer(_CTX, "c1")
    assert exc.value.status_code == 404


def test_get_customer_soft_geloescht_ist_404() -> None:
    svc, _ = _service([{"id": "c1", "tenant_id": TENANT, "name": "A", "deleted_at": "2026-01-01"}])
    with pytest.raises(BuchhaltungError) as exc:
        svc.get_customer(_CTX, "c1")
    assert exc.value.status_code == 404
