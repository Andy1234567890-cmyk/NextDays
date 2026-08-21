"""Router für die VERWALTUNG der Entwickler-Zugänge. Gemountet unter /api/v1.

Hier legt der Betriebs-Admin API-Clients an, sieht sie, rotiert und widerruft
sie — geschützt per Supabase-Login (MANAGE_TENANT). Das ist eine Funktion des
Dashboards, deshalb sitzt sie in dieser API.

Die NUTZUNG der Zugänge sitzt nicht mehr hier: der Token-Tausch
(client_credentials) und alle öffentlichen Ressourcen-Endpunkte liegen im
eigenen Service `apps/public-api` (POST https://api.mynextdays.dk/v1/oauth/token).
Vorher stand der Token-Endpunkt in diesem Router. Er ist dorthin UMGEZOGEN und
nicht kopiert: zwei Stellen, die Tokens ausgeben, wären zwei Wahrheiten über
Gültigkeitsdauer, Audience und Widerruf — und der Entwickler müsste zwei Hosts
ansprechen, um eine API zu benutzen.

Geteilt bleibt genau zweierlei, beides bewusst: die Tabelle `api_clients` (die
Zugänge selbst) und `scopes.py` (der Katalog der vergebbaren Rechte, als
byte-identische Schwesterdatei).
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
    SCOPE_KATALOG,
    ApiClientCreate,
    ApiClientCreated,
    ApiClientResponse,
    ScopeInfo,
    SliceHealth,
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


@router.get("/api-clients/scopes", response_model=list[ScopeInfo])
def list_scopes(ctx: _admin) -> list[ScopeInfo]:
    """Vergebbare Scopes samt Beschreibung — die Auswahlliste des Dashboards.

    Kommt aus `scopes.py`, damit das Frontend keine zweite Liste führt. Eine
    handgepflegte Kopie im Frontend hätte genau den Fehler erzeugt, den der
    Katalog verhindert: eine Auswahl, die die öffentliche API nicht kennt.
    """
    del ctx  # nur zur Autorisierung (MANAGE_TENANT)
    return [
        ScopeInfo(scope=s, beschreibung=b) for s, b in sorted(SCOPE_KATALOG.items())
    ]


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
