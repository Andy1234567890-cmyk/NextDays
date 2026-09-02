"""Die Rechenkette gegen eine ECHTE Abrechnungszeile des Betriebs.

Die Zahlen hier sind keine erfundenen Beispiele: sie stammen aus der Abrechnung,
die der Betrieb für 021 Stjerneskud (Booking, 21.–29.08.2026) selbst erstellt
hat. Genau diese Zeile deckte drei Fehler auf, die zusammen 200 DKK je Buchung
verschoben — und alle drei sahen plausibel aus:

* die Portal-Abzugssätze waren zwischen Airbnb und Booking VERTAUSCHT
  (booking 15,5 statt 15,0 + 1,5),
* die Verwaltungsprovision rechnete auf dem Betrag VOR Abzug der Reinigung
  (16,49 % statt der vereinbarten 20 %),
* die Objekt-Stammdaten wurden unbesehen auf jede Buchung gelegt, auch die
  Zusatzleistungen, die der Gast nie gebucht hat.

Ein Test, der die Kette nur gegen sich selbst prüft, hätte keinen davon
gefunden. Darum steht hier die Zeile des Betriebs, Posten für Posten.
"""
from decimal import Decimal as D

import pytest

from src.features.owner_statements.common import (
    Gebuehr,
    Vertragsregeln,
    auszahlung_berechnen,
    portal_abzug,
)

# --- Die Zeile des Betriebs --------------------------------------------------
# 021 Stjerneskud · Booking · 8 Nächte · 21.08.–29.08.2026
#
#   Gast zahlt                        5.420,81
#   Booking-Kommission 15,0 %          −813,12
#   Booking Zahlungsgebühr 1,5 %        −81,31
#   Booking gesamt                      894,43
#   Ausbezahlt AirSmil                4.526,38
#   Reinigung                           795,00
#   Kaffee&Co Gebühr von Eigentümer      50,00
#   AirSmil 20 %                        746,28
#   NK-Pauschale an Eigentümer          200,00
#   Auszahlung Eigentümer             3.135,10
UEBERNACHTUNG = D("4625.81")  # Booking-Feed: 623,70 + 7 × 571,73
REINIGUNG = D("795.00")
BRUTTO = D("5420.81")
KOMMISSION = D("813.12")
ZAHLUNGSGEBUEHR = D("81.31")
NACH_PORTAL = D("4526.38")
BEMESSUNG = D("3731.38")  # NACH_PORTAL − REINIGUNG
VERWALTUNG = D("746.28")  # genau 20,00 % von BEMESSUNG
NAECHTE = 8


def _reinigung() -> list[Gebuehr]:
    """Die Reinigung gehört dem Betrieb und ist provisionsFREI.

    Beide Achsen sind nötig: provisionsfrei nimmt sie aus der Bemessung
    (sonst zahlte der Eigentümer 20 % auf einen Betrag, der ihm nicht zusteht),
    „betrieb" verhindert, dass sie danach an ihn zurückfließt.
    """
    return [
        Gebuehr(
            art="cleaning_fee",
            betrag=REINIGUNG,
            gehoert_zu="betrieb",
            provisionspflichtig=False,
        )
    ]


def _abzug() -> object:
    return portal_abzug(
        brutto=BRUTTO,
        gemeldete_provision=None,  # Booking meldet sie nur bei ota-collect
        provision_pct=D("15.0"),
        zahlungsgebuehr_pct=D("1.5"),
        zieht_portal_ein=True,
    )


def test_portal_abzug_trifft_die_zeile_des_betriebs() -> None:
    """15,0 % + 1,5 % — dreifach belegt, nicht angenommen.

    (1) Extranet-Export 2024-01-01..2026-08-11: 199 Ok-Buchungen ergeben
        Kommission/Gesamtbetrag = 16,50 % über alle 18 Objekte;
    (2) Booking-Notes zu BDC-5012668004: „OTA Commission: 195.00" (15,0 % von
        1.300) PLUS „Payment charge is DKK 19.5" (1,5 %) = 214,50 = 16,50 %;
    (3) Storno 6302214917: die Provision entfiel, 1,5 % blieben stehen.
    Die 16,5 % des Exports sind also die SUMME beider Posten — wer sie als
    Provision allein hinterlegt, zieht 1,5 % zu viel ab.
    """
    abzug = _abzug()
    assert abzug.provision.quantize(D("0.01")) == KOMMISSION
    assert abzug.zahlungsgebuehr.quantize(D("0.01")) == ZAHLUNGSGEBUEHR
    assert abzug.gesamt.quantize(D("0.01")) == D("894.43")


def test_verwaltungsprovision_rechnet_nach_abzug_der_reinigung() -> None:
    """20 % auf 3.731,38 — nicht auf 4.526,38.

    Auf den Betrag VOR der Reinigung ergäben dieselben 746,28 einen Satz von
    16,49 %: eine Zahl, die in keinem Vertrag steht und die niemand
    nachvollziehen kann. Der Unterschied ist bei dieser Buchung 159,00 DKK.
    """
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert a.brutto.quantize(D("0.01")) == BRUTTO
    assert a.auszahlungsbasis.quantize(D("0.01")) == NACH_PORTAL
    assert a.bemessungsgrundlage.quantize(D("0.01")) == BEMESSUNG
    assert a.verwaltungsprovision.quantize(D("0.01")) == VERWALTUNG
    # Ohne die beiden Pauschalen des Vertrags.
    assert a.netto.quantize(D("0.01")) == D("2985.10")


def test_die_ganze_zeile_des_betriebs_geht_auf() -> None:
    """Beide Pauschalen zusammen ergeben die 3.135,10 des Betriebs.

    Kaffee&Co (−50) und NK-Pauschale (+200) werden hier von Hand ergänzt: sie
    sind noch nicht als Posten hinterlegt. Der richtige Ort dafür ist
    ``owner_recurring_items`` (mehrere benannte Posten je Eigentümer, mit
    ``label``/``modus``/``betrag``) — nicht der Vertrag, der genau EINE
    Pauschale trägt und die entgegengesetzten Richtungen dieser Zeile deshalb
    nicht abbilden kann.

    Bis dahin ist dieser Test der Nachweis, dass die Kette selbst bis zum
    letzten Cent dieselbe Zahl liefert wie die Abrechnung des Betriebs.
    """
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    ergebnis = a.netto + D("200.00") - D("50.00")
    assert ergebnis.quantize(D("0.01")) == D("3135.10")


@pytest.mark.parametrize(
    ("pets", "erwartete_arten"),
    [
        (2, {"cleaning_fee", "pet_fee"}),
        (0, {"cleaning_fee"}),
        (None, {"cleaning_fee"}),
    ],
)
def test_haustiergebuehr_nur_mit_tier(
    pets: int | None, erwartete_arten: set[str]
) -> None:
    """Zusatzleistungen aus den Stammdaten brauchen den Anlass der Buchung.

    Live gemessen: 73 Buchungen trugen ``pet_fee``, aber nur 18 hatten ein Tier
    gemeldet — 8.250 DKK, die kein Gast gezahlt hat. Die Reinigung fällt
    dagegen immer an und bleibt.
    """
    from src.features.owner_statements.gebuehren_quelle import objekt_gebuehren

    attrs = {
        "pricing": {
            "fees": [
                {
                    "feeType": "cleaning_fee",
                    "mode": "amount",
                    "amount": 795,
                    "basis": "per_stay",
                },
                {
                    "feeType": "pet_fee",
                    "mode": "amount",
                    "amount": 150,
                    "basis": "per_stay",
                },
            ]
        }
    }
    posten = objekt_gebuehren(attrs, NAECHTE, anlass={"pets": pets})
    assert {art for art, _ in posten} == erwartete_arten


@pytest.mark.parametrize(
    ("check_in", "erwartete_arten"),
    [
        ("2026-07-31", {"cleaning_fee"}),
        ("2026-08-01", {"cleaning_fee", "resort"}),
        (None, {"cleaning_fee"}),
    ],
)
def test_stammdaten_gebuehr_gilt_erst_ab_anreise(
    check_in: str | None, erwartete_arten: set[str]
) -> None:
    """Die Resort-Gebühr des Beta-Betriebs gibt es erst seit dem 01.08.2026.
    Ohne Zeitraum trug die Abrechnung sie in 98 Buchungen davor nach (gemessen
    02.09.2026). Maß ist die ANREISE; ohne Anreise ist eine begrenzte Gebühr
    nicht beurteilbar und wird nicht angesetzt."""
    from src.features.owner_statements.gebuehren_quelle import objekt_gebuehren

    attrs = {
        "pricing": {
            "fees": [
                {"feeType": "cleaning_fee", "mode": "amount", "amount": 795,
                 "basis": "per_stay"},
                {"feeType": "resort", "mode": "amount", "amount": 25,
                 "basis": "per_night", "validFrom": "2026-08-01",
                 "ownerStatementOnly": True},
            ]
        }
    }
    posten = objekt_gebuehren(attrs, NAECHTE, anlass={"check_in": check_in})
    assert {art for art, _ in posten} == erwartete_arten


# --- Die Vertragspauschale muss in der Zeile ANKOMMEN ------------------------
# Gemeldet am 20.08.2026 von der Betreiberin, wörtlich: „Ich verstehe zum
# Beispiel nicht, warum ich für jede Buchung die 50kr mühsam nochmal anlegen
# muss, wenn ich im Vertrag bereits feste Kosten pro Buchung 50kr angegeben
# habe."
#
# Die Kette rechnete die Pauschale korrekt — `_rental_rows` übernahm von den
# elf Feldern der `Auszahlung` aber nur `netto` und `brutto` und verwarf die
# übrigen neun. Der Eigentümer sah eine Zahl ohne Herkunft, die Betreiberin
# fand „ihre" 50 kr nicht und legte sie als Ausgabe NOCH EINMAL an: zwei Posten
# „Indflytning-gebyr" à 50 DKK auf Feriehus „Perlen" (12.07./27.07.2026,
# `direction=from_owner`, live gefunden) — 100 DKK doppelt zulasten der
# Eigentümerin.
#
# Deshalb prüft dieser Test nicht die Rechnung (die war richtig), sondern dass
# die Pauschale als EIGENER Wert vorliegt und im Netto genau einmal steckt.
PERLEN_VERTRAG = Vertragsregeln(
    provisions_pct=D("20.00"),
    pauschale_betrag=D("50.00"),
    pauschale_currency="DKK",
    pauschale_basis="je_buchung",
    pauschale_zeitpunkt="nach_provision",
)


def test_vertragspauschale_ist_ein_eigener_wert_der_zeile() -> None:
    """Die 50 DKK stehen als `pauschale` da — nicht nur im Endbetrag."""
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=PERLEN_VERTRAG,
        naechte=NAECHTE,
        currency="DKK",
    )
    assert a.pauschale == D("50.00")
    # Und genau EINMAL abgezogen: dieselbe Kette ohne Pauschale liegt um
    # exakt 50 DKK höher. Ein zweiter Abzug (der Handeintrag) wäre hier
    # sichtbar geworden.
    ohne = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert ohne.netto - a.netto == D("50.00")


def test_pauschale_je_nacht_zaehlt_die_naechte_des_aufenthalts() -> None:
    """`je_nacht` × 8 Nächte — die zweite Vertragsform, damit sie nicht
    stillschweigend wie `je_buchung` rechnet."""
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(
            provisions_pct=D("20.00"),
            pauschale_betrag=D("50.00"),
            pauschale_currency="DKK",
            pauschale_basis="je_nacht",
            pauschale_zeitpunkt="nach_provision",
        ),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert a.pauschale == D("400.00")


def test_kette_der_zeile_geht_lueckenlos_auf() -> None:
    """Jedes Zwischenglied ist einzeln belegbar — der Zweck der Felder.

    Ohne diese Probe könnte ein Feld einen plausiblen, aber falschen Wert
    tragen und niemandem auffallen: die Summe stimmte weiter, weil `netto`
    getrennt gerechnet wird.
    """
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=PERLEN_VERTRAG,
        naechte=NAECHTE,
        currency="DKK",
    )
    # Gerundet verglichen: die Kette rechnet mit voller Decimal-Genauigkeit
    # (813,1215 statt 813,12), gerundet wird erst an der Anzeige. Das ist so
    # gewollt — sonst summierten sich Rundungsfehler ueber die Glieder.
    def c(x: D) -> D:
        return x.quantize(D("0.01"))

    assert a.brutto == BRUTTO
    assert c(a.portal_provision) == KOMMISSION
    assert c(a.portal_zahlungsgebuehr) == ZAHLUNGSGEBUEHR
    assert c(a.auszahlungsbasis) == NACH_PORTAL
    assert c(a.bemessungsgrundlage) == BEMESSUNG
    assert c(a.verwaltungsprovision) == VERWALTUNG
    assert a.pauschale == D("50.00")
    # netto = Basis − Verwaltung − Pauschale + Gebühren an den Eigentümer
    erwartet = (
        NACH_PORTAL - VERWALTUNG - D("50.00") - REINIGUNG + a.gebuehren_an_eigentuemer
    )
    assert a.netto.quantize(D("0.01")) == erwartet.quantize(D("0.01"))


# --- Jede Gebühr ein eigener Posten (02.09.2026) -----------------------------
# Ansage des Betriebs, wörtlich: „Jede Gebühr muss als einzelner Posten
# aufgeschlüsselt werden auf der Abrechnung." Die Kette gibt seit diesem Tag
# die Liste heraus, mit der sie gerechnet hat — nicht nur die Summen.


def test_kette_gibt_die_gebuehren_einzeln_heraus() -> None:
    """`a.gebuehren` ist GENAU die übergebene Liste — keine zweite Quelle."""
    gebuehren = _reinigung() + [
        Gebuehr(
            art="resort",
            betrag=D("225.00"),
            gehoert_zu="eigentuemer",
            provisionspflichtig=False,
        )
    ]
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=gebuehren,
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert list(a.gebuehren) == gebuehren
    assert [g.art for g in a.gebuehren] == ["cleaning_fee", "resort"]
    # Kontrollsummen stimmen mit der Liste überein — die Anzeige rechnet nie
    # selbst, ein Test hält beides zusammen.
    assert a.gebuehren_an_eigentuemer == D("225.00")
    assert sum(g.betrag for g in a.gebuehren if g.gehoert_zu == "betrieb") == REINIGUNG


def test_zusatzleistungen_gehoeren_dem_betrieb() -> None:
    """Extras: raus aus der Bemessung, NICHT zurück an den Eigentümer.

    Entscheidung des Betriebs (02.09.2026): der Betrieb erbringt die Leistung
    (Wäsche-Set, Frühstück) und behält den Erlös — wie bei der Reinigung. Bis
    dahin flossen die Extras ungekürzt an den Eigentümer; das verwechselte den
    Erbringer der Leistung mit dem Eigentümer der Immobilie.
    """
    ohne = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    mit = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        addon_total=D("190.00"),
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert mit.extras == D("190.00")
    # NICHT im Gastpreis: der ist der Betrag des Portals (02.09.2026, zweite
    # Korrektur — vorher stand „6.262,50" neben Bookings „5.662,50").
    assert mit.brutto == ohne.brutto
    assert mit.auszahlungsbasis == ohne.auszahlungsbasis
    # Nicht in der Bemessung (keine Provision darauf) …
    assert mit.bemessungsgrundlage == ohne.bemessungsgrundlage
    assert mit.gebuehren_aus_bemessung == ohne.gebuehren_aus_bemessung
    assert mit.verwaltungsprovision == ohne.verwaltungsprovision
    # … und NICHT beim Eigentümer: sein Netto ist unverändert.
    assert mit.netto == ohne.netto
    assert mit.gebuehren_an_eigentuemer == ohne.gebuehren_an_eigentuemer


def test_mindestprovision_wird_als_angewandt_gekennzeichnet() -> None:
    """Greift die Mindestprovision, sagt die Kette es — sonst sähe die Zeile
    „Verwaltungsprovision 20 %" mit einer Zahl, die nicht 20 % ist."""
    regeln = Vertragsregeln(
        provisions_pct=D("20.00"),
        min_provision_betrag=D("900.00"),
        min_provision_currency="DKK",
    )
    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=regeln,
        naechte=NAECHTE,
        currency="DKK",
    )
    assert a.min_provision_angewandt is True
    assert a.verwaltungsprovision == D("900.00")
    # Gegenprobe: liegt der Mindestbetrag UNTER der Provision, greift er nicht.
    b = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(
            provisions_pct=D("20.00"),
            min_provision_betrag=D("10.00"),
            min_provision_currency="DKK",
        ),
        naechte=NAECHTE,
        currency="DKK",
    )
    assert b.min_provision_angewandt is False
    assert b.verwaltungsprovision.quantize(D("0.01")) == VERWALTUNG


def test_die_ganze_zeile_des_betriebs_geht_auf_mit_wiederkehrenden_posten() -> None:
    """Die 3.135,10 des Betriebs OHNE Handkorrektur.

    Löst den Docstring von `test_die_ganze_zeile_des_betriebs_geht_auf` ein:
    „Kaffee&Co −50" und „NK-Pauschale +200" sind wiederkehrende Posten
    (`owner_recurring_items`, je Buchung) und kommen jetzt aus demselben Modul,
    das auch der Bericht nutzt — nicht mehr aus einer von Hand ergänzten Zahl.
    """
    from src.features.owner_statements import wiederkehrend

    a = auszahlung_berechnen(
        uebernachtung=UEBERNACHTUNG,
        gebuehren=_reinigung(),
        gebuehren_im_betrag=False,
        abzug=_abzug(),
        regeln=Vertragsregeln(provisions_pct=D("20.00")),
        naechte=NAECHTE,
        currency="DKK",
    )
    posten = [
        {
            "id": "r-1",
            "label": "Kaffee & Co",
            "abschnitt": "ausgaben",
            "modus": "je_buchung",
            "betrag": 50,
            "currency": "DKK",
            "property_id": None,
        },
        {
            "id": "r-2",
            "label": "NK-Pauschale",
            "abschnitt": "andere",
            "modus": "je_buchung",
            "betrag": 200,
            "currency": "DKK",
            "property_id": None,
        },
    ]
    mengen = wiederkehrend.bezugsmenge([("021", NAECHTE)])
    summe = D("0")
    for zeile, anzahl, wert in wiederkehrend.posten_betraege(posten, mengen, "DKK"):
        assert anzahl == 1
        summe += -wert if wiederkehrend.ist_abzug(str(zeile["abschnitt"])) else wert
    assert (a.netto + summe).quantize(D("0.01")) == D("3135.10")
