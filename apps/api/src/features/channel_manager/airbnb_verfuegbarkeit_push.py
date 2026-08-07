"""Verfügbarkeits-Regeln des Formulars an das Airbnb-Listing schreiben.

Der Gegenpart zu `airbnb_verfuegbarkeit.airbnb_settings_aus_formular`: dort
wird übersetzt, hier wird gelesen, zusammengeführt und geschrieben.

Warum überhaupt ein eigener Weg neben ARI: Vorbereitungszeit, Buchungsfenster
und Vorlaufzeit haben bei Channex KEIN Restriktionsfeld. Sie standen deshalb
im Formular, wurden gespeichert — und gingen nirgendwohin. Für Airbnb gibt es
sie am Listing (`channels/{cid}/mappings/{mid}/availability_settings`, live
verifiziert 06.08.2026). Für die übrigen Portale existiert dieser Weg nicht;
das ist kein Versäumnis hier, sondern eine Grenze des Aggregators.

Ablauf pro Objekt (Wurzel 1 — nie blind schreiben):
  1. Mapping dieses Objekts am kontoweiten Airbnb-Kanal auflösen.
  2. Ist-Stand LESEN (der PUT ersetzt das ganze Objekt).
  3. Nur unsere Felder tauschen; ändert sich nichts, gar nicht schreiben.
  4. Schreiben und das Ergebnis protokollieren.

Schritt 3 ist der Grund, warum hier kein Aufruf gegen das Live-Konto passiert,
wenn der Betrieb etwas anderes am Objekt gespeichert hat.
"""

from __future__ import annotations

from typing import Any

from supabase import Client

from .airbnb_verfuegbarkeit import airbnb_settings_aus_formular, zusammenfuehren
from .channex_client import ChannexError
from .common import log
from .verfuegbarkeit_regeln import availability_block


class AirbnbVerfuegbarkeitPushMixin:
    """Formular-Regeln → Airbnb-Listing."""

    def airbnb_verfuegbarkeit_schreiben(
        self, tenant_id: str, property_id: str
    ) -> bool:
        """Die Airbnb-eigenen Verfügbarkeitsregeln dieses Objekts schreiben.

        Rückgabe True = es wurde etwas geschrieben. False = nichts zu tun
        (nicht verbunden, kein Mapping, keine übersetzbaren Werte, oder der
        Stand bei Airbnb stimmt bereits).

        Wirft NICHT: der Aufrufer ist der Speichern-Pfad eines Objekts, und ein
        nicht erreichbares Airbnb darf das Speichern nie kippen (Wurzel 5). Ein
        Fehlschlag wird protokolliert; der nächste Speichervorgang versucht es
        erneut.
        """
        db: Client | None = self._db  # type: ignore[attr-defined]
        felder = self._soll_felder(db, tenant_id, property_id)
        if not felder or db is None:
            return False

        ziel = self._airbnb_mapping_aufloesen(db, tenant_id, property_id)
        if ziel is None:
            return False
        channel_id, mapping_id = ziel

        bestand = self._airbnb_verfuegbarkeit_lesen(channel_id, mapping_id)
        if bestand is None:
            # Ohne Ist-Stand NICHT schreiben: der PUT ersetzt das Objekt, und
            # ohne Grundlage würden `day_of_week_*`, `allow_rtb_*` und
            # `seasonal_min_nights` auf Airbnbs Vorgabe zurückfallen (Wurzel 1).
            log.warning(
                "airbnb_verfuegbarkeit_kein_iststand",
                property_id=property_id, mapping_id=mapping_id,
            )
            return False

        nutzlast = zusammenfuehren(bestand, felder)
        if nutzlast is None:
            return False

        try:
            self._channex.update_listing_availability_settings(  # type: ignore[attr-defined]
                channel_id, mapping_id, nutzlast
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_verfuegbarkeit_schreiben_fehlgeschlagen",
                property_id=property_id, mapping_id=mapping_id,
                status=exc.channex_status, error=exc.message,
            )
            return False

        log.info(
            "airbnb_verfuegbarkeit_geschrieben",
            property_id=property_id, mapping_id=mapping_id,
            felder=sorted(felder),
        )
        return True

    @staticmethod
    def _soll_felder(
        db: Client | None, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Die Airbnb-Felder, die aus dem Formular dieses Objekts folgen.

        Leeres dict = nichts zu schreiben (kein DB-Client, Objekt fremd/nicht
        vorhanden, oder kein Formularwert fällt auf eine von Airbnb erlaubte
        Stufe).
        """
        if db is None:
            return {}
        objekt = (
            db.table("properties")
            .select("id, type_attributes")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not objekt:
            return {}
        return airbnb_settings_aus_formular(availability_block(objekt[0]))

    def _airbnb_mapping_aufloesen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> tuple[str, str] | None:
        """(channel_id, mapping_id) dieses Objekts am Airbnb-Kanal.

        None = nicht verbunden oder kein Mapping. Der Kanal ist kontoweit (live
        18 Listings an einem Kanal), erst das Mapping macht daraus DIESES Objekt
        — ohne den Abgleich schriebe man in ein fremdes Listing (Wurzel 3).
        """
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not channel_id:
            return None
        mapping_id = self._airbnb_mapping_id(  # type: ignore[attr-defined]
            db, tenant_id, property_id, channel_id
        )
        if not mapping_id:
            return None
        return channel_id, mapping_id

    def _airbnb_verfuegbarkeit_lesen(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any] | None:
        """Ist-Stand der Airbnb-Verfügbarkeitsregeln. None = nicht lesbar.

        None und `{}` sind bewusst verschieden: `{}` hieße „Airbnb führt keine
        Regeln", None heißt „wir wissen es nicht" — und dann wird nicht
        geschrieben.
        """
        try:
            antwort = self._channex.get_listing_availability_settings(  # type: ignore[attr-defined]
                channel_id, mapping_id
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_verfuegbarkeit_unlesbar",
                mapping_id=mapping_id,
                status=exc.channex_status, error=exc.message,
            )
            return None
        attrs = (antwort.get("data") or {}).get("attributes")
        return attrs if isinstance(attrs, dict) else None
