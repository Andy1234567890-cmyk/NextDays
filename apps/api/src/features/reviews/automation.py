"""Zeitgesteuerte Bewertungs-Vorgänge nach der Abreise.

Zwei Dinge, beide je Betrieb konfigurierbar (``review_automation``):

1. **Der Betrieb bewertet den Gast.** Airbnb veröffentlicht die Gast-Bewertung
   erst, wenn beide Seiten abgegeben haben oder die 14-Tage-Frist abläuft — wer
   von Hand bewertet, verpasst das Fenster regelmäßig.
2. **Erinnerung an den Gast**, seinen Aufenthalt auf myBestDays zu bewerten
   (Booking.com verschickt seine Einladung ~48 h nach Abreise; auf dem eigenen
   Marktplatz müssen wir das selbst tun).

Wichtig: die Bewertung wird hier NUR GEPLANT (``ReviewQueue.fill``), nicht
abgeschickt. Der Betrieb soll sie vorher sehen, ändern und überspringen können —
eine abgeschickte öffentliche Bewertung lässt sich bei keinem Portal
zurücknehmen. Den Versand übernimmt später ``ReviewQueue.send_due``.

Die Erinnerungsmail geht dagegen direkt raus; sie wird in
``review_automation_log`` festgehalten, BEVOR sie versendet wird — ein Retry
oder ein zweiter Worker darf keine zweite Mail schicken (Wurzel 2). Der
UNIQUE-Index auf (reservation_id, kind) ist der Backstop dazu.
"""
from __future__ import annotations

from datetime import date, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import sprache_fuer_gast
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern, marke_bestdays
from src.core.mail_texte import text
from src.core.supabase import get_service_client

from .queue import ReviewQueue

log = get_logger("nextdays.reviews.automation")

# Reservierungen, die überhaupt in Frage kommen. Stornierte werden nicht bewertet.
_ELIGIBLE_STATUS = ("confirmed", "completed")

# Wie weit zurück gesucht wird. Ohne Fenster würde ein frisch eingeschalteter
# Betrieb rückwirkend jede Altbuchung bewerten und anschreiben — das will
# niemand, und bei Airbnb wäre die Frist ohnehin abgelaufen.
_LOOKBACK_DAYS = 21

# Obergrenze je Lauf: der Tick soll nicht minutenlang laufen und nicht in einen
# Massenversand kippen. Was übrig bleibt, kommt im nächsten Lauf dran.
_BATCH = 50


class ReviewAutomation:
    """Führt die fälligen Bewertungs-Vorgänge aus (Worker/Cron, ohne AuthContext)."""

    def __init__(
        self,
        service_client: Client | None = None,
        *,
        mail: MailService | None = None,
    ) -> None:
        self._client = service_client
        self._mail = mail

    def _db(self) -> Client:
        if self._client is None:
            self._client = get_service_client()
        return self._client

    def _mailer(self) -> MailService:
        if self._mail is None:
            self._mail = MailService()
        return self._mail

    # ------------------------------------------------------------------- Lauf
    def run(self, *, today: date | None = None) -> tuple[int, int]:
        """Alle Betriebe mit aktiver Automatik abarbeiten.
        Rückgabe: (geplante Gast-Bewertungen, verschickte Erinnerungen)."""
        heute = today or date.today()
        db = self._db()
        configs = (
            db.table("review_automation")
            .select("*")
            .or_("auto_review_active.eq.true,guest_reminder_active.eq.true")
            .execute()
        ).data or []
        nach_tenant = {str(c["tenant_id"]): c for c in configs}

        # Betriebe, die AUSSCHLIESSLICH über Vorlagen arbeiten (0503) und die
        # alte Betriebs-Automatik nie eingeschaltet haben.
        #
        # Ohne diesen Schritt wäre jede Vorlage eine Attrappe: der Lauf startet
        # oben nur bei `auto_review_active`, das Flag gehört aber zur ALTEN
        # Konfiguration. Wer eine Vorlage anlegt und aktiv schaltet, hat damit
        # gesagt, dass er automatisch bewerten will — ihn dann zusätzlich
        # einen zweiten Schalter finden zu lassen wäre eine stille Falle
        # (Wurzel 1: der Gegenzustand zum neuen Weg muss mitgepflegt werden).
        mit_vorlage = (
            db.table("review_auto_template")
            .select("tenant_id")
            .eq("aktiv", True)
            .execute()
        ).data or []
        for zeile in mit_vorlage:
            tenant_id = str(zeile["tenant_id"])
            if tenant_id in nach_tenant:
                continue
            # Ersatz-Konfiguration mit den Vorgabewerten aus 0263. Sie liefert
            # nur die Felder, die `fill` als Rückfall liest — die Vorlage
            # überschreibt sie ohnehin je Objekt.
            nach_tenant[tenant_id] = {
                "tenant_id": tenant_id,
                "auto_review_active": True,
                "auto_review_after_days": 3,
                "auto_review_min_rating": None,
                "auto_review_rating": 5,
                # KEIN Text: ein Objekt ohne Vorlage soll bei diesen Betrieben
                # auch keine Bewertung bekommen. `fill` legt dann nichts an,
                # statt eine leere Bewertung einzuplanen.
                "auto_review_public": None,
                "auto_review_private": None,
                "guest_reminder_active": False,
                "guest_reminder_after_days": 2,
            }

        geplant = 0
        erinnert = 0
        for cfg in nach_tenant.values():
            tenant_id = str(cfg["tenant_id"])
            if cfg.get("auto_review_active"):
                geplant += self._rate_due_guests(db, tenant_id, cfg, heute)
            if cfg.get("guest_reminder_active"):
                erinnert += self._remind_due_guests(db, tenant_id, cfg, heute)
        if geplant or erinnert:
            log.info("review_automation_run", queued=geplant, reminded=erinnert)
        return geplant, erinnert

    # -------------------------------------------------- Betrieb bewertet Gast
    def _rate_due_guests(
        self, db: Client, tenant_id: str, cfg: dict, heute: date
    ) -> int:
        """Fällige Bewertungen in die WARTESCHLANGE stellen — nicht abschicken.

        Der Betrieb soll sie vorher sehen, ändern und überspringen können; eine
        abgeschickte öffentliche Bewertung lässt sich nicht zurücknehmen. Den
        Versand übernimmt später `ReviewQueue.send_due`."""
        return ReviewQueue(db).fill(tenant_id, cfg, heute)

    # ------------------------------------------------------ Erinnerung an Gast
    def _remind_due_guests(
        self, db: Client, tenant_id: str, cfg: dict, heute: date
    ) -> int:
        basis = (get_settings().marketplace_base_url or "").rstrip("/")
        if not basis:
            # Ohne Adresse keine Mail — ein Link auf eine geratene Domain wäre
            # wertlos (Wurzel 4). Sichtbar machen, nicht still überspringen.
            log.warning("review_reminder_ohne_basis_url", tenant_id=tenant_id)
            return 0
        faellig = self._due_reservations(
            db, tenant_id, int(cfg["guest_reminder_after_days"]), heute
        )
        offen = self._without_log(db, faellig, "guest_reminder")
        offen = self._without_guest_review(db, offen)
        if not offen:
            return 0

        titel = self._property_titles(db, [str(r["property_id"]) for r in offen])
        gezaehlt = 0
        for res in offen:
            empfaenger = (res.get("guest_email") or "").strip()
            if not empfaenger:
                continue
            if not self._claim(db, tenant_id, str(res["id"]), "guest_reminder"):
                continue
            # Sprache des GASTES: sie steht an der Buchung (`guest_language`,
            # aus der OTA-Payload `customer.language`) — die einzige echte
            # Auskunft über einen Gast, der bei uns kein Konto hat. Fehlt sie,
            # greift die Betriebssprache und zuletzt Englisch. Nie Deutsch als
            # stiller Rückfall (Wurzel 4).
            sprache = sprache_fuer_gast(
                db, guest_language=res.get("guest_language"), tenant_id=tenant_id
            )
            objekt = titel.get(str(res["property_id"])) or text(
                "reviews.erinnerung.objekt_fallback", sprache
            )
            link = f"{basis}/bewertungen?reservation={res['id']}"
            # Marke ist myBestDays: der Empfänger ist ein GAST des Marktplatzes,
            # nicht der Betrieb. Das Layout ist dasselbe, nur Kopf und Absender
            # wechseln (CLAUDE.md „Zwei Marken").
            mail = mail_rendern(
                MailInhalt(
                    titel=text(
                        "reviews.erinnerung.betreff", sprache, objekt=objekt
                    ),
                    absaetze=[
                        text(
                            "reviews.erinnerung.absatz_hoffnung", sprache,
                            objekt=objekt,
                        ),
                        text("reviews.erinnerung.absatz_nutzen", sprache),
                    ],
                    aktion=Aktion(
                        text=text("reviews.erinnerung.aktion", sprache),
                        url=link,
                    ),
                    # Bewusst ein eigener Gruß statt des Standardgrußes: diese
                    # Mail BITTET um etwas, „Vielen Dank!" ist der passende
                    # Ton. Er kommt aus dem Katalog, ist also übersetzt.
                    gruss=text("reviews.erinnerung.gruss", sprache),
                    sprache=sprache,
                ),
                marke=marke_bestdays(),
            )
            try:
                self._mailer().send(
                    OutboundMessage(
                        to=empfaenger,
                        subject=text(
                            "reviews.erinnerung.betreff", sprache, objekt=objekt
                        ),
                        text=mail.text,
                        html=mail.html,
                        inline_bilder=mail.inline_bilder,
                    )
                )
            except MailError as exc:
                self._note_error(db, str(res["id"]), "guest_reminder", exc.message)
                continue
            gezaehlt += 1
        return gezaehlt

    # ---------------------------------------------------------------- Auswahl
    @staticmethod
    def _property_titles(db: Client, property_ids: list[str]) -> dict[str, str]:
        """Objekt-Titel für die Anrede in der Erinnerung. Fehlt einer, benennt
        der Aufrufer den Aufenthalt allgemein — kein erfundener Name."""
        if not property_ids:
            return {}
        rows = (
            db.table("properties")
            .select("id, title")
            .in_("id", sorted(set(property_ids)))
            .execute()
        ).data or []
        return {str(r["id"]): r["title"] for r in rows if r.get("title")}

    def _due_reservations(
        self, db: Client, tenant_id: str, after_days: int, heute: date
    ) -> list[dict]:
        """Abgereiste Reservierungen im Fälligkeitsfenster."""
        bis = heute - timedelta(days=after_days)
        von = bis - timedelta(days=_LOOKBACK_DAYS)
        return (
            db.table("reservations")
            .select(
                "id, property_id, guest_email, check_out, status, guest_language"
            )
            .eq("tenant_id", tenant_id)
            .in_("status", list(_ELIGIBLE_STATUS))
            .lte("check_out", bis.isoformat())
            .gte("check_out", von.isoformat())
            .order("check_out", desc=True)
            .limit(_BATCH)
            .execute()
        ).data or []

    @staticmethod
    def _without_log(db: Client, rows: list[dict], kind: str) -> list[dict]:
        """Reservierungen ohne Log-Eintrag dieser Art."""
        if not rows:
            return []
        ids = [str(r["id"]) for r in rows]
        erledigt = {
            str(x["reservation_id"])
            for x in (
                db.table("review_automation_log")
                .select("reservation_id")
                .eq("kind", kind)
                .in_("reservation_id", ids)
                .execute()
            ).data
            or []
        }
        return [r for r in rows if str(r["id"]) not in erledigt]

    @staticmethod
    def _without_guest_review(db: Client, rows: list[dict]) -> list[dict]:
        """Reservierungen, die der Gast noch nicht bewertet hat — wer schon
        bewertet hat, bekommt keine Erinnerung."""
        if not rows:
            return []
        ids = [str(r["id"]) for r in rows]
        vorhanden = {
            str(x["reservation_id"])
            for x in (
                db.table("reviews")
                .select("reservation_id")
                .in_("reservation_id", ids)
                .execute()
            ).data
            or []
        }
        return [r for r in rows if str(r["id"]) not in vorhanden]

    # ------------------------------------------------------------------- Log
    @staticmethod
    def _claim(db: Client, tenant_id: str, reservation_id: str, kind: str) -> bool:
        """Vorgang beanspruchen. False, wenn ihn jemand anderes schon hat —
        der UNIQUE-Index (reservation_id, kind) entscheidet, nicht ein Vorab-
        SELECT (das wäre ein Race, Wurzel 2)."""
        try:
            db.table("review_automation_log").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "kind": kind,
                }
            ).execute()
        except APIError as exc:
            if exc.code == "23505":
                return False
            raise
        return True

    @staticmethod
    def _note_error(
        db: Client, reservation_id: str, kind: str, message: str
    ) -> None:
        """Fehlgeschlagenen Vorgang am Log-Eintrag festhalten. Der Eintrag
        BLEIBT stehen — er ist der Beweis, dass es versucht wurde, und
        verhindert eine Endlosschleife im nächsten Tick (Wurzel 5)."""
        try:
            db.table("review_automation_log").update(
                {"error": message[:500]}
            ).eq("reservation_id", reservation_id).eq("kind", kind).execute()
        except Exception as exc:  # noqa: BLE001 — Protokoll darf den Lauf nicht kippen
            log.warning("review_automation_log_update_failed", error=str(exc)[:200])
