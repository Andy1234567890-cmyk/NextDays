"""Gast-Konto löschen (Apple 5.1.1(v)) — geprüft wird, dass die Hürde hält.

Der Pfad vernichtet ein Konto unwiderruflich. Was schiefgehen kann:

  • Löschung ohne bestandene Passwort-Rückfrage (gekapertes Token, Wurzel 7).
  • Eine GoTrue-STÖRUNG als „Passwort falsch" auszugeben (Wurzel 5) — oder
    umgekehrt eine Störung durchzulassen und trotzdem zu löschen.
  • Auth-Login gelöscht, `portal_guests`-Zeile bleibt (Halbzustand).
  • Löschung ohne Hinweis darauf, dass Buchungen beim Gastgeber bleiben.
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.features.guest_auth.schemas import GuestKontoLoeschenRequest
from src.features.guest_auth.service import GuestAuthError, GuestAuthService

_GAST = "77777777-7777-4777-8777-777777777777"


class _Query:
    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        self._filter: dict[str, Any] = {}
        self._loeschen = False

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        self._filter[spalte] = wert
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def delete(self) -> _Query:
        self._loeschen = True
        return self

    def execute(self) -> Any:
        if self._loeschen:
            self._store["deletes"].append((self._tabelle, dict(self._filter)))
            return type("R", (), {"data": []})()
        rows = self._store["rows"].get(self._tabelle, [])
        if "id" in self._filter:
            rows = [r for r in rows if r.get("id") == self._filter["id"]]
        return type("R", (), {"data": rows})()


class _AuthAdmin:
    def __init__(self, fehler: bool = False) -> None:
        self.geloescht: list[str] = []
        self._fehler = fehler

    def delete_user(self, user_id: str) -> None:
        if self._fehler:
            raise RuntimeError("GoTrue nicht erreichbar")
        self.geloescht.append(user_id)


class _ServiceClient:
    def __init__(self, rows: dict[str, list[dict[str, Any]]], auth_fehler: bool) -> None:
        self.store: dict[str, Any] = {"rows": rows, "deletes": []}
        self.admin = _AuthAdmin(fehler=auth_fehler)
        self.auth = type("A", (), {"admin": self.admin})()

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _AnonAuth:
    """Login-Versuch für die Re-Auth. `modus` steuert das Ergebnis."""

    def __init__(self, modus: str) -> None:
        self._modus = modus

    def sign_in_with_password(self, _daten: dict[str, Any]) -> Any:
        if self._modus == "ok":
            return type("R", (), {"session": object()})()
        if self._modus == "falsch":
            raise GoTrueAuthError("Invalid login credentials", 400)
        if self._modus == "keine_session":
            return type("R", (), {"session": None})()
        # Störung: Zeitüberschreitung des Transports, keine Ablehnung.
        raise httpx.ConnectTimeout("timeout")


class _AnonClient:
    def __init__(self, modus: str) -> None:
        self.auth = _AnonAuth(modus)


class _Ctx:
    def __init__(self, guest_id: str = _GAST) -> None:
        self.guest_id = guest_id


def _dienst(
    modus: str = "ok",
    zeilen: list[dict[str, Any]] | None = None,
    auth_fehler: bool = False,
) -> tuple[GuestAuthService, _ServiceClient]:
    rows = {
        "portal_guests": zeilen
        if zeilen is not None
        else [{"id": _GAST, "email": "gast@example.dk", "name": "Gast"}]
    }
    service = _ServiceClient(rows, auth_fehler)
    svc = GuestAuthService(anon_client=_AnonClient(modus), service_client=service)
    return svc, service


def test_loeschung_entfernt_login_und_zeile() -> None:
    """Erfolgsfall: beides weg, und der Hinweis auf bestehende Buchungen steht da."""
    svc, service = _dienst("ok")

    antwort = svc.konto_loeschen(
        _Ctx(), GuestKontoLoeschenRequest(password=SecretStr("richtig"))
    )

    assert antwort.geloescht is True
    assert "Gastgeber" in antwort.hinweis
    assert service.admin.geloescht == [_GAST]
    assert service.store["deletes"] == [("portal_guests", {"id": _GAST})]


@pytest.mark.parametrize("modus", ["falsch", "keine_session"])
def test_falsches_passwort_loescht_nichts(modus: str) -> None:
    """Ohne bestandene Rückfrage passiert NICHTS (Wurzel 7)."""
    svc, service = _dienst(modus)

    with pytest.raises(GuestAuthError) as exc:
        svc.konto_loeschen(
            _Ctx(), GuestKontoLoeschenRequest(password=SecretStr("falsch"))
        )

    assert exc.value.status_code == 401
    assert service.admin.geloescht == []
    assert service.store["deletes"] == []


def test_stoerung_ist_kein_falsches_passwort() -> None:
    """Ein GoTrue-Ausfall ist 503, nicht 401 — und löscht nichts (Wurzel 5).

    Andernfalls stünde bei jedem Auth-Hänger „Passwort ist falsch" vor dem Gast,
    obwohl sein Passwort stimmt.
    """
    svc, service = _dienst("stoerung")

    with pytest.raises(GuestAuthError) as exc:
        svc.konto_loeschen(
            _Ctx(), GuestKontoLoeschenRequest(password=SecretStr("richtig"))
        )

    assert exc.value.status_code == 503
    assert service.admin.geloescht == []
    assert service.store["deletes"] == []


def test_auth_fehler_laesst_die_zeile_stehen() -> None:
    """Scheitert das Löschen des Logins, bleibt die Zeile — wiederholbar statt
    halb gelöscht."""
    svc, service = _dienst("ok", auth_fehler=True)

    with pytest.raises(GuestAuthError) as exc:
        svc.konto_loeschen(
            _Ctx(), GuestKontoLoeschenRequest(password=SecretStr("richtig"))
        )

    assert exc.value.status_code == 502
    assert service.store["deletes"] == []


def test_ohne_gast_zeile_404() -> None:
    """Kein blindes Löschen, wenn das Profil fehlt: ohne Adresse gibt es keine
    Re-Auth, und ohne Re-Auth keine Löschung (Wurzel 4)."""
    svc, service = _dienst("ok", zeilen=[])

    with pytest.raises(GuestAuthError) as exc:
        svc.konto_loeschen(
            _Ctx(), GuestKontoLoeschenRequest(password=SecretStr("richtig"))
        )

    assert exc.value.status_code == 404
    assert service.admin.geloescht == []
