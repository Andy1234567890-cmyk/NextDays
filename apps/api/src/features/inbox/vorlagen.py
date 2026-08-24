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
    TemplateText,
    TemplateTextUpsert,
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
    def _als_vorlage(r: dict, texte: list[TemplateText] | None = None) -> MessageTemplate:
        """DB-Zeile → Antwort. `body_html` fehlt bei Altbestand → leer."""
        return MessageTemplate(
            id=r["id"],
            title=r["title"],
            body=r["body"] or "",
            body_html=r.get("body_html") or "",
            subject=r.get("subject") or "",
            texts=texte or [],
        )

    def _vorlagen_texte(
        self, db: Client, tenant_id: str, template_ids: list[str]
    ) -> dict[str, list[TemplateText]]:
        """Sprachfassungen zu mehreren Vorlagen in EINER Abfrage.

        Ein Aufruf je Vorlage wäre bei 17 Vorlagen × 3 Sprachen dieselbe Antwort
        in 17 Runden — die Liste öffnet der Betrieb bei jedem Blick in die
        Vorlagen.
        """
        if not template_ids:
            return {}
        rows = (
            db.table("message_template_text")
            .select("template_id, lang, subject, body, body_html")
            .eq("tenant_id", tenant_id)
            .in_("template_id", template_ids)
            .order("lang")
            .execute()
        ).data or []
        nach_id: dict[str, list[TemplateText]] = {}
        for r in rows:
            nach_id.setdefault(str(r["template_id"]), []).append(
                TemplateText(
                    lang=r["lang"],
                    subject=r.get("subject") or "",
                    body=r.get("body") or "",
                    body_html=r.get("body_html") or "",
                )
            )
        return nach_id

    def list_templates(self, ctx: AuthContext) -> MessageTemplateList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_template")
            .select("id, title, body, body_html, subject")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        )
        rows = res.data or []
        texte = self._vorlagen_texte(db, tenant_id, [str(r["id"]) for r in rows])
        items = [self._als_vorlage(r, texte.get(str(r["id"]))) for r in rows]
        return MessageTemplateList(items=items, total=len(items))

    def _sprachfassungen_schreiben(
        self,
        db: Client,
        tenant_id: str,
        template_id: str,
        texte: list[TemplateTextUpsert] | None,
    ) -> list[TemplateText]:
        """Sprachfassungen einer Vorlage setzen (Alt/Neu-Diff, Wurzel 1).

        `None` heißt „nicht mitgeschickt" → unangetastet. Eine Liste beschreibt
        den VOLLSTÄNDIGEN Sollzustand: Sprachen, die darin fehlen, werden
        entfernt. Ohne diesen Gegenzustand bliebe eine im Editor gelöschte
        dänische Fassung in der DB stehen und ginge weiter an dänische Gäste
        hinaus — die Oberfläche zeigte sie nicht mehr, der Versand nahm sie.

        Eine Fassung ohne Text UND ohne Betreff wird nicht gespeichert, sondern
        entfernt: ein leerer Reiter ist keine Fassung, und stünde er als Zeile
        da, hielte `fassung_waehlen` ihn für gepflegt.
        """
        if texte is None:
            return self._vorlagen_texte(db, tenant_id, [template_id]).get(
                template_id, []
            )
        soll: dict[str, dict] = {}
        for t in texte:
            lang = (t.lang or "").strip().lower()
            if len(lang) != 2 or not lang.isalpha():
                raise InboxError(f"Ungültiger Sprachcode: {t.lang}", status_code=422)
            body = html_zu_text(t.body_html) if t.body_html.strip() else ""
            if not body.strip() and not t.subject.strip():
                continue
            self._felder_pruefen(body)
            self._felder_pruefen(t.subject)
            soll[lang] = {
                "template_id": template_id,
                "tenant_id": tenant_id,
                "lang": lang,
                "subject": t.subject,
                "body": body,
                "body_html": t.body_html,
            }
        # Erst der Gegenzustand (weg, was nicht mehr im Soll steht), dann das Soll.
        weg = [
            r["lang"]
            for r in (
                db.table("message_template_text")
                .select("lang")
                .eq("tenant_id", tenant_id)
                .eq("template_id", template_id)
                .execute()
            ).data
            or []
            if r["lang"] not in soll
        ]
        for lang in weg:
            db.table("message_template_text").delete().eq(
                "tenant_id", tenant_id
            ).eq("template_id", template_id).eq("lang", lang).execute()
        if soll:
            db.table("message_template_text").upsert(
                list(soll.values()), on_conflict="template_id,lang"
            ).execute()
        return self._vorlagen_texte(db, tenant_id, [template_id]).get(template_id, [])

    def create_template(self, ctx: AuthContext, req: TemplateUpsert) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        # Reihenfolge ZWINGEND: erst säubern (Validator), dann Klartext ableiten,
        # dann prüfen. Ein `{{guest<strong>_name</strong>}}` aus dem Editor ist
        # erst nach `html_zu_text` wieder ein erkennbarer Platzhalter.
        body = self._klartext_ableiten(req)
        if not req.title.strip() or not body.strip():
            raise InboxError("Titel und Text sind nötig.", status_code=422)
        self._felder_pruefen(body)
        self._felder_pruefen(req.subject)
        ins = (
            db.table("message_template")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "title": req.title,
                    "body": body,
                    "body_html": req.body_html,
                    "subject": req.subject,
                }
            )
            .execute()
        ).data
        row = ins[0]
        texte = self._sprachfassungen_schreiben(
            db, tenant_id, str(row["id"]), req.texts
        )
        return self._als_vorlage(row, texte)

    def update_template(
        self, ctx: AuthContext, template_id: str, req: TemplateUpsert
    ) -> MessageTemplate:
        db, tenant_id = self._require(ctx)
        body = self._klartext_ableiten(req)
        self._felder_pruefen(body)
        self._felder_pruefen(req.subject)
        upd = (
            db.table("message_template")
            .update(
                {
                    "title": req.title,
                    "body": body,
                    "body_html": req.body_html,
                    "subject": req.subject,
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("id", template_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Vorlage nicht gefunden.", status_code=404)
        # Erst NACH dem 404-Riegel: sonst schriebe eine fremde/ungültige ID
        # Sprachfassungen an eine Vorlage, die dieser Betrieb nicht besitzt
        # (Wurzel 3 — der Scope entscheidet, nicht die mitgeschickte ID).
        texte = self._sprachfassungen_schreiben(db, tenant_id, template_id, req.texts)
        # Wurzel 1 — der Gegenzustand einer Vorlagen-Änderung sind die bereits
        # EINGEPLANTEN Automails. `_automation_body` materialisiert den Text je
        # Buchung beim Planen; die Zeile in `automation_scheduled_message` hält
        # ihn danach fest, und der Versand kennt nur diese Zeile, nicht die
        # Vorlage. Ohne Neuplanung ging der ALTE Wortlaut weiter hinaus, bis
        # der stündliche Worker-Tick zufällig vorbeikam.
        #
        # Das trifft die Sprachfassungen am härtesten: wer die fehlende
        # italienische Fassung nachpflegt, um genau diesen Gast zu erreichen,
        # sieht bis zu einer Stunde lang keine Wirkung — und wenn die Automail
        # in dieser Stunde fällig wird, bekommt der Gast trotzdem die alte
        # Sprache. `update_automation` macht das seit 0307 richtig; der
        # Vorlagen-Pfad schreibt denselben Text und tat es nicht.
        self.replan_tenant(tenant_id)
        return self._als_vorlage(upd[0], texte)

    def delete_template(self, ctx: AuthContext, template_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_template").delete().eq("tenant_id", tenant_id).eq(
            "id", template_id
        ).execute()
        # Gegenzustand (Wurzel 1): der Fremdschlüssel setzt `template_id` der
        # Regeln auf NULL, aber die schon eingeplanten Automails tragen den
        # Text der gelöschten Vorlage weiter und würden ihn versenden. Nach der
        # Neuplanung greift entweder der eigene Text der Regel oder sie wird
        # stillgelegt (`_stilllegen`) — beides ist richtig, „gelöscht und
        # trotzdem verschickt" ist es nicht.
        self.replan_tenant(tenant_id)

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
