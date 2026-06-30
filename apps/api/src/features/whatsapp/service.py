"""Service-Schicht für whatsapp.

Bidirektionaler WhatsApp-Kanal (Meta Cloud API). Konversation je Gast-Nummer,
Nachrichten in beide Richtungen. Versand über die Cloud API (oder Sandbox-Mock,
wenn WHATSAPP_SANDBOX=true). Eingehende Nachrichten/Status kommen per Webhook.

Tenant-scoped (tenant_id aus dem JWT); der Webhook bestimmt den Tenant über die
bestehende Konversation bzw. den konfigurierten Default-Tenant — nie geraten.
"""
import re
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.guests.identity import (
    GuestContact as ResolverContact,
)
from src.features.guests.identity import (
    resolve_or_create_guest,
)

from .client import WhatsAppClient, WhatsAppError
from .schemas import (
    SliceHealth,
    WhatsAppConversation,
    WhatsAppConversationList,
    WhatsAppMessage,
    WhatsAppMessageList,
    WhatsAppStatus,
)

log = get_logger("nextdays.whatsapp")


class WhatsAppServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalize_phone(phone: str) -> str:
    """Auf reine Ziffern reduzieren (E.164 ohne '+', wie Meta es nutzt)."""
    return re.sub(r"\D", "", phone or "")


class WhatsAppService:
    slice_name = "whatsapp"

    def __init__(
        self,
        service_client: Client | None = None,
        client: WhatsAppClient | None = None,
    ) -> None:
        self._db = service_client
        self._client = client or WhatsAppClient()

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def status(self) -> WhatsAppStatus:
        s = get_settings()
        return WhatsAppStatus(
            configured=self._client.is_configured,
            sandbox=s.whatsapp_sandbox,
            phone_number_id_set=bool(s.whatsapp_phone_number_id),
        )

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise WhatsAppServiceError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise WhatsAppServiceError("WhatsApp-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    @staticmethod
    def _sandbox() -> bool:
        return get_settings().whatsapp_sandbox

    # --- Lesen --------------------------------------------------------------
    def list_conversations(self, ctx: AuthContext) -> WhatsAppConversationList:
        db, tenant_id = self._require(ctx)
        # Gastname über die zentrale Maske (Daten-Split §4): ohne VIEW_GUEST_NAME
        # nur Vorname — dieselbe Wahrheit wie inbox/reservations.
        from src.features.auth.guest_masking import load_guest_mask

        mask = load_guest_mask(db, ctx.user_id)
        res = (
            db.table("whatsapp_conversation")
            .select("id, wa_phone, guest_name, reservation_id, last_message, last_at, is_read")
            .eq("tenant_id", tenant_id)
            .order("last_at", desc=True)
            .limit(200)
            .execute()
        )
        items = [
            WhatsAppConversation(
                id=c["id"], wa_phone=c["wa_phone"],
                guest_name=mask.name(c.get("guest_name")),
                reservation_id=c.get("reservation_id"),
                last_message=c.get("last_message"), last_at=c.get("last_at"),
                is_read=bool(c.get("is_read", True)),
            )
            for c in (res.data or [])
        ]
        return WhatsAppConversationList(items=items, total=len(items))

    def list_messages(
        self, ctx: AuthContext, conversation_id: str
    ) -> WhatsAppMessageList:
        db, tenant_id = self._require(ctx)
        self._load_conversation(db, tenant_id, conversation_id)
        res = (
            db.table("whatsapp_message")
            .select("id, direction, body, status, created_at")
            .eq("tenant_id", tenant_id)
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        items = [
            WhatsAppMessage(
                id=m["id"], direction=m["direction"], body=m.get("body") or "",
                status=m.get("status") or "sent", sent_at=m.get("created_at"),
            )
            for m in (res.data or [])
        ]
        # Eingehende als gelesen markieren (Konversation öffnen).
        db.table("whatsapp_conversation").update({"is_read": True}).eq(
            "tenant_id", tenant_id
        ).eq("id", conversation_id).execute()
        return WhatsAppMessageList(items=items, total=len(items))

    def _load_conversation(self, db: Client, tenant_id: str, conv_id: str) -> dict:
        res = (
            db.table("whatsapp_conversation")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", conv_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise WhatsAppServiceError("Konversation nicht gefunden.", status_code=404)
        return res.data[0]

    def _upsert_conversation(
        self, db: Client, tenant_id: str, wa_phone: str, *, guest_name: str | None = None
    ) -> dict:
        existing = (
            db.table("whatsapp_conversation")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("wa_phone", wa_phone)
            .limit(1)
            .execute()
        ).data
        if existing:
            conv = existing[0]
            # Nachzügler: Gast verknüpfen, falls eine Alt-Konversation ohne
            # guest_id existiert (z. B. vor Einführung des Resolvers angelegt).
            if not conv.get("guest_id"):
                guest_id = self._resolve_guest(db, tenant_id, wa_phone, guest_name)
                if guest_id:
                    db.table("whatsapp_conversation").update(
                        {"guest_id": guest_id}
                    ).eq("id", conv["id"]).execute()
                    conv["guest_id"] = guest_id
            return conv
        # Neue Konversation: Gast zentral auflösen (Telefon-/Kanal-ID-Match).
        guest_id = self._resolve_guest(db, tenant_id, wa_phone, guest_name)
        ins = (
            db.table("whatsapp_conversation")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "wa_phone": wa_phone,
                    "guest_name": guest_name,
                    "guest_id": guest_id,
                }
            )
            .execute()
        ).data
        return ins[0]

    @staticmethod
    def _resolve_guest(
        db: Client, tenant_id: str, wa_phone: str, guest_name: str | None
    ) -> str | None:
        """WhatsApp-Kontakt → Gast über den zentralen Resolver.

        wa_phone ist E.164 ohne '+' (Meta-Format); für die Normalisierung im
        Resolver mit '+' präfixen. Kanal-ID = WhatsApp-Nummer (stabil je Gast)."""
        return resolve_or_create_guest(
            db,
            tenant_id,
            ResolverContact(
                name=guest_name,
                phone=f"+{wa_phone}" if wa_phone else None,
                channel="whatsapp",
                external_ref=wa_phone or None,
            ),
        )

    # --- Senden -------------------------------------------------------------
    # Meta-Regel: freie Textnachrichten sind nur INNERHALB von 24 h nach der
    # letzten EINGEHENDEN Nachricht erlaubt. Außerhalb (oder ohne jede eingehende
    # Nachricht) sind ausschließlich Template-Nachrichten zulässig.
    _SERVICE_WINDOW = timedelta(hours=24)

    def _last_inbound_at(self, db: Client, tenant_id: str, conv_id: str) -> datetime | None:
        """Zeitpunkt der jüngsten EINGEHENDEN Nachricht der Konversation (oder None)."""
        res = (
            db.table("whatsapp_message")
            .select("created_at")
            .eq("tenant_id", tenant_id)
            .eq("conversation_id", conv_id)
            .eq("direction", "in")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if not res:
            return None
        raw = res[0].get("created_at")
        if not raw:
            return None
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return None

    def _within_service_window(self, db: Client, tenant_id: str, conv_id: str) -> bool:
        """True, wenn die letzte eingehende Nachricht < 24 h her ist."""
        last_in = self._last_inbound_at(db, tenant_id, conv_id)
        if last_in is None:
            return False
        if last_in.tzinfo is None:
            last_in = last_in.replace(tzinfo=UTC)
        return datetime.now(UTC) - last_in < self._SERVICE_WINDOW

    def _resolve_target(
        self, db: Client, tenant_id: str, conversation_id: str | None, to_phone: str | None
    ) -> dict:
        """Ziel-Konversation laden oder per Telefonnummer anlegen (gemeinsam)."""
        if conversation_id:
            return self._load_conversation(db, tenant_id, conversation_id)
        phone = _normalize_phone(to_phone or "")
        if len(phone) < 6:
            raise WhatsAppServiceError(
                "Gültige Telefonnummer mit Ländervorwahl nötig.", status_code=422
            )
        return self._upsert_conversation(db, tenant_id, phone)

    def _persist_outgoing(
        self,
        db: Client,
        tenant_id: str,
        conv: dict,
        *,
        body: str,
        wa_message_id: str | None,
        status: str,
        last_message: str,
    ) -> WhatsAppMessage:
        """Ausgehende Nachricht speichern + Konversation aktualisieren (gemeinsam)."""
        ins = (
            db.table("whatsapp_message")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "conversation_id": conv["id"],
                    "direction": "out",
                    "body": body,
                    "wa_message_id": wa_message_id,
                    "status": status,
                }
            )
            .execute()
        ).data
        m = ins[0] if ins else {}
        db.table("whatsapp_conversation").update(
            {"last_message": last_message}
        ).eq("tenant_id", tenant_id).eq("id", conv["id"]).execute()
        return WhatsAppMessage(
            id=m.get("id"), direction="out", body=body,
            status=status, sent_at=m.get("created_at"),
        )

    def send(
        self,
        ctx: AuthContext,
        *,
        conversation_id: str | None,
        to_phone: str | None,
        body: str,
    ) -> WhatsAppMessage:
        db, tenant_id = self._require(ctx)
        text = (body or "").strip()
        if not text:
            raise WhatsAppServiceError("Nachricht darf nicht leer sein.", status_code=422)

        conv = self._resolve_target(db, tenant_id, conversation_id, to_phone)

        # 24-h-Servicefenster: freier Text nur innerhalb. Außerhalb → Template nötig.
        if not self._sandbox() and not self._within_service_window(
            db, tenant_id, conv["id"]
        ):
            raise WhatsAppServiceError(
                "Außerhalb des 24-Stunden-Servicefensters: Es ist nur eine "
                "Template-Nachricht erlaubt (send-template).",
                status_code=409,
            )

        wa_message_id = None
        if not self._sandbox():
            try:
                res = self._client.send_text(conv["wa_phone"], text)
            except WhatsAppError as exc:
                raise WhatsAppServiceError(exc.message, status_code=exc.status_code) from exc
            msgs = res.get("messages") or []
            wa_message_id = msgs[0].get("id") if msgs else None

        return self._persist_outgoing(
            db, tenant_id, conv,
            body=text, wa_message_id=wa_message_id, status="sent", last_message=text,
        )

    def send_template(
        self,
        ctx: AuthContext,
        *,
        conversation_id: str | None,
        to_phone: str | None,
        template_name: str,
        language_code: str = "de",
        variables: list[str] | None = None,
    ) -> WhatsAppMessage:
        """Template-Nachricht senden (auch außerhalb des 24-h-Fensters erlaubt)."""
        db, tenant_id = self._require(ctx)
        name = (template_name or "").strip()
        if not name:
            raise WhatsAppServiceError("Template-Name nötig.", status_code=422)

        conv = self._resolve_target(db, tenant_id, conversation_id, to_phone)

        # Body-Variablen → Meta-Components (geordnete {{1}}, {{2}}, …).
        components: list[dict] | None = None
        if variables:
            components = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": v} for v in variables],
                }
            ]

        wa_message_id = None
        if not self._sandbox():
            try:
                res = self._client.send_template(
                    conv["wa_phone"], name, language_code, components
                )
            except WhatsAppError as exc:
                raise WhatsAppServiceError(exc.message, status_code=exc.status_code) from exc
            msgs = res.get("messages") or []
            wa_message_id = msgs[0].get("id") if msgs else None

        # Im Verlauf als „Vorlage: <name>" sichtbar (der gerenderte Text liegt bei Meta).
        body_label = f"[Vorlage: {name}]"
        return self._persist_outgoing(
            db, tenant_id, conv,
            body=body_label, wa_message_id=wa_message_id, status="sent",
            last_message=body_label,
        )

    # --- Webhook (eingehend, kein JWT) -------------------------------------
    def ingest_webhook(self, payload: dict) -> dict:
        """Eingehende WhatsApp-Nachrichten + Status verarbeiten (Meta-Format).

        Tenant: bestehende Konversation (per Nummer) → deren Tenant; sonst der
        konfigurierte Default-Tenant. Ohne beides wird die Nachricht protokolliert
        verworfen (kein Raten)."""
        if self._db is None:
            raise WhatsAppServiceError("WhatsApp-DB nicht verfügbar.", status_code=500)
        db = self._db
        received = 0
        for entry in payload.get("entry", []) or []:
            for change in entry.get("changes", []) or []:
                value = change.get("value") or {}
                contacts = {
                    c.get("wa_id"): (c.get("profile") or {}).get("name")
                    for c in (value.get("contacts") or [])
                }
                for msg in value.get("messages") or []:
                    if self._store_incoming(db, msg, contacts):
                        received += 1
                # Status-Updates (sent/delivered/read/failed) der Ausgangsnachrichten.
                for st in value.get("statuses") or []:
                    self._apply_status(db, st)
        return {"received": received}

    def _resolve_tenant(self, db: Client, wa_phone: str) -> str | None:
        existing = (
            db.table("whatsapp_conversation")
            .select("tenant_id")
            .eq("wa_phone", wa_phone)
            .limit(1)
            .execute()
        ).data
        if existing:
            return existing[0]["tenant_id"]
        default = get_settings().whatsapp_default_tenant_id
        return default or None

    def _store_incoming(self, db: Client, msg: dict, contacts: dict) -> bool:
        wa_phone = _normalize_phone(msg.get("from") or "")
        if not wa_phone:
            return False
        body = ((msg.get("text") or {}).get("body")) or ""
        wa_message_id = msg.get("id")
        tenant_id = self._resolve_tenant(db, wa_phone)
        if not tenant_id:
            log.warning("whatsapp_no_tenant", wa_phone=wa_phone)
            return False
        conv = self._upsert_conversation(
            db, tenant_id, wa_phone, guest_name=contacts.get(wa_phone)
        )
        # Idempotenz: gleiche Meta-ID nicht doppelt (unique index fängt es auch ab).
        if wa_message_id:
            dup = (
                db.table("whatsapp_message")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("wa_message_id", wa_message_id)
                .limit(1)
                .execute()
            ).data
            if dup:
                return False
        db.table("whatsapp_message").insert(
            {
                "tenant_id": tenant_id,
                "conversation_id": conv["id"],
                "direction": "in",
                "body": body,
                "wa_message_id": wa_message_id,
                "status": "received",
            }
        ).execute()
        db.table("whatsapp_conversation").update(
            {"last_message": body, "is_read": False}
        ).eq("tenant_id", tenant_id).eq("id", conv["id"]).execute()
        return True

    def _apply_status(self, db: Client, st: dict) -> None:
        wa_message_id = st.get("id")
        status = st.get("status")
        if not (wa_message_id and status):
            return
        db.table("whatsapp_message").update({"status": status}).eq(
            "wa_message_id", wa_message_id
        ).execute()
