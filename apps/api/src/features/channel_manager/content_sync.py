"""Channex-Content-Sync: Group/Property/Room-Type/Rate-Plan/Steuern.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.countries import normalize_country

from . import content_builder
from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    _availability_settings,
    _channex_facility_ids,
    _channex_property_type,
    _channex_room_facility_ids,
    _channex_type_from_pct,
    _channex_type_from_subtype,
    _timezone_for_country,
    ist_demo_mapping,
    log,
)


class ContentSyncMixin:
    """Channex-Content-Sync: Group/Property/Room-Type/Rate-Plan/Steuern."""


    # -- System-Hooks (Auto-Anlage; mit Service-Client, ohne User-Gate) --------
    # Diese Methoden werden aus register/create_property aufgerufen. Sie sind
    # bewusst NON-BLOCKING: schlägt Channex fehl, darf die Registrierung bzw.
    # Objekt-Anlage NICHT scheitern — wir loggen, merken den Fehler und können
    # später erneut synchronisieren. tenant_id kommt vom vertrauenswürdigen
    # Aufrufer (nicht aus User-Input).
    # Die vielen Rückgaben sind hier Absicht: jeder Fehlerpfad (nicht
    # konfiguriert, kein Tenant-Name, Channex-Fehler, Mapping-Fehler mit
    # Kompensation) endet nicht-blockierend mit None. Zusammenfassen würde die
    # Kompensationslogik verschleiern.
    # pylint: disable-next=too-many-return-statements
    def ensure_group(self, tenant_id: str) -> str | None:
        """Stellt sicher, dass für den Tenant eine Channex-Group existiert.
        Gibt die channex_group_id zurück (oder None, wenn nicht konfiguriert/Fehler).

        Die Group ist der BETRIEB (Tenant/Konto), NICHT ein Objekt/Zimmer. Ihr
        Name ist deshalb IMMER der Tenant-Name (tenants.name) — die DB ist die
        Wahrheit (Wurzel 1/4). Ein durchgereichter Objekt-Titel würde die Group
        nach einem einzelnen Zimmer benennen (bei einem Hotel mit mehreren Zimmern
        nach einem zufälligen), was Betrieb und Gebäude verwechselt."""
        if not self._channex.is_configured or self._db is None:
            return None
        existing = (
            self._db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]["channex_group_id"]
        # Group-Name = Betriebsname des Tenants (nie ein Objekt-Titel). Fehlt er,
        # ist das ein Datenfehler → kein erfundener Ersatz, klar abbrechen.
        title = self._tenant_title(self._db, tenant_id)
        if not title:
            log.error("channex_group_no_tenant_title", tenant_id=tenant_id)
            return None
        try:
            created = self._channex.create_group(title)
            group_id = (created.get("data") or {}).get("id")
            if not group_id:
                log.error("channex_group_no_id", tenant_id=tenant_id)
                return None
        except ChannexError as exc:
            log.error("channex_group_failed", tenant_id=tenant_id, error=exc.message)
            return None
        # Ab hier existiert die Group bei Channex. Schlägt der Mapping-Upsert fehl
        # (postgrest APIError), entstünde eine WAISE (Group ohne Mapping → nächster
        # Aufruf legt eine zweite an, Wurzel 1). Darum den Upsert SEPARAT fangen
        # und die eben erzeugte Group kompensierend wieder löschen. Scheitert auch
        # die Kompensation (Channex down), bleibt die Group — dann aber mit ihrer
        # ID im Log ("Waise mit Adresse"), damit der Sweeper sie findet (Wurzel 5:
        # spezifisch fangen, nicht still schlucken).
        try:
            self._db.table("channex_group_map").upsert(
                {"tenant_id": tenant_id, "channex_group_id": group_id, "title": title},
                on_conflict="tenant_id",
            ).execute()
        except APIError as exc:
            log.error(
                "channex_group_map_upsert_failed",
                tenant_id=tenant_id, channex_group_id=group_id, error=str(exc),
            )
            try:
                self._channex.delete_group(group_id)
                log.info(
                    "channex_group_compensated",
                    tenant_id=tenant_id, channex_group_id=group_id,
                )
            except ChannexError as del_exc:
                log.error(
                    "channex_group_orphaned",
                    tenant_id=tenant_id, channex_group_id=group_id,
                    error=del_exc.message,
                )
            return None
        log.info("channex_group_created", tenant_id=tenant_id)
        return group_id

    @property
    def is_channex_configured(self) -> bool:
        """Ob ein Channex-Sync überhaupt laufen kann (Credentials + DB vorhanden).
        Worker-Handler guarden damit, statt still zu scheitern, ohne den privaten
        Channex-Client anzufassen."""
        return self._channex.is_configured and self._db is not None

    def sync_property_to_channex(
        self,
        tenant_id: str,
        *,
        property_id: str,
        currency: str | None = None,
    ) -> None:
        """Non-blocking Auto-Sync beim Anlegen/Ändern eines Objekts.

        Titel/Währung werden NIE übergeben — sync_content lädt beide aus der DB
        (die einzige Wahrheit, Wurzel 1/4): ein hier durchgereichter Titel könnte
        einen falschen Namen an Channex leaken. Delegiert an den vollständigen,
        idempotenten Content-Sync und schluckt Fehler (loggt sie), damit die
        Objekt-Anlage nie an Channex scheitert."""
        if not self._channex.is_configured or self._db is None:
            return
        try:
            self.sync_content(
                tenant_id, property_id=property_id, currency=currency
            )
        except (ChannexError, ChannelManagerError) as exc:
            msg = getattr(exc, "message", str(exc))
            log.error(
                "channex_property_sync_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=msg,
            )

    # -- Content-Sync (Skill-Komponente 2): Property → Room-Type → Rate-Plans ---
    # NextDays modelliert KEINE Zimmerkategorien — eine `property` IST die
    # buchbare Einheit (Ferienwohnungs-Modell, max_guests). Channex verkauft
    # aber room_types mit count_of_rooms. Mapping daher:
    #   property                       → Channex-Property        (1:1)
    #   property (synthetischer Typ)   → 1 Channex-Room-Type     (count_of_rooms=1)
    #   jeder rate_plans-Eintrag       → 1 Channex-Rate-Plan     (am Room-Type)
    # Idempotent: POST wenn kein Mapping existiert, sonst PUT; UUID wird gemappt.
    # Geld: rate_plans.base_price (Euro, numeric) → Cent-Integer NUR an der Grenze.
    def resync_all_content(self, tenant_id: str) -> None:
        """Alle Objekte des Tenants inhaltlich neu an Channex spiegeln. Für tenant-
        weite Content-Änderungen, die JEDES Objekt betreffen — z. B. das Firmen-/
        Unterkunftslogo (company_logo_url → property.logo_url). Best-effort je
        Objekt; ein Fehler an einem Objekt stoppt die übrigen nicht. properties hat
        keine currency-Spalte (die liegt im rate_plan) → sync_content lädt sie selbst."""
        db = self._require_db()
        props = (
            db.table("properties").select("id").eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        for p in props:
            try:
                # Titel/Währung lädt sync_content selbst aus der DB (Wurzel 1/4) —
                # kein durchgereichter Titel, kein "EUR"-Default.
                self.sync_content(tenant_id, property_id=p["id"], currency=None)
            except Exception as exc:  # noqa: BLE001 — pro Objekt best-effort
                log.warning(
                    "resync_all_content_property_failed",
                    tenant_id=tenant_id, property_id=p.get("id"), error=str(exc),
                )

    def sync_content(
        self,
        tenant_id: str,
        *,
        property_id: str,
        currency: str | None = None,
    ) -> dict[str, str]:
        """Legt/aktualisiert Property, synthetischen Room-Type und Rate-Plans in
        Channex (Dependency-Reihenfolge) und pflegt die Mapping-Tabellen.
        Sicher wiederholbar (idempotent). Gibt die Channex-IDs zurück."""
        db = self._require_db()

        # Demo-Betriebe (Marketing-Screenshots) tragen einen Platzhalter statt
        # einer echten Channex-ID in der Property-Map. Solche Objekte gehören
        # NICHT an Channex: der Push kassiert „Bad Request", der Job läuft
        # zehnmal in den Retry und verbrennt dabei das kontoweite Anfrage-Budget,
        # das sich alle echten Betriebe teilen. Echter No-op statt Dauerfehler.
        bestehend = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        vorhandene_id = bestehend[0]["channex_property_id"] if bestehend else None
        if ist_demo_mapping(vorhandene_id):
            log.info(
                "content_sync_uebersprungen_demo_mapping",
                tenant_id=tenant_id, property_id=property_id,
            )
            return {"channex_property_id": vorhandene_id}

        # Lokale Property MIT allen Channex-relevanten Feldern laden (Tenant-Scope).
        prop = (
            db.table("properties")
            .select(
                "id, title, description, property_type, booking_property_type, "
                "subtype_slug, "
                # Immobilientyp-Mapping (0198): der an Channex gesendete
                # property_type kommt bevorzugt aus dem Subtyp (property_subtypes).
                "property_subtypes(channex_property_type), "
                "street, house_number, "
                # `timezone` (0258) ist die GEPFLEGTE Wahrheit: die Spalte wird
                # per DB-Trigger gegen pg_timezone_names validiert. Sie fehlte
                # hier, weshalb `_property_attrs` immer nur aus dem Land RATEN
                # konnte — bei Mehrzonen-Ländern (Kanaren, Azoren) still falsch.
                "timezone, "
                "postal_code, city, country, lat, lng, max_guests, amenities, "
                "room_amenities, type_attributes, currency"
            )
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        prop_row = prop.data[0]
        # Der Objektname ist ein Zustand, den WIR führen (Wurzel 1) — die DB ist die
        # EINZIGE Wahrheit. Kein übergebener Fallback, kein erfundenes „Unbenannt"
        # (Wurzel 4): fehlt der Titel wirklich, ist das ein Datenfehler → klar
        # fehlschlagen, statt einen Ersatz an Channex zu leaken.
        prop_title = prop_row.get("title")
        if not prop_title or not str(prop_title).strip():
            raise ChannelManagerError(
                "Objekt hat keinen Titel — Content-Sync abgebrochen.",
                status_code=422,
            )
        prop_title = str(prop_title).strip()

        # Fotos für den Content-Push laden. property_photos ist via Property-FK
        # tenant-scoped; die Property wurde direkt darüber als tenant-eigen
        # verifiziert, daher ist der property_id-Filter hier ausreichend.
        photos = (
            db.table("property_photos")
            .select("url, sort_order, is_cover, caption, author")
            .eq("property_id", property_id)
            .order("sort_order")
            .execute()
        ).data or []

        # Rate-Plans des Objekts laden (currency vom ersten Plan). 1 Objekt =
        # 1 Einheit: alle Pläne hängen am Objekt, EIN synthetischer Room-Type.
        rate_plans = (
            db.table("rate_plans")
            .select("id, name, base_price, currency, min_stay")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        # KEIN Fallback: ohne Rate-Plan (mit echtem Preis) wird nichts an Channex
        # gepusht — sonst entstünde eine unvollständige Property (0-€-Verkauf).
        if not rate_plans:
            raise ChannelManagerError(
                "Kein Preisplan vorhanden — die Unterkunft kann ohne Preis nicht "
                "an die Buchungsportale übermittelt werden.",
                status_code=422,
            )
        # Währung (Priorität, alles ECHTE Werte — kein EUR-Fallback, Wurzel 4):
        # 1) übergebene, 2) zentrale Objektwährung (properties.currency, 0161 —
        # die Wahrheit), 3) älteste Rate-Plan-Währung (Bestand ohne gesetzte
        # Objektwährung, rate_plans.currency ist NOT NULL seit 0003).
        obj_currency = prop_row.get("currency")
        rate_currency = rate_plans[0].get("currency")
        prop_currency = (currency or obj_currency or rate_currency or "").upper()
        if not prop_currency:
            raise ChannelManagerError(
                "Objektwährung fehlt im Preisplan — kann nicht an die "
                "Buchungsportale übermittelt werden.",
                status_code=422,
            )

        try:
            # Flow-Debugging: jeden Kettenschritt vor dem Channex-Call markieren,
            # damit die Trace-Zeile (channex_debug_log) den Schritt kennt.
            self._trace_step(tenant_id=tenant_id, property_id=property_id, step="property")
            channex_property_id = self._upsert_channex_property(
                db, tenant_id, property_id, prop_title, prop_currency, prop_row, photos
            )
            self._trace_step(tenant_id=tenant_id, property_id=property_id, step="room_type")
            channex_room_type_id, channex_rate_plan_ids = (
                self._sync_room_types_and_rate_plans(
                    db, tenant_id, channex_property_id, property_id, prop_title,
                    prop_row, photos, rate_plans, prop_currency,
                )
            )
            # Steuern (USt./City-Tax) → Channex tax_sets + tax_set_id am Rate-Plan.
            self._trace_step(tenant_id=tenant_id, property_id=property_id, step="taxes")
            self._sync_taxes(
                db, tenant_id, property_id, channex_property_id,
                channex_rate_plan_ids, prop_currency, prop_row,
            )
            # Hotel Policy (Check-in/-out, Haustiere, Parken, Internet, Rauchen)
            # → Pflicht für Google-Kanal/Instant-Booking-Readiness. Synct nur,
            # wenn ALLE Channex-Pflichtfelder lokal gepflegt sind (fail-closed,
            # keine erfundenen Defaults — Wurzel 4).
            self._trace_step(
                tenant_id=tenant_id, property_id=property_id, step="hotel_policy"
            )
            self._sync_hotel_policy(
                db, tenant_id, property_id, channex_property_id,
                prop_title, prop_currency, prop_row,
            )
        except ChannexError as exc:
            self._mark_property_sync(db, tenant_id, property_id, "error", exc.message)
            raise self._wrap_channex(exc) from exc

        self._mark_property_sync(db, tenant_id, property_id, "ok", None)
        log.info("channex_content_synced", tenant_id=tenant_id, property_id=property_id)
        return {
            "channex_property_id": channex_property_id,
            "channex_room_type_id": channex_room_type_id,
        }

    # -- Hotel Policy -----------------------------------------------------------
    # Quelle: properties.type_attributes.policies (checkInTime/checkOutTime) +
    # policies.hotelPolicy (strukturierte Channex-Felder: internetAccessType,
    # internetAccessCoverage, internetAccessCost, parkingType, parkingReservation,
    # parkingIsPrivate, petsPolicy, petsNonRefundableFee, petsRefundableDeposit,
    # smokingPolicy, adultsOnly). max_count_of_guests = properties.max_guests.
    @staticmethod
    def _build_hotel_policy_attrs(
        prop_row: dict[str, Any], title: str, currency: str
    ) -> dict[str, Any] | None:
        """Channex-hotel_policy-Attribute aus den lokalen Objektdaten. None, wenn
        Pflichtfelder fehlen — dann wird NICHT gesynct (kein Fantasie-Default)."""
        policies = (prop_row.get("type_attributes") or {}).get("policies") or {}
        hp = policies.get("hotelPolicy") or {}
        checkin = policies.get("checkInTime")
        checkout = policies.get("checkOutTime")
        max_guests = prop_row.get("max_guests")
        pets_policy = hp.get("petsPolicy")
        # Haustiere verboten → Gebühr/Kaution folgen logisch als 0 (keine
        # Erfindung); sonst müssen sie explizit gepflegt sein (auch "0.00").
        pets_fee = hp.get("petsNonRefundableFee")
        pets_deposit = hp.get("petsRefundableDeposit")
        if pets_policy == "not_allowed":
            pets_fee = pets_fee if pets_fee is not None else "0.00"
            pets_deposit = pets_deposit if pets_deposit is not None else "0.00"
        required = {
            "checkin_time": checkin,
            "checkout_time": checkout,
            "max_count_of_guests": max_guests,
            "internet_access_type": hp.get("internetAccessType"),
            "internet_access_coverage": hp.get("internetAccessCoverage"),
            "parking_type": hp.get("parkingType"),
            "parking_reservation": hp.get("parkingReservation"),
            "parking_is_private": hp.get("parkingIsPrivate"),
            "pets_policy": pets_policy,
            "pets_non_refundable_fee": pets_fee,
            "pets_refundable_deposit": pets_deposit,
            "smoking_policy": hp.get("smokingPolicy"),
        }
        if any(v is None or v == "" for v in required.values()):
            return None
        attrs: dict[str, Any] = {
            "title": title,
            "currency": currency,
            **required,
        }
        # Optionale Felder nur, wenn gepflegt.
        if hp.get("internetAccessCost") not in (None, ""):
            attrs["internet_access_cost"] = hp["internetAccessCost"]
        if hp.get("adultsOnly") is not None:
            attrs["is_adults_only"] = bool(hp["adultsOnly"])
        return attrs

    def _sync_hotel_policy(
        self, db: Client, tenant_id: str, property_id: str,
        channex_property_id: str, title: str, currency: str,
        prop_row: dict[str, Any],
    ) -> None:
        """Hotel Policy anlegen/aktualisieren und an die Channex-Property binden.
        Best effort auf Objekt-Ebene: unvollständige Daten → Skip mit Log (die
        Objekt-Kette Property/Rooms/Rates/Taxes bleibt davon unberührt)."""
        attrs = self._build_hotel_policy_attrs(prop_row, title, currency)
        if attrs is None:
            log.info(
                "hotel_policy_skipped_incomplete",
                tenant_id=tenant_id, property_id=property_id,
            )
            return
        # Geteilte Channex-Property (0158): die Policy gehört zum BETRIEB, nicht
        # zum einzelnen Zimmer — zwei Zimmer-Syncs würden sonst abwechselnd je
        # eine eigene Policy anlegen/überschreiben. Bis eine tenant-weite Policy-
        # Quelle existiert: überspringen (fail-closed, kein Flackern).
        if self._is_shared_channex_property(db, tenant_id, channex_property_id):
            log.info(
                "hotel_policy_skipped_shared_property",
                tenant_id=tenant_id, property_id=property_id,
            )
            return
        pm = (
            db.table("channex_property_map")
            .select("id, channex_hotel_policy_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return
        existing_id = pm[0].get("channex_hotel_policy_id")
        if existing_id:
            try:
                self._channex.update_hotel_policy(existing_id, attrs)
                return
            except ChannexError as exc:
                if exc.channex_status != 404:
                    raise
                # Policy bei Channex weg (Retention/manuell gelöscht) → Pointer
                # verwerfen und unten neu anlegen (Selbstheilung statt Dauerfehler).
                log.info(
                    "hotel_policy_stale_recreate",
                    tenant_id=tenant_id, property_id=property_id,
                )
        attrs["property_id"] = channex_property_id
        created = self._channex.create_hotel_policy(attrs)
        policy_id = (created.get("data") or {}).get("id")
        if not policy_id:
            raise ChannexError("Keine Hotel-Policy-ID erhalten.", status_code=502)
        db.table("channex_property_map").update(
            {"channex_hotel_policy_id": policy_id}
        ).eq("id", pm[0]["id"]).execute()

    def _shared_sibling_count(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> int:
        """Anzahl aktiver lokaler Objekte, die DIESELBE Channex-Property teilen
        (Hotel: mehrere Zimmer → eine Channex-Property, Migration 0158)."""
        rows = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        return len(rows)

    def _is_shared_channex_property(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> bool:
        """True, wenn mehrere lokale Objekte diese Channex-Property teilen."""
        return self._shared_sibling_count(db, tenant_id, channex_property_id) > 1

    def _tenant_title(self, db: Client, tenant_id: str) -> str | None:
        """Betriebsname des Tenants (für den Titel einer GETEILTEN Channex-
        Property — der Zimmertitel wäre dort falsch). None, wenn ungepflegt."""
        row = (
            db.table("tenants").select("name").eq("id", tenant_id)
            .limit(1).execute()
        ).data
        name = (row[0].get("name") or "").strip() if row else ""
        return name or None

    @staticmethod
    def _building_of(db: Client, tenant_id: str, property_id: str) -> str | None:
        """Gebäude dieses Objekts (0264) — oder None, wenn es für sich steht.

        Das Gebäude, NICHT die Betriebsart, entscheidet über die Portal-Kennung:
        Objekte im selben Gebäude teilen sich eine Channex-Property (= eine
        Booking-Hotel-ID mit mehreren Room-IDs), eigenständige bekommen je eine
        eigene. Booking.com verlangt das so — mehrere Einheiten an derselben
        Adresse gehören unter eine Property-ID; eine zweite Registrierung
        derselben Adresse wird abgewiesen.
        """
        row = (
            db.table("properties").select("building_id")
            .eq("id", property_id).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        return (row[0].get("building_id") if row else None) or None

    def _existing_building_channex_property(
        self, db: Client, tenant_id: str, building_id: str
    ) -> str | None:
        """channex_property_id, die die Objekte DIESES Gebäudes schon nutzen.

        None, wenn noch keines verbunden ist. Deterministisch die älteste
        Map-Zeile, damit alle Einheiten desselben Gebäudes auf dieselbe
        Property zeigen — auch wenn zwei Zimmer gleichzeitig gesynct werden.
        """
        einheiten = (
            db.table("properties").select("id")
            .eq("tenant_id", tenant_id).eq("building_id", building_id)
            .execute()
        ).data or []
        ids = [str(e["id"]) for e in einheiten]
        if not ids:
            return None
        rows = (
            db.table("channex_property_map")
            .select("channex_property_id, created_at")
            .eq("tenant_id", tenant_id)
            .in_("property_id", ids)
            .is_("deleted_at", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        return rows[0]["channex_property_id"] if rows else None

    @staticmethod
    def _building_title(db: Client, tenant_id: str, building_id: str) -> str | None:
        """Name des Gebäudes — er trägt die geteilte Property bei den Portalen.

        Ohne ihn hieße die Property bei Booking.com so wie die zuletzt gesyncte
        Einheit („Zimmer 204"), obwohl dort das ganze Haus steht.
        """
        row = (
            db.table("buildings").select("name")
            .eq("id", building_id).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        name = (row[0].get("name") or "").strip() if row else ""
        return name or None

    def _put_property_oder_heilen(
        self, db: Client, tenant_id: str, channex_id: str, attrs: dict[str, Any]
    ) -> bool:
        """Property bei Channex aktualisieren. True = aktualisiert, False = weg.

        Channex entfernt eine Property, die 90 Tage keinen Kanal hatte
        (Aufbewahrungsfrist, `deploy/CHANNEX-GO-LIVE.md`) — und beim Wechsel von
        Staging auf Produktion existiert eine gespeicherte Kennung dort ohnehin
        nicht. Ohne Heilung läuft dann JEDER Sync dieses Objekts für immer in
        denselben 404: der Upsert nimmt den PUT-Pfad, weil eine Map-Zeile da ist,
        und der Neu-Anlege-Pfad wird nie erreicht.

        Bei 404 räumen wir deshalb den Gegenzustand ab (Wurzel 1) — und zwar
        ALLES, was an dieser Kennung hängt, nicht nur die eine Map-Zeile:
        * die Map-Zeilen aller Einheiten, die auf diese Property zeigen
          (geteilte Gebäude-Property, 0264) — sie sind gleichermaßen entwertet,
        * deren Room-Type-/Rate-Plan-Zuordnungen (sonst zeigt die neue Property
          auf Room-Types, die es bei Channex nicht mehr gibt),
        * den ARI-Schatten (`channex_ari_shadow`) dieser Objekte: er hält den
          Ist-Stand ohne Readback fest (siehe README). Bliebe er stehen, hielte
          der Push die neue Property für „schon gesendet" und schickte nie
          wieder Preise/Verfügbarkeit.

        Nur 404 heilt. Jeder andere Fehler (401 Schlüssel falsch, 422 Attribute,
        429 Budget, 5xx) wird weitergeworfen — ihn als „weg" zu deuten würde
        Zuordnungen wegwerfen, die intakt sind (Wurzel 5).
        """
        try:
            self._channex.update_property(channex_id, attrs)
            return True
        except ChannexError as exc:
            if exc.channex_status != 404:
                raise

        betroffene = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        property_ids = [str(r["property_id"]) for r in betroffene]
        map_ids = [str(r["id"]) for r in betroffene]
        log.warning(
            "channex_property_verschwunden_neu_anlegen",
            tenant_id=tenant_id,
            channex_property_id=channex_id,
            betroffene_objekte=len(property_ids),
        )
        if not property_ids:
            return False

        jetzt = datetime.now(UTC).isoformat()
        # Room-Types hängen über property_map_id an der Zuordnung, Rate-Plans
        # über room_type_map_id an den Room-Types — mit der Property sind alle
        # drei Ebenen bei Channex verschwunden, also alle drei abräumen.
        rt_rows = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("property_map_id", map_ids)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        rt_ids = [str(r["id"]) for r in rt_rows]
        if rt_ids:
            db.table("channex_rate_plan_map").update({"deleted_at": jetzt}).eq(
                "tenant_id", tenant_id
            ).in_("room_type_map_id", rt_ids).is_(
                "deleted_at", "null"
            ).execute()
            db.table("channex_room_type_map").update({"deleted_at": jetzt}).eq(
                "tenant_id", tenant_id
            ).in_("id", rt_ids).execute()
        db.table("channex_ari_shadow").delete().eq(
            "tenant_id", tenant_id
        ).in_("property_id", property_ids).execute()
        db.table("channex_property_map").update(
            {
                "deleted_at": jetzt,
                "sync_enabled": False,
                "last_sync_status": "error",
                "last_sync_error": (
                    "Objekt bei den Portalen nicht mehr vorhanden (404) — "
                    "wird beim nächsten Sync neu angelegt."
                ),
            }
        ).eq("tenant_id", tenant_id).eq(
            "channex_property_id", channex_id
        ).is_("deleted_at", "null").execute()
        return False

    def _upsert_channex_property(
        self, db: Client, tenant_id: str, property_id: str, title: str,
        currency: str, prop_row: dict[str, Any] | None = None,
        photos: list[dict[str, Any]] | None = None,
    ) -> str:
        """POST (neu) oder PUT (vorhanden) der Channex-Property; Mapping pflegen."""
        existing = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        # Firmen-Adresse/Kontakt aus dem Firmenprofil als Basis — OTAs wie
        # Booking.com verlangen Property-Adresse/Kontakt zur Aktivierung.
        attrs = {"title": title, "currency": currency}
        attrs.update(self._billing_property_attrs(db, tenant_id))
        # Unterkunfts-eigene Felder haben Vorrang (Adresse/Geo/Typ/Beschreibung
        # gehören zur Property, nicht zur Firma).
        attrs.update(self._property_attrs(prop_row, photos or []))
        if existing.data:
            channex_id = existing.data[0]["channex_property_id"]
            # GETEILTE Property (Hotel, n Zimmer → 1 Channex-Property): der
            # Property-Titel ist der Betriebsname — sonst benennt jeder Zimmer-
            # Sync die Property auf den jeweils zuletzt gesyncten Zimmertitel um.
            if self._shared_sibling_count(db, tenant_id, channex_id) > 1:
                tenant_title = self._tenant_title(db, tenant_id)
                if tenant_title:
                    attrs["title"] = tenant_title
                else:
                    log.warning(
                        "channex_shared_property_no_tenant_title",
                        tenant_id=tenant_id, property_id=property_id,
                    )
            if self._put_property_oder_heilen(db, tenant_id, channex_id, attrs):
                return channex_id
            # Property bei Channex weg (404) → Zuordnung ist entwertet und
            # wurde eben abgeräumt. Weiter im Neu-Anlege-Pfad unten.

        # GEBÄUDE (0264): Objekte desselben Gebäudes teilen EINE Channex-Property
        # (eine Booking-Hotel-ID mit mehreren Room-IDs). Existiert für dieses
        # Gebäude schon eine Property, die BESTEHENDE wiederverwenden und nur
        # eine Map-Zeile für diese Einheit anlegen — statt eine zweite Property
        # zu erzeugen, die Booking.com für dieselbe Adresse ohnehin abweist. Der
        # Room-Type/Rate-Plan dieser Einheit entsteht danach als eigener Eintrag
        # darunter (eigene Rate, keine Vermischung). Ein Objekt OHNE Gebäude
        # steht für sich und bekommt seine eigene Property/Kennung.
        building_id = self._building_of(db, tenant_id, property_id)
        if building_id:
            shared = self._existing_building_channex_property(
                db, tenant_id, building_id
            )
            if shared:
                # Property-Titel auf den Gebäudenamen halten (nicht diesen
                # Einheitentitel) — sonst benennt jede Einheit die Property um.
                haus_title = self._building_title(db, tenant_id, building_id)
                if not self._put_property_oder_heilen(
                    db, tenant_id, shared,
                    {**attrs, "title": haus_title or attrs["title"]},
                ):
                    # Die Gebäude-Property ist bei Channex weg; die Zuordnungen
                    # der Geschwister-Einheiten sind abgeräumt. Diese Einheit
                    # legt jetzt die neue Gebäude-Property an, die Geschwister
                    # hängen sich bei ihrem nächsten Sync wieder daran.
                    shared = None
            if shared:
                db.table("channex_property_map").insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "channex_property_id": shared,
                        "sync_enabled": True,
                        "last_sync_status": "ok",
                        "last_sync_error": None,
                    }
                ).execute()
                return shared

        # Neu anlegen + (falls vorhanden) der Tenant-Group zuordnen. Der Group-Name
        # ist der Betriebsname (tenant), nicht dieser Objekttitel — ensure_group
        # lädt ihn selbst aus der DB.
        group_id = self.ensure_group(tenant_id)
        created = self._channex.create_property(attrs)
        channex_id = (created.get("data") or {}).get("id")
        if not channex_id:
            raise ChannexError("Keine Property-ID erhalten.", status_code=502)
        if group_id:
            try:
                self._channex.assign_property_to_group(group_id, channex_id)
            except ChannexError as exc:
                log.warning("channex_group_assign_failed",
                            property_id=property_id, error=exc.message)
        # Insert statt Upsert: channex_property_id ist seit 0158 NICHT mehr unique
        # (geteilte Property) — ein on_conflict darauf würde die Map-Zeile eines
        # ANDEREN Zimmers überschreiben. Die frisch erzeugte Channex-Property kann
        # nicht kollidieren; Doppel-Anlage je Objekt verhindert der partielle
        # Unique-Index auf property_id (deleted_at is null).
        db.table("channex_property_map").insert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "channex_property_id": channex_id,
                "sync_enabled": True,
                "last_sync_status": "ok",
                "last_sync_error": None,
            }
        ).execute()
        return channex_id

    def _billing_property_attrs(
        self, db: Client, tenant_id: str
    ) -> dict[str, Any]:
        """Adress-/Kontaktfelder aus tenant_billing_profile in Channex-Property-
        Attribute übersetzen. Nur nicht-leere Werte (Channex: Nullen weglassen).
        Adresse = Straße + Hausnummer zusammengeführt (Channex hat ein Feld)."""
        res = (
            db.table("tenant_billing_profile")
            .select("company_street, company_house_number, company_postal_code, "
                    "company_city, company_country, email, phone_number, website, "
                    "company_logo_url")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return {}
        p = res.data[0]
        street = " ".join(
            x for x in [p.get("company_street"), p.get("company_house_number")] if x
        ).strip()
        candidates = {
            "address": street or None,
            "zip_code": p.get("company_postal_code"),
            "city": p.get("company_city"),
            "country": normalize_country(p.get("company_country")),
            "email": p.get("email"),
            "phone": p.get("phone_number"),
            "website": p.get("website"),
            # Unterkunftslogo: zentrales Firmenlogo (/konto) → Channex/OTAs.
            "logo_url": p.get("company_logo_url"),
        }
        return {k: v for k, v in candidates.items() if v}

    @staticmethod
    def _property_attrs(
        prop_row: dict[str, Any] | None,
        photos: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Unterkunfts-eigene Felder → Channex-Property-Attribute. timezone wird
        aus dem Land abgeleitet (Channex verlangt eine IANA-Zeitzone). Nur
        nicht-leere Werte (keine Nullen an Channex)."""
        if not prop_row:
            return {}
        street = " ".join(
            x for x in [prop_row.get("street"), prop_row.get("house_number")] if x
        ).strip()
        # Land defensiv auf ISO-2 normalisieren (fail-safe): das Schema erzwingt
        # es beim Speichern schon, aber Reverse-Import/Alt-Daten könnten Klartext
        # tragen — Channex verlangt max. 2 Zeichen, sonst 422.
        country = normalize_country(prop_row.get("country"))
        candidates: dict[str, Any] = {
            "address": street or None,
            "zip_code": prop_row.get("postal_code"),
            "city": prop_row.get("city"),
            "country": country,
            # Unterkunftsart (Channex-property_type), Vorrang-Reihenfolge:
            #  1. Immobilientyp-Mapping (property_subtypes.channex_property_type, 0198)
            #  2. explizit gewählte Booking-PCT (Hotel/Guesthouse/Riad/…)
            #  3. aus dem Legacy-property_type abgeleiteter grober Typ (Bestand)
            "property_type": (
                _channex_type_from_subtype(prop_row.get("property_subtypes"))
                or _channex_type_from_pct(prop_row.get("booking_property_type"))
                or _channex_property_type(prop_row.get("property_type"))
            ),
            "latitude": prop_row.get("lat"),
            "longitude": prop_row.get("lng"),
            # Zeitzone in dieser Reihenfolge, NICHT geraten wenn es sie gibt:
            #  1. `properties.timezone` (0258) — vom Betrieb gepflegt und per
            #     DB-Trigger gegen pg_timezone_names geprüft. Das ist die Wahrheit.
            #  2. sonst aus dem Land, aber NUR für Länder mit genau EINER Zone
            #     (`_timezone_for_country`). Spanien/Portugal sind dort bewusst
            #     nicht drin: ein Objekt auf Teneriffa (Atlantic/Canary, −1 h)
            #     oder Madeira/Azoren bekäme sonst still die Festlandzone.
            # Fehlt beides, bleibt das Feld weg — Channex' Readiness meldet dann
            # `timezone required` und die Meldung nennt den echten Grund, statt
            # dass eine falsche Zone Check-in-Zeiten verschiebt (Wurzel 4).
            "timezone": (
                prop_row.get("timezone")
                or (_timezone_for_country(country) if country else None)
            ),
        }
        attrs = {k: v for k, v in candidates.items() if v not in (None, "")}
        # Ausstattung → Channex-Facilities (property.facilities, Top-Level). Sobald
        # das Objekt amenities kennt, IMMER setzen (auch []), damit ein Entfernen
        # die Facilities bei Channex/den OTAs synchron leert — die Ausstattung muss
        # 1:1 mit Channex übereinstimmen. Unbekannte Slugs werden weggelassen.
        if "amenities" in (prop_row or {}):
            attrs["facilities"] = _channex_facility_ids(prop_row.get("amenities"))
        # Content (Beschreibung, Hausregeln/Check-in, Fotos) zentral aufgebaut.
        # Sprache nach Objekt-Land; Beschreibung = kanonischer OTA-Text.
        locale_order = content_builder.locale_order_for_country(country)
        content = content_builder.build_property_content(
            prop_row, photos or [], locale_order=locale_order
        )
        if content:
            attrs["content"] = content

        # Property-Settings: Inventartage (500 — Channex-Zertifizierung Test 1;
        # Min/Max-Preis aus dem Preise-Tab — Preisgrenzen nur senden, wenn der
        # Nutzer sie gesetzt hat (kein erfundener Default).
        # Full-Sync und Preis-Resolver decken 500+ Tage lokale Wahrheit ab) und
        settings: dict[str, Any] = {"state_length": 500}
        pricing = (prop_row.get("type_attributes") or {}).get("pricing") or {}
        min_price = pricing.get("minPrice")
        max_price = pricing.get("maxPrice")
        if isinstance(min_price, (int, float)) and min_price > 0:
            settings["min_price"] = min_price
        if isinstance(max_price, (int, float)) and max_price > 0:
            settings["max_price"] = max_price
        # Verfügbarkeits-/Verkaufssteuerung aus type_attributes.availability —
        # 1:1 die Channex-settings-Keys (live gegen /properties gegengelesen):
        # cut_off_time/cut_off_days, max_day_advance, min_stay_type,
        # allow_availability_autoupdate_on_{confirmation,modification,cancellation}.
        # Nur senden, was der Nutzer gesetzt hat; keine erfundenen Defaults.
        settings.update(_availability_settings(
            (prop_row.get("type_attributes") or {}).get("availability") or {}
        ))
        attrs["settings"] = settings
        return attrs

    @staticmethod
    def _room_type_occupancy(prop_row: dict[str, Any] | None) -> dict[str, int]:
        """Room-Type-Belegung aus den ECHTEN Objektdaten, nicht pauschal — sonst
        zeigt Channex/OTA eine falsche Kapazität. Erwachsene = max_guests; Kinder-
        und Kleinkindplätze kommen aus type_attributes.occupancy (im Objekt-Editor
        „Anzahl Gäste" erfasst, 1:1 die Channex-Felder). Channex verlangt
        occ_adults ≥ 1 und default_occupancy ≤ occ_adults; occ_children/occ_infants
        sind Pflichtfelder (live verifiziert).

        count_of_rooms ist FEST 1 und kommt aus keinem Eingabefeld: Channex kappt
        jeden availability-Push auf diesen Wert („Provided value is greater than
        max availability (N). Value changes to max availability." — live gemessen
        01.08.2026). Es ist damit die Obergrenze, wie oft ein Objekt am selben Tag
        verkauft werden kann, und bei „1 property = 1 buchbare Einheit" immer 1.
        Früher floss hier type_attributes.occupancy.rooms ein, ein Feld namens
        „Anzahl Zimmer" — das hätte eine 3-Zimmer-Wohnung dreimal verkaufbar
        gemacht, sobald der Push-Pfad nicht mehr binär wäre (0245).

        WICHTIG: occupancy ist NUR als Objekt {rooms,children,infants} gültig. Ältere
        Wizard-Versionen schrieben hier ein String-Array (Reisetyp-Tags) — das ist ein
        anderer Belang und lebt jetzt unter occupancyTags. Ist occupancy (noch) ein
        Array/kein dict, wird es als leer behandelt (kein AttributeError-Crash)."""
        raw_occ = ((prop_row or {}).get("type_attributes") or {}).get("occupancy")
        occ = raw_occ if isinstance(raw_occ, dict) else {}
        occ_adults = max(1, int((prop_row or {}).get("max_guests") or 2))
        return {
            "count_of_rooms": 1,
            "occ_adults": occ_adults,
            "occ_children": max(0, int(occ.get("children") or 0)),
            "occ_infants": max(0, int(occ.get("infants") or 0)),
            "default_occupancy": occ_adults,
        }

    def _sync_room_types_and_rate_plans(
        self, db: Client, tenant_id: str, channex_property_id: str,
        property_id: str, prop_title: str,
        prop_row: dict[str, Any], photos: list[dict[str, Any]],
        rate_plans: list[dict[str, Any]], prop_currency: str,
    ) -> tuple[str, list[str]]:
        """Room-Type + Rate-Plans an Channex spiegeln. 1 Objekt = 1 Einheit: EIN
        synthetischer Channex-Room-Type je Objekt (local_unit_ref = property_id),
        ALLE Rate-Plans des Objekts daran. Gibt (channex_room_type_id, alle
        channex_rate_plan_ids) zurück."""
        # Map-Zeile des LOKALEN Objekts auflösen (nicht per channex_property_id:
        # bei einer GETEILTEN Channex-Property gehören mehrere Map-Zeilen dazu —
        # ein limit-1-Lookup darüber träfe ggf. das Nachbar-Zimmer, Wurzel 3-artig).
        property_map = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not property_map.data:
            raise ChannexError("Property-Mapping fehlt.", status_code=500)
        property_map_id = property_map.data[0]["id"]
        channex_room_type_id, room_type_map_id = self._upsert_channex_room_type(
            db, tenant_id, property_map_id, channex_property_id, property_id,
            prop_title, prop_row, photos,
        )
        # Alte Kategorie-Room-Types (Container-Ära) VOR der Rate-Plan-Upsert-
        # Schleife prunen (Gegenzustand, Wurzel 1). delete_room_type kaskadiert
        # bei Channex die daran hängenden Rate-Plans → gibt deren (gleichnamige)
        # Titel frei, sodass der anschließende Create am synthetischen Room-Type
        # nicht mehr am „Duplication in Rate Plan title" scheitert. Umhängen geht
        # nicht (room_type_id immutable), darum Löschen+Neuanlegen. Nur der
        # synthetische Room-Type (local_unit_ref = property_id) bleibt. Scope =
        # die Map-Zeile DIESES Objekts — die Room-Types der Geschwister-Zimmer
        # einer geteilten Channex-Property bleiben unberührt.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="room_type_prune"
        )
        self._prune_orphan_room_types(
            db, tenant_id, property_map_id, {property_id},
        )
        channex_rate_plan_ids: list[str] = []
        for rp in rate_plans:
            self._trace_step(
                tenant_id=tenant_id, property_id=property_id, step="rate_plan"
            )
            channex_rate_plan_ids.append(
                self._upsert_channex_rate_plan(
                    db, tenant_id, room_type_map_id, channex_property_id,
                    channex_room_type_id, rp, prop_currency, prop_row,
                )
            )
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="rate_plan_prune"
        )
        self._prune_orphan_rate_plans(
            db, tenant_id, room_type_map_id,
            local_ids={rp["id"] for rp in rate_plans if rp.get("id")},
        )
        return channex_room_type_id, channex_rate_plan_ids

    def _prune_orphan_room_types(
        self, db: Client, tenant_id: str, property_map_id: str,
        active_local_refs: set[str],
    ) -> None:
        """Channex-Room-Types löschen, deren lokale Zimmerkategorie entfernt wurde.

        Gegenzustand pflegen (Wurzel 1): wird eine room_types-Zeile gelöscht,
        MUSS auch der zugehörige Channex-Room-Type verschwinden, sonst verkauft
        eine OTA weiter eine Kategorie, die es nicht mehr gibt. delete_room_type
        kaskadiert bei Channex die daran hängenden Rate-Plans mit; deren lokale
        Map-Zeilen werden hier soft-deleted. Fail-closed wie
        _prune_orphan_rate_plans: ist der Room-Type noch an einen Kanal/Bookings
        gebunden, lehnt Channex ab (422) → Mapping bleibt, Konflikt wird geloggt
        (dann muss der Operator erst die Kanal-Zuordnung lösen; KEIN force=True,
        das risse die OTA-Bindung ab). Erfolgreich gelöschte Room-Types werden
        soft-deleted. Scope ist die ÜBERGEBENE Map-Zeile (property_map_id) — bei
        einer geteilten Channex-Property (0158) hängen daran mehrere Map-Zeilen,
        und die Room-Types der Geschwister-Zimmer dürfen NIE mitgeprunt werden."""
        rows = (
            db.table("channex_room_type_map")
            .select("id, local_unit_ref, channex_room_type_id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", property_map_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        for row in rows:
            if row.get("local_unit_ref") in active_local_refs:
                continue  # Kategorie existiert noch → behalten
            child_rp = (
                db.table("channex_rate_plan_map")
                .select("id, local_rate_plan_id, channex_rate_plan_id")
                .eq("tenant_id", tenant_id)
                .eq("room_type_map_id", row["id"])
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            # Gegenzustand (Wurzel 1): delete_room_type ENTWAIST die Rate-Plans nur
            # (room_type_id → null), löscht sie NICHT mit (live verifiziert). Die
            # verwaisten Pläne behalten aber ihren Titel und blockieren das
            # Neuanlegen gleichnamiger Pläne (title unique per property). Darum die
            # Kind-Rate-Plans ZUERST explizit löschen, DANN den Room-Type. Beides
            # fail-closed (kein force): scheitert ein Delete (Kanal-Bindung), bleibt
            # der Room-Type stehen und der Konflikt wird geloggt.
            if not self._delete_channex_rate_plans(db, child_rp):
                log.warning(
                    "channex_room_type_prune_blocked",
                    channex_room_type_id=row.get("channex_room_type_id"),
                    error="rate_plan_delete_blocked",
                )
                continue
            channex_id = row.get("channex_room_type_id")
            try:
                if channex_id:
                    self._channex.delete_room_type(channex_id)
            except ChannexError as exc:
                # 404 = bei Channex schon weg → Mapping trotzdem schließen; alles
                # andere (422 Kanal-/Booking-Bindung) → behalten und loggen.
                if exc.channex_status != 404:
                    log.warning(
                        "channex_room_type_prune_blocked",
                        channex_room_type_id=channex_id, error=exc.message,
                    )
                    continue
            db.table("channex_room_type_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).eq("id", row["id"]).execute()
            log.info(
                "channex_room_type_pruned",
                channex_room_type_id=channex_id,
                local_unit_ref=row.get("local_unit_ref"),
            )

    def _delete_channex_rate_plans(
        self, db: Client, child_rp: list[dict[str, Any]],
    ) -> bool:
        """Verwaiste Kind-Rate-Plans bei Channex löschen + Map-Zeile soft-deleten.
        Gibt False zurück, wenn ein Delete fail-closed blockiert wurde (Kanal-
        Bindung, 422) — dann darf der Room-Type nicht gelöscht werden. 404 =
        bei Channex schon weg → Map trotzdem schließen (Gegenzustand, Wurzel 1)."""
        ok = True
        for child in child_rp:
            cx_id = child.get("channex_rate_plan_id")
            try:
                if cx_id:
                    self._channex.delete_rate_plan(cx_id)
            except ChannexError as exc:
                if exc.channex_status != 404:
                    log.warning(
                        "channex_rate_plan_prune_blocked",
                        channex_rate_plan_id=cx_id, error=exc.message,
                    )
                    ok = False
                    continue
            db.table("channex_rate_plan_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).eq("id", child["id"]).execute()
        return ok

    def _upsert_channex_room_type(
        self, db: Client, tenant_id: str, property_map_id: str,
        channex_property_id: str, property_id: str, title: str,
        prop_row: dict[str, Any] | None = None,
        photos: list[dict[str, Any]] | None = None,
    ) -> tuple[str, str]:
        """Synthetischer Room-Type (1 pro Objekt/Zimmer). local_unit_ref =
        property_id; hängt an der ÜBERGEBENEN Map-Zeile (geteilte Channex-
        Property: mehrere Map-Zeilen je channex_property_id, 0158). Gibt
        (channex_room_type_id, room_type_map_id) zurück."""
        existing = (
            db.table("channex_room_type_map")
            .select("id, channex_room_type_id")
            .eq("property_map_id", property_map_id)
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        attrs = {
            "property_id": channex_property_id,
            "title": title,
            **self._room_type_occupancy(prop_row),
            "room_kind": "room",
        }
        # Zimmer-Ausstattung → Channex-room_facilities (eigener Katalog mit
        # EIGENEN UUIDs, nicht der Objekt-Katalog). Sobald das Objekt das Feld
        # kennt, IMMER setzen (auch []), damit ein Entfernen die Facilities bei
        # Channex/den OTAs synchron leert (Wurzel 1 — live verifiziert: ein PUT
        # mit einer UUID entfernt die übrigen).
        # Zimmer-Ausstattung haengt seit 0251 wieder ausschliesslich am Objekt
        # (properties.room_amenities) — eine Quelle, ein Schreibpfad. Channex
        # kennt je Objekt ohnehin genau EINEN Room-Type.
        if prop_row is not None and "room_amenities" in prop_row:
            attrs["facilities"] = _channex_room_facility_ids(
                sorted(prop_row.get("room_amenities") or [])
            )
        # Room-Type-Content (Beschreibung + Fotos, KEIN important_information).
        # Beim 1-Zimmer-Modell teilt der Room-Type die Property-Inhalte.
        if prop_row is not None:
            locale_order = content_builder.locale_order_for_country(
                prop_row.get("country")
            )
            rt_content = content_builder.build_room_type_content(
                prop_row, photos or [], locale_order=locale_order
            )
            if rt_content:
                attrs["content"] = rt_content
        if existing.data:
            channex_room_type_id = existing.data[0]["channex_room_type_id"]
            self._channex.update_room_type(channex_room_type_id, attrs)
            return channex_room_type_id, existing.data[0]["id"]

        created = self._channex.create_room_type(attrs)
        channex_room_type_id = (created.get("data") or {}).get("id")
        if not channex_room_type_id:
            raise ChannexError("Keine Room-Type-ID erhalten.", status_code=502)
        saved = (
            db.table("channex_room_type_map")
            .upsert(
                {
                    "tenant_id": tenant_id,
                    "property_map_id": property_map_id,
                    "local_unit_ref": property_id,
                    "title": title,
                    "channex_room_type_id": channex_room_type_id,
                },
                on_conflict="channex_room_type_id",
            )
            .execute()
        )
        return channex_room_type_id, saved.data[0]["id"]

    @staticmethod
    def _rate_plan_options(
        base_cents: int, prop_row: dict[str, Any] | None
    ) -> tuple[str, list[dict[str, Any]]]:
        """Baut (sell_mode, options) für den Rate-Plan. Ohne Gast-Aufschlag:
        per_room mit Primär-Belegung 2. Mit extraGuestCharge>0: per_person mit
        einer Option je Belegung (1..max_guests) — Primär-Belegung trägt den
        Basispreis, höhere Belegungen einen festen Aufschlag pro zusätzlichem
        Gast (derived_option increase_by_amount). Kein Aufschlag → kein Erfinden."""
        attrs = (prop_row or {}).get("type_attributes") or {}
        pricing = attrs.get("pricing") or {}
        extra = pricing.get("extraGuestCharge") or 0
        extra_from = pricing.get("extraGuestFrom") or 1
        max_guests = (prop_row or {}).get("max_guests") or 2

        if not extra or extra <= 0:
            return "per_room", [
                {"occupancy": 2, "is_primary": True, "rate": base_cents}
            ]

        extra_cents = round(float(extra) * 100)
        primary_occ = max(1, int(extra_from))
        options: list[dict[str, Any]] = []
        for occ in range(1, int(max_guests) + 1):
            if occ == primary_occ:
                options.append(
                    {"occupancy": occ, "is_primary": True, "rate": base_cents}
                )
            elif occ > primary_occ:
                steps = occ - primary_occ
                options.append(
                    {
                        "occupancy": occ,
                        "is_primary": False,
                        "derived_option": {
                            "rate": [["increase_by_amount", str(extra_cents * steps)]]
                        },
                    }
                )
            else:
                # Belegung unter der Primär-Belegung: gleicher Basispreis.
                options.append(
                    {"occupancy": occ, "is_primary": False, "rate": base_cents}
                )
        return "per_person", options

    def _upsert_channex_rate_plan(
        self, db: Client, tenant_id: str, room_type_map_id: str,
        channex_property_id: str, channex_room_type_id: str,
        rp: dict[str, Any], currency: str,
        prop_row: dict[str, Any] | None = None,
    ) -> str:
        """Ein Rate-Plan am synthetischen Room-Type. base_price (Euro) → Cent.
        Gast-Aufschlag → per_person-Belegungspreise (sonst per_room)."""
        local_rate_plan_id = rp.get("id")
        title = rp.get("name") or "Standardpreis"
        base_cents = self._euro_to_cents(rp.get("base_price")) or 0

        # Reuse-Lookup NUR am aktuellen (synthetischen) Room-Type: ein Channex-
        # Rate-Plan gehört unveränderlich zu EINEM room_type_id (PUT mit fremdem
        # room_type_id → 422 „can't be changed"). Ein Plan, der noch an einer
        # ALTEN Kategorie-Map hängt, wird daher NICHT umgehängt, sondern über
        # _prune_orphan_room_types explizit gelöscht (delete_room_type entwaist die
        # Rate-Plans nur, darum werden sie dort vorher per delete_rate_plan
        # gelöscht) und hier am synthetischen Room-Type NEU angelegt. Dadurch ist
        # auch der Titel wieder frei (title unique per property).
        existing_row: dict[str, Any] | None = None
        if local_rate_plan_id:
            hit = (
                db.table("channex_rate_plan_map")
                .select("id, channex_rate_plan_id, room_type_map_id")
                .eq("tenant_id", tenant_id)
                .eq("room_type_map_id", room_type_map_id)
                .eq("local_rate_plan_id", local_rate_plan_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data or []
            existing_row = hit[0] if hit else None

        sell_mode, options = self._rate_plan_options(base_cents, prop_row)
        attrs = {
            "property_id": channex_property_id,
            "room_type_id": channex_room_type_id,
            "title": title,
            "currency": currency,
            "sell_mode": sell_mode,
            "rate_mode": "manual",
            "options": options,
        }
        # Mindestaufenthalt → Channex (min_stay_arrival + min_stay_through). Beide
        # sind 7er-Arrays (Mo–So); wir setzen für alle Wochentage denselben Wert
        # aus rate_plans.min_stay. Ohne das bleibt Channex bei Default 1 (live
        # verifiziert: PUT [3×7] persistiert, GET liest 3 zurück). Der min_stay-
        # Typ (arrival/through/both) steuert nur, welches Array Channex erzwingt.
        min_stay = rp.get("min_stay")
        if isinstance(min_stay, int) and min_stay >= 1:
            week = [min_stay] * 7
            attrs["min_stay_arrival"] = week
            attrs["min_stay_through"] = week
        if existing_row is not None:
            # Plan hängt bereits am synthetischen Room-Type → reines Update
            # (room_type_id bleibt gleich, kein immutable-Konflikt).
            channex_rate_plan_id = existing_row["channex_rate_plan_id"]
            self._channex.update_rate_plan(channex_rate_plan_id, attrs)
            return channex_rate_plan_id

        created = self._channex.create_rate_plan(attrs)
        channex_rate_plan_id = (created.get("data") or {}).get("id")
        if not channex_rate_plan_id:
            raise ChannexError("Keine Rate-Plan-ID erhalten.", status_code=502)
        db.table("channex_rate_plan_map").upsert(
            {
                "tenant_id": tenant_id,
                "room_type_map_id": room_type_map_id,
                "local_rate_plan_id": local_rate_plan_id,
                "title": title,
                "channex_rate_plan_id": channex_rate_plan_id,
            },
            on_conflict="channex_rate_plan_id",
        ).execute()
        return channex_rate_plan_id

    def _prune_orphan_rate_plans(
        self, db: Client, tenant_id: str, room_type_map_id: str,
        local_ids: set[str],
    ) -> None:
        """Channex-Rate-Plans löschen, deren lokaler Preisplan entfernt wurde.

        Kette der Doku folgend fail-closed: OHNE force — ist der Rate-Plan noch
        an einen Kanal gemappt, lehnt Channex ab (422). Dann bleibt das Mapping
        bestehen und der Konflikt wird geloggt (erst Kanal-Mapping lösen, dann
        verschwindet der Plan beim nächsten Sync). Erfolgreich gelöschte Pläne
        werden im Mapping soft-deleted (deleted_at), damit ARI-Pushes sie nicht
        mehr ansprechen (Wurzel 1: Gegenzustand pflegen)."""
        rows = (
            db.table("channex_rate_plan_map")
            .select("id, local_rate_plan_id, channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("room_type_map_id", room_type_map_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        for row in rows:
            local_id = row.get("local_rate_plan_id")
            if local_id and local_id in local_ids:
                continue  # lokal noch vorhanden → nichts zu tun
            channex_id = row.get("channex_rate_plan_id")
            try:
                if channex_id:
                    self._channex.delete_rate_plan(channex_id)
            except ChannexError as exc:
                # 404 = in Channex bereits weg (Retention/manuell) → Mapping
                # trotzdem schließen; alles andere (422 Kanal-Mapping) → behalten.
                if exc.channex_status != 404:
                    log.warning(
                        "channex_rate_plan_prune_blocked",
                        channex_rate_plan_id=channex_id, error=exc.message,
                    )
                    continue
            db.table("channex_rate_plan_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).eq("id", row["id"]).execute()
            log.info(
                "channex_rate_plan_pruned",
                channex_rate_plan_id=channex_id, local_rate_plan_id=local_id,
            )

    def _mark_property_sync(
        self, db: Client, tenant_id: str, property_id: str,
        status: str, error: str | None,
    ) -> None:
        db.table("channex_property_map").update(
            {
                "last_sync_at": datetime.now(UTC).isoformat(),
                "last_sync_status": status,
                "last_sync_error": error,
            }
        ).eq("property_id", property_id).eq("tenant_id", tenant_id).execute()

    @staticmethod
    def _euro_to_cents(amount: object) -> int | None:
        """Euro (numeric/Decimal/str) → Cent-Integer. Nur an der API-Grenze."""
        if amount is None:
            return None
        try:
            return round(float(amount) * 100)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
