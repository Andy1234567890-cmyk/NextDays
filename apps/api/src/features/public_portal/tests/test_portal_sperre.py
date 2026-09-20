"""Tests für die plattformweite Sperre des Eigentümer-Portals (0726).

Warum eine Sperre Tests braucht: Sie ist im Normalfall UNSICHTBAR — solange
niemand sie setzt, verhält sich alles wie vorher, und ein kaputter Guard fällt
niemandem auf. Gemerkt wird es erst an dem Tag, an dem sie greifen soll und es
nicht tut. Geprüft werden deshalb beide Richtungen und ausdrücklich auch das
Verhalten bei einer Störung.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.plattform import schalter
from src.features.public_portal.dependencies import portal_nicht_gesperrt

# Der Guard verlangt einen AuthContext, damit FastAPI ZUERST die Anmeldung
# aufloest (sonst bekaeme ein Aufruf ohne Token 403 statt 401). Benutzt wird
# der Wert nicht — hier genuegt ein beliebiger gueltiger Kontext.
_CTX = AuthContext(user_id="u-1", tenant_id="t-1", role="owner")


def _client(rows: list | Exception) -> MagicMock:
    client = MagicMock()
    kette = client.table.return_value.select.return_value.limit.return_value.execute
    if isinstance(rows, Exception):
        kette.side_effect = rows
    else:
        kette.return_value = MagicMock(data=rows)
    return client


@pytest.fixture(autouse=True)
def _puffer_leeren() -> None:
    """Ohne das trägt der Puffer das Ergebnis des vorigen Tests 30 Sekunden
    weiter — die Tests würden sich gegenseitig beeinflussen und je nach
    Reihenfolge bestehen oder scheitern."""
    schalter.puffer_leeren()


def test_offen_laesst_durch() -> None:
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client([
            {
                "eigentuemer_portal_gesperrt_seit": None,
                "eigentuemer_portal_hinweis": None,
            }
        ]),
    ):
        portal_nicht_gesperrt(_CTX)


def test_gesperrt_gibt_403_mit_eigenem_hinweis() -> None:
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client([
            {
                "eigentuemer_portal_gesperrt_seit": "2026-09-19T14:00:00+00:00",
                "eigentuemer_portal_hinweis": "Wir stellen gerade um.",
            }
        ]),
    ):
        with pytest.raises(HTTPException) as exc:
            portal_nicht_gesperrt(_CTX)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Wir stellen gerade um."


def test_gesperrt_ohne_hinweis_nimmt_den_standardtext() -> None:
    """Leerer Hinweis heisst „gesperrt, aber ohne eigenen Text" — NICHT „offen".
    Genau hier würde ein `if hinweis:` statt `if gesperrt:` die Sperre still
    aufheben."""
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client([
            {
                "eigentuemer_portal_gesperrt_seit": "2026-09-19T14:00:00+00:00",
                "eigentuemer_portal_hinweis": None,
            }
        ]),
    ):
        with pytest.raises(HTTPException) as exc:
            portal_nicht_gesperrt(_CTX)
    assert exc.value.status_code == 403
    assert "vorübergehend nicht verfügbar" in exc.value.detail


def test_stoerung_sperrt_NICHT_aus() -> None:
    """Fail-OPEN, und das ist Absicht (siehe Docstring der Funktion): eine
    Verwaltungssperre darf nicht von selbst zuschnappen, wenn die Datenbank
    ausfällt. Sonst wäre jede DB-Störung eine Aussperrung aller Eigentümer."""
    with patch.object(
        schalter, "get_service_client", side_effect=RuntimeError("DB weg")
    ):
        portal_nicht_gesperrt(_CTX)


def test_leere_tabelle_ist_offen() -> None:
    """Fehlt die Zeile (frische DB, Migration halb gelaufen), gilt „offen" —
    kein erfundener Sperrzustand (Wurzel 4)."""
    with patch.object(schalter, "get_service_client", return_value=_client([])):
        portal_nicht_gesperrt(_CTX)


def test_puffer_spart_die_zweite_abfrage() -> None:
    """Der Guard hängt am Router und läuft bei JEDER Portal-Anfrage. Ohne
    Puffer wäre das eine DB-Abfrage pro Aufruf."""
    client = _client([
        {
            "eigentuemer_portal_gesperrt_seit": None,
            "eigentuemer_portal_hinweis": None,
        }
    ])
    with patch.object(schalter, "get_service_client", return_value=client):
        portal_nicht_gesperrt(_CTX)
        portal_nicht_gesperrt(_CTX)
        portal_nicht_gesperrt(_CTX)
    assert client.table.call_count == 1
