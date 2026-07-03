"""Tests für die automatische Stripe-Connect-Anlage beim Firmenprofil-Speichern.

Plattform-Regel: ein Objektbesitzer braucht zum Auszahlen einen Connected Account;
er entsteht automatisch aus den Onboarding-Firmendaten. Stripe wird hier gemockt
(die echte Stripe-Anbindung deckt der payments-Slice ab) — Fokus: wird der Account
angelegt + die Daten übertragen, ist es idempotent, und scheitert das Speichern
NICHT, wenn Stripe nicht verfügbar ist.
"""
from unittest.mock import MagicMock, patch

from src.core.security import AuthContext
from src.features.buchhaltung.service import (
    BuchhaltungService,
    _account_holder_from,
    _connect_fields_from_profile,
)

_CTX = AuthContext(user_id="u", tenant_id="t1")


# --- reine Feld-Abbildung ----------------------------------------------------

def test_connect_fields_from_profile_maps_address_and_individual() -> None:
    fields = _connect_fields_from_profile(
        {
            "legal_name": "Muster GmbH",
            "company_street": "Hauptstr",
            "company_house_number": "5",
            "company_city": "Berlin",
            "company_postal_code": "10115",
            "company_country": "DE",
            "email": "host@example.com",
            "phone_number": "+49301234567",
            "managing_director_first_name": "Max",
            "managing_director_last_name": "Muster",
            "website": "https://muster.de",
        }
    )
    assert fields["individual"]["first_name"] == "Max"
    assert fields["individual"]["address"]["line1"] == "Hauptstr 5"
    assert fields["individual"]["address"]["country"] == "DE"
    assert fields["business_profile"]["name"] == "Muster GmbH"
    assert fields["business_profile"]["url"] == "https://muster.de"


def test_connect_fields_omits_missing() -> None:
    # Nur E-Mail vorhanden → keine leeren Adress-/Business-Blöcke (keine Fallbacks).
    fields = _connect_fields_from_profile({"email": "h@example.com"})
    assert fields == {"individual": {"email": "h@example.com"}}


def test_account_holder_auto_derived() -> None:
    """Kontoinhaber wird ohne separates Feld abgeleitet: Firma → Firmenname,
    Einzelperson → Vor+Nachname; nichts vorhanden → None (kein Fallback)."""
    # Firma
    assert (
        _account_holder_from(
            {"account_type": "company", "legal_name": "Muster GmbH"}
        )
        == "Muster GmbH"
    )
    # Einzelperson
    assert (
        _account_holder_from(
            {
                "account_type": "individual",
                "managing_director_first_name": "Max",
                "managing_director_last_name": "Muster",
            }
        )
        == "Max Muster"
    )
    # Einzelperson ohne Name, aber legal_name → letzter Rückfall
    assert (
        _account_holder_from(
            {"account_type": "individual", "legal_name": "Max Muster e.K."}
        )
        == "Max Muster e.K."
    )
    # Nichts vorhanden → None
    assert _account_holder_from({"account_type": "individual"}) is None


# --- Fake-DB -----------------------------------------------------------------
class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _Q:
    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._payload = None
        self._op = "select"

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, c, v):  # noqa: ANN001, ANN201
        self._eq[c] = v
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        rows = self._store.setdefault(self._name, [])
        if self._op == "upsert":
            payload = dict(self._payload)
            match = [r for r in rows if r.get("tenant_id") == payload.get("tenant_id")]
            if match:
                match[0].update(payload)
                return _Res([match[0]])
            rows.append(payload)
            return _Res([payload])
        match = [r for r in rows if all(r.get(k) == v for k, v in self._eq.items())]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            return _Res(match)
        return _Res(match)


class _DB:
    def __init__(self) -> None:
        self.store: dict = {"tenant_billing_profile": []}

    def table(self, name):  # noqa: ANN001, ANN201
        return _Q(self.store, name)


def _profile_row() -> dict:
    return {
        "tenant_id": "t1",
        "legal_name": "Muster GmbH",
        "email": "host@example.com",
        "company_country": "DE",
        "iban": "DE89370400440532013000",
        "account_holder": "Max Muster",
    }


# --- Auto-Connect-Logik ------------------------------------------------------

def test_ensure_connect_account_creates_and_stores() -> None:
    db = _DB()
    # Profil-Row existiert bereits (im echten Flow vom vorherigen upsert angelegt).
    db.store["tenant_billing_profile"].append(_profile_row())
    svc = BuchhaltungService(db)
    fake_payments = MagicMock()
    fake_payments.create_connect_account.return_value = MagicMock(
        stripe_account_id="acct_new"
    )
    with patch(
        "src.features.payments.service.PaymentsService", return_value=fake_payments
    ):
        svc._ensure_connect_account("t1", _profile_row())  # noqa: SLF001
    # Account-ID wurde im Profil gespeichert.
    assert db.store["tenant_billing_profile"][0]["stripe_account_id"] == "acct_new"
    # Firmendaten + IBAN wurden übertragen.
    fake_payments.update_connect_account.assert_called_once()
    fake_payments.set_external_account.assert_called_once()


def test_ensure_connect_account_is_idempotent_but_syncs_fields() -> None:
    """Bestehender Account: KEIN zweiter Account, aber die aktualisierten
    Firmendaten werden an Stripe synchronisiert — sonst blieben offene
    Requirements (z. B. nachgetragene Website → business_profile.url) für
    immer offen. Bankverbindung wird beim Sync bewusst nicht erneut angefügt."""
    db = _DB()
    db.store["tenant_billing_profile"].append(
        {"tenant_id": "t1", "stripe_account_id": "acct_exists"}
    )
    svc = BuchhaltungService(db)
    with patch("src.features.payments.service.PaymentsService") as cls:
        fake_payments = cls.return_value
        svc._ensure_connect_account(  # noqa: SLF001
            "t1", {**_profile_row(), "website": "https://muster.example"}
        )
    fake_payments.create_connect_account.assert_not_called()
    fake_payments.set_external_account.assert_not_called()
    fake_payments.update_connect_account.assert_called_once()
    account_id, fields = fake_payments.update_connect_account.call_args.args
    assert account_id == "acct_exists"
    assert fields["business_profile"]["url"] == "https://muster.example"


def test_ensure_connect_account_skips_when_incomplete() -> None:
    db = _DB()
    svc = BuchhaltungService(db)
    with patch("src.features.payments.service.PaymentsService") as cls:
        # Ohne E-Mail/Land kein Account (keine Fallbacks).
        svc._ensure_connect_account("t1", {"tenant_id": "t1"})  # noqa: SLF001
    cls.assert_not_called()


def test_company_profile_roundtrip_includes_kyc_fields() -> None:
    """Stammdaten (inkl. Stripe-KYC-Felder) speichern → laden gibt sie als
    camelCase zurück, damit die Stammdaten-UI die gespeicherten Werte wieder
    anzeigt (firstName/lastName/phoneNumber/website/accountType/ownerDob)."""
    db = _DB()
    svc = BuchhaltungService(db)
    # Auto-Connect ist hier nicht der Fokus → Stripe weg-mocken (ohne E-Mail/Land
    # würde er ohnehin übersprungen, aber wir setzen beides für Realismus).
    with patch("src.features.payments.service.PaymentsService"):
        svc.update_company_profile(
            _CTX,
            {
                "firstName": "Max",
                "lastName": "Muster",
                "phoneNumber": "+49301234567",
                "website": "https://muster.de",
                "email": "host@example.com",
                "companyCountry": "DE",
                "accountType": "individual",
                "ownerDob": "1990-05-15",
            },
        )
    profile = svc.get_company_profile(_CTX)
    assert profile["firstName"] == "Max"
    assert profile["lastName"] == "Muster"
    assert profile["phoneNumber"] == "+49301234567"
    assert profile["website"] == "https://muster.de"
    assert profile["accountType"] == "individual"
    assert profile["ownerDob"] == "1990-05-15"


def test_ensure_connect_account_survives_stripe_error() -> None:
    from src.features.payments.service import PaymentsError

    db = _DB()
    db.store["tenant_billing_profile"].append(_profile_row())
    svc = BuchhaltungService(db)
    fake_payments = MagicMock()
    fake_payments.create_connect_account.side_effect = PaymentsError(
        "Stripe nicht konfiguriert.", status_code=503
    )
    with patch(
        "src.features.payments.service.PaymentsService", return_value=fake_payments
    ):
        # Darf NICHT werfen — Firmenprofil bleibt gespeichert.
        svc._ensure_connect_account("t1", _profile_row())  # noqa: SLF001
    assert "stripe_account_id" not in db.store["tenant_billing_profile"][0]
