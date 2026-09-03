"""Genehmigung der bestellten Leistungen JE ZEILE (0538).

Ausgelagert aus `sperrantraege.py`, weil das Modul seine 1500 Zeilen erreicht
hatte — und weil es ein eigener Gegenstand ist: hier geht es nicht um die
Sperre, sondern um die Arbeit, die der Eigentümer dazu bestellt hat.

WARUM ES DIESE STUFE GIBT: Bis 0538 fuhren die Bestellungen
(`block_request_services`, 0510) mit der Genehmigung des ANTRAGS blind mit —
Antrag genehmigt = alle Leistungen genehmigt, ohne dass die Agentur sie im
Prüfdialog überhaupt sah. Vorgabe des Betriebs (03.09.2026): „ein Eigentümer
muss eine Reinigung buchen und eine Endreinigung. Die muss genehmigt werden von
der Agentur." Genehmigt wird also die LEISTUNG, einzeln. Eine Sperre kann
genehmigt und die Endreinigung dazu abgelehnt sein.

Nur `genehmigt` wird zur Aufgabe (`tasks.eigennutzung.bestellte_regeln`).
"""

from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import BlockRequestDecision, LeistungEntscheidung
from .service import CalendarError

log = get_logger("nextdays.calendar.sperrantrag_leistungen")


def leistungen_pruefen(
    db: Client, antrag_id: str, req: BlockRequestDecision
) -> dict[str, LeistungEntscheidung]:
    """Die Entscheidungen der Agentur gegen die BESTELLTEN Leistungen prüfen.

    Zwei Fehler, beide 422 und beide VOR dem Claim:
      * eine Entscheidung zu einer Leistung, die gar nicht bestellt ist —
        die Oberfläche hätte sie nie anbieten dürfen;
      * eine bestellte Leistung OHNE Entscheidung. Sie stumm als genehmigt
        zu werten wäre die blinde Mitgenehmigung von vor 0538; sie stumm
        abzulehnen würde eine Bestellung wortlos verwerfen. Beides sind
        erfundene Werte (Wurzel 4). Ein Client, der die Leistungen nicht
        kennt (Altstand), scheitert hier laut statt falsch zu genehmigen.

    Rückgabe: `{rule_id: Entscheidung}` — leer, wenn nichts bestellt ist.
    """
    bestellt = {
        str(z["rule_id"])
        for z in (
            db.table("block_request_services")
            .select("rule_id")
            .eq("block_request_id", antrag_id)
            .execute()
        ).data
        or []
    }
    entschieden = {e.rule_id: e for e in req.leistungen}
    if set(entschieden) - bestellt:
        raise CalendarError(
            "Eine Entscheidung betrifft eine Leistung, die zu diesem Antrag nicht bestellt ist.",
            status_code=422,
        )
    if bestellt - set(entschieden):
        raise CalendarError(
            "Für jede bestellte Leistung braucht es eine Entscheidung (genehmigen oder ablehnen).",
            status_code=422,
        )
    return entschieden


def leistungen_entscheiden(
    db: Client,
    ctx: AuthContext,
    antrag_id: str,
    entscheidungen: dict[str, LeistungEntscheidung],
) -> None:
    """Die geprüften Entscheidungen an die Bestellzeilen schreiben.

    Ein UPDATE je Zeile, gescopt auf den Antrag (Wurzel 3) und bedingt auf
    `status='angefragt'` (Wurzel 2): eine Zeile, die ein paralleler Lauf
    schon entschieden hat, wird nicht überschrieben — der Claim am Antrag
    hat dieses Rennen zwar schon entschieden, aber ein zweiter Riegel an
    der Zeile kostet nichts und sagt ehrlich, was er tut.
    """
    for rule_id, e in entscheidungen.items():
        db.table("block_request_services").update(
            {
                "status": "genehmigt" if e.genehmigt else "abgelehnt",
                "entschieden_von": ctx.user_id,
                "entschieden_am": "now()",
                "entscheidungsnotiz": (e.notiz or "").strip() or None,
            }
        ).eq("block_request_id", antrag_id).eq("rule_id", rule_id).eq(
            "status", "angefragt"
        ).execute()
    if entscheidungen:
        log.info(
            "sperrantrag_leistungen_entschieden",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            genehmigt=sum(1 for e in entscheidungen.values() if e.genehmigt),
            abgelehnt=sum(1 for e in entscheidungen.values() if not e.genehmigt),
        )


def leistungen_alle_setzen(
    db: Client, ctx: AuthContext, antrag_id: str, status: str, notiz: str | None
) -> None:
    """Alle Bestellzeilen eines Antrags auf EINEN Zustand — für Ablehnung,
    Widerruf und Claim-Rollback. Bei `angefragt` werden die
    Entscheidungsspuren gelöscht, sonst gesetzt."""
    zurueck = status == "angefragt"
    db.table("block_request_services").update(
        {
            "status": status,
            "entschieden_von": None if zurueck else ctx.user_id,
            "entschieden_am": None if zurueck else "now()",
            "entscheidungsnotiz": None if zurueck else ((notiz or "").strip() or None),
        }
    ).eq("block_request_id", antrag_id).execute()
