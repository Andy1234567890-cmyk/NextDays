"""Wetter-Provider (RateBoard-Baustein) — Wetter als externer Nachfrage-Faktor.

ZWEI QUELLEN, WEIL EINE NICHT REICHT
====================================
Eine echte Wettervorhersage endet nach rund zehn Tagen. Der Preiskalender reicht
aber 18 Monate — dort war das Wetter bis zum 04.09.2026 schlicht nicht vorhanden
(``weather: 1.0`` an 529 von 540 Tagen), ohne dass die Oberfläche das erklärte.
Der Betrieb hatte Wetter eingeschaltet und sah nie eine Wirkung.

Deshalb zwei Stufen, sauber getrennt und IMMER als solche gekennzeichnet:

  * ``prognose``  — Tag 0..10: Google Maps Weather API (MetNet). Eine echte
                    Vorhersage für genau diesen Tag.
  * ``saisonal``  — ab Tag 11: langjähriges Tagesmittel (Klima-Normalwert) aus
                    ERA5-Land, vorberechnet in ``klima_normalwerte``. Das ist
                    KEINE Vorhersage, sondern die Aussage „so ist dieser
                    Kalendertag hier üblicherweise".

Die Unterscheidung ist nicht kosmetisch: ein Mittelwert als „Vorhersage" auszugeben
wäre genau die Falschaussage, die niemand als Bug erkennt (Wurzel 5b). Jeder Score
trägt deshalb seine Herkunft mit, und die Oberfläche schreibt sie an den Tag.

WARUM GOOGLE STATT BRIGHT SKY (04.09.2026)
==========================================
Bright Sky (DWD) war frei und gut für DACH, endete aber ebenfalls bei zehn Tagen
und deckt Dänemark — den Beta-Betrieb — nur am Rand ab. Die Google Maps Weather
API ist seit Juni 2025 allgemein verfügbar, deckt DK/DE vollständig ab und liegt
bei 50 Objekten mit täglicher Neuberechnung (~1.500 Aufrufe/Monat) im
kostenlosen Kontingent von 10.000/Monat. Der Schlüssel ist derselbe, den die
Karten schon nutzen (``GOOGLE_MAPS_API_KEY``).

Open-Meteo wurde geprüft und VERWORFEN: dessen Gratis-Stufe untersagt die
kommerzielle Nutzung ausdrücklich („websites/apps with subscriptions"), und
myNextDays ist ein Abo-Produkt.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.pricing.weather")

_GOOGLE_WEATHER_URL = "https://weather.googleapis.com/v1/forecast/days:lookup"
# Googles Tages-Forecast reicht 10 Tage. Darüber hinaus gibt es KEINE Vorhersage —
# dort übernimmt der Klima-Normalwert (Quelle 'saisonal').
_FORECAST_HORIZON_DAYS = 10
# Obergrenze je Anfrage (Google: max. 10 Tage je Aufruf).
_MAX_TAGE_JE_ABRUF = 10


@dataclass(frozen=True)
class WetterTag:
    """Ein Wetter-Signal für EINEN Tag — samt seiner Herkunft.

    ``score`` in [-1, +1]: +1 ideales Reisewetter (warm, trocken, sonnig).
    ``quelle`` ist 'prognose' (echte Vorhersage) oder 'saisonal' (langjähriges
    Mittel). Die Kennzeichnung wird bis in die Kalenderzelle durchgereicht —
    ohne sie wäre ein Mittelwert von einer Vorhersage nicht zu unterscheiden.
    ``temp_c``/``niederschlag_mm``/``bewoelkung_pct`` sind die Rohwerte hinter
    dem Score, damit die Oberfläche „18 °C, trocken" zeigen kann statt „+0,6".
    """

    score: float
    quelle: str
    temp_c: float | None = None
    niederschlag_mm: float | None = None
    bewoelkung_pct: float | None = None


def _score_day(temp_c: float | None, precipitation_mm: float | None,
               cloud_pct: float | None) -> float | None:
    """Tages-Wetter → Score [-1, +1]. Warm+trocken+sonnig = hoch. None-Werte
    werden ausgelassen; fehlt alles, gibt es keinen Score (None)."""
    parts: list[float] = []
    if temp_c is not None:
        # 22 °C ideal → +1; 0 °C → -1; linear, gedeckelt.
        parts.append(max(-1.0, min(1.0, (temp_c - 11.0) / 11.0)))
    if precipitation_mm is not None:
        # 0 mm → +1, ab 5 mm → -1.
        parts.append(max(-1.0, min(1.0, 1.0 - precipitation_mm / 2.5)))
    if cloud_pct is not None:
        # 0 % Wolken → +1, 100 % → -1.
        parts.append(max(-1.0, min(1.0, 1.0 - cloud_pct / 50.0)))
    if not parts:
        return None
    return round(sum(parts) / len(parts), 3)


def _zahl(node: object, *pfad: str) -> float | None:
    """Verschachtelten Zahlwert aus der Google-Antwort holen ({"degrees": 18.2}).
    Fehlt ein Zwischenschritt oder ist der Wert keine Zahl → None (kein 0.0:
    „kein Wert" und „null Grad" sind verschiedene Aussagen, Wurzel 4)."""
    cur: object = node
    for teil in pfad:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(teil)
    return float(cur) if isinstance(cur, (int, float)) else None


class WeatherProvider:
    """Tages-Wetter-Score je Anreisedatum — Vorhersage kurzfristig, Klima langfristig."""

    def __init__(self, timeout_s: float = 8.0) -> None:
        self._timeout = timeout_s

    # -- öffentlich ----------------------------------------------------------
    def wetter_tage(
        self,
        lat: float | None,
        lon: float | None,
        days: list[date],
        today: date,
        *,
        normalwerte: dict[str, WetterTag] | None = None,
    ) -> dict[str, WetterTag]:
        """ISO-Datum → WetterTag für ALLE angefragten Tage, soweit belegbar.

        Tage im Vorhersagehorizont kommen von Google; für alle weiteren wird der
        übergebene Klima-Normalwert genommen (``normalwerte``, vom Aufrufer aus
        der DB geladen — dieser Provider spricht bewusst keine DB an). Tage ohne
        beides fehlen im Ergebnis; die Engine bleibt dort neutral.
        """
        if lat is None or lon is None or not days:
            return {}
        out: dict[str, WetterTag] = {}
        # Erst die Langfrist füllen, dann die echte Vorhersage darüberlegen:
        # wo es beides gibt, gewinnt die Prognose.
        if normalwerte:
            gewuenscht = {d.isoformat() for d in days}
            out.update({k: v for k, v in normalwerte.items() if k in gewuenscht})
        out.update(self._prognose(lat, lon, days, today))
        return out

    def weather_scores(
        self, lat: float | None, lon: float | None, days: list[date], today: date
    ) -> dict[str, float]:
        """Nur die Scores (Alt-Schnittstelle, ohne Herkunft). Ruft ausschließlich
        die Vorhersage ab — für die Langfrist ``wetter_tage`` verwenden."""
        return {
            iso: w.score
            for iso, w in self._prognose(lat, lon, days, today).items()
        }

    # -- Vorhersage (Google) -------------------------------------------------
    def _prognose(
        self, lat: float, lon: float, days: list[date], today: date
    ) -> dict[str, WetterTag]:
        """Google Maps Weather API für die Tage im Vorhersagehorizont."""
        schluessel = get_settings().google_maps_api_key.get_secret_value().strip()
        if not schluessel:
            # LAUT melden statt still neutral bleiben: Wetter ist eingeschaltet,
            # liefert aber nichts — genau der stumme Ausfall, der monatelang
            # unbemerkt blieb (Wurzel 5).
            log.warning("wetter_ohne_api_schluessel")
            return {}
        im_horizont = [
            d for d in days if 0 <= (d - today).days <= _FORECAST_HORIZON_DAYS
        ]
        if not im_horizont:
            return {}
        # Google zählt ab HEUTE, nicht ab dem ersten gewünschten Tag — und
        # nimmt höchstens 10 (ein höherer Wert wird nicht etwa gekappt, sondern
        # mit 403 abgelehnt; live gemessen am 04.09.2026 mit days=14).
        tage = max(1, min(
            _MAX_TAGE_JE_ABRUF, max((d - today).days for d in im_horizont) + 1
        ))
        try:
            resp = httpx.get(
                _GOOGLE_WEATHER_URL,
                params={
                    "key": schluessel,
                    "location.latitude": lat,
                    "location.longitude": lon,
                    "days": tage,
                    # `days` ist die Reichweite, `pageSize` die Seitengroesse —
                    # und die steht bei Google standardmaessig auf 5. Ohne
                    # diesen Wert kamen bei days=10 nur die ersten fuenf Tage
                    # zurueck, der Rest laege auf einer zweiten Seite, die
                    # niemand holte (live 04.09.2026: Kalender zeigte Wetter
                    # nur bis heute+4 statt heute+9).
                    "pageSize": tage,
                    "unitsSystem": "METRIC",
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # noqa: BLE001 — Wetter ist best-effort
            log.warning("wetter_abruf_fehlgeschlagen", fehler=str(exc)[:200])
            return {}
        gewuenscht = {d.isoformat() for d in im_horizont}
        out: dict[str, WetterTag] = {}
        for tag in payload.get("forecastDays") or []:
            iso = self._iso_aus_anzeigedatum(tag.get("displayDate"))
            if iso is None or iso not in gewuenscht:
                continue
            werte = self._tageswerte(tag)
            score = _score_day(*werte)
            if score is not None:
                out[iso] = WetterTag(
                    score=score,
                    quelle="prognose",
                    temp_c=werte[0],
                    niederschlag_mm=werte[1],
                    bewoelkung_pct=werte[2],
                )
        return out

    @staticmethod
    def _iso_aus_anzeigedatum(node: object) -> str | None:
        """Googles {"year":2026,"month":9,"day":4} → "2026-09-04"."""
        if not isinstance(node, dict):
            return None
        j, m, t = node.get("year"), node.get("month"), node.get("day")
        if not all(isinstance(x, int) for x in (j, m, t)):
            return None
        return f"{j:04d}-{m:02d}-{t:02d}"

    @staticmethod
    def _tageswerte(tag: dict) -> tuple[float | None, float | None, float | None]:
        """(Temperatur °C, Niederschlag mm, Bewölkung %) aus einem forecastDay.

        Temperatur als Mittel aus Höchst- und Tiefstwert; Niederschlag und
        Bewölkung aus dem TAG-Abschnitt (``daytimeForecast``) — nachts regnet es
        für einen Urlaubstag folgenlos, und die Nachtbewölkung sagt nichts über
        einen sonnigen Nachmittag."""
        hoch = _zahl(tag, "maxTemperature", "degrees")
        tief = _zahl(tag, "minTemperature", "degrees")
        if hoch is not None and tief is not None:
            temp = (hoch + tief) / 2
        else:
            temp = hoch if hoch is not None else tief
        tagteil = tag.get("daytimeForecast") if isinstance(tag, dict) else None
        regen = _zahl(tagteil, "precipitation", "qpf", "quantity")
        wolken = _zahl(tagteil, "cloudCover")
        return temp, regen, wolken
