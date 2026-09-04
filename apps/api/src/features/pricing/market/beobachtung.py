"""Marktbeobachtung: aggregierte Konkurrenzpreise je Rasterzelle und Tag.

WAS DIESES MODUL LOEST
======================
Der `UmkreisProvider` sucht Vergleichsobjekte auf der EIGENEN Plattform. Live
gemessen am 04.09.2026 findet er null: von 44 aktiven Objekten haben 40 keinen
einzigen Nachbarn eines fremden Betriebs, das dichteste hat drei. Bei fuenf
Betrieben auf der Plattform kann das auch nicht anders sein. Der Markt-Faktor
stand deshalb an allen 400 Tagen auf exakt 1,0 — ein Schalter ohne Wirkung.

Dieses Modul holt das Preisniveau dort, wo der Wettbewerb tatsaechlich steht:
bei den oeffentlich ausgeschriebenen Preisen der Umgebung. Rund um dasselbe
Objekt findet es 49 vergleichbare Haeuser statt null.

WAS GESPEICHERT WIRD — UND WAS NICHT
====================================
Fuer den PREISFAKTOR ausschliesslich der MEDIAN je Rasterzelle, Tag und
Objektart, ab `_MIN_OBJEKTE` Objekten (`markt_beobachtung`). Fuer die KARTE
zusaetzlich jeder beobachtete Preis mit seinem auf ~100 m gerundeten Ort
(`markt_punkt`, seit 04.09.2026 auf Entscheidung des Nutzers: „in der Region
50 km alle Objekte nur mit Preis"). Kein Objektname, keine Objekt-ID und kein
Link verlaesst dieses Modul. Der Grund ist nicht nur rechtlich (eine Sammlung
benannter Fremdinserate waere eine Wettbewerber-Datenbank im Produkt), sondern
auch fachlich: fuer die Preisfindung braucht der Betrieb das Preisniveau seiner
Umgebung, nicht den Namen des Nachbarn.

WARUM EIN STICHTAGS-RASTER UND KEINE 400 TAGE
=============================================
Ein Preis je Einzeltag hiesse ein Abruf je Tag. Gemessen: der Kalender-Endpunkt
der Quelle liefert zwar 365 Tage Verfuegbarkeit, aber KEINE Preise (alle 365
Tage `null`) — Preise gibt es nur zum angefragten Zeitfenster. 400 Abrufe je
Zelle und Tag sind weder zumutbar noch noetig: Preisniveaus bewegen sich ueber
Wochen, nicht ueber Stunden. Abgerufen werden deshalb Stichtage
(`_stichtage`), dazwischen wird interpoliert.

FAIL-CLOSED
===========
Faellt die Quelle aus, aendert sich das Raster nicht und die Engine bekommt
schlicht kein Signal — der Markt-Faktor bleibt neutral. Nie ein geschaetzter
Ersatzwert (Wurzel 4), nie ein stiller Teilerfolg (Wurzel 5).
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.market.beobachtung")

# Kantenlaenge einer Rasterzelle in Grad. 0,45 Grad sind in Nordeuropa rund
# 50 km in der Breite — der Umkreis, in dem ein Gast tatsaechlich zwischen
# Ferienorten waehlt und in dem auch in duenn besiedelten Regionen genug
# Angebote stehen.
#
# Vorher standen hier 0,25 Grad (~28 km). Das war fuer den Preisfaktor genug,
# fuer die KARTE aber zu klein: gemessen am 04.09.2026 blieben in Nordjuetland
# nur 15 bis 27 Objekte je Zelle uebrig, und nach Teilgebieten aufgeteilt war
# die Karte an einzelnen Tagen leer.
_ZELLE_GRAD = 0.45

# Unter so vielen Objekten wird kein Median gespeichert: bei drei Objekten IST
# der Median der Preis eines konkreten Nachbarn.
_MIN_OBJEKTE = 5

# Kantenlaenge eines Teilgebiets (~11 km) — VERWAIST seit dem 04.09.2026.
#
# Das Feinraster (`feinzelle`, Tabelle 0557) gruppierte die Karte in
# Teilgebiete und zeigte eine Gruppe erst ab fuenf Objekten. Gemessen in
# Nordjuetland: 15 Objekte auf fuenf Teilgebiete mit 4/3/3/3/2 Haeusern, kein
# einziges sichtbar; mit 0,05 Grad sieben Teilgebiete, eines ueber der
# Schwelle. Fuer die KARTE ist Gruppierung der falsche Zuschnitt — sie zeigt
# seither jeden beobachteten Preis als eigenen Punkt (`markt_punkt`, 0558).
# Fuer den MEDIAN bleibt die Fuenferschwelle richtig (siehe `aggregieren`).
#
# Konstante und Funktion bleiben stehen (kein Loeschauftrag); der Lauf ruft
# `feinzelle` nicht mehr auf.
_FEIN_GRAD = 0.1

# Stichtage: bis _NAH_TAGE jeden _NAH_SCHRITT, danach jeden _FERN_SCHRITT.
# Nahe Termine bewegen sich schneller (Last-Minute, Restplatz), ferne Termine
# tragen im Wesentlichen die Saison — dort genuegt ein grobes Raster.
_NAH_TAGE = 90
_NAH_SCHRITT = 7
_FERN_TAGE = 400
_FERN_SCHRITT = 30

# Obergrenze der Stichtage je Zelle und Lauf (Wurzel 8: kein unbegrenzter
# Bereich). Bei den Werten oben sind es rund 23 — die Grenze faengt eine
# spaetere Fehlkonfiguration ab, sie ist nicht der Normalfall.
_MAX_STICHTAGE = 40


@dataclass(frozen=True)
class Zelle:
    """Eine Rasterzelle, benannt durch die Koordinate ihrer Mitte."""

    lat: float
    lng: float

    @classmethod
    def fuer(cls, lat: float, lng: float) -> Zelle:
        """Die Zelle, in der ein Punkt liegt."""
        return cls(
            lat=round(_abrunden(lat, _ZELLE_GRAD) + _ZELLE_GRAD / 2, 5),
            lng=round(_abrunden(lng, _ZELLE_GRAD) + _ZELLE_GRAD / 2, 5),
        )

    def kasten(self) -> tuple[float, float, float, float]:
        """(sw_lat, sw_lng, ne_lat, ne_lng) der Zelle."""
        h = _ZELLE_GRAD / 2
        return (self.lat - h, self.lng - h, self.lat + h, self.lng + h)


def _abrunden(wert: float, schritt: float) -> float:
    return (wert // schritt) * schritt


def feinzelle(lat: float, lng: float) -> tuple[float, float]:
    """Mitte des Teilgebiets, in dem ein Punkt liegt.

    VERWAIST — siehe `_FEIN_GRAD`. Kein Aufrufer mehr; die Karte zeigt
    Einzelpunkte statt Teilgebiete."""
    return (
        round(round(lat / _FEIN_GRAD) * _FEIN_GRAD, 5),
        round(round(lng / _FEIN_GRAD) * _FEIN_GRAD, 5),
    )


def stichtage(ab: date, *, horizont: int = _FERN_TAGE) -> list[date]:
    """Die Tage, fuer die abgerufen wird — nah dicht, fern grob.

    Zwischen zwei Stichtagen interpoliert `preis_am_tag`. Das ist keine
    Ungenauigkeit, die man verschweigen muesste: Preisniveaus einer ganzen
    Region bewegen sich ueber Wochen, ein taeglicher Abruf wuerde dieselbe
    Kurve mit mehr Last erzeugen.
    """
    tage: list[date] = []
    d = 0
    while d <= min(horizont, _NAH_TAGE):
        tage.append(ab + timedelta(days=d))
        d += _NAH_SCHRITT
    d = ((_NAH_TAGE // _FERN_SCHRITT) + 1) * _FERN_SCHRITT
    while d <= horizont:
        tage.append(ab + timedelta(days=d))
        d += _FERN_SCHRITT
    return tage[:_MAX_STICHTAGE]


def aggregieren(preise: list[float]) -> dict[str, float] | None:
    """Median/p25/p75 — oder None, wenn zu duenn.

    Bewusst None statt einer Zahl mit Warnung: ein Median aus drei Objekten
    sieht aus wie ein Marktpreis, ist aber der Preis eines Nachbarn. Wer ihn
    zurueckgibt, verlaesst sich spaeter darauf (Wurzel 4).
    """
    sauber = sorted(p for p in preise if p and p > 0)
    if len(sauber) < _MIN_OBJEKTE:
        return None
    return {
        "median": round(statistics.median(sauber), 2),
        "p25": round(sauber[len(sauber) // 4], 2),
        "p75": round(sauber[len(sauber) * 3 // 4], 2),
        "anzahl": float(len(sauber)),
    }
