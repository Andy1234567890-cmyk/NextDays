"""Router für das Plattform-Backoffice. Gemountet unter /api/v1/platform.

ACHTUNG — Sonderstellung: Dies ist der einzige Router, dessen Endpunkte bewusst
MANDANTENÜBERGREIFEND arbeiten. Jeder Endpunkt hier MUSS
`CurrentPlatformAdmin` verwenden (nie `CurrentUser`) und schreibende Aktionen
zusätzlich `require_platform_write`. Ein Endpunkt ohne diesen Guard wäre ein
Totalausfall der Mandantentrennung.

Jede Aktion wird protokolliert (audit.record) — auch lesende.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from src.core.security import CurrentPlatformAdmin, require_platform_write

from .dependencies import DeployServiceDep, PlatformAdminServiceDep, TeamServiceDep
from .schemas import (
    AuditList,
    BuchungDetail,
    BuchungList,
    DeployUebersicht,
    DeployVerlauf,
    FinanzUebersicht,
    ModerationDecision,
    ModerationList,
    ModerationProperty,
    PlatformGuestList,
    PlatformMe,
    PlatformOk,
    PlatformUserList,
    SteuerUebersicht,
    SupportMessage,
    SupportReply,
    SupportTicket,
    SupportTicketDetail,
    SupportTicketList,
    SupportTicketUpdate,
    TeamInvite,
    TeamInviteAccept,
    TeamInviteResult,
    TeamList,
    TeamMember,
    TeamPasswordResetConfirm,
    TeamPasswordResetRequest,
    TeamPasswordResetResponse,
    TeamUpdate,
    TenantDetail,
    TenantList,
    VorgangList,
)
from .team_service import TeamError

router = APIRouter(prefix="/platform", tags=["platform-admin"])


@router.get("/me", response_model=PlatformMe)
def get_me(
    ctx: CurrentPlatformAdmin, service: PlatformAdminServiceDep
) -> PlatformMe:
    """Identität + Rolle des eingeloggten Backoffice-Nutzers.

    Bewusst NICHT protokolliert: der Aufruf erfolgt bei jedem Seitenaufbau und
    greift auf keine Mandantendaten zu — er würde das Protokoll nur fluten.
    """
    return service.me(ctx)


@router.get("/audit", response_model=AuditList)
def list_audit(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = None,
    tenant_id: str | None = None,
    actor_user_id: str | None = None,
) -> AuditList:
    """Backoffice-Protokoll lesen (neueste zuerst), optional gefiltert."""
    result = service.audit(
        limit=limit,
        offset=offset,
        action=action,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
    )
    # Auch der Blick ins Protokoll wird protokolliert (Vier-Augen-Prinzip).
    service.log_action(
        ctx,
        "audit.view",
        detail={"limit": limit, "offset": offset},
        request=request,
    )
    return result


@router.get("/tenants", response_model=TenantList)
def list_tenants(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    suche: str | None = None,
) -> TenantList:
    """Alle Betriebe der Plattform (neueste zuerst)."""
    result = service.tenants(limit=limit, offset=offset, suche=suche)
    service.log_action(
        ctx,
        "tenant.list",
        detail={"limit": limit, "offset": offset, "suche": suche},
        request=request,
    )
    return result


@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
def get_tenant(
    tenant_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> TenantDetail:
    """Ein Betrieb im Detail inkl. Zahlungs-/Abo-Status."""
    result = service.tenant(tenant_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Betrieb nicht gefunden."
        )
    # Der Blick in EINEN Betrieb ist der eigentlich schützenswerte Vorgang —
    # deshalb mit tenant_id protokolliert ("wer hat in MEINE Daten geschaut").
    service.log_action(
        ctx,
        "tenant.view",
        target_type="tenant",
        target_id=tenant_id,
        tenant_id=tenant_id,
        request=request,
    )
    return result


@router.get("/users", response_model=PlatformUserList)
def list_users(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str | None = None,
) -> PlatformUserList:
    """Betriebs-Nutzer (Supply-Seite), neueste zuerst."""
    result = service.users(limit=limit, offset=offset, tenant_id=tenant_id)
    service.log_action(
        ctx,
        "user.list",
        tenant_id=tenant_id,
        detail={"limit": limit, "offset": offset},
        request=request,
    )
    return result


@router.get("/guests", response_model=PlatformGuestList)
def list_guests(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    suche: str | None = None,
) -> PlatformGuestList:
    """Plattform-Gäste (Demand-Seite, portal_guests), neueste zuerst."""
    result = service.guests(limit=limit, offset=offset, suche=suche)
    service.log_action(
        ctx,
        "guest.list",
        detail={"limit": limit, "offset": offset, "suche": suche},
        request=request,
    )
    return result


@router.get("/moderation", response_model=ModerationList)
def moderation_queue(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    status_filter: str = Query("pending", pattern="^(draft|pending|approved|rejected)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ModerationList:
    """Freigabe-Warteschlange für den eigenen Marktplatz.

    Standard: die wartenden Objekte, älteste Einreichung zuerst.
    """
    result = service.moderation_queue(
        status_filter=status_filter, limit=limit, offset=offset
    )
    service.log_action(
        ctx,
        "moderation.list",
        detail={"status": status_filter, "limit": limit, "offset": offset},
        request=request,
    )
    return result


@router.post("/moderation/{property_id}/approve", response_model=ModerationProperty)
def approve_property(
    property_id: str,
    entscheidung: ModerationDecision,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> ModerationProperty:
    """Ein Objekt für den Marktplatz freigeben. Nur platform_admin."""
    require_platform_write(ctx)
    result = service.decide(
        property_id,
        approve=True,
        reviewer_user_id=ctx.user_id,
        note=entscheidung.note,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objekt nicht gefunden."
        )
    service.log_action(
        ctx,
        "property.approve",
        target_type="property",
        target_id=property_id,
        tenant_id=result.tenant_id,
        detail={"note": entscheidung.note},
        request=request,
    )
    return result


@router.post("/moderation/{property_id}/reject", response_model=ModerationProperty)
def reject_property(
    property_id: str,
    entscheidung: ModerationDecision,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> ModerationProperty:
    """Ein Objekt ablehnen. Nur platform_admin.

    Die Begründung ist PFLICHT: sie wird dem Gastgeber angezeigt, damit er
    nachbessern kann. Eine wortlose Ablehnung wäre für ihn nicht handhabbar.
    """
    require_platform_write(ctx)
    if not (entscheidung.note or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Bitte einen Ablehnungsgrund angeben.",
        )
    result = service.decide(
        property_id,
        approve=False,
        reviewer_user_id=ctx.user_id,
        note=entscheidung.note,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objekt nicht gefunden."
        )
    service.log_action(
        ctx,
        "property.reject",
        target_type="property",
        target_id=property_id,
        tenant_id=result.tenant_id,
        detail={"note": entscheidung.note},
        request=request,
    )
    return result


@router.get("/finanzen", response_model=FinanzUebersicht)
def finanzen(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
) -> FinanzUebersicht:
    """Finanzsicht des Betreibers: Provisionen je Währung, jüngste Buchungen,
    Onboarding-Rückstand (Betriebe ohne Zahlungsfreigabe) und Abo-Verteilung."""
    result = service.finanzen(limit=limit)
    service.log_action(ctx, "finanzen.view", request=request)
    return result


# --- Backoffice-Team ---------------------------------------------------------
#
# Wer hier Zugriff bekommt, sieht ALLE Mandanten. Deshalb: Lesen für das ganze
# Backoffice, JEDE Änderung nur mit require_platform_write, und alles im
# Protokoll. Der Aussperr-Schutz (keine Selbst-Änderung, letzter Admin bleibt)
# sitzt im Service, damit er auch für künftige Aufrufer gilt.


def _map_team(exc: TeamError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/team", response_model=TeamList)
def list_team(
    ctx: CurrentPlatformAdmin,
    service: TeamServiceDep,
    haupt: PlatformAdminServiceDep,
    request: Request,
) -> TeamList:
    """Alle Backoffice-Zugänge (auch entzogene — sie sind die Historie)."""
    try:
        result = service.list()
    except TeamError as exc:
        raise _map_team(exc) from exc
    haupt.log_action(ctx, "team.list", request=request)
    return result


@router.post(
    "/team", response_model=TeamInviteResult, status_code=status.HTTP_201_CREATED
)
def invite_team_member(
    req: TeamInvite,
    ctx: CurrentPlatformAdmin,
    service: TeamServiceDep,
    haupt: PlatformAdminServiceDep,
    request: Request,
) -> TeamInviteResult:
    """Kolleg:in einladen oder ein bestehendes Konto freischalten."""
    require_platform_write(ctx)
    try:
        result = service.invite(req, actor=ctx)
    except TeamError as exc:
        raise _map_team(exc) from exc
    haupt.log_action(
        ctx,
        "team.invite",
        target_type="platform_admin",
        target_id=result.member.user_id,
        detail={"role": req.platform_role, "ergebnis": result.ergebnis},
        request=request,
    )
    return result


@router.patch("/team/{user_id}", response_model=TeamMember)
def update_team_member(
    user_id: str,
    req: TeamUpdate,
    ctx: CurrentPlatformAdmin,
    service: TeamServiceDep,
    haupt: PlatformAdminServiceDep,
    request: Request,
) -> TeamMember:
    """Rolle, Notiz oder Aktiv-Status eines Zugangs ändern."""
    require_platform_write(ctx)
    try:
        result = service.update(user_id, req, actor=ctx)
    except TeamError as exc:
        raise _map_team(exc) from exc
    haupt.log_action(
        ctx,
        "team.update",
        target_type="platform_admin",
        target_id=user_id,
        detail=req.model_dump(exclude_none=True),
        request=request,
    )
    return result


@router.post("/team/accept", response_model=PlatformOk)
def accept_team_invite(
    req: TeamInviteAccept, service: TeamServiceDep
) -> PlatformOk:
    """Einladung annehmen und eigenes Passwort setzen.

    Bewusst OHNE Guard: die eingeladene Person hat noch keine Sitzung. Der
    Einmal-Token IST die Berechtigung — er ist nur als Hash gespeichert, 72 h
    gültig und danach verbraucht. Fehlerfälle antworten absichtlich gleich,
    damit die Existenz eines Tokens nicht ableitbar ist.
    """
    try:
        service.accept(req)
    except TeamError as exc:
        raise _map_team(exc) from exc
    return PlatformOk()


@router.post("/team/passwort-vergessen", response_model=TeamPasswordResetResponse)
def request_password_reset(
    req: TeamPasswordResetRequest, service: TeamServiceDep
) -> TeamPasswordResetResponse:
    """Reset-Link an ein Backoffice-Konto schicken (öffentlich).

    Bewusst OHNE Guard — wer sein Passwort vergessen hat, kann sich nicht
    anmelden. Die Antwort ist IMMER dieselbe: ein unterscheidbarer Fehler wäre
    ein Verzeichnis der Betreiber-Zugänge (Wurzel 3/9). Deshalb wird hier auch
    keine Ausnahme gemappt — der Service beantwortet jeden Abbruch neutral und
    protokolliert ihn. Ratelimit: strenger `auth`-Bucket (Wurzel 8), zusätzlich
    eine Sperrfrist je Konto gegen Mail-Bombardement.

    Nicht protokolliert im Backoffice-Audit: dort gibt es keinen Akteur, und
    schon der Eintrag würde verraten, welche Adresse ein Konto hat.
    """
    return TeamPasswordResetResponse(
        message=service.passwort_reset_anfordern(req)
    )


@router.post("/team/passwort-neu", response_model=PlatformOk)
def confirm_password_reset(
    req: TeamPasswordResetConfirm, service: TeamServiceDep
) -> PlatformOk:
    """Neues Passwort über den Link aus der Mail setzen (öffentlich).

    Der Einmal-Token IST die Berechtigung: nur als Hash gespeichert, eine Stunde
    gültig, danach verbraucht. Alle Fehlerfälle antworten gleich. Nach dem
    Wechsel widerruft der Service jede Sitzung des Kontos.
    """
    try:
        service.passwort_neu_setzen(req)
    except TeamError as exc:
        raise _map_team(exc) from exc
    return PlatformOk()


# --- Support -----------------------------------------------------------------


@router.get("/support", response_model=SupportTicketList)
def list_tickets(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    status_filter: str | None = Query(
        None, pattern="^(open|waiting|resolved|closed)$"
    ),
    source: str | None = Query(None, pattern="^(form|chat)$"),
    mine: bool = Query(False, description="Nur mir zugewiesene Konversationen."),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> SupportTicketList:
    """Support-Konversationen, zuletzt aktive zuerst."""
    result = service.tickets(
        status_filter=status_filter,
        source=source,
        assignee_user_id=ctx.user_id if mine else None,
        limit=limit,
        offset=offset,
    )
    service.log_action(
        ctx, "support.list", detail={"status": status_filter}, request=request
    )
    return result


@router.get("/support/{ticket_id}", response_model=SupportTicketDetail)
def get_ticket(
    ticket_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> SupportTicketDetail:
    """Ein Ticket mit vollem Verlauf (im Backoffice inkl. interner Notizen)."""
    result = service.ticket(ticket_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    service.log_action(
        ctx,
        "support.view",
        target_type="ticket",
        target_id=ticket_id,
        tenant_id=result.tenant_id,
        request=request,
    )
    return result


@router.post("/support/{ticket_id}/reply", response_model=SupportMessage)
def reply_ticket(
    ticket_id: str,
    antwort: SupportReply,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> SupportMessage:
    """Antworten oder eine interne Notiz anhängen.

    Bewusst OHNE require_platform_write: Support-Bearbeitung ist genau die
    Aufgabe der Rolle platform_support. Freigaben und Sperren bleiben ihr
    verwehrt.
    """
    result = service.reply(
        ticket_id,
        author_user_id=ctx.user_id,
        body=antwort.body,
        internal=antwort.internal,
        client_msg_id=antwort.client_msg_id,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    service.log_action(
        ctx,
        "support.reply",
        target_type="ticket",
        target_id=ticket_id,
        detail={"internal": antwort.internal},
        request=request,
    )
    return result


@router.post("/support/{ticket_id}/read", response_model=PlatformOk)
def mark_ticket_read(
    ticket_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
) -> PlatformOk:
    """Lese-Cursor des Teams setzen (Konversation geöffnet).

    Bewusst OHNE Audit-Eintrag: das Öffnen protokolliert bereits
    `support.view`; ein zweiter Eintrag pro Scroll-Vorgang würde das Protokoll
    zumüllen, ohne etwas Neues auszusagen.
    """
    if not service.mark_ticket_read(ticket_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    return PlatformOk()


@router.patch("/support/{ticket_id}", response_model=SupportTicket)
def update_ticket(
    ticket_id: str,
    patch: SupportTicketUpdate,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> SupportTicket:
    """Status, Priorität oder Zuweisung ändern."""
    result = service.update_ticket(
        ticket_id,
        {
            "status": patch.status,
            "priority": patch.priority,
            "assignee_user_id": patch.assignee_user_id,
        },
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket nicht gefunden."
        )
    service.log_action(
        ctx,
        "support.update",
        target_type="ticket",
        target_id=ticket_id,
        detail=patch.model_dump(exclude_none=True),
        request=request,
    )
    return result


# --- Technische Diagnose (nur bei Freigabe des Kunden) -----------------------


@router.get("/diagnostics/sessions")
def active_debug_sessions(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> list[dict]:
    """Laufende Diagnose-Freigaben — die Arbeitsliste des Supports.

    Zeigt NUR Konten, die dem Support aktiv Einsicht gewährt haben. Es gibt
    keinen Weg, sich diese Einsicht selbst zu verschaffen.
    """
    from src.features.diagnostics.service import DiagnosticsService

    result = DiagnosticsService(db=service.db).active_sessions()
    service.log_action(ctx, "diagnostics.sessions", request=request)
    return [s.model_dump(mode="json") for s in result]


@router.get("/diagnostics/sessions/{session_id}")
def session_events(
    session_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
) -> dict:
    """Technische Ereignisse einer Freigabe.

    Der Service begrenzt auf das Freigabefenster und liefert nichts, sobald
    die Freigabe abgelaufen oder widerrufen ist. Der Zugriff wird protokolliert
    — der Kunde muss nachvollziehen können, wer in seine Diagnose geschaut hat.
    """
    from src.features.diagnostics.service import DiagnosticsService

    result = DiagnosticsService(db=service.db).events_for_session(
        session_id, limit=limit
    )
    service.log_action(
        ctx,
        "diagnostics.view",
        target_type="debug_session",
        target_id=session_id,
        request=request,
    )
    return result.model_dump(mode="json")


@router.get("/tenants/{tenant_id}/vorgaenge", response_model=VorgangList)
def tenant_vorgaenge(
    tenant_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
) -> VorgangList:
    """Fachliche Vorgangshistorie eines Betriebs.

    Führt bestehende Protokolle zusammen (Buchungen, Stornierungen,
    Anmeldungen, Zuweisungen) — es wird nichts zusätzlich aufgezeichnet.
    Der Zugriff wird protokolliert: der Betrieb muss nachvollziehen können,
    wer in seine Historie geschaut hat.
    """
    result = service.vorgaenge(tenant_id, limit=limit)
    service.log_action(
        ctx,
        "tenant.vorgaenge",
        target_type="tenant",
        target_id=tenant_id,
        tenant_id=tenant_id,
        request=request,
    )
    return result


@router.get("/steuern", response_model=SteuerUebersicht)
def get_steuern(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    nur_luecken: bool = False,
) -> SteuerUebersicht:
    """Steuerlicher Compliance-Stand aller Betriebe.

    Die Pflicht des Betreibers, das zu überwachen, folgt aus § 23 PStTG; das
    Unterlassen ist bußgeldbewehrt (§ 25 Abs. 1 Nr. 6). Diese Sicht ist die
    Kontrolle dazu.
    """
    result = service.steuer_uebersicht(nur_luecken=nur_luecken)
    service.log_action(
        ctx,
        "steuern.view",
        detail={
            "nur_luecken": nur_luecken,
            "betriebe": result.betriebe_gesamt,
            "mit_luecke": result.betriebe_mit_luecke,
        },
        request=request,
    )
    return result


@router.get("/buchungen", response_model=BuchungList)
def list_buchungen(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = None,
    channel: str | None = None,
    tenant_id: str | None = None,
    suche: str | None = None,
) -> BuchungList:
    """Alle Buchungen der Plattform, neueste zuerst."""
    result = service.buchungen(
        limit=limit,
        offset=offset,
        status_filter=status_filter,
        channel=channel,
        tenant_id=tenant_id,
        suche=suche,
    )
    service.log_action(
        ctx,
        "buchung.list",
        detail={
            "limit": limit,
            "offset": offset,
            "status": status_filter,
            "channel": channel,
            "suche": suche,
        },
        tenant_id=tenant_id,
        request=request,
    )
    return result


@router.get("/buchungen/{reservation_id}", response_model=BuchungDetail)
def get_buchung(
    reservation_id: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    request: Request,
) -> BuchungDetail:
    """Eine Buchung mit beiden Seiten: Betrieb/Objekt und Gast/Zahlung."""
    result = service.buchung(reservation_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Buchung nicht gefunden."
        )
    # Mit tenant_id protokolliert: hier werden Kontaktdaten eines fremden
    # Mandanten sichtbar — genau der Vorgang, den ein Betrieb nachvollziehen
    # können muss.
    service.log_action(
        ctx,
        "buchung.view",
        target_type="reservation",
        target_id=reservation_id,
        tenant_id=result.tenant_id,
        request=request,
    )
    return result


# --- Deploy-Monitor -------------------------------------------------------
# Quelle ist Coolify, nicht unsere DB. Lesen darf jeder im Backoffice (auch
# platform_support: sehen, ob ein Ausrollen läuft, hilft bei jeder Störung);
# AUSLÖSEN nur platform_admin (require_platform_write).


@router.get("/deploy", response_model=DeployUebersicht)
def deploy_uebersicht(
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    deploy: DeployServiceDep,
    request: Request,
) -> DeployUebersicht:
    """Je überwachter Anwendung der laufende bzw. letzte Deploy."""
    ergebnis = deploy.uebersicht()
    service.log_action(ctx, "deploy.view", request=request)
    return ergebnis


@router.get("/deploy/{anwendung_uuid}", response_model=DeployVerlauf)
def deploy_verlauf(
    anwendung_uuid: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    deploy: DeployServiceDep,
    request: Request,
    limit: int = Query(20, ge=1, le=100),
) -> DeployVerlauf:
    """Die letzten Deploys EINER Anwendung, neueste zuerst."""
    ergebnis = deploy.verlauf(anwendung_uuid, limit=limit)
    service.log_action(
        ctx,
        "deploy.history",
        target_type="application",
        target_id=anwendung_uuid,
        request=request,
    )
    return ergebnis


@router.post("/deploy/{anwendung_uuid}", response_model=PlatformOk)
def deploy_ausloesen(
    anwendung_uuid: str,
    ctx: CurrentPlatformAdmin,
    service: PlatformAdminServiceDep,
    deploy: DeployServiceDep,
    request: Request,
) -> PlatformOk:
    """Einen Deploy anstoßen. Rollt LIVE aus — deshalb nur platform_admin."""
    require_platform_write(ctx)
    deploy.ausloesen(anwendung_uuid)
    service.log_action(
        ctx,
        "deploy.trigger",
        target_type="application",
        target_id=anwendung_uuid,
        request=request,
    )
    return PlatformOk()
