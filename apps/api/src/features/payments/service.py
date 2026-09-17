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
an Stripe (``int(round(amount * 100))``). PayPal (Multiparty) läuft parallel über
``paypal_client`` (Major-Unit-Strings, eigener Onboarding-/Order-/Refund-Pfad).
"""
# pylint: disable=too-many-lines
from __future__ import annotations

import io
from collections.abc import Mapping
from contextlib import contextmanager
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Any

from stripe import StripeClient
from stripe import StripeError as _StripeError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.sales_channels import FREMDE_PORTALE
from src.core.security import AuthContext
from src.features.booking_conditions.plan import (
    erste_zahlung,
    kondition_fuer,
    restzahlung_faellig_am,
)
from src.features.cohosts.payout_service import PayoutService as CohostPayoutService
from src.features.cohosts.payouts import BeteiligungFehler
from src.features.donations.berechnung import Spende as DonationShare
from src.features.donations.service import DonationsService
from src.features.payouts.faelligkeit import transfer_group as _transfer_group

from . import stripe_client as sc
from . import welt
from .paypal_client import PayPalClient, PayPalError, PayPalNotConfiguredError
from .schemas import (
    BookingPaymentResult,
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    ConnectRequirementError,
    CountryRequirements,
    DiagnosticCheck,
    PaymentsDiagnostics,
    PaymentSettings,
    PaymentSettingsResponse,
    PlatformFeeRow,
    PlatformFeeSummary,
    SliceHealth,
    StripeAccountDiagnostics,
)
from .stripe_client import (
    StripeMarktplatzNichtKonfiguriertError,
    StripeNotConfiguredError,
    get_stripe,
    get_stripe_marktplatz,
)

log = get_logger("nextdays.payments")

# Mindestkantenlänge, die Stripe für das Branding-Icon verlangt.
_ICON_MIN_KANTE = 128


class PaymentsError(Exception):
    def __init__(
        self, message: str, *, status_code: int = 400, param: str | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        # Von Stripe benanntes Eingabefeld (z. B. „business_profile[url]"). Nur
        # bei invalid_request_error gesetzt — der Aufrufer kann damit gezielt
        # DIESES Feld aus einem Sammel-Update nehmen, statt alles zu verlieren.
        self.param = param


class PaymentsConfigError(PaymentsError):
    """Der Zahlungsweg ist auf DIESEM Prozess gar nicht konfiguriert.

    Abgegrenzt von einem gewöhnlichen `PaymentsError`, weil beide völlig
    verschiedene Konsequenzen haben: eine abgelehnte Karte betrifft EINE Zeile
    und ist final, ein fehlender `STRIPE_SECRET_KEY` betrifft ALLE Zeilen und
    ist behebbar. Wer beides gleich behandelt, schreibt einen behebbaren
    Betriebsmangel als endgültigen Zahlungsausfall in die Datenbank.

    Genau das drohte am 25.08.2026: `nextdays-worker` (Coolify-Anwendung id 9)
    hatte keinen `STRIPE_SECRET_KEY`; `charge_due_balance` hätte jede fällige
    Restzahlung auf `failed` gesetzt — ein Zustand, den der stündliche Tick
    nie wieder aufgreift, weil er nur `scheduled` liest. Der Worker hätte das
    als `log.warning("balance_charge_failed")` gemeldet, also genauso wie eine
    gedeckte Ablehnung (Wurzel 5).
    """


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
        param = getattr(exc, "param", None)
        raise PaymentsError(msg, status_code=code, param=param or None) from exc


def _stripe_feld(objekt: object, name: str) -> str:
    """Ein Feld aus einem Stripe-Objekt lesen — als Text, nie als Absturz.

    `StripeObject` ist seit stripe-python 12 KEINE dict-Unterklasse mehr: es hat
    kein `.get`, und sein `__getattr__` macht aus dem fehlenden Namen einen
    `AttributeError`. `e.get("requirement")` auf einem Requirement-Fehler warf
    deshalb `AttributeError: get` — ein roher 500 mitten im Onboarding, und zwar
    genau dann, wenn Stripe etwas zu BEANSTANDEN hat. Solange alles glatt lief,
    war die Liste leer und die Stelle unauffaellig (16.09.2026, live gefunden
    beim Anlegen eines Gastgeber-Kontos).

    Beide Formen werden bedient, weil in den Tests rohe `dict` stehen und aus
    dem SDK Objekte kommen. Fehlt das Feld, ist das Ergebnis leer — hier ist
    das kein erfundener Ersatzwert, sondern die ehrliche Aussage „Stripe hat
    dazu nichts gesagt"; der Aufrufer zeigt den Rest der Meldung trotzdem.
    """
    if isinstance(objekt, Mapping):
        return str(objekt.get(name) or "")
    return str(getattr(objekt, name, "") or "")


def _to_cents(amount: float) -> int:
    """Betrag in Cent (Stripe rechnet in der kleinsten Einheit).

    Bewusst OHNE Zero-Decimal-Sonderfall (JPY/HUF/KRW rechnen bei Stripe ohne
    Faktor 100): `SUPPORTED_CURRENCIES` lässt ausschließlich EU27-Währungen
    plus CHF/GBP/USD zu — allesamt zweistellig. Ein Zero-Decimal-Code kann hier
    also nicht ankommen; käme er je dazu, MUSS diese Funktion mitgezogen
    werden. (Der PayPal-Pfad hat seine eigene, abweichende Liste in
    `paypal_client._ZERO_DECIMAL` — die Anbieter-Listen sind nicht identisch
    und dürfen nicht zusammengelegt werden.)
    """
    return int(round(amount * 100))


def connected_account(db: Client, tenant_id: str) -> str:
    """Connected Account des Tenants — nur wenn er Zahlungen empfangen darf.

    Modulfunktion, weil sie inzwischen zwei Wege brauchen: der Buchungs-/
    Kautions-Pfad dieses Service und die Nachberechnung (`nachberechnung.py`,
    0469). Eine zweite Abfrage dort hätte irgendwann die Prüfung auf
    `stripe_charges_enabled` verloren — dann entstünden Zahlungslinks in einem
    Konto, das noch offene Angaben bei Stripe hat, und der Gast läuft in einen
    Fehler auf der Zahlseite.
    """
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
    return str(acct)


def passe_restzahlung_an(
    db: Client, *, reservation_id: str, total_amount: float, paid_amount: float
) -> None:
    """Geplante Restzahlung an einen geänderten Buchungsbetrag anpassen.

    WURZEL 1 — der Gegenzustand, der bis 0469 fehlte: `reservations.move()` mit
    `reprice=True` hebt `total_amount` an (Verlängerung, Zusatzgast), die bei der
    Anzahlung angelegte `balance`-Zeile blieb aber auf dem ALTEN Betrag stehen —
    `_schedule_balance` legt genau eine an und kehrt bei vorhandener Zeile sofort
    zurück. Der stündliche Worker-Tick zog danach die alte, zu niedrige Summe
    ein und die Differenz fiel niemandem auf: Buchung „bezahlt", Kasse zu wenig.
    Umgekehrt (Verkürzung) hätte er zu viel eingezogen.

    Gerechnet wird `total − bereits bezahlt`, also aus demselben Stand, den auch
    der Lesepfad als „noch offen" ausweist (`reservations/reads.py`).

    Angefasst wird NUR eine Zeile, die noch `scheduled` ist. `charging` läuft
    gerade bei Stripe (ein Update mitten im Charge wäre eine zweite Wahrheit),
    `done/failed/needs_action` sind abgeschlossene Zustände. Sinkt der Rest auf
    0 oder darunter, entfällt die geplante Zahlung (`cancelled`, 0469) — sie
    stehen zu lassen hieße, dass der Tick sie später doch noch einzieht.

    Es wird KEINE Zeile neu angelegt: ohne gespeicherte Karte
    (`stripe_customer_id`) könnte der Worker sie nie belasten, und eine
    dauerhaft `scheduled` liegende Zahlung ohne Zahlweg wäre eine Attrappe
    (Wurzel 4). Für solche Buchungen ist der Nachberechnungs-Link der Weg.
    """
    rows = (
        db.table("payments")
        .select("id, amount, scheduled_status")
        .eq("reservation_id", reservation_id)
        .eq("type", "balance")
        .eq("scheduled_status", "scheduled")
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return
    zeile = rows[0]
    rest = round(float(total_amount or 0) - float(paid_amount or 0), 2)
    if rest <= 0:
        felder: dict[str, object] = {"scheduled_status": "cancelled"}
    elif abs(rest - float(zeile.get("amount") or 0)) < 0.005:
        return  # unverändert — kein Schreibvorgang, kein Log-Rauschen
    else:
        felder = {"amount": rest}
    (
        db.table("payments")
        .update(felder)
        .eq("id", zeile["id"])
        .eq("scheduled_status", "scheduled")
        .execute()
    )
    log.info(
        "geplante_restzahlung_angepasst",
        reservation_id=reservation_id,
        payment_id=str(zeile["id"]),
        alt=float(zeile.get("amount") or 0),
        neu=rest,
    )




def _quadratisch(content: bytes) -> bytes:
    """Bild auf ein Quadrat polstern (PNG) — für das Stripe-Branding-Icon.

    Stripe verlangt für ``settings.branding.icon`` ein Bild im Seitenverhältnis
    1:1 und mindestens 128×128 (live verifiziert: „did not have the expected
    aspect ratio of 1:1"). Firmenlogos sind fast nie quadratisch.

    Das Logo wird dabei NICHT beschnitten und NICHT verzerrt — es wird auf einer
    quadratischen Fläche zentriert. Ein Zuschnitt würde Teile der Marke
    abschneiden, ein Verzerren sie entstellen; beides wäre eine stillschweigende
    Veränderung fremden Markenmaterials.

    Der Hintergrund ist transparent, wenn die Quelle Transparenz kennt, sonst
    weiß — kein geratener Farbwert (Wurzel 4).
    """
    from PIL import Image  # noqa: PLC0415 — nur hier gebraucht

    with Image.open(io.BytesIO(content)) as bild:
        hat_alpha = bild.mode in ("RGBA", "LA") or "transparency" in bild.info
        quelle = bild.convert("RGBA")
        seite = max(quelle.width, quelle.height, _ICON_MIN_KANTE)
        hintergrund = (0, 0, 0, 0) if hat_alpha else (255, 255, 255, 255)
        flaeche = Image.new("RGBA", (seite, seite), hintergrund)
        flaeche.paste(
            quelle,
            ((seite - quelle.width) // 2, (seite - quelle.height) // 2),
            quelle,
        )
        puffer = io.BytesIO()
        flaeche.save(puffer, format="PNG")
        return puffer.getvalue()


class PaymentsService:
    slice_name = "payments"

    def __init__(
        self,
        service_client: Client | None = None,
        stripe: StripeClient | None = None,  # injizierbar für Tests
        tenant_id: str | None = None,
    ) -> None:
        self._db = service_client
        # Lazy: der StripeClient wird erst beim ersten echten Stripe-Zugriff
        # gebaut (über die ``_stripe``-Property). So scheitert nicht schon die
        # Service-Instanziierung — bei jedem payments-Request — wenn der Key
        # fehlt; stattdessen wirft erst der konkrete Aufruf einen sauberen,
        # verständlichen Fehler (503). Ein injizierter Client (Tests) wird direkt
        # übernommen.
        self._injected_stripe = stripe
        # WELCHE STRIPE-WELT (16.09.2026). Der Marktplatz myBestDays kann in der
        # Sandbox laufen, während das PMS echtes Geld bewegt — zwei Wege, ein
        # Code. Entschieden wird das GENAU HIER, an einer Stelle, und nicht an
        # den 29 Aufrufstellen von ``_stripe``: der Mandant kommt beim BAU des
        # Service herein, der Client bleibt eine Eigenschaft der Instanz.
        #
        # Ohne `tenant_id` bleibt alles wie bisher (Live-Client). Das ist kein
        # stiller Rückfall, sondern der Normalfall: `stripe_sandbox` ist
        # default false, und ein Sandbox-Konto existiert in der Live-Welt gar
        # nicht — ein Aufruf mit dem falschen Client scheitert LAUT an Stripes
        # „No such account", in beide Richtungen. Es gibt keinen Weg, auf dem
        # ein Sandbox-Mandant eine echte Karte belastet.
        self._tenant_id = tenant_id
        self._sandbox_zelle: bool | None = None

    @property
    def _stripe(self) -> StripeClient:
        """StripeClient — injiziert (Test) oder lazy aus der Config. Fehlt der
        Key, wird StripeNotConfiguredError in einen klaren PaymentsConfigError
        (503) übersetzt, damit das Frontend „Stripe nicht konfiguriert" sieht
        statt eines kryptischen Auth-Fehlers.

        Der eigene Typ (Unterklasse von PaymentsError, für Router und alle
        bestehenden `except PaymentsError` also unverändert) macht den
        Betriebsmangel für Hintergrundläufe unterscheidbar — siehe
        PaymentsConfigError."""
        if self._injected_stripe is not None:
            return self._injected_stripe
        if self._ist_sandbox():
            try:
                return get_stripe_marktplatz()
            except StripeMarktplatzNichtKonfiguriertError as exc:
                raise PaymentsConfigError(str(exc), status_code=503) from exc
        try:
            return get_stripe()
        except StripeNotConfiguredError as exc:
            raise PaymentsConfigError(str(exc), status_code=503) from exc

    def _ist_sandbox(self) -> bool:
        """Steht dieser Mandant in der Marktplatz-Sandbox? Einmal je Instanz.

        Die Entscheidung selbst steht in `welt.py` — sie gilt auch fuer
        `payouts` und `stripe_saldo`, und zwei Kopien davon waeren zwei
        Gelegenheiten, sie verschieden zu beantworten.
        """
        if self._sandbox_zelle is None:
            self._sandbox_zelle = welt.ist_sandbox(self._db, self._tenant_id)
        return self._sandbox_zelle

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
                        f"{_stripe_feld(e, 'requirement')}: "
                        f"{_stripe_feld(e, 'reason')}"
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

    def get_own_connect_account_id(self, ctx: AuthContext) -> str | None:
        """Die stripe_account_id DES EIGENEN Tenants (für den Dashboard-Banner).
        Über den Server (service_role), weil tenant_billing_profile am anon-/
        authenticated-Direktpfad gesperrt ist (Wurzel 6, Migration 0169)."""
        db, tenant_id = self._require(ctx)
        row = (
            db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return (row[0].get("stripe_account_id") if row else None) or None

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

    # --- Zahlungs-Einstellungen (Tab „Zahlungen") ---------------------------

    # Spalten, die das Zahlungen-Tab lesen/schreiben darf. Steuer/Legal-Felder
    # sind bewusst NICHT dabei — die pflegt das Buchhaltungs-Profil.
    _SETTINGS_COLUMNS = (
        "active_card_gateway",
        "paypal_email",
        "manual_payments_enabled",
        "merchant_name",
        "auto_charge_first_deposit",
        "auto_charge_scheduled",
        "auto_refund_on_cancel",
        "auto_preauth_deposits",
        "verify_card_before_booking",
        "iban",
        "bic",
        "bank_name",
        "account_holder",
        # Zahlungshinweis + Standard-Steuersatz: gehören fachlich zur manuellen
        # Zahlung (sie stehen in der Zahlungsaufforderung an den Gast) und sind
        # keine Steuer-/Legal-Stammdaten. Bis 14.08.2026 hatte KEIN Weg sie
        # geschrieben — `{{payment_text}}`/`{{tax_rate}}` waren damit tot.
        "default_payment_text",
        "default_tax_rate",
    )

    def get_payment_settings(self, ctx: AuthContext) -> PaymentSettingsResponse:
        """Zahlungs-Einstellungen des Tenants + abgeleiteter Stripe-Status."""
        db, tenant_id = self._require(ctx)
        cols = (
            ",".join(self._SETTINGS_COLUMNS)
            + ",stripe_account_id,stripe_charges_enabled"
            + ",paypal_onboarding_status,paypal_payments_receivable"
            + ",paypal_email_confirmed"
        )
        row = (
            db.table("tenant_billing_profile")
            .select(cols)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        data = row[0] if row else {}
        paypal_connected = bool(
            data.get("paypal_payments_receivable")
            and data.get("paypal_email_confirmed")
        )
        return PaymentSettingsResponse(
            **{k: data.get(k) for k in self._SETTINGS_COLUMNS if data.get(k) is not None},
            stripe_connected=bool(data.get("stripe_account_id")),
            stripe_charges_enabled=bool(data.get("stripe_charges_enabled")),
            paypal_onboarding_status=data.get("paypal_onboarding_status")
            or "not_started",
            paypal_connected=paypal_connected,
        )

    def update_payment_settings(
        self, ctx: AuthContext, req: PaymentSettings
    ) -> PaymentSettingsResponse:
        """Zahlungs-Einstellungen speichern. Es werden AUSSCHLIESSLICH die
        Zahlungs-Spalten geschrieben (Whitelist), nie Steuer-/Legal-Felder.
        Stripe als aktives Kartengateway verlangt einen verbundenen, abrechnungs-
        fähigen Account — sonst fail-closed (kein toter Schalter, Wurzel 5)."""
        db, tenant_id = self._require(ctx)
        if req.active_card_gateway == "stripe":
            row = (
                db.table("tenant_billing_profile")
                .select("stripe_account_id,stripe_charges_enabled")
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            acct = row[0] if row else {}
            if not acct.get("stripe_account_id") or not acct.get(
                "stripe_charges_enabled"
            ):
                raise PaymentsError(
                    "Stripe ist noch nicht abrechnungsfähig verbunden.",
                    status_code=409,
                )
        payload = req.model_dump(include=set(self._SETTINGS_COLUMNS))
        # Leere PayPal-Adresse als NULL (Kanal aus), nicht als Leerstring.
        if not payload.get("paypal_email"):
            payload["paypal_email"] = None
        (
            db.table("tenant_billing_profile")
            .update(payload)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return self.get_payment_settings(ctx)

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

        ZWEI ANLAGE-WEGE (16.09.2026). Stripe nimmt für NEUE Connect-Integrationen
        kein ``POST /v1/accounts`` mehr an — die Antwort ist ein 400 mit „Stripe no
        longer recommends Accounts v1 for new Connect integrations". Der Marktplatz
        myBestDays ist genau so eine neue Integration und stand damit still: ohne
        verbundenes Konto kein Bankdatenfeld, keine Freischaltung, kein Objekt live.
        Deshalb legt die MARKTPLATZ-Welt über ``POST /v2/core/accounts`` an; der
        gewohnte v1-Weg des PMS bleibt unangetastet.

        Warum das den Rest des Codes NICHT anfasst: ein v2 angelegtes Konto trägt
        dieselbe ``acct_``-Kennung und ist über die v1-API vollständig les- und
        schreibbar — gemessen am 16.09.2026 (``retrieve``: ``business_type``,
        ``capabilities`` ``card_payments``/``transfers``, ``requirements``;
        ``update``: ``individual``/``company``, ``business_profile``,
        ``tos_acceptance``). Die rund vierzig übrigen Stripe-Aufrufe bleiben also
        wie sie sind; geändert ist allein der Anlage-Aufruf.

        Warum am WELT-Schalter und nicht an Stripes Fehlermeldung: die Ablehnung
        kommt ohne maschinenlesbaren ``code`` — nur als englischer Satz. Darauf zu
        verzweigen hiesse, den Anlage-Weg von einem Text abhängig zu machen, den
        Stripe jederzeit umformulieren kann (Wurzel 4).
        """
        if self._ist_sandbox():
            return self._create_connect_account_v2(tenant_id, req)
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

    def _create_connect_account_v2(
        self, tenant_id: str, req: ConnectAccountCreate
    ) -> ConnectAccountResponse:
        """Derselbe Account über Accounts v2 — siehe ``create_connect_account``.

        Die Angaben sind eins zu eins die des v1-Aufrufs, nur anders benannt:
        ``dashboard='none'`` ist das Custom-Konto (kein Stripe-Dashboard für den
        Gastgeber), ``defaults.responsibilities`` mit zweimal ``application`` ist
        die Entsprechung zu ``tos_acceptance.service_agreement='full'`` — die
        Plattform trägt Gebühren und Ausfälle. ``stripe_balance.stripe_transfers``
        heisst in der v1-Sicht ``transfers``.

        KEINE ``defaults.currency``: Stripe verlangt sie nicht, und ein Wert hier
        wäre geraten (Wurzel 4 — 27 EU-Länder, die Währung steht in den Daten).
        """
        with _stripe_errors():
            account = self._stripe.v2.core.accounts.create(
                params={
                    "contact_email": req.email,
                    "dashboard": "none",
                    "identity": {
                        "country": req.country,
                        # Einzelperson oder Firma — bestimmt die KYC-Pflichtfelder.
                        "entity_type": req.business_type,
                    },
                    "include": [
                        "configuration.merchant",
                        "configuration.recipient",
                        "identity",
                        "requirements",
                    ],
                    "defaults": {
                        "responsibilities": {
                            "fees_collector": "application",
                            "losses_collector": "application",
                        }
                    },
                    "configuration": {
                        "merchant": {
                            # Branchencode 7011 = Lodging/Unterkünfte; sonst
                            # offenes Requirement → blockiert charges.
                            "mcc": "7011",
                            "capabilities": {"card_payments": {"requested": True}},
                        },
                        "recipient": {
                            "capabilities": {
                                "stripe_balance": {
                                    "stripe_transfers": {"requested": True}
                                }
                            }
                        },
                    },
                    "metadata": {"tenant_id": tenant_id},
                }
            )
        return ConnectAccountResponse(stripe_account_id=account.id)

    _AUSWEIS_ENDUNG = {"image/jpeg": "jpg", "image/png": "png"}

    def set_identity_document(
        self,
        tenant_id: str,
        stripe_account_id: str,
        *,
        content: bytes,
        content_type: str,
        rueckseite: bool = False,
    ) -> ConnectAccountStatus:
        """Ausweisdokument des Gastgebers an Stripe uebergeben.

        Der fehlende Weg im Onboarding (17.09.2026). Scheitert der Abgleich der
        eingetippten Angaben (`failed_keyed_identity`), nennt Stripe in seiner
        eigenen Meldung den Ausweg: „provide additional documentation to
        verify". Unsere Karte antwortete darauf mit „Kann hier noch nicht
        hochgeladen werden — bitte an den Support" — eine Sackgasse an genau
        der Stelle, an der der Gastgeber weiterkommen muss.

        Zwei Schritte, wie Stripe sie vorschreibt: Datei im VERBUNDENEN Konto
        hochladen, dann die zurueckgegebene Kennung am Konto eintragen. Danach
        steht `verification.status` auf `pending`; der endgueltige Stand kommt
        per Webhook, nicht aus dieser Antwort.

        Geprueft wird VOR dem Hochladen (Wurzel 8): Typ und Groesse. Eine
        abgelehnte Datei soll an unserer Grenze scheitern, mit einem Satz, der
        sagt was erlaubt ist — nicht als roher Stripe-Fehler.
        """
        self._require_own_connect_account(tenant_id, stripe_account_id)
        endung = self._AUSWEIS_ENDUNG.get(content_type.split(";")[0].strip())
        if endung is None:
            raise PaymentsError(
                "Der Ausweis muss ein Farbbild im Format JPG oder PNG sein.",
                status_code=422,
            )
        if not content:
            raise PaymentsError("Die Datei ist leer.", status_code=422)
        if len(content) > sc.AUSWEIS_MAX_BYTES:
            raise PaymentsError(
                "Die Datei ist zu groß "
                f"(max. {sc.AUSWEIS_MAX_BYTES // (1024 * 1024)} MB).",
                status_code=422,
            )
        seite = "back" if rueckseite else "front"
        with _stripe_errors():
            datei_id = sc.upload_identity_document(
                acct=stripe_account_id,
                content=content,
                filename=f"ausweis-{seite}.{endung}",
                client=self._stripe,
            )
            self._stripe.v1.accounts.update(
                stripe_account_id,
                params={
                    "individual": {"verification": {"document": {seite: datei_id}}}
                },
            )
        log.info(
            "ausweis_uebergeben",
            tenant_id=tenant_id,
            account=stripe_account_id,
            seite=seite,
        )
        return self.get_connect_account_status(tenant_id, stripe_account_id)

    def get_connect_account_status(
        self, tenant_id: str, stripe_account_id: str
    ) -> ConnectAccountStatus:
        """Liest KYC-/Aktivierungsstatus + offene Requirements (für die eigene UI)."""
        self._require_own_connect_account(tenant_id, stripe_account_id)
        with _stripe_errors():
            account = self._stripe.v1.accounts.retrieve(stripe_account_id)
        reqs = account.requirements
        self._mirror_account_flags(
            tenant_id,
            charges=bool(account.charges_enabled),
            payouts=bool(account.payouts_enabled),
            details=bool(account.details_submitted),
        )
        return ConnectAccountStatus(
            stripe_account_id=account.id,
            charges_enabled=bool(account.charges_enabled),
            payouts_enabled=bool(account.payouts_enabled),
            details_submitted=bool(account.details_submitted),
            requirements=list(reqs.currently_due or []),
            past_due=list(reqs.past_due or []),
            eventually_due=list(reqs.eventually_due or []),
            pending_verification=list(reqs.pending_verification or []),
            errors=[
                ConnectRequirementError(
                    requirement=_stripe_feld(e, "requirement"),
                    code=_stripe_feld(e, "code"),
                    reason=_stripe_feld(e, "reason"),
                )
                for e in (reqs.errors or [])
            ],
            current_deadline=reqs.current_deadline,
            disabled_reason=reqs.disabled_reason,
        )

    def _mirror_account_flags(
        self, tenant_id: str, *, charges: bool, payouts: bool, details: bool
    ) -> None:
        """Die gespiegelten Freischalt-Flags im Profil auf den LIVE-Stand ziehen.

        ``stripe_charges_enabled`` ist das Gate für Gästezahlungen
        (``_connected_account``). Bisher schrieb es nur der account.updated-Webhook
        — verpasst/nie zugestellt (lokale Entwicklung, Webhook-Ausfall), blieb ein
        altes ``true`` stehen, obwohl Stripe den Account längst wieder gesperrt
        hatte: die Buchungsstrecke hätte Zahlungen angeboten, die Stripe ablehnt.
        Beim Live-Status-Abruf daher gegenschreiben, aber NUR bei echter Abweichung
        (der Status wird gepollt — kein Schreiben pro Poll).
        """
        flags = {
            "stripe_charges_enabled": charges,
            "stripe_payouts_enabled": payouts,
            "stripe_details_submitted": details,
        }
        db = self._db_or_fail()
        row = (
            db.table("tenant_billing_profile")
            .select(",".join(flags))
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if row and all(row[0].get(k) == v for k, v in flags.items()):
            return
        log.info(
            "connect_flags_drift_corrected",
            tenant_id=tenant_id,
            gespeichert=row[0] if row else None,
            live=flags,
        )
        db.table("tenant_billing_profile").update(flags).eq(
            "tenant_id", tenant_id
        ).execute()

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

    # Obergrenze für den Feld-für-Feld-Rückzug unten: mehr abgelehnte Felder als
    # das deutet auf ein grundsätzlich kaputtes Update hin — dann lieber
    # fehlschlagen als endlos gegen Stripe laufen (Wurzel 8: harte Grenze).
    _MAX_REJECTED_FIELDS = 8

    # Dateiendung → Content-Type für das Firmenlogo. Stripe akzeptiert als
    # Branding nur PNG/JPEG; SVG und WebP sind bei uns erlaubt, dort aber nicht.
    _LOGO_TYPEN = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "svg": "image/svg+xml",
    }
    _LOGO_BUCKET = "company-logos"

    def sync_branding_logo(self, tenant_id: str, stripe_account_id: str) -> None:
        """Firmenlogo als Branding des verbundenen Kontos setzen.

        Das ist das Logo, das der GAST beim Bezahlen sieht — auf der Seite eines
        Zahlungslinks, im Checkout und auf Stripe-Belegen. Es kommt
        ausschließlich aus `settings.branding` des verbundenen Kontos; unser
        `company_logo_url` allein bewirkt dort nichts (live belegt: Zahlseite
        zeigte den grauen Platzhalter, obwohl im Profil ein Logo lag).

        Idempotent (Wurzel 2): Ist dieselbe URL bereits übertragen, passiert
        nichts — sonst legte jeder Profil-Sync eine weitere Datei im Konto des
        Betriebs an.

        Kein ausgehender Fetch auf die gespeicherte URL (Wurzel 8): Die Datei
        wird über den Storage-Client am abgeleiteten Pfad geladen, und der Pfad
        muss im Ordner DIESES Tenants liegen.
        """
        db = self._db_or_fail()
        self._require_own_connect_account(tenant_id, stripe_account_id)
        row = (
            db.table("tenant_billing_profile")
            .select("company_logo_url, stripe_branding_logo_url")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        url = str(row[0].get("company_logo_url") or "") if row else ""
        if not url:
            return
        if row[0].get("stripe_branding_logo_url") == url:
            return  # unverändert, nichts zu tun

        pfad = self._logo_storage_pfad(url, tenant_id)
        endung = pfad.rsplit(".", 1)[-1].lower()
        content_type = self._LOGO_TYPEN.get(endung)
        if content_type not in sc.BRANDING_MIME:
            # Kein stiller Verzicht und keine Konvertierung ins Blaue hinein:
            # der Betrieb erfährt, warum sein Logo beim Bezahlen fehlt.
            raise PaymentsError(
                "Der Zahlungsanbieter zeigt nur PNG- oder JPEG-Logos. Bitte lade "
                "das Firmenlogo in einem dieser Formate hoch.",
                status_code=422,
            )
        try:
            content = db.storage.from_(self._LOGO_BUCKET).download(pfad)
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning(
                "branding_logo_download_failed", tenant_id=tenant_id, error=str(exc)
            )
            raise PaymentsError(
                "Das gespeicherte Firmenlogo konnte nicht gelesen werden.",
                status_code=502,
            ) from exc
        if len(content) > sc.BRANDING_MAX_BYTES:
            raise PaymentsError(
                "Das Firmenlogo ist für den Zahlungsanbieter zu groß "
                f"(max. {sc.BRANDING_MAX_BYTES // 1024} KB).",
                status_code=422,
            )
        dateiname = pfad.rsplit("/", 1)[-1]
        with _stripe_errors():
            logo_id = sc.upload_branding_file(
                content=content,
                filename=dateiname,
                purpose="business_logo",
                client=self._stripe,
            )
        # Das Icon (das Rundsymbol auf der Zahlseite) verlangt ein QUADRATISCHES
        # Bild ab 128×128. Lehnt Stripe es ab, bleibt das große Logo trotzdem
        # gesetzt — und der Grund wird sichtbar gemeldet, statt still zu fehlen.
        icon_id: str | None = None
        icon_fehler: str | None = None
        try:
            icon_bytes = _quadratisch(content)
            with _stripe_errors():
                icon_id = sc.upload_branding_file(
                    content=icon_bytes,
                    filename="icon.png",
                    purpose="business_icon",
                    client=self._stripe,
                )
        except PaymentsError as exc:
            icon_fehler = exc.message
            log.warning(
                "branding_icon_abgelehnt", tenant_id=tenant_id, error=exc.message
            )
        except OSError as exc:
            # Pillow kann die Datei nicht lesen (kaputt, oder ein Format, das
            # nur der Browser mag). Kein 500 auf einen Bild-Inhalt (Wurzel 8) —
            # das große Logo geht trotzdem raus.
            icon_fehler = "Das Logo konnte nicht als quadratisches Symbol aufbereitet werden."
            log.warning(
                "branding_icon_aufbereitung_fehlgeschlagen",
                tenant_id=tenant_id,
                error=str(exc),
            )
        with _stripe_errors():
            sc.set_branding(
                acct=stripe_account_id,
                icon_file_id=icon_id,
                logo_file_id=logo_id,
                client=self._stripe,
            )
        db.table("tenant_billing_profile").update(
            {"stripe_branding_logo_url": url}
        ).eq("tenant_id", tenant_id).execute()
        log.info(
            "branding_logo_synced", tenant_id=tenant_id, account=stripe_account_id
        )
        if icon_fehler:
            raise PaymentsError(
                "Das Logo erscheint beim Bezahlen, aber nicht als Symbol: "
                f"{icon_fehler}",
                status_code=422,
            )

    def _logo_storage_pfad(self, url: str, tenant_id: str) -> str:
        """Storage-Pfad aus der gespeicherten Logo-URL — im Ordner DIESES Tenants.

        Die URL stammt aus unserer eigenen Tabelle, wird aber trotzdem geprüft:
        ein Pfad außerhalb von `{tenant_id}/` wäre ein fremdes Objekt (Wurzel 3).
        """
        marker = f"/{self._LOGO_BUCKET}/"
        if marker not in url:
            raise PaymentsError(
                "Die gespeicherte Logo-Adresse ist unbrauchbar.", status_code=422
            )
        pfad = url.split(marker, 1)[1].split("?", 1)[0]
        if not pfad.startswith(f"{tenant_id}/") or ".." in pfad:
            raise PaymentsError(
                "Die gespeicherte Logo-Adresse gehört nicht zu diesem Betrieb.",
                status_code=403,
            )
        return pfad

    def sync_connect_fields(
        self, tenant_id: str, stripe_account_id: str, fields: dict[str, Any]
    ) -> tuple[ConnectAccountStatus, list[str]]:
        """Firmendaten an den Account senden — EIN abgelehntes Feld darf NICHT das
        ganze Update kippen.

        Stripe prüft Nebenangaben live (Telefonnummer gegen libphonenumber, Website
        gegen die echte Domain). Ist eine davon ungültig, lehnt Stripe den GESAMTEN
        Account-Update-Request ab — dann kommt keine einzige KYC-Pflichtangabe an
        und der Account bleibt für immer restricted, während die UI nur „es fehlen
        Angaben" zeigt. Darum: das von Stripe benannte Feld (``error.param``)
        entfernen und erneut senden, bis der Rest durchgeht. Die abgelehnten Felder
        werden NICHT ersetzt oder geraten (Wurzel 4) — sie werden als Klartext
        zurückgegeben, damit der Nutzer genau sie korrigieren kann.

        Rückgabe: (Status, Liste der abgelehnten Felder als „feld: Stripe-Grund").
        """
        self._require_own_connect_account(tenant_id, stripe_account_id)
        remaining = dict(fields)
        rejected: list[str] = []
        # Nur die FELDPFADE loggen, nie die Werte — im Update stehen Name, Adresse
        # und Geburtsdatum (PII, CWE-532). Der Pfad reicht, um zu sehen, was der
        # Sync überhaupt zu senden versucht.
        log.info(
            "connect_sync_start",
            tenant_id=tenant_id,
            account=stripe_account_id,
            fields=_param_paths(fields),
        )
        while remaining:
            try:
                with _stripe_errors():
                    self._stripe.v1.accounts.update(stripe_account_id, params=remaining)
                break
            except PaymentsError as exc:
                dropped = (
                    _drop_param(remaining, exc.param)
                    if exc.status_code == 400 and exc.param
                    else False
                )
                if not dropped or len(rejected) >= self._MAX_REJECTED_FIELDS:
                    log.error(
                        "connect_sync_failed",
                        tenant_id=tenant_id,
                        account=stripe_account_id,
                        param=exc.param,
                        status=exc.status_code,
                        error=exc.message,
                        already_rejected=rejected,
                    )
                    raise
                rejected.append(f"{exc.param}: {exc.message}")
                log.warning(
                    "connect_field_rejected",
                    tenant_id=tenant_id,
                    param=exc.param,
                    error=exc.message,
                    retry_with=_param_paths(remaining),
                )
        status = self.get_connect_account_status(tenant_id, stripe_account_id)
        log.info(
            "connect_sync_done",
            tenant_id=tenant_id,
            account=stripe_account_id,
            charges_enabled=status.charges_enabled,
            payouts_enabled=status.payouts_enabled,
            disabled_reason=status.disabled_reason,
            still_required=status.requirements,
            rejected=rejected,
        )
        return status, rejected

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
        status = self.get_connect_account_status(tenant_id, stripe_account_id)
        # Sichtbar machen, dass die ToS zwar durchging, der Account aber trotzdem
        # gesperrt bleiben kann (offene requirements) — sonst sieht man in der
        # Konsole nur „POST accept-tos 200 OK" und hält es für erledigt.
        log.info(
            "connect_tos_accepted",
            tenant_id=tenant_id,
            account=stripe_account_id,
            charges_enabled=status.charges_enabled,
            disabled_reason=status.disabled_reason,
            still_required=status.requirements,
        )
        return status

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
                "channel, ota_name, source_channex_booking_id, "
                "rate_plan_id, check_in, guest_email"
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
    # Die zentrale Menge (`core.sales_channels.FREMDE_PORTALE`), nicht eine
    # eigene Kopie: sie stand hier und in `subscriptions.EXTERNAL_CHANNELS`
    # wortgleich doppelt (Wurzel 1, zusammengelegt am 07.09.2026).
    _OTA_CHANNELS = FREMDE_PORTALE

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
                "über myBestDays ist hier keine Zahlung möglich.",
                status_code=409,
            )

    def _connected_account(self, db: Client, tenant_id: str) -> str:
        """Connected Account des Tenants — nur wenn er Zahlungen empfangen darf."""
        return connected_account(db, tenant_id)

    def _merchant_descriptor(self, db: Client, tenant_id: str) -> str | None:
        """Name des Händlers für die Kartenabrechnung (Stripe statement descriptor).
        Bevorzugt das explizit gesetzte merchant_name, sonst den Firmennamen
        (legal_name). None, wenn beides fehlt — dann kein Descriptor (kein
        erfundener Wert, Wurzel 4). stripe_client kappt/säubert selbst."""
        row = (
            db.table("tenant_billing_profile")
            .select("merchant_name, legal_name")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return None
        return row[0].get("merchant_name") or row[0].get("legal_name") or None

    def _settings_flag(self, db: Client, tenant_id: str, column: str) -> bool:
        """Einen booleschen Zahlungs-Toggle des Tenants lesen (Default False, wenn
        kein Profil existiert). Nur für die whitelisted Toggle-Spalten gedacht."""
        row = (
            db.table("tenant_billing_profile")
            .select(column)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return bool(row[0].get(column)) if row else False

    # Buchungen über unseren Marktplatz. Preisliste §2: „Eigenes
    # myBestDays-Portal (Direktbuchung) 8,0 % all-in". Alles andere ist
    # provisionsfrei am Charge — Direktbuchungen über die Website des Betriebs
    # ausdrücklich („provisionsfreie Direktbuchungen zusätzlich", §5), OTA-
    # Buchungen laufen gar nicht über uns (0,5 % wird monatlich fakturiert).
    _PORTAL_CHANNELS = frozenset({"portal"})

    def _ist_portal_buchung(self, res: dict) -> bool:
        """Kam diese Buchung über unser myBestDays-Portal (8 % all-in)?

        Die Provision hängt am KANAL, nicht am Kontotyp: Die Preisliste kennt
        „Ein Tarif für alle. Kein Privat- oder Agentur-Modell." Derselbe Betrieb
        kann über den Marktplatz (8 %), seine eigene Website (0 %) und OTAs
        (0,5 % monatlich) verkaufen.

        Fail-closed (Wurzel 5): Fehlt der Kanal, gilt die Buchung NICHT als
        Portal-Buchung — lieber keine Provision berechnen als eine zu Unrecht.
        """
        return (res.get("channel") or "").lower() in self._PORTAL_CHANNELS

    def _traegt_haftung(self, res: dict) -> bool:
        """Trägt die Plattform das Chargeback-Risiko dieser Buchung?

        Nur wo wir verdienen. Lastenheft §7.1 sagt 0 % Buchungsgebühr auf
        Vermieter-Buchungen zu — wer an einer Buchung nichts verdient, darf für
        sie auch nicht haften, sonst wäre das Versprechen ein unbegrenztes
        Risiko. Deckt sich mit den AGB (§4): „myNextDays wird nicht
        Vertragspartei des Beherbergungsvertrags."

        Portal-Buchung (8 %) → wir haften, Charge läuft über unser Konto.
        Sonst → Direct Charge, der Betrieb ist Merchant of Record.
        """
        return self._ist_portal_buchung(res)

    def _direct_acct(self, db: Client, res: dict) -> str | None:
        """Konto für Folgeoperationen an einem Direct Charge, sonst None.

        Refund, Capture und Cancel müssen bei Direct Charges im Konto des
        Betriebs laufen — dort liegt der Intent. Ohne den Header antwortet
        Stripe mit „No such payment_intent".
        """
        if self._traegt_haftung(res):
            return None
        return self._connected_account(db, res["tenant_id"])

    def _platform_fee_bps(
        self, db: Client, tenant_id: str, res: dict | None = None
    ) -> int:
        """Provision (Basispunkte) für DIESE Buchung — die einzige Fee-Quelle.

        Maßgeblich ist der KANAL, nicht der Kontotyp (Preisliste §2: „Eigenes
        myBestDays-Portal (Direktbuchung) 8,0 % all-in"). Derselbe Betrieb
        verkauft über den Marktplatz mit 8 %, über seine eigene Website
        provisionsfrei und über OTAs mit 0,5 %, die monatlich fakturiert wird.

        Ohne Reservierungskontext (``res=None``) wird nichts berechnet — lieber
        keine Provision als eine zu Unrecht (Wurzel 5). Der Satz kommt
        AUSSCHLIESSLICH aus tenants.platform_fee_bps (Wurzel 3: nie aus Client-
        Input; Wurzel 4: kein globaler Fantasie-Default) — so kann ein Betrieb die
        eigene Provision nicht drücken und ein PMS-Kunde wird nie belastet.
        """
        if res is None or not self._ist_portal_buchung(res):
            return 0
        row = (
            db.table("tenants")
            .select("platform_fee_bps")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return 0
        bps = row[0].get("platform_fee_bps")
        if bps is None:
            # Portal-Buchung ohne gesetzten Satz ist ein Datenfehler — nicht
            # still 0 kassieren (dann verdient die Plattform nichts) und nicht
            # raten. Klar fehlschlagen (Wurzel 4/5).
            raise PaymentsError(
                "Provisions-Satz (platform_fee_bps) für Portal-Buchung fehlt.",
                status_code=500,
            )
        if not 0 <= bps <= 10000:
            raise PaymentsError(
                "Provisions-Satz (platform_fee_bps) ist ungültig (0..10000).",
                status_code=500,
            )
        return int(bps)

    def _fee_cents(
        self, db: Client, tenant_id: str, amount_cents: int,
        res: dict | None = None,
    ) -> int:
        """Provisionsbetrag in Cent (Stripe application_fee) — exakte bps-Ganzzahl-
        Arithmetik, kein Float. 0 für Nicht-Marktplatz-Tenants."""
        bps = self._platform_fee_bps(db, tenant_id, res)
        if bps <= 0:
            return 0
        return amount_cents * bps // 10000

    def _donation_for(
        self, db: Client, tenant_id: str, amount_cents: int
    ) -> DonationShare | None:
        """Spendenanteil dieser Buchung (0216) — oder None, wenn der Betrieb
        keine Spende eingerichtet hat (Normalfall).

        Ein Fehler in der Spendeneinstellung darf die Buchung nicht verhindern:
        Der Gast will bezahlen, und die Spende ist eine freiwillige Zugabe des
        Gastgebers. Deshalb wird hier NICHT re-raised — der Fehler wird geloggt
        und die Buchung läuft ohne Spende weiter (best effort, wie beim
        Fee-Ledger-Reverse). Der Gastgeber sieht die fehlende Zeile in seiner
        Spendenübersicht.
        """
        try:
            return DonationsService(db=db).spende_fuer_buchung(
                tenant_id, amount_cents
            )
        except Exception as exc:  # noqa: BLE001 — Buchung darf nicht kippen
            log.warning(
                "donation_calculation_failed",
                tenant_id=tenant_id,
                error=str(exc)[:200],
            )
            return None

    def _record_donation(
        self,
        db: Client,
        *,
        reservation_id: str,
        tenant_id: str,
        spende: DonationShare | None,
        gross_cents: int,
        currency: str,
    ) -> None:
        """Spendenzeile anlegen. No-op ohne eingerichtete Spende.

        Best effort wie ``_donation_for``: Der Betrag ist bereits Teil der
        application_fee und liegt beim Plattform-Saldo — eine fehlende
        Ledger-Zeile ist ein Buchhaltungsproblem, kein Grund, die bestätigte
        Zahlung des Gastes scheitern zu lassen.
        """
        if not spende:
            return
        try:
            DonationsService(db=db).merke_spende(
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                spende=spende,
                brutto_cents=gross_cents,
                currency=currency,
            )
        except Exception as exc:  # noqa: BLE001 — Zahlung darf nicht kippen
            log.error(
                "donation_ledger_write_failed",
                reservation_id=reservation_id,
                amount_cents=spende.betrag_cents,
                error=str(exc)[:200],
            )

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
        reuse = self._reuse_pending_intent(db, reservation_id, "full", res)
        if reuse:
            return BookingPaymentResult(
                client_secret=reuse["client_secret"],
                payment_id=reuse["payment_id"],
                publishable_key=get_settings().stripe_publishable_key,
            )

        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(amount)
        # Spendenanteil (0216): geht vom Anteil des GASTGEBERS ab, nicht von der
        # Plattform-Gebühr. Da wir per Destination Charge kassieren und die
        # Plattform das Geld nie hält, muss der Betrag als Teil der
        # application_fee einbehalten werden — sonst läge er beim Gastgeber und
        # müsste zurückgeholt werden.
        spende = self._donation_for(db, tenant_id, amount_cents)
        with _stripe_errors():
            intent = sc.create_payment_intent(
                amount_cents=amount_cents,
                currency=currency,
                destination_acct=acct,
                application_fee_cents=self._fee_cents(
                    db, tenant_id, amount_cents, res
                )
                + (spende.betrag_cents if spende else 0),
                statement_descriptor=self._merchant_descriptor(db, tenant_id),
                transfer_group=_transfer_group(reservation_id),
                direct=not self._traegt_haftung(res),
                metadata={"reservation_id": reservation_id, "tenant_id": tenant_id},
                # Wurzel 2: `_reuse_pending_intent` oben ist read-then-write —
                # zwei nebenlaeufige Anfragen lesen beide „kein pending" und
                # legen beide einen Intent an. Der Key macht daraus bei Stripe
                # EINEN Intent. Der Betrag gehoert hinein: aendert sich die
                # Summe, ist es ein anderer Vorgang (sonst HTTP 400).
                idempotency_key=f"full:{reservation_id}:{amount_cents}",
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
        # Fee-Ledger (Marktplatz): auf den Gesamtbetrag eingefroren, bevor der
        # Charge bestätigt ist. No-op bei PMS-Tenants.
        self._record_platform_fee(
            db,
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            gross_cents=amount_cents,
            currency=currency,
            payment_id=payment["id"],
            gateway="stripe",
            res=res,
        )
        # Spenden-Ledger: Satz und Betrag einfrieren. Ohne diese Zeile wäre
        # später nicht mehr feststellbar, wie viel der einbehaltenen
        # application_fee der Organisation zusteht.
        self._record_donation(
            db,
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            spende=spende,
            gross_cents=amount_cents,
            currency=currency,
        )
        self._set_reservation_payment_status(db, reservation_id, "pending")
        return BookingPaymentResult(
            client_secret=intent["client_secret"],
            payment_id=payment["id"],
            publishable_key=get_settings().stripe_publishable_key,
        )

    def create_intent_for_absicht(
        self,
        *,
        absicht_id: str,
        tenant_id: str,
        betrag: float,
        waehrung: str,
    ) -> dict[str, str | None]:
        """PaymentIntent für eine Buchungsabsicht — BEVOR die Buchung existiert (0409).

        WARUM EIN EIGENER WEG statt `create_booking_payment`:
        Jener Pfad setzt eine Reservierung voraus — er lädt sie, prüft den
        Kanal, schreibt eine `payments`-Zeile mit `reservation_id` (NOT NULL)
        und friert Gebühren-/Spenden-Ledger darauf ein. Genau diese
        Reservierung gibt es hier noch nicht: Sie entsteht erst, wenn diese
        Zahlung gelingt.

        Deshalb bleibt dieser Weg bewusst schlank — nur der Intent. Alles, was
        an einer Buchung hängt (payments-Zeile, Fee-Ledger, Spende,
        Auszahlungstermin, payment_status), entsteht beim Einlösen, wenn es
        eine Buchung gibt, an die es gehört. Ein Ledger-Eintrag auf eine
        Buchung, die es nie geben wird, wäre eine Forderung ohne Gegenstand.

        Die Absicht-ID reist in den Metadaten mit — sie ist der einzige Faden
        zurück, den der Webhook hat.
        """
        db = self._db_or_fail()
        if betrag <= 0:
            raise PaymentsError("Buchungsbetrag fehlt.", status_code=422)
        if not waehrung:
            raise PaymentsError("Währung fehlt.", status_code=422)

        acct = self._connected_account(db, tenant_id)
        amount_cents = _to_cents(betrag)
        spende = self._donation_for(db, tenant_id, amount_cents)

        # DER KANAL MUSS MIT (Wurzel 4): `_fee_cents` leitet die Provision aus
        # `res["channel"]` ab und gibt ohne Reservierungskontext 0 zurück —
        # fail-closed, damit nie zu Unrecht kassiert wird. Hier ist der Kanal
        # aber BEKANNT: Eine Buchungsabsicht entsteht ausschliesslich in der
        # Marktplatz-Strecke, die Buchung wird `channel='portal'` tragen
        # (booking_engine.service). Ohne diese Angabe fiele die 8 %-Provision
        # des myBestDays-Marktplatzes lautlos auf 0 — und zwar erst beim
        # Umbau auf „Zahlung zuerst", also genau dort, wo es niemandem
        # auffiele. Kein erfundener Wert, sondern derselbe, der gleich in die
        # Reservierung geschrieben wird.
        kanal_kontext = {"channel": "portal"}
        with _stripe_errors():
            intent = sc.create_payment_intent(
                amount_cents=amount_cents,
                currency=waehrung,
                destination_acct=acct,
                application_fee_cents=self._fee_cents(
                    db, tenant_id, amount_cents, kanal_kontext
                )
                + (spende.betrag_cents if spende else 0),
                statement_descriptor=self._merchant_descriptor(db, tenant_id),
                # Die Absicht-ID als Klammer — sie wird beim Einlösen zur
                # `reservation_id`, und der `transfer_group` bleibt damit über
                # den Übergang hinweg derselbe.
                transfer_group=_transfer_group(absicht_id),
                metadata={
                    "buchungsabsicht_id": absicht_id,
                    "tenant_id": tenant_id,
                    "type": "booking_intent",
                },
                # Haftung: dieselbe Regel wie bei einer Portal-Buchung —
                # `_traegt_haftung` liest denselben Kanal.
                direct=not self._traegt_haftung(kanal_kontext),
                # Wurzel 2: dieser Pfad hatte WEDER Reuse-Pruefung NOCH Key —
                # ein Doppelklick auf „Jetzt buchen" erzeugte zwei Intents und
                # zwei `platform_fees`/`donations`-Zeilen. Die Absicht-ID ist
                # hier die Klammer (es gibt noch keine reservation_id).
                idempotency_key=f"absicht:{absicht_id}:{amount_cents}",
                client=self._stripe,
            )
        return {
            "payment_ref": intent["id"],
            "client_secret": intent["client_secret"],
            "publishable_key": get_settings().stripe_publishable_key,
            "stripe_account": acct,
        }

    # --- Buchungs-Konditionen: Anzahlung + automatische Restzahlung ----------

    def _resolve_condition(self, db: Client, res: dict) -> dict | None:
        """Die für eine Reservierung geltende Kondition (Rate-Plan, sonst
        Standard des Betriebs). None → volle Zahlung sofort.

        Die Auflösung liegt in `booking_conditions.plan`, weil der Gast-Checkout
        denselben Plan ANZEIGT, den dieser Pfad EINZIEHT — zwei Kopien wären die
        Stelle, an der Anzeige und Abbuchung auseinanderlaufen."""
        return kondition_fuer(
            db,
            tenant_id=res["tenant_id"],
            rate_plan_id=res.get("rate_plan_id"),
        )

    @staticmethod
    def _first_payment_amount(condition: dict, total: float) -> float:
        """Höhe der ersten Zahlung (Anzahlung) — geteilte Regel, siehe plan.py."""
        return erste_zahlung(condition, total)

    @staticmethod
    def _balance_due_at(condition: dict, check_in: date) -> datetime | None:
        """Fälligkeit der Restzahlung als Zeitpunkt (UTC-Mitternacht). Das Datum
        selbst kommt aus der geteilten Regel; hier wird nur die Zeitzone
        angeheftet, weil die Zahlungszeile einen Zeitstempel trägt."""
        due_date = restzahlung_faellig_am(condition, check_in)
        if due_date is None:
            return None
        return datetime(due_date.year, due_date.month, due_date.day, tzinfo=UTC)

    def create_booking_payment_scheduled(
        self, *, reservation_id: str
    ) -> BookingPaymentResult:
        """Wie create_booking_payment, aber konditionsgesteuert: gilt für die
        Buchung ein Zahlungsplan mit Anzahlung, wird NUR die Anzahlung kassiert,
        die Karte für die spätere Restzahlung gespeichert und eine 'balance'-Zeile
        mit Fälligkeit geplant. Ohne Kondition/Split → volle Zahlung (Delegation
        an den bestehenden Pfad, unverändertes Verhalten)."""
        db = self._db_or_fail()
        res = self._load_reservation(db, reservation_id)
        self._require_own_channel(res)
        condition = self._resolve_condition(db, res)
        total = float(res["total_amount"] or 0)
        if condition is None or self._first_payment_amount(condition, total) >= total:
            # Keine Anzahlung → voller Betrag sofort (bestehender Pfad).
            return self.create_booking_payment(reservation_id=reservation_id)

        if total <= 0:
            raise PaymentsError("Buchungsbetrag fehlt.", status_code=422)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)

        # Idempotenz: offene Anzahlung wiederverwenden (Doppelklick/Reload/Retry).
        reuse = self._reuse_pending_intent(db, reservation_id, "down_payment", res)
        if reuse:
            return BookingPaymentResult(
                client_secret=reuse["client_secret"],
                payment_id=reuse["payment_id"],
                publishable_key=get_settings().stripe_publishable_key,
            )

        tenant_id = res["tenant_id"]
        acct = self._connected_account(db, tenant_id)
        down = self._first_payment_amount(condition, total)
        down_cents = _to_cents(down)
        # Customer anlegen, damit die Karte für die Restzahlung gespeichert werden
        # kann (off-session-Charge braucht einen Customer + gespeicherte PM).
        with _stripe_errors():
            customer = sc.get_or_create_customer(
                email=res.get("guest_email"),
                metadata={"reservation_id": reservation_id, "tenant_id": tenant_id},
                client=self._stripe,
            )
            intent = sc.create_payment_intent(
                amount_cents=down_cents,
                currency=currency,
                destination_acct=acct,
                application_fee_cents=self._fee_cents(
                    db, tenant_id, down_cents, res
                ),
                customer=customer,
                save_payment_method=True,  # Karte für die Restzahlung merken
                statement_descriptor=self._merchant_descriptor(db, tenant_id),
                transfer_group=_transfer_group(reservation_id),
                direct=not self._traegt_haftung(res),
                metadata={
                    "reservation_id": reservation_id,
                    "tenant_id": tenant_id,
                    "type": "down_payment",
                },
                # Wurzel 2 wie bei der Vollzahlung — der Reuse-Guard allein ist
                # nicht rennsicher.
                idempotency_key=f"down:{reservation_id}:{down_cents}",
                client=self._stripe,
            )
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=down,
            currency=currency,
            ptype="down_payment",
            gateway_ref=intent["id"],
            status="pending",
        )
        # Fee-Ledger EINMAL auf den GESAMTbetrag (nicht die Anzahlung) einfrieren:
        # die je-Charge application_fee (down + balance) summiert sich real, die
        # eine Ledger-Zeile hält den Soll-Wert auf total (UNIQUE reservation_id).
        self._record_platform_fee(
            db,
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            gross_cents=_to_cents(total),
            currency=currency,
            payment_id=payment["id"],
            gateway="stripe",
            res=res,
        )
        # Customer schon jetzt an der Anzahlung vermerken; die payment_method-ID
        # kommt erst nach Bestätigung (Webhook/Confirm) und wird dann nachgetragen.
        self._update_payment(db, payment["id"], {"stripe_customer_id": customer})
        # Restzahlung planen (eine 'balance'-Zeile mit Fälligkeit) — der Worker
        # chargt sie off-session, sobald sie fällig ist.
        self._schedule_balance(
            db,
            reservation_id=reservation_id,
            amount=round(total - down, 2),
            currency=currency,
            condition=condition,
            check_in=res.get("check_in"),
            customer=customer,
        )
        self._set_reservation_payment_status(db, reservation_id, "pending")
        return BookingPaymentResult(
            client_secret=intent["client_secret"],
            payment_id=payment["id"],
            publishable_key=get_settings().stripe_publishable_key,
        )

    def _schedule_balance(
        self,
        db: Client,
        *,
        reservation_id: str,
        amount: float,
        currency: str,
        condition: dict,
        check_in: str | date | None,
        customer: str,
    ) -> None:
        """Eine geplante Restzahlung ('balance', scheduled) mit Fälligkeit anlegen.
        Ohne gültiges Fälligkeitsdatum wird nichts geplant (dann bleibt es bei der
        Anzahlung; der Rest wäre manuell zu kassieren)."""
        if amount <= 0 or not check_in:
            return
        check_in_date = (
            check_in if isinstance(check_in, date)
            else date.fromisoformat(str(check_in))
        )
        due_at = self._balance_due_at(condition, check_in_date)
        if due_at is None:
            return
        # Idempotenz: nur EINE geplante Restzahlung je Buchung.
        existing = (
            db.table("payments")
            .select("id")
            .eq("reservation_id", reservation_id)
            .eq("type", "balance")
            .limit(1)
            .execute()
        ).data
        if existing:
            return
        db.table("payments").insert(
            {
                "reservation_id": reservation_id,
                "amount": amount,
                "currency": currency,
                "type": "balance",
                "gateway": "stripe",
                # gateway_ref wird erst beim Charge gesetzt; Platzhalter leer.
                "gateway_ref": "",
                "status": "pending",
                "stripe_customer_id": customer,
                "due_at": due_at.isoformat(),
                "scheduled_status": "scheduled",
            }
        ).execute()

    def charge_due_balance(self, *, payment_id: str) -> dict:
        """Eine fällige, geplante Restzahlung off-session belasten (vom Worker
        aufgerufen). Fail-closed (Wurzel 5): bei authentication_required (3DS)
        wird die Zeile auf 'needs_action' gesetzt (Gast muss on-session bestätigen),
        bei Ablehnung auf 'failed' — NIE still als bezahlt markieren."""
        db = self._db_or_fail()
        rows = (
            db.table("payments")
            .select("*")
            .eq("id", payment_id)
            .eq("type", "balance")
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise PaymentsError("Restzahlung nicht gefunden.", status_code=404)
        bal = rows[0]
        if bal.get("scheduled_status") != "scheduled":
            # Schon in Bearbeitung/erledigt → Idempotenz-Guard (Wurzel 2).
            return {"payment_id": payment_id, "status": bal.get("scheduled_status")}
        pm = bal.get("stripe_payment_method_id")
        customer = bal.get("stripe_customer_id")
        if not pm or not customer:
            self._update_payment(
                db, payment_id, {"scheduled_status": "failed"}
            )
            raise PaymentsError(
                "Keine gespeicherte Karte für die Restzahlung.", status_code=409
            )
        res = self._load_reservation(db, bal["reservation_id"])
        # Gate: nur wenn der Betrieb den automatischen Einzug geplanter Zahlungen
        # aktiviert hat. Sonst bleibt die Zeile 'scheduled' (Gast zahlt per Link/
        # Erinnerung) — kein automatischer off-session-Charge (Wurzel 5).
        if not self._settings_flag(db, res["tenant_id"], "auto_charge_scheduled"):
            return {"payment_id": payment_id, "status": "scheduled", "skipped": True}
        acct = self._connected_account(db, res["tenant_id"])
        amount_cents = _to_cents(float(bal["amount"]))
        # Den Stripe-Client VOR dem Claim auflösen. Er stand früher als
        # `client=self._stripe` unten in der Argumentliste und wurde damit erst
        # AUSGEWERTET, nachdem die Zeile bereits auf 'charging' stand — ein
        # fehlender STRIPE_SECRET_KEY lief dann in das `except PaymentsError`
        # unten und schrieb 'failed'. Die Zeile war nie bei Stripe, wurde aber
        # abgeschrieben, und der stündliche Tick greift sie nie wieder auf
        # (er liest nur 'scheduled'). Hier oben bleibt sie unangetastet
        # 'scheduled' und läuft nach dem Setzen der Variablen von selbst weiter
        # (Wurzel 1: kein halber Gegenzustand, Wurzel 5: kein stiller Ausfall).
        stripe = self._stripe
        self._update_payment(db, payment_id, {"scheduled_status": "charging"})
        idem_key = f"balance:{payment_id}"
        try:
            with _stripe_errors():
                intent = sc.create_payment_intent(
                    amount_cents=amount_cents,
                    currency=bal["currency"],
                    destination_acct=acct,
                    application_fee_cents=self._fee_cents(
                        db, res["tenant_id"], amount_cents, res
                    ),
                    customer=customer,
                    payment_method=pm,
                    off_session=True,
                    statement_descriptor=self._merchant_descriptor(
                        db, res["tenant_id"]
                    ),
                    transfer_group=_transfer_group(bal["reservation_id"]),
                    direct=not self._traegt_haftung(res),
                    idempotency_key=idem_key,
                    metadata={
                        "reservation_id": bal["reservation_id"],
                        "type": "balance",
                    },
                    client=stripe,
                )
        except PaymentsConfigError:
            # Zweiter Riegel für denselben Denkfehler: taucht ein Konfigurations-
            # mangel doch noch INNERHALB des Aufrufs auf, wird die Zeile nicht
            # abgeschrieben, sondern der Claim zurückgenommen — sonst bliebe sie
            # für immer auf 'charging' liegen (Wurzel 1).
            self._update_payment(db, payment_id, {"scheduled_status": "scheduled"})
            raise
        except PaymentsError as exc:
            # authentication_required (3DS) vs. echte Ablehnung unterscheiden.
            needs_action = "authentication" in (exc.message or "").lower()
            self._update_payment(
                db,
                payment_id,
                {"scheduled_status": "needs_action" if needs_action else "failed"},
            )
            raise
        self._update_payment(
            db,
            payment_id,
            {
                "gateway_ref": intent["id"],
                "status": "succeeded",
                "scheduled_status": "done",
            },
        )
        self._set_reservation_payment_status(db, bal["reservation_id"], "paid")
        return {"payment_id": payment_id, "status": "done"}

    def due_balance_payment_ids(self, *, now: datetime | None = None) -> list[str]:
        """IDs aller fälligen, noch offenen Restzahlungen (für den Worker). Global
        über alle Tenants — der Worker ruft je ID charge_due_balance auf."""
        db = self._db_or_fail()
        cutoff = (now or datetime.now(UTC)).isoformat()
        rows = (
            db.table("payments")
            .select("id")
            .eq("type", "balance")
            .eq("scheduled_status", "scheduled")
            .lte("due_at", cutoff)
            .execute()
        ).data or []
        return [r["id"] for r in rows]

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
        reuse = self._reuse_pending_intent(db, reservation_id, "deposit", res)
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
                statement_descriptor=self._merchant_descriptor(db, tenant_id),
                # Auch die Kaution braucht die Klammer: im Separate-Charges-
                # Modus läge sie sonst unzuordenbar auf dem Plattform-Saldo.
                transfer_group=_transfer_group(reservation_id),
                direct=not self._traegt_haftung(res),
                metadata={"reservation_id": reservation_id, "type": "deposit"},
                # Wurzel 2: eine doppelt angelegte Kaution blockiert echtes
                # Guthaben auf der Karte des Gastes (capture_method="manual").
                idempotency_key=f"deposit:{reservation_id}:{amount_cents}",
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
                payment["gateway_ref"],
                amount_cents,
                direct_acct=self._direct_acct(
                    db, self._load_reservation(db, payment["reservation_id"])
                ),
                client=self._stripe,
            )
        self._update_payment(db, payment_id, {"status": "succeeded"})
        return {"payment_id": payment_id, "status": result["status"]}

    def release_deposit(self, ctx: AuthContext, payment_id: str) -> dict:
        """Kaution freigeben (Vorautorisierung stornieren) — kein Geldfluss."""
        db, tenant_id = self._require(ctx)
        payment = self._load_payment(db, payment_id, tenant_id, expect_type="deposit")
        with _stripe_errors():
            result = sc.cancel_payment_intent(
                payment["gateway_ref"],
                direct_acct=self._direct_acct(
                    db, self._load_reservation(db, payment["reservation_id"])
                ),
                client=self._stripe,
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
        already_refunded = self._refunded_sum(
            db, payment["reservation_id"], payment_id
        )
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
        # Gateway-spezifisch erstatten. Stripe: refund über gateway_ref (Cent).
        # PayPal: refund über die capture_id (Major-Unit-String) im Namen des
        # Verkäufers, inkl. anteiliger Provisions-Rückgabe.
        if payment.get("gateway") == "paypal":
            refund_id = self._refund_paypal(
                db, payment, refund_amount, is_partial=amount is not None
            )
        else:
            amount_cents = _to_cents(refund_amount) if amount is not None else None
            # Deterministischer Idempotenz-Key (Wurzel 2): zwei nebenläufige Refunds
            # (Doppelklick/Retry) passieren beide den Status-Guard oben, bevor einer
            # den Status setzt — nur Stripes idempotency_key verhindert das zweite
            # Geldereignis. Betrag im Key, damit eine legitime spätere Teilerstattung
            # anderer Höhe nicht fälschlich denselben Key trifft.
            idem_key = f"refund:{payment_id}:{amount_cents if amount_cents else 'full'}"
            # DER GAST GEHT VOR. Die Rückholung beim Betrieb ist ein zweiter,
            # getrennter Schritt — nie eine Bedingung für die Erstattung.
            #
            # Grund: Mit reverse_transfer=True am Refund scheitert der GANZE
            # Refund, wenn der Betrieb kein Guthaben mehr hat (Stripe-Doku:
            # "the refund request returns an error instead of creating a refund
            # with a pending status"). Der Gast bekäme dann gar nichts.
            #
            # Bei Separate Charges ist die Rückholung ohnehin gegenstandslos,
            # solange noch kein Transfer lief — das Geld liegt bei uns.
            #
            # refund_application_fee bewusst NICHT gesetzt: Das Flag würde die
            # Provision an den GASTGEBER schieben, nicht sie uns erhalten. Wie
            # bei Booking.com bleibt die Provision bei der Plattform — der
            # Vermittlungsaufwand ist entstanden, unabhängig vom Storno.
            with _stripe_errors():
                result = sc.refund(
                    payment["gateway_ref"], amount_cents,
                    client=self._stripe, idempotency_key=idem_key,
                    reverse_transfer=False,
                    # PMS: Der Intent gehört dem Betrieb, die Erstattung geht
                    # aus SEINEM Saldo. Bei 0 % Provision genau richtig.
                    direct_acct=self._direct_acct(
                    db, self._load_reservation(db, payment["reservation_id"])
                ),
                )
            refund_id = result["id"]
            # Erst jetzt zurückholen, was schon draußen ist. Schlägt es fehl
            # (kein Guthaben), wird daraus eine Verrechnungsforderung — der
            # nächste Transfer dieses Betriebs wird gekürzt. Nie ein Bankeinzug.
            self._hole_zurueck_oder_verrechne(
                db,
                payment=payment,
                refund_cents=_to_cents(refund_amount),
            )
        self._insert_payment(
            db,
            reservation_id=payment["reservation_id"],
            amount=refund_amount,
            currency=payment.get("currency"),
            ptype="refund",
            gateway_ref=refund_id,
            status="succeeded",
            gateway=payment.get("gateway", "stripe"),
            # Bezug zur erstatteten Zahlung (0313): ohne ihn rechnet
            # `_refunded_sum` buchungsweit und liefert bei Zahlungsplänen
            # falsche Grenzen (siehe dort).
            extra={"parent_payment_id": payment_id},
        )
        # Voll erstattet, sobald die Summe aller Erstattungen den Ursprungsbetrag
        # erreicht (nicht nur wenn EINE Erstattung >= voller Betrag ist).
        is_full = (already_refunded + refund_amount) >= full_amount - 1e-9
        status_val = "refunded" if is_full else "partially_refunded"
        self._update_payment(db, payment_id, {"status": status_val})
        # Die BUCHUNG ist erst erstattet, wenn ALLE ihre Zahlungen es sind —
        # der Status EINER Zahlung darf nicht auf die Reservierung durchschlagen.
        # Sonst gilt bei einem Zahlungsplan die ganze Buchung als 'refunded',
        # sobald nur die Anzahlung erstattet ist, während die eingezogene
        # Restzahlung noch offen beim Betrieb liegt.
        self._set_reservation_payment_status(
            db,
            payment["reservation_id"],
            self._reservierungs_erstattungsstatus(
                db, payment["reservation_id"], payment_id, status_val
            ),
        )
        # Fee-Gegenbuchung NUR bei PayPal: Dort fließt die Provision durch
        # platform_fee_refund wirklich zurück. Bei Stripe bleibt sie bei der
        # Plattform (siehe _reverse_platform_fee) — eine Gegenbuchung würde den
        # Ledger vom echten Geldfluss entkoppeln. Best-effort (Wurzel 5).
        if payment.get("gateway") == "paypal":
            try:
                self._reverse_platform_fee(
                    db,
                    payment["reservation_id"],
                    refunded_cents=_to_cents(refund_amount),
                )
            except Exception:  # noqa: BLE001 — Audit-Spiegel, kein Hauptpfad
                log.warning(
                    "platform_fee_reverse_failed",
                    reservation_id=payment["reservation_id"],
                )
        return {"payment_id": payment_id, "refund_id": refund_id}

    def _hole_zurueck_oder_verrechne(
        self, db: Client, *, payment: dict, refund_cents: int
    ) -> None:
        """Erstatteten Betrag beim Betrieb zurückholen — oder verrechnen.

        DREISTUFIG, in dieser Reihenfolge (Airbnb-Modell):

        1. Ist der Transfer noch gar nicht gelaufen (Separate Charges, Storno
           vor Checkout), gibt es nichts zurückzuholen — das Geld liegt bei uns.
        2. Sonst Transfer-Reversal versuchen. Klappt es, ist der Fall erledigt.
        3. Klappt es nicht (Betrieb hat das Geld schon abgezogen → Stripe
           antwortet ``balance_insufficient``), wird daraus ein
           Verrechnungsposten: Die nächste Auszahlung wird gekürzt. NIE ein
           Einzug vom Bankkonto des Betriebs.

        Der Gast hat sein Geld an dieser Stelle bereits erhalten — diese Methode
        darf den Storno deshalb nie kippen (Wurzel 5). Fehler landen im Ledger,
        nicht in einer Exception.
        """
        if refund_cents <= 0:
            return
        reservation_id = payment["reservation_id"]
        currency = payment.get("currency")
        if not currency:
            # Ohne Währung kein Posten — sonst stünde eine Forderung ohne
            # Einheit im Ledger (Wurzel 4). Fällt im Monitoring auf.
            log.warning("refund_recovery_no_currency", reservation_id=reservation_id)
            return

        # Lazy: payouts.service importiert seinerseits payments.stripe_client —
        # ein Modul-Import hier schlösse den Zyklus (ADR-0016, Slice-Grenzen).
        from src.features.payouts.service import (  # noqa: PLC0415
            PayoutsService,
        )

        res = self._load_reservation(db, reservation_id)
        tenant_id = res["tenant_id"]

        if not self._traegt_haftung(res):
            # Direct Charge: Das Geld war nie bei uns, der Refund lief
            # bereits aus dem Saldo des Betriebs. Es gibt nichts zurückzuholen
            # und nichts zu verrechnen — es existiert gar keine Auszahlung.
            log.info("refund_direct_charge_ohne_payout", reservation_id=reservation_id)
            return
        payouts = PayoutsService(db=db)

        zeile = payouts.transfer_zu_buchung(reservation_id)
        # Die Frage ist NICHT "lief unser Transfer?", sondern "hat der Betrieb
        # das Geld?". Bei einer Destination Charge hat er es aus dem Charge —
        # ganz ohne Transfer-Zeile. Beides muss verneint sein, damit Stufe 1
        # greift, sonst bliebe der Betrag beim Betrieb und die Plattform trüge
        # die Erstattung still allein.
        getrennt = get_settings().stripe_separate_transfers
        nichts_geflossen = getrennt and not (
            zeile and zeile.get("stripe_transfer_id")
        )
        if nichts_geflossen:
            # Stufe 1: Geld liegt noch bei uns. Geplante Auszahlung stoppen,
            # damit sie nicht später doch noch für eine stornierte Buchung
            # freigibt (Wurzel 1 — Gegenzustand pflegen).
            payouts.storniere(reservation_id)
            log.info("refund_no_transfer_yet", reservation_id=reservation_id)
            return

        if zeile:
            # Auch wenn zurückgeholt wird: die geplante Auszahlung darf nicht
            # stehen bleiben, sonst zahlt der Lauf die stornierte Buchung aus.
            payouts.storniere(reservation_id)

        if not zeile or not zeile.get("stripe_transfer_id"):
            # Destination Charge: kein eigener Transfer, den man umkehren
            # könnte — der Betrieb hat das Geld trotzdem. Direkt verrechnen.
            payouts.verrechne_storno(
                reservation_id=reservation_id,
                tenant_id=tenant_id,
                betrag_cents=refund_cents,
                currency=currency,
            )
            return

        # Stufe 2: zurückholen versuchen.
        try:
            with _stripe_errors():
                sc.reverse_transfer(
                    zeile["stripe_transfer_id"],
                    amount_cents=refund_cents,
                    client=self._stripe,
                    idempotency_key=f"reversal:{payment['id']}:{refund_cents}",
                )
            log.info(
                "refund_transfer_reversed",
                reservation_id=reservation_id,
                amount_cents=refund_cents,
            )
            return
        except PaymentsError as exc:
            # Stufe 3: nicht zurückholbar → Forderung. Nur der erwartete Fall
            # (kein Guthaben) wird verrechnet; alles andere bleibt sichtbar.
            log.warning(
                "refund_reversal_failed",
                reservation_id=reservation_id,
                error=exc.message[:150],
            )

        payouts.verrechne_storno(
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            betrag_cents=refund_cents,
            currency=currency,
        )

    def _refund_paypal(
        self, db: Client, payment: dict, refund_amount: float, *, is_partial: bool
    ) -> str:
        """PayPal-Refund über die capture_id im Namen des Verkäufers. Gibt die
        Provision anteilig zurück (NICHT automatisch bei PayPal — muss explizit
        gesetzt werden). Fee-Anteil = gleicher Prozentsatz wie beim Charge, auf den
        erstatteten Betrag angewandt; Währung == Transaktionswährung (Wurzel 4)."""
        capture_id = payment.get("paypal_capture_id")
        if not capture_id:
            raise PaymentsError(
                "Keine PayPal-Capture-ID zur Zahlung (noch nicht abgeschlossen?).",
                status_code=409,
            )
        currency = payment.get("currency")
        res = self._load_reservation(db, payment["reservation_id"])
        seller = self._paypal_seller(db, res["tenant_id"])
        fee_refund = (
            self._fee_amount(db, res["tenant_id"], refund_amount, res)
            if currency
            else None
        )
        try:
            result = self._paypal().refund_capture(
                capture_id=capture_id,
                seller_merchant_id=seller,
                amount=refund_amount if is_partial else None,
                currency=currency,
                platform_fee_refund=fee_refund,
                request_id=f"refund:{payment['id']}:{refund_amount}",
            )
        except PayPalError as exc:
            raise PaymentsError(exc.message, status_code=exc.status_code) from exc
        return result.get("id") or capture_id

    # --- Storno-Refund (policy-gesteuert) ------------------------------------

    @staticmethod
    def _refund_percent_for(condition: dict, days_before_arrival: int) -> float:
        """Erstattungs-Prozentsatz aus der Kondition für einen Storno-Zeitpunkt.

          * non_refundable → 0 %
          * refundable     → 100 %
          * partial        → höchste passende Staffel-Regel (Regel greift, wenn
            mindestens `days_before_arrival` Tage vor Anreise storniert wird).
            Keine passende Regel → 0 %.
        """
        mode = condition.get("cancellation_mode")
        if mode == "refundable":
            return 100.0
        if mode != "partial":
            return 0.0
        best = 0.0
        for rule in condition.get("refund_rules") or []:
            if days_before_arrival >= int(rule.get("days_before_arrival", 0)):
                best = max(best, float(rule.get("refund_percent", 0)))
        return best

    def refund_for_cancellation(
        self, ctx: AuthContext, *, reservation_id: str, days_before_arrival: int
    ) -> dict | None:
        """Bei Storno: die geltende Kondition auswerten und den policy-konformen
        Refund auslösen. Erstattet den Prozentsatz der bereits GEZAHLTEN Beträge
        (full + down_payment + balance; NICHT Kaution/Refund). None, wenn nichts zu erstatten
        ist (0 %, keine Zahlung, keine Kondition). Fehler werden hochgereicht — der
        Aufrufer (cancel) behandelt sie best-effort, damit ein Refund-Problem den
        bereits vollzogenen Storno nicht zurückdreht."""
        db, tenant_id = self._require(ctx)
        # Gate: nur wenn der Betrieb die automatische Storno-Rückerstattung
        # aktiviert hat. Sonst wird der policy-Betrag nur berechnet/angezeigt und
        # manuell ausgelöst (kein automatischer Geldabfluss, Wurzel 5).
        if not self._settings_flag(db, tenant_id, "auto_refund_on_cancel"):
            return None
        res = self._load_reservation(db, reservation_id)
        if res["tenant_id"] != tenant_id:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        condition = self._resolve_condition(db, res)
        if condition is None:
            return None
        pct = self._refund_percent_for(condition, days_before_arrival)
        if pct <= 0:
            return None
        # Erstattbare Zahlungen: erfolgreiche Gastzahlungen (voll + Anzahlung +
        # eingezogene Restzahlung). `balance` MUSS dabei sein: bei einem
        # Zahlungsplan zieht der Worker die Restzahlung als eigene Zeile ein
        # (`_schedule_balance` → `charge_due_balance`, status='succeeded').
        # Ohne sie erstattet ein 100-%-Storno einer 500er-Buchung nur die
        # Anzahlung — der eingezogene Rest bliebe beim Betrieb liegen.
        # Kaution (`deposit`) und Erstattungen selbst bleiben bewusst außen vor.
        pays = (
            db.table("payments")
            .select("id, amount, status, type")
            .eq("reservation_id", reservation_id)
            .in_("type", ["full", "down_payment", "balance"])
            .in_("status", ["succeeded", "partially_refunded"])
            .execute()
        ).data or []
        results = []
        for p in pays:
            refund_amount = round(float(p["amount"]) * pct / 100.0, 2)
            if refund_amount <= 0:
                continue
            # refund_payment prüft selbst gegen bereits Erstattetes (Idempotenz).
            results.append(
                self.refund_payment(ctx, p["id"], amount=refund_amount)
            )
        return {"refund_percent": pct, "refunds": results} if results else None

    # --- Helfer (DB) ---------------------------------------------------------

    # =========================================================================
    # PayPal (Complete Payments Platform / Multiparty)
    # =========================================================================

    @staticmethod
    def _paypal() -> PayPalClient:
        return PayPalClient()

    def _fee_amount(
        self, db: Client, tenant_id: str, amount: float,
        res: dict | None = None,
    ) -> float:
        """Plattform-Provision als Betrag (Major-Unit, für PayPal) — DERSELBE
        kanalbasierte bps-Kern wie Stripe (_platform_fee_bps): nur
        Portal-Buchungen zahlen, Satz aus tenants.platform_fee_bps. Eine einzige
        Fee-Quelle (kein zweiter globaler Prozentwert, Wurzel 4)."""
        bps = self._platform_fee_bps(db, tenant_id, res)
        if bps <= 0:
            return 0.0
        return round(amount * bps / 10000.0, 2)

    # =========================================================================
    # platform_fees-Ledger (0182) — auditierbarer Spiegel der einbehaltenen Fee
    # =========================================================================
    def _record_platform_fee(  # noqa: PLR0913 — Fee-Snapshot braucht alle Felder
        self,
        db: Client,
        *,
        reservation_id: str,
        tenant_id: str,
        gross_cents: int,
        currency: str,
        payment_id: str | None,
        gateway: str,
        res: dict | None = None,
    ) -> None:
        """Fee-Zeile für eine Portal-Buchung anlegen (status='pending'), BEVOR
        der Charge-Seiteneffekt endgültig ist. No-op für alle anderen Kanäle
        (bps=0) — ``res`` MUSS mitgegeben werden, sonst wäre der Ledger blind
        für den Kanal und stünde im Widerspruch zum tatsächlichen Charge.

        Split-Payment: die Fee wird EINMAL auf den GESAMTbetrag (gross_cents
        = total_amount) eingefroren — UNIQUE(reservation_id) hält genau eine Zeile,
        egal wie viele Chargen (Anzahlung + Rest) folgen.

        Idempotenz (Wurzel 2): upsert on_conflict=reservation_id, ignore_duplicates
        — eine bereits gebuchte Fee ('charged'/'reversed'/'pending') wird NICHT
        überschrieben. Währung Pflicht (Wurzel 4): fehlt sie, ist das ein Datenfehler.
        """
        bps = self._platform_fee_bps(db, tenant_id, res)
        if bps <= 0:
            return
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)
        fee_cents = gross_cents * bps // 10000
        db.table("platform_fees").upsert(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "payment_id": payment_id,
                "fee_bps": bps,
                "gross_amount_cents": gross_cents,
                "fee_amount_cents": fee_cents,
                "currency": currency,
                "gateway": gateway,
                "status": "pending",
            },
            on_conflict="reservation_id",
            ignore_duplicates=True,
        ).execute()

        # Beteiligung der Co-Gastgeber — ZUSÄTZLICH zur Plattform-Gebühr und
        # zulasten des Gastgebers. Bewusst hier, direkt an der Fee-Zeile: Das
        # ist der eine Punkt, den alle Zahlungswege durchlaufen (Vollzahlung,
        # Anzahlung, Restzahlung), und der Plattformanteil ist genau hier
        # bekannt.
        self._record_cohost_payouts(
            db,
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            gross_cents=gross_cents,
            currency=currency,
            plattform_bps=bps,
        )

    def _record_cohost_payouts(
        self,
        db: Client,
        *,
        reservation_id: str,
        tenant_id: str,
        gross_cents: int,
        currency: str,
        plattform_bps: int,
    ) -> None:
        """Beteiligungen der Co-Gastgeber dieser Buchung festhalten.

        Best-effort gegenüber dem Zahlungspfad: Ein Problem hier darf die
        Zahlung des Gastes NICHT verhindern — der Gast hat mit der internen
        Aufteilung nichts zu tun. Der Fehler wird geloggt und ist über die
        fehlende cohost_payouts-Zeile sichtbar.

        AUSNAHME: BeteiligungFehler (z. B. „Anteile übersteigen den Betrag")
        wird durchgereicht. Das ist ein echter Konfigurationsfehler des
        Gastgebers, und ihn zu verschlucken hieße, still eine falsche
        Aufteilung zu buchen (Wurzel 5).
        """
        res = (
            db.table("reservations")
            .select("property_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res or not res[0].get("property_id"):
            return
        try:
            CohostPayoutService(db).record_for_reservation(
                reservation_id=reservation_id,
                tenant_id=tenant_id,
                property_id=res[0]["property_id"],
                brutto_cents=gross_cents,
                currency=currency,
                plattform_bps=plattform_bps,
            )
        except BeteiligungFehler:
            raise
        except Exception as exc:  # noqa: BLE001 — Zahlung nicht blockieren
            log.warning(
                "cohost_payouts_record_failed",
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _mark_platform_fee_charged(
        self, db: Client, reservation_id: str, *, gateway_fee_ref: str | None = None
    ) -> None:
        """Fee-Zeile einer Buchung von 'pending' auf 'charged' setzen (Webhook
        payment_intent.succeeded). Status-Guard: nur 'pending' wird bewegt, ein
        zweiter Webhook-Redelivery ist ein No-op (Wurzel 2). 'reversed' bleibt."""
        patch: dict[str, Any] = {"status": "charged"}
        if gateway_fee_ref:
            patch["gateway_fee_ref"] = gateway_fee_ref
        db.table("platform_fees").update(patch).eq(
            "reservation_id", reservation_id
        ).eq("status", "pending").execute()

        # Jetzt ist das Geld da — die Co-Gastgeber können ausgezahlt werden.
        # Best-effort: Schlägt ein Transfer fehl (Konto noch nicht bereit,
        # Saldo noch nicht verfügbar), bleibt die Zeile 'pending' mit
        # Fehlergrund und ein späterer Lauf holt sie nach. Der Zahlungs-Webhook
        # darf davon nie kippen — sonst würde Stripe ihn endlos wiederholen.
        try:
            CohostPayoutService(db).pay_pending(
                reservation_id=reservation_id, charge_id=gateway_fee_ref
            )
        except Exception as exc:  # noqa: BLE001 — Webhook nicht kippen
            log.warning(
                "cohost_payouts_pay_failed",
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _mark_platform_fee_failed(self, db: Client, reservation_id: str) -> None:
        """Fee-Zeile auf 'failed' setzen (Charge endgültig fehlgeschlagen — Fee ist
        nie geflossen). Nur aus 'pending' (Wurzel 2)."""
        db.table("platform_fees").update({"status": "failed"}).eq(
            "reservation_id", reservation_id
        ).eq("status", "pending").execute()

    def _reverse_platform_fee(
        self, db: Client, reservation_id: str, *, refunded_cents: int
    ) -> None:
        """Fee-Gegenbuchung im Ledger (Wurzel 1) — NUR für Gateways, die die
        Provision tatsächlich zurückgeben.

        WICHTIG, unterschiedliches Verhalten je Gateway:

        * **Stripe**: Die Provision BLEIBT bei der Plattform (wie Booking.com,
          das Provision auch auf Stornogebühren erhebt). ``refund`` setzt
          ``refund_application_fee`` bewusst NICHT — das Flag würde die
          Provision an den Gastgeber schieben, nicht sie uns erhalten. Für
          Stripe darf hier also NICHTS gegengebucht werden, sonst weicht der
          Ledger vom echten Geldfluss ab.
        * **PayPal**: Dort wird ``platform_fee_refund`` explizit gesetzt, das
          Geld fließt wirklich zurück → Gegenbuchung ist korrekt.

        Best-effort im Refund-Pfad (Wurzel 5): ein Ledger-Fehler darf den
        bereits erfolgten Geld-Refund nicht kippen."""
        row = (
            db.table("platform_fees")
            .select("gross_amount_cents, fee_amount_cents, reversed_amount_cents")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return
        gross = int(row[0]["gross_amount_cents"] or 0)
        fee = int(row[0]["fee_amount_cents"] or 0)
        already = int(row[0]["reversed_amount_cents"] or 0)
        if gross <= 0 or fee <= 0:
            return
        # Anteil der erstatteten Summe an der Gesamtbuchung → derselbe Anteil der Fee.
        to_reverse = min(refunded_cents * fee // gross, fee - already)
        if to_reverse <= 0:
            return
        new_reversed = already + to_reverse
        db.table("platform_fees").update(
            {
                "reversed_amount_cents": new_reversed,
                "status": "reversed" if new_reversed >= fee else "charged",
            }
        ).eq("reservation_id", reservation_id).execute()

        # Gegenzustand für die Co-Gastgeber (Wurzel 1): Bei VOLLER Erstattung
        # müssen auch deren Anteile zurück — sonst trüge der Gastgeber die
        # Erstattung allein, während der Co-Gastgeber seinen Anteil behält.
        #
        # Nur bei voller Erstattung: Eine anteilige Rückbuchung von Transfers
        # ist ohne klare Regel, wer wie viel trägt, nicht seriös zu entscheiden
        # — das wäre Raten (Wurzel 4). Teilerstattungen bleiben deshalb bewusst
        # dem Gastgeber überlassen und sind an der Zeile sichtbar.
        if new_reversed >= fee:
            try:
                svc = CohostPayoutService(db)
                svc.cancel_for_reservation(reservation_id)
                svc.reverse_for_reservation(reservation_id)
            except Exception as exc:  # noqa: BLE001 — Refund nicht kippen
                log.warning(
                    "cohost_payout_reversal_failed",
                    reservation_id=reservation_id,
                    error=str(exc)[:200],
                )

    def platform_fee_summary(self, ctx: AuthContext) -> PlatformFeeSummary:
        """Provisions-Übersicht des Marktplatz-Gastgebers (eigener Tenant). RLS +
        explizit tenant-gescopet (Wurzel 3). Gemischte Währungen → currency=None."""
        db, tenant_id = self._require(ctx)
        rows = (
            db.table("platform_fees")
            .select(
                "id, reservation_id, fee_bps, gross_amount_cents, "
                "fee_amount_cents, reversed_amount_cents, currency, gateway, "
                "status, created_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        fee_rows = [
            PlatformFeeRow(
                id=r["id"],
                reservation_id=r["reservation_id"],
                fee_bps=int(r["fee_bps"]),
                gross_amount_cents=int(r["gross_amount_cents"]),
                fee_amount_cents=int(r["fee_amount_cents"]),
                reversed_amount_cents=int(r["reversed_amount_cents"] or 0),
                currency=r["currency"],
                gateway=r.get("gateway") or "stripe",
                status=r["status"],
                created_at=str(r["created_at"]),
            )
            for r in rows
        ]
        currencies = {r.currency for r in fee_rows}
        # Nur charged/reversed zählen als real geflossene Provision (pending/failed
        # nicht) — sonst zeigt die Summe Geld, das nie eingezogen wurde.
        counted = [r for r in fee_rows if r.status in ("charged", "reversed")]
        total_fee = sum(r.fee_amount_cents for r in counted)
        total_rev = sum(r.reversed_amount_cents for r in counted)
        return PlatformFeeSummary(
            currency=next(iter(currencies)) if len(currencies) == 1 else None,
            total_fee_cents=total_fee,
            total_reversed_cents=total_rev,
            net_fee_cents=total_fee - total_rev,
            rows=fee_rows,
        )

    def _paypal_seller(self, db: Client, tenant_id: str) -> str:
        """Verkäufer-Merchant-ID des Tenants — NUR wenn abrechnungsfähig verbunden
        (payments_receivable UND email_confirmed). Sonst fail-closed (Wurzel 5).
        Nie aus Client-Input (Wurzel 3): merchant_id kommt aus dem Profil."""
        prof = (
            db.table("tenant_billing_profile")
            .select(
                "paypal_merchant_id, paypal_payments_receivable, "
                "paypal_email_confirmed"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        row = prof[0] if prof else {}
        merchant = row.get("paypal_merchant_id")
        if not merchant or not row.get("paypal_payments_receivable") or not row.get(
            "paypal_email_confirmed"
        ):
            raise PaymentsError(
                "PayPal ist für diesen Betrieb nicht abrechnungsfähig verbunden.",
                status_code=409,
            )
        return merchant

    def start_paypal_onboarding(self, ctx: AuthContext, *, return_url: str) -> dict:
        """Partner-Referral erstellen → action_url, zu der der Betrieb zum Verbinden
        seines PayPal-Kontos umgeleitet wird. tracking_id = tenant_id (Rückkanal).
        Setzt den Status auf 'pending'."""
        db, tenant_id = self._require(ctx)
        try:
            result = self._paypal().create_partner_referral(
                tracking_id=tenant_id, return_url=return_url
            )
        except PayPalNotConfiguredError as exc:
            raise PaymentsError(str(exc), status_code=503) from exc
        except PayPalError as exc:
            raise PaymentsError(exc.message, status_code=exc.status_code) from exc
        db.table("tenant_billing_profile").update(
            {
                "paypal_tracking_id": tenant_id,
                "paypal_onboarding_status": "pending",
            }
        ).eq("tenant_id", tenant_id).execute()
        return {"action_url": result["action_url"]}

    def sync_own_paypal_status(self, ctx: AuthContext) -> dict:
        """Onboarding-Status des eigenen Tenants nachladen (nach Rückkehr vom
        Onboarding). Liest die merchant_id aus dem eigenen Profil (Wurzel 3) und
        synct receivable/email_confirmed."""
        db, tenant_id = self._require(ctx)
        prof = (
            db.table("tenant_billing_profile")
            .select("paypal_merchant_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        merchant_id = prof[0].get("paypal_merchant_id") if prof else None
        if not merchant_id:
            return {"receivable": False, "email_confirmed": False}
        return self.sync_paypal_status(tenant_id=tenant_id, merchant_id=merchant_id)

    def sync_paypal_from_return(self, *, tracking_id: str, merchant_id: str) -> dict:
        """Return-Handler-Pfad (UNAUTHENTIFIZIERT, PayPal leitet den Browser hierher
        zurück). tracking_id kommt aus der URL und ist NICHT vertrauenswürdig
        (Wurzel 3): tenant_id ist keine geheime ID, ein Angreifer könnte eine fremde
        einsetzen, um beim fremden Tenant eine Angreifer-merchant_id zu binden
        (Payout-Umleitung). Deshalb hier eine Scope-Guard: nur syncen, wenn für
        diesen tracking_id auch WIRKLICH ein von UNS gestartetes Onboarding läuft
        (paypal_tracking_id == tracking_id UND Status 'pending'). Trifft das nicht
        zu, passiert nichts (fail-closed) — der echte Tenant synct ohnehin über den
        signierten Webhook oder den eingeloggten refresh_paypal_status."""
        db = self._db_or_fail()
        prof = (
            db.table("tenant_billing_profile")
            .select("tenant_id,paypal_onboarding_status")
            .eq("paypal_tracking_id", tracking_id)
            .eq("tenant_id", tracking_id)  # tracking_id == tenant_id (start_paypal_onboarding)
            .limit(1)
            .execute()
        ).data
        if not prof or prof[0].get("paypal_onboarding_status") != "pending":
            # Kein passendes laufendes Onboarding → nichts binden (fail-closed).
            raise PaymentsError("Kein laufendes PayPal-Onboarding.", status_code=409)
        return self.sync_paypal_status(tenant_id=tracking_id, merchant_id=merchant_id)

    def sync_paypal_status(
        self, *, tenant_id: str, merchant_id: str
    ) -> dict:
        """Onboarding-Status eines Verkäufers bei PayPal nachladen und ins Profil
        spiegeln. Aufgerufen vom (scope-geprüften) Return-Handler UND vom signierten
        Webhook — der Return liefert die merchant_id NUR als Hinweis; die Wahrheit
        kommt aus dem Status-Call (Wurzel 3). Sellbar = receivable && email_confirmed
        (fail-closed)."""
        db = self._db_or_fail()
        try:
            status = self._paypal().get_merchant_status(seller_merchant_id=merchant_id)
        except PayPalNotConfiguredError as exc:
            raise PaymentsError(str(exc), status_code=503) from exc
        except PayPalError as exc:
            raise PaymentsError(exc.message, status_code=exc.status_code) from exc
        receivable = status["payments_receivable"]
        confirmed = status["primary_email_confirmed"]
        db.table("tenant_billing_profile").update(
            {
                "paypal_merchant_id": status["merchant_id"],
                "paypal_payments_receivable": receivable,
                "paypal_email_confirmed": confirmed,
                "paypal_onboarding_status": (
                    "completed" if receivable and confirmed else "pending"
                ),
            }
        ).eq("tenant_id", tenant_id).execute()
        return {"receivable": receivable, "email_confirmed": confirmed}

    def revoke_paypal(self, *, merchant_id: str) -> None:
        """Verkäufer hat die Plattform-Freigabe entzogen (MERCHANT.PARTNER-CONSENT.
        REVOKED): PayPal deaktivieren (Gegenzustand, Wurzel 1) — künftige Orders
        schlagen dann fail-closed fehl."""
        db = self._db_or_fail()
        db.table("tenant_billing_profile").update(
            {
                "paypal_payments_receivable": False,
                "paypal_email_confirmed": False,
                "paypal_onboarding_status": "revoked",
            }
        ).eq("paypal_merchant_id", merchant_id).execute()

    def create_paypal_order(self, *, reservation_id: str) -> dict:
        """PayPal-Order (mit Plattform-Provision) für eine Gastbuchung anlegen.
        Public-Pfad wie der Stripe-Intent: Tenant/merchant aus der Reservierung,
        nie aus dem Client. Idempotent: offene Order wiederverwenden."""
        db = self._db_or_fail()
        res = self._load_reservation(db, reservation_id)
        self._require_own_channel(res)  # kein PayPal für OTA-Buchungen
        tenant_id = res["tenant_id"]
        amount = float(res["total_amount"] or 0)
        if amount <= 0:
            raise PaymentsError("Buchungsbetrag fehlt.", status_code=422)
        currency = res["currency"]
        if not currency:
            raise PaymentsError("Währung der Buchung fehlt.", status_code=422)
        seller = self._paypal_seller(db, tenant_id)

        # Idempotenz (Wurzel 2): offene PayPal-Order dieser Buchung wiederverwenden.
        existing = (
            db.table("payments")
            .select("id, paypal_order_id")
            .eq("reservation_id", reservation_id)
            .eq("gateway", "paypal")
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if existing and existing[0].get("paypal_order_id"):
            order_id = existing[0]["paypal_order_id"]
            try:
                order = self._paypal().get_order(
                    order_id=order_id, seller_merchant_id=seller
                )
            except PayPalError:
                order = {"status": None}
            # Nur wiederverwenden, solange noch nicht abgeschlossen/verfallen.
            if order.get("status") in {"CREATED", "APPROVED", "PAYER_ACTION_REQUIRED"}:
                return {"order_id": order_id, "payment_id": existing[0]["id"]}

        fee = self._fee_amount(db, tenant_id, amount, res)
        try:
            order = self._paypal().create_order(
                seller_merchant_id=seller,
                amount=amount,
                currency=currency,
                platform_fee=fee,
                reference=reservation_id,
                request_id=f"order:{reservation_id}",
            )
        except PayPalNotConfiguredError as exc:
            raise PaymentsError(str(exc), status_code=503) from exc
        except PayPalError as exc:
            raise PaymentsError(exc.message, status_code=exc.status_code) from exc
        payment = self._insert_payment(
            db,
            reservation_id=reservation_id,
            amount=amount,
            currency=currency,
            ptype="full",
            gateway_ref=order["id"] or "",
            status="pending",
            gateway="paypal",
            extra={"paypal_order_id": order["id"]},
        )
        self._record_platform_fee(
            db,
            reservation_id=reservation_id,
            tenant_id=tenant_id,
            gross_cents=_to_cents(amount),
            currency=currency,
            payment_id=payment["id"],
            gateway="paypal",
            res=res,
        )
        self._set_reservation_payment_status(db, reservation_id, "pending")
        return {"order_id": order["id"], "payment_id": payment["id"]}

    def capture_paypal_order(self, *, order_id: str) -> dict:
        """Eine approved PayPal-Order capturen (nach onApprove im Frontend). Trägt
        die capture_id nach (Refund-Referenz) und spiegelt den Zahlstatus.
        Idempotent: eine schon gecapturete Order wird nicht doppelt eingezogen."""
        db = self._db_or_fail()
        rows = (
            db.table("payments")
            .select("id, reservation_id, status, paypal_capture_id")
            .eq("paypal_order_id", order_id)
            .eq("gateway", "paypal")
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise PaymentsError("PayPal-Zahlung nicht gefunden.", status_code=404)
        pay = rows[0]
        if pay.get("status") == "succeeded" or pay.get("paypal_capture_id"):
            return {"payment_id": pay["id"], "status": "succeeded"}
        res = self._load_reservation(db, pay["reservation_id"])
        seller = self._paypal_seller(db, res["tenant_id"])
        try:
            cap = self._paypal().capture_order(
                order_id=order_id,
                seller_merchant_id=seller,
                request_id=f"capture:{order_id}",
            )
        except PayPalError as exc:
            self._update_payment(db, pay["id"], {"status": "failed"})
            raise PaymentsError(exc.message, status_code=exc.status_code) from exc
        succeeded = cap.get("status") == "COMPLETED"
        self._update_payment(
            db,
            pay["id"],
            {
                "status": "succeeded" if succeeded else "failed",
                "paypal_capture_id": cap.get("capture_id"),
            },
        )
        if succeeded:
            self._set_reservation_payment_status(db, pay["reservation_id"], "paid")
            # BEWUSST KEINE Auszahlungszeile (0217) und keine Cohost-Beteiligung.
            #
            # PayPal Multiparty zahlt direkt an das Konto des Verkäufers; die
            # Plattform hält das Geld zu keinem Zeitpunkt. Eine Auszahlungszeile
            # würde eine zweite Zahlung planen — derselbe Fehler wie bei der
            # Destination Charge, nur ohne Rückholmöglichkeit.
            #
            # Folge, offen und benannt: Bei PayPal-Buchungen greifen weder
            # Co-Gastgeber-Beteiligung noch Spendenabzug noch die Verrechnung
            # bei Storno. Wer beides braucht, muss Stripe nutzen.
            log.info(
                "paypal_kein_payout_geplant",
                reservation_id=pay["reservation_id"],
                grund="multiparty_zahlt_direkt_an_verkaeufer",
            )
        return {"payment_id": pay["id"], "status": cap.get("status")}

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
        gateway: str = "stripe",
        extra: dict[str, Any] | None = None,
    ) -> dict:
        row: dict[str, Any] = {
            "reservation_id": reservation_id,
            "amount": amount,
            "type": ptype,
            "gateway": gateway,
            "gateway_ref": gateway_ref,
            "status": status,
        }
        if currency:
            row["currency"] = currency
        if extra:
            row.update(extra)
        ins = db.table("payments").insert(row).execute().data
        return ins[0] if ins else row

    def _update_payment(self, db: Client, payment_id: str, patch: dict) -> None:
        db.table("payments").update(patch).eq("id", payment_id).execute()

    def _reuse_pending_intent(
        self, db: Client, reservation_id: str, ptype: str,
        res: dict | None = None,
    ) -> dict | None:
        """Idempotenz-Kern: existiert für (reservation, ptype) bereits ein offener
        (pending) Stripe-PaymentIntent, gib {payment_id, client_secret} zurück, um
        ihn wiederzuverwenden — sonst None. Die EINE Stelle, die Doppel-Intents bei
        Doppelklick/Reload/Retry/Webhook-Redelivery verhindert (Wurzel: „einmal
        aufgerufen" als Annahme). Jeder neue Intent-erzeugende Pfad ruft das ZUERST.

        ``res`` ist PFLICHT für Direct Charges: Der Intent liegt dann im Konto
        des Betriebs. Ohne den Header antwortet Stripe „No such payment_intent",
        und die Buchung wäre dauerhaft unbezahlbar — jeder Retry träfe denselben
        Fehler.
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
                existing[0]["gateway_ref"],
                direct_acct=self._direct_acct(db, res) if res else None,
                client=self._stripe,
            )
        return {
            "payment_id": existing[0]["id"],
            "client_secret": intent["client_secret"],
        }

    def _reservierungs_erstattungsstatus(
        self, db: Client, reservation_id: str, payment_id: str, neuer_status: str
    ) -> str:
        """Erstattungsstatus der BUCHUNG aus dem Stand aller ihrer Zahlungen.

        `refunded` nur, wenn jede erstattbare Gastzahlung (voll/Anzahlung/
        Restzahlung) vollständig erstattet ist — sonst `partially_refunded`.
        `payment_id`/`neuer_status` sind die gerade geschriebene Zahlung: ihr
        Status steht in der DB zwar schon, wird hier aber explizit eingesetzt,
        damit das Ergebnis nicht von der Sichtbarkeit des eigenen Schreibvorgangs
        abhängt (Wurzel 2).
        """
        zahlungen = (
            db.table("payments")
            .select("id, status")
            .eq("reservation_id", reservation_id)
            .in_("type", ["full", "down_payment", "balance"])
            .in_("status", ["succeeded", "partially_refunded", "refunded"])
            .execute()
        ).data or []
        stati = [
            neuer_status if str(z.get("id")) == str(payment_id) else z.get("status")
            for z in zahlungen
        ]
        if stati and all(s == "refunded" for s in stati):
            return "refunded"
        return "partially_refunded"

    def _refunded_sum(
        self, db: Client, reservation_id: str, payment_id: str | None = None
    ) -> float:
        """Summe der bereits erfolgten Erstattungen — zu GENAU DIESER Zahlung.

        Seit 0313 tragen refund-Zeilen `parent_payment_id`. Das ist wichtig,
        weil der Aufrufer die Summe gegen den Betrag EINER Zahlung hält: bei
        einer Buchung mit Zahlungsplan (Anzahlung + Restzahlung) ergäbe eine
        buchungsweite Summe falsche Grenzen — eine schon erstattete Anzahlung
        würde den erstattbaren Rest der Restzahlung kürzen (Gast bekommt zu
        wenig zurück) und `is_full` schlüge zu früh an (weitere legitime
        Erstattungen blockiert).

        Ohne `payment_id` (und für Altzeilen ohne Parent-Bezug) bleibt die alte,
        buchungsweite Summe — für Bestandsdaten die konservative Variante, die
        eher zu wenig als zu viel erstatten lässt.
        """
        if payment_id is None:
            rows = (
                db.table("payments")
                .select("amount")
                .eq("reservation_id", reservation_id)
                .eq("type", "refund")
                .eq("status", "succeeded")
                .execute()
            ).data or []
            return float(sum(float(r.get("amount") or 0) for r in rows))
        alle = (
            db.table("payments")
            .select("amount, parent_payment_id")
            .eq("reservation_id", reservation_id)
            .eq("type", "refund")
            .eq("status", "succeeded")
            .execute()
        ).data or []
        eigene = [r for r in alle if r.get("parent_payment_id") == payment_id]
        # Altzeilen (vor 0313) haben keinen Bezug. Sie einfach zu ignorieren
        # würde den Doppelerstattungs-Schutz für Bestandsbuchungen aushebeln
        # (Wurzel 2) — deshalb in diesem Fall weiter buchungsweit rechnen.
        ohne_bezug = [r for r in alle if not r.get("parent_payment_id")]
        rows = alle if ohne_bezug else eigene
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
            .select(
                "id, reservation_id, amount, currency, type, status, gateway_ref, "
                "gateway, paypal_capture_id"
            )
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
        """Kautionsbetrag — Priorität: die für die Buchung geltende Kondition
        (deposit_required + deposit_amount), sonst der Objekt-Default
        (properties.deposit_amount). Keine Erfindung (Wurzel 4): fehlt beides,
        klar fehlschlagen."""
        res = (
            db.table("reservations")
            .select("property_id, tenant_id, rate_plan_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        # 1) Kondition der Buchung (Rate-Plan → Standard).
        condition = self._resolve_condition(db, res[0])
        if (
            condition
            and condition.get("deposit_required")
            and condition.get("deposit_amount")
            and float(condition["deposit_amount"]) > 0
        ):
            return float(condition["deposit_amount"])
        # 2) Fallback: Objekt-Default.
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


def _param_paths(fields: dict[str, Any], prefix: str = "") -> list[str]:
    """Feldpfade eines Account-Updates im Stripe-Klammerformat — OHNE Werte.

    Fürs Konsolen-Log: sichtbar machen, WAS gesendet wird, ohne Name, Adresse
    oder Geburtsdatum ins Log zu schreiben (CWE-532).
    """
    paths: list[str] = []
    for key, value in fields.items():
        pfad = f"{prefix}[{key}]" if prefix else str(key)
        if isinstance(value, dict):
            paths.extend(_param_paths(value, pfad))
        else:
            paths.append(pfad)
    return paths


def _drop_param(fields: dict[str, Any], param: str | None) -> bool:
    """Entfernt das von Stripe benannte Feld aus einem Account-Update.

    ``param`` kommt im Stripe-Klammerpfad („business_profile[url]",
    „individual[address][city]"). True, wenn wirklich etwas entfernt wurde —
    sonst darf der Aufrufer NICHT erneut senden (sonst Endlosschleife mit
    identischem Request). Elternknoten, die dadurch leer werden, fallen mit weg;
    ein leeres ``{"individual": {}}`` würde Stripe sonst erneut abweisen.
    """
    if not param:
        return False
    head, _, rest = param.partition("[")
    path = [head, *[p.rstrip("]") for p in rest.split("[") if p]] if rest else [head]
    node: Any = fields
    parents: list[tuple[dict, str]] = []
    for key in path[:-1]:
        if not isinstance(node, dict) or key not in node:
            return False
        parents.append((node, key))
        node = node[key]
    if not isinstance(node, dict) or path[-1] not in node:
        return False
    del node[path[-1]]
    for parent, key in reversed(parents):
        if not parent[key]:
            del parent[key]
    return True


@lru_cache(maxsize=64)
def _currency_for_country(country: str) -> str:
    """Auszahlungswährung eines Bankkontos — bei Stripe erfragt, nicht geraten.

    Eine hartkodierte Länderliste war hier falsch: Sie enthielt nur die
    EUR-SEPA-Länder, sodass ein dänisches, schwedisches oder polnisches Konto
    mit 422 abgewiesen wurde, obwohl Stripe es unterstützt. Die
    country_specs-API ist die einzige verlässliche Quelle (Wurzel 4).

    Ergebnis wird zwischengespeichert — die Angabe je Land ändert sich
    praktisch nie, und der Aufruf soll nicht bei jedem Kontowechsel erfolgen.
    """
    code = country.upper()
    with _stripe_errors():
        spec = get_stripe().v1.country_specs.retrieve(code)
    waehrung = getattr(spec, "default_currency", None)
    if not waehrung:
        raise PaymentsError(
            f"Auszahlungswährung für Land {code} nicht bestimmbar.",
            status_code=422,
        )
    return str(waehrung)
