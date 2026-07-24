"""Blockierte Personen (Airbnb „Blockierte Personen", Artikel 4046).

Ein Betrieb (Tenant) blockiert einen Plattform-Gast (portal_guest). Wirkung:
- der blockierte Gast kann Objekte des Betriebs NICHT mehr buchen,
- er kann dem Betrieb NICHT mehr schreiben — AUSNAHME (Airbnb): bei aktiver/
  kommender Reservierung laufen trip-bezogene Nachrichten weiter bis 2 Wochen nach
  Check-out; ist die Reservierung storniert, greift der Block sofort.

Der Slice selbst verwaltet die Liste (list/block/unblock); die Durchsetzung
geschieht in guest_messages (senden) und booking_engine (buchen), die
``is_blocked_for_messaging`` bzw. ``is_blocked_for_booking`` aufrufen.

Scope IMMER auf tenant_id (Wurzel 3) — der Service-Client umgeht RLS.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import BlockedGuest

log = get_logger("nextdays.guest_blocks")

# Airbnb: trip-bezogene Nachrichten laufen bis 2 Wochen nach Check-out weiter.
_TRIP_GRACE = timedelta(days=14)


class GuestBlockError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GuestBlockService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Verwaltung (Betrieb) ----------------------------------------------

    def list_blocked(self, ctx: AuthContext) -> list[BlockedGuest]:
        """Blockierte Gäste des Betriebs, neueste zuerst, mit Anzeigename/E-Mail."""
        if not ctx.tenant_id:
            return []
        rows = (
            self._db.table("blocked_guests")
            .select("id, portal_guest_id, reason, created_at")
            .eq("tenant_id", ctx.tenant_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        if not rows:
            return []
        guests = self._guest_display(
            [r["portal_guest_id"] for r in rows]
        )
        return [
            BlockedGuest(
                id=r["id"],
                portal_guest_id=r["portal_guest_id"],
                name=guests.get(r["portal_guest_id"], {}).get("name"),
                email=guests.get(r["portal_guest_id"], {}).get("email"),
                reason=r.get("reason"),
                created_at=r.get("created_at"),
            )
            for r in rows
        ]

    def block(
        self, ctx: AuthContext, portal_guest_id: str, reason: str | None
    ) -> BlockedGuest:
        """Einen Gast blockieren. Idempotent (Wurzel 2): existiert der Block schon,
        wird er wiederverwendet statt eine zweite Zeile anzulegen."""
        if not ctx.tenant_id:
            raise GuestBlockError("Kein Betrieb im Kontext.", status_code=403)
        self._require_guest_exists(portal_guest_id)

        existing = (
            self._db.table("blocked_guests")
            .select("id, portal_guest_id, reason, created_at")
            .eq("tenant_id", ctx.tenant_id)
            .eq("portal_guest_id", portal_guest_id)
            .limit(1)
            .execute()
        ).data
        if existing:
            row = existing[0]
        else:
            row = (
                self._db.table("blocked_guests")
                .insert(
                    {
                        "tenant_id": ctx.tenant_id,
                        "portal_guest_id": portal_guest_id,
                        "blocked_by": ctx.user_id,
                        "reason": reason,
                    }
                )
                .execute()
            ).data[0]
            log.info(
                "guest_blocked",
                tenant_id=ctx.tenant_id,
                portal_guest_id=portal_guest_id,
            )
        guests = self._guest_display([portal_guest_id])
        info = guests.get(portal_guest_id, {})
        return BlockedGuest(
            id=row["id"],
            portal_guest_id=portal_guest_id,
            name=info.get("name"),
            email=info.get("email"),
            reason=row.get("reason"),
            created_at=row.get("created_at"),
        )

    def unblock(self, ctx: AuthContext, portal_guest_id: str) -> None:
        """Einen Gast entblocken (Airbnb: macht die Blockwirkung rückgängig).
        Scope auf tenant_id. Kein Fehler, wenn nichts zu löschen war (idempotent)."""
        if not ctx.tenant_id:
            raise GuestBlockError("Kein Betrieb im Kontext.", status_code=403)
        self._db.table("blocked_guests").delete().eq(
            "tenant_id", ctx.tenant_id
        ).eq("portal_guest_id", portal_guest_id).execute()
        log.info(
            "guest_unblocked",
            tenant_id=ctx.tenant_id,
            portal_guest_id=portal_guest_id,
        )

    # -- Durchsetzung (von anderen Slices genutzt) -------------------------

    def is_blocked_for_booking(
        self, tenant_id: str, portal_guest_id: str
    ) -> bool:
        """Für die Buchungsstrecke: ein Block sperrt das Buchen IMMER (keine
        Trip-Ausnahme — Airbnb: „won't be able to book your listing")."""
        return self._block_row(tenant_id, portal_guest_id) is not None

    def is_email_blocked_for_booking(self, tenant_id: str, email: str) -> bool:
        """Wie is_blocked_for_booking, aber für die JWT-lose Buchungsstrecke: der
        Gast identifiziert sich per E-Mail. Blockiert, wenn ein portal_guest mit
        dieser E-Mail beim Betrieb blockiert ist. Kein portal_guest → nicht
        blockierbar (ein reiner Gast ohne Plattform-Login wurde nie geblockt)."""
        clean = (email or "").strip().lower()
        if not clean:
            return False
        rows = (
            self._db.table("portal_guests")
            .select("id")
            .ilike("email", clean)
            .execute()
        ).data or []
        return any(
            self._block_row(tenant_id, r["id"]) is not None for r in rows
        )

    def is_blocked_for_messaging(
        self, tenant_id: str, portal_guest_id: str
    ) -> bool:
        """Für Nachrichten: ein Block sperrt das Schreiben, AUSSER es gibt eine
        aktive/kommende Reservierung dieses Gasts beim Betrieb, die weniger als
        2 Wochen zurückliegt (Airbnb-Trip-Fenster). Stornierte Reservierungen
        zählen NICHT (dann greift der Block sofort)."""
        if self._block_row(tenant_id, portal_guest_id) is None:
            return False
        # Block existiert → nur durchlassen, wenn ein aktives Trip-Fenster läuft.
        return not self._has_active_trip_window(tenant_id, portal_guest_id)

    # -- intern ------------------------------------------------------------

    def _block_row(self, tenant_id: str, portal_guest_id: str) -> dict | None:
        rows = (
            self._db.table("blocked_guests")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("portal_guest_id", portal_guest_id)
            .limit(1)
            .execute()
        ).data
        return rows[0] if rows else None

    def _has_active_trip_window(
        self, tenant_id: str, portal_guest_id: str
    ) -> bool:
        """True, wenn der Gast beim Betrieb eine NICHT stornierte Reservierung hat,
        deren Check-out höchstens 2 Wochen zurückliegt (oder in der Zukunft liegt).
        Die Zuordnung Gast↔Reservierung läuft über die E-Mail (portal_guests.email
        ↔ reservations.guest_email), wie im Gast-Dashboard."""
        email = self._guest_email(portal_guest_id)
        if not email:
            return False
        cutoff = (datetime.now(UTC).date() - _TRIP_GRACE).isoformat()
        rows = (
            self._db.table("reservations")
            .select("id, status, check_out")
            .eq("tenant_id", tenant_id)
            .ilike("guest_email", email)
            .neq("status", "cancelled")
            .gte("check_out", cutoff)
            .limit(1)
            .execute()
        ).data
        return bool(rows)

    def _guest_email(self, portal_guest_id: str) -> str | None:
        rows = (
            self._db.table("portal_guests")
            .select("email")
            .eq("id", portal_guest_id)
            .limit(1)
            .execute()
        ).data
        email = rows[0].get("email") if rows else None
        return email.strip().lower() if email else None

    def _guest_display(self, ids: list[str]) -> dict[str, dict]:
        """name + email je portal_guest_id (Anzeigefelder für die Block-Liste)."""
        uniq = list({i for i in ids if i})
        if not uniq:
            return {}
        rows = (
            self._db.table("portal_guests")
            .select("id, name, email")
            .in_("id", uniq)
            .execute()
        ).data or []
        return {r["id"]: {"name": r.get("name"), "email": r.get("email")} for r in rows}

    def _require_guest_exists(self, portal_guest_id: str) -> None:
        rows = (
            self._db.table("portal_guests")
            .select("id")
            .eq("id", portal_guest_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestBlockError("Gast nicht gefunden.", status_code=404)
