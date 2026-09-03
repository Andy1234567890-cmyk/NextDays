"""Verbundkonto (0522) — Anlage, Spiegel, Transfer, Gegenzustände.

Der Stripe-Client ist ein Doppel: geprüft wird, WAS wir an Stripe schicken und
was wir aus der Antwort machen — nicht Stripe selbst. Genau dort sitzen die
Fehler, die live Geld kosten (zweiter Account, doppelter Transfer, veralteter
Freischaltstand, ausgezahlt-aber-nie-angekommen).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest

from src.features.affiliates import auszahlung, connect
from src.features.affiliates.fehler import AffiliateError

from .fakedb import FakeDb
from .test_provision import AFF

KONTO = "acct_1TestPartner"


class _Objekt:
    """Antwortobjekt mit Attributzugriff wie das Stripe-SDK."""

    def __init__(self, **felder: Any) -> None:
        for k, v in felder.items():
            setattr(self, k, v)


class _Accounts:
    def __init__(self, doppel: _Stripe) -> None:
        self._d = doppel
        self.persons = _Persons(doppel)

    def create(self, *, params: dict[str, Any]) -> _Objekt:
        self._d.angelegt.append(params)
        return _Objekt(id=KONTO)

    def retrieve(self, konto: str) -> _Objekt:
        self._d.gelesen.append(konto)
        return _Objekt(
            id=konto,
            payouts_enabled=self._d.payouts,
            details_submitted=self._d.details,
            requirements=_Objekt(
                currently_due=list(self._d.offen), disabled_reason=self._d.grund
            ),
            external_accounts=_Objekt(data=self._d.banken),
        )

    def update(self, konto: str, *, params: dict[str, Any]) -> _Objekt:
        self._d.updates.append((konto, params))
        return _Objekt(id=konto)


class _Persons:
    def __init__(self, doppel: _Stripe) -> None:
        self._d = doppel

    def list(self, konto: str, *, params: dict[str, Any]) -> _Objekt:  # noqa: A003
        _ = konto, params
        return _Objekt(data=self._d.personen)

    def create(self, konto: str, *, params: dict[str, Any]) -> _Objekt:
        self._d.person_create.append((konto, params))
        return _Objekt(id="person_1")

    def update(self, konto: str, person: str, *, params: dict[str, Any]) -> _Objekt:
        self._d.person_update.append((konto, person, params))
        return _Objekt(id=person)


class _Transfers:
    def __init__(self, doppel: _Stripe) -> None:
        self._d = doppel

    def create(self, *, params: dict[str, Any], options: dict[str, Any]) -> _Objekt:
        self._d.transfers.append((params, options))
        if self._d.transfer_fehler is not None:
            raise self._d.transfer_fehler
        return _Objekt(id=f"tr_{len(self._d.transfers)}")


class _V1:
    def __init__(self, doppel: _Stripe) -> None:
        self.accounts = _Accounts(doppel)
        self.transfers = _Transfers(doppel)


class _Stripe:
    def __init__(
        self, *, payouts: bool = False, details: bool = False, offen: list[str] | None = None
    ) -> None:
        self.payouts = payouts
        self.details = details
        self.offen = offen or []
        self.grund: str | None = None
        self.banken: list[Any] = []
        self.personen: list[Any] = []
        self.angelegt: list[dict[str, Any]] = []
        self.gelesen: list[str] = []
        self.updates: list[tuple[str, dict[str, Any]]] = []
        self.person_create: list[tuple[str, dict[str, Any]]] = []
        self.person_update: list[tuple[str, str, dict[str, Any]]] = []
        self.transfers: list[tuple[dict[str, Any], dict[str, Any]]] = []
        self.transfer_fehler: Exception | None = None
        self.v1 = _V1(self)


def _db(**partner: Any) -> FakeDb:
    zeile = {
        "id": AFF,
        "email": "pia@example.com",
        "full_name": "Pia",
        "company": None,
        "legal_form": "private",
        "country": "DK",
        "language": "de",
        "status": "approved",
        "stripe_account_id": None,
        "stripe_payouts_enabled": False,
        "stripe_details_submitted": False,
        "stripe_requirements": [],
        "stripe_disabled_reason": None,
    }
    zeile.update(partner)
    return FakeDb({"affiliates": [zeile], "affiliate_stripe_events": []})


# --- Anlage -------------------------------------------------------------------


def test_konto_wird_mit_transfers_und_full_agreement_angelegt() -> None:
    """Die Kontoform ist die Entscheidung aus 0522 — sie muss im Aufruf stehen.

    `recipient` gibt es für eine DK-Plattform nicht, `card_payments` braucht ein
    Partner nie. Beides wäre live erst auffällig, wenn die Freischaltung hängt.
    """
    db, sc = _db(), _Stripe()
    connect.konto_anlegen(db, AFF, stripe=sc)
    params = sc.angelegt[0]
    assert params["type"] == "custom"
    assert params["tos_acceptance"]["service_agreement"] == "full"
    assert params["capabilities"] == {"transfers": {"requested": True}}
    assert "card_payments" not in params["capabilities"]
    assert params["country"] == "DK"
    assert params["business_type"] == "individual"
    assert params["metadata"]["affiliate_id"] == AFF
    assert db.zeilen("affiliates")[0]["stripe_account_id"] == KONTO
    # Der Auszahlungsweg steht ab jetzt auf 'stripe'.
    assert db.zeilen("affiliates")[0]["payout_method"] == "stripe"


def test_zweiter_aufruf_legt_kein_zweites_konto_an() -> None:
    """Wurzel 2: Doppelklick oder Retry darf kein zweites Konto erzeugen —
    ein Custom Account lässt sich nicht mehr löschen, sobald er Guthaben trug."""
    db, sc = _db(), _Stripe()
    connect.konto_anlegen(db, AFF, stripe=sc)
    connect.konto_anlegen(db, AFF, stripe=sc)
    assert len(sc.angelegt) == 1


def test_bewerber_bekommt_kein_konto() -> None:
    db, sc = _db(status="pending_review"), _Stripe()
    with pytest.raises(AffiliateError) as exc:
        connect.konto_anlegen(db, AFF, stripe=sc)
    assert exc.value.status_code == 409
    assert sc.angelegt == []


def test_ohne_land_klar_fehlschlagen_statt_raten() -> None:
    """Wurzel 4: kein Fantasie-Land. Ein geratenes Land legt das Konto in der
    falschen Rechtsordnung an — irreversibel."""
    db, sc = _db(country=""), _Stripe()
    with pytest.raises(AffiliateError) as exc:
        connect.konto_anlegen(db, AFF, stripe=sc)
    assert exc.value.status_code == 422


def test_unternehmen_wird_als_company_angelegt() -> None:
    db, sc = _db(legal_form="company"), _Stripe()
    connect.konto_anlegen(db, AFF, stripe=sc)
    assert sc.angelegt[0]["business_type"] == "company"


# --- Spiegel ------------------------------------------------------------------


def test_status_spiegelt_freischaltung_und_offene_felder() -> None:
    db = _db(stripe_account_id=KONTO)
    sc = _Stripe(payouts=True, details=True, offen=[])
    stand = connect.status_abgleichen(db, AFF, stripe=sc)
    assert stand["auszahlbar"] is True
    zeile = db.zeilen("affiliates")[0]
    assert zeile["stripe_payouts_enabled"] is True
    assert zeile["stripe_details_submitted"] is True


def test_spiegel_korrigiert_veralteten_stand_auf_gesperrt() -> None:
    """Der gespiegelte Stand ist das Gate des Auszahlungslaufs.

    Bleibt der Webhook aus und Stripe hat inzwischen gesperrt, stünde hier ein
    altes `true` — der Lauf liefe gegen eine Wand. Jeder Statusabruf schreibt
    deshalb gegen.
    """
    db = _db(stripe_account_id=KONTO, stripe_payouts_enabled=True)
    sc = _Stripe(payouts=False, offen=["individual.verification.document"])
    stand = connect.status_abgleichen(db, AFF, stripe=sc)
    assert stand["auszahlbar"] is False
    assert stand["offene_felder"] == ["individual.verification.document"]
    assert db.zeilen("affiliates")[0]["stripe_payouts_enabled"] is False
    # Der Wechsel wird protokolliert — sonst weiß niemand, seit wann es hängt.
    ereignisse = [e["event"] for e in db.zeilen("affiliate_stripe_events")]
    assert "payouts_disabled" in ereignisse


def test_ohne_konto_kein_stripe_aufruf() -> None:
    db, sc = _db(), _Stripe()
    stand = connect.status_abgleichen(db, AFF, stripe=sc)
    assert stand["verbunden"] is False and sc.gelesen == []


# --- Bank / Personen / ToS ----------------------------------------------------


def test_bank_verlangt_waehrung_und_raet_sie_nicht() -> None:
    """Wurzel 4: ein dänischer Partner kann ein EUR-Konto führen. Eine geratene
    Währung legt ein zweites externes Konto an, das Stripe nie bedient."""
    db = _db(stripe_account_id=KONTO)
    sc = _Stripe()
    connect.bank_setzen(
        db, AFF, iban="DK5000400440116243", kontoinhaber="Pia", waehrung="EUR", stripe=sc
    )
    _konto, params = sc.updates[0]
    assert params["external_account"]["currency"] == "eur"
    assert params["external_account"]["country"] == "DK"
    with pytest.raises(AffiliateError):
        connect.bank_setzen(
            db, AFF, iban="DK50", kontoinhaber="Pia", waehrung="", stripe=sc
        )


def test_person_wird_aktualisiert_nicht_dupliziert() -> None:
    """Wurzel 2: sonst sammelt der Account bei jedem Speichern eine weitere
    Person und Stripe fragt endlos nach."""
    db = _db(stripe_account_id=KONTO, legal_form="company")
    sc = _Stripe()
    sc.personen = [_Objekt(id="person_alt", relationship=_Objekt(representative=True))]
    connect.person_setzen(db, AFF, {"first_name": "Pia", "last_name": "P"}, stripe=sc)
    assert sc.person_update and not sc.person_create
    # Danach die *_provided-Flags, sonst bleibt requirements offen.
    assert any(
        p.get("company", {}).get("owners_provided") for _k, p in sc.updates
    )


def test_person_nur_bei_unternehmen() -> None:
    db = _db(stripe_account_id=KONTO, legal_form="private")
    with pytest.raises(AffiliateError) as exc:
        connect.person_setzen(db, AFF, {"first_name": "Pia"}, stripe=_Stripe())
    assert exc.value.status_code == 409


def test_tos_ohne_ip_schlaegt_fehl() -> None:
    """Die IP ist der Compliance-Nachweis — ohne sie ist die Zustimmung wertlos."""
    db = _db(stripe_account_id=KONTO)
    with pytest.raises(AffiliateError) as exc:
        connect.bedingungen_annehmen(db, AFF, ip="", zeitpunkt=1, stripe=_Stripe())
    assert exc.value.status_code == 422


# --- Transfer -----------------------------------------------------------------


def _payout(betrag: str = "80.00") -> dict[str, Any]:
    return {
        "id": "payout-1",
        "affiliate_id": AFF,
        "amount": betrag,
        "currency": "EUR",
        "statement_no": "PA-2026-00001",
        "stripe_account_id_ziel": KONTO,
    }


def test_transfer_traegt_betrag_im_idempotency_key() -> None:
    """Der Key MUSS den Betrag enthalten (Lehre aus dem Stripe-Bug vom
    01.09.2026): nur die Id würde bei geänderter Summe still den alten Transfer
    zurückgeben."""
    db, sc = _db(stripe_account_id=KONTO), _Stripe()
    connect.transfer_ausloesen(db, _payout("80.00"), stripe=sc)
    params, options = sc.transfers[0]
    assert params["amount"] == 8000
    assert params["currency"] == "eur"
    assert params["destination"] == KONTO
    assert "8000" in options["idempotency_key"]
    assert "payout-1" in options["idempotency_key"]


def test_transfer_ohne_konto_wird_abgelehnt() -> None:
    db = _db()
    zahlung = _payout()
    zahlung["stripe_account_id_ziel"] = None
    with pytest.raises(AffiliateError) as exc:
        connect.transfer_ausloesen(db, zahlung, stripe=_Stripe())
    assert exc.value.status_code == 409


# --- Webhook (Gegenzustände) --------------------------------------------------


def test_fehlgeschlagener_transfer_gibt_die_zeilen_wieder_frei() -> None:
    """Wurzel 1: sonst gilt Geld als ausgezahlt, das nie ankam — und die
    Provision wäre für immer verloren."""
    db = FakeDb(
        {
            "affiliates": [{"id": AFF, "email": "p@x", "full_name": "Pia"}],
            "affiliate_payouts": [
                {
                    "id": "payout-1",
                    "affiliate_id": AFF,
                    "status": "paid",
                    "stripe_transfer_id": "tr_1",
                }
            ],
            "affiliate_commissions": [
                {"id": "c1", "payout_id": "payout-1", "status": "paid"}
            ],
            "affiliate_payout_items": [{"payout_id": "payout-1", "commission_id": "c1"}],
            "affiliate_stripe_events": [],
        }
    )
    aktion = connect.webhook_verarbeiten(
        db, {"type": "transfer.failed", "data": {"object": {"id": "tr_1"}}}
    )
    assert aktion == "transfer_failed"
    assert db.zeilen("affiliate_payouts")[0]["status"] == "failed"
    zeile = db.zeilen("affiliate_commissions")[0]
    assert zeile["payout_id"] is None and zeile["status"] == "approved"
    assert db.zeilen("affiliate_payout_items") == []


def test_fremdes_konto_wird_nicht_angefasst() -> None:
    """account.updated kommt auch für BETRIEBS-Accounts. Ein Treffer auf einen
    fremden Account wäre eine stille Falschzuordnung."""
    db = _db(stripe_account_id=KONTO)
    aktion = connect.webhook_verarbeiten(
        db, {"type": "account.updated", "data": {"object": {"id": "acct_fremd"}}}
    )
    assert aktion is None


# --- Auszahlungslauf mit Transfer --------------------------------------------


def _lauf_db(betrag: str = "80.00", *, konto: str | None = KONTO) -> FakeDb:
    return FakeDb(
        {
            "affiliates": [
                {
                    "id": AFF,
                    "email": "pia@example.com",
                    "full_name": "Pia",
                    "language": "de",
                    "status": "approved",
                    "legal_form": "private",
                    "country": "DK",
                    "vat_id_verified_at": None,
                    "payout_method": "stripe",
                    "payout_details": {},
                    "stripe_account_id": konto,
                    "stripe_payouts_enabled": True,
                }
            ],
            "affiliate_payouts": [
                {
                    "id": "payout-1",
                    "affiliate_id": AFF,
                    "currency": "EUR",
                    "amount": betrag,
                    "method": "stripe",
                    "status": "pending",
                    "statement_no": "PA-2026-00001",
                }
            ],
            "affiliate_commissions": [
                {"id": "c1", "payout_id": "payout-1", "status": "approved"}
            ],
            "affiliate_payout_items": [{"payout_id": "payout-1", "commission_id": "c1"}],
            "affiliate_stripe_events": [],
        }
    )


def test_ausfuehren_bezahlt_und_markiert() -> None:
    db, sc = _lauf_db(), _Stripe()
    ergebnis = auszahlung.ausfuehren(db, ["payout-1"], admin_id="admin", stripe=sc)
    assert ergebnis["bezahlt"] == 1
    zahlung = db.zeilen("affiliate_payouts")[0]
    assert zahlung["status"] == "paid"
    assert zahlung["stripe_transfer_id"] == "tr_1"
    assert db.zeilen("affiliate_commissions")[0]["status"] == "paid"


def test_zweiter_klick_schickt_kein_zweites_geld() -> None:
    """Wurzel 2: der Claim-Guard (pending → processing) muss VOR dem Transfer
    greifen, nicht danach."""
    db, sc = _lauf_db(), _Stripe()
    auszahlung.ausfuehren(db, ["payout-1"], admin_id="admin", stripe=sc)
    ergebnis = auszahlung.ausfuehren(db, ["payout-1"], admin_id="admin", stripe=sc)
    assert ergebnis["bezahlt"] == 0
    assert len(sc.transfers) == 1


def test_fehlschlag_gibt_frei_und_reisst_andere_nicht_mit() -> None:
    """Wurzel 5: ein Fehlschlag bei EINEM Partner darf den Lauf nicht kippen."""
    db, sc = _lauf_db(), _Stripe()
    sc.transfer_fehler = AffiliateError("Konto gesperrt.", status_code=400)
    ergebnis = auszahlung.ausfuehren(db, ["payout-1"], admin_id="admin", stripe=sc)
    assert ergebnis["fehlgeschlagen"] == 1 and ergebnis["fehler"]
    assert db.zeilen("affiliate_payouts")[0]["status"] == "failed"
    # Gegenzustand: die Provisionszeile ist wieder frei für den nächsten Lauf.
    assert db.zeilen("affiliate_commissions")[0]["payout_id"] is None


def test_betrag_wird_korrekt_in_cent_gerechnet() -> None:
    db, sc = _lauf_db("1234.56"), _Stripe()
    auszahlung.ausfuehren(db, ["payout-1"], admin_id="admin", stripe=sc)
    params, _o = sc.transfers[0]
    assert params["amount"] == 123456
    assert Decimal("1234.56") * 100 == Decimal(params["amount"])


# --- Betrugsprüfung überlebt den Wegwechsel ----------------------------------


def test_gleiche_bankverbindung_setzt_team_flag_ueber_fingerabdruck() -> None:
    """Die IBAN liegt seit 0522 bei Stripe — die Prüfung „gleiche Bankverbindung
    wie der Sponsor?" darf dadurch NICHT still ausfallen (Etappe-5-Flag
    `same_iban`). Verglichen wird über einen Fingerabdruck, nicht über die IBAN.
    """
    from src.features.affiliates import attribution

    sponsor = "b0000000-0000-4000-8000-000000000001"
    iban = "DK5000400440116243"
    db = FakeDb(
        {
            "affiliates": [
                {
                    "id": sponsor,
                    "email": "s@x",
                    "full_name": "Sponsor",
                    "country": "DK",
                    "legal_form": "private",
                    "status": "approved",
                    "sponsor_affiliate_id": None,
                    "sponsor_flags": [],
                    "payout_details": {"iban_fp": attribution.iban_fingerabdruck(iban)},
                    "stripe_account_id": KONTO,
                },
                {
                    "id": AFF,
                    "email": "m@x",
                    "full_name": "Mitglied",
                    "country": "DK",
                    "legal_form": "private",
                    "status": "approved",
                    "sponsor_affiliate_id": sponsor,
                    "sponsor_flags": [],
                    "payout_details": {},
                    "stripe_account_id": "acct_mitglied",
                },
            ],
            "affiliate_stripe_events": [],
        }
    )
    connect.bank_setzen(
        db, AFF, iban=iban, kontoinhaber="Wer", waehrung="EUR", stripe=_Stripe()
    )
    mitglied = [z for z in db.zeilen("affiliates") if z["id"] == AFF][0]
    assert "same_iban" in (mitglied.get("sponsor_flags") or [])
    # Die IBAN selbst wird NICHT gespeichert — nur Fingerabdruck und Endziffern.
    details = mitglied["payout_details"]
    assert "iban" not in details
    assert details["iban_fp"] == attribution.iban_fingerabdruck(iban)
    assert details["iban_ende"] == "6243"


def test_fingerabdruck_ist_stabil_und_nicht_die_iban() -> None:
    from src.features.affiliates import attribution

    a = attribution.iban_fingerabdruck("DK50 0040 0440 1162 43")
    b = attribution.iban_fingerabdruck("dk5000400440116243")
    assert a == b  # Leerzeichen und Kleinschreibung sind gleichwertig
    assert "1162" not in a and len(a) == 64


# --- Pflichtfelder aus der Ländervorgabe ----------------------------------------


def _daten(**extra: Any) -> Any:
    from src.features.affiliates.schemas import ConnectDaten  # noqa: PLC0415

    person = {
        "first_name": "Pia",
        "last_name": "Poulsen",
        "dob": {"day": 1, "month": 2, "year": 1990},
        "address": {"line1": "Vej 1", "postal_code": "9881", "city": "Bindslev"},
    }
    person.update(extra.pop("person", {}))
    return ConnectDaten(url="https://example.com", person=person, **extra)


def test_pflichtfelder_daenemark_verlangen_cpr_nationalitaet_telefon() -> None:
    """Stripe (country_specs DK, individual) verlangt id_number, nationality,
    phone und email — genau die Felder, die das alte Formular nicht abfragte."""
    from src.features.affiliates.connect_service import fehlende_pflichtfelder  # noqa: PLC0415

    minimum = {
        "individual.id_number", "individual.nationality", "individual.phone",
        "individual.email", "individual.first_name", "external_account",
    }
    assert fehlende_pflichtfelder(minimum, _daten(), firma=False) == [
        "individual.email", "individual.id_number", "individual.nationality", "individual.phone",
    ]
    voll = _daten(person={"id_number": "010290-1234", "nationality": "DK",
                          "phone": "+4512345678", "email": "pia@example.com"})
    assert fehlende_pflichtfelder(minimum, voll, firma=False) == []


def test_pflichtfelder_unternehmen_register_und_ust_id() -> None:
    from src.features.affiliates.connect_service import fehlende_pflichtfelder  # noqa: PLC0415

    minimum = {
        "company.registration_number", "company.tax_id", "company.vat_id", "company.phone",
        "representative.id_number", "representative.email", "company.address.state",
    }
    req = _daten(company_name="Pia ApS",
                 company_address={"line1": "Vej 1", "postal_code": "9881", "city": "Bindslev"})
    assert fehlende_pflichtfelder(minimum, req, firma=True) == [
        "company.address.state", "company.phone", "company.registration_number",
        "company.tax_id", "company.vat_id", "representative.email", "representative.id_number",
    ]
    # Für Privatpersonen zählen company-/representative-Felder nicht.
    assert fehlende_pflichtfelder(minimum, req, firma=False) == []


def test_daten_senden_fuellt_email_und_ust_id_aus_dem_profil() -> None:
    """E-Mail und USt-IdNr. stehen im Profil — der Partner tippt sie nicht noch
    einmal; die Pflichtprüfung sieht sie als erfüllt."""
    from src.features.affiliates.connect_service import ConnectMixin  # noqa: PLC0415

    db = _db(stripe_account_id=KONTO, legal_form="company", country="DE",
             vat_id="DE123456789", company="Pia GmbH")
    gesendet: list[dict[str, Any]] = []
    personen: list[dict[str, Any]] = []

    class _Svc(ConnectMixin):
        @property
        def db(self) -> FakeDb:
            return db

    import src.features.affiliates.connect_service as modul  # noqa: PLC0415

    original = (
        modul.connect.pflichtfelder, modul.connect.daten_senden, modul.connect.person_setzen
    )
    modul.connect.pflichtfelder = lambda land, art: {  # type: ignore[assignment]
        "minimum": ["company.vat_id", "representative.email", "company.registration_number"],
        "zusaetzlich": [],
    }
    modul.connect.daten_senden = lambda _db, _a, felder: gesendet.append(felder)  # type: ignore[assignment]
    modul.connect.person_setzen = lambda _db, _a, person: personen.append(person) or {}  # type: ignore[assignment]
    try:
        req = _daten(company_name="Pia GmbH", company_registration_number="HRB 1",
                     company_address={"line1": "Weg 1", "postal_code": "20095", "city": "Hamburg"})
        _Svc().connect_daten_senden(AFF, req)
    finally:
        (
            modul.connect.pflichtfelder, modul.connect.daten_senden, modul.connect.person_setzen
        ) = original
    assert gesendet[0]["company"]["vat_id"] == "DE123456789"
    assert gesendet[0]["company"]["registration_number"] == "HRB 1"
    assert personen[0]["email"] == "pia@example.com"
