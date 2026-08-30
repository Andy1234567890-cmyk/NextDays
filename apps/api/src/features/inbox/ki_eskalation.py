"""Eskalation: den Verlauf markieren, melden, zurücknehmen.

ZWEI AUSLÖSER, ein Merkmal:

    Stimmung  Das Modell hat negativen Tenor erkannt — braucht keine Regel.
    Regel     Eine Regel des Betriebs mit `ist_eskalation` hat gegriffen.

Das Merkmal liegt in einer EIGENEN Tabelle (`ki_eskalation`, 0498), nicht als
Spalten an `channex_booking`. Ein Verlauf liegt je nach Quelle in einer von
zwei Tabellen; Spalten an nur einer hätten bedeutet, dass derselbe Gast über
WhatsApp nie eskalieren kann — und niemand hätte gemerkt, warum.

ZURÜCKNEHMBAR ist keine Nebensache. Eine Eskalation, die nur die KI setzen und
niemand aufheben kann, ist eine dauerhafte Markierung statt einer Aufgabe: nach
zwei Wochen wäre jeder zweite Verlauf rot und niemand sähe mehr hin.
"""
from __future__ import annotations

from datetime import UTC, datetime

from httpx import HTTPError
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.notification_settings.ereignisse import melde_ki_eskalation

from .errors import InboxError
from .schemas import KiEskalation, KiEskalationList

log = get_logger("nextdays.inbox.ki_eskalation")

# Der Konflikt-Code des partiellen UNIQUE aus 0498: ein Verlauf ist entweder
# eskaliert oder nicht.
_DOPPELT = "23505"

MAX_LISTE = 100
MAX_GRUND = 500


class KiEskalationMixin:
    """Eskalation. Teil von `InboxService`."""

    _db: Client | None

    # -- Setzen -----------------------------------------------------------------
    def eskalation_setzen(
        self,
        db: Client,
        tenant_id: str,
        *,
        thread_id: str,
        quelle: str,
        ausloeser: str,
        grund: str,
        regel_id: str | None = None,
        nachricht_auszug: str | None = None,
        property_id: str | None = None,
        gast_vorname: str | None = None,
        benachrichtigen: bool = False,
    ) -> bool:
        """Einen Verlauf eskalieren. True = neu gesetzt.

        Idempotent (Wurzel 2): der partielle UNIQUE aus 0498 lässt nur EINE
        offene Eskalation je Verlauf zu. Ein zweiter Versuch — bei einem
        hin- und hergehenden Beschwerdegespräch der Normalfall — läuft in den
        23505 und wird zu `False`, statt einen 500 zu werfen.
        """
        text = (grund or "").strip()[:MAX_GRUND]
        if not text:
            # Ohne Grund wäre die Markierung ein rotes Abzeichen ohne Aussage.
            # Das ist ein Programmfehler, kein Nutzerfehler — laut ins Log.
            log.error("ki_eskalation_ohne_grund", thread_id=thread_id)
            return False
        try:
            db.table("ki_eskalation").insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "quelle": quelle,
                    "ausloeser": ausloeser,
                    "regel_id": regel_id,
                    "grund": text,
                    "nachricht_auszug": (nachricht_auszug or "")[:2000] or None,
                }
            ).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == _DOPPELT or _DOPPELT in str(exc):
                # Schon eskaliert. KEINE zweite Meldung — sonst bekäme der
                # Betrieb eine Mail je Nachricht und schaltete die Kategorie ab.
                return False
            raise
        log.info(
            "ki_eskaliert",
            tenant_id=tenant_id,
            thread_id=thread_id,
            ausloeser=ausloeser,
        )
        if benachrichtigen:
            melde_ki_eskalation(
                db,
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=text,
                property_id=property_id,
                gast_vorname=gast_vorname,
            )
        return True

    # -- Lesen ------------------------------------------------------------------
    def eskalationen_offen(self, ctx: AuthContext) -> KiEskalationList:
        """Alle offenen Eskalationen — die Ansicht „Eskaliert"."""
        db, tenant_id = self._require(ctx)
        zeilen = (
            db.table("ki_eskalation")
            .select(
                "id, thread_id, quelle, ausloeser, regel_id, grund, "
                "nachricht_auszug, created_at"
            )
            .eq("tenant_id", tenant_id)
            .is_("erledigt_at", "null")
            .order("created_at", desc=True)
            .limit(MAX_LISTE)
            .execute()
        ).data or []
        return KiEskalationList(
            items=[_zeile(z) for z in zeilen], total=len(zeilen)
        )

    def eskalation_fuer_thread(
        self, db: Client, tenant_id: str, thread_id: str
    ) -> KiEskalation | None:
        """Die offene Eskalation eines Verlaufs — für den Kasten im Chat.

        Fehler werden gefangen und als „keine Eskalation" gewertet: der Chat
        soll nicht wegen eines Abzeichens ausfallen. Laut geloggt, weil eine
        stumm ausbleibende Markierung sonst nie auffiele.
        """
        try:
            zeilen = (
                db.table("ki_eskalation")
                .select(
                    "id, thread_id, quelle, ausloeser, regel_id, grund, "
                    "nachricht_auszug, created_at"
                )
                .eq("tenant_id", tenant_id)
                .eq("thread_id", thread_id)
                .is_("erledigt_at", "null")
                .limit(1)
                .execute()
            ).data or []
        except (APIError, HTTPError) as exc:
            log.warning(
                "ki_eskalation_lesen_fehlgeschlagen",
                thread_id=thread_id,
                fehler=str(exc)[:200],
            )
            return None
        return _zeile(zeilen[0]) if zeilen else None

    def eskalierte_thread_ids(
        self, db: Client, tenant_id: str, thread_ids: list[str]
    ) -> set[str]:
        """Welche dieser Verläufe offen eskaliert sind — für die Liste.

        EIN Aufruf für die ganze Seite statt einer je Zeile: bei 50 Zeilen
        wären das 50 Abfragen für ein Abzeichen."""
        if not thread_ids:
            return set()
        try:
            zeilen = (
                db.table("ki_eskalation")
                .select("thread_id")
                .eq("tenant_id", tenant_id)
                .is_("erledigt_at", "null")
                .in_("thread_id", thread_ids[:MAX_LISTE])
                .execute()
            ).data or []
        except (APIError, HTTPError) as exc:
            log.warning("ki_eskalation_liste_fehlgeschlagen", fehler=str(exc)[:200])
            return set()
        return {str(z["thread_id"]) for z in zeilen}

    # -- Zurücknehmen -----------------------------------------------------------
    def eskalation_erledigen(self, ctx: AuthContext, thread_id: str) -> None:
        """Die Eskalation eines Verlaufs als erledigt markieren.

        `erledigt_at` UND `erledigt_von` zusammen — der CHECK in 0498 verlangt
        beides oder keines: eine halbe Erledigung ist ein Datenfehler, kein
        Zwischenzustand.
        """
        db, tenant_id = self._require(ctx)
        if ctx.user_id == "cron":
            # Eine Eskalation erklärt ein MENSCH für erledigt. Ein
            # automatisches Abräumen wäre genau die Markierung ohne Aufgabe,
            # die diese Tabelle vermeiden soll.
            raise InboxError(
                "Eine Eskalation kann nur eine Person erledigen.", status_code=403
            )
        getroffen = (
            db.table("ki_eskalation")
            .update(
                {
                    "erledigt_at": datetime.now(UTC).isoformat(),
                    "erledigt_von": ctx.user_id,
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .is_("erledigt_at", "null")
            .execute()
        ).data
        if not getroffen:
            raise InboxError("Keine offene Eskalation.", status_code=404)


def _zeile(r: dict) -> KiEskalation:
    return KiEskalation(
        id=str(r["id"]),
        thread_id=str(r["thread_id"]),
        quelle=r.get("quelle") or "inbox",
        ausloeser=r.get("ausloeser") or "stimmung",
        regel_id=str(r["regel_id"]) if r.get("regel_id") else None,
        grund=r.get("grund") or "",
        nachricht_auszug=r.get("nachricht_auszug"),
        created_at=r.get("created_at"),
    )
