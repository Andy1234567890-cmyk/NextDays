"""Datenschutz-Einstellungen — Lesen und Ändern der Konto-Präferenzen.

Zwei Klassen von Präferenzen:

1. Reine Konto-Präferenzen (Lesebestätigungen, Review-Sichtbarkeit, KI-Beitrag):
   genau EINE Zeile pro Nutzer in public.privacy_settings. Fehlt sie, gelten die
   Airbnb-Defaults (aus dem Schema); ein Update legt sie lazy per Upsert an.
   Scope IMMER auf user_id (Wurzel 3).

2. „Objekte in Suchmaschinen aufnehmen" (listings_search_engine_indexing): das ist
   KEINE User-Präferenz, sondern die Entscheidung des BETRIEBS (Airbnb: „my
   listing(s)") — sie steht in `tenants.search_engine_indexing` und wird als
   Bulk auf ALLE Objekte des Tenants projiziert. In privacy_settings steht sie
   nie (sonst divergiert sie, Wurzel 4).

   Bis zum 17.09.2026 wurde der Schalter stattdessen aus dem Objektbestand
   ABGELEITET (an = alle Objekte indexierbar). Das las sich sparsam, hatte aber
   kein Gedächtnis: `properties.search_engine_indexing` steht per Default auf
   false, ein NEUES Objekt kam also immer auf noindex herein — und damit sprang
   der Schalter eines Betriebs, der ihn angeschaltet hatte, beim nächsten
   angelegten Objekt von selbst auf „aus", während die alten Objekte weiter
   indexiert blieben. Ein Betrieb ohne Objekte sah „aus", ohne je etwas
   entschieden zu haben. Beides macht Airbnb nicht. Das Erben regelt seit 0714
   ein Trigger, damit es auf JEDEM Anlage-Weg gilt (Anlage, Duplizieren,
   Import, Seed) und nicht nur dort, wo jemand daran gedacht hat (Wurzel 1).

Der Service-Client umgeht RLS; jede Query wird explizit auf ctx.user_id bzw.
ctx.tenant_id gescopt.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.permissions import Capability, has_capability

from .schemas import PrivacySettings, PrivacySettingsUpdate

log = get_logger("nextdays.privacy_settings")


class PrivacySettingsError(Exception):
    """Fachlicher Fehler mit HTTP-Status (Router mappt ihn)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code

# Reine Konto-Präferenzen (in privacy_settings gespeichert). Ohne die abgeleitete
# listings_search_engine_indexing — die lebt auf den Objekten.
_COLUMNS = (
    "message_read_receipts, review_show_home_city, review_show_trip_type, "
    "review_show_length_of_stay, review_show_booked_services, "
    "ai_features_contribution"
)


class PrivacySettingsService:
    def __init__(self, db: Client) -> None:
        self._db = db

    def get(self, ctx: AuthContext) -> PrivacySettings:
        """Präferenzen des eingeloggten Nutzers. Reine Konto-Felder aus
        privacy_settings (fehlt die Zeile → Defaults); die Suchmaschinen-
        Indexierung wird aus dem Objekt-Zustand des Tenants abgeleitet."""
        row = (
            self._db.table("privacy_settings")
            .select(_COLUMNS)
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        base = PrivacySettings(**row[0]) if row else PrivacySettings()
        base.listings_search_engine_indexing = self._all_listings_indexed(ctx)
        return base

    def update(
        self, ctx: AuthContext, patch: PrivacySettingsUpdate
    ) -> PrivacySettings:
        """Nur gesetzte Felder ändern (PATCH). Reine Konto-Felder per Upsert in
        privacy_settings; listings_search_engine_indexing als Bulk auf ALLE
        Objekte des Tenants (Airbnb „my listing(s)")."""
        changed = patch.model_dump(exclude_none=True)

        # Objekt-Bulk getrennt behandeln — nie in privacy_settings schreiben.
        listings = changed.pop("listings_search_engine_indexing", None)
        if listings is not None:
            # Wurzel 9: der Endpunkt hängt an CurrentUser (Authentifizierung),
            # dieses eine Feld schreibt aber auf ALLE Objekte des Tenants. Ohne
            # diese Prüfung könnte jeder staff/cleaner/owner den kompletten
            # Objektbestand aus den Suchmaschinen nehmen. Konto-Präferenzen
            # bleiben bewusst für jeden eingeloggten Nutzer änderbar.
            if not has_capability(ctx.role, Capability.MANAGE_PROPERTIES):
                raise PrivacySettingsError(
                    "Für die Suchmaschinen-Einstellung der Objekte fehlt die "
                    "Berechtigung.",
                    status_code=403,
                )
            self._set_all_listings_indexed(ctx, listings)

        if changed:
            self._db.table("privacy_settings").upsert(
                {
                    "user_id": ctx.user_id,
                    "updated_at": datetime.now(UTC).isoformat(),
                    **changed,
                },
                on_conflict="user_id",
            ).execute()
            log.info(
                "privacy_settings_updated",
                user_id=ctx.user_id,
                fields=sorted(changed),
            )
        return self.get(ctx)

    # -- Suchmaschinen-Indexierung (objektbezogen, Bulk) -------------------

    def _all_listings_indexed(self, ctx: AuthContext) -> bool:
        """Die gespeicherte Entscheidung des Betriebs (0714).

        Gelesen wird `tenants.search_engine_indexing`, NICHT der Objektbestand:
        der Schalter soll zeigen, was der Betrieb entschieden hat, und nicht,
        was gerade zufällig in den Objekten steht. Ohne Mandant (Nutzer ohne
        Betrieb) gibt es keine Entscheidung — dann `False`, kein geratener Wert.
        """
        if not ctx.tenant_id:
            return False
        zeile = (
            self._db.table("tenants")
            .select("search_engine_indexing")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        return bool(zeile[0]["search_engine_indexing"]) if zeile else False

    def _set_all_listings_indexed(self, ctx: AuthContext, value: bool) -> None:
        """Die Entscheidung speichern UND auf alle Objekte projizieren.

        Beides, in dieser Reihenfolge: die Entscheidung ist die Quelle (sie
        gilt auch für künftige Objekte, siehe Trigger in 0714), die Objektspalte
        ist das, was Inseratseite und Sitemap lesen. Nur eines von beiden zu
        schreiben hiesse, dass Anzeige und Wirklichkeit auseinanderlaufen
        (Wurzel 1). Scope auf tenant_id (Wurzel 3).
        """
        if not ctx.tenant_id:
            return
        self._db.table("tenants").update(
            {"search_engine_indexing": value}
        ).eq("id", ctx.tenant_id).execute()
        self._db.table("properties").update(
            {"search_engine_indexing": value}
        ).eq("tenant_id", ctx.tenant_id).execute()
        log.info(
            "listings_search_engine_indexing_bulk",
            tenant_id=ctx.tenant_id,
            value=value,
        )
