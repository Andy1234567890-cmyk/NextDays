"""Aufgaben in der Sicht des Eigentümers (03.09.2026).

Manche Eigentümer reinigen oder empfangen selbst. Die Verwaltung weist ihnen
die Aufgabe im Aufgaben-Popup zu — Portal und Eigentümer-App zeigen sie hier
und melden zurück. Der Contract ist bewusst SCHMAL:

* kein `assignee_id`/`assignee_name`: es ist immer der Eigentümer selbst, und
  ein Feld, das bei jeder Zeile denselben Namen trüge, lüde nur dazu ein, es
  später für fremde Zeilen zu füllen (§4.3, Personaleinsatz des Betriebs);
* keine Kosten, keine Beträge (§4.2, Datensplit);
* keine Checklisten-Details — nur der Stand, damit der Eigentümer sieht, ob
  noch Punkte offen sind, bevor er „Erledigt" drückt (Foto-Pflicht kommt
  serverseitig als 422 mit Klartext).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PortalTaskItem(BaseModel):
    id: str
    title: str
    # Rohwert des `TaskStatus`-Enums (open, accepted, in_progress, done,
    # cancelled). Die Oberflächen übersetzen ihn; ein deutsches Wort von hier
    # wäre in 23 von 24 Sprachen falsch (Wurzel 4).
    status: str
    property_id: str | None
    property_title: str | None
    # Zeitstempel wie im Tasks-Slice (UTC); die Oberflächen rechnen sie in
    # die Zeit des Nutzers um.
    start_at: datetime | None
    end_at: datetime | None
    # Anzeige-Referenz der Buchung (Portal-Referenz, sonst Kurz-ID). Kein
    # Gastname, kein Betrag.
    reservation_ref: str | None
    checklist_total: int
    checklist_done: int


class PortalTaskList(BaseModel):
    items: list[PortalTaskItem]
    total: int
