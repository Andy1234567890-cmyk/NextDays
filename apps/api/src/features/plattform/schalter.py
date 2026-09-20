"""Lesezugriff auf die plattformweiten Schalter (`plattform_schalter`, 0726).

EIN Ort, an dem diese Zeile gelesen wird. Sie wird an zwei Stellen gebraucht —
im Portal-Guard (`public_portal.dependencies.portal_nicht_gesperrt`), im
Partner-Guard (`core.security.require_approved_affiliate`) und in `/auth/me`,
damit die Weboberfläche den Hinweis anzeigen kann. Zwei Abfragen an
zwei Stellen wären zwei Gelegenheiten, die Bedeutung von NULL unterschiedlich
auszulegen.

Gelesen wird mit `service_role`: die Tabelle ist für `anon` und `authenticated`
vollständig gesperrt (Wurzel 6), sonst könnte ein Eigentümer seine eigene Sperre
per Direktpfad aufheben.
"""
import time
from datetime import datetime

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
_stand: dict[str, object] = {"zeit": 0.0, "zeile": {}, "gueltig": False}


def _zeile() -> dict:
    """Die eine Zeile, gepuffert. EIN Leser fuer alle Schalter.

    Frueher las diese Datei nur den Portal-Schalter. Mit dem zweiten (0727)
    waere daraus sonst eine zweite Abfrage geworden — zwei Puffer, zwei
    Gueltigkeiten, und bei einer Sperre haette der eine Schalter schon
    umgeschaltet, waehrend der andere noch den alten Stand zeigt.

    Fail-OPEN bei einer Stoerung, ausdruecklich: eine Verwaltungssperre darf
    nicht von selbst zuschnappen, wenn die Datenbank hustet. Der Fehler wird
    dabei LAUT geloggt (Wurzel 5).
    """
    jetzt = time.monotonic()
    alter = jetzt - float(_stand["zeit"] or 0.0)  # type: ignore[arg-type]
    if _stand["gueltig"] and alter < _PUFFER_SEKUNDEN:
        return dict(_stand["zeile"])  # type: ignore[arg-type]
    try:
        zeile = (
            get_service_client()
            .table("plattform_schalter")
            .select(
                "eigentuemer_portal_gesperrt_seit, eigentuemer_portal_hinweis, "
                "partner_portal_gesperrt_seit, partner_portal_hinweis"
            )
            .limit(1)
            .execute()
        ).data
    except Exception:  # noqa: BLE001 — Stoerung sperrt nicht aus, siehe Docstring
        log.exception("plattform_schalter_nicht_lesbar")
        return {}
    daten = dict(zeile[0]) if zeile else {}
    _stand.update({"zeit": jetzt, "zeile": daten, "gueltig": True})
    return daten


def _sperre(seit_feld: str, hinweis_feld: str) -> str | None:
    """Gemeinsame Auswertung: gesetzt = gesperrt, der Hinweis ist der Text.

    Kein boolescher Rueckgabewert, weil der Aufrufer sonst zweimal fragen
    muesste („gesperrt?" und „welcher Text?") und dabei zwei verschiedene
    Staende sehen koennte. Leerer Text heisst „gesperrt ohne eigenen Hinweis" —
    NICHT offen; genau hier wuerde ein `if hinweis:` die Sperre still aufheben.
    """
    daten = _zeile()
    seit = daten.get(seit_feld)
    # TYPSTRENG, und das ist kein Test-Zugestaendnis: gesperrt ist nur, wer
    # einen echten Zeitstempel trägt. Ein beliebiger wahrheitswertiger Wert
    # genuegt NICHT.
    #
    # Gefunden am 20.09.2026: die Fake-DB der Tests liefert fuer eine ihr
    # unbekannte Tabelle einen MagicMock — der ist wahr, und damit galt in 30
    # Tests plötzlich alles als gesperrt. Dieselbe Klasse Fehler traefe live
    # jede Antwortform, die nicht die erwartete ist. Ein Schalter, der bei
    # unklarer Datenlage zuschnappt, sperrt irgendwann ohne Anlass aus
    # (Wurzel 4/5).
    if not isinstance(seit, str | datetime) or (
        isinstance(seit, str) and not seit.strip()
    ):
        return None
    hinweis = daten.get(hinweis_feld)
    return hinweis if isinstance(hinweis, str) and hinweis.strip() else ""


def eigentuemer_portal_sperre() -> str | None:
    """Ist das Eigentuemer-Portal gesperrt (0726)?

    ``None`` = offen. ``str`` = gesperrt; der Text kann leer sein, dann waehlt
    der Aufrufer seinen Standardtext.
    """
    return _sperre(
        "eigentuemer_portal_gesperrt_seit", "eigentuemer_portal_hinweis"
    )


def partner_portal_sperre() -> str | None:
    """Ist das Partner-Dashboard gesperrt (0727)?

    ``None`` = offen. ``str`` = gesperrt; der Text kann leer sein.
    """
    return _sperre("partner_portal_gesperrt_seit", "partner_portal_hinweis")


def puffer_leeren() -> None:
    """Puffer verwerfen — für Tests und für den Fall, dass eine Sperre SOFORT
    greifen muss, ohne die 30 Sekunden abzuwarten."""
    _stand.update({"zeit": 0.0, "zeile": {}, "gueltig": False})
