"""Darstellungs-Einstellungen eines Containers: Sperre, Layout, Größe.

Ausgelagert aus ``schemas.py``, weil die Datei die 1500-Zeilen-Grenze von
``pylint`` überschritt — und weil der Schnitt derselbe ist wie in der
Oberfläche: das hier sind die Karten `Layout` und `Größe` des Inspektors, die
Framer und Elementor genauso führen.

``BlockSettings`` erbt davon; die Felder stehen dadurch unverändert in
derselben JSON-Spalte wie bisher. Es ist eine reine Code-Aufteilung, keine
Datenänderung.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .basis import _SITE_LOCALES, _validate_href

#: Ein Abstand mit Einheit. Negatives Vorzeichen nur außen (Margin).
_ABSTAND_RE = r"^-?\d{1,4}(px|%|vh|vw)$"
#: Innenabstand kennt kein Minus: negatives Padding gibt es in CSS nicht, ein
#: `-8px` würde stillschweigend verworfen und der Kunde suchte den Fehler bei
#: sich.
_INNENABSTAND_RE = r"^\d{1,4}(px|%|vh|vw)$"

# --- Farben (Etappe 2, 05.09.2026) -------------------------------------------
# Eine Farbe ist ENTWEDER ein Hex-Wert (6 oder 8 Stellen, mit Deckung) ODER ein
# Verweis auf eine Farbrolle des Themes (`rolle:primary`). Keine Namen wie
# `red`, keine `rgb()`-Ausdrücke: beides ist im Editor nicht darstellbar und im
# Renderer nicht prüfbar. Die Rollen sind genau die CSS-Variablen aus
# `builder/app/globals.css` — SCHWESTERWERT `FARBROLLEN` in
# `packages/baukasten-stil/src/index.ts`.
FARBROLLEN = (
    "background", "foreground", "card", "card-foreground", "primary",
    "primary-foreground", "secondary", "secondary-foreground", "muted",
    "muted-foreground", "accent", "accent-foreground", "border", "input",
    "ring",
)
_FARBE_RE = (
    r"^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|rolle:(" + "|".join(FARBROLLEN) + r"))$"
)
#: Ein Maß mit Einheit, nie negativ (Größen).
_MASS_RE = _INNENABSTAND_RE
#: Anker eines Scroll-Abschnitts: ein gültiges HTML-`id`, klein, ohne Leerraum.
_ANKER_RE = r"^[a-z][a-z0-9-]{0,49}$"
_PARAMETER_RE = r"^[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*(&[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*){0,9}$"
#: Seitenverhältnis wie in CSS `aspect-ratio`: `16/9`, `1/1`, `4 / 3`.
_VERHAELTNIS_RE = r"^\d{1,4}(\.\d{1,3})?\s*/\s*\d{1,4}(\.\d{1,3})?$"

# --- Schriften (Framer „Font", 06.09.2026) -----------------------------------
# Die wählbaren Familien sind der kuratierte Katalog — SCHWESTERWERT von
# `FONT_CATALOG` in `web/lib/website-fonts.ts` und `builder/lib/fonts-catalog.ts`
# (`scripts/i18n/sprachlisten-pruefen.mjs`-Muster: drei Kopien, ein Wert).
# Ein Name außerhalb der Liste wird abgewiesen statt still im Fallback zu
# landen: der Renderer kennt nur diese dreizehn Stacks (Wurzel 4).
SCHRIFTFAMILIEN = (
    "Inter", "Fraunces", "DM Sans", "Poppins", "Manrope", "Work Sans",
    "Space Grotesk", "Playfair Display", "Lora", "Cormorant Garamond",
    "Libre Baskerville", "Spectral", "JetBrains Mono",
)

# --- Codeüberschreibungen (Framer „Code Overrides", 06.09.2026) ---------------
# Framer hängt hier eine TypeScript-Datei an das Element. Kundencode am Element
# ist bei uns ausgeschlossen (Wurzel 8) — was bleibt, ist der Teil, den man
# ohne Skript braucht: eigene CSS-Eigenschaften, die der Inspektor nicht als
# Zeile führt. Zugelassen ist NUR diese Liste; Werte dürfen kein `url(`, kein
# `expression(`, keine Klammern `{}` und kein `@` tragen — alles, was aus einer
# Eigenschaft eine zweite Regel, einen Fetch oder Skript machen könnte.
CSS_EIGENSCHAFTEN = frozenset(
    {
        "color", "background", "background-color", "background-image",
        "background-size", "background-position", "background-repeat",
        "background-clip", "border", "border-top", "border-right",
        "border-bottom", "border-left", "border-color", "border-width",
        "border-style", "border-radius", "outline", "outline-offset",
        "box-shadow", "opacity", "filter", "backdrop-filter", "mix-blend-mode",
        "width", "height", "min-width", "max-width", "min-height", "max-height",
        "aspect-ratio", "margin", "margin-top", "margin-right", "margin-bottom",
        "margin-left", "padding", "padding-top", "padding-right",
        "padding-bottom", "padding-left", "gap", "row-gap", "column-gap",
        "display", "flex", "flex-direction", "flex-wrap", "flex-grow",
        "flex-shrink", "flex-basis", "justify-content", "align-items",
        "align-self", "align-content", "order", "grid-template-columns",
        "grid-template-rows", "grid-column", "grid-row", "grid-auto-flow",
        "position", "top", "right", "bottom", "left", "inset", "z-index",
        "overflow", "overflow-x", "overflow-y", "transform", "transform-origin",
        "transition", "animation", "cursor", "pointer-events", "user-select",
        "visibility", "font-family", "font-size", "font-weight", "font-style",
        "line-height", "letter-spacing", "text-align", "text-transform",
        "text-decoration", "text-shadow", "white-space", "word-break",
        "text-overflow", "object-fit", "object-position", "clip-path",
        "mask-image", "isolation", "will-change", "scroll-margin-top",
        "text-wrap", "hyphens", "columns",
    }
)
_CSS_WERT_VERBOTEN = ("url(", "expression(", "javascript", "@", "{", "}", "<", ">", "\\", "/*")


def css_zerlegen(roh: str) -> tuple[list[tuple[str, str]], list[str]]:
    """`prop: wert; prop: wert` → geprüfte Paare und die abgewiesenen Zeilen.

    SCHWESTERFUNKTION von `codeCssZerlegen` in `packages/baukasten-stil`: der
    Editor prüft mit derselben Regel VOR dem Senden und zeigt die abgewiesenen
    Zeilen an, statt auf einen 400 zu warten. Eine Zeile ohne Doppelpunkt, eine
    unbekannte Eigenschaft oder ein verbotener Wert kommt in `fehler` — nichts
    davon wird still verschluckt (Wurzel 5).
    """
    paare: list[tuple[str, str]] = []
    fehler: list[str] = []
    for zeile in roh.replace("\n", ";").split(";"):
        z = zeile.strip()
        if not z:
            continue
        if ":" not in z:
            fehler.append(z)
            continue
        prop, wert = z.split(":", 1)
        prop = prop.strip().lower()
        wert = wert.strip()
        klein = wert.lower()
        if (
            prop not in CSS_EIGENSCHAFTEN
            or not wert
            or len(wert) > 200
            or any(v in klein for v in _CSS_WERT_VERBOTEN)
        ):
            fehler.append(z)
            continue
        paare.append((prop, wert))
    return paare, fehler


class _Teil(BaseModel):
    """Basis jedes Unterobjekts: unbekannte Schlüssel sind ein FEHLER.

    `BlockSettings` reicht Unbekanntes durch (`extra="allow"`), weil dort
    laufend neue Felder dazukommen. In einem Unterobjekt ist die Lage
    umgekehrt: sein Feldsatz ist geschlossen, und ein Tippfehler im Schlüssel
    (`opazität` statt `opazitaet`) verschwände sonst still in der Zeile — der
    Editor zeigte „gespeichert", der Renderer täte nichts (Wurzel 5).
    """

    model_config = ConfigDict(extra="forbid")


class Mass(_Teil):
    """Breite oder Höhe mit MODUS, wie Framers Sizing-Klappliste.

    * ``fest``     — Pixel (`wert` Pflicht).
    * ``relativ``  — Prozent des Elternteils (`wert` Pflicht).
    * ``viewport`` — Prozent des Fensters, vw bzw. vh (`wert` Pflicht).
    * ``fuellen``  — nimmt den Restplatz der Flex-Reihe (kein `wert`).
    * ``inhalt``   — so groß wie der Inhalt (kein `wert`).
    """

    modus: Literal["fest", "relativ", "viewport", "fuellen", "inhalt"]
    wert: float | None = Field(default=None, ge=0, le=10000)

    @model_validator(mode="after")
    def _wert_passt_zum_modus(self) -> Mass:
        braucht = self.modus in ("fest", "relativ", "viewport")
        if braucht and self.wert is None:
            raise ValueError(f"Modus „{self.modus}“ braucht einen Wert.")
        if not braucht and self.wert is not None:
            raise ValueError(f"Modus „{self.modus}“ hat keinen Wert.")
        if self.modus in ("relativ", "viewport") and self.wert > 1000:
            raise ValueError("Prozentwerte über 1000 sind kein Maß.")
        return self


class PositionDarstellung(_Teil):
    """Framer „Position": Typ und Abstände zu den Kanten des Bezugsrahmens.

    Bei ``relativ`` (dem Normalfall, dem Verhalten ohne Angabe) wirken die
    Kantenabstände nicht; sie werden trotzdem gespeichert, damit ein Wechsel
    zu ``absolut`` und zurück nichts verliert (Wurzel 1: der Gegenzustand).
    """

    typ: Literal["relativ", "absolut", "fixiert", "klebend"] | None = None
    oben: str | None = Field(default=None, pattern=_ABSTAND_RE)
    rechts: str | None = Field(default=None, pattern=_ABSTAND_RE)
    unten: str | None = Field(default=None, pattern=_ABSTAND_RE)
    links: str | None = Field(default=None, pattern=_ABSTAND_RE)
    #: Stapelreihenfolge. Enge Grenzen: ein Wert wie 999999 legt sich über
    #: Kopfzeile, Cookie-Hinweis und Editor-Overlay (Wurzel 8).
    ebene: int | None = Field(default=None, ge=-10, le=100)


class GroesseDarstellung(_Teil):
    """Framer „Size": Breite/Höhe mit Modus, Min/Max und Seitenverhältnis."""

    breite: Mass | None = None
    hoehe: Mass | None = None
    min_breite: str | None = Field(default=None, pattern=_MASS_RE)
    max_breite: str | None = Field(default=None, pattern=_MASS_RE)
    min_hoehe: str | None = Field(default=None, pattern=_MASS_RE)
    max_hoehe: str | None = Field(default=None, pattern=_MASS_RE)
    #: Die „Kette" zwischen Breite und Höhe (Lock Aspect Ratio).
    seitenverhaeltnis: str | None = Field(default=None, pattern=_VERHAELTNIS_RE)


class Verlaufsstufe(_Teil):
    farbe: str = Field(pattern=_FARBE_RE)
    #: Lage auf der Achse in Prozent.
    position: float = Field(ge=0, le=100)


class Fuellung(_Teil):
    """Framer „Fill": Farbe, Verlauf oder Bild — genau eines davon.

    Ein Bild trägt dieselbe href-Allowlist wie `background_image_url`: ohne
    sie kämen `javascript:`- und `data:`-URIs durch (Wurzel 8).
    """

    art: Literal["farbe", "verlauf", "bild"]
    farbe: str | None = Field(default=None, pattern=_FARBE_RE)
    #: Framers drei Verlaufsformen (Linear · Radial · Conic, Vollerfassung
    #: §4.8). `None` heißt linear — der Bestand kennt nur den. `lage` ist bei
    #: Radial/Conic der Mittelpunkt, `winkel` bei Linear/Conic der Startwinkel.
    form: Literal["linear", "radial", "konisch"] | None = None
    winkel: int | None = Field(default=None, ge=0, le=360)
    stufen: list[Verlaufsstufe] | None = Field(default=None, min_length=2, max_length=8)
    url: str | None = None
    #: Dunkle Auflage über dem Bild (0 = keine), wie `background_overlay`.
    auflage: float | None = Field(default=None, ge=0.0, le=0.9)
    groesse: Literal["cover", "contain", "auto"] | None = None
    lage: (
        Literal[
            "center", "top", "bottom", "left", "right",
            "top left", "top right", "bottom left", "bottom right",
        ]
        | None
    ) = None
    wiederholen: bool | None = None

    _v_url = field_validator("url")(_validate_href)

    @model_validator(mode="after")
    def _art_hat_ihre_felder(self) -> Fuellung:
        if self.art == "farbe" and self.farbe is None:
            raise ValueError("Füllung „farbe“ braucht eine Farbe.")
        if self.art == "verlauf" and not self.stufen:
            raise ValueError("Füllung „verlauf“ braucht Stufen.")
        if self.art == "bild" and not self.url:
            raise ValueError("Füllung „bild“ braucht eine Adresse.")
        return self


class Radius(_Teil):
    """Framer „Radius | Radius per corner": ein Wert ODER vier Ecken."""

    alle: int | None = Field(default=None, ge=0, le=500)
    oben_links: int | None = Field(default=None, ge=0, le=500)
    oben_rechts: int | None = Field(default=None, ge=0, le=500)
    unten_rechts: int | None = Field(default=None, ge=0, le=500)
    unten_links: int | None = Field(default=None, ge=0, le=500)


class Grenze(_Teil):
    """Framer „Border": Breite, Farbe, Art, optional nur bestimmte Seiten."""

    breite: int = Field(ge=0, le=40)
    farbe: str = Field(pattern=_FARBE_RE)
    art: Literal["solid", "dashed", "dotted", "double"] = "solid"
    seiten: list[Literal["oben", "rechts", "unten", "links"]] | None = Field(
        default=None, max_length=4
    )


class Schatten(_Teil):
    """Framer „Shadow": Lage, Weichzeichnung, Ausbreitung, Farbe, innen/außen."""

    x: int = Field(default=0, ge=-200, le=200)
    y: int = Field(default=0, ge=-200, le=200)
    weich: int = Field(default=0, ge=0, le=200)
    ausbreitung: int = Field(default=0, ge=-100, le=100)
    farbe: str = Field(pattern=_FARBE_RE)
    innen: bool = False


class Filter(_Teil):
    """Framer „Filters": Weichzeichnen, Helligkeit, Kontrast, Sättigung, Graustufen."""

    weichzeichnen: int | None = Field(default=None, ge=0, le=100)
    helligkeit: int | None = Field(default=None, ge=0, le=200)
    kontrast: int | None = Field(default=None, ge=0, le=200)
    saettigung: int | None = Field(default=None, ge=0, le=200)
    graustufen: int | None = Field(default=None, ge=0, le=100)


class Maske(_Teil):
    """Framer „Styles › Mask": ein Verlauf als `mask-image`.

    Linear läuft von `start` % (deckend) bis `ende` % (durchsichtig) entlang
    `winkel`; radial vom Mittelpunkt nach außen. `umkehren` tauscht deckend
    und durchsichtig — Framers „Invert".
    """

    art: Literal["linear", "radial"] = "linear"
    winkel: int = Field(default=180, ge=0, le=360)
    start: int = Field(default=0, ge=0, le=100)
    ende: int = Field(default=100, ge=0, le=100)
    umkehren: bool = False

    @model_validator(mode="after")
    def _start_vor_ende(self) -> Maske:
        if self.start >= self.ende:
            raise ValueError("Maske: Start muss vor dem Ende liegen.")
        return self


class StilDarstellung(_Teil):
    """Framer „Styles": Opazität, Sichtbar, Füllung, Überlauf, Radius, Grenze,
    Schatten.

    `sichtbar: False` blendet auf der GAST-Seite aus; im Editor bleibt die
    Ebene durchscheinend stehen (derselbe Rückweg wie bei `hidden_on`).
    """

    # Framer „Styles+ › Mask" und „Selection" (06.09.2026): Verlaufsmaske und
    # die Farben der Textmarkierung (`::selection`). „Draggable" aus demselben
    # Menü ist KEIN eigenes Feld — es ist der Drag-Effekt (`effekte.ziehen`),
    # den der Inspektor von beiden Köpfen aus öffnet (eine Wahrheit, Wurzel 2).
    maske: Maske | None = None
    auswahl_farbe: str | None = Field(default=None, pattern=_FARBE_RE)
    auswahl_hintergrund: str | None = Field(default=None, pattern=_FARBE_RE)
    opazitaet: float | None = Field(default=None, ge=0.0, le=1.0)
    sichtbar: bool | None = None
    fuellung: Fuellung | None = None
    ueberlauf: Literal["sichtbar", "verborgen", "abschneiden", "scrollen"] | None = None
    radius: Radius | None = None
    grenze: Grenze | None = None
    schatten: list[Schatten] | None = Field(default=None, max_length=6)
    # --- Framers Styles-„+" (Vollerfassung §7, 06.09.2026) ------------------
    mischmodus: (
        Literal[
            "normal", "multiply", "screen", "overlay", "darken", "lighten",
            "difference", "exclusion", "hue", "saturation", "color", "luminosity",
        ]
        | None
    ) = None
    filter: Filter | None = None
    ueberlauf_x: Literal["sichtbar", "verborgen", "abschneiden", "scrollen"] | None = None
    ueberlauf_y: Literal["sichtbar", "verborgen", "abschneiden", "scrollen"] | None = None
    #: False = `pointer-events: none` (Framer „Pointer Events").
    zeiger_ereignisse: bool | None = None
    #: False = `user-select: none` (Framer „User Select").
    text_auswahl: bool | None = None
    #: `-webkit-tap-highlight-color` (Framer „Tap Color").
    tippfarbe: str | None = Field(default=None, pattern=_FARBE_RE)


class TransformDarstellung(_Teil):
    """Framer „Transforms": Rotation, Skalierung, Versatz, Neigung, Ursprung."""

    rotation: float | None = Field(default=None, ge=-360, le=360)
    skalierung: float | None = Field(default=None, ge=0, le=10)
    versatz_x: str | None = Field(default=None, pattern=_ABSTAND_RE)
    versatz_y: str | None = Field(default=None, pattern=_ABSTAND_RE)
    neigung_x: float | None = Field(default=None, ge=-89, le=89)
    neigung_y: float | None = Field(default=None, ge=-89, le=89)
    ursprung: (
        Literal[
            "center", "top", "bottom", "left", "right",
            "top left", "top right", "bottom left", "bottom right",
        ]
        | None
    ) = None
    perspektive: int | None = Field(default=None, ge=0, le=5000)
    # --- 3D (Framer „Rotate 3D · Depth · Backface · Preserve 3D", 06.09.2026) --
    #: Drehung um die X- bzw. Y-Achse; `rotation` bleibt die Z-Achse (2D).
    rotation_x: float | None = Field(default=None, ge=-360, le=360)
    rotation_y: float | None = Field(default=None, ge=-360, le=360)
    #: `translateZ` in Pixeln — wirkt nur mit `perspektive` am Element oder Elternteil.
    tiefe: int | None = Field(default=None, ge=-500, le=500)
    #: `backface-visibility`.
    rueckseite: Literal["sichtbar", "verborgen"] | None = None
    #: `transform-style: preserve-3d` — Kinder behalten ihre Tiefe.
    raum_3d: bool | None = None


class ScrollDarstellung(_Teil):
    """Framer „Scroll Section": ein Anker, den Links anspringen können."""

    anker: str = Field(pattern=_ANKER_RE)
    #: Abstand, den die Seite beim Anspringen oben frei lässt (feste Kopfzeile).
    versatz_y: int | None = Field(default=None, ge=-500, le=500)


class A11yDarstellung(_Teil):
    """Framer „Accessibility": HTML-Element, Aria-Label, Tab-Index, verborgen."""

    tag: (
        Literal["div", "section", "article", "aside", "header", "footer", "nav", "main"]
        | None
    ) = None
    label: str | None = Field(default=None, max_length=120)
    tab_index: int | None = Field(default=None, ge=-1, le=100)
    fuer_leser_verborgen: bool | None = None
    #: Framer „Google Bot: Skip" — `data-nosnippet`, der Text erscheint nicht
    #: in Suchergebnis-Auszügen.
    nosnippet: bool | None = None


class TextDarstellung(_Teil):
    """Framer „Text": Schrift am ELEMENT — Farbe, Größe, Gewicht, Laufweite,
    Zeilenhöhe, Ausrichtung, Transformation, Dekoration, Balance, Kürzen.

    Gilt für alle Textknoten des Bausteins (Überschriften, Absätze, Listen).
    Die Schrift selbst ist eine Rolle des Themes (Überschrift/Fließtext), kein
    freier Fontname — die Schriften des Projekts stehen im Design-Panel.
    """

    #: Framer „Text Styles": eine Rolle des Themes. `ueberschrift`/`fliesstext`
    #: (Altbestand) wählen nur die Familie; die acht Theme-Rollen (`dflt`,
    #: `par`, `h1`–`h6`, Design › Text) bringen Familie, Größe, Gewicht,
    #: Zeilenhöhe, Laufweite und Farbe der Rolle mit — genau das, was Framers
    #: Textstil-Chip tut.
    schrift: (
        Literal[
            "ueberschrift", "fliesstext",
            "dflt", "par", "h1", "h2", "h3", "h4", "h5", "h6",
        ]
        | None
    ) = None
    #: Framer „Font": eine Familie aus dem Katalog — sie schlägt die Rolle.
    schriftfamilie: Literal[SCHRIFTFAMILIEN] | None = None  # type: ignore[valid-type]
    farbe: str | None = Field(default=None, pattern=_FARBE_RE)
    #: `62px` oder `3.5rem` — Einheit Pflicht, wie überall.
    groesse: str | None = Field(default=None, pattern=r"^\d{1,3}(\.\d{1,2})?(px|rem)$")
    gewicht: Literal[100, 200, 300, 400, 500, 600, 700, 800, 900] | None = None
    laufweite: str | None = Field(default=None, pattern=r"^-?\d{1,2}(\.\d{1,3})?(em|px)$")
    zeilenhoehe: str | None = Field(default=None, pattern=r"^\d{1,3}(\.\d{1,3})?(em|px|%)$")
    ausrichtung: Literal["start", "center", "end", "justify"] | None = None
    transformation: Literal["none", "uppercase", "lowercase", "capitalize"] | None = None
    dekoration: Literal["none", "underline", "line-through"] | None = None
    balance: bool | None = None
    #: Nach n Zeilen mit „…" abschneiden (Framer „Truncate").
    kuerzen: int | None = Field(default=None, ge=1, le=20)
    #: Framer „OpenType": Schriftmerkmale als `font-feature-settings`-Tags.
    opentype: (
        list[
            Literal[
                "liga", "dlig", "smcp", "c2sc", "onum", "lnum", "tnum", "pnum",
                "frac", "sups", "subs", "kern", "zero",
            ]
        ]
        | None
    ) = Field(default=None, max_length=13)


class LinkDarstellung(_Teil):
    """Framer „Link": das ganze Element verlinkt (Seite, Adresse, `#anker`).

    Dieselbe href-Allowlist wie jedes Linkfeld (Wurzel 8). Ohne Adresse gibt
    es keinen Link — `neuer_tab` allein wird abgewiesen, statt ein leeres
    `<a>` zu erzeugen.
    """

    href: str
    neuer_tab: bool = False
    #: Framer „Abschnitt": ein Scroll-Anker der Zielseite (`#anker`). Er wird
    #: an die Adresse gehängt; steht dort schon ein `#`, gewinnt die Adresse.
    anker: str | None = Field(default=None, pattern=_ANKER_RE)
    #: Framer „Rel": Verhältnis zum Ziel.
    rel: list[Literal["nofollow", "sponsored", "noopener", "noreferrer"]] | None = Field(
        default=None, max_length=4
    )
    #: Framer „Parameters": Abfrageteil ohne `?` (`utm_source=newsletter&utm_medium=mail`).
    parameter: str | None = Field(default=None, pattern=_PARAMETER_RE)
    #: Framer „Scrollen: Smooth/Instant" — wie ein Anker-Link auf derselben
    #: Seite anspringt. `None` = Browser-Standard (kein erfundenes „sanft").
    scrollen: Literal["sanft", "sofort"] | None = None
    #: Framer „Tracking": der Name des Ereignisses, das der Klick meldet. Er
    #: geht an das Google-Tag der Kunden-Website (`gtag_id`, 0430) und trägt
    #: deshalb GA4s Namensregeln: klein, Ziffern und Unterstrich, kein Umlaut.
    #: Ohne Kennung im Baukasten meldet er nichts — das Feld steht dort direkt
    #: daneben, also ist es keine stille Attrappe (Wurzel 4).
    tracking: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_]{0,39}$")

    _v_href = field_validator("href")(_validate_href)

    @model_validator(mode="after")
    def _adresse_pflicht(self) -> LinkDarstellung:
        if not self.href:
            raise ValueError("Ein Link braucht eine Adresse.")
        return self


class EffektErscheinen(_Teil):
    """Framer „Appear": beim Sichtbarwerden einblenden."""

    art: Literal[
        "einblenden", "hochgleiten", "vergroessern", "von_links", "von_rechts"
    ] = "einblenden"
    dauer: int = Field(default=600, ge=100, le=3000)
    verzoegerung: int = Field(default=0, ge=0, le=3000)
    #: Framer „Replay": False = nur einmal.
    wiederholen: bool = False


class EffektHover(_Teil):
    """Framer „Hover"/„Press": Zielzustand + Übergang."""

    opazitaet: float | None = Field(default=None, ge=0.0, le=1.0)
    skalierung: float | None = Field(default=None, ge=0, le=10)
    rotation: float | None = Field(default=None, ge=-360, le=360)
    versatz_x: str | None = Field(default=None, pattern=_ABSTAND_RE)
    versatz_y: str | None = Field(default=None, pattern=_ABSTAND_RE)
    dauer: int = Field(default=200, ge=0, le=3000)


class EffektSchleife(_Teil):
    """Framer „Loop": Dauerbewegung."""

    art: Literal["pulsieren", "schweben", "drehen", "wippen"] = "pulsieren"
    dauer: int = Field(default=2000, ge=300, le=20000)


class EffektZiehen(_Teil):
    """Framer „Drag" (Vollerfassung §8): das Element lässt sich mit der Maus
    verschieben. `frei` = beide Achsen, sonst nur `achse`; `zurueck` = Framers
    „Snap Back" (springt beim Loslassen an den Ursprung)."""

    frei: bool = True
    achse: Literal["x", "y"] | None = None
    zurueck: bool = False


class EffektLichtkasten(_Teil):
    """Framer „Lightbox": Klick öffnet die Bilder des Elements groß.

    Die Werte sind Framers Felder (Max Width 800, Padding 20, Z Index 10,
    Backdrop 000000) — hier als Standard, weil Framer sie beim Anlegen genauso
    setzt; sie sind also der Vorlage entnommen, nicht erfunden.
    """

    max_breite: int = Field(default=800, ge=200, le=2000)
    innenabstand: int = Field(default=20, ge=0, le=200)
    ebene: int = Field(default=10, ge=0, le=100)
    hintergrund: str = Field(default="#000000", pattern=_FARBE_RE)


class EffektTicker(_Teil):
    """Framer „Ticker": der Inhalt läuft als Endlosband.

    `tempo` in Prozent (100 = 60 px/s), `hover` = Framers Slow/Stop beim
    Überfahren, `ziehbar` = Framers Draggable am Ticker.
    """

    tempo: int = Field(default=100, ge=10, le=500)
    richtung: Literal["links", "rechts", "oben", "unten"] = "links"
    hover: Literal["weiter", "langsamer", "stopp"] = "weiter"
    ziehbar: bool = False


class EffektZustand(_Teil):
    """Ein Zustand für From/To des Scroll-Transforms — dieselben Achsen wie
    Hover/Press, ohne Dauer (die gibt der Scrollweg vor)."""

    opazitaet: float | None = Field(default=None, ge=0.0, le=1.0)
    skalierung: float | None = Field(default=None, ge=0, le=10)
    rotation: float | None = Field(default=None, ge=-360, le=360)
    versatz_x: str | None = Field(default=None, pattern=_ABSTAND_RE)
    versatz_y: str | None = Field(default=None, pattern=_ABSTAND_RE)


class EffektScrollTransform(_Teil):
    """Framer „Scroll Transform": das Element wandert beim Scrollen von `von`
    nach `nach`, gemessen an seiner Lage im Fenster (0 = unten hinein, 1 =
    oben hinaus). `ausloeser` = Framers Trigger."""

    ausloeser: Literal["scroll", "ebene_sichtbar", "abschnitt_sichtbar"] = "scroll"
    von: EffektZustand | None = None
    nach: EffektZustand | None = None

    @model_validator(mode="after")
    def _ein_ziel(self) -> EffektScrollTransform:
        if self.von is None and self.nach is None:
            raise ValueError("Scroll-Transform braucht einen Von- oder Nach-Zustand.")
        return self


class EffekteDarstellung(_Teil):
    """Framer „Effects" (Vollerfassung §8) — alles ohne Komponenten und ohne
    Varianten: Appear, Hover, Press, Loop, Drag, Lightbox, Ticker, Scroll Speed,
    Scroll Transform. Flow und Scroll Variant fehlen: sie brauchen Varianten."""

    erscheinen: EffektErscheinen | None = None
    hover: EffektHover | None = None
    druck: EffektHover | None = None
    schleife: EffektSchleife | None = None
    ziehen: EffektZiehen | None = None
    lichtkasten: EffektLichtkasten | None = None
    ticker: EffektTicker | None = None
    scroll_transform: EffektScrollTransform | None = None
    #: Framer „Scroll Speed" in Prozent — 100 = normal, 110 = eilt voraus (Parallax).
    scroll_tempo: int | None = Field(default=None, ge=10, le=300)


class CursorBild(_Teil):
    """Framer „Cursor › Custom Cursor" — dort eine Komponente, hier ein Bild aus
    der Mediathek (≤ 128 px, sonst zeigt der Browser den Standardzeiger).
    `x`/`y` = der Hotspot in Pixeln."""

    url: str
    x: int = Field(default=0, ge=0, le=128)
    y: int = Field(default=0, ge=0, le=128)

    _v_url = field_validator("url")(_validate_href)

    @model_validator(mode="after")
    def _adresse_pflicht(self) -> CursorBild:
        if not self.url:
            raise ValueError("Ein eigener Cursor braucht ein Bild.")
        return self


class OverlayDarstellung(_Teil):
    """Framer „Overlays" (Vollerfassung §9): ein Kasten, der beim Klick oder
    Überfahren des Elements erscheint — `relativ` am Element (Dropdown,
    Popover) oder `fixiert` mittig im Fenster (Modal, Toast).

    Framer legt dafür eine Kind-Ebene an. Unser Modell hat keine freien
    Kind-Ebenen; der Inhalt ist mehrsprachiger Text (je Sprache ein Eintrag,
    wie jedes Textfeld eines Bausteins), kein HTML (Wurzel 8).
    """

    typ: Literal["relativ", "fixiert"] = "relativ"
    ausloeser: Literal["klick", "hover"] = "klick"
    position: Literal["oben", "rechts", "unten", "links"] = "unten"
    ausrichten: Literal["start", "mitte", "ende"] = "mitte"
    versatz_x: int = Field(default=0, ge=-200, le=200)
    versatz_y: int = Field(default=10, ge=-200, le=200)
    schliessen: Literal["auto", "klick"] = "auto"
    breite: int | None = Field(default=None, ge=120, le=800)
    inhalt: dict[str, str] = Field(default_factory=dict)

    @field_validator("inhalt")
    @classmethod
    def _inhalt_pruefen(cls, wert: dict[str, str]) -> dict[str, str]:
        sauber: dict[str, str] = {}
        for code, text in wert.items():
            if code not in _SITE_LOCALES:
                raise ValueError(f"Unbekannte Sprache im Overlay: {code}")
            t = text.strip()
            if len(t) > 2000:
                raise ValueError("Overlay-Text ist länger als 2000 Zeichen.")
            if t:
                sauber[code] = t
        return sauber


class CodeDarstellung(_Teil):
    """Framer „Code Overrides" — bei uns eigene CSS-Eigenschaften am Element
    (Allowlist, siehe `css_zerlegen`). Gespeichert wird die BEREINIGTE Fassung;
    eine einzige abgewiesene Zeile ist ein 400 mit ihrem Wortlaut."""

    css: str = Field(max_length=4000)

    @field_validator("css")
    @classmethod
    def _css_pruefen(cls, wert: str) -> str:
        paare, fehler = css_zerlegen(wert)
        if fehler:
            raise ValueError("Nicht erlaubtes CSS: " + "; ".join(fehler[:3]))
        if not paare:
            raise ValueError("Codeüberschreibung ohne Eigenschaft.")
        return "\n".join(f"{p}: {w};" for p, w in paare)


class GeraeteUeberschreibung(_Teil):
    """Was sich je Gerät ÜBERSCHREIBEN lässt (Tablet, Mobil).

    Die Kaskade läuft Desktop → Tablet → Mobil: ein Wert gilt ab dem Gerät, an
    dem er gesetzt ist, für alle schmaleren, bis ein schmaleres ihn erneut
    setzt. Genau das ist Framers Breakpoint-Modell und der Grund, warum es
    kein `desktop`-Eintrag gibt: Desktop IST die Grundfassung (die Felder
    direkt in den Settings).

    Die Unterobjekte werden FELDWEISE gemischt, nicht als Ganzes ersetzt: ein
    Tablet mit nur `stil.opazitaet` behält Radius und Grenze des Desktops.
    Sperre, Name und `hidden_on` sind nicht je Gerät — `hidden_on` IST bereits
    die Geräteliste.
    """

    position: PositionDarstellung | None = None
    groesse: GroesseDarstellung | None = None
    stil: StilDarstellung | None = None
    transform: TransformDarstellung | None = None
    text: TextDarstellung | None = None
    # Die flachen Layout- und Abstandsfelder der Grundfassung, je Gerät.
    layout_richtung: Literal["zeile", "spalte"] | None = None
    layout_verteilen: (
        Literal["start", "mitte", "ende", "zwischen", "umgeben"] | None
    ) = None
    layout_ausrichten: (
        Literal["start", "mitte", "ende", "strecken"] | None
    ) = None
    layout_umbruch: bool | None = None
    layout_abstand: int | None = Field(default=None, ge=0, le=160)
    layout_typ: Literal["stapel", "raster"] | None = None
    raster_spalten: int | None = Field(default=None, ge=1, le=12)
    raster_zeilen: int | None = Field(default=None, ge=1, le=12)
    raster_abstand_x: int | None = Field(default=None, ge=0, le=160)
    raster_abstand_y: int | None = Field(default=None, ge=0, le=160)
    raster_span_x: int | None = Field(default=None, ge=1, le=12)
    raster_span_y: int | None = Field(default=None, ge=1, le=12)
    min_hoehe: int | None = Field(default=None, ge=0, le=2000)
    max_breite: int | None = Field(default=None, ge=320, le=2560)
    margin_top: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_right: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_bottom: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_left: str | None = Field(default=None, pattern=_ABSTAND_RE)
    padding_top: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_right: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_bottom: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_left: str | None = Field(default=None, pattern=_INNENABSTAND_RE)



class ContainerDarstellung(BaseModel):
    """Sperre, Flex-Layout und Größe — die Felder, die einen Rahmen ausmachen."""

    # --- Ebene sperren (28.08.2026) -----------------------------------------
    # Eine gesperrte Ebene lässt sich weder im Canvas anklicken noch im Baum
    # ziehen. Der Standardgriff jedes Layer-Panels (Framer `Lock ⌘L`, Figma,
    # Webflow) und dort aus einem Grund, den man erst beim Bauen merkt: der
    # Hintergrund-Frame liegt über allem und fängt jeden Klick ab, der
    # eigentlich dem Inhalt galt.
    #
    # Reine EDITOR-Eigenschaft. Auf der Gast-Seite hat sie keine Wirkung — ein
    # gesperrter Abschnitt wird gezeichnet wie jeder andere.
    locked: bool = False

    # --- Layout eines Containers (28.08.2026) -------------------------------
    # Bis hierher konnte ein Abschnitt genau eines: seine Spalten nebeneinander
    # stellen, mittig, mit festem Abstand. Alles, was ein Baukasten sonst
    # bietet — Richtung, Verteilung, Ausrichtung, Umbruch, Abstand — war nicht
    # einstellbar. In Framer ist das die Karte `Layout` und in Elementor der
    # Reiter `Layout`; sie sind der Grund, warum man Container überhaupt
    # verschachtelt.
    #
    # `None` heißt „nicht gesetzt": der Renderer behält dann sein bisheriges
    # Verhalten. Ein Standardwert hier würde jede bestehende Kundenseite
    # umbauen (Wurzel 1).
    #
    # Die Werte sind die des Renderers (Flexbox), nicht die von CSS im
    # Rohzustand: `zeile`/`spalte` statt `row`/`column`, damit die Oberfläche
    # nichts übersetzen muss und die gespeicherte Zeile lesbar bleibt.
    layout_richtung: Literal["zeile", "spalte"] | None = None
    layout_verteilen: (
        Literal["start", "mitte", "ende", "zwischen", "umgeben"] | None
    ) = None
    layout_ausrichten: (
        Literal["start", "mitte", "ende", "strecken"] | None
    ) = None
    layout_umbruch: bool | None = None
    #: Abstand zwischen den Kindern, in Pixeln. Obergrenze, weil ein
    #: unbegrenzter Wert eine Seite ins Nichts zieht (Wurzel 8).
    layout_abstand: int | None = Field(default=None, ge=0, le=160)
    # Framer „Layout › Grid" (Vollerfassung §4.5, 06.09.2026): Raster statt Stapel.
    layout_typ: Literal["stapel", "raster"] | None = None
    raster_spalten: int | None = Field(default=None, ge=1, le=12)
    raster_zeilen: int | None = Field(default=None, ge=1, le=12)
    raster_abstand_x: int | None = Field(default=None, ge=0, le=160)
    raster_abstand_y: int | None = Field(default=None, ge=0, le=160)
    # Framer „Columns/Rows Span" (Vollerfassung, Messung 06.09.2026): wie viele
    # Spalten bzw. Zeilen des RASTERS dieses Element belegt. Es steht am KIND,
    # nicht am Raster — deshalb hier und nicht bei `raster_spalten`. Das Panel
    # zeigt die beiden Zeilen nur, wenn der Elternteil wirklich ein Raster ist;
    # sonst wären es zwei Werte ohne Wirkung (Wurzel 4).
    raster_span_x: int | None = Field(default=None, ge=1, le=12)
    raster_span_y: int | None = Field(default=None, ge=1, le=12)

    # --- Größe eines Containers ---------------------------------------------
    #: Mindesthöhe in Pixeln — für Abschnitte, die eine Fläche halten sollen
    #: (Titelbild, Trenner), auch wenn wenig darin steht.
    min_hoehe: int | None = Field(default=None, ge=0, le=2000)
    #: Größte Breite der Inhaltsspur in Pixeln. Ohne Angabe gilt die Spur des
    #: Themes (`max-w-6xl`) — kein erfundener Ersatzwert (Wurzel 4).
    max_breite: int | None = Field(default=None, ge=320, le=2560)
    # --- Äußere und innere Abstände (Margin/Padding) ------------------------
    # `None` heißt „nicht gesetzt" und NICHT „0": ein 0 würde das eigene
    # `py-*` des Abschnitts überschreiben und jede bestehende Seite flach
    # ziehen. Nur ein wirklich gesetzter Wert wandert in den Stil.
    margin_top: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_right: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_bottom: str | None = Field(default=None, pattern=_ABSTAND_RE)
    margin_left: str | None = Field(default=None, pattern=_ABSTAND_RE)
    padding_top: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_right: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_bottom: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    padding_left: str | None = Field(default=None, pattern=_INNENABSTAND_RE)
    # Kettensymbol zwischen linkem und rechtem Wert: gekoppelt = wer links
    # tippt, ändert rechts mit. Der Zustand gehört zum Abschnitt und nicht in
    # den Browser-Speicher — sonst steht die Kette am zweiten Rechner offen und
    # der Kunde zieht seine Seite schief, ohne es zu merken.
    spacing_x_gekoppelt: bool = True

    # --- Framer-Inspektor (Etappe 2, 05.09.2026) ----------------------------
    # Die Abschnitte des Style-Inspektors als Unterobjekte, jedes optional und
    # jedes `extra="forbid"`. `None` heißt überall „nicht gesetzt" = das
    # Element verhält sich wie bisher; ein Unterobjekt ohne gesetzte Felder
    # ist dasselbe. Es gibt keine Standardwerte — ein fehlender Wert erbt vom
    # Elternteil bzw. Theme, er wird nicht mit „#000" oder „0" erfunden
    # (Wurzel 4).
    #
    # Gerendert wird das alles in `packages/baukasten-stil` (EINE Funktion für
    # Renderer und Editor); dieses Modell ist die Schreibprüfung dazu. Was hier
    # ein Feld ist, muss dort eine CSS-Zeile ergeben, sonst ist es eine
    # Attrappe.
    position: PositionDarstellung | None = None
    groesse: GroesseDarstellung | None = None
    stil: StilDarstellung | None = None
    transform: TransformDarstellung | None = None
    #: Framer „Text": Schrift am Element (je Gerät überschreibbar).
    text: TextDarstellung | None = None
    scroll: ScrollDarstellung | None = None
    a11y: A11yDarstellung | None = None
    #: Framer „Link": das Element als Ganzes verlinkt. Nicht je Gerät.
    link: LinkDarstellung | None = None
    #: Framer „Effects" — nicht je Gerät (Bewegung ist eine Eigenschaft des Elements).
    effekte: EffekteDarstellung | None = None
    #: Framer „Cursor › Web Cursor": der Mauszeiger über dem Element. Nicht je
    #: Gerät — Touch-Geräte haben keinen Zeiger.
    cursor: (
        Literal[
            "auto", "pointer", "grab", "text", "crosshair", "move",
            "zoom-in", "zoom-out", "not-allowed", "help", "wait",
        ]
        | None
    ) = None
    #: Framer „Cursor › Custom Cursor": ein Bild als Zeiger. Nicht je Gerät.
    cursor_bild: CursorBild | None = None
    #: Framer „Overlays": Popover/Modal am Element. Nicht je Gerät.
    overlay: OverlayDarstellung | None = None
    #: Framer „Code Overrides": eigene CSS-Eigenschaften. Nicht je Gerät.
    code: CodeDarstellung | None = None
    #: Überschreibungen je Gerät. Nur `tablet` und `mobil` — Desktop ist die
    #: Grundfassung. Ein `desktop`-Schlüssel wird abgewiesen, nicht ignoriert.
    je_geraet: dict[Literal["tablet", "mobil"], GeraeteUeberschreibung] | None = None

    # --- Teile eines Bausteins (06.09.2026) ---------------------------------
    # „jeder text und bild und alles ist eine einzelne Funktion, die individuell
    # einzeln gestaltbar ist durch das Style-Panel" (Auftrag 06.09.2026, nach
    # dem Vergleich mit Framer: dort ist jede Überschrift, jeder Absatz und
    # jedes Bild eine eigene Ebene mit eigenem Panel).
    #
    # Unser Baustein ist gröber — ein „Titelbild" trägt Eyebrow, Überschrift,
    # Text, Knopf und Bild in EINER Zeile. Seine Teile bekommen deshalb hier
    # ihre eigene Darstellung, unter dem Feldnamen aus dem `content`
    # (`heading`, `subheading`, `cta_label`, `image_url` …) — genau der
    # Schlüssel, den der Renderer ohnehin an die Stelle schreibt
    # (`editierbar(modus, feld)` → `data-feld`).
    #
    # Der Wert ist DIESELBE Struktur wie ein ganzer Block: ein Teil ist ein
    # Element wie jedes andere, mit Position, Größe, Stil, Transform, Text,
    # Link, Effekten und Geräte-Überschreibungen. Eine zweite, kleinere Form
    # dafür wäre die Stelle, an der beim nächsten Feld etwas fehlt (Wurzel 2).
    #
    # KEINE Migration: alles steht in derselben `settings`-Spalte.
    teile: dict[str, ContainerDarstellung] | None = None

    @field_validator("teile")
    @classmethod
    def _teile_pruefen(
        cls, wert: dict[str, ContainerDarstellung] | None
    ) -> dict[str, ContainerDarstellung] | None:
        if wert is None:
            return None
        # Obergrenze und Namensmuster (Wurzel 8): der Schlüssel wird zum
        # CSS-Selektor `[data-feld="…"]`, also darf er nur enthalten, was ein
        # Feldname im `content` auch hat.
        if len(wert) > 40:
            raise ValueError("Ein Baustein hat höchstens 40 gestaltete Teile.")
        for name, teil in wert.items():
            if not re.fullmatch(r"[a-z][a-z0-9_]{0,39}", name):
                raise ValueError(f"Unzulässiger Teilname: {name}")
            # Ein Teil hat KEINE eigenen Teile. Die Struktur ist dieselbe wie
            # bei einem Block (deshalb rechnet der Renderer mit denselben
            # Funktionen), die Verschachtelung endet aber nach einer Stufe —
            # sonst stünde in der Zeile ein Baum, den niemand mehr anzeigt und
            # der beim Rendern beliebig tief läuft (Wurzel 8).
            if teil.teile:
                raise ValueError(f"Der Teil „{name}“ darf keine eigenen Teile haben.")
        return wert
