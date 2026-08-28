"""Schemas der Mediathek: Bilder, Ordner, Verwendung, Stock-Fotos (0460/0461).

Eigenes Modul und nicht weitere 200 Zeilen in ``schemas.py``: die Datei stand
bei 1486 Zeilen und damit unmittelbar unter der Grenze, die ``pylint`` hier
setzt (1500). Der Schnitt ist aber auch der richtige — die Mediathek ist der
einzige Teil des Slice, der mit einem Storage-Bucket und mit fremden APIs
arbeitet, und ihre Formen haben mit Seiten, Blöcken und Domains nichts zu tun.

``schemas.py`` re-exportiert ``MediumResponse``/``MediumListResponse``, damit
die bestehenden Importe weiter gelten.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl

# === Bilder =================================================================

class MediumHerkunft(StrEnum):
    """Woher ein Bild stammt (Spalte ``site_media.source``, 0461/0479).

    ``shutterstock`` fehlt bewusst — der Anbieter ist nicht scharf geschaltet
    (siehe ``stock.py``). Ein Enum-Wert, den nichts erzeugen kann, wäre eine
    Attrappe."""

    upload = "upload"
    unsplash = "unsplash"
    pexels = "pexels"
    #: Symbole (0479). Wie Stock ein HOTLINK: ein SVG in unserem öffentlichen
    #: Bucket wäre Stored-XSS (Wurzel 8).
    iconify = "iconify"


class MediumArt(StrEnum):
    """Die fünf Reiter des Media Managers (Spalte ``site_media.kind``, 0479).

    Der Reiter IST dieser Filter, und die Zahl daneben zählt dieselbe Spalte —
    deshalb ein Enum und kein durchgereichter Spaltenwert (Wurzel 3)."""

    image = "image"
    icon = "icon"
    video = "video"
    audio = "audio"
    file = "file"


class MediumResponse(BaseModel):
    """Ein Bild im Bestand des Betriebs."""

    id: str
    url: str
    filename: str | None = None
    mime: str
    #: ``None`` bei Stock-Bildern: sie liegen als Hotlink beim Anbieter, es gibt
    #: also keine Datei, deren Größe wir kennen. Ein geschätzter Wert wäre eine
    #: Falschaussage (Wurzel 4).
    bytes: int | None = None
    created_at: str | None = None
    # --- 0460 ---------------------------------------------------------------
    folder_id: str | None = None
    alt_text: str | None = None
    width: int | None = None
    height: int | None = None
    # --- 0461 ---------------------------------------------------------------
    source: MediumHerkunft = MediumHerkunft.upload
    credit_name: str | None = None
    credit_url: str | None = None
    # --- 0479 ---------------------------------------------------------------
    #: Die Art. Kommt aus der Signaturprüfung des Uploads, NIE vom Client.
    kind: MediumArt = MediumArt.image


class MediumListResponse(BaseModel):
    items: list[MediumResponse]
    total: int


class MediumUpdate(BaseModel):
    """Was am Bild änderbar ist: Anzeigename, Ordner, Alt-Text.

    ``exclude_unset`` im Dienst entscheidet, was wirklich geschrieben wird —
    deshalb sind alle Felder optional und ``None`` ist ein GÜLTIGER Wert
    (Ordner leeren = zurück in die Wurzel)."""

    filename: str | None = Field(default=None, max_length=200)
    folder_id: str | None = None
    alt_text: str | None = Field(default=None, max_length=300)


class MediumBulkMove(BaseModel):
    """Mehrere Bilder auf einmal in einen Ordner schieben.

    Eigener Vorgang und nicht n Einzelaufrufe: die Mehrfachauswahl der
    Oberfläche würde sonst bei 50 Bildern 50 Rundreisen auslösen, von denen die
    30. scheitern kann — und dann liegen 29 verschoben und 21 nicht."""

    media_ids: list[str] = Field(min_length=1, max_length=200)
    folder_id: str | None = None


class MediumImportRequest(BaseModel):
    """Bild von einer fremden Adresse holen („Bilder importieren", 0479).

    Nur eine Adresse — kein MIME, keine Größe, kein Name als Pflichtangabe: was
    hinter der Adresse liegt, entscheidet der Server an den Bytes. Ein Client,
    der „image/png" behauptet, behauptet es umsonst (Wurzel 3/8)."""

    #: ``HttpUrl`` ist nur die FORM. Ob die Adresse abgerufen werden DARF,
    #: entscheidet ``core.ausgehende_url`` beim Abruf (interne Netze,
    #: Metadaten-Dienste, DNS-Rebinding) — eine Schemaprüfung kann das nicht.
    url: HttpUrl
    filename: str | None = Field(default=None, max_length=200)
    folder_id: str | None = None


class MediumBulkDelete(BaseModel):
    """Mehrere Medien auf einmal löschen (Mehrfachauswahl).

    Getrennt von ``MediumBulkMove``, obwohl die Form gleich aussieht: Verschieben
    ist umkehrbar, Löschen nicht. Zwei Formen halten die beiden Absichten in
    Router UND Client auseinander."""

    media_ids: list[str] = Field(min_length=1, max_length=200)


class MediumBulkDeleteResponse(BaseModel):
    deleted: int


class MediaUebersicht(BaseModel):
    """Die Zahlen der linken Spalte: wie viele Medien es je Art und Herkunft gibt.

    Kommt vom SERVER und wird nicht im Browser gezählt — geladen sind höchstens
    200 Zeilen, eine daraus gerechnete Zahl wäre die der sichtbaren und damit
    plausibel falsch (Wurzel 4)."""

    total: int
    #: Art → Anzahl. Alle fünf Arten sind immer enthalten, auch mit 0: ein
    #: fehlender Schlüssel wäre in der Oberfläche ein leerer Platz statt einer
    #: Null.
    je_art: dict[MediumArt, int]
    #: Art → hochgeladene (bei uns liegende) Medien dieser Art.
    #:
    #: JE ART und nicht als eine Gesamtzahl: die Oberfläche zeigt sie unter dem
    #: offenen Reiter („Hochgeladen 2" unter „Symbole dieser Website"). Eine
    #: artenübergreifende Zahl stand dort zwei Bilder gutschreibend neben einem
    #: leeren Symbolbestand — plausibel und falsch (Wurzel 4).
    hochgeladen_je_art: dict[MediumArt, int]
    #: Art → gekaufte Medien. Heute überall 0 (kein bezahlter Anbieter scharf) —
    #: gezählt statt hartkodiert, damit die Zahl nach einer Freischaltung von
    #: selbst stimmt.
    gekauft_je_art: dict[MediumArt, int]
    #: Bestandsgrenze je Betrieb, damit die Oberfläche „65 von 500" zeigen kann,
    #: ohne die Zahl zu kennen.
    grenze: int


# === Symbole (0479) =========================================================

class IconTreffer(BaseModel):
    """Ein Symbol aus der Bibliothek.

    ``satz`` und ``lizenz`` stehen SCHON in der Trefferliste, nicht erst nach
    der Übernahme: unter welcher Lizenz ein Symbol steht, gehört vor die
    Entscheidung, es zu benutzen."""

    #: Kennung in Iconify-Form (``satz:name``), z. B. ``ph:house``.
    icon: str
    #: Stabile SVG-Adresse. Sie wird gespeichert — Symbole werden NICHT
    #: rehostet (ein SVG im öffentlichen Bucket wäre Stored-XSS).
    svg_url: str
    satz: str
    lizenz: str | None = None


class IconSearchResponse(BaseModel):
    items: list[IconTreffer]
    total: int


class IconImportRequest(BaseModel):
    """Ein Symbol in die Mediathek übernehmen.

    NUR die Kennung. Adresse, Satzname und Lizenz holt der Server frisch bei
    der Bibliothek — käme der „Nachweis" aus dem Browser, wäre er ein Feld, in
    das der Client schreibt (Wurzel 3)."""

    icon: str = Field(min_length=3, max_length=120)
    folder_id: str | None = None


# === Ordner =================================================================

class MediaFolderResponse(BaseModel):
    id: str
    parent_id: str | None = None
    name: str
    #: Bilder DIREKT in diesem Ordner (nicht in Unterordnern) — die Zahl, die
    #: neben dem Ordnernamen steht.
    media_count: int = 0
    created_at: str | None = None


class MediaFolderListResponse(BaseModel):
    items: list[MediaFolderResponse]
    total: int
    #: Bilder in keinem Ordner. Kommt vom Server und wird nicht aus
    #: „Gesamt minus Summe" gerechnet — diese Rechnung wäre falsch, sobald
    #: zwischen zwei Abfragen etwas verschoben wird.
    root_media_count: int = 0


class MediaFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    parent_id: str | None = None


class MediaFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    parent_id: str | None = None


class MediaFolderVorschau(BaseModel):
    """Was ein Löschen anrichten würde — VOR dem Löschen (Wurzel 1)."""

    folder_id: str
    subfolder_count: int
    #: Bilder, die dabei in die Wurzel rutschen. Sie werden NICHT gelöscht.
    media_count: int


# === Verwendung und Ersetzen ================================================

class MediaUsage(BaseModel):
    """Eine Stelle, an der die Adresse eines Bildes steht."""

    #: ``block`` · ``page`` (SEO-/Titelbild) · ``branding`` (Logo, Favicon …) ·
    #: ``code`` (freies HTML/JS — wird gemeldet, aber nie automatisch geändert).
    kind: str
    page_id: str | None = None
    page_title: str | None = None
    block_id: str | None = None
    block_type: str | None = None
    field: str | None = None
    count: int = 1
    #: ``False`` = gefunden, aber bewusst nicht ersetzbar. Die Oberfläche muss
    #: das benennen, statt „fertig" zu melden, während irgendwo noch die alte
    #: Adresse steht.
    replaceable: bool = True


class MediaUsageResponse(BaseModel):
    medium_id: str
    items: list[MediaUsage]
    total: int


class MediaReplaceRequest(BaseModel):
    replacement_id: str


class MediaReplaceResponse(BaseModel):
    medium_id: str
    replacement_id: str
    replaced: int
    manual: int = 0
    items: list[MediaUsage] = Field(default_factory=list)


# === Bildnachweis im gerenderten Auftritt ===================================

class PublicBildnachweis(BaseModel):
    """Bildnachweis eines übernommenen Stock-Fotos (0461).

    Geht mit der ÖFFENTLICHEN Antwort des Domain-Resolvers hinaus — dort, wo das
    Foto ANGEZEIGT wird. Unsplashs Nutzungsbedingungen verlangen die Angabe bei
    jeder Anzeige; angezeigt wird es auf der veröffentlichten Kundenseite, nicht
    im Editor. Und geschlossen haben wir den Vertrag im Namen des Kunden.

    ``url`` ist der Schlüssel: der Renderer vergleicht sie mit dem ``src`` des
    Bildes, das er gerade ausgibt. Deshalb hängt der Nachweis am BILD und nicht
    am Block — dasselbe Foto kann in Hero, Galerie und Hintergrund stehen, und
    ein Nachweisfeld je Block-Typ wäre beim nächsten neuen Typ still nicht
    vorhanden. Über die Adresse ist JEDES Bildfeld abgedeckt, auch die, die es
    noch nicht gibt.

    Ein Geheimnis ist nichts davon: es sind Name und Profil-Adresse eines
    Fotografen, die ohnehin auf der Seite stehen sollen."""

    url: str
    photographer: str
    photographer_url: str
    provider: str
    provider_url: str


# === Stock-Fotos ============================================================

class StockAnbieter(StrEnum):
    pexels = "pexels"
    unsplash = "unsplash"
    #: Vorbereitet, NICHT scharf geschaltet (Abo + AGB-Erweiterung nötig, siehe
    #: ``stock.py``). Steht im Enum, damit die Entscheidung im Code sichtbar ist
    #: — die Anbieterliste an die Oberfläche enthält ihn nicht.
    shutterstock = "shutterstock"


class StockProviderInfo(BaseModel):
    id: StockAnbieter
    name: str
    #: ``True`` = die Oberfläche MUSS den Bildnachweis anzeigen (Unsplash).
    attribution_required: bool
    homepage: str
    #: ``True`` = kostenpflichtig. Trennt im Media Manager „KOSTENLOSE BILDER"
    #: von „PREMIUM-BILDER"; die Liste ist heute in der zweiten Gruppe leer.
    bezahlt: bool = False


class StockProviderListResponse(BaseModel):
    items: list[StockProviderInfo]


class StockFoto(BaseModel):
    """Ein Treffer, in unserer Form.

    ``thumb_url`` und ``full_url`` sind HOTLINKS auf den Anbieter — bewusst,
    nicht aus Bequemlichkeit: Unsplash verlangt es ausdrücklich, und für Pexels
    dieselbe Bauart zu nehmen ist besser als zwei Wege für denselben Vorgang."""

    provider: StockAnbieter
    external_id: str
    thumb_url: str
    full_url: str
    width: int | None = None
    height: int | None = None
    alt_text: str | None = None
    credit_name: str
    credit_url: str
    provider_name: str
    provider_url: str
    attribution_required: bool


class StockSearchResponse(BaseModel):
    provider: StockAnbieter
    items: list[StockFoto]
    page: int
    has_more: bool


class StockImportRequest(BaseModel):
    """Übernahme in die Mediathek.

    NUR Anbieter und Kennung. Alles andere holt der Server frisch beim Anbieter
    (Wurzel 3) — käme die Bildadresse aus der Anfrage, könnte jeder eine
    beliebige Adresse in die Website schreiben, und der „Bildnachweis" wäre ein
    Feld, in das der Angreifer schreibt."""

    provider: StockAnbieter
    external_id: str = Field(min_length=1, max_length=120)
    folder_id: str | None = None
