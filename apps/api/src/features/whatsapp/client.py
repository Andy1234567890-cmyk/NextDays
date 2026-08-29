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


def _graph_error(resp: httpx.Response) -> str:
    """Meta-Fehlertext aus der Antwort ziehen, sonst auf den HTTP-Code zurückfallen.

    Kein Raten: liefert Meta keinen verwertbaren `error.message`, wird der reine
    Statuscode gemeldet statt ein erfundener Grund.
    """
    try:
        error = resp.json().get("error")
    except ValueError:
        error = None
    if isinstance(error, dict):
        message = error.get("error_user_msg") or error.get("message")
        if isinstance(message, str) and message:
            code = error.get("code")
            return f"{message} (Meta-Code {code})" if code else message
    return f"WhatsApp-Aufruf fehlgeschlagen (HTTP {resp.status_code})."


class WhatsAppClient:
    def __init__(
        self,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        waba_id: str | None = None,
        graph_version: str | None = None,
        timeout: float = 20.0,
    ) -> None:
        settings = get_settings()
        self._token = access_token or settings.whatsapp_access_token.get_secret_value()
        self._phone_number_id = phone_number_id or settings.whatsapp_phone_number_id
        self._waba_id = waba_id or settings.whatsapp_waba_id
        self._version = graph_version or settings.whatsapp_graph_version
        self._timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self._token and self._phone_number_id)

    @property
    def can_manage_templates(self) -> bool:
        """Template-Verwaltung braucht Token + WABA-ID (nicht die Nummer)."""
        return bool(self._token and self._waba_id)

    def send_text(self, to_phone: str, body: str) -> dict[str, Any]:
        """Textnachricht senden. Gibt die Meta-Antwort zurück (enthält message-ID).

        Nur INNERHALB des 24-h-Servicefensters erlaubt (Meta-Regel) — die Prüfung
        liegt im Service. Außerhalb ist `send_template` zu nutzen.
        """
        return self._post_messages(
            {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": body},
            }
        )

    def send_template(
        self,
        to_phone: str,
        template_name: str,
        language_code: str = "de",
        components: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Template-Nachricht senden (auch außerhalb des 24-h-Fensters erlaubt).

        `components` sind die Meta-Template-Parameter (Header/Body/Buttons); None,
        wenn das Template keine Variablen hat.
        """
        template: dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code},
        }
        if components:
            template["components"] = components
        return self._post_messages(
            {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "template",
                "template": template,
            }
        )

    # --- Embedded Signup (Kunden-Onboarding, Tech-Provider-Modell) ---------
    def exchange_code(self, code: str, *, app_id: str, app_secret: str) -> str:
        """Den Embedded-Signup-Code gegen ein kundengebundenes Token tauschen.

        Der Code lebt nur ~30 Sekunden, deshalb passiert das direkt im
        Callback und nicht in einem Job. Ergebnis ist ein
        Business-Integration-System-User-Token, das ausschließlich auf die
        WABA DIESES Kunden zeigt.
        """
        data = self._graph(
            "GET",
            "oauth/access_token",
            params={
                "client_id": app_id,
                "client_secret": app_secret,
                "code": code,
            },
            auth=False,
        )
        token = data.get("access_token")
        if not isinstance(token, str) or not token:
            raise WhatsAppError(
                "Meta hat kein Zugangstoken geliefert.", status_code=502
            )
        return token

    def debug_token(self, token: str, *, app_id: str, app_secret: str) -> dict[str, Any]:
        """Token prüfen und auslesen, WELCHE WABA es freischaltet.

        Die WABA-ID steht in ``granular_scopes[].target_ids`` — sie wird NICHT
        vom Client mitgeschickt, sondern hier bei Meta erfragt. Sonst könnte ein
        Angreifer im Callback eine fremde WABA-ID unterschieben (Wurzel 3).
        """
        return self._graph(
            "GET",
            "debug_token",
            params={"input_token": token, "access_token": f"{app_id}|{app_secret}"},
            auth=False,
        )

    def subscribe_app_to_waba(self, waba_id: str, *, token: str) -> dict[str, Any]:
        """Unsere App für die Webhooks der Kunden-WABA registrieren.

        Ohne diesen Schritt kommen die Nachrichten dieses Kunden nie bei uns an
        — das Abo auf App-Ebene allein genügt nicht.
        """
        return self._graph(
            "POST", f"{waba_id}/subscribed_apps", token=token
        )

    def phone_numbers(self, waba_id: str, *, token: str) -> list[dict[str, Any]]:
        """Nummern der WABA mit Status, Quality und Sendelimit."""
        data = self._graph(
            "GET",
            f"{waba_id}/phone_numbers",
            params={
                "fields": "id,display_phone_number,verified_name,"
                "code_verification_status,quality_rating,status,"
                "messaging_limit_tier",
            },
            token=token,
        )
        items = data.get("data")
        return items if isinstance(items, list) else []

    def waba_health(self, waba_id: str, *, token: str) -> dict[str, Any]:
        """`health_status` der WABA — sagt, ob überhaupt gesendet werden darf
        (z. B. Fehler 141006, wenn die Zahlungsmethode fehlt)."""
        return self._graph(
            "GET",
            waba_id,
            params={"fields": "id,name,health_status,currency,timezone_id"},
            token=token,
        )

    # --- Template-Verwaltung (WABA-Ebene) ---------------------------------
    def list_templates(self) -> list[dict[str, Any]]:
        """Alle Message-Templates der WABA.

        ``id`` und ``components`` sind mit dabei, weil die Oberfläche den Text
        zeigen und bearbeiten können muss: bearbeitet wird über die ID, und
        Metas Update ERSETZT alle Komponenten — wer nur den Fließtext schickt,
        verliert stillschweigend Fußzeile und Knöpfe (Wurzel 1).
        """
        self._require_waba()
        data = self._graph(
            "GET",
            f"{self._waba_id}/message_templates",
            params={
                "fields": "id,name,language,status,category,components,"
                "rejected_reason",
                "limit": "250",
            },
        )
        items = data.get("data")
        return items if isinstance(items, list) else []

    def update_template(
        self, template_id: str, components: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Eine vorhandene Vorlage ändern (Meta prüft danach erneut).

        Metas Grenzen, die der Aufrufer kennen muss: Name und Sprache lassen
        sich NICHT ändern (dafür eine neue Vorlage anlegen), bearbeitbar sind
        nur Vorlagen im Status APPROVED, REJECTED oder PAUSED, und eine
        freigegebene höchstens zehnmal in 30 Tagen bzw. einmal in 24 Stunden.
        Verstößt der Aufruf dagegen, kommt Metas Fehlertext unverändert zurück
        — er ist genauer als jede eigene Vermutung.
        """
        self._require_waba()
        return self._graph(
            "POST", template_id, json_body={"components": components}
        )

    def delete_template(
        self, name: str, *, template_id: str | None = None
    ) -> dict[str, Any]:
        """Eine Vorlage löschen.

        Ohne ``template_id`` löscht Meta ALLE Sprachfassungen dieses Namens —
        das ist Metas Verhalten, nicht unseres. Mit ``hsm_id`` trifft es genau
        die eine Fassung; die Oberfläche schickt sie deshalb immer mit.
        """
        self._require_waba()
        params = {"name": name}
        if template_id:
            params["hsm_id"] = template_id
        return self._graph(
            "DELETE", f"{self._waba_id}/message_templates", params=params
        )

    def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Ein Template anlegen. Meta prüft es asynchron (Status PENDING)."""
        self._require_waba()
        return self._graph(
            "POST", f"{self._waba_id}/message_templates", json_body=payload
        )

    def _require_waba(self) -> None:
        if not self.can_manage_templates:
            raise WhatsAppError(
                "Template-Verwaltung nicht konfiguriert (Access-Token / WABA-ID fehlt).",
                status_code=503,
            )

    def _post_messages(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Gemeinsamer Versandpfad (Auth, Netz-/HTTP-Fehler) für Text + Template."""
        if not self.is_configured:
            raise WhatsAppError(
                "WhatsApp ist nicht konfiguriert (Access-Token / Phone-Number-ID fehlt).",
                status_code=503,
            )
        return self._graph(
            "POST", f"{self._phone_number_id}/messages", json_body=payload
        )

    def _graph(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        token: str | None = None,
        auth: bool = True,
    ) -> dict[str, Any]:
        """Ein Graph-Aufruf mit Auth, Netz- und HTTP-Fehlerbehandlung.

        Die Meta-Fehlermeldung wird in `WhatsAppError.message` übernommen, damit
        der Aufrufer den echten Grund sieht (z. B. „payment method"-Sperre 141006
        oder ein abgelehnter Template-Text) und nicht nur einen HTTP-Code.

        ``token`` überschreibt das eigene Token — nötig im Tech-Provider-Modell,
        wo jeder Kunde ein eigenes hat. ``auth=False`` für Aufrufe, die die
        Anmeldedaten als Query-Parameter erwarten (OAuth-Tausch, debug_token);
        dort wäre ein Bearer-Header falsch.
        """
        if path.startswith("/") or path.split("/", 1)[0] == "":
            raise WhatsAppError("Ungültiger Graph-Pfad.", status_code=500)
        url = f"{_GRAPH_HOST}/{self._version}/{path}"
        headers = (
            {"Authorization": f"Bearer {token or self._token}"} if auth else {}
        )
        try:
            resp = httpx.request(
                method,
                url,
                json=json_body,
                params=params,
                headers=headers,
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            log.error("whatsapp_network_error", error=str(exc))
            raise WhatsAppError("WhatsApp-Dienst nicht erreichbar.") from exc
        if resp.status_code >= 400:
            log.error(
                "whatsapp_http_error",
                status=resp.status_code,
                path=path,
                body=resp.text[:500],
            )
            raise WhatsAppError(_graph_error(resp), status_code=502)
        data = resp.json()
        return data if isinstance(data, dict) else {"data": data}
