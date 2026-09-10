"""Objekt-Zuordnung beim CSV-Import (`_objektregister`).

WARUM DAS EIN EIGENER TEST IST: eine falsche Zuordnung sperrt echte Naechte
am falschen Objekt und verschiebt Umsatz auf den falschen Eigentuemer — ein
Fehler, den niemand sieht, weil die Buchung ja importiert wurde. Die Register
standen bis zum 10.09.2026 als 73-Zeilen-Block mitten in einer
256-Zeilen-Funktion und waren nirgends einzeln pruefbar.

Der Portal-Export enthaelt KEINE Objektkennung (gemessen am echten
Booking.com-Export vom 31.08.2026: zwoelf Spalten, darunter „Lage", aber
keine Unterkunfts-ID). Deshalb die fuenf Stufen.
"""
from __future__ import annotations

from src.features.channel_manager.csv_import import _objektregister


def _prop(pid: str, titel: str, strasse: str = "", nr: str = "", ort: str = "") -> dict:
    return {
        "id": pid,
        "title": titel,
        "street": strasse,
        "house_number": nr,
        "city": ort,
    }


def test_normalisierter_titel_trifft_trotz_zierzeichen() -> None:
    """Live am 31.08.2026: 111 von 252 Zeilen fielen allein daran durch.

    Der Export gibt denselben Namen ohne Zierzeichen aus — dasselbe Objekt,
    nur ohne die Anfuehrungszeichen bzw. Sternchen aus dem Titel.
    """
    r = _objektregister([
        _prop("p-1", 'Feriehus "Perlen" Tversted'),
        _prop("p-2", "FeWo *Stjerneskud*"),
    ])
    assert r.by_normal.get("feriehus perlen tversted") == "p-1"
    assert r.by_normal.get("fewo stjerneskud") == "p-2"


def test_normalisierung_raet_NICHT_per_aehnlichkeit() -> None:
    """Nur Zeichensetzung wird normalisiert, nie der Wortlaut (Wurzel 4).

    „Odden-hus-mygdal" bleibt verschieden von „Odden-hygge-mygdal", und
    „Holiday home Dora" trifft nicht auf „Feriehus Dora". Solche Zeilen
    MUESSEN scheitern — sie loesen ueber die Adresse auf.
    """
    r = _objektregister([_prop("p-1", "Odden-hygge-mygdal")])
    assert r.by_normal.get("odden hus mygdal") is None
    r = _objektregister([_prop("p-1", "Feriehus Dora")])
    assert r.by_normal.get("holiday home dora") is None


def test_mehrdeutige_schluessel_werden_verworfen_nicht_geraten() -> None:
    """Zwei Objekte, ein Schluessel: keines gewinnt.

    Sonst entschiede die Ladereihenfolge — am Hoejenevej 2A liegen zwei
    Objekte, dort MUSS der Name entscheiden.
    """
    r = _objektregister([
        _prop("p-1", 'Haus "A"', "Hoejenevej", "2A", "Skagen"),
        _prop("p-2", "Haus A", "Hoejenevej", "2A", "Skagen"),
    ])
    # Gleiche Normalform -> verworfen, nicht zufaellig aufgeloest.
    assert "haus a" not in r.by_normal
    # Gleiche Adresse -> ebenso.
    assert not any(v in ("p-1", "p-2") for v in r.by_adresse.values())


def test_adresse_trennt_nachbarhaeuser_ueber_die_hausnummer() -> None:
    """Iver Christensens Vej 11 vs. 13 sind zwei verschiedene Objekte."""
    r = _objektregister([
        _prop("p-11", "Haus elf", "Iver Christensens Vej", "11", "Hirtshals"),
        _prop("p-13", "Haus dreizehn", "Iver Christensens Vej", "13", "Hirtshals"),
    ])
    assert len(set(r.by_adresse.values())) == 2, "die Hausnummer trennt sie"
    # OHNE Hausnummer ist die Strasse mehrdeutig -> verworfen.
    assert not r.by_strasse


def test_objekt_ohne_strasse_haengt_nicht_am_blossen_ort() -> None:
    """Sonst traefe der Ortsname jedes Objekt desselben Ortes."""
    r = _objektregister([
        _prop("p-1", "Ohne Adresse", "", "", "Skagen"),
        _prop("p-2", "Auch ohne", "", "", "Skagen"),
    ])
    assert not r.by_adresse
    assert not r.by_strasse


def test_id_und_exakter_titel_bleiben_die_erste_wahl() -> None:
    """Absteigend nach Verlaesslichkeit: ID, dann exakter Titel."""
    r = _objektregister([_prop("p-1", "Villa Nord", "Strandvej", "7", "Skagen")])
    assert r.by_id["p-1"] == "p-1"
    assert r.by_title["villa nord"] == "p-1"
