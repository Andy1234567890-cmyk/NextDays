"""Zählpunkte: die Inventur hängt am Turnover, nicht in einem eigenen Bereich.

WARUM SO UND NICHT ALS EIGENER BEREICH: Recherche der Praxis (Guesty,
Breezeway, Sortly) zeigt einhellig, dass die Zählung dort passiert, wo ohnehin
jemand steht — bei der Reinigung nach der Abreise. Ein getrennter Bereich, den
jemand extra öffnen müsste, wird nicht gepflegt, und eine ungepflegte
Inventarliste ist schlimmer als keine: sie täuscht Sicherheit vor.

Guestys Formulierung ist „the inspection must be an integral part of the
turnover workflow, not an afterthought". Genau das baut dieses Modul: aus den
Inventarzeilen mit `zaehl_rhythmus='jede_abreise'` werden Punkte der
Reinigungs-Checkliste. Die Reinigungskraft hakt ab oder trägt die gezählte
Menge ein — in derselben Ansicht, in der sie ohnehin arbeitet, und ohne die
Kartei zu sehen (dort stehen IBAN und Türcodes).

DREI RHYTHMEN, weil 200 Zeilen auf jeder Abreise niemand abhakt:
  * `jede_abreise` — Wertsachen und Verbrauchsgüter
  * `quartal`      — Möbel, Geräte
  * `jaehrlich`    — der Rest
  * `nie`          — Zeilen, die nur der Vollständigkeit halber dastehen

Der Meldebestand (Guestys „par level") schliesst den Kreis: fällt die gezählte
Menge darunter, entsteht eine Nachfüll-Aufgabe — genau einmal, nicht bei jedem
Turnover (Wurzel 2, Anker `inventory_items.nachfuell_task_id`).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.tasks.inventur")

# Wie viele Zählpunkte höchstens an EINE Abreise-Aufgabe gehängt werden.
# Wurzel 8: ohne Deckel stünden bei einem grossen Haus hundert Punkte auf der
# Liste, und die Reinigungskraft hakte sie blind ab — das wäre schlechter als
# gar keine Zählung.
MAX_ZAEHLPUNKTE = 25

# Wann eine Zeile im jeweiligen Rhythmus wieder fällig ist.
_FAELLIG_NACH_TAGEN = {"quartal": 90, "jaehrlich": 365}


def _faellig(zeile: dict, heute: date) -> bool:
    """Ist diese Zeile heute zu zählen?

    `jede_abreise` immer. Die anderen erst, wenn seit der letzten Zählung genug
    Zeit vergangen ist — eine nie gezählte Zeile (`zuletzt_gezaehlt_am` NULL)
    ist fällig, nicht „frisch": nicht gezählt ist nicht dasselbe wie gezählt
    und in Ordnung (Wurzel 4).
    """
    rhythmus = str(zeile.get("zaehl_rhythmus") or "jaehrlich")
    if rhythmus == "nie":
        return False
    if rhythmus == "jede_abreise":
        return True
    tage = _FAELLIG_NACH_TAGEN.get(rhythmus)
    if tage is None:
        return False
    zuletzt = zeile.get("zuletzt_gezaehlt_am")
    if not zuletzt:
        return True
    try:
        stand = datetime.fromisoformat(str(zuletzt).replace("Z", "+00:00")).date()
    except ValueError:
        # Ein unlesbarer Zeitstempel heisst „unbekannt", also fällig — nicht
        # „kürzlich gezählt".
        return True
    return heute - stand >= timedelta(days=tage)


def _label(zeile: dict) -> str:
    """Die Frage, die auf der Checkliste steht.

    Mit Soll-Menge, wo es eine gibt: „Weingläser (6)" ist zählbar,
    „Weingläser" nicht.
    """
    name = str(zeile.get("name") or "").strip() or "Gegenstand"
    soll = zeile.get("soll_menge")
    return f"{name} ({soll})" if soll else name


def zaehlpunkte_fuer_abreise(
    db: Client, tenant_id: str, property_id: str | None, *, heute: date | None = None
) -> list[dict[str, object]]:
    """Die Inventarzeilen, die auf DIESE Abreise-Checkliste gehören.

    Rückgabe im Format von `task_rule_items`, damit `_copy_checklist` sie
    unverändert übernehmen kann — eine zweite Kopierfunktion wäre eine zweite
    Stelle, an der `requires_photo` irgendwann anders behandelt wird.
    """
    if not property_id:
        return []
    tag = heute or datetime.now(UTC).date()
    zeilen = (
        db.table("inventory_items")
        .select(
            "id, name, soll_menge, zaehl_rhythmus, zuletzt_gezaehlt_am, art, "
            "meldebestand, room_id"
        )
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .neq("zaehl_rhythmus", "nie")
        .order("name")
        .limit(500)
        .execute()
    ).data or []

    faellige = [z for z in zeilen if _faellig(z, tag)]
    # Erst die, die bei JEDER Abreise dran sind — wird der Deckel erreicht,
    # fallen die selteneren Rhythmen heraus, nicht die wichtigen.
    faellige.sort(key=lambda z: 0 if z.get("zaehl_rhythmus") == "jede_abreise" else 1)
    return [
        {
            "label": _label(z),
            "description": None,
            "room": None,
            # Kein Foto-Zwang je Zählpunkt: 25 Pflichtfotos je Turnover wären
            # das Ende der Zählung. Das Foto verlangt der Schadensweg, wenn
            # wirklich etwas fehlt.
            "requires_photo": False,
            "inventory_item_id": z["id"],
        }
        for z in faellige[:MAX_ZAEHLPUNKTE]
    ]


def zaehle_menge(
    db: Client,
    tenant_id: str,
    *,
    item_id: str,
    inventory_item_id: str,
    property_id: str | None,
    menge: int,
    user_id: str | None,
) -> dict[str, object]:
    """Eine gezählte Menge eintragen und den Kreis schliessen.

    Drei Dinge passieren:
      1. Die Menge steht am Checklistenpunkt (Beleg: WER hat WANN WAS gezählt).
      2. Der Ist-Stand der Inventarzeile wird nachgeführt, `zuletzt_gezaehlt_am`
         gesetzt — sonst bliebe die Zeile ewig „faellig".
      3. Unterschreitet die Menge den Meldebestand, entsteht EINE
         Nachfuell-Aufgabe. Genau eine: der Anker `nachfuell_task_id` haelt
         fest, dass schon eine offene existiert (Wurzel 2) — sonst stuenden
         nach drei Abreisen drei gleiche Aufgaben da.

    Rueckgabe: was passiert ist, damit die Oberflaeche es sagen kann statt es
    zu verschweigen.
    """
    menge = max(0, int(menge))
    (
        db.table("checklist_items")
        .update({"gezaehlte_menge": menge})
        .eq("id", item_id)
        .execute()
    )

    zeilen = (
        db.table("inventory_items")
        .select("id, name, soll_menge, meldebestand, nachfuell_task_id, art")
        .eq("id", inventory_item_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        # Der Gegenstand wurde zwischenzeitlich entfernt. Die Zahl am Punkt
        # bleibt stehen — sie ist trotzdem der Beleg, dass gezaehlt wurde.
        return {"gezaehlt": menge, "nachfuellen": False}
    zeile = zeilen[0]

    (
        db.table("inventory_items")
        .update(
            {
                "quantity": menge,
                "zuletzt_gezaehlt_am": datetime.now(UTC).isoformat(),
                "geprueft_am": datetime.now(UTC).isoformat(),
                "geprueft_von": user_id,
            }
        )
        .eq("id", inventory_item_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )

    fehlbestand = _fehlbestand(zeile, menge)
    nachfuellen = _nachfuellen_noetig(db, tenant_id, zeile, menge)
    task_id = None
    if nachfuellen:
        task_id = _nachfuell_aufgabe(
            db, tenant_id, property_id, zeile, gezaehlt=menge
        )
        if task_id:
            (
                db.table("inventory_items")
                .update({"nachfuell_task_id": task_id})
                .eq("id", inventory_item_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
    log.info(
        "inventur_gezaehlt",
        tenant_id=tenant_id,
        inventory_item_id=inventory_item_id,
        menge=menge,
        fehlbestand=fehlbestand,
        nachfuell_task=bool(task_id),
    )
    return {
        "gezaehlt": menge,
        "fehlbestand": fehlbestand,
        "nachfuellen": bool(task_id),
        "nachfuell_task_id": task_id,
    }


def _fehlbestand(zeile: dict, gezaehlt: int) -> int:
    """Wie viele fehlen gegenueber dem SOLL. 0 heisst vollzaehlig.

    Ohne gepflegtes Soll gibt es keinen Fehlbestand — nicht „alles fehlt".
    """
    soll = zeile.get("soll_menge")
    if soll is None:
        return 0
    return max(0, int(soll) - gezaehlt)


def _nachfuellen_noetig(
    db: Client, tenant_id: str, zeile: dict, gezaehlt: int
) -> bool:
    """Meldebestand unterschritten UND noch keine offene Aufgabe?

    Der Anker allein reicht nicht: er kann auf eine Aufgabe zeigen, die
    laengst erledigt ist. Deshalb wird ihr Status mitgeprueft — sonst gaebe es
    nach dem ersten Nachfuellen nie wieder eine Meldung (der umgekehrte
    Fehler, und der stille).
    """
    schwelle = zeile.get("meldebestand")
    if schwelle is None or gezaehlt > int(schwelle):
        return False
    anker = zeile.get("nachfuell_task_id")
    if not anker:
        return True
    offen = (
        db.table("tasks")
        .select("id, status")
        .eq("id", anker)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not offen:
        return True
    return str(offen[0].get("status") or "") in ("done", "cancelled")


def _nachfuell_aufgabe(
    db: Client,
    tenant_id: str,
    property_id: str | None,
    zeile: dict,
    *,
    gezaehlt: int,
) -> str | None:
    """Die Nachfuell-Aufgabe. Best-effort — sie darf die Zaehlung nicht kippen.

    Der Titel traegt die Zahlen: „Nachfuellen: Handtuecher (3 von 12)". Ohne
    sie muesste die Person, die sie abarbeitet, erst nachsehen, wie viele
    fehlen.
    """
    name = str(zeile.get("name") or "Gegenstand")
    soll = zeile.get("soll_menge")
    zusatz = f" ({gezaehlt} von {soll})" if soll else f" (noch {gezaehlt})"
    try:
        res = (
            db.table("tasks")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "title": f"Nachfüllen: {name}{zusatz}",
                    "status": "open",
                }
            )
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — Aufgabe darf die Zaehlung nicht kippen
        log.error("inventur_nachfuell_aufgabe_fehlgeschlagen", error=str(exc)[:300])
        return None
    return str(res.data[0]["id"]) if res.data else None
