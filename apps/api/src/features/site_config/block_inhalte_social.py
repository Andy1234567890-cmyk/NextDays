"""``content``-Schemas der SOCIAL-/SONSTIGES-Widgets (0471).

Sechs Typen aus dem Hostaway-Vergleich (`docs/HOSTAWAY-BWP-STAND.md`):
Social-Symbole, Teilen-Knopf, WhatsApp, RSS-Feed, Facebook-Feed, HTML-Widget.

Eigene Datei aus demselben Grund wie ``block_inhalte_basis.py``/
``block_inhalte_business.py``: die 1500-Zeilen-Grenze von `pylint`.

``social_icons`` trägt bewusst KEINE eigene Link-Liste. Die Adressen stehen
bereits EINMAL im Firmenprofil (``branding.social_links``, geprüft gegen
``_SOCIAL_KEYS``) und speisen dort die Fußzeile jeder Website — ein zweites
Formular für dieselben vier Links wäre eine Kopie, die beim nächsten
Instagram-Umzug an nur EINER von zwei Stellen aktualisiert würde
(„Kontodaten automatisch, nicht per Knopf"). Der Abschnitt entscheidet nur
über die DARSTELLUNG (Größe, Stil, Ausrichtung).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from .basis import _RICH_TEXT_ATTRS, _RICH_TEXT_TAGS

# =========================================================================
# Social-Symbole
# =========================================================================


class SocialIconsContent(BaseModel):
    """Zeigt die Netzwerke aus ``branding.social_links`` als Symbolreihe.

    Kein Import-Zirkel: der Renderer liest das Firmenprofil selbst (wie beim
    Kontakt- und beim Business-Hours-Abschnitt), dieses Schema hält nur die
    Gestaltung."""

    headline: dict[str, str] = Field(default_factory=dict)
    size: str = "md"  # "sm" | "md" | "lg"
    style: str = "filled"  # "filled" | "outline" | "minimal"
    alignment: str = "center"  # "left" | "center" | "right"

    @field_validator("size")
    @classmethod
    def _v_size(cls, v: str) -> str:
        if v not in ("sm", "md", "lg"):
            raise ValueError("Größe: 'sm', 'md' oder 'lg'.")
        return v

    @field_validator("style")
    @classmethod
    def _v_style(cls, v: str) -> str:
        if v not in ("filled", "outline", "minimal"):
            raise ValueError("Stil: 'filled', 'outline' oder 'minimal'.")
        return v

    @field_validator("alignment")
    @classmethod
    def _v_alignment(cls, v: str) -> str:
        if v not in ("left", "center", "right"):
            raise ValueError("Ausrichtung: 'left', 'center' oder 'right'.")
        return v


# =========================================================================
# Teilen-Knopf
# =========================================================================


class ShareButtonContent(BaseModel):
    """Teilt die AKTUELLE Seite. Kein ``url``-Feld: eine feste Adresse in den
    Daten würde auf jeder Seite dasselbe Ziel teilen, egal wo der Knopf steht —
    das wäre auf einer zweiten Seite mit demselben Abschnitt schlicht falsch.
    Der Renderer liest ``window.location`` im Browser."""

    label: dict[str, str] = Field(default_factory=dict)
    style: str = "icon_label"  # "icon" | "icon_label"
    facebook: bool = True
    x: bool = True
    linkedin: bool = True
    whatsapp: bool = True
    email: bool = True
    copy_link: bool = True

    @field_validator("style")
    @classmethod
    def _v_style(cls, v: str) -> str:
        if v not in ("icon", "icon_label"):
            raise ValueError("Stil: 'icon' oder 'icon_label'.")
        return v


# =========================================================================
# WhatsApp-Chat
# =========================================================================

# E.164-artig: '+' optional, 8–15 Ziffern. Der Wert landet in einem
# `https://wa.me/`-Link — WhatsApp verlangt dort NUR Ziffern (kein '+', keine
# Trennzeichen), der Renderer entfernt sie beim Zusammenbauen. Geprüft wird
# hier trotzdem streng: eine Nummer mit Buchstaben wäre ein Link, der bei
# WhatsApp ins Leere läuft, ohne dass der Betrieb es bemerkt (Wurzel 5).
_WHATSAPP_RE = re.compile(r"^\+?[0-9]{8,15}$")


class WhatsappChatContent(BaseModel):
    """Schwebende WhatsApp-Schaltfläche (Hostaways „WhatsApp Chat Widget").

    Reiner ``wa.me``-Link — kein fremdes Skript, kein iframe. WhatsApp bietet
    kein eingebettetes Chat-Fenster für fremde Websites an; ``wa.me`` ist der
    offizielle, dokumentierte Weg."""

    # Optional (nicht `str` ohne Default): ein neu angelegter Abschnitt hat
    # zunächst leeres `content` — ein Pflichtfeld ohne Default ließe schon das
    # ANLEGEN des Abschnitts mit 422 scheitern, bevor der Kunde die Nummer
    # überhaupt eintippen konnte. Der Renderer zeigt ohne Nummer den
    # Leerzustand (im Entwurf) bzw. nichts (live) — dieselbe Regel wie bei
    # `click_to_call`.
    phone: str | None = None
    message: dict[str, str] = Field(default_factory=dict)
    label: dict[str, str] = Field(default_factory=dict)
    position: str = "right"  # "left" | "right"

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        vv = v.strip().replace(" ", "")
        if not vv:
            return None
        if not _WHATSAPP_RE.match(vv):
            raise ValueError(
                "Bitte die WhatsApp-Nummer mit Landesvorwahl angeben "
                "(z. B. +49 151 23456789)."
            )
        return vv

    @field_validator("position")
    @classmethod
    def _v_position(cls, v: str) -> str:
        if v not in ("left", "right"):
            raise ValueError("Position: 'left' oder 'right'.")
        return v


# =========================================================================
# RSS-Feed
# =========================================================================

#: Höchstzahl der angezeigten Einträge. Kein unbegrenzter Bereich (Wurzel 8) —
#: dieselbe Größenordnung wie beim Beiträge-Abschnitt (`posts`, 1–9), hier
#: etwas großzügiger, weil ein Feed typischerweise dichter gefüllt ist.
MAX_RSS_ITEMS = 12


def _v_feed_url(value: str) -> str:
    """Nur absolute http(s)-Adressen. Der SSRF-harte Abruf selbst passiert
    NICHT hier — er läuft serverseitig beim Rendern über
    ``core.ausgehende_url`` (IP-Prüfung, Pinning). Diese Prüfung verhindert nur,
    dass beim Speichern schon ein offensichtlich falsches Schema landet."""
    v = (value or "").strip()
    if not v:
        raise ValueError("Bitte eine Feed-Adresse angeben.")
    zerlegt = urlparse(v)
    if zerlegt.scheme not in ("http", "https") or not zerlegt.hostname:
        raise ValueError("Bitte eine vollständige http(s)-Adresse angeben.")
    if len(v) > 2000:
        raise ValueError("Die Feed-Adresse ist zu lang.")
    return v


class RssFeedContent(BaseModel):
    """Zeigt die neuesten Einträge eines FREMDEN RSS-/Atom-Feeds.

    Der Abruf ist serverseitig gecacht (``site_rss_widget_cache``) — sonst
    würde JEDER Gast-Seitenaufruf einen Abruf beim fremden Feed auslösen
    (Wurzel 8)."""

    headline: dict[str, str] = Field(default_factory=dict)
    feed_url: str = ""
    max_items: int = Field(default=6, ge=1, le=MAX_RSS_ITEMS)
    show_date: bool = True
    show_excerpt: bool = True
    open_new_tab: bool = True

    @field_validator("feed_url")
    @classmethod
    def _v_url(cls, v: str) -> str:
        if not v:
            return v
        return _v_feed_url(v)


# =========================================================================
# Facebook-Feed
# =========================================================================


def _v_facebook_url(value: str) -> str:
    """Nur eine ECHTE facebook.com-Seiten-Adresse.

    Der Renderer baut die Einbettungs-Adresse (Facebooks eigenes iframe-
    Page-Plugin) SELBST aus dieser geprüften Adresse zusammen — genau wie bei
    ``video``/``audio`` wandert die Kundeneingabe nie direkt in ein `src`."""
    v = (value or "").strip()
    if not v:
        raise ValueError("Bitte die Adresse der Facebook-Seite angeben.")
    zerlegt = urlparse(v)
    host = (zerlegt.hostname or "").lower().removeprefix("www.")
    if zerlegt.scheme != "https" or host not in ("facebook.com", "fb.com"):
        raise ValueError(
            "Bitte eine vollständige facebook.com-Adresse angeben "
            "(z. B. https://www.facebook.com/IhrBetrieb)."
        )
    if len(v) > 500:
        raise ValueError("Die Adresse ist zu lang.")
    return v


class FacebookFeedContent(BaseModel):
    """Eingebettete Facebook-Seite (Facebooks „Page Plugin", iframe)."""

    headline: dict[str, str] = Field(default_factory=dict)
    page_url: str = ""
    tabs: str = "timeline"  # "timeline" | "events" | "messages"
    height: int = Field(default=500, ge=200, le=1200)
    hide_cover: bool = False
    small_header: bool = False

    @field_validator("page_url")
    @classmethod
    def _v_url(cls, v: str) -> str:
        if not v:
            return v
        return _v_facebook_url(v)

    @field_validator("tabs")
    @classmethod
    def _v_tabs(cls, v: str) -> str:
        if v not in ("timeline", "events", "messages"):
            raise ValueError("Reiter: 'timeline', 'events' oder 'messages'.")
        return v


# =========================================================================
# HTML-Widget
# =========================================================================

# Weiter als die Rich-Text-Allowlist (Layout-Elemente für ein „Custom HTML"-
# Widget), aber IMMER NOCH keine Skript-/Einbettungs-Vektoren: kein <script>,
# kein <iframe>, kein <style>, keine on*-Attribute. nh3 (echter Parser) statt
# Regex (Wurzel 8) — das gilt hier umso mehr, weil dieses Feld gezielt dafür
# gedacht ist, mehr Markup zuzulassen als die anderen Textfelder.
_HTML_WIDGET_TAGS = _RICH_TEXT_TAGS | {
    "div", "span", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "img", "hr", "figure", "figcaption", "sup", "sub", "small", "dl", "dt", "dd",
}
_HTML_WIDGET_ATTRS = {
    **_RICH_TEXT_ATTRS,
    "div": {"style"},
    "span": {"style"},
    "table": {"style"},
    "td": {"style", "colspan", "rowspan"},
    "th": {"style", "colspan", "rowspan"},
    "img": {"src", "alt", "title", "width", "height"},
    "a": {"href", "title", "target", "style"},
}


def _sanitize_html_widget(value: dict[str, str]) -> dict[str, str]:
    import nh3  # lokal, um den Modulkopf schlank zu halten (wie in rss_import.py)

    return {
        locale: nh3.clean(
            html or "",
            tags=_HTML_WIDGET_TAGS,
            attributes=_HTML_WIDGET_ATTRS,
            url_schemes={"http", "https", "mailto", "tel"},
            link_rel="noopener noreferrer nofollow",
        )
        for locale, html in (value or {}).items()
    }


class HtmlWidgetContent(BaseModel):
    """Freies HTML-Markup — beim SPEICHERN mit `nh3` gegen eine erweiterte
    Allowlist bereinigt (Wurzel 8), nicht per Regex. Kein `<script>`, kein
    `<iframe>`, keine Ereignis-Attribute: was der Baukasten an
    JavaScript-Möglichkeit bietet, ist ausschließlich die eigens dafür
    gebaute Regel-Aktion „Eigenes JavaScript" (`docs/HOSTAWAY-BWP-STAND.md`) —
    dort läuft es kontrolliert über EINE geprüfte Stelle, nicht über jeden
    Abschnitt einzeln."""

    html: dict[str, str] = Field(default_factory=dict)

    _v_html = field_validator("html")(_sanitize_html_widget)
