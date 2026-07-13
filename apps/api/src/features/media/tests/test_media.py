"""Tests für den media-Slice (Bilder-Modul)."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.features.media.service import MediaError, MediaService
from src.main import create_app

client = TestClient(create_app())


def test_media_health() -> None:
    resp = client.get("/api/v1/media/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "media", "status": "ok"}


def _svc() -> tuple[MediaService, MagicMock]:
    m = MagicMock(name="supabase")
    return MediaService(client=m), m


def test_no_client_raises_clean_error() -> None:
    svc = MediaService(client=None)
    with pytest.raises(MediaError) as exc:
        svc.list_media("T")
    assert exc.value.status_code == 500


def test_delete_rejects_unknown_kind() -> None:
    svc, _ = _svc()
    with pytest.raises(MediaError) as exc:
        svc.delete_media("T", "bogus", "id1")
    assert exc.value.status_code == 422


def test_property_photos_scoped_to_tenant() -> None:
    """Objektfotos werden nur für Objekte des Tenants geladen (Wurzel 3)."""
    svc, m = _svc()
    # _owned_property_ids: properties.select.eq(tenant).execute → ein Objekt.
    owned_chain = m.table.return_value.select.return_value.eq.return_value
    owned_chain.execute.return_value.data = [{"id": "p1"}]
    # _property_titles: properties.select.eq.in_.execute
    titles_chain = (
        m.table.return_value.select.return_value.eq.return_value.in_.return_value
    )
    titles_chain.execute.return_value.data = [{"id": "p1", "title": "Haus"}]
    # property_photos.select.in_.order.execute
    photos_chain = (
        m.table.return_value.select.return_value.in_.return_value.order.return_value
    )
    photos_chain.execute.return_value.data = [
        {
            "id": "ph1",
            "property_id": "p1",
            "url": "https://x/y.jpg",
            "author": "Anna",
            "created_at": "2026-07-01T00:00:00Z",
        }
    ]
    items = svc.list_media("T", include_booking=False, include_property=True)
    assert len(items) == 1
    assert items[0].kind.value == "property"
    assert items[0].url == "https://x/y.jpg"
    assert items[0].property_title == "Haus"
