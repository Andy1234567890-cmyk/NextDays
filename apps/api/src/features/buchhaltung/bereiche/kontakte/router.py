"""Bereich »kontakte« der Buchhaltung: Ansprechpartner, Anschriften und Notizen
je Kunde, Kundenübersicht, Lieferantenliste.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route
trägt `Leserecht`/`Schreibrecht` aus ../../guards.py (Rollen-Guard + Modul-3-
Entitlement) — keine eigenen Guards. Der Kunden-Bestand (`/customers` CRUD)
liegt weiterhin in ../../router.py; hier hängen nur die Unterressourcen.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import KontakteServiceDep
from .schemas import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    CustomerOverview,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
)
from .service import LISTEN_LIMIT_MAX, KontakteError

router = APIRouter(tags=["buchhaltung"])

_Suche = Annotated[str | None, Query(max_length=200)]
_Limit = Annotated[int | None, Query(ge=1, le=LISTEN_LIMIT_MAX)]


def _http(exc: KontakteError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Ansprechpartner -----------------------------------------------------------


@router.get("/customers/{customer_id}/contacts", response_model=list[ContactResponse])
def list_contacts(
    customer_id: str, ctx: Leserecht, service: KontakteServiceDep
) -> list[ContactResponse]:
    try:
        return service.list_contacts(ctx, customer_id)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.post(
    "/customers/{customer_id}/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contact(
    customer_id: str, body: ContactCreate, ctx: Schreibrecht, service: KontakteServiceDep
) -> ContactResponse:
    try:
        return service.create_contact(ctx, customer_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.patch("/customers/{customer_id}/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    customer_id: str,
    contact_id: str,
    body: ContactUpdate,
    ctx: Schreibrecht,
    service: KontakteServiceDep,
) -> ContactResponse:
    try:
        return service.update_contact(ctx, customer_id, contact_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.delete(
    "/customers/{customer_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_contact(
    customer_id: str, contact_id: str, ctx: Schreibrecht, service: KontakteServiceDep
) -> None:
    try:
        service.delete_contact(ctx, customer_id, contact_id)
    except KontakteError as exc:
        raise _http(exc) from exc


# --- Anschriften ---------------------------------------------------------------


@router.get("/customers/{customer_id}/addresses", response_model=list[AddressResponse])
def list_addresses(
    customer_id: str, ctx: Leserecht, service: KontakteServiceDep
) -> list[AddressResponse]:
    try:
        return service.list_addresses(ctx, customer_id)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.post(
    "/customers/{customer_id}/addresses",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_address(
    customer_id: str, body: AddressCreate, ctx: Schreibrecht, service: KontakteServiceDep
) -> AddressResponse:
    try:
        return service.create_address(ctx, customer_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.patch("/customers/{customer_id}/addresses/{address_id}", response_model=AddressResponse)
def update_address(
    customer_id: str,
    address_id: str,
    body: AddressUpdate,
    ctx: Schreibrecht,
    service: KontakteServiceDep,
) -> AddressResponse:
    try:
        return service.update_address(ctx, customer_id, address_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.delete(
    "/customers/{customer_id}/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_address(
    customer_id: str, address_id: str, ctx: Schreibrecht, service: KontakteServiceDep
) -> None:
    try:
        service.delete_address(ctx, customer_id, address_id)
    except KontakteError as exc:
        raise _http(exc) from exc


# --- Notizen -------------------------------------------------------------------


@router.get("/customers/{customer_id}/notes", response_model=list[NoteResponse])
def list_notes(customer_id: str, ctx: Leserecht, service: KontakteServiceDep) -> list[NoteResponse]:
    try:
        return service.list_notes(ctx, customer_id)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.post(
    "/customers/{customer_id}/notes",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    customer_id: str, body: NoteCreate, ctx: Schreibrecht, service: KontakteServiceDep
) -> NoteResponse:
    try:
        return service.create_note(ctx, customer_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.patch("/customers/{customer_id}/notes/{note_id}", response_model=NoteResponse)
def update_note(
    customer_id: str,
    note_id: str,
    body: NoteUpdate,
    ctx: Schreibrecht,
    service: KontakteServiceDep,
) -> NoteResponse:
    try:
        return service.update_note(ctx, customer_id, note_id, body)
    except KontakteError as exc:
        raise _http(exc) from exc


@router.delete("/customers/{customer_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    customer_id: str, note_id: str, ctx: Schreibrecht, service: KontakteServiceDep
) -> None:
    try:
        service.delete_note(ctx, customer_id, note_id)
    except KontakteError as exc:
        raise _http(exc) from exc


# --- Übersicht -----------------------------------------------------------------


@router.get("/customers/{customer_id}/overview", response_model=CustomerOverview)
def get_overview(
    customer_id: str,
    ctx: Leserecht,
    service: KontakteServiceDep,
    limit: _Limit = None,
) -> CustomerOverview:
    """Kennzahlen je Währung (Umsatz, offen, überfällig, Anzahl, letzter Beleg)
    und die letzten `limit` Belege des Kunden — serverseitig aus Decimal."""
    try:
        return service.get_overview(ctx, customer_id, limit=limit)
    except KontakteError as exc:
        raise _http(exc) from exc


# --- Lieferanten ---------------------------------------------------------------


@router.get("/suppliers")
def list_suppliers(
    ctx: Leserecht,
    service: KontakteServiceDep,
    search: _Suche = None,
    name: _Suche = None,
    email: _Suche = None,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
) -> list[dict]:
    """Lieferanten = `customers` mit `is_supplier`; Filter wie `/customers`."""
    try:
        return service.list_suppliers(ctx, search=search, name=name, email=email, limit=limit)
    except KontakteError as exc:
        raise _http(exc) from exc
