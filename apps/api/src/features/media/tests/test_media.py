"""Tests für den media-Slice (Bilder-Modul)."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
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


# --- Rollen-Scope: §4.2 owner / §4.3 staff ---------------------------------
#
# Angriff, den diese Tests nachstellen: Ein Eigentümer ruft GET /media OHNE
# property_id auf. `property_id` ist ein FILTER, kein Scope — ohne ihn bekam er
# sämtliche Objekt- und Buchungsfotos ALLER Objekte des Betriebs. Und ein
# untergeschobenes fremdes `property_id` darf den Scope nicht ausweiten.

OWN_PID = "p-own"
FOREIGN_PID = "p-fremd"


class _TableFake:
    """Minimaler PostgREST-Nachbau: filtert die hinterlegten Zeilen wirklich."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_a: object, **_k: object) -> "_TableFake":
        return self

    def order(self, *_a: object, **_k: object) -> "_TableFake":
        return self

    def limit(self, *_a: object, **_k: object) -> "_TableFake":
        return self

    def eq(self, col: str, val: object) -> "_TableFake":
        return _TableFake([r for r in self._rows if r.get(col) == val])

    def in_(self, col: str, vals: list) -> "_TableFake":
        return _TableFake([r for r in self._rows if r.get(col) in set(vals)])

    def execute(self) -> object:
        from types import SimpleNamespace

        return SimpleNamespace(data=list(self._rows))


class _DBFake:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _TableFake:
        return _TableFake(list(self._tables.get(name, [])))


def _scoped_media_svc(assigned: list[str]) -> MediaService:
    """Betrieb mit ZWEI Objekten; `assigned` gehört dem Anfragenden."""
    return MediaService(
        client=_DBFake(  # type: ignore[arg-type]
            {
                "properties": [
                    {"id": OWN_PID, "tenant_id": "T", "title": "Meins"},
                    {"id": FOREIGN_PID, "tenant_id": "T", "title": "Fremd"},
                ],
                "property_photos": [
                    {
                        "id": "ph-own",
                        "property_id": OWN_PID,
                        "url": "https://x/own.jpg",
                        "author": None,
                        "created_at": "2026-07-01T00:00:00Z",
                    },
                    {
                        "id": "ph-foreign",
                        "property_id": FOREIGN_PID,
                        "url": "https://x/foreign.jpg",
                        "author": None,
                        "created_at": "2026-07-02T00:00:00Z",
                    },
                ],
                "owner_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
                "staff_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
            }
        )
    )


def _owner_ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="T", role="owner")


def test_owner_sees_only_assigned_property_photos() -> None:
    """Ohne property_id-Filter: nur die Fotos der ZUGEORDNETEN Objekte."""
    svc = _scoped_media_svc(assigned=[OWN_PID])
    items = svc.list_media("T", include_booking=False, ctx=_owner_ctx())
    assert [i.property_id for i in items] == [OWN_PID]


def test_owner_cannot_widen_scope_with_property_id() -> None:
    """Untergeschobenes fremdes property_id weitet den Scope NICHT aus."""
    svc = _scoped_media_svc(assigned=[OWN_PID])
    items = svc.list_media(
        "T", include_booking=False, property_id=FOREIGN_PID, ctx=_owner_ctx()
    )
    assert items == []


def test_owner_without_assignment_sees_nothing() -> None:
    """Fail-closed: keine Zuordnung → keine Bilder."""
    svc = _scoped_media_svc(assigned=[])
    items = svc.list_media("T", include_booking=False, ctx=_owner_ctx())
    assert items == []


def test_staff_scope_applies_too() -> None:
    """§4.3: derselbe Schnitt über staff_property_assignments."""
    svc = _scoped_media_svc(assigned=[OWN_PID])
    ctx = AuthContext(user_id="u1", tenant_id="T", role="cleaner")
    items = svc.list_media("T", include_booking=False, ctx=ctx)
    assert [i.property_id for i in items] == [OWN_PID]


def test_admin_sees_all_properties_of_tenant() -> None:
    """Gegenprobe: admin ist nicht eingeschränkt."""
    svc = _scoped_media_svc(assigned=[])
    ctx = AuthContext(user_id="u1", tenant_id="T", role="admin")
    items = svc.list_media("T", include_booking=False, ctx=ctx)
    assert {i.property_id for i in items} == {OWN_PID, FOREIGN_PID}


def test_delete_foreign_property_photo_is_404() -> None:
    """Wurzel 9: löschen darf nur, wer es auch sehen darf."""
    svc = _scoped_media_svc(assigned=[OWN_PID])
    with pytest.raises(MediaError) as exc:
        svc.delete_media("T", "property", "ph-foreign", ctx=_owner_ctx())
    assert exc.value.status_code == 404
