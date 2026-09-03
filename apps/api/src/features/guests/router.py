"""Router für den guests-Slice (Enterprise-Gästekarte). Mount: /api/v1/guests.

Zugriff auf die Gästekarte erfordert PM_GUEST_DETAILS (sonst 403). Die
Feldsichtbarkeit (Name/Kontakt/Beträge/Ausweis) wird im Service über den
zentralen guest_masking-Helper maskiert.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .schemas import (
    AddressCreate,
    AddressResponse,
    ConsentCreate,
    ConsentListResponse,
    ConsentResponse,
    ContactCreate,
    ContactResponse,
    DocumentCreate,
    DocumentResponse,
    DuplicateListResponse,
    GuestCreate,
    GuestListResponse,
    GuestResponse,
    GuestUpdate,
    IdentityDocCreate,
    IdentityDocResponse,
    ListResponse,
    MergeRequest,
    NoteCreate,
    NoteResponse,
    PreferencesBase,
    PreferencesResponse,
    SliceHealth,
)
from .service import GuestsError, GuestsService


def get_guests_service() -> GuestsService:
    return GuestsService(service_client=get_service_client())


GuestsServiceDep = Annotated[GuestsService, Depends(get_guests_service)]

# Lesen der Gästekarte erfordert PM_GUEST_DETAILS (Gäste-Detail-Modul).
_guest = Annotated[
    AuthContext, Depends(require_granular_permission(Permission.PM_GUEST_DETAILS))
]
# Schreiben (anlegen/ändern/löschen + Sub-Ressourcen) erfordert EDIT_GUEST.
_edit = Annotated[
    AuthContext, Depends(require_granular_permission(Permission.EDIT_GUEST))
]

router = APIRouter(prefix="/guests", tags=["guests"])


def _h(exc: GuestsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# Health bleibt offen (kein Tenant nötig) — Smoke-Endpoint.
@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return GuestsService().health()


# --- Gäste: Liste / CRUD ----------------------------------------------------
@router.get("", response_model=GuestListResponse)
def list_guests(
    service: GuestsServiceDep, ctx: _guest,
    q: Annotated[str | None, Query()] = None,
    vip: Annotated[str | None, Query()] = None,
    segment: Annotated[str | None, Query()] = None,
    blocked: Annotated[bool | None, Query()] = None,
    # Filter „Unvollständig": Gäste, bei denen der Kanal keinen Namen geliefert
    # hat (Airbnb nie) oder deren Merkmale beim Anlegen mehrdeutig waren.
    # Ohne diesen Filter gäbe es keinen Weg, die Nachpflege gezielt anzugehen.
    needs_review: Annotated[bool | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GuestListResponse:
    try:
        return service.list(
            ctx, q=q, vip=vip, segment=segment, blocked=blocked,
            needs_review=needs_review, limit=limit, offset=offset,
        )
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("", response_model=GuestResponse)
def create_guest(
    req: GuestCreate, service: GuestsServiceDep, ctx: _edit
) -> GuestResponse:
    try:
        return service.create(ctx, req)
    except GuestsError as exc:
        raise _h(exc) from exc


# WICHTIG: vor `/{guest_id}` deklarieren — sonst matcht die Pfad-Route zuerst
# und „duplicates" landet als guest_id im Detail-Endpunkt (404 statt Liste).
@router.get("/duplicates", response_model=DuplicateListResponse)
def list_duplicates(
    service: GuestsServiceDep, ctx: _guest,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> DuplicateListResponse:
    """Mögliche Dubletten der Gästekartei — Vorschlag, keine Automatik."""
    try:
        return service.duplicates(ctx, limit=limit)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/merge")
def merge_guests(
    req: MergeRequest, service: GuestsServiceDep, ctx: _edit
) -> dict:
    try:
        return service.merge(ctx, req.source_id, req.target_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.get("/{guest_id}", response_model=GuestResponse)
def get_guest(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> GuestResponse:
    try:
        return service.get(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.patch("/{guest_id}", response_model=GuestResponse)
def update_guest(
    guest_id: str, req: GuestUpdate, service: GuestsServiceDep, ctx: _edit
) -> GuestResponse:
    try:
        return service.update(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}")
def delete_guest(
    guest_id: str, service: GuestsServiceDep, ctx: _edit
) -> dict:
    try:
        return service.delete(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Adressen ---------------------------------------------------------------
@router.get("/{guest_id}/addresses", response_model=ListResponse)
def list_addresses(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.list_addresses(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/addresses", response_model=AddressResponse)
def add_address(
    guest_id: str, req: AddressCreate, service: GuestsServiceDep, ctx: _edit
) -> AddressResponse:
    try:
        return service.add_address(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}/addresses/{address_id}", status_code=204)
def delete_address(
    guest_id: str, address_id: str, service: GuestsServiceDep, ctx: _edit
) -> None:
    try:
        service.delete_address(ctx, guest_id, address_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Kontakte ---------------------------------------------------------------
@router.get("/{guest_id}/contacts", response_model=ListResponse)
def list_contacts(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.list_contacts(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/contacts", response_model=ContactResponse)
def add_contact(
    guest_id: str, req: ContactCreate, service: GuestsServiceDep, ctx: _edit
) -> ContactResponse:
    try:
        return service.add_contact(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}/contacts/{contact_id}", status_code=204)
def delete_contact(
    guest_id: str, contact_id: str, service: GuestsServiceDep, ctx: _edit
) -> None:
    try:
        service.delete_contact(ctx, guest_id, contact_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Identitätsdokumente (DSGVO-sensibel) -----------------------------------
@router.get("/{guest_id}/identity-documents", response_model=ListResponse)
def list_identity_docs(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.list_identity_docs(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/identity-documents", response_model=IdentityDocResponse)
def add_identity_doc(
    guest_id: str, req: IdentityDocCreate, service: GuestsServiceDep, ctx: _edit
) -> IdentityDocResponse:
    try:
        return service.add_identity_doc(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}/identity-documents/{doc_id}", status_code=204)
def delete_identity_doc(
    guest_id: str, doc_id: str, service: GuestsServiceDep, ctx: _edit
) -> None:
    try:
        service.delete_identity_doc(ctx, guest_id, doc_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Präferenzen ------------------------------------------------------------
@router.get("/{guest_id}/preferences", response_model=PreferencesResponse)
def get_preferences(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> PreferencesResponse:
    try:
        return service.get_preferences(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.put("/{guest_id}/preferences", response_model=PreferencesResponse)
def save_preferences(
    guest_id: str, req: PreferencesBase, service: GuestsServiceDep, ctx: _edit
) -> PreferencesResponse:
    try:
        return service.save_preferences(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Consents (append-only) -------------------------------------------------
@router.get("/{guest_id}/consents", response_model=ConsentListResponse)
def list_consents(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ConsentListResponse:
    try:
        return service.list_consents(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/consents", response_model=ConsentResponse)
def add_consent(
    guest_id: str, req: ConsentCreate, service: GuestsServiceDep, ctx: _edit
) -> ConsentResponse:
    try:
        return service.add_consent(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Notizen (intern) -------------------------------------------------------
@router.get("/{guest_id}/notes", response_model=ListResponse)
def list_notes(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.list_notes(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/notes", response_model=NoteResponse)
def add_note(
    guest_id: str, req: NoteCreate, service: GuestsServiceDep, ctx: _edit
) -> NoteResponse:
    try:
        return service.add_note(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}/notes/{note_id}", status_code=204)
def delete_note(
    guest_id: str, note_id: str, service: GuestsServiceDep, ctx: _edit
) -> None:
    try:
        service.delete_note(ctx, guest_id, note_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Dokumente --------------------------------------------------------------
@router.get("/{guest_id}/documents", response_model=ListResponse)
def list_documents(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.list_documents(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.post("/{guest_id}/documents", response_model=DocumentResponse)
def add_document(
    guest_id: str, req: DocumentCreate, service: GuestsServiceDep, ctx: _edit
) -> DocumentResponse:
    try:
        return service.add_document(ctx, guest_id, req)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.delete("/{guest_id}/documents/{doc_id}", status_code=204)
def delete_document(
    guest_id: str, doc_id: str, service: GuestsServiceDep, ctx: _edit
) -> None:
    try:
        service.delete_document(ctx, guest_id, doc_id)
    except GuestsError as exc:
        raise _h(exc) from exc


# --- Joins ------------------------------------------------------------------
@router.get("/{guest_id}/reservations", response_model=ListResponse)
def guest_reservations(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.reservations(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.get("/{guest_id}/threads", response_model=ListResponse)
def guest_threads(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.threads(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc


@router.get("/{guest_id}/invoices", response_model=ListResponse)
def guest_invoices(
    guest_id: str, service: GuestsServiceDep, ctx: _guest
) -> ListResponse:
    try:
        return service.invoices(ctx, guest_id)
    except GuestsError as exc:
        raise _h(exc) from exc
