"""Pydantic-Schemas für den auth-Slice."""
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, SecretStr, field_validator

from src.core.countries import is_iso2_country
from src.features.owner_statements.currencies import COUNTRY_CURRENCY

# Unterstützte Währungen = die Werte der Land→Währung-Map (EU27+CH/GB), gleiche
# Quelle wie das Frontend (apps/web/lib/laender.ts). KEINE volle ISO-4217-Liste:
# das UI bietet nur diese Länder/Währungen an, ein Datensatz mit "FOO" (oder auch
# "BRL") kann über kein UI entstehen und ist ein Datenfehler, kein legitimer Fall.
_SUPPORTED_CURRENCIES = frozenset(COUNTRY_CURRENCY.values())


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
    # Gegen die unterstützte Länder-/Währungsliste geprüft (nicht nur Länge):
    # "zz"/"!!"/"FOO" sind Datenfehler → 422, kein erfundener Ersatzwert (Wurzel 4).
    country: str = Field(min_length=2, max_length=2)   # ISO-3166-1 alpha-2
    currency: str = Field(min_length=3, max_length=3)  # ISO-4217
    # 'agency' = verwaltet fremde Objekte (Owner-Statements); 'self_managed' =
    # eigener Vermieter. Default agency (bisheriges Verhalten).
    business_type: str = Field(default="agency", pattern="^(agency|self_managed)$")

    @field_validator("country")
    @classmethod
    def _country_supported(cls, v: str) -> str:
        if not is_iso2_country(v):
            raise ValueError("Land wird nicht unterstützt (EU27, CH, GB).")
        return v.upper()

    @field_validator("currency")
    @classmethod
    def _currency_supported(cls, v: str) -> str:
        if v.upper() not in _SUPPORTED_CURRENCIES:
            raise ValueError("Währung wird nicht unterstützt.")
        return v.upper()


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr


class RefreshRequest(BaseModel):
    """Silent-Refresh (Mobile): tauscht ein gültiges Refresh-Token gegen eine
    frische Session. Antwort ist die bestehende SessionResponse."""

    refresh_token: SecretStr


class InviteRequest(BaseModel):
    """Einladung eines weiteren Nutzers in den eigenen Tenant (Mitarbeiter etc.).

    Der einladende Nutzer (admin/co_admin) bestimmt die Rolle. Owner-Rolle wird
    beim Registrieren vergeben, nicht beim Einladen.
    """

    email: EmailStr
    password: SecretStr = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole
    # Feingranulare Berechtigungen (IDs aus granular_permissions.Permission). Leer =
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


class LoginResponse(BaseModel):
    """Antwort auf /auth/login. Genau EINE der beiden Welten ist gesetzt:

    - 2FA nicht aktiv → ``session`` gefüllt, ``mfa_required=False``. Der Client
      benutzt die Session sofort (wie bisher SessionResponse).
    - 2FA aktiv → ``mfa_required=True``, ``session=None``, ``mfa_token`` gesetzt.
      Es gibt bewusst NOCH KEINE Session (fail-closed): der Client muss den
      TOTP-Code über /auth/login/totp einlösen. Der mfa_token ist kurzlebig,
      an genau diesen User gebunden und taugt NUR zum Code-Einlösen — er ist
      KEIN Access-Token (eigener typ-Claim, wird vom API-Guard abgelehnt)."""

    mfa_required: bool = False
    session: SessionResponse | None = None
    # Nur bei mfa_required=True: kurzlebiges Pending-Token (5 Min).
    mfa_token: str | None = None


class TotpLoginRequest(BaseModel):
    """Zweiter Login-Schritt bei aktiver 2FA: mfa_token (aus /auth/login) plus
    6-stelliger TOTP-Code oder ein Recovery-Code."""

    mfa_token: str
    code: str = Field(min_length=6, max_length=32)


class MeResponse(BaseModel):
    user_id: str
    email: EmailStr | None = None
    tenant_id: str | None = None
    role: UserRole | None = None
    capabilities: list[str] = []  # Fähigkeiten der Rolle (Berechtigungs-Matrix)
    permissions: list[str] = []   # Feingranulare Berechtigungen (für UI-Gating)
    # Beherbergungsart des Mandanten (0090): steuert die Navigation
    # (Objekte vs. Zimmer, Eigentümer-Modul nur bei Ferienvermietung).
    accommodation_type: str | None = None


class AccommodationTypeUpdate(BaseModel):
    """Beherbergungsart des Mandanten umstellen (nur Admin)."""

    accommodation_type: str = Field(pattern="^(vacation_rental|hotel)$")


class AccountResponse(BaseModel):
    """Konto-Übersicht für Sicherheit- & Kontakt-/Profil-Seite (echte Daten)."""

    user_id: str
    email: EmailStr | None = None
    full_name: str | None = None
    has_password: bool = True   # False bei reinen OAuth-Konten (z. B. Google)
    totp_enabled: bool = False
    role: UserRole | None = None
    # Profilfelder (Kontaktdaten): optional, da alt-Konten
    # sie noch nicht gepflegt haben.
    phone: str | None = None
    additional_phone: str | None = None
    hide_phones: bool = False
    preferred_language: str | None = None
    spoken_languages: list[str] = []
    website: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    permissions: list[str] = []  # Feingranulare Berechtigungen (für UI-Gating)
    # Land des Unternehmens (ISO-2, aus tenants.country) — Vorbelegung z. B.
    # der Telefon-Ländervorwahl im Frontend (kein Hardcode, Wurzel 4).
    tenant_country: str | None = None


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


class StaffAssignmentUpdate(BaseModel):
    """Setzt die Objekt-Zuordnung eines Mitarbeiters (Lastenheft §4.3).

    Vollständige Liste (Replace-Semantik): genau diese property_ids werden dem
    Mitarbeiter (Rolle staff/cleaner) zugeordnet, alle anderen entfernt."""

    property_ids: list[str] = []


class StaffAssignmentResponse(BaseModel):
    """Aktuelle Objekt-Zuordnung eines Mitarbeiters."""

    user_id: str
    property_ids: list[str] = []


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr


class UpdateNameRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)


class UpdateManagedUserRequest(BaseModel):
    """Nutzer in der Verwaltung (Konto → Benutzer) bearbeiten. Gesendete
    Felder werden gesetzt, weggelassene bleiben unverändert."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: UserRole | None = None
    # Feingranulare Berechtigungen nachträglich anpassen (Admin darf die Rechte
    # jedes Nutzers erweitern/einschränken). None = unverändert; eine (auch
    # leere) Liste ersetzt die gespeicherten Berechtigungen.
    permissions: list[str] | None = None


class UpdateProfileRequest(BaseModel):
    """Profil-/Kontaktdaten bearbeiten (Kontaktinformationen).

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
