"""Backoffice-Router des Partnerprogramms. Gemountet unter /api/v1/platform/affiliates.

Wie `platform_admin.router`: JEDER Endpunkt `CurrentPlatformAdmin`, jede
schreibende Aktion zusätzlich `require_platform_write`, jede Aktion im
Audit-Log (auch lesende — das Einsehen der Bankverbindung eines Partners IST
der Vorgang, der nachvollziehbar sein muss).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, ValidationError

# Bewusst Starlettes `UploadFile` und NICHT FastAPIs gleichnamige Unterklasse:
# der Multipart-Parser erzeugt Starlette-Instanzen, und
# `isinstance(teil, fastapi.UploadFile)` ist für die IMMER False — die Datei
# fiele stumm aus dem Formular, und der Upload meldete „keine Datei".
from starlette.datastructures import UploadFile

from src.core.security import CurrentPlatformAdmin, require_platform_write
from src.core.uploads import MAX_UPLOAD_BYTES
from src.features.platform_admin import audit

from . import auszahlung
from .auszahlung import AuszahlungError
from .dependencies import AffiliatesServiceDep
from .schemas import (
    BackofficeEntscheidung,
    BackofficeKorrektur,
    BackofficeLead,
    BackofficeLeadAendern,
    BackofficeLeadAnlegen,
    BackofficeLeadImport,
    BackofficeLeadImportErgebnis,
    BackofficeLeadListe,
    BackofficeManuelleZuordnung,
    BackofficeMaterial,
    BackofficeMaterialAendern,
    BackofficeMaterialAnlegen,
    BackofficeMaterialDatei,
    BackofficeMaterialVerschieben,
    BackofficeOrdner,
    BackofficeOrdnerAendern,
    BackofficeOrdnerAnlegen,
    BackofficePartner,
    BackofficePartnerDetail,
    BackofficePartnerListe,
    BackofficeProvision,
    BackofficeProvisionsListe,
    BackofficeRangSetzen,
    BackofficeReferral,
    BackofficeReferralListe,
    BackofficeReferralStatus,
    BackofficeSperre,
    BackofficeSponsorSetzen,
    BackofficeTeam,
    BackofficeTracking,
    BackofficeTrackingSummary,
)
from .service import AffiliateError

router = APIRouter(prefix="/platform/affiliates", tags=["platform_affiliates"])


def _fehler(exc: AffiliateError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Werbematerial: VOR /{affiliate_id}, sonst fängt der Pfadparameter "assets" ab.


@router.get("/assets", response_model=list[BackofficeMaterial])
def material_liste(
    request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> list[BackofficeMaterial]:
    res = service.bo_material_liste()
    audit.record(service.db, ctx, "affiliate.material.list", request=request)
    return res


@router.post("/assets", response_model=BackofficeMaterial, status_code=201)
def material_anlegen(
    req: BackofficeMaterialAnlegen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeMaterial:
    require_platform_write(ctx)
    try:
        res = service.bo_material_anlegen(req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.create",
        target_type="affiliate_asset",
        target_id=res.id,
        detail={"kind": req.kind, "title": req.title},
        request=request,
    )
    return res


@router.patch("/assets/{asset_id}", response_model=BackofficeMaterial)
def material_aendern(
    asset_id: str,
    req: BackofficeMaterialAendern,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeMaterial:
    require_platform_write(ctx)
    try:
        res = service.bo_material_aendern(asset_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.update",
        target_type="affiliate_asset",
        target_id=asset_id,
        detail=req.model_dump(exclude_unset=True),
        request=request,
    )
    return res


@router.delete("/assets/{asset_id}", status_code=204)
def material_loeschen(
    asset_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> None:
    require_platform_write(ctx)
    try:
        service.bo_material_loeschen(asset_id, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.delete",
        target_type="affiliate_asset",
        target_id=asset_id,
        request=request,
    )


async def _material_formular(request: Request) -> tuple[bytes, str | None, dict[str, str]]:
    """Multipart einlesen: die Datei unter `file`, der Rest als Textfelder.

    Alles in EINEM Durchlauf und innerhalb des Kontextmanagers: `request.form()`
    schließt beim Verlassen des Blocks jedes `UploadFile` darin, ein zweites
    `await request.form()` liefert dann geschlossene Dateien (siehe
    `core.uploads.read_upload_named`). Der Part-Deckel wird auf
    `MAX_UPLOAD_BYTES` angehoben — Starlette bricht sonst jede Datei über 1 MB
    mit einem rohen 413 ab, bevor der Service sie sieht.
    """
    try:
        async with request.form(max_part_size=MAX_UPLOAD_BYTES) as form:
            datei = form.get("file")
            if not isinstance(datei, UploadFile):
                raise HTTPException(status_code=400, detail="Keine Datei im Upload gefunden.")
            inhalt = await datei.read()
            name = datei.filename
            felder = {
                k: v for k, v in form.items() if k != "file" and isinstance(v, str)
            }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — Multipart-Parser wirft untypisiert
        raise HTTPException(
            status_code=413, detail="Die Datei ist zu groß oder ungültig."
        ) from exc
    return inhalt, name, felder


def _material_beschreibung(felder: dict[str, str]) -> BackofficeMaterialDatei:
    """Formularfelder → geprüfte Beschreibung.

    Ein HTML-Formular kennt nur Text: `sort` kommt als `"3"`, `active` als
    `"true"`/`"on"` oder gar nicht. Angreiferkontrollierter Text darf dabei
    keinen 500 werfen (Wurzel 5) — was keine Zahl ist, wird als Feldfehler
    abgelehnt, nicht als Absturz im `int()`.
    """
    sort_roh = (felder.get("sort") or "0").strip()
    try:
        return BackofficeMaterialDatei(
            title=felder.get("title") or "",
            description=felder.get("description"),
            language=felder.get("language"),
            sort=int(sort_roh) if sort_roh.isdigit() else 0,
            active=(felder.get("active") or "true").lower() in ("true", "on", "1"),
            # Der Reiter, der beim Ablegen offen war (0709). Existiert er
            # nicht, antwortet der Service mit 404 — die Datei landet dann
            # NICHT im Nirgendwo, sondern gar nicht.
            folder_id=felder.get("folder_id"),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/assets/upload", response_model=BackofficeMaterial, status_code=201)
async def material_hochladen(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeMaterial:
    """Eine Datei als Werbematerial ablegen (multipart `file` + Textfelder).

    Die Art (Bild · Video · Dokument) bestimmt der Service aus den Magic-Bytes;
    der vom Browser gemeldete `content_type` wird verworfen (Wurzel 8).
    """
    require_platform_write(ctx)
    inhalt, dateiname, felder = await _material_formular(request)
    beschreibung = _material_beschreibung(felder)
    try:
        res = service.bo_material_hochladen(inhalt, dateiname, beschreibung, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.upload",
        target_type="affiliate_asset",
        target_id=res.id,
        detail={"kind": res.kind, "title": res.title, "bytes": res.bytes},
        request=request,
    )
    return res


@router.post("/assets/{asset_id}/datei", response_model=BackofficeMaterial)
async def material_datei_ersetzen(
    asset_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeMaterial:
    """Die Datei eines vorhandenen Eintrags austauschen; die alte wird entfernt."""
    require_platform_write(ctx)
    inhalt, dateiname, _felder = await _material_formular(request)
    try:
        res = service.bo_material_datei_ersetzen(asset_id, inhalt, dateiname, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.replace_file",
        target_type="affiliate_asset",
        target_id=asset_id,
        detail={"bytes": res.bytes},
        request=request,
    )
    return res


# --- Ordner (0709) -----------------------------------------------------------
# Anders als bei `/assets` gegenüber `/{affiliate_id}` weiter unten braucht es
# hier KEINE Reihenfolge-Vorsicht: `/assets/{asset_id}` hat genau EIN Segment
# nach `/assets` (`[^/]+` matcht keinen Schrägstrich), `/assets/folders/{id}`
# hat zwei. `/assets/move` wäre einsegmentig, aber ein `POST /assets/{asset_id}`
# gibt es nicht. Steht hier, damit die nächste Änderung es nicht neu prüfen muss.


@router.get("/assets/folders", response_model=list[BackofficeOrdner])
def ordner_liste(
    ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> list[BackofficeOrdner]:
    """Die Reiter über der Materialliste. Kein Audit-Eintrag: Ordnernamen sind
    keine Daten, deren Einsicht nachvollziehbar sein muss."""
    _ = ctx
    return service.bo_ordner_liste()


@router.post("/assets/folders", response_model=BackofficeOrdner, status_code=201)
def ordner_anlegen(
    req: BackofficeOrdnerAnlegen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeOrdner:
    require_platform_write(ctx)
    try:
        res = service.bo_ordner_anlegen(req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material_folder.create",
        target_type="affiliate_asset_folder",
        target_id=res.id,
        detail={"name": res.name},
        request=request,
    )
    return res


@router.patch("/assets/folders/{folder_id}", response_model=BackofficeOrdner)
def ordner_aendern(
    folder_id: str,
    req: BackofficeOrdnerAendern,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeOrdner:
    require_platform_write(ctx)
    try:
        res = service.bo_ordner_aendern(folder_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material_folder.update",
        target_type="affiliate_asset_folder",
        target_id=folder_id,
        detail=req.model_dump(exclude_unset=True),
        request=request,
    )
    return res


@router.delete("/assets/folders/{folder_id}", status_code=204)
def ordner_loeschen(
    folder_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> None:
    """Den Reiter entfernen. Das Material darin bleibt und liegt danach in
    keinem Ordner — Löschen eines Ordners ist kein Löschen von Material."""
    require_platform_write(ctx)
    try:
        service.bo_ordner_loeschen(folder_id, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material_folder.delete",
        target_type="affiliate_asset_folder",
        target_id=folder_id,
        request=request,
    )


@router.post("/assets/move", response_model=list[BackofficeMaterial])
def material_verschieben(
    req: BackofficeMaterialVerschieben,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> list[BackofficeMaterial]:
    """Material in einen Ordner ziehen — `folder_id: null` holt es heraus."""
    require_platform_write(ctx)
    try:
        res = service.bo_material_verschieben(req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.material.move",
        target_type="affiliate_asset",
        detail={"anzahl": len(req.asset_ids), "folder_id": req.folder_id},
        request=request,
    )
    return res


# --- Leads (0526): VOR /{affiliate_id}, sonst fängt der Pfadparameter "leads" ab.


@router.get("/leads", response_model=BackofficeLeadListe)
def leads_liste(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    status_: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> BackofficeLeadListe:
    res = service.bo_leads(
        status=status_,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        q=q,
        limit=limit,
        offset=offset,
    )
    audit.record(service.db, ctx, "affiliate.lead.list", request=request)
    return res


@router.post("/leads", response_model=BackofficeLead, status_code=201)
def lead_anlegen(
    req: BackofficeLeadAnlegen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeLead:
    require_platform_write(ctx)
    try:
        res = service.bo_lead_anlegen(req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.lead.create",
        target_type="affiliate_lead",
        target_id=res.id,
        detail={"category": req.category},
        request=request,
    )
    return res


@router.post("/leads/import", response_model=BackofficeLeadImportErgebnis)
def leads_importieren(
    req: BackofficeLeadImport,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeLeadImportErgebnis:
    require_platform_write(ctx)
    try:
        res = service.bo_leads_importieren(req.csv, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.lead.import",
        detail={"angelegt": res.angelegt, "fehler": len(res.fehler)},
        request=request,
    )
    return res


@router.patch("/leads/{lead_id}", response_model=BackofficeLead)
def lead_aendern(
    lead_id: str,
    req: BackofficeLeadAendern,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeLead:
    require_platform_write(ctx)
    try:
        res = service.bo_lead_aendern(lead_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.lead.update",
        target_type="affiliate_lead",
        target_id=lead_id,
        detail={"felder": sorted(req.model_dump(exclude_unset=True))},
        request=request,
    )
    return res


@router.delete("/leads/{lead_id}", status_code=204)
def lead_loeschen(
    lead_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> None:
    require_platform_write(ctx)
    try:
        service.bo_lead_loeschen(lead_id, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.lead.delete",
        target_type="affiliate_lead",
        target_id=lead_id,
        request=request,
    )


@router.get("/tracking/summary", response_model=BackofficeTrackingSummary)
def tracking_summary(
    request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficeTrackingSummary:
    res = service.bo_tracking_summary()
    audit.record(service.db, ctx, "affiliate.tracking.summary", request=request)
    return res


@router.get("", response_model=BackofficePartnerListe)
def liste(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    status: str | None = Query(default=None, max_length=20),
    suche: str | None = Query(default=None, max_length=100),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> BackofficePartnerListe:
    try:
        res = service.bo_liste(status=status, suche=suche, limit=limit, offset=offset)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(service.db, ctx, "affiliate.list", detail={"status": status}, request=request)
    return res


# --- Auszahlungen (Verbundkonto, 0522: Transfer statt Sammel-CSV) ------------
# Diese Routen stehen VOR `/{affiliate_id}`: sonst fängt der Pfadparameter das
# Wort „payouts" ab und antwortet „Partner nicht gefunden".


class AuszahlungZeile(BaseModel):
    id: str
    affiliate_id: str
    currency: str
    amount: str
    method: str
    status: str
    statement_no: str | None = None
    external_ref: str | None = None
    period_from: str | None = None
    period_to: str | None = None
    paid_at: str | None = None
    failed_reason: str | None = None
    created_at: str


class AuszahlungListe(BaseModel):
    items: list[AuszahlungZeile]
    total: int


class AuszahlungBestaetigen(BaseModel):
    external_ref: str = Field(min_length=1, max_length=120)


class AuszahlungFehlgeschlagen(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AuszahlungenAusfuehren(BaseModel):
    """Welche offenen Auszahlungen jetzt überwiesen werden. Obergrenze, damit
    ein Klick nicht unbegrenzt viele Transfers auslöst (Wurzel 8)."""

    payout_ids: list[str] = Field(min_length=1, max_length=100)


_ZEILEN_FELDER = frozenset(AuszahlungZeile.model_fields)


def _zeile(row: dict) -> AuszahlungZeile:
    return AuszahlungZeile(
        **{k: (str(v) if v is not None else None) for k, v in row.items() if k in _ZEILEN_FELDER}
    )


def _auszahlung_fehler(exc: AuszahlungError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/payouts", response_model=AuszahlungListe)
def auszahlungen(
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    status: str | None = Query(default=None, max_length=20),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AuszahlungListe:
    q = (
        service.db.table("affiliate_payouts")
        .select("*", count="exact")
        .order("created_at", desc=True)
    )
    if status:
        q = q.eq("status", status)
    res = q.range(offset, offset + limit - 1).execute()
    audit.record(service.db, ctx, "affiliate.payouts", detail={"status": status}, request=request)
    return AuszahlungListe(
        total=res.count or 0,
        items=[_zeile(r) for r in (res.data or [])],
    )


@router.post("/payouts/run", response_model=dict[str, int])
def auszahlungslauf(
    request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> dict[str, int]:
    """Den Monatslauf von Hand anstoßen (idempotent: bereits gebündelte Zeilen
    tragen eine payout_id und werden nicht erneut gebündelt)."""
    require_platform_write(ctx)
    bilanz = auszahlung.lauf_vorbereiten(service.db)
    audit.record(service.db, ctx, "affiliate.payout_run", detail=bilanz, request=request)
    return bilanz


@router.post("/payouts/execute", response_model=dict[str, Any])
def auszahlungen_ausfuehren(
    req: AuszahlungenAusfuehren,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> dict[str, Any]:
    """Überweist die ausgewählten offenen Auszahlungen auf die Verbundkonten.

    Ersetzt ab 0522 den CSV-Export: kein Umweg mehr über Bank-Upload und
    händisches Zurücktragen der Referenz. Ein Fehlschlag bei einem Partner
    beendet den Lauf nicht — er wird einzeln gemeldet und die Zeile wieder
    freigegeben (Wurzel 5).
    """
    require_platform_write(ctx)
    try:
        ergebnis = auszahlung.ausfuehren(
            service.db,
            req.payout_ids,
            admin_id=ctx.user_id,
            mails=service.mails,
        )
    except AuszahlungError as exc:
        raise _auszahlung_fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.payout_execute",
        detail={
            "anzahl": len(req.payout_ids),
            "bezahlt": ergebnis["bezahlt"],
            "fehlgeschlagen": ergebnis["fehlgeschlagen"],
        },
        request=request,
    )
    return ergebnis


@router.get("/payouts/{payout_id}/statement", response_class=PlainTextResponse)
def gutschrift(
    payout_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> PlainTextResponse:
    try:
        inhalt = auszahlung.gutschrift_rendern(service.db, payout_id)
    except AuszahlungError as exc:
        raise _auszahlung_fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.statement",
        target_type="affiliate_payout",
        target_id=payout_id,
        request=request,
    )
    return PlainTextResponse(inhalt, media_type="text/plain; charset=utf-8")


@router.post("/payouts/{payout_id}/paid", response_model=AuszahlungZeile)
def auszahlung_bestaetigen(
    payout_id: str,
    req: AuszahlungBestaetigen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> AuszahlungZeile:
    require_platform_write(ctx)
    try:
        row = auszahlung.bestaetigen(
            service.db,
            payout_id,
            external_ref=req.external_ref,
            admin_id=ctx.user_id,
            mails=service.mails,
        )
    except AuszahlungError as exc:
        raise _auszahlung_fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.payout_paid",
        target_type="affiliate_payout",
        target_id=payout_id,
        detail={"ref": req.external_ref},
        request=request,
    )
    return _zeile(row)


@router.post("/payouts/{payout_id}/failed", response_model=AuszahlungZeile)
def auszahlung_fehlgeschlagen(
    payout_id: str,
    req: AuszahlungFehlgeschlagen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> AuszahlungZeile:
    require_platform_write(ctx)
    try:
        row = auszahlung.fehlgeschlagen(
            service.db, payout_id, grund=req.reason, admin_id=ctx.user_id
        )
    except AuszahlungError as exc:
        raise _auszahlung_fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.payout_failed",
        target_type="affiliate_payout",
        target_id=payout_id,
        detail={"reason": req.reason},
        request=request,
    )
    return _zeile(row)


@router.get("/{affiliate_id}", response_model=BackofficePartnerDetail)
def detail(
    affiliate_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficePartnerDetail:
    try:
        res = service.bo_detail(affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.view",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.get("/{affiliate_id}/tracking", response_model=BackofficeTracking)
def tracking(
    affiliate_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeTracking:
    try:
        res = service.bo_tracking(affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.tracking",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.post("/{affiliate_id}/decision", response_model=BackofficePartner)
def entscheiden(
    affiliate_id: str,
    req: BackofficeEntscheidung,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficePartner:
    require_platform_write(ctx)
    try:
        res = service.bo_entscheiden(affiliate_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        f"affiliate.{req.decision}",
        target_type="affiliate",
        target_id=affiliate_id,
        detail={"reason": req.reason},
        request=request,
    )
    return res


@router.post("/{affiliate_id}/suspend", response_model=BackofficePartner)
def sperren(
    affiliate_id: str,
    req: BackofficeSperre,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficePartner:
    require_platform_write(ctx)
    try:
        res = service.bo_sperren(affiliate_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.suspend",
        target_type="affiliate",
        target_id=affiliate_id,
        detail={"reason": req.reason},
        request=request,
    )
    return res


@router.post("/{affiliate_id}/reactivate", response_model=BackofficePartner)
def entsperren(
    affiliate_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficePartner:
    require_platform_write(ctx)
    try:
        res = service.bo_entsperren(affiliate_id, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.reactivate",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.get("/{affiliate_id}/referrals", response_model=BackofficeReferralListe)
def referrals(
    affiliate_id: str, request: Request, ctx: CurrentPlatformAdmin, service: AffiliatesServiceDep
) -> BackofficeReferralListe:
    try:
        res = service.bo_referrals(affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.referrals",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.post("/referrals/{referral_id}/status", response_model=BackofficeReferral)
def referral_status(
    referral_id: str,
    req: BackofficeReferralStatus,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeReferral:
    require_platform_write(ctx)
    try:
        res = service.bo_referral_status(referral_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.referral_status",
        target_type="affiliate_referral",
        target_id=referral_id,
        tenant_id=res.tenant_id,
        detail={"status": req.status, "note": req.note},
        request=request,
    )
    return res


@router.post("/referrals/manual", response_model=BackofficeReferral)
def referral_manuell(
    req: BackofficeManuelleZuordnung,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeReferral:
    require_platform_write(ctx)
    try:
        res = service.bo_manuell_zuordnen(req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.referral_manual",
        target_type="affiliate",
        target_id=req.affiliate_id,
        tenant_id=req.tenant_id,
        detail={"note": req.note},
        request=request,
    )
    return res


@router.get("/{affiliate_id}/commissions", response_model=BackofficeProvisionsListe)
def provisionen(
    affiliate_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> BackofficeProvisionsListe:
    try:
        res = service.bo_provisionen(affiliate_id, limit=limit, offset=offset)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.commissions",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.post("/{affiliate_id}/adjustments", response_model=BackofficeProvision)
def korrektur(
    affiliate_id: str,
    req: BackofficeKorrektur,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeProvision:
    require_platform_write(ctx)
    try:
        res = service.bo_korrektur(affiliate_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.adjustment",
        target_type="affiliate",
        target_id=affiliate_id,
        detail={"amount": req.amount, "currency": req.currency, "reason": req.reason},
        request=request,
    )
    return res


@router.post("/{affiliate_id}/tier", response_model=BackofficePartner)
def rang(
    affiliate_id: str,
    req: BackofficeRangSetzen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficePartner:
    require_platform_write(ctx)
    try:
        res = service.bo_rang_setzen(affiliate_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.tier",
        target_type="affiliate",
        target_id=affiliate_id,
        detail={"tier": req.tier_id, "note": req.note},
        request=request,
    )
    return res


# --- Team (0520) -----------------------------------------------------------------


@router.get("/{affiliate_id}/team", response_model=BackofficeTeam)
def bo_team(
    affiliate_id: str,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficeTeam:
    try:
        res = service.bo_team(affiliate_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.team.view",
        target_type="affiliate",
        target_id=affiliate_id,
        request=request,
    )
    return res


@router.post("/{affiliate_id}/sponsor", response_model=BackofficePartner)
def bo_sponsor_setzen(
    affiliate_id: str,
    req: BackofficeSponsorSetzen,
    request: Request,
    ctx: CurrentPlatformAdmin,
    service: AffiliatesServiceDep,
) -> BackofficePartner:
    require_platform_write(ctx)
    try:
        res = service.bo_sponsor_setzen(affiliate_id, req, ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    audit.record(
        service.db,
        ctx,
        "affiliate.sponsor.set",
        target_type="affiliate",
        target_id=affiliate_id,
        detail={
            "sponsor_affiliate_id": req.sponsor_affiliate_id,
            "note": req.note,
            "clear_flags": req.clear_flags,
        },
        request=request,
    )
    return res
