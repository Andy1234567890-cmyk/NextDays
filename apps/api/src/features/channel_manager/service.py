"""Service-Schicht für channel_manager (Channel-Manager via Channex).

CRUD/Sync über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt
immer aus dem JWT (AuthContext), nie aus User-Input. Die externe Kommunikation
läuft über ChannexClient (channex_client.py).

Verantwortlichkeiten:
  - Property mit Channex verbinden (bestehende anbinden oder neu anlegen)
  - ARI pushen (Verfügbarkeit + Preise/Restriktionen, gebündelt)
  - Buchungen ziehen (Revisions-Feed → speichern → ack) + Webhook-Ingest
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

from .channex_client import ChannexClient, ChannexError
from .schemas import (
    AriPushRequest,
    AriPushResponse,
    BookingListResponse,
    BookingResponse,
    BookingSyncResponse,
    PropertyConnectRequest,
    PropertyMapListResponse,
    PropertyMapResponse,
    SliceHealth,
)

log = get_logger("nextdays.channel_manager")

_WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"]

# Haupt-IANA-Zeitzone je Land (DACH+EU+CH). Channex verlangt eine Zeitzone an der
# Property; spiegelt das Frontend-Mapping in apps/web/lib/laender.ts.
_TIMEZONE_BY_COUNTRY: dict[str, str] = {
    "DE": "Europe/Berlin", "AT": "Europe/Vienna", "CH": "Europe/Zurich",
    "BE": "Europe/Brussels", "BG": "Europe/Sofia", "HR": "Europe/Zagreb",
    "CY": "Asia/Nicosia", "CZ": "Europe/Prague", "DK": "Europe/Copenhagen",
    "EE": "Europe/Tallinn", "FI": "Europe/Helsinki", "FR": "Europe/Paris",
    "GR": "Europe/Athens", "HU": "Europe/Budapest", "IE": "Europe/Dublin",
    "IT": "Europe/Rome", "LV": "Europe/Riga", "LT": "Europe/Vilnius",
    "LU": "Europe/Luxembourg", "MT": "Europe/Malta", "NL": "Europe/Amsterdam",
    "PL": "Europe/Warsaw", "PT": "Europe/Lisbon", "RO": "Europe/Bucharest",
    "SK": "Europe/Bratislava", "SI": "Europe/Ljubljana", "ES": "Europe/Madrid",
    "SE": "Europe/Stockholm",
}


def _timezone_for_country(code: str) -> str | None:
    """IANA-Zeitzone für ein Land — None, wenn unbekannt (kein Fallback erfinden)."""
    return _TIMEZONE_BY_COUNTRY.get(code.upper())


# Lokaler property_type-Enum (public.property_type, Migration 0009) → gültiger
# Channex-Code. Channex akzeptiert NUR seine 23 festen Codes; unser deutscher
# Wert (z. B. "appartement") führt sonst zu 422 "property_type is invalid" und
# blockiert das Veröffentlichen. Mapping verifiziert gegen die Channex-Doku.
_CHANNEX_PROPERTY_TYPE: dict[str, str] = {
    "ferienhaus": "holiday_home",
    "appartement": "apartment",
    "glamping": "tent",
    "tiny_house": "chalet",
    "stellplatz": "camping",
    "hausboot": "boat",
}


def _channex_property_type(local: str | None) -> str | None:
    """Lokalen property_type auf einen gültigen Channex-Code abbilden. Unbekannt
    → None (Feld weglassen statt einen ungültigen Wert senden — property_type ist
    für ARI/Buchung nicht erforderlich, ein 422 darf das Sync nicht kippen)."""
    if not local:
        return None
    return _CHANNEX_PROPERTY_TYPE.get(local.lower())


class ChannelManagerError(Exception):
    """Fehler im channel_manager-Slice (an die API weitergereicht)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ChannelManagerService:
    slice_name = "channel_manager"

    def __init__(
        self,
        *,
        service_client: Client | None = None,
        channex: ChannexClient | None = None,
    ) -> None:
        self._db = service_client
        self._channex = channex or ChannexClient()

    # -- Helpers ---------------------------------------------------------------
    def health(self) -> SliceHealth:
        return SliceHealth(
            slice=self.slice_name,
            channel_manager_ready=self._channex.is_configured,
        )

    def _require_db(self) -> Client:
        if self._db is None:
            raise ChannelManagerError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ChannelManagerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    @staticmethod
    def _wrap_channex(exc: ChannexError) -> ChannelManagerError:
        return ChannelManagerError(exc.message, status_code=exc.status_code)

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
            self._db.table("channex_group_map").upsert(
                {"tenant_id": tenant_id, "channex_group_id": group_id, "title": title},
                on_conflict="tenant_id",
            ).execute()
            log.info("channex_group_created", tenant_id=tenant_id)
            return group_id
        except ChannexError as exc:
            log.error("channex_group_failed", tenant_id=tenant_id, error=exc.message)
            return None

    def sync_property_to_channex(
        self,
        tenant_id: str,
        *,
        property_id: str,
        title: str,
        currency: str = "EUR",
    ) -> None:
        """Non-blocking Auto-Sync beim Anlegen/Ändern eines Objekts.

        Delegiert an den vollständigen, idempotenten Content-Sync und schluckt
        Fehler (loggt sie), damit die Objekt-Anlage nie an Channex scheitert."""
        if not self._channex.is_configured or self._db is None:
            return
        try:
            self.sync_content(
                tenant_id, property_id=property_id, title=title, currency=currency
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
    def sync_content(
        self,
        tenant_id: str,
        *,
        property_id: str,
        title: str | None = None,
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
                "postal_code, city, country, lat, lng, max_guests, type_attributes"
            )
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        prop_row = prop.data[0]
        prop_title = title or prop_row.get("title") or "Unbenannt"

        # Rate-Plans der Property laden (currency vom ersten Plan).
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
        prop_currency = (
            currency or rate_plans[0].get("currency") or "EUR"
        ).upper()

        try:
            channex_property_id = self._upsert_channex_property(
                db, tenant_id, property_id, prop_title, prop_currency, prop_row
            )
            channex_room_type_id, room_type_map_id = self._upsert_channex_room_type(
                db, tenant_id, channex_property_id, property_id, prop_title
            )
            channex_rate_plan_ids: list[str] = []
            for rp in rate_plans:
                crp = self._upsert_channex_rate_plan(
                    db, tenant_id, room_type_map_id, channex_property_id,
                    channex_room_type_id, rp, prop_currency, prop_row,
                )
                channex_rate_plan_ids.append(crp)
            # Steuern (USt./City-Tax) → Channex tax_sets + tax_set_id am Rate-Plan.
            self._sync_taxes(
                db, tenant_id, property_id, channex_property_id,
                channex_rate_plan_ids, prop_currency, prop_row,
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

    def _upsert_channex_property(
        self, db: Client, tenant_id: str, property_id: str, title: str,
        currency: str, prop_row: dict[str, Any] | None = None,
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
        attrs.update(self._property_attrs(prop_row))
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
                    "company_city, company_country, email, phone_number, website")
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
            "country": p.get("company_country"),
            "email": p.get("email"),
            "phone": p.get("phone_number"),
            "website": p.get("website"),
        }
        return {k: v for k, v in candidates.items() if v}

    @staticmethod
    def _property_attrs(prop_row: dict[str, Any] | None) -> dict[str, Any]:
        """Unterkunfts-eigene Felder → Channex-Property-Attribute. timezone wird
        aus dem Land abgeleitet (Channex verlangt eine IANA-Zeitzone). Nur
        nicht-leere Werte (keine Nullen an Channex)."""
        if not prop_row:
            return {}
        street = " ".join(
            x for x in [prop_row.get("street"), prop_row.get("house_number")] if x
        ).strip()
        country = prop_row.get("country")
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
        desc = prop_row.get("description")
        if desc:
            attrs["content"] = {"description": desc}

        # Property-Settings: Inventartage (passt zu unserem 365-Tage-Init) und
        # Min/Max-Preis aus dem Preise-Tab — Preisgrenzen nur senden, wenn der
        # Nutzer sie gesetzt hat (kein erfundener Default).
        settings: dict[str, Any] = {"state_length": 365}
        pricing = (prop_row.get("type_attributes") or {}).get("pricing") or {}
        min_price = pricing.get("minPrice")
        max_price = pricing.get("maxPrice")
        if isinstance(min_price, (int, float)) and min_price > 0:
            settings["min_price"] = min_price
        if isinstance(max_price, (int, float)) and max_price > 0:
            settings["max_price"] = max_price
        attrs["settings"] = settings
        return attrs

    def _upsert_channex_room_type(
        self, db: Client, tenant_id: str, channex_property_id: str,
        property_id: str, title: str,
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
            "count_of_rooms": 1,
            "occ_adults": 4,
            "occ_children": 0,
            "occ_infants": 0,        # Channex-Pflichtfeld (live verifiziert)
            "default_occupancy": 2,
            "room_kind": "room",
        }
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
        existing_set = (
            db.table("channex_tax_map")
            .select("channex_tax_set_id")
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
                ).eq("property_id", property_id).is_("deleted_at", "null").execute()
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

    # -- Property-Mapping ------------------------------------------------------
    def list_property_maps(self, ctx: AuthContext) -> PropertyMapListResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # Vor dem Lesen Channex→DB spiegeln (Channex = Quelle der Wahrheit).
        # Non-blocking: ein Channex-Ausfall darf die Seite NIE scheitern lassen
        # — dann zeigen wir den letzten DB-Stand.
        try:
            self.reconcile_properties_for_tenant(tenant_id)
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "reconcile_on_pageview_failed", tenant_id=tenant_id, error=str(exc)
            )

        res = (
            db.table("channex_property_map")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        )
        rows = res.data or []
        # Objekt-Titel nachladen (für die UI; ersetzt die interne Provider-ID).
        # titles enthält NUR noch existierende Properties dieses Tenants.
        titles = self._property_titles(db, tenant_id, [r["property_id"] for r in rows])

        # Lokale Waise (Property gelöscht, Map blieb stehen) → ausblenden + soft-
        # löschen. Die Channex-Seite des Abgleichs erledigt der Reconcile oben.
        orphan_ids = [r["id"] for r in rows if r["property_id"] not in titles]
        if orphan_ids:
            db.table("channex_property_map").update(
                {"deleted_at": datetime.now(UTC).isoformat(), "sync_enabled": False}
            ).in_("id", orphan_ids).eq("tenant_id", tenant_id).execute()
            log.info(
                "channex_property_map_orphans_pruned",
                tenant_id=tenant_id,
                count=len(orphan_ids),
            )

        orphan_set = set(orphan_ids)
        items = [
            self._to_property_map(r, titles[r["property_id"]])
            for r in rows
            if r["id"] not in orphan_set
        ]
        return PropertyMapListResponse(items=items, total=len(items))

    # -- Channex→DB Spiegelung (1:1-Reconcile, Channex = Quelle der Wahrheit) ---
    def _tenant_group_id(self, db: Client, tenant_id: str) -> str | None:
        """channex_group_id des Tenants (oder None). Non-raising — anders als
        _require_group, das beim Channel-Create einen 409 wirft."""
        res = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return res.data[0]["channex_group_id"] if res.data else None

    def _live_channex_properties_for_group(
        self, group_id: str
    ) -> list[dict[str, Any]] | None:
        """Alle Channex-Property-Objekte (id + attributes) EINER Group über alle
        Seiten. Gibt None zurück, wenn Channex nicht erreichbar/konfiguriert ist
        — der Aufrufer ändert dann NICHTS (kein Datenverlust bei Ausfall)."""
        if not self._channex.is_configured:
            return None
        out: list[dict[str, Any]] = []
        page = 1
        try:
            while True:
                resp = self._channex.list_properties(
                    page=page, limit=100, group_id=group_id
                )
                data = resp.get("data") or []
                out.extend(data)
                # Channex paginiert über total/limit/page (kein total_pages).
                meta = resp.get("meta") or {}
                total = meta.get("total") or 0
                limit = meta.get("limit") or 100
                if not data or page * limit >= total:
                    break
                page += 1
        except ChannexError as exc:
            log.warning(
                "channex_list_group_properties_failed",
                group_id=group_id,
                error=exc.message,
            )
            return None
        return out

    @staticmethod
    def _channex_attrs_to_property_row(
        attrs: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Channex-Property-Attribute → properties-Spalten (invers zu
        _property_attrs). title ist NOT NULL → fehlt es, gibt None zurück
        (Property überspringen, KEIN Titel erfinden). Optionale Felder nur, wenn
        Channex sie liefert; sonst NULL/DB-Default (kein Fallback raten).
        property_type wird bewusst NICHT übernommen — Channex-Werte (apartment,
        hotel, …) entsprechen nicht dem lokalen property_type-Enum."""
        title = attrs.get("title")
        if not title or not str(title).strip():
            return None
        row: dict[str, Any] = {"title": str(title).strip()}
        if attrs.get("address"):
            row["address"] = attrs["address"]
        if attrs.get("city"):
            row["city"] = attrs["city"]
        if attrs.get("zip_code"):
            row["postal_code"] = attrs["zip_code"]
        if attrs.get("country"):
            row["country"] = attrs["country"]
        if attrs.get("latitude") is not None:
            row["lat"] = attrs["latitude"]
        if attrs.get("longitude") is not None:
            row["lng"] = attrs["longitude"]
        content = attrs.get("content") or {}
        if content.get("description"):
            row["description"] = content["description"]
        return row

    def reconcile_properties_for_tenant(self, tenant_id: str) -> dict[str, int]:
        """Spiegelt Channex→DB für EINEN Tenant (Channex = Wahrheit). Idempotent
        über channex_property_id. Channex-Ausfall → keine Änderung. Spiegelt
        Existenz UND Inhalte (Titel/Adresse/Koordinaten); lokale-nur-Felder
        (Fotos, Ausstattung, Preise, max_guests, status) bleiben unberührt."""
        zero = {"created": 0, "updated": 0, "soft_deleted": 0, "skipped": 0}
        if not self._channex.is_configured or self._db is None:
            return zero
        db = self._db

        group_id = self._tenant_group_id(db, tenant_id)
        if not group_id:
            return zero

        live = self._live_channex_properties_for_group(group_id)
        if live is None:
            return zero  # Channex nicht erreichbar → NICHTS anlegen/löschen.
        live_by_id = {
            p["id"]: (p.get("attributes") or {}) for p in live if p.get("id")
        }

        # Aktive Maps des Tenants.
        active = (
            db.table("channex_property_map")
            .select("id, property_id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        active_by_channex = {m["channex_property_id"]: m for m in active}

        now = datetime.now(UTC).isoformat()
        created = updated = soft_deleted = skipped = 0

        for channex_id, attrs in live_by_id.items():
            row = self._channex_attrs_to_property_row(attrs)
            if row is None:
                log.warning(
                    "reconcile_skip_no_title",
                    tenant_id=tenant_id,
                    channex_property_id=channex_id,
                )
                skipped += 1
                continue

            existing = active_by_channex.get(channex_id)
            if existing:
                # Inhalte spiegeln (nur die von Channex gelieferten Felder).
                db.table("properties").update(row).eq(
                    "id", existing["property_id"]
                ).eq("tenant_id", tenant_id).execute()
                db.table("channex_property_map").update(
                    {"last_sync_at": now, "last_sync_status": "ok"}
                ).eq("id", existing["id"]).execute()
                updated += 1
                continue

            # Kein aktives Mapping → evtl. soft-gelöschtes mit lebender Property
            # reaktivieren, sonst neu anlegen.
            soft = (
                db.table("channex_property_map")
                .select("id, property_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_property_id", channex_id)
                .not_.is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            reuse_property_id = None
            if soft:
                prop = (
                    db.table("properties")
                    .select("id")
                    .eq("id", soft[0]["property_id"])
                    .eq("tenant_id", tenant_id)
                    .limit(1)
                    .execute()
                ).data
                if prop:
                    reuse_property_id = prop[0]["id"]

            if reuse_property_id:
                db.table("properties").update(row).eq(
                    "id", reuse_property_id
                ).eq("tenant_id", tenant_id).execute()
                property_id = reuse_property_id
            else:
                row["tenant_id"] = tenant_id
                ins = db.table("properties").insert(row).execute()
                if not ins.data:
                    log.error(
                        "reconcile_property_insert_failed",
                        tenant_id=tenant_id,
                        channex_property_id=channex_id,
                    )
                    skipped += 1
                    continue
                property_id = ins.data[0]["id"]

            db.table("channex_property_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "channex_property_id": channex_id,
                    "sync_enabled": True,
                    "last_sync_status": "ok",
                    "last_sync_at": now,
                    "deleted_at": None,
                },
                on_conflict="channex_property_id",
            ).execute()
            created += 1
            log.info(
                "reconcile_property_created",
                tenant_id=tenant_id,
                channex_property_id=channex_id,
            )

        # Channex-Property weg → Map soft-löschen.
        orphan_ids = [
            m["id"] for m in active if m["channex_property_id"] not in live_by_id
        ]
        if orphan_ids:
            db.table("channex_property_map").update(
                {"deleted_at": now, "sync_enabled": False}
            ).in_("id", orphan_ids).eq("tenant_id", tenant_id).execute()
            soft_deleted = len(orphan_ids)
            log.info(
                "reconcile_maps_soft_deleted",
                tenant_id=tenant_id,
                count=soft_deleted,
            )

        return {
            "created": created,
            "updated": updated,
            "soft_deleted": soft_deleted,
            "skipped": skipped,
        }

    def reconcile_all_tenants(self) -> dict[str, Any]:
        """Iteriert ALLE Tenants aus channex_group_map und spiegelt jeden einzeln.
        Ein Fehler pro Tenant bricht den Gesamtlauf nicht ab. Für den Cron."""
        totals: dict[str, Any] = {
            "tenants": 0,
            "created": 0,
            "updated": 0,
            "soft_deleted": 0,
            "skipped": 0,
            "errors": [],
        }
        if not self._channex.is_configured or self._db is None:
            return totals
        rows = (
            self._db.table("channex_group_map").select("tenant_id").execute()
        ).data or []
        for r in rows:
            tid = r["tenant_id"]
            try:
                res = self.reconcile_properties_for_tenant(tid)
                totals["tenants"] += 1
                for k in ("created", "updated", "soft_deleted", "skipped"):
                    totals[k] += res[k]
                # ARI laufend nachziehen: Preise/Verfügbarkeit/stop_sell je aktiver
                # Property dieses Tenants (idempotent; Fehler pro Property isoliert).
                active = (
                    self._db.table("channex_property_map")
                    .select("channex_property_id")
                    .eq("tenant_id", tid)
                    .is_("deleted_at", "null")
                    .execute()
                ).data or []
                for pm in active:
                    try:
                        self.import_ari_for_property(tid, pm["channex_property_id"])
                    except Exception as exc:  # noqa: BLE001
                        log.error(
                            "reconcile_ari_failed",
                            tenant_id=tid,
                            channex_property_id=pm["channex_property_id"],
                            error=str(exc),
                        )
            except Exception as exc:  # noqa: BLE001 — ein Tenant darf nicht killen
                totals["errors"].append(f"{tid}: {exc}")
                log.error("reconcile_tenant_failed", tenant_id=tid, error=str(exc))
        # Offene Verfügbarkeits-Pushes (ari_outbox) erneut versuchen (Retry).
        try:
            totals["ari_outbox"] = self.process_ari_outbox()
        except Exception as exc:  # noqa: BLE001
            log.error("ari_outbox_run_failed", error=str(exc))
        log.info(
            "reconcile_all_done",
            tenants=totals["tenants"],
            created=totals["created"],
            updated=totals["updated"],
            soft_deleted=totals["soft_deleted"],
            skipped=totals["skipped"],
        )
        return totals

    def _property_titles(
        self, db: Client, tenant_id: str, property_ids: list[str]
    ) -> dict[str, str]:
        if not property_ids:
            return {}
        res = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", property_ids)
            .execute()
        )
        return {r["id"]: r.get("title") for r in (res.data or [])}

    def connect_property(
        self, ctx: AuthContext, req: PropertyConnectRequest
    ) -> PropertyMapResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # Property muss dem Tenant gehören (Schutz vor Fremd-Referenzen).
        prop = (
            db.table("properties")
            .select("id, title, currency")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ChannelManagerError("Property nicht gefunden.", status_code=404)
        local = prop.data[0]

        channex_id = req.external_property_ref
        if not channex_id:
            # Neu in Channex anlegen.
            attributes = {
                "title": req.title or local.get("title") or "Unbenannt",
                "currency": (req.currency or local.get("currency") or "EUR").upper(),
            }
            try:
                created = self._channex.create_property(attributes)
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            channex_id = (created.get("data") or {}).get("id")
            if not channex_id:
                raise ChannelManagerError(
                    "Channex lieferte keine Property-ID zurück.", status_code=502
                )

        row = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "channex_property_id": channex_id,
            "sync_enabled": True,
            "last_sync_status": "ok",
        }
        saved = (
            db.table("channex_property_map")
            .upsert(row, on_conflict="channex_property_id")
            .execute()
        )
        if not saved.data:
            raise ChannelManagerError("Mapping konnte nicht gespeichert werden.", status_code=500)
        return self._to_property_map(saved.data[0])

    def disconnect_property(self, ctx: AuthContext, map_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        db.table("channex_property_map").update(
            {"deleted_at": datetime.now(UTC).isoformat(), "sync_enabled": False}
        ).eq("id", map_id).eq("tenant_id", tenant_id).execute()

    # -- ARI-Push --------------------------------------------------------------
    def push_ari(self, ctx: AuthContext, req: AriPushRequest) -> AriPushResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        warnings: list[str] = []

        # Verfügbarkeit: room_type_map_id → (channex_property_id, channex_room_type_id)
        avail_values: list[dict[str, Any]] = []
        for upd in req.availability:
            mapping = self._room_type_mapping(db, tenant_id, upd.room_type_map_id)
            if mapping is None:
                warnings.append(f"Room-Type-Mapping {upd.room_type_map_id} unbekannt.")
                continue
            avail_values.append(
                {
                    "property_id": mapping["channex_property_id"],
                    "room_type_id": mapping["channex_room_type_id"],
                    "date_from": upd.date_from.isoformat(),
                    "date_to": upd.date_to.isoformat(),
                    "availability": upd.availability,
                }
            )

        # Preise/Restriktionen: rate_plan_map_id → (channex_property_id, channex_rate_plan_id)
        rate_values: list[dict[str, Any]] = []
        for upd in req.rates:
            mapping = self._rate_plan_mapping(db, tenant_id, upd.rate_plan_map_id)
            if mapping is None:
                warnings.append(f"Rate-Plan-Mapping {upd.rate_plan_map_id} unbekannt.")
                continue
            value: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "date_from": upd.date_from.isoformat(),
                "date_to": upd.date_to.isoformat(),
            }
            if upd.rate_cents is not None:
                value["rate"] = upd.rate_cents  # Cent-Integer
            if upd.min_stay_arrival is not None:
                value["min_stay_arrival"] = upd.min_stay_arrival
            if upd.stop_sell is not None:
                value["stop_sell"] = 1 if upd.stop_sell else 0
            rate_values.append(value)

        avail_tasks = rate_tasks = 0
        try:
            # Availability getrennt senden (Channex-Priorität), dann Preise.
            if avail_values:
                res_a = self._channex.update_availability(avail_values)
                avail_tasks = len(res_a.get("data") or [])
                warnings += list((res_a.get("meta") or {}).get("warnings") or [])
            if rate_values:
                res_r = self._channex.update_restrictions(rate_values)
                rate_tasks = len(res_r.get("data") or [])
                warnings += list((res_r.get("meta") or {}).get("warnings") or [])
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        return AriPushResponse(
            availability_tasks=avail_tasks,
            rate_tasks=rate_tasks,
            warnings=[str(w) for w in warnings],
        )

    # -- Realtime-Verfügbarkeits-Push (Doppelbuchungsschutz) -------------------
    # Der Buchungskalender (availability) ist die oberste Wahrheit. Jede lokale
    # Änderung pusht SOFORT die Channex-Verfügbarkeit, damit OTAs den Tag nicht
    # mehr/wieder verkaufen. Persistiert in ari_outbox (Retry bei Ausfall).
    def _resolve_channex_room_type(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_room_type_id). Synthetisch
        1 Room-Type je Property (local_unit_ref = property_id). None, wenn nicht
        mit Channex verbunden."""
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rt:
            return None
        return {
            "channex_property_id": pm[0]["channex_property_id"],
            "channex_room_type_id": rt[0]["channex_room_type_id"],
        }

    def push_availability_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        availability: int,
    ) -> None:
        """Verfügbarkeit (absolute Menge je Tag) für einen Zeitraum an Channex
        pushen. date_to inklusiv. Persistiert in ari_outbox und versucht den
        Sofort-Push; bei Fehler bleibt die Zeile 'pending' (Cron-Retry). No-op,
        wenn Channex nicht konfiguriert oder die Property nicht verbunden ist."""
        if not self._channex.is_configured or self._db is None:
            return
        db = self._db
        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None:
            return  # nicht mit Channex verbunden → nichts zu pushen

        outbox = (
            db.table("ari_outbox")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "date_from": date_from.isoformat(),
                    "date_to": date_to.isoformat(),
                    "availability": availability,
                    "status": "pending",
                }
            )
            .execute()
        ).data
        outbox_id = outbox[0]["id"] if outbox else None

        try:
            self._channex.update_availability(
                [
                    {
                        "property_id": mapping["channex_property_id"],
                        "room_type_id": mapping["channex_room_type_id"],
                        "date_from": date_from.isoformat(),
                        "date_to": date_to.isoformat(),
                        "availability": availability,
                    }
                ]
            )
            if outbox_id:
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": 1}
                ).eq("id", outbox_id).execute()
            log.info(
                "ari_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                availability=availability,
            )
        except ChannexError as exc:
            if outbox_id:
                db.table("ari_outbox").update(
                    {"attempts": 1, "last_error": exc.message}
                ).eq("id", outbox_id).execute()
            log.warning(
                "ari_push_failed_queued",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    def _resolve_channex_rate_plan(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_rate_plan_id) über die
        synthetische Room-Type/Rate-Plan-Kette. None, wenn nicht verbunden."""
        rt = self._resolve_channex_room_type(db, tenant_id, property_id)
        if rt is None:
            return None
        # Rate-Plan-Map über die Room-Type-Map dieser Property.
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rtm = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rtm:
            return None
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("room_type_map_id", rtm[0]["id"])
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rp:
            return None
        return {
            "channex_property_id": rt["channex_property_id"],
            "channex_rate_plan_id": rp[0]["channex_rate_plan_id"],
        }

    def push_rate_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        rate_cents: int | None = None,
        *,
        min_stay: int | None = None,
    ) -> None:
        """Preis und/oder Mindestaufenthalt für einen Zeitraum an Channex pushen
        (Restrictions). Mindestens eines von rate_cents/min_stay setzen.
        Best-effort: bei Fehler loggen — der reconcile-Cron gleicht ohnehin ab.
        No-op, wenn nicht mit Channex verbunden. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return
        if rate_cents is None and min_stay is None:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        value: dict[str, Any] = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
        }
        if rate_cents is not None:
            value["rate"] = rate_cents
        if min_stay is not None:
            value["min_stay_arrival"] = min_stay
            value["min_stay_through"] = min_stay
        try:
            self._channex.update_restrictions([value])
            log.info(
                "restriction_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                rate_cents=rate_cents,
                min_stay=min_stay,
            )
        except ChannexError as exc:
            log.warning(
                "restriction_push_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    # Channex akzeptiert viele Werte je Restrictions-Request; wir chunken
    # defensiv, damit ein Push über den vollen Horizont 1–wenige Requests ist
    # statt hunderter Einzel-Requests (sonst 429-Flut, siehe Channex-Skill:
    # „batch via ranges, hundreds of small requests per minute is abuse-shaped").
    _RESTRICTIONS_CHUNK = 500

    def push_rates_batch(
        self,
        tenant_id: str,
        property_id: str,
        segments: list[dict[str, Any]],
    ) -> None:
        """Mehrere Preis-/Min-Stay-Intervalle eines Objekts in EINEM (bzw. wenigen
        gechunkten) Channex-Restrictions-Request pushen.

        `segments` = Liste von {date_from, date_to (inkl.), rate_cents?, min_stay?}.
        Das Channex-Mapping wird nur EINMAL aufgelöst (statt pro Intervall).
        Best-effort: bei Fehler loggen — der reconcile-Cron gleicht ab.
        No-op, wenn nicht verbunden oder keine Segmente."""
        if not self._channex.is_configured or self._db is None or not segments:
            return
        mapping = self._resolve_channex_rate_plan(self._db, tenant_id, property_id)
        if mapping is None:
            return
        values: list[dict[str, Any]] = []
        for seg in segments:
            rate_cents = seg.get("rate_cents")
            min_stay = seg.get("min_stay")
            if rate_cents is None and min_stay is None:
                continue
            value: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "date_from": seg["date_from"].isoformat(),
                "date_to": seg["date_to"].isoformat(),
            }
            if rate_cents is not None:
                value["rate"] = rate_cents
            if min_stay is not None:
                value["min_stay_arrival"] = min_stay
                value["min_stay_through"] = min_stay
            values.append(value)
        if not values:
            return
        pushed = 0
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                chunk = values[i : i + self._RESTRICTIONS_CHUNK]
                self._channex.update_restrictions(chunk)
                pushed += len(chunk)
            log.info(
                "restriction_push_batch_done",
                tenant_id=tenant_id,
                property_id=property_id,
                intervals=pushed,
            )
        except ChannexError as exc:
            log.warning(
                "restriction_push_batch_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    def process_ari_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_outbox-Zeilen erneut an Channex pushen (Cron-Retry).
        Idempotent (absoluter Set-Wert je Tag)."""
        result = {"processed": 0, "done": 0, "failed": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        rows = (
            db.table("ari_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
        for r in rows:
            result["processed"] += 1
            mapping = self._resolve_channex_room_type(
                db, r["tenant_id"], r["property_id"]
            )
            if mapping is None:
                db.table("ari_outbox").update(
                    {"status": "failed", "last_error": "kein Channex-Mapping"}
                ).eq("id", r["id"]).execute()
                result["failed"] += 1
                continue
            try:
                self._channex.update_availability(
                    [
                        {
                            "property_id": mapping["channex_property_id"],
                            "room_type_id": mapping["channex_room_type_id"],
                            "date_from": r["date_from"],
                            "date_to": r["date_to"],
                            "availability": r["availability"],
                        }
                    ]
                )
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": (r["attempts"] or 0) + 1}
                ).eq("id", r["id"]).execute()
                result["done"] += 1
            except ChannexError as exc:
                attempts = (r["attempts"] or 0) + 1
                # Nach 10 Versuchen aufgeben (failed), sonst weiter pending.
                new_status = "failed" if attempts >= 10 else "pending"
                db.table("ari_outbox").update(
                    {"status": new_status, "attempts": attempts, "last_error": exc.message}
                ).eq("id", r["id"]).execute()
                if new_status == "failed":
                    result["failed"] += 1
        if result["processed"]:
            log.info("ari_outbox_processed", **result)
        return result

    # -- Bookings: Feed-Pull + Ack --------------------------------------------
    def sync_bookings(self, ctx: AuthContext) -> BookingSyncResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        result = BookingSyncResponse()

        # KRITISCH (Mandantentrennung): Der Revisions-Feed ist KONTOWEIT — er
        # enthält die Buchungen ALLER Tenants. Wir dürfen ausschließlich
        # Revisionen verarbeiten, deren property_id zu DIESEM Tenant gehört.
        # Fremde Revisionen werden übersprungen und NICHT ge-ackt (damit der
        # zuständige Tenant sie noch aus dem Feed bekommt).
        own_property_ids = self._tenant_channex_property_ids(db, tenant_id)

        try:
            feed = self._channex.get_booking_revisions_feed()
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        revisions = feed.get("data") or []
        result.fetched = len(revisions)

        # Fehler lokal sammeln und am Ende einmalig zuweisen — Pylint erkennt
        # das Pydantic-Field sonst statisch als FieldInfo (ohne .append).
        errors: list[str] = []
        for rev in revisions:
            attrs = rev.get("attributes") or rev
            revision_id = rev.get("id") or attrs.get("revision_id")
            rev_property_id = attrs.get("property_id")

            # Gehört diese Revision diesem Tenant? Sonst überspringen (kein ack!).
            if rev_property_id not in own_property_ids:
                result.skipped += 1
                continue

            try:
                guest_id = self._upsert_booking(db, tenant_id, attrs, revision_id)
                # In die zentrale reservations-Tabelle + Kalender projizieren.
                self._project_booking_to_reservation(db, tenant_id, attrs, guest_id)
                result.saved += 1
                if revision_id:
                    self._channex.ack_booking_revision(revision_id)
                    result.acknowledged += 1
            except (ChannexError, ChannelManagerError) as exc:
                msg = getattr(exc, "message", str(exc))
                errors.append(f"Revision {revision_id}: {msg}")
                log.error("channex_booking_sync_failed", revision=revision_id, error=msg)

        result.errors = errors
        return result

    # -- Kanäle (OTA) inhouse: Channel-API nach Skill --------------------------
    # White-label: der interne Channel-Code (z.B. "BookingCom") wird dem Kunden
    # nie erklärt; angezeigt wird nur der menschliche Name (label). Die Portal-
    # Felder kommen LIVE aus /channels/list (params, nicht-`hidden`) — nicht raten.
    # Welche Portale wir anbieten (kuratiert; menschliche Labels + Icons):
    _PORTAL_CATALOG: list[dict[str, str]] = [
        {"code": "BookingCom", "label": "Booking.com", "icon": "simple-icons:bookingdotcom"},
        {"code": "AirBNB", "label": "Airbnb", "icon": "simple-icons:airbnb"},
        {"code": "Expedia", "label": "Expedia", "icon": "simple-icons:expedia"},
        {"code": "VRBO", "label": "Vrbo", "icon": "ph:house"},
    ]
    # Sandbox-Testkanal (NUR wenn channex_sandbox_portals=True): OpenChannel ruft
    # UNSEREN Mock-OTA-Endpoint (sandbox_ota.py) auf → kompletter Connect-Flow
    # ohne echtes OTA-Konto. endpoint/hotel_code/api_key setzt der Service selbst.
    _SANDBOX_CODE = "OpenChannel"
    _SANDBOX_CATALOG: list[dict[str, str]] = [
        {"code": _SANDBOX_CODE, "label": "Testkanal (Sandbox)", "icon": "ph:flask"},
    ]

    def _portal_catalog(self) -> list[dict[str, str]]:
        """Sichtbare Portale — im Sandbox-Modus inkl. Test-Kanäle."""
        from src.core.config import get_settings

        catalog = list(self._PORTAL_CATALOG)
        if get_settings().channex_sandbox_portals:
            catalog = catalog + self._SANDBOX_CATALOG
        return catalog

    @property
    def _portal_labels(self) -> dict[str, str]:
        return {p["code"]: p["label"] for p in self._portal_catalog()}

    def list_supported_portals(self) -> list[dict[str, Any]]:
        """Verbindbare Portale + die Eingabefelder, die der Kunde ausfüllt.
        Felder werden aus dem Channex-Channel-Katalog (`params`, ohne `hidden`)
        abgeleitet — so raten wir nichts und bleiben aktuell."""
        try:
            catalog = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            catalog = []
        by_code = {c.get("code"): c for c in catalog}

        out: list[dict[str, Any]] = []
        for portal in self._portal_catalog():
            # Sandbox-Testkanal: keine Eingaben — Service setzt alles selbst.
            if portal["code"] == self._SANDBOX_CODE:
                out.append({**portal, "fields": []})
                continue
            spec = by_code.get(portal["code"]) or {}
            params = spec.get("params") or {}
            # Nur das EINE Haupt-Auth-Feld abfragen (z.B. Hotel-ID). Optionale/
            # versteckte Felder (email, notifications, payout …) lassen wir weg —
            # der Kunde soll nichts Unnötiges sehen. Heuristik: sichtbares
            # String-Feld ohne `default`/`rules`, mit der kleinsten `position`.
            essential = [
                (key, meta)
                for key, meta in params.items()
                if meta.get("type") == "string"
                and "default" not in meta
                and not meta.get("rules")
            ]
            essential.sort(key=lambda kv: kv[1].get("position", 99))
            fields = [
                {
                    "key": key,
                    "label": self._humanize_field(meta.get("title"), portal["label"]),
                    "placeholder": "",
                    "required": True,
                }
                for key, meta in essential[:1]  # nur das Hauptfeld
            ]
            out.append(
                {
                    "code": portal["code"],
                    "label": portal["label"],
                    "icon": portal["icon"],
                    "fields": fields,
                }
            )
        return out

    @staticmethod
    def _humanize_field(title: str | None, portal_label: str) -> str:
        """Channex-Feldtitel ggf. white-label machen (z.B. 'Hotel ID' →
        'Booking.com Hotel-ID'). Kein Provider-Name durchsickern lassen."""
        t = (title or "").strip() or "Wert"
        if t.lower() in ("hotel id", "hotel_id", "hotel code"):
            return f"{portal_label} Hotel-ID"
        return t

    def list_channels(self, ctx: AuthContext) -> list[dict[str, Any]]:
        """Verbundene Kanäle des Tenants (white-label)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        prop_ids = self._tenant_channex_property_ids(db, tenant_id)
        if not prop_ids:
            return []
        try:
            data = self._channex.list_channels().get("data") or []
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for ch in data:
            a = ch.get("attributes") or ch
            if not set(a.get("properties") or []).intersection(prop_ids):
                continue  # fremder Kanal — nicht dieses Tenants
            out.append(
                {
                    "id": ch.get("id") or a.get("id"),
                    "portal": self._portal_labels.get(a.get("channel"), "Kanal"),
                    "title": a.get("title"),
                    "is_active": bool(a.get("is_active")),
                }
            )
        return out

    def prepare_channel(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        settings: dict[str, Any],
    ) -> dict[str, Any]:
        """Skill-Schritte 1+2: Zugangsdaten prüfen (test_connection) und die
        OTA-seitigen Zimmer/Raten holen (mapping_details). Liefert die OTA-Zimmer
        UND unsere lokalen Rate-Plans zurück, damit die UI zuordnen kann.
        Legt NOCH NICHTS an."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._portal_labels:
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)

        # 1) Zugangsdaten prüfen. ACHTUNG (live verifiziert): Channex liefert
        #    HTTP 200 AUCH bei falschen Daten — der Erfolg steht in data.success.
        try:
            res = self._channex.test_channel_connection(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise ChannelManagerError(
                f"Zugangsdaten abgelehnt: {exc.message}", status_code=422
            ) from exc
        data = res.get("data") or {}
        if data.get("success") is False:
            errs = data.get("errors")
            detail = (
                "; ".join(str(e) for e in errs)
                if isinstance(errs, list) and errs
                else "Die Zugangsdaten konnten nicht bestätigt werden. Bitte "
                "prüfe die eingegebene Kennung."
            )
            raise ChannelManagerError(f"Zugangsdaten abgelehnt: {detail}", status_code=422)

        # 2) OTA-Zimmer/Raten lesen.
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        rooms = self._normalize_mapping_rooms(details)

        # Unsere lokalen (gemappten) Rate-Plans dieser Property anbieten.
        local_rate_plans = self._local_rate_plan_options(
            db, tenant_id, channex_property_id
        )
        return {
            "portal": self._portal_labels[portal_code],
            "ota_rooms": rooms,            # [{id, title, rates:[{id, title, …}]}]
            "rate_plans": local_rate_plans,  # [{rate_plan_map_id, title}]
        }

    @staticmethod
    def _normalize_mapping_rooms(details: dict[str, Any]) -> list[dict[str, Any]]:
        """mapping_details kommt je OTA in zwei Formen — auf eine einheitliche
        Struktur [{id, title, rates:[{id, title, pricing, max_persons}]}] bringen:
          a) Booking.com: data.rooms[].rates[]
          b) OpenChannel/„attributes": data.attributes.room_types[].rate_plans[]"""
        data = details.get("data") or {}
        if data.get("rooms"):
            out = []
            for r in data["rooms"]:
                out.append(
                    {
                        "id": r.get("id"),
                        "title": r.get("title"),
                        "rates": [
                            {
                                "id": rt.get("id"),
                                "title": rt.get("title"),
                                "pricing": rt.get("pricing"),
                                "max_persons": rt.get("max_persons"),
                                "occupancies": rt.get("occupancies") or [],
                            }
                            for rt in (r.get("rates") or [])
                        ],
                    }
                )
            return out
        # attributes.room_types[].rate_plans[]
        attrs = data.get("attributes") or {}
        out = []
        for r in attrs.get("room_types") or []:
            out.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "rates": [
                        {
                            "id": rp.get("id"),
                            "title": rp.get("title"),
                            "pricing": rp.get("sell_mode"),
                            "max_persons": rp.get("max_persons"),
                            "occupancies": [],
                        }
                        for rp in (r.get("rate_plans") or [])
                    ],
                }
            )
        return out

    def connect_channel(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        title: str | None, settings: dict[str, Any],
        mappings: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Skill-Schritte 3+4: Kanal mit Zimmer/Raten-Zuordnung anlegen und
        aktivieren. `mappings` = [{rate_plan_map_id, room_type_code(int),
        rate_plan_code(int), occupancy, pricing_type, primary_occ}]."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._portal_labels:
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)
        if not mappings:
            raise ChannelManagerError(
                "Mindestens eine Zimmer/Raten-Zuordnung ist nötig.", status_code=422
            )

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)
        group_id = self._require_group(db, tenant_id, channex_property_id)
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)
        # Echte OTAs verlangen INTEGER-Codes; OpenChannel (Sandbox) nutzt String-
        # Codes (unsere UUIDs aus mapping_details) → dort nicht zu int zwingen.
        is_sandbox = portal_code == self._SANDBOX_CODE

        # rate_plans-Array bauen: lokale Rate-Plan-Map-ID → Channex-Rate-Plan-UUID.
        seen_pairs: set[tuple[Any, Any]] = set()
        rate_plans: list[dict[str, Any]] = []
        for m in mappings:
            channex_rate_plan_id = self._channex_rate_plan_id_for_map(
                db, tenant_id, m.get("rate_plan_map_id")
            )
            if not channex_rate_plan_id:
                raise ChannelManagerError(
                    "Unbekannter Preisplan in der Zuordnung.", status_code=422
                )
            if is_sandbox:
                room_code = m.get("room_type_code")
                rate_code = m.get("rate_plan_code")
            else:
                room_code = self._as_int(m.get("room_type_code"))
                rate_code = self._as_int(m.get("rate_plan_code"))
            if room_code is None or rate_code is None:
                raise ChannelManagerError(
                    "Zimmer-/Raten-Code fehlt oder ist ungültig.", status_code=422
                )
            pair = (room_code, rate_code)
            if pair in seen_pairs:
                raise ChannelManagerError(
                    "Eine OTA-Zimmer/Raten-Kombination darf nur einmal zugeordnet "
                    "werden.", status_code=422,
                )
            seen_pairs.add(pair)
            rate_plans.append(
                {
                    "rate_plan_id": channex_rate_plan_id,
                    "settings": {
                        "room_type_code": room_code,
                        "rate_plan_code": rate_code,
                        "occupancy": self._as_int(m.get("occupancy")) or 2,
                        "pricing_type": m.get("pricing_type") or "Standard",
                        "primary_occ": bool(m.get("primary_occ", True)),
                        "readonly": bool(m.get("readonly", False)),
                    },
                }
            )

        attrs: dict[str, Any] = {
            "channel": portal_code,
            "group_id": group_id,                 # Pflicht
            "is_active": False,                    # wird inaktiv erstellt
            "title": title or self._portal_labels[portal_code],
            "properties": [channex_property_id],
            "settings": settings or {},
            "rate_plans": rate_plans,
        }
        try:
            created = self._channex.create_channel(attrs)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        channel_id = (created.get("data") or {}).get("id")
        a = (created.get("data") or {}).get("attributes") or {}
        is_active = bool(a.get("is_active"))

        # 4) Aktivieren (Kanäle starten inaktiv).
        activate_error: str | None = None
        if channel_id and not is_active:
            try:
                self._channex.activate_channel(channel_id)
                is_active = True
            except ChannexError as exc:
                # Anlegen hat geklappt — Aktivierung kann der Kunde wiederholen.
                activate_error = exc.message
                log.warning("channex_channel_activate_failed",
                            channel_id=channel_id, error=exc.message)

        # Verbindung persistieren: Hotel-ID + erzeugter Channel pro (Objekt, Portal).
        # So bleibt die Verbindung sichtbar/verwaltbar (Status, Trennen, Re-Connect)
        # und nach Reload nachvollziehbar. Persistenz-Fehler dürfen den erfolgreichen
        # Connect nicht scheitern lassen.
        self._save_channel_connection(
            db, tenant_id,
            property_id=property_id,
            channex_property_id=channex_property_id,
            portal_code=portal_code,
            settings=settings,
            channel_id=channel_id,
            is_active=is_active,
            last_error=activate_error,
        )

        # Initial-Vollimport (best effort): bestehende Buchungen, ARI/Preise,
        # Room-Types/Rate-Plans. Channel ist live; ein Import-Fehler darf den
        # Connect NICHT scheitern lassen (per Cron/erneutem Connect nachholbar).
        try:
            self.import_bookings_for_property(tenant_id, channex_property_id)
            self.import_rooms_rates_for_property(tenant_id, channex_property_id)
            self.import_ari_for_property(tenant_id, channex_property_id)
        except (ChannexError, ChannelManagerError) as exc:
            log.warning(
                "channex_initial_import_failed",
                channex_property_id=channex_property_id,
                error=getattr(exc, "message", str(exc)),
            )

        return {
            "id": channel_id,
            "portal": self._portal_labels[portal_code],
            "title": a.get("title") or title or self._portal_labels[portal_code],
            "is_active": is_active,
        }

    def _inject_sandbox_settings(
        self, portal_code: str, property_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Für den Sandbox-Kanal (OpenChannel) die settings automatisch setzen:
        endpoint = unser Mock-OTA, hotel_code = lokale property_id, api_key =
        geteiltes Secret. Der Tester gibt nichts ein."""
        if portal_code != self._SANDBOX_CODE:
            return settings
        from src.core.config import get_settings

        cfg = get_settings()
        base = (cfg.public_api_url or "").rstrip("/")
        if not base:
            raise ChannelManagerError(
                "PUBLIC_API_URL fehlt — der Sandbox-Mock braucht eine öffentliche "
                "HTTPS-URL, die Channex erreichen kann.",
                status_code=400,
            )
        # WICHTIG: endpoint muss mit '/' enden — Channex hängt test_connection/,
        # mapping_details/, changes/ direkt an.
        endpoint = f"{base}/api/v1/channel-manager/sandbox-ota/"
        return {
            "endpoint": endpoint,
            "hotel_code": property_id,
            "api_key": cfg.channex_webhook_secret.get_secret_value(),
        }

    def disconnect_channel(self, ctx: AuthContext, channel_id: str) -> None:
        """Kanal trennen: erst deaktivieren (sonst 422 'is active'), dann löschen."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        try:
            self._channex.deactivate_channel(channel_id)
        except ChannexError as exc:
            # Schon inaktiv/nicht aktivierbar → weiter zum Delete.
            log.info("channex_channel_deactivate_skip",
                     channel_id=channel_id, error=exc.message)
        try:
            self._channex.delete_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        # Persistierte Verbindung auf inaktiv setzen (der Channel existiert bei
        # Channex nicht mehr). Wir behalten die Zeile mit der Hotel-ID, damit der
        # Vermieter sie für einen Re-Connect nicht neu eingeben muss.
        db.table("channex_channel_connection").update(
            {"is_active": False, "channex_channel_id": None}
        ).eq("tenant_id", tenant_id).eq("channex_channel_id", channel_id).execute()

    # Settings-Schlüssel, unter denen die OTA-Hotel-ID je nach Portal steht.
    _HOTEL_ID_KEYS = ("hotel_id", "hotel_code", "property_id", "property_code")

    @classmethod
    def _extract_hotel_id(cls, settings: dict[str, Any]) -> str | None:
        """Hotel-ID robust aus den Connect-Settings ziehen (Schlüssel je OTA
        verschieden). Kein Fallback/Raten — None, wenn nichts Passendes da ist."""
        for key in cls._HOTEL_ID_KEYS:
            val = settings.get(key)
            if val not in (None, ""):
                return str(val)
        return None

    def _save_channel_connection(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, settings: dict[str, Any],
        channel_id: str | None, is_active: bool, last_error: str | None,
    ) -> None:
        """Upsert der OTA-Verbindung pro (Objekt, Portal). Best-effort: ein
        Persistenz-Fehler darf den erfolgreichen Connect nicht scheitern lassen."""
        hotel_id = self._extract_hotel_id(settings)
        if not hotel_id:
            # Ohne Hotel-ID gibt es nichts Sinnvolles zu speichern (kein Raten).
            log.warning(
                "channex_connection_no_hotel_id",
                property_id=property_id, portal_code=portal_code,
            )
            return
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_property_id,
            "ota_portal_code": portal_code,
            "ota_hotel_id": hotel_id,
            "channex_channel_id": channel_id,
            "is_active": is_active,
            "last_error": last_error,
        }
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict="property_id,ota_portal_code"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz darf Connect nicht killen
            log.warning(
                "channex_connection_persist_failed",
                property_id=property_id, portal_code=portal_code, error=str(exc),
            )

    def list_channel_connections(
        self, ctx: AuthContext, property_id: str
    ) -> list[dict[str, Any]]:
        """Gespeicherte OTA-Verbindungen eines Objekts (white-label).

        Liefert nur Portal-Label, Hotel-ID und Status — keine rohen Credentials,
        kein Provider-Branding."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        res = (
            db.table("channex_channel_connection")
            .select(
                "ota_portal_code, ota_hotel_id, channex_channel_id, "
                "is_active, last_error, updated_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        )
        out: list[dict[str, Any]] = []
        for r in res.data or []:
            code = r.get("ota_portal_code")
            out.append(
                {
                    "portal_code": code,
                    "portal": self._portal_labels.get(code, "Kanal"),
                    "hotel_id": r.get("ota_hotel_id"),
                    "channel_id": r.get("channex_channel_id"),
                    "is_active": bool(r.get("is_active")),
                    "last_error": r.get("last_error"),
                    "updated_at": r.get("updated_at"),
                }
            )
        return out

    # -- Channel-Hilfen --------------------------------------------------------
    def _tenant_channex_property_ids(self, db: Client, tenant_id: str) -> set[str]:
        maps = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return {m["channex_property_id"] for m in (maps.data or [])}

    def _require_property_mapping(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str:
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not pm.data:
            raise ChannelManagerError(
                "Objekt ist noch nicht mit dem Channel-Manager verbunden.",
                status_code=409,
            )
        return pm.data[0]["channex_property_id"]

    def _require_group(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> str:
        """group_id für den Channel-Create (Pflicht). Bevorzugt die Tenant-Group;
        fällt sonst auf die Group zurück, die diese Property bei Channex besitzt."""
        grp = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if grp.data:
            return grp.data[0]["channex_group_id"]
        # Fallback: Group ermitteln, die die Property enthält.
        try:
            for g in self._channex.list_groups().get("data") or []:
                rel = (g.get("relationships") or {}).get("properties") or {}
                ids = {p.get("id") for p in (rel.get("data") or [])}
                if channex_property_id in ids:
                    return g.get("id")
        except ChannexError:
            pass
        raise ChannelManagerError(
            "Keine Channex-Gruppe für dieses Konto gefunden.", status_code=409
        )

    def _local_rate_plan_options(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> list[dict[str, Any]]:
        """Gemappte Rate-Plans dieser Property (für die Zuordnungs-Auswahl)."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .limit(1)
            .execute()
        )
        if not pm.data:
            return []
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm.data[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        )
        rt_ids = [r["id"] for r in (rts.data or [])]
        if not rt_ids:
            return []
        rps = (
            db.table("channex_rate_plan_map")
            .select("id, title")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .execute()
        )
        return [
            {"rate_plan_map_id": r["id"], "title": r.get("title") or "Preisplan"}
            for r in (rps.data or [])
        ]

    def _channex_rate_plan_id_for_map(
        self, db: Client, tenant_id: str, rate_plan_map_id: str | None
    ) -> str | None:
        if not rate_plan_map_id:
            return None
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("id", rate_plan_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return rp.data[0]["channex_rate_plan_id"] if rp.data else None

    @staticmethod
    def _as_int(value: object) -> int | None:
        """OTA-Codes MÜSSEN als Integer gesendet werden (Strings → 'Not mapped')."""
        if value is None or isinstance(value, bool):
            return None
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    # -- Webhook-Registrierung bei Channex (Admin) -----------------------------
    # 'message' liefert Push bei neuen Gäste-Nachrichten (Posteingang). Der
    # Handler nutzt es nur als Trigger; den Verlauf zieht der Posteingang live.
    _WEBHOOK_EVENTS = (
        "ari;booking_new;booking_modification;booking_cancellation;message"
    )

    def register_global_webhook(self, *, callback_url: str) -> dict[str, Any]:
        """Registriert (idempotent) EINEN globalen Webhook bei Channex, der alle
        Buchungs-/ARI-Events an unseren Callback schickt. Vorhandene globale
        Webhooks mit derselben callback_url werden vorher entfernt (kein Dup)."""
        from src.core.config import get_settings

        secret = get_settings().channex_webhook_secret.get_secret_value()
        if not secret:
            raise ChannelManagerError(
                "CHANNEX_WEBHOOK_SECRET fehlt — ohne Secret kein Webhook.",
                status_code=400,
            )
        try:
            # Vorhandene gleiche Callback-URL aufräumen (idempotent).
            existing = self._channex.list_webhooks().get("data") or []
            for wh in existing:
                attrs = wh.get("attributes") or wh
                if attrs.get("callback_url") == callback_url:
                    self._channex.delete_webhook(wh.get("id") or attrs.get("id"))

            created = self._channex.create_webhook(
                {
                    "callback_url": callback_url,
                    "event_mask": self._WEBHOOK_EVENTS,
                    "property_id": None,
                    "is_global": True,
                    "is_active": True,
                    "send_data": True,
                    "headers": {"X-Channex-Webhook-Secret": secret},
                }
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return created.get("data") or {}

    def list_registered_webhooks(self) -> list[dict[str, Any]]:
        try:
            data = self._channex.list_webhooks().get("data") or []
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for wh in data:
            attrs = wh.get("attributes") or wh
            out.append(
                {
                    "id": wh.get("id") or attrs.get("id"),
                    "callback_url": attrs.get("callback_url"),
                    "event_mask": attrs.get("event_mask"),
                    "is_global": bool(attrs.get("is_global")),
                    "is_active": bool(attrs.get("is_active", True)),
                }
            )
        return out

    def ingest_webhook(self, payload: dict[str, Any]) -> dict[str, str]:
        """Webhook von Channex verarbeiten. Wir nutzen das Event nur als TRIGGER
        und ziehen den aktuellen Stand (Channex garantiert keine Reihenfolge)."""
        event = payload.get("event", "unknown")
        # 'event' ist bei structlog für die Message reserviert → eigenes Feld.
        log.info("channex_webhook", webhook_event=event, property=payload.get("property_id"))
        # Verarbeitung (Feed-Pull) erfolgt durch den regulären sync_bookings-Lauf
        # bzw. einen Worker; hier nur Annahme bestätigen.
        return {"status": "accepted", "event": event}

    def list_bookings(self, ctx: AuthContext) -> BookingListResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        res = (
            db.table("channex_booking")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("arrival_date", desc=True)
            .limit(200)
            .execute()
        )
        items = [self._to_booking(r) for r in (res.data or [])]
        return BookingListResponse(items=items, total=len(items))

    # -- DB-Mapping-Lookups ----------------------------------------------------
    def _room_type_mapping(
        self, db: Client, tenant_id: str, room_type_map_id: str
    ) -> dict[str, str] | None:
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id, property_map_id")
            .eq("id", room_type_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_room_type_id": rt.data[0]["channex_room_type_id"],
        }

    def _rate_plan_mapping(
        self, db: Client, tenant_id: str, rate_plan_map_id: str
    ) -> dict[str, str] | None:
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id, room_type_map_id")
            .eq("id", rate_plan_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rp.data:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("property_map_id")
            .eq("id", rp.data[0]["room_type_map_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_rate_plan_id": rp.data[0]["channex_rate_plan_id"],
        }

    def _channex_property_id(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> str | None:
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("id", property_map_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return pm.data[0]["channex_property_id"] if pm.data else None

    def _upsert_booking(
        self, db: Client, tenant_id: str, attrs: dict[str, Any], revision_id: str | None
    ) -> str | None:
        """Staging-Zeile schreiben + Gast über den zentralen Resolver verknüpfen.

        Gibt die guest_id zurück, damit die Reservierungs-Projektion denselben
        Gast nutzt (ein Resolve pro Buchung, kein Doppel-Matching)."""
        channex_booking_id = attrs.get("booking_id") or attrs.get("id")
        if not channex_booking_id:
            raise ChannelManagerError("Buchung ohne ID übersprungen.", status_code=422)

        # Zentraler Resolver: ein Pfad für alle Kanäle (E-Mail→Telefon→OTA-ID).
        guest_id = resolve_or_create_guest(
            db,
            tenant_id,
            contact_from_ota_customer(
                attrs.get("customer") or {},
                external_ref=attrs.get("ota_reservation_code"),
            ),
        )

        amount = attrs.get("amount")
        amount_cents = self._to_cents(amount)
        row = {
            "tenant_id": tenant_id,
            "channex_booking_id": channex_booking_id,
            "revision_id": revision_id,
            "system_id": attrs.get("system_id"),
            "ota_name": attrs.get("ota_name"),
            "ota_reservation_code": attrs.get("ota_reservation_code"),
            "status": attrs.get("status") or "new",
            "arrival_date": attrs.get("arrival_date"),
            "departure_date": attrs.get("departure_date"),
            "amount_cents": amount_cents,
            "currency": attrs.get("currency"),
            "customer": attrs.get("customer") or {},
            "guest_id": guest_id,  # direkter Thread→Gast-Link (Inbox/Gästekarte)
            "raw": attrs,
        }
        db.table("channex_booking").upsert(
            row, on_conflict="channex_booking_id"
        ).execute()
        return guest_id

    # -- Import Channex → zentrale reservations / availability / Preise --------
    # OTA-Buchungen landen nicht nur als Staging (channex_booking), sondern werden
    # in die zentrale reservations-Tabelle projiziert + im Kalender als belegt
    # gesperrt. Channex = Quelle der Wahrheit. KEINE Fallback-Werte: fehlt eine
    # Pflichtangabe, wird die Buchung übersprungen und geloggt.

    # OTA-Name → reservation_channel-Enum. Der Enum kennt nur diese Werte; andere
    # OTAs (Expedia, Agoda, …) laufen auf 'portal', ihr echter Name bleibt in
    # reservations.ota_name erhalten (für Kalender-Anzeige + Posteingang).
    _OTA_CHANNEL_MAP = {
        "booking.com": "booking",
        "airbnb": "airbnb",
        "vrbo": "vrbo",
    }

    @classmethod
    def _ota_name_to_channel(cls, ota_name: str | None) -> str:
        if not ota_name:
            return "portal"
        return cls._OTA_CHANNEL_MAP.get(ota_name.strip().lower(), "portal")

    def _resolve_local_property(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> str | None:
        """channex_property_id → lokale property_id (aktives Mapping, tenant-scoped)."""
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return pm.data[0]["property_id"] if pm.data else None

    @staticmethod
    def _date_range_nights(check_in: str, check_out: str) -> list[str]:
        """Belegte Nächte [check_in, check_out) als ISO-Datumsliste (Abreisetag
        exklusiv)."""
        start = date.fromisoformat(check_in)
        end = date.fromisoformat(check_out)
        out: list[str] = []
        cur = start
        while cur < end:
            out.append(cur.isoformat())
            cur += timedelta(days=1)
        return out

    def _set_availability(
        self,
        db: Client,
        property_id: str,
        days: list[str],
        *,
        status: str,
        source: str,
    ) -> None:
        for d in days:
            db.table("availability").upsert(
                {
                    "property_id": property_id,
                    "date": d,
                    "status": status,
                    "source": source,
                },
                on_conflict="property_id,date",
            ).execute()

    def _project_booking_to_reservation(
        self,
        db: Client,
        tenant_id: str,
        attrs: dict[str, Any],
        guest_id: str | None = None,
    ) -> bool:
        """OTA-Buchung → zentrale reservations + Kalender-Block. Idempotent über
        source_channex_booking_id. Gibt True bei Erfolg, False bei skip zurück.

        `guest_id` stammt aus `_upsert_booking` (zentraler Resolver); ist er nicht
        gesetzt (Aufruf ohne vorheriges Staging), wird hier resolved."""
        booking_id = attrs.get("booking_id") or attrs.get("id")
        channex_property_id = attrs.get("property_id")
        arrival = attrs.get("arrival_date")
        departure = attrs.get("departure_date")
        if not (booking_id and channex_property_id and arrival and departure):
            log.warning(
                "reservation_skip_incomplete",
                tenant_id=tenant_id,
                booking_id=booking_id,
            )
            return False

        property_id = self._resolve_local_property(db, tenant_id, channex_property_id)
        if not property_id:
            log.warning(
                "reservation_skip_no_property",
                tenant_id=tenant_id,
                channex_property_id=channex_property_id,
            )
            return False

        ota_name = attrs.get("ota_name")
        channel = self._ota_name_to_channel(ota_name)
        status_in = (attrs.get("status") or "new").lower()
        existing = (
            db.table("reservations")
            .select("id")
            .eq("source_channex_booking_id", booking_id)
            .limit(1)
            .execute()
        ).data

        # Storno: reservation stornieren + Nächte dieser OTA-Quelle wieder frei.
        if status_in == "cancelled":
            if existing:
                db.table("reservations").update({"status": "cancelled"}).eq(
                    "id", existing[0]["id"]
                ).execute()
            for d in self._date_range_nights(arrival, departure):
                # nur freigeben, wenn der Tag von DIESER OTA-Quelle belegt war
                db.table("availability").update(
                    {"status": "open", "source": "manual"}
                ).eq("property_id", property_id).eq("date", d).eq(
                    "status", "booked"
                ).eq("source", channel).execute()
            # Freigabe an Channex: Tage wieder verfügbar (availability=1).
            self.push_availability_for_property(
                tenant_id,
                property_id,
                date.fromisoformat(arrival),
                date.fromisoformat(departure) - timedelta(days=1),
                1,
            )
            return True

        if guest_id is None:
            guest_id = resolve_or_create_guest(
                db,
                tenant_id,
                contact_from_ota_customer(
                    attrs.get("customer") or {},
                    external_ref=attrs.get("ota_reservation_code"),
                ),
            )
        total = attrs.get("amount")
        try:
            total_amount = float(total) if total is not None else 0
        except (TypeError, ValueError):
            total_amount = 0
        # Gästezahl + Kontakt aus dem Channex-Booking übernehmen (für Balken +
        # Detailansicht). occupancy ist je nach OTA dict {adults,children,infants}
        # oder eine Zahl; defensiv beides unterstützen, sonst 1.
        adults, children, infants = self._booking_occupancy(attrs)
        customer = attrs.get("customer") or {}
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": guest_id,
            "channel": channel,
            "ota_name": ota_name,
            "external_ref": attrs.get("ota_reservation_code"),
            "check_in": arrival,
            "check_out": departure,
            "status": "confirmed",
            "total_amount": total_amount,
            "currency": attrs.get("currency") or "EUR",
            "source_channex_booking_id": booking_id,
            "num_guests": max(1, adults + children + infants),
            "adults": adults,
            "children": children,
            "infants": infants,
            "guest_email": customer.get("mail") or customer.get("email"),
            "guest_phone": customer.get("phone"),
            "guest_language": customer.get("language"),
            "guest_country": customer.get("country"),
            # Policy-Zeiten + Preisaufschlüsselung aus der OTA-Payload (sofern
            # vorhanden; kein Erfinden — fehlt ein Feld, bleibt es leer).
            "checkin_time": attrs.get("checkin_time"),
            "checkout_time": attrs.get("checkout_time"),
            "quote_items": self._booking_quote_items(attrs),
            "external_url": attrs.get("ota_url") or attrs.get("external_url"),
        }
        if existing:
            db.table("reservations").update(row).eq("id", existing[0]["id"]).execute()
        else:
            db.table("reservations").insert(row).execute()

        # Kalender: belegte Nächte sperren (Buchung ist autoritativ für 'booked').
        self._set_availability(
            db,
            property_id,
            self._date_range_nights(arrival, departure),
            status="booked",
            source=channel,
        )
        # Realtime an Channex: Tage sperren (availability=0) → kein OTA-Doppel.
        self.push_availability_for_property(
            tenant_id,
            property_id,
            date.fromisoformat(arrival),
            date.fromisoformat(departure) - timedelta(days=1),
            0,
        )
        return True

    def _booking_occupancy(self, attrs: dict[str, Any]) -> tuple[int, int, int]:
        """Gästezahl (adults, children, infants) aus einem Channex-Booking.

        occupancy ist je nach OTA ein dict {adults,children,infants} oder eine
        Zahl; alternativ liegt number_of_guests/occupancy direkt vor. Fehlt
        alles, gilt 1 Erwachsener (keine erfundene größere Belegung)."""
        occ = attrs.get("occupancy")
        if isinstance(occ, dict):
            return (
                self._as_int(occ.get("adults")) or 1,
                self._as_int(occ.get("children")) or 0,
                self._as_int(occ.get("infants")) or 0,
            )
        total = self._as_int(occ) or self._as_int(attrs.get("number_of_guests"))
        return (total or 1, 0, 0)

    def _booking_quote_items(self, attrs: dict[str, Any]) -> list[dict[str, Any]]:
        """Preisaufschlüsselung [{label, amount}] aus einem Channex-Booking.

        Channex liefert Positionen je nach OTA unter `rooms` (Zimmerpreis) und
        `services` (Reinigung/Steuern/Gebühren). Wir übernehmen nur, was wirklich
        da ist (Label + Betrag) — fehlt die Struktur, bleibt die Liste leer
        (keine erfundenen Posten)."""
        items: list[dict[str, Any]] = []
        for room in attrs.get("rooms") or []:
            if not isinstance(room, dict):
                continue
            amount = self._to_float(room.get("amount") or room.get("total_price"))
            if amount is None:
                continue
            label = room.get("title") or room.get("room_type_name") or "Zimmerpreis"
            items.append({"label": str(label), "amount": amount})
        for svc in attrs.get("services") or []:
            if not isinstance(svc, dict):
                continue
            amount = self._to_float(svc.get("total_price") or svc.get("amount"))
            if amount is None:
                continue
            label = svc.get("name") or svc.get("title") or "Gebühr"
            items.append({"label": str(label), "amount": amount})
        return items

    @staticmethod
    def _to_float(value: object) -> float | None:
        if value is None:
            return None
        try:
            return float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    def import_bookings_for_property(
        self,
        tenant_id: str,
        channex_property_id: str,
        *,
        inserted_after: str | None = None,
    ) -> dict[str, int]:
        """EINMALIGER Initial-/Recovery-Import via GET /bookings (paginiert).
        Pro Buchung: Staging (_upsert_booking) + Projektion in reservations.
        KEIN ack (das macht nur der Feed). Pro Buchung isoliert (eine kaputte
        blockiert den Rest nicht)."""
        result = {"fetched": 0, "saved": 0, "skipped": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        page = 1
        while page <= 200:  # Sicherung gegen Endlosschleife
            resp = self._channex.list_bookings_for_property(
                channex_property_id, page=page, limit=100, inserted_after=inserted_after
            )
            data = resp.get("data") or []
            result["fetched"] += len(data)
            for item in data:
                attrs = item.get("attributes") or item
                try:
                    guest_id = self._upsert_booking(
                        db, tenant_id, attrs, attrs.get("revision_id")
                    )
                    if self._project_booking_to_reservation(
                        db, tenant_id, attrs, guest_id
                    ):
                        result["saved"] += 1
                    else:
                        result["skipped"] += 1
                except Exception as exc:  # noqa: BLE001
                    result["skipped"] += 1
                    log.error(
                        "import_booking_failed",
                        tenant_id=tenant_id,
                        error=str(exc),
                    )
            meta = resp.get("meta") or {}
            total = meta.get("total") or 0
            limit = meta.get("limit") or 100
            if not data or page * limit >= total:
                break
            page += 1
        log.info("import_bookings_done", tenant_id=tenant_id, **result)
        return result

    def import_ari_for_property(
        self,
        tenant_id: str,
        channex_property_id: str,
        *,
        days_ahead: int = 365,
        today: date | None = None,
    ) -> dict[str, int]:
        """Preise + Verfügbarkeit aus Channex importieren. availability 0/stop_sell
        → blocked, >0 → open (NIE 'booked' überschreiben). rate → price_overrides;
        stop_sell → stop_sell-Tabelle. Gechunkt (90 Tage). Mapping über die
        channex_*_map-Tabellen; unbekannte UUIDs werden übersprungen."""
        result = {"prices": 0, "availability": 0, "stop_sell": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        property_id = self._resolve_local_property(db, tenant_id, channex_property_id)
        if not property_id:
            return result

        start = today or datetime.now(UTC).date()
        chunk = 90
        offset = 0
        while offset < days_ahead:
            d_from = (start + timedelta(days=offset)).isoformat()
            d_to = (
                start + timedelta(days=min(offset + chunk, days_ahead) - 1)
            ).isoformat()
            offset += chunk

            # Verfügbarkeit (synthetisch: 1 Room-Type/Property → über alle aggregieren)
            try:
                avail = self._channex.get_availability(
                    channex_property_id, date_from=d_from, date_to=d_to
                )
            except ChannexError as exc:
                log.warning("import_ari_availability_failed", error=exc.message)
                avail = {"data": {}}
            by_date: dict[str, int] = {}
            for _room_type, days in (avail.get("data") or {}).items():
                for d, qty in (days or {}).items():
                    by_date[d] = max(by_date.get(d, 0), int(qty or 0))
            # Bestehende Tage EINMAL laden (statt pro Tag einzeln) — und nur
            # schreiben, wenn sich der Status WIRKLICH ändert. Sonst würde jeder
            # Sync-Lauf alle 365 Tage neu upserten (updated_at-Bump) und — mit
            # aktiver Realtime-Publication — eine Event-/Reload-Flut auslösen.
            existing_days = {
                r["date"]: r
                for r in (
                    db.table("availability")
                    .select("date, status, source")
                    .eq("property_id", property_id)
                    .in_("date", list(by_date.keys()))
                    .execute()
                ).data
                or []
            }
            for d, qty in by_date.items():
                cur = existing_days.get(d)
                # 'booked'-Tage (echte Buchung) NICHT überschreiben.
                if cur and cur["status"] == "booked":
                    continue
                new_status = "open" if qty > 0 else "blocked"
                # Idempotent: identischer Status + Quelle → nichts schreiben.
                if cur and cur["status"] == new_status and cur.get("source") == "portal":
                    continue
                db.table("availability").upsert(
                    {
                        "property_id": property_id,
                        "date": d,
                        "status": new_status,
                        "source": "portal",
                    },
                    on_conflict="property_id,date",
                ).execute()
                result["availability"] += 1

            # Preise + stop_sell (Restrictions)
            try:
                restr = self._channex.get_restrictions(
                    channex_property_id,
                    date_from=d_from,
                    date_to=d_to,
                    restrictions="rate,min_stay_arrival,stop_sell",
                )
            except ChannexError as exc:
                log.warning("import_ari_restrictions_failed", error=exc.message)
                restr = {"data": {}}
            for _rate_plan, days in (restr.get("data") or {}).items():
                for d, vals in (days or {}).items():
                    # WICHTIG: zurückgelesene OTA-Raten NICHT als price_override
                    # schreiben. price_override ist per Architektur die MANUELLE
                    # Host-Überschreibung und gewinnt im Resolver über dynamic_prices.
                    # Beim Import würde das einen Echo-Loop erzeugen: unsere eigenen
                    # gepushten Dynamic-Preise kämen als „manueller Override" zurück,
                    # verdeckten die Engine-Preise samt Faktor-Aufschlüsselung und
                    # frören sie als Festpreis ein. Die Preis-Wahrheit ist und bleibt
                    # der pricing-Resolver (override > dynamic > weekday > base);
                    # eingehende OTA-Raten sind kein manueller Override. stop_sell
                    # und Verfügbarkeit sind dagegen echte OTA-Signale → bleiben.
                    if (vals or {}).get("stop_sell"):
                        db.table("stop_sell").upsert(
                            {
                                "tenant_id": tenant_id,
                                "property_id": property_id,
                                "date": d,
                                "source": "channex",
                            },
                            on_conflict="property_id,date",
                        ).execute()
                        result["stop_sell"] += 1
        log.info("import_ari_done", tenant_id=tenant_id, **result)
        return result

    def import_rooms_rates_for_property(
        self, tenant_id: str, channex_property_id: str
    ) -> dict[str, int]:
        """Room-Types/Rate-Plans aus Channex spiegeln: Maps sicherstellen und
        lokale rate_plans anlegen, wo noch keiner gemappt ist (Basispreis aus der
        Primär-Occupancy; per_person-Staffeln werden geloggt, nicht erfunden)."""
        result = {"room_types": 0, "rate_plans": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        pm = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return result
        property_map_id = pm[0]["id"]
        property_id = pm[0]["property_id"]

        try:
            rts = self._channex.get_room_types(channex_property_id).get("data") or []
        except ChannexError as exc:
            log.warning("import_room_types_failed", error=exc.message)
            rts = []
        for rt in rts:
            cx_rt_id = rt.get("id")
            attrs = rt.get("attributes") or {}
            if not cx_rt_id:
                continue
            db.table("channex_room_type_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "property_map_id": property_map_id,
                    "local_unit_ref": property_id,
                    "title": attrs.get("title"),
                    "channex_room_type_id": cx_rt_id,
                    "deleted_at": None,
                },
                on_conflict="channex_room_type_id",
            ).execute()
            result["room_types"] += 1

        try:
            rps = self._channex.get_rate_plans(channex_property_id).get("data") or []
        except ChannexError as exc:
            log.warning("import_rate_plans_failed", error=exc.message)
            rps = []
        for rp in rps:
            cx_rp_id = rp.get("id")
            attrs = rp.get("attributes") or {}
            if not cx_rp_id:
                continue
            cx_rt_id = attrs.get("room_type_id")
            rt_map = (
                db.table("channex_room_type_map")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("channex_room_type_id", cx_rt_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if not rt_map:
                log.warning("import_rate_plan_no_room_type", channex_rate_plan_id=cx_rp_id)
                continue
            # Bereits gemappt?
            existing_map = (
                db.table("channex_rate_plan_map")
                .select("id, local_rate_plan_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_rate_plan_id", cx_rp_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            local_rate_plan_id = (
                existing_map[0]["local_rate_plan_id"] if existing_map else None
            )
            if not local_rate_plan_id:
                # Basispreis aus Primär-Option (per_person: nur Primär, Rest loggen).
                options = attrs.get("options") or []
                primary = next(
                    (o for o in options if o.get("is_primary")), options[0] if options else {}
                )
                try:
                    base_price = float(primary.get("rate")) if primary.get("rate") else 0
                except (TypeError, ValueError):
                    base_price = 0
                if attrs.get("sell_mode") == "per_person" and len(options) > 1:
                    log.info(
                        "import_rate_plan_per_person_truncated",
                        channex_rate_plan_id=cx_rp_id,
                        options=len(options),
                    )
                ins = (
                    db.table("rate_plans")
                    .insert(
                        {
                            "property_id": property_id,
                            "name": attrs.get("title") or "Rate",
                            "base_price": base_price,
                            "currency": attrs.get("currency") or "EUR",
                            "min_stay": 1,
                        }
                    )
                    .execute()
                )
                local_rate_plan_id = ins.data[0]["id"] if ins.data else None
            db.table("channex_rate_plan_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "room_type_map_id": rt_map[0]["id"],
                    "local_rate_plan_id": local_rate_plan_id,
                    "title": attrs.get("title"),
                    "channex_rate_plan_id": cx_rp_id,
                    "deleted_at": None,
                },
                on_conflict="channex_rate_plan_id",
            ).execute()
            result["rate_plans"] += 1
        log.info("import_rooms_rates_done", tenant_id=tenant_id, **result)
        return result

    # -- Row → Schema ----------------------------------------------------------
    @staticmethod
    def _to_property_map(
        row: dict[str, Any], property_title: str | None = None
    ) -> PropertyMapResponse:
        return PropertyMapResponse(
            id=row["id"],
            property_id=row["property_id"],
            property_title=property_title,
            sync_enabled=row.get("sync_enabled", True),
            last_sync_at=row.get("last_sync_at"),
            last_sync_status=row.get("last_sync_status"),
            last_sync_error=row.get("last_sync_error"),
        )

    @staticmethod
    def _to_booking(row: dict[str, Any]) -> BookingResponse:
        return BookingResponse(
            id=row["id"],
            external_id=row["channex_booking_id"],
            ota_name=row.get("ota_name"),
            ota_reservation_code=row.get("ota_reservation_code"),
            status=row.get("status", "new"),
            arrival_date=row.get("arrival_date"),
            departure_date=row.get("departure_date"),
            amount_cents=row.get("amount_cents"),
            currency=row.get("currency"),
            customer=row.get("customer") or {},
            acknowledged_at=row.get("acknowledged_at"),
        )

    @staticmethod
    def _to_cents(amount: object) -> int | None:
        if amount is None:
            return None
        try:
            return round(float(amount) * 100)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
