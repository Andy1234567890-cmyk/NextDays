"""Service-Schicht für reviews — das Bewertungs-Cockpit des Betriebs (myNextDays).

EINE Liste über ALLE Kanäle: die eigenen Marktplatz-Bewertungen aus
``public.reviews`` (myBestDays, Skala 1..5) und die Portal-Bewertungen aus
``public.channex_review`` (Booking.com/Airbnb/Expedia, Skala 0..10). Gelesen
wird aus beiden Tabellen und in ``UnifiedReview`` zusammengeführt; GESCHRIEBEN
wird quellenspezifisch — eine Portal-Antwort muss zuerst beim Portal ankommen,
erst dann steht sie im eigenen Bestand (Wurzel 1).

Scope (Wurzel 3/9): jeder Zugriff ist tenant-gescopt, und ein Eigentümer sieht
ausschließlich Bewertungen SEINER Objekte — im Detail-/Schreibpfad genauso wie
in der Liste. Eigentümer sind read-only (§4.2): antworten und bewerten ist
ihnen verwehrt, auch wenn sie die Bewertung sehen.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any, TypeVar

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client, load_scoped
from src.features.auth.owner_scope import is_owner, owner_property_ids

from .common import (
    REVIEW_COLUMNS,
    SCORE_COLUMNS,
    as_dt,
    mask_author,
    plaintext,
    scores_map,
)
from .publication import resolve_publication
from .queue import ReviewQueue
from .schemas import (
    MARKETPLACE_CHANNEL,
    MAX_PAGE_SIZE,
    AutomationConfig,
    CategoryScore,
    ChannelSummary,
    GuestReviewByHost,
    GuestScores,
    OtaGuestReviewRequest,
    QualityDashboard,
    QualityPoint,
    QualityProperty,
    QueueEntry,
    QueueListResponse,
    QueueStatus,
    QueueUpdateRequest,
    RateGuestRequest,
    ReviewListResponse,
    ReviewScale,
    ReviewSource,
    ReviewSummary,
    SliceHealth,
    UnifiedReview,
)

if TYPE_CHECKING:  # nur für die Typen — zur Laufzeit wird lazy importiert
    from src.features.channel_manager.service import ChannelManagerService

    from .automation import ReviewAutomation

log = get_logger("nextdays.reviews")

T = TypeVar("T")

# Platzhalter-Nutzer für Server-eigene Vorgänge (Tick). Eine echte UUID, damit
# owner_scope-Abfragen nicht an einem ungültigen uuid-Literal scheitern; sie
# gehört keinem Konto, und die Rolle `admin` umgeht den Owner-Zweig ohnehin.
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

# Spalten der Portal-Bewertung (raw bleibt draußen — der Rohsatz ist nur für
# die Fehlersuche und enthält Gast-PII, die niemand in der Liste braucht).
_OTA_COLUMNS = (
    "id, tenant_id, property_id, channex_review_id, ota, ota_reservation_id, "
    "guest_name, content, overall_score, scores, is_hidden, is_replied, "
    "is_expired, reply, reply_at, guest_review_sent_at, received_at, created_at"
)

# Höchstspanne des Qualitäts-Dashboards (Wurzel 8: unbegrenzter Zeitraum wäre
# eine unbegrenzte Antwort — die Zeitreihe hat einen Punkt je Tag).
_QUALITY_MAX_DAYS = 366

# Spalten der Automatik-Konfiguration (Reihenfolge egal, Vollständigkeit zählt).
_AUTOMATION_COLUMNS = (
    "tenant_id, auto_review_active, auto_review_after_days, auto_review_min_rating, "
    "auto_review_rating, auto_review_public, auto_review_private, "
    "guest_reminder_active, guest_reminder_after_days"
)


class ReviewError(Exception):
    """Fehler des reviews-Slice mit HTTP-Status."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _score_5_from_ten(value: object) -> float | None:
    """Portal-Note (0..10) auf 5 Sterne normalisieren. None bleibt None."""
    if value is None:
        return None
    try:
        return round(float(value) / 2, 2)
    except (TypeError, ValueError):
        return None


def _ota_categories(raw: object) -> list[CategoryScore]:
    """``scores``-Array einer Portal-Bewertung → Kategorien. Einträge ohne
    brauchbare Note werden verworfen, statt eine 0 zu erfinden (Wurzel 4)."""
    if not isinstance(raw, list):
        return []
    out: list[CategoryScore] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        key = entry.get("category")
        value = entry.get("score", entry.get("rating"))
        if not isinstance(key, str) or value is None:
            continue
        try:
            score = float(value)
        except (TypeError, ValueError):
            continue
        out.append(CategoryScore(key=key, score=score, scale=ReviewScale.ten))
    return out


class ReviewsService:
    """Cockpit über beide Bewertungs-Welten (service_role, applikativ gescopt)."""

    def __init__(
        self,
        service_client: Client | None = None,
        *,
        channel_manager: ChannelManagerService | None = None,
    ) -> None:
        self._client = service_client
        self._cm = channel_manager

    def _db(self) -> Client:
        if self._client is None:
            self._client = get_service_client()
        return self._client

    def _channel_manager(self) -> ChannelManagerService:
        """Portal-Anbindung nachladen. Der Import liegt bewusst in der Methode:
        der channel_manager zieht den Channex-Client mit, den die reinen
        Lesepfade dieses Slice nicht brauchen."""
        if self._cm is None:
            from src.features.channel_manager.service import ChannelManagerService

            self._cm = ChannelManagerService(service_client=self._db())
        return self._cm

    def health(self) -> SliceHealth:
        return SliceHealth()

    def queue(self) -> ReviewQueue:
        return ReviewQueue(self._db())

    @staticmethod
    def system_context(tenant_id: str) -> AuthContext:
        """Kontext für Server-eigene Vorgänge (Worker-Tick). Rolle `admin`, weil
        der Vorgang im Namen des Betriebs läuft — der Scope kommt aus dem
        tenant_id, nicht aus einem Nutzer. Wird NIE aus einem Request gebaut."""
        return AuthContext(user_id=SYSTEM_USER_ID, tenant_id=tenant_id, role="admin")

    # ------------------------------------------------------------------ scope
    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise ReviewError("Kein Tenant im Konto.", status_code=403)
        return self._db(), ctx.tenant_id

    def _require_write(self, ctx: AuthContext) -> tuple[Client, str]:
        """Wie _require, aber Eigentümer sind read-only (§4.2)."""
        db, tenant_id = self._require(ctx)
        if is_owner(ctx):
            raise ReviewError("Keine Berechtigung.", status_code=403)
        return db, tenant_id

    def _visible_property_ids(
        self, db: Client, ctx: AuthContext
    ) -> list[str] | None:
        """Objekt-Einschränkung des Aufrufers. None = alle Objekte des Tenants.

        Eigentümer sehen nur ihre zugeordneten Objekte — dieselbe Einschränkung
        gilt in Liste, Detail und Schreibpfad (Wurzel 9)."""
        if not is_owner(ctx):
            return None
        return sorted(owner_property_ids(db, ctx))

    # ------------------------------------------------------------------- list
    def list_reviews(  # noqa: PLR0913 — Filter des Cockpits, jeder optional
        self,
        ctx: AuthContext,
        *,
        source: ReviewSource | None = None,
        property_id: str | None = None,
        channel_code: str | None = None,
        unanswered: bool = False,
        limit: int,
        offset: int,
    ) -> ReviewListResponse:
        """Vereinte Liste, neueste zuerst. Beide Quellen werden bis
        ``offset + limit`` geladen, zusammengeführt und dann geschnitten —
        eine SQL-seitige Union über zwei Tabellen mit unterschiedlichem Schema
        gibt PostgREST nicht her."""
        db, tenant_id = self._require(ctx)
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        offset = max(0, offset)
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and not eigene:
            return ReviewListResponse(items=[], total=0, limit=limit, offset=offset)
        if property_id and eigene is not None and property_id not in eigene:
            raise ReviewError("Objekt nicht gefunden.", status_code=404)

        bedarf = offset + limit
        items: list[UnifiedReview] = []
        total = 0

        if source in (None, ReviewSource.marketplace) and channel_code in (
            None,
            MARKETPLACE_CHANNEL,
        ):
            markt, markt_total = self._load_marketplace(
                db,
                tenant_id,
                property_ids=eigene,
                property_id=property_id,
                unanswered=unanswered,
                limit=bedarf,
            )
            items.extend(markt)
            total += markt_total

        if source in (None, ReviewSource.ota) and channel_code != MARKETPLACE_CHANNEL:
            ota, ota_total = self._load_ota(
                db,
                tenant_id,
                property_ids=eigene,
                property_id=property_id,
                channel_code=channel_code,
                unanswered=unanswered,
                limit=bedarf,
            )
            items.extend(ota)
            total += ota_total

        items.sort(key=self._sortkey, reverse=True)
        return ReviewListResponse(
            items=items[offset : offset + limit],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def _sortkey(review: UnifiedReview) -> datetime:
        """Neueste zuerst. Fehlt der Zeitstempel, sortiert die Bewertung ans
        Ende statt die Sortierung zu sprengen."""
        return review.received_at or datetime.min.replace(tzinfo=UTC)

    def _load_marketplace(  # noqa: PLR0913 — Filter durchgereicht
        self,
        db: Client,
        tenant_id: str,
        *,
        property_ids: list[str] | None,
        property_id: str | None,
        unanswered: bool,
        limit: int,
    ) -> tuple[list[UnifiedReview], int]:
        query = (
            db.table("reviews")
            .select(
                REVIEW_COLUMNS
                + ", portal_guests(name), properties!inner(id, title, tenant_id)",
                count="exact",
            )
            .eq("properties.tenant_id", tenant_id)
        )
        if property_id:
            query = query.eq("property_id", property_id)
        elif property_ids is not None:
            query = query.in_("property_id", property_ids)
        if unanswered:
            query = query.is_("host_reply", "null")
        res = (
            query.order("created_at", desc=True)
            .range(0, max(limit, 1) - 1)
            .execute()
        )
        rows = res.data or []
        total = res.count if res.count is not None else len(rows)
        bereits = self._reservations_mit_gastbewertung(
            db, tenant_id, [str(r["reservation_id"]) for r in rows if r.get("reservation_id")]
        )
        return [self._to_marketplace(r, bereits) for r in rows], total

    @staticmethod
    def _reservations_mit_gastbewertung(
        db: Client, tenant_id: str, reservation_ids: list[str]
    ) -> set[str]:
        """Reservierungen, für die der Betrieb den Gast SCHON bewertet hat — in
        EINER Abfrage für die ganze Seite. Ohne das stünde an jeder Zeile weiter
        „Gast bewerten" und der Klick liefe in einen 409."""
        if not reservation_ids:
            return set()
        rows = (
            db.table("guest_reviews_by_host")
            .select("reservation_id")
            .eq("tenant_id", tenant_id)
            .in_("reservation_id", sorted(set(reservation_ids)))
            .execute()
        ).data or []
        return {str(r["reservation_id"]) for r in rows}

    def _load_ota(  # noqa: PLR0913 — Filter durchgereicht
        self,
        db: Client,
        tenant_id: str,
        *,
        property_ids: list[str] | None,
        property_id: str | None,
        channel_code: str | None,
        unanswered: bool,
        limit: int,
    ) -> tuple[list[UnifiedReview], int]:
        query = (
            db.table("channex_review")
            .select(_OTA_COLUMNS + ", properties(id, title)", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("is_archived", False)
        )
        if property_id:
            query = query.eq("property_id", property_id)
        elif property_ids is not None:
            query = query.in_("property_id", property_ids)
        if channel_code:
            query = query.eq("ota", channel_code)
        if unanswered:
            query = query.eq("is_replied", False)
        res = (
            query.order("received_at", desc=True)
            .range(0, max(limit, 1) - 1)
            .execute()
        )
        rows = res.data or []
        total = res.count if res.count is not None else len(rows)
        return [self._to_ota(r) for r in rows], total

    # ------------------------------------------------------------- Abbildungen
    @staticmethod
    def _to_marketplace(
        row: dict, guest_rated: set[str] | None = None
    ) -> UnifiedReview:
        prop = row.get("properties") or {}
        rating = int(row["rating"])
        categories = [
            CategoryScore(key=key, score=float(value), scale=ReviewScale.five)
            for key, value in scores_map(row).items()
            if value is not None
        ]
        return UnifiedReview(
            source=ReviewSource.marketplace,
            id=str(row["id"]),
            channel_code=MARKETPLACE_CHANNEL,
            property_id=str(row["property_id"]),
            property_title=prop.get("title"),
            author=mask_author((row.get("portal_guests") or {}).get("name")),
            text=row.get("text"),
            score=float(rating),
            scale=ReviewScale.five,
            score_5=float(rating),
            categories=categories,
            reply=row.get("host_reply"),
            reply_at=as_dt(row.get("host_reply_at")),
            is_replied=bool(row.get("host_reply")),
            published_at=as_dt(row.get("published_at")),
            reservation_id=(
                str(row["reservation_id"]) if row.get("reservation_id") else None
            ),
            guest_rated=bool(
                guest_rated and str(row.get("reservation_id") or "") in guest_rated
            ),
            received_at=as_dt(row.get("created_at")),
        )

    @staticmethod
    def _to_ota(row: dict) -> UnifiedReview:
        prop = row.get("properties") or {}
        score = row.get("overall_score")
        return UnifiedReview(
            source=ReviewSource.ota,
            id=str(row["id"]),
            channel_code=row.get("ota") or "unbekannt",
            property_id=str(row["property_id"]) if row.get("property_id") else None,
            property_title=prop.get("title"),
            author=mask_author(row.get("guest_name")),
            text=row.get("content"),
            score=float(score) if score is not None else None,
            scale=ReviewScale.ten,
            score_5=_score_5_from_ten(score),
            categories=_ota_categories(row.get("scores")),
            reply=row.get("reply"),
            reply_at=as_dt(row.get("reply_at")),
            is_replied=bool(row.get("is_replied")),
            can_reply=not bool(row.get("is_expired")),
            is_hidden=bool(row.get("is_hidden")),
            ota_reservation_id=row.get("ota_reservation_id"),
            guest_rated=bool(row.get("guest_review_sent_at")),
            received_at=as_dt(row.get("received_at") or row.get("created_at")),
        )

    # ---------------------------------------------------------------- Kennzahl
    def summary(self, ctx: AuthContext) -> ReviewSummary:
        """Kennzahlen über ALLE Kanäle. Durchschnitte auf 5 Sterne normalisiert,
        damit Booking-Zehntel und myBestDays-Sterne vergleichbar sind."""
        db, tenant_id = self._require(ctx)
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and not eigene:
            return ReviewSummary()

        je_kanal: dict[str, list[float | None]] = {}
        offen: dict[str, int] = {}

        markt = db.table("reviews").select(
            "rating, host_reply, properties!inner(tenant_id)"
        ).eq("properties.tenant_id", tenant_id)
        if eigene is not None:
            markt = markt.in_("property_id", eigene)
        for row in (markt.execute().data or []):
            je_kanal.setdefault(MARKETPLACE_CHANNEL, []).append(float(row["rating"]))
            if not row.get("host_reply"):
                offen[MARKETPLACE_CHANNEL] = offen.get(MARKETPLACE_CHANNEL, 0) + 1

        ota = (
            db.table("channex_review")
            .select("ota, overall_score, is_replied")
            .eq("tenant_id", tenant_id)
            .eq("is_archived", False)
        )
        if eigene is not None:
            ota = ota.in_("property_id", eigene)
        for row in (ota.execute().data or []):
            code = row.get("ota") or "unbekannt"
            je_kanal.setdefault(code, []).append(_score_5_from_ten(row.get("overall_score")))
            if not row.get("is_replied"):
                offen[code] = offen.get(code, 0) + 1

        kanaele: list[ChannelSummary] = []
        alle: list[float] = []
        gesamt = 0
        for code, werte in sorted(je_kanal.items()):
            bewertet = [v for v in werte if v is not None]
            alle.extend(bewertet)
            gesamt += len(werte)
            kanaele.append(
                ChannelSummary(
                    channel_code=code,
                    count=len(werte),
                    average_5=(
                        round(sum(bewertet) / len(bewertet), 2) if bewertet else None
                    ),
                    unanswered=offen.get(code, 0),
                )
            )
        unbeantwortet = sum(offen.values())
        return ReviewSummary(
            count=gesamt,
            average_5=round(sum(alle) / len(alle), 2) if alle else None,
            unanswered=unbeantwortet,
            response_rate=(
                round((gesamt - unbeantwortet) / gesamt, 4) if gesamt else None
            ),
            by_channel=kanaele,
        )

    # ------------------------------------------------------------------ Detail
    def get_review(
        self, ctx: AuthContext, source: ReviewSource, review_id: str
    ) -> UnifiedReview:
        """Eine Bewertung — MIT demselben Scope wie die Liste (Wurzel 9)."""
        db, tenant_id = self._require(ctx)
        if source is ReviewSource.marketplace:
            row = self._own_marketplace(db, tenant_id, ctx, review_id)
            return self._to_marketplace(
                row,
                self._reservations_mit_gastbewertung(
                    db, tenant_id,
                    [str(row["reservation_id"])] if row.get("reservation_id") else [],
                ),
            )
        return self._to_ota(self._own_ota(db, tenant_id, ctx, review_id))

    def _own_marketplace(
        self, db: Client, tenant_id: str, ctx: AuthContext, review_id: str
    ) -> dict:
        """Marktplatz-Bewertung tenant-gescopt laden. Der Scope läuft über den
        properties-Join — `properties!inner(tenant_id)` UND der eq darauf sind
        beide nötig, sonst filtert PostgREST nicht."""
        rows = (
            db.table("reviews")
            .select(
                REVIEW_COLUMNS
                + ", portal_guests(name), properties!inner(id, title, tenant_id)"
            )
            .eq("id", review_id)
            .eq("properties.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReviewError("Bewertung nicht gefunden.", status_code=404)
        row = rows[0]
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and str(row["property_id"]) not in eigene:
            raise ReviewError("Bewertung nicht gefunden.", status_code=404)
        return row

    def _own_ota(
        self, db: Client, tenant_id: str, ctx: AuthContext, review_id: str
    ) -> dict:
        row = load_scoped(
            db,
            "channex_review",
            review_id,
            tenant_id,
            columns=_OTA_COLUMNS + ", properties(id, title)",
            not_found=ReviewError("Bewertung nicht gefunden.", status_code=404),
        )
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and str(row.get("property_id") or "") not in eigene:
            raise ReviewError("Bewertung nicht gefunden.", status_code=404)
        return row

    # ----------------------------------------------------------------- Antwort
    def reply(
        self, ctx: AuthContext, source: ReviewSource, review_id: str, reply: str
    ) -> UnifiedReview:
        """Öffentlich auf eine Bewertung antworten."""
        db, tenant_id = self._require_write(ctx)
        clean = plaintext(reply)
        if not clean:
            raise ReviewError("Antwort darf nicht leer sein.", status_code=422)

        if source is ReviewSource.marketplace:
            self._own_marketplace(db, tenant_id, ctx, review_id)
            db.table("reviews").update(
                {"host_reply": clean, "host_reply_at": datetime.now(UTC).isoformat()}
            ).eq("id", review_id).execute()
            return self.get_review(ctx, source, review_id)

        row = self._own_ota(db, tenant_id, ctx, review_id)
        if row.get("is_expired"):
            raise ReviewError(
                "Die Antwortfrist dieses Portals ist abgelaufen.", status_code=409
            )
        # Erst zum Portal, dann in den eigenen Bestand — reply_review spiegelt
        # den Erfolg selbst (Wurzel 1). Fehler des Portals kommen als
        # ChannelManagerError und werden hier zu unserem Fehlerbild.
        self._portal_call(
            lambda cm: cm.reply_review(ctx, str(row["channex_review_id"]), clean)
        )
        return self._to_ota(self._own_ota(db, tenant_id, ctx, review_id))

    def delete_reply(self, ctx: AuthContext, review_id: str) -> None:
        """Antwort entfernen — nur auf dem Marktplatz. Portale kennen kein
        Zurücknehmen einer Antwort; das täuschen wir auch nicht vor."""
        db, tenant_id = self._require_write(ctx)
        self._own_marketplace(db, tenant_id, ctx, review_id)
        db.table("reviews").update({"host_reply": None, "host_reply_at": None}).eq(
            "id", review_id
        ).execute()

    def _portal_call(self, fn: Callable[[ChannelManagerService], T]) -> T:
        """Portal-Aufruf mit übersetztem Fehlerbild. Der channel_manager wirft
        seine eigene Exception — die wird hier zu ReviewError, damit der Router
        genau eine Fehlerklasse behandelt (Wurzel 5: kein breites Schlucken)."""
        from src.features.channel_manager.service import ChannelManagerError

        try:
            return fn(self._channel_manager())
        except ChannelManagerError as exc:
            raise ReviewError(exc.message, status_code=exc.status_code) from exc

    # ------------------------------------------------------- Betrieb bewertet Gast
    def rate_guest(
        self, ctx: AuthContext, req: RateGuestRequest
    ) -> GuestReviewByHost:
        """Betrieb bewertet einen Gast (Zwei-Wege, myBestDays). reservation_id ist
        tenant-gescopt (Wurzel 3); guest_email/property_id daraus abgeleitet, nie
        aus dem Client. Idempotent über UNIQUE(reservation_id) → 409."""
        db, tenant_id = self._require_write(ctx)
        res = load_scoped(
            db,
            "reservations",
            req.reservation_id,
            tenant_id,
            columns="id, property_id, guest_email",
            not_found=ReviewError("Reservierung nicht gefunden.", status_code=404),
        )
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and str(res["property_id"]) not in eigene:
            raise ReviewError("Reservierung nicht gefunden.", status_code=404)
        return self.insert_guest_rating(
            db,
            tenant_id=tenant_id,
            reservation=res,
            rating=req.rating,
            text=req.text,
            scores=req.scores,
        )

    def insert_guest_rating(  # noqa: PLR0913 — ein Datensatz, benannte Argumente
        self,
        db: Client,
        *,
        tenant_id: str,
        reservation: dict,
        rating: int,
        text: str | None,
        scores: GuestScores,
    ) -> GuestReviewByHost:
        email = (reservation.get("guest_email") or "").strip()
        payload = {
            "tenant_id": tenant_id,
            "reservation_id": str(reservation["id"]),
            "property_id": str(reservation["property_id"]),
            "guest_email": email,
            # Es gibt bewusst KEINE reservations.portal_guest_id — die Brücke
            # zum Marktplatz-Konto ist die E-Mail (0181). Auflösen, nicht raten.
            "portal_guest_id": self._portal_guest_id(db, email),
            "rating": rating,
            "text": plaintext(text),
            "score_cleanliness": scores.cleanliness,
            "score_communication": scores.communication,
            "score_house_rules": scores.house_rules,
        }
        try:
            ins = (
                db.table("guest_reviews_by_host").insert(payload).execute()
            ).data or []
        except APIError as exc:
            if exc.code == "23505":
                raise ReviewError(
                    "Dieser Gast wurde für diese Buchung bereits bewertet.",
                    status_code=409,
                ) from exc
            raise
        if not ins:
            raise ReviewError("Bewertung fehlgeschlagen.", status_code=500)
        # Beide Seiten da? → veröffentlichen (double-blind).
        resolve_publication(db, str(reservation["id"]))
        fresh = (
            db.table("guest_reviews_by_host")
            .select("*")
            .eq("id", ins[0]["id"])
            .limit(1)
            .execute()
        ).data or ins
        return self._to_guest_review(fresh[0])

    @staticmethod
    def _portal_guest_id(db: Client, email: str) -> str | None:
        """Marktplatz-Konto zur Gast-E-Mail (case-insensitiv). None, wenn der
        Gast kein Konto hat — dann bleibt die Bewertung an der E-Mail hängen."""
        if not email:
            return None
        from src.core.supabase import escape_like

        rows = (
            db.table("portal_guests")
            .select("id")
            .ilike("email", escape_like(email))
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["id"]) if rows else None

    @staticmethod
    def _to_guest_review(row: dict) -> GuestReviewByHost:
        return GuestReviewByHost(
            id=str(row["id"]),
            reservation_id=str(row["reservation_id"]),
            property_id=str(row["property_id"]),
            rating=int(row["rating"]),
            text=row.get("text"),
            scores=GuestScores(
                cleanliness=row.get("score_cleanliness"),
                communication=row.get("score_communication"),
                house_rules=row.get("score_house_rules"),
            ),
            published_at=as_dt(row.get("published_at")),
            created_at=row["created_at"],
        )

    def get_guest_rating(
        self, ctx: AuthContext, reservation_id: str
    ) -> GuestReviewByHost:
        """Die bereits abgegebene Betrieb→Gast-Bewertung einer Reservierung."""
        db, tenant_id = self._require(ctx)
        res = load_scoped(
            db,
            "reservations",
            reservation_id,
            tenant_id,
            columns="id, property_id",
            not_found=ReviewError("Reservierung nicht gefunden.", status_code=404),
        )
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and str(res["property_id"]) not in eigene:
            raise ReviewError("Reservierung nicht gefunden.", status_code=404)
        rows = (
            db.table("guest_reviews_by_host")
            .select("*")
            .eq("reservation_id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReviewError("Noch keine Bewertung abgegeben.", status_code=404)
        return self._to_guest_review(rows[0])

    def send_ota_guest_review(
        self, ctx: AuthContext, review_id: str, req: OtaGuestReviewRequest
    ) -> UnifiedReview:
        """Gast beim Portal bewerten (nur Airbnb). Einmalig — Channex nimmt pro
        Bewertung genau eine Gast-Bewertung an, ein zweiter Versuch wäre ein
        Fehler beim Portal (Wurzel 2: hier vorher abfangen)."""
        db, tenant_id = self._require_write(ctx)
        row = self._own_ota(db, tenant_id, ctx, review_id)
        if row.get("guest_review_sent_at"):
            raise ReviewError(
                "Für diese Bewertung wurde der Gast bereits bewertet.",
                status_code=409,
            )
        payload: dict[str, Any] = {
            "scores": [
                {"category": key, "rating": value}
                for key, value in (
                    ("cleanliness", req.scores.cleanliness),
                    ("communication", req.scores.communication),
                    ("respect_house_rules", req.scores.house_rules),
                )
                if value is not None
            ],
            "is_reviewee_recommended": req.recommended,
        }
        oeffentlich = plaintext(req.public_review)
        privat = plaintext(req.private_review)
        if oeffentlich:
            payload["public_review"] = oeffentlich
        if privat:
            payload["private_review"] = privat
        self._portal_call(
            lambda cm: cm.send_guest_review(
                ctx, str(row["channex_review_id"]), payload
            )
        )
        return self._to_ota(self._own_ota(db, tenant_id, ctx, review_id))

    # -------------------------------------------------------------- Automatik
    def get_automation(self, ctx: AuthContext) -> AutomationConfig:
        """Konfiguration des Betriebs. Fehlt sie, gilt die AUS-Stellung —
        das ist kein erfundener Wert, sondern der dokumentierte Default:
        ohne ausdrückliche Einrichtung schickt die Automatik nichts."""
        db, tenant_id = self._require(ctx)
        rows = (
            db.table("review_automation")
            .select(_AUTOMATION_COLUMNS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return AutomationConfig()
        row = rows[0]
        return AutomationConfig(
            auto_review_active=bool(row["auto_review_active"]),
            auto_review_after_days=int(row["auto_review_after_days"]),
            auto_review_min_rating=row.get("auto_review_min_rating"),
            auto_review_rating=int(row["auto_review_rating"]),
            auto_review_public=row.get("auto_review_public"),
            auto_review_private=row.get("auto_review_private"),
            guest_reminder_active=bool(row["guest_reminder_active"]),
            guest_reminder_after_days=int(row["guest_reminder_after_days"]),
        )

    def set_automation(
        self, ctx: AuthContext, cfg: AutomationConfig
    ) -> AutomationConfig:
        db, tenant_id = self._require_write(ctx)
        payload = {
            "tenant_id": tenant_id,
            "auto_review_active": cfg.auto_review_active,
            "auto_review_after_days": cfg.auto_review_after_days,
            "auto_review_min_rating": cfg.auto_review_min_rating,
            "auto_review_rating": cfg.auto_review_rating,
            "auto_review_public": plaintext(cfg.auto_review_public),
            "auto_review_private": plaintext(cfg.auto_review_private),
            "guest_reminder_active": cfg.guest_reminder_active,
            "guest_reminder_after_days": cfg.guest_reminder_after_days,
        }
        db.table("review_automation").upsert(
            payload, on_conflict="tenant_id"
        ).execute()
        log.info("review_automation_saved", tenant_id=tenant_id)
        return self.get_automation(ctx)

    # ------------------------------------------------------------------- Sync
    def sync(self, ctx: AuthContext) -> int:
        """Manueller Portal-Abgleich für DIESEN Betrieb."""
        self._require(ctx)
        return int(self._portal_call(lambda cm: cm.sync_reviews(ctx)))

    # ------------------------------------------------------------- Qualität
    def quality(
        self, ctx: AuthContext, *, von: date, bis: date
    ) -> QualityDashboard:
        """Qualitäts-Kennzahlen über einen Zeitraum, alle Kanäle zusammen.

        Beide Skalen werden auf 5 Sterne normalisiert, damit Booking-Zehntel und
        myBestDays-Sterne im selben Verlauf stehen können. Tage ohne Bewertung
        bleiben ohne Wert — kein Nullpunkt, der einen Einbruch vortäuscht."""
        db, tenant_id = self._require(ctx)
        if bis < von:
            raise ReviewError("Zeitraum ist verdreht.", status_code=422)
        if (bis - von).days > _QUALITY_MAX_DAYS:
            raise ReviewError(
                f"Zeitraum zu groß (höchstens {_QUALITY_MAX_DAYS} Tage).",
                status_code=422,
            )
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and not eigene:
            return QualityDashboard(from_date=von, to_date=bis)

        punkte = self._quality_rows(db, tenant_id, eigene, von, bis)
        if not punkte:
            return QualityDashboard(from_date=von, to_date=bis)

        noten = [p["score_5"] for p in punkte if p["score_5"] is not None]
        beantwortet = sum(1 for p in punkte if p["replied"])
        fuenf = sum(1 for p in punkte if p["score_5"] is not None and p["score_5"] >= 5)
        return QualityDashboard(
            from_date=von,
            to_date=bis,
            count=len(punkte),
            average_5=round(sum(noten) / len(noten), 2) if noten else None,
            five_star_rate=round(fuenf / len(noten), 4) if noten else None,
            response_rate=round(beantwortet / len(punkte), 4),
            categories=self._quality_categories(punkte),
            series=self._quality_series(punkte, von, bis),
            by_property=self._quality_by_property(db, tenant_id, punkte),
        )

    def _quality_rows(
        self,
        db: Client,
        tenant_id: str,
        eigene: list[str] | None,
        von: date,
        bis: date,
    ) -> list[dict]:
        """Beide Quellen auf eine flache Punktliste bringen:
        {tag, score_5, replied, property_id, categories}."""
        ende = (bis + timedelta(days=1)).isoformat()
        punkte: list[dict] = []

        markt = (
            db.table("reviews")
            .select(
                "rating, host_reply, created_at, property_id, "
                + ", ".join(SCORE_COLUMNS)
                + ", properties!inner(tenant_id)"
            )
            .eq("properties.tenant_id", tenant_id)
            .gte("created_at", von.isoformat())
            .lt("created_at", ende)
        )
        if eigene is not None:
            markt = markt.in_("property_id", eigene)
        for row in (markt.execute().data or []):
            punkte.append({
                "tag": str(row["created_at"])[:10],
                "score_5": float(row["rating"]),
                "replied": bool(row.get("host_reply")),
                "property_id": str(row["property_id"]),
                "categories": [
                    (feld, float(wert))
                    for feld, wert in scores_map(row).items()
                    if wert is not None
                ],
            })

        ota = (
            db.table("channex_review")
            .select("overall_score, is_replied, received_at, created_at, property_id, scores")
            .eq("tenant_id", tenant_id)
            .eq("is_archived", False)
            .gte("received_at", von.isoformat())
            .lt("received_at", ende)
        )
        if eigene is not None:
            ota = ota.in_("property_id", eigene)
        for row in (ota.execute().data or []):
            punkte.append({
                "tag": str(row.get("received_at") or row["created_at"])[:10],
                "score_5": _score_5_from_ten(row.get("overall_score")),
                "replied": bool(row.get("is_replied")),
                "property_id": (
                    str(row["property_id"]) if row.get("property_id") else None
                ),
                "categories": [
                    (c.key, c.score / 2) for c in _ota_categories(row.get("scores"))
                ],
            })
        return punkte

    @staticmethod
    def _quality_categories(punkte: list[dict]) -> list[CategoryScore]:
        summen: dict[str, list[float]] = {}
        for p in punkte:
            for schluessel, wert in p["categories"]:
                summen.setdefault(schluessel, []).append(wert)
        return [
            CategoryScore(
                key=schluessel,
                score=round(sum(werte) / len(werte), 2),
                scale=ReviewScale.five,
            )
            for schluessel, werte in sorted(summen.items())
        ]

    @staticmethod
    def _quality_series(
        punkte: list[dict], von: date, bis: date
    ) -> list[QualityPoint]:
        je_tag: dict[str, list[float]] = {}
        anzahl: dict[str, int] = {}
        for p in punkte:
            anzahl[p["tag"]] = anzahl.get(p["tag"], 0) + 1
            if p["score_5"] is not None:
                je_tag.setdefault(p["tag"], []).append(p["score_5"])
        reihe: list[QualityPoint] = []
        tag = von
        while tag <= bis:
            schluessel = tag.isoformat()
            werte = je_tag.get(schluessel, [])
            reihe.append(
                QualityPoint(
                    date=tag,
                    count=anzahl.get(schluessel, 0),
                    average_5=round(sum(werte) / len(werte), 2) if werte else None,
                )
            )
            tag += timedelta(days=1)
        return reihe

    @staticmethod
    def _quality_by_property(
        db: Client, tenant_id: str, punkte: list[dict]
    ) -> list[QualityProperty]:
        je_objekt: dict[str, dict] = {}
        for p in punkte:
            pid = p["property_id"]
            if not pid:
                continue
            eintrag = je_objekt.setdefault(pid, {"noten": [], "count": 0, "offen": 0})
            eintrag["count"] += 1
            if p["score_5"] is not None:
                eintrag["noten"].append(p["score_5"])
            if not p["replied"]:
                eintrag["offen"] += 1
        if not je_objekt:
            return []
        titel = {
            str(r["id"]): r.get("title")
            for r in (
                db.table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", sorted(je_objekt))
                .execute()
            ).data
            or []
        }
        out = [
            QualityProperty(
                property_id=pid,
                title=titel.get(pid),
                count=e["count"],
                average_5=(
                    round(sum(e["noten"]) / len(e["noten"]), 2) if e["noten"] else None
                ),
                unanswered=e["offen"],
            )
            for pid, e in je_objekt.items()
        ]
        # Schwächstes Objekt zuerst — dort ist etwas zu tun. Objekte ohne Note
        # ans Ende, statt sie mit einer erfundenen 0 nach vorn zu ziehen.
        out.sort(key=lambda q: (q.average_5 is None, q.average_5 or 0.0))
        return out

    # -------------------------------------------------------- Warteschlange
    def list_queue(
        self,
        ctx: AuthContext,
        *,
        status: QueueStatus | None,
        limit: int,
        offset: int,
    ) -> QueueListResponse:
        """Geplante Bewertungen des Betriebs, nächste Fälligkeit zuerst."""
        db, tenant_id = self._require(ctx)
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        offset = max(0, offset)
        eigene = self._visible_property_ids(db, ctx)
        if eigene is not None and not eigene:
            return QueueListResponse(items=[], total=0, limit=limit, offset=offset)
        rows, total = self.queue().list_for_tenant(
            tenant_id,
            status=status.value if status else None,
            property_ids=eigene,
            limit=limit,
            offset=offset,
        )
        return QueueListResponse(
            items=[self._to_queue_entry(r) for r in rows],
            total=total,
            limit=limit,
            offset=offset,
        )

    def update_queue_entry(
        self, ctx: AuthContext, entry_id: str, req: QueueUpdateRequest
    ) -> QueueEntry:
        _, tenant_id = self._require_write(ctx)
        return self._to_queue_entry(
            self.queue().update(tenant_id, entry_id, req.model_dump(exclude_none=True))
        )

    def skip_queue_entry(self, ctx: AuthContext, entry_id: str) -> QueueEntry:
        _, tenant_id = self._require_write(ctx)
        return self._to_queue_entry(self.queue().skip(tenant_id, entry_id))

    def send_queue_entry(self, ctx: AuthContext, entry_id: str) -> QueueEntry:
        """Jetzt abschicken statt auf die Fälligkeit zu warten. Unumkehrbar."""
        _, tenant_id = self._require_write(ctx)
        warteschlange = self.queue()
        entry = warteschlange.own(tenant_id, entry_id)
        if entry["status"] != "geplant":
            raise ReviewError(
                "Nur geplante Bewertungen lassen sich abschicken.", status_code=409
            )
        warteschlange.send_entry(self, tenant_id, entry)
        return self._to_queue_entry(warteschlange.own(tenant_id, entry_id))

    @staticmethod
    def _to_queue_entry(row: dict) -> QueueEntry:
        prop = row.get("properties") or {}
        send_at = as_dt(row["send_at"])
        expires_at = as_dt(row.get("expires_at"))
        jetzt = datetime.now(UTC)
        tags = row.get("tags")
        return QueueEntry(
            id=str(row["id"]),
            source=ReviewSource(row["source"]),
            status=QueueStatus(row["status"]),
            property_id=str(row["property_id"]) if row.get("property_id") else None,
            property_title=prop.get("title"),
            guest_name=row.get("guest_name"),
            reservation_id=(
                str(row["reservation_id"]) if row.get("reservation_id") else None
            ),
            review_id=str(row["review_id"]) if row.get("review_id") else None,
            send_at=send_at,
            expires_at=expires_at,
            days_until_send=(send_at - jetzt).days if send_at else None,
            days_left=(expires_at - jetzt).days if expires_at else None,
            rating=int(row["rating"]),
            text=row.get("text"),
            private_text=row.get("private_text"),
            scores=GuestScores(
                cleanliness=row.get("score_cleanliness"),
                communication=row.get("score_communication"),
                house_rules=row.get("score_house_rules"),
            ),
            recommended=bool(row.get("recommended", True)),
            tags=[str(t) for t in tags] if isinstance(tags, list) else [],
            sent_at=as_dt(row.get("sent_at")),
            error=row.get("error"),
        )

    def run_maintenance(
        self, automation: ReviewAutomation
    ) -> tuple[int, int, int, int]:
        """Die zeitgesteuerten Vorgänge in EINER Fassung — für den Worker-Tick
        wie für den Cron-Endpunkt. Rückgabe: (veröffentlicht, gespiegelt,
        Gäste bewertet, Erinnerungen).

        Jeder Schritt ist unabhängig: ein nicht erreichbares Portal darf die
        Fristablauf-Veröffentlichung nicht verhindern (Wurzel 5 — spezifisch
        fangen, nicht den ganzen Lauf kippen)."""
        from src.features.guest_reviews.service import GuestReviewsService

        published = GuestReviewsService(service_client=self._db()).publish_overdue()
        try:
            mirrored = int(self._portal_call(lambda cm: cm.sync_reviews_all()))
        except ReviewError as exc:
            log.warning("review_tick_sync_failed", error=exc.message[:200])
            mirrored = 0
        # Erst planen (damit neu gespiegelte Portal-Bewertungen sofort in der
        # Schlange stehen), dann verfallen lassen, dann versenden — in dieser
        # Reihenfolge geht nichts raus, dessen Fenster schon zu ist.
        queued, reminded = automation.run()
        warteschlange = self.queue()
        expired = warteschlange.expire_overdue()
        rated = warteschlange.send_due(self)
        return published, mirrored, queued, rated, expired, reminded
