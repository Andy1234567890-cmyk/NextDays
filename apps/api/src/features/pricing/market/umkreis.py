"""Markt-Signal aus vergleichbaren Objekten IM UMKREIS — betriebsübergreifend.

WARUM DIESER PROVIDER
=====================
Der vorhandene `PlatformProvider` zieht nur Objekte DESSELBEN Betriebs, und
zwar nur die, deren IDs jemand von Hand in `comp_refs` eingetragen hat. Beides
ist in der Praxis wertlos:

  * Die eigenen Objekte sind kein Markt, sondern der Blick in den Spiegel —
    steigt der eigene Preis, steigt der "Markt" mit, und der Faktor bleibt
    ewig neutral.
  * IDs abtippen tut niemand. Live gemessen am 04.09.2026: `market_enabled`
    war bei einem Objekt AN, `market_key` leer, `comp_refs` leer — der
    Markt-Faktor stand an allen 400 Tagen auf exakt 1,0. Ein Schalter, der
    nichts tut und das nicht sagt.

Dieser Provider sucht die Vergleichsobjekte SELBST: alle Objekte im Umkreis,
über Betriebsgrenzen hinweg, gefiltert auf Vergleichbarkeit.

WAS "VERGLEICHBAR" HEISST
=========================
Umkreis allein reicht nicht — eine 14-Personen-Villa neben einem Studio macht
den Median unbrauchbar. Gefiltert wird auf:
  * Entfernung        <= _RADIUS_KM Luftlinie
  * gleicher Typ      (Ferienhaus vergleicht sich nicht mit Hotelzimmer)
  * Gästezahl         +/- _GAESTE_TOLERANZ
  * verkaufsbereit    (status='active')
  * FREMDER Betrieb   (die eigenen Häuser sind kein Markt, sondern der Blick
                      in den Spiegel: steigt der eigene Preis, steigt der
                      "Markt" mit, und der Faktor bleibt ewig neutral)

DATENSCHUTZ UND WETTBEWERB
==========================
Herausgegeben wird ausschliesslich der MEDIAN ab _MIN_OBJEKTE Objekten, nie
ein Einzelpreis und nie ein Objektname. Unter dieser Schwelle liefert der
Provider für den Tag NICHTS (statt einer dünnen Zahl, die faktisch den Preis
eines einzelnen Nachbarn verrät). Das eigene Objekt zählt nie mit — sonst
zöge der eigene Preis den Markt hinter sich her.
"""
from __future__ import annotations

from datetime import date, timedelta
from math import asin, cos, radians, sin, sqrt
from statistics import median

from supabase import Client

from src.core.logging import get_logger

from .base import MarketDay, MarketSignalProvider

log = get_logger("nextdays.pricing.market.umkreis")

# Luftlinie in km. 25 km ist für Ferienregionen die Grösse, in der ein Gast
# wirklich zwischen Objekten wählt — in Nordjütland liegen die Nachbarorte
# 5-20 km auseinander. Kleiner, und in dünn besiedelten Gegenden bleibt der
# Markt leer; grösser, und Küste vergleicht sich mit Binnenland.
_RADIUS_KM = 25.0

# Gästezahl-Toleranz. +/-2 hält ein 6-Personen-Haus mit 4er- und 8er-Häusern
# zusammen, trennt es aber von der 14-Personen-Gruppenunterkunft.
_GAESTE_TOLERANZ = 2

# Unter so vielen Vergleichsobjekten wird kein Median herausgegeben: bei drei
# Objekten IST der Median der Preis eines konkreten Nachbarn.
_MIN_OBJEKTE = 5

# Obergrenze der Vergleichsobjekte je Abfrage. Der Median ändert sich ab ~30
# Objekten kaum noch, jedes weitere kostet einen Resolver-Durchlauf.
_MAX_OBJEKTE = 30


def _distanz_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Luftlinie in km (Haversine).

    Kein PostGIS: die Objektzahl je Tenant ist klein genug, um in Python zu
    rechnen, und eine Erweiterung nur für diese eine Frage wäre unverhältnis-
    mässig. Ein grober Vorfilter über ein Breiten-/Längen-Rechteck hält die
    Zahl der Kandidaten klein (siehe `_kandidaten`).
    """
    r = 6371.0
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    return 2 * r * asin(sqrt(a))


class UmkreisProvider(MarketSignalProvider):
    """Markt-Median aus vergleichbaren Objekten im Umkreis, betriebsübergreifend."""

    name = "umkreis"

    def __init__(
        self, service_client: Client, property_id: str, tenant_id: str | None = None
    ) -> None:
        self._db = service_client
        self._property_id = property_id
        self._tenant_id = tenant_id

    def stand(self) -> tuple[int, list[str]]:
        """(Anzahl, IDs) vergleichbarer Objekte fremder Betriebe im Umkreis.

        Öffentlich, weil die Oberfläche sie zeigt: ein Schalter "Marktdaten
        nutzen" ohne Auskunft darüber, ob es überhaupt einen Markt gibt, ist
        von einer Attrappe nicht zu unterscheiden.
        """
        eigenes = self._eigenes_objekt()
        if eigenes is None:
            return (0, [])
        ids = self._kandidaten(eigenes)
        return (len(ids), ids)

    def hat_standort(self) -> bool:
        """Kann für dieses Objekt überhaupt ein Umkreis bestimmt werden?"""
        return self._eigenes_objekt() is not None

    def market_signal(
        self,
        market_key: str | None,
        comp_refs: list[str],
        days: list[date],
    ) -> dict[str, MarketDay]:
        """Markt-Median je Tag. Leeres Ergebnis = kein Signal = Faktor neutral.

        `market_key` und `comp_refs` werden NICHT gebraucht — der Umkreis
        ergibt sich aus dem Standort des Objekts. Die Parameter bleiben in der
        Signatur, weil sie zur gemeinsamen Provider-Schnittstelle gehören.
        """
        if not days:
            return {}
        eigenes = self._eigenes_objekt()
        if eigenes is None:
            return {}
        kandidaten = self._kandidaten(eigenes)
        if len(kandidaten) < _MIN_OBJEKTE:
            log.info(
                "markt_umkreis_zu_duenn",
                property_id=self._property_id,
                gefunden=len(kandidaten),
                noetig=_MIN_OBJEKTE,
            )
            return {}
        return self._median_je_tag(kandidaten, min(days), max(days))

    def _eigenes_objekt(self) -> dict | None:
        """Standort und Merkmale des Objekts, für das gerechnet wird."""
        try:
            res = (
                self._db.table("properties")
                .select("id, tenant_id, lat, lng, property_type, max_guests")
                .eq("id", self._property_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — ohne Standort kein Umkreis
            log.warning("markt_umkreis_objekt_unlesbar", error=str(exc)[:200])
            return None
        if not res:
            return None
        p = res[0]
        if p.get("lat") is None or p.get("lng") is None:
            log.info(
                "markt_umkreis_ohne_koordinaten", property_id=self._property_id
            )
            return None
        return p

    def _kandidaten(self, eigenes: dict) -> list[str]:
        """IDs vergleichbarer Objekte im Umkreis (ohne das eigene).

        Vorfilter in der DB über ein Breiten-/Längen-Rechteck, Feinprüfung der
        echten Luftlinie in Python: ein Rechteck ist grosszügiger als ein
        Kreis, aber es reduziert die Kandidaten auf eine Handvoll, statt alle
        Objekte zu laden.
        """
        lat, lng = float(eigenes["lat"]), float(eigenes["lng"])
        # 1 Breitengrad ~ 111 km. Beim Längengrad schrumpft der Abstand mit
        # dem Cosinus der Breite (in Dänemark bei 57° etwa die Hälfte).
        d_lat = _RADIUS_KM / 111.0
        cos_breite = max(0.01, cos(radians(lat)))
        d_lng = _RADIUS_KM / (111.0 * cos_breite)
        gaeste = eigenes.get("max_guests")
        try:
            abfrage = (
                self._db.table("properties")
                .select("id, tenant_id, lat, lng, property_type, max_guests")
                .eq("status", "active")
                .is_("archived_at", "null")
                .neq("id", self._property_id)
                .gte("lat", lat - d_lat)
                .lte("lat", lat + d_lat)
                .gte("lng", lng - d_lng)
                .lte("lng", lng + d_lng)
            )
            if eigenes.get("property_type"):
                abfrage = abfrage.eq("property_type", eigenes["property_type"])
            res = (abfrage.execute()).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("markt_umkreis_kandidaten_unlesbar", error=str(exc)[:200])
            return []

        eigener_betrieb = self._tenant_id or eigenes.get("tenant_id")
        passend: list[tuple[float, str]] = []
        for p in res:
            if p.get("lat") is None or p.get("lng") is None:
                continue
            # Eigene Häuser sind kein Wettbewerb. Ohne diesen Ausschluss
            # vergliche sich ein Betrieb mit sich selbst und der Faktor bliebe
            # dauerhaft neutral — eine teure Attrappe.
            if eigener_betrieb and p.get("tenant_id") == eigener_betrieb:
                continue
            if isinstance(gaeste, int) and isinstance(p.get("max_guests"), int):
                if abs(p["max_guests"] - gaeste) > _GAESTE_TOLERANZ:
                    continue
            km = _distanz_km(lat, lng, float(p["lat"]), float(p["lng"]))
            if km <= _RADIUS_KM:
                passend.append((km, p["id"]))
        # Die nächstgelegenen zuerst: sie sind der relevantere Wettbewerb.
        passend.sort()
        return [pid for _, pid in passend[:_MAX_OBJEKTE]]

    def _median_je_tag(
        self, kandidaten: list[str], von: date, bis: date
    ) -> dict[str, MarketDay]:
        """Median der effektiven Tagespreise über alle Vergleichsobjekte."""
        from src.features.pricing.resolver import (  # noqa: PLC0415
            PricingResolver,
        )

        resolver = PricingResolver(service_client=self._db)
        je_tag: dict[str, list[float]] = {}
        for pid in kandidaten:
            try:
                tage = resolver.effective_prices(
                    pid, von, bis + timedelta(days=1)
                )
            except Exception as exc:  # noqa: BLE001 — ein Objekt darf nicht kippen
                log.warning(
                    "markt_umkreis_preis_fehlt", property_id=pid, error=str(exc)[:200]
                )
                continue
            for t in tage:
                if t.price is None:
                    continue
                je_tag.setdefault(t.date.isoformat(), []).append(float(t.price))

        out: dict[str, MarketDay] = {}
        for iso, preise in je_tag.items():
            # Schwelle je TAG, nicht nur je Objektmenge: an einem Tag, an dem
            # nur zwei Nachbarn einen Preis haben, wäre der Median deren
            # Mittelwert — faktisch ein fremder Einzelpreis.
            if len(preise) >= _MIN_OBJEKTE:
                out[iso] = MarketDay(comp_price=round(median(preise), 2))
        if out:
            log.info(
                "markt_umkreis_signal",
                property_id=self._property_id,
                objekte=len(kandidaten),
                tage=len(out),
            )
        return out
