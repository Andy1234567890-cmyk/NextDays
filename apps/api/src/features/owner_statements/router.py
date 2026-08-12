"""Router für owner_statements. Gemountet unter /api/v1/owner-statements.

Owner-Statements (Auszahlungsabrechnung) + Expenses. Alle Agentur-Endpunkte sind
OWNER_REPORTING-geschützt und tenant-gescoped. Der Auto-Statement-Lauf ist ein
interner Cron-Trigger (geteiltes Secret, wie DP-Recompute).
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from src.core.security import AuthContext, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.core.uploads import read_upload_named
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .common import PayoutUnbekannt
from .dependencies import OwnerStatementsServiceDep
from .schemas import (
    AutoStatementRunResponse,
    ExpenseCreate,
    ExpenseReceiptUrlResponse,
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

_REPORTING = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.OWNER_REPORTING
)

# Welche fehlende Einstellung hinter einem `PayoutUnbekannt`-Grund steckt — als
# Satz, der sagt, WO der Betrieb sie pflegt. Der rohe Grund („portal_abzug") ist
# maschinenlesbar, aber keine Auskunft für einen Menschen.
_GRUND_HINWEIS = {
    "portal_abzug": (
        "Für einen der Buchungskanäle ist kein Abzugssatz hinterlegt. "
        "Bitte unter Buchhaltung → Abrechnungsregeln eintragen, was das Portal "
        "je Buchung einbehält."
    ),
    "gebuehr_nicht_zugeordnet": (
        "Eine Gebührenart ist noch nicht zugeordnet. Bitte unter Buchhaltung → "
        "Abrechnungsregeln festlegen, wem die Gebühr gehört und ob Provision "
        "darauf anfällt."
    ),
    "provision": (
        "Für ein Objekt ist kein Provisionssatz hinterlegt — weder ein "
        "Abrechnungsvertrag noch ein Satz beim Eigentümer."
    ),
}


def _payout_fehler(exc: PayoutUnbekannt) -> HTTPException:
    """Ein Datenmangel ist ein 422, kein 500 (Wurzel 5).

    Bis 11.08.2026 lief `PayoutUnbekannt` aus der Rechenkette bis in den ASGI-Stack
    durch: `POST /owner-statements/preview` antwortete mit **500**, und der Betrieb
    sah eine kaputte Seite statt der Auskunft, welche Einstellung fehlt. Ausgelöst
    live, weil `portal_abzugssaetze` noch leer war.

    Die Einzelzeilen fangen ihren Grund inzwischen selbst ab und weisen ihn aus;
    dieser Handler ist das NETZ für die Pfade, die ohne Zeile rechnen (Summen,
    Finalisierung) — er nennt den Grund und sagt, wo die Einstellung sitzt.
    """
    hinweis = _GRUND_HINWEIS.get(exc.grund)
    return HTTPException(
        status_code=422,
        detail=f"{exc.message} {hinweis}" if hinweis else exc.message,
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
    except PayoutUnbekannt as exc:
        raise _payout_fehler(exc) from exc
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
    except PayoutUnbekannt as exc:
        raise _payout_fehler(exc) from exc
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
    except PayoutUnbekannt as exc:
        raise _payout_fehler(exc) from exc
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


@router.post("/expenses/{expense_id}/receipt", response_model=ExpenseResponse)
async def upload_expense_receipt(
    expense_id: str,
    request: Request,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> ExpenseResponse:
    """Beleg/Nachweis (multipart „file") an einen Verrechnungsposten hängen.

    Landet im PRIVATEN Bucket owner-expense-receipts; der Typ wird im Service
    an den echten Anfangsbytes geprüft, nicht am Client-content_type."""
    # Inhalt UND Original-Dateiname in EINEM Durchlauf: nach `read_upload` ist
    # das Formular geschlossen, ein zweites `request.form()` liefert nur noch
    # geschlossene Dateien (siehe `read_upload_named`).
    content, _content_type, file_name = await read_upload_named(request)
    try:
        return service.upload_receipt(ctx, expense_id, content, file_name)
    except StatementError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/expenses/{expense_id}/receipt", response_model=ExpenseReceiptUrlResponse)
def expense_receipt_url(
    expense_id: str,
    service: OwnerStatementsServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTING)],
) -> ExpenseReceiptUrlResponse:
    """Signierte, zeitlich begrenzte Download-URL für den Beleg."""
    try:
        return service.receipt_url(ctx, expense_id)
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
    Statement für den Zeitraum (1/Monat, künftige-only). Kein JWT — via eigenem
    INTERNAL_CRON_SECRET (nie das outbound geteilte Channex-Webhook-Secret),
    getriggert durch einen Scheduled-Task."""
    require_internal_cron_secret(x_internal_cron_secret)
    return OwnerStatementsService(
        service_client=get_service_client()
    ).run_auto_statements(period_from, period_to)
