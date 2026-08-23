"""Tests für den site_config-Slice.

Leichtgewichtiges Fake-DB-Mock (Muster wie addons.tests) + Fake-CloudflareClient
(kein Netz, keine Secrets, keine echten Custom-Hostnames). Prüft die Slice-Logik:
kein Cross-Tenant-Leak, Domain-Unique, Verify-/Sync-Flow, Tenant-Scope, kein
Secret-Leak. Das echte Cloudflare-Verhalten wird separat end-to-end verifiziert.
"""
from __future__ import annotations

import logging

import pytest
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.site_config import konto_daten
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
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


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
        self._count = False
        self._range: tuple[int, int] | None = None

    def select(self, *_cols: object, **k: object) -> _Query:
        self._op = "select"
        self._count = k.get("count") is not None
        return self

    def range(self, von: int, bis: int) -> _Query:
        self._range = (von, bis)
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
                    row.setdefault("nav_area", "header")
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
        gesamt = len(selected)
        if self._range is not None:
            von, bis = self._range
            selected = selected[von : bis + 1]
        return _Result(selected, count=gesamt if self._count else None)


class _FakeStorageBucket:
    """Bucket-Attrappe: merkt sich Uploads und Löschungen, kein Netz."""

    def __init__(self, store: dict[str, bytes], entfernt: list[str]) -> None:
        self._store = store
        self._entfernt = entfernt
        self.upload_soll_scheitern = False

    def upload(self, path: str, content: bytes, _opts: dict | None = None) -> None:
        if self.upload_soll_scheitern:
            raise RuntimeError("storage down")
        self._store[path] = content

    def remove(self, paths: list[str]) -> None:
        for p in paths:
            self._entfernt.append(p)
            self._store.pop(p, None)


class _FakeStorage:
    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.entfernt: list[str] = []
        self._buckets: dict[str, _FakeStorageBucket] = {}

    def from_(self, bucket: str) -> _FakeStorageBucket:
        if bucket not in self._buckets:
            self._buckets[bucket] = _FakeStorageBucket(self.dateien, self.entfernt)
        return self._buckets[bucket]


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.storage = _FakeStorage()

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


# === 0421: Theme + Abschnitts-Liste (Umbau vom freien Canvas) ================
def test_branding_speichert_theme_und_tokens() -> None:
    """Die neuen Design-Tokens (Theme, Flächen-/Schriftfarbe, drei Schriften,
    Button-Form, Logo-Skalierung) landen vollständig in der Config und kommen
    beim Lesen unverändert zurück."""
    tables: dict[str, list[dict]] = {"tenant_site_config": []}
    svc = _svc(tables)
    svc.set_branding(
        _ctx(),
        BrandingUpdate(
            theme="karte",
            primary_color="#112233",
            secondary_color="#445566",
            background_color="#ffffff",
            foreground_color="#111111",
            heading_font="Fraunces",
            font_family="Inter",
            button_font="Inter",
            button_style="outline",
            button_radius="pill",
            logo_scale=1.8,
        ),
    )
    got = svc.get_branding(_ctx())
    assert got.theme == "karte"
    assert got.background_color == "#ffffff"
    assert got.foreground_color == "#111111"
    assert got.heading_font == "Fraunces"
    assert got.button_style == "outline"
    assert got.button_radius == "pill"
    assert got.logo_scale == 1.8


def test_branding_lehnt_unbekanntes_theme_und_kaputte_farbe_ab() -> None:
    """Ein Theme oder eine Farbe, die es nicht gibt, ist ein Eingabefehler — kein
    stiller Fallback auf einen plausiblen Wert (Wurzel 4)."""
    for kwargs in (
        {"theme": "framer"},
        {"background_color": "rot"},
        {"foreground_color": "#12345"},
        {"button_radius": "extrarund"},
        {"button_style": "ghost"},
        {"logo_scale": 9.0},
    ):
        with pytest.raises(Exception):  # noqa: B017, PT011
            BrandingUpdate(**kwargs)  # type: ignore[arg-type]


def test_neue_seite_landet_hinten_im_eigenen_navigationsbereich() -> None:
    """nav_order zählt JE Bereich: eine Fußzeilen-Seite darf die Reihenfolge der
    Kopfzeile nicht durchmischen."""
    tables: dict[str, list[dict]] = {"site_pages": []}
    svc = _svc(tables)
    a = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    b = svc.create_page(_ctx(), PageCreate(title="Über uns", slug="ueber-uns"))
    f = svc.create_page(
        _ctx(), PageCreate(title="Impressum", slug="impressum", nav_area="footer")
    )
    assert (a.nav_area, a.nav_order) == ("header", 0)
    assert (b.nav_area, b.nav_order) == ("header", 1)
    # Erste Fußzeilen-Seite beginnt wieder bei 0, nicht bei 2.
    assert (f.nav_area, f.nav_order) == ("footer", 0)


def test_bereichswechsel_setzt_position_neu() -> None:
    """Gegenzustand (Wurzel 1): wechselt eine Seite den Navigationsbereich, gilt
    ihre alte Position dort nicht mehr — sonst kollidiert sie mit einer belegten."""
    from src.features.site_config.schemas import PageUpdate

    tables: dict[str, list[dict]] = {"site_pages": []}
    svc = _svc(tables)
    svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    svc.create_page(_ctx(), PageCreate(title="A", slug="a", nav_area="footer"))
    zwei = svc.create_page(_ctx(), PageCreate(title="B", slug="b"))
    assert zwei.nav_order == 1  # zweite Kopfzeilen-Seite

    verschoben = svc.update_page(_ctx(), zwei.id, PageUpdate(nav_area="footer"))
    assert verschoben.nav_area == "footer"
    # In der Fußzeile war Position 0 belegt → die Seite bekommt 1, nicht ihre alte 1
    # zufällig richtig, sondern gerechnet: nächste freie Position dort.
    assert verschoben.nav_order == 1


def test_seiten_umsortieren_nur_innerhalb_des_bereichs() -> None:
    from src.features.site_config.schemas import NavArea

    tables: dict[str, list[dict]] = {"site_pages": []}
    svc = _svc(tables)
    a = svc.create_page(_ctx(), PageCreate(title="A", slug="a"))
    b = svc.create_page(_ctx(), PageCreate(title="B", slug="b"))
    fuss = svc.create_page(_ctx(), PageCreate(title="F", slug="f", nav_area="footer"))

    svc.reorder_pages(_ctx(), NavArea.header, [b.id, a.id])
    nach = {p.id: p.nav_order for p in svc.list_pages(_ctx()).items}
    assert nach[b.id] == 0
    assert nach[a.id] == 1
    assert nach[fuss.id] == 0  # Fußzeile unberührt

    # Eine Seite aus einem ANDEREN Bereich mitzuschicken ist ein Fehler.
    with pytest.raises(SiteConfigError) as exc:
        svc.reorder_pages(_ctx(), NavArea.header, [b.id, a.id, fuss.id])
    assert exc.value.status_code == 400


def test_abschnitte_ersetzen_ist_idempotent() -> None:
    """Derselbe Speicher-Aufruf zweimal ergibt denselben Zustand (Wurzel 2) —
    kein Doppel-Anlegen bei Doppelklick oder Retry."""
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    req = BlocksReplaceRequest(
        items=[
            BlockReplaceItem(type=BlockType.hero, content={"heading": {"de": "Hallo"}}),
            BlockReplaceItem(type=BlockType.spacer, content={"size": "lg"}),
        ]
    )
    erst = svc.replace_blocks(_ctx(), page.id, req)
    assert [b.type for b in erst.items] == [BlockType.hero, BlockType.spacer]
    assert [b.position for b in erst.items] == [0, 1]

    # Zweiter Lauf mit den nun bekannten IDs → gleiche Menge, keine Duplikate.
    wieder = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(id=b.id, type=b.type, content=b.content, settings=b.settings)
                for b in erst.items
            ]
        ),
    )
    assert wieder.total == 2
    assert [b.id for b in wieder.items] == [b.id for b in erst.items]


def test_abschnitte_ersetzen_loescht_weggefallene() -> None:
    """Der Gegenzustand zur neuen Liste (Wurzel 1): was nicht mehr mitkommt, muss
    verschwinden — sonst bleibt ein gelöschter Abschnitt auf der Seite stehen."""
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    voll = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(type=BlockType.hero),
                BlockReplaceItem(type=BlockType.spacer),
                BlockReplaceItem(type=BlockType.contact),
            ]
        ),
    )
    behalten = voll.items[0]
    rest = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[BlockReplaceItem(id=behalten.id, type=behalten.type)]
        ),
    )
    assert rest.total == 1
    assert rest.items[0].id == behalten.id


def test_abschnitte_ersetzen_lehnt_fremden_abschnitt_ab() -> None:
    """Item-Level-Scope (Wurzel 9): eine Block-ID einer ANDEREN Seite desselben
    Kontos darf nicht hierher umgehängt werden."""
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    eins = svc.create_page(_ctx(), PageCreate(title="A", slug="a"))
    zwei = svc.create_page(_ctx(), PageCreate(title="B", slug="b"))
    fremd = svc.add_block(_ctx(), eins.id, BlockCreate(type=BlockType.hero))

    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            zwei.id,
            BlocksReplaceRequest(
                items=[BlockReplaceItem(id=fremd.id, type=BlockType.hero)]
            ),
        )
    assert exc.value.status_code == 400


def test_abschnitte_ersetzen_lehnt_typwechsel_und_duplikat_ab() -> None:
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    block = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))

    # Typwechsel: jeder Typ hat ein eigenes content-Schema → klar fehlschlagen.
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            page.id,
            BlocksReplaceRequest(
                items=[BlockReplaceItem(id=block.id, type=BlockType.spacer)]
            ),
        )
    assert exc.value.status_code == 400

    # Dieselbe ID zweimal wäre ein widersprüchlicher Auftrag.
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            page.id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(id=block.id, type=BlockType.hero),
                    BlockReplaceItem(id=block.id, type=BlockType.hero),
                ]
            ),
        )
    assert exc.value.status_code == 400


def test_abschnitte_haben_eine_obergrenze() -> None:
    """Wurzel 8: kein unbegrenzter Bereich — 61 Abschnitte sind ein 422, kein
    Versuch, eine Seite mit beliebig vielen Sektionen zu rendern."""
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    with pytest.raises(Exception):  # noqa: B017, PT011
        BlocksReplaceRequest(
            items=[BlockReplaceItem(type=BlockType.spacer) for _ in range(61)]
        )


def test_navigation_nur_veroeffentlicht_und_ohne_nicht_verlinkte() -> None:
    """Die Menüstruktur des Renderers: Entwürfe erscheinen nie (der Link liefe ins
    404), und nav_area='none' bleibt bewusst aus beiden Listen."""
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [{"tenant_id": "t-A", "site_name": "A"}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-A", "slug": "", "title": "Start",
             "is_home": True, "is_published": True, "nav_area": "header",
             "nav_order": 0},
            {"id": "p2", "tenant_id": "t-A", "slug": "ueber-uns", "title": "Über uns",
             "is_home": False, "is_published": True, "nav_area": "header",
             "nav_order": 1},
            {"id": "p3", "tenant_id": "t-A", "slug": "impressum", "title": "Impressum",
             "is_home": False, "is_published": True, "nav_area": "footer",
             "nav_order": 0},
            {"id": "p4", "tenant_id": "t-A", "slug": "geheim", "title": "Geheim",
             "is_home": False, "is_published": True, "nav_area": "none",
             "nav_order": 0},
            {"id": "p5", "tenant_id": "t-A", "slug": "entwurf", "title": "Entwurf",
             "is_home": False, "is_published": False, "nav_area": "header",
             "nav_order": 9},
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    res = svc.resolve_page("a.de")
    assert [i.slug for i in res.branding.nav.header] == ["", "ueber-uns"]
    assert [i.slug for i in res.branding.nav.footer] == ["impressum"]
    alle = [i.slug for i in res.branding.nav.header + res.branding.nav.footer]
    assert "geheim" not in alle
    assert "entwurf" not in alle


def test_navigation_leakt_nicht_ueber_tenants() -> None:
    """Wurzel 3: das Menü zeigt nur Seiten des aufgelösten Tenants."""
    tables = {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [{"tenant_id": "t-A", "site_name": "A"}],
        "site_pages": [
            {"id": "p1", "tenant_id": "t-A", "slug": "", "title": "Start A",
             "is_home": True, "is_published": True, "nav_area": "header",
             "nav_order": 0},
            {"id": "p9", "tenant_id": "t-B", "slug": "fremd", "title": "Fremd",
             "is_home": False, "is_published": True, "nav_area": "header",
             "nav_order": 0},
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    res = svc.resolve_page("a.de")
    assert [i.title for i in res.branding.nav.header] == ["Start A"]


def test_vorlage_setzt_navigationsbereich_und_branding() -> None:
    """Ein Vorlagen-Klick muss fertig sein: Seiten hängen im Menü, und Theme +
    Farben sind gesetzt — sonst steht der Kunde vor einer ungestylten Seite."""
    tables: dict[str, list[dict]] = {
        "site_pages": [],
        "site_blocks": [],
        "tenant_site_config": [],
    }
    svc = _svc(tables)
    svc.apply_template(_ctx(), "kueste")
    seiten = svc.list_pages(_ctx()).items
    assert {p.slug for p in seiten} == {"", "ueber-uns", "kontakt"}
    assert all(p.nav_area == "header" for p in seiten)
    # Positionen je Bereich fortlaufend, nicht alle auf 0.
    assert sorted(p.nav_order for p in seiten) == [0, 1, 2]
    branding = svc.get_branding(_ctx())
    assert branding.theme == "mitte"
    assert branding.primary_color == "#1f7a8c"


def test_vorlage_ueberschreibt_bestehende_marke_nicht() -> None:
    """Wurzel 1: wer seine Marke schon gesetzt hat, verliert sie durch eine
    Vorlage nicht."""
    tables: dict[str, list[dict]] = {
        "site_pages": [],
        "site_blocks": [],
        "tenant_site_config": [],
    }
    svc = _svc(tables)
    svc.set_branding(_ctx(), BrandingUpdate(primary_color="#abcdef", theme="seitlich"))
    svc.apply_template(_ctx(), "kueste")
    branding = svc.get_branding(_ctx())
    assert branding.primary_color == "#abcdef"
    assert branding.theme == "seitlich"
    # Was noch leer war, füllt die Vorlage trotzdem.
    assert branding.background_color == "#ffffff"


# === 0422: Mediathek ========================================================
# Echte Bild-Signaturen — die Prüfung entscheidet nach Anfangsbytes, nicht nach
# dem, was der Client behauptet.
_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
_JPEG = b"\xff\xd8\xff" + b"\x00" * 64
_WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64
# Ein SVG, das sich als Bild ausgibt: im öffentlichen Bucket wäre das Stored-XSS.
_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


def _media_svc(vorhandene: list[dict] | None = None):
    tables: dict[str, list[dict]] = {"site_media": list(vorhandene or [])}
    return _svc(tables), tables


def test_medium_hochladen_und_listen() -> None:
    svc, tables = _media_svc()
    m = svc.add_medium(_ctx(), _PNG, filename="strand.png")
    assert m.mime == "image/png"
    assert m.filename == "strand.png"
    assert m.bytes == len(_PNG)
    # Die Datei liegt im Bucket, unter einem nicht-ratbaren Pfad im Tenant-Ordner.
    pfade = list(svc._db.storage.dateien)  # noqa: SLF001 — Attrappe im Test
    assert len(pfade) == 1
    assert pfade[0].startswith("t-1/")
    assert pfade[0].endswith(".png")
    # Der Dateiname des Kunden landet NICHT im Pfad (Path-Traversal, Erratbarkeit).
    assert "strand" not in pfade[0]

    liste = svc.list_media(_ctx())
    assert liste.total == 1
    assert liste.items[0].id == m.id


def test_medium_erkennt_typ_aus_bytes_nicht_aus_behauptung() -> None:
    """Wurzel 8: ein SVG mit <script> darf nicht in den öffentlichen Bucket,
    egal was der Client als content_type schickt."""
    svc, _ = _media_svc()
    for inhalt in (_SVG, b"<html><script>x</script></html>", b"GIF89a" + b"\x00" * 32):
        with pytest.raises(SiteConfigError) as exc:
            svc.add_medium(_ctx(), inhalt, filename="harmlos.png")
        assert exc.value.status_code == 415
    # Nichts davon ist im Bucket gelandet.
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_medium_akzeptiert_die_drei_erlaubten_formate() -> None:
    svc, _ = _media_svc()
    for inhalt, erwartet in (
        (_PNG, "image/png"),
        (_JPEG, "image/jpeg"),
        (_WEBP, "image/webp"),
    ):
        assert svc.add_medium(_ctx(), inhalt).mime == erwartet


def test_medium_zu_gross_wird_abgelehnt() -> None:
    svc, _ = _media_svc()
    zu_gross = _PNG + b"\x00" * (20 * 1024 * 1024)
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), zu_gross)
    assert exc.value.status_code == 413
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_mediathek_hat_eine_obergrenze() -> None:
    """Wurzel 8: kein unbegrenzter Bereich. Ein Konto darf den Bucket nicht füllen."""
    voll = [
        {"id": f"m{i}", "tenant_id": "t-1", "path": f"t-1/{i}.png",
         "url": "u", "mime": "image/png", "bytes": 100}
        for i in range(SiteConfigService.MEDIA_MAX_COUNT)
    ]
    svc, _ = _media_svc(voll)
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), _PNG)
    assert exc.value.status_code == 409
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_medium_loeschen_entfernt_zeile_und_datei() -> None:
    """Wurzel 1: beide Seiten. Eine Datei ohne Zeile wäre eine Waise, die Platz
    belegt und weiterhin öffentlich erreichbar ist."""
    svc, tables = _media_svc()
    m = svc.add_medium(_ctx(), _PNG)
    pfad = list(svc._db.storage.dateien)[0]  # noqa: SLF001

    svc.remove_medium(_ctx(), m.id)
    assert tables["site_media"] == []
    assert svc._db.storage.dateien == {}  # noqa: SLF001
    assert pfad in svc._db.storage.entfernt  # noqa: SLF001


def test_medium_loeschen_nur_eigenes() -> None:
    """Wurzel 3/9: eine fremde Medien-ID ist ein 404, kein Löschen."""
    fremd = [{
        "id": "m-fremd", "tenant_id": "t-ANDERS", "path": "t-ANDERS/x.png",
        "url": "u", "mime": "image/png", "bytes": 100,
    }]
    svc, tables = _media_svc(fremd)
    with pytest.raises(SiteConfigError) as exc:
        svc.remove_medium(_ctx(), "m-fremd")
    assert exc.value.status_code == 404
    assert len(tables["site_media"]) == 1  # unangetastet


def test_mediathek_listet_nur_eigene_bilder() -> None:
    gemischt = [
        {"id": "a", "tenant_id": "t-1", "path": "t-1/a.png", "url": "ua",
         "mime": "image/png", "bytes": 1},
        {"id": "b", "tenant_id": "t-ANDERS", "path": "t-ANDERS/b.png", "url": "ub",
         "mime": "image/png", "bytes": 1},
    ]
    svc, _ = _media_svc(gemischt)
    liste = svc.list_media(_ctx())
    assert [m.id for m in liste.items] == ["a"]


def test_upload_fehler_laesst_keine_waise_zurueck() -> None:
    """Schlägt der Storage-Upload fehl, darf keine DB-Zeile entstehen."""
    svc, tables = _media_svc()
    svc._db.storage.from_("site-media").upload_soll_scheitern = True  # noqa: SLF001
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), _PNG)
    assert exc.value.status_code == 502
    assert tables["site_media"] == []


def test_mediathek_grenzt_das_limit_hart_ein() -> None:
    """Ein Client, der limit=100000 schickt, löst keine unbegrenzte Antwort aus."""
    viele = [
        {"id": f"m{i}", "tenant_id": "t-1", "path": f"t-1/{i}.png", "url": "u",
         "mime": "image/png", "bytes": 1}
        for i in range(250)
    ]
    svc, _ = _media_svc(viele)
    assert svc.list_media(_ctx(), limit=100000).total == 200
    assert svc.list_media(_ctx(), limit=0).total == 1


# === Regressionen: die drei Ursachen des „400 beim Speichern" ===============
def test_kontakt_email_ist_ein_string_keine_sprachkarte() -> None:
    """Der Editor schrieb an E-Mail, Telefon und Filterbegriff eine Locale-Map,
    weil er sie als mehrsprachige Textfelder behandelte. Das Backend erwartet
    dort flache Strings — die Folge war ein 400 für die GANZE Seite, sobald der
    Kunde eine E-Mail eintrug. Dieser Test hält die Erwartung fest."""
    from src.features.site_config.schemas import (
        ContactContent,
        PropertiesGridContent,
    )

    # So ist es richtig.
    assert ContactContent(email="info@x.dk", phone="+45 12").email == "info@x.dk"
    assert PropertiesGridContent(q="Strand").q == "Strand"

    # So war es falsch — und muss weiterhin auffallen.
    for kwargs in ({"email": {"de": "info@x.dk"}}, {"phone": {"de": "+45"}}):
        with pytest.raises(Exception):  # noqa: B017, PT011
            ContactContent(**kwargs)  # type: ignore[arg-type]
    with pytest.raises(Exception):  # noqa: B017, PT011
        PropertiesGridContent(q={"de": "Strand"})  # type: ignore[arg-type]


def test_auswahlfelder_lehnen_null_ab() -> None:
    """Die Option „Standard" im Inspektor schickte `null` in ein Pflichtfeld.
    Vier der elf Abschnittstypen waren damit unspeicherbar."""
    from src.features.site_config.schemas import (
        ButtonContent,
        HeroContent,
        RichTextContent,
        SpacerContent,
    )

    for modell, feld in (
        (HeroContent, "variant"),
        (RichTextContent, "align"),
        (ButtonContent, "variant"),
        (SpacerContent, "size"),
    ):
        with pytest.raises(Exception):  # noqa: B017, PT011
            modell(**{feld: None})  # type: ignore[arg-type]
        # Ohne Angabe greift der Default — kein Fehler, kein None.
        assert getattr(modell(), feld)


def test_abschnitte_ersetzen_loescht_nichts_bei_ungueltigem_inhalt() -> None:
    """Wurzel 5: fail-closed VOR dem Seiteneffekt.

    Vorher lief das Löschen der entfallenen Abschnitte, bevor der Inhalt geprüft
    wurde. Schlug ein Abschnitt weiter hinten fehl, war der gelöschte weg — der
    Aufrufer bekam 400 und glaubte, nichts sei passiert."""
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    voll = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(type=BlockType.spacer),
                BlockReplaceItem(type=BlockType.contact),
            ]
        ),
    )
    spacer, kontakt = voll.items
    assert voll.total == 2

    # Den Spacer weglassen UND den Kontakt mit ungültigem Inhalt schicken.
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            page.id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(
                        id=kontakt.id,
                        type=BlockType.contact,
                        # Eine Sprachkarte, wo ein String erwartet wird.
                        content={"email": {"de": "info@x.dk"}},
                    )
                ]
            ),
        )
    assert exc.value.status_code == 400

    # Nichts wurde angetastet: BEIDE Abschnitte sind noch da.
    danach = svc.list_blocks(_ctx(), page.id)
    assert danach.total == 2
    assert {b.id for b in danach.items} == {spacer.id, kontakt.id}


# === Übernahme aus dem Konto =================================================
def _konto_tables() -> dict[str, list[dict]]:
    """Ein Betrieb, der seine Firmendaten im Konto gepflegt hat."""
    return {
        "tenants": [{"id": "t-1", "name": "AirSmil"}],
        "tenant_billing_profile": [{
            "tenant_id": "t-1",
            "legal_name": "AirSmil ApS",
            "company_logo_url": "https://x.dk/logo.jpg",
            "email": "info@airsmil.dk",
            "phone_number": "+45 93903991",
            "company_street": "Hirtshalsvej",
            "company_house_number": "21",
            "company_postal_code": "9881",
            "company_city": "Bindslev",
            "company_country": "Denmark",
        }],
        "tenant_site_config": [],
        "site_pages": [],
        "site_blocks": [],
    }


def test_marke_faellt_auf_konto_zurueck() -> None:
    """Firmenname und Logo pflegt der Betrieb im Konto. Sie im Baukasten noch
    einmal einzutragen wäre eine zweite Wahrheit — also wird abgeleitet, nicht
    kopiert: die Site-Konfiguration gewinnt, sonst gilt das Konto."""
    svc = _svc(_konto_tables())
    b = svc.get_branding(_ctx())
    # `tenants.name` gewinnt über die Firmierung — auf einer Website tritt der
    # Betrieb unter seinem Namen auf, nicht als „… ApS".
    assert b.site_name == "AirSmil"
    assert b.logo_url == "https://x.dk/logo.jpg"


def test_eigene_marke_gewinnt_ueber_konto() -> None:
    """Wer für die Website bewusst etwas anderes setzt, behält es."""
    svc = _svc(_konto_tables())
    svc.set_branding(
        _ctx(),
        BrandingUpdate(site_name="Ferienhäuser Nord", logo_url="https://x.dk/web.png"),
    )
    b = svc.get_branding(_ctx())
    assert b.site_name == "Ferienhäuser Nord"
    assert b.logo_url == "https://x.dk/web.png"


def test_marke_erfindet_nichts_bei_leerem_konto() -> None:
    """Ist im Konto nichts gepflegt, bleibt es leer (Wurzel 4)."""
    tables = _konto_tables()
    tables["tenant_billing_profile"] = [{"tenant_id": "t-1"}]
    tables["tenants"] = [{"id": "t-1", "name": None}]
    svc = _svc(tables)
    b = svc.get_branding(_ctx())
    assert b.site_name is None
    assert b.logo_url is None


def test_marke_faellt_nicht_auf_fremdes_konto_zurueck() -> None:
    """Wurzel 3: die Firmendaten eines anderen Betriebs dürfen nicht einfließen."""
    tables = _konto_tables()
    tables["tenant_billing_profile"].append({
        "tenant_id": "t-ANDERS",
        "legal_name": "Fremd GmbH",
        "company_logo_url": "https://fremd.de/logo.png",
    })
    svc = _svc(tables)
    b = svc.get_branding(_ctx())
    assert b.logo_url == "https://x.dk/logo.jpg"
    assert b.site_name == "AirSmil"


def test_neuer_kontakt_abschnitt_ist_vorbefuellt() -> None:
    """Ein Kontakt-Abschnitt ohne Kontaktdaten ist nutzlos, und die Daten liegen
    im Konto — also gleich einsetzen."""
    tables = _konto_tables()
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Kontakt", slug="kontakt"))
    block = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.contact))
    assert block.content["email"] == "info@airsmil.dk"
    assert block.content["phone"] == "+45 93903991"
    assert "Bindslev" in block.content["address"]["de"]


def test_eigene_kontaktangabe_wird_nicht_ueberschrieben() -> None:
    """Was der Kunde beim Anlegen selbst mitgibt, gewinnt."""
    svc = _svc(_konto_tables())
    page = svc.create_page(_ctx(), PageCreate(title="Kontakt", slug="kontakt"))
    block = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(type=BlockType.contact, content={"email": "buchung@airsmil.dk"}),
    )
    assert block.content["email"] == "buchung@airsmil.dk"
    # Was er NICHT angegeben hat, kommt weiterhin aus dem Konto.
    assert block.content["phone"] == "+45 93903991"


def test_vorlage_setzt_echte_kontaktdaten_statt_beispiel() -> None:
    """Die Vorlage bringt „hallo@bergchalet.example" mit. Auf der Kundenseite
    hat das nichts zu suchen, wenn die echte Adresse im Konto steht."""
    tables = _konto_tables()
    svc = _svc(tables)
    svc.apply_template(_ctx(), "bergchalet")

    kontakt = [
        b
        for seite in svc.list_pages(_ctx()).items
        for b in svc.list_blocks(_ctx(), seite.id).items
        if b.type == BlockType.contact
    ]
    assert kontakt, "die Vorlage bringt Kontakt-Abschnitte mit"
    for b in kontakt:
        assert b.content["email"] == "info@airsmil.dk"
        assert b.content["phone"] == "+45 93903991"
        assert "Bindslev" in b.content["address"]["de"]

    # Marke ebenfalls aus dem Konto, Design-Tokens aus der Vorlage.
    branding = svc.get_branding(_ctx())
    assert branding.site_name == "AirSmil"
    assert branding.logo_url == "https://x.dk/logo.jpg"
    assert branding.theme == "klar"  # aus der Vorlage bergchalet


def test_anschrift_ohne_dubletten() -> None:
    """In der Praxis steht in `company_city` schon Region und Land mit, während
    `company_country` nur das Kürzel trägt. Ohne Prüfung stünde auf der
    Kundenseite „… Denmark" und darunter noch einmal „DK"."""
    tables = _konto_tables()
    tables["tenant_billing_profile"][0].update({
        "company_city": "Bindslev, Nordjylland, Denmark",
        "company_country": "DK",
    })
    svc = _svc(tables)
    firma = konto_daten.firmendaten(svc._db, "t-1")  # noqa: SLF001 — Fake-DB des Service
    assert firma["address"] == "Hirtshalsvej 21\n9881 Bindslev, Nordjylland, Denmark"

    # Steht das Land NICHT schon im Ort, kommt es als eigene Zeile dazu.
    tables2 = _konto_tables()
    svc2 = _svc(tables2)
    adresse = konto_daten.firmendaten(svc2._db, "t-1")["address"]  # noqa: SLF001
    assert adresse is not None and adresse.endswith("Denmark")


def test_social_link_nur_http() -> None:
    """Social-Links landen in einem `href` der Gast-Fußzeile. Ein
    `javascript:`-Wert darf nicht erst am Anzeigeort auffallen (Wurzel 8)."""
    svc = _svc(_konto_tables())
    with pytest.raises(ValidationError):
        BrandingUpdate(social_links={"instagram": "javascript:alert(1)"})
    with pytest.raises(ValidationError):
        BrandingUpdate(social_links={"instagram": "instagram.com/x"})
    # Vollständige Adresse geht durch.
    b = svc.set_branding(
        _ctx(),
        BrandingUpdate(social_links={"instagram": "https://instagram.com/x"}),
    )
    assert b.social_links == {"instagram": "https://instagram.com/x"}


def test_social_link_unbekanntes_netz_wird_abgelehnt() -> None:
    """Ein Schlüssel, den die Fußzeile nicht rendert, wird nicht still
    gespeichert — sonst tippt der Kunde ihn ein und sieht ihn nirgends."""
    with pytest.raises(ValidationError):
        BrandingUpdate(social_links={"threads": "https://threads.net/x"})


def test_social_link_leer_entfernt_den_schluessel() -> None:
    """„Kein Instagram" ist das Fehlen des Schlüssels, kein leerer Link."""
    svc = _svc(_konto_tables())
    b = svc.set_branding(
        _ctx(),
        BrandingUpdate(
            social_links={"instagram": "   ", "facebook": "https://fb.com/x"}
        ),
    )
    assert b.social_links == {"facebook": "https://fb.com/x"}


# --- Hauptschalter „Website offline" (0426) ----------------------------------
def _offline_tables(offline: bool) -> dict[str, list[dict]]:
    return {
        "tenant_custom_domains": [
            {"id": "d1", "tenant_id": "t-A", "domain": "a.de", "status": "active"}
        ],
        "tenant_site_config": [
            {
                "tenant_id": "t-A",
                "site_name": "A",
                "social_links": {},
                "is_offline": offline,
            }
        ],
        "site_pages": [
            {
                "id": "p1",
                "tenant_id": "t-A",
                "slug": "",
                "title": "Start",
                "is_home": True,
                "is_published": True,
                "nav_area": "header",
                "nav_order": 0,
            }
        ],
        "site_blocks": [],
    }


def test_offline_schliesst_die_domain() -> None:
    """Der Schalter muss den öffentlichen Resolver treffen, nicht nur die
    Oberfläche — sonst holt der Renderer sein Branding und baut die Seite."""
    with pytest.raises(SiteConfigError) as exc:
        _svc(_offline_tables(True)).resolve_site_by_domain("a.de")
    assert exc.value.status_code == 404


def test_offline_schliesst_auch_die_einzelne_seite() -> None:
    """Nur `resolve_site_by_domain` zu sperren hätte nichts gebracht: der
    Renderer holt seine Seiten über `resolve_page`, und eine Unterseite wäre
    über ihren Direktlink weiter erreichbar geblieben."""
    with pytest.raises(SiteConfigError) as exc:
        _svc(_offline_tables(True)).resolve_page("a.de")
    assert exc.value.status_code == 404


def test_online_bleibt_erreichbar() -> None:
    """Gegenprobe: ohne den Schalter ändert sich nichts."""
    out = _svc(_offline_tables(False)).resolve_page("a.de")
    assert out.page.slug == ""


def test_offline_sperrt_die_vorschau_nicht() -> None:
    """Der Entwurfs-Renderer ist bewusst ausgenommen: sonst könnte der Kunde die
    Seite nicht herrichten, während sie zu ist."""
    tables = _offline_tables(True)
    svc = _svc(tables)
    token = svc.create_draft_token(_ctx("t-A"), "p1")
    out = svc.resolve_page_draft("p1", token)
    assert out.page.slug == ""


# --- Verlinkte Rechts-Seiten (0426) -----------------------------------------
def test_cookie_seite_kommt_als_slug() -> None:
    """Der Renderer soll einen Pfad bauen können, ohne die Seite nachzuschlagen."""
    tables = _offline_tables(False)
    tables["site_pages"].append({
        "id": "p-ds",
        "tenant_id": "t-A",
        "slug": "datenschutz",
        "title": "Datenschutz",
        "is_home": False,
        "is_published": True,
        "nav_area": "footer",
        "nav_order": 0,
    })
    tables["tenant_site_config"][0]["cookie_banner"] = True
    tables["tenant_site_config"][0]["cookie_policy_page_id"] = "p-ds"
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.cookie_banner is True
    assert out.cookie_policy_slug == "datenschutz"
    # Die ID selbst darf NICHT nach draußen — sie ist eine interne Referenz.
    assert "cookie_policy_page_id" not in out.model_dump()


def test_unveroeffentlichte_rechts_seite_gibt_keinen_link() -> None:
    """Ein Banner-Link auf eine unveröffentlichte Seite wäre eine 404 für den
    Gast. Dann besser kein Link."""
    tables = _offline_tables(False)
    tables["site_pages"].append({
        "id": "p-ds",
        "tenant_id": "t-A",
        "slug": "datenschutz",
        "title": "Datenschutz",
        "is_home": False,
        "is_published": False,
        "nav_area": "footer",
        "nav_order": 0,
    })
    tables["tenant_site_config"][0]["cookie_policy_page_id"] = "p-ds"
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.cookie_policy_slug is None


def test_rechts_seite_eines_fremden_betriebs_wird_nicht_verlinkt() -> None:
    """Wurzel 3: eine per Direktpfad eingetragene fremde Seiten-ID darf nicht
    zum Link auf die Datenschutzseite eines anderen Betriebs werden."""
    tables = _offline_tables(False)
    tables["site_pages"].append({
        "id": "p-fremd",
        "tenant_id": "t-FREMD",
        "slug": "fremde-datenschutzseite",
        "title": "Fremd",
        "is_home": False,
        "is_published": True,
        "nav_area": "footer",
        "nav_order": 0,
    })
    tables["tenant_site_config"][0]["privacy_policy_page_id"] = "p-fremd"
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.privacy_policy_slug is None
