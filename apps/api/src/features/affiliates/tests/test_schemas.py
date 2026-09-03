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


# --- Handle führt, Adresse ist optional (03.09.2026) --------------------------


def test_kanal_nur_handle_baut_adresse() -> None:
    k = SocialKanal(platform="instagram", handle="@pia.reist")
    assert k.handle == "pia.reist"
    assert k.url == "https://www.instagram.com/pia.reist"


def test_kanal_handle_je_plattform_richtig_gebaut() -> None:
    assert SocialKanal(platform="tiktok", handle="pia").url == "https://www.tiktok.com/@pia"
    assert SocialKanal(platform="youtube", handle="pia").url == "https://www.youtube.com/@pia"
    assert (
        SocialKanal(platform="linkedin", handle="pia").url
        == "https://www.linkedin.com/in/pia"
    )
    assert SocialKanal(platform="telegram", handle="pia").url == "https://t.me/pia"


def test_kanal_adresse_liefert_handle_nach() -> None:
    k = SocialKanal(platform="linkedin", url="https://www.linkedin.com/in/pia-partner/")
    assert k.handle == "pia-partner"


def test_kanal_adresse_gewinnt_vor_gebautem_muster() -> None:
    # Wer eine echte Adresse angibt, behält sie — auch wenn sie nicht dem
    # Muster entspricht (Kurz-Links, Vanity-Pfade).
    k = SocialKanal(platform="instagram", handle="pia", url="https://instagr.am/pia_alt")
    assert k.url == "https://instagr.am/pia_alt"
    assert k.handle == "pia"


def test_kanal_ohne_handle_und_ohne_adresse_faellt() -> None:
    with pytest.raises(ValidationError, match="Benutzername oder Adresse"):
        SocialKanal(platform="instagram")


def test_kanal_handle_mit_unerlaubten_zeichen_faellt() -> None:
    with pytest.raises(ValidationError):
        SocialKanal(platform="instagram", handle="pia/../etc")
    with pytest.raises(ValidationError):
        SocialKanal(platform="instagram", handle="pia reist")


def test_website_braucht_weiterhin_die_adresse() -> None:
    # Generische Kanäle haben kein Profil-Muster — ein Handle allein reicht nicht.
    for plattform in ("website", "blog", "newsletter", "podcast", "other", "whatsapp"):
        with pytest.raises(ValidationError, match="vollständige Adresse"):
            SocialKanal(platform=plattform, handle="pia")


def test_bewerbung_mit_handle_statt_url() -> None:
    daten = _bewerbung()
    daten.pop("channel_url")
    daten["channels"] = [{"platform": "instagram", "handle": "pia", "followers": 4200}]
    b = PartnerBewerbung(**daten)
    assert b.channel_url == "https://www.instagram.com/pia"
    assert b.channels[0].handle == "pia"


def test_bewerbung_doppelter_handle_faellt() -> None:
    # Zwei Handles auf derselben Plattform ergeben dieselbe Adresse — der
    # bestehende Dublettenschutz greift auch über den gebauten Wert.
    daten = _bewerbung()
    daten.pop("channel_url")
    daten["channels"] = [
        {"platform": "instagram", "handle": "pia"},
        {"platform": "instagram", "handle": "@pia"},
    ]
    with pytest.raises(ValidationError, match="doppelt"):
        PartnerBewerbung(**daten)


# --- Newsletter-Einwilligung --------------------------------------------------


def test_newsletter_standardmaessig_aus() -> None:
    # Eine vorausgewählte Box wäre keine Einwilligung (DSGVO Art. 4 Nr. 11).
    assert PartnerBewerbung(**_bewerbung()).newsletter_opt_in is False


def test_newsletter_mit_wortlaut() -> None:
    b = PartnerBewerbung(
        **_bewerbung(newsletter_opt_in=True, newsletter_consent_text="Ja, Neuigkeiten.")
    )
    assert b.newsletter_opt_in is True
    assert b.newsletter_consent_text == "Ja, Neuigkeiten."


def test_adresse_korrigiert_die_plattform() -> None:
    """Die Adresse entscheidet, nicht das mitgeschickte Feld.

    Sonst stünde eine YouTube-Adresse als „instagram" in der Zeile — mit
    fremdem Logo im Backoffice und der falschen Reichweitenprüfung. Das
    Formular korrigiert es beim Tippen; ein direkter API-Aufruf tat es nicht.
    """
    k = SocialKanal(platform="instagram", url="https://www.youtube.com/@piareist")
    assert k.platform == "youtube"
    assert k.handle == "piareist"


def test_unbekannte_adresse_behaelt_die_angabe() -> None:
    # Kein bekannter Host → die Angabe des Bewerbers bleibt stehen.
    k = SocialKanal(platform="blog", url="https://pia.example/blog")
    assert k.platform == "blog"


# --- Auszahlungsweg „stripe" (03.09.2026) -------------------------------------


def test_payout_method_kennt_stripe() -> None:
    """`stripe` MUSS ein gültiger Auszahlungsweg sein.

    DER LIVE-AUSFALL: `connect.konto_anlegen` schreibt
    `affiliates.payout_method = 'stripe'` (der CHECK der Tabelle erlaubt es
    seit 0522). Das Pydantic-Literal kannte nur die drei ALTEN Wege. Folge:
    sobald ein Partner ein Verbundkonto eröffnet hatte, warf `/affiliates/me`
    einen ValidationError — HTTP 500 — und das KOMPLETTE Partner-Dashboard
    zeigte „Application error: a server-side exception has occurred"
    (digest 3505509738). Nicht eine Seite: jede, weil das Profil im Layout
    geladen wird.

    Der Fehler war unsichtbar, solange kein Konto existierte. Er entstand nicht
    beim Schreiben, sondern beim LESEN — der Schreibpfad kam durch die DB
    (CHECK erlaubt), nur das Lesemodell nicht.
    """
    from src.features.affiliates.schemas import PayoutMethod

    erlaubt = set(PayoutMethod.__args__)  # type: ignore[attr-defined]
    assert "stripe" in erlaubt, "connect.py schreibt diesen Wert"
    # Die drei alten Wege bleiben: Altbestand darf keinen 422 auslösen (0522).
    assert {"wise", "sepa", "paypal"} <= erlaubt


def test_payout_method_deckt_den_db_check() -> None:
    """Das Literal und der CHECK der Tabelle müssen deckungsgleich sein.

    Gemessen an der Live-DB (03.09.2026):
        CHECK (payout_method IS NULL OR payout_method = ANY
               (ARRAY['wise','sepa','paypal','stripe']))
    Ein Wert, den die DB erlaubt und das Schema nicht, ist genau der Ausfall
    oben. Umgekehrt wäre es ein 500 beim Schreiben. Wer die Liste erweitert,
    braucht BEIDE Stellen plus eine Migration.
    """
    from src.features.affiliates.schemas import PayoutMethod

    assert set(PayoutMethod.__args__) == {  # type: ignore[attr-defined]
        "wise",
        "sepa",
        "paypal",
        "stripe",
    }
