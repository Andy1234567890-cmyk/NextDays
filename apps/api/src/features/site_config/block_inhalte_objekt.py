"""Inhalts-Schemas der Objekt-Bausteine (0468).

Die fünf Bausteine der dynamischen Objektseite. Ihr Kennzeichen: sie tragen
KAUM eigenen Inhalt. Was sie zeigen — Titel, Beschreibung, Fotos, Ausstattung,
Lage, Preis — kommt aus dem angezeigten Objekt. Einstellbar ist nur, WIE es
aussieht.

Das ist dieselbe Trennung, die Hostaway zieht:

    „Wenn Sie Beschreibungstexte, Objektnamen oder Ausstattung ändern möchten,
     nehmen Sie diese Änderungen direkt im Hostaway Dashboard vor. Der
     dynamische Baukasten dient nur der Bearbeitung von Stil und Layout."

Der Grund ist handfest: die Objektdaten gehen an sieben Portale gleichzeitig.
Gäbe es eine zweite, im Baukasten gepflegte Beschreibung, hätte ein Objekt zwei
Wahrheiten — und die auf der eigenen Website wäre die, die niemand nachpflegt.

Der BUCHUNGS-BLOCK ist die Ausnahme. Er steht auch außerhalb der Objektseite zur
Verfügung, und dann muss er wissen, WAS er bucht: ein Betrieb mit einem einzigen
Ferienhaus setzt ihn auf die Startseite.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# Wie viele Zeichen ein mehrsprachiges Textfeld je Sprache tragen darf. Derselbe
# Deckel wie bei den übrigen Blöcken — kein unbegrenzter Bereich (Wurzel 8).
MAX_TEXT = 400


class PropertyBookFormContent(BaseModel):
    """Der Buchungs-Block („Property book-form" bei Hostaway).

    Zeigt Datumsfeld und Gästezahl und führt zu zwei Wegen: eine ANFRAGE stellen
    oder BUCHEN. Beide Knöpfe sind einzeln abschaltbar, weil beide Betriebsarten
    real vorkommen — wer nur auf Anfrage vermietet, will den Buchen-Knopf nicht,
    und wer sofort bestätigt, will die Anfrage nicht erklären müssen.

    ``property_id`` ist der Unterschied zwischen „auf der Objektseite" und
    „irgendwo sonst":

    * Auf der dynamischen Objektseite bleibt es LEER. Gebucht wird das Objekt,
      das die Seite gerade zeigt — ein hier eingetragenes Objekt würde auf jeder
      der hundert erzeugten Seiten dasselbe buchen, und das ist nie gewollt.
    * Auf jeder anderen Seite MUSS es gesetzt sein, sonst weiß der Block nicht,
      was er bucht. Fehlt es dort, zeigt der Renderer den Leer-Zustand mit
      genau dieser Auskunft — statt einen Knopf anzubieten, der ins Nichts führt
      (Wurzel 4: kein erfundener Ersatzwert, lieber ehrlich leer).
    """

    #: Einleitungstext über den Feldern. Leer = der übersetzte Standardsatz des
    #: Renderers, nicht etwa gar kein Text.
    intro: dict[str, str] = Field(default_factory=dict)
    #: Beschriftung des Buchen-Knopfes. Leer = übersetzter Standard.
    book_label: dict[str, str] = Field(default_factory=dict)
    #: Beschriftung des Anfrage-Knopfes. Leer = übersetzter Standard.
    inquiry_label: dict[str, str] = Field(default_factory=dict)
    #: Buchen anbieten.
    show_book: bool = True
    #: Anfragen anbieten.
    show_inquiry: bool = True
    #: Preis je Nacht anzeigen, sobald Daten gewählt sind.
    show_price: bool = True
    #: Welches Objekt gebucht wird. Leer = das Objekt der aktuellen Seite.
    property_id: str | None = None

    @field_validator("intro", "book_label", "inquiry_label")
    @classmethod
    def _kurz(cls, v: dict[str, str]) -> dict[str, str]:
        for sprache, text in v.items():
            if len(text) > MAX_TEXT:
                raise ValueError(
                    f"Text in {sprache} ist länger als {MAX_TEXT} Zeichen."
                )
        return v

    @field_validator("property_id")
    @classmethod
    def _leer_ist_none(cls, v: str | None) -> str | None:
        # Ein Leerstring aus einem geleerten Formularfeld ist dasselbe wie
        # „nicht gesetzt" — er darf nicht als Objekt-ID in die DB.
        return (v or "").strip() or None


class PropertyGalleryContent(BaseModel):
    """Die Fotos des Objekts.

    Keine Bildliste: die Fotos kommen aus dem Objekt und werden dort gepflegt,
    samt Reihenfolge und Titelbild. Einstellbar ist nur die Darstellung.
    """

    #: Höchstzahl gezeigter Fotos. Kein unbegrenzter Bereich (Wurzel 8).
    max_images: int = Field(default=12, ge=1, le=50)
    #: Anordnung. `slider` = eine Reihe zum Wischen, `grid` = Kachelwand.
    layout: str = "grid"
    #: Klick öffnet das Foto groß.
    lightbox: bool = True

    @field_validator("layout")
    @classmethod
    def _layout(cls, v: str) -> str:
        if v not in ("grid", "slider"):
            raise ValueError("Anordnung muss grid oder slider sein.")
        return v


class PropertyDescriptionContent(BaseModel):
    """Die Beschreibung des Objekts.

    ``headline`` ist der einzige eigene Text — eine Überschrift wie „Über dieses
    Haus" gehört zur Seite, nicht zum Objekt. Der Fließtext selbst kommt aus dem
    Objekt.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    #: Ab wie vielen Zeichen ein „Mehr anzeigen" erscheint. 0 = nie kürzen.
    truncate_at: int = Field(default=0, ge=0, le=5000)

    @field_validator("headline")
    @classmethod
    def _kurz(cls, v: dict[str, str]) -> dict[str, str]:
        for sprache, text in v.items():
            if len(text) > MAX_TEXT:
                raise ValueError(
                    f"Überschrift in {sprache} ist länger als {MAX_TEXT} Zeichen."
                )
        return v


class PropertyAmenitiesContent(BaseModel):
    """Die Ausstattung des Objekts.

    Welche Merkmale ein Objekt hat, steht am Objekt. Hier wird entschieden, wie
    viele davon sofort sichtbar sind — eine Liste mit sechzig Häkchen schiebt
    alles Weitere aus dem Bild.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    #: Wie viele sofort zeigen; der Rest hinter „Alle anzeigen".
    visible_count: int = Field(default=10, ge=1, le=100)
    #: Spalten auf dem Computer. Auf dem Telefon immer eine.
    columns: int = Field(default=2, ge=1, le=4)

    @field_validator("headline")
    @classmethod
    def _kurz(cls, v: dict[str, str]) -> dict[str, str]:
        for sprache, text in v.items():
            if len(text) > MAX_TEXT:
                raise ValueError(
                    f"Überschrift in {sprache} ist länger als {MAX_TEXT} Zeichen."
                )
        return v


class PropertyMapContent(BaseModel):
    """Die Lage des Objekts.

    Die Koordinaten kommen aus dem Objekt. ``exact`` entscheidet über eine Frage,
    die kein Darstellungsdetail ist: Vor der Buchung zeigen die Portale
    üblicherweise nur einen ungefähren Bereich, damit die genaue Anschrift eines
    bewohnten Hauses nicht öffentlich steht. Deshalb ist der Standard der
    Umkreis, nicht die Nadel.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    #: Zoomstufe wie bei Google Maps.
    zoom: int = Field(default=13, ge=1, le=20)
    #: true = genaue Nadel, false = Umkreis.
    exact: bool = False
    #: Höhe der Karte in Pixeln.
    height: int = Field(default=360, ge=120, le=900)

    @field_validator("headline")
    @classmethod
    def _kurz(cls, v: dict[str, str]) -> dict[str, str]:
        for sprache, text in v.items():
            if len(text) > MAX_TEXT:
                raise ValueError(
                    f"Überschrift in {sprache} ist länger als {MAX_TEXT} Zeichen."
                )
        return v
