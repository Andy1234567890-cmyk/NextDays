"""Webhook-Eingänge fürs Backoffice — Liste, Kennzahlen, Detail.

WOZU: Was von den Portalen bei uns eintrifft, lag nur in
`channex_webhook_event` — ohne Ansicht. Live (12.08.2026, 7 Tage) sind das 538
Ereignisse über 8 Typen, davon **18 mit `severity='error'` und ALLE unbearbeitet**:
10× `booking_unmapped_rate`, 4× `disconnect_listing`, 4× `deactivate_channel`.
Ein getrenntes Airbnb-Inserat verkauft nichts mehr — und niemand sah es.

WARUM EINE EIGENE SEITE UND NICHT DER WORKER-MONITOR:
Der Worker-Monitor zeigt, was WIR tun (Jobs, ausgehende Aufrufe). Hier steht,
was ANDERE uns schicken. Beides in eine Liste zu werfen hiesse, 538 eingehende
Ereignisse mit 1.400 Jobs am Tag zu vermischen — die Fehler der einen Seite
gingen in der Menge der anderen unter.

WARUM SERVICE-ROLE UND NICHT REALTIME-ABO:
`channex_webhook_event.payload` trägt die vollständige Portal-Nutzlast (Gastname,
Preise, Kennungen). Die Tabelle ist für `authenticated` bewusst nur
tenant-gescoped und rollenbeschränkt lesbar (admin/co_admin) — ein Grant für ein
Backoffice-Abo würde sie mandantenweit öffnen (Wurzel 6). Deshalb liest dieses
Modul mit der Service-Role hinter `is_platform_admin` und zeigt dann ALLES,
ungekürzt.

WURZEL 5b: `created_at` ist UNSER Eingang, nicht der Zeitpunkt beim Portal. Die
Oberfläche benennt die Spalte entsprechend; der echte Zeitpunkt steckt — wenn das
Portal ihn mitschickt — in der Payload.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    WebhookDetail,
    WebhookEreignis,
    WebhookEreignisListe,
    WebhookKennzahl,
    WebhookKennzahlen,
)

log = get_logger("nextdays.platform_admin.webhook")

_TABELLE = "channex_webhook_event"

# Welche Ereignisse einen EINGRIFF verlangen, nicht nur Kenntnisnahme. Live sind
# das die drei mit severity='error'; die Liste steht hier, damit die Oberfläche
# sie hervorheben kann, ohne severity zu interpretieren.
_HANDLUNGSBEDARF = {
    "disconnect_listing",
    "deactivate_channel",
    "booking_unmapped_rate",
}


def _zeile(
    row: dict[str, Any], titel: dict[str, str], betriebe: dict[str, str]
) -> WebhookEreignis:
    property_id = row.get("property_id")
    tenant_id = row.get("tenant_id")
    event = str(row.get("event") or "?")
    return WebhookEreignis(
        id=str(row["id"]),
        event=event,
        severity=str(row.get("severity") or "info"),
        resolved=bool(row.get("resolved")),
        handlungsbedarf=event in _HANDLUNGSBEDARF and not row.get("resolved"),
        tenant_id=str(tenant_id) if tenant_id else None,
        betrieb=betriebe.get(str(tenant_id)) if tenant_id else None,
        property_id=str(property_id) if property_id else None,
        objekt=titel.get(str(property_id)) if property_id else None,
        live_feed_event_id=row.get("live_feed_event_id"),
        # Zusammenfassung aus der ECHTEN Payload — nie geraten (Wurzel 4).
        zusammenfassung=_beschreiben(row.get("payload")),
        # Der Zeitpunkt BEIM PORTAL, wenn die Payload ihn trägt (`timestamp`).
        # Getrennt von `eingang_at` (unserer Uhr) geführt: die beiden liegen live
        # Minuten auseinander, und `created_at` als Portal-Zeitpunkt auszugeben
        # wäre eine Falschaussage, die niemand als Bug erkennt (Wurzel 5b).
        portal_at=_portal_zeitpunkt(row.get("payload")),
        resolved_at=str(row["resolved_at"]) if row.get("resolved_at") else None,
        eingang_at=str(row.get("created_at")),
    )


def _portal_zeitpunkt(payload: object) -> str | None:
    """Der Zeitpunkt BEIM PORTAL — aus `payload.timestamp`, sonst `None`.

    WURZEL 5b: `created_at` beschreibt UNSEREN Eingang. Live liegen die beiden
    auseinander (ein `deactivate_channel` mit `timestamp` 05:54:12.691 traf bei
    uns später ein), und bei einem Rutsch-Import tragen alle Zeilen dieselbe
    Eingangssekunde. Fehlt der Wert, kommt `None` — nie ein Rückfall auf die
    eigene Uhr.
    """
    if not isinstance(payload, dict):
        return None
    wert = payload.get("timestamp")
    return str(wert) if wert else None


def _beschreiben(payload: object) -> str | None:
    """Worum es in diesem Ereignis geht — aus der echten Payload.

    Nur Felder, die live wirklich vorkommen. Fehlt eines, fehlt es auch im Text:
    ein erfundener Objektname wäre schlimmer als ein leeres Feld, weil er
    plausibel aussieht (Wurzel 4).
    """
    if not isinstance(payload, dict):
        return None
    teile: list[str] = []
    # Der Aggregator verschachtelt je Ereignistyp unterschiedlich; beide Ebenen
    # ansehen statt eine zu erraten.
    quellen = [payload]
    for schluessel in ("payload", "data", "attributes"):
        inner = payload.get(schluessel)
        if isinstance(inner, dict):
            quellen.append(inner)

    for quelle in quellen:
        for feld in ("listing_id", "channel", "ota_name", "ota_reservation_code",
                     "booking_id", "rate_plan_code", "room_type_code", "reason"):
            wert = quelle.get(feld)
            if wert not in (None, "") and not isinstance(wert, (dict, list)):
                eintrag = f"{feld}={wert}"
                if eintrag not in teile:
                    teile.append(eintrag)
    return " · ".join(teile[:5]) or None


def liste(  # noqa: PLR0913 — jeder Filter ist eine eigene Achse der Ansicht
    db: Client,
    *,
    limit: int = 100,
    offset: int = 0,
    event: str | None = None,
    severity: str | None = None,
    nur_offen: bool = False,
    tenant_id: str | None = None,
) -> WebhookEreignisListe:
    """Die Eingänge, neueste zuerst — serverseitig paginiert.

    Sortiert nach `created_at`, UNSEREM Eingang: einen Portal-Zeitpunkt trägt die
    Tabelle nicht in einer Spalte, und den aus der Payload zu sortieren würde
    Ereignisse ohne ihn stillschweigend hinten einsortieren (Wurzel 5b).
    """
    query = db.table(_TABELLE).select("*", count="exact")
    if event:
        query = query.eq("event", event)
    if severity:
        query = query.eq("severity", severity)
    if nur_offen:
        query = query.eq("resolved", False)
    if tenant_id:
        query = query.eq("tenant_id", tenant_id)
    res = (
        query.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = res.data or []

    # Namen in je EINER Abfrage nachziehen (nicht ein Join pro Zeile).
    titel = _namen(db, "properties", "title",
                   {str(r["property_id"]) for r in rows if r.get("property_id")})
    betriebe = _namen(db, "tenants", "name",
                      {str(r["tenant_id"]) for r in rows if r.get("tenant_id")})

    return WebhookEreignisListe(
        items=[_zeile(r, titel, betriebe) for r in rows],
        gesamt=res.count if res.count is not None else len(rows),
        offset=offset,
        limit=limit,
    )


def _namen(
    db: Client, tabelle: str, spalte: str, ids: set[str]
) -> dict[str, str]:
    """`{id: Name}` für eine Menge von IDs — leer, wenn nichts anzufragen ist."""
    if not ids:
        return {}
    rows = (
        db.table(tabelle).select(f"id, {spalte}").in_("id", sorted(ids)).execute()
    ).data or []
    return {str(r["id"]): str(r.get(spalte) or r["id"]) for r in rows}


def kennzahlen(db: Client, *, stunden: int = 24) -> WebhookKennzahlen:
    """Was eingetroffen ist, je Ereignistyp — plus was davon offen ist.

    Der OFFENE Stand wird über das ganze Zeitfenster hinaus gezählt: ein
    getrenntes Inserat vom 07.08. ist heute noch getrennt. Es nur in den letzten
    24 h zu zählen liesse die Ansicht ruhig aussehen, während vier Inserate
    stillstehen — genau der Fehler, den diese Seite verhindern soll.
    """
    seit = (datetime.now(UTC) - timedelta(hours=stunden)).isoformat()
    rows = (
        db.table(_TABELLE)
        .select("event, severity, resolved")
        .gte("created_at", seit)
        .execute()
    ).data or []

    gruppen: dict[tuple[str, str], dict[str, int]] = {}
    for r in rows:
        schluessel = (str(r.get("event")), str(r.get("severity") or "info"))
        g = gruppen.setdefault(schluessel, {"anzahl": 0, "offen": 0})
        g["anzahl"] += 1
        if not r.get("resolved"):
            g["offen"] += 1

    items = [
        WebhookKennzahl(
            event=event, severity=severity, anzahl=g["anzahl"], offen=g["offen"]
        )
        for (event, severity), g in gruppen.items()
    ]
    items.sort(key=lambda k: k.anzahl, reverse=True)

    # Zeitfenster-UNABHÄNGIG: alles, was noch offen ist und Handeln verlangt.
    offen_gesamt = (
        db.table(_TABELLE)
        .select("id", count="exact")
        .eq("resolved", False)
        .in_("event", sorted(_HANDLUNGSBEDARF))
        .execute()
    )
    fehler_gesamt = (
        db.table(_TABELLE)
        .select("id", count="exact")
        .eq("resolved", False)
        .eq("severity", "error")
        .execute()
    )
    return WebhookKennzahlen(
        stunden=stunden,
        items=items,
        ereignisse=len(rows),
        handlungsbedarf=offen_gesamt.count or 0,
        fehler_offen=fehler_gesamt.count or 0,
    )


def detail(db: Client, ereignis_id: str) -> WebhookDetail:
    """Die VOLLSTÄNDIGE Payload eines Eingangs — ungekürzt.

    Genau dafür läuft der Endpunkt mit der Service-Role: hier ist zu sehen, was
    das Portal wirklich geschickt hat, samt `resolution`, falls jemand das
    Ereignis abgearbeitet hat.
    """
    treffer = (
        db.table(_TABELLE).select("*").eq("id", ereignis_id).limit(1).execute()
    ).data or []
    if not treffer:
        return WebhookDetail(ereignis=None, payload=None, resolution=None)

    row = treffer[0]
    titel = _namen(db, "properties", "title",
                   {str(row["property_id"])} if row.get("property_id") else set())
    betriebe = _namen(db, "tenants", "name",
                      {str(row["tenant_id"])} if row.get("tenant_id") else set())
    return WebhookDetail(
        ereignis=_zeile(row, titel, betriebe),
        payload=row.get("payload"),
        resolution=row.get("resolution"),
    )
