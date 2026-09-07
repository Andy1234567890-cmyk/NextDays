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
class Firma:  # pylint: disable=too-many-instance-attributes
    """Die Rechts- und Rechnungsdaten eines Betriebs.

    Sie landen in `tenant_billing_profile`. Ohne diese Zeile meldet das
    Onboarding zwar "Firmendaten gespeichert" (das Flag `company_data_set`
    steht), aber `DashboardService` prueft die ZEILE und setzt den Schritt
    zurueck — die Oberflaeche zeigt dann den Einrichtungs-Assistenten statt
    der Kennzahlen, und Rechnungen haben keinen Absender.

    Erfundene, aber formal gueltige Angaben: die USt-IdNr. folgt dem Muster
    des jeweiligen Landes, ist aber keiner echten Firma zugeordnet.
    """

    legal_name: str
    legal_form: str
    strasse: str
    hausnummer: str
    plz: str
    stadt: str
    land: str
    vat_id: str
    steuernummer: str
    handelsregister: str
    amtsgericht: str
    geschaeftsfuehrer: tuple[str, str]
    email: str
    telefon: str
    website: str
    iban: str
    bic: str
    bank: str
    steuersatz: float
    kurtaxe: float


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
    firma: "Firma"
    objekte: list[Objekt] = field(default_factory=list)
    # Oeffentlich anmeldbarer Vorfuehr-Mandant (`tenants.is_demo`, 0407/0529).
    # Muss der Seed MITSETZEN: er loescht die Mandanten-Zeile und legt sie neu
    # an, wodurch das per Migration gesetzte Flag auf den Default `false` fiel —
    # damit war die gesamte Vorfuehr-Absicherung wirkungslos (405-Schreibsperre,
    # 403-Bereichssperre, Schloss-Symbole, `storybook_chat`-Ausschluss), live
    # gemessen am 02.09.2026. Nur Nordlicht traegt es; Seeblick und Alpenzeit
    # sind Fotomodelle und sollen nicht oeffentlich anmeldbar sein (0407).
    ist_vorfuehrung: bool = False


_FEWO_BASIS = ["wifi", "heating", "non_smoking_rooms", "smoke_alarms", "key_access"]
_HOTEL_BASIS = [
    "wifi", "heating", "air_conditioning", "24_hour_front_desk", "non_smoking_rooms",
    "elevators", "safe", "housekeeping_daily", "breakfast", "key_card_access",
]


# ── Firmendaten ──────────────────────────────────────────────────────────────
# Erfundene Betriebe, aber formal gueltige Angaben: die IBANs tragen eine
# korrekte Pruefziffer (ISO 13616), die USt-IdNr. folgt dem Laendermuster.
# Ohne echte Werte wuerde die Rechnungsvorschau im Screenshot Fehler zeigen.
FIRMA_NORDLICHT = Firma(
    legal_name="Nordlicht Ferienvermietung GmbH",
    legal_form="GmbH",
    strasse="Hafenstraße", hausnummer="8", plz="18374", stadt="Zingst", land="DE",
    vat_id="DE312457890",
    steuernummer="079/128/54321",
    handelsregister="HRB 14827",
    amtsgericht="Amtsgericht Stralsund",
    geschaeftsfuehrer=("Merle", "Ahrens"),
    email="info@nordlicht-ferien.de",
    telefon="+49 38232 15480",
    website="https://www.nordlicht-ferien.de",
    iban="DE89370400440532013000",
    bic="COBADEFFXXX",
    bank="Commerzbank Stralsund",
    steuersatz=7.0,       # ermaessigt: Beherbergung (§ 12 Abs. 2 Nr. 11 UStG)
    kurtaxe=3.20,         # Kurabgabe Zingst je Person und Nacht
)

FIRMA_SEEBLICK = Firma(
    legal_name="Hotel Seeblick Warnemünde GmbH & Co. KG",
    legal_form="GmbH & Co. KG",
    strasse="Seepromenade", hausnummer="24", plz="18119", stadt="Rostock", land="DE",
    vat_id="DE289346127",
    steuernummer="079/145/29876",
    handelsregister="HRA 4291",
    amtsgericht="Amtsgericht Rostock",
    geschaeftsfuehrer=("Jonas", "Reimers"),
    email="empfang@hotel-seeblick-warnemuende.de",
    telefon="+49 381 5194200",
    website="https://www.hotel-seeblick-warnemuende.de",
    iban="DE44500105175407324931",
    bic="OSDDDE81ROS",
    bank="OstseeSparkasse Rostock",
    steuersatz=7.0,
    kurtaxe=2.50,         # Kurtaxe Warnemünde
)

FIRMA_ALPENZEIT = Firma(
    legal_name="Alpenzeit Chalets GmbH",
    legal_form="GmbH",
    strasse="Almweg", hausnummer="7", plz="6363", stadt="Westendorf", land="AT",
    vat_id="ATU67421908",
    steuernummer="81 234/5678",
    handelsregister="FN 412876t",
    amtsgericht="Landesgericht Innsbruck",
    geschaeftsfuehrer=("Theresa", "Gruber"),
    email="willkommen@alpenzeit-chalets.at",
    telefon="+43 5334 20418",
    website="https://www.alpenzeit-chalets.at",
    iban="AT691200000976534597",
    bic="BKAUATWWXXX",
    bank="UniCredit Bank Austria",
    steuersatz=10.0,      # Österreich: 10 % auf Beherbergung
    kurtaxe=2.80,         # Ortstaxe Tirol
)


NORDLICHT = Betrieb(
    schluessel="nordlicht",
    name="Nordlicht Ferienvermietung",
    land="DE",
    waehrung="EUR",
    business_type="agency",
    accommodation_type="vacation_rental",
    login="merle.ahrens@mynextdays.com",
    kontakt_name="Merle Ahrens",
    firma=FIRMA_NORDLICHT,
    ist_vorfuehrung=True,
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
    firma=FIRMA_SEEBLICK,
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

# Zweiter Ferienvermieter neben Nordlicht (30.08.2026). Grund: für die
# Marketing-Aufnahmen brauchte es ZWEI vollständige FeWo-Betriebe — Seeblick ist
# ein Hotel und zeigt das Rate-Grid, nicht den FeWo-Belegungsplan. Bewusst
# Alpenraum statt Küste: zwei Betriebe mit denselben Reetdächern und derselben
# Ostsee sähen auf zwei Screenshots nebeneinander wie derselbe Bestand aus.
ALPENZEIT = Betrieb(
    schluessel="alpenzeit",
    name="Alpenzeit Chalets",
    land="AT",
    waehrung="EUR",
    business_type="agency",
    accommodation_type="vacation_rental",
    login="theresa.gruber@mynextdays.com",
    kontakt_name="Theresa Gruber",
    firma=FIRMA_ALPENZEIT,
    objekte=[
        Objekt(
            schluessel="bergkristall",
            titel="Chalet Bergkristall",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="chalet", listing_type="entire_place",
            strasse="Almweg", hausnummer="7", plz="6363", stadt="Westendorf", land="AT",
            lat=47.4392, lng=12.2153,
            max_gaeste=8, grundpreis=245.0, wochenend_aufschlag=45.0, min_aufenthalt=4,
            beschreibung=(
                "Freistehendes Chalet aus Altholz auf 1.100 m, Panoramablick über das "
                "Brixental. Kachelofen, Sauna und eine Terrasse, auf der die Sonne bis "
                "zum letzten Licht steht. Skibus hält 200 m entfernt."
            ),
            ausstattung=["sauna", "fireplace", "sun_terrace", "parking", "wifi"],
            foto_suche="alpine chalet wooden interior",
        ),
        Objekt(
            schluessel="laerchenhof",
            titel="Ferienwohnung Lärchenhof",
            property_type="appartement",
            category_slug="wohnung", subtype_slug="ferienwohnung", listing_type="entire_place",
            strasse="Dorfstraße", hausnummer="24", plz="6363", stadt="Westendorf", land="AT",
            lat=47.4361, lng=12.2098,
            max_gaeste=4, grundpreis=145.0, wochenend_aufschlag=25.0, min_aufenthalt=3,
            beschreibung=(
                "Helle Wohnung im ersten Stock eines Bauernhauses, 68 m². Balkon nach "
                "Süden, eigener Eingang, Skikeller im Haus. Bäcker und Lift fußläufig."
            ),
            ausstattung=["balcony", "parking", "wifi", "washing_machine"],
            foto_suche="alpine apartment balcony mountains",
        ),
        Objekt(
            schluessel="seehaus_achensee",
            titel="Seehaus am Achensee",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="cottage", listing_type="entire_place",
            strasse="Uferpromenade", hausnummer="3", plz="6212", stadt="Maurach", land="AT",
            lat=47.4189, lng=11.7231,
            max_gaeste=6, grundpreis=215.0, wochenend_aufschlag=40.0, min_aufenthalt=3,
            beschreibung=(
                "Haus in erster Reihe am Achensee mit eigenem Steg und Bootsplatz. "
                "Große Fensterfront zum Wasser, Kamin, Küche mit Blick auf das "
                "Karwendel. Im Sommer Segeln, im Winter zwanzig Minuten zum Lift."
            ),
            ausstattung=["fireplace", "sun_terrace", "parking", "wifi", "barbecue"],
            foto_suche="lake house alps wooden terrace",
        ),
        Objekt(
            schluessel="almhuette_kitz",
            titel="Almhütte Kitzblick",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="chalet", listing_type="entire_place",
            strasse="Bichlalm", hausnummer="1", plz="6370", stadt="Kitzbühel", land="AT",
            lat=47.4467, lng=12.3915,
            max_gaeste=5, grundpreis=198.0, wochenend_aufschlag=38.0, min_aufenthalt=3,
            beschreibung=(
                "Umgebaute Almhütte oberhalb von Kitzbühel, nur über einen Forstweg "
                "erreichbar — dafür ohne Nachbarn in Sichtweite. Holzofen, Whirlpool "
                "im Freien, Sternenhimmel ohne Streulicht."
            ),
            ausstattung=["hot_tub", "fireplace", "parking", "wifi"],
            foto_suche="mountain hut wood cabin snow",
        ),
        Objekt(
            schluessel="stadtloft_innsbruck",
            titel="Stadtloft Innsbruck",
            property_type="appartement",
            category_slug="wohnung", subtype_slug="loft", listing_type="entire_place",
            strasse="Maria-Theresien-Straße", hausnummer="18", plz="6020",
            stadt="Innsbruck", land="AT",
            lat=47.2654, lng=11.3927,
            max_gaeste=3, grundpreis=132.0, wochenend_aufschlag=22.0, min_aufenthalt=2,
            beschreibung=(
                "Loft unter dem Dach eines Altstadthauses, Blick auf die Nordkette. "
                "Offener Wohnraum, Galerie-Schlafplatz, Aufzug bis in die Wohnung. "
                "Die Bahn auf den Hafelekar startet zehn Gehminuten entfernt."
            ),
            ausstattung=["accessible_by_lift", "wifi", "washing_machine"],
            foto_suche="loft apartment city alps view",
        ),
        Objekt(
            schluessel="panoramasuite_soelden",
            titel="Panoramasuite Sölden",
            property_type="appartement",
            category_slug="wohnung", subtype_slug="ferienwohnung", listing_type="entire_place",
            strasse="Gletscherstraße", hausnummer="42", plz="6450", stadt="Sölden", land="AT",
            lat=46.9668, lng=11.0075,
            max_gaeste=4, grundpreis=225.0, wochenend_aufschlag=48.0, min_aufenthalt=4,
            beschreibung=(
                "Suite im obersten Stock mit Fensterfront nach Süden auf die "
                "Ötztaler Gletscher. Infrarotkabine, Skiraum mit Schuhwärmer, "
                "Talstation der Gaislachkoglbahn in fünf Gehminuten."
            ),
            ausstattung=["sauna", "balcony", "parking", "wifi", "ski_storage"],
            foto_suche="alpine apartment panorama glacier view",
        ),
        Objekt(
            schluessel="bauernhof_alpbach",
            titel="Bauernhof Alpbachtal",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="cottage", listing_type="entire_place",
            strasse="Inneralpbach", hausnummer="56", plz="6236", stadt="Alpbach", land="AT",
            lat=47.3989, lng=11.9436,
            max_gaeste=10, grundpreis=285.0, wochenend_aufschlag=52.0, min_aufenthalt=5,
            beschreibung=(
                "Ganzer Hof aus dem 18. Jahrhundert für große Gruppen, mit Stube, "
                "Kachelofen und Wiese bis zum Waldrand. Die Tiere des Nachbarhofs "
                "dürfen gefüttert werden — für Familien mit Kindern gedacht."
            ),
            ausstattung=["fireplace", "garden", "parking", "wifi", "barbecue",
                         "washing_machine"],
            foto_suche="alpine farmhouse tyrol wooden",
        ),
        Objekt(
            schluessel="seeblick_hallstatt",
            titel="Seeblick Hallstatt",
            property_type="appartement",
            category_slug="wohnung", subtype_slug="ferienwohnung", listing_type="entire_place",
            strasse="Seestraße", hausnummer="9", plz="4830", stadt="Hallstatt", land="AT",
            lat=47.5622, lng=13.6493,
            max_gaeste=3, grundpreis=178.0, wochenend_aufschlag=35.0, min_aufenthalt=2,
            beschreibung=(
                "Wohnung direkt am Hallstätter See, Balkon über dem Wasser. "
                "Der Ort ist ab dem späten Nachmittag wieder still — dann gehört "
                "der Blick auf den Dachstein einem allein."
            ),
            ausstattung=["balcony", "wifi", "washing_machine", "non_smoking_rooms"],
            foto_suche="lakeside apartment hallstatt austria",
        ),
        Objekt(
            schluessel="skihuette_ischgl",
            titel="Skihütte Ischgl",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="huette", listing_type="entire_place",
            strasse="Paznauntal", hausnummer="88", plz="6561", stadt="Ischgl", land="AT",
            lat=47.0114, lng=10.2917,
            max_gaeste=6, grundpreis=310.0, wochenend_aufschlag=65.0, min_aufenthalt=7,
            beschreibung=(
                "Hütte direkt an der Piste, ski-in/ski-out. Große Wohnküche, "
                "Sauna im Untergeschoss, Skidepot mit eigenem Eingang. In der "
                "Wintersaison nur Samstag bis Samstag."
            ),
            ausstattung=["sauna", "fireplace", "ski_storage", "parking", "wifi",
                         "hot_tub"],
            foto_suche="ski chalet slope snow wooden",
        ),
        Objekt(
            schluessel="weingut_wachau",
            titel="Winzerhaus Wachau",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="cottage", listing_type="entire_place",
            strasse="Kellergasse", hausnummer="14", plz="3601", stadt="Dürnstein", land="AT",
            lat=48.3956, lng=15.5194,
            max_gaeste=5, grundpreis=165.0, wochenend_aufschlag=28.0, min_aufenthalt=2,
            beschreibung=(
                "Altes Winzerhaus zwischen den Terrassen über der Donau. Innenhof "
                "mit Nussbaum, Gewölbekeller als Weinstube. Die Ruine Dürnstein "
                "liegt einen halbstündigen Aufstieg entfernt."
            ),
            ausstattung=["garden", "parking", "wifi", "barbecue", "fireplace"],
            foto_suche="vineyard house wachau danube",
        ),
        Objekt(
            schluessel="gartenhaus_zell",
            titel="Gartenhaus Zell am See",
            property_type="ferienhaus",
            category_slug="haus", subtype_slug="bungalow", listing_type="entire_place",
            strasse="Seeuferweg", hausnummer="11", plz="5700", stadt="Zell am See", land="AT",
            lat=47.3230, lng=12.7960,
            max_gaeste=4, grundpreis=168.0, wochenend_aufschlag=30.0, min_aufenthalt=3,
            beschreibung=(
                "Ebenerdiges Gartenhaus mit eigenem Rasen bis zum Seeufer, 300 m vom "
                "Ortskern. Barrierefrei, Fahrräder im Schuppen, Liegestühle am Wasser."
            ),
            ausstattung=["garden", "parking", "wifi", "barbecue", "bikes_available_free"],
            foto_suche="garden house lake austria",
        ),
    ],
)


BETRIEBE = [NORDLICHT, SEEBLICK, ALPENZEIT]


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
