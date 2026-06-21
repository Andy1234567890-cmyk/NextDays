from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.channel_manager.service import ChannelManagerService
from src.main import create_app

client = TestClient(create_app())


def test_channel_manager_health() -> None:
    resp = client.get("/api/v1/channel-manager/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slice"] == "channel_manager"
    assert body["status"] == "ok"
    # Feld existiert und ist bool (Wert hängt von der Umgebung/Key-Konfig ab).
    # Neutraler Name (kein Provider-Leck im Response).
    assert isinstance(body["channel_manager_ready"], bool)


def test_webhook_rejects_wrong_secret() -> None:
    # Ohne korrektes Secret → 401 (Webhook ist nicht JWT-gesichert).
    resp = client.post(
        "/api/v1/channel-manager/webhook",
        json={"event": "booking_new"},
        headers={"X-Channex-Webhook-Secret": "falsch"},
    )
    assert resp.status_code == 401


def test_protected_endpoints_require_auth() -> None:
    # Property-Liste ohne JWT → 401.
    resp = client.get("/api/v1/channel-manager/properties")
    assert resp.status_code == 401


# --- Mandantentrennung: kontoweiter Buchungs-Feed darf NICHT durchsickern ----
class _FakeChannex:
    """Simuliert den KONTOWEITEN Channex-Feed: Buchungen mehrerer Tenants."""

    def __init__(self, revisions: list[dict]) -> None:
        self._revisions = revisions
        self.acked: list[str] = []

    def get_booking_revisions_feed(self) -> dict:
        return {"data": self._revisions}

    def ack_booking_revision(self, revision_id: str) -> dict:
        self.acked.append(revision_id)
        return {}


class _FakeQuery:
    """Mini-Query-Builder, der nur channex_property_map für EINEN Tenant kennt."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def eq(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def is_(self, *_a, **_k):  # noqa: ANN002, ANN003
        return self

    def execute(self):  # noqa: ANN201
        class _R:
            data = self._rows

        return _R()


class _FakeDB:
    """Liefert für channex_property_map nur Andys Property; speichert Buchungen."""

    def __init__(self, own_channex_property_id: str) -> None:
        self._own = own_channex_property_id
        self.saved_bookings: list[dict] = []

    def table(self, name: str):  # noqa: ANN201
        if name == "channex_property_map":
            return _FakeQuery([{"channex_property_id": self._own}])
        if name == "channex_booking":
            outer = self

            class _Upsert:
                def upsert(self, row, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
                    outer.saved_bookings.append(row)
                    return self

                def execute(self):  # noqa: ANN201
                    class _R:
                        data = []

                    return _R()

            return _Upsert()
        return _FakeQuery([])


def test_booking_feed_isolates_tenants() -> None:
    """Andys Sync zieht den kontoweiten Feed (Andy + Steffen). Steffens Buchung
    darf NICHT unter Andys tenant_id landen und NICHT ge-ackt werden."""
    andy_prop = "andy-channex-prop"
    steffen_prop = "steffen-channex-prop"
    feed = [
        {"id": "rev-andy", "attributes": {
            "property_id": andy_prop, "booking_id": "bk-andy", "status": "new"}},
        {"id": "rev-steffen", "attributes": {
            "property_id": steffen_prop, "booking_id": "bk-steffen", "status": "new"}},
    ]
    fake_channex = _FakeChannex(feed)
    fake_db = _FakeDB(own_channex_property_id=andy_prop)
    svc = ChannelManagerService(service_client=fake_db, channex=fake_channex)
    ctx = AuthContext(user_id="andy", tenant_id="tenant-andy")

    res = svc.sync_bookings(ctx)

    # Nur Andys Buchung gespeichert, Steffens übersprungen.
    assert res.fetched == 2
    assert res.saved == 1
    assert res.skipped == 1
    saved_ids = [b["channex_booking_id"] for b in fake_db.saved_bookings]
    assert saved_ids == ["bk-andy"]
    # Steffens Revision wurde NICHT ge-ackt (sein Tenant braucht sie noch).
    assert fake_channex.acked == ["rev-andy"]
