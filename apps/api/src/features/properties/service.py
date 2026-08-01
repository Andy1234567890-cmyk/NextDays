"""Service-Schicht für properties (Objekt-Verwaltung).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input. Gleiches Muster wie
auth.account_service (PROJECT.md §2 — Business-Logik im Backend).
"""
from __future__ import annotations

import secrets
from typing import Any

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

from .errors import PropertyError
from .rooms import RoomsMixin
from .schemas import (
    ChannelState,
    PhotoUpdateRequest,
    PropertyCategoryOut,
    PropertyChannels,
    PropertyCreate,
    PropertyListResponse,
    PropertyPhoto,
    PropertyPhotoListResponse,
    PropertyResponse,
    PropertyStatus,
    PropertySubtypeOut,
    PropertyTaxonomyResponse,
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
    # Immobilientyp (0198) + Booking-PCT bestimmen (feiner) den an die Portale
    # gesendeten Channex-property_type → content-relevant.
    "subtype_slug", "booking_property_type",
    "street", "house_number", "postal_code", "city", "country",
    # amenities → Property.facilities, room_amenities → Room-Type.facilities
    # (zwei getrennte Channex-Kataloge, 0243). Ohne room_amenities hier bliebe
    # eine Änderung der Zimmer-Ausstattung bei den Portalen für immer liegen.
    "lat", "lng", "amenities", "room_amenities", "max_guests", "type_attributes",
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


def _sniff_image_ext(content: bytes) -> str | None:
    """Bildtyp aus den Magic-Bytes bestimmen (PNG/JPEG/WebP/GIF).

    None = kein erlaubtes Bild. Der Client-content_type wird bewusst ignoriert:
    er ist frei wählbar und damit kein Schutz (Wurzel 8).
    """
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return None


class PropertiesService(RoomsMixin):
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

    def taxonomy(self) -> PropertyTaxonomyResponse:
        """Objekt-Taxonomie (Kategorien + Immobilientypen) für den Objekttyp-Editor
        (0198). Öffentlicher Referenzkatalog — nur UI-Felder (keine Portal-Mappings),
        sortiert nach sort_order."""
        cats = (
            self._db.table("property_categories")
            .select("slug, label_de, sort_order")
            .order("sort_order")
            .execute()
        )
        subs = (
            self._db.table("property_subtypes")
            .select("slug, label_de, category_slug, listing_types, sort_order")
            .order("sort_order")
            .execute()
        )
        return PropertyTaxonomyResponse(
            categories=[PropertyCategoryOut(**c) for c in (cats.data or [])],
            subtypes=[
                PropertySubtypeOut(**{**s, "listing_types": s.get("listing_types") or []})
                for s in (subs.data or [])
            ],
        )

    def _require_valid_subtype(
        self, subtype_slug: str, listing_type: str | None
    ) -> str:
        """Immobilientyp muss in property_subtypes existieren; ein mitgeschickter
        Listing-Type muss dazu erlaubt sein. Fail-closed (Wurzel 3/5). Gibt den
        zugehörigen category_slug zurück (damit die Kategorie serverseitig mitgesetzt
        wird — die UI muss sie nicht separat konsistent halten)."""
        row = (
            self._db.table("property_subtypes")
            .select("slug, category_slug, listing_types")
            .eq("slug", subtype_slug)
            .limit(1)
            .execute()
        )
        if not row.data:
            raise PropertyError(
                f"Unbekannter Objekttyp „{subtype_slug}“.", status_code=422
            )
        if listing_type is not None and listing_type not in (
            row.data[0].get("listing_types") or []
        ):
            raise PropertyError(
                f"Die Angebotsart „{listing_type}“ ist für diesen Objekttyp "
                "nicht möglich.",
                status_code=422,
            )
        return row.data[0]["category_slug"]

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
        rows = res.data or []
        # Kanal-Zustände (Ebene B) für ALLE Objekte in EINEM Batch-Query holen
        # (kein N+1). Portale = Channex/OTA-Aggregat je Objekt.
        portals = self._portals_state_by_property(
            tenant_id, [str(r["id"]) for r in rows]
        )
        items = [
            PropertyResponse(
                **_row(r), channels=_derive_channels(r, portals.get(str(r["id"])))
            )
            for r in rows
        ]
        return PropertyListResponse(items=items, total=len(items))

    def _portals_state_by_property(
        self, tenant_id: str, property_ids: list[str]
    ) -> dict[str, ChannelState]:
        """Portale-Kanalzustand (OTA) je Objekt in EINEM Query ableiten.

        WICHTIG: „Portale" meint die Verbindung zu einem BUCHUNGSPORTAL (Booking,
        Airbnb …) — das lebt in channex_channel_connection. Die channex_property_map
        bedeutet nur, dass das Objekt bei Channex REGISTRIERT ist (Voraussetzung,
        aber KEIN verbundenes Portal). Grün nur bei echter, aktiver Portal-
        Verbindung — sonst zeigte der Chip „verbunden", obwohl kein OTA dranhängt.
          keine Portal-Verbindung          → not_connected
          Verbindung mit last_error        → error (Handlungsbedarf)
          aktive Verbindung (is_active)    → active
          Verbindung vorhanden, pausiert   → paused
        Kein erfundener Wert (Wurzel 4)."""
        if not property_ids:
            return {}
        try:
            # Die OTA-Verbindungen sind die Wahrheit für „Portale" — nicht die
            # Registrierungs-Map. Ein Objekt kann bei Channex registriert sein
            # (Map-Zeile) und trotzdem KEIN Portal verbunden haben.
            conns = (
                self._db.table("channex_channel_connection")
                .select("property_id, is_active, last_error")
                .eq("tenant_id", tenant_id)
                .in_("property_id", property_ids)
                .execute()
            ).data or []
        except Exception:  # noqa: BLE001 — Kanal-Info ist optional, kippt die Liste nie
            log.warning("portals_state_query_failed", tenant_id=tenant_id)
            return {}
        # Je Objekt über alle seine Portal-Verbindungen aggregieren: ein Fehler
        # dominiert, sonst genügt EINE aktive Verbindung für „active", sonst
        # „paused" (verbunden, aber überall aus).
        out: dict[str, ChannelState] = {}
        for c in conns:
            pid = str(c.get("property_id"))
            if c.get("last_error"):
                out[pid] = ChannelState.error
            elif c.get("is_active"):
                if out.get(pid) != ChannelState.error:
                    out[pid] = ChannelState.active
            elif pid not in out:
                out[pid] = ChannelState.paused
        return out

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
        row = res.data[0]
        portals = self._portals_state_by_property(
            tenant_id, [str(row["id"])]
        ).get(str(row["id"]))
        return PropertyResponse(**_row(row), channels=_derive_channels(row, portals))

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
        # Ein Objekt darf als ENTWURF (draft) ohne Zahlungsfreigabe angelegt werden
        # — der Onboarding-Wizard läuft komplett durch (Airbnb-Muster). Die Stripe-
        # Gate (_require_payments_ready) greift erst bei publish(): erst wenn ein
        # Gast tatsächlich buchen/zahlen kann, muss eine Auszahlung möglich sein.
        self._require_type_matches_accommodation(tenant_id, req.property_type)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        # Ein neu angelegtes Objekt ist IMMER ein Entwurf. "Aktiv" (= verkaufbar)
        # wird man ausschließlich über publish(), den einzigen Pfad, der die
        # Portal-Registrierung (channex_property_map) blockierend erzwingt. Ein
        # client-gesetztes status="active" hier würde ein Objekt "aktiv" machen,
        # ohne dass es je bei den Portalen registriert ist — genau die Divergenz,
        # die zu grauen Portale-Chips und 409 beim Verbinden führt. Serverseitig
        # klemmen (der Anfrage nicht vertrauen, Wurzel 3).
        payload["status"] = PropertyStatus.draft.value
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

    def _require_property_registered(self, tenant_id: str, property_id: str) -> None:
        """Vorbedingung für "active": das Objekt MUSS bei den Portalen registriert
        sein (channex_property_map-Zeile). Fehlt sie, ist ein direkter Wechsel auf
        aktiv nicht erlaubt — der Nutzer muss über publish() (der die Registrierung
        blockierend anlegt). Fail-closed mit umsetzbarer Meldung (Wurzel 3/5)."""
        pm = (
            self._db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not pm.data:
            raise PropertyError(
                "Objekt ist noch nicht an die Buchungsportale übermittelt — "
                "bitte zuerst veröffentlichen.",
                status_code=422,
            )

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
        # Immobilientyp (0198) gegen den Katalog prüfen und die Kategorie
        # serverseitig ableiten (die UI muss category_slug nicht konsistent halten).
        if changes.get("subtype_slug"):
            changes["category_slug"] = self._require_valid_subtype(
                changes["subtype_slug"], changes.get("listing_type")
            )
        # Wechsel auf "active" nur zulassen, wenn das Objekt bereits bei den
        # Portalen registriert ist (channex_property_map). Sonst würde ein Objekt
        # "aktiv" (= verkaufbar, in Kanal-Listen, abrechenbar), ohne dass es
        # tatsächlich übermittelt wurde — der publish()-Pfad ist der einzige, der
        # die Registrierung blockierend erzwingt. Der Anfrage nicht vertrauen,
        # Scope/Vorbedingung serverseitig erzwingen (Wurzel 3), fail-closed.
        if changes.get("status") == PropertyStatus.active.value:
            self._require_property_registered(tenant_id, property_id)
            # Derselbe Kontingent-Riegel wie in publish() — sonst wäre update()
            # der offene Seitenweg, über den beliebig viele Objekte aktiv würden
            # (Wurzel 9: gleicher Scope auf allen Pfaden zum selben Zustand).
            self._require_kontingent(tenant_id, property_id)
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
        # Objektwährung geändert → ALLE Rate-Plans dieses Objekts mitziehen
        # (Wurzel 1: die Objektwährung ist die Wahrheit, kein Rate-Plan darf
        # abweichen — Channex verlangt 1 Objekt = 1 Währung). Leeren-Setzen wird
        # NICHT durchgereicht (rate_plans.currency ist NOT NULL): dann bleiben die
        # Pläne unverändert. Danach Content-Resync, damit die Portale die neue
        # Währung erhalten.
        if "currency" in changes and changes.get("currency"):
            self._apply_currency_to_rate_plans(
                tenant_id, property_id, changes["currency"]
            )
        if (_CONTENT_FIELDS & changes.keys()) or (
            "currency" in changes and changes.get("currency")
        ):
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

    def _apply_currency_to_rate_plans(
        self, tenant_id: str, property_id: str, currency: str
    ) -> None:
        """Objektwährung auf alle Rate-Plans des Objekts durchschreiben (Wurzel 1).

        Die Objektwährung (properties.currency) ist die Wahrheit; ein Rate-Plan
        darf keine abweichende Währung tragen. Scope über property_id +
        tenant-eigenes Objekt (der Aufrufer hat das Objekt bereits tenant-gescopt
        aktualisiert). Best-effort im Sinne von Wurzel 5: schlägt das Nachziehen
        fehl, bleibt die Objektwährung gesetzt und ein erneutes Speichern greift
        wieder — es darf den Objekt-Update-Hauptpfad nicht kippen."""
        try:
            self._db.table("rate_plans").update({"currency": currency}).eq(
                "property_id", property_id
            ).neq("currency", currency).execute()
        except Exception:  # noqa: BLE001 — best-effort, kippt das Speichern nicht
            log.warning(
                "rate_plan_currency_sync_failed",
                tenant_id=tenant_id,
                property_id=property_id,
            )

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

    def _require_kontingent(self, tenant_id: str, property_id: str) -> None:
        """Veröffentlichen nur im Rahmen des gebuchten Tarifs.

        Der Kunde bezahlt eine Objektzahl (``reported_property_count``, der
        Regler beim Abschluss). Ohne diese Schranke ließen sich beliebig viele
        Objekte live schalten, während nur für fünf gezahlt wird.

        Gezählt werden die bereits aktiven Objekte OHNE das gerade zu
        veröffentlichende — sonst könnte ein erneutes publish() desselben,
        schon aktiven Objekts an der eigenen Belegung scheitern (Wurzel 2:
        real kommt alles doppelt). Fehlt das Abo oder die Menge, wird
        fail-closed abgewiesen statt eine Zahl zu erfinden (Wurzel 4/5).
        """
        rows = (
            self._db.table("tenant_subscription")
            .select("status, reported_property_count")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        row = rows[0] if rows else None
        if not row or row.get("status") not in ("active", "trialing"):
            raise PropertyError(
                "Zum Veröffentlichen wird ein aktives Abo benötigt. "
                "Bitte im Konto unter „Tarif & Abo“ abschließen.",
                status_code=422,
            )
        gebucht = row.get("reported_property_count")
        if not gebucht:
            raise PropertyError(
                "Die gebuchte Objektzahl konnte nicht ermittelt werden. "
                "Bitte den Support kontaktieren.",
                status_code=422,
            )
        andere_aktive = (
            self._db.table("properties")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .neq("id", property_id)
            .execute()
        ).count or 0
        if andere_aktive >= int(gebucht):
            raise PropertyError(
                f"Ihr Tarif umfasst {gebucht} Objekte, davon sind bereits "
                f"{andere_aktive} veröffentlicht. Bitte den Tarif erweitern "
                "oder ein anderes Objekt deaktivieren.",
                status_code=422,
            )

    def publish(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        """Objekt veröffentlichen: draft→active + Channex-Sync + Verfügbarkeit.

        Voraussetzung: das Objekt hat mindestens einen Preisplan (rate_plan).
        Ohne Preis kann es nicht an die Buchungsportale übertragen werden (422,
        kein Fallback). Idempotent — erneutes Veröffentlichen aktualisiert nur.
        """
        from datetime import UTC, datetime, timedelta

        tenant_id = self._require_tenant(ctx)
        # Veröffentlichen erfordert die abgeschlossene Zahlungs-Einrichtung (Stripe
        # charges_enabled) — erst ab jetzt kann ein Gast buchen/zahlen, also muss
        # eine Auszahlung möglich sein. Entwürfe (create) sind davon frei.
        self._require_payments_ready(tenant_id)
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
        # Erst wenn feststeht, dass es das Objekt gibt: passt es noch in den
        # gebuchten Tarif? Ein unbekanntes Objekt bleibt 404, nicht 422.
        self._require_kontingent(tenant_id, property_id)

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
        # Währung NICHT hier auflösen und schon gar nicht auf "EUR" defaulten
        # (Wurzel 4). None durchreichen — sync_content bestimmt die Objektwährung
        # selbst (zentrale properties.currency → Rate-Plan) und schlägt fail-closed
        # mit 422 fehl, wenn keine echte Währung existiert.
        currency = row.get("currency") or None

        # 1) Status aktiv setzen UND den eigenen Marktplatz-Kanal listen (0159).
        #    Veröffentlichen = im Normalfall überall live (1 Klick → OTAs +
        #    eigener Marktplatz). Die Marktplatz-Sichtbarkeit bleibt danach ein
        #    eigener, separat schaltbarer Kanal (getrennt von der OTA-Distribution).
        #
        #    Der EIGENE Marktplatz zeigt das Objekt allerdings erst nach Freigabe
        #    durch den Plattformbetreiber (0203): Veröffentlichen reicht es zur
        #    Prüfung ein (moderation_status='pending'). OTA-Vertrieb und eigene
        #    Website laufen sofort — sie sind von der Prüfung nicht betroffen.
        #    Bereits freigegebene Objekte behalten ihre Freigabe (ein erneutes
        #    publish, z. B. nach einer Pause, wirft sie nicht zurück).
        felder: dict[str, str | bool] = {
            "status": "active",
            "listed_on_marketplace": True,
        }
        if row.get("moderation_status") != "approved":
            felder["moderation_status"] = "pending"
            felder["moderation_submitted_at"] = datetime.now(UTC).isoformat()
        upd = (
            self._db.table("properties")
            .update(felder)
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

    def duplicate(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        """Objekt duplizieren (Lodgify „Kopieren"): legt eine EIGENSTÄNDIGE
        Kopie als Entwurf an. Kopiert werden nur Inhaltsdaten (Titel, Typ,
        Beschreibung, Ausstattung, Belegung, Adresse …); Identität, Zeitstempel,
        physisch eindeutige Kennungen (BFE-/Katasternummer) und jede Kanal-/
        Sync-Verknüpfung werden NICHT übernommen. Die Kopie ist immer draft und
        auf keinem Kanal sichtbar — verkaufbar wird sie erst über publish()."""
        tenant_id = self._require_tenant(ctx)
        src = (
            self._db.table("properties")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not src:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        row = src[0]

        # Nur echte Inhaltsdaten übernehmen. Identität/Zeitstempel und alles, was
        # eine externe Verknüpfung oder eine physisch eindeutige Kennung trägt,
        # bleibt draußen — die Kopie ist eine frische, unverbundene Einheit.
        drop = {
            "id",
            "created_at",
            "updated_at",
            "tenant_id",
            "status",
            "listed_on_website",
            "listed_on_marketplace",
            "bfe_number",
        }
        payload = {k: v for k, v in row.items() if k not in drop}
        payload["tenant_id"] = tenant_id
        payload["status"] = PropertyStatus.draft.value
        payload["listed_on_website"] = False
        payload["listed_on_marketplace"] = False
        title = (row.get("title") or "Unbenannt").strip()
        payload["title"] = f"{title} (Kopie)"

        res = self._db.table("properties").insert(payload).execute()
        if not res.data:
            raise PropertyError(
                "Objekt konnte nicht dupliziert werden.", status_code=500
            )
        new_row = res.data[0]
        log.info(
            "property_duplicated",
            tenant_id=tenant_id,
            source_property_id=property_id,
            property_id=new_row["id"],
        )
        # Wie bei create(): das neue Objekt beim Channel-Manager anlegen (non-
        # blocking). currency=None → der Sync lädt die echte Objektwährung selbst
        # und schlägt fail-closed fehl, falls keine existiert (Wurzel 4).
        self._sync_to_channel_manager(
            tenant_id,
            property_id=new_row["id"],
            title=new_row.get("title") or "Unbenannt",
            currency=None,
        )
        return PropertyResponse(**_row(new_row))

    def unlist_website(self, ctx: AuthContext, property_id: str) -> PropertyResponse:
        """Website-Verbindung aufheben (Lodgify „Verbindung mit Webseite
        aufheben"): schaltet NUR die Website-Sichtbarkeit ab
        (``listed_on_website=False``) — ein eigener Vertriebskanal, getrennt von
        Status, Marktplatz und OTA (0162). Portale/Marktplatz bleiben unberührt.
        Idempotent: ist das Flag schon aus, bleibt es aus."""
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("properties")
            .update({"listed_on_website": False})
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        row = res.data[0]
        portals = self._portals_state_by_property(
            tenant_id, [str(row["id"])]
        ).get(str(row["id"]))
        log.info(
            "property_website_unlisted",
            tenant_id=tenant_id,
            property_id=property_id,
        )
        return PropertyResponse(**_row(row), channels=_derive_channels(row, portals))

    # --- Barrierefreiheits-Beweisfotos (0201) --------------------------------
    #
    # Airbnb-Ablauf: der Gastgeber wählt je Merkmal „Ich habe diese Funktion"
    # und lädt Beweisfotos hoch; erst nach Prüfung erscheint das Merkmal im
    # Inserat. Das has-Flag liegt weiterhin in type_attributes.accessibility;
    # hier nur die Fotos samt Prüfstatus.

    ACCESSIBILITY_MAX_PHOTOS = 10

    def list_accessibility_photos(
        self, ctx: AuthContext, property_id: str, feature_key: str | None = None
    ) -> list[dict[str, Any]]:
        """Beweisfotos eines Objekts, optional auf ein Merkmal gefiltert."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)  # 404, wenn nicht im eigenen Tenant
        query = (
            self._db.table("property_accessibility_photos")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
        )
        if feature_key:
            query = query.eq("feature_key", feature_key)
        return query.order("created_at", desc=False).execute().data or []

    def upload_accessibility_photo(
        self,
        ctx: AuthContext,
        property_id: str,
        feature_key: str,
        content: bytes,
        content_type: str,
    ) -> dict[str, Any]:
        """Ein Beweisfoto zu einem Merkmal hochladen.

        Magic-Byte-Prüfung statt Vertrauen auf content_type (Wurzel 8) und eine
        harte Obergrenze je Merkmal, damit ein Upload-Loop den Bucket nicht
        flutet.
        """
        _ = content_type  # bewusst ignoriert — die echten Bytes entscheiden.
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)

        if len(content) > self.IMAGE_MAX_BYTES:
            raise PropertyError("Bild ist zu groß (max. 10 MB).", status_code=413)
        ext = _sniff_image_ext(content)
        if not ext:
            raise PropertyError("Nur PNG/JPEG/WebP/GIF erlaubt.", status_code=415)

        vorhanden = (
            self._db.table("property_accessibility_photos")
            .select("id")
            .eq("property_id", property_id)
            .eq("feature_key", feature_key)
            .execute()
        ).data or []
        if len(vorhanden) >= self.ACCESSIBILITY_MAX_PHOTOS:
            raise PropertyError(
                f"Höchstens {self.ACCESSIBILITY_MAX_PHOTOS} Fotos je Merkmal.",
                status_code=422,
            )

        safe_key = "".join(c for c in feature_key if c.isalnum() or c in "-_")
        if not safe_key:
            raise PropertyError("Ungültiges Merkmal.", status_code=422)
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{property_id}/accessibility/{safe_key}/{name}.{ext}"
        storage = self._db.storage.from_(self.IMAGE_BUCKET)
        try:
            storage.upload(path, content, {"content-type": f"image/{ext}"})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning(
                "accessibility_photo_upload_failed",
                property_id=property_id,
                error=str(exc),
            )
            raise PropertyError("Upload fehlgeschlagen.", status_code=502) from exc

        res = (
            self._db.table("property_accessibility_photos")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "feature_key": feature_key,
                    "storage_path": path,
                    "url": storage.get_public_url(path),
                    "status": "pending",
                }
            )
            .execute()
        ).data
        log.info(
            "accessibility_photo_uploaded",
            tenant_id=tenant_id,
            property_id=property_id,
            feature_key=feature_key,
        )
        return res[0]

    def delete_accessibility_photo(
        self, ctx: AuthContext, property_id: str, photo_id: str
    ) -> None:
        """Ein Beweisfoto löschen (Datei + Zeile). Scope wie die Liste
        (Wurzel 9: derselbe Filter auf tenant_id UND property_id)."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        existing = (
            self._db.table("property_accessibility_photos")
            .select("storage_path")
            .eq("id", photo_id)
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not existing:
            raise PropertyError("Foto nicht gefunden.", status_code=404)

        pfad = existing[0].get("storage_path")
        if pfad:
            try:
                self._db.storage.from_(self.IMAGE_BUCKET).remove([pfad])
            except Exception as exc:  # noqa: BLE001 — verwaiste Datei ist ok
                log.warning(
                    "accessibility_photo_storage_delete_failed",
                    photo_id=photo_id,
                    error=str(exc),
                )
        self._db.table("property_accessibility_photos").delete().eq(
            "id", photo_id
        ).eq("tenant_id", tenant_id).execute()
        log.info("accessibility_photo_deleted", photo_id=photo_id)



def _local_channel_state(status: str | None, flag: bool | None) -> ChannelState:
    """Zustand eines LOKALEN Kanals (Website/Plattform) ableiten. Diese Kanäle
    können keinen Sync-Fehler haben (kein externer Push) → nur active/paused.
    Sichtbar (active) nur, wenn status='active' UND das Kanal-Flag an ist; sonst
    paused. Der Lebenszyklus (status) wird auf der Karte separat als Badge oben
    gezeigt; hier zählt nur die pro-Kanal-Sichtbarkeit."""
    if status == "active" and bool(flag):
        return ChannelState.active
    return ChannelState.paused


def _derive_channels(
    r: dict, portals: ChannelState | None
) -> PropertyChannels:
    """Kanal-Zustände (Ebene B) für die drei Chips ableiten. Website/Plattform
    aus den lokalen Flags, Portale aus dem vorberechneten Channex/OTA-Aggregat
    (None → not_connected: kein Kanal eingerichtet, kein erfundener Wert)."""
    status = r.get("status")
    return PropertyChannels(
        website=_local_channel_state(status, r.get("listed_on_website")),
        marketplace=_local_channel_state(status, r.get("listed_on_marketplace")),
        portals=portals or ChannelState.not_connected,
    )


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
