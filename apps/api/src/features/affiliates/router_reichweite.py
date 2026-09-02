"""Router der Reichweiten-Etappe (0521): Beiträge, Kanalanbindung, Auswertung.

Zwei Router, dieselben Schutzstufen wie im Kern des Slice:
  * `router`            — Partner (`/affiliates/…`), nur freigegebene Partner,
                          jeder Zugriff auf die eigene affiliate_id gescopet.
  * `router_backoffice` — Backoffice (`/platform/affiliates/…`), jeder Aufruf
                          im Audit-Log; Schwellen ändern verlangt Schreibrecht.

Eigene Datei, damit die Etappe ohne Eingriff in router.py / router_backoffice.py
wächst; gemountet in main.py neben den beiden.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)

from src.core.config import get_settings
from src.core.security import (
    AffiliateContext,
    CurrentAffiliate,
    CurrentPlatformAdmin,
    require_approved_affiliate,
    require_platform_write,
)
from src.features.platform_admin import audit

from . import beitraege, kanal_verbindungen, reichweite, video_freigabe
from .dependencies import AffiliatesServiceDep
from .fehler import AffiliateError
from .schemas_reichweite import (
    BackofficeBeitrag,
    BackofficeReichweite,
    BackofficeReichweiteSummary,
    BackofficeVideoBeitrag,
    KanalAutorisierung,
    KanalUebersicht,
    KanalVerbinden,
    KanalVerbundenAntwort,
    PartnerBeitrag,
    PartnerBeitragAendern,
    PartnerBeitragAnlegen,
    PartnerReichweite,
    ReichweiteSchwelle,
    ReichweiteSchwelleSetzen,
    VideoAdresse,
    VideoEntscheidung,
)

router = APIRouter(prefix="/affiliates", tags=["affiliates"])
router_backoffice = APIRouter(prefix="/platform/affiliates", tags=["platform_affiliates"])


def _approved(ctx: CurrentAffiliate) -> AffiliateContext:
    require_approved_affiliate(ctx)
    return ctx


ApprovedAffiliate = Annotated[AffiliateContext, Depends(_approved)]


def _fehler(exc: AffiliateError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# =============================================================================
# Partner — Beiträge (Stufe A)
# =============================================================================


@router.get("/posts", response_model=list[PartnerBeitrag])
def posts(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> list[PartnerBeitrag]:
    try:
        return beitraege.liste(service.db, get_settings(), affiliate_id=ctx.affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post(
    "/codes/{code_id}/beitraege", response_model=PartnerBeitrag, status_code=status.HTTP_201_CREATED
)
def beitrag_anlegen(
    code_id: str, req: PartnerBeitragAnlegen, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> PartnerBeitrag:
    """Beitrag mit eigenem Link anlegen. Der Code wird über (id, affiliate_id)
    geladen — ein fremder Code ist ein 404, kein 403 (kein Orakel, Wurzel 9)."""
    try:
        return beitraege.anlegen(
            service.db, get_settings(), affiliate_id=ctx.affiliate_id, code_id=code_id, req=req
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.patch("/posts/{post_id}", response_model=PartnerBeitrag)
def beitrag_aendern(
    post_id: str, req: PartnerBeitragAendern, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> PartnerBeitrag:
    try:
        return beitraege.aendern(
            service.db, get_settings(), affiliate_id=ctx.affiliate_id, post_id=post_id, req=req
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def beitrag_loeschen(
    post_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> Response:
    try:
        beitraege.loeschen(service.db, affiliate_id=ctx.affiliate_id, post_id=post_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/posts/{post_id}/qr", response_class=Response)
def beitrag_qr(post_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> Response:
    """QR-Code des Beitragslinks als SVG (für Stories/Print). Serverseitig, damit
    der Link nicht im Browser nachgebaut werden muss und immer der ist, den wir
    auch zählen."""
    import qrcode  # noqa: PLC0415
    import qrcode.image.svg  # noqa: PLC0415

    try:
        b = beitraege.eigener(
            service.db, get_settings(), affiliate_id=ctx.affiliate_id, post_id=post_id
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    if not b.link:
        # Zwei Gründe, ein leerer Link — und sie verlangen verschiedene
        # Reaktionen: die fehlende Freigabe ist Sache des Partners (409), die
        # fehlende Basis-URL ein Betriebsmangel (503). Beides als 503 zu melden
        # hieße, den Partner auf einen Fehler warten zu lassen, den nur er
        # selbst beheben kann.
        if b.review_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Der Beitrag ist noch nicht freigegeben — kein Link, kein QR.",
            )
        raise HTTPException(
            status_code=503, detail="MARKETING_BASE_URL fehlt — kein Link, kein QR."
        )
    bild = qrcode.make(b.link, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2)
    return Response(
        content=bild.to_string(),
        media_type="image/svg+xml",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/posts/{post_id}/video", response_model=PartnerBeitrag)
async def beitrag_video_hochladen(
    post_id: str,
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
    datei: Annotated[UploadFile, File()],
) -> PartnerBeitrag:
    """Video zum Beitrag hochladen und zur Prüfung einreichen (0523).

    Erst nach der Freigabe entsteht der Link. Gelesen wird mit harter Grenze
    (Wurzel 8): ohne sie zöge ein 5-GB-Upload den Prozess in den Speicher,
    bevor irgendeine Prüfung greift.
    """
    inhalt = await datei.read(video_freigabe.MAX_BYTES + 1)
    if len(inhalt) > video_freigabe.MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Das Video ist größer als {video_freigabe.MAX_BYTES // (1024 * 1024)} MB.",
        )
    try:
        video_freigabe.video_hochladen(
            service.db,
            post_id=post_id,
            affiliate_id=ctx.affiliate_id,
            inhalt=inhalt,
            dateiname=datei.filename or "video",
        )
        return beitraege.eigener(
            service.db, get_settings(), affiliate_id=ctx.affiliate_id, post_id=post_id
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/posts/{post_id}/video", response_model=VideoAdresse)
def beitrag_video_ansehen(
    post_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> VideoAdresse:
    """Kurzlebige signierte Adresse des EIGENEN Videos (Vorschau)."""
    try:
        url = video_freigabe.video_adresse(
            service.db, post_id=post_id, affiliate_id=ctx.affiliate_id
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    return VideoAdresse(url=url)


# =============================================================================
# Partner — Kanalanbindung (Stufe B)
# =============================================================================


@router.get("/channels", response_model=KanalUebersicht)
def channels(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> KanalUebersicht:
    """Anbieter (konfiguriert?) und eigene Verbindungen samt letztem Snapshot."""
    try:
        return kanal_verbindungen.uebersicht(
            service.db, get_settings(), affiliate_id=ctx.affiliate_id
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/channels/{provider}/authorize", response_model=KanalAutorisierung)
def channel_authorize(provider: str, ctx: ApprovedAffiliate) -> KanalAutorisierung:
    """Autorisierungs-URL mit signiertem state. Der Browser wird von der
    Partner-App dorthin geschickt; wir leiten nicht selbst um (der Bearer
    lebt im httpOnly-Cookie der Partner-App, nicht hier)."""
    try:
        return kanal_verbindungen.autorisieren(
            get_settings(), affiliate_id=ctx.affiliate_id, provider=provider
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/channels/{provider}/connect", response_model=KanalVerbundenAntwort)
def channel_connect(
    provider: str, req: KanalVerbinden, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> KanalVerbundenAntwort:
    """Code-Tausch serverseitig — Token verlassen den Server nicht."""
    try:
        verbindungen = kanal_verbindungen.verbinden(
            service.db,
            get_settings(),
            affiliate_id=ctx.affiliate_id,
            provider=provider,
            code=req.code,
            state=req.state,
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    return KanalVerbundenAntwort(connections=verbindungen)


@router.delete("/channels/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def channel_disconnect(
    connection_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> Response:
    """„Verbindung trennen": Token löschen, Snapshots bleiben als Historie."""
    try:
        kanal_verbindungen.trennen(
            service.db, affiliate_id=ctx.affiliate_id, connection_id=connection_id
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/reach", response_model=PartnerReichweite)
def reach(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> PartnerReichweite:
    """Eigene Reichweite: Kanäle (verifiziert vs. Selbstauskunft) und Beiträge."""
    try:
        return reichweite.partner_sicht(service.db, get_settings(), affiliate_id=ctx.affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


# =============================================================================
# Backoffice (Stufe A + C)
# =============================================================================
# Literale Pfade (/posts/top, /reach/…) kollidieren nicht mit `/{affiliate_id}`
# des Kern-Routers, weil dort kein zweites Segment „top"/„summary"/„thresholds"
# existiert — geprüft 02.09.2026.


@router_backoffice.get("/posts/top", response_model=list[BackofficeBeitrag])
def bo_top_posts(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    limit: int = Query(20, ge=1, le=100),
) -> list[BackofficeBeitrag]:
    res = beitraege.bo_top(service.db, get_settings(), limit=limit)
    audit.record(service.db, ctx, "affiliate.posts.top", request=request)
    return res


@router_backoffice.get("/reach/summary", response_model=BackofficeReichweiteSummary)
def bo_reach_summary(
    request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficeReichweiteSummary:
    res = reichweite.bo_summary(service.db, get_settings())
    audit.record(service.db, ctx, "affiliate.reach.summary", request=request)
    return res


@router_backoffice.get("/reach/thresholds", response_model=list[ReichweiteSchwelle])
def bo_thresholds(
    request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> list[ReichweiteSchwelle]:
    res = reichweite.schwellen_liste(service.db)
    audit.record(service.db, ctx, "affiliate.reach.thresholds", request=request)
    return res


@router_backoffice.put("/reach/thresholds/{key}", response_model=ReichweiteSchwelle)
def bo_threshold_setzen(
    key: str,
    req: ReichweiteSchwelleSetzen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> ReichweiteSchwelle:
    require_platform_write(ctx)
    try:
        res = reichweite.schwelle_setzen(service.db, key=key, value=req.value)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.reach.threshold.set",
        target_type="reach_threshold",
        target_id=key,
        detail={"value": req.value},
        request=request,
    )
    return res


@router_backoffice.get("/{affiliate_id}/posts", response_model=list[BackofficeBeitrag])
def bo_posts(
    affiliate_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> list[BackofficeBeitrag]:
    res = beitraege.bo_liste(service.db, get_settings(), affiliate_id=affiliate_id)
    audit.record(
        service.db,
        ctx,
        "affiliate.posts",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router_backoffice.get("/{affiliate_id}/reach", response_model=BackofficeReichweite)
def bo_reach(
    affiliate_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficeReichweite:
    try:
        res = reichweite.bo_partner(service.db, get_settings(), affiliate_id=affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.reach",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


__all__ = ["router", "router_backoffice"]


# =============================================================================
# Backoffice — Videofreigabe (0523)
# =============================================================================


@router_backoffice.get("/videos/pending", response_model=list[BackofficeVideoBeitrag])
def bo_videos_offen(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    limit: int = Query(50, ge=1, le=200),
) -> list[BackofficeVideoBeitrag]:
    """Videos, die auf Freigabe warten — mit signierter Adresse zum Ansehen."""
    zeilen = video_freigabe.bo_offene(service.db, limit=limit)
    audit.record(service.db, ctx, "affiliate.videos.pending", request=request)
    return [BackofficeVideoBeitrag(**z) for z in zeilen]


@router_backoffice.get("/videos/{post_id}", response_model=VideoAdresse)
def bo_video_ansehen(
    post_id: str, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> VideoAdresse:
    """Signierte Adresse eines beliebigen Beitragsvideos (auch bereits
    geprüfter) — für die Nachschau im Streitfall."""
    _ = ctx
    try:
        return VideoAdresse(url=video_freigabe.bo_video_adresse(service.db, post_id))
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router_backoffice.post("/videos/{post_id}/decision", response_model=BackofficeVideoBeitrag)
def bo_video_entscheiden(
    post_id: str,
    req: VideoEntscheidung,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeVideoBeitrag:
    """Video freigeben oder ablehnen/widerrufen.

    Freigabe → der Link entsteht. Ablehnung nach einer Freigabe ist ein
    WIDERRUF: der Link ist sofort tot, die bereits verdiente Provision bleibt
    bestehen (bewusste Entscheidung, siehe video_freigabe-Docstring).
    """
    require_platform_write(ctx)
    try:
        if req.frei:
            zeile = video_freigabe.freigeben(
                service.db, post_id, admin_id=ctx.user_id, note=req.note
            )
        else:
            zeile = video_freigabe.ablehnen(
                service.db,
                post_id,
                admin_id=ctx.user_id,
                note=req.note or "",
                reason_code=req.reason_code,
            )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.video.decision",
        target_type="affiliate_post",
        target_id=post_id,
        detail={"frei": req.frei, "note": (req.note or "")[:200]},
        request=request,
    )
    zeile["video_url"] = video_freigabe.bo_video_adresse(service.db, post_id)
    return BackofficeVideoBeitrag(**zeile)
