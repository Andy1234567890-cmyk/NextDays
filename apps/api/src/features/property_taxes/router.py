"""Router für property_taxes. Gemountet unter /api/v1/properties.

Steuern, die der Gastgeber je Objekt selbst festlegt und selbst abfuehrt.
Die Plattform behaelt nichts ein.

Berechtigung: MANAGE_PROPERTIES — das ist eine Objekteinstellung, die den
Gastpreis aendert, keine Finanzeinsicht. Jeder `{id}`-Endpunkt re-prueft
denselben Scope wie der List-Pfad (Wurzel 9).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import PropertyTaxServiceDep
from .schemas import PropertyTaxInput, PropertyTaxResponse
from .service import PropertyTaxError

router = APIRouter(prefix="/properties", tags=["property-taxes"])


def _fehler(exc: PropertyTaxError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get(
    "/{property_id}/taxes",
    response_model=list[PropertyTaxResponse],
    dependencies=[Depends(require_permission(Capability.MANAGE_PROPERTIES))],
)
def list_taxes(
    property_id: str, ctx: CurrentUser, service: PropertyTaxServiceDep
) -> list[PropertyTaxResponse]:
    """Alle Steuern eines Objekts."""
    try:
        return service.list(ctx, property_id)
    except PropertyTaxError as exc:
        raise _fehler(exc) from exc


@router.post(
    "/{property_id}/taxes",
    response_model=PropertyTaxResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Capability.MANAGE_PROPERTIES))],
)
def create_tax(
    property_id: str,
    daten: PropertyTaxInput,
    ctx: CurrentUser,
    service: PropertyTaxServiceDep,
) -> PropertyTaxResponse:
    """Eine Steuer anlegen."""
    try:
        return service.create(ctx, property_id, daten)
    except PropertyTaxError as exc:
        raise _fehler(exc) from exc


@router.put(
    "/taxes/{tax_id}",
    response_model=PropertyTaxResponse,
    dependencies=[Depends(require_permission(Capability.MANAGE_PROPERTIES))],
)
def update_tax(
    tax_id: str,
    daten: PropertyTaxInput,
    ctx: CurrentUser,
    service: PropertyTaxServiceDep,
) -> PropertyTaxResponse:
    """Eine Steuer ändern."""
    try:
        return service.update(ctx, tax_id, daten)
    except PropertyTaxError as exc:
        raise _fehler(exc) from exc


@router.delete(
    "/taxes/{tax_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(Capability.MANAGE_PROPERTIES))],
)
def delete_tax(
    tax_id: str, ctx: CurrentUser, service: PropertyTaxServiceDep
) -> None:
    """Eine Steuer entfernen."""
    try:
        service.delete(ctx, tax_id)
    except PropertyTaxError as exc:
        raise _fehler(exc) from exc
