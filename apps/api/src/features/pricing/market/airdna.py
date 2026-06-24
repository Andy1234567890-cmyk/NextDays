"""AirDNA-Markt-Signal-Provider (Phase 2).

Holt Comp-Preis / Nachfrage / Markt-Events von der AirDNA-API und mappt sie auf
MarketDay je Tag. NUR aktiv mit gesetztem airdna_api_key (echtes B2B-Konto). Ohne
Key wird dieser Provider gar nicht erst gewählt (siehe factory.get_market_provider)
— Phase 2 ist damit ohne bezahltes Konto voll baubar/testbar (Parsing per Mock).

Die genauen AirDNA-Endpunktformen variieren je Plan; das Parsing ist defensiv
(fehlende Felder → None → neutral), und der HTTP-Aufruf ist über einen
injizierbaren Transport (httpx.Client) testbar gehalten.
"""
from __future__ import annotations

from datetime import date

import httpx

from src.core.logging import get_logger

from .base import MarketDay, MarketSignalProvider

log = get_logger("nextdays.pricing.market.airdna")


class AirDnaProvider(MarketSignalProvider):
    """Markt-Signal aus AirDNA. Defensiv geparst; Fehler → leeres Signal."""

    name = "airdna"

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.airdna.co/api/v1",
        *,
        client: httpx.Client | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = client
        self._timeout = timeout

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        if not market_key or not days:
            return {}
        try:
            payload = self._fetch(market_key, comp_refs, days[0], days[-1])
        except Exception as exc:  # noqa: BLE001 — Markt-Signal ist best-effort
            log.warning("airdna_fetch_failed", market_key=market_key, error=str(exc))
            return {}
        return self._parse(payload)

    def _fetch(
        self,
        market_key: str,
        comp_refs: list[str],
        start: date,
        end: date,
    ) -> dict:
        url = f"{self._base_url}/market/{market_key}/pricing"
        params = {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }
        if comp_refs:
            params["comp_refs"] = ",".join(comp_refs)
        headers = {"Authorization": f"Bearer {self._api_key}"}
        if self._client is not None:
            resp = self._client.get(url, params=params, headers=headers)
        else:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _parse(payload: dict) -> dict[str, MarketDay]:
        """AirDNA-Antwort → {ISO-Datum: MarketDay}. Defensiv: fehlende Felder None.

        Erwartete Form (tolerant): {"days": [{"date","comp_price"|"median_price",
        "demand_index"|"demand","event_uplift_pct"|"event_pct"}, …]}.
        """
        out: dict[str, MarketDay] = {}
        for item in payload.get("days") or []:
            if not isinstance(item, dict):
                continue
            day = item.get("date")
            if not isinstance(day, str):
                continue
            out[day[:10]] = MarketDay(
                comp_price=_num(item.get("comp_price", item.get("median_price"))),
                demand_index=_num(item.get("demand_index", item.get("demand"))),
                event_uplift_pct=_num(
                    item.get("event_uplift_pct", item.get("event_pct"))
                ),
            )
        return out


def _num(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
