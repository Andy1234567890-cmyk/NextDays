"""Router für public_portal. Gemountet unter /api/v1/public-portal.

Eigentümer-Self-Service-Portal (§4.2): der eingeloggte Eigentümer sieht NUR seine
zugeordneten Objekte, Beträge/Gäste maskiert. Endpunkte sind über die Owner-
Capabilities gated; der Objekt-Scope wird zusätzlich im Service erzwungen.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import Capability
from src.features.owner_chat.fehler import OwnerChatError
from src.features.owner_chat.schemas import (
    ChatFaden,
    ChatFadenListe,
    ChatNachricht,
    ChatVerlauf,
    EmpfaengerGeraet,
    EmpfaengerListe,
    NachrichtSenden,
)
from src.features.owner_statements.schemas import StatementResponse

from .aufgaben import TaskError
from .dependencies import (
    DienstleistungsServiceDep,
    OwnerFamilyServiceDep,
    PortalAufgabenServiceDep,
    PortalChatServiceDep,
    PublicPortalServiceDep,
    require_portal_recht,
)
from .dienstleistungen import DienstleistungError
from .familie import FamilieError
from .schemas import (
    AufhebungAntrag,
    BestellbareLeistungen,
    BlockRequestCreate,
    BlockRequestItem,
    BlockRequestList,
    MeterReadingCreate,
    MeterReadingItem,
    MeterReadingList,
    PortalCalendarResponse,
    PortalEarningsResponse,
    PortalFinanzUebersicht,
    PortalImageList,
    PortalPhotoAlbum,
    PortalPropertyDetail,
    PortalPropertyList,
    PortalSeasonList,
    PortalStatementList,
    PortalStatisticsResponse,
    ReservationMoveRequest,
    SliceHealth,
)
from .schemas_aufgaben import PortalTaskItem, PortalTaskList
from .schemas_dienstleistungen import (
    ServiceRequestCreate,
    ServiceRequestItem,
    ServiceRequestList,
    ServiceTypeList,
)
from .schemas_familie import (
    FamilienZugangCreate,
    FamilienZugangCreated,
    FamilienZugangItem,
    FamilienZugangList,
    FamilienZugangUpdate,
    FreigabeAntragItem,
    FreigabeAntragList,
    FreigabeEntscheidung,
    PortalRolleInfo,
)
from .service import PortalError

router = APIRouter(prefix="/public-portal", tags=["public_portal"])

# Wiederverwendete Permission-Dependencies (Callables, kein Konstanten-Naming).
_VIEW = require_permission(Capability.VIEW_CALENDAR)  # noqa: N816  pylint: disable=invalid-name
_REPORTS = require_permission(Capability.VIEW_OWNER_REPORTS)  # noqa: N816  pylint: disable=invalid-name
_BLOCK = require_permission(Capability.REQUEST_BLOCK)  # noqa: N816  pylint: disable=invalid-name
# Eigenes Recht, NICHT `_BLOCK`: eine fremde Gastbuchung umzulegen ist etwas
# anderes, als sich selbst Tage zu wünschen — und `REQUEST_BLOCK` tragen auch
# Familienmitglieder.
_MOVE = require_permission(Capability.MOVE_OWN_RESERVATION)  # noqa: N816  pylint: disable=invalid-name
_METER = require_permission(Capability.ADD_METER_READING)  # noqa: N816  pylint: disable=invalid-name
# Eigene Aufgaben (03.09.2026): dasselbe Recht wie im Tasks-Slice. Der
# Eigentümer trägt es seit heute; den Objekt-/Zuweisungs-Scope erzwingt der
# TasksService, nicht diese Route.
_TASKS = require_permission(Capability.VIEW_OWN_TASKS)  # noqa: N816  pylint: disable=invalid-name


@router.get("/health", response_model=SliceHealth)
def health(service: PublicPortalServiceDep) -> SliceHealth:
    return service.health()


@router.get("/properties", response_model=PortalPropertyList)
def my_properties(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
) -> PortalPropertyList:
    try:
        return service.my_properties(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/calendar", response_model=PortalCalendarResponse)
def calendar(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> PortalCalendarResponse:
    try:
        return service.calendar(ctx, property_id, start, end)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/seasons", response_model=PortalSeasonList)
def seasons(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
    property_id: Annotated[str, Query()],
) -> PortalSeasonList:
    """Saisons eines eigenen Objekts (Name, Farbe, Zeiträume) für den Kalender.

    Dasselbe Recht wie `/calendar` (VIEW_CALENDAR): wer den Kalender sehen darf,
    darf auch wissen, wie seine Tage gefärbt sind. Den Objekt-Scope erzwingt
    der Service (404 bei fremdem Objekt), nicht diese Route.
    """
    try:
        return service.seasons(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/earnings", response_model=PortalEarningsResponse)
def earnings(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTS)],
    period_from: Annotated[date, Query()],
    period_to: Annotated[date, Query()],
) -> PortalEarningsResponse:
    try:
        return service.earnings(ctx, period_from, period_to)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/statements", response_model=PortalStatementList)
def my_statements(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTS)],
) -> PortalStatementList:
    try:
        return service.my_statements(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/statements/{statement_id}", response_model=StatementResponse)
def statement_detail(
    statement_id: str,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_REPORTS)],
) -> StatementResponse:
    """Der vollständige Beleg EINER eigenen, finalisierten Abrechnung — für
    die Beleg-Ansicht der Eigentümer-App. Scope und Maske kommen aus dem
    Abrechnungs-Slice (siehe Service)."""
    try:
        return service.statement_detail(ctx, statement_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/finanzen", response_model=PortalFinanzUebersicht)
def finanzen(  # noqa: PLR0913 — Query-Parameter der Finanzübersicht
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    property_id: Annotated[str | None, Query()] = None,
    event: Annotated[str, Query(pattern="^(calendar|check_in)$")] = "calendar",
    compare: Annotated[bool, Query()] = False,
) -> PortalFinanzUebersicht:
    """Zeitreihe der Startseite: Netto-Auszahlung, Nächte, Auslastung je Tag
    oder Monat, optional mit dem Vorjahreszeitraum. Hängt wie der Kalender an
    VIEW_CALENDAR; das Geld unterdrückt der Service ohne Finanzfreigabe."""
    try:
        return service.finanzen(
            ctx,
            date_from,
            date_to,
            property_id=property_id,
            event=event,
            compare=compare,
        )
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/move",
    status_code=status.HTTP_204_NO_CONTENT,
)
def move_reservation(
    reservation_id: str,
    req: ReservationMoveRequest,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_MOVE)],
) -> None:
    """Eine Buchung an SEINEM Objekt auf andere Tage ziehen (08.09.2026).

    Drag-and-Drop im Kalender der Eigentümer-App. Gerechnet wird mit der Kette
    des Reservations-Slices (alte Nächte freigeben, neue belegen, Portale
    nachziehen); den Objekt-Scope erzwingt der Service, nicht diese Route
    (Wurzel 9).
    """
    try:
        service.move_reservation(ctx, reservation_id, req)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/block-requests",
    response_model=BlockRequestItem,
    status_code=status.HTTP_201_CREATED,
)
def request_block(
    req: BlockRequestCreate,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BlockRequestItem:
    try:
        return service.request_block(ctx, req)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/block-requests/leistungen/{property_id}",
    response_model=BestellbareLeistungen,
)
def bestellbare_leistungen(
    property_id: str,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BestellbareLeistungen:
    """Welche Leistungen der Eigentümer zu einer Sperre bestellen kann (0510).

    Der Pfad liegt UNTER `/block-requests`, weil die Liste nur im Zusammenhang
    mit einem Sperrantrag existiert — es ist kein allgemeiner Blick in die
    Aufgabenverwaltung des Betriebs.
    """
    try:
        return service.bestellbare_leistungen(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/block-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_block_request(
    request_id: str,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> None:
    """Einen NOCH OFFENEN Sperrantrag zurueckziehen (0513).

    DELETE und nicht POST, weil der Antrag wirklich verschwindet: es ist nichts
    gesperrt, solange nichts genehmigt ist, also bleibt auch nichts zurueck.
    Ein genehmigter Antrag laesst sich hierueber NICHT loeschen — dafuer gibt es
    den Aufhebungswunsch unten, den die Agentur entscheidet.
    """
    try:
        service.zurueckziehen(ctx, request_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/block-requests/{request_id}/aufhebung",
    response_model=BlockRequestItem,
)
def request_block_lift(
    request_id: str,
    req: AufhebungAntrag,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BlockRequestItem:
    """Die Aufhebung einer GENEHMIGTEN Sperrung beantragen (0513).

    Nur ein Antrag: die Sperrung besteht weiter, bis die Agentur entscheidet.
    Der Eigentuemer kann sie nicht selbst aufloesen (§4.2) — daran haengen eine
    Reservierung, die Kalenderbelegung und der Push an die Portale.
    """
    try:
        return service.aufhebung_beantragen(ctx, request_id, req.grund)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/block-requests", response_model=BlockRequestList)
def my_block_requests(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> BlockRequestList:
    try:
        return service.my_block_requests(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/meter-readings",
    response_model=MeterReadingItem,
    status_code=status.HTTP_201_CREATED,
)
def add_meter_reading(
    req: MeterReadingCreate,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_METER)],
) -> MeterReadingItem:
    try:
        return service.add_meter_reading(ctx, req)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/meter-readings", response_model=MeterReadingList)
def meter_readings(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_METER)],
    property_id: Annotated[str, Query()],
) -> MeterReadingList:
    try:
        return service.meter_readings(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Objektbereich, Bilder, Fotoalbum, Statistik (lesend) -------------------
#
# Die vier Rechte, die der Eigentümer im Standard hat und für die es bis jetzt
# keine prüfende Stelle gab. Ein Recht ohne Guard ist ein Schalter ohne
# Funktion — das war hier die Ausgangslage.
#
# Jeder dieser Endpunkte hängt an ZWEI Prüfungen (`require_portal_recht`): der
# granularen Berechtigung aus der DATENBANK (Wurzel 7) und der Fähigkeit
# inklusive Familien-Deckelung (0389). Alle vier sind GET; es gibt bewusst
# keinen Schreibpfad — ein Eigentümer ist read-only (§4.2). Der Objekt-Scope
# kommt im Service oben drauf: fremde/unbekannte ID → 404, nie 403.

_AREA = require_portal_recht(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_PROPERTY_AREA, Capability.VIEW_PROPERTY_AREA
)
_IMAGES = require_portal_recht(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_VIEW_PROPERTY_IMAGES, Capability.VIEW_PROPERTY_AREA
)
_ALBUM = require_portal_recht(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_PHOTO_ALBUM, Capability.VIEW_PROPERTY_AREA
)
_STATS = require_portal_recht(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_NONREVENUE_CHARTS, Capability.VIEW_OCCUPANCY_STATS
)


@router.get("/properties/{property_id}", response_model=PortalPropertyDetail)
def property_detail(
    property_id: str,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_AREA)],
) -> PortalPropertyDetail:
    """Stammdaten/Beschreibung/Ausstattung EINES eigenen Objekts, lesend."""
    try:
        return service.property_detail(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get(
    "/properties/{property_id}/images", response_model=PortalImageList
)
def property_images(
    property_id: str,
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_IMAGES)],
) -> PortalImageList:
    """Die Bilder EINES eigenen Objekts."""
    try:
        return service.property_images(ctx, property_id)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/photo-album", response_model=PortalPhotoAlbum)
def photo_album(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_ALBUM)],
) -> PortalPhotoAlbum:
    """Die Bilder ALLER zugeordneten Objekte, je Objekt gruppiert."""
    try:
        return service.photo_album(ctx)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/statistics", response_model=PortalStatisticsResponse)
def statistics(
    service: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_STATS)],
    property_id: Annotated[str | None, Query()] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> PortalStatisticsResponse:
    """Belegung, Auslastung, Aufenthaltsdauer, Vorlaufzeit — OHNE Geld.

    Ohne `from`/`to`: die letzten zwölf Monate. Spanne > 730 Tage → 422
    (Wurzel 8). `property_id` außerhalb des Owner-Scopes → 404.
    """
    try:
        return service.statistics(ctx, property_id, date_from, date_to)
    except PortalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Dienstleistungen beauftragen (Etappe D) --------------------------------
# Eigener Service (`dienstleistungen.py`), weil der Auftrag ein SCHREIBpfad in
# einen fremden Slice (`tasks`) ist und nicht in den Portal-Lesepfad gehoert.

_SERVICES = require_permission(Capability.BOOK_SERVICES)  # noqa: N816  pylint: disable=invalid-name


@router.get("/service-types", response_model=ServiceTypeList)
def service_types(
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceTypeList:
    """Beauftragbare Leistungen: Systemvorgaben + eigene des Betriebs."""
    try:
        return service.catalog(ctx)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/service-requests",
    response_model=ServiceRequestItem,
    status_code=status.HTTP_201_CREATED,
)
def request_service(
    req: ServiceRequestCreate,
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceRequestItem:
    """Eine Dienstleistung beauftragen — landet als Aufgabe beim Betrieb.

    Idempotent (Wurzel 2): derselbe Auftrag am selben Tag liefert den
    BESTEHENDEN zurueck, statt eine zweite Reinigung auszuloesen. Der Status
    bleibt 201 — fuer den Aufrufer ist das Ergebnis dasselbe (der Auftrag steht),
    und ein 200-vs-201-Unterschied wuerde nur verraten, dass er doppelt geklickt
    hat.
    """
    try:
        return service.request_service(ctx, req)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/service-requests", response_model=ServiceRequestList)
def my_service_requests(
    service: DienstleistungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_SERVICES)],
) -> ServiceRequestList:
    """Die vom Eigentuemer SELBST beauftragten Leistungen — keine fremden
    Aufgaben des Betriebs (§4.3)."""
    try:
        return service.my_service_requests(ctx)
    except DienstleistungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Familienzugänge (0389) --------------------------------------------------
# Der Eigentümer lädt Angehörige mit EIGENEM Login ein und legt je Person und
# Objekt fest, was sie darf.
#
# WICHTIG — wer hier hineindarf: Alle folgenden Endpunkte hängen an
# `REQUEST_BLOCK`, das Familienmitglieder ebenfalls haben. Die Capability allein
# genügt hier also NICHT als Autorisierung (Wurzel 9: Authentifizierung ≠
# Autorisierung). Zwei unabhängige Riegel im Service:
#   * `_require_kein_mitglied` — wer selbst Familienzugang ist, verwaltet
#     nichts. Ohne diesen Riegel bestünde ein Mitglied die Objekt-Prüfung
#     mühelos (es DARF das Objekt ja sehen) und könnte jemanden einladen, dabei
#     eine Stufe vergeben, die der Eigentümer nie erlaubt hat, und würde als
#     `owner_user_id` selbst zum Freigabe-Anker.
#   * `owner_user_id = ich` in `_eigene_zeile` und `_antrag_in_meinem_scope` —
#     jeder Item-Zugriff prüft denselben Scope wie die Liste.
# Der zweite allein sah lange aus, als genügte er (ein Mitglied ist für
# niemanden Anker). Für die Einladung stimmte das nicht: dort ENTSTEHT der
# Anker erst. Deshalb beide.


# --- Eigene Aufgaben (03.09.2026) -------------------------------------------
# Manche Eigentümer reinigen oder empfangen selbst. Die Verwaltung weist ihnen
# die Aufgabe im Aufgaben-Popup zu; hier sehen sie sie und melden zurück.
# Portal UND Eigentümer-App sprechen ausschließlich diesen Weg.


@router.get("/tasks", response_model=PortalTaskList)
def my_tasks(
    service: PortalAufgabenServiceDep,
    ctx: Annotated[AuthContext, Depends(_TASKS)],
) -> PortalTaskList:
    """Nur die dem Eigentümer zugewiesenen Aufgaben an seinen Objekten —
    nicht die des Personals an seinem Haus (§4.3). Den Scope zieht der
    TasksService (Wurzel 9), die Liste hier ist nur die schmale Sicht."""
    try:
        return service.liste(ctx)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/tasks/{task_id}/start", response_model=PortalTaskItem)
def start_task(
    task_id: str,
    service: PortalAufgabenServiceDep,
    ctx: Annotated[AuthContext, Depends(_TASKS)],
) -> PortalTaskItem:
    """„Ich bin dran" — Arbeitszustand `in_progress`. Fremde Aufgabe = 404."""
    try:
        return service.anfangen(ctx, task_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/tasks/{task_id}/complete", response_model=PortalTaskItem)
def complete_task(
    task_id: str,
    service: PortalAufgabenServiceDep,
    ctx: Annotated[AuthContext, Depends(_TASKS)],
) -> PortalTaskItem:
    """Erledigt melden — mit Foto-Pflicht der Checkliste (422 im Klartext),
    dieselbe Regel wie für das Personal."""
    try:
        return service.erledigt(ctx, task_id)
    except TaskError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/familie/rolle", response_model=PortalRolleInfo)
def familie_rolle(
    service: OwnerFamilyServiceDep,
    ctx: Annotated[AuthContext, Depends(_VIEW)],
) -> PortalRolleInfo:
    """Was ist der eingeloggte Portal-Nutzer, und was darf er?

    Damit die Oberfläche keinen Menüpunkt zeigt, der in eine leere Liste oder
    einen 403 führt. Bewusst an `VIEW_CALENDAR` (hat jeder Portal-Nutzer) und
    nicht an `REQUEST_BLOCK`: Auch wer nichts verwalten darf, muss erfahren,
    dass er nichts verwalten darf.

    Die Antwort steuert nur die SICHTBARKEIT — jeder Endpunkt prüft seine
    Rechte weiterhin selbst (Wurzel 9).
    """
    try:
        return PortalRolleInfo(**service.eigene_rolle(ctx))
    except FamilieError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/familie", response_model=FamilienZugangList)
def familie_liste(
    service: OwnerFamilyServiceDep,
    portal: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> FamilienZugangList:
    """Die Familienzugänge, die DIESER Eigentümer vergeben hat."""
    try:
        ids = portal.owned_property_ids(ctx)
        rows = service.liste(ctx, ids)
    except (FamilieError, PortalError) as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    items = [
        FamilienZugangItem(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            property_id=str(r["property_id"]),
            access=r["access"],
            # Der eingebettete users-Datensatz kann fehlen, wenn der Login
            # inzwischen gelöscht wurde — dann bleibt der Name leer statt zu
            # raten (Wurzel 4).
            email=(r.get("users") or {}).get("email"),
            full_name=(r.get("users") or {}).get("full_name"),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]
    return FamilienZugangList(items=items, total=len(items))


@router.post(
    "/familie",
    response_model=FamilienZugangCreated,
    status_code=status.HTTP_201_CREATED,
)
def familie_einladen(
    req: FamilienZugangCreate,
    service: OwnerFamilyServiceDep,
    portal: PublicPortalServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> FamilienZugangCreated:
    """Ein Familienmitglied zu einem Objekt einladen.

    Der Login entsteht über denselben Einladungsweg wie bei der Agentur
    (`AuthService.invite`) — kein zweiter Mailpfad, der beim nächsten
    Sicherheitsfix vergessen würde.
    """
    try:
        # Objekt-Scope zuerst (Wurzel 3): sonst ließe sich über eine geratene
        # property_id jemand in ein FREMDES Objekt einladen.
        portal.require_own_property(ctx, req.property_id)
        zeile, versendet = service.einladen(
            ctx,
            property_id=req.property_id,
            email=str(req.email),
            full_name=req.full_name,
            access=req.access,
            sprache=req.preferred_language,
        )
    except (FamilieError, PortalError) as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return FamilienZugangCreated(
        zugang=FamilienZugangItem(
            id=str(zeile["id"]),
            user_id=str(zeile["user_id"]),
            property_id=str(zeile["property_id"]),
            access=zeile["access"],
            email=str(req.email),
            full_name=req.full_name,
            created_at=zeile.get("created_at"),
        ),
        einladung_versendet=versendet,
    )



@router.get("/familie/freigaben", response_model=FreigabeAntragList)
def freigaben_offen(
    service: OwnerFamilyServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> FreigabeAntragList:
    """Sperranträge der Familie, die auf meine Freigabe warten (Stufe 1)."""
    try:
        rows = service.offene_antraege(ctx)
        namen = service.antragsteller_namen(rows)
    except FamilieError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    items = [
        FreigabeAntragItem(
            id=str(r["id"]),
            property_id=str(r["property_id"]),
            unit_id=str(r["unit_id"]) if r.get("unit_id") else None,
            start_date=str(r["start_date"]),
            end_date=str(r["end_date"]),
            reason=r.get("reason"),
            created_at=r.get("created_at"),
            requested_by=str(r["requested_by"]),
            antragsteller=namen.get(str(r["requested_by"])),
        )
        for r in rows
    ]
    return FreigabeAntragList(items=items, total=len(items))


@router.post("/familie/freigaben/{antrag_id}", status_code=status.HTTP_204_NO_CONTENT)
def freigabe_entscheiden(
    antrag_id: str,
    req: FreigabeEntscheidung,
    service: OwnerFamilyServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> None:
    """Stufe 1 entscheiden.

    Freigeben reicht den Antrag an die Agentur weiter; ablehnen beendet ihn —
    die Agentur sieht ihn nie. In BEIDEN Fällen passiert am Kalender nichts:
    die Reservierung entsteht erst bei der Genehmigung durch die Agentur.
    """
    try:
        service.entscheiden(
            ctx, antrag_id, freigeben=req.freigeben, note=req.note
        )
    except FamilieError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

@router.patch("/familie/{mitglied_id}", response_model=FamilienZugangItem)
def familie_stufe_aendern(
    mitglied_id: str,
    req: FamilienZugangUpdate,
    service: OwnerFamilyServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> FamilienZugangItem:
    """Zugriffsstufe ändern — etwa Berichte nachträglich freigeben."""
    try:
        zeile = service.stufe_aendern(ctx, mitglied_id, req.access)
    except FamilieError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return FamilienZugangItem(
        id=str(zeile["id"]),
        user_id=str(zeile["user_id"]),
        property_id=str(zeile["property_id"]),
        access=zeile["access"],
        created_at=zeile.get("created_at"),
    )


@router.delete("/familie/{mitglied_id}", status_code=status.HTTP_204_NO_CONTENT)
def familie_entfernen(
    mitglied_id: str,
    service: OwnerFamilyServiceDep,
    ctx: Annotated[AuthContext, Depends(_BLOCK)],
) -> None:
    """Zugang entziehen — Familien-Zeile UND Objekt-Sichtbarkeit."""
    try:
        service.entfernen(ctx, mitglied_id)
    except FamilieError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Chat mit der Verwaltung (0611, ADR-0029) ---------------------------------
#
# Ende-zu-Ende verschlüsselt: Diese Endpunkte transportieren Chiffretext und
# verpackte Schlüssel. Kein Feld hier enthält lesbaren Text, auch nicht die
# Vorschau — es gibt keine.

_CHAT = require_portal_recht(  # noqa: N816  pylint: disable=invalid-name
    Permission.OWNER_CHAT, Capability.OWNER_CHAT
)


@router.get("/chat", response_model=ChatFadenListe)
def chat_faeden(
    service: PortalChatServiceDep,
    ctx: Annotated[AuthContext, Depends(_CHAT)],
) -> ChatFadenListe:
    """Ein Gesprächsfaden je Objekt — auch für Objekte ohne bisherige Nachricht."""
    try:
        return ChatFadenListe(items=[ChatFaden(**z) for z in service.faeden(ctx)])
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/chat/empfaenger/{property_id}", response_model=EmpfaengerListe)
def chat_empfaenger(
    property_id: str,
    service: PortalChatServiceDep,
    ctx: Annotated[AuthContext, Depends(_CHAT)],
) -> EmpfaengerListe:
    """Geräte, für die verschlüsselt werden muss. Der SERVER bestimmt den Kreis."""
    try:
        zeilen = service.empfaenger(ctx, property_id)
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return EmpfaengerListe(
        items=[
            EmpfaengerGeraet(
                device_id=str(z["id"]),
                public_key=str(z["public_key"]),
                seite=str(z["seite"]),
            )
            for z in zeilen
        ]
    )


@router.get("/chat/faden/{thread_id}", response_model=ChatVerlauf)
def chat_verlauf(
    thread_id: str,
    service: PortalChatServiceDep,
    ctx: Annotated[AuthContext, Depends(_CHAT)],
    device_id: Annotated[str | None, Query()] = None,
) -> ChatVerlauf:
    """Verlauf samt den für DIESES Gerät verpackten Schlüsseln."""
    try:
        roh = service.verlauf(ctx, thread_id, device_id=device_id)
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _verlauf_antwort(roh)


@router.post(
    "/chat/objekt/{property_id}", response_model=ChatNachricht, status_code=201
)
def chat_senden(
    property_id: str,
    req: NachrichtSenden,
    service: PortalChatServiceDep,
    ctx: Annotated[AuthContext, Depends(_CHAT)],
) -> ChatNachricht:
    """Nachricht des Eigentümers. Legt den Faden an, falls es der erste ist."""
    try:
        zeile = service.senden(
            ctx,
            property_id,
            chiffre=req.chiffre,
            schluessel=req.schluessel,
            bilder=req.bilder,
            sender_key=req.sender_key,
        )
    except OwnerChatError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return _zu_nachricht(zeile)


def _zu_nachricht(zeile: dict) -> ChatNachricht:
    return ChatNachricht(
        id=str(zeile["id"]),
        sender=str(zeile.get("sender") or ""),
        sender_name=str(zeile.get("sender_name") or ""),
        chiffre=str(zeile.get("body") or ""),
        sender_key=zeile.get("sender_key") or None,
        wrapped_key=zeile.get("wrapped_key"),
        wrapper_key=zeile.get("wrapper_key") or None,
        bilder=[b for b in (zeile.get("attachments") or []) if isinstance(b, str)],
        sent_at=zeile.get("sent_at"),
    )


def _verlauf_antwort(roh: dict) -> ChatVerlauf:
    return ChatVerlauf(
        thread_id=str(roh["thread_id"]),
        property_id=str(roh["property_id"]),
        property_title=roh.get("property_title"),
        items=[_zu_nachricht(z) for z in roh["items"]],
        nicht_lesbar=int(roh.get("nicht_lesbar") or 0),
    )
