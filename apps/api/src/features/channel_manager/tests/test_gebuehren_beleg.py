"""Tests für den Buchungs-Nachweis: wo liegt eine Gebührenart wirklich?

Der Chip an einer Gebühr zeigte vorher die Portale, die den Posten NICHT per Sync
bekommen — und wurde als „liegt dort nicht" gelesen. Live am 11.08.2026 stand die
Reinigungsgebühr bei Airbnb UND Booking.com im Extranet, der Chip zeigte sie bei
keinem von beiden.

Die Payload-Strukturen hier sind die echten aus dem Live-Bestand: Airbnb meldet
die Gebühren in `raw_message.reservation.standard_fees_details`, Booking.com in
`rooms[].meta.price_details.guest_view.taxes` mit Minor-Units.
"""
from typing import Any

from src.features.channel_manager.gebuehren_beleg import (
    _arten_der_buchung,
    _portal_code,
    belege_je_gebuehrenart,
)


def _airbnb_raw(*arten: str) -> dict:
    return {
        "raw_message": {
            "reservation": {
                "base_price": "7010.00",
                "standard_fees_details": [
                    {"fee_type": a, "amount": "100.00"} for a in arten
                ],
            }
        }
    }


def _booking_raw(*texte: str) -> dict:
    return {
        "rooms": [
            {
                "days": {"2027-07-20": "1105.00"},
                "meta": {
                    "price_details": {
                        "guest_view": {
                            "taxes": [
                                {
                                    "amount": "107500",
                                    "decimal_places": 2,
                                    "tax_description": t,
                                }
                                for t in texte
                            ]
                        }
                    }
                },
            }
        ]
    }


class _FakeDB:
    """Gibt die vorgegebenen Buchungszeilen zurück, egal wie gefiltert wird."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self.filter: dict[str, Any] = {}

    def table(self, _name: str) -> "_FakeDB":
        return self

    def select(self, _cols: str) -> "_FakeDB":
        return self

    def eq(self, feld: str, wert: object) -> "_FakeDB":
        self.filter[feld] = wert
        return self

    def order(self, _feld: str, desc: bool = False) -> "_FakeDB":
        return self

    def limit(self, n: int) -> "_FakeDB":
        self.filter["limit"] = n
        return self

    def execute(self) -> "_FakeDB":
        return self

    @property
    def data(self) -> list[dict[str, Any]]:
        return self._rows


# ----------------------------------------------------------------------
# Der Kernfall
# ----------------------------------------------------------------------


def test_reinigung_bei_beiden_portalen_belegt() -> None:
    """Der Live-Fall: die Reinigung liegt bei Airbnb UND bei Booking.

    Genau das zeigte der alte Chip bei keinem von beiden.
    """
    db = _FakeDB(
        [
            {
                "ota_name": "AirBNB",
                "raw": _airbnb_raw("PASS_THROUGH_CLEANING_FEE"),
            },
            {"ota_name": "BookingCom", "raw": _booking_raw("Reinigungsgebühr")},
        ]
    )
    belege = belege_je_gebuehrenart(db, "t-1", "p-1")
    assert belege == {"cleaning_fee": ["airbnb", "booking"]}


def test_verschiedene_arten_je_portal() -> None:
    """Jede Art wird EINZELN belegt — nicht pauschal je Portal.

    Eine Haustiergebühr, die nur Booking berechnet, darf bei Airbnb nicht als
    „liegt dort" erscheinen.
    """
    db = _FakeDB(
        [
            {
                "ota_name": "AirBNB",
                "raw": _airbnb_raw(
                    "PASS_THROUGH_CLEANING_FEE", "PASS_THROUGH_RESORT_FEE"
                ),
            },
            {
                "ota_name": "BookingCom",
                "raw": _booking_raw("Reinigungsgebühr", "Haustiergebühr"),
            },
        ]
    )
    belege = belege_je_gebuehrenart(db, "t-1", "p-1")
    assert belege["cleaning_fee"] == ["airbnb", "booking"]
    assert belege["resort"] == ["airbnb"]
    assert belege["pet_fee"] == ["booking"]


def test_ohne_buchungen_kein_beleg() -> None:
    """Leer heißt „kein Nachweis", nicht „liegt nirgends".

    Ein neu gepflegtes Objekt ohne Buchungen kann keinen Beleg haben — die
    Oberfläche darf daraus nicht „liegt dort nicht" machen.
    """
    assert belege_je_gebuehrenart(_FakeDB([]), "t-1", "p-1") == {}


def test_ist_tenant_gescoped() -> None:
    """Wurzel 3: der Service-Role-Key umgeht RLS, der Scope MUSS explizit sein.

    Ohne ihn liesse sich mit einer fremden `property_id` die Preisstruktur eines
    anderen Betriebs auslesen.
    """
    db = _FakeDB([])
    belege_je_gebuehrenart(db, "t-42", "p-7")
    assert db.filter["tenant_id"] == "t-42"
    assert db.filter["property_id"] == "p-7"
    # Und die Menge ist begrenzt — ein Objekt mit 300 Buchungen soll nicht 300
    # Payloads schälen, um dieselbe JA/NEIN-Antwort zu geben.
    assert db.filter["limit"] > 0


# ----------------------------------------------------------------------
# Portal-Codes
# ----------------------------------------------------------------------


def test_channex_schreibweisen_treffen_die_verbindungen() -> None:
    """`BookingCom` muss auf `booking` treffen, nicht auf `bookingcom`.

    Per Kleinschreibung geraten fiele der Code auf `bookingcom` und träfe keine
    Verbindung — der Chip fehlte genau bei dem Portal, um das es geht (derselbe
    Fehler wie live am 07.08.2026 bei der Kanal-Zuordnung im Kalender).
    """
    assert _portal_code("BookingCom") == "booking"
    assert _portal_code("Booking.com") == "booking"
    assert _portal_code("AirBNB") == "airbnb"
    assert _portal_code("Expedia") == "expedia"


def test_unbekanntes_portal_ergibt_keinen_code() -> None:
    """Kein geratener Code: ein unbekanntes Portal darf keinen Chip erzeugen."""
    assert _portal_code("Irgendwas") is None
    assert _portal_code("") is None
    assert _portal_code(None) is None


def test_buchung_ohne_erkennbares_portal_wird_uebersprungen() -> None:
    db = _FakeDB(
        [{"ota_name": "Unbekannt", "raw": _booking_raw("Reinigungsgebühr")}]
    )
    assert belege_je_gebuehrenart(db, "t-1", "p-1") == {}


# ----------------------------------------------------------------------
# Payload-Auslegung
# ----------------------------------------------------------------------


def test_beide_payload_formate_werden_gelesen() -> None:
    assert _arten_der_buchung(_airbnb_raw("PASS_THROUGH_PET_FEE")) == ["pet_fee"]
    assert _arten_der_buchung(_booking_raw("Resortgebühr")) == ["resort"]


def test_unbekannte_gebuehrenart_bricht_den_nachweis_nicht() -> None:
    """Der Nachweis beantwortet nur „liegt dort".

    Eine Art, die wir nicht benennen können, lässt sich keiner Zeile zuordnen und
    wird still übersprungen. Die Auszahlungsrechnung meldet denselben Payload
    weiterhin als offenen Punkt — dort gehört die Meldung hin, nicht in einen
    Chip.
    """
    assert _arten_der_buchung(_booking_raw("Frühstückspauschale")) == []
    # Und eine Buchung mit unbekannter Art kippt den Gesamtlauf nicht.
    db = _FakeDB(
        [
            {"ota_name": "BookingCom", "raw": _booking_raw("Frühstückspauschale")},
            {"ota_name": "BookingCom", "raw": _booking_raw("Reinigungsgebühr")},
        ]
    )
    assert belege_je_gebuehrenart(db, "t-1", "p-1") == {
        "cleaning_fee": ["booking"]
    }


def test_leerer_payload_ergibt_nichts() -> None:
    assert _arten_der_buchung(None) == []
    assert _arten_der_buchung({}) == []
    assert _arten_der_buchung({"rooms": []}) == []
