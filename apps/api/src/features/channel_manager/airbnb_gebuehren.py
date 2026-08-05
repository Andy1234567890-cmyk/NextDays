"""Gebühren-Abgleich mit Airbnb: lesen, vergleichen, übernehmen.

DIE RICHTUNGEN SIND NICHT SYMMETRISCH, und das hat einen Grund:

  * RAUS (wir → Airbnb) läuft über `tax_sync`/`ota_abgaben` als Channex-`taxes`
    mit `type: "fee"`. Das ist gebaut, geprüft und für ALLE Portale zuständig —
    hier wird nichts dupliziert.
  * REIN (Airbnb → wir) gab es nicht. Der alte Weg
    (`airbnb_listing_import.gebuehren_uebernehmen` über
    `v2/pricing_settings/{listing_id}`) ist TOT: Airbnb antwortet dort 403
    „Endpoint is no longer supported in this version". Das Ergebnis landete in
    `type_attributes.airbnbGebuehren` und wurde von nichts gelesen.

Der lebende Weg ist `channels/{cid}/mappings/{mid}/pricing_settings` — live
verifiziert an 18 Listings mit 43 Gebühren (05.08.2026).

ÜBERNOMMEN WIRD NUR AUF ANSAGE. Ein automatischer Import würde beim ersten
Abruf die Preisgestaltung des Betriebs überschreiben; der Vergleich zeigt den
Unterschied, die Übernahme ist ein eigener Klick.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .airbnb_gebuehren_import import airbnb_fee_signatur, fees_aus_airbnb
from .channex_client import ChannexError
from .common import ChannelManagerError, log

# Wurzel 8: eine fremde Liste bekommt eine Obergrenze. Airbnb kennt 13
# Gebührenarten; mehr als 30 Einträge sind kein Betriebsfall, sondern ein
# Datenfehler, und dürfen keine 30 Gebühren in unser Objekt schreiben.
_MAX_GEBUEHREN = 30


class AirbnbGebuehrenMixin:
    """Airbnbs Gebühren lesen und mit unseren vergleichen."""

    def airbnb_gebuehren_vergleich(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Was bei Airbnb steht, was bei uns steht, und was sich unterscheidet.

        Der Vergleich läuft über die Signatur (Art, Rechenart, Basis, Betrag),
        nicht über den Namen: Airbnb liefert überhaupt keinen Namen, und
        derselbe Betrag unter anderem Namen ist dieselbe Gebühr.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, type_attributes, currency",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        airbnb = self._airbnb_gebuehren_lesen(db, tenant_id, property_id)
        if airbnb is None:
            # Nicht lesbar heißt NICHT „keine Gebühren" — sonst sähe die
            # Oberfläche jede vorhandene Gebühr als „nur bei uns" (Wurzel 4).
            return {
                "verbunden": False, "stand_bekannt": False,
                "airbnb": [], "nur_airbnb": [], "nur_wir": [], "gleich": [],
            }

        unsere = _unsere_fees(objekt)
        sig_airbnb = {airbnb_fee_signatur(f): f for f in airbnb}
        sig_unsere = {airbnb_fee_signatur(f): f for f in unsere}
        gemeinsam = set(sig_airbnb) & set(sig_unsere)
        log.info(
            "airbnb_gebuehren_vergleich",
            property_id=property_id, airbnb=len(airbnb), unsere=len(unsere),
            gleich=len(gemeinsam),
        )
        return {
            "verbunden": True,
            "stand_bekannt": True,
            "waehrung": objekt.get("currency"),
            "airbnb": airbnb,
            "nur_airbnb": [f for s, f in sig_airbnb.items() if s not in gemeinsam],
            # Gebühren ohne Airbnb-Entsprechung: entweder neu bei uns oder eine
            # Art, die Airbnb gar nicht kennt (`misc_charges`).
            "nur_wir": [f for s, f in sig_unsere.items() if s not in gemeinsam],
            "gleich": [sig_unsere[s] for s in gemeinsam],
        }

    def airbnb_gebuehren_uebernehmen(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Airbnbs Gebühren als unsere anlegen — nur die, die uns fehlen.

        Wurzel 1: die Aktion hat einen Gegenzustand. Bestehende Gebühren werden
        NICHT angefasst und nicht gelöscht; übernommen wird ausschliesslich, was
        bei Airbnb steht und bei uns fehlt. Alles andere wäre ein stiller
        Eingriff in die Preisgestaltung.

        Wurzel 2: zweimal geklickt darf nicht zwei Gebühren anlegen. Der
        Signatur-Abgleich macht den Aufruf idempotent — beim zweiten Mal ist
        nichts mehr „nur bei Airbnb".
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, type_attributes",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        airbnb = self._airbnb_gebuehren_lesen(db, tenant_id, property_id)
        if airbnb is None:
            raise ChannelManagerError(
                "Die Gebühren bei Airbnb sind gerade nicht lesbar. Bitte später "
                "erneut versuchen.",
                status_code=502,
            )
        unsere = _unsere_fees(objekt)
        bekannt = {airbnb_fee_signatur(f) for f in unsere}
        neu = [f for f in airbnb if airbnb_fee_signatur(f) not in bekannt]
        if not neu:
            return {"uebernommen": 0, "fees": unsere}
        if len(unsere) + len(neu) > _MAX_GEBUEHREN:
            raise ChannelManagerError(
                f"Das wären mehr als {_MAX_GEBUEHREN} Gebühren an einem Objekt. "
                "Bitte zuerst aufräumen.",
                status_code=422,
            )

        attrs = dict(objekt.get("type_attributes") or {})
        pricing = dict(attrs.get("pricing") or {})
        pricing["fees"] = [*unsere, *neu]
        attrs["pricing"] = pricing
        # Über den regulären Update-Weg, NICHT per direktem DB-Schreiben: dort
        # hängen Validierung (`normalize_fees`), die Spiegelung nach
        # `property_pricing_config` und der Abgaben-Sync-Anstoß. Ein Direkt-
        # schreiben umginge alle drei.
        self._properties_update(ctx, property_id, attrs)
        log.info(
            "airbnb_gebuehren_uebernommen",
            property_id=property_id, uebernommen=len(neu),
            arten=[f.get("feeType") for f in neu],
        )
        return {"uebernommen": len(neu), "fees": pricing["fees"]}

    def _properties_update(
        self, ctx: AuthContext, property_id: str, attrs: dict[str, Any]
    ) -> None:
        """Objekt über den Properties-Service aktualisieren.

        Eigene Methode, damit der Import-Pfad denselben Weg nimmt wie die
        Oberfläche — inklusive Gebühren-Validierung und Sync-Anstoß.
        """
        from src.features.properties.schemas import (  # noqa: PLC0415
            PropertyUpdate,
        )
        from src.features.properties.service import (  # noqa: PLC0415
            PropertiesService,
        )

        dienst = PropertiesService(service_client=self._require_db())  # type: ignore[attr-defined]
        dienst.update(ctx, property_id, PropertyUpdate(type_attributes=attrs))

    def _airbnb_gebuehren_lesen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]] | None:
        """Airbnbs Gebühren dieses Objekts. None = Stand unbekannt.

        Der Weg führt über das Mapping des Objekts, nicht über das Listing:
        `v2/pricing_settings/{listing_id}` ist abgeschaltet (403, „migrate to
        new Pricing and Availability APIs").
        """
        einstellungen = self._airbnb_pricing_settings(db, tenant_id, property_id)
        if einstellungen is None:
            return None
        roh = einstellungen.get("standard_fees")
        if not isinstance(roh, list):
            return []
        if len(roh) > _MAX_GEBUEHREN:
            log.warning(
                "airbnb_gebuehren_zu_viele",
                property_id=property_id, anzahl=len(roh), grenze=_MAX_GEBUEHREN,
            )
            roh = roh[:_MAX_GEBUEHREN]
        return fees_aus_airbnb(roh)

    def _airbnb_pricing_settings(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, Any] | None:
        """Die Preis-Einstellungen des Airbnb-Listings. None = nicht lesbar.

        Welches der kontoweiten Kanal-Mappings zu DIESEM Objekt gehört, sagt
        allein `channex_rate_plan_map` — der Kanal trägt alle Listings des
        Kontos (live: 18 an einem Kanal). Ohne diesen Abgleich läse man die
        Gebühren eines fremden Objekts (Wurzel 3).
        """
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id)  # type: ignore[attr-defined]
        if not channel_id:
            return None
        mapping_id = self._airbnb_mapping_id(db, tenant_id, property_id, channel_id)
        if not mapping_id:
            return None
        try:
            antwort = self._channex.get_listing_pricing_settings(  # type: ignore[attr-defined]
                channel_id, mapping_id
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_pricing_settings_unlesbar",
                property_id=property_id, mapping_id=mapping_id,
                status=exc.channex_status, error=exc.message,
            )
            return None
        return (antwort.get("data") or {}).get("attributes") or {}

    def _airbnb_mapping_id(
        self, db: Client, tenant_id: str, property_id: str, channel_id: str
    ) -> str | None:
        """Die Mapping-ID DIESES Objekts am kontoweiten Airbnb-Kanal.

        Die Mappings stehen unter `attributes.rate_plans[]` (nicht unter
        `mappings` — das Feld ist bei diesem Kanaltyp `null`); zugeordnet wird
        über unsere Rate-Plan-IDs.
        """
        plaene = self._channex_rate_plan_ids  # type: ignore[attr-defined]
        eigene = plaene(db, tenant_id, property_id)
        if not eigene:
            return None
        try:
            kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except ChannexError as exc:
            log.warning(
                "airbnb_kanal_unlesbar",
                property_id=property_id, error=exc.message,
            )
            return None
        attrs = ((kanal or {}).get("data") or {}).get("attributes") or {}
        for eintrag in attrs.get("rate_plans") or []:
            if str(eintrag.get("rate_plan_id") or "") in eigene:
                mapping_id = str(eintrag.get("id") or "")
                if mapping_id:
                    return mapping_id
        return None


def _unsere_fees(objekt: dict[str, Any]) -> list[dict[str, Any]]:
    """Die Gebühren des Objekts aus dem Preis-Blob."""
    attrs = objekt.get("type_attributes") or {}
    pricing = attrs.get("pricing") or {}
    fees = pricing.get("fees")
    if not isinstance(fees, list):
        return []
    return [f for f in fees if isinstance(f, dict)]
