"""Tests für die automatische Stripe-Connect-Anlage beim Firmenprofil-Speichern.

Plattform-Regel: ein Objektbesitzer braucht zum Auszahlen einen Connected Account;
er entsteht automatisch aus den Onboarding-Firmendaten. Stripe wird hier gemockt
(die echte Stripe-Anbindung deckt der payments-Slice ab) — Fokus: wird der Account
angelegt + die Daten übertragen, ist es idempotent, und scheitert das Speichern
NICHT, wenn Stripe nicht verfügbar ist.
"""
from unittest.mock import MagicMock, patch

import pytest

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
    # business_type ist ab jetzt IMMER gesetzt (Stripe-Pflicht) — ohne Rechtsform
    # ist der Default individual (kein erfundener Firmenzwang).
    fields = _connect_fields_from_profile({"email": "h@example.com"})
    assert fields == {
        "business_type": "individual",
        "individual": {"email": "h@example.com"},
    }


def test_connect_fields_einzelunternehmen_is_individual() -> None:
    # Einzelunternehmen MUSS individual sein (kein representative/company),
    # auch wenn das grobe account_type fälschlich "company" sagt.
    fields = _connect_fields_from_profile(
        {
            "legal_form": "Einzelunternehmen",
            "account_type": "company",
            "legal_name": "Andy Staudinger",
            "email": "a@example.com",
            "managing_director_first_name": "Andy",
            "managing_director_last_name": "Staudinger",
        }
    )
    assert fields["business_type"] == "individual"
    assert "company" not in fields
    assert fields["individual"]["first_name"] == "Andy"


def test_connect_fields_gmbh_is_company_with_structure() -> None:
    # Echte GmbH → company + structure private_corporation, keine Person im
    # Account-Update (die kommt über die Persons-API). company.tax_id ist bei
    # Stripe DE die HANDELSREGISTERNUMMER, NICHT die Steuernummer (live verifiziert).
    fields = _connect_fields_from_profile(
        {
            "legal_form": "GmbH",
            "account_type": "company",
            "legal_name": "Muster GmbH",
            "company_register": "HRB 12345",
            "company_city": "Berlin",
            "company_country": "DE",
            "phone_number": "+49301234567",
        }
    )
    assert fields["business_type"] == "company"
    assert fields["company"]["structure"] == "private_corporation"
    assert fields["company"]["phone"] == "+49301234567"
    assert "individual" not in fields


def test_connect_fields_gmbh_maps_handelsregister_to_tax_id() -> None:
    # company_register (HRB) → Stripe company.tax_id. KRITISCH: Stripe DE führt die
    # Handelsregisternummer im tax_id-Feld und validiert sie gegen das HR-Format
    # („HRB 1234"). OHNE dieses Mapping bleibt eine GmbH dauerhaft „Restricted".
    fields = _connect_fields_from_profile(
        {
            "legal_form": "GmbH", "account_type": "company",
            "legal_name": "Muster GmbH", "company_country": "DE",
            "company_register": "HRB 12345",
        }
    )
    assert fields["company"]["tax_id"] == "HRB 12345"


def test_connect_fields_gmbh_steuernummer_not_sent_as_tax_id() -> None:
    # Die deutsche STEUERNUMMER gehört NICHT in company.tax_id (Stripe DE lehnt sie
    # als tax_id_invalid ab — dort steht die Handelsregisternummer). Ohne HRB darf
    # kein tax_id gesetzt werden (kein Fehlmapping der Steuernummer).
    fields = _connect_fields_from_profile(
        {
            "legal_form": "GmbH", "account_type": "company",
            "legal_name": "Muster GmbH", "company_country": "DE",
            "tax_number": "123/456/78910",
        }
    )
    assert "tax_id" not in fields.get("company", {})


def test_connect_fields_normalizes_phone_to_e164() -> None:
    # Das anzeige-freundliche „+49 30 1234567" (mit Leerzeichen) MUSS als striktes
    # E.164 „+49301234567" an Stripe gehen — sonst lehnt Stripe die ganze Nummer
    # ab und das Account-Update (mit HRB/representative) scheitert komplett.
    fields = _connect_fields_from_profile(
        {
            "legal_form": "GmbH", "account_type": "company",
            "legal_name": "Muster GmbH", "company_country": "DE",
            "phone_number": "+49 30 1234567",
        }
    )
    assert fields["company"]["phone"] == "+49301234567"


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
    fake_payments.sync_connect_fields.return_value = (MagicMock(), [])
    with patch(
        "src.features.payments.service.PaymentsService", return_value=fake_payments
    ):
        svc._ensure_connect_account("t1", _profile_row())  # noqa: SLF001
    # Account-ID wurde im Profil gespeichert.
    assert db.store["tenant_billing_profile"][0]["stripe_account_id"] == "acct_new"
    # Firmendaten + IBAN wurden übertragen.
    fake_payments.sync_connect_fields.assert_called_once()
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
        fake_payments.sync_connect_fields.return_value = (MagicMock(), [])
        svc._ensure_connect_account(  # noqa: SLF001
            "t1", {**_profile_row(), "website": "https://muster.example"}
        )
    fake_payments.create_connect_account.assert_not_called()
    fake_payments.set_external_account.assert_not_called()
    fake_payments.sync_connect_fields.assert_called_once()
    tenant_id, account_id, fields = fake_payments.sync_connect_fields.call_args.args
    assert tenant_id == "t1"
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
    with patch("src.features.payments.service.PaymentsService") as cls:
        cls.return_value.sync_connect_fields.return_value = (MagicMock(), [])
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


def test_rejected_field_is_reported_but_sync_continues() -> None:
    """Stripe weist EIN Nebenfeld ab (z. B. eine Website-Domain, die es nicht
    gibt) — die übrigen KYC-Daten sind trotzdem angekommen, und der Grund landet
    sichtbar im Profil. Vorher kippte ein solches Feld das gesamte Update: keine
    einzige Pflichtangabe kam bei Stripe an und die UI behauptete weiterhin, es
    fehlten Angaben."""
    db = _DB()
    db.store["tenant_billing_profile"].append(
        {"tenant_id": "t1", "stripe_account_id": "acct_exists"}
    )
    svc = BuchhaltungService(db)
    with patch("src.features.payments.service.PaymentsService") as cls:
        cls.return_value.sync_connect_fields.return_value = (
            MagicMock(),
            ["business_profile[url]: Not a valid URL"],
        )
        svc._ensure_connect_account(  # noqa: SLF001
            "t1", {**_profile_row(), "website": "https://gibtesnicht.invalid"}
        )
    fehler = db.store["tenant_billing_profile"][0]["stripe_sync_error"]
    assert "Website" in fehler
    assert "Not a valid URL" in fehler


def test_resync_stripe_profile_resends_saved_data() -> None:
    """Wiederanlauf aus der Zahlungen-Karte: die GESPEICHERTEN Stammdaten gehen
    erneut an Stripe, ohne dass der Nutzer das Formular anfassen muss. Vorher lief
    der Sync nur beim Speichern — scheiterte er dort, war die Karte eine Sackgasse
    (Angaben im Profil vorhanden, bei Stripe nicht)."""
    db = _DB()
    db.store["tenant_billing_profile"].append(
        {**_profile_row(), "stripe_account_id": "acct_exists"}
    )
    svc = BuchhaltungService(db)
    with patch("src.features.payments.service.PaymentsService") as cls:
        cls.return_value.sync_connect_fields.return_value = (MagicMock(), [])
        svc.resync_stripe_profile(_CTX)
    cls.return_value.sync_connect_fields.assert_called_once()
    _tid, acct, fields = cls.return_value.sync_connect_fields.call_args.args
    assert acct == "acct_exists"
    assert fields["individual"]["email"] == "host@example.com"


def test_resync_stripe_profile_without_profile_is_404() -> None:
    """Ohne gespeicherte Stammdaten gibt es nichts zu senden — klarer 404 statt
    eines leeren Stripe-Updates."""
    from src.features.buchhaltung.service import BuchhaltungError

    svc = BuchhaltungService(_DB())
    with pytest.raises(BuchhaltungError) as exc:
        svc.resync_stripe_profile(_CTX)
    assert exc.value.status_code == 404
