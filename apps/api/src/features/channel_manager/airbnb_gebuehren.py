"""Gebühren-Abgleich mit Airbnb: lesen, EINMALIG übernehmen, danach Ruhe.

DIE RICHTUNGEN SIND NICHT SYMMETRISCH, und das hat einen Grund:

  * RAUS (wir → Airbnb) läuft über `tax_sync`/`ota_abgaben` als Channex-`taxes`
    mit `type: "fee"`. Das ist gebaut, geprüft und für ALLE Portale zuständig —
    hier wird nichts dupliziert. **Unsere Plattform ist die Quelle:** was am
    Objekt steht, geht an die Portale.
  * REIN (Airbnb → wir) ist eine EINMALIGE Starthilfe. Beim Onboarding kommen
    über den Aggregator nur acht Felder; die Reinigungs-, Resort- und
    Haustiergebühr hat der Betrieb bei Airbnb längst gepflegt und müsste sie
    hier abtippen. Genau dafür — und nur dafür — ist dieser Weg da.

DESHALB IST DER IMPORT ABGESCHLOSSEN, SOBALD ER EINMAL LIEF. Vorher stand der
Kasten „Bei Airbnb sind N weitere Gebühren hinterlegt" dauerhaft über der
Preisseite und verglich BETRÄGE: unser Objekt hatte eine Reinigungsgebühr von
795 DKK, Airbnb eine von 1.590 DKK — also galt Airbnbs als „fehlt uns", und ein
Klick legte eine ZWEITE Reinigungsgebühr an. Live am 11.08.2026 zahlte der Gast
im Checkout beide (795 + 1.590). Ein Dauer-Angebot, das aus einer geänderten
Zahl eine neue Gebühr macht, ist kein Abgleich, sondern eine Duplikat-Fabrik.

Zwei Konsequenzen:
  1. Übernommen wird nur eine Gebühren-ART, die bei uns GAR NICHT existiert
     (`feeType`), nie eine mit abweichendem Betrag.
  2. Nach dem Import (oder nach „nicht übernehmen") verschwindet das Angebot
     endgültig — Merker `type_attributes.airbnbGebuehrenImport`.
"""
from __future__ import annotations

from datetime import UTC, datetime
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

# Merker im Objekt: der Start-Import ist gelaufen. Steht auf oberster Ebene der
# `type_attributes` (nicht im Preis-Blob) — er beschreibt einen Vorgang, keine
# Preisangabe, und darf beim Bearbeiten der Gebühren nicht verloren gehen.
IMPORT_MERKER = "airbnbGebuehrenImport"


class AirbnbGebuehrenMixin:
    """Airbnbs Gebühren lesen und einmalig übernehmen."""

    def airbnb_gebuehren_vergleich(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Was bei Airbnb steht, was bei uns steht, und was sich unterscheidet.

        Der Vergleich läuft über die Signatur (Art, Rechenart, Basis, Betrag) —
        gut für die Diagnose („weicht ab"). Was ÜBERNOMMEN werden kann, ist eine
        andere Frage und steht in `uebernehmbar`: nur Arten, die bei uns gar
        nicht existieren. `import_erledigt` sagt, ob das Angebot noch gilt.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, type_attributes, currency",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        erledigt = _import_erledigt(objekt)
        airbnb = self._airbnb_gebuehren_lesen(db, tenant_id, property_id)
        if airbnb is None:
            # Nicht lesbar heißt NICHT „keine Gebühren" — sonst sähe die
            # Oberfläche jede vorhandene Gebühr als „nur bei uns" (Wurzel 4).
            return {
                "verbunden": False, "stand_bekannt": False,
                "airbnb": [], "nur_airbnb": [], "nur_wir": [], "gleich": [],
                "uebernehmbar": [], "import_erledigt": erledigt,
            }

        unsere = _unsere_fees(objekt)
        sig_airbnb = {airbnb_fee_signatur(f): f for f in airbnb}
        sig_unsere = {airbnb_fee_signatur(f): f for f in unsere}
        gemeinsam = set(sig_airbnb) & set(sig_unsere)
        uebernehmbar = _fehlende_arten(airbnb, unsere)
        log.info(
            "airbnb_gebuehren_vergleich",
            property_id=property_id, airbnb=len(airbnb), unsere=len(unsere),
            gleich=len(gemeinsam), uebernehmbar=len(uebernehmbar),
            import_erledigt=erledigt,
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
            # Das Angebot: Arten, die bei uns FEHLEN (nicht: abweichen).
            "uebernehmbar": uebernehmbar,
            "import_erledigt": erledigt,
        }

    def airbnb_gebuehren_uebernehmen(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Airbnbs Gebühren als unsere anlegen — nur fehlende ARTEN, einmalig.

        Wurzel 1: die Aktion hat einen Gegenzustand. Bestehende Gebühren werden
        NICHT angefasst und nicht gelöscht.

        Wurzel 2: zweimal geklickt legt nichts doppelt an — nach dem ersten Lauf
        steht der Merker, und der Abgleich über die Gebühren-ART lässt eine
        zweite Reinigungsgebühr ohnehin nicht zu.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, type_attributes",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        unsere = _unsere_fees(objekt)
        if _import_erledigt(objekt):
            # Kein Fehler: der Vorgang ist einfach vorbei. Die Oberfläche zeigt
            # das Angebot dann nicht mehr, ein zweiter Aufruf ist ein No-op.
            return {"uebernommen": 0, "fees": unsere, "import_erledigt": True}
        airbnb = self._airbnb_gebuehren_lesen(db, tenant_id, property_id)
        if airbnb is None:
            raise ChannelManagerError(
                "Die Gebühren bei Airbnb sind gerade nicht lesbar. Bitte später "
                "erneut versuchen.",
                status_code=502,
            )
        neu = _fehlende_arten(airbnb, unsere)
        if len(unsere) + len(neu) > _MAX_GEBUEHREN:
            raise ChannelManagerError(
                f"Das wären mehr als {_MAX_GEBUEHREN} Gebühren an einem Objekt. "
                "Bitte zuerst aufräumen.",
                status_code=422,
            )

        fees = [*unsere, *neu]
        self._gebuehren_schreiben(ctx, objekt, property_id, fees, len(neu))
        log.info(
            "airbnb_gebuehren_uebernommen",
            property_id=property_id, uebernommen=len(neu),
            arten=[f.get("feeType") for f in neu],
        )
        return {"uebernommen": len(neu), "fees": fees, "import_erledigt": True}

    def airbnb_gebuehren_import_verwerfen(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Das Übernahme-Angebot ohne Import beenden.

        Der Betrieb pflegt seine Gebühren bei uns und will Airbnbs Stand nicht
        haben. Ohne diesen Weg bliebe der Kasten für immer stehen und würde bei
        jeder Preisänderung erneut zum Duplikat verleiten.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, type_attributes",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        fees = _unsere_fees(objekt)
        if not _import_erledigt(objekt):
            self._gebuehren_schreiben(ctx, objekt, property_id, fees, 0)
            log.info("airbnb_gebuehren_import_verworfen", property_id=property_id)
        return {"uebernommen": 0, "fees": fees, "import_erledigt": True}

    def _gebuehren_schreiben(
        self,
        ctx: AuthContext,
        objekt: dict[str, Any],
        property_id: str,
        fees: list[dict[str, Any]],
        uebernommen: int,
    ) -> None:
        """Gebührenliste + Import-Merker in einem Update speichern."""
        attrs = dict(objekt.get("type_attributes") or {})
        pricing = dict(attrs.get("pricing") or {})
        pricing["fees"] = fees
        attrs["pricing"] = pricing
        attrs[IMPORT_MERKER] = {
            # Unsere Uhr beschreibt hier UNSEREN Vorgang (den Import), nicht ein
            # fremdes Ereignis — an dieser Stelle ist sie die richtige Quelle.
            "erledigt_am": datetime.now(UTC).isoformat(),
            "uebernommen": uebernommen,
        }
        # Über den regulären Update-Weg, NICHT per direktem DB-Schreiben: dort
        # hängen Validierung (`normalize_fees`), die Spiegelung nach
        # `property_pricing_config` und der Abgaben-Sync-Anstoß. Ein Direkt-
        # schreiben umginge alle drei.
        self._properties_update(ctx, property_id, attrs)

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
        kanal_suchen = self._airbnb_kanal_des_betriebs  # type: ignore[attr-defined]
        channel_id = kanal_suchen(db, tenant_id, property_id)
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


def _import_erledigt(objekt: dict[str, Any]) -> bool:
    """Lief der einmalige Gebühren-Import an diesem Objekt schon?"""
    attrs = objekt.get("type_attributes") or {}
    merker = attrs.get(IMPORT_MERKER)
    return isinstance(merker, dict) and bool(merker.get("erledigt_am"))


def _fehlende_arten(
    airbnb: list[dict[str, Any]], unsere: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Airbnb-Gebühren, deren ART bei uns gar nicht vorkommt.

    Der BETRAG spielt hier bewusst keine Rolle: eine Reinigungsgebühr mit
    anderem Betrag ist dieselbe Gebühr mit anderem Preis, keine zweite. Unsere
    Zahl gewinnt — wir schicken sie an die Portale, nicht umgekehrt.

    Mehrere Airbnb-Einträge derselben Art ergeben genau einen Vorschlag: eine
    Art kommt an einem Objekt einmal vor.
    """
    vorhanden = {str(f.get("feeType") or "") for f in unsere}
    raus: list[dict[str, Any]] = []
    for fee in airbnb:
        art = str(fee.get("feeType") or "")
        if not art or art in vorhanden:
            continue
        vorhanden.add(art)
        raus.append(fee)
    return raus
