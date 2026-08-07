"""Tests für den content-Slice (Health + Übersetzung)."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.features.content.schemas import TranslateRequest
from src.features.content.service import ContentError, ContentService
from src.main import create_app

client = TestClient(create_app())


def test_content_health() -> None:
    resp = client.get("/api/v1/content/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "content", "status": "ok"}


def test_translate_without_key_raises_503() -> None:
    # Ohne konfigurierten Key meldet der Service 503.
    with patch("src.features.content.service.get_settings") as gs:
        gs.return_value.google_translate_api_key.get_secret_value.return_value = ""
        service = ContentService()
        req = TranslateRequest(text="Hallo", target="en")
        with pytest.raises(ContentError) as exc:
            service.translate(req)
        assert exc.value.status_code == 503


def test_translate_success_parses_google_response() -> None:
    fake_resp = MagicMock(status_code=200)
    fake_resp.json.return_value = {
        "data": {
            "translations": [
                {"translatedText": "Hello", "detectedSourceLanguage": "de"}
            ]
        }
    }
    with patch("src.features.content.service.get_settings") as gs, patch(
        "src.features.content.service.httpx.post", return_value=fake_resp
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        service = ContentService()
        req = TranslateRequest(
            text="Hallo", target="en", source="de"
        )
        out = service.translate(req)
        assert out.text == "Hello"
        assert out.detected_source == "de"


def test_translate_api_error_maps_to_502() -> None:
    fake_resp = MagicMock(status_code=403, text="forbidden")
    with patch("src.features.content.service.get_settings") as gs, patch(
        "src.features.content.service.httpx.post", return_value=fake_resp
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        service = ContentService()
        req = TranslateRequest(text="Hallo", target="en")
        with pytest.raises(ContentError) as exc:
            service.translate(req)
        assert exc.value.status_code == 502


# --- Sprachen: offene Liste statt Enum (Gäste-Chat, 07.08.2026) -------------
#
# Anlass: eine norwegische Gastnachricht im Posteingang. Der frühere Enum kannte
# nur da/en/de und hätte sie mit 422 abgewiesen — bei Gästen aus aller Welt ist
# eine feste Liste immer zu kurz.


def test_beliebige_sprache_wird_angenommen() -> None:
    for code in ("no", "ja", "zh", "pt-BR", "sr-Latn"):
        assert TranslateRequest(text="Hei", target=code).target


def test_sprachcode_wird_normalisiert() -> None:
    """Google will den Primärtag klein; Region/Skript bleiben unberührt."""
    assert TranslateRequest(text="x", target=" PT-BR ").target == "pt-BR"


def test_unsinn_wird_abgewiesen() -> None:
    """Kein freier String, der ungeprüft an Google geht (Wurzel 3)."""
    for code in ("deutsch bitte", "d", "../etc", "en;DROP", ""):
        with pytest.raises(ValidationError):
            TranslateRequest(text="x", target=code)


def test_unbekannte_sprache_ist_422_kein_502() -> None:
    """Googles 400 heißt „diese Sprache kenne ich nicht" — ein Fehler der
    Anfrage. Als 502 gemeldet hieße es „später nochmal", obwohl jeder weitere
    Versuch genauso scheitert."""
    fake_resp = MagicMock(status_code=400, text="Invalid Value")
    with patch("src.features.content.service.get_settings") as gs, patch(
        "src.features.content.service.httpx.post", return_value=fake_resp
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        with pytest.raises(ContentError) as exc:
            ContentService().translate(TranslateRequest(text="x", target="xx"))
        assert exc.value.status_code == 422


def test_ohne_quelle_erkennt_google_selbst() -> None:
    """Der Normalfall im Chat: welche Sprache der Gast schreibt, weiß er."""
    fake_resp = MagicMock(status_code=200)
    fake_resp.json.return_value = {
        "data": {
            "translations": [
                {"translatedText": "Danke", "detectedSourceLanguage": "no"}
            ]
        }
    }
    with patch("src.features.content.service.get_settings") as gs, patch(
        "src.features.content.service.httpx.post", return_value=fake_resp
    ) as post:
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        out = ContentService().translate(
            TranslateRequest(text="Tusen takk", target="de", fmt="text")
        )
        assert out.detected_source == "no"
        # Ohne `source` darf nichts mitgeschickt werden, sonst erkennt Google
        # nicht selbst.
        assert "source" not in post.call_args.kwargs["data"]
