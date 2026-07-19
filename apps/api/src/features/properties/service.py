"""Service-Schicht für properties (Objekt-Verwaltung).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input. Gleiches Muster wie
auth.account_service (PROJECT.md §2 — Business-Logik im Backend).
"""
from __future__ import annotations

import secrets

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.auth.staff_scope import is_staff, staff_property_ids
from src.jobs.queue import (
    enqueue,
    try_enqueue_ari,
    try_enqueue_content_sync,
    try_enqueue_recompute,
)

from .schemas import (
    PhotoUpdateRequest,
    PropertyCreate,
    PropertyListResponse,
    PropertyPhoto,
    PropertyPhotoListResponse,
    PropertyResponse,
    PropertyType,
    PropertyUpdate,
    SliceHealth,
    types_for_accommodation,
)

log = get_logger("nextdays.properties")

# Felder, deren Änderung einen Channex-Content-Resync auslöst (Beschreibung/
# Titel/Adresse/Typ/Ausstattung gehen an OTAs). Reine Preis-Updates sind NICHT
# dabei — die synct der rates-Slice separat.
# Änderungen an diesen Feldern lösen einen Content-Sync zu Channex aus, weil
# sie in den Property-/Room-Type-Content einfließen. max_guests + type_attributes
# gehören dazu: aus ihnen wird die Room-Type-Belegung (occ_adults/children/
# infants, count_of_rooms) gebaut, die an die OTAs geht.
_CONTENT_FIELDS = frozenset({
    "title", "description", "platform_description", "property_type",
    "street", "house_number", "postal_code", "city", "country",
    "lat", "lng", "amenities", "max_guests", "type_attributes",
})

# Beim Veröffentlichen abzudeckender Horizont (Tage). Deckt sich bewusst mit
# Channex' state_length=500 und dem Full-Sync (_FULL_SYNC_DAYS): schon der
# Publish-Push versorgt die vollen 500 Tage, statt Tage 366–500 dem Nacht-Cron
# zu überlassen (Channex-Zertifizierung Test 1 = 500 Tage aller Zimmer/Raten).
_PUBLISH_HORIZON_DAYS = 500


def _max_stay_of(row: dict) -> int:
    """Maximalaufenthalt (Nächte) aus type_attributes.availability.maxStay lesen.
    0/fehlend = keine Obergrenze. Der Kunde setzt ihn im Verfügbarkeits-Formular;
    Channex nimmt ihn als max_stay-Restriction (an die Portale)."""
    avail = (row.get("type_attributes") or {}).get("availability") or {}
    try:
        return max(0, int(avail.get("maxStay") or 0))
    except (TypeError, ValueError):
        return 0


class PropertyError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertiesService:
    slice_name = "properties"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PropertyError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _accommodation_type(self, tenant_id: str) -> str | None:
        """Betriebsart des Tenants (tenants.accommodation_type, 0090)."""
        row = (
            self._db.table("tenants")
            .select("accommodation_type")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return row.data[0].get("accommodation_type") if row.data else None

    def _require_type_matches_accommodation(
        self, tenant_id: str, property_type: PropertyType
    ) -> None:
        """Objekttyp muss zur Betriebsart passen — sonst entstünde ein Objekt,
        das in keiner Liste sichtbar ist (list() filtert nach Betriebsart)."""
        allowed = types_for_accommodation(self._accommodation_type(tenant_id))
        if allowed is not None and property_type not in allowed:
            raise PropertyError(
                f"Der Objekttyp „{property_type.value}“ passt nicht zur "
                "Betriebsart deines Kontos. Wähle einen Typ aus der "
                "angebotenen Liste.",
                status_code=422,
            )

    def list(self, ctx: AuthContext) -> PropertyListResponse:
        tenant_id = self._require_tenant(ctx)
        query = (
            self._db.table("properties")
            .select("*")
            .eq("tenant_id", tenant_id)
        )
        # Owner-Scope (§4.2): ein Eigentümer sieht NUR seine zugeordneten Objekte,
        # nicht die aller anderen Eigentümer desselben Mandanten. Der Service läuft
        # mit Service-Role (RLS umgangen) → der Scope muss hier erzwungen werden
        # (wie in reservations/calendar/pricing). Leere Menge → keine Objekte.
        if is_owner(ctx):
            owned = sorted(owner_property_ids(self._db, ctx))
            if not owned:
                return PropertyListResponse(items=[], total=0)
            query = query.in_("id", owned)
        # Staff-Scope (§4.3): ein Mitarbeiter/Dienstleister sieht NUR die ihm
        # freigegebenen Objekte (staff_property_assignments), nicht den ganzen
        # Bestand des Mandanten. Fail-closed: keine Freigabe → keine Objekte.
        # (Zusätzlich zur RLS-Policy 0136, damit der service-role-Pfad — RLS
        #  umgangen — denselben Scope trägt; defense-in-depth.)
        elif is_staff(ctx):
            assigned = sorted(staff_property_ids(self._db, ctx))
            if not assigned:
                return PropertyListResponse(items=[], total=0)
            query = query.in_("id", assigned)
        # Betriebsart-Scope: Hotel sieht nur Zimmertypen, Ferienvermietung nur
        # Ferienobjekt-Typen. get() per ID bleibt bewusst ungefiltert, damit
        # falsch typisierte Bestandsobjekte per Direktlink korrigierbar bleiben.
        allowed = types_for_accommodation(self._accommodation_type(tenant_id))
        if allowed is not None:
            query = query.in_("property_type", sorted(t.value for t in allowed))
        res = query.order("created_at", desc=True).execute()
        items = [PropertyResponse(**_row(r)) for r in (res.data or [])]
        return PropertyListResponse(items=items, total=len(items))

    def get(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2): ein Eigentümer darf nur SEINE Objekte per ID lesen —
        # ein fremdes Objekt wirkt wie „nicht gefunden" (keine Stammdaten-Leaks).
        if is_owner(ctx) and property_id not in owner_property_ids(self._db, ctx):
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        # Staff-Scope (§4.3): ein Mitarbeiter/Dienstleister darf nur ein ihm
        # freigegebenes Objekt per ID lesen (defense-in-depth zur RLS 0136).
        if is_staff(ctx) and property_id not in staff_property_ids(self._db, ctx):
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        res = (
            self._db.table("properties")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        return PropertyResponse(**_row(res.data[0]))

    def _require_payments_ready(self, tenant_id: str) -> None:
        """Wirft, wenn der Tenant keinen von Stripe bestätigten Connected Account
        hat (``stripe_charges_enabled = true``). Eine Tenant-übergreifende, eine
        Quelle der Wahrheit für „darf dieser Mandant verkaufen?"."""
        prof = (
            self._db.table("tenant_billing_profile")
            .select("stripe_charges_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        ready = bool(prof[0].get("stripe_charges_enabled")) if prof else False
        if not ready:
            raise PropertyError(
                "Bitte schließe zuerst die Zahlungs-Einrichtung ab (Stripe). "
                "Objekte können erst angelegt werden, wenn dein Konto für "
                "Zahlungen freigeschaltet ist.",
                status_code=409,
            )

    def create(self, ctx: AuthContext, req: PropertyCreate) -> PropertyResponse:
        tenant_id = self._require_tenant(ctx)
        # Plattform-Regel: ein Objekt darf erst angelegt werden, wenn der Stripe
        # Connected Account des Tenants von Stripe BESTÄTIGT ist (charges_enabled).
        # Sonst könnte ein Gast buchen/zahlen, ohne dass eine Auszahlung möglich
        # wäre. Onboarding/KYC muss also vorher abgeschlossen sein.
        self._require_payments_ready(tenant_id)
        self._require_type_matches_accommodation(tenant_id, req.property_type)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        res = self._db.table("properties").insert(payload).execute()
        if not res.data:
            raise PropertyError("Objekt konnte nicht angelegt werden.", status_code=500)
        row = res.data[0]
        log.info("property_created", tenant_id=tenant_id, property_id=row["id"])
        # Auto-Anbindung an den Channel-Manager (non-blocking): legt das Objekt
        # automatisch beim Provider an. Schlägt das fehl, bleibt die Objekt-
        # Anlage trotzdem erfolgreich (Fehler wird im Mapping vermerkt).
        # currency=None: properties hat keine currency-Spalte (die liegt im
        # rate_plan). sync_content lädt die ECHTE Objektwährung selbst und
        # schlägt fail-closed fehl (422), wenn keine existiert — ein "EUR"-
        # Platzhalter hier würde genau diesen Schutz aushebeln (Wurzel 4).
        self._sync_to_channel_manager(
            tenant_id,
            property_id=row["id"],
            title=row.get("title") or "Unbenannt",
            currency=None,
        )
        # Objektzahl-Änderung an das Abo melden (Wurzel 1: Gegenzustand). Nur wenn
        # das neue Objekt bereits abrechenbar (status='active') ist — ein Entwurf
        # ändert die quantity nicht. Best-effort, kippt die Anlage nie (Wurzel 5).
        if row.get("status") == "active":
            self._sync_subscription_quantity(tenant_id)
        return PropertyResponse(**_row(row))

    def _sync_subscription_quantity(self, tenant_id: str) -> None:
        """Zieht die graduated-quantity der Tenant-Subscription auf die aktuelle
        abrechenbare Objektzahl nach. Best-effort: ein Fehler hier (Stripe nicht
        konfiguriert, kein Abo, Netzwerk) darf den Property-Hauptpfad NICHT kippen
        — die Objektzahl wird neu berechnet, ein späterer Aufruf holt sie ein."""
        try:
            from src.features.subscriptions.service import SubscriptionsService

            SubscriptionsService(
                service_client=self._db
            ).sync_quantity_for_tenant(tenant_id)
        except Exception:  # noqa: BLE001 — best-effort, kein Kippen des Hauptpfads
            log.warning("subscription_quantity_sync_failed", tenant_id=tenant_id)

    def _sync_to_channel_manager(
        self, tenant_id: str, *, property_id: str, title: str, currency: str | None
    ) -> None:
        """Reiht den Channex-Content-Sync des Objekts als Hintergrund-Job ein
        (Phase 2: raus aus dem Request-Pfad). Früher lief hier der volle Content-
        Sync synchron (mehrere sequentielle ~3s-Channex-Calls) und blockierte den
        Request. Jetzt antwortet der Request sofort; der Worker synct im Hintergrund
        mit Channex-Token-Budget. Coalesced je Objekt → mehrfaches Speichern (z. B.
        Galerie-Upload) erzeugt nur EINEN Sync mit dem letzten Stand."""
        try_enqueue_content_sync(
            self._db, tenant_id, property_id, title=title, currency=currency
        )

    def resync_content(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        """Objekt-Inhalte (Beschreibung, Ausstattung, Fotos, Belegung, Adresse …)
        erneut an die Buchungsportale übertragen — ohne Statuswechsel. Für den
        „An Buchungsportale übertragen"-Button: aktualisiert den OTA-Content und
        pusht den Maximalaufenthalt. Idempotent."""
        tenant_id = self._require_tenant(ctx)
        row = (
            self._db.table("properties")
            .select("*")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        r = row[0]
        self._sync_to_channel_manager(
            tenant_id,
            property_id=property_id,
            title=r.get("title") or "Unbenannt",
            currency=None,
        )
        self._push_max_stay(tenant_id, property_id, _max_stay_of(r))
        log.info("property_resynced", tenant_id=tenant_id, property_id=property_id)
        return PropertyResponse(**_row(r))

    def update(
        self, ctx: AuthContext, property_id: str, req: PropertyUpdate
    ) -> PropertyResponse:
        tenant_id = self._require_tenant(ctx)
        # Nur gesetzte Felder übernehmen (PATCH-Semantik).
        changes = req.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return self.get(ctx, property_id)
        if "property_type" in changes:
            self._require_type_matches_accommodation(
                tenant_id, PropertyType(changes["property_type"])
            )
        res = (
            self._db.table("properties")
            .update(changes)
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        # Pricing-Konfig in die strukturierte, vom Resolver gelesene Tabelle
        # spiegeln, sobald sie im Update steckt (eine Preis-Wahrheit). Der opake
        # type_attributes.pricing-Blob bleibt zusätzlich für die Form-UI erhalten.
        attrs = changes.get("type_attributes")
        if isinstance(attrs, dict) and isinstance(attrs.get("pricing"), dict):
            self._sync_pricing_config(tenant_id, property_id, attrs["pricing"])
        # Content-Felder (Beschreibung, Titel, Adresse, Typ, Fotos, Ausstattung)
        # nach Channex spiegeln, sobald sie sich ändern — sonst bliebe der
        # OTA-Content veraltet (z. B. Beschreibung nie an Booking/Airbnb). Nur bei
        # content-relevanten Änderungen (reine Preis-Updates synct der rates-Slice).
        row = res.data[0]
        if _CONTENT_FIELDS & changes.keys():
            self._sync_to_channel_manager(
                tenant_id,
                property_id=property_id,
                title=row.get("title") or "Unbenannt",
                currency=None,
            )
        # Maximalaufenthalt (Verfügbarkeits-Formular) an die Portale spiegeln,
        # sobald type_attributes sich ändert — sonst bliebe die Obergrenze bei
        # Booking/Airbnb veraltet. Best-effort, blockiert das Speichern nie.
        if "type_attributes" in changes:
            self._push_max_stay(tenant_id, property_id, _max_stay_of(row))
        # Statuswechsel (active↔draft/inactive) ändert die abrechenbare Objektzahl
        # → Abo-quantity nachziehen (Wurzel 1). Neu berechnet, daher idempotent.
        if "status" in changes:
            self._sync_subscription_quantity(tenant_id)
        log.info("property_updated", tenant_id=tenant_id, property_id=property_id)
        return PropertyResponse(**_row(row))

    def _push_max_stay(self, tenant_id: str, property_id: str, max_stay: int) -> None:
        """Maximalaufenthalt als ARI-Push-Job einreihen (Phase 2). 0 wird ebenfalls
        gepusht, damit das Entfernen der Obergrenze synchronisiert wird. Deckt IMMER
        den vollen 500-Tage-Horizont ab → coalesce=True sicher (letzter gewinnt)."""
        from datetime import date, timedelta

        today = date.today()
        try_enqueue_ari(
            self._db, tenant_id, property_id, "max_stay",
            {"date_from": today.isoformat(),
             "date_to": (today + timedelta(days=_PUBLISH_HORIZON_DAYS - 1)).isoformat(),
             "max_stay": max_stay},
            coalesce=True,
        )

    def _sync_pricing_config(
        self, tenant_id: str, property_id: str, pricing: dict
    ) -> None:
        """Pricing-Blob → property_pricing_config (vom Preis-Resolver gelesen).

        Schreibt die strukturierten Felder per Upsert. Fehlende Felder bleiben auf
        den Spalten-Defaults (kein erfundener Wert). Best-effort — ein Fehler hier
        darf das Speichern des Objekts nicht kippen (Realtime/Resolver greifen beim
        nächsten Speichern erneut)."""
        try:
            row = {
                "property_id": property_id,
                "tenant_id": tenant_id,
                "custom_by_weekday": bool(pricing.get("customByWeekday")),
                "weekday_prices": pricing.get("weekdayPrices") or {},
                "markup": pricing.get("markup") or {},
                "extra_guest_charge": pricing.get("extraGuestCharge") or 0,
                "extra_guest_from": pricing.get("extraGuestFrom") or 1,
                "short_stay_max_nights": pricing.get("shortStayMaxNights") or 0,
                "short_stay_surcharge": pricing.get("shortStaySurcharge") or 0,
                "length_prices": pricing.get("lengthPrices") or [],
                "fees": pricing.get("fees") or [],
                "taxes": pricing.get("taxes") or [],
                "promotions": pricing.get("promotions") or [],
                "add_ons": pricing.get("addOns") or [],
            }
            # Währung nur setzen, wenn explizit übergeben — kein EUR erfinden
            # (Wurzel 4). Fehlt sie, greift bei Insert der Spalten-Default bzw. der
            # bestehende Wert bleibt bei Update erhalten.
            if pricing.get("currency"):
                row["currency"] = pricing["currency"]
            self._db.table("property_pricing_config").upsert(
                row, on_conflict="property_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Spiegelung darf Speichern nicht kippen
            log.warning(
                "pricing_config_sync_failed", property_id=property_id, error=str(exc)
            )

    IMAGE_BUCKET = "property-images"
    IMAGE_MAX_BYTES = 10 * 1024 * 1024
    IMAGE_MIME = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    }

    def upload_image(
        self,
        ctx: AuthContext,
        property_id: str,
        content: bytes,
        content_type: str,
        slot: str = "image",
    ) -> str:
        """Bild für ein Objekt hochladen → öffentliche URL zurückgeben.

        Validiert Tenant-Eigentum (über get), legt nach
        property-images/{tenant_id}/{property_id}/{slot}.{ext}. ``slot`` erlaubt
        feste Namen je Verwendung (z. B. „custom-map"), die das Vorbild ersetzen.
        Das Speichern der URL ins Objekt erledigt der Aufrufer per update().
        """
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)  # 404, wenn nicht im eigenen Tenant

        ext = self.IMAGE_MIME.get(content_type)
        if not ext:
            raise PropertyError("Nur PNG/JPEG/WebP/GIF erlaubt.", status_code=415)
        if len(content) > self.IMAGE_MAX_BYTES:
            raise PropertyError("Bild ist zu groß (max. 10 MB).", status_code=413)

        safe_slot = "".join(c for c in slot if c.isalnum() or c in "-_") or "image"
        path = f"{tenant_id}/{property_id}/{safe_slot}.{ext}"
        storage = self._db.storage.from_(self.IMAGE_BUCKET)
        try:
            storage.upload(
                path,
                content,
                {"content-type": content_type, "upsert": "true"},
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("property_image_upload_failed", property_id=property_id, error=str(exc))
            raise PropertyError("Upload fehlgeschlagen.", status_code=502) from exc

        public_url = storage.get_public_url(path)
        log.info(
            "property_image_uploaded",
            tenant_id=tenant_id,
            property_id=property_id,
            slot=safe_slot,
        )
        # Cache-Buster, damit Clients trotz gleicher URL das neue Bild laden.
        return f"{public_url}?v={secrets.token_hex(4)}"

    # --- Foto-/Galerieverwaltung (property_photos, Migration 0061) -----------
    #
    # property_photos ist die Wahrheit; properties.photos bleibt ein abgeleiteter
    # Kompat-Spiegel (Cover zuerst, dann sort_order), den die bestehenden Leser
    # (Kalender-Thumbnail, öffentliche Listings, DP-Übersicht, Inbox) weiter nutzen.

    GALLERY_MAX_BYTES = 20 * 1024 * 1024
    # Nur Schutz gegen leere/kaputte Dateien — KEINE Qualitätsschwelle über die
    # Bytegröße: moderne Formate (AVIF/WebP) werden im Client zu JPEG konvertiert
    # und sind dann legitim klein (oft < 50 KB). Die echte Mindestgröße prüft der
    # Client über die Auflösung (≥ 600×400 px).
    GALLERY_MIN_BYTES = 2 * 1024
    GALLERY_MIME = {"image/png": "png", "image/jpeg": "jpg"}

    def list_photos(
        self, ctx: AuthContext, property_id: str
    ) -> PropertyPhotoListResponse:
        """Fotos eines Objekts, nach sort_order sortiert."""
        self.get(ctx, property_id)  # 404, wenn nicht im eigenen Tenant
        rows = (
            self._db.table("property_photos")
            .select("*")
            .eq("property_id", property_id)
            .order("sort_order")
            .execute()
        ).data or []
        items = [PropertyPhoto(**_photo_row(r)) for r in rows]
        return PropertyPhotoListResponse(items=items, total=len(items))

    def add_photo(
        self,
        ctx: AuthContext,
        property_id: str,
        content: bytes,
        content_type: str,
    ) -> PropertyPhoto:
        """Ein Galerie-Foto hochladen → Bucket + neue Zeile am Ende einsortieren.

        Validiert Typ (JPEG/PNG) und Größe (bis 20 MB, nicht leer) serverseitig.
        Moderne Formate (AVIF/WebP/HEIC) konvertiert der Client vorab zu JPEG; die
        Mindestauflösung prüft der Client. Das erste Foto eines Objekts wird
        automatisch zum Cover. Aktualisiert anschließend den properties.photos-Spiegel.
        """
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)  # 404, wenn nicht im eigenen Tenant

        ext = self.GALLERY_MIME.get(content_type)
        if not ext:
            raise PropertyError("Nur JPEG/PNG erlaubt.", status_code=415)
        if len(content) < self.GALLERY_MIN_BYTES:
            raise PropertyError("Bild ist leer oder beschädigt.", status_code=413)
        if len(content) > self.GALLERY_MAX_BYTES:
            raise PropertyError("Bild ist zu groß (max. 20 MB).", status_code=413)

        existing = (
            self._db.table("property_photos")
            .select("sort_order, is_cover")
            .eq("property_id", property_id)
            .order("sort_order", desc=True)
            .execute()
        ).data or []
        next_order = (existing[0]["sort_order"] + 1) if existing else 0
        is_cover = len(existing) == 0  # erstes Foto = Cover

        # Eindeutiger Objektname je Foto (Galerie hat viele pro Objekt).
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{property_id}/gallery/{name}.{ext}"
        storage = self._db.storage.from_(self.IMAGE_BUCKET)
        try:
            storage.upload(path, content, {"content-type": content_type})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("property_photo_upload_failed", property_id=property_id, error=str(exc))
            raise PropertyError("Upload fehlgeschlagen.", status_code=502) from exc
        url = storage.get_public_url(path)

        res = (
            self._db.table("property_photos")
            .insert(
                {
                    "property_id": property_id,
                    "url": url,
                    "sort_order": next_order,
                    "is_cover": is_cover,
                    "caption": {},
                }
            )
            .execute()
        )
        if not res.data:
            raise PropertyError("Foto konnte nicht angelegt werden.", status_code=500)
        self._sync_photos_mirror(tenant_id, property_id)
        log.info("property_photo_added", tenant_id=tenant_id, property_id=property_id)
        return PropertyPhoto(**_photo_row(res.data[0]))

    def reorder_photos(
        self, ctx: AuthContext, property_id: str, photo_ids: list[str]
    ) -> PropertyPhotoListResponse:
        """Reihenfolge der Fotos setzen. ``photo_ids`` muss exakt die vorhandenen
        Foto-IDs enthalten (keine fremden, keine fehlenden)."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        rows = (
            self._db.table("property_photos")
            .select("id")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        current = {str(r["id"]) for r in rows}
        if current != set(photo_ids):
            raise PropertyError(
                "Reihenfolge muss exakt alle Fotos des Objekts enthalten.",
                status_code=400,
            )
        for index, photo_id in enumerate(photo_ids):
            self._db.table("property_photos").update({"sort_order": index}).eq(
                "id", photo_id
            ).eq("property_id", property_id).execute()
        self._sync_photos_mirror(tenant_id, property_id)
        log.info("property_photos_reordered", tenant_id=tenant_id, property_id=property_id)
        return self.list_photos(ctx, property_id)

    def update_photo(
        self,
        ctx: AuthContext,
        property_id: str,
        photo_id: str,
        req: PhotoUpdateRequest,
    ) -> PropertyPhoto:
        """Caption (je Locale) und/oder Cover eines Fotos setzen. Cover=true macht
        dieses Foto zum alleinigen Cover (vorheriges Cover wird zurückgesetzt)."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        existing = (
            self._db.table("property_photos")
            .select("*")
            .eq("id", photo_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not existing:
            raise PropertyError("Foto nicht gefunden.", status_code=404)

        changes = req.model_dump(exclude_unset=True)
        if not changes:
            return PropertyPhoto(**_photo_row(existing[0]))

        if changes.get("is_cover") is True:
            # Genau ein Cover: erst alle zurücksetzen, dann dieses setzen. Reihen-
            # folge ist wichtig wegen des partiellen Unique-Index (one_cover).
            self._db.table("property_photos").update({"is_cover": False}).eq(
                "property_id", property_id
            ).eq("is_cover", True).execute()
        elif changes.get("is_cover") is False:
            # Cover nicht abwählbar (es muss immer eins geben) — ignorieren.
            changes.pop("is_cover", None)

        if changes:
            res = (
                self._db.table("property_photos")
                .update(changes)
                .eq("id", photo_id)
                .eq("property_id", property_id)
                .execute()
            ).data
            updated = res[0] if res else existing[0]
        else:
            updated = existing[0]
        self._sync_photos_mirror(tenant_id, property_id)
        log.info("property_photo_updated", tenant_id=tenant_id, property_id=property_id)
        return PropertyPhoto(**_photo_row(updated))

    def delete_photo(self, ctx: AuthContext, property_id: str, photo_id: str) -> None:
        """Foto löschen: Datei aus dem Bucket + Zeile. War es das Cover, wird das
        erste verbleibende Foto (kleinste sort_order) neues Cover."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        existing = (
            self._db.table("property_photos")
            .select("*")
            .eq("id", photo_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not existing:
            raise PropertyError("Foto nicht gefunden.", status_code=404)
        was_cover = bool(existing[0].get("is_cover"))

        self._delete_storage_object(existing[0].get("url"))
        self._db.table("property_photos").delete().eq("id", photo_id).eq(
            "property_id", property_id
        ).execute()

        if was_cover:
            remaining = (
                self._db.table("property_photos")
                .select("id")
                .eq("property_id", property_id)
                .order("sort_order")
                .limit(1)
                .execute()
            ).data or []
            if remaining:
                self._db.table("property_photos").update({"is_cover": True}).eq(
                    "id", remaining[0]["id"]
                ).execute()
        self._sync_photos_mirror(tenant_id, property_id)
        log.info("property_photo_deleted", tenant_id=tenant_id, property_id=property_id)

    def _delete_storage_object(self, url: str | None) -> None:
        """Bucket-Objekt zur öffentlichen URL entfernen (best-effort)."""
        if not url:
            return
        marker = f"/{self.IMAGE_BUCKET}/"
        idx = url.find(marker)
        if idx == -1:
            return
        path = url[idx + len(marker):].split("?", 1)[0]
        try:
            self._db.storage.from_(self.IMAGE_BUCKET).remove([path])
        except Exception as exc:  # noqa: BLE001 — verwaistes Objekt ist tolerierbar
            log.warning("property_photo_storage_remove_failed", path=path, error=str(exc))

    def _sync_photos_mirror(self, tenant_id: str, property_id: str) -> None:
        """properties.photos aus property_photos ableiten: Cover zuerst, dann
        sort_order. Eine Foto-Wahrheit; die bestehenden URL-Array-Leser bleiben
        unverändert. Best-effort — ein Fehler hier darf den Vorgang nicht kippen."""
        try:
            rows = (
                self._db.table("property_photos")
                .select("url, sort_order, is_cover")
                .eq("property_id", property_id)
                .order("sort_order")
                .execute()
            ).data or []
            ordered = sorted(
                rows, key=lambda r: (not r.get("is_cover"), r.get("sort_order") or 0)
            )
            urls = [r["url"] for r in ordered]
            self._db.table("properties").update({"photos": urls}).eq(
                "tenant_id", tenant_id
            ).eq("id", property_id).execute()
        except Exception as exc:  # noqa: BLE001 — Spiegelung darf Vorgang nicht kippen
            log.warning("property_photos_mirror_failed", property_id=property_id, error=str(exc))
        # Fotos gehören zum OTA-Content: nach jeder Foto-Änderung (Hinzufügen,
        # Umsortieren, Cover/Caption, Löschen) den Content an Channex spiegeln —
        # sonst kämen Fotos NIE bei Booking/Airbnb an (Upload triggerte bisher nur
        # den lokalen properties.photos-Spiegel, keinen Channex-Sync).
        # Nur `title` selektieren — die Währung hat properties NICHT als Spalte
        # (sie liegt im rate_plan); sync_content lädt die echte currency selbst
        # aus dem rate_plan und schlägt fail-closed fehl, wenn keine existiert.
        prop = (
            self._db.table("properties")
            .select("title")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if prop:
            self._sync_to_channel_manager(
                tenant_id,
                property_id=property_id,
                title=prop[0].get("title") or "Unbenannt",
                currency=None,
            )

    def publish(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        """Objekt veröffentlichen: draft→active + Channex-Sync + Verfügbarkeit.

        Voraussetzung: das Objekt hat mindestens einen Preisplan (rate_plan).
        Ohne Preis kann es nicht an die Buchungsportale übertragen werden (422,
        kein Fallback). Idempotent — erneutes Veröffentlichen aktualisiert nur.
        """
        from datetime import UTC, datetime, timedelta

        tenant_id = self._require_tenant(ctx)
        prop = (
            self._db.table("properties")
            .select("*")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        row = prop[0]

        rates = (
            self._db.table("rate_plans")
            .select("id, currency, min_stay")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not rates:
            raise PropertyError(
                "Bitte zuerst einen Preis hinterlegen, dann kann das Objekt "
                "veröffentlicht und an die Buchungsportale übertragen werden.",
                status_code=422,
            )
        currency = rates[0].get("currency") or "EUR"

        # 1) Status aktiv setzen UND den eigenen Marktplatz-Kanal listen (0159).
        #    Veröffentlichen = im Normalfall überall live (1 Klick → OTAs +
        #    eigener Marktplatz). Die Marktplatz-Sichtbarkeit bleibt danach ein
        #    eigener, separat schaltbarer Kanal (getrennt von der OTA-Distribution).
        upd = (
            self._db.table("properties")
            .update({"status": "active", "listed_on_marketplace": True})
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data
        row = upd[0] if upd else row

        # 2) Channex-Sync (Property+Room-Type+Rate-Plan+channex_property_map).
        #    BLOCKIEREND hier: Veröffentlichen MUSS die Übertragung sicherstellen.
        from src.features.channel_manager.service import (
            ChannelManagerError,
            ChannelManagerService,
        )

        cm = ChannelManagerService(service_client=self._db)
        try:
            # Titel lädt sync_content aus der DB (Wurzel 1/4) — kein
            # durchgereichter Wert, kein "Unbenannt"-Fallback.
            cm.sync_content(
                tenant_id,
                property_id=property_id,
                currency=currency,
            )
        except ChannelManagerError as exc:
            raise PropertyError(exc.message, status_code=exc.status_code) from exc

        # 3) Verfügbarkeit initialisieren (kommende 500 Tage als 'open', sofern
        #    noch keine Zeile existiert) — füllt den Kalender, Basis für den Push.
        today = datetime.now(UTC).date()
        existing_days = {
            r["date"]
            for r in (
                self._db.table("availability")
                .select("date")
                .eq("property_id", property_id)
                .gte("date", today.isoformat())
                .lt("date", (today + timedelta(days=_PUBLISH_HORIZON_DAYS)).isoformat())
                .execute()
            ).data
            or []
        }
        new_rows = [
            {
                "property_id": property_id,
                "date": (today + timedelta(days=i)).isoformat(),
                "status": "open",
                "source": "manual",
            }
            for i in range(_PUBLISH_HORIZON_DAYS)
            if (today + timedelta(days=i)).isoformat() not in existing_days
        ]
        if new_rows:
            self._db.table("availability").upsert(
                new_rows, on_conflict="property_id,date"
            ).execute()

        # 4) Go-Live-Full-Sync: EIN full_sync_property-Job deckt Verfügbarkeit UND
        #    Preise/Restriktionen über den vollen 500-Tage-Horizont in genau zwei
        #    Channex-Calls ab (1× availability RLE, 1× rates&restrictions via
        #    push_rates_batch aus dem Preis-Resolver — autopilot-unabhängig). Das ist
        #    die dokumentierte „Hotel goes Live"-Semantik (Channex-Zertifizierung
        #    Test 1). Ersetzt den früheren availability-Einzel-Push, der ohne
        #    Autopilot KEINEN Preis-Push erzeugte (recompute pusht nur bei Autopilot).
        #    Tages-Dedup wie der nächtliche Lauf: mehrfaches draft↔active-Togglen am
        #    selben Tag erzeugt keinen zweiten Voll-Push (kein Timer-Anti-Pattern).
        horizon_to = (today + timedelta(days=_PUBLISH_HORIZON_DAYS - 1)).isoformat()
        today_iso = today.isoformat()
        try:
            enqueue(
                self._db, "full_sync_property", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=f"full_sync:{property_id}:{today_iso}",
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen darf Publish nie kippen
            log.warning("publish_full_sync_enqueue_failed",
                        property_id=property_id, error=str(exc)[:200])

        # Min-/Max-Stay separat als ARI-Job — der Full-Sync pusht nur Preise+
        # Verfügbarkeit, nicht die Aufenthalts-Restriktionen (die haben keine
        # Ganz-Horizont-Tabelle). Nur wenn vom Rate-Plan/Formular gesetzt.
        min_stay = int(rates[0].get("min_stay") or 1)
        if min_stay > 1:
            try_enqueue_ari(
                self._db, tenant_id, property_id, "rate",
                {"date_from": today_iso, "date_to": horizon_to, "min_stay": min_stay},
                coalesce=True,
            )
        max_stay = _max_stay_of(row)
        if max_stay > 0:
            try_enqueue_ari(
                self._db, tenant_id, property_id, "max_stay",
                {"date_from": today_iso, "date_to": horizon_to, "max_stay": max_stay},
                coalesce=True,
            )

        # 5) Tagesgenaue Preise nachrechnen als recompute_property-Job (Coalescing
        #    je Objekt) — für Autopilot-Objekte, die danach dynamisch weiterpushen.
        #    Der initiale Preis-Push kommt bereits aus dem Full-Sync (Schritt 4).
        try_enqueue_recompute(self._db, tenant_id, property_id)

        log.info("property_published", tenant_id=tenant_id, property_id=property_id)
        return PropertyResponse(**_row(row))

    def delete(self, ctx: AuthContext, property_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("properties")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)

        # Channel-Manager-Mapping mitführen: ohne reale Unterkunft ist die
        # Channex-Verknüpfung gegenstandslos und würde sonst als Karteileiche
        # im Channel-Manager weiterleben. Soft-Delete (deleted_at), damit der
        # Sync sie nicht erneut anfasst.
        from datetime import UTC, datetime

        self._db.table("channex_property_map").update(
            {"deleted_at": datetime.now(UTC).isoformat(), "sync_enabled": False}
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).is_(
            "deleted_at", "null"
        ).execute()

        # Objektzahl nach dem Löschen ans Abo melden (Wurzel 1: Gegenzustand). Nur
        # wenn das gelöschte Objekt abrechenbar (active) war — sonst keine Änderung.
        if (res.data[0] or {}).get("status") == "active":
            self._sync_subscription_quantity(tenant_id)

        log.info("property_deleted", tenant_id=tenant_id, property_id=property_id)


def _row(r: dict) -> dict:
    """DB-Zeile in das Response-Schema überführen (None-Listen/-Objekte glätten)."""
    return {
        **r,
        "id": str(r["id"]),
        "tenant_id": str(r["tenant_id"]),
        "amenities": r.get("amenities") or [],
        "photos": r.get("photos") or [],
        "type_attributes": r.get("type_attributes") or {},
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
    }


def _photo_row(r: dict) -> dict:
    """property_photos-Zeile in das PropertyPhoto-Schema überführen."""
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "url": r["url"],
        "sort_order": int(r.get("sort_order") or 0),
        "is_cover": bool(r.get("is_cover")),
        "caption": r.get("caption") or {},
        "author": r.get("author") or None,
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
    }
