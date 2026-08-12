"""Eine `gesendet`-Zeile muss auf ihren Request-Body zeigen (0381).

DER LIVE-FEHLER (12.08.2026): Alle Portal-Aufrufe im Verlauf trugen
`quelle_tabelle = 'channex_debug_log'`, aber `quelle_id = NULL` — der Insert in
`_persist_trace` holte die neue ID nicht zurück. Beim Aufklappen fand der
Detail-Endpunkt deshalb keine Quellzeile und antwortete `quelle: null`: die
vollständigen Request- und Response-Bodies lagen in der DB, waren aus der
Oberfläche aber nicht erreichbar.

Live nachgewiesen war das an fünf `availability`-Zeilen (`mit_quelle = 0`).
"""

from typing import Any

from src.features.channel_manager.channex_client import ChannexCallTrace
from src.features.channel_manager.service import ChannelManagerService


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Tabelle:
    """Minimal-PostgREST, das INSERTs mitschreibt und — wie PostgREST — die
    eingefügte Zeile samt `id` zurückgibt."""

    def __init__(self, store: "_Store", name: str) -> None:
        self._store = store
        self._name = name
        self._zeile: dict[str, Any] | None = None

    def insert(self, zeile: dict[str, Any]) -> "_Tabelle":
        self._zeile = zeile
        return self

    def execute(self) -> _Result:
        if self._zeile is None:
            return _Result([])
        self._store.inserts.setdefault(self._name, []).append(self._zeile)
        # PostgREST liefert die neue Zeile mit generierter id zurück — genau
        # dieser Rückweg fehlte im Produktionscode.
        return _Result([{**self._zeile, "id": f"{self._name}-neu-1"}])


class _Store:
    def __init__(self) -> None:
        self.inserts: dict[str, list[dict[str, Any]]] = {}

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


def _trace(**anders: Any) -> ChannexCallTrace:
    werte: dict[str, Any] = {
        "method": "PUT",
        "path": "taxes/2e31e04e-8b85-4c1e-9143-cccd20f0ed7c",
        # Wörtlich der live gesendete Body.
        "request_body": {
            "tax": {
                "rate": "795.0",
                "type": "fee",
                "logic": "per_booking",
                "title": "Reinigungsgebühr",
                "currency": "DKK",
                "is_inclusive": False,
            }
        },
        "response_body": {"data": {"id": "2e31e04e"}},
        "channex_id": "2e31e04e",
        "http_status": 200,
        "duration_ms": 214,
        "ok": True,
        "error": None,
    }
    werte.update(anders)
    return ChannexCallTrace(**werte)


def _dienst(store: _Store) -> ChannelManagerService:
    """Service ohne Netz/DB-Verbindung, nur mit dem Trace-Pfad."""
    svc = ChannelManagerService.__new__(ChannelManagerService)
    svc._db = store  # type: ignore[attr-defined]  # noqa: SLF001
    svc._trace_ctx = {  # type: ignore[attr-defined]  # noqa: SLF001
        "tenant_id": "a25577cf-c941-45c4-8d23-008887e631aa",
        "property_id": "ca392991-f1e5-4b13-b771-d3b444cc1301",
        "step": "taxes",
    }
    return svc


def test_verlaufszeile_zeigt_auf_die_debug_zeile() -> None:
    """`quelle_id` MUSS gesetzt sein — sonst ist die Zeile nicht aufklappbar."""
    store = _Store()
    _dienst(store)._persist_trace(_trace())  # noqa: SLF001

    verlauf = store.inserts["worker_ereignis"][0]
    debug = store.inserts["channex_debug_log"][0]

    assert verlauf["quelle_tabelle"] == "channex_debug_log"
    assert verlauf["quelle_id"] == "channex_debug_log-neu-1"
    # Und die Quellzeile trägt den vollständigen Body — ungekürzt.
    assert debug["request_body"]["tax"]["rate"] == "795.0"


def test_verlaufszeile_nennt_die_gesendete_gebuehr() -> None:
    """Der Satz für die Tabelle kommt aus dem echten Request-Body."""
    store = _Store()
    _dienst(store)._persist_trace(_trace())  # noqa: SLF001

    verlauf = store.inserts["worker_ereignis"][0]
    assert (
        verlauf["zusammenfassung"]
        == "Reinigungsgebühr · 795,00 DKK · pro Buchung · exklusiv"
    )


def test_ohne_debug_zeile_keine_erfundene_quelle() -> None:
    """Schlägt der Debug-Insert fehl, bleibt `quelle_id` leer.

    Eine geratene ID würde beim Aufklappen auf eine FREMDE Zeile zeigen — das
    wäre schlimmer als keine (Wurzel 4).
    """

    class _Kaputt(_Store):
        def table(self, name: str) -> _Tabelle:
            if name == "channex_debug_log":
                raise RuntimeError("DB weg")
            return super().table(name)

    store = _Kaputt()
    _dienst(store)._persist_trace(_trace())  # noqa: SLF001

    verlauf = store.inserts["worker_ereignis"][0]
    assert verlauf["quelle_id"] is None
    # Der Verlauf wird trotzdem geschrieben: dass gesendet wurde, ist wahr.
    assert verlauf["vorgang"] == "taxes"


def test_fehlgeschlagener_aufruf_bleibt_als_fehler_stehen() -> None:
    """Ein 422 vom Portal muss im Verlauf rot sein und den Grund tragen."""
    store = _Store()
    _dienst(store)._persist_trace(  # noqa: SLF001
        _trace(ok=False, http_status=422, error="tax rate must be positive")
    )

    verlauf = store.inserts["worker_ereignis"][0]
    assert verlauf["ergebnis"] == "fehler"
    assert verlauf["fehler_text"] == "tax rate must be positive"
    assert verlauf["http_status"] == 422
    # Auch im Fehlerfall steht da, WAS gesendet wurde — das ist die Diagnose.
    assert "Reinigungsgebühr" in verlauf["zusammenfassung"]
