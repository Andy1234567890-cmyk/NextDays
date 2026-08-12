"""ARI-Änderungen eines Portals müssen durch den Webhook kommen.

DER LIVE-FEHLER (12.08.2026): Channex hatte 1.615 ARI-Changes ausgeliefert, bei
uns lag davon KEIN einziges Ereignis. Der Test-Ping-Riegel im Handler prüfte nur
auf ein `event`-Feld — die ARI-Nutzlast trägt keines, sondern eine
`changes`-Liste. Jede Änderung wurde damit als leerer Ping verworfen UND mit 200
bestätigt, sodass Channex sie für zugestellt hielt.

Die Folge war unsichtbar: änderte ein Portal Verfügbarkeit oder Preis außerhalb
unseres PMS, erfuhren wir es erst beim nächsten periodischen Import — nicht
sofort. Und die 200-Antwort verhinderte, dass Channex es je als Fehlschlag
gemeldet hätte.

Die Nutzlast hier ist wörtlich die aus dem Channex-Dashboard.
"""
from typing import Any

from fastapi.testclient import TestClient

from src.core.config import get_settings
from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.bookings_sync import BookingsSyncMixin
from src.features.channel_manager.channels import ChannelsMixin
from src.main import create_app

client = TestClient(create_app())


class _Sync(ChannelsMixin, BookingsSyncMixin, AriPushMixin):
    """Nur die Mixins, die dieser Pfad wirklich braucht.

    Der echte `ChannelManagerService` zieht ein Dutzend weitere samt
    Supabase-Client mit; hier zählen `ingest_webhook` (ChannelsMixin) und die
    Auflösung der Room-Types.
    """

    def __init__(self, store: object) -> None:
        self._db = store
        self.eingereiht: list[tuple[str, str]] = []

    def _enqueue_ari_import(  # type: ignore[override]  # noqa: D102
        self, tenant_id: str, channex_property_id: str
    ) -> None:
        self.eingereiht.append((tenant_id, channex_property_id))


# Wörtlich aus dem Channex-Dashboard (Delivery 6c1892ef, 12.08.2026 14:08:18).
# Kein `event`-Feld — genau daran ist der alte Riegel gescheitert.
ARI_NUTZLAST: dict[str, Any] = {
    "changes": [
        {
            "date": "2026-08-13",
            "channel_id": None,
            "rate_plan_id": "2789174f-b327-49e7-be05-b8c60b50d9cf",
            "room_type_id": "4562a148-8a52-40ab-ad5d-774c686cac4b",
            "availability": 0,
            "booked": 1,
            "stop_sell": True,
        },
        {
            "date": "2026-08-13",
            "channel_id": "9a46827b-7b6a-4be2-bbd6-611794f785fb",
            "rate_plan_id": "20d955f1-0a79-4f3b-9013-b27912b9cc75",
            "room_type_id": "4562a148-8a52-40ab-ad5d-774c686cac4b",
            "availability": 0,
            "booked": 1,
            "stop_sell": True,
        },
    ]
}


def test_ari_nutzlast_ist_kein_test_ping() -> None:
    """Ohne Secret → 401, NICHT das freundliche „ok" des Test-Pings.

    Das ist der Kern des Fehlers: Der Handler hielt die ARI-Nutzlast für einen
    leeren Ping und antwortete 200, ohne sie überhaupt anzusehen. Ein 401 hier
    beweist, dass sie als echtes Ereignis behandelt wird.
    """
    resp = client.post(
        "/api/v1/channel-manager/webhook",
        json=ARI_NUTZLAST,
        headers={"X-Channex-Webhook-Secret": "falsch"},
    )
    assert resp.status_code == 401


def test_wirklich_leerer_ping_bleibt_ok() -> None:
    """Die Umkehrprobe: Channex prüft die URL beim Einrichten mit einer leeren
    Nutzlast OHNE Secret. Bliebe das nicht 200, meldete das Dashboard
    „Operation failed" und der Webhook liesse sich nicht anlegen."""
    resp = client.post("/api/v1/channel-manager/webhook", json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_secret_ist_gesetzt_damit_der_401_test_aussagt() -> None:
    """Absicherung des Tests oben: wäre kein Secret konfiguriert, käme der 401
    aus einem leeren Vergleich und die Prüfung wäre wertlos."""
    assert get_settings().channex_webhook_secret.get_secret_value()


# --------------------------------------------------------------------------
# Verarbeitung: room_type_id → Objekt → Import-Job
# --------------------------------------------------------------------------


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Minimal-PostgREST mit echter Filterwirkung.

    Echt filternd, nicht durchwinkend: der `deleted_at`-Filter IST hier die
    Prüfung (ein aufgehobenes Mapping darf keinen Import auslösen). Eine
    Attrappe, die jede Kette akzeptiert, bestätigte auch den kaputten Filter.
    """

    def __init__(self, store: "_Store", table: str) -> None:
        self._store = store
        self._table = table
        self._filter: list[tuple[str, str, Any]] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        return self

    def eq(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "eq", val))
        return self

    def in_(self, col: str, werte: list[Any]) -> "_Query":
        self._filter.append((col, "in", [str(w) for w in werte]))
        return self

    def is_(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "isnull" if str(val) == "null" else "is", val))
        return self

    def insert(self, *_a: object, **_k: object) -> "_Query":
        # Der Verlauf (0379) schreibt hier hinein — für diesen Test belanglos,
        # darf aber nicht abstürzen.
        return self

    def execute(self) -> _Result:
        rows = self._store.tabellen.get(self._table, [])
        treffer = []
        for row in rows:
            passt = True
            for col, op, val in self._filter:
                ist = row.get(col)
                if op == "eq" and str(ist) != str(val):
                    passt = False
                elif op == "in" and str(ist) not in val:
                    passt = False
                elif op == "isnull" and ist is not None:
                    passt = False
            if passt:
                treffer.append(dict(row))
        return _Result(treffer)


class _Store:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self.tabellen = tabellen

    def table(self, name: str) -> _Query:
        return _Query(self, name)


# Die Kette, wie sie live aufgelöst wird (geprüft am 12.08.2026 an
# Feriehus Rævehulen): room_type → property_map_id → Channex-Property.
ROOM_TYPE = "4562a148-8a52-40ab-ad5d-774c686cac4b"
MAP_ID = "map-1"
CX_PROPERTY = "c81b6925-db2a-408c-adcb-6a0064731445"
TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"


def _store_mit_mapping() -> _Store:
    return _Store(
        {
            "channex_room_type_map": [
                {
                    "channex_room_type_id": ROOM_TYPE,
                    "property_map_id": MAP_ID,
                    "deleted_at": None,
                }
            ],
            "channex_property_map": [
                {
                    "id": MAP_ID,
                    "tenant_id": TENANT,
                    "channex_property_id": CX_PROPERTY,
                    "deleted_at": None,
                }
            ],
        }
    )


def test_aenderung_reiht_import_je_property_einmal_ein() -> None:
    """Zwei Änderungen am selben Room-Type → EIN Import-Job.

    Ein Job je Änderung würde bei einem Preis-Update über 365 Tage Hunderte
    Jobs erzeugen, die einander das Channex-Budget wegnehmen.
    """
    svc = _Sync(_store_mit_mapping())

    antwort = svc.ingest_webhook(ARI_NUTZLAST)

    assert svc.eingereiht == [(TENANT, CX_PROPERTY)]
    assert antwort["event"] == "ari_changes"
    assert antwort["objekte"] == "1"


def test_fremder_room_type_wird_uebersprungen() -> None:
    """Ein Room-Type, den wir nicht kennen, wird nicht geraten (Wurzel 4).

    Fremde Room-Types auf demselben Channex-Konto sind normal — sie dürfen den
    Ingest nicht kippen und keinen Job für ein falsches Objekt erzeugen.
    """
    svc = _Sync(_store_mit_mapping())

    svc.ingest_webhook(
        {"changes": [{"date": "2026-08-13", "room_type_id": "fremd-999"}]}
    )

    assert svc.eingereiht == []


def test_geloeschtes_mapping_zaehlt_nicht() -> None:
    """Ein aufgehobenes Mapping (`deleted_at`) darf keinen Import auslösen —
    das Objekt wird dort nicht mehr von Channex geführt."""
    store = _store_mit_mapping()
    store.tabellen["channex_room_type_map"][0]["deleted_at"] = "2026-08-01T00:00:00Z"
    svc = _Sync(store)

    svc.ingest_webhook(ARI_NUTZLAST)

    assert svc.eingereiht == []


def test_werte_der_nutzlast_werden_nicht_angewendet() -> None:
    """Die Nutzlast trägt `availability: 0` und `stop_sell: true` — davon darf
    NICHTS direkt in den Kalender geschrieben werden.

    Channex sichert keine Reihenfolge zu (out-of-order laut Doku). Ein alter
    `availability: 0` würde einen frisch freigegebenen Tag wieder sperren. Das
    Ereignis ist der Auslöser, den Stand zieht der Import.
    """
    store = _store_mit_mapping()
    svc = _Sync(store)

    svc.ingest_webhook(ARI_NUTZLAST)

    assert "availability" not in store.tabellen
    assert "stop_sell" not in store.tabellen


def test_ohne_room_type_kein_job_und_kein_absturz() -> None:
    """Eine Änderung ohne `room_type_id` ist nicht auflösbar — sie wird
    protokolliert und übersprungen, statt den Ingest zu kippen (immer 200,
    sonst wiederholt Channex bis 24 h)."""
    svc = _Sync(_store_mit_mapping())

    antwort = svc.ingest_webhook({"changes": [{"date": "2026-08-13"}]})

    assert svc.eingereiht == []
    assert antwort["objekte"] == "0"
