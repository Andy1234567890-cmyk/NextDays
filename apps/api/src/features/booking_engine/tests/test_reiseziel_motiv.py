"""Motiv-Wahl der Reiseziel-Illustrationen: Objekttyp schlägt Lage, Lage schlägt
neutral, und ohne beides wird nichts behauptet (Wurzel 4).

Jedes zurückgegebene Motiv MUSS eine gezeichnete Datei haben — sonst zeigt das
Suchfeld ein kaputtes Bild.
"""
from pathlib import Path

from src.core.countries import known_country_codes
from src.features.booking_engine.reiseziel_motiv import (
    MOTIVE,
    land_motiv,
    stadt_motiv,
)

# plattform/public/reiseziele/<motiv>.svg — vom Repo-Wurzelverzeichnis aus.
_SVG_DIR = (
    Path(__file__).resolve().parents[6] / "plattform" / "public" / "reiseziele"
)


def test_jedes_motiv_hat_eine_svg_datei() -> None:
    fehlend = [m for m in MOTIVE if not (_SVG_DIR / f"{m}.svg").is_file()]
    assert not fehlend, f"Illustration fehlt für: {fehlend}"


def test_lage_schlaegt_den_objekttyp() -> None:
    """Das Motiv beschreibt den ORT, nicht das einzelne Objekt. Ein Hausboot in
    einem Ostseebad macht daraus keine Seenlandschaft, ein Hotelzimmer keine
    Innenstadt — beides lag live falsch, bevor die Lage zuerst entschied."""
    assert stadt_motiv("hausboot", 54.18, 12.08) == "kueste"  # Warnemünde
    assert stadt_motiv("doppelzimmer", 54.18, 12.08) == "kueste"
    assert stadt_motiv("suite", 54.9, 8.3) == "insel"  # Sylt


def test_praezise_zone_schlaegt_grobe_zone() -> None:
    """Großstadt-Kerne (~30 km) müssen VOR den tausende km breiten Küsten- und
    Gebirgsrechtecken greifen. Beide Fälle sind live aufgetreten: Hamburg liegt im
    Nordsee-Rechteck, Wien im Alpen-Rechteck."""
    assert stadt_motiv("hausboot", 53.5395, 9.9962) == "stadt"  # Hamburg
    assert stadt_motiv("ferienhaus", 48.21, 16.37) == "stadt"   # Wien


def test_lage_bestimmt_das_motiv() -> None:
    assert stadt_motiv("ferienhaus", 54.9, 8.3) == "insel"      # Keitum/Sylt
    assert stadt_motiv("ferienhaus", 54.18, 12.08) == "kueste"  # Warnemünde
    assert stadt_motiv("ferienhaus", 47.45, 12.39) == "berge"   # Kitzbühel
    assert stadt_motiv("ferienhaus", 39.77, 2.71) == "insel"    # Sóller/Mallorca
    assert stadt_motiv("ferienhaus", 57.44, 10.05) == "kueste"  # Bindslev/DK
    assert stadt_motiv("ferienhaus", 47.86, 12.34) == "berge"   # Prien/Chiemsee


def test_objekttyp_nur_wenn_die_lage_nichts_sagt() -> None:
    assert stadt_motiv("hausboot", None, None) == "see"
    assert stadt_motiv("suite", None, None) == "stadt"
    # Binnenland ohne Zonentreffer: der Typ darf dann entscheiden.
    assert stadt_motiv("doppelzimmer", 50.55, 6.24) == "stadt"  # Monschau


def test_ohne_daten_neutrales_motiv_statt_behauptung() -> None:
    assert stadt_motiv(None, None, None) == "land"
    assert stadt_motiv("ferienhaus", None, None) == "land"
    # Binnenland ohne Zonentreffer bleibt neutral, statt Küste zu erfinden.
    assert stadt_motiv("ferienhaus", 50.55, 6.24) == "land"  # Monschau


def test_jedes_land_hat_seine_eigene_flagge() -> None:
    """Vorher trugen ALLE Länder dasselbe Welt-Motiv und waren im Suchfeld nicht
    unterscheidbar. Jetzt bekommt jedes Land seine eigene Flagge."""
    assert land_motiv("DK") == "land-dk"
    assert land_motiv("dk") == "land-dk"
    assert land_motiv("AT") == "land-at"
    assert land_motiv("ES") == "land-es"
    # Alle bekannten Länder haben ein EIGENES, nicht geteiltes Motiv.
    codes = sorted(known_country_codes())
    motive = [land_motiv(c) for c in codes]
    assert len(set(motive)) == len(codes)
    assert all(m != "welt" for m in motive)


def test_unbekanntes_land_bekommt_keine_geratene_flagge() -> None:
    """Ein falsches Hoheitszeichen wäre eine Falschaussage (Wurzel 4) — dann
    lieber das neutrale Welt-Motiv."""
    assert land_motiv("XX") == "welt"
    assert land_motiv("") == "welt"
    assert land_motiv(None) == "welt"
    assert land_motiv() == "welt"


def test_motiv_immer_aus_dem_bekannten_satz() -> None:
    proben = [
        ("ferienhaus", 54.9, 8.3),
        ("hausboot", None, None),
        ("suite", 35.7, 139.7),
        (None, 0.0, 0.0),
        ("", -33.9, 151.2),
    ]
    for typ, lat, lng in proben:
        assert stadt_motiv(typ, lat, lng) in MOTIVE
