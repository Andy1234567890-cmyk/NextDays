"""Router für Schlösser. Gemountet unter /api/v1/schloesser.

BERECHTIGUNGEN — bewusst zwei verschiedene (Wurzel 9):

  MANAGE_CONNECTIONS  Verbindung herstellen/trennen, Geräte abgleichen.
                      Genau die Fähigkeit, deren Begründung in
                      `permissions.py` diesen Fall schon beschreibt: nicht
                      jeder mit Login darf ein fremdes Konto anbinden.
  MANAGE_CALENDAR     Zuordnung, Einstellungen, Zugänge. Wer Buchungen
                      verwaltet, verwaltet auch deren Zugang.

Der Türcode selbst ist ein Geheimnis wie `door_code` (0314). Er wird hier NUR
an Rollen ausgeliefert, die Buchungen verwalten — nie an eine Rolle, die ihn
nur „auch mal sehen" will. Ein Endpunkt, der ihn ohne
Autorisierungsprüfung (nur `get_current_user`) ausgibt, wäre der Fehler aus
Wurzel 9.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    EinstellungenSetzen,
    VerbindungStarten,
    VerbindungUebernehmen,
    ZuordnungAnlegen,
)
from .seam_client import SeamFehler
from .service import SchloesserService

router = APIRouter(prefix="/schloesser", tags=["schloesser"])
log = get_logger("nextdays.schloesser.router")


def get_service() -> SchloesserService:
    return SchloesserService(get_service_client())


ServiceDep = Annotated[SchloesserService, Depends(get_service)]
_verbindung = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_CONNECTIONS))
]
_kalender = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
]


def _seam_fehler(exc: SeamFehler) -> HTTPException:
    """Seam-Fehler in eine HTTP-Antwort übersetzen.

    Der Status kommt aus der Ausnahme, nicht pauschal 500 — ein nicht
    erreichbarer Dienst (503) ist etwas anderes als eine falsche Nutzlast
    (422), und der Kunde soll den Unterschied sehen.
    """
    return HTTPException(status_code=exc.status_code, detail=str(exc))


# =========================================================================
# Diagnose
# =========================================================================
@router.get("/pruefen")
def pruefen(ctx: _verbindung, service: ServiceDep) -> dict:
    """Prüft, ob der Seam-Schlüssel funktioniert — ohne ein Gerät anzufassen.

    Der Weg, den Seams Quick Start empfiehlt (`workspaces.get()`): billigster
    echter Aufruf, verrät zugleich Sandbox oder Produktion. Genau die Frage,
    die man beim Einrichten hat und sonst nur beantwortet, indem man etwas
    schreibt.

    Die Antwort trägt `istSandbox` bewusst nach außen: ein Betrieb, dessen
    Schlösser am Sandbox-Workspace hängen, bekommt Codes, die nichts öffnen —
    ein Fehler, der ohne diese Anzeige erst am verschlossenen Gast auffällt.
    """
    del ctx  # nur für die Berechtigungsprüfung
    try:
        return {"ok": True, **service.workspace_pruefen()}
    except SeamFehler as exc:
        # KEIN Fehlerstatus: „Schlüssel fehlt/falsch" ist hier die ANTWORT,
        # nicht ein Ausfall der Diagnose. Ein 503 würde die Oberfläche eine
        # Störung anzeigen lassen, obwohl die Prüfung sauber funktioniert hat.
        return {"ok": False, "grund": str(exc)}


# =========================================================================
# Verbindung
# =========================================================================
@router.get("/verbindungen")
def verbindungen_lesen(ctx: _verbindung, service: ServiceDep) -> list[dict]:
    return service.verbindungen_lesen(ctx.tenant_id)


@router.post("/verbindungen/start")
def verbindung_starten(
    daten: VerbindungStarten, ctx: _verbindung, service: ServiceDep
) -> dict:
    """Die Anmeldemaske des Herstellers öffnen (Seam Connect Webview).

    `ctx` steht hier für die Berechtigungsprüfung (MANAGE_CONNECTIONS), nicht
    als Datenquelle: der Aufruf legt noch keine Zeile an. Gescopet wird beim
    Übernehmen.
    """
    del ctx  # nur für die Berechtigungsprüfung, kein Datenbezug
    try:
        return service.verbindung_starten(str(daten.rueckkehr_url))
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc


@router.post("/verbindungen/uebernehmen")
def verbindung_uebernehmen(
    daten: VerbindungUebernehmen, ctx: _verbindung, service: ServiceDep
) -> dict:
    """Nach der Rückkehr aus dem Webview: Konto speichern und Geräte holen."""
    try:
        return service.verbindung_uebernehmen(ctx.tenant_id, daten.webview_id)
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc


@router.delete("/verbindungen/{connection_id}", status_code=204)
def verbindung_trennen(
    connection_id: str, ctx: _verbindung, service: ServiceDep
) -> None:
    service.verbindung_trennen(ctx.tenant_id, connection_id)


# =========================================================================
# Geräte
# =========================================================================
@router.get("/geraete")
def geraete_lesen(ctx: _kalender, service: ServiceDep) -> list[dict]:
    return service.geraete_lesen(ctx.tenant_id)


@router.post("/verbindungen/{connection_id}/abgleichen")
def geraete_abgleichen(
    connection_id: str, ctx: _verbindung, service: ServiceDep
) -> dict:
    """Geräte einer Verbindung neu von Seam holen."""
    try:
        anzahl = service.geraete_abgleichen(ctx.tenant_id, connection_id)
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc
    return {"anzahl": anzahl}


# =========================================================================
# Zuordnung
# =========================================================================
@router.post("/zuordnungen")
def zuordnen(
    daten: ZuordnungAnlegen, ctx: _kalender, service: ServiceDep
) -> dict:
    return service.zuordnen(
        ctx.tenant_id,
        daten.device_id,
        unit_id=daten.unit_id,
        building_id=daten.building_id,
    )


@router.delete("/zuordnungen/{zuordnung_id}", status_code=204)
def zuordnung_loesen(
    zuordnung_id: str, ctx: _kalender, service: ServiceDep
) -> None:
    service.zuordnung_loesen(ctx.tenant_id, zuordnung_id)


# =========================================================================
# Einstellungen je Objekt
# =========================================================================
@router.get("/objekte/{property_id}/einstellungen")
def einstellungen_lesen(
    property_id: str, ctx: _kalender, service: ServiceDep
) -> dict:
    return service.einstellungen_lesen(ctx.tenant_id, property_id)


@router.put("/objekte/{property_id}/einstellungen")
def einstellungen_setzen(
    property_id: str,
    daten: EinstellungenSetzen,
    ctx: _kalender,
    service: ServiceDep,
) -> dict:
    return service.einstellungen_setzen(
        ctx.tenant_id, property_id, daten.model_dump(exclude_none=True)
    )


# =========================================================================
# Zugänge
# =========================================================================
@router.get("/buchungen/{reservation_id}/zugang")
def zugang_lesen(
    reservation_id: str, ctx: _kalender, service: ServiceDep
) -> dict:
    """Der Zugang einer Buchung.

    Gibt bei fehlendem Zugang bewusst `{"vorhanden": false}` statt 404: „für
    diese Buchung gibt es keinen Code" ist eine gültige Antwort und kein
    Fehler — die meisten Betriebe haben keine Schlösser.
    """
    zugang = service.zugang_zu_buchung(ctx.tenant_id, reservation_id)
    if zugang is None:
        return {"vorhanden": False}
    return {"vorhanden": True, **zugang}


@router.post("/buchungen/{reservation_id}/zugang")
def zugang_planen(
    reservation_id: str, ctx: _kalender, service: ServiceDep
) -> dict:
    """Einen Zugang für diese Buchung vormerken bzw. sofort anlegen."""
    try:
        zugang = service.zugang_planen(ctx.tenant_id, reservation_id)
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc
    if zugang is None:
        return {"vorhanden": False}
    return {"vorhanden": True, **zugang}


@router.post("/zugaenge/{zugang_id}/anlegen")
def zugang_anlegen(
    zugang_id: str, ctx: _kalender, service: ServiceDep
) -> dict:
    """Einen geplanten Zugang jetzt an Seam geben (statt auf den Tick warten)."""
    try:
        return service.zugang_anlegen(ctx.tenant_id, zugang_id)
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc


@router.post("/buchungen/{reservation_id}/zugang/widerrufen")
def zugang_widerrufen(
    reservation_id: str, ctx: _kalender, service: ServiceDep
) -> dict:
    """Den Zugang zurückziehen.

    Achtung auf die Antwort: `status = nicht_widerrufbar` heißt, dass der Code
    NICHT weg ist und bis `endsAt` weiterläuft. Die Oberfläche muss diesen
    Fall anzeigen, nicht als Erfolg verbuchen.
    """
    try:
        ergebnis = service.zugang_widerrufen(ctx.tenant_id, reservation_id)
    except SeamFehler as exc:
        raise _seam_fehler(exc) from exc
    if ergebnis is None:
        return {"vorhanden": False}
    return {"vorhanden": True, **ergebnis}
