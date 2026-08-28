"""Routen der Mediathek: Bilder, Ordner, Verwendung, Stock-Fotos (0460/0461).

Eigenes Router-Modul und kein weiterer Abschnitt in ``router.py``: die Datei
stand bei 1243 Zeilen, die Mediathek bringt fünfzehn Routen mit, und ``pylint``
zieht hier bei 1500. Der Schnitt ist auch fachlich richtig — es ist der einzige
Teil des Slice mit Storage-Bucket, Multipart-Upload und fremden APIs.

Der Router trägt KEINEN eigenen Präfix. Er wird in ``router.py`` in
``manage_router`` eingehängt und erbt dessen ``/site-config`` — sonst stünde die
Adresse an zwei Stellen, und eine Umbenennung würde die Hälfte der Endpunkte
verschieben.
"""

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from . import icons as icons_modul
from . import stock as stock_modul
from .dependencies import SiteConfigServiceDep
from .fehler import SiteConfigError
from .schemas_mediathek import (
    IconImportRequest,
    IconSearchResponse,
    MediaFolderCreate,
    MediaFolderListResponse,
    MediaFolderResponse,
    MediaFolderUpdate,
    MediaFolderVorschau,
    MediaReplaceRequest,
    MediaReplaceResponse,
    MediaUebersicht,
    MediaUsageResponse,
    MediumBulkDelete,
    MediumBulkDeleteResponse,
    MediumBulkMove,
    MediumImportRequest,
    MediumListResponse,
    MediumResponse,
    MediumUpdate,
    StockImportRequest,
    StockProviderListResponse,
    StockSearchResponse,
)

# Dieselbe Berechtigung wie der übrige Baukasten. Ausdrücklich an JEDER Route —
# auch an den lesenden: eine Route mit nur `get_current_user` wäre
# Authentifizierung ohne Autorisierung, und die Mediathek gibt Daten aus
# (Wurzel 9).
_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_SITE_CONFIG
)

mediathek_router = APIRouter(tags=["site_config"])


def _fehler(exc: SiteConfigError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Bilder -----------------------------------------------------------------
@mediathek_router.get("/media", response_model=MediumListResponse)
def list_media(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    folder_id: Annotated[str | None, Query()] = None,
    root: Annotated[bool, Query()] = False,
    q: Annotated[str | None, Query(max_length=80)] = None,
    sort: Annotated[str, Query(pattern="^(neueste|aelteste|name|groesse)$")] = "neueste",
    kind: Annotated[
        str | None, Query(pattern="^(image|icon|video|audio|file)$")
    ] = None,
) -> MediumListResponse:
    """Bildbestand des Betriebs, gefiltert und sortiert.

    ``root=true`` heißt „nur Bilder in keinem Ordner" und ist etwas anderes als
    „kein ``folder_id`` gesetzt" (= alle Bilder). Die Oberfläche braucht beide.

    ``sort`` ist ein ENUM-Muster und kein durchgereichter Spaltenname: ein
    Client darf keine beliebige Spalte zum Sortierschlüssel machen (Wurzel 3).
    Für ``kind`` (der Reiter Bilder · Symbole · Videos · Audio · Dateien, 0479)
    gilt dasselbe: ein Muster, keine freie Spaltenwahl. Ohne ``kind`` kommen
    ALLE Arten — nicht „nur Bilder", sonst könnte die Oberfläche einen
    Gesamtbestand nie zeigen.
    """
    try:
        return service.list_media(
            ctx,
            limit=limit,
            offset=offset,
            folder_id=folder_id,
            nur_wurzel=root,
            suche=q,
            sortierung=sort,
            art=kind,
        )
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/media", response_model=MediumResponse, status_code=status.HTTP_201_CREATED
)
async def add_medium(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    file: Annotated[UploadFile, File()],
    folder_id: Annotated[str | None, Form()] = None,
) -> MediumResponse:
    """Ein Bild in die Mediathek legen.

    Der Bildtyp wird serverseitig aus den Anfangsbytes bestimmt — der vom Client
    gemeldete ``content_type`` wird bewusst NICHT verwendet (Wurzel 8). Ebenso
    die Maße: sie stehen in den Kopfbytes, eine Angabe des Clients wäre eine
    Behauptung."""
    content = await file.read()
    try:
        return service.add_medium(
            ctx, content, filename=file.filename, folder_id=folder_id
        )
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post("/media/move", response_model=MediumListResponse)
def move_media(
    daten: MediumBulkMove,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumListResponse:
    """Mehrere Bilder auf einmal in einen Ordner schieben (Mehrfachauswahl)."""
    try:
        return service.move_media(ctx, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


# Die drei folgenden Routen stehen VOR ``/media/{medium_id}``. Das ist keine
# Kosmetik: FastAPI probiert die Routen in der Reihenfolge ihrer Registrierung,
# und ``/media/uebersicht`` würde sonst als ``medium_id="uebersicht"`` im
# Detail-Endpunkt landen — mit einem 404, dessen Grund niemand sieht.
@mediathek_router.get("/media/uebersicht", response_model=MediaUebersicht)
def media_uebersicht(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaUebersicht:
    """Zahlen der linken Spalte: Bestand je Art und je Herkunft (0479).

    Vom Server gezählt und nicht im Browser: geladen sind höchstens 200 Zeilen,
    eine daraus gerechnete Zahl wäre die der gerade sichtbaren — plausibel und
    falsch (Wurzel 4)."""
    try:
        return service.media_uebersicht(ctx)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/media/import",
    response_model=MediumResponse,
    status_code=status.HTTP_201_CREATED,
)
def import_medium(
    daten: MediumImportRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumResponse:
    """Ein Bild von einer fremden Adresse holen („Bilder importieren", 0479).

    Der Abruf ist ein SSRF-Vektor und läuft deshalb über
    ``medien_holen.datei_holen``: jede aufgelöste IP wird geprüft, die
    Verbindung auf die geprüfte IP gepinnt, Weiterleitungen abgelehnt, die
    Menge beim Lesen gedeckelt. Was ankommt, muss die Signatur eines Bildes
    haben (Wurzel 8).

    Eigener Rate-Limit-Eimer: EIN eingeloggter Aufruf löst einen ausgehenden
    Download bis 20 MB aus — im Default-Eimer wäre das ein Verstärker
    (``core/ratelimit_middleware._MEDIA_IMPORT_PATHS``)."""
    try:
        return service.import_medium_von_url(ctx, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/media/bulk-delete", response_model=MediumBulkDeleteResponse
)
def remove_media_bulk(
    daten: MediumBulkDelete,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumBulkDeleteResponse:
    """Mehrere Medien auf einmal löschen (Mehrfachauswahl).

    ``POST`` und nicht ``DELETE``: die Liste der IDs gehört in den Body, und ein
    ``DELETE`` mit Body ist zwar erlaubt, wird aber von Proxys und Clients
    unterschiedlich behandelt. Der Scope aller IDs wird geprüft, BEVOR die erste
    Zeile fällt (Wurzel 3)."""
    try:
        return MediumBulkDeleteResponse(
            deleted=service.remove_media_bulk(ctx, daten.media_ids)
        )
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.get("/media/{medium_id}", response_model=MediumResponse)
def get_medium(
    medium_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumResponse:
    """Ein einzelnes Bild. Gleicher Tenant-Scope wie der Listen-Pfad (Wurzel 9)."""
    try:
        return service.get_medium(ctx, medium_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.patch("/media/{medium_id}", response_model=MediumResponse)
def update_medium(
    medium_id: str,
    daten: MediumUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumResponse:
    """Anzeigename, Ordner und Alt-Text ändern."""
    try:
        return service.update_medium(ctx, medium_id, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.get("/media/{medium_id}/usage", response_model=MediaUsageResponse)
def media_usage(
    medium_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaUsageResponse:
    """Wo wird dieses Bild verwendet?

    Der Gegenzustand zum Löschen (Wurzel 1): ohne diese Antwort ist „Bild
    löschen" eine Aktion, deren Folgen — ein kaputtes Bild auf einer
    veröffentlichten Seite — der Kunde erst danach sieht."""
    try:
        return service.find_media_usage(ctx, medium_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/media/{medium_id}/replace", response_model=MediaReplaceResponse
)
def replace_medium(
    medium_id: str,
    daten: MediaReplaceRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaReplaceResponse:
    """Ein Bild an ALLEN Verwendungsstellen austauschen.

    Das alte Bild bleibt in der Mediathek — Tauschen und Löschen sind zwei
    Entscheidungen, und die zweite ist unumkehrbar."""
    try:
        return service.replace_medium(ctx, medium_id, daten.replacement_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.delete(
    "/media/{medium_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_medium(
    medium_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    """Bild aus der Mediathek entfernen (Zeile UND Datei im Bucket)."""
    try:
        service.remove_medium(ctx, medium_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


# --- Ordner -----------------------------------------------------------------
@mediathek_router.get("/media-folders", response_model=MediaFolderListResponse)
def list_media_folders(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    kind: Annotated[
        str | None, Query(pattern="^(image|icon|video|audio|file)$")
    ] = None,
) -> MediaFolderListResponse:
    """Ordnerbaum des Betriebs, flach mit Zählern.

    ``kind`` zählt nur eine Medienart (0479): die Oberfläche zeigt immer EINEN
    Reiter, und ein Ordner mit „2" neben dem Namen, in dem im offenen Reiter
    nichts liegt, wäre eine Falschaussage (Wurzel 4)."""
    try:
        return service.list_media_folders(ctx, art=kind)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/media-folders",
    response_model=MediaFolderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_media_folder(
    daten: MediaFolderCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaFolderResponse:
    try:
        return service.create_media_folder(ctx, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.patch(
    "/media-folders/{folder_id}", response_model=MediaFolderResponse
)
def update_media_folder(
    folder_id: str,
    daten: MediaFolderUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaFolderResponse:
    """Umbenennen und/oder verschieben — in EINEM Aufruf."""
    try:
        return service.update_media_folder(ctx, folder_id, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.get(
    "/media-folders/{folder_id}/delete-preview", response_model=MediaFolderVorschau
)
def preview_media_folder_delete(
    folder_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediaFolderVorschau:
    """Was ein Löschen anrichten würde — VOR dem Löschen."""
    try:
        return service.preview_media_folder_delete(ctx, folder_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.delete(
    "/media-folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_media_folder(
    folder_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    """Ordner löschen. Die Bilder BLEIBEN und rutschen in die Wurzel."""
    try:
        service.delete_media_folder(ctx, folder_id)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


# --- Stock-Fotos ------------------------------------------------------------
# Eigener strenger Rate-Limit-Bucket `stock` (20/60) über den Pfad-Präfix
# `/site-config/stock/` — siehe `core/ratelimit_middleware._STOCK_PATHS`. Der
# Default-Bucket (300/60) würde erlauben, das Stundenkontingent von Pexels in
# unter einer Minute zu leeren (Wurzel 8).
@mediathek_router.get("/stock/providers", response_model=StockProviderListResponse)
def stock_providers(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> StockProviderListResponse:
    """Welche Bildanbieter dieser Server anbietet.

    Ein Anbieter ohne hinterlegten Schlüssel taucht NICHT auf — die Oberfläche
    zeigt dann keine Suchmaske, statt eine anzubieten, die verlässlich
    scheitert (Wurzel 4). Shutterstock fehlt grundsätzlich: bezahltes Abo und
    AGB-Erweiterung nötig (siehe ``stock.py``)."""
    del ctx  # nur zur Autorisierung
    return stock_modul.anbieter_liste()


@mediathek_router.get("/stock/search", response_model=StockSearchResponse)
def stock_search(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    provider: Annotated[str, Query(min_length=1, max_length=40)],
    q: Annotated[str, Query(min_length=1, max_length=100)],
    page: Annotated[int, Query(ge=1, le=50)] = 1,
    per_page: Annotated[int, Query(ge=1, le=stock_modul.MAX_TREFFER)] = 24,
) -> StockSearchResponse:
    """Bildsuche über den serverseitigen Proxy.

    Der Zugriffsschlüssel bleibt auf dem Server (Wurzel 6/7). Ist das
    Kontingent des Anbieters erschöpft, kommt ein 429 — keine stille leere
    Trefferliste, die wie „nichts gefunden" aussieht."""
    del ctx  # nur zur Autorisierung
    try:
        return stock_modul.suche(provider, q, seite=page, anzahl=per_page)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/stock/import",
    response_model=MediumResponse,
    status_code=status.HTTP_201_CREATED,
)
def stock_import(
    daten: StockImportRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumResponse:
    """Ein Stock-Foto in die Mediathek übernehmen.

    Die Anfrage trägt NUR Anbieter und Foto-Kennung; Bildadresse und
    Bildnachweis holt der Server frisch beim Anbieter (Wurzel 3). Bei Unsplash
    wird dabei ``links.download_location`` angepingt — Vertragspflicht."""
    try:
        return service.import_stock_photo(ctx, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


# --- Symbole (0479) ---------------------------------------------------------
@mediathek_router.get("/icons/search", response_model=IconSearchResponse)
def icon_search(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    q: Annotated[str, Query(min_length=1, max_length=100)],
    per_page: Annotated[int, Query(ge=1, le=icons_modul.MAX_TREFFER)] = 24,
) -> IconSearchResponse:
    """Symbolsuche über die Bibliothek (serverseitiger Proxy).

    Auf dem Server und nicht im Browser: der Abruf ist ein ausgehender Aufruf,
    er wird gedeckelt und auf die geprüfte IP gepinnt, und er liegt im
    strengeren Rate-Limit-Eimer der Bildsuche (derselbe Grund — ein einzelner
    Nutzer erzeugt sonst erhebliche Fremdlast, Wurzel 8).

    Jeder Treffer trägt Satzname und Lizenz mit: unter welcher Lizenz ein Symbol
    steht, gehört VOR die Entscheidung, es zu benutzen."""
    del ctx  # nur zur Autorisierung
    try:
        return icons_modul.suche(q, anzahl=per_page)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc


@mediathek_router.post(
    "/icons/import",
    response_model=MediumResponse,
    status_code=status.HTTP_201_CREATED,
)
def icon_import(
    daten: IconImportRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> MediumResponse:
    """Ein Symbol in die Mediathek übernehmen.

    Die Anfrage trägt NUR die Kennung (``satz:name``); Adresse, Satzname und
    Lizenz holt der Server frisch bei der Bibliothek (Wurzel 3). Ohne
    vollständigen Nachweis wird nicht übernommen — ein Symbol, das die Lizenz
    bricht, sobald es auf einer Seite steht, ist kein halber Erfolg."""
    try:
        return service.import_icon(ctx, daten)
    except SiteConfigError as exc:
        raise _fehler(exc) from exc
