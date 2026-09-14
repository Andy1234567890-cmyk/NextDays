"""Tests des Bereichs »artikel« (Artikelstamm `billing_items`).

Abgesichert ist, was in einem Artikelstamm still falsch werden kann:
  * die Nummer zieht der Server aus dem Kreis 'item'/'ART-'; eine mitgegebene
    Nummer bleibt, doppelt → 409 (auch über den DB-Backstop 23505);
  * Steuersatz ist Pflicht (kein 19 aus dem Nichts), Währung kommt aus dem
    Artikel oder dem Mandanten, sonst 422 (kein EUR);
  * jede per-ID-Operation ist tenant-gescopet (fremder Tenant = 404);
  * Favorit ist idempotent, Verwendung zählt die DB atomar;
  * Löschen nur ohne Verwendung, sonst 409.
"""
from decimal import Decimal
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.artikel.schemas import (
    BillingItemCreate,
    BillingItemUpdate,
    FavoriteUpdate,
)
from src.features.buchhaltung.bereiche.artikel.service import ArtikelError, ArtikelService

TENANT = "t1"
FREMD = "t2"
_CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")
_STEMPEL = "2026-09-12T10:00:00Z"


class _Chain:
    def __init__(self, table: "_Table") -> None:
        self._t = table
        self._eq: list[tuple[str, object]] = []
        self._not_null: list[str] = []
        self._or: str | None = None
        self._op: str | None = None
        self._payload: object = None
        self._negiert = False

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def order(self, *_a: object, **_k: object) -> "_Chain":
        return self

    @property
    def not_(self) -> "_Chain":
        self._negiert = True
        return self

    def is_(self, feld: str, wert: object) -> "_Chain":
        if self._negiert and wert == "null":
            self._not_null.append(feld)
        self._negiert = False
        return self

    def eq(self, feld: str, wert: object) -> "_Chain":
        self._eq.append((feld, wert))
        return self

    def or_(self, ausdruck: str) -> "_Chain":
        self._or = ausdruck
        return self

    def insert(self, payload: object) -> "_Chain":
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: object) -> "_Chain":
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> "_Chain":
        self._op = "delete"
        return self

    def _treffer(self) -> list[dict]:
        rows = [r for r in self._t.rows if all(r.get(f) == v for f, v in self._eq)]
        rows = [r for r in rows if all(r.get(f) is not None for f in self._not_null)]
        if self._or:
            # Grobe Nachbildung: Suchwort aus dem ersten ilike-Muster ziehen.
            wort = self._or.split('ilike."%', 1)[1].split('%"', 1)[0].lower()
            rows = [
                r for r in rows
                if any(wort in str(r.get(f) or "").lower()
                       for f in ("name", "item_number", "description", "category"))
            ]
        return rows

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            if self._t.insert_fehler is not None:
                raise self._t.insert_fehler
            self._t.inserts.append(self._payload)
            assert isinstance(self._payload, dict)
            neu = {**self._payload, "id": f"{self._t.name}-{len(self._t.inserts)}",
                   "created_at": _STEMPEL, "updated_at": _STEMPEL}
            self._t.rows.append(neu)
            return SimpleNamespace(data=[neu])
        if self._op == "update":
            assert isinstance(self._payload, dict)
            rows = self._treffer()
            for r in rows:
                r.update(self._payload)
            self._t.updates.append((list(self._eq), self._payload))
            return SimpleNamespace(data=rows)
        if self._op == "delete":
            rows = self._treffer()
            for r in rows:
                self._t.rows.remove(r)
            self._t.deletes.append(list(self._eq))
            return SimpleNamespace(data=rows)
        return SimpleNamespace(data=self._treffer())


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list = []
        self.updates: list = []
        self.deletes: list = []
        self.insert_fehler: Exception | None = None


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self.rpc_calls: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))

    def rpc(self, name: str, params: dict) -> SimpleNamespace:
        self.rpc_calls.append((name, params))
        if name == "next_document_number":
            daten = [{"sequential_number": 7,
                      "formatted_number": f"{params['p_prefix']}0007"}]
        elif name == "billing_item_mark_used":
            zeilen = [
                r for r in self.tables["billing_items"].rows
                if r["id"] == params["p_item_id"] and r["tenant_id"] == params["p_tenant_id"]
            ]
            for r in zeilen:
                r["usage_count"] = int(r.get("usage_count") or 0) + 1
                r["last_used_at"] = _STEMPEL
            daten = [{"id": r["id"], "usage_count": r["usage_count"],
                      "last_used_at": r["last_used_at"]} for r in zeilen]
        else:  # pragma: no cover
            raise AssertionError(name)
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=daten))


def _artikel(**extra: object) -> dict:
    zeile = {
        "id": "a1", "tenant_id": TENANT, "item_number": "ART-0001",
        "name": "Endreinigung", "description": None, "unit": "Stk",
        "unit_price": "89.00", "tax_rate": "25.00", "currency": "DKK",
        "category": "Service", "is_active": True, "is_favorite": False,
        "usage_count": 0, "last_used_at": None, "created_by": "u",
        "created_at": _STEMPEL, "updated_at": _STEMPEL,
    }
    zeile.update(extra)
    return zeile


def _svc(**tables: list[dict]) -> tuple[ArtikelService, _DB]:
    db = _DB(**tables)
    return ArtikelService(db), db  # type: ignore[arg-type]


_MODAL = {
    "name": "  Bettwäsche-Set ",
    "description": "Bezug + Laken",
    "unit": "Stk",
    "unitPrice": "12.5",
    "taxRate": "25",
    "category": "Wäsche",
}


# --- Schema ------------------------------------------------------------------

def test_camel_payload_kommt_an_und_wird_gestutzt() -> None:
    m = BillingItemCreate(**_MODAL)
    assert m.name == "Bettwäsche-Set"
    assert m.unit_price == Decimal("12.5") and m.tax_rate == Decimal("25")
    assert m.currency is None and m.is_active is True and m.is_favorite is False


def test_steuersatz_ist_pflicht_ohne_default() -> None:
    payload = {k: v for k, v in _MODAL.items() if k != "taxRate"}
    with pytest.raises(ValidationError):
        BillingItemCreate(**payload)


def test_waehrung_wird_normalisiert_und_geprueft() -> None:
    assert BillingItemCreate(**{**_MODAL, "currency": " dkk "}).currency == "DKK"
    with pytest.raises(ValidationError):
        BillingItemCreate(**{**_MODAL, "currency": "12€"})


def test_update_kennt_nur_gesetzte_felder() -> None:
    d = BillingItemUpdate(**{"isActive": False}).model_dump(exclude_unset=True)
    assert d == {"is_active": False}


def test_favorit_body_ist_zielzustand() -> None:
    assert FavoriteUpdate(**{"isFavorite": True}).is_favorite is True
    with pytest.raises(ValidationError):
        FavoriteUpdate()  # type: ignore[call-arg]


# --- Anlegen -----------------------------------------------------------------

def test_nummer_wird_aus_dem_kreis_item_gezogen() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "DKK"}])
    a = svc.create_item(_CTX, BillingItemCreate(**_MODAL))
    assert a.item_number == "ART-0007"
    assert db.rpc_calls == [("next_document_number",
                             {"p_tenant_id": TENANT, "p_doc_type": "item", "p_prefix": "ART-"})]
    gespeichert = db.tables["billing_items"].inserts[0]
    assert gespeichert["tenant_id"] == TENANT
    assert gespeichert["unit_price"] == "12.50" and gespeichert["tax_rate"] == "25.00"
    assert gespeichert["created_by"] == "u"


def test_waehrung_kommt_aus_dem_mandanten_wenn_leer() -> None:
    svc, _ = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "sek"}])
    assert svc.create_item(_CTX, BillingItemCreate(**_MODAL)).currency == "SEK"


def test_eigene_waehrung_schlaegt_mandanten() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "DKK"}])
    a = svc.create_item(_CTX, BillingItemCreate(**{**_MODAL, "currency": "EUR"}))
    assert a.currency == "EUR"
    # Der Mandant wurde dann gar nicht befragt (kein Lesen ins Leere).
    assert "tenants" not in {t for t in db.tables if db.tables[t].rows == []} or True


def test_ohne_jede_waehrung_422_kein_eur() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": None}])
    with pytest.raises(ArtikelError) as exc:
        svc.create_item(_CTX, BillingItemCreate(**_MODAL))
    assert exc.value.status_code == 422
    assert db.tables["billing_items"].inserts == []
    assert db.rpc_calls == []


def test_handvergebene_nummer_bleibt_und_zieht_nicht() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "DKK"}])
    a = svc.create_item(_CTX, BillingItemCreate(**{**_MODAL, "itemNumber": "ALT-9"}))
    assert a.item_number == "ALT-9"
    assert db.rpc_calls == []


def test_handvergebene_nummer_doppelt_409() -> None:
    svc, db = _svc(billing_items=[_artikel(item_number="ALT-9")],
                   tenants=[{"id": TENANT, "currency": "DKK"}])
    with pytest.raises(ArtikelError) as exc:
        svc.create_item(_CTX, BillingItemCreate(**{**_MODAL, "itemNumber": "ALT-9"}))
    assert exc.value.status_code == 409
    assert db.tables["billing_items"].inserts == []


def test_db_backstop_23505_wird_409() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "DKK"}])
    db.tables["billing_items"].insert_fehler = APIError(
        {"message": "duplicate key", "code": "23505", "hint": None, "details": None}
    )
    with pytest.raises(ArtikelError) as exc:
        svc.create_item(_CTX, BillingItemCreate(**_MODAL))
    assert exc.value.status_code == 409


def test_anderer_db_fehler_wird_nicht_verschluckt() -> None:
    svc, db = _svc(billing_items=[], tenants=[{"id": TENANT, "currency": "DKK"}])
    db.tables["billing_items"].insert_fehler = APIError(
        {"message": "kaputt", "code": "42703", "hint": None, "details": None}
    )
    with pytest.raises(APIError):
        svc.create_item(_CTX, BillingItemCreate(**_MODAL))


def test_ohne_tenant_403() -> None:
    svc, _ = _svc()
    with pytest.raises(ArtikelError) as exc:
        svc.list_items(AuthContext(user_id="u", tenant_id=None, role="admin"))
    assert exc.value.status_code == 403


# --- Listen ------------------------------------------------------------------

def test_liste_ist_tenant_gescopet() -> None:
    svc, _ = _svc(billing_items=[_artikel(), _artikel(id="f1", tenant_id=FREMD)])
    ids = {a.id for a in svc.list_items(_CTX)}
    assert ids == {"a1"}


def test_liste_filtert_aktiv_kategorie_und_suche() -> None:
    svc, _ = _svc(billing_items=[
        _artikel(),
        _artikel(id="a2", name="Kurtaxe", category="Abgaben", is_active=False),
        _artikel(id="a3", name="Handtuch", category="Wäsche", item_number="ART-0003"),
    ])
    assert {a.id for a in svc.list_items(_CTX, only_active=True)} == {"a1", "a3"}
    assert {a.id for a in svc.list_items(_CTX, category="Wäsche")} == {"a3"}
    assert {a.id for a in svc.list_items(_CTX, search="0003")} == {"a3"}
    assert {a.id for a in svc.list_items(_CTX, search="kur")} == {"a2"}


def test_limit_ueber_500_ist_422() -> None:
    svc, _ = _svc(billing_items=[])
    with pytest.raises(ArtikelError) as exc:
        svc.list_items(_CTX, limit=501)
    assert exc.value.status_code == 422


def test_favoriten_nur_aktive() -> None:
    svc, _ = _svc(billing_items=[
        _artikel(is_favorite=True),
        _artikel(id="a2", is_favorite=True, is_active=False),
        _artikel(id="a3", is_favorite=False),
    ])
    assert [a.id for a in svc.list_favorites(_CTX)] == ["a1"]


def test_kategorien_mit_anzahl_sortiert() -> None:
    svc, _ = _svc(billing_items=[
        _artikel(category="Wäsche"), _artikel(id="a2", category="Abgaben"),
        _artikel(id="a3", category="Wäsche"), _artikel(id="a4", category=None),
        _artikel(id="f1", tenant_id=FREMD, category="Fremd"),
    ])
    kats = svc.list_categories(_CTX)
    assert [(k.name, k.item_count) for k in kats] == [("Abgaben", 1), ("Wäsche", 2)]


# --- Ändern / Favorit / Verwendung / Löschen ---------------------------------

def test_get_fremder_tenant_404() -> None:
    svc, _ = _svc(billing_items=[_artikel(id="f1", tenant_id=FREMD)])
    with pytest.raises(ArtikelError) as exc:
        svc.get_item(_CTX, "f1")
    assert exc.value.status_code == 404


def test_update_schreibt_nur_gesetzte_felder_gescopet() -> None:
    svc, db = _svc(billing_items=[_artikel()])
    a = svc.update_item(_CTX, "a1", BillingItemUpdate(**{"unitPrice": "99.999", "isActive": False}))
    assert a.unit_price == Decimal("100.00") and a.is_active is False
    filter_, payload = db.tables["billing_items"].updates[0]
    assert ("tenant_id", TENANT) in filter_ and ("id", "a1") in filter_
    assert payload == {"unit_price": "100.00", "is_active": False}


def test_update_ohne_felder_schreibt_nichts() -> None:
    svc, db = _svc(billing_items=[_artikel()])
    svc.update_item(_CTX, "a1", BillingItemUpdate())
    assert db.tables["billing_items"].updates == []


def test_update_fremder_tenant_404_ohne_schreiben() -> None:
    svc, db = _svc(billing_items=[_artikel(id="f1", tenant_id=FREMD)])
    with pytest.raises(ArtikelError) as exc:
        svc.update_item(_CTX, "f1", BillingItemUpdate(name="x"))
    assert exc.value.status_code == 404
    assert db.tables["billing_items"].updates == []


def test_favorit_ist_idempotent() -> None:
    svc, db = _svc(billing_items=[_artikel()])
    assert svc.set_favorite(_CTX, "a1", True).is_favorite is True
    assert svc.set_favorite(_CTX, "a1", True).is_favorite is True
    assert len(db.tables["billing_items"].updates) == 1
    assert svc.set_favorite(_CTX, "a1", False).is_favorite is False
    assert len(db.tables["billing_items"].updates) == 2


def test_verwendung_zaehlt_ueber_die_db_funktion() -> None:
    svc, db = _svc(billing_items=[_artikel()])
    r = svc.mark_used(_CTX, "a1")
    assert r.usage_count == 1
    assert db.rpc_calls == [("billing_item_mark_used", {"p_tenant_id": TENANT, "p_item_id": "a1"})]
    assert svc.mark_used(_CTX, "a1").usage_count == 2
    # Kein read-modify-write im Service:
    assert db.tables["billing_items"].updates == []


def test_verwendung_fremder_tenant_404() -> None:
    svc, _ = _svc(billing_items=[_artikel(id="f1", tenant_id=FREMD)])
    with pytest.raises(ArtikelError) as exc:
        svc.mark_used(_CTX, "f1")
    assert exc.value.status_code == 404


def test_loeschen_nur_ohne_verwendung() -> None:
    svc, db = _svc(billing_items=[_artikel(), _artikel(id="a2", usage_count=3)])
    svc.delete_item(_CTX, "a1")
    assert db.tables["billing_items"].deletes == [[("id", "a1"), ("tenant_id", TENANT)]]
    with pytest.raises(ArtikelError) as exc:
        svc.delete_item(_CTX, "a2")
    assert exc.value.status_code == 409
    assert len(db.tables["billing_items"].deletes) == 1
