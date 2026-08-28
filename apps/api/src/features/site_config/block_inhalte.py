"""Die getypten ``content``-Schemas je Abschnittstyp.

Ausgelagert aus ``schemas.py``, weil das mit den Abschnitten von 0431/0432/0436
über die Zeilengrenze gelaufen ist, die `pylint` hier setzt (1500). Der Schnitt
ist der natürliche: hier steht, WELCHE FELDER ein Abschnitt hat, dort steht
alles andere des Slice (Branding, Domains, Seiten, SEO, Weiterleitungen).

Kein freies ``Any`` — jeder Typ hat sein Modell, und ``validate_block_content``
ist die eine Stelle, die ein eingehendes ``content`` dagegen prüft. Ein Feld,
das hier nicht steht, kommt nicht in die Datenbank.

``schemas.py`` re-exportiert alles, damit die bestehenden Importe gelten.
"""

from __future__ import annotations

from enum import StrEnum
from typing import cast

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .basis import (
    BlockType,
    _sanitize_rich_html,
    _validate_href,
)
from .block_inhalte_basis import (
    AccordionContent,
    BreadcrumbsContent,
    CopyrightContent,
    CountdownContent,
    FileContent,
    ListContent,
    TableContent,
    TabsContent,
)
from .block_inhalte_buchung import (
    CheckoutFormContent,
    CheckoutResultContent,
    CheckoutSummaryContent,
    PostListContent,
)
from .block_inhalte_business import (
    BusinessHoursContent,
    ClickToCallContent,
    ClickToEmailContent,
    MultiLocationContent,
)
from .block_inhalte_medien import (
    AudioContent,
    BeforeAfterContent,
    MediaSliderContent,
    ShapeContent,
    VideoContent,
)
from .block_inhalte_objekt import (
    PropertyAmenitiesContent,
    PropertyBookFormContent,
    PropertyDescriptionContent,
    PropertyGalleryContent,
    PropertyMapContent,
)
from .block_inhalte_social import (
    FacebookFeedContent,
    HtmlWidgetContent,
    RssFeedContent,
    ShareButtonContent,
    SocialIconsContent,
    WhatsappChatContent,
)


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
    """Ein Bild der Galerie.

    `title`/`description` kamen mit 0451 dazu (Hostaway zeigt beide unter, auf
    oder beim Überfahren des Bildes). `href` macht das Bild zu einem Link —
    und schaltet damit die Lightbox aus: ein Bild kann nicht gleichzeitig
    vergrößern und woandershin führen. Hostaway löst denselben Konflikt mit
    demselben Vorrang („This disables the lightbox feature")."""

    url: str
    alt: dict[str, str] = Field(default_factory=dict)
    title: dict[str, str] = Field(default_factory=dict)
    description: dict[str, str] = Field(default_factory=dict)
    href: str | None = None

    _v_url = field_validator("url")(_validate_href)
    _v_href = field_validator("href")(_validate_href)


class GalleryContent(BaseModel):
    """Bildergalerie (0087), mit Lightbox und Beschriftungen erweitert (0451).

    ERWEITERT und nicht durch einen zweiten Galerie-Typ ersetzt: die Daten
    stehen auf Kundenseiten, und zwei fast gleiche Abschnitte im Katalog wären
    eine Frage, die niemand beantworten kann. Alle neuen Felder haben Defaults,
    die das bisherige Aussehen unverändert lassen (Wurzel 1) — außer der
    Lightbox, und die ist eine reine Ergänzung: ohne Klick passiert wie bisher
    nichts.

    Was Hostaway hier zusätzlich hat und wir NICHT: den **Instagram-Zulauf**
    (bis 100 Bilder aus einem Professional-Konto). Der bräuchte eine
    Meta-Anmeldung mit App-Review, ein Token je Betrieb und dessen Erneuerung —
    Hostaways eigene Doku besteht zur Hälfte aus der Fehlersuche dafür („any
    connections made before December 2024 will need to be reconnected"). Es
    gibt im Repo keinen fertigen Weg dorthin; ein halb gebauter wäre ein
    Anmeldeknopf, der nichts tut.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    # Ohne Deckel wäre die Galerie ein unbegrenzter Bereich (Wurzel 8). 100 ist
    # Hostaways Zahl für den Instagram-Zulauf und bereits mehr, als eine Seite
    # sinnvoll lädt.
    images: list[GalleryImage] = Field(default_factory=list, max_length=100)
    # Spalten auf dem Desktop. Der Default ist 3 — dasselbe Raster wie bisher
    # (`md:grid-cols-3`), damit bestehende Galerien gleich aussehen.
    columns: int = Field(default=3, ge=2, le=5)
    # Klick vergrößert das Bild. An, weil eine Galerie ohne Vergrößerung eine
    # Reihe Briefmarken ist.
    lightbox: bool = True
    # Bilder als Links statt Lightbox. Aus; siehe `GalleryImage.href`.
    enable_links: bool = False
    # Titel und Beschreibung unter dem Bild zeigen. Aus, damit bestehende
    # Galerien unverändert bleiben — die Felder sind dort leer, aber ein
    # eingeschalteter Textbereich hinterließe trotzdem Luft unter jedem Bild
    # (genau das beschreibt Hostaway: „space will remain in the widget").
    show_captions: bool = False


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


class FaqItem(BaseModel):
    """Eine Frage mit ihrer Antwort, je Sprache.

    Die Antwort ist REINER TEXT und kein Rich-Text. Grund: derselbe Inhalt geht
    zweimal raus — sichtbar auf der Seite UND als `FAQPage`-JSON-LD an Google.
    Googles Richtlinie erlaubt im Antwortfeld nur eine kleine Menge Auszeichnung
    und keine Verweise auf andere Inhalte; HTML dorthin zu schreiben würde das
    Rich Result verlieren. Ein Feld, das an einer Stelle formatiert und an der
    anderen entstellt erscheint, ist schlechter als eines ohne Formatierung."""

    question: dict[str, str] = Field(default_factory=dict)
    answer: dict[str, str] = Field(default_factory=dict)


class FaqContent(BaseModel):
    """Frage-Antwort-Abschnitt (0431).

    ``limit`` gibt es hier NICHT: anders als beim Bewertungs-Block sind die
    Einträge keine Auswahl aus vielen, sondern genau die, die der Betrieb
    eingetippt hat. Eine Anzeigegrenze wäre die Zusage, Text zu verbergen, den
    jemand geschrieben hat. Stattdessen begrenzt `max_length` die LISTE selbst —
    30 Fragen sind mehr, als jede Unterkunfts-Website braucht, und ohne Deckel
    wäre das Feld ein unbegrenzter Bereich (Wurzel 8)."""

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[FaqItem] = Field(default_factory=list, max_length=30)


class MapContent(BaseModel):
    """Karten-Abschnitt (0432).

    Die Karte wird über die ADRESSE angezeigt, nicht über Koordinaten: der
    Betrieb kennt seine Anschrift, nicht seinen Breitengrad. Der Renderer baut
    daraus die Google-Maps-Einbettung.

    `address` leer = die Anschrift aus dem FIRMENPROFIL. Das ist der Normalfall
    und der Grund, warum das Feld optional ist — wer seine Betriebsadresse
    zeigt, soll sie nicht abtippen (dieselbe Begründung wie beim
    Kontakt-Abschnitt). Ein Objekt-Standort wird dagegen eingetippt, weil ein
    Objekt eine andere Adresse haben kann als der Betrieb.

    KEIN Feld für den API-Schlüssel: der ist Betriebs-Konfiguration
    (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), nicht Kundeninhalt."""

    headline: dict[str, str] = Field(default_factory=dict)
    address: str | None = Field(default=None, max_length=300)
    # Zoomstufe wie Google sie versteht (1 = Welt, 20 = Gebäude). Grenzen, weil
    # ein Wert darüber eine leere Karte ergibt.
    zoom: int = Field(default=14, ge=1, le=20)
    # Höhe in Pixeln. Deckel, damit ein Abschnitt nicht die ganze Seite füllt.
    height: int = Field(default=400, ge=200, le=800)


class TestimonialItem(BaseModel):
    """Eine Gästestimme. `quote` ist Pflicht in der Wirkung (leere Zitate lässt
    der Renderer weg), `author` und `location` sind es nicht: „ein Gast aus
    Hamburg" ohne Namen ist eine gültige, ehrliche Angabe."""

    quote: dict[str, str] = Field(default_factory=dict)
    author: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    # Bewusst KEIN Sterne-Feld. Eine eingetippte Sternebewertung wäre eine
    # Behauptung ohne Grundlage — genau das, was der `reviews`-Abschnitt aus
    # echten Daten liefert. Wer Sterne zeigen will, nimmt jenen Abschnitt.


class TestimonialsContent(BaseModel):
    """Frei eingetippte Gästestimmen (0432).

    Getrennt von `reviews` (echte, verifizierte Bewertungen): dort ist jede
    Zahl belegt, hier ist jedes Wort eine Behauptung des Betriebs. Beides in
    einen Abschnitt zu legen hieße, dem Gast die Unterscheidung zu nehmen."""

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[TestimonialItem] = Field(default_factory=list, max_length=20)


class FeatureItem(BaseModel):
    """Ein Merkmal: Symbol + Überschrift + Text.

    `icon` ist ein Schlüssel aus der Symbol-Auswahl der Oberfläche, kein freier
    String und keine URL — ein beliebiger Wert würde entweder nichts anzeigen
    oder (bei einer URL) zum Tracking-Pixel auf der Gästeseite. Der Renderer
    zeigt nichts an, wenn der Schlüssel unbekannt ist."""

    icon: str | None = Field(default=None, max_length=60)
    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)


class FeaturesContent(BaseModel):
    """„Was wir bieten" (0432) — Merkmale in Spalten."""

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[FeatureItem] = Field(default_factory=list, max_length=12)
    # Spalten auf dem Desktop. Zwei bis vier: bei fünf sind die Texte auf einem
    # Laptop unlesbar schmal, bei einer wäre es eine Liste (dafür gibt es
    # Rich-Text).
    columns: int = Field(default=3, ge=2, le=4)


class FormFieldType(StrEnum):
    """Feldarten eines Formulars (0436).

    Zehn, und die Auswahl ist begrenzt aus einem Grund: jede Art ist eine
    Eingabe, die der Gast versteht und der Betrieb auswerten kann.

    Was Hostaway zusaetzlich hat und wir weiterhin nicht: `time` (ein Zeitfeld
    ohne Datum ist auf einer Unterkunfts-Website fast immer der falsche Typ —
    gemeint ist die Anreise, und das ist ein Datum) und `free_text` (ein
    Hinweistext ist kein Eingabefeld; dafuer gibt es den Text-Abschnitt).
    """

    text = "text"
    textarea = "textarea"
    email = "email"
    phone = "phone"
    number = "number"
    date = "date"
    select = "select"
    checkbox = "checkbox"
    # Die Zustimmung zur Datenverarbeitung. Eigene Art und nicht `checkbox`,
    # weil sie IMMER Pflicht ist und der Renderer sie anders darstellt (mit
    # Link auf die Datenschutzerklärung).
    consent = "consent"
    # Datei-Anlage (0444). Eine Datei je Feld, höchstens 10 MB, Verfall nach
    # 90 Tagen — dieselben Grenzen wie bei Hostaway.
    #
    # Bis 0443 fehlte sie hier mit der Begründung, Uploads von Fremden im
    # öffentlichen Bucket wären Wurzel 8. Die Begründung stimmt, die
    # Schlussfolgerung war falsch: die Antwort ist ein PRIVATER Bucket mit
    # signierten URLs, nicht der Verzicht auf die Funktion. Ein Eigentümer, der
    # seinen Grundriss schicken will, konnte es sonst nicht.
    file = "file"


#: Hoechstzahl der Seiten eines mehrstufigen Formulars (0445).
#:
#: Zehn, und die Grenze ist keine Vorsicht, sondern Wurzel 8: ohne sie waere die
#: Seitenliste ein unbegrenzter Bereich. Sie ist ausserdem grosszuegig — mit 20
#: Feldern (dem Deckel darunter) braeuchte man zehn Seiten mit je zwei Feldern,
#: und laenger als das haelt kein Gast ein Anfrageformular durch.
MAX_FORM_SEITEN = 10

#: Ab so vielen Seiten zeigt der Renderer einen Zurueck-Knopf — dieselbe Regel
#: wie bei Hostaway. Sie steht HIER und nicht nur im Renderer, weil sie sonst
#: eine Zahl waere, die in einer TSX-Datei steht und die niemand wiederfindet.
#: Bei zwei Seiten ist der Weg zurueck der Browser-Zurueck-Knopf; ab drei ist er
#: das nicht mehr, weil dazwischen kein Seitenwechsel liegt.
ZURUECK_AB_SEITEN = 3


class FormSeite(BaseModel):
    """Eine Seite eines mehrstufigen Formulars (0445).

    Nur ein Titel: die Felder wissen selbst, auf welcher Seite sie stehen
    (``FormField.seite``). Eine Seite ohne Titel ist erlaubt — der Renderer
    zeigt dann nur den Fortschritt („Schritt 2 von 3") und erfindet keine
    Ueberschrift (Wurzel 4).
    """

    titel: dict[str, str] = Field(default_factory=dict)


class FormField(BaseModel):
    """Ein Formularfeld.

    ``name`` ist der Schlüssel, unter dem die Antwort gespeichert wird — er muss
    innerhalb eines Formulars eindeutig sein (der Validator unten prüft das) und
    darf sich nicht ändern: bestehende Einsendungen liegen unter dem alten
    Namen, und eine Umbenennung würde sie unlesbar machen.
    """

    name: str = Field(min_length=1, max_length=60)
    type: FormFieldType = FormFieldType.text
    label: dict[str, str] = Field(default_factory=dict)
    placeholder: dict[str, str] = Field(default_factory=dict)
    required: bool = False
    # Nur bei `select`: die Auswahlmöglichkeiten. Mehrsprachig, weil der Gast sie
    # liest; der gespeicherte Wert ist der Text in der Sprache, in der er
    # gewählt hat.
    options: list[dict[str, str]] = Field(default_factory=list, max_length=30)
    # Auf welcher Seite des Formulars das Feld steht (1-basiert, 0445).
    #
    # Am FELD und nicht als Feldliste je Seite: der Feldname ist der Schlüssel,
    # unter dem eine Antwort gespeichert ist, und eine zweite Liste, die
    # dieselben Namen noch einmal führt, wäre eine zweite Wahrheit — wer ein
    # Feld löscht und den Eintrag in der Seitenliste vergisst, bekommt eine
    # Seite, die auf ein Feld zeigt, das es nicht mehr gibt.
    #
    # Der Deckel ist derselbe wie bei `FormContent.seiten`; der Validator dort
    # prüft zusätzlich, dass die Seite wirklich existiert.
    seite: int = Field(default=1, ge=1, le=MAX_FORM_SEITEN)

    @field_validator("name")
    @classmethod
    def _feldname(cls, v: str) -> str:
        """Nur a-z, 0-9 und Unterstrich.

        Der Name landet als jsonb-Schlüssel in der Datenbank und als Spalte im
        CSV-Export. Ein Leerzeichen oder Komma darin macht die CSV-Datei
        unlesbar, ein Punkt bricht jede jsonb-Pfadabfrage."""
        wert = v.strip().lower().replace(" ", "_")
        if not all(c.isalnum() or c == "_" for c in wert):
            raise ValueError(
                "Feldname darf nur Buchstaben, Zahlen und _ enthalten."
            )
        return wert


class FormContent(BaseModel):
    """Formular-Abschnitt (0436).

    ``recipient`` leer = die E-Mail aus dem Firmenprofil. Derselbe Grundsatz wie
    beim Kontakt-Abschnitt: wer seine Adresse im Konto pflegt, soll sie nicht
    abtippen.

    Was hier NICHT steht und warum:

    * **Kein Google Sheets, kein Slack.** Hostaway hat beides als eigene
      Anbindung. Beide sind über `webhook_url` erreichbar, und jede eigene
      Anbindung wäre ein zweiter Anmelde-Fluss, ein zweites Token und ein
      zweiter Ort, an dem etwas abläuft.
    * **Kein eigenes reCAPTCHA-Feld.** Der Schutz sitzt am ABSENDE-Endpunkt
      (Ratelimit + reCAPTCHA Enterprise wie auf der Kontaktseite), nicht im
      Inhalt des Blocks. Ein Schalter „Spamschutz aus" wäre eine Einladung —
      und Hostaway hat ihn ausdrücklich auch nicht.
    * **Keine eigenen Screens für Erfolg/Fehler.** Hostaway lässt beide als
      eigene Seiten aus Blöcken bauen. Bei uns bleibt der Formular-Abschnitt an
      Ort und Stelle stehen und wechselt seinen Zustand (Wurzel 4: die
      Meldung ist IMMER Text des Betriebs oder ein neutraler Rückfall, nie ein
      dritter Block-Baum, der mit dem Formular auseinanderlaufen könnte).
      Gestaltbar sind beide Zustände trotzdem: `success_text` für den Erfolg,
      `error_text` als Rückfall für einen Fehlschlag OHNE eigene Meldung des
      Servers (eine konkrete Server-Meldung — z. B. „Bitte stimmen Sie der
      Datenverarbeitung zu" — hat immer Vorrang, sie erklärt dem Gast, was zu
      tun ist; `error_text` greift nur bei einem Netz- oder Server-Fehler ohne
      eigene Erklärung).
    """

    headline: dict[str, str] = Field(default_factory=dict)
    intro: dict[str, str] = Field(default_factory=dict)
    submit_label: dict[str, str] = Field(default_factory=dict)
    # Bestätigung nach dem Absenden. Fehlt sie, zeigt der Renderer seinen
    # eigenen, neutralen Satz — kein erfundener Betriebston (Wurzel 4).
    success_text: dict[str, str] = Field(default_factory=dict)
    # Rückfalltext bei einem Fehlschlag ohne eigene Server-Meldung (Netzfehler,
    # 500). Fehlt er, zeigt der Renderer seinen eigenen, neutralen Satz —
    # derselbe Grundsatz wie bei `success_text`.
    error_text: dict[str, str] = Field(default_factory=dict)
    recipient: str | None = None
    # Interner Name für die Antwortenliste. Nicht gast-sichtbar.
    form_name: str | None = Field(default=None, max_length=80)
    fields: list[FormField] = Field(default_factory=list, max_length=20)

    # --- Mehrseitiges Formular (0445) ---------------------------------------
    # LEER heißt einseitig, und das ist der Normalfall. Eine Liste mit einem
    # Eintrag wäre dasselbe in umständlich; leer ist die ehrlichere Aussage
    # („dieses Formular hat keine Seiten, es hat Felder").
    seiten: list[FormSeite] = Field(
        default_factory=list, max_length=MAX_FORM_SEITEN
    )

    # --- Nach dem Absenden (0444) -------------------------------------------
    # Eine Bestätigung an den ABSENDER. Standardmäßig an, wie bei Hostaway: ein
    # Gast, der abschickt und nichts hört, schickt noch einmal — oder ruft an.
    bestaetigung: bool = True
    bestaetigung_text: dict[str, str] = Field(default_factory=dict)
    # Weiterleitung statt Danke-Meldung. Ist sie gesetzt, entfällt die Meldung:
    # zwei Bestätigungen hintereinander sind eine zu viel.
    weiterleitung: str | None = Field(default=None, max_length=2000)
    # Ein POST je Einsendung an eine Adresse des Kunden. Der Versand läuft über
    # `core.ausgehende_url` (IP prüfen und pinnen, interne Netze blocken) —
    # eine nutzergelieferte URL ist ein SSRF-Vektor (Wurzel 8).
    webhook_url: str | None = Field(default=None, max_length=2000)

    # Nur http(s) oder relativ. Ohne diese Allowlist stünde `javascript:` in
    # einer Weiterleitung, die nach dem Absenden ausgeführt wird.
    _v_weiterleitung = field_validator("weiterleitung")(_validate_href)
    _v_webhook = field_validator("webhook_url")(_validate_href)

    @field_validator("recipient")
    @classmethod
    def _empfaenger(cls, v: str | None) -> str | None:
        if v is None:
            return None
        wert = v.strip()
        if not wert:
            return None
        # Eine Adresse, keine Liste: mehrere Empfänger sind eine Verteilerliste,
        # und die gehört in den Mailserver, nicht in einen Website-Abschnitt.
        if "@" not in wert or " " in wert or "," in wert:
            raise ValueError("Bitte eine einzelne E-Mail-Adresse angeben.")
        return wert

    @model_validator(mode="after")
    def _felder_eindeutig(self) -> FormContent:
        """Zwei Felder mit demselben Namen würden sich in der gespeicherten
        Antwort überschreiben — die zweite Eingabe gewinnt, die erste ist weg,
        und niemand sieht es."""
        namen = [f.name for f in self.fields]
        if len(namen) != len(set(namen)):
            raise ValueError("Zwei Felder haben denselben Namen.")
        return self

    @model_validator(mode="after")
    def _seiten_stimmen(self) -> FormContent:
        """Jedes Feld muss auf einer Seite stehen, die es WIRKLICH gibt.

        Sonst wäre das Feld unerreichbar: der Renderer zeigt Seite 1 bis n, und
        ein Feld auf Seite 4 eines dreiseitigen Formulars sähe niemand — aber
        `required` würde es serverseitig weiterhin verlangen. Das Formular wäre
        damit nicht absendbar, und niemand könnte sehen warum.

        Kein stilles Zurechtrücken auf die letzte Seite (Wurzel 4): das wäre
        eine erfundene Zuordnung, die der Betrieb nie gewählt hat.
        """
        anzahl = len(self.seiten) or 1
        verwaist = [f.name for f in self.fields if f.seite > anzahl]
        if verwaist:
            raise ValueError(
                "Diese Felder stehen auf einer Seite, die es nicht gibt: "
                + ", ".join(verwaist)
            )
        return self


def schlagwortliste(roh: str) -> list[str]:
    """Kommaliste → geprüfte Schlagwörter. EINE Stelle für die Aufteilung.

    Der Deckel (acht Stück, 60 Zeichen) ist derselbe wie am Beitrag selbst: mehr
    Schlagwörter kann ein Beitrag gar nicht tragen, ein neuntes im Filter wäre
    also ein Filter auf etwas, das es nicht gibt."""
    sauber: list[str] = []
    for teil in (roh or "").split(","):
        wert = teil.strip()[:60]
        if wert and wert not in sauber:
            sauber.append(wert)
    return sauber[:8]


def kontakt_formular_felder() -> list[FormField]:
    """Die Felder des Kontaktformulars (`contact.show_form`).

    FEST und serverseitig, nicht im Block-Inhalt: der Kontakt-Abschnitt hat
    keinen Feld-Baukasten (dafür gibt es den Formular-Abschnitt) — er hat einen
    Schalter. Ein Schalter kann keine Feldliste mitbringen, also muss sie hier
    stehen, und zwar an EINER Stelle: der Absende-Endpunkt prüft die Eingaben
    gegen genau diese Liste (`formulare.einsendung_pruefen`), und der Renderer
    zeichnet genau diese Felder. Zwei Kopien liefen beim ersten neuen Feld
    auseinander.

    Warum es diese Funktion überhaupt gibt: bis 27.08.2026 war der Schalter
    „Kontaktformular anzeigen" eine Attrappe. Er stand im Katalog, im
    Pydantic-Schema und in drei Vorlagen auf `True` — und der Renderer kannte
    das Feld nicht, es gab nirgends ein Formular (Prüfbericht B4). Ein
    Bedienelement ohne Deckung ist Wurzel 4.

    Die Zustimmung ist dabei kein optionales Extra: ohne sie darf die
    Einsendung nicht gespeichert werden, und `einsendung_pruefen` erzwingt das
    für `consent`-Felder ohnehin ein zweites Mal.
    """
    return [
        FormField(
            name="name",
            type=FormFieldType.text,
            required=True,
            label={},
        ),
        FormField(
            name="email",
            type=FormFieldType.email,
            required=True,
            label={},
        ),
        FormField(
            name="message",
            type=FormFieldType.textarea,
            required=True,
            label={},
        ),
        FormField(
            name="consent",
            type=FormFieldType.consent,
            required=True,
            label={},
        ),
    ]


class PostsContent(BaseModel):
    """Die Beitragsliste auf einer Seite (0438, ausgebaut 0457).

    Bei Hostaway stehen „Alle Beiträge" und „Neueste Beiträge" getrennt im
    Katalog und sind nach dem Einfügen DASSELBE Widget. Bei uns ist es ein Typ
    mit Einstellungen — der Unterschied zwischen den beiden ist genau eine Zahl
    (`limit`) und ein Schalter (`navigation`). Zwei Katalogeinträge, die
    dasselbe erzeugen, sind eine Erklärung, die der Kunde beim ersten Klick
    wieder vergisst.

    Alle Standardwerte sind so gewählt, dass eine BESTEHENDE Kundenseite
    unverändert aussieht (Wurzel 1): drei Beiträge, Bilder an, Autor und Datum
    an, keine Blättern-Steuerung."""

    headline: dict[str, str] = Field(default_factory=dict)
    # Wie viele Beiträge GLEICHZEITIG sichtbar sind. Bis neun: mehr auf einmal
    # ist keine Übersicht mehr — wer mehr zeigen will, schaltet `navigation` an.
    limit: int = Field(default=3, ge=1, le=9)
    # Nur Beiträge mit EINEM dieser Schlagwörter (ODER). Leer = alle.
    #
    # Ein durch Komma getrennter STRING und keine Liste, und das ist eine
    # bewusste Abweichung von Hostaway (dort eine Mehrfachauswahl): der
    # Inspektor des Baukastens kennt genau die Feldarten aus
    # `web/components/website/abschnitte.ts`, und eine Mehrfachauswahl ist keine
    # davon. Eine Liste in einem Textfeld käme beim nächsten Öffnen als LEERES
    # Feld zurück und würde den Filter still löschen — schlimmer als das
    # Komma. Die Aufteilung passiert an genau einer Stelle (`schlagwortliste`).
    tags: str = Field(default="", max_length=500)
    # „Weiterlesen"-Text. Leer heißt NICHT „aus" — dafür gibt es den Schalter
    # daneben. Ohne diese Trennung wäre ein versehentlich geleertes Feld
    # dasselbe wie eine bewusste Entscheidung, und der Kunde sähe den
    # Unterschied nicht.
    read_more: dict[str, str] = Field(default_factory=dict)
    show_read_more: bool = False
    show_blog_name: bool = False
    show_author_date: bool = True
    show_thumbnails: bool = True
    # Titel einzeilig abschneiden. Aus: der Titel darf umbrechen.
    single_line_title: bool = False
    # Beiträge je Zeile — nur Desktop/Tablet. Auf dem Telefon steht immer einer
    # je Zeile: zwei Karten nebeneinander sind auf 375 px keine Karten mehr.
    per_row: int = Field(default=3, ge=1, le=4)
    # Zeilen des Anrisstextes. 0 = keinen Anriss zeigen.
    teaser_lines: int = Field(default=3, ge=0, le=8)
    gap: str = "md"  # "sm" | "md" | "lg"
    # WIE die Beiträge angeordnet sind — die eigentliche Layout-Frage.
    #
    # Bis hierher gab es genau eine Anordnung (Bild oben, Text darunter, im
    # Raster) und dreizehn Regler daran. Damit war „Layouts" im Blog-CMS eine
    # Seite ohne Inhalt: sie konnte auf die Übersichtsseite verlinken, aber
    # nichts einstellen, weil das Einstellbare keine Anordnung war.
    #
    # Die vier Arten sind aus dem Marktstandard abgeleitet (Squarespace 7.1
    # führt fünf: Basic Grid · Masonry · Single Column · Side by Side ·
    # Alternating Side by Side; recherchiert 27.08.2026). Übernommen sind die
    # vier, die unser Renderer wirklich zeichnet:
    #
    #   grid        Raster, Bildseitenverhältnis fest (3:2) — der bisherige
    #               Zustand und deshalb der Standard (Wurzel 1: eine bestehende
    #               Kundenseite darf sich nicht ändern).
    #   masonry     Raster, Bild UNBESCHNITTEN — Mosaik statt gleicher Kacheln.
    #   list        Eine Spalte, Bild über dem Titel, volle Breite.
    #   side        Eine Spalte, Bild NEBEN dem Titel.
    #
    # `masonry` fehlt bewusst NICHT: CSS-Spalten können das ohne JavaScript.
    # Was fehlt, ist Squarespaces „Alternating Side by Side" — abwechselnd
    # links/rechts. Das ist eine fünfte Anordnung ohne eigene Aussage, und
    # jede Art, die hier steht, muss der Renderer auch zeichnen.
    #
    # `per_row` gilt nur für `grid` und `masonry`, wie bei Squarespace: eine
    # einspaltige Liste hat keine Spaltenzahl. Der Wert bleibt gespeichert, er
    # wirkt nur nicht — wer die Art zurückstellt, findet seine Spalten wieder.
    layout: str = "grid"  # "grid" | "masonry" | "list" | "side"
    # Wie der Gast weiterkommt: ein Knopf („Mehr anzeigen"), Seitenzahlen, oder
    # gar nicht. `none` ist der Standard, weil er dem bisherigen Verhalten
    # entspricht.
    navigation: str = "none"  # "none" | "button" | "pages"

    @field_validator("tags")
    @classmethod
    def _schlagwoerter(cls, v: str) -> str:
        """Normalisiert die Kommaliste: getrimmt, ohne Leere, ohne Doppelte,
        höchstens acht (mehr kann ein Beitrag nicht tragen, 0438)."""
        return ", ".join(schlagwortliste(v))

    @field_validator("gap")
    @classmethod
    def _abstand(cls, v: str) -> str:
        if v not in ("sm", "md", "lg"):
            raise ValueError("Abstand muss sm, md oder lg sein.")
        return v

    @field_validator("layout")
    @classmethod
    def _layout(cls, v: str) -> str:
        if v not in ("grid", "masonry", "list", "side"):
            raise ValueError(
                "Layout muss grid, masonry, list oder side sein."
            )
        return v

    @field_validator("navigation")
    @classmethod
    def _navigation(cls, v: str) -> str:
        if v not in ("none", "button", "pages"):
            raise ValueError("Navigation muss none, button oder pages sein.")
        return v


class SearchPostsContent(BaseModel):
    """Die Beitragssuche (0458).

    Nur ein Platzhaltertext — mehr ist an einem Suchfeld nicht einzustellen, und
    Hostaway bietet an seinem auch nichts anderes an.

    Die Suche geht an ``/blog?q=…`` und filtert dort die Liste. Sie zeigt die
    Treffer NICHT an Ort und Stelle: eine Ergebnisliste mitten auf der
    Startseite müsste die Seite umbauen, während der Gast tippt — und der Blog
    hat für Ergebnisse bereits eine Adresse, die man verschicken kann."""

    placeholder: dict[str, str] = Field(default_factory=dict)


class ContainerContent(BaseModel):
    """Ein Container (Abschnitt, Spalte, innere Spalte) — OHNE Inhalt (0472).

    Ein Container trägt keine Felder: was ihn ausmacht, steht in eigenen SPALTEN
    von ``site_blocks`` (``kind``, ``parent_id``, ``span``), nicht im
    ``content``-JSON. Das Modell ist deshalb leer, und das ist kein Versehen.

    Warum es trotzdem existiert: ``validate_block_content`` schlägt
    ``_CONTENT_MODEL[block_type]`` nach. Fehlte ``container`` dort, wäre ein
    gespeicherter Container ein ``KeyError`` — also ein 500 aus
    angreiferkontrolliertem Input, genau das, was Wurzel 5 verbietet. Vorher
    fiel es nur nicht auf, weil der Editor Container nie mitschickte.
    """

    model_config = ConfigDict(extra="forbid")


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
    BlockType.faq: FaqContent,
    BlockType.map: MapContent,
    BlockType.testimonials: TestimonialsContent,
    BlockType.features: FeaturesContent,
    BlockType.form: FormContent,
    BlockType.posts: PostsContent,
    BlockType.search_posts: SearchPostsContent,
    # --- Basis-Widgets (0450) -----------------------------------------------
    # Die Modelle liegen in `block_inhalte_basis.py`; die ZUORDNUNG bleibt hier,
    # weil sie die eine Tabelle Typ → Modell ist (und `blocktypen-pruefen.mjs`
    # genau hier nachsieht).
    BlockType.accordion: AccordionContent,
    BlockType.tabs: TabsContent,
    BlockType.countdown: CountdownContent,
    BlockType.table: TableContent,
    BlockType.list: ListContent,
    BlockType.file: FileContent,
    BlockType.copyright: CopyrightContent,
    BlockType.breadcrumbs: BreadcrumbsContent,
    # --- Medien-Widgets (0451) ----------------------------------------------
    BlockType.media_slider: MediaSliderContent,
    BlockType.video: VideoContent,
    BlockType.audio: AudioContent,
    BlockType.before_after: BeforeAfterContent,
    BlockType.shape: ShapeContent,
    # --- Business-Widgets (0452) --------------------------------------------
    BlockType.business_hours: BusinessHoursContent,
    BlockType.click_to_call: ClickToCallContent,
    BlockType.click_to_email: ClickToEmailContent,
    BlockType.multi_location: MultiLocationContent,
    # --- Objektseite (0468) -------------------------------------------------
    # Die Modelle liegen in `block_inhalte_objekt.py`; die ZUORDNUNG bleibt hier,
    # weil sie die eine Tabelle Typ → Modell ist.
    BlockType.property_book_form: PropertyBookFormContent,
    BlockType.property_gallery: PropertyGalleryContent,
    BlockType.property_description: PropertyDescriptionContent,
    BlockType.property_amenities: PropertyAmenitiesContent,
    BlockType.property_map: PropertyMapContent,
    # --- Social-/Sonstiges-Widgets (0471) ------------------------------------
    BlockType.social_icons: SocialIconsContent,
    BlockType.share_button: ShareButtonContent,
    BlockType.whatsapp_chat: WhatsappChatContent,
    BlockType.rss_feed: RssFeedContent,
    BlockType.facebook_feed: FacebookFeedContent,
    BlockType.html_widget: HtmlWidgetContent,
    # --- Struktur (0472) ------------------------------------------------------
    BlockType.container: ContainerContent,
    # --- Buchungsstrecke (0474) -----------------------------------------------
    # Die Modelle liegen in `block_inhalte_buchung.py`; die ZUORDNUNG bleibt
    # hier, weil sie die eine Tabelle Typ → Modell ist.
    BlockType.checkout_form: CheckoutFormContent,
    BlockType.checkout_summary: CheckoutSummaryContent,
    BlockType.checkout_result: CheckoutResultContent,
    BlockType.post_list: PostListContent,
}


def _zeilenumbrueche_entschaerfen(wert: object) -> object:
    """Literales ``\\n`` (Backslash + n) zu einem echten Zeilenumbruch.

    Der Gast bekommt sonst die zwei ZEICHEN zu sehen. Live am 27.08.2026: die
    Anschrift im Kontakt-Abschnitt stand auf der Kundenseite als
    „Hirtshalsvej 21\\n9881 Bindslev" — der Renderer setzt für dieses Feld
    ausdrücklich ``whitespace-pre-line``, und der Erzeuger im Backend verbindet
    mit einem echten Umbruch (``konto_daten``, ``"\\n".join``). Nur der
    gespeicherte Wert trug die Escape-Sequenz (Prüfbericht B5).

    Wo sie entsteht, ist offen — der Wert kam nicht aus dem Erzeuger, nicht aus
    den Vorlagen und nicht aus dem KI-Pfad, alle drei sind nachgeprüft. Deshalb
    sitzt die Behandlung HIER: an der EINEN Stelle, durch die jeder
    Schreibpfad geht (``validate_block_content``). Ein Fehler, dessen Quelle
    man nicht kennt, wird an der Grenze abgefangen, nicht an der Anzeigestelle
    kosmetisch überdeckt.

    Warum umschreiben und nicht ablehnen (Wurzel 4 sagt: klar fehlschlagen):
    weil hier kein Wert FEHLT und keiner erfunden wird. Es ist dieselbe
    Aussage in falscher Kodierung, und ein 422 träfe den Kunden für etwas, das
    er nicht getippt hat. Ein literales ``\\n`` ist in einem Anzeigetext nie
    gewollt.
    """
    if isinstance(wert, str):
        return wert.replace("\\n", "\n") if "\\n" in wert else wert
    if isinstance(wert, dict):
        return {k: _zeilenumbrueche_entschaerfen(v) for k, v in wert.items()}
    if isinstance(wert, list):
        return [_zeilenumbrueche_entschaerfen(v) for v in wert]
    return wert


def validate_block_content(block_type: BlockType, content: dict) -> dict:
    """Validiert das content-dict gegen das Schema des Block-Typs und gibt das
    normalisierte dict zurück. Wirft ValueError bei ungültigem Inhalt."""
    model = _CONTENT_MODEL[block_type]
    geprueft = model.model_validate(content or {}).model_dump(mode="json")
    # NACH der Schema-Prüfung: der Umbruch ändert keine Struktur, und vorher
    # zu greifen hieße, am unvalidierten Client-Wert zu arbeiten.
    return cast(dict, _zeilenumbrueche_entschaerfen(geprueft))
