"""Router für inbox. Gemountet unter /api/v1/inbox."""
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from src.core.languages import alle_sprachen, basis_sprache
from src.core.security import AuthContext, get_current_user, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.core.uploads import read_upload

from .authz import InboxAccess
from .fassung_uebersetzen import fassung_uebersetzen
from .felder import FELDER, FeldFehlt
from .schemas import (
    AiReplyResponse,
    AiSettings,
    AssignRequest,
    Attachment,
    AttachmentList,
    Automation,
    AutomationList,
    AutomationUpsert,
    BulkUpdateRequest,
    BulkUpdateResult,
    FieldCatalog,
    FieldEntry,
    InboxListResponse,
    InboxMessage,
    InboxMessagesResponse,
    InboxStatusUpdate,
    KnowledgeFact,
    KnowledgeFactList,
    KnowledgeFactUpsert,
    LanguageOption,
    LanguageOptionList,
    LinkGuestRequest,
    LinkGuestResponse,
    MessageLanguageAdd,
    MessageLanguageList,
    MessageTemplate,
    MessageTemplateList,
    NachrichtenKennzahlen,
    NoteCreate,
    RenderRequest,
    RenderResponse,
    ReservationDetail,
    ScheduleCreate,
    ScheduledMessage,
    ScheduledMessageList,
    SendMessageRequest,
    SliceHealth,
    TeamMemberList,
    TemplateUpsert,
    ThreadFlagsUpdate,
    TranslateFassungRequest,
    TranslateFassungResponse,
    UnreadCount,
)
from .service import InboxError, InboxService


def get_inbox_service() -> InboxService:
    return InboxService(service_client=get_service_client())


InboxServiceDep = Annotated[InboxService, Depends(get_inbox_service)]


def require_inbox_access(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> tuple[AuthContext, InboxAccess]:
    """Posteingang-Zugriff (PM_CHAT) erzwingen; liefert (ctx, access).

    Quelle der Wahrheit sind die Berechtigungen aus der DB (nicht das JWT).
    """
    from .authz import load_inbox_access

    access = load_inbox_access(get_service_client(), ctx)
    if not access.can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Posteingang-Zugriff.",
        )
    return ctx, access


def require_inbox_config(
    bundle: Annotated[tuple[AuthContext, InboxAccess], Depends(require_inbox_access)],
) -> tuple[AuthContext, InboxAccess]:
    """Posteingang-Konfiguration (Vorlagen/Automationen/KI) — INBOX_MANAGE_CONFIG."""
    _ctx, access = bundle
    if not access.can_manage_config:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zur Posteingang-Konfiguration.",
        )
    return bundle


# (ctx, access)-Bündel: Access-geschützt bzw. Config-geschützt.
_AccessDep = Annotated[tuple[AuthContext, InboxAccess], Depends(require_inbox_access)]
_ConfigDep = Annotated[tuple[AuthContext, InboxAccess], Depends(require_inbox_config)]

# Sprache der OBERFLÄCHE des Betriebs (Sprachumschalter, nicht `Accept-Language`
# — siehe `available_languages`). Der Default steht am Parameter (`= None`),
# NICHT hier: FastAPI verbietet einen Default innerhalb von `Annotated[...]`.
_SprachParam = Query(
    min_length=2,
    max_length=5,
    description="ISO-639-1 der Oberflächensprache; steuert nur die Sprachnamen.",
)

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return InboxService().health()


@router.get("", response_model=InboxListResponse)
def list_threads(
    service: InboxServiceDep,
    bundle: _AccessDep,
    unassigned: Annotated[bool, Query()] = False,
    status: Annotated[str, Query()] = "active",
) -> InboxListResponse:
    ctx, access = bundle
    try:
        return service.list_threads(
            ctx, unassigned=unassigned, status=status, access=access
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(service: InboxServiceDep, bundle: _AccessDep) -> UnreadCount:
    """Offene Konversationen — die Zahl am Sidebar-Punkt „Posteingang".

    Steht VOR `/{thread_id}/…`-Routen, aber das genügt hier ohnehin nicht als
    Begründung: FastAPI wählt die zuerst registrierte passende Route, und
    `/unread-count` würde sonst als `thread_id` durchgehen.

    Gleicher Zugangs-Dependency wie die Liste (`_AccessDep`) — dieselbe
    Autorisierung UND derselbe Scope (Wurzel 9): wer nur zugewiesene Threads
    sehen darf, bekommt auch nur deren Zahl.
    """
    ctx, access = bundle
    try:
        return UnreadCount(ungelesen=service.unread_count(ctx, access=access))
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/kennzahlen", response_model=NachrichtenKennzahlen)
def nachrichten_kennzahlen(
    service: InboxServiceDep,
    bundle: _AccessDep,
    zeitraum: str = "30d",
) -> NachrichtenKennzahlen:
    """Nachrichten-Kennzahlen der Startseite (gesendet/empfangen/Automation).

    Steht wie `/unread-count` VOR den `/{thread_id}`-Routen — sonst nähme
    FastAPI „kennzahlen" als Thread-ID.

    `zeitraum` ist einer aus `kennzahlen.ZEITRAEUME` (7d | 30d | 3m | 12m);
    ein unbekannter Wert wird mit 422 abgewiesen, nicht still auf den Standard
    gedreht. Bewusst eine geschlossene Menge statt freier Tageszahl — sonst
    wäre der Zeitraum ein offener Hebel (Wurzel 8).

    Gleicher Zugangs-Dependency wie die Liste (Wurzel 9): die Zahlen sind eine
    Aggregation derselben Nachrichten, also gilt derselbe Scope.
    """
    ctx, access = bundle
    try:
        return service.nachrichten_kennzahlen(
            ctx, zeitraum=zeitraum, access=access
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/team", response_model=TeamMemberList)
def list_team(service: InboxServiceDep, bundle: _AccessDep) -> TeamMemberList:
    ctx, _access = bundle
    try:
        return service.list_team(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/internal/dispatch-scheduled", include_in_schema=False)
def dispatch_scheduled(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: versendet fällige geplante Nachrichten über ALLE
    Tenants. Kein JWT — via eigenem INTERNAL_CRON_SECRET abgesichert (nie das
    outbound geteilte Channex-Webhook-Secret), getriggert durch einen
    Coolify-Scheduled-Task / Host-crontab (curl)."""
    require_internal_cron_secret(x_internal_cron_secret)
    return InboxService(service_client=get_service_client()).dispatch_due_scheduled()


@router.post("/internal/dispatch-automations", include_in_schema=False)
def dispatch_automations(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: versendet fällige Automails (Buchungsbestätigung,
    Anreise-/Check-out-Info) über ALLE Tenants. Wie /dispatch-scheduled per
    INTERNAL_CRON_SECRET abgesichert, getriggert durch einen Scheduled-Task."""
    require_internal_cron_secret(x_internal_cron_secret)
    return InboxService(service_client=get_service_client()).dispatch_due_automations()


@router.post("/internal/replan-automations", include_in_schema=False)
def replan_automations(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: plant die datumsgebundenen Automails über ALLE
    Tenants neu (0307). Nötig, weil eine Regel sich ändern kann, NACHDEM für sie
    geplant wurde — neue Regel, andere Uhrzeit, pausiert, Buchung umgebucht oder
    storniert. Wie /dispatch-automations per INTERNAL_CRON_SECRET abgesichert."""
    require_internal_cron_secret(x_internal_cron_secret)
    return InboxService(service_client=get_service_client()).replan_all_tenants()


@router.get("/{thread_id}/messages", response_model=InboxMessagesResponse)
def get_messages(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> InboxMessagesResponse:
    ctx, _access = bundle
    try:
        return service.get_messages(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/messages", response_model=InboxMessage)
def send_message(
    thread_id: str, req: SendMessageRequest, service: InboxServiceDep, bundle: _AccessDep
) -> InboxMessage:
    ctx, _access = bundle
    try:
        return service.send_message(ctx, thread_id, req.message)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except FeldFehlt as exc:
        # `send_message` reicht FeldFehlt bewusst durch (der Cron hält den Grund
        # an der geplanten Zeile fest). Am interaktiven Endpunkt ist das aber ein
        # Eingabefehler des Nutzers, kein Serverfehler: ohne diesen Zweig
        # antwortete ein Vorlagentext mit unbesetztem Feld mit „Internal Server
        # Error" statt zu sagen, welches Feld fehlt (Wurzel 5).
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{thread_id}/reservation", response_model=ReservationDetail)
def get_reservation(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> ReservationDetail:
    ctx, access = bundle
    try:
        return service.get_reservation_detail(ctx, thread_id, access=access)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/flags", status_code=204)
def update_flags(
    thread_id: str, req: ThreadFlagsUpdate, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    ctx, _access = bundle
    try:
        service.update_thread_flags(
            ctx, thread_id,
            is_starred=req.is_starred, note=req.note,
            is_read=req.is_read, is_archived=req.is_archived,
            remind_at=req.remind_at,
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/status", status_code=204)
def set_status(
    thread_id: str, req: InboxStatusUpdate, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    ctx, _access = bundle
    try:
        service.set_inbox_status(ctx, thread_id, req.status)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/assign", status_code=204)
def assign_thread(
    thread_id: str, req: AssignRequest, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    ctx, _access = bundle
    try:
        service.assign_thread(ctx, thread_id, req.user_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{thread_id}/guest", response_model=LinkGuestResponse)
def link_thread_guest(
    thread_id: str, req: LinkGuestRequest, service: InboxServiceDep, bundle: _ConfigDep
) -> LinkGuestResponse:
    """Korrektur: Thread einem (anderen) Gast zuordnen oder Gast aus Thread anlegen."""
    ctx, _access = bundle
    try:
        guest_id = service.link_thread_guest(ctx, thread_id, req.guest_id)
        return LinkGuestResponse(guest_id=guest_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/notes", response_model=InboxMessage)
def add_note(
    thread_id: str, req: NoteCreate, service: InboxServiceDep, bundle: _AccessDep
) -> InboxMessage:
    ctx, _access = bundle
    try:
        return service.add_note(ctx, thread_id, req.body)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{thread_id}/scheduled", response_model=ScheduledMessageList)
def list_scheduled(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> ScheduledMessageList:
    ctx, _access = bundle
    try:
        return service.list_scheduled(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/scheduled", response_model=ScheduledMessage)
def schedule_message(
    thread_id: str, req: ScheduleCreate, service: InboxServiceDep, bundle: _AccessDep
) -> ScheduledMessage:
    ctx, _access = bundle
    try:
        return service.schedule_message(ctx, thread_id, req.body, req.send_at)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/scheduled/{scheduled_id}", status_code=204)
def cancel_scheduled(
    scheduled_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    ctx, _access = bundle
    try:
        service.cancel_scheduled(ctx, scheduled_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk-update", response_model=BulkUpdateResult)
def bulk_update(
    req: BulkUpdateRequest, service: InboxServiceDep, bundle: _AccessDep
) -> BulkUpdateResult:
    ctx, _access = bundle
    try:
        return service.bulk_update(ctx, req.action, req.before)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/ai-reply", response_model=AiReplyResponse)
def ai_reply(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> AiReplyResponse:
    ctx, _access = bundle
    try:
        return service.ai_reply(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Vorlagen ---------------------------------------------------------------
@router.get("/templates", response_model=MessageTemplateList)
def list_templates(service: InboxServiceDep, bundle: _AccessDep) -> MessageTemplateList:
    ctx, _access = bundle
    try:
        return service.list_templates(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/templates", response_model=MessageTemplate)
def create_template(
    req: TemplateUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> MessageTemplate:
    ctx, _access = bundle
    try:
        return service.create_template(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/templates/{template_id}", response_model=MessageTemplate)
def update_template(
    template_id: str, req: TemplateUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> MessageTemplate:
    ctx, _access = bundle
    try:
        return service.update_template(ctx, template_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str, service: InboxServiceDep, bundle: _ConfigDep
) -> None:
    ctx, _access = bundle
    try:
        service.delete_template(ctx, template_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- KI-Einstellungen -------------------------------------------------------
@router.get("/ai-settings", response_model=AiSettings)
def get_ai_settings(service: InboxServiceDep, bundle: _AccessDep) -> AiSettings:
    ctx, _access = bundle
    try:
        return service.get_ai_settings(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/ai-settings", response_model=AiSettings)
def save_ai_settings(
    req: AiSettings, service: InboxServiceDep, bundle: _ConfigDep
) -> AiSettings:
    ctx, _access = bundle
    try:
        return service.save_ai_settings(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Automatisierungen ------------------------------------------------------
@router.get("/automations", response_model=AutomationList)
def list_automations(service: InboxServiceDep, bundle: _AccessDep) -> AutomationList:
    ctx, _access = bundle
    try:
        return service.list_automations(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/automations", response_model=Automation)
def create_automation(
    req: AutomationUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> Automation:
    ctx, _access = bundle
    try:
        return service.create_automation(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/automations/{automation_id}", response_model=Automation)
def update_automation(
    automation_id: str, req: AutomationUpsert, service: InboxServiceDep,
    bundle: _ConfigDep,
) -> Automation:
    ctx, _access = bundle
    try:
        return service.update_automation(ctx, automation_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/automations/{automation_id}", status_code=204)
def delete_automation(
    automation_id: str, service: InboxServiceDep, bundle: _ConfigDep
) -> None:
    ctx, _access = bundle
    try:
        service.delete_automation(ctx, automation_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Sprachen des Betriebs (0363) --------------------------------------------
# Die Sprachen entscheiden, welcher Wortlaut an einen Gast geht. Lesen darf das
# jeder mit Posteingang-Zugriff (die Reiter im Editor brauchen die Liste),
# ÄNDERN nur die Posteingang-Konfiguration (_ConfigDep) — eine umgestellte
# Standardsprache wirkt auf jede künftige Nachricht des Betriebs.
@router.get("/languages", response_model=MessageLanguageList)
def list_message_languages(
    service: InboxServiceDep, bundle: _AccessDep
) -> MessageLanguageList:
    ctx, _access = bundle
    try:
        return service.list_message_languages(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/languages/available", response_model=LanguageOptionList)
def available_languages(
    bundle: _AccessDep,
    sprache: Annotated[str | None, _SprachParam] = None,
) -> LanguageOptionList:
    """Auswahlliste für „Neue Sprache hinzufügen" — der Katalog des Servers.

    Anders als beim Platzhalter-Katalog kommt der NAME hier mit: welche Sprachen
    wir führen, ist eine Datenaussage. Eine dritte Liste von Sprachnamen in 24
    Sprachdateien zu pflegen wäre genau die Vervielfachung, die CLAUDE.md
    verbietet — `core.languages` ist die eine Quelle.

    `sprache` ist die Sprache der OBERFLÄCHE des Betriebs, nicht die der
    gepflegten Fassungen. Ohne sie stünde im Auswahlmenü eines englischen oder
    italienischen Betriebs „Englisch, Italienisch, Niederländisch" — deutsche
    Namen in einer nicht-deutschen Oberfläche. Bewusst als Query-Parameter und
    nicht aus `Accept-Language` gelesen: der Header trägt die
    BROWSER-Einstellung, die Oberfläche folgt aber dem Sprachumschalter
    (dasselbe Muster wie `announcements`).

    `core.languages` führt zwei Namen je Code (deutsch/englisch). Für jede
    andere Oberflächensprache ist Englisch die belegte Fassung — kein
    erfundener Name in einer dritten Sprache (Wurzel 4).
    """
    _ctx, _access = bundle
    basis = basis_sprache(sprache)
    return LanguageOptionList(
        items=[
            LanguageOption(code=c, name=n)
            for c, n in alle_sprachen(sprache="de" if basis == "de" else "en")
        ]
    )


@router.post("/languages", response_model=MessageLanguageList)
def add_message_language(
    req: MessageLanguageAdd, service: InboxServiceDep, bundle: _ConfigDep
) -> MessageLanguageList:
    ctx, _access = bundle
    try:
        return service.add_message_language(ctx, req.code)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/languages/{code}/default", response_model=MessageLanguageList)
def set_default_message_language(
    code: str, service: InboxServiceDep, bundle: _ConfigDep
) -> MessageLanguageList:
    ctx, _access = bundle
    try:
        return service.set_default_message_language(ctx, code)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/languages/{code}", response_model=MessageLanguageList)
def remove_message_language(
    code: str, service: InboxServiceDep, bundle: _ConfigDep
) -> MessageLanguageList:
    ctx, _access = bundle
    try:
        return service.remove_message_language(ctx, code)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/languages/translate", response_model=TranslateFassungResponse)
def translate_fassung(
    req: TranslateFassungRequest, bundle: _ConfigDep
) -> TranslateFassungResponse:
    """Grundfassung maschinell in eine Zielsprache übersetzen (Google v2).

    `_ConfigDep`, nicht `_AccessDep`: der Aufruf kostet Geld beim Dienst und
    liefert Text, der als Gastnachricht hinausgeht. Wer nur lesen darf, löst
    keine kostenpflichtigen Fremdaufrufe aus (Wurzel 9).

    Gespeichert wird NICHTS — die Antwort landet im Editor, der Betreiber prüft
    und speichert selbst.
    """
    _ctx, _access = bundle
    try:
        body, subject = fassung_uebersetzen(
            body=req.body,
            subject=req.subject,
            ziel=req.target,
            format=req.format,
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return TranslateFassungResponse(
        body=body, subject=subject, lang=basis_sprache(req.target) or req.target
    )


# --- Platzhalter (Felder) ----------------------------------------------------
@router.get("/fields", response_model=FieldCatalog)
def field_catalog(bundle: _AccessDep) -> FieldCatalog:
    """Katalog der Platzhalter für den Picker in Vorlagen/Automationen.

    Nur die Schlüssel — die Beschriftung kommt aus den 24 Sprachdateien
    (`inbox.field_*`); ein hier mitgeliefertes deutsches Etikett wäre für einen
    italienischen Betrieb falsch."""
    _ctx, _access = bundle
    return FieldCatalog(
        items=[FieldEntry(key=f.schluessel, group=f.gruppe) for f in FELDER]
    )


@router.post("/{thread_id}/render", response_model=RenderResponse)
def render_text(
    thread_id: str, req: RenderRequest, service: InboxServiceDep, bundle: _AccessDep
) -> RenderResponse:
    """Text mit den Daten DIESER Konversation auflösen (Vorschau beim Einfügen
    einer Vorlage), damit niemand `{{guest_name}}` an einen Gast schickt."""
    ctx, _access = bundle
    try:
        return RenderResponse(text=service.render_for_thread(ctx, thread_id, req.text))
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Anhänge -----------------------------------------------------------------
@router.get("/{thread_id}/attachments", response_model=AttachmentList)
def list_attachments(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> AttachmentList:
    ctx, _access = bundle
    try:
        return service.list_attachments(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/attachments", response_model=Attachment)
async def add_attachment(
    thread_id: str, request: Request, service: InboxServiceDep, bundle: _AccessDep
) -> Attachment:
    """Datei an die Konversation hängen und an den Kanal übergeben.

    Der Dateityp wird im Service über die Magic-Bytes entschieden, nicht über
    den mitgeschickten content_type (Wurzel 8)."""
    ctx, _access = bundle
    content, _content_type = await read_upload(request)
    filename = request.query_params.get("filename") or "anhang"
    message = request.query_params.get("message") or None
    try:
        return service.add_attachment(
            ctx, thread_id, content=content, filename=filename, message=message
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    ctx, _access = bundle
    try:
        service.delete_attachment(ctx, attachment_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- KI-Wissensdatenbank ------------------------------------------------------
# Die Fakten enthalten typischerweise WLAN-Passwort und Schlüsselversteck →
# Lesen wie Schreiben nur mit INBOX_MANAGE_CONFIG, nicht für jeden mit
# Posteingang-Zugriff (Wurzel 9: kein Datenausgang an Rollen, die ihn nicht
# brauchen). Der KI-Vorschlag selbst nutzt sie serverseitig weiter.
@router.get("/knowledge", response_model=KnowledgeFactList)
def list_knowledge(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    property_id: Annotated[str | None, Query()] = None,
) -> KnowledgeFactList:
    ctx, _access = bundle
    try:
        return service.list_knowledge(ctx, property_id=property_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/knowledge", response_model=KnowledgeFact)
def create_knowledge(
    req: KnowledgeFactUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> KnowledgeFact:
    ctx, _access = bundle
    try:
        return service.create_knowledge(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/knowledge/{fact_id}", response_model=KnowledgeFact)
def update_knowledge(
    fact_id: str, req: KnowledgeFactUpsert, service: InboxServiceDep,
    bundle: _ConfigDep,
) -> KnowledgeFact:
    ctx, _access = bundle
    try:
        return service.update_knowledge(ctx, fact_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/knowledge/{fact_id}", status_code=204)
def delete_knowledge(
    fact_id: str, service: InboxServiceDep, bundle: _ConfigDep
) -> None:
    ctx, _access = bundle
    try:
        service.delete_knowledge(ctx, fact_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
