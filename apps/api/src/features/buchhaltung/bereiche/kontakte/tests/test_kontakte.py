"""Tests des Bereichs »kontakte« (12.09.2026).

Abgesichert sind die Regeln, die vorher der Browser „hatte" und die deshalb
nie geprüft waren:
  * Hauptkontakt/Standardanschrift: der alte verliert die Markierung (Wurzel 1),
    ein Unique-Treffer (23505) wird 409, nicht 500 (Wurzel 2/5);
  * Unterdatensätze sind auf Tenant UND Kunde gescopet (Wurzel 3/9);
  * soft-gelöschter Kunde ist 404;
  * Kennzahlen je Währung getrennt, Rechnung ohne Währung → 422 (Wurzel 4);
  * Obergrenzen (limit) → 422 (Wurzel 8);
  * Lieferantenliste ruft die Bestandssuche mit `is_supplier=True` auf;
  * jede Route hängt am Rollen+Modul-Guard.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.kontakte import router as kontakte_router
from src.features.buchhaltung.bereiche.kontakte.schemas import (
    AddressCreate,
    AddressUpdate,
    ContactCreate,
    ContactUpdate,
    NoteCreate,
)
from src.features.buchhaltung.bereiche.kontakte.service import KontakteError, KontakteService

TENANT = "t1"
FREMD = "t2"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
JETZT = "2026-09-12T10:00:00+00:00"


class _Chain:
    def __init__(self, table: "_Table") -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op = "select"
        self._payload: object = None
        self._limit: int | None = None
        self._order: list[tuple[str, bool]] = []
        self._raise: APIError | None = None

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def eq(self, feld: str, wert: object) -> "_Chain":
        self._filter.append(("eq", feld, wert))
        return self

    def neq(self, feld: str, wert: object) -> "_Chain":
        self._filter.append(("neq", feld, wert))
        return self

    def is_(self, feld: str, wert: object) -> "_Chain":
        self._filter.append(("is", feld, wert))
        return self

    def in_(self, feld: str, werte: list) -> "_Chain":
        self._filter.append(("in", feld, werte))
        return self

    def order(self, feld: str, desc: bool = False) -> "_Chain":
        self._order.append((feld, desc))
        return self

    def limit(self, n: int) -> "_Chain":
        self._limit = n
        return self

    def insert(self, payload: dict) -> "_Chain":
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> "_Chain":
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> "_Chain":
        self._op = "delete"
        return self

    def _passt(self, r: dict) -> bool:
        for art, feld, wert in self._filter:
            v = r.get(feld)
            if art == "eq" and v != wert:
                return False
            if art == "neq" and v == wert:
                return False
            if art == "is" and wert == "null" and v is not None:
                return False
            if art == "in" and v not in wert:
                return False
        return True

    def execute(self) -> SimpleNamespace:
        if self._t.fehler_beim_insert and self._op == "insert":
            raise self._t.fehler_beim_insert
        if self._op == "insert":
            neu = {**self._payload, "id": f"{self._t.name}-{len(self._t.rows) + 1}"}
            neu.setdefault("created_at", JETZT)
            neu.setdefault("updated_at", JETZT)
            self._t.rows.append(neu)
            self._t.inserts.append(neu)
            return SimpleNamespace(data=[neu])
        treffer = [r for r in self._t.rows if self._passt(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload)
            self._t.updates.append((list(self._filter), self._payload))
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            self._t.rows[:] = [r for r in self._t.rows if r not in treffer]
            return SimpleNamespace(data=treffer)
        for feld, desc in reversed(self._order):
            treffer.sort(key=lambda r, f=feld: str(r.get(f) or ""), reverse=desc)
        if self._limit is not None:
            treffer = treffer[: self._limit]
        return SimpleNamespace(data=treffer)


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list[dict] = []
        self.updates: list = []
        self.fehler_beim_insert: APIError | None = None


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))


class _Bestand:
    def __init__(self) -> None:
        self.aufrufe: list[dict] = []

    def search_customers(self, ctx: AuthContext, **kw: object) -> list[dict]:
        self.aufrufe.append(kw)
        return [{"id": "c1", "name": "Lieferant", "is_supplier": True}]


def _kunde(cid: str = "c1", tenant: str = TENANT, **extra: object) -> dict:
    return {"id": cid, "tenant_id": tenant, "name": "Kunde", "is_supplier": False,
            "deleted_at": None, **extra}


def _kontakt(cid: str, kid: str, primary: bool = False, tenant: str = TENANT) -> dict:
    return {"id": kid, "tenant_id": tenant, "customer_id": cid, "name": f"K {kid}",
            "is_primary": primary, "created_at": JETZT, "updated_at": JETZT}


def _service(db: _DB) -> KontakteService:
    return KontakteService(db, bestand=_Bestand())  # type: ignore[arg-type]


# --- Ansprechpartner -----------------------------------------------------------


def test_neuer_hauptkontakt_entthront_den_alten() -> None:
    db = _DB(customers=[_kunde()], customer_contacts=[_kontakt("c1", "k1", primary=True)])
    neu = _service(db).create_contact(CTX, "c1", ContactCreate(name="Neu", is_primary=True))
    assert neu.is_primary is True
    alte = next(r for r in db.tables["customer_contacts"].rows if r["id"] == "k1")
    assert alte["is_primary"] is False
    assert db.tables["customer_contacts"].inserts[0]["created_by"] == "u1"


def test_hauptkontakt_per_patch_raeumt_andere_ab() -> None:
    db = _DB(customers=[_kunde()],
             customer_contacts=[_kontakt("c1", "k1", primary=True), _kontakt("c1", "k2")])
    res = _service(db).update_contact(CTX, "c1", "k2", ContactUpdate(is_primary=True))
    assert res.is_primary is True
    rows = {r["id"]: r["is_primary"] for r in db.tables["customer_contacts"].rows}
    assert rows == {"k1": False, "k2": True}


def test_unique_treffer_wird_409() -> None:
    db = _DB(customers=[_kunde()], customer_contacts=[])
    db.tables["customer_contacts"].fehler_beim_insert = APIError(
        {"message": "duplicate", "code": "23505"}
    )
    with pytest.raises(KontakteError) as exc:
        _service(db).create_contact(CTX, "c1", ContactCreate(name="X", is_primary=True))
    assert exc.value.status_code == 409


def test_kontakt_eines_anderen_kunden_ist_404() -> None:
    """Wurzel 9: /customers/c1/contacts/k2 mit k2 an c2 → 404, nicht Zugriff."""
    db = _DB(customers=[_kunde("c1"), _kunde("c2")], customer_contacts=[_kontakt("c2", "k2")])
    with pytest.raises(KontakteError) as exc:
        _service(db).update_contact(CTX, "c1", "k2", ContactUpdate(name="Hack"))
    assert exc.value.status_code == 404
    assert db.tables["customer_contacts"].rows[0]["name"] == "K k2"


def test_kunde_eines_fremden_tenants_ist_404() -> None:
    db = _DB(customers=[_kunde("c9", tenant=FREMD)])
    with pytest.raises(KontakteError) as exc:
        _service(db).list_contacts(CTX, "c9")
    assert exc.value.status_code == 404


def test_geloeschter_kunde_ist_404() -> None:
    db = _DB(customers=[_kunde(deleted_at=JETZT)])
    with pytest.raises(KontakteError) as exc:
        _service(db).list_notes(CTX, "c1")
    assert exc.value.status_code == 404


def test_ohne_tenant_403() -> None:
    with pytest.raises(KontakteError) as exc:
        _service(_DB()).list_contacts(AuthContext(user_id="u", tenant_id=None, role="admin"), "c1")
    assert exc.value.status_code == 403


def test_hauptkontakt_steht_vorn() -> None:
    db = _DB(customers=[_kunde()],
             customer_contacts=[_kontakt("c1", "k1"), _kontakt("c1", "k2", primary=True)])
    liste = _service(db).list_contacts(CTX, "c1")
    assert [k.id for k in liste] == ["k2", "k1"]


# --- Anschriften ---------------------------------------------------------------


def test_standardanschrift_nur_je_art() -> None:
    db = _DB(customers=[_kunde()], customer_addresses=[
        {"id": "a1", "tenant_id": TENANT, "customer_id": "c1", "type": "billing",
         "country": "DE", "is_default": True, "created_at": JETZT, "updated_at": JETZT},
        {"id": "a2", "tenant_id": TENANT, "customer_id": "c1", "type": "shipping",
         "country": "DE", "is_default": True, "created_at": JETZT, "updated_at": JETZT},
    ])
    neu = _service(db).create_address(
        CTX, "c1", AddressCreate(type="billing", country="dk", city="Aarhus", is_default=True)
    )
    assert neu.country == "DK"
    rows = {r["id"]: r["is_default"] for r in db.tables["customer_addresses"].rows}
    # billing-Standard gewechselt, shipping-Standard unberührt.
    assert rows["a1"] is False and rows["a2"] is True and rows[neu.id] is True


def test_anschrift_ohne_land_wird_abgelehnt() -> None:
    with pytest.raises(ValueError):
        AddressCreate(type="billing", country="")
    with pytest.raises(ValueError):
        AddressCreate(type="billing", country="DEU")


def test_artwechsel_einer_standardanschrift_raeumt_neue_art_ab() -> None:
    db = _DB(customers=[_kunde()], customer_addresses=[
        {"id": "a1", "tenant_id": TENANT, "customer_id": "c1", "type": "billing",
         "country": "DE", "is_default": True, "created_at": JETZT, "updated_at": JETZT},
        {"id": "a2", "tenant_id": TENANT, "customer_id": "c1", "type": "shipping",
         "country": "DE", "is_default": True, "created_at": JETZT, "updated_at": JETZT},
    ])
    _service(db).update_address(CTX, "c1", "a1", AddressUpdate(type="shipping"))
    rows = {r["id"]: (r["type"], r["is_default"]) for r in db.tables["customer_addresses"].rows}
    assert rows == {"a1": ("shipping", True), "a2": ("shipping", False)}


# --- Notizen -------------------------------------------------------------------


def test_notiz_traegt_autor_und_bereinigte_tags() -> None:
    db = _DB(customers=[_kunde()],
             users=[{"id": "u1", "tenant_id": TENANT, "full_name": "Anna Admin"}])
    notiz = _service(db).create_note(
        CTX, "c1", NoteCreate(text="  Rückruf  ", tags=["VIP", " vip", "", "Stammkunde"])
    )
    assert notiz.text == "Rückruf"
    assert notiz.tags == ["VIP", "Stammkunde"]
    assert notiz.author_name == "Anna Admin"
    assert notiz.created_by == "u1"


def test_autor_aus_fremdem_tenant_wird_nicht_gelesen() -> None:
    db = _DB(customers=[_kunde()],
             users=[{"id": "u1", "tenant_id": FREMD, "full_name": "Fremd"}])
    notiz = _service(db).create_note(CTX, "c1", NoteCreate(text="x"))
    assert notiz.author_name is None


def test_leere_notiz_422() -> None:
    with pytest.raises(ValueError):
        NoteCreate(text="   ")


# --- Übersicht -----------------------------------------------------------------


def _rechnung(iid: str, waehrung: str | None, brutto: str, bezahlt: str, status: str,
              faellig_in_tagen: int, typ: str = "invoice") -> dict:
    heute = datetime.now(UTC).date()
    return {
        "id": iid, "tenant_id": TENANT, "customer_id": "c1", "invoice_number": f"RE-{iid}",
        "invoice_type": typ, "status": status,
        "issue_date": (heute - timedelta(days=10)).isoformat(),
        "due_date": (heute + timedelta(days=faellig_in_tagen)).isoformat(),
        "gross_amount": brutto, "paid_amount": bezahlt, "currency": waehrung,
        "deleted_at": None, "created_at": JETZT,
    }


def test_kennzahlen_je_waehrung_getrennt() -> None:
    db = _DB(customers=[_kunde()], invoices=[
        _rechnung("1", "EUR", "100.00", "0", "sent", -5),        # überfällig offen
        _rechnung("2", "EUR", "50.00", "50.00", "paid", 5),      # bezahlt
        _rechnung("3", "DKK", "700.00", "200.00", "sent", 5),    # offen, nicht überfällig
        _rechnung("4", "EUR", "999.00", "0", "draft", 5),        # Entwurf: kein Umsatz
        _rechnung("5", "EUR", "20.00", "0", "sent", 5, typ="credit_note"),  # kein Umsatz
        _rechnung("6", "EUR", "10.00", "0", "cancelled", 5),     # storniert: kein Umsatz
    ])
    ov = _service(db).get_overview(CTX, "c1", limit=3)
    assert [w.currency for w in ov.by_currency] == ["DKK", "EUR"]
    dkk, eur = ov.by_currency
    assert eur.revenue_total == Decimal("150.00")
    assert eur.open_amount == Decimal("120.00")   # 100 (Rechnung) + 20 (Gutschrift, sent)
    assert eur.overdue_amount == Decimal("100.00")
    assert eur.overdue_count == 1 and eur.open_count == 2 and eur.invoice_count == 5
    assert dkk.revenue_total == Decimal("700.00")
    assert dkk.open_amount == Decimal("500.00")
    assert dkk.overdue_amount == Decimal("0.00")
    assert ov.invoice_count == 6
    assert len(ov.invoices) == 3
    assert ov.truncated is False
    assert ov.last_invoice_number is not None


def test_rechnung_ohne_waehrung_ist_422() -> None:
    db = _DB(customers=[_kunde()], invoices=[_rechnung("1", None, "100.00", "0", "sent", 1)])
    with pytest.raises(KontakteError) as exc:
        _service(db).get_overview(CTX, "c1")
    assert exc.value.status_code == 422


def test_uebersicht_fasst_tags_zusammen() -> None:
    db = _DB(customers=[_kunde()], customer_notes=[
        {"id": "n1", "tenant_id": TENANT, "customer_id": "c1", "text": "a", "tags": ["VIP"],
         "created_at": JETZT, "updated_at": JETZT},
        {"id": "n2", "tenant_id": TENANT, "customer_id": "c1", "text": "b",
         "tags": ["vip", "Hotel"], "created_at": JETZT, "updated_at": JETZT},
    ])
    ov = _service(db).get_overview(CTX, "c1")
    assert ov.tags == ["VIP", "Hotel"]
    assert ov.note_count == 2
    assert ov.by_currency == [] and ov.invoice_count == 0


def test_limit_obergrenze_422() -> None:
    db = _DB(customers=[_kunde()])
    with pytest.raises(KontakteError) as exc:
        _service(db).get_overview(CTX, "c1", limit=501)
    assert exc.value.status_code == 422


# --- Lieferanten ---------------------------------------------------------------


def test_lieferanten_rufen_bestandssuche_mit_is_supplier() -> None:
    bestand = _Bestand()
    service = KontakteService(_DB(), bestand=bestand)  # type: ignore[arg-type]
    res = service.list_suppliers(CTX, search="lie", limit=10)
    assert res[0]["is_supplier"] is True
    assert bestand.aufrufe == [
        {"search": "lie", "name": None, "email": None, "is_supplier": True, "limit": 10}
    ]


# --- Guards --------------------------------------------------------------------


def test_jede_route_haengt_am_rollen_und_modul_guard() -> None:
    def _namen(dep) -> set[str]:  # noqa: ANN001
        namen: set[str] = set()
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", str(sub.call)))
            namen |= _namen(sub)
        return namen

    routen = [r for r in kontakte_router.router.routes if hasattr(r, "dependant")]
    assert len(routen) == 14
    for route in routen:
        kette = _namen(route.dependant)
        assert "_require_agency_finance_with_modul" in kette, route.path
        assert "_require_agency_finance" in kette, route.path
