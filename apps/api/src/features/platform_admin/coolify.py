"""Coolify-Anbindung für den Deploy-Monitor im Backoffice.

WARUM ÜBER DIE API UND NICHT ÜBER COOLIFYS DATENBANK:
Die Deploy-Historie liegt in Coolifys eigener Postgres (`coolify-db`,
Tabelle `application_deployment_queue`). Direkt dort zu lesen wäre möglich,
koppelt uns aber an ein internes Schema, das jedes Coolify-Update ändern darf.
Die REST-API ist der zugesagte Vertrag — deshalb dieser Weg.

Live gegen Coolify 4.x / Laravel 12.61.1 geprüft (06.08.2026), die drei
genutzten Routen existieren:

    GET  /api/v1/deployments                        laufende Deploys
    GET  /api/v1/deployments/applications/{uuid}    Historie je Anwendung
    POST /api/v1/deploy?uuid={uuid}                 Deploy auslösen

`POST` ist Pflicht: seit Coolify 4.2.0 quittiert `GET /api/v1/deploy` mit
405 „endpoint changed to POST".

Ohne Token wird NICHT geraten und nichts Plausibles gefüllt — jeder Aufruf
schlägt mit 503 klar fehl (Wurzel 4).
"""
from __future__ import annotations

import json

import httpx
from fastapi import HTTPException, status

from src.core.config import get_settings

# Coolify baut ganze Images; die Historie kommt trotzdem schnell. Ein Deploy
# ANSTOSSEN antwortet sofort (er läuft asynchron weiter), deshalb reicht ein
# knapper Timeout für alle drei Aufrufe.
_TIMEOUT = httpx.Timeout(20.0)

# Wurzel 8: jede Liste bekommt eine harte Obergrenze.
MAX_EINTRAEGE = 100


def _basis_und_kopf() -> tuple[str, dict[str, str]]:
    """Adresse + Auth-Kopf, oder 503 wenn der Zugang fehlt."""
    einst = get_settings()
    if not einst.coolify_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Deploy-Monitor ist nicht eingerichtet: COOLIFY_API_URL und "
                "COOLIFY_TOKEN fehlen in der Server-Konfiguration."
            ),
        )
    # pylint sieht durch das Field(...) nur die FieldInfo, nicht den str-Wert,
    # den pydantic zur Laufzeit einsetzt (falscher no-member).
    basis = einst.coolify_api_url.strip().rstrip("/")  # pylint: disable=no-member
    kopf = {
        "Authorization": f"Bearer {einst.coolify_token.get_secret_value().strip()}",
        "Accept": "application/json",
    }
    return basis, kopf


def _fehler_uebersetzen(antwort: httpx.Response, was: str) -> None:
    """Coolify-Fehler in eine Meldung übersetzen, die im Backoffice etwas sagt.

    Fail-closed: alles außer 2xx wird zum Fehler, nichts wird stillschweigend
    als leere Liste ausgegeben (Wurzel 5).
    """
    if antwort.is_success:
        return
    if antwort.status_code in (401, 403):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{was}: Coolify lehnt den Token ab ({antwort.status_code}).",
        )
    if antwort.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{was}: In Coolify nicht gefunden.",
        )
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"{was}: Coolify antwortete mit HTTP {antwort.status_code}.",
    )


def _holen(pfad: str, was: str) -> list | dict:
    basis, kopf = _basis_und_kopf()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.get(f"{basis}{pfad}", headers=kopf)
    except httpx.HTTPError as fehler:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{was}: Coolify nicht erreichbar.",
        ) from fehler
    _fehler_uebersetzen(antwort, was)
    return antwort.json()


def laufende_deploys() -> list[dict]:
    """Was gerade baut oder in der Warteschlange steht."""
    daten = _holen("/api/v1/deployments", "Laufende Deploys")
    return daten if isinstance(daten, list) else []


def verlauf(anwendung_uuid: str, limit: int = 20) -> list[dict]:
    """Die letzten Deploys EINER Anwendung, neueste zuerst."""
    limit = max(1, min(MAX_EINTRAEGE, limit))
    daten = _holen(
        f"/api/v1/deployments/applications/{anwendung_uuid}?take={limit}",
        "Deploy-Verlauf",
    )
    if isinstance(daten, dict):
        # Coolify verpackt die Historie je nach Version in `deployments`.
        daten = daten.get("deployments", [])
    return daten if isinstance(daten, list) else []


def build_log(deployment_uuid: str) -> tuple[str, list[dict]]:
    """Das Build-Log EINES Deploys, Zeile für Zeile.

    Eigener Token: Coolify blendet `logs` aus, solange der Token nicht
    `read:sensitive` hat (`ApiSensitiveData`-Middleware). Diese Berechtigung
    öffnet aber auch Webhook-Secrets und Cloud-Provider-Token — deshalb liest
    hier ein GETRENNTER Token, der seinerseits nicht deployen darf.

    Rohformat je Zeile (live gemessen 06.08.2026):
    `{command, output, type, timestamp, hidden, batch}`.
    """
    einst = get_settings()
    if not einst.coolify_logs_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Build-Logs sind nicht eingerichtet: COOLIFY_LOG_TOKEN fehlt "
                "in der Server-Konfiguration."
            ),
        )
    basis = einst.coolify_api_url.strip().rstrip("/")  # pylint: disable=no-member
    kopf = {
        "Authorization": f"Bearer {einst.coolify_log_token.get_secret_value().strip()}",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.get(
                f"{basis}/api/v1/deployments/{deployment_uuid}", headers=kopf
            )
    except httpx.HTTPError as fehler:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Build-Log: Coolify nicht erreichbar.",
        ) from fehler
    _fehler_uebersetzen(antwort, "Build-Log")
    daten = antwort.json()
    if not isinstance(daten, dict):
        return ("unbekannt", [])
    zustand = str(daten.get("status") or "unbekannt")
    roh = daten.get("logs")
    if not roh:
        # Kein Log da (z. B. Deploy gerade erst gestartet) ist KEIN Fehler.
        return (zustand, [])
    if isinstance(roh, str):
        try:
            roh = json.loads(roh)
        except ValueError:
            # Coolify liefert im Ausnahmefall reinen Text statt JSON.
            return (zustand, [{"output": roh, "type": "stdout", "timestamp": None}])
    return (zustand, roh if isinstance(roh, list) else [])


def deploy_ausloesen(anwendung_uuid: str) -> dict:
    """Einen Deploy anstoßen. Antwortet sofort; der Bau läuft asynchron."""
    basis, kopf = _basis_und_kopf()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.post(
                f"{basis}/api/v1/deploy",
                params={"uuid": anwendung_uuid},
                headers=kopf,
            )
    except httpx.HTTPError as fehler:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Deploy auslösen: Coolify nicht erreichbar.",
        ) from fehler
    _fehler_uebersetzen(antwort, "Deploy auslösen")
    ergebnis = antwort.json()
    return ergebnis if isinstance(ergebnis, dict) else {"ergebnis": ergebnis}
