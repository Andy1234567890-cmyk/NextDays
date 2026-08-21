"""Auth der öffentlichen API: Token-Tausch, Token-Prüfung, Scope, Objekt-Scope.

Diese Tests sind beim Umzug des Token-Endpunkts aus der Haupt-API mitgewandert
(dort standen sie in `features/api_clients/tests`). Sie stehen jetzt genau dort,
wo der Code liegt — Tests an einem Ort und Code an einem anderen hätten den Umzug
verdeckt.
"""
from __future__ import annotations

import hashlib

import jwt
import pytest

from src.core import auth, errors
from src.core.config import Settings

from .fake_db import FakeDB

# Mindestens 32 Byte: kürzere HMAC-Schlüssel sind laut RFC 7518 zu kurz für
# SHA-256, und PyJWT warnt darüber.
_SECRET = "test-signier-secret-0123456789-abcdef"


def _hash(wert: str) -> str:
    return hashlib.sha256(wert.encode()).hexdigest()


def _db_mit_zugang(**abweichend: object) -> FakeDB:
    zeile = {
        "id": "client-pk-1",
        "tenant_id": "t1",
        "client_id": "mnd_live_id_abc",
        "secret_hash": _hash("mnd_live_geheim"),
        "scopes": ["reservations:read", "availability:write"],
        "property_ids": ["p1"],
        "is_test": False,
        "revoked_at": None,
    }
    zeile.update(abweichend)
    return FakeDB({"api_clients": [zeile]})


@pytest.fixture(autouse=True)
def _einstellungen(monkeypatch: pytest.MonkeyPatch) -> None:
    """Signier-Secret setzen und den Settings-Cache leeren.

    Ohne das Leeren würde der `lru_cache` in `get_settings` die Einstellungen des
    ersten Tests für alle folgenden festhalten — und der fail-closed-Test unten
    hätte keine Wirkung.
    """
    monkeypatch.setenv("API_TOKEN_SECRET", _SECRET)
    from src.core import config

    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


def _patch_db(monkeypatch: pytest.MonkeyPatch, db: FakeDB) -> None:
    monkeypatch.setattr(auth, "service_db", lambda: db)


def test_token_traegt_scopes_und_objekte(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_db(monkeypatch, _db_mit_zugang())
    tok = auth.token_ausgeben(
        client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
    )
    claims = jwt.decode(
        str(tok["access_token"]), _SECRET, algorithms=["HS256"],
        audience="mynextdays-api",
    )
    assert claims["tenant_id"] == "t1"
    assert set(claims["scopes"]) == {"reservations:read", "availability:write"}
    assert claims["property_ids"] == ["p1"]
    assert tok["expires_in"] == 3600
    # Der Scope-String ist Teil der OAuth-Antwort — Clients lesen ihn statt das
    # Token zu dekodieren.
    assert "reservations:read" in str(tok["scope"])


def test_falsches_secret_ist_401(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_db(monkeypatch, _db_mit_zugang())
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(client_id="mnd_live_id_abc", client_secret="falsch")
    assert exc.value.status == 401


def test_unbekannter_zugang_ist_derselbe_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unbekannt und falsches Secret dürfen nicht unterscheidbar sein.

    Sonst ist der Endpunkt ein Orakel dafür, welche Client-IDs existieren.
    """
    _patch_db(monkeypatch, _db_mit_zugang())
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(client_id="gibt_es_nicht", client_secret="egal-egal")
    assert exc.value.status == 401
    assert exc.value.code == "ungueltige_zugangsdaten"


def test_widerrufener_zugang_bekommt_kein_token(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_db(monkeypatch, _db_mit_zugang(revoked_at="2026-08-01T00:00:00+00:00"))
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(
            client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
        )
    assert exc.value.status == 401


def test_zugang_ohne_scopes_bekommt_kein_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Token ohne Scopes wäre irreführend: 200 beim Tausch, dann nur 403."""
    _patch_db(monkeypatch, _db_mit_zugang(scopes=[]))
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(
            client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
        )
    assert exc.value.status == 403
    assert exc.value.code == "zugang_ohne_scopes"


def test_ohne_signier_secret_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fehlt das Secret, wird KEIN Token ausgegeben — und keines gilt."""
    monkeypatch.setenv("API_TOKEN_SECRET", "")
    from src.core import config

    config.get_settings.cache_clear()
    _patch_db(monkeypatch, _db_mit_zugang())
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(
            client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
        )
    assert exc.value.status == 503

    with pytest.raises(errors.ApiFehler) as exc2:
        auth.kontext_aus_token("egal", Settings(api_token_secret=""))  # type: ignore[arg-type]
    assert exc2.value.status == 503


def test_nicht_ascii_secret_wirft_keinen_500(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Secret mit Umlaut darf 401 ergeben, nicht einen Absturz.

    `secrets.compare_digest` wirft bei nicht-ASCII-str einen TypeError; der Wert
    kommt vom Angreifer.
    """
    _patch_db(monkeypatch, _db_mit_zugang())
    with pytest.raises(errors.ApiFehler) as exc:
        auth.token_ausgeben(client_id="mnd_live_id_abc", client_secret="geheimnüß")
    assert exc.value.status == 401


def test_scope_wird_erzwungen(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_db(monkeypatch, _db_mit_zugang())
    tok = auth.token_ausgeben(
        client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
    )
    einstellungen = Settings(api_token_secret=_SECRET)  # type: ignore[arg-type]
    ctx = auth.kontext_aus_token(str(tok["access_token"]), einstellungen)
    assert ctx.tenant_id == "t1"
    assert "reservations:read" in ctx.scopes
    assert "reservations:write" not in ctx.scopes


def test_objekt_beschraenkung(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein auf p1 beschränkter Zugang darf p2 nicht anfassen."""
    _patch_db(monkeypatch, _db_mit_zugang())
    tok = auth.token_ausgeben(
        client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
    )
    ctx = auth.kontext_aus_token(
        str(tok["access_token"]),
        Settings(api_token_secret=_SECRET),  # type: ignore[arg-type]
    )
    assert ctx.darf_objekt("p1") is True
    assert ctx.darf_objekt("p2") is False
    with pytest.raises(errors.ApiFehler) as exc:
        ctx.objekt_pruefen("p2")
    assert exc.value.status == 403
    assert exc.value.code == "objekt_nicht_erlaubt"


def test_leere_beschraenkung_heisst_alle(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_db(monkeypatch, _db_mit_zugang(property_ids=[]))
    tok = auth.token_ausgeben(
        client_id="mnd_live_id_abc", client_secret="mnd_live_geheim"
    )
    ctx = auth.kontext_aus_token(
        str(tok["access_token"]),
        Settings(api_token_secret=_SECRET),  # type: ignore[arg-type]
    )
    assert ctx.darf_objekt("beliebig") is True


def test_fremdes_token_gilt_nicht(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Supabase-Login-Token (andere Audience) darf hier nichts können."""
    del monkeypatch
    fremd = jwt.encode(
        {"sub": "user-1", "aud": "authenticated", "tenant_id": "t1", "scopes": []},
        _SECRET,
        algorithm="HS256",
    )
    with pytest.raises(errors.ApiFehler) as exc:
        auth.kontext_aus_token(
            fremd, Settings(api_token_secret=_SECRET)  # type: ignore[arg-type]
        )
    assert exc.value.status == 401
