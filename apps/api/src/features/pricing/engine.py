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

# Aggressivität (Hostaway-Modell): Dämpfer/Verstärker auf die abweichungs-
# basierten Faktoren (Auslastung + Markt). Konservativ reagiert sanfter auf
# Markt-/Auslastungs-Schwankungen, aggressiv stärker; empfohlen = neutral.
_AGGRESSIVENESS = {
    "conservative": 0.5,
    "recommended": 1.0,
    "aggressive": 1.5,
}


@dataclass
class DpSettings:
    """Dynamic-Pricing-Konfiguration eines Objekts (aus dp_settings)."""

    enabled: bool = False
    # RateBoard-Autopilot: berechnete Preise automatisch scharf schalten (an die
    # Kanäle pushen). False = nur Empfehlung (in dynamic_prices/Vorschau sichtbar,
    # aber kein OTA-Push). enabled steuert das Rechnen, autopilot das Veröffentlichen.
    autopilot_enabled: bool = False
    min_price: float | None = None
    max_price: float | None = None
    weekend_uplift_pct: float = 15.0
    last_minute: list[dict] = field(default_factory=list)
    orphan_gap_discount_pct: float = 15.0
    occupancy_sensitivity: float = 30.0
    min_stay_min: int = 1
    min_stay_max: int = 7
    # Phase 2: Markt-/Wettbewerbs-Signal (opt-in zusätzlich zu enabled).
    market_enabled: bool = False
    market_sensitivity: float = 20.0
    market_max_adjust_pct: float = 25.0
    # Hostaway-Modell: Basispreis-Modus + Aggressivität.
    base_mode: str = "data_driven"  # 'data_driven' | 'manual'
    base_rate_mode: str = "recommended"  # 'conservative' | 'recommended' | 'aggressive'
    manual_base_price: float | None = None
    # Roadmap-Phase 1 — auslastungsbasierte Best Practices der Wettbewerber:
    # Asymmetrische Deckelung des Auslastungs-Faktors (Rabatte aggressiver als
    # Aufschläge; PriceLabs-Default −20 % / +15 %). 0/None = kein eigener Cap.
    occupancy_discount_cap_pct: float = 20.0
    occupancy_premium_cap_pct: float = 15.0
    # Vorlauf-Buckets: der Auslastungs-Faktor wirkt je nach Tagen-bis-Anreise
    # unterschiedlich stark (nahe Termine reagieren stärker, „horizontal
    # occupancy"). Liste {max_days_before, weight}: das erste Bucket, dessen
    # max_days_before >= days_before, gewichtet den Auslastungs-Faktor. Leer =
    # keine Bucket-Dämpfung (Gewicht 1.0, Verhalten wie zuvor).
    occupancy_lead_buckets: list[dict] = field(default_factory=list)
    # RateBoard-Baustein — Wetter als externer Nachfrage-Faktor (opt-in). Gutes
    # Wetter am Anreisetag → Aufschlag, schlechtes → leichter Rabatt. weather_max_
    # adjust_pct deckelt die Wirkung symmetrisch. 0/aus = kein Wetter-Effekt.
    weather_enabled: bool = False
    weather_max_adjust_pct: float = 10.0
    # Rate Rules — manuelle Zusatzregeln des Vermieters (KI + Fachwissen). Jede
    # Regel: {match:{...}, adjust_pct: float}. Greifen NACH den gelernten Faktoren
    # als zusätzliche Auf-/Abschläge (siehe _rate_rules_factor). Leer = keine.
    rate_rules: list[dict] = field(default_factory=list)

    @property
    def aggressiveness(self) -> float:
        """Faktor-Multiplikator aus base_rate_mode (Default neutral 1.0)."""
        return _AGGRESSIVENESS.get(self.base_rate_mode, 1.0)

    def effective_base(self, rate_plan_base: float) -> float:
        """Basispreis (Anker): bei 'manual' der gesetzte Wert, sonst rate_plan."""
        if self.base_mode == "manual" and self.manual_base_price is not None:
            return self.manual_base_price
        return rate_plan_base

    @staticmethod
    def from_row(row: dict | None) -> DpSettings:
        row = row or {}
        lm = row.get("last_minute")
        return DpSettings(
            enabled=bool(row.get("enabled")),
            autopilot_enabled=bool(row.get("autopilot_enabled")),
            min_price=_opt_float(row.get("min_price")),
            max_price=_opt_float(row.get("max_price")),
            weekend_uplift_pct=_as_float(row.get("weekend_uplift_pct"), 15.0),
            last_minute=[r for r in (lm or []) if isinstance(r, dict)],
            orphan_gap_discount_pct=_as_float(row.get("orphan_gap_discount_pct"), 15.0),
            occupancy_sensitivity=_as_float(row.get("occupancy_sensitivity"), 30.0),
            min_stay_min=int(row.get("min_stay_min") or 1),
            min_stay_max=int(row.get("min_stay_max") or 7),
            market_enabled=bool(row.get("market_enabled")),
            market_sensitivity=_as_float(row.get("market_sensitivity"), 20.0),
            market_max_adjust_pct=_as_float(row.get("market_max_adjust_pct"), 25.0),
            base_mode=_as_choice(row.get("base_mode"), ("data_driven", "manual"), "data_driven"),
            base_rate_mode=_as_choice(
                row.get("base_rate_mode"),
                ("conservative", "recommended", "aggressive"),
                "recommended",
            ),
            manual_base_price=_opt_float(row.get("manual_base_price")),
            occupancy_discount_cap_pct=_as_float(
                row.get("occupancy_discount_cap_pct"), 20.0
            ),
            occupancy_premium_cap_pct=_as_float(
                row.get("occupancy_premium_cap_pct"), 15.0
            ),
            occupancy_lead_buckets=[
                r for r in (row.get("occupancy_lead_buckets") or []) if isinstance(r, dict)
            ],
            weather_enabled=bool(row.get("weather_enabled")),
            weather_max_adjust_pct=_as_float(row.get("weather_max_adjust_pct"), 10.0),
            rate_rules=[
                r for r in (row.get("rate_rules") or []) if isinstance(r, dict)
            ],
        )


@dataclass
class DaySignals:
    """Pro-Tag-Signale, die der Recompute-Service aus DB-Daten ableitet."""

    day: date
    # Saison-/Event-Aufschlag in Prozent (0 = kein Aufschlag).
    #
    # ACHTUNG season_pct: der Recompute-Service setzt das Feld seit 0252 NICHT
    # mehr. Die benannten Saisons des Objekts (property_seasons) wirken auf einem
    # anderen Weg — calendar._materialize schreibt ihre Tagespreise direkt nach
    # price_overrides. Wer sie ZUSAETZLICH hier einspeist, zaehlt denselben
    # Aufschlag doppelt. Das Feld bleibt als Engine-Eingang erhalten (die Engine
    # ist eine reine Funktion und wird so getestet), hat aber derzeit keinen
    # Produzenten.
    season_pct: float = 0.0
    event_pct: float = 0.0
    # Auslastung im Horizont (0..1): Anteil belegter Tage. None = unbekannt.
    occupancy: float | None = None
    # Tage bis zu diesem Tag (Lead-Time); negativ/0 = heute/Vergangenheit.
    days_before: int = 365
    # True, wenn dieser Tag Teil einer 1–2-Nächte-Lücke zwischen Belegungen ist.
    is_orphan_gap: bool = False
    # Phase 2 — Markt-Signale (None = kein Signal → neutral):
    comp_price: float | None = None       # Median vergleichbarer Objekte
    demand_index: float | None = None     # Marktnachfrage 0..1
    market_event_pct: float | None = None  # Markt-Event-Aufschlag (%)
    # Roadmap-Phase 2 — Pickup-Velocity: relative Buchungsgeschwindigkeit dieses
    # Anreisedatums gegenüber dem Erwartungswert. >0 = bucht sich schneller als
    # normal (Frühindikator für Nachfrage → Aufschlag), <0 = langsamer, None =
    # kein Signal (neutral). Skala grob −1..+1 (gedeckelt im Faktor).
    pickup_velocity: float | None = None
    # RateBoard-Baustein — Wetter-Score (externer Nachfrage-Faktor) für dieses
    # Anreisedatum. Grob −1..+1: >0 = überdurchschnittlich gutes Wetter (mehr
    # Nachfrage → Aufschlag), <0 = schlechtes Wetter, None = kein Signal (z. B.
    # Datum außerhalb des Wetter-Forecast-Horizonts → neutral, keine Fallbacks).
    weather_score: float | None = None


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


def _as_choice(value: object, allowed: tuple[str, ...], default: str) -> str:
    """Enum-Wert aus DB defensiv übernehmen (unbekannt → Default, kein Erfinden)."""
    s = str(value) if value is not None else ""
    return s if s in allowed else default


def _weekend_factor(day: date, settings: DpSettings) -> float:
    """Fr (4) und Sa (5) bekommen den Wochenend-Aufschlag."""
    if day.weekday() in (4, 5) and settings.weekend_uplift_pct:
        return 1.0 + settings.weekend_uplift_pct / 100.0
    return 1.0


def _lead_bucket_weight(days_before: int, settings: DpSettings) -> float:
    """Vorlauf-Gewicht für den Auslastungs-Faktor (Roadmap-Phase 1, „horizontal
    occupancy"). Nahe Termine reagieren stärker auf die Belegung als ferne. Das
    erste Bucket mit max_days_before >= days_before liefert sein Gewicht; ohne
    konfigurierte Buckets oder ohne Treffer gilt 1.0 (Verhalten wie zuvor)."""
    buckets = settings.occupancy_lead_buckets
    if not buckets:
        return 1.0
    db = max(0, days_before)
    best: tuple[int, float] | None = None
    for b in sorted(
        buckets, key=lambda x: _as_float(x.get("max_days_before"), 1e9)
    ):
        cap = _as_float(b.get("max_days_before"), -1.0)
        if cap < 0:
            continue
        if db <= cap:
            return _as_float(b.get("weight"), 1.0)
        best = (int(cap), _as_float(b.get("weight"), 1.0))
    # Über allen Buckets → Gewicht des größten Buckets (fernster Vorlauf).
    return best[1] if best else 1.0


def _occupancy_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Auslastung → Auf/Abschlag. Bei occupancy=None neutral (kein Signal).

    occupancy 1.0 (voll) → Aufschlag, occupancy 0.0 (leer) → Rabatt, linear um
    den Pivot 0.5, skaliert über sensitivity × Aggressivität × Vorlauf-Gewicht.
    Roadmap-Phase 1: asymmetrische Deckelung — Rabatte bis occupancy_discount_cap,
    Aufschläge bis occupancy_premium_cap (Wettbewerber-Best-Practice: füllen
    wichtiger als abschöpfen)."""
    if signals.occupancy is None or settings.occupancy_sensitivity <= 0:
        return 1.0
    delta = (signals.occupancy - _OCCUPANCY_PIVOT) / _OCCUPANCY_PIVOT  # -1..+1
    weight = _lead_bucket_weight(signals.days_before, settings)
    adjust = delta * settings.occupancy_sensitivity / 100.0 * settings.aggressiveness * weight
    return _cap_adjust(
        adjust,
        settings.occupancy_discount_cap_pct,
        settings.occupancy_premium_cap_pct,
    )


def _pickup_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Pickup-Velocity → Aufschlag/Rabatt (Roadmap-Phase 2, Beyond/Wheelhouse).

    Bucht sich ein Datum schneller als der Erwartungswert (velocity > 0), steigt
    der Preis früh — antizipativ, bevor die Belegung hoch ist. Langsamer Pickup
    senkt ihn leicht. Nutzt dieselbe sensitivity/Aggressivität und dieselbe
    asymmetrische Deckelung wie der Auslastungs-Faktor. None = neutral."""
    if signals.pickup_velocity is None or settings.occupancy_sensitivity <= 0:
        return 1.0
    v = max(-1.0, min(1.0, signals.pickup_velocity))
    adjust = v * settings.occupancy_sensitivity / 100.0 * settings.aggressiveness
    return _cap_adjust(
        adjust,
        settings.occupancy_discount_cap_pct,
        settings.occupancy_premium_cap_pct,
    )


def _weather_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Wetter-Score → Auf-/Abschlag (RateBoard-Baustein, externer Nachfrage-Faktor).

    Gutes Wetter am Anreisetag (score > 0) hebt den Preis, schlechtes senkt ihn —
    symmetrisch gedeckelt über weather_max_adjust_pct. None = kein Signal (Datum
    außerhalb des Forecast-Horizonts) → neutral, kein erfundener Wert."""
    if not settings.weather_enabled or signals.weather_score is None:
        return 1.0
    score = max(-1.0, min(1.0, signals.weather_score))
    cap = settings.weather_max_adjust_pct / 100.0
    return 1.0 + score * cap


def _rate_rules_factor(signals: DaySignals, settings: DpSettings) -> float:
    """Manuelle Rate Rules → kombinierter Auf-/Abschlag (RateBoard: KI + Fachwissen).

    Jede Regel {match, adjust_pct}: trifft das match auf den Tag zu, wird ihr
    adjust_pct angewandt. Mehrere zutreffende Regeln stapeln multiplikativ. Ohne
    Regeln neutral. match-Schlüssel (alle optional, UND-verknüpft):
      weekday: int|list[int]  (0=Mo..6=So)
      month:   int|list[int]
      min_days_before / max_days_before: int (Vorlauf-Fenster)"""
    if not settings.rate_rules:
        return 1.0
    factor = 1.0
    for rule in settings.rate_rules:
        if not isinstance(rule, dict):
            continue
        if _rule_matches(rule.get("match") or {}, signals):
            factor *= 1.0 + _as_float(rule.get("adjust_pct"), 0.0) / 100.0
    return factor


def _rule_matches(match: dict, signals: DaySignals) -> bool:
    """True, wenn alle gesetzten match-Kriterien auf den Tag zutreffen (UND)."""
    def _in(value: object, crit: object) -> bool:
        if isinstance(crit, list):
            return value in crit
        return value == crit

    if "weekday" in match and not _in(signals.day.weekday(), match["weekday"]):
        return False
    if "month" in match and not _in(signals.day.month, match["month"]):
        return False
    if "min_days_before" in match and signals.days_before < _as_float(
        match["min_days_before"], 0
    ):
        return False
    if "max_days_before" in match and signals.days_before > _as_float(
        match["max_days_before"], 1e9
    ):
        return False
    return True


def _cap_adjust(adjust: float, discount_cap_pct: float, premium_cap_pct: float) -> float:
    """Asymmetrische Deckelung einer relativen Anpassung → Faktor (1.0 + adjust).

    adjust < 0 (Rabatt) auf −discount_cap begrenzt, adjust > 0 (Aufschlag) auf
    +premium_cap. Cap <= 0 → keine Begrenzung in dieser Richtung."""
    if adjust < 0:
        if discount_cap_pct > 0:
            adjust = max(adjust, -discount_cap_pct / 100.0)
    elif premium_cap_pct > 0:
        # adjust == 0 bleibt durch min(0, cap) unverändert.
        adjust = min(adjust, premium_cap_pct / 100.0)
    return 1.0 + adjust


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


def _market_factor(base: float, signals: DaySignals, settings: DpSettings) -> float:
    """Markt-/Wettbewerbs-Faktor (Phase 2). Neutral (1.0), wenn Markt aus oder
    kein Signal vorliegt — dann verhält sich die Engine wie Phase 1.

    Zwei begrenzte Korrekturen, kombiniert und auf ±market_max_adjust_pct gedeckelt:
      * Wettbewerb: liegt ein comp_price (Median vergleichbarer Objekte) vor, wird
        der Preis gewichtet (market_sensitivity %) Richtung Markt-Median gezogen —
        relativ zum Basispreis. comp über base → Aufschlag, darunter → Abschlag.
      * Nachfrage: demand_index 0..1 wie die Auslastung (Pivot 0.5), ebenfalls über
        market_sensitivity skaliert.
    (Markt-Events fließen NICHT hier ein, sondern gemerged in den event-Faktor —
    keine Doppelzählung.)"""
    if not settings.market_enabled or base <= 0:
        return 1.0
    sens = settings.market_sensitivity / 100.0
    adjust = 0.0
    if signals.comp_price is not None and signals.comp_price > 0:
        # Relative Marktabweichung zum Basispreis, gewichtet.
        adjust += (signals.comp_price - base) / base * sens
    if signals.demand_index is not None:
        adjust += (signals.demand_index - _OCCUPANCY_PIVOT) / _OCCUPANCY_PIVOT * sens
    # Aggressivität skaliert die Markt-Korrektur, danach Deckelung.
    adjust *= settings.aggressiveness
    cap = settings.market_max_adjust_pct / 100.0
    adjust = max(-cap, min(cap, adjust))
    return 1.0 + adjust


def _merged_event_pct(signals: DaySignals) -> float:
    """Event-Aufschlag aus event_periods + Marktdaten OHNE Doppelzählung: der
    höhere der beiden gilt (nicht die Summe)."""
    own = signals.event_pct
    market = signals.market_event_pct
    if market is None:
        return own
    return max(own, market)


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

    base = Basispreis aus dem rate_plan/Grundpreis. Bei base_mode='manual' ersetzt
    der gesetzte manual_base_price diesen Anker. Multiplikatives Modell, danach
    Clamp auf [min_price, max_price] (falls gesetzt)."""
    base = settings.effective_base(base)
    factors = {
        "season": 1.0 + signals.season_pct / 100.0,
        # Event: event_periods + Marktdaten gemerged (höherer Wert, keine Doppelzählung).
        "event": 1.0 + _merged_event_pct(signals) / 100.0,
        "weekend": _weekend_factor(signals.day, settings),
        "occupancy": _occupancy_factor(signals, settings),
        # Phase 2: Pickup-Velocity (antizipativ, neutral ohne Signal).
        "pickup": _pickup_factor(signals, settings),
        "last_minute": _last_minute_factor(signals, settings),
        "orphan": _orphan_factor(signals, settings),
        # Phase 2: Markt-/Wettbewerbs-Faktor (neutral 1.0 ohne Signal/Markt aus).
        "market": _market_factor(base, signals, settings),
        # RateBoard: Wetter (externer Nachfrage-Faktor, neutral ohne Signal/aus).
        "weather": _weather_factor(signals, settings),
    }
    # Gelernte/automatische Faktoren mit Anti-Über-Rabattierung kombinieren …
    price = base * _combine_factors(factors.values())
    # … dann die manuellen Rate Rules als bewussten Vermieter-Override OBENDRAUF
    # (sie sollen nicht von der Anti-Über-Rabattierung der Auto-Faktoren verschluckt
    # werden — KI + Fachwissen, RateBoard-Prinzip). In den factors für Transparenz.
    rules_factor = _rate_rules_factor(signals, settings)
    factors["rate_rules"] = rules_factor
    price *= rules_factor

    if settings.min_price is not None:
        price = max(price, settings.min_price)
    if settings.max_price is not None:
        price = min(price, settings.max_price)

    return DayResult(
        price=round(price, 2),
        min_stay=_dynamic_min_stay(signals, settings),
        factors=factors,
    )


def _combine_factors(factors: object) -> float:
    """Faktoren zu EINEM Multiplikator kombinieren — mit Anti-Über-Rabattierung
    (Roadmap-Phase 1, PriceLabs-Konfliktregel).

    Statt alle Faktoren stumpf zu multiplizieren (mehrere Rabatte kumulieren sich
    sonst zu stark, z. B. Last-Minute × Orphan × Auslastung → viel zu billig):
      * Aufschläge (>1.0) stapeln multiplikativ (alle gelten),
      * Rabatte (<1.0) gelten NICHT alle — nur der STÄRKSTE (kleinste) Rabatt zählt,
      * neutrale Faktoren (==1.0) ohne Wirkung.
    Ergebnis = Produkt aller Aufschläge × stärkster Rabatt."""
    premium = 1.0
    strongest_discount = 1.0  # 1.0 = kein Rabatt; kleiner = stärker
    for f in factors:
        if f > 1.0:
            premium *= f
        elif f < 1.0:
            strongest_discount = min(strongest_discount, f)
    return premium * strongest_discount
