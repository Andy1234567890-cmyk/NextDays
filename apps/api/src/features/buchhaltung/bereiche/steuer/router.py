"""Bereich »steuer« der Buchhaltung — Umsatzsteuer-Auswertung, eingefrorene
Meldungen, Export, Einnahmen-Ausgaben-Vorschau, Steuer-Parameter.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route trägt
`Leserecht`/`Schreibrecht` aus `...guards` (Rollen-Guard + Modul-Entitlement).

Bewusst KEINE ELSTER-Übertragung: es gibt weder Zertifikat noch ERiC. Statt
einer Attrappe „Übertragen" liefert der Bereich die Werte als JSON/CSV zum
Eintragen bzw. für den Steuerberater.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from ...guards import Leserecht, Schreibrecht
from .dependencies import SteuerServiceDep
from .schemas import (
    FreezeRequest,
    ProfitEstimateResponse,
    TaxReturnListResponse,
    TaxReturnResponse,
    TaxReturnUpdate,
    TaxSettingsResponse,
    TaxSettingsUpdate,
    VatReturnResponse,
)
from .service import SteuerError

router = APIRouter(tags=["buchhaltung"])

_Periode = Annotated[
    str, Query(min_length=4, max_length=8, description="YYYY-MM, YYYY-Qn oder YYYY")
]
_Jahr = Annotated[int, Query(ge=2000, le=2100)]
_Limit = Annotated[int, Query(ge=1, le=500)]


def _http(exc: SteuerError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/tax/vat-return", response_model=VatReturnResponse)
def vat_return(ctx: Leserecht, service: SteuerServiceDep, period: _Periode) -> VatReturnResponse:
    """Live-Auswertung einer Periode: Umsätze je Steuersatz, Vorsteuer, Zahllast."""
    try:
        return service.vat_return(ctx, period)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.post(
    "/tax/vat-return/freeze", response_model=TaxReturnResponse, status_code=status.HTTP_201_CREATED
)
def freeze_vat_return(
    body: FreezeRequest, ctx: Schreibrecht, service: SteuerServiceDep
) -> TaxReturnResponse:
    """Werte der Periode einfrieren (idempotent: gleicher Entwurf → dieselbe Zeile)."""
    try:
        return service.freeze(ctx, body)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.get("/tax/returns", response_model=TaxReturnListResponse)
def list_tax_returns(
    ctx: Leserecht, service: SteuerServiceDep, limit: _Limit = 100
) -> TaxReturnListResponse:
    try:
        return service.list_returns(ctx, limit=limit)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.get("/tax/returns/{return_id}", response_model=TaxReturnResponse)
def get_tax_return(return_id: str, ctx: Leserecht, service: SteuerServiceDep) -> TaxReturnResponse:
    try:
        return service.get_return(ctx, return_id)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.patch("/tax/returns/{return_id}", response_model=TaxReturnResponse)
def update_tax_return(
    return_id: str, body: TaxReturnUpdate, ctx: Schreibrecht, service: SteuerServiceDep
) -> TaxReturnResponse:
    try:
        return service.update_return(ctx, return_id, body)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.get("/tax/export/{return_id}.csv")
def export_tax_return_csv(return_id: str, ctx: Leserecht, service: SteuerServiceDep) -> Response:
    try:
        name, csv_text = service.export_csv(ctx, return_id)
    except SteuerError as exc:
        raise _http(exc) from exc
    return Response(
        content=csv_text.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/tax/export/{return_id}.json")
def export_tax_return_json(return_id: str, ctx: Leserecht, service: SteuerServiceDep) -> dict:
    try:
        return service.export_json(ctx, return_id)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.get("/tax/profit-estimate", response_model=ProfitEstimateResponse)
def profit_estimate(
    ctx: Leserecht, service: SteuerServiceDep, year: _Jahr
) -> ProfitEstimateResponse:
    """Einnahmen − Ausgaben je Monat, kumuliert; Steuerschätzung nur mit gesetzten Parametern."""
    try:
        return service.profit_estimate(ctx, year)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.get("/tax/settings", response_model=TaxSettingsResponse)
def get_tax_settings(ctx: Leserecht, service: SteuerServiceDep) -> TaxSettingsResponse:
    try:
        return service.get_settings(ctx)
    except SteuerError as exc:
        raise _http(exc) from exc


@router.put("/tax/settings", response_model=TaxSettingsResponse)
def put_tax_settings(
    body: TaxSettingsUpdate, ctx: Schreibrecht, service: SteuerServiceDep
) -> TaxSettingsResponse:
    try:
        return service.put_settings(ctx, body)
    except SteuerError as exc:
        raise _http(exc) from exc
