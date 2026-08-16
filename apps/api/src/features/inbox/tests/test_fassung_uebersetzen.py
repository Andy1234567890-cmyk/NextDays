"""Übersetzen einer Sprachfassung — der Platzhalterschutz ist der Kern.

Geprüft wird vor allem das, was live schiefging: Google übersetzt
`{{guest_first_name}}` im Satzkontext mit (gemessen für `it`), und ein
übersetzter Platzhalter löst nie mehr auf. Die Maskierung muss ihn deshalb
unverändert zurückbringen — und wenn nicht, muss die Übersetzung VERWORFEN
werden statt beschädigt beim Gast zu landen.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from src.features.inbox.errors import InboxError
from src.features.inbox.fassung_uebersetzen import (
    demaskieren,
    fassung_uebersetzen,
    maskieren,
)


def test_maskieren_ersetzt_jedes_vorkommen() -> None:
    text = "Hallo {{guest_first_name}}, willkommen im {{property_name}}."
    maskiert, originale = maskieren(text)
    assert "{{" not in maskiert
    assert originale == ["{{guest_first_name}}", "{{property_name}}"]


def test_maskieren_zaehlt_vorkommen_nicht_namen() -> None:
    """Derselbe Platzhalter zweimal → zwei Marken, sonst ist die Prüfung blind."""
    maskiert, originale = maskieren("{{a}} und {{a}}")
    assert len(originale) == 2
    assert demaskieren(maskiert, originale) == "{{a}} und {{a}}"


def test_rundlauf_stellt_original_wieder_her() -> None:
    text = "Liebe(r) {{guest_first_name}}, Anreise ab {{checkin_time}}."
    maskiert, originale = maskieren(text)
    assert demaskieren(maskiert, originale) == text


def test_demaskieren_toleriert_leerzeichen_um_die_marke() -> None:
    """Google fügt bei format=html mitunter Leerzeichen ein (live beobachtet)."""
    _maskiert, originale = maskieren("Hallo {{name}}!")
    assert demaskieren("Hallo [[ 0 ]]!", originale) == "Hallo {{name}}!"


def test_verlorene_marke_wird_verworfen() -> None:
    """Fehlt ein Platzhalter in der Antwort, ist der Text unbrauchbar."""
    _maskiert, originale = maskieren("Hallo {{name}}!")
    with pytest.raises(InboxError) as exc:
        demaskieren("Ciao!", originale)
    assert exc.value.status_code == 502


def test_klammern_im_text_sind_kein_fehler() -> None:
    """Prozent und einfache Klammern im Text sind erlaubt, nur die Marke nicht.

    `%` war der zweite Markenkandidat und fiel durch: Google frisst bei mehreren
    Marken das führende Zeichen (`%3%` → `3%`). Prozentzeichen stehen aber real
    in den Vorlagen („5 % Rabatt") und dürfen keine Übersetzung verwerfen.
    """
    text = "{{property_name}}: 5 % Rabatt, [Hinweis] 100 % Baumwolle"
    maskiert, originale = maskieren(text)
    assert demaskieren(maskiert, originale) == text


def test_uebrige_marke_wird_verworfen() -> None:
    """Google verändert die Ziffer → `%7%` stünde beim Gast."""
    _maskiert, originale = maskieren("Hallo {{name}}!")
    with pytest.raises(InboxError):
        demaskieren("Hallo [[0]] und [[7]]!", originale)


def test_unbekannte_zielsprache_422() -> None:
    with pytest.raises(InboxError) as exc:
        fassung_uebersetzen(body="Hallo", subject=None, ziel="xx")
    assert exc.value.status_code == 422


def test_leere_grundfassung_422() -> None:
    with pytest.raises(InboxError) as exc:
        fassung_uebersetzen(body="   ", subject=None, ziel="en")
    assert exc.value.status_code == 422


def test_zu_langer_text_422() -> None:
    with pytest.raises(InboxError) as exc:
        fassung_uebersetzen(body="x" * 20_001, subject=None, ziel="en")
    assert exc.value.status_code == 422


def test_fehlender_schluessel_503() -> None:
    """Fail-closed: ohne Schlüssel keine Übersetzung, kein Ausgangstext."""
    with patch("src.features.inbox.fassung_uebersetzen.get_settings") as gs:
        gs.return_value.google_translate_api_key.get_secret_value.return_value = ""
        with pytest.raises(InboxError) as exc:
            fassung_uebersetzen(body="Hallo", subject=None, ziel="en")
    assert exc.value.status_code == 503


def test_erfolg_gibt_platzhalter_unveraendert_zurueck() -> None:
    """Der Dienst liefert die Marke zurück → Platzhalter bleibt intakt."""
    def fake(_schluessel, texte, *, quelle, ziel, als_html):  # noqa: ARG001
        return [t.replace("Hallo", "Hello") for t in texte]

    with patch("src.features.inbox.fassung_uebersetzen.get_settings") as gs, patch(
        "src.features.inbox.fassung_uebersetzen._aufrufen", side_effect=fake
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        body, subject = fassung_uebersetzen(
            body="Hallo {{guest_first_name}}", subject=None, ziel="en"
        )
    assert body == "Hello {{guest_first_name}}"
    assert subject is None


def test_uebersetzter_platzhalter_wird_verworfen() -> None:
    """Der reale Fehlerfall: Google übersetzt den Platzhalter mit."""
    def fake(_schluessel, _texte, *, quelle, ziel, als_html):  # noqa: ARG001
        return ["Caro/a {{nome_ospite}}"]

    with patch("src.features.inbox.fassung_uebersetzen.get_settings") as gs, patch(
        "src.features.inbox.fassung_uebersetzen._aufrufen", side_effect=fake
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        with pytest.raises(InboxError) as exc:
            fassung_uebersetzen(
                body="Liebe(r) {{guest_first_name}}", subject=None, ziel="it"
            )
    assert exc.value.status_code == 502


def test_betreff_geht_als_text_raus() -> None:
    """Betreff nie als HTML — sonst käme ein `&` als Entity zurück."""
    formate: list[bool] = []

    def fake(_schluessel, texte, *, quelle, ziel, als_html):  # noqa: ARG001
        formate.append(als_html)
        return list(texte)

    with patch("src.features.inbox.fassung_uebersetzen.get_settings") as gs, patch(
        "src.features.inbox.fassung_uebersetzen._aufrufen", side_effect=fake
    ):
        gs.return_value.google_translate_api_key.get_secret_value.return_value = "k"
        fassung_uebersetzen(body="<p>Hi</p>", subject="Betreff", ziel="en")
    assert formate == [True, False]
