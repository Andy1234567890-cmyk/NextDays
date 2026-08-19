"""Konto-Löschung aus der App (Apple 5.1.1(v)) — geprüft wird die WEICHE.

Der Weg ist angemeldet, also fällt der Enumerations- und Fremdadressen-Schutz des
öffentlichen Formulars weg. Was hier schiefgehen kann, ist anderes:

  • Ohne Passwort-Rückfrage vernichtet ein gekapertes Token ein Konto (Wurzel 7).
  • Der Kontoinhaber löscht sich selbst und nimmt den Betrieb samt Belegen mit
    (Aufbewahrungspflicht) — es MUSS ein Antrag daraus werden, keine Löschung.
  • Ein Mitarbeiter bekommt einen Antrag statt der sofortigen Löschung und
    wartet auf etwas, das niemand bearbeiten muss.
  • Der Auth-Login wird gelöscht, die Nutzerzeile bleibt (oder umgekehrt) — der
    Halbzustand mit funktionierendem Login.
  • Zweimal tippen erzeugt zwei Anträge (Wurzel 2).
"""
from __future__ import annotations

from typing import Any

import pytest
from pydantic import SecretStr

from src.features.account_deletion.in_app import (
    AUFBEWAHRUNG_HINWEIS,
    InAppLoeschung,
)
from src.features.account_deletion.service import LoeschantragError

_TABELLE = "account_deletion_requests"
_ADMIN = "11111111-1111-4111-8111-111111111111"
_STAFF = "22222222-2222-4222-8222-222222222222"
_TENANT = "33333333-3333-4333-8333-333333333333"


class _Query:
    """Minimaler Supabase-Stub: feste Zeilen je Tabelle, merkt Schreibzugriffe."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        self._filter: dict[str, Any] = {}
        self._ausstehend: dict[str, Any] | None = None
        self._loeschen = False

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
        self._ausstehend = payload
        return self

    def delete(self) -> _Query:
        self._loeschen = True
        return self

    def execute(self) -> Any:
        if self._ausstehend is not None:
            self._store["updates"].append(
                (self._tabelle, self._ausstehend, dict(self._filter))
            )
            self._ausstehend = None
            return type("R", (), {"data": []})()
        if self._loeschen:
            self._store["deletes"].append((self._tabelle, dict(self._filter)))
            return type("R", (), {"data": []})()
        rows = self._store["rows"].get(self._tabelle, [])
        if "id" in self._filter:
            rows = [r for r in rows if r.get("id") == self._filter["id"]]
        if "matched_user_id" in self._filter:
            rows = [
                r
                for r in rows
                if r.get("matched_user_id") == self._filter["matched_user_id"]
            ]
        if isinstance(self._filter.get("status"), list):
            rows = [r for r in rows if r.get("status") in self._filter["status"]]
        return type("R", (), {"data": rows})()


class _AuthAdmin:
    """Löscht Auth-Logins. `fehler=True` lässt GoTrue scheitern."""

    def __init__(self, fehler: bool = False) -> None:
        self.geloescht: list[str] = []
        self._fehler = fehler

    def delete_user(self, user_id: str) -> None:
        if self._fehler:
            raise RuntimeError("GoTrue nicht erreichbar")
        self.geloescht.append(user_id)


class _Db:
    def __init__(
        self,
        rows: dict[str, list[dict[str, Any]]] | None = None,
        auth_fehler: bool = False,
    ) -> None:
        self.store: dict[str, Any] = {
            "rows": rows or {},
            "inserts": [],
            "updates": [],
            "deletes": [],
        }
        self.admin = _AuthAdmin(fehler=auth_fehler)
        self.auth = type("A", (), {"admin": self.admin})()

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _Konto:
    """AccountService-Stub: nur die Passwort-Rückfrage.

    `passwort_falsch=True` wirft wie das Original mit 401; damit ist prüfbar,
    dass die Löschung dann NICHT läuft.
    """

    def __init__(self, passwort_falsch: bool = False) -> None:
        self.geprueft = 0
        self._falsch = passwort_falsch

    def passwort_pruefen(self, _ctx: Any, _passwort: SecretStr) -> None:
        self.geprueft += 1
        if self._falsch:
            raise LoeschantragError("Aktuelles Passwort ist falsch.", status_code=401)


class _Ctx:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id


def _dienst(
    rolle: str = "admin",
    user_id: str = _ADMIN,
    antraege: list[dict[str, Any]] | None = None,
    passwort_falsch: bool = False,
    auth_fehler: bool = False,
) -> tuple[InAppLoeschung, _Db, _Konto]:
    rows = {
        "users": [
            {
                "id": user_id,
                "tenant_id": _TENANT,
                "email": "chef@example.dk",
                "role": rolle,
            }
        ],
        _TABELLE: antraege or [],
    }
    db = _Db(rows, auth_fehler=auth_fehler)
    konto = _Konto(passwort_falsch=passwort_falsch)
    return InAppLoeschung(db=db, account_service=konto), db, konto


# -- Die Weiche ---------------------------------------------------------------


def test_kontoinhaber_bekommt_antrag_und_keine_loeschung() -> None:
    """DER Kernfall: am Admin-Konto hängt der Betrieb — es wird NICHT gelöscht.

    Sofortlöschung würde Buchungen, Rechnungen und Auszahlungen mitnehmen und
    die Aufbewahrungspflicht verletzen. Die Antwort muss das auch SAGEN:
    `geloescht=False` plus der Aufbewahrungs-Hinweis.
    """
    dienst, db, _ = _dienst(rolle="admin")

    antwort = dienst.loeschen(_Ctx(_ADMIN), passwort=SecretStr("geheim"))

    assert antwort["geloescht"] is False
    assert antwort["antrag_offen"] is True
    assert antwort["hinweis"] == AUFBEWAHRUNG_HINWEIS
    # Kein Auth-Login gelöscht, keine users-Zeile entfernt.
    assert db.admin.geloescht == []
    assert db.store["deletes"] == []
    # Genau ein Antrag, und zwar direkt bestätigt (Login beweist das Postfach).
    inserts = [p for (t, p) in db.store["inserts"] if t == _TABELLE]
    assert len(inserts) == 1
    assert inserts[0]["status"] == "confirmed"
    assert inserts[0]["matched_user_id"] == _ADMIN
    assert inserts[0]["matched_tenant_id"] == _TENANT


@pytest.mark.parametrize("rolle", ["co_admin", "staff", "cleaner", "owner"])
def test_mitarbeiter_wird_sofort_geloescht(rolle: str) -> None:
    """Wer nicht Kontoinhaber ist, ist sofort weg — kein Antrag, auf den niemand
    wartet. Am Zugang selbst hängt kein Beleg."""
    dienst, db, _ = _dienst(rolle=rolle, user_id=_STAFF)

    antwort = dienst.loeschen(_Ctx(_STAFF), passwort=SecretStr("geheim"))

    assert antwort["geloescht"] is True
    assert antwort["antrag_offen"] is False
    assert db.admin.geloescht == [_STAFF]
    # Die users-Zeile wird tenant-gescoped entfernt (Wurzel 3).
    assert db.store["deletes"] == [
        ("users", {"id": _STAFF, "tenant_id": _TENANT})
    ]
    assert [p for (t, p) in db.store["inserts"] if t == _TABELLE] == []


# -- Die Hürde ----------------------------------------------------------------


def test_falsches_passwort_loescht_nichts() -> None:
    """Ohne bestandene Passwort-Rückfrage passiert NICHTS (Wurzel 7).

    Ein gekapertes Session-Token allein darf kein Konto vernichten können.
    """
    dienst, db, konto = _dienst(rolle="staff", user_id=_STAFF, passwort_falsch=True)

    with pytest.raises(LoeschantragError) as exc:
        dienst.loeschen(_Ctx(_STAFF), passwort=SecretStr("falsch"))

    assert exc.value.status_code == 401
    assert konto.geprueft == 1
    assert db.admin.geloescht == []
    assert db.store["deletes"] == []
    assert db.store["inserts"] == []


def test_passwort_wird_vor_jedem_pfad_geprueft() -> None:
    """Auch der Antrags-Pfad (Admin) läuft nur nach der Rückfrage — sonst wäre
    die Hürde für den folgenschwereren Fall die schwächere."""
    dienst, _, konto = _dienst(rolle="admin")
    dienst.loeschen(_Ctx(_ADMIN), passwort=SecretStr("geheim"))
    assert konto.geprueft == 1


# -- Kein Halbzustand ---------------------------------------------------------


def test_auth_fehler_laesst_die_nutzerzeile_stehen() -> None:
    """Scheitert das Löschen des Logins, bleibt die Zeile — der Vorgang ist
    wiederholbar. Andernfalls entstünde eine Zeile ohne Login oder ein Login
    ohne Zeile, und niemand käme mehr an das Konto."""
    dienst, db, _ = _dienst(rolle="staff", user_id=_STAFF, auth_fehler=True)

    with pytest.raises(LoeschantragError) as exc:
        dienst.loeschen(_Ctx(_STAFF), passwort=SecretStr("geheim"))

    assert exc.value.status_code == 502
    assert db.store["deletes"] == []


# -- Doppelte Aufrufe (Wurzel 2) ----------------------------------------------


def test_zweiter_antrag_legt_keinen_zweiten_an() -> None:
    """Zweimal tippen ergibt EINEN Antrag. Der Teil-UNIQUE aus 0413 wäre der
    Backstop, aber ein Fehler im Gesicht des Nutzers ist keine Antwort."""
    vorhanden = [
        {
            "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "status": "confirmed",
            "matched_user_id": _ADMIN,
            "requested_at": "2026-08-01T10:00:00+00:00",
            "confirmed_at": "2026-08-01T10:00:00+00:00",
        }
    ]
    dienst, db, _ = _dienst(rolle="admin", antraege=vorhanden)

    antwort = dienst.loeschen(_Ctx(_ADMIN), passwort=SecretStr("geheim"))

    assert antwort["antrag_offen"] is True
    assert antwort["beantragt_am"] == "2026-08-01T10:00:00+00:00"
    assert [p for (t, p) in db.store["inserts"] if t == _TABELLE] == []


# -- Status und Rücknahme -----------------------------------------------------


def test_status_zeigt_offenen_antrag() -> None:
    """Die App muss den Zustand kennen, um nicht denselben Knopf erneut
    anzubieten."""
    vorhanden = [
        {
            "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "status": "confirmed",
            "matched_user_id": _ADMIN,
            "requested_at": "2026-08-02T08:00:00+00:00",
            "confirmed_at": "2026-08-02T09:00:00+00:00",
        }
    ]
    dienst, _, _ = _dienst(rolle="admin", antraege=vorhanden)

    stand = dienst.status(_Ctx(_ADMIN))

    assert stand["antrag_offen"] is True
    # Der Bestätigungszeitpunkt gewinnt: das ist der Moment, ab dem der Antrag
    # wirklich zählt.
    assert stand["beantragt_am"] == "2026-08-02T09:00:00+00:00"


def test_status_ohne_antrag_ist_leer() -> None:
    dienst, _, _ = _dienst(rolle="admin")
    stand = dienst.status(_Ctx(_ADMIN))
    assert stand == {"antrag_offen": False, "beantragt_am": None, "hinweis": None}


def test_ruecknahme_schliesst_mit_pflicht_begruendung() -> None:
    """Zurückziehen setzt `rejected` — und der Trigger aus 0413 verlangt dort
    eine Begründung. Ohne sie schlüge das Update in der Live-DB fehl."""
    vorhanden = [
        {
            "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "status": "confirmed",
            "matched_user_id": _ADMIN,
            "requested_at": "2026-08-03T08:00:00+00:00",
            "confirmed_at": "2026-08-03T08:30:00+00:00",
        }
    ]
    dienst, db, _ = _dienst(rolle="admin", antraege=vorhanden)

    stand = dienst.antrag_zuruecknehmen(_Ctx(_ADMIN))

    assert stand["antrag_offen"] is False
    updates = [(p, f) for (t, p, f) in db.store["updates"] if t == _TABELLE]
    assert len(updates) == 1
    payload, _filter = updates[0]
    assert payload["status"] == "rejected"
    assert payload["resolution_note"].strip() != ""


def test_ruecknahme_ohne_antrag_ist_404() -> None:
    """Kein stilles „ok" für etwas, das es nicht gibt."""
    dienst, _, _ = _dienst(rolle="admin")
    with pytest.raises(LoeschantragError) as exc:
        dienst.antrag_zuruecknehmen(_Ctx(_ADMIN))
    assert exc.value.status_code == 404


def test_ohne_nutzerzeile_kein_blindes_loeschen() -> None:
    """Fehlt die users-Zeile, ist die Rolle unbekannt — und die Rolle entscheidet
    über Sofortlöschung oder Antrag. Kein Fallback (Wurzel 4)."""
    db = _Db({"users": [], _TABELLE: []})
    dienst = InAppLoeschung(db=db, account_service=_Konto())

    with pytest.raises(LoeschantragError) as exc:
        dienst.loeschen(_Ctx(_ADMIN), passwort=SecretStr("geheim"))

    assert exc.value.status_code == 404
    assert db.admin.geloescht == []
