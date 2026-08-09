"""Router für properties. Gemountet unter /api/v1/properties."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security import AuthContext, CurrentUser
from src.core.uploads import read_upload
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission

from .dependencies import PropertiesServiceDep
from .gebuehren import fee_type_katalog
from .schemas import (
    BuildingCreate,
    FeeApplyRequest,
    FeeApplyResponse,
    FeeLibraryResponse,
    FeeTypeCatalogResponse,
    FeeTypeEntry,
    ImageUploadResponse,
    PhotoReorderRequest,
    PhotoUpdateRequest,
    PricingCopyRequest,
    PricingCopyResponse,
    PropertyCreate,
    PropertyListResponse,
    PropertyPhoto,
    PropertyPhotoListResponse,
    PropertyResponse,
    PropertyRoom,
    PropertyRoomCreate,
    PropertyRoomListResponse,
    PropertyRoomUpdate,
    PropertyTaxonomyResponse,
    PropertyUpdate,
    RoomReorderRequest,
    SliceHealth,
    TaxApplyRequest,
    TaxApplyResponse,
    UnitCountRequest,
)
from .service import PropertyError

# Wiederverwendete Permission-Dependency für alle Foto-Endpunkte.
_MANAGE_IMAGES = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.PM_MANAGE_PROPERTY_IMAGES
)

# Struktur des Bestands ändern (Gebäude anlegen, Objekt in n Einheiten
# aufteilen). Dieselbe Befugnis wie das Anlegen eines Objekts — beides ist
# Stammdaten-Pflege des BETRIEBS. Als Alias, weil zwei Endpunkte sie teilen.
_MANAGE_STRUKTUR = Annotated[  # pylint: disable=invalid-name
    AuthContext,
    Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
]

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/health", response_model=SliceHealth)
def health(service: PropertiesServiceDep) -> SliceHealth:
    return service.health()


@router.get("", response_model=PropertyListResponse)
def list_properties(
    ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyListResponse:
    try:
        return service.list(ctx)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    req: PropertyCreate,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    # Objekt anlegen ist Objektverwaltung (wie publish/resync) — owner/staff/cleaner
    # haben MANAGE_PROPERTY_SETTINGS nicht und dürfen keine Objekte erzeugen.
    try:
        return service.create(ctx, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/taxonomy", response_model=PropertyTaxonomyResponse)
def get_taxonomy(
    ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyTaxonomyResponse:
    # Objekt-Taxonomie (Kategorien + Immobilientypen) für den Objekttyp-Editor.
    # MUSS vor „/{property_id}" stehen (sonst fängt die Detail-Route „taxonomy" ab).
    return service.taxonomy()


@router.get("/fee-types", response_model=FeeTypeCatalogResponse)
def get_fee_types(ctx: CurrentUser) -> FeeTypeCatalogResponse:
    """Die wählbaren Gebührenarten mit Bezeichnung und Portal-Kategorie.

    Eine Fachtaxonomie mit 49 Einträgen — sie kommt aus EINER Quelle
    (`gebuehren.FEE_TYPE_CATEGORY`), damit die Auswahl im Formular und die
    serverseitige Prüfung nicht auseinanderlaufen können. MUSS vor
    „/{property_id}" stehen, sonst fängt die Detail-Route „fee-types" ab.
    """
    return FeeTypeCatalogResponse(items=[FeeTypeEntry(**e) for e in fee_type_katalog()])


@router.get("/buildings")
def list_buildings(ctx: CurrentUser, service: PropertiesServiceDep) -> list[dict]:
    """Gebäude des Betriebs. MUSS vor „/{property_id}" stehen, sonst fängt die
    Detail-Route „buildings" ab."""
    try:
        return service.list_buildings(ctx)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/buildings", status_code=status.HTTP_201_CREATED)
def create_building(
    req: BuildingCreate, ctx: _MANAGE_STRUKTUR, service: PropertiesServiceDep
) -> dict:
    """Gebäude anlegen. Objekte darin teilen sich später EINE Portal-Kennung.

    Autorisierung wie beim Anlegen eines Objekts (Wurzel 9): Vorher hing der
    Endpunkt nur an `CurrentUser` — gemessen konnte ein `owner` damit ein
    Gebäude im Mandanten der Agentur anlegen (201). Ein Gebäude entscheidet,
    welche Objekte bei den Portalen unter EINER Kennung stehen; das ist
    Stammdaten-Pflege des Betriebs, nicht Sache eines Eigentümers (§4.2).
    """
    try:
        return service.create_building(ctx, req.name)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{property_id}/units")
def list_units(
    property_id: str, ctx: CurrentUser, service: PropertiesServiceDep
) -> list[dict]:
    """Einheiten eines Objekts (mindestens eine)."""
    try:
        return service.list_units(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/{property_id}/units")
def set_unit_count(
    property_id: str,
    req: UnitCountRequest,
    ctx: _MANAGE_STRUKTUR,
    service: PropertiesServiceDep,
) -> list[dict]:
    """Objekt in n identische Einheiten aufteilen. Verkleinern nur, solange die
    wegfallenden Einheiten frei sind (409 sonst).

    Autorisierung wie beim Anlegen/Ändern eines Objekts (Wurzel 9): vorher nur
    `CurrentUser`. Die Stückzahl ist die Verfügbarkeit, die an die Portale
    gemeldet wird — wer sie ändert, greift direkt in den Verkauf ein.
    """
    try:
        return service.set_unit_count(ctx, property_id, req.count)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{property_id}/fee-library", response_model=FeeLibraryResponse)
def get_fee_library(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> FeeLibraryResponse:
    """Bestehende Gebühren des Betriebs, die auf DIESES Objekt übernehmbar sind.

    Speist „Fügen Sie eine neue oder bestehende Gebühr hinzu" (Branchenstandard
    `/pricing/<id>/assign-fee`). Preisdaten sind Vertriebsinformation — dieselbe
    Capability wie das Pflegen der Gebühr, nicht bloß `get_current_user`
    (Wurzel 9: Autorisierung, nicht nur Authentifizierung)."""
    try:
        return FeeLibraryResponse(**service.fee_library(ctx, property_id))
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/fees/{fee_id}/apply", response_model=FeeApplyResponse)
def apply_fee_to_properties(
    property_id: str,
    fee_id: str,
    req: FeeApplyRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> FeeApplyResponse:
    """Gebühr dieses Objekts auf weitere eigene Objekte übertragen. Jede Ziel-ID
    wird einzeln tenant-gescopt; Währungs- und Portal-Konflikte werden VOR dem
    ersten Schreiben abgelehnt, nicht halb durchgelaufen."""
    try:
        return FeeApplyResponse(
            **service.apply_fee_to_properties(
                ctx, property_id, fee_id, req.property_ids
            )
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/taxes/{tax_id}/apply", response_model=TaxApplyResponse)
def apply_tax_to_properties(
    property_id: str,
    tax_id: str,
    req: TaxApplyRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> TaxApplyResponse:
    """Steuer dieses Objekts auf weitere eigene Objekte übertragen. Jede Ziel-ID
    wird einzeln tenant-gescopt; eine fremde ID ergibt 404 statt stillem
    Überspringen."""
    try:
        return TaxApplyResponse(
            **service.apply_tax_to_properties(ctx, property_id, tax_id, req.property_ids)
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/pricing/copy-from", response_model=PricingCopyResponse
)
def copy_pricing_from(
    property_id: str,
    req: PricingCopyRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PricingCopyResponse:
    """Preise (inkl. Gebühren und Steuern) von einem anderen eigenen Objekt
    übernehmen — Branchenstandard „Preise einer bestehenden Unterkunft kopieren".

    QUELLE UND ZIEL werden beide einzeln tenant-gescopt geladen (Wurzel 3): eine
    fremde Quell-ID ergibt 404, nicht das stille Kopieren fremder Preise.
    Währung und Kanal-Einschränkungen werden VOR dem ersten Schreiben geprüft
    (Details in preise_kopieren.py). Dieselbe Capability wie das Pflegen der
    Preise — nicht bloß `get_current_user` (Wurzel 9)."""
    try:
        return PricingCopyResponse(
            **service.copy_pricing_from(ctx, property_id, req.source_property_id)
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(
    property_id: str, ctx: CurrentUser, service: PropertiesServiceDep
) -> PropertyResponse:
    try:
        return service.get(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: str,
    req: PropertyUpdate,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_granular_permission(Permission.EDIT_PROPERTY))
    ],
) -> PropertyResponse:
    try:
        return service.update(ctx, property_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> None:
    # Löschen ist die destruktivste Operation (harter Delete + Channex-Abkopplung)
    # — sie MUSS wie publish/resync MANAGE_PROPERTY_SETTINGS verlangen. Zuvor reichte
    # ein beliebiges Tenant-JWT (auch cleaner/owner), jedes Objekt zu löschen.
    try:
        service.delete(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/publish", response_model=PropertyResponse)
def publish_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    """Objekt veröffentlichen (draft→active), an Channex übertragen und den
    Kalender initialisieren. Erfordert einen hinterlegten Preis."""
    try:
        return service.publish(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/resync", response_model=PropertyResponse)
def resync_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    """Objekt-Inhalte (inkl. Fotos, Ausstattung, Belegung) erneut an die
    Buchungsportale übertragen — ohne Statuswechsel."""
    try:
        return service.resync_content(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/duplicate", response_model=PropertyResponse)
def duplicate_property(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.MANAGE_PROPERTY_SETTINGS)),
    ],
) -> PropertyResponse:
    """Objekt duplizieren („Kopieren"): eigenständige Kopie als Entwurf, auf
    keinem Kanal sichtbar. Wie das Anlegen ist es Objektverwaltung und verlangt
    MANAGE_PROPERTY_SETTINGS."""
    try:
        return service.duplicate(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/unlist-website", response_model=PropertyResponse)
def unlist_property_website(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_granular_permission(Permission.EDIT_PROPERTY))
    ],
) -> PropertyResponse:
    """Website-Verbindung aufheben: schaltet nur die Website-Sichtbarkeit ab.
    Wie andere Sichtbarkeits-/Inhaltsänderungen verlangt es EDIT_PROPERTY."""
    try:
        return service.unlist_website(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/{property_id}/image", response_model=ImageUploadResponse)
async def upload_property_image(
    property_id: str,
    request: Request,
    service: PropertiesServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_MANAGE_PROPERTY_IMAGES)),
    ],
    slot: str = "image",
) -> ImageUploadResponse:
    """Bild für ein Objekt hochladen (multipart). ``slot`` benennt die
    Verwendung (z. B. „custom-map"); gibt die öffentliche URL zurück. Das
    Speichern der URL ins Objekt erfolgt separat per PATCH."""
    content, content_type = await read_upload(request)
    try:
        url = service.upload_image(
            ctx,
            property_id,
            content,
            content_type or "application/octet-stream",
            slot=slot,
        )
        return ImageUploadResponse(url=url)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Foto-/Galerieverwaltung (property_photos) -------------------------------


@router.get("/{property_id}/photos", response_model=PropertyPhotoListResponse)
def list_property_photos(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhotoListResponse:
    """Fotos eines Objekts, nach Reihenfolge sortiert."""
    try:
        return service.list_photos(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/photos",
    response_model=PropertyPhoto,
    status_code=status.HTTP_201_CREATED,
)
async def add_property_photo(
    property_id: str,
    request: Request,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhoto:
    """Ein Galerie-Foto hochladen (multipart). JPEG/PNG, 50 KB–20 MB. Das Foto
    wird ans Ende einsortiert; das erste Foto wird automatisch zum Cover. Der
    Client lädt mehrere Dateien über wiederholte Aufrufe hoch."""
    content, content_type = await read_upload(request)
    try:
        return service.add_photo(
            ctx,
            property_id,
            content,
            content_type or "application/octet-stream",
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch(
    "/{property_id}/photos/reorder", response_model=PropertyPhotoListResponse
)
def reorder_property_photos(
    property_id: str,
    req: PhotoReorderRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhotoListResponse:
    """Reihenfolge der Fotos setzen (vollständige Liste der Foto-IDs)."""
    try:
        return service.reorder_photos(ctx, property_id, req.photo_ids)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}/photos/{photo_id}", response_model=PropertyPhoto)
def update_property_photo(
    property_id: str,
    photo_id: str,
    req: PhotoUpdateRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> PropertyPhoto:
    """Bildunterschrift (je Locale) und/oder Cover eines Fotos setzen."""
    try:
        return service.update_photo(ctx, property_id, photo_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/{property_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_property_photo(
    property_id: str,
    photo_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> None:
    """Foto löschen (Datei + Zeile); war es das Cover, wird neu vergeben."""
    try:
        service.delete_photo(ctx, property_id, photo_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Barrierefreiheits-Beweisfotos (0201) ------------------------------------
#
# Ein Merkmal (type_attributes.accessibility) wird erst mit geprüften Fotos
# glaubwürdig — Airbnb verlangt mindestens ein Foto je Merkmal und prüft es.
# Die Fotos liegen in property_accessibility_photos mit eigenem Prüfstatus.


@router.get("/{property_id}/accessibility-photos")
def list_accessibility_photos(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
    feature_key: str | None = None,
) -> list[dict]:
    """Beweisfotos eines Objekts, optional auf ein Merkmal gefiltert."""
    try:
        return service.list_accessibility_photos(ctx, property_id, feature_key)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/accessibility-photos/{feature_key}",
    status_code=status.HTTP_201_CREATED,
)
async def add_accessibility_photo(
    property_id: str,
    feature_key: str,
    request: Request,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> dict:
    """Ein Beweisfoto zu einem Barrierefreiheits-Merkmal hochladen (multipart)."""
    content, content_type = await read_upload(request)
    try:
        return service.upload_accessibility_photo(
            ctx,
            property_id,
            feature_key,
            content,
            content_type or "application/octet-stream",
        )
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/{property_id}/accessibility-photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_accessibility_photo(
    property_id: str,
    photo_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE_IMAGES)],
) -> None:
    """Ein Beweisfoto löschen. Gleicher Scope wie die Liste (Wurzel 9)."""
    try:
        service.delete_accessibility_photo(ctx, property_id, photo_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Zimmer (property_rooms, 0246) ------------------------------------------
# Lesen darf, wer das Objekt sehen darf; Ändern verlangt EDIT_PROPERTY — es sind
# Objektstammdaten, keine Bilder. Jeder {id}-Pfad prüft im Service denselben
# Scope wie die Liste (Wurzel 9).
_EDIT_PROPERTY = require_granular_permission(  # noqa: N816  pylint: disable=invalid-name
    Permission.EDIT_PROPERTY
)


@router.get("/{property_id}/rooms", response_model=PropertyRoomListResponse)
def list_property_rooms(
    property_id: str,
    service: PropertiesServiceDep,
    ctx: CurrentUser,
) -> PropertyRoomListResponse:
    """Zimmer eines Objekts in Anzeigereihenfolge."""
    try:
        return service.list_rooms(ctx, property_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/{property_id}/rooms",
    response_model=PropertyRoom,
    status_code=status.HTTP_201_CREATED,
)
def add_property_room(
    property_id: str,
    req: PropertyRoomCreate,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_EDIT_PROPERTY)],
) -> PropertyRoom:
    """Ein Zimmer anlegen (Typ, privat/gemeinschaftlich, optional Name)."""
    try:
        return service.add_room(ctx, property_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}/rooms/reorder", response_model=PropertyRoomListResponse)
def reorder_property_rooms(
    property_id: str,
    req: RoomReorderRequest,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_EDIT_PROPERTY)],
) -> PropertyRoomListResponse:
    """Reihenfolge der Zimmer setzen (vollständige Liste der Zimmer-IDs)."""
    try:
        return service.reorder_rooms(ctx, property_id, req.room_ids)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{property_id}/rooms/{room_id}", response_model=PropertyRoom)
def update_property_room(
    property_id: str,
    room_id: str,
    req: PropertyRoomUpdate,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_EDIT_PROPERTY)],
) -> PropertyRoom:
    """Zimmer ändern: Typ, privat/gemeinschaftlich, Name, Betten, Ausstattung,
    en suite."""
    try:
        return service.update_room(ctx, property_id, room_id, req)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/{property_id}/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_property_room(
    property_id: str,
    room_id: str,
    service: PropertiesServiceDep,
    ctx: Annotated[AuthContext, Depends(_EDIT_PROPERTY)],
) -> None:
    """Zimmer löschen; eine en-suite-Kopplung darauf wird mitgelöst."""
    try:
        service.delete_room(ctx, property_id, room_id)
    except PropertyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
