"""Routen der Stempel-Terminals (0544, Vertrag §3.2).

ZWEI AUTH-WELTEN in einer Datei, bewusst nebeneinander:

* `/terminals…` — die Verwaltung. Nutzer-JWT, Guard `MANAGE_PERSONAL`.
* `/terminal/…` — das Gerät. KEIN Nutzer-JWT, sondern der Header
  `X-Terminal-Token`. Der Bildschirm an der Rezeption ist öffentlich; ein
  Nutzer-Login dort wäre ein Dauer-Login für jeden, der vorbeigeht. Die Person
  weist sich mit Stempel-ID und PIN aus, das Gerät mit seinem Token.

Fail-closed (Wurzel 5): fehlt der Header, ist das Gerät unbekannt, inaktiv oder
sind die Terminals im Betrieb ausgeschaltet, kommt 401 — nie ein Durchlassen
„weil sonst nichts geht". Der Token wird nie geloggt.

Rate-Limit (Wurzel 8): der Gerätepfad hat einen EIGENEN Eimer
(`personal_terminal`), nicht den Standard — er ist von außen erreichbar und
darf keinen der App-Eimer aufbrauchen.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Response, status

from ._base import PersonalError
from ._guards import Manage, fehler
from .dependencies import TerminalServiceDep
from .schemas import Zeiterfassung
from .terminal import TerminalError
from .terminal_schemas import (
    Terminal,
    TerminalCreate,
    TerminalInfo,
    TerminalMitToken,
    TerminalStatus,
    TerminalStatusRequest,
    TerminalStempeln,
    TerminalToken,
    TerminalUpdate,
    TerminalZugang,
    TerminalZugangSet,
)

router = APIRouter()


def _geraet_fehler(exc: TerminalError) -> HTTPException:
    detail: object = exc.message
    if exc.details:
        detail = {"message": exc.message, **exc.details}
    return HTTPException(status_code=exc.status_code, detail=detail)


# --- Verwaltung (Nutzer-JWT, MANAGE_PERSONAL) -------------------------------


@router.get("/terminals", response_model=list[Terminal])
def terminals(ctx: Manage, service: TerminalServiceDep) -> list[Terminal]:
    try:
        return service.liste(ctx)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/terminals", response_model=TerminalMitToken, status_code=201)
def terminal_anlegen(
    req: TerminalCreate, ctx: Manage, service: TerminalServiceDep
) -> TerminalMitToken:
    """Das Token steht NUR in dieser Antwort — danach existiert nur der Hash."""
    try:
        return service.anlegen(ctx, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.patch("/terminals/{terminal_id}", response_model=Terminal)
def terminal_aendern(
    terminal_id: str, req: TerminalUpdate, ctx: Manage, service: TerminalServiceDep
) -> Terminal:
    try:
        return service.aendern(ctx, terminal_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/terminals/{terminal_id}/token", response_model=TerminalToken)
def terminal_token_rotieren(
    terminal_id: str, ctx: Manage, service: TerminalServiceDep
) -> TerminalToken:
    """Neues Token; das alte Gerät ist damit sofort ausgesperrt."""
    try:
        return service.token_rotieren(ctx, terminal_id)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.delete("/terminals/{terminal_id}", status_code=status.HTTP_204_NO_CONTENT)
def terminal_loeschen(
    terminal_id: str, ctx: Manage, service: TerminalServiceDep
) -> Response:
    try:
        service.loeschen(ctx, terminal_id)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/mitarbeiter/{user_id}/terminal-zugang", response_model=TerminalZugang)
def terminal_zugang_setzen(
    user_id: str, req: TerminalZugangSet, ctx: Manage, service: TerminalServiceDep
) -> TerminalZugang:
    """Stempel-ID und PIN der Person; die PIN wird nur als Hash gespeichert."""
    try:
        return service.zugang_setzen(ctx, user_id, req)
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.delete(
    "/mitarbeiter/{user_id}/terminal-zugang", status_code=status.HTTP_204_NO_CONTENT
)
def terminal_zugang_entfernen(
    user_id: str, ctx: Manage, service: TerminalServiceDep
) -> Response:
    try:
        service.zugang_entfernen(ctx, user_id)
    except PersonalError as exc:
        raise fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Gerätepfad (X-Terminal-Token, KEIN Nutzer-JWT) -------------------------


@router.get("/terminal/info", response_model=TerminalInfo)
def terminal_info(
    service: TerminalServiceDep,
    x_terminal_token: Annotated[str | None, Header()] = None,
) -> TerminalInfo:
    """Kopfdaten des Bildschirms: Gerät, Betrieb, Wetter heute."""
    try:
        geraet = service.geraet_pruefen(x_terminal_token)
        return service.info(geraet)
    except TerminalError as exc:
        raise _geraet_fehler(exc) from exc
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/terminal/status", response_model=TerminalStatus)
def terminal_status(
    req: TerminalStatusRequest,
    service: TerminalServiceDep,
    x_terminal_token: Annotated[str | None, Header()] = None,
) -> TerminalStatus:
    """Wer ist das, läuft schon eine Stempelung, was steht heute an?

    Zeigt nur Anzeigename und Zeiten — keine Akte, kein Lohn (§4.3).
    """
    try:
        geraet = service.geraet_pruefen(x_terminal_token)
        return service.status(geraet, req.stempel_id)
    except TerminalError as exc:
        raise _geraet_fehler(exc) from exc
    except PersonalError as exc:
        raise fehler(exc) from exc


@router.post("/terminal/stempeln", response_model=Zeiterfassung)
def terminal_stempeln(
    req: TerminalStempeln,
    service: TerminalServiceDep,
    x_terminal_token: Annotated[str | None, Header()] = None,
) -> Zeiterfassung:
    """Start, Pause, Pause-Ende oder Ende — nach PIN-Prüfung.

    Fünf Fehlversuche je Stempel-ID sperren sie 15 Minuten (423).
    """
    try:
        geraet = service.geraet_pruefen(x_terminal_token)
        return service.stempeln(geraet, req)
    except TerminalError as exc:
        raise _geraet_fehler(exc) from exc
    except PersonalError as exc:
        raise fehler(exc) from exc


__all__ = ["router"]
