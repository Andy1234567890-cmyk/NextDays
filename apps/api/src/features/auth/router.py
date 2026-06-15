"""Router für auth. Gemountet unter /api/v1/auth."""
from fastapi import APIRouter, HTTPException, status

from src.core.security import CurrentUser

from .dependencies import AuthServiceDep
from .schemas import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    SessionResponse,
    SliceHealth,
)
from .service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    # Health hängt bewusst nicht an Supabase-Clients (kein Key nötig).
    return SliceHealth(slice="auth")


@router.post(
    "/register",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(req: RegisterRequest, service: AuthServiceDep) -> SessionResponse:
    try:
        return service.register(req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=SessionResponse)
def login(req: LoginRequest, service: AuthServiceDep) -> SessionResponse:
    try:
        return service.login(req)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/me", response_model=MeResponse)
def me(ctx: CurrentUser, service: AuthServiceDep) -> MeResponse:
    return service.me(ctx)
