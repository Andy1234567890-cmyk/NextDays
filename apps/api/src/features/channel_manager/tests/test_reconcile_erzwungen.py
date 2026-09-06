"""Eine Preis-Speicherung sendet — sie vergleicht nicht mit einer Annahme.

LIVE (06.09.2026, „Feriehus Snerlebo"): der Betrieb speichert 750 DKK. Der
Differenz-Lauf liest den Schatten des letzten Pushs (750, vom Delta-Push um
12:25), hält ihn für Channex' Stand und schickt nichts. Bei Channex steht 900,
weil ein Voll-Push dazwischen den Schatten nicht geschrieben hatte. Aus Sicht
des Betriebs: „der Preis geht nicht raus, wenn wir speichern".

`erzwingen=True` (jede Preis-Speicherung) übergeht den Schatten und sendet die
Soll-Kurve — RLE-gebündelt, also wenige Segmente, keine Flut.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin

HEUTE = date.today()
TAGE = [(HEUTE + timedelta(days=i)).isoformat() for i in range(3)]


class _Channex:
    is_configured = True


class _Dienst(AriPushMixin):
    def __init__(self) -> None:
        self._channex = _Channex()
        self._db = object()
        self.gepusht: list[list[dict[str, Any]]] = []
        self.schatten_gelesen = 0

    def _is_channex_managed(self, *_a: Any) -> bool:
        return True

    def _resolve_channex_rate_plans(self, *_a: Any) -> list[dict[str, str]]:
        return [{"local_rate_plan_id": "rp-1", "channex_rate_plan_id": "cx-1",
                 "channex_property_id": "cx-p"}]

    def _load_desired_rate_plan_prices(self, *_a: Any) -> dict[str, dict[str, int]]:
        return {"rp-1": {iso: 75000 for iso in TAGE}}

    def _load_desired_rate_plan_min_stays(self, *_a: Any) -> dict[str, dict[str, int]]:
        return {"rp-1": {iso: 2 for iso in TAGE}}

    def _load_ari_shadow(self, *_a: Any) -> dict[str, dict[str, dict[str, int]]]:
        # Der Schatten BEHAUPTET, 750 und min_stay 2 seien bei Channex.
        self.schatten_gelesen += 1
        return {"rp-1": {iso: {"rate_cents": 75000, "min_stay": 2} for iso in TAGE}}

    def _write_rate_plan_sync_state(self, *_a: Any) -> None:
        return None

    def push_rates_batch(self, _t: str, _p: str, segments: list[dict[str, Any]]) -> None:
        self.gepusht.append(segments)


def test_differenzlauf_glaubt_dem_schatten() -> None:
    """Der 15-Minuten-Tick: Schatten = Soll → nichts zu tun. So soll er bleiben."""
    dienst = _Dienst()
    erg = dienst.reconcile_rate_plan_prices("t1", "p1", horizon_days=2)
    assert erg["drift"] == 0 and dienst.gepusht == []
    assert dienst.schatten_gelesen == 1


def test_speichern_sendet_trotz_gleichem_schatten() -> None:
    dienst = _Dienst()
    erg = dienst.reconcile_rate_plan_prices("t1", "p1", horizon_days=2, erzwingen=True)

    assert dienst.schatten_gelesen == 0  # keine Annahme befragt
    assert erg["drift"] == erg["checked"] == 6  # 3 Tage Preis + 3 Tage min_stay
    assert len(dienst.gepusht) == 1
    segmente = dienst.gepusht[0]
    # RLE-gebündelt: EIN Preis-Segment über drei gleiche Tage, EIN min_stay-Segment.
    preis = [s for s in segmente if s.get("rate_cents") is not None]
    assert len(preis) == 1 and preis[0]["rate_cents"] == 75000
    assert preis[0]["date_from"] == TAGE[0] and preis[0]["date_to"] == TAGE[-1]
    assert preis[0]["rate_plan_id"] == "rp-1"
    assert erg["pushed_segments"] == 2
