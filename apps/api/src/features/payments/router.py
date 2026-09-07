"""Router für payments. Gemountet unter /api/v1/payments.

- Connect (Custom, white-label): Account anlegen/aktualisieren, KYC-Status, IBAN.
  Tenant-geschützt (Admin/Billing).
- Gast-Zahlung: ``POST /payments/booking/{reservation_id}/intent`` (public — Gäste
  zahlen ohne Login; Tenant serverseitig aus der Reservierung).
- Kaution/Refund: tenant-geschützt (MANAGE_BILLING).
- Webhook (kein JWT, via Stripe-Signatur): account.updated + payment_intent.*/charge.refunded.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from src.core.config import get_settings
from src.core.countries import is_iso2_country
from src.core.logging import get_logger
from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_granular_permission,
    require_permission,
)
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import Capability

from .identity import IdentityService
from .nachberechnung import NachberechnungService
from .paypal_webhook import handle_paypal_event
from .schemas import (
    BookingPaymentResult,
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    ConnectAccountUpdate,
    DepositCaptureRequest,
    ExternalAccountRequest,
    IdentityVerificationRequest,
    IdentityVerificationResponse,
    NachberechnungBezahlt,
    NachberechnungCreate,
    NachberechnungLink,
    NachberechnungRefund,
    NachberechnungStatus,
    PaymentsDiagnostics,
    PaymentSettings,
    PaymentSettingsResponse,
    PayPalOnboardingRequest,
    PayPalOnboardingResponse,
    PayPalOrderResponse,
    PlatformFeeSummary,
    RefundRequest,
    SliceHealth,
)
from .service import PaymentsError, PaymentsService
from .webhook import handle_stripe_event

router = APIRouter(prefix="/payments", tags=["payments"])
log = get_logger("nextdays.payments")


def get_payments_service() -> PaymentsService:
    return PaymentsService(service_client=get_service_client())


PaymentsServiceDep = Annotated[PaymentsService, Depends(get_payments_service)]
_billing = Annotated[AuthContext, Depends(require_permission(Capability.MANAGE_BILLING))]

# Identitätsprüfung ist eine PERSÖNLICHE Aktion: jeder eingeloggte Nutzer
# verifiziert nur sich selbst (user_id aus dem Token) — daher get_current_user
# (Authentifizierung), keine Finanz-Capability.
_user = Annotated[AuthContext, Depends(get_current_user)]


def get_identity_service() -> IdentityService:
    return IdentityService(service_client=get_service_client())


IdentityServiceDep = Annotated[IdentityService, Depends(get_identity_service)]


def get_nachberechnung_service() -> NachberechnungService:
    return NachberechnungService(service_client=get_service_client())


NachberechnungServiceDep = Annotated[
    NachberechnungService, Depends(get_nachberechnung_service)
]
# Wer den Zeitraum einer Buchung ändern darf, muss die Folge auch kassieren
# können — die Nachberechnung ist der Gegenwert zur Verlängerung. Deshalb
# MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS und NICHT die Finanz-Capability
# MANAGE_BILLING: Betriebsfinanzen (Saldo, Auszahlungen) werden hier nicht
# sichtbar, und die Rezeption soll den Link schicken können, ohne Einblick in
# die Abrechnung des Betriebs zu bekommen (§4.3).
_kalender = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
]
_kalender_schreiben = Depends(
    require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS)
)


@router.get("/health", response_model=SliceHealth)
def health(service: PaymentsServiceDep) -> SliceHealth:
    return service.health()


@router.get("/diagnostics", response_model=PaymentsDiagnostics)
def diagnostics(
    service: PaymentsServiceDep, ctx: _billing
) -> PaymentsDiagnostics:
    """Sichtbares System-/Stripe-Debugging: Redis/DB/Stripe-Erreichbarkeit +
    roher Stripe-Connect-Status (was Stripe wirklich verlangt)."""
    try:
        return service.diagnostics(ctx)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Zahlungs-Einstellungen (Tab „Zahlungen") --------------------------------

@router.get("/settings", response_model=PaymentSettingsResponse)
def get_payment_settings(
    service: PaymentsServiceDep, ctx: _billing
) -> PaymentSettingsResponse:
    """Zahlungs-Einstellungen des Tenants + abgeleiteter Stripe-Status."""
    try:
        return service.get_payment_settings(ctx)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/platform-fees", response_model=PlatformFeeSummary)
def platform_fees(
    service: PaymentsServiceDep, ctx: _billing
) -> PlatformFeeSummary:
    """Plattform-Provisionen (8 %, 0182) des Marktplatz-Gastgebers: fällige/
    eingezogene/zurückgegebene Fees je Buchung. Nur eigener Tenant (Wurzel 3/9)."""
    try:
        return service.platform_fee_summary(ctx)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/settings", response_model=PaymentSettingsResponse)
def update_payment_settings(
    req: PaymentSettings, service: PaymentsServiceDep, ctx: _billing
) -> PaymentSettingsResponse:
    """Zahlungs-Einstellungen speichern (nur die Zahlungs-Spalten, Whitelist)."""
    try:
        return service.update_payment_settings(ctx, req)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Stripe Connect (Custom, white-label) -------------------------------------

@router.get("/connect/account")
def get_own_connect_account(
    service: PaymentsServiceDep, ctx: _billing
) -> dict:
    """Die stripe_account_id des eigenen Tenants (Dashboard-Banner). Über den
    Server, da tenant_billing_profile am anon-Direktpfad gesperrt ist (0169)."""
    try:
        return {"stripe_account_id": service.get_own_connect_account_id(ctx)}
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/connect/country-requirements/{country}")
def get_country_requirements(
    country: str, service: PaymentsServiceDep, ctx: _billing  # noqa: ARG001
) -> dict:
    """Welche KYC-Felder Stripe fuer dieses Land verlangt — getrennt nach
    Einzelperson und Firma, LIVE aus den country_specs (kein Hardcode).

    Die Gastgeber-Oberflaeche zeigt daraus, ob eine persoenliche Kennnummer
    (individual.id_number) noetig ist: in ES/IT/PT/SE u. a. bleibt der Account
    ohne sie fuer immer „restricted", und in den Stammdaten gibt es dafuer
    kein Feld. Ein Land, das keine ISO-Kennung ist, ist ein Datenfehler (422),
    kein Anlass, stillschweigend ein anderes zu nehmen (Wurzel 4)."""
    if not is_iso2_country(country):
        raise HTTPException(status_code=422, detail="Land wird nicht unterstützt.")
    try:
        return service.country_requirements(country)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/connect/accounts", response_model=ConnectAccountResponse)
def create_connect_account(
    req: ConnectAccountCreate, service: PaymentsServiceDep, ctx: _billing
) -> ConnectAccountResponse:
    """Custom-Account für den Gastgeber anlegen (kein Stripe-Branding). Die KYC-
    Erfassung läuft danach über die eigene UI (update/external-account)."""
    try:
        # tenant_id AUSSCHLIESSLICH aus dem Token (Wurzel 3), nie aus dem Body.
        return service.create_connect_account(ctx.tenant_id, req)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/connect/accounts/{stripe_account_id}", response_model=ConnectAccountStatus)
def get_connect_account_status(
    stripe_account_id: str, service: PaymentsServiceDep, ctx: _billing
) -> ConnectAccountStatus:
    """KYC-/Aktivierungsstatus + offene Requirements (für die eigene Onboarding-UI)."""
    try:
        return service.get_connect_account_status(ctx.tenant_id, stripe_account_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/identity/verification-session", response_model=IdentityVerificationResponse
)
def start_identity_verification(
    req: IdentityVerificationRequest,
    service: IdentityServiceDep,
    ctx: _user,
) -> IdentityVerificationResponse:
    """Startet die Ausweis-/Selfie-Verifizierung (Stripe Identity, Hosted
    Redirect) und gibt die URL zurück. Nutzer/Tenant AUSSCHLIESSLICH aus dem
    Token (Wurzel 3). Ergebnis kommt asynchron per Webhook."""
    if not ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Kein Tenant.")
    try:
        url = service.create_verification_session(
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            email=None,
            return_url=req.return_url,
        )
        return IdentityVerificationResponse(url=url)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/connect/accounts/{stripe_account_id}", response_model=ConnectAccountStatus)
def update_connect_account(
    stripe_account_id: str,
    req: ConnectAccountUpdate,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Geschäfts-/Inhaberdaten an den Custom-Account senden (eigene UI)."""
    try:
        return service.update_connect_account(ctx.tenant_id, stripe_account_id, req.fields)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/connect/accounts/{stripe_account_id}/accept-tos",
    response_model=ConnectAccountStatus,
)
def accept_tos(
    stripe_account_id: str,
    request: Request,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Stripe-Services-Vereinbarung akzeptieren — mit der ECHTEN Nutzer-IP
    (Compliance-Nachweis). Schließt das KYC ab, sodass der Account aktiviert
    werden kann."""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else ""
    )
    try:
        return service.accept_tos(
            ctx.tenant_id, stripe_account_id, ip=ip,
            when=int(datetime.now(UTC).timestamp()),
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/connect/accounts/{stripe_account_id}/bank", response_model=ConnectAccountStatus)
def set_external_account(
    stripe_account_id: str,
    req: ExternalAccountRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> ConnectAccountStatus:
    """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
    try:
        return service.set_external_account(
            ctx.tenant_id,
            stripe_account_id,
            iban=req.iban,
            account_holder=req.account_holder,
            country=req.country,
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Gast-Zahlung (public — Gäste zahlen ohne Login) --------------------------

@router.post("/booking/{reservation_id}/intent", response_model=BookingPaymentResult)
def create_booking_intent(
    reservation_id: str, service: PaymentsServiceDep
) -> BookingPaymentResult:
    """PaymentIntent für eine Gastbuchung — Tenant kommt aus der Reservierung.

    Nutzt den konditionsgesteuerten Pfad: gilt für die Buchung ein Zahlungsplan
    mit Anzahlung, wird nur diese kassiert, die Karte für die Restzahlung
    gespeichert und die 'balance'-Zeile mit Fälligkeit geplant (der Worker
    bucht sie später ab). Ohne Zahlungsplan delegiert die Methode an den
    bisherigen Vollzahlungs-Pfad — für diese Buchungen ändert sich nichts.
    Zuvor war dieser Einstieg nirgends verdrahtet, sodass Zahlungspläne trotz
    vorhandener Konditionen nie griffen.
    """
    try:
        return service.create_booking_payment_scheduled(
            reservation_id=reservation_id
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Kaution (tenant-geschützt) -----------------------------------------------

@router.post("/deposit/{reservation_id}/hold")
def create_deposit_hold(
    reservation_id: str, service: PaymentsServiceDep, ctx: _billing
) -> dict:
    """Kaution vorautorisieren (manual-capture PaymentIntent)."""
    try:
        return service.create_deposit_hold(ctx, reservation_id=reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/deposit/{payment_id}/capture")
def capture_deposit(
    payment_id: str,
    req: DepositCaptureRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> dict:
    """Kaution (teilweise) einziehen — bei Schaden."""
    try:
        return service.capture_deposit(ctx, payment_id, req.amount)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/deposit/{payment_id}/release")
def release_deposit(
    payment_id: str, service: PaymentsServiceDep, ctx: _billing
) -> dict:
    """Kaution freigeben (Vorautorisierung stornieren)."""
    try:
        return service.release_deposit(ctx, payment_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Refund (tenant-geschützt) ------------------------------------------------

@router.post("/{payment_id}/refund")
def refund_payment(
    payment_id: str,
    req: RefundRequest,
    service: PaymentsServiceDep,
    ctx: _billing,
) -> dict:
    """Zahlung (teilweise) erstatten."""
    try:
        return service.refund_payment(ctx, payment_id, req.amount)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# --- Stripe Webhook (kein JWT — via Stripe-Signatur gesichert) ----------------

# --- Nachberechnung einer Website-Buchung (0469) ------------------------------
#
# Ein Aufenthalt wird nachträglich teurer (manuelle Verlängerung, Zusatzgast,
# Schaden) und der Gast soll die Differenz per Karte zahlen. Der Charge läuft im
# verbundenen Konto des Betriebs und ist provisionsfrei (0380). Nur für
# `channel='website'` — bei OTA-Buchungen kassiert das Portal, bei `direct` ist
# der Zahlweg außerhalb des Systems vereinbart.

@router.get(
    "/reservations/{reservation_id}/nachberechnung",
    response_model=NachberechnungStatus,
)
def nachberechnung_lesen(
    reservation_id: str,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungStatus:
    """Stand der Nachberechnung: offener Betrag, Vorschlag, offener Link.

    Ein Aufruf statt dreier, damit die Oberfläche den Knopf nicht aus mehreren
    Quellen zusammenrät. Gleicht dabei mit Stripe ab, ob ein offener Link
    inzwischen bezahlt wurde (Netz unter dem Webhook)."""
    try:
        return service.lesen(ctx, reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung",
    response_model=NachberechnungLink,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_erstellen(
    reservation_id: str,
    req: NachberechnungCreate,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungLink:
    """Zahlungslink über eine Nachberechnung erstellen.

    Idempotent: ein offener Link mit demselben Betrag und Grund wird
    zurückgegeben, statt einen zweiten zu erzeugen."""
    try:
        return service.erstellen(ctx, reservation_id, req)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung/senden",
    response_model=NachberechnungLink,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_senden(
    reservation_id: str,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungLink:
    """Den offenen Zahlungslink per E-Mail an den Gast schicken (in seiner
    Sprache, Marke myBestDays)."""
    try:
        return service.senden(ctx, reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung/bezahlt",
    response_model=NachberechnungLink,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_als_bezahlt(
    reservation_id: str,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungLink:
    """Den offenen Zahlungslink als bezahlt markieren (Gast hat bar/überwiesen).

    Schließt den Link ZUERST bei Stripe, damit keine bezahlbare URL mit
    demselben Betrag im Umlauf bleibt."""
    try:
        return service.als_bezahlt_markieren(ctx, reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung/erfasst",
    response_model=NachberechnungLink,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_bezahlt_erfassen(
    reservation_id: str,
    req: NachberechnungCreate,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungLink:
    """Eine bereits bezahlte Nachberechnung erfassen — ohne Zahlungslink.

    Für den Fall, dass der Gast an der Rezeption gezahlt hat: dieselben
    Schranken wie beim Link (Kanal, Währung, Betrag ≤ offen)."""
    try:
        return service.bezahlt_erfassen(ctx, reservation_id, req)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung/{link_id}/offen",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_bezahlt_zuruecknehmen(
    reservation_id: str,
    link_id: str,
    req: NachberechnungBezahlt,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> None:
    """Eine fälschlich gesetzte Bezahlt-Markierung zurücknehmen (Grund Pflicht).

    Nur bei manuellen Markierungen — eine über Stripe eingegangene Zahlung wird
    erstattet, nicht umgedeutet."""
    try:
        service.bezahlt_zuruecknehmen(ctx, reservation_id, link_id, req.grund)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/reservations/{reservation_id}/nachberechnung/{link_id}/erstatten",
    response_model=NachberechnungLink,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_erstatten(
    reservation_id: str,
    link_id: str,
    req: NachberechnungRefund,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> NachberechnungLink:
    """Eine per Karte bezahlte Nachberechnung erstatten (0473, Grund Pflicht).

    Der Gast bekommt 100 % zurück, die Erstattung läuft im verbundenen Konto.
    Der Zahlungsbeleg bleibt stehen und bekommt eine Erstattungszeile daneben —
    anders als bei der Rücknahme einer manuellen Markierung, wo es keinen
    Geldfluss gab und der Beleg entfernt wird.

    409 bei einer manuell erfassten Zahlung (dann Rücknahme statt Erstattung),
    bei einer nicht bezahlten Nachberechnung und bei festgeschriebener Rechnung
    (GoBD → Stornorechnung)."""
    try:
        return service.erstatten(ctx, reservation_id, link_id, req.grund)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/reservations/{reservation_id}/nachberechnung",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[_kalender_schreiben],
)
def nachberechnung_zurueckziehen(
    reservation_id: str,
    service: NachberechnungServiceDep,
    ctx: _kalender,
) -> None:
    """Offenen Zahlungslink zurückziehen (bei Stripe deaktivieren)."""
    try:
        service.zurueckziehen(ctx, reservation_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
) -> dict[str, str]:
    """Empfängt Stripe-Webhook-Events (signaturgeprüft) und verarbeitet relevante
    Events: ``account.updated`` (KYC-Spiegel) + ``payment_intent.*`` /
    ``charge.refunded`` (Zahlstatus). Idempotent über die Event-ID."""
    import stripe  # noqa: PLC0415

    payload = await request.body()
    einstellungen = get_settings()
    # ZWEI Endpunkte, zwei Secrets (0473): der Konto-Endpunkt (unsere eigenen
    # Events) und der CONNECT-Endpunkt (Events aus den verbundenen Konten der
    # Betriebe — u. a. `checkout.session.completed`, der Zahlungseingang einer
    # Zusatzleistung). Stripe stellt je Endpunkt ein eigenes Signing-Secret aus,
    # beide zeigen aber auf DIESE Route. Deshalb wird gegen jedes konfigurierte
    # Secret geprüft und das erste akzeptiert.
    #
    # Bewusst NICHT über getrennte Routen gelöst: Der Handler ist derselbe, und
    # eine zweite Route hätte bedeutet, dass jeder neue Event-Typ an zwei Stellen
    # eingetragen werden muss — genau die Art Doppelpflege, an der
    # `checkout.session.completed` schon einmal verloren gegangen ist.
    secrets = [
        s
        for s in (
            einstellungen.stripe_webhook_secret.get_secret_value(),
            einstellungen.stripe_connect_webhook_secret.get_secret_value(),
        )
        if s
    ]

    if not secrets:
        log.warning("stripe_webhook_secret_not_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe Webhook Secret nicht konfiguriert.",
        )
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fehlender Stripe-Signature Header.",
        )

    event = None
    letzter_fehler: Exception | None = None
    for secret in secrets:
        try:
            event = stripe.Webhook.construct_event(
                payload=payload, sig_header=stripe_signature, secret=secret
            )
            break
        except stripe.SignatureVerificationError as exc:
            letzter_fehler = exc
    if event is None:
        # Fail-closed (Wurzel 5): Passt zu KEINEM Secret, wird nichts verarbeitet.
        log.warning(
            "stripe_webhook_invalid_signature",
            error=str(letzter_fehler),
            geprueft=len(secrets),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Stripe-Signatur.",
        ) from letzter_fehler

    db = get_service_client()
    handle_stripe_event(db, event, now_iso=datetime.now(UTC).isoformat())
    return {"received": "ok"}


# --- PayPal (Multiparty) ------------------------------------------------------

@router.post("/paypal/onboarding", response_model=PayPalOnboardingResponse)
def paypal_onboarding(
    req: PayPalOnboardingRequest, service: PaymentsServiceDep, ctx: _billing
) -> PayPalOnboardingResponse:
    """PayPal-Onboarding starten → action_url, zu der der Betrieb umgeleitet wird,
    um sein eigenes PayPal-Geschäftskonto zu verbinden."""
    try:
        result = service.start_paypal_onboarding(ctx, return_url=req.return_url)
        return PayPalOnboardingResponse(action_url=result["action_url"])
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/paypal/status")
def paypal_status_sync(service: PaymentsServiceDep, ctx: _billing) -> dict:
    """Onboarding-Status des eigenen Tenants bei PayPal nachladen (nach Rückkehr
    vom Onboarding). Synct receivable/email_confirmed."""
    try:
        return service.sync_own_paypal_status(ctx)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/paypal/onboarding/return", include_in_schema=False)
def paypal_onboarding_return(
    service: PaymentsServiceDep,
    # PayPal hängt diese Query-Namen an (kein snake_case) → über alias abbilden.
    merchant_id: str | None = Query(default=None, alias="merchantIdInPayPal"),
    tracking_id: str | None = None,
) -> dict:
    """Return-Ziel nach dem PayPal-Onboarding. PayPal hängt merchantIdInPayPal +
    tracking_id an. Die Return-Parameter sind NICHT vertrauenswürdig (Wurzel 3):
    Der Sync geht über sync_paypal_from_return, das den tracking_id gegen ein
    tatsächlich laufendes Onboarding scoped (sonst könnte ein Fremder eine
    Angreifer-merchant_id an einen fremden Tenant binden → Payout-Umleitung)."""
    if not tracking_id or not merchant_id:
        raise HTTPException(status_code=400, detail="Unvollständige PayPal-Rückkehr.")
    try:
        service.sync_paypal_from_return(tracking_id=tracking_id, merchant_id=merchant_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"status": "ok"}


@router.post("/paypal/booking/{reservation_id}/order", response_model=PayPalOrderResponse)
def create_paypal_order(
    reservation_id: str, service: PaymentsServiceDep
) -> PayPalOrderResponse:
    """PayPal-Order für eine Gastbuchung anlegen (public — Gäste zahlen ohne Login).
    merchant_id/Tenant kommen aus der Reservierung."""
    try:
        result = service.create_paypal_order(reservation_id=reservation_id)
        return PayPalOrderResponse(
            order_id=result["order_id"], payment_id=result["payment_id"]
        )
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/paypal/order/{order_id}/capture")
def capture_paypal_order(order_id: str, service: PaymentsServiceDep) -> dict:
    """Approved PayPal-Order capturen (public — nach onApprove im Gast-Checkout)."""
    try:
        return service.capture_paypal_order(order_id=order_id)
    except PaymentsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/paypal/webhook", include_in_schema=False)
async def paypal_webhook(request: Request) -> dict[str, str]:
    """PayPal-Webhook (kein JWT — über die Signatur gesichert). Fail-closed:
    fehlt die Webhook-Config oder ist die Signatur ungültig → nicht verarbeiten.
    Idempotent über die transmission_id."""
    from .paypal_client import PayPalClient  # noqa: PLC0415

    raw = (await request.body()).decode()
    headers = {k.lower(): v for k, v in request.headers.items()}
    client = PayPalClient()
    if not client.verify_webhook(headers=headers, raw_body=raw):
        # Signatur nicht verifizierbar/ungültig → fail-closed (Wurzel 5).
        raise HTTPException(status_code=400, detail="Ungültige PayPal-Signatur.")
    import json  # noqa: PLC0415

    event = json.loads(raw)
    event["_transmission_id"] = headers.get("paypal-transmission-id")
    db = get_service_client()
    handle_paypal_event(db, event, now_iso=datetime.now(UTC).isoformat())
    return {"received": "ok"}
