"""Scope-Katalog der öffentlichen API — EINE Wahrheit für drei Verbraucher.

# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/features/api_clients/scopes.py
#     apps/public-api/src/core/scopes.py
# Die öffentliche API ist ein EIGENER Service (apps/public-api/README.md) und
# importiert nichts aus apps/api. Dieser Katalog liegt dort deshalb als bewusste
# Kopie (Muster ADR-0019); der CI-Job `public-api-konsistenz` prüft die
# Byte-Gleichheit.
#
# Warum genau hier der Einsatz hoch ist: den Katalog lesen DREI Stellen —
#   1. das Dashboard, das beim Anlegen eines Zugangs die Auswahl anzeigt,
#   2. dieser Service, der jeden Aufruf gegen den Scope im Token prüft,
#   3. die veröffentlichte Dokumentation/OpenAPI-Datei.
# Driftet er, passiert eines von zwei Dingen, und beide sind still: das
# Dashboard bietet einen Scope an, mit dem kein Endpunkt etwas anfangen kann
# (der Kunde bekommt dauerhaft 403 und sucht den Fehler bei sich), oder ein
# Endpunkt verlangt einen Scope, den niemand vergeben kann.

Regeln des Katalogs:
  * Schreiben schließt Lesen NICHT ein. Beide Scopes müssen getrennt vergeben
    werden — kein impliziter Rechte-Zuwachs (ein Zugang, der Preise setzen
    darf, darf deshalb nicht automatisch Buchungen lesen).
  * Der Katalog ist die Validierungsgrundlage: ein unbekannter Scope ist ein
    422, kein stillschweigend ignorierter Wert (Wurzel 4).
  * Ein neuer Endpunkt bekommt einen Scope aus diesem Katalog oder einen neuen
    Eintrag hier — nie „nur eingeloggt reicht" (Wurzel 9: Authentifizierung
    ist keine Autorisierung).
"""
from __future__ import annotations

from typing import Final

# Scope → deutsche Beschreibung. Die Beschreibung ist kein Beiwerk: sie steht
# im Dashboard neben der Auswahlbox und in der veröffentlichten Doku. Wer den
# Katalog erweitert, schreibt sie mit.
SCOPE_KATALOG: Final[dict[str, str]] = {
    # -- Objekte (Einheiten-Typen) und ihre Einheiten -----------------------
    "properties:read": (
        "Objekte, Einheiten, Ausstattung und Fotos lesen."
    ),
    "properties:write": (
        "Objektdaten ändern (Beschreibung, Ausstattung, Belegungsgrenzen)."
    ),
    # -- Kalender: freie Stückzahl je Tag ----------------------------------
    "availability:read": (
        "Verfügbarkeit lesen — freie Einheiten je Tag und Objekt."
    ),
    "availability:write": (
        "Nächte sperren und freigeben (Handsperre, Wartung, Stop-Sell)."
    ),
    # -- Preise und Aufenthaltsregeln --------------------------------------
    "rates:read": (
        "Tagespreise, Rate-Pläne und Aufenthaltsregeln lesen."
    ),
    "rates:write": (
        "Tagespreise und Aufenthaltsregeln setzen "
        "(Mindest-/Höchstaufenthalt, An-/Abreisesperre)."
    ),
    # -- Buchungen ---------------------------------------------------------
    "reservations:read": (
        "Buchungen und Anfragen lesen, samt Beträgen und Herkunftskanal."
    ),
    "reservations:write": (
        "Buchungen anlegen. Ändern und Stornieren gehören NICHT dazu — "
        "siehe die Grenzen von v1 in der Dokumentation."
    ),
    # -- Gäste -------------------------------------------------------------
    "guests:read": (
        "Gästestammdaten lesen (Name, Kontakt, Sprache, Herkunftsland)."
    ),
    # -- Aufgaben (Reinigung, Wartung) -------------------------------------
    "tasks:read": "Aufgaben lesen (Reinigung, Wartung, Zuständige, Status).",
    "tasks:write": "Aufgaben anlegen, zuweisen und abschließen.",
    # -- Ereignis-Abos (Webhooks) ------------------------------------------
    "webhooks:read": "Eigene Ereignis-Abos auflisten.",
    "webhooks:write": "Ereignis-Abos anlegen und löschen.",
    # -- Kalender-Abgleich (iCal) ------------------------------------------
    # Bestand seit Migration 0179. Bleibt im Katalog, weil bereits vergebene
    # Zugänge diese Scopes tragen können; ein stilles Verschwinden würde sie
    # ohne Vorwarnung entwerten.
    "calendar_sync:read": "iCal-Abgleich lesen (externe Kalender-Anbindungen).",
    "calendar_sync:write": "iCal-Abgleich einrichten und auslösen.",
}

# Frozenset für die Validierung (ein unbekannter Scope ist ein 422).
API_SCOPES: Final[frozenset[str]] = frozenset(SCOPE_KATALOG)


def unbekannte_scopes(scopes: list[str]) -> list[str]:
    """Die Scopes aus ``scopes``, die der Katalog nicht kennt — sortiert.

    Rückgabe leer = alle gültig. Der Aufrufer macht daraus einen 422 mit den
    Namen im Klartext; eine Fehlermeldung ohne Namen kostet den Entwickler eine
    Stunde Suche.
    """
    return sorted({s for s in scopes if s not in API_SCOPES})
