"""Bereich »datev« der Buchhaltung — EXTF-CSV-Export für den Steuerberater.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Guards aus
`...guards` (`Leserecht`/`Schreibrecht` = Rollen-Guard + Modul-3-Entitlement).

Rate-Limit: `POST /datev/export` und `/datev/export/vorschau` sind teuer (bis
20.000 Zeilen je Tabelle, Datei bauen, Bucket schreiben). Der Pfad gehört in
den strengen `ai`-Eimer der Middleware (`core/ratelimit_middleware._AI_PATHS`,
20/60) — die Eintragung liegt außerhalb dieses Bereichs und steht im BERICHT
als Koordinator-Aufgabe. Die Idempotenz (gleicher Inhalt = bestehender Lauf)
begrenzt den Schaden eines Doppelklicks unabhängig davon.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import DatevServiceDep
from .schemas import (
    DatevSettingsResponse,
    DatevSettingsUpdate,
    ExportAnfrage,
    ExportResponse,
    Vorschau,
)
from .service import MIME_CSV, DatevError

router = APIRouter(tags=["buchhaltung"])


def _http(exc: DatevError) -> HTTPException:
    """422 mit Feldliste/Problemliste als strukturiertes `detail`, damit die
    Oberfläche sie anzeigen kann, statt sie aus dem Text zu raten."""
    detail: object = exc.message
    if exc.details:
        detail = {"message": exc.message, **exc.details}
    return HTTPException(status_code=exc.status_code, detail=detail)


@router.get("/datev/settings", response_model=DatevSettingsResponse)
def get_settings(ctx: Leserecht, service: DatevServiceDep) -> DatevSettingsResponse:
    try:
        return service.get_settings(ctx)
    except DatevError as exc:
        raise _http(exc) from exc


@router.put("/datev/settings", response_model=DatevSettingsResponse)
def put_settings(
    body: DatevSettingsUpdate, ctx: Schreibrecht, service: DatevServiceDep
) -> DatevSettingsResponse:
    try:
        return service.put_settings(ctx, body)
    except DatevError as exc:
        raise _http(exc) from exc


@router.post("/datev/export/vorschau", response_model=Vorschau)
def export_vorschau(body: ExportAnfrage, ctx: Leserecht, service: DatevServiceDep) -> Vorschau:
    """Anzahl je Belegart + Probleme, ohne etwas zu schreiben."""
    try:
        return service.vorschau(ctx, body)
    except DatevError as exc:
        raise _http(exc) from exc


@router.post("/datev/export", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
def export_erstellen(
    body: ExportAnfrage, ctx: Schreibrecht, service: DatevServiceDep
) -> ExportResponse:
    """Erzeugt die EXTF-Datei, legt sie im privaten Bucket ab und protokolliert
    den Lauf. Gleicher Zeitraum + Inhalt → der bestehende Lauf (201 bleibt,
    `wiederverwendet=true`)."""
    try:
        return service.export(ctx, body)
    except DatevError as exc:
        raise _http(exc) from exc


@router.get("/datev/exports", response_model=list[ExportResponse])
def list_exports(
    ctx: Leserecht,
    service: DatevServiceDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[ExportResponse]:
    try:
        return service.list_exports(ctx, limit=limit)
    except DatevError as exc:
        raise _http(exc) from exc


@router.get("/datev/exports/{export_id}/download")
def download_export(export_id: str, ctx: Leserecht, service: DatevServiceDep) -> Response:
    """Streamt die Datei aus dem privaten Bucket (tenant-geprüft). Windows-1252,
    damit DATEV sie direkt einliest."""
    try:
        inhalt, dateiname = service.download(ctx, export_id)
    except DatevError as exc:
        raise _http(exc) from exc
    return Response(
        content=inhalt,
        media_type=f"{MIME_CSV}; charset=windows-1252",
        headers={
            "Content-Disposition": f'attachment; filename="{dateiname}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
