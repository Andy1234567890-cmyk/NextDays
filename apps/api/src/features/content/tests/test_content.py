"""Tests für den content-Slice (Health + Übersetzung)."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.features.content.schemas import TranslateLang, TranslateRequest
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
        req = TranslateRequest(text="Hallo", target=TranslateLang.en)
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
            text="Hallo", target=TranslateLang.en, source=TranslateLang.de
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
        req = TranslateRequest(text="Hallo", target=TranslateLang.en)
        with pytest.raises(ContentError) as exc:
            service.translate(req)
        assert exc.value.status_code == 502
