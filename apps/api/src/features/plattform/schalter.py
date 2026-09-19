"""Lesezugriff auf die plattformweiten Schalter (`plattform_schalter`, 0726).

EIN Ort, an dem diese Zeile gelesen wird. Sie wird an zwei Stellen gebraucht —
im Portal-Guard (`public_portal.dependencies.portal_nicht_gesperrt`) und in
`/auth/me`, damit die Weboberfläche den Hinweis anzeigen kann. Zwei Abfragen an
zwei Stellen wären zwei Gelegenheiten, die Bedeutung von NULL unterschiedlich
auszulegen.

Gelesen wird mit `service_role`: die Tabelle ist für `anon` und `authenticated`
vollständig gesperrt (Wurzel 6), sonst könnte ein Eigentümer seine eigene Sperre
per Direktpfad aufheben.
"""
import time

from src.core.logging import get_logger
from src.core.supabase import get_service_client

log = get_logger("nextdays.plattform.schalter")

# Wie lange ein gelesener Stand gilt, bevor erneut gefragt wird.
#
# WARUM ÜBERHAUPT ZWISCHENSPEICHERN: der Guard hängt am Router, läuft also bei
# JEDER Anfrage ans Portal. Ohne Puffer wäre das eine zusätzliche Abfrage pro
# Aufruf für eine Zeile, die sich alle paar Monate ändert.
#
# WARUM NUR 30 SEKUNDEN: eine Sperre soll man aufheben und es soll gelten. Eine
# halbe Minute wartet man an einem Telefon; fünf Minuten fühlen sich an, als sei
# der Schalter kaputt.
_PUFFER_SEKUNDEN = 30

# Als dict statt als umgebundene Modulvariable: so wird der Puffer MUTIERT
# statt neu gebunden, und es braucht kein `global`. Das ist nicht nur
# pylint-Kosmetik — eine umgebundene Variable ist in einem Modul, das aus
# zwei Slices importiert wird, schwerer nachzuvollziehen als ein Behaelter,
# der immer derselbe bleibt.
_stand: dict[str, float | str | None] = {"zeit": 0.0, "wert": None, "gueltig": False}


def eigentuemer_portal_sperre() -> str | None:
    """Ist das Eigentümer-Portal gesperrt?

    Rückgabe:
        ``None`` — offen.
        ``str``  — gesperrt; der Text ist der Hinweis für den Eigentümer und
        kann leer sein (dann wählt der Aufrufer seinen Standardtext).

    Kein boolescher Rückgabewert, weil der Aufrufer sonst zweimal fragen müsste
    („gesperrt?" und „welcher Text?") und dabei zwei verschiedene Stände sehen
    könnte.

    Fail-OPEN bei einer Störung, ausdrücklich: eine Verwaltungssperre darf nicht
    von selbst zuschnappen, wenn die Datenbank hustet. Der Fehler wird dabei
    LAUT geloggt (ERROR) — eine stumm ausgefallene Sperre ist derselbe Fehler
    wie ein verschluckter Exception (Wurzel 5).
    """
    jetzt = time.monotonic()
    if _stand["gueltig"] and jetzt - float(_stand["zeit"] or 0.0) < _PUFFER_SEKUNDEN:
        wert = _stand["wert"]
        return str(wert) if isinstance(wert, str) else None
    try:
        zeile = (
            get_service_client()
            .table("plattform_schalter")
            .select("eigentuemer_portal_gesperrt_seit, eigentuemer_portal_hinweis")
            .limit(1)
            .execute()
        ).data
    except Exception:  # noqa: BLE001 — Störung sperrt nicht aus, siehe Docstring
        log.exception("plattform_schalter_nicht_lesbar")
        return None
    daten = zeile[0] if zeile else {}
    gesperrt = daten.get("eigentuemer_portal_gesperrt_seit")
    ergebnis = (daten.get("eigentuemer_portal_hinweis") or "") if gesperrt else None
    _stand.update({"zeit": jetzt, "wert": ergebnis, "gueltig": True})
    return ergebnis


def puffer_leeren() -> None:
    """Puffer verwerfen — für Tests und für den Fall, dass eine Sperre SOFORT
    greifen muss, ohne die 30 Sekunden abzuwarten."""
    _stand.update({"zeit": 0.0, "wert": None, "gueltig": False})
