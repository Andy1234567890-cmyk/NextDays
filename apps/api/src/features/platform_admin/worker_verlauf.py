"""Worker-Verlauf fürs Backoffice — Liste, Kennzahlen, Details (0379).

WAS HIER ANDERS IST ALS IM ABO:
`worker_ereignis` trägt nur Metadaten, weil die Tabelle per Grant für
`authenticated` lesbar sein MUSS (sonst wäre das Realtime-Abo eine stumme
Attrappe) und deshalb nichts enthalten darf, was ein Betriebs-Nutzer über den
DB-Direktpfad nicht sehen soll (Wurzel 6).

Dieses Modul läuft mit der Service-Role hinter `is_platform_admin` und zeigt
ALLES: die vollständigen Request- und Response-Bodies aus `channex_debug_log`,
die komplette Job-Nutzlast samt `last_error`, die rohe Webhook-Payload. Nichts
wird gekürzt oder maskiert — genau dafür ist der Endpunkt da.

WARUM DIE DETAILS NACHGELADEN WERDEN UND NICHT IN DER LISTE STEHEN:
Ein einzelner Channex-Request-Body kann Hunderte ARI-Zeilen tragen. In einer
Liste von 200 Ereignissen wären das Megabyte pro Aufruf, für Daten, die man erst
beim Aufklappen einer Zeile sieht.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from . import objekt_suche, worker_stillstand
from .schemas import (
    WorkerDetail,
    WorkerEreignis,
    WorkerEreignisListe,
    WorkerKennzahl,
    WorkerKennzahlen,
)

log = get_logger("nextdays.platform_admin.worker")

_TABELLE = "worker_ereignis"

# Welche Quelltabelle welche Detailfelder liefert. Explizit statt `select("*")`:
# so fällt eine umbenannte Spalte beim Test auf, statt still zu fehlen.
_DETAIL_FELDER = {
    "jobs": (
        "id, job_type, status, payload, attempts, max_attempts, last_error, "
        "run_after, dedup_key, defer_count, created_at, updated_at"
    ),
    "channex_debug_log": (
        "id, step, channex_method, channex_path, request_body, response_body, "
        "channex_id, http_status, duration_ms, ok, error, created_at"
    ),
    "channex_webhook_event": (
        "id, event, payload, severity, resolved, live_feed_event_id, "
        "resolution, resolved_at, created_at"
    ),
}


def _zeile(row: dict[str, Any], titel: dict[str, str]) -> WorkerEreignis:
    property_id = row.get("property_id")
    return WorkerEreignis(
        id=str(row["id"]),
        richtung=str(row.get("richtung") or "?"),
        vorgang=str(row.get("vorgang") or "?"),
        ergebnis=str(row.get("ergebnis") or "?"),
        tenant_id=str(row["tenant_id"]) if row.get("tenant_id") else None,
        property_id=str(property_id) if property_id else None,
        objekt=titel.get(str(property_id)) if property_id else None,
        quelle_tabelle=row.get("quelle_tabelle"),
        quelle_id=str(row["quelle_id"]) if row.get("quelle_id") else None,
        http_methode=row.get("http_methode"),
        http_pfad=row.get("http_pfad"),
        http_status=row.get("http_status"),
        dauer_ms=row.get("dauer_ms"),
        fehler_text=row.get("fehler_text"),
        versuche=row.get("versuche"),
        zusammenfassung=row.get("zusammenfassung"),
        kennzahlen=row.get("kennzahlen"),
        erfasst_at=str(row.get("erfasst_at")),
        # 0392: abgehakt oder nicht. Ohne dieses Feld zeigte die Liste einen
        # längst behobenen Fehler für immer als offen.
        resolved=bool(row.get("resolved")),
    )


def liste(  # noqa: PLR0913 — jeder Filter ist eine eigene Achse der Ansicht
    db: Client,
    *,
    limit: int = 100,
    offset: int = 0,
    richtung: str | None = None,
    vorgang: str | None = None,
    nur_fehler: bool = False,
    property_id: str | None = None,
    suche: str | None = None,
) -> WorkerEreignisListe:
    """Der Verlauf, neueste zuerst — serverseitig paginiert.

    Paginierung ist keine Bequemlichkeit: die Tabelle wächst um ~1.400 Jobs und
    ~520 Portal-Aufrufe je Tag (live gemessen). Ein „alles laden" wäre nach
    einer Woche ein Request über 13.000 Zeilen.

    `suche` trifft den OBJEKTNAMEN. Anders als beim Webhook-Monitor tragen hier
    die MEISTEN Zeilen gar keine `property_id` — live 1.483 von 2.376 (Ticks,
    Feed-Läufe, Warteschlangen-Arbeit gelten keinem einzelnen Objekt). Eine
    Suche blendet sie zwangsläufig aus; die Oberfläche benennt das, damit es
    nicht wie ein Defekt aussieht.
    """
    treffer_ids: list[str] | None = None
    if suche and suche.strip():
        treffer_ids = objekt_suche.property_ids_zu_suche(db, suche)
        if not treffer_ids:
            # Kein Objekt passt — den Filter jetzt wegzulassen zeigte die
            # ungefilterte Liste (Wurzel 4).
            return WorkerEreignisListe(
                items=[], gesamt=0, offset=offset, limit=limit
            )

    query = db.table(_TABELLE).select("*", count="exact")
    if treffer_ids is not None:
        query = query.in_("property_id", treffer_ids)
    if richtung:
        query = query.eq("richtung", richtung)
    if vorgang:
        query = query.eq("vorgang", vorgang)
    if nur_fehler:
        query = query.eq("ergebnis", "fehler")
    if property_id:
        query = query.eq("property_id", property_id)
    res = (
        query.order("erfasst_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = res.data or []

    # Objektnamen in EINER Abfrage nachziehen. Ein Join je Zeile wäre bei 100
    # Zeilen 100 Roundtrips; PostgREST kann hier nicht joinen, weil
    # `worker_ereignis.property_id` bewusst keinen FK trägt (das Objekt darf
    # verschwinden, das Ereignis bleibt wahr).
    ids = sorted({str(r["property_id"]) for r in rows if r.get("property_id")})
    titel: dict[str, str] = {}
    if ids:
        for p in (
            db.table("properties").select("id, title").in_("id", ids).execute()
        ).data or []:
            titel[str(p["id"])] = str(p.get("title") or p["id"])

    return WorkerEreignisListe(
        items=[_zeile(r, titel) for r in rows],
        gesamt=res.count if res.count is not None else len(rows),
        offset=offset,
        limit=limit,
    )


def kennzahlen(db: Client, *, stunden: int = 24) -> WorkerKennzahlen:
    """Was der Worker im Zeitfenster getan hat, je Vorgang.

    Die Fehlerquote steht je Vorgang und nicht nur als Gesamtzahl: live sind 3
    von 522 Portal-Aufrufen fehlgeschlagen — als Gesamtquote (0,6 %) sieht das
    nach nichts aus, während ein einzelner Vorgang zu 100 % scheitern kann.
    """
    seit = (datetime.now(UTC) - timedelta(hours=stunden)).isoformat()
    # Nur die Spalten, die gezählt werden — die Nutzlast interessiert hier nicht.
    rows = (
        db.table(_TABELLE)
        .select("richtung, vorgang, ergebnis, dauer_ms")
        .gte("erfasst_at", seit)
        .execute()
    ).data or []

    gruppen: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        schluessel = (str(r.get("richtung")), str(r.get("vorgang")))
        g = gruppen.setdefault(
            schluessel, {"anzahl": 0, "fehler": 0, "dauern": []}
        )
        g["anzahl"] += 1
        if r.get("ergebnis") == "fehler":
            g["fehler"] += 1
        if r.get("dauer_ms") is not None:
            g["dauern"].append(int(r["dauer_ms"]))

    items: list[WorkerKennzahl] = []
    for (richtung, vorgang), g in gruppen.items():
        dauern: list[int] = g["dauern"]
        items.append(
            WorkerKennzahl(
                richtung=richtung,
                vorgang=vorgang,
                anzahl=g["anzahl"],
                fehler=g["fehler"],
                dauer_avg_ms=round(sum(dauern) / len(dauern)) if dauern else None,
                dauer_max_ms=max(dauern) if dauern else None,
            )
        )
    items.sort(key=lambda k: k.anzahl, reverse=True)

    # Warteschlange: was JETZT offen ist. Nicht aus `worker_ereignis` — dort
    # steht nur, was schon passiert IST (Wurzel 5b: der Verlauf ist kein
    # Zustand).
    offen = (
        db.table("jobs")
        .select("id", count="exact")
        .in_("status", ["queued", "running"])
        .execute()
    )
    tot = (
        db.table("jobs")
        .select("id", count="exact")
        .eq("status", "dead")
        .execute()
    )
    return WorkerKennzahlen(
        stunden=stunden,
        items=items,
        ereignisse=len(rows),
        fehler=sum(k.fehler for k in items),
        warteschlange=offen.count or 0,
        aufgegeben=tot.count or 0,
        # Was AUSBLEIBT — die einzige Kennzahl hier, die kein Zählwerk ist.
        # Alle übrigen zählen Geschehenes und standen beim 16-Stunden-Ausfall
        # am 13.08.2026 auf „0 Fehler", während der Buchungs-Feed still war.
        stillstand=worker_stillstand.stillstand(db),
    )


def detail(db: Client, ereignis_id: str) -> WorkerDetail:
    """Die VOLLSTÄNDIGE Quellzeile eines Ereignisses.

    Alles, was da ist: Request- und Response-Body, Job-Nutzlast, rohe
    Webhook-Payload, Fehlermeldung. Ungekürzt — das ist der Sinn des Endpunkts.

    Ist die Quellzeile nicht mehr da (aufgeräumt) oder trug das Ereignis keine,
    kommt `quelle=None` zurück. Kein leeres Objekt, das wie „nichts drin"
    aussieht (Wurzel 4).
    """
    treffer = (
        db.table(_TABELLE).select("*").eq("id", ereignis_id).limit(1).execute()
    ).data or []
    if not treffer:
        return WorkerDetail(ereignis=None, quelle=None)

    row = treffer[0]
    ereignis = _zeile(row, {})
    tabelle = row.get("quelle_tabelle")
    quelle_id = row.get("quelle_id")
    if not tabelle or not quelle_id or tabelle not in _DETAIL_FELDER:
        return WorkerDetail(ereignis=ereignis, quelle=None)

    try:
        quelle = (
            db.table(str(tabelle))
            .select(_DETAIL_FELDER[str(tabelle)])
            .eq("id", str(quelle_id))
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — Detail-Fehler kippt die Ansicht nicht
        log.warning(
            "worker_detail_quelle_nicht_lesbar",
            tabelle=tabelle,
            fehler=str(exc)[:200],
        )
        return WorkerDetail(ereignis=ereignis, quelle=None)

    return WorkerDetail(
        ereignis=ereignis,
        quelle=quelle[0] if quelle else None,
    )
