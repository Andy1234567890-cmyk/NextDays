"""Router für guest_auth. Gemountet unter /api/v1/guest-auth.

Gast-Auth-Welt der Plattform-Demand-Seite (Kunden-Dashboard unter /plattform),
GETRENNT von der Tenant-Auth (/api/v1/auth). ``register``/``login``/``refresh``/
``password-reset`` sind bewusst public (der Gast hat ja noch kein Token);
``me``/``PATCH me`` verlangen ein Gast-Token (``CurrentGuest``) und sind strikt
über die eigene guest_id gescopet (Wurzel 3/9).
"""
from fastapi import APIRouter, HTTPException, status

from src.core.security import CurrentGuest

from .dependencies import GuestAuthServiceDep
from .schemas import (
    GuestLoginRequest,
    GuestMessageResponse,
    GuestPasswordResetRequest,
    GuestProfileResponse,
    GuestProfileUpdateRequest,
    GuestRefreshRequest,
    GuestRegisterRequest,
    GuestSessionResponse,
    SliceHealth,
)
from .service import GuestAuthError

router = APIRouter(prefix="/guest-auth", tags=["guest_auth"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    # Health hängt bewusst nicht an Supabase-Clients (kein Key nötig).
    return SliceHealth(slice="guest_auth")


@router.post(
    "/register",
    response_model=GuestSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    req: GuestRegisterRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """Neues Gast-Konto anlegen (Auth-User ohne Tenant + portal_guests-Zeile)."""
    try:
        return service.register(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=GuestSessionResponse)
def login(
    req: GuestLoginRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """E-Mail + Passwort → Session. Kein MFA für Gäste."""
    try:
        return service.login(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/refresh", response_model=GuestSessionResponse)
def refresh(
    req: GuestRefreshRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """Silent-Refresh: frische Session aus dem Refresh-Token. KEIN Guard — der
    Access-Token ist ja gerade abgelaufen; fail-closed 401 bei ungültigem Token."""
    try:
        return service.refresh(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/password-reset", response_model=GuestMessageResponse)
def password_reset(
    req: GuestPasswordResetRequest, service: GuestAuthServiceDep
) -> GuestMessageResponse:
    """Passwort-Reset anstoßen. Antwortet IMMER 200 (kein Existenz-Leak)."""
    return service.password_reset(req)


@router.get("/me", response_model=GuestProfileResponse)
def get_me(
    ctx: CurrentGuest, service: GuestAuthServiceDep
) -> GuestProfileResponse:
    """Eigenes Gast-Profil (guest_id-gescopet, Wurzel 3/9)."""
    try:
        return service.get_profile(ctx)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/me", response_model=GuestProfileResponse)
def update_me(
    req: GuestProfileUpdateRequest,
    ctx: CurrentGuest,
    service: GuestAuthServiceDep,
) -> GuestProfileResponse:
    """Eigene Profilfelder ändern (name/phone/locale/currency/marketing).

    Die E-Mail wird hier NICHT geändert — E-Mail-Wechsel braucht Re-Auth +
    Doppel-Opt-in (Wurzel 7) und ist ein eigener Flow."""
    try:
        return service.update_profile(ctx, req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
