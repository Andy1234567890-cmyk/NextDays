"""Bereich »artikel« der Buchhaltung — Artikelstamm (`billing_items`).

Gemountet über bereiche/__init__.py unter /api/v1/buchhaltung. Jede Route
trägt `Leserecht`/`Schreibrecht` aus ../../guards (Rolle 403 → Modul 402).

Pfade: `/items` (Liste, Anlegen), `/items/favorites`, `/items/categories`,
`/items/{id}` (Lesen, Ändern, Löschen), `/items/{id}/favorite`,
`/items/{id}/used`. Die festen Unterpfade stehen VOR `/items/{item_id}`,
sonst fängt der Parameter-Pfad „favorites" als ID ab.

ABGRENZUNG: `features/inventar` (0620) ist der Hausrat der Objekte — ein
anderer Slice mit anderen Guards. Hier geht es um die Preisliste der
Buchhaltung.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...guards import Leserecht, Schreibrecht
from .dependencies import ArtikelServiceDep
from .schemas import (
    LIMIT_MAX,
    LIMIT_VORGABE,
    BillingItemCreate,
    BillingItemResponse,
    BillingItemUpdate,
    CategoryResponse,
    FavoriteUpdate,
    UsedResponse,
)
from .service import ArtikelError

router = APIRouter(tags=["buchhaltung"])

_Limit = Annotated[int, Query(ge=1, le=LIMIT_MAX)]


def _http(exc: ArtikelError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/items", response_model=list[BillingItemResponse], response_model_by_alias=True)
def list_items(
    ctx: Leserecht,
    service: ArtikelServiceDep,
    search: Annotated[str | None, Query(max_length=120)] = None,
    category: Annotated[str | None, Query(max_length=80)] = None,
    only_active: Annotated[bool, Query(alias="onlyActive")] = False,
    favorites_only: Annotated[bool, Query(alias="favoritesOnly")] = False,
    limit: _Limit = LIMIT_VORGABE,
) -> list[BillingItemResponse]:
    """Artikel des Betriebs — Suche über Nummer/Bezeichnung/Beschreibung/
    Kategorie, Filter Kategorie / nur aktive / nur Favoriten; Favoriten zuerst."""
    try:
        return service.list_items(
            ctx,
            search=search,
            category=category,
            only_active=only_active,
            favorites_only=favorites_only,
            limit=limit,
        )
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.get(
    "/items/favorites", response_model=list[BillingItemResponse], response_model_by_alias=True
)
def list_favorites(
    ctx: Leserecht, service: ArtikelServiceDep, limit: _Limit = LIMIT_VORGABE
) -> list[BillingItemResponse]:
    """Aktive Favoriten — die Schnellauswahl des Positions-Editors."""
    try:
        return service.list_favorites(ctx, limit=limit)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.get(
    "/items/categories", response_model=list[CategoryResponse], response_model_by_alias=True
)
def list_categories(ctx: Leserecht, service: ArtikelServiceDep) -> list[CategoryResponse]:
    """Vergebene Kategorien mit Artikelanzahl (Filter + Vorschläge)."""
    try:
        return service.list_categories(ctx)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.post(
    "/items",
    response_model=BillingItemResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_item(
    body: BillingItemCreate, ctx: Schreibrecht, service: ArtikelServiceDep
) -> BillingItemResponse:
    """Artikel anlegen — Nummer aus dem Kreis „Artikel" (ART-), Währung aus
    Artikel oder Mandant (sonst 422), Steuersatz Pflicht."""
    try:
        return service.create_item(ctx, body)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.get("/items/{item_id}", response_model=BillingItemResponse, response_model_by_alias=True)
def get_item(item_id: str, ctx: Leserecht, service: ArtikelServiceDep) -> BillingItemResponse:
    try:
        return service.get_item(ctx, item_id)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.patch(
    "/items/{item_id}", response_model=BillingItemResponse, response_model_by_alias=True
)
def update_item(
    item_id: str, body: BillingItemUpdate, ctx: Schreibrecht, service: ArtikelServiceDep
) -> BillingItemResponse:
    try:
        return service.update_item(ctx, item_id, body)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: str, ctx: Schreibrecht, service: ArtikelServiceDep) -> Response:
    """Löschen nur, wenn nie übernommen (sonst 409 → deaktivieren)."""
    try:
        service.delete_item(ctx, item_id)
    except ArtikelError as exc:
        raise _http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/items/{item_id}/favorite",
    response_model=BillingItemResponse,
    response_model_by_alias=True,
)
def set_favorite(
    item_id: str, body: FavoriteUpdate, ctx: Schreibrecht, service: ArtikelServiceDep
) -> BillingItemResponse:
    """Favorit als Zielzustand setzen (idempotent)."""
    try:
        return service.set_favorite(ctx, item_id, body.is_favorite)
    except ArtikelError as exc:
        raise _http(exc) from exc


@router.post(
    "/items/{item_id}/used", response_model=UsedResponse, response_model_by_alias=True
)
def mark_used(item_id: str, ctx: Schreibrecht, service: ArtikelServiceDep) -> UsedResponse:
    """Verwendung zählen (atomar in der DB, 0669)."""
    try:
        return service.mark_used(ctx, item_id)
    except ArtikelError as exc:
        raise _http(exc) from exc
