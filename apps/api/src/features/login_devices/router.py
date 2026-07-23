"""Router für login_devices. Gemountet unter /api/v1/login-devices.

- Geräteverlauf (Liste + Widerruf): jeder eingeloggte Nutzer, Scope über die
  eigene user_id im Service (Wurzel 3/9).
- IP→Ort-Bereiche verwalten: nur Betriebs-Admin (MANAGE_TENANT). Referenzdaten,
  die der Betrieb selbst pflegt.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext, CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import GeoRangeServiceDep, LoginDeviceServiceDep
from .schemas import (
    GeoRange,
    GeoRangeCreate,
    LoginDevice,
    RevokeOthersResponse,
)
from .service import LoginDeviceError

router = APIRouter(prefix="/login-devices", tags=["login-devices"])


# --- Geräteverlauf ---------------------------------------------------------


@router.get("", response_model=list[LoginDevice])
def list_devices(
    ctx: CurrentUser, service: LoginDeviceServiceDep
) -> list[LoginDevice]:
    """Aktive Geräte des eingeloggten Nutzers (echte IP + Gerät + Ort)."""
    return [LoginDevice(**d) for d in service.list_devices(ctx)]


@router.delete("/others", response_model=RevokeOthersResponse)
def revoke_other_devices(
    ctx: CurrentUser, service: LoginDeviceServiceDep
) -> RevokeOthersResponse:
    """Auf allen anderen Geräten abmelden. Die aktuelle Sitzung bleibt."""
    return RevokeOthersResponse(revoked=service.revoke_other_devices(ctx))


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device(
    device_id: str, ctx: CurrentUser, service: LoginDeviceServiceDep
) -> None:
    """Ein einzelnes Gerät abmelden. 404, wenn es nicht dem Nutzer gehört."""
    try:
        service.revoke_device(ctx, device_id)
    except LoginDeviceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- IP→Ort-Bereiche (Admin) ----------------------------------------------


@router.get("/geo-ranges", response_model=list[GeoRange])
def list_geo_ranges(
    service: GeoRangeServiceDep,
    _ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
    ],
) -> list[GeoRange]:
    return [GeoRange(**r) for r in service.list_ranges()]


@router.post(
    "/geo-ranges",
    response_model=GeoRange,
    status_code=status.HTTP_201_CREATED,
)
def add_geo_range(
    req: GeoRangeCreate,
    service: GeoRangeServiceDep,
    _ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
    ],
) -> GeoRange:
    return GeoRange(
        **service.add_range(req.ip_from, req.ip_to, req.country, req.city)
    )


@router.delete("/geo-ranges/{range_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_geo_range(
    range_id: str,
    service: GeoRangeServiceDep,
    _ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
    ],
) -> None:
    service.delete_range(range_id)
