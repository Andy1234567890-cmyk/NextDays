"""reCAPTCHA-Prüfung (`core.captcha`) — fail-closed ist der Prüfgegenstand.

Ein Spamschutz, der bei irgendeinem Zwischenfall „bestanden" meldet, ist kein
Schutz: der Angreifer muss dann nur den Zwischenfall herbeiführen. Geprüft wird
deshalb jeder Weg, auf dem eine Anfrage NICHT durchkommen darf, und ausdrücklich
auch, dass die Sandbox ausserhalb von `local` nicht aus Versehen greift.
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest

from src.core.captcha import (
    SANDBOX_SCORE,
    TOKEN_MAX,
    CaptchaError,
    CaptchaService,
)
from src.core.config import Settings


def _settings(**over: Any) -> Settings:
    werte: dict[str, Any] = {
        "app_env": "production",
        "recaptcha_project_id": "nextdays-123",
        "recaptcha_api_key": "key",
        "recaptcha_site_key": "6Lsite",
    }
    werte.update(over)
    return Settings(**werte)


def _antwort(
    body: Any, status: int = 200, *, gesehen: list[dict[str, Any]] | None = None
):
    """Ersetzt httpx.post durch eine feste Antwort und merkt den Aufruf."""

    def post(url: str, **kwargs: Any) -> httpx.Response:
        if gesehen is not None:
            gesehen.append({"url": url, **kwargs})
        return httpx.Response(
            status,
            json=body,
            request=httpx.Request("POST", url),
        )

    return post


def _gut(score: float = 0.9) -> dict[str, Any]:
    return {
        "tokenProperties": {"valid": True, "action": "kontakt"},
        "riskAnalysis": {"score": score},
    }


# --- Sandbox / Konfiguration ------------------------------------------------


def test_lokal_ist_sandbox_ohne_zutun() -> None:
    """Auf dem Entwicklerrechner gibt es keine Schlüssel — und keinen 503.

    Gleiche Bauart wie `mail_sandbox`: niemand muss daran denken.
    """
    s = Settings(app_env="local")
    assert s.captcha_sandbox is True
    assert CaptchaService(s).pruefen(None, aktion="kontakt") == SANDBOX_SCORE


def test_produktion_ohne_schluessel_ist_503_nicht_bestanden() -> None:
    """Fehlende Konfiguration darf NICHT zu ungeprüftem Durchlassen führen."""
    svc = CaptchaService(_settings(recaptcha_api_key=""))
    with pytest.raises(CaptchaError) as exc:
        svc.pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 503


def test_sandbox_greift_ausserhalb_von_local_nicht_von_selbst() -> None:
    s = _settings()
    assert s.captcha_sandbox is False


def test_sandbox_override_hebt_es_bewusst_auf() -> None:
    s = _settings(captcha_sandbox_override=True)
    assert s.captcha_sandbox is True


def test_captcha_configured_verlangt_alle_drei_werte() -> None:
    assert _settings().captcha_configured is True
    assert _settings(recaptcha_project_id="").captcha_configured is False
    assert _settings(recaptcha_api_key="").captcha_configured is False
    assert _settings(recaptcha_site_key="").captcha_configured is False


# --- Token ------------------------------------------------------------------


def test_fehlendes_token_ist_403() -> None:
    svc = CaptchaService(_settings())
    for wert in (None, "", "   "):
        with pytest.raises(CaptchaError) as exc:
            svc.pruefen(wert, aktion="kontakt")
        assert exc.value.status_code == 403


def test_ueberlanges_token_geht_nicht_an_google(monkeypatch: Any) -> None:
    """Wurzel 8: die Grenze greift VOR dem ausgehenden Aufruf."""
    aufrufe: list[dict[str, Any]] = []
    monkeypatch.setattr(httpx, "post", _antwort(_gut(), gesehen=aufrufe))
    with pytest.raises(CaptchaError):
        CaptchaService(_settings()).pruefen("x" * (TOKEN_MAX + 1), aktion="kontakt")
    assert not aufrufe


# --- Der Aufruf selbst ------------------------------------------------------


def test_erfolgsfall_gibt_score_zurueck(monkeypatch: Any) -> None:
    monkeypatch.setattr(httpx, "post", _antwort(_gut(0.8)))
    assert CaptchaService(_settings()).pruefen("tok", aktion="kontakt") == 0.8


def test_aufruf_traegt_projekt_sitekey_und_aktion(monkeypatch: Any) -> None:
    gesehen: list[dict[str, Any]] = []
    monkeypatch.setattr(httpx, "post", _antwort(_gut(), gesehen=gesehen))
    CaptchaService(_settings()).pruefen(
        "tok", aktion="kontakt", ip="203.0.113.9", user_agent="UA"
    )
    aufruf = gesehen[0]
    assert aufruf["url"].endswith("/projects/nextdays-123/assessments")
    assert aufruf["params"] == {"key": "key"}
    ereignis = aufruf["json"]["event"]
    assert ereignis["token"] == "tok"
    assert ereignis["siteKey"] == "6Lsite"
    assert ereignis["expectedAction"] == "kontakt"
    assert ereignis["userIpAddress"] == "203.0.113.9"
    assert ereignis["userAgent"] == "UA"


def test_leere_ip_wird_nicht_mitgeschickt(monkeypatch: Any) -> None:
    """Ein leerer String wäre eine Falschangabe an Google (Wurzel 4)."""
    gesehen: list[dict[str, Any]] = []
    monkeypatch.setattr(httpx, "post", _antwort(_gut(), gesehen=gesehen))
    CaptchaService(_settings()).pruefen("tok", aktion="kontakt", ip=None)
    assert "userIpAddress" not in gesehen[0]["json"]["event"]


def test_netzwerkfehler_ist_502_nicht_bestanden(monkeypatch: Any) -> None:
    def post(*_a: Any, **_k: Any) -> httpx.Response:
        raise httpx.ConnectTimeout("weg")

    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 502


def test_fehlerstatus_von_google_ist_502(monkeypatch: Any) -> None:
    monkeypatch.setattr(httpx, "post", _antwort({"error": {"code": 403}}, 403))
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 502


def test_antwort_ohne_json_ist_502(monkeypatch: Any) -> None:
    def post(url: str, **_k: Any) -> httpx.Response:
        return httpx.Response(
            200, text="kein json", request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 502


# --- Auswertung -------------------------------------------------------------


def test_ungueltiges_token_ist_403(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        httpx,
        "post",
        _antwort(
            {
                "tokenProperties": {
                    "valid": False,
                    "invalidReason": "EXPIRED_OR_DUPLICATE",
                }
            }
        ),
    )
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 403


def test_fremde_aktion_wird_abgewiesen(monkeypatch: Any) -> None:
    """Sonst wäre ein Token von einer harmlosen Seite überall verwendbar."""
    monkeypatch.setattr(
        httpx,
        "post",
        _antwort(
            {
                "tokenProperties": {"valid": True, "action": "newsletter"},
                "riskAnalysis": {"score": 0.9},
            }
        ),
    )
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 403


def test_score_unter_der_schwelle_ist_403(monkeypatch: Any) -> None:
    monkeypatch.setattr(httpx, "post", _antwort(_gut(0.1)))
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 403


def test_schwelle_ist_konfigurierbar(monkeypatch: Any) -> None:
    monkeypatch.setattr(httpx, "post", _antwort(_gut(0.4)))
    # Standard 0.5 → durchgefallen; abgesenkt auf 0.3 → bestanden.
    with pytest.raises(CaptchaError):
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert (
        CaptchaService(_settings(recaptcha_min_score=0.3)).pruefen(
            "tok", aktion="kontakt"
        )
        == 0.4
    )


def test_gueltiges_token_ohne_score_ist_502(monkeypatch: Any) -> None:
    """Kein erfundener Ausweich-Score (Wurzel 4)."""
    monkeypatch.setattr(
        httpx, "post", _antwort({"tokenProperties": {"valid": True}})
    )
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 502


def test_antwort_ohne_tokenproperties_ist_502(monkeypatch: Any) -> None:
    monkeypatch.setattr(httpx, "post", _antwort({"riskAnalysis": {"score": 0.9}}))
    with pytest.raises(CaptchaError) as exc:
        CaptchaService(_settings()).pruefen("tok", aktion="kontakt")
    assert exc.value.status_code == 502


def test_antwort_ohne_aktion_wird_akzeptiert(monkeypatch: Any) -> None:
    """Google liefert `action` nicht immer mit; das allein ist kein Nein."""
    monkeypatch.setattr(
        httpx,
        "post",
        _antwort(
            {
                "tokenProperties": {"valid": True},
                "riskAnalysis": {"score": 0.7},
            }
        ),
    )
    assert CaptchaService(_settings()).pruefen("tok", aktion="kontakt") == 0.7
