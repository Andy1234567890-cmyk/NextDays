"""Tests für „Kunde anlegen" und die Nummernvergabe (11.09.2026).

Was hier abgesichert ist — jedes war vorher LIVE falsch:
  * das camelCase-Payload des Modals kommt vollständig an (vorher: 422 wegen
    `address` als Text, und selbst ohne Text überlebten nur name/email/phone);
  * die Kundennummer vergibt der Server — Vorschau oder leer → atomar gezogen,
    von Hand geändert → behalten, doppelt → 409;
  * die Nummernkreise haben die Form, die der Bestand liest (`type: 'Kunde'`);
  * ein Angebot bekommt eine Nummer (vorher: `quote_number` blieb null).
"""
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.schemas import CustomerCreate, CustomerUpdate, QuoteCreate
from src.features.buchhaltung.service import BuchhaltungError, BuchhaltungService

TENANT = "t1"
_CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")


class _Chain:
    def __init__(self, table: "_Table") -> None:
        self._t = table
        self._eq: list[tuple[str, object]] = []
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def order(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def is_(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def eq(self, feld: str, wert: object) -> "_Chain":
        self._eq.append((feld, wert))
        return self

    def insert(self, payload: object) -> "_Chain":
        self._op, self._payload = "insert", payload
        return self

    def execute(self) -> SimpleNamespace:
        if self._op == "insert":
            self._t.inserts.append(self._payload)
            if isinstance(self._payload, dict):
                neu = {**self._payload, "id": f"{self._t.name}-1"}
                neu.setdefault("created_at", "2026-09-11T00:00:00Z")
                neu.setdefault("updated_at", "2026-09-11T00:00:00Z")
                return SimpleNamespace(data=[neu])
            return SimpleNamespace(data=[{"id": "x"}])
        rows = [r for r in self._t.rows if all(r.get(f) == v for f, v in self._eq)]
        return SimpleNamespace(data=rows)


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list = []


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self.rpc_calls: list[dict] = []

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))

    def rpc(self, name: str, params: dict) -> SimpleNamespace:
        assert name == "next_document_number"
        self.rpc_calls.append(params)
        return SimpleNamespace(
            execute=lambda: SimpleNamespace(
                data=[{"sequential_number": 7, "formatted_number": f"{params['p_prefix']}0007"}]
            )
        )


def _svc(**tables: list[dict]) -> tuple[BuchhaltungService, _DB]:
    db = _DB(**tables)
    return BuchhaltungService(service_client=db), db  # type: ignore[arg-type]


_MODAL_PAYLOAD = {
    "customerNumber": "",
    "name": "Test GmbH",
    "email": "t@x.de",
    "phone": "+49 30 1",
    "address": "Str 1\n12345 Ort\nDeutschland",
    "street": "Str 1",
    "city": "Ort",
    "postalCode": "12345",
    "country": "Deutschland",
    "taxNumber": "1/2/3",
    "vatId": "DE123",
    "vatValidated": True,
    "isSupplier": False,
    "organizationType": "Kunde",
    "creditLimit": 5000,
    "notes": "n",
}


# --- Schema ------------------------------------------------------------------

def test_modal_payload_kommt_vollstaendig_an() -> None:
    m = CustomerCreate(**_MODAL_PAYLOAD)
    d = m.model_dump(mode="json")
    assert d["vat_id"] == "DE123"
    assert d["tax_number"] == "1/2/3"
    assert d["credit_limit"] == "5000"
    assert d["address"] == {
        "text": "Str 1\n12345 Ort\nDeutschland",
        "street": "Str 1",
        "postal_code": "12345",
        "city": "Ort",
        "country": "Deutschland",
    }
    # Nicht persistiert, aber für die Nummernvergabe lesbar:
    assert m.organization_type == "Kunde"
    assert "organization_type" not in d


def test_schema_nimmt_snake_case_weiter_an() -> None:
    m = CustomerCreate(name="A", customer_number="KD-0001", is_supplier=True)
    assert m.customer_number == "KD-0001" and m.is_supplier is True


def test_update_hebt_flache_anschrift_ebenfalls() -> None:
    d = CustomerUpdate(**{"city": "Neu", "isSupplier": True}).model_dump(exclude_unset=True)
    assert d == {"address": {"city": "Neu"}, "is_supplier": True}


# --- Nummernvergabe ----------------------------------------------------------

def test_leere_nummer_wird_serverseitig_gezogen() -> None:
    svc, db = _svc(customers=[], number_sequences=[])
    kunde = svc.create_customer(_CTX, CustomerCreate(**_MODAL_PAYLOAD))
    assert kunde.customer_number == "KD-0007"
    assert db.rpc_calls == [{"p_tenant_id": TENANT, "p_doc_type": "customer", "p_prefix": "KD-"}]
    gespeichert = db.tables["customers"].inserts[0]
    assert gespeichert["tenant_id"] == TENANT
    assert gespeichert["address"]["postal_code"] == "12345"
    assert "organization_type" not in gespeichert


def test_vorschau_als_nummer_wird_nicht_uebernommen_sondern_gezogen() -> None:
    # Der Kreis steht bei 12 → Vorschau KD-0012. Das Modal schickt genau die
    # Vorschau mit; der Server MUSS trotzdem atomar ziehen (zwei Nutzer!).
    svc, db = _svc(
        customers=[],
        number_sequences=[{"tenant_id": TENANT, "doc_type": "customer", "prefix": "KD-",
                           "next_value": 12, "padding": 4, "suffix": ""}],
    )
    svc.create_customer(_CTX, CustomerCreate(**{**_MODAL_PAYLOAD, "customerNumber": "KD-0012"}))
    assert len(db.rpc_calls) == 1


def test_handgeaenderte_nummer_bleibt_und_zieht_nicht() -> None:
    svc, db = _svc(customers=[], number_sequences=[])
    kunde = svc.create_customer(
        _CTX, CustomerCreate(**{**_MODAL_PAYLOAD, "customerNumber": "ALT-77"})
    )
    assert kunde.customer_number == "ALT-77"
    assert db.rpc_calls == []


def test_handgeaenderte_nummer_doppelt_ist_409() -> None:
    svc, db = _svc(
        customers=[{"id": "c9", "tenant_id": TENANT, "customer_number": "ALT-77"}],
        number_sequences=[],
    )
    with pytest.raises(BuchhaltungError) as exc:
        svc.create_customer(_CTX, CustomerCreate(**{**_MODAL_PAYLOAD, "customerNumber": "ALT-77"}))
    assert exc.value.status_code == 409
    assert db.tables["customers"].inserts == []


def test_lieferant_zieht_aus_dem_lieferantenkreis() -> None:
    svc, db = _svc(customers=[], number_sequences=[])
    payload = {**_MODAL_PAYLOAD, "isSupplier": True, "organizationType": "Lieferant"}
    kunde = svc.create_customer(_CTX, CustomerCreate(**payload))
    assert kunde.customer_number == "LF-0007"
    assert db.rpc_calls[0]["p_doc_type"] == "supplier"


def test_kundennummer_vorschau_route() -> None:
    svc, _ = _svc(number_sequences=[{"tenant_id": TENANT, "doc_type": "customer", "prefix": "K-",
                                     "next_value": 3, "padding": 3, "suffix": ""}])
    assert svc.next_customer_number_preview(_CTX) == {"customerNumber": "K-003"}


# --- Nummernkreise in Bestands-Form ------------------------------------------

def test_nummernkreise_haben_bestandsform_fuer_alle_typen() -> None:
    kreis = {"id": "s1", "tenant_id": TENANT, "doc_type": "invoice",
             "prefix": "RE-", "next_value": 42, "padding": 4, "suffix": ""}
    svc, _ = _svc(number_sequences=[kreis])
    kreise = {k["type"]: k for k in svc.list_number_sequences(_CTX)}
    assert set(kreise) >= {"Rechnung", "Angebot", "Kunde", "Lieferant", "Partner", "Interessenten"}
    assert kreise["Rechnung"]["nextFormatted"] == "RE-0042"
    assert kreise["Rechnung"]["format"] == "RE-{number:4}"
    assert kreise["Rechnung"]["id"] == "s1"
    # Ohne Zeile: der Kreis, den next_document_number anlegen wird.
    assert kreise["Kunde"] == {
        "id": None, "companyId": TENANT, "type": "Kunde", "prefix": "KD-",
        "format": "KD-{number:4}", "nextNumber": 1, "nextFormatted": "KD-0001",
        # canEdit: seit bereiche/kontenplan (0674) gibt es PATCH /number-sequences/{kreis}.
        "canEdit": True, "canDelete": False, "createdAt": None, "updatedAt": None,
    }


def test_vorschau_unbekannter_typ_ist_422() -> None:
    svc, _ = _svc()
    # „Mahnung" ist seit 0640 ein echter Kreis (MA-); unbekannt ist ein Fantasie-Label.
    with pytest.raises(BuchhaltungError) as exc:
        svc.next_number_preview(_CTX, "Frachtbrief")
    assert exc.value.status_code == 422


# --- Angebot -----------------------------------------------------------------

def test_angebot_bekommt_eine_nummer() -> None:
    svc, db = _svc(tenant_billing_profile=[], tenants=[{"id": TENANT, "currency": "DKK"}],
                   quotes=[], quote_line_items=[])
    # get_quote liest nach dem Insert zurück — dafür die eingefügte Zeile spiegeln.
    original_table = db.table

    def table(name: str) -> _Chain:  # noqa: ANN001
        t = db.tables.setdefault(name, _Table(name, []))
        if name == "quotes" and t.inserts and not t.rows:
            stempel = "2026-09-11T00:00:00Z"
            t.rows.append({**t.inserts[0], "id": "quotes-1",
                           "created_at": stempel, "updated_at": stempel})
        return original_table(name)

    db.table = table  # type: ignore[method-assign]
    try:
        svc.create_quote(_CTX, QuoteCreate(customer_id=None, items=[], currency="DKK"))
    except (BuchhaltungError, KeyError, TypeError):
        # get_quote hängt an weiteren Tabellen — hier zählt nur, was eingefügt wurde.
        pass
    eingefuegt = db.tables["quotes"].inserts[0]
    assert eingefuegt["quote_number"] == "AN-0007"
    assert eingefuegt["quote_prefix"] == "AN-"
    assert eingefuegt["quote_sequence"] == 7
    assert db.rpc_calls[0]["p_doc_type"] == "quote"
