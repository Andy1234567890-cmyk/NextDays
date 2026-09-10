"""Tests für owner_statements: Auszahlungsformel, Expenses-Zuordnung, Status.

Die Auszahlungsformel ist der Korrektheits-Kern und wird mit festen Beträgen
gegen erwartete Werte geprüft (Decimal/kaufmännisch). In-Memory-Fake-DB.
"""
import fnmatch
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from src.core.security import AuthContext
from src.features.owner_statements.schemas import (
    ColumnKey,
    ExpenseCreate,
    ExpenseDirection,
    ExpenseUpdate,
    StatementFinalizeRequest,
    StatementGenerateRequest,
    StatementHeader,
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
        self._neq: list[tuple[str, object]] = []
        # MEHRERE `in_`-Filter, wie PostgREST sie kann. Bis 07.09.2026 war das
        # ein einzelner Slot: `_reservations` filtert erst `property_id`, dann
        # `status` — der zweite Aufruf überschrieb den ersten, und die Attrappe
        # lieferte Buchungen ALLER Objekte. Es fiel nie auf, weil die
        # Basistabellen nur ein Objekt hatten (0603 brachte das zweite).
        self._in: list[tuple[str, list]] = []
        self._gte: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._gt: tuple[str, str] | None = None
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

    def neq(self, col: str, val: object) -> "_Query":
        """PostgREST `neq` — „alles AUSSER diesem Wert".

        Nachgezogen am 07.09.2026: die Miteigentümer-Abfrage (0601) sucht die
        ANDEREN Eigentümer eines Objekts und braucht dafür `neq`. Ohne diese
        Methode wirft die Fake-DB `AttributeError` — was hier der glückliche
        Fall ist, denn eine Fake-DB, die unbekannte Aufrufe stillschweigend
        durchlässt, bestätigt jeden Tippfehler (MEMORY
        „live-e2e-findet-was-pytest-nicht").
        """
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in.append((col, vals))
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte = (col, val)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte = (col, val)
        return self

    def gt(self, col: str, val: str) -> "_Query":
        self._gt = (col, val)
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

    def like(self, col: str, pattern: str) -> "_Query":
        # PostgREST `like` mit `%`-Platzhalter — hier als Muster-Filter.
        self._like = (col, pattern)
        return self

    def _match(self, row: dict) -> bool:
        muster = getattr(self, "_like", None)
        if muster is not None:
            like_col, like_pat = muster
            if not fnmatch.fnmatchcase(
                str(row.get(like_col) or ""), like_pat.replace("%", "*")
            ):
                return False
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters) and all(
            str(row.get(c)) != str(v) for c, v in self._neq
        )
        if ok and self._in:
            ok = all(
                str(row.get(col)) in {str(v) for v in vals}
                for col, vals in self._in
            )
        if ok and self._gte:
            col, val = self._gte
            ok = str(row.get(col)) >= val
        if ok and self._lte:
            col, val = self._lte
            ok = str(row.get(col)) <= val
        if ok and self._gt:
            col, val = self._gt
            ok = str(row.get(col)) > val
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
                # DB-Vorgabe nachbilden: `owner_statements.kind` ist
                # `not null default 'invoice'` (0065). Ohne diese Zeile trüge
                # die Fake-Zeile `kind=None`, und ein Filter auf `kind` fände
                # sie nicht — ein Fehler, den es real gar nicht geben kann.
                if self._table == "owner_statements":
                    row.setdefault("kind", "invoice")
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
        # Wiederkehrende Posten (0365): leer, einzelne Tests befüllen sie.
        "owner_recurring_items": [],
        "reservation_addons": [],
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


def _finalize(svc: OwnerStatementsService, statement_id: str, ctx=None):
    """Festschreiben mit gültiger Doppelbestätigung — wie die Oberfläche es tut.

    Die Bestätigung ist der aktuelle Stand, den der Nutzer im Dialog gesehen
    hätte. Tests, die gerade die ABWEICHUNG prüfen, rufen `svc.finalize`
    direkt auf."""
    c = ctx if ctx is not None else _ctx()
    stand = svc.get(c, statement_id)
    return svc.finalize(
        c,
        statement_id,
        StatementFinalizeRequest(
            bestaetigte_auszahlung=stand.summary.owner_payout,
            bestaetigte_waehrung=stand.summary.owner_currency
            or stand.summary.currency,
        ),
    )


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


def test_rental_row_nennt_die_herkunft_der_gebuehren() -> None:
    """Jede Zeile sagt, WOHER ihre Gebühren kommen.

    Die häufigste Rückfrage der Buchhaltung ist „warum steht bei dieser Buchung
    keine Reinigung?". Am 11.08.2026 kostete sie einen halben Tag Suche — beim
    Channex-Mapping, beim Tax Set, im eigenen Rechencode — und die Antwort lag
    im Eingangsweg der Buchung: ein Channex-Import liefert laut Channex-Doku
    „not include extras and cleaning fees". Ohne diese Angabe an der Zeile sieht
    eine fehlende Gebühr wie ein Rechenfehler aus.

    Die Testbuchungen haben keinen Channex-Payload (Direktbuchungen), also gilt
    `stammdaten` — dort sind die Objekt-Gebühren die richtige Quelle.
    """
    st = _gen(_svc())
    for zeile in st.rental_rows:
        assert zeile.gebuehren_quelle == "stammdaten"
        # `grund` gibt es nur bei `ota_ohne_aufstellung` — eine Direktbuchung
        # braucht keine Erklärung, warum das Portal nichts geliefert hat.
        assert zeile.gebuehren_grund is None


# --- Status / Lifecycle ------------------------------------------------------

def test_finalize_freezes_summary() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = _finalize(svc, st.id)
    assert fin.status == "finalized"
    # Update nach Finalisierung wird abgelehnt.
    with pytest.raises(StatementError) as exc:
        svc.update(_ctx(), st.id, StatementUpdate(commission_pct=50))
    assert exc.value.status_code == 409


def test_finalize_assigns_invoice_number_and_tax() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = _finalize(svc, st.id)
    # Fortlaufende Nummer vergeben + Datum gesetzt.
    assert fin.header.invoice_number == "EA-0001"
    assert fin.invoice_date is not None
    # USt-pflichtig (kein Kleinunternehmer, gleiches Land) → Kategorie S, 19 %.
    assert fin.tax.category == "S"
    assert fin.tax.rate == 19.0
    assert fin.tax.tax > 0


def test_cancel_creates_storno_with_negated_amounts() -> None:
    svc = _svc()
    st = _gen(svc)
    fin = _finalize(svc, st.id)
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

    fin = _finalize(svc, st.id).summary
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
    fin = _finalize(svc, st.id)
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
    fin = _finalize(svc, st.id).summary

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
    _finalize(svc, st.id)
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
    # Festgeschrieben, weil der Eigentümer nur fertige Belege sieht (Entwürfe
    # und Storni bleiben Werkstatt der Agentur).
    _finalize(svc, _gen(svc).id)    # eigenes Statement (o-1, Agentur legt an)
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
    # Festgeschrieben: nur fertige Belege sind für den Eigentümer sichtbar.
    eigen = _finalize(svc, _gen(svc).id)  # von der Agentur erzeugt (admin)

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
    _finalize(svc, _gen(svc).id)
    res = svc.list(_owner_ctx())
    assert res.total == 1
    assert res.items[0].owner_payout > 0
    assert res.items[0].pm_payout is None
    # Die Agentur bekommt ihn weiterhin.
    assert svc.list(_ctx()).items[0].pm_payout is not None


# ----------------------------------------------------------------------
# Fehlende Einstellung kippt die Abrechnung nicht (Wurzel 5)
# ----------------------------------------------------------------------


def _tables_mit_vertrag_ohne_portalsatz() -> dict[str, list[dict]]:
    """Der LIVE aufgetretene Zustand vom 11.08.2026.

    Der Eigentümer hat einen Abrechnungsvertrag (die volle Kette greift also),
    aber `portal_abzugssaetze` ist leer und das Portal hat keine Provision
    gemeldet. Damit ist der Portal-Abzug nicht bestimmbar.
    """
    tables = _base_tables()
    tables["owner_billing_terms"] = [
        {
            "id": "obt-1",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "property_id": None,
            "gueltig_ab": "2024-01-01",
            "gueltig_bis": None,
            "provisions_pct": 20,
        }
    ]
    tables["portal_abzugssaetze"] = []
    tables["fee_classification"] = []
    return tables


def test_fehlender_portalsatz_kippt_die_abrechnung_nicht() -> None:
    """Die Kette warf bis in den ASGI-Stack durch — `POST /preview` gab 500.

    Der Betrieb sah eine kaputte Seite statt der Auskunft, welche Einstellung
    fehlt. Die Zeile muss stehen bleiben mit allem, was FESTSTEHT; nur die
    abhängige Auszahlung ist unbekannt und trägt ihren Grund.
    """
    svc = OwnerStatementsService(
        service_client=_DB(_tables_mit_vertrag_ohne_portalsatz())
    )
    sicht = svc.preview(
        _ctx(),
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 1, 31),
            reservation_statuses=["confirmed", "completed"],
        ),
    )

    assert sicht.rental_rows, "die Buchungen müssen im Ergebnis bleiben"
    offen = [r for r in sicht.rental_rows if r.owner_payout is None]
    assert offen, "ohne Portal-Satz kann keine Auszahlung ausgewiesen werden"
    # Kein erfundener Ersatzwert (Wurzel 4) …
    assert all(r.owner_payout is None for r in offen)
    # … und der Grund ist der ECHTE, nicht pauschal „provision": ein fehlender
    # Portal-Satz verlangt einen anderen Handgriff als ein fehlender
    # Provisionssatz.
    assert {r.payout_unbekannt for r in offen} <= {
        "portal_abzug",
        "gebuehr_nicht_zugeordnet",
    }
    # Was feststeht, steht auch da.
    assert all(r.nights > 0 for r in sicht.rental_rows)
    # Und die Zusammenfassung nennt DENSELBEN Grund, nicht pauschal
    # „provision" — sonst schickte die Maske den Betrieb an die falsche Stelle.
    assert sicht.summary.payout_unbekannt == offen[0].payout_unbekannt


def test_preview_antwortet_422_statt_500_bei_fehlender_einstellung() -> None:
    """Die Route selbst: ein Datenmangel ist ein 422 mit Hinweis, kein 500.

    Gegenprobe zum Live-Traceback vom 11.08.2026
    (`PayoutUnbekannt` → ASGI → 500 Internal Server Error).
    """
    from src.features.owner_statements.common import PayoutUnbekannt
    from src.features.owner_statements.router import _payout_fehler

    fehler = _payout_fehler(
        PayoutUnbekannt("portal_abzug", "Kein Satz hinterlegt.")
    )
    assert fehler.status_code == 422
    # Die Meldung sagt, WO die Einstellung sitzt — der rohe Grund allein ist
    # keine Auskunft für einen Menschen.
    assert "Abrechnungsregeln" in fehler.detail


def test_unbekannte_gruende_bleiben_verstaendlich() -> None:
    """Ein Grund ohne Hinweistext darf keinen leeren Satz erzeugen."""
    from src.features.owner_statements.common import PayoutUnbekannt
    from src.features.owner_statements.router import _payout_fehler

    fehler = _payout_fehler(PayoutUnbekannt("waehrung_vertrag", "Währung passt nicht."))
    assert fehler.status_code == 422
    assert fehler.detail == "Währung passt nicht."


# ----------------------------------------------------------------------
# Was der Eigentümer sehen darf: nur der fertige, gültige Beleg
# ----------------------------------------------------------------------
# Anlass (30.08.2026): Im Live-Bestand lagen für eine Eigentümerin eine
# stornierte Rechnung (RE-0003) und der zugehörige Storno-Beleg (ST-0003).
# Beide hätte sie in ihrem Portal gesehen — samt einer Rechnung über
# 13.988,28 DKK, die es fachlich nicht mehr gab. Entwürfe standen ebenfalls
# offen. Entscheidung: der Eigentümer sieht `finalized` + `kind='invoice'`,
# sonst nichts.


def _statement_zeile(tables: dict[str, list[dict]], **over: object) -> dict:
    """Fertige Statement-Zeile für o-1 direkt einlegen (Status/kind frei)."""
    row = {
        "id": f"st-{len(tables['owner_statements']) + 1}",
        "tenant_id": "t-1", "owner_id": "o-1", "owner_name": "Anna Owner",
        "period_from": "2026-01-01", "period_to": "2026-01-31",
        "status": "finalized", "kind": "invoice", "owner_payout": 500,
        "pm_payout": 100, "currency": "EUR", "invoice_number": "EA-0009",
        "created_at": "2026-02-01T00:00:00Z", "basis": "check_in",
        "reservation_statuses": ["confirmed"], "commission_pct": 20,
    }
    row.update(over)
    tables["owner_statements"].append(row)
    return row


def test_owner_sieht_weder_entwurf_noch_storno_paar() -> None:
    """Liste: Entwurf, stornierte Rechnung und Storno-Beleg bleiben unsichtbar."""
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    gueltig = _statement_zeile(tables, id="st-ok")
    _statement_zeile(tables, id="st-entwurf", status="draft")
    _statement_zeile(tables, id="st-storniert", status="cancelled")
    _statement_zeile(tables, id="st-storno", kind="cancellation")

    res = svc.list(_owner_ctx())
    assert [i.id for i in res.items] == [gueltig["id"]]
    # `total` zählt dieselbe Menge wie `items` — sonst stünde in der Oberfläche
    # eine Zahl, zu der die Zeilen fehlen.
    assert res.total == 1

    # Die Agentur sieht unverändert alles.
    assert svc.list(_ctx()).total == 4


def test_owner_get_entwurf_und_storno_404() -> None:
    """Wurzel 9 — der Direktruf auf /{id} darf nicht liefern, was die Liste
    verbirgt. Sonst wäre der Listenfilter reine Kosmetik."""
    tables = _two_owner_tables()
    svc = OwnerStatementsService(service_client=_DB(tables))
    _statement_zeile(tables, id="st-entwurf", status="draft")
    _statement_zeile(tables, id="st-storniert", status="cancelled")
    _statement_zeile(tables, id="st-storno", kind="cancellation")

    for sid in ("st-entwurf", "st-storniert", "st-storno"):
        with pytest.raises(StatementError) as exc:
            svc.get(_owner_ctx(), sid)
        assert exc.value.status_code == 404, sid
        # Wortlaut wie bei „fremd": die Existenz wird nicht verraten.
        assert "nicht gefunden" in exc.value.message

    # Die Agentur kommt an alle drei heran.
    for sid in ("st-entwurf", "st-storniert", "st-storno"):
        assert svc.get(_ctx(), sid).id == sid


# ----------------------------------------------------------------------
# Doppelbestätigung vor dem Festschreiben
# ----------------------------------------------------------------------


def test_finalize_ohne_bestaetigung_abgelehnt() -> None:
    """Ohne Bestätigung wird nicht festgeschrieben — 428, und der Beleg bleibt
    Entwurf (kein halber Zustand)."""
    svc = _svc()
    st = _gen(svc)
    with pytest.raises(StatementError) as exc:
        svc.finalize(_ctx(), st.id)
    assert exc.value.status_code == 428
    assert svc.get(_ctx(), st.id).status == "draft"


def test_finalize_mit_falschem_betrag_abgelehnt() -> None:
    """Der Kern der Prüfung: bestätigt wurde ein ANDERER Betrag als der, der
    festgeschrieben würde → 409, nichts passiert."""
    svc = _svc()
    st = _gen(svc)
    echt = svc.get(_ctx(), st.id).summary
    with pytest.raises(StatementError) as exc:
        svc.finalize(
            _ctx(), st.id,
            StatementFinalizeRequest(
                bestaetigte_auszahlung=echt.owner_payout + 1,
                bestaetigte_waehrung=echt.owner_currency or echt.currency,
            ),
        )
    assert exc.value.status_code == 409
    st_danach = svc.get(_ctx(), st.id)
    assert st_danach.status == "draft"
    assert st_danach.header.invoice_number in (None, "")


def test_finalize_mit_falscher_waehrung_abgelehnt() -> None:
    """13.988,28 DKK ist nicht 13.988,28 EUR (Wurzel 4) — der richtige Betrag
    in der falschen Währung ist keine gültige Bestätigung."""
    svc = _svc()
    st = _gen(svc)
    echt = svc.get(_ctx(), st.id).summary
    falsch = "DKK" if (echt.owner_currency or echt.currency) != "DKK" else "EUR"
    with pytest.raises(StatementError) as exc:
        svc.finalize(
            _ctx(), st.id,
            StatementFinalizeRequest(
                bestaetigte_auszahlung=echt.owner_payout,
                bestaetigte_waehrung=falsch,
            ),
        )
    assert exc.value.status_code == 409
    assert svc.get(_ctx(), st.id).status == "draft"


def test_finalize_mit_richtiger_bestaetigung_geht_durch() -> None:
    """Die Gegenprobe: die Prüfung darf den normalen Weg nicht blockieren."""
    svc = _svc()
    st = _gen(svc)
    fin = _finalize(svc, st.id)
    assert fin.status == "finalized"
    assert fin.header.invoice_number == "EA-0001"


def test_finalize_bereits_festgeschrieben_bleibt_idempotent() -> None:
    """Wurzel 2 — der zweite Aufruf (Doppelklick, Retry) gibt den bestehenden
    Beleg zurück und vergibt KEINE zweite Rechnungsnummer. Die Bestätigung darf
    daran nichts ändern: der Status wird vor ihr geprüft."""
    svc = _svc()
    st = _gen(svc)
    erst = _finalize(svc, st.id)
    nochmal = svc.finalize(_ctx(), st.id)
    assert nochmal.header.invoice_number == erst.header.invoice_number


# ----------------------------------------------------------------------
# Wiederkehrende Posten in der Abrechnung (0365/0524)
# ----------------------------------------------------------------------
# Bis 02.09.2026 las nur der Bericht `owner_recurring_items`; die Abrechnung
# nicht. Der Betrieb legte die 50 DKK je Buchung deshalb von Hand als
# Verrechnungsposten an — zusätzlich zur Vertragspauschale, also doppelt.


def _tables_mit_wiederkehrenden_posten() -> dict[str, list[dict]]:
    tables = _base_tables()
    tables["owner_recurring_items"] = [
        {
            "id": "rec-abzug",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "label": "Kaffee & Co",
            "abschnitt": "ausgaben",
            "modus": "je_buchung",
            "betrag": 50,
            "currency": "EUR",
            "property_id": None,
            "aktiv": True,
        },
        {
            "id": "rec-gutschrift",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "label": "NK-Pauschale",
            "abschnitt": "andere",
            "modus": "je_buchung",
            "betrag": 200,
            "currency": "EUR",
            "property_id": None,
            "aktiv": True,
        },
        # Inaktiv → zählt nicht. Eine gekündigte Dauervereinbarung darf nicht
        # stumm weiterlaufen.
        {
            "id": "rec-aus",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "label": "Alt",
            "abschnitt": "ausgaben",
            "modus": "je_zeitraum",
            "betrag": 999,
            "currency": "EUR",
            "property_id": None,
            "aktiv": False,
        },
    ]
    return tables


def test_wiederkehrende_posten_fliessen_in_die_auszahlung() -> None:
    """2 Buchungen × (200 − 50) = +300 auf die Auszahlung, beide Richtungen
    einzeln ausgewiesen, jeder Posten mit Bezugsmenge."""
    ohne = _gen(_svc())
    mit = _gen(_svc(_tables_mit_wiederkehrenden_posten()))
    assert ohne.summary.owner_payout is not None
    assert mit.summary.owner_payout == ohne.summary.owner_payout + 300.0
    assert mit.summary.recurring_to_owner == 400.0
    assert mit.summary.recurring_from_owner == 100.0
    # Verwaltungs-Auszahlung = Gesamt − Eigentümer: sie sinkt um dieselben 300.
    assert mit.summary.pm_payout == ohne.summary.pm_payout - 300.0
    # Ohne Posten sind die Summen 0 — gesetzt, nicht per Default gefallen.
    assert ohne.summary.recurring_to_owner == 0.0
    assert ohne.summary.recurring_from_owner == 0.0
    posten = {p.item_id: p for p in mit.recurring}
    assert set(posten) == {"rec-abzug", "rec-gutschrift"}
    assert posten["rec-abzug"].anzahl == 2
    assert posten["rec-abzug"].einzelbetrag == 50.0
    assert posten["rec-abzug"].betrag == -100.0
    assert posten["rec-gutschrift"].betrag == 400.0
    assert posten["rec-gutschrift"].modus == "je_buchung"


def test_wiederkehrende_posten_stehen_auch_in_der_vorschau() -> None:
    svc = _svc(_tables_mit_wiederkehrenden_posten())
    sicht = svc.preview(
        _ctx(),
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 1, 31),
            reservation_statuses=["confirmed", "completed"],
        ),
    )
    assert len(sicht.recurring) == 2
    assert sicht.summary.recurring_from_owner == 100.0


def test_finalize_mit_altem_betrag_ohne_posten_wird_abgelehnt() -> None:
    """Der abgetippte Betrag muss die Posten enthalten — sonst 409.

    Genau der Fall, den die Doppelbestätigung fangen soll: die Oberfläche
    zeigte einen Betrag OHNE die Dauervereinbarung, der Server rechnet MIT.
    """
    svc = _svc(_tables_mit_wiederkehrenden_posten())
    st = _gen(svc)
    falsch = st.summary.owner_payout - 300.0
    with pytest.raises(StatementError) as exc:
        svc.finalize(
            _ctx(),
            st.id,
            StatementFinalizeRequest(
                bestaetigte_auszahlung=falsch, bestaetigte_waehrung="EUR"
            ),
        )
    assert exc.value.status_code == 409


def test_storno_negiert_die_wiederkehrenden_posten() -> None:
    """Die Gegenbuchung dreht beide Snapshot-Spalten UND die Posten selbst."""
    svc = _svc(_tables_mit_wiederkehrenden_posten())
    st = _gen(svc)
    fin = _finalize(svc, st.id)
    assert fin.summary.recurring_to_owner == 400.0
    storno = svc.cancel(_ctx(), st.id)
    assert storno.kind == "cancellation"
    assert storno.summary.recurring_to_owner == -400.0
    assert storno.summary.recurring_from_owner == -100.0
    betraege = sorted(p.betrag for p in storno.recurring)
    assert betraege == [-400.0, 100.0]


def test_wiederkehrender_posten_in_fremder_waehrung_ist_422() -> None:
    """DKK-Posten in einer EUR-Auszahlung: kein Kurs 1,0, sondern klar
    fehlschlagen — mit dem Namen des Postens."""
    tables = _tables_mit_wiederkehrenden_posten()
    tables["owner_recurring_items"][0]["currency"] = "DKK"
    svc = _svc(tables)
    with pytest.raises(StatementError) as exc:
        svc.preview(
            _ctx(),
            StatementGenerateRequest(
                owner_id="o-1",
                period_from=date(2026, 1, 1),
                period_to=date(2026, 1, 31),
            ),
        )
    assert exc.value.status_code == 422
    assert "Kaffee & Co" in str(exc.value)


def test_snapshot_summen_ueberleben_ohne_posten_als_null_zahl() -> None:
    """Finalisiert ohne Posten: die Spalten stehen auf 0 und werden als 0
    gelesen — nicht als fehlend, nicht als Fantasiewert."""
    svc = _svc()
    st = _gen(svc)
    fin = _finalize(svc, st.id)
    assert fin.summary.recurring_to_owner == 0.0
    assert fin.summary.recurring_from_owner == 0.0
    assert fin.recurring == []


# ----------------------------------------------------------------------
# Jede Gebühr ein eigener Posten (02.09.2026)
# ----------------------------------------------------------------------
# Ansage des Betriebs, wörtlich: „Jede Gebühr muss als einzelner Posten
# aufgeschlüsselt werden auf der Abrechnung." Geprüft wird die ZEILE, die die
# API liefert — nicht nur die Kette darunter.


def _tables_volle_kette() -> dict[str, list[dict]]:
    """Vertrag + Portal-Sätze + Gebühren-Zuordnung + Objekt-Gebühren + Extras.

    r-1 (booking, 3 Nächte, 1.000): Portal-Buchung ohne Payload → keine
    Gebühren („ota_ohne_aufstellung"), aber Portal-Abzug 15 % + 1,5 %.
    r-2 (direct, 2 Nächte, 500): Stammdaten-Gebühren (Reinigung 795 je
    Aufenthalt, Resort 25 je Nacht) + zwei Zusatzleistungen (2 × 95, 1 × 40)
    und eine stornierte (60), die NICHT zählt.
    """
    tables = _base_tables()
    tables["owner_billing_terms"] = [
        {
            "id": "obt-1",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "property_id": None,
            "gueltig_ab": "2024-01-01",
            "gueltig_bis": None,
            "provisions_pct": 20,
        }
    ]
    tables["portal_abzugssaetze"] = [
        {
            "id": "pa-booking",
            "tenant_id": "t-1",
            "kanal": "booking",
            "property_id": None,
            "gueltig_ab": "2024-01-01",
            "gueltig_bis": None,
            "provision_pct": 15,
            "zahlungsgebuehr_pct": 1.5,
        },
        {
            "id": "pa-direct",
            "tenant_id": "t-1",
            "kanal": "direct",
            "property_id": None,
            "gueltig_ab": "2024-01-01",
            "gueltig_bis": None,
            "provision_pct": 0,
            "zahlungsgebuehr_pct": None,
        },
    ]
    tables["fee_classification"] = [
        {
            "tenant_id": "t-1",
            "fee_type": "cleaning_fee",
            "property_id": None,
            "gehoert_zu": "betrieb",
            "provisionspflichtig": False,
        },
        {
            "tenant_id": "t-1",
            "fee_type": "resort",
            "property_id": None,
            "gehoert_zu": "eigentuemer",
            "provisionspflichtig": False,
        },
    ]
    tables["properties"][0]["type_attributes"] = {
        "pricing": {
            "fees": [
                {"feeType": "cleaning_fee", "mode": "amount", "amount": 795, "basis": "per_stay"},
                {"feeType": "resort", "mode": "amount", "amount": 25, "basis": "per_night"},
            ]
        }
    }
    tables["reservations"][0]["ota_name"] = "Booking.com"
    tables["reservation_addons"] = [
        {
            "id": "ra-1",
            "tenant_id": "t-1",
            "reservation_id": "r-2",
            "name": {"de": "Bettwäsche-Set", "en": "Linen set"},
            "qty": 2,
            "price": 95,
            "basis": "per_unit",
            "total": 190,
            "status": "pending",
        },
        {
            "id": "ra-2",
            "tenant_id": "t-1",
            "reservation_id": "r-2",
            # Kein deutscher Name → erster vorhandener Wert, kein erfundener.
            "name": {"da": "Håndklæder"},
            "qty": 1,
            "price": 40,
            "basis": "per_stay",
            "total": 40,
            "status": "paid",
        },
        {
            "id": "ra-storno",
            "tenant_id": "t-1",
            "reservation_id": "r-2",
            "name": {"de": "Nie gebucht"},
            "qty": 1,
            "price": 60,
            "basis": "per_stay",
            "total": 60,
            "status": "cancelled",
        },
    ]
    return tables


def _zeile(st, reservation_id: str):
    return next(r for r in st.rental_rows if r.reservation_id == reservation_id)


def test_jede_gebuehr_ist_ein_eigener_posten() -> None:
    """Vier Posten mit Namen statt „Gebühren +50,00"."""
    st = _gen(_svc(_tables_volle_kette()))
    z = _zeile(st, "r-2")
    posten = {(g.art, g.label): g for g in z.gebuehren}
    assert set(posten) == {
        ("cleaning_fee", "Reinigungsgebühr"),
        ("resort", "Resort"),
        ("addon", "Bettwäsche-Set"),
        ("addon", "Håndklæder"),
    }
    reinigung = posten[("cleaning_fee", "Reinigungsgebühr")]
    assert reinigung.betrag == 795.0
    assert reinigung.gehoert_zu == "betrieb"
    assert reinigung.provisionspflichtig is False
    assert reinigung.quelle == "stammdaten"
    assert reinigung.menge is None
    resort = posten[("resort", "Resort")]
    assert resort.betrag == 50.0  # 25 je Nacht × 2 Nächte
    assert resort.gehoert_zu == "eigentuemer"
    waesche = posten[("addon", "Bettwäsche-Set")]
    assert waesche.gehoert_zu == "betrieb"
    assert waesche.quelle == "addon"
    assert waesche.menge == 2
    assert waesche.einzelpreis == 95.0
    assert waesche.basis == "per_unit"
    assert waesche.betrag == 190.0
    # Die stornierte Zusatzleistung fehlt.
    assert all(g.label != "Nie gebucht" for g in z.gebuehren)


def test_kontrollsummen_stimmen_mit_den_posten_ueberein() -> None:
    """Die Anzeige rechnet nie selbst — Σ Liste == Kontrollsumme, je Zugehörigkeit."""
    st = _gen(_svc(_tables_volle_kette()))
    z = _zeile(st, "r-2")
    betrieb = sum(
        g.betrag for g in z.gebuehren if g.gehoert_zu == "betrieb" and g.quelle != "addon"
    )
    eigentuemer = sum(g.betrag for g in z.gebuehren if g.gehoert_zu == "eigentuemer")
    addons = sum(g.betrag for g in z.gebuehren if g.quelle == "addon")
    assert z.gebuehren_betrieb == betrieb == 795.0
    assert z.gebuehren_an_eigentuemer == eigentuemer == 50.0
    assert z.addon_total == addons == 230.0
    assert z.gebuehren_durchlauf == 0.0
    # Die Kette: 500 + 795 + 50 = 1.345 Gastpreis (die Extras 230 sind kein
    # Teil davon); Bemessung 500; 20 % = 100; Eigentümer bekommt 400 + 50
    # Resort = 450. Die Extras (230) bleiben beim Betrieb.
    assert z.total_price == 1345.0
    assert z.auszahlungsbasis == 1345.0  # Direktbuchung: kein Portal-Abzug
    assert z.bemessungsgrundlage == 500.0
    assert z.verwaltungsprovision == 100.0
    assert z.owner_payout == 450.0


def test_zeile_traegt_anreise_abreise_portalname_und_vertragssatz() -> None:
    st = _gen(_svc(_tables_volle_kette()))
    z1 = _zeile(st, "r-1")
    z2 = _zeile(st, "r-2")
    assert z1.check_in == date(2026, 1, 5)
    assert z1.check_out == date(2026, 1, 8)
    assert z1.ota_name == "Booking.com"
    assert z2.ota_name is None
    # Portal-Abzug ZWEITEILIG: 15 % Provision + 1,5 % Zahlungsgebühr auf den
    # Gastpreis inkl. Gebühren (1.000 + 795 Reinigung + 3 × 25 Resort = 1.870).
    # Ohne Channex-Payload gilt die Buchung als nicht vom Portal gemeldet —
    # dann greifen die Stammdaten, wie bei einer Direktbuchung.
    assert z1.gebuehren_quelle == "stammdaten"
    assert z1.total_price == 1870.0
    assert z1.portal_provision == 280.5
    assert z1.portal_zahlungsgebuehr == 28.05
    assert z2.portal_provision == 0.0
    assert z2.portal_zahlungsgebuehr == 0.0
    # Der Satz JE ZEILE samt Herkunft und Stichtag.
    for z in (z1, z2):
        assert z.provisions_pct == 20.0
        assert z.provision_quelle == "vertrag"
        assert z.vertrag_gueltig_ab == date(2024, 1, 1)
        assert z.min_provision_angewandt is False
    # Beide Stammdaten-Gebühren als eigene Posten, Resort mit 3 Nächten.
    assert {(g.art, g.betrag) for g in z1.gebuehren} == {
        ("cleaning_fee", 795.0),
        ("resort", 75.0),
    }


def _ohne_altsatz(tables: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """Weder Owner-Default noch Objekt-Override — nur der Vertrag zählt."""
    tables["owners"][0]["default_commission_pct"] = None
    for link in tables["owner_properties"]:
        link["commission_override_pct"] = None
    return tables


def test_vertrag_beginnt_nach_abreise_nennt_das_datum() -> None:
    """Live 02.09.2026: Vertrag ab 12.08., Abreise 09.08. — Meldung war falsch.

    Die Abrechnung sagte „kein Provisionssatz hinterlegt" und schickte den
    Betrieb in die Stammdaten, wo nichts fehlte. Der Vertrag existierte mit
    20 %, galt nur noch nicht. Erwartet: die Zeile trägt den EIGENEN Grund
    `provision_zeitraum` samt Datum des nächsten Vertragsbeginns, und die
    Zusammenfassung übernimmt ihn.
    """
    tables = _ohne_altsatz(_tables_volle_kette())
    # r-1 reist am 08.01. ab, r-2 am 22.01. — der Vertrag beginnt dazwischen.
    tables["owner_billing_terms"][0]["gueltig_ab"] = "2026-01-10"
    st = _gen(_svc(tables))
    z1, z2 = _zeile(st, "r-1"), _zeile(st, "r-2")

    assert z1.owner_payout is None
    assert z1.payout_unbekannt == "provision_zeitraum"
    assert z1.vertrag_beginnt_am == date(2026, 1, 10)
    assert z1.provision_quelle is None
    assert z1.provisions_pct is None
    # r-2 liegt im Vertrag und rechnet normal — mit Herkunft.
    assert z2.owner_payout is not None
    assert z2.payout_unbekannt is None
    assert z2.provision_quelle == "vertrag"
    assert z2.vertrag_beginnt_am is None
    assert st.summary.owner_payout is None
    assert st.summary.payout_unbekannt == "provision_zeitraum"


def test_ohne_vertrag_stehen_gebuehren_und_portalabzug_trotzdem() -> None:
    """Zweiter Befund vom 02.09.2026: die Zeile ohne Vertrag zeigte den nackten
    Übernachtungsbetrag als Gastpreis und „Keine Gebühren an dieser Buchung",
    obwohl Reinigung und Resort in den Stammdaten standen wie bei jeder
    anderen Buchung des Objekts. Gebühren, Gastpreis und Portal-Abzug hängen
    nicht am Vertrag — nur der Eigentümer-Anteil.
    """
    tables = _ohne_altsatz(_tables_volle_kette())
    tables["owner_billing_terms"][0]["gueltig_ab"] = "2026-01-10"
    z1 = _zeile(_gen(_svc(tables)), "r-1")

    # Wie in `test_jede_gebuehr_ist_ein_eigener_posten`: 1.000 + 795 + 3 × 25.
    assert z1.total_price == 1870.0
    assert z1.portal_provision == 280.5
    assert z1.portal_zahlungsgebuehr == 28.05
    assert z1.auszahlungsbasis == 1561.45
    assert {(g.art, g.betrag) for g in z1.gebuehren} == {
        ("cleaning_fee", 795.0),
        ("resort", 75.0),
    }
    assert z1.gebuehren_betrieb == 795.0
    # Was den Vertrag braucht, bleibt offen — nie 0.
    assert z1.bemessungsgrundlage is None
    assert z1.verwaltungsprovision is None
    assert z1.owner_payout is None


def test_gar_kein_vertrag_bleibt_grund_provision() -> None:
    """Kein Vertrag, auch kein späterer: der Grund heißt weiter `provision`,
    ohne erfundenes Datum — der Handgriff ist dann „Vertrag anlegen"."""
    tables = _ohne_altsatz(_tables_volle_kette())
    tables["owner_billing_terms"] = []
    st = _gen(_svc(tables))
    for z in st.rental_rows:
        assert z.owner_payout is None
        assert z.payout_unbekannt == "provision"
        assert z.vertrag_beginnt_am is None
    assert st.summary.payout_unbekannt == "provision"


def test_fehlender_vertrag_schlaegt_fehlenden_portalsatz() -> None:
    """Fehlen Vertrag UND Portal-Satz, nennt die Zeile den Vertrag: er ist der
    erste Handgriff. „Portal-Satz fehlt" schickte den Betrieb erst in die
    Abrechnungsregeln und danach doch noch zum Vertrag."""
    tables = _ohne_altsatz(_tables_volle_kette())
    tables["owner_billing_terms"][0]["gueltig_ab"] = "2026-01-10"
    tables["portal_abzugssaetze"] = []
    z1 = _zeile(_gen(_svc(tables)), "r-1")
    assert z1.payout_unbekannt == "provision_zeitraum"
    assert z1.vertrag_beginnt_am == date(2026, 1, 10)
    # Die Zerlegung scheiterte am Portal-Satz — also auch kein Gastpreis
    # inkl. Gebühren behaupten.
    assert z1.portal_provision is None


def test_csv_buchung_findet_channex_zwilling_ueber_external_ref() -> None:
    """Live 02.09.2026 (Timmann): die Abrechnung lud Payloads nur über
    `channex_booking_id` — der CSV-Zwilling stand unter Channex' eigener ID
    und blieb unsichtbar. Über `external_ref = ota_reservation_code` wird er
    gefunden, und aus CSV-Gesamt − Nächte entsteht die Reinigung als Posten."""
    tables = _tables_volle_kette()
    r1 = next(r for r in tables["reservations"] if r["id"] == "r-1")
    r1.update(
        {
            "source_channex_booking_id": "csv:5008485743",
            "external_ref": "5008485743",
            "total_amount": 1795,  # 1.000 Nächte + 795 Reinigung, Booking-Gesamt
        }
    )
    tables["channex_booking"] = [
        {
            "id": "cb-1",
            "tenant_id": "t-1",
            "channex_booking_id": "chx-abc",
            "ota_reservation_code": "5008485743",
            "raw": {
                "ota_name": "BookingCom",
                "meta": {"is_imported": True},
                "rooms": [
                    {
                        "days": {
                            "2026-01-05": "400",
                            "2026-01-06": "300",
                            "2026-01-07": "300",
                        },
                        "taxes": [],
                    }
                ],
            },
        }
    ]
    z1 = _zeile(_gen(_svc(tables)), "r-1")
    assert z1.gebuehren_quelle == "stammdaten_portal"
    assert z1.gebuehren_grund == "belegt"
    assert {(g.art, g.betrag) for g in z1.gebuehren} == {("cleaning_fee", 795.0)}
    # Gastpreis = CSV-Gesamt, keine erfundene Resort-Gebühr obendrauf.
    assert z1.total_price == 1795.0
    assert z1.portal_provision == round(1795 * 0.15, 2)


def test_airbnb_historie_payload_wird_wie_der_feed_gelesen() -> None:
    """0528: der Historie-Import legt Airbnbs Reservierung in
    `portal_buchungs_payloads` ab. Die Kette liest sie wie einen Feed-Payload:
    Übernachtung = base_price + extra_guest_fee (3.091,92), Reinigung aus
    `standard_fees_details` (1.075), Provision gemeldet (`ota_commission`).
    Live-Fall Dora 03.–05.07.2026: vorher 4.116,92, Airbnb 4.166,92."""
    tables = _tables_volle_kette()
    r1 = next(r for r in tables["reservations"] if r["id"] == "r-1")
    r1.update(
        {
            "channel": "airbnb",
            "ota_name": "Airbnb",
            "source_channex_booking_id": "HMYM9RH2CN",
            "external_ref": "HMYM9RH2CN",
            "total_amount": 3041.92,
            "ota_commission": 645.87,
            "check_in": "2026-01-05",
            "check_out": "2026-01-07",
        }
    )
    tables["portal_buchungs_payloads"] = [
        {
            "id": "pbp-1",
            "tenant_id": "t-1",
            "reservation_id": "r-1",
            "quelle": "airbnb_historie",
            "ota_reservation_code": "HMYM9RH2CN",
            "raw": {
                "ota_name": "Airbnb",
                "raw_message": {
                    "reservation": {
                        "base_price": "3041.92",
                        "extra_guest_fee": "50.00",
                        "host_fee_base": "645.87",
                        "payout_amount": "3521.05",
                        "standard_fees_details": [
                            {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": "1075.00"}
                        ],
                    }
                },
            },
        }
    ]
    tables["portal_abzugssaetze"].append(
        {
            "id": "pa-airbnb",
            "tenant_id": "t-1",
            "kanal": "airbnb",
            "property_id": None,
            "gueltig_ab": "2024-01-01",
            "gueltig_bis": None,
            "provision_pct": 15.5,
            "zahlungsgebuehr_pct": None,
        }
    )
    z1 = _zeile(_gen(_svc(tables)), "r-1")
    assert z1.gebuehren_quelle == "ota"
    assert z1.total_price == 4166.92
    assert z1.portal_provision == 645.87
    assert {(g.art, g.betrag) for g in z1.gebuehren} == {("cleaning_fee", 1075.0)}


def test_portal_abzug_laeuft_nicht_auf_zusatzleistungen() -> None:
    """Live 02.09.2026 (Pschorr): Booking 5.662,50, Wäschepaket 600 über uns.
    Die Zahlungsgebühr 1,5 % lief auf 6.262,50 — 9,00 DKK zu viel Abzug. Das
    Portal kennt die Zusatzleistung nicht; Provision und Zahlungsgebühr
    rechnen auf den Portal-Gastpreis, der Gastpreis der Zeile trägt sie
    weiterhin."""
    tables = _tables_volle_kette()
    tables["reservation_addons"].append(
        {
            "id": "ra-r1",
            "tenant_id": "t-1",
            "reservation_id": "r-1",
            "name": {"de": "Wäschepaket"},
            "qty": 4,
            "price": 150,
            "basis": "per_guest",
            "total": 600,
            "status": "paid",
        }
    )
    z1 = _zeile(_gen(_svc(tables)), "r-1")
    # Portal-Gastpreis 1.870 (1.000 + 795 + 3 × 25) — OHNE das Wäschepaket,
    # das steht als eigener Posten daneben (`addon_total`).
    assert z1.total_price == 1870.0
    assert z1.addon_total == 600.0
    assert z1.portal_provision == 280.5  # 15 % von 1.870, nicht von 2.470
    assert z1.portal_zahlungsgebuehr == 28.05  # 1,5 % von 1.870
    assert z1.auszahlungsbasis == 1870.0 - 280.5 - 28.05
    assert {g.quelle for g in z1.gebuehren} == {"stammdaten", "addon"}


def test_provision_quelle_altspalten_ohne_vertrag() -> None:
    """Ohne Vertrag rechnet die Altspalte — und die Zeile nennt sie als Quelle."""
    st = _gen(_svc())
    z = _zeile(st, "r-1")
    assert z.provisions_pct == 20.0
    assert z.provision_quelle == "altspalten"
    assert z.vertrag_gueltig_ab is None
    assert z.gebuehren == []


def test_pauschalen_gesamt_ist_ausweis_nicht_zweiter_abzug() -> None:
    """Σ Pauschalen steht in der Summary; owner_payout ändert sich dadurch nicht."""
    tables = _tables_volle_kette()
    tables["owner_billing_terms"][0].update(
        {
            "pauschale_betrag": 50,
            "pauschale_currency": "EUR",
            "pauschale_basis": "je_buchung",
            "pauschale_zeitpunkt": "nach_provision",
        }
    )
    st = _gen(_svc(tables))
    assert st.summary.pauschalen_gesamt == 100.0  # 2 Buchungen × 50
    assert all(r.pauschale == 50.0 for r in st.rental_rows)
    # In den Zeilen bereits abgezogen: Summe der Zeilen == owner_payout.
    assert st.summary.owner_payout == sum(r.owner_payout for r in st.rental_rows)


def test_eigentuemer_sieht_betriebsgebuehren_und_extras_ohne_betrag() -> None:
    """§4.2: Reinigung und Zusatzleistungen sind Verkaufspreis des Betriebs.

    Der Eigentümer sieht die Zeile (DASS eine Reinigung berechnet wurde), aber
    keinen Betrag — und keine 0. Seine eigene Gebühr (Resort) sieht er voll.
    """
    tables = _tables_volle_kette()
    tables["users"].append({"id": "u-owner-1", "role": "owner", "permissions": []})
    tables["owners"][0]["user_id"] = "u-owner-1"
    svc = _svc(tables)
    sicht = svc.preview(
        AuthContext(user_id="u-owner-1", tenant_id="t-1", role="owner"),
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 1, 31),
            reservation_statuses=["confirmed", "completed"],
        ),
    )
    z = _zeile(sicht, "r-2")
    nach_art = {g.label: g for g in z.gebuehren}
    assert nach_art["Reinigungsgebühr"].betrag is None
    assert nach_art["Bettwäsche-Set"].betrag is None
    assert nach_art["Bettwäsche-Set"].einzelpreis is None
    assert nach_art["Bettwäsche-Set"].menge == 2  # die Menge ist kein Preis
    assert nach_art["Resort"].betrag == 50.0
    assert z.gebuehren_betrieb is None
    assert z.addon_total is None
    assert z.gebuehren_an_eigentuemer == 50.0
    assert z.total_price is None
    assert z.portal_zahlungsgebuehr is None
    # Der Gesamtbetrag NACH Portal-Abzug ist bewusst sichtbar: er ist der erste
    # Summand seiner Kette (Entscheidung 02.09.2026), nicht der Gastpreis.
    assert z.auszahlungsbasis == 1345.0
    # Seine eigene Kette bleibt sichtbar.
    assert z.verwaltungsprovision == 100.0
    assert z.owner_payout == 450.0
    assert z.check_in == date(2026, 1, 20)


# ----------------------------------------------------------------------
# Miteigentum (0601, ADR-0028) — ein Objekt, mehrere Eigentümer
# ----------------------------------------------------------------------
#
# Ansage des Betriebs am 07.09.2026: „Ja es muss ein miteigentümer geben."
# Damit fiel ADR-0026 („ein Eigentümer je Objekt"). Der Anteil steht seit 0063
# in `owner_properties.ownership_share`; 0601 löst die Exklusiv-Sperre aus
# 0073, riegelt die Summe bei 100 % ab und lässt die Rechenkette den Anteil
# endlich anwenden.


def test_alleineigentum_rechnet_unveraendert() -> None:
    """100 % ist ein No-Op — der Bestand darf sich nicht um einen Cent ändern.

    Die Gegenprobe zu allem Folgenden: wäre die Multiplikation fehlerhaft (etwa
    mit `/100` an der falschen Stelle), fiele sie hier zuerst auf, und zwar für
    JEDE bestehende Abrechnung.
    """
    svc = _svc()
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 100
    st = _gen(svc)
    assert st.summary.owner_payout is not None

    ohne_feld = _svc()  # Zeile OHNE `ownership_share` (Spalten-Default 100)
    st2 = _gen(ohne_feld)
    assert st2.summary.owner_payout == st.summary.owner_payout


def test_halber_anteil_halbiert_die_auszahlung() -> None:
    """50 % → der Eigentümer bekommt die Hälfte, der Betrieb behält seine Provision.

    Die Reihenfolge ist der Kern: geteilt wird das ERGEBNIS der Kette, nicht der
    Gastpreis. Würde der Anteil vor der Provision greifen, bekäme der Betrieb
    seine 20 % nur auf die Hälfte — bei zwei Miteigentümern also zweimal 20 %
    von der Hälfte, was zufällig gleich aussieht, aber bei drei Anteilen oder
    einer Mindestprovision auseinanderläuft.
    """
    voll = _svc()
    for link in voll._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 100
    ganz = _gen(voll).summary.owner_payout

    halb_svc = _svc()
    for link in halb_svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 50
    halb = _gen(halb_svc).summary.owner_payout

    assert ganz is not None and halb is not None
    assert halb == pytest.approx(ganz / 2, abs=0.01)


def test_zwei_miteigentuemer_teilen_genau_den_ganzen_betrag() -> None:
    """60/40 auf dasselbe Objekt: die Summe beider Abrechnungen = der ganze Betrag.

    Kein Cent entsteht und keiner verschwindet. Genau das wäre der teure
    Fehler: zwei Abrechnungen, die zusammen 101 % auszahlen, sehen einzeln
    plausibel aus.
    """
    tables = _base_tables()
    tables["owners"].append({**tables["owners"][0], "id": "o-2", "name": "Zweiter"})
    tables["owner_properties"] = [
        {"id": "op-1", "owner_id": "o-1", "property_id": "p-1", "ownership_share": 60},
        {"id": "op-2", "owner_id": "o-2", "property_id": "p-1", "ownership_share": 40},
    ]
    svc = _svc(tables)

    erster = _gen(svc).summary.owner_payout
    zweiter = svc.generate(
        _ctx(),
        StatementGenerateRequest(
            owner_id="o-2",
            period_from=date(2026, 1, 1),
            period_to=date(2026, 1, 31),
            reservation_statuses=["confirmed", "completed"],
        ),
    ).summary.owner_payout

    voll = _svc()
    for link in voll._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 100
    ganz = _gen(voll).summary.owner_payout

    assert erster is not None and zweiter is not None and ganz is not None
    assert erster + zweiter == pytest.approx(ganz, abs=0.01)


def test_ungueltiger_anteil_ist_ein_422_kein_stiller_wert() -> None:
    """120 % ist ein Eingabefehler und muss laut scheitern (Wurzel 4/5).

    Der Trigger aus 0601 verhindert solche Zeilen künftig; Altbestand von davor
    könnte sie tragen. Ihn stillschweigend auf 100 zu klemmen zahlte dem
    Eigentümer mehr aus, als das Objekt hergibt.
    """
    svc = _svc()
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 120
    with pytest.raises(StatementError) as fehler:
        _gen(svc)
    assert fehler.value.status_code == 422
    assert "120" in str(fehler.value)


def test_anteil_wird_beim_erzeugen_eingefroren() -> None:
    """Der Snapshot je Objekt — ein späterer Anteilsverkauf ändert keinen Beleg.

    Ohne ihn zeigte eine finalisierte Rechnung nach der Änderung andere
    Beträge als die in ihr eingefrorenen Summen; bei fortlaufender Nummer nach
    §14 UStG ist das eine Falschaussage, kein Anzeigefehler.
    """
    svc = _svc()
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 100
    st = _gen(svc)
    vorher = st.summary.owner_payout

    gespeichert = svc._db.tables["owner_statements"][0]  # noqa: SLF001
    assert gespeichert["ownership_shares"] == {"p-1": 100.0}

    # Der Betrieb verkauft die Hälfte weiter …
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 50
    # … die bestehende Abrechnung zeigt weiter den Stand ihrer Erzeugung.
    assert svc.get(_ctx(), st.id).summary.owner_payout == vorher


def test_ohne_snapshot_gelten_die_stammdaten() -> None:
    """Abrechnungen von VOR 0601 haben keinen Snapshot — dann zählen die Stammdaten.

    Damals gab es nur Alleineigentum (0073 erzwang es), der Stammdaten-Anteil
    ist also derselbe Wert. Ein erfundener Default 100 wäre hier zwar richtig,
    aber aus dem falschen Grund — die Regel ist „lies die Quelle", nicht „nimm
    an, es sei voll" (Wurzel 4).
    """
    svc = _svc()
    st = _gen(svc)
    svc._db.tables["owner_statements"][0]["ownership_shares"] = None  # noqa: SLF001
    for link in svc._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 50
    voll = _svc()
    for link in voll._db.tables["owner_properties"]:  # noqa: SLF001
        link["ownership_share"] = 100
    ganz = _gen(voll).summary.owner_payout
    halb = svc.get(_ctx(), st.id).summary.owner_payout
    assert ganz is not None and halb is not None
    assert halb == pytest.approx(ganz / 2, abs=0.01)


# --- 13.3 Abrechnung pro Objekt (0603) ----------------------------------------
#
# Bis 07.09.2026 galt jede Abrechnung für ALLE Objekte des Eigentümers. Die
# Objektmenge steht jetzt an der Abrechnung (NULL = alle), und GENAU EINE
# Funktion (`_scope_property_ids`) bestimmt, was dazugehört — für
# Reservierungen, Listing-Zeilen, wiederkehrende und Verrechnungsposten.


def _tables_zwei_objekte() -> dict[str, list[dict]]:
    """Eigentümer mit zwei Objekten, je eine Buchung im Januar."""
    tables = _base_tables()
    tables["properties"].append({"id": "p-2", "tenant_id": "t-1", "title": "Hygge"})
    tables["owner_properties"].append(
        {"id": "op-2", "owner_id": "o-1", "property_id": "p-2"}
    )
    tables["reservations"].append(
        {
            "id": "r-3",
            "tenant_id": "t-1",
            "property_id": "p-2",
            "guest_id": "g-1",
            "channel": "direct",
            "check_in": "2026-01-10",
            "check_out": "2026-01-12",
            "status": "confirmed",
            "total_amount": 400,
            "channel_fee": 0,
            "currency": "EUR",
            "is_owner_stay": False,
        }
    )
    return tables


def test_preview_mit_objektauswahl_rechnet_nur_diese_objekte() -> None:
    svc = _svc(_tables_zwei_objekte())
    req = StatementGenerateRequest(
        owner_id="o-1",
        period_from=date(2026, 1, 1),
        period_to=date(2026, 1, 31),
        reservation_statuses=["confirmed", "completed"],
        property_ids=["p-2"],
    )
    st = svc.preview(_ctx(), req)
    assert {r.listing_id for r in st.rental_rows} == {"p-2"}
    assert st.property_ids == ["p-2"]
    assert [(o.id, o.title) for o in st.objekte] == [("p-2", "Hygge")]
    # Ohne Auswahl: alle — und `property_ids` bleibt None, nicht die Liste.
    alle = svc.preview(_ctx(), req.model_copy(update={"property_ids": None}))
    assert {r.listing_id for r in alle.rental_rows} == {"p-1", "p-2"}
    assert alle.property_ids is None
    assert {o.id for o in alle.objekte} == {"p-1", "p-2"}


def test_objektauswahl_mit_fremdem_objekt_ist_422() -> None:
    """Wurzel 3/9: eine fremde ID ist kein Filter, der nichts findet."""
    svc = _svc(_tables_zwei_objekte())
    svc._db.tables["properties"].append(
        {"id": "p-fremd", "tenant_id": "t-1", "title": "Fremd"}
    )
    with pytest.raises(StatementError) as exc:
        _gen(svc, property_ids=["p-1", "p-fremd"])
    assert exc.value.status_code == 422
    # Nichts angelegt.
    assert svc._db.tables["owner_statements"] == []


def test_generate_speichert_teilmenge_und_null_bei_allen() -> None:
    svc = _svc(_tables_zwei_objekte())
    teil = _gen(svc, property_ids=["p-1"])
    alle = _gen(svc, property_ids=[])
    zeilen = {r["id"]: r for r in svc._db.tables["owner_statements"]}
    assert zeilen[teil.id]["property_ids"] == ["p-1"]
    assert zeilen[alle.id]["property_ids"] is None
    # Der gespeicherte Entwurf rechnet nur über seine Teilmenge.
    assert {r.listing_id for r in svc.get(_ctx(), teil.id).rental_rows} == {"p-1"}


def test_update_leere_liste_setzt_zurueck_auf_alle_objekte() -> None:
    svc = _svc(_tables_zwei_objekte())
    st = _gen(svc, property_ids=["p-1"])
    assert st.property_ids == ["p-1"]
    st = svc.update(_ctx(), st.id, StatementUpdate(property_ids=[]))
    assert st.property_ids is None
    assert {r.listing_id for r in st.rental_rows} == {"p-1", "p-2"}


def test_finalize_lehnt_zweite_rechnung_ueber_dieselben_buchungen_ab() -> None:
    """Wurzel 2: eine Buchung darf nicht zweimal abgerechnet werden.

    Vorher fehlte diese Prüfung ganz — zwei Abrechnungen desselben Monats
    hätten beide eine fortlaufende Nummer bekommen.
    """
    svc = _svc(_tables_zwei_objekte())
    a = _gen(svc)
    _finalize(svc, a.id)
    b = _gen(svc)
    with pytest.raises(StatementError) as exc:
        _finalize(svc, b.id)
    assert exc.value.status_code == 409
    assert "EA-" in exc.value.message


def test_finalize_disjunkte_objekte_im_selben_zeitraum_gehen_durch() -> None:
    """Zwei Abrechnungen desselben Monats, je ein Objekt — kein Konflikt."""
    svc = _svc(_tables_zwei_objekte())
    a = _gen(svc, property_ids=["p-1"])
    b = _gen(svc, property_ids=["p-2"])
    assert _finalize(svc, a.id).status == "finalized"
    assert _finalize(svc, b.id).status == "finalized"


def test_finalize_teilmenge_kollidiert_mit_alle_objekte() -> None:
    """NULL heißt „alle" und überschneidet mit jeder Teilmenge."""
    svc = _svc(_tables_zwei_objekte())
    alle = _gen(svc)
    _finalize(svc, alle.id)
    teil = _gen(svc, property_ids=["p-2"])
    with pytest.raises(StatementError) as exc:
        _finalize(svc, teil.id)
    assert exc.value.status_code == 409


def test_finalize_disjunkter_zeitraum_geht_durch() -> None:
    tables = _tables_zwei_objekte()
    # Eine Buchung im Februar — ohne Buchung ist eine Abrechnung nicht
    # finalisierbar (bestehende Regel), und genau das soll hier NICHT der
    # Grund für Erfolg oder Misserfolg sein.
    tables["reservations"].append(
        {
            "id": "r-feb",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "guest_id": "g-2",
            "channel": "direct",
            "check_in": "2026-02-10",
            "check_out": "2026-02-12",
            "status": "confirmed",
            "total_amount": 300,
            "channel_fee": 0,
            "currency": "EUR",
            "is_owner_stay": False,
        }
    )
    svc = _svc(tables)
    jan = _gen(svc)
    _finalize(svc, jan.id)
    feb = svc.generate(
        _ctx(),
        StatementGenerateRequest(
            owner_id="o-1",
            period_from=date(2026, 2, 1),
            period_to=date(2026, 2, 28),
            reservation_statuses=["confirmed", "completed"],
        ),
    )
    assert _finalize(svc, feb.id).status == "finalized"


def test_wiederkehrender_posten_mit_objekt_ausserhalb_der_auswahl_faellt_weg() -> None:
    """„je Zeitraum" hängt nicht an den Buchungszeilen — ohne den Filter stünde
    die Jahrespauschale von Haus B auf der Rechnung für Haus A."""
    tables = _tables_zwei_objekte()
    tables["owner_recurring_items"] = [
        {
            "id": "rec-b",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "label": "Gartenpflege Hygge",
            "abschnitt": "ausgaben",
            "modus": "je_zeitraum",
            "betrag": 120,
            "currency": "EUR",
            "property_id": "p-2",
            "aktiv": True,
        },
        {
            "id": "rec-alle",
            "tenant_id": "t-1",
            "owner_id": "o-1",
            "label": "Verwaltungspauschale",
            "abschnitt": "ausgaben",
            "modus": "je_zeitraum",
            "betrag": 30,
            "currency": "EUR",
            "property_id": None,
            "aktiv": True,
        },
    ]
    svc = _svc(tables)
    nur_a = _gen(svc, property_ids=["p-1"])
    labels = {p.label for p in nur_a.recurring}
    assert "Gartenpflege Hygge" not in labels
    # Der Posten OHNE Objekt gilt dem Eigentümer als Ganzem und bleibt.
    assert "Verwaltungspauschale" in labels


def test_verrechnungsposten_mit_objekt_ausserhalb_der_abrechnung_ist_422() -> None:
    svc = _svc(_tables_zwei_objekte())
    st = _gen(svc, property_ids=["p-1"])
    with pytest.raises(StatementError) as exc:
        svc.add_expense(
            _ctx(),
            ExpenseCreate(
                statement_id=st.id,
                listing_id="p-2",
                date=date(2026, 1, 15),
                concept="Reinigung Hygge",
                amount=80,
                direction="from_owner",
            ),
        )
    assert exc.value.status_code == 422


def test_auto_run_legt_alle_objekte_und_sprache_an() -> None:
    svc = _svc()
    svc._db.tables["owners"][0]["language"] = "da"
    svc.run_auto_statements(date(2026, 1, 1), date(2026, 1, 31))
    zeile = svc._db.tables["owner_statements"][0]
    assert zeile["property_ids"] is None
    assert zeile["language"] == "da"


# --- 13.4 Adressat anpassen ---------------------------------------------------


def test_header_aus_stammdaten_ersetzt_kopf_und_behaelt_nummer_und_notizen() -> None:
    svc = _svc()
    st = _gen(svc)
    st = svc.update(
        _ctx(),
        st.id,
        StatementUpdate(
            header=StatementHeader(
                owner_name="Erbengemeinschaft Owner", notes="Bitte per Post."
            )
        ),
    )
    assert st.header.owner_name == "Erbengemeinschaft Owner"
    # Stammdaten haben sich inzwischen geändert.
    svc._db.tables["owners"][0]["name"] = "Max Owner jun."
    st = svc.update(_ctx(), st.id, StatementUpdate(header_aus_stammdaten=True))
    assert st.header.owner_name == "Max Owner jun."
    # Was zu DIESEM Beleg gehört, bleibt.
    assert st.header.notes == "Bitte per Post."


# --- 13.5 Sprache des Belegs (0604) -------------------------------------------


def test_generate_friert_sprache_des_eigentuemers_ein() -> None:
    svc = _svc()
    svc._db.tables["owners"][0]["language"] = "da"
    st = _gen(svc)
    assert st.language == "da"
    # Der Eigentümer wechselt später — der Beleg bleibt, wie ausgestellt.
    svc._db.tables["owners"][0]["language"] = "sv"
    assert svc.get(_ctx(), st.id).language == "da"


def test_sprache_kette_betrieb_dann_englisch() -> None:
    svc = _svc()
    svc._db.tables["tenants"][0]["default_language"] = "sv"
    assert _gen(svc).language == "sv"
    ohne = _svc()
    assert _gen(ohne).language == "en"


def test_sprache_im_entwurf_aenderbar_unbekannter_code_422() -> None:
    svc = _svc()
    st = _gen(svc)
    st = svc.update(_ctx(), st.id, StatementUpdate(language="fr"))
    assert st.language == "fr"
    with pytest.raises(StatementError) as exc:
        svc.update(_ctx(), st.id, StatementUpdate(language="zz"))
    assert exc.value.status_code == 422


def test_beleg_von_vor_0604_bekommt_sprache_aus_der_kette() -> None:
    """NULL in der Spalte heißt „vor 0604", nicht „Deutsch" (Wurzel 4)."""
    svc = _svc()
    svc._db.tables["owners"][0]["language"] = "da"
    st = _gen(svc)
    for z in svc._db.tables["owner_statements"]:
        z["language"] = None
    assert svc.get(_ctx(), st.id).language == "da"


def test_storno_uebernimmt_sprache_objekte_und_sortierung() -> None:
    svc = _svc(_tables_zwei_objekte())
    svc._db.tables["owners"][0]["language"] = "da"
    st = _gen(svc, property_ids=["p-1"], sort_key="owner_payout", sort_dir="desc")
    _finalize(svc, st.id)
    storno = svc.cancel(_ctx(), st.id)
    assert storno.kind == "cancellation"
    assert storno.language == "da"
    assert storno.property_ids == ["p-1"]
    assert (storno.sort_key, storno.sort_dir) == ("owner_payout", "desc")


# --- 13.6 Sortierung (0604) ---------------------------------------------------


def test_sortierung_gilt_fuer_gespeicherte_abrechnung() -> None:
    svc = _svc(_tables_zwei_objekte())
    st = _gen(svc, sort_key="owner_payout", sort_dir="desc")
    werte = [r.owner_payout for r in st.rental_rows]
    assert werte == sorted(werte, reverse=True)
    # Nur den Schlüssel wechseln: die Richtung bleibt `desc` — und absteigend
    # nach Objekt heißt Villa vor Hygge.
    st = svc.update(_ctx(), st.id, StatementUpdate(sort_key="property"))
    titel = [r.listing for r in st.rental_rows]
    assert titel == sorted(titel, key=str.casefold, reverse=True)
    assert (st.sort_key, st.sort_dir) == ("property", "desc")
    # Richtung wechseln: jetzt Hygge zuerst.
    st = svc.update(_ctx(), st.id, StatementUpdate(sort_dir="asc"))
    assert [r.listing for r in st.rental_rows] == sorted(titel, key=str.casefold)


def test_sortierung_fehlende_werte_immer_am_ende() -> None:
    """Ein Eigentümer sieht den Gastpreis maskiert — die Zeilen ohne Zahl
    dürfen bei „absteigend" nicht nach oben rutschen."""
    svc = _svc(_tables_zwei_objekte())
    svc._db.tables["users"].append(
        {"id": "u-owner", "role": "owner", "permissions": []}
    )
    svc._db.tables["owners"][0]["user_id"] = "u-owner"
    st = _gen(svc, sort_key="gross", sort_dir="desc")
    _finalize(svc, st.id)
    ctx_owner = AuthContext(user_id="u-owner", tenant_id="t-1", role="owner")
    sicht = svc.get(ctx_owner, st.id)
    # Alle Gastpreise maskiert → Reihenfolge fällt auf Anreise zurück, nie
    # eine Exception, nie None vor Zahlen.
    assert [r.total_price for r in sicht.rental_rows] == [None] * len(sicht.rental_rows)
    assert [r.check_in for r in sicht.rental_rows] == sorted(
        r.check_in for r in sicht.rental_rows
    )


# --- 0605 Spaltenreihenfolge ---------------------------------------------------


def test_spaltenreihenfolge_wird_je_abrechnung_gespeichert_und_vervollstaendigt() -> None:
    """„wenn wir es verschieben wird es nicht an vorschau weitergeben"
    (07.09.2026): die Reihenfolge steht am Beleg, nicht im Browser."""
    svc = _svc()
    st = _gen(svc)
    # Standard: vollständig, in Enum-Reihenfolge, in der DB NULL.
    assert [c.value for c in st.column_order][:3] == ["guest", "listing", "check_in"]
    assert svc._db.tables["owner_statements"][0]["column_order"] is None

    st = svc.update(
        _ctx(), st.id, StatementUpdate(column_order=["owner_payout", "listing"])
    )
    werte = [c.value for c in st.column_order]
    # Die genannten zuerst, der Rest in Standardfolge hinten — immer vollständig.
    assert werte[:2] == ["owner_payout", "listing"]
    assert set(werte) == {c.value for c in ColumnKey} and len(werte) == len(ColumnKey)

    # Leere Liste = zurück auf Standard.
    st = svc.update(_ctx(), st.id, StatementUpdate(column_order=[]))
    assert [c.value for c in st.column_order] == [c.value for c in ColumnKey]
    assert svc._db.tables["owner_statements"][0]["column_order"] is None


def test_storno_uebernimmt_spaltenreihenfolge() -> None:
    svc = _svc()
    st = _gen(svc, column_order=["channel", "guest"])
    _finalize(svc, st.id)
    storno = svc.cancel(_ctx(), st.id)
    assert [c.value for c in storno.column_order][:2] == ["channel", "guest"]


# --- 13.3: Je-Objekt-Summen für Gesamtabrechnung und Auszug je Objekt ---------

def test_listing_rows_tragen_auszahlung_je_objekt_und_rest_ohne_objekt() -> None:
    """Σ je Objekt + Posten ohne Objektbezug = Gesamtsumme — sonst „fehlt" im
    Beleg Geld, das nur an keinem Haus hängt."""
    svc = _svc(_tables_zwei_objekte())
    st = _gen(svc)
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Reparatur Hygge",
            date=date(2026, 1, 10),
            direction=ExpenseDirection.from_owner,
            owner_id="o-1",
            listing_id="p-2",
            amount=50,
            statement_id=st.id,
        ),
    )
    svc.add_expense(
        _ctx(),
        ExpenseCreate(
            concept="Kompensation ohne Objekt",
            date=date(2026, 1, 11),
            direction=ExpenseDirection.to_owner,
            owner_id="o-1",
            amount=30,
            statement_id=st.id,
        ),
    )
    voll = svc.get(_ctx(), st.id)
    je = {lr.listing_id: lr for lr in voll.listing_rows}
    assert set(je) == {"p-1", "p-2"}
    assert je["p-2"].expenses_from_owner == 50.0
    assert je["p-2"].expenses_to_owner == 0.0
    assert je["p-1"].expenses_from_owner == 0.0
    assert je["p-2"].owner_payout is not None and je["p-1"].owner_payout is not None
    assert je["p-2"].payout == round(je["p-2"].owner_payout - 50.0, 2)
    assert je["p-1"].payout == je["p-1"].owner_payout
    assert voll.ohne_objekt.expenses_to_owner == 30.0
    assert voll.ohne_objekt.expenses_from_owner == 0.0
    summe = sum(lr.payout for lr in voll.listing_rows) + 30.0
    assert round(summe, 2) == voll.summary.owner_payout


def test_listing_rows_haben_zeile_fuer_objekt_ohne_buchung() -> None:
    """Auszug je Objekt existiert auch für ein Objekt ohne Buchung im Zeitraum."""
    tables = _tables_zwei_objekte()
    tables["reservations"] = [r for r in tables["reservations"] if r["property_id"] != "p-2"]
    st = _gen(_svc(tables))
    je = {lr.listing_id: lr for lr in st.listing_rows}
    assert "p-2" in je
    assert je["p-2"].reservations == 0
    assert je["p-2"].owner_payout == 0.0
    assert je["p-2"].payout == 0.0



# ----------------------------------------------------------------------
# Der Override ersetzt den SATZ, nicht die Rechnung (08.09.2026)
# ----------------------------------------------------------------------
# Anlass: eine echte Abrechnung des Betriebs (René Dahl Nielsen, FeWo Vidstrup
# Hygge, 28.07.–31.08.2026). Der Editor hatte den nur ANGEZEIGTEN Stammdaten-
# satz beim Speichern als `commission_pct` mitgeschickt; damit galt er als
# statement-weiter Override. Der Override zweigte VOR der Kette ab und rechnete
# `payout × (100−pct)/100`. Folgen im Beleg, alle drei zugleich:
#   * 7.237,82 DKK statt 4.020,58 DKK Auszahlung — 3.197,24 DKK zu viel, weil
#     80 % des GASTPREISES ausgezahlt wurden: auch 80 % der Reinigungsgebühr,
#     die dem Betrieb gehört, und ohne die 16,5 %, die Booking.com einbehält;
#   * in der Provisionsspalte stand „—", der Posten fehlte ganz. Eine Zahl ohne
#     Herleitung, die niemand nachrechnen kann;
#   * dazu der Satz „Das Portal hat keine Gebühren gemeldet" — eine Falsch-
#     aussage: Reinigung und Resort standen in den Stammdaten.
# Zum Override gab es KEINEN Test; deshalb fiel es erst am Beleg auf.


def test_override_ersetzt_nur_den_satz_nicht_die_kette() -> None:
    """Mit Override läuft dieselbe Kette — nur mit einem anderen Prozentsatz."""
    ohne = _zeile(_gen(_svc(_tables_volle_kette())), "r-2")
    mit = _zeile(_gen(_svc(_tables_volle_kette()), commission_pct=10), "r-2")

    # Jeder Posten der Kette ist da, nicht None: das ist der Kern.
    assert mit.auszahlungsbasis == ohne.auszahlungsbasis
    assert mit.bemessungsgrundlage == ohne.bemessungsgrundlage
    assert mit.verwaltungsprovision is not None
    # Halber Satz → halbe Provision, alles andere unverändert.
    assert mit.verwaltungsprovision == ohne.verwaltungsprovision / 2
    assert mit.provisions_pct == 10.0
    assert mit.provision_quelle == "override"
    # Die Gebühren-Aufteilung bleibt: Reinigung beim Betrieb, Resort beim
    # Eigentümer — vorher fehlte die Aufstellung mit dem Override komplett.
    assert {(g.art, g.gehoert_zu) for g in mit.gebuehren} == {
        (g.art, g.gehoert_zu) for g in ohne.gebuehren
    }
    # Und der Eigentümer bekommt MEHR, weil die Provision kleiner ist — aber
    # nicht den Portal-Anteil und nicht die Gebühren des Betriebs.
    assert mit.owner_payout > ohne.owner_payout
    assert mit.owner_payout < mit.auszahlungsbasis


def test_override_zahlt_nicht_den_gastpreis_aus() -> None:
    """Die Flachformel `payout × 0,8` darf NIE wieder das Ergebnis sein."""
    z = _zeile(_gen(_svc(_tables_volle_kette()), commission_pct=20), "r-2")
    assert z.total_payout is not None
    assert z.owner_payout != pytest.approx(z.total_payout * 0.8), (
        "Der Override rechnet wieder die Flachformel statt der Vertragskette"
    )
    # Gegenprobe, dass die Kette wirklich lief: die Reinigung des Betriebs
    # bleibt draußen, also liegt die Bemessung unter dem Gastpreis.
    assert z.bemessungsgrundlage is not None
    assert z.total_price is not None
    assert z.bemessungsgrundlage < z.total_price


def test_firmenname_des_eigentuemers_steht_im_kopf() -> None:
    """Ist der Eigentümer eine Gesellschaft, gehört SIE auf den Beleg (0610).

    Anlass (Betrieb, 08.09.2026): *„wenn eine Firmenadresse hinterlegt ist,
    warum wird sie nicht angezeigt"*. `owners.company` war gefüllt
    („Intentia ApS"), der Beleg zeigte aber nur `owners.name` — die
    Privatperson. Adresse, Moms-Nr. und E-Mail waren die der Firma, nur der
    Name nicht. Auf einem Dokument mit Moms-Nummer ist der Leistungsempfänger
    die Gesellschaft. Beim AUSSTELLER las der Code `legal_name` längst
    richtig; beim Eigentümer fehlte das Gegenstück.
    """
    svc = _svc()
    svc._db.tables["owners"][0]["company"] = "Intentia ApS"  # noqa: SLF001
    st = _gen(svc)
    assert st.header.owner_company == "Intentia ApS"
    # Der Name bleibt daneben stehen: die Person ist der Ansprechpartner.
    assert st.header.owner_name == "Max Owner"


def test_privatperson_hat_keinen_firmennamen() -> None:
    """Ohne `company` bleibt das Feld leer — kein Rückfall auf den Namen."""
    st = _gen(_svc())
    assert st.header.owner_company is None
    assert st.header.owner_name == "Max Owner"


# --- Satzwahl (aus _rental_rows herausgezogen, 10.09.2026) -------------------


def test_satz_waehlen_vorrang_und_regelsatz() -> None:
    """Vorrang Override → Vertrag → Altspalte, und JEDER Weg ergibt Regeln.

    Beim Herausziehen aus `_rental_rows` ging genau eine Bedingung verloren:
    der Regelsatz entstand nur noch aus der Altspalte, nicht mehr aus einem
    reinen Override. Drei Bestandstests fielen sofort um — die Zeile haette
    sonst „kein Provisionssatz hinterlegt" gemeldet, obwohl die Agentur einen
    Satz eingetragen hatte. Dieser Test haelt alle vier Faelle einzeln fest.
    """
    from decimal import Decimal

    from src.features.owner_statements import common
    from src.features.owner_statements.zeilen import _satz_waehlen

    vertrag = common.Vertragsregeln(provisions_pct=Decimal("20"))

    # 1) Nur Altspalte
    w = _satz_waehlen(None, None, Decimal("15"))
    assert (w.quelle, w.pct) == ("altspalten", Decimal("15"))
    assert w.regeln is not None and w.regeln.provisions_pct == Decimal("15")

    # 2) Vertrag schlaegt Altspalte
    w = _satz_waehlen(None, vertrag, Decimal("15"))
    assert w.quelle == "vertrag"
    assert w.regeln is vertrag

    # 3) Override schlaegt alles — und setzt gueltig_ab zurueck, weil er eine
    #    Einzelfall-Korrektur ist und nicht an einen Zeitraum gebunden.
    w = _satz_waehlen(Decimal("30"), vertrag, Decimal("15"))
    assert (w.quelle, w.pct) == ("override", Decimal("30"))
    assert w.regeln is not None
    assert w.regeln.provisions_pct == Decimal("30")
    assert w.regeln.gueltig_ab is None

    # 4) Override OHNE Vertrag und OHNE Altspalte — der verlorene Fall.
    w = _satz_waehlen(Decimal("25"), None, None)
    assert w.quelle == "override"
    assert w.regeln is not None, "Override allein muss Regeln ergeben"
    assert w.regeln.provisions_pct == Decimal("25")

    # 5) Gar nichts steht fest — kein erfundener Satz (Wurzel 4).
    w = _satz_waehlen(None, None, None)
    assert (w.quelle, w.pct, w.regeln) == (None, None, None)
