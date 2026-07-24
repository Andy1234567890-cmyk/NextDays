"""Service-Schicht für site_config (White-Label-Branding + Custom-Domains).

CRUD über die Service-Role mit explizitem tenant-Scope (tenant_id stammt immer aus
dem JWT, nie aus User-Input — Muster wie addons/properties). Die Custom-Domain-
Operationen sprechen Cloudflare for SaaS (Custom Hostnames) an; der CF-Status wird
in die DB gespiegelt.

Der öffentliche Resolver ``resolve_site_by_domain`` läuft OHNE ctx/JWT (die
öffentliche Buchungs-Site ist nicht eingeloggt) über die Service-Role und gibt NUR
öffentliche Branding-Felder zurück (PublicSiteResponse) — kein cf_*-Feld, kein
Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from datetime import UTC, datetime

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from . import templates as site_templates
from .cloudflare_client import CloudflareClient, CloudflareError
from .schemas import (
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlockType,
    BlockUpdate,
    BrandingResponse,
    BrandingUpdate,
    CustomDomainListResponse,
    CustomDomainResponse,
    DnsRecord,
    DomainCreate,
    DomainStatus,
    PageCreate,
    PageListResponse,
    PageResponse,
    PageUpdate,
    PublicBlock,
    PublicPageMeta,
    PublicPageResponse,
    PublicSiteResponse,
    SliceHealth,
    validate_block_content,
)

log = get_logger("nextdays.site_config")

_BRANDING_COLS = (
    "site_name, tagline, logo_url, hero_image_url, primary_color, "
    "secondary_color, font_family, about_text, contact_text, social_links, "
    "booking_mode"
)
_DOMAIN_COLS = (
    "id, tenant_id, domain, cf_custom_hostname_id, status, ssl_status, "
    "last_synced_at"
)
# Öffentliche Felder + tenant_id, um vom Domain-Treffer aufs Branding zu joinen.
_PUBLIC_COLS = f"tenant_id, {_BRANDING_COLS}"
_PAGE_COLS = (
    "id, slug, title, seo_title, seo_description, og_image_url, is_home, "
    "is_published, nav_order"
)
_BLOCK_COLS = "id, page_id, type, position, content, settings"


class SiteConfigError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SiteConfigService:
    slice_name = "site_config"

    def __init__(
        self, service_client: Client, cloudflare: CloudflareClient
    ) -> None:
        self._db = service_client
        self._cf = cloudflare

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise SiteConfigError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # --- Branding (Dashboard, MANAGE_SITE_CONFIG) ----------------------------

    def get_branding(self, ctx: AuthContext) -> BrandingResponse:
        """Branding des Tenants. Fehlt die Zeile → leere Config (Defaults/None),
        kein erfundener Wert."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("tenant_site_config")
            .select(_BRANDING_COLS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return BrandingResponse()
        return BrandingResponse(**rows[0])

    def set_branding(
        self, ctx: AuthContext, req: BrandingUpdate
    ) -> BrandingResponse:
        """Branding upserten (1:1 pro Tenant). tenant_id NIE aus Input."""
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json", exclude_unset=True)
        payload["tenant_id"] = tenant_id
        res = (
            self._db.table("tenant_site_config")
            .upsert(payload, on_conflict="tenant_id")
            .execute()
        )
        if not res.data:
            raise SiteConfigError(
                "Branding konnte nicht gespeichert werden.", status_code=500
            )
        return self.get_branding(ctx)

    # --- Custom-Domains (Dashboard, MANAGE_SITE_CONFIG) ----------------------

    def list_domains(self, ctx: AuthContext) -> CustomDomainListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("tenant_custom_domains")
            .select(_DOMAIN_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [self._domain_row(r) for r in rows]
        return CustomDomainListResponse(items=items, total=len(items))

    def add_domain(
        self, ctx: AuthContext, req: DomainCreate
    ) -> CustomDomainResponse:
        """Registriert eine Custom-Domain bei Cloudflare (TXT-SSL) und legt sie
        tenant-gescoped an. Gibt CNAME + TXT-Validierungs-Record zurück."""
        tenant_id = self._require_tenant(ctx)
        domain = req.domain  # bereits lowercase/validiert im Schema

        # Vorab-Prüfung gegen Doppelvergabe (DB-unique ist der harte Backstop).
        existing = (
            self._db.table("tenant_custom_domains")
            .select("id")
            .eq("domain", domain)
            .limit(1)
            .execute()
        ).data or []
        if existing:
            raise SiteConfigError("Domain ist bereits vergeben.", status_code=409)

        try:
            cf = self._cf.create_custom_hostname(domain)
        except CloudflareError as exc:
            raise SiteConfigError(exc.message, status_code=exc.status_code) from exc

        cf_id = cf.get("id")
        ssl = cf.get("ssl") or {}
        payload = {
            "tenant_id": tenant_id,
            "domain": domain,
            "cf_custom_hostname_id": cf_id,
            "status": DomainStatus.pending.value,
            "ssl_status": ssl.get("status"),
        }
        # Der CF-Hostname ist bereits angelegt. Schlägt der DB-Insert fehl (leere
        # Rückgabe ODER Unique-Verletzung durch eine parallele Registrierung —
        # die Vorab-Prüfung oben ist TOCTOU), würde er sonst als Waise bei
        # Cloudflare zurückbleiben (nie über remove_domain aufräumbar, blockiert
        # ggf. eine spätere legitime Registrierung). Daher: bei jedem Fehler den
        # CF-Hostname wieder löschen (best-effort), dann sauber melden.
        try:
            res = self._db.table("tenant_custom_domains").insert(payload).execute()
        except Exception as exc:  # noqa: BLE001 — DB-Fehler → CF-Rollback
            self._rollback_cf_hostname(cf_id)
            # Unique-Verletzung (parallele Registrierung) als 409 melden.
            if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                raise SiteConfigError(
                    "Domain ist bereits vergeben.", status_code=409
                ) from exc
            raise SiteConfigError(
                "Domain konnte nicht gespeichert werden.", status_code=500
            ) from exc
        if not res.data:
            self._rollback_cf_hostname(cf_id)
            raise SiteConfigError(
                "Domain konnte nicht gespeichert werden.", status_code=500
            )
        row = res.data[0]
        return self._domain_row(row, dns_records=self._dns_records(domain, ssl))

    def _rollback_cf_hostname(self, cf_id: str | None) -> None:
        """Verwaisten Cloudflare-Custom-Hostname wieder entfernen (best-effort —
        ein Fehler beim Aufräumen darf den ursprünglichen Fehler nicht überdecken)."""
        if not cf_id:
            return
        try:
            self._cf.delete_custom_hostname(cf_id)
        except Exception as exc:  # noqa: BLE001
            log.warning("cf_hostname_rollback_failed", cf_id=cf_id, error=str(exc)[:200])

    def sync_domain(
        self, ctx: AuthContext, domain_id: str
    ) -> CustomDomainResponse:
        """Holt den aktuellen CF-Status und spiegelt ihn in die DB (pending→active
        /error). Invalidiert bei active den by-domain-Cache."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_domain(tenant_id, domain_id)
        cf_id = row.get("cf_custom_hostname_id")
        if not cf_id:
            raise SiteConfigError(
                "Domain ist nicht mit Cloudflare verknüpft.", status_code=409
            )
        try:
            cf = self._cf.get_custom_hostname(cf_id)
        except CloudflareError as exc:
            raise SiteConfigError(exc.message, status_code=exc.status_code) from exc

        ssl = cf.get("ssl") or {}
        new_status = self._map_cf_status(cf.get("status"), ssl.get("status"))
        update = {
            "status": new_status,
            "ssl_status": ssl.get("status"),
            "last_synced_at": datetime.now(UTC).isoformat(),
        }
        res = (
            self._db.table("tenant_custom_domains")
            .update(update)
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        updated = (res.data or [row])[0]
        return self._domain_row(
            updated, dns_records=self._dns_records(row["domain"], ssl)
        )

    def remove_domain(self, ctx: AuthContext, domain_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = self._own_domain(tenant_id, domain_id)
        cf_id = row.get("cf_custom_hostname_id")
        if cf_id:
            try:
                self._cf.delete_custom_hostname(cf_id)
            except CloudflareError as exc:
                # CF-404 ist ok (schon weg); andere Fehler durchreichen.
                if exc.status_code != 404:
                    raise SiteConfigError(
                        exc.message, status_code=exc.status_code
                    ) from exc
        (
            self._db.table("tenant_custom_domains")
            .delete()
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    # --- Öffentlicher Resolver (KEIN JWT, service-role) ----------------------

    def _tenant_id_for_host(self, host: str) -> str:
        """Host → tenant_id über eine AKTIVE Custom-Domain. 400 bei leerem Host,
        404 bei unbekannter/nicht-aktiver Domain. Service-role (kein JWT)."""
        host = (host or "").strip().lower().rstrip(".")
        if not host:
            raise SiteConfigError("Kein Host angegeben.", status_code=400)
        domain_rows = (
            self._db.table("tenant_custom_domains")
            .select("tenant_id")
            .eq("domain", host)
            .eq("status", DomainStatus.active.value)
            .limit(1)
            .execute()
        ).data or []
        if not domain_rows:
            raise SiteConfigError("Unbekannte Domain.", status_code=404)
        return domain_rows[0]["tenant_id"]

    def _public_branding(self, tenant_id: str) -> PublicSiteResponse:
        """Öffentliches Branding eines Tenants (nur öffentliche Felder)."""
        cfg_rows = (
            self._db.table("tenant_site_config")
            .select(_PUBLIC_COLS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        base = cfg_rows[0] if cfg_rows else {"tenant_id": tenant_id}
        return PublicSiteResponse(**{**base, "tenant_id": tenant_id})

    def resolve_site_by_domain(self, host: str) -> PublicSiteResponse:
        """Host → Tenant + öffentliches Branding. NUR aktive Domains; unbekannt
        → 404. Gibt ausschließlich öffentliche Felder zurück (kein Leak)."""
        return self._public_branding(self._tenant_id_for_host(host))

    # === Page-Builder: Seiten (Dashboard, MANAGE_SITE_CONFIG) ================

    def list_pages(self, ctx: AuthContext) -> PageListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("tenant_id", tenant_id)
            .order("nav_order")
            .order("created_at")
            .execute()
        ).data or []
        items = [PageResponse(**r) for r in rows]
        return PageListResponse(items=items, total=len(items))

    def create_page(self, ctx: AuthContext, req: PageCreate) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        # Erste Seite eines Tenants wird automatisch Home.
        existing = (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        slug = req.slug
        # Slug-Kollision vorab abfangen (DB-unique ist der harte Backstop).
        if (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("slug", slug)
            .limit(1)
            .execute()
        ).data:
            raise SiteConfigError(
                "Es gibt bereits eine Seite mit diesem Slug.", status_code=409
            )
        payload = {
            "tenant_id": tenant_id,
            "title": req.title,
            "slug": slug,
            "is_home": not existing,
        }
        res = self._db.table("site_pages").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Seite konnte nicht angelegt werden.", status_code=500
            )
        # Frisch laden, damit DB-Defaults (is_published/nav_order) gefüllt sind.
        return self._load_page(tenant_id, res.data[0]["id"])

    def update_page(
        self, ctx: AuthContext, page_id: str, req: PageUpdate
    ) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        patch = req.model_dump(mode="json", exclude_unset=True)
        if "slug" in patch:
            clash = (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("slug", patch["slug"])
                .neq("id", page_id)
                .limit(1)
                .execute()
            ).data or []
            if clash:
                raise SiteConfigError(
                    "Es gibt bereits eine Seite mit diesem Slug.", status_code=409
                )
        if patch:
            self._db.table("site_pages").update(patch).eq("id", page_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self._load_page(tenant_id, page_id)

    def set_home_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Erst alle anderen entkrönen (partieller Unique-Index ist der Backstop),
        # dann die Zielseite zur Home machen.
        self._db.table("site_pages").update({"is_home": False}).eq(
            "tenant_id", tenant_id
        ).neq("id", page_id).execute()
        self._db.table("site_pages").update({"is_home": True}).eq(
            "id", page_id
        ).eq("tenant_id", tenant_id).execute()
        return self._load_page(tenant_id, page_id)

    def publish_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        return self._set_published(ctx, page_id, True)

    def unpublish_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        return self._set_published(ctx, page_id, False)

    def delete_page(self, ctx: AuthContext, page_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Blöcke hängen per FK on delete cascade; Seite löschen genügt.
        self._db.table("site_pages").delete().eq("id", page_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # === Page-Builder: Blöcke ================================================

    def list_blocks(self, ctx: AuthContext, page_id: str) -> BlockListResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        rows = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []
        items = [BlockResponse(**r) for r in rows]
        return BlockListResponse(items=items, total=len(items))

    def add_block(
        self, ctx: AuthContext, page_id: str, req: BlockCreate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        content = self._validate_content(req.type, req.content)
        rows = (
            self._db.table("site_blocks")
            .select("position")
            .eq("page_id", page_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        ).data or []
        next_pos = (rows[0]["position"] + 1) if rows else 0
        payload = {
            "tenant_id": tenant_id,
            "page_id": page_id,
            "type": req.type.value,
            "position": next_pos,
            "content": content,
            "settings": req.settings or {},
        }
        res = self._db.table("site_blocks").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Block konnte nicht angelegt werden.", status_code=500
            )
        return BlockResponse(**self._block_row(res.data[0]))

    def update_block(
        self, ctx: AuthContext, block_id: str, req: BlockUpdate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        patch: dict = {}
        if req.content is not None:
            patch["content"] = self._validate_content(
                BlockType(block["type"]), req.content
            )
        if req.settings is not None:
            patch["settings"] = req.settings
        if patch:
            self._db.table("site_blocks").update(patch).eq("id", block_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self._load_block(tenant_id, block_id)

    def reorder_blocks(
        self, ctx: AuthContext, page_id: str, ordered_ids: list[str]
    ) -> BlockListResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Alle Block-IDs der Seite laden und prüfen, dass die übergebene Liste
        # exakt diese Menge ist (kein fremder/fehlender Block).
        rows = (
            self._db.table("site_blocks")
            .select("id")
            .eq("page_id", page_id)
            .execute()
        ).data or []
        actual = {r["id"] for r in rows}
        if set(ordered_ids) != actual:
            raise SiteConfigError(
                "Die Blockliste passt nicht zur Seite.", status_code=400
            )
        for pos, block_id in enumerate(ordered_ids):
            self._db.table("site_blocks").update({"position": pos}).eq(
                "id", block_id
            ).eq("tenant_id", tenant_id).execute()
        return self.list_blocks(ctx, page_id)

    def remove_block(self, ctx: AuthContext, block_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_block(tenant_id, block_id)
        self._db.table("site_blocks").delete().eq("id", block_id).eq(
            "tenant_id", tenant_id
        ).execute()

    def apply_template(
        self, ctx: AuthContext, template_id: str
    ) -> PageListResponse:
        tenant_id = self._require_tenant(ctx)
        tmpl = site_templates.TEMPLATES.get(template_id)
        if not tmpl:
            raise SiteConfigError("Unbekanntes Template.", status_code=404)
        existing_slugs = {
            r["slug"]
            for r in (
                self._db.table("site_pages")
                .select("slug")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
            or []
        }
        has_home = bool(
            (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("is_home", True)
                .limit(1)
                .execute()
            ).data
        )
        for page in tmpl["pages"]:
            if page["slug"] in existing_slugs:
                continue  # Slug schon vergeben → diese Template-Seite überspringen
            is_home = bool(page.get("is_home")) and not has_home
            if is_home:
                has_home = True
            page_res = (
                self._db.table("site_pages")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "title": page["title"],
                        "slug": page["slug"],
                        "is_home": is_home,
                    }
                )
                .execute()
            )
            page_id = page_res.data[0]["id"]
            for pos, block in enumerate(page.get("blocks", [])):
                btype = BlockType(block["type"])
                self._db.table("site_blocks").insert(
                    {
                        "tenant_id": tenant_id,
                        "page_id": page_id,
                        "type": btype.value,
                        "position": pos,
                        "content": self._validate_content(
                            btype, block.get("content", {})
                        ),
                        "settings": block.get("settings", {}),
                    }
                ).execute()
        return self.list_pages(ctx)

    # === Page-Builder: öffentlicher Resolver (service-role, kein JWT) ========

    def resolve_page(self, host: str, slug: str | None = None) -> PublicPageResponse:
        """Host → veröffentlichte Seite (Home bei slug=None) + geordnete Blöcke +
        Branding. NUR is_published, nur öffentliche Felder. Unbekannt → 404."""
        tenant_id = self._tenant_id_for_host(host)
        query = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_published", True)
        )
        query = (
            query.eq("is_home", True)
            if slug is None or slug == ""
            else query.eq("slug", slug)
        )
        page_rows = query.limit(1).execute().data or []
        if not page_rows:
            raise SiteConfigError("Seite nicht gefunden.", status_code=404)
        page = page_rows[0]
        block_rows = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", page["id"])
            .order("position")
            .execute()
        ).data or []
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=PublicPageMeta(
                slug=page["slug"],
                title=page["title"],
                seo_title=page.get("seo_title"),
                seo_description=page.get("seo_description"),
                og_image_url=page.get("og_image_url"),
            ),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in block_rows
            ],
            branding=self._public_branding(tenant_id),
        )

    # === Page-Builder: Draft-Vorschau (Editor-iframe) =======================

    # Token-Gültigkeit: 1 Stunde reicht für eine Editier-Sitzung; danach lädt der
    # iframe einen frischen Token. Kurzlebig, damit ein geleakter Token wenig wert ist.
    _DRAFT_TTL_SECONDS = 3600

    def _draft_secret(self) -> bytes:
        secret = get_settings().site_draft_secret.get_secret_value()
        # Fail-CLOSED (Wurzel 5): ein leeres SITE_DRAFT_SECRET darf NICHT auf ein
        # hartkodiertes Secret zurückfallen — sonst könnte jeder gültige Draft-
        # Vorschau-Tokens fälschen. Fehlt es, ist das ein Betriebs-/Config-Fehler.
        if not secret:
            raise SiteConfigError(
                "SITE_DRAFT_SECRET ist nicht konfiguriert.", status_code=503
            )
        return secret.encode()

    def create_draft_token(self, ctx: AuthContext, page_id: str) -> str:
        """Signiert einen kurzlebigen Token (tenant+page+exp) für die Live-
        Vorschau im Editor-iframe. Nur für eigene Seiten."""
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        exp = int(time.time()) + self._DRAFT_TTL_SECONDS
        return self._sign_draft(tenant_id, page_id, exp)

    def _sign_draft(self, tenant_id: str, page_id: str, exp: int) -> str:
        msg = f"{tenant_id}.{page_id}.{exp}".encode()
        sig = hmac.new(self._draft_secret(), msg, hashlib.sha256).hexdigest()
        return f"{exp}.{sig}"

    def resolve_page_draft(self, page_id: str, token: str) -> PublicPageResponse:
        """Rendert eine Seite (auch UNVERÖFFENTLICHT) für den Editor-iframe —
        nur mit gültigem, nicht abgelaufenem Token. Kein JWT (cross-origin
        iframe). Token bindet tenant_id + page_id."""
        # Seite + tenant aus der DB holen (service-role), dann Token verifizieren.
        # Eine syntaktisch ungültige ID (keine UUID) ist „nicht gefunden", kein 500.
        try:
            page_rows = (
                self._db.table("site_pages")
                .select(f"{_PAGE_COLS}, tenant_id")
                .eq("id", page_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — ungültige ID → 404
            raise SiteConfigError(
                "Seite nicht gefunden.", status_code=404
            ) from exc
        if not page_rows:
            raise SiteConfigError("Seite nicht gefunden.", status_code=404)
        page = page_rows[0]
        tenant_id = page["tenant_id"]
        if not self._verify_draft(tenant_id, page_id, token):
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        block_rows = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=PublicPageMeta(
                slug=page["slug"],
                title=page["title"],
                seo_title=page.get("seo_title"),
                seo_description=page.get("seo_description"),
                og_image_url=page.get("og_image_url"),
            ),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in block_rows
            ],
            branding=self._public_branding(tenant_id),
        )

    def _verify_draft(self, tenant_id: str, page_id: str, token: str) -> bool:
        try:
            exp = int(token.split(".", 1)[0])
        except (ValueError, AttributeError, IndexError):
            return False
        if exp < int(time.time()):
            return False  # abgelaufen
        expected = self._sign_draft(tenant_id, page_id, exp)
        return hmac.compare_digest(expected, token)

    # --- Page-Builder intern -------------------------------------------------

    def _validate_content(self, block_type: BlockType, content: dict) -> dict:
        try:
            return validate_block_content(block_type, content or {})
        except ValueError as exc:
            raise SiteConfigError(
                f"Ungültiger Block-Inhalt: {exc}", status_code=400
            ) from exc

    def _own_page(self, tenant_id: str, page_id: str) -> dict:
        rows = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("id", page_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Seite gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    def _own_block(self, tenant_id: str, block_id: str) -> dict:
        rows = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("id", block_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Block gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    def _load_page(self, tenant_id: str, page_id: str) -> PageResponse:
        return PageResponse(**self._page_row(self._own_page(tenant_id, page_id)))

    def _load_block(self, tenant_id: str, block_id: str) -> BlockResponse:
        return BlockResponse(**self._block_row(self._own_block(tenant_id, block_id)))

    def _set_published(
        self, ctx: AuthContext, page_id: str, value: bool
    ) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        self._db.table("site_pages").update({"is_published": value}).eq(
            "id", page_id
        ).eq("tenant_id", tenant_id).execute()
        return self._load_page(tenant_id, page_id)

    @staticmethod
    def _page_row(row: dict) -> dict:
        return {k: row.get(k) for k in PageResponse.model_fields}

    @staticmethod
    def _block_row(row: dict) -> dict:
        out = {k: row.get(k) for k in BlockResponse.model_fields}
        out["content"] = row.get("content") or {}
        out["settings"] = row.get("settings") or {}
        return out

    # --- intern --------------------------------------------------------------

    def _own_domain(self, tenant_id: str, domain_id: str) -> dict:
        rows = (
            self._db.table("tenant_custom_domains")
            .select(_DOMAIN_COLS + ", domain")
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Domain gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    @staticmethod
    def _map_cf_status(hostname_status: str | None, ssl_status: str | None) -> str:
        """CF-Status → unser status. 'active' nur wenn Hostname aktiv UND Zert
        ausgestellt; 'failed'/'…_timed_out' → error; sonst pending."""
        if hostname_status == "active" and ssl_status == "active":
            return DomainStatus.active.value
        bad = {"failed", "deleted"}
        if hostname_status in bad or (ssl_status and "timed_out" in ssl_status):
            return DomainStatus.error.value
        return DomainStatus.pending.value

    def _dns_records(self, domain: str, ssl: dict) -> list[DnsRecord]:
        """CNAME (auf den CF-Fallback-Origin) + TXT-Validierungs-Record(s)."""
        records = [
            DnsRecord(type="CNAME", name=domain, value=self._cf.fallback_origin),
        ]
        for vr in ssl.get("validation_records") or []:
            name = vr.get("txt_name")
            value = vr.get("txt_value")
            if name and value:
                records.append(DnsRecord(type="TXT", name=name, value=value))
        return records

    @staticmethod
    def _domain_row(
        row: dict, *, dns_records: list[DnsRecord] | None = None
    ) -> CustomDomainResponse:
        return CustomDomainResponse(
            id=row["id"],
            domain=row["domain"],
            status=row["status"],
            ssl_status=row.get("ssl_status"),
            dns_records=dns_records or [],
        )
