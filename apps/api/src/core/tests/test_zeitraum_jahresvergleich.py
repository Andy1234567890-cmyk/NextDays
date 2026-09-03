"""Der datumsgleiche Jahressprung — Grundlage jedes Vorjahresvergleichs.

Er liegt in `core`, weil ZWEI Slices ihn brauchen (`auswertung` für die
Vorjahresspalten aller Reiter, `reservations.property_stats` für den Anker der
Kacheln). Driftet er, nennt die eine Seite den 28.02. und die andere den 01.03.
als Vorwert desselben Tages — und niemand käme auf die Idee, das zu prüfen.
"""
from datetime import date, timedelta

from src.core.zeitraum import jahre_datumsgleich


def test_gleicher_kalendertag():
    assert jahre_datumsgleich(date(2026, 9, 29), 1) == date(2025, 9, 29)
    assert jahre_datumsgleich(date(2026, 9, 29), 2) == date(2024, 9, 29)
    assert jahre_datumsgleich(date(2026, 9, 29), 5) == date(2021, 9, 29)


def test_schalttag_bleibt_im_februar():
    """29.02. → 28.02., NICHT 01.03.

    Der 01.03. läge im nächsten Monat und damit in einem anderen Balken der
    Zeitreihe — der Vorwert stünde im falschen Monatseimer.
    """
    assert jahre_datumsgleich(date(2024, 2, 29), 1) == date(2023, 2, 28)
    assert jahre_datumsgleich(date(2024, 2, 29), 3) == date(2021, 2, 28)
    # Schalttag auf Schalttag bleibt der 29.
    assert jahre_datumsgleich(date(2024, 2, 29), 4) == date(2020, 2, 29)
    assert jahre_datumsgleich(date(2024, 2, 29), 8) == date(2016, 2, 29)


def test_null_jahre_ist_derselbe_tag():
    assert jahre_datumsgleich(date(2026, 5, 4), 0) == date(2026, 5, 4)


def test_nicht_365_tage():
    """Der Grund, warum es diese Funktion gibt.

    `timedelta(days=365 * jahre)` läuft über die dazwischenliegenden
    Schaltjahre aus dem Datum heraus. Gemessen (03.09.2026):

        2026-09-29 − 5·365 Tage → 2021-09-30   (1 Tag daneben)
        2025-01-15 − 5·365 Tage → 2020-01-17   (2 Tage daneben)

    Wie weit es danebengeht, hängt davon ab, wie viele 29. Februare in der
    Spanne liegen — der Fehler ist also nicht einmal konstant, sondern
    verschiebt sich je nach gewähltem Zeitraum. Ein Bericht, dessen Vorjahr
    mal einen und mal zwei Tage verrutscht, ist nicht prüfbar.
    """
    start = date(2026, 9, 29)
    assert jahre_datumsgleich(start, 5) == date(2021, 9, 29)
    assert start - timedelta(days=365 * 5) == date(2021, 9, 30)

    # Ein anderer Startpunkt, andere Abweichung — genau das Problem.
    anderer = date(2025, 1, 15)
    assert jahre_datumsgleich(anderer, 5) == date(2020, 1, 15)
    assert anderer - timedelta(days=365 * 5) == date(2020, 1, 17)


def test_monatsenden_bleiben_monatsenden():
    """Der 31. eines Monats existiert im Vorjahr im selben Monat immer."""
    assert jahre_datumsgleich(date(2026, 8, 31), 1) == date(2025, 8, 31)
    assert jahre_datumsgleich(date(2026, 12, 31), 2) == date(2024, 12, 31)
