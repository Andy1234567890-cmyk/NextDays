"""Bereich »zahlungen« der Buchhaltung: Zahlungskonten, Bankumsätze (CSV-Import,
Handbuchung), Verknüpfung Umsatz ↔ Beleg, Kassenbuch.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route trägt
`Leserecht`/`Schreibrecht` aus ../../guards (Rollen-Guard + Modul-Entitlement).

Alte Pfade des Bestands, die hier bedient werden (TASKILO-ABGLEICH §3c/§3d):
  POST   /companies/{company_id}/transaction-links                (transaction-link.service.ts)
  DELETE /companies/{company_id}/transaction-links/{link_id}
  PATCH  /companies/{company_id}/transaction-links/{link_id}/booking-status
  GET    /transaction-links, GET /transaction-links/{link_id}
Die GET-Liste `/companies/{company_id}/transaction-links` liegt im Bestands-
Router (../../router.py) und liefert dort noch `[]` — Koordinator-Aufgabe im
Bericht. `company_id` aus dem Pfad ist Altlast und wird ignoriert; autoritativ
ist `ctx.tenant_id`.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from ...guards import Leserecht, Schreibrecht
from .basis import ZahlungenError
from .dependencies import ZahlungenServiceDep
from .schemas import (
    BankTransactionCreate,
    BankTransactionListResponse,
    BankTransactionResponse,
    BankTransactionUpdate,
    BookingStatusUpdate,
    CashbookEntryCreate,
    CashbookResponse,
    CsvImportRequest,
    CsvPreviewRequest,
    CsvPreviewResponse,
    ImportResult,
    LegacyLinkCreate,
    PaymentAccountCreate,
    PaymentAccountResponse,
    PaymentAccountUpdate,
    SuggestionResponse,
    TransactionLinkCreate,
    TransactionLinkResponse,
)

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=500)]
_Suche = Annotated[str | None, Query(max_length=80)]


def _http(exc: ZahlungenError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Zahlungskonten -----------------------------------------------------------


@router.get("/payment-accounts", response_model=list[PaymentAccountResponse])
def list_payment_accounts(
    ctx: Leserecht,
    service: ZahlungenServiceDep,
    include_inactive: Annotated[bool, Query(alias="includeInactive")] = False,
) -> list[PaymentAccountResponse]:
    try:
        return service.list_accounts(ctx, include_inactive=include_inactive)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post(
    "/payment-accounts", response_model=PaymentAccountResponse, status_code=status.HTTP_201_CREATED
)
def create_payment_account(
    body: PaymentAccountCreate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> PaymentAccountResponse:
    try:
        return service.create_account(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.get("/payment-accounts/{account_id}", response_model=PaymentAccountResponse)
def get_payment_account(
    account_id: str, ctx: Leserecht, service: ZahlungenServiceDep
) -> PaymentAccountResponse:
    try:
        return service.get_account(ctx, account_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.patch("/payment-accounts/{account_id}", response_model=PaymentAccountResponse)
def update_payment_account(
    account_id: str, body: PaymentAccountUpdate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> PaymentAccountResponse:
    try:
        return service.update_account(ctx, account_id, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.delete("/payment-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_payment_account(
    account_id: str, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> None:
    """Deaktiviert (Buchungen bleiben, GoBD). Zweiter Aufruf: No-Op."""
    try:
        service.deactivate_account(ctx, account_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


# --- Bankumsätze ----------------------------------------------------------------


@router.get("/bank-transactions", response_model=BankTransactionListResponse)
def list_bank_transactions(
    ctx: Leserecht,
    service: ZahlungenServiceDep,
    account_id: Annotated[str | None, Query(alias="accountId")] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    status_filter: Annotated[str | None, Query(alias="status", max_length=20)] = None,
    search: _Suche = None,
    limit: _Limit = 200,
) -> BankTransactionListResponse:
    try:
        return service.list_transactions(
            ctx,
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            status=status_filter,
            search=search,
            limit=limit,
        )
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post(
    "/bank-transactions",
    response_model=BankTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_bank_transaction(
    body: BankTransactionCreate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> BankTransactionResponse:
    """Handbuchung (Kasse, oder Umsatz ohne Datei). Gleiche Felder = gleicher
    Hash → bestehende Zeile zurück (Wurzel 2)."""
    try:
        return service.create_transaction(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post("/bank-transactions/import/preview", response_model=CsvPreviewResponse)
def preview_bank_import(
    body: CsvPreviewRequest, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> CsvPreviewResponse:
    try:
        return service.preview_csv(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post(
    "/bank-transactions/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED
)
def import_bank_transactions(
    body: CsvImportRequest, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> ImportResult:
    try:
        return service.import_csv(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.get("/bank-transactions/{transaction_id}", response_model=BankTransactionResponse)
def get_bank_transaction(
    transaction_id: str, ctx: Leserecht, service: ZahlungenServiceDep
) -> BankTransactionResponse:
    try:
        return service.get_transaction(ctx, transaction_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.patch("/bank-transactions/{transaction_id}", response_model=BankTransactionResponse)
def update_bank_transaction(
    transaction_id: str,
    body: BankTransactionUpdate,
    ctx: Schreibrecht,
    service: ZahlungenServiceDep,
) -> BankTransactionResponse:
    try:
        return service.update_transaction(ctx, transaction_id, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.get(
    "/bank-transactions/{transaction_id}/suggestions", response_model=list[SuggestionResponse]
)
def bank_transaction_suggestions(
    transaction_id: str, ctx: Leserecht, service: ZahlungenServiceDep
) -> list[SuggestionResponse]:
    try:
        return service.suggestions(ctx, transaction_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


# --- Verknüpfungen ----------------------------------------------------------


@router.get("/transaction-links", response_model=list[TransactionLinkResponse])
def list_transaction_links(
    ctx: Leserecht,
    service: ZahlungenServiceDep,
    transaction_id: Annotated[str | None, Query(alias="transactionId")] = None,
    document_id: Annotated[str | None, Query(alias="documentId")] = None,
    invoice_id: Annotated[str | None, Query(alias="invoiceId")] = None,
    limit: _Limit = 200,
) -> list[TransactionLinkResponse]:
    try:
        return service.list_links(
            ctx,
            transaction_id=transaction_id,
            document_id=document_id,
            invoice_id=invoice_id,
            limit=limit,
        )
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post(
    "/transaction-links",
    response_model=TransactionLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction_link(
    body: TransactionLinkCreate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> TransactionLinkResponse:
    try:
        return service.create_link(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.get("/transaction-links/{link_id}", response_model=TransactionLinkResponse)
def get_transaction_link(
    link_id: str, ctx: Leserecht, service: ZahlungenServiceDep
) -> TransactionLinkResponse:
    try:
        return service.get_link(ctx, link_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.delete("/transaction-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction_link(link_id: str, ctx: Schreibrecht, service: ZahlungenServiceDep) -> None:
    try:
        service.delete_link(ctx, link_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


# Bestands-Pfade (services/transaction-link.service.ts) — company_id ignoriert.


@router.post(
    "/companies/{company_id}/transaction-links",
    response_model=TransactionLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction_link_legacy(
    company_id: str, body: LegacyLinkCreate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> TransactionLinkResponse:
    try:
        return service.create_link_legacy(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.delete(
    "/companies/{company_id}/transaction-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_transaction_link_legacy(
    company_id: str, link_id: str, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> None:
    try:
        service.delete_link(ctx, link_id)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.patch(
    "/companies/{company_id}/transaction-links/{link_id}/booking-status",
    response_model=TransactionLinkResponse,
)
def update_link_booking_status(
    company_id: str,
    link_id: str,
    body: BookingStatusUpdate,
    ctx: Schreibrecht,
    service: ZahlungenServiceDep,
) -> TransactionLinkResponse:
    try:
        return service.set_booking_status(ctx, link_id, body.booking_status)
    except ZahlungenError as exc:
        raise _http(exc) from exc


# --- Kassenbuch -------------------------------------------------------------


@router.get("/cashbook", response_model=CashbookResponse)
def get_cashbook(
    ctx: Leserecht,
    service: ZahlungenServiceDep,
    account_id: Annotated[str, Query(alias="accountId", min_length=1)],
    month: Annotated[str, Query(min_length=7, max_length=7, pattern=r"^\d{4}-\d{2}$")],
) -> CashbookResponse:
    """Kassenbuch eines Monats: Anfangsbestand, Einträge mit laufendem Saldo,
    Summen, Endbestand. Kasse = Zahlungskonto vom Typ `cash`."""
    try:
        return service.get_cashbook(ctx, account_id, month)
    except ZahlungenError as exc:
        raise _http(exc) from exc


@router.post(
    "/cashbook/entries", response_model=BankTransactionResponse, status_code=status.HTTP_201_CREATED
)
def create_cashbook_entry(
    body: CashbookEntryCreate, ctx: Schreibrecht, service: ZahlungenServiceDep
) -> BankTransactionResponse:
    """Ein-/Auszahlung. Der Kassenbestand darf an keinem Tag negativ werden (422)."""
    try:
        return service.create_cashbook_entry(ctx, body)
    except ZahlungenError as exc:
        raise _http(exc) from exc
