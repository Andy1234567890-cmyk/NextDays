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
from .felder import html_zu_text, unbekannte_felder
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

    @staticmethod
    def _klartext_ableiten(req: TemplateUpsert) -> str:
        """Versand-Klartext aus dem gesäuberten HTML — SERVERSEITIG (Wurzel 3).

        Der Client schickt beides, maßgeblich ist aber nur `body_html`: Würde
        `req.body` übernommen, könnte eine Anfrage harmloses HTML zeigen und
        einen ganz anderen Text an den Gast schicken lassen, denn der Versand
        nimmt `body`. Zwei Felder, die auseinanderlaufen können, sind eine
        Einladung — hier gibt es deshalb nur EINE Quelle.

        Der Rückfall auf `req.body` greift ausschließlich, wenn gar kein HTML
        kam (Altbestand, `host_messages`-Textarea) — dann IST der Klartext die
        Eingabe und wird nicht erfunden.
        """
        if req.body_html.strip():
            return html_zu_text(req.body_html)
        return req.body

    @staticmethod
    def _als_vorlage(r: dict) -> MessageTemplate:
        """DB-Zeile → Antwort. `body_html` fehlt bei Altbestand → leer."""
        return MessageTemplate(
            id=r["id"],
            title=r["title"],
            body=r["body"] or "",
            body_html=r.get("body_html") or "",
        )

    def list_templates(self, ctx: AuthContext) -> MessageTemplateList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_template")
            .select("id, title, body, body_html")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        )
        items = [self._als_vorlage(r) for r in (res.data or [])]
        return MessageTemplateList(items=items, total=len(items))

    def create_template(self, ctx: AuthContext, req: TemplateUpsert) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        # Reihenfolge ZWINGEND: erst säubern (Validator), dann Klartext ableiten,
        # dann prüfen. Ein `{{guest<strong>_name</strong>}}` aus dem Editor ist
        # erst nach `html_zu_text` wieder ein erkennbarer Platzhalter.
        body = self._klartext_ableiten(req)
        if not req.title.strip() or not body.strip():
            raise InboxError("Titel und Text sind nötig.", status_code=422)
        self._felder_pruefen(body)
        ins = (
            db.table("message_template")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "title": req.title,
                    "body": body,
                    "body_html": req.body_html,
                }
            )
            .execute()
        ).data
        return self._als_vorlage(ins[0])

    def update_template(
        self, ctx: AuthContext, template_id: str, req: TemplateUpsert
    ) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        body = self._klartext_ableiten(req)
        self._felder_pruefen(body)
        upd = (
            db.table("message_template")
            .update({"title": req.title, "body": body, "body_html": req.body_html})
            .eq("tenant_id", tenant_id)
            .eq("id", template_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Vorlage nicht gefunden.", status_code=404)
        return self._als_vorlage(upd[0])

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
