"""Tests für owner_statements: Auszahlungsformel, Expenses-Zuordnung, Status.

Die Auszahlungsformel ist der Korrektheits-Kern und wird mit festen Beträgen
gegen erwartete Werte geprüft (Decimal/kaufmännisch). In-Memory-Fake-DB.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.owner_statements.schemas import (
    ExpenseCreate,
    StatementGenerateRequest,
    StatementUpdate,
)
from src.features.owner_statements.service import (
    OwnerStatementsService,
    StatementError,
)
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | list[dict] | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._isnull: str | None = None
        self._order: str | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict | list[dict]) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: dict | list[dict], **_k: object) -> "_Query":
        self._op = "upsert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte = (col, val)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte = (col, val)
        return self

    def is_(self, col: str, _val: str) -> "_Query":
        self._isnull = col
        return self

    def order(self, col: str, **_k: object) -> "_Query":
        self._order = col
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            col, val = self._gte
            ok = str(row.get(col)) >= val
        if ok and self._lte:
            col, val = self._lte
            ok = str(row.get(col)) <= val
        if ok and self._isnull:
            ok = row.get(self._isnull) is None
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "upsert":
            payload = self._payload
            items = payload if isinstance(payload, list) else [payload]
            for p in items:
                rows.append(dict(p))
            return _Result([dict(p) for p in items])
        if self._op == "insert":
            payload = self._payload
            new_rows = payload if isinstance(payload, list) else [payload]
            created = []
            for p in new_rows:
                row = dict(p)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-06-25T00:00:00Z")
                row.setdefault("updated_at", "2026-06-25T00:00:00Z")
                rows.append(row)
                created.append(row)
            return _Result(created)
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(selected)
        if self._order:
            selected = sorted(selected, key=lambda r: str(r.get(self._order) or ""))
        return _Result(selected)


class _RpcResult:
    def __init__(self, data: list[dict]) -> None:
        self.data = data

    def execute(self) -> "_RpcResult":
        return self


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0
        self._seqs: dict[tuple, int] = {}

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, fn: str, params: dict) -> "_RpcResult":
        # Mock der DB-Nummernkreis-Funktion next_document_number: fortlaufend,
        # je (tenant, doc_type), mit Präfix formatiert.
        key = (params.get("p_tenant_id"), params.get("p_doc_type"))
        seq = self._seqs.get(key, 0) + 1
        self._seqs[key] = seq
        prefix = params.get("p_prefix") or "RE-"
        return _RpcResult(
            [{"sequential_number": seq, "formatted_number": f"{prefix}{seq:04d}"}]
        )


def _base_tables() -> dict[str, list[dict]]:
    return {
        "tenants": [
            {"id": "t-1", "name": "Agentur GmbH", "currency": "EUR", "country": "DE"}
        ],
        "tenant_billing_profile": [
            {
                "tenant_id": "t-1",
                "tax_number": "12/345/67890",
                "vat_id": "DE123456789",
                "is_kleinunternehmer": False,
                "default_tax_rate": 19,
                "e_invoice_format": "none",
            }
        ],
        "owners": [
            {
                "id": "o-1",
                "tenant_id": "t-1",
                "name": "Max Owner",
                "email": "max@example.com",
                "default_commission_pct": 20,
                "statement_frequency": "monthly",
            }
        ],
        "owner_properties": [{"id": "op-1", "owner_id": "o-1", "property_id": "p-1"}],
        "properties": [{"id": "p-1", "tenant_id": "t-1", "title": "Villa"}],
        "reservations": [
            {
                "id": "r-1",
                "tenant_id": "t-1",
                "property_id": "p-1",
                "guest_id": "g-1",
                "channel": "booking",
                "check_in": "2026-01-05",
                "check_out": "2026-01-08",
                "status": "confirmed",
                "total_amount": 1000,
                "channel_fee": 100,
                "currency": "EUR",
            },
            {
                "id": "r-2",
                "tenant_id": "t-1",
                "property_id": "p-1",
                "guest_id": "g-2",
                "channel": "direct",
                "check_in": "2026-01-20",
                "check_out": "2026-01-22",
                "status": "completed",
                "total_amount": 500,
                "channel_fee": 0,
                "currency": "EUR",
            },
        ],
        "guests": [
            {"id": "g-1", "name": "Anna"},
            {"id": "g-2", "name": "Bert"},
        ],
        "owner_statements": [],
        "owner_expenses": [],
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> OwnerStatementsService:
    return OwnerStatementsService(service_client=_DB(tables or _base_tables()))


def _gen(svc: OwnerStatementsService, **over: object):
    req = StatementGenerateRequest(
        owner_id="o-1",
        period_from=date(2026, 1, 1),
        period_to=date(2026, 1, 31),
        reservation_statuses=["confirmed", "completed"],
        **over,
    )
    return svc.generate(_ctx(), req)


# --- Health ------------------------------------------------------------------

def test_health() -> None:
    resp = client.get("/api/v1/owner-statements/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "owner_statements", "status": "ok"}


# --- Auszahlungsformel -------------------------------------------------------

def test_totals_price_and_payout() -> None:
    # total_amount: 1000 + 500 = 1500; channel_fee: 100 + 0 = 100.
    st = _gen(_svc())
    assert st.summary.total_price == 1500.0
    assert st.summary.total_payout == 1400.0  # 1500 - 100
    assert st.summary.booking_count == 2


def test_owner_and_pm_payout_with_commission() -> None:
    # commission 20% (Owner-Default). Keine Owner-Expenses.
    # owner_payout = 1400 * 0.8 = 1120; pm_payout = 1400 - 1120 = 280.
    st = _gen(_svc())
    assert st.commission_pct == 20.0
    assert st.summary.owner_payout == 1120.0
    assert st.summary.pm_payout == 280.0


def test_commission_override_in_request() -> None:
    st = _gen(_svc(), commission_pct=10)
    # owner_payout = 1400 * 0.9 = 1260; pm = 140.
    assert st.summary.owner_payout == 1260.0
    assert st.summary.pm_payout == 140.0


def test_owner_expense_reduces_owner_payout() -> None:
    svc = _svc()
    st = _gen(svc)
    # Owner-zugeordnete Ausgabe -200 → mindert Owner-Payout VOR Provision.
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Reparatur",
            date=date(2026, 1, 10),
            owner_id="o-1",
            amount=-200,
            statement_id=st.id,
        ),
    )
    updated = svc.get(_ctx(), st.id)
    # owner_payout = (1400 - 200) * 0.8 = 960; pm = 1400 - 960 = 440.
    assert updated.summary.owner_payout == 960.0
    assert updated.summary.pm_payout == 440.0
    assert updated.summary.expenses_total == -200.0


def test_listing_expense_not_in_owner_payout_but_in_expenses_total() -> None:
    svc = _svc()
    st = _gen(svc)
    # Listing-zugeordnet (kein owner_id) → zählt in expenses_total, NICHT in Owner-Payout.
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Cleaning",
            date=date(2026, 1, 16),
            listing_id="p-1",
            amount=-100,
            statement_id=st.id,
        ),
    )
    updated = svc.get(_ctx(), st.id)
    assert updated.summary.owner_payout == 1120.0  # unverändert
    assert updated.summary.expenses_total == -100.0


def test_status_filter_excludes_cancelled() -> None:
    tables = _base_tables()
    tables["reservations"].append(
        {
            "id": "r-3",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "guest_id": None,
            "channel": "airbnb",
            "check_in": "2026-01-12",
            "check_out": "2026-01-14",
            "status": "cancelled",
            "total_amount": 9999,
            "channel_fee": 0,
            "currency": "EUR",
        }
    )
    st = _gen(_svc(tables))
    # cancelled nicht einbezogen → weiterhin 1500.
    assert st.summary.total_price == 1500.0


# --- Rental activity ---------------------------------------------------------

def test_rental_rows_and_listing_aggregation() -> None:
    st = _gen(_svc())
    assert len(st.rental_rows) == 2
    by_res = {r.reservation_id: r for r in st.rental_rows}
    assert by_res["r-1"].nights == 3
    assert by_res["r-1"].guest == "Anna"
    assert by_res["r-1"].total_payout == 900.0
    # Per listing: ein Listing, 2 Reservierungen, 5 Nächte.
    assert len(st.listing_rows) == 1
    assert st.listing_rows[0].reservations == 2
    assert st.listing_rows[0].nights == 5


# --- Status / Lifecycle ------------------------------------------------------

def test_finalize_freezes_summary() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = svc.finalize(_ctx(), st.id)
    assert fin.status == "finalized"
    # Update nach Finalisierung wird abgelehnt.
    with pytest.raises(StatementError) as exc:
        svc.update(_ctx(), st.id, StatementUpdate(commission_pct=50))
    assert exc.value.status_code == 409


def test_finalize_assigns_invoice_number_and_tax() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = svc.finalize(_ctx(), st.id)
    # Fortlaufende Nummer vergeben + Datum gesetzt.
    assert fin.header.invoice_number == "RE-0001"
    assert fin.invoice_date is not None
    # USt-pflichtig (kein Kleinunternehmer, gleiches Land) → Kategorie S, 19 %.
    assert fin.tax.category == "S"
    assert fin.tax.rate == 19.0
    assert fin.tax.tax > 0


def test_cancel_creates_storno_with_negated_amounts() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = svc.finalize(_ctx(), st.id)
    storno = svc.cancel(_ctx(), fin.id)
    # Eigene neue Nummer, eigener Beleg-Typ.
    assert storno.kind == "cancellation"
    assert storno.header.invoice_number == "ST-0001"
    assert storno.cancels_statement_id == fin.id
    # Beträge negiert.
    assert storno.summary.owner_payout == -fin.summary.owner_payout
    assert storno.summary.pm_payout == -fin.summary.pm_payout
    # Original ist jetzt storniert und nicht erneut stornierbar.
    orig = svc.get(_ctx(), fin.id)
    assert orig.status == "cancelled"
    assert orig.cancelled_by_statement_id == storno.id
    with pytest.raises(StatementError) as exc:
        svc.cancel(_ctx(), fin.id)
    assert exc.value.status_code == 409


def test_cancel_requires_finalized() -> None:
    svc = _svc()
    st = _gen(svc)  # noch draft
    with pytest.raises(StatementError) as exc:
        svc.cancel(_ctx(), st.id)
    assert exc.value.status_code == 409


def test_delete_finalized_blocked() -> None:
    svc = _svc()
    st = _gen(svc)
    svc.finalize(_ctx(), st.id)
    with pytest.raises(StatementError) as exc:
        svc.delete(_ctx(), st.id)
    assert exc.value.status_code == 409


def test_update_commission_recomputes() -> None:
    svc = _svc()
    st = _gen(svc)
    upd = svc.update(_ctx(), st.id, StatementUpdate(commission_pct=0))
    assert upd.summary.owner_payout == 1400.0
    assert upd.summary.pm_payout == 0.0


def test_get_missing_404() -> None:
    with pytest.raises(StatementError) as exc:
        _svc().get(_ctx(), "nope")
    assert exc.value.status_code == 404


def test_preview_loads_activity_without_insert() -> None:
    from src.features.owner_statements.schemas import StatementGenerateRequest

    svc = _svc()
    before = svc.list(_ctx()).total
    prev = svc.preview(
        _ctx(),
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 12, 31),
            reservation_statuses=["confirmed", "completed"],
        ),
    )
    # Nicht gespeichert (id leer, keine neue Abrechnung in der Liste).
    assert prev.id == ""
    assert svc.list(_ctx()).total == before
    # Aktivität der verknüpften Objekte ist geladen (Summen > 0).
    assert prev.summary.total_price > 0
    assert len(prev.rental_rows) > 0


def test_list_returns_generated() -> None:
    svc = _svc()
    _gen(svc)
    res = svc.list(_ctx())
    assert res.total == 1
    assert res.items[0].owner_id == "o-1"


# --- Auto-Statements ---------------------------------------------------------

def test_auto_run_generates_once_per_period() -> None:
    svc = _svc()
    first = svc.run_auto_statements(date(2026, 1, 1), date(2026, 1, 31))
    assert first.generated == 1
    assert first.owners == 1
    # Zweiter Lauf für denselben Zeitraum erzeugt NICHTS (1/Monat).
    second = svc.run_auto_statements(date(2026, 1, 1), date(2026, 1, 31))
    assert second.generated == 0


def test_auto_run_assigns_matching_expense() -> None:
    tables = _base_tables()
    tables["owner_expenses"].append(
        {
            "id": "e-1",
            "tenant_id": "t-1",
            "statement_id": None,
            "concept": "Cleaning",
            "date": "2026-01-15",
            "listing_id": "p-1",
            "owner_id": None,
            "reservation_id": None,
            "amount": -90,
            "hidden_from_owner": False,
        }
    )
    svc = _svc(tables)
    svc.run_auto_statements(date(2026, 1, 1), date(2026, 1, 31))
    # Expense wurde dem erzeugten Statement zugeordnet (Datum+Listing).
    assigned = [e for e in tables["owner_expenses"] if e.get("statement_id")]
    assert len(assigned) == 1


def test_expense_hidden_from_owner_flag_roundtrips() -> None:
    svc = _svc()
    st = _gen(svc)
    exp = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Intern",
            date=date(2026, 1, 9),
            amount=-50,
            hidden_from_owner=True,
            statement_id=st.id,
        ),
    )
    assert exp.hidden_from_owner is True


# --- Währungsumrechnung (Mehrwährung) ----------------------------------------

def test_fx_same_currency_is_one() -> None:
    from src.features.owner_statements.fx import FxService

    fx = FxService(_DB({"fx_rates": []}))
    assert fx.get_rate(date(2026, 1, 8), "EUR", "EUR") == Decimal("1")


def test_fx_uses_cache_without_http() -> None:
    # Kurs liegt im Cache → kein externer Aufruf, gecachter Wert wird geliefert.
    from src.features.owner_statements.fx import FxService

    db = _DB(
        {
            "fx_rates": [
                {
                    "rate_date": "2026-01-08",
                    "base": "EUR",
                    "quote": "SEK",
                    "rate": 11.25,
                    "source": "ECB",
                }
            ]
        }
    )
    fx = FxService(db)
    assert fx.get_rate(date(2026, 1, 8), "EUR", "SEK") == Decimal("11.25")


def _sek_owner_tables() -> dict[str, list[dict]]:
    """Owner in Schweden (SEK), eine EUR-Reservierung; Kurs im Cache."""
    t = _base_tables()
    t["owners"][0]["country"] = "SE"  # → Owner-Währung SEK
    t["owners"][0]["default_commission_pct"] = 20
    # Nur eine Reservierung, Check-out 2026-01-08, EUR.
    t["reservations"] = [
        {
            "id": "r-1",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "guest_id": "g-1",
            "channel": "booking",
            "check_in": "2026-01-05",
            "check_out": "2026-01-08",
            "status": "confirmed",
            "total_amount": 1000,
            "channel_fee": 0,
            "currency": "EUR",
        }
    ]
    t["fx_rates"] = [
        {
            "rate_date": "2026-01-08",
            "base": "EUR",
            "quote": "SEK",
            "rate": 11.0,
            "source": "ECB",
        }
    ]
    return t


def test_owner_payout_converted_to_owner_currency() -> None:
    # Auszahlung 1000 EUR, Provision 20% → Buchungssatz 800 EUR.
    # Owner-Währung SEK, Kurs 11.0 → 800 * 11 = 8800 SEK.
    st = _gen(_svc(_sek_owner_tables()))
    assert st.summary.owner_currency == "SEK"
    assert st.summary.owner_payout == 8800.0
    # Verwaltungsanteil bleibt in Quellwährung EUR: 1000 - 800 = 200.
    pm_eur = [c for c in st.summary.pm_payout_by_currency if c.currency == "EUR"]
    assert pm_eur and pm_eur[0].amount == 200.0
    # Rental-Zeile trägt Kurs + Quellbetrag.
    row = st.rental_rows[0]
    assert row.currency == "EUR"
    assert row.owner_payout == 800.0
    assert row.owner_payout_converted == 8800.0
    assert row.fx_rate == 11.0


# --- Zusatzleistungen (Upsell-Umsatz fließt in den Owner-Split) --------------


def test_addon_revenue_flows_into_owner_statement() -> None:
    # r-1 hat eine bezahlte Zusatzleistung (Frühstück, 60). Der Extra-Umsatz
    # erhöht Total Price + Auszahlung (provisionsfrei verkauft → keine
    # channel_fee darauf), fließt aber in den Provisions-Split.
    tables = _base_tables()
    tables["reservation_addons"] = [
        {
            "id": "ra-1",
            "tenant_id": "t-1",
            "reservation_id": "r-1",
            "total": 60,
            "status": "paid",
        }
    ]
    st = _gen(_svc(tables))
    # Total Price: 1000 + 60 (Addon) + 500 = 1560.
    assert st.summary.total_price == 1560.0
    # Total Payout: 1560 - 100 (channel_fee nur auf Miete) = 1460.
    assert st.summary.total_payout == 1460.0
    # Owner-Payout 20% Provision: 1460 * 0.8 = 1168.
    assert st.summary.owner_payout == 1168.0


def test_cancelled_addon_excluded_from_statement() -> None:
    # Stornierte Zusatzleistung zählt NICHT als Umsatz.
    tables = _base_tables()
    tables["reservation_addons"] = [
        {
            "id": "ra-x",
            "tenant_id": "t-1",
            "reservation_id": "r-1",
            "total": 60,
            "status": "cancelled",
        }
    ]
    st = _gen(_svc(tables))
    assert st.summary.total_price == 1500.0  # unverändert (Addon ignoriert)
