"""Tests für den payments-Slice.

Stripe-Aufrufe gehen gegen die ECHTE Stripe-Test-API (Sandbox), kein Mock —
Voraussetzung ist ein `sk_test_...`-Key in der Umgebung (.env). Ohne Key werden
die netzabhängigen Tests übersprungen (Skip, kein Fake). Die DB ist ein
In-Memory-Fake (gleiches Muster wie der whatsapp-Slice).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from stripe import StripeClient

from src.core.config import get_settings
from src.core.security import AuthContext
from src.features.payments.service import PaymentsError, PaymentsService
from src.features.payments.webhook import handle_stripe_event
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")
_OTHER = AuthContext(user_id="u2", tenant_id="t2")


def _stripe_key() -> str | None:
    key = get_settings().stripe_secret_key.get_secret_value()
    return key if key.startswith("sk_test_") else None


_needs_stripe = pytest.mark.skipif(
    _stripe_key() is None, reason="kein sk_test_-Key (Stripe-Sandbox) gesetzt"
)


class _NoNetStripe:
    """Client-Ersatz für Tests, die einen Guard VOR dem Stripe-Aufruf prüfen.

    Vorher stand hier ``None`` — das schien harmlos ("kein Stripe"), bedeutet für
    den Service aber das Gegenteil: ``PaymentsService(stripe=None)`` baut den
    Client LAZY aus der Umgebung (service.py ``_stripe``-Property). Lag dort ein
    Live-Key, sprachen genau diese Tests die echte Stripe-API an — am 14.08.2026
    live als Serie von 400ern im Stripe-Log sichtbar (``No such destination:
    'acct_test'``).

    Dieser Fake macht die Absicht explizit: Wird er doch berührt, schlägt der
    Test mit klarer Meldung fehl, statt still hinauszutelefonieren."""

    def __getattr__(self, name: str) -> object:
        raise AssertionError(
            f"Test hat einen echten Stripe-Aufruf versucht (v1.{name}…). Dieser "
            "Test soll VOR dem Stripe-Aufruf scheitern — greift der Guard nicht, "
            "ist das der Bug. Für echte API-Tests: @_needs_stripe + sk_test_-Key."
        )


def _stripe() -> StripeClient | _NoNetStripe:
    """Echter Test-Client (nur bei sk_test_-Key) oder ein Fake, der bei Benutzung
    laut wird. NIE ``None`` — das würde den Lazy-Live-Pfad öffnen."""
    key = _stripe_key()
    return StripeClient(key) if key else _NoNetStripe()


def test_payments_health() -> None:
    resp = client.get("/api/v1/payments/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "payments", "status": "ok"}


def test_stripe_not_configured_raises_clean_error(monkeypatch) -> None:  # noqa: ANN001
    """Fehlt der Stripe-Key, muss der Stripe-Zugriff einen klaren PaymentsError
    (503) werfen — nicht mit leerem Key einen kryptischen Auth-Fehler erzeugen.
    Genau dieser Pfad macht „Stripe nicht konfiguriert" im Frontend sichtbar."""
    from src.features.payments import stripe_client as sc

    sc.get_stripe.cache_clear()
    monkeypatch.setattr(
        get_settings().stripe_secret_key, "get_secret_value", lambda: ""
    )
    # Kein injizierter Client → Service muss lazy initialisieren und sauber scheitern.
    # DB liefert die eigene acct_-ID, damit der Tenant-Guard passiert und der
    # Stripe-Key-Fehler (503) tatsächlich erreicht wird.
    db = _connect_db("acct_does_not_matter")
    svc = PaymentsService(service_client=db, stripe=None)
    with pytest.raises(PaymentsError) as exc:
        svc.get_connect_account_status("t-1", "acct_does_not_matter")
    assert exc.value.status_code == 503
    assert "nicht konfiguriert" in exc.value.message.lower()
    sc.get_stripe.cache_clear()


def test_live_key_im_test_wird_gesperrt(monkeypatch) -> None:  # noqa: ANN001
    """Regression 14.08.2026: Unter pytest darf get_stripe() NIEMALS einen
    Live-Key-Client bauen.

    Damals liefen echte PaymentIntent-Aufrufe ins Live-Konto (400er-Serie
    ``No such destination: 'acct_test'``), weil ``stripe=None`` im Test den
    Lazy-Pfad öffnet und dort ein ``rk_live_``-Key lag. Der Guard sitzt am
    Nadelöhr, durch das ALLE Live-Ausgänge laufen — greift er, ist auch jeder
    künftige Test mit erfasst."""
    from src.features.payments import stripe_client as sc

    for live_key in ("rk_live_abcdef123456", "sk_live_abcdef123456"):
        sc.get_stripe.cache_clear()
        monkeypatch.setattr(
            get_settings().stripe_secret_key, "get_secret_value", lambda k=live_key: k
        )
        with pytest.raises(sc.StripeLiveKeyInTestError):
            sc.get_stripe()
    sc.get_stripe.cache_clear()


def test_test_key_im_test_ist_erlaubt(monkeypatch) -> None:  # noqa: ANN001
    """Gegenprobe: ein sk_test_/rk_test_-Key baut weiterhin einen Client — der
    Guard sperrt gezielt LIVE, nicht die Sandbox (sonst wären die
    @_needs_stripe-Tests tot)."""
    from src.features.payments import stripe_client as sc

    for test_key in ("sk_test_abcdef123456", "rk_test_abcdef123456"):
        sc.get_stripe.cache_clear()
        monkeypatch.setattr(
            get_settings().stripe_secret_key, "get_secret_value", lambda k=test_key: k
        )
        assert sc.get_stripe() is not None
    sc.get_stripe.cache_clear()


def test_stripe_hilfsfunktion_gibt_nie_none(monkeypatch) -> None:  # noqa: ANN001
    """``_stripe()`` darf nie ``None`` liefern.

    ``PaymentsService(stripe=None)`` heißt „Client lazy aus der Umgebung bauen",
    nicht „kein Stripe" — genau diese Zweideutigkeit war die Ursache der
    Live-Aufrufe. Ohne Test-Key kommt daher ein Fake, der bei Benutzung wirft."""
    monkeypatch.setattr(
        get_settings().stripe_secret_key, "get_secret_value", lambda: "rk_live_x"
    )
    ersatz = _stripe()
    assert ersatz is not None
    with pytest.raises(AssertionError, match="echten Stripe-Aufruf"):
        _ = ersatz.v1


def test_stripe_invalid_request_becomes_clean_400() -> None:
    """Ein Stripe-Eingabefehler (z.B. ungültige PLZ, http_status 400) muss als
    sauberer PaymentsError(400) mit der Stripe-Meldung ankommen — NICHT als
    ungefangener 500-Stacktrace."""
    from stripe import InvalidRequestError

    class _RaisingAccounts:
        def update(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            raise InvalidRequestError(
                "Invalid DE postal code",
                param="individual[address][postal_code]",
                http_status=400,
            )

    class _V1:
        accounts = _RaisingAccounts()

    class _FakeStripe:
        v1 = _V1()

    svc = PaymentsService(service_client=_connect_db("acct_x"), stripe=_FakeStripe())
    with pytest.raises(PaymentsError) as exc:
        svc.update_connect_account("t-1", "acct_x", {"individual": {}})
    assert exc.value.status_code == 400
    assert "postal code" in exc.value.message.lower()


def test_connect_account_foreign_tenant_rejected() -> None:
    """IDOR-Guard: eine acct_-ID, die NICHT zum Tenant gehört, wird mit 404
    abgelehnt (kein Cross-Tenant-Zugriff auf fremde Stripe-Accounts)."""
    class _V1:
        accounts = object()  # darf NIE erreicht werden

    class _FakeStripe:
        v1 = _V1()

    # DB kennt für t-1 nur acct_own — der Angreifer versucht acct_victim.
    svc = PaymentsService(service_client=_connect_db("acct_own"), stripe=_FakeStripe())
    for call in (
        lambda: svc.get_connect_account_status("t-1", "acct_victim"),
        lambda: svc.update_connect_account("t-1", "acct_victim", {}),
        lambda: svc.set_external_account(
            "t-1", "acct_victim", iban="DE00", account_holder="X", country="DE"
        ),
    ):
        with pytest.raises(PaymentsError) as exc:
            call()
        assert exc.value.status_code == 404


# --- Fake-DB (Insert/Update/Select) -----------------------------------------
class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _Q:
    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._neq: dict = {}
        self._is_null: list = []
        self._not_null: list = []
        self._negated = False
        self._payload = None
        self._op = "select"

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload, **kw):  # noqa: ANN001, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        self._ignore_dupes = kw.get("ignore_duplicates", False)
        return self

    def delete(self):  # noqa: ANN201
        self._op = "delete"
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, c, v):  # noqa: ANN001, ANN201
        self._eq[c] = v
        return self

    # neq / is_ / not_ braucht die Rechnungsprüfung der Nachberechnung
    # (0470, `_pruefe_keine_rechnung`): sie fragt nach einer festgeschriebenen
    # Rechnung (`invoice_number is not null`, `status != cancelled`,
    # `deleted_at is null`). Ohne diese drei Methoden wirft der Fake einen
    # AttributeError, und der Test hätte die Prüfung gar nicht erreicht.
    def neq(self, c, v):  # noqa: ANN001, ANN201
        self._neq[c] = v
        return self

    def is_(self, c, v):  # noqa: ANN001, ANN201
        if str(v).lower() != "null":
            raise NotImplementedError("Fake unterstützt nur is_(col, 'null')")
        (self._not_null if self._negated else self._is_null).append(c)
        self._negated = False
        return self

    @property
    def not_(self):  # noqa: ANN201
        self._negated = True
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(rows) + 1}")
            row.setdefault("created_at", "2026-06-22T00:00:00Z")
            rows.append(row)
            return _Res([row])
        if self._op == "upsert":
            row = dict(self._payload)
            # PK-Konflikt (id existiert schon) + ignore_duplicates → leere
            # Rückgabe (kein neuer Insert), wie PostgREST/Postgres DO NOTHING.
            if getattr(self, "_ignore_dupes", False) and any(
                r.get("id") == row.get("id") for r in rows
            ):
                return _Res([])
            rows.append(row)
            return _Res([row])
        def passt(r) -> bool:  # noqa: ANN001
            return (
                all(r.get(k) == v for k, v in self._eq.items())
                and all(r.get(k) != v for k, v in self._neq.items())
                and all(r.get(k) is None for k in self._is_null)
                and all(r.get(k) is not None for k in self._not_null)
            )

        match = [r for r in rows if passt(r)]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            return _Res(match)
        if self._op == "delete":
            self._store[self._name] = [r for r in rows if r not in match]
            return _Res(match)
        return _Res(match)


class _DB:
    def __init__(self) -> None:
        self.store: dict = {}

    def table(self, name):  # noqa: ANN001, ANN201
        return _Q(self.store, name)


def _db_with_booking(
    *,
    charges_enabled: bool,
    tenant: str = "t1",
    account_type: str = "marketplace",
    platform_fee_bps: int | None = 800,
) -> _DB:
    db = _DB()
    db.store["reservations"] = [
        {
            "id": "res-1",
            "tenant_id": tenant,
            "property_id": "prop-1",
            "total_amount": 120.0,
            "currency": "eur",
            "payment_status": "unpaid",
        }
    ]
    db.store["tenant_billing_profile"] = [
        {
            "tenant_id": tenant,
            "stripe_account_id": "acct_test" if charges_enabled else None,
            "stripe_charges_enabled": charges_enabled,
        }
    ]
    # Fee-Quelle (0180/0182): nur account_type='marketplace' zahlt die Provision,
    # Satz aus tenants.platform_fee_bps. PMS-Tenant → keine Fee.
    db.store["tenants"] = [
        {
            "id": tenant,
            "account_type": account_type,
            "platform_fee_bps": platform_fee_bps,
        }
    ]
    db.store["properties"] = [{"id": "prop-1", "deposit_amount": 50.0}]
    return db


def _connect_db(stripe_account_id: str, *, tenant: str = "t-1") -> _DB:
    """DB, deren tenant_billing_profile für `tenant` die gegebene acct_-ID trägt —
    damit der _require_own_connect_account-Guard sie als eigenen Account akzeptiert."""
    db = _DB()
    db.store["tenant_billing_profile"] = [
        {"tenant_id": tenant, "stripe_account_id": stripe_account_id}
    ]
    return db


# --- Stufe A: Gast-Zahlung --------------------------------------------------

def test_booking_payment_without_onboarded_account_fails() -> None:
    """Ohne freigeschalteten Connected Account → klarer 409, kein Fallback."""
    db = _db_with_booking(charges_enabled=False)
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_booking_payment(reservation_id="res-1")
    assert exc.value.status_code == 409


# --- OTA-Gate: keine Stripe-Zahlung für OTA-Buchungen -----------------------
# OTAs (Booking/Airbnb/Vrbo) kassieren den Gast selbst und zahlen den Vermieter
# direkt aus → über myNextDays darf für solche Buchungen KEIN PaymentIntent
# entstehen (sonst doppelte Belastung). Greift VOR jedem Stripe-Call, daher
# ohne echte Stripe-API testbar.

@pytest.mark.parametrize(
    ("channel", "ota_name", "channex_id"),
    [
        ("booking", "Booking.com", None),
        ("airbnb", "Airbnb", None),
        ("vrbo", "Vrbo", None),
        # OTA, die intern als 'portal' läuft, aber über Channex importiert wurde
        # (z.B. Expedia/Agoda) → source_channex_booking_id ist der sichere Marker.
        ("portal", "Expedia", "chx-booking-1"),
    ],
)
def test_booking_payment_blocked_for_ota(channel, ota_name, channex_id) -> None:  # noqa: ANN001
    db = _db_with_booking(charges_enabled=True)
    res = db.store["reservations"][0]
    res["channel"] = channel
    res["ota_name"] = ota_name
    res["source_channex_booking_id"] = channex_id
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_booking_payment(reservation_id="res-1")
    assert exc.value.status_code == 409
    # Keine payments-Row angelegt (Gate griff vor dem Stripe-Call).
    assert db.store.get("payments", []) == []


@pytest.mark.parametrize("channel", ["direct", "portal"])
def test_booking_payment_allowed_for_own_channel_passes_gate(channel) -> None:  # noqa: ANN001
    """Eigene Kanäle (direct/portal ohne Channex-Marker) passieren das OTA-Gate.

    Geprüft wird, dass das Gate NICHT greift — der Beweis ist, dass die Ausführung
    bis zum Stripe-Aufruf vordringt und dort am Fake-Client scheitert (statt
    vorher mit 409 'OTA' abzubrechen).

    Vorher stand hier ein ``try/except PaymentsError`` mit ``stripe=_stripe()``,
    das ohne Test-Key ``None`` lieferte: Dann baute der Service den Client aus der
    Umgebung und rief die ECHTE Stripe-API — mit Live-Key die 400er-Serie vom
    14.08.2026. Ein Test, dessen Aussage „irgendwo NACH dem Gate scheitern" ist,
    darf nicht das Netz als Abbruchgrund nutzen."""
    db = _db_with_booking(charges_enabled=True)
    res = db.store["reservations"][0]
    res["channel"] = channel
    res["ota_name"] = None
    res["source_channex_booking_id"] = None
    svc = PaymentsService(service_client=db, stripe=_NoNetStripe())
    with pytest.raises(AssertionError, match="echten Stripe-Aufruf"):
        svc.create_booking_payment(reservation_id="res-1")


def _make_transfer_ready_account(stripe: StripeClient) -> str:
    """Custom-Test-Account mit vollständiger Test-Persona → transfers sofort
    'active' (Stripe-Test-Verifizierung: id_number 000000000, address-Match)."""
    acct = stripe.v1.accounts.create(
        params={
            "type": "custom",
            "country": "DE",
            "business_type": "individual",
            "capabilities": {
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            "tos_acceptance": {
                "service_agreement": "full", "date": 1700000000, "ip": "127.0.0.1"
            },
            "business_profile": {"mcc": "5734", "url": "https://accessible.stripe.com"},
            "individual": {
                "first_name": "Test", "last_name": "Host", "email": "host@example.com",
                "phone": "+15555550100",
                "dob": {"day": 1, "month": 1, "year": 1990},
                "address": {
                    "line1": "address_full_match", "city": "Berlin",
                    "postal_code": "10115", "country": "DE",
                },
                "id_number": "000000000",
            },
            "external_account": {
                "object": "bank_account", "country": "DE", "currency": "eur",
                "account_number": "DE89370400440532013000",
            },
        }
    )
    return acct.id


@_needs_stripe
def test_booking_payment_creates_intent_and_row() -> None:
    """Echte Stripe-Test-API: Destination-Charge-PaymentIntent + payments-Row."""
    stripe = _stripe()
    db = _db_with_booking(charges_enabled=True)
    db.store["tenant_billing_profile"][0]["stripe_account_id"] = (
        _make_transfer_ready_account(stripe)
    )
    svc = PaymentsService(service_client=db, stripe=stripe)
    result = svc.create_booking_payment(reservation_id="res-1")
    assert result.client_secret.startswith("pi_")
    assert len(db.store["payments"]) == 1
    row = db.store["payments"][0]
    assert row["type"] == "full" and row["status"] == "pending"
    assert row["gateway"] == "stripe" and row["gateway_ref"].startswith("pi_")
    assert db.store["reservations"][0]["payment_status"] == "pending"


@_needs_stripe
def test_portal_booking_charges_8pct_fee() -> None:
    """E2E gegen echte Stripe-Test-API: eine Marktplatz-Portal-Buchung (eigener
    Kanal) muss application_fee_amount = 8 % des Buchungsbetrags tragen. Betrag
    120,00 € → Fee 9,60 € (960 Cent). Gegengelesen aus dem echten PaymentIntent.
    Fee-Satz kommt aus tenants.platform_fee_bps=800 (Marktplatz-Konto)."""
    stripe = _stripe()
    db = _db_with_booking(charges_enabled=True)
    res = db.store["reservations"][0]
    res["channel"] = "portal"
    res["ota_name"] = None
    res["source_channex_booking_id"] = None
    db.store["tenant_billing_profile"][0]["stripe_account_id"] = (
        _make_transfer_ready_account(stripe)
    )
    svc = PaymentsService(service_client=db, stripe=stripe)
    result = svc.create_booking_payment(reservation_id="res-1")
    pi = stripe.v1.payment_intents.retrieve(db.store["payments"][0]["gateway_ref"])
    fee = pi["application_fee_amount"] if "application_fee_amount" in pi else None
    assert fee == 960, f"erwartet 960 Cent (8% von 120€), Stripe liefert {fee}"
    assert result.client_secret.startswith("pi_")


def test_fee_cents_haengt_am_kanal_nicht_am_kontotyp() -> None:
    """Preisliste §2: Die Provision entscheidet der KANAL.

    „Ein Tarif für alle. Kein Privat- oder Agentur-Modell." — derselbe Betrieb
    verkauft über unser Portal mit 8 %, über seine eigene Website
    provisionsfrei (§5: „provisionsfreie Direktbuchungen zusätzlich") und über
    OTAs mit 0,5 %, die monatlich fakturiert wird.
    """
    portal = {"tenant_id": "t1", "channel": "portal"}
    direkt = {"tenant_id": "t1", "channel": "direct"}
    ota = {"tenant_id": "t1", "channel": "booking"}

    db = _db_with_booking(charges_enabled=True)
    svc = PaymentsService(service_client=db)
    # Portal-Buchung, 800 bps: 8 % von 120 € = 960 Cent.
    assert svc._fee_cents(db, "t1", 12000, portal) == 960  # noqa: SLF001
    # Ganzzahl-Division (kein Float-Rundungsfehler): 12345 * 800 // 10000 = 987.
    assert svc._fee_cents(db, "t1", 12345, portal) == 987  # noqa: SLF001
    # Eigene Website des Betriebs → provisionsfrei.
    assert svc._fee_cents(db, "t1", 12000, direkt) == 0  # noqa: SLF001
    # OTA → am Charge nichts; die 0,5 % laufen über die Monatsrechnung.
    assert svc._fee_cents(db, "t1", 12000, ota) == 0  # noqa: SLF001
    # Ohne Kontext lieber nichts berechnen als zu Unrecht (Wurzel 5).
    assert svc._fee_cents(db, "t1", 12000, None) == 0  # noqa: SLF001

    # Derselbe Tenant, egal welcher Kontotyp — der Kanal zählt.
    pms = _db_with_booking(charges_enabled=True, account_type="pms")
    svc_pms = PaymentsService(service_client=pms)
    assert svc_pms._fee_cents(pms, "t1", 12000, portal) == 960  # noqa: SLF001
    assert svc_pms._fee_cents(pms, "t1", 12000, direkt) == 0  # noqa: SLF001

    # Portal-Buchung ohne gesetzten Satz = Datenfehler → 500 (kein stiller
    # 0-Kassier).
    nofee = _db_with_booking(charges_enabled=True, platform_fee_bps=None)
    svc_nf = PaymentsService(service_client=nofee)
    with pytest.raises(PaymentsError) as exc:
        svc_nf._fee_cents(nofee, "t1", 12000, portal)  # noqa: SLF001
    assert exc.value.status_code == 500
    # Absurd hoher Satz (>10000 bps) = Konfigfehler → 500.
    bad = _db_with_booking(charges_enabled=True, platform_fee_bps=80000)
    svc_bad = PaymentsService(service_client=bad)
    with pytest.raises(PaymentsError) as exc2:
        svc_bad._fee_cents(bad, "t1", 12000, portal)  # noqa: SLF001
    assert exc2.value.status_code == 500


def test_ledger_folgt_dem_kanal() -> None:
    """Der platform_fees-Ledger MUSS denselben Kanal sehen wie der Charge.

    Ohne `res` gäbe `_platform_fee_bps` 0 zurück → bei Portal-Buchungen entstünde
    NIE eine Ledger-Zeile, und `_plane_auszahlung` würde das Netto ohne Abzug
    der 8 % berechnen: Der Gastgeber bekäme 100 % angewiesen, obwohl Stripe nur
    92 % transferiert hat.
    """
    db = _db_with_booking(charges_enabled=True)
    svc = PaymentsService(service_client=db)
    portal = {"tenant_id": "t1", "channel": "portal"}
    direkt = {"tenant_id": "t1", "channel": "direct"}

    svc._record_platform_fee(  # noqa: SLF001
        db, reservation_id="res-1", tenant_id="t1", gross_cents=100000,
        currency="eur", payment_id="pay-1", gateway="stripe", res=portal,
    )
    zeilen = db.store.get("platform_fees", [])
    assert len(zeilen) == 1, "Portal-Buchung braucht eine Ledger-Zeile"
    assert zeilen[0]["fee_amount_cents"] == 8000
    assert zeilen[0]["fee_bps"] == 800

    # Direktbuchung: keine Zeile, sonst stünde Provision im Ledger, die nie floss.
    svc._record_platform_fee(  # noqa: SLF001
        db, reservation_id="res-2", tenant_id="t1", gross_cents=100000,
        currency="eur", payment_id="pay-2", gateway="stripe", res=direkt,
    )
    assert len(db.store.get("platform_fees", [])) == 1


def test_haftung_folgt_der_provision() -> None:
    """Wer nichts verdient, haftet nicht (Lastenheft §7.1).

    Portal-Buchung (8 %) → wir tragen das Risiko, Charge über unser Konto.
    Sonst → Direct Charge, der Betrieb ist Merchant of Record.
    """
    db = _db_with_booking(charges_enabled=True)
    svc = PaymentsService(service_client=db)
    assert svc._traegt_haftung({"channel": "portal"}) is True  # noqa: SLF001
    assert svc._traegt_haftung({"channel": "direct"}) is False  # noqa: SLF001
    assert svc._traegt_haftung({"channel": "booking"}) is False  # noqa: SLF001
    assert svc._traegt_haftung({}) is False  # noqa: SLF001


@_needs_stripe
def test_ota_booking_charges_no_fee_and_blocks() -> None:
    """Gegenprobe: Bei einem Marktplatz-Konto (8 % Fee) darf eine OTA-Buchung
    TROTZDEM keinen Charge erzeugen (die OTA kassiert den Gast) — 409, keine
    payments-Row, keine Fee."""
    db = _db_with_booking(charges_enabled=True)
    res = db.store["reservations"][0]
    res["channel"] = "booking"
    res["ota_name"] = "Booking.com"
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_booking_payment(reservation_id="res-1")
    assert exc.value.status_code == 409
    assert len(db.store.get("payments", [])) == 0  # kein Charge, keine Fee


# --- Stufe D: Webhook -------------------------------------------------------

def test_webhook_succeeded_marks_paid() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_1",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_abc"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["payments"][0]["status"] == "succeeded"
    assert db.store["reservations"][0]["payment_status"] == "paid"


def test_pms_faehrt_direct_charge(monkeypatch) -> None:
    """PMS = Direct Charge: der Betrieb ist Händler und haftet selbst.

    Lastenheft §7.1 sagt 0 % Buchungsgebühr zu. Wer nichts verdient, darf auch
    nicht für Chargebacks haften — und nur Direct Charges verlagern die Haftung
    wirklich (on_behalf_of tut es nachweislich NICHT).

    Live belegt: Charge im Betriebskonto, net=967,25 fee=32,75 — die
    Stripe-Gebühr trägt der Betrieb, Kartenabrechnung zeigt seinen Namen.
    """
    from src.features.payments import stripe_client as sc_mod

    gesehen: dict = {}
    optionen: dict = {}

    class _FakePI:
        id = "pi_x"
        client_secret = "cs_x"
        status = "succeeded"

    class _FakeStripe:
        class v1:  # noqa: N801
            class payment_intents:  # noqa: N801
                @staticmethod
                def create(params, options=None):  # noqa: ANN001
                    gesehen.update(params)
                    optionen.update(options or {})
                    return _FakePI()

    einstellungen = MagicMock()
    einstellungen.stripe_separate_transfers = False
    monkeypatch.setattr(sc_mod, "get_settings", lambda: einstellungen)
    sc_mod.create_payment_intent(
        amount_cents=100000,
        currency="eur",
        destination_acct="acct_pms",
        application_fee_cents=0,
        direct=True,
        client=_FakeStripe(),
    )
    # DER Unterschied: Aufruf im Konto des Betriebs.
    assert optionen["stripe_account"] == "acct_pms"
    # Kein Weiterreichen nötig — das Geld ist schon dort.
    assert "transfer_data" not in gesehen
    # on_behalf_of wäre sinnlos und würde abgelehnt.
    assert "on_behalf_of" not in gesehen
    assert "application_fee_amount" not in gesehen


def test_marktplatz_faehrt_keinen_direct_charge(monkeypatch) -> None:
    """Gegenprobe: Marktplatz läuft über unser Konto, mit Provision."""
    from src.features.payments import stripe_client as sc_mod

    gesehen: dict = {}
    optionen: dict = {}

    class _FakePI:
        id = "pi_x"
        client_secret = "cs_x"
        status = "succeeded"

    class _FakeStripe:
        class v1:  # noqa: N801
            class payment_intents:  # noqa: N801
                @staticmethod
                def create(params, options=None):  # noqa: ANN001
                    gesehen.update(params)
                    optionen.update(options or {})
                    return _FakePI()

    einstellungen = MagicMock()
    einstellungen.stripe_separate_transfers = False
    monkeypatch.setattr(sc_mod, "get_settings", lambda: einstellungen)
    sc_mod.create_payment_intent(
        amount_cents=100000,
        currency="eur",
        destination_acct="acct_mp",
        application_fee_cents=8000,
        direct=False,
        client=_FakeStripe(),
    )
    assert "stripe_account" not in optionen
    assert gesehen["on_behalf_of"] == "acct_mp"
    assert gesehen["application_fee_amount"] == 8000


def test_on_behalf_of_ist_in_beiden_modi_gesetzt(monkeypatch) -> None:
    """on_behalf_of erhält die Fremdwährung — es darf NIE wegfallen.

    Live belegt: Ein USD-Charge OHNE on_behalf_of wird in die Plattform-Währung
    umgerechnet (1000 USD → 6574,75 DKK, Kurs 6,57475). Der spätere Transfer in
    USD scheitert dann mit "currency of source_transaction's balance
    transaction (dkk) must be the same as the transfer currency (usd)" — der
    Betrieb bekäme sein Geld gar nicht oder in der falschen Währung.

    MIT on_behalf_of führt der Plattform-Saldo eine eigene Zeile je Währung
    (live gesehen: EUR, PLN, SEK, GBP, CAD neben DKK).

    Gilt für beide NICHT-direkten Modi. Bei Direct Charges entfällt es, weil
    der Charge ohnehin im Konto des Betriebs entsteht (eigener Test).
    """
    from src.features.payments import stripe_client as sc_mod

    gesehen: dict = {}

    class _FakePI:
        id = "pi_x"
        client_secret = "cs_x"
        status = "succeeded"

    class _FakeStripe:
        class v1:  # noqa: N801
            class payment_intents:  # noqa: N801
                @staticmethod
                def create(params, options=None):  # noqa: ANN001, ARG004
                    gesehen.update(params)
                    return _FakePI()

    einstellungen = MagicMock()
    for getrennt in (True, False):
        einstellungen.stripe_separate_transfers = getrennt
        monkeypatch.setattr(sc_mod, "get_settings", lambda: einstellungen)
        gesehen.clear()
        sc_mod.create_payment_intent(
            amount_cents=100000,
            currency="usd",
            destination_acct="acct_us",
            application_fee_cents=0,
            client=_FakeStripe(),
        )
        assert gesehen["on_behalf_of"] == "acct_us", (
            f"on_behalf_of fehlt (separate={getrennt}) — Fremdwährung ginge "
            "verloren"
        )


def test_separate_charge_setzt_keine_application_fee(monkeypatch) -> None:
    """Stripe lehnt application_fee_amount ohne transfer_data ab.

    Live verifiziert: "Can only apply an application_fee_amount when the
    PaymentIntent is attached to a connected account". Ohne diese Weiche wäre
    JEDER Charge gescheitert, sobald das Flag umgelegt wird.

    Die Provision geht dadurch nicht verloren — bei Separate Charges landet der
    volle Betrag bei uns und der Auszahlungslauf transferiert nur den Netto-
    anteil weiter.
    """
    from src.features.payments import stripe_client as sc_mod

    gesehen: dict = {}

    class _FakePI:
        id = "pi_x"
        client_secret = "cs_x"
        status = "succeeded"

    class _FakeStripe:
        class v1:  # noqa: N801
            class payment_intents:  # noqa: N801
                @staticmethod
                def create(params, options=None):  # noqa: ANN001, ARG004
                    gesehen.update(params)
                    return _FakePI()

    einstellungen = MagicMock()
    einstellungen.stripe_separate_transfers = True
    monkeypatch.setattr(sc_mod, "get_settings", lambda: einstellungen)
    sc_mod.create_payment_intent(
        amount_cents=100000,
        currency="eur",
        destination_acct="acct_1",
        application_fee_cents=8000,
        transfer_group="reservation:r1",
        client=_FakeStripe(),
    )
    assert "transfer_data" not in gesehen
    assert "application_fee_amount" not in gesehen
    assert gesehen["on_behalf_of"] == "acct_1"
    assert gesehen["transfer_group"] == "reservation:r1"

    # Gegenprobe: Im Altpfad MUSS beides gesetzt sein.
    gesehen.clear()
    einstellungen.stripe_separate_transfers = False
    sc_mod.create_payment_intent(
        amount_cents=100000,
        currency="eur",
        destination_acct="acct_1",
        application_fee_cents=8000,
        client=_FakeStripe(),
    )
    assert gesehen["transfer_data"] == {"destination": "acct_1"}
    assert gesehen["application_fee_amount"] == 8000


def test_direktbuchung_plant_keine_auszahlung() -> None:
    """Preisliste §5: „provisionsfreie Direktbuchungen zusätzlich".

    Buchungen über die eigene Website des Betriebs laufen als Direct Charge —
    das Geld war nie bei uns, es gibt nichts auszuzahlen. Eine Zeile hier wäre
    eine Auszahlung ins Leere.
    """
    db = _DB()
    db.store["payments"] = [
        {
            "id": "pay-d",
            "reservation_id": "res-1",
            "gateway_ref": "pi_direkt",
            "status": "pending",
            "type": "full",
        }
    ]
    db.store["reservations"] = [
        {
            "id": "res-1",
            "tenant_id": "t1",
            "total_amount": 500.0,
            "currency": "eur",
            "check_out": "2026-08-01",
            "payment_status": "pending",
            "channel": "direct",
        }
    ]
    handle_stripe_event(
        db,
        {
            "id": "evt_direkt",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_direkt", "latest_charge": "ch_d"}},
        },
        now_iso="2026-06-30T00:00:00Z",
    )
    assert not db.store.get("payouts"), "Direktbuchung darf keine Auszahlung planen"


def test_kaution_plant_keine_auszahlung() -> None:
    """Der Kautions-Einzug feuert ebenfalls payment_intent.succeeded.

    Ohne Filter würde der Upsert die Auszahlungszeile der Buchung überschreiben:
    Status zurück auf 'scheduled' (auch bei bereits stornierter Zeile) und
    source_charge_id auf die Kautions-Charge.
    """
    db = _DB()
    db.store["payments"] = [
        {
            "id": "pay-k",
            "reservation_id": "res-1",
            "gateway_ref": "pi_kaution",
            "status": "pending",
            "type": "deposit",
        }
    ]
    db.store["reservations"] = [
        {
            "id": "res-1",
            "tenant_id": "t1",
            "total_amount": 500.0,
            "currency": "eur",
            "check_out": "2026-08-01",
            "payment_status": "pending",
        }
    ]
    handle_stripe_event(
        db,
        {
            "id": "evt_k",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_kaution", "latest_charge": "ch_k"}},
        },
        now_iso="2026-06-30T00:00:00Z",
    )
    assert not db.store.get("payouts"), "Kaution darf keine Auszahlung planen"


def test_normale_zahlung_plant_auszahlung() -> None:
    """Gegenprobe: Eine echte Buchungszahlung erzeugt sehr wohl eine Zeile."""
    db = _DB()
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "gateway_ref": "pi_voll",
            "status": "pending",
            "type": "full",
        }
    ]
    db.store["reservations"] = [
        {
            "id": "res-1",
            "tenant_id": "t1",
            "total_amount": 500.0,
            "currency": "eur",
            "check_out": "2026-08-01",
            "payment_status": "pending",
            # Portal-Buchung: nur dafür hält die Plattform Geld und zahlt aus.
            "channel": "portal",
        }
    ]
    handle_stripe_event(
        db,
        {
            "id": "evt_v",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_voll", "latest_charge": "ch_v"}},
        },
        now_iso="2026-06-30T00:00:00Z",
    )
    assert db.store.get("payouts"), "Buchungszahlung muss eine Auszahlung planen"


def test_chargeback_haelt_die_auszahlung_zurueck() -> None:
    """Stripe belastet bei einem Dispute sofort den Plattform-Saldo.

    Ginge die Auszahlung trotzdem raus, zahlte die Plattform den Betrieb aus
    Geld, das ihr gerade entzogen wird.
    """
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_d"}
    ]
    db.store["payouts"] = [
        {"id": "po-1", "reservation_id": "res-1", "status": "scheduled"}
    ]
    handle_stripe_event(
        db,
        {
            "id": "evt_d",
            "type": "charge.dispute.created",
            "data": {"object": {"id": "dp_1", "payment_intent": "pi_d"}},
        },
        now_iso="2026-06-30T00:00:00Z",
    )
    assert db.store["payouts"][0]["status"] == "held"
    assert db.store.get("payout_holds"), "Hold-Zeile muss entstehen"


def test_chargeback_nach_auszahlung_setzt_keinen_hold() -> None:
    """Ist das Geld schon raus, hilft kein Hold — dafür gibt es die
    Verrechnung. Der Webhook darf daran nicht scheitern."""
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_d"}
    ]
    db.store["payouts"] = [
        {"id": "po-1", "reservation_id": "res-1", "status": "paid"}
    ]
    handle_stripe_event(
        db,
        {
            "id": "evt_d2",
            "type": "charge.dispute.created",
            "data": {"object": {"id": "dp_2", "payment_intent": "pi_d"}},
        },
        now_iso="2026-06-30T00:00:00Z",
    )
    assert db.store["payouts"][0]["status"] == "paid"


class _StripeObjectLike:
    """Simuliert Stripes StripeObject: Item-Zugriff (obj["x"]) ja, aber KEIN
    .get() (genau das verursachte in Produktion AttributeError: get)."""

    def __init__(self, data: dict) -> None:
        self._data = data

    def __getitem__(self, key):  # noqa: ANN001, ANN204
        return self._data[key]  # KeyError bei fehlend — wie StripeObject

    # bewusst KEIN get()


def test_webhook_account_updated_with_stripe_object() -> None:
    """account.updated mit einem StripeObject-artigen Event (kein .get()) — muss
    die KYC-Flags spiegeln statt an AttributeError zu scheitern (Prod-Bug)."""
    db = _DB()
    db.store["tenant_billing_profile"] = [
        {"tenant_id": "t1", "stripe_account_id": "acct_x"}
    ]
    event = {
        "id": "evt_acc_1",
        "type": "account.updated",
        "data": {
            "object": _StripeObjectLike(
                {
                    "id": "acct_x",
                    "charges_enabled": True,
                    "payouts_enabled": True,
                    "details_submitted": True,
                }
            )
        },
    }
    out = handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert out["status"] == "ok"
    prof = db.store["tenant_billing_profile"][0]
    assert prof["stripe_charges_enabled"] is True
    assert prof["stripe_payouts_enabled"] is True
    assert prof["stripe_details_submitted"] is True


def test_webhook_is_idempotent() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_dup",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_abc"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    db.store["payments"][0]["status"] = "pending"  # künstlich zurücksetzen
    out = handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert out["status"] == "duplicate"
    assert db.store["payments"][0]["status"] == "pending"


def test_webhook_failed_marks_failed() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_x", "status": "pending"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "pending"}]
    event = {
        "id": "evt_2",
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_x"}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["payments"][0]["status"] == "failed"


def test_webhook_account_updated_spiegelt_kyc() -> None:
    db = _DB()
    db.store["tenant_billing_profile"] = [
        {"tenant_id": "t1", "stripe_account_id": "acct_x", "stripe_charges_enabled": False}
    ]
    event = {
        "id": "evt_acc",
        "type": "account.updated",
        "data": {
            "object": {
                "id": "acct_x",
                "charges_enabled": True,
                "payouts_enabled": True,
                "details_submitted": True,
            }
        },
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    prof = db.store["tenant_billing_profile"][0]
    assert prof["stripe_charges_enabled"] is True
    assert prof["stripe_details_submitted"] is True
    assert prof["stripe_onboarding_at"] == "2026-06-30T00:00:00Z"


# --- Stufe B: Kaution -------------------------------------------------------

def test_deposit_without_amount_configured_fails() -> None:
    db = _db_with_booking(charges_enabled=True)
    db.store["properties"][0]["deposit_amount"] = None
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_deposit_hold(_CTX, reservation_id="res-1")
    assert exc.value.status_code == 422


# --- Tenant-Isolation -------------------------------------------------------

def test_deposit_cross_tenant_is_blocked() -> None:
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.create_deposit_hold(_OTHER, reservation_id="res-1")
    assert exc.value.status_code == 404


def test_refund_cross_tenant_is_blocked() -> None:
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "amount": 120.0,
            "currency": "eur",
            "type": "full",
            "status": "succeeded",
            "gateway_ref": "pi_abc",
        }
    ]
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.refund_payment(_OTHER, "pay-1")
    assert exc.value.status_code == 404


def test_refund_already_fully_refunded_is_rejected() -> None:
    """Regression: eine bereits voll erstattete Zahlung darf nicht erneut erstattet
    werden (Doppelklick/Retry). Der Guard greift VOR dem Stripe-Aufruf → 409, auch
    ohne echten Stripe-Key testbar."""
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "amount": 120.0,
         "currency": "eur", "type": "full", "status": "refunded",
         "gateway_ref": "pi_abc"},
    ]
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.refund_payment(_CTX, "pay-1")
    assert exc.value.status_code == 409


def test_refund_over_remaining_amount_is_rejected() -> None:
    """Regression: die Summe der Teilerstattungen darf den Ursprungsbetrag nicht
    übersteigen. Bei bereits 100 von 120 erstattet lehnt ein weiterer 50er-Refund
    ab (Rest nur 20) → 422, vor dem Stripe-Aufruf."""
    db = _db_with_booking(charges_enabled=True, tenant="t1")
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "amount": 120.0,
         "currency": "eur", "type": "full", "status": "partially_refunded",
         "gateway_ref": "pi_abc"},
        {"id": "ref-1", "reservation_id": "res-1", "amount": 100.0,
         "currency": "eur", "type": "refund", "status": "succeeded",
         "gateway_ref": "re_1"},
    ]
    svc = PaymentsService(service_client=db, stripe=_stripe())
    with pytest.raises(PaymentsError) as exc:
        svc.refund_payment(_CTX, "pay-1", amount=50.0)
    assert exc.value.status_code == 422


def test_webhook_partial_refund_marks_partially_refunded() -> None:
    """charge.refunded mit amount_refunded < amount → partially_refunded,
    NICHT refunded (Stripe feuert charge.refunded auch bei Teilerstattung)."""
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc",
         "status": "succeeded"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "paid"}]
    event = {
        "id": "evt_pr", "type": "charge.refunded",
        "data": {"object": {"id": "ch_1", "payment_intent": "pi_abc",
                            "amount": 20000, "amount_refunded": 5000}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["reservations"][0]["payment_status"] == "partially_refunded"


def test_webhook_full_refund_marks_refunded() -> None:
    db = _DB()
    db.store["payments"] = [
        {"id": "pay-1", "reservation_id": "res-1", "gateway_ref": "pi_abc",
         "status": "succeeded"}
    ]
    db.store["reservations"] = [{"id": "res-1", "payment_status": "paid"}]
    event = {
        "id": "evt_fr", "type": "charge.refunded",
        "data": {"object": {"id": "ch_1", "payment_intent": "pi_abc",
                            "amount": 20000, "amount_refunded": 20000}},
    }
    handle_stripe_event(db, event, now_iso="2026-06-30T00:00:00Z")
    assert db.store["reservations"][0]["payment_status"] == "refunded"


# -- current_period_end: Stripe verschob das Feld auf die Item-Ebene ---------
def test_period_end_von_item_wenn_oben_nicht_gesetzt() -> None:
    """Seit API 2025-03-31 trägt die Subscription das Feld nicht mehr — dann
    muss es aus den Items kommen, sonst bleibt das Abrechnungsdatum leer."""
    from src.features.payments.webhook import _period_end

    sub = {
        "id": "sub_1",
        "items": {"data": [{"current_period_end": 1788008618}]},
    }
    assert _period_end(sub) == 1788008618


def test_period_end_bevorzugt_oberste_ebene() -> None:
    """Ältere API-Versionen liefern es oben — das gilt dann vorrangig."""
    from src.features.payments.webhook import _period_end

    sub = {
        "id": "sub_1",
        "current_period_end": 1700000000,
        "items": {"data": [{"current_period_end": 1788008618}]},
    }
    assert _period_end(sub) == 1700000000


def test_period_end_nimmt_frueheste_item_periode() -> None:
    """Mehrere Positionen mit eigenen Perioden: als Nächstes wird die früheste
    abgerechnet."""
    from src.features.payments.webhook import _period_end

    sub = {
        "id": "sub_1",
        "items": {"data": [
            {"current_period_end": 1788008618},
            {"current_period_end": 1780000000},
        ]},
    }
    assert _period_end(sub) == 1780000000


def test_period_end_ohne_daten_ist_none() -> None:
    """Fehlt die Angabe ganz, wird nichts erfunden (Wurzel 4)."""
    from src.features.payments.webhook import _period_end

    assert _period_end({"id": "sub_1", "items": {"data": []}}) is None


# --- toleranter Feld-Sync (ein abgelehntes Feld kippt nicht alles) -----------

def _rejecting_stripe(bad_param: str, message: str):  # noqa: ANN202
    """Fake-Stripe, der GENAU ein Feld ablehnt und danach durchlässt — wie die
    echte Stripe-Validierung von Telefonnummer/Website."""
    from stripe import InvalidRequestError

    calls: list[dict] = []

    class _Accounts:
        def update(self, _acct, params=None, **_k):  # noqa: ANN001, ANN003, ANN202
            calls.append(params or {})
            head, _, rest = bad_param.partition("[")
            node = (params or {}).get(head)
            if rest:
                for teil in [p.rstrip("]") for p in rest.split("[") if p]:
                    if not isinstance(node, dict) or teil not in node:
                        node = None
                        break
                    node = node[teil]
            if node is not None:
                raise InvalidRequestError(message, param=bad_param, http_status=400)
            return MagicMock(
                id=_acct, charges_enabled=False, payouts_enabled=False,
                details_submitted=True,
                requirements=MagicMock(currently_due=[], disabled_reason=None),
            )

        def retrieve(self, acct, **_k):  # noqa: ANN001, ANN003, ANN202
            return MagicMock(
                id=acct, charges_enabled=False, payouts_enabled=False,
                details_submitted=True,
                requirements=MagicMock(currently_due=[], disabled_reason=None),
            )

    class _V1:
        accounts = _Accounts()

    class _FakeStripe:
        v1 = _V1()

    return _FakeStripe(), calls


def test_sync_connect_fields_drops_only_the_rejected_field() -> None:
    """Stripe lehnt die Website ab → sie fliegt aus dem Update, die KYC-Daten
    gehen trotzdem raus. Vorher ging der GESAMTE Request verloren und der Account
    blieb ohne eine einzige Pflichtangabe restricted."""
    stripe_fake, calls = _rejecting_stripe("business_profile[url]", "Not a valid URL")
    svc = PaymentsService(service_client=_connect_db("acct_x"), stripe=stripe_fake)
    _status, rejected = svc.sync_connect_fields(
        "t-1", "acct_x",
        {
            "business_type": "individual",
            "individual": {"first_name": "Max", "last_name": "Muster"},
            "business_profile": {"name": "Muster", "url": "https://gibtsnicht.invalid"},
        },
    )
    assert rejected == ["business_profile[url]: Not a valid URL"]
    # Zweiter Versuch: url raus, alles andere noch da.
    assert "url" not in calls[-1]["business_profile"]
    assert calls[-1]["individual"]["first_name"] == "Max"
    assert calls[-1]["business_profile"]["name"] == "Muster"


def test_sync_connect_fields_removes_empty_parent() -> None:
    """War das abgelehnte Feld das EINZIGE im Block, fliegt der leere Block mit —
    ein leeres `business_profile: {}` würde Stripe erneut abweisen (Endlosschleife)."""
    stripe_fake, calls = _rejecting_stripe("business_profile[url]", "Not a valid URL")
    svc = PaymentsService(service_client=_connect_db("acct_x"), stripe=stripe_fake)
    _status, rejected = svc.sync_connect_fields(
        "t-1", "acct_x",
        {"business_type": "individual", "business_profile": {"url": "https://x.invalid"}},
    )
    assert len(rejected) == 1
    assert "business_profile" not in calls[-1]


def test_sync_connect_fields_reraises_when_nothing_can_be_dropped() -> None:
    """Ein Fehler ohne benennbares Feld (oder ein Feld, das gar nicht im Update
    steht) darf NICHT still geschluckt werden — sonst meldet der Sync Erfolg,
    obwohl nichts ankam (Wurzel 5)."""
    from stripe import InvalidRequestError

    class _Accounts:
        def update(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN202
            raise InvalidRequestError("kaputt", param=None, http_status=400)

    class _V1:
        accounts = _Accounts()

    class _FakeStripe:
        v1 = _V1()

    svc = PaymentsService(service_client=_connect_db("acct_x"), stripe=_FakeStripe())
    with pytest.raises(PaymentsError):
        svc.sync_connect_fields("t-1", "acct_x", {"individual": {"phone": "+49123"}})


# --- Branding: Firmenlogo auf der Zahlseite des Gastes -----------------------
# Das Logo kommt aus settings.branding des VERBUNDENEN Kontos. Ohne diesen Sync
# zeigt die Stripe-Zahlseite den grauen Platzhalter, obwohl im Profil ein Logo
# liegt (live gesehen am 13.08.2026).

class _StorageBucket:
    def __init__(self, dateien: dict[str, bytes]) -> None:
        self._dateien = dateien
        self.geladen: list[str] = []

    def download(self, pfad: str) -> bytes:
        self.geladen.append(pfad)
        return self._dateien[pfad]


class _Storage:
    def __init__(self, bucket: _StorageBucket) -> None:
        self._bucket = bucket

    def from_(self, _name: str) -> _StorageBucket:
        return self._bucket


def _png(breite: int = 200, hoehe: int = 80) -> bytes:
    """Echtes PNG — die Icon-Aufbereitung öffnet das Bild wirklich."""
    from io import BytesIO

    from PIL import Image

    puffer = BytesIO()
    Image.new("RGB", (breite, hoehe), (10, 20, 30)).save(puffer, format="PNG")
    return puffer.getvalue()


def _branding_db(logo_url: str | None, *, gesynct: str | None = None) -> _DB:
    db = _DB()
    db.store["tenant_billing_profile"] = [
        {
            "tenant_id": "t-1",
            "stripe_account_id": "acct_own",
            "company_logo_url": logo_url,
            "stripe_branding_logo_url": gesynct,
        }
    ]
    db.storage = _Storage(_StorageBucket({"t-1/logo.png": _png()}))
    return db


class _BrandingStripe:
    """Zählt die Stripe-Aufrufe, damit Idempotenz beweisbar ist."""

    def __init__(self) -> None:
        self.dateien: list[dict] = []
        self.branding: list[dict] = []
        outer = self

        class _Files:
            @staticmethod
            def create(params, options=None):  # noqa: ANN001, ANN205
                outer.dateien.append({"params": params, "options": options})
                return type("F", (), {"id": "file_1"})()

        class _Accounts:
            @staticmethod
            def update(acct, params=None, options=None):  # noqa: ANN001, ANN205
                outer.branding.append({"acct": acct, "params": params})
                return type("A", (), {"id": acct})()

        class _V1:
            files = _Files()
            accounts = _Accounts()

        self.v1 = _V1()


def test_branding_logo_wird_an_stripe_uebertragen() -> None:
    db = _branding_db("https://x.test/storage/v1/object/public/company-logos/t-1/logo.png?v=ab12")
    stripe = _BrandingStripe()
    PaymentsService(service_client=db, stripe=stripe).sync_branding_logo("t-1", "acct_own")

    # Zwei Uploads mit UNTERSCHIEDLICHEM Zweck: Stripe lehnt eine Datei ab, deren
    # purpose nicht zum Zielfeld passt (live verifiziert).
    zwecke = [d["params"]["purpose"] for d in stripe.dateien]
    assert zwecke == ["business_logo", "business_icon"]
    # Auf PLATTFORM-Ebene hochladen: accounts.update kennt sonst die Datei nicht.
    assert all(d["options"] is None for d in stripe.dateien)
    branding = stripe.branding[0]["params"]["settings"]["branding"]
    # Icon = das kleine Rundsymbol oben auf der Zahlseite, Logo = die große Marke.
    assert branding == {"icon": "file_1", "logo": "file_1"}
    # Stand gemerkt → nächster Sync lädt nicht erneut hoch.
    assert db.store["tenant_billing_profile"][0]["stripe_branding_logo_url"].endswith(
        "logo.png?v=ab12"
    )


def test_branding_logo_zweiter_sync_laedt_nicht_erneut_hoch() -> None:
    url = "https://x.test/storage/v1/object/public/company-logos/t-1/logo.png?v=ab12"
    db = _branding_db(url, gesynct=url)
    stripe = _BrandingStripe()
    PaymentsService(service_client=db, stripe=stripe).sync_branding_logo("t-1", "acct_own")
    assert stripe.dateien == []
    assert stripe.branding == []


def test_branding_icon_wird_quadratisch_aufbereitet() -> None:
    """Stripe verlangt für das Symbol 1:1 — ein 200×80-Logo wird gepolstert,
    NICHT beschnitten oder verzerrt."""
    from io import BytesIO

    from PIL import Image

    db = _branding_db("https://x.test/storage/v1/object/public/company-logos/t-1/logo.png")
    stripe = _BrandingStripe()
    PaymentsService(service_client=db, stripe=stripe).sync_branding_logo("t-1", "acct_own")

    icon = stripe.dateien[1]["params"]["file"]
    icon.seek(0)
    with Image.open(BytesIO(icon.read())) as bild:
        assert bild.width == bild.height == 200


def test_branding_kaputtes_bild_kippt_den_logo_sync_nicht() -> None:
    """Unlesbare Bilddatei → kein 500. Das große Logo geht trotzdem raus, der
    Grund fürs fehlende Symbol wird benannt."""
    db = _branding_db("https://x.test/storage/v1/object/public/company-logos/t-1/logo.png")
    db.storage = _Storage(_StorageBucket({"t-1/logo.png": b"kein-bild"}))
    stripe = _BrandingStripe()
    with pytest.raises(PaymentsError) as exc:
        PaymentsService(service_client=db, stripe=stripe).sync_branding_logo(
            "t-1", "acct_own"
        )
    assert exc.value.status_code == 422
    assert stripe.branding[0]["params"]["settings"]["branding"] == {"logo": "file_1"}


def test_branding_logo_svg_wird_klar_abgelehnt() -> None:
    """Stripe nimmt nur PNG/JPEG — kein stiller Verzicht, sondern eine Ansage."""
    db = _branding_db("https://x.test/storage/v1/object/public/company-logos/t-1/logo.svg")
    stripe = _BrandingStripe()
    with pytest.raises(PaymentsError) as exc:
        PaymentsService(service_client=db, stripe=stripe).sync_branding_logo(
            "t-1", "acct_own"
        )
    assert exc.value.status_code == 422
    assert stripe.dateien == []


def test_branding_logo_fremder_pfad_wird_abgelehnt() -> None:
    """Eine Logo-Adresse aus einem fremden Tenant-Ordner wird nicht geladen."""
    db = _branding_db("https://x.test/storage/v1/object/public/company-logos/t-2/logo.png")
    stripe = _BrandingStripe()
    with pytest.raises(PaymentsError) as exc:
        PaymentsService(service_client=db, stripe=stripe).sync_branding_logo(
            "t-1", "acct_own"
        )
    assert exc.value.status_code == 403
    assert stripe.dateien == []


def test_branding_logo_ohne_logo_ist_kein_fehler() -> None:
    db = _branding_db(None)
    stripe = _BrandingStripe()
    PaymentsService(service_client=db, stripe=stripe).sync_branding_logo("t-1", "acct_own")
    assert stripe.dateien == []


# --- Zahlungsbeschreibung auf der Kartenabrechnung --------------------------
# Stripe weist `statement_descriptor` bei Kartenzahlungen ab (live gemessen am
# 18.08.2026, HTTP 400: „The statement_descriptor parameter is not supported
# for payment_method_type `card`"). Damit scheiterte JEDE Kartenzahlung schon
# beim Anlegen des Intents. Erlaubt ist nur `statement_descriptor_suffix`.


def _intent_params(descriptor: str) -> dict:
    """Die an Stripe gehenden Parameter für einen Intent mit diesem Namen."""
    from unittest.mock import MagicMock

    from src.features.payments import stripe_client as sc

    stripe = MagicMock(name="stripe")
    stripe.v1.payment_intents.create.return_value = MagicMock(
        id="pi_1", client_secret="cs_1"
    )
    sc.create_payment_intent(
        amount_cents=1000,
        currency="dkk",
        destination_acct="acct_1",
        application_fee_cents=0,
        statement_descriptor=descriptor,
        client=stripe,
    )
    aufruf = stripe.v1.payment_intents.create.call_args
    return aufruf.kwargs.get("params") or aufruf.args[0]


def test_kartenabrechnung_nutzt_suffix_nicht_descriptor() -> None:
    """DIE REGEL: `statement_descriptor` ist bei Karten verboten."""
    params = _intent_params("AirSmil")
    assert params.get("statement_descriptor_suffix") == "AirSmil"
    assert "statement_descriptor" not in params, (
        "Stripe weist `statement_descriptor` bei Kartenzahlungen mit 400 ab."
    )


def test_suffix_wird_auf_zehn_zeichen_gekappt() -> None:
    """Die 22 Zeichen gelten für Präfix + Trenner + Suffix zusammen.

    Bei maximalem Kontopräfix (10) und dem Trenner „* " bleiben 10 Zeichen.
    Ungekappt stünde ein abgeschnittener Name auf der Abrechnung des Gastes.
    """
    params = _intent_params("Ferienvermietung Nordlicht GmbH")
    assert len(params["statement_descriptor_suffix"]) == 10


def test_verbotene_zeichen_fliegen_raus() -> None:
    """`< > \\ ' " *` sind bei Stripe unzulässig — der Wert kommt aus den
    Betriebsdaten und darf den Charge nicht kippen (Wurzel 8)."""
    params = _intent_params('Air<>"*Smil')
    assert params["statement_descriptor_suffix"] == "AirSmil"


def test_ohne_buchstaben_kein_suffix() -> None:
    """Stripe verlangt mindestens EINEN Buchstaben — sonst weglassen statt
    den Charge daran scheitern zu lassen."""
    params = _intent_params("12345")
    assert "statement_descriptor_suffix" not in params
    assert "statement_descriptor" not in params


def test_jeder_intent_pfad_traegt_idempotency_key() -> None:
    """Wurzel 2: JEDER Intent-erzeugende Pfad gibt Stripe einen Key mit.

    `_reuse_pending_intent` ist read-then-write ohne Sperre: zwei nebenlaeufige
    Anfragen lesen beide „kein pending" und legen beide einen Intent an. Nur
    Stripes `idempotency_key` macht daraus einen. `create_intent_for_absicht`
    hatte bis 10.09.2026 WEDER Reuse-Pruefung NOCH Key — ein Doppelklick auf
    „Jetzt buchen" erzeugte zwei Intents samt zweier Gebuehren-/Spendenzeilen.

    Der Test liest den Quelltext, weil die vier Pfade sehr verschiedene
    Vorbedingungen haben (Kunde, Zahlungsmittel, Absicht-ID) — ein Aufruf je
    Pfad waere mehr Attrappe als Pruefung. Was hier zaehlt, ist die
    Vollstaendigkeit: kein Aufruf ohne Key.
    """
    import re
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[1] / "service.py"
    ).read_text(encoding="utf-8")

    # Argumentliste je Aufruf ueber Klammertiefe schneiden — ein Regex bricht
    # am ersten ")" einer VERSCHACHTELTEN Funktion ab (self._fee_cents(...))
    # und wuerde den Key hinter ihr uebersehen.
    aufrufe: list[str] = []
    marke = "sc.create_payment_intent("
    pos = quelle.find(marke)
    while pos != -1:
        i = pos + len(marke)
        tiefe = 1
        while tiefe:
            if quelle[i] == "(":
                tiefe += 1
            elif quelle[i] == ")":
                tiefe -= 1
            i += 1
        aufrufe.append(quelle[pos + len(marke) : i - 1])
        pos = quelle.find(marke, i)

    assert len(aufrufe) == 5, f"Pfade veraendert: {len(aufrufe)} statt 5"
    ohne_key = [a for a in aufrufe if "idempotency_key" not in a]
    assert not ohne_key, (
        f"{len(ohne_key)} Intent-Pfad(e) ohne idempotency_key — Wurzel 2"
    )
    # Der Betrag gehoert in den Schluessel: bei geaenderter Summe ist es ein
    # anderer Vorgang, und Stripe quittiert denselben Key mit HTTP 400.
    for a in aufrufe:
        wert = re.search(r'idempotency_key=f?"([^"]+)"', a)
        if wert:
            assert "cents" in wert.group(1), f"Key ohne Betrag: {wert.group(1)}"
