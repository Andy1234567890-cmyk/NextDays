"""Tests für den crm-Slice: Tenant-Scope, Status-Workflow, idempotente
Konvertierung, Deal-Regeln (Währungspflicht, Code-Eindeutigkeit), QR-Dateiregeln,
Rollen-Gate am Router."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from src.core.security import AuthContext, get_current_user
from src.features.crm import leads as leads_modul
from src.features.crm.common import CrmError
from src.features.crm.dependencies import get_crm_service
from src.features.crm.schemas import (
    DealCreate,
    DealUpdate,
    LeadConvertRequest,
    LeadCreate,
    LeadNoteCreate,
    LeadUpdate,
    PartnerCreate,
)
from src.features.crm.service import CrmService
from src.main import create_app

client = TestClient(create_app())


def test_crm_health() -> None:
    resp = client.get("/api/v1/crm/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "crm", "status": "ok"}


# --- In-Memory-Fake-DB (deckt die genutzten Query-Ketten ab) -----------------

class _Res:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    def __init__(self, store: dict, name: str, *, fehler: dict) -> None:
        self._store = store
        self._name = name
        self._fehler = fehler
        self._eq: dict = {}
        self._is_null: set[str] = set()
        self._or_needle: str | None = None
        self._ilike: tuple[str, str] | None = None
        self._op = "select"
        self._payload: dict | None = None
        self._count = False
        self._range: tuple[int, int] | None = None

    def select(self, *_a, **kw) -> _Query:
        self._count = kw.get("count") == "exact"
        return self

    def eq(self, col, val) -> _Query:  # noqa: ANN001
        self._eq[col] = val
        return self

    def is_(self, col, val) -> _Query:  # noqa: ANN001
        assert val == "null"
        self._is_null.add(col)
        return self

    def ilike(self, col, pattern) -> _Query:  # noqa: ANN001
        self._ilike = (col, pattern.strip("%").lower())
        return self

    def or_(self, filters: str) -> _Query:
        # name.ilike.%x%,email.ilike.%x%,… — den Suchbegriff herausziehen.
        self._or_needle = filters.split("ilike.%", 1)[1].split("%", 1)[0].lower()
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a, **_k) -> _Query:
        return self

    def range(self, start: int, end: int) -> _Query:
        self._range = (start, end)
        return self

    def insert(self, payload) -> _Query:  # noqa: ANN001
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload) -> _Query:  # noqa: ANN001
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    def execute(self) -> _Res:
        if self._fehler.get(self._name) and self._op in ("insert", "update"):
            raise self._fehler.pop(self._name)
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            row = {"id": f"{self._name}-{len(rows) + 1}", **self._payload}
            rows.append(row)
            return _Res([dict(row)])
        matched = [r for r in rows if self._matches(r)]
        if self._op == "update":
            for r in matched:
                r.update(self._payload)
            return _Res([dict(r) for r in matched])
        if self._op == "delete":
            self._store[self._name] = [r for r in rows if not self._matches(r)]
            return _Res([])
        total = len(matched)
        if self._range:
            matched = matched[self._range[0] : self._range[1] + 1]
        return _Res([dict(r) for r in matched], total if self._count else None)

    def _matches(self, row: dict) -> bool:
        if not all(row.get(c) == v for c, v in self._eq.items()):
            return False
        if any(row.get(c) is not None for c in self._is_null):
            return False
        if self._ilike and self._ilike[1] not in str(row.get(self._ilike[0], "")).lower():
            return False
        if self._or_needle is not None:
            felder = ("name", "email", "city", "object_city")
            if not any(self._or_needle in str(row.get(f) or "").lower() for f in felder):
                return False
        return True


class _FakeStorage:
    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.entfernt: list[str] = []

    def from_(self, _bucket: str) -> _FakeStorage:
        return self

    def upload(self, path: str, content: bytes, _opts: dict) -> None:
        self.dateien[path] = content

    def remove(self, paths: list[str]) -> None:
        self.entfernt.extend(paths)

    def create_signed_url(self, path: str, _ttl: int) -> dict:
        return {"signedURL": f"https://storage.test/signed/{path}"}


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store
        self.fehler: dict = {}
        self.storage = _FakeStorage()

    def table(self, name: str) -> _Query:
        return _Query(self._store, name, fehler=self.fehler)


def _service(**tables: list[dict]) -> tuple[CrmService, dict, _FakeDB]:
    store: dict = dict(tables)
    db = _FakeDB(store)
    return CrmService(service_client=db), store, db


def _ctx(tenant: str = "t1", role: str = "admin") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role=role)


# --- Tenant-Scope ---------------------------------------------------------------

def test_get_lead_rejects_foreign_tenant() -> None:
    svc, _, _ = _service(leads=[{"id": "l1", "tenant_id": "t2", "name": "Fremd", "status": "new"}])
    with pytest.raises(CrmError) as exc:
        svc.get_lead("t1", "l1")
    assert exc.value.status_code == 404


def test_list_leads_filters_tenant_status_and_search() -> None:
    svc, _, _ = _service(leads=[
        {"id": "l1", "tenant_id": "t1", "name": "Anna Berg", "status": "new"},
        {"id": "l2", "tenant_id": "t1", "name": "Bo Holm", "status": "contacted"},
        {"id": "l3", "tenant_id": "t2", "name": "Anna Fremd", "status": "new"},
    ])
    alle = svc.list_leads("t1")
    assert [x.id for x in alle.items] == ["l1", "l2"] and alle.total == 2
    nur_neu = svc.list_leads("t1", status="new")
    assert [x.id for x in nur_neu.items] == ["l1"]
    suche = svc.list_leads("t1", q="anna")
    assert [x.id for x in suche.items] == ["l1"]


def test_list_leads_caps_limit() -> None:
    svc, _, _ = _service()
    with pytest.raises(CrmError) as exc:
        svc.list_leads("t1", limit=201)
    assert exc.value.status_code == 422


def test_create_lead_stamps_tenant_status_new_and_first_note() -> None:
    svc, store, _ = _service(users=[{"id": "u-9", "tenant_id": "t1"}])
    lead = svc.create_lead(_ctx(), "t1", LeadCreate(
        name="Anna Berg", country="Dänemark", assigned_user_id="u-9",
        erste_notiz="Telefonat am Montag",
    ))
    assert lead.tenant_id == "t1" and lead.status == "new" and lead.country == "DK"
    assert store["lead_notes"][0]["lead_id"] == lead.id
    assert store["lead_notes"][0]["author_id"] == "u-1"


def test_create_lead_rejects_foreign_assignee() -> None:
    svc, _, _ = _service(users=[{"id": "u-9", "tenant_id": "t2"}])
    with pytest.raises(CrmError) as exc:
        svc.create_lead(_ctx(), "t1", LeadCreate(name="Anna", assigned_user_id="u-9"))
    assert exc.value.status_code == 422


# --- Status-Workflow -------------------------------------------------------------

def _lead(status: str = "new", **extra: object) -> dict:
    return {"id": "l1", "tenant_id": "t1", "name": "Anna", "status": status, **extra}


def test_status_forward_transition_allowed() -> None:
    svc, store, _ = _service(leads=[_lead("new")])
    out = svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="contacted"))
    assert out.status == "contacted" and store["leads"][0]["status"] == "contacted"


def test_status_skip_rejected() -> None:
    svc, _, _ = _service(leads=[_lead("new")])
    with pytest.raises(CrmError) as exc:
        svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="contract_sent"))
    assert exc.value.status_code == 422
    assert exc.value.details == {
        "von": "new", "nach": "contract_sent", "erlaubt": ["contacted", "lost"],
    }


def test_status_lost_requires_reason_and_reopen_clears_it() -> None:
    svc, store, _ = _service(leads=[_lead("contacted")])
    with pytest.raises(CrmError) as exc:
        svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="lost"))
    assert exc.value.status_code == 422
    assert exc.value.details == {"fehlende_felder": ["lost_reason"]}
    svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="lost", lost_reason="Verkauft"))
    assert store["leads"][0]["lost_reason"] == "Verkauft"
    svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="contacted"))
    assert store["leads"][0]["status"] == "contacted"
    assert store["leads"][0]["lost_reason"] is None


def test_status_won_only_via_convert() -> None:
    svc, _, _ = _service(leads=[_lead("contract_sent")])
    with pytest.raises(CrmError) as exc:
        svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="won"))
    assert exc.value.status_code == 422
    assert "convert" in exc.value.message


def test_won_is_terminal() -> None:
    svc, _, _ = _service(leads=[_lead("won", converted_owner_id="o1")])
    with pytest.raises(CrmError) as exc:
        svc.update_lead(_ctx(), "t1", "l1", LeadUpdate(status="contacted"))
    assert exc.value.status_code == 422


def test_notes_are_appended_and_scoped() -> None:
    svc, store, _ = _service(leads=[_lead("new")])
    svc.add_note(_ctx(), "t1", "l1", LeadNoteCreate(body=" Erste Notiz "))
    svc.add_note(_ctx(), "t1", "l1", LeadNoteCreate(body="Zweite"))
    assert [n["body"] for n in store["lead_notes"]] == ["Erste Notiz", "Zweite"]
    assert len(svc.list_notes("t1", "l1")) == 2
    with pytest.raises(CrmError):
        svc.list_notes("t2", "l1")


# --- Konvertierung ---------------------------------------------------------------

class _FakeOwners:
    """Ersetzt OwnersService im Modul leads: zählt Anlagen, liefert IDs."""

    angelegt: list[str] = []
    geloescht: list[str] = []
    zugeordnet: list[tuple[str, str]] = []

    def __init__(self, service_client) -> None:  # noqa: ANN001
        self._db = service_client

    def create(self, _ctx, req):  # noqa: ANN001, ANN201
        oid = f"o-{len(_FakeOwners.angelegt) + 1}"
        _FakeOwners.angelegt.append(req.name)
        return type("O", (), {"id": oid})()

    def delete(self, _ctx, owner_id: str) -> None:
        _FakeOwners.geloescht.append(owner_id)

    def assign_property(self, _ctx, owner_id: str, req):  # noqa: ANN001, ANN201
        _FakeOwners.zugeordnet.append((owner_id, req.property_id))


class _FakeProperties:
    angelegt: list[dict] = []

    def __init__(self, service_client) -> None:  # noqa: ANN001
        self._db = service_client

    def create(self, _ctx, req):  # noqa: ANN001, ANN201
        _FakeProperties.angelegt.append(req.model_dump())
        return type("P", (), {"id": f"p-{len(_FakeProperties.angelegt)}"})()

    def delete(self, _ctx, property_id: str) -> None:
        _FakeProperties.angelegt.append({"geloescht": property_id})


@pytest.fixture
def fake_slices(monkeypatch: pytest.MonkeyPatch) -> None:
    _FakeOwners.angelegt, _FakeOwners.geloescht, _FakeOwners.zugeordnet = [], [], []
    _FakeProperties.angelegt = []
    monkeypatch.setattr(leads_modul, "OwnersService", _FakeOwners)
    monkeypatch.setattr(leads_modul, "PropertiesService", _FakeProperties)


@pytest.mark.usefixtures("fake_slices")
def test_convert_requires_fields_for_property() -> None:
    svc, _, _ = _service(leads=[_lead("offer_sent", object_max_guests=None)])
    with pytest.raises(CrmError) as exc:
        svc.convert_lead(_ctx(), "t1", "l1", LeadConvertRequest(mit_objekt=True))
    assert exc.value.status_code == 422
    assert exc.value.details == {
        "fehlende_felder": ["property_title", "property_type", "object_max_guests"]
    }
    assert _FakeOwners.angelegt == []  # nichts halb angelegt


@pytest.mark.usefixtures("fake_slices")
def test_convert_is_idempotent_and_assigns_property() -> None:
    svc, store, _ = _service(leads=[_lead(
        "contract_sent", email="a@b.dk", object_max_guests=6, object_sqm=120,
        object_street="Strandvej", object_city="Blokhus", object_country="DK",
    )])
    req = LeadConvertRequest(
        mit_objekt=True, property_title="Strandhus", property_type="ferienhaus"
    )
    erst = svc.convert_lead(_ctx(), "t1", "l1", req)
    assert erst.owner_id == "o-1" and erst.property_id == "p-1"
    assert erst.bereits_konvertiert is False
    assert store["leads"][0]["status"] == "won"
    assert store["leads"][0]["converted_owner_id"] == "o-1"
    assert store["leads"][0]["converted_property_id"] == "p-1"
    assert _FakeOwners.zugeordnet == [("o-1", "p-1")]
    angelegt = _FakeProperties.angelegt[0]
    assert angelegt["title"] == "Strandhus" and angelegt["max_guests"] == 6
    assert angelegt["size_value"] == 120 and angelegt["size_unit"] == "sqm"
    assert angelegt["city"] == "Blokhus" and angelegt["country"] == "DK"

    zweit = svc.convert_lead(_ctx(), "t1", "l1", req)
    assert (zweit.owner_id, zweit.property_id) == ("o-1", "p-1")
    assert zweit.bereits_konvertiert is True
    assert _FakeOwners.angelegt == ["Anna"]  # genau EIN Eigentümer
    assert len(_FakeProperties.angelegt) == 1  # genau EIN Objekt


@pytest.mark.usefixtures("fake_slices")
def test_convert_lost_lead_rejected() -> None:
    svc, _, _ = _service(leads=[_lead("lost", lost_reason="x")])
    with pytest.raises(CrmError) as exc:
        svc.convert_lead(_ctx(), "t1", "l1", LeadConvertRequest())
    assert exc.value.status_code == 409


# --- Partner & Deals -------------------------------------------------------------

def test_partner_scope_and_create() -> None:
    svc, store, _ = _service(partners=[{"id": "pa2", "tenant_id": "t2", "name": "Fremd"}])
    assert svc.list_partners("t1") == []
    p = svc.create_partner("t1", PartnerCreate(name="Fårup Sommerland", country="dk"), by="u-1")
    assert p.tenant_id == "t1" and p.country == "DK"
    assert len(store["partners"]) == 2
    with pytest.raises(CrmError) as exc:
        svc.get_partner("t1", "pa2")
    assert exc.value.status_code == 404


def test_deal_fixed_requires_currency_no_guessing() -> None:
    with pytest.raises(ValueError, match="Währung"):
        DealCreate(discount_kind="fixed", discount_value=50)
    ok = DealCreate(discount_kind="fixed", discount_value=50, currency="dkk")
    assert ok.currency == "DKK"


def test_deal_percent_rules() -> None:
    with pytest.raises(ValueError, match="100"):
        DealCreate(discount_kind="percent", discount_value=120)
    with pytest.raises(ValueError, match="Währung"):
        DealCreate(discount_kind="percent", discount_value=10, currency="EUR")


def test_deal_update_validates_merged_state() -> None:
    svc, _, _ = _service(
        partners=[{"id": "pa1", "tenant_id": "t1", "name": "Café Fisk"}],
        deals=[{
            "id": "d1", "tenant_id": "t1", "partner_id": "pa1",
            "discount_kind": "percent", "discount_value": 10, "currency": None,
            "discount_code": "FISK10", "gueltig_von": None, "gueltig_bis": None,
            "im_gastportal_sichtbar": False,
        }],
    )
    # Wechsel auf fixed OHNE Währung → 422, obwohl nur EIN Feld gesendet wurde.
    with pytest.raises(CrmError) as exc:
        svc.update_deal("t1", "d1", DealUpdate(discount_kind="fixed"), by="u-1")
    assert exc.value.status_code == 422
    out = svc.update_deal(
        "t1", "d1", DealUpdate(discount_kind="fixed", currency="DKK"), by="u-1"
    )
    assert out.discount_kind == "fixed" and out.currency == "DKK"


def test_deal_duplicate_code_is_409() -> None:
    svc, _, db = _service(partners=[{"id": "pa1", "tenant_id": "t1", "name": "Café Fisk"}])
    db.fehler["deals"] = APIError({"message": "duplicate key", "code": "23505"})
    with pytest.raises(CrmError) as exc:
        svc.create_deal(
            "t1", "pa1",
            DealCreate(discount_kind="percent", discount_value=10, discount_code="FISK10"),
            by="u-1",
        )
    assert exc.value.status_code == 409


def test_deal_requires_own_partner() -> None:
    svc, _, _ = _service(partners=[{"id": "pa2", "tenant_id": "t2", "name": "Fremd"}])
    with pytest.raises(CrmError) as exc:
        svc.create_deal("t1", "pa2", DealCreate(discount_kind="percent", discount_value=5), by="u")
    assert exc.value.status_code == 404


# --- QR-Dateiregeln --------------------------------------------------------------

_DEAL = {
    "id": "d1", "tenant_id": "t1", "partner_id": "pa1", "discount_kind": "percent",
    "discount_value": 10, "currency": None, "discount_code": "FISK10",
    "gueltig_von": None, "gueltig_bis": None, "im_gastportal_sichtbar": False,
    "qr_code_path": None,
}


def test_qr_upload_rejects_html_declared_as_png() -> None:
    svc, _, db = _service(deals=[dict(_DEAL)])
    with pytest.raises(CrmError) as exc:
        svc.upload_qr("t1", "d1", b"<html><script>alert(1)</script></html>", by="u-1")
    assert exc.value.status_code == 415
    assert db.storage.dateien == {}


def test_qr_upload_rejects_oversize_and_empty() -> None:
    svc, _, _ = _service(deals=[dict(_DEAL)])
    with pytest.raises(CrmError) as gross:
        svc.upload_qr("t1", "d1", b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024), by="u-1")
    assert gross.value.status_code == 413
    with pytest.raises(CrmError) as leer:
        svc.upload_qr("t1", "d1", b"", by="u-1")
    assert leer.value.status_code == 415


def test_qr_upload_png_stores_path_and_replaces_old() -> None:
    svc, store, db = _service(deals=[{**_DEAL, "qr_code_path": "t1/pa1/d1/alt.png"}])
    out = svc.upload_qr("t1", "d1", b"\x89PNG\r\n\x1a\n" + b"bild", by="u-1")
    assert out.hat_qr_bild is True
    pfad = store["deals"][0]["qr_code_path"]
    assert pfad.startswith("t1/pa1/d1/") and pfad.endswith(".png")
    assert pfad in db.storage.dateien
    assert db.storage.entfernt == ["t1/pa1/d1/alt.png"]


def test_qr_upload_svg_is_sanitized() -> None:
    svc, store, db = _service(deals=[dict(_DEAL)])
    svg = (
        b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">'
        b'<script>alert(1)</script><rect width="10" height="10" onclick="x()"/></svg>'
    )
    svc.upload_qr("t1", "d1", svg, by="u-1")
    pfad = store["deals"][0]["qr_code_path"]
    abgelegt = db.storage.dateien[pfad]
    assert pfad.endswith(".svg")
    assert b"<script" not in abgelegt and b"onclick" not in abgelegt
    assert b"<rect" in abgelegt


def test_qr_url_is_signed_and_requires_upload() -> None:
    svc, _, _ = _service(deals=[dict(_DEAL)])
    with pytest.raises(CrmError) as exc:
        svc.qr_url("t1", "d1")
    assert exc.value.status_code == 404
    svc2, _, _ = _service(deals=[{**_DEAL, "qr_code_path": "t1/pa1/d1/x.png"}])
    url, ttl = svc2.qr_url("t1", "d1")
    assert url.startswith("https://storage.test/signed/") and ttl == 600


def test_qr_png_generated_from_code_and_requires_code() -> None:
    svc, _, _ = _service(deals=[dict(_DEAL)])
    png = svc.qr_png("t1", "d1")
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    svc2, _, _ = _service(deals=[{**_DEAL, "discount_code": None}])
    with pytest.raises(CrmError) as exc:
        svc2.qr_png("t1", "d1")
    assert exc.value.status_code == 409


def test_delete_partner_removes_qr_files() -> None:
    svc, store, db = _service(
        partners=[{"id": "pa1", "tenant_id": "t1", "name": "Café Fisk"}],
        deals=[{**_DEAL, "qr_code_path": "t1/pa1/d1/x.png"}],
    )
    svc.delete_partner("t1", "pa1", by="u-1")
    assert store["partners"] == []
    assert db.storage.entfernt == ["t1/pa1/d1/x.png"]


# --- Rollen-Gate am Router (MANAGE_CRM) ------------------------------------------

def _router_client(role: str) -> TestClient:
    app = create_app()
    svc, _, _ = _service(leads=[_lead("new")])
    app.dependency_overrides[get_current_user] = lambda: _ctx(role=role)
    app.dependency_overrides[get_crm_service] = lambda: svc
    return TestClient(app)


@pytest.mark.parametrize("role", ["cleaner", "staff", "owner", "shift_lead"])
def test_router_denies_operational_roles(role: str) -> None:
    resp = _router_client(role).get("/api/v1/crm/leads")
    assert resp.status_code == 403


@pytest.mark.parametrize("role", ["admin", "co_admin"])
def test_router_allows_management_roles(role: str) -> None:
    resp = _router_client(role).get("/api/v1/crm/leads")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


def test_router_422_carries_missing_fields() -> None:
    c = _router_client("admin")
    resp = c.post("/api/v1/crm/leads/l1/convert", json={"mit_objekt": True})
    assert resp.status_code == 422
    assert resp.json()["detail"]["fehlende_felder"] == [
        "property_title", "property_type", "object_max_guests"
    ]
