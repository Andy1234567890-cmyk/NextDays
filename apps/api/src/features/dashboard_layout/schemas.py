"""Schemas des dashboard_layout-Slice — Kachel-Anordnung der Startseite.

Das Layout kommt aus Client-Hand und wird als jsonb abgelegt. Genau deshalb
steht die Form hier hart: die Kachel-IDs sind ein `Literal` des Katalogs, die
Koordinaten sind begrenzte `int`, und die Liste hat eine Obergrenze (Wurzel 8 —
jeder unbegrenzte Bereich bekommt eine harte Grenze, sonst 422). Ein unbekanntes
Feld wird nicht still geschluckt, sondern abgewiesen.

Der Katalog selbst lebt im Frontend (`web/lib/dashboard-katalog.ts`); diese
Literal-Liste ist seine serverseitige Zwillingsdefinition. Kommt dort eine
Kachel dazu, MUSS sie hier ergaenzt werden — sonst weist der Server das Layout
mit 422 ab, was der ehrliche Ausgang ist (nicht: unbekannte ID durchlassen).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Kachel-Katalog (Zwilling zu web/lib/dashboard-katalog.ts) ---------------
# `checkins` gibt es ZWEIMAL — einmal als Liste, einmal als KPI. Ohne das
# Praefix waeren beide dieselbe ID und wuerden sich gegenseitig ueberschreiben.
KachelId = Literal[
    "liste:checkouts",
    "liste:checkins",
    "liste:freigabe",
    "liste:upcoming",
    "liste:im_haus",
    "kpi:checkins",
    "kpi:revenue_per_booking",
    "kpi:revenue",
    "kpi:confirmed",
    "nachricht:gesendet:summe",
    "nachricht:gesendet:schnitt",
    "nachricht:empfangen:summe",
    "nachricht:empfangen:schnitt",
    "nachricht:automation:summe",
    "nachricht:automation:schnitt",
    "nachricht:ungelesen",
    "objekt:gesamt",
    "objekt:inaktiv",
    "objekt:entwurf",
]

KachelGroesse = Literal["s", "m", "l"]

# Rollen, fuer die ein Startseiten-Standard gesetzt werden darf. Bewusst der
# volle Enum-Wertebereich der DB, nicht nur admin/co_admin: welche Rolle die
# Startseite heute erreicht, ist eine Frage der Navigation und darf sich aendern,
# ohne dass gespeicherte Standards ungueltig werden.
RollenName = Literal["admin", "co_admin", "owner", "staff", "cleaner"]

# Obergrenzen. 19 Kacheln gibt es real; 40 laesst Luft fuer Wachstum, ohne dass
# jemand ein 10-MB-Layout ablegen kann.
MAX_KACHELN = 40
MAX_KOORDINATE = 200
SCHEMA_VERSION = 1


class KachelPosition(BaseModel):
    """Position und Groesse EINER Kachel im 12-Spalten-Raster."""

    model_config = ConfigDict(extra="forbid")

    id: KachelId
    x: int = Field(ge=0, le=MAX_KOORDINATE)
    y: int = Field(ge=0, le=MAX_KOORDINATE)
    groesse: KachelGroesse


class DashboardLayout(BaseModel):
    """Ein vollstaendiges Layout: Positionen plus ausgeblendete Kacheln.

    Kein `w`/`h` — die Breite folgt aus `groesse` (S=3, M=6, L=12 Spalten), die
    Hoehe aus dem Bereich der Kachel. Kein Breakpoint-Array: unter `lg` faellt
    das Raster auf eine Spalte zurueck, Reihenfolge dann y, dann x.
    """

    model_config = ConfigDict(extra="forbid")

    schema_version: int = Field(default=SCHEMA_VERSION, ge=1, le=SCHEMA_VERSION)
    kacheln: list[KachelPosition] = Field(default_factory=list, max_length=MAX_KACHELN)
    ausgeblendet: list[KachelId] = Field(
        default_factory=list, max_length=MAX_KACHELN
    )


class DashboardLayoutAntwort(BaseModel):
    """Was der GET liefert: das wirksame Layout und WOHER es stammt.

    `quelle` ist keine Kosmetik — die UI muss „Auf Standard zuruecksetzen" nur
    anbieten, wenn es ueberhaupt etwas zurueckzusetzen gibt, und sie darf einen
    geerbten Rollen-Standard nicht als eigene Einstellung ausgeben.
    """

    layout: DashboardLayout | None = None
    quelle: Literal["benutzer", "rolle", "standard"]
    rollen_standard: DashboardLayout | None = None


class RollenStandardAntwort(BaseModel):
    """Der fuer eine Rolle hinterlegte Standard. `layout` = null heisst: keiner
    gesetzt — die Rolle erbt dann den Katalog-Standard aus dem Code."""

    role: RollenName
    layout: DashboardLayout | None = None
