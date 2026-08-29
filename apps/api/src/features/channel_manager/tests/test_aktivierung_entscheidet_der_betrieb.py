"""Aktivieren entscheidet der Betrieb — nie der Verbinde-Fluss.

VORGABE des Betreibers (29.08.2026, woertlich):

    „Objekt anlegen -> Handshake -> Inserate holen -> Objekt aktuallsesieren
     -> inaktive lassen das hat der user zu entscheiden nicht wir"

WARUM DAS KEINE KOSMETIK IST: Die Aktivierung ist die Stelle, an der GELD zu
fliessen beginnt. Channex rechnet nach AKTIVEN Kanalverbindungen ab, nicht nach
angelegten Objekten:

    „Only properties with at least one active channel connection are billed."
    „Properties that are set up but have no active connection are not billed."
    (channex.io/pricing, gelesen 29.08.2026)

Wer im Verbinde-Fluss automatisch aktiviert, entscheidet ungefragt ueber die
Rechnung des Kunden — und schaltet das Objekt gleichzeitig bei den Portalen
sichtbar, ohne dass jemand „verkaufen" gesagt hat.

VORHER aktivierten ZWEI Stellen ungefragt:

    channels.connect_channel        Schritt 4 „Aktivieren (Kanaele starten
                                    inaktiv)" — direkt nach POST /channels
    oauth_channels.finalize_...     nach dem Zuordnen der Airbnb-Inserate,
                                    und meldete „verbunden und aktiviert"

JETZT bleibt der Kanal in beiden Faellen inaktiv. Aktiviert wird ausschliesslich
ueber `channels.activate_channel` (eigener Endpunkt, eigener Knopf in
`channel-detail.tsx`).
"""
from __future__ import annotations

import inspect

from src.features.channel_manager import channels, oauth_channels


def _quelle(funktion: object) -> str:
    return inspect.getsource(funktion)  # type: ignore[arg-type]


def _ruft_channex_activate(funktion: object) -> bool:
    """Sucht den ECHTEN Aufruf, nicht das Wort.

    `activate_channel` kommt in diesen Funktionen auch in Kommentaren vor (sie
    verweisen darauf, WO stattdessen aktiviert wird). Ein Test, der bloss nach
    dem Namen greppt, schlaegt daran fehl und zwingt dazu, die Erklaerung aus
    dem Code zu entfernen — genau die, die den naechsten Leser aufhaelt.
    """
    for zeile in _quelle(funktion).splitlines():
        ohne_kommentar = zeile.split("#", 1)[0]
        if "self._channex.activate_channel(" in ohne_kommentar:
            return True
    return False


def test_connect_channel_aktiviert_nicht() -> None:
    """Der credential-Connect schaltet den Kanal nicht selbst live."""
    assert not _ruft_channex_activate(channels.ChannelsMixin.connect_channel), (
        "connect_channel aktiviert wieder selbst — die Aktivierung ist eine "
        "Entscheidung des Betriebs (und der Beginn der Abrechnung)."
    )


def test_finalize_aktiviert_nicht() -> None:
    """Das Zuordnen der Airbnb-Inserate schaltet den Kanal nicht live."""
    assert not _ruft_channex_activate(
        oauth_channels.OAuthChannelsMixin.finalize_oauth_channel
    ), (
        "finalize_oauth_channel aktiviert wieder selbst — Zuordnen und "
        "Aktivieren sind zwei Entscheidungen, hier faellt nur die erste."
    )


def test_finalize_setzt_is_active_nicht_auf_true() -> None:
    """Zugeordnet ≠ aktiv: die Verbindung bleibt auf `is_active: False`."""
    quelle = "\n".join(
        z.split("#", 1)[0]
        for z in _quelle(
            oauth_channels.OAuthChannelsMixin.finalize_oauth_channel
        ).splitlines()
    )
    assert '"is_active": True' not in quelle, (
        "finalize_oauth_channel meldet die Verbindung wieder als aktiv, "
        "obwohl bei Channex kein activate gelaufen ist — das waere eine "
        "Falschaussage in der Oberflaeche (Wurzel 5b)."
    )
    assert '"is_active": False' in quelle, (
        "finalize_oauth_channel muss `is_active` ausdruecklich auf False "
        "setzen, damit ein frueher aktiver Kanal nicht aktiv bleibt."
    )


def test_finalize_scheitert_nicht_mehr_an_offener_readiness() -> None:
    """Ein offener Readiness-Punkt verhindert das ZUORDNEN nicht mehr.

    Er verhindert nur das Aktivieren — und das passiert hier nicht mehr.
    Geprueft wird er weiterhin, damit die Oberflaeche den Grund nennen kann.
    """
    quelle = _quelle(oauth_channels.OAuthChannelsMixin.finalize_oauth_channel)
    assert "_readiness_offen" in quelle, (
        "Der Readiness-Zustand wird nicht mehr ermittelt — dann kann die "
        "Oberflaeche nicht sagen, was der Aktivierung im Weg steht."
    )
    assert "kann noch nicht aktiviert werden" not in quelle, (
        "finalize wirft wieder 422 wegen offener Readiness — das gehoert an "
        "den Aktivieren-Klick, nicht an das Zuordnen."
    )


def test_activate_channel_bleibt_der_weg_des_betriebs() -> None:
    """Der ausdrueckliche Weg existiert weiterhin und aktiviert wirklich."""
    assert _ruft_channex_activate(channels.ChannelsMixin.activate_channel), (
        "Der Aktivieren-Endpunkt aktiviert nicht mehr — dann kann der Betrieb "
        "gar nicht mehr verkaufen."
    )
    assert "kann noch nicht aktiviert werden" in _quelle(
        channels.ChannelsMixin.activate_channel
    ), (
        "Der Aktivieren-Endpunkt nennt den offenen Readiness-Punkt nicht mehr "
        "— dann bleibt der Kanal still auf Disabled (live passiert 04.08.2026)."
    )
