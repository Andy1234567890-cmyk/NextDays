"""HTTP-Client für die Cloudflare-for-SaaS-API (Custom Hostnames).

Kapselt die Cloudflare Custom-Hostnames-API
(https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/).
Cloudflare übernimmt für jede Agentur-Custom-Domain den kompletten TLS-Zert-
Lebenszyklus (Ausstellung + Erneuerung); wir registrieren die Domain nur und
spiegeln ihren Status.

Eckdaten:
  - Auth: Header ``Authorization: Bearer <API_TOKEN>`` (Token mit NUR
    "Custom Hostnames: Edit" auf der einen Zone — least-privilege).
  - Endpunkt: ``/zones/{zone_id}/custom_hostnames``.
  - Antwort-Hülle: ``{"success": bool, "errors": [...], "result": {...}}``.
  - SSL-Validierung: ``txt`` (NICHT ``http``). Bei fremden Kundendomains ist
    HTTP-Validierung ein Henne-Ei-Problem — das Zert bräuchte schon routenden
    Traffic, den es ohne Zert noch nicht gibt. TXT-Validierung funktioniert für
    beliebige Domains unabhängig vom Routing. Der ``create``-Call liefert die
    TXT-Records (``ssl.validation_records``), die die Agentur zusätzlich zum
    CNAME setzen muss.

Keine Secrets/Domains in Logs (nur Status/IDs).
"""
from __future__ import annotations

from typing import Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.cloudflare")


class CloudflareError(Exception):
    """Fehler beim Aufruf der Cloudflare-API.

    ``status_code`` ist der nach außen (an unsere API-Clients) zu meldende Code;
    ``cf_status`` der ursprüngliche HTTP-Status von Cloudflare (Debug).
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        cf_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.cf_status = cf_status


class CloudflareClient:
    """Dünner, synchroner Client um die Cloudflare-Custom-Hostnames-API.

    Synchron (``httpx.Client``), passend zur restlichen Service-Schicht. Eine
    Instanz pro Request ist ok.
    """

    def __init__(
        self,
        *,
        api_token: str | None = None,
        zone_id: str | None = None,
        base_url: str | None = None,
        fallback_origin: str | None = None,
        timeout: float = 15.0,
    ) -> None:
        settings = get_settings()
        self._api_token = api_token or settings.cloudflare_api_token.get_secret_value()
        self._zone_id = zone_id or settings.cloudflare_zone_id
        self._base_url = (base_url or settings.cloudflare_base_url).rstrip("/")
        self._fallback_origin = fallback_origin or settings.cloudflare_fallback_origin
        self._timeout = timeout

    @property
    def is_configured(self) -> bool:
        """True, wenn Token + Zone + Fallback-Origin gesetzt sind."""
        return bool(self._api_token and self._zone_id and self._fallback_origin)

    @property
    def fallback_origin(self) -> str:
        """Der CNAME-Ziel-Hostname, auf den Agenturen ihre Domain zeigen."""
        return self._fallback_origin

    # -- interner Request mit Auth + Fehler-Mapping ----------------------------
    def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise CloudflareError(
                "Cloudflare ist nicht konfiguriert "
                "(CLOUDFLARE_API_TOKEN/ZONE_ID/FALLBACK_ORIGIN fehlen).",
                status_code=503,
            )

        url = f"{self._base_url}/zones/{self._zone_id}/{path.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self._api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.request(method, url, headers=headers, json=json)
        except httpx.HTTPError as exc:
            log.error("cloudflare_network_error", error=str(exc))
            raise CloudflareError(
                "Cloudflare nicht erreichbar (Netzwerkfehler).", status_code=502
            ) from exc

        return self._handle_response(resp)

    def _handle_response(self, resp: httpx.Response) -> dict[str, Any]:
        try:
            body: dict[str, Any] = resp.json() if resp.content else {}
        except ValueError:
            body = {}

        # Cloudflare meldet Erfolg via {"success": true, "result": {...}}.
        if resp.is_success and body.get("success"):
            result = body.get("result")
            return result if isinstance(result, dict) else {}

        errors = body.get("errors") or []
        message = self._extract_message(errors) or f"Cloudflare-Fehler {resp.status_code}."
        # Domain/Token NICHT loggen — nur Status + Fehlercodes.
        log.error(
            "cloudflare_api_error",
            status=resp.status_code,
            codes=[e.get("code") for e in errors if isinstance(e, dict)],
        )
        passthrough = resp.status_code in (400, 401, 403, 404, 409, 422)
        raise CloudflareError(
            message,
            status_code=resp.status_code if passthrough else 502,
            cf_status=resp.status_code,
        )

    @staticmethod
    def _extract_message(errors: object) -> str | None:
        if isinstance(errors, list) and errors:
            first = errors[0]
            if isinstance(first, dict):
                msg = first.get("message")
                if isinstance(msg, str):
                    return msg
        return None

    # -- öffentliche Methoden (Custom Hostnames) -------------------------------
    def create_custom_hostname(self, domain: str) -> dict[str, Any]:
        """Registriert eine Custom-Domain mit TXT-SSL-Validierung.

        Gibt das CF-Result zurück (mind. ``id``, ``status``, ``ssl``). Aus
        ``ssl.validation_records`` (TXT-Name/-Wert) baut der Service die DNS-
        Anweisungen fürs Dashboard.
        """
        payload = {
            "hostname": domain,
            "ssl": {
                "method": "txt",
                "type": "dv",
                "settings": {"min_tls_version": "1.2"},
            },
        }
        return self._request("POST", "custom_hostnames", json=payload)

    def get_custom_hostname(self, hostname_id: str) -> dict[str, Any]:
        """Liest den aktuellen Status eines Custom-Hostnames (für sync_domain)."""
        return self._request("GET", f"custom_hostnames/{hostname_id}")

    def delete_custom_hostname(self, hostname_id: str) -> None:
        """Entfernt einen Custom-Hostname bei Cloudflare (für remove_domain)."""
        self._request("DELETE", f"custom_hostnames/{hostname_id}")
