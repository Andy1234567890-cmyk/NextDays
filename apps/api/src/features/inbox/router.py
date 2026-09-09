"""Router für inbox. Gemountet unter /api/v1/inbox."""
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)

from src.core.languages import alle_sprachen, basis_sprache
from src.core.security import AuthContext, get_current_user, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.core.uploads import read_upload
from src.features.owner_chat import kern as owner_chat_kern
from src.features.owner_chat import melden as owner_chat_melden
from src.features.owner_chat.fehler import OwnerChatError
from src.features.owner_chat.schemas import (
    ChatNachricht,
    ChatVerlauf,
    EmpfaengerGeraet,
    EmpfaengerListe,
    NachrichtSenden,
)

from . import eigentuemer
from .authz import InboxAccess
from .fassung_uebersetzen import fassung_uebersetzen
from .felder import FELDER, FeldFehlt
from .schemas import (
    AiReplyResponse,
    AiSettings,
    AnfrageDetail,
    AnfrageEntscheidung,
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
    KiEskalationList,
    KiKontextAntwort,
    KiProtokollList,
    KiRegel,
    KiRegelList,
    KiRegelUpsert,
    KiTestAntwort,
    KiTestFrage,
    KnowledgeBulkDelete,
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
    WissenImportUebernehmen,
    WissenImportVorschau,
    WissenObjektListe,
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


@router.post("/internal/dispatch-ki-autoantworten", include_in_schema=False)
def dispatch_ki_autoantworten(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict:
    """Interner Cron-Trigger: versendet fällige KI-Autoantworten (0494).

    Eigener Tick und nicht Teil von `/dispatch-automations`: die beiden haben
    verschiedene Taktungen. Eine Automail ist auf den Tag geplant, eine
    KI-Antwort auf die Minute — die Verzögerung von standardmäßig fünf Minuten
    wäre bei einem Viertelstundentakt keine Verzögerung mehr, sondern eine
    Zufallszahl zwischen fünf und zwanzig Minuten.

    Empfohlener Takt: jede Minute.
    """
    require_internal_cron_secret(x_internal_cron_secret)
    return InboxService(
        service_client=get_service_client()
    ).dispatch_ki_autoantworten()


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


@router.get("/{thread_id}/anfrage", response_model=AnfrageDetail)
def get_anfrage(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> AnfrageDetail:
    """Die Anfrage-Karte über dem Chat (Frist, Betrag, mögliche Aktionen)."""
    ctx, _access = bundle
    try:
        return service.anfrage_detail(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{thread_id}/anfrage/entscheiden")
def entscheide_anfrage(
    thread_id: str,
    req: AnfrageEntscheidung,
    service: InboxServiceDep,
    bundle: _AccessDep,
) -> dict:
    """Eine Airbnb-Anfrage annehmen, ablehnen oder vorab genehmigen.

    Geht an Airbnb, nicht nur in unsere Tabelle — die lokale Quittung allein
    ließe den Gast bis zum Auto-Decline warten.
    """
    ctx, _access = bundle
    try:
        return service.anfrage_entscheiden(ctx, thread_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


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
@router.get("/knowledge/objekte", response_model=WissenObjektListe)
def wissen_objekte(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    suche: Annotated[str | None, Query(max_length=200)] = None,
    sortierung: Annotated[str, Query()] = "objekt",
    absteigend: Annotated[bool, Query()] = False,
    seite: Annotated[int, Query(ge=1, le=1000)] = 1,
    pro_seite: Annotated[int, Query(ge=1, le=100)] = 20,
) -> WissenObjektListe:
    """Ebene 1: die Objekte mit ihrer Faktenzahl."""
    ctx, _access = bundle
    try:
        return service.wissen_objekte(
            ctx,
            suche=suche,
            sortierung=sortierung,
            absteigend=absteigend,
            seite=seite,
            pro_seite=pro_seite,
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/knowledge", response_model=KnowledgeFactList)
def list_knowledge(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    property_id: Annotated[str | None, Query()] = None,
    nur_dieses_objekt: Annotated[bool, Query()] = False,
    betriebsweit: Annotated[bool, Query()] = False,
    suche: Annotated[str | None, Query(max_length=200)] = None,
    kategorie: Annotated[list[str] | None, Query()] = None,
    quelle: Annotated[list[str] | None, Query()] = None,
    sortierung: Annotated[str, Query()] = "geaendert",
    absteigend: Annotated[bool, Query()] = True,
    seite: Annotated[int, Query(ge=1, le=1000)] = 1,
    pro_seite: Annotated[int, Query(ge=1, le=100)] = 20,
) -> KnowledgeFactList:
    ctx, _access = bundle
    try:
        return service.list_knowledge(
            ctx,
            property_id=property_id,
            nur_dieses_objekt=nur_dieses_objekt,
            betriebsweit=betriebsweit,
            suche=suche,
            kategorien=kategorie,
            quellen=quelle,
            sortierung=sortierung,
            absteigend=absteigend,
            seite=seite,
            pro_seite=pro_seite,
        )
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


# --- Eskalation (0498) --------------------------------------------------------
@router.get("/ki-eskalationen", response_model=KiEskalationList)
def eskalationen_offen(
    service: InboxServiceDep, bundle: _AccessDep
) -> KiEskalationList:
    """Die Ansicht „Eskaliert": alle offenen, neueste zuerst."""
    ctx, _access = bundle
    try:
        return service.eskalationen_offen(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/ki-eskalationen/{thread_id}/erledigt", status_code=204)
def eskalation_erledigen(
    thread_id: str, service: InboxServiceDep, bundle: _AccessDep
) -> None:
    """Die Eskalation zurücknehmen. Nur ein Mensch kann das."""
    ctx, _access = bundle
    try:
        service.eskalation_erledigen(ctx, thread_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Test-KI und Kontext-Panel ------------------------------------------------
# Beide SENDEN NICHTS. Sie zeigen, was die KI weiß und was sie im Ernstfall
# täte — ohne diese Ansichten ist eine falsche Antwort nicht diagnostizierbar.
@router.get("/ki-kontext", response_model=KiKontextAntwort)
def ki_kontext_ansehen(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    property_id: Annotated[str | None, Query()] = None,
    frage: Annotated[str, Query(max_length=1500)] = "",
) -> KiKontextAntwort:
    ctx, _access = bundle
    try:
        return service.ki_kontext_ansehen(ctx, property_id=property_id, frage=frage)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/ki-test", response_model=KiTestAntwort)
def ki_testen(
    req: KiTestFrage, service: InboxServiceDep, bundle: _ConfigDep
) -> KiTestAntwort:
    """Eine Testfrage an die KI. Es geht NICHTS an einen Gast."""
    ctx, _access = bundle
    try:
        return service.ki_testen(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- PDF-Import in die Wissensdatenbank ---------------------------------------
# ZWEISTUFIG: dieser Endpunkt LEGT KEINE FAKTEN AN. Er legt die Datei ab und
# liefert Vorschläge; erst `/knowledge/import/apply` schreibt, und zwar nur,
# was ein Mensch angehakt hat. Ein Dokument, das ungeprüft einfliesst, macht
# die KI zur Sprecherin eines Textes, den niemand gelesen hat.
@router.post("/knowledge/import", response_model=WissenImportVorschau)
async def wissen_dokument_lesen(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    file: Annotated[UploadFile, File()],
    property_id: Annotated[str | None, Form()] = None,
) -> WissenImportVorschau:
    ctx, _access = bundle
    inhalt = await file.read()
    try:
        return service.wissen_dokument_lesen(
            ctx,
            inhalt=inhalt,
            dateiname=file.filename or "dokument.pdf",
            property_id=property_id or None,
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/knowledge/import/apply", response_model=BulkUpdateResult)
def wissen_import_uebernehmen(
    req: WissenImportUebernehmen, service: InboxServiceDep, bundle: _ConfigDep
) -> BulkUpdateResult:
    """Die angehakten Vorschläge als Fakten anlegen."""
    ctx, _access = bundle
    try:
        return BulkUpdateResult(
            updated=service.wissen_import_uebernehmen(
                ctx,
                quelle_id=req.quelle_id,
                items=req.items,
                property_id=req.property_id,
            )
        )
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# Eigener POST statt DELETE mit Rumpf: DELETE-Anfragen mit Body sind zwar
# erlaubt, werden aber von Proxys und fetch-Wrappern unterschiedlich behandelt.
@router.post("/knowledge/bulk-delete", response_model=BulkUpdateResult)
def delete_knowledge_bulk(
    req: KnowledgeBulkDelete, service: InboxServiceDep, bundle: _ConfigDep
) -> BulkUpdateResult:
    """Sammellöschen aus der Mehrfachauswahl der Faktenliste."""
    ctx, _access = bundle
    try:
        return BulkUpdateResult(updated=service.delete_knowledge_bulk(ctx, req.ids))
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- KI-Regeln (0493) -------------------------------------------------------
# `_ConfigDep` durchgehend, auch beim Lesen: eine Regel sagt aus, was die KI
# ohne menschliche Prüfung an Gäste schreiben darf. Das ist eine
# Konfigurationsfrage des Betriebs, keine Auskunft für jeden mit
# Posteingang-Zugriff (Wurzel 9 — derselbe Scope für Liste und Einzelzugriff).
@router.get("/ki-regeln", response_model=KiRegelList)
def list_ki_regeln(service: InboxServiceDep, bundle: _ConfigDep) -> KiRegelList:
    ctx, _access = bundle
    try:
        return service.list_ki_regeln(ctx)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/ki-regeln", response_model=KiRegel)
def create_ki_regel(
    req: KiRegelUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> KiRegel:
    ctx, _access = bundle
    try:
        return service.create_ki_regel(ctx, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/ki-regeln/{regel_id}", response_model=KiRegel)
def update_ki_regel(
    regel_id: str, req: KiRegelUpsert, service: InboxServiceDep, bundle: _ConfigDep
) -> KiRegel:
    ctx, _access = bundle
    try:
        return service.update_ki_regel(ctx, regel_id, req)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/ki-regeln/{regel_id}", status_code=204)
def delete_ki_regel(
    regel_id: str, service: InboxServiceDep, bundle: _ConfigDep
) -> None:
    ctx, _access = bundle
    try:
        service.delete_ki_regel(ctx, regel_id)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/ki-protokoll", response_model=KiProtokollList)
def list_ki_protokoll(
    service: InboxServiceDep,
    bundle: _ConfigDep,
    thread_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> KiProtokollList:
    """Was die KI getan hat — die Spur zu einer falschen Antwort.

    Ohne diese Liste bliebe bei einer falschen Antwort nur das Raten zwischen
    „Fakt fehlte", „Regel griff nicht" und „Modell hat sich etwas
    zurechtgelegt".
    """
    ctx, _access = bundle
    try:
        return service.list_ki_protokoll(ctx, thread_id=thread_id, limit=limit)
    except InboxError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Eigentümer-Chat: verschlüsselter Sendeweg (0611, ADR-0029) ---------------
#
# EIGENE Endpunkte statt `POST /{thread_id}/messages`: Eine Ende-zu-Ende
# verschlüsselte Nachricht besteht aus Chiffretext PLUS einem für JEDES
# Empfängergerät verpackten Schlüssel. Der Text-Endpunkt nimmt einen String
# entgegen — ihn hier zu verwenden hieße, serverseitig zu verschlüsseln, also
# genau die Hintertür zu bauen, die ADR-0029 ausschließt.


@router.get("/{thread_id}/chat/empfaenger", response_model=EmpfaengerListe)
def chat_empfaenger(
    thread_id: str, bundle: _AccessDep
) -> EmpfaengerListe:
    """Geräte, für die die Agentur verschlüsseln muss.

    Der SERVER bestimmt den Kreis (Wurzel 3) — käme er vom Client, schriebe
    der sich ein fremdes Gerät in den Verteiler.
    """
    ctx, access = bundle
    if access.scope != "all":
        # Wurzel 9: derselbe Scope wie in der Liste, die diesen Thread bei
        # „assigned" gar nicht zeigt.
        raise HTTPException(status_code=404, detail="Thread nicht gefunden.")
    db = get_service_client()
    try:
        faden = _eig_faden(db, ctx, thread_id)
        zeilen = owner_chat_kern.empfaenger_geraete(
            db, str(ctx.tenant_id), str(faden["property_id"])
        )
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return EmpfaengerListe(
        items=[
            EmpfaengerGeraet(
                device_id=str(z["id"]),
                public_key=str(z["public_key"]),
                seite=str(z["seite"]),
            )
            for z in zeilen
        ]
    )


@router.get("/{thread_id}/chat", response_model=ChatVerlauf)
def chat_verlauf(
    thread_id: str,
    bundle: _AccessDep,
    device_id: Annotated[str | None, Query()] = None,
) -> ChatVerlauf:
    """Verlauf samt den für DIESES Gerät verpackten Schlüsseln."""
    ctx, access = bundle
    if access.scope != "all":
        raise HTTPException(status_code=404, detail="Thread nicht gefunden.")
    db = get_service_client()
    tenant_id = str(ctx.tenant_id)
    try:
        faden = _eig_faden(db, ctx, thread_id)
        roh_id = str(faden["id"])
        zeilen, nicht_lesbar = owner_chat_kern.verlauf_lesen(
            db,
            tenant_id,
            roh_id,
            # Nur das EIGENE Gerät (Wurzel 9).
            device_id=owner_chat_kern.eigenes_geraet(
                db, tenant_id, str(ctx.user_id), device_id
            ),
        )
        owner_chat_kern.gelesen_setzen(db, tenant_id, roh_id, seite="agency")
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return ChatVerlauf(
        thread_id=thread_id,
        property_id=str(faden["property_id"]),
        items=[_eig_nachricht(z) for z in zeilen],
        nicht_lesbar=nicht_lesbar,
    )


@router.post("/{thread_id}/chat", response_model=ChatNachricht, status_code=201)
def chat_senden(
    thread_id: str, req: NachrichtSenden, bundle: _AccessDep
) -> ChatNachricht:
    """Antwort der Agentur im verschlüsselten Eigentümer-Chat."""
    ctx, access = bundle
    if not access.can_reply:
        raise HTTPException(status_code=403, detail="Keine Berechtigung zum Senden.")
    if access.scope != "all":
        raise HTTPException(status_code=404, detail="Thread nicht gefunden.")
    db = get_service_client()
    tenant_id = str(ctx.tenant_id)
    try:
        faden = _eig_faden(db, ctx, thread_id)
        property_id = str(faden["property_id"])
        absender = _eig_absender(db, tenant_id, str(ctx.user_id))
        zeile = owner_chat_kern.nachricht_ablegen(
            db,
            tenant_id,
            str(faden["id"]),
            seite="agency",
            user_id=str(ctx.user_id),
            sender_name=absender,
            chiffre=req.chiffre,
            schluessel=req.schluessel,
            # Der Kreis wird HIER neu bestimmt, nicht vom Client übernommen:
            # kam zwischen Abholen und Senden ein Gerät dazu, fehlt sein
            # Schlüssel und `nachricht_ablegen` antwortet mit 409, statt eine
            # für ihn unlesbare Nachricht abzulegen (Wurzel 5).
            geraete=owner_chat_kern.empfaenger_geraete(db, tenant_id, property_id),
            bilder=req.bilder,
            sender_key=req.sender_key,
        )
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    # NACH dem Ablegen (Wurzel 5): best effort, kippt das Senden nicht.
    owner_chat_melden.neue_nachricht_melden(
        db,
        tenant_id,
        property_id=property_id,
        thread_id=str(faden["id"]),
        message_id=str(zeile["id"]),
        seite="agency",
        absender_name=absender,
        absender_user_id=str(ctx.user_id),
    )
    return _eig_nachricht(zeile)


def _eig_faden(db: object, ctx: AuthContext, thread_id: str) -> dict:
    """`owner_threads`-Zeile zu einer `eig:`-Thread-ID — geladen UND gescopt."""
    if not eigentuemer.ist_eigentuemer_thread(thread_id):
        raise OwnerChatError("Kein Eigentümer-Gespräch.", status_code=404)
    if not ctx.tenant_id:
        raise OwnerChatError("Kein Tenant im Token.", status_code=403)
    roh_id = eigentuemer.thread_aus_id(thread_id)
    zeilen = (
        db.table("owner_threads")  # type: ignore[attr-defined]
        .select("id, property_id")
        .eq("id", roh_id)
        .eq("tenant_id", ctx.tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError("Gespräch nicht gefunden.", status_code=404)
    return zeilen[0]


def _eig_absender(db: object, tenant_id: str, user_id: str) -> str:
    """Name des antwortenden Mitarbeiters, eingefroren an der Nachricht.

    Der Eigentümer soll sehen, MIT WEM er spricht — „die Verwaltung" wäre bei
    einem Team aus vier Leuten keine Auskunft.
    """
    zeilen = (
        db.table("users")  # type: ignore[attr-defined]
        .select("full_name, email")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError("Konto nicht gefunden.", status_code=403)
    # KEIN Rückfall auf die E-Mail (Wurzel 9: kein `email` an Rollen, die es
    # nicht brauchen). Sonst stünde die dienstliche Adresse des Mitarbeiters
    # beim Eigentümer im Verlauf — eingefroren, für immer. Umgekehrt sähe die
    # Agentur die private Adresse eines Familienmitglieds.
    return str(zeilen[0].get("full_name") or "").strip() or "—"


def _eig_nachricht(zeile: dict) -> ChatNachricht:
    return ChatNachricht(
        id=str(zeile["id"]),
        sender=str(zeile.get("sender") or ""),
        sender_name=str(zeile.get("sender_name") or ""),
        chiffre=str(zeile.get("body") or ""),
        sender_key=zeile.get("sender_key") or None,
        wrapped_key=zeile.get("wrapped_key"),
        wrapper_key=zeile.get("wrapper_key") or None,
        bilder=[b for b in (zeile.get("attachments") or []) if isinstance(b, str)],
        sent_at=zeile.get("sent_at"),
    )
