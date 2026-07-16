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
    _timezone_for_country,
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
    def ensure_group(self, tenant_id: str, *, title: str) -> str | None:
        """Stellt sicher, dass für den Tenant eine Channex-Group existiert.
        Gibt die channex_group_id zurück (oder None, wenn nicht konfiguriert/Fehler)."""
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

        # Lokale Property MIT allen Channex-relevanten Feldern laden (Tenant-Scope).
        prop = (
            db.table("properties")
            .select(
                "id, title, description, property_type, street, house_number, "
                "postal_code, city, country, lat, lng, max_guests, amenities, "
                "type_attributes"
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

        # Rate-Plans der Property laden (currency vom ersten Plan).
        # room_type_id MUSS mit: der Hotel-Zweig gruppiert die Pläne je Kategorie
        # darüber (channex_room_type_map.local_unit_ref = room_type.id). Fehlt die
        # Spalte im Select, ist rp["room_type_id"] immer None → alle Pläne gelten
        # als verwaist und werden nie zu Channex gepusht (Hotel-only-Bug).
        rate_plans = (
            db.table("rate_plans")
            .select("id, name, room_type_id, base_price, currency, min_stay")
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
        # Währung: übergebene (falls gesetzt), sonst die ECHTE Rate-Plan-Währung
        # (rate_plans.currency ist NOT NULL, Migration 0003) — kein EUR-Fallback.
        rate_currency = rate_plans[0].get("currency")
        prop_currency = (currency or rate_currency or "").upper()
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
            self._channex.update_property(channex_id, attrs)
            return channex_id

        # Neu anlegen + (falls vorhanden) der Tenant-Group zuordnen.
        group_id = self.ensure_group(tenant_id, title=title)
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
        db.table("channex_property_map").upsert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "channex_property_id": channex_id,
                "sync_enabled": True,
                "last_sync_status": "ok",
                "last_sync_error": None,
            },
            on_conflict="channex_property_id",
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
            "property_type": _channex_property_type(prop_row.get("property_type")),
            "latitude": prop_row.get("lat"),
            "longitude": prop_row.get("lng"),
            "timezone": _timezone_for_country(country) if country else None,
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
        zeigt Channex/OTA eine falsche Kapazität. Erwachsene = max_guests; Kinder-,
        Kleinkindplätze und Zimmeranzahl kommen aus type_attributes.occupancy (im
        Objekt-Editor „Belegung" erfasst, 1:1 die Channex-Felder). Channex verlangt
        occ_adults ≥ 1 und default_occupancy ≤ occ_adults; occ_children/occ_infants
        sind Pflichtfelder (live verifiziert)."""
        occ = ((prop_row or {}).get("type_attributes") or {}).get("occupancy") or {}
        occ_adults = max(1, int((prop_row or {}).get("max_guests") or 2))
        return {
            "count_of_rooms": max(1, int(occ.get("rooms") or 1)),
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
        """Room-Types + Rate-Plans an Channex spiegeln — verzweigt über den
        zentralen Schalter (room_inventory.is_hotel_property):

          - Ferienvermietung (0 room_types): EIN synthetischer Room-Type je
            Property (local_unit_ref = property_id), ALLE Rate-Plans daran. Der
            heutige Pfad, byte-identisch — kein Verhalten ändert sich.
          - Hotel (≥1 room_types): je Zimmerkategorie ein Channex-Room-Type
            (local_unit_ref = room_type.id, Belegung/count aus den room_types-
            Spalten), Rate-Plans nur an DIE Kategorie, der sie per
            rate_plans.room_type_id zugeordnet sind. Verwaiste Room-Type-Maps
            (gelöschte Kategorie) werden bei Channex entfernt (Wurzel 1).

        Gibt (repräsentative channex_room_type_id, alle channex_rate_plan_ids)
        zurück (die Room-Type-ID nur für Trace/Log; bei Hotels der erste)."""
        # room_inventory ist der EINZIGE Ort, der Hotel vs. FeWo entscheidet
        # (kein Typ-Flag). Lazy-Import: content_sync ist ein Mixin ohne core-Import.
        from src.core.room_inventory import (  # noqa: PLC0415
            hotel_room_types,
        )

        categories = hotel_room_types(db, property_id)
        if not categories:
            # === Ferienwohnungs-Pfad (unverändert) ===
            channex_room_type_id, room_type_map_id = self._upsert_channex_room_type(
                db, tenant_id, channex_property_id, property_id, prop_title,
                prop_row, photos,
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
            # Gegenzustand beim Rückweg Hotel → Ferienwohnung (Wurzel 1): wurden
            # ALLE Zimmerkategorien gelöscht, landet die Property wieder hier im
            # FeWo-Zweig. Die alten Hotel-Room-Type-Maps (local_unit_ref =
            # room_type.id) blieben sonst als aktive Waisen bei Channex stehen —
            # eine OTA verkaufte weiter nicht mehr existierende Kategorien. Aktiv
            # ist jetzt NUR der synthetische Room-Type (local_unit_ref =
            # property_id); alles andere prunen.
            self._prune_orphan_room_types(
                db, tenant_id, channex_property_id, {property_id},
            )
            return channex_room_type_id, channex_rate_plan_ids

        # === Hotel-Pfad: n Zimmerkategorien ===
        # Rate-Plans nach ihrer room_type_id gruppieren. Ein Plan OHNE
        # room_type_id gehört zu keiner Kategorie und wird NICHT gepusht
        # (fail-closed, Wurzel 4/5: kein Anhängen an einen willkürlichen Typ).
        plans_by_rt: dict[str, list[dict[str, Any]]] = {}
        for rp in rate_plans:
            rt_id = rp.get("room_type_id")
            if rt_id:
                plans_by_rt.setdefault(rt_id, []).append(rp)
            else:
                # Verwaister Plan (keiner Kategorie zugeordnet) → nicht gepusht
                # (fail-closed, Wurzel 4/5). Sichtbar loggen wie jeder andere Skip
                # (sonst verschwindet ein Preisplan wortlos aus Channex).
                log.warning(
                    "channex_rate_plan_orphan_no_room_type",
                    tenant_id=tenant_id, property_id=property_id,
                    rate_plan_id=rp.get("id"),
                )

        # Fail-closed (Wurzel 5): Ein EINZELNER verwaister Plan ist ok (Warning
        # oben). Sind aber Pläne vorhanden, aber KEINER einer Kategorie zugeordnet,
        # ist das ein Daten-/Code-Fehler (z. B. room_type_id nicht geladen) — nicht
        # still „done" markieren, sondern scheitern. MUSS vor den Prune-Aufrufen
        # stehen, damit local_ids=∅ nicht bestehende Rate-Plan-Maps löscht (Wurzel 1).
        if rate_plans and not plans_by_rt:
            raise ChannexError(
                "Kein Preisplan konnte einer Zimmerkategorie zugeordnet werden — "
                "die Preise wurden NICHT an die Buchungsportale übermittelt.",
                status_code=502,
            )

        all_rate_plan_ids: list[str] = []
        first_room_type_id: str | None = None
        active_local_refs: set[str] = set()
        for cat in categories:
            active_local_refs.add(cat["id"])
            self._trace_step(
                tenant_id=tenant_id, property_id=property_id, step="room_type"
            )
            crt_id, rtm_id = self._upsert_hotel_room_type(
                db, tenant_id, channex_property_id, cat, prop_row, photos,
            )
            first_room_type_id = first_room_type_id or crt_id
            cat_plans = plans_by_rt.get(cat["id"], [])
            for rp in cat_plans:
                self._trace_step(
                    tenant_id=tenant_id, property_id=property_id, step="rate_plan"
                )
                all_rate_plan_ids.append(
                    self._upsert_channex_rate_plan(
                        db, tenant_id, rtm_id, channex_property_id,
                        crt_id, rp, prop_currency, prop_row,
                    )
                )
            self._trace_step(
                tenant_id=tenant_id, property_id=property_id, step="rate_plan_prune"
            )
            self._prune_orphan_rate_plans(
                db, tenant_id, rtm_id,
                local_ids={rp["id"] for rp in cat_plans if rp.get("id")},
            )
        # Verwaiste Room-Type-Maps (Kategorie gelöscht) bei Channex entfernen —
        # Gegenzustand pflegen (Wurzel 1), fail-closed wie beim Rate-Plan-Prune.
        self._prune_orphan_room_types(
            db, tenant_id, channex_property_id, active_local_refs,
        )
        if first_room_type_id is None:
            raise ChannexError("Kein Room-Type angelegt.", status_code=502)
        return first_room_type_id, all_rate_plan_ids

    def _upsert_hotel_room_type(
        self, db: Client, tenant_id: str, channex_property_id: str,
        cat: dict[str, Any], prop_row: dict[str, Any],
        photos: list[dict[str, Any]],
    ) -> tuple[str, str]:
        """Eine Zimmerkategorie (room_types-Zeile) als Channex-Room-Type anlegen/
        aktualisieren. local_unit_ref = room_types.id (n je Property). Belegung/
        count aus den room_types-Spalten — NICHT aus max_guests/type_attributes
        (Wurzel 4: die Kategorie ist die Wahrheit). Gibt (channex_room_type_id,
        room_type_map_id) zurück."""
        property_map = (
            db.table("channex_property_map")
            .select("id")
            .eq("channex_property_id", channex_property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not property_map.data:
            raise ChannexError("Property-Mapping fehlt.", status_code=500)
        property_map_id = property_map.data[0]["id"]
        local_ref = cat["id"]
        title = cat.get("title") or "Zimmer"

        existing = (
            db.table("channex_room_type_map")
            .select("id, channex_room_type_id")
            .eq("property_map_id", property_map_id)
            .eq("local_unit_ref", local_ref)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        attrs: dict[str, Any] = {
            "property_id": channex_property_id,
            "title": title,
            "count_of_rooms": int(cat["count_of_rooms"]),
            "occ_adults": int(cat["occ_adults"]),
            "occ_children": int(cat.get("occ_children") or 0),
            "occ_infants": int(cat.get("occ_infants") or 0),
            "default_occupancy": int(cat["default_occupancy"]),
            "room_kind": "room",
        }
        # Room-Type-Content (Beschreibung + Fotos) teilt sich die Property-Inhalte;
        # eine kategorie-eigene Beschreibung gibt es (noch) nicht — kein Erfinden.
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
                    "local_unit_ref": local_ref,
                    "title": title,
                    "channex_room_type_id": channex_room_type_id,
                },
                on_conflict="channex_room_type_id",
            )
            .execute()
        )
        return channex_room_type_id, saved.data[0]["id"]

    def _prune_orphan_room_types(
        self, db: Client, tenant_id: str, channex_property_id: str,
        active_local_refs: set[str],
    ) -> None:
        """Channex-Room-Types löschen, deren lokale Zimmerkategorie entfernt wurde.

        Gegenzustand pflegen (Wurzel 1): wird eine room_types-Zeile gelöscht,
        MUSS auch der zugehörige Channex-Room-Type verschwinden, sonst verkauft
        eine OTA weiter eine Kategorie, die es nicht mehr gibt. Fail-closed wie
        _prune_orphan_rate_plans: ist der Room-Type noch an einen Kanal/Bookings
        gebunden, lehnt Channex ab (422) → Mapping bleibt, Konflikt wird geloggt.
        Erfolgreich gelöschte Room-Types werden im Mapping soft-deleted."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("channex_property_id", channex_property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not pm:
            return
        rows = (
            db.table("channex_room_type_map")
            .select("id, local_unit_ref, channex_room_type_id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        for row in rows:
            if row.get("local_unit_ref") in active_local_refs:
                continue  # Kategorie existiert noch → behalten
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

    def _upsert_channex_room_type(
        self, db: Client, tenant_id: str, channex_property_id: str,
        property_id: str, title: str,
        prop_row: dict[str, Any] | None = None,
        photos: list[dict[str, Any]] | None = None,
    ) -> tuple[str, str]:
        """Synthetischer Room-Type (1 pro Property). local_unit_ref = property_id.
        Gibt (channex_room_type_id, room_type_map_id) zurück."""
        property_map = (
            db.table("channex_property_map")
            .select("id")
            .eq("channex_property_id", channex_property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not property_map.data:
            raise ChannexError("Property-Mapping fehlt.", status_code=500)
        property_map_id = property_map.data[0]["id"]

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

        q = (
            db.table("channex_rate_plan_map")
            .select("id, channex_rate_plan_id")
            .eq("room_type_map_id", room_type_map_id)
            .is_("deleted_at", "null")
        )
        q = q.eq("local_rate_plan_id", local_rate_plan_id) if local_rate_plan_id else q
        existing = q.limit(1).execute()

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
        if existing.data:
            channex_rate_plan_id = existing.data[0]["channex_rate_plan_id"]
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

    # Lokale Steuer-Logik → Channex tax.logic. percent→percent; amount → pro Nacht
    # (Pauschale je Nacht ist die gängige Auslegung eines festen Betrags).
    _TAX_LOGIC = {"percent": "percent", "amount": "per_night"}
    # Lokale Steuer-Art → Channex type.
    _TAX_TYPE = {"vat": "tax", "local": "city tax"}

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
        channex_tax_map. Ohne Steuern: no-op."""
        attrs = prop_row.get("type_attributes") or {}
        pricing = attrs.get("pricing") or {}
        taxes = pricing.get("taxes") or []
        if not taxes:
            return

        channex_tax_ids: list[str] = []
        for t in taxes:
            local_id = t.get("id")
            if not local_id:
                continue
            logic = self._TAX_LOGIC.get(t.get("mode"), "percent")
            tax_attrs: dict[str, Any] = {
                "title": (t.get("name") or "Steuer")[:255],
                "logic": logic,
                "type": self._TAX_TYPE.get(t.get("kind"), "tax"),
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

        if not channex_tax_ids:
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
