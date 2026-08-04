"""Reine Tests für die Airbnb-OAuth-Helfer (DB-/Client-frei)."""
from src.features.channel_manager import airbnb_oauth


def test_connection_settings_defaults() -> None:
    s = airbnb_oauth.connection_settings(None)
    assert s["booking_amount_settings"] == "Payout Amount"
    assert s["min_stay_type"] == "Arrival"
    assert s["cohost_payout_calculations"] is False
    assert s["send_email_notifications"] is False
    assert "email" not in s  # kein erfundener Wert


def test_connection_settings_overrides() -> None:
    s = airbnb_oauth.connection_settings(
        {
            "booking_amount_settings": "Total Paid Amount",
            "min_stay_type": "Through",
            "cohost_payout_calculations": True,
            "send_email_notifications": True,
            "email": "host@example.com",
        }
    )
    assert s["booking_amount_settings"] == "Total Paid Amount"
    assert s["min_stay_type"] == "Through"
    assert s["cohost_payout_calculations"] is True
    assert s["email"] == "host@example.com"


def test_connection_link_body_shape() -> None:
    body = airbnb_oauth.connection_link_body(
        group_id="g", channex_property_id="p", channel_id="c",
        request_id="r", title="Mein Airbnb", settings=None,
    )
    assert body["group_id"] == "g"
    assert body["properties"] == ["p"]
    assert body["channel_id"] == "c"
    assert body["title"] == "Mein Airbnb"
    assert body["settings"]["min_stay_type"] == "Arrival"


def test_connection_link_request_id_ist_nicht_die_channel_id() -> None:
    """Regression: `request_id` und `channel_id` sind ZWEI verschiedene Werte.

    Vorher stand in beiden Feldern die Kanal-ID. Folge live: Airbnb führte
    "Channex" als verbundenen Dienst, aber KEIN Channex-Kanal erhielt Tokens
    (`settings: []` bei allen vier Kanälen des Kontos) — die Autorisierung war
    keinem Versuch zuordenbar. Channex' eigene Maske erzeugt je Versuch eine
    frische UUID und vergleicht sie mit der `request_id` der
    `channel_created`-Rückmeldung."""
    body = airbnb_oauth.connection_link_body(
        group_id="g", channex_property_id="p", channel_id="c",
        request_id="r", title="T", settings=None,
    )
    assert body["request_id"] == "r"
    assert body["request_id"] != body["channel_id"]


def test_parse_status_settings_leer_nennt_abgebrochene_autorisierung() -> None:
    """`settings == {}`: Channex hat den Kanal angefasst, aber es kamen keine
    Tokens → die Autorisierung wurde abgebrochen/abgelehnt. Das muss einen
    GRUND liefern; vorher stand hier `last_error: None`, und die UI zeigte
    endlos „warte auf Bestätigung"."""
    st = airbnb_oauth.parse_connection_status(
        {"data": {"attributes": {"settings": {}}}}
    )
    assert st["connected"] is False
    assert st["host_id"] is None
    assert "nicht abgeschlossen" in st["last_error"]


def test_parse_status_settings_fehlt_nennt_fremde_software() -> None:
    """`settings is None` ist ein ANDERER Zustand: Channex hat den Kanal seit
    der Anlage nie angefasst — die Autorisierung kam dort nie an."""
    st = airbnb_oauth.parse_connection_status({"data": {"attributes": {}}})
    assert st["connected"] is False
    assert "andere Software" in st["last_error"]


def test_parse_status_connected() -> None:
    st = airbnb_oauth.parse_connection_status(
        {"data": {"attributes": {"settings": {"tokens": {"user_id": "H1"}}}}}
    )
    assert st["connected"] is True
    assert st["host_id"] == "H1"
    assert st["last_error"] is None


def test_parse_status_token_invalid() -> None:
    st = airbnb_oauth.parse_connection_status(
        {"data": {"attributes": {"settings": {
            "tokens": {"user_id": "H1"}, "token_invalid": True,
        }}}}
    )
    assert st["connected"] is False  # Token ungültig → nicht verbunden
    assert st["host_id"] == "H1"
    assert st["last_error"]


def test_parse_status_empty_channel() -> None:
    # Robust gegen fehlende data/attributes (kein Crash).
    assert airbnb_oauth.parse_connection_status({})["connected"] is False
