"""Pydantic-Schemas des site_config-Slice.

Trennt strikt zwischen dem geschützten Dashboard-Modell (volle Domain-Infos inkl.
CF-Status) und dem **öffentlichen** ``PublicSiteResponse``, das der JWT-lose
by-domain-Resolver liefert: NUR öffentliche Branding-Felder, KEIN cf_*-Feld, kein
interner Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

from enum import StrEnum

import nh3
from pydantic import BaseModel, Field, field_validator, model_validator

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


# Sprachen, in denen eine Kunden-Website stehen kann: die 24 EU-Amtssprachen.
# Muss mit `LOCALES` in `web/i18n/locales.ts` deckungsgleich sein — eine Sprache,
# für die es keine Oberfläche gibt, wäre eine halbe Website.
_SITE_LOCALES = frozenset(
    {
        "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
        "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
    }
)

# Tags, die im Kunden-HTML des <head> erlaubt sind.
#
# BEWUSST OHNE `script`: der Zweck dieses Feldes ist Verifizierung und
# Ressourcen-Verweise (google-site-verification, ein Preconnect, ein
# Canonical-Link). Für Code gibt es `custom_js`, und das lässt die
# Zahlungsstrecke aus. Wäre `script` hier erlaubt, wäre das HTML-Feld der Weg,
# an genau dieser Trennung vorbei ein Skript in den Checkout zu bekommen.
_HEAD_TAGS = frozenset({"meta", "link", "title"})

# `http-equiv` ist BEWUSST nicht dabei. Damit fällt `<meta http-equiv="refresh"
# content="0;url=…">` weg — eine Weiterleitung der ganzen Kundenseite, die als
# „Verifizierungs-Tag" getarnt in diesem Feld steht und beim nächsten Ansehen
# niemandem auffällt. Wer seine Seite weiterleiten will, tut das im DNS oder in
# der Domain-Einstellung, wo es sichtbar ist.
_HEAD_ATTRS: dict[str, set[str]] = {
    "meta": {"name", "property", "content", "charset"},
    "link": {"rel", "href", "type", "sizes", "crossorigin", "as", "media"},
    "title": set(),
}


def _validate_head_html(value: str | None) -> str | None:
    """Kunden-HTML für den <head> auf eine Tag-Allowlist einschränken.

    Mit `nh3` und nicht per Regex: HTML per Zeichenkettenprüfung zu säubern ist
    der Klassiker unter den umgehbaren Filtern (`<img/onerror=…` kommt an jedem
    `<script`-Verbot vorbei). `nh3` parst und baut neu — was nicht in der
    Allowlist steht, existiert danach nicht mehr.

    Wird der Inhalt dabei VOLLSTÄNDIG entfernt, ist das ein Fehler und kein
    stiller Erfolg: der Kunde hätte sonst ein leeres Feld gespeichert und würde
    den Grund nie erfahren (Wurzel 5)."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    sauber = nh3.clean(
        v,
        tags=set(_HEAD_TAGS),
        attributes={k: set(a) for k, a in _HEAD_ATTRS.items()},
        # Nur http(s): ein `javascript:` in einem link-href ist kein Verweis,
        # sondern Code.
        url_schemes={"http", "https"},
        # Kein `rel="noopener"` anhängen — das ist eine Regel für Links im
        # Seiteninhalt und hätte im <head> nichts zu bedeuten; sie würde nur ein
        # vom Kunden gesetztes `rel` überschreiben.
        link_rel=None,
    ).strip()
    if not sauber:
        raise ValueError(
            "Im Kopfzeilen-HTML sind nur <meta>, <link> und <title> erlaubt. "
            "Skripte gehören in das JavaScript-Feld."
        )
    # Hat der Parser Attribute VERWORFEN, ist das ein Fehler und kein Erfolg.
    #
    # Der Fall, der es nötig macht: `<link rel=stylesheet href="javascript:…">`
    # kommt als `<link rel="stylesheet">` zurück — sicher, aber sinnlos. Ohne
    # diese Prüfung hätte der Kunde einen Verweis ohne Ziel gespeichert und
    # nichts hätte ihm gesagt, dass sein href verworfen wurde (Wurzel 5).
    #
    # Das ist KEINE Säuberung per Zeichenkette (die wäre umgehbar), sondern ein
    # Vergleich NACH dem echten Parser: gezählt wird, ob gleich viele
    # Nutzlast-Attribute übrig sind.
    # `http-equiv` steht mit in der Liste, obwohl es kein Nutzlast-Attribut ist:
    # es ist nicht erlaubt, und ohne diese Zeile bliebe ein
    # `<meta http-equiv="refresh" content="…">` als wirkungsloses
    # `<meta content="…">` stehen — gespeichert, ohne Wirkung, ohne Hinweis.
    for attribut in ("href", "content", "src", "http-equiv"):
        if v.lower().count(attribut + "=") > sauber.lower().count(attribut + "="):
            raise ValueError(
                f"Ein {attribut}-Wert wurde verworfen — erlaubt sind nur "
                "vollständige http(s)-Adressen."
            )
    return sauber


def _validate_kein_html(value: str | None) -> str | None:
    """CSS-/JS-Feld: nur Länge und Leerraum, KEINE Struktur-Prüfung.

    Ein `</style>`-Ausbruch im CSS wäre ein Problem — der Renderer verhindert ihn
    dort, wo er entsteht, indem er den Inhalt nicht in ein Element schreibt,
    sondern über eine CSS-Datei-Route ausliefert. Hier zu „säubern" würde
    gültiges CSS zerstören (ein `>` im Selektor ist normal)."""
    if value is None:
        return None
    v = value.strip()
    return v or None


def _validate_locales(value: list[str] | None) -> list[str] | None:
    """Sprachliste prüfen: bekannte Codes, keine Dubletten, mindestens eine.

    Eine leere Liste wird zu `None` — „keine Sprache" ist kein gültiger Zustand
    für eine Website, „noch nicht gewählt" schon."""
    if value is None:
        return None
    gesehen: list[str] = []
    for roh in value:
        code = (roh or "").strip().lower()
        if not code:
            continue
        if code not in _SITE_LOCALES:
            raise ValueError(f"Unbekannte Sprache: {roh}")
        if code not in gesehen:
            gesehen.append(code)
    return gesehen or None


# Social-Netzwerke, die die Fußzeile der Kunden-Site rendert. Die Liste ist die
# Allowlist: ein unbekannter Schlüssel wird abgelehnt statt still gespeichert und
# nie angezeigt — sonst tippt der Kunde seinen Threads-Link ein, sieht ihn
# nirgends und hält den Baukasten für kaputt.
#
# Muss mit `SOCIAL` in `builder/components/site-footer.tsx` deckungsgleich sein.
_SOCIAL_KEYS = frozenset(
    {"instagram", "facebook", "youtube", "linkedin", "pinterest", "tiktok"}
)


def _validate_social(value: dict[str, str]) -> dict[str, str]:
    """Social-Links prüfen: bekannter Schlüssel, absolute http(s)-Adresse.

    Diese Werte landen ungeprüft in einem `href` der Gast-Fußzeile. Der Renderer
    hat einen eigenen Backstop, aber der Schutz gehört ans SPEICHERN — sonst
    liegt ein `javascript:`-Wert in der Datenbank und wartet auf die erste
    Anzeigestelle, die ihn ohne Prüfung ausgibt (Wurzel 8).

    Leere Werte werden entfernt, nicht als Leerstring gespeichert: „kein
    Instagram" ist das Fehlen des Schlüssels, nicht ein leerer Link."""
    out: dict[str, str] = {}
    for key, raw in (value or {}).items():
        if key not in _SOCIAL_KEYS:
            raise ValueError(f"Unbekanntes Netzwerk: {key}")
        v = (raw or "").strip()
        if not v:
            continue
        if not v.lower().startswith(("http://", "https://")):
            raise ValueError(
                f"{key}: nur vollständige http(s)-Adressen (z. B. https://…)."
            )
        out[key] = v
    return out


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
    Pfad selbst (``""`` = "/"), es wandert keine fertige URL durch die API."""

    slug: str
    title: str


class PublicNav(BaseModel):
    """Navigation der Kunden-Site, nach Bereich getrennt und je Bereich sortiert.

    Ohne das war jede Unterseite, die der Kunde anlegte, unerreichbar: die
    Kopfzeile des Renderers zeigte nur das Logo und einen festen Knopf. Seiten
    mit ``nav_area='none'`` erscheinen bewusst in KEINER Liste."""

    header: list[PublicNavItem] = Field(default_factory=list)
    footer: list[PublicNavItem] = Field(default_factory=list)


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
    # Bild-Adressen gehören zur selben Allowlist wie jeder andere Link des
    # Slices. Ohne sie kamen `javascript:`- und `data:`-URIs durch: im
    # <img>-Kontext nicht ausführbar, aber ein data:-URI schreibt mehrere
    # Megabyte in die Inhaltsspalte, und ein beliebiger Host wird zum
    # Tracking-Pixel auf der Gästeseite (Wurzel 8).
    _v_image_url = field_validator("image_url")(_validate_href)


class RichTextContent(BaseModel):
    html: dict[str, str] = Field(default_factory=dict)  # TipTap-HTML je Locale
    align: str = "left"  # "left" | "center"
    font_family: str | None = None

    _v_html = field_validator("html")(_sanitize_rich_html)


class ImageContent(BaseModel):
    url: str | None = None
    alt: dict[str, str] = Field(default_factory=dict)
    caption: dict[str, str] = Field(default_factory=dict)

    _v_url = field_validator("url")(_validate_href)


class GalleryImage(BaseModel):
    url: str
    alt: dict[str, str] = Field(default_factory=dict)

    _v_url = field_validator("url")(_validate_href)


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
class NavArea(StrEnum):
    """Wo eine Seite in der Navigation der Kunden-Site hängt (0421).

    Die Zuordnung IST die Seitenstruktur — genau wie im Markt üblich: was in der
    Kopfzeile steht, was in der Fußzeile, und was nur per Direktlink erreichbar
    ist (z. B. Impressum-Unterseiten, Landingpages für Kampagnen)."""

    header = "header"
    footer = "footer"
    none = "none"


class PageCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(default="", max_length=200)
    nav_area: NavArea = NavArea.header

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
    nav_area: NavArea | None = None
    nav_order: int | None = None
    # Sprachen, in denen DIESE Seite existiert (0426). `None` = alle Sprachen der
    # Website — der Normalfall, der keinen Eintrag braucht.
    languages: list[str] | None = None

    _v_og_image_url = field_validator("og_image_url")(_validate_href)
    _v_languages = field_validator("languages")(_validate_locales)

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
