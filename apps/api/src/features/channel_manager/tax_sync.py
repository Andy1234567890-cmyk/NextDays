"""Channex-Steuern: lokale Steuern eines Objekts → Channex taxes + tax_set.

Eigenes Modul, weil Steuern ein abgeschlossenes Thema mit eigener Fachlogik
sind: die Abbildung unserer Steuerarten auf die Channex-Enums, der schlanke
Sync-Pfad für reine Steuer-Änderungen und der Gegenzustand beim Löschen.
Mixin des ChannelManagerService; State (_db/_channex) kommt von der Fassade.

Channex-Vokabular (docs: taxes-and-tax-sets, live geprüft 03.08.2026):
`logic` ∈ percent | per_room | per_room_per_night | per_person |
per_person_per_night | per_night | per_booking, `type` ∈ tax | fee | city tax.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from .channex_client import ChannexError
from .common import ChannelManagerError, ist_demo_mapping, log


class TaxSyncMixin:
    """Steuer-Sync eines Objekts nach Channex."""

    # Betrags-Steuern: (chargeBasis, period) → Channex tax.logic. Die vier
    # Kombinationen sind exakt die Channex-Enums (docs: taxes-and-tax-sets,
    # logic ∈ percent|per_room|per_room_per_night|per_person|
    # per_person_per_night|per_night|per_booking) — damit geht „2,50 € pro Gast
    # pro Nacht" unverfälscht an die Portale statt wie früher pauschal als
    # per_night.
    _TAX_AMOUNT_LOGIC = {
        ("SingleCharge", "PerStay"): "per_booking",
        ("SingleCharge", "PerNight"): "per_night",
        ("PerPerson", "PerStay"): "per_person",
        ("PerPerson", "PerNight"): "per_person_per_night",
    }
    # Lokale Steuerart (Airbnb-Taxonomie) → Channex type ∈ tax|fee|city tax.
    # Ortsbezogene Abgaben sind „city tax", Beherbergungs-/Zimmersteuern „tax".
    _TAX_TYPE_BY_LOCAL_KIND = {
        "HotelTax": "tax",
        "LodgingTax": "tax",
        "RoomTax": "tax",
        "TourismAssessment": "city tax",
        "TouristTax": "city tax",
        "TransientOccupancyTax": "city tax",
        "Unknown": "tax",
    }
    # Fallback auf der gröberen Achse (kind), wenn keine Steuerart gesetzt ist
    # (Altdatensatz) — unverändertes Verhalten für den Bestand.
    _TAX_TYPE = {"vat": "tax", "local": "city tax"}

    @classmethod
    def _tax_logic(cls, tax: dict[str, Any]) -> str:
        """Channex-`logic` einer Steuer. Ohne gespeicherte Basis gilt bei
        Betrags-Steuern „einmalig pro Nacht" — genau das, was bisher gesendet
        wurde; nichts wird geraten."""
        if str(tax.get("mode") or "percent") == "percent":
            return "percent"
        schluessel = (
            str(tax.get("chargeBasis") or "SingleCharge"),
            str(tax.get("period") or "PerNight"),
        )
        return cls._TAX_AMOUNT_LOGIC.get(schluessel, "per_night")

    @classmethod
    def _tax_type(cls, tax: dict[str, Any]) -> str:
        """Channex-`type` einer Steuer: aus der Steuerart, sonst aus `kind`."""
        art = tax.get("taxType")
        if art:
            return cls._TAX_TYPE_BY_LOCAL_KIND.get(str(art), "tax")
        return cls._TAX_TYPE.get(str(tax.get("kind") or ""), "tax")

    def _sync_taxes(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        channex_rate_plan_ids: list[str],
        currency: str,
        prop_row: dict[str, Any],
    ) -> None:
        """Lokale Steuern (type_attributes.pricing.taxes) → Channex taxes + ein
        tax_set, das an die Rate-Plans gehängt wird. Idempotent über
        channex_tax_map. Ohne Steuern: nur noch der Abgleich gelöschter."""
        attrs = prop_row.get("type_attributes") or {}
        pricing = attrs.get("pricing") or {}
        taxes = pricing.get("taxes") or []

        channex_tax_ids: list[str] = []
        for t in taxes:
            local_id = t.get("id")
            if not local_id:
                continue
            logic = self._tax_logic(t)
            # Gastseitiger Name, wenn gepflegt (names[locale]) — das ist der
            # Text, den der Gast beim Portal sieht.
            names = t.get("names") if isinstance(t.get("names"), dict) else {}
            titel = (
                names.get("de")
                or next((v for v in names.values() if v), None)
                or t.get("name")
                or "Steuer"
            )
            tax_attrs: dict[str, Any] = {
                "title": str(titel)[:255],
                "logic": logic,
                "type": self._tax_type(t),
                "rate": str(t.get("value") or 0),
                "is_inclusive": bool(t.get("includedInPrice")),
                "property_id": channex_property_id,
            }
            if logic != "percent":
                tax_attrs["currency"] = currency

            existing = (
                db.table("channex_tax_map")
                .select("id, channex_tax_id")
                .eq("property_id", property_id)
                .eq("local_tax_id", local_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if existing:
                channex_tax_id = existing[0]["channex_tax_id"]
                self._channex.update_tax(channex_tax_id, tax_attrs)
            else:
                created = self._channex.create_tax(tax_attrs)
                channex_tax_id = (created.get("data") or {}).get("id")
                if not channex_tax_id:
                    continue
                db.table("channex_tax_map").upsert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "local_tax_id": local_id,
                        "channex_tax_id": channex_tax_id,
                    },
                    on_conflict="property_id,local_tax_id",
                ).execute()
            channex_tax_ids.append(channex_tax_id)

        # Wurzel 1 (Gegenzustand): eine im Objekt GELÖSCHTE Steuer muss auch bei
        # den Portalen verschwinden — sonst kassiert Booking eine Kurtaxe weiter,
        # die es hier längst nicht mehr gibt.
        self._prune_removed_taxes(db, tenant_id, property_id, taxes)

        if not channex_tax_ids:
            # Letzte Steuer entfernt: das Tax-Set löschen, damit an den
            # Rate-Plans keine Steuer mehr hängt. Ein leeres `taxes: []` ist
            # dafür NICHT der Weg — Channex deklariert `taxes` am Tax-Set als
            # Pflichtfeld; der dokumentierte Weg ist das Entfernen selbst.
            self._drop_tax_set(db, tenant_id, property_id)
            return

        # Ein tax_set je Property (enthält alle Steuern), an die Rate-Plans gehängt.
        set_attrs = {
            "title": "Standard",
            "property_id": channex_property_id,
            "currency": currency,
            "taxes": [{"id": tid, "level": 0} for tid in channex_tax_ids],
            "associated_rate_plan_ids": channex_rate_plan_ids,
        }
        # Bestehendes Set wiederverwenden (an irgendeiner Map dieser Property).
        # tenant_id-Filter zusätzlich zur property_id: channex_tax_map HAT eine
        # tenant_id-Spalte, und der Service-Role-Key umgeht RLS — jede Query MUSS
        # tenant-scopen (Belt-and-suspenders, auch wenn property_id upstream schon
        # tenant-verifiziert ist).
        existing_set = (
            db.table("channex_tax_map")
            .select("channex_tax_set_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .not_.is_("channex_tax_set_id", "null")
            .limit(1)
            .execute()
        ).data
        if existing_set and existing_set[0].get("channex_tax_set_id"):
            tax_set_id = existing_set[0]["channex_tax_set_id"]
            self._channex.update_tax_set(tax_set_id, set_attrs)
        else:
            created = self._channex.create_tax_set(set_attrs)
            tax_set_id = (created.get("data") or {}).get("id")
            if tax_set_id:
                db.table("channex_tax_map").update(
                    {"channex_tax_set_id": tax_set_id}
                ).eq("tenant_id", tenant_id).eq(
                    "property_id", property_id
                ).is_("deleted_at", "null").execute()
        log.info(
            "channex_taxes_synced",
            tenant_id=tenant_id,
            property_id=property_id,
            taxes=len(channex_tax_ids),
        )

    def sync_taxes_only(self, tenant_id: str, property_id: str) -> dict[str, Any]:
        """Nur die Steuern eines Objekts nach Channex spiegeln.

        Schlanker Pfad für reine Steuer-Änderungen: zwei Channex-Calls statt
        des vollen Content-Syncs. Setzt ein bestehendes Mapping voraus — ohne
        registriertes Objekt gibt es keine Channex-Property, an der eine Steuer
        hängen könnte; dann wird der volle Sync gebraucht (der legt sie an), und
        dieser Job meldet das statt still nichts zu tun.
        """
        db = self._db
        if db is None or not self._channex.is_configured:
            return {"synced": False, "reason": "not_configured"}
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        channex_property_id = pm[0]["channex_property_id"] if pm else None
        if not channex_property_id or ist_demo_mapping(channex_property_id):
            log.info(
                "tax_sync_uebersprungen_ohne_mapping",
                tenant_id=tenant_id, property_id=property_id,
            )
            return {"synced": False, "reason": "no_mapping"}

        prop = (
            db.table("properties")
            .select("id, type_attributes, currency")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        prop_row = prop[0]

        # Währung wie im vollen Sync: Objektwährung, sonst der älteste Plan.
        # Kein erfundener Ersatz (Wurzel 4) — ohne Währung kein Betrags-Push.
        rate_plans = (
            db.table("rate_plans")
            .select("currency")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        currency = str(
            prop_row.get("currency")
            or (rate_plans[0].get("currency") if rate_plans else "")
            or ""
        ).upper()
        if not currency:
            raise ChannelManagerError(
                "Objektwährung fehlt — Steuern können nicht übertragen werden.",
                status_code=422,
            )

        # Channex-Rate-Plan-IDs für die Tax-Set-Verknüpfung (Kette
        # property_map → room_type_maps → rate_plan_maps, wie im vollen Sync).
        rt_ids = [
            r["id"]
            for r in (
                db.table("channex_room_type_map")
                .select("id")
                .eq("property_map_id", pm[0]["id"])
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
        ]
        channex_rate_plan_ids = [
            r["channex_rate_plan_id"]
            for r in (
                db.table("channex_rate_plan_map")
                .select("channex_rate_plan_id")
                .in_("room_type_map_id", rt_ids)
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if r.get("channex_rate_plan_id")
        ] if rt_ids else []

        try:
            self._sync_taxes(
                db, tenant_id, property_id, channex_property_id,
                channex_rate_plan_ids, currency, prop_row,
            )
        except ChannexError as exc:
            # Denselben Sichtbarkeits-Stempel setzen wie der volle Sync, damit
            # der Heilungs-Tick (worker._enqueue_failed_content_syncs) das
            # Objekt findet, falls dieser Job endgültig stirbt.
            self._mark_property_sync(db, tenant_id, property_id, "error", exc.message)
            raise self._wrap_channex(exc) from exc
        log.info("channex_taxes_only_synced", tenant_id=tenant_id,
                 property_id=property_id)
        return {"synced": True, "channex_property_id": channex_property_id}

    def _prune_removed_taxes(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        taxes: list[dict[str, Any]],
    ) -> None:
        """Lokal gelöschte Steuern bei Channex entfernen (Wurzel 1).

        Erst bei Channex löschen (`DELETE /taxes/:id` — der dokumentierte Weg),
        dann das Mapping stilllegen: Nur wenn Channex die Steuer wirklich los
        ist, darf die Zuordnung verschwinden. Andernfalls bliebe eine Steuer am
        Portal aktiv, auf die wir keinen Zugriff mehr hätten (verwaiste ID).
        Eine bereits verschwundene Steuer (404) gilt als erledigt.
        """
        aktuelle_ids = {str(t["id"]) for t in taxes if t.get("id")}
        verwaiste = [
            row
            for row in (
                db.table("channex_tax_map")
                .select("id, local_tax_id, channex_tax_id")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if str(row.get("local_tax_id")) not in aktuelle_ids
        ]
        entfernt: list[str] = []
        for row in verwaiste:
            channex_tax_id = row.get("channex_tax_id")
            if channex_tax_id:
                try:
                    self._channex.delete_tax(str(channex_tax_id))
                except ChannexError as exc:
                    if exc.channex_status != 404:
                        # Nicht verschlucken (Wurzel 5): das Mapping bleibt
                        # stehen, der nächste Sync versucht es erneut.
                        raise
            entfernt.append(row["id"])
        if entfernt:
            db.table("channex_tax_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).in_("id", entfernt).execute()
            log.info(
                "channex_taxes_pruned",
                tenant_id=tenant_id,
                property_id=property_id,
                pruned=len(entfernt),
            )

    def _drop_tax_set(self, db: Client, tenant_id: str, property_id: str) -> None:
        """Tax-Set entfernen, wenn das Objekt keine Steuer mehr führt. Ohne
        bestehendes Set: no-op (nie eines nur zum Löschen anlegen)."""
        vorhanden = (
            db.table("channex_tax_map")
            .select("channex_tax_set_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .not_.is_("channex_tax_set_id", "null")
            .limit(1)
            .execute()
        ).data
        tax_set_id = (vorhanden or [{}])[0].get("channex_tax_set_id")
        if not tax_set_id:
            return
        try:
            self._channex.delete_tax_set(str(tax_set_id))
        except ChannexError as exc:
            if exc.channex_status != 404:
                raise
        db.table("channex_tax_map").update({"channex_tax_set_id": None}).eq(
            "tenant_id", tenant_id
        ).eq("property_id", property_id).execute()
        log.info(
            "channex_tax_set_dropped",
            tenant_id=tenant_id,
            property_id=property_id,
        )
