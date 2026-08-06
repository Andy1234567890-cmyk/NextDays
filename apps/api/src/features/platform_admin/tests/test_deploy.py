"""Tests für den Deploy-Monitor (Coolify-Anbindung im Backoffice).

Schwerpunkte, weil hier live ausgerollt wird:
1. Ohne Zugang wird NICHT geraten, sondern klar 503 (Wurzel 4).
2. Coolify-Fehler werden nicht zu leeren Listen verschluckt (Wurzel 5).
3. Ein Deploy geht nur auf eine Anwendung, die wir wirklich führen
   (fail-closed gegen frei gewählte UUIDs).
"""
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from src.features.platform_admin import coolify
from src.features.platform_admin.deploy_service import (
    DeployService,
    _eintrag,
    _zeit,
    ueberwachte_apps,
)


def _einstellungen(
    *, url: str = "https://coolify.example.com", token: str | None = None
) -> MagicMock:
    token = "test-attrappe" if token is None else token
    s = MagicMock(name="settings")
    s.coolify_configured = bool(url and token)
    s.coolify_api_url = url
    s.coolify_token.get_secret_value.return_value = token
    return s


# --- Kein Zugang: klar fehlschlagen statt Ersatzwerte -----------------------


def test_ohne_zugang_503_statt_leerer_liste() -> None:
    with patch.object(coolify, "get_settings", return_value=_einstellungen(url="", token="")):
        with pytest.raises(HTTPException) as exc:
            coolify.laufende_deploys()
    assert exc.value.status_code == 503
    # Der Name muss COOLIFY_API_URL sein: COOLIFY_URL belegt Coolify selbst.
    assert "COOLIFY_API_URL" in exc.value.detail


# --- Coolify-Fehler werden nicht verschluckt --------------------------------


def test_abgelehnter_token_wird_502_nicht_leer() -> None:
    antwort = httpx.Response(401, json={"message": "unauthenticated"})
    with patch.object(coolify, "get_settings", return_value=_einstellungen()), patch(
        "httpx.Client.get", return_value=antwort
    ):
        with pytest.raises(HTTPException) as exc:
            coolify.laufende_deploys()
    assert exc.value.status_code == 502
    assert "Token" in exc.value.detail


def test_coolify_nicht_erreichbar_wird_502() -> None:
    with patch.object(coolify, "get_settings", return_value=_einstellungen()), patch(
        "httpx.Client.get", side_effect=httpx.ConnectError("weg")
    ):
        with pytest.raises(HTTPException) as exc:
            coolify.laufende_deploys()
    assert exc.value.status_code == 502


def test_unbekannte_anwendung_wird_404() -> None:
    antwort = httpx.Response(404, json={})
    with patch.object(coolify, "get_settings", return_value=_einstellungen()), patch(
        "httpx.Client.get", return_value=antwort
    ):
        with pytest.raises(HTTPException) as exc:
            coolify.verlauf("gibtesnicht")
    assert exc.value.status_code == 404


# --- Obergrenze (Wurzel 8) --------------------------------------------------


def test_verlauf_limit_ist_gedeckelt() -> None:
    erfasst: dict[str, str] = {}

    def _get(self, url, **kwargs):  # noqa: ANN001, ARG001
        erfasst["url"] = url
        return httpx.Response(200, json=[])

    with patch.object(coolify, "get_settings", return_value=_einstellungen()), patch(
        "httpx.Client.get", _get
    ):
        coolify.verlauf("uuid-1", limit=99999)
    assert "take=100" in erfasst["url"]


# --- App-Liste: geteilte Quelle mit der CI ----------------------------------


def test_app_liste_kommt_aus_der_ci_datei() -> None:
    """Dieselbe Datei wie CI-Build und CI-Deploy — keine zweite Liste."""
    apps = ueberwachte_apps()
    assert len(apps) >= 10
    namen = {name for _, name in apps}
    assert "nextdays-api" in namen
    assert "nextdays-web" in namen
    # UUIDs sind nicht leer und eindeutig.
    uuids = [uuid for uuid, _ in apps]
    assert all(uuids)
    assert len(uuids) == len(set(uuids))


# --- Deploy auslösen: fail-closed -------------------------------------------


def test_ausloesen_lehnt_fremde_uuid_ab() -> None:
    """Eine UUID, die nicht in unserer Liste steht, wird nicht deployt."""
    with pytest.raises(HTTPException) as exc:
        DeployService().ausloesen("voellig-frei-erfunden")
    assert exc.value.status_code == 404


def test_ausloesen_ruft_coolify_mit_post() -> None:
    """POST ist Pflicht: GET /api/v1/deploy quittiert Coolify mit 405."""
    bekannte = ueberwachte_apps()[0][0]
    with patch.object(
        coolify, "deploy_ausloesen", return_value={"deployments": [{"uuid": "d1"}]}
    ) as ruf:
        ergebnis = DeployService().ausloesen(bekannte)
    ruf.assert_called_once_with(bekannte)
    assert ergebnis["deployments"][0]["uuid"] == "d1"


# --- Übersetzung der Coolify-Zeilen -----------------------------------------


def test_zeit_unlesbar_wird_none_nicht_jetzt() -> None:
    """Ein kaputter Zeitwert darf nicht als 'gerade eben' erscheinen."""
    assert _zeit("kein-datum") is None
    assert _zeit("") is None
    assert _zeit(None) is None
    assert _zeit("2026-08-06T07:00:52Z") is not None


def test_eintrag_uebernimmt_felder_ohne_erfindung() -> None:
    roh = {
        "id": 919,
        "deployment_uuid": "dep-1",
        "application_name": "nextdays-web",
        "status": "finished",
        "commit": "e1112ee0",
        "commit_message": "test: etwas",
        "created_at": "2026-08-06T07:00:52Z",
        "finished_at": "2026-08-06T07:05:00Z",
    }
    e = _eintrag(roh)
    assert e.id == 919
    assert e.anwendung == "nextdays-web"
    assert e.status == "finished"
    assert e.commit == "e1112ee0"
    assert e.beendet_at is not None
    # Nicht geliefert → None, kein Platzhalter.
    assert e.log_url is None


def test_eintrag_ohne_status_wird_nicht_erfolgreich_geraten() -> None:
    e = _eintrag({}, name_fallback="nextdays-api")
    assert e.status == "unbekannt"
    assert e.anwendung == "nextdays-api"


# --- Übersicht: ein Aufruf für alle laufenden Deploys -----------------------


def test_uebersicht_markiert_laufenden_deploy() -> None:
    apps = ueberwachte_apps()
    laufend_uuid = apps[0][0]
    with patch.object(
        coolify,
        "laufende_deploys",
        return_value=[
            {
                "application_uuid": laufend_uuid,
                "application_name": apps[0][1],
                "status": "in_progress",
            }
        ],
    ), patch.object(coolify, "verlauf", return_value=[]):
        ueb = DeployService().uebersicht()

    assert ueb.aktiv is True
    treffer = [a for a in ueb.apps if a.uuid == laufend_uuid]
    assert treffer and treffer[0].laeuft is True
    # Alle anderen ohne Verlauf: kein erfundener Status.
    andere = [a for a in ueb.apps if a.uuid != laufend_uuid]
    assert all(a.letzter is None and a.laeuft is False for a in andere)


# --- Build-Log: eigener Token, eigene Fehlerpfade ---------------------------


def _log_einstellungen(*, log_token: str | None = None) -> MagicMock:
    log_token = "log-attrappe" if log_token is None else log_token
    s = _einstellungen()
    s.coolify_logs_configured = bool(log_token)
    s.coolify_log_token.get_secret_value.return_value = log_token
    return s


def test_log_ohne_eigenen_token_503() -> None:
    """Ohne COOLIFY_LOG_TOKEN kein Log — und kein leeres 'alles gut'."""
    with patch.object(
        coolify, "get_settings", return_value=_log_einstellungen(log_token="")
    ):
        with pytest.raises(HTTPException) as exc:
            coolify.build_log("dep-1")
    assert exc.value.status_code == 503
    assert "COOLIFY_LOG_TOKEN" in exc.value.detail


def test_log_nutzt_den_log_token_nicht_den_deploy_token() -> None:
    """Rechtetrennung: das Log liest mit dem getrennten Geheimnis."""
    erfasst: dict[str, str] = {}

    def _get(self, url, **kwargs):  # noqa: ANN001, ARG001
        erfasst["auth"] = kwargs.get("headers", {}).get("Authorization", "")
        return httpx.Response(200, json={"status": "finished", "logs": "[]"})

    with patch.object(
        coolify, "get_settings", return_value=_log_einstellungen()
    ), patch("httpx.Client.get", _get):
        coolify.build_log("dep-1")
    assert erfasst["auth"] == "Bearer log-attrappe"


def test_log_leer_ist_kein_fehler() -> None:
    """Ein gerade gestarteter Deploy hat noch keine Zeilen."""
    antwort = httpx.Response(200, json={"status": "in_progress", "logs": None})
    with patch.object(
        coolify, "get_settings", return_value=_log_einstellungen()
    ), patch("httpx.Client.get", return_value=antwort):
        zustand, zeilen = coolify.build_log("dep-1")
    assert zustand == "in_progress"
    assert zeilen == []


def test_service_filtert_versteckte_zeilen_und_erkennt_stderr() -> None:
    roh = [
        {"output": "Schritt 1", "type": "stdout", "timestamp": "2026-08-06T08:40:08Z"},
        {"output": "intern", "type": "stdout", "hidden": True},
        {"output": "  ", "type": "stdout"},
        {"output": "Fehler!", "type": "stderr", "timestamp": "kaputt"},
    ]
    with patch.object(coolify, "build_log", return_value=("failed", roh)):
        log = DeployService().build_log("dep-1")
    assert log.status == "failed"
    # hidden und leere Zeilen fliegen raus.
    assert [z.text for z in log.zeilen] == ["Schritt 1", "Fehler!"]
    assert log.zeilen[1].art == "stderr"
    # Unlesbarer Zeitstempel wird None, nicht "jetzt".
    assert log.zeilen[1].zeit is None
