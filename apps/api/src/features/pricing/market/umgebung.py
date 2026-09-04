"""Markt-Provider aus der Marktbeobachtung (`markt_beobachtung`).

Er ruft NICHTS ab — er liest nur, was der taegliche Lauf
(`beobachtung_service.MarktBeobachtung`) abgelegt hat. Damit haengt eine
Preisberechnung nie an einer Fremdquelle: ist das Raster leer oder veraltet,
gibt es kein Signal und der Markt-Faktor bleibt neutral.

INTERPOLATION ZWISCHEN STICHTAGEN
=================================
Abgerufen werden Stichtage (nah woechentlich, fern monatlich), gebraucht wird
ein Wert je Tag. Dazwischen wird linear interpoliert. Das ist bewusst und
nicht heimlich: ein Preisniveau einer ganzen Region bewegt sich ueber Wochen,
nicht ueber Tage — die Interpolation erfindet keinen Verlauf, sie glaettet
einen, der ohnehin glatt ist. Ausserhalb der Stuetzstellen wird NICHT
extrapoliert (Wurzel 4): kein Wert ist besser als ein fortgeschriebener.

VERFALL
=======
Werte aelter als `_MAX_ALTER_TAGE` werden verworfen. Ein Marktpreis von vor
drei Wochen sieht aus wie ein aktueller und ist doch keiner; lieber kein
Signal als ein altes, das niemand als alt erkennt (Wurzel 5b).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from .base import MarketDay, MarketSignalProvider
from .beobachtung import _FERN_SCHRITT, Zelle

log = get_logger("nextdays.pricing.market.umgebung")

_QUELLE = "umgebung"
_ART = "entire_home"

# Aelter als das, und der Wert gilt nicht mehr. Der Lauf ist taeglich; zwei
# Wochen Toleranz ueberbruecken einen Ausfall, ohne dass Preise von vor einem
# Monat als heutiger Markt durchgehen.
_MAX_ALTER_TAGE = 14


class UmgebungProvider(MarketSignalProvider):
    """Markt-Median der Rasterzelle, in der das Objekt liegt."""

    name = "umgebung"

    def __init__(self, service_client: Client, property_id: str) -> None:
        self._db = service_client
        self._property_id = property_id

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        """Markt-Preis je Tag aus dem Raster. Leer = neutral.

        `market_key`/`comp_refs` werden nicht gebraucht (die Zelle ergibt sich
        aus dem Standort); sie bleiben in der Signatur, weil sie zur
        gemeinsamen Provider-Schnittstelle gehoeren.
        """
        if not days:
            return {}
        standort = self._standort()
        if standort is None:
            return {}
        zelle, waehrung = standort
        # Mit RAND laden: ein Tag am Anfang oder Ende des angefragten Zeitraums
        # liegt zwischen einer Stuetzstelle INNERHALB und einer AUSSERHALB. Wer
        # nur innerhalb laedt, kann ihn nicht interpolieren und gibt neutral
        # zurueck — gemessen am 04.09.2026: fuer heute+20 und heute+80 kam
        # kein Signal, obwohl beide Nachbar-Stichtage im Raster standen. Der
        # Rand ist der groesste Stichtag-Abstand, damit auf beiden Seiten
        # sicher eine Stuetze mitkommt.
        rand = timedelta(days=_FERN_SCHRITT)
        stuetzen = self._stuetzstellen(
            zelle, waehrung, min(days) - rand, max(days) + rand
        )
        if len(stuetzen) < 2:
            log.info(
                "markt_umgebung_zu_wenig_stuetzstellen",
                property_id=self._property_id,
                gefunden=len(stuetzen),
            )
            return {}
        return self._interpolieren(stuetzen, days)

    def hat_daten(self) -> bool:
        """Liegt fuer die Zelle dieses Objekts ueberhaupt ein frischer Wert vor?

        Der Recompute entscheidet damit, ob er diesen Provider nimmt oder auf
        den Umkreis zurueckfaellt. Bewusst eine eigene, billige Abfrage statt
        eines Probelaufs von `market_signal` — die Antwort wird je Objekt
        einmal gebraucht, nicht je Tag.
        """
        standort = self._standort()
        if standort is None:
            return False
        zelle, waehrung = standort
        grenze = datetime.now(UTC) - timedelta(days=_MAX_ALTER_TAGE)
        try:
            rows = (
                self._db.table("markt_beobachtung")
                .select("id")
                .eq("zelle_lat", zelle.lat)
                .eq("zelle_lng", zelle.lng)
                .eq("objekt_art", _ART)
                .eq("quelle", _QUELLE)
                .eq("waehrung", waehrung)
                .gte("abgerufen_am", grenze.isoformat())
                .limit(2)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("markt_umgebung_pruefung_fehlgeschlagen", fehler=str(exc)[:200])
            return False
        # Zwei, weil unter zwei Stuetzstellen nicht interpoliert werden kann.
        return len(rows) >= 2

    def _standort(self) -> tuple[Zelle, str] | None:
        try:
            rows = (
                self._db.table("properties")
                .select("lat, lng, currency")
                .eq("id", self._property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("markt_umgebung_objekt_unlesbar", fehler=str(exc)[:200])
            return None
        if not rows:
            return None
        r = rows[0]
        waehrung = (r.get("currency") or "").strip().upper()
        if r.get("lat") is None or r.get("lng") is None or not waehrung:
            return None
        try:
            return (Zelle.fuer(float(r["lat"]), float(r["lng"])), waehrung)
        except (TypeError, ValueError):
            return None

    def _stuetzstellen(
        self, zelle: Zelle, waehrung: str, von: date, bis: date
    ) -> dict[date, float]:
        """Gespeicherte Mediane der Zelle im Zeitraum, nur frische."""
        grenze = datetime.now(UTC) - timedelta(days=_MAX_ALTER_TAGE)
        try:
            rows = (
                self._db.table("markt_beobachtung")
                .select("tag, median_preis, abgerufen_am, anzahl")
                .eq("zelle_lat", zelle.lat)
                .eq("zelle_lng", zelle.lng)
                .eq("objekt_art", _ART)
                .eq("quelle", _QUELLE)
                .eq("waehrung", waehrung)
                .gte("tag", von.isoformat())
                .lte("tag", bis.isoformat())
                .gte("abgerufen_am", grenze.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("markt_umgebung_raster_unlesbar", fehler=str(exc)[:200])
            return {}
        raus: dict[date, float] = {}
        for r in rows:
            try:
                tag = date.fromisoformat(str(r["tag"])[:10])
                preis = float(r["median_preis"])
            except (TypeError, ValueError, KeyError):
                continue
            if preis > 0:
                raus[tag] = preis
        return raus

    @staticmethod
    def _interpolieren(
        stuetzen: dict[date, float], days: list[date]
    ) -> dict[str, MarketDay]:
        """Linear zwischen den Stuetzstellen; ausserhalb kein Wert."""
        punkte = sorted(stuetzen.items())
        erster, letzter = punkte[0][0], punkte[-1][0]
        raus: dict[str, MarketDay] = {}
        for tag in days:
            if tag < erster or tag > letzter:
                continue
            preis = _zwischenwert(punkte, tag)
            if preis is not None:
                raus[tag.isoformat()] = MarketDay(comp_price=round(preis, 2))
        return raus


def _zwischenwert(punkte: list[tuple[date, float]], tag: date) -> float | None:
    """Linearer Wert an `tag` zwischen den beiden umgebenden Stuetzstellen."""
    vorher: tuple[date, float] | None = None
    for p in punkte:
        if p[0] == tag:
            return p[1]
        if p[0] < tag:
            vorher = p
            continue
        if vorher is None:
            return None
        spanne = (p[0] - vorher[0]).days
        if spanne <= 0:
            return vorher[1]
        anteil = (tag - vorher[0]).days / spanne
        return vorher[1] + (p[1] - vorher[1]) * anteil
    return None
