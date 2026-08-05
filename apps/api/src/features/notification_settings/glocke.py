"""Die Glocke — In-App-Benachrichtigungen lesen und als gelesen markieren.

Im selben Slice wie die Praeferenzen, weil beide denselben Katalog teilen: die
Kategorie einer Meldung (`listing_activity`, …) ist dieselbe, die im Konto
schaltbar ist. Ein eigener Slice haette den Katalog dupliziert.

SCOPE (Wurzel 3/9): Empfaenger ist ein NUTZER. Jede Abfrage filtert auf
`user_id = ctx.user_id` UND den Mandanten — die Service-Rolle umgeht RLS, ein
Zugriff nur per Benachrichtigungs-ID waere fremde Post. Das gilt auch fuer
`als_gelesen`: derselbe Scope wie die Liste, nicht nur der Tenant.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

log = get_logger("nextdays.glocke")

# Hoechstzahl Meldungen je Abruf. Die Glocke zeigt die neuesten — ein Konto mit
# tausenden Meldungen darf keine Riesenantwort erzeugen (Wurzel 8).
_MAX_LIMIT = 100


class GlockeService:
    """Liest und quittiert die Benachrichtigungen des eingeloggten Nutzers."""

    def __init__(self, db: Client) -> None:
        self._db = db

    @staticmethod
    def _scope(ctx: AuthContext) -> tuple[str, str]:
        """(user_id, tenant_id) — beides Pflicht, sonst kein Zugriff."""
        if not ctx.user_id or not ctx.tenant_id:
            # Fail-closed (Wurzel 5): ohne Nutzer- UND Mandanten-Kontext gibt es
            # keinen Scope — dann lieber 403 als eine ungefilterte Abfrage.
            raise HTTPException(status_code=403, detail="Kein Konto-Kontext.")
        return str(ctx.user_id), str(ctx.tenant_id)

    def liste(
        self, ctx: AuthContext, *, nur_ungelesen: bool = False, limit: int = 30
    ) -> list[dict[str, Any]]:
        """Die eigenen Meldungen, neueste zuerst."""
        user_id, tenant_id = self._scope(ctx)
        anfrage = (
            self._db.table("notifications")
            .select(
                "id, kategorie, titel, text, ziel_pfad, property_id, "
                "gelesen_am, created_at"
            )
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
        )
        if nur_ungelesen:
            anfrage = anfrage.is_("gelesen_am", "null")
        return (
            anfrage.order("created_at", desc=True)
            .limit(max(1, min(limit, _MAX_LIMIT)))
            .execute()
        ).data or []

    def ungelesen(self, ctx: AuthContext) -> int:
        """Zahl fuer das Abzeichen an der Glocke."""
        user_id, tenant_id = self._scope(ctx)
        # `count="exact"` statt die Zeilen zu holen: die Glocke braucht nur die
        # Zahl, und bei vielen Meldungen ist das der Unterschied zwischen einem
        # Zaehler und einer Volltabelle ueber die Leitung.
        antwort = (
            self._db.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .is_("gelesen_am", "null")
            .limit(1)
            .execute()
        )
        return int(getattr(antwort, "count", 0) or 0)

    def als_gelesen(self, ctx: AuthContext, notification_id: str) -> None:
        """EINE Meldung quittieren.

        Idempotent (Wurzel 2): eine bereits gelesene oder fremde Meldung ist kein
        Fehler — der Knopf ist wiederholbar, und ein 404 auf eine fremde ID
        verriete, dass sie existiert.

        `gelesen_am` wird NICHT ueberschrieben, wenn es schon steht: sonst
        wanderte der Zeitpunkt bei jedem Klick nach vorn.
        """
        user_id, tenant_id = self._scope(ctx)
        self._db.table("notifications").update(
            {"gelesen_am": datetime.now(UTC).isoformat()}
        ).eq("id", notification_id).eq("user_id", user_id).eq(
            "tenant_id", tenant_id
        ).is_("gelesen_am", "null").execute()

    def alle_gelesen(self, ctx: AuthContext) -> int:
        """Alles quittieren. Zurueck kommt, wie viele es wirklich waren."""
        user_id, tenant_id = self._scope(ctx)
        betroffen = (
            self._db.table("notifications")
            .update({"gelesen_am": datetime.now(UTC).isoformat()})
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .is_("gelesen_am", "null")
            .execute()
        ).data or []
        log.info(
            "glocke_alle_gelesen", user_id=user_id, anzahl=len(betroffen)
        )
        return len(betroffen)
