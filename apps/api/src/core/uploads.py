"""Multipart-Upload-Helfer mit angehobenem Part-Limit.

Starlette begrenzt einen Multipart-Part standardmäßig auf 1 MB
(``max_part_size``). Beim Datei-Upload (Fotos, Logo, Add-on-Medien) lehnt es
deshalb jede Datei >1 MB mit einem rohen 413 ab, BEVOR der Endpunkt/Service den
Inhalt sieht (Handy-Fotos sind leicht 2–10 MB). FastAPIs ``UploadFile = File()``
bietet keinen Weg, dieses Limit zu setzen — daher lesen wir das Formular selbst
mit ``request.form(max_part_size=…)`` und reichen die echte (Service-)
Größenprüfung wie gehabt nach.
"""
from __future__ import annotations

from fastapi import HTTPException, Request, status
from starlette.datastructures import UploadFile

# Großzügiges Hard-Limit auf Transport-Ebene (25 MB); die fachliche Obergrenze
# je Upload-Art (z. B. 5/10/20 MB) prüft weiterhin der jeweilige Service mit
# klarer deutscher Meldung.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


async def read_upload_named(
    request: Request, field: str = "file"
) -> tuple[bytes, str, str | None]:
    """Wie ``read_upload``, liefert zusätzlich den Original-Dateinamen.

    Warum eigens: das Formular wird von ``request.form()`` als
    Kontextmanager gelesen und beim Verlassen des Blocks GESCHLOSSEN
    (``FormData.close()`` schließt jedes ``UploadFile`` darin). Ein zweites
    ``await request.form()`` im Endpunkt liefert dann zwar dasselbe gecachte
    Objekt, aber mit bereits geschlossenen Dateien — dass der ``filename``
    dabei noch dasteht, ist ein Nebeneffekt der Starlette-Implementierung, kein
    zugesichertes Verhalten. Wer den Namen braucht, holt ihn deshalb hier, im
    selben Durchlauf, in dem der Inhalt gelesen wird.
    """
    try:
        async with request.form(max_part_size=MAX_UPLOAD_BYTES) as form:
            upload = form.get(field)
            if not isinstance(upload, UploadFile):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Keine Datei im Upload gefunden.",
                )
            content = await upload.read()
            return content, upload.content_type or "", upload.filename or None
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — Multipart-Parserfehler → 413
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Datei ist zu groß oder ungültig.",
        ) from exc


async def read_upload(request: Request, field: str = "file") -> tuple[bytes, str]:
    """Liest das hochgeladene File-Part als ``(content, content_type)``.

    Hebt das Starlette-Part-Limit auf ``MAX_UPLOAD_BYTES`` an. Wirft 413, wenn
    der Part das Transport-Limit überschreitet, und 400, wenn kein File-Part
    unter ``field`` vorhanden ist. Wird der Original-Dateiname gebraucht, führt
    der Weg über ``read_upload_named`` — nicht über ein zweites
    ``request.form()`` nach diesem Aufruf.
    """
    content, content_type, _name = await read_upload_named(request, field)
    return content, content_type
