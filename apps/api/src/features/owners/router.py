"""Router für owners (verwaltete Eigentümer). Gemountet unter /api/v1/owners.

Alle Schreib-/Lese-Endpunkte sind MANAGE_OWNERS-geschützt (Agentur-Rolle) und
tenant-gescoped. Eigentümer-Stammdaten + Objekt-Zuordnung mit Anteil/Provision.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext, get_current_user
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability, has_capability

from .dependencies import OwnersServiceDep
from .schemas import (
    AvailablePropertiesResponse,
    OwnerCreate,
    OwnerListResponse,
    OwnerPropertiesAssign,
    OwnerPropertyAssign,
    OwnerResponse,
    OwnerUpdate,
    SliceHealth,
)
from .service import OwnerError

router = APIRouter(prefix="/owners", tags=["owners"])

# Wiederverwendete Permission-Dependency für alle Eigentümer-Endpunkte.
_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_OWNERS
)

# Portalzugang = einen LOGIN anlegen. Das ist eine andere Befugnis als das
# Pflegen von Eigentümer-Stammdaten, deshalb wird sie ZUSÄTZLICH verlangt
# (Wurzel 9): wer Eigentümer verwalten darf, darf damit noch lange keine
# Zugänge zum System vergeben. Beide Guards laufen als getrennte Dependencies
# — FastAPI wertet sie beide aus, es genügt also nicht, eine zu erfüllen.
_MANAGE_STAFF = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_STAFF
)


def _hat_manage_staff(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> bool:
    """MANAGE_STAFF vorhanden? — als Auskunft, nicht als Sperre.

    `require_permission` wirft sofort 403 und taugt deshalb nicht für den
    Anlege-Endpunkt: dort ist die Zusatz-Berechtigung nur nötig, WENN
    `portalzugang` gesetzt ist. Ein Guard an der Route würde sonst auch das
    reine Anlegen von Stammdaten für alle sperren, die keine Zugänge vergeben
    dürfen. Die Entscheidung trifft der Endpunkt, diese Dependency liefert ihr
    nur die Tatsache.
    """
    return has_capability(ctx.role, Capability.MANAGE_STAFF)


@router.get("/health", response_model=SliceHealth)
def health(service: OwnersServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=OwnerListResponse)
def list_owners(
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerListResponse:
    try:
        return service.list(ctx)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=OwnerResponse, status_code=status.HTTP_201_CREATED)
def create_owner(
    req: OwnerCreate,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    darf_zugang_vergeben: Annotated[bool, Depends(_hat_manage_staff)],
) -> OwnerResponse:
    """Eigentümer anlegen — mit `portalzugang=true` samt Login + Einladungsmail.

    Der Zusatz-Guard hängt am FLAG, nicht an der Route: das reine Anlegen von
    Stammdaten bleibt bei MANAGE_OWNERS, nur das Vergeben eines Zugangs
    verlangt zusätzlich MANAGE_STAFF (Wurzel 9). Als Dependency statt als
    Prüfung im Dienst, damit die Rechtefrage im Router sichtbar bleibt.
    """
    if req.portalzugang and not darf_zugang_vergeben:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zum Einrichten eines Portalzugangs fehlt die Berechtigung.",
        )
    try:
        return service.create(ctx, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{owner_id}/portalzugang", response_model=OwnerResponse)
def portalzugang_einladen(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    _staff: Annotated[AuthContext, Depends(_MANAGE_STAFF)],
) -> OwnerResponse:
    """Portalzugang für einen bestehenden Eigentümer nachträglich einrichten.

    Verlangt BEIDE Berechtigungen (Stammdaten UND Zugangsvergabe) und denselben
    Tenant-Scope wie der List-Pfad — der Dienst lädt die Zeile über
    `_get_row(tenant_id, owner_id)` und wirft 404 bei einem fremden Mandanten.
    """
    try:
        return service.portalzugang_einladen(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{owner_id}/portalzugang/erneut-senden",
    status_code=status.HTTP_204_NO_CONTENT,
)
def portalzugang_erneut_senden(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    _staff: Annotated[AuthContext, Depends(_MANAGE_STAFF)],
) -> None:
    """Die Zugangs-Einladung an einen bereits eingeladenen Eigentümer erneut senden.

    Dieselben BEIDEN Berechtigungen wie das erstmalige Einrichten: eine erneute
    Einladung erzeugt einen neuen gültigen Zugangslink zu einem Login und ist
    damit eine Handlung der Zugangsvergabe, nicht der Stammdatenpflege
    (Wurzel 9). Der Dienst lädt den Eigentümer über denselben Scope-Helfer wie
    der List-Pfad und antwortet bei fremdem Mandanten mit 404.

    204 statt der Eigentümer-Zeile: an den Stammdaten ändert sich nichts. Der
    Zustand „hat Zugang" stand vorher schon und steht danach immer noch.
    """
    try:
        service.einladung_erneut_senden(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/free-properties", response_model=AvailablePropertiesResponse)
def free_properties(
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AvailablePropertiesResponse:
    """Objekte OHNE Eigentümer — die Auswahl im Anlege-Dialog.

    Steht bewusst VOR `GET /{owner_id}`: FastAPI wertet Routen in
    Deklarationsreihenfolge aus, und ein fester Pfad nach einer
    Platzhalter-Route wäre nie erreichbar (`free-properties` würde als
    `owner_id` gelesen und ergäbe ein 404).
    """
    try:
        return service.free_properties(ctx)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{owner_id}", response_model=OwnerResponse)
def get_owner(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.get(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{owner_id}", response_model=OwnerResponse)
def update_owner(
    owner_id: str,
    req: OwnerUpdate,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.update(ctx, owner_id, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/{owner_id}/available-properties", response_model=AvailablePropertiesResponse
)
def available_properties(
    owner_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> AvailablePropertiesResponse:
    """Objekte, die diesem Owner zugeordnet werden dürfen (frei oder bereits sein).
    Objekte anderer Eigentümer fehlen — ein Objekt gehört genau einem Owner."""
    try:
        return service.available_properties(ctx, owner_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{owner_id}/properties", response_model=OwnerResponse)
def assign_property(
    owner_id: str,
    req: OwnerPropertyAssign,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    """Objekt zuordnen oder Anteil/Provisions-Override aktualisieren."""
    try:
        return service.assign_property(ctx, owner_id, req)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{owner_id}/properties/batch", response_model=OwnerResponse)
def assign_properties(
    owner_id: str,
    req: OwnerPropertiesAssign,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    """Mehrere Objekte auf einmal zuordnen (Mehrfachauswahl der Detailseite).

    Eigener Pfad statt einer Liste im bestehenden `POST /properties`: dort
    gehören Anteil und Provisions-Override zum Vorgang, hier ausdrücklich
    nicht. Derselbe Tenant-Scope wie List- und Einzel-Pfad (Wurzel 9) — jede
    einzelne ID wird im Dienst gegen die Objekte dieses Mandanten geprüft.

    Der feste Zusatz `/batch` steht VOR der `{property_id}`-Route in diesem
    Modul irrelevant, weil jene nur DELETE bedient; die POST-Pfade
    (`/properties` und `/properties/batch`) sind eindeutig verschieden.
    """
    try:
        return service.assign_properties(ctx, owner_id, req.property_ids)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{owner_id}/properties/{property_id}", response_model=OwnerResponse)
def unassign_property(
    owner_id: str,
    property_id: str,
    service: OwnersServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> OwnerResponse:
    try:
        return service.unassign_property(ctx, owner_id, property_id)
    except OwnerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
