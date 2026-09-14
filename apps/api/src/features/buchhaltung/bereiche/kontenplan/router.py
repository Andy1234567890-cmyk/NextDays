"""Bereich »kontenplan« der Buchhaltung — Buchungskonten, Kostenstellen,
Nummernkreise, Zahlungsarten.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route
trägt `Leserecht`/`Schreibrecht` aus ../../guards.py (Rollen-Guard + Modul 3).

Pfade so gewählt, dass der Bestand (`web/services/bookingAccountService.ts`,
TASKILO-ABGLEICH §3d) passt: er ruft `POST /booking-accounts/{company}`,
`PATCH`/`DELETE /booking-accounts/{company}/{id}` — `company` wird ignoriert,
der Tenant kommt aus dem JWT (Wurzel 3). `GET /booking-accounts/{company}`
liegt weiterhin im Bestands-Router (../../router.py) und liefert dort `[]`
— Koordinator-Aufgabe, siehe BERICHT.

BEWUSST KEIN `POST /number-sequences/next` (GoBD, siehe ../../router.py):
Nummern zieht nur der Server beim Speichern eines Belegs.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import KontenplanServiceDep
from .schemas import (
    LIMIT_MAX,
    AccountType,
    BookingAccountCreate,
    BookingAccountResponse,
    BookingAccountUpdate,
    CostCenterCreate,
    CostCenterResponse,
    CostCenterUpdate,
    CreateDefaultsResult,
    ImportStandardResult,
    Kontenrahmen,
    NumberSequenceUpdate,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from .service import KontenplanError

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int | None, Query(ge=1, le=LIMIT_MAX)]


def _http(exc: KontenplanError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Buchungskonten -----------------------------------------------------------


@router.get("/booking-accounts")
def list_booking_accounts(
    ctx: Leserecht,
    service: KontenplanServiceDep,
    type_: Annotated[AccountType | None, Query(alias="type")] = None,
    active: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: _Limit = None,
) -> list[BookingAccountResponse]:
    """Kontenplan des Betriebs, nach Nummer sortiert; optional nach Typ,
    aktiv und Suchbegriff (Nummer oder Name) gefiltert."""
    try:
        return service.list_booking_accounts(
            ctx, type_=type_, active=active, search=search, limit=limit
        )
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/booking-accounts", status_code=status.HTTP_201_CREATED)
def create_booking_account(
    data: BookingAccountCreate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> BookingAccountResponse:
    try:
        return service.create_booking_account(ctx, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/booking-accounts/import-standard")
def import_standard_accounts(
    kontenrahmen: Kontenrahmen, ctx: Schreibrecht, service: KontenplanServiceDep
) -> ImportStandardResult:
    """Standardkonten (SKR03 oder SKR04) anlegen — idempotent: vorhandene
    Nummern werden übersprungen, nicht überschrieben."""
    try:
        return service.import_standard(ctx, kontenrahmen)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/booking-accounts/{company_id}", status_code=status.HTTP_201_CREATED)
def create_booking_account_bestand(
    company_id: str,
    data: BookingAccountCreate,
    ctx: Schreibrecht,
    service: KontenplanServiceDep,
) -> BookingAccountResponse:
    """Bestands-Pfad (`bookingAccountService.createBookingAccount`)."""
    try:
        return service.create_booking_account(ctx, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.put("/booking-accounts/{account_id}")
@router.patch("/booking-accounts/{account_id}")
def update_booking_account(
    account_id: str,
    data: BookingAccountUpdate,
    ctx: Schreibrecht,
    service: KontenplanServiceDep,
) -> BookingAccountResponse:
    try:
        return service.update_booking_account(ctx, account_id, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.delete("/booking-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking_account(
    account_id: str, ctx: Schreibrecht, service: KontenplanServiceDep
) -> Response:
    """Systemkonten und bebuchte Konten → 409 (nur deaktivieren)."""
    try:
        service.delete_booking_account(ctx, account_id)
    except KontenplanError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/booking-accounts/{company_id}/{account_id}")
@router.patch("/booking-accounts/{company_id}/{account_id}")
def update_booking_account_bestand(
    company_id: str,
    account_id: str,
    data: BookingAccountUpdate,
    ctx: Schreibrecht,
    service: KontenplanServiceDep,
) -> BookingAccountResponse:
    """Bestands-Pfad (`bookingAccountService.updateBookingAccount`)."""
    try:
        return service.update_booking_account(ctx, account_id, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.delete(
    "/booking-accounts/{company_id}/{account_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_booking_account_bestand(
    company_id: str, account_id: str, ctx: Schreibrecht, service: KontenplanServiceDep
) -> Response:
    """Bestands-Pfad (`bookingAccountService.deleteBookingAccount`)."""
    try:
        service.delete_booking_account(ctx, account_id)
    except KontenplanError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Kostenstellen -------------------------------------------------------------


@router.get("/cost-centers")
def list_cost_centers(
    ctx: Leserecht,
    service: KontenplanServiceDep,
    active: bool | None = None,
    limit: _Limit = None,
) -> list[CostCenterResponse]:
    try:
        return service.list_cost_centers(ctx, active=active, limit=limit)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/cost-centers", status_code=status.HTTP_201_CREATED)
def create_cost_center(
    data: CostCenterCreate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> CostCenterResponse:
    try:
        return service.create_cost_center(ctx, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.put("/cost-centers/{center_id}")
@router.patch("/cost-centers/{center_id}")
def update_cost_center(
    center_id: str, data: CostCenterUpdate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> CostCenterResponse:
    try:
        return service.update_cost_center(ctx, center_id, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.delete("/cost-centers/{center_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_center(
    center_id: str, ctx: Schreibrecht, service: KontenplanServiceDep
) -> Response:
    try:
        service.delete_cost_center(ctx, center_id)
    except KontenplanError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Zahlungsarten -------------------------------------------------------------


@router.get("/payment-methods")
def list_payment_methods(
    ctx: Leserecht,
    service: KontenplanServiceDep,
    active: bool | None = None,
    limit: _Limit = None,
) -> list[PaymentMethodResponse]:
    try:
        return service.list_payment_methods(ctx, active=active, limit=limit)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/payment-methods", status_code=status.HTTP_201_CREATED)
def create_payment_method(
    data: PaymentMethodCreate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> PaymentMethodResponse:
    try:
        return service.create_payment_method(ctx, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.put("/payment-methods/{method_id}")
@router.patch("/payment-methods/{method_id}")
def update_payment_method(
    method_id: str, data: PaymentMethodUpdate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> PaymentMethodResponse:
    try:
        return service.update_payment_method(ctx, method_id, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.delete("/payment-methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(
    method_id: str, ctx: Schreibrecht, service: KontenplanServiceDep
) -> Response:
    try:
        service.delete_payment_method(ctx, method_id)
    except KontenplanError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Nummernkreise -------------------------------------------------------------


@router.post("/number-sequences/create-defaults")
def create_default_sequences(
    ctx: Schreibrecht, service: KontenplanServiceDep
) -> CreateDefaultsResult:
    """Fehlende Nummernkreise (Rechnung, Angebot, Kunde …) anlegen — idempotent."""
    try:
        return service.create_default_sequences(ctx)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.post("/number-sequences/{company_id}/create-defaults")
def create_default_sequences_bestand(
    company_id: str, ctx: Schreibrecht, service: KontenplanServiceDep
) -> CreateDefaultsResult:
    """Bestands-Pfad (alter `numberSequenceService.createDefaults`)."""
    try:
        return service.create_default_sequences(ctx)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.patch("/number-sequences/{sequence}")
def update_number_sequence(
    sequence: str, data: NumberSequenceUpdate, ctx: Schreibrecht, service: KontenplanServiceDep
) -> dict:
    """Präfix/Suffix/Stellen eines Kreises (`Rechnung` oder `invoice`); der
    Startwert nur, solange noch keine Nummer gezogen wurde (sonst 409)."""
    try:
        return service.update_number_sequence(ctx, sequence, data)
    except KontenplanError as exc:
        raise _http(exc) from exc


@router.patch("/number-sequences/{company_id}/{sequence}")
def update_number_sequence_bestand(
    company_id: str,
    sequence: str,
    data: NumberSequenceUpdate,
    ctx: Schreibrecht,
    service: KontenplanServiceDep,
) -> dict:
    """Bestands-Pfad (alter `numberSequenceService.updateSequence`)."""
    try:
        return service.update_number_sequence(ctx, sequence, data)
    except KontenplanError as exc:
        raise _http(exc) from exc
