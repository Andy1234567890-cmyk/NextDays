"""Bereich »belege« der Buchhaltung — Belegkette und wiederkehrende Rechnungen.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route trägt
`Leserecht`/`Schreibrecht` aus ../../guards.py (Rollen-Guard + Modul-3-
Entitlement); der Tenant kommt ausschließlich aus `ctx`.

Pfade:
  GET   /documents?type=…            Liste je Belegart (quote|order_confirmation|
                                     delivery_note|invoice|credit_note|storno|recurring)
  POST  /documents?type=…            Beleg aus dem EINEN Editor anlegen (Entwurf)
  POST  /documents/recurring/run     fällige Vorlagen → Entwurfsrechnungen (idempotent)
  GET   /documents/{id}?type=…       Detail mit Positionen und Folgebelegen
  POST  /documents/{id}/convert      Kette: quote→AB→LS→Rechnung, Rechnung→Gutschrift
  POST  /documents/{id}/finalize     Nummer aus dem Kreis der Belegart, festschreiben
  POST  /documents/{id}/recurring    Rechnung → wiederkehrende Vorlage
  PATCH /documents/{id}/recurring    Intervall/Status/Termine der Vorlage

Die statische Route `/documents/recurring/run` steht VOR `/documents/{id}/…`,
damit FastAPI sie nicht als id liest.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import BelegeServiceDep
from .schemas import (
    Belegart,
    ConvertRequest,
    DocumentCreate,
    DocumentListResponse,
    DocumentResponse,
    RecurringCreate,
    RecurringRunResult,
    RecurringUpdate,
)
from .service import BelegeError

router = APIRouter(tags=["buchhaltung"])

_Typ = Annotated[Belegart, Query(alias="type")]
_Limit = Annotated[int, Query(ge=1, le=500)]


def _http(exc: BelegeError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/documents", response_model=DocumentListResponse)
def list_documents(
    ctx: Leserecht,
    service: BelegeServiceDep,
    typ: _Typ = "invoice",
    status_filter: Annotated[str | None, Query(alias="status", max_length=40)] = None,
    customer_id: Annotated[str | None, Query(max_length=64)] = None,
    limit: _Limit = 100,
) -> DocumentListResponse:
    try:
        return service.list_documents(
            ctx, typ=typ, status=status_filter, customer_id=customer_id, limit=limit
        )
    except BelegeError as exc:
        raise _http(exc) from exc


@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    body: DocumentCreate,
    ctx: Schreibrecht,
    service: BelegeServiceDep,
    typ: _Typ = "invoice",
) -> DocumentResponse:
    try:
        return service.create_document(ctx, typ=typ, body=body)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.post("/documents/recurring/run", response_model=RecurringRunResult)
def run_recurring(ctx: Schreibrecht, service: BelegeServiceDep) -> RecurringRunResult:
    try:
        return service.run_recurring(ctx)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    ctx: Leserecht,
    service: BelegeServiceDep,
    typ: _Typ = "invoice",
) -> DocumentResponse:
    try:
        return service.get_document(ctx, document_id, typ=typ)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.post(
    "/documents/{document_id}/convert",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def convert_document(
    document_id: str,
    body: ConvertRequest,
    ctx: Schreibrecht,
    service: BelegeServiceDep,
) -> DocumentResponse:
    try:
        return service.convert(ctx, document_id, body)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.post("/documents/{document_id}/finalize", response_model=DocumentResponse)
def finalize_document(
    document_id: str, ctx: Schreibrecht, service: BelegeServiceDep
) -> DocumentResponse:
    try:
        return service.finalize(ctx, document_id)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.post(
    "/documents/{document_id}/recurring",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recurring(
    document_id: str,
    body: RecurringCreate,
    ctx: Schreibrecht,
    service: BelegeServiceDep,
) -> DocumentResponse:
    try:
        return service.create_recurring(ctx, document_id, body)
    except BelegeError as exc:
        raise _http(exc) from exc


@router.patch("/documents/{document_id}/recurring", response_model=DocumentResponse)
def update_recurring(
    document_id: str,
    body: RecurringUpdate,
    ctx: Schreibrecht,
    service: BelegeServiceDep,
) -> DocumentResponse:
    try:
        return service.update_recurring(ctx, document_id, body)
    except BelegeError as exc:
        raise _http(exc) from exc
