"""Tests für den whatsapp-Slice (Sandbox-Versand, Webhook, Verify)."""
import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.whatsapp.service import WhatsAppService, WhatsAppServiceError
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")


def test_whatsapp_health() -> None:
    resp = client.get("/api/v1/whatsapp/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "whatsapp", "status": "ok"}


def test_webhook_verify_rejects_wrong_token() -> None:
    resp = client.get(
        "/api/v1/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "falsch", "hub.challenge": "123"},
    )
    assert resp.status_code == 403


# --- Fake-DB (Insert/Update/Select) -----------------------------------------
class _Res:
    def __init__(self, data) -> None:  # noqa: ANN001
        self.data = data


class _Q:
    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._payload = None
        self._op = "select"

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        return self

    def eq(self, c, v):  # noqa: ANN001, ANN201
        self._eq[c] = v
        return self

    def is_(self, c, _v):  # noqa: ANN001, ANN201
        # nur 'null'-Filter relevant; Resolver nutzt es nicht, no-op reicht.
        return self

    def order(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def range(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        rows = self._store.setdefault(self._name, [])
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(rows) + 1}")
            row.setdefault("created_at", "2026-06-22T00:00:00Z")
            rows.append(row)
            return _Res([row])
        match = [r for r in rows if all(r.get(k) == v for k, v in self._eq.items())]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            return _Res(match)
        if self._op == "upsert":
            payload = dict(self._payload)
            existing = [
                r for r in rows
                if all(r.get(k) == payload.get(k) for k in ("tenant_id", "channel", "external_id"))
            ]
            if existing:
                existing[0].update(payload)
                return _Res([existing[0]])
            payload.setdefault("id", f"{self._name}-{len(rows) + 1}")
            rows.append(payload)
            return _Res([payload])
        return _Res(match)


class _DB:
    def __init__(self) -> None:
        self.store: dict = {}

    def table(self, name):  # noqa: ANN001, ANN201
        return _Q(self.store, name)


class _FakeClient:
    is_configured = True

    def __init__(self) -> None:
        self.sent: list = []

    def send_text(self, to, body):  # noqa: ANN001, ANN201
        self.sent.append((to, body))
        return {"messages": [{"id": "wamid.123"}]}


def test_send_sandbox_stores_outgoing(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(WhatsAppService, "_sandbox", staticmethod(lambda: True))
    db = _DB()
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    msg = svc.send(_CTX, conversation_id=None, to_phone="+49 170 1234567", body="Hallo")
    assert msg.direction == "out" and msg.body == "Hallo"
    # Konversation + Nachricht wurden angelegt.
    assert len(db.store["whatsapp_conversation"]) == 1
    assert db.store["whatsapp_conversation"][0]["wa_phone"] == "491701234567"
    assert len(db.store["whatsapp_message"]) == 1


def test_send_rejects_empty() -> None:
    svc = WhatsAppService(service_client=_DB(), client=_FakeClient())
    with pytest.raises(WhatsAppServiceError) as exc:
        svc.send(_CTX, conversation_id=None, to_phone="+49170", body="   ")
    assert exc.value.status_code == 422


def test_ingest_webhook_creates_incoming(monkeypatch) -> None:  # noqa: ANN001
    # Default-Tenant für neue Nummer setzen (sonst verworfen — kein Raten).
    from src.core import config

    monkeypatch.setattr(
        config.get_settings(), "whatsapp_default_tenant_id", "t1", raising=False
    )
    db = _DB()
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": "491701234567", "profile": {"name": "Anna"}}],
                            "messages": [
                                {"from": "491701234567", "id": "wamid.in1",
                                 "text": {"body": "Hi"}}
                            ],
                        }
                    }
                ]
            }
        ]
    }
    out = svc.ingest_webhook(payload)
    assert out["received"] == 1
    assert db.store["whatsapp_message"][0]["direction"] == "in"
    conv = db.store["whatsapp_conversation"][0]
    assert conv["guest_name"] == "Anna"
    # Resolver-Verknüpfung: Konversation trägt einen Gast, Gast wurde angelegt.
    assert conv["guest_id"] is not None
    guest = next(g for g in db.store["guests"] if g["id"] == conv["guest_id"])
    assert guest["phone"] == "+491701234567"  # E.164-normalisiert
    # Kanal-ID (WhatsApp-Nummer) ist verknüpft.
    assert any(
        x["channel"] == "whatsapp" and x["external_id"] == "491701234567"
        for x in db.store["guest_external_ids"]
    )


# --- Webhook-Signaturpflicht (Prod-Fehlkonfiguration darf nicht offen sein) ---

def test_webhook_prod_without_secret_returns_503(monkeypatch) -> None:  # noqa: ANN001
    """Ohne WHATSAPP_APP_SECRET UND nicht-lokal → 503 (kein stiller Injektions-
    pfad), NICHT stilles Verarbeiten."""
    from src.features.whatsapp import router as wa_router

    fake = type("S", (), {})()
    fake.whatsapp_app_secret = type("Sec", (), {"get_secret_value": lambda self: ""})()
    fake.is_local = False
    monkeypatch.setattr(wa_router, "get_settings", lambda: fake)

    resp = client.post("/api/v1/whatsapp/webhook", content=b'{"entry": []}')
    assert resp.status_code == 503


def test_webhook_local_without_secret_processes(monkeypatch) -> None:  # noqa: ANN001
    """Lokal ohne Secret → Prüfung übersprungen, Body wird verarbeitet (Dev-DX)."""
    from src.features.whatsapp import router as wa_router

    fake = type("S", (), {})()
    fake.whatsapp_app_secret = type("Sec", (), {"get_secret_value": lambda self: ""})()
    fake.is_local = True
    monkeypatch.setattr(wa_router, "get_settings", lambda: fake)

    resp = client.post("/api/v1/whatsapp/webhook", content=b'{"entry": []}')
    assert resp.status_code == 200


def test_webhook_with_secret_rejects_bad_signature(monkeypatch) -> None:  # noqa: ANN001
    """Mit Secret → falsche/fehlende Signatur → 403."""
    from src.features.whatsapp import router as wa_router

    fake = type("S", (), {})()
    fake.whatsapp_app_secret = type(
        "Sec", (), {"get_secret_value": lambda self: "geheim"}
    )()
    fake.is_local = False
    monkeypatch.setattr(wa_router, "get_settings", lambda: fake)

    resp = client.post(
        "/api/v1/whatsapp/webhook", content=b'{"entry": []}',
        headers={"X-Hub-Signature-256": "sha256=deadbeef"},
    )
    assert resp.status_code == 403
