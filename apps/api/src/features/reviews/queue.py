"""Warteschlange der geplanten Gast-Bewertungen.

Warum es sie gibt: eine abgeschickte öffentliche Bewertung lässt sich bei keinem
Portal zurücknehmen. Deshalb entsteht sie hier ZUERST als Entwurf mit
Fälligkeit — sichtbar, änderbar, überspringbar — und geht erst mit einem
späteren Tick raus.

Zwei Quellen:

* ``marketplace`` — myBestDays. Hängt an der Reservierung; abgeschickt wird sie
  in ``guest_reviews_by_host`` (und löst dort die Zwei-Wege-Sichtbarkeit aus).
* ``ota`` — Portal über Channex. Hängt an der gespiegelten Portal-Bewertung:
  Channex nimmt die Gast-Bewertung NUR zu einer bestehenden Review entgegen
  (``POST /reviews/{id}/guest_review``), und nur Airbnb kann das überhaupt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from .common import DOUBLE_BLIND_DAYS, plaintext

if TYPE_CHECKING:  # nur Typen — zur Laufzeit lazy importiert
    from .service import ReviewsService

log = get_logger("nextdays.reviews.queue")

# Nur Airbnb kennt eine Bewertung des Gasts durch den Betrieb. Für Booking.com
# und Expedia legen wir gar nichts an, statt einen Eintrag zu zeigen, der beim
# Absenden zwangsläufig scheitert.
OTA_MIT_GASTBEWERTUNG = frozenset({"AirBNB"})

# Reservierungen, die überhaupt in Frage kommen. Stornierte werden nicht bewertet.
_ELIGIBLE_STATUS = ("confirmed", "completed")

# Wie weit zurück Einträge angelegt werden. Ohne Fenster würde ein frisch
# eingeschalteter Betrieb rückwirkend jede Altbuchung in die Schlange stellen.
_LOOKBACK_DAYS = 21

# Obergrenze je Lauf — der Tick soll nicht minutenlang laufen.
_BATCH = 50

_SPALTEN = (
    "id, tenant_id, source, reservation_id, review_id, property_id, guest_name, "
    "status, send_at, expires_at, rating, text, private_text, score_cleanliness, "
    "score_communication, score_house_rules, recommended, tags, sent_at, error, "
    "created_at, updated_at"
)


def _als_zeitpunkt(tag: date) -> str:
    """Datum → Zeitpunkt am Tagesanfang (UTC). Der Versand ist tagesgenau; eine
    Uhrzeit würde Genauigkeit vortäuschen, die es nicht gibt."""
    return datetime.combine(tag, time.min, tzinfo=UTC).isoformat()


def _iso_zu_datum(wert: object) -> date | None:
    if not wert:
        return None
    return date.fromisoformat(str(wert)[:10])


class ReviewQueue:
    """Befüllt, liest, ändert und versendet die Warteschlange."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- befüllen
    def fill(self, tenant_id: str, cfg: dict, today: date) -> int:
        """Fällige Entwürfe anlegen. Rückgabe: neu angelegte Einträge.

        Idempotent über die UNIQUE-Indizes (reservation_id bzw. review_id) —
        ein zweiter Lauf legt nichts nach."""
        vorlauf = int(cfg["auto_review_after_days"])
        angelegt = self._fill_marketplace(tenant_id, cfg, today, vorlauf)
        angelegt += self._fill_ota(tenant_id, cfg, today, vorlauf)
        if angelegt:
            log.info("review_queue_gefuellt", tenant_id=tenant_id, angelegt=angelegt)
        return angelegt

    def _fill_marketplace(
        self, tenant_id: str, cfg: dict, today: date, vorlauf: int
    ) -> int:
        bis = today - timedelta(days=vorlauf)
        von = bis - timedelta(days=_LOOKBACK_DAYS)
        rows = (
            self._db.table("reservations")
            .select("id, property_id, guest_email, check_out, guest_id")
            .eq("tenant_id", tenant_id)
            .in_("status", list(_ELIGIBLE_STATUS))
            .lte("check_out", bis.isoformat())
            .gte("check_out", von.isoformat())
            .order("check_out", desc=True)
            .limit(_BATCH)
            .execute()
        ).data or []
        offen = self._ohne_eintrag(rows, "reservation_id", "id")
        offen = self._ohne_bestehende_bewertung(offen)
        min_rating = cfg.get("auto_review_min_rating")
        if min_rating is not None:
            offen = self._nur_ab_gastnote(offen, int(min_rating))

        angelegt = 0
        for res in offen:
            abreise = _iso_zu_datum(res.get("check_out"))
            # Fenster schon zu? Dann gar nicht erst anlegen — ein Entwurf, der
            # nie versendbar ist, wäre nur Rauschen in der Liste (live gesehen
            # bei einer Altbuchung, deren 14 Tage längst abgelaufen waren).
            if abreise and abreise + timedelta(days=DOUBLE_BLIND_DAYS) < today:
                continue
            eintrag = {
                "tenant_id": tenant_id,
                "source": "marketplace",
                "reservation_id": str(res["id"]),
                "property_id": res.get("property_id"),
                "guest_name": None,
                "send_at": _als_zeitpunkt(
                    (abreise or today) + timedelta(days=vorlauf)
                ),
                # Eigene Frist: die Zwei-Wege-Sichtbarkeit endet nach 14 Tagen.
                "expires_at": (
                    _als_zeitpunkt(abreise + timedelta(days=DOUBLE_BLIND_DAYS))
                    if abreise
                    else None
                ),
                **self._inhalt_aus_konfig(cfg),
            }
            if self._anlegen(eintrag):
                angelegt += 1
        return angelegt

    def _fill_ota(self, tenant_id: str, cfg: dict, today: date, vorlauf: int) -> int:
        rows = (
            self._db.table("channex_review")
            .select("id, property_id, guest_name, ota, received_at, created_at")
            .eq("tenant_id", tenant_id)
            .in_("ota", sorted(OTA_MIT_GASTBEWERTUNG))
            .is_("guest_review_sent_at", "null")
            .eq("is_expired", False)
            .order("received_at", desc=True)
            .limit(_BATCH)
            .execute()
        ).data or []
        offen = self._ohne_eintrag(rows, "review_id", "id")

        angelegt = 0
        for review in offen:
            eingegangen = (
                _iso_zu_datum(review.get("received_at"))
                or _iso_zu_datum(review.get("created_at"))
                or today
            )
            eintrag = {
                "tenant_id": tenant_id,
                "source": "ota",
                "review_id": str(review["id"]),
                "property_id": review.get("property_id"),
                "guest_name": review.get("guest_name"),
                "send_at": _als_zeitpunkt(eingegangen + timedelta(days=vorlauf)),
                # Die Portal-Frist kennen wir nicht sicher — `is_expired` aus dem
                # Spiegel entscheidet beim Absenden. Kein geratenes Datum.
                "expires_at": None,
                **self._inhalt_aus_konfig(cfg),
            }
            if self._anlegen(eintrag):
                angelegt += 1
        return angelegt

    @staticmethod
    def _inhalt_aus_konfig(cfg: dict) -> dict[str, Any]:
        """Vorbelegung aus der Automatik-Konfiguration. Ab hier gehört der
        Inhalt der ZEILE — eine spätere Änderung der Konfiguration ändert
        bereits geplante Bewertungen nicht mehr."""
        note = int(cfg["auto_review_rating"])
        return {
            "rating": note,
            "text": cfg.get("auto_review_public"),
            "private_text": cfg.get("auto_review_private"),
            "score_cleanliness": note,
            "score_communication": note,
            "score_house_rules": note,
            "recommended": note >= 4,
        }

    def _anlegen(self, eintrag: dict) -> bool:
        try:
            self._db.table("guest_review_queue").insert(eintrag).execute()
        except APIError as exc:
            if exc.code == "23505":
                return False  # steht schon in der Schlange
            raise
        return True

    def _ohne_eintrag(
        self, rows: list[dict], spalte: str, schluessel: str
    ) -> list[dict]:
        """Zeilen, für die noch kein Warteschlangen-Eintrag existiert — egal in
        welchem Status. Ein übersprungener Eintrag darf NICHT wieder auftauchen."""
        if not rows:
            return []
        ids = [str(r[schluessel]) for r in rows]
        vorhanden = {
            str(x[spalte])
            for x in (
                self._db.table("guest_review_queue")
                .select(spalte)
                .in_(spalte, ids)
                .execute()
            ).data
            or []
        }
        return [r for r in rows if str(r[schluessel]) not in vorhanden]

    def _ohne_bestehende_bewertung(self, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        ids = [str(r["id"]) for r in rows]
        vorhanden = {
            str(x["reservation_id"])
            for x in (
                self._db.table("guest_reviews_by_host")
                .select("reservation_id")
                .in_("reservation_id", ids)
                .execute()
            ).data
            or []
        }
        return [r for r in rows if str(r["id"]) not in vorhanden]

    def _nur_ab_gastnote(self, rows: list[dict], min_rating: int) -> list[dict]:
        """Regel „nur ab X Sternen": es MUSS eine Gast-Bewertung geben, und die
        muss die Schwelle erreichen. Ohne Gast-Bewertung greift die Regel nicht
        (kein Rateschluss auf einen guten Aufenthalt)."""
        if not rows:
            return []
        ids = [str(r["id"]) for r in rows]
        gut = {
            str(x["reservation_id"])
            for x in (
                self._db.table("reviews")
                .select("reservation_id, rating")
                .in_("reservation_id", ids)
                .gte("rating", min_rating)
                .execute()
            ).data
            or []
        }
        return [r for r in rows if str(r["id"]) in gut]

    # ----------------------------------------------------------------- lesen
    def list_for_tenant(
        self, tenant_id: str, *, status: str | None, property_ids: list[str] | None,
        limit: int, offset: int,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("guest_review_queue")
            .select(_SPALTEN + ", properties(id, title)", count="exact")
            .eq("tenant_id", tenant_id)
        )
        if status:
            query = query.eq("status", status)
        if property_ids is not None:
            query = query.in_("property_id", property_ids)
        res = (
            query.order("send_at", desc=False)
            .range(offset, offset + max(limit, 1) - 1)
            .execute()
        )
        rows = res.data or []
        return rows, (res.count if res.count is not None else len(rows))

    def own(self, tenant_id: str, entry_id: str) -> dict:
        from src.core.supabase import load_scoped

        from .service import ReviewError

        return load_scoped(
            self._db,
            "guest_review_queue",
            entry_id,
            tenant_id,
            columns=_SPALTEN + ", properties(id, title)",
            not_found=ReviewError("Eintrag nicht gefunden.", status_code=404),
        )

    # ---------------------------------------------------------------- ändern
    def update(self, tenant_id: str, entry_id: str, patch: dict) -> dict:
        """Inhalt eines geplanten Eintrags ändern. Nur solange er 'geplant' ist —
        was raus ist, ist raus."""
        from .service import ReviewError

        eintrag = self.own(tenant_id, entry_id)
        if eintrag["status"] != "geplant":
            raise ReviewError(
                "Nur geplante Bewertungen lassen sich ändern.", status_code=409
            )
        sauber = {k: v for k, v in patch.items() if v is not None}
        for feld in ("text", "private_text"):
            if feld in sauber:
                sauber[feld] = plaintext(sauber[feld])
        if not sauber:
            raise ReviewError("Keine Änderung angegeben.", status_code=422)
        self._db.table("guest_review_queue").update(sauber).eq(
            "id", entry_id
        ).eq("tenant_id", tenant_id).execute()
        return self.own(tenant_id, entry_id)

    def skip(self, tenant_id: str, entry_id: str) -> dict:
        """Überspringen. Der Eintrag BLEIBT stehen — er ist der Beweis, dass
        bewusst nicht bewertet wurde, und verhindert, dass der nächste Tick ihn
        neu anlegt."""
        from .service import ReviewError

        eintrag = self.own(tenant_id, entry_id)
        if eintrag["status"] != "geplant":
            raise ReviewError(
                "Nur geplante Bewertungen lassen sich überspringen.", status_code=409
            )
        self._db.table("guest_review_queue").update(
            {"status": "uebersprungen"}
        ).eq("id", entry_id).eq("tenant_id", tenant_id).execute()
        return self.own(tenant_id, entry_id)

    # --------------------------------------------------------------- senden
    def send_entry(
        self, service: ReviewsService, tenant_id: str, entry: dict
    ) -> bool:
        """EINEN Eintrag abschicken. Rückgabe: ob er raus ist.

        Der Status wird VOR dem Absenden auf 'gesendet' gezogen (Wurzel 2): ein
        zweiter Worker oder ein Retry darf die Bewertung nicht ein zweites Mal
        beim Portal einreichen. Scheitert der Versand, wird die Zeile auf
        'fehler' korrigiert und der Grund festgehalten (Wurzel 5) — sie taucht
        dann in der Oberfläche auf, statt still zu verschwinden."""
        from .service import ReviewError

        beansprucht = (
            self._db.table("guest_review_queue")
            .update({"status": "gesendet", "sent_at": datetime.now(UTC).isoformat()})
            .eq("id", entry["id"])
            .eq("status", "geplant")
            .execute()
        ).data or []
        if not beansprucht:
            return False  # jemand anderes war schneller

        try:
            if entry["source"] == "marketplace":
                self._senden_marktplatz(service, tenant_id, entry)
            else:
                self._senden_ota(service, tenant_id, entry)
        except ReviewError as exc:
            self._db.table("guest_review_queue").update(
                {"status": "fehler", "sent_at": None, "error": exc.message[:500]}
            ).eq("id", entry["id"]).execute()
            log.warning(
                "review_queue_versand_fehlgeschlagen",
                entry_id=entry["id"], source=entry["source"], error=exc.message[:200],
            )
            return False
        return True

    def _senden_marktplatz(
        self, service: ReviewsService, tenant_id: str, entry: dict
    ) -> None:
        from src.core.supabase import load_scoped

        from .schemas import GuestScores
        from .service import ReviewError

        res = load_scoped(
            self._db,
            "reservations",
            str(entry["reservation_id"]),
            tenant_id,
            columns="id, property_id, guest_email",
            not_found=ReviewError("Reservierung nicht gefunden.", status_code=404),
        )
        service.insert_guest_rating(
            self._db,
            tenant_id=tenant_id,
            reservation=res,
            rating=int(entry["rating"]),
            text=entry.get("text"),
            scores=GuestScores(
                cleanliness=entry.get("score_cleanliness"),
                communication=entry.get("score_communication"),
                house_rules=entry.get("score_house_rules"),
            ),
        )

    def _senden_ota(
        self, service: ReviewsService, tenant_id: str, entry: dict
    ) -> None:
        from .schemas import GuestScores, OtaGuestReviewRequest
        from .service import ReviewError

        rows = (
            self._db.table("channex_review")
            .select("id, is_expired")
            .eq("id", str(entry["review_id"]))
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise ReviewError("Bewertung nicht gefunden.", status_code=404)
        if rows[0].get("is_expired"):
            raise ReviewError(
                "Das Bewertungsfenster des Portals ist abgelaufen.", status_code=409
            )
        service.send_ota_guest_review(
            service.system_context(tenant_id),
            str(entry["review_id"]),
            OtaGuestReviewRequest(
                rating=int(entry["rating"]),
                public_review=entry.get("text"),
                private_review=entry.get("private_text"),
                recommended=bool(entry.get("recommended", True)),
                scores=GuestScores(
                    cleanliness=entry.get("score_cleanliness"),
                    communication=entry.get("score_communication"),
                    house_rules=entry.get("score_house_rules"),
                ),
            ),
        )

    def send_due(self, service: ReviewsService, *, now: datetime | None = None) -> int:
        """Alle fälligen Einträge versenden (Worker-Tick, mandantenübergreifend)."""
        jetzt = (now or datetime.now(UTC)).isoformat()
        faellig = (
            self._db.table("guest_review_queue")
            .select(_SPALTEN)
            .eq("status", "geplant")
            .lte("send_at", jetzt)
            .order("send_at")
            .limit(_BATCH)
            .execute()
        ).data or []
        gesendet = 0
        for entry in faellig:
            if self.send_entry(service, str(entry["tenant_id"]), entry):
                gesendet += 1
        if gesendet:
            log.info("review_queue_versendet", count=gesendet)
        return gesendet

    def expire_overdue(self, *, now: datetime | None = None) -> int:
        """Geplante Einträge, deren Fenster zu ist, als 'abgelaufen' markieren —
        sie tauchen dann als solche in der Liste auf, statt für immer zu warten."""
        jetzt = (now or datetime.now(UTC)).isoformat()
        rows = (
            self._db.table("guest_review_queue")
            .update({"status": "abgelaufen"})
            .eq("status", "geplant")
            .not_.is_("expires_at", "null")
            .lt("expires_at", jetzt)
            .execute()
        ).data or []
        return len(rows)
