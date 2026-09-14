"""Bereich »ausgaben« der Buchhaltung — Eingangsbelege, Kategorien, Belegausleser.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route trägt
`Leserecht`/`Schreibrecht` aus ../../guards.py (Rollen-Guard UND Modul-3-
Entitlement). Der Bestand ruft `POST /api/v1/expenses` aus dem XRechnung-Import
— er muss auf `/api/v1/buchhaltung/expenses` zeigen (Koordinator-Aufgabe im
Bericht), der Body passt hier ohne Umbau.

Statische Pfade (`/expenses/recurring/run`, `/expenses/ocr/extract-receipt`)
stehen VOR `/expenses/{expense_id}`, damit FastAPI sie nicht als ID liest.
Der OCR-Pfad hat einen EIGENEN Pfad, weil der Rate-Limit-Eimer allein über den
Pfad gewählt wird (`ratelimit_middleware._AI_PATHS`, Koordinator-Aufgabe).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from src.core.uploads import read_upload_named

from ...guards import Leserecht, Schreibrecht
from .dependencies import AusgabenServiceDep
from .schemas import (
    MAX_LIMIT,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseResponse,
    ExpenseUpdate,
    ReceiptExtraction,
    ReceiptUrlResponse,
    RecurringRunResult,
)
from .service import AusgabenError

router = APIRouter(tags=["buchhaltung"])


def _http(exc: AusgabenError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Ausgaben ------------------------------------------------------------------


@router.get("/expenses", response_model=ExpenseListResponse)
def list_expenses(  # noqa: PLR0913 — Filterparameter der Liste
    ctx: Leserecht,
    service: AusgabenServiceDep,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    payment_status: Annotated[str | None, Query(alias="status", max_length=20)] = None,
    category_id: Annotated[str | None, Query(alias="categoryId", max_length=64)] = None,
    recurring: bool | None = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 200,
) -> ExpenseListResponse:
    """Ausgaben des Betriebs, neueste zuerst. Zeitraum ≤ 366 Tage, limit ≤ 500."""
    try:
        return service.list_expenses(
            ctx, date_from=date_from, date_to=date_to, status=payment_status,
            category_id=category_id, recurring=recurring, search=search, limit=limit,
        )
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    body: ExpenseCreate, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ExpenseResponse:
    try:
        return service.create_expense(ctx, body)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post("/expenses/recurring/run", response_model=RecurringRunResult)
def run_recurring_expenses(ctx: Schreibrecht, service: AusgabenServiceDep) -> RecurringRunResult:
    """Fällige Wiederholungen anlegen — idempotent per Unique (Vorlage, Termin)."""
    try:
        return service.run_recurring(ctx)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post("/expenses/ocr/extract-receipt", response_model=ReceiptExtraction)
async def extract_receipt(
    request: Request, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ReceiptExtraction:
    """Beleg (PDF/JPEG/PNG/HEIC, ≤ 15 MB) auslesen lassen. Speichert nichts."""
    inhalt, _typ, name = await read_upload_named(request)
    try:
        return service.extract_receipt(ctx, inhalt=inhalt, dateiname=name)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: str, ctx: Leserecht, service: AusgabenServiceDep) -> ExpenseResponse:
    try:
        return service.get_expense(ctx, expense_id)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: str, body: ExpenseUpdate, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ExpenseResponse:
    try:
        return service.update_expense(ctx, expense_id, body)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: str, ctx: Schreibrecht, service: AusgabenServiceDep) -> None:
    try:
        service.delete_expense(ctx, expense_id)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post("/expenses/{expense_id}/lock", response_model=ExpenseResponse)
def lock_expense(
    expense_id: str, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ExpenseResponse:
    """GoBD-Sperre setzen (unumkehrbar, idempotent)."""
    try:
        return service.lock_expense(ctx, expense_id)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post("/expenses/{expense_id}/receipt", response_model=ExpenseResponse)
async def upload_receipt(
    expense_id: str, request: Request, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ExpenseResponse:
    """Belegdatei (multipart `file`) in den privaten Bucket legen."""
    inhalt, _typ, name = await read_upload_named(request)
    try:
        return service.upload_receipt(ctx, expense_id, inhalt=inhalt, dateiname=name)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.get("/expenses/{expense_id}/receipt-url", response_model=ReceiptUrlResponse)
def receipt_url(expense_id: str, ctx: Leserecht, service: AusgabenServiceDep) -> ReceiptUrlResponse:
    """Signierte, 10 Minuten gültige Adresse der Belegdatei."""
    try:
        return service.receipt_url(ctx, expense_id)
    except AusgabenError as exc:
        raise _http(exc) from exc


# --- Kategorien ----------------------------------------------------------------


@router.get("/expense-categories", response_model=list[ExpenseCategoryResponse])
def list_expense_categories(
    ctx: Leserecht,
    service: AusgabenServiceDep,
    include_inactive: Annotated[bool, Query(alias="includeInactive")] = False,
) -> list[ExpenseCategoryResponse]:
    try:
        return service.list_categories(ctx, include_inactive=include_inactive)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.post(
    "/expense-categories",
    response_model=ExpenseCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense_category(
    body: ExpenseCategoryCreate, ctx: Schreibrecht, service: AusgabenServiceDep
) -> ExpenseCategoryResponse:
    try:
        return service.create_category(ctx, body)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.patch("/expense-categories/{category_id}", response_model=ExpenseCategoryResponse)
def update_expense_category(
    category_id: str,
    body: ExpenseCategoryUpdate,
    ctx: Schreibrecht,
    service: AusgabenServiceDep,
) -> ExpenseCategoryResponse:
    try:
        return service.update_category(ctx, category_id, body)
    except AusgabenError as exc:
        raise _http(exc) from exc


@router.delete("/expense-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_category(
    category_id: str, ctx: Schreibrecht, service: AusgabenServiceDep
) -> None:
    try:
        service.delete_category(ctx, category_id)
    except AusgabenError as exc:
        raise _http(exc) from exc
