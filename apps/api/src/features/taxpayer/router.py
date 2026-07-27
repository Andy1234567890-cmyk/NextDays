"""Router für taxpayer. Gemountet unter /api/v1/taxpayer.

Steuerzahler-Angaben des Betriebs (DAC7/PStTG). Scope über ctx.tenant_id im
Service (Wurzel 3/9). Schreiben verlangt `manage_billing` — Steuerdaten gehören
nicht in die Hand von staff/cleaner (Wurzel 9, §4.3 Rollen-Datensplit).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import TaxpayerServiceDep
from .schemas import TaxpayerCreate, TaxpayerEntry, TaxpayerOverview
from .service import TaxpayerError

router = APIRouter(prefix="/taxpayer", tags=["taxpayer"])


def _fehler(exc: TaxpayerError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get(
    "",
    response_model=TaxpayerOverview,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def get_overview(
    ctx: CurrentUser, service: TaxpayerServiceDep
) -> TaxpayerOverview:
    """Eintraege, fehlende Laender (aus den Objekten abgeleitet) und USt-IdNr."""
    try:
        return service.overview(ctx)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.put(
    "",
    response_model=TaxpayerEntry,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def upsert_entry(
    daten: TaxpayerCreate, ctx: CurrentUser, service: TaxpayerServiceDep
) -> TaxpayerEntry:
    """Angaben für ein Land anlegen oder ersetzen (Selbstauskunft)."""
    try:
        return service.upsert(ctx, daten)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.delete(
    "/{country}",
    status_code=204,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def delete_entry(
    country: str, ctx: CurrentUser, service: TaxpayerServiceDep
) -> None:
    """Angaben eines Landes entfernen."""
    try:
        service.delete(ctx, country)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc
