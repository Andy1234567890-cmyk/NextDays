"""Airbnb-Listing-Aktionen des Channex-Clients (`channels/{id}/action/*`).

Eigenes Modul, weil dieser Namensraum eine ANDERE Verlässlichkeit hat als der
`execute`-Namensraum daneben — und das ist der Unterschied, an dem hier schon
einmal eine falsche Schlussfolgerung hing:

    action/<name>   antwortet auf einen erfundenen Namen mit
                    400 {"details":["action is not supported"]}
                    → eine 200 ist hier ein echter Existenznachweis.
    execute/<name>  antwortet auf JEDEN Namen mit 200 {"message":"Success"},
                    auch auf „voelliger_unsinn_xyz123"
                    → als Nachweis unbrauchbar.

Beide live gegengeprüft (05.08.2026, Konto AirSmil).
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger

# Eigener Logger statt Import aus `common`/`channex_client`: dieses Modul wird
# VON `channex_client` eingebunden, ein Import zurück wäre ein Zirkel.
log = get_logger("nextdays.channex.airbnb")


class AirbnbActionsMixin:
    """Airbnb-Aktionen am Kanal — lesend, plus die drei Raum-Schreibwege."""

    def airbnb_api_proxy_get(
        self, channel_id: str, endpoint: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Einen LESENDEN Airbnb-Aufruf durch Channex durchreichen.

        Form wörtlich aus Airbnbs „Airbnb Connection API":
            POST channels/{id}/action/api_proxy
            {"request": {"endpoint": …, "method": "get", "params": …,
                         "payload": {}}}

        `method` ist hier festgeschrieben auf `get`. Der Proxy kann laut Doku
        auch PUT/POST/DELETE — aber ein Schreibzugriff auf ein Airbnb-Listing
        gehört nicht in eine Methode, die man versehentlich aufruft. Wer schreiben
        will, baut das bewusst und benennt es so.

        LIVE VERIFIZIERT (05.08.2026): `listing_rooms` → 200,
        `listing_descriptions` → 200 mit DREI Sprachversionen (de/en/da).
        Kontrolltest: `erfundener_endpunkt_zzz` → 422 `route_not_found` — die
        200er sind also echte Airbnb-Antworten.
        """
        return self.post(
            f"channels/{channel_id}/action/api_proxy",
            json={
                "request": {
                    "endpoint": endpoint,
                    "method": "get",
                    "params": params,
                    "payload": {},
                }
            },
        )

    def get_airbnb_listing_descriptions(
        self, channel_id: str, listing_id: str
    ) -> dict[str, Any]:
        """Alle Sprachversionen der Texte eines Listings.

        Antwort: `data.listing_descriptions[]`, je Eintrag mit `locale` und den
        Textfeldern. Live gemessen liefert Airbnb für Objekt 020 drei Sprachen
        (de, en, da) — und `house_rules` NUR in der deutschen Fassung. Wer eine
        Sprache annimmt, verliert die anderen zwei und die Hausregeln.
        """
        return self.airbnb_api_proxy_get(
            channel_id, "listing_descriptions", {"listing_id": listing_id}
        )

    def get_airbnb_listing_rooms(
        self, channel_id: str, listing_id: str
    ) -> dict[str, Any]:
        """Die Räume eines Listings direkt von Airbnb (`data.listing_rooms[]`).

        Dieselbe Form wie `rooms[]` in `listing_details`, aber als eigener Abruf
        — nützlich, um nach einer Änderung nur die Räume nachzuziehen.
        """
        return self.airbnb_api_proxy_get(
            channel_id, "listing_rooms", {"listing_id": listing_id}
        )

    def airbnb_api_proxy_write(
        self,
        channel_id: str,
        endpoint: str,
        method: str,
        *,
        params: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Einen SCHREIBENDEN Airbnb-Aufruf durch Channex durchreichen.

        Bewusst getrennt von `airbnb_api_proxy_get`: ein Schreibzugriff auf ein
        Live-Listing darf nicht das Ergebnis eines vertippten Parameters sein.

        Form aus Airbnbs „Airbnb Connection API" (Abschnitt „Execute API Proxy
        request", `docs/OTA/Airbnb/Airbnb Connection API.pdf`, S. 10) — dort
        ausdrücklich `method: PUT, POST, GET, DELETE`, `endpoint: Airbnb method
        URL`, `payload: request JSON body`.

        Der Proxy ist ein ECHTER Durchgriff, nicht die 200-Attrappe des
        `execute`-Namensraums: lesend gemessen liefert `listing_rooms` die Räume,
        ein erfundener Endpunkt antwortet 422 `route_not_found` (05.08.2026).

        Was er zurückgibt, ist Airbnbs eigene Antwort. Ein Erfolg wird NIE aus
        dem Status geschlossen (Wurzel 5) — der Aufrufer liest den Stand zurück.
        """
        anfrage = {
            "endpoint": endpoint,
            "method": method.lower(),
            "params": params or {},
            "payload": payload or {},
        }
        # VOR dem Senden protokollieren, nicht danach: bei einem Timeout oder
        # Abbruch stünde sonst nirgends, was hinausging. Der Fehler-Sink des
        # Clients zeigt den Body nur bei einer Antwort mit Fehlerstatus.
        log.info(
            "airbnb_proxy_schreibaufruf",
            channel_id=channel_id, endpoint=endpoint,
            methode=anfrage["method"], params=anfrage["params"],
            payload=anfrage["payload"],
        )
        return self.post(
            f"channels/{channel_id}/action/api_proxy", json={"request": anfrage}
        )

    def create_airbnb_listing_room(
        self, channel_id: str, listing_id: str, room_type: str, *, privat: bool
    ) -> dict[str, Any]:
        """Einen Raum bei Airbnb anlegen (`POST listing_rooms`).

        DER PAYLOAD IST FLACH — keine `listing_room`-Hülle. Das war die Ursache
        von drei Fehlversuchen am Live-Listing (05.08.2026); die Hülle ist
        naheliegend, weil die Leseantwort unter `listing_rooms[]` gruppiert, aber
        Channex' Validator sucht die Felder direkt im Payload.

        Gemessen, indem `room_type` bewusst WEGGELASSEN wurde (dann kann Airbnb
        nichts anlegen, und man sieht nur, wie weit der Validator kommt):

            payload {"listing_id": …}                    → 422 room_type is required.
            payload {"listing_room": {"listing_id": …}}  → 422 listing_id is required.

        „room_type is required" ist der Beweis, dass die Kennung angekommen ist.
        Vorher gemessen und alle mit „listing_id is required" gescheitert:
        Kennung nur in der Hülle · Kennung in `params` + Hülle · Kennung als
        Query-String am Endpunkt + Hülle.

        `params` gehört nicht dazu: die Doku nennt das Feld „GET Arguments"
        (`docs/OTA/Airbnb/Airbnb Connection API.pdf`, S. 10), und beim POST wird
        es nicht ausgewertet.

        Die Feldnamen sind die der Leseantwort (`listing_id`, `room_type`,
        `is_private`, live abgelesen) — dieselbe Ressource.

        Betten gehen NICHT mit: sie hängen bei uns am Objekt
        (`type_attributes.beds`), nicht am Zimmer (0251) — ein erfundenes Bett
        wäre eine Behauptung über die Anzeige (Wurzel 4).
        """
        return self.airbnb_api_proxy_write(
            channel_id,
            "listing_rooms",
            "post",
            payload={
                "listing_id": listing_id,
                "room_type": room_type,
                "is_private": privat,
            },
        )

    def delete_airbnb_listing_room(
        self, channel_id: str, listing_id: str, room_id: str
    ) -> dict[str, Any]:
        """Einen Raum bei Airbnb löschen — DIESEN WEG GIBT ES BEI CHANNEX NICHT.

        Live gemessen (05.08.2026) mit einer erfundenen Raum-ID, also ohne einen
        echten Raum zu treffen. ALLE vier denkbaren Formen antworten
        422 `Route not found`:

            DELETE listing_rooms/{id}      DELETE listing_rooms (id im Body)
            PUT    listing_rooms/{id}      POST   listing_rooms/{id}/delete

        Zum Vergleich, im GLEICHEN Proxy: `POST listing_rooms` antwortet
        inhaltlich (`room_type is required`), wird also erkannt. Zwei
        verschiedene Meldungen = Channex kennt die POST-Route und die
        Lösch-Routen nicht. Anlegen geht, Löschen nicht.

        Der Aufruf bleibt hier, weil er den Messbefund dokumentiert und der
        Aufrufer den Fehlschlag protokolliert, statt „gelöscht" zu melden
        (Wurzel 5). Ein in unserer Maske entfernter Raum muss bis auf Weiteres im
        Airbnb-Extranet nachgezogen werden — das sagt die Oberfläche jetzt auch.
        """
        return self.airbnb_api_proxy_write(
            channel_id,
            f"listing_rooms/{room_id}",
            "delete",
            payload={"listing_id": listing_id},
        )

    def get_airbnb_listings(self, channel_id: str) -> dict[str, Any]:
        """Alle Airbnb-Listings des Kanals (`action/listings`).

        Airbnb-Doku „Airbnb Connection API": Antwort ist
        `data.listing_id_dictionary.values[]` mit `{id, title, type,
        synchronization_category}`.

        LIVE VERIFIZIERT (05.08.2026, Konto AirSmil): 200, 18 Listings.
        Kontrolltest im GLEICHEN Namensraum: `action/erfundene_aktion_zzz`
        → 400 `{"details":["action is not supported"]}`. Der `action`-Namensraum
        ist also — anders als `execute` — ein belastbarer Existenznachweis.
        """
        return self.get(f"channels/{channel_id}/action/listings")

    def get_airbnb_listing_details(
        self, channel_id: str, listing_id: str
    ) -> dict[str, Any]:
        """Ein Airbnb-Listing VOLLSTÄNDIG (`action/listing_details`).

        Das ist der von Airbnb dokumentierte Content-Weg, der hier lange für
        nicht existent gehalten wurde: frühere Messreihen hatten
        `proxy/v2/listings`, `proxy/v2/calendars` und `channels/{id}/listings`
        geprüft (alle 500/404) — der ausgewiesene Pfad
        `channels/{id}/action/listing_details?listing_id=…` war NIE darunter.

        LIVE VERIFIZIERT (05.08.2026, Listing „013 Rævlingevej · The Fox House"):
        200 mit 38 Feldern unter `data.listing`, darunter die vollständigen
        `booking_settings` (Storno `better_strict_with_grace_period`,
        `check_in_time_end: "FLEXIBLE"`, alle `guest_controls`),
        `pricing_settings.standard_fees` (Reinigung 955, Resort 25 — als
        HAUPTEINHEIT, nicht in Cents), `availability_rules`, `rooms[]` (9),
        `images[]` (35) und `quality_standards.state`.

        Zwei Messbefunde, die Annahmen im Code korrigieren bzw. bestätigen:
        - `state` ist auch hier `null` → Airbnb liefert die Region wirklich
          nirgends, die Geokodierung bleibt der richtige Weg.
        - `total_inventory_count` fehlt in dieser Antwort ganz (das Feld steht
          nur in Airbnbs Beispiel) → die Einheiten-Anzahl ist daraus NICHT
          ableitbar.
        """
        return self.get(
            f"channels/{channel_id}/action/listing_details",
            params={"listing_id": listing_id},
        )
