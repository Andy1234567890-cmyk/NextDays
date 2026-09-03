"""Die Kanalverteilung der Gast-Statistik — eine Zeile je Kanal.

WARUM (gemeldet 03.09.2026): `ota_name` kommt roh aus der Quelle und ist nicht
normiert. Gruppiert man danach, spaltet jede Schreibvariante denselben Kanal in
zwei Zeilen — im Beta-Betrieb gleich dreimal: „Airbnb"/„AirBNB",
„Booking.com"/„BookingCom" und `None`/„myBestDays". Beide Zeilen tragen dann
dieselbe Beschriftung, weil die Anzeige normalisiert und die Gruppierung nicht.
"""
from src.features.public_portal.statistik import _kanal_verteilung


def _anreise(channel, ota_name, check_in="2026-07-01", check_out="2026-07-03"):
    return {
        "channel": channel,
        "ota_name": ota_name,
        "check_in": check_in,
        "check_out": check_out,
    }


def test_schreibvarianten_ergeben_eine_zeile():
    zeilen = _kanal_verteilung([
        _anreise("booking", "Booking.com"),
        _anreise("booking", "Booking.com"),
        _anreise("booking", "BookingCom"),
        _anreise("airbnb", "AirBNB"),
    ])
    nach_kanal = {z.channel: z for z in zeilen}
    assert set(nach_kanal) == {"booking", "airbnb"}
    assert nach_kanal["booking"].reservations == 3
    assert nach_kanal["booking"].nights == 6


def test_haeufigste_schreibweise_beschriftet():
    """Nicht die erstbeste — sonst entschiede die Zeilenreihenfolge den Namen."""
    zeilen = _kanal_verteilung([
        _anreise("booking", "BookingCom"),
        _anreise("booking", "Booking.com"),
        _anreise("booking", "Booking.com"),
    ])
    assert zeilen[0].ota_name == "Booking.com"


def test_kanal_mit_und_ohne_portalnamen_bleibt_eine_zeile():
    """`portal` trägt live 136 × keinen Namen und 1 × „myBestDays".

    Ohne Zusammenfassung ergäbe das zwei Marktplatz-Zeilen, von denen eine
    fast alles trägt und die andere eine einzelne Buchung.
    """
    zeilen = _kanal_verteilung([
        _anreise("portal", None),
        _anreise("portal", None),
        _anreise("portal", "myBestDays"),
    ])
    assert len(zeilen) == 1
    assert zeilen[0].reservations == 3
    assert zeilen[0].ota_name == "myBestDays"


def test_kanal_ganz_ohne_portalnamen_bleibt_ohne():
    """Kein erfundener Name für Direktbuchungen (Wurzel 4)."""
    zeilen = _kanal_verteilung([_anreise("direct", None)])
    assert len(zeilen) == 1
    assert zeilen[0].ota_name is None
