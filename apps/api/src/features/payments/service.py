"""Service-Schicht für payments — Stripe Connect (Custom/white-label) + Zahlungen.

Geldfluss = Destination Charge: der Gast zahlt über den Plattform-Stripe-Account,
das Geld geht per ``transfer_data.destination`` an den Connected Account des
Tenants (``tenant_billing_profile.stripe_account_id``). Voraussetzung:
``stripe_charges_enabled = true`` — sonst ist Online-Zahlung nicht verfügbar
(klarer Fehler, kein Fallback-Charge auf die Plattform).

Connect ist voll white-label (Custom Accounts): kein Stripe-gehostetes Onboarding/
Branding — die KYC-Daten kommen über die eigene Dashboard-UI und werden per
``Account.update`` / ``external_account`` an Stripe gegeben.

Tenant-scoping: ``_require(ctx)`` erzwingt tenant_id + DB. Beträge gehen in Cent
an Stripe (``int(round(amount * 100))``).
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any

from stripe import StripeClient
from stripe import StripeError as _StripeError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from . import stripe_client as sc
from .schemas import (
    BookingPaymentResult,
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    CountryRequirements,
    DiagnosticCheck,
    PaymentsDiagnostics,
    SliceHealth,
    StripeAccountDiagnostics,
)
from .stripe_client import StripeNotConfiguredError, get_stripe

log = get_logger("nextdays.payments")


class PaymentsError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@contextmanager
def _stripe_errors():  # noqa: ANN202
    """Übersetzt Stripe-SDK-Fehler in saubere PaymentsError, damit sie als
    verständliche HTTP-Antwort beim Nutzer ankommen — nicht als ungefangener
    500-Stacktrace. Stripe liefert bei Eingabefehlern (z.B. ungültige PLZ) eine
    nutzerlesbare ``user_message``/``message``; die wird 1:1 durchgereicht
    (kein erfundener Text). InvalidRequest → 400 (Nutzer-/Datenfehler), alle
    anderen Stripe-Fehler → 502 (Upstream)."""
    try:
        yield
    except _StripeError as exc:
        msg = getattr(exc, "user_message", None) or str(exc) or "Stripe-Fehler."
        # Stripes HTTP-Status entscheidet: 4xx = Eingabe-/Datenfehler des
        # Nutzers (z.B. ungültige PLZ) → 1:1 als 400 weiterreichen; sonst ist es
        # ein Upstream-/Serverproblem → 502.
        http_status = getattr(exc, "http_status", None)
        code = 400 if isinstance(http_status, int) and 400 <= http_status < 500 else 502
        raise PaymentsError(msg, status_code=code) from exc


def _to_cents(amount: float) -> int:
    """Betrag in Cent (Stripe rechnet in der kleinsten Einheit)."""
    return int(round(amount * 100))


class PaymentsService:
    slice_name = "payments"

    def __init__(
        self,
        service_client: Client | None = None,
        stripe: StripeClient | None = None,  # injizierbar für Tests
    ) -> None:
        self._db = service_client
        # Lazy: der StripeClient wird erst beim ersten echten Stripe-Zugriff
        # gebaut (über die ``_stripe``-Property). So scheitert nicht schon die
        # Service-Instanziierung — bei jedem payments-Request — wenn der Key
        # fehlt; stattdessen wirft erst der konkrete Aufruf einen sauberen,
        # verständlichen Fehler (503). Ein injizierter Client (Tests) wird direkt
        # übernommen.
        self._injected_stripe = stripe

    @property
    def _stripe(self) -> StripeClient:
        """StripeClient — injiziert (Test) oder lazy aus der Config. Fehlt der
        Key, wird StripeNotConfiguredError in einen klaren PaymentsError (503)
        übersetzt, damit das Frontend „Stripe nicht konfiguriert" sieht statt
        eines kryptischen Auth-Fehlers."""
        if self._injected_stripe is not None:
            return self._injected_stripe
        try:
            return get_stripe()
        except StripeNotConfiguredError as exc:
            raise PaymentsError(str(exc), status_code=503) from exc

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def country_requirements(self, country: str) -> dict[str, Any]:
        """Pflicht-/Zusatzfelder pro Land LIVE aus Stripe (GET /country_specs) —
        kein Hardcode. Getrennt nach business_type (individual/company) und
        minimum/additional. Quelle der Wahrheit für „welche KYC-Felder sammeln"."""
        with _stripe_errors():
            spec = self._stripe.v1.country_specs.retrieve(country.upper())
        vf = getattr(spec, "verification_fields", None) or {}

        def _fields(entity: str) -> dict[str, list[str]]:
            block = vf.get(entity) if isinstance(vf, dict) else getattr(vf, entity, None)
            if block is None:
                return {"minimum": [], "additional": []}
            get = block.get if isinstance(block, dict) else lambda k: getattr(block, k, None)
            return {
                "minimum": list(get("minimum") or []),
                "additional": list(get("additional") or []),
            }

        return {
            "country": country.upper(),
            "individual": _fields("individual"),
            "company": _fields("company"),
        }

    def diagnostics(self, ctx: AuthContext) -> PaymentsDiagnostics:
        """Sichtbares System-/Stripe-Debugging: pingt Redis, DB und Stripe und
        liest den ROHEN Stripe-Connect-Status dieses Tenants (was Stripe wirklich
        verlangt). Jeder Check ist Klartext (kein roher Code) — damit sofort
        sichtbar ist, WAS klemmt (z. B. Redis-Timeout → 503 auf accept-tos)."""
        import time as _time

        checks: list[DiagnosticCheck] = []

        # 1) Redis (Rate-Limiter/Job-Queue). Timeout kurz halten (wie Limiter).
        t0 = _time.perf_counter()
        try:
            import redis as _redis  # sync-Client nur für den Diagnose-Ping

            settings = get_settings()
            client = _redis.from_url(
                settings.redis_url, socket_timeout=1.0, socket_connect_timeout=1.0
            )
            client.ping()
            client.close()
            checks.append(DiagnosticCheck(
                name="Redis", ok=True, detail="erreichbar (ping ok)",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))
        except Exception as exc:  # noqa: BLE001 - Diagnose darf nie werfen
            checks.append(DiagnosticCheck(
                name="Redis", ok=False,
                detail=f"NICHT erreichbar: {exc} — Rate-Limiter sperrt fail-closed (503).",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))

        # 2) Datenbank (Supabase/Kong).
        t0 = _time.perf_counter()
        try:
            db = self._db_or_fail()
            db.table("tenant_billing_profile").select("tenant_id").limit(1).execute()
            checks.append(DiagnosticCheck(
                name="Datenbank", ok=True, detail="erreichbar",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))
        except Exception as exc:  # noqa: BLE001
            checks.append(DiagnosticCheck(
                name="Datenbank", ok=False, detail=f"NICHT erreichbar: {exc}",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))

        # 3) Stripe erreichbar + konfiguriert.
        t0 = _time.perf_counter()
        try:
            self._stripe.v1.accounts.list(params={"limit": 1})
            checks.append(DiagnosticCheck(
                name="Stripe", ok=True, detail="erreichbar (API-Key gültig)",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))
        except Exception as exc:  # noqa: BLE001
            checks.append(DiagnosticCheck(
                name="Stripe", ok=False, detail=f"Problem: {exc}",
                duration_ms=int((_time.perf_counter() - t0) * 1000),
            ))

        # 4) Roher Stripe-Connect-Status dieses Tenants (was fehlt WIRKLICH?).
        stripe_acct: StripeAccountDiagnostics | None = None
        account_country: str | None = None
        try:
            db, tenant_id = self._require(ctx)
            row = (
                db.table("tenant_billing_profile")
                .select("stripe_account_id")
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            acct_id = row[0].get("stripe_account_id") if row else None
            if acct_id:
                account = self._stripe.v1.accounts.retrieve(acct_id)
                account_country = getattr(account, "country", None)
                req = account.requirements
                stripe_acct = StripeAccountDiagnostics(
                    account_id=account.id,
                    charges_enabled=bool(account.charges_enabled),
                    payouts_enabled=bool(account.payouts_enabled),
                    details_submitted=bool(account.details_submitted),
                    disabled_reason=req.disabled_reason,
                    currently_due=list(req.currently_due or []),
                    past_due=list(req.past_due or []),
                    eventually_due=list(req.eventually_due or []),
                    pending_verification=list(req.pending_verification or []),
                    errors=[
                        f"{e.get('requirement')}: {e.get('reason')}"
                        for e in (req.errors or [])
                    ],
                )
        except Exception as exc:  # noqa: BLE001 - Diagnose robust halten
            stripe_acct = StripeAccountDiagnostics(errors=[f"Status nicht lesbar: {exc}"])

        # Pflichtfelder des Account-Landes live aus Stripe (kein Hardcode).
        country_req: CountryRequirements | None = None
        try:
            if account_country:
                cr = self.country_requirements(account_country)
                country_req = CountryRequirements(
                    country=cr["country"],
                    individual_minimum=cr["individual"]["minimum"],
                    individual_additional=cr["individual"]["additional"],
                    company_minimum=cr["company"]["minimum"],
                    company_additional=cr["company"]["additional"],
                )
        except Exception:  # noqa: BLE001 - Diagnose robust halten
            country_req = None

        return PaymentsDiagnostics(
            checks=checks, stripe_account=stripe_acct, country_requirements=country_req
        )

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise PaymentsError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise PaymentsError("Payments-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    def _db_or_fail(self) -> Client:
        """DB ohne Tenant-Pflicht (public Pfade: Gast-Zahlung über Reservierung)."""
        if self._db is None:
            raise PaymentsError("Payments-DB nicht verfügbar.", status_code=500)
        return self._db

    def _require_own_connect_account(
        self, tenant_id: str, stripe_account_id: str
    ) -> None:
        """Die stripe_account_id MUSS die im tenant_billing_profile dieses Tenants
        hinterlegte sein. Ohne diesen Abgleich könnte ein Admin/Co-Admin mit
        MANAGE_BILLING die acct_-ID EINES ANDEREN Tenants an die Stripe-Endpunkte
        geben (Auszahlungs-IBAN umleiten, KYC überschreiben, ToS akzeptieren, Status
        auslesen) — reines Cross-Tenant-IDOR mit direktem Geldabfluss. Die Rollen-
        Capability allein prüft NICHT die Account-Zugehörigkeit."""
        db = self._db_or_fail()
        row = (
            db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        own = row[0].get("stripe_account_id") if row else None
        if not own or own != stripe_account_id:
            # 404 (nicht 403) — die Existenz eines fremden Accounts nicht bestätigen.
            raise PaymentsError("Konto nicht gefunden.", status_code=404)

    # --- Stripe Connect (Custom, voll white-label) --------------------------

    def create_connect_account(
        self, tenant_id: str, req: ConnectAccountCreate
    ) -> ConnectAccountResponse:
        """Legt einen Stripe **Custom** Account für den Gastgeber an (kein Express,
        kein Stripe-Branding). Die KYC-Erfassung läuft anschließend über die eigene
        Dashboard-UI (``update_connect_account`` / ``set_external_account``).

        ``tos_acceptance.service_agreement='full'``: die Plattform (myNextDays)
        übernimmt die Stripe-Services-Vereinbarung gegenüber dem Connected Account
        — Voraussetzung für vollständiges White-Label bei Custom Accounts.
        """
        with _stripe_errors():
            account = self._stripe.v1.accounts.create(
                params={
                    "type": "custom",
                    "country": req.country,
                    "email": req.email,
                    # Einzelperson oder Firma — bestimmt die KYC-Pflichtfelder.
                    "business_type": req.business_type,
                    # Branchencode 7011 = Lodging/Unterkünfte (für Vermietung
                    # passend); sonst offenes Requirement → blockiert charges.
                    "business_profile": {"mcc": "7011"},
                    "capabilities": {
                        "card_payments": {"requested": True},
                        "transfers": {"requested": True},
                    },
                    "tos_acceptance": {"service_agreement": "full"},
                    "metadata": {"tenant_id": tenant_id},
                }
            )
        return ConnectAccountResponse(stripe_account_id=account.id)

    def get_connect_account_status(
        self, tenant_id: str, stripe_account_id: str
    ) -> ConnectAccountStatus:
        """Liest KYC-/Aktivierungsstatus + offene Requirements (für die eigene UI)."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        with _stripe_errors():
            account = self._stripe.v1.accounts.retrieve(stripe_account_id)
        requirements: list[str] = list(account.requirements.currently_due or [])
        return ConnectAccountStatus(
            stripe_account_id=account.id,
            charges_enabled=bool(account.charges_enabled),
            payouts_enabled=bool(account.payouts_enabled),
            details_submitted=bool(account.details_submitted),
            requirements=requirements,
            disabled_reason=account.requirements.disabled_reason,
        )

    def update_connect_account(
        self, tenant_id: str, stripe_account_id: str, fields: dict[str, Any]
    ) -> ConnectAccountStatus:
        """Geschäfts-/Inhaber-/Vertreterdaten an den Custom-Account senden
        (eigene Onboarding-UI statt Stripe-hosted). ``fields`` ist das von der UI
        zusammengestellte Stripe-Account-Update (business_profile, company,
        individual, …)."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        with _stripe_errors():
            self._stripe.v1.accounts.update(stripe_account_id, params=fields)
        return self.get_connect_account_status(tenant_id, stripe_account_id)

    def upsert_company_representative(
        self, tenant_id: str, stripe_account_id: str, person: dict[str, Any]
    ) -> None:
        """Legt für einen company/non_profit-Account die vertretungsberechtigte
        Person über die Persons-API an (Stripe verlangt das bei business_type!=
        individual — sie kann NICHT im Account-Update stecken). Idempotent: eine
        bestehende representative-Person wird aktualisiert statt dupliziert. Danach
        die *_provided-Flags setzen (keine weiteren Personen), damit Stripe nicht
        endlos directors/owners/executives nachfragt.

        `person` = {first_name, last_name, email, phone, dob, address,
        relationship:{representative, director, owner, title, percent_ownership}}.
        """
        self._require_own_connect_account(tenant_id, stripe_account_id)
        if not person:
            return
        with _stripe_errors():
            existing = self._stripe.v1.accounts.persons.list(
                stripe_account_id, params={"limit": 100}
            )
            rep_id: str | None = None
            for p in existing.data:
                rel = getattr(p, "relationship", None)
                if rel and getattr(rel, "representative", False):
                    rep_id = p.id
                    break
            if rep_id:
                self._stripe.v1.accounts.persons.update(
                    stripe_account_id, rep_id, params=person
                )
            else:
                self._stripe.v1.accounts.persons.create(
                    stripe_account_id, params=person
                )
            # Keine weiteren Personen vorhanden → attestieren (sonst bleibt
            # requirements offen). Die eine Person deckt representative/director/
            # owner in Personalunion ab (Ein-Personen-GmbH/UG).
            self._stripe.v1.accounts.update(
                stripe_account_id,
                params={
                    "company": {
                        "directors_provided": True,
                        "executives_provided": True,
                        "owners_provided": True,
                    }
                },
            )

    def accept_tos(
        self, tenant_id: str, stripe_account_id: str, *, ip: str, when: int
    ) -> ConnectAccountStatus:
        """Stripe-Services-Vereinbarung für den Connected Account akzeptieren.
        ``ip``/``when`` müssen die ECHTE Nutzer-IP + der Zeitpunkt der Zustimmung
        sein (Compliance-Nachweis) — nie geraten. Erst danach kann der Account
        ``charges_enabled`` werden."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        if not ip:
            raise PaymentsError("IP für die ToS-Akzeptanz fehlt.", status_code=422)
        with _stripe_errors():
            self._stripe.v1.accounts.update(
                stripe_account_id,
                params={"tos_acceptance": {"date": when, "ip": ip}},
            )
        return self.get_connect_account_status(tenant_id, stripe_account_id)

    def has_external_account(self, tenant_id: str, stripe_account_id: str) -> bool:
        """True, wenn am Connected Account bereits ein Auszahlungskonto (bank_account)
        hinterlegt ist. Für den idempotenten Update-Pfad: die IBAN nur dann senden,
        wenn noch KEINE existiert — sonst legt Stripe ein zweites externes Konto an
        (Grund, warum der Update-Pfad die Bank früher pauschal übersprang)."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        with _stripe_errors():
            account = self._stripe.v1.accounts.retrieve(stripe_account_id)
        ext = getattr(account, "external_accounts", None)
        data = getattr(ext, "data", None) if ext is not None else None
        return bool(data)

    def set_external_account(
        self, tenant_id: str, stripe_account_id: str, *,
        iban: str, account_holder: str, country: str,
    ) -> ConnectAccountStatus:
        """Auszahlungs-Bankkonto (IBAN) am Custom-Account hinterlegen."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        with _stripe_errors():
            self._stripe.v1.accounts.update(
                stripe_account_id,
                params={
                    "external_account": {
                        "object": "bank_account",
                        "country": country,
                        "currency": _currency_for_country(country),
                        "account_holder_name": account_holder,
                        "account_number": iban,
                    }
                },
            )
        return self.get_connect_account_status(tenant_id, stripe_account_id)

    # --- Gast-Zahlung (Stufe A) ---------------------------------------------

    def _load_reservation(self, db: Client, reservation_id: str) -> dict:
        res = (
            db.table("reservations")
            .select(
                "id, tenant_id, total_amount, currency, payment_status, "
                "channel, ota_name, source_channex_booking_id"
            )
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        return res[0]

    # OTA-Kanäle: der Gast zahlt direkt bei der OTA (Booking/Airbnb/Vrbo), die
    # OTA zahlt den Vermieter selbst aus. Für solche Buchungen darf KEINE Stripe-
    # Zahlung erzeugt werden (sonst doppelte Belastung). Eigene Kanäle (direct =
    # manuell erfasst, portal = eigene Buchungsstrecke) laufen über Stripe.
    _OTA_CHANNELS = frozenset({"booking", "airbnb", "vrbo"})

    def _require_own_channel(self, res: dict) -> None:
        """Stellt sicher, dass die Reservierung über einen EIGENEN Kanal kam —
        sonst keine Stripe-Zahlung (OTA hat den Gast bereits kassiert)."""
        channel = (res.get("channel") or "").lower()
        # source_channex_booking_id gesetzt = über Channex/OTA importiert →
        # zuverlässigster Indikator, auch für OTAs, die als 'portal' laufen.
        from_ota = (
            channel in self._OTA_CHANNELS
            or bool(res.get("source_channex_booking_id"))
        )
        if from_ota:
            name = res.get("ota_name") or channel or "OTA"
            raise PaymentsError(
                f"Diese Buchung kam über {name}. Die Zahlung wickelt {name} ab — "
                "über myNextDays ist hier keine Zahlung möglich.",
                status_code=409,
            )

    def _connected_account(self, db: Client, tenant_id: str) -> str:
        """Connected Account des Tenants — nur wenn er Zahlungen empfangen darf."""
        prof = (
            db.table("tenant_billing_profile")
            .select("stripe_account_id, stripe_charges_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        acct = prof[0]["stripe_account_id"] if prof else None
        enabled = bool(prof[0]["stripe_charges_enabled"]) if prof else False
        if not acct or not enabled:
            raise PaymentsError(
                "Online-Zahlung nicht verfügbar (Konto nicht freigeschaltet).",
                status_code=409,
            )
        return acct

    def _fee_cents(self, amount_cents: int) -> int:
        pct = get_settings().stripe_platform_fee_pct
        if pct <= 0:
            return 0
        # Ein Konfig-Tippfehler (z. B. 800 statt 8) darf keinen Charge erzeugen,
        # dessen application_fee den Buchungsbetrag übersteigt — Stripe lehnt das
        # ab und der GAST bekäme einen 500. Absurd hohe Sätze sind ein Konfig-
        # fehler → klar fehlschlagen (kein stiller Ersatzwert, Wurzel 4/5).
        if pct > 100:
            raise PaymentsError(
                "Provisions-Satz (STRIPE_PLATFORM_FEE_PCT) ist ungültig (>100 %).",
                status_code=500,
            )
        return int(round(amount_cents * pct / 100.0))

    def create_booking_payment(self, *, reservation_id: str) -> BookingPaymentResult:
        """PaymentIntent (Destination Charge) für eine Gastbuchung erzeugen und
        eine ``payments``-Row (pending) anlegen. Public-Pfad: Tenant kommt aus der
        Reservierung, nicht aus dem JWT (Gäste zahlen ohne Login)."""
        db = self._db_or_fail()
        res = self._load_reservation(db, reservation_id)
        # Kein Stripe für OTA-Buchungen — die OTA hat den Gast bereits kassiert.
        self._require_own_channel(res)
        tenant_id = res["tenant_id"]
        amount = float(res["total_amount"] or 0)
        if amount <= 0:
            raise PaymentsError("Buchungsbetrag fehlt.", status_code=422)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)

        # Idempotenz: existiert bereits ein offener (pending) PaymentIntent für
        # diese Buchung, den bestehenden wiederverwenden statt einen zweiten
        # anzulegen (der öffentliche Endpoint ist unauthentifiziert und wird bei
        # Doppelklick/Reload/Retry mehrfach getroffen → sonst mehrere Intents +
        # payments-Rows für dieselbe Buchung).
        reuse = self._reuse_pending_intent(db, reservation_id, "full")
        if reuse:
            return BookingPaymentResult(
                client_secret=reuse["client_secret"],
                payment_id=reuse["payment_id"],
                publishable_key=get_settings().stripe_publishable_key,
            )

        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(amount)
        with _stripe_errors():
            intent = sc.create_payment_intent(
                amount_cents=amount_cents,
                currency=currency,
                destination_acct=acct,
                application_fee_cents=self._fee_cents(amount_cents),
                metadata={"reservation_id": reservation_id, "tenant_id": tenant_id},
                client=self._stripe,
            )
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=amount,
            currency=currency,
            ptype="full",
            gateway_ref=intent["id"],
            status="pending",
        )
        self._set_reservation_payment_status(db, reservation_id, "pending")
        return BookingPaymentResult(
            client_secret=intent["client_secret"],
            payment_id=payment["id"],
            publishable_key=get_settings().stripe_publishable_key,
        )

    # --- Kaution (Stufe B) ---------------------------------------------------

    def create_deposit_hold(self, ctx: AuthContext, *, reservation_id: str) -> dict:
        """Manual-capture PaymentIntent über den Kautionsbetrag des Objekts
        (Vorautorisierung). Tenant-geschützt (Gastgeber löst die Kaution aus)."""
        db, tenant_id = self._require(ctx)
        res = self._load_reservation(db, reservation_id)
        if res["tenant_id"] != tenant_id:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        # Keine Stripe-Kaution für OTA-Buchungen — die OTA regelt Zahlung/Kaution.
        self._require_own_channel(res)
        amount = self._deposit_amount(db, reservation_id)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)
        # Idempotenz: offenen Kautions-Hold wiederverwenden statt eines zweiten
        # manual-capture-Intents (sonst blockiert ein Doppelklick/Retry zwei
        # Beträge auf der Gastkarte). Zentrale Prüfung (wie create_booking_payment).
        reuse = self._reuse_pending_intent(db, reservation_id, "deposit")
        if reuse:
            return {
                "client_secret": reuse["client_secret"],
                "payment_id": reuse["payment_id"],
                "publishable_key": get_settings().stripe_publishable_key,
            }
        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(amount)
        with _stripe_errors():
            intent = sc.create_payment_intent(
                amount_cents=amount_cents,
                currency=currency,
                destination_acct=acct,
                application_fee_cents=0,  # auf Kautionen keine Plattform-Fee
                capture_method="manual",
                metadata={"reservation_id": reservation_id, "type": "deposit"},
                client=self._stripe,
            )
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=amount,
            currency=currency,
            ptype="deposit",
            gateway_ref=intent["id"],
            status="pending",
        )
        return {
            "client_secret": intent["client_secret"],
            "payment_id": payment["id"],
            "publishable_key": get_settings().stripe_publishable_key,
        }

    def capture_deposit(
        self, ctx: AuthContext, payment_id: str, amount: float | None = None
    ) -> dict:
        """Kaution (teilweise) einziehen — bei Schaden."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id, expect_type="deposit")
        amount_cents = _to_cents(amount) if amount is not None else None
        with _stripe_errors():
            result = sc.capture_payment_intent(
                payment["gateway_ref"], amount_cents, client=self._stripe
            )
        self._update_payment(db, payment_id, {"status": "succeeded"})
        return {"payment_id": payment_id, "status": result["status"]}

    def release_deposit(self, ctx: AuthContext, payment_id: str) -> dict:
        """Kaution freigeben (Vorautorisierung stornieren) — kein Geldfluss."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id, expect_type="deposit")
        with _stripe_errors():
            result = sc.cancel_payment_intent(
                payment["gateway_ref"], client=self._stripe
            )
        self._update_payment(db, payment_id, {"status": "refunded"})
        return {"payment_id": payment_id, "status": result["status"]}

    # --- Refund (Stufe C) ----------------------------------------------------

    def refund_payment(
        self, ctx: AuthContext, payment_id: str, amount: float | None = None
    ) -> dict:
        """Zahlung (teilweise) erstatten. Schreibt eine ``refund``-Row und
        markiert die Ursprungszahlung als (teil-)erstattet."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id)
        full_amount = float(payment["amount"])
        # Idempotenz-/Doppelerstattungs-Guard: eine bereits voll erstattete Zahlung
        # darf nicht erneut erstattet werden. Bei Teilerstattungen gegen den REST-
        # betrag prüfen (Summe bereits erstatteter refund-Rows), nicht gegen den
        # vollen Betrag — sonst ließen sich per Doppelklick/Retry mehrere Teil-
        # erstattungen bis über den Ursprungsbetrag hinaus auslösen.
        if payment["status"] == "refunded":
            raise PaymentsError(
                "Zahlung ist bereits vollständig erstattet.", status_code=409
            )
        already_refunded = self._refunded_sum(db, payment["reservation_id"])
        remaining = full_amount - already_refunded
        if remaining <= 0:
            raise PaymentsError(
                "Zahlung ist bereits vollständig erstattet.", status_code=409
            )
        refund_amount = float(amount) if amount is not None else remaining
        if refund_amount > remaining + 1e-9:
            raise PaymentsError(
                "Erstattungsbetrag übersteigt den noch nicht erstatteten Betrag.",
                status_code=422,
            )
        amount_cents = _to_cents(refund_amount) if amount is not None else None
        # Deterministischer Idempotenz-Key (Wurzel 2): zwei nebenläufige Refunds
        # (Doppelklick/Retry) passieren beide den Status-Guard oben, bevor einer
        # den Status setzt — nur Stripes idempotency_key verhindert das zweite
        # Geldereignis. Betrag im Key, damit eine legitime spätere Teilerstattung
        # anderer Höhe nicht fälschlich denselben Key trifft.
        idem_key = f"refund:{payment_id}:{amount_cents if amount_cents else 'full'}"
        with _stripe_errors():
            result = sc.refund(
                payment["gateway_ref"], amount_cents,
                client=self._stripe, idempotency_key=idem_key,
            )
        self._insert_payment(
            db,
            reservation_id=payment["reservation_id"],
            amount=refund_amount,
            currency=payment.get("currency"),
            ptype="refund",
            gateway_ref=result["id"],
            status="succeeded",
        )
        # Voll erstattet, sobald die Summe aller Erstattungen den Ursprungsbetrag
        # erreicht (nicht nur wenn EINE Erstattung >= voller Betrag ist).
        is_full = (already_refunded + refund_amount) >= full_amount - 1e-9
        status_val = "refunded" if is_full else "partially_refunded"
        self._update_payment(db, payment_id, {"status": status_val})
        self._set_reservation_payment_status(
            db, payment["reservation_id"], status_val
        )
        return {"payment_id": payment_id, "refund_id": result["id"]}

    # --- Helfer (DB) ---------------------------------------------------------

    def _insert_payment(
        self,
        db: Client,
        *,
        reservation_id: str,
        amount: float,
        currency: str | None,
        ptype: str,
        gateway_ref: str,
        status: str,
    ) -> dict:
        row: dict[str, Any] = {
            "reservation_id": reservation_id,
            "amount": amount,
            "type": ptype,
            "gateway": "stripe",
            "gateway_ref": gateway_ref,
            "status": status,
        }
        if currency:
            row["currency"] = currency
        ins = db.table("payments").insert(row).execute().data
        return ins[0] if ins else row

    def _update_payment(self, db: Client, payment_id: str, patch: dict) -> None:
        db.table("payments").update(patch).eq("id", payment_id).execute()

    def _reuse_pending_intent(
        self, db: Client, reservation_id: str, ptype: str
    ) -> dict | None:
        """Idempotenz-Kern: existiert für (reservation, ptype) bereits ein offener
        (pending) Stripe-PaymentIntent, gib {payment_id, client_secret} zurück, um
        ihn wiederzuverwenden — sonst None. Die EINE Stelle, die Doppel-Intents bei
        Doppelklick/Reload/Retry/Webhook-Redelivery verhindert (Wurzel: „einmal
        aufgerufen" als Annahme). Jeder neue Intent-erzeugende Pfad ruft das ZUERST.
        """
        existing = (
            db.table("payments")
            .select("id, gateway_ref")
            .eq("reservation_id", reservation_id)
            .eq("type", ptype)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if not (existing and existing[0].get("gateway_ref")):
            return None
        with _stripe_errors():
            intent = sc.retrieve_payment_intent(
                existing[0]["gateway_ref"], client=self._stripe
            )
        return {
            "payment_id": existing[0]["id"],
            "client_secret": intent["client_secret"],
        }

    def _refunded_sum(self, db: Client, reservation_id: str) -> float:
        """Summe der bereits erfolgten Erstattungen dieser Buchung. payments hat
        keine Parent-Verknüpfung (refund-Rows tragen nur reservation_id) — für den
        Doppelklick-/Retry-Fall auf DERSELBEN Zahlung ist die Summe über
        (reservation_id, type='refund', succeeded) die konservative, korrekte
        Bemessungsgrundlage für den noch erstattbaren Restbetrag."""
        rows = (
            db.table("payments")
            .select("amount")
            .eq("reservation_id", reservation_id)
            .eq("type", "refund")
            .eq("status", "succeeded")
            .execute()
        ).data or []
        return float(sum(float(r.get("amount") or 0) for r in rows))

    def _load_payment(
        self,
        db: Client,
        payment_id: str,
        tenant_id: str,
        *,
        expect_type: str | None = None,
    ) -> dict:
        """Zahlung tenant-sicher laden (Tenant über die Reservierung)."""
        rows = (
            db.table("payments")
            .select("id, reservation_id, amount, currency, type, status, gateway_ref")
            .eq("id", payment_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise PaymentsError("Zahlung nicht gefunden.", status_code=404)
        payment = rows[0]
        # Tenant-Check über die Reservierung (payments hat keine tenant_id-Spalte).
        res = self._load_reservation(db, payment["reservation_id"])
        if res["tenant_id"] != tenant_id:
            raise PaymentsError("Zahlung nicht gefunden.", status_code=404)
        if expect_type and payment["type"] != expect_type:
            raise PaymentsError(
                f"Zahlung ist keine {expect_type}-Zahlung.", status_code=422
            )
        return payment

    def _deposit_amount(self, db: Client, reservation_id: str) -> float:
        """Kautionsbetrag aus dem Objekt der Reservierung (keine Erfindung)."""
        res = (
            db.table("reservations")
            .select("property_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        prop = (
            db.table("properties")
            .select("deposit_amount")
            .eq("id", res[0]["property_id"])
            .limit(1)
            .execute()
        ).data
        amount = prop[0]["deposit_amount"] if prop else None
        if not amount or float(amount) <= 0:
            raise PaymentsError(
                "Für dieses Objekt ist keine Kaution hinterlegt.", status_code=422
            )
        return float(amount)

    def _set_reservation_payment_status(
        self, db: Client, reservation_id: str, status: str
    ) -> None:
        db.table("reservations").update({"payment_status": status}).eq(
            "id", reservation_id
        ).execute()


def _currency_for_country(country: str) -> str:
    """Auszahlungswährung des Bankkontos. EU/SEPA → EUR; sonst klar fehlschlagen
    statt zu raten (keine Fallback-Erfindung)."""
    sepa_eur = {
        "DE", "AT", "FR", "ES", "IT", "NL", "BE", "PT", "IE", "FI", "GR",
        "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT",
    }
    if country.upper() in sepa_eur:
        return "eur"
    raise PaymentsError(
        f"Auszahlungswährung für Land {country} nicht bestimmbar.", status_code=422
    )
