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

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

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
                "postal_code, city, country, lat, lng"
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
            for rp in rate_plans:
                self._upsert_channex_rate_plan(
                    db, tenant_id, room_type_map_id, channex_property_id,
                    channex_room_type_id, rp, prop_currency,
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
            "property_type": prop_row.get("property_type"),
            "latitude": prop_row.get("lat"),
            "longitude": prop_row.get("lng"),
            "timezone": _timezone_for_country(country) if country else None,
        }
        attrs = {k: v for k, v in candidates.items() if v not in (None, "")}
        desc = prop_row.get("description")
        if desc:
            attrs["content"] = {"description": desc}
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

    def _upsert_channex_rate_plan(
        self, db: Client, tenant_id: str, room_type_map_id: str,
        channex_property_id: str, channex_room_type_id: str,
        rp: dict[str, Any], currency: str,
    ) -> str:
        """Ein Rate-Plan (per_room, manual) am synthetischen Room-Type.
        base_price (Euro) → Cent-Integer an der API-Grenze."""
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

        attrs = {
            "property_id": channex_property_id,
            "room_type_id": channex_room_type_id,
            "title": title,
            "currency": currency,
            "sell_mode": "per_room",
            "rate_mode": "manual",
            "options": [{"occupancy": 2, "is_primary": True, "rate": base_cents}],
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
            except Exception as exc:  # noqa: BLE001 — ein Tenant darf nicht killen
                totals["errors"].append(f"{tid}: {exc}")
                log.error("reconcile_tenant_failed", tenant_id=tid, error=str(exc))
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
            raise ChannelManagerError("Mapping konnte nicht gespeichert werden.", 500)
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

        for rev in revisions:
            attrs = rev.get("attributes") or rev
            revision_id = rev.get("id") or attrs.get("revision_id")
            rev_property_id = attrs.get("property_id")

            # Gehört diese Revision diesem Tenant? Sonst überspringen (kein ack!).
            if rev_property_id not in own_property_ids:
                result.skipped += 1
                continue

            try:
                self._upsert_booking(db, tenant_id, attrs, revision_id)
                result.saved += 1
                if revision_id:
                    self._channex.ack_booking_revision(revision_id)
                    result.acknowledged += 1
            except (ChannexError, ChannelManagerError) as exc:
                msg = getattr(exc, "message", str(exc))
                result.errors.append(f"Revision {revision_id}: {msg}")
                log.error("channex_booking_sync_failed", revision=revision_id, error=msg)

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

    # Rückwärtskompatibler Alias (an vielen Stellen genutzt).
    @property
    def _PORTAL_LABELS(self) -> dict[str, str]:  # noqa: N802
        return self._portal_labels

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
            if not (set(a.get("properties") or []) & prop_ids):
                continue  # fremder Kanal — nicht dieses Tenants
            out.append(
                {
                    "id": ch.get("id") or a.get("id"),
                    "portal": self._PORTAL_LABELS.get(a.get("channel"), "Kanal"),
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
        if portal_code not in self._PORTAL_LABELS:
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
            "portal": self._PORTAL_LABELS[portal_code],
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
        if portal_code not in self._PORTAL_LABELS:
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
            "title": title or self._PORTAL_LABELS[portal_code],
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
        if channel_id and not is_active:
            try:
                self._channex.activate_channel(channel_id)
                is_active = True
            except ChannexError as exc:
                # Anlegen hat geklappt — Aktivierung kann der Kunde wiederholen.
                log.warning("channex_channel_activate_failed",
                            channel_id=channel_id, error=exc.message)

        return {
            "id": channel_id,
            "portal": self._PORTAL_LABELS[portal_code],
            "title": a.get("title") or title or self._PORTAL_LABELS[portal_code],
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
        self._require_tenant(ctx)
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
    _WEBHOOK_EVENTS = "ari;booking_new;booking_modification;booking_cancellation"

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
    ) -> None:
        channex_booking_id = attrs.get("booking_id") or attrs.get("id")
        if not channex_booking_id:
            raise ChannelManagerError("Buchung ohne ID übersprungen.", status_code=422)

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
            "raw": attrs,
        }
        db.table("channex_booking").upsert(
            row, on_conflict="channex_booking_id"
        ).execute()

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
