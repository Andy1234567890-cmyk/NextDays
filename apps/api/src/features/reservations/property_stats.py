"""Reine Aggregation der Objekt-Kennzahlen (Statistiken-Reiter).

Ausgelagert aus service.py (hält das Service-Modul unter dem Zeilen-Limit und
trennt die Rechenlogik vom DB-/Scope-Code). `compute_property_stats` ist eine
reine Funktion über bereits geladene Reservierungs-Zeilen — der Service besorgt
tenant-/owner-scoped die Daten und die Maskierungs-Info und ruft diese Funktion.
"""
from __future__ import annotations

from datetime import date, timedelta

from .schemas import ChannelBreakdown, DashboardKpi, PropertyStats


def _as_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _nights(check_in: date, check_out: date) -> int:
    return max(0, (check_out - check_in).days)


def _kpi(cur_val: float, prev_val: float) -> DashboardKpi:
    """KPI-Wert + prozentuale Veränderung ggü. der Vorperiode (None ohne
    Vorperioden-Basis — keine erfundenen 0-%-Werte)."""
    if prev_val == 0:
        return DashboardKpi(value=round(cur_val, 2), change_pct=None)
    change = (cur_val - prev_val) / prev_val * 100
    return DashboardKpi(value=round(cur_val, 2), change_pct=round(change, 1))


def _in_period(row: dict, lo: date, hi: date) -> bool:
    """Der Anreisetag ordnet die Buchung der Periode zu (wie das Dashboard)."""
    return lo <= _as_date(row["check_in"]) <= hi


def _revenue(rows: list[dict]) -> float:
    return sum(float(r.get("total_amount") or 0) for r in rows)


def _payments(rows: list[dict]) -> float:
    return sum(float(r.get("paid_amount") or 0) for r in rows)


def _guests(rows: list[dict]) -> int:
    return sum(int(r.get("num_guests") or 0) for r in rows)


def _nights_sum(rows: list[dict]) -> int:
    return sum(_nights(_as_date(r["check_in"]), _as_date(r["check_out"])) for r in rows)


def _channel_breakdown(rows: list[dict], show_money: bool) -> list[ChannelBreakdown]:
    """Einnahmen + Nächte je Kanal (Donut-Diagramme). Beträge None ohne Sicht."""
    chan: dict[str, dict] = {}
    for r in rows:
        key = r.get("ota_name") or r.get("channel") or "direct"
        slot = chan.setdefault(
            key,
            {"channel": r.get("channel") or "direct",
             "ota_name": r.get("ota_name"), "amount": 0.0, "nights": 0},
        )
        slot["amount"] += float(r.get("total_amount") or 0)
        slot["nights"] += _nights(_as_date(r["check_in"]), _as_date(r["check_out"]))
    return [
        ChannelBreakdown(
            channel=v["channel"],
            ota_name=v["ota_name"],
            amount=round(v["amount"], 2) if show_money else None,
            nights=v["nights"],
        )
        for v in chan.values()
    ]


def compute_property_stats(
    *,
    property_id: str,
    property_title: str,
    rows: list[dict],
    date_from: date,
    date_to: date,
    show_amounts: bool,
) -> PropertyStats:
    """Alle KPIs + Kanal-Verteilung aus den Reservierungen EINES Objekts.

    `show_amounts` = Betrags-Sichtbarkeit (mask.amounts). Betrags-KPIs sind None,
    wenn keine Betrags-Sichtbarkeit ODER gemischte Währungen vorliegen (keine
    Mischsumme). Die Vorperiode ist gleich lang und liegt direkt davor.
    """
    currencies = {r["currency"] for r in rows if r.get("currency")}
    currency = next(iter(currencies)) if len(currencies) == 1 else ""
    show_money = show_amounts and len(currencies) == 1

    span = (date_to - date_from).days + 1
    prev_from = date_from - timedelta(days=span)
    prev_to = date_from - timedelta(days=1)
    today = date.today()

    active = [r for r in rows if r.get("status") != "cancelled"]
    cur = [r for r in active if _in_period(r, date_from, date_to)]
    prev = [r for r in active if _in_period(r, prev_from, prev_to)]

    cur_nights = _nights_sum(cur)
    prev_nights = _nights_sum(prev)
    cur_rev = _revenue(cur)
    prev_rev = _revenue(prev)

    revenue_kpi = _kpi(cur_rev, prev_rev) if show_money else None
    payments_kpi = _kpi(_payments(cur), _payments(prev)) if show_money else None
    avg_booking_kpi = (
        _kpi(cur_rev / len(cur) if cur else 0, prev_rev / len(prev) if prev else 0)
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

    # Belegungsrate = belegte Nächte / Perioden-Tage (ein Objekt) in Prozent.
    occ_cur = (cur_nights / span * 100) if span else 0
    occ_prev = (prev_nights / span * 100) if span else 0

    # Tage im Voraus gebucht = weiteste zukünftige Anreise ab heute.
    ahead = [
        (_as_date(r["check_in"]) - today).days
        for r in active
        if _as_date(r["check_in"]) >= today
    ]
    days_ahead = max(ahead) if ahead else 0

    cancelled = [r for r in rows if r.get("status") == "cancelled"]
    cancelled_cur = [r for r in cancelled if _in_period(r, date_from, date_to)]
    cancelled_prev = [r for r in cancelled if _in_period(r, prev_from, prev_to)]

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
        hosted_guests=_kpi(_guests(cur), _guests(prev)),
        booked_nights=_kpi(cur_nights, prev_nights),
        occupancy_rate=_kpi(occ_cur, occ_prev),
        days_booked_ahead=DashboardKpi(value=days_ahead, change_pct=None),
        avg_stay_length=_kpi(
            cur_nights / len(cur) if cur else 0,
            prev_nights / len(prev) if prev else 0,
        ),
        created_reservations=_kpi(len(cur), len(prev)),
        cancelled_reservations=_kpi(len(cancelled_cur), len(cancelled_prev)),
        cancelled_nights=_kpi(_nights_sum(cancelled_cur), _nights_sum(cancelled_prev)),
        by_channel=_channel_breakdown(cur, show_money),
    )
