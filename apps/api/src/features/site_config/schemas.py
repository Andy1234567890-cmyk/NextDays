"""Pydantic-Schemas des site_config-Slice.

Trennt strikt zwischen dem geschützten Dashboard-Modell (volle Domain-Infos inkl.
CF-Status) und dem **öffentlichen** ``PublicSiteResponse``, das der JWT-lose
by-domain-Resolver liefert: NUR öffentliche Branding-Felder, KEIN cf_*-Feld, kein
interner Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

from enum import StrEnum

import nh3
from pydantic import BaseModel, Field, field_validator

_HEX_RE = r"^#[0-9a-fA-F]{6}$"

# Erlaubte Link-Schemata für gast-sichtbare hrefs (W-2, Stored-XSS-Schutz):
# nur http(s)/mailto/tel + relative Pfade. `javascript:`/`data:`/`vbscript:`
# u. a. werden abgelehnt. Fail-closed (Wurzel 5).
_SAFE_HREF_SCHEMES = ("http://", "https://", "mailto:", "tel:")


# Allowlist für gast-sichtbares Rich-Text (TipTap-Ausgabe). Nur Formatierung,
# keine Skript-/Einbettungs-Vektoren. nh3 (ammonia) parst echtes HTML statt
# Regex → entfernt <script>/<svg>/onerror/unquotierte javascript:-hrefs zuverlässig.
_RICH_TEXT_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "a", "span",
}
# `rel` NICHT hier — nh3 setzt es selbst via link_rel (sonst ValueError).
_RICH_TEXT_ATTRS = {"a": {"href", "title", "target"}, "span": {"style"}}


def _sanitize_rich_html(value: dict[str, str]) -> dict[str, str]:
    """TipTap-HTML je Locale serverseitig mit echtem Allowlist-Parser säubern
    (W-1, Stored-XSS). Ersetzt den umgehbaren Regex-Sanitizer im Renderer als
    verbindlichen Backstop beim Speichern (Wurzel 5, fail-closed)."""
    return {
        locale: nh3.clean(
            html or "",
            tags=_RICH_TEXT_TAGS,
            attributes=_RICH_TEXT_ATTRS,
            url_schemes={"http", "https", "mailto", "tel"},
            link_rel="noopener noreferrer nofollow",
        )
        for locale, html in (value or {}).items()
    }


def _validate_href(value: str | None) -> str | None:
    """href/cta_href darf beim Gast-Klick kein Skript auslösen. Ein absoluter
    Link muss ein erlaubtes Schema tragen; relative Pfade (beginnen mit / oder #
    oder enthalten vor dem ersten / kein ':') sind erlaubt."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    lower = v.lower()
    if lower.startswith(_SAFE_HREF_SCHEMES):
        return v
    # Relativ/anchor: erlaubt, solange KEIN Schema (kein ':' vor dem ersten '/').
    scheme_sep = v.find(":")
    slash = v.find("/")
    is_relative = scheme_sep == -1 or (slash != -1 and slash < scheme_sep)
    if v.startswith(("/", "#", "?")) or is_relative:
        return v
    raise ValueError("Nicht erlaubtes Link-Schema (nur http(s)/mailto/tel/relativ).")


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
    reviews = "reviews"


# --- getypte content-Schemas je Block-Typ (kein freies Any) ------------------
# Mehrsprachige Texte als dict[str, str] (Locale → Text, Muster wie about_text).
class HeroContent(BaseModel):
    heading: dict[str, str] = Field(default_factory=dict)
    subheading: dict[str, str] = Field(default_factory=dict)
    eyebrow: dict[str, str] = Field(default_factory=dict)
    image_url: str | None = None
    cta_label: dict[str, str] = Field(default_factory=dict)
    cta_href: str | None = None
    # Layout-Variante: "fullscreen" | "split" | "centered".
    variant: str = "fullscreen"
    # Optionale Schrift-Familie (Schlüssel aus dem Font-Katalog); None = Marke.
    font_family: str | None = None

    _v_cta_href = field_validator("cta_href")(_validate_href)


class RichTextContent(BaseModel):
    html: dict[str, str] = Field(default_factory=dict)  # TipTap-HTML je Locale
    align: str = "left"  # "left" | "center"
    font_family: str | None = None

    _v_html = field_validator("html")(_sanitize_rich_html)


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

    _v_href = field_validator("href")(_validate_href)


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


class ReviewsContent(BaseModel):
    """Bewertungs-Block der eigenen Website.

    Zeigt AUSSCHLIESSLICH eigene, verifizierte myBestDays-Bewertungen. Portal-
    Bewertungen (Booking.com/Airbnb) gehören nicht hierher: deren Nutzungs-
    bedingungen erlauben das Weiterveröffentlichen nur eingeschränkt.

    ``property_id`` leer = Bewertungen aller Objekte des Betriebs."""

    headline: dict[str, str] = Field(default_factory=dict)
    property_id: str | None = None
    # Wie viele Bewertungen gezeigt werden. Obergrenze, damit ein Block nicht
    # unbegrenzt viele Zeilen rendert (Wurzel 8).
    limit: int = Field(default=6, ge=1, le=24)
    show_categories: bool = True


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
    BlockType.reviews: ReviewsContent,
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
    # Framer-artige Stil-Steuerung (im Style-Inspektor bearbeitbar).
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    visible: bool = True
    radius: int = Field(default=0, ge=0, le=200)  # px
    rotation: int = Field(default=0, ge=-180, le=180)  # Grad


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


class DraftTokenResponse(BaseModel):
    """Kurzlebiger Token für die Editor-Live-Vorschau (builder/-iframe)."""

    token: str


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
