"""Sonder-Events (Lastenheft §2.3): ein Name, ein Aufschlag, n auch
unterbrochene Zeiträume, optionale Objektzuweisung (0011/0583).

Events sind KEINE Saisons: eine Saison materialisiert ihren Preis nach
`price_overrides` (calendar/service.py), ein Event ist ein FAKTOR im Dynamic
Pricing (`pricing/recompute.py::_event_pct_by_date` → `engine.py`). Deshalb
ist der Gegenzustand hier nicht „Overrides zurücknehmen", sondern „die
Tagespreise der betroffenen Objekte neu rechnen lassen" — als
`recompute_property`-Job (coalesced je Objekt), so wie es `pricing/router.py`
nach jeder Einstellungsänderung und `properties/service.py::publish` tun.

Wurzel 1 (Alt/Neu-Diff): wer die Objektzuweisung ändert, muss die Objekte
neu rechnen, die das Event VORHER traf UND die es NACHHER trifft — sonst
behielte ein abgewähltes Haus den Aufschlag bis zum nächsten Cron. Der Job
rechnet den vollen Horizont (heute … +365), ein Datums-Diff ist deshalb nicht
nötig: jede Zeitraumänderung liegt innerhalb dessen, was ohnehin neu
gerechnet wird.

Wurzel 3: jeder per-ID-Zugriff über `load_scoped` (events trägt tenant_id).
Jede Objekt-ID aus dem Request wird einzeln auf den Mandanten gescopt.
"""
from datetime import date

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import load_scoped
from src.jobs.queue import try_enqueue_recompute

from .schemas import EventCreate, EventPeriod, EventUpdate
from .service import CalendarError

log = get_logger("nextdays.calendar.events")


def _iso(d: date | str) -> str:
    return d.isoformat() if isinstance(d, date) else str(d)


class EventService:
    """Schreib- und Lesepfad für `events`/`event_periods`/
    `event_property_assignments`."""

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def _db(self) -> Client:
        if self._client is None:
            raise RuntimeError("Calendar-Events-DB nicht verfügbar.")
        return self._client

    # -- Lesen --------------------------------------------------------------
    def list_events(self, tenant_id: str) -> list[dict]:
        """Alle Events des Mandanten mit Zeiträumen und Objektzuweisung."""
        events = (
            self._db()
            .table("events")
            .select("id, name, percent, color")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []
        if not events:
            return []
        ids = [e["id"] for e in events]
        periods = (
            self._db()
            .table("event_periods")
            .select("id, event_id, start_date, end_date")
            .in_("event_id", ids)
            .order("start_date")
            .execute()
        ).data or []
        assigns = (
            self._db()
            .table("event_property_assignments")
            .select("event_id, property_id")
            .in_("event_id", ids)
            .execute()
        ).data or []
        periods_by: dict[str, list[dict]] = {}
        for p in periods:
            periods_by.setdefault(p["event_id"], []).append(p)
        props_by: dict[str, list[str]] = {}
        for a in assigns:
            props_by.setdefault(a["event_id"], []).append(a["property_id"])
        out = []
        for e in events:
            out.append({
                **e,
                "percent": float(e.get("percent") or 0),
                "periods": periods_by.get(e["id"], []),
                "property_ids": sorted(props_by.get(e["id"], [])),
            })
        return out

    def _own_event(self, tenant_id: str, event_id: str) -> dict:
        """Load + Scope in EINEM Schritt (Wurzel 3)."""
        return load_scoped(
            self._db(), "events", event_id, tenant_id,
            columns="id, name, percent, color",
            not_found=CalendarError("Event nicht gefunden.", status_code=404),
        )

    def _mit_details(self, tenant_id: str, event_id: str) -> dict:
        for e in self.list_events(tenant_id):
            if e["id"] == event_id:
                return e
        raise CalendarError("Event nicht gefunden.", status_code=404)

    # -- Schreiben ----------------------------------------------------------
    def create_event(self, tenant_id: str, req: EventCreate) -> dict:
        self._require_tenant_properties(tenant_id, req.property_ids)
        row = (
            self._db()
            .table("events")
            .insert({
                "tenant_id": tenant_id, "name": req.name,
                "percent": req.percent, "color": req.color,
            })
            .execute()
        ).data
        if not row:
            raise CalendarError("Event konnte nicht angelegt werden.", status_code=500)
        event_id = row[0]["id"]
        self._insert_periods(event_id, req.periods)
        self._insert_assignments(event_id, req.property_ids)
        log.info(
            "calendar_event_created", tenant_id=tenant_id, event_id=event_id,
            perioden=len(req.periods), objekte=len(req.property_ids) or "alle",
        )
        self._recompute(tenant_id, set(req.property_ids), set(req.property_ids))
        return self._mit_details(tenant_id, event_id)

    def update_event(self, tenant_id: str, event_id: str, req: EventUpdate) -> dict:
        self._own_event(tenant_id, event_id)
        alt = self._mit_details(tenant_id, event_id)
        alt_objekte = set(alt["property_ids"])
        if req.property_ids is not None:
            self._require_tenant_properties(tenant_id, req.property_ids)

        stammdaten = {
            k: v for k, v in {
                "name": req.name, "percent": req.percent, "color": req.color,
            }.items() if v is not None
        }
        if stammdaten:
            self._db().table("events").update(stammdaten).eq(
                "id", event_id
            ).eq("tenant_id", tenant_id).execute()

        if req.periods is not None:
            # Erst einfügen, dann die vorher gelesenen ALTEN Zeilen gezielt
            # löschen — ein Abbruch dazwischen hinterlässt einen Überschuss
            # (zwei Zeiträume), keine Lücke (dasselbe Prinzip wie
            # `_replace_season_spans`). Ein pauschales `delete().eq(event_id)`
            # NACH dem Insert nähme die neuen Zeilen gleich mit.
            alte_ids = [p["id"] for p in alt["periods"]]
            self._insert_periods(event_id, req.periods)
            if alte_ids:
                self._db().table("event_periods").delete().in_(
                    "id", alte_ids
                ).execute()

        neu_objekte = alt_objekte
        if req.property_ids is not None:
            neu_objekte = set(req.property_ids)
            self._db().table("event_property_assignments").delete().eq(
                "event_id", event_id
            ).execute()
            self._insert_assignments(event_id, req.property_ids)

        log.info(
            "calendar_event_updated", tenant_id=tenant_id, event_id=event_id,
            felder=sorted(stammdaten), perioden_ersetzt=req.periods is not None,
            zuweisung_ersetzt=req.property_ids is not None,
        )
        self._recompute(tenant_id, alt_objekte, neu_objekte)
        return self._mit_details(tenant_id, event_id)

    def delete_event(self, tenant_id: str, event_id: str) -> None:
        self._own_event(tenant_id, event_id)
        alt = self._mit_details(tenant_id, event_id)
        # FK cascade räumt Zeiträume und Zuweisungen.
        self._db().table("events").delete().eq("id", event_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("calendar_event_deleted", tenant_id=tenant_id, event_id=event_id)
        # Der Aufschlag fällt weg → die betroffenen Objekte neu rechnen
        # (Gegenzustand, Wurzel 1).
        self._recompute(tenant_id, set(alt["property_ids"]), set(alt["property_ids"]))

    # -- Helfer -------------------------------------------------------------
    def _insert_periods(self, event_id: str, periods: list[EventPeriod]) -> None:
        if not periods:
            return
        self._db().table("event_periods").insert([
            {
                "event_id": event_id,
                "start_date": _iso(p.start_date),
                "end_date": _iso(p.end_date),
            }
            for p in periods
        ]).execute()

    def _insert_assignments(self, event_id: str, property_ids: list[str]) -> None:
        ids = list(dict.fromkeys(property_ids))
        if not ids:
            return
        self._db().table("event_property_assignments").insert([
            {"event_id": event_id, "property_id": pid} for pid in ids
        ]).execute()

    def _require_tenant_properties(self, tenant_id: str, property_ids: list[str]) -> None:
        """Jede Objekt-ID einzeln auf den Mandanten scopen (Wurzel 3): der
        Service-Role-Key umgeht RLS, eine fremde ID ist ein 404 für den ganzen
        Aufruf, kein stilles Überspringen."""
        for pid in dict.fromkeys(property_ids):
            load_scoped(
                self._db(), "properties", pid, tenant_id, columns="id",
                not_found=CalendarError("Objekt nicht gefunden.", status_code=404),
            )

    def _dp_objekte(self, tenant_id: str, nur: set[str] | None) -> list[str]:
        """Objekte des Mandanten mit aktivem Dynamic Pricing — nur dort wirkt
        ein Event. `nur` schränkt auf die Zuweisung ein; None = alle Objekte
        des Mandanten (leere Zuweisung)."""
        props = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        ids = {p["id"] for p in props}
        if nur is not None:
            ids &= nur
        if not ids:
            return []
        dp = (
            self._db()
            .table("dp_settings")
            .select("property_id, enabled")
            .in_("property_id", sorted(ids))
            .eq("enabled", True)
            .execute()
        ).data or []
        return sorted({d["property_id"] for d in dp if d["property_id"] in ids})

    def _recompute(self, tenant_id: str, alt: set[str], neu: set[str]) -> None:
        """Betroffene Objekte neu rechnen lassen: die ALTE Zuweisung UND die
        NEUE (Wurzel 1). Leere Zuweisung heißt „alle Objekte des Mandanten"."""
        if not alt or not neu:
            ziel = self._dp_objekte(tenant_id, None)
        else:
            ziel = self._dp_objekte(tenant_id, alt | neu)
        for pid in ziel:
            try_enqueue_recompute(self._db(), tenant_id, pid)
        log.info(
            "calendar_event_recompute_eingereiht",
            tenant_id=tenant_id, objekte=len(ziel),
        )
