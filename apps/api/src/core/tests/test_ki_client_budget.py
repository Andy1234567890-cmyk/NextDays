"""Der KI-Client darf eine abgeschnittene Antwort nicht als fertige ausgeben.

DER ANLASS (10.09.2026, live beim Nutzer): Der Inventar-Import bat um 8000
Ausgabe-Tokens. Ein globaler Deckel `MAX_ANTWORT_TOKENS = 2048` kappte das
STILL. Das Modell brach mitten im JSON ab (`finishReason: MAX_TOKENS`), der
Client gab den Torso zurueck, `json.loads` scheiterte, und beim Nutzer stand
ein HTTP 502 mit „Die Liste konnte nicht gelesen werden."

Drei Falschaussagen in einer Kette: die Liste WAR lesbar, unser Dienst war
NICHT ausgefallen, und die eigentliche Ursache — unser eigenes Budget — stand
nirgends. Genau diese Klasse Fehler ist ohne Rohdaten im Log nicht
diagnostizierbar; deshalb pruefen diese Tests beides, den Wurf UND das Log.
"""
from unittest.mock import patch

import pytest

from src.core.ki import KiError
from src.core.ki.client import MAX_ANTWORT_TOKENS, VertexClient


def _antwort(grund: str, text: str = "[{\"name\": \"Sofa\"") -> dict:
    """Eine Vertex-Antwort, wie sie real ankommt — hier abgeschnitten."""
    return {
        "candidates": [
            {"finishReason": grund, "content": {"parts": [{"text": text}]}}
        ],
        "usageMetadata": {"promptTokenCount": 1554, "candidatesTokenCount": 2048},
    }


def test_max_tokens_wirft_statt_torso_zurueckzugeben() -> None:
    """Der Kern des Livefehlers: abgeschnitten ist ein FEHLER, kein Ergebnis."""
    c = VertexClient.__new__(VertexClient)
    c._model = "gemini-2.5-flash"  # noqa: SLF001
    c._location = "europe-west4"  # noqa: SLF001
    with pytest.raises(KiError) as exc:
        c._auswerten(  # noqa: SLF001
            _antwort("MAX_TOKENS"), dauer_ms=9939, grenze=2048,
            abbruch_ist_fehler=True,
        )
    # Die Meldung MUSS die Zahlen nennen — ohne sie ist sie so blind wie der
    # 502, den sie ersetzt.
    assert "2048" in exc.value.message
    # 422, nicht 5xx: nichts ist ausgefallen, das Budget war zu klein.
    assert exc.value.status_code == 422


def test_ohne_schalter_bleibt_das_alte_verhalten() -> None:
    """Die Stapel-Uebersetzer behandeln MAX_TOKENS pro Sprache selbst.

    Wuerde der Client dort werfen, kippte ein einzelner abgeschnittener Satz
    den ganzen Lauf ueber 24 Sprachen — deshalb ist der Wurf schaltbar und
    standardmaessig AUS.
    """
    c = VertexClient.__new__(VertexClient)
    c._model = "gemini-2.5-flash"  # noqa: SLF001
    c._location = "europe-west4"  # noqa: SLF001
    antwort = c._auswerten(_antwort("MAX_TOKENS"), dauer_ms=1, grenze=2048)  # noqa: SLF001
    assert antwort.abschlussgrund == "MAX_TOKENS"


def test_stop_geht_normal_durch() -> None:
    """Die Gegenprobe: eine vollstaendige Antwort darf nicht ploetzlich werfen."""
    c = VertexClient.__new__(VertexClient)
    c._model = "gemini-2.5-flash"  # noqa: SLF001
    c._location = "europe-west4"  # noqa: SLF001
    antwort = c._auswerten(  # noqa: SLF001
        _antwort("STOP", "[]"), dauer_ms=1, grenze=2048, abbruch_ist_fehler=True,
    )
    assert antwort.text == "[]"


def test_budget_reicht_fuer_eine_inventarliste() -> None:
    """Der Deckel selbst ist der Fehler gewesen.

    2048 Tokens sind fuer eine mehrseitige Inventarliste zu wenig — der
    Import fordert 8000 an. Bleibt der Deckel darunter, kappt er weiterhin
    still, und dieser Test faellt, bevor es ein Kunde merkt.
    """
    assert MAX_ANTWORT_TOKENS >= 8_000


def test_kappen_wird_geloggt() -> None:
    """Wird doch einmal gekappt, MUSS es im Log stehen.

    Ein stilles Kappen ist die Wurzel des ganzen Vorfalls: der Aufrufer denkt,
    er habe sein Budget bekommen.
    """
    c = VertexClient.__new__(VertexClient)
    c._model = "m"  # noqa: SLF001
    c._location = "r"  # noqa: SLF001
    c._projekt = "p"  # noqa: SLF001
    with patch("src.core.ki.client.log") as log_mock:
        with patch.object(
            VertexClient, "_access_token", return_value="t"
        ), patch("src.core.ki.client.httpx.Client") as http:
            http.return_value.__enter__.return_value.post.side_effect = (
                RuntimeError("stopp nach dem Bau der Nutzlast")
            )
            with pytest.raises(Exception):  # noqa: B017,PT011
                c._senden(  # noqa: SLF001
                    system="s", teile=[{"text": "t"}], temperature=0.1,
                    max_tokens=MAX_ANTWORT_TOKENS + 5_000,
                )
    namen = [ruf.args[0] for ruf in log_mock.warning.call_args_list]
    assert "vertex_budget_gekappt" in namen
