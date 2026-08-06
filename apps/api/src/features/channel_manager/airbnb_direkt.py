"""Airbnbs EIGENE API direkt lesen — mit dem Token, das im Channex-Kanal liegt.

WARUM DIESER WEG EXISTIERT (und warum die Doku-Antwort falsch war):
Über Channex kommen aus einem Airbnb-Listing genau ACHT Felder
(`POST /channels/mapping_details` → `id, title, type, city, country_code,
occupancies, quality_status, synchronization_category`). Keine Adresse, keine
Beschreibung, keine Fotos, keine Ausstattung. Alle Alternativwege bei Channex
sind dicht — gemessen mit Kontrolltest gegen erfundene Namen: Proxy 500,
`meta/airbnb/*` 400/500, `action/all_listings` 400 („nur für Whitelabel-Konten",
`docs.channex.io/api-v.1-documentation/channel-api`).

ABER: der OAuth-Token des Kanals ist ein ECHTER Airbnb-Token
(`channels/{id}` → `settings.tokens.access_token`, `user_id` = Host-ID). Damit
antwortet Airbnbs eigene API direkt — live verifiziert 05.08.2026 gegen
`api.airbnb.com`, Konto AirSmil (Host 529591717):

    GET v2/listings/{id}                        200, 2267 B
    GET v2/listing_descriptions/{id}/{locale}   200, 11578 B
    GET v2/listing_photos?listing_id={id}       200, 11473 B  (17 Fotos)
    GET v2/listing_rooms?listing_id={id}        200
    GET v2/listings?user_id={uid}
        &has_availability=false&_limit=50       200, 19 Listings

Kontrolltest: `v2/voelliger_unsinn_zzz` → 404 `route_not_found`. Die 200er sind
also echt und nicht die Attrappe, die der `channels/{id}/execute/*`-Namensraum
bei Channex ist (der antwortet auf JEDEN Namen mit „Success").

FALLEN, die gemessen wurden:
  * `v2/listings?user_id=…` OHNE `has_availability=false` liefert **0** Listings
    (200, leeres Array). Mit dem Parameter: alle 19. Ein fehlender Parameter
    sieht hier also wie „kein Objekt vorhanden" aus.
  * `v2/listing_descriptions/{id}` ohne Locale → 404. Das Locale ist Pflicht.
  * `v2/listing_amenities` und `v2/listing_expectations` gibt es NICHT (404);
    die Ausstattung steckt in `v2/listings/{id}` unter `amenities`.
  * Ein BUNDESLAND/eine REGION liefert Airbnb nirgends. Gemessen: 35 Felder im
    Listing, vier `_format`-Varianten identisch, `v2/listing_addresses` → 404,
    `listing_descriptions` (11578 B) enthält kein Regionswort. Channex hat das
    Feld (`properties.state`), dort ist es `null`. Unser Standort-Formular
    verlangt es aber → es wird aus `lat`/`lng` rückwärts geokodiert
    (`region_geokodierung`), genau wie Lodgify es macht.
  * Foto-URLs kommen nur als `small_url`/`extra_medium_url`/`thumbnail_url` mit
    `?aki_policy=…`. Der Pfad enthält `/original/` — für die volle Auflösung
    wird der Query-Teil entfernt (`_foto_url`).

Der Token gehört Channex, nicht uns: er kann rotieren oder ablaufen
(`expires_at`). Deshalb ist jeder Aufruf hier best effort und kein Pfad
verlässt sich darauf.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Final

import httpx
from supabase import Client

from src.core.supabase import load_scoped

from . import airbnb_listing_import as ali
from .bildtext_uebersetzung import bildtexte_uebersetzen, caption_mehrsprachig
from .common import ChannelManagerError, log
from .region_geokodierung import region_aus_koordinaten

AIRBNB_API = "https://api.airbnb.com"

# Ohne diesen Filter antwortet Airbnb mit 200 und einer LEEREN Liste (gemessen).
LISTINGS_PARAMS = {"has_availability": "false", "_limit": "50"}

_TIMEOUT = httpx.Timeout(30.0)


class AirbnbSchreibfehler(RuntimeError):
    """Ein schreibender Airbnb-Aufruf ist nicht angekommen.

    Eigene Klasse, damit der Aufrufer sie gezielt fangen kann, statt sie in einem
    breiten `except Exception` zu verlieren (Wurzel 5) — ein stiller Schreibfehler
    meldete „gespeichert", während bei Airbnb der alte Stand steht.
    """


def _foto_url(foto: dict[str, Any]) -> str | None:
    """Beste verfügbare Auflösung eines Airbnb-Fotos.

    Airbnb liefert drei Varianten derselben Datei, alle mit `?aki_policy=` als
    Größen-Schalter (`x_medium`, `small`, `x_small`). Der Pfad selbst zeigt auf
    `/original/` — ohne den Query-Teil kommt das unskalierte Bild. Kein Rateweg:
    fehlt jede Variante, gibt es kein Foto (Wurzel 4).
    """
    for feld in ("extra_medium_url", "small_url", "thumbnail_url"):
        wert = foto.get(feld)
        if isinstance(wert, str) and wert.startswith("http"):
            return wert.split("?", 1)[0]
    return None


def _strasse_und_nummer(strasse: str) -> tuple[str, str | None]:
    """„Skagen Landevej 772" → („Skagen Landevej", „772").

    Unser Standort-Formular führt Straße und Hausnummer GETRENNT
    (`properties.street` + `house_number`); Airbnb liefert eine Zeile. Wer nur
    `address` füllt, hinterlässt ein leeres Straßenfeld in der Oberfläche —
    genau so passiert (Objekt 020: `address` gesetzt, `street` NULL).

    Getrennt wird nur, wenn der letzte Teil wie eine Hausnummer aussieht
    (beginnt mit einer Ziffer: „772", „18B", „14"). Sonst bleibt alles in der
    Straße — Raten wäre schlimmer als ein leeres Nummernfeld (Wurzel 4).
    Dänische Adressen im Konto: „Rævlingevej 4", „Tolstrupvej 18B",
    „Højenevej 2A", „Iver Christensens Vej 13" — alle nach diesem Muster.
    """
    teile = strasse.strip().split()
    if len(teile) >= 2 and teile[-1][:1].isdigit():
        return " ".join(teile[:-1]), teile[-1]
    return strasse.strip(), None


# Airbnbs Ausstattungskatalog → unsere Katalog-Slugs, getrennt nach den ZWEI
# Katalogen, die die Objektmaske führt.
#
# WARUM DIE TRENNUNG DER PUNKT IST: `properties` hat zwei Spalten — `amenities`
# (Objekt-Ausstattung) und `room_amenities` (Zimmer-Ausstattung). Die Checkbox in
# der Maske prüft je Eintrag GENAU EINE davon (`property-overview.tsx`,
# `gewaehlt()`). Der Import schrieb bisher alles nach `amenities`; weil die
# meisten Merkmale aber im Zimmer-Katalog stehen, blieb dort jede Checkbox leer,
# obwohl die Slugs in der DB standen — sichtbar nur als Roh-Chips.
#
# WARUM EINE TABELLE UND KEIN `.lower()`: der alte Weg machte aus `COFFEE_MAKER`
# ein `coffee_maker`, das in keinem Katalog existiert (unser Slug heißt
# `coffee_machine`). Solche Slugs sind unsichtbar und gehen an kein Portal.
#
# GRUNDLAGE: Airbnbs vollständige „Add amenities"-Maske (139 Merkmale, abgelesen
# 05.08.2026) UND die live gemessenen API-Schlüssel aller 18 Anzeigen des Kontos
# (`GET v2/listings/{id}` → `amenities` mit `is_present`, 57 verschiedene).
# Jeder Ziel-Slug ist gegen `web/lib/property-meta.ts` geprüft — die erste
# Fassung dieser Tabelle hatte vier Slugs, die in KEINEM Katalog standen
# (`nd_long_stay_discount`) oder im falschen (`AC`, `SMOKE_DETECTOR`, `JACUZZI`).
#
# DER RÜCKWEG entscheidet über die Slug-Wahl: was rausgeht, braucht eine
# Channex-Facility-UUID (`_channex_facility_ids` lässt Unbekanntes still weg).
# Deshalb steht hier `sun_loungers_or_beach_chairs` und nicht der eigene
# `nd_sun_loungers` — Letzterer hat keine UUID und käme bei keinem Portal an.
# Wo Channex kein Gegenstück HAT, steht bewusst ein eigener `nd_*`-Slug: das
# Merkmal geht dann an myBestDays und die eigene Website, nicht an die Portale
# (dieselbe Trennung wie in `EIGENE_AUSSTATTUNG`, property-meta.ts).
_AIRBNB_ZU_ZIMMER: Final[dict[str, str]] = {
    # --- direkte Treffer (Slug identisch) ---
    "BIDET": "bidet",
    "BODY_SOAP": "body_soap",
    "CLEANING_PRODUCTS": "cleaning_products",
    "CONDITIONER": "conditioner",
    "DINING_TABLE": "dining_table",
    "DISHWASHER": "dishwasher",
    "GAME_CONSOLE": "game_console",
    "HAIR_DRYER": "hair_dryer",
    "HEATING": "heating",
    "HOT_TUB": "hot_tub",
    "KITCHEN": "kitchen",
    "KITCHENETTE": "kitchenette",
    "MICROWAVE": "microwave",
    "MOSQUITO_NET": "mosquito_net",
    "OUTDOOR_DINING_AREA": "outdoor_dining_area",
    "OUTDOOR_FURNITURE": "outdoor_furniture",
    "OVEN": "oven",
    "PRIVATE_ENTRANCE": "private_entrance",
    "REFRIGERATOR": "refrigerator",
    "SHAMPOO": "shampoo",
    "STOVE": "stove",
    "TOASTER": "toaster",
    "TV": "tv",
    "WINE_GLASSES": "wine_glasses",
    # --- gleiches Merkmal, anderer Name bei uns ---
    "WIRELESS_INTERNET": "wireless_internet",
    "DEDICATED_WORKSPACE": "desk",
    "LAKE_ACCESS": "lake_view",
    "COFFEE_MAKER": "coffee_machine",
    "COFFEE": "coffee_tea_maker",
    "COOKING_BASICS": "kitchenware",
    "WASHER": "washing_machine",
    "DRYER": "tumble_dryer_machine",
    "DRYING_RACK_FOR_CLOTHING": "clothes_drying_rack",
    "CLOTHES_DRYING_RACK": "clothes_drying_rack",
    "IRON": "clothing_iron",
    "WARDROBE_OR_CLOSET": "wardrobe_closet",
    "CLOTHING_STORAGE": "wardrobe_closet",
    "BOARD_GAMES": "board_games_puzzles",
    "HOT_WATER_KETTLE": "electric_kettle",
    "PATIO_OR_BELCONY": "patio",
    "PATIO_OR_BALCONY": "patio",
    "CRIB": "children_crib_cots",
    "HIGH_CHAIR": "children_highchair",
    "BABY_SAFETY_GATES": "baby_safety_gates",
    "OUTLET_COVERS": "child_safety_socket_covers",
    "POCKET_WIFI": "portable_wifi",
    "BATHTUB": "bath",
    "INDOOR_FIREPLACE": "fireplace",
    "FIREPLACE": "fireplace",
    "SAUNA": "sauna",
    "SOUND_SYSTEM": "nd_stereo",
    "RECORD_PLAYER": "cd_player",
    "TRASH_COMPACTOR": "trash_cans",
    "MINI_FRIDGE": "mini_bar",
    "OUTDOOR_SHOWER": "shower",
    "SHOWER_GEL": "shower",
    # --- Nachtrag: Schlüssel, die im Konto real vorkamen und beim ersten
    # Durchlauf ohne Zuordnung protokolliert wurden (`airbnb_ausstattung_ohne_
    # zuordnung`, 18 Objekte). Nicht erfunden — gemessen und dann geschlossen.
    "OUTDOOR_SEATING": "seating_area",
    "ALFRESCO_DINING": "outdoor_dining_area",
    "ALFRESCO_SHOWER": "shower",
    "POUR_OVER_COFFEE": "coffee_tea_maker",
    "ROOM_DARKENING_SHADES": "private_curtain",
    # --- eigene Merkmale: Channex hat kein Gegenstück ---
    "BLENDER": "nd_blender",
    "RICE_MAKER": "nd_rice_cooker",
    "PIANO": "nd_piano",
    "BBQ_GRILL": "nd_charcoal_grill",
    "BARBEQUE_UTENSILS": "barbecue",
    "BARBECUE_UTENSILS": "barbecue",
    "FREEZER": "nd_freezer",
    "HANGERS": "nd_hangers",
    "HOT_WATER": "nd_hot_water",
    "DISHES_AND_SILVERWARE": "nd_dishes_silverware",
    "BAKING_SHEET": "nd_baking_sheet",
    "ESSENTIALS": "nd_essentials",
    "BOOKS": "nd_books",
    "CHILDRENS_BOOKS_AND_TOYS": "nd_childrens_books_toys",
    "CHILDRENS_DINNERWARE": "nd_childrens_dinnerware",
}

_AIRBNB_ZU_OBJEKT: Final[dict[str, str]] = {
    # --- direkte Treffer ---
    "AIR_CONDITIONING": "air_conditioning",
    "AC": "air_conditioning",
    "BREAKFAST": "breakfast",
    "FIRE_PIT": "fire_pit",
    "SAFE": "safe",
    "WATERFRONT": "waterfront",
    "WIFI": "wifi",
    "STREET_PARKING": "street_parking",
    # --- gleiches Merkmal, anderer Name ---
    "SMOKE_DETECTOR": "smoke_alarms",
    "SMOKE_ALARM": "smoke_alarms",
    "JACUZZI": "jacuzzi_hot_tub",
    "GARDEN_OR_BACKYARD": "garden",
    "BACKYARD": "garden",
    "SUN_LOUNGERS": "sun_loungers_or_beach_chairs",
    "ELEVATOR": "elevators",
    "FIRST_AID_KIT": "first_aid_kit_available",
    "BIKES": "bikes_available_free",
    "CHILDRENS_BIKES": "bikes_available_free",
    "BOWLING_ALLEY": "bowling",
    "MINI_GOLF": "minigolf",
    "MOVIE_THEATER": "movie_nights",
    "POOL": "swimming_pool",
    "PING_PONG_TABLE": "table_tennis",
    "OUTDOOR_PLAYGROUND": "playground",
    "PRIVATE_LIVING_ROOM": "nd_living_room",
    "BEACH_ACCESS": "beach",
    "SOLAR_PANELS": "solarium",
    "GATED_COMMUNITY": "nd_gated_community",
    "RESORT_ACCESS": "nd_resort",
    "KAYAK": "nd_canoe_kayak",
    "BOAT_SLIP": "nd_boat",
    "POOL_TABLE": "billiard",
    "CARBON_MONOXIDE_ALARM": "carbon_monoxide_detector",
    "FIRE_EXTINGUISHER": "fire_extinguishers",
    # --- eigene Merkmale (Channex kennt sie nicht) ---
    # Airbnb trennt Parken fünffach (frei/bezahlt × auf/neben dem Grundstück +
    # freies Straßenparken); Channex trennt nur nach ART. Die Gratis-Aussage
    # bleibt deshalb ein eigenes Merkmal.
    "FREE_PARKING_ON_PREMISES": "nd_parking_included",
    "FREE_PARKING_OFF_PREMISES": "nd_parking_included",
    "FREE_PARKING": "nd_parking_included",
    "FREE_STREET_PARKING": "street_parking",
    "PAID_PARKING_ON_PREMISES": "nd_parking_optional",
    "PAID_PARKING_OFF_PREMISES": "nd_parking_optional",
    "GYM": "fitness",
    "EV_CHARGER": "electric_vehicle_charging_station",
    "EBIKE_CHARGER": "electric_vehicle_charging_station",
    "LONG_TERM_STAYS_ALLOWED": "nd_long_stay",
    "LUGGAGE_DROPOFF_ALLOWED": "baggage_storage",
    "ETHERNET_CONNECTION": "nd_internet_broadband",
    "SINGLE_LEVEL_HOME": "nd_single_level",
    "RECYCLING": "nd_recycling",
    "HAMMOCK": "nd_hammock",
    # Nachtrag aus dem Protokoll (siehe Zimmer-Tabelle): ein Grillplatz ist eine
    # Fläche am Objekt, kein Zimmer-Merkmal.
    "BBQ_AREA": "bbq_picnic_area",
}


def _airbnb_amenities(rohe: object) -> tuple[list[str], list[str]]:
    """Airbnbs `amenities` → (Objekt-Slugs, Zimmer-Slugs).

    Airbnb liefert ein Objekt `{"REFRIGERATOR": {"is_present": true, …}, …}`.
    Übernommen wird nur, was `is_present` trägt — ein Eintrag mit `false` heißt
    „ausdrücklich nicht vorhanden" und darf nicht als Ausstattung gelten.

    Zwei Listen statt einer, weil die Maske zwei Spalten führt (siehe Tabellen
    oben). Ein Schlüssel ohne Gegenstück wird NICHT geraten, sondern gemeldet.
    """
    if not isinstance(rohe, dict):
        return [], []
    objekt: set[str] = set()
    zimmer: set[str] = set()
    unbekannt: list[str] = []
    for name, wert in rohe.items():
        if not isinstance(wert, dict) or not wert.get("is_present"):
            continue
        schluessel = str(name).upper()
        if schluessel in _AIRBNB_ZU_ZIMMER:
            zimmer.add(_AIRBNB_ZU_ZIMMER[schluessel])
        elif schluessel in _AIRBNB_ZU_OBJEKT:
            objekt.add(_AIRBNB_ZU_OBJEKT[schluessel])
        else:
            unbekannt.append(schluessel)
    if unbekannt:
        # Sichtbar machen, statt still zu verwerfen (Wurzel 5): so wächst die
        # Tabelle mit belegten Werten und nicht mit Vermutungen.
        log.info("airbnb_ausstattung_ohne_zuordnung", schluessel=sorted(unbekannt)[:20])
    return sorted(objekt), sorted(zimmer)


def _slug_zu_airbnb() -> dict[str, list[str]]:
    """Unser Slug → alle Airbnb-Schlüssel, die darauf zeigen.

    Mehrere Schlüssel je Slug ist der Normalfall, nicht die Ausnahme: Airbnb
    trennt `FREE_PARKING_ON_PREMISES` von `FREE_PARKING_OFF_PREMISES`, wir führen
    beides als `nd_parking_included`. Beim Zurückschreiben müssen deshalb ALLE
    zugehörigen Schlüssel gesetzt werden — sonst bliebe die Hälfte der Variante
    bei Airbnb auf dem alten Stand.
    """
    rueck: dict[str, list[str]] = {}
    for tabelle in (_AIRBNB_ZU_ZIMMER, _AIRBNB_ZU_OBJEKT):
        for schluessel, slug in tabelle.items():
            rueck.setdefault(slug, []).append(schluessel)
    return {slug: sorted(keys) for slug, keys in rueck.items()}


_SLUG_ZU_AIRBNB: Final[dict[str, list[str]]] = _slug_zu_airbnb()

# Alle Airbnb-Schlüssel, für die wir überhaupt zuständig sind.
_SLUG_ZU_AIRBNB_KEYS: Final[frozenset[str]] = frozenset(
    set(_AIRBNB_ZU_ZIMMER) | set(_AIRBNB_ZU_OBJEKT)
)


def airbnb_amenities_payload(
    objekt_slugs: Sequence[str],
    zimmer_slugs: Sequence[str],
    bestand: object,
) -> dict[str, dict[str, bool]]:
    """Unsere Auswahl → Airbnbs `amenities`-Nutzlast.

    Wurzel 1 (Gegenzustand): Airbnb kennt drei Zustände — gesetzt, ausdrücklich
    nicht vorhanden (`is_present: false`) und gar nicht erwähnt. Wer nur die
    angehakten Merkmale sendet, entfernt ein abgewähltes NIE: es bliebe bei
    Airbnb stehen. Deshalb wird der Alt/Neu-Diff gebildet und alles, was vorher
    `true` war und jetzt fehlt, ausdrücklich auf `false` gesetzt.

    Nur Schlüssel, die wir tatsächlich zuordnen können, werden angefasst. Was
    Airbnb führt und wir nicht kennen, bleibt unberührt — es zu löschen wäre
    Datenverlust an fremder Stelle.
    """
    gewuenscht: set[str] = set()
    for slug in (*objekt_slugs, *zimmer_slugs):
        gewuenscht.update(_SLUG_ZU_AIRBNB.get(slug, ()))

    nutzlast: dict[str, dict[str, bool]] = {
        schluessel: {"is_present": True} for schluessel in sorted(gewuenscht)
    }

    if isinstance(bestand, dict):
        for name, wert in bestand.items():
            schluessel = str(name).upper()
            if schluessel in nutzlast or schluessel not in _SLUG_ZU_AIRBNB_KEYS:
                continue
            if isinstance(wert, dict) and wert.get("is_present"):
                nutzlast[schluessel] = {"is_present": False}
    return dict(sorted(nutzlast.items()))


# Unser `properties.size_unit` (0197) → Airbnbs Schreibweise. Die Umkehrung von
# `airbnb_listing_import._FLAECHE_EINHEIT`; hier steht sie eigenständig, damit
# eine unbekannte Einheit NICHT auf m² fällt (Wurzel 4).
_EINHEIT_ZU_AIRBNB: Final[dict[str, str]] = {
    "sqm": "SQUARE_METERS",
    "sqft": "SQUARE_FEET",
}


class AirbnbDirektMixin:
    """Liest Adresse, Beschreibung, Fotos und Ausstattung direkt bei Airbnb."""

    def _airbnb_token(self, db: Client, tenant_id: str) -> tuple[str, str] | None:
        """(access_token, host_user_id) des Airbnb-Kanals dieses Betriebs.

        Der Token steht bei CHANNEX am Kanal, nicht bei uns — wir holen ihn dort
        und speichern ihn NICHT (er rotiert, und ein kopierter Token wäre ein
        zweites Geheimnis mit eigenem Ablaufdatum).
        """
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id)  # type: ignore[attr-defined]
        if not channel_id:
            return None
        try:
            kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except Exception as exc:  # noqa: BLE001 — best effort, kein Hauptpfad
            log.warning("airbnb_token_unlesbar", error=str(exc)[:200])
            return None
        attrs = ((kanal.get("data") or {}).get("attributes")) or {}
        tokens = (attrs.get("settings") or {}).get("tokens") or {}
        token = tokens.get("access_token")
        user_id = tokens.get("user_id")
        if not token or not user_id:
            return None
        return str(token), str(user_id)

    @staticmethod
    def _airbnb_get(token: str, pfad: str, params: dict | None = None) -> dict | None:
        """Einen lesenden Aufruf gegen Airbnbs API. None = nicht verwertbar."""
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                antwort = client.get(
                    f"{AIRBNB_API}/{pfad}",
                    headers={"X-Airbnb-OAuth-Token": token},
                    params=params or {},
                )
        except httpx.HTTPError as exc:
            log.warning("airbnb_direkt_netzfehler", pfad=pfad, error=str(exc)[:200])
            return None
        if antwort.status_code != 200:
            log.info(
                "airbnb_direkt_kein_200",
                pfad=pfad, status=antwort.status_code, body=antwort.text[:200],
            )
            return None
        try:
            return antwort.json()
        except ValueError:
            log.warning("airbnb_direkt_kein_json", pfad=pfad)
            return None

    @staticmethod
    def _airbnb_put(token: str, pfad: str, nutzlast: dict[str, Any]) -> dict[str, Any]:
        """Einen SCHREIBENDEN Aufruf gegen Airbnbs API.

        Anders als `_airbnb_get` gibt das hier bei einem Fehler NICHT `None`
        zurück (Wurzel 5): ein verschluckter Schreibfehler meldete „gespeichert",
        während bei Airbnb der alte Stand steht. Der Aufrufer bekommt die Wahrheit
        und entscheidet, ob er 502 wirft oder es erneut versucht.
        """
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                antwort = client.put(
                    f"{AIRBNB_API}/{pfad}",
                    headers={
                        "X-Airbnb-OAuth-Token": token,
                        "Content-Type": "application/json",
                    },
                    json=nutzlast,
                )
        except httpx.HTTPError as exc:
            raise AirbnbSchreibfehler(f"Netzfehler bei {pfad}: {exc}") from exc
        if antwort.status_code >= 400:
            raise AirbnbSchreibfehler(
                f"Airbnb antwortete {antwort.status_code} auf {pfad}: "
                f"{antwort.text[:300]}"
            )
        try:
            daten = antwort.json()
        except ValueError:
            return {}
        return daten if isinstance(daten, dict) else {}

    def airbnb_ausstattung_schreiben(
        self,
        token: str,
        listing_id: str,
        objekt_slugs: Sequence[str],
        zimmer_slugs: Sequence[str],
    ) -> list[str]:
        """Unsere Ausstattungs-Auswahl zurück an Airbnb.

        Der Weg geht NICHT über Channex: Channex führt nur seinen eigenen
        Facility-Katalog, und ein großer Teil der Airbnb-Merkmale (Parkvarianten,
        Hängematte, Mülltrennung, Langzeitaufenthalte …) hat dort kein Feld —
        ohne Facility-UUID fiele es beim Sync still unter den Tisch.

        Der Bestand wird VOR dem Schreiben gelesen, weil ohne ihn der
        Gegenzustand fehlt (Wurzel 1): abgewählte Merkmale müssen ausdrücklich
        auf `is_present: false`, sonst bleiben sie bei Airbnb stehen.

        Rückgabe: die tatsächlich gesendeten Airbnb-Schlüssel.
        """
        listing = self.airbnb_listing_direkt(token, listing_id) or {}
        nutzlast = airbnb_amenities_payload(
            objekt_slugs, zimmer_slugs, listing.get("amenities")
        )
        if not nutzlast:
            return []
        self._airbnb_put(
            token, f"v2/listings/{listing_id}", {"listing": {"amenities": nutzlast}}
        )
        log.info(
            "airbnb_ausstattung_geschrieben",
            listing_id=listing_id,
            gesetzt=sum(1 for w in nutzlast.values() if w["is_present"]),
            entfernt=sum(1 for w in nutzlast.values() if not w["is_present"]),
        )
        return sorted(nutzlast)

    def airbnb_stammdaten_schreiben(
        self,
        token: str,
        listing_id: str,
        flaeche: float | None,
        einheit: str | None,
        max_gaeste: int | None,
    ) -> dict[str, Any]:
        """Fläche und Kapazität zurück an Airbnb.

        `PUT v2/listings/{id}` mit FLACHEM Payload, bewusst am Aggregator
        vorbei: Channex' ausgehender Payload trägt nur Verfügbarkeit, Preis und
        Restriktionen — eine geänderte Wohnfläche käme dort nie an.

        FLACH, NICHT in `{"listing": {...}}` — das ist der Punkt, an dem dieser
        Weg zuerst scheiterte. Airbnb quittiert die umhüllte Form mit **200 und
        tut nichts**; ein Statuscode allein beweist hier also gar nichts. Live
        gemessen 06.08.2026 an „Feriehus Kornblomst" (69 → 70 → zurück):

            {"listing": {"property_details": {...}}}  -> 200, size bleibt 69
            {"property_details": {...}}               -> 200, size wird 70

        Kontrolltest daneben: ein erfundenes Feld allein ändert nichts, der
        Unterschied kommt also wirklich vom Payload. Dieselbe Eigenheit wie beim
        Zimmer-Anlegen (`airbnb_zimmer_push`) — die Ausstattung nutzt weiter die
        umhüllte Form, weil sie dort nachweislich wirkt.

        Gelesen wird dasselbe Feld, das wir hier schreiben
        (`property_details.listing_size`) — Hin- und Rückweg sind symmetrisch.

        Nur gefüllte Werte gehen raus (Wurzel 4): eine fehlende Fläche ist
        „unbekannt", nicht „0". Ohne Einheit KEINE Fläche — „69" ohne Einheit
        wäre bei Airbnb eine Zahl, deren Bedeutung wir raten müssten, und der
        Unterschied m²/sq ft ist Faktor 10.

        Rückgabe: die gesendeten Felder plus `angekommen` — ob der Wert beim
        Zurücklesen wirklich bei Airbnb stand. Leeres Dict = nichts zu tun.
        """
        nutzlast: dict[str, Any] = {}
        einheit_airbnb = _EINHEIT_ZU_AIRBNB.get(str(einheit or "").lower())
        if flaeche and flaeche > 0 and einheit_airbnb:
            nutzlast["property_details"] = {
                "listing_size": {
                    # Airbnb liefert die Größe als Ganzzahl zurück; ein float
                    # ohne Nachkommastelle würde als „69.0" gesendet.
                    "size": int(flaeche) if float(flaeche).is_integer() else flaeche,
                    "size_unit": einheit_airbnb,
                }
            }
        if isinstance(max_gaeste, int) and max_gaeste > 0:
            nutzlast["person_capacity"] = max_gaeste
        if not nutzlast:
            log.info(
                "airbnb_stammdaten_nichts_zu_senden",
                listing_id=listing_id,
                flaeche=flaeche, einheit=einheit, max_gaeste=max_gaeste,
            )
            return {}

        vorher = self._airbnb_stammdaten_stand(token, listing_id)
        log.info(
            "airbnb_stammdaten_sende",
            listing_id=listing_id, nutzlast=nutzlast, vorher=vorher,
        )
        # FLACH — siehe Docstring: die `{"listing": …}`-Hülle quittiert Airbnb
        # mit 200 und verwirft den Inhalt.
        self._airbnb_put(token, f"v2/listings/{listing_id}", nutzlast)

        # ZURÜCKLESEN, nicht dem 200 glauben. Genau hier lag der Fehler, der
        # diesen Weg fast unbemerkt wirkungslos gemacht hätte: Airbnb quittiert
        # eine verworfene Nutzlast mit demselben 200 wie eine übernommene.
        nachher = self._airbnb_stammdaten_stand(token, listing_id)
        soll = {
            "groesse": (nutzlast.get("property_details") or {})
            .get("listing_size", {})
            .get("size", nachher.get("groesse")),
            "kapazitaet": nutzlast.get("person_capacity", nachher.get("kapazitaet")),
        }
        angekommen = all(nachher.get(k) == v for k, v in soll.items())
        log.info(
            "airbnb_stammdaten_geschrieben",
            listing_id=listing_id, felder=sorted(nutzlast),
            vorher=vorher, nachher=nachher, angekommen=angekommen,
        )
        if not angekommen:
            # Kein Absturz: der Wert steht bei uns richtig, nur Airbnb hat ihn
            # nicht genommen. Aber sichtbar — sonst sucht man beim nächsten Mal
            # wieder von vorn (Wurzel 5: nichts stillschweigend „done" nennen).
            log.warning(
                "airbnb_stammdaten_nicht_uebernommen",
                listing_id=listing_id, gesendet=nutzlast,
                soll=soll, ist=nachher,
            )
        # `angekommen` gehört in die Rückgabe, nicht nur ins Log: der Aufrufer
        # soll unterscheiden können, ob Airbnb den Wert wirklich übernommen hat.
        return {**nutzlast, "angekommen": angekommen}

    def _airbnb_stammdaten_stand(
        self, token: str, listing_id: str
    ) -> dict[str, Any]:
        """Fläche und Kapazität, wie sie GERADE bei Airbnb stehen.

        Für das Vorher/Nachher im Log. Scheitert der Lesevorgang, ist das kein
        Grund den Schreibweg zu kippen — dann steht `None` im Log statt einer
        erfundenen Zahl.
        """
        listing = self._airbnb_get(token, f"v2/listings/{listing_id}") or {}
        daten = listing.get("listing") if isinstance(
            listing.get("listing"), dict
        ) else listing
        groesse = ((daten.get("property_details") or {})
                   .get("listing_size") or {}).get("size")
        return {"groesse": groesse, "kapazitaet": daten.get("person_capacity")}

    def airbnb_listings_direkt(self, token: str, user_id: str) -> list[dict[str, Any]]:
        """Alle Listings des Hosts MIT Adresse, Zimmerzahl und Ausstattung.

        `has_availability=false` ist PFLICHT (siehe Modul-Docstring): ohne den
        Parameter antwortet Airbnb 200 mit einer leeren Liste.
        """
        daten = self._airbnb_get(
            token, "v2/listings", {"user_id": user_id, **LISTINGS_PARAMS}
        )
        listings = (daten or {}).get("listings")
        return listings if isinstance(listings, list) else []

    def airbnb_listing_direkt(self, token: str, listing_id: str) -> dict[str, Any] | None:
        """Ein Listing einzeln (dieselben Felder wie in der Liste)."""
        daten = self._airbnb_get(token, f"v2/listings/{listing_id}")
        eintrag = (daten or {}).get("listing")
        return eintrag if isinstance(eintrag, dict) else None

    def airbnb_beschreibung_direkt(
        self, token: str, listing_id: str, locale: str
    ) -> dict[str, Any] | None:
        """Beschreibung, Kurzfassung, Name und Hausregeln in EINER Sprache.

        Das Locale ist Pflicht — ohne antwortet Airbnb 404 (gemessen).
        """
        daten = self._airbnb_get(
            token, f"v2/listing_descriptions/{listing_id}/{locale}"
        )
        eintrag = (daten or {}).get("listing_description")
        return eintrag if isinstance(eintrag, dict) else None

    def airbnb_fotos_direkt(self, token: str, listing_id: str) -> list[dict[str, Any]]:
        """Fotos eines Listings, aufsteigend nach `sort_order`.

        Zurück kommen nur Einträge mit verwertbarer URL. `caption` ist Airbnbs
        Bildtext, `category` die Raumzuordnung (z. B. `ROOM`).
        """
        daten = self._airbnb_get(
            token, "v2/listing_photos", {"listing_id": listing_id}
        )
        fotos = (daten or {}).get("listing_photos")
        if not isinstance(fotos, list):
            return []
        ergebnis: list[dict[str, Any]] = []
        for foto in fotos:
            if not isinstance(foto, dict):
                continue
            url = _foto_url(foto)
            if not url:
                continue
            ergebnis.append(
                {
                    "url": url,
                    # Der ROHE Bildtext, einsprachig wie Airbnb ihn liefert.
                    # Die mehrsprachige Form (`property_photos.caption` ist
                    # `{locale: text}`) entsteht erst beim Speichern — dort wird
                    # in die Sprache des Betriebs übersetzt. Wer hier schon
                    # `{"en": …}` festschreibt, hinterlässt eine deutsche
                    # Oberfläche mit Platzhaltern, weil sie `caption["de"]`
                    # liest (live so passiert, 17 Fotos englisch in der DB).
                    "caption_roh": str(foto.get("caption") or "").strip(),
                    "sort_order": foto.get("sort_order"),
                    "category": foto.get("category"),
                    "airbnb_photo_id": str(foto.get("id")) if foto.get("id") else None,
                    # Der Raum, an dem das Foto bei Airbnb hängt. Airbnb blendet
                    # die ganze „Photo tour" aus, wenn ein Raum kein Foto hat —
                    # ohne diesen Wert ist nicht feststellbar, welcher fehlt.
                    # None ist gültig: `category: LISTING` (Außenbilder) hat
                    # keinen Raum.
                    "airbnb_room_id": (
                        str(foto["room_id"]) if foto.get("room_id") else None
                    ),
                }
            )
        ergebnis.sort(key=lambda f: (f["sort_order"] is None, f["sort_order"] or 0))
        return ergebnis

    def airbnb_zimmer_direkt(self, token: str, listing_id: str) -> list[dict[str, Any]]:
        """Zimmer eines Listings samt Betten (`v2/listing_rooms`)."""
        daten = self._airbnb_get(
            token, "v2/listing_rooms", {"listing_id": listing_id}
        )
        zimmer = (daten or {}).get("listing_rooms")
        return zimmer if isinstance(zimmer, list) else []

    def airbnb_booking_settings_direkt(
        self, token: str, listing_id: str
    ) -> dict[str, Any] | None:
        """Die Hausregeln eines Listings (`v2/booking_settings/{id}`).

        DER GRUND FÜR DIESEN WEG: über Channex kommen die Hausregeln nur als
        Beifang der Mapping-Antwort — und die Felder, die der Betrieb in Airbnbs
        Oberfläche unter „House rules" sieht, fehlen dort. Airbnbs eigene API
        gibt sie vollständig heraus.

        Live verifiziert am 05.08.2026 (Konto AirSmil, Objekt 020):
            GET v2/booking_settings/{id}      → 200, 938 B
            GET v2/guest_controls/{id}        → 404 route_not_found
            GET v2/listing_house_rules?…      → 404 route_not_found
            GET v2/listing_expectations?…     → 404 route_not_found
            GET v2/kontrolle_unsinn_zzz       → 404 (Kontrolltest)
        Der 404 auf den erfundenen Pfad belegt, dass die 200 echt ist und nicht
        ein Namensraum, der auf alles freundlich antwortet.

        Gemessene Antwort, Feld für Feld deckungsgleich mit
        `docs/OTA/Airbnb/Booking Settings Airbnb.pdf`:
            check_in_time_start "16"        (String)
            check_in_time_end   "FLEXIBLE"  (String — kein Zahlenwert!)
            check_out_time      10          (Integer, laut Doku 0..23)
            instant_booking_allowed_category "everyone"
            cancellation_policy_category "better_strict_with_grace_period"
            guest_controls  allows_children/infants/pets/smoking/events,
                            children_not_allowed_details, pet_capacity
        Genau diese Werte („3 Gäste", „1 Haustier", Check-in ab 16 Uhr) fehlten
        nach dem Import, obwohl sie in Airbnbs Oberfläche stehen.

        Best effort wie alles in diesem Modul: der Token gehört Channex und kann
        rotieren. Kein None-Ergebnis wird zu einem erfundenen Regelsatz.
        """
        daten = self._airbnb_get(token, f"v2/booking_settings/{listing_id}")
        eintrag = (daten or {}).get("booking_setting")
        return eintrag if isinstance(eintrag, dict) else None

    @staticmethod
    def airbnb_stammdaten_felder(listing: dict[str, Any]) -> dict[str, Any]:
        """Die Felder eines Airbnb-Listings, die an unser Objekt gehören.

        Nur Werte, die WIRKLICH da sind: ein leerer String oder None bedeutet
        „Airbnb hat es nicht" und wird nicht gesetzt (Wurzel 4). Der Aufrufer
        entscheidet, ob er einen bereits gepflegten Wert überschreibt (Wurzel 1).
        """
        felder: dict[str, Any] = {}
        strasse = (listing.get("street") or "").strip()
        if strasse:
            # DREI Spalten, nicht eine: `address` ist die volle Zeile (geht so
            # an Channex), `street`/`house_number` speisen das Standort-Formular.
            felder["address"] = strasse
            nur_strasse, nummer = _strasse_und_nummer(strasse)
            felder["street"] = nur_strasse
            if nummer:
                felder["house_number"] = nummer
        plz = str(listing.get("zipcode") or "").strip()
        if plz:
            felder["postal_code"] = plz
        stadt = (listing.get("city") or "").strip()
        if stadt:
            felder["city"] = stadt
        # Unsere Spalten heißen `lat`/`lng` (nicht latitude/longitude) —
        # dieselbe Schreibweise wie in property_mapping.py.
        for feld in ("lat", "lng"):
            wert = listing.get(feld)
            if isinstance(wert, (int, float)):
                felder[feld] = float(wert)
        gaeste = listing.get("person_capacity")
        if isinstance(gaeste, int) and gaeste > 0:
            felder["max_guests"] = gaeste
        # Wohnfläche aus `property_details.listing_size` (live gemessen:
        # {"size": 33, "size_unit": "SQUARE_METERS"}). Echte Spalten, weil nach
        # der Fläche gefiltert wird — im Objektformular ist sie ein Pflichtfeld
        # und blieb leer, obwohl Airbnb sie liefert.
        gebaeude = ali.gebaeudedaten_uebernehmen(listing)
        if gebaeude.get("flaeche") and gebaeude.get("flaecheEinheit"):
            felder["size_value"] = gebaeude["flaeche"]
            felder["size_unit"] = gebaeude["flaecheEinheit"]
        objekt_ausstattung, zimmer_ausstattung = _airbnb_amenities(
            listing.get("amenities")
        )
        if objekt_ausstattung:
            felder["amenities"] = objekt_ausstattung
        if zimmer_ausstattung:
            # Eigene Spalte: die Maske hakt Zimmer-Merkmale nur an, wenn sie hier
            # stehen. Lagen sie in `amenities`, blieb jede Checkbox leer.
            felder["room_amenities"] = zimmer_ausstattung
        return felder

    def airbnb_content_uebernehmen(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        listing_id: str,
        token: str,
        locale: str = "de",
    ) -> dict[str, Any]:
        """Adresse, Beschreibung, Ausstattung und Fotos EINES Objekts holen.

        Wurzel 1: gepflegte Werte bleiben. Überschrieben wird nur, was bei uns
        leer ist — sonst setzt jeder Abruf die eigene Korrektur des Betriebs
        zurück. AUSNAHME `address`/`postal_code`/`lat`/`lng`: dort steht bei
        diesem Konto die FIRMENADRESSE aus dem Channex-Kreislauf
        (`Hirtshalsvej 21`, 9881 bei allen 18 Objekten gemessen), während Airbnb
        die echte Hausadresse kennt (`Skagen Landevej 772`, 9800). Ein falscher
        Wert ist schlimmer als ein leerer — Airbnbs Adresse gewinnt.
        """
        listing = self.airbnb_listing_direkt(token, listing_id)
        if not listing:
            return {"uebernommen": [], "fotos": 0}

        vorhanden = (
            db.table("properties")
            .select("address, street, house_number, postal_code, city, "
                    "lat, lng, max_guests, size_value, size_unit, "
                    "amenities, room_amenities, description, type_attributes")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        alt = vorhanden[0] if vorhanden else {}

        # Adresse und Koordinaten kommen von Airbnb, auch wenn bei uns etwas
        # steht: was dort steht, ist die Firmenanschrift (siehe Docstring).
        adress_felder = {
            "address", "street", "house_number", "postal_code", "lat", "lng",
        }
        neu: dict[str, Any] = {}
        for feld, wert in self.airbnb_stammdaten_felder(listing).items():
            leer = alt.get(feld) in (None, "", [], {})
            if feld in adress_felder or leer:
                neu[feld] = wert

        beschreibung = self.airbnb_beschreibung_direkt(token, listing_id, locale)
        if beschreibung and not alt.get("description"):
            text = (beschreibung.get("description") or "").strip()
            if text:
                neu["description"] = text

        region_attrs = self._region_nachtragen(
            alt, neu.get("lat", alt.get("lat")), neu.get("lng", alt.get("lng"))
        )
        if region_attrs is not None:
            neu["type_attributes"] = region_attrs

        # Baujahr und Etagen haben keine eigene Spalte. Sie werden AUF den Stand
        # gelegt, den die Region-Zeile oben ggf. schon erzeugt hat — ein zweites
        # `neu["type_attributes"] = ...` würde die Region wieder wegnehmen
        # (Wurzel 1: der Gegenzustand zum Setzen ist das Erhalten des Rests).
        basis = neu.get("type_attributes")
        if not isinstance(basis, dict):
            basis = alt.get("type_attributes")
            basis = dict(basis) if isinstance(basis, dict) else {}
        else:
            basis = dict(basis)
        gebaeude = ali.gebaeudedaten_uebernehmen(listing)
        ergaenzt = False
        for schluessel in ("baujahr", "etagenImGebaeude", "etage"):
            wert = gebaeude.get(schluessel)
            if wert and not basis.get(schluessel):
                basis[schluessel] = wert
                ergaenzt = True
        if ergaenzt:
            neu["type_attributes"] = basis

        if neu:
            db.table("properties").update(neu).eq("tenant_id", tenant_id).eq(
                "id", property_id
            ).execute()

        fotos = self._airbnb_fotos_speichern(
            db, property_id, token, listing_id, locale
        )
        # Gemeldet wird, WAS ankam, nicht in welche Spalte es floss:
        # `type_attributes` ist ein Sammel-JSON, hier trägt es allein die Region.
        gemeldet = sorted(
            "state_province" if feld == "type_attributes" else feld
            for feld in neu
        )
        log.info(
            "airbnb_content_uebernommen",
            tenant_id=tenant_id, property_id=property_id,
            felder=gemeldet, fotos=fotos,
        )
        return {"uebernommen": gemeldet, "fotos": fotos}

    @staticmethod
    def _region_nachtragen(
        alt: dict[str, Any], lat: object, lng: object
    ) -> dict[str, Any] | None:
        """Bundesland/Region in `type_attributes.location.stateProvince` setzen.

        Airbnb liefert das Feld NICHT (35 Felder gemessen, vier Formate, kein
        state/region — siehe `region_geokodierung`). Es entsteht hier aus den
        Koordinaten, die Airbnb liefert.

        Wurzel 1: `type_attributes` ist ein Sammel-JSON mit Entfernungen,
        Wegbeschreibung und Kartenbild darin. Es wird MITGELESEN und ergänzt,
        nie ersetzt — ein Update mit nur `{"location": {...}}` würde alles
        andere darin löschen.

        Wurzel 4: ein bereits gepflegter Wert des Betriebs bleibt stehen, und
        ohne Geokodier-Treffer wird nichts geschrieben (None) statt ein
        plausibler Ersatz.
        """
        attrs = alt.get("type_attributes")
        attrs = dict(attrs) if isinstance(attrs, dict) else {}
        location = attrs.get("location")
        location = dict(location) if isinstance(location, dict) else {}
        if str(location.get("stateProvince") or "").strip():
            return None
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            return None
        region = region_aus_koordinaten(float(lat), float(lng))
        if not region:
            return None
        location["stateProvince"] = region
        attrs["location"] = location
        return attrs

    def _airbnb_fotos_speichern(
        self,
        db: Client,
        property_id: str,
        token: str,
        listing_id: str,
        locale: str = "de",
    ) -> int:
        """Airbnb-Fotos als `property_photos` anlegen — nur die neuen.

        Wurzel 2: die URL ist der Schlüssel. Ein zweiter Aufruf legt dasselbe
        Foto nicht erneut an; eigene Fotos des Betriebs bleiben unberührt.
        Das erste Airbnb-Foto wird NUR Titelbild, wenn es noch keins gibt.

        Die Bildtexte werden in EINEM Aufruf in `locale` übersetzt und BEIDES
        gespeichert (Original + Übersetzung) — ohne das zeigt die Oberfläche
        Platzhalter, weil sie nur ihre eigene Sprache liest.
        """
        fotos = self.airbnb_fotos_direkt(token, listing_id)
        if not fotos:
            return 0
        bestehende = (
            db.table("property_photos")
            .select("url, is_cover")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        bekannte = {str(f.get("url")) for f in bestehende}
        hat_cover = any(f.get("is_cover") for f in bestehende)
        naechste = len(bestehende)

        neue = [f for f in fotos if f["url"] not in bekannte]
        if neue:
            captions = self._captions_aufbauen(neue, locale)
            zeilen = [
                {
                    "property_id": property_id,
                    "url": foto["url"],
                    "caption": caption,
                    "sort_order": naechste + i,
                    "is_cover": not hat_cover and i == 0,
                }
                for i, (foto, caption) in enumerate(zip(neue, captions, strict=True))
            ]
            db.table("property_photos").insert(zeilen).execute()
            self._photos_spalte_spiegeln(db, property_id)

        # Die Raum-Zuordnung IMMER pflegen, auch wenn kein Foto neu ist: sie
        # ändert sich bei Airbnb unabhängig vom Bestand (der Betrieb hängt dort
        # ein Bild um), und die bereits importierten Fotos hätten sonst nie eine
        # (live: 16 Fotos ohne jede Zuordnung). Wurzel 1 — der Abgleich gehört
        # zur Aktion, nicht nur das Anlegen.
        self._airbnb_foto_raum_pflegen(db, property_id, fotos)
        return len(neue)

    def _airbnb_raumarten(self, db: Client, property_id: str) -> dict[str, str]:
        """Airbnbs Raumart je Raum-ID. Leer, wenn nicht lesbar.

        Best effort: ohne die Arten wird die Zuordnung trotzdem gepflegt, nur
        eine später tote Raum-ID lässt sich dann nicht mehr auflösen.
        """
        zeile = (
            db.table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not zeile:
            return {}
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        kanal = self._airbnb_kanal_des_betriebs(  # type: ignore[attr-defined]
            db, str(zeile[0]["tenant_id"])
        )
        if not listing_id or not kanal:
            return {}
        raeume = self._airbnb_raeume_lesen(kanal, listing_id)  # type: ignore[attr-defined]
        return {
            str(r["id"]): str(r.get("room_type") or "")
            for r in (raeume or []) if r.get("id")
        }

    def _airbnb_foto_raum_pflegen(
        self, db: Client, property_id: str, fotos: list[dict[str, Any]]
    ) -> None:
        """`airbnb_foto_raum` mit Airbnbs Stand abgleichen.

        Airbnb-Eigenheit, darum eigene Tabelle statt Spalten in
        `property_photos` (Booking.com kennt das Konzept nicht, 0288).

        Der Abgleich geht über die URL: sie ist der einzige Wert, den beide
        Seiten teilen — unsere Zeilen tragen Airbnbs CDN-URL. Ein Foto, das der
        Betrieb selbst hochgeladen hat, hat keine Entsprechung bei Airbnb und
        bleibt hier zu Recht außen vor.

        Best effort: fällt der Abgleich aus, bleiben die Fotos selbst korrekt —
        der Grund steht im Log (Wurzel 5: kein stiller Erfolg).
        """
        # Der Mandant hängt am OBJEKT, nicht am Foto: `property_photos` hat
        # keine `tenant_id` (live geprüft, 9 Spalten). Der frühere Select darauf
        # warf 42703 und liess den Abgleich jedes Mal in den Best-effort-Fang
        # laufen — deshalb war die Tabelle trotz 16 Fotos praktisch leer.
        objekt = (
            db.table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not objekt:
            return
        tenant_id = str(objekt[0]["tenant_id"])
        unsere = (
            db.table("property_photos")
            .select("id, url")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        nach_url = {str(z.get("url")): z for z in unsere}
        # Die ART zur Raum-ID: die ID ist FLÜCHTIG (Löschen+Neuanlegen im
        # Extranet gibt eine neue), die Art bleibt. Ohne sie lässt sich eine
        # tote ID später nicht mehr auflösen — live genau der Fall gewesen
        # (Balkon 817240083 → 817255403, siehe 0290).
        art_je_raum = self._airbnb_raumarten(db, property_id)
        zeilen = []
        for foto in fotos:
            unser = nach_url.get(foto["url"])
            if not unser or not foto.get("airbnb_photo_id"):
                continue
            raum_id = foto.get("airbnb_room_id")
            zeilen.append(
                {
                    "tenant_id": tenant_id,
                    "property_photo_id": unser["id"],
                    "airbnb_photo_id": foto["airbnb_photo_id"],
                    "airbnb_room_id": raum_id,
                    "airbnb_room_art": art_je_raum.get(str(raum_id or "")),
                }
            )
        if not zeilen:
            return
        try:
            # Auf die Foto-Zeile upserten, nicht auf die Airbnb-Kennung: unser
            # Foto ist der stabile Bezug, und `property_photo_id` ist UNIQUE.
            db.table("airbnb_foto_raum").upsert(
                zeilen, on_conflict="property_photo_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
            # `error`, nicht `warning`: hier steckte ein echter Programmierfehler
            # (Select auf eine Spalte, die es nicht gibt → 42703), und als
            # Warnung ist er niemandem aufgefallen — die Tabelle blieb leer,
            # während die Oberfläche „keine Zuordnung" meldete.
            log.error(
                "airbnb_foto_raum_abgleich_fehlgeschlagen",
                property_id=property_id, error=str(exc)[:300],
            )
            return
        log.info(
            "airbnb_foto_raum_abgeglichen",
            property_id=property_id, zeilen=len(zeilen),
            ohne_raum=sum(1 for z in zeilen if not z["airbnb_room_id"]),
        )

    @staticmethod
    def _captions_aufbauen(
        fotos: list[dict[str, Any]], locale: str
    ) -> list[dict[str, str]]:
        """Je Foto `{quelle: Original, locale: Übersetzung}`.

        EIN Übersetzungsaufruf für alle Texte (Google nimmt bis 128 je Anfrage) —
        17 Einzelaufrufe wären 17-mal Latenz und Quote. Ohne Schlüssel oder bei
        einem Fehler bleibt nur das Original stehen; es wird nie ein Text
        erfunden und nie einer an ein fremdes Bild geschrieben (die Zuordnung
        gilt nur, wenn die Anzahl exakt passt — das prüft
        `bildtexte_uebersetzen`).
        """
        # Airbnb nennt die Sprache seiner Bildtexte nicht. Die gemessenen Texte
        # dieses Kontos sind englisch („Living-dining area with sofa bed…"),
        # deshalb gilt `en` als Quelle — für die Übersetzung UND als Locale, unter
        # dem das Original abgelegt wird (dieselbe Annahme wie zuvor, nur jetzt
        # NEBEN der Übersetzung statt allein).
        quelle = "en"
        indizes = [i for i, f in enumerate(fotos) if f.get("caption_roh")]
        texte = [str(fotos[i]["caption_roh"]) for i in indizes]
        uebersetzt = bildtexte_uebersetzen(texte, quelle=quelle, ziel=locale)
        je_index: dict[int, str] = {}
        if uebersetzt:
            je_index = dict(zip(indizes, uebersetzt, strict=True))
        return [
            caption_mehrsprachig(
                str(f.get("caption_roh") or ""),
                je_index.get(i),
                quelle=quelle,
                ziel=locale,
            )
            for i, f in enumerate(fotos)
        ]

    @staticmethod
    def _photos_spalte_spiegeln(db: Client, property_id: str) -> None:
        """`properties.photos` aus `property_photos` nachziehen.

        Es gibt ZWEI Orte für Fotos: die Tabelle `property_photos` (die
        Foto-Verwaltung) und die Spalte `properties.photos` (URL-Array, aus dem
        Listen und die Objekt-Kachel ihr Titelbild nehmen). Wer nur die Tabelle
        füllt, hat 17 Fotos und trotzdem eine leere Kachel — genau so gemessen
        (Objekt 020: Tabelle 17, Spalte 0).

        Titelbild zuerst (`is_cover`), danach `sort_order` — dieselbe Ordnung wie
        beim Channex-Push, damit die Kachel dasselbe Bild zeigt wie die Portale.
        """
        rows = (
            db.table("property_photos")
            .select("url, is_cover, sort_order")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        geordnet = sorted(
            (r for r in rows if r.get("url")),
            key=lambda r: (not r.get("is_cover"), int(r.get("sort_order") or 0)),
        )
        db.table("properties").update(
            {"photos": [str(r["url"]) for r in geordnet]}
        ).eq("id", property_id).execute()

    def sync_airbnb_ausstattung(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Die gespeicherte Ausstattung eines Objekts zurück an Airbnb.

        Einstieg für den Worker (kein AuthContext): der Job trägt den Tenant
        selbst, und die Abfrage bleibt darauf gescopt (Wurzel 3).

        Zweiter Weg NEBEN dem Channex-Content-Sync. Channex trägt nur, was einen
        Eintrag in seinem Facility-Katalog hat; die übrigen Airbnb-Merkmale
        (Parkvarianten, Hängematte, Mülltrennung, Langzeitaufenthalte …) haben
        dort keine UUID und fielen beim Sync still unter den Tisch.

        Kein Airbnb-Objekt oder kein verbundenes Konto heißt: nichts zu tun —
        kein Fehler. Ein FEHLGESCHLAGENER Schreibaufruf dagegen fliegt hoch
        (`AirbnbSchreibfehler`) und kippt den Job auf Retry (Wurzel 5).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, airbnb_listing_id, amenities, room_amenities",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = prop.get("airbnb_listing_id")
        if not listing_id:
            return {"listing_id": None, "geschrieben": []}
        zugang = self._airbnb_token(db, tenant_id)
        if not zugang:
            log.info("airbnb_ausstattung_ohne_konto", property_id=property_id)
            return {"listing_id": str(listing_id), "geschrieben": []}
        token, _user_id = zugang
        geschrieben = self.airbnb_ausstattung_schreiben(
            token,
            str(listing_id),
            prop.get("amenities") or [],
            prop.get("room_amenities") or [],
        )
        return {"listing_id": str(listing_id), "geschrieben": geschrieben}

    def sync_airbnb_stammdaten(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Fläche und Kapazität eines Objekts zurück an Airbnb.

        Gegenstück zum Import (`airbnb_content_uebernehmen`): dieselben Felder,
        andere Richtung. Ohne diesen Weg war die Maske eine Einbahnstraße — der
        Betrieb korrigierte die Wohnfläche bei uns, und bei Airbnb blieb der
        alte Wert stehen.

        Wie beim Ausstattungs-Sync: kein Airbnb-Objekt oder kein verbundenes
        Konto heißt „nichts zu tun" (kein Fehler), ein fehlgeschlagener
        Schreibaufruf dagegen fliegt hoch und kippt den Job auf Retry (Wurzel 5).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, airbnb_listing_id, size_value, size_unit, max_guests",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = prop.get("airbnb_listing_id")
        if not listing_id:
            return {"listing_id": None, "geschrieben": {}}
        zugang = self._airbnb_token(db, tenant_id)
        if not zugang:
            log.info("airbnb_stammdaten_ohne_konto", property_id=property_id)
            return {"listing_id": str(listing_id), "geschrieben": {}}
        token, _user_id = zugang
        geschrieben = self.airbnb_stammdaten_schreiben(
            token,
            str(listing_id),
            prop.get("size_value"),
            prop.get("size_unit"),
            prop.get("max_guests"),
        )
        return {"listing_id": str(listing_id), "geschrieben": geschrieben}
