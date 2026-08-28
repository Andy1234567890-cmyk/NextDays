"""RSS-Import: Beiträge aus einem fremden Feed übernehmen (0457).

Warum es das gibt: ein Betrieb, der zu uns wechselt, hat seinen Blog woanders.
Ohne Import müsste er jeden Text von Hand kopieren — und tut es nicht, also
bleibt der Blog leer und die Website ohne Inhalt.

Warum es ein EIGENES Modul ist und nicht eine Funktion in `seiten.py`: hier
steht ein ausgehender Netzabruf auf eine Adresse, die der KUNDE eingibt. Das ist
der klassische SSRF-Vektor (Wurzel 8), und alles, was dazu gehört — IP-Prüfung,
Pinning, Redirect-Behandlung, Byte-Deckel, XML-Parsen — gehört an eine Stelle,
an der man es als Ganzes prüfen kann.

Die vier Deckel, und warum jeder einzelne nötig ist:

* **Bytes** (`_MAX_FEED_BYTES`): ein Feed, der endlos liefert, wäre ein
  Speicher-DoS. Wir streamen und brechen ab.
* **Beiträge je Import** (`MAX_JE_IMPORT` = 300): dieselbe Grenze wie bei
  Hostaway. Ein Feed mit 5000 Einträgen würde sonst 5000 Seiten anlegen.
* **Beiträge gesamt**: der bestehende Seiten-Deckel des Betriebs
  (`seiten.MAX_SEITEN`). Ein Beitrag IST eine Seite — ein zweiter, höherer
  Deckel nur für Beiträge wäre eine zweite Wahrheit über dieselbe Tabelle.
* **Weiterleitungen** (`_MAX_REDIRECTS`): jeder Hop wird neu geprüft, sonst
  führt der erste harmlose Hop auf `169.254.169.254`.

Was NICHT importiert wird und warum:

* **Der Feed-Inhalt landet als ENTWURF.** Importierte Texte sind fremde Texte;
  sie gehen erst live, wenn der Betrieb sie gesehen hat. Hostaway macht es
  genauso.
* **Kein „automatisches Backup vor dem Import".** Hostaway braucht eines, weil
  sein Import in einen bestehenden Blog schreibt. Unser Import LEGT NUR NEUE
  Seiten an: er ändert keine bestehende Zeile und löscht keine. Es gibt also
  nichts, was ein Backup zurückholen müsste — und ein Backup anzubieten, das
  nichts sichert, wäre ein Versprechen ohne Deckung.
* **Videos werden zu einem Link.** Wir haben keinen Video-Abschnitt; ein
  `<iframe>` würde von der HTML-Allowlist entfernt und der Inhalt wäre
  spurlos weg. Ein sichtbarer Link ist die ehrliche Fassung.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from xml.etree import ElementTree  # noqa: S405

import httpx
import nh3
from pydantic import BaseModel, Field
from supabase import Client

from src.core.ausgehende_url import (
    UnsichereUrl,
    host_header,
    host_pinnen,
    oeffentliche_ips,
)
from src.core.logging import get_logger

from . import seiten
from .basis import _RICH_TEXT_ATTRS, _RICH_TEXT_TAGS
from .schemas import BlockType, PageType

log = get_logger(__name__)

# Höchstzahl der Beiträge je Import — dieselbe Grenze wie bei Hostaway.
MAX_JE_IMPORT = 300

# 8 MB. Ein Feed mit dreihundert Volltext-Beiträgen liegt bei wenigen hundert
# Kilobyte; acht Megabyte sind großzügig und trotzdem eine harte Kante.
_MAX_FEED_BYTES = 8 * 1024 * 1024
_MAX_REDIRECTS = 3
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

# XML-Namensräume, die in freier Wildbahn vorkommen.
_NS = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "atom": "http://www.w3.org/2005/Atom",
}

# Video-Einbettungen, die wir in einen Link verwandeln, bevor die Allowlist sie
# entfernt. Bewusst nur diese beiden: es sind die, die Hostaways Importer nennt,
# und für alles andere wüssten wir nicht, ob die Adresse überhaupt eine
# abspielbare Seite ist.
_VIDEO_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com", "vimeo.com")
_IFRAME_RE = re.compile(
    r"<iframe\b[^>]*\bsrc=[\"']([^\"']+)[\"'][^>]*>\s*</iframe\s*>",
    re.IGNORECASE,
)

# Das HTML eines importierten Beitrags darf Bilder tragen — anders als das
# TipTap-HTML unserer eigenen Rich-Text-Abschnitte, wo ein Bild ein eigener
# Abschnitt ist. Beim Import ist das Bild Teil des fremden Fließtextes, und es
# herauszulösen hieße, den Text an einer Stelle zu zerschneiden, die wir nicht
# kennen.
_IMPORT_TAGS = _RICH_TEXT_TAGS | {"img", "hr", "figure", "figcaption"}
_IMPORT_ATTRS = {
    **_RICH_TEXT_ATTRS,
    "img": {"src", "alt", "title", "width", "height"},
}


class RssImportRequest(BaseModel):
    """Die Feed-Adresse und wie viele Beiträge höchstens kommen sollen."""

    url: str = Field(max_length=2000)
    limit: int = Field(default=MAX_JE_IMPORT, ge=1, le=MAX_JE_IMPORT)


class RssImportErgebnis(BaseModel):
    """Was der Import getan hat — Zeile für Zeile nachvollziehbar.

    `uebersprungen` ist kein Fehler, sondern der Normalfall beim ZWEITEN Lauf:
    ein Beitrag, den es schon gibt, wird nicht doppelt angelegt (Wurzel 2 — ein
    Import wird wiederholt, weil der erste Lauf abbrach oder weil der Feed
    gewachsen ist)."""

    angelegt: int = 0
    uebersprungen: int = 0
    feed_eintraege: int = 0
    titel: list[str] = Field(default_factory=list)
    hinweise: list[str] = Field(default_factory=list)


class RssImportFehler(Exception):
    """Der Import konnte nicht laufen. Trägt eine Meldung für den Kunden."""

    def __init__(self, meldung: str, status_code: int = 422) -> None:
        super().__init__(meldung)
        self.meldung = meldung
        self.status_code = status_code


# --- Abruf -------------------------------------------------------------------
def feed_holen(url: str) -> bytes:
    """Den Feed laden. SSRF-hart und mit hartem Byte-Deckel.

    Jeder einzelne Schritt hat einen Grund, den man einzeln nachvollziehen kann:

    * Redirects werden von Hand gefolgt (`follow_redirects=False`), damit JEDER
      Hop erneut durch die IP-Prüfung läuft. Ein Feed, der auf
      `http://169.254.169.254/` weiterleitet, ist sonst ein offenes Tor zu den
      Cloud-Zugangsdaten.
    * Verbunden wird auf die GEPRÜFTE IP (`host_pinnen`), Host-Header und SNI
      bleiben der echte Name. Ohne dieses Pinning läge zwischen Prüfung und
      Verbindung ein zweiter DNS-Aufruf — und der kann eine andere Antwort
      geben (DNS-Rebinding).
    * Der Body wird gestreamt und bei `_MAX_FEED_BYTES` abgebrochen.

    Fail-closed (Wurzel 5): was wir nicht sicher als öffentlich erkennen, rufen
    wir nicht ab.
    """
    aktuell = url.strip()
    if not aktuell:
        raise RssImportFehler("Bitte eine Feed-Adresse angeben.")
    with httpx.Client(timeout=_TIMEOUT, follow_redirects=False) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            try:
                ips = oeffentliche_ips(aktuell)
            except UnsichereUrl as exc:
                raise RssImportFehler(exc.grund) from exc
            zerlegt = urlparse(aktuell)
            host = zerlegt.hostname or ""
            gepinnt = zerlegt._replace(
                netloc=host_pinnen(zerlegt.netloc, ips[0])
            ).geturl()
            anfrage = client.build_request(
                "GET",
                gepinnt,
                headers={
                    "User-Agent": "myNextDays-Blog/1.0",
                    "Accept": "application/rss+xml, application/atom+xml, "
                    "application/xml, text/xml",
                    "Host": host_header(aktuell),
                },
                extensions={"sni_hostname": host},
            )
            try:
                antwort = client.send(anfrage, stream=True)
            except httpx.HTTPError as exc:
                raise RssImportFehler(
                    "Der Feed ist nicht erreichbar."
                ) from exc
            try:
                if antwort.is_redirect:
                    ziel = antwort.headers.get("location")
                    if not ziel:
                        raise RssImportFehler("Weiterleitung ohne Ziel.")
                    aktuell = str(httpx.URL(aktuell).join(ziel))
                    continue
                if antwort.status_code >= 400:
                    raise RssImportFehler(
                        f"Der Feed antwortet mit {antwort.status_code}."
                    )
                return _gedeckelt_lesen(antwort)
            finally:
                antwort.close()
    raise RssImportFehler("Zu viele Weiterleitungen.")


def _gedeckelt_lesen(antwort: httpx.Response) -> bytes:
    puffer = bytearray()
    for stueck in antwort.iter_bytes():
        puffer.extend(stueck)
        if len(puffer) > _MAX_FEED_BYTES:
            raise RssImportFehler("Der Feed ist zu groß.")
    return bytes(puffer)


# --- Parsen ------------------------------------------------------------------
def feed_lesen(roh: bytes) -> list[dict]:
    """Ein RSS-2.0- oder Atom-Dokument in eine Liste von Einträgen.

    Vor dem Parsen wird ein DOCTYPE abgelehnt. Das ist keine Förmlichkeit:
    `xml.etree` expandiert interne Entities, und drei Zeilen DTD reichen für die
    „billion laughs"-Attacke — aus einem Kilobyte werden Gigabyte im Speicher.
    Ein RSS-Feed braucht keine DTD; wer eine mitschickt, will etwas anderes.
    """
    kopf = roh[:1024].lstrip().lower()
    if b"<!doctype" in kopf or b"<!entity" in roh[:4096].lower():
        raise RssImportFehler(
            "Der Feed enthält eine Dokumenttyp-Definition und wird aus "
            "Sicherheitsgründen nicht gelesen."
        )
    try:
        wurzel = ElementTree.fromstring(roh)  # noqa: S314
    except ElementTree.ParseError as exc:
        raise RssImportFehler("Der Feed ist kein gültiges XML.") from exc
    eintraege = wurzel.findall("./channel/item")
    if eintraege:
        return [_rss_eintrag(e) for e in eintraege]
    atom = wurzel.findall("atom:entry", _NS)
    if atom:
        return [_atom_eintrag(e) for e in atom]
    raise RssImportFehler("Der Feed enthält keine Beiträge.")


def _text(element: ElementTree.Element | None) -> str:
    return (element.text or "").strip() if element is not None else ""


def _rss_eintrag(item: ElementTree.Element) -> dict:
    """Ein `<item>` eines RSS-2.0-Feeds.

    `content:encoded` schlägt `description`: das eine ist der VOLLE Text, das
    andere oft nur der Anriss. Genau das meint Hostaways Anforderung „der Feed
    muss den vollen Inhalt liefern, keine Zusammenfassung" — wir nehmen den
    volleren der beiden, statt den Kunden raten zu lassen."""
    inhalt = _text(item.find("content:encoded", _NS)) or _text(
        item.find("description")
    )
    return {
        "titel": _text(item.find("title")),
        "inhalt": inhalt,
        "anriss": _text(item.find("description")),
        "autor": _text(item.find("dc:creator", _NS)) or _text(item.find("author")),
        "datum": _text(item.find("pubDate")),
        "adresse": _text(item.find("link")),
    }


def _atom_eintrag(entry: ElementTree.Element) -> dict:
    link = entry.find("atom:link", _NS)
    autor = entry.find("atom:author/atom:name", _NS)
    return {
        "titel": _text(entry.find("atom:title", _NS)),
        "inhalt": _text(entry.find("atom:content", _NS))
        or _text(entry.find("atom:summary", _NS)),
        "anriss": _text(entry.find("atom:summary", _NS)),
        "autor": _text(autor),
        "datum": _text(entry.find("atom:published", _NS))
        or _text(entry.find("atom:updated", _NS)),
        "adresse": (link.get("href") or "") if link is not None else "",
    }


def datum_lesen(roh: str) -> str | None:
    """Das Erscheinungsdatum aus dem Feed — oder ``None``.

    Wurzel 5b in Reinform: das ist der Zeitpunkt einer FREMDEN Handlung. Steht
    im Feed kein Datum oder eines, das wir nicht lesen können, bleibt das Feld
    leer, und der Beitrag bekommt beim Anlegen unsere Uhr. Ein still erfundenes
    Datum („heute") würde die Reihenfolge des importierten Blogs umdrehen: alle
    dreihundert Beiträge trügen dieselbe Sekunde.
    """
    wert = (roh or "").strip()
    if not wert:
        return None
    try:
        # RFC 2822 (`Tue, 03 Jun 2025 09:00:00 +0200`) — die RSS-Schreibweise.
        return parsedate_to_datetime(wert).astimezone(UTC).isoformat()
    except (TypeError, ValueError):
        pass
    try:
        # ISO 8601 — die Atom-Schreibweise.
        gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return None
    if gelesen.tzinfo is None:
        gelesen = gelesen.replace(tzinfo=UTC)
    return gelesen.astimezone(UTC).isoformat()


def html_saeubern(roh: str) -> str:
    """Fremdes HTML auf unsere Allowlist bringen (Wurzel 8).

    Mit `nh3` und nicht per Regex: fremdes HTML ist genau der Fall, für den ein
    Parser gebaut wurde. Vorher werden Video-Einbettungen in Links verwandelt —
    danach wäre das `<iframe>` entfernt und der Verweis spurlos weg.
    """
    mit_links = _IFRAME_RE.sub(_iframe_zu_link, roh or "")
    return nh3.clean(
        mit_links,
        tags=_IMPORT_TAGS,
        attributes=_IMPORT_ATTRS,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer nofollow",
    )


def _iframe_zu_link(treffer: re.Match[str]) -> str:
    adresse = treffer.group(1)
    zerlegt = urlparse(adresse)
    if zerlegt.scheme not in ("http", "https"):
        return ""
    host = (zerlegt.hostname or "").lower().removeprefix("www.")
    if not any(host == v or host.endswith("." + v) for v in _VIDEO_HOSTS):
        # Eine fremde Einbettung, die kein Video ist: weg. Wir wissen nicht, was
        # dahinter liegt, und ein Link darauf wäre ein Versprechen.
        return ""
    sicher = adresse.replace('"', "&quot;").replace("<", "&lt;")
    return f'<p><a href="{sicher}">{sicher}</a></p>'


# --- Import ------------------------------------------------------------------
def feed_importieren(
    db: Client,
    tenant_id: str,
    req: RssImportRequest,
    *,
    sprache: str,
) -> RssImportErgebnis:
    """Beiträge aus einem Feed als ENTWÜRFE anlegen.

    Idempotent über den Slug (Wurzel 2): ein Beitrag, dessen Slug es schon gibt,
    wird übersprungen und nicht ein zweites Mal angelegt. Der Import wird real
    wiederholt — weil der erste Lauf in einen Deckel gelaufen ist, weil der Feed
    gewachsen ist, oder weil jemand zweimal geklickt hat.

    Der Slug ist dabei der richtige Schlüssel und nicht die Feed-`guid`: unser
    UNIQUE steht auf `(tenant_id, slug)`, und genau dieser UNIQUE ist der harte
    Backstop, wenn zwei Importe gleichzeitig laufen.
    """
    roh = feed_holen(req.url)
    eintraege = feed_lesen(roh)
    gefunden = len(eintraege)
    hinweise: list[str] = []
    if gefunden > MAX_JE_IMPORT:
        hinweise.append(
            f"Der Feed hat {gefunden} Einträge — es werden die ersten "
            f"{MAX_JE_IMPORT} übernommen."
        )
        eintraege = eintraege[:MAX_JE_IMPORT]
    eintraege = eintraege[: req.limit]

    freie_plaetze = max(0, seiten.MAX_SEITEN - seiten.zaehle_seiten(db, tenant_id))
    if freie_plaetze <= 0:
        raise RssImportFehler(
            f"Das Konto hat bereits {seiten.MAX_SEITEN} Seiten — es ist kein "
            "Platz für weitere Beiträge."
        )

    belegte_slugs = _slugs_des_betriebs(db, tenant_id)
    angelegt: list[str] = []
    uebersprungen = 0
    for eintrag in eintraege:
        if len(angelegt) >= freie_plaetze:
            hinweise.append(
                "Der Seiten-Deckel des Kontos ist erreicht — der Rest des "
                "Feeds wurde nicht übernommen."
            )
            break
        slug = (
            _freier_slug(eintrag["titel"], belegte_slugs)
            if eintrag["titel"]
            else None
        )
        if slug is None:
            # Kein Titel oder den Slug gibt es schon. Beides ist kein Fehler:
            # das eine ist ein kaputter Feed-Eintrag, das andere ein Beitrag,
            # den wir bereits haben.
            uebersprungen += 1
            continue
        _beitrag_anlegen(db, tenant_id, eintrag, slug=slug, sprache=sprache)
        belegte_slugs.add(slug)
        angelegt.append(eintrag["titel"])
    log.info(
        "rss_import_fertig",
        tenant_id=tenant_id,
        angelegt=len(angelegt),
        uebersprungen=uebersprungen,
    )
    return RssImportErgebnis(
        angelegt=len(angelegt),
        uebersprungen=uebersprungen,
        feed_eintraege=gefunden,
        titel=angelegt,
        hinweise=hinweise,
    )


def _slugs_des_betriebs(db: Client, tenant_id: str) -> set[str]:
    rows = (
        db.table("site_pages")
        .select("slug")
        .eq("tenant_id", tenant_id)
        .limit(seiten.MAX_SEITEN)
        .execute()
    ).data or []
    return {r.get("slug") or "" for r in rows}


def _freier_slug(titel: str, belegt: set[str]) -> str | None:
    """Der Slug dieses Beitrags, oder ``None``, wenn er schon vergeben ist.

    KEIN automatisches Anhängen von `-2`: ein Feed, der zweimal importiert wird,
    ergäbe sonst jeden Beitrag doppelt — einmal als `sommer-am-see`, einmal als
    `sommer-am-see-2`. Genau das soll die Wiederholbarkeit verhindern.
    """
    slug = seiten.beitrags_slug(titel)
    if not slug or slug in belegt:
        return None
    return slug


def _beitrag_anlegen(
    db: Client,
    tenant_id: str,
    eintrag: dict,
    *,
    slug: str,
    sprache: str,
) -> None:
    """Eine Beitragsseite plus einen Rich-Text-Abschnitt anlegen.

    `is_published=False` UND `is_draft=True`: das erste heißt „steht nicht
    live", das zweite „beim Veröffentlichen der ganzen Website überspringen"
    (0443). Beides zusammen ist die einzige Kombination, bei der ein
    versehentliches „Website veröffentlichen" nicht dreihundert ungelesene
    fremde Texte live schaltet.
    """
    zeile = (
        db.table("site_pages")
        .insert(
            {
                "tenant_id": tenant_id,
                "title": eintrag["titel"][:200],
                "slug": slug,
                "page_type": PageType.post.value,
                # Kein Menüpunkt: dreihundert importierte Beiträge in der
                # Kopfzeile wären das Ende der Navigation.
                "nav_area": "none",
                "is_home": False,
                "is_published": False,
                "is_draft": True,
                "published_at": datum_lesen(eintrag.get("datum") or ""),
                "author": (eintrag.get("autor") or "")[:120] or None,
                "excerpt": _anriss(eintrag.get("anriss") or ""),
            }
        )
        .execute()
    ).data or []
    if not zeile:
        raise RssImportFehler(
            "Ein Beitrag konnte nicht angelegt werden.", status_code=500
        )
    html = html_saeubern(eintrag.get("inhalt") or "")
    if not html:
        return
    db.table("site_blocks").insert(
        {
            "tenant_id": tenant_id,
            "page_id": zeile[0]["id"],
            "type": BlockType.rich_text.value,
            "position": 0,
            # Der importierte Text steht in der STANDARDSPRACHE der Website.
            # Ein Feed sagt nicht, in welcher Sprache er ist; ihn in alle
            # Sprachen zu schreiben wäre eine erfundene Übersetzung.
            "content": {"html": {sprache: html}, "align": "left"},
            "settings": {},
        }
    ).execute()


def _anriss(roh: str) -> str | None:
    """Der Anrisstext: fremdes HTML ohne Tags, auf 300 Zeichen gekürzt.

    Eine Kürzung, keine Erfindung (Wurzel 4) — und `nh3` mit leerer Tag-Liste
    statt eines Regex, weil hier fremdes HTML steht.
    """
    text = nh3.clean(roh or "", tags=set(), attributes={}).strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        return None
    return text[:297] + "…" if len(text) > 300 else text
