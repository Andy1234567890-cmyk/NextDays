"""Geplante Nachrichten und Nachrichten-Automatisierungen des Posteingangs.

Aus `service.py` herausgelöst: das Modul war auf über 1700 Zeilen gewachsen und
riss damit die pylint-Grenze (`too-many-lines`, 1500). Der Block hier ist in
sich geschlossen — planen, Fälligkeit berechnen, Zeitfenster prüfen, ausliefern.

Bewusst als **Mixin** statt als eigener Service: Methodennamen, Aufrufstellen
(Router, Cron, Tests) und `self`-Zugriffe bleiben unverändert. Das ist die
Vorgabe für gewachsene Services — aufteilen, aber die öffentliche Oberfläche
behalten (dieselbe Lehre wie beim channel_manager).
"""
from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .errors import InboxError
from .schemas import BulkUpdateResult, ScheduledMessage, ScheduledMessageList
from .zeit import zeitzone as _zeitzone

log = get_logger("nextdays.inbox")


class PlanungMixin:
    """Geplante Nachrichten + Automatisierungen. Teil von `InboxService`."""

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung die
    # Zugriffe kennt. pylint behandelt `*Mixin` gesondert (keine no-member-Flut).
    _db: Client | None
    _channex: Any
    _AUTOMATION_COLS: str

    # --- Geplante Nachrichten ----------------------------------------------
    def schedule_message(
        self, ctx: AuthContext, thread_id: str, body: str, send_at: str
    ) -> ScheduledMessage:
        text = (body or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        if not (send_at or "").strip():
            raise InboxError("Zeitpunkt fehlt.", status_code=422)
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
                db.table("inbox_scheduled_message").update(
                    {"status": "failed", "last_error": str(exc)[:500]}
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
    def _ankerzeit(anchor: str, thread: dict) -> tuple[str, str | None] | None:
        """(Ankerdatum „YYYY-MM-DD", Ankeruhrzeit „HH:MM" oder None).

        An- und Abreise sind in `channex_booking` reine DATEN ohne Uhrzeit
        (live geprüft: `arrival_date`/`departure_date` sind `date`). Nur die
        Buchung trägt einen echten Zeitpunkt (`created_at`). Das entscheidet,
        was ein Versatz in Stunden/Minuten überhaupt bedeuten kann — s.
        `_compute_send_at`.
        """
        if anchor == "arrival":
            basis = thread.get("arrival_date")
        elif anchor == "departure":
            basis = thread.get("departure_date")
        else:  # booking
            basis = thread.get("created_at")
        if not basis:
            return None
        text = str(basis)
        # „2026-08-07T14:20:20+00:00" → Datum und Uhrzeit; „2026-08-07" → nur Datum.
        if len(text) > 10 and text[10] in ("T", " "):
            return text[:10], text[11:16]
        return text[:10], None

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
        Nachricht sonst um 13:00 Ortszeit raus."""
        from datetime import date, time

        geloest = PlanungMixin._ankerzeit(anchor, thread)
        if geloest is None:
            return None
        datum_text, anker_uhrzeit = geloest
        try:
            d = date.fromisoformat(datum_text)
        except ValueError:
            return None

        betrag = offset_days if offset_value is None else offset_value
        # send_time aus DB ist "HH:MM[:SS]"; ohne Angabe Mitternacht.
        hh, mm = 0, 0
        quelle = send_time or (anker_uhrzeit if offset_unit != "days" else None)
        if quelle:
            teile = str(quelle).split(":")
            hh = int(teile[0])
            mm = int(teile[1]) if len(teile) > 1 else 0

        zone = _zeitzone(timezone_name) if timezone_name else UTC
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
            name = (ota_name or "").strip().lower()
            if name not in {str(c).strip().lower() for c in chans}:
                return False
        return True

    def _thread_und_objekt(
        self, db: Client, tenant_id: str, thread_id: str
    ) -> tuple[dict, str | None, str | None] | None:
        """(Thread-Zeile, property_id, Zeitzone des Objekts) — die drei Angaben,
        die jede Automations-Planung braucht. None, wenn es den Thread nicht gibt."""
        thread = (
            db.table("channex_booking")
            .select(
                "id, tenant_id, property_map_id, ota_name, arrival_date, "
                "departure_date, created_at"
            )
            .eq("id", thread_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not thread:
            return None
        th = thread[0]
        property_id = None
        zeitzone = None
        if th.get("property_map_id"):
            pm = (
                db.table("channex_property_map")
                .select("property_id")
                .eq("id", th["property_map_id"])
                .limit(1)
                .execute()
            ).data or []
            property_id = pm[0]["property_id"] if pm else None
        if property_id:
            prop = (
                db.table("properties")
                .select("timezone")
                .eq("id", str(property_id))
                .limit(1)
                .execute()
            ).data or []
            zeitzone = prop[0].get("timezone") if prop else None
        return th, property_id, zeitzone

    def _automations(self, db: Client, tenant_id: str, trigger: str) -> list[dict]:
        return (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .eq("trigger", trigger)
            .execute()
        ).data or []

    def _einplanen(
        self, db: Client, tenant_id: str, automation: dict, thread_id: str,
        body: str, send_at: datetime,
    ) -> None:
        """Upsert je (Automation, Thread) — der Unique-Index verhindert, dass
        derselbe Gast dieselbe Automail zweimal bekommt (Wurzel 2)."""
        db.table("automation_scheduled_message").upsert(
            {
                "tenant_id": tenant_id,
                "automation_id": automation["id"],
                "thread_id": thread_id,
                "body": body,
                "send_at": send_at.isoformat(),
            },
            on_conflict="automation_id,thread_id",
        ).execute()

    def schedule_automations_for_thread(self, tenant_id: str, thread_id: str) -> int:
        """Datumsgebundene Automails für einen Thread planen (booking_new,
        before_checkin, after_checkout). Gibt die Anzahl geplanter Automails
        zurück. Idempotent über den Unique-Index.

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

        planned = 0
        for trigger in ("booking_new", "before_checkin", "after_checkout"):
            for a in self._automations(db, tenant_id, trigger):
                if not self._automation_matches(a, property_id, th.get("ota_name")):
                    continue
                body = self._automation_body(db, tenant_id, a)
                if not body:
                    continue
                if a.get("use_property_timezone") and not zeitzone:
                    # Lieber nicht planen als in der falschen Zeitzone: der
                    # Betrieb hat Ortszeit AUSDRÜCKLICH verlangt, still auf UTC
                    # auszuweichen wäre ein erfundener Wert (Wurzel 4).
                    log.warning(
                        "automation_ohne_objekt_zeitzone",
                        tenant_id=tenant_id,
                        automation_id=a["id"],
                        property_id=str(property_id) if property_id else None,
                    )
                    continue
                send_at = self._compute_send_at(
                    a.get("anchor") or "arrival",
                    a.get("offset_days") or 0,
                    a.get("send_time"),
                    th,
                    timezone_name=zeitzone if a.get("use_property_timezone") else None,
                    offset_unit=a.get("offset_unit") or "days",
                    offset_value=a.get("offset_value"),
                )
                if send_at is None:
                    continue
                self._einplanen(db, tenant_id, a, thread_id, body, send_at)
                planned += 1
        return planned

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
        due = (
            db.table("automation_scheduled_message")
            .select("id, tenant_id, thread_id, body")
            .eq("status", "pending")
            .lte("send_at", now)
            .limit(200)
            .execute()
        ).data or []
        sent = 0
        failed = 0
        for s in due:
            # Atomares Claim gegen überlappende Cron-Läufe (kein Doppelversand).
            claimed = (
                db.table("automation_scheduled_message")
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
                db.table("automation_scheduled_message").update(
                    {"status": "sent"}
                ).eq("id", s["id"]).execute()
                sent += 1
            except Exception as exc:  # noqa: BLE001 — Cron darf nicht abbrechen
                db.table("automation_scheduled_message").update(
                    {"status": "failed", "last_error": str(exc)[:500]}
                ).eq("id", s["id"]).execute()
                failed += 1
        return {"sent": sent, "failed": failed, "considered": len(due)}
