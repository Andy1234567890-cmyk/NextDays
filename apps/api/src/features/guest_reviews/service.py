"""Service-Schicht für guest_reviews — Bewertungen des myBestDays-Marktplatzes.

Dieser Slice ist die GAST-Seite. Die Betriebs-Seite (Cockpit über alle Kanäle,
antworten, Gast bewerten, Automatik) liegt im Slice ``reviews``; geteilte
Helfer/Sichtbarkeitslogik in ``reviews.common`` und ``reviews.publication``.

Zwei Zugänge in diesem Slice:

* Öffentlicher Lesepfad (kein JWT): alle Bewertungen eines Objekts, MASKIERT.
  Liefert Vorname/Initiale statt Name, NIE E-Mail/guest_id (Wurzel 9). Aggregat
  (Durchschnitt + Count) und harte Obergrenze/Pagination (Wurzel 8).
* Gast-Pfad (CurrentGuest): eigene Bewertungen lesen, abgeben, ändern. Eine
  Bewertung darf NUR für eine ABGESCHLOSSENE, dem Gast gehörende Reservierung
  abgegeben werden (E-Mail-Match + status/check_out-Prüfung, Wurzel 3). property_id
  wird server-seitig aus der Reservierung abgeleitet, nie aus dem Request. Der
  Zweit-Insert derselben Reservierung schlägt idempotent über den UNIQUE-Index
  (reservation_id, portal_guest_id) fehl → 409 statt Doppel (Wurzel 2). Text wird
  zu Plaintext gesäubert (kein rohes HTML, Wurzel 8).

Schreiben läuft ausschließlich über service_role — der anon-/authenticated-
Direktpfad auf public.reviews ist in Migration 0181 hart entzogen (Wurzel 6).
"""
from datetime import date

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import get_service_client
from src.features.reviews.common import (
    COMPLETED_STATUS,
    REVIEW_COLUMNS,
    SCORE_COLUMNS,
    as_dt,
    category_averages_map,
    checked_out,
    mask_author,
    plaintext,
    score_columns_payload,
    scores_map,
)
from src.features.reviews.publication import publish_overdue, resolve_publication

from .schemas import (
    MAX_PAGE_SIZE,
    CategoryScores,
    CreateReviewRequest,
    MyReview,
    MyReviewsResponse,
    PublicReview,
    PublicReviewsResponse,
    SliceHealth,
    UpdateReviewRequest,
)

log = get_logger("nextdays.guest_reviews")

# Spalten der Reservierung, die für die „echter Gast"-Prüfung nötig sind.
_RESERVATION_COLUMNS = "id, property_id, guest_email, status, check_out"


class GuestReviewError(Exception):
    """Fehler des guest_reviews-Slice mit HTTP-Status."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _scores_from_row(row: dict) -> CategoryScores:
    """Die 6 Kategorie-Sub-Scores aus einer reviews-Zeile (None bleibt None)."""
    return CategoryScores(**scores_map(row))


def _category_averages(rows: list[dict]) -> CategoryScores | None:
    averages = category_averages_map(rows)
    return CategoryScores(**averages) if averages else None


class GuestReviewsService:
    """Kapselt Lese-/Schreibzugriff auf public.reviews (service_role)."""

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            self._client = get_service_client()
        return self._client

    def health(self) -> SliceHealth:
        return SliceHealth()

    # ------------------------------------------------------------------ public
    def public_reviews(
        self, property_id: str, *, limit: int, offset: int
    ) -> PublicReviewsResponse:
        """Alle Bewertungen eines Objekts, MASKIERT, mit Aggregat + Pagination.

        limit/offset werden hart gedeckelt (Wurzel 8). Durchschnitt/Count über
        ALLE Bewertungen des Objekts (nicht nur die aktuelle Seite)."""
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        offset = max(0, offset)

        # Aggregat über ALLE VERÖFFENTLICHTEN Bewertungen des Objekts (verdeckte
        # double-blind-Reviews mit published_at IS NULL zählen nicht). rating +
        # Sub-Scores für die Kategorie-Durchschnitte (kein PII).
        agg = (
            self._db()
            .table("reviews")
            .select("rating, " + ", ".join(SCORE_COLUMNS))
            .eq("property_id", property_id)
            .not_.is_("published_at", "null")
            .execute()
        ).data or []
        count = len(agg)
        average = (
            round(sum(int(r["rating"]) for r in agg) / count, 2) if count else None
        )
        category_averages = _category_averages(agg)

        # Seite laden — join auf portal_guests.name NUR zur Maskierung (Vorname).
        # guest_id/E-Mail werden bewusst NICHT selektiert (Recon-Schutz, Wurzel 9).
        # Nur veröffentlichte Reviews (double-blind).
        page = (
            self._db()
            .table("reviews")
            .select(
                "id, rating, text, host_reply, host_reply_at, created_at, "
                + ", ".join(SCORE_COLUMNS)
                + ", portal_guests(name)"
            )
            .eq("property_id", property_id)
            .not_.is_("published_at", "null")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        ).data or []

        reviews = [
            PublicReview(
                id=str(row["id"]),
                rating=int(row["rating"]),
                text=row.get("text"),
                host_reply=row.get("host_reply"),
                host_reply_at=as_dt(row.get("host_reply_at")),
                author=mask_author((row.get("portal_guests") or {}).get("name")),
                scores=_scores_from_row(row),
                created_at=row["created_at"],
            )
            for row in page
        ]
        return PublicReviewsResponse(
            property_id=property_id,
            average=average,
            count=count,
            category_averages=category_averages,
            reviews=reviews,
        )

    def tenant_reviews(self, tenant_id: str, *, limit: int) -> PublicReviewsResponse:
        """Wie public_reviews, aber über ALLE Objekte eines Betriebs.

        Für den Bewertungs-Block der eigenen Website. Der Scope läuft über den
        properties-Join — `properties!inner(tenant_id)` UND der eq darauf sind
        beide nötig, sonst filtert PostgREST nicht. `property_id` bleibt in der
        Antwort leer: die Antwort gehört zum Betrieb, nicht zu einem Objekt."""
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        agg = (
            self._db()
            .table("reviews")
            .select(
                "rating, " + ", ".join(SCORE_COLUMNS) + ", properties!inner(tenant_id)"
            )
            .eq("properties.tenant_id", tenant_id)
            .not_.is_("published_at", "null")
            .execute()
        ).data or []
        count = len(agg)
        average = (
            round(sum(int(r["rating"]) for r in agg) / count, 2) if count else None
        )
        page = (
            self._db()
            .table("reviews")
            .select(
                "id, rating, text, host_reply, host_reply_at, created_at, "
                + ", ".join(SCORE_COLUMNS)
                + ", portal_guests(name), properties!inner(tenant_id)"
            )
            .eq("properties.tenant_id", tenant_id)
            .not_.is_("published_at", "null")
            .order("created_at", desc=True)
            .range(0, limit - 1)
            .execute()
        ).data or []
        return PublicReviewsResponse(
            property_id="",
            average=average,
            count=count,
            category_averages=_category_averages(agg),
            reviews=[
                PublicReview(
                    id=str(row["id"]),
                    rating=int(row["rating"]),
                    text=row.get("text"),
                    host_reply=row.get("host_reply"),
                    host_reply_at=as_dt(row.get("host_reply_at")),
                    author=mask_author((row.get("portal_guests") or {}).get("name")),
                    scores=_scores_from_row(row),
                    created_at=row["created_at"],
                )
                for row in page
            ],
        )

    def property_aggregates(
        self, property_ids: list[str]
    ) -> dict[str, tuple[float, int]]:
        """Durchschnitt + Anzahl je Objekt für eine LISTE von Objekten.

        Für die Trefferliste des Marktplatzes: ein Query für alle Karten statt
        einer je Karte. Nur veröffentlichte Bewertungen; Objekte ohne Bewertung
        fehlen im Ergebnis (kein 0,0 erfinden — Wurzel 4)."""
        if not property_ids:
            return {}
        rows = (
            self._db()
            .table("reviews")
            .select("property_id, rating")
            .in_("property_id", property_ids)
            .not_.is_("published_at", "null")
            .execute()
        ).data or []
        summen: dict[str, list[int]] = {}
        for row in rows:
            summen.setdefault(str(row["property_id"]), []).append(int(row["rating"]))
        return {
            pid: (round(sum(vals) / len(vals), 2), len(vals))
            for pid, vals in summen.items()
            if vals
        }

    # ------------------------------------------------------------------- guest
    def my_reviews(self, guest_id: str) -> MyReviewsResponse:
        """Eigene Bewertungen des Gasts (portal_guest_id == guest_id). Der Gast
        sieht sein eigenes Review IMMER — auch verdeckte (published_at IS NULL),
        also KEIN published-Filter hier (double-blind)."""
        rows = (
            self._db()
            .table("reviews")
            .select(REVIEW_COLUMNS)
            .eq("portal_guest_id", guest_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return MyReviewsResponse(reviews=[self._to_my_review(r) for r in rows])

    def create_review(
        self, guest_id: str, email: str, req: CreateReviewRequest, *, today: date
    ) -> MyReview:
        """Bewertung abgeben. Prüft „echter, abgeschlossener Gast", leitet
        property_id aus der Reservierung ab und ist idempotent über den UNIQUE-
        Index (409 statt Doppel-Insert)."""
        res = self._require_completed_own_reservation(req.reservation_id, email, today)

        payload = {
            "property_id": res["property_id"],  # server-seitig, nie aus Request
            "portal_guest_id": guest_id,
            "reservation_id": req.reservation_id,
            "rating": req.rating,
            "text": plaintext(req.text),
            **score_columns_payload(req.scores.model_dump()),
        }
        try:
            inserted = (
                self._db().table("reviews").insert(payload).execute()
            ).data or []
        except APIError as exc:
            # UNIQUE(reservation_id, portal_guest_id) verletzt → schon bewertet.
            # Idempotenz-Backstop (Wurzel 2): kein Doppel-Insert, klare 409.
            if exc.code == "23505":
                raise GuestReviewError(
                    "Diese Reservierung wurde bereits bewertet.", status_code=409
                ) from exc
            raise
        if not inserted:
            raise GuestReviewError("Bewertung fehlgeschlagen.", status_code=500)

        # Double-blind (Airbnb): sichtbar schalten, sobald AUCH die Host→Gast-
        # Bewertung derselben Reservierung existiert. Sonst bleibt sie verdeckt
        # (published_at NULL) bis zur Frist (Tick).
        resolve_publication(self._db(), req.reservation_id)

        log.info(
            "guest_review_created",
            reservation_id=req.reservation_id,
            property_id=res["property_id"],
            review_id=inserted[0]["id"],
        )
        # published_at kann durch resolve_publication gesetzt worden sein → neu laden.
        fresh = (
            self._db()
            .table("reviews")
            .select(REVIEW_COLUMNS)
            .eq("id", inserted[0]["id"])
            .limit(1)
            .execute()
        ).data or [inserted[0]]
        return self._to_my_review(fresh[0])

    def update_review(
        self, guest_id: str, review_id: str, req: UpdateReviewRequest
    ) -> MyReview:
        """Eigene Bewertung ändern (rating/text). Scope-Re-Prüfung über
        portal_guest_id (Wurzel 9): fremde Bewertung → 404, kein Existenz-Leak.
        host_reply ist hier NICHT setzbar (Betriebs-Seite)."""
        updates: dict[str, object] = {}
        if req.rating is not None:
            updates["rating"] = req.rating
        if req.text is not None:
            updates["text"] = plaintext(req.text)
        if req.scores is not None:
            updates.update(score_columns_payload(req.scores.model_dump()))
        if not updates:
            raise GuestReviewError("Keine Änderung angegeben.", status_code=422)

        # UPDATE mit gleichzeitigem Scope-Filter (id UND portal_guest_id) — Load
        # und Scope untrennbar, nie ein ungescoptes Update per ID (Wurzel 3/9).
        updated = (
            self._db()
            .table("reviews")
            .update(updates)
            .eq("id", review_id)
            .eq("portal_guest_id", guest_id)
            .execute()
        ).data or []
        if not updated:
            raise GuestReviewError("Bewertung nicht gefunden.", status_code=404)
        return self._to_my_review(updated[0])

    def publish_overdue(self) -> int:
        """Fristablauf-Veröffentlichung (double-blind). Wird vom Tick des
        reviews-Slice und vom Cron-Endpunkt aufgerufen."""
        return publish_overdue(self._db())

    # ----------------------------------------------------------------- helpers
    def _require_completed_own_reservation(
        self, reservation_id: str, email: str, today: date
    ) -> dict:
        """„Echter Gast"-Prüfung (Wurzel 3): die Reservierung muss dem Gast
        gehören (guest_email == ctx.email) UND abgeschlossen sein (status
        completed ODER check_out < heute).

        Bewusst 404 bei nicht gefunden/fremd (kein Existenz-Leak fremder
        Reservierungen an einen recon-enden Gast), 409 bei „noch nicht
        abgeschlossen" (fachlicher Konflikt, kein Fehler des Aufrufers)."""
        rows = (
            self._db()
            .table("reservations")
            .select(_RESERVATION_COLUMNS)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise GuestReviewError("Reservierung nicht gefunden.", status_code=404)
        res = rows[0]

        # Besitznachweis: E-Mail-Match (case-insensitiv, ctx.email ist lower-case).
        if (res.get("guest_email") or "").strip().lower() != email.strip().lower():
            raise GuestReviewError("Reservierung nicht gefunden.", status_code=404)

        # Abgeschlossen? completed ODER Abreise liegt in der Vergangenheit.
        if res.get("status") != COMPLETED_STATUS and not checked_out(
            res.get("check_out"), today
        ):
            raise GuestReviewError(
                "Bewertung erst nach abgeschlossenem Aufenthalt möglich.",
                status_code=409,
            )
        return res

    @staticmethod
    def _to_my_review(row: dict) -> MyReview:
        return MyReview(
            id=str(row["id"]),
            property_id=str(row["property_id"]),
            reservation_id=(
                str(row["reservation_id"]) if row.get("reservation_id") else None
            ),
            rating=int(row["rating"]),
            text=row.get("text"),
            host_reply=row.get("host_reply"),
            host_reply_at=as_dt(row.get("host_reply_at")),
            scores=_scores_from_row(row),
            published_at=as_dt(row.get("published_at")),
            created_at=row["created_at"],
            updated_at=as_dt(row.get("updated_at")),
        )
