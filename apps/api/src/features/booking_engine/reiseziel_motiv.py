"""Motiv-Wahl für die Reiseziel-Illustrationen des Suchfelds.

Ein Reiseziel bekommt keine hochgeladene Bilddatei je Stadt (das skaliert nicht
auf „alle Orte weltweit" und wäre bei Fremdbildern eine Rechtefrage), sondern
eines von wenigen selbst gezeichneten Motiven, das aus den Daten des Ortes
abgeleitet wird: Objekttyp + Koordinaten-Lage. Damit funktioniert es für Skagen
genauso wie für Osaka, ohne Pflegeliste.

Die Ableitung ist bewusst hier (Server) und nicht im Frontend: Plattform, App und
White-Label-Seiten sollen für denselben Ort dasselbe Motiv zeigen.

Kein Fallback, der etwas Falsches behauptet: ohne Koordinaten und ohne sprechenden
Typ bleibt es beim neutralen Motiv (`land` für Orte, `welt` für Länder) — das ist
eine Illustration, keine Aussage über die Landschaft (Wurzel 4).
"""
from src.core.countries import known_country_codes

# Die gezeichneten Landschafts-/Neutral-Motive (plattform/public/reiseziele/).
# Neue Motive brauchen NUR hier + eine Datei mit demselben Namen.
LANDSCHAFTS_MOTIVE = ("kueste", "insel", "berge", "see", "stadt", "land", "welt")

# Länder mit eigener gezeichneter Flagge (`land-<iso2>.svg`). Aus derselben Quelle
# wie die Ländernamen, damit Flaggen und Namen nicht auseinanderlaufen: jedes Land,
# das wir benennen können, hat auch eine Flagge.
_FLAGGEN: frozenset[str] = known_country_codes()

# Alle Motive, die vorkommen können — für die Vollständigkeitsprüfung im Test.
MOTIVE = (*LANDSCHAFTS_MOTIVE, *(f"land-{c.lower()}" for c in sorted(_FLAGGEN)))

# Objekttypen, die die Lage schon eindeutig beschreiben — sie schlagen die
# Koordinaten-Heuristik, weil sie eine echte Eigenschaft des Objekts sind.
_TYP_MOTIV: dict[str, str] = {
    "hausboot": "see",
}

# Stadt-Motiv für Hotelzimmer-Typen: ein Zimmertyp steht praktisch immer in einem
# bebauten Ort, nie auf freier Flur.
_HOTEL_TYPEN = frozenset(
    {
        "doppelzimmer",
        "zweibettzimmer",
        "familienzimmer",
        "junior_suite",
        "suite",
    }
)

# Grobe Küsten-/Gebirgszonen als Rechtecke (lat_min, lat_max, lng_min, lng_max).
# Absichtlich grob und klein gehalten: es entscheidet über eine ILLUSTRATION,
# nicht über Preis, Verfügbarkeit oder eine Sachaussage. Eine echte Geodaten-
# Auflösung (Küstenlinie, Höhenmodell) wäre ein eigener Dienst — hier wäre sie
# Aufwand ohne Nutzen für den Gast.
_GEBIRGE: tuple[tuple[float, float, float, float], ...] = (
    (43.0, 48.5, 5.0, 16.5),    # Alpen
    (42.0, 43.9, -2.0, 3.5),    # Pyrenäen
    (45.0, 49.5, 22.0, 27.0),   # Karpaten
    (36.0, 43.0, -6.0, -1.0),   # Sierra Nevada / Betische Kordillere
    (60.0, 71.0, 5.0, 18.0),    # Skanden
    (35.0, 41.0, 20.0, 30.0),   # Pindos / Balkan-Süd
    (27.0, 36.0, 72.0, 96.0),   # Himalaya
    (32.0, 50.0, -125.0, -105.0),  # Rocky Mountains / Sierra Nevada (US)
    (-56.0, 0.0, -80.0, -62.0),    # Anden
    (35.0, 46.0, 136.0, 146.0),    # Japanische Alpen
)

_INSELN: tuple[tuple[float, float, float, float], ...] = (
    (38.6, 40.1, 1.1, 4.4),     # Balearen
    (27.5, 29.5, -18.3, -13.3),  # Kanaren
    (34.7, 35.8, 23.4, 26.4),   # Kreta
    (35.7, 36.9, 14.1, 15.7),   # Malta / Sizilien-Süd
    (53.5, 55.1, 7.8, 9.2),     # Nordfriesische Inseln (Sylt, Föhr, Amrum)
    (16.5, 21.5, -160.5, -154.5),  # Hawaii
    (-9.5, -5.5, 114.0, 120.0),    # Bali / Kleine Sundainseln
    (17.0, 19.2, -78.5, -76.1),    # Jamaika
)

_KUESTEN: tuple[tuple[float, float, float, float], ...] = (
    (53.0, 58.0, 6.0, 15.5),    # Nord- und Ostseeküste (DE/DK/SE)
    (58.0, 71.5, 4.0, 32.0),    # Skandinavische Küste
    (36.0, 44.0, -10.0, 4.0),   # Iberische Küste
    (36.0, 45.5, 4.0, 19.0),    # Mittelmeerküste IT/FR
    (34.0, 42.5, 19.0, 30.0),   # Adria / Ägäis
    (49.0, 52.5, -6.0, 2.0),    # Kanal / Bretagne-Nordsee
    (24.0, 46.0, -82.0, -68.0),  # US-Ostküste
    (32.0, 49.0, -125.5, -119.5),  # US-Westküste
    (-38.0, -10.0, 140.0, 154.0),  # Australien Ostküste
    (5.0, 21.0, 97.0, 110.0),      # Südostasiatische Küste
)


# Großstadt-Kerne: enge Rechtecke um Metropolen, die sonst von einer groben
# Landschafts-Zone eingefangen würden (Wien liegt im Alpen-Rechteck, Barcelona und
# Kopenhagen in Küsten-Rechtecken). Bewusst ENG (~0.3° ≈ 30 km) und bewusst kurz:
# jede Zeile hier ist eine Ausnahme von der Heuristik, keine Städteliste, die
# vollständig werden soll. Ein nicht gelistetes Millionending bekommt einfach das
# Landschaftsmotiv seiner Region — das ist keine Falschaussage, nur unspezifisch.
_GROSSSTAEDTE: tuple[tuple[float, float, float, float], ...] = (
    (48.10, 48.33, 16.20, 16.58),   # Wien
    (52.35, 52.68, 13.10, 13.77),   # Berlin
    (53.40, 53.68, 9.75, 10.20),    # Hamburg (liegt im Nordsee-Küstenrechteck)
    (48.05, 48.25, 11.35, 11.72),   # München
    (50.05, 50.20, 8.55, 8.80),     # Frankfurt am Main
    (48.75, 48.90, 2.20, 2.47),     # Paris
    (51.40, 51.60, -0.30, 0.05),    # London
    (41.32, 41.47, 2.05, 2.28),     # Barcelona
    (40.35, 40.52, -3.80, -3.60),   # Madrid
    (41.80, 41.99, 12.38, 12.62),   # Rom
    (45.40, 45.55, 9.10, 9.28),     # Mailand
    (55.60, 55.75, 12.45, 12.68),   # Kopenhagen
    (59.27, 59.40, 17.95, 18.20),   # Stockholm
    (52.30, 52.43, 4.78, 5.02),     # Amsterdam
    (47.32, 47.44, 8.45, 8.62),     # Zürich
    (40.65, 40.85, -74.05, -73.85),  # New York
    (35.60, 35.78, 139.62, 139.85),  # Tokio
)


# Prüf-Reihenfolge: PRÄZISE vor GROB, gemessen an der Größe der Rechtecke.
# Als Tabelle statt als if-Kette, damit die Reihenfolge an EINER Stelle sichtbar
# ist — sie ist die eigentliche Logik und war zweimal die Fehlerquelle.
_ZONEN_REIHENFOLGE: tuple[
    tuple[str, tuple[tuple[float, float, float, float], ...]], ...
] = (
    ("stadt", _GROSSSTAEDTE),  # ~30 km
    ("insel", _INSELN),        # Inselgruppen
    ("kueste", _KUESTEN),      # Küstenstreifen
    ("berge", _GEBIRGE),       # Gebirgszüge, am gröbsten
)


def _in_zone(
    lat: float, lng: float, zonen: tuple[tuple[float, float, float, float], ...]
) -> bool:
    return any(
        lat_min <= lat <= lat_max and lng_min <= lng <= lng_max
        for lat_min, lat_max, lng_min, lng_max in zonen
    )


def stadt_motiv(
    property_type: str | None,
    lat: float | None,
    lng: float | None,
) -> str:
    """Motiv-Name für einen ORT.

    Das Motiv beschreibt den ORT, nicht das einzelne Objekt — deshalb entscheidet
    die LAGE zuerst und der Objekttyp nur, wenn die Lage nichts hergibt. Gegen die
    echten Live-Daten geprüft; die umgekehrte Reihenfolge lag dreifach falsch:
    Rostock-Warnemünde (Ostseebad) wurde „stadt", weil dort Hotelzimmer liegen,
    und Hamburg wurde „see", weil dort ein Hausboot liegt.

    Innerhalb der Lage gilt strikt PRÄZISE vor GROB — nach Größe des Rechtecks,
    nicht nach Gefühl: Großstadt-Kerne (~30 km) → Inseln → Küsten → Gebirge
    (tausende km breit). Andere Reihenfolgen lagen live falsch: Hamburg wurde
    „kueste" (das Nordsee-Rechteck reicht bis über die Elbe), Wien wurde „berge"
    (das Alpen-Rechteck enthält die Stadt).
    """
    if lat is not None and lng is not None:
        for motiv, zonen in _ZONEN_REIHENFOLGE:
            if _in_zone(lat, lng, zonen):
                return motiv
    typ = (property_type or "").strip().lower()
    if typ in _TYP_MOTIV:
        return _TYP_MOTIV[typ]
    if typ in _HOTEL_TYPEN:
        return "stadt"
    return "land"


def land_motiv(country: str | None = None) -> str:
    """Motiv für ein LAND: seine Flagge (``land-<iso2>``).

    Ein Land hat keine eine Landschaft, deshalb bekommt es kein Landschaftsmotiv.
    Vorher trugen ALLE Länder dasselbe Welt-Motiv und waren im Suchfeld nicht
    unterscheidbar — jedes Land hat jetzt seine eigene gezeichnete Flagge.

    Unbekannter/fehlender Code → das neutrale Welt-Motiv. Keine geratene Flagge
    (ein falsches Hoheitszeichen ist eine Falschaussage, Wurzel 4)."""
    code = (country or "").strip().upper()
    return f"land-{code.lower()}" if code in _FLAGGEN else "welt"
