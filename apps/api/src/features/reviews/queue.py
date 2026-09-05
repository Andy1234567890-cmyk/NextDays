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

import math
import secrets
from datetime import UTC, date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .common import DOUBLE_BLIND_DAYS, as_dt, plaintext
from .schemas import (
    MARKETPLACE_CHANNEL,
    GuestScores,
    KiRichtung,
    KiZustellart,
    QueueEntry,
    QueueStatus,
    ReviewSource,
)

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
    "created_at, updated_at, "
    # Richtung und Herkunft des Textes (0549). MUSS mitgelesen werden: ohne
    # `richtung` schickt `send_entry` eine öffentliche Antwort als
    # Gastbewertung ans Portal — der Text stünde dann als unsere Bewertung
    # DES GASTES da.
    "richtung, ki_erzeugt, antwort_auf_id, "
    # Zustellart (0566). MUSS mitgelesen werden: die Oberfläche unterscheidet
    # daran „geht am … raus" von „wartet auf Freigabe".
    "zustellart"
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
        # Vorlagen EINMAL je Lauf laden, nicht je Reservierung: bei 50
        # Einträgen wären das 50 identische Abfragen für Daten, die sich
        # während des Laufs nicht ändern.
        vorlagen = self._vorlagen(tenant_id)
        angelegt = self._fill_marketplace(tenant_id, cfg, today, vorlauf, vorlagen)
        angelegt += self._fill_ota(tenant_id, cfg, today, vorlauf, vorlagen)
        if angelegt:
            log.info("review_queue_gefuellt", tenant_id=tenant_id, angelegt=angelegt)
        return angelegt

    def _fill_marketplace(  # noqa: PLR0913 — ein Lauf, alles durchgereicht
        self,
        tenant_id: str,
        cfg: dict,
        today: date,
        vorlauf: int,
        vorlagen: dict[str, dict],
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
        # Die Schwelle „nur ab X Sternen" steht je Vorlage, also je OBJEKT —
        # sie kann nicht mehr vor der Schleife weggefiltert werden. Die Noten
        # werden trotzdem in EINER Abfrage geholt und dann je Zeile geprüft.
        gastnoten = self._gastnoten(offen)
        offen = [
            r
            for r in offen
            if self._schwelle_erfuellt(
                cfg, vorlagen, r.get("property_id"), gastnoten.get(str(r["id"]))
            )
        ]

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
                # Vorlauf aus der Vorlage des Objekts, sonst aus der
                # Betriebs-Konfiguration. Zwei Objekte dürfen verschieden
                # schnell bewerten — sonst wäre `nach_tagen` an der Vorlage
                # eine Attrappe.
                "send_at": _als_zeitpunkt(
                    (abreise or today)
                    + timedelta(
                        days=self._vorlauf(vorlauf, vorlagen, res.get("property_id"))
                    )
                ),
                # Eigene Frist: die Zwei-Wege-Sichtbarkeit endet nach 14 Tagen.
                "expires_at": (
                    _als_zeitpunkt(abreise + timedelta(days=DOUBLE_BLIND_DAYS))
                    if abreise
                    else None
                ),
                **self._inhalt(cfg, vorlagen, res.get("property_id")),
            }
            if self._anlegen(eintrag):
                angelegt += 1
        return angelegt

    def _fill_ota(  # noqa: PLR0913 — ein Lauf, alles durchgereicht
        self,
        tenant_id: str,
        cfg: dict,
        today: date,
        vorlauf: int,
        vorlagen: dict[str, dict],
    ) -> int:
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
                "send_at": _als_zeitpunkt(
                    eingegangen
                    + timedelta(
                        days=self._vorlauf(
                            vorlauf, vorlagen, review.get("property_id")
                        )
                    )
                ),
                # Die Portal-Frist kennen wir nicht sicher — `is_expired` aus dem
                # Spiegel entscheidet beim Absenden. Kein geratenes Datum.
                "expires_at": None,
                **self._inhalt(cfg, vorlagen, review.get("property_id")),
            }
            if self._anlegen(eintrag):
                angelegt += 1
        return angelegt

    def _vorlagen(self, tenant_id: str) -> dict[str, dict]:
        """Aktive Auto-Bewertungs-Vorlagen, nach Objekt-ID aufgeschlüsselt.

        Ein Objekt hat höchstens EINE aktive Vorlage — die Datenbank erzwingt
        das (Trigger aus 0503), hier wird es nur genutzt.
        """
        vorlagen = (
            self._db.table("review_auto_template")
            .select(
                "id, name, nach_tagen, note, min_gastnote, texte, privater_text, "
                "review_auto_template_property(property_id)"
            )
            .eq("tenant_id", tenant_id)
            .eq("aktiv", True)
            .execute()
        ).data or []
        je_objekt: dict[str, dict] = {}
        for vorlage in vorlagen:
            for zuordnung in vorlage.get("review_auto_template_property") or []:
                objekt = zuordnung.get("property_id")
                if objekt:
                    je_objekt[str(objekt)] = vorlage
        return je_objekt

    @staticmethod
    def _vorlauf(
        standard: int, vorlagen: dict[str, dict], property_id: object
    ) -> int:
        """Tage bis zum Versand — aus der Vorlage, sonst der Betriebswert."""
        vorlage = vorlagen.get(str(property_id)) if property_id else None
        return int(vorlage["nach_tagen"]) if vorlage else standard

    @staticmethod
    def _text_waehlen(texte: object) -> str | None:
        """EINEN Text aus der Vorlage ziehen — zufällig.

        Das ist der ganze Grund für die Mehrzahl. Hostaway begründet es in
        seiner eigenen Doku, und es ist ein Betriebsbefund, kein Geschmack:

            „Airbnb may penalize this practice, and it may affect the SEO."

        Wer 500-mal denselben Satz schickt, sieht für das Portal aus wie ein
        Bot. Deshalb `random.choice` und nicht „der erste".
        """
        if not isinstance(texte, list):
            return None
        brauchbar = [
            str(t).strip() for t in texte if isinstance(t, str) and t.strip()
        ]
        return secrets.choice(brauchbar) if brauchbar else None

    def _inhalt(
        self, cfg: dict, vorlagen: dict[str, dict], property_id: object
    ) -> dict[str, Any]:
        """Vorbelegung des Eintrags — aus der Vorlage des Objekts, sonst aus
        der Betriebs-Konfiguration.

        Ab hier gehört der Inhalt der ZEILE: eine spätere Änderung der Vorlage
        ändert bereits geplante Bewertungen nicht mehr. Das ist Absicht — was
        der Betrieb in seiner Warteschlange gesehen und stehen gelassen hat,
        soll nicht hinter seinem Rücken zu einem anderen Text werden.

        Der Rückfall auf ``review_automation`` bleibt, solange es Betriebe
        gibt, die noch keine Vorlage angelegt haben. Ihn zu streichen würde
        ihre Automatik still abschalten (Wurzel 1).
        """
        vorlage = vorlagen.get(str(property_id)) if property_id else None
        if vorlage is None:
            return self._inhalt_aus_konfig(cfg)
        note = int(vorlage["note"])
        return {
            "rating": note,
            "text": self._text_waehlen(vorlage.get("texte")),
            "private_text": vorlage.get("privater_text"),
            "score_cleanliness": note,
            "score_communication": note,
            "score_house_rules": note,
            "recommended": note >= 4,
        }

    @staticmethod
    def _inhalt_aus_konfig(cfg: dict) -> dict[str, Any]:
        """Rückfall: die alte Betriebs-Konfiguration (0263), für Objekte ohne
        eigene Vorlage."""
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
        """Einen Entwurf in die Warteschlange legen.

        OHNE TEXT wird nichts angelegt. Das ist seit 0503 der Normalfall und
        kein Sonderfall: ein Betrieb, der nur mit Vorlagen arbeitet, hat für
        Objekte ohne Vorlage bewusst keinen Text — dort soll auch nichts
        rausgehen. Ein leerer Eintrag würde entweder eine leere öffentliche
        Bewertung erzeugen oder Tage später als Fehler auflaufen, und beides
        wäre eine Folge davon, dass hier nichts geprüft wurde (Wurzel 5).
        """
        if not (eintrag.get("text") or "").strip():
            return False
        # Die Vorlagen-Automatik hat genau das zugesagt: planen, zeigen, zur
        # Fälligkeit senden. Explizit statt DB-Vorgabe, damit der Test-Doppel
        # dasselbe sieht wie die Live-DB.
        eintrag.setdefault("zustellart", "automatisch")
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
        welchem Status. Ein übersprungener Eintrag darf NICHT wieder auftauchen.

        Nur Einträge der Richtung 'gast_bewerten' zählen. Seit 0549 steht in
        derselben Tabelle auch die öffentliche ANTWORT, und die trägt dieselbe
        ``review_id``: ohne den Filter läse eine vorhandene Antwort wie eine
        vorhandene Gastbewertung, und die Gastbewertung würde nie angelegt —
        ein stiller Ausfall genau des Vorgangs, für den es diese Methode gibt
        (Wurzel 1: der Gegenzustand der zweiten Richtung gehört mitgepflegt).
        """
        if not rows:
            return []
        ids = [str(r[schluessel]) for r in rows]
        vorhanden = {
            str(x[spalte])
            for x in (
                self._db.table("guest_review_queue")
                .select(spalte)
                .eq("richtung", "gast_bewerten")
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

    def _gastnoten(self, rows: list[dict]) -> dict[str, int]:
        """Note des Gastes je Reservierung, in EINER Abfrage.

        Vorher wurde direkt nach der Schwelle gefiltert (`.gte("rating", …)`).
        Das ging, solange die Schwelle für den ganzen Betrieb galt — mit
        Vorlagen ist sie je Objekt verschieden, also muss die Note selbst
        herkommen und der Vergleich je Zeile passieren.
        """
        if not rows:
            return {}
        zeilen = (
            self._db.table("reviews")
            .select("reservation_id, rating")
            .in_("reservation_id", [str(r["id"]) for r in rows])
            .execute()
        ).data or []
        return {
            str(z["reservation_id"]): int(z["rating"])
            for z in zeilen
            if z.get("reservation_id") and z.get("rating") is not None
        }

    @staticmethod
    def _schwelle_erfuellt(
        cfg: dict,
        vorlagen: dict[str, dict],
        property_id: object,
        gastnote: int | None,
    ) -> bool:
        """Regel „nur bewerten, wenn der Gast mindestens X gab".

        Schwelle aus der Vorlage des Objekts, sonst aus der Betriebs-
        Konfiguration. Ohne Schwelle wird immer bewertet.

        Ohne Gast-Bewertung greift die Regel NICHT — kein Rateschluss auf
        einen guten Aufenthalt. Das war schon vorher so und bleibt: wer sagt
        „nur ab 4 Sternen", meint „nur wenn der Gast 4 gab", nicht „auch wenn
        er gar nichts gesagt hat".
        """
        vorlage = vorlagen.get(str(property_id)) if property_id else None
        schwelle = (
            vorlage.get("min_gastnote")
            if vorlage is not None
            else cfg.get("auto_review_min_rating")
        )
        if schwelle is None:
            return True
        return gastnote is not None and gastnote >= int(schwelle)

    # ----------------------------------------------------------------- lesen
    def list_for_tenant(  # noqa: PLR0913 — Filter der Liste, jeder optional
        self, tenant_id: str, *, status: str | None, property_ids: list[str] | None,
        limit: int, offset: int, richtung: str | None = None,
    ) -> tuple[list[dict], int]:
        query = (
            self._db.table("guest_review_queue")
            .select(_SPALTEN + ", properties(id, title)", count="exact")
            .eq("tenant_id", tenant_id)
        )
        if status:
            query = query.eq("status", status)
        if richtung:
            query = query.eq("richtung", richtung)
        if property_ids is not None:
            query = query.in_("property_id", property_ids)
        res = (
            query.order("send_at", desc=False)
            .range(offset, offset + max(limit, 1) - 1)
            .execute()
        )
        rows = res.data or []
        return rows, (res.count if res.count is not None else len(rows))

    def status_counts(
        self, tenant_id: str, *, property_ids: list[str] | None
    ) -> dict[str, int]:
        """Anzahl je Status über den ganzen Bestand des Betriebs."""
        query = (
            self._db.table("guest_review_queue")
            .select("status")
            .eq("tenant_id", tenant_id)
        )
        if property_ids is not None:
            query = query.in_("property_id", property_ids)
        zaehler: dict[str, int] = {}
        for row in fetch_all_rows(query.order("id")):
            st = str(row.get("status") or "")
            zaehler[st] = zaehler.get(st, 0) + 1
        return zaehler

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
        if eintrag.get("richtung") == "antwort" and set(sauber) - {"text"}:
            # Eine öffentliche Antwort HAT keine Note, Empfehlung oder
            # Privatnachricht — `_senden_antwort` schickt nur den Text. Was
            # hier gespeichert würde, wäre eine Attrappe (Wurzel 4).
            raise ReviewError(
                "An einer Antwort lässt sich nur der Text ändern.", status_code=422
            )
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
            # Die RICHTUNG entscheidet zuerst, erst danach die Quelle: ein
            # Antwort-Eintrag mit source='ota' ist eine öffentliche Antwort
            # UNTER einer Bewertung, keine Gastbewertung. Beides über denselben
            # Zweig zu schicken hiesse, den Text an `guest_review` zu geben —
            # er stünde dann als unsere Bewertung DES GASTES beim Portal.
            if entry.get("richtung") == "antwort":
                self._senden_antwort(service, tenant_id, entry)
            elif entry["source"] == "marketplace":
                self._senden_marktplatz(service, tenant_id, entry)
            else:
                self._senden_ota(service, tenant_id, entry)
        except ReviewError as exc:
            self._fehler(entry, exc.message)
            log.warning(
                "review_queue_versand_fehlgeschlagen",
                entry_id=entry["id"], source=entry["source"], error=exc.message[:200],
            )
            return False
        except Exception as exc:
            # Kein ReviewError (APIError, Channex-Budget, Netz): OHNE diesen
            # Zweig bliebe die Zeile auf 'gesendet' mit sent_at stehen, obwohl
            # nichts raus ist — der Claim von oben wäre eine Falschaussage.
            # Zurück auf 'fehler' und WEITERREICHEN (Wurzel 5: das Signal
            # gehört dem Aufrufer, nicht dem Log).
            self._fehler(entry, f"{type(exc).__name__}: {exc}")
            log.error(
                "review_queue_versand_abgebrochen",
                entry_id=entry["id"], source=entry["source"],
                grund=type(exc).__name__, error=str(exc)[:200],
            )
            raise
        if entry.get("ki_erzeugt"):
            self._ki_protokoll_gesendet(tenant_id, entry)
            # Live-Signal (0568): der Betrieb sieht „gesendet" sofort, nicht
            # erst beim nächsten Seitenaufruf.
            from .ki_store import KiStore

            KiStore(self._db).stand_setzen(
                tenant_id,
                "KI-Antwort an das Portal gesendet"
                if entry.get("richtung") == "antwort"
                else "KI-Gastbewertung an das Portal gesendet",
            )
        return True

    def _fehler(self, entry: dict, grund: str) -> None:
        self._db.table("guest_review_queue").update(
            {"status": "fehler", "sent_at": None, "error": grund[:500]}
        ).eq("id", entry["id"]).execute()

    def _ki_protokoll_gesendet(self, tenant_id: str, entry: dict) -> None:
        """Gegenzustand (Wurzel 1): Der KI-Lauf protokolliert jeden Text mit
        ``gesendet_at = NULL`` — geschickt wird er erst hier. Ohne das Nachtragen
        stünde im Protokoll „nicht gesendet" unter einem Text, der öffentlich
        beim Portal steht. Best effort: die Spur darf den Versand nicht kippen,
        meldet ihren Ausfall aber LAUT (Wurzel 5)."""
        # Dieselbe Reihenfolge wie der KI-Lauf beim Protokollieren: Antwort →
        # Bewertung, Marktplatz-Gastbewertung → Reservierung, Airbnb-
        # Gastbewertung → die Warteschlangen-Zeile selbst.
        bezug = (
            entry.get("antwort_auf_id")
            or entry.get("reservation_id")
            or entry.get("id")
        )
        if not bezug:
            return
        try:
            self._db.table("review_ki_protokoll").update(
                {"gesendet_at": datetime.now(UTC).isoformat()}
            ).eq("tenant_id", tenant_id).eq("bezug_id", str(bezug)).eq(
                "richtung", entry.get("richtung") or "gast_bewerten"
            ).is_("gesendet_at", "null").execute()
        except APIError as exc:  # noqa: BLE001 — Spur, nicht Hauptpfad
            log.warning(
                "review_ki_protokoll_gesendet_fehlgeschlagen",
                entry_id=entry["id"], error=str(exc)[:200],
            )

    def _senden_antwort(
        self, service: ReviewsService, tenant_id: str, entry: dict
    ) -> None:
        """Die öffentliche ANTWORT unter einer Bewertung abschicken.

        Sie geht über denselben Weg wie die Antwort von Hand
        (``ReviewsService.reply``) — erst zum Portal, dann in den eigenen
        Bestand (Wurzel 1). Kein zweiter Pfad daneben: der bestehende spiegelt
        den Erfolg selbst, und eine Kopie davon liefe auseinander, sobald
        jemand das Spiegeln anfasst.
        """
        from .schemas import ReviewSource
        from .service import ReviewError

        text = (entry.get("text") or "").strip()
        if not text:
            raise ReviewError("Kein Antworttext hinterlegt.", status_code=422)
        bezug = entry.get("antwort_auf_id") or entry.get("review_id")
        if not bezug:
            raise ReviewError(
                "Keine Bewertung, auf die geantwortet wird.", status_code=422
            )
        quelle = (
            ReviewSource.marketplace
            if entry.get("source") == "marketplace"
            else ReviewSource.ota
        )
        service.reply(service.system_context(tenant_id), quelle, str(bezug), text)

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
            aus_warteschlange=True,
        )

    def send_due(
        self,
        service: ReviewsService,
        *,
        now: datetime | None = None,
        only_tenant: str | None = None,
    ) -> int:
        """Alle fälligen Einträge versenden (Worker-Tick, mandantenübergreifend;
        `only_tenant` beim Handlauf aus der Oberfläche — Wurzel 3).

        NUR ``zustellart = 'automatisch'``. Ein Entwurf hat ebenfalls
        ``status='geplant'`` und ein ``send_at`` in der Vergangenheit (damit er
        in der Liste oben steht) — er wartet aber auf einen Menschen. Am
        05.09.2026 fehlte dieser Filter, und sieben KI-„Entwürfe" gingen im
        Tick ihrer Entstehung öffentlich an die Portale (0566)."""
        jetzt = (now or datetime.now(UTC)).isoformat()
        q = (
            self._db.table("guest_review_queue")
            .select(_SPALTEN)
            .eq("status", "geplant")
            .eq("zustellart", "automatisch")
            .lte("send_at", jetzt)
        )
        if only_tenant:
            q = q.eq("tenant_id", only_tenant)
        faellig = q.order("send_at").limit(_BATCH).execute().data or []
        from src.features.channel_manager.channex_client import (
            ChannexBudgetExhausted,
        )

        gesendet = 0
        for entry in faellig:
            try:
                if self.send_entry(service, str(entry["tenant_id"]), entry):
                    gesendet += 1
            except ChannexBudgetExhausted:
                # Kontroll-Signal: ohne Budget scheitert jeder weitere
                # Portal-Eintrag genauso — nicht 49 Zeilen auf 'fehler'
                # stellen, sondern den Lauf beenden (Wurzel 5).
                raise
            except Exception as exc:  # noqa: BLE001 — je Eintrag isoliert, Zeile trägt den Grund
                log.error(
                    "review_queue_eintrag_uebersprungen",
                    entry_id=entry["id"], grund=type(exc).__name__,
                )
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

    def erledigt_durch_handarbeit(
        self,
        tenant_id: str,
        *,
        reservation_id: str | None = None,
        review_id: str | None = None,
        richtung: str = "gast_bewerten",
    ) -> int:
        """Gegenzustand (Wurzel 1): Wer von Hand bewertet, macht den geplanten
        Eintrag derselben Reservierung gegenstandslos — er MUSS mit abgeräumt
        werden. Mit ``richtung``: die Gastbewertung und die öffentliche
        Antwort hängen an DERSELBEN Airbnb-Bewertung (review_id) — wer den
        Gast von Hand bewertet, hat damit nicht geantwortet, und umgekehrt.

        Ohne das findet der Betrieb Tage später einen roten Eintrag in seiner
        Warteschlange ('Für diese Bewertung wurde der Gast bereits bewertet.'),
        obwohl er alles richtig gemacht hat: der Tick versucht zu senden, das
        Portal lehnt zu Recht ab, und der Fehler zeigt auf den Falschen.

        Nur 'geplant' wird angefasst. Ein bereits gesendeter oder bewusst
        übersprungener Eintrag ist Geschichte und wird nicht umgeschrieben."""
        if not reservation_id and not review_id:
            return 0
        query = (
            self._db.table("guest_review_queue")
            .update(
                {
                    "status": "uebersprungen",
                    "error": (
                        "Von Hand beantwortet — der geplante Versand entfällt."
                        if richtung == "antwort"
                        else "Von Hand bewertet — der geplante Versand entfällt."
                    ),
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("status", "geplant")
            .eq("richtung", richtung)
        )
        query = (
            query.eq("review_id", review_id)
            if review_id
            else query.eq("reservation_id", str(reservation_id))
        )
        rows = (query.execute()).data or []
        if rows:
            log.info(
                "review_queue_durch_handarbeit_erledigt",
                tenant_id=tenant_id,
                count=len(rows),
                reservation_id=reservation_id,
                review_id=review_id,
            )
        return len(rows)


# ------------------------------------------------------------- Abbildung
def _tage_bis(ziel: datetime | None, jetzt: datetime) -> int | None:
    """Ganze Tage bis `ziel`, aufgerundet; negativ = überfällig; None = unbekannt."""
    if ziel is None:
        return None
    return math.ceil((ziel - jetzt).total_seconds() / 86400)


def kanaele_fuer(db: Client, tenant_id: str, rows: list[dict]) -> dict[str, str]:
    """Portal je Warteschlangen-Zeile (review_id → channex_review.ota), in
    EINER Abfrage für die Seite. Ohne das nannte die Oberfläche jeden
    Portal-Eintrag „Airbnb" — eine Booking-Antwort stand als Airbnb da."""
    ids = sorted({str(r["review_id"]) for r in rows if r.get("review_id")})
    if not ids:
        return {}
    zeilen = (
        db.table("channex_review")
        .select("id, ota")
        .eq("tenant_id", tenant_id)
        .in_("id", ids)
        .execute()
    ).data or []
    return {str(z["id"]): str(z["ota"]) for z in zeilen if z.get("ota")}

def zu_eintrag(row: dict, kanaele: dict[str, str] | None = None) -> QueueEntry:
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
        richtung=KiRichtung(row.get("richtung") or "gast_bewerten"),
        ki_erzeugt=bool(row.get("ki_erzeugt")),
        zustellart=KiZustellart(row.get("zustellart") or "automatisch"),
        channel_code=(
            MARKETPLACE_CHANNEL
            if row.get("source") == "marketplace"
            else (kanaele or {}).get(str(row.get("review_id") or ""))
        ),
        antwort_auf_id=(
            str(row["antwort_auf_id"]) if row.get("antwort_auf_id") else None
        ),
        reservation_id=(
            str(row["reservation_id"]) if row.get("reservation_id") else None
        ),
        review_id=str(row["review_id"]) if row.get("review_id") else None,
        send_at=send_at,
        expires_at=expires_at,
        # Aufgerundet: 23 Stunden Frist sind „noch 1 Tag", nicht 0; und
        # zwischen zwei Ticks steht kein „-1 Tage".
        days_until_send=_tage_bis(send_at, jetzt),
        days_left=_tage_bis(expires_at, jetzt),
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


def ki_antwort_ids(db: Client, tenant_id: str, review_ids: list[str]) -> set[str]:
    """Bewertungen, deren öffentliche Antwort aus der KI-Warteschlange kam und
    gesendet ist — EINE Abfrage je Seite. Die Liste zeigt daran „KI-Antwort":
    ohne die Markierung sah niemand, welche Antworten ein Modell geschrieben hat."""
    ids = sorted({str(r) for r in review_ids if r})
    if not ids:
        return set()
    zeilen = (
        db.table("guest_review_queue")
        .select("antwort_auf_id")
        .eq("tenant_id", tenant_id)
        .eq("richtung", "antwort")
        .eq("ki_erzeugt", True)
        .eq("status", "gesendet")
        .in_("antwort_auf_id", ids)
        .execute()
    ).data or []
    return {str(z["antwort_auf_id"]) for z in zeilen if z.get("antwort_auf_id")}
