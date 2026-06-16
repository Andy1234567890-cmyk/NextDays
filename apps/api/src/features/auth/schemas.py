"""Pydantic-Schemas für den auth-Slice."""
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, SecretStr


class UserRole(StrEnum):
    admin = "admin"        # voller Systemzugriff (Lastenheft §4.1)
    co_admin = "co_admin"  # operative Rechte Eigentümer + Mitarbeiter kombiniert
    owner = "owner"        # Eigentümer-Portal (Daten-Split, §4.2)
    staff = "staff"        # Mitarbeiter-Portal (Smartphone, §4.3)
    cleaner = "cleaner"    # Reinigungskraft (wie staff, operativ)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: SecretStr = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    tenant_name: str = Field(min_length=1, max_length=200)
    country: str = Field(min_length=2, max_length=2)   # ISO-3166-1 alpha-2
    currency: str = Field(min_length=3, max_length=3)  # ISO-4217


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr


class InviteRequest(BaseModel):
    """Einladung eines weiteren Nutzers in den eigenen Tenant (Mitarbeiter etc.).

    Der einladende Nutzer (admin/co_admin) bestimmt die Rolle. Owner-Rolle wird
    beim Registrieren vergeben, nicht beim Einladen.
    """

    email: EmailStr
    password: SecretStr = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole


class InviteResponse(BaseModel):
    user_id: str
    email: EmailStr
    role: UserRole
    tenant_id: str


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int


class MeResponse(BaseModel):
    user_id: str
    email: EmailStr | None = None
    tenant_id: str | None = None
    role: UserRole | None = None
    capabilities: list[str] = []  # Fähigkeiten der Rolle (Berechtigungs-Matrix)


# Bleibt erhalten: einheitlicher Health-Endpoint über alle Slices.
class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
