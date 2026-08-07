"""Airbnb-Listing-Einstellungen am Mapping (`channels/{cid}/mappings/{mid}/*`).

Der dritte Namensraum neben `action/*` und `execute/*` — und der einzige, über
den sich Airbnbs eigene Listing-Einstellungen LESEN und SCHREIBEN lassen.
Warum das wichtig ist: es sind die Felder, für die Channex' ARI kein
Restriktionsfeld hat. Wer sie über `POST /restrictions` sucht, findet nichts
und schließt fälschlich, Airbnb könne das nicht.

Verlässlichkeit: hier antwortet ein GET mit echten Daten (`type:
airbnb_listing_availability_settings`), nicht mit einem inhaltsleeren
„Success" wie der `execute`-Namensraum. Live gegengeprüft am 06.08.2026.

Eigenes Modul, weil `channex_client` sonst über die 1500-Zeilen-Grenze läuft.
"""

from __future__ import annotations

from typing import Any


class ListingSettingsMixin:
    """Airbnbs Preis- und Verfügbarkeitsregeln je Mapping."""

    def get_listing_availability_settings(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any]:
        """Verfügbarkeits-Einstellungen EINES Airbnb-Listings (je Mapping).

        LIVE VERIFIZIERT (06.08.2026): 200, `type` =
        `airbnb_listing_availability_settings`. Enthält die Airbnb-eigenen
        Regeln, für die Channex KEIN ARI-Restriktionsfeld hat:
        `turnover_days` (Puffer zwischen Buchungen), `booking_lead_time`
        (Vorlauf in STUNDEN), `max_days_notice` (Buchungsfenster in Tagen),
        `default_min_nights`/`default_max_nights` und die Wochentags-Listen
        `day_of_week_check_in`/`_check_out`.

        Vor jedem Schreiben lesen: der PUT ersetzt das Objekt (Wurzel 1).
        """
        return self.get(  # type: ignore[attr-defined]
            f"channels/{channel_id}/mappings/{mapping_id}/availability_settings"
        )

    def update_listing_availability_settings(
        self, channel_id: str, mapping_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Verfügbarkeits-Einstellungen eines Airbnb-Listings schreiben.

        ACHTUNG wie beim Preis-Zwilling: PUT ersetzt das ganze Objekt. Immer den
        GET-Stand als Grundlage nehmen und nur die eigenen Felder tauschen —
        sonst fallen Felder, die wir nicht führen (`day_of_week_min_nights`,
        `allow_rtb_*`, `seasonal_min_nights`), bei Airbnb auf deren Vorgabe
        zurück.

        Pflichtfelder laut Schema (`Airbnb.ListingSettings.AvailabilitySettings
        .yaml`): booking_lead_time, max_days_notice, default_max_nights,
        allow_rtb_above_max_nights, turnover_days.
        """
        return self.put(  # type: ignore[attr-defined]
            f"channels/{channel_id}/mappings/{mapping_id}/availability_settings",
            json={"availability_settings": settings},
        )
