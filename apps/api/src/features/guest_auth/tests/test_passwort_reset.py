"""Gast-Passwort-Reset mit Code (03.09.2026).

DER LIVE-FALL: Der Marktplatz versprach dem Gast einen „Link zum
Zurücksetzen" — und der Link zeigte auf ``{API_EXTERNAL_URL}/verify?token=…``.
Kong veröffentlicht GoTrue aber unter ``/auth/v1/`` (``strip_path: true``):
gemessen gibt ``/auth/v1/verify?token=x&type=recovery`` 303 und ``/verify?…``
404 („no Route matched"). Zusätzlich lief ``reset_password_email`` ohne
``redirect_to``, sodass GoTrue auf seine ``GOTRUE_SITE_URL`` zurückfiel — die
zeigt auf die Supabase-Adresse, die ebenfalls 404 gibt.

Der Reset war damit an ZWEI Stellen live im Einsatz (Marktplatz-Website und
Marktplatz-App) und funktionierte an keiner: es gab weder einen erreichbaren
Link noch eine Seite, die ein neues Passwort setzt.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.features.guest_auth.schemas import GuestPasswortNeuRequest
from src.features.guest_auth.service import GuestAuthError, GuestAuthService


def _svc(auth: Any) -> GuestAuthService:
    class _Anon:
        pass

    anon = _Anon()
    anon.auth = auth  # type: ignore[attr-defined]
    svc = GuestAuthService.__new__(GuestAuthService)
    svc._anon = anon  # type: ignore[attr-defined]
    return svc


def test_reset_prueft_code_bevor_es_das_passwort_setzt() -> None:
    """Die Reihenfolge ist keine Stilfrage.

    ``verify_otp`` tauscht Code+Adresse gegen eine Sitzung, und erst MIT
    dieser Sitzung darf ``update_user`` das Passwort setzen. Ein
    ``update_user`` ohne vorangegangenes ``verify_otp`` hätte kein Token.
    """
    ablauf: list[str] = []

    class _Auth:
        def verify_otp(self, params: dict) -> object:
            ablauf.append(f"verify:{params['type']}:{params['token']}")

            class _R:
                class session:  # noqa: N801
                    access_token = "at"
                    refresh_token = "rt"

            return _R()

        def set_session(self, *_a: str) -> None:
            ablauf.append("set_session")

        def update_user(self, attrs: dict) -> None:
            ablauf.append("update_user")
            assert "password" in attrs

        def sign_out(self) -> None:
            ablauf.append("sign_out")

    svc = _svc(_Auth())
    svc.login = lambda req: "SESSION"  # type: ignore[assignment]

    ergebnis = svc.passwort_neu_setzen(
        GuestPasswortNeuRequest(
            email="gast@example.com", code="298259", password="geheim1234"
        )
    )

    assert ergebnis == "SESSION"
    assert ablauf == [
        "verify:recovery:298259",
        "set_session",
        "update_user",
        "sign_out",
    ], f"falsche Reihenfolge: {ablauf}"


def test_reset_raeumt_die_sitzung_auch_im_fehlerfall_ab() -> None:
    """Der geteilte ``_anon``-Client darf keine fremde Anmeldung weitertragen.

    Ohne das ``finally`` hätte der nächste Aufrufer von ``_anon`` die Sitzung
    des zurücksetzenden Gastes benutzt — auf einem Marktplatz mit vielen
    gleichzeitigen Besuchern ist das kein theoretischer Fall.
    """
    ablauf: list[str] = []

    class _Auth:
        def verify_otp(self, _p: dict) -> object:
            class _R:
                class session:  # noqa: N801
                    access_token = "at"
                    refresh_token = "rt"

            return _R()

        def set_session(self, *_a: str) -> None:
            ablauf.append("set_session")

        def update_user(self, _a: dict) -> None:
            raise RuntimeError("GoTrue kaputt")

        def sign_out(self) -> None:
            ablauf.append("sign_out")

    svc = _svc(_Auth())

    with pytest.raises(GuestAuthError) as exc:
        svc.passwort_neu_setzen(
            GuestPasswortNeuRequest(
                email="gast@example.com", code="298259", password="geheim1234"
            )
        )
    assert exc.value.status_code == 502
    assert "sign_out" in ablauf, "Sitzung blieb am geteilten Client hängen"


def test_reset_ohne_sitzung_ist_ein_ungueltiger_code() -> None:
    """``verify_otp`` ohne Session = Code falsch oder abgelaufen, kein 500.

    Kein Existenz-Leak (Wurzel 9): ein falscher Code und eine unbekannte
    Adresse ergeben dieselbe Meldung.
    """

    class _Auth:
        def verify_otp(self, _p: dict) -> object:
            class _R:
                session = None

            return _R()

    svc = _svc(_Auth())

    with pytest.raises(GuestAuthError) as exc:
        svc.passwort_neu_setzen(
            GuestPasswortNeuRequest(
                email="gast@example.com", code="000000", password="geheim1234"
            )
        )
    assert exc.value.status_code == 400


def test_reset_mail_traegt_das_rueckspringziel() -> None:
    """``redirect_to`` MUSS mitgehen, sonst landet der Gast auf der 404-Seite.

    Ohne die Angabe nimmt GoTrue seine ``GOTRUE_SITE_URL``, und die zeigt im
    Stack auf die Supabase-Adresse — live gemessen 404. Der Gast bekam eine
    Mail, die einen Link versprach und ins Nichts führte.
    """
    from src.features.guest_auth.schemas import GuestPasswordResetRequest

    gesehen: dict[str, Any] = {}

    class _Auth:
        def reset_password_email(
            self, email: str, options: dict | None = None
        ) -> None:
            gesehen["email"] = email
            gesehen["options"] = options

    svc = _svc(_Auth())
    svc.password_reset(GuestPasswordResetRequest(email="gast@example.com"))

    ziel = (gesehen.get("options") or {}).get("redirect_to")
    assert ziel, "kein redirect_to übergeben — die Mail führt ins Nichts"
    assert ziel.endswith("/passwort-neu"), ziel
