"""Tests für wiederkehrende Posten (Dauervereinbarung, 0365).

Der Anlass ist ein echter Vorfall (20.08.2026): die Betreiberin fand ihre
vertraglich vereinbarten 50 DKK je Buchung in der Abrechnung nicht und legte
sie als Verrechnungsposten NOCH EINMAL an — der Eigentümerin wurden 100 DKK
doppelt abgezogen. Die Regel lag im Bericht, nicht in der Abrechnung.

Geprüft wird deshalb nicht nur, dass die Zahl stimmt, sondern auch, dass die
BEZUGSMENGE mit herauskommt: „50,00 DKK" ist auf einem Beleg nicht prüfbar,
„3 × 50,00 DKK" ist es.
"""
from decimal import Decimal as D

import pytest

from src.features.owner_statements import wiederkehrend
from src.features.owner_statements.wiederkehrend import WiederkehrendFehler


def _posten(**kw: object) -> dict:
    """Eine Zeile aus ``owner_recurring_items`` mit sinnvollen Vorgaben."""
    zeile = {
        "id": "r-1",
        "label": "Kaffee & Co",
        "abschnitt": "ausgaben",
        "modus": "je_buchung",
        "betrag": 50,
        "currency": "DKK",
        "property_id": None,
        "aktiv": True,
    }
    zeile.update(kw)
    return zeile


# Drei Buchungen auf zwei Objekten: 5 + 3 Nächte auf p-1, 9 Nächte auf p-2.
BUCHUNGEN = [("p-1", 5), ("p-1", 3), ("p-2", 9)]


def test_je_buchung_zaehlt_die_buchungen() -> None:
    """3 Buchungen × 50 = 150, und die Anzahl steht im Ergebnis."""
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege([_posten()], mengen, "DKK")
    assert len(out) == 1
    _zeile, anzahl, betrag = out[0]
    assert anzahl == 3
    assert betrag == D("150")


def test_je_nacht_zaehlt_die_naechte() -> None:
    """17 Nächte × 50 — nicht 3 × 50.

    Die Verwechslung von „je Nacht" und „je Buchung" ist der teuerste Fehler
    dieser Klasse: bei achttägigen Aufenthalten liegt das Ergebnis um den
    Faktor 8 daneben und sieht trotzdem wie ein plausibler Betrag aus.
    """
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege(
        [_posten(modus="je_nacht")], mengen, "DKK"
    )
    _zeile, anzahl, betrag = out[0]
    assert anzahl == 17
    assert betrag == D("850")


def test_je_zeitraum_faellt_einmal_an() -> None:
    """Eine Dauervereinbarung hängt nicht an einer Buchung."""
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege(
        [_posten(modus="je_zeitraum", betrag=200)], mengen, "DKK"
    )
    _zeile, anzahl, betrag = out[0]
    assert anzahl == 1
    assert betrag == D("200")


def test_je_zeitraum_auch_ohne_buchungen() -> None:
    """Leerer Zeitraum: der Posten fällt trotzdem an.

    Die Gegenprobe zu ``je_buchung`` — dort wäre das Ergebnis 0 und die Zeile
    fiele heraus.
    """
    mengen = wiederkehrend.bezugsmenge([])
    out = wiederkehrend.posten_betraege(
        [_posten(modus="je_zeitraum", betrag=200)], mengen, "DKK"
    )
    assert out[0][2] == D("200")


def test_objekt_posten_zaehlt_nur_sein_objekt() -> None:
    """Mit ``property_id`` gilt der Posten nur für dieses eine Objekt.

    p-1 hat 2 Buchungen mit 8 Nächten, p-2 eine mit 9. Ohne diesen Filter
    berechnete der Betrieb dem Eigentümer die Pauschale eines fremden Objekts.
    """
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    je_buchung = wiederkehrend.posten_betraege(
        [_posten(property_id="p-1")], mengen, "DKK"
    )
    assert je_buchung[0][1] == 2
    assert je_buchung[0][2] == D("100")
    je_nacht = wiederkehrend.posten_betraege(
        [_posten(property_id="p-1", modus="je_nacht")], mengen, "DKK"
    )
    assert je_nacht[0][1] == 8
    assert je_nacht[0][2] == D("400")


def test_objekt_ohne_buchung_ergibt_keine_zeile() -> None:
    """Betrag 0 → kein Posten. Eine 0,00-Zeile ist kein Sachverhalt."""
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege(
        [_posten(property_id="p-fremd")], mengen, "DKK"
    )
    assert out == []


def test_fremde_waehrung_nennt_den_posten() -> None:
    """422-Grund samt Namen: sonst weiß niemand, welchen Posten er ändern muss.

    NICHT umrechnen: 50 DKK sind 50 DKK, ein stiller Kurs 1,0 wäre plausibel
    aussehender Unsinn (Wurzel 4). Ein Kurs hätte hier auch keinen Stichtag —
    ein wiederkehrender Posten hat kein Datum.
    """
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    with pytest.raises(WiederkehrendFehler) as exc:
        wiederkehrend.posten_betraege(
            [_posten(currency="EUR", label="NK-Pauschale")], mengen, "DKK"
        )
    assert exc.value.label == "NK-Pauschale"
    assert exc.value.grund == "waehrung_posten"
    assert "NK-Pauschale" in exc.value.message
    assert "EUR" in exc.value.message
    assert "DKK" in exc.value.message


def test_waehrung_vergleicht_ohne_gross_klein() -> None:
    """`dkk` und `DKK` sind dieselbe Währung — kein 422 aus Schreibweise."""
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege([_posten(currency="dkk")], mengen, "DKK")
    assert out[0][2] == D("150")


def test_betrag_bleibt_unsigniert_richtung_kommt_vom_abschnitt() -> None:
    """Der Betrag ist positiv; ``ausgaben`` macht daraus den Abzug.

    Zwei Achsen für dieselbe Aussage (Vorzeichen UND Abschnitt) wären derselbe
    Fehler wie ein Minuszeichen in ``owner_expenses.amount`` — es ginge beim
    Eintippen verloren (0344).
    """
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege(
        [_posten(abschnitt="ausgaben"), _posten(abschnitt="andere", id="r-2")],
        mengen,
        "DKK",
    )
    assert all(betrag > 0 for _z, _a, betrag in out)
    assert wiederkehrend.ist_abzug("ausgaben") is True
    for abschnitt in ("andere", "gebuehren", "unterkunftspreis"):
        assert wiederkehrend.ist_abzug(abschnitt) is False


def test_betrag_ueber_str_gewandelt_keine_float_artefakte() -> None:
    """0,1 × 3 muss 0,3 ergeben — nicht 0,30000000000000004.

    Die DB liefert numeric je nach Treiber als float; der Umweg über ``str``
    verhindert das Binärartefakt, das sich sonst über viele Posten summiert.
    """
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    out = wiederkehrend.posten_betraege([_posten(betrag=0.1)], mengen, "DKK")
    assert out[0][2] == D("0.3")


def test_bezugsmenge_trennt_objekte_und_summiert_gesamt() -> None:
    """Die Verdichtung selbst — Grundlage aller Zählungen oben."""
    mengen = wiederkehrend.bezugsmenge(BUCHUNGEN)
    assert mengen.je_objekt == {"p-1": (2, 8), "p-2": (1, 9)}
    assert mengen.gesamt == (3, 17)
