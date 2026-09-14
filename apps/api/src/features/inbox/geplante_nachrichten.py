"""Von Hand geplante Nachrichten und die Massenaktion des Posteingangs.

Aus `planung.py` herausgelöst (09/2026, Datei-Längenlimit). Der Schnitt läuft
entlang der Zuständigkeit: `planung.py` führt die AUTOMATISIERUNGEN (Regel →
Zeitpunkt → geplante Automail), hier liegt, was ein MENSCH terminiert hat —
`inbox_scheduled_message` — plus die Massenaktion „alles vor diesem Tag als
gelesen/archiviert".

Die beiden Ströme sehen sich ähnlich und sind es nicht: eine von Hand geplante
Nachricht ist eine spätere Handnachricht (Spiegel-`quelle` bleibt `manuell`),
eine Automail ist die Ausführung einer Regel. Sie teilen sich nur das Muster
des atomaren Claims gegen Doppelversand (Wurzel 2).

Bewusst als **Mixin**: Methodennamen und Aufrufstellen (Router, Cron, Tests,
`scheduler.py`) bleiben unverändert.
"""
from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .errors import InboxError
from .schemas import BulkUpdateResult, ScheduledMessage, ScheduledMessageList

log = get_logger("nextdays.inbox")


class GeplanteNachrichtenMixin:
    """Handgeplante Nachrichten + Massenaktion. Teil von `InboxService`."""

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung die
    # Zugriffe kennt (wie in `PlanungMixin`).
    _db: Client | None
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
        """Threads mit letzter Aktivität ≤ `before` als gelesen/archiviert.

        „Letzte Aktivität" ist ein FREMDereignis (Wurzel 5b): die jüngste
        Nachricht beim Portal (`last_message_at`), sonst der Buchungszeitpunkt
        (`booked_at`) — genau die beiden Werte, aus denen `list_threads` die
        angezeigte Zeit baut. Gefiltert wurde hier vorher `updated_at`, also
        UNSERE Schreibzeit. Das war nicht nur die falsche Bedeutung, es machte
        die Funktion wirkungslos: der Journal-Tick schreibt `channex_booking`
        laufend, live standen deshalb alle neun offenen Threads auf
        `updated_at = heute` und „alles vor dem 01.08. als gelesen" traf keinen
        einzigen davon.

        Ein Thread ohne beide Zeitpunkte bleibt unberührt — ohne Aktivität gibt
        es kein „vor diesem Tag", und ein geratenes Datum wäre ein erfundener
        Wert (Wurzel 4).

        Gilt nur für die AKTIVE Ansicht: eine Massenaktion ist zum Aufräumen des
        Posteingangs da. Ohne diese Grenze hätte `archived` Threads aus dem
        Papierkorb ins Archiv zurückgeholt.
        """
        db, tenant_id = self._require(ctx)
        access = self.access(ctx)
        if action == "read":
            # `read_at` gehört ZWINGEND dazu (Wurzel 1): ohne den Zeitpunkt hat
            # der abgeleitete Lesestand keinen Vergleichswert, und der Thread
            # hängt an einem nackten Flag (s. `_ist_gelesen`).
            patch = {"is_read": True, "read_at": datetime.now(UTC).isoformat()}
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
            .eq("inbox_status", "active")
            .or_(
                f"last_message_at.lte.{upper},"
                f"and(last_message_at.is.null,booked_at.lte.{upper})"
            )
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
