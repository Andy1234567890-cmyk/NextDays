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


# === Page-Builder: Seiten + Blöcke ==========================================
class BlockType(StrEnum):
    """Die ersten Block-Typen des Page-Builders. Erweiterbar (DB nutzt check,
    kein enum, damit weitere Typen ohne ALTER TYPE dazukommen können)."""

    hero = "hero"
    rich_text = "rich_text"
    image = "image"
    gallery = "gallery"
    button = "button"
    spacer = "spacer"
    contact = "contact"
    search = "search"
    properties_grid = "properties_grid"
    featured_properties = "featured_properties"


# --- getypte content-Schemas je Block-Typ (kein freies Any) ------------------
# Mehrsprachige Texte als dict[str, str] (Locale → Text, Muster wie about_text).
class HeroContent(BaseModel):
    heading: dict[str, str] = Field(default_factory=dict)
    subheading: dict[str, str] = Field(default_factory=dict)
    image_url: str | None = None
    cta_label: dict[str, str] = Field(default_factory=dict)
    cta_href: str | None = None


class RichTextContent(BaseModel):
    html: dict[str, str] = Field(default_factory=dict)  # TipTap-HTML je Locale


class ImageContent(BaseModel):
    url: str | None = None
    alt: dict[str, str] = Field(default_factory=dict)
    caption: dict[str, str] = Field(default_factory=dict)


class GalleryImage(BaseModel):
    url: str
    alt: dict[str, str] = Field(default_factory=dict)


class GalleryContent(BaseModel):
    images: list[GalleryImage] = Field(default_factory=list)


class ButtonContent(BaseModel):
    label: dict[str, str] = Field(default_factory=dict)
    href: str | None = None
    variant: str = "primary"  # "primary" | "secondary"


class SpacerContent(BaseModel):
    size: str = "md"  # "sm" | "md" | "lg" | "xl"


class ContactContent(BaseModel):
    headline: dict[str, str] = Field(default_factory=dict)
    email: str | None = None
    phone: str | None = None
    address: dict[str, str] = Field(default_factory=dict)
    show_form: bool = False


class SearchContent(BaseModel):
    placeholder: dict[str, str] = Field(default_factory=dict)
    show_guests: bool = True
    show_dates: bool = True


class PropertiesGridContent(BaseModel):
    headline: dict[str, str] = Field(default_factory=dict)
    q: str | None = None
    guests: int | None = None
    limit: int | None = None


class FeaturedPropertiesContent(BaseModel):
    headline: dict[str, str] = Field(default_factory=dict)
    property_ids: list[str] = Field(default_factory=list)


_CONTENT_MODEL: dict[BlockType, type[BaseModel]] = {
    BlockType.hero: HeroContent,
    BlockType.rich_text: RichTextContent,
    BlockType.image: ImageContent,
    BlockType.gallery: GalleryContent,
    BlockType.button: ButtonContent,
    BlockType.spacer: SpacerContent,
    BlockType.contact: ContactContent,
    BlockType.search: SearchContent,
    BlockType.properties_grid: PropertiesGridContent,
    BlockType.featured_properties: FeaturedPropertiesContent,
}


def validate_block_content(block_type: BlockType, content: dict) -> dict:
    """Validiert das content-dict gegen das Schema des Block-Typs und gibt das
    normalisierte dict zurück. Wirft ValueError bei ungültigem Inhalt."""
    model = _CONTENT_MODEL[block_type]
    return model.model_validate(content or {}).model_dump(mode="json")


class BlockSettings(BaseModel):
    """Generische Darstellungs-Settings, für alle Block-Typen gleich."""

    background_color: str | None = Field(default=None, pattern=_HEX_RE)
    padding: str = "md"  # "none" | "sm" | "md" | "lg"
    full_width: bool = False


# --- Seiten (Dashboard) ------------------------------------------------------
class PageCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(default="", max_length=200)

    @field_validator("slug")
    @classmethod
    def _slugify(cls, v: str) -> str:
        v = v.strip().lower()
        if v and not all(c.isalnum() or c == "-" for c in v):
            raise ValueError("Slug darf nur a-z, 0-9 und - enthalten.")
        return v


class PageUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    seo_title: str | None = None
    seo_description: str | None = None
    og_image_url: str | None = None
    nav_order: int | None = None

    @field_validator("slug")
    @classmethod
    def _slugify(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if v and not all(c.isalnum() or c == "-" for c in v):
            raise ValueError("Slug darf nur a-z, 0-9 und - enthalten.")
        return v


class PageResponse(BaseModel):
    id: str
    slug: str
    title: str
    seo_title: str | None = None
    seo_description: str | None = None
    og_image_url: str | None = None
    is_home: bool = False
    is_published: bool = False
    nav_order: int = 0


class PageListResponse(BaseModel):
    items: list[PageResponse]
    total: int


# --- Blöcke (Dashboard) ------------------------------------------------------
class BlockCreate(BaseModel):
    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)


class BlockUpdate(BaseModel):
    content: dict | None = None
    settings: dict | None = None


class BlockResponse(BaseModel):
    id: str
    page_id: str
    type: BlockType
    position: int
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)


class BlockListResponse(BaseModel):
    items: list[BlockResponse]
    total: int


class ReorderRequest(BaseModel):
    ordered_ids: list[str] = Field(min_length=1)


class ApplyTemplateRequest(BaseModel):
    template_id: str


# --- Öffentlicher Resolver (service-role, nur veröffentlicht) ----------------
class PublicBlock(BaseModel):
    """Ein Block für den öffentlichen Renderer — type + content + settings."""

    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)


class PublicPageMeta(BaseModel):
    slug: str
    title: str
    seo_title: str | None = None
    seo_description: str | None = None
    og_image_url: str | None = None


class PublicPageResponse(BaseModel):
    """Was der öffentliche Renderer (builder/) pro Host+Slug bekommt: die
    veröffentlichte Seite + geordnete Blöcke + öffentliches Branding. Keine
    Entwürfe, keine internen Felder, kein Cross-Tenant-Leak."""

    tenant_id: str
    page: PublicPageMeta
    blocks: list[PublicBlock] = Field(default_factory=list)
    branding: PublicSiteResponse
