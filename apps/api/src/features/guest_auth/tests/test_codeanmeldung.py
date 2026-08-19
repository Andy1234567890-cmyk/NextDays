"""Anmeldung per Einmal-Code — geprüft wird, was den Gast oder uns kosten würde.

Der Weg ist der EINZIGE Zugang zum Bezahlen in der App (Airbnb-Reihenfolge:
anmelden → zahlen). Was hier schiefgehen kann:

  • **Kontenaufzählung**: Wenn eine unbekannte Adresse anders antwortet als eine
    bekannte, hat jeder eine Liste unserer Gäste (Antworttext, Status, Fehler).
  • **Auth-Störung als Erfolg**: „Code verschickt" bei ausgefallenem GoTrue
    lässt den Gast auf eine Mail warten, die nie kommt (Wurzel 5).
  • **Doppelter Auth-User**: Zwei Code-Anfragen für dieselbe neue Adresse
    dürfen kein zweites Konto anlegen (Wurzel 2).
  • **Falscher Code als Anmeldung**: ein abgelehnter Code MUSS 401 sein, nie
    eine Session.
  • **Fremde Zeile schreiben**: Schritt 3 darf ausschließlich die eigene
    `portal_guests`-Zeile anfassen (guest_id aus dem Token, Wurzel 3/9).
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest
from supabase_auth.errors import AuthApiError
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.mail import MailError
from src.core.security import GuestContext
from src.features.guest_auth.codeanmeldung import GuestCodeService
from src.features.guest_auth.schemas import (
    GuestCodeAnfrageRequest,
    GuestCodePruefenRequest,
    GuestProfilAnlegenRequest,
)
from src.features.guest_auth.service import GuestAuthError

_GAST = "77777777-7777-4777-8777-777777777777"
_MAIL = "gast@example.com"


# --- Fakes ------------------------------------------------------------------


class _Query:
    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        self._filter: dict[str, Any] = {}
        self._upsert: dict[str, Any] | None = None

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        self._filter[spalte] = wert
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def upsert(self, zeile: dict[str, Any], **_k: Any) -> _Query:
        self._upsert = zeile
        return self

    def execute(self) -> Any:
        if self._upsert is not None:
            self._store["upserts"].append((self._tabelle, dict(self._upsert)))
            return type("R", (), {"data": [dict(self._upsert)]})()
        rows = self._store["rows"].get(self._tabelle, [])
        for spalte, wert in self._filter.items():
            rows = [r for r in rows if r.get(spalte) == wert]
        return type("R", (), {"data": rows})()


class _Eigenschaften:
    def __init__(self, code: str) -> None:
        self.email_otp = code


class _LinkAntwort:
    def __init__(self, code: str) -> None:
        self.properties = _Eigenschaften(code)


class _Admin:
    """`generate_link`. `fehler` = Exception, die geworfen wird."""

    def __init__(self, code: str = "123456", fehler: Exception | None = None) -> None:
        self.aufrufe: list[dict[str, Any]] = []
        self._code = code
        self._fehler = fehler

    def generate_link(self, params: dict[str, Any]) -> _LinkAntwort:
        self.aufrufe.append(dict(params))
        if self._fehler is not None:
            raise self._fehler
        return _LinkAntwort(self._code)


class _ServiceClient:
    def __init__(
        self,
        rows: dict[str, list[dict[str, Any]]] | None = None,
        admin: _Admin | None = None,
    ) -> None:
        self.store: dict[str, Any] = {"rows": rows or {}, "upserts": []}
        self.admin = admin or _Admin()
        self.auth = type("A", (), {"admin": self.admin})()

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _Session:
    def __init__(self, user_id: str) -> None:
        self.access_token = "at"  # noqa: S105 — Testwert
        self.refresh_token = "rt"  # noqa: S105 — Testwert
        self.expires_in = 3600
        self.user = type("U", (), {"id": user_id})()


class _AnonAuth:
    """`verify_otp`. `gueltig` = Code, der akzeptiert wird."""

    def __init__(
        self,
        gueltig: str | None = "123456",
        stoerung: bool = False,
        user_id: str = _GAST,
    ) -> None:
        self.versuche: list[dict[str, Any]] = []
        self._gueltig = gueltig
        self._stoerung = stoerung
        self._user_id = user_id

    def verify_otp(self, params: dict[str, Any]) -> Any:
        self.versuche.append(dict(params))
        if self._stoerung:
            # AuthApiError MIT Status — nur daran erkennt `ist_abgelehnt` einen
            # 5xx als Störung. Ein nackter AuthError ohne Status gilt (richtig)
            # als Ablehnung.
            raise AuthApiError("Internal Server Error", 500, None)
        if self._gueltig is not None and params["token"] == self._gueltig:
            return type("R", (), {"session": _Session(self._user_id)})()
        raise GoTrueAuthError("Token has expired or is invalid", 403)


class _AnonClient:
    def __init__(self, auth: _AnonAuth) -> None:
        self.auth = auth


class _Mail:
    def __init__(self, fehler: bool = False) -> None:
        self.gesendet: list[Any] = []
        self._fehler = fehler

    def send(self, msg: Any) -> None:
        if self._fehler:
            raise MailError("SMTP tot")
        self.gesendet.append(msg)


def _dienst(
    *,
    rows: dict[str, list[dict[str, Any]]] | None = None,
    admin: _Admin | None = None,
    anon_auth: _AnonAuth | None = None,
    mail: _Mail | None = None,
) -> tuple[GuestCodeService, _ServiceClient, _Mail]:
    service_client = _ServiceClient(rows=rows, admin=admin)
    mailer = mail or _Mail()
    dienst = GuestCodeService(
        anon_client=_AnonClient(anon_auth or _AnonAuth()),  # type: ignore[arg-type]
        service_client=service_client,  # type: ignore[arg-type]
        mail=mailer,  # type: ignore[arg-type]
    )
    return dienst, service_client, mailer


# --- 1. Code anfordern ------------------------------------------------------


def test_unbekannte_adresse_bekommt_signup_code() -> None:
    """Neue Adresse → Signup-Link (der Auth-User entsteht dabei)."""
    dienst, client, mail = _dienst()
    dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert client.admin.aufrufe[0]["type"] == "signup"
    # Signup verlangt ein Passwort; es MUSS zufällig sein, nicht ratbar.
    assert len(client.admin.aufrufe[0]["password"]) >= 20
    assert len(mail.gesendet) == 1
    assert "123456" in mail.gesendet[0].subject


def test_bekannte_adresse_bekommt_magiclink_code() -> None:
    """Vorhandener Gast → Magiclink, KEIN zweites Konto (Wurzel 2)."""
    dienst, client, mail = _dienst(
        rows={"portal_guests": [{"id": _GAST, "email": _MAIL, "name": "Ida"}]}
    )
    dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert client.admin.aufrufe[0]["type"] == "magiclink"
    assert "password" not in client.admin.aufrufe[0]
    assert len(mail.gesendet) == 1


def test_signup_gegen_bestehende_adresse_faellt_auf_magiclink() -> None:
    """Rennen zweier Anfragen: „already registered" → Magiclink statt Fehler."""

    class _Wechselnd(_Admin):
        def generate_link(self, params: dict[str, Any]) -> _LinkAntwort:
            self.aufrufe.append(dict(params))
            if params["type"] == "signup":
                raise GoTrueAuthError("User already registered", 422)
            return _LinkAntwort("654321")

    admin = _Wechselnd()
    dienst, _client, mail = _dienst(admin=admin)
    dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert [a["type"] for a in admin.aufrufe] == ["signup", "magiclink"]
    assert "654321" in mail.gesendet[0].subject


def test_antwort_ist_fuer_bekannt_und_unbekannt_identisch() -> None:
    """Kein Existenz-Leak: derselbe Text, egal ob das Konto existiert."""
    dienst_neu, _c1, _m1 = _dienst()
    dienst_alt, _c2, _m2 = _dienst(
        rows={"portal_guests": [{"id": _GAST, "email": _MAIL, "name": "Ida"}]}
    )
    a = dienst_neu.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    b = dienst_alt.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert a.message == b.message


def test_mailversand_kaputt_bleibt_neutral() -> None:
    """Ein SMTP-Fehler darf die Existenz nicht verraten (nur Log, gleiche Antwort)."""
    dienst, _client, _mail = _dienst(mail=_Mail(fehler=True))
    antwort = dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert "Code" in antwort.message


def test_gotrue_stoerung_wird_503() -> None:
    """Ausfall ist KEIN „Code verschickt" — sonst wartet der Gast auf nichts."""
    admin = _Admin(fehler=httpx.ConnectError("keine Verbindung"))
    dienst, _client, _mail = _dienst(admin=admin)
    with pytest.raises(GuestAuthError) as exc:
        dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL))
    assert exc.value.status_code == 503


def test_mailsprache_folgt_dem_locale() -> None:
    """Die Code-Mail kommt in der Sprache des Geräts, nicht auf Deutsch."""
    dienst, _client, mail = _dienst()
    dienst.code_anfordern(GuestCodeAnfrageRequest(email=_MAIL, locale="da"))
    assert "Din login-kode" in mail.gesendet[0].subject


# --- 2. Code prüfen ---------------------------------------------------------


def test_richtiger_code_gibt_session_und_meldet_fehlendes_profil() -> None:
    """Erstanmeldung: Session ja, aber `profil_fehlt` — der Name fehlt noch."""
    dienst, _client, _mail = _dienst(anon_auth=_AnonAuth(gueltig="123456"))
    res = dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="123456"))
    assert res.access_token == "at"
    assert res.profil_fehlt is True


def test_vorhandenes_profil_meldet_kein_fehlen() -> None:
    dienst, _client, _mail = _dienst(
        rows={"portal_guests": [{"id": _GAST, "email": _MAIL, "name": "Ida"}]},
        anon_auth=_AnonAuth(gueltig="123456"),
    )
    res = dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="123456"))
    assert res.profil_fehlt is False


def test_profil_ohne_namen_gilt_als_fehlend() -> None:
    """Eine Zeile ohne Namen ist kein Profil: der Gastgeber braucht den Namen."""
    dienst, _client, _mail = _dienst(
        rows={"portal_guests": [{"id": _GAST, "email": _MAIL, "name": "  "}]},
        anon_auth=_AnonAuth(gueltig="123456"),
    )
    res = dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="123456"))
    assert res.profil_fehlt is True


def test_leerzeichen_im_code_werden_ignoriert() -> None:
    """Aus der Mail kopierte Codes tragen oft Leerzeichen."""
    dienst, _client, _mail = _dienst(anon_auth=_AnonAuth(gueltig="123456"))
    res = dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="123 456"))
    assert res.access_token == "at"


def test_falscher_code_ist_401_und_keine_session() -> None:
    auth = _AnonAuth(gueltig="123456")
    dienst, _client, _mail = _dienst(anon_auth=auth)
    with pytest.raises(GuestAuthError) as exc:
        dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="000000"))
    assert exc.value.status_code == 401
    # Alle Typen wurden versucht — die App weiß nicht, ob es ein Signup- oder
    # ein Magiclink-Code ist (und darf es nicht wissen).
    assert [v["type"] for v in auth.versuche] == ["magiclink", "signup", "email"]


def test_stoerung_beim_pruefen_ist_503_nicht_401() -> None:
    """Ein 500 von GoTrue ist keine Ablehnung des Codes (Wurzel 5)."""
    dienst, _client, _mail = _dienst(anon_auth=_AnonAuth(stoerung=True))
    with pytest.raises(GuestAuthError) as exc:
        dienst.code_pruefen(GuestCodePruefenRequest(email=_MAIL, code="123456"))
    assert exc.value.status_code == 503


# --- 3. Profil nachtragen ---------------------------------------------------


def test_profil_anlegen_schreibt_nur_die_eigene_zeile() -> None:
    dienst, client, _mail = _dienst()
    ctx = GuestContext(guest_id=_GAST, email=_MAIL)
    profil = dienst.profil_anlegen(
        ctx, GuestProfilAnlegenRequest(name=" Ida Iversen ", phone=" +45 12 ")
    )
    tabelle, zeile = client.store["upserts"][0]
    assert tabelle == "portal_guests"
    # Die id kommt AUS DEM TOKEN, nicht aus der Anfrage (Wurzel 3/9).
    assert zeile["id"] == _GAST
    assert zeile["email"] == _MAIL
    assert zeile["name"] == "Ida Iversen"
    assert zeile["phone"] == "+45 12"
    assert profil.name == "Ida Iversen"


def test_profil_anlegen_ohne_namen_ist_422() -> None:
    dienst, _client, _mail = _dienst()
    ctx = GuestContext(guest_id=_GAST, email=_MAIL)
    with pytest.raises(GuestAuthError) as exc:
        dienst.profil_anlegen(ctx, GuestProfilAnlegenRequest(name="   "))
    assert exc.value.status_code == 422


def test_profil_anlegen_ist_wiederholbar() -> None:
    """Zweiter Aufruf (Doppeltipp, Retry) legt keine zweite Zeile an."""
    dienst, client, _mail = _dienst()
    ctx = GuestContext(guest_id=_GAST, email=_MAIL)
    dienst.profil_anlegen(ctx, GuestProfilAnlegenRequest(name="Ida"))
    dienst.profil_anlegen(ctx, GuestProfilAnlegenRequest(name="Ida"))
    ids = {zeile["id"] for _t, zeile in client.store["upserts"]}
    assert ids == {_GAST}
