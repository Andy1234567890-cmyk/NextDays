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

from typing import Any

import httpx
from supabase import Client

from .bildtext_uebersetzung import bildtexte_uebersetzen, caption_mehrsprachig
from .common import log
from .region_geokodierung import region_aus_koordinaten

AIRBNB_API = "https://api.airbnb.com"

# Ohne diesen Filter antwortet Airbnb mit 200 und einer LEEREN Liste (gemessen).
LISTINGS_PARAMS = {"has_availability": "false", "_limit": "50"}

_TIMEOUT = httpx.Timeout(30.0)


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


def _airbnb_amenities(rohe: object) -> list[str]:
    """Airbnbs `amenities` in unser Text-Array übersetzen.

    Airbnb liefert ein Objekt `{"REFRIGERATOR": {"is_present": true, …}, …}`.
    Übernommen wird nur, was `is_present` trägt — ein Eintrag mit `false` heißt
    „ausdrücklich nicht vorhanden" und darf nicht als Ausstattung gelten.
    Unsere Spalte führt Kleinschreibung (`{wifi,heating,…}`).
    """
    if not isinstance(rohe, dict):
        return []
    return sorted(
        name.lower()
        for name, wert in rohe.items()
        if isinstance(wert, dict) and wert.get("is_present")
    )


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
        amenities = _airbnb_amenities(listing.get("amenities"))
        if amenities:
            felder["amenities"] = amenities
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
                    "lat, lng, max_guests, "
                    "amenities, description, type_attributes")
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
        if not neue:
            return 0

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
        return len(zeilen)

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
