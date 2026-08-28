"""Pydantic-Schemas des site_config-Slice.

Trennt strikt zwischen dem geschützten Dashboard-Modell (volle Domain-Infos inkl.
CF-Status) und dem **öffentlichen** ``PublicSiteResponse``, das der JWT-lose
by-domain-Resolver liefert: NUR öffentliche Branding-Felder, KEIN cf_*-Feld, kein
interner Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

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
    Breiteneinheit,
    TextSchatten,
    TextStil,
    ThemeFarbe,
    ThemeFelder,
    ThemeOeffentlich,
    _sanitize_rich_html,
    _validate_head_html,
    _validate_href,
    _validate_kein_html,
    _validate_locales,
    _validate_redirect_target,
    _validate_social,
    _validate_source_path,
    slug_pruefen,
)
from .block_inhalte import (  # noqa: F401  — Re-Export
    ZURUECK_AB_SEITEN,
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
    FormSeite,
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
    SearchPostsContent,
    SpacerContent,
    TestimonialItem,
    TestimonialsContent,
    kontakt_formular_felder,
    validate_block_content,
)
from .schemas_beitragsfelder import BeitragsFelder
from .schemas_bloecke import (  # noqa: F401  — Re-Export
    BlockCreate,
    BlockListResponse,
    BlockReplaceItem,
    BlockResponse,
    BlocksReplaceRequest,
    BlockUpdate,
    ContainerMoveRequest,
    ReorderRequest,
)
from .schemas_darstellung import ContainerDarstellung
from .schemas_mediathek import (  # noqa: F401  — Re-Export
    MediumListResponse,
    MediumResponse,
    PublicBildnachweis,
)

# Mediathek (0460/0461): Bilder, Ordner, Verwendungsnachweis, Stock-Anbieter.
# Ausgelagert aus demselben Grund wie `basis.py` und `block_inhalte.py` — diese
# Datei stand bei 1486 von 1500 erlaubten Zeilen. `from .schemas import
# MediumResponse` gilt für die übrigen Module unverändert weiter.
from .schemas_seo import (  # noqa: F401  — Re-Export
    RedirectCreate,
    RedirectImportRequest,
    RedirectImportResult,
    RedirectListResponse,
    RedirectResolveResponse,
    RedirectResponse,
    RedirectType,
    RedirectUpdate,
    SeoBefund,
    SeoBefundSeite,
    SeoPruefungResponse,
    SitemapPage,
    SitemapPost,
    SitemapProperty,
    SitemapResponse,
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
class BrandingBase(ThemeFelder):
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


class PublicSiteResponse(ThemeOeffentlich):
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
    # --- Bildnachweise (0461) ----------------------------------------------
    # Stock-Fotos dieses Betriebs mit Fotograf und Profil-Adresse. Warum das auf
    # einer ÖFFENTLICHEN Antwort steht und warum es am Bild hängt statt am
    # Block: siehe Docstring von `PublicBildnachweis` in `schemas_mediathek.py`.
    image_credits: list[PublicBildnachweis] = Field(default_factory=list)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# === Page-Builder: Seiten + Blöcke ==========================================

class BlockGeraet(StrEnum):
    """Die Geräte, für die ein Abschnitt einzeln ausgeblendet werden kann.

    GENAU die drei, die der Editor auch umschalten und in der Vorschau zeigen
    kann (``Geraet`` in ``web/components/website/vorschau.tsx``): der
    Geräte-Umschalter der Kopfzeile hat drei Knöpfe, und jeder davon hat eine
    eigene Vorschaubreite (390 · 820 · voll) und einen eigenen Bereich im CSS
    (Basis · ``md`` ab 768 · ``lg`` ab 1024).

    Die Reihenfolge ist die des Umschalters, von breit nach schmal — sie ist
    zugleich die Sortierung in ``_hidden_on_normalisieren`` und damit die
    Reihenfolge, in der die Werte in der Datenbank stehen.

    ``tablet`` kam am 25.08.2026 dazu, zusammen mit Umschalter und
    Vorschaubreite. Vorher waren es zwei, weil ein Breakpoint-Name ohne
    Oberfläche und ohne CSS-Entsprechung eine Attrappe gewesen wäre; jetzt gibt
    es beides. Eine Migration braucht es dafür nicht: ``hidden_on`` ist eine
    Menge in ``settings`` (jsonb), und ein Wert, den keine bestehende Zeile
    trägt, ändert an keiner bestehenden Zeile etwas (Wurzel 1).
    """

    desktop = "desktop"
    tablet = "tablet"
    mobil = "mobil"




class BlockSettings(ContainerDarstellung):
    """Generische Darstellungs-Settings, für alle Block-Typen gleich.

    ``extra="allow"``: unbekannte Schlüssel werden DURCHGEREICHT, nicht
    verworfen. Der Editor ist in Arbeit und bekommt laufend neue
    Darstellungs-Felder; ein Modell, das alles Unbekannte still wegwirft, würde
    genau die Einstellung verschlucken, die gerade dazugekommen ist — und zwar
    lautlos, mit einer 200er-Antwort (Wurzel 5). Geprüft wird also, was hier
    steht; alles andere bleibt unangetastet stehen.
    """

    model_config = ConfigDict(extra="allow")

    # --- Sichtbarkeit je Gerät (0448/0449) ----------------------------------
    # Auf welchen Geräten dieser Abschnitt beim GAST nicht erscheint. Leer =
    # überall sichtbar, und das ist der Zustand jedes bestehenden Abschnitts:
    # ein neues Feld darf das Aussehen einer bestehenden Kundenseite nicht
    # verändern (Wurzel 1).
    #
    # Im EDITOR wird nie etwas ausgeblendet — dort steht der Abschnitt
    # durchscheinend mit durchgestrichenem Auge. Ein Element, das man durch
    # Ausblenden verliert, hat keinen Rückweg, und der Rückweg ist genau das,
    # was ein Gegenzustand braucht.
    #
    # `max_length` ist die reine Missbrauchsgrenze und NICHT die Zahl der
    # Geräte: doppelte Einträge sind derselbe Zustand, kein Fehler — der
    # Validator unten macht daraus wieder eine Menge. Stünde hier `2`,
    # würde `["mobil", "mobil"]` mit 400 abgewiesen, obwohl es genau das
    # meint, was gespeichert werden soll (Wurzel 2: dieselbe Eingabe
    # zweimal gesendet muss durchgehen und denselben Zustand ergeben).
    hidden_on: list[BlockGeraet] = Field(default_factory=list, max_length=16)

    # --- Eigener Name der Ebene (28.08.2026) --------------------------------
    # In jedem Baukasten mit Ebenen-Ansicht lässt sich ein Element umbenennen
    # (Framer, Figma, Webflow) — und zwar aus demselben Grund: „Abschnitt"
    # achtmal untereinander benennt nichts. Ohne eigenen Namen ist die Liste
    # ab dem vierten Abschnitt nicht mehr lesbar.
    #
    # `extra="allow"` würde das Feld zwar durchreichen, aber UNGEPRÜFT: ein
    # Name von 4 MB landete unbesehen in der Zeile und in jeder Ebenen-Liste
    # (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine Obergrenze). 60
    # Zeichen sind mehr, als in die Spalte passen.
    name: str | None = Field(default=None, max_length=60)

    @field_validator("name")
    @classmethod
    def _name_leer_ist_keiner(cls, v: str | None) -> str | None:
        """Leerzeichen sind kein Name.

        Sonst trüge die Zeile einen unsichtbaren Namen und zeigte gar nichts
        an — schlechter als der Standardname, den sie vorher hatte."""
        if v is None:
            return None
        geputzt = v.strip()
        return geputzt or None

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

    @field_validator("hidden_on")
    @classmethod
    def _hidden_on_normalisieren(
        cls, v: list[BlockGeraet]
    ) -> list[BlockGeraet]:
        """Entdoppeln und in fester Reihenfolge ablegen.

        `hidden_on` ist eine MENGE, keine Liste: „mobil, mobil" ist derselbe
        Zustand wie „mobil", und „mobil, desktop" derselbe wie
        „desktop, mobil". Ohne diese Normalisierung ergäbe dieselbe Eingabe
        zweimal gesendet zwei verschiedene Zeilen — der Editor speichert
        entprellt und schickt denselben Stand real mehrfach (Wurzel 2).
        """
        reihenfolge = list(BlockGeraet)
        return sorted(set(v), key=reihenfolge.index)


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
    # 0466 — eine Seite, die der RENDERER ausliefert, ohne dass jemand sie
    # angelegt hat: die Objekt-Detailseite, die Buchung, die Bestätigung, der
    # Blog. Sie existiert, weil es ihre Route gibt. Deshalb ohne Blöcke, ohne
    # Navigation, nicht löschbar, mit festem Slug — editierbar sind nur ihre
    # SEO-Angaben. Was es gibt und warum: `systemseiten.py`.
    system = "system"
    # 0468 — eine dynamische Seite: EIN Layout, viele Adressen. Der Renderer
    # erzeugt daraus eine Seite je Objekt und füllt sie mit dessen Live-Daten.
    # Sie ist der Kern der Buchungsstrecke; Einzelheiten in
    # `dynamische_seiten.py` und `docs/BUCHUNGSSTRECKE-VORBILDER.md`.
    dynamic = "dynamic"


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
    # Wo das Fenster sitzt — Dudas 3×3-Raster (0440). `None` heisst „mittig",
    # so wie es bis 0439 immer war; ein Wert ohne Vorgeschichte braucht keinen
    # eigenen Eintrag im Raster.
    popup_position: str | None = None
    # --- Blog-Beitrag (0438) ------------------------------------------------
    published_at: str | None = None
    author: str | None = Field(default=None, max_length=120)
    cover_image_url: str | None = None
    excerpt: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=8)

    @field_validator("slug")
    @classmethod
    def _slugify(cls, v: str) -> str:
        # EINE Quelle für beide Slug-Validatoren (Anlegen und Ändern). Zwei
        # Kopien hiessen: die Sprachkürzel-Sperre wird an einer Stelle
        # nachgezogen und an der anderen vergessen.
        return slug_pruefen(v)

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
        return slug_pruefen(v)


class PageResponse(BeitragsFelder):
    # Erbt die Beitragsfelder (0483): die Beitragstabelle liest die Seitenliste.
    id: str
    slug: str
    title: str
    #: Quelle einer DYNAMISCHEN Seite (0468) — heute nur `property`. Aus ihr
    #: entsteht die Vielzahl der Adressen. `None` bei jeder anderen Seite.
    dynamic_source: str | None = None
    #: Kennung einer Systemseite (0466); `None` bei jeder anderen Seite. Die
    #: Oberfläche übersetzt daraus den angezeigten Namen — der Titel in der DB
    #: bleibt leer, weil ein deutscher Text dort in 24 Sprachen stünde.
    system_key: str | None = None
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
    # Wo das Fenster sitzt — Dudas 3×3-Raster (0440). `None` heisst „mittig",
    # so wie es bis 0439 immer war; ein Wert ohne Vorgeschichte braucht keinen
    # eigenen Eintrag im Raster.
    popup_position: str | None = None
    # --- Zugang und Einzelveroeffentlichung (0442) --------------------------
    # NUR ob ein Passwort gesetzt ist, nie der Hash: das Dashboard braucht den
    # Schalter, nicht den Wert — und ein Hash, der einmal in einer API-Antwort
    # stand, steht danach in Browser-Verlauf, Fehlerprotokollen und im Cache
    # jedes Zwischenspeichers.
    hat_passwort: bool = False
    last_single_publish_at: str | None = None
    # true = beim Veroeffentlichen der Website ueberspringen (0443). Nicht
    # dasselbe wie `is_published = false` — das heisst nur „steht gerade nicht
    # live".
    is_draft: bool = False
    # --- Blog-Beitrag (0438) ------------------------------------------------
    published_at: str | None = None
    author: str | None = None
    cover_image_url: str | None = None
    excerpt: str | None = None
    tags: list[str] | None = None
    # --- Blog-CMS (0480) -----------------------------------------------------
    #: Handsortierung der Beitragsliste (Ziehgriff an der Zeile).
    post_sort: int | None = None
    #: Dieser Beitrag ist ein KAPITEL des verwiesenen Beitrags. Die Tabelle
    #: rückt ihn eingerückt darunter ein, die Beitragsseite listet die Kapitel.
    parent_post_id: str | None = None
    #: Aufrufe der öffentlichen Beitragsseite.
    view_count: int = 0
    #: Der Autor als Konto des Betriebs. Fehlt er, bleibt `author` als
    #: Freitext-Name stehen (Gastautoren, Altbestand).
    author_user_id: str | None = None
    is_archived: bool = False
    #: ZWEITE Sichtbarkeitsachse (0481), getrennt von `is_published`:
    #: „fertig" und „wo sichtbar" sind zwei Fragen.
    show_on_homepage: bool = True
    #: Beitragstext; die Tabelle zeigt einen Auszug.
    content_html: str | None = None
    #: Wann die Zeile angelegt wurde — UNSERE Uhr. Das Blog-CMS zeigt sie als
    #: „Erstellt: …" neben dem Erscheinungsdatum; sie ist ausdrücklich NICHT
    #: dessen Ersatz, wenn dort nichts steht (Wurzel 5b).
    created_at: str | None = None
    #: Wann die Zeile zuletzt geändert wurde — ebenfalls UNSERE Uhr, gesetzt
    #: vom Trigger `set_updated_at` (0087). Das Vorbild führt sie als `Edited`
    #: neben `Created`; beide beantworten verschiedene Fragen, und keine von
    #: beiden ist das Erscheinungsdatum.
    updated_at: str | None = None
    is_home: bool = False
    is_published: bool = False
    nav_area: NavArea = NavArea.header
    nav_order: int = 0
    languages: list[str] | None = None


class PageListResponse(BaseModel):
    items: list[PageResponse]
    total: int


# --- Blöcke (Dashboard) ------------------------------------------------------
# Stehen in `schemas_bloecke.py` — hier re-exportiert, damit bestehende Importe
# (`from .schemas import BlockCreate`) unverändert weiterlaufen.

# --- Mediathek (Dashboard) ---------------------------------------------------
# Die Mediathek-Schemas stehen in `schemas_mediathek.py` — importiert ganz oben
# in dieser Datei und von dort re-exportiert (siehe Kommentar am Import).


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


# --- Buchungsstrecke: die drei Formen (0474) ---------------------------------
class ApplyStreckeRequest(BaseModel):
    """Welche Strecken-Vorlage angewendet wird."""

    strecke: str


class StreckeSummary(BaseModel):
    """Eine Strecken-Vorlage in der Auswahl.

    Nur die Kennung und die Bausteinzahlen — KEIN Anzeigename und keine
    Beschreibung: die stehen im Übersetzungskatalog des Dashboards
    (`website.strecke.*`), damit die Auswahl in allen 24 Sprachen dasteht und
    nicht in der einen, in der jemand den Katalog geschrieben hat (Wurzel 4).
    """

    key: str
    #: Bausteine je Seite — die Oberfläche zeigt daraus „5 Abschnitte", ohne
    #: die Liste selbst zu kennen.
    objekt_bloecke: int
    checkout_bloecke: int
    bestaetigung_bloecke: int


class StreckenListResponse(BaseModel):
    strecken: list[StreckeSummary]


class StreckePreviewResponse(BaseModel):
    """Token und Beispielobjekt für die Live-Vorschau einer Strecke.

    ``beispiel_objekt_id`` ist ``None``, wenn der Betrieb kein aktives Objekt
    hat. Das ist eine Aussage, kein Fehler: die Buchungsseite lässt sich auch
    dann ansehen, die Objektseite nicht — und die Oberfläche nennt den Grund,
    statt eine leere Fläche zu zeigen.
    """

    token: str
    beispiel_objekt_id: str | None = None


# --- Vorlagen-Galerie (Reiter „Vorlagen") -----------------------------------
# Die Liste kommt vom SERVER und steht nicht im Frontend. Vorher hatte die
# Oberfläche die IDs hartkodiert; als das Backend sie umbenannte, lief jeder
# Klick in ein 404 „Unbekanntes Template" — sichtbar nur als Toast. Eine
# Aufzählung, die an zwei Stellen steht, läuft irgendwann auseinander.
class TemplatePageSummary(BaseModel):
    """Eine Seite der Vorlage — für die Aufzählung „was lege ich mir hier an"."""

    slug: str
    title: str
    nav_area: NavArea
    block_count: int


class TemplateSummary(BaseModel):
    """Eine ganze Website-Vorlage in der Galerie."""

    id: str
    kategorie: str
    name: dict[str, str]
    description: dict[str, str] = Field(default_factory=dict)
    # Das Hero-Bild der Startseite. Es ist das Bild, das der Kunde nach dem
    # Anwenden ganz oben sieht — deshalb taugt es als Vorschaubild, und wir
    # brauchen kein zweites, das mit der Vorlage aus dem Takt geraten kann.
    preview_image: str | None = None
    primary_color: str | None = None
    pages: list[TemplatePageSummary] = Field(default_factory=list)


class TemplateListResponse(BaseModel):
    templates: list[TemplateSummary] = Field(default_factory=list)
    kategorien: list[str] = Field(default_factory=list)


class SeitenVorlageSummary(BaseModel):
    """Eine Vorlage für eine EINZELNE Seite (Über uns, Kontakt, FAQ …)."""

    id: str
    title: dict[str, str]
    slug: str
    block_count: int
    block_types: list[str] = Field(default_factory=list)


class SeitenVorlagenListResponse(BaseModel):
    vorlagen: list[SeitenVorlageSummary] = Field(default_factory=list)


# --- Öffentlicher Resolver (service-role, nur veröffentlicht) ----------------
class PublicBlock(BaseModel):
    """Ein Block für den öffentlichen Renderer — type + content + settings.

    `id` reist NUR beim Formular-Abschnitt mit: der Renderer braucht sie zum
    Absenden (`POST /site/form` verlangt die `block_id`). Bei jedem anderen
    Abschnitt bleibt sie `None` — eine interne Kennung hat ohne Grund nichts auf
    einer Gast-Seite verloren (`formulare.block_kennung` entscheidet das)."""

    id: str | None = None
    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)

    # --- Baum (0472) --------------------------------------------------------
    #: Was diese Zeile IST: `section`, `column`, `inner_column` oder `widget`.
    #: Der Renderer entscheidet daran, ob er einen Rahmen zeichnet oder Inhalt.
    kind: str = "widget"
    #: Breitenanteil einer Spalte in Zwölfteln. `None` bei allem, was keine
    #: Spalte ist.
    span: int | None = None
    #: Die Kinder dieses Knotens, in ihrer Reihenfolge.
    #:
    #: VERSCHACHTELT und nicht flach mit `parent_id`: der Renderer würde die
    #: flache Liste ohnehin als Erstes zu einem Baum zusammensetzen, und jede
    #: Stelle, die das selbst täte, wäre eine zweite Fassung derselben Logik.
    #: Die eine Fassung steht im Resolver.
    children: list[PublicBlock] = Field(default_factory=list)


class PublicTrailItem(BaseModel):
    """Eine Stufe im Brotkrumen-Pfad (0450).

    ``slug`` ist ``None``, wenn die Stufe kein Ziel hat — ein Ordner (der hat
    keine Adresse, 0433) oder eine unveröffentlichte Elternseite. Der Renderer
    zeigt sie dann als Text. Ein Link auf eine Seite, die es öffentlich nicht
    gibt, wäre eine 404 mitten in der Navigation."""

    title: str
    slug: str | None = None


class PublicPageMeta(BaseModel):
    slug: str
    title: str
    # --- Brotkrumen (0450) ---------------------------------------------------
    # Der Weg von oben bis zur ELTERN-Seite, aus der Seitenhierarchie. Die
    # aktuelle Seite steht nicht darin (`title` oben ist sie).
    #
    # Der Pfad gehört in die Antwort und nicht in den `content` des Abschnitts:
    # er ist eine Aussage über die STRUKTUR, und die kennt nur der Server. Ihn
    # eintippen zu lassen wäre eine zweite Wahrheit, die beim ersten Verschieben
    # einer Seite falsch wird.
    trail: list[PublicTrailItem] = Field(default_factory=list)
    seo_title: str | None = None
    seo_description: str | None = None
    og_image_url: str | None = None
    # Alternativtext zum Vorschaubild (0457). Er beschreibt das BILD und nicht
    # die Seite — deshalb ein eigenes Feld neben `seo_description`.
    og_image_alt: str | None = None
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
    #: Der Beitrag, falls die Seite einer ist (0483/0485) — sonst `None`.
    #: Nur im Entwurfs-Render gefuellt: ein Beitrag hat keine Abschnitte, und
    #: ohne dieses Feld blieb der Editor-iframe fuer ihn weiss (28.08.2026).
    post: PublicPost | None = None
    #: Die eigenen Felder (0485) — Schluessel und Name fuer die Beschriftung.
    eigene_felder: list[PublicPostEigenesFeld] = Field(default_factory=list)


# === URL-Weiterleitungen, Sitemap, SEO-Befunde (0430) =======================
# Ausgelagert nach `schemas_seo.py` — dieses Modul lag mit 1522 Zeilen ueber
# pylints Grenze von 1500 (C0302). Die Namen werden oben re-exportiert, damit
# bestehende Importe (`from .schemas import RedirectCreate`) gelten.



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
    # Wohin der Renderer den Gast schicken soll (0444), oder `None`.
    #
    # In der ANTWORT und nicht als HTTP-302: der Aufruf kommt aus JavaScript,
    # und ein 302 darauf lädt die Zieladresse per fetch nach, statt den Browser
    # dorthin zu schicken.
    weiterleitung: str | None = None
    # Ob eine Bestätigung an den Absender rausging. Der Renderer sagt es ihm —
    # sonst wartet er auf eine Mail, die nie kommt.
    bestaetigung_gesendet: bool = False
    # --- Nur wenn das Formular ein `file`-Feld hat (0445) --------------------
    # Die beiden Werte für den ZWEITEN Aufruf, der die Datei bringt
    # (`POST /site/form/{submission_id}/upload`). Sie kommen NUR mit, wenn es
    # wirklich ein Datei-Feld gibt: eine Kennung und ein Ticket an ein Formular
    # zu geben, das keine Datei annimmt, wäre ein Schlüssel für eine Tür, die es
    # nicht gibt — und die Kennung einer fremden Einsendung ist der einzige
    # Wert, den ein Angreifer für den Upload-Weg braucht.
    submission_id: str | None = None
    upload_ticket: str | None = None


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
    # Wo das Fenster sitzt (0440). `None` = mittig — der Renderer hat denselben
    # Rueckfall, damit ein Pop-up aus der Zeit vor 0440 aussieht wie bisher.
    position: str | None = None
    blocks: list[PublicBlock] = Field(default_factory=list)


class SeitenZugangRequest(BaseModel):
    """Seitenpasswort setzen oder entfernen (0442).

    Leer oder ``None`` entfernt den Schutz — dieselbe Aktion, weil „offen für
    alle" nur die andere Stellung desselben Schalters ist.
    """

    passwort: str | None = Field(default=None, max_length=100)


class SeitenEntwurfRequest(BaseModel):
    """Eine Seite als Entwurf halten oder freigeben (0443)."""

    entwurf: bool


class SeitenFreischaltenRequest(BaseModel):
    """Ein Gast gibt das Passwort einer geschützten Seite ein (0442)."""

    host: str = Field(min_length=3, max_length=253)
    slug: str | None = Field(default=None, max_length=200)
    passwort: str = Field(min_length=1, max_length=100)


class SeitenTicketResponse(BaseModel):
    """Der Nachweis für eine geöffnete Seite.

    Signiert, mit Ablauf, und nur für DIESE eine Seite gültig — die Seiten-ID
    steckt in der Signatur. Der Server merkt sich nichts über den Gast; es gibt
    nichts zu merken.
    """

    ticket: str


class PublicPopupListResponse(BaseModel):
    """Die Pop-ups einer Website.

    Leere Liste = keine. Das ist der Normalfall und kein Fehler — deshalb 200
    und nicht 404."""

    items: list[PublicPopup] = Field(default_factory=list)


# Blog (0438/0457) — ausgelagert nach `schemas_blog.py`, weil diese Datei sonst
# ueber der pylint-Zeilengrenze liegt. Der Import steht hier UNTEN, nach den
# Typen, die `schemas_blog` seinerseits braucht (PublicBlock, PublicPageMeta,
# PublicSiteResponse) — sonst waere es ein Zirkelbezug.
#
# Der Re-Export haelt `from .schemas import PublicPost` fuer die uebrigen
# Module gueltig; kein Aufrufer muss geaendert werden.
# Der Import steht bewusst am Dateiende und nicht oben: `schemas_blog` holt
# sich `PublicBlock`, `PublicPageMeta` und `PublicSiteResponse` von HIER. Oben
# waere das ein Zirkelbezug.
# pylint: disable=wrong-import-position
from .schemas_blog import (  # noqa: E402,F401  — Re-Export, siehe oben
    PublicBlogAngaben,
    PublicPost,
    PublicPostEigenesFeld,
    PublicPostFelder,
    PublicPostListResponse,
    PublicPostNachbar,
    PublicPostResponse,
)

# Die Vorwärtsverweise in `PublicPageResponse` (`post`, `eigene_felder`) zeigen
# auf Modelle aus `schemas_blog` — das erst HIER importiert werden kann (siehe
# oben). `model_rebuild` löst sie auf, sobald die Namen im Modul stehen; ohne
# diesen Aufruf wirft pydantic beim ersten Gebrauch „class not fully defined".
PublicPageResponse.model_rebuild()
