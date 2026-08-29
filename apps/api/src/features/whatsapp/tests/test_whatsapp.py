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


def _patch_verify_token(monkeypatch, token: str) -> None:  # noqa: ANN001
    """whatsapp_verify_token für den Verify-Handshake setzen."""
    from src.features.whatsapp import router as wa_router

    fake = type("S", (), {})()
    fake.whatsapp_verify_token = type(
        "Sec", (), {"get_secret_value": lambda self: token}
    )()
    monkeypatch.setattr(wa_router, "get_settings", lambda: fake)


def test_webhook_verify_rejects_wrong_token(monkeypatch) -> None:  # noqa: ANN001
    _patch_verify_token(monkeypatch, "richtig")
    resp = client.get(
        "/api/v1/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "falsch", "hub.challenge": "123"},
    )
    assert resp.status_code == 403


def test_webhook_verify_accepts_correct_token(monkeypatch) -> None:  # noqa: ANN001
    """Korrekter Token → 200 + Challenge (konstant-zeitiger Vergleich)."""
    _patch_verify_token(monkeypatch, "richtig")
    resp = client.get(
        "/api/v1/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "richtig", "hub.challenge": "xyz"},
    )
    assert resp.status_code == 200
    assert resp.text == "xyz"


def test_webhook_verify_rejects_empty_token(monkeypatch) -> None:  # noqa: ANN001
    """Leerer/fehlender Request-Token wird abgelehnt, auch bei leerem Erwartungswert."""
    _patch_verify_token(monkeypatch, "")
    resp = client.get(
        "/api/v1/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "123"},
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


def test_webhook_ordnet_ueber_empfangende_nummer_zu() -> None:
    """Zwei Betriebe, derselbe Gast: die Nachricht muss an den Betrieb gehen,
    dessen NUMMER sie empfangen hat — nicht an den erstgefundenen mit dieser
    Gast-Nummer."""
    db = _DB()
    db.store["whatsapp_account"] = [
        {"tenant_id": "t-a", "waba_id": "waba-a", "phone_number_id": "num-a"},
        {"tenant_id": "t-b", "waba_id": "waba-b", "phone_number_id": "num-b"},
    ]
    db.store["whatsapp_conversation"] = [
        {
            "id": "conv-a",
            "tenant_id": "t-a",
            "wa_phone": "491701234567",
            "guest_name": None,
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    svc.ingest_webhook(
        {
            "entry": [
                {
                    "id": "waba-b",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "metadata": {"phone_number_id": "num-b"},
                                "messages": [
                                    {
                                        "from": "491701234567",
                                        "id": "wamid.neu",
                                        "type": "text",
                                        "text": {"body": "Hallo B"},
                                    }
                                ],
                            },
                        }
                    ],
                }
            ]
        }
    )
    nachrichten = db.store["whatsapp_message"]
    assert len(nachrichten) == 1
    # Entscheidend: Betrieb B, obwohl der Gast bei A bereits eine Konversation hat.
    assert nachrichten[0]["tenant_id"] == "t-b"


def test_ingest_webhook_creates_incoming(monkeypatch) -> None:  # noqa: ANN001
    # Default-Tenant für neue Nummer setzen (sonst verworfen — kein Raten).
    from src.core import config

    monkeypatch.setattr(
        config.get_settings(), "whatsapp_default_tenant_id", "t1", raising=False
    )
    db = _DB()
    # Den Default-Betrieb muss es geben — der Service prüft das, seit ein
    # Default auf einen gelöschten Betrieb zeigte und jede Gastnachricht am
    # Fremdschlüssel scheiterte (siehe test_ingest_webhook_default_tenant_weg).
    db.store["tenants"] = [{"id": "t1"}]
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


def test_ingest_webhook_default_tenant_weg(monkeypatch) -> None:  # noqa: ANN001
    """Zeigt WHATSAPP_DEFAULT_TENANT_ID ins Leere, wird verworfen statt zu werfen.

    Live am 29.08.2026: die Variable trug die ID eines Betriebs, den es nicht
    gab. Der Insert brach am Fremdschlüssel, der Webhook antwortete 500, Meta
    wiederholte vier Mal — und jede eingehende Gastnachricht war verloren, ohne
    dass irgendwo etwas rot wurde.
    """
    from src.core import config

    monkeypatch.setattr(
        config.get_settings(), "whatsapp_default_tenant_id", "gibt-es-nicht",
        raising=False,
    )
    db = _DB()
    db.store["tenants"] = [{"id": "t1"}]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    out = svc.ingest_webhook(
        {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messages": [
                                    {"from": "491701234567", "id": "wamid.x",
                                     "text": {"body": "Hi"}}
                                ]
                            }
                        }
                    ]
                }
            ]
        }
    )
    assert out["received"] == 0
    assert not db.store.get("whatsapp_message")


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


def test_client_fuer_nutzt_die_nummer_des_betriebs() -> None:
    """Gesendet wird über die EIGENE Nummer des Betriebs, nie über die zentrale.

    Vor dieser Änderung lief jeder Versand über den global konfigurierten
    Client aus der .env. Beim ersten Kunden mit eigener Nummer wäre der Gast
    von einer fremden Nummer angeschrieben worden — und die Nachricht auf
    fremde Rechnung gegangen, ohne dass ein Aufruf fehlschlägt.
    """
    db = _DB()
    db.store["whatsapp_account"] = [
        {
            "tenant_id": "t1",
            "access_token": "token-des-betriebs",
            "phone_number_id": "nummer-des-betriebs",
            "waba_id": "waba-des-betriebs",
            "status": "connected",
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    client = svc._client_fuer(db, "t1")  # noqa: SLF001 — genau das ist der Test
    assert client._phone_number_id == "nummer-des-betriebs"  # noqa: SLF001
    assert client._waba_id == "waba-des-betriebs"  # noqa: SLF001


def test_client_fuer_ohne_konto_ist_ein_fehler(monkeypatch) -> None:  # noqa: ANN001
    """Kein verbundenes Konto → 409, KEIN stiller Versand über die zentrale Nummer."""
    from src.core import config

    monkeypatch.setattr(
        config.get_settings(), "whatsapp_default_tenant_id", "", raising=False
    )
    svc = WhatsAppService(service_client=_DB(), client=_FakeClient())
    with pytest.raises(WhatsAppServiceError) as exc:
        svc._client_fuer(svc._db, "t-ohne-konto")  # noqa: SLF001
    assert exc.value.status_code == 409


def test_client_fuer_getrenntes_konto_sendet_nicht() -> None:
    """Getrennte Nummer → 409 statt Versand mit einem toten Token."""
    db = _DB()
    db.store["whatsapp_account"] = [
        {
            "tenant_id": "t1",
            "access_token": "alt",
            "phone_number_id": "n1",
            "waba_id": "w1",
            "status": "disconnected",
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    with pytest.raises(WhatsAppServiceError) as exc:
        svc._client_fuer(db, "t1")  # noqa: SLF001
    assert exc.value.status_code == 409


def test_vorlagentext_metas_regeln() -> None:
    """Die zwei Regeln, an denen Meta beim ersten Rollout sechs Vorlagen ablehnte.

    Sie stehen in keiner Fehlermeldung der API, sondern erst Tage spaeter in der
    Ablehnung. Deshalb pruefen wir sie dort, wo der Text entsteht.
    """
    pruefe = WhatsAppService._pruefe_vorlagentext  # noqa: SLF001

    # Variable am Anfang und am Ende: beides verboten.
    assert pruefe("{{1}} guten Tag.", ["Anna"])
    assert pruefe("Guten Tag {{1}}", ["Anna"])
    # Nummerierung muss lueckenlos bei 1 beginnen.
    assert pruefe("Hallo {{2}}, bis bald.", ["Anna"])
    # Zu jedem Platzhalter ein Beispielwert.
    assert pruefe("Hallo {{1}}, Ihr Zimmer {{2}} ist bereit.", ["Anna"])
    # Leerer Text ist kein gueltiger Vorlagentext.
    assert pruefe("   ", [])
    # Sauberer Text mit passenden Beispielen: keine Beanstandung.
    assert not pruefe(
        "Hallo {{1}}, Ihr Zimmer {{2}} ist ab 15 Uhr bereit.", ["Anna", "12"]
    )
    # Ganz ohne Platzhalter braucht es keine Beispiele.
    assert not pruefe("Ihre Buchung ist bestaetigt.", [])
