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

from pydantic import BaseModel, Field, field_validator, model_validator

from .basis import (
    BlockType,
    _sanitize_rich_html,
    _validate_href,
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

    Neun, und die Auswahl ist begrenzt aus einem Grund: jede Art ist eine
    Eingabe, die der Gast versteht und der Betrieb auswerten kann. Hostaway
    bietet dreizehn, darunter `time`, `file` und `free_text` — die Datei-Anlage
    hieße Uploads von Fremden im öffentlichen Bucket (Wurzel 8), und ein
    Zeitfeld ohne Datum ist auf einer Unterkunfts-Website fast immer der falsche
    Typ (gemeint ist die Anreise, und das ist ein Datum).
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

    * **Kein Webhook, kein Google Sheets.** Hostaway hat beides. Es sind
      ausgehende Aufrufe auf eine kundengelieferte Adresse — also der Vektor aus
      Wurzel 8 (SSRF, DNS-Rebinding), und für eine Anfrage-Strecke bringt es
      nichts, was eine E-Mail nicht kann.
    * **Kein mehrstufiges Formular.** Für eine Unterkunfts-Website ist das
      Anfrageformular der Fall, und den deckt ein einstufiges ab.
    * **Kein eigenes reCAPTCHA-Feld.** Der Schutz sitzt am ABSENDE-Endpunkt
      (Ratelimit + reCAPTCHA Enterprise wie auf der Kontaktseite), nicht im
      Inhalt des Blocks. Ein Schalter „Spamschutz aus" wäre eine Einladung.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    intro: dict[str, str] = Field(default_factory=dict)
    submit_label: dict[str, str] = Field(default_factory=dict)
    # Bestätigung nach dem Absenden. Fehlt sie, zeigt der Renderer seinen
    # eigenen, neutralen Satz — kein erfundener Betriebston (Wurzel 4).
    success_text: dict[str, str] = Field(default_factory=dict)
    recipient: str | None = None
    # Interner Name für die Antwortenliste. Nicht gast-sichtbar.
    form_name: str | None = Field(default=None, max_length=80)
    fields: list[FormField] = Field(default_factory=list, max_length=20)

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


class PostsContent(BaseModel):
    """Die letzten Blog-Beiträge auf einer Seite (0438).

    Der Blog selbst liegt unter ``/blog`` — dieser Abschnitt bringt ihn auf die
    Startseite. Deshalb ein Deckel und kein Filter: wer nach Schlagwort filtern
    will, verlinkt ``/blog?tag=…``; ein zweiter Filtermechanismus hier wäre eine
    zweite Wahrheit über dieselbe Liste."""

    headline: dict[str, str] = Field(default_factory=dict)
    # Drei bis neun. Weniger ist keine Liste, mehr gehört auf die Blog-Seite.
    limit: int = Field(default=3, ge=1, le=9)


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
}


def validate_block_content(block_type: BlockType, content: dict) -> dict:
    """Validiert das content-dict gegen das Schema des Block-Typs und gibt das
    normalisierte dict zurück. Wirft ValueError bei ungültigem Inhalt."""
    model = _CONTENT_MODEL[block_type]
    return model.model_validate(content or {}).model_dump(mode="json")
