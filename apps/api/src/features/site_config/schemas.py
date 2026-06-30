"""Pydantic-Schemas des site_config-Slice.

Trennt strikt zwischen dem geschützten Dashboard-Modell (volle Domain-Infos inkl.
CF-Status) und dem **öffentlichen** ``PublicSiteResponse``, das der JWT-lose
by-domain-Resolver liefert: NUR öffentliche Branding-Felder, KEIN cf_*-Feld, kein
interner Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

_HEX_RE = r"^#[0-9a-fA-F]{6}$"


class BookingMode(StrEnum):
    """Buchungsmodus der Site. Backend kann aktuell nur ``instant``;
    ``inquiry``/``both`` werden gespeichert + im UI vorbereitet (Phase 1c)."""

    instant = "instant"
    inquiry = "inquiry"
    both = "both"


class DomainStatus(StrEnum):
    """Gespiegelter Cloudflare-Custom-Hostname-Status."""

    pending = "pending"
    active = "active"
    error = "error"


# --- Branding (Dashboard) ----------------------------------------------------
class BrandingBase(BaseModel):
    site_name: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None
    primary_color: str | None = Field(default=None, pattern=_HEX_RE)
    secondary_color: str | None = Field(default=None, pattern=_HEX_RE)
    font_family: str | None = None
    about_text: dict[str, str] = Field(default_factory=dict)
    contact_text: dict[str, str] = Field(default_factory=dict)
    social_links: dict[str, str] = Field(default_factory=dict)
    booking_mode: BookingMode = BookingMode.instant


class BrandingUpdate(BrandingBase):
    """PUT-Body: alle Felder optional (Teil-Update via exclude_unset)."""


class BrandingResponse(BrandingBase):
    """GET-Antwort fürs Dashboard. Leere Config = alle Felder auf Default/None."""


# --- Custom-Domains (Dashboard) ----------------------------------------------
class DomainCreate(BaseModel):
    domain: str = Field(min_length=3, max_length=253)

    @field_validator("domain")
    @classmethod
    def _normalize(cls, v: str) -> str:
        v = v.strip().lower().rstrip(".")
        if not v or " " in v or "/" in v or "." not in v:
            raise ValueError("Ungültige Domain.")
        return v


class DnsRecord(BaseModel):
    """Ein vom Agentur-Admin zu setzender DNS-Record."""

    type: str          # "CNAME" | "TXT"
    name: str
    value: str


class CustomDomainResponse(BaseModel):
    """Dashboard-Sicht einer Custom-Domain inkl. der nötigen DNS-Records.

    ``cf_custom_hostname_id`` wird bewusst NICHT exponiert (interne CF-Referenz)."""

    id: str
    domain: str
    status: DomainStatus
    ssl_status: str | None = None
    # Nur direkt nach add_domain / bei pending gefüllt (CNAME + TXT-Validierung).
    dns_records: list[DnsRecord] = Field(default_factory=list)


class CustomDomainListResponse(BaseModel):
    items: list[CustomDomainResponse]
    total: int


# --- Öffentlicher Resolver (KEIN JWT, service-role) ---------------------------
class PublicSiteResponse(BaseModel):
    """Was die öffentliche Buchungs-Site per Host bekommt — NUR öffentliche
    Branding-Felder. Bewusst KEIN cf_*-Feld, kein Domain-Status, kein Secret."""

    tenant_id: str
    site_name: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    font_family: str | None = None
    social_links: dict[str, str] = Field(default_factory=dict)
    booking_mode: BookingMode = BookingMode.instant


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
