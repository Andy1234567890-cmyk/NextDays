"""Bereich »versand« der Buchhaltung — Belegversand, Versand-Protokoll, Textvorlagen.

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route
trägt `Leserecht`/`Schreibrecht` aus ../../guards (Rollen-Guard + Modul 3).

Pfade folgen den Aufrufen des Bestands (Abgleich §3c/§3d):
  * `POST /email/send-document`  — EmailSendModal (`/api/v1/email/send-document`)
  * `POST /send-invoice-email`   — EmailDialog (`/api/v1/send-invoice-email`)
  * `POST/PATCH/PUT/DELETE /text-templates/{company}[/{id}]` — TextTemplateService.ts
Der Bestands-Stub `GET /text-templates/{company_id}` und `/default` liegen in
../../router.py und bleiben dort (Koordinator-Aufgabe: auf diesen Service
umleiten); hier gibt es die Liste zusätzlich unter `GET /text-templates`.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from src.core.ki import KiError, VertexClient

from ...guards import Leserecht, Schreibrecht
from .dependencies import VersandServiceDep
from .ki_textbaustein import (
    KiTextbausteinAntwort,
    KiTextbausteinRequest,
    textbaustein_erzeugen,
)
from .schemas import (
    LIMIT_MAX,
    DocumentSendListResponse,
    DocumentSendResponse,
    SendDocumentRequest,
    SendDocumentResult,
    SendInvoiceEmailRequest,
    TextTemplateCreate,
    TextTemplateRenderRequest,
    TextTemplateRenderResponse,
    TextTemplateResponse,
    TextTemplateUpdate,
)
from .service import VersandServiceError

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=LIMIT_MAX)]
_Filter = Annotated[str | None, Query(max_length=40)]
_Id = Annotated[str | None, Query(max_length=120)]


def _http(exc: VersandServiceError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Versand -----------------------------------------------------------------


@router.post("/email/send-document", response_model=SendDocumentResult)
def send_document(
    body: SendDocumentRequest, ctx: Schreibrecht, service: VersandServiceDep
) -> SendDocumentResult:
    """Beleg per Mail (EmailSendModal). Idempotent innerhalb von 60 s."""
    try:
        return service.send_document(ctx, body)
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.post("/send-invoice-email", response_model=SendDocumentResult)
def send_invoice_email(
    body: SendInvoiceEmailRequest, ctx: Schreibrecht, service: VersandServiceDep
) -> SendDocumentResult:
    """Rechnung per Mail (EmailDialog) — Alias auf `send_document` mit der
    flachen Body-Form des älteren Dialogs."""
    try:
        return service.send_document(ctx, body.als_send_document())
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.get("/document-sends", response_model=DocumentSendListResponse)
def list_document_sends(
    ctx: Leserecht,
    service: VersandServiceDep,
    document_id: _Id = None,
    document_type: _Filter = None,
    limit: _Limit = 100,
) -> DocumentSendListResponse:
    """Versand-Verlauf, optional je Beleg (`?document_id=`)."""
    try:
        items = service.list_sends(
            ctx, document_id=document_id, document_type=document_type, limit=limit
        )
    except VersandServiceError as exc:
        raise _http(exc) from exc
    return DocumentSendListResponse(items=items, total=len(items))


@router.get("/document-sends/{send_id}", response_model=DocumentSendResponse)
def get_document_send(
    send_id: str, ctx: Leserecht, service: VersandServiceDep
) -> DocumentSendResponse:
    try:
        return service.get_send(ctx, send_id)
    except VersandServiceError as exc:
        raise _http(exc) from exc


# --- Textvorlagen ------------------------------------------------------------


@router.get("/text-templates", response_model=list[TextTemplateResponse])
def list_text_templates(
    ctx: Leserecht,
    service: VersandServiceDep,
    category: _Filter = None,
    object_type: Annotated[str | None, Query(alias="objectType", max_length=40)] = None,
    text_type: Annotated[str | None, Query(alias="textType", max_length=40)] = None,
    language: Annotated[str | None, Query(max_length=8)] = None,
) -> list[TextTemplateResponse]:
    """Textvorlagen des Betriebs (private nur für den Ersteller)."""
    try:
        return service.list_text_templates(
            ctx, category=category, object_type=object_type, text_type=text_type, language=language
        )
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.post("/text-templates/ki", response_model=KiTextbausteinAntwort)
def ki_textbaustein(
    body: KiTextbausteinRequest, ctx: Schreibrecht, service: VersandServiceDep
) -> KiTextbausteinAntwort:
    """Kopf-/Fußtext per KI vorschlagen (Buchhaltung → Textvorlagen → „Mit KI erzeugen")."""
    try:
        return textbaustein_erzeugen(service.db, VertexClient(), ctx, body)
    except KiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/text-templates/render", response_model=TextTemplateRenderResponse)
def render_text_template(
    body: TextTemplateRenderRequest, ctx: Leserecht, service: VersandServiceDep
) -> TextTemplateRenderResponse:
    """Platzhalter serverseitig aus dem Beleg füllen."""
    try:
        return service.render_text_template(ctx, body)
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.post(
    "/text-templates/{company_id}",
    response_model=TextTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_text_template(
    company_id: str, body: TextTemplateCreate, ctx: Schreibrecht, service: VersandServiceDep
) -> TextTemplateResponse:
    """`company_id` ist Altlast (Bestands-Pfad) — autoritativ ist der Tenant."""
    try:
        return service.create_text_template(ctx, body)
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.get("/text-templates/{company_id}/{template_id}", response_model=TextTemplateResponse)
def get_text_template(
    company_id: str, template_id: str, ctx: Leserecht, service: VersandServiceDep
) -> TextTemplateResponse:
    try:
        return service.get_text_template(ctx, template_id)
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.patch("/text-templates/{company_id}/{template_id}", response_model=TextTemplateResponse)
@router.put("/text-templates/{company_id}/{template_id}", response_model=TextTemplateResponse)
def update_text_template(
    company_id: str,
    template_id: str,
    body: TextTemplateUpdate,
    ctx: Schreibrecht,
    service: VersandServiceDep,
) -> TextTemplateResponse:
    """PATCH (TextTemplateService.ts) und PUT (Auftrag) — derselbe Teil-Update."""
    try:
        return service.update_text_template(ctx, template_id, body)
    except VersandServiceError as exc:
        raise _http(exc) from exc


@router.delete("/text-templates/{company_id}/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_text_template(
    company_id: str, template_id: str, ctx: Schreibrecht, service: VersandServiceDep
) -> Response:
    try:
        service.delete_text_template(ctx, template_id)
    except VersandServiceError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
