"""Tests für den properties-Slice.

Unit/Contract (immer): Health, Schema-Validierung, Service-CRUD mit gemocktem
Supabase-Client (tenant-Scope wird im Code erzwungen).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.properties.schemas import (
    PhotoUpdateRequest,
    PropertyCreate,
    PropertyType,
    PropertyUpdate,
)
from src.features.properties.service import (
    PropertiesService,
    PropertyError,
    _max_stay_of,
)
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1", role: str = "admin") -> AuthContext:
    # Default admin: die meisten Tests prüfen NICHT den Owner-Scope. Der Owner-
    # Self-Scope (§4.2) hat eigene Tests, die role='owner' explizit setzen.
    return AuthContext(user_id="u-1", tenant_id=tenant, role=role)


def _row(**over: object) -> dict:
    base = {
        "id": "p-1",
        "tenant_id": "t-1",
        "title": "Villa",
        "description": None,
        "property_type": "ferienhaus",
        "status": "draft",
        "max_guests": 4,
        "street": None,
        "house_number": None,
        "postal_code": None,
        "city": None,
        "country": None,
        "lat": None,
        "lng": None,
        "amenities": [],
        "photos": [],
        "type_attributes": {},
        "created_at": "2026-06-17T00:00:00Z",
        "updated_at": "2026-06-17T00:00:00Z",
        # Die _svc-Kette liefert dieselbe Row für ALLE Tabellen — auch für den
        # tenant_billing_profile-Gate-Check in create(); Flag daher hier setzen.
        "stripe_charges_enabled": True,
    }
    base.update(over)
    return base


def _svc(result_data: list[dict]) -> PropertiesService:
    db = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=result_data)
    # alle Builder-Methoden geben die Kette zurück
    for m in ("select", "eq", "in_", "limit", "order", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    db.table.return_value = chain
    return PropertiesService(service_client=db)


# --- Health ---

def test_properties_health() -> None:
    resp = client.get("/api/v1/properties/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "properties", "status": "ok"}


# --- Schema-Validierung ---

def test_property_create_requires_title() -> None:
    with pytest.raises(ValidationError):
        PropertyCreate(title="")


def test_property_create_rejects_bad_guest_count() -> None:
    with pytest.raises(ValidationError):
        PropertyCreate(title="X", max_guests=0)


def test_property_update_is_all_optional() -> None:
    upd = PropertyUpdate()
    assert upd.model_dump(exclude_unset=True) == {}


def test_platform_description_is_independent_of_description() -> None:
    # Eigenplattform-Text lässt sich unabhängig von der kanonischen (OTA-)
    # description per PATCH setzen; nur das gesetzte Feld geht raus.
    upd = PropertyUpdate(platform_description="Nur eigene Seite")
    assert upd.model_dump(exclude_unset=True) == {
        "platform_description": "Nur eigene Seite"
    }


# --- Service-CRUD ---

def test_create_sets_tenant_from_context() -> None:
    svc = _svc([_row()])
    res = svc.create(_ctx(), PropertyCreate(title="Villa", property_type=PropertyType.ferienhaus))
    assert res.tenant_id == "t-1"
    assert res.title == "Villa"


def test_create_without_tenant_fails() -> None:
    svc = _svc([_row()])
    with pytest.raises(PropertyError) as exc:
        svc.create(_ctx(tenant=None), PropertyCreate(title="Villa"))
    assert exc.value.status_code == 400


def test_get_missing_raises_404() -> None:
    svc = _svc([])
    with pytest.raises(PropertyError) as exc:
        svc.get(_ctx(), "p-x")
    assert exc.value.status_code == 404


def test_list_returns_items() -> None:
    svc = _svc([_row(), _row(id="p-2", title="Chalet")])
    res = svc.list(_ctx())
    assert res.total == 2
    assert {i.title for i in res.items} == {"Villa", "Chalet"}


# --- Bild-Upload ---

def test_upload_image_rejects_bad_mime() -> None:
    svc = _svc([_row()])  # Objekt existiert (get → ok)
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-1", b"data", "application/pdf")
    assert exc.value.status_code == 415


def test_upload_image_rejects_too_large() -> None:
    svc = _svc([_row()])
    big = b"x" * (PropertiesService.IMAGE_MAX_BYTES + 1)
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-1", big, "image/png")
    assert exc.value.status_code == 413


def test_upload_image_unknown_property_raises_404() -> None:
    svc = _svc([])  # get findet nichts
    with pytest.raises(PropertyError) as exc:
        svc.upload_image(_ctx(), "p-x", b"data", "image/png")
    assert exc.value.status_code == 404


def test_upload_image_returns_public_url() -> None:
    # DB-Mock mit Storage: get() liefert ein Objekt, Storage gibt Public-URL.
    db = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[_row()])
    for m in ("select", "eq", "order", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    db.table.return_value = chain

    storage = MagicMock()
    storage.get_public_url.return_value = (
        "https://x.supabase.co/storage/v1/object/public/property-images/t-1/p-1/custom-map.png"
    )
    db.storage.from_.return_value = storage

    svc = PropertiesService(service_client=db)
    url = svc.upload_image(_ctx(), "p-1", b"img", "image/png", slot="custom-map")

    db.storage.from_.assert_called_once_with("property-images")
    # Pfad enthält tenant/property/slot, Upload wurde aufgerufen.
    assert storage.upload.called
    assert "custom-map.png" in storage.upload.call_args[0][0]
    assert url.startswith("https://x.supabase.co/")
    assert "?v=" in url  # Cache-Buster


# --- publish (draft→active): ohne Preis 422 ---------------------------------
class _PublishQuery:
    def __init__(self, db, name):  # noqa: ANN001
        self._db = db
        self._name = name

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        r.data = self._db.canned.get(self._name, [])
        return r


class _PublishDB:
    def __init__(self, canned):  # noqa: ANN001
        self.canned = canned

    def table(self, name):  # noqa: ANN001, ANN201
        return _PublishQuery(self, name)


def test_publish_without_rate_plan_is_422() -> None:
    # Property existiert, aber KEIN rate_plan → Veröffentlichen abgelehnt (kein Fallback).
    db = _PublishDB({"properties": [_row()], "rate_plans": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 422


def test_publish_missing_property_404() -> None:
    db = _PublishDB({"properties": [], "rate_plans": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-x")
    assert exc.value.status_code == 404


def test_resync_missing_property_404() -> None:
    db = _PublishDB({"properties": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.resync_content(_ctx(), "p-x")
    assert exc.value.status_code == 404


def test_resync_existing_property_returns_it() -> None:
    # Objekt vorhanden → Resync liefert es zurück (Content-/max_stay-Push sind
    # best-effort und verschlucken den fehlenden Channel-Manager im Mock).
    db = _PublishDB({"properties": [_row()]})
    svc = PropertiesService(service_client=db)
    res = svc.resync_content(_ctx(), "p-1")
    assert res.id == "p-1"


# --- Foto-/Galerieverwaltung -------------------------------------------------
#
# In-Memory-Fake-DB, die property_photos und den properties.photos-Spiegel echt
# nachbildet (die einfache _svc-Kette teilt sich einen Mock über alle Tabellen
# und reicht für die feldgenaue Foto-Logik nicht).


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _PhotoQuery:
    def __init__(self, db: "_PhotoDB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: list[tuple[str, list[str]]] = []
        self._order: str | None = None
        self._desc = False
        self._limit: int | None = None

    def select(self, *_a: object, **_k: object) -> "_PhotoQuery":
        self._op = "select"
        return self

    def insert(self, payload: dict) -> "_PhotoQuery":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_PhotoQuery":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_PhotoQuery":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_PhotoQuery":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_PhotoQuery":
        self._in.append((col, [str(v) for v in vals]))
        return self

    def order(self, col: str, desc: bool = False) -> "_PhotoQuery":
        self._order = col
        self._desc = desc
        return self

    def limit(self, n: int) -> "_PhotoQuery":
        self._limit = n
        return self

    def _match(self, row: dict) -> bool:
        return all(str(row.get(c)) == str(v) for c, v in self._filters) and all(
            str(row.get(c)) in vals for c, vals in self._in
        )

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            new = dict(self._payload or {})
            new.setdefault("id", f"ph-{self._db.next_id()}")
            new.setdefault("created_at", "2026-06-17T00:00:00Z")
            new.setdefault("updated_at", "2026-06-17T00:00:00Z")
            rows.append(new)
            return _Result([new])
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload or {})
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(selected)
        if self._order:
            selected = sorted(
                selected, key=lambda r: r.get(self._order) or 0, reverse=self._desc
            )
        if self._limit is not None:
            selected = selected[: self._limit]
        return _Result(selected)


class _PhotoStorage:
    def __init__(self) -> None:
        self.uploaded: list[str] = []
        self.removed: list[str] = []

    def upload(self, path: str, _content: bytes, _opts: dict) -> None:
        self.uploaded.append(path)

    def get_public_url(self, path: str) -> str:
        return f"https://x.supabase.co/storage/v1/object/public/property-images/{path}"

    def remove(self, paths: list[str]) -> None:
        self.removed.extend(paths)


class _PhotoStorageNS:
    def __init__(self, storage: _PhotoStorage) -> None:
        self._storage = storage

    def from_(self, _bucket: str) -> _PhotoStorage:
        return self._storage


class _PhotoDB:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {
            "properties": [_row()],
            "property_photos": [],
        }
        self._counter = 0
        self.storage = _PhotoStorageNS(_PhotoStorage())

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _PhotoQuery:
        return _PhotoQuery(self, name)


def _png(size: int) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"x" * max(0, size - 8)


def test_add_photo_first_becomes_cover_and_mirrors() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    photo = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    assert photo.is_cover is True
    assert photo.sort_order == 0
    # properties.photos gespiegelt.
    assert db.tables["properties"][0]["photos"] == [photo.url]


def test_add_photo_rejects_bad_mime() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "application/pdf")
    assert exc.value.status_code == 415


def test_add_photo_rejects_too_small() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.add_photo(_ctx(), "p-1", _png(1024), "image/png")
    assert exc.value.status_code == 413


def test_add_photo_rejects_too_large() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    big = _png(PropertiesService.GALLERY_MAX_BYTES + 1)
    with pytest.raises(PropertyError) as exc:
        svc.add_photo(_ctx(), "p-1", big, "image/png")
    assert exc.value.status_code == 413


def test_multi_upload_creates_multiple_rows_single_cover() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    a = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    b = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/jpeg")
    c = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    assert len(db.tables["property_photos"]) == 3
    covers = [p for p in db.tables["property_photos"] if p["is_cover"]]
    assert len(covers) == 1 and covers[0]["id"] == a.id
    assert [a.sort_order, b.sort_order, c.sort_order] == [0, 1, 2]


def test_reorder_persists_and_mirrors() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    a = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    b = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    svc.reorder_photos(_ctx(), "p-1", [b.id, a.id])
    rows = {r["id"]: r["sort_order"] for r in db.tables["property_photos"]}
    assert rows[b.id] == 0 and rows[a.id] == 1
    # Cover (a) bleibt zuerst im Spiegel, danach nach sort_order (b).
    assert db.tables["properties"][0]["photos"][0] == a.url


def test_reorder_rejects_mismatched_ids() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    with pytest.raises(PropertyError) as exc:
        svc.reorder_photos(_ctx(), "p-1", ["fremd"])
    assert exc.value.status_code == 400


def test_set_cover_moves_cover_and_keeps_single() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    b = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    svc.update_photo(_ctx(), "p-1", b.id, PhotoUpdateRequest(is_cover=True))
    covers = [p for p in db.tables["property_photos"] if p["is_cover"]]
    assert len(covers) == 1 and covers[0]["id"] == b.id


def test_caption_per_locale_saved_and_read() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    a = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    cap = {"de": "Wohnzimmer", "en": "Living room", "da": "Stue"}
    updated = svc.update_photo(_ctx(), "p-1", a.id, PhotoUpdateRequest(caption=cap))
    assert updated.caption == cap
    listed = svc.list_photos(_ctx(), "p-1")
    assert listed.items[0].caption == cap


def test_delete_removes_row_file_and_reassigns_cover() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    a = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")  # Cover
    b = svc.add_photo(_ctx(), "p-1", _png(60 * 1024), "image/png")
    svc.delete_photo(_ctx(), "p-1", a.id)
    rows = db.tables["property_photos"]
    assert len(rows) == 1 and rows[0]["id"] == b.id
    assert rows[0]["is_cover"] is True  # Cover neu vergeben
    assert db.storage.from_("property-images").removed  # Datei entfernt
    assert db.tables["properties"][0]["photos"] == [b.url]


def test_delete_unknown_photo_404() -> None:
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.delete_photo(_ctx(), "p-1", "nope")
    assert exc.value.status_code == 404


def test_list_photos_unknown_property_404() -> None:
    db = _PhotoDB()
    db.tables["properties"] = []
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.list_photos(_ctx(), "p-x")
    assert exc.value.status_code == 404


# --- Gate: Objekt-Anlage erst mit bestätigtem Stripe-Account ----------------

def test_create_blocked_without_confirmed_stripe_account() -> None:
    """Ohne charges_enabled darf KEIN Objekt angelegt werden (Onboarding/KYC
    muss vorher abgeschlossen sein)."""
    db = _PhotoDB()
    db.tables["tenant_billing_profile"] = [
        {"tenant_id": "t-1", "stripe_charges_enabled": False}
    ]
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.create(_ctx(), PropertyCreate(title="Villa", property_type=PropertyType.ferienhaus))
    assert exc.value.status_code == 409
    # Es wurde KEIN Objekt angelegt.
    assert len(db.tables.get("properties", [])) == 1  # nur die Default-Row


def test_create_allowed_with_confirmed_stripe_account() -> None:
    db = _PhotoDB()
    db.tables["properties"] = []
    db.tables["tenant_billing_profile"] = [
        {"tenant_id": "t-1", "stripe_charges_enabled": True}
    ]
    svc = PropertiesService(service_client=db)
    res = svc.create(_ctx(), PropertyCreate(title="Villa", property_type=PropertyType.ferienhaus))
    assert res.title == "Villa"
    assert len(db.tables["properties"]) == 1


# --- Betriebsart-Scope: Listen + Typ-Validierung -----------------------------
#
# tenants.accommodation_type bestimmt die sichtbaren/erlaubten Objekttypen:
# hotel → Zimmertypen, vacation_rental → Ferienobjekt-Typen, NULL → alles.


def _accommodation_db(accommodation: str | None) -> _PhotoDB:
    db = _PhotoDB()
    db.tables["tenants"] = [{"id": "t-1", "accommodation_type": accommodation}]
    db.tables["tenant_billing_profile"] = [
        {"tenant_id": "t-1", "stripe_charges_enabled": True}
    ]
    db.tables["properties"] = [
        _row(id="p-fewo", title="FeWo", property_type="appartement"),
        _row(id="p-zimmer", title="Zimmer 101", property_type="einzelzimmer"),
    ]
    return db


def test_list_hotel_shows_only_room_property_types() -> None:
    svc = PropertiesService(service_client=_accommodation_db("hotel"))
    res = svc.list(_ctx())
    assert [i.title for i in res.items] == ["Zimmer 101"]


def test_list_vacation_rental_shows_only_vr_types() -> None:
    svc = PropertiesService(service_client=_accommodation_db("vacation_rental"))
    res = svc.list(_ctx())
    assert [i.title for i in res.items] == ["FeWo"]


def test_list_without_accommodation_type_shows_all() -> None:
    svc = PropertiesService(service_client=_accommodation_db(None))
    res = svc.list(_ctx())
    assert res.total == 2


# --- Owner-Scope (§4.2): Eigentümer sieht nur zugeordnete Objekte ------------

def test_list_owner_scoped_to_assigned() -> None:
    """Ein Eigentümer sieht in der Objektliste NUR seine zugeordneten Objekte,
    nicht die aller anderen Eigentümer desselben Mandanten."""
    db = _accommodation_db(None)
    db.tables["owner_property_assignments"] = [
        {"tenant_id": "t-1", "user_id": "u-1", "property_id": "p-fewo"}
    ]
    svc = PropertiesService(service_client=db)
    res = svc.list(_ctx(role="owner"))
    assert [i.id for i in res.items] == ["p-fewo"]


def test_get_owner_foreign_property_404() -> None:
    """Ein Eigentümer erhält für ein NICHT zugeordnetes Objekt 404 (keine
    Stammdaten-Leaks fremder Objekte)."""
    db = _accommodation_db(None)
    db.tables["owner_property_assignments"] = [
        {"tenant_id": "t-1", "user_id": "u-1", "property_id": "p-fewo"}
    ]
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.get(_ctx(role="owner"), "p-zimmer")  # fremdes Objekt
    assert exc.value.status_code == 404


def test_list_owner_without_assignments_sees_nothing() -> None:
    """Ein Eigentümer ohne jede Zuordnung sieht keine Objekte (fail-closed)."""
    db = _accommodation_db(None)
    db.tables["owner_property_assignments"] = []
    svc = PropertiesService(service_client=db)
    res = svc.list(_ctx(role="owner"))
    assert res.total == 0


def test_create_rejects_type_outside_accommodation() -> None:
    db = _accommodation_db("vacation_rental")
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.create(
            _ctx(), PropertyCreate(title="Suite", property_type=PropertyType.suite)
        )
    assert exc.value.status_code == 422
    assert len(db.tables["properties"]) == 2  # nichts angelegt


def test_create_accepts_matching_type() -> None:
    db = _accommodation_db("hotel")
    svc = PropertiesService(service_client=db)
    res = svc.create(
        _ctx(),
        PropertyCreate(title="Zimmer 102", property_type=PropertyType.doppelzimmer),
    )
    assert res.title == "Zimmer 102"


def test_update_rejects_type_switch_outside_accommodation() -> None:
    db = _accommodation_db("hotel")
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.update(
            _ctx(),
            "p-zimmer",
            PropertyUpdate(property_type=PropertyType.ferienhaus),
        )
    assert exc.value.status_code == 422
    row = next(r for r in db.tables["properties"] if r["id"] == "p-zimmer")
    assert row["property_type"] == "einzelzimmer"  # unverändert


# --- Maximalaufenthalt aus type_attributes.availability (an die Portale) -------
def test_max_stay_of_reads_availability() -> None:
    assert _max_stay_of({"type_attributes": {"availability": {"maxStay": 14}}}) == 14


def test_max_stay_of_defaults_zero_when_missing_or_invalid() -> None:
    # Kein Wert / kein Block → 0 (= keine Obergrenze). Ungültig → 0 (kein Crash).
    assert _max_stay_of({}) == 0
    assert _max_stay_of({"type_attributes": {}}) == 0
    assert _max_stay_of({"type_attributes": {"availability": {"maxStay": None}}}) == 0
    assert _max_stay_of({"type_attributes": {"availability": {"maxStay": "x"}}}) == 0
