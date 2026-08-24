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

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import SiteConfigServiceDep, WeiterleitungsServiceDep
from .schemas import (
    ApplyTemplateRequest,
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlocksReplaceRequest,
    BlockUpdate,
    BrandingResponse,
    BrandingUpdate,
    CustomDomainListResponse,
    CustomDomainResponse,
    DomainCreate,
    DraftTokenResponse,
    FormSubmissionListResponse,
    FormSubmissionRequest,
    FormSubmissionResponse,
    MediumListResponse,
    MediumResponse,
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
    SeoPruefungResponse,
    SitemapResponse,
    SliceHealth,
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
) -> BlockListResponse:
    try:
        return service.list_blocks(ctx, page_id)
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
@manage_router.get("/media", response_model=MediumListResponse)
def list_media(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MediumListResponse:
    """Bildbestand des Betriebs, neueste zuerst."""
    try:
        return service.list_media(ctx, limit=limit, offset=offset)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.post(
    "/media", response_model=MediumResponse, status_code=status.HTTP_201_CREATED
)
async def add_medium(
    service: SiteConfigServiceDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    file: Annotated[UploadFile, File()],
) -> MediumResponse:
    """Ein Bild in die Mediathek legen.

    Der Bildtyp wird serverseitig aus den Anfangsbytes bestimmt — der vom Client
    gemeldete ``content_type`` wird bewusst NICHT verwendet (Wurzel 8)."""
    content = await file.read()
    try:
        return service.add_medium(ctx, content, filename=file.filename)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@manage_router.delete(
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
) -> PublicPageResponse:
    """Host (+ optional Slug) → veröffentlichte Seite + Blöcke + Branding für den
    builder/-Renderer. KEIN JWT; nur is_published; unbekannt → 404."""
    try:
        return service.resolve_page(host, slug)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/page/draft", response_model=PublicPageResponse)
def resolve_page_draft(
    service: SiteConfigServiceDep,
    page_id: Annotated[str, Query()],
    token: Annotated[str, Query()],
) -> PublicPageResponse:
    """Entwurfs-Render für den Editor-iframe (auch unveröffentlicht). KEIN JWT,
    aber HMAC-Token-verifiziert (tenant+page+exp). Ungültig → 403."""
    try:
        return service.resolve_page_draft(page_id, token)
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


@public_router.post("/form", response_model=FormSubmissionResponse)
def submit_form(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    body: FormSubmissionRequest,
) -> FormSubmissionResponse:
    """Eine Formular-Einsendung eines GASTES annehmen (0436).

    KEIN JWT — ein Gast auf einer Kundenseite ist nicht eingeloggt. Deshalb ist
    das der engste Endpunkt des Slice: Host-Auflösung, Block-Prüfung gegen
    Tenant und Typ, veröffentlichte Seite, Feldprüfung gegen die Definition.
    Was die Prüfungen im Einzelnen abwehren, steht in
    `WeiterleitungsService.formular_absenden`.

    Die Antwort ist absichtlich leer (`{"ok": true}`): der Gast braucht nur zu
    wissen, dass es angekommen ist. Die gespeicherten Daten zurückzugeben wäre
    eine Einladung, den Endpunkt als Spiegel zu missbrauchen."""
    try:
        return service.formular_absenden(host, body)
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
) -> PublicPostListResponse:
    """Die veröffentlichten Blog-Beiträge einer Website (0438).

    Beiträge mit einem Erscheinungsdatum in der Zukunft bleiben aus — das ist
    die Vorplanung. Sie erscheinen von selbst, sobald der Zeitpunkt erreicht
    ist, ohne Hintergrundlauf."""
    try:
        return service.beitraege(host, limit=limit, offset=offset, tag=tag)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@public_router.get("/posts/{slug}", response_model=PublicPostResponse)
def resolve_post(
    service: WeiterleitungsServiceDep,
    host: Annotated[str, Query(min_length=3, max_length=253)],
    slug: str,
) -> PublicPostResponse:
    """Ein einzelner Blog-Beitrag mit seinen Abschnitten (0438)."""
    try:
        return service.beitrag(host, slug)
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
