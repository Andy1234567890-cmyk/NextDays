"""Bilder des Eigentümer-Chats hochladen (0611, ADR-0029).

WARUM HIER KEINE MAGIC-BYTE-PRÜFUNG STEHT — und warum das KEIN vergessener
Schutz ist: Das Bild kommt VERSCHLÜSSELT an (die App chiffriert es vor dem
Senden, genau wie den Text). Für den Server sind das Zufallsbytes ohne
erkennbaren Kopf. Eine Prüfung auf `\\x89PNG` müsste jede echte Nachricht
ablehnen — das ist der Unterschied zu `crm/dateien.py`, wo unverschlüsselte
Dateien ankommen und die Prüfung deshalb greift.

Der Schutz, der stattdessen trägt:

* Der Bucket ist PRIVAT und liefert nur über kurzlebige signierte Adressen.
  Ein abgelegter Inhalt wird nirgends als Bild interpretiert, außer im Client,
  der ihn vorher entschlüsselt hat.
* Kein Browser rendert diese Bytes je direkt: sie sind ohne Schlüssel kein
  gültiges Bildformat. Der klassische Angriff „Polyglot-Datei, die als HTML
  ausgeliefert wird" läuft damit ins Leere.
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

    # Der Name kommt vom Server, nicht vom Client: ein mitgeschickter Name
    # könnte `../` enthalten oder eine fremde Endung vortäuschen (Wurzel 3/8).
    # `.bin`, weil der Inhalt verschlüsselt ist und KEIN Bildformat hat —
    # eine Endung `.jpg` wäre eine Falschaussage über den Inhalt (Wurzel 4).
    pfad = f"{tenant_id}/{user_id}/{secrets.token_urlsafe(24)}.bin"

    try:
        db.storage.from_(BUCKET).upload(
            pfad,
            inhalt,
            {"content-type": "application/octet-stream"},
        )
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
_PFAD_MUSTER: Final = re.compile(
    r"^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[A-Za-z0-9_-]{1,64}\.bin$"
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
