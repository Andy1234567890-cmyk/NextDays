"""Service-Schicht für content.

Enthält die Text-Übersetzung über die Google Cloud Translation API (v2 REST).
Der API-Key bleibt serverseitig (Settings) — nie im Browser (PROJECT.md §2).
"""
import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

from .schemas import SliceHealth, TranslateRequest, TranslateResponse

log = get_logger("nextdays.content")

_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"


class ContentError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ContentService:
    slice_name = "content"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def translate(self, req: TranslateRequest) -> TranslateResponse:
        """Übersetzt Text via Google Cloud Translation (v2)."""
        key = get_settings().google_translate_api_key.get_secret_value()
        if not key:
            raise ContentError(
                "Übersetzungsdienst ist nicht konfiguriert.", status_code=503
            )

        payload: dict[str, str] = {
            "q": req.text,
            "target": req.target,
            "format": req.fmt,
        }
        # Ohne `source` erkennt Google die Sprache selbst und meldet sie als
        # `detectedSourceLanguage` zurück — im Chat der Normalfall.
        if req.source is not None:
            payload["source"] = req.source

        try:
            resp = httpx.post(
                _TRANSLATE_URL,
                params={"key": key},
                data=payload,
                timeout=20.0,
            )
        except httpx.HTTPError as exc:
            log.error("translate_request_failed", error=str(exc))
            raise ContentError(
                "Übersetzung fehlgeschlagen (Netzwerk).", status_code=502
            ) from exc

        if resp.status_code != 200:
            # Google liefert die Fehlermeldung im Body — durchreichen (gekürzt).
            detail = resp.text[:300]
            log.error("translate_api_error", status=resp.status_code, detail=detail)
            # 400 heißt bei Google „diese Sprache kenne ich nicht" — das ist ein
            # Fehler der Anfrage, kein Ausfall des Dienstes. Als 502 gemeldet
            # hieße es „später nochmal versuchen", obwohl jeder Versuch scheitert.
            # Seit die Sprachliste offen ist (kein Enum mehr), ist Google die
            # Instanz, die über gültige Sprachen entscheidet.
            if resp.status_code == 400:
                raise ContentError(
                    "Diese Sprache unterstützt der Übersetzungsdienst nicht.",
                    status_code=422,
                )
            raise ContentError(
                f"Übersetzungsdienst meldete Fehler ({resp.status_code}).",
                status_code=502,
            )

        data = resp.json().get("data", {}).get("translations", [])
        if not data:
            raise ContentError("Keine Übersetzung erhalten.", status_code=502)

        first = data[0]
        return TranslateResponse(
            text=first.get("translatedText", ""),
            detected_source=first.get("detectedSourceLanguage"),
        )
