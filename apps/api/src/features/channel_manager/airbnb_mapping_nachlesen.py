"""Airbnbs Werte einer BESTEHENDEN Zuordnung nachlesen.

WOZU DAS EXISTIERT: `POST channels/{id}/mappings` ist der Lesekanal zu Airbnb —
seine Antwort traegt Preis, Gebuehren, Aufenthalts- und Buchungsregeln. Besteht
die Zuordnung aber schon, antwortet Channex 422 „rate plan already exists", und
ein 422 hat KEINE Antwort-Nutzlast. Der Zielzustand ist erreicht (Wurzel 2), die
Werte fehlen trotzdem.

Live gemessen (24.08.2026 06:50, „FeWo *Stjerneskud*", Kanal 21ec5429…):

    POST channels/21ec5429…/mappings → 422
    {"mapping": ["rate plan already exists"]}

DAS KANAL-OBJEKT IST NICHT DIE QUELLE. Naheliegend waere, die Werte aus
`attributes.rate_plans[]` zu nehmen — dort steht der Ist-Stand der Mappings
(einen GET-Pfad fuer Mappings gibt es nicht, alle 404). Die Eintraege tragen
aber nur `id` (die Mapping-ID), `rate_plan_id` und ein SCHMALES `settings`
(`listing_id`, `published`, im Altbestand `airbnb_rate_plan_id`) — NICHT
`pricing_setting`/`availability_rule`/`booking_setting`.

Der Beleg dafuer steht im Haus, nicht in einer Annahme:
`airbnb_gebuehren._airbnb_pricing_settings` liest aus `rate_plans[]` genau die
MAPPING-ID heraus und holt die Preise DANACH per
`GET channels/{cid}/mappings/{mid}/pricing_settings`. Truege das Kanal-Objekt
sie selbst, waere dieser zweite Aufruf ueberfluessig.

Also derselbe Weg hier — die zwei Mapping-Endpunkte, die live verifiziert echte
Daten liefern statt des inhaltsleeren „Success" des `execute`-Namensraums:

    GET channels/{cid}/mappings/{mid}/pricing_settings       → Preis/Gebuehren
    GET channels/{cid}/mappings/{mid}/availability_settings  → Aufenthaltsregeln

Und wenn auch das nichts ergibt, ist die Antwort `None` — der Ablauf darf NICHT
weiterlaufen, als haette er Airbnbs Werte (Wurzel 4/5).

Eigenes Modul, weil `airbnb_objekt_abruf` sonst ueber die 1500-Zeilen-Grenze
laeuft (dieselbe Begruendung wie bei `channex_listing_settings`).
"""

from __future__ import annotations

from typing import Any

from .channex_client import ChannexError
from .common import log


class AirbnbMappingNachlesenMixin:
    """Preis-/Regelwerte einer bestehenden Airbnb-Zuordnung. Mixin des Service."""

    def _settings_vom_bestehenden_mapping(
        self, channel_id: str, channex_rate_plan_id: str, property_id: str
    ) -> dict[str, Any] | None:
        """Airbnbs Preis-/Regelwerte einer BESTEHENDEN Zuordnung nachlesen.

        Der Ersatz für die Antwort-Nutzlast, die ein 422 „already exists" nicht
        mitliefert. Zusammengesetzt aus den beiden Mapping-Endpunkten, die live
        verifiziert echte Daten liefern (nicht das inhaltsleere „Success" des
        `execute`-Namensraums):

            GET channels/{cid}/mappings/{mid}/pricing_settings       → Preis
            GET channels/{cid}/mappings/{mid}/availability_settings  → Regeln

        Die Form der Rückgabe ist die der Mapping-Antwort
        (`pricing_setting`/`availability_rule`/`booking_setting`), damit
        `_preise_von_airbnb` unverändert damit arbeitet — EIN Leseformat, keine
        zweite Auswertung.

        `booking_setting` bleibt LEER: für Check-in/Storno/Gastregeln gibt es an
        diesem Namensraum keinen Endpunkt. Sie kommen im selben Ablauf schon aus
        `action/listing_details` (`_details_regeln`) und über Airbnbs eigene API
        (`_hausregeln_direkt_uebernehmen`) — hier einen leeren Block zu liefern
        ist deshalb kein Verlust, aber auch kein erfundener Wert (Wurzel 4).

        `None`, wenn die Mapping-ID nicht auffindbar ist oder BEIDE Abrufe
        nichts liefern: dann darf der Ablauf nicht so tun, als hätte er die
        Werte (Wurzel 5).
        """
        mapping_id = self._mapping_id_zum_rate_plan(channel_id, channex_rate_plan_id)
        if not mapping_id:
            log.warning(
                "airbnb_mapping_id_nicht_gefunden",
                property_id=property_id, channel_id=channel_id,
                rate_plan_id=channex_rate_plan_id,
            )
            return None

        preisteil = self._mapping_attribute(
            channel_id, mapping_id, property_id, "pricing_settings"
        )
        regeln = self._mapping_attribute(
            channel_id, mapping_id, property_id, "availability_settings"
        )
        if not preisteil and not regeln:
            log.warning(
                "airbnb_mapping_settings_unlesbar",
                property_id=property_id, channel_id=channel_id,
                mapping_id=mapping_id,
            )
            return None
        log.info(
            "airbnb_mapping_settings_nachgelesen",
            property_id=property_id, channel_id=channel_id,
            mapping_id=mapping_id,
            preis_felder=sorted(preisteil.keys()),
            regel_felder=sorted(regeln.keys()),
        )
        # KEIN `listing_id` in der Rueckgabe: `_preise_von_airbnb` bekommt es als
        # eigenen Parameter. Ein Schluessel auf `None` waere ein zweiter, stummer
        # Ort fuer dieselbe Angabe (Wurzel 1) — und niemand liest ihn.
        return {
            "pricing_setting": preisteil,
            "availability_rule": regeln,
            "booking_setting": {},
        }

    def _mapping_id_zum_rate_plan(
        self, channel_id: str, channex_rate_plan_id: str
    ) -> str | None:
        """Die Mapping-ID zu EINEM unserer Channex-Rate-Pläne am Kanal.

        Gelesen wird `attributes.rate_plans[].id` — derselbe Weg wie in
        `airbnb_gebuehren._airbnb_mapping_id`; einen GET-Pfad für Mappings gibt
        es nicht (alle 404, siehe `create_channel_mapping`).
        """
        try:
            kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except ChannexError as exc:
            log.warning(
                "airbnb_kanal_fuer_mapping_id_unlesbar",
                channel_id=channel_id, error=str(exc)[:200],
            )
            return None
        attrs = ((kanal or {}).get("data") or {}).get("attributes") or {}
        for eintrag in attrs.get("rate_plans") or []:
            if not isinstance(eintrag, dict):
                continue
            if str(eintrag.get("rate_plan_id") or "") == str(channex_rate_plan_id):
                return str(eintrag.get("id") or "") or None
        return None

    def _mapping_attribute(
        self, channel_id: str, mapping_id: str, property_id: str, welche: str
    ) -> dict[str, Any]:
        """Ein Mapping-Einstellungsobjekt lesen — `{}`, wenn es nicht kommt.

        Kein stiller Erfolg (Wurzel 5): der Grund geht ins Protokoll, und der
        Aufrufer entscheidet an der LEEREN Rückgabe, ob er weitermachen kann.
        """
        leser = {
            "pricing_settings": "get_listing_pricing_settings",
            "availability_settings": "get_listing_availability_settings",
        }[welche]
        try:
            antwort = getattr(self._channex, leser)(  # type: ignore[attr-defined]
                channel_id, mapping_id
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_mapping_attribut_unlesbar",
                property_id=property_id, mapping_id=mapping_id, welche=welche,
                error=str(exc)[:200],
            )
            return {}
        werte = ((antwort or {}).get("data") or {}).get("attributes") or {}
        return werte if isinstance(werte, dict) else {}
