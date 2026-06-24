"""KI-Forecast (Roadmap-Phase 4) — gelernte Pickup-Kurve pro Objekt/Saison.

RateBoard/Beyond-Kern: nicht die Ist-Belegung treibt den Preis, sondern die
ABWEICHUNG der heutigen Belegung von der ERWARTETEN Buchungskurve dieses Objekts.
Bucht sich ein Datum schneller als für seinen Vorlauf (days_before) normal →
Aufschlag, bevor es voll ist (antizipativ). Langsamer → Rabatt.

Das Modell ist rein statistisch (keine LLM-Kosten pro Abfrage): Aus den täglichen
`dp_pickup_snapshots` lernt es je (Saison-Bucket = Anreise-Monat, days_before) die
mittlere Belegungs-Wahrscheinlichkeit — die erwartete Pickup-Kurve. Der heutige
Ist-Stand wird dagegen verglichen.

„Keine Fallbacks": Trägt die Historie eine Zelle nicht (weniger als
_MIN_OBSERVATIONS Beobachtungen), liefert das Modell für diesen Tag KEIN Signal
(None) — die Engine bleibt dort neutral, statt einen Erwartungswert zu erfinden.
Mit jeder Nacht Snapshots wächst die Abdeckung → das Modell wird besser (KI ab
Tag 1 = Lernen ab Tag 1, Wirkung wächst mit der Datenmasse).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.forecast")

# Mindest-Beobachtungen je (Saison-Bucket, days_before-Bucket), damit eine gelernte
# Erwartung als belastbar gilt. Darunter → kein Forecast-Signal (None).
_MIN_OBSERVATIONS = 8
# days_before wird in Vorlauf-Buckets gruppiert (sonst ist jede Tageszahl zu dünn
# besetzt). Grenzen in Tagen — analog zu den Engine-Vorlauf-Buckets.
_LEAD_BUCKETS = (3, 7, 14, 30, 60, 120, 365)


def _lead_bucket(days_before: int) -> int:
    """days_before → Index des Vorlauf-Buckets (grobe Vorlauf-Position)."""
    db = max(0, days_before)
    for i, upper in enumerate(_LEAD_BUCKETS):
        if db <= upper:
            return i
    return len(_LEAD_BUCKETS)


def _season_bucket(stay: date) -> int:
    """Saison-Bucket = Anreise-Monat (1..12). Buchungskurven sind saisonal
    verschieden (Sommer bucht früher als Nebensaison)."""
    return stay.month


@dataclass
class PickupObservation:
    """Eine Zeile aus dp_pickup_snapshots, reduziert auf das fürs Lernen Nötige."""

    stay_date: date
    days_before: int
    booked: bool


class PickupCurveModel:
    """Gelernte erwartete Belegungs-Wahrscheinlichkeit je (Saison-Bucket, Vorlauf-
    Bucket). Aus historischen Snapshots trainiert; liefert pro Aufenthaltstag eine
    Forecast-Velocity in grob [-1, +1] (Ist vs. Erwartung)."""

    def __init__(self, min_observations: int = _MIN_OBSERVATIONS) -> None:
        self._min_obs = min_observations
        # (season_bucket, lead_bucket) → erwartete Belegungs-Wahrscheinlichkeit.
        self._expected: dict[tuple[int, int], float] = {}

    @property
    def is_trained(self) -> bool:
        return bool(self._expected)

    def train(self, observations: list[PickupObservation]) -> PickupCurveModel:
        """Erwartete Pickup-Kurve aus den Beobachtungen lernen. Eine Zelle gilt
        nur als gelernt, wenn sie >= min_observations Beobachtungen hat (sonst
        kein Eintrag → später None)."""
        booked: dict[tuple[int, int], int] = defaultdict(int)
        total: dict[tuple[int, int], int] = defaultdict(int)
        for o in observations:
            key = (_season_bucket(o.stay_date), _lead_bucket(o.days_before))
            total[key] += 1
            if o.booked:
                booked[key] += 1
        self._expected = {
            key: booked[key] / n
            for key, n in total.items()
            if n >= self._min_obs
        }
        log.info(
            "pickup_curve_trained",
            cells=len(self._expected),
            observations=len(observations),
        )
        return self

    def forecast_velocity(
        self, stay: date, days_before: int, occupied_now: bool
    ) -> float | None:
        """Forecast-Velocity für einen Aufenthaltstag: Abweichung des heutigen
        Belegungs-Ist vom gelernten Erwartungswert bei diesem Vorlauf.

        occupied_now=True, Erwartung niedrig → bucht sich schneller als normal →
        positives Signal (Aufschlag). occupied_now=False, Erwartung hoch → langsamer
        als normal → negatives Signal (Rabatt). Liegt Ist == Erwartung → ~0.

        None, wenn die Zelle nicht gelernt wurde (Cold-Start, keine Fallbacks)."""
        key = (_season_bucket(stay), _lead_bucket(days_before))
        expected = self._expected.get(key)
        if expected is None:
            return None
        actual = 1.0 if occupied_now else 0.0
        # Ist − Erwartung, skaliert auf grob [-1, +1]. Über-Erwartung (schneller)
        # → positiv, Unter-Erwartung (langsamer) → negativ.
        return max(-1.0, min(1.0, actual - expected))
