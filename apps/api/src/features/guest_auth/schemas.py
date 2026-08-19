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
    # Nur bei der Code-Anmeldung gesetzt: der Gast IST angemeldet, aber es fehlt
    # noch der Name (Erstanmeldung). Die Oberfläche fragt ihn dann nach — ohne
    # Namen ist eine Reservierung für den Gastgeber unbrauchbar. Bei Login per
    # Passwort ist das Profil immer vorhanden, deshalb der Default False.
    profil_fehlt: bool = False


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


class GuestKontoLoeschenRequest(BaseModel):
    """Eigenes Gast-Konto löschen — mit Passwort-Rückfrage.

    Das Passwort ist Pflicht (Wurzel 7): ein gekapertes Token allein darf kein
    Konto vernichten. Bei einem Konto ohne Passwort (reiner OAuth-Login) gibt es
    diesen Weg nicht — fail-closed, kein Durchlassen ohne Nachweis.
    """

    password: SecretStr


class GuestKontoLoeschenResponse(BaseModel):
    """Ergebnis der Löschung.

    Bewusst mit `hinweis`: bestehende Buchungen bleiben beim Gastgeber. Das
    stillschweigend zu tun wäre eine Täuschung — der Gast glaubt sonst, mit dem
    Konto sei auch die Buchung weg, und steht vor verschlossener Tür.
    """

    geloescht: bool
    detail: str
    hinweis: str


# --- Anmeldung per Einmal-Code (Airbnb-Muster) ------------------------------


class GuestCodeAnfrageRequest(BaseModel):
    """Schritt 1: nur die Adresse. Ob sie ein Konto hat, sagt die Antwort NICHT."""

    email: EmailStr
    # Sprache der Code-Mail (Gerätesprache der App). Unbekannt/leer → Englisch
    # über `core.mail_sprache.aufloesen` — kein Deutsch als heimlicher Default.
    locale: str | None = None


class GuestCodeAntwort(BaseModel):
    """Neutrale Bestätigung — identisch für bekannte und unbekannte Adressen."""

    message: str


class GuestCodePruefenRequest(BaseModel):
    """Schritt 2: Adresse + Code. Prüfen tut GoTrue (Ablauf, Einmal-Nutzung)."""

    email: EmailStr
    # Länge NICHT auf 6 festgenagelt: die Codelänge steht in der
    # GoTrue-Konfiguration (MAILER_OTP_LENGTH), nicht hier. Ein hartes 6 wäre
    # eine zweite Wahrheit, die bei einer Konfigänderung falsch wird.
    code: str = Field(min_length=4, max_length=12)


class GuestProfilAnlegenRequest(BaseModel):
    """Schritt 3 (nur bei Erstanmeldung): Name, optional Telefon."""

    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    preferred_locale: str | None = None
    preferred_currency: str | None = None
