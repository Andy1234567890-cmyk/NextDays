

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


def test_payment_method_nimmt_nur_dokumentierte_werte() -> None:
    """Zahlungsart: nur credit_card und bank_transfer, sonst None."""
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin as S

    assert S._payment_method({"payment_type": "credit_card"}) == "credit_card"
    assert S._payment_method({"payment_type": "bank_transfer"}) == "bank_transfer"
    assert S._payment_method({"payment_type": "krypto"}) is None
    assert S._payment_method({"payment_type": None}) is None
