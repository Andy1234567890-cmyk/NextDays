"""Pydantic-Schemas für den auth-Slice."""
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, SecretStr


class UserRole(StrEnum):
    owner = "owner"
    staff = "staff"
    cleaner = "cleaner"


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


# Bleibt erhalten: einheitlicher Health-Endpoint über alle Slices.
class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
