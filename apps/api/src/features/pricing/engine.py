"""Dynamic-Pricing-Regel-Engine (Phase 1, ohne Marktdaten).

REINE Funktionen: gegebene Inputs (Basispreis, Settings, Signale je Tag) →
deterministischer Preis + Min-Stay. Keine DB-, Zeit- oder Netzzugriffe — damit
vollständig unit-testbar. Der Recompute-Service (recompute.py) lädt die Quellen
und ruft diese Engine pro Tag auf.

Modell: multiplikativ auf den Basispreis. Jeder Faktor ist ein nachvollziehbarer
Multiplikator (1.0 = neutral). Reihenfolge ist kommutativ (Produkt), das Ergebnis
wird am Ende auf [min_price, max_price] geklammert (falls gesetzt).

Faktoren (Phase 1):
  * Saison       — Aufschlag-% aus der zugewiesenen Saison-Periode.
  * Event        — Aufschlag-% aus einer Event-Periode (additiv zur Saison).
  * Wochenende   — weekend_uplift_pct an Fr/Sa.
  * Auslastung   — Belegung im Horizont vs. Schwelle → Auf/Abschlag, skaliert
                   über occupancy_sensitivity.
  * Lead-Time    — Last-Minute-Rabatt nach Tagen bis Anreise (last_minute-Regeln).
  * Orphan-Gap   — 1–2-Nächte-Lücke zwischen Belegungen → Rabatt (Lückenfüllung).

Min-Stay je Tag: aus der Auslastung — bei hoher Nachfrage längerer Mindest-
aufenthalt, begrenzt durch [min_stay_min, min_stay_max].
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class DpSettings:
    """Dynamic-Pricing-Konfiguration eines Objekts (aus dp_settings)."""

    enabled: bool = False
    min_price: float | None = None
    max_price: float | None = None
    weekend_uplift_pct: float = 15.0
    last_minute: list[dict] = field(default_factory=list)
    orphan_gap_discount_pct: float = 15.0
    occupancy_sensitivity: float = 30.0
    min_stay_min: int = 1
    min_stay_max: int = 7

    @staticmethod
    def from_row(row: dict | None) -> DpSettings:
        row = row or {}
        lm = row.get("last_minute")
        return DpSettings(
            enabled=bool(row.get("enabled")),
            min_price=_opt_float(row.get("min_price")),
            max_price=_opt_float(row.get("max_price")),
            weekend_uplift_pct=_as_float(row.get("weekend_uplift_pct"), 15.0),
            last_minute=[r for r in (lm or []) if isinstance(r, dict)],
            orphan_gap_discount_pct=_as_float(row.get("orphan_gap_discount_pct"), 15.0),
            occupancy_sensitivity=_as_float(row.get("occupancy_sensitivity"), 30.0),
            min_stay_min=int(row.get("min_stay_min") or 1),
            min_stay_max=int(row.get("min_stay_max") or 7),
        )


@dataclass
class DaySignals:
    """Pro-Tag-Signale, die der Recompute-Service aus DB-Daten ableitet."""

    day: date
    # Saison-/Event-Aufschlag in Prozent (0 = kein Aufschlag).
    season_pct: float = 0.0
    event_pct: float = 0.0
    # Auslastung im Horizont (0..1): Anteil belegter Tage. None = unbekannt.
    occupancy: float | None = None
    # Tage bis zu diesem Tag (Lead-Time); negativ/0 = heute/Vergangenheit.
    days_before: int = 365
    # True, wenn dieser Tag Teil einer 1–2-Nächte-Lücke zwischen Belegungen ist.
    is_orphan_gap: bool = False


@dataclass
class DayResult:
    """Engine-Ergebnis für einen Tag."""

    price: float
    min_stay: int
    # Multiplikatoren für Transparenz/Debug (nicht persistiert).
    factors: dict[str, float]


# Auslastungsschwelle: darüber Aufschlag, darunter Abschlag (neutral bei 0.5).
_OCCUPANCY_PIVOT = 0.5


def _as_float(value: object, default: float) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _opt_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _weekend_factor(day: date, settings: DpSettings) -> float:
    """Fr (4) und Sa (5) bekommen den Wochenend-Aufschlag."""
    if day.weekday() in (4, 5) and settings.weekend_uplift_pct:
        return 1.0 + settings.weekend_uplift_pct / 100.0
    return 1.0


def _occupancy_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Auslastung → Auf/Abschlag. Bei occupancy=None neutral (kein Signal).

    occupancy 1.0 (voll) → +sensitivity%, occupancy 0.0 (leer) → −sensitivity%,
    linear um den Pivot 0.5. So füllt niedrige Belegung über günstigere Preise,
    hohe Belegung hebt den Preis."""
    if signals.occupancy is None or settings.occupancy_sensitivity <= 0:
        return 1.0
    delta = (signals.occupancy - _OCCUPANCY_PIVOT) / _OCCUPANCY_PIVOT  # -1..+1
    return 1.0 + delta * settings.occupancy_sensitivity / 100.0


def _last_minute_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Last-Minute-Rabatt: stärkster passender Rabatt (kleinste days_before-Schwelle,
    die >= den Tagen bis Anreise liegt). Vergangene Tage (<=0) bleiben neutral."""
    if signals.days_before <= 0 or not settings.last_minute:
        return 1.0
    best_discount = 0.0
    best_threshold: int | None = None
    for rule in settings.last_minute:
        threshold = int(rule.get("days_before") or 0)
        discount = _as_float(rule.get("discount_pct"), 0.0)
        if threshold <= 0 or signals.days_before > threshold:
            continue
        # Engste passende Schwelle gewinnt (z. B. 3 Tage > 7 Tage).
        if best_threshold is None or threshold < best_threshold:
            best_threshold = threshold
            best_discount = discount
    return 1.0 - best_discount / 100.0


def _orphan_factor(signals: DaySignals, settings: DpSettings) -> float:
    """1–2-Nächte-Lücke → Rabatt, um die Lücke füllbar zu machen."""
    if signals.is_orphan_gap and settings.orphan_gap_discount_pct:
        return 1.0 - settings.orphan_gap_discount_pct / 100.0
    return 1.0


def _dynamic_min_stay(signals: DaySignals, settings: DpSettings) -> int:
    """Min-Stay aus der Auslastung: hohe Nachfrage → längerer Mindestaufenthalt,
    begrenzt durch [min_stay_min, min_stay_max]. Ohne Signal = min_stay_min."""
    lo = max(1, settings.min_stay_min)
    hi = max(lo, settings.min_stay_max)
    if signals.occupancy is None:
        return lo
    # occupancy 0..1 linear auf [lo, hi].
    span = hi - lo
    return lo + round(span * max(0.0, min(1.0, signals.occupancy)))


def compute_day(base: float, settings: DpSettings, signals: DaySignals) -> DayResult:
    """Dynamischen Preis + Min-Stay für einen Tag berechnen (rein/deterministisch).

    base = Basispreis (rate_plan). Multiplikatives Modell, danach Clamp auf
    [min_price, max_price] (falls gesetzt)."""
    factors = {
        "season": 1.0 + signals.season_pct / 100.0,
        "event": 1.0 + signals.event_pct / 100.0,
        "weekend": _weekend_factor(signals.day, settings),
        "occupancy": _occupancy_factor(signals, settings),
        "last_minute": _last_minute_factor(signals, settings),
        "orphan": _orphan_factor(signals, settings),
    }
    price = base
    for f in factors.values():
        price *= f

    if settings.min_price is not None:
        price = max(price, settings.min_price)
    if settings.max_price is not None:
        price = min(price, settings.max_price)

    return DayResult(
        price=round(price, 2),
        min_stay=_dynamic_min_stay(signals, settings),
        factors=factors,
    )
