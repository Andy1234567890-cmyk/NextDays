"""Der Voll-Push muss den Ist-Spiegel (`channex_ari_shadow`) fortschreiben.

LIVE PASSIERT (06.09.2026, „Feriehus Snerlebo"): 12:25 Delta-Push 750 DKK
(Schatten: 750). 12:48 Voll-Push 900 (Schatten: weiter 750 — der Voll-Push
schrieb ihn nicht). 12:53 Grundpreis erneut 750: der Abgleich verglich Soll 750
mit Schatten 750, fand keine Differenz, schickte nichts — bei Channex stand 900.

Der Abgleich liest Channex bewusst NICHT zurück (Channex untersagt das); der
Schatten ist sein einziges „Ist". Ein Push, der ihn nicht pflegt, macht jeden
späteren Abgleich blind (Wurzel 1).
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.channex_client import ChannexError

ROWS = [
    {"date_from": "2026-09-06", "date_to": "2026-09-30", "rate_plan_id": "rp-1",
     "rate_cents": 75000, "min_stay": 2, "max_stay": 365,
     "closed_to_arrival": False, "closed_to_departure": False, "stop_sell": False},
    {"date_from": "2026-10-01", "date_to": "2026-10-02", "rate_plan_id": "rp-1",
     "rate_cents": 94500, "min_stay": 2, "max_stay": 365,
     "closed_to_arrival": False, "closed_to_departure": False, "stop_sell": False},
]


class _Channex:
    is_configured = True

    def __init__(self, *, scheitert: bool = False) -> None:
        self.gesendet: list[list[dict[str, Any]]] = []
        self._scheitert = scheitert

    def update_restrictions(self, values: list[dict[str, Any]]) -> dict[str, Any]:
        if self._scheitert:
            raise ChannexError("Bad Request", channex_status=400)
        self.gesendet.append(values)
        return {"data": {"task_id": "t-1"}}


class _Dienst(AriPushMixin):
    def __init__(self, channex: _Channex) -> None:
        self._channex = channex
        self._db = object()
        self.schatten: list[tuple[str, list[dict[str, Any]], list[str]]] = []
        self.outbox: list[tuple[str, str]] = []

    def _trace_step(self, **_kw: Any) -> None:
        return None

    def _mark_restriction_outbox(self, outbox_id: str, status: str) -> None:
        self.outbox.append((outbox_id, status))

    def _write_ari_shadow(
        self, _tenant_id: str, property_id: str, segments: list[dict[str, Any]],
        rate_plan_ids: list[str],
    ) -> None:
        self.schatten.append((property_id, segments, rate_plan_ids))

    # Für push_restriction_rows_multi:
    def _is_channex_managed(self, *_a: Any) -> bool:
        return True

    def _enqueue_restriction_outbox(self, *_a: Any, **_kw: Any) -> str:
        return "outbox-1"

    def _resolve_channex_rate_plans(self, *_a: Any) -> list[dict[str, str]]:
        return [{
            "local_rate_plan_id": "rp-1", "channex_rate_plan_id": "cx-rp-1",
            "channex_property_id": "cx-p-1",
        }]


def test_voll_push_schreibt_den_schatten() -> None:
    cx = _Channex()
    dienst = _Dienst(cx)
    dienst.push_restriction_rows_multi("t1", {"p1": ROWS})

    assert len(cx.gesendet) == 1  # EIN POST /restrictions
    assert dienst.outbox == [("outbox-1", "done")]
    # Der Spiegel trägt GENAU die gesendeten Zeilen — Preis und min_stay.
    assert dienst.schatten == [("p1", ROWS, ["rp-1"])]


def test_fehlgeschlagener_push_laesst_den_schatten_in_ruhe() -> None:
    """Der Schatten ist der Stand, der ANKAM. Nach einem Fehler bleibt der alte
    Wert stehen und gilt beim nächsten Abgleich als Differenz. Der Bucket-Push
    fängt den Channex-Fehler selbst (Outbox bleibt 'pending', Cron-Backstop) —
    entscheidend ist, dass dabei KEIN Spiegel geschrieben wird."""
    dienst = _Dienst(_Channex(scheitert=True))
    dienst.push_restriction_rows_multi("t1", {"p1": ROWS})
    assert dienst.schatten == []
    assert dienst.outbox == []  # bleibt 'pending' für den Cron


def test_leere_werte_schreiben_nichts() -> None:
    dienst = _Dienst(_Channex())
    dienst.push_restriction_rows_multi("t1", {"p1": []})
    assert dienst.schatten == []
