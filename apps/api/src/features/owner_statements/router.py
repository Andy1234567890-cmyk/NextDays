"""Router für owner_statements. Gemountet unter /api/v1/owner-statements.

Owner-Statements (Auszahlungsabrechnung) + Expenses. Alle Agentur-Endpunkte sind
OWNER_REPORTING-geschützt und tenant-gescoped. Der Auto-Statement-Lauf ist ein
interner Cron-Trigger (geteiltes Secret, wie DP-Recompute).
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from src.core.config import get_settings
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_lodgify_permission
from src.features.auth.lodgify_permissions import Permission

from .dependencies import OwnerStatementsServiceDep
from .schemas import (
    AutoStatementRunResponse,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    SliceHealth,
    StatementGenerateRequest,
    StatementListResponse,
    StatementResponse,
    StatementUpdate,
)
from .service import OwnerStatementsService, StatementError

router = APIRouter(prefix="/owner-statements", tags=["owner_statements"])

_REPORTING = require_lodgify_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.OWNER_REPORTING
)


@router.get("/health", response_model=SliceHealth)
def health(service: OwnerStatementsServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=StatementListResponse)
def list_statements(
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
    owner_id: str | None = None,
) -> StatementListResponse:
    try:
        return service.list(ctx, owner_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=StatementResponse, status_code=status.HTTP_201_CREATED)
def generate_statement(
    req: StatementGenerateRequest,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    try:
        return service.generate(ctx, req)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/preview", response_model=StatementResponse)
def preview_statement(
    req: StatementGenerateRequest,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    """Live-Auswertung (Umsatz/Aktivität/Summen) für Owner + Zeitraum OHNE etwas
    zu speichern. Für den Überblick auf der Owner-Seite."""
    try:
        return service.preview(ctx, req)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{statement_id}", response_model=StatementResponse)
def get_statement(
    statement_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    try:
        return service.get(ctx, statement_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{statement_id}", response_model=StatementResponse)
def update_statement(
    statement_id: str,
    req: StatementUpdate,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    try:
        return service.update(ctx, statement_id, req)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{statement_id}/finalize", response_model=StatementResponse)
def finalize_statement(
    statement_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    try:
        return service.finalize(ctx, statement_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{statement_id}/cancel", response_model=StatementResponse)
def cancel_statement(
    statement_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> StatementResponse:
    """Storniert eine finalisierte Rechnung: erzeugt eine Stornorechnung
    (eigene Nummer, negierte Beträge) und gibt diese zurück."""
    try:
        return service.cancel(ctx, statement_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{statement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_statement(
    statement_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> None:
    try:
        service.delete(ctx, statement_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Expenses & Extras -------------------------------------------------------


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def add_expense(
    req: ExpenseCreate,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> ExpenseResponse:
    try:
        return service.add_expense(ctx, req)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: str,
    req: ExpenseUpdate,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> ExpenseResponse:
    try:
        return service.update_expense(ctx, expense_id, req)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> None:
    try:
        service.delete_expense(ctx, expense_id)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Auto-Statements (Cron, per Secret) --------------------------------------


@router.post("/auto-run", response_model=AutoStatementRunResponse, include_in_schema=False)
def auto_run(
    period_from: date,
    period_to: date,
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> AutoStatementRunResponse:
    """Interner Cron-Trigger: erzeugt für alle Owner mit monatlichem Rhythmus ein
    Statement für den Zeitraum (1/Monat, künftige-only). Kein JWT — via geteiltem
    Secret (CHANNEX_WEBHOOK_SECRET), getriggert durch einen Scheduled-Task."""
    expected = get_settings().channex_webhook_secret.get_secret_value()
    if not expected or x_internal_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
    return OwnerStatementsService(
        service_client=get_service_client()
    ).run_auto_statements(period_from, period_to)
