"""Wer in der Eigentümer-Auswertung was darf (§4.2).

Eigene Datei, weil `service.py` die Pylint-Grenze von 1500 Zeilen erreichte —
und weil die Frage „darf diese Rolle das" fachlich neben der Rechenlogik steht,
nicht darin.

DER FALL, DER DAS NÖTIG MACHTE: alle Routen des Slice hängen an
`require_granular_permission(Permission.OWNER_REPORTING)`, und dieses Recht
haben live 23 von 23 Eigentümern — es ist ihr Default. Der Router-Docstring
sagt zu, dass der Eigentümer als GEGENPARTEI der Auszahlung sie nicht selbst
pflegen darf; im Code gab es diese Sperre nie. Gerettet hat es allein, dass
`owner_reports` noch leer ist: mit der ersten Zeile hätte jeder Eigentümer die
Auszahlungen ALLER Eigentümer lesen, ändern und als bezahlt markieren können.

Vorbild ist `owner_statements` — dort sind beide Achsen (Schreibsperre und
Lese-Scope) seit je vorhanden.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner, owner_property_ids

from .fehler import ReportingError


def verbiete_eigentuemer_schreiben(ctx: AuthContext) -> None:
    """Erzeugen/Ändern/Löschen/Bezahlt-Melden ist der Agentur vorbehalten.

    §4.2: Der Eigentümer ist die GEGENPARTEI der Auszahlung. Er darf sie lesen,
    aber nicht pflegen — sonst markiert der Empfänger seine eigene Zahlung als
    geleistet.
    """
    if is_owner(ctx):
        raise ReportingError(
            "Eigentümer haben nur Lesezugriff auf die Auswertung.",
            status_code=403,
        )


def nur_eigene_berichte(
    db: Client,
    ctx: AuthContext,
    rows: list[dict[str, Any]],
    objekte: dict[str, list[str]],
) -> list[dict[str, Any]]:
    """Für Eigentümer auf Berichte mit eigenem Objekt eindampfen.

    Für alle anderen Rollen unverändert — die Verwaltung sieht den ganzen
    Betrieb. Ein Bericht OHNE Objektzuordnung bleibt für Eigentümer draußen:
    ohne Bezug lässt sich nicht belegen, dass er sie betrifft, und Raten wäre
    hier die Offenlegung fremder Beträge (Wurzel 4/6).
    """
    if not is_owner(ctx):
        return rows
    eigene = set(owner_property_ids(db, ctx))
    return [r for r in rows if eigene & set(objekte.get(str(r["id"]), []))]
