"""Reine Aggregation der Objekt-Kennzahlen (Statistiken-Reiter + KPI-Detail).

Ausgelagert aus service.py (hält das Service-Modul unter dem Zeilen-Limit und
trennt die Rechenlogik vom DB-/Scope-Code). Die Funktionen hier sind reine
Funktionen über bereits geladene Reservierungs-Zeilen — der Service besorgt
tenant-/owner-scoped die Daten und die Maskierungs-Info und ruft sie.

Zuordnung zur Periode: über das BUCHUNGSDATUM (`created_at`), wie Lodgify — die
Einnahme zählt am Tag, an dem die Reservierung entstanden ist (nicht am
Anreisetag). So entspricht die Zeitreihe der Lodgify-Kurve.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta

from .schemas import (
    ChannelBreakdown,
    DashboardKpi,
    PropertyStats,
    StatComparePeriod,
    StatMetricDetail,
    StatPoint,
    StatSeries,
)

# Wie viele Vergleichsperioden die KPI-Detailseite zeigt (Lodgify: 4 davor).
_COMPARE_PERIODS = 4

# Deutscher Kurz-Monat für Perioden-Label „10 Mai – 8 Jun".
_MONTHS_DE = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
]


def _as_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _nights(check_in: date, check_out: date) -> int:
    return max(0, (check_out - check_in).days)


def _booked_on(row: dict) -> date:
    """Buchungsdatum (created_at) — die Zuordnung zur Periode/zum Tag."""
    return _as_date(row.get("created_at") or row["check_in"])


def _row_nights(row: dict) -> int:
    return _nights(_as_date(row["check_in"]), _as_date(row["check_out"]))


def _kpi(cur_val: float, prev_val: float) -> DashboardKpi:
    """KPI-Wert + prozentuale Veränderung ggü. der Vorperiode (None ohne
    Vorperioden-Basis — keine erfundenen 0-%-Werte)."""
    if prev_val == 0:
        return DashboardKpi(value=round(cur_val, 2), change_pct=None)
    change = (cur_val - prev_val) / prev_val * 100
    return DashboardKpi(value=round(cur_val, 2), change_pct=round(change, 1))


def _label(lo: date, hi: date) -> str:
    """Perioden-Label wie Lodgify: „10 Mai – 8 Jun"."""
    return f"{lo.day} {_MONTHS_DE[lo.month - 1]} – {hi.day} {_MONTHS_DE[hi.month - 1]}"


# ── Metrik-Definitionen ───────────────────────────────────────────────────────
# Jede zeitreihenfähige Metrik: wie viel trägt EINE Buchung zum Tag ihres
# Buchungsdatums bei, und ist es ein Geldbetrag (→ Maskierung/Währung).
_MetricFn = Callable[[dict], float]

_METRIC_FNS: dict[str, _MetricFn] = {
    "revenue": lambda r: float(r.get("total_amount") or 0),
    "payments_received": lambda r: float(r.get("paid_amount") or 0),
    "hosted_guests": lambda r: float(r.get("num_guests") or 0),
    "booked_nights": lambda r: float(_row_nights(r)),
    "created_reservations": lambda _r: 1.0,
    "cancelled_reservations": lambda r: 1.0 if r.get("status") == "cancelled" else 0.0,
    "cancelled_nights": (
        lambda r: float(_row_nights(r)) if r.get("status") == "cancelled" else 0.0
    ),
}

_MONEY_METRICS = {"revenue", "payments_received"}

# Metriken, die eine eigene KPI-Detailseite (Zeitreihe + Vergleich) haben.
DETAIL_METRICS = frozenset(_METRIC_FNS)


def _daily_series(rows: list[dict], fn: _MetricFn, lo: date, hi: date) -> list[float]:
    """Tageswerte der Metrik von lo..hi (inklusive), Index 0 = lo."""
    span = (hi - lo).days + 1
    out = [0.0] * span
    for r in rows:
        day = _booked_on(r)
        if lo <= day <= hi:
            out[(day - lo).days] += fn(r)
    return out


def _period_sum(rows: list[dict], fn: _MetricFn, lo: date, hi: date) -> float:
    return sum(fn(r) for r in rows if lo <= _booked_on(r) <= hi)


def _channel_breakdown(
    rows: list[dict], lo: date, hi: date, show_money: bool
) -> list[ChannelBreakdown]:
    """Einnahmen + Nächte je Kanal (Donut) für die aktuelle Periode. Beträge
    None ohne Sicht. Nur Buchungen der Periode (Buchungsdatum)."""
    chan: dict[str, dict] = {}
    for r in rows:
        if not lo <= _booked_on(r) <= hi:
            continue
        key = r.get("ota_name") or r.get("channel") or "direct"
        slot = chan.setdefault(
            key,
            {"channel": r.get("channel") or "direct",
             "ota_name": r.get("ota_name"), "amount": 0.0, "nights": 0},
        )
        slot["amount"] += float(r.get("total_amount") or 0)
        slot["nights"] += _row_nights(r)
    return [
        ChannelBreakdown(
            channel=v["channel"],
            ota_name=v["ota_name"],
            amount=round(v["amount"], 2) if show_money else None,
            nights=v["nights"],
        )
        for v in chan.values()
    ]


def _sparkline(
    rows: list[dict], metric: str, lo: date, hi: date, show_money: bool
) -> StatSeries:
    """Tagesreihe einer Metrik für die Kachel-Sparkline. Geld-Metriken ohne
    Betrags-Sicht → leer + visible=False (kein erfundener Wert)."""
    is_money = metric in _MONEY_METRICS
    if is_money and not show_money:
        return StatSeries(metric=metric, visible=False, points=[])
    values = _daily_series(rows, _METRIC_FNS[metric], lo, hi)
    points = [
        StatPoint(date=lo + timedelta(days=i), value=round(v, 2))
        for i, v in enumerate(values)
    ]
    return StatSeries(metric=metric, visible=True, points=points)


def compute_property_stats(
    *,
    property_id: str,
    property_title: str,
    rows: list[dict],
    date_from: date,
    date_to: date,
    show_amounts: bool,
    property_count: int = 1,
) -> PropertyStats:
    """Alle KPIs + Kanal-Verteilung + Sparkline-Zeitreihen aus Reservierungs-Zeilen.

    Für EIN Objekt (`property_count=1`, Statistiken-Reiter) ODER tenant-weit über
    mehrere Objekte (Kontrollzentrum-Startseite): dieselbe Rechenlogik, nur die
    Belegungsrate teilt durch die Perioden-Tage × Objektanzahl (sonst würden N
    Objekte >100 % ergeben). Alle anderen KPIs summieren/mitteln sich korrekt.

    `show_amounts` = Betrags-Sichtbarkeit (mask.amounts). Betrags-KPIs sind None,
    wenn keine Betrags-Sichtbarkeit ODER gemischte Währungen vorliegen (keine
    Mischsumme). Die Vorperiode ist gleich lang und liegt direkt davor. Periode +
    Sparkline nutzen das Buchungsdatum (created_at) — wie Lodgify.
    """
    currencies = {r["currency"] for r in rows if r.get("currency")}
    currency = next(iter(currencies)) if len(currencies) == 1 else ""
    show_money = show_amounts and len(currencies) == 1

    span = (date_to - date_from).days + 1
    prev_from = date_from - timedelta(days=span)
    prev_to = date_from - timedelta(days=1)
    today = date.today()

    active = [r for r in rows if r.get("status") != "cancelled"]

    def cur_sum(metric: str, source: list[dict] | None = None) -> float:
        return _period_sum(source or active, _METRIC_FNS[metric], date_from, date_to)

    def prev_sum(metric: str, source: list[dict] | None = None) -> float:
        return _period_sum(source or active, _METRIC_FNS[metric], prev_from, prev_to)

    cur_res = [r for r in active if date_from <= _booked_on(r) <= date_to]
    prev_res = [r for r in active if prev_from <= _booked_on(r) <= prev_to]
    cur_nights = cur_sum("booked_nights")
    prev_nights = prev_sum("booked_nights")
    cur_rev = cur_sum("revenue")
    prev_rev = prev_sum("revenue")
    n_cur, n_prev = len(cur_res), len(prev_res)

    revenue_kpi = _kpi(cur_rev, prev_rev) if show_money else None
    payments_kpi = (
        _kpi(cur_sum("payments_received"), prev_sum("payments_received"))
        if show_money
        else None
    )
    avg_booking_kpi = (
        _kpi(cur_rev / n_cur if n_cur else 0, prev_rev / n_prev if n_prev else 0)
        if show_money
        else None
    )
    avg_price_night_kpi = (
        _kpi(
            cur_rev / cur_nights if cur_nights else 0,
            prev_rev / prev_nights if prev_nights else 0,
        )
        if show_money
        else None
    )

    # Belegungsrate = belegte Nächte / (Perioden-Tage × Objektanzahl) in Prozent.
    # Bei einem Objekt count=1; tenant-weit über mehrere Objekte durch count
    # geteilt, sonst summieren sich mehrere Objekte über 100 %.
    capacity = span * max(property_count, 1)
    occ_cur = (cur_nights / capacity * 100) if capacity else 0
    occ_prev = (prev_nights / capacity * 100) if capacity else 0

    # Tage im Voraus gebucht = weiteste zukünftige Anreise ab heute.
    ahead = [
        (_as_date(r["check_in"]) - today).days
        for r in active
        if _as_date(r["check_in"]) >= today
    ]
    days_ahead = max(ahead) if ahead else 0

    series = [
        _sparkline(rows, m, date_from, date_to, show_money) for m in _METRIC_FNS
    ]

    return PropertyStats(
        property_id=property_id,
        property_title=property_title,
        currency=currency if show_amounts else "",
        date_from=date_from,
        date_to=date_to,
        revenue=revenue_kpi,
        payments_received=payments_kpi,
        avg_booking_value=avg_booking_kpi,
        avg_price_per_night=avg_price_night_kpi,
        hosted_guests=_kpi(cur_sum("hosted_guests"), prev_sum("hosted_guests")),
        booked_nights=_kpi(cur_nights, prev_nights),
        occupancy_rate=_kpi(occ_cur, occ_prev),
        days_booked_ahead=DashboardKpi(value=days_ahead, change_pct=None),
        avg_stay_length=_kpi(
            cur_nights / n_cur if n_cur else 0,
            prev_nights / n_prev if n_prev else 0,
        ),
        created_reservations=_kpi(n_cur, n_prev),
        cancelled_reservations=_kpi(
            cur_sum("cancelled_reservations", rows),
            prev_sum("cancelled_reservations", rows),
        ),
        cancelled_nights=_kpi(
            cur_sum("cancelled_nights", rows), prev_sum("cancelled_nights", rows)
        ),
        by_channel=_channel_breakdown(cur_res, date_from, date_to, show_money),
        series=series,
    )


def compute_metric_detail(
    *,
    rows: list[dict],
    metric: str,
    date_from: date,
    date_to: date,
    show_amounts: bool,
) -> StatMetricDetail:
    """KPI-Detailseite (Lodgify): Tagesreihe der aktuellen Periode + vier gleich
    lange Vergleichsperioden davor (mit %-Vergleich) + Breakout-Matrix.

    Geld-Metriken ohne Betrags-Sicht → visible=False, leere Reihen (keine
    erfundenen Werte). Nicht-Geld-Metriken sind immer sichtbar."""
    currencies = {r["currency"] for r in rows if r.get("currency")}
    currency = next(iter(currencies)) if len(currencies) == 1 else ""
    is_money = metric in _MONEY_METRICS
    show_money = show_amounts and len(currencies) == 1
    fn = _METRIC_FNS[metric]

    span = (date_to - date_from).days + 1

    if is_money and not show_money:
        return StatMetricDetail(
            metric=metric, is_money=True, visible=False,
            currency=currency if show_amounts else "",
            date_from=date_from, date_to=date_to,
        )

    # Aktuelle Periode als Tagesreihe.
    cur_daily = _daily_series(rows, fn, date_from, date_to)
    series = [
        StatPoint(date=date_from + timedelta(days=i), value=round(v, 2))
        for i, v in enumerate(cur_daily)
    ]
    cur_total = round(sum(cur_daily), 2)

    # Bis zu vier gleich lange Vergleichsperioden direkt davor.
    periods: list[StatComparePeriod] = []
    breakout: list[list[float]] = [[round(v, 2) for v in cur_daily]]
    lo, hi = date_from, date_to
    for _ in range(_COMPARE_PERIODS):
        hi = lo - timedelta(days=1)
        lo = hi - timedelta(days=span - 1)
        p_daily = _daily_series(rows, fn, lo, hi)
        p_total = round(sum(p_daily), 2)
        change = None
        if p_total != 0:
            change = round((cur_total - p_total) / p_total * 100, 2)
        periods.append(
            StatComparePeriod(
                label=_label(lo, hi), date_from=lo, date_to=hi,
                value=p_total, change_pct=change,
            )
        )
        breakout.append([round(v, 2) for v in p_daily])

    return StatMetricDetail(
        metric=metric, is_money=is_money, visible=True,
        currency=currency if show_amounts else "",
        date_from=date_from, date_to=date_to,
        series=series, periods=periods, breakout=breakout,
    )
