"""Router für den Entwickler-API-Zugang. Gemountet unter /api/v1.

Zwei Wege:
  • Verwaltung (/api-clients/*): der Betriebs-Admin legt Clients an, sieht sie,
    rotiert/widerruft sie — geschützt per Supabase-Login (MANAGE_TENANT).
  • Token-Tausch (/oauth/token): ÖFFENTLICH (kein Login) — der Entwickler tauscht
    Client-ID + Secret gegen ein kurzlebiges Access-Token. Eigener strenger
    Rate-Limit-Bucket (Wurzel 8).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth import demo_zugang
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .schemas import (
    ApiClientCreate,
    ApiClientCreated,
    ApiClientResponse,
    SliceHealth,
    TokenRequest,
    TokenResponse,
)
from .service import ApiClientError, ApiClientsService

router = APIRouter(tags=["api_clients"])


def get_service() -> ApiClientsService:
    return ApiClientsService(service_client=get_service_client())


ServiceDep = Annotated[ApiClientsService, Depends(get_service)]
# Nur der Betriebs-Admin (Konto-Verwaltung) darf API-Clients verwalten.
_admin = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_TENANT))
]


def _handle(exc: ApiClientError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/api-clients/health", response_model=SliceHealth)
def health(service: ServiceDep) -> SliceHealth:
    return service.health()


@router.get("/api-clients", response_model=list[ApiClientResponse])
def list_clients(ctx: _admin, service: ServiceDep) -> list[ApiClientResponse]:
    """Integrationszugaenge des Betriebs.

    NICHT im Vorfuehr-Mandanten (0407): der Zugang ist oeffentlich, und hier
    stehen die Kennungen der Maschinen-Zugaenge samt Scopes und erlaubten
    Objekten. Heute ist die Liste dort leer — genau deshalb wird sie jetzt
    geschlossen und nicht erst, wenn der erste Zugang entsteht und ihn niemand
    mehr im Blick hat.

    Leere Liste statt 403: es ist eine Anzeige. Ein Fehler liesse die
    Einstellungsseite der Vorfuehrung kaputt aussehen.
    """
    if demo_zugang.ist_vorfuehrung(ctx.tenant_id):
        return []
    try:
        rows = service.list_clients(ctx)
    except ApiClientError as exc:
        raise _handle(exc) from exc
    return [ApiClientResponse(**_row(r)) for r in rows]


@router.post("/api-clients", response_model=ApiClientCreated)
def create_client(
    body: ApiClientCreate, ctx: _admin, service: ServiceDep
) -> ApiClientCreated:
    try:
        row = service.create_client(
            ctx,
            name=body.name,
            is_test=body.is_test,
            scopes=body.scopes,
            property_ids=body.property_ids,
        )
    except ApiClientError as exc:
        raise _handle(exc) from exc
    return ApiClientCreated(**_row(row), client_secret=row["client_secret"])


@router.post("/api-clients/{client_pk}/rotate", response_model=ApiClientCreated)
def rotate_secret(
    client_pk: str, ctx: _admin, service: ServiceDep
) -> ApiClientCreated:
    try:
        row = service.rotate_secret(ctx, client_pk)
    except ApiClientError as exc:
        raise _handle(exc) from exc
    return ApiClientCreated(**_row(row), client_secret=row["client_secret"])


@router.delete("/api-clients/{client_pk}", status_code=204)
def revoke_client(client_pk: str, ctx: _admin, service: ServiceDep) -> None:
    try:
        service.revoke_client(ctx, client_pk)
    except ApiClientError as exc:
        raise _handle(exc) from exc


@router.post("/oauth/token", response_model=TokenResponse)
def issue_token(body: TokenRequest, service: ServiceDep) -> TokenResponse:
    """Client-Credentials → kurzlebiges Access-Token (1 h). KEIN Login — die
    Client-Zugangsdaten sind der Nachweis. Eigener Rate-Limit-Bucket (Wurzel 8)."""
    if body.grant_type != "client_credentials":
        raise HTTPException(
            status_code=400, detail="grant_type muss client_credentials sein."
        )
    try:
        tok = service.issue_token(
            client_id=body.client_id, client_secret=body.client_secret
        )
    except ApiClientError as exc:
        raise _handle(exc) from exc
    return TokenResponse(**tok)


def _row(r: dict) -> dict:
    """DB-Zeile → Response-Schema (Listen glätten, Timestamps stringifizieren)."""
    return {
        "id": str(r["id"]),
        "client_id": r["client_id"],
        "name": r["name"],
        "is_test": bool(r.get("is_test")),
        "scopes": list(r.get("scopes") or []),
        "property_ids": [str(p) for p in (r.get("property_ids") or [])],
        "secret_last4": r.get("secret_last4") or "",
        "revoked_at": str(r["revoked_at"]) if r.get("revoked_at") else None,
        "last_used_at": str(r["last_used_at"]) if r.get("last_used_at") else None,
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
    }
