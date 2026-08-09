"""Router für calendar. Gemountet unter /api/v1/calendar."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_granular_permission,
    require_permission,
)
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import Capability

from .schemas import (
    AvailabilityCheck,
    BlockRequest,
    BlockRequestDecision,
    BoardResponse,
    BulkEditRequest,
    BulkEditResult,
    DateRange,
    DayAvailability,
    MultiRestrictionRowsRequest,
    PriceOverrideRequest,
    RestrictionRowsRequest,
    SeasonApplyRequest,
    SeasonApplyResponse,
    SeasonAssignRequest,
    SeasonClearRequest,
    SeasonCreate,
    SeasonListResponse,
    SeasonPriceListResponse,
    SeasonPriceRequest,
    SeasonResponse,
    SeasonUpdate,
    SliceHealth,
    SperrantragItem,
    SperrantragListe,
    StopSellClearRequest,
    StopSellListResponse,
    StopSellRequest,
    StopSellResetRequest,
)
from .service import CalendarError, CalendarService
from .sperrantraege import SperrantragService

router = APIRouter(prefix="/calendar", tags=["calendar"])


def get_calendar_service() -> CalendarService:
    return CalendarService(client=get_service_client())


CalendarServiceDep = Annotated[CalendarService, Depends(get_calendar_service)]


def get_sperrantrag_service() -> SperrantragService:
    return SperrantragService(db=get_service_client())


SperrantragServiceDep = Annotated[
    SperrantragService, Depends(get_sperrantrag_service)
]

# Der Guard der Agentur-Seite: nur wer entscheiden darf, sieht die Anträge.
# Dieselbe Capability auf ALLEN vier Endpunkten — Liste und {id}-Aktionen
# prüfen denselben Scope (Wurzel 9), der Tenant-Scope zusätzlich im Service.
_APPROVE = require_permission(Capability.APPROVE_BLOCK)  # noqa: N816  pylint: disable=invalid-name


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="calendar")


@router.get("/availability", response_model=list[DayAvailability])
def availability(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> list[DayAvailability]:
    try:
        return service.get_availability(
            ctx, property_id, DateRange(start=start, end=end)
        )
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/board", response_model=BoardResponse)
def board(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_ids: Annotated[list[str], Query(max_length=500)],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> BoardResponse:
    """Batch-Kalender: Availability + Preise + Min-Stay + Stop-Sell für ALLE
    angefragten Objekte in EINEM Call (ersetzt die N+1-Einzelabrufe des Boards)."""
    try:
        return service.get_board(
            ctx, property_ids, DateRange(start=start, end=end)
        )
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/check", response_model=AvailabilityCheck)
def check(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> AvailabilityCheck:
    try:
        return service.check_availability(
            ctx, property_id, DateRange(start=start, end=end)
        )
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/block", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def block(
    req: BlockRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"blocked_days": service.block(ctx.tenant_id, req)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/unblock", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def unblock(
    req: BlockRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"unblocked_days": service.unblock(ctx.tenant_id, req.property_id, req.range)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/price-override", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def price_override(
    req: PriceOverrideRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, str]:
    try:
        service.set_price_override(ctx.tenant_id, req)
        return {"status": "ok"}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/stop-sell", response_model=StopSellListResponse)
def list_stop_sell(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> StopSellListResponse:
    try:
        items = service.list_stop_sell(
            ctx, property_id, DateRange(start=start, end=end)
        )
        return StopSellListResponse(items=items, total=len(items))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/stop-sell", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def set_stop_sell(
    req: StopSellRequest,
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))],
) -> dict[str, int]:
    try:
        # Rückgabe {stopped_days, skipped_booked}: gebuchte Tage werden nie
        # gestoppt und separat gemeldet, damit die UI die Überschneidung zeigt.
        return service.set_stop_sell(
            ctx.tenant_id, req.property_id, req.range, req.reason, req.weekdays,
            req.agency_id,
        )
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/stop-sell/clear", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def clear_stop_sell(
    req: StopSellClearRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, str]:
    try:
        service.clear_stop_sell(
            ctx.tenant_id, req.property_id, req.range, req.weekdays,
            include_portal=req.include_portal,
        )
        return {"status": "ok"}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/stop-sell/reset", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def reset_stop_sell(
    req: StopSellResetRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    """ALLE Stop-Sells (auch Portal) eines Objekts oder aller Objekte des Tenants
    zurücksetzen. Für versehentlich gesetzte Stops; öffnet die Tage auch an den
    OTAs. Doppel-Bestätigung erfolgt im Frontend."""
    try:
        return service.reset_all_stop_sell(ctx.tenant_id, req.property_id)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk-edit", response_model=BulkEditResult, dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def bulk_edit(
    req: BulkEditRequest,
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))],
) -> BulkEditResult:
    """Preis/Min-Stay/Sperre/Verkaufsstopp über mehrere Objekte × Zeitraum
    in einem Rutsch setzen (Hostaway-Bulk-Edit)."""
    try:
        return service.bulk_edit(ctx.tenant_id, req)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk-restrictions", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def bulk_restrictions(
    req: RestrictionRowsRequest,
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))],
) -> dict[str, int]:
    """Mehrere heterogene Restriktions-Zeilen (verschiedene Preise/min_stay/
    max_stay/CTA/CTD/stop_sell je Zeitraum) in EINEM Channex-Call setzen
    (Zertifizierung Test 3-8)."""
    try:
        return {"rows": service.bulk_restrictions(ctx.tenant_id, req)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/bulk-restrictions-multi", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def bulk_restrictions_multi(
    req: MultiRestrictionRowsRequest,
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))],
) -> dict[str, int]:
    """Zimmer-ÜBERGREIFENDE Bulk-Restriktionen (Hotel): eine Aktion über mehrere
    Zimmer × Rate-Plans → EIN gebündelter Channex-Call je Channex-Property
    (Zertifizierung Tests 3-8 über Room-Types hinweg)."""
    try:
        return {"rows": service.bulk_restrictions_multi(ctx.tenant_id, req)}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/season-price", response_model=SeasonPriceListResponse)
def list_season_price(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> SeasonPriceListResponse:
    try:
        items = service.list_season_prices(
            ctx, property_id, DateRange(start=start, end=end)
        )
        return SeasonPriceListResponse(items=items, total=len(items))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/season-price", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def set_season_price(
    req: SeasonPriceRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {
            "days": service.set_season_price(
                ctx.tenant_id, req.property_id, req.range, req.price
            )
        }
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Benannte Saisons (Jahres-Kalender, Drag&Drop) --------------------------
@router.get("/seasons", response_model=SeasonListResponse)
def list_seasons(
    service: CalendarServiceDep,
    ctx: Annotated[CurrentUser, Depends(require_permission(Capability.VIEW_CALENDAR))],
    property_id: Annotated[str, Query()],
) -> SeasonListResponse:
    try:
        items = service.list_seasons(ctx, property_id)
        return SeasonListResponse(
            items=[SeasonResponse(**s) for s in items], total=len(items)
        )
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/seasons", response_model=SeasonResponse, dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def create_season(
    req: SeasonCreate,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> SeasonResponse:
    try:
        return SeasonResponse(**service.create_season(
            ctx.tenant_id, req.property_id,
            name=req.name, color=req.color, mode=req.mode, amount=req.amount,
        ))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/seasons/{season_id}", response_model=SeasonResponse, dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def update_season(
    season_id: str,
    req: SeasonUpdate,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> SeasonResponse:
    try:
        return SeasonResponse(**service.update_season(
            ctx.tenant_id, season_id, req.model_dump(exclude_none=True)
        ))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/seasons/{season_id}", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def delete_season(
    season_id: str,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, bool]:
    try:
        service.delete_season(ctx.tenant_id, season_id)
        return {"deleted": True}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/seasons/{season_id}/apply",
    response_model=SeasonApplyResponse,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
    ],
)
def apply_season_to_properties(
    season_id: str,
    req: SeasonApplyRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> SeasonApplyResponse:
    """Eine Prozent-Saison auf weitere eigene Objekte übertragen (Kopie).

    `fixed` wird bewusst abgelehnt (422): ein fester Nachtpreis gilt nur für das
    Objekt, an dem er gesetzt wurde."""
    try:
        return SeasonApplyResponse(**service.apply_season_to_properties(
            ctx.tenant_id, season_id, req.property_ids,
            mit_zeitraeumen=req.mit_zeitraeumen,
        ))
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/seasons/assign", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def assign_season(
    req: SeasonAssignRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"days": service.assign_season(
            ctx.tenant_id, req.property_id, req.season_id, req.range
        )}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/seasons/clear", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def clear_season_range(
    req: SeasonClearRequest,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, int]:
    try:
        return {"days": service.clear_season_range(
            ctx.tenant_id, req.property_id, req.range
        )}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/seasons/assign/{assignment_id}", dependencies=[
    Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)),
])
def unassign_season(
    assignment_id: str,
    service: CalendarServiceDep,
    ctx: Annotated[
        CurrentUser, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> dict[str, bool]:
    try:
        service.unassign_season(ctx.tenant_id, assignment_id)
        return {"removed": True}
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Sperr-Anträge der Eigentümer (Agentur entscheidet, 0332) ---------------
@router.get("/block-requests", response_model=SperrantragListe)
def list_block_requests(
    service: SperrantragServiceDep,
    ctx: Annotated[CurrentUser, Depends(_APPROVE)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> SperrantragListe:
    """Sperr-Anträge des Mandanten. Ohne `status` alle, sonst gefiltert
    (`pending` ist die Warteschlange)."""
    try:
        return service.liste(ctx, status=status_filter)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/block-requests/{request_id}/approve", response_model=SperrantragItem)
def approve_block_request(
    request_id: str,
    req: BlockRequestDecision,
    service: SperrantragServiceDep,
    ctx: Annotated[CurrentUser, Depends(_APPROVE)],
) -> SperrantragItem:
    """Antrag genehmigen — sperrt die Nächte im Kalender und meldet es an die
    Portale. 409, wenn der Zeitraum gebuchte Tage enthält (der Antrag bleibt
    dann offen) oder bereits entschieden wurde."""
    try:
        return service.genehmigen(ctx, request_id, req)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/block-requests/{request_id}/reject", response_model=SperrantragItem)
def reject_block_request(
    request_id: str,
    req: BlockRequestDecision,
    service: SperrantragServiceDep,
    ctx: Annotated[CurrentUser, Depends(_APPROVE)],
) -> SperrantragItem:
    """Antrag ablehnen. Kein Kalender-Effekt; die Notiz geht an den Eigentümer."""
    try:
        return service.ablehnen(ctx, request_id, req)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/block-requests/{request_id}/revoke", response_model=SperrantragItem)
def revoke_block_request(
    request_id: str,
    req: BlockRequestDecision,
    service: SperrantragServiceDep,
    ctx: Annotated[CurrentUser, Depends(_APPROVE)],
) -> SperrantragItem:
    """Eine erteilte Genehmigung widerrufen — gibt die gesperrten Nächte über
    den bestehenden Unblock-Weg wieder frei (Wurzel 1). Nur aus 'approved'."""
    try:
        return service.zuruecknehmen(ctx, request_id, req)
    except CalendarError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
