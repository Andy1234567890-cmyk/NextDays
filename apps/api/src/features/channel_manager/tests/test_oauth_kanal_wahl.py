"""Welcher Channex-Kanal beim OAuth verbunden wird (`_kanal_waehlen`).

WARUM DAS EIN EIGENER TEST IST: diese Entscheidung ist zweimal live falsch
gelaufen, und beide Male war der Schaden unsichtbar, weil der erzeugte Link
technisch funktionierte — nur eben zum falschen Konto. Sie stand bis zum
10.09.2026 als vierteilige if/elif-Kette mitten in einer 541-Zeilen-Funktion
und war damit nirgends einzeln pruefbar.

Der teuerste Fall (07.08.2026, Tenant AirSmil): der Rueckfall auf den
autorisierten Kanal traf IMMER Konto A, obwohl der Betrieb Konto B verbinden
wollte. Channex merkt sich je Verbindung nur den zuletzt erzeugten `state` —
der eine richtige Link lebte 29 Sekunden.
"""
from __future__ import annotations

from src.features.channel_manager.oauth_channels import _kanal_waehlen

_A = "9a46827b"
_B = "8e3292d3"
_LEER = "f729554c"


def test_benanntes_konto_schlaegt_alles() -> None:
    """`account_id` ist der Gegenentwurf zum Raten — es gewinnt immer.

    Genau hier lag der Fehlgriff vom 07.08.2026: ohne diesen Vorrang fiel die
    Wahl auf `autorisiert`, also auf Konto A, und der Kunde landete wieder im
    Airbnb-Login von Konto A statt bei Konto B.
    """
    w = _kanal_waehlen(
        kandidaten=[_A, _B],
        autorisiert=_A,
        eigener_kanal=_A,
        konto_kanal=_B,
        account_id="konto-b",
        neues_konto=False,
    )
    assert w.channel_id == _B
    assert w.grund == "konto benannt"
    assert not w.neu_anlegen


def test_neues_konto_verwendet_NICHTS_wieder() -> None:
    """Ein zweites Portal-Konto braucht einen eigenen Kanal.

    Die Wiederverwendung ist richtig, solange es um dasselbe Konto geht — fuer
    ein anderes Konto ist sie die Sperre: `autorisiert` gaebe Konto A zurueck,
    und Konto B waere nie erreichbar.
    """
    w = _kanal_waehlen(
        kandidaten=[_A],
        autorisiert=_A,
        eigener_kanal=_A,
        konto_kanal=None,
        account_id=None,
        neues_konto=True,
    )
    assert w.channel_id is None, "kein Rueckgriff auf den Kanal von Konto A"
    assert w.neu_anlegen
    assert w.grund == "neues konto"


def test_autorisierter_kanal_schlaegt_die_eigene_zeile() -> None:
    """Die Tokens sind die Wahrheit, nicht unsere DB-Zeile.

    Live: 9a46827b hat tokens/host_id 529591717, f729554c ist leer — und das
    Objekt ed885e62 zeigte auf f729554c. Ohne diesen Vorrang lief jeder
    weitere Versuch in genau den leeren Kanal, und der Kunde sah endlos
    „warte auf die Bestaetigung".
    """
    w = _kanal_waehlen(
        kandidaten=[_A, _LEER],
        autorisiert=_A,
        eigener_kanal=_LEER,
        konto_kanal=None,
        account_id=None,
        neues_konto=False,
    )
    assert w.channel_id == _A, "der AUTORISIERTE, nicht der aus der eigenen Zeile"
    assert w.grund == "autorisiert"
    assert not w.ist_eigener


def test_ohne_autorisierung_gilt_die_eigene_zeile_dann_der_erste() -> None:
    """Rangfolge unterhalb der Autorisierung."""
    w = _kanal_waehlen(
        kandidaten=[_A, _LEER],
        autorisiert=None,
        eigener_kanal=_LEER,
        konto_kanal=None,
        account_id=None,
        neues_konto=False,
    )
    assert (w.channel_id, w.grund) == (_LEER, "eigene zeile")
    assert w.ist_eigener

    w = _kanal_waehlen(
        kandidaten=[_A, _LEER],
        autorisiert=None,
        eigener_kanal=None,
        konto_kanal=None,
        account_id=None,
        neues_konto=False,
    )
    assert (w.channel_id, w.grund) == (_A, "erster im betrieb")


def test_gar_kein_kanal_heisst_neu_anlegen() -> None:
    """Der Erstverbindungsfall — kein geratener Kanal (Wurzel 4)."""
    w = _kanal_waehlen(
        kandidaten=[],
        autorisiert=None,
        eigener_kanal=None,
        konto_kanal=None,
        account_id=None,
        neues_konto=False,
    )
    assert w.channel_id is None
    assert w.neu_anlegen
    assert w.grund == "keiner - neu anlegen"


def test_benanntes_konto_ohne_kanal_legt_neu_an() -> None:
    """Konto benannt, aber noch kein Kanal dafuer: anlegen, nicht ausweichen.

    Auf einen fremden Kanal auszuweichen waere derselbe Fehler wie 2026-08-07,
    nur mit expliziter Konto-Angabe — also noch weniger entschuldbar.
    """
    w = _kanal_waehlen(
        kandidaten=[_A],
        autorisiert=_A,
        eigener_kanal=_A,
        konto_kanal=None,
        account_id="konto-neu",
        neues_konto=False,
    )
    assert w.channel_id is None, "nicht auf Konto A ausweichen"
    assert w.neu_anlegen
