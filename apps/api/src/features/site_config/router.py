"""Router des site_config-Slice.

Zwei Router (beide unter /api/v1 gemountet):
  * ``manage_router`` (/site-config) — Dashboard-CRUD, MANAGE_SITE_CONFIG-geschützt,
    tenant-gescoped. Branding + Custom-Domains.
  * ``public_router`` (/site) — JWT-loser by-domain-Resolver für die öffentliche
    Buchungsplattform (Host → Tenant + öffentliches Branding).

Die REST-Endpunkte sind eine dünne 1:1-Hülle um die Service-Aktionen, damit ein
späterer MCP exakt diese Aktionen spiegeln kann (get_branding/set_branding/
add_domain/sync_domain/remove_domain/resolve_site_by_domain).
"""
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from supabase import Client

from src.core.config import get_settings
from src.core.ratelimit import client_ip_from_xff
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from . import beitrag_felder as beitrag_felder_modul
from . import formular_anlagen
from . import regeln as regel_modul
from . import rss_import as rss_modul
from . import seiten as seiten_modul
from .dependencies import SiteConfigServiceDep, WeiterleitungsServiceDep
from .formular_anlagen import FormAnlagenListResponse, FormUploadResponse
from .router_eigene_felder import eigene_felder_router
from .router_mediathek import mediathek_router
from .rss_widget import RssFeedPreviewResponse
from .schemas import (
    ApplyStreckeRequest,
    ApplyTemplateRequest,
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlocksReplaceRequest,
    BlockUpdate,
    BrandingResponse,
    BrandingUpdate,
    ContainerMoveRequest,
    CustomDomainListResponse,
    CustomDomainResponse,
    DomainCreate,
    DraftTokenResponse,
    FormSubmissionListResponse,
    FormSubmissionRequest,
    FormSubmissionResponse,
    PageCreate,
    PageListResponse,
    PageResponse,
    PagesReorderRequest,
    PageUpdate,
    PublicPageResponse,
    PublicPopupListResponse,
    PublicPostListResponse,
    PublicPostResponse,
    PublicSiteResponse,
    RedirectCreate,
    RedirectImportRequest,
    RedirectImportResult,
    RedirectListResponse,
    RedirectResolveResponse,
    RedirectResponse,
    RedirectUpdate,
    ReorderRequest,
    SeitenEntwurfRequest,
    SeitenFreischaltenRequest,
    SeitenTicketResponse,
    SeitenVorlagenListResponse,
    SeitenZugangRequest,
    SeoPruefungResponse,
    SitemapResponse,
    SliceHealth,
    StreckenListResponse,
    StreckePreviewResponse,
    TemplateListResponse,
)
from .service import SiteConfigError

_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_SITE_CONFIG
)

manage_router = APIRouter(prefix="/site-config", tags=["site_config"])
public_router = APIRouter(prefix="/site", tags=["site_config"])


@manage_router.get("/health", response_model=SliceHealth)
def health(service: SiteConfigServiceDep) -> SliceHealth:
    return service.health()


# --- Branding ---------------------------------------------------------------
@manage_router.get("", response_model=BrandingResponse)
def get_branding(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BrandingResponse:
    try:
        return service.get_branding(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("", response_model=BrandingResponse)
def set_branding(
    req: BrandingUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BrandingResponse:
    try:
        return service.set_branding(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Custom-Domains ---------------------------------------------------------
@manage_router.get("/domains", response_model=CustomDomainListResponse)
def list_domains(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainListResponse:
    try:
        return service.list_domains(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/domains",
    response_model=CustomDomainResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_domain(
    req: DomainCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainResponse:
    try:
        return service.add_domain(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/domains/{domain_id}/sync", response_model=CustomDomainResponse)
def sync_domain(
    domain_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> CustomDomainResponse:
    try:
        return service.sync_domain(ctx, domain_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_domain(
    domain_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.remove_domain(ctx, domain_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Page-Builder: Seiten (Dashboard) ---------------------------------------
@manage_router.get("/pages", response_model=PageListResponse)
def list_pages(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    try:
        return service.list_pages(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages", response_model=PageResponse, status_code=status.HTTP_201_CREATED
)
def create_page(
    req: PageCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.create_page(ctx, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("/pages/{page_id}", response_model=PageResponse)
def update_page(
    page_id: str,
    req: PageUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.update_page(ctx, page_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/home", response_model=PageResponse)
def set_home_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.set_home_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/duplicate",
    response_model=PageResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_page(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
) -> PageResponse:
    """Seite samt Blöcken kopieren (0433).

    Die Kopie ist immer ein ENTWURF — sonst stünde beim ersten Klick eine
    zweite, fast gleiche Seite live, und für Google wäre das Duplicate
    Content."""
    try:
        return service.duplicate_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/publish", response_model=PageResponse)
def publish_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.publish_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/unpublish", response_model=PageResponse)
def unpublish_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageResponse:
    try:
        return service.unpublish_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_page(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.delete_page(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Page-Builder: Blöcke (Dashboard) ---------------------------------------
@manage_router.get("/pages/{page_id}/blocks", response_model=BlockListResponse)
def list_blocks(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    mit_containern: bool = False,
) -> BlockListResponse:
    """Die Bausteine einer Seite.

    ``mit_containern=true`` liefert zusaetzlich die Struktur-Zeilen
    (``section``/``column``/``inner_column``). Die Ebenen-Ansicht braucht sie:
    ohne die Container findet sie zu keinem Baustein den Elternteil, jeder wird
    zur Wurzel, und der Baum bleibt flach — genau das war live zu sehen (6
    Abschnitte und 6 Spalten in der DB, 6 wurzellose Zeilen in der Anzeige).
    Der Standard bleibt ohne: die Abschnittsliste hat fuer Container kein
    Formular und zeigte sie als „Unbekannter Abschnitt".
    """
    try:
        return service.list_blocks(ctx, page_id, mit_containern=mit_containern)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/blocks",
    response_model=BlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_block(
    page_id: str,
    req: BlockCreate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    try:
        return service.add_block(ctx, page_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("/blocks/{block_id}", response_model=BlockResponse)
def update_block(
    block_id: str,
    req: BlockUpdate,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    try:
        return service.update_block(ctx, block_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/blocks/{block_id}/move", response_model=BlockResponse)
def move_container(
    block_id: str,
    req: ContainerMoveRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    """Einen Abschnitt oder eine Spalte an einen anderen Rang setzen (0479).

    Bis hierher gab es dafür keinen Weg: `reorder_blocks` verlangt die
    vollständige Baustein-Liste und kennt Container nicht, und eine Position
    ließ sich nur beim Anlegen vergeben — ein Abschnitt blieb für immer dort,
    wo er entstanden ist."""
    try:
        return service.move_container(ctx, block_id, req.position)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/blocks/{block_id}/duplicate",
    response_model=BlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_container(
    block_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockResponse:
    """Einen Abschnitt (oder eine Spalte) mit allem darin kopieren (0479).

    Der TEILBAUM wird kopiert — Spalten, Bausteine, Reihenfolge, Breiten — und
    steht direkt hinter dem Original. Für einen einzelnen Baustein ist die
    Abschnittsliste der Weg; hier kommt ein 422."""
    try:
        return service.duplicate_container(ctx, block_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/blocks/reorder", response_model=BlockListResponse
)
def reorder_blocks(
    page_id: str,
    req: ReorderRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockListResponse:
    try:
        return service.reorder_blocks(ctx, page_id, req.ordered_ids)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.put("/pages/{page_id}/blocks", response_model=BlockListResponse)
def replace_blocks(
    page_id: str,
    req: BlocksReplaceRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> BlockListResponse:
    """Alle Abschnitte einer Seite in EINEM Aufruf setzen (der Speicher-Weg des
    Editors). Ersetzt die alte N+1-Sequenz aus delete/update/create/reorder —
    idempotent, siehe ``BlocksReplaceRequest``."""
    try:
        return service.replace_blocks(ctx, page_id, req)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/reorder", response_model=PageListResponse)
def reorder_pages(
    req: PagesReorderRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    """Seiten innerhalb eines Navigationsbereichs neu sortieren (Kopfzeile,
    Fußzeile oder „nicht verlinkt" — jeder Bereich zählt seine eigene Reihenfolge)."""
    try:
        return service.reorder_pages(ctx, req.nav_area, req.ordered_ids)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_block(
    block_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> None:
    try:
        service.remove_block(ctx, block_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Mediathek --------------------------------------------------------------
# Die fünfzehn Routen der Mediathek (Bilder, Ordner, Verwendungsnachweis,
# Stock-Fotos) stehen in `router_mediathek.py` und werden hier eingehängt: diese
# Datei lag bei 1243 von 1500 erlaubten Zeilen. Der eingehängte Router trägt
# KEINEN eigenen Präfix und erbt `/site-config` — sonst stünde die Adresse an
# zwei Stellen.
manage_router.include_router(mediathek_router)

# --- EIGENE Beitragsfelder (0485) -------------------------------------------
# Dieselbe Begruendung wie eine Zeile darueber: die vier Routen stehen in
# `router_eigene_felder.py`. Sie aendern das SCHEMA eines Inhaltstyps und nicht
# seine Inhalte — der Schnitt ist nicht nur eine Zeilenzahl.
manage_router.include_router(eigene_felder_router)


@manage_router.get("/templates", response_model=TemplateListResponse)
def list_templates(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> TemplateListResponse:
    """Die Vorlagen-Galerie. EINE Quelle für IDs, Namen und Kategorien — die
    Oberfläche zählt sie nicht selbst auf."""
    try:
        return service.list_templates(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.get("/seiten-vorlagen", response_model=SeitenVorlagenListResponse)
def list_seiten_vorlagen(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> SeitenVorlagenListResponse:
    """Vorlagen für einzelne Seiten (0434) — dieselbe Liste wie beim Anlegen."""
    try:
        return service.list_seiten_vorlagen(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/templates/apply", response_model=PageListResponse)
def apply_template(
    req: ApplyTemplateRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    try:
        return service.apply_template(ctx, req.template_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/templates/{template_id}/preview-token", response_model=DraftTokenResponse
)
def create_template_preview_token(
    template_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> DraftTokenResponse:
    """Kurzlebiger Token, mit dem der Renderer eine Vorlage zeigt, BEVOR sie
    angewendet wird."""
    try:
        return DraftTokenResponse(
            token=service.create_template_preview_token(ctx, template_id)
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.get("/strecken", response_model=StreckenListResponse)
def list_strecken(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> StreckenListResponse:
    """Die Vorlagen der Buchungsstrecke (0474) — dieselbe Liste, die das
    Auswahl-Fenster zeigt."""
    try:
        return service.list_strecken(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/strecken/{strecke_key}/preview-token", response_model=StreckePreviewResponse
)
def create_strecke_preview_token(
    strecke_key: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> StreckePreviewResponse:
    """Token und Beispielobjekt für die Live-Vorschau einer Strecke, BEVOR sie
    angewendet wird."""
    try:
        token, objekt_id = service.create_strecke_preview_token(ctx, strecke_key)
        return StreckePreviewResponse(token=token, beispiel_objekt_id=objekt_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/strecken/apply", response_model=PageListResponse)
def apply_strecke(
    req: ApplyStreckeRequest,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> PageListResponse:
    """Eine Strecken-Vorlage auf Objektseite, Buchung und Bestätigung legen.

    ERSETZT die bestehenden Bausteine dieser drei Seiten. Die Oberfläche fragt
    davor, weil es kein Zurück gibt — ein Rückweg müsste den alten Stand
    aufbewahren, und einen Versionsstand je Seite gibt es hier nicht."""
    try:
        return service.apply_strecke(ctx, req.strecke)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/draft-token", response_model=DraftTokenResponse
)
def create_draft_token(
    page_id: str,
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> DraftTokenResponse:
    """Kurzlebiger Token für die Live-Vorschau im Editor-iframe (eigene Seite)."""
    try:
        return DraftTokenResponse(token=service.create_draft_token(ctx, page_id))
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/pages/{page_id}/draft", response_model=PageResponse)
def set_page_draft(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
    body: SeitenEntwurfRequest,
) -> PageResponse:
    """Eine Seite als Entwurf halten — oder wieder freigeben (0443).

    Ein Entwurf wird beim Veröffentlichen der Website ÜBERSPRUNGEN. Ohne diese
    Unterscheidung nimmt der Knopf „Veröffentlichen" jede halbfertige Seite
    mit."""
    try:
        return service.set_page_draft(ctx, page_id, body.entwurf)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/access", status_code=status.HTTP_204_NO_CONTENT
)
def set_page_access(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
    body: SeitenZugangRequest,
) -> None:
    """Seitenpasswort setzen — oder mit leerem Feld wieder entfernen (0442).

    Gespeichert wird ein PBKDF2-Hash, nie das Passwort: die Zeile liegt in jedem
    Backup und jedem Datenbank-Auszug."""
    try:
        service.set_page_access(ctx, page_id, body.passwort)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/pages/{page_id}/publish-single", response_model=PageResponse
)
def publish_page_single(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
) -> PageResponse:
    """Diese eine Seite veröffentlichen (0442).

    Anders als bei Hostaway entsteht dabei KEIN abweichender Live-Stand — der
    Renderer holt Seite und Theme bei jedem Aufruf frisch. Der Zeitstempel ist
    die Anzeige, dass eine Seite außer der Reihe live ging."""
    try:
        return service.publish_page_single(ctx, page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Personalisierungs-Regeln (0440, MANAGE_SITE_CONFIG) --------------------


@manage_router.get("/rules", response_model=regel_modul.RuleListResponse)
def list_rules(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> regel_modul.RuleListResponse:
    """Alle Regeln des Betriebs in ihrer Reihenfolge — die Reihenfolge IST der
    Vorrang bei gleicher Aktionsart auf derselben Seite."""
    try:
        return service.regeln(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/rules",
    response_model=regel_modul.RuleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rule(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: regel_modul.RuleCreate,
) -> regel_modul.RuleResponse:
    """Eine Regel anlegen. Sie beginnt als ENTWURF und wirkt erst nach dem
    Scharfschalten — sonst erschiene sie bei Gästen, während der Betrieb noch
    am Text schreibt."""
    try:
        return service.regel_anlegen(ctx, body)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.patch(
    "/rules/{rule_id}", response_model=regel_modul.RuleResponse
)
def update_rule(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    rule_id: str,
    body: regel_modul.RuleUpdate,
) -> regel_modul.RuleResponse:
    """Eine Regel ändern — inklusive Zustand (Entwurf / aktiv / abgeschaltet)."""
    try:
        return service.regel_aendern(ctx, rule_id, body)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/rules/reorder", response_model=regel_modul.RuleListResponse
)
def reorder_rules(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: regel_modul.RuleReorderRequest,
) -> regel_modul.RuleListResponse:
    """Die Reihenfolge setzen. Vollständig, nicht als einzelne Verschiebung:
    eine Teilangabe hinterlässt doppelte Ränge, und der Rang ist der Vorrang."""
    try:
        return service.regeln_ordnen(ctx, body.ids)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_rule(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    rule_id: str,
) -> None:
    """Endgültig löschen. Wer die Regel behalten will, schaltet sie ab —
    dafür gibt es den Zustand `disabled`."""
    try:
        service.regel_loeschen(ctx, rule_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Öffentlicher Resolver (KEIN JWT) ---------------------------------------
@public_router.get("/by-domain", response_model=PublicSiteResponse)
def resolve_site_by_domain(
    service: SiteConfigServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> PublicSiteResponse:
    """Host → Tenant + öffentliches Branding (für die plattform-Middleware).

    Bewusst ohne Auth-Guard: die öffentliche Buchungs-Site ist nicht eingeloggt.
    Liefert NUR öffentliche Felder; unbekannte Domain → 404."""
    try:
        return service.resolve_site_by_domain(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/page", response_model=PublicPageResponse)
def resolve_page(
    service: SiteConfigServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    slug: Annotated[str | None, Query(max_length=200)] = None,
    ticket: Annotated[str | None, Query(max_length=200)] = None,
    sprache: Annotated[str | None, Query(min_length=2, max_length=8)] = None,
) -> PublicPageResponse:
    """Host (+ optional Slug) → veröffentlichte Seite + Blöcke + Branding für den
    builder/-Renderer. KEIN JWT; nur is_published; unbekannt → 404.

    `ticket` ist der Nachweis für eine passwortgeschützte Seite (0442). Ohne
    gültiges Ticket antwortet eine geschützte Seite mit 401 und OHNE Inhalt —
    die Blöcke werden gar nicht erst geladen."""
    try:
        return service.resolve_page(host, slug, ticket, sprache)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/rss-preview", response_model=RssFeedPreviewResponse)
def rss_widget_preview(
    service: SiteConfigServiceDep,
    url: Annotated[str, Query(min_length=1, max_length=2000)],
    max_items: Annotated[int, Query(ge=1, le=12)] = 6,
) -> RssFeedPreviewResponse:
    """Die zuletzt gecachten Einträge des Feeds, den ein `rss_feed`-Abschnitt
    eingestellt hat (0471). KEIN JWT — genau wie `/page`. `url` MUSS als
    `feed_url` in einem veröffentlichten `rss_feed`-Abschnitt stehen, sonst
    404 (siehe `rss_widget.py`: ein Endpunkt mit freier URL wäre selbst ein
    offener Proxy)."""
    try:
        return service.resolve_rss_widget(url, max_items=max_items)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.post("/page/unlock", response_model=SeitenTicketResponse)
def unlock_page(
    service: SiteConfigServiceDep,
    body: SeitenFreischaltenRequest,
) -> SeitenTicketResponse:
    """Passwort einer geschützten Seite prüfen und ein Ticket ausgeben (0442).

    KEIN JWT — der Gast hat keines. Bei falschem Passwort ein 401 und sonst
    nichts: kein Hinweis, ob die Seite existiert oder ob sie überhaupt
    geschützt ist."""
    try:
        return SeitenTicketResponse(
            ticket=service.seite_freischalten(body.host, body.slug, body.passwort)
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/template/draft", response_model=PublicPageResponse)
def resolve_template_draft(
    service: SiteConfigServiceDep,
    template_id: Annotated[str, Query(max_length=60)],
    token: Annotated[str, Query(max_length=200)],
    slug: Annotated[str | None, Query(max_length=200)] = None,
) -> PublicPageResponse:
    """Vorschau einer Vorlage, bevor sie angewendet wird. KEIN JWT, aber
    HMAC-Token-verifiziert (tenant+template+exp). Ungültig → 403."""
    try:
        return service.resolve_template_draft(template_id, slug, token)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/strecke/draft", response_model=PublicPageResponse)
def resolve_strecke_draft(
    service: SiteConfigServiceDep,
    strecke: Annotated[str, Query(max_length=60)],
    seite: Annotated[str, Query(max_length=20)],
    token: Annotated[str, Query(max_length=200)],
) -> PublicPageResponse:
    """Vorschau EINER Seite einer Strecken-Vorlage, bevor sie angewendet wird.

    KEIN JWT, aber HMAC-Token-verifiziert (tenant+strecke+exp). Ungültig → 403.
    `seite` ist der Abschnitt der Strecke (`objekt`, `checkout`,
    `bestaetigung`), kein Slug: eine Strecke hat keine eigenen Adressen."""
    try:
        return service.resolve_strecke_draft(strecke, seite, token)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/page/draft", response_model=PublicPageResponse)
def resolve_page_draft(
    service: SiteConfigServiceDep,
    page_id: Annotated[str, Query()],
    token: Annotated[str, Query()],
    sprache: Annotated[str | None, Query(min_length=2, max_length=8)] = None,
) -> PublicPageResponse:
    """Entwurfs-Render für den Editor-iframe (auch unveröffentlicht). KEIN JWT,
    aber HMAC-Token-verifiziert (tenant+page+exp). Ungültig → 403.

    `sprache` wählt die Sprachfassung der Seitenfelder (0476) — dieselbe
    Wirkung wie im öffentlichen Pfad, damit die Vorschau zeigt, was der Gast
    sieht."""
    try:
        return service.resolve_page_draft(page_id, token, sprache)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# === URL-Weiterleitungen (0430) =============================================
# Eigene Endpunkte statt eines Feldes an /branding: eine Weiterleitung wird
# einzeln angelegt und einzeln gelöscht. Als Teil des Branding-PUT müsste die
# Oberfläche bei jeder Änderung die ganze Liste senden — und zwei gleichzeitig
# offene Reiter würden sich gegenseitig überschreiben.
@manage_router.get("/redirects", response_model=RedirectListResponse)
def list_redirects(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> RedirectListResponse:
    return service.liste(ctx)


@manage_router.post(
    "/redirects",
    response_model=RedirectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_redirect(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: RedirectCreate,
) -> RedirectResponse:
    """Weiterleitung anlegen. Idempotent gegen Doppelklick: derselbe Eintrag
    zweimal gesendet gibt die vorhandene Zeile zurück, ein ABWEICHENDES Ziel
    unter demselben Pfad einen 409 (Wurzel 2)."""
    try:
        return service.anlegen(ctx, body)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.patch(
    "/redirects/{redirect_id}", response_model=RedirectResponse
)
def update_redirect(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    redirect_id: str,
    body: RedirectUpdate,
) -> RedirectResponse:
    try:
        return service.aendern(ctx, redirect_id, body)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/redirects/{redirect_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_redirect(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    redirect_id: str,
) -> None:
    try:
        service.loeschen(ctx, redirect_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post("/redirects/import", response_model=RedirectImportResult)
def import_redirects(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: RedirectImportRequest,
) -> RedirectImportResult:
    """Mehrere Weiterleitungen in einem Zug (CSV-Import der Oberfläche).

    Antwortet mit 200 und einem Ergebnis-Bericht, auch wenn einzelne Zeilen
    fehlerhaft waren — nicht mit 422. Eine kaputte Zeile in einer 200-Zeilen-
    Datei darf die 199 gültigen nicht verwerfen; welche gescheitert sind, steht
    mit Zeilennummer in `errors`."""
    try:
        return service.importieren(ctx, body)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.get("/seo/pruefung", response_model=SeoPruefungResponse)
def seo_pruefung(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> SeoPruefungResponse:
    """Befundliste der SEO-Prüfung (Etappe B).

    Ein GET ohne Nebenwirkung, aber MANAGE_SITE_CONFIG-geschützt: die Antwort
    nennt Seitentitel und Objektnamen des Betriebs — das ist nichts für einen
    ungescopten Aufruf."""
    try:
        return service.pruefung(ctx)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/redirect", response_model=RedirectResolveResponse)
def resolve_redirect(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    path: Annotated[str, Query(min_length=1, max_length=500)],
) -> RedirectResolveResponse:
    """Host + Pfad → Weiterleitungsziel, oder leere Antwort.

    Der Renderer ruft das NUR, wenn er unter diesem Pfad keine Seite gefunden
    hat. „Keine Weiterleitung" ist die häufigste Antwort und deshalb ein 200 mit
    `target: null` — ein 404 wäre hier eine Fehlermeldung für den Normalfall und
    würde jeden Log mit Rauschen füllen.

    Unbekannte Domain oder Website offline → 404 (aus der Host-Auflösung)."""
    try:
        treffer = service.aufloesen_fuer_host(host, path)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not treffer:
        return RedirectResolveResponse()
    return RedirectResolveResponse(
        target=treffer["target"], redirect_type=treffer["redirect_type"]
    )


@public_router.get("/page/404", response_model=PublicPageResponse | None)
def resolve_fehlerseite(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> PublicPageResponse | None:
    """Die eigene 404-Seite eines Hosts (0433), oder `null`.

    `null` und kein 404: „dieser Betrieb hat keine eigene Fehlerseite" ist der
    Normalfall, und eine Fehlerantwort dafür würde jedes Log mit Rauschen
    füllen. Der Renderer zeigt dann seine eingebaute Seite."""
    try:
        return service.fehlerseite(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get(
    "/page/objekt-vorlage", response_model=PublicPageResponse | None
)
def resolve_objekt_vorlage(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> PublicPageResponse | None:
    """Das Master-Layout der Objektseite (0468), oder `null`.

    `null` und kein 404: „noch keine Bausteine darauf" ist der Normalfall, und
    der Renderer zeigt dann sein eingebautes Layout."""
    try:
        return service.objekt_vorlage(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get(
    "/page/system-vorlage", response_model=PublicPageResponse | None
)
def resolve_systemseiten_vorlage(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    key: Annotated[str, Query(min_length=3, max_length=40)],
) -> PublicPageResponse | None:
    """Die Bausteine einer Systemseite (0474), oder `null`.

    `key` ist die Kennung der Seite (`checkout`, `checkout_abgeschlossen`,
    `blog`). `null` und kein 404: „noch keine Bausteine darauf" ist der
    Normalfall, und der Renderer zeigt dann sein eingebautes Layout."""
    try:
        return service.systemseiten_vorlage(host, key)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _absender_ip(request: Request) -> str | None:
    """Die IP des Absenders, so wie der Ratelimiter sie auch bestimmt.

    Sie geht ausschliesslich an die Captcha-Bewertung (Google bewertet damit
    genauer) und wird NICHT gespeichert — dieselbe Handhabung wie im
    Kontaktformular der Marketing-Seite."""
    return client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )


@public_router.post("/form", response_model=FormSubmissionResponse)
def submit_form(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    body: FormSubmissionRequest,
    request: Request,
) -> FormSubmissionResponse:
    """Eine Formular-Einsendung eines GASTES annehmen (0436/0445).

    KEIN JWT — ein Gast auf einer Kundenseite ist nicht eingeloggt. Deshalb ist
    das der engste Endpunkt des Slice: Host-Auflösung, Block-Prüfung gegen
    Tenant und Typ, veröffentlichte Seite, reCAPTCHA Enterprise (serverseitig
    bewertet, dieselbe Kette wie das Kontaktformular), Feldprüfung gegen die
    Definition. Was die Prüfungen im Einzelnen abwehren, steht in
    `WeiterleitungsService.formular_absenden`.

    Die Antwort ist absichtlich karg: der Gast braucht zu wissen, dass es
    angekommen ist, wohin er soll und — nur wenn das Formular eine Datei
    annimmt — unter welcher Kennung und mit welchem Ticket er sie nachreicht.
    Die gespeicherten Daten zurückzugeben wäre eine Einladung, den Endpunkt als
    Spiegel zu missbrauchen."""
    try:
        return service.formular_absenden(
            host,
            body,
            ip=_absender_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.post(
    "/form/{submission_id}/upload", response_model=FormUploadResponse
)
async def upload_form_anlage(
    service: WeiterleitungsServiceDep,
    submission_id: str,
    file: Annotated[UploadFile, File()],
    ticket: Annotated[str, Form(min_length=1, max_length=200)],
    feld: Annotated[str, Form(min_length=1, max_length=60)],
) -> FormUploadResponse:
    """Eine Datei an eine bereits gespeicherte Einsendung hängen (0445).

    KEIN JWT, wie beim Absenden selbst — und deshalb der zweite Endpunkt des
    Slice, an dem ein Fremder schreibt. Der Schutz sitzt vollständig im
    `ticket`: es ist HMAC-signiert, hängt an genau dieser `submission_id` und
    gilt zwei Minuten. Der Gast bekommt es in der Antwort auf sein Absenden.

    ZWEI Aufrufe und nicht einer, weil `site_form_uploads.submission_id` NOT
    NULL ist (0444): eine Datei ohne Einsendung wäre eine verwaiste Zeile, und
    der Weg „erst Datei, dann Einsendung" bräuchte einen Zwischenzustand samt
    Aufräumer für alles, was nie zu einer Einsendung wurde.

    Gelesen wird mit hartem Deckel und einem Byte darüber (Wurzel 8): so steht
    fest, ob die Datei zu groß IST, ohne dass ein 2-GB-Körper je vollständig
    im Speicher landet. `file.filename` ist eine Behauptung des Absenders und
    dient NUR der Anzeige — der echte Typ kommt aus den Anfangsbytes, der Pfad
    wird erzeugt (`formular_anlagen`)."""
    inhalt = await file.read(formular_anlagen.MAX_BYTES + 1)
    try:
        return service.formular_anlage(
            submission_id, ticket, feld, file.filename or "", inhalt
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.get(
    "/form-submissions", response_model=FormSubmissionListResponse
)
def list_form_submissions(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FormSubmissionListResponse:
    """Die Anfragen aus den Formularen der Website.

    MANAGE_SITE_CONFIG-geschützt, und das ist hier keine Formalie: die Zeilen
    enthalten Namen, Telefonnummern und Anliegen von Gästen. Die Tabelle hat für
    anon/authenticated bewusst KEIN Grant (0436) — dieser Endpunkt ist der
    einzige Weg."""
    try:
        return service.formular_liste(ctx, limit=limit, offset=offset)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.get(
    "/form-submissions/{submission_id}/uploads",
    response_model=FormAnlagenListResponse,
)
def list_submission_uploads(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    submission_id: str,
) -> FormAnlagenListResponse:
    """Die Anlagen EINER Einsendung — mit signierter, kurzlebiger Adresse.

    Derselbe Scope wie der Listen-Pfad darüber (Wurzel 9): `(submission_id,
    tenant_id)`. Ohne den Tenant im Filter wäre das ein IDOR auf die Dateien
    eines fremden Betriebs, und zwar inklusive einer gültigen Leseadresse.

    Eigener Endpunkt und nicht Teil der Liste: die Adressen werden bei jedem
    Abruf neu signiert und gelten fünf Minuten. Sie für jede Einsendung der
    Liste zu erzeugen hieße, bei 50 Anfragen 50 Signaturen zu bauen, von denen
    niemand eine anklickt."""
    try:
        return service.formular_anlagen_liste(ctx, submission_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/form-submissions/{submission_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_submission_read(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    submission_id: str,
) -> None:
    try:
        service.formular_gelesen(ctx, submission_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
    "/form-submissions/{submission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_submission(
    service: WeiterleitungsServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    submission_id: str,
) -> None:
    """Eine Anfrage endgültig löschen — ohne Papierkorb.

    Absichtlich: es sind personenbezogene Daten, und ein Löschbegehren nach
    Art. 17 DSGVO muss zu einem echten Löschen führen."""
    try:
        service.formular_loeschen(ctx, submission_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/rules", response_model=regel_modul.PublicRuleListResponse)
def resolve_rules(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> regel_modul.PublicRuleListResponse:
    """Die AKTIVEN Regeln eines Hosts — der Renderer wertet sie im Browser aus.

    Ohne JWT, wie der ganze öffentliche Lesepfad. Entwürfe und abgeschaltete
    Regeln kommen gar nicht erst mit: sie im Browser zu filtern hieße, dem Gast
    mitzuteilen, was der Betrieb gerade plant."""
    try:
        return service.regeln_oeffentlich(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/popups", response_model=PublicPopupListResponse)
def resolve_popups(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> PublicPopupListResponse:
    """Die Pop-ups einer Website mit Auslösern und Blöcken (0437).

    Leere Liste, wenn es keine gibt — das ist der Normalfall und kein Fehler.
    Ein 404 dafür würde jeden Log mit Rauschen füllen."""
    try:
        return service.popups(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/posts", response_model=PublicPostListResponse)
def resolve_posts(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    tag: Annotated[str | None, Query(max_length=60)] = None,
    tags: Annotated[list[str] | None, Query(max_length=8)] = None,
    q: Annotated[str | None, Query(max_length=60)] = None,
) -> PublicPostListResponse:
    """Die veröffentlichten Blog-Beiträge einer Website (0438/0457).

    Beiträge mit einem Erscheinungsdatum in der Zukunft bleiben aus — das ist
    die Vorplanung. Sie erscheinen von selbst, sobald der Zeitpunkt erreicht
    ist, ohne Hintergrundlauf.

    `tag` filtert auf EIN Schlagwort, `tags` auf eine Auswahl (ODER), `q` sucht
    im TITEL. Alle drei sind gedeckelt: 60 Zeichen je Begriff und acht
    Schlagwörter — mehr kann ein Beitrag gar nicht tragen (Wurzel 8)."""
    try:
        return service.beitraege(
            host, limit=limit, offset=offset, tag=tag, tags=tags, q=q
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/posts/{slug}", response_model=PublicPostResponse)
def resolve_post(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    slug: str,
    sprache: Annotated[str | None, Query(min_length=2, max_length=8)] = None,
) -> PublicPostResponse:
    """Ein einzelner Blog-Beitrag mit seinen Abschnitten (0438).

    `sprache` wählt die Sprachfassung von Titel, Meta-Angaben und Anrisstext
    (0476)."""
    try:
        return service.beitrag(host, slug, sprache)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/sitemap", response_model=SitemapResponse)
def resolve_sitemap(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
) -> SitemapResponse:
    """Host → alle indexierbaren Adressen + die site-weiten SEO-Angaben.

    Der Renderer baut daraus sitemap.xml, robots.txt und llms.txt. Ein Aufruf
    für drei Dateien, weil die Host-Auflösung der teure Teil ist."""
    try:
        return service.sitemap(host)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# === Blog: Pflege im Dashboard (0457) =======================================
# Eigene Endpunkte neben `PUT /pages/{id}`, und der Grund steht in `seiten.py`:
# die Beitragsfelder gelten NUR für `page_type='post'` (CHECK aus 0438). An
# `PageUpdate` gehängt wären sie an jeder Seite sichtbar und würden dort mit
# einem Datenbankfehler enden statt mit einer Antwort, die den Grund nennt.
_DbDep = Annotated[Client, Depends(get_service_client)]


def _tenant(ctx: AuthContext) -> str:
    """Der Mandant aus dem geprüften Token — die einzige Quelle des Scopes.

    Nie aus dem Pfad, nie aus dem Body: die Service-Rolle umgeht RLS, also ist
    dieser Wert die ganze Zugangskontrolle (Wurzel 3)."""
    if not ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Kein Mandant im Token.")
    return ctx.tenant_id


def _beitrags_fehler(exc: Exception) -> HTTPException:
    """Die zwei Fehlerfälle eines Beitrags, jeder mit seinem eigenen Code.

    404 = die Seite gehört nicht zu diesem Konto (oder es gibt sie nicht) —
    dieselbe Antwort für beides, damit die Kennungen fremder Konten nicht
    durchprobierbar sind. 422 = die Seite gibt es, sie ist nur kein Beitrag."""
    if isinstance(exc, TypeError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=404, detail=str(exc))


class BeitragsOrdnung(BaseModel):
    """Die Beiträge in ihrer neuen Reihenfolge (0480)."""

    ids: list[str] = Field(default_factory=list, max_length=200)


@manage_router.put("/posts/reorder", status_code=204)
def reorder_posts(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: BeitragsOrdnung,
) -> None:
    """Die Handsortierung der Beitragsliste setzen — Index = Reihenfolge.

    Steht VOR `/pages/{page_id}/post`: FastAPI prüft Routen in der Reihenfolge
    ihrer Registrierung, und ein fester Pfad gehört vor einen mit Platzhalter.
    """
    seiten_modul.beitraege_ordnen(db, _tenant(ctx), body.ids)


@manage_router.get(
    "/pages/{page_id}/post", response_model=seiten_modul.BeitragResponse
)
def get_post(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
) -> seiten_modul.BeitragResponse:
    """Die Beitragsfelder einer Seite — Planung, Details, Beitrags-SEO."""
    try:
        return seiten_modul.beitrag_details(db, _tenant(ctx), page_id)
    except (ValueError, TypeError) as exc:
        raise _beitrags_fehler(exc) from exc


@manage_router.put(
    "/pages/{page_id}/post", response_model=seiten_modul.BeitragResponse
)
def update_post(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: str,
    body: seiten_modul.BeitragUpdate,
) -> seiten_modul.BeitragResponse:
    """Beitragsfelder setzen — auch das Erscheinungsdatum.

    Ein Datum in der ZUKUNFT ist die Planung: der Beitrag verschwindet damit aus
    Liste, Adresse, Feed und Sitemap und kommt von selbst wieder, wenn er dran
    ist. Ein Datum in der VERGANGENHEIT verschiebt ihn in der Reihenfolge —
    beides ist dasselbe Feld, weil es dieselbe Aussage ist."""
    try:
        return seiten_modul.beitrag_pflegen(db, _tenant(ctx), page_id, body)
    except (ValueError, TypeError) as exc:
        raise _beitrags_fehler(exc) from exc


@manage_router.get("/blog", response_model=seiten_modul.BlogEinstellungen)
def get_blog_settings(
    db: _DbDep, ctx: Annotated[AuthContext, Depends(_MANAGE)]
) -> seiten_modul.BlogEinstellungen:
    """Blogname, Nächster/Vorheriger-Navigation und die RSS-Angaben."""
    return seiten_modul.blog_einstellungen_lesen(db, _tenant(ctx))


@manage_router.put("/blog", response_model=seiten_modul.BlogEinstellungen)
def set_blog_settings(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: seiten_modul.BlogEinstellungen,
) -> seiten_modul.BlogEinstellungen:
    return seiten_modul.blog_einstellungen_setzen(db, _tenant(ctx), body)


# --- Feldkonfiguration der Beitragsfelder (0481) ---------------------------
#
# Framer-Analyse C1: jedes Feld traegt Name, Beschreibung, Pflicht,
# ein-/mehrzeilig, Platzhalter und Maximallaenge. Eigene Endpunkte und nicht an
# `/blog` gehaengt: das sind Einstellungen JE FELD, waehrend `/blog` die
# Einstellungen des ganzen Blogs traegt. Zusammengelegt muesste jeder
# Feld-Klick die Blogeinstellungen mitschicken — und ein Formular, das Werte
# mitschreibt, die es gar nicht kennt, loescht sie irgendwann.


@manage_router.get(
    "/blog/felder", response_model=beitrag_felder_modul.FeldKonfigListe
)
def get_post_field_config(
    db: _DbDep, ctx: Annotated[AuthContext, Depends(_MANAGE)]
) -> beitrag_felder_modul.FeldKonfigListe:
    """Die Feldkonfiguration dieses Betriebs — nur gespeicherte Abweichungen.

    Felder ohne Eintrag fehlen in der Antwort; ihre Vorgaben kennt der Katalog
    im Frontend. Sie hier aufzufuellen waere ein zweiter, erfundener Satz
    Vorgabewerte (Wurzel 4)."""
    return beitrag_felder_modul.konfig_laden(db, _tenant(ctx))


@manage_router.put(
    "/blog/felder/{feld_key}", response_model=beitrag_felder_modul.FeldKonfig
)
def set_post_field_config(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    feld_key: str,
    body: beitrag_felder_modul.FeldKonfig,
) -> beitrag_felder_modul.FeldKonfig:
    """Ein Beitragsfeld konfigurieren.

    Der Schluessel aus dem PFAD gewinnt: er ist die Adresse dieser Ressource.
    Ein abweichender Wert im Rumpf waere eine zweite Wahrheit darueber, welche
    Zeile gemeint ist — und die Antwort traege dann eine andere Adresse als
    die Anfrage."""
    if body.feld_key != feld_key:
        body = body.model_copy(update={"feld_key": feld_key})
    try:
        return beitrag_felder_modul.konfig_setzen(db, _tenant(ctx), body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@manage_router.delete("/blog/felder/{feld_key}", status_code=204)
def reset_post_field_config(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    feld_key: str,
) -> None:
    """Ein Feld auf die eingebaute Vorgabe zuruecksetzen."""
    try:
        beitrag_felder_modul.konfig_zuruecksetzen(db, _tenant(ctx), feld_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class BlogAutorenResponse(BaseModel):
    """Die Namen der Benutzer, die den Blog pflegen dürfen.

    NUR Namen — keine Kennung, keine E-Mail, keine Rolle. Der Autor eines
    Beitrags ist ein öffentlicher Text; ein Benutzerverzeichnis mit Adressen
    wäre Aufklärung für einen Angreifer (Wurzel 9)."""

    items: list[str] = Field(default_factory=list)


@manage_router.get("/blog/autoren", response_model=BlogAutorenResponse)
def list_blog_authors(
    db: _DbDep, ctx: Annotated[AuthContext, Depends(_MANAGE)]
) -> BlogAutorenResponse:
    """Vorschläge für das Autorenfeld — eine Bequemlichkeit ÜBER dem Freitext.

    Kein Ersatz dafür: 0438 hält fest, warum der Autor ein NAME und kein
    Benutzerverweis ist. „Familie Jensen" steht in keiner Benutzerliste."""
    return BlogAutorenResponse(items=seiten_modul.autorenliste(db, _tenant(ctx)))


@manage_router.post("/blog/import", response_model=rss_modul.RssImportErgebnis)
def import_blog_feed(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: rss_modul.RssImportRequest,
) -> rss_modul.RssImportErgebnis:
    """Beiträge aus einem fremden RSS-/Atom-Feed übernehmen (0457).

    Die Adresse liefert der Kunde — also läuft der Abruf über
    `core.ausgehende_url`: jede aufgelöste IP wird geprüft, die Verbindung auf
    die geprüfte IP gepinnt, jede Weiterleitung neu bewertet, der Body bei 8 MB
    abgebrochen (Wurzel 8). Der Endpunkt liegt zusätzlich im strengen
    `ai`-Rate-Limit-Bucket.

    Die Beiträge landen als ENTWURF und werden über ihren Slug erkannt: derselbe
    Feed zweimal importiert legt nichts doppelt an (Wurzel 2)."""
    tenant_id = _tenant(ctx)
    try:
        sprache = seiten_modul.standardsprache(db, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return rss_modul.feed_importieren(db, tenant_id, body, sprache=sprache)
    except rss_modul.RssImportFehler as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.meldung
        ) from exc
