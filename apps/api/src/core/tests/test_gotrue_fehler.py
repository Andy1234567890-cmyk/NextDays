"""Tests für die Unterscheidung „Token abgelehnt" vs. „GoTrue gerade kaputt".

Hintergrund (die Ursache der willkürlichen Abmeldungen): `AuthError` ist die
Basisklasse ALLER GoTrue-Fehler. Wer sie pauschal fängt und 401 antwortet,
verwandelt jeden Timeout/5xx in eine Zwangsabmeldung — das BFF wertet 401
definitionsgemäß als „nicht mehr angemeldet" und leitet auf /login um.
"""
import httpx
import pytest
from supabase_auth.errors import (
    AuthApiError,
    AuthInvalidJwtError,
    AuthRetryableError,
    AuthUnknownError,
)

from src.core.gotrue_fehler import TRANSPORT_FEHLER, ist_abgelehnt


@pytest.mark.parametrize("status", [400, 401, 403, 422])
def test_echte_ablehnung_ist_abgelehnt(status: int) -> None:
    """400 = „Invalid Refresh Token: Already Used", 401/403 = abgelehnt."""
    assert ist_abgelehnt(AuthApiError("nope", status, None)) is True


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
def test_technische_fehler_sind_keine_ablehnung(status: int) -> None:
    """Der Auth-Server hat ein Problem — über das Token sagt das nichts."""
    assert ist_abgelehnt(AuthApiError("kaputt", status, None)) is False


def test_retryable_ist_keine_ablehnung() -> None:
    """AuthRetryableError erbt ebenfalls von AuthError und wäre sonst nicht zu
    unterscheiden. Das SDK wirft ihn u. a. bei 502/503/504."""
    assert ist_abgelehnt(AuthRetryableError("netzwerk", 0)) is False


def test_unknown_ist_keine_ablehnung() -> None:
    """Entsteht, wenn die Fehlerantwort nicht auswertbar war (z. B. HTML-
    Fehlerseite eines Proxys davor) — kein Urteil über das Token."""
    assert ist_abgelehnt(AuthUnknownError("murks", ValueError("x"))) is False


def test_kaputtes_jwt_ist_ablehnung() -> None:
    """Fehler ohne Statuscode aus dem lokalen Parsen: das Token ist unbrauchbar."""
    assert ist_abgelehnt(AuthInvalidJwtError("kein jwt")) is True


def test_transport_fehler_deckt_verbindungsabbruch_ab() -> None:
    """supabase-py übersetzt NUR HTTPStatusError/RuntimeError in eine AuthError.
    Ein ConnectError/Timeout fliegt roh aus dem auth-Aufruf heraus, an jedem
    `except GoTrueAuthError` vorbei — und käme ohne diese Klammer als 500 beim
    Nutzer an."""
    for exc in (
        httpx.ConnectError("weg"),
        httpx.ReadTimeout("zu lang"),
        httpx.RemoteProtocolError("abbruch"),
    ):
        assert isinstance(exc, TRANSPORT_FEHLER)
