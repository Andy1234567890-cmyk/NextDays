"""Textvorlagen und KI-Antworten des Posteingangs.

Aus `service.py` herausgelöst (Modulgrenze `too-many-lines`). Wie
`planung.py` ein **Mixin**: Methodennamen und Aufrufstellen bleiben gleich,
es ist eine reine Verschiebung.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .ai import GroqClient, GroqError
from .errors import InboxError
from .felder import unbekannte_felder
from .schemas import (
    AiReplyResponse,
    AiSettings,
    InboxMessage,
    MessageTemplate,
    MessageTemplateList,
    TemplateUpsert,
)

log = get_logger("nextdays.inbox")


class VorlagenMixin:
    """Vorlagen + KI-Antwortvorschlag. Teil von `InboxService`."""

    # Vom Service gestellt (das Mixin steht nie allein).
    _db: Client | None
    _groq: GroqClient

    def ai_reply(self, ctx: AuthContext, thread_id: str) -> AiReplyResponse:
        """KI-Antwortvorschlag aus Gast-Nachrichten, Buchungskontext und den
        Fakten der Wissensdatenbank (Groq)."""
        db, tenant_id = self._require(ctx)
        # Verlauf laden (best effort, inkl. Sandbox-Mock) + Reservierungskontext.
        history: list[InboxMessage] = []
        try:
            history = self.get_messages(ctx, thread_id).items
        except InboxError as exc:
            log.warning("inbox_ai_history_failed", error=exc.message)
        detail = self.get_reservation_detail(ctx, thread_id)
        settings = self.get_ai_settings(ctx)
        row = self._load_thread(db, tenant_id, thread_id)
        wissen = self._wissen_fuer_thread(db, tenant_id, row)

        try:
            reply = GroqClient().suggest_reply(
                history=history,
                reservation=detail,
                settings=settings,
                knowledge=wissen,
            )
        except GroqError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        # `sources` weist aus, worauf die Antwort fußen konnte — sonst ist für
        # den Mitarbeiter nicht unterscheidbar, ob ein Detail aus der
        # Wissensdatenbank stammt oder das Modell es sich zurechtgelegt hat.
        return AiReplyResponse(reply=reply, sources=wissen)

    # -- Vorlagen --------------------------------------------------------------
    @staticmethod
    def _felder_pruefen(text: str | None) -> None:
        """Tippfehler im Platzhalter beim SPEICHERN abweisen (422).

        Solange der Autor davorsitzt, ist ein `{{guest_nmae}}` in einer Sekunde
        korrigiert. Erst beim Versand aufzufallen hieße: Wochen später, an einem
        Gast, ohne dass jemand hinsieht."""
        unbekannt = unbekannte_felder(text or "")
        if unbekannt:
            raise InboxError(
                "Unbekannte Felder: " + ", ".join(unbekannt), status_code=422
            )

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
        self._felder_pruefen(req.body)
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
        self._felder_pruefen(req.body)
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
