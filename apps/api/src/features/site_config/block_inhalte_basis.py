"""``content``-Schemas der BASIS-Abschnitte (0450).

Warum eine eigene Datei und nicht ``block_inhalte.py``: dort liegen die
Abschnitte, die es seit 0087 gibt, und die Datei lag vor diesem Zug schon bei
487 Zeilen. Die acht Typen hier bringen mit ihren Begründungen mehr als 400
Zeilen mit — zusammen wäre die 1500er-Grenze, die `pylint` in diesem Projekt
setzt, in Sichtweite und beim nächsten Abschnitt überschritten. Der Schnitt
verläuft entlang der GRUPPE des Baukastens („Basis"), weil das dieselbe
Einteilung ist, die der Kunde im Katalog sieht — nicht entlang einer
technischen Zufälligkeit.

``_CONTENT_MODEL`` bleibt bewusst in ``block_inhalte.py``: es ist die EINE
Tabelle Typ → Modell, und `scripts/i18n/blocktypen-pruefen.mjs` liest sie
genau dort. Zwei Registrierungsorte wären der Anfang einer zweiten Wahrheit.

Gemeinsam ist allen Typen hier: sie tragen nur Text, Links und Bilder — kein
fremdes Skript, keine Einbettung. Was der Kunde eintippt, geht über dieselbe
Allowlist wie überall im Slice (``_validate_href``, ``_sanitize_rich_html``),
und JEDE Liste hat einen Deckel (Wurzel 8 — kein unbegrenzter Bereich).
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_validator

from .basis import _sanitize_rich_html, _validate_href

# =========================================================================
# Grenzen. Hostaways Zahlen, wo Hostaway welche nennt.
# =========================================================================

#: Klapp-Einträge eines Accordions. Hostaway nennt keine Zahl; 30 ist dieselbe
#: Grenze wie beim FAQ-Abschnitt, und aus demselben Grund: mehr liest niemand.
MAX_ACCORDION_ITEMS = 30

#: Reiter eines Tabs-Abschnitts. Hostaway sagt ausdrücklich „so viele Sie
#: wollen, aber jeder neue Reiter macht die Beschriftungen schmaler" — genau
#: deshalb steht hier eine Zahl: ab etwa einem Dutzend ist die Leiste auf einem
#: Laptop unlesbar, und ein Baukasten, der den Kunden in diesen Zustand laufen
#: lässt, hat ihm nicht geholfen.
MAX_TABS = 12

#: Zeilen einer Tabelle. Hostaways Zahl.
MAX_TABELLEN_ZEILEN = 150

#: Spalten einer Tabelle. Hostaways Zahl.
MAX_TABELLEN_SPALTEN = 30

#: Zeichen je Tabellenzelle. Hostaway nennt keine Grenze — ohne eine wäre die
#: Zelle ein unbegrenzter Bereich, und 150 × 30 Zellen à beliebiger Länge sind
#: eine Inhaltsspalte, die keine Seite mehr rendert.
MAX_ZELLE_ZEICHEN = 500

#: Einträge einer Liste.
MAX_LISTEN_ITEMS = 30

#: Dateien eines Datei-Abschnitts. Bewusst klein: das ist ein Abschnitt zum
#: Herunterladen von ein paar Dokumenten (Hausordnung, Anfahrt, Preisliste),
#: kein Dateiverzeichnis.
MAX_DATEIEN = 10


# =========================================================================
# Accordion (Hostaway: „Accordion Widget")
# =========================================================================


class AccordionItem(BaseModel):
    """Ein Klapp-Eintrag: Titel und Inhalt, beide je Sprache.

    Der Inhalt ist Rich-Text und nicht reiner Text — anders als beim
    FAQ-Abschnitt. Der Unterschied hat einen Grund: die FAQ-Antwort geht
    ZUSÄTZLICH als `FAQPage`-JSON-LD an Google, und Googles Richtlinie verträgt
    dort kaum Auszeichnung. Ein Accordion ist reine Anzeige; hier darf der
    Betrieb fett schreiben und verlinken.
    """

    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)

    _v_text = field_validator("text")(_sanitize_rich_html)


class AccordionContent(BaseModel):
    """Aufklappbare Abschnitte (0450).

    Getrennt vom `faq`-Abschnitt, obwohl beide aufklappen. Der Unterschied ist
    nicht die Darstellung, sondern die BEDEUTUNG: `faq` erklärt Google, dass
    hier Fragen und Antworten stehen (JSON-LD, Rich Result). Ein Accordion mit
    „Unsere Häuser", „Anreise", „Hausordnung" ist keine Frage-Antwort-Liste,
    und es als solche auszuzeichnen wäre eine Falschaussage an die Suchmaschine
    — Google entfernt Rich Results dafür.

    Wer Fragen und Antworten hat, nimmt `faq`. Wer Text gliedern will, nimmt
    diesen Abschnitt. Ein Schalter „FAQ-Schema an" wie bei Hostaway würde die
    Entscheidung an eine Stelle legen, an der niemand sie versteht.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[AccordionItem] = Field(
        default_factory=list, max_length=MAX_ACCORDION_ITEMS
    )
    # Nur ein Eintrag gleichzeitig offen. Hostaways Default-Verhalten; im
    # Renderer über das `name`-Attribut von <details> (exklusives Accordion,
    # ohne eine Zeile JavaScript).
    single_open: bool = True
    # Ersten Eintrag offen zeigen. Aus, weil ein geschlossenes Accordion die
    # Übersicht ist, für die man es nimmt.
    first_open: bool = False


# =========================================================================
# Tabs (Hostaway: „Tabs Widget")
# =========================================================================


class TabItem(BaseModel):
    """Ein Reiter: Beschriftung, Überschrift, Text, Bild.

    `label` ist die Beschriftung IN der Reiterleiste, `title` die Überschrift
    im Inhalt darunter. Zwei Felder und nicht eines, weil sie verschiedene
    Längen vertragen: „Anreise" in der Leiste, „So finden Sie zu uns" im
    Inhalt. Bleibt `title` leer, zeigt der Renderer nur den Text — er wiederholt
    NICHT die Beschriftung (das wäre ein erfundener Titel, Wurzel 4).
    """

    label: dict[str, str] = Field(default_factory=dict)
    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)
    image_url: str | None = None

    _v_text = field_validator("text")(_sanitize_rich_html)
    _v_image_url = field_validator("image_url")(_validate_href)


class TabsContent(BaseModel):
    """Inhalte in Reitern (0450).

    Auf schmalen Geräten rendert der Renderer dieselben Daten als Accordion —
    Hostaway bietet das als Wahlmöglichkeit an, hier ist es fest. Grund: die
    Reiter-Variante auf dem Telefon verlangt Wischen, und Hostaway schreibt
    selbst dazu, dass „nicht alle mobilen Browser das unterstützen". Eine
    Einstellung, deren eine Hälfte auf einem Teil der Geräte nicht funktioniert,
    ist keine Wahl, sondern eine Falle.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[TabItem] = Field(default_factory=list, max_length=MAX_TABS)


# =========================================================================
# Countdown (Hostaway: „Countdown Widget")
# =========================================================================


class CountdownContent(BaseModel):
    """Countdown auf einen Zeitpunkt (0450).

    ``target`` ist ein ISO-8601-Zeitpunkt MIT Zeitzone. Ohne Zeitzone wäre die
    Angabe mehrdeutig — „31.12. um 23:59" ist in Kopenhagen eine andere Sekunde
    als in Lissabon, und der Countdown liefe für einen Teil der Gäste falsch.
    Hostaway löst das mit einem Zeitzonen-Feld neben dem Datum; hier steht die
    Zone IM Wert, damit es keine zwei Felder gibt, die auseinanderlaufen können.

    Gespeichert wird IMMER in UTC (der Validator rechnet um). Der Renderer
    rechnet im Browser des Gastes zurück — ein Countdown ist die eine Anzeige,
    die serverseitig nicht stimmen kann.
    """

    title: dict[str, str] = Field(default_factory=dict)
    target: str | None = None
    # Was nach Ablauf steht. Fehlt der Text, zeigt der Renderer nichts weiter —
    # er erfindet kein „Vorbei!" (Wurzel 4).
    expired_text: dict[str, str] = Field(default_factory=dict)
    # Nach Ablauf: Zähler auf 0 stehen lassen ("counter") oder nur die Meldung
    # zeigen ("message"). Hostaway hat genau diese zwei.
    on_expired: str = "message"

    @field_validator("target")
    @classmethod
    def _zeitpunkt(cls, v: str | None) -> str | None:
        """ISO-8601 mit Zeitzone, normalisiert auf UTC.

        Fail-closed: ein unlesbares Datum wird abgelehnt und nicht still auf
        „jetzt" oder „nie" gesetzt. Ein Countdown, der auf einen erfundenen
        Zeitpunkt läuft, ist schlimmer als gar keiner — er sieht richtig aus.
        """
        if v is None:
            return None
        roh = v.strip()
        if not roh:
            return None
        try:
            wert = datetime.fromisoformat(roh.replace("Z", "+00:00"))
        except ValueError as fehler:
            raise ValueError(
                "Zeitpunkt bitte als Datum mit Uhrzeit angeben."
            ) from fehler
        if wert.tzinfo is None:
            raise ValueError(
                "Dem Zeitpunkt fehlt die Zeitzone — ohne sie liefe der "
                "Countdown je nach Land unterschiedlich."
            )
        return wert.astimezone(UTC).isoformat()

    @field_validator("on_expired")
    @classmethod
    def _ablauf_modus(cls, v: str) -> str:
        if v not in ("counter", "message"):
            raise ValueError("Nach Ablauf: 'counter' oder 'message'.")
        return v


# =========================================================================
# Tabelle (Hostaway: „Table Widget", 150 × 30)
# =========================================================================


class TableColumn(BaseModel):
    """Eine Spaltenüberschrift, je Sprache."""

    title: dict[str, str] = Field(default_factory=dict)


class TableContent(BaseModel):
    """Tabelle aus Text (0450). Höchstens 150 Zeilen × 30 Spalten — Hostaways
    Zahlen, hier als harte Grenze im Schema (Wurzel 8).

    **Die Überschriften sind mehrsprachig, die Zellen sind es nicht.** Das ist
    die einzige bewusste Abweichung vom Muster des ganzen Baukastens, und sie
    hat einen Grund: eine Tabelle trägt DATEN (Preise, Uhrzeiten, Größen,
    Belegungszahlen), und Daten werden nicht übersetzt. Die Spaltenköpfe sind
    dagegen Beschriftungen wie „Preis" oder „Personen" und gehören übersetzt.

    Die Alternative wäre ein Gitter aus 4.500 Sprachkarten gewesen — im
    Formular unbedienbar und in der Datenbank ein Vielfaches der eigentlichen
    Daten. Wer eine Tabelle mit übersetzten Zellen braucht, legt je Sprache
    einen eigenen Abschnitt an und blendet ihn über die Sprachzuordnung der
    Seite ein; das ist umständlich, aber ehrlich — und es ist die Grenze, die
    hier ausdrücklich benannt und nicht mit einer halben Lösung verdeckt wird.

    Was Hostaway zusätzlich kann und wir nicht: Bilder und Knöpfe in Zellen
    (dort ausdrücklich ebenfalls ausgeschlossen — „a table can only include
    text and links") und der Anschluss an eine Datenquelle (Google Sheets,
    Airtable). Letzteres ist kein Website-Baukasten-Bestandteil, sondern eine
    Integration.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    header: list[TableColumn] = Field(
        default_factory=list, max_length=MAX_TABELLEN_SPALTEN
    )
    rows: list[list[str]] = Field(
        default_factory=list, max_length=MAX_TABELLEN_ZEILEN
    )
    # Erste Spalte hervorheben. Hostaway führt sie als eigenen Stil-Bereich
    # („The first column can be customized…"), weil sie fast immer die
    # Zeilenbeschriftung ist.
    highlight_first_column: bool = True

    @field_validator("rows")
    @classmethod
    def _zeilen(cls, v: list[list[str]]) -> list[list[str]]:
        """Jede Zeile auf Spaltenzahl und Zellenlänge prüfen.

        Kein Zurechtschneiden: eine zu lange Zeile wird abgelehnt, nicht
        gekürzt. Stillschweigend Spalten zu verlieren wäre Datenverlust, den
        niemand bemerkt, bis die Tabelle live steht (Wurzel 4/5).
        """
        for i, zeile in enumerate(v, start=1):
            if len(zeile) > MAX_TABELLEN_SPALTEN:
                raise ValueError(
                    f"Zeile {i} hat {len(zeile)} Spalten — erlaubt sind "
                    f"höchstens {MAX_TABELLEN_SPALTEN}."
                )
            for zelle in zeile:
                if len(zelle or "") > MAX_ZELLE_ZEICHEN:
                    raise ValueError(
                        f"Eine Zelle in Zeile {i} ist länger als "
                        f"{MAX_ZELLE_ZEICHEN} Zeichen."
                    )
        return v


# =========================================================================
# Liste (Hostaway: „List Widget")
# =========================================================================


class ListItem(BaseModel):
    """Ein Listenposten: Bild, Titel, Text, Link.

    Alles außer dem Titel ist optional, und das ist der Punkt des Abschnitts:
    dieselbe Liste trägt einmal nur Stichworte und einmal Bild + Absatz +
    Weiterlesen-Link, ohne dass es zwei Abschnittstypen braucht.
    """

    image_url: str | None = None
    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)
    link_href: str | None = None
    link_label: dict[str, str] = Field(default_factory=dict)

    _v_image_url = field_validator("image_url")(_validate_href)
    _v_link_href = field_validator("link_href")(_validate_href)


class ListContent(BaseModel):
    """Vorformatierte Liste (0450).

    Abgegrenzt von `features` (Merkmale): dort ist jeder Eintrag ein SYMBOL mit
    kurzem Text und steht in Spalten — „WLAN", „Parkplatz", „Haustiere
    willkommen". Hier hat jeder Eintrag ein Bild, längeren Text und einen
    eigenen Link. Beides in einen Abschnitt zu legen hieße, ein Symbol-Feld und
    ein Bild-Feld nebeneinander anzubieten, von denen immer eines wirkungslos
    ist.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[ListItem] = Field(
        default_factory=list, max_length=MAX_LISTEN_ITEMS
    )
    # "stacked" = untereinander mit Trennlinie, "grid" = Kacheln,
    # "numbered" = nummeriert (1., 2., 3. — für Anleitungen).
    layout: str = "stacked"

    @field_validator("layout")
    @classmethod
    def _layout(cls, v: str) -> str:
        if v not in ("stacked", "grid", "numbered"):
            raise ValueError("Layout: 'stacked', 'grid' oder 'numbered'.")
        return v


# =========================================================================
# Datei-Download (Hostaway: „File Widget")
# =========================================================================


class FileItem(BaseModel):
    """Eine herunterladbare Datei.

    `label` ist der sichtbare Text. Fehlt er, zeigt der Renderer den DATEINAMEN
    aus der Adresse — nicht die ganze Adresse und keinen erfundenen Text.
    """

    url: str
    label: dict[str, str] = Field(default_factory=dict)

    _v_url = field_validator("url")(_validate_href)


class FileContent(BaseModel):
    """Dateien zum Herunterladen (0450).

    Hostaway warnt an dieser Stelle ausdrücklich: „Any file uploaded to the
    system is publicly available. No personal and/or confidential information
    should be uploaded." Das gilt hier genauso — die Adressen zeigen in den
    öffentlichen Medien-Bucket und sind ohne Anmeldung erreichbar. Der Hinweis
    steht deshalb auch in der Oberfläche (`fileHinweis`), nicht nur hier.

    `noindex` ist kein Schutz und wird auch nicht als solcher angeboten: es
    sagt Suchmaschinen, die Datei nicht zu listen (`rel="nofollow"` am Link,
    zusätzlich `X-Robots-Tag` durch den Speicherdienst). Wer eine Datei
    wirklich schützen will, braucht den Passwortschutz der Seite (0442) —
    und selbst der schützt nur die Seite, nicht die Datei-Adresse.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[FileItem] = Field(
        default_factory=list, max_length=MAX_DATEIEN
    )
    noindex: bool = False


# =========================================================================
# Copyright (Hostaway: „Copyright Widget")
# =========================================================================


class CopyrightContent(BaseModel):
    """Copyright-Zeile mit mitlaufendem Jahr (0450).

    Das Jahr steht NICHT in den Daten, sondern kommt beim Rendern aus der Uhr.
    Das ist kein Verstoß gegen Wurzel 5b: dort geht es um den Zeitpunkt eines
    FREMDEN Ereignisses (wann hat der Gast gebucht?), den man nicht aus der
    eigenen Uhr ableiten darf. Das laufende Jahr einer Copyright-Zeile IST die
    Aussage „heute" — genau deshalb schreibt Hostaway dazu, es zeige den
    Besuchern, dass die Seite gepflegt wird.

    Ein Startjahr („© 2019–2026") gibt es bewusst nicht: es wäre ein zweites
    Feld, das genau einmal gesetzt wird, und die Angabe hat keine rechtliche
    Wirkung, die die Zeile nicht ohnehin hätte.
    """

    text: dict[str, str] = Field(default_factory=dict)
    # Jahr und © rechts vom Text statt links. Hostaways „Reverse icon/year
    # position", Default dort wie hier: links.
    reverse: bool = False


# =========================================================================
# Brotkrumen (Hostaway: „Breadcrumbs Widget")
# =========================================================================


class BreadcrumbsContent(BaseModel):
    """Pfad-Navigation (0450).

    Der Pfad kommt NICHT aus dem `content`, sondern aus der Seitenhierarchie —
    der Resolver liefert ihn als `page.trail` mit. Ihn hier eintippen zu lassen
    wäre eine zweite Wahrheit über die Seitenstruktur, die beim ersten
    Verschieben einer Seite falsch wird.

    Hostaway rät ausdrücklich davon ab, Brotkrumen auf flachen Websites
    einzusetzen („should not be used on sites with flat hierarchies"). Genau
    dafür ist `hide_without_parent` an: hat die Seite keine übergeordnete, zeigt
    der Abschnitt gar nichts, statt eine einstufige Krume („Start") zu rendern,
    die nichts aussagt.
    """

    show_home: bool = True
    show_current: bool = True
    hide_without_parent: bool = True
