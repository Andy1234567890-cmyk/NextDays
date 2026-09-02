"""Eingabeprüfung der Bewerbung — was gar nicht erst zum Service kommt."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.features.affiliates.kanaele import plattform_aus_url
from src.features.affiliates.schemas import PartnerBewerbung, PartnerCodeAnlegen, SocialKanal


def _bewerbung(**over: object) -> dict:
    basis = {
        "email": "pia@example.de",
        "password": "langgenug1",
        "full_name": "Pia Partner",
        "legal_form": "private",
        "country": "de",
        "language": "de-AT",
        "channel_url": "https://instagram.com/pia",
        "terms_accepted": True,
        "terms_version": "2026-09",
    }
    basis.update(over)
    return basis


def test_bewerbung_normalisiert_land_und_sprache() -> None:
    b = PartnerBewerbung(**_bewerbung())
    assert b.country == "DE" and b.language == "de"


def test_bewerbung_ohne_zustimmung_faellt() -> None:
    with pytest.raises(ValidationError):
        PartnerBewerbung(**_bewerbung(terms_accepted=False))


def test_bewerbung_kanal_nur_http() -> None:
    with pytest.raises(ValidationError):
        PartnerBewerbung(**_bewerbung(channel_url="javascript:alert(1)"))


def test_bewerbung_unbekannte_sprache_faellt() -> None:
    with pytest.raises(ValidationError):
        PartnerBewerbung(**_bewerbung(language="zh"))


def test_ust_id_wird_bereinigt() -> None:
    b = PartnerBewerbung(**_bewerbung(legal_form="company", vat_id="de 123 456 789"))
    assert b.vat_id == "DE123456789"


def test_wunschcode_wird_grossgeschrieben() -> None:
    assert PartnerCodeAnlegen(code="pia-2026").code == "PIA-2026"
    with pytest.raises(ValidationError):
        PartnerCodeAnlegen(code="pia 2026")


# --- Kanäle (0519) ------------------------------------------------------------


def test_bewerbung_alter_kanal_wird_zu_channels() -> None:
    b = PartnerBewerbung(**_bewerbung(channel_url="https://www.tiktok.com/@pia"))
    assert [k.platform for k in b.channels] == ["tiktok"]
    assert b.channel_url == "https://www.tiktok.com/@pia"


def test_bewerbung_channels_pflicht() -> None:
    daten = _bewerbung()
    daten.pop("channel_url")
    with pytest.raises(ValidationError):
        PartnerBewerbung(**daten)


def test_bewerbung_channels_setzen_channel_url() -> None:
    daten = _bewerbung()
    daten.pop("channel_url")
    daten["channels"] = [
        {
            "platform": "instagram",
            "url": "https://instagram.com/pia",
            "handle": "@pia",
            "followers": 12000,
        },
        {"platform": "website", "url": "https://pia.example"},
    ]
    b = PartnerBewerbung(**daten)
    assert b.channel_url == "https://instagram.com/pia"
    assert b.channels[0].handle == "pia"
    assert b.channels[1].followers is None


def test_kanal_nur_http() -> None:
    with pytest.raises(ValidationError):
        SocialKanal(platform="instagram", url="javascript:alert(1)")


def test_kanaele_doppelte_adresse() -> None:
    daten = _bewerbung()
    daten.pop("channel_url")
    daten["channels"] = [
        {"platform": "instagram", "url": "https://instagram.com/pia"},
        {"platform": "instagram", "url": "https://instagram.com/pia/"},
    ]
    with pytest.raises(ValidationError):
        PartnerBewerbung(**daten)


def test_plattform_aus_url() -> None:
    assert plattform_aus_url("https://vm.tiktok.com/ZM123/") == "tiktok"
    assert plattform_aus_url("https://youtu.be/abc") == "youtube"
    assert plattform_aus_url("https://twitter.com/pia") == "x"
    assert plattform_aus_url("https://pia.example") is None
    assert plattform_aus_url("kein url") is None


def test_bewerbung_nur_website_reicht_nicht() -> None:
    daten = _bewerbung()
    daten.pop("channel_url")
    daten["channels"] = [{"platform": "website", "url": "https://pia.example"}]
    with pytest.raises(ValidationError, match="Social-Media"):
        PartnerBewerbung(**daten)


def test_bewerbung_alter_kanal_website_reicht_nicht() -> None:
    # Altweg channel_url mit reiner Website → ebenfalls Pflichtverletzung.
    with pytest.raises(ValidationError, match="Social-Media"):
        PartnerBewerbung(**_bewerbung(channel_url="https://pia.example"))
