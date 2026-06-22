"""Service-Schicht für inbox.

Threads werden aus den importierten OTA-Buchungen (channex_booking) abgeleitet:
pro Buchung ein Thread mit Portal, Gast, Reservierungsbezug. Nachrichten werden
über die Channex-Messaging-API gelesen und gesendet (Booking.com/Airbnb/Expedia).
Ein optionaler KI-Antwortvorschlag (Groq) hilft beim Beantworten.

Tenant-scoped (tenant_id aus dem JWT). Kein stilles Exception-Swallowing.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexClient, ChannexError

from .ai import GroqClient, GroqError
from .schemas import (
    AiReplyResponse,
    AiSettings,
    Automation,
    AutomationList,
    AutomationUpsert,
    BulkUpdateResult,
    InboxListResponse,
    InboxMessage,
    InboxMessagesResponse,
    InboxThread,
    MessageTemplate,
    MessageTemplateList,
    ReservationDetail,
    ScheduledMessage,
    ScheduledMessageList,
    SliceHealth,
    TeamMember,
    TeamMemberList,
    TemplateUpsert,
)

log = get_logger("nextdays.inbox")


class InboxError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InboxService:
    slice_name = "inbox"

    def __init__(
        self,
        service_client: Client | None = None,
        channex: ChannexClient | None = None,
    ) -> None:
        self._db = service_client
        self._channex = channex or ChannexClient()

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise InboxError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    @staticmethod
    def _guest_name(customer: dict) -> str | None:
        return (
            " ".join(
                x for x in [customer.get("name"), customer.get("surname")] if x
            ).strip()
            or None
        )

    def list_threads(
        self, ctx: AuthContext, *, unassigned: bool = False, archived: bool = False
    ) -> InboxListResponse:
        db, tenant_id = self._require(ctx)
        query = (
            db.table("channex_booking")
            .select(
                "id, channex_booking_id, ota_name, ota_reservation_code, status, "
                "arrival_date, departure_date, customer, updated_at, "
                "is_read, is_starred, is_archived, assigned_user_id"
            )
            .eq("tenant_id", tenant_id)
            # Archiv-Ansicht zeigt NUR archivierte, sonst nur aktive.
            .eq("is_archived", archived)
        )
        if unassigned:
            query = query.is_("assigned_user_id", "null")
        res = query.order("updated_at", desc=True).limit(200).execute()
        rows = res.data or []
        # Reservierungs-IDs in einem Rutsch nachschlagen (Thread ↔ Reservierung).
        booking_ids = [r["channex_booking_id"] for r in rows if r.get("channex_booking_id")]
        res_by_booking = self._reservation_ids_for(db, tenant_id, booking_ids)
        # Namen der zugewiesenen Benutzer auflösen.
        user_ids = [r["assigned_user_id"] for r in rows if r.get("assigned_user_id")]
        names = self._user_names(db, tenant_id, user_ids)

        items: list[InboxThread] = []
        for r in rows:
            customer = r.get("customer") or {}
            cbid = r.get("channex_booking_id")
            uid = r.get("assigned_user_id")
            items.append(
                InboxThread(
                    id=r["id"],
                    channex_booking_id=cbid,
                    reservation_id=res_by_booking.get(cbid),
                    ota_name=r.get("ota_name"),
                    ota_reservation_code=r.get("ota_reservation_code"),
                    guest_name=self._guest_name(customer),
                    guest_email=customer.get("mail") or customer.get("email"),
                    status=r.get("status"),
                    arrival_date=r.get("arrival_date"),
                    departure_date=r.get("departure_date"),
                    updated_at=r.get("updated_at"),
                    is_read=bool(r.get("is_read", True)),
                    is_starred=bool(r.get("is_starred")),
                    is_archived=bool(r.get("is_archived")),
                    assigned_user_id=uid,
                    assigned_user_name=names.get(uid) if uid else None,
                )
            )
        return InboxListResponse(items=items, total=len(items))

    def _user_names(
        self, db: Client, tenant_id: str, user_ids: list[str]
    ) -> dict[str, str]:
        """Map user_id → Anzeigename (Team-Mitglieder des Tenants)."""
        if not user_ids:
            return {}
        res = (
            db.table("users")
            .select("id, full_name, email")
            .eq("tenant_id", tenant_id)
            .in_("id", list(set(user_ids)))
            .execute()
        )
        return {
            u["id"]: (u.get("full_name") or u.get("email") or "")
            for u in (res.data or [])
        }

    def _reservation_ids_for(
        self, db: Client, tenant_id: str, booking_ids: list[str]
    ) -> dict[str, str]:
        """Map Channex-Booking-UUID → lokale reservation_id (für die Verknüpfung)."""
        if not booking_ids:
            return {}
        res = (
            db.table("reservations")
            .select("id, source_channex_booking_id")
            .eq("tenant_id", tenant_id)
            .in_("source_channex_booking_id", booking_ids)
            .execute()
        )
        return {
            r["source_channex_booking_id"]: r["id"]
            for r in (res.data or [])
            if r.get("source_channex_booking_id")
        }

    def _load_thread(self, db: Client, tenant_id: str, thread_id: str) -> dict:
        """channex_booking-Zeile dieses Tenants laden (404, wenn fremd/fehlt)."""
        res = (
            db.table("channex_booking")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", thread_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise InboxError("Konversation nicht gefunden.", status_code=404)
        return res.data[0]

    @staticmethod
    def _sandbox_enabled() -> bool:
        """Sandbox-Messaging aktiv? Dann lokaler Mock-Speicher statt Channex
        (die echte Messaging-API ist ein separat freizuschaltendes Add-on)."""
        from src.core.config import get_settings

        return get_settings().channex_sandbox_portals

    def get_messages(self, ctx: AuthContext, thread_id: str) -> InboxMessagesResponse:
        db, tenant_id = self._require(ctx)
        row = self._load_thread(db, tenant_id, thread_id)

        # Sandbox: Nachrichten aus dem lokalen Mock-Speicher.
        if self._sandbox_enabled():
            res = (
                db.table("sandbox_message")
                .select("id, sender, message, created_at")
                .eq("tenant_id", tenant_id)
                .eq("thread_id", thread_id)
                .order("created_at")
                .execute()
            )
            items = [
                InboxMessage(
                    id=m.get("id"),
                    message=m.get("message") or "",
                    sender="property" if m.get("sender") == "property" else "guest",
                    sent_at=m.get("created_at"),
                )
                for m in (res.data or [])
            ]
            items = self._merge_notes(db, tenant_id, thread_id, items)
            return InboxMessagesResponse(items=items, total=len(items))

        cbid = row.get("channex_booking_id")
        if not cbid:
            items = self._merge_notes(db, tenant_id, thread_id, [])
            return InboxMessagesResponse(items=items, total=len(items))
        try:
            res = self._channex.get_messages_for_booking(cbid)
        except ChannexError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        items = [self._to_message(m) for m in (res.get("data") or [])]
        items = self._merge_notes(db, tenant_id, thread_id, items)
        return InboxMessagesResponse(items=items, total=len(items))

    def _merge_notes(
        self, db: Client, tenant_id: str, thread_id: str, msgs: list[InboxMessage]
    ) -> list[InboxMessage]:
        """Interne Notizen (sender='note', gelb) chronologisch einfügen."""
        res = (
            db.table("inbox_thread_note")
            .select("id, body, author_id, created_at")
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        )
        notes = res.data or []
        if not notes:
            return msgs
        names = self._user_names(
            db, tenant_id, [n["author_id"] for n in notes if n.get("author_id")]
        )
        note_msgs = [
            InboxMessage(
                id=n["id"],
                message=n.get("body") or "",
                sender="note",
                sent_at=n.get("created_at"),
                author_name=names.get(n.get("author_id")),
            )
            for n in notes
        ]
        merged = msgs + note_msgs
        # Chronologisch sortieren; Einträge ohne Zeit ans Ende.
        merged.sort(key=lambda m: m.sent_at or "")
        return merged

    @staticmethod
    def _to_message(m: dict) -> InboxMessage:
        a = m.get("attributes") or m
        # Channex: sender kann "guest"/"property" o.ä. heißen.
        sender = (a.get("sender") or a.get("author") or "guest").lower()
        if sender not in ("guest", "property"):
            sender = "property" if "host" in sender or "prop" in sender else "guest"
        return InboxMessage(
            id=m.get("id") or a.get("id"),
            message=a.get("message") or a.get("text") or "",
            sender=sender,
            sent_at=a.get("inserted_at") or a.get("sent_at") or a.get("time"),
        )

    def send_message(
        self, ctx: AuthContext, thread_id: str, message: str
    ) -> InboxMessage:
        db, tenant_id = self._require(ctx)
        text = (message or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        row = self._load_thread(db, tenant_id, thread_id)

        # Sandbox: Antwort lokal als 'property'-Nachricht ablegen.
        if self._sandbox_enabled():
            ins = (
                db.table("sandbox_message")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "thread_id": thread_id,
                        "sender": "property",
                        "message": text,
                    }
                )
                .execute()
            ).data
            created = ins[0] if ins else {}
            return InboxMessage(
                id=created.get("id"),
                message=text,
                sender="property",
                sent_at=created.get("created_at"),
            )

        cbid = row.get("channex_booking_id")
        if not cbid:
            raise InboxError(
                "Für diese Konversation ist kein Versand möglich.", status_code=422
            )
        try:
            res = self._channex.send_message_for_booking(cbid, text)
        except ChannexError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        data = res.get("data") or {}
        if data:
            return self._to_message(data)
        # Channex bestätigt teils ohne Echo — dann die gesendete Nachricht zurück.
        return InboxMessage(message=text, sender="property")

    def get_reservation_detail(
        self, ctx: AuthContext, thread_id: str
    ) -> ReservationDetail:
        """Reservierungs-Kontext rechts neben dem Chat (Listing, Gast, Preis …)."""
        db, tenant_id = self._require(ctx)
        row = self._load_thread(db, tenant_id, thread_id)
        customer = row.get("customer") or {}
        cbid = row.get("channex_booking_id")

        listing_name = None
        listing_photo = None
        address = None
        rental_id = None
        # Lokale Property über das Mapping (channex_property_id → property).
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", row.get("channex_property_id") or "")
            .limit(1)
            .execute()
        ).data if row.get("channex_property_id") else None
        if pm:
            rental_id = pm[0]["property_id"]
            prop = (
                db.table("properties")
                .select("title, address, city, photos")
                .eq("id", rental_id)
                .limit(1)
                .execute()
            ).data
            if prop:
                listing_name = prop[0].get("title")
                address = " ".join(
                    x for x in [prop[0].get("address"), prop[0].get("city")] if x
                ).strip() or None
                photos = prop[0].get("photos") or []
                listing_photo = photos[0] if photos else None

        nights = self._nights(row.get("arrival_date"), row.get("departure_date"))
        amount = row.get("amount_cents")
        # Gäste-Aufschlüsselung + Zeiten aus der rohen OTA-Payload (falls vorhanden).
        raw = row.get("raw") or {}
        occ = raw.get("occupancy") or {}
        checkin_time = raw.get("checkin_time") or occ.get("checkin_time")
        checkout_time = raw.get("checkout_time") or occ.get("checkout_time")
        return ReservationDetail(
            listing_name=listing_name,
            listing_photo=listing_photo,
            address=address,
            rental_id=str(rental_id) if rental_id else None,
            guest_name=self._guest_name(customer),
            guest_email=customer.get("mail") or customer.get("email"),
            guest_phone=customer.get("phone"),
            guest_language=customer.get("language") or customer.get("lang"),
            adults=occ.get("adults"),
            children=occ.get("children"),
            nights=nights,
            total_amount=(amount / 100) if isinstance(amount, (int, float)) else None,
            paid_amount=0.0,
            currency=row.get("currency"),
            status=row.get("status"),
            ota_name=row.get("ota_name"),
            ota_reservation_code=row.get("ota_reservation_code"),
            check_in=row.get("arrival_date"),
            check_out=row.get("departure_date"),
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            note=row.get("note"),
            is_starred=bool(row.get("is_starred")),
        )

    def update_thread_flags(
        self, ctx: AuthContext, thread_id: str, *, is_starred=None, note=None,
        is_read=None, is_archived=None, remind_at=None,
    ) -> None:
        """Konversations-Flags setzen: Favorit, Notiz, Lese-/Archiv-Status,
        Erinnerung. Nur gesetzte Felder werden geschrieben."""
        db, tenant_id = self._require(ctx)
        self._load_thread(db, tenant_id, thread_id)  # 404, wenn fremd
        patch: dict = {}
        if is_starred is not None:
            patch["is_starred"] = bool(is_starred)
        if note is not None:
            patch["note"] = note
        if is_read is not None:
            patch["is_read"] = bool(is_read)
        if is_archived is not None:
            patch["is_archived"] = bool(is_archived)
        if remind_at is not None:
            patch["remind_at"] = remind_at or None
        if not patch:
            return
        db.table("channex_booking").update(patch).eq("tenant_id", tenant_id).eq(
            "id", thread_id
        ).execute()

    # --- Zuweisung ----------------------------------------------------------
    def list_team(self, ctx: AuthContext) -> "TeamMemberList":
        """Team-Benutzer des Tenants (mögliche Bearbeiter einer Konversation)."""
        db, tenant_id = self._require(ctx)
        res = (
            db.table("users")
            .select("id, full_name, email")
            .eq("tenant_id", tenant_id)
            .order("full_name")
            .execute()
        )
        items = [
            TeamMember(
                id=u["id"], name=u.get("full_name") or u.get("email") or "—",
                email=u.get("email"),
            )
            for u in (res.data or [])
        ]
        return TeamMemberList(items=items, total=len(items))

    def assign_thread(
        self, ctx: AuthContext, thread_id: str, user_id: str | None
    ) -> None:
        """Konversation einem Tenant-Benutzer zuweisen (None hebt auf)."""
        db, tenant_id = self._require(ctx)
        self._load_thread(db, tenant_id, thread_id)  # 404, wenn fremd
        if user_id:
            ok = (
                db.table("users")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("id", user_id)
                .limit(1)
                .execute()
            ).data
            if not ok:
                raise InboxError("Benutzer nicht gefunden.", status_code=404)
        db.table("channex_booking").update(
            {"assigned_user_id": user_id}
        ).eq("tenant_id", tenant_id).eq("id", thread_id).execute()

    # --- Interne Notiz (gelb) ----------------------------------------------
    def add_note(self, ctx: AuthContext, thread_id: str, body: str) -> InboxMessage:
        """Interne Notiz in den Verlauf legen (gelb, nicht an die OTA)."""
        db, tenant_id = self._require(ctx)
        text = (body or "").strip()
        if not text:
            raise InboxError("Notiz darf nicht leer sein.", status_code=422)
        self._load_thread(db, tenant_id, thread_id)
        ins = (
            db.table("inbox_thread_note")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "author_id": ctx.user_id,
                    "body": text,
                }
            )
            .execute()
        ).data
        created = ins[0] if ins else {}
        names = self._user_names(db, tenant_id, [ctx.user_id] if ctx.user_id else [])
        return InboxMessage(
            id=created.get("id"),
            message=text,
            sender="note",
            sent_at=created.get("created_at"),
            author_name=names.get(ctx.user_id),
        )

    # --- Geplante Nachrichten ----------------------------------------------
    def schedule_message(
        self, ctx: AuthContext, thread_id: str, body: str, send_at: str
    ) -> ScheduledMessage:
        db, tenant_id = self._require(ctx)
        text = (body or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        if not (send_at or "").strip():
            raise InboxError("Zeitpunkt fehlt.", status_code=422)
        self._load_thread(db, tenant_id, thread_id)
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
        db, tenant_id = self._require(ctx)
        self._load_thread(db, tenant_id, thread_id)
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
        if action == "read":
            patch = {"is_read": True}
        elif action == "archived":
            patch = {"is_archived": True}
        else:
            raise InboxError("Unbekannte Aktion.", status_code=422)
        if not (before or "").strip():
            raise InboxError("Datum fehlt.", status_code=422)
        # `before` ist ein Tag (YYYY-MM-DD) → einschließlich des ganzen Tages.
        upper = f"{before[:10]}T23:59:59Z"
        res = (
            db.table("channex_booking")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .lte("updated_at", upper)
            .execute()
        ).data or []
        return BulkUpdateResult(updated=len(res))

    # --- Interner Cron: fällige geplante Nachrichten versenden -------------
    def dispatch_due_scheduled(self) -> dict:
        """Über ALLE Tenants: fällige (send_at ≤ jetzt) pending-Nachrichten
        versenden. Kein JWT — via internem Cron-Endpoint aufgerufen."""
        from datetime import datetime, timezone

        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        db = self._db
        now = datetime.now(timezone.utc).isoformat()
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
            try:
                ctx = AuthContext(user_id="cron", tenant_id=s["tenant_id"])
                self.send_message(ctx, s["thread_id"], s["body"])
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

    @staticmethod
    def _nights(arrival: str | None, departure: str | None) -> int | None:
        if not (arrival and departure):
            return None
        from datetime import date

        try:
            d = (date.fromisoformat(departure) - date.fromisoformat(arrival)).days
            return d if d > 0 else None
        except ValueError:
            return None

    def ai_reply(self, ctx: AuthContext, thread_id: str) -> AiReplyResponse:
        """KI-Antwortvorschlag aus Gast-Nachrichten + Buchungskontext (Groq)."""
        self._require(ctx)
        # Verlauf laden (best effort, inkl. Sandbox-Mock) + Reservierungskontext.
        history: list[InboxMessage] = []
        try:
            history = self.get_messages(ctx, thread_id).items
        except InboxError as exc:
            log.warning("inbox_ai_history_failed", error=exc.message)
        detail = self.get_reservation_detail(ctx, thread_id)
        settings = self.get_ai_settings(ctx)

        try:
            reply = GroqClient().suggest_reply(
                history=history, reservation=detail, settings=settings
            )
        except GroqError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        return AiReplyResponse(reply=reply, sources=[])

    # -- Vorlagen --------------------------------------------------------------
    def list_templates(self, ctx: AuthContext) -> MessageTemplateList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_template")
            .select("id, title, body")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        )
        items = [MessageTemplate(**r) for r in (res.data or [])]
        return MessageTemplateList(items=items, total=len(items))

    def create_template(self, ctx: AuthContext, req: TemplateUpsert) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        if not req.title.strip() or not req.body.strip():
            raise InboxError("Titel und Text sind nötig.", status_code=422)
        ins = (
            db.table("message_template")
            .insert({"tenant_id": tenant_id, "title": req.title, "body": req.body})
            .execute()
        ).data
        r = ins[0]
        return MessageTemplate(id=r["id"], title=r["title"], body=r["body"])

    def update_template(
        self, ctx: AuthContext, template_id: str, req: TemplateUpsert
    ) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        upd = (
            db.table("message_template")
            .update({"title": req.title, "body": req.body})
            .eq("tenant_id", tenant_id)
            .eq("id", template_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Vorlage nicht gefunden.", status_code=404)
        r = upd[0]
        return MessageTemplate(id=r["id"], title=r["title"], body=r["body"])

    def delete_template(self, ctx: AuthContext, template_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_template").delete().eq("tenant_id", tenant_id).eq(
            "id", template_id
        ).execute()

    # -- KI-Einstellungen ------------------------------------------------------
    def get_ai_settings(self, ctx: AuthContext) -> AiSettings:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("inbox_ai_settings")
            .select("tone, language, signature, extra_prompt, auto_suggest")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            return AiSettings()  # Defaults, solange nichts gespeichert ist
        return AiSettings(**res[0])

    def save_ai_settings(self, ctx: AuthContext, req: AiSettings) -> AiSettings:
        db, tenant_id = self._require(ctx)
        db.table("inbox_ai_settings").upsert(
            {"tenant_id": tenant_id, **req.model_dump()}, on_conflict="tenant_id"
        ).execute()
        return req

    # -- Automatisierungen -----------------------------------------------------
    def list_automations(self, ctx: AuthContext) -> AutomationList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_automation")
            .select("id, name, trigger, offset_days, template_id, message, is_active")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        items = [Automation(**r) for r in (res.data or [])]
        return AutomationList(items=items, total=len(items))

    def create_automation(
        self, ctx: AuthContext, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        if not req.name.strip():
            raise InboxError("Name ist nötig.", status_code=422)
        ins = (
            db.table("message_automation")
            .insert({"tenant_id": tenant_id, **req.model_dump()})
            .execute()
        ).data
        return Automation(**ins[0])

    def update_automation(
        self, ctx: AuthContext, automation_id: str, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        upd = (
            db.table("message_automation")
            .update(req.model_dump())
            .eq("tenant_id", tenant_id)
            .eq("id", automation_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Automatisierung nicht gefunden.", status_code=404)
        return Automation(**upd[0])

    def delete_automation(self, ctx: AuthContext, automation_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_automation").delete().eq("tenant_id", tenant_id).eq(
            "id", automation_id
        ).execute()
