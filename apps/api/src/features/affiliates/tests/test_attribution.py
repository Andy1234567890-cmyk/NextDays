"""Attribution: Code → Betrieb, mit Betrugsregeln, nie doppelt, nie stumm."""

from __future__ import annotations

from src.features.affiliates import attribution as att

from .fakedb import FakeDb

AFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
CODE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
TEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def _db(*, status: str = "approved") -> FakeDb:
    return FakeDb(
        {
            "affiliates": [
                {
                    "id": AFF,
                    "email": "pia@agentur-nord.de",
                    "full_name": "Pia",
                    "language": "de",
                    "status": status,
                }
            ],
            "affiliate_referral_codes": [
                {"id": CODE_ID, "affiliate_id": AFF, "code": "PIA-K7P2", "active": True}
            ],
        }
    )


def test_code_normalisieren() -> None:
    assert att.code_normalisieren(" pia-k7p2 ") == "PIA-K7P2"
    assert att.code_normalisieren("-abc") is None
    assert att.code_normalisieren("ab") is None
    assert att.code_normalisieren("hat leer zeichen!") is None
    assert att.code_normalisieren(None) is None


def test_code_vorschlag_aus_vorname() -> None:
    code = att.code_vorschlag("Anna-Lena Müller")
    vorname, zufall = code.split("-", 1)
    assert vorname == "ANNALENA"
    assert len(zufall) == 4


def test_klick_speichert_nur_hashes() -> None:
    db = _db()
    ergebnis = att.klick_erfassen(
        db,
        code="pia-k7p2",
        ip="203.0.113.7",
        user_agent="UA",
        referrer="https://insta.example/x",
        utm={"utm_source": "instagram", "fremd": "weg"},
        landing="/",
    )
    assert ergebnis is not None and ergebnis["code"] == "PIA-K7P2"
    klick = db.zeilen("affiliate_clicks")[0]
    assert klick["ip_hash"] != "203.0.113.7" and len(klick["ip_hash"]) == 64
    assert klick["utm"] == {"utm_source": "instagram"}
    assert klick["click_token"] == ergebnis["click_token"]


def test_unbekannter_code_ist_kein_klick() -> None:
    db = _db()
    assert (
        att.klick_erfassen(
            db, code="NIX-0000", ip=None, user_agent=None, referrer=None, utm=None, landing=None
        )
        is None
    )
    assert db.zeilen("affiliate_clicks") == []


def test_zuordnung_ueber_klick_ist_method_url() -> None:
    db = _db()
    klick = att.klick_erfassen(
        db, code="PIA-K7P2", ip="1.2.3.4", user_agent="UA", referrer=None, utm=None, landing=None
    )
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="hotel@seeblick.example",
        code="PIA-K7P2",
        click_token=klick["click_token"],
        contact_opt_in=True,
    )
    assert ref is not None
    assert ref["method"] == "url" and ref["status"] == "pending" and ref["flags"] == []
    assert ref["contact_opt_in"] is True
    assert ref["click_id"] == db.zeilen("affiliate_clicks")[0]["id"]


def test_zuordnung_ohne_klick_ist_method_code() -> None:
    db = _db()
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="hotel@seeblick.example",
        code="pia-k7p2",
        click_token=None,
        contact_opt_in=False,
    )
    assert ref is not None and ref["method"] == "code"


def test_selbstwerbung_wird_abgelehnt_aber_festgehalten() -> None:
    db = _db()
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="PIA@agentur-nord.de",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    assert ref is not None
    assert ref["status"] == "rejected" and ref["flags"] == ["self_referral"]


def test_gleiche_firmendomain_haelt_an() -> None:
    db = _db()
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="chef@agentur-nord.de",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    assert ref["status"] == "held" and "same_email_domain" in ref["flags"]


def test_freemailer_domain_ist_kein_flag() -> None:
    db = _db()
    db.zeilen("affiliates")[0]["email"] = "pia@gmail.com"
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="hotel@gmail.com",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    assert ref["status"] == "pending" and ref["flags"] == []


def test_wegwerfadresse_haelt_an() -> None:
    db = _db()
    ref = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="x@mailinator.com",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    assert ref["status"] == "held" and "disposable_email" in ref["flags"]


def test_zweiter_code_aendert_die_zuordnung_nicht() -> None:
    db = _db()
    erste = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="hotel@seeblick.example",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    zweite = att.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="hotel@seeblick.example",
        code="PIA-K7P2",
        click_token=None,
        contact_opt_in=False,
    )
    assert erste is not None and zweite is None
    assert len(db.zeilen("affiliate_referrals")) == 1


def test_bewerber_code_zaehlt_nicht() -> None:
    db = _db(status="pending_review")
    assert (
        att.zuordnen(
            db,
            tenant_id=TEN,
            tenant_email="hotel@seeblick.example",
            code="PIA-K7P2",
            click_token=None,
            contact_opt_in=False,
        )
        is None
    )
    assert db.zeilen("affiliate_referrals") == []


def test_unbekannter_code_bricht_nichts() -> None:
    db = _db()
    assert (
        att.zuordnen(
            db,
            tenant_id=TEN,
            tenant_email="hotel@seeblick.example",
            code="FALSCH",
            click_token=None,
            contact_opt_in=False,
        )
        is None
    )
