"""Löschanträge aus dem öffentlichen Web-Formular bearbeiten (0413).

Eigenes Modul und nicht Teil von ``service.py``: derselbe Grund wie bei
``betrieb_sperre`` — der Slice-Service ist die größte Datei des Backoffice, und
diese Vorgänge hängen inhaltlich nur untereinander zusammen. Freie Funktionen
statt einer Klasse: sie brauchen keinen Zustand, nur den DB-Client und einen Weg,
den Vorgang zu protokollieren.

WAS HIER NICHT PASSIERT: Dieses Modul LÖSCHT nichts. Es führt den Vorgang
buchhalterisch — „gesehen", „erledigt", „abgelehnt". Die eigentliche Löschung
eines Betriebs liegt in ``betrieb_sperre.betrieb_loeschen`` und ist ein getrennter,
bewusst separat auszulösender Schritt. Ein Endpunkt, der beides in einem täte,
würde aus einem Häkchen im Backoffice die Vernichtung eines Betriebs machen.

WARUM ES DIESE ANSICHT BRAUCHT: Ohne sie wäre die öffentliche Seite eine
Attrappe — Anträge landen in einer Tabelle, die niemand ansieht, und die
DSGVO-Monatsfrist (Art. 12 Abs. 3) läuft trotzdem.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol

from fastapi import Request
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import PlatformContext

from .schemas import LoeschantragListe, LoeschantragZeile

log = get_logger("nextdays.platform_admin.loeschantraege")

TABELLE = "account_deletion_requests"

# Obergrenze der Liste. Jeder unbegrenzte Bereich bekommt ein hartes Dach
# (Wurzel 8) — auch im Backoffice, wo der Aufrufer vertrauenswürdig ist: eine
# Abfrage ohne Grenze wird irgendwann zur Ursache eines Timeouts.
MAX_ZEILEN = 200


class Protokoll(Protocol):  # pylint: disable=too-few-public-methods
    """Signatur von ``PlatformAdminService.log_action``."""

    def __call__(  # noqa: D102 — Signatur, kein Verhalten
        self,
        ctx: PlatformContext,
        action: str,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        tenant_id: str | None = None,
        detail: dict | None = None,
        request: Request | None = None,
    ) -> None: ...


def liste(db: Client, *, nur_offen: bool = True, limit: int = 50) -> LoeschantragListe:
    """Anträge auflisten, älteste zuerst.

    Älteste zuerst und nicht neueste: hier läuft eine gesetzliche Frist, und der
    dringendste Antrag ist der, der am längsten liegt. Eine Sortierung nach
    „neueste zuerst" würde genau den verstecken, der zuerst beantwortet werden
    muss.
    """
    grenze = max(1, min(limit, MAX_ZEILEN))
    abfrage = (
        db.table(TABELLE)
        .select(
            "id, email, status, locale, reason, requested_at, confirmed_at, "
            "resolved_at, resolution_note, matched_user_id, matched_tenant_id"
        )
        # Nur bestätigte Anträge sind echte Anträge — `pending` heißt, dass
        # niemand den Postfach-Besitz nachgewiesen hat. Diese Zeilen im
        # Backoffice zu zeigen wäre irreführend und zugleich eine Liste von
        # Adressen, die jemand FREMD eingetippt haben kann.
        .order("confirmed_at", desc=False)
        .limit(grenze)
    )
    if nur_offen:
        abfrage = abfrage.eq("status", "confirmed")
    else:
        abfrage = abfrage.in_("status", ["confirmed", "done", "rejected"])

    rows = (abfrage.execute()).data or []
    return LoeschantragListe(
        items=[LoeschantragZeile(**_zeile(r)) for r in rows],
        total=len(rows),
    )


def _zeile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id")),
        "email": row.get("email") or "",
        "status": row.get("status") or "",
        "locale": row.get("locale"),
        "grund": row.get("reason"),
        "beantragt_am": row.get("requested_at"),
        "bestaetigt_am": row.get("confirmed_at"),
        "erledigt_am": row.get("resolved_at"),
        "notiz": row.get("resolution_note"),
        "user_id": row.get("matched_user_id"),
        "tenant_id": row.get("matched_tenant_id"),
    }


def abschliessen(
    db: Client,
    ctx: PlatformContext,
    antrag_id: str,
    *,
    status: str,
    notiz: str,
    protokoll: Protokoll,
    request: Request | None = None,
) -> LoeschantragZeile | None:
    """Antrag als erledigt oder abgelehnt schließen. None = nicht gefunden.

    Der Status-Guard (`.eq("status", "confirmed")`) ist kein Beiwerk: ohne ihn
    ließe sich ein bereits geschlossener Antrag ein zweites Mal „erledigen" und
    das Protokoll würde zwei Vorgänge zeigen, wo einer war (Wurzel 2).

    Die Notiz ist Pflicht — auch bei `done`. Bei `rejected` erzwingt sie
    zusätzlich der DB-Trigger aus 0413; hier steht sie für beide Fälle, weil
    „erledigt" ohne Angabe, WAS gelöscht wurde, später nicht mehr aufklärbar ist.
    """
    if status not in ("done", "rejected"):
        raise ValueError(f"unerlaubter Zielstatus: {status}")
    text = (notiz or "").strip()
    if not text:
        raise ValueError("notiz ist Pflicht")

    jetzt = datetime.now(UTC)
    try:
        rows = (
            db.table(TABELLE)
            .update(
                {
                    "status": status,
                    "resolved_at": jetzt.isoformat(),
                    "resolved_by": ctx.user_id,
                    "resolution_note": text[:2000],
                }
            )
            .eq("id", antrag_id)
            .eq("status", "confirmed")
            .execute()
        ).data or []
    except APIError as exc:
        # Code UND Constraint mitloggen, nicht nur `str(exc)`: derselbe Pfad
        # scheiterte im Ereignis-Monitor an einem Fremdschlüssel, und im Log
        # stand nur „APIError" — die Ursache musste von Hand in der DB
        # nachgestellt werden. Ein Fehler, den man nicht sieht, ist nicht
        # behebbar (Wurzel 5).
        log.error(
            "loeschantrag_abschliessen_fehler",
            antrag=antrag_id,
            ziel_status=status,
            user_id=ctx.user_id,
            db_code=getattr(exc, "code", None),
            db_message=(getattr(exc, "message", None) or "")[:300],
            db_details=(getattr(exc, "details", None) or "")[:300],
            db_hint=(getattr(exc, "hint", None) or "")[:200],
        )
        raise

    if not rows:
        return None

    protokoll(
        ctx,
        f"account_deletion.{status}",
        target_type="account_deletion_request",
        target_id=antrag_id,
        tenant_id=rows[0].get("matched_tenant_id"),
        detail={"notiz": text[:500]},
        request=request,
    )
    log.info("loeschantrag_abgeschlossen", antrag=antrag_id, status=status)
    return LoeschantragZeile(**_zeile(rows[0]))
