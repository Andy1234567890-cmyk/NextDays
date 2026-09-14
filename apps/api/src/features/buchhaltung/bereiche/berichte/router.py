"""Bereich »berichte« der Buchhaltung — Auswertungen aus dem Belegbestand.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Alles GET,
alles `Leserecht` (Rollen-Guard + Modul 3). Zeitraum ist Pflicht (`from`/`to`,
höchstens 366 Tage → 422); die GuV nimmt `year`. Der CSV-Export streamt mit
Zeilen-Deckel.
"""

from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ...guards import Leserecht
from .dependencies import BerichteServiceDep
from .schemas import (
    Aufschluesselung,
    Berichtsart,
    BwaResponse,
    Gruppierung,
    GuvResponse,
    OpenItemsResponse,
    OverviewResponse,
    RevenueResponse,
    SusaResponse,
)
from .service import BerichteError

router = APIRouter(tags=["buchhaltung"])

# `from`/`to` sind in Python reserviert bzw. unhandlich — als Alias gebunden.
_Von = Annotated[date | None, Query(alias="from")]
_Bis = Annotated[date | None, Query(alias="to")]
_Jahr = Annotated[int, Query(ge=2000, le=2100)]
_Group = Annotated[Gruppierung, Query()]
_By = Annotated[Aufschluesselung | None, Query()]


def _http(exc: BerichteError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/reports/overview", response_model=OverviewResponse)
def report_overview(
    ctx: Leserecht,
    service: BerichteServiceDep,
    von: _Von = None,
    bis: _Bis = None,
) -> OverviewResponse:
    """Kennzahlen des Zeitraums: Umsatz, Forderungen, Ausgaben, Ergebnis, Top-Kunden."""
    try:
        return service.overview(ctx, von, bis)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/revenue", response_model=RevenueResponse)
def report_revenue(
    ctx: Leserecht,
    service: BerichteServiceDep,
    von: _Von = None,
    bis: _Bis = None,
    group: _Group = "month",
    by: _By = None,
) -> RevenueResponse:
    """Umsatz-Zeitreihe, optional aufgeschlüsselt nach Kunde/Objekt/Kanal."""
    try:
        return service.revenue(ctx, von, bis, group, by)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/bwa", response_model=BwaResponse)
def report_bwa(
    ctx: Leserecht,
    service: BerichteServiceDep,
    von: _Von = None,
    bis: _Bis = None,
) -> BwaResponse:
    """Betriebswirtschaftliche Auswertung mit gleich langer Vorperiode."""
    try:
        return service.bwa(ctx, von, bis)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/susa", response_model=SusaResponse)
def report_susa(
    ctx: Leserecht,
    service: BerichteServiceDep,
    von: _Von = None,
    bis: _Bis = None,
) -> SusaResponse:
    """Summen- und Saldenliste je Buchungskonto."""
    try:
        return service.susa(ctx, von, bis)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/guv", response_model=GuvResponse)
def report_guv(ctx: Leserecht, service: BerichteServiceDep, year: _Jahr) -> GuvResponse:
    """Gewinn- und Verlustrechnung eines Kalenderjahres."""
    try:
        return service.guv(ctx, year)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/open-items", response_model=OpenItemsResponse)
def report_open_items(ctx: Leserecht, service: BerichteServiceDep) -> OpenItemsResponse:
    """OP-Liste Debitoren zum heutigen Stichtag mit Alterungsstruktur."""
    try:
        return service.open_items(ctx)
    except BerichteError as exc:
        raise _http(exc) from exc


@router.get("/reports/export.csv")
def report_export_csv(
    ctx: Leserecht,
    service: BerichteServiceDep,
    report: Annotated[Berichtsart, Query()],
    von: _Von = None,
    bis: _Bis = None,
    group: _Group = "month",
    by: _By = None,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> StreamingResponse:
    """CSV-Stream eines Berichts (Semikolon, UTF-8 mit BOM), gedeckelt.

    Die Berechnung läuft VOR dem ersten Byte — ein Zeitraum- oder
    Währungsfehler kommt so als 422 an, nicht als abgebrochener Stream.
    """
    try:
        zeilen: Iterator[str] = service.export_csv(ctx, report, von, bis, group, by, year)
        erste = next(zeilen)
    except BerichteError as exc:
        raise _http(exc) from exc

    def _strom() -> Iterator[str]:
        yield erste
        yield from zeilen

    stichtag = datetime.now(UTC).date().isoformat()
    return StreamingResponse(
        _strom(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="bericht-{report}-{stichtag}.csv"',
            "Cache-Control": "no-store",
        },
    )
