"""Lesebestätigung: welcher Eintrag zählt und was er bedeutet (0297).

Airbnbs `thread.last_message_reads` ist die einzige Quelle dafür (Channex führt
gar keinen Lesestand). Zwei Dinge daran sind leicht falsch zu verstehen, und
beide würden dem Betrieb eine falsche Auskunft geben:

  * Es ist ein LESESTAND je Teilnehmer, keine Liste gelesener Nachrichten.
  * Es steht auch der HOST darin — unser eigener Lesestand.
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_lesestand import gast_lesestand

# Live gemessener Thread (2606823815), gekürzt auf das Wesentliche.
_THREAD = {
    "users": [
        {"id": "6776750", "role": "GUEST", "first_name": "Nicolette"},
        {"id": "529591717", "role": "HOST", "first_name": "Jeanine"},
    ],
    "last_message_reads": [
        {"message_id": "32102299418", "user_id": "529591717",
         "created_at": "2026-08-06T08:09:03Z"},
        {"message_id": "32102535131", "user_id": "6776750",
         "created_at": "2026-08-06T08:13:03Z"},
    ],
}


def test_der_gast_zaehlt_nicht_der_host() -> None:
    """Der HOST-Eintrag ist unser eigener Lesestand.

    Würde er genommen, erschiene das Häkchen, sobald der Betrieb den Thread
    selbst geöffnet hat — eine Bestätigung, die nichts bestätigt. Im Beispiel
    stünde dann 08:09:03 statt 08:13:03.
    """
    ref, gelesen = gast_lesestand(_THREAD)
    assert ref == "32102535131"
    assert gelesen == "2026-08-06T08:13:03Z"


def test_reihenfolge_entscheidet_nicht() -> None:
    """`last_message_reads` ist unsortiert — die Rolle entscheidet, nicht Index 0."""
    gedreht = {
        **_THREAD,
        "last_message_reads": list(reversed(_THREAD["last_message_reads"])),
    }
    assert gast_lesestand(gedreht)[0] == "32102535131"


def test_ohne_gast_eintrag_kein_lesestand() -> None:
    """Der Gast hat noch nicht gelesen → (None, None), kein Häkchen.

    Nicht mit „ungelesen" verwechseln: die Oberfläche zeigt dann gar nichts,
    statt eine Aussage zu treffen, die die Daten nicht hergeben (Wurzel 4).
    """
    nur_host = {
        **_THREAD,
        "last_message_reads": [_THREAD["last_message_reads"][0]],
    }
    assert gast_lesestand(nur_host) == (None, None)


def test_kanal_ohne_lesestand() -> None:
    """Channex/Booking.com liefern das Feld gar nicht — sauber None."""
    assert gast_lesestand({}) == (None, None)
    assert gast_lesestand({"users": [], "last_message_reads": []}) == (None, None)


def test_fremde_rolle_gilt_nicht_als_gast() -> None:
    """Nur `GUEST` ist der Gast — kein Rateversuch über „ist nicht HOST"."""
    seltsam = {
        "users": [{"id": "1", "role": "COHOST"}],
        "last_message_reads": [
            {"message_id": "m1", "user_id": "1", "created_at": "2026-08-06T08:00:00Z"}
        ],
    }
    assert gast_lesestand(seltsam) == (None, None)
