

from typing import Any

# --- Zahlungsweg und Portalprovision (0240) ---------------------------------


def test_payment_collect_nimmt_nur_dokumentierte_werte() -> None:
    """'property' und 'ota' werden übernommen, alles andere wird None.

    Ein unbekannter Wert darf den Import nicht kippen — der Aggregator kann die
    Liste jederzeit erweitern (Wurzel 5).
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin as S

    assert S._payment_collect({"payment_collect": "property"}) == "property"
    assert S._payment_collect({"payment_collect": "OTA"}) == "ota"
    assert S._payment_collect({"payment_collect": "irgendwas_neues"}) is None
    assert S._payment_collect({}) is None


def test_payment_collect_leitet_vcc_als_ota_ab() -> None:
    """Virtuelle Kreditkarte = Portal hat kassiert, auch ohne payment_collect.

    Booking.com lässt das Feld bei „Payments by Booking.com" oft leer; die
    VCC im guarantee-Objekt ist dann das verlässliche Signal. Eine echte
    Gast-Karte (is_virtual=false) ist dagegen KEIN Einzug durch das Portal.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin as S

    assert S._payment_collect({"guarantee": {"is_virtual": True}}) == "ota"
    assert S._payment_collect({"guarantee": {"is_virtual": False}}) is None
    assert S._payment_collect({"guarantee": {}}) is None
    assert S._payment_collect({"guarantee": "kaputt"}) is None
    # Explizites 'property' gewinnt gegen eine (dann widersprüchliche) VCC.
    assert S._payment_collect(
        {"payment_collect": "property", "guarantee": {"is_virtual": True}}
    ) == "property"


def test_payment_collect_airbnb_ist_immer_portal_kassiert() -> None:
    """Airbnb hat keinen Vor-Ort-Zahlweg — der Kanal selbst ist das Signal.

    Airbnb liefert weder payment_collect noch eine VCC (Zahlungsdaten nur als
    Freitext in notes); ohne Kanal-Regel stünden alle Airbnb-Buchungen als
    „offen". Ein expliziter Wert gewinnt weiterhin, fremde Kanäle bleiben None.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin as S

    assert S._payment_collect({"ota_name": "Airbnb"}) == "ota"
    assert S._payment_collect({"ota_name": "airbnb"}) == "ota"
    assert S._payment_collect(
        {"ota_name": "Airbnb", "payment_collect": "property"}
    ) == "property"
    assert S._payment_collect({"ota_name": "Booking.com"}) is None
    assert S._payment_collect({"ota_name": "Expedia"}) is None


def test_withheld_taxes_summiert_collected_taxes_aller_zimmer() -> None:
    """Vom Portal einbehaltene Steuern: Summe je Buchung, None = nicht geliefert.

    Booking.com meldet einbehaltene Steuern (City Tax etc.) je Zimmer als
    collected_taxes — sie mindern die Auszahlung zusätzlich zur Provision.
    Kaputte Einträge werden übersprungen, nie zu 0 erfunden (Wurzel 4).
    """
    from src.features.channel_manager.service import ChannelManagerService

    svc = ChannelManagerService.__new__(ChannelManagerService)
    assert svc._withheld_taxes({"rooms": [
        {"collected_taxes": [{"total_price": "23.04", "type": "City Tax"}]},
        {"collected_taxes": [{"total_price": "10.00"}, {"total_price": "kaputt"}]},
    ]}) == 33.04
    assert svc._withheld_taxes({"rooms": [{"collected_taxes": []}]}) is None
    assert svc._withheld_taxes({"rooms": [{}]}) is None
    assert svc._withheld_taxes({}) is None


def test_payment_method_nimmt_nur_dokumentierte_werte() -> None:
    """Zahlungsart: nur credit_card und bank_transfer, sonst None."""
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin as S

    assert S._payment_method({"payment_type": "credit_card"}) == "credit_card"
    assert S._payment_method({"payment_type": "bank_transfer"}) == "bank_transfer"
    assert S._payment_method({"payment_type": "krypto"}) is None
    assert S._payment_method({"payment_type": None}) is None


class _MapTabelle:
    """Minimale Attrappe für `channex_property_map` (nur Lesepfad)."""

    def __init__(self, zeilen: list[dict]) -> None:
        self._zeilen = zeilen
        self._filter: dict[str, str] = {}

    def table(self, name: str) -> "_MapTabelle":
        assert name == "channex_property_map"
        return self

    def select(self, *_a: str) -> "_MapTabelle":
        return self

    def eq(self, spalte: str, wert: str) -> "_MapTabelle":
        self._filter[spalte] = wert
        return self

    def is_(self, *_a: str) -> "_MapTabelle":
        return self

    def order(self, *_a: str) -> "_MapTabelle":
        return self

    def limit(self, _n: int) -> "_MapTabelle":
        return self

    def execute(self) -> "_MapTabelle":
        treffer = [
            z for z in self._zeilen
            if all(str(z.get(k)) == v for k, v in self._filter.items())
        ]
        self.data = treffer[:1]
        return self


def test_buchung_traegt_ihr_objekt() -> None:
    """Die Buchung MUSS ihre Objekt-Zuordnung tragen, nicht nur `raw`.

    DER VORFALL (06.08.2026): `property_map_id` wurde beim Speichern nie
    gesetzt — live stand die Spalte bei ALLEN 22 Buchungen auf NULL, obwohl
    `raw.property_id` und die passende Map-Zeile die ganze Zeit vorlagen. Folge:
    kein Objektname im Posteingang, leerer Objekt-Filter, und jede Vorlage mit
    `{{property_name}}` scheiterte mit „Feld ohne Wert".
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _MapTabelle([
        {"id": "map-1", "tenant_id": "t1", "property_id": "prop-1",
         "channex_property_id": "cx-prop-1", "created_at": "2026-01-01"},
    ])
    # Ohne `rooms` (Ferienobjekt) bleibt es beim 1:1-Weg über die Property-Map.
    map_id, property_id = BookingsSyncMixin()._objekt_zuordnung(
        db, "t1", "cx-prop-1"
    )
    assert map_id == "map-1"
    # ZWEITER VORFALL (11.08.2026): `property_map_id` war gesetzt,
    # `channex_booking.property_id` aber NULL — die Auflösung hatte die lokale
    # Kennung intern schon ermittelt und wieder weggeworfen. Jede Auswertung,
    # die über `property_id` joint, verlor diese Buchungen stillschweigend.
    assert property_id == "prop-1"


def test_ungemapptes_inserat_blockiert_die_buchung_nicht() -> None:
    """Kein Mapping → None, aber die Buchung wird trotzdem gespeichert.

    Eine OTA-Buchung zu verwerfen, weil ihr Inserat bei uns kein Objekt hat
    (live: 23 solche Airbnb-Inserate), ließe die Nächte frei — Überbuchung. Die
    Zuordnung bleibt leer, statt auf irgendein Objekt zu raten (Wurzel 4).
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _MapTabelle([])
    sync = BookingsSyncMixin()
    # BEIDE Kennungen bleiben leer — kein Raten auf „irgendein Objekt".
    assert sync._objekt_zuordnung(db, "t1", "cx-unbekannt") == (None, None)
    assert sync._objekt_zuordnung(db, "t1", None) == (None, None)


class _RatePlanDb:
    """Stub für `channex_rate_plan_map`-Auflösungen."""

    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen
        self._filter: dict[str, str] = {}
        self.data: list[dict[str, Any]] = []

    def table(self, _name: str) -> "_RatePlanDb":
        self._filter = {}
        return self

    def select(self, *_a: str) -> "_RatePlanDb":
        return self

    def eq(self, feld: str, wert: Any) -> "_RatePlanDb":
        self._filter[feld] = str(wert)
        return self

    def is_(self, _f: str, _w: str) -> "_RatePlanDb":
        return self

    def limit(self, _n: int) -> "_RatePlanDb":
        return self

    def execute(self) -> "_RatePlanDb":
        self.data = [
            z for z in self._zeilen
            if all(str(z.get(k)) == v for k, v in self._filter.items())
        ][:1]
        return self


def test_rate_plan_aus_channex_id() -> None:
    """Channex' aufgelöste ID → unser lokaler Preisplan.

    DER VORFALL (11.08.2026): Channex lieferte bei 68 von 77 Buchungen die
    `rate_plan_id` mit, und alle 226 projizierten Reservierungen trugen trotzdem
    `rate_plan_id = NULL` — die Information wurde verworfen. Damit war nicht
    nachvollziehbar, zu welchem Preis verkauft wurde.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _RatePlanDb([
        {"tenant_id": "t1", "channex_rate_plan_id": "cx-rp-1",
         "local_rate_plan_id": "rp-lokal"},
    ])
    attrs = {"rooms": [{"rate_plan_id": "cx-rp-1"}]}
    assert BookingsSyncMixin()._rate_plan_der_buchung(db, "t1", attrs) == "rp-lokal"


def test_unmapped_rate_ergibt_none_statt_rateversuch() -> None:
    """„Unmapped Rate": kein Plan statt eines geratenen (Wurzel 4).

    Channex schickt dann nur den Portal-Code (`meta.rate_plan_code`). Ihn auf
    „irgendeinen" Plan zu legen wäre schlimmer als die Lücke: der Betrieb sähe
    einen Preis, zu dem nie verkauft wurde.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _RatePlanDb([])
    attrs = {
        "ota_reservation_code": "5318907572",
        "rooms": [{"rate_plan_id": None, "meta": {"rate_plan_code": "47588687"}}],
    }
    assert BookingsSyncMixin()._rate_plan_der_buchung(db, "t1", attrs) is None


def test_airbnb_ohne_portal_code_ist_keine_unmapped_rate() -> None:
    """Airbnb liefert eine aufgelöste ID, aber keinen Portal-Code.

    Die zwei Felder sind UNABHÄNGIG, und das ist der leicht zu ziehende
    Fehlschluss. Live gezählt (77 Buchungen): Airbnb schickt 0 Portal-Codes,
    aber in 16 von 22 Fällen eine `rate_plan_id`. Wer daraus „Airbnb kennt keine
    Rate-Plans" ableitet, hält 16 belegte Zuordnungen für erfunden — genau das
    hätte hier fast zu einer Rücknahme-Migration geführt.

    Also: aufgelöste ID vorhanden → Plan wird geführt, auch ohne Portal-Code.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _RatePlanDb([
        {"tenant_id": "t1", "channex_rate_plan_id": "cx-rp-airbnb",
         "local_rate_plan_id": "rp-lokal"},
    ])
    attrs = {
        "ota_name": "AirBNB",
        "rooms": [{"rate_plan_id": "cx-rp-airbnb", "meta": {}}],
    }
    assert BookingsSyncMixin()._rate_plan_der_buchung(db, "t1", attrs) == "rp-lokal"


def test_buchung_ohne_rooms_ergibt_none() -> None:
    """Kein `rooms` im Payload → nichts aufzulösen, kein Fehler."""
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _RatePlanDb([])
    for attrs in ({}, {"rooms": []}, {"rooms": "kaputt"}):
        assert BookingsSyncMixin()._rate_plan_der_buchung(db, "t1", attrs) is None
