"""Router für die Rabatt-/Deal-Engine. Gemountet unter /api/v1/pricing/discounts.

Die Rabattregeln sind Preis-/Vertriebs-Konfiguration → dasselbe Gating wie die
Raten (MANAGE_PROPERTY_SETTINGS). Owner (read-only §4.2) und staff/cleaner haben
diese Permission nicht → sehen/ändern die Rabatte nicht (Wurzel 9).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .schemas import (
    DiscountApplyRequest,
    DiscountApplyResponse,
    DiscountCreate,
    DiscountLibraryResponse,
    DiscountResponse,
    DiscountUpdate,
    SliceHealth,
)
from .service import DiscountError, PropertyDiscountsService

router = APIRouter(prefix="/pricing/discounts", tags=["property_discounts"])


def get_service() -> PropertyDiscountsService:
    return PropertyDiscountsService(service_client=get_service_client())


ServiceDep = Annotated[PropertyDiscountsService, Depends(get_service)]
_manage = Annotated[
    AuthContext,
    Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
]


@router.get("/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return SliceHealth(**service.health())


@router.get("/{property_id}", response_model=list[DiscountResponse])
def list_discounts(
    property_id: str, service: ServiceDep, ctx: _manage
) -> list[DiscountResponse]:
    """Alle Rabattregeln eines Objekts (Host-Konfiguration)."""
    try:
        return service.list_for_property(ctx, property_id)
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{property_id}/library", response_model=DiscountLibraryResponse)
def discount_library(
    property_id: str, service: ServiceDep, ctx: _manage
) -> DiscountLibraryResponse:
    """Bestehende Promotions des Betriebs, übernehmbar auf dieses Objekt.

    Speist den Auswahlschritt vor dem Formular („neue oder bestehende
    Promotion"). Übernommen wird anschließend über
    `POST /{quell_objekt}/{promotion}/apply` mit diesem Objekt als Ziel — es gibt
    genau EINEN Schreibpfad für die Übernahme."""
    try:
        return DiscountLibraryResponse(**service.library(ctx, property_id))
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}", response_model=DiscountResponse, status_code=201)
def create_discount(
    property_id: str, req: DiscountCreate, service: ServiceDep, ctx: _manage
) -> DiscountResponse:
    """Neue Rabattregel für ein Objekt anlegen."""
    try:
        return service.create(ctx, property_id, req)
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}/{discount_id}", response_model=DiscountResponse)
def update_discount(
    property_id: str,
    discount_id: str,
    req: DiscountUpdate,
    service: ServiceDep,
    ctx: _manage,
) -> DiscountResponse:
    """Rabattregel ändern (Höhe/aktiv/Fenster)."""
    try:
        return service.update(ctx, property_id, discount_id, req)
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{property_id}/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(
    property_id: str, discount_id: str, service: ServiceDep, ctx: _manage
) -> None:
    """Rabattregel löschen."""
    try:
        service.delete(ctx, property_id, discount_id)
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/{discount_id}/apply", response_model=DiscountApplyResponse
)
def apply_discount_to_properties(
    property_id: str,
    discount_id: str,
    req: DiscountApplyRequest,
    service: ServiceDep,
    ctx: _manage,
) -> DiscountApplyResponse:
    """Aktion dieses Objekts auf weitere eigene Objekte übertragen. Jede Ziel-ID
    einzeln tenant-gescopt; eine fachlich gleiche Aktion wird am Ziel nicht
    doppelt angelegt."""
    try:
        return DiscountApplyResponse(
            **service.apply_to_properties(ctx, property_id, discount_id, req.property_ids)
        )
    except DiscountError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
