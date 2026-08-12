"""Router für owner_billing. Gemountet unter /api/v1/owner-billing.

AUTORISIERUNG (Wurzel 9): jede Route hängt an einer Capability, nicht nur an
`get_current_user`. Die Klassifikation entscheidet, welche Erträge der Betrieb
für sich behält, der Vertrag trägt den vereinbarten Provisionssatz — beides
sind Konditionen des Geschäfts und keine Stammdaten, die jeder Angemeldete
sehen darf (§4.3: staff/cleaner kein Finanz-/Vertriebseinblick; §4.2: der
Eigentümer selbst erst recht nicht — er ist die Gegenpartei der Vereinbarung).

Der Item-Pfad prüft denselben Scope wie der List-Pfad: die `{id}`-Routen laden
tenant-gescoped über `_require_own_terms` und finden eine fremde ID nicht.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import OwnerBillingServiceDep
from .schemas import (
    FeeClassificationBatchUpsert,
    FeeClassificationUebersicht,
    OwnerBillingTermsCreate,
    OwnerBillingTermsListResponse,
    OwnerBillingTermsResponse,
    OwnerBillingTermsUpdate,
    PortalAbzugssatzCreate,
    PortalAbzugssatzListResponse,
    PortalAbzugssatzResponse,
    PortalAbzugssatzUpdate,
    SliceHealth,
)
from .service import BillingError

router = APIRouter(prefix="/owner-billing", tags=["owner-billing"])

# Der Vertrag ist Eigentümer-Verwaltung: wer Eigentümer pflegt, pflegt ihre
# Konditionen. Dieselbe Capability wie `/owners`, damit nicht zwei Rechte
# dasselbe Aufgabengebiet abdecken und mit der Zeit auseinanderlaufen.
_MANAGE_OWNERS = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_OWNERS
)

# Die Gebühren-Klassifikation hängt an den Gebühren des Objekts und wird in
# der Objekt-Preispflege bedient — deshalb dieselbe Capability wie dort.
_MANAGE_PROPERTIES = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_PROPERTIES
)

OwnersCtx = Annotated[AuthContext, Depends(_MANAGE_OWNERS)]
PropertiesCtx = Annotated[AuthContext, Depends(_MANAGE_PROPERTIES)]


def _http(exc: BillingError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: OwnerBillingServiceDep) -> SliceHealth:
    return service.health()


# ----------------------------------------------------------------------
# Gebühren-Klassifikation
# ----------------------------------------------------------------------


@router.get("/fee-classification", response_model=FeeClassificationUebersicht)
def fee_classification_uebersicht(
    service: OwnerBillingServiceDep,
    ctx: PropertiesCtx,
) -> FeeClassificationUebersicht:
    """Die Zuordnungsmaske: welche Gebührenarten der Betrieb wirklich benutzt
    und was davon bereits zugeordnet ist."""
    try:
        return service.uebersicht(ctx)
    except BillingError as exc:
        raise _http(exc) from exc


@router.put("/fee-classification", response_model=FeeClassificationUebersicht)
def fee_classification_setzen(
    req: FeeClassificationBatchUpsert,
    service: OwnerBillingServiceDep,
    ctx: PropertiesCtx,
) -> FeeClassificationUebersicht:
    """Zuordnungen setzen. PUT, weil die Maske den Stand als Ganzes bestätigt.

    Antwortet mit der neuen Übersicht, damit die Maske nicht nachladen muss und
    die Zahl der offenen Punkte nicht kurzzeitig veraltet dasteht.
    """
    try:
        return service.klassifikation_setzen(ctx, req)
    except BillingError as exc:
        raise _http(exc) from exc


@router.delete(
    "/fee-classification/{klassifikation_id}",
    response_model=FeeClassificationUebersicht,
)
def fee_classification_loeschen(
    klassifikation_id: str,
    service: OwnerBillingServiceDep,
    ctx: PropertiesCtx,
) -> FeeClassificationUebersicht:
    """Eine Zuordnung entfernen (z. B. eine Objekt-Ausnahme aufheben)."""
    try:
        return service.klassifikation_loeschen(ctx, klassifikation_id)
    except BillingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Abrechnungsvertrag
# ----------------------------------------------------------------------


@router.get(
    "/owners/{owner_id}/terms", response_model=OwnerBillingTermsListResponse
)
def terms_liste(
    owner_id: str,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> OwnerBillingTermsListResponse:
    """Die vollständige Vertragshistorie eines Eigentümers, nicht nur der
    aktuell gültige Vertrag."""
    try:
        return service.vertraege_liste(ctx, owner_id)
    except BillingError as exc:
        raise _http(exc) from exc


@router.post(
    "/owners/{owner_id}/terms",
    response_model=OwnerBillingTermsResponse,
    status_code=status.HTTP_201_CREATED,
)
def terms_anlegen(
    owner_id: str,
    req: OwnerBillingTermsCreate,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> OwnerBillingTermsResponse:
    """Einen Vertrag anlegen. Eine Ablösung ist ein NEUER Vertrag ab Datum X,
    kein Überschreiben des alten — sonst wäre sie rückwirkend."""
    try:
        return service.vertrag_anlegen(ctx, owner_id, req)
    except BillingError as exc:
        raise _http(exc) from exc


@router.patch("/terms/{terms_id}", response_model=OwnerBillingTermsResponse)
def terms_aendern(
    terms_id: str,
    req: OwnerBillingTermsUpdate,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> OwnerBillingTermsResponse:
    """Einen Vertrag korrigieren (Tippfehler im Satz, nachgetragene Befristung)."""
    try:
        return service.vertrag_aendern(ctx, terms_id, req)
    except BillingError as exc:
        raise _http(exc) from exc


@router.delete("/terms/{terms_id}", status_code=status.HTTP_204_NO_CONTENT)
def terms_loeschen(
    terms_id: str,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> None:
    """Einen versehentlich angelegten Vertrag entfernen."""
    try:
        service.vertrag_loeschen(ctx, terms_id)
    except BillingError as exc:
        raise _http(exc) from exc


# ----------------------------------------------------------------------
# Portal-Abzugssätze (0364)
# ----------------------------------------------------------------------
# Dieselbe Capability wie die Verträge: beides sind Abrechnungs-Konditionen des
# Betriebs, und zwei Rechte für dasselbe Aufgabengebiet liefen mit der Zeit
# auseinander. Der Satz bestimmt echtes Geld — er darf nicht an einer Route mit
# bloßer Authentifizierung hängen (Wurzel 9).


@router.get("/portal-saetze", response_model=PortalAbzugssatzListResponse)
def saetze_liste(
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> PortalAbzugssatzListResponse:
    """Alle Portal-Abzugssätze des Betriebs samt Historie."""
    try:
        return service.saetze_liste(ctx)
    except BillingError as exc:
        raise _http(exc) from exc


@router.post(
    "/portal-saetze",
    response_model=PortalAbzugssatzResponse,
    status_code=status.HTTP_201_CREATED,
)
def satz_anlegen(
    req: PortalAbzugssatzCreate,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> PortalAbzugssatzResponse:
    """Einen Satz anlegen. Eine Satzänderung des Portals ist ein NEUER Satz ab
    Datum X, kein Überschreiben — sonst wirkte sie rückwirkend."""
    try:
        return service.satz_anlegen(ctx, req)
    except BillingError as exc:
        raise _http(exc) from exc


@router.patch(
    "/portal-saetze/{satz_id}", response_model=PortalAbzugssatzResponse
)
def satz_aendern(
    satz_id: str,
    req: PortalAbzugssatzUpdate,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> PortalAbzugssatzResponse:
    """Einen Satz korrigieren (Tippfehler, nachgetragene Befristung)."""
    try:
        return service.satz_aendern(ctx, satz_id, req)
    except BillingError as exc:
        raise _http(exc) from exc


@router.delete(
    "/portal-saetze/{satz_id}", status_code=status.HTTP_204_NO_CONTENT
)
def satz_loeschen(
    satz_id: str,
    service: OwnerBillingServiceDep,
    ctx: OwnersCtx,
) -> None:
    """Einen versehentlich angelegten Satz entfernen."""
    try:
        service.satz_loeschen(ctx, satz_id)
    except BillingError as exc:
        raise _http(exc) from exc
