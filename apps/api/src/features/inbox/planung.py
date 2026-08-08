"""Geplante Nachrichten und Nachrichten-Automatisierungen des Posteingangs.

Aus `service.py` herausgelöst: das Modul war auf über 1700 Zeilen gewachsen und
riss damit die pylint-Grenze (`too-many-lines`, 1500). Der Block hier ist in
sich geschlossen — planen, Fälligkeit berechnen, Zeitfenster prüfen, ausliefern.

Bewusst als **Mixin** statt als eigener Service: Methodennamen, Aufrufstellen
(Router, Cron, Tests) und `self`-Zugriffe bleiben unverändert. Das ist die
Vorgabe für gewachsene Services — aufteilen, aber die öffentliche Oberfläche
behalten (dieselbe Lehre wie beim channel_manager).
"""
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .ausloeser import DATUMS_TRIGGER, anker_von, versatz_normieren
from .errors import InboxError
from .schemas import BulkUpdateResult, ScheduledMessage, ScheduledMessageList
from .zeit import zeitzone as _zeitzone

log = get_logger("nextdays.inbox")

# Ab wann ist eine Automail ein Nachzügler und wird NICHT mehr verschickt?
#
# Ein Zeitpunkt, der über einen Tag zurückliegt, ist als Zeitpunkt nicht mehr
# einzuhalten: „Ihre Anreise ist in 3 Tagen" an jemanden, der gestern abgereist
# ist, richtet Schaden an. Der Fall ist real — beim Import bestehender Buchungen
# (Bestandsübernahme, Recovery-Import) entstehen auf einen Schlag Hunderte
# Zeilen, deren Ankerdatum längst vorbei ist. Sie werden als 'skipped'
# festgehalten, nicht still gelöscht: die Regel HAT für diese Buchung gegriffen,
# nur eben zu spät.
NACHZUEGLER_STUNDEN = 24

# Wie weit zurück eine Buchung noch neu geplant wird. Deckt „nach der Abreise"
# ab (Bewertungsbitte); alles Ältere kann nur noch Nachzügler erzeugen.
NEUPLANUNG_RUECKBLICK_TAGE = 30

# Harte Obergrenze je Neuplanung (Wurzel 8: kein unbegrenzter Bereich). Wird sie
# erreicht, steht das im Log — stilles Abschneiden sähe aus wie „alles geplant".
NEUPLANUNG_MAX_THREADS = 2000

# Spalten, die eine Planung vom Thread braucht. `status` entscheidet, ob
# überhaupt geplant wird (storniert = nein), `booked_at` ist der Anker „Buchung".
THREAD_COLS = (
    "id, tenant_id, property_map_id, property_id, ota_name, arrival_date, "
    "departure_date, booked_at, status"
)

# Zustände einer geplanten Automail, die eine Neuplanung überschreiben DARF.
# 'sent'/'sending' sind unantastbar (sonst Doppelversand, Wurzel 2), 'failed'
# trägt einen Fehlertext, den ein stiller Neuversuch verdecken würde.
UEBERSCHREIBBAR = ("pending", "skipped", "cancelled")


class PlanungMixin:
    """Geplante Nachrichten + Automatisierungen. Teil von `InboxService`."""

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung die
    # Zugriffe kennt. pylint behandelt `*Mixin` gesondert (keine no-member-Flut).
    _db: Client | None
    _channex: Any
    _AUTOMATION_COLS: str
    # Aus `VorlagenMixin` — beide sind Teil desselben `InboxService`.
    _felder_pruefen: Any

    # --- Geplante Nachrichten ----------------------------------------------
    def schedule_message(
        self, ctx: AuthContext, thread_id: str, body: str, send_at: str
    ) -> ScheduledMessage:
        text = (body or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        if not (send_at or "").strip():
            raise InboxError("Zeitpunkt fehlt.", status_code=422)
        # Platzhalter JETZT prüfen, solange der Autor davorsitzt. Beim Versand
        # bleibt ein unbekannter Schlüssel bewusst stehen (`rendern` ersetzt nur,
        # was der Katalog kennt) — ein getipptes `{{guest_nmae}}` ginge also
        # wörtlich an den Gast. Vorlagen und Automationen prüfen an dieser Stelle
        # längst; der geplante Einzelversand war der letzte ungeprüfte Weg.
        self._felder_pruefen(text)
        db, tenant_id, _row, access = self._load_thread_scoped(ctx, thread_id)
        # Geplant = später ausgehende Nachricht → gleiche Reply-Berechtigung.
        if not access.can_reply:
            raise InboxError("Keine Berechtigung zum Senden.", status_code=403)
        ins = (
            db.table("inbox_scheduled_message")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "body": text,
                    "send_at": send_at,
                    "status": "pending",
                }
            )
            .execute()
        ).data
        s = ins[0] if ins else {}
        # Sekundengenauen Timer sofort setzen (kein Warten auf Cron-Tick).
        from . import scheduler
        if s.get("id"):
            scheduler.schedule(s["id"], s.get("send_at") or send_at)
        return ScheduledMessage(
            id=s.get("id"), thread_id=thread_id, body=text,
            send_at=s.get("send_at") or send_at, status=s.get("status") or "pending",
        )

    def list_scheduled(self, ctx: AuthContext, thread_id: str) -> ScheduledMessageList:
        """Anstehende geplante Nachrichten einer Konversation."""
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        res = (
            db.table("inbox_scheduled_message")
            .select("id, thread_id, body, send_at, status")
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .eq("status", "pending")
            .order("send_at")
            .execute()
        )
        items = [
            ScheduledMessage(
                id=s["id"], thread_id=s["thread_id"], body=s.get("body") or "",
                send_at=s.get("send_at"), status=s.get("status") or "pending",
            )
            for s in (res.data or [])
        ]
        return ScheduledMessageList(items=items, total=len(items))

    def cancel_scheduled(self, ctx: AuthContext, scheduled_id: str) -> None:
        db, tenant_id = self._require(ctx)
        # Zugehörige geplante Nachricht laden, um ihren Thread zu ermitteln — und
        # den Thread-Scope (assigned-only) durchsetzen. Ohne diese Prüfung könnte
        # ein Nutzer ohne INBOX_VIEW_ALL eine geplante Nachricht in einem fremd
        # zugewiesenen Thread stornieren, den er selbst gar nicht sehen darf
        # (list_scheduled erzwingt den Scope korrekt, cancel_scheduled bislang nicht).
        row = (
            db.table("inbox_scheduled_message")
            .select("id, thread_id")
            .eq("tenant_id", tenant_id)
            .eq("id", scheduled_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise InboxError("Geplante Nachricht nicht gefunden.", status_code=404)
        # Wirft 404, wenn der Nutzer den Thread laut Scope nicht sehen darf.
        self._load_thread_scoped(ctx, row[0]["thread_id"])
        db.table("inbox_scheduled_message").update({"status": "cancelled"}).eq(
            "tenant_id", tenant_id
        ).eq("id", scheduled_id).eq("status", "pending").execute()
        # Laufenden Timer stoppen.
        from . import scheduler
        scheduler.cancel(scheduled_id)

    # --- Massenaktualisierung ----------------------------------------------
    def bulk_update(
        self, ctx: AuthContext, action: str, before: str
    ) -> BulkUpdateResult:
        """Threads mit letzter Aktivität ≤ `before` als gelesen/archiviert."""
        db, tenant_id = self._require(ctx)
        access = self.access(ctx)
        if action == "read":
            patch = {"is_read": True}
        elif action == "archived":
            patch = {"is_archived": True, "inbox_status": "archived"}
        else:
            raise InboxError("Unbekannte Aktion.", status_code=422)
        if not (before or "").strip():
            raise InboxError("Datum fehlt.", status_code=422)
        # `before` ist ein Tag (YYYY-MM-DD) → einschließlich des ganzen Tages.
        upper = f"{before[:10]}T23:59:59Z"
        query = (
            db.table("channex_booking")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .lte("updated_at", upper)
        )
        # Scope: assigned-only-Nutzer dürfen nur ihre eigenen Threads massen-ändern.
        if access.scope == "assigned":
            query = query.eq("assigned_user_id", ctx.user_id)
        rows = query.execute().data or []
        return BulkUpdateResult(updated=len(rows))

    # --- Interner Cron: fällige geplante Nachrichten versenden -------------
    def dispatch_due_scheduled(self) -> dict:
        """Über ALLE Tenants: fällige (send_at ≤ jetzt) pending-Nachrichten
        versenden. Kein JWT — via internem Cron-Endpoint aufgerufen."""

        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        db = self._db
        now = datetime.now(UTC).isoformat()
        # Verwaiste 'sending'-Zeilen (Prozess starb nach Claim, vor 'sent'/'failed')
        # wieder freigeben, damit sie in diesem Tick als fällig neu versendet werden
        # und nicht für immer verloren bleiben. Frist deutlich über realer
        # Versanddauer, damit ein aktiver Versand nicht doppelt läuft (updated_at
        # per DB-Trigger beim Claim gesetzt).
        from . import scheduler  # noqa: PLC0415 — Zirkularität (scheduler↔service)

        reap_cutoff = (
            datetime.now(UTC)
            - timedelta(minutes=scheduler.SENDING_REAP_MINUTES)
        ).isoformat()
        reaped = (
            db.table("inbox_scheduled_message")
            .update({"status": "pending"})
            .eq("status", "sending")
            .lt("updated_at", reap_cutoff)
            .execute()
        ).data or []
        if reaped:
            log.warning("dispatch_reaped_stuck_sending", count=len(reaped))
        due = (
            db.table("inbox_scheduled_message")
            .select("id, tenant_id, thread_id, body")
            .eq("status", "pending")
            .lte("send_at", now)
            .limit(200)
            .execute()
        ).data or []
        sent = 0
        failed = 0
        for s in due:
            # ATOMARES CLAIM: der In-App-Timer (scheduler._send_now) verarbeitet
            # dieselben pending-Zeilen. Nur wer die Zeile per UPDATE ...
            # WHERE status='pending' auf 'sending' flippt, darf senden — sonst
            # Doppelversand. Leere Rückgabe = anderer Pfad war schneller.
            claimed = (
                db.table("inbox_scheduled_message")
                .update({"status": "sending"})
                .eq("id", s["id"])
                .eq("status", "pending")
                .execute()
            ).data
            if not claimed:
                continue
            try:
                ctx = AuthContext(user_id="cron", tenant_id=s["tenant_id"])
                self.send_message(ctx, s["thread_id"], s["body"], enforce_reply=False)
                db.table("inbox_scheduled_message").update(
                    {"status": "sent"}
                ).eq("id", s["id"]).execute()
                sent += 1
            except Exception as exc:  # noqa: BLE001 — Cron darf nicht abbrechen
                # Transiente Störung → zurück auf 'pending' (s. _fehlerzustand).
                db.table("inbox_scheduled_message").update(
                    self._fehlerzustand(exc)
                ).eq("id", s["id"]).execute()
                failed += 1
        return {"sent": sent, "failed": failed, "considered": len(due)}

    # -- Automail-Planung (Trigger-Engine) -------------------------------------
    #
    # Bei jeder importierten/aktualisierten OTA-Buchung (channex_booking = Thread)
    # werden die fälligen Automails geplant: für jede aktive Automation prüfen, ob
    # Objekt UND Kanal passen (leere Zuweisung = alle), das send_at aus anchor +
    # offset_days @ send_time berechnen und EINE Zeile je (Automation, Thread) in
    # automation_scheduled_message anlegen (Dedup-Constraint verhindert Doppel-
    # versand). Der Cron (dispatch_due_automations) versendet später die fälligen.

    @staticmethod
    def _automation_body(db: Client, tenant_id: str, automation: dict) -> str | None:
        """Text der Automail: Inline-message, sonst Vorlage (template_id).

        Die Vorlage wird explizit nach tenant_id gefiltert — der Service-Role-Key
        umgeht RLS, sonst ließe sich über eine manipulierte template_id die Vorlage
        eines fremden Tenants laden."""
        msg = (automation.get("message") or "").strip()
        if msg:
            return msg
        tid = automation.get("template_id")
        if not tid:
            return None
        tpl = (
            db.table("message_template")
            .select("body")
            .eq("id", tid)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        body = (tpl[0].get("body") if tpl else "") or ""
        return body.strip() or None

    @staticmethod
    def _ankerzeit(
        anchor: str, thread: dict
    ) -> tuple[str, str | None, datetime | None] | None:
        """(Ankerdatum „YYYY-MM-DD", Ankeruhrzeit „HH:MM"|None, Zeitpunkt|None).

        An- und Abreise sind in `channex_booking` reine DATEN ohne Uhrzeit
        (live geprüft: `arrival_date`/`departure_date` sind `date`). Nur die
        Buchung trägt einen echten Zeitpunkt. Das entscheidet, was ein Versatz
        in Stunden/Minuten überhaupt bedeuten kann — s. `_compute_send_at`.

        Der dritte Rückgabewert ist dieser ECHTE Zeitpunkt (zonebehaftet), sofern
        die Quelle einen liefert. Er darf nicht in Datum + Wanduhrzeit zerlegt
        werden: `booked_at` steht in UTC, und wer nur „22:30" davon behält und
        diese Ziffern anschließend mit der Objekt-Zeitzone kombiniert, verschiebt
        den Zeitpunkt um den UTC-Offset des Objekts. Live-Rechnung: `booked_at`
        22:30 UTC + „30 Minuten nach Buchung" ergab so 21:00 UTC — 90 Minuten
        VOR der Buchung, also sofort fällig (Wurzel 5b: fremder Zeitpunkt bleibt
        der fremde Zeitpunkt).

        Für den Anker „Buchung" ist das `booked_at` — der Zeitpunkt beim Portal
        (0291/0292). NICHT `created_at`: das ist unsere Verarbeitung (Wurzel 5b).
        Der Unterschied war live sichtbar: 30 Buchungen aus Februar bis Juni
        wurden am 06.08. in einem Rutsch importiert und trugen dieselbe
        `created_at` — „5 Minuten nach Buchung" hätte sie alle zur selben Minute
        an längst abgereiste Gäste geschickt. Fehlt `booked_at`, wird nicht
        geplant (kein Ausweichen auf die eigene Uhr).
        """
        if anchor == "arrival":
            basis = thread.get("arrival_date")
        elif anchor == "departure":
            basis = thread.get("departure_date")
        else:  # booking
            basis = thread.get("booked_at")
        if not basis:
            return None
        text = str(basis)
        # „2026-08-07T14:20:20+00:00" → Datum und Uhrzeit; „2026-08-07" → nur Datum.
        if len(text) > 10 and text[10] in ("T", " "):
            zeitpunkt: datetime | None = None
            try:
                geparst = datetime.fromisoformat(text)
            except ValueError:
                geparst = None
            if geparst is not None:
                # Ohne Offset in der Quelle ist der Wert nach unserer Konvention
                # UTC (timestamptz liefert ihn so aus). Raten wäre ein erfundener
                # Wert (Wurzel 4) — UTC ist hier die dokumentierte Zusage.
                zeitpunkt = (
                    geparst if geparst.tzinfo else geparst.replace(tzinfo=UTC)
                )
            return text[:10], text[11:16], zeitpunkt
        return text[:10], None, None

    @staticmethod
    def _compute_send_at(
        anchor: str, offset_days: int, send_time: object, thread: dict,
        *, timezone_name: str | None = None,
        offset_unit: str = "days", offset_value: int | None = None,
    ) -> datetime | None:
        """send_at = Ankerzeitpunkt + Versatz. None, wenn der Anker fehlt
        (z. B. booking ohne created_at) → Automail wird übersprungen.

        Der Versatz kommt in `offset_unit`/`offset_value` (minutes|hours|days).
        Fehlt `offset_value`, gilt `offset_days` — so rechnen Altbestand und
        Tages-Regeln unverändert weiter.

        **Tage** verhalten sich wie bisher: Ankerdatum ± n Tage, dazu die
        eingestellte Uhrzeit. Ohne Uhrzeit Mitternacht des Ankertags.

        **Stunden/Minuten** rechnen vom Ankerzeitpunkt selbst — und der ist bei
        An-/Abreise nur ein Datum, weil die Portale keine Uhrzeit dazu liefern
        (`arrival_date` ist eine `date`-Spalte). Als Bezug dient dann die
        eingestellte Uhrzeit; fehlt auch die, Mitternacht. Sonst wäre „2 Stunden
        vor Anreise" eine Zeit, die wir gar nicht kennen — geraten würde daraus
        eine Nachricht, die Stunden daneben liegt (Wurzel 4).

        `timezone_name` = IANA-Zone des Objekts; ohne Angabe wird die Uhrzeit als
        UTC gelesen. Für ein Objekt in Athen ging eine auf 10:00 gestellte
        Nachricht sonst um 13:00 Ortszeit raus.

        Liefert die Quelle einen ECHTEN Zeitpunkt (nur `booked_at`), rechnen
        Stunden/Minuten von ihm aus — nicht von `send_time`. „30 Minuten nach
        Buchung um 10:00" ist in sich widersprüchlich; gewinnt dort die Uhrzeit,
        entsteht ein Versand Stunden VOR der Buchung. Bei Tages-Regeln bleibt
        `send_time` maßgeblich: dort ist die Uhrzeit die Aussage."""
        from datetime import date, time

        geloest = PlanungMixin._ankerzeit(anchor, thread)
        if geloest is None:
            return None
        datum_text, anker_uhrzeit, anker_zeitpunkt = geloest
        try:
            d = date.fromisoformat(datum_text)
        except ValueError:
            return None

        betrag = offset_days if offset_value is None else offset_value
        zone = _zeitzone(timezone_name) if timezone_name else UTC

        if offset_unit in ("minutes", "hours") and anker_zeitpunkt is not None:
            # Echter Zeitpunkt + echte Dauer. Bewusst NICHT über die lokale
            # Wanduhr: `timedelta` auf einem zonebehafteten datetime rechnet die
            # Wanduhr weiter und bestimmt den Offset am Ergebnis neu — über eine
            # DST-Umstellung hinweg wären „6 Stunden" dann real 5 oder 7.
            schritt = (
                timedelta(minutes=betrag)
                if offset_unit == "minutes"
                else timedelta(hours=betrag)
            )
            return (anker_zeitpunkt + schritt).astimezone(UTC)

        # send_time aus DB ist "HH:MM[:SS]"; ohne Angabe Mitternacht.
        quelle = send_time or (anker_uhrzeit if offset_unit != "days" else None)
        gelesen = PlanungMixin._uhrzeit(quelle)
        if gelesen is None:
            # Unbrauchbare Uhrzeit (etwa das von Postgres akzeptierte '24:00'):
            # nicht planen statt den ganzen Lauf mit einem ValueError abzubrechen.
            # Vorher riss EINE solche Regel die komplette Neuplanung des Betriebs
            # mit — alle Automails blieben still stehen (Wurzel 5).
            log.warning("automail_ungueltige_uhrzeit", uhrzeit=str(quelle)[:16])
            return None
        hh, mm = gelesen

        lokal = datetime.combine(d, time(hh, mm), tzinfo=zone)
        if offset_unit == "minutes":
            lokal += timedelta(minutes=betrag)
        elif offset_unit == "hours":
            lokal += timedelta(hours=betrag)
        else:
            lokal += timedelta(days=betrag)
        # In UTC umrechnen: die Spalte send_at ist timestamptz, und der Scheduler
        # vergleicht gegen datetime.now(UTC).
        return lokal.astimezone(UTC)

    @staticmethod
    def _uhrzeit(quelle: object) -> tuple[int, int] | None:
        """„HH:MM[:SS]" → (Stunde, Minute). None, wenn unbrauchbar.

        Postgres nimmt '24:00' als gültigen `time`-Wert an, Python nicht
        (`hour must be in 0..23`). Ohne diese Prüfung riss ein einziger solcher
        Wert die Planung des gesamten Betriebs ab."""
        if not quelle:
            return 0, 0
        teile = str(quelle).split(":")
        try:
            hh = int(teile[0])
            mm = int(teile[1]) if len(teile) > 1 else 0
        except ValueError:
            return None
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            return None
        return hh, mm

    @staticmethod
    def _im_zeitfenster(automation: dict, jetzt: datetime) -> bool:
        """Darf dieser Auslöser zu diesem Zeitpunkt feuern?

        `window_days` (0=Mo…6=So) und `window_from`/`window_to` grenzen ein, WANN
        die Automation überhaupt greift — für eine Abwesenheitsantwort trägt man
        dort die geschlossenen Zeiten ein. Ein Fenster, dessen Ende vor seinem
        Anfang liegt (22:00–06:00), läuft über Mitternacht; dann gilt die
        Vereinigung beider Teilstücke, nicht ihr (leerer) Schnitt.

        Bezugszeit ist `jetzt` — der Aufrufer entscheidet, ob das UTC oder die
        Ortszeit des Objekts ist. Ein Fenster „nachts" wäre in UTC gerechnet für
        halb Europa das falsche.
        """
        tage = automation.get("window_days")
        if tage and jetzt.weekday() not in {int(t) for t in tage}:
            return False
        von, bis = automation.get("window_from"), automation.get("window_to")
        if not (von and bis):
            return True
        start, ende = str(von)[:5], str(bis)[:5]
        aktuell = jetzt.strftime("%H:%M")
        if start <= ende:
            return start <= aktuell < ende
        return aktuell >= start or aktuell < ende

    @staticmethod
    def _automation_matches(
        automation: dict, property_id: str | None, ota_name: str | None
    ) -> bool:
        """Zuweisung prüfen: Objekt UND Kanal müssen passen (UND-verknüpft).
        Leere/NULL-Zuweisung = alle (kein Filter)."""
        props = automation.get("property_ids") or []
        if props and (property_id is None or str(property_id) not in {str(p) for p in props}):
            return False
        chans = automation.get("channels") or []
        if chans:
            name = PlanungMixin._kanal_schluessel(ota_name)
            if not name:
                return False
            # Rechtsformen und Zusätze hängen HINTEN an („Booking.com B.V.",
            # „Expedia Group"). Deshalb Präfix statt Gleichheit — dieselbe
            # Toleranz, die der Buchungs-Import längst anwendet
            # (`bookings_sync._ota_name_to_channel`). Der Vergleich läuft in
            # DIESE Richtung: der gespeicherte Kanal ist der Portalname, der
            # Wert der Buchung darf ihn erweitern, nicht umgekehrt — sonst
            # träfe die Regel „Booking" auch ein „Bookingxyz".
            if not any(
                name.startswith(gewaehlt)
                for gewaehlt in (
                    PlanungMixin._kanal_schluessel(c) for c in chans
                )
                if gewaehlt
            ):
                return False
        return True

    @staticmethod
    def _kanal_schluessel(name: object) -> str:
        """Kanalname → Vergleichsschlüssel (nur Buchstaben und Ziffern).

        Die Oberfläche speichert die SCHREIBWEISE der Marke („Booking.com"), die
        Buchung trägt die des Aggregators („BookingCom") — case-insensitive
        allein trennt die beiden nicht, weil sie sich im PUNKT unterscheiden.
        Live-Folge: alle sechs Booking.com-Buchungen des Betriebs fielen durch
        jeden Kanalfilter, ihre Gäste bekamen keine einzige Automail, während
        dieselbe Regel für Airbnb lief („AirBNB" vs. „Airbnb" ist reine
        Groß-/Kleinschreibung und passte zufällig).
        """
        return re.sub(r"[^a-z0-9]", "", str(name or "").strip().lower())

    def _thread_und_objekt(
        self, db: Client, tenant_id: str, thread_id: str
    ) -> tuple[dict, str | None, str | None] | None:
        """(Thread-Zeile, property_id, Zeitzone des Objekts) — die drei Angaben,
        die jede Automations-Planung braucht. None, wenn es den Thread nicht gibt."""
        thread = (
            db.table("channex_booking")
            .select(THREAD_COLS)
            .eq("id", thread_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not thread:
            return None
        th = thread[0]
        property_id, zeitzone = self._objekt_zum_thread(db, tenant_id, th)
        return th, property_id, zeitzone

    @staticmethod
    def _objekt_zum_thread(
        db: Client, tenant_id: str, th: dict
    ) -> tuple[str | None, str | None]:
        """(property_id, Zeitzone) zu einer Thread-Zeile.

        Beide Zugriffe sind auf den Mandanten gescopt. Der Service-Role-Key
        umgeht RLS, deshalb ist ein Load allein per ID hier eine offene
        Mandantengrenze (Wurzel 3) — zeigte `property_map_id` je auf die Map
        eines fremden Betriebs, zöge die Planung dessen Zeitzone und vergliche
        die Objekt-Zuweisung gegen ein fremdes Objekt. Die gleichwertigen Helfer
        in `service.py` scopen bereits so."""
        # Direkter Weg zuerst (0317): der Thread trägt sein Objekt selbst. Für
        # Marktplatz-Buchungen (myBestDays) ist das der EINZIGE Weg — sie haben
        # kein Channex-Mapping und blieben sonst ohne Objekt, womit jede
        # objektgebundene Regel an ihnen vorbeilief.
        property_id = th.get("property_id")
        zeitzone = None
        if not property_id and th.get("property_map_id"):
            # `deleted_at` wird hier BEWUSST nicht gefiltert (anders als in den
            # Schreibpfaden): gesucht ist nicht „ist die Zuordnung aktiv", sondern
            # „zu welchem Objekt gehört diese bereits bestehende Buchung". Eine
            # aufgelöste Kanal-Zuordnung ändert daran nichts — der Gast hat sein
            # Haus, und seine Anreise-Info soll er bekommen. Würde hier gefiltert,
            # verlöre jede laufende Buchung beim Trennen eines Kanals schlagartig
            # ihr Objekt und damit alle objektgebundenen Regeln.
            pm = (
                db.table("channex_property_map")
                .select("property_id")
                .eq("id", th["property_map_id"])
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            property_id = pm[0]["property_id"] if pm else None
        if property_id:
            prop = (
                db.table("properties")
                .select("timezone")
                .eq("id", str(property_id))
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            zeitzone = prop[0].get("timezone") if prop else None
        return property_id, zeitzone

    def _automations(self, db: Client, tenant_id: str, trigger: str) -> list[dict]:
        return (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .eq("trigger", trigger)
            .execute()
        ).data or []

    @staticmethod
    def _einplanen(
        db: Client, tenant_id: str, automation: dict, thread_id: str,
        body: str, send_at: datetime, *, status: str = "pending",
    ) -> None:
        """Eine geplante Automail je (Automation, Thread) schreiben ODER
        aktualisieren — aber NIE eine, die schon raus ist.

        Kein blindes Upsert: eine Neuplanung darf einen bereits versendeten
        Eintrag nicht auf 'pending' zurücksetzen, sonst ginge dieselbe Nachricht
        ein zweites Mal an denselben Gast (Wurzel 2). Deshalb erst der Versuch,
        eine noch offene Zeile zu aktualisieren; erst wenn es keine gibt, wird
        eingefügt. Läuft parallel eine zweite Planung, fängt der Unique-Index
        (automation_scheduled_unique) den Einfüge-Versuch ab — der Konflikt ist
        dann die richtige Antwort und kein Fehler.
        """
        getroffen = (
            db.table("automation_scheduled_message")
            .update(
                {
                    "body": body,
                    "send_at": send_at.isoformat(),
                    "status": status,
                    "last_error": None,
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("automation_id", automation["id"])
            .eq("thread_id", thread_id)
            .in_("status", list(UEBERSCHREIBBAR))
            .execute()
        ).data
        if getroffen:
            return
        try:
            db.table("automation_scheduled_message").insert(
                {
                    "tenant_id": tenant_id,
                    "automation_id": automation["id"],
                    "thread_id": thread_id,
                    "body": body,
                    "send_at": send_at.isoformat(),
                    "status": status,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — nur der Dublettenfall ist ok
            if "23505" not in str(exc):
                raise
            # Es gibt bereits eine Zeile in einem unantastbaren Zustand
            # (sent/sending/failed). Genau so soll es sein.

    @staticmethod
    def _versandstatus(send_at: datetime, jetzt: datetime) -> str:
        """'pending' (geht raus) oder 'skipped' (Nachzügler, geht nicht mehr raus).

        Ein Versandzeitpunkt, der über `NACHZUEGLER_STUNDEN` zurückliegt, ist als
        Zeitpunkt nicht mehr einzuhalten. Ohne diese Grenze wird jeder Import
        bestehender Buchungen zur Nachrichtenlawine: Hunderte Zeilen mit
        Ankerdatum in der Vergangenheit sind sofort „fällig" und gehen im
        nächsten Versand-Tick gebündelt an längst abgereiste Gäste."""
        return (
            "pending"
            if send_at >= jetzt - timedelta(hours=NACHZUEGLER_STUNDEN)
            else "skipped"
        )

    @staticmethod
    def _stilllegen(
        db: Client, tenant_id: str, automation: dict, thread_id: str
    ) -> None:
        """Anstehende Zeile auf 'skipped' setzen, solange nicht gerechnet werden kann.

        Der Mittelweg zwischen den beiden falschen Antworten. Stornieren wäre
        endgültig — die Regel gilt ja weiter, sie ist nur gerade nicht
        berechenbar (Objekt ohne Zeitzone, Vorlage geleert, Anker fehlt).
        Unberührt stehen lassen ist aber genauso falsch: die Zeile trägt den
        ALTEN Zeitpunkt und den ALTEN Text, und der Versand kennt nur die Zeile,
        nicht die Regel — nach einer Umbuchung ginge „Ihre Anreise ist morgen"
        zum längst überholten Termin raus, und eine bewusst geleerte Vorlage
        verschickte weiter ihren eingefrorenen Text.

        'skipped' hält beides offen: der Versand fasst nur 'pending' an, und
        'skipped' ist überschreibbar — sobald die Zeitzone nachgetragen oder die
        Vorlage wieder gefüllt ist, hebt die nächste Planung die Zeile zurück
        auf 'pending' mit frischen Werten.
        """
        db.table("automation_scheduled_message").update({"status": "skipped"}).eq(
            "tenant_id", tenant_id
        ).eq("automation_id", automation["id"]).eq("thread_id", thread_id).eq(
            "status", "pending"
        ).execute()

    def _plan_thread(
        self, db: Client, tenant_id: str, th: dict, property_id: str | None,
        zeitzone: str | None, automations: list[dict], jetzt: datetime,
    ) -> set[str]:
        """Alle passenden Automails EINES Threads planen.

        Gibt die IDs der Automatisierungen zurück, die für diesen Thread eine
        Zeile bekommen haben ODER deren Berechnung nur vorübergehend scheiterte —
        der Aufrufer braucht sie für den Alt/Neu-Abgleich (Wurzel 1). Der
        Unterschied ist wesentlich: „passt nicht mehr" (Objekt/Kanal/Status)
        MUSS die anstehende Zeile zurücknehmen, „konnte gerade nicht rechnen"
        (Zeitzone fehlt, Vorlage leer, Anker fehlt) darf sie NICHT anfassen.
        Beides gleich zu behandeln löschte gültige, korrekt geplante Nachrichten:
        ein kurzzeitig fehlendes Mapping (Kanal neu verbunden) nahm so sämtliche
        Automails der Buchung zurück, und was in der Lücke fällig gewesen wäre,
        war endgültig weg.
        """
        thread_id = str(th["id"])
        # Eine stornierte Buchung bekommt keine Post mehr. Ohne diese Zeile ging
        # die Anreise-Info an einen Gast, der abgesagt hat.
        if (th.get("status") or "") == "cancelled":
            return set()
        geplant: set[str] = set()
        for a in automations:
            if not self._automation_matches(a, property_id, th.get("ota_name")):
                continue
            if a.get("use_property_timezone") and not zeitzone:
                # Lieber nicht planen als in der falschen Zeitzone: der Betrieb
                # hat Ortszeit AUSDRÜCKLICH verlangt, still auf UTC auszuweichen
                # wäre ein erfundener Wert (Wurzel 4).
                log.warning(
                    "automation_ohne_objekt_zeitzone",
                    tenant_id=tenant_id,
                    automation_id=a["id"],
                    property_id=str(property_id) if property_id else None,
                )
                self._stilllegen(db, tenant_id, a, thread_id)
                geplant.add(str(a["id"]))
                continue
            body = self._automation_body(db, tenant_id, a)
            if not body:
                # Vorlage geleert/gelöscht: Text fehlt, die Zuweisung gilt weiter.
                log.warning(
                    "automation_ohne_text",
                    tenant_id=tenant_id,
                    automation_id=a["id"],
                )
                self._stilllegen(db, tenant_id, a, thread_id)
                geplant.add(str(a["id"]))
                continue
            # Anker UND Vorzeichen aus dem Auslöser ableiten, nicht aus den
            # gespeicherten Spalten lesen. Eine Zeile, die nie durch
            # `automation_payload` lief (Altbestand, Migration, direkter
            # DB-Schreibzugriff), trägt sonst ein Vorzeichen, das ihrem Auslöser
            # widerspricht — und feuert dauerhaft auf der falschen Seite des
            # Ankers, ohne dass es auffällt. Live passiert (07.08.2026):
            # „Check-out-Anweisungen" (before_checkout) stand mit offset_value=+1
            # in der DB und ging deshalb einen Tag NACH der Abreise raus, an
            # Gäste, die längst weg waren. Dieselbe Ableitung wie beim Speichern
            # (`ausloeser.py`) — nur so kann DB-Inhalt die Richtung nicht kippen.
            trigger = a.get("trigger") or ""
            betrag = a.get("offset_value")
            if betrag is None:
                betrag = a.get("offset_days") or 0
            versatz = versatz_normieren(trigger, betrag) if trigger else betrag
            send_at = self._compute_send_at(
                anker_von(trigger) if trigger else (a.get("anchor") or "arrival"),
                versatz,
                a.get("send_time"),
                th,
                timezone_name=zeitzone if a.get("use_property_timezone") else None,
                offset_unit=a.get("offset_unit") or "days",
                offset_value=versatz,
            )
            if send_at is None:
                # Anker fehlt (Buchung ohne booked_at) oder die Uhrzeit ist
                # unbrauchbar — ein Datenproblem, keine Aussage über die
                # Zuweisung.
                self._stilllegen(db, tenant_id, a, thread_id)
                geplant.add(str(a["id"]))
                continue
            self._einplanen(
                db, tenant_id, a, thread_id, body, send_at,
                status=self._versandstatus(send_at, jetzt),
            )
            geplant.add(str(a["id"]))
        return geplant

    def schedule_automations_for_thread(self, tenant_id: str, thread_id: str) -> int:
        """Datumsgebundene Automails für EINEN Thread planen — der Weg beim
        Import/Update einer Buchung. Gibt die Anzahl geplanter Automails zurück.

        Idempotent: eine bereits versendete Automail bleibt unangetastet, eine
        noch offene wird auf den aktuellen Zeitpunkt gehoben (die Daten der
        Buchung können sich geändert haben — Umbuchung).

        `message_received` ist hier bewusst NICHT dabei: dieser Auslöser hängt an
        keinem Datum der Reservierung, sondern am Eingang einer Nachricht — siehe
        `schedule_message_received`."""
        if self._db is None:
            return 0
        db = self._db
        geladen = self._thread_und_objekt(db, tenant_id, thread_id)
        if geladen is None:
            return 0
        th, property_id, zeitzone = geladen
        automations = self._datums_automations(db, tenant_id)
        if (th.get("status") or "") == "cancelled":
            # Wurzel 1: die Stornierung ist der Gegenzustand zur Buchung. Was
            # für sie eingeplant war, muss weg — sonst begrüßt die Automail
            # einen Gast, der abgesagt hat.
            self._offene_stornieren(db, tenant_id, thread_id)
            return 0
        geplant = self._plan_thread(
            db, tenant_id, th, property_id, zeitzone, automations,
            datetime.now(UTC),
        )
        self._offene_stornieren(
            db, tenant_id, thread_id,
            nur={str(a["id"]) for a in automations} - geplant,
        )
        return len(geplant)

    @staticmethod
    def _offene_stornieren(
        db: Client, tenant_id: str, thread_id: str,
        *, nur: set[str] | None = None,
    ) -> None:
        """Anstehende Automails dieses Threads zurücknehmen.

        `nur` grenzt auf bestimmte Automatisierungen ein (die, die nicht mehr
        passen); ohne Angabe trifft es alle — der Fall Stornierung. Nur
        'pending' wird angefasst: was raus ist, ist raus."""
        if nur is not None and not nur:
            return
        query = (
            db.table("automation_scheduled_message")
            .update({"status": "cancelled"})
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .eq("status", "pending")
        )
        if nur is not None:
            query = query.in_("automation_id", sorted(nur))
        query.execute()

    def _datums_automations(self, db: Client, tenant_id: str) -> list[dict]:
        """Alle AKTIVEN datumsgebundenen Regeln des Betriebs — in EINER Abfrage.

        Vorher lief je Auslöser eine eigene Abfrage; mit fünf Auslösern und einer
        Neuplanung über hunderte Buchungen wären das tausende Rundreisen."""
        return (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .in_("trigger", list(DATUMS_TRIGGER))
            .execute()
        ).data or []

    def replan_tenant(self, tenant_id: str) -> dict:
        """Alle datumsgebundenen Automails eines Betriebs neu berechnen.

        Der Ausgleich für eine Wahrheit, die sich ändern kann, nachdem geplant
        wurde: eine neue Regel, eine geänderte Uhrzeit, ein anderer Objekt- oder
        Kanal-Zuschnitt, eine pausierte Regel. Bis 0307 wurde ausschließlich beim
        Import einer Buchung geplant — eine danach angelegte Regel erreichte
        keine einzige bestehende Buchung, und eine geänderte Regel ließ die alten
        Zeitpunkte stehen (beides live vorgefunden).

        Beide Richtungen (Wurzel 1): was jetzt gilt, wird eingeplant; was nicht
        mehr gilt, wird storniert. Unangetastet bleibt, was bereits raus ist.
        """
        if self._db is None:
            return {"threads": 0, "geplant": 0, "storniert": 0}
        db = self._db
        automations = self._datums_automations(db, tenant_id)
        jetzt = datetime.now(UTC)
        # Rückblick, damit „nach der Abreise" noch greift; alles Ältere könnte
        # nur noch Nachzügler erzeugen.
        ab = (jetzt.date() - timedelta(days=NEUPLANUNG_RUECKBLICK_TAGE)).isoformat()
        threads = (
            db.table("channex_booking")
            .select(THREAD_COLS)
            .eq("tenant_id", tenant_id)
            .gte("departure_date", ab)
            .order("departure_date")
            .limit(NEUPLANUNG_MAX_THREADS)
            .execute()
        ).data or []
        if len(threads) >= NEUPLANUNG_MAX_THREADS:
            log.warning(
                "automail_neuplanung_gekappt",
                tenant_id=tenant_id,
                limit=NEUPLANUNG_MAX_THREADS,
            )
        alle_ids = {str(a["id"]) for a in automations}
        geplant_gesamt = 0
        fehler = 0
        for th in threads:
            # Je Thread abgesichert: ohne diesen Rahmen riss EINE unbrauchbare
            # Zeile die gesamte Neuplanung des Betriebs ab — samt der danach
            # folgenden Gegenzustands-Pflege (Wurzel 1), sodass eine pausierte
            # Regel unbegrenzt weitergelaufen wäre. Der Zähler kommt ins
            # Ergebnis, damit ein dauerhaft kippender Thread sichtbar ist und
            # nicht nur als Log-Zeile verschwindet.
            try:
                property_id, zeitzone = self._objekt_zum_thread(db, tenant_id, th)
                geplant = self._plan_thread(
                    db, tenant_id, th, property_id, zeitzone, automations, jetzt
                )
            except Exception as exc:  # noqa: BLE001 — ein Thread kippt nicht alle
                fehler += 1
                log.warning(
                    "automail_thread_planung_fehlgeschlagen",
                    tenant_id=tenant_id,
                    thread_id=str(th.get("id")),
                    error=str(exc)[:200],
                )
                continue
            geplant_gesamt += len(geplant)
            self._offene_stornieren(
                db, tenant_id, str(th["id"]), nur=alle_ids - geplant
            )
        # Pausierte oder auf „Nachricht empfangen" umgestellte Regeln: ihre
        # bereits eingeplanten Nachrichten sind der Gegenzustand (Wurzel 1). Ohne
        # diesen Schritt liefe eine deaktivierte Regel noch wochenlang weiter,
        # weil der Versand nur die geplante Zeile kennt, nicht die Regel.
        storniert = 0
        # NUR datumsgebundene Regeln vergleichen. `alle_ids` enthält die aktiven
        # Datums-Regeln; ohne den `in_`-Filter fiele jede AKTIVE
        # `message_received`-Regel in „stillgelegt" (sie ist nie ein
        # DATUMS_TRIGGER) und ihre gerade eingeplante Abwesenheitsantwort würde
        # storniert. Die wird mit `send_at = jetzt` geplant und soll im nächsten
        # Minuten-Tick raus — eine Neuplanung dazwischen (stündlich, und bei
        # JEDEM Speichern einer Automation) löschte sie vorher weg, endgültig:
        # der Unique-Index lässt je Thread nur einen Versuch zu.
        stillgelegt = {
            str(r["id"])
            for r in (
                db.table("message_automation")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("trigger", list(DATUMS_TRIGGER))
                .execute()
            ).data or []
        } - alle_ids
        if stillgelegt:
            storniert += len(
                (
                    db.table("automation_scheduled_message")
                    .update({"status": "cancelled"})
                    .eq("tenant_id", tenant_id)
                    .eq("status", "pending")
                    .in_("automation_id", sorted(stillgelegt))
                    .execute()
                ).data or []
            )
        # Buchungen außerhalb des Rückblicks: was dort noch ansteht, ist über
        # einen Monat alt und käme nur noch verspätet.
        veraltet = (
            db.table("automation_scheduled_message")
            .update({"status": "cancelled"})
            .eq("tenant_id", tenant_id)
            .eq("status", "pending")
            .lt("send_at", (jetzt - timedelta(hours=NACHZUEGLER_STUNDEN)).isoformat())
            .execute()
        ).data or []
        return {
            "threads": len(threads),
            "geplant": geplant_gesamt,
            "storniert": storniert + len(veraltet),
            "fehler": fehler,
        }

    def replan_all_tenants(self) -> dict:
        """Neuplanung über ALLE Betriebe — der Worker-Tick.

        Fängt alles ab, was zwischen zwei Planungen passiert sein kann, ohne dass
        jemand die Regel angefasst hat: eine Buchung wurde umgebucht, storniert,
        oder ein Objekt hat seine Zeitzone bekommen."""
        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        rows = (
            self._db.table("message_automation")
            .select("tenant_id")
            .in_("trigger", list(DATUMS_TRIGGER))
            .execute()
        ).data or []
        tenants = sorted({str(r["tenant_id"]) for r in rows})
        gesamt = {
            "tenants": 0, "threads": 0, "geplant": 0, "storniert": 0,
            # Zwei getrennte Zähler: `fehler` sind einzelne Threads, die der
            # Betrieb sonst überlebt hat, `tenants_fehler` sind komplett
            # gescheiterte Betriebe. Beides muss im Ergebnis stehen — sonst ist
            # ein seit Wochen jede Stunde kippender Betrieb in keiner Metrik
            # sichtbar und nur über eine Log-Suche auffindbar.
            "fehler": 0, "tenants_fehler": 0,
        }
        for tenant_id in tenants:
            try:
                ergebnis = self.replan_tenant(tenant_id)
            except Exception as exc:  # noqa: BLE001 — ein Betrieb kippt nicht alle
                gesamt["tenants_fehler"] += 1
                log.warning(
                    "automail_neuplanung_fehlgeschlagen",
                    tenant_id=tenant_id,
                    error=str(exc)[:200],
                )
                continue
            gesamt["tenants"] += 1
            for schluessel in ("threads", "geplant", "storniert", "fehler"):
                gesamt[schluessel] += ergebnis[schluessel]
        return gesamt

    def zaehle_gastnachrichten_je_buchung(
        self, tenant_id: str, booking_ref: str
    ) -> int:
        """Wie viele Gastnachrichten liegen zu dieser Buchung bereits vor?

        Grundlage für „nur die erste Gastnachricht". Quelle ist seit 0305 der
        lokale Spiegel `portal_messages` statt eines Live-Abrufs beim
        Aggregator: der Spiegel wird bei JEDEM Eingang geschrieben (Webhook und
        Journal-Tick), ist also vollständig, und ein Zählen darf keinen
        Netzaufruf kosten — es passiert im Ingest-Pfad, den der Webhook mit 200
        quittieren muss.

        Gezählt wird über die BUCHUNGS-ID, nicht über unsere Thread-Zeile: der
        Eingangspfad kennt beim Eintreffen die Buchung, und er muss VOR dem
        Spiegeln zählen — sonst zählt er die gerade eingetroffene Nachricht mit
        und kein Thread wäre je „neu".

        Ist der Spiegel nicht lesbar, gilt die Nachricht als NICHT die erste:
        eine unterlassene Abwesenheitsantwort ist harmloser als eine, die einen
        laufenden Dialog mit „Wir melden uns bald" unterbricht.
        """
        if self._db is None:
            return 1
        try:
            res = (
                self._db.table("portal_messages")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("booking_ref", booking_ref)
                .eq("sender", "guest")
                .limit(1)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — s. Docstring: fail zur sicheren Seite
            log.warning("gastnachrichten_zaehlen_fehlgeschlagen", error=str(exc)[:200])
            return 1
        return int(res.count or 0)

    def schedule_message_received(
        self, tenant_id: str, thread_id: str, *, ist_erste_nachricht: bool
    ) -> int:
        """Abwesenheitsantworten auf eine eingegangene Gastnachricht planen.

        Versand sofort (send_at = jetzt): eine Abwesenheitsantwort, die eine
        Stunde später kommt, ist keine mehr. Das Zeitfenster entscheidet nur, OB
        gesendet wird — bewertet in der Ortszeit des Objekts, sofern hinterlegt,
        sonst UTC. Ohne Zeitzone ist ein Fenster wie „22:00–06:00" für ein Objekt
        in Athen um zwei Stunden verschoben; das steht als Hinweis am Objekt.

        Mehrfaches Feuern ist durch den Unique-Index (automation_id, thread_id)
        ausgeschlossen: eine Automation antwortet je Konversation genau einmal.
        """
        if self._db is None:
            return 0
        db = self._db
        geladen = self._thread_und_objekt(db, tenant_id, thread_id)
        if geladen is None:
            return 0
        th, property_id, zeitzone = geladen

        jetzt_utc = datetime.now(UTC)
        jetzt_lokal = (
            jetzt_utc.astimezone(_zeitzone(zeitzone)) if zeitzone else jetzt_utc
        )

        planned = 0
        for a in self._automations(db, tenant_id, "message_received"):
            if not self._automation_matches(a, property_id, th.get("ota_name")):
                continue
            if a.get("only_first_message") and not ist_erste_nachricht:
                continue
            if not self._im_zeitfenster(a, jetzt_lokal):
                continue
            body = self._automation_body(db, tenant_id, a)
            if not body:
                continue
            self._einplanen(db, tenant_id, a, thread_id, body, jetzt_utc)
            planned += 1
        if planned:
            log.info(
                "abwesenheitsantwort_geplant",
                tenant_id=tenant_id,
                thread_id=thread_id,
                anzahl=planned,
            )
        return planned

    def dispatch_due_automations(self) -> dict:
        """Über ALLE Tenants: fällige (send_at ≤ jetzt) pending Automails versenden.
        Kein JWT — via internem Cron-Endpoint. Versand über send_message (Channex)."""

        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        db = self._db
        now = datetime.now(UTC).isoformat()
        # Verwaiste 'sending'-Zeilen freigeben — dieselbe Pflicht wie bei den
        # manuell geplanten Nachrichten (s. `dispatch_due_scheduled`). Ohne sie
        # blockierte ein Worker-Abbruch zwischen Claim und Abschluss (Deploy,
        # OOM, Kill) das Paar (Automation, Thread) FÜR IMMER: 'sending' ist
        # nicht überschreibbar, der Neuplanungs-Insert prallt am Unique-Index ab,
        # und kein Pfad holt die Zeile zurück. Deploys sind Routine — das
        # sammelte sich still an.
        from . import scheduler  # noqa: PLC0415 — Zirkularität (scheduler↔service)

        reap_cutoff = (
            datetime.now(UTC) - timedelta(minutes=scheduler.SENDING_REAP_MINUTES)
        ).isoformat()
        reaped = (
            db.table("automation_scheduled_message")
            .update({"status": "pending"})
            .eq("status", "sending")
            .lt("updated_at", reap_cutoff)
            .execute()
        ).data or []
        if reaped:
            log.warning("automail_reaped_stuck_sending", count=len(reaped))
        due = (
            db.table("automation_scheduled_message")
            .select("id, tenant_id, thread_id, body, send_at")
            .eq("status", "pending")
            .lte("send_at", now)
            # Überfälligstes zuerst: ohne Sortierung ist die Auswahl bei einem
            # Rückstau über 200 Zeilen beliebig, und die älteste Nachricht kann
            # hinter neueren zurückstehen.
            .order("send_at")
            .limit(200)
            .execute()
        ).data or []
        sent = 0
        failed = 0
        for s in due:
            # Atomares Claim gegen überlappende Cron-Läufe (kein Doppelversand).
            # Zusätzlich an `send_at` gebunden: zwischen Auswahl und Claim kann
            # eine Neuplanung (Umbuchung) Text und Zeitpunkt geändert haben —
            # `status` bleibt dabei 'pending'. Ohne diese Bedingung ginge der
            # veraltete Text aus dem Snapshot sofort raus und die korrekt in die
            # Zukunft verschobene Nachricht NIE (die Zeile stünde auf 'sent').
            claimed = (
                db.table("automation_scheduled_message")
                .update({"status": "sending"})
                .eq("send_at", s["send_at"])
                .eq("id", s["id"])
                .eq("status", "pending")
                .execute()
            ).data
            if not claimed:
                continue
            try:
                ctx = AuthContext(user_id="cron", tenant_id=s["tenant_id"])
                self.send_message(ctx, s["thread_id"], s["body"], enforce_reply=False)
                db.table("automation_scheduled_message").update(
                    {"status": "sent"}
                ).eq("id", s["id"]).execute()
                sent += 1
            except Exception as exc:  # noqa: BLE001 — Cron darf nicht abbrechen
                db.table("automation_scheduled_message").update(
                    self._fehlerzustand(exc)
                ).eq("id", s["id"]).execute()
                failed += 1
        return {"sent": sent, "failed": failed, "considered": len(due)}

    @staticmethod
    def _fehlerzustand(exc: Exception) -> dict:
        """Fehler beim Versand → 'pending' (erneut versuchen) oder 'failed'.

        Ein Ratelimit, ein 5xx oder ein erschöpftes Channex-Budget ist eine
        Aussage über DIESEN Moment, nicht über die Nachricht. Pauschal 'failed'
        zu setzen war Endstation: der Versand liest nur 'pending', und die
        Neuplanung darf 'failed' nicht überschreiben — eine Channex-Störung von
        Minuten löschte damit still alle in dieser Zeit fälligen Automails
        (Wurzel 5: Kontroll-Signal nicht verschlucken).

        Endgültige Fehler bleiben 'failed': ein fehlender Feldwert (FeldFehlt)
        oder ein 4xx wird auch beim zehnten Versuch nicht besser, und ein
        endloser Neuversuch verdeckte den Grund."""
        from src.features.channel_manager.channex_client import (  # noqa: PLC0415
            ChannexBudgetExhausted,
            ChannexError,
        )

        transient = isinstance(exc, ChannexBudgetExhausted) or (
            isinstance(exc, ChannexError)
            and (exc.status_code == 429 or exc.status_code >= 500)
        )
        return {
            "status": "pending" if transient else "failed",
            "last_error": str(exc)[:500],
        }
