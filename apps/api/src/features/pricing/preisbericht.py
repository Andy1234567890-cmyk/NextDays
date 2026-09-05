"""Preisbericht — die Auswertung des Dynamic Pricing für EIN Objekt.

WAS ER BEANTWORTET (und weder Hostaway noch SiteMinder als Bericht zeigen):
* Wo liegt mein Preis gegenüber der Umgebung, Stichtag für Stichtag?
  (`verlauf`: Markt-Median mit mittlerem Feld, eigener Preis, Grundpreis)
* Was macht die Automatik aus meinem Grundpreis über den Horizont?
  (`uplift`: Summe der berechneten Preise gegen Grundpreis × Tage)
* Wie gehe ich mit den Vorschlägen des Regel-Beraters um?
  (`ki`: angenommen / abgelehnt)

Alles aus vorhandenen Tabellen — `markt_beobachtung` über `marktstand_bauen`
(dieselbe Kurve wie die Karte, kein zweiter Rechenweg), `dynamic_prices`,
`rate_plans`, `dp_ki_entscheidungen`. Keine neuen Speicherorte.

WAS NICHT GERECHNET WIRD: ohne Grundpreis kein Uplift, ohne Marktkurve kein
Abstand — dann steht `None`, nie eine 0 (Wurzel 4). Der Bericht ist
Vertriebsauskunft und liest ungescopet über die Service-Role; der Router
prüft das Eigentum (`require_own_property`) VOR dem Aufruf.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .ki_schemas import Preisbericht, PreisberichtPunkt
from .market.stand import marktstand_bauen
from .recompute import DynamicPricingRecompute

log = get_logger("nextdays.pricing.preisbericht")

# Der Push-Horizont: weiter reicht kein gesendeter Preis, weiter gibt es also
# nichts zu bewerten (settings_service._UMSCHALT_HORIZONT_TAGE).
HORIZONT_TAGE = 365


def _zahl(wert: Any) -> float | None:  # noqa: ANN401 - kommt roh aus der DB
    if wert is None:
        return None
    try:
        return float(wert)
    except (TypeError, ValueError):
        return None


class PreisberichtService:
    """Rechnet den Preisbericht eines Objekts."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def bericht(self, property_id: str, *, heute: date | None = None) -> Preisbericht:
        heute = heute or date.today()
        stand = marktstand_bauen(self._db, property_id)
        grundpreis = DynamicPricingRecompute(self._db).load_base_price(property_id)
        preise = self._dynamische_preise(property_id, heute, heute + timedelta(days=HORIZONT_TAGE))

        verlauf: list[PreisberichtPunkt] = []
        abstaende: list[float] = []
        for p in stand.verlauf:
            abstand = None
            if p.eigener_preis is not None and p.markt_median > 0:
                abstand = round((p.eigener_preis - p.markt_median) * 100 / p.markt_median, 1)
                abstaende.append(abstand)
            verlauf.append(
                PreisberichtPunkt(
                    tag=p.tag,
                    markt_median=p.markt_median,
                    p25=p.p25,
                    p75=p.p75,
                    anzahl=p.anzahl,
                    eigener_preis=p.eigener_preis,
                    grundpreis=grundpreis,
                    abstand_pct=abstand,
                )
            )

        tage = len(preise)
        summe = round(sum(preise.values()), 2)
        uplift = None
        if grundpreis and tage:
            uplift = round((summe - grundpreis * tage) * 100 / (grundpreis * tage), 1)

        ki = self._ki(property_id, heute)
        return Preisbericht(
            property_id=property_id,
            waehrung=stand.waehrung,
            stand_vom=stand.stand_vom,
            radius_km=stand.radius_km,
            hinweis=stand.hinweis,
            verlauf=verlauf,
            abstand_schnitt_pct=(
                round(sum(abstaende) / len(abstaende), 1) if abstaende else None
            ),
            stichtage_unter_markt=sum(1 for a in abstaende if a < -8),
            stichtage_am_markt=sum(1 for a in abstaende if -8 <= a < 8),
            stichtage_ueber_markt=sum(1 for a in abstaende if a >= 8),
            grundpreis=grundpreis,
            horizont_tage=HORIZONT_TAGE,
            tage_mit_preis=tage,
            preis_schnitt=round(summe / tage, 2) if tage else None,
            preis_min=min(preise.values()) if preise else None,
            preis_max=max(preise.values()) if preise else None,
            uplift_pct=uplift,
            ki_angenommen=ki["angenommen"],
            ki_abgelehnt=ki["abgelehnt"],
            ki_angenommen_90=ki["angenommen_90"],
            ki_abgelehnt_90=ki["abgelehnt_90"],
        )

    def _dynamische_preise(self, property_id: str, von: date, bis: date) -> dict[str, float]:
        rows = fetch_all_rows(
            self._db.table("dynamic_prices")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
        )
        raus: dict[str, float] = {}
        for r in rows:
            preis = _zahl(r.get("price"))
            if preis is not None:
                raus[str(r["date"])[:10]] = preis
        return raus

    def _ki(self, property_id: str, heute: date) -> dict[str, int]:
        """Annahme und Ablehnung der Berater-Vorschläge — gesamt und 90 Tage."""
        zaehler = {"angenommen": 0, "abgelehnt": 0, "angenommen_90": 0, "abgelehnt_90": 0}
        try:
            rows = fetch_all_rows(
                self._db.table("dp_ki_entscheidungen")
                .select("entscheidung, created_at")
                .eq("property_id", property_id)
            )
        except Exception as exc:  # noqa: BLE001 — Auskunft darf nicht kippen
            log.warning("preisbericht_ki_unlesbar", fehler=str(exc)[:200])
            return zaehler
        grenze = (heute - timedelta(days=90)).isoformat()
        for r in rows:
            art = str(r.get("entscheidung") or "")
            if art not in ("angenommen", "abgelehnt"):
                continue
            zaehler[art] += 1
            if str(r.get("created_at") or "")[:10] >= grenze:
                zaehler[f"{art}_90"] += 1
        return zaehler
