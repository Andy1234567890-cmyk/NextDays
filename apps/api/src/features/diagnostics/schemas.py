"""Schemas des diagnostics-Slice (technische Support-Diagnose)."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Obergrenze für den context eines Ereignisses (Wurzel 8). 16 KB fasst einen
# realen Payload samt Antwort bequem; alles darüber ist ein Datei-Upload oder
# ein Missbrauchsversuch, nicht mehr Diagnose.
_MAX_CONTEXT_BYTES = 16 * 1024

# Angenommene Ereignisarten.
#
# Die ersten vier laufen DAUERHAFT (rein technisch, keine Einwilligung nötig).
# "navigation" und "aktion" werden AUSSCHLIESSLICH während einer aktiven
# Debug-Freigabe erfasst — sie zeichnen nach, was der Nutzer getan hat, und
# sind damit einwilligungspflichtig. Der Client sendet sie nur, wenn der
# Kunde die Freigabe erteilt hat; der Server verwirft sie ohne Freigabe.
EventKind = Literal[
    "error",
    "api_error",
    "slow_request",
    "client_info",
    # Seitenwechsel (Pfad ohne Query-String).
    "navigation",
    # Bedienschritt (Button-/Link-Beschriftung) — nie Eingabeinhalte.
    "aktion",
    # Vollständiger Aufruf: gesendeter Inhalt + Antwort des Servers. Die
    # diagnosestärkste und zugleich sensibelste Art — sie enthält
    # zwangsläufig Kundendaten (Gastnamen, Adressen, Beträge), sobald ein
    # solcher Aufruf fehlschlägt. Nur mit Freigabe, und der Client entfernt
    # Zugangsdaten vor dem Senden.
    "aufruf",
]

# Diese Arten setzen eine aktive Freigabe voraus.
_NUR_MIT_FREIGABE = frozenset({"navigation", "aktion", "aufruf"})


class DiagnosticEvent(BaseModel):
    """Ein gemeldetes technisches Ereignis (vom Client)."""

    app: str = Field(max_length=20)
    kind: EventKind
    message: str = Field(min_length=1, max_length=500)
    # Pfad OHNE Query-String — der Server schneidet ihn zusätzlich ab.
    path: str | None = Field(default=None, max_length=300)
    http_status: int | None = Field(default=None, ge=100, le=599)
    duration_ms: int | None = Field(default=None, ge=0, le=600_000)
    context: dict = Field(default_factory=dict)


class DiagnosticBatch(BaseModel):
    """Mehrere Ereignisse auf einmal (der Client puffert und sendet gebündelt)."""

    events: list[DiagnosticEvent] = Field(min_length=1, max_length=50)

    @field_validator("events")
    @classmethod
    def _context_begrenzen(
        cls, events: list[DiagnosticEvent]
    ) -> list[DiagnosticEvent]:
        """Harte Obergrenze für den context (Wurzel 8).

        Mit "aufruf" schickt der Client ganze Payloads. Ohne Deckel könnte ein
        einziger Request die Tabelle mit Megabytes fluten — versehentlich (ein
        großer Datei-Upload) oder absichtlich. Zu große Inhalte werden
        ERSETZT, nicht abgewiesen: Der Rest des Ereignisses (Status, Pfad,
        Request-ID) ist auch dann noch wertvoll.
        """
        for e in events:
            if len(json.dumps(e.context, default=str)) > _MAX_CONTEXT_BYTES:
                e.context = {
                    "gekuerzt": True,
                    "grund": (
                        f"Inhalt größer als {_MAX_CONTEXT_BYTES // 1024} KB — "
                        "nicht gespeichert."
                    ),
                }
        return events


class DebugSession(BaseModel):
    """Eine Diagnose-Freigabe des Kunden."""

    id: str
    tenant_id: str | None = None
    ticket_id: str | None = None
    started_at: datetime
    expires_at: datetime
    ended_at: datetime | None = None
    note: str | None = None
    # Abgeleitet: läuft die Freigabe gerade?
    aktiv: bool = False


class DebugSessionStart(BaseModel):
    """Freigabe starten. Die Dauer ist gedeckelt — eine dauerhafte Freigabe
    wäre faktisch eine Überwachungserlaubnis."""

    # Maximal 24 Stunden; Standard 2 Stunden (deckt einen Support-Kontakt ab).
    stunden: int = Field(default=2, ge=1, le=24)
    ticket_id: str | None = None
    note: str | None = Field(default=None, max_length=300)


class DiagnosticRow(BaseModel):
    """Ein Ereignis in der Support-Ansicht."""

    id: str
    user_id: str | None = None
    tenant_id: str | None = None
    app: str
    kind: str
    message: str
    path: str | None = None
    http_status: int | None = None
    duration_ms: int | None = None
    context: dict = {}
    created_at: datetime


class DiagnosticList(BaseModel):
    items: list[DiagnosticRow]
    total: int
