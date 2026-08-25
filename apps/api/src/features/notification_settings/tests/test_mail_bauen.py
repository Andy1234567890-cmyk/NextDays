"""Was `_mail_bauen` aus einer Benachrichtigung macht — Link und Absätze.

WARUM DIESE TESTS (25.08.2026): Gemeldet wurde „diese Mails haben keinen Link".
Der `ziel_pfad` stand in jeder Zeile der Datenbank; der Button entstand
trotzdem nicht, weil `APP_BASE_URL` in dem Prozess fehlte, der die Mail
verschickte — und der Wegfall passierte STILL. Ein Mangel, den niemand
bemerkt, ist die eigentliche Wurzel: der fehlende Link ist nur seine
sichtbarste Folge.

Der zweite Test hält die Absatzstruktur. Der Rumpf darf aus mehreren
Katalogschlüsseln stammen; sie kommen mit `\\n\\n` getrennt an. Als EIN Element
landeten sie in einem einzigen `<p>`, in dem der Umbruch zu einem Leerzeichen
zusammenfällt — die Mail sah aus wie ein Satz ohne Struktur.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.features.notification_settings import dispatcher as disp


@pytest.fixture(name="mit_basis")
def _mit_basis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        disp, "get_settings",
        lambda: SimpleNamespace(app_base_url="https://app.mynextdays.com"),
    )


@pytest.fixture(name="ohne_basis")
def _ohne_basis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(disp, "get_settings", lambda: SimpleNamespace(app_base_url=""))


def test_ziel_pfad_wird_zum_button(mit_basis: None) -> None:  # noqa: ARG001
    mail = disp.NotificationDispatcher._mail_bauen(  # noqa: SLF001
        "Neue Buchung: Haus A", "Anna · Airbnb", "/reservierungen/r-1", "de",
    )
    assert "https://app.mynextdays.com/reservierungen/r-1" in mail.html
    # Die Textfassung trägt dieselbe Aussage — sie ist kein Notnagel.
    assert "https://app.mynextdays.com/reservierungen/r-1" in mail.text


def test_fehlende_basis_wird_laut_gemeldet(
    ohne_basis: None,  # noqa: ARG001
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Wurzel 5: kein stiller Wegfall. Ohne diese Zeile gingen wochenlang
    Buchungsmeldungen ohne Link hinaus, ohne dass irgendetwas es meldete.

    Gegen `capsys` statt `caplog` geprüft: structlog schreibt am
    logging-Modul vorbei auf die Standardausgabe.
    """
    mail = disp.NotificationDispatcher._mail_bauen(  # noqa: SLF001
        "Neue Buchung: Haus A", "Anna · Airbnb", "/reservierungen/r-1", "de",
    )
    assert "mail_ohne_link_app_base_url_fehlt" in capsys.readouterr().out
    # Und die Mail geht trotzdem raus — sie ist Pflichtinformation, ein
    # Konfigurationsmangel darf sie nicht ganz verschlucken.
    assert "Neue Buchung: Haus A" in mail.html


def test_ohne_ziel_pfad_keine_meldung(
    ohne_basis: None,  # noqa: ARG001
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Eine Meldung ohne Ziel ist kein Mangel — sie hat schlicht keinen Ort."""
    disp.NotificationDispatcher._mail_bauen(  # noqa: SLF001
        "Hinweis", "Text", None, "de",
    )
    assert "app_base_url" not in capsys.readouterr().out


def test_mehrere_absaetze_bleiben_getrennt(mit_basis: None) -> None:  # noqa: ARG001
    mail = disp.NotificationDispatcher._mail_bauen(  # noqa: SLF001
        "Neue Buchung: Haus A",
        "Anna · Airbnb\n\nAnreise: 2027-05-20 · Abreise: 2027-05-22",
        "/reservierungen/r-1",
        "de",
    )
    # Zwei eigene Absätze, nicht ein Klumpen.
    assert mail.html.count("Anna · Airbnb</p>") == 1
    assert "<p" in mail.html.split("Anna · Airbnb</p>")[1].split("Anreise")[0]
