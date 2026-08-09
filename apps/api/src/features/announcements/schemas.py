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
from enum import StrEnum

import nh3
from pydantic import BaseModel, Field, field_validator

from src.core.supabase import public_storage_url

# Bucket der Screenshots (0338). Auch vom Service für Upload/Aufräumen genutzt.
BILD_BUCKET = "announcement-images"

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

    @field_validator("inhalt_html")
    @classmethod
    def _v_inhalt(cls, v: str | None) -> str | None:
        # None = Feld nicht mitgeschickt → unverändert lassen. Ein leerer String
        # ist dagegen eine bewusste Leerung und wird gesäubert durchgereicht.
        return None if v is None else sanitize_inhalt(v)


class BildResponse(BaseModel):
    """Antwort des Upload-Endpunkts: die URL, die der Editor ins <img> setzt."""

    url: str


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
