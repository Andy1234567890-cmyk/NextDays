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


class AirbnbActionsMixin:
    """Lesende Airbnb-Aktionen am Kanal. Kein Schreibpfad."""

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
