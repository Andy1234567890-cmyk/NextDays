"""Technische Support-Diagnose.

Der Slice hat zwei Seiten, die strikt getrennt bleiben:

  • SCHREIBEN — jeder eingeloggte Client meldet technische Ereignisse
    (Fehler, fehlgeschlagene Aufrufe). Das läuft dauerhaft und ohne
    Einwilligung, weil ausschließlich Technisches erfasst wird: keine
    Eingaben, keine Bildschirminhalte, keine Aktivität.

  • LESEN — der Support sieht die Ereignisse eines Kontos NUR, solange eine
    aktive Debug-Freigabe dieses Kunden existiert. Ohne Freigabe liefert die
    Abfrage eine leere Liste, nicht etwa alles.

Diese Trennung ist der ganze Punkt: Sie macht aus einer potenziellen
Überwachungsfunktion ein Support-Werkzeug, das der Kunde selbst aufschließt.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.request_context import hole_ursache

from .schemas import (
    _NUR_MIT_FREIGABE,
    DebugSession,
    DebugSessionStart,
    DiagnosticBatch,
    DiagnosticList,
    DiagnosticRow,
)

log = get_logger("nextdays.diagnostics")

# Harte Obergrenze je Abfrage (Wurzel 8).
_MAX_LIMIT = 200

# Erlaubte Oberflächen. Ein unbekannter Wert wird auf 'unbekannt' normalisiert,
# statt ungeprüften Client-Text zu speichern.
_APPS = {"gastgeber", "plattform", "web", "api", "mobile"}

# Wie weit VOR der Freigabe der Support zurückblicken darf. Der zu
# meldende Fehler passiert immer vor dem Support-Kontakt; ohne Rückblick
# wäre die Diagnose wertlos. Vier Stunden decken einen Arbeitsvorgang ab,
# ohne zur Verlaufshistorie zu werden.
_RUECKBLICK_STUNDEN = 4


def _mit_ursache(context: dict) -> dict:
    """Backend-Ursache zur Request-ID nachschlagen und anhängen.

    Der Client kennt nur „500 internal_error" — die Ursache bleibt bewusst im
    Server (Wurzel 5: kein Stacktrace-Leak). Hier, auf der Server-Seite, wird
    sie dem Ereignis wieder beigefügt, damit der Support sie im Backoffice
    sieht, ohne dass sie je im Browser lag.

    Fehlt der Eintrag (anderer Worker, Neustart, zu alt), bleibt es bei der
    reinen Request-ID — mit ihr lässt sich das Server-Log durchsuchen.
    """
    rid = context.get("request_id")
    if not isinstance(rid, str):
        return context
    ursache = hole_ursache(rid)
    return {**context, "ursache": ursache} if ursache else context


def _clean_path(path: str | None) -> str | None:
    """Query-String abschneiden.

    Dort stehen Suchbegriffe, Gast-IDs und Tokens — die haben in einer
    Diagnosespur nichts zu suchen, selbst wenn der Client sie mitschickt.
    """
    if not path:
        return None
    return path.split("?", 1)[0][:300]


class DiagnosticsService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Schreiben (Client meldet) -----------------------------------------

    def record(
        self,
        batch: DiagnosticBatch,
        *,
        user_id: str | None,
        guest_id: str | None,
        tenant_id: str | None,
    ) -> int:
        """Technische Ereignisse ablegen. Gibt die Anzahl zurück.

        Best-effort: Diagnose darf den Client nie ausbremsen oder Fehler
        erzeugen — schlägt das Schreiben fehl, wird geloggt, nicht geworfen.
        """
        # Aktivitätsdaten (Seitenwechsel, Bedienschritte) sind
        # einwilligungspflichtig: sie zeichnen nach, was jemand getan hat. Ohne
        # aktive Freigabe werden sie hier VERWORFEN — der Client könnte sie
        # sonst einfach mitschicken und damit die Einwilligung umgehen
        # (Wurzel 3: der Anfrage nicht vertrauen).
        erlaubt = batch.events
        if any(e.kind in _NUR_MIT_FREIGABE for e in batch.events):
            if not self._hat_freigabe(user_id=user_id, guest_id=guest_id):
                erlaubt = [
                    e for e in batch.events if e.kind not in _NUR_MIT_FREIGABE
                ]
        if not erlaubt:
            return 0

        zeilen = [
            {
                "user_id": user_id,
                "guest_id": guest_id,
                "tenant_id": tenant_id,
                "app": e.app if e.app in _APPS else "unbekannt",
                "kind": e.kind,
                "message": e.message[:500],
                "path": _clean_path(e.path),
                "http_status": e.http_status,
                "duration_ms": e.duration_ms,
                "context": _mit_ursache(e.context),
            }
            for e in erlaubt
        ]
        try:
            self._db.table("support_diagnostics").insert(zeilen).execute()
        except Exception as exc:  # noqa: BLE001 — Diagnose darf nie kippen
            log.warning("diagnostics_write_failed", error=str(exc))
            return 0
        return len(zeilen)

    def _hat_freigabe(
        self, *, user_id: str | None, guest_id: str | None
    ) -> bool:
        """Läuft für dieses Konto gerade eine Diagnose-Freigabe?

        Entscheidet, ob Aktivitätsdaten angenommen werden. Fail-closed: ohne
        Identität oder bei einem Fehler gilt „keine Freigabe".
        """
        if not (user_id or guest_id):
            return False
        try:
            query = (
                self._db.table("support_debug_sessions")
                .select("id")
                .is_("ended_at", "null")
                .gt("expires_at", datetime.now(UTC).isoformat())
            )
            # Der Identitäts-Filter MUSS vor limit() stehen — sonst begrenzt
            # PostgREST erst und filtert danach, was zu falschen Ergebnissen
            # führt.
            query = (
                query.eq("user_id", user_id)
                if user_id
                else query.eq("guest_id", guest_id)
            )
            return bool(query.limit(1).execute().data)
        except Exception as exc:  # noqa: BLE001 — im Zweifel nicht aufzeichnen
            log.warning("freigabe_pruefung_fehlgeschlagen", error=str(exc))
            return False

    # -- Debug-Freigabe (der Kunde entscheidet) ----------------------------

    def start_session(
        self,
        req: DebugSessionStart,
        *,
        user_id: str | None,
        guest_id: str | None,
        tenant_id: str | None,
    ) -> DebugSession:
        """Eine Diagnose-Freigabe starten (zeitlich begrenzt).

        Eine bereits laufende Freigabe wird zuvor beendet, damit nie zwei
        parallel laufen und der Kunde immer genau einen Zustand sieht.
        """
        self.end_session(user_id=user_id, guest_id=guest_id)

        jetzt = datetime.now(UTC)
        res = (
            self._db.table("support_debug_sessions")
            .insert(
                {
                    "user_id": user_id,
                    "guest_id": guest_id,
                    "tenant_id": tenant_id,
                    "ticket_id": req.ticket_id,
                    "started_at": jetzt.isoformat(),
                    "expires_at": (
                        jetzt + timedelta(hours=req.stunden)
                    ).isoformat(),
                    "note": req.note,
                }
            )
            .execute()
        ).data
        log.info(
            "debug_session_started",
            user_id=user_id,
            tenant_id=tenant_id,
            stunden=req.stunden,
        )
        return self._to_session(res[0])

    def end_session(
        self, *, user_id: str | None, guest_id: str | None
    ) -> None:
        """Laufende Freigabe(n) sofort beenden (Widerruf durch den Kunden)."""
        query = self._db.table("support_debug_sessions").update(
            {"ended_at": datetime.now(UTC).isoformat()}
        )
        if user_id:
            query = query.eq("user_id", user_id)
        elif guest_id:
            query = query.eq("guest_id", guest_id)
        else:
            return
        query.is_("ended_at", "null").execute()

    def my_sessions(
        self, *, user_id: str | None, guest_id: str | None
    ) -> list[DebugSession]:
        """Die eigenen Freigaben — Transparenz für den Kunden."""
        query = (
            self._db.table("support_debug_sessions")
            .select("*")
            .order("started_at", desc=True)
            .limit(20)
        )
        if user_id:
            query = query.eq("user_id", user_id)
        elif guest_id:
            query = query.eq("guest_id", guest_id)
        else:
            return []
        return [self._to_session(r) for r in (query.execute().data or [])]

    # -- Lesen (Support, NUR mit Freigabe) ---------------------------------

    def active_sessions(self) -> list[DebugSession]:
        """Alle gerade laufenden Freigaben — die Arbeitsliste des Supports."""
        jetzt = datetime.now(UTC).isoformat()
        rows = (
            self._db.table("support_debug_sessions")
            .select("*")
            .is_("ended_at", "null")
            .gt("expires_at", jetzt)
            .order("started_at", desc=True)
            .limit(_MAX_LIMIT)
            .execute()
        ).data or []
        return [self._to_session(r) for r in rows]

    def events_for_session(
        self, session_id: str, *, limit: int = 100
    ) -> DiagnosticList:
        """Ereignisse zu einer Freigabe.

        Der Zeitraum ist eng begrenzt: das Freigabefenster plus ein kurzer
        Rückblick (_RUECKBLICK_STUNDEN), weil der zu meldende Fehler
        zwangsläufig VOR dem Support-Kontakt passiert. Der Support sieht
        damit den aktuellen Vorfall — NICHT die Historie des Kontos.
        Abgelaufene oder widerrufene Freigaben liefern nichts (fail-closed).
        """
        limit = max(1, min(_MAX_LIMIT, limit))

        rows = (
            self._db.table("support_debug_sessions")
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return DiagnosticList(items=[], total=0)
        s = rows[0]

        jetzt = datetime.now(UTC)
        if s.get("ended_at") or _parse(s["expires_at"]) < jetzt:
            # Freigabe vorbei → keine Einsicht mehr.
            return DiagnosticList(items=[], total=0)

        # Rückblick: Wer den Support kontaktiert, will den Fehler zeigen, der
        # GERADE passiert ist — er entsteht zwangsläufig VOR der Freigabe. Ohne
        # Rückblick wäre die Funktion nutzlos. Das Fenster ist bewusst eng
        # (_RUECKBLICK_STUNDEN) und nicht „gesamte Historie": es deckt den
        # aktuellen Vorfall ab, nicht das Verhalten der letzten Wochen.
        beginn = _parse(s["started_at"]) - timedelta(hours=_RUECKBLICK_STUNDEN)

        query = (
            self._db.table("support_diagnostics")
            .select("*", count="exact")
            .gte("created_at", beginn.isoformat())
            .lte("created_at", s["expires_at"])
            .order("created_at", desc=True)
        )
        if s.get("user_id"):
            query = query.eq("user_id", s["user_id"])
        elif s.get("guest_id"):
            query = query.eq("guest_id", s["guest_id"])
        else:
            return DiagnosticList(items=[], total=0)

        res = query.limit(limit).execute()
        return DiagnosticList(
            items=[DiagnosticRow(**r) for r in (res.data or [])],
            total=res.count or 0,
        )

    def purge_old(self, *, tage: int = 30) -> int:
        """Diagnoseereignisse älter als `tage` löschen (Aufbewahrungsgrenze).

        Fehlerdiagnose braucht keine Historie; alles Ältere ist Ballast mit
        Datenschutzrisiko.
        """
        grenze = (datetime.now(UTC) - timedelta(days=tage)).isoformat()
        res = (
            self._db.table("support_diagnostics")
            .delete()
            .lt("created_at", grenze)
            .execute()
        ).data or []
        if res:
            log.info("diagnostics_purged", anzahl=len(res), tage=tage)
        return len(res)

    @staticmethod
    def _to_session(row: dict) -> DebugSession:
        jetzt = datetime.now(UTC)
        aktiv = not row.get("ended_at") and _parse(row["expires_at"]) > jetzt
        return DebugSession(
            id=row["id"],
            tenant_id=row.get("tenant_id"),
            ticket_id=row.get("ticket_id"),
            started_at=row["started_at"],
            expires_at=row["expires_at"],
            ended_at=row.get("ended_at"),
            note=row.get("note"),
            aktiv=aktiv,
        )


def _parse(wert: str) -> datetime:
    """ISO-Zeitstempel aus der DB in ein aware datetime."""
    return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
