"""Tests für die Token-Prüfung: was ist ein 401, was ein 503.

Hintergrund (Ursache der willkürlichen Abmeldungen): `PyJWKClientConnectionError`
erbt von `PyJWTError` und landete damit im selben `except` wie ein manipuliertes
Token. Ein einziger Timeout beim JWKS-Abruf gegen das interne Kong meldete so
ALLE gerade aktiven Nutzer gleichzeitig ab — als „Ungültiges oder abgelaufenes
Token", obwohl an den Tokens nichts falsch war.
"""
import json
from base64 import urlsafe_b64encode
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

from src.core.config import Settings
from src.core.security import _CLOCK_SKEW_SEKUNDEN, _decode_token, _jwk_client


def base64url(wert: str) -> str:
    return urlsafe_b64encode(wert.encode()).decode().rstrip("=")


def _settings() -> Settings:
    return Settings(_env_file=None, supabase_jwt_secret="s" * 40)


def _hs256(claims: dict, secret: str = "s" * 40) -> str:
    return jwt.encode(claims, secret, algorithm="HS256")


def _basis_claims(**extra: object) -> dict:
    jetzt = datetime.now(UTC)
    return {
        "sub": "user-1",
        "aud": "authenticated",
        "iat": jetzt,
        "exp": jetzt + timedelta(hours=1),
        **extra,
    }


def test_gueltiges_token_wird_akzeptiert() -> None:
    claims = _decode_token(_hs256(_basis_claims()), _settings())
    assert claims["sub"] == "user-1"


def test_abgelaufenes_token_ist_401() -> None:
    jetzt = datetime.now(UTC)
    token = _hs256(
        _basis_claims(iat=jetzt - timedelta(hours=2), exp=jetzt - timedelta(hours=1))
    )
    with pytest.raises(HTTPException) as exc:
        _decode_token(token, _settings())
    assert exc.value.status_code == 401


def test_falsche_signatur_ist_401() -> None:
    token = _hs256(_basis_claims(), secret="f" * 40)
    with pytest.raises(HTTPException) as exc:
        _decode_token(token, _settings())
    assert exc.value.status_code == 401


def test_alg_none_wird_abgelehnt() -> None:
    """fail-closed: „none" steht nicht in der Allowlist."""
    token = jwt.encode(_basis_claims(), key="", algorithm="none")
    with pytest.raises(HTTPException) as exc:
        _decode_token(token, _settings())
    assert exc.value.status_code == 401


def test_uhrendrift_wird_toleriert() -> None:
    """Ohne `leeway` lehnt `iat`/`nbf` ein Token ab, das der GoTrue-Container
    Sekundenbruchteile „in der Zukunft" ausgestellt hat — für den Nutzer eine
    grundlose Abmeldung."""
    jetzt = datetime.now(UTC)
    drift = timedelta(seconds=_CLOCK_SKEW_SEKUNDEN - 5)
    token = _hs256(
        _basis_claims(iat=jetzt + drift, nbf=jetzt + drift, exp=jetzt + timedelta(hours=1))
    )
    assert _decode_token(token, _settings())["sub"] == "user-1"


def _token_mit_es256_header() -> str:
    """Token, dessen Header `alg: ES256` trägt, damit `_decode_token` in den
    asymmetrischen (JWKS-)Zweig läuft. Die Signatur ist bewusst Unsinn — sie
    wird nie erreicht, weil der Schlüsselabruf davor scheitert (genau das ist
    der geprüfte Fall)."""
    kopf = base64url(json.dumps({"alg": "ES256", "typ": "JWT", "kid": "k1"}))
    nutzlast = base64url(
        json.dumps(
            {
                "sub": "user-1",
                "aud": "authenticated",
                "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
            }
        )
    )
    return f"{kopf}.{nutzlast}.{base64url('signatur')}"


def test_jwks_unerreichbar_ist_503_nicht_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """KERN: Der Schlüsselserver ist weg — über die Gültigkeit des Tokens sagt
    das nichts. 401 hätte alle aktiven Nutzer gleichzeitig abgemeldet."""
    class _ToterClient:
        def get_signing_key_from_jwt(self, _token: str) -> object:
            raise PyJWKClientConnectionError("Fail to fetch data from the url")

    monkeypatch.setattr(
        "src.core.security._jwk_client", lambda _url: _ToterClient()
    )
    with pytest.raises(HTTPException) as exc:
        _decode_token(_token_mit_es256_header(), _settings())
    assert exc.value.status_code == 503


def test_unbekannter_kid_bleibt_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """Abgrenzung: „Unable to find a signing key that matches" ist ein
    allgemeiner PyJWKClientError und bedeutet ein ECHT ungültiges Token — der
    darf NICHT zu 503 werden, sonst verdeckt er einen Angriff."""
    class _OhnePassendenSchluessel:
        def get_signing_key_from_jwt(self, _token: str) -> object:
            raise PyJWKClientError('Unable to find a signing key that matches: "x"')

    monkeypatch.setattr(
        "src.core.security._jwk_client", lambda _url: _OhnePassendenSchluessel()
    )
    with pytest.raises(HTTPException) as exc:
        _decode_token(_token_mit_es256_header(), _settings())
    assert exc.value.status_code == 401


def test_jwks_client_cacht_schluessel_lange() -> None:
    """Mit den PyJWT-Defaults (300 s, kein Key-Cache) muss der Prozess alle fünf
    Minuten frisch gegen das interne Kong holen — genau dort reißt die
    Keep-Alive-Verbindung ab. Ein längeres Fenster senkt die Fehlerchance."""
    _jwk_client.cache_clear()
    client = _jwk_client("https://example.invalid/jwks.json")
    assert client.jwk_set_cache is not None
    assert client.jwk_set_cache.lifespan == 3600
    _jwk_client.cache_clear()
