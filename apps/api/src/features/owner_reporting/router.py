"""Router für owner_reporting. Gemountet unter /api/v1/owner-reporting.

AUTORISIERUNG (Wurzel 9): jede Route hängt an einer Capability, nicht nur an
``get_current_user``. Berichte, Zahlungen und Statistik sind Finanzdaten des
Betriebs — §4.3 (staff/cleaner kein Finanzeinblick) und §4.2 (der Eigentümer
ist die GEGENPARTEI der Auszahlung und darf sie nicht selbst pflegen).

Der Item-Pfad prüft denselben Scope wie der List-Pfad: jede ``{id}``-Route lädt
über ``load_scoped``/``_own_*`` und findet eine fremde ID nicht.

Der Plan-Lauf ist ein interner Cron-Trigger mit geteiltem Secret (kein JWT) —
dasselbe Muster wie ``owner-statements/auto-run``.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from src.core.security import AuthContext, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .dependencies import OwnerReportingServiceDep
from .schemas import (
    BuchungsAufschluesselung,
    EmpfaengerListResponse,
    PaymentCreate,
    PaymentDetail,
    PaymentListResponse,
    PaymentPartCreate,
    PaymentUpdate,
    RecurringItemCreate,
    RecurringItemListResponse,
    RecurringItemResponse,
    RecurringItemUpdate,
    ReportCreate,
    ReportDetail,
    ReportListResponse,
    ReportUpdate,
    ScheduleCreate,
    ScheduleListResponse,
    ScheduleResponse,
    ScheduleRunResponse,
    ScheduleUpdate,
    SliceHealth,
    StatistikResponse,
)
from .service import OwnerReportingService, ReportingError

router = APIRouter(prefix="/owner-reporting", tags=["owner_reporting"])

_REPORTING = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.OWNER_REPORTING
)

Ctx = Annotated[AuthContext, Depends(_REPORTING)]


def _http(exc: ReportingError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: OwnerReportingServiceDep) -> SliceHealth:
    return service.health()


# ----------------------------------------------------------------------
# Berichte
# ----------------------------------------------------------------------


@router.get("/reports", response_model=ReportListResponse)
def list_reports(
    service: OwnerReportingServiceDep, ctx: Ctx
) -> ReportListResponse:
    try:
        return service.list_reports(ctx)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.post(
    "/reports", response_model=ReportDetail, status_code=status.HTTP_201_CREATED
)
def create_report(
    req: ReportCreate, service: OwnerReportingServiceDep, ctx: Ctx
) -> ReportDetail:
    try:
        return service.create_report(ctx, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get("/reports/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> ReportDetail:
    try:
        return service.get_report(ctx, report_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.patch("/reports/{report_id}", response_model=ReportDetail)
def update_report(
    report_id: str,
    req: ReportUpdate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> ReportDetail:
    try:
        return service.update_report(ctx, report_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> None:
    try:
        service.delete_report(ctx, report_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get(
    "/reports/{report_id}/bookings", response_model=BuchungsAufschluesselung
)
def report_bookings(
    report_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> BuchungsAufschluesselung:
    """Die Aufschlüsselung nach Buchung (Lodgify „Siehe Aufschlüsselung nach
    Buchung"): je Aufenthalt Referenz, Quelle, Gäste, Nächte und die Posten."""
    try:
        return service.buchungs_aufschluesselung(ctx, report_id)
    except ReportingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Zahlungen
# ----------------------------------------------------------------------


@router.post(
    "/reports/{report_id}/payments",
    response_model=PaymentDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    report_id: str,
    req: PaymentCreate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> PaymentDetail:
    """Aus dem Bericht die Auszahlung an EINEN Empfänger erzeugen.

    Idempotent: ein zweiter Aufruf liefert die vorhandene Zahlung, statt eine
    zweite Forderung über denselben Betrag anzulegen (Wurzel 2).
    """
    try:
        return service.create_payment(ctx, report_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get("/payments", response_model=PaymentListResponse)
def list_payments(
    service: OwnerReportingServiceDep,
    ctx: Ctx,
    nur_offene: bool = False,
    owner_id: str | None = None,
) -> PaymentListResponse:
    try:
        return service.list_payments(
            ctx, nur_offene=nur_offene, owner_id=owner_id
        )
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get("/payments/{payment_id}", response_model=PaymentDetail)
def get_payment(
    payment_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> PaymentDetail:
    try:
        return service.get_payment(ctx, payment_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.patch("/payments/{payment_id}", response_model=PaymentDetail)
def update_payment(
    payment_id: str,
    req: PaymentUpdate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> PaymentDetail:
    try:
        return service.update_payment(ctx, payment_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.post("/payments/{payment_id}/mark-paid", response_model=PaymentDetail)
def mark_paid(
    payment_id: str,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
    bezahlt_am: Annotated[date | None, Query()] = None,
) -> PaymentDetail:
    """Als vollständig bezahlt markieren.

    ``bezahlt_am`` kommt vom Aufrufer; ohne Angabe der SERVER-Tag. Nicht die
    Uhr des Browsers: zwei Nutzer in verschiedenen Zeitzonen buchten denselben
    Vorgang sonst auf zwei verschiedene Tage.
    """
    try:
        return service.mark_paid(ctx, payment_id, bezahlt_am or date.today())
    except ReportingError as exc:
        raise _http(exc) from exc


@router.post(
    "/payments/{payment_id}/parts",
    response_model=PaymentDetail,
    status_code=status.HTTP_201_CREATED,
)
def add_part(
    payment_id: str,
    req: PaymentPartCreate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> PaymentDetail:
    try:
        return service.add_part(ctx, payment_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.delete("/parts/{part_id}", response_model=PaymentDetail)
def delete_part(
    part_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> PaymentDetail:
    try:
        return service.delete_part(ctx, part_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> None:
    try:
        service.delete_payment(ctx, payment_id)
    except ReportingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Empfänger + wiederkehrende Posten
# ----------------------------------------------------------------------


@router.get("/recipients", response_model=EmpfaengerListResponse)
def list_recipients(
    service: OwnerReportingServiceDep, ctx: Ctx
) -> EmpfaengerListResponse:
    """Die Empfänger-Übersicht: Zahlungen, Volumen je Währung, Vertragsstand."""
    try:
        return service.list_empfaenger(ctx)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get(
    "/recipients/{owner_id}/recurring", response_model=RecurringItemListResponse
)
def list_recurring(
    owner_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> RecurringItemListResponse:
    try:
        return service.list_recurring(ctx, owner_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.post(
    "/recipients/{owner_id}/recurring",
    response_model=RecurringItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recurring(
    owner_id: str,
    req: RecurringItemCreate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> RecurringItemResponse:
    try:
        return service.create_recurring(ctx, owner_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.patch("/recurring/{item_id}", response_model=RecurringItemResponse)
def update_recurring(
    item_id: str,
    req: RecurringItemUpdate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> RecurringItemResponse:
    try:
        return service.update_recurring(ctx, item_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.delete("/recurring/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    item_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> None:
    try:
        service.delete_recurring(ctx, item_id)
    except ReportingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Geplante Berichte
# ----------------------------------------------------------------------


@router.get("/schedules", response_model=ScheduleListResponse)
def list_schedules(
    service: OwnerReportingServiceDep, ctx: Ctx
) -> ScheduleListResponse:
    try:
        return service.list_schedules(ctx)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.post(
    "/schedules",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_schedule(
    req: ScheduleCreate, service: OwnerReportingServiceDep, ctx: Ctx
) -> ScheduleResponse:
    try:
        return service.create_schedule(ctx, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.get("/schedules/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> ScheduleResponse:
    try:
        return service.get_schedule(ctx, schedule_id)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.patch("/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: str,
    req: ScheduleUpdate,
    service: OwnerReportingServiceDep,
    ctx: Ctx,
) -> ScheduleResponse:
    try:
        return service.update_schedule(ctx, schedule_id, req)
    except ReportingError as exc:
        raise _http(exc) from exc


@router.delete(
    "/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_schedule(
    schedule_id: str, service: OwnerReportingServiceDep, ctx: Ctx
) -> None:
    try:
        service.delete_schedule(ctx, schedule_id)
    except ReportingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Statistik
# ----------------------------------------------------------------------


@router.get("/statistics", response_model=StatistikResponse)
def statistics(
    service: OwnerReportingServiceDep,
    ctx: Ctx,
    von: date,
    bis: date,
    currency: str | None = None,
    owner_id: Annotated[list[str] | None, Query()] = None,
) -> StatistikResponse:
    """Bilanzstatistik: bezahltes Geld im Zeitverlauf + Anteile je Abschnitt."""
    if bis < von:
        raise HTTPException(
            status_code=422, detail="„Bis“ darf nicht vor „Von“ liegen."
        )
    # Harte Obergrenze (Wurzel 8): ein offener Zeitraum wäre ein Vollscan über
    # alle Teilzahlungen des Betriebs.
    if (bis - von).days > 1830:
        raise HTTPException(
            status_code=422, detail="Der Zeitraum darf höchstens 5 Jahre umfassen."
        )
    try:
        return service.statistik(
            ctx, von=von, bis=bis, currency=currency, owner_ids=owner_id
        )
    except ReportingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Cron
# ----------------------------------------------------------------------


@router.post(
    "/schedules/run", response_model=ScheduleRunResponse, include_in_schema=False
)
def run_schedules(
    heute: date | None = None,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> ScheduleRunResponse:
    """Interner Cron-Trigger: alle fälligen Pläne ausführen.

    Kein JWT — über INTERNAL_CRON_SECRET (byteweiser Vergleich, fail-closed).
    ``heute`` ist nur für Wiederholungen/Tests; ohne Angabe der Server-Tag.
    """
    require_internal_cron_secret(x_internal_cron_secret)
    return OwnerReportingService(
        service_client=get_service_client()
    ).run_schedules(heute or date.today())
