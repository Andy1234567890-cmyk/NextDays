

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
        {"id": "map-1", "tenant_id": "t1",
         "channex_property_id": "cx-prop-1", "created_at": "2026-01-01"},
    ])
    treffer = BookingsSyncMixin._property_map_id(db, "t1", "cx-prop-1")
    assert treffer == "map-1"


def test_ungemapptes_inserat_blockiert_die_buchung_nicht() -> None:
    """Kein Mapping → None, aber die Buchung wird trotzdem gespeichert.

    Eine OTA-Buchung zu verwerfen, weil ihr Inserat bei uns kein Objekt hat
    (live: 23 solche Airbnb-Inserate), ließe die Nächte frei — Überbuchung. Die
    Zuordnung bleibt leer, statt auf irgendein Objekt zu raten (Wurzel 4).
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    db = _MapTabelle([])
    assert BookingsSyncMixin._property_map_id(db, "t1", "cx-unbekannt") is None
    assert BookingsSyncMixin._property_map_id(db, "t1", None) is None
