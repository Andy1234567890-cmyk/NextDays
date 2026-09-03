"""Bewerbung mit einer E-Mail, die schon ein PMS-Konto hat (03.09.2026).

DER LIVE-FALL: a.staudinger32@icloud.com hatte ein EIGENTÜMER-Konto des
Betriebs AirSmil (`auth.users`, `role: owner`, `tenant_id: a25577cf…`) und
KEINE Partner-Bewerbung (`public.affiliates` leer für diese Adresse). Die
Bewerbung scheiterte an GoTrues `users_email_partial_key UNIQUE (email)`, und
das Formular meldete „Für diese E-Mail gibt es bereits eine Bewerbung. Melden
Sie sich im Partner-Dashboard an." — dort gab es nichts.

Der Nutzer hat den Punkt benannt: *„die e-mail adresse gibt es noch nicht im
Partner modul !! das modul hat nichts mit anderen tenants zutun"*. Genau so
ist es fachlich — technisch teilen aber beide Welten EINE `auth.users`, und
dort ist die E-Mail eindeutig. Deshalb wird das bestehende Konto um die
Partner-Kennung ERWEITERT, statt die Bewerbung abzulehnen.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.features.affiliates.service import AffiliateError, AffiliatesService


class _Nutzer:
    def __init__(self, uid: str, email: str) -> None:
        self.id = uid
        self.email = email


class _Admin:
    """GoTrue-Admin-Attrappe.

    ``bestehend`` sind die Adressen, die es schon gibt — ``create_user`` wirft
    für sie denselben Text wie GoTrue („User already registered").
    """

    def __init__(self, bestehend: dict[str, str]) -> None:
        self.bestehend = dict(bestehend)
        self.meta: dict[str, dict[str, Any]] = {}
        self.geloescht: list[str] = []
        self.angelegt: list[str] = []

    def create_user(self, daten: dict[str, Any]) -> Any:
        email = str(daten["email"])
        if email.casefold() in {e.casefold() for e in self.bestehend}:
            raise RuntimeError("User already registered")
        uid = f"neu-{len(self.angelegt) + 1}"
        self.angelegt.append(uid)
        self.bestehend[email] = uid

        class _Res:
            user = _Nutzer(uid, email)

        return _Res()

    def list_users(self) -> list[_Nutzer]:
        return [_Nutzer(uid, mail) for mail, uid in self.bestehend.items()]

    def update_user_by_id(self, uid: str, daten: dict[str, Any]) -> None:
        # Supabase MERGT app_metadata — die Attrappe muss das nachbilden, sonst
        # prüft der Test etwas anderes als die Produktion tut.
        vorhanden = dict(self.meta.get(uid, {}))
        for k, v in (daten.get("app_metadata") or {}).items():
            if v is None:
                vorhanden.pop(k, None)
            else:
                vorhanden[k] = v
        self.meta[uid] = vorhanden

    def delete_user(self, uid: str) -> None:
        self.geloescht.append(uid)


class _Auth:
    def __init__(self, admin: _Admin) -> None:
        self.admin = admin


class _DB:
    def __init__(self, admin: _Admin) -> None:
        self.auth = _Auth(admin)


def _svc(admin: _Admin) -> AffiliatesService:
    svc = AffiliatesService.__new__(AffiliatesService)
    svc._db = _DB(admin)  # type: ignore[attr-defined]
    return svc


def test_bestehendes_konto_wird_partner_konto_statt_abgelehnt() -> None:
    """Der gemeldete Fall: PMS-Konto vorhanden, Bewerbung muss durchgehen."""
    admin = _Admin({"a.staudinger32@icloud.com": "7ed5efbc"})
    admin.meta["7ed5efbc"] = {"tenant_id": "a25577cf", "role": "owner"}
    svc = _svc(admin)

    uid, neu = svc._login_konto_sichern(  # type: ignore[attr-defined]
        "a.staudinger32@icloud.com", _Secret("geheim1234")
    )

    assert uid == "7ed5efbc", "die bestehende auth.uid() muss weiterverwendet werden"
    assert neu is False, "kein neues Konto — das würde ein Rollback löschen"
    assert admin.meta["7ed5efbc"]["affiliate"] is True
    # Der Kern: die PMS-Welt bleibt unangetastet (Wurzel 1).
    assert admin.meta["7ed5efbc"]["tenant_id"] == "a25577cf"
    assert admin.meta["7ed5efbc"]["role"] == "owner"
    assert admin.geloescht == []


def test_neue_adresse_legt_ein_konto_an() -> None:
    """Der Normalfall bleibt unverändert."""
    admin = _Admin({})
    svc = _svc(admin)

    uid, neu = svc._login_konto_sichern(  # type: ignore[attr-defined]
        "neu@example.com", _Secret("geheim1234")
    )

    assert neu is True
    assert uid in admin.angelegt


def test_rollback_loescht_ein_bestandskonto_NICHT() -> None:
    """Ein fehlgeschlagener Insert darf kein fremdes PMS-Konto löschen.

    Ohne diese Unterscheidung hätte `_rollback_auth_user` das Eigentümer-Konto
    gelöscht, mit dem sich derselbe Mensch im PMS anmeldet — wegen eines
    Fehlers beim Anlegen der Bewerbungszeile.
    """
    admin = _Admin({"owner@example.com": "u-1"})
    admin.meta["u-1"] = {"tenant_id": "t-1", "role": "owner", "affiliate": True}
    svc = _svc(admin)

    svc._rollback_login_konto("u-1", neu_angelegt=False)  # type: ignore[attr-defined]

    assert admin.geloescht == [], "Bestandskonto wurde gelöscht"
    assert "affiliate" not in admin.meta["u-1"], "Partner-Kennung nicht entfernt"
    assert admin.meta["u-1"]["tenant_id"] == "t-1", "PMS-Zugang beschädigt"


def test_rollback_loescht_ein_neu_angelegtes_konto() -> None:
    """Beim Normalfall bleibt das Rollback ein Löschen."""
    admin = _Admin({})
    svc = _svc(admin)

    svc._rollback_login_konto("neu-1", neu_angelegt=True)  # type: ignore[attr-defined]

    assert admin.geloescht == ["neu-1"]


def test_technischer_fehler_wird_nicht_als_konto_konflikt_gedeutet() -> None:
    """Ein Netzfehler darf keine Aussage über ein bestehendes Konto erzeugen.

    Fail-safe (Wurzel 5): erkennt `_ist_email_vergeben` den Text nicht, gibt es
    502 statt einer Behauptung, die der Bewerber nicht überprüfen kann.
    """

    class _Kaputt(_Admin):
        def create_user(self, _daten: dict[str, Any]) -> Any:
            raise RuntimeError("Connection refused")

    admin = _Kaputt({})
    svc = _svc(admin)

    with pytest.raises(AffiliateError) as exc:
        svc._login_konto_sichern("x@example.com", _Secret("geheim1234"))  # type: ignore[attr-defined]
    assert exc.value.status_code == 502


class _Secret:
    """Minimaler SecretStr-Ersatz — der Service ruft nur `get_secret_value`."""

    def __init__(self, wert: str) -> None:
        self._wert = wert

    def get_secret_value(self) -> str:
        return self._wert
