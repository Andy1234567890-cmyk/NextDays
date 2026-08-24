"""22P02 ist nicht gleich 22P02 — Client-Literal (422) vs. eigener Bruch (500).

ANLASS (23.08.2026, live): ein Trigger auf `public.tasks` verglich ein Enum mit
dem Leerstring und ließ jedes Update auflaufen mit
`invalid input value for enum public.task_status: ""`. Der zentrale Handler
machte daraus pauschal „Ungültiger Wert im Aufruf." (422) und ein `log.info`
ohne die Postgres-Meldung. In der App stand „Zustand nicht geändert · Ungültiger
Wert im Aufruf" — der Fehler sah nach einem App-Fehler aus, obwohl die App
fehlerfrei war, und im Server-Log war nichts zu finden. Beides zusammen ist
Wurzel 5: ein Kontroll-Signal verschluckt und als etwas anderes ausgegeben.
"""
import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError as PostgrestAPIError

from src.main import create_app

_router = APIRouter()


@_router.get("/_test/22p02-literal")
def _kaputtes_literal() -> None:
    """Der Aufrufer hat eine Nicht-UUID in den Pfad geschrieben."""
    raise PostgrestAPIError(
        {"code": "22P02", "message": 'invalid input syntax for type uuid: "abc"'}
    )


@_router.get("/_test/22p02-enum")
def _kaputtes_enum() -> None:
    """Niemand von außen kann das ausgelöst haben — der Wert kommt von uns."""
    raise PostgrestAPIError(
        {
            "code": "22P02",
            "message": 'invalid input value for enum public.task_status: ""',
        }
    )


@_router.get("/_test/postgrest-anderer-code")
def _anderer_code() -> None:
    raise PostgrestAPIError({"code": "23505", "message": "duplicate key"})


@pytest.fixture(name="client")
def _client() -> TestClient:
    app = create_app()
    app.include_router(_router)
    return TestClient(app, raise_server_exceptions=False)


def test_kaputtes_literal_bleibt_422(client: TestClient) -> None:
    """Angreiferkontrollierter Input darf keinen 500 werfen (Wurzel 5)."""
    antwort = client.get("/_test/22p02-literal")
    assert antwort.status_code == 422
    assert antwort.json()["detail"] == "Ungültiger Wert im Aufruf."
    assert antwort.headers["X-Request-Id"]


def test_enum_bruch_wird_500(client: TestClient) -> None:
    """Ein Enum-Wert aus dem Body ist von Pydantic geprüft, bevor er die DB
    sieht. Kommt trotzdem ein ungültiger an, stammt er aus einem Trigger, einem
    von Hand gebauten Filter oder einer fehlenden Migration — unser Fehler, und
    er gehört mit Stacktrace ins Log statt als Eingabefehler an den Client."""
    antwort = client.get("/_test/22p02-enum")
    assert antwort.status_code == 500
    assert antwort.json()["detail"] == "internal_error"


def test_anderer_postgrest_code_bleibt_500(client: TestClient) -> None:
    antwort = client.get("/_test/postgrest-anderer-code")
    assert antwort.status_code == 500
    assert antwort.json()["detail"] == "internal_error"


def test_meldung_steht_im_log(client: TestClient, capsys: pytest.CaptureFixture[str]) -> None:
    """Ohne die Postgres-Meldung im Log ist ein 22P02 nicht von jedem anderen zu
    unterscheiden — genau daran scheiterte die Diagnose drei Tage lang.

    Gelesen wird stdout und nicht `caplog`: structlog rendert am
    logging-Handler vorbei, `caplog.records` bleibt hier leer."""
    client.get("/_test/22p02-literal")
    assert 'invalid input syntax for type uuid' in capsys.readouterr().out
