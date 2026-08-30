"""Router für die Support-Diagnose. Gemountet unter /api/v1/diagnostics.

Drei Zugänge, streng getrennt:

  • /diagnostics/events        — Client meldet technische Ereignisse
  • /diagnostics/debug/*       — der KUNDE steuert seine Freigabe
  • /platform/diagnostics/*    — der SUPPORT liest (siehe platform_admin)

Der Support-Zugang liegt bewusst NICHT hier, sondern im platform_admin-Slice:
dort greifen der Backoffice-Guard und das Audit-Log.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from src.core.security import (
    CurrentPlatformAdmin,
    CurrentUser,
    require_platform_write,
)

from .dependencies import DiagnosticsServiceDep
from .schemas import DebugSession, DebugSessionStart, DiagnosticBatch

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.post("/events")
def report_events(
    batch: DiagnosticBatch,
    ctx: CurrentUser,
    service: DiagnosticsServiceDep,
) -> dict[str, int]:
    """Technische Ereignisse melden (Fehler, fehlgeschlagene Aufrufe).

    Läuft dauerhaft und ohne Einwilligung, weil ausschließlich Technisches
    erfasst wird — keine Eingaben, keine Inhalte, keine Aktivität. Einsehbar
    wird es für den Support erst mit einer Freigabe des Kunden.
    """
    n = service.record(
        batch,
        user_id=ctx.user_id,
        guest_id=None,
        tenant_id=ctx.tenant_id,
    )
    return {"gespeichert": n}


@router.post("/startabsturz")
def report_startabsturz(
    batch: DiagnosticBatch,
    service: DiagnosticsServiceDep,
) -> dict[str, int]:
    """Absturz beim App-Start melden — OHNE Anmeldung.

    WARUM OHNE ANMELDUNG:
    `/events` verlangt `CurrentUser`. Genau die Abstürze, die uns fehlen,
    passieren aber BEVOR die Anmeldung steht: „Die geht kurz an und
    verschwindet augenblicklich sofort wieder" (Beta-Tester, 30.08.2026). Ein
    Meldeweg, der ein gültiges Token voraussetzt, ist für diese Klasse Fehler
    wirkungslos — er bekommt sie per Konstruktion nie zu sehen.

    WAS DAS FÜR DIE SICHERHEIT HEISST:
    Die Route ist offen, also gilt sie als angreifbar (Wurzel 8). Deshalb:
    kein Konto, kein Tenant (`user_id`/`tenant_id` bleiben `None` — eine vom
    Client behauptete Identität wäre wertlos und irreführend), nur die
    technischen Arten, strenger Rate-Limit-Bucket `public_support` und
    dieselben Größengrenzen wie bei `/events` (Pydantic: max. 50 Ereignisse,
    500 Zeichen je Meldung, 16 KB Kontext).

    Die einwilligungspflichtigen Arten (`navigation`/`aktion`/`aufruf`) fallen
    hier IMMER weg: `record` verwirft sie ohne aktive Freigabe, und ohne
    Identität kann es keine geben (fail-closed, Wurzel 3).
    """
    n = service.record(batch, user_id=None, guest_id=None, tenant_id=None)
    return {"gespeichert": n}


@router.get("/debug", response_model=list[DebugSession])
def my_debug_sessions(
    ctx: CurrentUser, service: DiagnosticsServiceDep
) -> list[DebugSession]:
    """Die eigenen Diagnose-Freigaben (Transparenz für den Kunden)."""
    return service.my_sessions(user_id=ctx.user_id, guest_id=None)


@router.post("/debug", response_model=DebugSession)
def start_debug_session(
    req: DebugSessionStart,
    ctx: CurrentUser,
    service: DiagnosticsServiceDep,
) -> DebugSession:
    """Diagnose für den Support freigeben (zeitlich begrenzt).

    Nur der Kunde selbst kann das auslösen — es gibt bewusst keinen Weg, über
    den das Backoffice sich selbst Einsicht verschafft.
    """
    return service.start_session(
        req, user_id=ctx.user_id, guest_id=None, tenant_id=ctx.tenant_id
    )


@router.delete("/debug", status_code=204)
def end_debug_session(
    ctx: CurrentUser, service: DiagnosticsServiceDep
) -> None:
    """Freigabe sofort widerrufen."""
    service.end_session(user_id=ctx.user_id, guest_id=None)


@router.post("/purge")
def purge(
    ctx: CurrentPlatformAdmin,
    service: DiagnosticsServiceDep,
    tage: int = Query(30, ge=7, le=90),
) -> dict[str, int]:
    """Alte Diagnoseereignisse löschen (Aufbewahrungsgrenze).

    Das Löschen wirkt MANDANTENÜBERGREIFEND — es ist eine Plattform-
    Wartungsaufgabe, keine Betriebsfunktion. Mit `CurrentUser` konnte zuvor
    jeder eingeloggte Nutzer irgendeines Betriebs fremde Diagnosedaten
    löschen (Wurzel 3/9); deshalb Platform-Admin mit Schreibrecht.
    """
    require_platform_write(ctx)
    return {"geloescht": service.purge_old(tage=tage)}
