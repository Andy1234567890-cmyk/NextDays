"""Tests für die gespeicherte Portal-Zerlegung (0366).

Die Zahlen sind ECHTE Live-Werte des Beta-Betriebs (11.08.2026), keine
erfundenen Beispiele — die zwei Fehler, die diese Schicht behebt, waren nur an
den echten Payload-Strukturen zu sehen.

Zwei Invarianten prüft die DB (0366); diese Tests spiegeln sie, damit ein
Verstoß hier auffällt und nicht erst als Constraint-Fehler im Import:
  * ``brutto >= uebernachtung``
  * ``provision + zahlungsgebuehr <= brutto``
Zusätzlich muss ``uebernachtung + Gebühren == brutto`` gelten — das ist der
eigentliche Beweis, dass keine Doppelzählung mehr stattfindet. An allen 77
Live-Buchungen nachgerechnet: 0 Verstöße.
"""
from decimal import Decimal

import pytest

from src.features.owner_statements.common import PayoutUnbekannt
from src.features.owner_statements.portal_finanzen import (
    PortalFinanzen,
    zerlegung_ermitteln,
    zerlegung_speichern,
)

_KLASSIFIKATION = {
    ("cleaning_fee", None): ("betrieb", False),
    ("resort", None): ("eigentuemer", False),
    ("pet_fee", None): ("eigentuemer", True),
}

# Die live hinterlegten Sätze des Betriebs.
_AIRBNB_SATZ = {"provision_pct": Decimal("15.5"), "zahlungsgebuehr_pct": None}
_BOOKING_SATZ = {
    "provision_pct": Decimal("15"),
    "zahlungsgebuehr_pct": Decimal("1.5"),
}


def _res(**kwargs: object) -> dict:
    basis: dict = {
        "id": "r-1",
        "tenant_id": "t-1",
        "property_id": "p-1",
        "currency": "DKK",
        "payment_collect": "ota",
    }
    basis.update(kwargs)
    return basis


def _airbnb_raw(base: str = "7010.00") -> dict:
    """Live-Buchung HMTH2N8PPM (7 Nächte), Struktur unverändert übernommen."""
    return {
        "raw_message": {
            "reservation": {
                "base_price": base,
                "extra_guest_fee": "0.00",
                "host_fee_base": "1303.55",
                "payout_amount": "7106.45",
                "standard_fees_details": [
                    {"fee_type": "PASS_THROUGH_RESORT_FEE", "amount": "175.00"},
                    {"fee_type": "PASS_THROUGH_PET_FEE", "amount": "150.00"},
                    {
                        "fee_type": "PASS_THROUGH_CLEANING_FEE",
                        "amount": "1075.00",
                    },
                ],
            }
        }
    }


def _booking_raw() -> dict:
    """Live-Buchung 6341901680 (9 Nächte: 4×1105 + 5×1275 = 10.795,00)."""
    tage = {f"2027-07-{20 + i}": "1105.00" for i in range(4)}
    tage.update({f"2027-07-{24 + i}": "1275.00" for i in range(5)})
    return {
        "rooms": [
            {
                "days": tage,
                "meta": {
                    "price_details": {
                        "guest_view": {
                            "taxes": [
                                {
                                    "amount": "22500",
                                    "decimal_places": 2,
                                    "tax_description": "Resortgebühr",
                                    "charge_frequency": 19,
                                    "type": "Inclusive",
                                },
                                {
                                    "amount": "107500",
                                    "decimal_places": 2,
                                    "tax_description": "Reinigungsgebühr",
                                    "charge_frequency": 12,
                                    "type": "Inclusive",
                                },
                            ]
                        }
                    }
                },
            }
        ]
    }


def _pruefe_invarianten(f: PortalFinanzen) -> None:
    """Die DB-Constraints aus 0366 plus die Summenprobe."""
    assert f.brutto >= f.uebernachtung
    assert f.provision + f.zahlungsgebuehr <= f.brutto
    assert min(f.uebernachtung, f.brutto, f.provision, f.zahlungsgebuehr) >= 0
    geb = sum((g.betrag for g in f.gebuehren), Decimal("0"))
    assert f.uebernachtung + geb == f.brutto


# ----------------------------------------------------------------------
# Airbnb — total_amount ist der Netto-Payout
# ----------------------------------------------------------------------


def test_airbnb_zerlegung_trifft_die_abrechnung() -> None:
    """Gegen die echte Airbnb-Abrechnung von HMTH2N8PPM.

    Basis 7.010,00 + 1.400,00 Gebühren = 8.410,00; Host Fee 1.303,55 = 15,50 %;
    Auszahlung 7.106,45. Das `total_amount` der Buchung IST diese 7.106,45 —
    und darf nicht als Übernachtung gelesen werden.
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="7106.45", ota_commission="1303.55"),
        raw=_airbnb_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=7,
        satz=_AIRBNB_SATZ,
    )
    assert f.uebernachtung == Decimal("7010.00")
    assert f.brutto == Decimal("8410.00")
    assert f.provision == Decimal("1303.55")
    assert f.provision_gemeldet is True
    # Airbnb erhebt keine Zahlungsgebühr — der Satz führt sie als NULL.
    assert f.zahlungsgebuehr == Decimal("0")
    assert f.quelle == "ota"
    _pruefe_invarianten(f)


def test_airbnb_provision_ist_genau_der_vereinbarte_satz() -> None:
    """Der Beweis für die richtige Bezugsgröße: 15,50 % auf das Brutto.

    Auf den Netto-Payout bezogen ergäbe derselbe Abzug 18,34 % — und über die
    22 Live-Buchungen eine Streuung von 12,34 % bis 17,02 %, obwohl der Satz
    konstant vereinbart ist.
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="7106.45", ota_commission="1303.55"),
        raw=_airbnb_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=7,
        satz=_AIRBNB_SATZ,
    )
    assert (f.provision / f.brutto * 100).quantize(
        Decimal("0.01")
    ) == Decimal("15.50")


def test_airbnb_ohne_gemeldete_provision_nimmt_den_satz() -> None:
    """Ohne `ota_commission` greift der hinterlegte Satz — als Rekonstruktion
    gekennzeichnet, nicht als Beleg."""
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="7106.45", ota_commission=None),
        raw=_airbnb_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=7,
        satz=_AIRBNB_SATZ,
    )
    assert f.provision_gemeldet is False
    assert f.provision == Decimal("8410.00") * Decimal("0.155")
    _pruefe_invarianten(f)


def test_airbnb_zusatzgast_zaehlt_zur_uebernachtung() -> None:
    """`extra_guest_fee` ist ein Aufschlag auf die Unterkunft.

    Er steht nicht in `standard_fees_details` und ist voll provisionspflichtig.
    """
    raw = _airbnb_raw()
    raw["raw_message"]["reservation"]["extra_guest_fee"] = "500.00"
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="7106.45", ota_commission="1303.55"),
        raw=raw,
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=7,
        satz=_AIRBNB_SATZ,
    )
    assert f.uebernachtung == Decimal("7510.00")
    assert f.brutto == Decimal("8910.00")
    _pruefe_invarianten(f)


# ----------------------------------------------------------------------
# Booking.com — total_amount ist der Gastpreis brutto
# ----------------------------------------------------------------------


def test_booking_zerlegung_trennt_naechte_und_gebuehren() -> None:
    """Live-Buchung 6341901680: total_amount 12.095,00 ist BRUTTO.

    Die Übernachtung kommt aus `rooms[].days` (10.795,00) und wird nicht als
    „Brutto minus Gebühren" abgeleitet — sie ist eine gemeldete Zahl.
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    assert f.uebernachtung == Decimal("10795.00")
    assert f.brutto == Decimal("12095.00")
    assert f.provision == Decimal("1814.25")
    assert f.zahlungsgebuehr == Decimal("12095.00") * Decimal("0.015")
    _pruefe_invarianten(f)


def test_booking_gebuehren_werden_nicht_doppelt_gezaehlt() -> None:
    """Der Kernfall. Ohne die Korrektur wäre das Brutto 13.395,00."""
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    assert f.brutto == Decimal("12095.00")
    assert sum((g.betrag for g in f.gebuehren), Decimal("0")) == Decimal(
        "1300.00"
    )
    assert f.bezeichnungen == {
        "resort": "Resortgebühr",
        "cleaning_fee": "Reinigungsgebühr",
    }


def test_booking_provision_ist_genau_15_prozent() -> None:
    """Gegenprobe der Bezugsgröße, unabhängig von Airbnb."""
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    assert (f.provision / f.brutto * 100).quantize(
        Decimal("0.01")
    ) == Decimal("15.00")


def test_booking_direktzahlung_ohne_zahlungsgebuehr() -> None:
    """Die Zahlungsgebühr ist das Entgelt für die Geldweiterleitung.

    Zahlt der Gast direkt an den Betrieb, leitet das Portal kein Geld weiter —
    dann fällt sie nicht an, auch wenn ein Satz hinterlegt ist. Die Provision
    bleibt, sie wird nur separat fakturiert.
    """
    f = zerlegung_ermitteln(
        reservation=_res(
            total_amount="12095.00",
            ota_commission=None,
            payment_collect="property",
        ),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    assert f.zahlungsgebuehr == Decimal("0")
    assert f.provision > 0
    _pruefe_invarianten(f)


# ----------------------------------------------------------------------
# Portal-Buchung ohne Aufstellung (die 51 Channex-Importe)
# ----------------------------------------------------------------------

_OBJEKT_MIT_GEBUEHREN = {
    "pricing": {
        "fees": [
            {
                "feeType": "resort",
                "name": "Nebenkosten",
                "amount": "25.00",
                "basis": "per_night",
                "mode": "amount",
            },
            {
                "feeType": "cleaning_fee",
                "name": "Endreinigung",
                "amount": "1075.00",
                "basis": "per_stay",
                "mode": "amount",
            },
        ]
    }
}


def test_altimport_erfindet_keine_gebuehren_aus_stammdaten() -> None:
    """Die 51 Channex-Importe tragen keine Aufstellung — dann gibt es KEINE.

    DER VORFALL (11.08.2026): Hier sprangen die Objekt-Stammdaten ein und
    hängten jede gepflegte Gebühr an jede Buchung. Über den Bestand waren das
    191 Reinigungs- (186.120 DKK), 151 Resort- (20.950 DKK) und 73
    Haustier-Posten (10.950 DKK), von denen kein einziger belegt war — sie
    flossen als Ertrag in die Eigentümer-Auszahlung.

    Belegt, dass die Stammdaten hier nicht die Wahrheit sind: „FeWo Lille
    Lægehus" hat Resort 25/Nacht gepflegt, Booking hat sie bei Buchung
    5012668004 aber nicht erhoben (1.150 Nächte + 150 Haustier = 1.300 =
    Gesamtbetrag, exakt auf). Der Payload sagt sogar, warum —
    `meta.charge_periods` führt RESORTFEE erst ab 2026-08-04.

    Der Payload ist bewusst so aufgebaut wie ein ECHTER Import: mit `ota_name`
    und `meta.is_imported`. Ohne diese Felder liefe der Test am Fehler vorbei —
    er tat es, bis die Portal-Erkennung dazukam (77/77 Live-Buchungen tragen
    `ota_name` plus `rooms`/`raw_message`).
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="1039.50", ota_commission=None),
        raw={
            "ota_name": "BookingCom",
            "meta": {"is_imported": True},
            "rooms": [{"days": {"2026-08-01": "1039.50"}, "taxes": []}],
        },
        type_attributes=_OBJEKT_MIT_GEBUEHREN,
        klassifikation=_KLASSIFIKATION,
        naechte=2,
        satz=_BOOKING_SATZ,
    )
    assert f.quelle == "ota_ohne_aufstellung"
    assert f.gebuehren == []
    assert f.provision_gemeldet is False
    # Ohne Gebühren ist der Gastpreis die Übernachtung — nicht 2.164,50, wie es
    # mit erfundenen Stammdaten-Gebühren herauskam.
    assert f.uebernachtung == Decimal("1039.50")
    assert f.brutto == Decimal("1039.50")
    _pruefe_invarianten(f)


def test_direktbuchung_nutzt_weiter_die_stammdaten() -> None:
    """Ohne Portal gibt es keinen Payload — dort sind die Stammdaten richtig.

    Eine Buchung über die eigene Website, per Telefon oder an der Rezeption hat
    nie eine Portal-Aufstellung. Die gepflegten Gebühren des Objekts sind hier
    KEINE Schätzung, sondern das, was der Betrieb selbst berechnet hat. Sie
    mit derselben Regel wie die Importe zu streichen würde die Gebühren echter
    Direktbuchungen unterschlagen.
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="1039.50", ota_commission=None),
        raw=None,
        type_attributes=_OBJEKT_MIT_GEBUEHREN,
        klassifikation=_KLASSIFIKATION,
        naechte=2,
        satz=_BOOKING_SATZ,
    )
    assert f.quelle == "stammdaten"
    assert f.uebernachtung == Decimal("1039.50")
    # 1.039,50 + 2×25 Resort + 1.075 Reinigung
    assert f.brutto == Decimal("2164.50")
    _pruefe_invarianten(f)


# ----------------------------------------------------------------------
# Kein Ersatzwert (Wurzel 4)
# ----------------------------------------------------------------------


def test_ohne_waehrung_wirft() -> None:
    with pytest.raises(PayoutUnbekannt) as exc:
        zerlegung_ermitteln(
            reservation=_res(total_amount="100", currency=""),
            raw=_airbnb_raw(),
            type_attributes=None,
            klassifikation=_KLASSIFIKATION,
            naechte=7,
            satz=_AIRBNB_SATZ,
        )
    assert exc.value.grund == "betrag"


def test_ohne_satz_und_ohne_meldung_wirft() -> None:
    """Kein 0 %: das zahlte dem Eigentümer den Portal-Anteil als Ertrag aus."""
    with pytest.raises(PayoutUnbekannt) as exc:
        zerlegung_ermitteln(
            reservation=_res(total_amount="12095.00", ota_commission=None),
            raw=_booking_raw(),
            type_attributes=None,
            klassifikation=_KLASSIFIKATION,
            naechte=9,
            satz=None,
        )
    assert exc.value.grund == "portal_abzug"


def test_unzugeordnete_gebuehrenart_wirft() -> None:
    """Ohne Zuordnung ist nicht bestimmbar, wem der Betrag gehört."""
    with pytest.raises(PayoutUnbekannt) as exc:
        zerlegung_ermitteln(
            reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
            raw=_booking_raw(),
            type_attributes=None,
            klassifikation={("resort", None): ("eigentuemer", False)},
            naechte=9,
            satz=_BOOKING_SATZ,
        )
    assert exc.value.grund == "gebuehr_nicht_zugeordnet"


def test_airbnb_ohne_base_price_wirft() -> None:
    """Kein stiller Rückfall auf total_amount — das wäre genau der Fehler."""
    raw = _airbnb_raw()
    del raw["raw_message"]["reservation"]["base_price"]
    with pytest.raises(PayoutUnbekannt) as exc:
        zerlegung_ermitteln(
            reservation=_res(total_amount="7106.45", ota_commission="1303.55"),
            raw=raw,
            type_attributes=None,
            klassifikation=_KLASSIFIKATION,
            naechte=7,
            satz=_AIRBNB_SATZ,
        )
    assert exc.value.grund == "betrag"


# ----------------------------------------------------------------------
# Idempotenz des Schreibvorgangs (Wurzel 2)
# ----------------------------------------------------------------------


class _FakeTable:
    """Protokolliert die Aufrufe, ohne etwas zu speichern."""

    def __init__(self, log: list, name: str) -> None:
        self._log = log
        self._name = name

    def upsert(self, row: object, on_conflict: str | None = None) -> "_FakeTable":
        self._log.append(("upsert", self._name, row, on_conflict))
        return self

    def insert(self, rows: object) -> "_FakeTable":
        self._log.append(("insert", self._name, rows))
        return self

    def delete(self) -> "_FakeTable":
        self._log.append(("delete", self._name))
        return self

    def eq(self, *_args: object) -> "_FakeTable":
        return self

    def execute(self) -> "_FakeTable":
        return self


class _FakeDB:
    def __init__(self) -> None:
        self.log: list = []

    def table(self, name: str) -> _FakeTable:
        return _FakeTable(self.log, name)


def test_speichern_ersetzt_posten_statt_sie_zu_ergaenzen() -> None:
    """Eine Revision kann eine Gebühr ENTFERNT haben.

    Der Import läuft bei jeder Revision erneut. Würden Posten nur ergänzt,
    bliebe die entfernte Gebühr stehen und dem Eigentümer weiter berechnet
    (Wurzel 1: der Gegenzustand muss mitgepflegt werden).
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    db = _FakeDB()
    zerlegung_speichern(db, f)
    assert [a[0] for a in db.log] == ["upsert", "delete", "insert"]
    # Der Kopf geht per upsert auf den Primärschlüssel — zweimal derselbe
    # Import erzeugt keine zweite Zeile (Wurzel 2).
    assert db.log[0][3] == "reservation_id"
    posten = db.log[2][2]
    assert {p["art"] for p in posten} == {"resort", "cleaning_fee"}
    # Die Original-Bezeichnung des Portals bleibt erhalten.
    assert {p["ota_bezeichnung"] for p in posten} == {
        "Resortgebühr",
        "Reinigungsgebühr",
    }


def test_speichern_ohne_gebuehren_schreibt_keine_posten() -> None:
    """Kein leerer Insert: „keine Gebühren" ist ein echter Zustand."""
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="1039.50", ota_commission=None),
        raw={"rooms": [{"days": {"2026-08-01": "1039.50"}}]},
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=1,
        satz=_BOOKING_SATZ,
    )
    db = _FakeDB()
    zerlegung_speichern(db, f)
    assert [a[0] for a in db.log] == ["upsert", "delete"]


def test_speichern_schreibt_betraege_als_string() -> None:
    """Beträge gehen als String zur DB, nicht als float.

    `numeric` über float zu schreiben führte Rundungsartefakte ein (0,1 + 0,2),
    die sich in Geldbeträgen als Cent-Differenzen zeigen.
    """
    f = zerlegung_ermitteln(
        reservation=_res(total_amount="12095.00", ota_commission="1814.25"),
        raw=_booking_raw(),
        type_attributes=None,
        klassifikation=_KLASSIFIKATION,
        naechte=9,
        satz=_BOOKING_SATZ,
    )
    db = _FakeDB()
    zerlegung_speichern(db, f)
    kopf = db.log[0][2]
    for feld in ("uebernachtung", "brutto", "provision", "zahlungsgebuehr"):
        assert isinstance(kopf[feld], str)
    assert all(isinstance(p["betrag"], str) for p in db.log[2][2])
