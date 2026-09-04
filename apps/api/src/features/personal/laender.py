"""Gesetzliche Vorschlagswerte für die Betriebsregeln je EU-Land (0541, E3).

Das sind VORSCHLÄGE, die der Betrieb beim Einrichten sieht und bestätigt — kein
Fallback, der still gilt (Wurzel 4). Jede Zeile nennt ihre Quelle und den Stand.
Wo ein Land keine gesetzliche Vorgabe macht (Zuschläge sind in den meisten
Ländern Tarif-/Vertragssache), steht 0 mit Hinweis — der Betrieb trägt seinen
Tarifwert ein.

Gemeinsame Basis aller 27 Länder ist die Arbeitszeitrichtlinie 2003/88/EG:
  * Art. 3: mindestens 11 zusammenhängende Stunden Ruhezeit je 24 h
  * Art. 6: höchstens 48 Wochenstunden im Durchschnitt (inkl. Überstunden)
  * Art. 7: mindestens vier Wochen bezahlter Jahresurlaub (= 20 Arbeitstage
    bei Fünf-Tage-Woche)
  * Art. 2 Nr. 3: Nachtzeit = mindestens 7 Stunden, die 0–5 Uhr einschließen
Nationale Abweichungen nach oben stehen je Land; ein Land ohne eigene Zeile
bekommt die EU-Basis mit dem Hinweis, dass nationale Besonderheiten fehlen.

Die Zeitzone ist die des Festlands/der Hauptstadt; PT (Azoren) und ES
(Kanaren) haben weitere Zonen, die der Betrieb bei Bedarf umstellt.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time

EU_LAENDER: frozenset[str] = frozenset(
    {
        "AT",
        "BE",
        "BG",
        "CY",
        "CZ",
        "DE",
        "DK",
        "EE",
        "ES",
        "FI",
        "FR",
        "GR",
        "HR",
        "HU",
        "IE",
        "IT",
        "LT",
        "LU",
        "LV",
        "MT",
        "NL",
        "PL",
        "PT",
        "RO",
        "SE",
        "SI",
        "SK",
    }
)

ZEITZONE: dict[str, str] = {
    "AT": "Europe/Vienna",
    "BE": "Europe/Brussels",
    "BG": "Europe/Sofia",
    "CY": "Asia/Nicosia",
    "CZ": "Europe/Prague",
    "DE": "Europe/Berlin",
    "DK": "Europe/Copenhagen",
    "EE": "Europe/Tallinn",
    "ES": "Europe/Madrid",
    "FI": "Europe/Helsinki",
    "FR": "Europe/Paris",
    "GR": "Europe/Athens",
    "HR": "Europe/Zagreb",
    "HU": "Europe/Budapest",
    "IE": "Europe/Dublin",
    "IT": "Europe/Rome",
    "LT": "Europe/Vilnius",
    "LU": "Europe/Luxembourg",
    "LV": "Europe/Riga",
    "MT": "Europe/Malta",
    "NL": "Europe/Amsterdam",
    "PL": "Europe/Warsaw",
    "PT": "Europe/Lisbon",
    "RO": "Europe/Bucharest",
    "SE": "Europe/Stockholm",
    "SI": "Europe/Ljubljana",
    "SK": "Europe/Bratislava",
}

_EU_QUELLE = "Richtlinie 2003/88/EG Art. 2, 3, 6, 7 (Stand 2026)"


@dataclass(frozen=True, slots=True)
class Vorschlag:
    ruhezeit_stunden: float
    max_tagesstunden: float
    max_wochenstunden: float
    nacht_von: time
    nacht_bis: time
    zuschlag_nacht_pct: float
    zuschlag_sonntag_pct: float
    zuschlag_feiertag_pct: float
    zuschlag_ueberstunden_pct: float
    urlaubstage: float
    urlaubsjahr_start_monat: int
    uebertrag_verfall_monat: int | None
    quelle: str
    hinweise: tuple[str, ...] = field(default_factory=tuple)


# EU-Basis: gilt für jedes Land, das unten keine eigene Zeile hat. Die
# Richtlinie kennt keine Tagesgrenze — 13 h ergeben sich aus 24 h minus 11 h
# Ruhezeit und stehen deshalb hier, nicht als Erfindung.
_EU_BASIS = Vorschlag(
    ruhezeit_stunden=11,
    max_tagesstunden=13,
    max_wochenstunden=48,
    nacht_von=time(22, 0),
    nacht_bis=time(6, 0),
    zuschlag_nacht_pct=0,
    zuschlag_sonntag_pct=0,
    zuschlag_feiertag_pct=0,
    zuschlag_ueberstunden_pct=0,
    urlaubstage=20,
    urlaubsjahr_start_monat=1,
    uebertrag_verfall_monat=None,
    quelle=_EU_QUELLE,
    hinweise=(
        "Nur die EU-Mindestwerte. Nationale Grenzen und Tarifzuschläge dieses "
        "Landes sind hier nicht hinterlegt — bitte eintragen.",
    ),
)

_ZUSCHLAG_TARIF = "Zuschläge sind Tarif-/Vertragssache, kein Gesetz — Tarifwert eintragen."

VORSCHLAEGE: dict[str, Vorschlag] = {
    "DK": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=13,
        max_wochenstunden=48,
        nacht_von=time(23, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=25,
        urlaubsjahr_start_monat=9,
        uebertrag_verfall_monat=12,
        quelle=(
            "Arbejdsmiljøloven §50 (11-timers-regel), Arbejdstidsloven §4 (48 h), "
            "Ferieloven 2020 §7 (25 dage, ferieår 1.9.–31.8., afholdelse bis 31.12.)"
        ),
        hinweise=(
            "Dänemark kennt keine gesetzliche Tagesgrenze; 13 h folgen aus der Ruhezeit.",
            _ZUSCHLAG_TARIF,
        ),
    ),
    "DE": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=10,
        max_wochenstunden=48,
        nacht_von=time(23, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=25,
        zuschlag_sonntag_pct=50,
        zuschlag_feiertag_pct=125,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=20,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=3,
        quelle=(
            "ArbZG §3 (8 h, bis 10 h mit Ausgleich), §5 (11 h Ruhezeit), §2 Abs. 3 "
            "(Nacht 23–6), BUrlG §3 (24 Werktage = 20 Arbeitstage), §7 Abs. 3 "
            "(Übertrag bis 31.3.); Zuschläge = steuerfreie Höchstsätze §3b EStG"
        ),
        hinweise=(
            "Die Zuschläge sind die STEUERFREIEN Höchstsätze, keine Pflicht — "
            "Tarif/Vertrag entscheidet.",
        ),
    ),
    "AT": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=12,
        max_wochenstunden=60,
        nacht_von=time(22, 0),
        nacht_bis=time(5, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=50,
        urlaubstage=25,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=None,
        quelle=(
            "AZG §9 (12 h Tag, 60 h Woche, 48 h im Durchschnitt), ARG §12 (11 h), "
            "AZG §10 (50 % Überstundenzuschlag), UrlG §2 (30 Werktage = 25 Arbeitstage)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "NL": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=12,
        max_wochenstunden=60,
        nacht_von=time(0, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=20,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=6,
        quelle=(
            "Arbeidstijdenwet art. 5:3 (11 h), 5:7 (12 h/Dienst, 60 h/Woche, 48 h im "
            "Durchschnitt), BW 7:634 (4× Wochenarbeitszeit), 7:640a (Verfall 1.7.)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "FR": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=10,
        max_wochenstunden=48,
        nacht_von=time(21, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=25,
        urlaubstage=25,
        urlaubsjahr_start_monat=6,
        uebertrag_verfall_monat=None,
        quelle=(
            "Code du travail L3121-18 (10 h), L3121-20 (48 h), L3131-1 (11 h), "
            "L3122-2 (Nacht 21–6), L3121-36 (25 % ab der 36. Stunde), L3141-3 "
            "(2,5 jours ouvrables/Monat = 25 Arbeitstage), Referenzjahr ab 1.6."
        ),
    ),
    "SE": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=13,
        max_wochenstunden=48,
        nacht_von=time(22, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=25,
        urlaubsjahr_start_monat=4,
        uebertrag_verfall_monat=None,
        quelle=(
            "Arbetstidslagen §13 (11 h), §8 (48 h inkl. Überstunden), "
            "Semesterlagen §4 (25 dagar), §3 (semesterår 1.4.–31.3.)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "ES": Vorschlag(
        ruhezeit_stunden=12,
        max_tagesstunden=9,
        max_wochenstunden=40,
        nacht_von=time(22, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=22,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=None,
        quelle=(
            "Estatuto de los Trabajadores art. 34 (40 h, 9 h, 12 h Ruhezeit), "
            "art. 36 (Nacht 22–6), art. 38 (30 días naturales ≈ 22 Arbeitstage)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "IT": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=13,
        max_wochenstunden=48,
        nacht_von=time(22, 0),
        nacht_bis=time(5, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=20,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=None,
        quelle=(
            "D.Lgs. 66/2003 art. 4 (48 h), art. 7 (11 h), art. 1 (Nacht 7 h inkl. "
            "0–5), art. 10 (4 Wochen Urlaub)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "PL": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=8,
        max_wochenstunden=48,
        nacht_von=time(21, 0),
        nacht_bis=time(7, 0),
        zuschlag_nacht_pct=20,
        zuschlag_sonntag_pct=100,
        zuschlag_feiertag_pct=100,
        zuschlag_ueberstunden_pct=50,
        urlaubstage=20,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=9,
        quelle=(
            "Kodeks pracy art. 129 (8 h/40 h), art. 131 (48 h), art. 132 (11 h), "
            "art. 151⁷ (Nacht 8 h zwischen 21–7, 20 % Zuschlag), art. 151¹ (50 %/100 %), "
            "art. 154 (20/26 Tage), art. 168 (Rest bis 30.9.)"
        ),
        hinweise=("26 Tage bei ≥ 10 Jahren Beschäftigung (art. 154).",),
    ),
    "PT": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=8,
        max_wochenstunden=48,
        nacht_von=time(22, 0),
        nacht_bis=time(7, 0),
        zuschlag_nacht_pct=25,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=25,
        urlaubstage=22,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=4,
        quelle=(
            "Código do Trabalho art. 203 (8 h/40 h), art. 211 (48 h), art. 214 (11 h), "
            "art. 223 (Nacht), art. 266 (25 % Nachtzuschlag), art. 268 (Überstunden), "
            "art. 238 (22 dias úteis), art. 240 (bis 30.4.)"
        ),
    ),
    "FI": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=13,
        max_wochenstunden=48,
        nacht_von=time(23, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=100,
        zuschlag_feiertag_pct=100,
        zuschlag_ueberstunden_pct=50,
        urlaubstage=25,
        urlaubsjahr_start_monat=4,
        uebertrag_verfall_monat=None,
        quelle=(
            "Työaikalaki 872/2019 §25 (11 h), §18 (48 h), §8 (Nacht 23–6), §20 "
            "(Sonntag 100 %), §20 (Überstunden 50 %), Vuosilomalaki §5 "
            "(2,5 Tage/Monat, lomanmääräytymisvuosi 1.4.–31.3.)"
        ),
    ),
    "BE": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=9,
        max_wochenstunden=48,
        nacht_von=time(20, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=50,
        urlaubstage=20,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=None,
        quelle=(
            "Arbeidswet 16.3.1971 art. 19 (8 h/38 h, 9 h), art. 38ter (11 h), "
            "art. 35 (Nacht 20–6), art. 29 (50 %/100 % Überstunden), "
            "Jaarlijkse vakantie 20 Tage (4 Wochen)"
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "IE": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=13,
        max_wochenstunden=48,
        nacht_von=time(0, 0),
        nacht_bis=time(7, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubstage=20,
        urlaubsjahr_start_monat=4,
        uebertrag_verfall_monat=None,
        quelle=(
            "Organisation of Working Time Act 1997 s.11 (11 h), s.15 (48 h), s.16 "
            "(Nacht 0–7), s.19 (4 Wochen), s.14 (Sonntagsprämie nach Vereinbarung), "
            "leave year 1.4.–31.3."
        ),
        hinweise=(_ZUSCHLAG_TARIF,),
    ),
    "LU": Vorschlag(
        ruhezeit_stunden=11,
        max_tagesstunden=10,
        max_wochenstunden=48,
        nacht_von=time(22, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=70,
        zuschlag_feiertag_pct=100,
        zuschlag_ueberstunden_pct=40,
        urlaubstage=26,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=3,
        quelle=(
            "Code du travail L.211-12 (10 h/48 h), L.211-16 (11 h), L.211-27 "
            "(40 % Überstunden), L.231-7 (70 % Sonntag), L.232-7 (100 % Feiertag), "
            "L.233-4 (26 Tage), L.233-10 (Übertrag bis 31.3.)"
        ),
    ),
}


@dataclass(frozen=True, slots=True)
class Jugendschutz:
    """Jugendarbeitsschutz eines Landes (0544) — Alter, Tageshöchstdauer, Nacht.

    Eigenes Objekt mit eigener Quelle, weil Jugendschutz in einem ANDEREN Gesetz
    steht als die allgemeine Arbeitszeit (DE: JArbSchG vs. ArbZG).
    """

    bis_alter: int
    max_tagesstunden: float
    nacht_von: time
    nacht_bis: time
    quelle: str


# Nur Länder, für die die Vorschrift hier belegt nachgelesen ist. Ein Land ohne
# Zeile bekommt KEINEN Vorschlag (None) — der Betrieb trägt seine Werte ein.
# Ein aus einem Nachbarland „abgeleiteter" Jugendschutz wäre ein erfundener
# Rechtswert (Wurzel 4) und im Ernstfall eine Ordnungswidrigkeit.
JUGENDSCHUTZ: dict[str, Jugendschutz] = {
    "DE": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=8,
        nacht_von=time(20, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "JArbSchG §8 Abs. 1 (8 h täglich, 40 h wöchentlich), §14 Abs. 1 "
            "(Beschäftigung nur 6–20 Uhr), §2 Abs. 2 (Jugendlicher = unter 18)"
        ),
    ),
    "AT": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=8,
        nacht_von=time(20, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "KJBG §11 Abs. 1 (8 h täglich, 40 h wöchentlich), §17 Abs. 1 "
            "(Nachtruhe 20–6 Uhr), §1 (Jugendlicher = unter 18)"
        ),
    ),
    "DK": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=8,
        nacht_von=time(20, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "Arbejdsmiljøloven §60 i.V.m. Bek. 1049/2020 om unges arbejde §12 "
            "(8 timer dagligt, 40 timer ugentligt) og §21 (natperiode 20–6)"
        ),
    ),
    "NL": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=9,
        nacht_von=time(23, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "Arbeidstijdenwet art. 5:7 en Arbeidstijdenbesluit §4.2 "
            "(16–17 jaar: 9 uur per dienst, 45 uur per week; nachtarbeid verboden)"
        ),
    ),
    "FR": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=8,
        nacht_von=time(22, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "Code du travail L3162-1 (8 h par jour, 35 h par semaine pour les "
            "moins de 18 ans), L3163-1 (travail de nuit interdit 22 h–6 h)"
        ),
    ),
    "PL": Jugendschutz(
        bis_alter=18,
        max_tagesstunden=8,
        nacht_von=time(22, 0),
        nacht_bis=time(6, 0),
        quelle=(
            "Kodeks pracy art. 202 §2 (8 h dla pracownika młodocianego powyżej "
            "16 lat), art. 203 §1 (zakaz pracy w porze nocnej 22–6)"
        ),
    ),
}
# Die EU-Grundlage, die HINTER diesen Zeilen steht: Richtlinie 94/33/EG Art. 8
# (8 h/Tag, 40 h/Woche für Jugendliche) und Art. 9 (Nachtarbeitsverbot). Sie
# begründet KEINEN eigenen Vorschlag, weil die nationale Umsetzung die
# Nachtzeit unterschiedlich legt (20, 22 oder 23 Uhr) — genau der Wert, den man
# nicht raten darf.


def jugendschutz_fuer(land: str | None) -> Jugendschutz | None:
    """Jugendschutz-Vorschlag eines Landes oder None (kein Rateweg, Wurzel 4)."""
    if not land:
        return None
    return JUGENDSCHUTZ.get(land.upper())


def vorschlag_fuer(land: str | None) -> tuple[Vorschlag | None, bool]:
    """(Vorschlag, landesspezifisch?) — None für Nicht-EU oder fehlendes Land.

    Kein stiller Rückfall auf ein anderes Land (Wurzel 4): ein Betrieb außerhalb
    der EU bekommt keinen Vorschlag und trägt seine Werte selbst ein.
    """
    if not land:
        return None, False
    code = land.upper()
    if code not in EU_LAENDER:
        return None, False
    eigen = VORSCHLAEGE.get(code)
    if eigen is not None:
        return eigen, True
    return _EU_BASIS, False


def zeitzone_fuer(land: str | None) -> str | None:
    return ZEITZONE.get((land or "").upper())
