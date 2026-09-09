"""Router des Eigentümer-Chats: Geräte, Freigabe, Bilder (0611, ADR-0029).

Gemountet unter /api/v1/owner-chat. BEIDE Seiten sprechen ihn an — Eigentümer
wie Agentur registrieren hier ihre Geräte, weil der Vorgang derselbe ist. Nur
`seite` unterscheidet sich, und die leitet der Server aus der Rolle ab, statt
sie vom Client entgegenzunehmen (Wurzel 3): sonst trüge sich ein Mitarbeiter
als Eigentümer ein und bekäme dessen Schlüssel.

Die Gesprächs-Endpunkte stehen NICHT hier, sondern je Seite dort, wo der Scope
sitzt — `public_portal/router.py` für den Eigentümer, `inbox` für die Agentur.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from src.core.logging import get_logger
from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_service_client
from src.features.auth.schemas import UserRole

from . import bilder, freigabe, geraete
from .fehler import OwnerChatError
from .schemas import (
    BildAdresse,
    BildHochgeladen,
    FreigabeErgebnis,
    FreigabeOffen,
    FreigabeOffenListe,
    FreigabeSenden,
    GeraetAufgabe,
    GeraetInfo,
    GeraetListe,
    GeraetRegistrieren,
    WiederherstellungAblegen,
    WiederherstellungInfo,
)

log = get_logger(__name__)

router = APIRouter(prefix="/owner-chat", tags=["owner-chat"])

CtxDep = Annotated[AuthContext, Depends(get_current_user)]


def _konto(ctx: AuthContext) -> tuple[str, str]:
    if not ctx.tenant_id or not ctx.user_id:
        raise HTTPException(status_code=403, detail="Kein Konto im Token.")
    return ctx.tenant_id, ctx.user_id


def _seite(ctx: AuthContext) -> str:
    """Auf WELCHER Seite steht dieser Nutzer? Aus der DB, nicht vom Client.

    Rolle `owner` (dazu zählen Familienmitglieder, 0389) ist die
    Eigentümerseite, alles andere die Agentur. Die Quelle ist die Datenbank,
    nicht `ctx.role` aus dem JWT — eine geänderte Rolle muss sofort wirken
    (Wurzel 7).
    """
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    zeilen = (
        db.table("users")
        .select("role")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise HTTPException(status_code=403, detail="Konto nicht gefunden.")
    return "owner" if zeilen[0].get("role") == UserRole.owner.value else "agency"


def _fehler(exc: OwnerChatError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- Geräte -------------------------------------------------------------------


@router.post("/geraete/aufgabe", response_model=GeraetAufgabe)
def geraet_aufgabe(ctx: CtxDep) -> GeraetAufgabe:
    """Zufallswert holen, den das Gerät signieren muss (Besitznachweis)."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    return GeraetAufgabe(aufgabe=geraete.aufgabe_erzeugen(db, tenant_id, user_id))


@router.post("/geraete", response_model=GeraetInfo, status_code=201)
def geraet_anlegen(req: GeraetRegistrieren, ctx: CtxDep) -> GeraetInfo:
    """Öffentliche Schlüssel eines Geräts eintragen."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        zeile = geraete.geraet_registrieren(
            db,
            tenant_id,
            user_id,
            seite=_seite(ctx),
            public_key=req.public_key,
            signing_key=req.signing_key,
            signatur=req.signatur,
            geraet_name=req.geraet_name,
        )
    except OwnerChatError as exc:
        raise _fehler(exc) from exc
    return _zu_geraet(zeile)


@router.get("/geraete", response_model=GeraetListe)
def geraete_liste(ctx: CtxDep) -> GeraetListe:
    """Die eigenen Geräte — damit sichtbar ist, WAS mitliest."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    return GeraetListe(
        items=[_zu_geraet(z) for z in geraete.geraete_lesen(db, tenant_id, user_id)]
    )


@router.delete("/geraete/{device_id}", status_code=204)
def geraet_sperren(device_id: str, ctx: CtxDep) -> None:
    """Eigenes Gerät sperren (verloren/verkauft). Kein Löschen — Wurzel 1."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        geraete.geraet_sperren(db, tenant_id, user_id, device_id)
    except OwnerChatError as exc:
        raise _fehler(exc) from exc


def _zu_geraet(zeile: dict) -> GeraetInfo:
    return GeraetInfo(
        id=str(zeile["id"]),
        geraet_name=str(zeile.get("geraet_name") or ""),
        seite=str(zeile.get("seite") or ""),
        gesperrt_am=zeile.get("gesperrt_am"),
        zuletzt_aktiv=zeile.get("zuletzt_aktiv"),
        created_at=zeile.get("created_at"),
    )


# --- Wiederherstellung ---------------------------------------------------------


@router.put("/wiederherstellung", status_code=204)
def wiederherstellung_setzen(
    req: WiederherstellungAblegen, ctx: CtxDep
) -> None:
    """Den mit dem Sicherungscode verschlüsselten Schlüssel hinterlegen.

    Der CODE kommt hier nie an — nur die Hülle, die ohne ihn wertlos ist.
    """
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        geraete.wiederherstellung_ablegen(
            db,
            tenant_id,
            user_id,
            wrapped_identity=req.wrapped_identity,
            kdf_params=req.kdf_params,
        )
    except OwnerChatError as exc:
        raise _fehler(exc) from exc


@router.get("/wiederherstellung", response_model=WiederherstellungInfo)
def wiederherstellung_holen(ctx: CtxDep) -> WiederherstellungInfo:
    """Die Hülle abholen — aufmachen kann sie nur, wer den Code hat."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    zeile = geraete.wiederherstellung_lesen(db, tenant_id, user_id)
    if not zeile:
        raise HTTPException(status_code=404, detail="Keine Sicherung hinterlegt.")
    return WiederherstellungInfo(
        wrapped_identity=str(zeile["wrapped_identity"]),
        kdf_params=dict(zeile.get("kdf_params") or {}),
    )


# --- Freigabe alter Verläufe ---------------------------------------------------


@router.get(
    "/freigabe/{thread_id}/{device_id}", response_model=FreigabeOffenListe
)
def freigabe_offen(
    thread_id: str, device_id: str, ctx: CtxDep
) -> FreigabeOffenListe:
    """Nachrichten, für die dieses Gerät noch keinen Schlüssel hat."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        zeilen = freigabe.offene_nachrichten(
            db, tenant_id, user_id, thread_id, device_id
        )
    except OwnerChatError as exc:
        raise _fehler(exc) from exc
    return FreigabeOffenListe(
        items=[
            FreigabeOffen(message_id=str(z["id"]), chiffre=str(z.get("body") or ""))
            for z in zeilen
        ]
    )


@router.post("/freigabe/{thread_id}", response_model=FreigabeErgebnis)
def freigabe_senden(
    thread_id: str, req: FreigabeSenden, ctx: CtxDep
) -> FreigabeErgebnis:
    """Nachverpackte Schlüssel ablegen. NUR admin/co_admin (Festlegung)."""
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        anzahl = freigabe.schluessel_nachtragen(
            db,
            tenant_id,
            user_id,
            thread_id,
            req.device_id,
            schluessel=req.schluessel,
            wrapper_key=req.wrapper_key,
        )
    except OwnerChatError as exc:
        raise _fehler(exc) from exc
    return FreigabeErgebnis(nachgetragen=anzahl)


# --- Bilder --------------------------------------------------------------------


@router.get("/bilder/adresse", response_model=BildAdresse)
def bild_adresse(ctx: CtxDep, pfad: Annotated[str, Query()]) -> BildAdresse:
    """Kurzlebige signierte Adresse für ein bereits abgelegtes Bild.

    WURZEL 3 — der Pfad kommt vom Client und wird deshalb NICHT blind
    signiert. Geprüft wird die FORM gegen ein Muster (`bilder.pfad_pruefen`),
    nicht per Teilstring: `pfad.startswith(tenant)` plus `".." in pfad` stand
    hier zuerst und war umgehbar — `<tenant>/%2e%2e/<fremd>/…` passierte beide
    Prüfungen, weil die Storage-Bibliothek ein zweites Mal dekodiert und das
    `..` wegnormalisiert. Der Mandantenpräfix verschwand dabei, noch bevor die
    Anfrage rausging (nachgemessen 09.09.2026).

    Dass der Inhalt verschlüsselt ist, entschuldigt nichts: Chiffretext lässt
    sich aufbewahren, und ein Pfad verrät Mandant und Nutzer.
    """
    tenant_id, _ = _konto(ctx)
    db = get_service_client()
    try:
        bilder.pfad_pruefen(pfad, tenant_id)
        return BildAdresse(url=bilder.signierte_adresse(db, pfad))
    except OwnerChatError as exc:
        raise _fehler(exc) from exc


@router.post("/bilder", response_model=BildHochgeladen, status_code=201)
async def bild_hochladen(
    ctx: CtxDep, datei: Annotated[UploadFile, File()]
) -> BildHochgeladen:
    """Ein Bild in den privaten Bucket legen.

    Es wird als CHIFFRETEXT hochgeladen — die App verschlüsselt es vor dem
    Senden, genau wie den Text (ADR-0029). Der Server prüft Größe und Form,
    sieht aber kein Bild.
    """
    tenant_id, user_id = _konto(ctx)
    db = get_service_client()
    try:
        return BildHochgeladen(
            **await bilder.hochladen(db, tenant_id, user_id, datei)
        )
    except OwnerChatError as exc:
        raise _fehler(exc) from exc
