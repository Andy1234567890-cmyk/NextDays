"""Dünner, synchroner Client um die Meta WhatsApp Cloud API (Graph).

Sendet Textnachrichten über
`POST https://graph.facebook.com/<version>/<phone_number_id>/messages`.
Auth: Bearer-Token (permanenter System-User-Token). Keine Fallbacks — ohne
Credentials wird klar mit 503 gemeldet (PROJECT.md / Memory „keine Fallbacks").
"""
from __future__ import annotations

from typing import Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.whatsapp.client")

_GRAPH_HOST = "https://graph.facebook.com"


class WhatsAppError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WhatsAppClient:
    def __init__(
        self,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        graph_version: str | None = None,
        timeout: float = 20.0,
    ) -> None:
        settings = get_settings()
        self._token = access_token or settings.whatsapp_access_token.get_secret_value()
        self._phone_number_id = phone_number_id or settings.whatsapp_phone_number_id
        self._version = graph_version or settings.whatsapp_graph_version
        self._timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self._token and self._phone_number_id)

    def send_text(self, to_phone: str, body: str) -> dict[str, Any]:
        """Textnachricht senden. Gibt die Meta-Antwort zurück (enthält message-ID)."""
        if not self.is_configured:
            raise WhatsAppError(
                "WhatsApp ist nicht konfiguriert (Access-Token / Phone-Number-ID fehlt).",
                status_code=503,
            )
        url = f"{_GRAPH_HOST}/{self._version}/{self._phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": body},
        }
        try:
            resp = httpx.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            log.error("whatsapp_network_error", error=str(exc))
            raise WhatsAppError("WhatsApp-Dienst nicht erreichbar.") from exc
        if resp.status_code >= 400:
            log.error(
                "whatsapp_http_error", status=resp.status_code, body=resp.text[:500]
            )
            raise WhatsAppError(
                f"WhatsApp-Versand fehlgeschlagen (HTTP {resp.status_code}).",
                status_code=502,
            )
        return resp.json()
