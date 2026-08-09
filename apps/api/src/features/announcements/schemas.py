"""Pydantic-Schemas des announcements-Slice.

Der Kern dieser Datei ist die Säuberung von `inhalt_html`. Der Inhalt wird von
einem Backoffice-Redakteur per TipTap erfasst und anschließend im Dashboard
JEDES Betriebs gerendert — eine einzige unsaubere Ankündigung erreicht damit
alle Kunden gleichzeitig. Gesäubert wird deshalb beim SPEICHERN (Wurzel 8) und
in POST **und** PATCH: läge der Validator nur am POST, wäre PATCH das Loch,
durch das rohes HTML einläuft.
"""
from __future__ import annotations

import re
from datetime import UTC, date, datetime, time
from enum import StrEnum

import nh3
from pydantic import BaseModel, Field, field_validator

from src.core.supabase import public_storage_url

# Bucket der Screenshots (0338). Auch vom Service für Upload/Aufräumen genutzt.
BILD_BUCKET = "announcement-images"

# Ein reines Datum ohne Uhrzeit, wie es `<input type="date">` liefert.
_NUR_DATUM = re.compile(r"\d{4}-\d{2}-\d{2}")

# Eigene Allowlist statt Import aus site_config: die Slice-Grenze ist Absicht.
# DIVERGENZ-HINWEIS: site_config._RICH_TEXT_TAGS ist fast identisch, kennt aber
# KEIN `img` — dort darf ein Betrieb schreiben, hier nur das Plattform-Team.
# Wer eine der beiden Listen ändert, hat damit NICHT die andere geändert; das
# ist gewollt, denn die Angreifermodelle unterscheiden sich.
_ANKUENDIGUNG_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "a", "span", "img",
}
# `rel` NICHT hier — nh3 setzt es selbst via link_rel (sonst ValueError).
_ANKUENDIGUNG_ATTRS = {
    "a": {"href", "title", "target"},
    "span": {"style"},
    "img": {"src", "alt", "width", "height"},
}

def _eigene_bild_basis() -> str:
    """Präfix, mit dem jede legitime Bild-URL beginnen MUSS.

    `public_storage_url` baut die von außen erreichbare Adresse (nicht die
    interne Kong-Adresse) — dieselbe Basis, die der Upload-Endpunkt zurückgibt.
    Inklusive Host: ein Vergleich nur gegen den Bucket-Namen ließe sich mit
    `https://boese.example/…/announcement-images/x.png` umgehen.
    """
    return public_storage_url(BILD_BUCKET, "")


def _bild_attribut_pruefen(tag: str, attr: str, value: str) -> str | None:
    """nh3-`attribute_filter` — hier liegt die eigentliche Bild-Entscheidung.

    WARUM eine src-Prüfung nötig ist, obwohl nh3 `url_schemes` kennt:
    `https://` ist ein völlig gültiges Schema. `<img src="https://angreifer/
    ?c=1">` überlebt den Sanitizer und würde beim Rendern IP, User-Agent und
    Zeitpunkt JEDES Betrachters an einen fremden Server melden — eine
    Ankündigung sehen ALLE Kunden, das wäre eine plattformweite
    Besucher-Erfassung durch Dritte. `None` heißt: Attribut verwerfen.

    WARUM die Entscheidung hier und nicht per Regex auf der nh3-Ausgabe fällt:
    der Callback bekommt den bereits geparsten, decodierten Wert und ist von
    jeder Schreibweise unabhängig (CLAUDE.md: „HTML NIE per Regex säubern").

    Der zweite Zweig entschärft die übrigen img-Attribute: nh3 gibt einen
    Attributwert, der ein `>` enthält, UNESCAPED aus (`<img src="…" alt="a>b">`).
    Ohne dieses Entfernen könnte ein `alt` die Tag-Grenze verschieben und dem
    nachgelagerten Aufräumen (`_leere_bilder_entfernen`) eine falsche Grenze
    vorspiegeln — live reproduziert. `>` ist in einem Alternativtext ohnehin
    bedeutungslos.
    """
    if tag != "img":
        return value
    if attr == "src":
        return value if value.startswith(_eigene_bild_basis()) else None
    return value.replace(">", "")


# Greift NUR auf der bereits gesäuberten nh3-Ausgabe und NUR auf `<img>`-Tags,
# deren Attributwerte durch `_bild_attribut_pruefen` garantiert kein `>` mehr
# enthalten. Die Tag-Grenze ist damit eindeutig. Dies ist KEIN Sanitizer,
# sondern das Aufräumen einer bekannten, normalisierten Form: entfernt werden
# ausschließlich Bilder, denen der Callback die Quelle bereits entzogen hat.
_IMG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_SRC_RE = re.compile(r'\bsrc="([^"]*)"', re.IGNORECASE)


def _leere_bilder_entfernen(html: str) -> str:
    """`<img>` ohne gültige Quelle ganz wegnehmen.

    Nach dem Callback ist jedes verbliebene `src` garantiert unseres; ein Bild
    OHNE `src` ist der Rest eines verworfenen Fremdbildes (oder eines
    `data:`-URI, den nh3 über `url_schemes` entfernt hat). Stehen bliebe sonst
    ein kaputtes Bild-Symbol mitten im Text.
    """
    def _ersetzen(treffer: re.Match[str]) -> str:
        tag = treffer.group(0)
        src = _SRC_RE.search(tag)
        if src is None or not src.group(1).startswith(_eigene_bild_basis()):
            return ""
        return tag

    return _IMG_RE.sub(_ersetzen, html)


def sanitize_inhalt(value: str | None) -> str:
    """TipTap-HTML serverseitig mit echtem Allowlist-Parser säubern.

    1. nh3 (ammonia, Rust) parst echtes HTML statt Regex → `<script>`,
       `onerror=`, `javascript:`-hrefs und `data:`-URIs fallen weg; der
       `attribute_filter` entzieht jeder fremden Bild-Quelle ihr `src`.
    2. Aufräumen der dabei entstandenen quellenlosen `<img>`.

    Entfernt wird immer nur das Bild, NIE der ganze Request: ein per
    Copy-Paste eingefügtes Fremdbild darf nicht die komplette Ankündigung des
    Redakteurs kippen. Der Resttext bleibt stehen, das fehlende Bild sieht der
    Redakteur in der Vorschau (die den gespeicherten Stand zeigt).
    """
    sauber = nh3.clean(
        value or "",
        tags=_ANKUENDIGUNG_TAGS,
        attributes=_ANKUENDIGUNG_ATTRS,
        attribute_filter=_bild_attribut_pruefen,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer nofollow",
    )
    return _leere_bilder_entfernen(sauber) if "<img" in sauber else sauber


def normalisiere_gueltig_bis(value: str | None) -> str | None:
    """„Popup nur bis" auf das ENDE des genannten Tages legen.

    Das Backoffice-Formular ist ein `<input type="date">` und schickt deshalb
    ein reines Datum (`2026-08-09`). Postgres castet das zu MITTERNACHT — und
    Mitternacht ist der ANFANG des Tages, nicht sein Ende. Die Folge war ein
    Feld, das das Gegenteil seiner Beschriftung tat: „gültig bis heute"
    bedeutete „seit heute früh abgelaufen", das Popup war nie zu sehen. Genau
    so verschwand die erste echte Ankündigung (gueltig_bis = 2026-08-09
    00:00:00+00, gesetzt am selben Tag um 09:52 — bereits ~10 Stunden tot).

    Ein reines Datum wird deshalb auf `23:59:59.999999+00` desselben Tages
    gehoben: der gewählte Tag zählt vollständig mit, wie die Beschriftung
    („begrenzt das Popup tageweise") es zusagt.

    Ein Wert MIT Uhrzeit bleibt unangetastet — wer eine Uhrzeit angibt, meint
    sie auch. Unlesbares wird abgelehnt (422) statt still auf einen
    Ersatzwert zu fallen (Wurzel 4/5): ein stumm verworfenes Ablaufdatum
    hieße, das Popup läuft unbegrenzt.
    """
    if value is None:
        return None
    roh = value.strip()
    if not roh:
        # Leerstring = bewusstes Leeren des Feldes → „unbegrenzt".
        return None
    if _NUR_DATUM.fullmatch(roh):
        try:
            tag = date.fromisoformat(roh)
        except ValueError as exc:
            raise ValueError(f"Kein gültiges Datum: {roh!r}") from exc
        return datetime.combine(
            tag, time(23, 59, 59, 999999), tzinfo=UTC
        ).isoformat()
    try:
        gelesen = datetime.fromisoformat(roh.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Kein gültiger Zeitpunkt: {roh!r}") from exc
    # Naiv angegebene Uhrzeit als UTC deuten — sonst vergleicht der Service
    # später aware gegen naive und wirft TypeError.
    if gelesen.tzinfo is None:
        gelesen = gelesen.replace(tzinfo=UTC)
    return gelesen.isoformat()


class AnnouncementStatus(StrEnum):
    """Lebenszyklus einer Ankündigung (Spiegel des CHECK in 0337)."""

    entwurf = "entwurf"
    veroeffentlicht = "veroeffentlicht"
    archiviert = "archiviert"


class AnnouncementKategorie(StrEnum):
    """Redaktionelle Einordnung; steuert im Frontend nur die Pille."""

    neuerung = "neuerung"
    wartung = "wartung"
    hinweis = "hinweis"
    wichtig = "wichtig"


class Announcement(BaseModel):
    """Eine Ankündigung, wie sie Dashboard UND Backoffice sehen.

    Bewusst OHNE `erstellt_von`: wer sie verfasst hat, ist eine Team-Interna
    und geht den Kunden nichts an (Wurzel 9 — keine Recon-Daten an Rollen, die
    sie nicht brauchen). Das Backoffice braucht die Angabe bislang nicht.
    """

    id: str
    titel: str
    inhalt_html: str = ""
    kurztext: str | None = None
    status: AnnouncementStatus
    kategorie: AnnouncementKategorie
    veroeffentlicht_am: str | None = None
    gueltig_bis: str | None = None
    als_popup: bool = True
    created_at: str | None = None
    updated_at: str | None = None
    # Hat DIESER Nutzer die Ankündigung bereits quittiert? Die Liste kennt die
    # Antwort ohnehin (sie braucht sie für `ungelesen`); sie wegzuwerfen zwang
    # das Dashboard, den „neu"-Punkt an jeder Zeile zu zeigen. Der Wert ist
    # nutzerbezogen, nicht mandantenbezogen — zwei Kollegen sehen hier
    # unterschiedliche Werte auf derselben Ankündigung.
    quittiert: bool = False


class AnnouncementList(BaseModel):
    """Historie fürs Dashboard. `ungelesen` zählt die noch nicht quittierten
    Ankündigungen — dieselbe Zahl, die das Badge in der Navigation zeigt."""

    items: list[Announcement] = Field(default_factory=list)
    total: int = 0
    ungelesen: int = 0


class PopupResponse(BaseModel):
    """Die EINE Ankündigung, die jetzt unterbrechen darf — oder keine.

    `offen` ist die Zahl der danach noch wartenden. Das Frontend braucht sie
    für „1 von 3", ohne die Liste selbst puffern zu müssen: die Reihenfolge
    bleibt damit Server-Sache (nach jedem Quittieren wird erneut gefragt).
    """

    item: Announcement | None = None
    offen: int = 0


class QuittierenResponse(BaseModel):
    """`neu=False` heißt: diese Quittierung lag bereits vor (Retry/Doppelklick).

    Der Aufrufer erfährt damit die Wahrheit, ohne dass ein zweiter Aufruf ein
    Fehler wäre — Idempotenz, nicht Fehlerunterdrückung (Wurzel 2).
    """

    ok: bool = True
    neu: bool = True


class AnnouncementCreate(BaseModel):
    """Backoffice: neuen Entwurf anlegen.

    Status ist NICHT setzbar — Veröffentlichen ist ein eigener Endpunkt mit
    eigener Bestätigung. Anlegen und Ausspielen an alle Kunden dürfen nicht
    derselbe Knopf sein.
    """

    titel: str = Field(min_length=1, max_length=200)
    inhalt_html: str = ""
    kurztext: str | None = Field(default=None, max_length=500)
    kategorie: AnnouncementKategorie = AnnouncementKategorie.neuerung
    als_popup: bool = True
    gueltig_bis: str | None = None

    _v_inhalt = field_validator("inhalt_html")(sanitize_inhalt)
    # Reines Datum → Tagesende. Ohne das begrenzt „gültig bis heute" das Popup
    # auf einen bereits vergangenen Moment (Mitternacht).
    _v_gueltig_bis = field_validator("gueltig_bis")(normalisiere_gueltig_bis)


class AnnouncementUpdate(BaseModel):
    """Backoffice: Teil-Update. Nur gesetzte Felder werden geschrieben.

    `inhalt_html` trägt denselben Validator wie beim Anlegen — ohne ihn wäre
    dieser Endpunkt der Weg, rohes HTML an der Säuberung vorbeizuschmuggeln.
    """

    titel: str | None = Field(default=None, min_length=1, max_length=200)
    inhalt_html: str | None = None
    kurztext: str | None = Field(default=None, max_length=500)
    kategorie: AnnouncementKategorie | None = None
    als_popup: bool | None = None
    gueltig_bis: str | None = None

    # Derselbe Validator wie beim Anlegen — läge er nur am POST, käme über
    # PATCH wieder ein Mitternachts-Wert herein (dieselbe Begründung wie bei
    # `inhalt_html`).
    _v_gueltig_bis = field_validator("gueltig_bis")(normalisiere_gueltig_bis)

    @field_validator("inhalt_html")
    @classmethod
    def _v_inhalt(cls, v: str | None) -> str | None:
        # None = Feld nicht mitgeschickt → unverändert lassen. Ein leerer String
        # ist dagegen eine bewusste Leerung und wird gesäubert durchgereicht.
        return None if v is None else sanitize_inhalt(v)


class BildResponse(BaseModel):
    """Antwort des Upload-Endpunkts: die URL, die der Editor ins <img> setzt."""

    url: str


# === Übersetzungen (0347) ===================================================
class AnnouncementUebersetzung(BaseModel):
    """Eine Fassung in EINER Sprache.

    `geprueft` ist das tragende Feld: true heißt, ein Mensch hat sie im
    Backoffice bearbeitet und verantwortet sie — kein automatischer Lauf fasst
    sie danach noch an (0347).

    `veraltet` steht bewusst NICHT in der DB, sondern wird beim Lesen aus dem
    Vergleich `quelle_hash != aktueller Hash des Originals` errechnet. Als
    gespeicherte Spalte wäre es ein zweiter Wahrheitsträger, der bei jeder
    Textänderung an 24 Zeilen nachgezogen werden müsste — und beim ersten
    vergessenen Nachziehen stünde „aktuell" an einer veralteten Fassung.
    """

    sprache: str
    titel: str
    kurztext: str | None = None
    inhalt_html: str = ""
    geprueft: bool = False
    geprueft_am: str | None = None
    # true = das Original wurde geändert, seit diese Fassung entstand.
    veraltet: bool = False


class UebersetzungsUebersicht(BaseModel):
    """Backoffice-Blick auf den Sprachstand einer Ankündigung.

    `fehlend` ist die Liste der Sprachen OHNE Fassung — sie wird ausgegeben,
    statt sie das Frontend aus 24 minus vorhandene errechnen zu lassen. Sonst
    stünde die Sprachliste im Frontend ein zweites Mal und liefe beim
    Hinzufügen einer Sprache auseinander.
    """

    items: list[AnnouncementUebersetzung] = Field(default_factory=list)
    fehlend: list[str] = Field(default_factory=list)
    # Sprachen, deren Fassung geprüft ist, aber nicht mehr zum aktuellen
    # Original passt. Der Redakteur muss sie ansehen; überschrieben werden sie
    # NICHT (das ist der Sinn von `geprueft`).
    veraltet: list[str] = Field(default_factory=list)


class UebersetzungUpdate(BaseModel):
    """Backoffice: eine Fassung von Hand korrigieren.

    Jedes Schreiben über diesen Weg setzt `geprueft = true` — das ist nicht
    optional. Wer eine Fassung anfasst, verantwortet sie ab diesem Moment, und
    genau daran hängt der Schutz vor dem nächsten Übersetzungslauf. Ein
    Schalter „ja, aber trotzdem überschreibbar" wäre eine Falle: er sähe nach
    einer Feinheit aus und hebelte die einzige Garantie aus, die dieser Slice
    gibt.
    """

    titel: str = Field(min_length=1, max_length=200)
    kurztext: str | None = Field(default=None, max_length=500)
    inhalt_html: str = ""

    # Dieselbe Allowlist wie beim Original — eine korrigierte Fassung geht
    # denselben Weg ins Dashboard und darf kein zweites, laxeres Tor haben.
    _v_inhalt = field_validator("inhalt_html")(sanitize_inhalt)


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
