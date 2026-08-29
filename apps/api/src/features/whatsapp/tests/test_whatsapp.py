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
