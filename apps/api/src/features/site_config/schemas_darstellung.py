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

from typing import Literal

from pydantic import BaseModel, Field

#: Ein Abstand mit Einheit. Negatives Vorzeichen nur außen (Margin).
_ABSTAND_RE = r"^-?\d{1,4}(px|%|vh|vw)$"
#: Innenabstand kennt kein Minus: negatives Padding gibt es in CSS nicht, ein
#: `-8px` würde stillschweigend verworfen und der Kunde suchte den Fehler bei
#: sich.
_INNENABSTAND_RE = r"^\d{1,4}(px|%|vh|vw)$"


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
