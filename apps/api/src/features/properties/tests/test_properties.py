"""Tests für den properties-Slice.

Unit/Contract (immer): Health, Schema-Validierung, Service-CRUD mit gemocktem
Supabase-Client (tenant-Scope wird im Code erzwungen).
"""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.config import get_settings
from src.core.security import AuthContext
from src.features.properties import service as properties_service
from src.features.properties.gebuehren import (
    fee_category,
    fee_signatur,
    normalize_fees,
)
from src.features.properties.rooms import room_row
from src.features.properties.schemas import (
    ChannelState,
    PhotoUpdateRequest,
    PropertyCreate,
    PropertyRoomUpdate,
    PropertyType,
    PropertyUpdate,
)
from src.features.properties.service import (
    PropertiesService,
    PropertyError,
    _derive_channels,
    _sniff_image_ext,
)
from src.features.properties.steuern import normalize_taxes, nur_steuern_geaendert
from src.features.properties.verfuegbarkeit_push import max_stay_of
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
    # alle Builder-Methoden geben die Kette zurück. `is_` gehört dazu, seit die
    # Liste archivierte Objekte ausblendet (0416) — ohne den Eintrag gäbe
    # MagicMock ein FRISCHES Mock zurück, dessen execute() keine Daten trägt,
    # und jede Liste wäre im Test leer.
    for m in (
        "select", "eq", "in_", "limit", "order", "insert", "update", "delete", "is_",
    ):
        getattr(chain, m).return_value = chain
    # `.not_` ist ein Attribut, keine Methode: `query.not_.is_(...)`.
    chain.not_ = chain
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
    # DB-Mock mit Storage: get() liefert ein Objekt, Upload läuft durch.
    db = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[_row()])
    for m in ("select", "eq", "order", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    db.table.return_value = chain

    storage = MagicMock()
    db.storage.from_.return_value = storage

    svc = PropertiesService(service_client=db)
    url = svc.upload_image(_ctx(), "p-1", b"img", "image/png", slot="custom-map")

    db.storage.from_.assert_called_once_with("property-images")
    # Pfad enthält tenant/property/slot, Upload wurde aufgerufen.
    assert storage.upload.called
    assert "custom-map.png" in storage.upload.call_args[0][0]
    # URL wird NICHT vom Storage-Client gebaut (der kennt nur die interne
    # Kong-Adresse), sondern aus der von außen erreichbaren Basis.
    assert not storage.get_public_url.called
    assert url.startswith(f"{get_settings().storage_public_base}/storage/v1/object/public/")
    assert "/property-images/t-1/p-1/custom-map.png?v=" in url  # Cache-Buster


# --- publish (draft→active): ohne Preis 422 ---------------------------------
class _PublishQuery:
    def __init__(self, db, name):  # noqa: ANN001
        self._db = db
        self._name = name

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def neq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def is_(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    @property
    def not_(self):  # noqa: ANN201
        """PostgREST-Negation (`.not_.is_(...)`) — der Archiv-Filter nutzt sie.

        Der Stub filtert ohnehin nicht, er gibt die Canned-Zeilen zurück;
        `not_` muss nur dieselbe Kette weiterreichen, sonst bricht der Aufruf
        mit AttributeError.
        """
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            pass

        r = _R()
        r.data = self._db.canned.get(self._name, [])
        # count="exact" liest der Kontingent-Check; die Länge der Canned-Zeilen
        # ist hier die Zahl der aktiven Objekte.
        r.count = len(r.data)
        return r


class _PublishDB:
    def __init__(self, canned):  # noqa: ANN001
        self.canned = canned

    def table(self, name):  # noqa: ANN001, ANN201
        return _PublishQuery(self, name)


# publish() prüft VOR allem anderen die Zahlungsfreigabe des Tenants
# (_require_payments_ready → tenant_billing_profile.stripe_charges_enabled).
# Wer den Pfad DAHINTER testen will, muss das Profil freigeschaltet mitliefern —
# sonst schlägt schon das Stripe-Gate mit 409 zu und der Test prüft nichts.
_BILLING_READY = [{"stripe_charges_enabled": True}]


def test_publish_without_rate_plan_is_422() -> None:
    # Property existiert, aber KEIN rate_plan → Veröffentlichen abgelehnt (kein Fallback).
    db = _PublishDB(
        {
            "properties": [_row()],
            "rate_plans": [],
            "tenant_billing_profile": _BILLING_READY,
        }
    )
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 422


def test_publish_missing_property_404() -> None:
    db = _PublishDB(
        {
            "properties": [],
            "rate_plans": [],
            "tenant_billing_profile": _BILLING_READY,
        }
    )
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-x")
    assert exc.value.status_code == 404


def test_publish_blocked_without_payments_ready() -> None:
    """Ohne Stripe-Freigabe wird VOR allen anderen Prüfungen abgelehnt (409).

    Sichert das Gate selbst ab — es ist die eine Quelle der Wahrheit für
    „darf dieser Mandant verkaufen?".
    """
    db = _PublishDB({"properties": [_row()], "rate_plans": []})
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 409


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
        self._is_null: list[str] = []
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

    def is_(self, col: str, val: object) -> "_PhotoQuery":
        # PostgREST-`is`: nur „ist leer" wird gebraucht (deleted_at is null).
        self._is_null.append(col)
        assert val == "null", f"is_({col}, {val!r}) wird hier nicht nachgebildet"
        return self

    def order(self, col: str, desc: bool = False) -> "_PhotoQuery":
        self._order = col
        self._desc = desc
        return self

    def limit(self, n: int) -> "_PhotoQuery":
        self._limit = n
        return self

    def _match(self, row: dict) -> bool:
        return (
            all(str(row.get(c)) == str(v) for c, v in self._filters)
            and all(str(row.get(c)) in vals for c, vals in self._in)
            and all(row.get(c) is None for c in self._is_null)
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


# --- Gate: Zahlungsfreigabe erst beim Veröffentlichen -----------------------

def test_create_allowed_as_draft_without_stripe_account() -> None:
    """Ein ENTWURF darf ohne Stripe-Freigabe entstehen.

    Das Zahlungs-Gate greift bewusst erst bei publish(): erst wenn ein Gast
    tatsächlich buchen/zahlen kann, muss eine Auszahlung möglich sein. Ein
    Gastgeber soll sein Objekt vorbereiten können, während das KYC noch läuft.
    """
    db = _PhotoDB()
    db.tables["properties"] = []
    db.tables["tenant_billing_profile"] = [
        {"tenant_id": "t-1", "stripe_charges_enabled": False}
    ]
    svc = PropertiesService(service_client=db)
    res = svc.create(
        _ctx(), PropertyCreate(title="Villa", property_type=PropertyType.ferienhaus)
    )
    # Angelegt — und zwar zwingend als Entwurf (nie direkt aktiv).
    assert res.status == "draft"
    assert len(db.tables.get("properties", [])) == 1


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
    assert max_stay_of({"type_attributes": {"availability": {"maxStay": 14}}}) == 14


def test_max_stay_of_defaults_zero_when_missing_or_invalid() -> None:
    # Kein Wert / kein Block → 0 (= keine Obergrenze). Ungültig → 0 (kein Crash).
    assert max_stay_of({}) == 0
    assert max_stay_of({"type_attributes": {}}) == 0
    assert max_stay_of({"type_attributes": {"availability": {"maxStay": None}}}) == 0
    assert max_stay_of({"type_attributes": {"availability": {"maxStay": "x"}}}) == 0


def test_publish_reiht_max_stay_auch_als_null_ein() -> None:
    """publish() darf den Maximalaufenthalt NICHT hinter `> 0` verstecken.

    Vorher stand in `publish()` ein `if max_stay > 0`. Ein Objekt, dessen
    Obergrenze im Verfügbarkeits-Formular entfernt wurde und das danach neu
    veröffentlicht wird, behielt damit die ALTE Grenze bei den Portalen: der Job
    blieb aus, der Full-Sync führt max_stay nicht als Ganz-Horizont-Push, und der
    ARI-Schatten spiegelt max_stay ohnehin nicht. 0 ist bei Channex ausdrücklich
    „keine Obergrenze" und damit der Gegenzustand, der gesendet werden MUSS
    (Wurzel 1). `push_max_stay` im Speichern-Pfad macht das seit je so.

    Geprüft an der Quelle statt am kompletten publish()-Durchlauf: der Aufruf
    liegt hinter Stripe-Gate, Abo-Kontingent, Rate-Plan- und
    Verfügbarkeits-Aufbau. Ein Test, der das alles nachstellt, prüfte am Ende
    alles ausser dieser einen Entscheidung — und würde bei jeder Änderung an den
    Gates brechen, ohne dass die Regel hier verletzt wäre.
    """
    quelle = Path(properties_service.__file__).read_text(encoding="utf-8")
    _, _, nach_publish = quelle.partition("def publish(")
    publish_rumpf, _, _ = nach_publish.partition("\n    def ")
    # Kommentarzeilen raus: der Rumpf ERKLÄRT den alten Gate-Ausdruck, und ohne
    # diesen Schnitt prüfte der Test seine eigene Begründung statt des Codes.
    code = "\n".join(
        z for z in publish_rumpf.splitlines() if not z.lstrip().startswith("#")
    )
    assert '"max_stay": max_stay_of(row)' in code
    assert "if max_stay > 0" not in code


# --- Kanal-Zustands-Ableitung (Ebene B, 0162) ---------------------------------
def test_derive_channels_active_object_all_flags_on() -> None:
    # Marktplatz zusätzlich freigegeben (0203) → wirklich sichtbar.
    row = {"status": "active", "listed_on_website": True,
           "listed_on_marketplace": True, "moderation_status": "approved"}
    ch = _derive_channels(row, ChannelState.active)
    assert ch.website == ChannelState.active
    assert ch.marketplace == ChannelState.active
    assert ch.portals == ChannelState.active


def test_derive_channels_marketplace_without_approval_is_pending() -> None:
    """Gelistet, aber ohne Freigabe des Betreibers: der Marktplatz zeigt das
    Objekt NICHT — also `pending`, nie `active`. Genau hier log die Oberfläche
    (live 11.08.2026: 17 grüne Plattform-Punkte, leerer Marktplatz)."""
    for moderation in ("pending", "draft", "rejected", None):
        row = {"status": "active", "listed_on_website": True,
               "listed_on_marketplace": True, "moderation_status": moderation}
        ch = _derive_channels(row, None)
        assert ch.marketplace == ChannelState.pending, moderation
        # Die Website hängt NICHT an der Marktplatz-Freigabe.
        assert ch.website == ChannelState.active, moderation


def test_derive_channels_marketplace_flag_off_beats_approval() -> None:
    """Schalter aus → paused, auch wenn die Freigabe vorliegt (Nutzer-Wille)."""
    row = {"status": "active", "listed_on_website": True,
           "listed_on_marketplace": False, "moderation_status": "approved"}
    assert _derive_channels(row, None).marketplace == ChannelState.paused


def test_derive_channels_flag_off_is_paused_not_error() -> None:
    # Kanal-Flag aus → paused (Nutzer-Wille), NIE error.
    row = {"status": "active", "listed_on_website": False,
           "listed_on_marketplace": True, "moderation_status": "approved"}
    ch = _derive_channels(row, None)
    assert ch.website == ChannelState.paused
    assert ch.marketplace == ChannelState.active
    # Keine Channex-Map → Portale nicht eingerichtet (kein erfundener Wert).
    assert ch.portals == ChannelState.not_connected


def test_derive_channels_draft_object_paused_local_channels() -> None:
    # Nicht-aktives Objekt: lokale Kanäle können nicht verkaufen → paused
    # (die UI dimmt zusätzlich anhand status).
    row = {"status": "draft", "listed_on_website": True,
           "listed_on_marketplace": True}
    ch = _derive_channels(row, None)
    assert ch.website == ChannelState.paused
    assert ch.marketplace == ChannelState.paused


# --- Barrierefreiheits-Beweisfotos (0201) ------------------------------------



def test_sniff_detects_real_image_types() -> None:
    """Magic-Bytes erkennen die vier erlaubten Formate."""
    assert _sniff_image_ext(b"\x89PNG\r\n\x1a\n rest") == "png"
    assert _sniff_image_ext(b"\xff\xd8\xff\xe0 rest") == "jpg"
    assert _sniff_image_ext(b"RIFF" + b"1234" + b"WEBP" + b"rest") == "webp"
    assert _sniff_image_ext(b"GIF89a rest") == "gif"


def test_sniff_rejects_non_image() -> None:
    """Alles andere wird abgelehnt — auch wenn der Client 'image/png' behauptet.

    Genau das ist der Punkt: der content_type ist frei wählbar und damit kein
    Schutz (Wurzel 8). Eine als Bild getarnte HTML-/Skriptdatei fällt hier raus.
    """
    assert _sniff_image_ext(b"<html><script>alert(1)</script>") is None
    assert _sniff_image_ext(b"%PDF-1.7") is None
    assert _sniff_image_ext(b"") is None
    assert _sniff_image_ext(b"\x89PNG") is None  # abgeschnittene Signatur


def test_accessibility_upload_rejects_disguised_file() -> None:
    """Ein 'image/png' mit HTML-Inhalt wird mit 415 abgelehnt."""
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.upload_accessibility_photo(
            _ctx(), "p-1", "step_free_guest_entrance", b"<html>", "image/png"
        )
    assert exc.value.status_code == 415


def test_accessibility_upload_rejects_oversize() -> None:
    """Über 10 MB wird abgelehnt, bevor irgendetwas in den Bucket geht."""
    db = _PhotoDB()
    svc = PropertiesService(service_client=db)
    zu_gross = b"\x89PNG\r\n\x1a\n" + b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(PropertyError) as exc:
        svc.upload_accessibility_photo(
            _ctx(), "p-1", "step_free_guest_entrance", zu_gross, "image/png"
        )
    assert exc.value.status_code == 413


# --- Kontingent: nur so viele aktive Objekte wie gebucht --------------------
_ABO_5 = [{"status": "active", "reported_property_count": 5}]


def test_publish_ohne_abo_ist_422() -> None:
    """Ohne aktives Abo darf nichts live gehen."""
    db = _PublishDB(
        {
            "properties": [_row()],
            "rate_plans": [{"id": "rp-1", "currency": "EUR", "min_stay": 1}],
            "tenant_billing_profile": _BILLING_READY,
            "tenant_subscription": [],
        }
    )
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 422
    assert "Abo" in str(exc.value)


def test_publish_ueber_kontingent_ist_422() -> None:
    """5 gebucht, 5 andere bereits aktiv → das sechste wird abgewiesen."""
    db = _PublishDB(
        {
            "properties": [_row() for _ in range(5)],
            "rate_plans": [{"id": "rp-1", "currency": "EUR", "min_stay": 1}],
            "tenant_billing_profile": _BILLING_READY,
            "tenant_subscription": _ABO_5,
        }
    )
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-neu")
    assert exc.value.status_code == 422
    assert "5" in str(exc.value)


def test_publish_ohne_gebuchte_menge_ist_422() -> None:
    """Abo aktiv, aber Menge fehlt → fail-closed statt Fantasiewert (Wurzel 4)."""
    db = _PublishDB(
        {
            "properties": [_row()],
            "rate_plans": [{"id": "rp-1", "currency": "EUR", "min_stay": 1}],
            "tenant_billing_profile": _BILLING_READY,
            "tenant_subscription": [
                {"status": "active", "reported_property_count": None}
            ],
        }
    )
    svc = PropertiesService(service_client=db)
    with pytest.raises(PropertyError) as exc:
        svc.publish(_ctx(), "p-1")
    assert exc.value.status_code == 422


# --- Zimmer als gezählte Einheit (property_rooms, 0246 · Zuschnitt 0251) ----
# Ein Zimmer trägt nur noch Typ und Gruppe. Betten und Ausstattung hängen am
# Objekt — die Oberfläche zählt Zimmer, wie Lodgify das tut.

def test_room_reorder_rejects_partial_list() -> None:
    # Eine Teilliste würde die übrigen Zimmer still auf Position 0 schieben.
    svc = _svc([_row(id="r-1"), _row(id="r-2")])
    with pytest.raises(PropertyError) as exc:
        svc.reorder_rooms(_ctx(), "p-1", ["r-1"])
    assert exc.value.status_code == 422


def test_room_update_without_fields_is_rejected() -> None:
    # Ein leeres PATCH ist keine Änderung — es stillschweigend als Erfolg zu
    # quittieren, verschleierte einen Fehler beim Aufrufer (Wurzel 5).
    svc = _svc([_row()])
    with pytest.raises(PropertyError) as exc:
        svc.update_room(_ctx(), "p-1", "r-1", PropertyRoomUpdate())
    assert exc.value.status_code == 422


def test_room_delete_ist_idempotent() -> None:
    """Wurzel 2: ein schon gelöschtes Zimmer ist der Zielzustand, kein 404.

    Live gemessen: der Zimmer-Zähler arbeitet auf einer Momentaufnahme der
    Liste. Zwei Klicks auf „−" (oder ein Klick, bevor das Realtime-Ereignis
    durch ist) schicken dieselbe Zimmer-ID zweimal — der zweite Aufruf lief in
    einen 404, und die Maske meldete „nicht gefunden", obwohl genau das
    Gewünschte passiert war (Objekt 4ce8c81f…, Zimmer 28b5f900…).
    """
    class _Kette:
        def __init__(self, name: str, protokoll: list[str]) -> None:
            self.name, self.protokoll = name, protokoll
            self.loeschend = False

        def select(self, *_a: object, **_k: object) -> "_Kette":
            return self

        def delete(self) -> "_Kette":
            self.loeschend = True
            return self

        def eq(self, *_a: object, **_k: object) -> "_Kette":
            return self

        def limit(self, *_a: object, **_k: object) -> "_Kette":
            return self

        def order(self, *_a: object, **_k: object) -> "_Kette":
            return self

        def execute(self) -> object:
            if self.loeschend:
                self.protokoll.append(f"delete:{self.name}")
                # Kein Treffer: die Zeile war schon weg.
                return SimpleNamespace(data=[])
            if self.name == "properties":
                return SimpleNamespace(data=[_row()])
            return SimpleNamespace(data=[])

    class _DB:
        def __init__(self) -> None:
            self.protokoll: list[str] = []

        def table(self, name: str) -> _Kette:
            return _Kette(name, self.protokoll)

    db = _DB()
    svc = PropertiesService(service_client=db)
    # Kein Fehler — und KEIN Portal-Nachzug, denn es wurde nichts gelöscht.
    assert svc.delete_room(_ctx(), "p-1", "r-weg") is None
    assert "delete:property_rooms" in db.protokoll


def test_room_row_maps_all_fields() -> None:
    out = room_row(
        {
            "id": "r-1",
            "property_id": "p-1",
            "raum_typ": "schlafzimmer",
            "privat": False,
            "position": 3,
            "created_at": "2026-08-01T00:00:00Z",
            "updated_at": "2026-08-01T00:00:00Z",
        }
    )
    assert out["privat"] is False
    assert out["raum_typ"] == "schlafzimmer"
    assert out["position"] == 3


# --- Einheiten aufteilen (0265/0266) -----------------------------------------
def test_aufteilen_legt_einheiten_an_und_kuerzt_nur_freie() -> None:
    """Vergrößern immer, Verkleinern nur solange die Einheiten frei sind.

    Hostaway lässt das Kürzen mit Buchungen zu („it can generate situations of
    overlapping reservations") — wir nicht: eine Buchung ohne Einheit wäre eine
    unsichtbare Doppelbelegung.
    """
    from src.features.properties.errors import PropertyError

    class _DB:
        def __init__(self) -> None:
            self.units = [
                {"id": "u1", "tenant_id": "t1", "property_id": "p1",
                 "name": "Einheit 1", "position": 0},
            ]
            self.availability: list[dict] = []
            self.geloescht: list[str] = []

        def table(self, name):  # noqa: ANN001, ANN201
            return _Q(self, name)

    class _Q:
        def __init__(self, db, name) -> None:  # noqa: ANN001
            self.db, self.name, self._in = db, name, None

        def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            return self

        def eq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            return self

        def neq(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            return self

        def in_(self, _f, values):  # noqa: ANN001, ANN201
            self._in = values
            return self

        def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            return self

        def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
            return self

        def insert(self, rows):  # noqa: ANN001, ANN201
            for i, r in enumerate(rows):
                self.db.units.append({**r, "id": f"u{len(self.db.units) + i + 1}"})
            return self

        def delete(self):  # noqa: ANN201
            return self

        def execute(self):  # noqa: ANN201
            class _R:
                pass

            r = _R()
            if self.name == "property_units":
                if self._in is not None:
                    self.db.units = [u for u in self.db.units if u["id"] not in self._in]
                    self.db.geloescht.extend(self._in)
                r.data = list(self.db.units)
            elif self.name == "availability":
                r.data = [
                    a for a in self.db.availability
                    if self._in is None or a["unit_id"] in self._in
                ]
            else:
                r.data = []
            return r

    from src.features.properties.gebaeude import GebaeudeMixin

    class _Svc(GebaeudeMixin):
        def __init__(self, db) -> None:  # noqa: ANN001
            self._db = db

        def _require_tenant(self, _ctx):  # noqa: ANN001, ANN202
            return "t1"

        def get(self, _ctx, _pid):  # noqa: ANN001, ANN202
            return None

    db = _DB()
    svc = _Svc(db)

    # 1 → 3 Einheiten
    units = svc.set_unit_count(None, "p1", 3)
    assert [u["name"] for u in units] == ["Einheit 1", "Einheit 2", "Einheit 3"]

    # Einheit 3 belegt → Kürzen auf 2 muss scheitern
    db.availability.append({"unit_id": db.units[2]["id"], "date": "2026-07-01",
                            "status": "booked"})
    with pytest.raises(PropertyError) as exc:
        svc.set_unit_count(None, "p1", 2)
    assert exc.value.status_code == 409

    # frei → Kürzen geht
    db.availability.clear()
    rest = svc.set_unit_count(None, "p1", 2)
    assert len(rest) == 2


# --- Steuern: serverseitige Prüfung (steuern.normalize_taxes) ----------------


def test_normalize_taxes_nur_eine_ust() -> None:
    """Zwei USt-Zeilen sind ein Fehler — die Rechnung liest genau eine."""
    with pytest.raises(PropertyError) as exc:
        normalize_taxes(
            [
                {"id": "a", "kind": "vat", "mode": "percent", "value": 19,
                 "includedInPrice": True},
                {"id": "b", "kind": "vat", "mode": "percent", "value": 7,
                 "includedInPrice": True},
            ]
        )
    assert exc.value.status_code == 422


def test_normalize_taxes_saeubert_beschreibung() -> None:
    """Rich-Text wird mit Allowlist geparst; Skript-Anteile verschwinden."""
    out = normalize_taxes(
        [
            {
                "id": "t",
                "kind": "local",
                "name": "Kurtaxe",
                "mode": "amount",
                "value": 2,
                "descriptionHtml": "<b>fett</b><script>alert(1)</script>",
            }
        ]
    )
    assert out[0]["descriptionHtml"] == "<b>fett</b>"


def test_normalize_taxes_unbekannte_steuerart_faellt_durch() -> None:
    with pytest.raises(PropertyError):
        normalize_taxes(
            [{"id": "t", "kind": "local", "name": "X", "mode": "amount",
              "value": 1, "taxType": "Fantasiesteuer"}]
        )


def test_normalize_taxes_prozent_ueber_100() -> None:
    with pytest.raises(PropertyError):
        normalize_taxes(
            [{"id": "t", "kind": "vat", "mode": "percent", "value": 120,
              "includedInPrice": True}]
        )


def test_normalize_taxes_leere_uebersetzung_faellt_weg() -> None:
    """Ein ungefüllter Sprach-Tab darf nicht als leerer Name beim Portal landen."""
    out = normalize_taxes(
        [
            {
                "id": "t",
                "kind": "local",
                "name": "Kurtaxe",
                "mode": "amount",
                "value": 2,
                "names": {"de": "Kurtaxe", "en": "  "},
            }
        ]
    )
    assert out[0]["names"] == {"de": "Kurtaxe"}


def test_normalize_taxes_lokale_steuer_braucht_namen() -> None:
    with pytest.raises(PropertyError):
        normalize_taxes(
            [{"id": "t", "kind": "local", "mode": "amount", "value": 2}]
        )


# --- Steuer-Änderung → schlanker Sync statt vollem Content-Sync -------------


def test_nur_steuern_geaendert_erkennt_reines_steuer_update() -> None:
    alt = {"pricing": {"basePrice": 100, "taxes": [{"id": "a", "value": 7}]}}
    changes = {
        "type_attributes": {
            "pricing": {"basePrice": 100, "taxes": [{"id": "a", "value": 19}]}
        }
    }
    assert nur_steuern_geaendert(alt, changes) is True


def test_nur_steuern_geaendert_false_bei_weiterem_feld() -> None:
    """Ändert sich daneben Content, muss der VOLLE Sync laufen — sonst bliebe
    z. B. eine neue Beschreibung bei den Portalen liegen."""
    alt = {"pricing": {"taxes": []}}
    changes = {
        "type_attributes": {"pricing": {"taxes": [{"id": "a"}]}},
        "description": "neu",
    }
    assert nur_steuern_geaendert(alt, changes) is False


def test_nur_steuern_geaendert_false_bei_anderem_pricing_feld() -> None:
    alt = {"pricing": {"basePrice": 100, "taxes": []}}
    changes = {
        "type_attributes": {"pricing": {"basePrice": 120, "taxes": [{"id": "a"}]}}
    }
    assert nur_steuern_geaendert(alt, changes) is False


def test_nur_steuern_geaendert_false_ohne_steuer_unterschied() -> None:
    """Gleiche Steuern = kein Steuer-Update; dann greift die normale Regel."""
    alt = {"pricing": {"taxes": [{"id": "a", "value": 7}]}}
    changes = {"type_attributes": {"pricing": {"taxes": [{"id": "a", "value": 7}]}}}
    assert nur_steuern_geaendert(alt, changes) is False


def test_nur_steuern_geaendert_false_bei_anderem_attribut() -> None:
    """availability o. Ä. daneben geändert → voller Sync."""
    alt = {"availability": {"minStay": 2}, "pricing": {"taxes": []}}
    changes = {
        "type_attributes": {
            "availability": {"minStay": 3},
            "pricing": {"taxes": [{"id": "a"}]},
        }
    }
    assert nur_steuern_geaendert(alt, changes) is False


# --- Gebühren: serverseitige Prüfung (gebuehren.normalize_fees) ---------------
# Gebühren liefen bis zum Gebühren-Export ungeprüft durch (der Preis-Blob wurde
# übernommen wie er kam). Das ging, solange sie nur intern gerechnet wurden;
# seit sie als `type: "fee"` an die Portale gehen, ist jedes Feld Fremdeingabe.

_PORTALE = frozenset({"BookingCom", "AirBNB"})


def test_normalize_fees_prueft_die_gebuehrenart() -> None:
    """Die Art geht als Kategorie an die Portale — kein Freitext (Wurzel 4)."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Endreinigung", "amount": 50,
          "basis": "per_stay", "feeType": "cleaning"}],
        portale=_PORTALE,
    )
    assert ok[0]["feeType"] == "cleaning"
    with pytest.raises(PropertyError) as exc:
        normalize_fees(
            [{"id": "f1", "name": "X", "basis": "per_stay",
              "feeType": "raumschiff"}],
            portale=_PORTALE,
        )
    assert exc.value.status_code == 422


def test_normalize_fees_altbestand_ohne_art_bleibt_gueltig() -> None:
    """Bestandsgebühren haben keine Art — sie dürfen nicht plötzlich 422 werfen.
    Der Export liest dann „other", statt eine Art zu erfinden."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Alte Gebühr", "amount": 10, "basis": "per_night"}],
        portale=_PORTALE,
    )
    assert "feeType" not in ok[0]


def test_normalize_fees_prueft_basis_und_betrag() -> None:
    """Die Basis bestimmt die Channex-`logic`; ein unbekannter Wert käme dort
    als falsche Berechnungsart an."""
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "basis": "pro_mondphase"}],
            portale=_PORTALE,
        )
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "basis": "per_stay", "amount": -5}],
            portale=_PORTALE,
        )


def test_normalize_fees_braucht_namen_und_kennung() -> None:
    """Ohne Namen stünde beim Portal ein Platzhalter; ohne Kennung wäre die
    Steuerbemessungsgrundlage (referenziert Fee-IDs) mehrdeutig."""
    with pytest.raises(PropertyError):
        normalize_fees([{"id": "f1", "basis": "per_stay"}], portale=_PORTALE)
    with pytest.raises(PropertyError):
        normalize_fees([{"name": "Ohne Kennung"}], portale=_PORTALE)


def test_normalize_fees_lehnt_doppelte_kennung_ab() -> None:
    """Zwei gleiche IDs wären in der Bemessungsgrundlage nicht auflösbar."""
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "A", "basis": "per_stay"},
             {"id": "f1", "name": "B", "basis": "per_stay"}],
            portale=_PORTALE,
        )


def test_clean_portal_scope_nur_verbundene_portale() -> None:
    """Eine Einschränkung auf ein nicht verbundenes Portal wäre wirkungslos —
    die Oberfläche zeigte „nur an Booking", gesendet würde an alle."""
    ok = normalize_fees(
        [{"id": "f1", "name": "X", "basis": "per_stay",
          "portalScope": ["BookingCom"]}],
        portale=_PORTALE,
    )
    assert ok[0]["portalScope"] == ["BookingCom"]
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "basis": "per_stay",
              "portalScope": ["GibtEsNicht"]}],
            portale=_PORTALE,
        )


def test_clean_portal_scope_bei_nicht_ladbarer_liste_nicht_blockieren() -> None:
    """`portale=None` heißt „Liste nicht ladbar", NICHT „keine verbunden".

    Bei einem DB-Aussetzer würde ein leeres Set jede bestehende Einschränkung
    als unbekanntes Portal abweisen — der Betrieb könnte am Objekt dann nichts
    mehr speichern, auch keine Beschreibung, weil das Formular den ganzen
    Preis-Blob zurücksendet."""
    ok = normalize_fees(
        [{"id": "f1", "name": "X", "basis": "per_stay",
          "portalScope": ["IrgendeinPortal"]}],
        portale=None,
    )
    assert ok[0]["portalScope"] == ["IrgendeinPortal"]
    # Mit leerem Set (= wirklich keine Portale verbunden) greift die Prüfung.
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "basis": "per_stay",
              "portalScope": ["IrgendeinPortal"]}],
            portale=frozenset(),
        )


def test_nur_steuern_geaendert_gilt_auch_fuer_gebuehren() -> None:
    """Gebühren laufen über denselben Channex-Pfad wie Steuern — ein voller
    Content-Sync wäre für eine geänderte Reinigungsgebühr Verschwendung."""
    alt = {"pricing": {"fees": [{"id": "f1", "amount": 50}]}}
    changes = {"type_attributes": {"pricing": {"fees": [{"id": "f1", "amount": 60}]}}}
    assert nur_steuern_geaendert(alt, changes) is True


# --- Gebührenart-Taxonomie und Rechenart (Branchenstandard) -------------------
# 49 der 51 Gebührenarten sind live aus dem Standard abgelesen (Gebühren-Editor,
# Auswahlfeld „Gebührenart", 03.08.2026); ihre Airbnb-Kategorie steht im
# Hilfe-Artikel. Zwei kommen aus dem Artikel selbst, weil das Auswahlfeld sie
# nicht führte, seine Tabellen sie aber verlangen: `short_term_cleaning`
# (eigene Zeile der Export-Tabelle) und `security_deposit` (Zuordnung
# „Kaution → SecurityDeposit"). Diese Tests halten beide Enden fest.


def test_gebuehrenart_zuordnung_deckt_jede_airbnb_kategorie_ab() -> None:
    """Stichproben aus jeder Fußnote des Standards — Schlüssel UND Ziel."""
    faelle = {
        "additional_bed": "community",
        "utensils_cleaning": "community",
        "baby_bed": "community",
        "food_utensils": "management",
        "on_site_payment_method": "management",
        "water_craft_mooring": "management",
        "damage_protection_insurance": "resort",
        "transportation": "resort",
        "linens_bath": "linen",
        "pet_fee": "pet",
        "cleaning_fee": "cleaning",
        # Eigene Zeile der Export-Tabelle bzw. eigene Zuordnung — NICHT auf
        # `cleaning`/`resort` mitgeführt, sonst würden sie dort summiert.
        "short_term_cleaning": "short_term_cleaning",
        "security_deposit": "security_deposit",
    }
    for art, kategorie in faelle.items():
        assert fee_category({"feeType": art}) == kategorie, art
    # Ohne Kategorie: geht an KEIN Portal (Wurzel 4 — nichts erfinden).
    assert fee_category({"feeType": "unknown"}) is None
    assert fee_category({"feeType": "misc_charges"}) is None
    assert fee_category({}) is None
    # Bestandsschlüssel bleiben lesbar, sonst wäre das Objekt unspeicherbar.
    assert fee_category({"feeType": "cleaning"}) == "cleaning"
    assert fee_category({"feeType": "other"}) is None


def test_tier_basis_nur_an_der_haustiergebuehr() -> None:
    """„Pro Tier und Aufenthalt" nennt der Standard nur an der Haustiergebühr.
    An jeder anderen Art multiplizierte sie eine Zahl ohne Bezug zur Leistung."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Hund", "amount": 25, "basis": "per_pet_stay",
          "feeType": "pet_fee"}],
        portale=_PORTALE,
    )
    assert ok[0]["basis"] == "per_pet_stay"
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "Reinigung", "amount": 25,
              "basis": "per_pet_stay", "feeType": "cleaning_fee"}],
            portale=_PORTALE,
        )
    # Auch ohne Gebührenart: keine Kategorie, also keine Tier-Basis.
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "amount": 25, "basis": "per_pet_stay"}],
            portale=_PORTALE,
        )


def test_normalize_fees_prueft_die_rechenart() -> None:
    """Prozent oder Pauschalbetrag — Freitext gäbe es beim Portal nicht."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Resort", "amount": 5, "mode": "percent",
          "basis": "per_stay", "feeType": "resort"}],
        portale=_PORTALE,
    )
    assert ok[0]["mode"] == "percent"
    # Altbestand ohne `mode`: das waren ausschließlich Beträge.
    alt = normalize_fees(
        [{"id": "f1", "name": "Alt", "amount": 50, "basis": "per_stay"}],
        portale=_PORTALE,
    )
    assert alt[0]["mode"] == "amount"
    with pytest.raises(PropertyError):
        normalize_fees(
            [{"id": "f1", "name": "X", "mode": "mondphase", "basis": "per_stay"}],
            portale=_PORTALE,
        )


def test_normalize_fees_prozentsatz_hoechstens_hundert() -> None:
    """Channex lehnt `rate > 100` bei logic=percent ab — hier schon fehlschlagen,
    statt erst beim Sync."""
    with pytest.raises(PropertyError) as exc:
        normalize_fees(
            [{"id": "f1", "name": "X", "amount": 150, "mode": "percent",
              "basis": "per_stay"}],
            portale=_PORTALE,
        )
    assert exc.value.status_code == 422


def test_portal_scope_erlaubt_die_eigenen_buchungsstrecken() -> None:
    """Die Einschränkung zählt die eigene Buchungsstrecke mit — im Standard steht
    sie gleichrangig neben Airbnb und Booking.com."""
    ok = normalize_fees(
        [{"id": "f1", "name": "X", "basis": "per_stay", "amount": 10,
          "portalScope": ["direct", "portal", "BookingCom"]}],
        portale=_PORTALE,
    )
    assert ok[0]["portalScope"] == ["direct", "portal", "BookingCom"]


# --- Steuerbemessungsgrundlage (Gebührenkategorien, nicht Gebühren-IDs) -------


def test_taxable_base_nur_bekannte_items() -> None:
    """Grundpreis + die sechs von Airbnb unterstützten Kategorien; alles andere
    wäre eine Grundlage, die es beim Portal nicht gibt."""
    ok = normalize_taxes(
        [{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
          "value": 5, "taxableBase": ["base_price", "cleaning", "cleaning"]}],
        portale=frozenset(),
    )
    assert ok[0]["taxableBase"] == ["base_price", "cleaning"]
    with pytest.raises(PropertyError) as exc:
        normalize_taxes(
            [{"id": "t", "kind": "local", "name": "K", "mode": "percent",
              "value": 5, "taxableBase": ["security_deposit"]}],
            portale=frozenset(),
        )
    assert exc.value.status_code == 422


def test_taxable_base_altbestand_wird_auf_die_kategorie_gehoben() -> None:
    """Früher standen dort GEBÜHREN-IDs. Beim Portal gibt es „genau diese eine
    Gebühr" nicht — der Alt-Wert wird auf seine Kategorie umgeschrieben, statt
    das Objekt unspeicherbar zu machen oder die Grundlage still zu verlieren."""
    fees = normalize_fees(
        [{"id": "fee-uuid", "name": "Endreinigung", "amount": 50,
          "basis": "per_stay", "feeType": "cleaning_fee"}],
        portale=frozenset(),
    )
    ok = normalize_taxes(
        [{"id": "t", "kind": "local", "name": "Kurtaxe", "mode": "percent",
          "value": 5, "taxableBase": ["base_price", "fee-uuid"]}],
        portale=frozenset(),
        fees=fees,
    )
    assert ok[0]["taxableBase"] == ["base_price", "cleaning"]


def test_normalize_fees_haelt_die_beschreibung_fest() -> None:
    """Die Beschreibung stand im Editor, wurde aber nie gespeichert: `sauber`
    übernahm sie nicht. Jetzt bleibt sie — Allowlist-gesäubert (Wurzel 8)."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Reinigung", "amount": 50, "basis": "per_stay",
          "feeType": "cleaning_fee",
          "descriptionHtml": "<b>Fett</b><script>alert(1)</script>"}],
        portale=_PORTALE,
    )
    assert ok[0]["descriptionHtml"] == "<b>Fett</b>"
    # Leerer Text speichert kein leeres Feld mit.
    leer = normalize_fees(
        [{"id": "f1", "name": "Reinigung", "amount": 50, "basis": "per_stay",
          "feeType": "cleaning_fee", "descriptionHtml": "   "}],
        portale=_PORTALE,
    )
    assert "descriptionHtml" not in leer[0]


def test_fee_tax_included_default_ist_inklusive() -> None:
    """`taxIncluded` entscheidet, ob der eigene USt-Satz im Betrag steckt.
    Ohne Angabe gilt INKLUSIVE — das bisherige Verhalten; ein anderer Default
    machte jede Bestandsgebühr stillschweigend teurer."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Frühstück", "amount": 20, "basis": "per_stay",
          "feeType": "food", "taxRate": 19}],
        portale=_PORTALE,
    )
    assert ok[0]["taxIncluded"] is True
    exklusiv = normalize_fees(
        [{"id": "f1", "name": "Frühstück", "amount": 20, "basis": "per_stay",
          "feeType": "food", "taxRate": 19, "taxIncluded": False}],
        portale=_PORTALE,
    )
    assert exklusiv[0]["taxIncluded"] is False
    # Ohne eigenen Satz gibt es nichts zu entscheiden — kein Feld.
    ohne = normalize_fees(
        [{"id": "f1", "name": "Reinigung", "amount": 50, "basis": "per_stay",
          "feeType": "cleaning_fee"}],
        portale=_PORTALE,
    )
    assert "taxIncluded" not in ohne[0]


def test_fee_short_stay_only_wird_uebernommen() -> None:
    """„Nur für Kurzaufenthalte": ein Schalter, keine zweite Nächte-Zahl an der
    Gebühr — die Grenze ist die des Objekts (`shortStayMaxNights`)."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Kurz", "amount": 30, "basis": "per_stay",
          "feeType": "cleaning_fee", "shortStayOnly": True}],
        portale=_PORTALE,
    )
    assert ok[0]["shortStayOnly"] is True
    aus = normalize_fees(
        [{"id": "f1", "name": "Kurz", "amount": 30, "basis": "per_stay",
          "feeType": "cleaning_fee"}],
        portale=_PORTALE,
    )
    assert "shortStayOnly" not in aus[0]


def test_fee_gueltigkeit_und_abrechnungsschalter_werden_uebernommen() -> None:
    """„Gilt ab"/„gilt bis" (Anreise) und „nur in der Eigentümer-Abrechnung":
    Anlass ist die Resort-Gebühr des Beta-Betriebs, die es erst seit dem
    01.08.2026 gibt — ohne Zeitraum trug die Abrechnung sie in 98 Buchungen
    davor nach."""
    ok = normalize_fees(
        [{"id": "f1", "name": "Resort", "amount": 25, "basis": "per_night",
          "feeType": "resort", "validFrom": "2026-08-01",
          "validUntil": "2026-12-31", "ownerStatementOnly": True}],
        portale=_PORTALE,
    )
    assert ok[0]["validFrom"] == "2026-08-01"
    assert ok[0]["validUntil"] == "2026-12-31"
    assert ok[0]["ownerStatementOnly"] is True
    # Ohne Angabe: keine Felder (kein erfundener Zeitraum, kein Schalter).
    aus = normalize_fees(
        [{"id": "f1", "name": "Resort", "amount": 25, "basis": "per_night",
          "feeType": "resort", "validFrom": "", "ownerStatementOnly": False}],
        portale=_PORTALE,
    )
    assert "validFrom" not in aus[0]
    assert "validUntil" not in aus[0]
    assert "ownerStatementOnly" not in aus[0]


def test_fee_gueltigkeit_unsinn_ist_422() -> None:
    """Unlesbares Datum oder „bis" vor „ab": Fehler, nicht stilles Verwerfen —
    sonst gälte die Gebühr unbegrenzt, obwohl eine Grenze eingetragen wurde."""
    with pytest.raises(PropertyError) as exc:
        normalize_fees(
            [{"id": "f1", "name": "Resort", "amount": 25, "basis": "per_night",
              "feeType": "resort", "validFrom": "01.08.2026"}],
            portale=_PORTALE,
        )
    assert exc.value.status_code == 422
    with pytest.raises(PropertyError) as exc:
        normalize_fees(
            [{"id": "f1", "name": "Resort", "amount": 25, "basis": "per_night",
              "feeType": "resort", "validFrom": "2026-08-01",
              "validUntil": "2026-07-31"}],
            portale=_PORTALE,
        )
    assert exc.value.status_code == 422


def test_gebuehr_gilt_am_anreise() -> None:
    """Beide Grenzen inklusiv; ohne Datum ist eine begrenzte Gebühr nicht
    beurteilbar und gilt NICHT; ohne Grenze gilt sie immer."""
    from datetime import date

    from src.features.properties.gebuehren import gebuehr_gilt_am

    fee = {"validFrom": "2026-08-01", "validUntil": "2026-08-31"}
    assert gebuehr_gilt_am(fee, date(2026, 8, 1)) is True
    assert gebuehr_gilt_am(fee, date(2026, 8, 31)) is True
    assert gebuehr_gilt_am(fee, date(2026, 7, 31)) is False
    assert gebuehr_gilt_am(fee, date(2026, 9, 1)) is False
    assert gebuehr_gilt_am(fee, None) is False
    assert gebuehr_gilt_am({}, None) is True
    assert gebuehr_gilt_am({"validFrom": "2026-08-01"}, date(2027, 1, 1)) is True


def test_fee_signatur_buendelt_dieselbe_gebuehr() -> None:
    """Dieselbe Gebühr liegt auf jedem Objekt als eigener Eintrag mit eigener
    Kennung. Die Auswahlliste soll sie EINMAL zeigen — also bündelt sie über die
    fachlichen Felder, nicht über die ID."""
    a = {"id": "a", "name": "Reinigungsgebühr", "amount": 955,
         "basis": "per_stay", "mode": "amount", "feeType": "cleaning_fee"}
    b = {**a, "id": "b"}
    assert fee_signatur(a) == fee_signatur(b)
    # Groß-/Kleinschreibung des Namens ist keine zweite Gebühr …
    assert fee_signatur({**a, "name": "REINIGUNGSGEBÜHR"}) == fee_signatur(a)
    # … ein anderer Betrag, eine andere Basis oder ein anderer Name schon.
    assert fee_signatur({**a, "amount": 956}) != fee_signatur(a)
    assert fee_signatur({**a, "basis": "per_night"}) != fee_signatur(a)
    assert fee_signatur({**a, "name": "Endreinigung"}) != fee_signatur(a)


def test_normalize_fees_haelt_gastseitige_namen_je_sprache() -> None:
    """Die Gebühr steht in der Preisaufschlüsselung des Gastes — sie braucht
    denselben mehrsprachigen Namen wie die lokale Steuer. Leere Sprach-Tabs
    fliegen raus, damit beim Portal kein „Name = leer" landet."""
    aus = normalize_fees(
        [{
            "id": "f1", "name": "Reinigungsgebühr", "amount": 955,
            "basis": "per_stay", "feeType": "cleaning_fee",
            "names": {"de": "Reinigungsgebühr", "da": " Rengøringsgebyr ", "en": "  "},
        }],
        portale=_PORTALE,
    )
    assert aus[0]["names"] == {"de": "Reinigungsgebühr", "da": "Rengøringsgebyr"}


def test_normalize_fees_ohne_namen_je_sprache_bleibt_das_feld_weg() -> None:
    """Kein leeres `names: {}` im Datensatz: ein leeres Feld liest sich wie
    „Übersetzungen gepflegt, alle leer"."""
    aus = normalize_fees(
        [{"id": "f1", "name": "Kurtaxe-Service", "amount": 5,
          "basis": "per_stay", "feeType": "cleaning_fee"}],
        portale=_PORTALE,
    )
    assert "names" not in aus[0]


def test_preise_kopieren_lehnt_abweichende_waehrung_ab() -> None:
    """Ein Betrag in DKK, in ein Objekt in EUR kopiert, ist ein anderer Preis.
    Umrechnen wäre ein erfundener Kurs (Wurzel 4) — also 422."""
    from src.features.properties.preise_kopieren import PreiseKopierenMixin

    pruef = PreiseKopierenMixin._pruefe_waehrung
    # Gleiche Währung, oder eine Seite noch ohne: erlaubt.
    pruef("DKK", "DKK")
    pruef("DKK", None)
    pruef(None, "EUR")
    pruef(None, None)
    with pytest.raises(PropertyError) as exc:
        pruef("DKK", "EUR")
    assert exc.value.status_code == 422


def test_preise_kopieren_sammelt_nur_echte_portal_scopes() -> None:
    """Geprüft werden muss nur, was ein PORTAL ist: die eigenen Strecken
    (`direct`/`portal`) sind überall erfüllbar und dürfen die Übernahme nicht
    blockieren."""
    from src.features.properties.preise_kopieren import _portal_codes

    codes = _portal_codes({
        "fees": [{"id": "f1", "portalScope": ["BookingCom", "direct"]}],
        "taxes": [{"id": "t1", "portalScope": ["AirBNB", "portal"]}, {"id": "t2"}],
    })
    assert codes == ["AirBNB", "BookingCom"]
