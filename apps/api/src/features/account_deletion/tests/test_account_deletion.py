"""Löschantrag über die öffentliche Seite (0413) — der Schutz ist der Prüfgegenstand.

Die Seite MUSS öffentlich sein (Play-Store-Pflicht: erreichbar ohne App und ohne
Login). Damit ist sie angreifbar, und genau diese Angriffe stehen hier:

  • Fremde Adresse eintragen → darf KEINEN wirksamen Antrag erzeugen.
  • Antwort verrät, ob ein Konto existiert → E-Mail-Enumeration.
  • Zweite Mail auf Zuruf → Mail-Fluten fremder Postfächer.
  • Link mehrfach klicken / abgelaufener Link / fremder Token.
  • Mailversand scheitert → Antrag darf NICHT als gestellt gelten.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from src.core.mail import MailError
from src.features.account_deletion.schemas import LoeschantragRequest
from src.features.account_deletion.service import (
    NEUTRAL,
    AccountDeletionService,
    LoeschantragError,
    _hash,
)

_TABELLE = "account_deletion_requests"
_USER = "44444444-4444-4444-8444-444444444444"
_TENANT = "55555555-5555-4555-8555-555555555555"


class _Query:
    """Minimaler Supabase-Stub: feste Zeilen je Tabelle, merkt Schreibzugriffe."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        self._filter: dict[str, Any] = {}

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        self._filter[spalte] = wert
        return self

    def in_(self, spalte: str, werte: list[Any]) -> _Query:
        self._filter[spalte] = werte
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def insert(self, payload: dict[str, Any]) -> _Query:
        self._store["inserts"].append((self._tabelle, payload))
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        # Nur vormerken: die `.eq(...)`-Aufrufe kommen NACH `update()`, der
        # Filter ist hier also noch leer. Festgehalten wird bei `execute()`.
        self._ausstehend = payload
        return self

    def execute(self) -> Any:
        if getattr(self, "_ausstehend", None) is not None:
            self._store["updates"].append(
                (self._tabelle, self._ausstehend, dict(self._filter))
            )
            self._ausstehend = None
            return type("R", (), {"data": []})()
        rows = self._store["rows"].get(self._tabelle, [])
        # Token-Suche nachbilden: nur passende Zeilen zurückgeben.
        if "confirm_token_hash" in self._filter:
            rows = [
                r for r in rows
                if r.get("confirm_token_hash") == self._filter["confirm_token_hash"]
            ]
        if "email" in self._filter:
            rows = [r for r in rows if r.get("email") == self._filter["email"]]
        if "status" in self._filter and isinstance(self._filter["status"], list):
            rows = [r for r in rows if r.get("status") in self._filter["status"]]
        return type("R", (), {"data": rows})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.store: dict[str, Any] = {
            "rows": rows or {},
            "inserts": [],
            "updates": [],
        }

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _Mail:
    """Mail-Stub. `fehler=True` lässt den Versand scheitern."""

    def __init__(self, fehler: bool = False) -> None:
        self.gesendet: list[Any] = []
        self._fehler = fehler

    def send(self, msg: Any) -> None:
        if self._fehler:
            raise MailError("Postfach nicht erreichbar")
        self.gesendet.append(msg)


class _Settings:
    marketing_base_url = "https://mynextdays.com"


def _service(
    rows: dict[str, list[dict[str, Any]]] | None = None, mail_fehler: bool = False
) -> tuple[AccountDeletionService, _Db, _Mail]:
    db = _Db(rows)
    mail = _Mail(fehler=mail_fehler)
    svc = AccountDeletionService(db=db, mail=mail, settings=_Settings())
    return svc, db, mail


# -- Der eigentliche Schutz ---------------------------------------------------


def test_fremde_adresse_erzeugt_keinen_wirksamen_antrag() -> None:
    """DER Kernschutz: ein Antrag auf eine fremde Adresse bleibt `pending`.

    Wer die Adresse eines anderen Betriebs eintippt, erreicht damit NICHT die
    Löschung — die Zeile entsteht im Zustand `pending`, und wirksam wird sie
    erst durch einen Klick auf den Link, der ausschließlich im Postfach des
    ECHTEN Inhabers landet.
    """
    svc, db, mail = _service(
        {"users": [{"id": _USER, "tenant_id": _TENANT, "email": "x@example.com"}]}
    )

    svc.beantragen(LoeschantragRequest(email="fremder-betrieb@example.com"))

    (tabelle, payload) = db.store["inserts"][0]
    assert tabelle == _TABELLE
    assert payload["status"] == "pending", "Antrag darf NIE sofort wirksam sein"
    assert payload["confirmed_at"] is None
    # Die Mail geht an die eingetippte Adresse — also an den echten Inhaber,
    # der damit gewarnt ist.
    assert mail.gesendet[0].to == "fremder-betrieb@example.com"


def test_mail_enthaelt_die_warnung_fuer_den_echten_inhaber() -> None:
    """Der Satz, der den Angriff zur Warnung macht, MUSS in der Mail stehen."""
    svc, _db, mail = _service()

    svc.beantragen(LoeschantragRequest(email="inhaber@example.com", locale="de"))

    text = mail.gesendet[0].text
    assert "nicht gestellt hast" in text
    assert "unverändert" in text
    # Und der Hinweis, dass eine Adresse allein nichts bewirkt.
    assert "allein mit einer E-Mail-Adresse" in text


def test_antwort_verraet_nicht_ob_ein_konto_existiert() -> None:
    """Gleiche Antwort mit und ohne Konto — sonst ist das Formular ein
    Prüfwerkzeug, mit dem man unsere Kundenliste abfragt."""
    mit, _, _ = _service(
        {"users": [{"id": _USER, "tenant_id": _TENANT, "email": "kunde@example.com"}]}
    )
    ohne, _, _ = _service({"users": []})

    a = mit.beantragen(LoeschantragRequest(email="kunde@example.com"))
    b = ohne.beantragen(LoeschantragRequest(email="niemand@example.com"))

    assert a.detail == b.detail == NEUTRAL


def test_zweite_anfrage_in_der_sperrzeit_schickt_keine_zweite_mail() -> None:
    """Sonst ist das öffentliche Formular ein Mailversender gegen fremde
    Postfächer."""
    gerade = datetime.now(UTC).isoformat()
    svc, db, mail = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "opfer@example.com",
                    "status": "pending",
                    "confirm_sent_at": gerade,
                }
            ]
        }
    )

    antwort = svc.beantragen(LoeschantragRequest(email="opfer@example.com"))

    assert antwort.detail == NEUTRAL
    assert mail.gesendet == [], "keine zweite Mail innerhalb der Sperrzeit"
    assert db.store["updates"] == [], "und auch kein neuer Token"


def test_bereits_bestaetigter_antrag_loest_keine_neue_mail_aus() -> None:
    svc, db, mail = _service(
        {
            _TABELLE: [
                {"id": "a1", "email": "kunde@example.com", "status": "confirmed"}
            ]
        }
    )

    antwort = svc.beantragen(LoeschantragRequest(email="kunde@example.com"))

    assert antwort.detail == NEUTRAL
    assert mail.gesendet == []
    assert db.store["inserts"] == []


# -- Bestätigung --------------------------------------------------------------


def test_bestaetigung_setzt_confirmed_und_verbraucht_den_token() -> None:
    token = "geheim-token-mit-genug-laenge"
    frist = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    svc, db, _mail = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "kunde@example.com",
                    "status": "pending",
                    "confirm_token_hash": _hash(token),
                    "confirm_expires_at": frist,
                }
            ],
            "users": [
                {"id": _USER, "tenant_id": _TENANT, "email": "kunde@example.com"}
            ],
        }
    )

    antwort = svc.bestaetigen(token)

    assert antwort.bestaetigt is True
    (_t, payload, filt) = db.store["updates"][0]
    assert payload["status"] == "confirmed"
    # Einmal-Token: nach der Bestätigung ist er weg.
    assert payload["confirm_token_hash"] is None
    assert payload["confirm_expires_at"] is None
    # Zuordnung zum gefundenen Konto.
    assert payload["matched_user_id"] == _USER
    assert payload["matched_tenant_id"] == _TENANT
    # Claim-Guard: nur aus `pending` heraus (Wurzel 2).
    assert filt.get("status") == "pending"


def test_bestaetigung_ohne_konto_ordnet_nichts_zu() -> None:
    """Kein Treffer heißt NULL — kein geratener Wert (Wurzel 4)."""
    token = "token-ohne-passendes-konto"
    frist = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    svc, db, _mail = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "niemand@example.com",
                    "status": "pending",
                    "confirm_token_hash": _hash(token),
                    "confirm_expires_at": frist,
                }
            ],
            "users": [],
        }
    )

    svc.bestaetigen(token)

    (_t, payload, _f) = db.store["updates"][0]
    assert payload["matched_user_id"] is None
    assert payload["matched_tenant_id"] is None
    assert payload["status"] == "confirmed", "Antrag gilt trotzdem als gestellt"


def test_unbekannter_token_wird_abgewiesen() -> None:
    svc, _db, _mail = _service({_TABELLE: []})

    with pytest.raises(LoeschantragError) as exc:
        svc.bestaetigen("voellig-erfundener-token-x")

    assert exc.value.status_code == 400


def test_abgelaufener_token_wird_abgewiesen() -> None:
    token = "abgelaufener-token-hier"
    vorbei = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    svc, db, _mail = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "kunde@example.com",
                    "status": "pending",
                    "confirm_token_hash": _hash(token),
                    "confirm_expires_at": vorbei,
                }
            ]
        }
    )

    with pytest.raises(LoeschantragError):
        svc.bestaetigen(token)

    assert db.store["updates"] == [], "abgelaufen darf nichts schreiben"


def test_abgelaufen_und_unbekannt_sehen_gleich_aus() -> None:
    """Sonst wird der Link zum Prüfwerkzeug: „gab es diesen Antrag?""" ""
    token = "abgelaufener-token-hier"
    vorbei = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    alt, _, _ = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "k@example.com",
                    "status": "pending",
                    "confirm_token_hash": _hash(token),
                    "confirm_expires_at": vorbei,
                }
            ]
        }
    )
    leer, _, _ = _service({_TABELLE: []})

    with pytest.raises(LoeschantragError) as e1:
        alt.bestaetigen(token)
    with pytest.raises(LoeschantragError) as e2:
        leer.bestaetigen("ein-anderer-langer-token")

    assert e1.value.detail == e2.value.detail
    assert e1.value.status_code == e2.value.status_code


def test_zweiter_klick_ist_kein_fehler_aber_auch_keine_zweite_bestaetigung() -> None:
    """Der Link liegt in einem Postfach und wird real mehrfach geklickt
    (Vorschau, Virenscanner, Nutzer) — Wurzel 2."""
    token = "schon-benutzt-token-lang"
    frist = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    svc, db, _mail = _service(
        {
            _TABELLE: [
                {
                    "id": "a1",
                    "email": "kunde@example.com",
                    "status": "confirmed",
                    "confirm_token_hash": _hash(token),
                    "confirm_expires_at": frist,
                }
            ]
        }
    )

    antwort = svc.bestaetigen(token)

    assert antwort.bestaetigt is False
    assert db.store["updates"] == []


# -- Fehlerpfade --------------------------------------------------------------


def test_scheiternder_mailversand_laesst_den_antrag_nicht_als_gestellt_gelten() -> None:
    """Fail-closed (Wurzel 5): ohne Mail gibt es keinen Bestätigungsweg, also
    darf der Aufrufer keine Erfolgsmeldung bekommen."""
    svc, _db, _mail = _service(mail_fehler=True)

    with pytest.raises(LoeschantragError) as exc:
        svc.beantragen(LoeschantragRequest(email="kunde@example.com"))

    assert exc.value.status_code == 502


def test_ohne_marketing_basis_kein_antrag() -> None:
    """Ein Link ohne Basis-URL wäre kaputt — dann lieber klar fehlschlagen
    als eine Mail mit unbrauchbarem Link zu verschicken (Wurzel 4)."""

    class _Leer:
        marketing_base_url = ""

    db, mail = _Db(), _Mail()
    svc = AccountDeletionService(db=db, mail=mail, settings=_Leer())

    with pytest.raises(LoeschantragError) as exc:
        svc.beantragen(LoeschantragRequest(email="kunde@example.com"))

    assert exc.value.status_code == 503
    assert mail.gesendet == []
    assert db.store["inserts"] == [], "nichts gespeichert, bevor der Link steht"


def test_grund_wird_gekappt() -> None:
    """Freitext aus öffentlicher Quelle bekommt eine harte Obergrenze
    (Wurzel 8)."""
    svc, db, _mail = _service()

    svc.beantragen(
        LoeschantragRequest(email="kunde@example.com", grund="x" * 1999)
    )

    (_t, payload) = db.store["inserts"][0]
    assert len(payload["reason"]) <= 2000


def test_email_wird_normalisiert() -> None:
    """Sonst umgeht „Kunde@Example.com " den UNIQUE-Backstop aus 0413."""
    svc, db, _mail = _service()

    svc.beantragen(LoeschantragRequest(email="  Kunde@Example.COM  "))

    (_t, payload) = db.store["inserts"][0]
    assert payload["email"] == "kunde@example.com"
