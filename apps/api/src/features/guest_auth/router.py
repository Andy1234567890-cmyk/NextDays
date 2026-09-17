"""Router für guest_auth. Gemountet unter /api/v1/guest-auth.

Gast-Auth-Welt der Plattform-Demand-Seite (Kunden-Dashboard unter /plattform),
GETRENNT von der Tenant-Auth (/api/v1/auth). ``register``/``login``/``refresh``/
``password-reset`` sind bewusst public (der Gast hat ja noch kein Token);
``me``/``PATCH me`` verlangen ein Gast-Token (``CurrentGuest``) und sind strikt
über die eigene guest_id gescopet (Wurzel 3/9).
"""
from fastapi import APIRouter, HTTPException, status

from src.core.security import CurrentGuest
from src.features.payments.service import PaymentsError

from .dependencies import (
    GuestAuthServiceDep,
    GuestCodeServiceDep,
    GuestIdentityServiceDep,
)
from .schemas import (
    GuestCodeAnfrageRequest,
    GuestCodeAntwort,
    GuestCodePruefenRequest,
    GuestIdentityResponse,
    GuestIdentityStartRequest,
    GuestIdentityStatusResponse,
    GuestKontoLoeschenRequest,
    GuestKontoLoeschenResponse,
    GuestLoginRequest,
    GuestMessageResponse,
    GuestPasswordResetRequest,
    GuestPasswortNeuRequest,
    GuestProfilAnlegenRequest,
    GuestProfileResponse,
    GuestProfileUpdateRequest,
    GuestRefreshRequest,
    GuestRegisterRequest,
    GuestSessionResponse,
    SliceHealth,
)
from .service import GuestAuthError

router = APIRouter(prefix="/guest-auth", tags=["guest_auth"])


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    # Health hängt bewusst nicht an Supabase-Clients (kein Key nötig).
    return SliceHealth(slice="guest_auth")


@router.post(
    "/register",
    response_model=GuestSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    req: GuestRegisterRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """Neues Gast-Konto anlegen (Auth-User ohne Tenant + portal_guests-Zeile)."""
    try:
        return service.register(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=GuestSessionResponse)
def login(
    req: GuestLoginRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """E-Mail + Passwort → Session. Kein MFA für Gäste."""
    try:
        return service.login(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/refresh", response_model=GuestSessionResponse)
def refresh(
    req: GuestRefreshRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """Silent-Refresh: frische Session aus dem Refresh-Token. KEIN Guard — der
    Access-Token ist ja gerade abgelaufen; fail-closed 401 bei ungültigem Token."""
    try:
        return service.refresh(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/password-reset", response_model=GuestMessageResponse)
def password_reset(
    req: GuestPasswordResetRequest, service: GuestAuthServiceDep
) -> GuestMessageResponse:
    """Passwort-Reset anstoßen. Antwortet IMMER 200 (kein Existenz-Leak)."""
    return service.password_reset(req)


@router.post("/password-neu", response_model=GuestSessionResponse)
def password_neu(
    req: GuestPasswortNeuRequest, service: GuestAuthServiceDep
) -> GuestSessionResponse:
    """Neues Passwort mit dem CODE aus der Reset-Mail setzen und anmelden.

    Der Code statt des Links: der Link zeigte auf
    `{API_EXTERNAL_URL}/verify?token=…`, und weil jene Variable die Kong-Basis
    OHNE `/auth/v1` ist, endete er in Kongs „no Route matched" (gemessen
    03.09.2026). Der Code haengt an keiner URL.

    Oeffentlich wie `/login` — der Code IST der Nachweis."""
    try:
        return service.passwort_neu_setzen(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/me", response_model=GuestProfileResponse)
def get_me(
    ctx: CurrentGuest, service: GuestAuthServiceDep
) -> GuestProfileResponse:
    """Eigenes Gast-Profil (guest_id-gescopet, Wurzel 3/9)."""
    try:
        return service.get_profile(ctx)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/me", response_model=GuestProfileResponse)
def update_me(
    req: GuestProfileUpdateRequest,
    ctx: CurrentGuest,
    service: GuestAuthServiceDep,
) -> GuestProfileResponse:
    """Eigene Profilfelder ändern (name/phone/locale/currency/marketing).

    Die E-Mail wird hier NICHT geändert — E-Mail-Wechsel braucht Re-Auth +
    Doppel-Opt-in (Wurzel 7) und ist ein eigener Flow."""
    try:
        return service.update_profile(ctx, req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/me", response_model=GuestKontoLoeschenResponse)
def delete_me(
    req: GuestKontoLoeschenRequest,
    ctx: CurrentGuest,
    service: GuestAuthServiceDep,
) -> GuestKontoLoeschenResponse:
    """Eigenes Gast-Konto löschen (Apple 5.1.1(v), Google Play).

    Mit Passwort-Rückfrage: ein gekapertes Token allein darf kein Konto
    vernichten (Wurzel 7). Bereits getätigte Buchungen bleiben beim Gastgeber —
    die Antwort sagt das ausdrücklich.
    """
    try:
        return service.konto_loeschen(ctx, req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Anmeldung per Einmal-Code (Airbnb-Muster, 19.08.2026) ------------------
#
# Alle drei Routen liegen im STRENGEN auth-Bucket (ratelimit_middleware:
# `/guest-auth/code` als Teilstring): die erste schickt Mail an ein fremdes
# Postfach, die zweite prüft ein Geheimnis.


@router.post("/code", response_model=GuestCodeAntwort)
def code_anfordern(
    req: GuestCodeAnfrageRequest, service: GuestCodeServiceDep
) -> GuestCodeAntwort:
    """Schritt 1: Einmal-Code an die Adresse schicken.

    Antwortet IMMER gleich — ob die Adresse ein Konto hat, verrät diese Route
    nicht (Kontenaufzählung). Public: der Gast hat noch kein Token.
    """
    try:
        return service.code_anfordern(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/code/verify", response_model=GuestSessionResponse)
def code_pruefen(
    req: GuestCodePruefenRequest, service: GuestCodeServiceDep
) -> GuestSessionResponse:
    """Schritt 2: Code → Session. `profil_fehlt=true` heißt: Name fehlt noch."""
    try:
        return service.code_pruefen(req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/code/profil", response_model=GuestProfileResponse)
def profil_anlegen(
    req: GuestProfilAnlegenRequest,
    ctx: CurrentGuest,
    service: GuestCodeServiceDep,
) -> GuestProfileResponse:
    """Schritt 3 (nur bei Erstanmeldung): Name zum eigenen Konto nachtragen.

    Verlangt das Gast-Token aus Schritt 2 und schreibt ausschließlich die eigene
    Zeile (guest_id aus dem Token, Wurzel 3/9) — es gibt keine id im Pfad.
    """
    try:
        return service.profil_anlegen(ctx, req)
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Ausweisprüfung des Gastes (Stripe Identity, 0718) ----------------------
#
# WOZU. Ein Gastgeber kann seine Sofortbuchung auf Gäste mit geprüfter
# Identität beschränken (Airbnbs `guests_with_verified_identity`). Ohne diesen
# Weg wäre das eine Voraussetzung, die kein Gast erfüllen könnte — er bekäme
# nur noch Anfragen statt Sofortbuchungen und erführe nie, warum.
#
# Es werden KEINE Ausweisdaten gespeichert, nur der Status (DSGVO/DE) — genau
# wie bei den Gastgebern. Das Ergebnis kommt ASYNCHRON per Webhook; aus der
# Rückleitung darf nichts abgeleitet werden.


@router.post("/identity/verification-session", response_model=GuestIdentityResponse)
def identitaet_starten(
    req: GuestIdentityStartRequest,
    ctx: CurrentGuest,
    service: GuestAuthServiceDep,
    identity: GuestIdentityServiceDep,
) -> GuestIdentityResponse:
    """Ausweisprüfung starten und die Hosted-URL von Stripe zurückgeben."""
    try:
        profil = service.get_profile(ctx)
        url = identity.create_guest_verification_session(
            # Die Kennung kommt aus dem Token, NIE aus dem Aufruf (Wurzel 3).
            portal_guest_id=ctx.guest_id,
            email=str(profil.email),
            return_url=req.return_url,
        )
    except GuestAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return GuestIdentityResponse(url=url)


@router.post("/identity/sync", response_model=GuestIdentityStatusResponse)
def identitaet_abgleichen(
    ctx: CurrentGuest, identity: GuestIdentityServiceDep
) -> GuestIdentityStatusResponse:
    """Den Stand LIVE bei Stripe holen.

    Der Normalweg bleibt der Webhook. Dieser hier ist der Weg zurück, wenn er
    ausbleibt — ohne ihn stünde „Wird geprüft …" für immer da (17.09.2026).
    """
    try:
        stand = identity.sync_guest_verification_status(portal_guest_id=ctx.guest_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return GuestIdentityStatusResponse(identity_status=stand)
