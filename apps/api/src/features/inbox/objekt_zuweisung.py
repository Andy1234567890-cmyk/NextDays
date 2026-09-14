"""Objekt-Zuweisung der Nachrichten-Automatisierungen (14.09.2026).

Eine Regel gilt für „alle Objekte" (``property_ids`` NULL/leer) oder für eine
feste Liste. Die Oberfläche bot bis heute nur die feste Liste an: wer im
Auswahl-Dialog alle Häuser anhakte, speicherte ihre IDs — und jedes später
angelegte Haus fiel aus der Regel. Live (AirSmil): vier Regeln trugen die 18
Objekte vom 31.08.; „Feriehus Snerlebo" und „Feriehus Merete" kamen am 06.09.
dazu, die erste Booking.com-Buchung für Snerlebo bekam keine
Buchungsbestätigung — und niemand erfuhr davon.

Zwei Regeln schließen das:

* **Normieren beim Speichern**: deckt die Liste alle aktiven Objekte des
  Betriebs ab, wird NULL gespeichert — „alle" heißt dann auch künftig alle.
* **Einordnen beim Anlegen eines Objekts**: Regeln, deren Liste bis dahin
  alle übrigen Objekte enthielt, waren offensichtlich als „alle" gemeint —
  das neue Objekt wird aufgenommen und die Liste normiert. Regeln mit echter
  Teilmenge bleiben unangetastet; der Betrieb bekommt dafür EINE
  Glocken-Meldung (``melde_systemwarnung``), welche Regeln das neue Objekt
  nicht abdecken. Ein stiller Zustand, der Gästen Post vorenthält, ist
  derselbe Fehler wie ein verschluckter Exception (Wurzel 5).
"""

from __future__ import annotations

from datetime import datetime

from supabase import Client

from src.core.logging import get_logger
from src.features.notification_settings.betriebsmeldungen import melde_systemwarnung

log = get_logger("nextdays.inbox.objekt_zuweisung")

# Glocken-Text (Teilkatalog mail_texte_automationen): {objekt}, {regeln}.
TEXT_NICHT_ABGEDECKT = "benachrichtigung.automation_objekt_fehlt"

# Zweiter stiller Zustand derselben Familie: {anzahl}, {objekte}.
TEXT_ZEITZONE_FEHLT = "benachrichtigung.automation_zeitzone_fehlt"


def aktive_objekt_ids(db: Client, tenant_id: str) -> set[str]:
    """Alle nicht archivierten Objekte des Betriebs (Wurzel 3: tenant-gescopt)."""
    rows = (
        db.table("properties")
        .select("id")
        .eq("tenant_id", tenant_id)
        .is_("archived_at", "null")
        .execute()
    ).data or []
    return {str(r["id"]) for r in rows}


def zuweisung_normieren(
    property_ids: list[str] | None, alle: set[str]
) -> list[str] | None:
    """Liste → NULL, wenn sie jedes aktive Objekt enthält (= „alle").

    Reine Funktion, damit sie ohne DB prüfbar ist. Eine Liste, die Objekte
    enthält, die es nicht (mehr) gibt, bleibt als Liste stehen — sie ist
    eine Teilmenge des Bestands, keine „alle"-Aussage."""
    ids = [str(p) for p in (property_ids or []) if p]
    if not ids:
        return None
    if alle and alle <= set(ids):
        return None
    return ids


def neues_objekt_einordnen(db: Client, tenant_id: str, property_id: str) -> dict:
    """Ein neu angelegtes Objekt in die Regeln des Betriebs einordnen.

    Gibt ``{"aufgenommen": n, "nicht_abgedeckt": [Regelnamen]}`` zurück.
    Best-effort: kippt die Objektanlage nie — der Aufrufer fängt breit."""
    alle = aktive_objekt_ids(db, tenant_id)
    uebrige = alle - {str(property_id)}
    regeln = (
        db.table("message_automation")
        .select("id, name, property_ids, is_active")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    aufgenommen = 0
    nicht_abgedeckt: list[str] = []
    for regel in regeln:
        liste = [str(p) for p in (regel.get("property_ids") or []) if p]
        if not liste:
            continue  # gilt schon für alle
        if str(property_id) in liste:
            continue
        if uebrige and uebrige <= set(liste):
            # War „alle" gemeint: neues Objekt gehört dazu → als NULL normieren.
            db.table("message_automation").update({"property_ids": None}).eq(
                "tenant_id", tenant_id
            ).eq("id", regel["id"]).execute()
            aufgenommen += 1
            continue
        if regel.get("is_active"):
            nicht_abgedeckt.append(str(regel.get("name") or regel["id"]))
    if nicht_abgedeckt:
        melde_systemwarnung(
            db,
            tenant_id=tenant_id,
            text_key=TEXT_NICHT_ABGEDECKT,
            werte={"regeln": ", ".join(sorted(nicht_abgedeckt))},
            dedup_key=f"automation_objekt_fehlt:{property_id}",
            ziel_pfad="/posteingang",
            property_id=str(property_id),
        )
    log.info(
        "automation_objekt_eingeordnet",
        tenant_id=tenant_id,
        property_id=str(property_id),
        aufgenommen=aufgenommen,
        nicht_abgedeckt=len(nicht_abgedeckt),
    )
    return {"aufgenommen": aufgenommen, "nicht_abgedeckt": nicht_abgedeckt}


def neues_objekt_einordnen_still(db: Client, tenant_id: str, property_id: str) -> None:
    """Hülle für Schreibpfade der Objektanlage (properties.create/duplicate):
    kippt die Anlage nie (Wurzel 5), ist aber LAUT im Log — ein stummer
    Ausfall hier hieße wieder, dass ein neues Haus unbemerkt aus den Regeln
    fällt."""
    try:
        neues_objekt_einordnen(db, tenant_id, property_id)
    except Exception as exc:  # noqa: BLE001 — Anlage bleibt gültig
        log.error(
            "automation_objekt_einordnen_fehlgeschlagen",
            tenant_id=tenant_id,
            property_id=property_id,
            error=str(exc)[:200],
        )


def melde_fehlende_zeitzonen(
    db: Client, tenant_id: str, objekte: set[str], jetzt: datetime
) -> None:
    """EINE Glocke je Betrieb: „Objekte ohne Zeitzone blockieren Automails".

    Bis 09/2026 stand dieser Zustand ausschließlich in `log.warning` — einer
    Zeile je Buchung und Regel, die im Serverlog steht und die kein Betrieb
    je sieht. Der Effekt war aber seiner: eine Regel mit Ortszeit-Pflicht an
    einem Objekt ohne `timezone` plant NICHTS, dauerhaft, ohne Fehler in der
    Oberfläche. Die Regel sieht dabei aktiv aus.

    EINE Meldung, nicht eine je Objekt: der Handgriff ist derselbe (Zeitzone
    an den Objekten nachtragen), und eine Meldung je Objekt entwertet die
    übrigen. Entdoppelt je Betrieb und TAG — der Lauf geht stündlich, ein
    dedup_key ohne Datum verstummte nach der ersten Meldung für immer, einer
    ohne Entdopplung erzeugte 24 Glocken am Tag (Wurzel 2).

    Best-effort im Kern von `melde_systemwarnung`; hier wird der Aufruf
    bewusst nicht noch einmal umhüllt.
    """
    if not objekte:
        return
    titel = sorted(
        str(r.get("title") or r["id"])
        for r in (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(objekte))
            .execute()
        ).data
        or []
    )
    melde_systemwarnung(
        db,
        tenant_id=tenant_id,
        text_key=TEXT_ZEITZONE_FEHLT,
        werte={
            "anzahl": len(objekte),
            "objekte": ", ".join(titel) or str(len(objekte)),
        },
        dedup_key=f"automail_zeitzone:{tenant_id}:{jetzt.date().isoformat()}",
        ziel_pfad="/objekte",
    )


TEXT_GAST_UNERREICHBAR = "benachrichtigung.automation_gast_unerreichbar"


def melde_gast_unerreichbar(
    db: Client, tenant_id: str, thread_id: str, property_id: str | None
) -> None:
    """EINE Glocke je Buchung: „Gast ohne E-Mail — Automails koennen nicht raus".

    Der Handgriff ist die Adresse an der Buchung; danach hebt die naechste
    Planung die stillgelegten Zeilen zurueck auf 'pending'. Entdoppelt je Thread
    (der Zustand aendert sich erst, wenn jemand die Adresse nachtraegt).
    Best-effort im Kern von `melde_systemwarnung`."""
    melde_systemwarnung(
        db,
        tenant_id=tenant_id,
        text_key=TEXT_GAST_UNERREICHBAR,
        werte={},
        dedup_key=f"automail_gast_unerreichbar:{thread_id}",
        ziel_pfad=f"/posteingang/{thread_id}",
        property_id=property_id,
    )
