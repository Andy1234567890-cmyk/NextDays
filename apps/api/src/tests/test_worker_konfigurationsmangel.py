"""Ein fehlender Stripe-Schlüssel muss LAUT sein, nicht wie ein Netzfehler.

Kontext (25.08.2026): `nextdays-api` und `nextdays-worker` fahren denselben
Code aus demselben Repo, sind in Coolify aber zwei Anwendungen mit je eigener,
handgepflegter Variablenliste. Live nachgemessen trug die API
`STRIPE_SECRET_KEY`, der Worker nicht — und genau der Worker fährt die drei
geldbewegenden Läufe: Einzug fälliger Restzahlungen, Auszahlungen an die
Betriebe, Provisions- und Nutzungsabrechnung am Monatsersten.

Der Mangel selbst ist eine Zeile Konfiguration. Der Fehler im Code war, dass er
STILL blieb: alle drei Ticks fingen `Exception` breit und schrieben ein
`log.warning` — dieselbe Zeile wie bei „Stripe war kurz nicht erreichbar". Ein
Betriebsmangel, der aussieht wie ein vorübergehender Netzfehler, wird nie
behoben (Wurzel 5). Beim Provisionslauf wiegt das am schwersten: er kommt nur
einmal im Monat vorbei.

Gegen `capsys` geprüft, nicht gegen `caplog`: structlog schreibt am
logging-Modul vorbei auf die Standardausgabe.
"""
from __future__ import annotations

import re
from types import SimpleNamespace

import pytest

from src import worker as worker_modul
from src.core import pflichtumgebung
from src.jobs import geld_laeufe

# structlogs Konsolen-Renderer faerbt die Stufe ein; die Escape-Sequenzen
# stehen dann MITTEN im gesuchten Text („[\x1b[31merror"). Ob gefaerbt wird,
# haengt daran, welcher Test vorher `configure_logging` gerufen hat — der Test
# darf davon nicht abhaengen.
_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def _ohne_farben(text: str) -> str:
    return _ANSI.sub("", text)


def test_startpruefung_meldet_jede_fehlende_pflichtvariable(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Beim Start, nicht erst beim ersten Geldfluss.

    Ohne diese Prüfung fiele der fehlende Schlüssel frühestens am nächsten
    Monatsersten auf — und dann als Fehlschlag statt als Vorwarnung.
    """
    monkeypatch.setattr(
        pflichtumgebung, "get_settings",
        lambda: SimpleNamespace(
            stripe_secret_key=SimpleNamespace(get_secret_value=lambda: ""),
            app_base_url="",
            company_legal_name="",
        ),
    )
    worker_modul._pflichtvariablen_melden()  # noqa: SLF001
    ausgabe = _ohne_farben(capsys.readouterr().out)
    for variable in ("STRIPE_SECRET_KEY", "APP_BASE_URL", "COMPANY_LEGAL_NAME"):
        assert variable in ausgabe
    # Die Meldung sagt, WAS zu tun ist — sonst sucht sie jemand im Code statt
    # in der Konfiguration.
    assert "nextdays-worker" in ausgabe
    assert "REDEPLOY" in ausgabe.upper()


def test_startpruefung_schweigt_bei_vollstaendiger_umgebung(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Kein Rauschen im Normalfall — sonst liest die Meldung bald niemand.

    DIE VOLLSTÄNDIGE UMGEBUNG WIRD AUS `_PFLICHT_ENV` ERZEUGT, nicht von Hand
    aufgezählt: eine handgeschriebene Liste veraltet genau dann, wenn jemand
    eine neue Pflichtvariable einträgt — und dann meldet dieser Test einen
    Mangel, den es nicht gibt. Real passiert mit `SEAM_API_KEY` (0573): der
    Wert kam zu `_PFLICHT_ENV` dazu, dieser Mock nicht, der Test wurde rot,
    und weil kein Deploy bei rotem CI läuft, stand die Schloss-Route auf dem
    Server nie zur Verfügung (HTTP 404 auf den Seam-Webhook).
    """
    vollstaendig = SimpleNamespace(
        **{
            w.settings_feld: SimpleNamespace(get_secret_value=lambda: "gesetzt")
            if w.env_name.endswith(("_KEY", "_SECRET", "_TOKEN"))
            else f"wert-fuer-{w.settings_feld}"
            for w in worker_modul._PFLICHT_ENV  # noqa: SLF001
        }
    )
    monkeypatch.setattr(pflichtumgebung, "get_settings", lambda: vollstaendig)
    worker_modul._pflichtvariablen_melden()  # noqa: SLF001
    assert "pflichtvariable_fehlt" not in _ohne_farben(
        capsys.readouterr().out
    )


def test_konfigurationsmangel_ist_error_mit_anweisung(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Stufe ERROR und ein eigener Ereignisname — damit der Mangel im
    Log-Rauschen der transienten Tick-Fehler auffindbar bleibt."""
    geld_laeufe._mangel(  # noqa: SLF001
        "balance_tick_nicht_konfiguriert",
        RuntimeError("Stripe ist nicht konfiguriert"),
        faellig=3,
    )
    ausgabe = _ohne_farben(capsys.readouterr().out)
    assert "balance_tick_nicht_konfiguriert" in ausgabe
    # Gegen BEIDE Renderer geprüft: structlog schreibt im Container JSON, im
    # Testlauf menschenlesbar — und ob dabei Farbcodes dazwischenstehen, hängt
    # daran, welcher Test vorher `configure_logging` gerufen hat. Der Test soll
    # die STUFE festhalten, nicht die Renderer-Einstellung des Laufs.
    assert "[error" in ausgabe or '"level": "error"' in ausgabe
    assert "STRIPE_SECRET_KEY" in ausgabe
    # Die Zusatzfelder des Aufrufers landen als eigene Schlüssel, nicht im Text.
    assert "faellig" in ausgabe


def test_pflichtliste_nennt_die_folge_jeder_variablen() -> None:
    """Eine Meldung ohne Folge ist eine Meldung, die niemand priorisiert."""
    for env_name, feld, folge in worker_modul._PFLICHT_ENV:  # noqa: SLF001
        assert env_name.isupper()
        assert feld.islower()
        assert len(folge) > 20, env_name
