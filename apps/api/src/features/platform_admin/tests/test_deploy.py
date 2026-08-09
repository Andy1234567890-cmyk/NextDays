"""Tests für den Deploy-Monitor (Coolify-Anbindung im Backoffice).

Schwerpunkte, weil hier live ausgerollt wird:
1. Ohne Zugang wird NICHT geraten, sondern klar 503 (Wurzel 4).
2. Coolify-Fehler werden nicht zu leeren Listen verschluckt (Wurzel 5).
3. Ein Deploy geht nur auf eine Anwendung, die wir wirklich führen
   (fail-closed gegen frei gewählte UUIDs).
"""
from datetime import UTC, datetime, timedelta
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
        ueb = DeployService().uebersicht_von_coolify()

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


# --- Realtime-Spiegel: Push statt Polling -----------------------------------


def _spiegel_db(bestand: list[dict] | None = None) -> MagicMock:
    """DB-Attrappe, deren `select` einen definierten Ist-Stand liefert.

    `spiegel_aktualisieren` liest den Spiegel VOR dem Schreiben, um nur bei
    echter Änderung zu schreiben — ohne definierten Ist-Stand liefe der Test
    gegen einen MagicMock und prüfte nichts.
    """
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = bestand or []
    return db


def test_spiegel_schreibt_fortschreibend_und_raet_nichts() -> None:
    """Der Worker spiegelt Coolify nach deploy_spiegel (Migration 0294).

    Ohne diesen Spiegel müsste der Browser pollen. Wichtig: eine Anwendung
    OHNE bekannten Deploy wird `unbekannt`, nicht „erfolgreich" (Wurzel 4).
    """
    from src.features.platform_admin import deploy_spiegel
    from src.features.platform_admin.schemas import DeployApp, DeployUebersicht

    db = _spiegel_db()
    ueb = DeployUebersicht(
        apps=[
            DeployApp(
                uuid="u1",
                name="nextdays-api",
                laeuft=True,
                letzter=_eintrag({"status": "in_progress", "commit": "abc12345"}),
            ),
            DeployApp(uuid="u2", name="nextdays-web", laeuft=False, letzter=None),
        ],
        aktiv=True,
    )
    with patch.object(deploy_spiegel, "get_settings") as gs, patch.object(
        deploy_spiegel.DeployService, "uebersicht_von_coolify", return_value=ueb
    ):
        gs.return_value.coolify_configured = True
        aktiv = deploy_spiegel.spiegel_aktualisieren(db)

    assert aktiv is True
    zeilen = db.table.return_value.upsert.call_args[0][0]
    assert len(zeilen) == 2
    assert zeilen[0]["status"] == "in_progress"
    assert zeilen[0]["commit"] == "abc12345"
    # Kein erfundener Erfolg für eine Anwendung ohne Deploy.
    assert zeilen[1]["status"] == "unbekannt"
    # Fortschreiben statt ansammeln: je Anwendung genau eine Zeile.
    assert db.table.return_value.upsert.call_args[1]["on_conflict"] == "anwendung_uuid"


def test_spiegel_ohne_coolify_schreibt_nichts() -> None:
    """Ohne Zugang keine Zeilen — kein leerer Spiegel, der Ruhe vortäuscht."""
    from src.features.platform_admin import deploy_spiegel

    db = MagicMock()
    with patch.object(deploy_spiegel, "get_settings") as gs:
        gs.return_value.coolify_configured = False
        assert deploy_spiegel.spiegel_aktualisieren(db) is False
    db.table.assert_not_called()


# --- Rückstand: was liegt zwischen dem ausgerollten Stand und main? ----------


def test_watch_pfade_streift_die_glob_endung() -> None:
    """Coolify speichert `apps/api/**`; verglichen wird gegen `apps/api/`."""
    from src.features.platform_admin.deploy_rueckstand import watch_pfade

    assert watch_pfade("apps/api/**\ndeploy/worker/**") == (
        "apps/api/",
        "deploy/worker/",
    )
    assert watch_pfade("") == ()
    assert watch_pfade(None) == ()


def test_betrifft_nur_eigene_pfade() -> None:
    """Ein Commit zählt für eine App nur, wenn er ihre watch_paths berührt.

    Das ist die eigentliche Antwort auf „muss ich deployen": ein Doku-Commit
    macht den Worker nicht deploy-bedürftig.
    """
    from src.features.platform_admin.deploy_rueckstand import _betrifft

    dateien = ["apps/api/src/x.py", "web/app/y.tsx", "docs/z.md"]
    assert _betrifft(dateien, ("apps/api/", "deploy/worker/")) == ["apps/api/src/x.py"]
    assert _betrifft(dateien, ("web/", "packages/")) == ["web/app/y.tsx"]
    assert _betrifft(dateien, ("deploy/kong/",)) == []


def test_ohne_watch_paths_gilt_nichts_als_betroffen() -> None:
    """Fail-closed: keine Pfade heißt „kein Commit betrifft mich".

    „Betrifft alles" wäre der erfundene Wert (Wurzel 4) und führte zu einem
    Deploy, den niemand gewollt hat.
    """
    from src.features.platform_admin.deploy_rueckstand import _betrifft

    assert _betrifft(["apps/api/src/x.py"], ()) == []


def test_ohne_github_token_kein_erfundener_nullwert() -> None:
    """Kein Zugang → `commits_gesamt` bleibt None, nicht 0.

    Eine 0 hieße „alles ausgerollt" — eine Aussage, die wir ohne Abruf nicht
    treffen dürfen.
    """
    from src.features.platform_admin import deploy_rueckstand

    with patch.object(deploy_rueckstand, "_kopf", return_value=None):
        r = deploy_rueckstand.Sammler().fuer("abc1234", "apps/api/**")

    assert r.commits_gesamt is None
    assert r.betrifft_mich is False
    assert r.fehler == "Kein GitHub-Zugang hinterlegt."


def test_ohne_ausgerollten_commit_kein_vergleich() -> None:
    """Eine nie deployte App hat keinen Bezugspunkt — das sagt sie auch."""
    from src.features.platform_admin import deploy_rueckstand

    with patch.object(deploy_rueckstand, "_kopf", return_value={"a": "b"}), \
         patch.object(deploy_rueckstand, "_repo_pfad", return_value="o/r"):
        r = deploy_rueckstand.Sammler().fuer(None, "apps/api/**")

    assert r.commits_gesamt is None
    assert r.fehler == "Kein ausgerollter Commit bekannt."


# --- Kein Event-Dauerfeuer: nur bei echter Änderung schreiben ---------------


def test_spiegel_schreibt_nicht_wenn_sich_nichts_geaendert_hat() -> None:
    """Der Kern des Realtime-Umbaus: unveränderter Zustand → KEIN UPDATE.

    Jedes UPDATE ist ein Realtime-Event, und jedes Event lässt das Backoffice
    neu laden. Im 5-Sekunden-Takt während eines Baus wäre ein bedingungsloses
    `upsert` Dauerfeuer aus Ereignissen ohne Informationsgehalt — genau das
    ließ die Oberfläche ruckeln.
    """
    from src.features.platform_admin import deploy_spiegel
    from src.features.platform_admin.schemas import DeployApp, DeployUebersicht

    jetzt = datetime.now(UTC)
    bestand = [{
        "anwendung_uuid": "u1",
        "name": "nextdays-api",
        "status": "finished",
        "deployment_uuid": "dep-1",
        "commit": "abc12345",
        "commit_nachricht": None,
        "gestartet_at": None,
        "beendet_at": None,
        "deploy_id": None,
        "anwendung": "nextdays-api",
        "log_url": None,
        "laeuft": False,
        "rueckstand": None,
        "main_sha": None,
        # Frisch geprüft: auch der Heartbeat ist noch nicht fällig.
        "geprueft_at": jetzt.isoformat(),
        "aktualisiert_at": jetzt.isoformat(),
    }]
    db = _spiegel_db(bestand)
    ueb = DeployUebersicht(apps=[DeployApp(
        uuid="u1",
        name="nextdays-api",
        laeuft=False,
        letzter=_eintrag({
            "deployment_uuid": "dep-1",
            "application_name": "nextdays-api",
            "status": "finished",
            "commit": "abc12345",
        }),
    )])
    with patch.object(deploy_spiegel, "get_settings") as gs, patch.object(
        deploy_spiegel.DeployService, "uebersicht_von_coolify", return_value=ueb
    ):
        gs.return_value.coolify_configured = True
        deploy_spiegel.spiegel_aktualisieren(db)

    db.table.return_value.upsert.assert_not_called()


def test_spiegel_schreibt_bei_statuswechsel() -> None:
    """Die Gegenprobe: ändert sich der Status wirklich, MUSS geschrieben werden."""
    from src.features.platform_admin import deploy_spiegel
    from src.features.platform_admin.schemas import DeployApp, DeployUebersicht

    jetzt = datetime.now(UTC)
    bestand = [{
        "anwendung_uuid": "u1",
        "name": "nextdays-api",
        "status": "finished",
        "laeuft": False,
        "geprueft_at": jetzt.isoformat(),
        "aktualisiert_at": jetzt.isoformat(),
    }]
    db = _spiegel_db(bestand)
    ueb = DeployUebersicht(apps=[DeployApp(
        uuid="u1",
        name="nextdays-api",
        laeuft=True,
        letzter=_eintrag({"status": "in_progress", "application_name": "nextdays-api"}),
    )])
    with patch.object(deploy_spiegel, "get_settings") as gs, patch.object(
        deploy_spiegel.DeployService, "uebersicht_von_coolify", return_value=ueb
    ):
        gs.return_value.coolify_configured = True
        deploy_spiegel.spiegel_aktualisieren(db)

    zeilen = db.table.return_value.upsert.call_args[0][0]
    assert len(zeilen) == 1
    assert zeilen[0]["status"] == "in_progress"
    assert zeilen[0]["laeuft"] is True
    # Fachliche Änderung → beide Zeitstempel laufen mit.
    assert zeilen[0]["aktualisiert_at"] == zeilen[0]["geprueft_at"]


def test_geprueft_at_laeuft_auch_ohne_aenderung_mit() -> None:
    """„Wann haben wir zuletzt geschaut" muss sichtbar bleiben.

    Sonst sieht ein hängender Worker aus wie „alles ruhig". Der Heartbeat
    schreibt `geprueft_at` fort — `aktualisiert_at` bleibt aber stehen, genau
    daran erkennt die Oberfläche „läuft, tut aber nichts".
    """
    from src.features.platform_admin import deploy_spiegel
    from src.features.platform_admin.schemas import DeployApp, DeployUebersicht

    alt = datetime.now(UTC) - timedelta(
        seconds=deploy_spiegel.GEPRUEFT_HEARTBEAT_SECONDS + 60
    )
    bestand = [{
        "anwendung_uuid": "u1",
        "name": "nextdays-api",
        "status": "unbekannt",
        "laeuft": False,
        "geprueft_at": alt.isoformat(),
        "aktualisiert_at": alt.isoformat(),
    }]
    db = _spiegel_db(bestand)
    ueb = DeployUebersicht(
        apps=[DeployApp(uuid="u1", name="nextdays-api", laeuft=False, letzter=None)]
    )
    with patch.object(deploy_spiegel, "get_settings") as gs, patch.object(
        deploy_spiegel.DeployService, "uebersicht_von_coolify", return_value=ueb
    ):
        gs.return_value.coolify_configured = True
        deploy_spiegel.spiegel_aktualisieren(db)

    zeilen = db.table.return_value.upsert.call_args[0][0]
    assert zeilen[0]["geprueft_at"] != alt.isoformat()
    # Fachlich unverändert → aktualisiert_at bleibt der ALTE Wert.
    assert zeilen[0]["aktualisiert_at"] == alt.isoformat()


def test_rueckstand_wird_mitgespiegelt() -> None:
    """Der GitHub-/compare gehört in den Worker-Tick, nicht in den Request.

    Er war der teuerste Teil des alten Lesepfads (ein Aufruf je ausgerolltem
    Commit, 20 s Timeout) — bei jedem Realtime-Event erneut.
    """
    from src.features.platform_admin import deploy_spiegel
    from src.features.platform_admin.schemas import (
        DeployApp,
        DeployRueckstand,
        DeployUebersicht,
    )

    db = _spiegel_db()
    ueb = DeployUebersicht(
        apps=[DeployApp(
            uuid="u1",
            name="nextdays-api",
            rueckstand=DeployRueckstand(
                commits_gesamt=7, commits_relevant=2, betrifft_mich=True
            ),
        )],
        main_sha="deadbeefcafe",
    )
    with patch.object(deploy_spiegel, "get_settings") as gs, patch.object(
        deploy_spiegel.DeployService, "uebersicht_von_coolify", return_value=ueb
    ):
        gs.return_value.coolify_configured = True
        deploy_spiegel.spiegel_aktualisieren(db)

    zeile = db.table.return_value.upsert.call_args[0][0][0]
    assert zeile["rueckstand"]["commits_relevant"] == 2
    assert zeile["rueckstand"]["betrifft_mich"] is True
    assert zeile["main_sha"] == "deadbeefcafe"


# --- Lesepfad: aus dem Spiegel, nicht live aus Coolify ----------------------


def test_uebersicht_aus_spiegel_ruft_coolify_nicht_an() -> None:
    """Der eigentliche Fix: der Request-Pfad fasst Coolify nicht mehr an.

    Vorher löste jedes Realtime-Event eine serielle HTTP-Kette aus (ein Aufruf
    für die laufenden Deploys, einer JE nicht laufender App, dazu watch_paths
    und GitHub). Jetzt ist es ein Query.
    """
    apps = ueberwachte_apps()
    uuid, name = apps[0]
    db = _spiegel_db([{
        "anwendung_uuid": uuid,
        "name": name,
        "status": "finished",
        "deployment_uuid": "dep-9",
        "commit": "abc12345",
        "deploy_id": 919,
        "anwendung": name,
        "log_url": "https://coolify.example.com/log/9",
        "laeuft": False,
        "rueckstand": {"commits_gesamt": 3, "commits_relevant": 1,
                       "betrifft_mich": True, "offene": [], "fehler": None},
        "main_sha": "cafebabe1234",
        "geprueft_at": "2026-08-09T10:00:00+00:00",
        "aktualisiert_at": "2026-08-09T09:00:00+00:00",
    }])

    with patch.object(coolify, "laufende_deploys", side_effect=AssertionError(
        "Der Lesepfad darf Coolify nicht mehr anfassen"
    )), patch.object(coolify, "verlauf", side_effect=AssertionError("desgleichen")):
        ueb = DeployService.uebersicht_aus_spiegel(db)

    treffer = next(a for a in ueb.apps if a.uuid == uuid)
    assert treffer.letzter is not None
    assert treffer.letzter.id == 919
    assert treffer.letzter.log_url == "https://coolify.example.com/log/9"
    assert treffer.rueckstand is not None
    assert treffer.rueckstand.commits_relevant == 1
    assert ueb.main_sha == "cafebabe1234"
    assert ueb.main_kurz_sha == "cafebabe"
    # geprueft_at wird ausgeliefert — das Frontend zeigt damit „steht still".
    assert treffer.geprueft_at is not None
    assert treffer.aktualisiert_at is not None


def test_uebersicht_aus_spiegel_fuehrt_apps_ohne_zeile_leer() -> None:
    """Eine geführte App ohne Spiegel-Zeile fehlt nicht, sie ist sichtbar leer.

    Stillschweigendes Weglassen wäre der gefährliche Weg: die App verschwände
    aus dem Monitor, statt zu zeigen, dass über sie nichts bekannt ist.
    """
    db = _spiegel_db([])
    ueb = DeployService.uebersicht_aus_spiegel(db)

    assert len(ueb.apps) == len(ueberwachte_apps())
    assert all(a.letzter is None for a in ueb.apps)
    assert all(a.rueckstand is None for a in ueb.apps)
    assert all(a.geprueft_at is None for a in ueb.apps)
    assert ueb.aktiv is False
    # Kein erfundener Rückstand und kein erfundener main-Stand.
    assert ueb.main_sha is None
    # Leerer Spiegel → „nie geprüft", nicht „gerade eben".
    assert ueb.spiegel_geprueft_at is None


def test_spiegel_geprueft_at_ist_der_aelteste_wert() -> None:
    """Der ÄLTESTE Blick zählt: eine frische Zeile darf nicht Frische vortäuschen."""
    apps = ueberwachte_apps()
    db = _spiegel_db([
        {"anwendung_uuid": apps[0][0], "name": apps[0][1], "status": "finished",
         "geprueft_at": "2026-08-09T10:00:00+00:00"},
        {"anwendung_uuid": apps[1][0], "name": apps[1][1], "status": "finished",
         "geprueft_at": "2026-08-09T08:00:00+00:00"},
    ])
    ueb = DeployService.uebersicht_aus_spiegel(db)
    assert ueb.spiegel_geprueft_at is not None
    assert ueb.spiegel_geprueft_at.hour == 8


def test_spiegel_ohne_deploy_liefert_keinen_leeren_eintrag() -> None:
    """`status='unbekannt'` ohne deployment_uuid heißt: es gibt keinen Deploy."""
    apps = ueberwachte_apps()
    db = _spiegel_db([{
        "anwendung_uuid": apps[0][0],
        "name": apps[0][1],
        "status": "unbekannt",
        "deployment_uuid": None,
        "geprueft_at": "2026-08-09T10:00:00+00:00",
    }])
    ueb = DeployService.uebersicht_aus_spiegel(db)
    treffer = next(a for a in ueb.apps if a.uuid == apps[0][0])
    assert treffer.letzter is None
    # Der Blick des Workers ist trotzdem bekannt.
    assert treffer.geprueft_at is not None
