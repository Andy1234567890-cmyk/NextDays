"""Tests für den whatsapp-Slice (Sandbox-Versand, Webhook, Verify)."""
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.whatsapp import client as wa_client_modul
from src.features.whatsapp.client import (
    WhatsAppClient,
    WhatsAppError,
    WhatsAppRateLimitError,
)
from src.features.whatsapp.fehler import WhatsAppServiceError
from src.features.whatsapp.ratelimit import ist_drosselung, nutzung_lesen
from src.features.whatsapp.service import WhatsAppService
from src.features.whatsapp.templates import rollout
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")


@pytest.fixture(autouse=True)
def _vorlagen_cache_leeren():  # noqa: ANN202
    """Der Vorlagen-Zwischenstand ist MODUL-State und ueberlebt sonst den Test.

    Ohne diese Fixture haengen die Cache-Tests an ihrer Reihenfolge: wer den
    Schluessel eines anderen Tests vorbelegt, macht dessen Netzaufruf-Zaehlung
    falsch. Strukturelle Isolation statt Disziplin an sechs Stellen.
    """
    wa_client_modul._VORLAGEN_CACHE.clear()  # noqa: SLF001
    yield
    wa_client_modul._VORLAGEN_CACHE.clear()  # noqa: SLF001


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
        self._in: dict = {}
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

    def in_(self, c, werte):  # noqa: ANN001, ANN201
        self._in[c] = list(werte)
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
        match = [
            r
            for r in rows
            if all(r.get(k) == v for k, v in self._eq.items())
            and all(r.get(k) in v for k, v in self._in.items())
        ]
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

    assert pruefe("{{guest_first_name}}, guten Tag.")
    assert pruefe("Guten Tag {{guest_first_name}}")
    assert pruefe("   ")
    assert not pruefe("Hallo {{guest_first_name}}, Ihr Zimmer ist bereit.")
    assert not pruefe("Ihre Buchung ist bestaetigt.")


def test_platzhalter_nur_aus_dem_katalog() -> None:
    """Nur die benannten Felder des Katalogs sind erlaubt.

    Ein erfundener Platzhalter wuerde bei Meta als Text durchgehen und beim Gast
    woertlich ankommen — deshalb faellt er hier auf, solange der Autor noch
    davorsitzt.
    """
    from src.features.whatsapp.vorlagen_felder import (
        VorlagenFeldFehler,
        nach_katalog,
        nach_meta,
    )

    text = (
        "Hallo {{guest_first_name}}, Ihr Aufenthalt in {{property_name}} "
        "ist bestaetigt."
    )
    meta_text, reihenfolge, beispiele = nach_meta(text)
    assert meta_text == "Hallo {{1}}, Ihr Aufenthalt in {{2}} ist bestaetigt."
    assert reihenfolge == ["guest_first_name", "property_name"]
    assert len(beispiele) == 2
    # Der Rueckweg stellt genau den Text des Betriebs wieder her.
    assert nach_katalog(meta_text, reihenfolge) == text

    with pytest.raises(VorlagenFeldFehler):
        nach_meta("Hallo {{gibt_es_nicht}}, bis bald.")


def test_platzhalter_doppelt_teilt_sich_die_position() -> None:
    """Zweimal dasselbe Feld = EIN Parameter. Meta zaehlt Parameter, nicht
    Vorkommen; ein zweiter waere nur eine weitere Stelle zum Auseinanderlaufen."""
    from src.features.whatsapp.vorlagen_felder import nach_meta

    meta_text, reihenfolge, beispiele = nach_meta(
        "Hallo {{guest_first_name}}, bis bald {{guest_first_name}}!"
    )
    assert meta_text == "Hallo {{1}}, bis bald {{1}}!"
    assert reihenfolge == ["guest_first_name"]
    assert len(beispiele) == 1


def test_eingang_setzt_last_at_aus_metas_zeitstempel(monkeypatch) -> None:  # noqa: ANN001
    """Ohne last_at rutscht die Konversation im Posteingang ans Ende.

    Live gesehen am 29.08.2026: gerade geschrieben, trotzdem unsichtbar — die
    Liste sortiert nach letzter Aktivitaet, und null steht hinten. Der Zeitpunkt
    kommt aus METAS timestamp, nicht aus unserer Uhr (Wurzel 5b).
    """
    from src.core import config

    monkeypatch.setattr(
        config.get_settings(), "whatsapp_default_tenant_id", "t1", raising=False
    )
    db = _DB()
    db.store["tenants"] = [{"id": "t1"}]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    svc.ingest_webhook(
        {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messages": [
                                    {
                                        "from": "491701234567",
                                        "id": "wamid.zeit",
                                        "timestamp": "1756480000",
                                        "text": {"body": "Hallo"},
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }
    )
    conv = db.store["whatsapp_conversation"][0]
    # Genau Metas Zeitpunkt, nicht der von jetzt: 1756480000 = 29.08.2025.
    assert conv["last_at"].startswith("2025-08-29"), conv["last_at"]


def test_platzhalter_ohne_reservierung_wird_abgelehnt() -> None:
    """Ein Vorlagentext mit Platzhaltern darf nicht roh beim Gast landen.

    Haengt am Chat keine Reservierung, gibt es nichts, woraus sich
    {{guest_name}} fuellen liesse — dann 422 mit Nennung der Felder, statt die
    Klammern zu verschicken (Wurzel 4).
    """
    db = _DB()
    db.store["whatsapp_conversation"] = [
        {
            "id": "c1",
            "tenant_id": "t1",
            "wa_phone": "491701234567",
            "reservation_id": None,
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    with pytest.raises(WhatsAppServiceError) as exc:
        svc._platzhalter_fuellen(  # noqa: SLF001
            db, "t1", db.store["whatsapp_conversation"][0], "Hallo {{guest_name}}!"
        )
    assert exc.value.status_code == 422
    assert "guest_name" in exc.value.message


def test_text_ohne_platzhalter_bleibt_unveraendert() -> None:
    """Kein Platzhalter, keine Reservierung noetig — der Normalfall im Chat."""
    db = _DB()
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    text = "Guten Tag, wir melden uns morgen."
    assert svc._platzhalter_fuellen(db, "t1", {}, text) == text  # noqa: SLF001


def test_ki_reservierung_ohne_buchung_bleibt_leer() -> None:
    """Haengt keine Reservierung am Chat, bekommt das Modell keinen Kontext.

    Das ist richtig so: es fragt dann nach, statt sich eine Buchung
    auszudenken. Der Gastname aus der Konversation darf aber mit.
    """
    db = _DB()
    detail, objekt = WhatsAppService._ki_reservierung(  # noqa: SLF001
        db, "t1", {"reservation_id": None, "guest_name": "Anna"}
    )
    assert detail.guest_name == "Anna"
    assert detail.listing_name is None
    assert objekt is None


# --- Gastname und Bild in der Konversationsliste (29.08.2026) ----------------
#
# Die Liste zeigte fuer WhatsApp die Rohnummer statt eines Namens. Live waren
# ALLE VIER Konversationen ohne `guest_name`, zwei davon mit einem verknuepften
# Gast, der sehr wohl einen Namen hatte. Drei Fehler, drei Tests.


def _db_mit_konversation(**felder):  # noqa: ANN003, ANN201
    """Fake-DB mit einer WhatsApp-Konversation."""
    db = _DB()
    db.store["whatsapp_conversation"] = [
        {
            "id": "c1",
            "tenant_id": "t1",
            "wa_phone": "4915251939026",
            "guest_name": None,
            "guest_id": None,
            "reservation_id": None,
            "last_message": "Hallo",
            "last_at": "2026-08-29T10:00:00Z",
            "is_read": True,
            **felder,
        }
    ]
    return db


def test_name_kommt_vom_verknuepften_gast() -> None:
    """DER Live-Fall: `guest_name` leer, aber der Gast aus der Buchung hat
    einen Namen. Bis hierher zeigte die Liste trotzdem die Rohnummer.

    Erwartet wird "Hanna", nicht "Hanna Schaub": der Name laeuft durch die
    zentrale Gast-Maske (Daten-Split §4). Ohne VIEW_GUEST_NAME sieht der
    Nutzer nur den Vornamen — dieselbe Regel wie in inbox/reservations, und
    sie gilt fuer diesen Weg genauso."""
    db = _db_mit_konversation(guest_id="g1")
    db.store["guests"] = [
        {
            "id": "g1",
            "tenant_id": "t1",
            "first_name": "Hanna",
            "last_name": "Schaub",
            "avatar_url": None,
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    items = svc.list_conversations(_CTX).items
    assert items[0].guest_name == "Hanna"


def test_whatsapp_profilname_schlaegt_den_buchungsnamen() -> None:
    """Wie der Gast sich SELBST nennt, gewinnt gegen den Buchungsnamen — er
    ist naeher daran, wie er angesprochen werden will."""
    db = _db_mit_konversation(guest_name="Hanni", guest_id="g1")
    db.store["guests"] = [
        {
            "id": "g1",
            "tenant_id": "t1",
            "first_name": "Hanna",
            "last_name": "Schaub",
            "avatar_url": None,
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    assert svc.list_conversations(_CTX).items[0].guest_name == "Hanni"


def test_bild_kommt_vom_verknuepften_gast() -> None:
    """WhatsApp liefert kein Profilbild (die Cloud API gibt es nicht heraus).
    Was wir zeigen koennen, ist das Bild des Gastes aus der Buchung."""
    db = _db_mit_konversation(guest_id="g1")
    db.store["guests"] = [
        {
            "id": "g1",
            "tenant_id": "t1",
            "first_name": "Hanna",
            "last_name": "Schaub",
            "avatar_url": "https://example.test/h.jpg",
        }
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    items = svc.list_conversations(_CTX).items
    assert items[0].guest_avatar_url == "https://example.test/h.jpg"


def test_namenloser_gast_gibt_keinen_leeren_namen() -> None:
    """Ein Gast ohne Namen darf keinen leeren String liefern: die Oberflaeche
    prueft auf None und faellt sonst auf die Nummer zurueck. '' waere ein
    Name, der keiner ist (Wurzel 4)."""
    db = _db_mit_konversation(guest_id="g1")
    db.store["guests"] = [
        {"id": "g1", "tenant_id": "t1", "first_name": None,
         "last_name": None, "avatar_url": None}
    ]
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    assert svc.list_conversations(_CTX).items[0].guest_name is None


def test_ohne_gast_bleibt_alles_leer() -> None:
    """Keine Verknuepfung, kein Profilname: nichts erfinden."""
    svc = WhatsAppService(service_client=_db_mit_konversation(), client=_FakeClient())
    item = svc.list_conversations(_CTX).items[0]
    assert item.guest_name is None
    assert item.guest_avatar_url is None


def test_name_wird_bei_bestehender_konversation_nachgetragen() -> None:
    """Der zweite Fehler: `guest_name` wurde NUR beim Anlegen geschrieben.

    Entstand die Konversation aus einer AUSGEHENDEN Nachricht — dort schickt
    Meta keine `contacts` mit —, blieb das Feld leer, und kein spaeterer
    Webhook hat es je nachgetragen. Live waren so alle vier Konversationen
    ohne Namen.
    """
    db = _db_mit_konversation()
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    conv = svc._upsert_conversation(  # noqa: SLF001
        db, "t1", "4915251939026", guest_name="Christophe"
    )
    assert conv["guest_name"] == "Christophe"
    assert db.store["whatsapp_conversation"][0]["guest_name"] == "Christophe"


def test_leerer_profilname_ueberschreibt_keinen_vorhandenen() -> None:
    """Wurzel 1 — der Gegenzustand ist hier der schon bekannte Name: ein
    Webhook OHNE `contacts` darf ihn nicht loeschen."""
    db = _db_mit_konversation(guest_name="Christophe")
    svc = WhatsAppService(service_client=db, client=_FakeClient())
    conv = svc._upsert_conversation(db, "t1", "4915251939026", guest_name=None)  # noqa: SLF001
    assert conv["guest_name"] == "Christophe"


# =========================================================================
# Ratenbegrenzungen (Meta Graph API)
#
# Meta drosselt die WhatsApp Business Management API bei 200 Aufrufen pro
# Stunde je App und WABA (5000 bei aktiver WABA mit registrierter Nummer).
# Vorher lief jeder dieser Aufrufe ungezaehlt, und eine Drosselung war von
# einem abgelehnten Vorlagentext nicht zu unterscheiden — beides kam als 502.
# =========================================================================
def test_nutzung_liest_den_app_header() -> None:
    stand = nutzung_lesen(
        {"x-app-usage": '{"call_count":28,"total_time":25,"total_cputime":25}'}
    )
    assert stand is not None
    assert stand.call_count == 28
    assert stand.hoechstwert == 28
    assert not stand.kritisch


def test_nutzung_buc_schlaegt_app_header() -> None:
    """Metas Doku: bei Ueberschneidung gilt die BUC-Grenze, nicht die Plattform."""
    stand = nutzung_lesen(
        {
            "x-app-usage": '{"call_count":10}',
            "x-business-use-case-usage": (
                '{"123":[{"type":"whatsapp","call_count":95,'
                '"estimated_time_to_regain_access":19}]}'
            ),
        }
    )
    assert stand is not None
    assert stand.call_count == 95
    assert stand.estimated_time_to_regain_access == 19
    assert stand.kritisch


def test_nutzung_nimmt_den_kritischsten_wert() -> None:
    """Meta drosselt, sobald EINER der drei Werte 100 erreicht — nicht ihr Mittel."""
    stand = nutzung_lesen(
        {"x-app-usage": '{"call_count":5,"total_time":97,"total_cputime":3}'}
    )
    assert stand is not None
    assert stand.hoechstwert == 97
    assert stand.kritisch


def test_nutzung_ohne_header_ist_none() -> None:
    """Fehlende Header sind der Normalfall, kein Fehler — und keine 0 Prozent."""
    assert nutzung_lesen({}) is None


def test_nutzung_bei_kaputtem_header_ist_none() -> None:
    """Ein unlesbarer Header darf einen erfolgreichen Aufruf nicht kippen."""
    assert nutzung_lesen({"x-app-usage": "kein json"}) is None
    assert nutzung_lesen({"x-business-use-case-usage": "{{"}) is None


def test_drosselcodes_werden_erkannt() -> None:
    assert ist_drosselung(80008)  # WhatsApp Business Management API
    assert ist_drosselung(4)  # App-Ratenbegrenzung
    assert ist_drosselung(17)  # Nutzer-Ratenbegrenzung
    assert ist_drosselung(32)  # Seiten-Ratenbegrenzung
    assert ist_drosselung(613)  # selbstdefinierte Begrenzung
    assert ist_drosselung(131056)  # Cloud API: Paarlimit
    assert ist_drosselung(17, 2446079)  # Ads-API-Unterkode


def test_kein_drosselcode_bei_fachlichem_fehler() -> None:
    """Der wichtigste Fall: eine abgelehnte Vorlage ist KEINE Drosselung.

    Wuerde sie als solche gelten, bekaeme der Betrieb „bitte warten" zu sehen
    und wartete auf etwas, das von allein nie besser wird.
    """
    assert not ist_drosselung(132000)  # Vorlagentext abgelehnt
    assert not ist_drosselung(100)  # ungueltiger Parameter
    assert not ist_drosselung(None)
    assert not ist_drosselung("nonsense")


class _FakeResponse:
    """Minimale httpx-Antwort fuer den Client-Pfad."""

    def __init__(
        self,
        status_code: int = 200,
        payload: dict | None = None,
        headers: dict | None = None,
    ) -> None:
        self.status_code = status_code
        self._payload = payload if payload is not None else {"data": []}
        self.headers = headers or {}
        self.text = str(self._payload)

    def json(self) -> dict:
        return self._payload


def _client_mit_antwort(monkeypatch, antwort: _FakeResponse) -> WhatsAppClient:  # noqa: ANN001
    client = WhatsAppClient(
        access_token="t", phone_number_id="p", waba_id="w", graph_version="v25.0"
    )
    monkeypatch.setattr(
        wa_client_modul.httpx, "request", lambda *a, **k: antwort  # noqa: ARG005
    )
    return client


def test_drosselung_wird_zu_429_mit_wartezeit(monkeypatch) -> None:  # noqa: ANN001
    """Metas Code 80008 muss als eigener Fehler ankommen, nicht als 502.

    Sonst kann der Aufrufer nicht unterscheiden, ob Warten hilft.
    """
    antwort = _FakeResponse(
        status_code=400,
        payload={
            "error": {
                "message": "There have been too many calls.",
                "code": 80008,
            }
        },
        headers={
            "x-business-use-case-usage": (
                '{"1":[{"type":"whatsapp","call_count":100,'
                '"estimated_time_to_regain_access":19}]}'
            )
        },
    )
    client = _client_mit_antwort(monkeypatch, antwort)
    with pytest.raises(WhatsAppRateLimitError) as fehler:
        client.list_templates(frisch=True)
    assert fehler.value.status_code == 429
    assert fehler.value.meta_code == 80008
    assert fehler.value.sperrdauer_min == 19
    assert "19 Minuten" in fehler.value.message


def test_fachlicher_fehler_bleibt_502(monkeypatch) -> None:  # noqa: ANN001
    """Gegenprobe: ein abgelehnter Vorlagentext ist keine Drosselung."""
    antwort = _FakeResponse(
        status_code=400,
        payload={"error": {"message": "Template abgelehnt.", "code": 132000}},
    )
    client = _client_mit_antwort(monkeypatch, antwort)
    with pytest.raises(WhatsAppError) as fehler:
        client.list_templates(frisch=True)
    assert not isinstance(fehler.value, WhatsAppRateLimitError)
    assert fehler.value.status_code == 502


def test_vorlagen_cache_spart_den_zweiten_aufruf(monkeypatch) -> None:  # noqa: ANN001
    """Der Grund fuer den Cache: diese Liste haengt an jedem Menue-Oeffnen."""
    aufrufe: list[str] = []

    def _zaehlend(*_a, **_k) -> _FakeResponse:  # noqa: ANN002, ANN003
        aufrufe.append("x")
        return _FakeResponse(payload={"data": [{"name": "a", "language": "de"}]})

    client = WhatsAppClient(
        access_token="t", phone_number_id="p", waba_id="cache_test_waba"
    )
    monkeypatch.setattr(wa_client_modul.httpx, "request", _zaehlend)
    assert len(client.list_templates()) == 1
    assert len(client.list_templates()) == 1
    assert len(aufrufe) == 1, "zweiter Aufruf haette aus dem Zwischenstand kommen muessen"

    # `frisch=True` muss ihn umgehen — sonst saehe niemand seine eigene Aenderung.
    client.list_templates(frisch=True)
    assert len(aufrufe) == 2

def test_cache_gibt_eine_kopie_heraus(monkeypatch) -> None:  # noqa: ANN001
    """Der Aufrufer schreibt Metas {{1}} in die Komponenten zurueck.

    Ohne Kopie landet diese Umschrift im Zwischenstand und der zweite Leser
    bekaeme bereits umgeschriebenen Text zum zweiten Mal umgeschrieben.
    """
    monkeypatch.setattr(
        wa_client_modul.httpx,
        "request",
        lambda *a, **k: _FakeResponse(  # noqa: ARG005
            payload={"data": [{"name": "a", "components": [{"text": "original"}]}]}
        ),
    )
    client = WhatsAppClient(
        access_token="t", phone_number_id="p", waba_id="kopie_test_waba"
    )
    erste = client.list_templates()
    erste[0]["components"][0]["text"] = "veraendert"
    zweite = client.list_templates()
    assert zweite[0]["components"][0]["text"] == "original"

def test_schreiben_verwirft_den_zwischenstand(monkeypatch) -> None:  # noqa: ANN001
    """Wurzel 1: der Cache ist der Gegenzustand jeder Schreiboperation."""
    aufrufe: list[str] = []

    def _zaehlend(method: str, *_a, **_k) -> _FakeResponse:  # noqa: ANN002, ANN003
        aufrufe.append(method)
        return _FakeResponse(payload={"data": [{"name": "a"}]})

    client = WhatsAppClient(
        access_token="t", phone_number_id="p", waba_id="verwerf_test_waba"
    )
    monkeypatch.setattr(wa_client_modul.httpx, "request", _zaehlend)
    client.list_templates()
    client.create_template({"name": "neu"})
    client.list_templates()
    # GET, POST, GET — der zweite GET darf NICHT aus dem Zwischenstand kommen.
    assert aufrufe.count("GET") == 2

# =========================================================================
# Sendezustand auffrischen (quality_rating / messaging_limit_tier)
#
# Beide standen bisher so in der Zeile, wie sie beim Verbinden waren, und
# blieben dort. Ein Betrieb, den Meta spaeter heruntergestuft hat, sah
# weiterhin den Zustand vom ersten Tag — plausibel und falsch.
# =========================================================================
class _NummernClient(_FakeClient):
    """Client, der Metas `phone_numbers` beantwortet und die Aufrufe zaehlt."""

    token_fuer_abfrage = "t"

    def __init__(self, tier: str = "TIER_1K", quality: str = "GREEN") -> None:
        super().__init__()
        self.abrufe = 0
        self._tier = tier
        self._quality = quality

    def phone_numbers(self, _waba_id, *, token):  # noqa: ANN001, ANN201, ARG002
        self.abrufe += 1
        return [
            {
                "id": "p1",
                "quality_rating": self._quality,
                "messaging_limit_tier": self._tier,
            }
        ]


def _db_mit_konto(**felder) -> _DB:  # noqa: ANN003
    db = _DB()
    db.store["whatsapp_account"] = [
        {
            "tenant_id": "t1",
            "waba_id": "w1",
            "phone_number_id": "p1",
            "status": "connected",
            "quality_rating": "GREEN",
            "messaging_limit_tier": "TIER_250",
            **felder,
        }
    ]
    return db


def _ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="t1", role="admin")


def test_zustand_wird_bei_meta_nachgezogen(monkeypatch) -> None:  # noqa: ANN001
    """Metas Wert gewinnt gegen den gespeicherten Stand von damals."""
    db = _db_mit_konto()
    client = _NummernClient(tier="TIER_10K", quality="YELLOW")
    svc = WhatsAppService(service_client=db, client=client)
    monkeypatch.setattr(
        WhatsAppService, "_client_fuer", lambda *_a, **_k: client  # noqa: ARG005
    )

    status = svc.onboarding_status(_ctx())
    assert status.messaging_limit_tier == "TIER_10K"
    assert status.quality_rating == "YELLOW"
    # Und in der DB gelandet, damit der naechste Leser ihn ohne Aufruf hat.
    assert db.store["whatsapp_account"][0]["messaging_limit_tier"] == "TIER_10K"
    assert db.store["whatsapp_account"][0]["zustand_geprueft_at"]


def test_frischer_zustand_fragt_meta_nicht(monkeypatch) -> None:  # noqa: ANN001
    """Der Grund fuer die TTL: 200 Aufrufe je Stunde und WABA sind schnell weg,
    wenn jeder Seitenaufruf einen verbraucht."""
    db = _db_mit_konto(zustand_geprueft_at=datetime.now(UTC).isoformat())
    client = _NummernClient()
    svc = WhatsAppService(service_client=db, client=client)
    monkeypatch.setattr(
        WhatsAppService, "_client_fuer", lambda *_a, **_k: client  # noqa: ARG005
    )

    svc.onboarding_status(_ctx())
    assert client.abrufe == 0


def test_veralteter_zustand_fragt_meta(monkeypatch) -> None:  # noqa: ANN001
    db = _db_mit_konto(
        zustand_geprueft_at=(datetime.now(UTC) - timedelta(hours=2)).isoformat()
    )
    client = _NummernClient()
    svc = WhatsAppService(service_client=db, client=client)
    monkeypatch.setattr(
        WhatsAppService, "_client_fuer", lambda *_a, **_k: client  # noqa: ARG005
    )

    svc.onboarding_status(_ctx())
    assert client.abrufe == 1


def test_drosselung_kippt_die_statusseite_nicht(monkeypatch) -> None:  # noqa: ANN001
    """Wurzel 5: der Zustand ist eine Anzeige, kein Sendepfad.

    Ist Meta gerade gedrosselt, muss der Kanal-Status trotzdem herauskommen —
    mit dem gespeicherten Stand, nicht mit einem Fehler.
    """
    db = _db_mit_konto()

    class _GedrosselterClient(_NummernClient):
        def phone_numbers(self, _waba_id, *, token):  # noqa: ANN001, ANN201, ARG002
            raise WhatsAppRateLimitError("gedrosselt", meta_code=80008)

    client = _GedrosselterClient()
    svc = WhatsAppService(service_client=db, client=client)
    monkeypatch.setattr(
        WhatsAppService, "_client_fuer", lambda *_a, **_k: client  # noqa: ARG005
    )

    status = svc.onboarding_status(_ctx())
    assert status.connected is True
    assert status.messaging_limit_tier == "TIER_250"  # der gespeicherte Stand


def test_unveraenderter_zustand_schreibt_nur_den_stempel(monkeypatch) -> None:  # noqa: ANN001
    """Sonst wandert `updated_at` bei jedem Seitenaufruf grundlos."""
    db = _db_mit_konto(
        zustand_geprueft_at=(datetime.now(UTC) - timedelta(hours=2)).isoformat()
    )
    client = _NummernClient(tier="TIER_250", quality="GREEN")
    svc = WhatsAppService(service_client=db, client=client)
    monkeypatch.setattr(
        WhatsAppService, "_client_fuer", lambda *_a, **_k: client  # noqa: ARG005
    )

    svc.onboarding_status(_ctx())
    zeile = db.store["whatsapp_account"][0]
    assert zeile["messaging_limit_tier"] == "TIER_250"
    # Der Stempel muss trotzdem neu sein, sonst fragt der naechste Aufruf wieder.
    geprueft = datetime.fromisoformat(zeile["zustand_geprueft_at"])
    assert datetime.now(UTC) - geprueft < timedelta(minutes=1)


def test_ohne_eigene_waba_keine_template_verwaltung() -> None:
    """Ohne eigene WABA gibt es keine Vorlagen — auch nicht die eines fremden.

    Die WABA bestimmt, GEGEN WELCHEN BETRIEB `list/create/delete_template`
    laeuft. Frueher fiel der Client auf `settings.whatsapp_waba_id` zurueck:
    ein Betrieb ohne eigene WABA las, legte an und LOESCHTE damit die Vorlagen
    des global konfigurierten Betriebs. Fehlt die WABA, ist 503 die richtige
    Antwort, kein Ersatzwert (Wurzel 4 + Wurzel 3).

    Der Test nennt die Zugangsdaten vollstaendig selbst und haengt an keiner
    Umgebungsvariablen — genau daran ist er zuvor in der CI zerbrochen, waehrend
    er lokal aus der `.env` gespeist wurde.
    """
    ohne = WhatsAppClient(access_token="token_a", phone_number_id="p_a", waba_id=None)
    assert ohne.can_manage_templates is False
    for aufruf in (
        ohne.list_templates,
        lambda: ohne.create_template({"name": "x"}),
        lambda: ohne.delete_template("x"),
    ):
        with pytest.raises(WhatsAppError) as fehler:
            aufruf()
        assert fehler.value.status_code == 503


def test_cache_trennt_die_mandanten(monkeypatch) -> None:  # noqa: ANN001
    """Der Zwischenstand darf NIE Vorlagen eines fremden Betriebs ausliefern.

    Zwei Betriebe, jeder mit EIGENER WABA: der Cache-Schluessel muss sie
    trennen. Vor dem Fix trugen beide Clients dieselbe WABA aus den Settings
    und landeten unter demselben Schluessel — der zweite bekam die Vorlagen des
    ersten (Wurzel 3: Scope serverseitig erzwingen, nie aus einem Ersatzwert
    ableiten).
    """
    ausgeliefert: list[str] = []

    def _je_token(*_a, **k) -> _FakeResponse:  # noqa: ANN002, ANN003
        # Meta antwortet je Token mit den Vorlagen DIESES Betriebs.
        token = k.get("headers", {}).get("Authorization", "")
        name = "vorlage_a" if "token_a" in token else "vorlage_b"
        ausgeliefert.append(name)
        return _FakeResponse(payload={"data": [{"name": name, "language": "de"}]})

    monkeypatch.setattr(wa_client_modul.httpx, "request", _je_token)

    a = WhatsAppClient(access_token="token_a", phone_number_id="p_a", waba_id="waba_a")
    b = WhatsAppClient(access_token="token_b", phone_number_id="p_b", waba_id="waba_b")

    liste_a = a.list_templates()
    liste_b = b.list_templates()
    assert liste_a[0]["name"] == "vorlage_a"
    assert liste_b[0]["name"] == "vorlage_b", (
        "Betrieb B hat die Vorlagen von Betrieb A aus dem Zwischenstand bekommen"
    )


def test_sperrdauer_ueberlebt_einen_hoeheren_anderen_eintrag() -> None:
    """Die Wartezeit darf nicht am Prozentwert eines ANDEREN Eintrags haengen.

    Metas BUC-Header traegt bis zu 32 Objekte. Der Eintrag mit dem hoechsten
    Prozentwert muss nicht der sein, der die Sperrdauer nennt. Wer nur EINEN
    Eintrag durchreicht, verliert die Wartezeit — und `Retry-After` fehlt,
    obwohl Meta sie geliefert hat.
    """
    stand = nutzung_lesen(
        {
            "x-business-use-case-usage": (
                '{"1":[{"type":"whatsapp","call_count":100,'
                '"estimated_time_to_regain_access":0},'
                '{"type":"whatsapp","call_count":30,'
                '"estimated_time_to_regain_access":19}]}'
            )
        }
    )
    assert stand is not None
    assert stand.hoechstwert == 100  # der kritischste Prozentwert
    assert stand.estimated_time_to_regain_access == 19  # die laengste Wartezeit


def test_rollout_bricht_bei_drosselung_ab() -> None:
    """Metas Best Practice: bei erreichtem Limit KEINE weiteren Aufrufe.

    Der Rollout legt bis zu zehn Vorlagen nacheinander an. Fing die Schleife
    die Drosselung wie eine fachliche Ablehnung ab, feuerte sie neun weitere
    Aufrufe in die aktive Sperre — und verlaengerte sie damit. Zusaetzlich sah
    der Betrieb zehn „abgelehnte" Vorlagen und glaubte, seine Texte seien
    inhaltlich zurueckgewiesen worden (Wurzel 5: Kontroll-Signal nicht
    verschlucken).
    """
    versuche: list[str] = []

    class _GedrosselteWABA:
        def list_templates(self, *, frisch: bool = False):  # noqa: ANN201, ARG002
            return []

        def create_template(self, payload):  # noqa: ANN001, ANN201
            versuche.append(payload["name"])
            raise WhatsAppRateLimitError("gedrosselt", meta_code=80008)

    with pytest.raises(WhatsAppRateLimitError):
        rollout(_GedrosselteWABA())
    assert len(versuche) == 1, (
        f"nach der Drosselung wurde weitergesendet: {len(versuche)} Versuche"
    )
