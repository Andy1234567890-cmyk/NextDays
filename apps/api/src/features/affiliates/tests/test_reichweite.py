"""Reichweiten-Etappe (0521): Beiträge, Krypto/state, Anbindung, Sync, Flags.

Fremde Plattformen werden durch einen Fake-Anbieter ersetzt — gegen YouTube/
Meta/TikTok wird hier nichts aufgerufen. Geprüft wird die Mechanik, die uns
gehört: Scope, Idempotenz, Verschlüsselung, Widerruf, Zuordnung, Schwellen.
"""

from __future__ import annotations

import base64
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import SecretStr

from src.core.config import Settings
from src.features.affiliates import (
    attribution,
    beitraege,
    kanal_krypto,
    kanal_plattformen,
    kanal_verbindungen,
    reichweite,
)
from src.features.affiliates.fehler import AffiliateError
from src.features.affiliates.kanal_plattformen import (
    BeitragsMetrik,
    Konto,
    PlattformFehler,
    Snapshot,
    TokenSatz,
)
from src.features.affiliates.schemas_reichweite import (
    FollowerTag,
    KanalReichweite,
    PartnerBeitrag,
    PartnerBeitragAendern,
    PartnerBeitragAnlegen,
)

from . import fakedb
from .fakedb import FakeDb

AFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
AFF2 = "a2a2a2a2-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
CODE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
CODE2_ID = "d2d2d2d2-dddd-4ddd-8ddd-dddddddddddd"
TEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

# UNIQUE-Backstops aus 0521 in der Fake-DB nachbauen (Wurzel 2 wird getestet,
# nicht angenommen). Hier statt in fakedb.py, damit die Datei des Kerns
# unberührt bleibt.
fakedb._UNIQUE.setdefault("affiliate_posts", [(("code_id", "utm_content"), None)])  # noqa: SLF001
fakedb._UNIQUE.setdefault(  # noqa: SLF001
    "affiliate_channel_connections",
    [(("affiliate_id", "platform", "external_account_id"), None)],
)
fakedb._UNIQUE.setdefault(  # noqa: SLF001
    "affiliate_channel_snapshots", [(("connection_id", "snapshot_date"), None)]
)
fakedb._UNIQUE.setdefault("affiliate_post_metrics", [(("post_id", "metric_date"), None)])  # noqa: SLF001


def _settings(**extra: Any) -> Settings:
    # Meta und TikTok stehen hier LEER, und zwar ausdruecklich: `Settings` liest
    # `.env`, also waere ein Test, der nur die Google-Werte setzt, davon
    # abhaengig, welche Anbieter auf DIESEM Rechner gerade eingetragen sind.
    # Genau so ist er gekippt, als Etappe 6 die TIKTOK_*-Variablen bekam — der
    # Test prueft "nicht konfiguriert" und bekam ein konfiguriertes TikTok.
    # `extra` gewinnt, damit ein einzelner Test einen Anbieter zuschalten kann.
    vorgaben: dict[str, Any] = {
        "meta_app_id": "",
        "meta_app_secret": SecretStr(""),
        "tiktok_client_key": "",
        "tiktok_client_secret": SecretStr(""),
    }
    return Settings(
        marketing_base_url="https://mynextdays.com",
        partner_base_url="https://partner.mynextdays.com",
        affiliate_token_key=SecretStr(base64.b64encode(os.urandom(32)).decode()),
        google_oauth_client_id="cid",
        google_oauth_secret=SecretStr("csec"),
        **{**vorgaben, **extra},
    )


def _db() -> FakeDb:
    return FakeDb(
        {
            "affiliates": [
                {
                    "id": AFF,
                    "email": "pia@agentur-nord.de",
                    "full_name": "Pia",
                    "company": None,
                    "language": "de",
                    "status": "approved",
                    "channels": [
                        {
                            "platform": "youtube",
                            "url": "https://www.youtube.com/@pia",
                            "handle": "pia",
                            "followers": 12000,
                        },
                        {
                            "platform": "instagram",
                            "url": "https://www.instagram.com/pia/",
                            "handle": "pia",
                            "followers": 5000,
                        },
                    ],
                },
                {
                    "id": AFF2,
                    "email": "tom@example.org",
                    "full_name": "Tom",
                    "language": "en",
                    "status": "approved",
                    "channels": [],
                },
            ],
            "affiliate_referral_codes": [
                {"id": CODE_ID, "affiliate_id": AFF, "code": "PIA-K7P2", "active": True},
                {"id": CODE2_ID, "affiliate_id": AFF2, "code": "TOM-1234", "active": True},
            ],
            "affiliate_reach_thresholds": [
                {
                    "key": "follower_jump_pct_7d",
                    "value": 30,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
                {
                    "key": "follower_jump_min_followers",
                    "value": 1000,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
                {
                    "key": "low_engagement_rate_pct",
                    "value": 0.5,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
                {
                    "key": "low_engagement_min_followers",
                    "value": 50000,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
                {
                    "key": "self_report_deviation_pct",
                    "value": 25,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
                {
                    "key": "views_without_click_min",
                    "value": 5000,
                    "description": "x",
                    "updated_at": "2026-09-01T00:00:00+00:00",
                },
            ],
        }
    )


# --- Stufe A: Beiträge -----------------------------------------------------------------


def test_utm_content_aus_titel_und_veroeffentlichung() -> None:
    utm = beitraege.utm_content_bilden(
        "Über Nacht: Reel #3 in Kopenhagen!", datetime(2026, 9, 2, tzinfo=UTC)
    )
    assert utm == "uber-nacht-reel-3-in-kopenhagen-2026-09-02"
    ohne = beitraege.utm_content_bilden("", None)
    assert ohne.startswith("beitrag-") and len(ohne) == len("beitrag-") + 4


def test_link_traegt_code_und_utm_parameter() -> None:
    link = beitraege.link_bauen(
        _settings(), code="PIA-K7P2", platform="instagram", utm_content="reel-1"
    )
    assert (
        link
        == "https://mynextdays.com/p/PIA-K7P2?utm_source=instagram&utm_medium=social&utm_content=reel-1"
    )
    assert (
        beitraege.link_bauen(
            Settings(marketing_base_url=""), code="X", platform="x", utm_content="a"
        )
        is None
    )


def test_beitrag_anlegen_nur_am_eigenen_code() -> None:
    db = _db()
    req = PartnerBeitragAnlegen(
        title="Reel Kopenhagen", platform="instagram", url="https://www.instagram.com/reel/ABC123/"
    )
    with pytest.raises(AffiliateError) as exc:
        beitraege.anlegen(db, _settings(), affiliate_id=AFF2, code_id=CODE_ID, req=req)
    assert exc.value.status_code == 404  # fremder Code: nicht gefunden, kein Orakel
    b = beitraege.anlegen(db, _settings(), affiliate_id=AFF, code_id=CODE_ID, req=req)
    assert b.code == "PIA-K7P2" and b.utm_content.startswith("reel-kopenhagen-")
    # Seit 0523 gibt es den Link ERST nach der Videofreigabe. Ein frisch
    # angelegter Beitrag steht auf 'draft' und trägt deshalb bewusst keinen —
    # das ist die Sperre, nicht ein fehlender Wert.
    assert b.review_status == "draft"
    assert b.link is None


def test_beitrag_utm_content_eindeutig_je_code() -> None:
    db = _db()
    req = PartnerBeitragAnlegen(title="A", platform="tiktok", utm_content="reel-2026-09-02")
    beitraege.anlegen(db, _settings(), affiliate_id=AFF, code_id=CODE_ID, req=req)
    with pytest.raises(AffiliateError) as exc:
        beitraege.anlegen(db, _settings(), affiliate_id=AFF, code_id=CODE_ID, req=req)
    assert exc.value.status_code == 409
    # Ohne Wunsch-utm_content weicht der Server aus statt zu scheitern.
    b2 = beitraege.anlegen(
        db,
        _settings(),
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(title="A", platform="tiktok"),
    )
    b3 = beitraege.anlegen(
        db,
        _settings(),
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(title="A", platform="tiktok"),
    )
    assert b2.utm_content != b3.utm_content


def test_kennzahlen_je_beitrag_aus_klicks_und_zuordnung() -> None:
    db = _db()
    b = beitraege.anlegen(
        db,
        _settings(),
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(title="Reel", platform="instagram"),
    )
    jetzt = datetime.now(UTC)
    for i, tage in enumerate((1, 2, 40)):
        db.zeilen("affiliate_clicks").append(
            {
                "id": f"k{i}",
                "code_id": CODE_ID,
                "affiliate_id": AFF,
                "click_token": f"t{i}",
                "utm": {"utm_content": b.utm_content},
                "created_at": (jetzt - timedelta(days=tage)).isoformat(),
            }
        )
    # Klick mit anderem utm_content zählt nicht mit.
    db.zeilen("affiliate_clicks").append(
        {
            "id": "k9",
            "code_id": CODE_ID,
            "affiliate_id": AFF,
            "click_token": "t9",
            "utm": {"utm_content": "anderer"},
            "created_at": jetzt.isoformat(),
        }
    )
    db.zeilen("affiliate_referrals").append(
        {
            "affiliate_id": AFF,
            "tenant_id": TEN,
            "post_id": b.id,
            "status": "approved",
            "first_paid_at": jetzt.isoformat(),
        }
    )
    db.zeilen("tenant_subscription").append({"tenant_id": TEN, "status": "active"})
    db.zeilen("affiliate_post_metrics").append(
        {
            "post_id": b.id,
            "metric_date": "2026-09-01",
            "measured_at": "2026-09-01T10:00:00+00:00",
            "views": 3000,
            "likes": 90,
            "comments": 5,
        }
    )
    [aus] = beitraege.liste(db, _settings(), affiliate_id=AFF)
    assert (aus.clicks_30d, aus.clicks_90d, aus.registrations, aus.paying_customers) == (2, 3, 1, 1)
    assert aus.metrics and aus.metrics.views == 3000
    assert aus.clicks_per_1000_views == 1.0


def test_beitrag_aendern_setzt_externe_id_zurueck_und_loeschen_schuetzt_zuordnung() -> None:
    db = _db()
    b = beitraege.anlegen(
        db,
        _settings(),
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(title="V", platform="youtube"),
    )
    db.zeilen("affiliate_posts")[0]["external_post_id"] = "abc"
    beitraege.aendern(
        db,
        _settings(),
        affiliate_id=AFF,
        post_id=b.id,
        req=PartnerBeitragAendern(url="https://youtu.be/dQw4w9WgXcQ"),
    )
    assert db.zeilen("affiliate_posts")[0]["external_post_id"] is None
    with pytest.raises(AffiliateError) as exc:
        beitraege.aendern(
            db, _settings(), affiliate_id=AFF2, post_id=b.id, req=PartnerBeitragAendern(title="x")
        )
    assert exc.value.status_code == 404
    db.zeilen("affiliate_referrals").append(
        {"affiliate_id": AFF, "tenant_id": TEN, "post_id": b.id, "status": "pending"}
    )
    with pytest.raises(AffiliateError) as exc:
        beitraege.loeschen(db, affiliate_id=AFF, post_id=b.id)
    assert exc.value.status_code == 409


def test_zuordnung_merkt_sich_den_beitrag_aus_dem_klick() -> None:
    db = _db()
    b = beitraege.anlegen(
        db,
        _settings(),
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(title="Reel", platform="instagram"),
    )
    klick = attribution.klick_erfassen(
        db,
        code="pia-k7p2",
        ip="203.0.113.7",
        user_agent="UA",
        referrer=None,
        utm={"utm_source": "instagram", "utm_content": b.utm_content},
        landing="/",
    )
    assert klick is not None
    ref = attribution.zuordnen(
        db,
        tenant_id=TEN,
        tenant_email="chef@hotel.dk",
        code="PIA-K7P2",
        click_token=klick["click_token"],
        contact_opt_in=False,
    )
    assert ref is not None and ref["post_id"] == b.id and ref["method"] == "url"


# --- Krypto / state ------------------------------------------------------------------------


def test_token_verschluesselung_roundtrip_und_manipulation() -> None:
    s = _settings()
    enc = kanal_krypto.verschluesseln(s, "ya29.geheim")
    assert enc != "ya29.geheim" and kanal_krypto.entschluesseln(s, enc) == "ya29.geheim"
    kaputt = enc[:-4] + ("AAAA" if not enc.endswith("AAAA") else "BBBB")
    with pytest.raises(AffiliateError) as exc:
        kanal_krypto.entschluesseln(s, kaputt)
    assert exc.value.status_code == 409
    # Anderer Schlüssel → unlesbar, kein Klartext-Fallback.
    with pytest.raises(AffiliateError):
        kanal_krypto.entschluesseln(_settings(), enc)


def test_ohne_schluessel_fail_closed() -> None:
    with pytest.raises(AffiliateError) as exc:
        kanal_krypto.verschluesseln(Settings(affiliate_token_key=SecretStr("")), "x")
    assert exc.value.status_code == 503
    with pytest.raises(AffiliateError):
        kanal_krypto.schluessel(
            Settings(affiliate_token_key=SecretStr(base64.b64encode(b"kurz").decode()))
        )


def test_state_bindet_partner_und_anbieter() -> None:
    s = _settings()
    state = kanal_krypto.state_erzeugen(s, affiliate_id=AFF, provider="youtube")
    assert kanal_krypto.state_pruefen(s, state, affiliate_id=AFF, provider="youtube")["a"] == AFF
    for aff, prov in ((AFF2, "youtube"), (AFF, "meta")):
        with pytest.raises(AffiliateError) as exc:
            kanal_krypto.state_pruefen(s, state, affiliate_id=aff, provider=prov)
        assert exc.value.status_code == 400
    payload, sig = state.split(".")
    with pytest.raises(AffiliateError):
        kanal_krypto.state_pruefen(
            s, f"{payload}.{sig[:-2]}xx", affiliate_id=AFF, provider="youtube"
        )
    with pytest.raises(AffiliateError):
        kanal_krypto.state_pruefen(s, "kein-punkt", affiliate_id=AFF, provider="youtube")


# --- Anbieter-Hilfen ------------------------------------------------------------------------


def test_beitrags_id_aus_url_je_plattform() -> None:
    yt = kanal_plattformen.YouTube.beitrags_id_aus_url
    assert yt("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3") == "dQw4w9WgXcQ"
    assert yt("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert yt("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert yt("https://www.youtube.com/@pia") is None
    assert (
        kanal_plattformen.Meta.beitrags_id_aus_url("https://www.instagram.com/reel/C9xYz_1/")
        == "shortcode:C9xYz_1"
    )
    assert kanal_plattformen.Meta.beitrags_id_aus_url("https://www.instagram.com/pia/") is None
    assert (
        kanal_plattformen.TikTok.beitrags_id_aus_url(
            "https://www.tiktok.com/@pia/video/7301234567890123456"
        )
        == "7301234567890123456"
    )
    assert kanal_plattformen.TikTok.beitrags_id_aus_url("https://example.org/video/1") is None


def test_engagement_und_fenster() -> None:
    jetzt = datetime(2026, 9, 2, 12, tzinfo=UTC)
    b = [
        BeitragsMetrik(
            "1", views=1000, likes=50, comments=10, published_at=jetzt - timedelta(days=3)
        ),
        BeitragsMetrik(
            "2", views=1000, likes=0, comments=0, published_at=jetzt - timedelta(days=60)
        ),
    ]
    assert kanal_plattformen.engagement(b) == 0.03
    assert kanal_plattformen.views_im_fenster(b, jetzt=jetzt) == 1000
    assert kanal_plattformen.engagement([]) is None


def test_anbieter_meldet_fehlende_variablen() -> None:
    status = {s.provider: s for s in kanal_verbindungen.anbieter_status(_settings())}
    assert status["youtube"].configured is True
    assert status["meta"].configured is False and status["tiktok"].configured is False
    with pytest.raises(AffiliateError) as exc:
        kanal_verbindungen.autorisieren(_settings(), affiliate_id=AFF, provider="tiktok")
    assert exc.value.status_code == 503 and "TIKTOK_CLIENT_KEY" in exc.value.message


def test_autorisierungs_url_youtube() -> None:
    a = kanal_verbindungen.autorisieren(_settings(), affiliate_id=AFF, provider="youtube")
    assert a.url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert (
        "redirect_uri=https%3A%2F%2Fpartner.mynextdays.com%2Fapi%2Fauth%2Fyoutube%2Fcallback"
        in a.url
    )
    assert "state=" in a.url and "access_type=offline" in a.url


# --- Verbinden / Sync mit Fake-Anbieter ------------------------------------------------------


class FakeAnbieter(kanal_plattformen.Anbieter):
    key = "youtube"
    platforms = ("youtube",)
    scopes = ("s",)
    gemessen = datetime(2026, 9, 2, 8, 0, tzinfo=UTC)
    follower = 12800
    widerrufen = False
    refresh_aufrufe = 0

    def fehlende_variablen(self) -> list[str]:
        return []

    def autorisierungs_url(self, state: str) -> str:
        return f"https://fake/auth?state={state}"

    def code_tauschen(self, code: str) -> TokenSatz:
        return TokenSatz("acc-" + code, "ref-1", datetime.now(UTC) + timedelta(hours=1), ["s"])

    def token_erneuern(self, refresh_token: str | None, access_token: str) -> TokenSatz:
        FakeAnbieter.refresh_aufrufe += 1
        return TokenSatz("acc-neu", refresh_token, datetime.now(UTC) + timedelta(days=1), ["s"])

    def konten(self, access_token: str) -> list[Konto]:
        return [Konto("youtube", "UC123", "Pia", "https://www.youtube.com/@pia", handle="pia")]

    def snapshot(self, access_token: str, konto: Konto) -> Snapshot:
        if FakeAnbieter.widerrufen:
            raise PlattformFehler("Zugriff verweigert (401).", status=401, widerrufen=True)
        return Snapshot(
            measured_at=FakeAnbieter.gemessen,
            followers=FakeAnbieter.follower,
            views_28d=40000,
            engagement_rate=0.031,
            posts_count=120,
            raw={},
            beitraege=[
                BeitragsMetrik(
                    "dQw4w9WgXcQ",
                    views=9000,
                    likes=300,
                    comments=20,
                    published_at=FakeAnbieter.gemessen - timedelta(days=2),
                    url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                )
            ],
        )

    def beitrags_metriken(
        self, access_token: str, konto: Konto, external_ids: list[str]
    ) -> list[BeitragsMetrik]:
        return [BeitragsMetrik(i, views=100, likes=1, comments=0) for i in external_ids]

    @staticmethod
    def beitrags_id_aus_url(url: str) -> str | None:
        return kanal_plattformen.YouTube.beitrags_id_aus_url(url)


class FakeMails:
    def __init__(self) -> None:
        self.gesendet: list[dict[str, Any]] = []

    def kanal_widerrufen(self, **kw: Any) -> bool:
        self.gesendet.append(kw)
        return True


@pytest.fixture
def fake_anbieter(monkeypatch: pytest.MonkeyPatch) -> type[FakeAnbieter]:
    FakeAnbieter.widerrufen = False
    FakeAnbieter.refresh_aufrufe = 0
    FakeAnbieter.follower = 12800
    monkeypatch.setitem(kanal_plattformen.ANBIETER, "youtube", FakeAnbieter)
    return FakeAnbieter


def _verbinden(db: FakeDb, s: Settings) -> list[Any]:
    state = kanal_krypto.state_erzeugen(s, affiliate_id=AFF, provider="youtube")
    return kanal_verbindungen.verbinden(
        db, s, affiliate_id=AFF, provider="youtube", code="c1", state=state
    )


def test_verbinden_speichert_token_verschluesselt_und_verifiziert_kanal(
    fake_anbieter: type[FakeAnbieter],
) -> None:
    db, s = _db(), _settings()
    b = beitraege.anlegen(
        db,
        s,
        affiliate_id=AFF,
        code_id=CODE_ID,
        req=PartnerBeitragAnlegen(
            title="V", platform="youtube", url="https://youtu.be/dQw4w9WgXcQ"
        ),
    )
    [conn] = _verbinden(db, s)
    row = db.zeilen("affiliate_channel_connections")[0]
    assert (
        "acc-c1" not in str(row)
        and kanal_krypto.entschluesseln(s, row["access_token_enc"]) == "acc-c1"
    )
    assert conn.followers == 12800 and conn.measured_at == FakeAnbieter.gemessen
    snap = db.zeilen("affiliate_channel_snapshots")[0]
    assert (
        snap["snapshot_date"] == "2026-09-02"
        and snap["measured_at"] == FakeAnbieter.gemessen.isoformat()
    )
    # Beitrag über die URL gefunden, Kennzahl geschrieben.
    assert db.zeilen("affiliate_posts")[0]["external_post_id"] == "dQw4w9WgXcQ"
    assert db.zeilen("affiliate_post_metrics")[0]["views"] == 9000
    # Kanal-Eintrag: verifiziert, Selbstauskunft bleibt daneben.
    yt = next(k for k in db.zeilen("affiliates")[0]["channels"] if k["platform"] == "youtube")
    assert (
        yt["verified"] is True
        and yt["followers"] == 12800
        and yt["followers_self_reported"] == 12000
    )
    ig = next(k for k in db.zeilen("affiliates")[0]["channels"] if k["platform"] == "instagram")
    assert ig["verified"] is False and ig["followers"] == 5000
    assert beitraege.liste(db, s, affiliate_id=AFF)[0].metrics.views == 9000
    assert b.id == db.zeilen("affiliate_posts")[0]["id"]


def test_state_fremder_partner_wird_abgewiesen(fake_anbieter: type[FakeAnbieter]) -> None:
    db, s = _db(), _settings()
    state = kanal_krypto.state_erzeugen(s, affiliate_id=AFF2, provider="youtube")
    with pytest.raises(AffiliateError) as exc:
        kanal_verbindungen.verbinden(
            db, s, affiliate_id=AFF, provider="youtube", code="c", state=state
        )
    assert exc.value.status_code == 400
    assert db.zeilen("affiliate_channel_connections") == []


def test_erneut_verbinden_reaktiviert_statt_zu_duplizieren(
    fake_anbieter: type[FakeAnbieter],
) -> None:
    db, s = _db(), _settings()
    _verbinden(db, s)
    _verbinden(db, s)
    assert len(db.zeilen("affiliate_channel_connections")) == 1
    assert len(db.zeilen("affiliate_channel_snapshots")) == 1  # gleicher Tag → aktualisiert


def test_trennen_loescht_token_und_setzt_selbstauskunft_zurueck(
    fake_anbieter: type[FakeAnbieter],
) -> None:
    db, s = _db(), _settings()
    [conn] = _verbinden(db, s)
    with pytest.raises(AffiliateError):
        kanal_verbindungen.trennen(db, affiliate_id=AFF2, connection_id=conn.id)
    kanal_verbindungen.trennen(db, affiliate_id=AFF, connection_id=conn.id)
    row = db.zeilen("affiliate_channel_connections")[0]
    assert row["revoked_at"] and row["access_token_enc"] == "" and row["refresh_token_enc"] is None
    assert len(db.zeilen("affiliate_channel_snapshots")) == 1  # Historie bleibt
    yt = next(k for k in db.zeilen("affiliates")[0]["channels"] if k["platform"] == "youtube")
    assert yt["verified"] is False and yt["followers"] == 12000


def test_profilaenderung_kann_verified_nicht_setzen(fake_anbieter: type[FakeAnbieter]) -> None:
    db, s = _db(), _settings()
    _verbinden(db, s)
    # Der Partner schreibt seine Kanäle neu (wie PATCH /me) — ohne verified-Felder
    # und mit einem frechen „verified" am Instagram-Kanal.
    db.zeilen("affiliates")[0]["channels"] = [
        {
            "platform": "youtube",
            "url": "https://www.youtube.com/@pia",
            "handle": "pia",
            "followers": 99999,
        },
        {
            "platform": "instagram",
            "url": "https://www.instagram.com/pia/",
            "handle": "pia",
            "followers": 5000,
            "verified": True,
        },
    ]
    kanal_verbindungen.kanaele_abgleichen(db, affiliate_id=AFF)
    yt, ig = db.zeilen("affiliates")[0]["channels"]
    assert (
        yt["verified"] is True
        and yt["followers"] == 12800
        and yt["followers_self_reported"] == 99999
    )
    assert ig["verified"] is False


def test_sync_erneuert_token_und_widerruf_informiert_partner(
    fake_anbieter: type[FakeAnbieter],
) -> None:
    db, s = _db(), _settings()
    _verbinden(db, s)
    row = db.zeilen("affiliate_channel_connections")[0]
    row["last_sync_at"] = (datetime.now(UTC) - timedelta(hours=30)).isoformat()
    mails = FakeMails()
    # Token läuft in < 36 h ab → wird erneuert; Snapshot an neuem Tag.
    FakeAnbieter.gemessen = datetime(2026, 9, 3, 8, 0, tzinfo=UTC)
    z = kanal_verbindungen.synchronisieren(db, s, mails=mails, mindestabstand=timedelta(hours=20))  # type: ignore[arg-type]
    assert z["ok"] == 1 and FakeAnbieter.refresh_aufrufe == 1
    assert kanal_krypto.entschluesseln(s, row["access_token_enc"]) == "acc-neu"
    assert len(db.zeilen("affiliate_channel_snapshots")) == 2
    # Frisch synchronisiert → beim nächsten Tick übersprungen.
    z2 = kanal_verbindungen.synchronisieren(db, s, mails=mails, mindestabstand=timedelta(hours=20))  # type: ignore[arg-type]
    assert z2["uebersprungen"] == 1 and z2["ok"] == 0
    # Plattform entzieht den Zugriff → revoked_at, Mail, Kanal zurück auf Selbstauskunft.
    FakeAnbieter.widerrufen = True
    z3 = kanal_verbindungen.synchronisieren(db, s, mails=mails)  # type: ignore[arg-type]
    assert z3["widerrufen"] == 1
    assert row["revoked_at"] and row["revoked_reason"].startswith("plattform:")
    assert (
        mails.gesendet
        and mails.gesendet[0]["plattform"] == "youtube"
        and mails.gesendet[0]["email"] == "pia@agentur-nord.de"
    )
    yt = next(k for k in db.zeilen("affiliates")[0]["channels"] if k["platform"] == "youtube")
    assert yt["verified"] is False and yt["followers"] == 12000
    FakeAnbieter.gemessen = datetime(2026, 9, 2, 8, 0, tzinfo=UTC)


def test_sync_fehler_ist_kein_widerruf(
    fake_anbieter: type[FakeAnbieter], monkeypatch: pytest.MonkeyPatch
) -> None:
    db, s = _db(), _settings()
    _verbinden(db, s)
    row = db.zeilen("affiliate_channel_connections")[0]

    def kaputt(self: Any, token: str, konto: Konto) -> Snapshot:
        raise PlattformFehler("HTTP 500", status=500)

    monkeypatch.setattr(FakeAnbieter, "snapshot", kaputt)
    z = kanal_verbindungen.synchronisieren(db, s, mails=FakeMails())  # type: ignore[arg-type]
    assert z["fehler"] == 1 and row["revoked_at"] is None and row["last_error"] == "HTTP 500"


# --- Stufe C --------------------------------------------------------------------------------


def _kanal(**kw: Any) -> KanalReichweite:
    basis: dict[str, Any] = {
        "platform": "youtube",
        "account_name": "pia",
        "account_url": None,
        "verified": True,
        "followers_verified": 60000,
        "followers_self_reported": 60000,
        "deviation_pct": 0.0,
        "views_28d": 1000,
        "engagement_rate": 0.02,
        "posts_count": 10,
        "measured_at": None,
        "follower_history": [],
        "clicks_28d": 0,
        "clicks_90d": 0,
        "clicks_per_1000_views": None,
        "revoked_at": None,
    }
    return KanalReichweite(**{**basis, **kw})


def _post(views: int | None, klicks: int) -> PartnerBeitrag:
    from src.features.affiliates.schemas_reichweite import BeitragMetrik

    return PartnerBeitrag(
        id="p",
        code_id=CODE_ID,
        code="PIA",
        platform="youtube",
        url=None,
        title="Reel",
        utm_content="r",
        link=None,
        published_at=None,
        created_at=datetime(2026, 9, 1, tzinfo=UTC),
        clicks_90d=klicks,
        metrics=BeitragMetrik(measured_at=datetime(2026, 9, 2, tzinfo=UTC), views=views)
        if views is not None
        else None,
    )


def test_flags_nach_schwellen() -> None:
    g = reichweite.schwellen(_db())
    verlauf = [
        FollowerTag(day="2026-08-20", followers=10000),
        FollowerTag(day="2026-09-02", followers=15000),
    ]
    flags = reichweite.flags_bestimmen(
        [
            _kanal(follower_history=verlauf, followers_verified=15000),  # +50 % in 7 T.
            _kanal(engagement_rate=0.001),  # 0,1 % bei 60k
            _kanal(followers_self_reported=100000, deviation_pct=66.7),
            _kanal(
                verified=False, followers_self_reported=100000, deviation_pct=66.7
            ),  # nicht verifiziert: kein Flag
        ],
        [_post(8000, 0), _post(8000, 3), _post(None, 0)],
        g,
    )
    schluessel = sorted(f.key for f in flags)
    assert schluessel == [
        "follower_jump",
        "low_engagement",
        "self_report_deviation",
        "views_without_click",
    ]
    sprung = next(f for f in flags if f.key == "follower_jump")
    assert sprung.value == 50.0 and sprung.threshold == 30


def test_schwelle_null_schaltet_regel_ab() -> None:
    flags = reichweite.flags_bestimmen(
        [_kanal(engagement_rate=0.0001)], [], {"low_engagement_rate_pct": None}
    )
    assert flags == []
    assert reichweite.flags_bestimmen([_kanal(engagement_rate=0.0001)], [], {}) == []


def test_kanaele_trennen_verifiziert_und_selbstauskunft(fake_anbieter: type[FakeAnbieter]) -> None:
    db, s = _db(), _settings()
    _verbinden(db, s)
    db.zeilen("affiliate_clicks").append(
        {
            "code_id": CODE_ID,
            "affiliate_id": AFF,
            "click_token": "t",
            "utm": {"utm_source": "youtube"},
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    kan = {k.platform: k for k in reichweite.kanaele(db, affiliate_id=AFF)}
    yt, ig = kan["youtube"], kan["instagram"]
    assert yt.verified and yt.followers_verified == 12800 and yt.followers_self_reported == 12000
    assert yt.deviation_pct == -6.2 and yt.clicks_28d == 1 and yt.clicks_per_1000_views == 0.03
    assert yt.follower_history == [FollowerTag(day="2026-09-02", followers=12800)]
    assert not ig.verified and ig.followers_verified is None and ig.followers_self_reported == 5000
    bo = reichweite.bo_partner(db, s, affiliate_id=AFF)
    assert bo.reach_verified == 12800 and bo.reach_self_reported == 17000
    summary = reichweite.bo_summary(db, s)
    assert (
        summary.reach_verified == 12800
        and summary.connections_active == 1
        and summary.partners_with_connection == 1
    )
    assert (
        summary.top_channels[0].platform == "youtube"
        and summary.top_channels[0].customers_per_1000_followers == 0
    )


def test_schwelle_setzen_und_unbekannt() -> None:
    db = _db()
    s = reichweite.schwelle_setzen(db, key="follower_jump_pct_7d", value=None)
    assert s.value is None and reichweite.schwellen(db)["follower_jump_pct_7d"] is None
    with pytest.raises(AffiliateError) as exc:
        reichweite.schwelle_setzen(db, key="gibt_es_nicht", value=1)
    assert exc.value.status_code == 404
