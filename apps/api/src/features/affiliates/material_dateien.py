"""Dateiregeln des Werbematerials: was in den Bucket `affiliate-material` darf.

Eigenes Modul und nicht im Service, weil `service.py` an der Zeilengrenze steht
und weil diese Prüfung nichts über Partner weiß — sie beantwortet eine einzige
Frage: ist das, was ankam, wirklich ein Bild, ein Video oder ein Dokument?

Der vom Browser gemeldete `content_type` zählt dabei nicht (Wurzel 8): er wird
von der Gegenseite gesetzt und kostet nichts. Entschieden wird an den
ANFANGSBYTES. SVG hat als einziges Format keine Signatur — es ist Text — und
wird deshalb am Wurzelelement erkannt und VOR dem Ablegen gesäubert. Ohne diese
Säuberung wäre ein Logo mit `<script>` in einem ÖFFENTLICHEN Bucket Stored-XSS.

Die Säuberung ist bewusst die Allowlist der Firmenlogos und keine zweite:
zwei SVG-Allowlists laufen auseinander, und die schwächere wäre die Lücke —
dasselbe Argument wie in `crm/dateien.py`.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

from src.features.buchhaltung.service import _sanitize_svg  # noqa: PLC2701

from .fehler import AffiliateError

#: Bucket aus Migration 0707. Öffentlich (das Banner landet im Beitrag des
#: Partners), Pfad mit Zufallstoken.
MATERIAL_BUCKET = "affiliate-material"

#: Deckel JE ART, nicht einer für alles. Der Transport deckelt ohnehin bei 25 MB
#: (`core.uploads.MAX_UPLOAD_BYTES`) — diese Werte liegen darunter und liefern
#: die verständliche Meldung, bevor der Parser mit einem rohen 413 abbricht.
MAX_BYTES_JE_ART: dict[str, int] = {
    "image": 10 * 1024 * 1024,
    "video": 25 * 1024 * 1024,
    "file": 25 * 1024 * 1024,
}

#: Anzeigename der Art in den SERVERseitigen Meldungen („max. 10 MB für Bilder").
ART_NAME: dict[str, str] = {
    "image": "Bilder",
    "video": "Videos",
    "file": "Dokumente",
}

#: Signatur → (MIME, Endung, Art). Reihenfolge egal, die Muster überschneiden
#: sich nicht. `RIFF`/`WEBP` und die ZIP-Familie brauchen mehr als ein Präfix
#: und stehen deshalb unten als eigene Prüfer.
_MAGIC: tuple[tuple[bytes, str, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png", "image"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg", "image"),
    (b"%PDF-", "application/pdf", "pdf", "file"),
    (b"\x1aE\xdf\xa3", "video/webm", "webm", "video"),
)

#: OOXML-Dateien sind ZIPs. Der Unterschied steht im ersten Eintrag des Archivs
#: (`[Content_Types].xml` plus ein Ordnername) — er wird im gelesenen Kopf
#: gesucht, ohne das Archiv zu entpacken. Kein Treffer heißt: normales ZIP.
_OOXML: tuple[tuple[bytes, str, str], ...] = (
    (
        b"word/",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    (
        b"xl/",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    (
        b"ppt/",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
)

#: Wie viele Kopfbytes für die ZIP-Unterscheidung angesehen werden. Genug für
#: das Inhaltsverzeichnis einer echten Office-Datei, klein genug, dass kein
#: unbegrenzter Bereich entsteht (Wurzel 8).
_ZIP_KOPF = 4096

ERLAUBT_TEXT = (
    "Erlaubt sind Bilder (PNG, JPEG, WebP, SVG), Videos (MP4, WebM) und "
    "Dokumente (PDF, ZIP, DOCX, XLSX, PPTX) — erkannt am Inhalt, nicht am "
    "Dateinamen."
)


def _ist_webp(inhalt: bytes) -> bool:
    return inhalt[:4] == b"RIFF" and inhalt[8:12] == b"WEBP"


def _ist_mp4(inhalt: bytes) -> bool:
    """MP4/MOV: der `ftyp`-Kasten steht als erster, nach seiner 4-Byte-Länge.

    Geprüft wird an Byte 4, nicht am Dateianfang — davor steht die Größe des
    Kastens, und die ist bei jeder Datei eine andere.
    """
    return inhalt[4:8] == b"ftyp"


def _ist_zip(inhalt: bytes) -> bool:
    """ZIP-Signaturen: lokaler Eintrag, leeres Archiv, geteiltes Archiv."""
    return inhalt[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")


def _ist_svg(inhalt: bytes) -> bool:
    """SVG hat keine Magic Bytes — erkannt am Wurzelelement, nach BOM/Whitespace
    und optionalem XML-Prolog, Kommentaren und DOCTYPE.

    Gleiche Prüfung wie in `crm/dateien.py`, bewusst als Kopie: ein Slice soll
    für seine Upload-Sicherheit nicht an einem fremden Slice hängen, und die
    Form eines XML-Kopfes ändert sich nicht.
    """
    text = inhalt[:4096].lstrip(b"\xef\xbb\xbf").decode("utf-8", errors="replace").lower()
    rest = text.lstrip()
    while rest:
        if rest.startswith("<svg"):
            return True
        if rest.startswith("<?"):
            ende, schritt = rest.find("?>"), 2
        elif rest.startswith("<!--"):
            ende, schritt = rest.find("-->"), 3
        elif rest.startswith("<!"):
            ende, schritt = rest.find(">"), 1
        else:
            return False
        if ende < 0:
            return False
        rest = rest[ende + schritt :].lstrip()
    return False


def _zip_art(inhalt: bytes) -> tuple[str, str, str]:
    """Ein ZIP genauer bestimmen: Office-Datei oder gewöhnliches Archiv."""
    kopf = inhalt[:_ZIP_KOPF]
    for marker, mime, endung in _OOXML:
        if marker in kopf:
            return mime, endung, "file"
    return "application/zip", "zip", "file"


def _erkennen(inhalt: bytes) -> tuple[str, str, str] | None:
    """(MIME, Endung, Art) aus den Anfangsbytes, oder ``None``.

    ``None`` heißt: keine der erlaubten Signaturen. Der Aufrufer lehnt dann ab —
    nicht „vielleicht doch" (fail-closed, Wurzel 5).
    """
    for magic, mime, endung, art in _MAGIC:
        if inhalt.startswith(magic):
            return mime, endung, art
    if _ist_webp(inhalt):
        return "image/webp", "webp", "image"
    if _ist_mp4(inhalt):
        return "video/mp4", "mp4", "video"
    if _ist_zip(inhalt):
        return _zip_art(inhalt)
    return None


def datei_pruefen(inhalt: bytes) -> tuple[bytes, str, str, str]:
    """Inhalt prüfen → ``(ggf. gesäuberter Inhalt, MIME, Endung, Art)``.

    Wirft `AffiliateError` 415 bei unbekanntem oder leerem Inhalt und 413 bei
    Übergröße. Die Größe wird JE ART geprüft: 10 MB sind für ein Banner
    großzügig und für ein Video nichts.
    """
    if not inhalt:
        raise AffiliateError("Die Datei ist leer.", status_code=415)

    erkannt = _erkennen(inhalt)
    if erkannt is None:
        if not _ist_svg(inhalt):
            raise AffiliateError(ERLAUBT_TEXT, status_code=415)
        gesaeubert = _sanitize_svg(inhalt)
        if b"<svg" not in gesaeubert.lower():
            # Nach der Säuberung blieb kein Bild übrig — der Inhalt bestand aus
            # dem, was entfernt wurde. Fail-closed statt leere Grafik ablegen.
            raise AffiliateError(
                "Das SVG enthält keine darstellbare Grafik.", status_code=415
            )
        erkannt, inhalt = ("image/svg+xml", "svg", "image"), gesaeubert

    mime, endung, art = erkannt
    deckel = MAX_BYTES_JE_ART[art]
    if len(inhalt) > deckel:
        raise AffiliateError(
            f"Die Datei ist zu groß (max. {deckel // (1024 * 1024)} MB "
            f"für {ART_NAME[art]}).",
            status_code=413,
        )
    return inhalt, mime, endung, art


def anzeigename(dateiname: str | None, endung: str) -> str:
    """Anzeigename für Liste und Download — nie ein Pfad.

    Alles bis auf den letzten Pfadteil fällt weg (ein Browser schickt bei einem
    Ordner-Upload `unterordner/logo.png`), Pfadtrenner und Steuerzeichen
    ebenfalls: der Name landet in einem `Content-Disposition`-Header und in der
    Oberfläche. Der echte Bucket-Pfad ist davon unberührt — das ist der
    Zufallstoken aus dem Service.
    """
    roh = (dateiname or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    sauber = "".join(z for z in roh if z.isprintable() and z not in '"\\/')[:120]
    return sauber or f"material.{endung}"


#: Die Felder, die eine Zeile OHNE eigene Datei liefert. Als Konstante und nicht
#: als vier `None` an drei Stellen: sonst vergisst die vierte Stelle eines.
_OHNE_DATEI: dict[str, Any] = {
    "download_url": None,
    "filename": None,
    "mime": None,
    "bytes": None,
}


def datei_felder(zeile: Mapping[str, Any]) -> dict[str, Any]:
    """Die Datei-Felder einer `affiliate_assets`-Zeile für die Antwort.

    EINE Stelle für Backoffice UND Partner-Dashboard: die beiden Mapper bauen
    sonst zwei Adressen, die sich beim nächsten Umbau unterscheiden — und der
    Unterschied fiele erst auf, wenn ein Partner eine Datei nicht mehr
    herunterladen kann.

    `?download=<name>` ist Supabase-Storage: es setzt `Content-Disposition:
    attachment` samt Dateinamen. Ohne diesen Parameter zeigt der Browser ein
    PNG an, statt es zu speichern — und der Partner müsste „Bild speichern
    unter" suchen. Fehlt der Name, steht der Parameter ohne Wert da; dann nimmt
    Storage den Objektnamen (der Zufallstoken) — kein erfundener Ersatzname
    (Wurzel 4).
    """
    pfad, url = zeile.get("storage_path"), zeile.get("url")
    if not pfad or not url:
        return dict(_OHNE_DATEI)
    name = zeile.get("filename")
    groesse = zeile.get("bytes")
    return {
        "download_url": f"{url}?download={quote(str(name))}" if name else f"{url}?download",
        "filename": name,
        "mime": zeile.get("mime"),
        "bytes": int(groesse) if groesse is not None else None,
    }
