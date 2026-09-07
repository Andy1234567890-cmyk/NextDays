"""Tests für den site_config-Slice.

Leichtgewichtiges Fake-DB-Mock (Muster wie addons.tests) + Fake-CloudflareClient
(kein Netz, keine Secrets, keine echten Custom-Hostnames). Prüft die Slice-Logik:
kein Cross-Tenant-Leak, Domain-Unique, Verify-/Sync-Flow, Tenant-Scope, kein
Secret-Leak. Das echte Cloudflare-Verhalten wird separat end-to-end verifiziert.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.site_config import (
    konto_daten,
    rss_import,
    seiten,
    seiten_vorlagen,
    strecken_vorlagen,
    weiterleitungen,
)
from src.features.site_config import templates as site_templates
from src.features.site_config.schemas import (
    BlockCreate,
    BlockType,
    BlockUpdate,
    BrandingUpdate,
    DomainCreate,
    PageCreate,
    PageUpdate,
    PublicSiteResponse,
    RedirectCreate,
    RedirectImportRequest,
    RedirectUpdate,
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
        self._cmp: list[tuple[str, str, object]] = []
        self._listen: list[tuple[str, str, list]] = []
        self._ilike: list[tuple[str, str]] = []
        self._ist_null: list[str] = []

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

    def is_(self, col: str, _wert: str) -> _Query:
        """`.is_(spalte, "null")` — die einzige Form, die der Slice benutzt.

        PostgREST kennt `is` nur für null/true/false; alles andere wäre `eq`.
        Deshalb wird hier NICHT der Wert ausgewertet, sondern die eine Bedeutung
        nachgebildet, die im Code vorkommt — eine Attrappe, die mehr könnte als
        der Aufrufer nutzt, würde nur vortäuschen, sie sei geprüft."""
        self._ist_null.append(col)
        return self

    # --- Vergleiche und Listen-Filter (0457) --------------------------------
    # Der Blog braucht sie: `lte`/`lt`/`gt` für das Erscheinungsdatum (Planung
    # und Nachbar-Beiträge), `contains`/`overlaps` für die Schlagwörter,
    # `ilike` für die Beitragssuche. Ohne sie lief `beitraege_laden` in diesem
    # Mock in einen AttributeError — die Beitrags-Pfade waren also von KEINEM
    # Test erreichbar, auch nicht von den bestehenden.
    def lte(self, col: str, val: object) -> _Query:
        self._cmp.append((col, "lte", val))
        return self

    def lt(self, col: str, val: object) -> _Query:
        self._cmp.append((col, "lt", val))
        return self

    def gt(self, col: str, val: object) -> _Query:
        self._cmp.append((col, "gt", val))
        return self

    def contains(self, col: str, vals: list) -> _Query:
        self._listen.append((col, "contains", list(vals)))
        return self

    def overlaps(self, col: str, vals: list) -> _Query:
        self._listen.append((col, "overlaps", list(vals)))
        return self

    def ilike(self, col: str, muster: str) -> _Query:
        self._ilike.append((col, muster.strip("%").lower()))
        return self

    def order(self, col: str = "", *, desc: bool = False, **_k: object) -> _Query:
        if col:
            self._order = (col, desc)
        return self

    def limit(self, _n: int) -> _Query:
        return self

    # Spalten-DEFAULTS der echten DB, die dieses Mock sonst nicht kennt.
    #
    # Nötig geworden mit `page_type` (0433): die Spalte hat in Postgres
    # `default 'normal'`, also trägt JEDE bestehende Zeile diesen Wert. Ein
    # Fixture, das ihn nicht setzt, ist trotzdem eine normale Seite — ohne diese
    # Tabelle würde `.eq("page_type", "normal")` sie hier aussortieren und neun
    # Tests wären grün oder rot je nachdem, ob jemand das Feld mitgeschrieben
    # hat. Das wäre ein Testfehler, kein Befund.
    _SPALTEN_DEFAULT = {"page_type": "normal"}

    # Dasselbe beim LESEN, je Tabelle: eine Spalte `not null default 'upload'`
    # liefert aus der echten DB IMMER einen Wert, auch für Zeilen, die vor der
    # Migration entstanden sind. Ein Fixture, das sie nicht setzt, würde hier
    # sonst `None` liefern und ein Enum-Feld kippen lassen — ein Testfehler, der
    # wie ein Befund aussieht (`site_media.source`, 0461).
    _LESE_DEFAULT = {
        "site_media": {"source": "upload"},
        "site_pages": {"page_type": "normal"},
    }

    def _mit_defaults(self, rows: list[dict]) -> list[dict]:
        vorgaben = self._LESE_DEFAULT.get(self._table)
        if not vorgaben:
            return rows
        ergaenzt = []
        for r in rows:
            fehlend = {k: v for k, v in vorgaben.items() if r.get(k) is None}
            ergaenzt.append({**r, **fehlend} if fehlend else r)
        return ergaenzt

    def _match(self, row: dict) -> bool:
        for c, v in self._filters:
            ist = row.get(c, self._SPALTEN_DEFAULT.get(c))
            if str(ist) != str(v):
                return False
        if any(str(row.get(c)) == str(v) for c, v in self._neq):
            return False
        if self._in is not None:
            col, vals = self._in
            if row.get(col) not in vals:
                return False
        for col, op, val in self._cmp:
            ist = row.get(col)
            # NULL vergleicht sich in SQL mit nichts — eine Zeile ohne Wert
            # fällt aus jedem Vergleich heraus, nicht in ihn hinein.
            if ist is None:
                return False
            if op == "lte" and not str(ist) <= str(val):
                return False
            if op == "lt" and not str(ist) < str(val):
                return False
            if op == "gt" and not str(ist) > str(val):
                return False
        for col, op, vals in self._listen:
            ist = row.get(col) or []
            if op == "contains" and not set(vals) <= set(ist):
                return False
            if op == "overlaps" and not set(vals) & set(ist):
                return False
        for col, teil in self._ilike:
            if teil not in str(row.get(col) or "").lower():
                return False
        for col in self._ist_null:
            if row.get(col) is not None:
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
                if self._table == "site_media":
                    row.setdefault("source", "upload")
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
        return _Result(
            self._mit_defaults(selected), count=gesamt if self._count else None
        )


class _FakeStorageBucket:
    """Bucket-Attrappe: merkt sich Uploads und Löschungen, kein Netz."""

    def __init__(self, store: dict[str, bytes], entfernt: list[str]) -> None:
        self._store = store
        self._entfernt = entfernt
        self.upload_soll_scheitern = False
        self.remove_soll_scheitern = False
        self.signatur_soll_scheitern = False

    def upload(self, path: str, content: bytes, _opts: dict | None = None) -> None:
        if self.upload_soll_scheitern:
            raise RuntimeError("storage down")
        self._store[path] = content

    def remove(self, paths: list[str]) -> None:
        if self.remove_soll_scheitern:
            raise RuntimeError("storage down")
        for p in paths:
            self._entfernt.append(p)
            self._store.pop(p, None)

    def create_signed_url(self, path: str, _sekunden: int) -> dict:
        """Signierte Leseadresse (0445). Die Attrappe gibt eine erkennbar
        erfundene zurueck — geprueft wird, DASS eine erzeugt wird und dass sie
        nicht gespeichert bleibt."""
        if self.signatur_soll_scheitern:
            raise RuntimeError("storage down")
        return {"signedURL": f"/signiert/{path}?token=abc"}


class _FakeStorage:
    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.entfernt: list[str] = []
        self._buckets: dict[str, _FakeStorageBucket] = {}

    def from_(self, bucket: str) -> _FakeStorageBucket:
        if bucket not in self._buckets:
            self._buckets[bucket] = _FakeStorageBucket(self.dateien, self.entfernt)
        return self._buckets[bucket]


class _RpcAufruf:
    """Ein aufgezeichneter RPC-Aufruf. `execute()` tut nichts.

    Die Doppelgängerin muss ihn kennen, weil der echte Client ihn hat: seit
    0480 zählt der öffentliche Beitrags-Abruf über `bump_page_view`, und die
    Handsortierung läuft über `set_post_order`. Ohne `rpc` wäre jeder Test, der
    einen Beitrag liest, ein AttributeError — und der sagt nichts über den
    Code, sondern über die Attrappe.
    """

    def __init__(self, aufrufe: list[tuple[str, dict]], name: str, args: dict) -> None:
        self._aufrufe = aufrufe
        self._name = name
        self._args = args

    def execute(self) -> None:
        self._aufrufe.append((self._name, self._args))


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.storage = _FakeStorage()
        #: Was an RPCs gerufen wurde — Tests können es prüfen.
        self.rpc_aufrufe: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, args: dict) -> _RpcAufruf:
        return _RpcAufruf(self.rpc_aufrufe, name, args)


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
    kopf = {p.slug for p in seiten if p.nav_area == "header"}
    fuss = {p.slug for p in seiten if p.nav_area == "footer"}
    assert kopf == {"", "ueber-uns", "kontakt"}
    # Die Rechtsseiten hängen in der FUSSZEILE, nicht in der Kopfzeile: dort
    # sucht sie der Gast, und die Kopfzeile bleibt für die verkaufenden Seiten.
    assert fuss == {"impressum", "datenschutz", "agb", "widerruf", "cookie-richtlinie"}
    # Positionen je Bereich fortlaufend, nicht alle auf 0.
    assert sorted(p.nav_order for p in seiten if p.nav_area == "header") == [0, 1, 2]
    assert sorted(p.nav_order for p in seiten if p.nav_area == "footer") == [
        0, 1, 2, 3, 4
    ]
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
         "url": "u", "mime": "image/png", "bytes": 100, "kind": "image"}
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
         "mime": "image/png", "bytes": 1, "kind": "image"},
        {"id": "b", "tenant_id": "t-ANDERS", "path": "t-ANDERS/b.png", "url": "ub",
         "mime": "image/png", "bytes": 1, "kind": "image"},
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
         "mime": "image/png", "bytes": 1, "kind": "image"}
        for i in range(250)
    ]
    svc, _ = _media_svc(viele)
    # Der Deckel wirkt auf die AUSGELIEFERTE SEITE. `total` ist seit 0460 die
    # Zahl aller Treffer und nicht die der Seite — ohne sie kann die Oberfläche
    # nicht blättern und weiß nicht, ob es noch etwas gibt.
    voll = svc.list_media(_ctx(), limit=100000)
    assert len(voll.items) == 200
    assert voll.total == 250
    knapp = svc.list_media(_ctx(), limit=0)
    assert len(knapp.items) == 1
    assert knapp.total == 250


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


# --- SEO/AEO: Hierarchie Seite → Site (0430) ---------------------------------
def _seo_tables(**config) -> dict[str, list[dict]]:
    """Ein Betrieb, eine aktive Domain, eine veröffentlichte Startseite.
    `config` überschreibt Felder der Site-Config, `seite_*` die der Seite."""
    seite = {
        "id": "p1",
        "tenant_id": "t-A",
        "slug": "",
        "title": "Start",
        "is_home": True,
        "is_published": True,
        "nav_area": "header",
        "nav_order": 0,
    }
    for k in list(config):
        if k.startswith("seite_"):
            seite[k.removeprefix("seite_")] = config.pop(k)
    return {
        "tenant_custom_domains": [
            {
                "id": "d1",
                "tenant_id": "t-A",
                "domain": "a.de",
                "status": "active",
                "ssl_status": "active",
            }
        ],
        "tenant_site_config": [{"tenant_id": "t-A", **config}],
        "site_pages": [seite],
        "site_blocks": [],
    }


def test_seo_seite_schlaegt_site() -> None:
    """Die Hierarchie, die Hostaway „Site SEO Hierarchy" nennt: was an der Seite
    steht, gewinnt. Der site-weite Wert ist nur der Rückfall."""
    out = _svc(
        _seo_tables(
            seo_title="Site-Titel",
            seo_description="Site-Beschreibung",
            seite_seo_title="Seiten-Titel",
        )
    ).resolve_page("a.de")
    assert out.page.seo_title == "Seiten-Titel"
    # Die Beschreibung hat die Seite NICHT gesetzt → site-weiter Rückfall.
    assert out.page.seo_description == "Site-Beschreibung"


def test_seo_ohne_beides_bleibt_leer() -> None:
    """Kein erfundener Meta-Titel aus dem Seitentitel (Wurzel 4). `title` ist
    der Name der Seite im Baukasten, nicht ihre SEO-Aussage."""
    out = _svc(_seo_tables()).resolve_page("a.de")
    assert out.page.seo_title is None
    assert out.page.seo_description is None
    assert out.page.title == "Start"


def test_noindex_der_site_ueberstimmt_die_seite() -> None:
    """Der Hauptschalter darf nicht durch eine einzelne Seite aufgehoben werden.
    `noindex=false` ist der Default JEDER Seite — mit einer Hierarchie statt
    einer ODER-Verknüpfung wäre der site-weite Schalter also wirkungslos."""
    out = _svc(_seo_tables(noindex=True, seite_noindex=False)).resolve_page("a.de")
    assert out.page.noindex is True


def test_noindex_der_seite_wirkt_allein() -> None:
    """Gegenprobe: eine einzelne Seite sperren, ohne die ganze Website."""
    out = _svc(_seo_tables(noindex=False, seite_noindex=True)).resolve_page("a.de")
    assert out.page.noindex is True
    assert out.branding.noindex is False


def test_canonical_hat_keinen_site_rueckfall() -> None:
    """Ein site-weiter Canonical würde jede Unterseite zum Duplikat der
    Startseite erklären. Deshalb gibt es ihn nicht — und die Seite ohne eigenen
    Wert liefert `None`, nicht irgendetwas."""
    out = _svc(_seo_tables(seo_title="X")).resolve_page("a.de")
    assert out.page.canonical_url is None


def test_gtag_format_wird_erzwungen() -> None:
    """Der Wert landet in einem <script src> jeder Gast-Seite (Wurzel 8)."""
    with pytest.raises(ValidationError):
        BrandingUpdate(gtag_id="'><script>alert(1)</script>")
    # Die vier echten Präfixe müssen durchgehen.
    for gueltig in ("G-ABCD1234", "UA-12345-1", "AW-9988776", "DC-1234567"):
        assert BrandingUpdate(gtag_id=gueltig).gtag_id == gueltig


def test_organisation_ohne_namen_kein_schema() -> None:
    """Ein Organization-Schema ohne `name` ist für Google unbrauchbar, ein
    erfundener Name eine Falschaussage in maschinenlesbarer Form."""
    tables = _seo_tables()
    tables["tenants"] = [{"id": "t-A", "name": None}]
    tables["tenant_billing_profile"] = [{"tenant_id": "t-A", "legal_name": None}]
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.organization is None


def test_organisation_kommt_aus_dem_firmenprofil() -> None:
    """Keine zweite Eingabemaske für die Anschrift — die Quelle ist das Konto."""
    tables = _seo_tables()
    tables["tenants"] = [{"id": "t-A", "name": "Nordlicht"}]
    tables["tenant_billing_profile"] = [
        {
            "tenant_id": "t-A",
            "legal_name": "Nordlicht ApS",
            "company_street": "Havvej",
            "company_house_number": "12",
            "company_postal_code": "9881",
            "company_city": "Bindslev",
            "company_country": "DK",
            "phone_number": "+45 12 34 56 78",
            "email": "hej@nordlicht.example",
        }
    ]
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.organization is not None
    assert out.organization.name == "Nordlicht"
    assert out.organization.street == "Havvej 12"
    # Das Länderkürzel BLEIBT hier — anders als in der Adresszeile der Fußzeile.
    # Schema.org erwartet für `addressCountry` genau ISO 3166-1 alpha-2.
    assert out.organization.country == "DK"


def test_organisation_wird_ohne_schalter_nicht_geladen() -> None:
    """Zwei Datenbankabfragen pro Seitenansicht für etwas, das niemand
    ausliefert, wären reine Kosten."""
    tables = _seo_tables(schema_organization=False)
    tables["tenants"] = [{"id": "t-A", "name": "Nordlicht"}]
    tables["tenant_billing_profile"] = [{"tenant_id": "t-A"}]
    out = _svc(tables).resolve_site_by_domain("a.de")
    assert out.organization is None
    assert out.schema_organization is False


def test_seiten_head_html_nur_allowlist() -> None:
    """Dieselbe Allowlist wie site-weit: <meta>/<link>/<title>, keine Skripte."""
    with pytest.raises(ValidationError):
        PageUpdate(head_html='<script>alert(1)</script>')
    ok = PageUpdate(
        head_html='<meta name="robots" content="max-image-preview:large">'
    )
    assert ok.head_html is not None and "robots" in ok.head_html


# --- URL-Weiterleitungen (0430) ---------------------------------------------
def test_quellpfad_wird_normalisiert() -> None:
    """Was eindeutig gemeint ist, wird angenommen — statt den Kunden auf eine
    Fehlersuche zu schicken. Hostaway listet genau diese Formfehler als die
    häufigsten Ursachen dafür, dass eine Weiterleitung nicht greift."""
    for eingabe, erwartet in (
        ("alt", "/alt"),
        ("/Alt/", "/alt"),
        ("/alt?ref=newsletter", "/alt"),
        ("/alt#oben", "/alt"),
        ("  /ALT  ", "/alt"),
        ("/", "/"),
    ):
        assert RedirectCreate(source_path=eingabe, target="/neu").source_path == (
            erwartet
        ), eingabe


def test_quellpfad_mit_fremder_domain_wird_abgelehnt() -> None:
    """Als Pfad `/x` zu deuten wäre geraten: der Kunde meint vielleicht wirklich
    eine fremde Seite, und die kann diese Website nicht weiterleiten."""
    with pytest.raises(ValidationError):
        RedirectCreate(source_path="https://fremd.de/x", target="/neu")


def test_ziel_nur_pfad_oder_http() -> None:
    """Eine Weiterleitung schickt den Gast, der die KUNDENDOMAIN aufgerufen hat,
    irgendwohin. Ein `javascript:`-Ziel wäre Code unter fremdem Vertrauen."""
    for boese in (
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox",
        "neu-ohne-slash",
    ):
        with pytest.raises(ValidationError):
            RedirectCreate(source_path="/alt", target=boese)
    assert RedirectCreate(source_path="/alt", target="/neu").target == "/neu"
    assert (
        RedirectCreate(source_path="/alt", target="https://neu.de/x").target
        == "https://neu.de/x"
    )


def test_selbstschleife_wird_abgelehnt() -> None:
    """/alt → /alt blockiert laut Hostaway ALLE beteiligten Weiterleitungen.
    Der Fall passiert wirklich: der Kunde verwechselt die Richtung."""
    with pytest.raises(ValidationError):
        RedirectCreate(source_path="/alt", target="/alt")
    # Auch mit abweichender Schreibweise/Schluss-Schrägstrich.
    with pytest.raises(ValidationError):
        RedirectCreate(source_path="/Alt", target="/alt/")


def test_weiterleitung_wird_aufgeloest() -> None:
    tables = _seo_tables()
    tables["site_redirects"] = [
        {
            "id": "r1",
            "tenant_id": "t-A",
            "source_path": "/alt",
            "target": "/neu",
            "redirect_type": 301,
            "is_active": True,
        }
    ]
    treffer = weiterleitungen.aufloesen(_DB(tables), "t-A", "/alt")
    assert treffer == {"target": "/neu", "redirect_type": 301}


def test_weiterleitung_trifft_auch_mit_query_und_gross() -> None:
    """Der Lesepfad normalisiert genauso wie das Speichern — sonst trifft
    `/Alt/?utm_source=mail` seinen eigenen Eintrag nicht."""
    tables = _seo_tables()
    tables["site_redirects"] = [
        {
            "id": "r1",
            "tenant_id": "t-A",
            "source_path": "/alt",
            "target": "/neu",
            "redirect_type": 301,
            "is_active": True,
        }
    ]
    treffer = weiterleitungen.aufloesen(
        _DB(tables), "t-A", "/Alt/?utm_source=mail"
    )
    assert treffer is not None and treffer["target"] == "/neu"


def test_inaktive_weiterleitung_greift_nicht() -> None:
    tables = _seo_tables()
    tables["site_redirects"] = [
        {
            "id": "r1",
            "tenant_id": "t-A",
            "source_path": "/alt",
            "target": "/neu",
            "redirect_type": 301,
            "is_active": False,
        }
    ]
    assert weiterleitungen.aufloesen(_DB(tables), "t-A", "/alt") is None


def test_weiterleitung_eines_fremden_betriebs_greift_nicht() -> None:
    """Service-Role umgeht RLS — der Tenant-Scope muss im Code stehen (Wurzel 3).
    Ohne ihn könnte ein Betrieb den Verkehr eines anderen umlenken."""
    tables = _seo_tables()
    tables["site_redirects"] = [
        {
            "id": "r1",
            "tenant_id": "t-FREMD",
            "source_path": "/alt",
            "target": "https://boese.example",
            "redirect_type": 301,
            "is_active": True,
        }
    ]
    assert weiterleitungen.aufloesen(_DB(tables), "t-A", "/alt") is None


def test_aendern_scoped_auf_den_eigenen_betrieb() -> None:
    """Item-Level-Autorisierung mit demselben Scope wie die Liste (Wurzel 9)."""
    tables = _seo_tables()
    tables["site_redirects"] = [
        {
            "id": "r1",
            "tenant_id": "t-FREMD",
            "source_path": "/alt",
            "target": "/neu",
            "redirect_type": 301,
            "is_active": True,
            "created_at": "2026-08-24T10:00:00Z",
        }
    ]
    with pytest.raises(SiteConfigError) as exc:
        weiterleitungen.aendern(
            _DB(tables),
            "t-A",
            "r1",
            RedirectUpdate(target="/gekapert"),
            fehler=SiteConfigError,
        )
    assert exc.value.status_code == 404


def test_import_deckel_bei_200_zeilen() -> None:
    """Jeder unbegrenzte Bereich braucht eine Obergrenze (Wurzel 8)."""
    zeilen = [
        RedirectCreate(source_path=f"/alt-{i}", target=f"/neu-{i}")
        for i in range(201)
    ]
    with pytest.raises(ValidationError):
        RedirectImportRequest(items=zeilen)


# --- SEO-Befunde (Etappe B) --------------------------------------------------
def _befund_tables(**extra) -> dict[str, list[dict]]:
    """Ein Betrieb mit aktiver Domain, gepflegter Config und einer
    veröffentlichten Startseite. `extra` überschreibt Tabellen."""
    tables = {
        "tenant_custom_domains": [
            {
                "id": "d1",
                "tenant_id": "t-A",
                "domain": "a.de",
                "status": "active",
                "ssl_status": "active",
            }
        ],
        "tenant_site_config": [
            {
                "tenant_id": "t-A",
                "noindex": False,
                "gtag_id": "G-ABCD1234",
                "seo_description": None,
                "schema_organization": True,
            }
        ],
        "site_pages": [
            {
                "id": "p1",
                "tenant_id": "t-A",
                "slug": "",
                "title": "Start",
                "seo_title": "Nordlicht — Ferien in Dänemark",
                "seo_description": "Zwei Häuser direkt an der Nordsee.",
                "is_published": True,
                "noindex": False,
                "is_home": True,
            }
        ],
        "tenants": [{"id": "t-A", "name": "Nordlicht"}],
        "tenant_billing_profile": [
            {
                "tenant_id": "t-A",
                "company_city": "Bindslev",
                # Abrechnungsfähig: sonst meldet die Prüfung zu Recht
                # `zahlung_nicht_bereit`, und jeder Test, der „keine Befunde"
                # erwartet, würde daran scheitern.
                "stripe_charges_enabled": True,
            }
        ],
        "properties": [],
    }
    tables.update(extra)
    return tables


def _codes(tables: dict) -> list[str]:
    from src.features.site_config.seo import seo_befunde

    return [b["code"] for b in seo_befunde(_DB(tables), "t-A")]


def test_gepflegte_website_hat_keine_befunde() -> None:
    """Die Gegenprobe zuerst: eine vollständig gepflegte Site darf keine
    Befunde erzeugen. Ohne diesen Test wäre eine Liste, die IMMER etwas meldet,
    nicht von einer richtigen zu unterscheiden."""
    assert _codes(_befund_tables()) == []


def test_seite_ohne_titel_wird_gemeldet() -> None:
    tables = _befund_tables()
    tables["site_pages"][0]["seo_title"] = None
    assert "seiten_ohne_titel" in _codes(tables)


def test_entwurf_erzeugt_keinen_befund() -> None:
    """An einem Entwurf ist ein fehlender Meta-Titel unfertige Arbeit, kein
    Mangel. Ihn zu melden würde die Liste mit Dingen füllen, die der Kunde
    gerade selbst in der Hand hat."""
    tables = _befund_tables()
    tables["site_pages"].append(
        {
            "id": "p2",
            "tenant_id": "t-A",
            "slug": "neu",
            "title": "Neu",
            "seo_title": None,
            "seo_description": None,
            "is_published": False,
            "noindex": False,
        }
    )
    assert _codes(tables) == []


def test_doppelte_titel_werden_gemeldet() -> None:
    """Zwei Seiten mit demselben Titel konkurrieren um dieselbe Suchanfrage —
    der Befund, den Google in der Search Console selbst meldet. Hostaway prüft
    ihn nicht."""
    tables = _befund_tables()
    tables["site_pages"].append(
        {
            "id": "p2",
            "tenant_id": "t-A",
            "slug": "ueber-uns",
            "title": "Über uns",
            # Groß-/Kleinschreibung darf keinen Unterschied machen.
            "seo_title": "NORDLICHT — Ferien in Dänemark",
            "seo_description": "Wer wir sind.",
            "is_published": True,
            "noindex": False,
        }
    )
    codes = _codes(tables)
    assert "doppelte_titel" in codes


def test_site_noindex_ist_ein_fehler() -> None:
    tables = _befund_tables()
    tables["tenant_site_config"][0]["noindex"] = True
    from src.features.site_config.seo import seo_befunde

    befunde = seo_befunde(_DB(tables), "t-A")
    noindex = next(b for b in befunde if b["code"] == "site_noindex")
    assert noindex["schwere"] == "fehler"
    # Fehler stehen oben — die Oberfläche soll nicht sortieren müssen.
    assert befunde[0]["code"] == "site_noindex"


def test_ohne_domain_gibt_es_die_drei_dateien_nicht() -> None:
    tables = _befund_tables(tenant_custom_domains=[])
    assert "keine_domain" in _codes(tables)


def test_gleiche_beschreibung_ist_nur_ein_hinweis() -> None:
    """Ist die site-weite Beschreibung gesetzt, hat jede Seite eine — nur eben
    überall dieselbe. Das ist ein Hinweis, kein fehlender Wert."""
    tables = _befund_tables()
    tables["tenant_site_config"][0]["seo_description"] = "Ferien an der Nordsee."
    tables["site_pages"][0]["seo_description"] = None
    from src.features.site_config.seo import seo_befunde

    befund = next(
        b
        for b in seo_befunde(_DB(tables), "t-A")
        if b["code"] == "seiten_gleiche_beschreibung"
    )
    assert befund["schwere"] == "hinweis"


def test_objekt_ohne_beschreibung_wird_gemeldet() -> None:
    """Eine Objektseite ohne Text ist für Google eine dünne Seite: Bilder,
    Preis, Kalender — und kein Inhalt."""
    tables = _befund_tables(
        properties=[
            {
                "id": "o1",
                "tenant_id": "t-A",
                # `title` und NICHT `name`: so heisst die Spalte in der echten
                # Tabelle. Der Test stand hier zusammen mit der Abfrage auf
                # `name` -- beide falsch, beide gruen, weil die nachgebaute
                # Datenbank jede Spalte annimmt. Live war es ein 500
                # (24.08.2026). Gegen diese Klasse laeuft jetzt
                # scripts/diagnose/db-spalten-pruefen.py.
                "title": "Feriehus Kornblomst",
                "description": None,
                "status": "active",
                "listed_on_website": True,
            }
        ]
    )
    from src.features.site_config.seo import seo_befunde

    befund = next(
        b for b in seo_befunde(_DB(tables), "t-A") if b["code"] == "objekte_ohne_text"
    )
    assert befund["anzahl"] == 1
    assert befund["seiten"][0]["titel"] == "Feriehus Kornblomst"


def test_firmenprofil_ohne_namen_verhindert_das_schema() -> None:
    """Der Schalter steht an, aber ohne Namen liefert der Renderer kein Schema.
    Die häufigste Ursache für „mein Betrieb erscheint nicht bei Google" — und
    niemand sucht sie im Firmenprofil, weil der Schalter im Baukasten steht."""
    tables = _befund_tables(tenants=[{"id": "t-A", "name": None}])
    tables["tenant_billing_profile"] = [{"tenant_id": "t-A", "legal_name": None}]
    assert "kein_firmenname" in _codes(tables)


def test_befunde_sind_auf_zehn_seiten_gedeckelt() -> None:
    """Die ANZAHL bleibt vollständig, die Liste wird gekürzt. Sonst stünde bei
    200 betroffenen Seiten „10" da — eine Falschaussage."""
    tables = _befund_tables()
    tables["site_pages"] = [
        {
            "id": f"p{i}",
            "tenant_id": "t-A",
            "slug": f"s{i}",
            "title": f"Seite {i}",
            "seo_title": None,
            "seo_description": "x",
            "is_published": True,
            "noindex": False,
        }
        for i in range(25)
    ]
    from src.features.site_config.seo import seo_befunde

    befund = next(
        b for b in seo_befunde(_DB(tables), "t-A") if b["code"] == "seiten_ohne_titel"
    )
    assert befund["anzahl"] == 25
    assert len(befund["seiten"]) == 10


def test_ohne_zahlungskonto_wird_gewarnt() -> None:
    """Der Befund mit der größten Wirkung: die Website funktioniert, aber kein
    Geschäft kommt zustande.

    Ohne abrechnungsfähiges Konto durchläuft ein Gast die ganze
    Buchungsstrecke, eine Reservierung entsteht, und der Zahlungsschritt
    scheitert mit einem 409."""
    tables = _befund_tables()
    tables["tenant_billing_profile"] = [
        {"tenant_id": "t-A", "company_city": "Bindslev"}
    ]
    assert "zahlung_nicht_bereit" in _codes(tables)


def test_mit_paypal_reicht_es() -> None:
    """Stripe ODER PayPal genügt — „nur PayPal" ist ein gültiger Zustand, in dem
    die Buchungsstrecke funktioniert."""
    tables = _befund_tables()
    tables["tenant_billing_profile"] = [
        {
            "tenant_id": "t-A",
            "company_city": "Bindslev",
            "paypal_email": "zahlung@nordlicht.example",
        }
    ]
    assert "zahlung_nicht_bereit" not in _codes(tables)


def test_zahlungsbereitschaft_im_oeffentlichen_branding() -> None:
    """Der Renderer braucht die Angabe, um auf den Anfrage-Weg umzuschalten.

    `stripe_charges_enabled` und nicht die bloße Existenz eines Kontos: ein
    angelegter Custom Account, dessen KYC noch aussteht, nimmt kein Geld an —
    und genau dieser Zustand dauert Tage."""
    tables = _seo_tables()
    tables["tenant_billing_profile"] = [
        {"tenant_id": "t-A", "stripe_account_id": "acct_1", "stripe_charges_enabled": False}
    ]
    assert _svc(tables).resolve_site_by_domain("a.de").payments_ready is False

    tables["tenant_billing_profile"][0]["stripe_charges_enabled"] = True
    assert _svc(tables).resolve_site_by_domain("a.de").payments_ready is True


# --- Vorlagen-Galerie + Vorschau (Reiter „Vorlagen") -------------------------
def test_vorlagen_liste_kommt_vom_server() -> None:
    """Die IDs der Galerie stehen NUR im Backend.

    Vorher zählte das Frontend sie selbst auf; als das Backend umbenannte, lief
    jeder Klick in ein 404, sichtbar nur als Toast."""
    svc = _svc({"site_pages": [], "site_blocks": [], "tenant_site_config": []})
    res = svc.list_templates(_ctx())
    ids = [t.id for t in res.templates]
    assert ids == list(site_templates.TEMPLATE_REIHENFOLGE)
    assert res.kategorien == ["agentur", "vermietung", "hotel"]
    agentur = next(t for t in res.templates if t.id == "agentur")
    assert agentur.kategorie == "agentur"
    assert agentur.preview_image and agentur.preview_image.startswith("https://")
    # Jede Vorlage bringt die Rechtsseiten mit — sonst geht eine gewerbliche
    # Website ohne Impressum live.
    for tmpl in res.templates:
        fuss = {p.slug for p in tmpl.pages if p.nav_area == "footer"}
        assert {"impressum", "datenschutz", "agb"} <= fuss, tmpl.id


def test_seiten_vorlagen_liste_deckt_sich_mit_dem_anlegen() -> None:
    svc = _svc({"site_pages": [], "site_blocks": [], "tenant_site_config": []})
    res = svc.list_seiten_vorlagen(_ctx())
    assert [v.id for v in res.vorlagen] == list(seiten_vorlagen.VORLAGEN_REIHENFOLGE)
    assert all(v.block_count > 0 for v in res.vorlagen)


def test_vorlagen_vorschau_nur_mit_gueltigem_token() -> None:
    """Fail-CLOSED (Wurzel 5): ohne gültige Signatur keine Vorschau, und kein
    500 bei angreiferkontrolliertem Müll."""
    svc = _svc({"site_pages": [], "site_blocks": [], "tenant_site_config": []})
    token = svc.create_template_preview_token(_ctx(), "agentur")
    seite = svc.resolve_template_draft("agentur", "", token)
    assert seite.tenant_id == "t-1"
    assert seite.blocks and seite.page.noindex is True
    # Die Navigation kommt aus der Vorlage.
    assert "fuer-eigentuemer" in {i.slug for i in seite.branding.nav.header}
    assert "impressum" in {i.slug for i in seite.branding.nav.footer}

    for muell in ("", "abc", "a.b.c", "t-1.nichtzahl.x", token + "x"):
        with pytest.raises(SiteConfigError) as exc:
            svc.resolve_template_draft("agentur", "", muell)
        assert exc.value.status_code == 403, muell

    # Ein Token für Vorlage A öffnet Vorlage B nicht.
    with pytest.raises(SiteConfigError) as exc:
        svc.resolve_template_draft("hotel_klassisch", "", token)
    assert exc.value.status_code == 403


def test_vorlagen_vorschau_zeigt_das_ergebnis_des_anwendens() -> None:
    """Die Vorschau darf nicht mehr versprechen als `apply_template` liefert:
    Vorlagenfarben nur dort, wo der Betrieb noch keine gesetzt hat."""
    tables: dict[str, list[dict]] = {
        "site_pages": [],
        "site_blocks": [],
        "tenant_site_config": [
            {"tenant_id": "t-1", "primary_color": "#ff0000"}
        ],
    }
    svc = _svc(tables)
    token = svc.create_template_preview_token(_ctx(), "hotel_boutique")
    seite = svc.resolve_template_draft("hotel_boutique", "", token)
    assert seite.branding.primary_color == "#ff0000"  # eigene Marke bleibt
    assert seite.branding.heading_font == "Fraunces"  # Lücke füllt die Vorlage


def test_vorlagen_vorschau_unbekannte_seite_404() -> None:
    svc = _svc({"site_pages": [], "site_blocks": [], "tenant_site_config": []})
    token = svc.create_template_preview_token(_ctx(), "ferienhaus")
    with pytest.raises(SiteConfigError) as exc:
        svc.resolve_template_draft("ferienhaus", "gibt-es-nicht", token)
    assert exc.value.status_code == 404


# --- Blog: Planung, Pflege, Nachbarn, Suche (0457) ---------------------------
_JETZT = datetime.now(UTC)
_GESTERN = (_JETZT - timedelta(days=1)).isoformat()
_VORGESTERN = (_JETZT - timedelta(days=2)).isoformat()
_MORGEN = (_JETZT + timedelta(days=1)).isoformat()


def _blog_tables() -> dict[str, list[dict]]:
    """Drei erschienene Beiträge und einer, der geplant ist.

    `show_on_homepage` steht an JEDER Zeile (0481). Nicht der Vollständigkeit
    halber: die Fake-DB gibt für eine fehlende Spalte `None` zurück, und
    `.eq("show_on_homepage", True)` filtert eine solche Zeile weg. Ohne den
    Wert wären alle Beitragslisten in diesen Tests leer — und der Fehler sähe
    aus, als läge er in der Sortierung.
    """
    return {
        "site_pages": [
            {
                "id": "p-alt", "tenant_id": "t-1", "page_type": "post",
                "slug": "alt", "title": "Alter Sommer", "is_published": True,
                "published_at": _VORGESTERN, "tags": ["sommer"],
                "show_on_homepage": True,
            },
            {
                "id": "p-neu", "tenant_id": "t-1", "page_type": "post",
                "slug": "neu", "title": "Winter am Fjord", "is_published": True,
                "published_at": _GESTERN, "tags": ["winter", "tipps"],
                "show_on_homepage": True,
            },
            {
                "id": "p-geplant", "tenant_id": "t-1", "page_type": "post",
                "slug": "geplant", "title": "Ostern 2027", "is_published": True,
                "published_at": _MORGEN, "tags": ["ostern"],
                "show_on_homepage": True,
            },
            {
                "id": "p-fremd", "tenant_id": "t-2", "page_type": "post",
                "slug": "fremd", "title": "Fremder Beitrag",
                "is_published": True, "published_at": _GESTERN,
                "show_on_homepage": True,
            },
        ],
        "site_blocks": [],
        "tenant_site_config": [
            {"tenant_id": "t-1", "default_language": "da"}
        ],
        "users": [],
    }


def test_geplanter_beitrag_ist_in_keiner_liste() -> None:
    """Der entscheidende Nachweis der Vorplanung: ein Datum in der Zukunft hält
    den Beitrag zurück — und zwar in der Liste UND unter seiner Adresse."""
    db = _DB(_blog_tables())
    slugs = [b["slug"] for b in seiten.beitraege_laden(db, "t-1")]
    assert slugs == ["neu", "alt"]
    assert seiten.beitrag_laden(db, "t-1", "geplant") is None
    # Erschienene Beiträge bleiben erreichbar.
    assert seiten.beitrag_laden(db, "t-1", "neu") is not None


def test_beitrag_eines_fremden_betriebs_ist_unerreichbar() -> None:
    db = _DB(_blog_tables())
    assert seiten.beitrag_laden(db, "t-1", "fremd") is None
    assert all(
        b["slug"] != "fremd" for b in seiten.beitraege_laden(db, "t-1")
    )


def test_nachbarn_zeigen_nie_auf_einen_geplanten_beitrag() -> None:
    """Sonst wäre die Nächster/Vorheriger-Navigation das Leck, durch das die
    Planung fällt: Titel und Adresse des ungeschriebenen Beitrags."""
    db = _DB(_blog_tables())
    vorheriger, naechster = seiten.nachbarbeitraege(db, "t-1", _GESTERN)
    assert vorheriger is not None and vorheriger["slug"] == "alt"
    assert naechster is None  # „geplant" liegt in der Zukunft
    # Vom ältesten Beitrag aus gibt es einen neueren, aber keinen älteren.
    vorheriger, naechster = seiten.nachbarbeitraege(db, "t-1", _VORGESTERN)
    assert vorheriger is None
    assert naechster is not None and naechster["slug"] == "neu"


def test_schlagwort_auswahl_ist_ein_oder() -> None:
    db = _DB(_blog_tables())
    treffer = seiten.beitraege_laden(db, "t-1", tags=["sommer", "winter"])
    assert {b["slug"] for b in treffer} == {"alt", "neu"}
    # Ein einzelnes Schlagwort filtert weiterhin scharf.
    nur_sommer = seiten.beitraege_laden(db, "t-1", tag="sommer")
    assert [b["slug"] for b in nur_sommer] == ["alt"]


def test_beitragssuche_sucht_im_titel_und_nicht_im_muster() -> None:
    db = _DB(_blog_tables())
    assert [b["slug"] for b in seiten.beitraege_laden(db, "t-1", q="fjord")] == [
        "neu"
    ]
    # Musterzeichen sind kein Suchbegriff: `%` allein darf nicht die ganze
    # Liste als „Treffer" ausgeben, sondern ist gar keine Suche.
    assert seiten.suchbegriff_saeubern("%") is None
    assert seiten.suchbegriff_saeubern("som_mer*") == "sommer"


def test_beitrag_pflegen_ist_tenant_gescoped() -> None:
    db = _DB(_blog_tables())
    with pytest.raises(ValueError):
        seiten.beitrag_pflegen(
            db, "t-1", "p-fremd", seiten.BeitragUpdate(author="Ich")
        )
    # Und die fremde Zeile ist unverändert.
    assert all(
        r.get("author") is None
        for r in db.tables["site_pages"]
        if r["id"] == "p-fremd"
    )


def test_beitragsfelder_an_einer_normalen_seite_sind_422() -> None:
    tables = _blog_tables()
    tables["site_pages"].append(
        {"id": "p-seite", "tenant_id": "t-1", "page_type": "normal",
         "slug": "ueber-uns", "title": "Über uns"}
    )
    with pytest.raises(TypeError):
        seiten.beitrag_pflegen(
            _DB(tables), "t-1", "p-seite", seiten.BeitragUpdate(author="X")
        )


def test_datum_verschieben_aendert_die_reihenfolge() -> None:
    db = _DB(_blog_tables())
    seiten.beitrag_pflegen(
        db, "t-1", "p-alt",
        seiten.BeitragUpdate(published_at=_JETZT - timedelta(minutes=5)),
    )
    assert [b["slug"] for b in seiten.beitraege_laden(db, "t-1")] == [
        "alt", "neu"
    ]


def test_veroeffentlichung_in_die_zukunft_nimmt_den_beitrag_vom_netz() -> None:
    """„Beitrag planen" an einem Beitrag, der schon live war."""
    db = _DB(_blog_tables())
    seiten.beitrag_pflegen(
        db, "t-1", "p-neu",
        seiten.BeitragUpdate(published_at=_JETZT + timedelta(days=7)),
    )
    assert seiten.beitrag_laden(db, "t-1", "neu") is None


def test_nicht_gesendete_felder_bleiben_stehen() -> None:
    """Der SEO-Reiter kennt den Autor nicht — er darf ihn nicht löschen."""
    db = _DB(_blog_tables())
    seiten.beitrag_pflegen(
        db, "t-1", "p-neu", seiten.BeitragUpdate(author="Familie Jensen")
    )
    danach = seiten.beitrag_pflegen(
        db, "t-1", "p-neu", seiten.BeitragUpdate(seo_title="Winter")
    )
    assert danach.author == "Familie Jensen"
    assert danach.seo_title == "Winter"


def test_schlagwoerter_werden_entdoppelt_und_gedeckelt() -> None:
    ok = seiten.BeitragUpdate(tags=["sommer", " sommer ", "", "winter"])
    assert ok.tags == ["sommer", "winter"]
    with pytest.raises(ValidationError):
        seiten.BeitragUpdate(tags=["a"] * 9)
    with pytest.raises(ValidationError):
        seiten.BeitragUpdate(tags=["x" * 61])


def test_titelbild_nimmt_kein_javascript() -> None:
    with pytest.raises(ValidationError):
        seiten.BeitragUpdate(cover_image_url="javascript:alert(1)")
    with pytest.raises(ValidationError):
        seiten.BeitragUpdate(og_image_url="javascript:alert(1)")


def test_autorenliste_nennt_nur_namen_und_nur_berechtigte() -> None:
    tables = _blog_tables()
    tables["users"] = [
        {"id": "u-1", "tenant_id": "t-1", "role": "admin",
         "full_name": "Ida Storm", "email": "ida@example.com"},
        {"id": "u-2", "tenant_id": "t-1", "role": "cleaner",
         "full_name": "Putzkraft"},
        {"id": "u-3", "tenant_id": "t-1", "role": "admin",
         "full_name": "Ausgeschieden", "deactivated_at": _GESTERN},
        {"id": "u-4", "tenant_id": "t-2", "role": "admin",
         "full_name": "Fremder Chef"},
    ]
    namen = seiten.autorenliste(_DB(tables), "t-1")
    assert namen == ["Ida Storm"]


def test_blog_einstellungen_lesen_und_schreiben() -> None:
    db = _DB(_blog_tables())
    leer = seiten.blog_einstellungen_lesen(db, "t-2")
    assert leer.blog_name is None and leer.blog_prev_next is True
    gesetzt = seiten.blog_einstellungen_setzen(
        db, "t-1",
        seiten.BlogEinstellungen(
            blog_name="Nordlicht-Journal",
            blog_prev_next=False,
            rss_title="Nordlicht",
        ),
    )
    assert gesetzt.blog_name == "Nordlicht-Journal"
    assert gesetzt.blog_prev_next is False
    assert seiten.blog_einstellungen_lesen(db, "t-1").rss_title == "Nordlicht"


def test_rss_bild_nimmt_kein_javascript() -> None:
    with pytest.raises(ValidationError):
        seiten.BlogEinstellungen(rss_image_url="javascript:alert(1)")


def test_standardsprache_fehlt_ist_ein_fehler_kein_ersatzwert() -> None:
    tables = _blog_tables()
    tables["tenant_site_config"] = [{"tenant_id": "t-1"}]
    with pytest.raises(ValueError):
        seiten.standardsprache(_DB(tables), "t-1")
    # Führt die Website genau EINE Sprache, ist sie eindeutig.
    tables["tenant_site_config"] = [
        {"tenant_id": "t-1", "languages": ["sv"]}
    ]
    assert seiten.standardsprache(_DB(tables), "t-1") == "sv"


# --- RSS-Import (0457) -------------------------------------------------------
_FEED = """<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Fremder Blog</title>
    <item>
      <title>Sommer am See</title>
      <link>https://fremd.example/sommer</link>
      <pubDate>Tue, 03 Jun 2025 09:00:00 +0000</pubDate>
      <dc:creator>Ida Storm</dc:creator>
      <description>Ein Anriss.</description>
      <content:encoded><![CDATA[<h2>Hallo</h2><p>Text mit
        <a href="javascript:alert(1)">Falle</a> und
        <script>alert(2)</script> und <img src="https://x.example/b.jpg" alt="See">
        <iframe src="https://www.youtube.com/embed/abc"></iframe></p>]]></content:encoded>
    </item>
    <item>
      <title>Ohne Datum</title>
      <description>Zweiter</description>
    </item>
  </channel>
</rss>"""


def test_feed_ohne_doctype_wird_gelesen_mit_doctype_nicht() -> None:
    """Ein DOCTYPE ist der Einstieg für „billion laughs" — drei Zeilen DTD, und
    aus einem Kilobyte werden Gigabyte im Speicher."""
    eintraege = rss_import.feed_lesen(_FEED.encode())
    assert [e["titel"] for e in eintraege] == ["Sommer am See", "Ohne Datum"]
    boese = b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "x">]><rss></rss>'
    with pytest.raises(rss_import.RssImportFehler):
        rss_import.feed_lesen(boese)


def test_import_saeubert_fremdes_html() -> None:
    html = rss_import.html_saeubern(
        '<p>ok</p><script>alert(1)</script>'
        '<a href="javascript:alert(2)">x</a>'
        '<iframe src="https://player.vimeo.com/video/1"></iframe>'
        '<iframe src="https://boese.example/x"></iframe>'
    )
    assert "<script" not in html and "javascript:" not in html
    assert "<iframe" not in html
    # Das Video wird zum Link, statt spurlos zu verschwinden.
    assert "player.vimeo.com/video/1" in html
    # Eine fremde Einbettung, die kein Video ist, bleibt draußen.
    assert "boese.example" not in html


def test_import_legt_entwuerfe_an_und_ist_wiederholbar(monkeypatch) -> None:
    tables = _blog_tables()
    db = _DB(tables)
    monkeypatch.setattr(rss_import, "feed_holen", lambda _url: _FEED.encode())
    req = rss_import.RssImportRequest(url="https://fremd.example/feed.xml")
    erst = rss_import.feed_importieren(db, "t-1", req, sprache="da")
    assert erst.angelegt == 2 and erst.uebersprungen == 0
    neue = [r for r in tables["site_pages"] if r.get("slug") == "sommer-am-see"]
    assert len(neue) == 1
    seite = neue[0]
    assert seite["page_type"] == "post"
    # Entwurf: nicht live UND beim Website-Veröffentlichen übersprungen.
    assert seite["is_published"] is False and seite["is_draft"] is True
    assert seite["author"] == "Ida Storm"
    assert seite["published_at"].startswith("2025-06-03")
    # Ohne Datum im Feed bleibt das Feld LEER — unsere Uhr ist nicht der
    # Zeitpunkt einer fremden Veröffentlichung (Wurzel 5b).
    ohne = [r for r in tables["site_pages"] if r.get("slug") == "ohne-datum"][0]
    assert ohne["published_at"] is None
    # Der Text landet als Abschnitt in der Standardsprache.
    block = [b for b in tables["site_blocks"] if b["page_id"] == seite["id"]][0]
    assert block["type"] == "rich_text"
    assert "da" in block["content"]["html"]
    assert "<script" not in block["content"]["html"]["da"]

    # Zweiter Lauf: nichts doppelt (Wurzel 2).
    zweit = rss_import.feed_importieren(db, "t-1", req, sprache="da")
    assert zweit.angelegt == 0 and zweit.uebersprungen == 2
    assert len(tables["site_pages"]) == len(_blog_tables()["site_pages"]) + 2


def test_import_haelt_den_seiten_deckel_ein(monkeypatch) -> None:
    tables = _blog_tables()
    monkeypatch.setattr(rss_import, "feed_holen", lambda _url: _FEED.encode())
    monkeypatch.setattr(seiten, "MAX_SEITEN", 4)
    monkeypatch.setattr(rss_import.seiten, "MAX_SEITEN", 4)
    db = _DB(tables)
    res = rss_import.feed_importieren(
        db, "t-1", rss_import.RssImportRequest(url="https://f.example/f.xml"),
        sprache="da",
    )
    # Vier Seiten liegen bereits im Mock (drei eigene, eine fremde zählt der
    # tenant-gescopte Zähler nicht) — also genau ein freier Platz.
    assert res.angelegt == 1
    assert any("Deckel" in h for h in res.hinweise)


def test_import_lehnt_interne_adressen_ab() -> None:
    """Wurzel 8: die Adresse liefert der Kunde. `169.254.169.254` ist der
    Cloud-Metadaten-Dienst — die lohnendste Adresse im ganzen Netz."""
    for url in (
        "http://169.254.169.254/latest/meta-data/",
        "http://127.0.0.1:8000/feed.xml",
        "file:///etc/passwd",
    ):
        with pytest.raises(rss_import.RssImportFehler):
            rss_import.feed_holen(url)


def test_import_datum_liest_beide_schreibweisen() -> None:
    assert rss_import.datum_lesen(
        "Tue, 03 Jun 2025 09:00:00 +0200"
    ).startswith("2025-06-03T07:00")
    assert rss_import.datum_lesen("2025-06-03T09:00:00Z").startswith(
        "2025-06-03T09:00"
    )
    # Unlesbar → None, nicht „heute" (Wurzel 5b/4).
    assert rss_import.datum_lesen("neulich") is None
    assert rss_import.datum_lesen("") is None


# === Formulare: Anlagen, Ticket, Seiten, Spamschutz (0444/0445) ==============
#
# Vor 0445 hatte der ganze Formular-Teil des Slice KEINEN einzigen Test — weder
# die Feldpruefung aus 0436 noch den Nachlauf aus 0444. Die Tests hier decken
# das ab, was ohne echte Datenbank pruefbar ist: die Erkennung des Dateityps,
# das Ticket, die Seitenlogik im Schema, den Gegenzustand beim Loeschen und die
# fail-closed-Haltung des Spamschutzes. Der Weg durch Speicher und Storage
# selbst wird end-to-end gegen die Live-Datenbank geprueft.


def test_dateityp_kommt_aus_den_anfangsbytes_nicht_aus_dem_namen() -> None:
    """Der `content_type` des Clients ist eine Behauptung (Wurzel 8)."""
    from src.features.site_config import formular_anlagen as anl

    assert anl.dateityp(b"\xff\xd8\xff\xe0irgendwas") == ("image/jpeg", "jpg")
    assert anl.dateityp(b"\x89PNG\r\n\x1a\nrest") == ("image/png", "png")
    assert anl.dateityp(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == ("image/webp", "webp")
    assert anl.dateityp(b"%PDF-1.7\n%rest") == ("application/pdf", "pdf")


def test_dateityp_lehnt_zip_office_und_svg_ab() -> None:
    """Die drei Typen, die als Bild oder Dokument durchgehen wollen.

    ZIP und Office-Dateien (die selbst ZIPs sind) koennten alles enthalten und
    wir wuerden es an einen Betrieb weiterreichen, der die Datei oeffnet. SVG
    ist HTML mit Skripten darin — der eine Dateityp, der beim Ansehen Code
    ausfuehrt."""
    from src.features.site_config import formular_anlagen as anl

    assert anl.dateityp(b"PK\x03\x04dann ein docx") is None
    assert anl.dateityp(b'<svg xmlns="http://www.w3.org/2000/svg"><script/>') is None
    assert anl.dateityp(b"nur text") is None
    assert anl.dateityp(b"") is None


def test_anzeigename_entschaerft_pfade_und_steuerzeichen() -> None:
    """Der Name des Absenders wird NUR angezeigt — aber auch das gedeckelt."""
    from src.features.site_config import formular_anlagen as anl

    assert "/" not in anl.anzeigename("../../etc/passwd")
    assert "\\" not in anl.anzeigename("..\\..\\windows\\system32")
    assert anl.anzeigename("plan\x00\x07.pdf") == "plan.pdf"
    assert len(anl.anzeigename("x" * 4000)) == 120
    # Ein Name, von dem nichts uebrig bleibt, wird nicht leer: die Liste des
    # Betriebs zeigte sonst eine Zeile ohne Text.
    assert anl.anzeigename("///") == "datei"
    assert anl.anzeigename("") == "datei"


def test_upload_ticket_gilt_nur_fuer_seine_einsendung() -> None:
    """Ohne diese Bindung koennte jeder, der eine Einsendungs-ID kennt oder
    raet, Dateien an die Einsendung eines Fremden haengen."""
    from src.features.site_config import formular_anlagen as anl

    geheim = b"geheim"
    ticket = anl.ticket_erzeugen(geheim, "sub-1")
    assert anl.ticket_gilt(geheim, "sub-1", ticket)
    assert not anl.ticket_gilt(geheim, "sub-2", ticket)


def test_upload_ticket_ist_fail_closed() -> None:
    """Jeder Zweifelsfall ist ein Nein (Wurzel 5) — und keiner davon ein 500.

    Das Ticket ist angreiferkontrollierter Input: es kommt aus einem
    Formularfeld eines Aufrufs ohne JWT."""
    from src.features.site_config import formular_anlagen as anl

    geheim = b"geheim"
    gueltig = anl.ticket_erzeugen(geheim, "sub-1")
    assert not anl.ticket_gilt(geheim, "sub-1", None)
    assert not anl.ticket_gilt(geheim, "sub-1", "")
    assert not anl.ticket_gilt(geheim, "sub-1", "ohnepunkt")
    assert not anl.ticket_gilt(geheim, "sub-1", "keinezahl.abc")
    # Das letzte Zeichen VERÄNDERN, nicht auf einen festen Wert setzen.
    #
    # `gueltig[:-1] + "0"` war in etwa jedem sechzehnten Lauf gar keine
    # Änderung: die Signatur ist ein Hex-Digest, und wenn sie ohnehin auf „0"
    # endete, stand danach dasselbe Ticket da — der Test schlug also fehl,
    # obwohl die Prüfung richtig arbeitete. Weil der Ablaufzeitpunkt in den HMAC
    # eingeht, entschied schlicht die Sekunde des Laufs darüber (dieselbe Klasse
    # wie ein zeitzonenabhängiger Test).
    verdreht = gueltig[:-1] + ("1" if gueltig[-1] == "0" else "0")
    assert verdreht != gueltig
    assert not anl.ticket_gilt(geheim, "sub-1", verdreht)
    # Ein anderes Geheimnis darf keine gueltigen Tickets erzeugen.
    assert not anl.ticket_gilt(b"anderes", "sub-1", gueltig)


def test_upload_ticket_laeuft_ab() -> None:
    """Zwei Minuten. Es ueberbrueckt zwei Aufrufe desselben Formulars, mehr
    nicht — sonst waere es ein Schluessel, den man weitergeben kann."""
    from src.features.site_config import formular_anlagen as anl

    geheim = b"geheim"
    ticket = anl.ticket_erzeugen(geheim, "sub-1", jetzt=1_000)
    assert anl.ticket_gilt(geheim, "sub-1", ticket, jetzt=1_000 + 60)
    assert not anl.ticket_gilt(
        geheim, "sub-1", ticket, jetzt=1_000 + anl.TICKET_SEKUNDEN + 1
    )


def test_formular_ohne_seiten_ist_einseitig() -> None:
    """Leer heisst einseitig — nicht „keine Seite"."""
    from src.features.site_config.schemas import FormContent

    inhalt = FormContent.model_validate(
        {"fields": [{"name": "a", "type": "text"}]}
    )
    assert inhalt.seiten == []
    assert inhalt.fields[0].seite == 1


def test_feld_auf_nicht_vorhandener_seite_wird_abgelehnt() -> None:
    """Sonst waere das Feld unerreichbar: der Renderer zeigt Seite 1 bis n, aber
    `required` verlangt es weiterhin — das Formular liesse sich nicht mehr
    absenden, und niemand koennte sehen warum."""
    from src.features.site_config.schemas import FormContent

    with pytest.raises(ValidationError) as exc:
        FormContent.model_validate(
            {
                "seiten": [{"titel": {"de": "Eins"}}, {"titel": {"de": "Zwei"}}],
                "fields": [{"name": "spaet", "type": "text", "seite": 3}],
            }
        )
    # Der FELDNAME steht in der Meldung — sonst muesste der Kunde raten.
    assert "spaet" in str(exc.value)


def test_feld_auf_seite_zwei_ohne_seitenliste_wird_abgelehnt() -> None:
    """Der haeufigste Fall: jemand loescht die Seitenliste und laesst die
    Zuordnung an den Feldern stehen."""
    from src.features.site_config.schemas import FormContent

    with pytest.raises(ValidationError):
        FormContent.model_validate(
            {"fields": [{"name": "a", "type": "text", "seite": 2}]}
        )


def test_mehr_als_zehn_seiten_werden_abgelehnt() -> None:
    """Ohne Deckel waere die Seitenliste ein unbegrenzter Bereich (Wurzel 8)."""
    from src.features.site_config.schemas import FormContent

    with pytest.raises(ValidationError):
        FormContent.model_validate(
            {"seiten": [{"titel": {"de": str(i)}} for i in range(11)]}
        )


def test_formular_fehlertext_ist_ein_eigenes_feld() -> None:
    """`error_text` ist der Rückfall bei einem Fehlschlag OHNE eigene
    Server-Meldung — unabhängig von `success_text` (Wurzel 4: gestaltbare
    Erfolgs- UND Fehlermeldung, keine erfundene Kopplung der beiden)."""
    from src.features.site_config.schemas import FormContent

    leer = FormContent.model_validate({"fields": [{"name": "a", "type": "text"}]})
    assert leer.error_text == {}

    inhalt = FormContent.model_validate(
        {
            "fields": [{"name": "a", "type": "text"}],
            "success_text": {"de": "Danke!"},
            "error_text": {"de": "Das hat leider nicht geklappt."},
        }
    )
    assert inhalt.success_text == {"de": "Danke!"}
    assert inhalt.error_text == {"de": "Das hat leider nicht geklappt."}


def test_form_submission_response_bestaetigung_gesendet_default_false() -> None:
    """Ohne Bestätigung ist die Antwort ehrlich `False` — kein erfundenes
    `True`, das dem Gast eine Mail verspricht, die nie kam (Wurzel 4)."""
    from src.features.site_config.schemas import FormSubmissionResponse

    antwort = FormSubmissionResponse()
    assert antwort.bestaetigung_gesendet is False


def test_loeschen_einer_einsendung_raeumt_die_dateien_weg() -> None:
    """Wurzel 1: `on delete cascade` raeumt die ZEILEN, nicht die DATEIEN.

    Ohne diesen Schritt blieben Dateien von Dritten fuer immer im Bucket
    liegen, und der einzige Verweis auf ihren Pfad — die Zeile — waere weg.
    Live nachgemessen am 25.08.2026: fuenf Dateien, null Zeilen."""
    from src.features.site_config import formulare

    tables = {
        "site_form_submissions": [{"id": "s1", "tenant_id": "t-A"}],
        "site_form_uploads": [
            {"id": "u1", "tenant_id": "t-A", "submission_id": "s1",
             "pfad": "t-A/s1/aaa.png"},
            {"id": "u2", "tenant_id": "t-A", "submission_id": "s1",
             "pfad": "t-A/s1/bbb.pdf"},
            # Anlage einer FREMDEN Einsendung — darf nicht mitgeloescht werden.
            {"id": "u3", "tenant_id": "t-A", "submission_id": "s2",
             "pfad": "t-A/s2/ccc.png"},
        ],
    }
    db = _DB(tables)
    formulare.loeschen(db, "t-A", "s1")
    assert sorted(db.storage.entfernt) == ["t-A/s1/aaa.png", "t-A/s1/bbb.pdf"]
    assert tables["site_form_submissions"] == []


def test_loeschen_scheitert_laut_wenn_der_speicher_nicht_mitspielt() -> None:
    """Die Zeile bleibt stehen. Sie zu loeschen, obwohl die Datei liegen
    bleibt, waere ein halb ausgefuehrtes Loeschbegehren (Art. 17 DSGVO) — und
    ein zweiter Versuch waere unmoeglich, weil der Pfad nur in dieser Zeile
    steht."""
    from src.features.site_config import formulare

    tables = {
        "site_form_submissions": [{"id": "s1", "tenant_id": "t-A"}],
        "site_form_uploads": [
            {"id": "u1", "tenant_id": "t-A", "submission_id": "s1",
             "pfad": "t-A/s1/aaa.png"}
        ],
    }
    db = _DB(tables)
    db.storage.from_("site-form-uploads").remove_soll_scheitern = True
    with pytest.raises(SiteConfigError) as exc:
        formulare.loeschen(db, "t-A", "s1")
    assert exc.value.status_code == 502
    assert tables["site_form_submissions"] == [{"id": "s1", "tenant_id": "t-A"}]


def test_anlagenliste_signiert_jedes_mal_neu_und_scopt_auf_den_betrieb() -> None:
    """Wurzel 3/9: der Tenant steht im Filter, nicht nur die Einsendungs-ID.

    Und die Adresse wird ERZEUGT, nicht gespeichert: eine gespeicherte Adresse
    waere ein dauerhaft gueltiger Leseschluessel auf eine fremde Datei."""
    from src.features.site_config import formular_anlagen as anl

    tables = {
        "site_form_uploads": [
            {"id": "u1", "tenant_id": "t-A", "submission_id": "s1",
             "feld": "grundriss", "original_name": "plan.png", "mime": "image/png",
             "groesse": 100, "pfad": "t-A/s1/aaa.png",
             "created_at": "2026-08-25T10:00:00Z",
             "verfaellt_am": "2026-11-23T10:00:00Z"},
            {"id": "u2", "tenant_id": "t-B", "submission_id": "s1",
             "feld": "grundriss", "original_name": "fremd.png", "mime": "image/png",
             "groesse": 100, "pfad": "t-B/s1/bbb.png",
             "created_at": "2026-08-25T10:00:00Z",
             "verfaellt_am": "2026-11-23T10:00:00Z"},
        ]
    }
    db = _DB(tables)
    items = anl.liste(db, "t-A", "s1")
    assert [i["name"] for i in items] == ["plan.png"]
    assert items[0]["url"] == "/signiert/t-A/s1/aaa.png?token=abc"
    # Nichts davon landet in der Zeile.
    assert "url" not in tables["site_form_uploads"][0]


def test_anlage_ohne_signatur_kommt_ohne_link_statt_mit_totem_link() -> None:
    """Wurzel 4: ein Link, der ins Leere fuehrt, ist schlechter als keiner."""
    from src.features.site_config import formular_anlagen as anl

    tables = {
        "site_form_uploads": [
            {"id": "u1", "tenant_id": "t-A", "submission_id": "s1",
             "feld": "f", "original_name": "plan.png", "mime": "image/png",
             "groesse": 100, "pfad": "t-A/s1/aaa.png",
             "created_at": "2026-08-25T10:00:00Z",
             "verfaellt_am": "2026-11-23T10:00:00Z"},
        ]
    }
    db = _DB(tables)
    db.storage.from_("site-form-uploads").signatur_soll_scheitern = True
    items = anl.liste(db, "t-A", "s1")
    assert len(items) == 1
    assert items[0]["url"] is None


# --- Buchungsstrecke: die drei Formen (0474) ---------------------------------
def test_jede_strecke_kann_buchen() -> None:
    """Der Katalog prüft sich selbst: keine Strecke ohne Buchungsformular.

    Eine Strecke ohne `checkout_form` würde eine Buchungsseite anlegen, auf der
    niemand buchen kann — und das fiele erst dem ersten Gast auf.
    """
    strecken_vorlagen.pruefen()
    assert len(strecken_vorlagen.STRECKEN) == 3


def test_strecke_setzt_alle_drei_seiten() -> None:
    tables = {
        "site_pages": [
            {
                "id": "p-objekt",
                "tenant_id": "t-1",
                "slug": "inserat/[id]",
                "title": "",
                "page_type": "dynamic",
                "dynamic_source": "property",
            },
            {
                "id": "p-checkout",
                "tenant_id": "t-1",
                "slug": "checkout/[id]",
                "title": "",
                "page_type": "system",
                "system_key": "checkout",
            },
            {
                "id": "p-danke",
                "tenant_id": "t-1",
                "slug": "checkout/abgeschlossen",
                "title": "",
                "page_type": "system",
                "system_key": "checkout_abgeschlossen",
            },
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    svc.apply_strecke(_ctx(), "klassisch")
    typen_je_seite: dict[str, list[str]] = {}
    for row in tables["site_blocks"]:
        if (row.get("kind") or "widget") == "widget":
            typen_je_seite.setdefault(row["page_id"], []).append(row["type"])
    # Alle drei Seiten haben Bausteine bekommen.
    assert set(typen_je_seite) == {"p-objekt", "p-checkout", "p-danke"}
    # Und die Buchungsseite kann buchen.
    assert "checkout_form" in typen_je_seite["p-checkout"]


def test_strecke_ersetzt_statt_zu_ergaenzen() -> None:
    """Zweimal anwenden ergibt nicht doppelte Bausteine (Wurzel 1/2)."""
    tables = {
        "site_pages": [
            {
                "id": "p-checkout",
                "tenant_id": "t-1",
                "slug": "checkout/[id]",
                "title": "",
                "page_type": "system",
                "system_key": "checkout",
            },
        ],
        "site_blocks": [],
    }
    svc = _svc(tables)
    svc.apply_strecke(_ctx(), "klassisch")
    nach_erstem = len(tables["site_blocks"])
    svc.apply_strecke(_ctx(), "klassisch")
    assert len(tables["site_blocks"]) == nach_erstem


def test_unbekannte_strecke_wird_abgewiesen() -> None:
    with pytest.raises(SiteConfigError) as exc:
        _svc({"site_pages": [], "site_blocks": []}).apply_strecke(_ctx(), "erfunden")
    assert exc.value.status_code == 404


def test_buchungsformular_laesst_sich_nicht_als_letztes_loeschen() -> None:
    """Der Schutz aus 0474: eine Buchungsseite ohne Formular gibt es nicht."""
    tables = {
        "site_pages": [
            {
                "id": "p-checkout",
                "tenant_id": "t-1",
                "slug": "checkout/[id]",
                "title": "",
                "page_type": "system",
                "system_key": "checkout",
            },
        ],
        "site_blocks": [
            {
                "id": "b-form",
                "tenant_id": "t-1",
                "page_id": "p-checkout",
                "type": "checkout_form",
                "kind": "widget",
                "position": 0,
                "content": {},
                "settings": {},
            },
        ],
    }
    with pytest.raises(SiteConfigError) as exc:
        _svc(tables).remove_block(_ctx(), "b-form")
    assert exc.value.status_code == 422
    # Und die Zeile steht noch: abgewiesen wird VOR dem Löschen.
    assert len(tables["site_blocks"]) == 1


def test_zweites_buchungsformular_darf_das_erste_ersetzen() -> None:
    """Der Schutz sperrt nicht das Austauschen, nur das Leerräumen."""
    tables = {
        "site_pages": [
            {
                "id": "p-checkout",
                "tenant_id": "t-1",
                "slug": "checkout/[id]",
                "title": "",
                "page_type": "system",
                "system_key": "checkout",
            },
        ],
        "site_blocks": [
            {
                "id": "b-alt",
                "tenant_id": "t-1",
                "page_id": "p-checkout",
                "type": "checkout_form",
                "kind": "widget",
                "position": 0,
                "content": {},
                "settings": {},
            },
            {
                "id": "b-neu",
                "tenant_id": "t-1",
                "page_id": "p-checkout",
                "type": "checkout_form",
                "kind": "widget",
                "position": 1,
                "content": {},
                "settings": {},
            },
        ],
    }
    _svc(tables).remove_block(_ctx(), "b-alt")
    assert [r["id"] for r in tables["site_blocks"]] == ["b-neu"]


def test_normale_seite_darf_leer_werden() -> None:
    """Die Sperre gilt EINER Seite. Eine leere normale Seite ist ein Entwurf."""
    tables = {
        "site_pages": [
            {"id": "p-1", "tenant_id": "t-1", "slug": "ueber-uns", "title": "Über uns"},
        ],
        "site_blocks": [
            {
                "id": "b-1",
                "tenant_id": "t-1",
                "page_id": "p-1",
                "type": "rich_text",
                "kind": "widget",
                "position": 0,
                "content": {},
                "settings": {},
            },
        ],
    }
    _svc(tables).remove_block(_ctx(), "b-1")
    assert tables["site_blocks"] == []


def test_abschnitte_ersetzen_stellt_geloeschten_abschnitt_wieder_her() -> None:
    """Rückgängig nach dem Löschen (Prüfbericht A1, 27.08.2026).

    Der Verlauf im Editor spielt einen Stand ein, der VOR dem Löschen lag —
    er trägt damit zwangsläufig die ID des gelöschten Bausteins. Wies der
    Server die Nutzlast dafür ab, war Rückgängig vollständig funktionslos und
    der Editor blieb danach im Fehlerzustand stehen.

    Die ID bleibt dieselbe: der Verlauf hält frühere Stände mit genau diesen
    IDs, eine neu vergebene würde beim nächsten Schritt zurück wieder als
    „wiederherstellen" gelten und die Seite bei jedem Klick verlängern.
    """
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    hero = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    text = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.rich_text))

    # Löschen wie im Editor: die Liste ohne den Textblock schicken.
    nach_loeschen = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[BlockReplaceItem(id=hero.id, type=BlockType.hero)]
        ),
    )
    assert [i.id for i in nach_loeschen.items] == [hero.id]

    # Rückgängig: der frühere Stand, mit der ID des gelöschten Blocks.
    zurueck = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(id=hero.id, type=BlockType.hero),
                BlockReplaceItem(
                    id=text.id,
                    type=BlockType.rich_text,
                    content={"html": {"de": "wieder da"}},
                ),
            ]
        ),
    )
    ids = [i.id for i in zurueck.items]
    assert ids == [hero.id, text.id], ids
    wieder = next(i for i in zurueck.items if i.id == text.id)
    # Nur das gesendete Feld prüfen — das Schema füllt seine übrigen
    # Standardwerte (`align`, `font_family`) wie bei jedem anderen Baustein.
    assert wieder.content["html"] == {"de": "wieder da"}

    # Und nochmal derselbe Aufruf (Wurzel 2: der Editor speichert erneut) darf
    # den Baustein nicht ein zweites Mal anlegen.
    nochmal = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(id=hero.id, type=BlockType.hero),
                BlockReplaceItem(id=text.id, type=BlockType.rich_text),
            ]
        ),
    )
    assert [i.id for i in nochmal.items] == [hero.id, text.id]


def test_block_inhalt_wandelt_literales_backslash_n_in_umbruch() -> None:
    """Prüfbericht B5: die Anschrift stand auf der Kundenseite mit sichtbarem
    `\\n` — zwei ZEICHEN statt einem Umbruch. Der Renderer setzt dafür
    `whitespace-pre-line`, der Erzeuger im Backend verbindet mit einem echten
    Umbruch; nur der gespeicherte Wert trug die Escape-Sequenz.

    Geprüft an der EINEN Stelle, durch die jeder Schreibpfad geht.
    """
    from src.features.site_config.block_inhalte import validate_block_content

    raus = validate_block_content(
        BlockType.contact,
        {"address": {"de": "Hirtshalsvej 21\\n9881 Bindslev"}},
    )
    assert raus["address"]["de"] == "Hirtshalsvej 21\n9881 Bindslev"

    # Ein echter Umbruch bleibt, was er ist.
    unveraendert = validate_block_content(
        BlockType.contact, {"address": {"de": "A\nB"}}
    )
    assert unveraendert["address"]["de"] == "A\nB"

    # Auch verschachtelt (Listen mit mehrsprachigen Unterfeldern).
    faq = validate_block_content(
        BlockType.faq,
        {"items": [{"question": {"de": "Frage?"}, "answer": {"de": "A\\nB"}}]},
    )
    assert faq["items"][0]["answer"]["de"] == "A\nB"


def test_kontakt_formular_felder_passen_zum_renderer() -> None:
    """Prüfbericht B4: der Schalter „Kontaktformular anzeigen" war eine
    Attrappe — er stand im Katalog, im Schema und in drei Vorlagen auf `True`,
    und es gab nirgends ein Formular.

    Die Feldnamen sind der VERTRAG mit dem Renderer: der Absende-Endpunkt
    prüft gegen diese Liste und wirft unbekannte Felder weg. Ein hier
    umbenanntes Feld käme stumm nicht an.
    """
    from src.features.site_config.block_inhalte import (
        FormFieldType,
        kontakt_formular_felder,
    )

    felder = kontakt_formular_felder()
    assert [f.name for f in felder] == ["name", "email", "message", "consent"]
    # Alle vier sind Pflicht — ein optionales Nachrichtenfeld wäre eine leere
    # Einsendung, und die Zustimmung ist ohnehin nie optional.
    assert all(f.required for f in felder)
    zustimmung = felder[-1]
    assert zustimmung.type is FormFieldType.consent


def test_kontakt_einsendung_prueft_gegen_die_festen_felder() -> None:
    """Die Einsendung des Kontaktformulars läuft durch DIESELBE Prüfung wie
    die des Formular-Abschnitts (`einsendung_pruefen`): Pflichtfelder,
    Zustimmung, unbekannte Felder fliegen weg."""
    from src.features.site_config import formulare
    from src.features.site_config.block_inhalte import (
        FormContent,
        kontakt_formular_felder,
    )

    inhalt = FormContent(fields=kontakt_formular_felder())

    sauber = formulare.einsendung_pruefen(
        inhalt,
        {
            "name": "Otto",
            "email": "otto@example.com",
            "message": "Hallo",
            "consent": True,
            # Ein Feld, das die Liste nicht kennt: es darf die Antwortenliste
            # des Betriebs nicht füllen.
            "spam": "x",
        },
    )
    assert sauber == {
        "name": "Otto",
        "email": "otto@example.com",
        "message": "Hallo",
        "consent": "ja",
    }

    # Ohne Zustimmung: 422, nicht gespeichert.
    with pytest.raises(SiteConfigError) as exc:
        formulare.einsendung_pruefen(
            inhalt,
            {"name": "Otto", "email": "otto@example.com", "message": "Hallo"},
        )
    assert exc.value.status_code == 422


def test_beitragsliste_layout_vier_arten_grid_ist_standard() -> None:
    """Die Anordnung der Beitragsliste ist eine EIGENE Einstellung (`layout`).

    Vorher gab es genau eine Anordnung und dreizehn Regler daran — damit hatte
    „Layouts" im Blog-CMS nichts zu bedienen und war eine Seite, die nur auf die
    Übersichtsseite verlinkte.

    Vier Arten, abgeleitet aus dem Marktstandard (Squarespace 7.1: Basic Grid ·
    Masonry · Single Column · Side by Side): genau die, die der Renderer
    zeichnet. Eine fünfte in der Auswahl, die er nicht zeichnet, wäre eine
    Attrappe (Wurzel 4).

    `grid` MUSS der Standard bleiben: das ist das bisherige Aussehen, und ein
    neues Feld darf eine bestehende Kundenseite nicht umbauen (Wurzel 1).
    """
    from src.features.site_config.block_inhalte import validate_block_content

    # Ohne Angabe: der bisherige Zustand.
    standard = validate_block_content(BlockType.posts, {})
    assert standard["layout"] == "grid"

    for art in ("grid", "masonry", "list", "side"):
        raus = validate_block_content(BlockType.posts, {"layout": art})
        assert raus["layout"] == art, art

    # Eine Art, die der Renderer nicht kennt, wird ABGEWIESEN und nicht still
    # auf den Standard gedreht — sonst sähe der Kunde ein anderes Layout als
    # das gewählte und fände den Grund nie (Wurzel 4/5).
    with pytest.raises(ValidationError):
        validate_block_content(BlockType.posts, {"layout": "alternating"})


def test_systemseite_nimmt_bausteine_an_auf_allen_drei_wegen() -> None:
    """Seit 0474 sind Systemseiten GESTALTBAR — auf allen drei Schreibwegen.

    0466 hatte sie gesperrt („ihr Inhalt ist die Anwendung selbst"), weil die
    Renderer-Routen ihr Aussehen fest eingebaut hatten. 0474 gab ihnen eine
    Vorlage (`/site/page/system-vorlage`), womit ein Baustein daran gezeichnet
    wird — die Sperre war ab da falsch.

    Gefallen ist sie beim Umbau aber nur bei `replace_blocks`. `add_block` und
    `reorder_blocks` trugen sie weiter, und das ergab die stille Variante des
    Fehlers: die Blog-Übersicht sah gestaltbar aus und blieb leer, weil kein
    Baustein darauf entstehen konnte. Deshalb prüft dieser Test ALLE DREI Wege
    und nicht den einen, der gerade funktionierte.
    """
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Blog", slug="blog"))
    # Zur Systemseite machen — so, wie `systemseiten.sicherstellen` sie anlegt.
    for zeile in tables["site_pages"]:
        if zeile["id"] == page.id:
            zeile["page_type"] = "system"
            zeile["system_key"] = "blog"

    # 1. add_block — hier stand die Sperre.
    einer = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.posts))
    zwei = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.search_posts)
    )

    # 2. reorder_blocks — hier stand sie auch.
    gedreht = svc.reorder_blocks(_ctx(), page.id, [zwei.id, einer.id])
    assert [i.id for i in gedreht.items] == [zwei.id, einer.id]

    # 3. replace_blocks — der Weg des Editors, hier war sie schon gefallen.
    ersetzt = svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=einer.id,
                    type=BlockType.posts,
                    content={"layout": "masonry"},
                    settings={},
                )
            ]
        ),
    )
    assert [i.type for i in ersetzt.items] == [BlockType.posts]
    assert ersetzt.items[0].content["layout"] == "masonry"


def test_spalten_anlegen_mit_breite_und_verbotene_kombinationen() -> None:
    """Der Editor kann Spalten anlegen — vorher konnte er es NICHT.

    Die DB kennt `section`/`column`/`inner_column` samt `span` seit 0472, und
    der Renderer zeichnet `span` als Anteil von zwölf (`block-renderer.tsx`:
    `flexBasis: span/12*100%`). Aber `BlockCreate` nahm die drei Baum-Felder
    nicht an, und `add_block` setzte immer `kind='widget'`. Jeder Baustein
    landete deshalb in seiner eigenen einspaltigen Reihe: zwei Dinge
    nebeneinander zu setzen war im Baukasten unmöglich, obwohl Datenmodell und
    Renderer es konnten.

    Die verbotenen Kombinationen gehören mit in denselben Test: sie sind der
    Unterschied zwischen 422 und 500. `site_blocks_wurzel_check` und
    `site_blocks_tiefe_check` lehnen sie in der DB ab — als 23514, also ein 500
    aus Client-Input, genau was Wurzel 5 verbietet.
    """
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))

    # Ein Abschnitt hängt an der Seite.
    abschnitt = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(type=BlockType.container, kind="section"),
    )
    assert abschnitt.kind == "section"
    assert abschnitt.parent_id is None

    # Zwei halbe Spalten darin — 6 von 12 ist die halbe Breite.
    links = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container,
            kind="column",
            parent_id=abschnitt.id,
            span=6,
        ),
    )
    rechts = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container,
            kind="column",
            parent_id=abschnitt.id,
            span=6,
        ),
    )
    assert (links.span, rechts.span) == (6, 6)
    # Ans ENDE der Geschwister, nicht an dieselbe Stelle.
    assert links.position != rechts.position

    # Eine innere Spalte darf in eine Spalte.
    innen = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container, kind="inner_column", parent_id=links.id
        ),
    )
    assert innen.kind == "inner_column"

    # --- Was NICHT geht, und zwar als 422 und nicht als 500 ----------------

    # Ein Abschnitt MIT Elternteil.
    with pytest.raises(SiteConfigError) as e1:
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(
                type=BlockType.container, kind="section", parent_id=abschnitt.id
            ),
        )
    assert e1.value.status_code == 422

    # Eine Spalte OHNE Elternteil.
    with pytest.raises(SiteConfigError) as e2:
        svc.add_block(
            _ctx(), page.id, BlockCreate(type=BlockType.container, kind="column")
        )
    assert e2.value.status_code == 422

    # Eine Spalte in einer Spalte (dafür gibt es `inner_column`).
    with pytest.raises(SiteConfigError) as e3:
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(
                type=BlockType.container, kind="column", parent_id=links.id
            ),
        )
    assert e3.value.status_code == 422

    # Noch eine Ebene tiefer gibt es nicht.
    with pytest.raises(SiteConfigError) as e4:
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(
                type=BlockType.container, kind="inner_column", parent_id=innen.id
            ),
        )
    assert e4.value.status_code == 422

    # Eine unbekannte Art scheitert schon am Schema — nicht erst am DB-CHECK.
    with pytest.raises(ValidationError):
        BlockCreate(type=BlockType.container, kind="zeile")

    # `span` außerhalb von 1..12 ebenso.
    with pytest.raises(ValidationError):
        BlockCreate(type=BlockType.container, kind="column", span=13)


def test_container_position_schiebt_geschwister_nach_hinten() -> None:
    """Ein Layout entsteht an der geklickten NAHT, nicht immer am Ende.

    `position` kam als Feld dazu, weil das „+" im Editor eine Stelle bezeichnet:
    wer oben klickt, will den Abschnitt oben. Vorher reichte der Editor die
    Position durch das ganze Overlay und warf sie dann weg (`void position`) —
    der Abschnitt landete immer unten, und die geklickte Naht war wirkungslos.

    Geprüft wird VOR ALLEM der Gegenzustand (Wurzel 1): wer sich einschiebt,
    verschiebt die Geschwister dahinter. Ohne dieses Nachziehen trügen zwei
    Zeilen dieselbe Position, und welche zuerst stünde, entschiede die DB.
    """
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))

    # Drei Abschnitte, ans Ende angehängt.
    a = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.container, kind="section"))
    b = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.container, kind="section"))
    c = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.container, kind="section"))
    assert [a.position, b.position, c.position] == [0, 1, 2]

    # Einer GANZ NACH VORN.
    vorn = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(type=BlockType.container, kind="section", position=0),
    )
    assert vorn.position == 0

    def rang(block_id: str) -> int:
        return next(
            z["position"] for z in tables["site_blocks"] if z["id"] == block_id
        )

    # Die drei alten sind je um eins nach hinten gewandert.
    assert [rang(a.id), rang(b.id), rang(c.id)] == [1, 2, 3]

    # In die MITTE: hinter dem, was jetzt auf 1 steht.
    mitte = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(type=BlockType.container, kind="section", position=2),
    )
    assert mitte.position == 2
    # `a` stand auf 1 und bleibt dort, `b`/`c` weichen.
    assert [rang(a.id), rang(b.id), rang(c.id)] == [1, 3, 4]

    # Keine zwei Zeilen mit derselben Position.
    raenge = [z["position"] for z in tables["site_blocks"] if z.get("kind") == "section"]
    assert len(raenge) == len(set(raenge)), raenge

    # Eine Position HINTER dem Ende ist „ans Ende" und kein 422: der Editor
    # rechnet die Naht aus einer Liste, die sich zwischen Klick und Request
    # geändert haben kann.
    hinten = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(type=BlockType.container, kind="section", position=99),
    )
    assert hinten.position == 5


def test_baustein_landet_in_der_gewaehlten_spalte() -> None:
    """Ein Baustein kann in eine BESTEHENDE Spalte gezogen werden.

    Das war der letzte Riegel des Spaltenlayouts. `BlockReplaceItem` kannte kein
    `parent_id`, also legte der Server jedem neuen Baustein eine eigene Hülle an
    (`_huelle_fuer_widget`) — seine eigene Reihe. Spalten ließen sich anlegen
    (0472 + 27.08.2026), aber nicht füllen: zwei Dinge nebeneinander zu setzen
    ging im Baukasten nicht.

    Mitgeprüft: die TIEFE hängt am Ziel (2 in einer Spalte, 3 in einer inneren).
    Fest geschrieben wäre sie ein 23514 aus `site_blocks_tiefe_check` und damit
    ein 500 aus Client-Input (Wurzel 5).
    """
    from src.features.site_config.schemas import BlockReplaceItem, BlocksReplaceRequest

    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))

    # Ein Abschnitt mit zwei halben Spalten.
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    links = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container, kind="column", parent_id=abschnitt.id, span=6
        ),
    )
    rechts = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container, kind="column", parent_id=abschnitt.id, span=6
        ),
    )

    # Je einen Baustein in jede Spalte — plus einen OHNE Wunsch, der wie bisher
    # seine eigene Hülle bekommt.
    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(type=BlockType.rich_text, parent_id=links.id),
                BlockReplaceItem(type=BlockType.button, parent_id=rechts.id),
                BlockReplaceItem(type=BlockType.spacer),
            ]
        ),
    )

    zeilen = {
        z["type"]: z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    }
    # Die beiden gezogenen sitzen in DEN gewählten Spalten, nicht in eigenen.
    assert zeilen["rich_text"]["parent_id"] == links.id
    assert zeilen["button"]["parent_id"] == rechts.id
    assert zeilen["rich_text"]["tiefe"] == 2
    # Der ohne Wunsch bekam seine eigene Hülle — also NICHT eine der beiden.
    assert zeilen["spacer"]["parent_id"] not in (links.id, rechts.id)

    # --- Ein ungültiges Ziel wird ABGEWIESEN, nicht still umgebogen ---------
    #
    # Der Kunde hat in eine bestimmte Spalte gezogen; ihn woanders landen zu
    # lassen wäre eine plausible Falschauskunft (Wurzel 4).

    # Ein ABSCHNITT ist keine Spalte (nur `column`/`inner_column` nehmen
    # Bausteine auf — ein Widget direkt im Abschnitt verletzt die Tiefe).
    #
    # Auf einer FRISCHEN Seite geprüft: auf der obigen ist der Abschnitt nach
    # dem `replace_blocks` schon aufgeräumt (seine Bausteine entfielen), und
    # `_own_block` gäbe dann 404 statt der Typprüfung — geprüft wäre etwas
    # anderes als gemeint.
    dritte = svc.create_page(_ctx(), PageCreate(title="Drei", slug="drei"))
    nur_abschnitt = svc.add_block(
        _ctx(), dritte.id, BlockCreate(type=BlockType.container, kind="section")
    )
    with pytest.raises(SiteConfigError) as e1:
        svc.replace_blocks(
            _ctx(),
            dritte.id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(
                        type=BlockType.rich_text, parent_id=nur_abschnitt.id
                    )
                ]
            ),
        )
    assert e1.value.status_code == 422

    # Eine Spalte einer ANDEREN Seite.
    zweite = svc.create_page(_ctx(), PageCreate(title="Zwei", slug="zwei"))
    fremd_abschnitt = svc.add_block(
        _ctx(), zweite.id, BlockCreate(type=BlockType.container, kind="section")
    )
    fremde_spalte = svc.add_block(
        _ctx(),
        zweite.id,
        BlockCreate(
            type=BlockType.container, kind="column", parent_id=fremd_abschnitt.id
        ),
    )
    with pytest.raises(SiteConfigError) as e2:
        svc.replace_blocks(
            _ctx(),
            page.id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(
                        type=BlockType.rich_text, parent_id=fremde_spalte.id
                    )
                ]
            ),
        )
    assert e2.value.status_code == 422


# --- Container ändern, verschieben, duplizieren (0479) -----------------------
def _seite_mit_zwei_spalten() -> tuple[object, dict, dict]:
    """Eine Seite, ein Abschnitt, zwei halbe Spalten, je ein Baustein darin."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    spalten = [
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(
                type=BlockType.container,
                kind="column",
                parent_id=abschnitt.id,
                span=6,
            ),
        )
        for _ in range(2)
    ]
    for spalte in spalten:
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(type=BlockType.rich_text, parent_id=spalte.id),
        )
    return svc, tables, {"page": page, "abschnitt": abschnitt, "spalten": spalten}


def test_spaltenbreite_ist_nachtraeglich_aenderbar() -> None:
    """Sie war nur beim ANLEGEN setzbar — die Breite eines Layouts war damit
    eine Entscheidung, die man nie mehr ändern konnte."""
    svc, _, s = _seite_mit_zwei_spalten()
    geaendert = svc.update_block(_ctx(), s["spalten"][0].id, BlockUpdate(span=8))
    assert geaendert.span == 8


def test_breite_an_abschnitt_oder_baustein_ist_ein_422() -> None:
    """Fail-closed statt still verwerfen: sonst liest der Kunde „gespeichert",
    und die Breite bleibt, wie sie war (Wurzel 5)."""
    svc, tables, s = _seite_mit_zwei_spalten()
    with pytest.raises(SiteConfigError) as exc:
        svc.update_block(_ctx(), s["abschnitt"].id, BlockUpdate(span=6))
    assert exc.value.status_code == 422
    baustein = next(
        z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    )
    with pytest.raises(SiteConfigError) as exc2:
        svc.update_block(_ctx(), baustein["id"], BlockUpdate(span=6))
    assert exc2.value.status_code == 422


def test_abschnitt_verschieben_ordnet_die_geschwister_lueckenlos() -> None:
    """„Abschnitt hoch/runter" gab es für Container gar nicht: `reorder_blocks`
    verlangt die Baustein-Liste, und eine Position war nur beim Anlegen
    vergebbar."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    drei = [
        svc.add_block(
            _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
        )
        for _ in range(3)
    ]
    # Der dritte nach ganz vorn.
    svc.move_container(_ctx(), drei[2].id, 0)
    raenge = {
        z["id"]: z["position"]
        for z in tables["site_blocks"]
        if z.get("kind") == "section"
    }
    assert raenge[drei[2].id] == 0
    assert raenge[drei[0].id] == 1
    assert raenge[drei[1].id] == 2
    # Lückenlos: keine zwei Zeilen mit derselben Position (Wurzel 1).
    assert sorted(raenge.values()) == [0, 1, 2]


def test_baustein_verschieben_ueber_diesen_weg_ist_ein_422() -> None:
    """Zwei Wege auf dieselbe Ordnung wären der Fehler aus Wurzel 2 — die
    Reihenfolge der Bausteine steht am Abschnitt."""
    svc, tables, _ = _seite_mit_zwei_spalten()
    baustein = next(
        z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.move_container(_ctx(), baustein["id"], 0)
    assert exc.value.status_code == 422


def test_abschnitt_duplizieren_kopiert_den_ganzen_teilbaum() -> None:
    """Ein zweispaltiger Abschnitt ließ sich nicht verdoppeln, obwohl das der
    häufigste Handgriff beim Bauen ist: dieselbe Reihe nochmal, dann Inhalt
    tauschen."""
    svc, tables, s = _seite_mit_zwei_spalten()
    vorher = len(tables["site_blocks"])
    kopie = svc.duplicate_container(_ctx(), s["abschnitt"].id)

    # Abschnitt + 2 Spalten + 2 Bausteine = 5 neue Zeilen.
    assert len(tables["site_blocks"]) == vorher + 5
    assert kopie.kind == "section"
    # Die Kopie steht DIREKT hinter dem Original, nicht am Ende.
    positionen = {
        z["id"]: z["position"]
        for z in tables["site_blocks"]
        if z.get("kind") == "section"
    }
    assert positionen[kopie.id] == positionen[s["abschnitt"].id] + 1
    # Die Spalten der Kopie haben ihre Breite behalten.
    spalten_der_kopie = [
        z
        for z in tables["site_blocks"]
        if z.get("parent_id") == kopie.id and z.get("kind") == "column"
    ]
    assert len(spalten_der_kopie) == 2
    assert {z.get("span") for z in spalten_der_kopie} == {6}
    # Und jede trägt ihren Baustein.
    for spalte in spalten_der_kopie:
        assert any(
            z.get("parent_id") == spalte["id"]
            and (z.get("kind") or "widget") == "widget"
            for z in tables["site_blocks"]
        )


def test_duplizieren_eines_bausteins_ist_hier_ein_422() -> None:
    svc, tables, _ = _seite_mit_zwei_spalten()
    baustein = next(
        z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.duplicate_container(_ctx(), baustein["id"])
    assert exc.value.status_code == 422


def test_fremder_container_ist_ein_404_bei_verschieben_und_duplizieren() -> None:
    """Wurzel 3: jeder per-ID-Zugriff ist auf den Betrieb gescopt."""
    tables: dict[str, list[dict]] = {
        "site_pages": [],
        "site_blocks": [
            {
                "id": "b-fremd",
                "tenant_id": "t-ANDERS",
                "page_id": "p-x",
                "type": "container",
                "kind": "section",
                "position": 0,
                "content": {},
                "settings": {},
            }
        ],
    }
    svc = _svc(tables)
    for aufruf in (
        lambda: svc.move_container(_ctx(), "b-fremd", 0),
        lambda: svc.duplicate_container(_ctx(), "b-fremd"),
        lambda: svc.update_block(_ctx(), "b-fremd", BlockUpdate(span=6)),
    ):
        with pytest.raises(SiteConfigError) as exc:
            aufruf()
        assert exc.value.status_code == 404


def test_baustein_kommt_in_die_MITGESCHICKTE_spalte() -> None:
    """`parent_id` wurde für Bausteine ignoriert: jeder bekam seine eigene
    Hülle über die ganze Breite. Damit gab es über `add_block` keinen Weg, etwas
    in eine vorhandene Spalte zu legen — und zwei Bausteine übereinander in
    derselben Spalte waren überhaupt nicht möglich."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    spalte = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container, kind="column", parent_id=abschnitt.id, span=6
        ),
    )
    erster = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.rich_text, parent_id=spalte.id)
    )
    zweiter = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.button, parent_id=spalte.id)
    )
    zeilen = {z["id"]: z for z in tables["site_blocks"]}
    # KEINE neue Hülle: beide hängen an der übergebenen Spalte.
    assert zeilen[erster.id]["parent_id"] == spalte.id
    assert zeilen[zweiter.id]["parent_id"] == spalte.id
    # Und sie stehen in der Spalte in der Reihenfolge ihrer Anlage.
    assert zeilen[erster.id]["position"] == 0
    assert zeilen[zweiter.id]["position"] == 1
    # Genau vier Zeilen: Abschnitt, Spalte, zwei Bausteine.
    assert len(tables["site_blocks"]) == 4


def test_baustein_direkt_in_einen_abschnitt_ist_ein_422() -> None:
    """`site_blocks_tiefe_check` verbietet es in der DB — das hier ist der 422
    davor, statt eines 500 aus Client-Input (Wurzel 5)."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.add_block(
            _ctx(),
            page.id,
            BlockCreate(type=BlockType.rich_text, parent_id=abschnitt.id),
        )
    assert exc.value.status_code == 422


# --- Reihenfolge IN der Spalte + Umhängen (0479) -----------------------------
#
# Der Import steht hier lokal, wie im Vollersatz-Test weiter oben: die beiden
# Formen gehören zu EINEM Vorgang und werden nur von ihm gebraucht.
from src.features.site_config.schemas import (  # noqa: E402
    BlockReplaceItem,
    BlocksReplaceRequest,
)


def test_zwei_bausteine_in_einer_spalte_behalten_ihre_reihenfolge() -> None:
    """Bis 0479 war jedes Widget Position 0 in seiner Spalte. Bei zweien
    entschied danach die Datenbank, welcher oben steht — nach einem Neuladen
    konnte der Knopf über dem Text stehen und beim nächsten darunter."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    spalte = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container, kind="column", parent_id=abschnitt.id, span=12
        ),
    )
    text = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.rich_text, parent_id=spalte.id)
    )
    knopf = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.button, parent_id=spalte.id)
    )

    # Der Editor schickt die Liste UMGEDREHT: Knopf vor Text.
    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=knopf.id, type=BlockType.button, content={}, settings={}
                ),
                BlockReplaceItem(
                    id=text.id, type=BlockType.rich_text, content={}, settings={}
                ),
            ]
        ),
    )
    zeilen = {z["id"]: z for z in tables["site_blocks"]}
    assert zeilen[knopf.id]["position"] == 0
    assert zeilen[text.id]["position"] == 1
    # Und die Liste kommt in dieser Reihenfolge zurück — der Rang wird gelesen,
    # nicht nur geschrieben.
    assert [b.id for b in svc.list_blocks(_ctx(), page.id).items] == [
        knopf.id,
        text.id,
    ]


def test_baustein_laesst_sich_in_eine_andere_spalte_umhaengen() -> None:
    """`parent_id` wurde an Bestandszeilen bewusst nicht angefasst — mit dem
    Effekt, dass sich nichts, was einmal gebaut war, umsortieren ließ."""
    svc, tables, s = _seite_mit_zwei_spalten()
    links, rechts = s["spalten"]
    baustein = next(
        z
        for z in tables["site_blocks"]
        if (z.get("kind") or "widget") == "widget" and z["parent_id"] == links.id
    )
    andere = next(
        z
        for z in tables["site_blocks"]
        if (z.get("kind") or "widget") == "widget" and z["parent_id"] == rechts.id
    )
    svc.replace_blocks(
        _ctx(),
        s["page"].id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=andere["id"],
                    type=BlockType(andere["type"]),
                    content={},
                    settings={},
                    parent_id=rechts.id,
                ),
                BlockReplaceItem(
                    id=baustein["id"],
                    type=BlockType(baustein["type"]),
                    content={},
                    settings={},
                    # Umgezogen: aus der linken in die rechte Spalte.
                    parent_id=rechts.id,
                ),
            ]
        ),
    )
    zeilen = {z["id"]: z for z in tables["site_blocks"]}
    assert zeilen[baustein["id"]]["parent_id"] == rechts.id
    # Und er steht dort UNTER dem, der schon da war.
    assert zeilen[andere["id"]]["position"] == 0
    assert zeilen[baustein["id"]]["position"] == 1


def test_umhaengen_in_eine_fremde_spalte_wird_abgewiesen() -> None:
    """Wurzel 3: das Ziel muss dem eigenen Betrieb und derselben Seite
    gehören — sonst hängte man einen Baustein in eine fremde Seite."""
    svc, tables, s = _seite_mit_zwei_spalten()
    tables["site_blocks"].append(
        {
            "id": "spalte-fremd",
            "tenant_id": "t-ANDERS",
            "page_id": "p-x",
            "type": "container",
            "kind": "column",
            "position": 0,
            "content": {},
            "settings": {},
        }
    )
    baustein = next(
        z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            s["page"].id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(
                        id=baustein["id"],
                        type=BlockType(baustein["type"]),
                        content={},
                        settings={},
                        parent_id="spalte-fremd",
                    )
                ]
            ),
        )
    assert exc.value.status_code == 404


def test_umhaengen_direkt_in_einen_abschnitt_ist_ein_422() -> None:
    svc, tables, s = _seite_mit_zwei_spalten()
    baustein = next(
        z for z in tables["site_blocks"] if (z.get("kind") or "widget") == "widget"
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_blocks(
            _ctx(),
            s["page"].id,
            BlocksReplaceRequest(
                items=[
                    BlockReplaceItem(
                        id=baustein["id"],
                        type=BlockType(baustein["type"]),
                        content={},
                        settings={},
                        parent_id=s["abschnitt"].id,
                    )
                ]
            ),
        )
    assert exc.value.status_code == 422


def test_leere_abschnitte_springen_beim_umsortieren_nicht_nach_oben() -> None:
    """Live gesehen am 28.08.2026: ein Baustein wurde in eine andere Spalte
    gezogen, und die leeren Abschnitte standen danach am Seitenanfang.

    Grund: `ordnung_planen` kennt nur Abschnitte, in denen ein Baustein liegt.
    Die leeren behielten ihre alten Zahlen — zwei Zeilen mit Position 0, und
    die Reihenfolge entschied die Datenbank."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    # Zwei Bausteine (jeder in eigener Hülle) und dazwischen ein LEERER
    # Abschnitt, wie ihn das Layout-Menü anlegt.
    erster = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    leer = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    zweiter = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.spacer))

    # Der Kunde dreht die beiden Bausteine um.
    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=zweiter.id, type=BlockType.spacer, content={}, settings={}
                ),
                BlockReplaceItem(
                    id=erster.id, type=BlockType.hero, content={}, settings={}
                ),
            ]
        ),
    )
    abschnitte = sorted(
        (z for z in tables["site_blocks"] if z.get("kind") == "section"),
        key=lambda z: z["position"],
    )
    # Lückenlos und ohne Dublette — das ist der Kern des Fehlers.
    assert [z["position"] for z in abschnitte] == [0, 1, 2]
    # Und der leere bleibt zwischen den beiden, wo er war.
    assert abschnitte[1]["id"] == leer.id


def test_umhaengen_raeumt_die_verlassene_huelle_ab() -> None:
    """Live gemeldet am 28.08.2026: „hier sind 4 abschnitte es stimmt gar
    nichts". Die Seite trug zwei Bausteine und vier Abschnitte — zwei davon
    Reste, die beim Ziehen eines Bausteins in eine fremde Spalte
    zurückblieben (Wurzel 1: der Gegenzustand fehlte)."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    bleibt = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    zieht_um = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.spacer)
    )
    ziel_spalte = next(
        b["parent_id"] for b in tables["site_blocks"] if b["id"] == bleibt.id
    )
    alte_spalte = next(
        b["parent_id"] for b in tables["site_blocks"] if b["id"] == zieht_um.id
    )
    alter_abschnitt = next(
        z["parent_id"] for z in tables["site_blocks"] if z["id"] == alte_spalte
    )

    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=bleibt.id, type=BlockType.hero, content={}, settings={}
                ),
                BlockReplaceItem(
                    id=zieht_um.id,
                    type=BlockType.spacer,
                    content={},
                    settings={},
                    parent_id=ziel_spalte,
                ),
            ]
        ),
    )

    ids = {z["id"] for z in tables["site_blocks"]}
    # Die verlassene Hülle ist weg — mit ihrer Spalte.
    assert alter_abschnitt not in ids
    assert alte_spalte not in ids
    # Beide Bausteine leben, in derselben Spalte, in dieser Reihenfolge.
    assert {bleibt.id, zieht_um.id} <= ids
    in_spalte = sorted(
        (z for z in tables["site_blocks"] if z.get("parent_id") == ziel_spalte),
        key=lambda z: z["position"],
    )
    assert [z["id"] for z in in_spalte] == [bleibt.id, zieht_um.id]
    # Und genau EIN Abschnitt bleibt, lückenlos ab 0.
    abschnitte = [
        z for z in tables["site_blocks"] if z.get("kind") == "section"
    ]
    assert len(abschnitte) == 1
    assert abschnitte[0]["position"] == 0


def test_umhaengen_laesst_die_leere_spalte_eines_layouts_stehen() -> None:
    """Eine leere Spalte NEBEN einer gefüllten ist das Layout, das der Kunde
    gebaut hat — sie beim Umhängen wegzuräumen wäre Bevormundung. Nur der ganz
    leere Abschnitt fällt."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    baustein = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    spalte_a = next(
        b["parent_id"] for b in tables["site_blocks"] if b["id"] == baustein.id
    )
    abschnitt = next(
        z["parent_id"] for z in tables["site_blocks"] if z["id"] == spalte_a
    )
    # Zweite Spalte im SELBEN Abschnitt, wie „Spalte hinzufügen" sie anlegt.
    spalte_b = svc.add_block(
        _ctx(),
        page.id,
        BlockCreate(
            type=BlockType.container,
            kind="column",
            parent_id=abschnitt,
            span=6,
        ),
    )

    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=baustein.id,
                    type=BlockType.hero,
                    content={},
                    settings={},
                    parent_id=spalte_b.id,
                )
            ]
        ),
    )

    ids = {z["id"] for z in tables["site_blocks"]}
    # Abschnitt und BEIDE Spalten stehen: der Abschnitt trägt weiter einen
    # Baustein, nur eben in der anderen Spalte.
    assert abschnitt in ids
    assert spalte_a in ids
    assert spalte_b.id in ids


def test_ebene_bekommt_einen_eigenen_namen() -> None:
    """Umbenennen ist der Standardgriff jeder Ebenen-Ansicht (Framer, Figma,
    Webflow). Ohne ihn steht „Abschnitt" achtmal untereinander."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    gesetzt = svc.update_block(
        _ctx(), abschnitt.id, BlockUpdate(settings={"name": "  Titelbereich  "})
    )
    # Getrimmt gespeichert — führende Leerzeichen sind kein Teil des Namens.
    assert gesetzt.settings["name"] == "Titelbereich"

    # Nur Leerzeichen ist KEIN Name: die Zeile trüge sonst einen unsichtbaren
    # und zeigte gar nichts an.
    geleert = svc.update_block(
        _ctx(), abschnitt.id, BlockUpdate(settings={"name": "   "})
    )
    assert geleert.settings.get("name") is None


def test_ebenen_name_hat_eine_obergrenze() -> None:
    """Wurzel 8: jeder freie Text bekommt einen Deckel — sonst steht ein
    4-MB-Name in jeder Ebenen-Liste."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.update_block(
            _ctx(), abschnitt.id, BlockUpdate(settings={"name": "x" * 61})
        )
    assert exc.value.status_code == 400


def test_speichern_loescht_keine_fremden_bausteine() -> None:
    """Live nachgewiesen am 28.08.2026: bei GEÖFFNETEM Editor angelegte
    Abschnitte verschwanden beim nächsten Speichern wieder — der Vollersatz
    hielt alles für gelöscht, was nicht in seiner Liste stand, auch was ein
    zweiter Schreiber inzwischen angelegt hatte."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    meiner = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    # Der zweite Schreiber (anderer Reiter, Mobil-App) legt etwas an, NACHDEM
    # der Editor seinen Stand geladen hat.
    fremder = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.spacer))

    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=meiner.id, type=BlockType.hero, content={}, settings={}
                )
            ],
            # Der Editor kannte NUR seinen eigenen Baustein.
            bekannte_ids=[meiner.id],
        ),
    )

    ids = {z["id"] for z in tables["site_blocks"]}
    assert meiner.id in ids
    assert fremder.id in ids, "der fremde Baustein wurde gelöscht"


def test_ohne_bekannte_ids_bleibt_es_beim_vollersatz() -> None:
    """Aufrufer ohne diese Liste (Vorlagen, Skripte) bekommen weiter den
    Vollersatz — dort ist genau das gewollt und es gibt keinen zweiten
    Schreiber."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    einer = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.hero))
    weg = svc.add_block(_ctx(), page.id, BlockCreate(type=BlockType.spacer))

    svc.replace_blocks(
        _ctx(),
        page.id,
        BlocksReplaceRequest(
            items=[
                BlockReplaceItem(
                    id=einer.id, type=BlockType.hero, content={}, settings={}
                )
            ]
        ),
    )
    ids = {z["id"] for z in tables["site_blocks"]}
    assert einer.id in ids
    assert weg.id not in ids


def test_beitrags_abruf_zaehlt_den_aufruf() -> None:
    """Der öffentliche Abruf erhöht den Zähler — in der DATENBANK (0480).

    Geprüft wird, DASS `bump_page_view` gerufen wird und mit welcher Kennung.
    Nicht, dass eine Zahl in einer Zeile steigt: die Erhöhung passiert
    absichtlich nicht im Anwendungscode, sondern in einer Anweisung — genau
    das ist der Unterschied zu lesen-rechnen-schreiben (Wurzel 2).
    """
    db = _DB(_blog_tables())
    assert seiten.beitrag_laden(db, "t-1", "neu") is not None
    assert db.rpc_aufrufe == [("bump_page_view", {"p_page_id": "p-neu"})]


def test_geplanter_beitrag_zaehlt_keinen_aufruf() -> None:
    """Was nicht ausgeliefert wird, wird auch nicht gezählt."""
    db = _DB(_blog_tables())
    assert seiten.beitrag_laden(db, "t-1", "geplant") is None
    assert db.rpc_aufrufe == []


def test_beitragstext_wird_gesaeubert() -> None:
    """Der Beitragstext geht beim SPEICHERN durch die Allowlist (Wurzel 8).

    `<script>` fliegt raus, `<strong>` bleibt. Geprüft wird der Validator und
    nicht der Renderer: wer erst beim Ausliefern säubert, säubert irgendwann
    an einer Stelle nicht.
    """
    body = seiten.BeitragUpdate(
        content_html='<p>Hallo <strong>Welt</strong></p><script>alert(1)</script>'
    )
    assert body.content_html == "<p>Hallo <strong>Welt</strong></p>"


def test_beitragstext_behaelt_was_der_editor_schreibt() -> None:
    """Bild, Tabelle, Marker und Hochstellung überleben — sie stehen in der
    Allowlist, weil der Editor Knöpfe dafür hat (0480)."""
    roh = (
        '<p style="text-align:center">A<sup>1</sup> <mark>B</mark></p>'
        '<img src="https://example.com/b.jpg" alt="B">'
        "<table><tbody><tr><td>Z</td></tr></tbody></table><hr>"
    )
    body = seiten.BeitragUpdate(content_html=roh)
    text = body.content_html or ""
    for teil in ("<sup>", "<mark>", "<img", "<table>", "<hr>", "text-align"):
        assert teil in text, teil


def test_leerer_beitragstext_ist_none() -> None:
    """Ein leeres Dokument ist KEIN Inhalt — sonst gälte ein Pflichtfeld als
    gefüllt, obwohl nichts drinsteht (Wurzel 4)."""
    assert seiten.BeitragUpdate(content_html="   ").content_html is None


# ===========================================================================
# 0481 — Zweite Sichtbarkeitsachse und Feldkonfiguration
# (`docs/FRAMER-CMS-ANALYSE.md`, Abschnitte C1 und G)
# ===========================================================================
from src.features.site_config import beitrag_felder  # noqa: E402


def test_von_der_uebersicht_genommener_beitrag_bleibt_unter_seiner_adresse(
) -> None:
    """Der ganze Sinn der ZWEITEN Achse (Framer-Analyse G).

    „Fertig" und „wo sichtbar" sind zwei Fragen. Ein Beitrag, den der Betrieb
    aus der Übersicht nimmt, ist NICHT zurückgezogen — sein Link muss weiter
    tragen, sonst wären geteilte Adressen plötzlich tot und die zweite Achse
    wäre nur ein zweiter Name für `is_published`.
    """
    tabellen = _blog_tables()
    for zeile in tabellen["site_pages"]:
        if zeile["slug"] == "alt":
            zeile["show_on_homepage"] = False
    db = _DB(tabellen)

    # Aus der Übersicht verschwunden …
    assert [b["slug"] for b in seiten.beitraege_laden(db, "t-1")] == ["neu"]
    # … über seine Adresse aber weiterhin da.
    assert seiten.beitrag_laden(db, "t-1", "alt") is not None


def test_zweite_achse_ist_nicht_der_veroeffentlichungsstatus() -> None:
    """Beide Achsen wirken unabhängig: sichtbar geschaltet, aber nicht
    veröffentlicht, bleibt draußen. Wer nur eine der beiden prüft, hält die
    andere für wirkungslos."""
    tabellen = _blog_tables()
    for zeile in tabellen["site_pages"]:
        if zeile["slug"] == "neu":
            zeile["is_published"] = False
            zeile["show_on_homepage"] = True
    db = _DB(tabellen)
    assert [b["slug"] for b in seiten.beitraege_laden(db, "t-1")] == ["alt"]


def test_feldkonfig_kennt_nur_die_festen_felder() -> None:
    """Ein unbekannter Schlüssel ist ein Fehler und kein stilles Verwerfen.

    Eine Konfiguration, die gespeichert wird und nie wirkt, schickt den Kunden
    auf die Suche an der falschen Stelle (Wurzel 4/5)."""
    with pytest.raises(ValidationError):
        beitrag_felder.FeldKonfig(feld_key="erfundenes_feld")
    # Der Titel ist bewusst NICHT konfigurierbar — ohne ihn ist ein Beitrag in
    # keiner Liste auffindbar.
    with pytest.raises(ValidationError):
        beitrag_felder.FeldKonfig(feld_key="title")
    # Ein echtes Feld geht durch.
    assert beitrag_felder.FeldKonfig(feld_key="excerpt").feld_key == "excerpt"


def test_leer_gemachtes_label_faellt_auf_die_vorgabe_zurueck() -> None:
    """Ein leerer String in der DB wäre ein Feld ganz ohne Beschriftung —
    gemeint ist „wieder der eingebaute Name"."""
    k = beitrag_felder.FeldKonfig(
        feld_key="author", label="   ", beschreibung=""
    )
    assert k.label is None
    assert k.beschreibung is None


def test_maximallaenge_null_ist_kein_gueltiges_feld() -> None:
    """„Null Zeichen erlaubt" wäre ein Feld, das nichts annimmt. Der DB-CHECK
    sagt dasselbe — beide Grenzen gehören zusammen."""
    with pytest.raises(ValidationError):
        beitrag_felder.FeldKonfig(feld_key="excerpt", max_zeichen=0)


def test_pflichtfeld_laesst_sich_nicht_ausblenden() -> None:
    """Sonst wäre es ein Dialog, den man nicht abschicken kann, ohne zu sehen
    warum (Wurzel 5)."""
    db = _DB({"site_post_field_config": []})
    with pytest.raises(ValueError, match="Pflichtfeld"):
        beitrag_felder.konfig_setzen(
            db,
            "t-1",
            beitrag_felder.FeldKonfig(
                feld_key="excerpt", pflicht=True, versteckt=True
            ),
        )


def test_beitragstext_laesst_sich_nicht_ausblenden() -> None:
    """Ohne Text entsteht kein Beitrag — das Feld ist nicht wegschaltbar."""
    db = _DB({"site_post_field_config": []})
    with pytest.raises(ValueError, match="ausblenden"):
        beitrag_felder.konfig_setzen(
            db,
            "t-1",
            beitrag_felder.FeldKonfig(feld_key="content", versteckt=True),
        )


def test_feldkonfig_liest_nur_den_eigenen_betrieb() -> None:
    """Die Service-Rolle umgeht RLS — der Tenant-Scope ist die ganze
    Zugangskontrolle (Wurzel 3)."""
    db = _DB(
        {
            "site_post_field_config": [
                {
                    "tenant_id": "t-1", "feld_key": "author",
                    "label": "Verfasser", "beschreibung": None,
                    "platzhalter": None, "max_zeichen": None,
                    "pflicht": False, "mehrzeilig": False, "versteckt": False,
                },
                {
                    "tenant_id": "t-2", "feld_key": "author",
                    "label": "FREMD", "beschreibung": None,
                    "platzhalter": None, "max_zeichen": None,
                    "pflicht": False, "mehrzeilig": False, "versteckt": False,
                },
            ]
        }
    )
    felder = beitrag_felder.konfig_laden(db, "t-1").felder
    assert [f.label for f in felder] == ["Verfasser"]


def test_zuruecksetzen_loescht_nur_die_eigene_zeile() -> None:
    """Ein `delete` ohne Tenant-Bedingung nähme die gleichnamige Zeile jedes
    anderen Betriebs mit — genau der Fall, den CLAUDE.md verbietet."""
    db = _DB(
        {
            "site_post_field_config": [
                {
                    "tenant_id": "t-1", "feld_key": "author",
                    "label": "Meiner", "beschreibung": None,
                    "platzhalter": None, "max_zeichen": None,
                    "pflicht": False, "mehrzeilig": False, "versteckt": False,
                },
                {
                    "tenant_id": "t-2", "feld_key": "author",
                    "label": "Fremder", "beschreibung": None,
                    "platzhalter": None, "max_zeichen": None,
                    "pflicht": False, "mehrzeilig": False, "versteckt": False,
                },
            ]
        }
    )
    beitrag_felder.konfig_zuruecksetzen(db, "t-1", "author")
    uebrig = db.tables["site_post_field_config"]
    assert [z["tenant_id"] for z in uebrig] == ["t-2"]


def test_zuruecksetzen_eines_unbekannten_feldes_ist_ein_fehler() -> None:
    """Sonst meldet der Aufruf Erfolg, ohne etwas getan zu haben."""
    db = _DB({"site_post_field_config": []})
    with pytest.raises(ValueError, match="Unbekanntes Beitragsfeld"):
        beitrag_felder.konfig_zuruecksetzen(db, "t-1", "gibt_es_nicht")


# ===========================================================================
# 0484 — Beitrag und Seite teilen den Slug-Namensraum NICHT
# ===========================================================================


def _slug_tabellen() -> dict[str, list[dict]]:
    """Eine Seite und ein Beitrag, beide mit dem Slug „kontakt"."""
    return {
        "site_pages": [
            {
                "id": "s-1", "tenant_id": "t-1", "page_type": "normal",
                "slug": "kontakt", "title": "Kontakt",
            },
            {
                "id": "p-1", "tenant_id": "t-1", "page_type": "post",
                "slug": "kontakt", "title": "Kontakt aufnehmen",
                "show_on_homepage": True,
            },
        ],
    }


def test_beitrag_darf_slug_einer_seite_tragen() -> None:
    """Der Kern von 0484.

    Beiträge liegen unter `/blog/<slug>`, Seiten unter `/<slug>` — zwei
    getrennte Adressräume. Bis dahin lief EIN UNIQUE über beide, und das
    Anlegen brach mit „Es gibt bereits eine Seite mit diesem Slug" ab: eine
    Meldung, die auf ein Problem zeigt, das der Kunde nicht hat.
    """
    db = _DB(_slug_tabellen())
    # Der Beitrag sieht die gleichnamige SEITE nicht …
    assert not seiten.slug_belegt(db, "t-1", "kontakt", "post", ausser_id="p-1")
    # … und die Seite nicht den gleichnamigen BEITRAG.
    assert not seiten.slug_belegt(
        db, "t-1", "kontakt", "normal", ausser_id="s-1"
    )


def test_zwei_beitraege_teilen_keinen_slug() -> None:
    """Innerhalb des Blogs bleibt der Slug eindeutig — sonst zeigten zwei
    Beiträge auf dieselbe Adresse."""
    db = _DB(_slug_tabellen())
    assert seiten.slug_belegt(db, "t-1", "kontakt", "post")


def test_seite_und_ordner_teilen_den_slug_weiterhin_nicht() -> None:
    """Die Trennlinie verläuft an der ADRESSE, nicht am Typ.

    Ein Ordner liegt wie eine normale Seite unter `/<slug>`; ein UNIQUE über
    `page_type` hätte beiden denselben Slug erlaubt. Genau deshalb prüft der
    Helfer `<> 'post'` und nicht `= <typ>`.
    """
    db = _DB(
        {
            "site_pages": [
                {
                    "id": "o-1", "tenant_id": "t-1", "page_type": "folder",
                    "slug": "reisen", "title": "Reisen",
                },
            ]
        }
    )
    assert seiten.slug_belegt(db, "t-1", "reisen", "normal")


def test_slug_pruefung_endet_am_eigenen_betrieb() -> None:
    """Der Slug eines fremden Betriebs blockiert nichts (Wurzel 3)."""
    db = _DB(
        {
            "site_pages": [
                {
                    "id": "f-1", "tenant_id": "t-2", "page_type": "post",
                    "slug": "sommer", "title": "Fremd",
                },
            ]
        }
    )
    assert not seiten.slug_belegt(db, "t-1", "sommer", "post")


def test_konfliktmeldung_nennt_den_betroffenen_raum() -> None:
    """„Es gibt bereits eine Seite …" schickte den Kunden in die Seitenliste,
    wo für einen Beitragskonflikt nichts steht."""
    assert "Beitrag" in seiten.slug_konflikt_text("post")
    assert "Seite" in seiten.slug_konflikt_text("normal")


def test_startseite_laesst_sich_nicht_loeschen() -> None:
    """Der Riegel sitzt im Backend, nicht nur im Menü (Wurzel 3).

    Ohne Startseite antwortet die Domain nur noch „noch nicht eingerichtet";
    der Weg ist: andere Seite zur Startseite machen, dann löschen.
    """
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": True, "nav_order": 0},
            {"id": "p2", "tenant_id": "t-1", "slug": "b", "title": "B",
             "is_home": False, "is_published": False, "nav_order": 1},
        ]
    }
    svc = _svc(tables)
    with pytest.raises(SiteConfigError) as exc:
        svc.delete_page(_ctx(), "p1")
    assert exc.value.status_code == 422
    assert len(tables["site_pages"]) == 2

    svc.set_home_page(_ctx(), "p2")
    svc.delete_page(_ctx(), "p1")
    assert [p["id"] for p in tables["site_pages"]] == ["p2"]


def test_gesperrte_ebene_laesst_sich_nicht_loeschen_oder_bewegen() -> None:
    """``settings.locked`` gilt auch am API-Pfad (Wurzel 6), nicht nur im Menü."""
    tables = {
        "site_pages": [
            {"id": "p1", "tenant_id": "t-1", "slug": "", "title": "A",
             "is_home": True, "is_published": True, "nav_order": 0},
        ],
        "site_blocks": [
            {"id": "s1", "tenant_id": "t-1", "page_id": "p1", "kind": "section",
             "parent_id": None, "position": 0, "type": "container",
             "content": {}, "settings": {"locked": True}},
            {"id": "s2", "tenant_id": "t-1", "page_id": "p1", "kind": "section",
             "parent_id": None, "position": 1, "type": "container",
             "content": {}, "settings": {}},
        ],
    }
    svc = _svc(tables)
    with pytest.raises(SiteConfigError) as exc:
        svc.remove_block(_ctx(), "s1")
    assert exc.value.status_code == 422
    with pytest.raises(SiteConfigError):
        svc.move_container(_ctx(), "s1", 1)
    with pytest.raises(SiteConfigError):
        svc.duplicate_container(_ctx(), "s1")
    assert len(tables["site_blocks"]) == 2
    # Entsperren geht über die Einstellungen — danach darf gelöscht werden.
    tables["site_blocks"][0]["settings"] = {}
    svc.remove_block(_ctx(), "s1")
    assert [b["id"] for b in tables["site_blocks"]] == ["s2"]


# --- Framer-Inspektor: verschachtelte Darstellung (Etappe 2, 05.09.2026) -----
def test_darstellung_unterobjekte_werden_gespeichert_und_normalisiert() -> None:
    """Position/Größe/Stil/Transform/Scroll/A11y und die Geräte-Überschreibung
    kommen als Unterobjekte in `settings` an und wieder heraus — mit den
    Standardwerten der Teilfelder (Grenzart `solid`, Schatten-x `0`), damit der
    Renderer nie raten muss."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    gesetzt = svc.update_block(
        _ctx(),
        abschnitt.id,
        BlockUpdate(
            settings={
                "position": {"typ": "klebend", "oben": "0px", "ebene": 5},
                "groesse": {
                    "breite": {"modus": "relativ", "wert": 100},
                    "hoehe": {"modus": "inhalt"},
                    "seitenverhaeltnis": "16/9",
                },
                "stil": {
                    "opazitaet": 0.8,
                    "mischmodus": "multiply",
                    "filter": {"weichzeichnen": 4, "graustufen": 50},
                    "ueberlauf_x": "scrollen",
                    "zeiger_ereignisse": False,
                    "text_auswahl": False,
                    "tippfarbe": "#00000000",
                    "fuellung": {"art": "farbe", "farbe": "rolle:primary"},
                    "radius": {"alle": 24},
                    "grenze": {"breite": 1, "farbe": "#e4e4e7"},
                    "schatten": [{"y": 2, "weich": 8, "farbe": "#00000040"}],
                },
                "transform": {
                    "rotation": -3.5,
                    "skalierung": 1.05,
                    "rotation_x": 15,
                    "tiefe": -40,
                    "rueckseite": "verborgen",
                    "raum_3d": True,
                },
                "scroll": {"anker": "kontakt", "versatz_y": 80},
                "a11y": {"tag": "section", "label": "Kontakt", "nosnippet": True},
                "link": {
                    "href": "/kontakt",
                    "neuer_tab": True,
                    "anker": "preise",
                    "rel": ["nofollow"],
                    "parameter": "utm_source=web",
                },
                "cursor": "pointer",
                "effekte": {
                    "erscheinen": {"art": "hochgleiten"},
                    "hover": {"skalierung": 1.05},
                    "schleife": {"art": "schweben", "dauer": 3000},
                    "scroll_tempo": 120,
                },
                "layout_typ": "raster",
                "raster_spalten": 3,
                "raster_abstand_x": 24,
                "text": {
                    "schrift": "ueberschrift",
                    "farbe": "rolle:foreground",
                    "groesse": "3.5rem",
                    "gewicht": 600,
                    "laufweite": "-0.035em",
                    "zeilenhoehe": "1.02em",
                    "ausrichtung": "center",
                    "balance": True,
                    "kuerzen": 2,
                    "opentype": ["tnum", "liga"],
                },
                "je_geraet": {
                    "mobil": {
                        "stil": {"opazitaet": 1},
                        "layout_richtung": "spalte",
                        "text": {"groesse": "2rem"},
                    }
                },
            }
        ),
    )
    s = gesetzt.settings
    assert s["link"]["rel"] == ["nofollow"]
    assert s["link"]["parameter"] == "utm_source=web"
    assert s["cursor"] == "pointer"
    # Effekte kommen mit ihren Standardwerten zurück (Dauer, Verzögerung).
    assert s["effekte"]["erscheinen"] == {
        "art": "hochgleiten", "dauer": 600, "verzoegerung": 0, "wiederholen": False,
    }
    assert s["effekte"]["hover"] == {"skalierung": 1.05, "dauer": 200}
    assert s["effekte"]["schleife"] == {"art": "schweben", "dauer": 3000}
    assert s["effekte"]["scroll_tempo"] == 120
    assert s["layout_typ"] == "raster" and s["raster_spalten"] == 3
    assert s["stil"]["mischmodus"] == "multiply"
    assert s["stil"]["filter"] == {"weichzeichnen": 4, "graustufen": 50}
    assert s["stil"]["zeiger_ereignisse"] is False
    assert s["text"]["opentype"] == ["tnum", "liga"]
    assert s["transform"]["rotation_x"] == 15
    assert s["transform"]["tiefe"] == -40
    assert s["transform"]["rueckseite"] == "verborgen"
    assert s["transform"]["raum_3d"] is True
    assert s["a11y"]["nosnippet"] is True
    assert s["text"]["groesse"] == "3.5rem"
    assert s["text"]["gewicht"] == 600
    assert s["je_geraet"]["mobil"]["text"] == {"groesse": "2rem"}
    assert s["position"] == {"typ": "klebend", "oben": "0px", "ebene": 5}
    assert s["groesse"]["breite"] == {"modus": "relativ", "wert": 100.0}
    assert s["groesse"]["hoehe"] == {"modus": "inhalt"}
    assert s["stil"]["grenze"]["art"] == "solid"
    assert s["stil"]["schatten"][0]["x"] == 0
    assert s["stil"]["fuellung"]["farbe"] == "rolle:primary"
    assert s["je_geraet"]["mobil"]["layout_richtung"] == "spalte"
    assert s["a11y"]["tag"] == "section"


# --- Style-Panel Etappe 5 (06.09.2026): Overlay, Code, Cursor-Bild, Effekte ---
def test_darstellung_etappe5_wird_gespeichert_und_normalisiert() -> None:
    """Overlay, Codeüberschreibung, eigener Cursor, die vier neuen Effekte,
    Maske, Auswahlfarben, Verlaufsform, Textstil-Rolle, Schriftfamilie und
    Link-Scrollen kommen mit ihren Vorgabewerten aus dem Modell zurück; das CSS
    der Codeüberschreibung ist bereinigt (eine Zeile je Eigenschaft)."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    gesetzt = svc.update_block(
        _ctx(),
        abschnitt.id,
        BlockUpdate(
            settings={
                "link": {"href": "/kontakt", "anker": "form", "scrollen": "sanft"},
                "stil": {
                    "fuellung": {
                        "art": "verlauf",
                        "form": "konisch",
                        "lage": "top left",
                        "stufen": [
                            {"farbe": "#ffffff", "position": 0},
                            {"farbe": "#000000", "position": 100},
                        ],
                    },
                    "maske": {"art": "linear", "ende": 60},
                    "auswahl_farbe": "#ffffff",
                    "auswahl_hintergrund": "rolle:primary",
                },
                "text": {"schrift": "h2", "schriftfamilie": "Lora"},
                "cursor_bild": {"url": "/media/hand.png", "x": 4},
                "overlay": {
                    "ausloeser": "hover",
                    "inhalt": {"de": " Mehr dazu ", "en": ""},
                },
                "code": {"css": "color: red;  margin-top:4px\nletter-spacing: .1em"},
                "effekte": {
                    "ziehen": {"frei": False, "achse": "x"},
                    "lichtkasten": {},
                    "ticker": {"tempo": 150, "hover": "stopp"},
                    "scroll_transform": {"nach": {"opazitaet": 0.2}},
                },
            }
        ),
    )
    s = gesetzt.settings
    assert s["link"]["scrollen"] == "sanft"
    assert s["stil"]["fuellung"]["form"] == "konisch"
    assert s["stil"]["maske"] == {
        "art": "linear", "winkel": 180, "start": 0, "ende": 60, "umkehren": False,
    }
    assert s["stil"]["auswahl_hintergrund"] == "rolle:primary"
    assert s["text"] == {"schrift": "h2", "schriftfamilie": "Lora"}
    assert s["cursor_bild"] == {"url": "/media/hand.png", "x": 4, "y": 0}
    assert s["overlay"]["ausloeser"] == "hover"
    assert s["overlay"]["typ"] == "relativ" and s["overlay"]["schliessen"] == "auto"
    # Leere Sprachfassung fällt weg, Text wird getrimmt.
    assert s["overlay"]["inhalt"] == {"de": "Mehr dazu"}
    assert s["code"]["css"] == "color: red;\nmargin-top: 4px;\nletter-spacing: .1em;"
    assert s["effekte"]["ziehen"] == {"frei": False, "achse": "x", "zurueck": False}
    assert s["effekte"]["lichtkasten"] == {
        "max_breite": 800, "innenabstand": 20, "ebene": 10, "hintergrund": "#000000",
    }
    assert s["effekte"]["ticker"]["hover"] == "stopp"
    assert s["effekte"]["scroll_transform"]["ausloeser"] == "scroll"


@pytest.mark.parametrize(
    "settings",
    [
        # Etappe 5 (06.09.2026): jedes neue Feld weist Falsches ab.
        {"link": {"href": "/a", "scrollen": "smooth"}},
        {"stil": {"fuellung": {"art": "farbe", "farbe": "#000000", "form": "spiral"}}},
        {"stil": {"maske": {"start": 60, "ende": 40}}},
        {"stil": {"auswahl_farbe": "red"}},
        {"text": {"schrift": "h7"}},
        {"text": {"schriftfamilie": "Comic Sans MS"}},
        {"cursor_bild": {"url": "javascript:alert(1)"}},
        {"cursor_bild": {"url": "/c.png", "x": 200}},
        {"overlay": {"inhalt": {"xx": "Hallo"}}},
        {"overlay": {"typ": "modal"}},
        {"overlay": {"breite": 50}},
        # Code: unbekannte Eigenschaft, url(), zweite Regel, kein Doppelpunkt.
        {"code": {"css": "behavior: x"}},
        {"code": {"css": "background-image: url(https://x)"}},
        {"code": {"css": "color: red } body { display:none"}},
        {"code": {"css": "color red"}},
        {"code": {"css": ""}},
        {"effekte": {"ziehen": {"achse": "z"}}},
        {"effekte": {"lichtkasten": {"max_breite": 100}}},
        {"effekte": {"ticker": {"tempo": 0}}},
        {"effekte": {"scroll_transform": {"ausloeser": "scroll"}}},
        # Overlay, Code und Cursor-Bild gibt es nicht je Gerät.
        {"je_geraet": {"mobil": {"overlay": {"typ": "fixiert"}}}},
        {"je_geraet": {"mobil": {"code": {"css": "color: red"}}}},
        {"text": {"groesse": "62"}},
        {"text": {"gewicht": 450}},
        {"text": {"farbe": "red"}},
        {"link": {"neuer_tab": True}},
        {"link": {"href": "javascript:alert(1)"}},
        # Tippfehler im Unterobjekt: darf nicht still verschwinden (Wurzel 5).
        {"stil": {"opazität": 1}},
        # Desktop IST die Grundfassung — kein Eintrag in je_geraet.
        {"je_geraet": {"desktop": {"stil": {"opazitaet": 1}}}},
        # Modus mit Pflichtwert ohne Wert / Modus ohne Wert mit Wert.
        {"groesse": {"breite": {"modus": "fest"}}},
        {"groesse": {"hoehe": {"modus": "inhalt", "wert": 3}}},
        # Farbe: kein CSS-Name, keine unbekannte Rolle.
        {"stil": {"grenze": {"breite": 1, "farbe": "red"}}},
        {"stil": {"fuellung": {"art": "farbe", "farbe": "rolle:pink"}}},
        # Bild-Füllung trägt die href-Allowlist (Wurzel 8).
        {"stil": {"fuellung": {"art": "bild", "url": "javascript:alert(1)"}}},
        # Verlauf ohne Stufen, Füllung „farbe“ ohne Farbe.
        {"stil": {"fuellung": {"art": "verlauf", "winkel": 90}}},
        {"stil": {"fuellung": {"art": "farbe"}}},
        # Grenzen (Wurzel 8).
        {"position": {"ebene": 9999}},
        {"stil": {"radius": {"alle": 501}}},
        {"stil": {"schatten": [{"farbe": "#000000"}] * 7}},
        {"transform": {"rotation": 361}},
        # 3D / Cursor / Link-Abschnitt (06.09.2026).
        {"transform": {"tiefe": 501}},
        {"transform": {"rueckseite": "hidden"}},
        {"cursor": "url(x)"},
        # Stile+/OpenType/Link/Effekte/Raster (06.09.2026, Teil 2).
        {"stil": {"mischmodus": "plus-lighter"}},
        {"stil": {"filter": {"weichzeichnen": 101}}},
        {"stil": {"tippfarbe": "red"}},
        {"text": {"opentype": ["ligatures"]}},
        {"link": {"href": "/a", "rel": ["me"]}},
        {"link": {"href": "/a", "parameter": "?utm=1"}},
        {"link": {"href": "/a", "parameter": "a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10&k=11"}},
        {"effekte": {"erscheinen": {"art": "explodieren"}}},
        {"effekte": {"scroll_tempo": 5}},
        {"effekte": {"hover": {"skalierung": 11}}},
        {"je_geraet": {"mobil": {"effekte": {"scroll_tempo": 120}}}},
        {"layout_typ": "grid"},
        {"raster_spalten": 13},
        {"link": {"href": "/a", "anker": "Preise Oben"}},
        # Cursor gibt es nicht je Gerät (Touch hat keinen Zeiger).
        {"je_geraet": {"mobil": {"cursor": "pointer"}}},
        {"scroll": {"anker": "Kontakt Bereich"}},
        {"a11y": {"tag": "button"}},
        {"a11y": {"tab_index": 5000}},
        {"groesse": {"seitenverhaeltnis": "16:9"}},
    ],
)
def test_darstellung_weist_ungueltige_unterobjekte_ab(settings: dict) -> None:
    """Jeder Fehler in einem Unterobjekt ist ein 400 — nichts wird verworfen,
    nichts erfunden."""
    tables: dict[str, list[dict]] = {"site_pages": [], "site_blocks": []}
    svc = _svc(tables)
    page = svc.create_page(_ctx(), PageCreate(title="Start", slug=""))
    abschnitt = svc.add_block(
        _ctx(), page.id, BlockCreate(type=BlockType.container, kind="section")
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.update_block(_ctx(), abschnitt.id, BlockUpdate(settings=settings))
    assert exc.value.status_code == 400


# --- Kopf-/Fußzeile als Ebenen (0570, 05.09.2026) ----------------------------
def test_kopf_und_fusszeile_teile_werden_gespeichert() -> None:
    """Sichtbarkeit je Gerät, Sperre und Reihenfolge der Teile landen im
    Branding und kommen normalisiert zurück (Geräte entdoppelt, sortiert)."""
    tables: dict[str, list[dict]] = {"tenant_site_config": []}
    svc = _svc(tables)
    svc.set_branding(
        _ctx(),
        BrandingUpdate(
            header_teile={
                "reihenfolge": ["navigation", "buchen", "sprachwaehler"],
                "teile": {"buchen": {"hidden_on": ["mobil", "mobil", "desktop"]}},
            },
            footer_teile={"hidden_on": ["mobil"], "teile": {"social": {"locked": True}}},
        ),
    )
    got = svc.get_branding(_ctx())
    assert got.header_teile is not None and got.footer_teile is not None
    assert got.header_teile.reihenfolge == ["navigation", "buchen", "sprachwaehler"]
    assert got.header_teile.teile["buchen"].hidden_on == ["desktop", "mobil"]
    assert got.footer_teile.hidden_on == ["mobil"]
    assert got.footer_teile.teile["social"].locked is True
    # Die öffentliche Antwort trägt die Werte mit — der Renderer braucht sie.
    oeffentlich = svc._public_branding("t-1")  # noqa: SLF001
    assert oeffentlich.header_teile is not None
    assert oeffentlich.header_teile.reihenfolge == ["navigation", "buchen", "sprachwaehler"]


@pytest.mark.parametrize(
    "feld,wert",
    [
        # Unbekannter Teil / Teil der anderen Region.
        ("header_teile", {"teile": {"social": {"locked": True}}}),
        ("footer_teile", {"teile": {"logo": {"locked": True}}}),
        ("header_teile", {"reihenfolge": ["logo", "impressum"]}),
        # Doppelt in der Reihenfolge.
        ("footer_teile", {"reihenfolge": ["social", "social"]}),
        # Unbekanntes Gerät, Tippfehler im Schlüssel.
        ("header_teile", {"teile": {"logo": {"hidden_on": ["tv"]}}}),
        ("header_teile", {"teile": {"logo": {"versteckt": True}}}),
        ("footer_teile", {"reihe": ["social"]}),
    ],
)
def test_teile_weisen_unbekanntes_ab(feld: str, wert: dict) -> None:
    """Ein Teilname ohne Stelle im Renderer wäre eine Zeile, die nichts tut
    (Wurzel 4) — und ein Tippfehler darf nicht still verschwinden (Wurzel 5)."""
    with pytest.raises(ValidationError):
        BrandingUpdate(**{feld: wert})
