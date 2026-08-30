"""Pydantic-Schemas für den reviews-Slice (Betriebs-Cockpit, myNextDays).

Eine Bewertung kann aus zwei Welten kommen: vom myBestDays-Marktplatz
(``public.reviews``, Skala 1..5) oder von einem Portal über Channex
(``public.channex_review``, Skala 0..10). Damit das Cockpit EINE Liste zeigen
kann, wird beides auf ``UnifiedReview`` normalisiert — die Rohnote bleibt
mitsamt ihrer Skala erhalten, damit die Anzeige nichts erfindet (Wurzel 4).
"""
from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

# Harte Obergrenzen (Wurzel 8).
MAX_TEXT_LEN = 2000
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 25

# Kanal-Code der eigenen Marktplatz-Bewertungen. Deckungsgleich mit
# reservations.ota_name für Marktplatz-Buchungen (Migration 0239).
MARKETPLACE_CHANNEL = "myBestDays"


class ReviewSource(StrEnum):
    """Herkunft einer Bewertung — bestimmt Tabelle UND Schreibpfad."""

    marketplace = "marketplace"   # public.reviews (myBestDays)
    ota = "ota"                   # public.channex_review (Portale)


class ReviewScale(StrEnum):
    """Skala der Rohnote. Portale rechnen auf 10, myBestDays auf 5."""

    five = "1-5"
    ten = "0-10"


class AiSentiment(StrEnum):
    """Stimmung eines Bewertungstextes — drei Stufen, mehr trägt der Text nicht."""

    positiv = "positiv"
    neutral = "neutral"
    negativ = "negativ"


class AiThemeKey(StrEnum):
    """Der geschlossene Themen-Katalog der KI-Deutung.

    Deckungsgleich mit ``ki_deutung.THEMEN`` und der Domain
    ``public.ki_bewertungsthema`` (0501). Geschlossen, weil freie Themen nicht
    vergleichbar wären: „Lärm", „Lärmbelästigung" und „laute Nachbarn" wären
    drei Zeilen in jeder Rangliste. Ein achtes Thema wird an allen drei
    Stellen ergänzt — hier, im Modul und in der Migration.
    """

    sauberkeit = "sauberkeit"
    lage = "lage"
    ausstattung = "ausstattung"
    kommunikation = "kommunikation"
    anreise = "anreise"
    laerm = "laerm"
    preis = "preis"


class SliceHealth(BaseModel):
    status: str = "ok"
    slice: str = "reviews"


class CategoryScore(BaseModel):
    """Eine Kategorie-Note. `key` ist der Rohschlüssel des Kanals
    (myBestDays: cleanliness/…; Booking.com: clean/comfort/…), damit die
    Anzeige nichts zusammenlegt, was fachlich nicht dasselbe ist."""

    key: str
    score: float
    scale: ReviewScale
    # Aus welchen Kanälen dieser Durchschnitt stammt. Leer an einer einzelnen
    # Bewertung (dort ist der Kanal die Bewertung selbst), gefüllt im
    # Qualitäts-Dashboard: „comfort" gibt es nur bei Booking.com, „accuracy"
    # nur bei Airbnb — ein Durchschnitt über verschiedene Grundgesamtheiten
    # ohne diesen Hinweis ist irreführend.
    channels: list[str] = []


class AiTheme(BaseModel):
    """Ein Thema aus dem geschlossenen Katalog, mit seiner Richtung.

    ``richtung`` ist die Bewertung DIESES Themas, nicht der Gesamteindruck:
    ein Text kann die Lage loben und die Sauberkeit rügen.
    """

    thema: AiThemeKey
    richtung: AiSentiment


class ReviewAi(BaseModel):
    """Was die KI aus dem Text gelesen hat (0501).

    ``stimmung`` ist bewusst NICHT die Note: ein Gast kann fünf Sterne geben
    und im Text meckern — genau dieser Fall taucht in keiner Statistik auf.
    """

    stimmung: AiSentiment
    themen: list[AiTheme] = []
    kernaussage: str | None = None
    bewertet_at: datetime


class UnifiedReview(BaseModel):
    """Eine Bewertung, kanalunabhängig."""

    source: ReviewSource
    id: str
    channel_code: str
    property_id: str | None = None
    property_title: str | None = None
    author: str
    text: str | None = None
    # Rohnote wie vom Kanal geliefert, plus ihre Skala.
    score: float | None = None
    scale: ReviewScale
    # Auf 5 Sterne normalisiert — NUR für Sortierung/Durchschnitt in der
    # Oberfläche. None bleibt None (kein Ersatzwert, Wurzel 4).
    score_5: float | None = None
    categories: list[CategoryScore] = []
    reply: str | None = None
    reply_at: datetime | None = None
    is_replied: bool = False
    # Antwort noch möglich? Portale schließen ihr Antwortfenster (is_expired).
    can_reply: bool = True
    # myBestDays: double-blind — None heißt verdeckt.
    published_at: datetime | None = None
    # Portale: Airbnb hält die Bewertung verdeckt, bis beide Seiten abgegeben haben.
    is_hidden: bool = False
    reservation_id: str | None = None
    ota_reservation_id: str | None = None
    # Betrieb hat den Gast bereits bewertet (Zwei-Wege).
    guest_rated: bool = False
    received_at: datetime | None = None
    # KI-Deutung (0501). None heißt „noch nicht ausgewertet" — ausdrücklich
    # nicht „nichts gefunden". Ohne diese Unterscheidung sähe eine Bewertung,
    # die der Nachlauf noch nicht erreicht hat, aus wie eine ohne Aussage.
    ai: ReviewAi | None = None


class ReviewListResponse(BaseModel):
    items: list[UnifiedReview] = []
    total: int = 0
    limit: int
    offset: int


class ChannelSummary(BaseModel):
    channel_code: str
    count: int
    average_5: float | None = None
    unanswered: int = 0


class ReviewSummary(BaseModel):
    """Kennzahlen fürs Cockpit. Durchschnitte auf 5 Sterne normalisiert."""

    count: int = 0
    average_5: float | None = None
    unanswered: int = 0
    # Anteil beantworteter Bewertungen (0..1). None, wenn es keine gibt —
    # 100 % bei null Bewertungen wäre eine Lüge (Wurzel 4).
    response_rate: float | None = None
    by_channel: list[ChannelSummary] = []


class ReplyRequest(BaseModel):
    reply: str = Field(min_length=1, max_length=MAX_TEXT_LEN)


class GuestScores(BaseModel):
    """Gast-Kategorien (Betrieb bewertet Gast): je 1..5, optional."""

    cleanliness: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    house_rules: int | None = Field(default=None, ge=1, le=5)


class RateGuestRequest(BaseModel):
    """Betrieb bewertet einen Gast (Zwei-Wege, myBestDays). reservation_id
    identifiziert Buchung/Gast/Objekt server-seitig (Wurzel 3) — nichts davon
    kommt aus dem Client."""

    reservation_id: str
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    scores: GuestScores = Field(default_factory=GuestScores)


class GuestReviewByHost(BaseModel):
    """Eine Betrieb→Gast-Bewertung (Zwei-Wege)."""

    id: str
    reservation_id: str
    property_id: str
    rating: int
    text: str | None = None
    scores: GuestScores = Field(default_factory=GuestScores)
    published_at: datetime | None = None
    created_at: datetime


class OtaGuestReviewRequest(BaseModel):
    """Gast bei einem Portal bewerten (nur Airbnb). Die Kategorien sind
    Airbnb-eigen und werden 1:1 durchgereicht — Channex validiert sie."""

    rating: int = Field(ge=1, le=5)
    public_review: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    private_review: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    recommended: bool = True
    scores: GuestScores = Field(default_factory=GuestScores)


class AutomationConfig(BaseModel):
    """Automatik je Betrieb: Gast automatisch bewerten + Erinnerung an den Gast."""

    auto_review_active: bool = False
    auto_review_after_days: int = Field(default=3, ge=0, le=30)
    # Nur bewerten, wenn der Gast selbst mindestens so gut bewertet hat.
    # None = immer bewerten.
    auto_review_min_rating: int | None = Field(default=None, ge=1, le=5)
    auto_review_rating: int = Field(default=5, ge=1, le=5)
    auto_review_public: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    auto_review_private: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    guest_reminder_active: bool = False
    guest_reminder_after_days: int = Field(default=2, ge=0, le=30)


class QueueStatus(StrEnum):
    """Zustand eines geplanten Eintrags."""

    geplant = "geplant"
    gesendet = "gesendet"
    uebersprungen = "uebersprungen"
    abgelaufen = "abgelaufen"
    fehler = "fehler"


class QueueEntry(BaseModel):
    """Eine geplante Bewertung des Betriebs über seinen Gast."""

    id: str
    source: ReviewSource
    status: QueueStatus
    property_id: str | None = None
    property_title: str | None = None
    guest_name: str | None = None
    reservation_id: str | None = None
    review_id: str | None = None
    send_at: datetime
    expires_at: datetime | None = None
    # Tage bis zum Versand bzw. bis das Fenster zugeht. Negativ = überfällig.
    # None, wenn die Frist des Kanals unbekannt ist (kein geratenes Datum).
    days_until_send: int | None = None
    days_left: int | None = None
    rating: int
    text: str | None = None
    private_text: str | None = None
    scores: GuestScores = Field(default_factory=GuestScores)
    recommended: bool = True
    tags: list[str] = []
    sent_at: datetime | None = None
    error: str | None = None


class QueueListResponse(BaseModel):
    items: list[QueueEntry] = []
    total: int = 0
    limit: int
    offset: int


class QueueUpdateRequest(BaseModel):
    """Änderung an einem geplanten Eintrag. Alles optional — was fehlt, bleibt."""

    rating: int | None = Field(default=None, ge=1, le=5)
    text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    private_text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    recommended: bool | None = None
    score_cleanliness: int | None = Field(default=None, ge=1, le=5)
    score_communication: int | None = Field(default=None, ge=1, le=5)
    score_house_rules: int | None = Field(default=None, ge=1, le=5)


class QualityPoint(BaseModel):
    """Ein Tag der Zeitreihe. `average_5` ist None an Tagen ohne Bewertung —
    eine 0 würde einen Einbruch vortäuschen, den es nicht gab (Wurzel 4)."""

    date: date
    count: int
    average_5: float | None = None


class QualityProperty(BaseModel):
    property_id: str
    title: str | None = None
    count: int
    average_5: float | None = None
    unanswered: int = 0


class QualityDashboard(BaseModel):
    """Qualitäts-Kennzahlen über einen Zeitraum, alle Kanäle zusammen."""

    from_date: date
    to_date: date
    count: int = 0
    average_5: float | None = None
    # Anteil der Bewertungen mit 5 Sternen (0..1). None ohne Bewertungen.
    five_star_rate: float | None = None
    response_rate: float | None = None
    # Kategorie-Durchschnitte, Rohschlüssel des Kanals (clean ≠ cleanliness).
    categories: list[CategoryScore] = []
    series: list[QualityPoint] = []
    by_property: list[QualityProperty] = []


class SyncResponse(BaseModel):
    mirrored: int = 0


class TickResponse(BaseModel):
    published: int = 0
    mirrored: int = 0
    queued: int = 0
    guest_rated: int = 0
    expired: int = 0
    reminders_sent: int = 0


class AiThemeCount(BaseModel):
    """Wie oft ein Thema vorkam, aufgeteilt nach Richtung.

    Die Aufteilung ist der Punkt: „Lage: 40-mal genannt" sagt nichts, „Lage:
    38 positiv, 2 negativ" ist ein Befund. Ein Thema, das nur zählt, wie oft
    es vorkam, würde ein gelobtes Objekt wie ein bemängeltes aussehen lassen.
    """

    thema: AiThemeKey
    positiv: int = 0
    neutral: int = 0
    negativ: int = 0

    @property
    def gesamt(self) -> int:
        return self.positiv + self.neutral + self.negativ


class AiSentimentPoint(BaseModel):
    """Ein Tag der Stimmungs-Zeitreihe. Zähler, keine Quote — bei zwei
    Bewertungen am Tag wären 50 % eine Zahl, die mehr behauptet als sie weiß."""

    date: date
    positiv: int = 0
    neutral: int = 0
    negativ: int = 0


class AiInsights(BaseModel):
    """Die KI-Auswertung über einen Zeitraum — Grundlage des Dashboards.

    ``ausgewertet`` und ``gesamt`` stehen nebeneinander, damit sichtbar ist,
    auf wie viel die Aussage beruht. Eine Themenrangliste aus 12 von 400
    Bewertungen ist keine Aussage über das Objekt, und der Nutzer muss das
    sehen können, ohne es zu erraten.
    """

    from_date: date
    to_date: date
    gesamt: int = 0
    ausgewertet: int = 0
    positiv: int = 0
    neutral: int = 0
    negativ: int = 0
    themen: list[AiThemeCount] = []
    series: list[AiSentimentPoint] = []


class AiBilanz(BaseModel):
    """Die Verbesserungs-Zusammenfassung eines Objekts.

    ``grundlage`` ist die Anzahl der eingegangenen Bewertungen — ohne sie
    wäre nicht unterscheidbar, ob die Empfehlung auf drei oder auf sechzig
    Texten beruht.
    """

    property_id: str
    property_title: str | None = None
    grundlage: int
    staerken: list[str] = []
    schwaechen: list[str] = []
    empfehlungen: list[str] = []
    zusammenfassung: str = ""


class AiRunResponse(BaseModel):
    """Ergebnis eines Deutungs-Nachlaufs."""

    gedeutet: int = 0
    fehler: int = 0


# ------------------------------------------------- Auto-Bewertungs-Vorlagen
# Mindestzahl der Texte, die wir EMPFEHLEN. Kein harter Zwang wie bei
# Hostaway („at least 3"): ein Betrieb mit fünf Buchungen im Jahr braucht
# keine drei Varianten, und ein Formular, das ohne Grund blockiert, wird
# umgangen statt befolgt. Die Oberfläche warnt, sie verbietet nicht.
EMPFOHLENE_TEXTE = 3

# Harte Obergrenze (Wurzel 8): mehr Varianten machen den Zufall nicht
# zufälliger, aber die Zeile größer.
MAX_TEXTE = 10


class AutoTemplate(BaseModel):
    """Eine Auto-Bewertungs-Vorlage.

    Anders als bei Hostaway ist die Note NICHT fest auf 5 verdrahtet
    (dort: „It is not possible to modify this in the auto-review") — unsere
    freie Wahl plus `min_gastnote` ist die reifere Lösung.
    """

    id: str
    name: str
    aktiv: bool = True
    nach_tagen: int = 3
    note: int = 5
    # „Nur bewerten, wenn der Gast selbst mindestens so gut bewertet hat."
    # None = immer bewerten.
    min_gastnote: int | None = None
    # Mehrere Texte, aus denen der Versand zufällig einen zieht. Der Grund ist
    # ein Betriebsbefund, kein Geschmack: Airbnb straft identische Bewertungen
    # ab („Airbnb may penalize this practice, and it may affect the SEO").
    texte: list[str] = []
    privater_text: str | None = None
    property_ids: list[str] = []
    created_at: datetime | None = None


class AutoTemplateRequest(BaseModel):
    """Anlegen oder Ändern einer Vorlage."""

    name: str = Field(min_length=1, max_length=120)
    aktiv: bool = True
    nach_tagen: int = Field(default=3, ge=0, le=30)
    note: int = Field(default=5, ge=1, le=5)
    min_gastnote: int | None = Field(default=None, ge=1, le=5)
    texte: list[str] = Field(default_factory=list, max_length=MAX_TEXTE)
    privater_text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    property_ids: list[str] = Field(default_factory=list, max_length=500)


class AutoTemplateList(BaseModel):
    items: list[AutoTemplate] = []
