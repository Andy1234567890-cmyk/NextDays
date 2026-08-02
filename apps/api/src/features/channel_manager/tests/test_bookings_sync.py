

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
