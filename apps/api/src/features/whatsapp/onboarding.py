"""Kunden-Onboarding im Tech-Provider-Modell (WhatsApp Embedded Signup).

Ablauf, wie Meta ihn vorgibt:
 1. Der Betrieb klickt bei uns „WhatsApp verbinden" und landet auf Metas
    gehosteter Embedded-Signup-Seite (Facebook Login for Business).
 2. Er wählt/erstellt Business-Portfolio und WABA und registriert seine Nummer.
 3. Meta ruft unsere Redirect-URI mit einem ``code`` auf. Dieser Code lebt nur
    etwa 30 Sekunden — er wird deshalb SOFORT serverseitig getauscht, nicht in
    einem Job.
 4. Aus dem Tausch kommt ein Business-Integration-System-User-Token, das
    ausschließlich auf die WABA dieses Kunden zeigt.
 5. Wir fragen bei Meta, WELCHE WABA das Token freischaltet (debug_token →
    granular_scopes). Die WABA-ID kommt bewusst NICHT vom Client: sonst könnte
    jemand im Callback eine fremde WABA unterschieben (Wurzel 3).
 6. Unsere App wird für die Webhooks dieser WABA registriert — ohne das kommt
    keine Nachricht dieses Kunden an.
 7. Zeile in ``whatsapp_account`` schreiben (Token liegt dort, nur service_role
    kommt daran — Wurzel 6, Migration 0255).
 8. Unser Vorlagensatz wird in die neue WABA ausgerollt (Meta hat keinen
    Bulk-Push über mehrere WABAs).

Kosten-Hinweis für die UI: Im Tech-Provider-Modell zahlt der BETRIEB Meta
direkt und muss dort selbst eine Zahlungsmethode hinterlegen. Fehlt sie, ist
``health_status.can_send_message`` = BLOCKED (Meta-Fehler 141006) und
business-initiierte Nachrichten sind gesperrt — das lesen wir beim Onboarding
aus und schreiben es in ``send_block_reason``, statt es später zu erraten.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger

from .client import WhatsAppClient, WhatsAppError
from .templates import rollout

log = get_logger("nextdays.whatsapp.onboarding")

# Die Scopes, aus deren target_ids die WABA-ID des Kunden hervorgeht.
_WABA_SCOPES = ("whatsapp_business_management", "whatsapp_business_messaging")


class OnboardingError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _waba_id_aus_token(debug: dict[str, Any]) -> str:
    """WABA-ID aus der Token-Auskunft ziehen — nie aus dem Request.

    Meta liefert sie in ``granular_scopes[].target_ids``. Steht dort keine oder
    mehr als eine, wird abgebrochen statt eine ausgewählt: eine falsche Zuordnung
    würde fremde Gästenachrichten in den falschen Betrieb schreiben.
    """
    daten = debug.get("data") if isinstance(debug.get("data"), dict) else debug
    ids: set[str] = set()
    for scope in daten.get("granular_scopes") or []:
        if scope.get("scope") in _WABA_SCOPES:
            for ziel in scope.get("target_ids") or []:
                if isinstance(ziel, str):
                    ids.add(ziel)
    if not ids:
        raise OnboardingError(
            "Meta hat kein WhatsApp-Konto zu dieser Freigabe geliefert. "
            "Bitte den Verbindungsvorgang erneut starten.",
            status_code=422,
        )
    if len(ids) > 1:
        # Kein Raten: mehrere WABAs an einem Kundentoken sind nicht vorgesehen.
        log.error("onboarding_mehrere_wabas", anzahl=len(ids))
        raise OnboardingError(
            "Die Freigabe umfasst mehrere WhatsApp-Konten. Bitte nur ein Konto "
            "freigeben.",
            status_code=422,
        )
    return ids.pop()


def _sendesperre(health: dict[str, Any]) -> tuple[bool | None, str | None]:
    """`can_send_message` und den Grund einer Sperre aus health_status lesen.

    Rückgabe ``(None, None)``, wenn Meta nichts liefert — dann ist der Zustand
    unbekannt und darf nicht als „darf senden" gedeutet werden (Wurzel 4).
    """
    status = health.get("health_status")
    if not isinstance(status, dict):
        return None, None
    darf = status.get("can_send_message")
    gruende: list[str] = []
    for eintrag in status.get("entities") or []:
        for fehler in eintrag.get("errors") or []:
            code = fehler.get("error_code")
            text = fehler.get("error_description") or ""
            gruende.append(f"{code}: {text}" if code else text)
    if darf == "AVAILABLE":
        return True, None
    if darf in ("BLOCKED", "LIMITED"):
        return False, " | ".join(g for g in gruende if g) or str(darf)
    return None, None


class WhatsAppOnboarding:
    """Tauscht den Embedded-Signup-Code ein und richtet den Kanal ein."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def verbinden(self, tenant_id: str, code: str) -> dict[str, Any]:
        """Den kompletten Onboarding-Schritt für einen Betrieb ausführen.

        Idempotent (Wurzel 2): ein zweiter Aufruf mit einem neuen Code
        aktualisiert die vorhandene Zeile statt eine zweite anzulegen — der
        Betrieb hat genau ein WhatsApp-Konto (unique auf tenant_id).
        """
        settings = get_settings()
        app_id = settings.whatsapp_app_id
        app_secret = settings.whatsapp_app_secret.get_secret_value()
        if not app_id or not app_secret:
            raise OnboardingError(
                "WhatsApp-Onboarding ist nicht konfiguriert "
                "(WHATSAPP_APP_ID / WHATSAPP_APP_SECRET fehlt).",
                status_code=503,
            )
        client = WhatsAppClient()
        try:
            token = client.exchange_code(code, app_id=app_id, app_secret=app_secret)
            debug = client.debug_token(token, app_id=app_id, app_secret=app_secret)
            waba_id = _waba_id_aus_token(debug)
            # Erst ab hier haben wir eine belegte WABA — jetzt Webhooks anmelden.
            client.subscribe_app_to_waba(waba_id, token=token)
            nummern = client.phone_numbers(waba_id, token=token)
            health = client.waba_health(waba_id, token=token)
        except WhatsAppError as exc:
            raise OnboardingError(exc.message, status_code=exc.status_code) from exc

        if not nummern:
            raise OnboardingError(
                "Im WhatsApp-Konto ist noch keine Telefonnummer registriert. "
                "Bitte den Verbindungsvorgang mit einer Nummer abschließen.",
                status_code=422,
            )
        nummer = nummern[0]
        darf_senden, sperrgrund = _sendesperre(health)
        ablauf = self._ablauf(debug)

        zeile = {
            "tenant_id": tenant_id,
            "waba_id": waba_id,
            "phone_number_id": str(nummer.get("id") or ""),
            "display_phone_number": nummer.get("display_phone_number"),
            "verified_name": nummer.get("verified_name"),
            "access_token": token,
            "token_expires_at": ablauf,
            "can_send_message": darf_senden,
            "send_block_reason": sperrgrund,
            "quality_rating": nummer.get("quality_rating"),
            "messaging_limit_tier": nummer.get("messaging_limit_tier"),
            "status": "connected",
            "connected_at": datetime.now(UTC).isoformat(),
        }
        self._db.table("whatsapp_account").upsert(
            zeile, on_conflict="tenant_id"
        ).execute()
        log.info(
            "whatsapp_onboarding_verbunden",
            tenant_id=tenant_id,
            waba_id=waba_id,
            can_send_message=darf_senden,
        )

        # Vorlagen ausrollen. Scheitert das, ist der Kanal trotzdem verbunden —
        # die Vorlagen lassen sich nachziehen. Deshalb nur protokollieren und im
        # Ergebnis melden, nicht das Onboarding kippen (Wurzel 5: der Hauptpfad
        # bleibt stehen, das Signal geht nicht verloren).
        vorlagen: dict[str, Any] = {}
        try:
            vorlagen = rollout(
                WhatsAppClient(access_token=token, waba_id=waba_id)
            )
        except WhatsAppError as exc:  # noqa: BLE001 — best effort, siehe oben
            log.warning("template_rollout_fehlgeschlagen", grund=exc.message)
            vorlagen = {"fehler": [exc.message]}

        return {
            "waba_id": waba_id,
            "phone_number_id": zeile["phone_number_id"],
            "display_phone_number": zeile["display_phone_number"],
            "can_send_message": darf_senden,
            "send_block_reason": sperrgrund,
            "templates": vorlagen,
        }

    @staticmethod
    def _ablauf(debug: dict[str, Any]) -> str | None:
        """Ablaufzeitpunkt des Tokens, falls Meta einen nennt.

        ``expires_at = 0`` heißt „läuft nicht ab" (System-User-Token) — dann
        bleibt das Feld leer statt 1970 zu speichern.
        """
        daten = debug.get("data") if isinstance(debug.get("data"), dict) else debug
        wert = daten.get("expires_at")
        if not isinstance(wert, int) or wert <= 0:
            return None
        return datetime.fromtimestamp(wert, tz=UTC).isoformat()
