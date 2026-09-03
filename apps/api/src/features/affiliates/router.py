"""Router des Partnerprogramms. Gemountet unter /api/v1/affiliates.

Drei Arten von Routen, drei Schutzstufen:
  * ÖFFENTLICH (Bewerbung, Login, Refresh, Reset, Klick, Staffel): der Partner
    hat noch kein Token. Schutz: strenger Rate-Limit-Bucket (`auth` bzw.
    `public_support`), reCAPTCHA auf der Bewerbung, Honigtopf.
  * PARTNER (`CurrentAffiliate`): Profil und Status darf jeder Bewerber sehen;
    alles darüber hinaus (Codes, Kunden, Geld) verlangt `approved`
    (`require_approved_affiliate`). Jeder Zugriff ist auf die eigene
    affiliate_id gescopet (Wurzel 3/9) — es gibt keine {id} im Pfad.
  * BACKOFFICE: eigener Router (`router_backoffice.py`).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from src.core.ratelimit import client_ip_from_xff
from src.core.security import (
    AffiliateContext,
    CurrentAffiliate,
    get_current_affiliate,
    require_approved_affiliate,
)

from . import attribution, auszahlung, connect
from .dependencies import AffiliatesServiceDep
from .schemas import (
    ConnectBank,
    ConnectBedingungen,
    ConnectDaten,
    ConnectIdentitaetsLink,
    ConnectPflichtfelder,
    ConnectStand,
    PartnerAuszahlungsListe,
    PartnerBedingungenAnnehmen,
    PartnerBewerbung,
    PartnerCode,
    PartnerCodeAnlegen,
    PartnerDashboard,
    PartnerKundenListe,
    PartnerLogin,
    PartnerMaterial,
    PartnerMessage,
    PartnerPasswordReset,
    PartnerPasswortNeu,
    PartnerProfil,
    PartnerProfilUpdate,
    PartnerProvisionsListe,
    PartnerRang,
    PartnerRefresh,
    PartnerSession,
    PartnerSteuerdaten,
    PartnerTeam,
    SliceHealth,
    TeamNachricht,
    TeamNachrichtSenden,
    TeamThread,
    TeamThreadStarten,
)
from .service import AffiliateError

router = APIRouter(prefix="/affiliates", tags=["affiliates"])


def _approved(ctx: CurrentAffiliate) -> AffiliateContext:
    require_approved_affiliate(ctx)
    return ctx


# Freigegebener Partner — für alles außer „eigenen Status ansehen".
ApprovedAffiliate = Annotated[AffiliateContext, Depends(_approved)]


def _fehler(exc: AffiliateError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _client(request: Request) -> tuple[str | None, str | None]:
    from src.core.config import get_settings  # noqa: PLC0415

    # Die Marketing-Seite meldet Klicks server-zu-server und reicht die echte
    # Besucher-IP als X-Client-IP durch (wie der Login für den Geräteverlauf).
    ip = request.headers.get("x-client-ip") or client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )
    return ip, request.headers.get("x-client-user-agent") or request.headers.get("user-agent")


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="affiliates")


# --- öffentlich ---------------------------------------------------------------


@router.get("/tiers", response_model=list[PartnerRang])
def tiers(service: AffiliatesServiceDep) -> list[PartnerRang]:
    """Die Staffel — für die Programmseite (marketing /partner). Öffentlich,
    weil sie beworben wird; die Zahl steht damit an EINER Stelle (Wurzel 4)."""
    try:
        return service.raenge()
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/apply", response_model=PartnerSession, status_code=status.HTTP_201_CREATED)
def apply(req: PartnerBewerbung, request: Request, service: AffiliatesServiceDep) -> PartnerSession:
    """Bewerbung: legt Login + Partnerzeile (pending_review) an und meldet an."""
    ip, ua = _client(request)
    try:
        return service.bewerben(req, ip=ip, user_agent=ua)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/auth/login", response_model=PartnerSession)
def login(req: PartnerLogin, service: AffiliatesServiceDep) -> PartnerSession:
    try:
        return service.login(req)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/auth/refresh", response_model=PartnerSession)
def refresh(req: PartnerRefresh, service: AffiliatesServiceDep) -> PartnerSession:
    try:
        return service.refresh(req)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/auth/password-reset", response_model=PartnerMessage)
def password_reset(req: PartnerPasswordReset, service: AffiliatesServiceDep) -> PartnerMessage:
    return service.password_reset(req)


@router.post("/auth/password-neu", response_model=PartnerSession)
def password_neu(
    req: PartnerPasswortNeu, service: AffiliatesServiceDep
) -> PartnerSession:
    """Neues Passwort mit dem CODE aus der Reset-Mail setzen und anmelden.

    Der Code statt des Links: der Link zeigte auf
    `{API_EXTERNAL_URL}/verify?token=…`, und weil jene Variable ohne das
    `/auth/v1`-Praefix gesetzt war, unter dem Kong GoTrue veroeffentlicht,
    antwortete er mit „no Route matched" (live 03.09.2026). Der Code hangt an
    keiner URL.

    Oeffentlich wie `/auth/login` — der Code IST der Nachweis."""
    return service.passwort_neu_setzen(req)


class KlickMeldung(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    referrer: str | None = Field(default=None, max_length=500)
    landing: str | None = Field(default=None, max_length=500)
    utm: dict[str, str] = Field(default_factory=dict)


class KlickAntwort(BaseModel):
    # None = Code unbekannt/inaktiv; die Seite leitet dann ohne Parameter weiter.
    code: str | None = None
    click_token: str | None = None


@router.post("/clicks", response_model=KlickAntwort)
def klick(req: KlickMeldung, request: Request, service: AffiliatesServiceDep) -> KlickAntwort:
    """Klick auf einen Partner-Link festhalten (von marketing `/p/{code}` gemeldet)."""
    ip, ua = _client(request)
    if len(req.utm) > 8:
        raise HTTPException(status_code=422, detail="Zu viele UTM-Parameter.")
    ergebnis = attribution.klick_erfassen(
        service.db,
        code=req.code,
        ip=ip,
        user_agent=ua,
        referrer=req.referrer,
        utm=req.utm,
        landing=req.landing,
    )
    return KlickAntwort(**ergebnis) if ergebnis else KlickAntwort()


# --- Partner ------------------------------------------------------------------


@router.get("/me", response_model=PartnerProfil)
def me(ctx: CurrentAffiliate, service: AffiliatesServiceDep) -> PartnerProfil:
    """Eigenes Profil inkl. Status — auch für Bewerber (die sehen so, dass die
    Prüfung läuft)."""
    try:
        return service.profil(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.patch("/me", response_model=PartnerProfil)
def me_aendern(
    req: PartnerProfilUpdate, ctx: CurrentAffiliate, service: AffiliatesServiceDep
) -> PartnerProfil:
    try:
        profil = service.profil_aendern(ctx, req)
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    if req.channels is not None:
        # Reichweite (0521): verifizierte Follower aus verbundenen Konten wieder
        # anlegen — der Partner kann `verified` weder setzen noch löschen.
        from . import kanal_verbindungen  # noqa: PLC0415

        kanal_verbindungen.kanaele_abgleichen(service.db, affiliate_id=ctx.affiliate_id)
        return service.profil(ctx)
    return profil


@router.put("/me/tax", response_model=PartnerProfil)
def steuerdaten(
    req: PartnerSteuerdaten, ctx: CurrentAffiliate, service: AffiliatesServiceDep
) -> PartnerProfil:
    """Rechtsform, USt-IdNr., Auszahlungsweg — mit Passwort-Rückfrage (Wurzel 7)."""
    try:
        return service.steuerdaten_setzen(ctx, req)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/dashboard", response_model=PartnerDashboard)
def dashboard(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> PartnerDashboard:
    try:
        return service.dashboard(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/customers", response_model=PartnerKundenListe)
def customers(
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> PartnerKundenListe:
    try:
        return service.kunden(ctx, limit=limit, offset=offset)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/commissions", response_model=PartnerProvisionsListe)
def commissions(
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> PartnerProvisionsListe:
    try:
        return service.provisionen(ctx, limit=limit, offset=offset)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/payouts", response_model=PartnerAuszahlungsListe)
def payouts(
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> PartnerAuszahlungsListe:
    try:
        return service.auszahlungen(ctx, limit=limit, offset=offset)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/payouts/{payout_id}/statement", response_class=PlainTextResponse)
def payout_statement(
    payout_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> PlainTextResponse:
    """Eigene Gutschrift — Load und Scope in EINEM Schritt (Wurzel 3/9): die
    Zeile wird über (id, affiliate_id) gesucht, nie erst geladen und dann
    verglichen."""
    rows = (
        service.db.table("affiliate_payouts")
        .select("id")
        .eq("id", payout_id)
        .eq("affiliate_id", ctx.affiliate_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden.")
    try:
        inhalt = auszahlung.gutschrift_rendern(service.db, payout_id)
    except auszahlung.AuszahlungError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return PlainTextResponse(inhalt, media_type="text/plain; charset=utf-8")


@router.get("/codes", response_model=list[PartnerCode])
def codes(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> list[PartnerCode]:
    try:
        return service.codes(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/codes", response_model=PartnerCode, status_code=status.HTTP_201_CREATED)
def code_anlegen(
    req: PartnerCodeAnlegen, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> PartnerCode:
    try:
        return service.code_anlegen(ctx, req)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/assets", response_model=list[PartnerMaterial])
def assets(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> list[PartnerMaterial]:
    try:
        return service.material(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


__all__ = ["router", "get_current_affiliate"]


# --- Team (0520) -----------------------------------------------------------------


@router.get("/team", response_model=PartnerTeam)
def team(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> PartnerTeam:
    try:
        return service.team(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/team/threads", response_model=list[TeamThread])
def team_threads(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> list[TeamThread]:
    try:
        return service.team_threads(ctx)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/team/threads", response_model=TeamThread, status_code=201)
def team_thread_starten(
    req: TeamThreadStarten, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> TeamThread:
    try:
        return service.team_thread_starten(ctx, req.partner_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/team/threads/{thread_id}/messages", response_model=list[TeamNachricht])
def team_nachrichten(
    thread_id: str, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> list[TeamNachricht]:
    try:
        return service.team_nachrichten(ctx, thread_id)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/team/threads/{thread_id}/messages", response_model=TeamNachricht, status_code=201)
def team_nachricht_senden(
    thread_id: str,
    req: TeamNachrichtSenden,
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
) -> TeamNachricht:
    try:
        return service.team_nachricht_senden(ctx, thread_id, req.body)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/me/terms", response_model=PartnerProfil)
def bedingungen_annehmen(
    req: PartnerBedingungenAnnehmen, ctx: CurrentAffiliate, service: AffiliatesServiceDep
) -> PartnerProfil:
    """Neue Version der Partner-AGB annehmen — auch für Bewerber (nicht nur approved)."""
    try:
        return service.bedingungen_annehmen(ctx, req.terms_version)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


# --- Verbundkonto (Stripe Connect, 0522) --------------------------------------
#
# Einziger Auszahlungsweg. Alle Routen verlangen `ApprovedAffiliate`: ein
# Bewerber hat noch kein Konto und soll auch keines anlegen können (Wurzel 9 —
# derselbe Scope wie die Liste, hier: derselbe Freigabestand).


@router.get("/me/connect", response_model=ConnectStand)
def connect_stand(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> ConnectStand:
    """Aktueller Stand des Verbundkontos — LIVE bei Stripe nachgelesen und
    gespiegelt, damit das Gate des Auszahlungslaufs nicht veraltet."""
    try:
        return ConnectStand(**connect.status_abgleichen(service.db, ctx.affiliate_id))
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/me/connect", response_model=ConnectStand, status_code=status.HTTP_201_CREATED)
def connect_anlegen(ctx: ApprovedAffiliate, service: AffiliatesServiceDep) -> ConnectStand:
    """Verbundkonto anlegen. Idempotent: ein zweiter Aufruf gibt das vorhandene
    Konto zurück (Wurzel 2)."""
    try:
        return ConnectStand(**connect.konto_anlegen(service.db, ctx.affiliate_id))
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.get("/me/connect/requirements", response_model=ConnectPflichtfelder)
def connect_pflichtfelder(
    ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> ConnectPflichtfelder:
    """Pflichtfelder für Land und Rechtsform dieses Partners — LIVE aus Stripe,
    kein Hardcode (Wurzel 4). Das Formular baut sich daraus auf."""
    try:
        profil = service.profil(ctx)
        felder = connect.pflichtfelder(
            profil.country,
            "company" if profil.legal_form == "company" else "individual",
        )
        return ConnectPflichtfelder(**felder)
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.put("/me/connect/data", response_model=ConnectStand)
def connect_daten(
    req: ConnectDaten, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> ConnectStand:
    """Geschäfts- und Personendaten an Stripe senden (eigene KYC-Oberfläche)."""
    try:
        return ConnectStand(
            **service.connect_daten_senden(ctx.affiliate_id, req)
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.put("/me/connect/bank", response_model=ConnectStand)
def connect_bank(
    req: ConnectBank, ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> ConnectStand:
    """Auszahlungskonto hinterlegen."""
    try:
        return ConnectStand(
            **connect.bank_setzen(
                service.db,
                ctx.affiliate_id,
                iban=req.iban.replace(" ", "").upper(),
                kontoinhaber=req.account_holder,
                waehrung=req.currency,
            )
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/me/connect/tos", response_model=ConnectStand)
def connect_bedingungen(
    req: ConnectBedingungen,
    request: Request,
    ctx: ApprovedAffiliate,
    service: AffiliatesServiceDep,
) -> ConnectStand:
    """Stripe-Vereinbarung annehmen.

    IP und Zeitpunkt kommen SERVERSEITIG (echte Client-IP, echte Uhrzeit des
    Klicks) — beides ist Compliance-Nachweis und darf nicht vom Client geliefert
    werden, sonst ist der Nachweis wertlos.
    """
    _ = req  # die Zustimmung selbst ist der Inhalt; validiert im Schema
    # Bewusst NICHT `_client()`: das nimmt zusätzlich den Header `x-client-ip`
    # an (Marketing meldet Klicks server-zu-server). Für einen Compliance-
    # Nachweis darf die IP nicht aus einem Header stammen, den der Client selbst
    # setzen kann — hier zählt nur die Proxy-geprüfte Kette.
    from src.core.config import get_settings  # noqa: PLC0415

    ip = client_ip_from_xff(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        get_settings().rate_limit_trusted_proxy_hops,
    )
    if not ip:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Die IP-Adresse konnte nicht ermittelt werden.",
        )
    try:
        return ConnectStand(
            **connect.bedingungen_annehmen(
                service.db,
                ctx.affiliate_id,
                ip=ip,
                zeitpunkt=int(datetime.now(UTC).timestamp()),
            )
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc


@router.post("/me/connect/identity-link", response_model=ConnectIdentitaetsLink)
def connect_identitaets_link(
    ctx: ApprovedAffiliate, service: AffiliatesServiceDep
) -> ConnectIdentitaetsLink:
    """Einmal-Link zu Stripes gehosteter Identitätsprüfung.

    Für Ausweis und Lebendnachweis — die kann unser Formular nicht einsammeln
    (siehe `connect.identitaets_link`). Der Link ist kurzlebig und wird bei
    jedem Aufruf neu erzeugt; er wird NICHT gespeichert, weil er ein
    Zugangsmittel zum Konto des Partners ist.
    """
    from src.core.config import get_settings  # noqa: PLC0415

    basis = (get_settings().partner_base_url or "").strip().rstrip("/")
    if not basis:
        # Wurzel 4: keine geratene Adresse. Ohne PARTNER_BASE_URL landete der
        # Partner nach der Prüfung im Nichts — das ist ein Betriebsmangel und
        # wird als solcher gemeldet, nicht mit einem Platzhalter überdeckt.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PARTNER_BASE_URL ist nicht gesetzt — Identitätsprüfung nicht möglich.",
        )
    try:
        url = connect.identitaets_link(
            service.db,
            ctx.affiliate_id,
            rueckkehr_url=f"{basis}/profil?identitaet=fertig",
            erneut_url=f"{basis}/profil?identitaet=erneut",
        )
    except AffiliateError as exc:
        raise _fehler(exc) from exc
    return ConnectIdentitaetsLink(url=url)
