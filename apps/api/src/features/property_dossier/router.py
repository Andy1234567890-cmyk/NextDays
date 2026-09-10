"""Router für property_dossier (8-stufige Objektkartei).

Gemountet unter /api/v1/property-dossier. Lesen UND Schreiben: MANAGE_PROPERTIES
(Kartei = Agentur-internes Objekt-Onboarding). Stufe 1 (Eigentümer) ist read-only
aus dem owners-Slice.

Das Lesen hing früher an VIEW_CALENDAR — der Fähigkeit, die auch die owner-Rolle
besitzt (§4.2). Die Kartei gibt aber Bankverbindung (IBAN/BIC), Steuer-/USt-ID und
CPR-Nummer des verknüpften Eigentümers heraus, dazu Türcodes/Alarm aus Stufe 3:
das ist keine Kalenderinformation, sondern Agentur-Innensicht. Wer die Kartei
pflegen darf (MANAGE_PROPERTIES: admin/co_admin), darf sie auch lesen; ein
Eigentümer hat dort nichts zu suchen — auch nicht bei seinem EIGENEN Objekt, denn
Stufe 4/5 (Serviceverträge, Handwerker-Konditionen) sind Vertriebsdaten der
Agentur (§4.2 read-only-Portal, kein Finanz-/Vertriebseinblick).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status

from src.core.security import CurrentUser
from src.core.uploads import MAX_UPLOAD_BYTES, read_upload_named
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import DossierServiceDep
from .mappe_felder import KATALOG
from .schemas import (
    AccessData,
    DossierFull,
    EmergencyAuthority,
    HousebookData,
    InventarAendernRequest,
    InventarAnlegenRequest,
    InventarGegenstand,
    InventarRaum,
    InventarRaumInput,
    InventarSchaden,
    LinkedOwner,
    MappeDokument,
    MappeDokumentVorschau,
    MappeFeldInfo,
    MappeUebernahmeErgebnis,
    MappeUebernahmeRequest,
    MarketingData,
    PlatformLaunchBase,
    PlatformLaunchResponse,
    ProcessData,
    SchadenBestaetigung,
    ServiceAgreementBase,
    ServiceAgreementResponse,
    SliceHealth,
    TradespersonBase,
    TradespersonResponse,
)
from .service import DossierError

router = APIRouter(prefix="/property-dossier", tags=["property_dossier"])

# Wiederverwendete Permission-Dependencies. Lesen und Schreiben verlangen
# dieselbe Fähigkeit (siehe Modul-Docstring); die zwei Namen bleiben, damit an
# jedem Endpunkt sichtbar ist, ob er liest oder pflegt.
_view = require_permission(Capability.MANAGE_PROPERTIES)
_manage = require_permission(Capability.MANAGE_PROPERTIES)
ViewCtx = Annotated[CurrentUser, Depends(_view)]
ManageCtx = Annotated[CurrentUser, Depends(_manage)]


def _handle(exc: DossierError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/health", response_model=SliceHealth)
def health(service: DossierServiceDep) -> SliceHealth:
    return service.health()


# --- Aggregat + Stufe 1 (Eigentümer read-only) ------------------------------
@router.get("/{property_id}/full", response_model=DossierFull)
def get_full(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> DossierFull:
    try:
        return service.get_full(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/owner", response_model=LinkedOwner | None)
def get_owner(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> LinkedOwner | None:
    try:
        return service.get_owner(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 2: Proces & Kontrakt ---------------------------------------------
@router.get("/{property_id}/process", response_model=ProcessData)
def get_process(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> ProcessData:
    try:
        return service.get_process(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/process", response_model=ProcessData)
def put_process(
    property_id: str, req: ProcessData, service: DossierServiceDep, ctx: ManageCtx
) -> ProcessData:
    try:
        return service.put_process(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 3: Adgang & Teknik -----------------------------------------------
@router.get("/{property_id}/access", response_model=AccessData)
def get_access(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> AccessData:
    try:
        return service.get_access(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/access", response_model=AccessData)
def put_access(
    property_id: str, req: AccessData, service: DossierServiceDep, ctx: ManageCtx
) -> AccessData:
    try:
        return service.put_access(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 4: Serviceaftaler (1:n) ------------------------------------------
@router.get("/{property_id}/service-agreements", response_model=list[ServiceAgreementResponse])
def list_service_agreements(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[ServiceAgreementResponse]:
    try:
        return service.list_service_agreements(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/service-agreements",
    response_model=ServiceAgreementResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_service_agreement(
    property_id: str, req: ServiceAgreementBase, service: DossierServiceDep, ctx: ManageCtx
) -> ServiceAgreementResponse:
    try:
        return service.add_service_agreement(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/service-agreements/{item_id}", response_model=ServiceAgreementResponse)
def update_service_agreement(
    property_id: str,
    item_id: str,
    req: ServiceAgreementBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> ServiceAgreementResponse:
    try:
        return service.update_service_agreement(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete(
    "/{property_id}/service-agreements/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_service_agreement(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_service_agreement(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 5: Håndværkere (1:n) + Vollmacht (1:1) ---------------------------
@router.get("/{property_id}/tradespeople", response_model=list[TradespersonResponse])
def list_tradespeople(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[TradespersonResponse]:
    try:
        return service.list_tradespeople(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/tradespeople",
    response_model=TradespersonResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_tradesperson(
    property_id: str, req: TradespersonBase, service: DossierServiceDep, ctx: ManageCtx
) -> TradespersonResponse:
    try:
        return service.add_tradesperson(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/tradespeople/{item_id}", response_model=TradespersonResponse)
def update_tradesperson(
    property_id: str,
    item_id: str,
    req: TradespersonBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> TradespersonResponse:
    try:
        return service.update_tradesperson(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete("/{property_id}/tradespeople/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tradesperson(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_tradesperson(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/emergency-authority", response_model=EmergencyAuthority)
def get_emergency_authority(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> EmergencyAuthority:
    try:
        return service.get_emergency_authority(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/emergency-authority", response_model=EmergencyAuthority)
def put_emergency_authority(
    property_id: str, req: EmergencyAuthority, service: DossierServiceDep, ctx: ManageCtx
) -> EmergencyAuthority:
    try:
        return service.put_emergency_authority(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 6: Markedsføring -------------------------------------------------
@router.get("/{property_id}/marketing", response_model=MarketingData)
def get_marketing(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> MarketingData:
    try:
        return service.get_marketing(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/marketing", response_model=MarketingData)
def put_marketing(
    property_id: str, req: MarketingData, service: DossierServiceDep, ctx: ManageCtx
) -> MarketingData:
    try:
        return service.put_marketing(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 7: Husmappe ------------------------------------------------------
@router.get("/{property_id}/housebook", response_model=HousebookData)
def get_housebook(property_id: str, service: DossierServiceDep, ctx: ViewCtx) -> HousebookData:
    try:
        return service.get_housebook(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/housebook", response_model=HousebookData)
def put_housebook(
    property_id: str, req: HousebookData, service: DossierServiceDep, ctx: ManageCtx
) -> HousebookData:
    try:
        return service.put_housebook(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Stufe 8: Plattform-Launches (1:n) --------------------------------------
@router.get("/{property_id}/platform-launches", response_model=list[PlatformLaunchResponse])
def list_platform_launches(
    property_id: str, service: DossierServiceDep, ctx: ViewCtx
) -> list[PlatformLaunchResponse]:
    try:
        return service.list_platform_launches(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/platform-launches",
    response_model=PlatformLaunchResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_platform_launch(
    property_id: str, req: PlatformLaunchBase, service: DossierServiceDep, ctx: ManageCtx
) -> PlatformLaunchResponse:
    try:
        return service.add_platform_launch(ctx.tenant_id, property_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.put("/{property_id}/platform-launches/{item_id}", response_model=PlatformLaunchResponse)
def update_platform_launch(
    property_id: str,
    item_id: str,
    req: PlatformLaunchBase,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> PlatformLaunchResponse:
    try:
        return service.update_platform_launch(ctx.tenant_id, property_id, item_id, req)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete("/{property_id}/platform-launches/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform_launch(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.delete_platform_launch(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Digitale Mappe: PDFs mit Auswertung (0619) -----------------------------
# Alle Endpunkte hier hängen an MANAGE_PROPERTIES wie der Rest der Kartei. Die
# PDFs sind Hausordnungen und WLAN-Blätter, also Türcodes und Passwörter — der
# Grund, aus dem schon das Lesen der Kartei nicht mehr an VIEW_CALENDAR hängt
# (siehe Modul-Kopf). Ein schwächerer Guard hier hätte diese Entscheidung
# wieder aufgehoben.
# VOR der variablen Route `/mappe/{mappe}/dokumente`: Starlette nimmt die
# erste passende. Heute kollidieren die beiden nicht (zwei Segmente gegen
# drei), aber sobald jemand `/mappe/{mappe}` ohne Suffix ergaenzt, schluckt
# die variable Route das Wort `felder` — und der Katalog waere still weg.
@router.get("/{property_id}/mappe/felder", response_model=list[MappeFeldInfo])
def list_mappe_felder(
    property_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> list[MappeFeldInfo]:
    """Welche Felder ein PDF füllen kann.

    Aus dem EINEN Katalog (`mappe_felder.py`), damit die Oberfläche keine
    zweite Liste führt, die beim nächsten neuen Feld zurückfällt. Der
    Objekt-Scope wird auch hier geprüft: der Katalog ist zwar nicht geheim,
    aber ein Endpunkt unter `/{property_id}/` ohne Objektprüfung wäre ein
    Muster, das beim nächsten Kopieren zur Lücke wird (Wurzel 9).
    """
    try:
        service.mappe_felder_pruefen(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc
    return [
        MappeFeldInfo(key=f.key, titel=f.titel, heikel=f.heikel) for f in KATALOG
    ]


@router.get("/{property_id}/mappe/{mappe}/dokumente", response_model=list[MappeDokument])
def list_mappe_dokumente(
    property_id: str, mappe: str, service: DossierServiceDep, ctx: ManageCtx
) -> list[MappeDokument]:
    try:
        return service.mappe_dokumente(ctx.tenant_id, property_id, mappe)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/mappe/dokument/{dokument_id}/url")
def get_mappe_dokument_url(
    property_id: str, dokument_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> dict[str, str]:
    """Eine kurzlebige, signierte Adresse zum Ansehen (10 Minuten)."""
    try:
        return {"url": service.mappe_dokument_url(ctx.tenant_id, property_id, dokument_id)}
    except DossierError as exc:
        raise _handle(exc) from exc


# EIGENER Pfad fuer den Upload, nicht POST auf den Listenpfad: der
# Rate-Limit-Bucket wird allein ueber den PFAD gewaehlt
# (`ratelimit_middleware._select_bucket` kennt die Methode nicht). Lagen Lesen
# und Hochladen auf demselben Pfad, zoege das Auflisten der Dokumente den
# strengen KI-Eimer mit (20/60) und der Betrieb sperrte sich beim Blaettern
# selbst aus.
@router.post(
    "/{property_id}/mappe/{mappe}/dokumente/lesen",
    response_model=MappeDokumentVorschau,
    status_code=status.HTTP_201_CREATED,
)
async def upload_mappe_dokument(
    property_id: str,
    mappe: str,
    request: Request,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> MappeDokumentVorschau:
    """Ein PDF ablegen und lesen lassen. Schreibt NICHTS in die Mappe.

    Der Inhalt kommt über `read_upload_named`, nicht über `UploadFile = File()`:
    nur so gilt der 25-MB-Deckel des Helfers statt Starlettes 1-MB-Grenze, und
    der Dateiname wird im SELBEN Durchlauf gelesen (danach ist das Formular
    geschlossen).
    """
    inhalt, _typ, name = await read_upload_named(request)
    try:
        return service.mappe_dokument_lesen(
            ctx.tenant_id,
            property_id=property_id,
            mappe=mappe,
            inhalt=inhalt,
            dateiname=name or "Dokument.pdf",
            user_id=ctx.user_id,
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/mappe/uebernehmen", response_model=MappeUebernahmeErgebnis
)
def uebernehmen_mappe_dokument(
    property_id: str,
    req: MappeUebernahmeRequest,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> MappeUebernahmeErgebnis:
    """Die bestätigten Werte in die Mappenfelder schreiben."""
    try:
        return service.mappe_dokument_uebernehmen(
            ctx.tenant_id,
            property_id=property_id,
            dokument_id=req.dokument_id,
            items=req.items,
            sprache=req.sprache,
            ueberschreiben=req.ueberschreiben,
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete(
    "/{property_id}/mappe/dokument/{dokument_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_mappe_dokument(
    property_id: str, dokument_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.mappe_dokument_loeschen(ctx.tenant_id, property_id, dokument_id)
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Inventarliste je Objekt (0620) -----------------------------------------
# Lesen und Pflegen hängen an MANAGE_PROPERTIES wie der Rest der Kartei.
# Die AUSNAHME ist die Schadensmeldung weiter unten: sie hat einen eigenen,
# engeren Guard, damit auch die Reinigungskraft melden kann — sie ist die
# Person, der ein Schaden zuerst auffällt.
@router.get("/{property_id}/inventar/raeume", response_model=list[InventarRaum])
def list_inventar_raeume(
    property_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> list[InventarRaum]:
    try:
        return service.inventar_raeume(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/inventar/raeume",
    response_model=InventarRaum,
    status_code=status.HTTP_201_CREATED,
)
def create_inventar_raum(
    property_id: str,
    req: InventarRaumInput,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> InventarRaum:
    try:
        return service.inventar_raum_anlegen(
            ctx.tenant_id, property_id, name=req.name, sortierung=req.sortierung
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete(
    "/{property_id}/inventar/raeume/{raum_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_inventar_raum(
    property_id: str, raum_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.inventar_raum_loeschen(ctx.tenant_id, property_id, raum_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/inventar", response_model=list[InventarGegenstand])
def list_inventar(
    property_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> list[InventarGegenstand]:
    try:
        return service.inventar_liste(ctx.tenant_id, property_id)
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post("/{property_id}/inventar", status_code=status.HTTP_201_CREATED)
def create_inventar(
    property_id: str,
    req: InventarAnlegenRequest,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> dict[str, int]:
    """Zeilen ergänzen — von Hand oder aus einem bestätigten PDF.

    Die Liste ist nie „fertig": ein Betrieb kauft nach und ergänzt beim
    Rundgang. Deshalb ein Sammel-Einfügen und kein einmaliger Import.
    """
    try:
        anzahl = service.inventar_anlegen(
            ctx.tenant_id,
            property_id,
            eintraege=[e.model_dump() for e in req.eintraege],
            user_id=ctx.user_id,
            quelle="dokument" if req.dokument_id else "manuell",
            dokument_id=req.dokument_id,
        )
    except DossierError as exc:
        raise _handle(exc) from exc
    return {"angelegt": anzahl}


@router.get("/{property_id}/inventar/schaeden", response_model=list[InventarSchaden])
def list_schaeden(
    property_id: str,
    service: DossierServiceDep,
    ctx: ManageCtx,
    nur_offen: bool = False,
) -> list[InventarSchaden]:
    try:
        return service.schaeden_liste(
            ctx.tenant_id, property_id, nur_offen=nur_offen
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.get("/{property_id}/inventar/foto/{foto_id}")
def get_schaden_foto_url(
    property_id: str, foto_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> dict[str, str]:
    """Kurzlebige signierte Adresse (10 Minuten) für ein Schadensbild."""
    try:
        return {
            "url": service.schaden_foto_url(ctx.tenant_id, property_id, foto_id)
        }
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/inventar/schaeden/{schaden_id}/bestaetigen",
    response_model=InventarSchaden,
)
def bestaetige_schaden(
    property_id: str,
    schaden_id: str,
    req: SchadenBestaetigung,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> InventarSchaden:
    """Betrag und Träger festlegen — erst danach entstehen Aufgabe und Posten.

    Bewusst NICHT beim Melden: die meldende Person kennt den Preis nicht, und
    ein Posten über 0,00 wäre eine Falschaussage in der Abrechnung (Wurzel 4).
    """
    try:
        return service.schaden_bestaetigen(
            ctx.tenant_id,
            property_id,
            schaden_id,
            betrag=req.betrag,
            traeger=req.traeger,
            aufgabe_anlegen=req.aufgabe_anlegen,
            user_id=ctx.user_id,
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.post(
    "/{property_id}/inventar/schaeden/{schaden_id}/verwerfen",
    status_code=status.HTTP_204_NO_CONTENT,
)
def verwerfe_schaden(
    property_id: str, schaden_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.schaden_verwerfen(ctx.tenant_id, property_id, schaden_id)
    except DossierError as exc:
        raise _handle(exc) from exc



@router.post(
    "/{property_id}/inventar/import",
    status_code=status.HTTP_200_OK,
)
async def lese_inventar_pdf(
    property_id: str,
    request: Request,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> dict[str, object]:
    """Eine Inventarliste als PDF lesen und Zeilen VORSCHLAGEN.

    Schreibt NICHTS: die Vorschläge gehen an die Oberfläche und kommen mit dem
    Übernehmen über `POST /inventar` zurück. Eine Zwischentabelle wäre ein
    weiterer Zustand mit eigenem Gegenzustand (Wurzel 1).

    EIGENER Weg neben der digitalen Mappe: dort sucht das Modell Mappenfelder
    (WLAN, Türcode, Anfahrt), hier eine Tabelle aus Gegenstand, Menge und
    Raum. Derselbe Prompt fände im jeweils anderen Dokument nichts.
    """
    inhalt, _typ, name = await read_upload_named(request)
    try:
        zeilen = service.inventar_pdf_lesen(
            ctx.tenant_id,
            property_id,
            inhalt=inhalt,
            dateiname=name or "Inventar.pdf",
            user_id=ctx.user_id,
        )
    except DossierError as exc:
        raise _handle(exc) from exc
    return {"datei_name": name or "Inventar.pdf", "items": zeilen}


# NACH allen statischen `/inventar/<wort>`-Routen: Starlette nimmt die erste
# passende, und `{item_id}` wuerde sonst `schaeden` und `foto` schlucken —
# der Schadensliste-Endpunkt waere still unerreichbar.
@router.patch(
    "/{property_id}/inventar/{item_id}", response_model=InventarGegenstand
)
def update_inventar(
    property_id: str,
    item_id: str,
    req: InventarAendernRequest,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> InventarGegenstand:
    try:
        return service.inventar_aendern(
            ctx.tenant_id,
            property_id,
            item_id,
            # `exclude_unset`: ein weggelassenes Feld bleibt, wie es ist. Ohne
            # das setzte jede Teiländerung die übrigen Felder auf null.
            felder=req.model_dump(exclude_unset=True),
            user_id=ctx.user_id,
        )
    except DossierError as exc:
        raise _handle(exc) from exc


@router.delete(
    "/{property_id}/inventar/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_inventar(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> None:
    try:
        service.inventar_loeschen(ctx.tenant_id, property_id, item_id)
    except DossierError as exc:
        raise _handle(exc) from exc

@router.post(
    "/{property_id}/inventar/{item_id}/referenzfoto",
    status_code=status.HTTP_201_CREATED,
)
async def setze_referenzfoto(
    property_id: str,
    item_id: str,
    request: Request,
    service: DossierServiceDep,
    ctx: ManageCtx,
) -> dict[str, bool]:
    """Das Bild des INTAKTEN Zustands (0623).

    Ohne Vorher-Bild gibt es im Streitfall keinen Vergleich: ein Foto vom
    kaputten Sessel beweist nicht, dass er vorher heil war.
    """
    inhalt, _typ, _name = await read_upload_named(request)
    try:
        service.referenz_foto_setzen(
            ctx.tenant_id, property_id, item_id, inhalt=inhalt, user_id=ctx.user_id
        )
    except DossierError as exc:
        raise _handle(exc) from exc
    return {"gesetzt": True}


@router.get("/{property_id}/inventar/{item_id}/referenzfoto")
def get_referenzfoto(
    property_id: str, item_id: str, service: DossierServiceDep, ctx: ManageCtx
) -> dict[str, str]:
    """Kurzlebige signierte Adresse (10 Minuten) für das Referenzbild."""
    try:
        return {
            "url": service.referenz_foto_url(ctx.tenant_id, property_id, item_id)
        }
    except DossierError as exc:
        raise _handle(exc) from exc


# --- Schadensmeldung: der Weg für das PERSONAL -------------------------------
# EIGENER GUARD, bewusst nicht ManageCtx: Eine Reinigungskraft hat kein
# MANAGE_PROPERTIES und darf die Kartei auch nicht sehen — dort stehen IBAN,
# Steuer-ID und Türcodes (siehe Modul-Kopf). Sie ist aber die Person, der ein
# Schaden zuerst auffällt.
#
# `MANAGE_INVENTORY` ist die passende Fähigkeit: sie steht bereits in der
# staff/cleaner-Rolle, wörtlich kommentiert mit „hausspezifische
# Inventarlisten" (permissions.py). Keine neue Rolle, keine geweitete Kartei.
#
# Der Guard allein reicht NICHT (Wurzel 9): `schaden_scope_pruefen` prüft
# zusätzlich `staff_property_assignments` — sonst meldete ein cleaner Schäden
# an Häusern, die ihm nicht zugewiesen sind. Und die Antwort trägt NUR den
# Schaden, nie das Kartei-Aggregat.
_inventar = require_permission(Capability.MANAGE_INVENTORY)
InventarCtx = Annotated[CurrentUser, Depends(_inventar)]

# Wie viele Bilder eine Meldung tragen darf. Der Wert steht im Service; hier
# nur der Formularname, unter dem sie ankommen.
_FOTO_FELD = "foto"


@router.post(
    "/{property_id}/inventar/schaeden",
    response_model=InventarSchaden,
    status_code=status.HTTP_201_CREATED,
)
async def melde_schaden(
    property_id: str,
    request: Request,
    service: DossierServiceDep,
    ctx: InventarCtx,
) -> InventarSchaden:
    """Einen Schaden melden — Agentur ODER Reinigungskraft. FOTO IST PFLICHT.

    Multipart, weil Bilder mitkommen: Felder `item_name`, `art`, `traeger`,
    optional `item_id`, `beschreibung`, `menge`, `reservation_id`, dazu ein
    oder mehrere `foto`.
    """
    try:
        async with request.form(max_part_size=MAX_UPLOAD_BYTES) as form:
            bilder: list[bytes] = []
            for teil in form.getlist(_FOTO_FELD):
                if isinstance(teil, UploadFile):
                    bilder.append(await teil.read())
            felder = {
                k: (v if isinstance(v, str) else "")
                for k, v in form.items()
                if k != _FOTO_FELD
            }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — Multipart-Parser wirft untypisiert
        raise HTTPException(
            status_code=413, detail="Die Meldung ist zu groß."
        ) from exc

    try:
        tenant_id = service.schaden_scope_pruefen(ctx, property_id)
        menge_roh = (felder.get("menge") or "1").strip()
        return service.schaden_melden(
            tenant_id,
            property_id,
            item_id=felder.get("item_id") or None,
            item_name=felder.get("item_name") or "",
            art=felder.get("art") or "",
            beschreibung=felder.get("beschreibung") or None,
            # Angreiferkontrollierter Text darf keinen 500 werfen (Wurzel 5):
            # was keine Zahl ist, wird 1 — nicht ein Absturz im int().
            menge=int(menge_roh) if menge_roh.isdigit() else 1,
            traeger=felder.get("traeger") or "offen",
            reservation_id=felder.get("reservation_id") or None,
            fotos=bilder,
            user_id=ctx.user_id,
            # Kommt die Meldung aus einer Reinigungsaufgabe, traegt DIESE die
            # Buchung, deren Gast betroffen ist — der Kautionsfall (0623).
            task_id=felder.get("task_id") or None,
            checklist_item_id=felder.get("checklist_item_id") or None,
        )
    except DossierError as exc:
        raise _handle(exc) from exc
