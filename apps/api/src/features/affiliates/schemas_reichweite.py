"""Schemas der Reichweiten-Etappe (0521): Beiträge, verbundene Konten,
Snapshots, Verdachtsprüfung. Eigene Datei neben `schemas.py`, damit die
Etappe ohne Eingriff in den Kern des Slice wächst.

Zeitstempel: `measured_at` ist IMMER der Zeitpunkt der Plattformantwort
(Wurzel 5b), `published_at` die Angabe des Partners. `created_at` heißt so,
weil es unsere Verarbeitung beschreibt.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .kanaele import Plattform

# OAuth-Anbieter: EIN Meta-Login liefert Instagram- UND Facebook-Konten.
Provider = Literal["youtube", "meta", "tiktok"]
PROVIDERS: tuple[str, ...] = Provider.__args__  # type: ignore[attr-defined]

# Plattform → Anbieter, der sie verifizieren kann. Alle übrigen Plattformen
# aus kanaele.py bleiben Selbstauskunft.
PROVIDER_JE_PLATTFORM: dict[str, str] = {
    "youtube": "youtube",
    "instagram": "meta",
    "facebook": "meta",
    "tiktok": "tiktok",
}

UTM_CONTENT_RE = r"^[a-z0-9][a-z0-9._-]{1,79}$"


def _http_url(v: str | None) -> str | None:
    if v is None:
        return None
    w = v.strip()
    if not w:
        return None
    # Wurzel 8: der Wert landet als Link im Backoffice und im Dashboard.
    if not (w.startswith("https://") or w.startswith("http://")):
        raise ValueError("Die Adresse muss mit http:// oder https:// beginnen.")
    return w[:500]


# --- Stufe A: Beiträge ------------------------------------------------------------


class PartnerBeitragAnlegen(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    platform: Plattform
    url: str | None = Field(default=None, max_length=500)
    # Veröffentlichung laut Partner — kein Ersatz durch unsere Uhr.
    published_at: datetime | None = None
    # Optional eigener utm_content; fehlt er, wird er aus dem Titel gebildet.
    utm_content: str | None = Field(
        default=None, min_length=2, max_length=80, pattern=UTM_CONTENT_RE
    )

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _http_url(v)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        w = " ".join(v.split())
        if not w:
            raise ValueError("Titel fehlt.")
        return w


class PartnerBeitragAendern(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    url: str | None = Field(default=None, max_length=500)
    published_at: datetime | None = None

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _http_url(v)


class BeitragMetrik(BaseModel):
    """Letzter Snapshot des Beitrags von der Plattform (None = kein Konto verbunden
    oder Beitrag dort nicht gefunden)."""

    measured_at: datetime
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None


VideoStand = Literal["draft", "submitted", "approved", "rejected"]


class PartnerBeitrag(BaseModel):
    id: str
    code_id: str
    code: str
    platform: str
    url: str | None
    title: str
    utm_content: str
    # Fertiger Link mit utm-Parametern. None, wenn MARKETING_BASE_URL fehlt ODER
    # das Video noch nicht freigegeben ist (0523) — ohne Freigabe kein Link.
    link: str | None
    # Freigabestand des Videos: draft (noch nichts hochgeladen), submitted
    # (liegt zur Prüfung), approved (Link da), rejected (abgelehnt/widerrufen).
    review_status: VideoStand = "draft"
    review_reason_code: AblehnungsGrund | None = None
    # Grund der Ablehnung — der Partner muss erfahren, was zu ändern ist.
    review_note: str | None = None
    video_vorhanden: bool = False
    video_uploaded_at: datetime | None = None
    published_at: datetime | None
    created_at: datetime
    # Aus unseren Daten: Klicks (90 Tage Aufbewahrung), Registrierungen, zahlende Kunden.
    clicks_30d: int = 0
    clicks_90d: int = 0
    registrations: int = 0
    paying_customers: int = 0
    # Aus der Plattform (Stufe B), falls verbunden.
    metrics: BeitragMetrik | None = None
    # Klicks (90 T.) je 1.000 Views — None ohne Views.
    clicks_per_1000_views: float | None = None


class BackofficeBeitrag(PartnerBeitrag):
    affiliate_id: str
    partner_name: str


class BackofficeVideoBeitrag(BaseModel):
    """Ein Beitrag in der Prüfliste des Backoffice — mit signierter Adresse zum
    Ansehen des noch unveröffentlichten Videos."""

    id: str
    affiliate_id: str
    partner_name: str | None = None
    partner_email: str | None = None
    platform: str
    title: str
    url: str | None = None
    review_status: VideoStand
    review_reason_code: AblehnungsGrund | None = None
    review_note: str | None = None
    review_runde: int = 0
    video_url: str | None = None
    video_size: int | None = None
    video_mime: str | None = None
    video_uploaded_at: datetime | None = None
    created_at: datetime


class VideoAdresse(BaseModel):
    """Kurzlebige signierte Adresse eines Videos. None, wenn keines liegt —
    das ist kein Fehler, sondern der Normalzustand eines neuen Beitrags."""

    url: str | None = None


# Feste Ablehnungsgründe (0526) — die Content-Regeln des Programms, auswertbar:
# material = nicht nur offizielles Material / eigene Bildschirmaufnahmen ·
# promise = Garantie-/Erfolgsversprechen · disclosure = Kennzeichnung fehlt ·
# brand = Markenverstoß · other = nur Freitext.
AblehnungsGrund = Literal["material", "promise", "disclosure", "brand", "other"]
ABLEHNUNGSGRUENDE: tuple[str, ...] = ("material", "promise", "disclosure", "brand", "other")


class VideoEntscheidung(BaseModel):
    """Freigabe oder Ablehnung eines Beitrags (Video, Bild, PDF).

    Bei `frei=False` sind `reason_code` (Prüfliste) UND `note` Pflicht (im
    Service geprüft): eine Ablehnung ohne Grund kostet beide Seiten einen
    zweiten Durchlauf, und ohne Kategorie ist nicht auswertbar, woran Beiträge
    scheitern.
    """

    frei: bool
    reason_code: AblehnungsGrund | None = None
    note: str | None = Field(default=None, max_length=2000)


# --- Stufe B: verbundene Konten ------------------------------------------------------


class KanalVerbindung(BaseModel):
    id: str
    provider: str
    platform: str
    external_account_id: str
    account_name: str | None
    account_url: str | None
    connected_at: datetime
    revoked_at: datetime | None
    revoked_reason: str | None
    last_sync_at: datetime | None
    last_error: str | None
    # Letzter Snapshot (None = noch keiner).
    followers: int | None = None
    views_28d: int | None = None
    engagement_rate: float | None = None
    posts_count: int | None = None
    measured_at: datetime | None = None


class KanalAnbieterStatus(BaseModel):
    """Ob ein Anbieter im Dashboard verbindbar ist. `configured=False` heißt:
    Zugangsdaten fehlen in der Umgebung (das Log sagt welche)."""

    provider: str
    platforms: list[str]
    configured: bool


class KanalUebersicht(BaseModel):
    providers: list[KanalAnbieterStatus]
    connections: list[KanalVerbindung]


class KanalAutorisierung(BaseModel):
    provider: str
    url: str


class KanalVerbinden(BaseModel):
    code: str = Field(min_length=1, max_length=2000)
    state: str = Field(min_length=1, max_length=1000)


class KanalVerbundenAntwort(BaseModel):
    connections: list[KanalVerbindung]


# --- Stufe C: Auswertung ---------------------------------------------------------------


class FollowerTag(BaseModel):
    day: str  # YYYY-MM-DD
    followers: int | None


class KanalReichweite(BaseModel):
    platform: str
    account_name: str | None
    account_url: str | None
    verified: bool
    followers_verified: int | None
    followers_self_reported: int | None
    # Abweichung Selbstauskunft − verifiziert in Prozent des verifizierten Werts.
    deviation_pct: float | None
    views_28d: int | None
    engagement_rate: float | None
    posts_count: int | None
    measured_at: datetime | None
    follower_history: list[FollowerTag]  # 90 Tage, nur Tage mit Snapshot
    # Klicks, deren utm_source bzw. Referrer diese Plattform nennt.
    clicks_28d: int
    clicks_90d: int
    # Klicks (28 T.) je 1.000 Views (28 T.) — gleiches Fenster, sonst Äpfel und Birnen.
    clicks_per_1000_views: float | None
    revoked_at: datetime | None
    last_error: str | None = None


class ReichweiteFlag(BaseModel):
    key: str
    # Betroffener Kanal/Beitrag (Plattform oder Beitragstitel).
    subject: str
    # Gemessener Wert und Schwelle, damit das Backoffice die Entscheidung nachvollziehen kann.
    value: float
    threshold: float
    detail: str


class ReichweiteSchwelle(BaseModel):
    key: str
    value: float | None
    description: str
    updated_at: datetime


class ReichweiteSchwelleSetzen(BaseModel):
    value: float | None = Field(default=None, ge=0)


class BackofficeReichweite(BaseModel):
    """Reichweite eines Partners: verifiziert (Snapshots) neben Selbstauskunft, plus Flags."""

    channels: list[KanalReichweite]
    reach_verified: int
    reach_self_reported: int
    flags: list[ReichweiteFlag]
    posts: list[BackofficeBeitrag]


class ReichweiteTopKanal(BaseModel):
    affiliate_id: str
    partner_name: str
    platform: str
    followers: int
    paying_customers: int
    customers_per_1000_followers: float


class BackofficeReichweiteSummary(BaseModel):
    reach_verified: int
    reach_self_reported: int
    connections_active: int
    connections_revoked: int
    partners_with_connection: int
    flags_total: int
    top_channels: list[ReichweiteTopKanal]  # nach Kunden je 1.000 Follower
    top_posts: list[BackofficeBeitrag]  # nach zahlenden Kunden, dann Klicks


class PartnerReichweite(BaseModel):
    """Eigene Werte des Partners — nie die anderer Partner."""

    channels: list[KanalReichweite]
    posts: list[PartnerBeitrag]
