"""Tests für die Gebühren-Quelle: welches Portal was meldet und wo es steckt.

Die Payload-Ausschnitte sind ECHTE Strukturen aus dem Live-Bestand (Beta-Betrieb,
geprüft am 11.08.2026) — nicht erfundene Beispiele. Genau daran hing der Fehler:
Booking.com meldet die Gebühren an anderer Stelle als Airbnb UND rechnet sie
schon in den Gesamtbetrag ein. Ein Test mit selbst erfundener Struktur hätte das
nie gezeigt.

Belegte Bezugswerte (Buchung 6341901680, 9 Nächte):
    Nächtesumme 10.795,00 + Resort 225,00 + Reinigung 1.075,00 = 12.095,00
    = `amount` der Buchung, und 1.814,25 Provision = genau 15,00 % davon.
"""
from decimal import Decimal

import pytest

from src.features.owner_statements.common import (
    Gebuehr,
    PayoutUnbekannt,
    PortalAbzug,
    Vertragsregeln,
    auszahlung_berechnen,
    gastpreis,
)
from src.features.owner_statements.gebuehren_quelle import (
    airbnb_uebernachtung,
    booking_gebuehren,
    gebuehren_der_buchung,
    ota_gebuehren,
)

# Die Zuordnung, wie sie der Betrieb für diese Arten vereinbart hat:
# Reinigung gehört dem Betrieb, Resort (Nebenkosten) dem Eigentümer, beide
# provisionsfrei.
_KLASSIFIKATION = {
    ("cleaning_fee", None): ("betrieb", False),
    ("resort", None): ("eigentuemer", False),
    ("pet_fee", None): ("eigentuemer", True),
}


def _booking_raw(
    posten: list[dict] | None, *, zimmer_ohne_details: bool = False
) -> dict:
    """Ein Booking.com-Payload in der Live-Struktur."""
    meta: dict = {}
    if not zimmer_ohne_details:
        meta = {"price_details": {"guest_view": {"taxes": posten or []}}}
    return {"rooms": [{"days": {"2027-07-20": "1105.00"}, "meta": meta}]}


def _posten(text: str, minor: str, freq: int = 12) -> dict:
    return {
        "code": "14",
        "type": "Inclusive",
        "amount": minor,
        "version": 2,
        "currency_code": "DKK",
        "decimal_places": 2,
        "tax_description": text,
        "charge_frequency": freq,
    }


# ----------------------------------------------------------------------
# Booking.com: Struktur und Minor-Units
# ----------------------------------------------------------------------


def test_booking_liest_minor_units_richtig() -> None:
    """107500 mit decimal_places=2 sind 1.075,00 DKK — nicht 107.500.

    Derselbe Faktor-Fehler wie bei Airbnbs Mikro-Einheiten. Ungerechnet zöge
    diese eine Gebühr jede Auszahlung ins tief Negative.
    """
    posten = booking_gebuehren(
        _booking_raw([_posten("Reinigungsgebühr", "107500")])
    )
    assert posten == [("cleaning_fee", Decimal("1075.00"))]


def test_booking_betrag_ist_schon_fuer_den_aufenthalt_summiert() -> None:
    """Resort erscheint bei 9 Nächten als 225,00 (= 25,00 × 9).

    `charge_frequency: 19` heißt „je Nacht", aber der Betrag ist bereits
    hochgerechnet. Ihn hier noch mit den Nächten zu multiplizieren ergäbe
    2.025,00 — das Neunfache.
    """
    posten = booking_gebuehren(
        _booking_raw([_posten("Resortgebühr", "22500", freq=19)])
    )
    assert posten == [("resort", Decimal("225.00"))]


def test_booking_ohne_aufstellung_ist_none_nicht_leer() -> None:
    """Die 51 Altimporte tragen keine `price_details`.

    `None` heißt „keine Aufstellung, nimm die Stammdaten"; eine leere Liste
    hieße „es fielen keine Gebühren an". Die zwei zu verwechseln ließe entweder
    die Stammdaten-Gebühren verschwinden oder erfände welche.
    """
    assert booking_gebuehren(_booking_raw(None, zimmer_ohne_details=True)) is None
    assert booking_gebuehren({}) is None
    assert booking_gebuehren(None) is None


def test_booking_leere_aufstellung_ist_leer_nicht_none() -> None:
    """Eine vorhandene, aber leere Aufstellung ist die Aussage „keine Gebühren"."""
    assert booking_gebuehren(_booking_raw([])) == []


def test_booking_liest_alle_zimmer_nicht_nur_das_erste() -> None:
    """Eine Mehrzimmer-Buchung trägt je Zimmer eine eigene Aufstellung.

    Nur `rooms[0]` zu lesen verlöre die Gebühren der übrigen — heute unsichtbar,
    weil alle Live-Buchungen ein Zimmer haben, und beim ersten Mehrzimmer-Fall
    ein stiller Geldverlust.
    """
    raw = {
        "rooms": [
            {"meta": {"price_details": {"guest_view": {"taxes": [
                _posten("Reinigungsgebühr", "107500")
            ]}}}},
            {"meta": {"price_details": {"guest_view": {"taxes": [
                _posten("Resortgebühr", "22500", freq=19)
            ]}}}},
        ]
    }
    assert booking_gebuehren(raw) == [
        ("cleaning_fee", Decimal("1075.00")),
        ("resort", Decimal("225.00")),
    ]


def test_booking_unbekannte_gebuehrenart_wirft() -> None:
    """Ein unbekannter Text wird NICHT geraten (Wurzel 4).

    Booking liefert die Art nur als freien, sprachabhängigen Text. Ihn per
    Teilstring zu erraten schlüge den Betrag der falschen Partei zu.
    """
    with pytest.raises(PayoutUnbekannt) as exc:
        booking_gebuehren(_booking_raw([_posten("Frühstückspauschale", "5000")]))
    assert exc.value.grund == "gebuehr_nicht_zugeordnet"
    assert "Frühstückspauschale" in exc.value.message


def test_booking_ohne_decimal_places_wirft() -> None:
    """Ohne `decimal_places` ist die Größenordnung unbestimmt.

    Auf 2 zu defaulten wäre ein geratenes Komma — bei JPY/ISK (0 Stellen) läge
    der Betrag dann um Faktor 100 daneben.
    """
    posten = _posten("Reinigungsgebühr", "107500")
    del posten["decimal_places"]
    with pytest.raises(PayoutUnbekannt) as exc:
        booking_gebuehren(_booking_raw([posten]))
    assert exc.value.grund == "gebuehr_nicht_berechenbar"


def test_booking_erkennt_code_feld_nicht_als_art() -> None:
    """Reinigung und Resort tragen beide `code: "14"` — der Code taugt nicht.

    Die Unterscheidung darf ausschliesslich über `tax_description` laufen.
    """
    posten = booking_gebuehren(
        _booking_raw([
            _posten("Reinigungsgebühr", "107500"),
            _posten("Resortgebühr", "22500", freq=19),
        ])
    )
    assert [a for a, _ in posten] == ["cleaning_fee", "resort"]


# ----------------------------------------------------------------------
# Der Befund: wo stecken die Gebühren?
# ----------------------------------------------------------------------


def test_befund_booking_gebuehren_stecken_im_gesamtpreis() -> None:
    befund = gebuehren_der_buchung(
        raw=_booking_raw([_posten("Reinigungsgebühr", "107500")]),
        type_attributes=None,
        naechte=9,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.im_gesamtpreis is True
    assert befund.quelle == "ota"


def _airbnb_raw(
    *,
    base: str | None = "7010.00",
    extra: str = "0.00",
    posten: list[dict] | None = None,
) -> dict:
    """Ein Airbnb-Payload in der Live-Struktur (Buchung HMTH2N8PPM)."""
    res: dict = {
        "extra_guest_fee": extra,
        "host_fee_base": "1303.55",
        "payout_amount": "7106.45",
        "standard_fees_details": posten
        if posten is not None
        else [
            {"fee_type": "PASS_THROUGH_RESORT_FEE", "amount": "175.00"},
            {"fee_type": "PASS_THROUGH_PET_FEE", "amount": "150.00"},
            {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": "1075.00"},
        ],
    }
    if base is not None:
        res["base_price"] = base
    return {"raw_message": {"reservation": res}}


def test_befund_airbnb_gebuehren_stecken_nicht_im_gesamtpreis() -> None:
    """Airbnbs `total_amount` ist netto (Basis + Gebühren − Provision)."""
    raw = _airbnb_raw(
        posten=[
            {"fee_type": "PASS_THROUGH_CLEANING_FEE", "amount": "1075.00"}
        ]
    )
    befund = gebuehren_der_buchung(
        raw=raw,
        type_attributes=None,
        naechte=2,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.im_gesamtpreis is False
    assert befund.quelle == "ota"
    assert ota_gebuehren(raw) == [("cleaning_fee", Decimal("1075.00"))]


# ----------------------------------------------------------------------
# Airbnb: total_amount ist der Netto-Payout, NICHT die Übernachtung
# ----------------------------------------------------------------------


def test_airbnb_uebernachtung_kommt_aus_base_price() -> None:
    """Live-Buchung HMTH2N8PPM: base_price 7.010,00, payout 7.106,45.

    Der Payout ist GRÖSSER als die Übernachtung (die Gebühren stecken drin) —
    daran ist gut zu sehen, dass die zwei Werte nichts miteinander zu tun haben.
    """
    assert airbnb_uebernachtung(_airbnb_raw()) == Decimal("7010.00")


def test_airbnb_zusatzgast_gehoert_zur_uebernachtung() -> None:
    """`extra_guest_fee` ist ein Aufschlag auf die Unterkunft.

    Er steht NICHT in `standard_fees_details` und ist voll provisionspflichtig.
    Ihn zu übersehen wies eine Buchung mit Zusatzgast still zu niedrig aus.
    """
    assert airbnb_uebernachtung(
        _airbnb_raw(extra="500.00")
    ) == Decimal("7510.00")


def test_airbnb_ohne_base_price_wirft_statt_zu_raten() -> None:
    """Kein stiller Rückfall auf `total_amount` (Wurzel 4).

    Bei Airbnb ist `total_amount` der Netto-Payout — ein Rückfall darauf zöge
    die Portal-Provision ein zweites Mal ab, und zwar unbemerkt.
    """
    with pytest.raises(PayoutUnbekannt) as exc:
        airbnb_uebernachtung(_airbnb_raw(base=None))
    assert exc.value.grund == "betrag"


def test_airbnb_uebernachtung_none_bei_fremdem_payload() -> None:
    """Ohne Airbnb-Struktur gibt es keinen Payload-Wert — dann gilt
    `total_amount`."""
    assert airbnb_uebernachtung(_booking_raw([])) is None
    assert airbnb_uebernachtung(None) is None


def test_befund_airbnb_meldet_uebernachtung_mit() -> None:
    befund = gebuehren_der_buchung(
        raw=_airbnb_raw(),
        type_attributes=None,
        naechte=7,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.uebernachtung == Decimal("7010.00")
    # `basisbetrag` bevorzugt den Payload-Wert vor `total_amount`.
    assert befund.basisbetrag(Decimal("7106.45")) == Decimal("7010.00")


def test_basisbetrag_faellt_auf_total_amount_zurueck() -> None:
    """Booking und Altimporte haben keinen Payload-Übernachtungswert."""
    befund = gebuehren_der_buchung(
        raw=_booking_raw([_posten("Reinigungsgebühr", "107500")]),
        type_attributes=None,
        naechte=9,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.uebernachtung is None
    assert befund.basisbetrag(Decimal("12095.00")) == Decimal("12095.00")


def test_airbnb_kette_ergibt_die_echte_auszahlung() -> None:
    """Die volle Gegenprobe an HMTH2N8PPM, 7 Nächte.

    Aus der Airbnb-Abrechnung des Betriebs (unabhängig vom Payload):
        Basis 7.010,00 + Reinigung 1.075,00 + Haustier 150,00
          + Resort 175,00 = 8.410,00 Brutto
        Host Fee 1.303,55 = genau 15,50 % davon
        8.410,00 − 1.303,55 = 7.106,45 = ausgezahlter Betrag
    """
    befund = gebuehren_der_buchung(
        raw=_airbnb_raw(),
        type_attributes=None,
        naechte=7,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    brutto = gastpreis(
        uebernachtung=befund.basisbetrag(Decimal("7106.45")),
        gebuehren=befund.gebuehren,
        gebuehren_im_betrag=befund.im_gesamtpreis,
    )
    assert brutto == Decimal("8410.00")
    assert brutto * Decimal("0.155") == Decimal("1303.550")
    assert brutto - Decimal("1303.55") == Decimal("7106.45")


def test_airbnb_ohne_korrektur_zoege_provision_doppelt_ab() -> None:
    """Der Beweis, warum es die Korrektur braucht.

    Mit `total_amount` (7.106,45) als Übernachtung ergäbe sich ein Brutto von
    8.506,45 statt 8.410,00 — und der gemeldete Abzug von 1.303,55 entspräche
    dort 15,32 % statt der vereinbarten 15,50 %. Genau diese Streuung (live
    12,34 % bis 17,02 % über 22 Buchungen) war das Symptom.
    """
    gebuehren = [
        Gebuehr("resort", Decimal("175.00"), "eigentuemer", False),
        Gebuehr("pet_fee", Decimal("150.00"), "eigentuemer", True),
        Gebuehr("cleaning_fee", Decimal("1075.00"), "betrieb", False),
    ]
    falsch = gastpreis(
        uebernachtung=Decimal("7106.45"),
        gebuehren=gebuehren,
        gebuehren_im_betrag=False,
    )
    richtig = gastpreis(
        uebernachtung=Decimal("7010.00"),
        gebuehren=gebuehren,
        gebuehren_im_betrag=False,
    )
    assert falsch == Decimal("8506.45")
    assert richtig == Decimal("8410.00")
    # Nur der richtige Bezug ergibt den vereinbarten Satz.
    assert (Decimal("1303.55") / richtig * 100).quantize(
        Decimal("0.01")
    ) == Decimal("15.50")
    assert (Decimal("1303.55") / falsch * 100).quantize(
        Decimal("0.01")
    ) != Decimal("15.50")


_STAMMDATEN_REINIGUNG = {
    "pricing": {
        "fees": [
            {
                "feeType": "cleaning_fee",
                "name": "Reinigungsgebühr",
                "amount": "795.00",
                "basis": "per_stay",
                "mode": "amount",
            },
            {
                "feeType": "resort",
                "name": "Resort",
                "amount": "25.00",
                "basis": "per_night",
                "mode": "amount",
            },
        ]
    }
}


def test_csv_portalbuchung_ohne_zwilling_stammdaten_im_betrag() -> None:
    """Live 02.09.2026: Booking wies 4.475,63 + 795 Reinigung = 5.270,63 aus,
    `total_amount` trug genau das — und die Abrechnung addierte 795 Reinigung
    plus 6 × 25 Resort aus den Stammdaten OBENDRAUF (6.215,63 „Gastpreis").

    Eine CSV-Buchung eines Portals hat keinen Payload, ist aber eine
    Portal-Buchung: ihr Betrag ist der Portal-Gastpreis inklusive Gebühren.
    Entscheidung des Betriebs: die Stammdaten-Gebühren werden nachgetragen,
    ohne Zwilling und ohne Haus-Muster als IM BETRAG enthalten.
    """
    befund = gebuehren_der_buchung(
        raw=None,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "5270.63",
        },
    )
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "im_betrag"
    assert befund.im_gesamtpreis is True
    assert {(g.art, g.betrag) for g in befund.gebuehren} == {
        ("cleaning_fee", Decimal("795.00")),
        ("resort", Decimal("150.00")),
    }


def test_csv_ohne_zwilling_folgt_dem_muster_des_hauses() -> None:
    """Line/Britt: der Booking-Betrag ist die reine Nächtesumme — das gelernte
    Muster „obendrauf" legt die Stammdaten-Gebühren dazu statt herauszurechnen."""
    befund = gebuehren_der_buchung(
        raw=None,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "4475.63",
        },
        csv_muster="obendrauf",
    )
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "obendrauf"
    assert befund.im_gesamtpreis is False
    assert befund.uebernachtung is None  # total_amount IST die Übernachtung


def test_csv_ohne_hinterlegte_gebuehren_bleibt_aufstellung_fehlt() -> None:
    """Nichts hinterlegt → nichts nachzutragen; kein erfundener Posten."""
    befund = gebuehren_der_buchung(
        raw=None,
        type_attributes={"pricing": {"fees": []}},
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "5270.63",
        },
    )
    assert befund.quelle == "ota_ohne_aufstellung"
    assert befund.grund == "csv_import"
    assert befund.gebuehren == []


_CHANNEX_ZWILLING_TIMMANN = {
    # Channex-Import (BDC-5008485743): Tagespreise ohne Gebühren, `meta.is_imported`.
    "ota_name": "BookingCom",
    "meta": {"is_imported": True},
    "rooms": [
        {
            "amount": "4475.63",
            "days": {
                "2026-08-03": "750.75",
                "2026-08-04": "750.75",
                "2026-08-05": "750.75",
                "2026-08-06": "750.75",
                "2026-08-07": "750.75",
                "2026-08-08": "721.88",
            },
            "taxes": [],
        }
    ],
}


def test_csv_gebuehren_aus_channex_naechte_abgeleitet() -> None:
    """Timmann live: CSV 5.270,63 (Booking-Gesamt), Channex-Zwilling 4.475,63
    Nächte. Differenz 795,00 = genau die Reinigung der Stammdaten; Reinigung +
    6 × 25 Resort (945) passt nicht. Booking wies genau „Reinigung 795" aus."""
    befund = gebuehren_der_buchung(
        raw=_CHANNEX_ZWILLING_TIMMANN,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "5270.63",
        },
    )
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "belegt"
    # Die Gebühr STECKT im Betrag: Basis bleibt total_amount, sie wird
    # herausgerechnet (kein eigener Übernachtungswert, sonst zählte die Kette
    # sie beim Gastpreis nicht mit).
    assert befund.uebernachtung is None
    assert befund.im_gesamtpreis is True
    assert [(g.art, g.betrag) for g in befund.gebuehren] == [
        ("cleaning_fee", Decimal("795.00"))
    ]
    # Nächtesumme + Gebühren = CSV-Gesamtpreis, auf den Cent.
    assert Decimal("4475.63") + befund.gebuehren[0].betrag == Decimal("5270.63")


def test_csv_gebuehren_ohne_eindeutige_teilmenge_gelten_als_im_betrag() -> None:
    """Differenz 400 passt zu keiner Teilmenge (795, 150, 945): dann gelten
    ALLE Stammdaten-Gebühren als im Betrag enthalten (Rævlingehuset: Booking
    nimmt 960, hinterlegt 955 — der Rest bleibt in der Übernachtung)."""
    befund = gebuehren_der_buchung(
        raw=_CHANNEX_ZWILLING_TIMMANN,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "4875.63",
        },
    )
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "im_betrag"
    assert befund.im_gesamtpreis is True
    assert {g.art for g in befund.gebuehren} == {"cleaning_fee", "resort"}


def test_csv_gebuehren_differenz_null_heisst_obendrauf() -> None:
    """CSV-Betrag == Nächtesumme (Line, Britt): die Reinigung ist NICHT im
    Preis — sie kommt aus den Stammdaten obendrauf, Übernachtung = Nächte."""
    befund = gebuehren_der_buchung(
        raw=_CHANNEX_ZWILLING_TIMMANN,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:5008485743",
            "channel": "booking",
            "total_amount": "4475.63",
        },
    )
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "obendrauf"
    assert befund.im_gesamtpreis is False
    assert befund.uebernachtung == Decimal("4475.63")
    assert {(g.art, g.betrag) for g in befund.gebuehren} == {
        ("cleaning_fee", Decimal("795.00")),
        ("resort", Decimal("150.00")),
    }


def test_csv_direktbuchung_behaelt_die_stammdaten() -> None:
    """Dieselbe CSV-Vorlage mit `source=Direkt`: kein Portal, die Stammdaten
    sind das, was der Betrieb selbst berechnet hat — sie bleiben."""
    befund = gebuehren_der_buchung(
        raw=None,
        type_attributes=_STAMMDATEN_REINIGUNG,
        naechte=6,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
        reservierung={
            "source_channex_booking_id": "csv:p-1:2026-08-03:2026-08-09:x",
            "channel": "direct",
        },
    )
    assert befund.quelle == "stammdaten"
    assert {(g.art, g.betrag) for g in befund.gebuehren} == {
        ("cleaning_fee", Decimal("795.00")),
        ("resort", Decimal("150.00")),
    }


def test_direktbuchung_nutzt_die_objekt_stammdaten() -> None:
    """OHNE PORTAL gelten die Objekt-Stammdaten — und nur dort.

    Eine Buchung über die eigene Website oder per Telefon hat nie eine
    Portal-Aufstellung; die gepflegten Gebühren sind hier keine Schätzung,
    sondern das, was der Betrieb selbst berechnet hat. Bei PORTAL-Buchungen ohne
    Aufstellung gilt das Gegenteil — siehe
    `test_portalbuchung_ohne_aufstellung_erfindet_nichts`.
    """
    befund = gebuehren_der_buchung(
        raw=None,
        type_attributes={
            "pricing": {
                "fees": [
                    {
                        "feeType": "resort",
                        "name": "Nebenkosten",
                        "amount": "25.00",
                        "basis": "per_night",
                        "mode": "amount",
                    }
                ]
            }
        },
        naechte=9,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.im_gesamtpreis is False
    assert befund.quelle == "stammdaten"
    # Stammdaten sind je Nacht hinterlegt und werden HIER hochgerechnet.
    assert befund.gebuehren[0].betrag == Decimal("225.00")


# ----------------------------------------------------------------------
# rooms[].taxes — die aufgelöste Aufstellung (die bessere Stelle)
# ----------------------------------------------------------------------

# Genau so liefert Channex die Buchung 6341901680 (per GET /bookings/{id} am
# 11.08.2026 geholt): fertige Beträge, Berechnungsart im Klartext, und
# `is_inclusive` als klare Aussage. Die Werte gehen auf den Gesamtbetrag auf:
# 10.795,00 + 225,00 + 1.075,00 = 12.095,00.
_AUFGELOESTE_POSTEN = [
    {
        "is_inclusive": False,
        "name": "Resortgebühr",
        "nights": 9,
        "persons": 2,
        "price_mode": "Per night",
        "price_per_unit": "25.00",
        "total_price": "225.00",
        "type": "Service Charge",
        "version": 2,
    },
    {
        "is_inclusive": False,
        "name": "Reinigungsgebühr",
        "nights": 9,
        "persons": 2,
        "price_mode": "Per booking",
        "price_per_unit": "1075.00",
        "total_price": "1075.00",
        "type": "Service Charge",
        "version": 2,
    },
]


def _aufgeloest_raw(posten: list[dict] | None = None, **extra: object) -> dict:
    """Booking-Payload mit `rooms[].taxes` UND `meta.price_details` daneben."""
    return {
        "ota_name": "BookingCom",
        "rooms": [
            {
                "days": {"2027-07-20": "1105.00"},
                "taxes": _AUFGELOESTE_POSTEN if posten is None else posten,
                "meta": {
                    "price_details": {"guest_view": {"taxes": []}},
                    "charge_periods": {
                        "CLEANINGFEE": [
                            {"excluded": True, "from": "2026-08-04", "to": None}
                        ],
                        "RESORTFEE": [
                            {"excluded": True, "from": "2026-08-04", "to": None}
                        ],
                    },
                },
            }
        ],
        **extra,
    }


def test_aufgeloeste_posten_liefern_fertige_betraege() -> None:
    """`total_price` statt Minor Units — keine Division, kein Komma-Risiko.

    Die alte Stelle liefert `{"amount": "22500", "decimal_places": 2}`; ein
    vergessener Divisor macht daraus 22.500,00 DKK Resortgebühr. Hier steht der
    fertige Betrag.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    assert booking_aufgeloeste_posten(_aufgeloest_raw()) == [
        ("resort", Decimal("225.00")),
        ("cleaning_fee", Decimal("1075.00")),
    ]


def test_aufgeloeste_posten_werden_vor_der_alten_stelle_gelesen() -> None:
    """Bei zwei Fassungen gewinnt die aufgelöste.

    Beide Stellen tragen dieselben Gebühren. Läse die Kette weiter die alte,
    wäre die Umstellung wirkungslos — und die Bezeichnungen (mit
    Berechnungsart) fehlten in der Abrechnung.
    """
    befund = gebuehren_der_buchung(
        raw=_aufgeloest_raw(),
        type_attributes=None,
        naechte=9,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    assert befund.quelle == "ota"
    assert befund.im_gesamtpreis is True
    assert [(g.art, g.betrag) for g in befund.gebuehren] == [
        ("resort", Decimal("225.00")),
        ("cleaning_fee", Decimal("1075.00")),
    ]
    # Die Berechnungsart des Portals bleibt erhalten — bei einer Rückfrage zur
    # Abrechnung ist sie die zweite Frage nach dem Betrag.
    assert befund.bezeichnungen["resort"] == "Resortgebühr (Per night)"
    assert befund.bezeichnungen["cleaning_fee"] == "Reinigungsgebühr (Per booking)"


def test_leere_taxes_bei_airbnb_gilt_nicht_als_keine_gebuehren() -> None:
    """DIE FALLE: `rooms[].taxes` ist bei Airbnb vorhanden und LEER.

    Über alle 22 Airbnb-Buchungen geprüft. Als blinder Erstleser verstünde die
    Funktion die leere Liste als „keine Gebühren angefallen" und brächte jede
    Airbnb-Buchung um ihre Reinigung — bei einer Buchung 1.075 DKK, die dem
    Eigentümer als Ertrag fehlten. Erkennungsmerkmal ist das FEHLENDE
    `meta.price_details` daneben (das trägt ausschließlich Booking).
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    airbnb_artig = {"rooms": [{"taxes": [], "meta": {"rate_plan_code": None}}]}
    assert booking_aufgeloeste_posten(airbnb_artig) is None


def test_leere_taxes_bei_booking_heisst_keine_gebuehren() -> None:
    """Bei Booking ist die leere Liste dagegen eine AUSSAGE.

    Erkennbar an `meta.price_details` daneben. Hier dürfen die Stammdaten NICHT
    einspringen: das Portal hat gemeldet, dass nichts anfiel.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    assert booking_aufgeloeste_posten(_aufgeloest_raw([])) == []


def test_unbekannte_art_wird_aufgenommen_statt_verworfen() -> None:
    """Eine unbenannte Gebühr ist ein offener Punkt, kein 0,00 — und kein Stopp.

    Sie zu überspringen verlöre Geld, das der Gast bezahlt hat; sie zu raten
    schlüge es der falschen Partei zu (Wurzel 4). Beides passiert nicht: der
    Posten kommt unter `portal:<originaltext>` mit seinem ECHTEN Betrag durch.

    Warum nicht mehr geworfen wird (Änderung 14.08.2026): der Anzeigename kommt
    in der Sprache des Inserats, und weder Booking noch Channex dokumentieren
    die vollständige Liste der Arten. Eine feste Namensliste ist deshalb
    prinzipiell unvollständig — jede unbekannte Art blockierte die gesamte
    Eigentümer-Abrechnung. Live betroffen: „Mehrwertsteuer (25%)" bei
    Rævehulen und jedes dänische Inserat („Rengøringsgebyr").

    Die Kategorie bleibt trotzdem ein offener Punkt: `gebuehren_zuordnen`
    verlangt für JEDE Art die einmalige Zuordnung durch den Betrieb („Wem
    gehören die Gebühren?"). Der Posten landet also im dafür vorgesehenen
    Prozess statt in einem toten Winkel.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_bezeichnungen,
        booking_aufgeloeste_posten,
    )

    raw = _aufgeloest_raw(
        [{"name": "Frühstückspauschale", "total_price": "50.00"}]
    )
    assert booking_aufgeloeste_posten(raw) == [
        ("portal:frühstückspauschale", Decimal("50.00"))
    ]
    # Der Originaltext bleibt erhalten — er ist die einzige Information, die
    # der Betrieb zum Zuordnen hat.
    assert (
        booking_aufgeloeste_bezeichnungen(raw)["portal:frühstückspauschale"]
        == "Frühstückspauschale"
    )


def test_daenischer_name_ueber_sprachneutralen_schluessel() -> None:
    """Ein Name in einer dritten Sprache wird über `charge_periods` erkannt.

    Der Betrieb führt seine Inserate auf Dänisch; „Rengøringsgebyr" steht in
    keiner Namensliste. Bookings Schlüssel `CLEANINGFEE` ist sprachneutral und
    ordnet den Posten trotzdem der Reinigungsgebühr zu — nicht `portal:…`.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    raw = {
        "rooms": [
            {
                "taxes": [
                    {
                        "name": "Rengøringsgebyr",
                        "type": "Service Charge",
                        "total_price": "795.00",
                    }
                ],
                "meta": {
                    "price_details": {},
                    "charge_periods": {"CLEANINGFEE": [{"excluded": False}]},
                },
            }
        ]
    }
    assert booking_aufgeloeste_posten(raw) == [
        ("cleaning_fee", Decimal("795.00"))
    ]


def test_steuerzeile_ist_keine_gebuehr() -> None:
    """`Value Added Tax (VAT)` gehört nicht in die Auszahlung des Eigentümers.

    Live gemessen an Feriehus Rævehulen: Booking meldet die MwSt in derselben
    `rooms[].taxes`-Liste wie die Gebühren. Bis 14.08.2026 warf sie
    `gebuehr_nicht_zugeordnet` und blockierte damit die Abrechnung dieses
    Objekts; als Gebühr verrechnet wäre sie dem Eigentümer zugeschlagen worden.

    Erkannt am strukturierten `type`, nicht am Namen — der ist sprachabhängig.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    raw = _aufgeloest_raw(
        [
            {
                "name": "Reinigungsgebühr",
                "type": "Service Charge",
                "total_price": "795.00",
            },
            {
                "name": "Mehrwertsteuer (25%)",
                "type": "Value Added Tax (VAT)",
                "total_price": "199.00",
            },
        ]
    )
    assert booking_aufgeloeste_posten(raw) == [
        ("cleaning_fee", Decimal("795.00"))
    ]


def test_posten_ohne_gesamtbetrag_wirft() -> None:
    """Ohne `total_price` ist der Betrag unbekannt — kein Ersatzwert."""
    from src.features.owner_statements.gebuehren_quelle import (
        booking_aufgeloeste_posten,
    )

    with pytest.raises(PayoutUnbekannt) as exc:
        booking_aufgeloeste_posten(
            _aufgeloest_raw([{"name": "Resortgebühr", "price_mode": "Per night"}])
        )
    assert exc.value.grund == "gebuehr_nicht_berechenbar"


# ----------------------------------------------------------------------
# charge_periods — ab wann eine Gebühr am Inserat gilt
# ----------------------------------------------------------------------


def test_charge_periods_nennen_den_beginn_der_gebuehr() -> None:
    """Der Payload sagt selbst, ab wann eine Gebühr gilt.

    `RESORTFEE: excluded ab 2026-08-04` — das ist die Antwort auf die Frage,
    warum eine Buchung von Juni keine Resortgebühr trägt, obwohl sie am Objekt
    gepflegt ist. Ohne diese Angabe sieht die fehlende Gebühr wie ein
    Rechenfehler aus, und genau so wurde sie ein halbes Jahr behandelt: 151
    Resort-Posten über 20.950 DKK wurden aus Stammdaten erzeugt.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_gebuehren_zeitraeume,
    )

    zeitraeume = booking_gebuehren_zeitraeume(_aufgeloest_raw())
    assert zeitraeume["resort"][0]["from"] == "2026-08-04"
    assert zeitraeume["cleaning_fee"][0]["excluded"] is True
    # `excluded` = nicht im Zimmerpreis enthalten, also eigener Posten — passend
    # zu `is_inclusive: false` an der Gebühr selbst.
    assert zeitraeume["resort"][0]["to"] is None


def test_charge_periods_fehlen_bei_airbnb_und_importen() -> None:
    """Kein `charge_periods` → leeres Ergebnis, kein Fehler.

    Bei Airbnb und den 51 Channex-Importen gibt es das Feld nicht. Das ist keine
    Lücke, sondern die Eigenschaft dieser Eingangswege.
    """
    from src.features.owner_statements.gebuehren_quelle import (
        booking_gebuehren_zeitraeume,
    )

    assert booking_gebuehren_zeitraeume({"rooms": [{"taxes": []}]}) == {}
    assert booking_gebuehren_zeitraeume(None) == {}


# ----------------------------------------------------------------------
# Portal-Buchung ohne Aufstellung: keine erfundenen Gebühren
# ----------------------------------------------------------------------


def test_portalbuchung_ohne_aufstellung_erfindet_nichts() -> None:
    """DER KERNFEHLER (11.08.2026): Stammdaten für eine Portal-Buchung.

    Die 51 Channex-Importe tragen keine Aufstellung — Channex sagt in seiner
    Doku selbst, Importe enthielten „not include extras and cleaning fees".
    Bis zur Korrektur sprangen hier die Objekt-Stammdaten ein und erzeugten über
    den Bestand 191 Reinigungs- (186.120 DKK), 151 Resort- (20.950 DKK) und 73
    Haustier-Posten (10.950 DKK). Kein einziger war belegt; alle flossen als
    Ertrag in die Eigentümer-Auszahlung.
    """
    befund = gebuehren_der_buchung(
        raw={
            "ota_name": "BookingCom",
            "meta": {"is_imported": True},
            "rooms": [{"days": {"2026-08-21": "578.23"}, "taxes": []}],
        },
        type_attributes={
            "pricing": {
                "fees": [
                    {
                        "feeType": "resort",
                        "name": "Nebenkosten",
                        "amount": "25.00",
                        "basis": "per_night",
                        "mode": "amount",
                    }
                ]
            }
        },
        naechte=8,
        klassifikation=_KLASSIFIKATION,
        property_id="p-1",
    )
    # Seit 02.09.2026 (Ansage des Betriebs: Gebühren „so wie sie im Objekt
    # hinterlegt sind" nachtragen): der Channex-Import trägt nur die
    # Nächtesumme, die Stammdaten-Gebühren kommen OBENDRAUF — benannt, nicht
    # geraten: Quelle und Grund stehen an der Buchung.
    assert befund.quelle == "stammdaten_portal"
    assert befund.grund == "obendrauf"
    assert befund.im_gesamtpreis is False
    assert [(g.art, g.betrag) for g in befund.gebuehren] == [
        ("resort", Decimal("200.00"))
    ]


# ----------------------------------------------------------------------
# Die Kette: keine Doppelzählung
# ----------------------------------------------------------------------


def test_gastpreis_zaehlt_booking_gebuehren_nicht_doppelt() -> None:
    """Der Kernfall — Live-Buchung 6341901680 über 9 Nächte.

    `total_amount` ist 12.095,00 und enthält Resort und Reinigung schon. Ohne
    `gebuehren_im_betrag` stünden 13.395,00 im Gastpreis: 1.300,00 zu viel.
    """
    gebuehren = [
        Gebuehr("resort", Decimal("225.00"), "eigentuemer", False),
        Gebuehr("cleaning_fee", Decimal("1075.00"), "betrieb", False),
    ]
    assert gastpreis(
        uebernachtung=Decimal("12095.00"),
        gebuehren=gebuehren,
        gebuehren_im_betrag=True,
    ) == Decimal("12095.00")
    assert gastpreis(
        uebernachtung=Decimal("10795.00"),
        gebuehren=gebuehren,
        gebuehren_im_betrag=False,
    ) == Decimal("12095.00")


def test_kette_booking_ergibt_gemeldete_provision_als_15_prozent() -> None:
    """Gegenprobe an der Live-Buchung: die gemeldete Provision IST 15 % vom
    Gastpreis — der Beweis, dass die Bezugsgröße stimmt."""
    brutto = gastpreis(
        uebernachtung=Decimal("12095.00"),
        gebuehren=[
            Gebuehr("resort", Decimal("225.00"), "eigentuemer", False),
            Gebuehr("cleaning_fee", Decimal("1075.00"), "betrieb", False),
        ],
        gebuehren_im_betrag=True,
    )
    assert brutto * Decimal("0.15") == Decimal("1814.25")


def test_kette_booking_und_airbnb_ergeben_dieselbe_auszahlung() -> None:
    """Dieselbe Buchung, zweimal gemeldet — einmal brutto, einmal netto.

    Bei gleichem Gastpreis, gleichem Portal-Abzug und gleichem Vertrag MUSS
    dieselbe Netto-Auszahlung herauskommen. Läuft das auseinander, hängt die
    Auszahlung an der Meldeform des Portals statt an der Vereinbarung.
    """
    gebuehren = [
        Gebuehr("resort", Decimal("225.00"), "eigentuemer", False),
        Gebuehr("cleaning_fee", Decimal("1075.00"), "betrieb", False),
    ]
    abzug = PortalAbzug(
        provision=Decimal("1814.25"), zahlungsgebuehr=Decimal("181.425")
    )
    regeln = Vertragsregeln(provisions_pct=Decimal("20"))
    gemeinsam = {
        "gebuehren": gebuehren,
        "abzug": abzug,
        "regeln": regeln,
        "naechte": 9,
        "currency": "DKK",
    }
    brutto_form = auszahlung_berechnen(
        uebernachtung=Decimal("12095.00"),
        gebuehren_im_betrag=True,
        **gemeinsam,
    )
    netto_form = auszahlung_berechnen(
        uebernachtung=Decimal("10795.00"),
        gebuehren_im_betrag=False,
        **gemeinsam,
    )
    assert brutto_form == netto_form
    assert brutto_form.brutto == Decimal("12095.00")


def test_kette_reinigung_bleibt_beim_betrieb() -> None:
    """Die Reinigung des Betriebs kommt NICHT zum Eigentümer zurück.

    Sie ist aus der Provisionsbemessung heraus (Schritt 3), fließt aber in
    Schritt 7 nicht zurück — sie ist der Ertrag des Betriebs. Die Resortgebühr
    des Eigentümers dagegen schon, zu 100 %.
    """
    ergebnis = auszahlung_berechnen(
        uebernachtung=Decimal("12095.00"),
        gebuehren=[
            Gebuehr("resort", Decimal("225.00"), "eigentuemer", False),
            Gebuehr("cleaning_fee", Decimal("1075.00"), "betrieb", False),
        ],
        gebuehren_im_betrag=True,
        abzug=PortalAbzug(
            provision=Decimal("1814.25"), zahlungsgebuehr=Decimal("0")
        ),
        regeln=Vertragsregeln(provisions_pct=Decimal("20")),
        naechte=9,
        currency="DKK",
    )
    # Basis nach Portal-Abzug: 12.095,00 − 1.814,25 = 10.280,75
    assert ergebnis.auszahlungsbasis == Decimal("10280.75")
    # Bemessung: − 225,00 − 1.075,00 = 8.980,75
    assert ergebnis.bemessungsgrundlage == Decimal("8980.75")
    assert ergebnis.verwaltungsprovision == Decimal("1796.150")
    # Netto: 8.980,75 − 1.796,15 + 225,00 (nur die Eigentümer-Gebühr)
    assert ergebnis.netto == Decimal("7409.600")
    assert ergebnis.gebuehren_an_eigentuemer == Decimal("225.00")
