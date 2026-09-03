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


# ----------------------------------------------------------------------
# Passwort-Reset mit Code (03.09.2026)
# ----------------------------------------------------------------------
def test_reset_prueft_code_bevor_es_das_passwort_setzt() -> None:
    """Die Reihenfolge ist keine Stilfrage.

    `verify_otp` tauscht Code+Adresse gegen eine Sitzung, und erst MIT dieser
    Sitzung darf `update_user` das Passwort setzen. Ein `update_user` ohne
    vorangegangenes `verify_otp` hätte kein Token und würde scheitern.
    """
    from src.features.affiliates.schemas import PartnerPasswortNeu
    from src.features.affiliates.service import AffiliatesService

    ablauf: list[str] = []

    class _Sitzung:
        access_token = "at"
        refresh_token = "rt"

    class _Auth:
        def verify_otp(self, params: dict) -> object:
            ablauf.append(f"verify:{params['type']}:{params['token']}")

            class _R:
                session = _Sitzung()

            return _R()

        def set_session(self, *_a: str) -> None:
            ablauf.append("set_session")

        def update_user(self, attrs: dict) -> None:
            ablauf.append("update_user")
            assert "password" in attrs

        def sign_out(self) -> None:
            ablauf.append("sign_out")

    class _Anon:
        auth = _Auth()

    svc = AffiliatesService.__new__(AffiliatesService)
    svc._anon = _Anon()  # type: ignore[attr-defined]
    svc.login = lambda req: "SESSION"  # type: ignore[assignment]

    ergebnis = svc.passwort_neu_setzen(
        PartnerPasswortNeu(
            email="a@example.com", code="298259", password="geheim1234"
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
    """Der geteilte `_anon`-Client darf keine fremde Anmeldung weitertragen.

    Ohne das `finally` hätte der nächste Aufrufer von `_anon` die Sitzung des
    zurücksetzenden Partners benutzt.
    """
    from src.features.affiliates.schemas import PartnerPasswortNeu
    from src.features.affiliates.service import AffiliateError, AffiliatesService

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

    class _Anon:
        auth = _Auth()

    svc = AffiliatesService.__new__(AffiliatesService)
    svc._anon = _Anon()  # type: ignore[attr-defined]

    with pytest.raises(AffiliateError) as exc:
        svc.passwort_neu_setzen(
            PartnerPasswortNeu(
                email="a@example.com", code="298259", password="geheim1234"
            )
        )
    assert exc.value.status_code == 502
    assert "sign_out" in ablauf, "Sitzung blieb am geteilten Client hängen"


def test_reset_ohne_sitzung_ist_ein_ungueltiger_code() -> None:
    """`verify_otp` ohne Session = Code falsch oder abgelaufen, kein 500."""
    from src.features.affiliates.schemas import PartnerPasswortNeu
    from src.features.affiliates.service import AffiliateError, AffiliatesService

    class _Auth:
        def verify_otp(self, _p: dict) -> object:
            class _R:
                session = None

            return _R()

    class _Anon:
        auth = _Auth()

    svc = AffiliatesService.__new__(AffiliatesService)
    svc._anon = _Anon()  # type: ignore[attr-defined]

    with pytest.raises(AffiliateError) as exc:
        svc.passwort_neu_setzen(
            PartnerPasswortNeu(
                email="a@example.com", code="000000", password="geheim1234"
            )
        )
    assert exc.value.status_code == 400
