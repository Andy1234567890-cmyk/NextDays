"""Ist ein Objekt VERKAUFSFERTIG genug, um veroeffentlicht zu werden?

ANLASS (29.08.2026): Das Airbnb-Geruest „Airbnb-Uebernahme laeuft" — ein
Entwurf ohne Foto, ohne Beschreibung, ohne Adresse — liess sich im Dialog
„Objekt veroeffentlichen" bestaetigen und stand danach zur Freigabe auf dem
eigenen Marktplatz an. `publish()` prueste bis dahin nur EINE Bedingung: dass
ein Preisplan existiert.

Eigenes Modul, weil die Regel fuer sich steht: sie beschreibt, was ein GAST
mindestens sehen muss, und aendert sich mit dem Produkt — nicht mit dem
Veroeffentlichungs-Ablauf.
"""
from __future__ import annotations

from typing import Any


def fehlende_pflichtangaben(row: dict[str, Any]) -> list[str]:
    """Was dem Objekt zum Verkauf noch fehlt — leer heisst: fertig.

    Gibt Klartext-Bezeichnungen zurueck, keine Spaltennamen: die Liste landet
    unveraendert in der Fehlermeldung, die der Betrieb liest.
    """
    fehlend: list[str] = []
    if not str(row.get("title") or "").strip():
        fehlend.append("Name")
    if not str(row.get("description") or "").strip():
        fehlend.append("Beschreibung")
    if not (row.get("photos") or []):
        fehlend.append("mindestens ein Foto")
    # Adresse: `address` ist das Altfeld, Strasse+Ort der heutige Weg — eines
    # von beiden genuegt, sonst koennten Bestandsobjekte nicht mehr live gehen.
    hat_adresse = bool(
        str(row.get("address") or "").strip()
        or (
            str(row.get("street") or "").strip()
            and str(row.get("city") or "").strip()
        )
    )
    if not hat_adresse:
        fehlend.append("Adresse")
    if not row.get("max_guests"):
        fehlend.append("Anzahl der Gaeste")
    return fehlend


def verkaufsfertig_pruefen(row: dict[str, Any], fehler: type[Exception]) -> None:
    """Wirft `fehler` (422), wenn Pflichtangaben fehlen — sonst nichts.

    `fehler` wird hereingereicht statt importiert: der Fehlertyp gehoert dem
    Slice, diese Regel gilt unabhaengig davon.
    """
    fehlend = fehlende_pflichtangaben(row)
    if not fehlend:
        return
    raise fehler(
        "Dieses Objekt ist noch nicht vollstaendig und kann deshalb nicht "
        "veroeffentlicht werden. Es fehlt: " + ", ".join(fehlend) + ".",
        status_code=422,
    )
