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
    BlockCreate,
    BlockType,
    BlockUpdate,
    BrandingUpdate,
    DomainCreate,
    PageCreate,
    PublicSiteResponse,
)
from src.features.site_config.service import SiteConfigError, SiteConfigService


@pytest.fixture(autouse=True)
def _draft_secret_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Draft-Token-Signatur braucht ein gesetztes SITE_DRAFT_SECRET (fail-closed
    ohne, seit dem Hardcode-Fallback-Fix). In Prod als Env gesetzt; hier für die
    Tests injizieren, damit sie den realen Signaturpfad prüfen."""
    from src.core.config import get_settings

    monkeypatch.setenv("SITE_DRAFT_SECRET", "test-draft-secret-not-a-real-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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
        self._neq: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._order: tuple[str, bool] | None = None

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

    def neq(self, col: str, val: object) -> _Query:
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._in = (col, vals)
        return self

    def order(self, col: str = "", *, desc: bool = False, **_k: object) -> _Query:
        if col:
            self._order = (col, desc)
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def _match(self, row: dict) -> bool:
        if not all(str(row.get(c)) == str(v) for c, v in self._filters):
            return False
        if any(str(row.get(c)) == str(v) for c, v in self._neq):
            return False
        if self._in is not None:
            col, vals = self._in
            if row.get(col) not in vals:
                return False
        return True

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            new = self._payload if isinstance(self._payload, list) else [self._payload]
            created = []
            for i, p in enumerate(new):
                row = dict(p)
                row.setdefault("id", f"{self._table}-{len(rows) + i + 1}")
                # DB-Spalten-Defaults nachbilden (wie Postgres NOT NULL DEFAULT).
                if self._table == "site_pages":
                    row.setdefault("is_home", False)
                    row.setdefault("is_published", False)
                    row.setdefault("nav_order", 0)
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
        if self._order is not None:
            col, desc = self._order
            selected = sorted(
                selected, key=lambda r: r.get(col) or 0, reverse=desc
            )
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


# === Page-Builder: Seiten + Blöcke ==========================================
def test_create_first_page_is_home() -> None:
    svc = _svc({"site_pages": []})
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    assert page.is_home is True
    # Zweite Seite ist NICHT automatisch Home.
    page2 = svc.create_page(_ctx(), PageCreate(title="Über", slug="ueber"))
    assert page2.is_home is False


def test_page_slug_unique_per_tenant_409() -> None:
    svc = _svc({"site_pages": []})
    svc.create_page(_ctx(), PageCreate(title="A", slug="x"))
    with pytest.raises(SiteConfigError) as exc:
        svc.create_page(_ctx(), PageCreate(title="B", slug="x"))
    assert exc.value.status_code == 409


def test_set_home_page_dethrones_others() -> None:
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": False, "nav_order": 0},
            {"id": "p2", "tenant_id": "t-1", "slug": "b", "title": "B",
             "is_home": False, "is_published": False, "nav_order": 0},
        ]
    }
    svc = _svc(tables)
    svc.set_home_page(_ctx(), "p2")
    homes = [p for p in tables["site_pages"] if p["is_home"]]
    assert len(homes) == 1 and homes[0]["id"] == "p2"


def test_page_tenant_scope_404() -> None:
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-OTHER", "slug": "", "title": "A",
             "is_home": True, "is_published": True, "nav_order": 0}
        ]
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).publish_page(_ctx(tenant="t-1"), "p1")
    assert exc.value.status_code == 404


def test_add_block_positions_increment_and_validate() -> None:
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    b0 = svc.add_block(_ctx(), "p1", BlockCreate(type=BlockType.hero, content={}))
    b1 = svc.add_block(
        _ctx(), "p1",
        BlockCreate(type=BlockType.rich_text, content={"html": {"de": "<p>x</p>"}}),
    )
    assert b0.position == 0 and b1.position == 1
    # content wurde gegen das Hero-Schema validiert/normalisiert.
    assert "heading" in b0.content


def test_reorder_blocks_rejects_foreign_set() -> None:
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [
            {"id": "b1", "tenant_id": "t-1", "page_id": "p1", "type": "hero",
             "position": 0, "content": {}, "settings": {}},
            {"id": "b2", "tenant_id": "t-1", "page_id": "p1", "type": "spacer",
             "position": 1, "content": {}, "settings": {}},
        ],
    }
    svc = _svc(tables)
    # falsche Menge (fremde ID) → 400
    with pytest.raises(SiteConfigError) as exc:
        svc.reorder_blocks(_ctx(), "p1", ["b1", "b99"])
    assert exc.value.status_code == 400
    # korrekte Menge → Positionen folgen der Reihenfolge
    res = svc.reorder_blocks(_ctx(), "p1", ["b2", "b1"])
    by_id = {b.id: b.position for b in res.items}
    assert by_id["b2"] == 0 and by_id["b1"] == 1


def test_update_block_validates_against_type() -> None:
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [
            {"id": "b1", "tenant_id": "t-1", "page_id": "p1", "type": "button",
             "position": 0, "content": {}, "settings": {}},
        ],
    }
    svc = _svc(tables)
    out = svc.update_block(
        _ctx(), "b1", BlockUpdate(content={"label": {"de": "Buchen"}, "href": "/x"})
    )
    assert out.content["href"] == "/x"


def test_resolve_page_only_published() -> None:
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-1", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [{"tenant_id": "t-1", "social_links": {}}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "Home",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [],
    }
    # Home existiert, aber unveröffentlicht → 404 (kein Entwurf nach außen).
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).resolve_page("a.de", None)
    assert exc.value.status_code == 404
    # veröffentlicht → kommt durch, mit Branding + tenant_id
    tables["site_pages"][0]["is_published"] = True
    out = _svc(tables).resolve_page("a.de", None)
    assert out.tenant_id == "t-1"
    assert out.page.slug == ""


def test_resolve_page_unknown_host_404() -> None:
    with pytest.raises(SiteConfigError) as exc:
        _svc({"tenant_custom_domains": []}).resolve_page("nope.de", None)
    assert exc.value.status_code == 404


def test_apply_template_creates_pages_and_blocks() -> None:
    tables = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    res = svc.apply_template(_ctx(), "bergchalet")
    assert res.total >= 1
    # Genau eine Home aus dem Template.
    homes = [p for p in tables["site_pages"] if p["is_home"]]
    assert len(homes) == 1
    # Blöcke wurden angelegt + content-validiert.
    assert len(tables["site_blocks"]) >= 1


def test_apply_unknown_template_404() -> None:
    with pytest.raises(SiteConfigError) as exc:
        _svc({"site_pages": []}).apply_template(_ctx(), "gibtsnicht")
    assert exc.value.status_code == 404


def test_draft_token_roundtrip_and_renders_unpublished() -> None:
    tables = {
        "tenant_custom_domains": [],
        "tenant_site_config": [{"tenant_id": "t-1", "social_links": {}}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "Entwurf",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [
            {"id": "b1", "tenant_id": "t-1", "page_id": "p1", "type": "hero",
             "position": 0, "content": {"heading": {"de": "Hi"}}, "settings": {}}
        ],
    }
    svc = _svc(tables)
    token = svc.create_draft_token(_ctx(), "p1")
    # Mit gültigem Token wird die UNVERÖFFENTLICHTE Seite gerendert.
    out = svc.resolve_page_draft("p1", token)
    assert out.tenant_id == "t-1"
    assert out.blocks[0].type == "hero"


def test_draft_token_invalid_403() -> None:
    tables = {
        "tenant_site_config": [{"tenant_id": "t-1", "social_links": {}}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "x",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [],
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).resolve_page_draft("p1", "9999999999.deadbeef")
    assert exc.value.status_code == 403


def test_draft_token_foreign_page_404() -> None:
    # Token für p1 darf nicht für eine fremde page_id gelten.
    tables = {
        "tenant_site_config": [{"tenant_id": "t-1", "social_links": {}}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "x",
             "is_home": True, "is_published": False, "nav_order": 0}
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    token = svc.create_draft_token(_ctx(), "p1")
    with pytest.raises(SiteConfigError) as exc:
        svc.resolve_page_draft("p-other", token)
    assert exc.value.status_code == 404


def test_draft_invalid_page_id_404_not_500() -> None:
    # Eine syntaktisch ungültige ID (DB wirft) → sauberes 404, kein 500.
    class _BoomDB:
        def table(self, _name: str):
            raise RuntimeError("invalid input syntax for type uuid")

    svc = SiteConfigService(
        service_client=_BoomDB(),  # type: ignore[arg-type]
        cloudflare=_FakeCloudflare(),  # type: ignore[arg-type]
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.resolve_page_draft("nope", "x.y")
    assert exc.value.status_code == 404


# --- W-1 / W-2: Stored-XSS-Schutz (Rich-Text-Sanitizer + href-Allowlist) ------
def test_rich_text_html_sanitized_on_save() -> None:
    from src.features.site_config.schemas import RichTextContent

    rt = RichTextContent(html={"de": (
        "<p>ok</p><script>alert(1)</script>"
        "<img src=x onerror=alert(2)>"
        "<a href=javascript:alert(3)>x</a><svg/onload=alert(4)>"
    )})
    cleaned = rt.html["de"]
    for bad in ("script", "onerror", "javascript", "svg", "onload"):
        assert bad not in cleaned
    assert "<p>ok</p>" in cleaned


def test_button_href_rejects_javascript() -> None:
    import pytest as _pytest

    from src.features.site_config.schemas import ButtonContent, HeroContent

    for scheme in ("javascript:alert(1)", "vbscript:x", "data:text/html,x"):
        with _pytest.raises(Exception):  # noqa: B017, PT011
            ButtonContent(href=scheme)
        with _pytest.raises(Exception):  # noqa: B017, PT011
            HeroContent(cta_href=scheme)
    # Erlaubt: http(s), mailto, tel, relativ, anchor.
    for good in ("https://x.de", "mailto:a@b.de", "tel:+49", "/kontakt", "#top"):
        assert ButtonContent(href=good).href == good
