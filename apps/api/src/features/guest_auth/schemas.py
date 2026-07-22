"""Pydantic-Schemas für den guest_auth-Slice (Portal-Gast-Konto).

Bewusst schlank gehalten: ein Gast hat KEINEN Tenant, KEINE Rolle, KEINE
feingranularen Rechte — nur Kontaktdaten und Anzeige-Präferenzen. Die
``preferred_currency`` ist eine reine Anzeige-Vorliebe und NIE ein Fallback für
eine fehlende Objektwährung (Wurzel 4).
"""
from pydantic import BaseModel, EmailStr, Field, SecretStr

# Anzeige-Präferenzen sind frei wählbar (BCP-47-Locale, ISO-4217-Währung), aber
# längenbegrenzt. Sie steuern NUR die Darstellung im Gast-Dashboard; die echte
# Objektwährung kommt immer aus den Objektdaten (Wurzel 4).
_LOCALE_MAX = 10
_CURRENCY_LEN = 3


class GuestRegisterRequest(BaseModel):
    """Registrierung eines neuen Portal-Gasts (Kundenkonto, keine Tenant-Anlage)."""

    email: EmailStr
    password: SecretStr = Field(min_length=8)
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    preferred_locale: str | None = Field(default=None, max_length=_LOCALE_MAX)
    # Anzeige-Währung des Gasts, NIE Fallback für die Objektwährung (Wurzel 4).
    preferred_currency: str | None = Field(
        default=None, min_length=_CURRENCY_LEN, max_length=_CURRENCY_LEN
    )


class GuestLoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr


class GuestRefreshRequest(BaseModel):
    """Silent-Refresh: tauscht ein gültiges Refresh-Token gegen eine frische
    Session (Antwort = ``GuestSessionResponse``)."""

    refresh_token: SecretStr


class GuestPasswordResetRequest(BaseModel):
    """Passwort-Zurücksetzen anstoßen. Der Endpunkt antwortet IMMER 200 (kein
    Existenz-Leak, ob die Adresse ein Konto hat)."""

    email: EmailStr


class GuestSessionResponse(BaseModel):
    """GoTrue-Session eines Portal-Gasts (identisch zum Tenant-Session-Shape)."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int


class GuestMessageResponse(BaseModel):
    """Neutrale Bestätigung ohne Session (z. B. Passwort-Reset ausgelöst)."""

    message: str


class GuestProfileResponse(BaseModel):
    """Stammdaten des eingeloggten Gasts (guest_id-gescopet gelesen)."""

    guest_id: str
    email: EmailStr
    name: str | None = None
    phone: str | None = None
    preferred_locale: str | None = None
    preferred_currency: str | None = None
    marketing_opt_in: bool = False


class GuestProfileUpdateRequest(BaseModel):
    """Eigene Profilfelder ändern. Gesendete Felder werden gesetzt, weggelassene
    bleiben unverändert. Die E-Mail wird hier bewusst NICHT geändert — ein
    E-Mail-Wechsel braucht Re-Auth + Doppel-Opt-in an die neue Adresse (Wurzel 7)
    und ist ein eigener Flow (siehe Service-Docstring)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    preferred_locale: str | None = Field(default=None, max_length=_LOCALE_MAX)
    preferred_currency: str | None = Field(
        default=None, min_length=_CURRENCY_LEN, max_length=_CURRENCY_LEN
    )
    marketing_opt_in: bool | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
