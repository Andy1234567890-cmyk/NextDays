"""Reine Tests für die Airbnb-OAuth-Helfer (DB-/Client-frei)."""
import pytest

from src.features.channel_manager import airbnb_oauth


def test_connection_settings_defaults() -> None:
    """Standard ist der BRUTTObetrag — der Geldpfad rechnet damit.

    Vorher stand hier „Payout Amount" (Betrag NACH Abzug der Airbnb-Host-Fee),
    während `bookings_sync` denselben Wert als Bruttobetrag verbucht: als
    `paid_amount` („der Gast hat das bezahlt"), als Grundlage unserer Provision
    und als Wert, von dem Portalgebühren erst noch abgezogen werden. Damit wurde
    die Host-Fee doppelt abgezogen und unsere Provision zu niedrig fakturiert.
    Airbnb erlaubt beide Werte — wir müssen den bestellen, der zur Buchhaltung
    passt.
    """
    s = airbnb_oauth.connection_settings(None)
    assert s["booking_amount_settings"] == "Total Paid Amount"
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


def test_unbekannte_betragsart_wird_abgewiesen() -> None:
    """Ein Tippfehler hier entscheidet über JEDEN Buchungsbetrag des Kanals."""
    with pytest.raises(ValueError, match="booking_amount_settings"):
        airbnb_oauth.connection_settings({"booking_amount_settings": "Netto"})


def test_unbekannter_min_stay_typ_wird_abgewiesen() -> None:
    """Airbnb kennt nur „Arrival" und „Through" — „both" gibt es dort nicht."""
    with pytest.raises(ValueError, match="min_stay_type"):
        airbnb_oauth.connection_settings({"min_stay_type": "both"})


def test_benachrichtigung_ohne_mail_ist_ein_fehler() -> None:
    """Airbnb: `email` ist Pflicht, sobald Benachrichtigungen an sind.

    Fail-closed (Wurzel 5) statt einer Verbindung, die Channex still ablehnt.
    """
    with pytest.raises(ValueError, match="E-Mail"):
        airbnb_oauth.connection_settings({"send_email_notifications": True})
