"""Bilder des Eigentümer-Chats hochladen (0611; serverseitige Krypto ab 0616).

Hier stand bis zum 09.09.2026 die ausdrückliche Begründung, WARUM es keine
Magic-Byte-Prüfung gibt: das Bild kam verschlüsselt an, war für den Server
Zufallsbytes, und eine Prüfung auf einen Bildkopf hätte jede echte Nachricht
abgewiesen. Diese Begründung ist mit dem Umstieg auf serverseitige
Verschlüsselung entfallen — jetzt kommt ein echtes Bild an, also wird es
geprüft (Wurzel 8: am INHALT, nicht am `content_type` des Clients).

Bewusst ENGER als `crm/dateien.py`: nur PNG, JPEG, WebP und GIF. Kein SVG
(aktives Markup, das ein Browser ausführt) und kein PDF — ein Chatanhang
zwischen Eigentümer und Verwaltung ist ein Foto vom Schaden, kein Dokument.
Was nicht gebraucht wird, wird nicht erlaubt.

Der übrige Schutz bleibt:

* Der Bucket ist PRIVAT und liefert nur über kurzlebige signierte Adressen.
* Größe und Anzahl sind hart begrenzt (Wurzel 8).
* Der Pfad enthält den Mandanten und wird SERVERSEITIG gebildet — der Client
  bestimmt keinen Ablageort (sonst schriebe er in fremde Ordner, Wurzel 3).
"""
from __future__ import annotations

import re
import secrets
from typing import Any, Final

from fastapi import UploadFile
from supabase import Client

from src.core.logging import get_logger

from .fehler import OwnerChatError

log = get_logger(__name__)

BUCKET: Final = "owner-chat"

# Erlaubte Anhaenge, erkannt am INHALT. Je Format eine Liste von
# (Offset, Bytes) — ALLE muessen passen. WebP braucht zwei Marken: `RIFF` am
# Anfang und `WEBP` ab Byte 8.
#
# Die erste Fassung prueft nur `WEBP` ab Byte 8 — damit passierte JEDER Inhalt,
# der zufaellig oder absichtlich diese vier Zeichen dort trug, und wurde als
# `image/webp` in den Bucket geschrieben (nachgestellt 09.09.2026). Ein
# halb geprueftes Format ist schlimmer als ein nicht erlaubtes: es sieht
# geprueft aus.
_MAGIC: Final[tuple[tuple[tuple[tuple[int, bytes], ...], str, str], ...]] = (
    (((0, b"\x89PNG\r\n\x1a\n"),), "image/png", "png"),
    (((0, b"\xff\xd8\xff"),), "image/jpeg", "jpg"),
    (((0, b"GIF87a"),), "image/gif", "gif"),
    (((0, b"GIF89a"),), "image/gif", "gif"),
    (((0, b"RIFF"), (8, b"WEBP")), "image/webp", "webp"),
)


def _bildtyp(inhalt: bytes) -> tuple[str, str]:
    """(MIME, Endung) — oder 415, wenn es kein erlaubtes Bild ist.

    Geprueft wird der Inhalt, NIE der `content_type` des Clients: den setzt
    der Absender selbst, und er sagt nichts darueber, was wirklich ankommt.
    """
    for marken, mime, endung in _MAGIC:
        if all(
            inhalt[offset : offset + len(bytes_)] == bytes_
            for offset, bytes_ in marken
        ):
            return mime, endung
    raise OwnerChatError(
        "Nur PNG, JPEG, WebP oder GIF erlaubt (erkannt am Inhalt).",
        status_code=415,
    )

# 10 MB wie in der Bucket-Definition (0611). Zwei Stellen, ein Wert: die API
# weist früh mit verständlicher Meldung ab, der Bucket ist die Rückfallebene.
MAX_BYTES: Final = 10 * 1024 * 1024

# Gültigkeit der signierten Adresse. Kurz, weil sie nur zum Anzeigen dient und
# die App bei Bedarf eine neue holt.
URL_GUELTIG_SEKUNDEN: Final = 3600


async def hochladen(
    db: Client, tenant_id: str, user_id: str, datei: UploadFile
) -> dict[str, Any]:
    """Verschlüsselte Bilddaten ablegen → Pfad + kurzlebige Adresse."""
    inhalt = await datei.read()
    if not inhalt:
        raise OwnerChatError("Die Datei ist leer.", status_code=415)
    if len(inhalt) > MAX_BYTES:
        raise OwnerChatError("Bild ist zu groß (max. 10 MB).", status_code=413)
    mime, endung = _bildtyp(inhalt)

    # Der Name kommt vom Server, nicht vom Client: ein mitgeschickter Name
    # könnte `../` enthalten oder eine fremde Endung vortäuschen (Wurzel 3/8).
    # Die Endung stammt aus dem GEPRÜFTEN Inhalt, nicht aus dem Dateinamen.
    pfad = f"{tenant_id}/{user_id}/{secrets.token_urlsafe(24)}.{endung}"

    try:
        db.storage.from_(BUCKET).upload(pfad, inhalt, {"content-type": mime})
    except Exception as exc:  # noqa: BLE001 — Storage-Fehler wird 502, nie 500
        log.warning(
            "owner_chat_bild_upload_fehlgeschlagen",
            extra={"tenant_id": tenant_id, "fehler": str(exc)[:200]},
        )
        raise OwnerChatError(
            "Bild konnte nicht gespeichert werden.", status_code=502
        ) from exc

    return {"pfad": pfad, "url": signierte_adresse(db, pfad)}


# Genau die Form, die `hochladen` erzeugt: <tenant>/<user>/<token>.bin.
# Als MUSTER, nicht als Zeichenkettensuche — `pfad.startswith(tenant)` plus
# `".." in pfad` war umgehbar: `<tenant>/%2e%2e/<fremd>/…` passiert beide
# Prüfungen, und die Storage-Bibliothek dekodiert ein zweites Mal und
# normalisiert das `..` weg. Der Mandantenpräfix verschwand dabei, noch bevor
# die Anfrage rausging (nachgemessen 09.09.2026).
# `.bin` bleibt gültig: so liegen die Anhänge aus der E2E-Zeit im Bucket, und
# sie müssen weiter abrufbar sein (Wurzel 1 — der Bestand ist der Gegenzustand
# zur Umstellung). Neue Uploads tragen die Endung ihres geprüften Bildtyps.
_PFAD_MUSTER: Final = re.compile(
    r"^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[A-Za-z0-9_-]{1,64}"
    r"\.(bin|png|jpg|gif|webp)$"
)


def pfad_pruefen(pfad: str, tenant_id: str) -> None:
    """Ist das ein Pfad DIESES Mandanten in der erwarteten Form?

    Wurzel 3/8: Der Wert kommt vom Client. Geprüft wird die FORM, nicht ein
    Teilstring — jede Zeichenkettensuche lässt sich mit Kodierung umgehen.
    """
    if not _PFAD_MUSTER.match(pfad):
        raise OwnerChatError("Bild nicht gefunden.", status_code=404)
    if not pfad.startswith(f"{tenant_id}/"):
        raise OwnerChatError("Bild nicht gefunden.", status_code=404)


def signierte_adresse(db: Client, pfad: str) -> str:
    """Kurzlebige Adresse für einen Bucket-Pfad.

    Der Bucket ist privat — ohne diese Signatur kommt niemand an die Bytes,
    auch nicht mit dem vollständigen Pfad.
    """
    try:
        antwort = db.storage.from_(BUCKET).create_signed_url(
            pfad, URL_GUELTIG_SEKUNDEN
        )
    except Exception as exc:  # noqa: BLE001 — kein Grund für einen 500
        log.warning(
            "owner_chat_bild_url_fehlgeschlagen",
            extra={"fehler": str(exc)[:200]},
        )
        raise OwnerChatError(
            "Bild ist gerade nicht abrufbar.", status_code=502
        ) from exc
    adresse = antwort.get("signedURL") or antwort.get("signedUrl")
    if not adresse:
        # Kein erfundener Rückgabewert (Wurzel 4): ohne Adresse gibt es nichts
        # anzuzeigen, und ein leerer String im `src` wäre ein stiller Fehler.
        raise OwnerChatError("Bild ist gerade nicht abrufbar.", status_code=502)
    return str(adresse)
