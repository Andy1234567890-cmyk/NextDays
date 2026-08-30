"""Textvorlagen und KI-Antworten des Posteingangs.

Aus `service.py` herausgelöst (Modulgrenze `too-many-lines`). Wie
`planung.py` ein **Mixin**: Methodennamen und Aufrufstellen bleiben gleich,
es ist eine reine Verschiebung.
"""
from supabase import Client

from src.core.ki import KiError
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .errors import InboxError
from .felder import html_zu_text, unbekannte_felder
from .ki_antwort import FUNKTION, markierungen_trennen, vorschlag_erzeugen
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

    def ai_reply(self, ctx: AuthContext, thread_id: str) -> AiReplyResponse:
        """KI-Antwortvorschlag aus Verlauf, Buchung, Gästemappe und Kalender.

        Der Kontext kommt aus `ki_kontext.kontext_bauen` — dieselbe Quelle wie
        beim WhatsApp-Pfad. Vorher las jeder Pfad seine eigene, auf die Fakten
        der Wissensdatenbank beschränkte Auswahl; die Gästemappe (live 700.628
        Zeichen) erreichte das Modell nie.
        """
        db, tenant_id = self._require(ctx)
        # Verlauf laden (best effort, inkl. Sandbox-Mock) + Reservierungskontext.
        history: list[InboxMessage] = []
        try:
            history = self.get_messages(ctx, thread_id).items
        except InboxError as exc:
            log.warning("inbox_ai_history_failed", error=exc.message)
        # `get_reservation_detail` läuft durch die Gast-Maske: ein Mitarbeiter
        # ohne VIEW_GUEST_NAME sieht auch hier nur den Vornamen. Der KI-Knopf
        # ist damit kein Weg um die Berechtigungsprüfung herum (Wurzel 3).
        detail = self.get_reservation_detail(ctx, thread_id)
        settings = self.get_ai_settings(ctx)
        row = self._load_thread(db, tenant_id, thread_id)
        prop = self._property_for_thread(db, tenant_id, row)

        regeln = self.regeln_fuer_thread(
            db, tenant_id, str(prop["id"]) if prop and prop.get("id") else None
        )

        try:
            # VOR dem Aufruf: der Deckel soll den bezahlten Aufruf verhindern,
            # nicht ihn nachträglich beklagen.
            deckel_pruefen(db, tenant_id)
            vorschlag = vorschlag_erzeugen(
                db,
                tenant_id,
                prop=prop,
                verlauf=history,
                reservierung=detail,
                einstellungen=settings,
                regeln=regeln,
            )
        except KiError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        buchen(
            db,
            tenant_id,
            user_id=ctx.user_id,
            funktion=FUNKTION,
            antwort=vorschlag.antwort,
        )
        # Dieser Weg SENDET nicht — er zeigt einen Vorschlag. Die Zustellart
        # wird trotzdem ermittelt und protokolliert, weil sie beantwortet, was
        # beim automatischen Lauf passiert WÄRE: der Betrieb sieht am Entwurf,
        # ob eine Regel griff und ob eine Sperre zugeschlagen hat.
        # Die Zustellart interessiert hier nur als BEGRÜNDUNG (`grund`): auf
        # diesem Weg bleibt es immer ein Entwurf, weil ein Mensch den Knopf
        # gedrückt hat. Wert wird sie erst im automatischen Lauf.
        _zustellart, grund, regel = self.zustellart_entscheiden(
            regeln, vorschlag.frage, settings.autoantwort_aktiv
        )
        # Die zwei Markierungszeilen entfernen, BEVOR der Text irgendwohin
        # geht. Der Mitarbeiter darf „[FEHLENDE ANGABE: …]" nicht versehentlich
        # an einen Gast weiterschicken.
        text, luecke, stimmung = markierungen_trennen(vorschlag.text)

        # Negativer Tenor: den Verlauf markieren (11b). Der Vorschlag bleibt
        # bestehen — hier hat ein Mensch den Knopf gedrückt und liest ohnehin
        # mit; die Markierung ist für die Liste und die Ansicht „Eskaliert".
        if stimmung:
            self.eskalation_setzen(
                db,
                tenant_id,
                thread_id=thread_id,
                quelle="inbox",
                ausloeser="stimmung",
                grund=stimmung,
                nachricht_auszug=vorschlag.frage,
                property_id=str(prop["id"]) if prop and prop.get("id") else None,
                # Auf DIESEM Weg keine Meldung: der Mitarbeiter steht davor.
                # Eine Mail an ihn selbst wäre Lärm.
                benachrichtigen=False,
            )

        self.protokollieren(
            db,
            tenant_id,
            thread_id=thread_id,
            quelle="inbox",
            regel_id=str(regel["id"]) if regel else None,
            frage=vorschlag.frage,
            antwort=text,
            # Auf diesem Weg ist es IMMER ein Entwurf: ein Mensch hat den Knopf
            # gedrückt und liest, was herauskommt.
            zustellart="entwurf",
            gesendet=False,
            quellen=vorschlag.quellen,
            weggelassen=vorschlag.kontext.weggelassen,
            grund=grund,
            eskaliert=bool(stimmung),
            modell=vorschlag.antwort.modell,
            region=vorschlag.antwort.region,
            tokens_ein=vorschlag.antwort.tokens_ein,
            tokens_aus=vorschlag.antwort.tokens_aus,
        )
        # `sources` weist aus, worauf die Antwort fußen konnte — sonst ist für
        # den Mitarbeiter nicht unterscheidbar, ob ein Detail aus einer echten
        # Quelle stammt oder das Modell es sich zurechtgelegt hat. Weggelassene
        # Abschnitte stehen mit dabei: sie erklären eine unvollständige Antwort,
        # die sonst wie ein Modellfehler aussieht.
        hinweise = list(vorschlag.kontext.weggelassen)
        if grund:
            hinweise.append(f"Nicht automatisch: {grund}")
        return AiReplyResponse(
            reply=text,
            sources=vorschlag.quellen + hinweise,
            fehlende_angabe=luecke,
            eskaliert=bool(stimmung),
        )

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
            .select(
                "tone, language, signature, extra_prompt, auto_suggest, "
                "autoantwort_aktiv, autoantwort_verzoegerung_minuten, "
                "antwortlaenge"
            )
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
