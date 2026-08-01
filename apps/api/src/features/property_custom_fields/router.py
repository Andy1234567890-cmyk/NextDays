"""Router für property_custom_fields. Gemountet unter /api/v1/property-fields.

Betriebs-eigene Zusatzfelder für Objekte (Migration 0242). Definitionen gehören
dem Betrieb, Werte dem einzelnen Objekt.

Autorisierung: ALLE Wege verlangen MANAGE_PROPERTIES — auch die Lesewege
(Wurzel 9: Item-Level prüft denselben Scope wie die Liste). Zusatzfelder tragen
im Alltag Betriebsinterna (Schlüsselkästen, Dienstleister, Codes); staff/cleaner
und owner haben darauf keinen Zugriff. Der Tenant-Scope steckt serverseitig in
ctx.tenant_id, nie in einem Client-Parameter.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import PropertyCustomFieldServiceDep
from .schemas import (
    CustomField,
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldValueUpdate,
    CustomFieldWithValue,
)
from .service import CustomFieldError

router = APIRouter(prefix="/property-fields", tags=["property-fields"])

_Ctx = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_PROPERTIES))
]


def _fehler(exc: CustomFieldError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("", response_model=list[CustomField])
def list_fields(
    ctx: _Ctx, service: PropertyCustomFieldServiceDep
) -> list[CustomField]:
    """Alle Zusatzfeld-Definitionen des Betriebs (sortiert)."""
    try:
        return service.list_fields(ctx)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc


@router.post("", response_model=CustomField, status_code=status.HTTP_201_CREATED)
def create_field(
    req: CustomFieldCreate, ctx: _Ctx, service: PropertyCustomFieldServiceDep
) -> CustomField:
    try:
        return service.create_field(ctx, req)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc


@router.patch("/{field_id}", response_model=CustomField)
def update_field(
    field_id: str,
    req: CustomFieldUpdate,
    ctx: _Ctx,
    service: PropertyCustomFieldServiceDep,
) -> CustomField:
    try:
        return service.update_field(ctx, field_id, req)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(
    field_id: str, ctx: _Ctx, service: PropertyCustomFieldServiceDep
) -> None:
    try:
        service.delete_field(ctx, field_id)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc


@router.get("/values/{property_id}", response_model=list[CustomFieldWithValue])
def list_values(
    property_id: str, ctx: _Ctx, service: PropertyCustomFieldServiceDep
) -> list[CustomFieldWithValue]:
    """Alle Felder des Betriebs MIT dem Wert dieses Objekts (auch leere)."""
    try:
        return service.list_values(ctx, property_id)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc


@router.put(
    "/values/{property_id}/{field_id}", response_model=CustomFieldWithValue
)
def set_value(
    property_id: str,
    field_id: str,
    req: CustomFieldValueUpdate,
    ctx: _Ctx,
    service: PropertyCustomFieldServiceDep,
) -> CustomFieldWithValue:
    """Wert eines Zusatzfelds an einem Objekt setzen (null löscht ihn)."""
    try:
        return service.set_value(ctx, property_id, field_id, req.value)
    except CustomFieldError as exc:
        raise _fehler(exc) from exc
