"""Router für tasks. Gemountet unter /api/v1/tasks (Lastenheft §2.5 + §4.3)."""
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
)

from src.core.security import (
    AuthContext,
    get_current_user,
    require_internal_cron_secret,
)
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability, has_capability

from .schemas import (
    BulkAssignRequest,
    BulkTaskRequest,
    ChecklistItemCreate,
    ChecklistItemToggle,
    ChecklistPhotoCreate,
    InspectionDecision,
    InspectionItem,
    InventoryItemCreate,
    RegelDeckung,
    RuleCreate,
    RuleDetail,
    RuleListItem,
    RuleUpdate,
    SliceHealth,
    SubstitutionListItem,
    SubstitutionRequest,
    Task,
    TaskAssigneeOption,
    TaskAssigneeUpdate,
    TaskCalendarResponse,
    TaskCostCreate,
    TaskCreate,
    TaskDetail,
    TaskListItem,
    TaskResolutionUpsert,
    TaskRuleKind,
    TaskStatusUpdate,
    TaskZeitfensterUpdate,
)
from .service import TaskError, TasksService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_tasks_service() -> TasksService:
    return TasksService(client=get_service_client())


TasksServiceDep = Annotated[TasksService, Depends(get_tasks_service)]


def _tenant(ctx: AuthContext) -> str:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Kein Tenant im Token.")
    return ctx.tenant_id


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="tasks")


@router.post("", response_model=Task, status_code=201)
def create_task(
    req: TaskCreate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> Task:
    try:
        return service.create_task(_tenant(ctx), req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _tagesgrenze(wert: str | None) -> datetime | None:
    """Der vom Client gemeldete Beginn seines NÄCHSTEN Tages (ISO-8601).

    Der Client liefert die Grenze, weil nur er weiß, welcher Tag beim Nutzer
    läuft: die Zeitzone hängt am Objekt (`properties.timezone`) und eine Liste
    über mehrere Objekte hat keine einzige richtige — live sind 24 von 43
    Objekten ohne Zeitzone. Eine hier zu unterstellen wäre ein erfundener Wert
    (Wurzel 4).

    Fehlt der Wert, bleibt es beim bisherigen Verhalten (ältere App-Fassungen
    senden ihn nicht). Ein unlesbarer Wert ist dagegen ein Fehler des Aufrufers
    und wird als solcher gemeldet — angreiferkontrollierter Input darf keinen
    500 erzeugen (Wurzel 5), und stillschweigend zu ignorieren hieße, eine
    falsche Liste als richtige auszugeben.
    """
    if not wert:
        return None
    try:
        grenze = datetime.fromisoformat(wert)
    except ValueError as exc:
        raise TaskError(
            "tagesende muss ein ISO-8601-Zeitstempel sein.", status_code=422
        ) from exc
    if grenze.tzinfo is None:
        # Ohne Zonenangabe ließe sich der Wert nicht mit `start_at`/`due_at`
        # (beide zonenbewusst) vergleichen — Python wirft dabei einen
        # TypeError, also ein 500 auf eine Client-Eingabe.
        raise TaskError(
            "tagesende braucht eine Zeitzonenangabe (z. B. +02:00).",
            status_code=422,
        )
    return grenze


@router.get("/mine", response_model=list[TaskListItem])
def my_tasks(
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    status_bucket: str | None = None,
    property_id: Annotated[list[str] | None, Query()] = None,
    tagesende: str | None = None,
) -> list[TaskListItem]:
    """Dieselbe Tabelle wie Teamaufgaben, hart auf den angemeldeten Nutzer
    gescopt (Wurzel 9). Liefert Objekt, Buchungsreferenz und Checklisten-Stand —
    ohne die ist die Liste für eine Reinigungskraft nicht arbeitsfähig."""
    return service.list_own_tasks(
        _tenant(ctx),
        ctx.user_id,
        status_bucket=status_bucket,
        property_ids=property_id,
        ctx=ctx,
        tagesende=_tagesgrenze(tagesende),
    )


@router.get("/by-reservation/{reservation_id}", response_model=list[Task])
def tasks_by_reservation(
    reservation_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_CALENDAR))
    ],
) -> list[Task]:
    """Aufgaben zu einer Buchung (PM-Detailseite). Wer die Buchung sieht, sieht
    ihre Aufgaben — und zwar mit demselben Scope wie der Buchungs-Slice: der
    `ctx` geht mit in den Service, der die Buchung zuerst im Owner-/Staff-Scope
    lädt und sonst 404t (Wurzel 9)."""
    try:
        return service.list_by_reservation(_tenant(ctx), reservation_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{task_id}/status", response_model=TaskDetail)
def update_task_status(
    task_id: str,
    req: TaskStatusUpdate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> TaskDetail:
    """Arbeitszustand setzen: annehmen, anfangen, zurücklegen, abschließen.

    Die Fähigkeit ist seit 0360 `VIEW_OWN_TASKS` statt `MANAGE_TASKS`: den
    Zustand der eigenen Arbeit meldet die Person, die sie tut — eine
    Reinigungskraft, die „ich bin dran" nicht sagen kann, hat den vierten
    Zustand nicht. Der Objekt-Scope kommt weiterhin aus dem Service (`ctx`),
    fremde Aufgaben sind ein 404 (Wurzel 9).

    Das Ziel `done` läuft intern über `complete_task` — samt Foto-Pflicht.
    """
    try:
        return service.set_status(_tenant(ctx), task_id, req.status, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{task_id}/zeitfenster", response_model=TaskDetail)
def update_task_zeitfenster(
    task_id: str,
    req: TaskZeitfensterUpdate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> TaskDetail:
    """Start- und Endzeitpunkt einer Aufgabe von Hand setzen.

    `MANAGE_TASKS` und nicht `VIEW_OWN_TASKS`: den eigenen Arbeitszustand
    meldet die ausführende Person selbst (deshalb ist `/status` offener), aber
    WANN etwas stattfindet, ist Einsatzplanung. Eine Reinigungskraft, die ihre
    Aufgabe auf morgen schöbe, verschöbe damit die Planung des Betriebs.

    Der Objekt-Scope kommt aus dem Service (`ctx`), fremde Aufgaben sind ein
    404 (Wurzel 9).
    """
    try:
        return service.set_zeitfenster(
            _tenant(ctx), task_id, req.start_at, req.end_at, ctx
        )
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{task_id}/assignee", response_model=TaskDetail)
def update_task_assignee(
    task_id: str,
    req: TaskAssigneeUpdate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))
    ],
) -> TaskDetail:
    """Zuständigen einer bestehenden Aufgabe setzen, wechseln oder abziehen.

    `MANAGE_TASKS` und nicht `VIEW_OWN_TASKS`: wer arbeitet, meldet seinen
    Zustand (das ist der Endpunkt darüber) — wer VERTEILT, führt den Betrieb.
    Eine Reinigungskraft, die sich fremde Aufgaben selbst zuschieben kann,
    wäre keine Zuweisung mehr. Ihr Weg heraus ist die Vertretungsanfrage.

    `assignee_id: null` nimmt die Zuweisung zurück — ein gültiger Zielzustand,
    kein fehlender Wert.
    """
    try:
        return service.set_assignee(_tenant(ctx), task_id, req.assignee_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/rules/coverage")
def rule_coverage(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> RegelDeckung:
    """Objekte OHNE wirksame planmäßige Regel — nach An- und Abreise getrennt.

    Damit „für dieses Objekt entsteht nie eine Aufgabe" ein sichtbarer Zustand
    ist und kein stiller. Eine Regel ohne Objekt-Zuordnung gilt für alle
    Objekte; sobald ihr eines zugeordnet ist, nur noch für die gelisteten — ein
    später angelegtes Objekt fällt dann heraus, ohne dass es irgendwo steht.
    """
    return service.regel_deckung(_tenant(ctx))


@router.post("/sync-reservation/{reservation_id}")
def sync_reservation(
    reservation_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> dict[str, int]:
    """Planmäßige Regeln für eine Reservierung nachziehen.

    Der Normalfall läuft automatisch im Reservierungs-Schreibpfad; das hier ist
    der Nachzügler-Knopf für Buchungen, die vor dem Anlegen einer Regel bestanden.
    """
    try:
        return {"touched": service.sync_reservation_tasks(_tenant(ctx), reservation_id)}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/internal/tick", include_in_schema=False)
def internal_tick(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> dict[str, int]:
    """Interner Cron-Trigger: rollt die Regeln über ALLE Tenants aus.

    Zwei Läufe, beide über alle Tenants: die wiederkehrenden Regeln
    materialisieren, und die planmäßigen gegen die Buchungen im Fenster
    abgleichen (der Nachzug für Buchungen, die vor ihrer Regel bestanden).

    Kein JWT — über INTERNAL_CRON_SECRET abgesichert (Wurzel 5: fehlt das
    Secret, wird fail-closed abgewiesen). Derselbe Lauf steckt im Worker-Tick;
    dieser Endpunkt ist die Handkurbel bzw. der Scheduled-Task.
    """
    require_internal_cron_secret(x_internal_cron_secret)
    service = TasksService(client=get_service_client())
    return service.regeln_ausrollen(datetime.now(UTC).date())


@router.post("/checklist/item", status_code=201)
def checklist_item(
    req: ChecklistItemCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_checklist_item(_tenant(ctx), req, ctx).id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/checklist/photo", status_code=201)
def checklist_photo(
    req: ChecklistPhotoCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_checklist_photo(_tenant(ctx), req, ctx)}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/checklist/item/{item_id}/photo", status_code=201)
async def upload_checklist_photo(
    item_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Foto-Nachweis zu einem Checklisten-Punkt hochladen (Multipart → privater
    Bucket task-photos). Der cleaner lädt beim Task-Abschluss das Pflicht-Foto."""
    content = await file.read()
    try:
        photo_id = service.upload_checklist_photo(
            _tenant(ctx), item_id, content, file.content_type or "", ctx
        )
        return {"id": photo_id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/photo", status_code=201)
async def upload_task_photo(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.VIEW_OWN_TASKS))
    ],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Foto direkt an einer Aufgabe hochladen (ohne konkretes Checklisten-Item)
    → erscheint als Buchungsbild im Bilder-Modul."""
    content = await file.read()
    try:
        photo_id = service.upload_task_photo(
            _tenant(ctx), task_id, content, file.content_type or "", ctx
        )
        return {"id": photo_id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/substitution", status_code=201)
def request_substitution(
    req: SubstitutionRequest,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> dict[str, str]:
    try:
        sub = service.request_substitution(_tenant(ctx), ctx.user_id, req)
        return {"id": sub.id, "status": sub.status.value}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/substitution/{substitution_id}/accept")
def accept_substitution(
    substitution_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> dict[str, str]:
    """Eine Vertretungsanfrage annehmen — die Aufgabe wechselt dabei zu mir.

    Ohne diesen Endpunkt war das Feature eine Sackgasse: eine Vertretung ließ
    sich anfragen, aber von niemandem annehmen. Dieselbe Fähigkeit wie das
    Anfragen — wer vertreten werden darf, darf auch vertreten.

    Bis 17.08.2026 quittierte die Annahme nur die Anfrage und ließ die Aufgabe
    beim Vertretenen stehen; seither schreibt sie `tasks.assignee_id` mit um.
    """
    try:
        sub = service.accept_substitution(
            _tenant(ctx), substitution_id, ctx.user_id, ctx
        )
        return {"id": sub.id, "status": sub.status.value}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/substitution/{substitution_id}/decline")
def decline_substitution(
    substitution_id: str,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> dict[str, str]:
    """Eine Vertretungsanfrage ablehnen.

    Den Zustand `declined` kennt das Enum seit 0019, einen Weg dorthin gab es
    nie: eine ausgeschlagene Anfrage blieb ewig offen und stand jedem Kollegen
    weiter in der Liste. Die Aufgabe bleibt dabei, wo sie ist.
    """
    try:
        sub = service.decline_substitution(
            _tenant(ctx), substitution_id, ctx.user_id, ctx
        )
        return {"id": sub.id, "status": sub.status.value}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/substitution", response_model=list[SubstitutionListItem])
def list_substitutions(
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.REQUEST_SUBSTITUTE))
    ],
) -> list[SubstitutionListItem]:
    """Offene Vertretungsanfragen, die ich übernehmen könnte.

    Ohne diese Liste war die Vertretung unerreichbar — man hätte die ID einer
    Anfrage bereits kennen müssen, um sie annehmen zu können. Eigene Anfragen
    fallen raus, der Objekt-Scope gilt wie überall (Wurzel 9).
    """
    try:
        return service.list_substitutions(_tenant(ctx), ctx.user_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/inventory", status_code=201)
def add_inventory(
    req: InventoryItemCreate,
    service: TasksServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_INVENTORY))
    ],
) -> dict[str, str]:
    try:
        return {"id": service.add_inventory(_tenant(ctx), req).id}
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- PM-Aufgaben-Modul: Team, Kalender, Detail, Abschluss, Inspektion ---


def _manage() -> object:
    """Guard: Aufgaben verwalten (owner/staff/co_admin)."""
    return require_permission(Capability.MANAGE_TASKS)


def _own() -> object:
    """Guard: eigene Aufgaben (cleaner) — abschließen + Detail lesen."""
    return require_permission(Capability.VIEW_OWN_TASKS)


def _darf_benoten(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> bool:
    """MANAGE_TASKS vorhanden? — als Auskunft, nicht als Sperre.

    Die Rückmeldung zum Ergebnis darf JEDE zuständige Person schreiben (sie
    weiß, wie es lief). Die BEWERTUNG darf nur die Konto-Führung setzen — eine
    Selbstbenotung sagt über die Leistung nichts. Ein `require_permission` an
    der Route würde deshalb zu viel sperren: die Reinigungskraft käme dann gar
    nicht mehr an ihre eigene Rückmeldung.
    """
    return has_capability(ctx.role, Capability.MANAGE_TASKS)


@router.get("/assignees", response_model=list[TaskAssigneeOption])
def list_assignees(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    property_id: str | None = None,
) -> list[TaskAssigneeOption]:
    """Wer kann Zuständige:r einer Aufgabe sein?

    NICHT `/auth/account/users` — die Liste ist für die Hauptkontakt-Auswahl
    gedacht und enthält alle Nutzer des Betriebs, auch Eigentümer. Ein `owner`
    hat `VIEW_OWN_TASKS` aber nicht: eine ihm zugewiesene Aufgabe könnte er
    nie öffnen. Live standen dadurch 23 Eigentümer neben 2 wirklich
    berechtigten Personen in der Auswahl — und 11 Aufgaben auf Konten, die sie
    nie zu sehen bekamen.
    """
    try:
        return service.moegliche_zustaendige(_tenant(ctx), property_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/team", response_model=list[TaskListItem])
def team_tasks(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    status_bucket: str | None = None,
    property_id: Annotated[list[str] | None, Query()] = None,
    assignee_id: Annotated[list[str] | None, Query()] = None,
    rule_id: Annotated[list[str] | None, Query()] = None,
    tagesende: str | None = None,
) -> list[TaskListItem]:
    """Filter sind MEHRFACH wählbar (Lodgify-Dialoge). `assignee_id=none` meint
    „Nicht zugeordnet"."""
    return service.list_team_tasks(
        _tenant(ctx),
        status_bucket,
        property_id,
        assignee_id,
        rule_id,
        tagesende=_tagesgrenze(tagesende),
        ctx=ctx,
    )


@router.post("/bulk/complete")
def bulk_complete(
    req: BulkTaskRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> dict[str, int]:
    """Auswahl abschließen. Jede Aufgabe durchläuft denselben Scope- und
    Foto-Pflicht-Pfad wie der Einzelabschluss (Wurzel 9)."""
    try:
        return service.bulk_complete(_tenant(ctx), req.ids, ctx.user_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk/assign")
def bulk_assign(
    req: BulkAssignRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> dict[str, int]:
    """Auswahl einem Mitarbeiter zuweisen (oder die Zuweisung abziehen).

    Jede Aufgabe durchläuft denselben Scope- und Freigabe-Pfad wie die
    Einzel-Zuweisung (Wurzel 9). Was daran scheitert, kommt als `skipped`
    zurück statt den ganzen Aufruf zu kippen.
    """
    try:
        return service.bulk_assign(_tenant(ctx), req.ids, req.assignee_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk/delete")
def bulk_delete(
    req: BulkTaskRequest,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> dict[str, int]:
    try:
        return service.bulk_delete(_tenant(ctx), req.ids, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/calendar", response_model=TaskCalendarResponse)
def task_calendar(
    month_from: str,
    month_to: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    assignee_id: Annotated[list[str] | None, Query()] = None,
    rule_id: Annotated[list[str] | None, Query()] = None,
) -> TaskCalendarResponse:
    return service.calendar(
        _tenant(ctx), month_from, month_to, assignee_id, rule_id, ctx
    )


@router.get("/inspection", response_model=list[InspectionItem])
def inspection_list(
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
    tab: str = "to_review",
    property_id: Annotated[list[str] | None, Query()] = None,
) -> list[InspectionItem]:
    return service.list_inspection(_tenant(ctx), tab, property_id, ctx)


@router.get("/detail/{task_id}", response_model=TaskDetail)
def task_detail(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    try:
        return service.get_detail(_tenant(ctx), task_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/complete", response_model=TaskDetail)
def complete_task(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    try:
        return service.complete_task(_tenant(ctx), task_id, ctx.user_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/checklist/item/{item_id}", response_model=TaskDetail)
def toggle_checklist_item(
    item_id: str,
    req: ChecklistItemToggle,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    """Einen Checklisten-Punkt abhaken oder das Häkchen zurücknehmen (0360).

    Die Spalte `done` gab es seit jeher, aber keinen Weg, sie zu setzen: die
    Punkte standen in der Oberfläche und ließen sich nicht anfassen. Der Scope
    hängt an der AUFGABE, nicht an der item_id — sonst wäre jeder fremde Punkt
    abhakbar (Wurzel 9)."""
    try:
        return service.toggle_checklist_item(_tenant(ctx), item_id, req.done, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/costs", response_model=TaskDetail, status_code=201)
def add_task_cost(
    task_id: str,
    req: TaskCostCreate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    """Auslage zu einer Aufgabe erfassen (0360, Hostaway-Gleichzug).

    Die zuständige Person darf das: sie hat das Geld ausgelegt. Die WÄHRUNG
    kommt aus den Daten (Objekt-, sonst Betriebswährung), nie aus dem Request —
    sonst ließe sich in einer Währung buchen, die zum Objekt nicht passt.
    Fehlt sie an beiden Stellen, gibt es 422 statt eines erfundenen Euro."""
    try:
        return service.add_cost(_tenant(ctx), task_id, req, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/costs/{cost_id}", response_model=TaskDetail)
def delete_task_cost(
    cost_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
) -> TaskDetail:
    """Auslage zurücknehmen. staff/cleaner nur die eigenen — sonst wäre der
    Lese-Filter in `_load_costs` wertlos."""
    try:
        return service.delete_cost(_tenant(ctx), cost_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{task_id}/resolution", response_model=TaskDetail)
def set_task_resolution(
    task_id: str,
    req: TaskResolutionUpsert,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_own())],
    darf_benoten: Annotated[bool, Depends(_darf_benoten)],
) -> TaskDetail:
    """Abschluss-Rückmeldung setzen (genau eine je Aufgabe, 0360).

    Text darf die zuständige Person schreiben („wie ist es gelaufen"), die
    BEWERTUNG nur die Konto-Führung — eine Selbstbenotung sagt über die
    Leistung nichts. Ein Score ohne diese Berechtigung ergibt 403."""
    try:
        return service.set_resolution(
            _tenant(ctx), task_id, req, ctx, darf_benoten=darf_benoten
        )
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{task_id}/inspect", response_model=TaskDetail)
def inspect_task(
    task_id: str,
    req: InspectionDecision,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> TaskDetail:
    try:
        return service.inspect(_tenant(ctx), task_id, req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Regeln / Vorlagen (kind=template|auto|recurring) ---


def _rules_list(
    kind: TaskRuleKind, service: TasksService, ctx: AuthContext
) -> list[RuleListItem]:
    return service.list_rules(_tenant(ctx), kind)


@router.get("/templates", response_model=list[RuleListItem])
def list_templates(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.template, service, ctx)


@router.get("/auto", response_model=list[RuleListItem])
def list_auto(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.auto, service, ctx)


@router.get("/recurring", response_model=list[RuleListItem])
def list_recurring(
    service: TasksServiceDep, ctx: Annotated[AuthContext, Depends(_manage())]
) -> list[RuleListItem]:
    return _rules_list(TaskRuleKind.recurring, service, ctx)


@router.get("/rules/{rule_id}", response_model=RuleDetail)
def get_rule(
    rule_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.get_rule(_tenant(ctx), rule_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/rules", response_model=RuleDetail, status_code=201)
def create_rule(
    req: RuleCreate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.create_rule(_tenant(ctx), req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/rules/{rule_id}", response_model=RuleDetail)
def update_rule(
    rule_id: str,
    req: RuleUpdate,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> RuleDetail:
    try:
        return service.update_rule(_tenant(ctx), rule_id, req)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(_manage())],
) -> None:
    try:
        service.delete_rule(_tenant(ctx), rule_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ---------------------------------------------------------------------------
# GANZ AM ENDE, und das ist Absicht: `/{task_id}` ist ein Platzhalter, der auch
# auf `costs/<id>` und `rules/<id>` passt. FastAPI prüft die Routen in der
# Reihenfolge ihrer Registrierung — stand dieser Block oben (so war es bis
# 23.08.2026), landete ein `DELETE /tasks/costs/<id>` im AUFGABEN-Löscher und
# der Aufrufer bekam 404 „Aufgabe nicht gefunden", während seine Kostenzeile
# stehen blieb. Neue Routen mit festem Segment gehören deshalb ÜBER diesen
# Block, nicht darunter.
# ---------------------------------------------------------------------------

@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    service: TasksServiceDep,
    ctx: Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_TASKS))],
) -> None:
    try:
        service.delete_task(_tenant(ctx), task_id, ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
