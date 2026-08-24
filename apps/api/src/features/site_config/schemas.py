"""Pydantic-Schemas des site_config-Slice.

Trennt strikt zwischen dem geschützten Dashboard-Modell (volle Domain-Infos inkl.
CF-Status) und dem **öffentlichen** ``PublicSiteResponse``, das der JWT-lose
by-domain-Resolver liefert: NUR öffentliche Branding-Felder, KEIN cf_*-Feld, kein
interner Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator

# pylint: disable=unused-import
# Re-Export: die geteilten Validatoren und `BlockType` liegen in `basis.py`, die
# content-Schemas je Abschnitt in `block_inhalte.py`. Beide wurden ausgelagert,
# weil diese Datei über die `pylint`-Zeilengrenze gelaufen ist — die IMPORTE der
# übrigen Module bleiben davon unberührt (`from .schemas import BlockType` gilt
# weiter).
from .basis import (  # noqa: F401  — Re-Export für die übrigen Module
    _GTAG_RE,
    _HEX_RE,
    _SITE_LOCALES,
    BlockType,
    _sanitize_rich_html,
    _validate_head_html,
    _validate_href,
    _validate_kein_html,
    _validate_locales,
    _validate_redirect_target,
    _validate_social,
    _validate_source_path,
)
from .block_inhalte import (  # noqa: F401  — Re-Export
    ButtonContent,
    ContactContent,
    FaqContent,
    FaqItem,
    FeaturedPropertiesContent,
    FeatureItem,
    FeaturesContent,
    FormContent,
    FormField,
    FormFieldType,
    GalleryContent,
    GalleryImage,
    HeroContent,
    ImageContent,
    MapContent,
    PostsContent,
    PropertiesGridContent,
    ReviewsContent,
    RichTextContent,
    SearchContent,
    SpacerContent,
    TestimonialItem,
    TestimonialsContent,
    validate_block_content,
)


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


class SiteTheme(StrEnum):
    """Header-/Footer-Skelett der Kunden-Site (0421).

    Das Theme bestimmt AUSSCHLIESSLICH die Rahmen-Anordnung (Kopfzeile, Menü,
    Fußzeile) — Farben, Schriften und Button-Form sind davon unabhängig. Genau
    das ist der Grund, warum der Kunde nichts kaputt machen kann: das Layout
    steht, er dreht nur Tokens."""

    klar = "klar"          # Logo links, Menü rechts
    mitte = "mitte"        # Logo zentriert, Menü darunter
    karte = "karte"        # Kopfzeile + Inhalt als eingerückte Karte
    seitlich = "seitlich"  # vertikale Leiste links


class ButtonStyle(StrEnum):
    """Button-Füllung."""

    solid = "solid"
    outline = "outline"


class ButtonRadius(StrEnum):
    """Button-Eckenform. ``pill`` = vollrund (Repo-Default für Buttons)."""

    sharp = "sharp"
    rounded = "rounded"
    pill = "pill"


# --- Branding (Dashboard) ----------------------------------------------------
class BrandingBase(BaseModel):
    site_name: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None
    favicon_url: str | None = None
    # Theme + Farb-Tokens. Alle optional: NULL heißt „nie gewählt" — der Renderer
    # entscheidet dann, hier wird KEIN plausibler Ersatzwert erfunden (Wurzel 4).
    theme: SiteTheme | None = None
    primary_color: str | None = Field(default=None, pattern=_HEX_RE)
    secondary_color: str | None = Field(default=None, pattern=_HEX_RE)
    background_color: str | None = Field(default=None, pattern=_HEX_RE)
    foreground_color: str | None = Field(default=None, pattern=_HEX_RE)
    # Drei Schrift-Achsen: font_family = Absatz/Body (Bestand, 0086).
    font_family: str | None = None
    heading_font: str | None = None
    button_font: str | None = None
    button_style: ButtonStyle | None = None
    button_radius: ButtonRadius | None = None
    logo_scale: float | None = Field(default=None, ge=0.5, le=3.0)
    about_text: dict[str, str] = Field(default_factory=dict)
    contact_text: dict[str, str] = Field(default_factory=dict)
    social_links: dict[str, str] = Field(default_factory=dict)
    booking_mode: BookingMode = BookingMode.instant

    # --- Farbrollen (0426) ---------------------------------------------------
    # Kopf- und Fußzeile haben eigene Farben. Vorher übernahmen sie den
    # Seitenhintergrund, womit ein dunkler Header auf hellem Grund unmöglich war
    # — der häufigste Gestaltungswunsch überhaupt.
    brand_name_color: str | None = Field(default=None, pattern=_HEX_RE)
    header_background: str | None = Field(default=None, pattern=_HEX_RE)
    header_link_color: str | None = Field(default=None, pattern=_HEX_RE)
    link_color: str | None = Field(default=None, pattern=_HEX_RE)
    footer_background: str | None = Field(default=None, pattern=_HEX_RE)

    # --- Logo-Bereich (0426) ------------------------------------------------
    # Der Firmenname neben dem Logo ist eigene Typografie: er muss zum Logo
    # passen, nicht zu den Überschriften im Text. Der Slogan liegt in `tagline`.
    logo_name_font: str | None = None
    logo_name_size: int | None = Field(default=None, ge=8, le=48)
    slogan_font: str | None = None
    logo_link_url: str | None = None

    # --- Sprachen der Website (0426) ---------------------------------------
    languages: list[str] | None = None
    default_language: str | None = None

    # --- Anzeigeeinstellungen (0426) ---------------------------------------
    show_guest_breakdown: bool = True
    show_base_prices: bool = True

    # --- Fortgeschritten: Code-Injection (0426) ----------------------------
    # Längengrenzen, weil diese Felder in JEDE Gast-Seite geschrieben werden.
    # Ohne Deckel wäre ein versehentlich eingefügtes Minified-Bundle ein
    # Megabyte auf jeder Seitenansicht (Wurzel 8).
    head_html: str | None = Field(default=None, max_length=8_000)
    head_css: str | None = Field(default=None, max_length=20_000)
    custom_js: str | None = Field(default=None, max_length=20_000)
    checkout_js: str | None = Field(default=None, max_length=8_000)

    # --- Fortgeschritten: Recht + Hauptschalter (0426) ---------------------
    cookie_banner: bool = False
    cookie_policy_page_id: str | None = None
    privacy_consent: bool = False
    privacy_policy_page_id: str | None = None
    is_offline: bool = False

    # --- SEO/AEO site-weit (0430) ------------------------------------------
    # Der Rückfall für jede Seite ohne eigene Angabe. Die Längen sind die
    # Empfehlungen der Suchmaschinen (Titel ~60, Beschreibung ~160 Zeichen),
    # aber als GROSSZÜGIGE Obergrenze und nicht als Zwang: eine Suchmaschine
    # schneidet zu lange Texte ab, das ist kein Fehler. Ein hartes Limit bei 60
    # würde einen deutschen Titel unmöglich machen (Komposita).
    seo_title: str | None = Field(default=None, max_length=200)
    seo_description: str | None = Field(default=None, max_length=500)
    seo_keywords: str | None = Field(default=None, max_length=500)
    noindex: bool = False
    gtag_id: str | None = Field(default=None, pattern=_GTAG_RE)
    # Strukturierte Daten. Standard AN, weil der Renderer sie aus geprüften
    # eigenen Feldern baut — es ist kein Kundencode (siehe Migration 0430).
    schema_organization: bool = True
    schema_breadcrumbs: bool = True
    schema_lodging: bool = True
    schema_faq: bool = True
    # Core Web Vitals.
    lazy_loading: bool = True
    # Default true, weil der Renderer seine Schriften schon immer mit
    # `display=swap` lädt — siehe Begründung in Migration 0430.
    system_fonts_first: bool = True

    # --- Theme: Breite und Schriftgrößen (0435) -----------------------------
    # Grenzen wie die CHECKs in 0435. Sie stehen hier ZUSÄTZLICH, damit der Kunde
    # eine Meldung bekommt statt eines 23514-Fehlers.
    content_width: int | None = Field(default=None, ge=960, le=1920)
    heading_scale: int | None = Field(default=None, ge=80, le=130)
    body_scale: int | None = Field(default=None, ge=80, le=130)

    _v_logo_url = field_validator("logo_url")(_validate_href)
    _v_hero_image_url = field_validator("hero_image_url")(_validate_href)
    _v_favicon_url = field_validator("favicon_url")(_validate_href)
    _v_logo_link_url = field_validator("logo_link_url")(_validate_href)
    _v_social = field_validator("social_links")(_validate_social)
    _v_languages = field_validator("languages")(_validate_locales)
    _v_head_html = field_validator("head_html")(_validate_head_html)
    _v_head_css = field_validator("head_css")(_validate_kein_html)
    _v_custom_js = field_validator("custom_js")(_validate_kein_html)
    _v_checkout_js = field_validator("checkout_js")(_validate_kein_html)

    @model_validator(mode="after")
    def _standardsprache_in_liste(self) -> BrandingBase:
        """Die Standardsprache muss eine der geführten Sprachen sein.

        Sonst entsteht eine Website, deren Standardsprache sie selbst nicht
        führt: der Renderer fällt auf die erste vorhandene zurück, der Kunde
        sieht eine andere Sprache als eingestellt — und nichts sagt ihm, warum.
        Die DB hat denselben Check (0426); hier steht er, damit der Kunde eine
        Meldung bekommt statt eines 500."""
        if self.default_language is None:
            return self
        code = self.default_language.strip().lower()
        if code not in _SITE_LOCALES:
            raise ValueError(f"Unbekannte Sprache: {self.default_language}")
        if self.languages is not None and code not in self.languages:
            raise ValueError(
                "Die Standardsprache muss in der Sprachliste der Website stehen."
            )
        return self


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
class PublicNavItem(BaseModel):
    """Ein Menüpunkt der Kunden-Site. Nur Titel + Slug — der Renderer baut den
    Pfad selbst (``""`` = "/"), es wandert keine fertige URL durch die API.

    Die Ausnahme ist ``external_url`` (0433): ein Menüpunkt, der nach außen
    führt, HAT eine fertige Adresse — sie ist sein ganzer Inhalt. Der Renderer
    kann sie nicht bauen, weil sie nicht zu dieser Website gehört.

    ``children`` sind die Einträge eines Ordners. Genau eine Ebene tief; ein
    Kind hat selbst nie Kinder (CHECK in 0433)."""

    slug: str
    title: str
    external_url: str | None = None
    # `folder` heißt: dieser Eintrag ist selbst KEIN Ziel. Der Renderer macht
    # daraus eine Gruppe, keinen Link — ohne dieses Feld müsste er aus einer
    # leeren `children`-Liste raten, und ein Ordner ohne veröffentlichte Kinder
    # sähe aus wie eine Seite.
    is_folder: bool = False
    children: list[PublicNavItem] = Field(default_factory=list)


class PublicNav(BaseModel):
    """Navigation der Kunden-Site, nach Bereich getrennt und je Bereich sortiert.

    Ohne das war jede Unterseite, die der Kunde anlegte, unerreichbar: die
    Kopfzeile des Renderers zeigte nur das Logo und einen festen Knopf. Seiten
    mit ``nav_area='none'`` erscheinen bewusst in KEINER Liste."""

    header: list[PublicNavItem] = Field(default_factory=list)
    footer: list[PublicNavItem] = Field(default_factory=list)


class PublicOrganization(BaseModel):
    """Firmenangaben für das Organization-/LocalBusiness-JSON-LD (0430).

    Die Quelle ist das FIRMENPROFIL des Betriebs, nicht ein zweites Formular im
    Baukasten: sonst pflegt der Betrieb seine Anschrift an zwei Stellen und eine
    davon veraltet still (dieselbe Begründung wie in der Kontakt-Ansicht).

    Jedes Feld darf fehlen. Der Renderer liefert dann entweder ein Schema ohne
    dieses Feld oder — bei fehlendem Namen — gar keins. Eine erfundene Anschrift
    in strukturierten Daten ist eine Falschaussage gegenüber Google (Wurzel 4).

    Was hier NICHT hineingehört: Steuernummer, Handelsregister, IBAN. Diese
    Felder stehen im selben Firmenprofil und sind für ein öffentliches,
    JWT-loses Schema tabu."""

    name: str | None = None
    street: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None


class PublicSiteResponse(BaseModel):
    """Was die öffentliche Buchungs-Site per Host bekommt — NUR öffentliche
    Branding-Felder. Bewusst KEIN cf_*-Feld, kein Domain-Status, kein Secret."""

    tenant_id: str
    site_name: str | None = None
    tagline: str | None = None
    logo_url: str | None = None
    hero_image_url: str | None = None
    favicon_url: str | None = None
    theme: SiteTheme | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    background_color: str | None = None
    foreground_color: str | None = None
    font_family: str | None = None
    heading_font: str | None = None
    button_font: str | None = None
    button_style: ButtonStyle | None = None
    button_radius: ButtonRadius | None = None
    logo_scale: float | None = None
    social_links: dict[str, str] = Field(default_factory=dict)
    booking_mode: BookingMode = BookingMode.instant
    # --- Farbrollen + Logo-Typografie (0426) --------------------------------
    brand_name_color: str | None = None
    header_background: str | None = None
    header_link_color: str | None = None
    link_color: str | None = None
    footer_background: str | None = None
    logo_name_font: str | None = None
    logo_name_size: int | None = None
    slogan_font: str | None = None
    logo_link_url: str | None = None
    # --- Sprachen + Anzeigeverhalten (0426) ---------------------------------
    languages: list[str] | None = None
    default_language: str | None = None
    show_guest_breakdown: bool = True
    show_base_prices: bool = True
    # --- Code-Injection (0426) ---------------------------------------------
    # Der Renderer braucht diese Felder, um sie einzubinden — er ist die einzige
    # Stelle, die sie ausgibt, und er lässt die Zahlungsstrecke aus. Sie sind
    # kein Geheimnis: wer die Seite ansieht, sieht das Ergebnis ohnehin.
    head_html: str | None = None
    head_css: str | None = None
    custom_js: str | None = None
    checkout_js: str | None = None
    # --- Cookie-Banner und Datenschutz-Zustimmung (0426) -------------------
    cookie_banner: bool = False
    privacy_consent: bool = False
    # Die verlinkten Seiten kommen als SLUG, nicht als ID: der Renderer baut
    # daraus einen Pfad. Mit einer ID müsste er die Seite erst nachschlagen —
    # ein zweiter Request für eine Information, die der Resolver schon hat.
    cookie_policy_slug: str | None = None
    privacy_policy_slug: str | None = None
    # Menüstruktur der Site. Steht hier und nicht an der Seite, weil sie site-weit
    # gilt — die Middleware löst das Branding einmal pro Request auf, damit hat
    # jede Route dieselbe Navigation aus derselben Quelle.
    nav: PublicNav = Field(default_factory=PublicNav)
    # --- SEO/AEO (0430) -----------------------------------------------------
    # Der Renderer erzeugt daraus Meta-Tags, robots.txt, sitemap.xml, llms.txt
    # und das JSON-LD. Alles davon ist öffentlich sichtbar, sobald die Seite
    # ausgeliefert wird — hier steckt kein Geheimnis.
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: str | None = None
    noindex: bool = False
    gtag_id: str | None = None
    schema_organization: bool = True
    schema_breadcrumbs: bool = True
    schema_lodging: bool = True
    schema_faq: bool = True
    lazy_loading: bool = True
    system_fonts_first: bool = True
    content_width: int | None = None
    heading_scale: int | None = None
    body_scale: int | None = None
    # Firmenangaben fürs Organization-Schema. `None`, wenn der Schalter aus ist
    # ODER das Firmenprofil keinen Namen führt — der Renderer lässt das Schema
    # dann weg statt eines mit leeren Feldern.
    organization: PublicOrganization | None = None
    # --- Kann dieser Betrieb online Geld annehmen? --------------------------
    # Aus `tenant_billing_profile.stripe_charges_enabled` (bzw. PayPal).
    #
    # Warum das auf einer ÖFFENTLICHEN Antwort steht: ohne diese Angabe zeigt
    # die Website eine Buchungsstrecke, an deren Ende der Gast alles ausgefüllt
    # hat, eine Reservierung entstanden ist — und der Zahlungsschritt mit einem
    # 409 scheitert („Stripe ist noch nicht abrechnungsfähig verbunden").
    # Der Betrieb erfährt davon nichts, der Gast bricht ab.
    #
    # Mit ihr schaltet der Renderer auf den ANFRAGE-Pfad um, den es ohnehin gibt
    # (`booking_mode = inquiry`): der Gast schickt eine Anfrage, der Betrieb
    # antwortet. Das ist kein Notbehelf, sondern der richtige Zustand für einen
    # Betrieb, der noch kein Zahlungskonto hat.
    #
    # Es ist KEIN Geheimnis: ob eine Website eine Zahlung annimmt, sieht jeder,
    # der sie benutzt. Es steht kein Kontostand und keine Kennung darin.
    payments_ready: bool = False


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# === Page-Builder: Seiten + Blöcke ==========================================

class BlockSettings(BaseModel):
    """Generische Darstellungs-Settings, für alle Block-Typen gleich."""

    background_color: str | None = Field(default=None, pattern=_HEX_RE)
    # --- Hintergrundbild je Abschnitt (0432) --------------------------------
    # Steht hier und nicht im `content` eines Typs: ein Hintergrund ist eine
    # Eigenschaft der Fläche, nicht des Inhalts — und damit für JEDEN Typ
    # dieselbe. Im `content` wäre es fünfzehn Felder statt einem.
    #
    # Dieselbe href-Allowlist wie jedes andere gast-sichtbare Bild: ohne sie
    # kommen `javascript:`- und `data:`-URIs durch (im Hintergrund nicht
    # ausführbar, aber ein data:-URI schreibt Megabyte in die Inhaltsspalte und
    # ein fremder Host wird zum Tracking-Pixel auf der Gästeseite, Wurzel 8).
    background_image_url: str | None = None
    # Dunkle Auflage über dem Bild, damit der Text darauf lesbar bleibt.
    # 0 = keine. Ohne diesen Wert ist ein Hintergrundbild in der Praxis
    # unbenutzbar: heller Text auf hellem Himmel.
    background_overlay: float = Field(default=0.0, ge=0.0, le=0.9)
    padding: str = "md"  # "none" | "sm" | "md" | "lg"
    full_width: bool = False
    # Framer-artige Stil-Steuerung (im Style-Inspektor bearbeitbar).
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    visible: bool = True
    radius: int = Field(default=0, ge=0, le=200)  # px
    rotation: int = Field(default=0, ge=-180, le=180)  # Grad

    _v_background_image_url = field_validator("background_image_url")(
        _validate_href
    )


# --- Seiten (Dashboard) ------------------------------------------------------
class PageType(StrEnum):
    """Was eine Zeile in `site_pages` ist (0433).

    Vier Typen, weil vier Dinge in derselben geordneten Navigationsliste stehen
    und nur einer davon eine Seite mit Blöcken ist:

    * ``normal``   — eine Seite. Der Regelfall.
    * ``external``  — ein Menüpunkt, der nach außen führt („Bewertungen bei
      Google"). Als normale Seite gebaut bräuchte er eine leere Seite mit einem
      Button darauf: zwei Klicks für den Gast statt einem.
    * ``folder``    — eine Gruppe im Menü, selbst keine Seite („Umgebung ▾").
    * ``error404``  — die Fehlerseite. Hat Blöcke, aber keine Adresse: sie ist
      die Antwort auf eine falsche. In keiner Navigation, in keiner Sitemap.
    """

    normal = "normal"
    external = "external"
    folder = "folder"
    error404 = "error404"
    # 0437 — ein Pop-up. Auch das ist eine Seite: es hat Abschnitte, wird im
    # Editor gebaut und veröffentlicht. Es erscheint nur nicht über eine
    # Adresse, sondern über einen Auslöser.
    popup = "popup"
    # 0438 — ein Blog-Beitrag. Auch das ist eine Seite: dieselben Abschnitte,
    # derselbe Editor, derselbe Veröffentlichungs-Pfad. Er hat nur zusätzlich
    # ein Datum, einen Autor und Schlagwörter.
    post = "post"


class NavArea(StrEnum):
    """Wo eine Seite in der Navigation der Kunden-Site hängt (0421).

    Die Zuordnung IST die Seitenstruktur — genau wie im Markt üblich: was in der
    Kopfzeile steht, was in der Fußzeile, und was nur per Direktlink erreichbar
    ist (z. B. Impressum-Unterseiten, Landingpages für Kampagnen)."""

    header = "header"
    footer = "footer"
    none = "none"


class PopupTrigger(StrEnum):
    """Wann ein Pop-up erscheint (0437).

    * ``delay``  — nach N Sekunden auf der Seite.
    * ``exit``   — wenn der Zeiger die Seite nach oben verlässt
      (Verlassensabsicht). Auf dem Telefon gibt es das nicht; dort greift
      ersatzweise eine Verzögerung (siehe Renderer).
    * ``scroll`` — wenn N Prozent der Seite gelesen sind.
    """

    delay = "delay"
    exit = "exit"
    scroll = "scroll"


class PageCreate(BaseModel):
    title: str = Field(default="", max_length=200)
    # --- Seiten-Vorlage (0434, Etappe D) ------------------------------------
    # Legt die Seite mit einem fertigen Abschnitts-Satz an („Über uns",
    # „Kontakt", „Anfahrt", …). `None` = leere Seite, der bisherige Zustand.
    #
    # Beim Anlegen und nicht danach: Hostaway lässt erst eine leere Seite
    # erzeugen und dann einen „Designed Section" hineinlegen — zwei Schritte für
    # eine Absicht. Der Titel und der Slug dürfen leer bleiben, dann kommen sie
    # aus der Vorlage.
    template: str | None = Field(default=None, max_length=40)
    slug: str = Field(default="", max_length=200)
    nav_area: NavArea = NavArea.header
    # --- Seitentypen (0433) -------------------------------------------------
    page_type: PageType = PageType.normal
    external_url: str | None = None
    parent_id: str | None = None
    # --- Pop-up (0437) ------------------------------------------------------
    # Nur bei `page_type = popup`. Der Wert bedeutet Sekunden bei `delay` und
    # Prozent bei `scroll` — ein Feld für beides, weil immer nur ein Auslöser
    # aktiv ist.
    popup_trigger: PopupTrigger | None = None
    popup_value: int | None = Field(default=None, ge=1, le=120)
    popup_device: str | None = None
    popup_once: bool = True
    # --- Blog-Beitrag (0438) ------------------------------------------------
    published_at: str | None = None
    author: str | None = Field(default=None, max_length=120)
    cover_image_url: str | None = None
    excerpt: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=8)

    @field_validator("slug")
    @classmethod
    def _slugify(cls, v: str) -> str:
        v = v.strip().lower()
        if v and not all(c.isalnum() or c == "-" for c in v):
            raise ValueError("Slug darf nur a-z, 0-9 und - enthalten.")
        return v

    @field_validator("external_url")
    @classmethod
    def _externe_adresse(cls, v: str | None) -> str | None:
        """Nur vollständige http(s)-Adressen.

        Strenger als `_validate_href`, das auch relative Pfade erlaubt: ein
        RELATIVER Pfad in einem „externen" Menüpunkt ist ein Widerspruch — er
        zeigt dann auf die eigene Website, und dafür gibt es den normalen
        Seitentyp. `mailto:`/`tel:` fallen bewusst mit weg: sie gehören in den
        Kontakt-Abschnitt, nicht in die Hauptnavigation (Wurzel 8)."""
        if v is None:
            return None
        wert = v.strip()
        if not wert:
            return None
        if not wert.lower().startswith(("http://", "https://")):
            raise ValueError(
                "Ein externer Menüpunkt braucht eine vollständige Adresse "
                "(https://…)."
            )
        if len(wert) > 2000:
            raise ValueError("Adresse ist zu lang (max. 2000 Zeichen).")
        return wert

    @model_validator(mode="after")
    def _titel_oder_vorlage(self) -> PageCreate:
        """Ohne Titel braucht es eine Vorlage — sonst hätte die Seite keinen
        Namen. Vorher war `title` schlicht Pflicht; mit Vorlagen kommt er von
        dort, und ein Pflichtfeld wäre dann eine Frage, deren Antwort schon
        feststeht."""
        # `title` ist zur Laufzeit ein `str`; weil der Default als `Field(...)`
        # geschrieben ist, hält astroid es statisch für `FieldInfo`.
        # pylint: disable=no-member
        if not self.title.strip() and not self.template:
            raise ValueError("Die Seite braucht einen Titel.")
        return self

    @model_validator(mode="after")
    def _popup_stimmig(self) -> PageCreate:
        """Auslöser und Typ müssen zusammenpassen (0437).

        Beide Richtungen, weil beide Fälle still schiefgehen:

        * Ein Pop-up OHNE Auslöser wäre unsichtbar — gebaut, veröffentlicht,
          und niemand sieht es je.
        * Ein Auslöser an einer normalen Seite wäre gespeichert und wirkungslos,
          und niemand fände den Grund.

        Der Wertebereich hängt am Auslöser: ``scroll`` ist ein Prozentsatz
        (1–100), ``delay`` sind Sekunden (1–120). Ein Prozentsatz über 100 kann
        nie erreicht werden — das Pop-up erschiene nie."""
        if self.page_type is PageType.popup:
            if self.popup_trigger is None:
                raise ValueError("Ein Pop-up braucht einen Auslöser.")
            if (
                self.popup_trigger is PopupTrigger.scroll
                and self.popup_value is not None
                and self.popup_value > 100
            ):
                raise ValueError(
                    "Beim Auslöser für den gelesenen Anteil sind höchstens "
                    "100 Prozent möglich."
                )
        elif (
            self.popup_trigger is not None
            or self.popup_value is not None
            or self.popup_device is not None
        ):
            raise ValueError(
                "Auslöser gibt es nur beim Pop-up."
            )
        if self.popup_device is not None and self.popup_device not in (
            "mobile",
            "desktop",
        ):
            raise ValueError("Gerät muss mobile oder desktop sein.")
        return self

    @model_validator(mode="after")
    def _typ_stimmig(self) -> PageCreate:
        """Typ und Felder müssen zusammenpassen — dieselben Regeln wie die
        CHECKs in 0433, nur mit einer Meldung statt eines 23514-Fehlers.

        Der Ordner ist der Fall, der ohne Prüfung still schiefgeht: er hat keine
        eigene Adresse, und ein Slug daran würde eine Seite versprechen, die es
        nicht gibt."""
        if self.page_type is PageType.external and not self.external_url:
            raise ValueError("Ein externer Menüpunkt braucht eine Adresse.")
        if self.page_type is not PageType.external and self.external_url:
            raise ValueError(
                "Eine Adresse gibt es nur beim externen Menüpunkt."
            )
        if self.page_type in (PageType.folder, PageType.error404):
            if self.parent_id:
                raise ValueError(
                    "Ein Ordner und die Fehlerseite hängen an keinem Ordner."
                )
        return self


class PageUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    seo_title: str | None = Field(default=None, max_length=200)
    seo_description: str | None = Field(default=None, max_length=500)
    og_image_url: str | None = None
    # --- SEO je Seite (0430) ------------------------------------------------
    # Diese Angaben schlagen die site-weiten (tenant_site_config): eine eigene
    # Beschreibung je Seite ist der Kern von SEO, eine geteilte ist der
    # häufigste Anfängerfehler.
    seo_keywords: str | None = Field(default=None, max_length=500)
    # Abweichende kanonische Adresse. Nur nötig, wenn derselbe Inhalt unter
    # zwei Adressen erreichbar ist (Kampagnen-Duplikat, Umzug mit Altbestand).
    # NULL heisst „diese Seite ist das Original" — der Renderer setzt dann ihre
    # eigene Adresse, statt das Feld weglassen zu muessen.
    canonical_url: str | None = None
    # Kopf-HTML NUR dieser Seite (seitenspezifisches JSON-LD). Dieselbe
    # Allowlist wie site-weit: <meta>, <link>, <title> — keine Skripte.
    head_html: str | None = Field(default=None, max_length=8_000)
    noindex: bool | None = None
    nav_area: NavArea | None = None
    nav_order: int | None = None
    # --- Seitentypen (0433) -------------------------------------------------
    # `page_type` ist NICHT änderbar: aus einer Seite mit Blöcken einen Ordner zu
    # machen würde die Blöcke unerreichbar zurücklassen (sie hängen an der
    # page_id, nicht am Typ). Wer den Typ wechseln will, legt neu an — dann ist
    # der Verlust sichtbar statt still.
    external_url: str | None = None
    parent_id: str | None = None
    # Sprachen, in denen DIESE Seite existiert (0426). `None` = alle Sprachen der
    # Website — der Normalfall, der keinen Eintrag braucht.
    languages: list[str] | None = None

    _v_og_image_url = field_validator("og_image_url")(_validate_href)
    _v_languages = field_validator("languages")(_validate_locales)
    _v_canonical_url = field_validator("canonical_url")(_validate_href)
    _v_head_html = field_validator("head_html")(_validate_head_html)

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
    # --- SEO je Seite (0430) ------------------------------------------------
    seo_keywords: str | None = None
    canonical_url: str | None = None
    head_html: str | None = None
    noindex: bool = False
    # --- Seitentypen (0433) -------------------------------------------------
    page_type: PageType = PageType.normal
    external_url: str | None = None
    parent_id: str | None = None
    # --- Pop-up (0437) ------------------------------------------------------
    popup_trigger: PopupTrigger | None = None
    popup_value: int | None = None
    popup_device: str | None = None
    popup_once: bool = True
    # --- Blog-Beitrag (0438) ------------------------------------------------
    published_at: str | None = None
    author: str | None = None
    cover_image_url: str | None = None
    excerpt: str | None = None
    tags: list[str] | None = None
    is_home: bool = False
    is_published: bool = False
    nav_area: NavArea = NavArea.header
    nav_order: int = 0
    languages: list[str] | None = None


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


class BlockReplaceItem(BaseModel):
    """Ein Abschnitt im Voll-Ersatz einer Seite. ``id`` gesetzt = bestehende Zeile
    weiterverwenden (Inhalt aktualisieren), ``None`` = neuer Abschnitt."""

    id: str | None = None
    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)


class BlocksReplaceRequest(BaseModel):
    """Ersetzt ALLE Abschnitte einer Seite in EINEM Aufruf.

    Der Editor speicherte bisher mit N+1 einzelnen HTTP-Calls (löschen, updaten,
    anlegen, neu ordnen) ohne Transaktion — brach einer in der Mitte ab, blieb
    die Seite halb gespeichert. Dieser Endpunkt macht den Speichervorgang zu EINER
    idempotenten Operation: dieselbe Liste zweimal gesendet ergibt denselben
    Zustand (Wurzel 2), und die Reihenfolge ist der Array-Index.

    Obergrenze, damit eine Seite nicht unbegrenzt viele Abschnitte rendert
    (Wurzel 8) — 60 ist weit jenseits jeder echten Kunden-Seite."""

    items: list[BlockReplaceItem] = Field(default_factory=list, max_length=60)


# --- Mediathek (Dashboard) ---------------------------------------------------
class MediumResponse(BaseModel):
    """Ein Bild im Bestand des Betriebs."""

    id: str
    url: str
    filename: str | None = None
    mime: str
    bytes: int
    created_at: str | None = None


class MediumListResponse(BaseModel):
    items: list[MediumResponse]
    total: int


class PagesReorderRequest(BaseModel):
    """Seiten INNERHALB eines Navigationsbereichs neu sortieren. Die Liste muss
    exakt die Seiten dieses Bereichs enthalten (Prüfung im Service)."""

    nav_area: NavArea
    ordered_ids: list[str] = Field(min_length=1, max_length=200)


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
    # --- SEO je Seite (0430) ------------------------------------------------
    # Der Resolver liefert hier den BEREITS aufgelösten Wert: fehlt der
    # Seiten-Titel, steht der site-weite drin. Die Hierarchie („Seite schlägt
    # Site") gehört an EINE Stelle — sie im Renderer ein zweites Mal zu bauen
    # wäre die Art Dublette, die irgendwann auseinanderläuft.
    seo_keywords: str | None = None
    canonical_url: str | None = None
    head_html: str | None = None
    noindex: bool = False


class PublicPageResponse(BaseModel):
    """Was der öffentliche Renderer (builder/) pro Host+Slug bekommt: die
    veröffentlichte Seite + geordnete Blöcke + öffentliches Branding. Keine
    Entwürfe, keine internen Felder, kein Cross-Tenant-Leak.

    Die Navigation steckt im Branding (``branding.nav``), nicht hier: sie gilt
    site-weit, nicht je Seite. Zwei Quellen für dieselbe Menüstruktur wären
    genau die Art Dublette, die irgendwann auseinanderläuft."""

    tenant_id: str
    page: PublicPageMeta
    blocks: list[PublicBlock] = Field(default_factory=list)
    branding: PublicSiteResponse


# === URL-Weiterleitungen (0430) =============================================
# Warum eine eigene Ressource und kein Feld an der Config: eine Weiterleitung
# wird einzeln angelegt, einzeln gelöscht, muss eindeutig sein und wird pro
# 404 GESUCHT. Als JSON-Array müsste der Renderer bei jedem Fehlschlag die
# ganze Liste laden und in Python durchsuchen.
class RedirectType(StrEnum):
    """301 = dauerhaft (überträgt die Platzierung), 302 = vorübergehend.

    Als Enum und nicht als int, damit die Oberfläche zwei benannte Optionen
    zeigt statt eines Zahlenfeldes. Die DB speichert die Zahl (0430)."""

    permanent = "301"
    temporary = "302"


class RedirectCreate(BaseModel):
    source_path: str = Field(min_length=1, max_length=500)
    target: str = Field(min_length=1, max_length=2_000)
    redirect_type: RedirectType = RedirectType.permanent
    is_active: bool = True

    _v_source = field_validator("source_path")(_validate_source_path)
    _v_target = field_validator("target")(_validate_redirect_target)

    @model_validator(mode="after")
    def _keine_selbstschleife(self) -> RedirectCreate:
        """Quelle und Ziel dürfen nicht dieselbe Adresse sein.

        Hostaway listet „Redirect loops and self-references" als Fehlerursache
        und schreibt dazu: eine solche Konfiguration blockiert ALLE beteiligten
        Weiterleitungen. Die einstufige Selbstschleife lässt sich hier beim
        Speichern erkennen — und sie ist der Fall, der wirklich passiert
        (Kunde trägt /alt → /alt ein, weil er die Richtung verwechselt).

        Längere Ketten (A→B→C→A) fängt der Renderer beim Auflösen ab: er folgt
        einer Weiterleitung genau EINMAL. Sie hier zu prüfen hieße, den ganzen
        Graphen im Speicher zu halten und bei jedem Schreiben neu zu bewerten."""
        # Beide Felder sind zur Laufzeit `str`. Weil ihr Default als
        # `Field(...)` geschrieben ist, hält astroid sie statisch für
        # `FieldInfo` und meldet `rstrip` als fehlend — dasselbe Muster steht
        # ungemeldet in anderen Validatoren des Slices, deren Felder ohne
        # `Field(...)` deklariert sind.
        # pylint: disable=no-member
        if self.source_path.rstrip("/").lower() == self.target.rstrip("/").lower():
            raise ValueError("Quelle und Ziel sind identisch — das ist eine Schleife.")
        return self


class RedirectUpdate(BaseModel):
    """Teil-Update. `source_path` ist NICHT änderbar: der Pfad IST die Identität
    der Weiterleitung (unique je Tenant). Wer ihn ändern will, legt eine neue an
    und löscht die alte — dann ist der Zwischenzustand sichtbar statt still."""

    target: str | None = Field(default=None, max_length=2_000)
    redirect_type: RedirectType | None = None
    is_active: bool | None = None

    _v_target = field_validator("target")(_validate_redirect_target)


class RedirectResponse(BaseModel):
    id: str
    source_path: str
    target: str
    redirect_type: RedirectType
    is_active: bool
    created_at: str | None = None


class RedirectListResponse(BaseModel):
    items: list[RedirectResponse]
    total: int


class RedirectImportRequest(BaseModel):
    """Mehrere Weiterleitungen in einem Zug (CSV-Import der Oberfläche).

    Der Deckel liegt bei 200 Zeilen wie bei Hostaway — nicht als Nachahmung,
    sondern weil jeder unbegrenzte Bereich eine Obergrenze braucht (Wurzel 8):
    ohne sie ist eine 50-MB-CSV ein Datenbank-Schreibsturm über eine einzige
    HTTP-Anfrage."""

    items: list[RedirectCreate] = Field(min_length=1, max_length=200)
    # Vorhandene Einträge mit demselben Quellpfad überschreiben statt den ganzen
    # Import abzulehnen. Standard AUS: ein Import, der bestehende Weiterleitungen
    # still ändert, ist die unangenehmere Überraschung.
    overwrite: bool = False


class RedirectImportResult(BaseModel):
    """Was der Import wirklich getan hat — getrennt nach Wirkung.

    Drei Zahlen und nicht eine: „12 importiert" verschweigt, dass 8 davon
    bestehende Einträge überschrieben haben. Die Fehlerliste trägt die
    Zeilennummer, damit der Kunde sie in seiner Datei findet."""

    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


# === Sitemap / robots / llms (0430) =========================================
class SitemapPage(BaseModel):
    """Eine Seite in der Sitemap. `slug` ist leer für die Startseite — den Pfad
    baut der Renderer, damit die Pfad-Bildung an einer Stelle liegt."""

    slug: str
    title: str = ""
    lastmod: str | None = None
    is_home: bool = False
    languages: list[str] | None = None


class SitemapProperty(BaseModel):
    id: str
    lastmod: str | None = None


class SitemapPost(BaseModel):
    """Ein Blog-Beitrag in der Sitemap (0438)."""

    slug: str
    title: str = ""
    lastmod: str | None = None


class SitemapResponse(BaseModel):
    """Datengrundlage für sitemap.xml, robots.txt und llms.txt.

    `abgeschnitten` ist bewusst Teil der Antwort: eine Sitemap, die nur die
    Hälfte enthält und vollständig aussieht, lässt Google die andere Hälfte
    ignorieren, ohne dass jemand die Ursache findet. Der Renderer schreibt es
    als Kommentar in die Datei."""

    pages: list[SitemapPage] = Field(default_factory=list)
    properties: list[SitemapProperty] = Field(default_factory=list)
    posts: list[SitemapPost] = Field(default_factory=list)
    abgeschnitten: bool = False
    # Site-weite Angaben, die der Renderer für robots.txt und llms.txt braucht,
    # ohne dafür einen zweiten Request zu stellen.
    noindex: bool = False
    site_name: str | None = None
    seo_description: str | None = None
    default_language: str | None = None
    languages: list[str] | None = None


class RedirectResolveResponse(BaseModel):
    """Antwort des öffentlichen Weiterleitungs-Lesepfads.

    `target` ist `None`, wenn es für diesen Pfad keine aktive Weiterleitung gibt
    — der Renderer zeigt dann seine 404-Seite. Ein 404 der API wäre hier falsch:
    „keine Weiterleitung" ist die normale Antwort, nicht ein Fehler."""

    target: str | None = None
    redirect_type: int | None = None


# === SEO-Befunde (Etappe B) =================================================
class SeoBefundSeite(BaseModel):
    """Eine Seite (oder ein Objekt) in einem Befund. `slug` ist bei Objekten
    leer — ihre Adresse ist /inserat/<id> und hat keinen."""

    id: str
    titel: str = ""
    slug: str = ""


class SeoBefund(BaseModel):
    """Ein Befund der SEO-Prüfung.

    `code` und nicht ein fertiger Satz: die Oberfläche übersetzt ihn in 24
    Sprachen. Ein Text aus dem Backend wäre auf Deutsch — und der Betrieb kann
    sein Dashboard auf Dänisch führen.

    `anzahl` ist die VOLLE Zahl, `seiten` höchstens die ersten zehn. Sonst
    stünde bei 200 betroffenen Seiten „10" da, und die Zahl wäre eine
    Falschaussage."""

    code: str
    schwere: str  # "fehler" | "warnung" | "hinweis"
    anzahl: int = 0
    seiten: list[SeoBefundSeite] = Field(default_factory=list)


class SeoPruefungResponse(BaseModel):
    """Ergebnis der SEO-Prüfung.

    Bewusst OHNE Punktzahl. Eine Zahl wie „87/100" wäre eine erfundene
    Bewertung (Wurzel 4): niemand kann sagen, was die fehlenden 13 Punkte sind,
    und Google bewertet ohnehin anders. Was zählt, ist die Liste."""

    items: list[SeoBefund] = Field(default_factory=list)
    # Wie viele veröffentlichte Seiten geprüft wurden. Ohne diese Zahl ist eine
    # leere Befundliste zweideutig: alles gepflegt — oder es gibt noch keine
    # veröffentlichte Seite?
    geprueft: int = 0


# === Formular-Einsendungen (0436, Etappe F) =================================
class FormSubmissionRequest(BaseModel):
    """Was ein Gast absendet.

    `block_id` und nicht `page_id` + Index: der Block ist die Identität des
    Formulars. Verschiebt der Betrieb es auf eine andere Seite, funktioniert der
    Absende-Weg weiter.

    `daten` ist ein freies dict, weil die Felder der Betrieb festlegt. Was darin
    erlaubt ist, entscheidet `formulare.einsendung_pruefen` gegen die
    Felddefinition des Blocks — unbekannte Schlüssel fliegen weg."""

    block_id: str
    daten: dict[str, str | int | float | bool | None] = Field(
        default_factory=dict
    )
    # reCAPTCHA-Token des Browsers. Ohne ihn lehnt der Endpunkt ab, wenn der
    # Dienst konfiguriert ist (fail-closed, Wurzel 5).
    recaptcha_token: str | None = None


class FormSubmissionResponse(BaseModel):
    """Antwort an den GAST. Bewusst minimal: er braucht nur zu wissen, dass es
    angekommen ist. Die gespeicherten Daten zurückzugeben wäre eine
    Einladung, den Endpunkt als Spiegel zu missbrauchen."""

    ok: bool = True


class FormSubmission(BaseModel):
    """Eine Einsendung für die Antwortenliste im Dashboard."""

    id: str
    block_id: str | None = None
    form_name: str | None = None
    daten: dict[str, str] = Field(default_factory=dict)
    created_at: str | None = None
    is_read: bool = False


class FormSubmissionListResponse(BaseModel):
    items: list[FormSubmission] = Field(default_factory=list)
    total: int = 0


# === Pop-ups (0437, Etappe G) ===============================================
class PublicPopup(BaseModel):
    """Ein Pop-up für den Renderer.

    Enthält Auslöser UND Blöcke: der Renderer braucht beides in einem Zug, und
    ein zweiter Abruf je Pop-up wäre bei drei Pop-ups drei zusätzliche Anfragen
    pro Seitenansicht.

    `id` reist mit, weil der Browser sich merken muss, welches Pop-up er schon
    gezeigt hat (`popup_once`). Ohne stabile Kennung müsste er den Titel
    nehmen — und der ändert sich."""

    id: str
    title: str = ""
    trigger: PopupTrigger
    value: int | None = None
    device: str | None = None
    once: bool = True
    blocks: list[PublicBlock] = Field(default_factory=list)


class PublicPopupListResponse(BaseModel):
    """Die Pop-ups einer Website.

    Leere Liste = keine. Das ist der Normalfall und kein Fehler — deshalb 200
    und nicht 404."""

    items: list[PublicPopup] = Field(default_factory=list)


# === Blog (0438, Etappe H) ==================================================
class PublicPost(BaseModel):
    """Ein Beitrag in der Liste.

    OHNE Blöcke: die Liste zeigt Titel, Anriss und Bild. Die Abschnitte eines
    Beitrags wären bei zwanzig Einträgen zwanzig Block-Bäume in einer Antwort —
    für eine Übersicht, die davon nichts anzeigt."""

    slug: str
    title: str
    excerpt: str | None = None
    author: str | None = None
    cover_image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    published_at: str | None = None


class PublicPostListResponse(BaseModel):
    items: list[PublicPost] = Field(default_factory=list)
    total: int = 0
    # Alle vorkommenden Schlagwörter, für die Filterleiste. Aus DIESER Seite der
    # Liste und nicht aus allen Beiträgen: eine zweite Abfrage über den ganzen
    # Bestand nur für die Leiste wäre der teurere Teil des Aufrufs.
    tags: list[str] = Field(default_factory=list)


class PublicPostResponse(BaseModel):
    """Ein einzelner Beitrag mit seinen Abschnitten."""

    tenant_id: str
    post: PublicPost
    page: PublicPageMeta
    blocks: list[PublicBlock] = Field(default_factory=list)
    branding: PublicSiteResponse
