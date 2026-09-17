"""Airbnbs Hausregeln über die EIGENE API holen und in `policies` ablegen.

Ausgelagert aus `airbnb_objekt_abruf.py` (1500-Zeilen-Grenze); Aufrufer ist
dort `airbnb_objekt_abrufen`, Datenquelle `airbnb_booking_settings_direkt`
(`airbnb_direkt.py`). Fachlich unverändert — Begründung im Docstring der
Methode.
"""
from __future__ import annotations

from supabase import Client

from . import airbnb_listing_import as ali
from .common import log


class AirbnbHausregelnMixin:
    """Hausregeln Airbnb → `type_attributes.policies` (nur leere Felder)."""

    def _hausregeln_direkt_uebernehmen(
        self, db: Client, tenant_id: str, property_id: str,
        listing_id: str, token: str,
    ) -> list[str]:
        """Airbnbs Hausregeln über die EIGENE API holen und speichern.

        Warum nicht über Channex: die Mapping-Antwort liefert `booking_setting`
        nur als Beifang, und die Felder aus Airbnbs „House rules"-Maske fehlen
        darin. `v2/booking_settings/{id}` gibt sie vollständig — live verifiziert,
        siehe `airbnb_booking_settings_direkt`.

        Ziel ist `type_attributes.policies`, denn dort liest sie sowohl das
        Frontend (`web/lib/policy-meta.ts`) als auch der Channex-Push
        (`content_sync`). Der Airbnb-Rohblock wird daneben abgelegt: er ist der
        Beleg, woher die Werte kommen.

        Nur LEERE Felder werden gefüllt (Wurzel 1) — was der Betrieb selbst
        eingestellt hat, gilt. Rückgabe: die Namen der wirklich gesetzten Felder,
        damit die UI nicht „übernommen" meldet, wo nichts übernommen wurde.
        """
        roh = self.airbnb_booking_settings_direkt(  # type: ignore[attr-defined]
            token, listing_id
        )
        if not roh:
            return []

        rows = (
            db.table("properties").select("type_attributes")
            .eq("tenant_id", tenant_id).eq("id", property_id)
            .limit(1).execute()
        ).data or []
        if not rows:
            return []
        attrs = rows[0].get("type_attributes") or {}
        if not isinstance(attrs, dict):
            attrs = {}
        policies = attrs.get("policies")
        policies = dict(policies) if isinstance(policies, dict) else {}

        gesetzt: list[str] = []
        # Check-in/-out: Airbnbs Zeitwerte inklusive „FLEXIBLE"/„NOT_SELECTED"
        # und der Stunden über 23 (Doku: start bis 26, Ende bis 27).
        for feld, wert in (
            ("checkInTime", ali.check_in_start(roh)),
            ("checkInTimeEnd", ali.check_in_ende(roh)),
            ("checkOutTime", ali.check_out(roh)),
        ):
            if wert and not policies.get(feld):
                policies[feld] = wert
                gesetzt.append(feld)

        regeln = ali.gastregeln_uebernehmen(roh)
        for feld, wert in regeln.items():
            if feld not in policies:
                policies[feld] = wert
                gesetzt.append(feld)

        storno = ali.storno_uebernehmen(roh)
        if storno and not policies.get("airbnbStorno"):
            policies["airbnbStorno"] = storno
            gesetzt.append("airbnbStorno")

        sofort = ali.sofortbuchung_uebernehmen(roh)
        spalten: dict[str, str] = {}
        if sofort and not policies.get("airbnbSofortbuchung"):
            policies["airbnbSofortbuchung"] = sofort
            gesetzt.append("airbnbSofortbuchung")
            # In die ECHTEN Spalten, nicht nur in den Beleg (0718). Vorher
            # landete Airbnbs Kategorie ausschliesslich hier im JSON, und das
            # Objekt selbst stand danach auf „alle duerfen sofort buchen" —
            # ein Inserat mit `well_reviewed_guests` verlor seine
            # Einschraenkung beim Import still. Genau das stand als Befund im
            # Import-Modul: „fuer WEN, kann unser Modell nicht ausdruecken".
            spalten["booking_mode"] = str(sofort["modus"])
            zielgruppe = str(sofort["airbnbKategorie"])
            if zielgruppe in ali.SOFORTBUCHUNG_ZIELGRUPPEN:
                spalten["instant_booking_audience"] = zielgruppe

        if not gesetzt:
            return []

        neue_attrs = {
            **attrs,
            "policies": policies,
            # Rohform daneben (wie bei `airbnb.booking_setting`): Beleg der
            # Herkunft und Vergleichsgrundlage für einen späteren Abruf.
            "airbnbHausregeln": roh,
        }
        db.table("properties").update(
            {"type_attributes": neue_attrs, **spalten}
        ).eq("tenant_id", tenant_id).eq("id", property_id).execute()
        log.info(
            "airbnb_hausregeln_uebernommen",
            property_id=property_id, felder=gesetzt,
        )
        return gesetzt
