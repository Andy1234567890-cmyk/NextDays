"""Datenschutz-Einstellungen — Lesen und Ändern der Konto-Präferenzen.

Zwei Klassen von Präferenzen:

1. Reine Konto-Präferenzen (Lesebestätigungen, Review-Sichtbarkeit, KI-Beitrag):
   genau EINE Zeile pro Nutzer in public.privacy_settings. Fehlt sie, gelten die
   Airbnb-Defaults (aus dem Schema); ein Update legt sie lazy per Upsert an.
   Scope IMMER auf user_id (Wurzel 3).

2. „Objekte in Suchmaschinen aufnehmen" (listings_search_engine_indexing): das ist
   KEINE User-Präferenz, sondern eine Eigenschaft der Objekte (Airbnb: „my
   listing(s)"). Der Wert wird deshalb aus den Objekten des Tenants ABGELEITET
   (an = ALLE Objekte indexierbar) und als Bulk auf ALLE Objekte GESCHRIEBEN —
   nie doppelt in privacy_settings gespeichert (sonst divergiert er, Wurzel 4).

Der Service-Client umgeht RLS; jede Query wird explizit auf ctx.user_id bzw.
ctx.tenant_id gescopt.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import PrivacySettings, PrivacySettingsUpdate

log = get_logger("nextdays.privacy_settings")

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
        """True, wenn der Tenant Objekte hat UND ALLE indexierbar sind. Ohne
        Objekte false (nichts ist indexierbar → Schalter aus, ehrlich)."""
        if not ctx.tenant_id:
            return False
        rows = (
            self._db.table("properties")
            .select("search_engine_indexing")
            .eq("tenant_id", ctx.tenant_id)
            .execute()
        ).data or []
        if not rows:
            return False
        return all(bool(r.get("search_engine_indexing")) for r in rows)

    def _set_all_listings_indexed(self, ctx: AuthContext, value: bool) -> None:
        """search_engine_indexing auf ALLEN Objekten des Tenants setzen (Bulk).
        Scope auf tenant_id (Wurzel 3)."""
        if not ctx.tenant_id:
            return
        self._db.table("properties").update(
            {"search_engine_indexing": value}
        ).eq("tenant_id", ctx.tenant_id).execute()
        log.info(
            "listings_search_engine_indexing_bulk",
            tenant_id=ctx.tenant_id,
            value=value,
        )
