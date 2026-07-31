"""Der Demo-Bestand: zwei Betriebe, ihre Objekte, Gäste und Foto-Suchbegriffe.

Zwei Tenants, weil das Datenmodell keinen Mischbetrieb kennt und beide Welten
gezeigt werden sollen (CLAUDE.md „1 property = 1 buchbare Einheit"):

* `nordlicht` — Ferienvermietung mit 8 Ferienobjekten → Belegungsplan-Screenshot.
* `seeblick`  — Hotel mit 12 Zimmern, jedes Zimmer eine eigene `properties`-Zeile
  (KEIN Container mit Zimmerkategorien) → Rate-Grid-Screenshot.

Beide rechnen in EUR. Das ist keine Bequemlichkeit, sondern Voraussetzung für ein
brauchbares Bild: der Belegungsplan zeigt Umsatz und ADR bewusst als „—", sobald
im sichtbaren Fenster mehrere Währungen liegen (web/components/kalender/
calendar-board.tsx) — inkommensurable Beträge werden nie addiert. Ein
Mehrwährungs-Beweis gehört auf einen eigenen Screenshot, nicht in diesen.

Ausstattungs-Slugs stammen aus dem Channex-Facility-Katalog
(`web/lib/property-meta.ts`) — keine erfundenen Codes.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Objekt:  # pylint: disable=too-many-instance-attributes
    """Eine buchbare Einheit — Ferienobjekt ODER einzelnes Hotelzimmer.

    Viele Felder, weil eine Objektzeile in der App viele Felder hat: Adresse,
    Taxonomie, Kapazität, Preis und Ausstattung gehören fachlich zusammen und
    wären als Unterobjekte nur künstlich getrennt.
    """

    schluessel: str
    titel: str
    property_type: str
    category_slug: str
    subtype_slug: str
    listing_type: str
    strasse: str
    hausnummer: str
    plz: str
    stadt: str
    land: str
    lat: float
    lng: float
    max_gaeste: int
    grundpreis: float
    wochenend_aufschlag: float
    min_aufenthalt: int
    beschreibung: str
    ausstattung: list[str]
    foto_suche: str
    foto_anzahl: int = 6
    # Zweiter Rate-Plan (Hotel): Name des abgeleiteten Plans + Aufschlag in der
    # Objektwährung. None = nur der Standard-Plan.
    zweiter_plan: tuple[str, float] | None = None


@dataclass(frozen=True)
class Betrieb:  # pylint: disable=too-many-instance-attributes
    """Ein Demo-Mandant mit seinen buchbaren Einheiten."""

    schluessel: str
    name: str
    land: str
    waehrung: str
    business_type: str
    accommodation_type: str
    login: str
    kontakt_name: str
    objekte: list[Objekt] = field(default_factory=list)


_FEWO_BASIS = ["wifi", "heating", "non_smoking_rooms", "smoke_alarms", "key_access"]
_HOTEL_BASIS = [
    "wifi", "heating", "air_conditioning", "24_hour_front_desk", "non_smoking_rooms",
    "elevators", "safe", "housekeeping_daily", "breakfast", "key_card_access",
]


NORDLICHT = Betrieb(
    schluessel="nordlicht",
    name="Nordlicht Ferienvermietung",
    land="DE",
    waehrung="EUR",
    business_type="agency",
    accommodation_type="vacation_rental",
    login="merle.ahrens@mynextdays.com",
    kontakt_name="Merle Ahrens",
    objekte=[
        Objekt(
            schluessel="duenenblick",
            titel="Strandhaus Dünenblick",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="cottage", listing_type="entire_place",
            strasse="Deichstraße", hausnummer="12", plz="18374", stadt="Zingst", land="DE",
            lat=54.4419, lng=12.6889,
            max_gaeste=6, grundpreis=189.0, wochenend_aufschlag=35.0, min_aufenthalt=3,
            beschreibung=(
                "Reetgedecktes Strandhaus in zweiter Dünenreihe, 300 m bis zum Wasser. "
                "Offener Wohnbereich mit Kamin, geschützte Holzterrasse nach Süden."
            ),
            ausstattung=_FEWO_BASIS + [
                "beachfront", "terrace", "garden", "pet_friendly", "bike_parking",
                "outdoor_furniture", "fire_pit",
            ],
            foto_suche="beach house dune",
            foto_anzahl=7,
        ),
        Objekt(
            schluessel="wattseite",
            titel="Reetdachkate Wattseite",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="cottage", listing_type="entire_place",
            strasse="Gurtstig", hausnummer="4", plz="25980", stadt="Keitum", land="DE",
            lat=54.8944, lng=8.3661,
            max_gaeste=4, grundpreis=245.0, wochenend_aufschlag=45.0, min_aufenthalt=4,
            beschreibung=(
                "Friesische Kate von 1898, denkmalgerecht saniert. Kaminofen, "
                "Fußbodenheizung, ummauerter Garten mit Blick über das Wattenmeer."
            ),
            ausstattung=_FEWO_BASIS + [
                "garden", "terrace", "sauna", "waterfront", "outdoor_furniture",
            ],
            foto_suche="thatched roof cottage",
            foto_anzahl=6,
        ),
        Objekt(
            schluessel="bergblick",
            titel="Alm-Chalet Bergblick",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="chalet", listing_type="entire_place",
            strasse="Aschauer Weg", hausnummer="27", plz="6370", stadt="Kitzbühel", land="AT",
            lat=47.4467, lng=12.3919,
            max_gaeste=8, grundpreis=320.0, wochenend_aufschlag=60.0, min_aufenthalt=5,
            beschreibung=(
                "Freistehendes Chalet auf 1.150 m mit Panoramafenstern zum Wilden Kaiser. "
                "Sauna, Skiraum mit Schuhtrocknern, Ski-in/Ski-out über die Talabfahrt."
            ),
            ausstattung=_FEWO_BASIS + [
                "sauna", "ski_to_door_access", "ski_storage", "jacuzzi_hot_tub",
                "terrace", "indoor_parking", "skiing",
            ],
            foto_suche="alpine chalet mountain",
            foto_anzahl=7,
        ),
        Objekt(
            schluessel="stephansplatz",
            titel="Altbau-Loft am Stephansplatz",
            property_type="appartement",
            category_slug="wohnung", subtype_slug="loft", listing_type="entire_place",
            strasse="Singerstraße", hausnummer="9", plz="1010", stadt="Wien", land="AT",
            lat=48.2081, lng=16.3738,
            max_gaeste=4, grundpreis=175.0, wochenend_aufschlag=25.0, min_aufenthalt=2,
            beschreibung=(
                "Loft im vierten Stock eines Gründerzeithauses, 4,10 m Stuckdecken, "
                "Aufzug. Zwei Gehminuten zum Stephansdom."
            ),
            ausstattung=_FEWO_BASIS + [
                "elevators", "air_conditioning", "laundry_facilities", "soundproof_rooms",
            ],
            foto_suche="loft apartment interior",
            foto_anzahl=6,
        ),
        Objekt(
            schluessel="son-mirabo",
            titel="Finca Son Mirabó",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="villa", listing_type="entire_place",
            strasse="Camí de Son Puça", hausnummer="18", plz="07100", stadt="Sóller", land="ES",
            lat=39.7667, lng=2.7156,
            max_gaeste=10, grundpreis=410.0, wochenend_aufschlag=70.0, min_aufenthalt=7,
            beschreibung=(
                "Finca aus Naturstein im Orangental, 8.000 m² Grund mit altem Olivenhain. "
                "Beheizter Pool, Außenküche, Dachterrasse über der Tramuntana."
            ),
            ausstattung=_FEWO_BASIS + [
                "swimming_pool", "heated_pool", "garden", "terrace", "bbq_picnic_area",
                "outdoor_furniture", "sun_loungers_or_beach_chairs", "air_conditioning",
            ],
            foto_suche="mediterranean villa pool",
            foto_anzahl=8,
        ),
        Objekt(
            schluessel="chiemgau",
            titel="Seehütte Chiemgau",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="huette", listing_type="entire_place",
            strasse="Seestraße", hausnummer="63", plz="83209", stadt="Prien am Chiemsee", land="DE",
            lat=47.8531, lng=12.3436,
            max_gaeste=4, grundpreis=155.0, wochenend_aufschlag=20.0, min_aufenthalt=2,
            beschreibung=(
                "Holzhütte direkt am Uferweg mit eigenem Steg und Ruderboot. "
                "Küche mit Holzofen, Schlafempore unter dem Giebel."
            ),
            ausstattung=_FEWO_BASIS + [
                "waterfront", "terrace", "fishing", "canoeing", "pet_friendly",
                "outdoor_furniture",
            ],
            foto_suche="lake cabin wooden",
            foto_anzahl=6,
        ),
        Objekt(
            schluessel="waldkrone",
            titel="Baumhaus Waldkrone",
            property_type="tiny_house",
            category_slug="einzigartig", subtype_slug="baumhaus", listing_type="entire_place",
            strasse="Am Perlenbach", hausnummer="3", plz="52156", stadt="Monschau", land="DE",
            lat=50.5556, lng=6.2444,
            max_gaeste=2, grundpreis=140.0, wochenend_aufschlag=30.0, min_aufenthalt=2,
            beschreibung=(
                "Baumhaus in sieben Metern Höhe, getragen von drei Eichen. "
                "Panoramafenster über den Nationalpark Eifel, Sternenhimmel ohne Streulicht."
            ),
            ausstattung=_FEWO_BASIS + ["terrace", "hiking", "cycling", "outdoor_furniture"],
            foto_suche="treehouse forest",
            foto_anzahl=6,
        ),
        Objekt(
            schluessel="elbperle",
            titel="Hausboot Elbperle",
            property_type="hausboot",
            category_slug="einzigartig", subtype_slug="boot", listing_type="entire_place",
            strasse="Kirchenpauerkai", hausnummer="1", plz="20457", stadt="Hamburg", land="DE",
            lat=53.5395, lng=9.9962,
            max_gaeste=4, grundpreis=210.0, wochenend_aufschlag=40.0, min_aufenthalt=2,
            beschreibung=(
                "Umgebauter Frachtkahn im Hafenbecken, Deck mit Blick auf die Elbphilharmonie. "
                "Zwei Kabinen, Salon mit bodentiefen Fenstern."
            ),
            ausstattung=_FEWO_BASIS + ["waterfront", "terrace", "outdoor_furniture", "bar"],
            foto_suche="houseboat harbour",
            foto_anzahl=6,
        ),
    ],
)


def _zimmer(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    schluessel: str, titel: str, property_type: str, subtype: str,
    max_gaeste: int, preis: float, aufschlag: float, beschreibung: str,
    ausstattung: list[str], foto_suche: str,
) -> Objekt:
    """Ein Hotelzimmer = eine eigene properties-Zeile, gleiche Adresse."""
    return Objekt(
        schluessel=schluessel, titel=titel,
        property_type=property_type,
        category_slug="hotel_betrieb", subtype_slug=subtype,
        listing_type="private_room",
        strasse="Seepromenade", hausnummer="45", plz="18119", stadt="Rostock-Warnemünde",
        land="DE", lat=54.1783, lng=12.0836,
        max_gaeste=max_gaeste, grundpreis=preis, wochenend_aufschlag=aufschlag,
        min_aufenthalt=1,
        beschreibung=beschreibung,
        ausstattung=_HOTEL_BASIS + ausstattung,
        foto_suche=foto_suche, foto_anzahl=4,
        # Zweiter, abgeleiteter Rate-Plan: Frühstück inklusive, +18 € auf den
        # Standardpreis — das ist die Konstellation, die das Rate-Grid zeigt.
        zweiter_plan=("Übernachtung mit Frühstück", 18.0),
    )


SEEBLICK = Betrieb(
    schluessel="seeblick",
    name="Hotel Seeblick Warnemünde",
    land="DE",
    waehrung="EUR",
    business_type="self_managed",
    accommodation_type="hotel",
    login="jonas.reimers@mynextdays.com",
    kontakt_name="Jonas Reimers",
    objekte=[
        _zimmer("z201", "Doppelzimmer 201 · Seeseite", "doppelzimmer", "hotel", 2,
                139.0, 25.0, "Doppelzimmer mit französischem Balkon zur Ostsee, 24 m².",
                ["sun_terrace"], "hotel room double bed"),
        _zimmer("z202", "Doppelzimmer 202 · Seeseite", "doppelzimmer", "hotel", 2,
                139.0, 25.0, "Doppelzimmer mit französischem Balkon zur Ostsee, 24 m².",
                ["sun_terrace"], "hotel room double bed"),
        _zimmer("z203", "Doppelzimmer 203 · Hofseite", "doppelzimmer", "hotel", 2,
                119.0, 20.0, "Ruhiges Doppelzimmer zum begrünten Innenhof, 22 m².",
                [], "hotel bedroom modern"),
        _zimmer("z204", "Doppelzimmer 204 · Hofseite", "doppelzimmer", "hotel", 2,
                119.0, 20.0, "Ruhiges Doppelzimmer zum begrünten Innenhof, 22 m².",
                [], "hotel bedroom modern"),
        _zimmer("z205", "Zweibettzimmer 205", "zweibettzimmer", "hotel", 2,
                125.0, 20.0, "Zwei getrennte Betten, Schreibtisch, 23 m².",
                [], "twin beds hotel room"),
        _zimmer("z206", "Zweibettzimmer 206", "zweibettzimmer", "hotel", 2,
                125.0, 20.0, "Zwei getrennte Betten, Schreibtisch, 23 m².",
                [], "twin beds hotel room"),
        _zimmer("z207", "Zweibettzimmer 207 · barrierefrei", "zweibettzimmer", "hotel", 2,
                125.0, 20.0, "Barrierefreies Zweibettzimmer, bodengleiche Dusche, 28 m².",
                ["rooms_facilities_for_disabled", "property_is_wheel_chair_accessible"],
                "accessible hotel room"),
        _zimmer("z208", "Familienzimmer 208", "familienzimmer", "hotel", 4,
                179.0, 30.0, "Zwei verbundene Räume, vier Betten, 38 m².",
                ["family_rooms", "indoor_play_area"], "family hotel room"),
        _zimmer("z301", "Junior-Suite 301", "junior_suite", "hotel", 3,
                199.0, 35.0, "Junior-Suite mit Sitzbereich und Ostseeblick, 34 m².",
                ["sun_terrace", "pool_towels"], "junior suite hotel"),
        _zimmer("z302", "Junior-Suite 302", "junior_suite", "hotel", 3,
                199.0, 35.0, "Junior-Suite mit Sitzbereich und Ostseeblick, 34 m².",
                ["sun_terrace"], "junior suite hotel"),
        _zimmer("z401", "Suite 401 · Leuchtturm", "suite", "hotel", 4,
                289.0, 50.0, "Eckzimmer-Suite über zwei Fensterfronten, Blick auf den "
                             "Leuchtturm, 52 m².",
                ["jacuzzi_hot_tub", "sun_terrace"], "hotel suite luxury"),
        _zimmer("z402", "Suite 402 · Panorama", "suite", "hotel", 4,
                289.0, 50.0, "Dachgeschoss-Suite mit umlaufender Terrasse, 55 m².",
                ["jacuzzi_hot_tub", "sun_terrace", "spa_wellness_packages"],
                "penthouse suite terrace"),
    ],
)

BETRIEBE = [NORDLICHT, SEEBLICK]


# Gästenamen für die Buchungen. Europäischer Mix, damit die Buchungsliste nicht
# nach Testdaten aussieht. Erfundene Personen, keine realen Vorbilder.
GAESTE: list[tuple[str, str, str]] = [
    ("Lena", "Brandt", "DE"), ("Tobias", "Kern", "DE"), ("Anneke", "de Vries", "NL"),
    ("Pieter", "Jansen", "NL"), ("Sofia", "Lindqvist", "SE"), ("Mats", "Eriksson", "SE"),
    ("Camille", "Roux", "FR"), ("Julien", "Marchand", "FR"), ("Elena", "Ricci", "IT"),
    ("Marco", "Bianchi", "IT"), ("Katrine", "Holm", "DK"), ("Rasmus", "Nygaard", "DK"),
    ("Julia", "Kowalska", "PL"), ("Piotr", "Zielinski", "PL"), ("Ines", "Ferreira", "PT"),
    ("Diogo", "Santos", "PT"), ("Hannah", "Vogel", "DE"), ("Simon", "Rieger", "DE"),
    ("Nora", "Hansen", "NO"), ("Erik", "Solberg", "NO"), ("Marta", "Nowak", "PL"),
    ("Lucas", "Meyer", "CH"), ("Nadja", "Weber", "CH"), ("Aoife", "Byrne", "IE"),
    ("Declan", "Murphy", "IE"), ("Zsofia", "Nagy", "HU"), ("Bence", "Toth", "HU"),
    ("Clara", "Moreau", "BE"), ("Thomas", "Peeters", "BE"), ("Emma", "Larsen", "DK"),
    ("Felix", "Baumann", "AT"), ("Theresa", "Gruber", "AT"), ("Ana", "Popescu", "RO"),
    ("Andrei", "Ionescu", "RO"), ("Maja", "Novak", "SI"), ("Luka", "Horvat", "HR"),
    ("Ida", "Virtanen", "FI"), ("Aleksi", "Nieminen", "FI"), ("Carmen", "Delgado", "ES"),
    ("Pablo", "Herrera", "ES"),
]
