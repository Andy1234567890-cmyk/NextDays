"""Router für host_profiles. Gemountet unter /api/v1/host-profile.

Gastgeber-Profil des eingeloggten Kontos (Airbnb „Über den Gastgeber"). Scope
über die eigene user_id im Service (Wurzel 3/9) — jeder eingeloggte Nutzer
sieht/ändert nur das EIGENE Profil.
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from src.core.security import CurrentUser
from src.core.uploads import read_upload

from .dependencies import HostProfileServiceDep
from .schemas import HostProfile, HostProfileUpdate

router = APIRouter(prefix="/host-profile", tags=["host-profile"])


@router.get("", response_model=HostProfile)
def get_host_profile(
    ctx: CurrentUser, service: HostProfileServiceDep
) -> HostProfile:
    """Profil des eingeloggten Nutzers (leeres Profil, falls noch keins)."""
    return service.get(ctx)


@router.patch("", response_model=HostProfile)
def update_host_profile(
    patch: HostProfileUpdate,
    ctx: CurrentUser,
    service: HostProfileServiceDep,
) -> HostProfile:
    """Einzelne Profilfelder ändern (nur gesetzte Felder). Legt die Zeile lazy an."""
    return service.update(ctx, patch)


@router.post("/avatar", response_model=HostProfile)
async def upload_avatar(
    request: Request,
    ctx: CurrentUser,
    service: HostProfileServiceDep,
) -> HostProfile:
    """Profilfoto hochladen (multipart „file"). Magic-Byte-Prüfung im Service;
    speichert avatar_url und gibt das aktualisierte Profil zurück."""
    content, content_type = await read_upload(request)
    return service.upload_avatar(ctx, content, content_type)
