"""Kanal-Trennung: welcher Vertriebsweg von einer Sperre betroffen ist."""
from src.core.sales_channels import (
    OTA_WILDCARD,
    PLATFORM,
    RECEPTION,
    availability_block_hits_channel,
    is_ota_token,
    stop_sell_blocks_channel,
)


def test_is_ota_token() -> None:
    assert is_ota_token("ota:BookingCom")
    assert is_ota_token(OTA_WILDCARD)
    assert not is_ota_token(PLATFORM)
    assert not is_ota_token(RECEPTION)


def test_stop_sell_scope_all_blocks_every_channel() -> None:
    # Default (scope fehlt) und explizit 'all' sperren alle Kanäle.
    for row in ({}, {"scope": "all"}, {"scope": None}):
        assert stop_sell_blocks_channel(row, PLATFORM)
        assert stop_sell_blocks_channel(row, RECEPTION)
        assert stop_sell_blocks_channel(row, "ota:BookingCom")


def test_stop_sell_scope_channels_only_listed() -> None:
    row = {"scope": "channels", "channels": ["ota:BookingCom"]}
    # Nur Booking gesperrt — Plattform + Rezeption frei.
    assert stop_sell_blocks_channel(row, "ota:BookingCom")
    assert not stop_sell_blocks_channel(row, PLATFORM)
    assert not stop_sell_blocks_channel(row, RECEPTION)
    assert not stop_sell_blocks_channel(row, "ota:AirBNB")


def test_stop_sell_ota_wildcard_hits_all_otas_only() -> None:
    row = {"scope": "channels", "channels": [OTA_WILDCARD]}
    assert stop_sell_blocks_channel(row, "ota:BookingCom")
    assert stop_sell_blocks_channel(row, "ota:AirBNB")
    # Wildcard betrifft NUR OTAs, nicht die internen Wege.
    assert not stop_sell_blocks_channel(row, PLATFORM)
    assert not stop_sell_blocks_channel(row, RECEPTION)


def test_stop_sell_platform_only() -> None:
    row = {"scope": "channels", "channels": [PLATFORM]}
    assert stop_sell_blocks_channel(row, PLATFORM)
    assert not stop_sell_blocks_channel(row, RECEPTION)
    assert not stop_sell_blocks_channel(row, "ota:BookingCom")


def test_availability_portal_block_hits_only_otas() -> None:
    # Der Kern-Fix: eine 'portal'-Sperre (Channex-Import) sperrt NUR OTAs.
    assert availability_block_hits_channel("portal", "ota:BookingCom")
    assert availability_block_hits_channel("portal", OTA_WILDCARD)
    assert not availability_block_hits_channel("portal", PLATFORM)
    assert not availability_block_hits_channel("portal", RECEPTION)


def test_availability_real_block_hits_all_channels() -> None:
    # Echte Belegung/manuelle Sperre/iCal → alle Wege gesperrt (Überbuchungsschutz).
    for src in ("manual", "booking", "airbnb", "ical", None):
        assert availability_block_hits_channel(src, PLATFORM)
        assert availability_block_hits_channel(src, RECEPTION)
        assert availability_block_hits_channel(src, "ota:BookingCom")
