"""Service-Schicht für inbox.

Threads werden aus den importierten OTA-Buchungen (channex_booking) abgeleitet:
pro Buchung ein Thread mit Portal, Gast, Reservierungsbezug. Nachrichten werden
über die Channex-Messaging-API gelesen und gesendet (Booking.com/Airbnb/Expedia).
Ein optionaler KI-Antwortvorschlag (Groq) hilft beim Beantworten.

Tenant-scoped (tenant_id aus dem JWT). Kein stilles Exception-Swallowing.
"""
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexClient, ChannexError
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

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

if TYPE_CHECKING:
    from .authz import InboxAccess

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

    def access(self, ctx: AuthContext) -> "InboxAccess":
        """Effektive Posteingang-Berechtigungen des Nutzers (Quelle: DB)."""
        from .authz import load_inbox_access

        return load_inbox_access(self._db, ctx)

    @staticmethod
    def _guest_name(customer: dict) -> str | None:
        return (
            " ".join(
                x for x in [customer.get("name"), customer.get("surname")] if x
            ).strip()
            or None
        )

    # Gültige Posteingang-Status (Lebenszyklus).
    _STATUSES = ("active", "archived", "trashed")

    def list_threads(
        self, ctx: AuthContext, *, unassigned: bool = False, status: str = "active",
        access: "InboxAccess | None" = None,
    ) -> InboxListResponse:
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        if status not in self._STATUSES:
            status = "active"
        query = (
            db.table("channex_booking")
            .select(
                "id, channex_booking_id, ota_name, ota_reservation_code, status, "
                "arrival_date, departure_date, customer, updated_at, guest_id, "
                "is_read, is_starred, is_archived, assigned_user_id, inbox_status, "
                "property_map_id"
            )
            .eq("tenant_id", tenant_id)
            # Genau die gewählte Ansicht (active|archived|trashed); deleted nie.
            .eq("inbox_status", status)
        )
        # Scope: assigned-only-Nutzer sehen nur die ihnen zugewiesenen Threads.
        if access.scope == "assigned":
            query = query.eq("assigned_user_id", ctx.user_id)
        elif unassigned:
            query = query.is_("assigned_user_id", "null")
        res = query.order("updated_at", desc=True).limit(200).execute()
        rows = res.data or []
        # Reservierungs-IDs in einem Rutsch nachschlagen (Thread ↔ Reservierung).
        booking_ids = [r["channex_booking_id"] for r in rows if r.get("channex_booking_id")]
        res_by_booking = self._reservation_ids_for(db, tenant_id, booking_ids)
        # Namen der zugewiesenen Benutzer auflösen.
        user_ids = [r["assigned_user_id"] for r in rows if r.get("assigned_user_id")]
        names = self._user_names(db, tenant_id, user_ids)
        # Objekt (Haus) je Thread auflösen: property_map_id → property_id + Titel.
        map_ids = [r["property_map_id"] for r in rows if r.get("property_map_id")]
        prop_by_map = self._properties_for_maps(db, tenant_id, map_ids)
        mask = access.mask

        items: list[InboxThread] = []
        for r in rows:
            customer = r.get("customer") or {}
            cbid = r.get("channex_booking_id")
            uid = r.get("assigned_user_id")
            prop = prop_by_map.get(r.get("property_map_id")) if r.get("property_map_id") else None
            items.append(
                InboxThread(
                    id=r["id"],
                    channex_booking_id=cbid,
                    reservation_id=res_by_booking.get(cbid),
                    guest_id=r.get("guest_id"),
                    property_id=prop[0] if prop else None,
                    property_title=prop[1] if prop else None,
                    ota_name=mask.source_value(r.get("ota_name")),
                    ota_reservation_code=r.get("ota_reservation_code"),
                    guest_name=mask.name(self._guest_name(customer)),
                    guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
                    status=r.get("status"),
                    arrival_date=r.get("arrival_date"),
                    departure_date=r.get("departure_date"),
                    updated_at=r.get("updated_at"),
                    is_read=bool(r.get("is_read", True)),
                    is_starred=bool(r.get("is_starred")),
                    is_archived=bool(r.get("is_archived")),
                    inbox_status=r.get("inbox_status") or "active",
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

    def _properties_for_maps(
        self, db: Client, tenant_id: str, map_ids: list[str]
    ) -> dict[str, tuple[str, str]]:
        """Map property_map_id → (property_id, property_title). Zwei Batch-Abfragen
        (channex_property_map → properties), damit der Posteingang nach Objekt
        filtern/anzeigen kann."""
        if not map_ids:
            return {}
        maps = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .in_("id", list(set(map_ids)))
            .execute()
        ).data or []
        prop_ids = [m["property_id"] for m in maps if m.get("property_id")]
        titles: dict[str, str] = {}
        if prop_ids:
            props = (
                db.table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", list(set(prop_ids)))
                .execute()
            ).data or []
            titles = {str(p["id"]): p.get("title") or "" for p in props}
        out: dict[str, tuple[str, str]] = {}
        for m in maps:
            pid = m.get("property_id")
            if pid:
                out[str(m["id"])] = (str(pid), titles.get(str(pid), ""))
        return out

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

    def _load_thread(
        self, db: Client, tenant_id: str, thread_id: str,
        *, access: "InboxAccess | None" = None, scope_user_id: str | None = None,
    ) -> dict:
        """channex_booking-Zeile dieses Tenants laden (404, wenn fremd/fehlt).

        Bei assigned-only-Scope (access.scope == "assigned") gilt ein fremder,
        nicht zugewiesener Thread bewusst als 404 (nicht 403) — die Existenz wird
        nicht preisgegeben. `scope_user_id` ist die user_id des Anfragenden.
        """
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
        row = res.data[0]
        if access and access.scope == "assigned":
            # Nur eigene Zuweisung sichtbar; sonst 404 (keine Existenz verraten).
            if row.get("assigned_user_id") != scope_user_id:
                raise InboxError("Konversation nicht gefunden.", status_code=404)
        return row

    def _load_thread_scoped(
        self, ctx: AuthContext, thread_id: str,
        *, access: "InboxAccess | None" = None,
    ) -> tuple[Client, str, dict, "InboxAccess"]:
        """Thread tenant- UND scope-gesichert laden (assigned-only → 404 bei fremd).

        Liefert (db, tenant_id, row, access) für die Weiterverarbeitung.
        """
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        row = self._load_thread(
            db, tenant_id, thread_id, access=access, scope_user_id=ctx.user_id
        )
        return db, tenant_id, row, access

    @staticmethod
    def _sandbox_enabled() -> bool:
        """Sandbox-Messaging aktiv? Dann lokaler Mock-Speicher statt Channex
        (die echte Messaging-API ist ein separat freizuschaltendes Add-on)."""
        from src.core.config import get_settings

        return get_settings().channex_sandbox_portals

    def get_messages(self, ctx: AuthContext, thread_id: str) -> InboxMessagesResponse:
        db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)

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
        self, ctx: AuthContext, thread_id: str, message: str,
        *, enforce_reply: bool = True,
    ) -> InboxMessage:
        """Antwort an den Gast senden.

        `enforce_reply=False` umgeht die INBOX_REPLY-Prüfung — nur für den
        internen Cron/Scheduler-Pfad (die Berechtigung wurde beim Planen geprüft).
        """
        text = (message or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        if enforce_reply:
            db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)
            if not _access.can_reply:
                raise InboxError(
                    "Keine Berechtigung zum Senden.", status_code=403
                )
        else:
            db, tenant_id = self._require(ctx)
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
        self, ctx: AuthContext, thread_id: str,
        access: "InboxAccess | None" = None,
    ) -> ReservationDetail:
        """Reservierungs-Kontext rechts neben dem Chat (Listing, Gast, Preis …)."""
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        row = self._load_thread(
            db, tenant_id, thread_id, access=access, scope_user_id=ctx.user_id
        )
        customer = row.get("customer") or {}

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
        mask = access.mask
        total = (amount / 100) if isinstance(amount, (int, float)) else None
        return ReservationDetail(
            listing_name=listing_name,
            listing_photo=listing_photo,
            address=address,
            rental_id=str(rental_id) if rental_id else None,
            guest_name=mask.name(self._guest_name(customer)),
            guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
            guest_phone=mask.contact_value(customer.get("phone")),
            guest_language=customer.get("language") or customer.get("lang"),
            adults=occ.get("adults"),
            children=occ.get("children"),
            nights=nights,
            total_amount=mask.amount(total),
            paid_amount=mask.amount(0.0),
            currency=row.get("currency") if mask.amounts else None,
            status=row.get("status"),
            ota_name=mask.source_value(row.get("ota_name")),
            ota_reservation_code=row.get("ota_reservation_code"),
            check_in=row.get("arrival_date"),
            check_out=row.get("departure_date"),
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            note=row.get("note"),
            is_starred=bool(row.get("is_starred")),
        )

    def update_thread_flags(
        self, ctx: AuthContext, thread_id: str, *,
        is_starred: bool | None = None, note: str | None = None,
        is_read: bool | None = None, is_archived: bool | None = None,
        remind_at: str | None = None,
    ) -> None:
        """Konversations-Flags setzen: Favorit, Notiz, Lese-/Archiv-Status,
        Erinnerung. Nur gesetzte Felder werden geschrieben."""
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
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

    # --- Lebenszyklus: Archiv / Papierkorb / Löschen ------------------------
    _SET_STATUSES = ("active", "archived", "trashed", "deleted")

    def set_inbox_status(
        self, ctx: AuthContext, thread_id: str, status: str
    ) -> None:
        """Posteingang-Status setzen (Soft-Delete durchgängig).

        active   – zurück in den Posteingang (Wiederherstellen)
        archived – ins Archiv
        trashed  – in den Papierkorb
        deleted  – endgültig löschen (nur Posteingang-Sicht; Buchung bleibt)
        """
        if status not in self._SET_STATUSES:
            raise InboxError("Unbekannter Status.", status_code=422)
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        patch = {"inbox_status": status}
        # is_archived synchron halten (Kompat. mit bestehender Spalte/Logik).
        patch["is_archived"] = status == "archived"
        db.table("channex_booking").update(patch).eq("tenant_id", tenant_id).eq(
            "id", thread_id
        ).execute()

    # --- Zuweisung ----------------------------------------------------------
    @staticmethod
    def _has_inbox_access(role: object, permissions: object) -> bool:
        """Hat der Nutzer Posteingang-Zugriff (PM_CHAT, Admin immer)?"""
        from src.features.auth.lodgify_permissions import Permission, has_permission
        from src.features.auth.schemas import UserRole

        try:
            role_enum = UserRole(role) if role else None
        except ValueError:
            role_enum = None
        return has_permission(role_enum, permissions, Permission.PM_CHAT)

    def list_team(self, ctx: AuthContext) -> "TeamMemberList":
        """Mögliche Bearbeiter: nur Tenant-Nutzer mit Posteingang-Zugriff (PM_CHAT).

        Man soll nicht an jemanden zuweisen können, der den Thread nie öffnen kann.
        """
        db, tenant_id = self._require(ctx)
        res = (
            db.table("users")
            .select("id, full_name, email, role, permissions")
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
            if self._has_inbox_access(u.get("role"), u.get("permissions"))
        ]
        return TeamMemberList(items=items, total=len(items))

    def assign_thread(
        self, ctx: AuthContext, thread_id: str, user_id: str | None
    ) -> None:
        """Konversation einem Tenant-Benutzer zuweisen (None hebt auf).

        Erfordert INBOX_ASSIGN. Ziel-Nutzer muss Posteingang-Zugriff (PM_CHAT)
        haben, sonst 422. Audit: assigned_by/assigned_at werden gesetzt.
        """
        db, tenant_id, row, access = self._load_thread_scoped(ctx, thread_id)
        if not access.can_assign:
            raise InboxError("Keine Berechtigung zum Zuweisen.", status_code=403)
        if user_id:
            target = (
                db.table("users")
                .select("id, role, permissions")
                .eq("tenant_id", tenant_id)
                .eq("id", user_id)
                .limit(1)
                .execute()
            ).data
            if not target:
                raise InboxError("Benutzer nicht gefunden.", status_code=404)
            t = target[0]
            if not self._has_inbox_access(t.get("role"), t.get("permissions")):
                raise InboxError(
                    "Nutzer hat keinen Posteingang-Zugriff.", status_code=422
                )

        previous = row.get("assigned_user_id")
        now = datetime.now(UTC).isoformat()
        db.table("channex_booking").update(
            {
                "assigned_user_id": user_id,
                "assigned_by": ctx.user_id,
                "assigned_at": now,
            }
        ).eq("tenant_id", tenant_id).eq("id", thread_id).execute()
        # Audit-Historie (Best-Effort: ein Log-Fehler darf die Zuweisung nicht kippen).
        try:
            db.table("inbox_assignment_log").insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "from_user_id": previous,
                    "to_user_id": user_id,
                    "by_user_id": ctx.user_id,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("inbox_assignment_log_failed", error=str(exc))

    def link_thread_guest(
        self, ctx: AuthContext, thread_id: str, guest_id: str | None
    ) -> str | None:
        """Korrektur: Thread manuell einem Gast zuordnen.

        guest_id gesetzt → bestehenden (tenant-eigenen) Gast verknüpfen.
        guest_id None  → „Gast aus Thread anlegen": Resolver über das customer-
        JSON laufen lassen (findet bestehenden oder legt neu an).

        Erfordert INBOX_MANAGE_CONFIG (Admin-Korrektur). Gibt die verknüpfte
        guest_id zurück.
        """
        db, tenant_id, row, access = self._load_thread_scoped(ctx, thread_id)
        if not access.can_manage_config:
            raise InboxError("Keine Berechtigung zur Gast-Zuordnung.", status_code=403)

        if guest_id:
            owned = (
                db.table("guests")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("id", guest_id)
                .limit(1)
                .execute()
            ).data
            if not owned:
                raise InboxError("Gast nicht gefunden.", status_code=404)
            resolved = owned[0]["id"]
        else:
            resolved = resolve_or_create_guest(
                db,
                tenant_id,
                contact_from_ota_customer(
                    row.get("customer") or {},
                    external_ref=row.get("ota_reservation_code"),
                ),
            )
            if not resolved:
                raise InboxError(
                    "Aus diesem Thread lässt sich kein Gast ableiten "
                    "(kein Name/keine Kontaktdaten).",
                    status_code=422,
                )

        db.table("channex_booking").update({"guest_id": resolved}).eq(
            "tenant_id", tenant_id
        ).eq("id", thread_id).execute()
        log.info(
            "inbox_thread_guest_linked",
            tenant_id=tenant_id,
            thread_id=thread_id,
            guest_id=resolved,
            by_user_id=ctx.user_id,
        )
        return resolved

    # --- Interne Notiz (gelb) ----------------------------------------------
    def add_note(self, ctx: AuthContext, thread_id: str, body: str) -> InboxMessage:
        """Interne Notiz in den Verlauf legen (gelb, nicht an die OTA)."""
        text = (body or "").strip()
        if not text:
            raise InboxError("Notiz darf nicht leer sein.", status_code=422)
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
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
    def _compute_send_at(
        anchor: str, offset_days: int, send_time: object, thread: dict
    ) -> datetime | None:
        """send_at = Ankerdatum + offset_days @ send_time (UTC). None, wenn das
        Ankerdatum fehlt (z. B. booking ohne created_at) → Automail wird übersprungen."""
        from datetime import date, time, timedelta

        if anchor == "arrival":
            base = thread.get("arrival_date")
        elif anchor == "departure":
            base = thread.get("departure_date")
        else:  # booking
            base = thread.get("created_at")
        if not base:
            return None
        base_str = str(base)[:10]
        try:
            d = date.fromisoformat(base_str)
        except ValueError:
            return None
        # send_time aus DB ist "HH:MM[:SS]"; ohne Angabe Mitternacht.
        hh, mm = 0, 0
        if send_time:
            parts = str(send_time).split(":")
            hh = int(parts[0])
            mm = int(parts[1]) if len(parts) > 1 else 0
        dt = datetime.combine(d + timedelta(days=offset_days), time(hh, mm), tzinfo=UTC)
        return dt

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

    def schedule_automations_for_thread(self, tenant_id: str, thread_id: str) -> int:
        """Fällige Automails für einen Thread planen. Gibt die Anzahl geplanter
        (neu angelegter) Automails zurück. Idempotent über den Unique-Index."""
        if self._db is None:
            return 0
        db = self._db
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
            return 0
        th = thread[0]
        # property_map_id → lokale property_id (für Haus-Matching).
        property_id = None
        if th.get("property_map_id"):
            pm = (
                db.table("channex_property_map")
                .select("property_id")
                .eq("id", th["property_map_id"])
                .limit(1)
                .execute()
            ).data or []
            property_id = pm[0]["property_id"] if pm else None

        automations = (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .execute()
        ).data or []

        planned = 0
        for a in automations:
            if not self._automation_matches(a, property_id, th.get("ota_name")):
                continue
            body = self._automation_body(db, tenant_id, a)
            if not body:
                continue
            send_at = self._compute_send_at(
                a.get("anchor") or "arrival",
                a.get("offset_days") or 0,
                a.get("send_time"),
                th,
            )
            if send_at is None:
                continue
            # Upsert je (Automation, Thread); Dedup verhindert Doppelversand.
            db.table("automation_scheduled_message").upsert(
                {
                    "tenant_id": tenant_id,
                    "automation_id": a["id"],
                    "thread_id": thread_id,
                    "body": body,
                    "send_at": send_at.isoformat(),
                },
                on_conflict="automation_id,thread_id",
            ).execute()
            planned += 1
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
    _AUTOMATION_COLS = (
        "id, name, trigger, anchor, offset_days, send_time, property_ids, "
        "channels, template_id, message, is_active"
    )

    @staticmethod
    def _automation_row(r: dict) -> Automation:
        """DB-Zeile → Automation: NULL-Arrays zu [], send_time auf HH:MM kürzen."""
        st = r.get("send_time")
        return Automation(
            id=str(r["id"]),
            name=r.get("name") or "",
            trigger=r.get("trigger") or "booking_new",
            anchor=r.get("anchor") or "arrival",
            offset_days=r.get("offset_days") or 0,
            send_time=str(st)[:5] if st else None,
            property_ids=[str(p) for p in (r.get("property_ids") or [])],
            channels=list(r.get("channels") or []),
            template_id=str(r["template_id"]) if r.get("template_id") else None,
            message=r.get("message"),
            is_active=bool(r.get("is_active", True)),
        )

    @staticmethod
    def _automation_payload(req: AutomationUpsert) -> dict:
        """Upsert-Payload: leere Arrays als NULL (= „alle"), send_time HH:MM."""
        return {
            "name": req.name,
            "trigger": req.trigger,
            "anchor": req.anchor,
            "offset_days": req.offset_days,
            "send_time": req.send_time if req.send_time else None,
            "property_ids": req.property_ids or None,
            "channels": req.channels or None,
            "template_id": req.template_id,
            "message": req.message,
            "is_active": req.is_active,
        }

    def list_automations(self, ctx: AuthContext) -> AutomationList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        items = [self._automation_row(r) for r in (res.data or [])]
        return AutomationList(items=items, total=len(items))

    def create_automation(
        self, ctx: AuthContext, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        if not req.name.strip():
            raise InboxError("Name ist nötig.", status_code=422)
        ins = (
            db.table("message_automation")
            .insert({"tenant_id": tenant_id, **self._automation_payload(req)})
            .execute()
        ).data
        return self._automation_row(ins[0])

    def update_automation(
        self, ctx: AuthContext, automation_id: str, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        upd = (
            db.table("message_automation")
            .update(self._automation_payload(req))
            .eq("tenant_id", tenant_id)
            .eq("id", automation_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Automatisierung nicht gefunden.", status_code=404)
        return self._automation_row(upd[0])

    def delete_automation(self, ctx: AuthContext, automation_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_automation").delete().eq("tenant_id", tenant_id).eq(
            "id", automation_id
        ).execute()
