"""Tests für den guests-Slice (Enterprise-Gästekarte).

Flexible In-Memory-Fake-DB (deckt die genutzten Supabase-Query-Ketten ab) +
Masking-Matrix über echte feingranulare Berechtigungen (load_guest_mask liest `users`).
"""
import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.guests.schemas import (
    ConsentCreate,
    GuestCreate,
    GuestUpdate,
    IdentityDocCreate,
)
from src.features.guests.service import GuestsError, GuestsService
from src.main import create_app

client = TestClient(create_app())


def test_guests_health() -> None:
    resp = client.get("/api/v1/guests/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "guests", "status": "ok"}


# --- In-Memory-Fake-DB ------------------------------------------------------
class _Res:
    def __init__(self, data, count=None) -> None:  # noqa: ANN001
        self.data = data
        self.count = count


class _Query:
    """Deckt select/insert/update/delete/upsert + Filter/Order/Range ab."""

    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._rows = store.setdefault(name, [])
        self._op = "select"
        self._eq: dict = {}
        self._in: tuple | None = None
        self._or: str | None = None
        self._payload = None
        self._count = None

    def select(self, *_a, count=None, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        self._count = count
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        return self

    def delete(self):  # noqa: ANN201
        self._op = "delete"
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, list(vals))
        return self

    def or_(self, expr):  # noqa: ANN001, ANN201
        self._or = expr
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def range(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def _match(self, r):  # noqa: ANN001, ANN202
        for c, v in self._eq.items():
            if r.get(c) != v:
                return False
        if self._in:
            col, vals = self._in
            if r.get(col) not in vals:
                return False
        if self._or:
            # einfache ilike-OR-Suche über die genannten Spalten
            ok = False
            for t in self._or.split(","):
                col, _op, pat = t.split(".", 2)
                needle = pat.strip("%").lower()
                if needle in str(r.get(col) or "").lower():
                    ok = True
            if not ok:
                return False
        return True

    def execute(self):  # noqa: ANN201
        import uuid

        if self._op == "select":
            rows = [r for r in self._rows if self._match(r)]
            return _Res(list(rows), count=len(rows) if self._count else None)
        if self._op in ("insert", "upsert"):
            payloads = (
                self._payload if isinstance(self._payload, list) else [self._payload]
            )
            out = []
            for p in payloads:
                row = dict(p)
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", "2026-06-23T00:00:00Z")
                row.setdefault("updated_at", "2026-06-23T00:00:00Z")
                if self._op == "upsert":
                    self._rows[:] = [
                        x for x in self._rows
                        if x.get("guest_id") != row.get("guest_id")
                    ]
                self._rows.append(row)
                out.append(row)
            return _Res(out)
        if self._op == "update":
            updated = []
            for r in self._rows:
                if self._match(r):
                    r.update(self._payload)
                    updated.append(r)
            return _Res(updated)
        if self._op == "delete":
            removed = [r for r in self._rows if self._match(r)]
            self._rows[:] = [r for r in self._rows if not self._match(r)]
            return _Res(removed)
        return _Res([])


class _FakeDB:
    def __init__(self, store) -> None:  # noqa: ANN001
        self._store = store

    def table(self, name):  # noqa: ANN001, ANN201
        return _Query(self._store, name)


# Berechtigungssätze. access_pm_features ist das PM-Dach: ohne es fallen
# pm_guest_details/pm_booking_total weg (effective_permissions) — in der echten
# App kommt pm_* nie ohne das Dach.
_PERMS_FULL = [
    "access_pm_features",
    "pm_guest_details", "edit_guest", "view_guest_name", "view_guest_contact",
    "view_guest_id_docs", "view_booking_source", "pm_booking_total",
]
_PERMS_LIMITED = ["access_pm_features", "pm_guest_details"]  # Zugriff, alles maskiert


def _svc(store=None, *, role="admin", perms=None) -> GuestsService:  # noqa: ANN001
    store = store if store is not None else {}
    store.setdefault("users", []).append({
        "id": "u", "tenant_id": "t1", "full_name": "Tester", "email": "t@x.de",
        "role": role, "permissions": _PERMS_FULL if perms is None else perms,
    })
    return GuestsService(service_client=_FakeDB(store))


_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


def _guest_row(tenant="t1", **over):  # noqa: ANN001, ANN201
    base = {
        "id": "g1", "tenant_id": tenant, "name": "Anna Müller",
        "first_name": "Anna", "last_name": "Müller", "email": "anna@x.de",
        "phone": "+49 170", "company": "ACME", "vip_code": "GOLD",
        "segment": "business", "is_blocked": False, "stays_count": 3,
        "last_stay_at": "2026-05-01", "total_revenue": 1200, "source": "Direct",
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
    }
    base.update(over)
    return base


# --- CRUD -------------------------------------------------------------------
def test_create_derives_name_from_first_last() -> None:
    svc = _svc()
    out = svc.create(_CTX, GuestCreate(first_name="Max", last_name="Muster"))
    assert out.name == "Max Muster"


def test_get_404_when_foreign_tenant() -> None:
    store = {"guests": [_guest_row(tenant="other")]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.get(_CTX, "g1")
    assert exc.value.status_code == 404


def test_update_changes_fields() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    out = svc.update(_CTX, "g1", GuestUpdate(segment="leisure"))
    assert out.segment == "leisure"


# --- Suche / Filter ---------------------------------------------------------
def test_list_search_matches_name() -> None:
    store = {"guests": [_guest_row(), _guest_row(id="g2", name="Bob", email="b@x.de")]}
    svc = _svc(store)
    out = svc.list(_CTX, q="anna")
    assert [i.id for i in out.items] == ["g1"]


def test_list_filter_blocked() -> None:
    store = {"guests": [
        _guest_row(), _guest_row(id="g2", name="Block", is_blocked=True),
    ]}
    svc = _svc(store)
    out = svc.list(_CTX, blocked=True)
    assert [i.id for i in out.items] == ["g2"]


# --- Masking-Matrix ---------------------------------------------------------
def test_admin_sees_full_name_contact_amount() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="admin", perms=_PERMS_LIMITED)  # admin = alles trotzdem
    out = svc.get(_CTX, "g1")
    assert out.name == "Anna Müller"
    assert out.email == "anna@x.de"
    assert out.total_revenue == 1200.0


def test_limited_role_masks_name_contact_amount() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    out = svc.get(ctx, "g1")
    assert out.name == "Anna"          # nur Vorname
    assert out.email is None           # kein Kontakt
    assert out.last_name is None       # Nachname verborgen
    assert out.total_revenue is None   # kein Betrag


def test_id_docs_masked_without_permission() -> None:
    store = {
        "guests": [_guest_row()],
        "guest_identity_documents": [{
            "id": "d1", "tenant_id": "t1", "guest_id": "g1",
            "doc_type": "passport", "number": "P1234567",
            "issuing_country": "DE", "valid_until": "2030-01-01",
        }],
    }
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    out = svc.list_identity_docs(ctx, "g1")
    assert out.items[0].number == "••• 4567"   # maskiert


def test_id_docs_full_with_permission() -> None:
    store = {
        "guests": [_guest_row()],
        "guest_identity_documents": [{
            "id": "d1", "tenant_id": "t1", "guest_id": "g1",
            "doc_type": "passport", "number": "P1234567",
        }],
    }
    svc = _svc(store)  # admin
    out = svc.list_identity_docs(_CTX, "g1")
    assert out.items[0].number == "P1234567"


def test_add_id_doc_denied_without_permission() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    with pytest.raises(GuestsError) as exc:
        svc.add_identity_doc(
            ctx, "g1", IdentityDocCreate(doc_type="id_card", number="X1")
        )
    assert exc.value.status_code == 403


# --- Consent append-only ----------------------------------------------------
def test_consent_append_only_keeps_history() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    svc.add_consent(_CTX, "g1", ConsentCreate(
        consent_type="marketing_email", status="granted",
    ))
    svc.add_consent(_CTX, "g1", ConsentCreate(
        consent_type="marketing_email", status="revoked",
    ))
    out = svc.list_consents(_CTX, "g1")
    assert out.total == 2  # beide Einträge erhalten (kein Update)


def test_consent_rejects_invalid_status() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.add_consent(_CTX, "g1", ConsentCreate(
            consent_type="x", status="maybe",
        ))
    assert exc.value.status_code == 422


# --- DSGVO-Löschung / Anonymisierung ----------------------------------------
def test_delete_hard_when_no_reservation() -> None:
    store = {"guests": [_guest_row()], "reservations": []}
    svc = _svc(store)
    out = svc.delete(_CTX, "g1")
    assert out == {"deleted": True}
    assert store["guests"] == []


def test_delete_anonymizes_when_reservation_exists() -> None:
    store = {
        "guests": [_guest_row()],
        "reservations": [{"id": "r1", "tenant_id": "t1", "guest_id": "g1"}],
        "guest_identity_documents": [
            {"id": "d1", "tenant_id": "t1", "guest_id": "g1", "number": "X"}
        ],
    }
    svc = _svc(store)
    out = svc.delete(_CTX, "g1")
    assert out == {"anonymized": True}
    g = store["guests"][0]
    assert g["name"] == "Anonymisiert" and g["email"] is None
    assert g["anonymized_at"] is not None
    assert store["guest_identity_documents"] == []  # sensible Daten entfernt


# --- Cross-Tenant-Isolation -------------------------------------------------
def test_cross_tenant_list_isolated() -> None:
    store = {"guests": [_guest_row(), _guest_row(id="g2", tenant="t2", name="Fremd")]}
    svc = _svc(store)
    out = svc.list(_CTX)
    assert [i.id for i in out.items] == ["g1"]  # nur eigener Tenant


def test_cross_tenant_subresource_404() -> None:
    store = {"guests": [_guest_row(tenant="t2")]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.list_notes(_CTX, "g1")
    assert exc.value.status_code == 404


# --- Merge ------------------------------------------------------------------
def test_merge_reparents_subresources_and_anonymizes_source() -> None:
    store = {
        "guests": [
            _guest_row(id="g1", email="dup@x.de", name="Anna (Dublette)"),
            _guest_row(id="g2", email="anna@x.de", name="Anna Müller"),
        ],
        "guest_addresses": [
            {"id": "a1", "tenant_id": "t1", "guest_id": "g1", "city": "Berlin"},
        ],
        "reservations": [
            {"id": "r1", "tenant_id": "t1", "guest_id": "g1"},
        ],
        "channex_booking": [
            {"id": "b1", "tenant_id": "t1", "guest_id": "g1"},
        ],
        "guest_external_ids": [
            {"id": "e1", "tenant_id": "t1", "guest_id": "g1",
             "channel": "ota", "external_id": "X"},
        ],
    }
    svc = _svc(store)
    out = svc.merge(_CTX, "g1", "g2")
    assert out == {"merged": True, "target_id": "g2"}

    # Sub-Ressourcen + Reservierung + Buchung hängen jetzt am Ziel.
    assert store["guest_addresses"][0]["guest_id"] == "g2"
    assert store["reservations"][0]["guest_id"] == "g2"
    assert store["channex_booking"][0]["guest_id"] == "g2"
    # Personenbezogene externe IDs der Quelle wurden verworfen (DSGVO).
    assert store["guest_external_ids"] == []
    # Quell-Gast ist anonymisiert, Ziel unverändert.
    src = next(g for g in store["guests"] if g["id"] == "g1")
    assert src["email"] is None
    assert src["anonymized_at"] is not None
    tgt = next(g for g in store["guests"] if g["id"] == "g2")
    assert tgt["email"] == "anna@x.de"


def test_merge_rejects_same_source_and_target() -> None:
    svc = _svc(store={"guests": [_guest_row(id="g1")]})
    with pytest.raises(GuestsError) as exc:
        svc.merge(_CTX, "g1", "g1")
    assert exc.value.status_code == 400


def test_merge_404_when_guest_foreign() -> None:
    store = {"guests": [_guest_row(id="g1")]}  # g2 fehlt
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.merge(_CTX, "g1", "g2")
    assert exc.value.status_code == 404


# --- EDIT_GUEST-Berechtigung (Schreibrecht) ---------------------------------
def test_edit_guest_default_assignment() -> None:
    from src.features.auth.granular_permissions import (
        Permission,
        default_permissions_for,
    )
    from src.features.auth.schemas import UserRole

    # Admin = alle, co_admin per Default; staff/owner NICHT.
    assert "edit_guest" in default_permissions_for(UserRole.admin)
    assert "edit_guest" in default_permissions_for(UserRole.co_admin)
    assert "edit_guest" not in default_permissions_for(UserRole.staff)
    assert "edit_guest" not in default_permissions_for(UserRole.owner)
    assert Permission.EDIT_GUEST.value == "edit_guest"
