"""Wechselkurse für die Owner-Abrechnung (ECB-Tageskurse via Frankfurter).

Die Eigentümer-Auszahlung je Reservierung wird von der Quellwährung der Buchung
in die Owner-Währung umgerechnet — mit dem ECB-Referenzkurs am Stichtag
(Check-out der Reservierung). Quelle ist die kostenlose Frankfurter-API
(https://frankfurter.dev, kein API-Key, ECB-Daten).

Ablauf von get_rate(date, base, quote):
  1. base == quote → 1 (keine Umrechnung nötig).
  2. Kurs aus dem Cache (Tabelle fx_rates) lesen — Tageskurse sind stabil.
  3. Cache-Miss → einmal von Frankfurter holen, in fx_rates speichern, zurückgeben.

Bewusst KEIN Fallback: Lässt sich ein Kurs nicht beschaffen, wird FxError
geworfen — die Abrechnung schlägt klar fehl, statt mit einem erfundenen Kurs
falsche Beträge zu erzeugen (PROJECT.md: keine Fallback-Werte).

Frankfurter liefert an Wochenenden/Feiertagen den letzten Handelstag-Kurs; das
angefragte Datum kann also vom zurückgegebenen `date` abweichen. Wir cachen den
Kurs unter dem ANGEFRAGTEN Datum (Stichtag der Reservierung), damit derselbe
Stichtag stets denselben Kurs liefert.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import httpx
from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.owner_statements.fx")

_FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"
_TIMEOUT_S = 8.0


class FxError(Exception):
    """Kurs nicht beschaffbar — kein Fallback, die Abrechnung soll fehlschlagen."""


class FxService:
    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def get_rate(self, rate_date: date, base: str, quote: str) -> Decimal:
        """1 `base` = Rückgabe `quote` am `rate_date`. Cache → sonst Frankfurter."""
        base = base.strip().upper()
        quote = quote.strip().upper()
        if base == quote:
            return Decimal("1")

        cached = self._from_cache(rate_date, base, quote)
        if cached is not None:
            return cached

        rate = self._fetch(rate_date, base, quote)
        self._cache(rate_date, base, quote, rate)
        return rate

    def _from_cache(
        self, rate_date: date, base: str, quote: str
    ) -> Decimal | None:
        rows = (
            self._db.table("fx_rates")
            .select("rate")
            .eq("rate_date", rate_date.isoformat())
            .eq("base", base)
            .eq("quote", quote)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        return Decimal(str(rows[0]["rate"]))

    def _fetch(self, rate_date: date, base: str, quote: str) -> Decimal:
        url = f"{_FRANKFURTER_BASE}/{rate_date.isoformat()}"
        try:
            resp = httpx.get(
                url,
                params={"base": base, "symbols": quote},
                timeout=_TIMEOUT_S,
            )
            resp.raise_for_status()
            payload = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning(
                "fx_fetch_failed",
                base=base,
                quote=quote,
                rate_date=rate_date.isoformat(),
                error=str(exc),
            )
            raise FxError(
                f"Wechselkurs {base}→{quote} für {rate_date.isoformat()} "
                "nicht abrufbar."
            ) from exc

        rate = (payload.get("rates") or {}).get(quote)
        if rate is None:
            raise FxError(
                f"Wechselkurs {base}→{quote} für {rate_date.isoformat()} "
                "fehlt in der Antwort."
            )
        return Decimal(str(rate))

    def _cache(
        self, rate_date: date, base: str, quote: str, rate: Decimal
    ) -> None:
        try:
            self._db.table("fx_rates").upsert(
                {
                    "rate_date": rate_date.isoformat(),
                    "base": base,
                    "quote": quote,
                    "rate": float(rate),
                    "source": "ECB",
                },
                on_conflict="rate_date,base,quote",
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Cache-Fehler nicht fatal
            log.warning("fx_cache_failed", base=base, quote=quote, error=str(exc))
