"""Tests für den site_config-Slice.

Leichtgewichtiges Fake-DB-Mock (Muster wie addons.tests) + Fake-CloudflareClient
(kein Netz, keine Secrets, keine echten Custom-Hostnames). Prüft die Slice-Logik:
kein Cross-Tenant-Leak, Domain-Unique, Verify-/Sync-Flow, Tenant-Scope, kein
Secret-Leak. Das echte Cloudflare-Verhalten wird separat end-to-end verifiziert.
"""
from __future__ import annotations

import logging

import pytest

from src.core.security import AuthContext
from src.features.site_config.schemas import (
    BrandingUpdate,
    DomainCreate,
    PublicSiteResponse,
)
from src.features.site_config.service import SiteConfigError, SiteConfigService


# --- Fake-DB-Mock ------------------------------------------------------------
class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: list[dict] | dict | None = None
        self._conflict: str | None = None
        self._filters: list[tuple[str, object]] = []

    def select(self, *_cols: object, **_k: object) -> _Query:
        self._op = "select"
        return self

    def insert(self, payload: list[dict] | dict) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload: dict, *, on_conflict: str | None = None) -> _Query:
        self._op = "upsert"
        self._payload = payload
        self._conflict = on_conflict
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

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def _match(self, row: dict) -> bool:
        return all(str(row.get(c)) == str(v) for c, v in self._filters)

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            new = self._payload if isinstance(self._payload, list) else [self._payload]
            created = []
            for i, p in enumerate(new):
                row = dict(p)
                row.setdefault("id", f"{self._table}-{len(rows) + i + 1}")
                rows.append(row)
                created.append(row)
            return _Result(created)
        if self._op == "upsert":
            assert isinstance(self._payload, dict)
            key = self._conflict or "id"
            kval = self._payload.get(key)
            for r in rows:
                if str(r.get(key)) == str(kval):
                    r.update(self._payload)
                    return _Result([r])
            row = dict(self._payload)
            row.setdefault("id", f"{self._table}-{len(rows) + 1}")
            rows.append(row)
            return _Result([row])
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(selected)
        return _Result(selected)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _Query:
        return _Query(self, name)


# --- Fake-Cloudflare-Client --------------------------------------------------
class _FakeCloudflare:
    """Simuliert die Custom-Hostnames-API ohne Netz."""

    def __init__(self, *, fallback: str = "origin.mynextdays.de") -> None:
        self.fallback_origin = fallback
        self._counter = 0
        self.deleted: list[str] = []
        self.next_status = "pending"  # für sync-Tests umstellbar

    def create_custom_hostname(self, domain: str) -> dict:
        self._counter += 1
        return {
            "id": f"cf-{self._counter}",
            "status": "pending",
            "ssl": {
                "status": "pending_validation",
                "validation_records": [
                    {
                        "txt_name": f"_cf-custom-hostname.{domain}",
                        "txt_value": "abc123-validation-token",
                    }
                ],
            },
        }

    def get_custom_hostname(self, hostname_id: str) -> dict:
        # Standard: aktiv (für den Happy-Path-Sync).
        return {
            "id": hostname_id,
            "status": "active",
            "ssl": {"status": "active", "validation_records": []},
        }

    def delete_custom_hostname(self, hostname_id: str) -> None:
        self.deleted.append(hostname_id)


def _svc(tables: dict[str, list[dict]], cf: _FakeCloudflare | None = None):
    return SiteConfigService(
        service_client=_DB(tables),  # type: ignore[arg-type]
        cloudflare=cf or _FakeCloudflare(),  # type: ignore[arg-type]
    )


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


# --- 1. Kein Cross-Tenant-Leak im öffentlichen Resolver ----------------------
def test_resolve_returns_only_public_fields() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [
            {
                "tenant_id": "t-A",
                "site_name": "Agentur A",
                "primary_color": "#112233",
                "booking_mode": "instant",
                "social_links": {},
            }
        ],
    }
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert isinstance(out, PublicSiteResponse)
    assert out.tenant_id == "t-A"
    assert out.site_name == "Agentur A"
    # PublicSiteResponse trägt KEIN cf_*/status-Feld.
    dumped = out.model_dump()
    assert "cf_custom_hostname_id" not in dumped
    assert "status" not in dumped
    assert "ssl_status" not in dumped


def test_resolve_unknown_domain_404() -> None:
    with pytest.raises(SiteConfigError) as exc:
        _svc({"tenant_custom_domains": []}).resolve_site_by_domain("nope.de")
    assert exc.value.status_code == 404


def test_resolve_ignores_pending_domain() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "pending"}
        ],
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).resolve_site_by_domain("a.de")
    assert exc.value.status_code == 404


def test_resolve_no_cross_tenant() -> None:
    """Domain von Tenant A liefert nie Branding von Tenant B."""
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [
            {"tenant_id": "t-A", "site_name": "A", "social_links": {}},
            {"tenant_id": "t-B", "site_name": "B", "social_links": {}},
        ],
    }
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.tenant_id == "t-A"
    assert out.site_name == "A"


# --- 2. Domain-Unique inkl. Groß/Klein ---------------------------------------
def test_add_domain_duplicate_409() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-2", "domain": "shared.de", "status": "active"}
        ]
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).add_domain(_ctx(), DomainCreate(domain="shared.de"))
    assert exc.value.status_code == 409


def test_add_domain_duplicate_case_insensitive_409() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-2", "domain": "shared.de", "status": "active"}
        ]
    }
    # Schema normalisiert auf lowercase → trifft denselben Unique-Key.
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).add_domain(_ctx(), DomainCreate(domain="SHARED.DE"))
    assert exc.value.status_code == 409


# --- 3. add/sync mit Fake-Cloudflare -----------------------------------------
def test_add_domain_returns_cname_and_txt() -> None:
    cf = _FakeCloudflare()
    svc = _svc({"tenant_custom_domains": []}, cf)
    res = svc.add_domain(_ctx(), DomainCreate(domain="neu.de"))
    assert res.status == "pending"
    types = {r.type for r in res.dns_records}
    assert types == {"CNAME", "TXT"}
    cname = next(r for r in res.dns_records if r.type == "CNAME")
    assert cname.value == "origin.mynextdays.de"


def test_sync_domain_flips_to_active() -> None:
    tables = {
        "tenant_custom_domains": [
            {
                "id": "d1",
                "tenant_id": "t-1",
                "domain": "neu.de",
                "cf_custom_hostname_id": "cf-1",
                "status": "pending",
            }
        ]
    }
    res = _svc(tables).sync_domain(_ctx(), "d1")
    assert res.status == "active"


# --- 4. Tenant-Scope ----------------------------------------------------------
def test_no_tenant_400() -> None:
    with pytest.raises(SiteConfigError) as exc:
        _svc({}).get_branding(_ctx(tenant=None))
    assert exc.value.status_code == 400


def test_sync_foreign_domain_404() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-OTHER", "domain": "x.de", "status": "active"}
        ]
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).sync_domain(_ctx(tenant="t-1"), "d1")
    assert exc.value.status_code == 404


def test_set_and_get_branding_roundtrip() -> None:
    svc = _svc({"tenant_site_config": []})
    svc.set_branding(_ctx(), BrandingUpdate(site_name="Meine Agentur", primary_color="#aabbcc"))
    got = svc.get_branding(_ctx())
    assert got.site_name == "Meine Agentur"
    assert got.primary_color == "#aabbcc"


# --- 5. Kein Secret/Token im Log ---------------------------------------------
def test_add_domain_does_not_log_token(caplog: pytest.LogCaptureFixture) -> None:
    cf = _FakeCloudflare()
    svc = _svc({"tenant_custom_domains": []}, cf)
    with caplog.at_level(logging.DEBUG):
        svc.add_domain(_ctx(), DomainCreate(domain="neu.de"))
    joined = " ".join(r.getMessage() for r in caplog.records)
    assert "abc123-validation-token" not in joined
