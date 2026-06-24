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
    # Lodgify-Berechtigungen (IDs aus lodgify_permissions.Permission). Leer =
    # Rollen-Defaults werden angewendet; Admin erhält immer alle.
    permissions: list[str] | None = None


class InviteResponse(BaseModel):
    user_id: str
    email: EmailStr
    role: UserRole
    tenant_id: str
    permissions: list[str] = []


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
    permissions: list[str] = []   # Lodgify-Berechtigungen (für UI-Gating)


class AccountResponse(BaseModel):
    """Konto-Übersicht für Sicherheit- & Kontakt-/Profil-Seite (echte Daten)."""

    user_id: str
    email: EmailStr | None = None
    full_name: str | None = None
    has_password: bool = True   # False bei reinen OAuth-Konten (z. B. Google)
    totp_enabled: bool = False
    role: UserRole | None = None
    # Profilfelder (wie Lodgify „Contact information"): optional, da alt-Konten
    # sie noch nicht gepflegt haben.
    phone: str | None = None
    additional_phone: str | None = None
    hide_phones: bool = False
    preferred_language: str | None = None
    spoken_languages: list[str] = []
    website: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    permissions: list[str] = []  # Lodgify-Berechtigungen (für UI-Gating)


class TenantUser(BaseModel):
    """Ein Nutzer. Für die Objekt-Kontakt-Auswahl (eigener Tenant) und für die
    Admin-Nutzerverwaltung (Admins sehen alle Tenants → tenant_id mitgeliefert)."""

    user_id: str
    email: EmailStr | None = None
    full_name: str | None = None
    role: UserRole | None = None
    phone: str | None = None
    avatar_url: str | None = None
    tenant_id: str | None = None
    permissions: list[str] = []


class OwnerAssignmentUpdate(BaseModel):
    """Setzt die Objekt-Zuordnung eines Eigentümers (Lastenheft §4.2).

    Vollständige Liste (Replace-Semantik): genau diese property_ids werden dem
    Eigentümer zugeordnet, alle anderen Zuordnungen dieses Nutzers entfernt."""

    property_ids: list[str] = []


class OwnerAssignmentResponse(BaseModel):
    """Aktuelle Objekt-Zuordnung eines Eigentümers."""

    user_id: str
    property_ids: list[str] = []


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr


class UpdateNameRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)


class UpdateProfileRequest(BaseModel):
    """Profil-/Kontaktdaten bearbeiten (Lodgify „Edit contact information").

    Alle Felder optional: gesendete Felder werden gesetzt, weggelassene bleiben
    unverändert. ``full_name`` wird aus Vor-/Nachname im Frontend gebildet.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    additional_phone: str | None = Field(default=None, max_length=40)
    hide_phones: bool | None = None
    preferred_language: str | None = Field(default=None, max_length=10)
    spoken_languages: list[str] | None = None
    website: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    avatar_url: str | None = Field(default=None, max_length=1000)


class UpdatePasswordRequest(BaseModel):
    # current_password optional: OAuth-Konten haben (noch) keins.
    current_password: SecretStr | None = None
    new_password: SecretStr = Field(min_length=8)


class TotpEnrollResponse(BaseModel):
    """Start des TOTP-Enrollments: Secret + QR (otpauth-URI als Data-URL)."""

    secret: str                 # Base32, zum manuellen Eintippen
    otpauth_uri: str            # otpauth://… (für QR-Scanner)
    qr_data_url: str            # data:image/png;base64,… (fertiger QR-Code)


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)  # 6-stellig (+Slack)


class TotpVerifyResponse(BaseModel):
    totp_enabled: bool
    recovery_codes: list[str] = []  # einmalig im Klartext zurückgegeben


class TotpDisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


# Bleibt erhalten: einheitlicher Health-Endpoint über alle Slices.
class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
