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

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .cloudflare_client import CloudflareClient, CloudflareError
from .schemas import (
    BrandingResponse,
    BrandingUpdate,
    CustomDomainListResponse,
    CustomDomainResponse,
    DnsRecord,
    DomainCreate,
    DomainStatus,
    PublicSiteResponse,
    SliceHealth,
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
        res = self._db.table("tenant_custom_domains").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Domain konnte nicht gespeichert werden.", status_code=500
            )
        row = res.data[0]
        return self._domain_row(row, dns_records=self._dns_records(domain, ssl))

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

    def resolve_site_by_domain(self, host: str) -> PublicSiteResponse:
        """Host → Tenant + öffentliches Branding. NUR aktive Domains; unbekannt
        → 404. Gibt ausschließlich öffentliche Felder zurück (kein Leak)."""
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
        tenant_id = domain_rows[0]["tenant_id"]
        cfg_rows = (
            self._db.table("tenant_site_config")
            .select(_PUBLIC_COLS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        # Domain aktiv, aber (noch) kein Branding gepflegt → minimal: nur tenant_id.
        base = cfg_rows[0] if cfg_rows else {"tenant_id": tenant_id}
        return PublicSiteResponse(**{**base, "tenant_id": tenant_id})

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
