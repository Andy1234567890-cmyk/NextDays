"""Service-Schicht für guest_reviews — Bewertungen der Plattform (/plattform).

Zwei Welten in EINEM Slice:

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
from datetime import UTC, date, datetime, timedelta

import nh3
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client, load_scoped
from src.features.auth.owner_scope import is_owner, owner_property_ids

from .schemas import (
    MAX_PAGE_SIZE,
    CategoryScores,
    CreateReviewRequest,
    GuestReviewByHost,
    GuestScores,
    HostReviewResponse,
    MyReview,
    MyReviewsResponse,
    PublicReview,
    PublicReviewsResponse,
    RateGuestRequest,
    SliceHealth,
    UpdateReviewRequest,
)

log = get_logger("nextdays.guest_reviews")

# Reservierungs-Status, der als „abgeschlossen" gilt (Nachweis echter Gast).
_COMPLETED_STATUS = "completed"

# Spalten der Reservierung, die für die „echter Gast"-Prüfung nötig sind.
_RESERVATION_COLUMNS = "id, property_id, guest_email, status, check_out"

# Kategorie-Sub-Score-Spalten in public.reviews (Booking-Modell).
_SCORE_COLUMNS = (
    "score_cleanliness",
    "score_communication",
    "score_location",
    "score_value",
    "score_accuracy",
    "score_checkin",
)

# Airbnb double-blind: nach dieser Frist wird ein einseitiges Review auch ohne
# Gegenseite veröffentlicht (14 Tage ab Abgabe).
_DOUBLE_BLIND_DAYS = 14

# Spalten für die eigene/Host-Sicht einer Bewertung (inkl. Sub-Scores).
_REVIEW_COLUMNS = (
    "id, property_id, reservation_id, rating, text, host_reply, host_reply_at, "
    "published_at, created_at, updated_at, " + ", ".join(_SCORE_COLUMNS)
)


class GuestReviewError(Exception):
    """Fehler des guest_reviews-Slice mit HTTP-Status."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _plaintext(value: str | None) -> str | None:
    """Bewertungstext zu Plaintext säubern (Wurzel 8): ALLE Tags entfernen.

    Ein Bewertungstext ist reiner Fließtext, kein Rich-Text — deshalb Allowlist =
    leer (nh3 strippt jedes Tag, behält den Textinhalt). Ergebnis wird öffentlich
    gerendert; roher Client-HTML darf niemals durchkommen. Leerer/whitespace-only
    Text → None (kein leerer String in der DB)."""
    if value is None:
        return None
    cleaned = nh3.clean(value, tags=set(), attributes={}).strip()
    return cleaned or None


def _mask_author(name: str | None) -> str:
    """Anzeigename für den öffentlichen Lesepfad maskieren (Wurzel 9).

    Liefert den VORNAMEN (erstes Wort). Ist keiner vorhanden → „Gast". NIE der
    volle Name, NIE die E-Mail. Kein Rückschluss auf die Identität des Gasts."""
    first = (name or "").strip().split(" ", 1)[0].strip()
    return first or "Gast"


def _as_dt(value: object) -> datetime | None:
    """Optionalen Timestamp aus der DB in datetime wandeln (None bleibt None)."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def _scores_from_row(row: dict) -> CategoryScores:
    """Die 6 Kategorie-Sub-Scores aus einer reviews-Zeile lesen (None bleibt None)."""
    return CategoryScores(
        cleanliness=row.get("score_cleanliness"),
        communication=row.get("score_communication"),
        location=row.get("score_location"),
        value=row.get("score_value"),
        accuracy=row.get("score_accuracy"),
        checkin=row.get("score_checkin"),
    )


def _score_payload(scores: CategoryScores) -> dict[str, int | None]:
    """CategoryScores → reviews-Spalten (nur die 6 Sub-Scores)."""
    return {
        "score_cleanliness": scores.cleanliness,
        "score_communication": scores.communication,
        "score_location": scores.location,
        "score_value": scores.value,
        "score_accuracy": scores.accuracy,
        "score_checkin": scores.checkin,
    }


def _category_averages(rows: list[dict]) -> CategoryScores | None:
    """Durchschnitt je Kategorie über die Zeilen mit gesetztem Sub-Score. None,
    wenn KEINE Zeile irgendeinen Sub-Score trägt (kein Fallback, Wurzel 4)."""
    field_map = {
        "cleanliness": "score_cleanliness",
        "communication": "score_communication",
        "location": "score_location",
        "value": "score_value",
        "accuracy": "score_accuracy",
        "checkin": "score_checkin",
    }
    out: dict[str, float | None] = {}
    any_set = False
    for field, col in field_map.items():
        vals = [int(r[col]) for r in rows if r.get(col) is not None]
        if vals:
            any_set = True
            out[field] = round(sum(vals) / len(vals), 2)
        else:
            out[field] = None
    return CategoryScores(**out) if any_set else None


def _to_guest_review_by_host(row: dict) -> GuestReviewByHost:
    """guest_reviews_by_host-Zeile → Response."""
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
        published_at=_as_dt(row.get("published_at")),
        created_at=row["created_at"],
    )


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
            .select("rating, " + ", ".join(_SCORE_COLUMNS))
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
                "id, rating, text, host_reply, created_at, "
                + ", ".join(_SCORE_COLUMNS)
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
                author=_mask_author((row.get("portal_guests") or {}).get("name")),
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

    # ------------------------------------------------------------------- guest
    def my_reviews(self, guest_id: str) -> MyReviewsResponse:
        """Eigene Bewertungen des Gasts (portal_guest_id == guest_id). Der Gast
        sieht sein eigenes Review IMMER — auch verdeckte (published_at IS NULL),
        also KEIN published-Filter hier (Reviewer-Fix double-blind)."""
        rows = (
            self._db()
            .table("reviews")
            .select(_REVIEW_COLUMNS)
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
            "text": _plaintext(req.text),
            **_score_payload(req.scores),
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
        # (published_at NULL) bis zur Frist (Cron).
        self._resolve_publication(req.reservation_id)

        log.info(
            "guest_review_created",
            reservation_id=req.reservation_id,
            property_id=res["property_id"],
            review_id=inserted[0]["id"],
        )
        # published_at kann durch _resolve_publication gesetzt worden sein → neu laden.
        fresh = (
            self._db()
            .table("reviews")
            .select(_REVIEW_COLUMNS)
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
        host_reply ist hier NICHT setzbar (Tenant-Seite)."""
        updates: dict[str, object] = {}
        if req.rating is not None:
            updates["rating"] = req.rating
        if req.text is not None:
            updates["text"] = _plaintext(req.text)
        if req.scores is not None:
            updates.update(_score_payload(req.scores))
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

    # ----------------------------------------------------------------- helpers
    def _require_completed_own_reservation(
        self, reservation_id: str, email: str, today: date
    ) -> dict:
        """„Echter Gast"-Prüfung (Wurzel 3): die Reservierung muss dem Gast
        gehören (guest_email == ctx.email) UND abgeschlossen sein (status
        completed ODER check_out < heute). Sonst 403/409 mit klarer Meldung.

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
        checked_out = self._checked_out(res.get("check_out"), today)
        if res.get("status") != _COMPLETED_STATUS and not checked_out:
            raise GuestReviewError(
                "Bewertung erst nach abgeschlossenem Aufenthalt möglich.",
                status_code=409,
            )
        return res

    @staticmethod
    def _checked_out(check_out: object, today: date) -> bool:
        """True, wenn die Abreise vor heute liegt (Aufenthalt vorbei)."""
        if not check_out:
            return False
        parsed = date.fromisoformat(str(check_out)[:10])
        return parsed < today

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
            host_reply_at=_as_dt(row.get("host_reply_at")),
            scores=_scores_from_row(row),
            published_at=_as_dt(row.get("published_at")),
            created_at=row["created_at"],
            updated_at=_as_dt(row.get("updated_at")),
        )

    # ============================================================ Sichtbarkeit
    def _resolve_publication(self, reservation_id: str) -> None:
        """Airbnb double-blind: sobald BEIDE Seiten (Gast→Objekt in reviews UND
        Host→Gast in guest_reviews_by_host) für dieselbe Reservierung existieren,
        beide auf published_at=now() setzen (nur wo noch NULL). Monoton — kein
        Rücksetzen (Wurzel 1). Sonst bleibt beides verdeckt bis zur Frist (Cron)."""
        has_guest = (
            self._db()
            .table("reviews")
            .select("id")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        has_host = (
            self._db()
            .table("guest_reviews_by_host")
            .select("id")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not (has_guest and has_host):
            return
        now = datetime.now(UTC).isoformat()
        # Nur wo published_at noch NULL — idempotent, kein Rücksetzen.
        self._db().table("reviews").update({"published_at": now}).eq(
            "reservation_id", reservation_id
        ).is_("published_at", "null").execute()
        self._db().table("guest_reviews_by_host").update(
            {"published_at": now}
        ).eq("reservation_id", reservation_id).is_(
            "published_at", "null"
        ).execute()

    def publish_overdue(self) -> int:
        """Cron: einseitige Reviews nach Ablauf der 14-Tage-Frist veröffentlichen
        (auch ohne Gegenseite — Airbnb-Modell). service_role, tenant-übergreifend.
        Gibt die Anzahl frisch veröffentlichter Zeilen zurück."""
        cutoff = (datetime.now(UTC) - timedelta(days=_DOUBLE_BLIND_DAYS)).isoformat()
        now = datetime.now(UTC).isoformat()
        published = 0
        for table in ("reviews", "guest_reviews_by_host"):
            rows = (
                self._db()
                .table(table)
                .update({"published_at": now})
                .is_("published_at", "null")
                .lt("created_at", cutoff)
                .execute()
            ).data or []
            published += len(rows)
        if published:
            log.info("reviews_published_overdue", count=published)
        return published

    # =================================================================== Host
    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise GuestReviewError("Kein Tenant im Konto.", status_code=403)
        return self._db(), ctx.tenant_id

    def _own_property(
        self, db: Client, tenant_id: str, property_id: str, ctx: AuthContext
    ) -> None:
        """Objekt gehört dem Tenant — UND, falls owner, dem Owner zugeordnet
        (Reviewer-Fix: owner hat VIEW_CALENDAR, darf aber nur SEINE Objekte).
        Fail-closed 404, kein Existenz-Leak."""
        rows = (
            db.table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestReviewError("Objekt nicht gefunden.", status_code=404)
        if is_owner(ctx) and property_id not in owner_property_ids(db, ctx):
            raise GuestReviewError("Objekt nicht gefunden.", status_code=404)

    def host_reviews(
        self, ctx: AuthContext, property_id: str, *, limit: int, offset: int
    ) -> list[HostReviewResponse]:
        """Gast-Bewertungen EINES eigenen Objekts (Host-Sicht). Maskierter Autor
        (Vorname), kein voller Name/E-Mail (Daten-Split §4.3)."""
        db, tenant_id = self._require(ctx)
        self._own_property(db, tenant_id, property_id, ctx)
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        offset = max(0, offset)
        rows = (
            db.table("reviews")
            .select(_REVIEW_COLUMNS + ", portal_guests(name)")
            .eq("property_id", property_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        ).data or []
        return [
            HostReviewResponse(
                id=str(r["id"]),
                property_id=str(r["property_id"]),
                reservation_id=(
                    str(r["reservation_id"]) if r.get("reservation_id") else None
                ),
                rating=int(r["rating"]),
                text=r.get("text"),
                author=_mask_author((r.get("portal_guests") or {}).get("name")),
                scores=_scores_from_row(r),
                host_reply=r.get("host_reply"),
                host_reply_at=_as_dt(r.get("host_reply_at")),
                published_at=_as_dt(r.get("published_at")),
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _own_review(self, db: Client, tenant_id: str, review_id: str) -> dict:
        """Eine Review tenant-scoped laden über den property→tenant-Join. MUSS
        properties!inner(tenant_id) + eq('properties.tenant_id', …) nutzen
        (Reviewer-Fix), sonst ist der Scope wirkungslos. 404 bei fremd/fehlend."""
        rows = (
            db.table("reviews")
            .select(
                "id, property_id, reservation_id, host_reply, "
                "properties!inner(tenant_id)"
            )
            .eq("id", review_id)
            .eq("properties.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestReviewError("Bewertung nicht gefunden.", status_code=404)
        return rows[0]

    def set_host_reply(
        self, ctx: AuthContext, review_id: str, reply: str
    ) -> HostReviewResponse:
        """Öffentliche Host-Antwort auf eine Gast-Bewertung setzen/ändern."""
        db, tenant_id = self._require(ctx)
        self._own_review(db, tenant_id, review_id)  # tenant-Scope erzwingen (404 sonst)
        if is_owner(ctx):
            # Owner ist read-only (§4.2) — darf nicht öffentlich antworten.
            raise GuestReviewError("Keine Berechtigung.", status_code=403)
        clean = _plaintext(reply)
        if not clean:
            raise GuestReviewError("Antwort darf nicht leer sein.", status_code=422)
        db.table("reviews").update(
            {"host_reply": clean, "host_reply_at": datetime.now(UTC).isoformat()}
        ).eq("id", review_id).execute()
        return self._host_review_by_id(db, review_id)

    def delete_host_reply(self, ctx: AuthContext, review_id: str) -> None:
        """Host-Antwort entfernen (host_reply/host_reply_at auf NULL)."""
        db, tenant_id = self._require(ctx)
        self._own_review(db, tenant_id, review_id)
        if is_owner(ctx):
            raise GuestReviewError("Keine Berechtigung.", status_code=403)
        db.table("reviews").update(
            {"host_reply": None, "host_reply_at": None}
        ).eq("id", review_id).execute()

    def _host_review_by_id(self, db: Client, review_id: str) -> HostReviewResponse:
        rows = (
            db.table("reviews")
            .select(_REVIEW_COLUMNS + ", portal_guests(name)")
            .eq("id", review_id)
            .limit(1)
            .execute()
        ).data or []
        r = rows[0]
        return HostReviewResponse(
            id=str(r["id"]),
            property_id=str(r["property_id"]),
            reservation_id=(
                str(r["reservation_id"]) if r.get("reservation_id") else None
            ),
            rating=int(r["rating"]),
            text=r.get("text"),
            author=_mask_author((r.get("portal_guests") or {}).get("name")),
            scores=_scores_from_row(r),
            host_reply=r.get("host_reply"),
            host_reply_at=_as_dt(r.get("host_reply_at")),
            published_at=_as_dt(r.get("published_at")),
            created_at=r["created_at"],
        )

    def rate_guest(
        self, ctx: AuthContext, req: RateGuestRequest
    ) -> GuestReviewByHost:
        """Host bewertet einen Gast (Zwei-Wege). reservation_id ist tenant-scoped
        (Wurzel 3); guest_email/property_id daraus abgeleitet, nie aus Client.
        Idempotent über UNIQUE(reservation_id) → 409."""
        db, tenant_id = self._require(ctx)
        if is_owner(ctx):
            raise GuestReviewError("Keine Berechtigung.", status_code=403)
        res = load_scoped(
            db,
            "reservations",
            req.reservation_id,
            tenant_id,
            columns="id, property_id, guest_email, portal_guest_id",
            not_found=GuestReviewError("Reservierung nicht gefunden.", status_code=404),
        )
        payload = {
            "tenant_id": tenant_id,
            "reservation_id": req.reservation_id,
            "property_id": res["property_id"],
            "guest_email": res.get("guest_email") or "",
            "portal_guest_id": res.get("portal_guest_id"),
            "rating": req.rating,
            "text": _plaintext(req.text),
            "score_cleanliness": req.scores.cleanliness,
            "score_communication": req.scores.communication,
            "score_house_rules": req.scores.house_rules,
        }
        try:
            ins = (
                db.table("guest_reviews_by_host").insert(payload).execute()
            ).data or []
        except APIError as exc:
            if exc.code == "23505":
                raise GuestReviewError(
                    "Dieser Gast wurde für diese Buchung bereits bewertet.",
                    status_code=409,
                ) from exc
            raise
        if not ins:
            raise GuestReviewError("Bewertung fehlgeschlagen.", status_code=500)
        # Beide Seiten da? → veröffentlichen (double-blind).
        self._resolve_publication(req.reservation_id)
        fresh = (
            db.table("guest_reviews_by_host")
            .select("*")
            .eq("id", ins[0]["id"])
            .limit(1)
            .execute()
        ).data or ins
        return _to_guest_review_by_host(fresh[0])

    def get_guest_rating(
        self, ctx: AuthContext, reservation_id: str
    ) -> GuestReviewByHost:
        """Die bereits abgegebene Host→Gast-Bewertung einer Reservierung lesen."""
        db, tenant_id = self._require(ctx)
        res = load_scoped(
            db,
            "reservations",
            reservation_id,
            tenant_id,
            columns="id, property_id",
            not_found=GuestReviewError("Reservierung nicht gefunden.", status_code=404),
        )
        if is_owner(ctx) and res["property_id"] not in owner_property_ids(db, ctx):
            raise GuestReviewError("Reservierung nicht gefunden.", status_code=404)
        rows = (
            db.table("guest_reviews_by_host")
            .select("*")
            .eq("reservation_id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestReviewError("Noch keine Bewertung abgegeben.", status_code=404)
        return _to_guest_review_by_host(rows[0])
