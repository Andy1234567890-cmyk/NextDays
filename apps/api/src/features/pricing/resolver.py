"""Zentraler Preis-Resolver — die EINE Preis-Wahrheit (Single Source of Truth).

Vorher lagen Preise in vier unverbundenen Quellen, die nicht zusammenspielten
(Objekt-Preise erschienen nicht im Kalender/Quote). Dieser Resolver vereint sie:

  effective_price(property_id, day) -> Effektivpreis EINES Tages in der Reihenfolge
    manueller price_override(Tag) > dynamic_price(Regel-Engine, Tag)
    > weekday_price(Wochentag, falls custom_by_weekday) > rate_plan.base_price.
    Kein Preis vorhanden → None (kein erfundener Fallback). Ein manuell gesetzter
    Override gewinnt IMMER über den Dynamic-Pricing-Vorschlag.

  quote(req) -> vollständige Buchungs-Aufschlüsselung: nimmt die Effektiv-Tages-
    preise, wendet Längenpreis/Kurzaufenthalt/Extra-Gast pro Nacht an, dann
    Kanal-Markup, Gebühren, Aktionen (Rabatt) und Steuern → Summe + Positionen.

Alle Oberflächen (Kalender, Reservierungs-Wizard, Buchungsstrecke) lesen Preise
ausschließlich über diesen Resolver — kein direktes Preis-Tabellenlesen mehr.
"""
from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.features.addons.pricing import addon_total

from .schemas import (
    EffectivePriceDay,
    QuoteLine,
    QuoteRequest,
    QuoteResponse,
)

log = get_logger("nextdays.pricing")

# Wochentag-Index (date.weekday(): Mo=0) → Key in weekday_prices.
_WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class PricingError(Exception):
    """Fachlicher Preis-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _to_float(value: object) -> float | None:
    """numeric/str → float; None bei fehlendem/ungültigem Wert (kein Fallback)."""
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _nights(check_in: date, check_out: date) -> list[date]:
    days: list[date] = []
    cur = check_in
    while cur < check_out:
        days.append(cur)
        cur += timedelta(days=1)
    return days


class _PricingConfig:
    """Gelesene Pricing-Konfiguration eines Objekts (aus property_pricing_config).

    Hält die für den Resolver relevanten Felder typsicher vor. Fehlt die Zeile,
    sind alle Aufschläge 0/leer (das Objekt nutzt dann nur Basispreis/Overrides).
    """

    def __init__(self, row: dict | None) -> None:
        row = row or {}
        self.currency: str | None = row.get("currency") or None
        self.custom_by_weekday: bool = bool(row.get("custom_by_weekday"))
        self.weekday_prices: dict[str, object] = row.get("weekday_prices") or {}
        self.markup: dict[str, object] = row.get("markup") or {}
        self.extra_guest_charge: float = _to_float(row.get("extra_guest_charge")) or 0.0
        self.extra_guest_from: int = int(row.get("extra_guest_from") or 1)
        self.short_stay_max_nights: int = int(row.get("short_stay_max_nights") or 0)
        self.short_stay_surcharge: float = (
            _to_float(row.get("short_stay_surcharge")) or 0.0
        )
        self.length_prices: list[dict] = [
            lp for lp in (row.get("length_prices") or []) if isinstance(lp, dict)
        ]
        self.fees: list[dict] = [
            f for f in (row.get("fees") or []) if isinstance(f, dict)
        ]
        self.taxes: list[dict] = [
            t for t in (row.get("taxes") or []) if isinstance(t, dict)
        ]
        self.promotions: list[dict] = [
            p for p in (row.get("promotions") or []) if isinstance(p, dict)
        ]

    def weekday_price(self, day: date) -> float | None:
        if not self.custom_by_weekday:
            return None
        return _to_float(self.weekday_prices.get(_WEEKDAY_KEYS[day.weekday()]))

    def length_price_per_night(self, nights: int) -> float | None:
        """Reduzierter Nachtpreis für die längste passende Längen-Regel (>= minNights)."""
        best_min = -1
        best_price: float | None = None
        for lp in self.length_prices:
            min_nights = int(lp.get("minNights") or 0)
            price = _to_float(lp.get("pricePerNight"))
            if price is None or min_nights <= 0 or nights < min_nights:
                continue
            if min_nights > best_min:
                best_min = min_nights
                best_price = price
        return best_price

    def markup_pct(self, channel: str) -> float:
        """Markup-Prozent für einen externen Kanal (direct/unbekannt → 0)."""
        return _to_float(self.markup.get(channel)) or 0.0


class PricingResolver:
    slice_name = "pricing"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    # -- Quellen einmalig laden ----------------------------------------------
    def _load_config(self, property_id: str) -> _PricingConfig:
        """Pricing-Konfiguration eines Objekts (Aufschläge/Gebühren/Steuern).

        Die Konfig ist OPTIONAL: fehlt sie (kein Eintrag — oder die Tabelle ist
        in einer noch nicht migrierten Umgebung gar nicht vorhanden), gelten
        keine Aufschläge. Das ist KEIN erfundener Preis — Basispreis/Override
        bleiben die Wahrheit; es entfallen nur die optionalen Zuschläge. So
        bleibt der Kalender unabhängig vom Migrationsstand funktionsfähig."""
        try:
            res = (
                self._db()
                .table("property_pricing_config")
                .select("*")
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = leere Konfig
            log.warning("pricing_config_unavailable", error=str(exc))
            return _PricingConfig(None)
        return _PricingConfig(res[0] if res else None)

    def _load_addons(
        self, property_id: str, addon_ids: list[str]
    ) -> dict[str, dict]:
        """Aktive Katalog-Add-ons des Objekts zu den gewählten IDs (id → Zeile).

        Filtert auf property_id UND active=true, damit der Quote nur echte,
        freigegebene Upsells dieses Objekts bepreist (kein Vertrauen auf Input)."""
        if not addon_ids:
            return {}
        try:
            rows = (
                self._db()
                .table("property_addons")
                .select("id, name, price, basis, tax_rate")
                .eq("property_id", property_id)
                .eq("active", True)
                .in_("id", addon_ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Add-ons
            log.warning("pricing_addons_unavailable", error=str(exc))
            return {}
        return {str(r["id"]): r for r in rows}

    def _load_rate_plan(self, property_id: str) -> tuple[float | None, str | None]:
        """Basispreis + Währung aus dem (ersten) Rate-Plan. Ohne Plan → (None, None)."""
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price, currency")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not res:
            return None, None
        return _to_float(res[0].get("base_price")), res[0].get("currency") or None

    def _load_overrides(
        self, property_id: str, check_in: date, check_out: date
    ) -> dict[str, float]:
        res = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .not_.is_("price", "null")
            .execute()
        ).data or []
        out: dict[str, float] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                out[day] = price
        return out

    def _load_rate_plan_overrides(
        self, rate_plan_id: str, check_in: date, check_out: date
    ) -> dict[str, float]:
        """Datumsgenaue Preise EINES Rate-Plans (Hotel: Twin/BAR ≠ Double/B&B).

        Optional wie die anderen Zusatzquellen: fehlt die Tabelle (Umgebung noch
        nicht auf 0146 migriert), gilt leer → der Resolver fällt sauber auf den
        property-weiten Override/Base zurück (kein erfundener Preis, kein Crash)."""
        try:
            res = (
                self._db()
                .table("rate_plan_price_overrides")
                .select("date, price")
                .eq("rate_plan_id", rate_plan_id)
                .gte("date", check_in.isoformat())
                .lt("date", check_out.isoformat())
                .not_.is_("price", "null")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine RP-Preise
            log.warning("rate_plan_price_overrides_unavailable", error=str(exc))
            return {}
        out: dict[str, float] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                out[day] = price
        return out

    def _load_dynamic(
        self, property_id: str, check_in: date, check_out: date
    ) -> dict[str, dict]:
        """Dynamic-Pricing-Tagespreise (Regel-Engine) inkl. Faktor-Aufschlüsselung.
        {ISO-Datum: {"price": float, "factors": dict}}. Optional wie die Konfig:
        fehlt die Tabelle (nicht migriert) oder die factors-Spalte → leer/None, der
        Resolver fällt auf weekday/base zurück (kein erfundener Preis)."""
        try:
            res = (
                self._db()
                .table("dynamic_prices")
                .select("date, price, factors")
                .eq("property_id", property_id)
                .gte("date", check_in.isoformat())
                .lt("date", check_out.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle/Spalte = kein DP
            log.warning("dynamic_prices_unavailable", error=str(exc))
            return {}
        out: dict[str, dict] = {}
        for r in res:
            day, price = r.get("date"), _to_float(r.get("price"))
            if isinstance(day, str) and price is not None:
                factors = r.get("factors")
                out[day] = {
                    "price": price,
                    "factors": factors if isinstance(factors, dict) else None,
                }
        return out

    # -- Effektivpreis pro Tag ------------------------------------------------
    def effective_price(
        self, property_id: str, day: date, *, rate_plan_id: str | None = None
    ) -> EffectivePriceDay:
        """Effektivpreis EINES Tages: rate_plan > override > dynamic > weekday > base.

        `rate_plan_id` optional — nur gesetzt, wenn ein KONKRETER Rate-Plan bepreist
        wird (Channex-Push pro Rate-Plan, Hotel-Quote). Ohne ihn bleibt das Verhalten
        property-weit wie bisher (FeWo, Kalender-Board)."""
        nxt = day + timedelta(days=1)
        overrides = self._load_overrides(property_id, day, nxt)
        dynamic = self._load_dynamic(property_id, day, nxt)
        config = self._load_config(property_id)
        base, _currency = self._load_rate_plan(property_id)
        rp_over = (
            self._load_rate_plan_overrides(rate_plan_id, day, nxt)
            if rate_plan_id
            else {}
        )
        return self._effective_for_day(day, overrides, dynamic, config, base, rp_over)

    @staticmethod
    def _effective_for_day(
        day: date,
        overrides: dict[str, float],
        dynamic: dict[str, dict],
        config: _PricingConfig,
        base: float | None,
        rate_plan_overrides: dict[str, float] | None = None,
    ) -> EffectivePriceDay:
        key = day.isoformat()
        # Datumsgenauer Preis DIESES Rate-Plans gewinnt vor allem anderen (Hotel:
        # Twin/BAR und Double/B&B können am selben Tag verschieden sein).
        if rate_plan_overrides and key in rate_plan_overrides:
            return EffectivePriceDay(
                date=day, price=rate_plan_overrides[key], source="rate_plan"
            )
        # Manueller Property-Override gewinnt vor Dynamic Pricing.
        if key in overrides:
            return EffectivePriceDay(date=day, price=overrides[key], source="override")
        if key in dynamic:
            return EffectivePriceDay(
                date=day,
                price=dynamic[key]["price"],
                source="dynamic",
                factors=dynamic[key].get("factors"),
            )
        weekday = config.weekday_price(day)
        if weekday is not None:
            return EffectivePriceDay(date=day, price=weekday, source="weekday")
        if base is not None:
            return EffectivePriceDay(date=day, price=base, source="base")
        return EffectivePriceDay(date=day, price=None, source="none")

    def effective_prices(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        *,
        rate_plan_id: str | None = None,
    ) -> list[EffectivePriceDay]:
        """Effektivpreise für jeden Tag [check_in, check_out) in EINEM Lauf.

        `rate_plan_id` optional (siehe effective_price): gesetzt → dessen
        datumsgenaue Preise gewinnen; None → property-weit wie bisher."""
        overrides = self._load_overrides(property_id, check_in, check_out)
        dynamic = self._load_dynamic(property_id, check_in, check_out)
        config = self._load_config(property_id)
        base, _currency = self._load_rate_plan(property_id)
        rp_over = (
            self._load_rate_plan_overrides(rate_plan_id, check_in, check_out)
            if rate_plan_id
            else {}
        )
        return [
            self._effective_for_day(day, overrides, dynamic, config, base, rp_over)
            for day in _nights(check_in, check_out)
        ]

    # -- Batch: viele Objekte in EINEM Lauf (Board-Endpunkt) ------------------
    def effective_prices_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, list[EffectivePriceDay]]:
        """Effektivpreise für VIELE Objekte, mit je EINER `.in_()`-Query pro Quelle
        statt 4 Queries pro Objekt (N+1-Auflösung → 4 Queries gesamt).

        Liefert {property_id: [EffectivePriceDay,…]}. Nutzt dieselbe
        `_effective_for_day`-Logik wie der Einzelpfad — eine Preis-Wahrheit."""
        if not property_ids:
            return {}
        overrides = self._load_overrides_bulk(property_ids, check_in, check_out)
        dynamic = self._load_dynamic_bulk(property_ids, check_in, check_out)
        configs = self._load_config_bulk(property_ids)
        bases = self._load_rate_plan_bulk(property_ids)
        days = _nights(check_in, check_out)
        empty_cfg = _PricingConfig(None)
        out: dict[str, list[EffectivePriceDay]] = {}
        for pid in property_ids:
            ov = overrides.get(pid, {})
            dyn = dynamic.get(pid, {})
            cfg = configs.get(pid, empty_cfg)
            base = bases.get(pid)
            out[pid] = [
                self._effective_for_day(day, ov, dyn, cfg, base) for day in days
            ]
        return out

    def _load_overrides_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, dict[str, float]]:
        res = (
            self._db()
            .table("price_overrides")
            .select("property_id, date, price")
            .in_("property_id", property_ids)
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .not_.is_("price", "null")
            .execute()
        ).data or []
        out: dict[str, dict[str, float]] = {}
        for r in res:
            pid, day, price = r.get("property_id"), r.get("date"), _to_float(r.get("price"))
            if isinstance(pid, str) and isinstance(day, str) and price is not None:
                out.setdefault(pid, {})[day] = price
        return out

    def _load_dynamic_bulk(
        self, property_ids: list[str], check_in: date, check_out: date
    ) -> dict[str, dict[str, dict]]:
        # KEIN try/except-Fallback: schlägt die Query fehl, muss der Board-Call
        # hart scheitern (500) statt still leere DP-Preise zu liefern und damit
        # falsche (zu niedrige) Tagespreise anzuzeigen.
        res = (
            self._db()
            .table("dynamic_prices")
            .select("property_id, date, price, factors")
            .in_("property_id", property_ids)
            .gte("date", check_in.isoformat())
            .lt("date", check_out.isoformat())
            .execute()
        ).data or []
        out: dict[str, dict[str, dict]] = {}
        for r in res:
            pid, day, price = r.get("property_id"), r.get("date"), _to_float(r.get("price"))
            if isinstance(pid, str) and isinstance(day, str) and price is not None:
                factors = r.get("factors")
                out.setdefault(pid, {})[day] = {
                    "price": price,
                    "factors": factors if isinstance(factors, dict) else None,
                }
        return out

    def _load_config_bulk(self, property_ids: list[str]) -> dict[str, _PricingConfig]:
        # KEIN try/except-Fallback: ein Query-Fehler muss den Board-Call scheitern
        # lassen (500), nicht still eine leere Preis-Konfig unterstellen.
        res = (
            self._db()
            .table("property_pricing_config")
            .select("*")
            .in_("property_id", property_ids)
            .execute()
        ).data or []
        return {
            r["property_id"]: _PricingConfig(r)
            for r in res
            if isinstance(r.get("property_id"), str)
        }

    def _load_rate_plan_bulk(
        self, property_ids: list[str]
    ) -> dict[str, float | None]:
        """Basispreis je Objekt (erster Rate-Plan). Bei mehreren Plänen gewinnt der
        älteste (created_at) — wie der Einzelpfad `_load_rate_plan`."""
        res = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, float | None] = {}
        for r in res:
            pid = r.get("property_id")
            if isinstance(pid, str) and pid not in out:  # erster = ältester
                out[pid] = _to_float(r.get("base_price"))
        return out

    # -- Vollständiger Quote --------------------------------------------------
    def quote(self, req: QuoteRequest) -> QuoteResponse:
        """Vollständige Preisaufschlüsselung. Reihenfolge:

        1) Pro Nacht: Effektivpreis (override>weekday>base). Längenpreis verdrängt
           den Basispreis, wenn genug Nächte. Kurzaufenthalts-Aufschlag bei kurzen
           Aufenthalten. Extra-Gast-Aufschlag pro Nacht ab dem konfigurierten Gast.
        2) Kanal-Markup auf die Übernachtungssumme (direct = 0).
        3) Gebühren (fest/pro Nacht/pro Gast).
        4) Aktion (prozentualer Rabatt) auf Zwischensumme.
        5) Steuern (prozentual oder fest; im Preis enthaltene Steuern nicht addiert).
        """
        nights = _nights(req.check_in, req.check_out)
        n = len(nights)
        config = self._load_config(req.property_id)
        base, rp_currency = self._load_rate_plan(req.property_id)
        overrides = self._load_overrides(req.property_id, req.check_in, req.check_out)
        dynamic = self._load_dynamic(req.property_id, req.check_in, req.check_out)
        currency = config.currency or rp_currency or ""

        # 1) Übernachtungssumme aus Effektiv-Tagespreisen.
        per_day = [
            self._effective_for_day(day, overrides, dynamic, config, base)
            for day in nights
        ]
        priced = [d.price for d in per_day if d.price is not None]
        priceless = len(priced) == 0
        # Längenpreis verdrängt nur den Basispreis-Anteil (nicht Overrides/Weekday).
        length_pn = config.length_price_per_night(n)
        nightly_total = 0.0
        for d in per_day:
            if d.price is None:
                continue
            if d.source == "base" and length_pn is not None:
                nightly_total += length_pn
            else:
                nightly_total += d.price

        lines: list[QuoteLine] = []
        if nightly_total > 0 or not priceless:
            label = f"Übernachtung ({n} Nacht{'e' if n != 1 else ''})"
            lines.append(
                QuoteLine(label=label, amount=round(nightly_total, 2), kind="lodging")
            )

        # Kurzaufenthalts-Aufschlag (pro Nacht), wenn Aufenthalt kurz genug.
        if (
            config.short_stay_max_nights > 0
            and n <= config.short_stay_max_nights
            and config.short_stay_surcharge > 0
        ):
            surcharge = config.short_stay_surcharge * n
            nightly_total += surcharge
            lines.append(
                QuoteLine(
                    label="Kurzaufenthalts-Aufschlag",
                    amount=round(surcharge, 2),
                    kind="surcharge",
                )
            )

        # Extra-Gast-Aufschlag pro Nacht ab dem konfigurierten Gast.
        extra_guests = max(0, req.guests - (config.extra_guest_from - 1))
        if config.extra_guest_charge > 0 and extra_guests > 0:
            extra = config.extra_guest_charge * extra_guests * n
            nightly_total += extra
            lines.append(
                QuoteLine(
                    label=f"Aufschlag {extra_guests} weitere(r) Gast/Gäste",
                    amount=round(extra, 2),
                    kind="surcharge",
                )
            )

        # 2) Kanal-Markup (nur externe Kanäle; direct = 0).
        markup_pct = config.markup_pct(req.channel)
        if markup_pct != 0 and nightly_total > 0:
            markup = nightly_total * markup_pct / 100.0
            nightly_total += markup
            sign = "Aufschlag" if markup > 0 else "Abschlag"
            lines.append(
                QuoteLine(
                    label=f"Kanal-{sign} ({markup_pct:g}%)",
                    amount=round(markup, 2),
                    kind="surcharge",
                )
            )

        subtotal = nightly_total

        # 3) Gebühren. Eigener USt-Satz (fees[].taxRate, z. B. Frühstück 19 %)
        # wandert als Snapshot in die Zeile — die Rechnung nutzt ihn später
        # vorrangig vor dem Übernachtungssatz.
        for fee in config.fees:
            amount = self._fee_amount(fee, n, req.guests)
            if amount > 0:
                name = str(fee.get("name") or "Gebühr")
                lines.append(
                    QuoteLine(
                        label=name,
                        amount=round(amount, 2),
                        kind="fee",
                        tax_rate=_to_float(fee.get("taxRate")),
                    )
                )
                subtotal += amount

        # 4) Aktion (prozentualer Rabatt auf die bisherige Zwischensumme). Der
        #    Rabatt wird PRO STEUERSATZ aufgeteilt (eine discount-Zeile je Satz mit
        #    dem passenden tax_rate-Snapshot): sonst würde der auf eine höher
        #    besteuerte Gebühr (z. B. Frühstück 19 %) entfallende Rabattanteil mit
        #    dem niedrigeren Übernachtungssatz (z. B. 7 %) gutgeschrieben — falsche
        #    USt auf der Rechnung. tax_rate=None = Übernachtungssatz (die Rechnung
        #    setzt ihn dort ein, wo der Resolver ihn noch nicht kennt).
        for promo in config.promotions:
            pct = _to_float(promo.get("percent")) or 0.0
            if pct <= 0 or subtotal <= 0:
                continue
            name = str(promo.get("name") or "Rabatt")
            # Bisherige POSITIVE Zeilen nach ihrem tax_rate-Snapshot gruppieren
            # (None = Übernachtungssatz). Reihenfolge stabil halten.
            by_rate: dict[float | None, float] = {}
            for ln in lines:
                if ln.amount > 0:
                    by_rate[ln.tax_rate] = by_rate.get(ln.tax_rate, 0.0) + ln.amount
            for rate, base in by_rate.items():
                part = base * pct / 100.0
                if part <= 0:
                    continue
                lines.append(
                    QuoteLine(
                        label=f"{name} (−{pct:g}%)",
                        amount=round(-part, 2),
                        kind="discount",
                        tax_rate=rate,
                    )
                )
            subtotal -= subtotal * pct / 100.0

        # 5) Steuern (nicht im Preis enthaltene werden addiert).
        for tax in config.taxes:
            if bool(tax.get("includedInPrice")):
                continue
            amount = self._tax_amount(tax, subtotal)
            if amount > 0:
                name = str(tax.get("name") or "Steuer")
                lines.append(QuoteLine(label=name, amount=round(amount, 2), kind="tax"))
                subtotal += amount

        # 6) Zusatzleistungen (Upsells): eigene Positionen, je nach Basis + eigener
        #    Steuer (brutto). Beträge serverseitig aus dem Katalog, nie aus Input.
        if req.addons:
            catalog = self._load_addons(
                req.property_id, [a.addon_id for a in req.addons]
            )
            locale = "de"
            for sel in req.addons:
                addon = catalog.get(sel.addon_id)
                if not addon:
                    continue
                _net, gross = addon_total(
                    float(addon.get("price") or 0),
                    str(addon.get("basis") or "per_stay"),
                    (
                        float(addon["tax_rate"])
                        if addon.get("tax_rate") is not None
                        else None
                    ),
                    nights=n,
                    guests=req.guests,
                    qty=sel.qty,
                )
                if gross <= 0:
                    continue
                names = addon.get("name") or {}
                label = names.get(locale) or next(iter(names.values()), "Zusatzleistung")
                if sel.qty > 1:
                    label = f"{label} ×{sel.qty}"
                lines.append(QuoteLine(label=label, amount=gross, kind="addon"))
                subtotal += gross

        total = round(max(0.0, subtotal), 2)
        return QuoteResponse(
            property_id=req.property_id,
            check_in=req.check_in,
            check_out=req.check_out,
            nights=n,
            guests=req.guests,
            channel=req.channel,
            currency=currency,
            nightly_total=round(nightly_total, 2),
            lines=lines,
            total=total,
            priceless=priceless,
        )

    @staticmethod
    def _fee_amount(fee: dict, nights: int, guests: int) -> float:
        amount = _to_float(fee.get("amount")) or 0.0
        basis = str(fee.get("basis") or "per_stay")
        if basis == "per_night":
            return amount * nights
        if basis == "per_guest_stay":
            return amount * guests
        if basis == "per_guest_night":
            return amount * guests * nights
        return amount  # per_stay

    @staticmethod
    def _tax_amount(tax: dict, base: float) -> float:
        value = _to_float(tax.get("value")) or 0.0
        mode = str(tax.get("mode") or "percent")
        if mode == "percent":
            return base * value / 100.0
        return value  # fester Betrag
