"""Schemas des Partnerprogramms (Affiliate).

Alle Beträge kommen als Zeichenkette mit zwei Nachkommastellen PLUS Währung —
nie als nackte Zahl (Wurzel 4: ein Betrag ohne Währung ist kein Betrag).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, SecretStr, field_validator, model_validator

from src.core.countries import is_iso2_country
from src.core.mail_sprache import SUPPORTED, normalisieren

from .kanaele import SOCIAL_PLATTFORMEN, Plattform, plattform_aus_url

# Der Code, wie er in Links steht. Groß-/Kleinschreibung ist egal — der Server
# normalisiert auf Großbuchstaben. Die Grenzen decken sich mit dem CHECK in
# 0517 (`^[A-Z0-9][A-Z0-9-]{2,30}$`).
CODE_MIN = 3
CODE_MAX = 31

LegalForm = Literal["company", "private"]
PayoutMethod = Literal["wise", "sepa", "paypal"]


def vat_id_bereinigen(v: str | None) -> str | None:
    """USt-IdNr. auf Großbuchstaben/Ziffern reduzieren; Ländercode ist Pflicht."""
    if v is None:
        return None
    w = "".join(ch for ch in v.upper() if ch.isalnum())
    if not w:
        return None
    if len(w) < 4 or not w[:2].isalpha():
        raise ValueError("USt-IdNr. muss mit dem Ländercode beginnen (z. B. DE123456789).")
    return w


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Bewerbung / Auth -------------------------------------------------------


def _http_url(v: str) -> str:
    # Wurzel 8: nur http(s) — der Wert landet als Link im Backoffice und im Dashboard.
    w = v.strip()
    if not (w.startswith("https://") or w.startswith("http://")):
        raise ValueError("Die Adresse muss mit http:// oder https:// beginnen.")
    return w


class SocialKanal(BaseModel):
    """Ein Kanal des Partners: Plattform, Profil-Adresse, optional Handle und Reichweite.

    Die Reichweite (`followers`) ist eine Selbstauskunft — bis der Partner das
    Konto verbindet (0521): dann trägt `followers` den letzten Snapshot,
    `verified` ist gesetzt und die Selbstauskunft steht in
    `followers_self_reported`. Diese Felder pflegt AUSSCHLIESSLICH der Server
    (kanal_verbindungen.kanaele_abgleichen läuft nach jeder Profiländerung);
    was der Partner hier schickt, wird überschrieben.
    """

    platform: Plattform
    url: str = Field(min_length=4, max_length=500)
    handle: str | None = Field(default=None, max_length=100)
    followers: int | None = Field(default=None, ge=0, le=1_000_000_000)
    followers_self_reported: int | None = Field(default=None, ge=0, le=1_000_000_000)
    verified: bool = False
    verified_at: str | None = Field(default=None, max_length=40)
    connection_id: str | None = None

    @field_validator("url")
    @classmethod
    def _url_http(cls, v: str) -> str:
        return _http_url(v)

    @field_validator("handle")
    @classmethod
    def _handle(cls, v: str | None) -> str | None:
        w = (v or "").strip().lstrip("@")
        return w or None


def _kanaele_pruefen(kanaele: list[SocialKanal]) -> list[SocialKanal]:
    if len({k.url.lower().rstrip("/") for k in kanaele}) != len(kanaele):
        raise ValueError("Eine Adresse ist doppelt angegeben.")
    if not any(k.platform in SOCIAL_PLATTFORMEN for k in kanaele):
        raise ValueError(
            "Mindestens ein Social-Media-Konto (Instagram, TikTok, YouTube, Facebook, "
            "LinkedIn …) ist Pflicht — eine Website allein reicht nicht."
        )
    return kanaele


def _kanal_aus_url(url: str) -> SocialKanal:
    return SocialKanal(platform=plattform_aus_url(url) or "website", url=url)


class PartnerBewerbung(BaseModel):
    """Bewerbung als Partner — legt Login UND Stammdaten an (status pending_review).

    Mindestens ein Kanal (`channels`: Instagram, TikTok, YouTube, Website …) ist
    Pflicht: das Backoffice muss sehen können, WER da wirbt, bevor es freigibt
    (FirstPromoter-/Lodgify-Muster). `channel_url` ist der Altweg (ein Kanal
    ohne Plattform) und wird in `channels` überführt. Die
    Zustimmung zu den Partner-Bedingungen ist ebenfalls Pflicht — ohne sie kann
    keine Provision entstehen, die rechtlich trägt.
    """

    email: EmailStr
    password: SecretStr = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    legal_form: LegalForm
    country: str = Field(min_length=2, max_length=2)
    vat_id: str | None = Field(default=None, max_length=20)
    language: str = Field(default="en", max_length=10)
    channels: list[SocialKanal] = Field(default_factory=list, max_length=12)
    channel_url: str | None = Field(default=None, min_length=4, max_length=500)
    # Team (0520): Code des Sponsors, sichtbar im Formular bestätigt, kein Cookie.
    sponsor_code: str | None = Field(default=None, max_length=40)
    pitch: str | None = Field(default=None, max_length=2000)
    terms_accepted: bool
    terms_version: str = Field(min_length=1, max_length=40)
    # reCAPTCHA-Enterprise-Token (Aktion "partner_bewerbung").
    captcha_token: str | None = Field(default=None, max_length=4000)
    # Honigtopf: ein Feld, das kein Mensch sieht. Gefüllt → Bot.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("country")
    @classmethod
    def _country_supported(cls, v: str) -> str:
        if not is_iso2_country(v):
            raise ValueError("Land wird nicht unterstützt (EU27, CH, GB).")
        return v.upper()

    @field_validator("language")
    @classmethod
    def _language_supported(cls, v: str) -> str:
        code = normalisieren(v)
        if code is None or code not in SUPPORTED:
            raise ValueError("Sprache wird nicht unterstützt.")
        return code

    @field_validator("channel_url")
    @classmethod
    def _channel_http(cls, v: str | None) -> str | None:
        return _http_url(v) if v is not None else None

    @model_validator(mode="after")
    def _mindestens_ein_kanal(self) -> PartnerBewerbung:
        if not self.channels and self.channel_url:
            self.channels = [_kanal_aus_url(self.channel_url)]
        if not self.channels:
            raise ValueError("Mindestens ein Social-Media-Konto ist Pflicht.")
        _kanaele_pruefen(self.channels)
        self.channel_url = self.channels[0].url
        return self

    @field_validator("terms_accepted")
    @classmethod
    def _terms_required(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Ohne Zustimmung zu den Partner-Bedingungen keine Bewerbung.")
        return v

    @field_validator("vat_id")
    @classmethod
    def _vat_format(cls, v: str | None) -> str | None:
        return vat_id_bereinigen(v)


class PartnerLogin(BaseModel):
    email: EmailStr
    password: SecretStr


class PartnerRefresh(BaseModel):
    refresh_token: SecretStr


class PartnerPasswordReset(BaseModel):
    email: EmailStr


class PartnerPasswortNeu(BaseModel):
    """Neues Passwort setzen — mit dem CODE aus der Reset-Mail.

    Der Code (GoTrue nennt ihn `token`, in der Mail steht er als sechsstellige
    Zahl) statt des Links: der Link führte über
    `{API_EXTERNAL_URL}/verify?token=…`, und weil `API_EXTERNAL_URL` ohne das
    `/auth/v1`-Präfix gesetzt war, unter dem Kong GoTrue veröffentlicht,
    antwortete er mit „no Route matched" (live 03.09.2026). Der Code hängt an
    keiner URL und funktioniert deshalb unabhängig von der Proxy-Konfiguration.

    `email` gehört dazu, weil GoTrues `verify_otp` mit `type="recovery"` Code
    UND Adresse zusammen prüft — ein Code allein ist keiner Person zugeordnet.
    """

    email: EmailStr
    code: str = Field(min_length=6, max_length=12)
    password: SecretStr = Field(min_length=8, max_length=200)


class PartnerSession(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int


class PartnerMessage(BaseModel):
    message: str


# --- Rang / Geld -------------------------------------------------------------


# Provisionsarten — deckungsgleich mit dem DB-CHECK (0517/0520), den Frontend-
# Unions (partner/admin) und den Übersetzungen (`provisionen.art.*`);
# `scripts/i18n/provisionsart-pruefen.mjs` hält das zusammen.
ProvisionsArt = Literal[
    "earn", "reversal", "adjustment", "override", "bonus", "lifetime", "booking_share"
]
PROVISIONSARTEN: tuple[str, ...] = (
    "earn",
    "reversal",
    "adjustment",
    "override",
    "bonus",
    "lifetime",
    "booking_share",
)


class Betrag(BaseModel):
    """Betrag MIT Währung — nie getrennt ausliefern."""

    amount: str
    currency: str


class PartnerRang(BaseModel):
    id: str
    name: str
    # Schwellen der STRUKTUR-Kundenzahl (eigene + Team-Kunden, 0525).
    min_customers: int
    max_customers: int | None = None
    # Satz als Faktor (0.15). Prozent rechnet die Oberfläche.
    rate: str
    # AUSSER DIENST (0525): Team-Provision ist die Differenz der Sätze. Bleibt
    # im Schema, damit alte Clients nicht brechen; liefert immer "0".
    override_rate: str = "0"
    # Superprovision als Faktor (0.025 ab Elite) auf die ganze Struktur, ohne
    # Laufzeitgrenze (0525). "0" = keine.
    lifetime_rate: str = "0"
    # Darf dieser Rang Team-Partner führen (Untervermittler ab Aufsteiger)?
    team_allowed: bool = False
    # Einmaliger Aufstiegsbonus beim Erreichen dieses Rangs, je Währung.
    bonus: list[Betrag] = Field(default_factory=list)


# --- Profil ------------------------------------------------------------------


class ConnectStand(BaseModel):
    """Stand des Verbundkontos, wie ihn Partner und Backoffice sehen.

    `offene_felder` sind Stripes `currently_due` im Klartext — damit sichtbar
    ist, WORAN die Freischaltung hängt, statt nur dass sie fehlt.
    """

    verbunden: bool = False
    stripe_account_id: str | None = None
    auszahlbar: bool = False
    daten_vollstaendig: bool = False
    offene_felder: list[str] = Field(default_factory=list)
    gesperrt_grund: str | None = None


class ConnectIdentitaetsLink(BaseModel):
    """Einmal-Adresse zu Stripes gehosteter Identitätsprüfung (Ausweis +
    Lebendnachweis). Kurzlebig, wird nicht gespeichert."""

    url: str


class ConnectPflichtfelder(BaseModel):
    minimum: list[str] = Field(default_factory=list)
    zusaetzlich: list[str] = Field(default_factory=list)


class ConnectAdresse(BaseModel):
    line1: str = Field(min_length=1, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    postal_code: str = Field(min_length=1, max_length=20)
    city: str = Field(min_length=1, max_length=100)
    state: str | None = Field(default=None, max_length=100)


class ConnectGeburtstag(BaseModel):
    day: int = Field(ge=1, le=31)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=1900, le=2100)


class ConnectPerson(BaseModel):
    """Ein Mensch am Verbundkonto — bei `individual` der Partner selbst, bei
    `company` der vertretungsberechtigte Mensch."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    dob: ConnectGeburtstag
    address: ConnectAdresse
    nationality: str | None = Field(default=None, min_length=2, max_length=2)
    # Persönliche Kennnummer (CPR, personnummer, NIF, PESEL, codice fiscale …) —
    # Stripe verlangt sie in zehn EU-Ländern, ob, sagt die Ländervorgabe live.
    id_number: str | None = Field(default=None, min_length=1, max_length=40)
    title: str | None = Field(default=None, max_length=100)


class ConnectDaten(BaseModel):
    """Was die eigene KYC-Oberfläche an Stripe schickt.

    Getrennt nach Rechtsform: `person` ist bei beiden Pflicht (bei `company` ist
    es der Vertreter), `company_*` nur bei Unternehmen. Die Website ist bei
    Stripe Pflichtfeld (`business_profile.url`) — sie kommt aus dem ersten Kanal
    des Partners, wenn er keine eigene angibt.
    """

    url: str = Field(min_length=4, max_length=500)
    person: ConnectPerson
    company_name: str | None = Field(default=None, max_length=200)
    company_tax_id: str | None = Field(default=None, max_length=40)
    # Handelsregisternummer und USt-IdNr. verlangt Stripe in allen 27 EU-Ländern
    # für Unternehmen; die USt-IdNr. kommt aus dem Profil, wenn hier leer.
    company_registration_number: str | None = Field(default=None, max_length=60)
    company_vat_id: str | None = Field(default=None, max_length=40)
    company_address: ConnectAdresse | None = None
    company_phone: str | None = Field(default=None, max_length=40)

    @field_validator("url")
    @classmethod
    def _url_http(cls, v: str) -> str:
        geprueft = _http_url(v)
        if geprueft is None:
            raise ValueError("Ungültige Adresse.")
        return geprueft


class ConnectBank(BaseModel):
    """Auszahlungskonto. Die Währung kommt MIT und wird nicht aus dem Land
    geraten (Wurzel 4) — ein dänischer Partner kann ein EUR-Konto führen."""

    iban: str = Field(min_length=15, max_length=40)
    account_holder: str = Field(min_length=1, max_length=200)
    currency: str = Field(min_length=3, max_length=3)


class ConnectBedingungen(BaseModel):
    """Zustimmung zur Stripe-Vereinbarung. Der Zeitpunkt wird serverseitig
    gesetzt, die IP aus dem Request gelesen — beides ist Compliance-Nachweis und
    darf nicht vom Client kommen."""

    akzeptiert: bool

    @field_validator("akzeptiert")
    @classmethod
    def _muss_wahr(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Ohne Zustimmung kann das Konto nicht freigeschaltet werden.")
        return v


class PartnerProfil(BaseModel):
    affiliate_id: str
    email: EmailStr
    full_name: str
    company: str | None = None
    legal_form: LegalForm
    country: str
    vat_id: str | None = None
    vat_id_verified: bool = False
    language: str
    channel_url: str | None = None
    channels: list[SocialKanal] = Field(default_factory=list)
    # Team: Name des eigenen Sponsors (wenn Team-Mitglied) und ob man selbst ein Team führt.
    sponsor_name: str | None = None
    team_size: int = 0
    status: str
    status_reason: str | None = None
    tier: PartnerRang
    payout_method: PayoutMethod | None = None
    # Nur die letzten Zeichen der Kontoverbindung — der volle Wert verlässt den
    # Server nicht wieder (er wurde vom Partner selbst eingegeben).
    payout_details_masked: str | None = None
    # Verbundkonto (0522) — einziger Auszahlungsweg.
    connect: ConnectStand = Field(default_factory=ConnectStand)
    terms_version: str | None = None
    created_at: datetime


class PartnerBedingungenAnnehmen(BaseModel):
    """Erneute Zustimmung zu einer neuen Version der Partner-AGB
    (Version + Zeitstempel am Datensatz)."""

    terms_version: str = Field(min_length=1, max_length=40)


class PartnerProfilUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    language: str | None = Field(default=None, max_length=10)
    channel_url: str | None = Field(default=None, min_length=4, max_length=500)
    channels: list[SocialKanal] | None = Field(default=None, min_length=1, max_length=12)

    @field_validator("channels")
    @classmethod
    def _channels(cls, v: list[SocialKanal] | None) -> list[SocialKanal] | None:
        return _kanaele_pruefen(v) if v is not None else None

    @field_validator("language")
    @classmethod
    def _language_supported(cls, v: str | None) -> str | None:
        if v is None:
            return None
        code = normalisieren(v)
        if code is None or code not in SUPPORTED:
            raise ValueError("Sprache wird nicht unterstützt.")
        return code

    @field_validator("channel_url")
    @classmethod
    def _channel_http(cls, v: str | None) -> str | None:
        return _http_url(v) if v is not None else None


class PartnerSteuerdaten(BaseModel):
    """Rechtsform und USt-IdNr. — mit Passwort-Rückfrage.

    Diese Angaben bestimmen die Gutschrift (Reverse Charge oder ohne USt) und
    damit die Steuerlast des Partners. Ein gekapertes Token allein darf das
    nicht ändern (Wurzel 7), deshalb ist das aktuelle Passwort Pflicht.

    `payout_method`/`payout_details` sind seit 0522 OPTIONAL und ohne Wirkung
    für neue Auszahlungen: der Weg ist das Verbundkonto, die Bankverbindung
    liegt bei Stripe. Die Felder bleiben im Schema, damit ein Altclient keinen
    422 bekommt — der Service ignoriert sie.
    """

    password: SecretStr
    legal_form: LegalForm
    country: str = Field(min_length=2, max_length=2)
    vat_id: str | None = Field(default=None, max_length=20)
    payout_method: PayoutMethod | None = None
    payout_details: dict[str, str] = Field(default_factory=dict)

    @field_validator("country")
    @classmethod
    def _country_supported(cls, v: str) -> str:
        if not is_iso2_country(v):
            raise ValueError("Land wird nicht unterstützt (EU27, CH, GB).")
        return v.upper()

    @field_validator("vat_id")
    @classmethod
    def _vat_format(cls, v: str | None) -> str | None:
        return vat_id_bereinigen(v)

    @field_validator("payout_details")
    @classmethod
    def _details_bounded(cls, v: dict[str, str]) -> dict[str, str]:
        # Wurzel 8: harte Grenzen, das Feld ist frei befüllbar.
        if len(v) > 6:
            raise ValueError("Zu viele Felder in den Auszahlungsangaben.")
        out: dict[str, str] = {}
        for k, val in v.items():
            if len(k) > 40 or len(val) > 200:
                raise ValueError("Auszahlungsangabe zu lang.")
            out[k] = val.strip()
        return out


# --- Codes / Links -----------------------------------------------------------


class PartnerCode(BaseModel):
    id: str
    code: str
    label: str | None = None
    active: bool
    # Fertiger Link auf die Marketing-Seite (…/?ref=CODE), damit der Partner
    # nichts zusammensetzen muss.
    url: str | None = None
    # Weiterleitungs-Link, der den Klick zählt (/api/v1/affiliates/r/CODE).
    tracking_url: str | None = None
    clicks_30d: int = 0
    created_at: datetime


class PartnerCodeAnlegen(BaseModel):
    label: str | None = Field(default=None, max_length=80)
    # Wunschcode; ohne Angabe würfelt der Server einen aus dem Namen.
    code: str | None = Field(default=None, min_length=CODE_MIN, max_length=CODE_MAX)

    @field_validator("code")
    @classmethod
    def _code_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        w = v.strip().upper()
        erlaubt = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
        if not w or w[0] == "-" or any(ch not in erlaubt for ch in w):
            raise ValueError("Code: nur Buchstaben, Ziffern und Bindestrich.")
        return w


# --- Dashboard ---------------------------------------------------------------


class PartnerKennzahlen(BaseModel):
    clicks_30d: int
    registrations: int
    paying_customers: int
    # Summen je Währung — keine Umrechnung, keine Gesamtsumme über Währungen.
    pending: list[Betrag]
    approved: list[Betrag]
    paid: list[Betrag]
    # Team (0520): Anzahl Team-Partner und Team-Provision (offen + auszahlbar + ausgezahlt).
    team_size: int = 0
    team_override: list[Betrag] = Field(default_factory=list)
    # Struktur (0525): eigene zahlende Kunden + die der Team-Partner — die Zahl,
    # die den Rang bestimmt. Superprovision, Markt-Turbo und Boni je Währung.
    structure_customers: int = 0
    lifetime: list[Betrag] = Field(default_factory=list)
    booking_share: list[Betrag] = Field(default_factory=list)
    bonus: list[Betrag] = Field(default_factory=list)


class PartnerNaechsterRang(BaseModel):
    tier: PartnerRang
    missing_customers: int


class PartnerDashboard(BaseModel):
    status: str
    tier: PartnerRang
    next_tier: PartnerNaechsterRang | None = None
    kennzahlen: PartnerKennzahlen
    codes: list[PartnerCode]


class PartnerTeamMitglied(BaseModel):
    """Ein Team-Partner aus Sicht des Sponsors: wer, seit wann, Rang, wie viele
    zahlende Kunden, und was der Sponsor daran verdient. KEINE Kundendetails
    des Team-Partners — die gehören ihm."""

    affiliate_id: str
    name: str
    company: str | None = None
    status: str
    tier: PartnerRang
    joined_at: datetime | None = None
    # Zahlende Kunden seiner GANZEN Struktur — er selbst und alle Partner unter
    # ihm (Strukturvertrieb 0533), dieselbe Zählung wie für den Rang. Nicht nur
    # seine eigenen Kunden: ein Mitglied mit leerem eigenen Konto, aber drei
    # aktiven Ebenen darunter, ist für den Sponsor die wertvollste Zeile.
    paying_customers: int
    # Netto-Abo-Umsatz aller Kunden dieser Struktur (Basis der Overrides), je Währung.
    revenue_30d: list[Betrag]
    revenue_total: list[Betrag]
    override_pending: list[Betrag]
    override_approved: list[Betrag]
    override_paid: list[Betrag]
    flags: list[str] = Field(default_factory=list)


class PartnerTeamMonat(BaseModel):
    month: str  # YYYY-MM
    override: list[Betrag]
    revenue: list[Betrag]


class PartnerTeam(BaseModel):
    """Die Team-Auswertung des Sponsors."""

    # Nur gesetzt, wenn der eigene Rang Team-Partner führen darf (team_allowed, 0525).
    team_link: str | None = None
    team_allowed: bool = False
    # Eigener Satz — die Team-Provision ist die Differenz zwischen ihm und dem
    # höchsten darunter bereits vergüteten Satz (Roll-up, 0533).
    own_rate: str
    members: list[PartnerTeamMitglied]
    members_active: int
    # Summe der Struktur-Kunden aller direkten Mitglieder = alle Ebenen darunter.
    team_customers: int
    revenue_30d: list[Betrag]
    override_pending: list[Betrag]
    override_approved: list[Betrag]
    override_paid: list[Betrag]
    months: list[PartnerTeamMonat]  # 12 Monate
    # Wenn der Aufrufer selbst Team-Mitglied ist: sein Sponsor.
    sponsor: PartnerTeamSponsor | None = None


class PartnerTeamSponsor(BaseModel):
    affiliate_id: str
    name: str
    company: str | None = None
    joined_at: datetime | None = None


class TeamThread(BaseModel):
    id: str
    partner_id: str  # der jeweils andere
    partner_name: str
    role: Literal["sponsor", "member"]  # Rolle des ANDEREN im Verhältnis zu mir
    last_message_at: datetime | None = None
    unread: int = 0


class TeamNachricht(BaseModel):
    id: str
    thread_id: str
    sender_affiliate_id: str
    mine: bool
    body: str
    created_at: datetime


class TeamNachrichtSenden(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TeamThreadStarten(BaseModel):
    partner_id: str


class PartnerKunde(BaseModel):
    """Ein geworbener Betrieb — PSEUDONYM. Kein Name, keine E-Mail (Rewardful-
    Standard, Datenminimierung): der Partner braucht für seine Abrechnung
    Status, Zeitpunkte und Beträge, nicht die Identität."""

    id: str
    label: str
    country: str | None = None
    # registriert | zahlend | beendet | in_pruefung | abgelehnt
    status: str
    registered_at: datetime
    first_paid_at: datetime | None = None
    commission_until: datetime | None = None
    # Provisionssumme aus diesem Kunden je Währung (alle Zeilen, netto).
    earned: list[Betrag]


class PartnerProvision(BaseModel):
    id: str
    customer_label: str
    kind: ProvisionsArt
    # Bei override/lifetime/booking_share aus einem Team-Kunden: der Team-Partner,
    # aus dessen Kunde die Zeile stammt.
    source_partner_name: str | None = None
    amount: str
    currency: str
    base_amount: str
    rate: str
    tier_id: str
    status: str
    period: str | None = None
    matures_at: datetime | None = None
    created_at: datetime


class PartnerAuszahlung(BaseModel):
    id: str
    amount: str
    currency: str
    method: str
    status: str
    period_from: str | None = None
    period_to: str | None = None
    statement_no: str | None = None
    external_ref: str | None = None
    paid_at: datetime | None = None
    created_at: datetime


class PartnerMaterial(BaseModel):
    id: str
    kind: str
    title: str
    description: str | None = None
    language: str | None = None
    url: str | None = None
    body: str | None = None


class Seite(BaseModel):
    """Pagination-Rahmen."""

    total: int


class PartnerKundenListe(Seite):
    items: list[PartnerKunde]


class PartnerProvisionsListe(Seite):
    items: list[PartnerProvision]


class PartnerAuszahlungsListe(Seite):
    items: list[PartnerAuszahlung]


# --- Backoffice --------------------------------------------------------------


class BackofficePartner(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    company: str | None = None
    legal_form: str
    country: str
    vat_id: str | None = None
    vat_id_verified_at: datetime | None = None
    language: str
    channel_url: str | None = None
    channels: list[SocialKanal] = Field(default_factory=list)
    pitch: str | None = None
    status: str
    status_reason: str | None = None
    current_tier_id: str
    payout_method: str | None = None
    terms_version: str | None = None
    terms_accepted_at: datetime | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    # Kennzahlen für die Liste.
    referrals: int = 0
    paying_customers: int = 0
    # Tracking: Klicks der letzten 30 Tage und Reichweite (Summe der Follower
    # über alle Kanäle, Selbstauskunft).
    clicks_30d: int = 0
    reach: int = 0
    # Team (0520)
    sponsor_affiliate_id: str | None = None
    sponsor_name: str | None = None
    sponsor_joined_at: datetime | None = None
    sponsor_flags: list[str] = Field(default_factory=list)
    team_size: int = 0


class BackofficePartnerListe(Seite):
    items: list[BackofficePartner]


class BackofficeReferral(BaseModel):
    id: str
    affiliate_id: str
    tenant_id: str
    tenant_name: str | None = None
    tenant_country: str | None = None
    method: str
    status: str
    flags: list[str]
    contact_opt_in: bool
    first_paid_at: datetime | None = None
    commission_until: datetime | None = None
    review_note: str | None = None
    created_at: datetime


class BackofficeReferralListe(Seite):
    items: list[BackofficeReferral]


class BackofficeProvision(PartnerProvision):
    # None beim Aufstiegsbonus (hängt an keinem Betrieb, 0525).
    tenant_id: str | None = None
    stripe_invoice_id: str | None = None
    reason: str | None = None
    parent_id: str | None = None
    # Bei override: der Team-Partner (affiliate_id), dessen Ertragszeile die Quelle ist.
    source_affiliate_id: str | None = None


class BackofficeProvisionsListe(Seite):
    items: list[BackofficeProvision]


class TrackingTag(BaseModel):
    day: str  # YYYY-MM-DD
    clicks: int


class TrackingCode(BaseModel):
    code: str
    label: str | None = None
    active: bool
    clicks_30d: int
    clicks_90d: int
    registrations: int


class TrackingQuelle(BaseModel):
    name: str
    clicks: int


class TrackingReichweite(BaseModel):
    platform: str
    url: str
    handle: str | None = None
    followers: int | None = None


class BackofficeTracking(BaseModel):
    """Aufrufe und Reichweite eines Partners — Grundlage für die Prüfung, ob
    Reichweite (Selbstauskunft) und tatsächliche Klicks zusammenpassen."""

    clicks_7d: int
    clicks_30d: int
    clicks_90d: int
    clicks_by_day: list[TrackingTag]  # 30 Tage, lückenlos
    codes: list[TrackingCode]
    referrers: list[TrackingQuelle]  # Top 8, 90 Tage
    utm_sources: list[TrackingQuelle]  # Top 8, 90 Tage
    registrations: int
    registrations_30d: int
    paying_customers: int
    conversion_90d: float | None  # Registrierungen (90 T.) / Klicks (90 T.)
    reach_total: int
    reach: list[TrackingReichweite]
    # Team (0520): Abo-Umsatz der Team-Kunden und Override, je Währung.
    team_size: int = 0
    team_revenue_30d: list[Betrag] = Field(default_factory=list)
    team_revenue_90d: list[Betrag] = Field(default_factory=list)
    override_30d: list[Betrag] = Field(default_factory=list)
    override_90d: list[Betrag] = Field(default_factory=list)
    # Betrugsflags: Team-Flags des Partners, Referral-Flags seiner Kunden (gezählt).
    sponsor_flags: list[str] = Field(default_factory=list)
    referral_flags: list[TrackingQuelle] = Field(default_factory=list)


class BackofficeTrackingSummary(BaseModel):
    """Programm-Kennzahlen über alle Partner (Kopf der Backoffice-Liste)."""

    partners_total: int
    partners_approved: int
    partners_pending: int
    clicks_30d: int
    registrations_30d: int
    registrations_total: int
    paying_customers: int
    reach_total: int


class BackofficeTeamMitglied(BaseModel):
    affiliate_id: str
    name: str
    company: str | None = None
    email: EmailStr
    status: str
    current_tier_id: str
    joined_at: datetime | None = None
    flags: list[str] = Field(default_factory=list)
    paying_customers: int
    revenue_total: list[Betrag]
    override_total: list[Betrag]


class BackofficeTeam(BaseModel):
    sponsor: BackofficeTeamMitglied | None = None
    members: list[BackofficeTeamMitglied]
    override_pending: list[Betrag]
    override_approved: list[Betrag]
    override_paid: list[Betrag]


class BackofficeSponsorSetzen(BaseModel):
    """Sponsor setzen, umhängen oder lösen (null). Pflichtgrund, Audit."""

    sponsor_affiliate_id: str | None = None
    note: str = Field(min_length=3, max_length=1000)
    clear_flags: bool = False


class BackofficePartnerDetail(BaseModel):
    partner: BackofficePartner
    payout_details: dict[str, str]
    codes: list[PartnerCode]
    tier_history: list[dict]


class BackofficeEntscheidung(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=1000)


class BackofficeSperre(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class BackofficeReferralStatus(BaseModel):
    status: Literal["approved", "held", "rejected"]
    note: str = Field(min_length=3, max_length=1000)


class BackofficeManuelleZuordnung(BaseModel):
    tenant_id: str
    affiliate_id: str
    note: str = Field(min_length=3, max_length=1000)
    contact_opt_in: bool = False


class BackofficeKorrektur(BaseModel):
    """Manuelle Korrekturzeile (adjustment). Vorzeichen frei, Grund Pflicht."""

    amount: str = Field(pattern=r"^-?\d{1,9}(\.\d{1,2})?$")
    currency: str = Field(min_length=3, max_length=3)
    reason: str = Field(min_length=3, max_length=1000)
    referral_id: str | None = None


class BackofficeRangSetzen(BaseModel):
    tier_id: str
    note: str = Field(min_length=3, max_length=1000)


class PlatformOk(BaseModel):
    ok: bool = True


MaterialArt = Literal["video", "image", "text", "link"]


def _material_url_pruefen(url: str | None) -> str | None:
    """Nur http(s) — der Link landet als <a href> im Partner-Dashboard (Wurzel 8)."""
    if url is None:
        return None
    wert = url.strip()
    if not wert:
        return None
    if not wert.lower().startswith(("http://", "https://")):
        raise ValueError("Die Adresse muss mit http:// oder https:// beginnen.")
    return wert


class BackofficeMaterial(BaseModel):
    id: str
    kind: MaterialArt
    title: str
    description: str | None = None
    language: str | None = None
    url: str | None = None
    body: str | None = None
    sort: int
    active: bool
    created_at: str


class BackofficeMaterialAnlegen(BaseModel):
    """Werbematerial für alle Partner. Video/Bild/Link brauchen eine Adresse,
    ein Textbaustein den Text — sonst wäre die Karte im Dashboard leer."""

    kind: MaterialArt
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    language: str | None = Field(default=None, max_length=10)
    url: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, max_length=5000)
    sort: int = Field(default=0, ge=0, le=10000)
    active: bool = True

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _material_url_pruefen(v)

    @field_validator("language")
    @classmethod
    def _language(cls, v: str | None) -> str | None:
        wert = (v or "").strip().lower()
        return wert or None

    @model_validator(mode="after")
    def _inhalt(self) -> BackofficeMaterialAnlegen:
        if self.kind == "text" and not (self.body or "").strip():
            raise ValueError("Ein Textbaustein braucht einen Text.")
        if self.kind != "text" and not self.url:
            raise ValueError("Video, Bild und Link brauchen eine Adresse.")
        return self


class BackofficeMaterialAendern(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    language: str | None = Field(default=None, max_length=10)
    url: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, max_length=5000)
    sort: int | None = Field(default=None, ge=0, le=10000)
    active: bool | None = None

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _material_url_pruefen(v)


# --- Leads (0526) — Multiplikatoren-Liste im Backoffice ------------------------------

LeadKategorie = Literal["A", "B", "C", "D"]
LeadStatus = Literal["open", "contacted", "in_talks", "won", "declined", "parked"]


class LeadKanal(BaseModel):
    """Kanal eines Leads — gleiche Form wie SocialKanal, aber ohne Pflichten
    (ein Lead hat oft nur eine Adresse)."""

    platform: str = Field(default="website", max_length=40)
    url: str = Field(min_length=4, max_length=500)
    handle: str | None = Field(default=None, max_length=100)
    followers: int | None = Field(default=None, ge=0, le=1_000_000_000)

    @field_validator("url")
    @classmethod
    def _url_http(cls, v: str) -> str:
        return _http_url(v)


class BackofficeLead(BaseModel):
    id: str
    name: str
    organisation: str | None = None
    category: LeadKategorie
    channels: list[LeadKanal] = Field(default_factory=list)
    reach: int | None = None
    country: str | None = None
    language: str | None = None
    status: LeadStatus
    owner_user_id: str | None = None
    next_step: str | None = None
    next_step_at: str | None = None
    notes: str | None = None
    affiliate_id: str | None = None
    created_at: datetime
    updated_at: datetime


class BackofficeLeadAnlegen(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    category: LeadKategorie
    channels: list[LeadKanal] = Field(default_factory=list, max_length=12)
    reach: int | None = Field(default=None, ge=0, le=1_000_000_000)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    language: str | None = Field(default=None, max_length=5)
    status: LeadStatus = "open"
    owner_user_id: str | None = None
    next_step: str | None = Field(default=None, max_length=500)
    next_step_at: str | None = Field(default=None, max_length=10)
    notes: str | None = Field(default=None, max_length=5000)


class BackofficeLeadAendern(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    category: LeadKategorie | None = None
    channels: list[LeadKanal] | None = Field(default=None, max_length=12)
    reach: int | None = Field(default=None, ge=0, le=1_000_000_000)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    language: str | None = Field(default=None, max_length=5)
    status: LeadStatus | None = None
    owner_user_id: str | None = None
    next_step: str | None = Field(default=None, max_length=500)
    next_step_at: str | None = Field(default=None, max_length=10)
    notes: str | None = Field(default=None, max_length=5000)
    affiliate_id: str | None = None


class BackofficeLeadListe(Seite):
    items: list[BackofficeLead]


class BackofficeLeadImport(BaseModel):
    csv: str = Field(min_length=1, max_length=2_000_000)


class BackofficeLeadImportErgebnis(BaseModel):
    angelegt: int
    fehler: list[str]
