"""Tests für owner_statements: Auszahlungsformel, Expenses-Zuordnung, Status.

Die Auszahlungsformel ist der Korrektheits-Kern und wird mit festen Beträgen
gegen erwartete Werte geprüft (Decimal/kaufmännisch). In-Memory-Fake-DB.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from src.core.security import AuthContext
from src.features.owner_statements.schemas import (
    ExpenseCreate,
    ExpenseDirection,
    ExpenseUpdate,
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
        self._range: tuple[int, int] | None = None

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

    def range(self, start: int, end: int) -> "_Query":
        # PostgREST-range ist inklusiv [start, end]; fetch_all_rows paginiert damit.
        self._range = (start, end)
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
        if self._range is not None:
            start, end = self._range
            selected = selected[start : end + 1]  # PostgREST-range inklusiv
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
        # Der anfragende Nutzer MUSS als Zeile da sein: `load_guest_mask` liest
        # Rolle und Berechtigungen aus der DB (Quelle der Wahrheit, Wurzel 7),
        # nicht aus dem JWT. Ohne die Zeile maskiert die Maske fail-closed, und
        # ein Admin bekäme in diesen Tests weder Gastpreis noch Verwaltungs-
        # Auszahlung zu sehen — richtig, aber nicht der hier geprüfte Fall.
        "users": [{"id": "u-1", "role": "admin", "permissions": []}],
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
                "is_owner_stay": False,
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
                "is_owner_stay": False,
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


def test_fehlende_provision_ist_kein_null_prozent() -> None:
    """Ohne vereinbarten Satz gibt es KEINE Auszahlungszahl — auch keine 0.

    Der live reproduzierte Fehler (AirSmil, 09.08.2026): `owners.
    default_commission_pct` war `not null default 0`, ein nie ausgefüllter
    Satz kam deshalb als 0 % durch. Die Abrechnung wies die volle
    Auszahlung dem Eigentümer zu (32.120,45 DKK) und der Verwaltung 0,00 —
    eine Falschaussage über Geld, die plausibel aussah.

    Erwartet: owner_payout/pm_payout/commission_pct sind `None` und der
    Grund steht maschinenlesbar dabei, damit die UI sagen kann, WAS fehlt.
    """
    svc = _svc()
    # Weder Objekt-Override noch Owner-Default: der Satz ist unbekannt.
    svc._db.tables["owners"][0]["default_commission_pct"] = None  # noqa: SLF001
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["commission_override_pct"] = None
    st = _gen(svc)

    assert st.summary.owner_payout is None
    assert st.summary.pm_payout is None
    assert st.commission_pct is None
    assert st.summary.payout_unbekannt == "provision"
    # Die Buchungen selbst bleiben sichtbar — nur die Auszahlung fehlt.
    assert st.summary.total_payout == 1400.0
    assert st.summary.booking_count == 2
    assert all(r.owner_payout is None for r in st.rental_rows)
    assert all(r.payout_unbekannt == "provision" for r in st.rental_rows)


def test_manueller_override_sticht_fehlenden_stammsatz() -> None:
    """Fehlt der Stammsatz, rettet ein ausdrücklicher Override die Abrechnung.

    Sonst wäre der fehlende Stammdatensatz eine Sackgasse: der Betreiber
    könnte nicht einmal mit einem bewusst eingegebenen Satz abrechnen.
    """
    svc = _svc()
    svc._db.tables["owners"][0]["default_commission_pct"] = None  # noqa: SLF001
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["commission_override_pct"] = None
    st = _gen(svc, commission_pct=10)

    assert st.summary.owner_payout == 1260.0
    assert st.summary.pm_payout == 140.0
    assert st.summary.payout_unbekannt is None


def test_verrechnungsposten_zulasten_wird_voll_abgezogen() -> None:
    """„Glühbirnen für 200 gekauft" → GENAU 200 weniger, nicht 160.

    Der Kern des bis 09.08.2026 bestehenden Fehlers: der Posten wurde mit
    `× (100 − eff)/100` gekürzt, also wie Umsatz provisioniert. Bei 20 %
    Provision landete der Betrieb bei 160 statt 200.
    """
    svc = _svc()
    st = _gen(svc)
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Glühbirnen",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner,
            owner_id="o-1",
            amount=200,
            statement_id=st.id,
        ),
    )
    updated = svc.get(_ctx(), st.id)
    # owner_payout = 1120 (Buchungssätze) − 200 (voll) = 920. Der alte,
    # falsche Weg hätte 1120 − 160 = 960 ergeben.
    assert updated.summary.owner_payout == 920.0
    assert updated.summary.pm_payout == 480.0
    assert updated.summary.expenses_total == -200.0
    assert updated.summary.expenses_from_owner == 200.0
    assert updated.summary.expenses_to_owner == 0.0


def test_verrechnungsposten_zugunsten_erhoeht_auszahlung_voll() -> None:
    """Schadenskompensation 300 → GENAU 300 mehr, ungekürzt."""
    svc = _svc()
    st = _gen(svc)
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Schadenskompensation",
            date=date(2026, 1, 11),
            direction=ExpenseDirection.to_owner,
            owner_id="o-1",
            amount=300,
            statement_id=st.id,
        ),
    )
    updated = svc.get(_ctx(), st.id)
    assert updated.summary.owner_payout == 1420.0  # 1120 + 300
    assert updated.summary.expenses_total == 300.0
    assert updated.summary.expenses_to_owner == 300.0
    assert updated.summary.expenses_from_owner == 0.0


def test_beide_richtungen_getrennt_ausgewiesen() -> None:
    """Netto-Null verbirgt nicht, dass zwei Posten gegeneinander stehen."""
    svc = _svc()
    st = _gen(svc)
    for richtung, betrag, text in (
        (ExpenseDirection.to_owner, 500, "Kompensation"),
        (ExpenseDirection.from_owner, 500, "Material"),
    ):
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                concept=text,
                date=date(2026, 1, 12),
                direction=richtung,
                owner_id="o-1",
                amount=betrag,
                statement_id=st.id,
            ),
        )
    s = svc.get(_ctx(), st.id).summary
    assert s.expenses_total == 0.0
    assert s.expenses_to_owner == 500.0
    assert s.expenses_from_owner == 500.0
    assert s.owner_payout == 1120.0  # unverändert, weil sie sich aufheben


def test_listing_expense_not_in_owner_payout_but_in_expenses_total() -> None:
    svc = _svc()
    st = _gen(svc)
    # Listing-zugeordnet (kein owner_id) → zählt in expenses_total, NICHT in Owner-Payout.
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Cleaning",
            date=date(2026, 1, 16),
            direction=ExpenseDirection.from_owner,
            listing_id="p-1",
            amount=100,
            statement_id=st.id,
        ),
    )
    updated = svc.get(_ctx(), st.id)
    assert updated.summary.owner_payout == 1120.0  # unverändert
    assert updated.summary.expenses_total == -100.0


def test_fremder_posten_zaehlt_nicht_mit() -> None:
    """Posten eines FREMDEN Tenants dürfen die Summe nicht verändern.

    `_expenses_for_statement` filterte nur über `statement_id` — der Scope hing
    allein daran, dass jeder Aufrufer die Abrechnung vorher selbst gescopet
    hatte. Die Service-Role umgeht RLS, deshalb wird hier explizit gescopet
    (Wurzel 3: Load und Scope nicht trennen).
    """
    tables = _base_tables()
    svc = _svc(tables)
    st = _gen(svc)
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Eigener Posten",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner,
            owner_id="o-1",
            amount=100,
            statement_id=st.id,
        ),
    )
    # Fremde Zeile mit DERSELBEN statement_id, aber anderem Tenant.
    tables["owner_expenses"].append(
        {
            "id": "fremd-1",
            "tenant_id": "t-fremd",
            "statement_id": st.id,
            "concept": "Fremder Posten",
            "date": "2026-01-11",
            "direction": "from_owner",
            "owner_id": "o-1",
            "amount": 9999,
            "currency": "EUR",
            "hidden_from_owner": False,
        }
    )
    geladen = svc.get(_ctx(), st.id)
    konzepte = [e.concept for e in geladen.expenses]
    assert "Fremder Posten" not in konzepte
    assert geladen.summary.expenses_total == -100.0


def test_betrag_muss_positiv_sein() -> None:
    """Die Richtung steht in `direction`; ein negativer Betrag ist ein
    Eingabefehler und keine zweite Ausdrucksform derselben Sache."""
    for ungueltig in (-200, 0):
        with pytest.raises(PydanticValidationError):
            ExpenseCreate(
                concept="X",
                date=date(2026, 1, 10),
                direction=ExpenseDirection.from_owner,
                amount=ungueltig,
            )


def test_richtung_ist_pflicht() -> None:
    """Ohne Richtung ist der Posten nicht interpretierbar → 422 statt Raten."""
    with pytest.raises(PydanticValidationError):
        ExpenseCreate(concept="X", date=date(2026, 1, 10), amount=200)


def test_waehrung_kommt_vom_objekt_nicht_vom_betrieb() -> None:
    """Der Betrieb rechnet in EUR, das Objekt in DKK → der Posten ist DKK.

    Ohne diese Reihenfolge würde ein dänisches Objekt still in EUR verrechnet
    und der Betrag um den Wechselkurs verschoben, ohne dass es auffiele.
    """
    tables = _base_tables()
    tables["properties"][0]["currency"] = "DKK"
    svc = _svc(tables)
    exp = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Glühbirnen",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner,
            listing_id="p-1",
            amount=200,
        ),
    )
    assert exp.currency == "DKK"


def test_posten_in_fremder_waehrung_wird_nicht_stumm_addiert() -> None:
    """Ein DKK-Posten darf NICHT in eine EUR-Abrechnung eingerechnet werden.

    Genau das tat der Code bis 09.08.2026: `owner_payout` steht in der Währung
    des Eigentümers (die Buchungssätze sind dorthin umgerechnet), die Posten
    flossen aber roh und ohne Umrechnung hinein. 200 DKK wurden damit wie 200
    EUR abgezogen — rund 27 EUR zu viel, an einer Zahl, die plausibel aussieht.
    Umgerechnet wird bewusst NICHT (ein Kurs zum Erfassungstag wäre eine
    erfundene Zahl in einem Beleg): 422 statt still falsch (Wurzel 4).
    """
    tables = _base_tables()
    tables["properties"][0]["currency"] = "DKK"
    svc = _svc(tables)
    st = _gen(svc)
    with pytest.raises(StatementError) as exc:
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                concept="Glühbirnen",
                date=date(2026, 1, 10),
                direction=ExpenseDirection.from_owner,
                listing_id="p-1",
                amount=200,
                statement_id=st.id,
            ),
        )
    assert exc.value.status_code == 422
    assert "DKK" in exc.value.message


def test_waehrung_faellt_auf_den_betrieb_zurueck_ohne_objekt() -> None:
    """Ohne Objektbezug gilt die Währung des Betriebs — aus den Daten, nicht
    aus einer Konstante."""
    svc = _svc()
    st = _gen(svc)
    exp = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Kompensation",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.to_owner,
            owner_id="o-1",
            amount=200,
            statement_id=st.id,
        ),
    )
    assert exp.currency == "EUR"  # tenants.currency in den Testdaten


def test_ohne_waehrung_irgendwo_klarer_fehler_statt_euro() -> None:
    """Weder Posten noch Objekt noch Betrieb tragen eine Währung → 422.
    NIE ein untergeschobenes „EUR" (Wurzel 4)."""
    tables = _base_tables()
    tables["tenants"][0]["currency"] = None
    svc = _svc(tables)
    with pytest.raises(StatementError) as exc:
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                concept="Material",
                date=date(2026, 1, 10),
                direction=ExpenseDirection.from_owner,
                amount=200,
            ),
        )
    assert exc.value.status_code == 422


def test_abzug_darf_nicht_ausgeblendet_werden() -> None:
    """Ein Posten ZULASTEN muss für den Eigentümer sichtbar bleiben — sonst
    sähe er eine geminderte Auszahlung ohne die mindernde Zeile."""
    svc = _svc()
    st = _gen(svc)
    with pytest.raises(StatementError) as exc:
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                concept="Heimlicher Abzug",
                date=date(2026, 1, 10),
                direction=ExpenseDirection.from_owner,
                owner_id="o-1",
                amount=200,
                hidden_from_owner=True,
                statement_id=st.id,
            ),
        )
    assert exc.value.status_code == 422


def test_abzug_nicht_per_update_verstecken() -> None:
    """Die Regel greift am ERGEBNIS: erst zugunsten+versteckt anlegen, dann auf
    zulasten drehen, wäre sonst der Weg an ihr vorbei."""
    svc = _svc()
    st = _gen(svc)
    exp = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Gutschrift",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.to_owner,
            owner_id="o-1",
            amount=200,
            hidden_from_owner=True,
            statement_id=st.id,
        ),
    )
    with pytest.raises(StatementError) as exc:
        svc.update_expense(
            _ctx(), exp.id, ExpenseUpdate(direction=ExpenseDirection.from_owner)
        )
    assert exc.value.status_code == 422


def test_erfasser_wird_mitgeschrieben() -> None:
    """Nachvollziehbarkeit: wer hat den Posten angelegt."""
    svc = _svc()
    st = _gen(svc)
    exp = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Material",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner,
            owner_id="o-1",
            amount=200,
            statement_id=st.id,
        ),
    )
    assert exp.created_by == "u-1"
    assert exp.created_at is not None


def test_signed_amount_traegt_das_vorzeichen() -> None:
    """Das Vorzeichen entsteht an EINER Stelle und steht im Antwortmodell —
    keine Anzeigestelle rechnet es selbst aus."""
    svc = _svc()
    st = _gen(svc)
    zulasten = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Material", date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner, amount=200, statement_id=st.id,
        ),
    )
    zugunsten = svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Kompensation", date=date(2026, 1, 10),
            direction=ExpenseDirection.to_owner, amount=300, statement_id=st.id,
        ),
    )
    assert (zulasten.amount, zulasten.signed_amount) == (200.0, -200.0)
    assert (zugunsten.amount, zugunsten.signed_amount) == (300.0, 300.0)


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
            "is_owner_stay": False,
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


def _mit_beiden_richtungen(svc: OwnerStatementsService):
    """Statement mit je einem Posten pro Richtung (500 zugunsten / 200 zulasten)."""
    st = _gen(svc)
    for richtung, betrag, text in (
        (ExpenseDirection.to_owner, 500, "Schadenskompensation"),
        (ExpenseDirection.from_owner, 200, "Glühbirnen"),
    ):
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                concept=text,
                date=date(2026, 1, 12),
                direction=richtung,
                owner_id="o-1",
                amount=betrag,
                statement_id=st.id,
            ),
        )
    return st


def test_richtungssummen_ueberleben_die_finalisierung() -> None:
    """Regression: der Snapshot-Pfad meldete beide Richtungen als 0.

    `get()` baut die Summary für alles ausser Entwürfen aus der GESPEICHERTEN
    Zeile neu auf. Bis 0348 setzte er dort nur `expenses_total`; die beiden
    Richtungsfelder fielen auf ihren Pydantic-Default 0.0 zurück. Damit meldete
    ausgerechnet die finalisierte Abrechnung — das Dokument, das der Eigentümer
    wirklich bekommt — „keine Verrechnungsposten", obwohl 500 und 200 darauf
    stehen. Der Entwurf davor zeigte sie korrekt, was den Fehler unsichtbar
    machte.
    """
    svc = _svc()
    st = _mit_beiden_richtungen(svc)

    # Entwurf: live gerechnet, war auch vorher korrekt.
    entwurf = svc.get(_ctx(), st.id).summary
    assert (entwurf.expenses_to_owner, entwurf.expenses_from_owner) == (500.0, 200.0)

    fin = svc.finalize(_ctx(), st.id).summary
    # DAS ist der Kern: dieselben Zahlen aus dem Snapshot, nicht 0.
    assert fin.expenses_to_owner == 500.0
    assert fin.expenses_from_owner == 200.0
    # Netto bleibt konsistent zu den beiden Bestandteilen.
    assert fin.expenses_total == 300.0
    assert fin.expenses_total == fin.expenses_to_owner - fin.expenses_from_owner

    # Erneutes Lesen geht über denselben Snapshot-Pfad und darf nicht kippen.
    erneut = svc.get(_ctx(), st.id).summary
    assert (erneut.expenses_to_owner, erneut.expenses_from_owner) == (500.0, 200.0)


def test_richtungssummen_im_storno_gespiegelt() -> None:
    """Die Gegenbuchung dreht BEIDE Richtungen mit, nicht nur die Nettozahl.

    Ein Storno mit −300 netto, aber 0/0 in den Richtungen behauptete, es habe
    nie Verrechnungsposten gegeben (Wurzel 4).
    """
    svc = _svc()
    st = _mit_beiden_richtungen(svc)
    fin = svc.finalize(_ctx(), st.id)
    storno = svc.cancel(_ctx(), fin.id).summary

    assert storno.expenses_to_owner == -fin.summary.expenses_to_owner == -500.0
    assert storno.expenses_from_owner == -fin.summary.expenses_from_owner == -200.0
    assert storno.expenses_total == -fin.summary.expenses_total == -300.0
    # Auch im Storno bleibt die Netto-Zahl die Differenz ihrer Bestandteile.
    assert (
        storno.expenses_total
        == storno.expenses_to_owner - storno.expenses_from_owner
    )

    # Das stornierte Original läuft ebenfalls über den Snapshot-Pfad.
    orig = svc.get(_ctx(), fin.id).summary
    assert (orig.expenses_to_owner, orig.expenses_from_owner) == (500.0, 200.0)


def test_snapshot_summary_setzt_jedes_feld() -> None:
    """Kein Feld der Summary fällt auf dem Snapshot-Pfad auf einen Default.

    Die eigentliche Fehlerklasse: ein weggelassenes Pydantic-Feld liefert still
    eine plausible 0 bzw. eine leere Liste. Dieser Test hält den Snapshot-Pfad
    darauf fest, dass er JEDES Feld aus der gespeicherten Zeile bedient.
    """
    svc = _svc()
    st = _mit_beiden_richtungen(svc)
    fin = svc.finalize(_ctx(), st.id).summary

    # Die Aufschlüsselungen je Währung waren die zweite stille Leerstelle.
    assert [(c.currency, c.amount) for c in fin.totals_by_currency] == [
        (fin.owner_currency, fin.total_payout)
    ]
    assert [(c.currency, c.amount) for c in fin.pm_payout_by_currency] == [
        (fin.owner_currency, fin.pm_payout)
    ]
    # Kein Feld des Modells ist unbesetzt geblieben.
    assert set(fin.model_fields_set) == set(type(fin).model_fields)


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


def test_auto_run_ueberspringt_jahres_eigentuemer_im_monatslauf() -> None:
    """Ein Eigentümer mit Jahresrhythmus darf beim Monatslauf NICHTS bekommen —
    sonst hätte er zwölf „Jahresberichte" statt einem (0331)."""
    tables = _base_tables()
    tables["owners"][0]["statement_frequency"] = "yearly"
    svc = _svc(tables)
    assert svc.run_auto_statements(date(2026, 1, 1), date(2026, 1, 31)).generated == 0


def test_auto_run_erzeugt_jahresbericht() -> None:
    """Der Jahreslauf (Zeitraum > 1 Monat) bedient genau die yearly-Owner."""
    tables = _base_tables()
    tables["owners"][0]["statement_frequency"] = "yearly"
    svc = _svc(tables)
    lauf = svc.run_auto_statements(date(2026, 1, 1), date(2026, 12, 31))
    assert lauf.generated == 1
    # Und ein zweiter Lauf desselben Jahres erzeugt nichts (Wurzel 2).
    assert svc.run_auto_statements(date(2026, 1, 1), date(2026, 12, 31)).generated == 0


def test_auto_run_ueberspringt_monats_eigentuemer_im_jahreslauf() -> None:
    """Umgekehrt: der Monats-Owner bekommt im Jahreslauf keinen zweiten,
    überlappenden Beleg."""
    svc = _svc()  # Fixture steht auf 'monthly'
    assert svc.run_auto_statements(date(2026, 1, 1), date(2026, 12, 31)).generated == 0


def test_rhythmus_leitet_sich_aus_dem_zeitraum_ab() -> None:
    frequenz = OwnerStatementsService._rhythmus_fuer_zeitraum  # noqa: SLF001
    assert frequenz(date(2026, 2, 1), date(2026, 2, 28)) == "monthly"
    assert frequenz(date(2026, 1, 1), date(2026, 1, 31)) == "monthly"
    assert frequenz(date(2026, 1, 1), date(2026, 12, 31)) == "yearly"


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
            # Nur ein Posten ZUGUNSTEN darf ausgeblendet werden — ein Abzug
            # nicht (test_abzug_darf_nicht_ausgeblendet_werden).
            direction=ExpenseDirection.to_owner,
            amount=50,
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
            "is_owner_stay": False,
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


# --- Owner-Scope (§4.2): Eigentümer sieht nur SICH, read-only -----------------

def _owner_ctx(user: str = "u-owner-a") -> AuthContext:
    return AuthContext(user_id=user, tenant_id="t-1", role="owner")


def _two_owner_tables() -> dict[str, list[dict]]:
    tables = _base_tables()
    # Die Eigentümer-Logins als echte users-Zeilen: `load_guest_mask` holt
    # Rolle + Berechtigungen aus der DB. Ein Owner hat KEIN pm_booking_total,
    # bekommt also mask.amounts=False — genau der Fall, den der Daten-Split
    # §4.2 beschreibt.
    tables["users"].extend(
        [
            {"id": "u-owner-a", "role": "owner", "permissions": []},
            {"id": "u-owner-b", "role": "owner", "permissions": []},
        ]
    )
    tables["owners"][0]["user_id"] = "u-owner-a"  # o-1 ↔ Owner A
    tables["owners"].append(
        {
            "id": "o-2", "tenant_id": "t-1", "name": "Berta Owner",
            "default_commission_pct": 20, "statement_frequency": "monthly",
            "user_id": "u-owner-b",
        }
    )
    return tables


def _foreign_statement(tables: dict[str, list[dict]]) -> dict:
    """Fertige Statement-Zeile von Owner B (o-2) direkt einlegen."""
    row = {
        "id": "st-fremd", "tenant_id": "t-1", "owner_id": "o-2",
        "owner_name": "Berta Owner", "period_from": "2026-01-01",
        "period_to": "2026-01-31", "status": "draft", "owner_payout": 999,
        "pm_payout": 111, "currency": "EUR", "invoice_number": None,
        "created_at": "2026-02-01T00:00:00Z", "basis": "check_in",
        "reservation_statuses": ["confirmed"], "commission_pct": 20,
    }
    tables["owner_statements"].append(row)
    return row


def test_owner_list_scoped_to_self() -> None:
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    _gen(svc)                       # eigenes Statement (o-1, Agentur legt an)
    _foreign_statement(tables)      # fremdes Statement (o-2)

    res = svc.list(_owner_ctx())
    assert res.total == 1
    assert {i.owner_id for i in res.items} == {"o-1"}

    # Ein client-übergebener fremder owner_id-Filter wird überschrieben.
    res_filtered = svc.list(_owner_ctx(), owner_id="o-2")
    assert {i.owner_id for i in res_filtered.items} == {"o-1"}


def test_owner_get_foreign_statement_404() -> None:
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    row = _foreign_statement(tables)
    with pytest.raises(StatementError) as exc:
        svc.get(_owner_ctx(), row["id"])
    assert exc.value.status_code == 404


def test_owner_without_link_sees_nothing() -> None:
    # Owner-Rolle ohne owners.user_id-Verknüpfung → fail-closed (404).
    svc = OwnerStatementsService(service_client=_DB(_two_owner_tables()))
    with pytest.raises(StatementError) as exc:
        svc.list(_owner_ctx(user="u-unverknuepft"))
    assert exc.value.status_code == 404


def test_owner_writes_forbidden() -> None:
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    own = _gen(svc)  # eigenes Statement von o-1

    req = StatementGenerateRequest(
        owner_id="o-1", period_from=date(2026, 1, 1), period_to=date(2026, 1, 31),
    )
    with pytest.raises(StatementError) as exc:
        svc.generate(_owner_ctx(), req)
    assert exc.value.status_code == 403

    for call in (
        lambda: svc.update(_owner_ctx(), own.id, StatementUpdate(commission_pct=5)),
        lambda: svc.finalize(_owner_ctx(), own.id),
        lambda: svc.cancel(_owner_ctx(), own.id),
        lambda: svc.delete(_owner_ctx(), own.id),
        lambda: svc.add_expense(
            _owner_ctx(),
            ExpenseCreate(
                concept="X", amount=1, date=date(2026, 1, 2), owner_id="o-1",
                direction=ExpenseDirection.from_owner,
            ),
        ),
    ):
        with pytest.raises(StatementError) as write_exc:
            call()
        assert write_exc.value.status_code == 403


def test_owner_preview_only_self() -> None:
    svc = OwnerStatementsService(service_client=_DB(_two_owner_tables()))
    fremd = StatementGenerateRequest(
        owner_id="o-2", period_from=date(2026, 1, 1), period_to=date(2026, 1, 31),
    )
    with pytest.raises(StatementError) as exc:
        svc.preview(_owner_ctx(), fremd)
    assert exc.value.status_code == 404

    eigen = StatementGenerateRequest(
        owner_id="o-1", period_from=date(2026, 1, 1), period_to=date(2026, 1, 31),
    )
    resp = svc.preview(_owner_ctx(), eigen)
    assert resp.owner_id == "o-1"


# --- hidden_from_owner: Owner sieht versteckte Ausgaben weder gelistet noch in Summe --

def test_visible_expenses_filters_for_owner_only() -> None:
    svc = _svc()
    exps = [
        {"id": "e1", "amount": "100", "hidden_from_owner": False},
        {"id": "e2", "amount": "50", "hidden_from_owner": True},
    ]
    from src.core.security import AuthContext

    admin = AuthContext(user_id="a", tenant_id="t-1", role="admin")
    owner = AuthContext(user_id="o", tenant_id="t-1", role="owner")
    # Admin sieht beide, Owner nur die sichtbare.
    assert len(svc._visible_expenses(admin, exps)) == 2
    owner_view = svc._visible_expenses(owner, exps)
    assert [e["id"] for e in owner_view] == ["e1"]


# --- Daten-Split: Gast-Bruttopreis und Verwaltungs-Ertrag (Befund 4) ---------

def test_owner_sieht_weder_gastpreis_noch_verwaltungsanteil() -> None:
    """BEFUND 4 — beides stand im PDF, das der Eigentümer selbst herunterlädt.

    `_rental_rows` maskierte den GASTNAMEN korrekt, reichte aber
    `total_price` (den Gast-Bruttopreis) eine Zeile später ungefiltert durch;
    `statement-pdf.ts` rendert ihn als Spalte „Gesamtpreis". Zusätzlich stand
    dort `pm_payout` — die Auszahlung der AGENTUR.

    Erwartung: Der Eigentümer sieht seine Auszahlung, sonst nichts davon.
    """
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    eigen = _gen(svc)  # von der Agentur erzeugt (admin)

    sicht = svc.get(_owner_ctx(), eigen.id)
    # Sein Geld sieht er.
    assert sicht.summary.owner_payout == eigen.summary.owner_payout
    assert sicht.summary.owner_payout > 0
    # Der Gastpreis und der Agentur-Ertrag NICHT — und zwar als None, nicht 0.
    assert sicht.summary.total_price is None
    assert sicht.summary.pm_payout is None
    assert sicht.summary.pm_payout_by_currency == []
    assert all(r.total_price is None for r in sicht.rental_rows)
    assert all(r.total_price is None for r in sicht.listing_rows)
    # Auch der Gastname bleibt auf den Vornamen gekürzt (bestehende Regel).
    assert all(
        r.guest is None or " " not in r.guest for r in sicht.rental_rows
    )


def test_agentur_sieht_gastpreis_und_verwaltungsanteil_weiter() -> None:
    """Die Gegenprobe: Für die Agentur (admin) bleibt beides sichtbar — die
    Maskierung darf nicht die Abrechnung selbst unbrauchbar machen."""
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    eigen = _gen(svc)
    sicht = svc.get(_ctx(), eigen.id)
    assert sicht.summary.total_price is not None
    assert sicht.summary.pm_payout is not None
    assert all(r.total_price is not None for r in sicht.rental_rows)


def test_owner_liste_ohne_verwaltungsanteil() -> None:
    """Wurzel 9 — derselbe Scope im LIST-Pfad: was das Detail verbirgt, darf
    die Liste nicht ausliefern."""
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    _gen(svc)
    res = svc.list(_owner_ctx())
    assert res.total == 1
    assert res.items[0].owner_payout > 0
    assert res.items[0].pm_payout is None
    # Die Agentur bekommt ihn weiterhin.
    assert svc.list(_ctx()).items[0].pm_payout is not None
