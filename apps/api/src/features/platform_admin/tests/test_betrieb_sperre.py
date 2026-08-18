"""Tests für die Betriebs-Sperre und -Löschung im Backoffice (0405).

Schwerpunkt sind die Stellen, an denen die Sperre real durchgesetzt wird —
nicht das Setzen des Feldes (das ist ein Update), sondern:
  - dass ALLE Nutzer des Betriebs einen GoTrue-Bann bekommen (sonst bleibt der
    Direktpfad `POST /auth/v1/token` mit anon-Key offen, Wurzel 7),
  - dass ein GoTrue-Ausfall den Vorgang nicht als gescheitert meldet, aber auch
    nicht still als vollständig ausgibt (Wurzel 5),
  - dass das Löschen die RESTRICT-Kante `reservations.property_id` in der
    richtigen Reihenfolge auflöst,
  - dass die Tippbestätigung wirklich vergleicht.
"""
from types import SimpleNamespace
from typing import Any

import pytest

from src.core.security import PlatformContext
from src.features.platform_admin.betrieb_sperre import (
    BetriebNameFalsch,
    betrieb_entsperren,
    betrieb_loeschen,
    betrieb_sperren,
)

TENANT = "t-1"


class _Query:  # pylint: disable=too-few-public-methods
    """Kettenbare Abfrage über einer Tabelle des Fake-Clients."""

    def __init__(self, db: "_DB", tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._delete = False
        self._filter: dict[str, Any] = {}

    def select(self, *_a: Any, **_k: Any) -> "_Query":
        return self

    def delete(self, *_a: Any, **_k: Any) -> "_Query":
        self._delete = True
        return self

    def update(self, werte: dict) -> "_Query":
        self._db.updates.append((self._tabelle, werte))
        return self

    def eq(self, feld: str, wert: Any) -> "_Query":
        self._filter[feld] = wert
        return self

    def in_(self, feld: str, werte: list) -> "_Query":
        self._filter[feld] = werte
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def execute(self) -> SimpleNamespace:
        if self._delete:
            self._db.deletes.append((self._tabelle, dict(self._filter)))
            anzahl = len(self._db.tabellen.get(self._tabelle, []))
            self._db.tabellen[self._tabelle] = []
            return SimpleNamespace(data=[], count=anzahl)
        return SimpleNamespace(
            data=list(self._db.tabellen.get(self._tabelle, [])), count=None
        )


class _Admin:  # pylint: disable=too-few-public-methods
    """GoTrue-Admin-Ersatz; zeichnet Bann-Aufrufe auf."""

    def __init__(self, db: "_DB") -> None:
        self._db = db

    def update_user_by_id(self, user_id: str, daten: dict) -> None:
        if user_id in self._db.gotrue_fehler:
            raise RuntimeError("GoTrue nicht erreichbar")
        self._db.banns.append((user_id, daten.get("ban_duration")))

    def delete_user(self, user_id: str) -> None:
        if user_id in self._db.gotrue_fehler:
            raise RuntimeError("GoTrue nicht erreichbar")
        self._db.geloeschte_nutzer.append(user_id)


class _DB:  # pylint: disable=too-few-public-methods
    """Fake-Supabase-Client über festen Tabellen-Inhalten."""

    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen
        self.updates: list[tuple[str, dict]] = []
        self.deletes: list[tuple[str, dict]] = []
        self.banns: list[tuple[str, str | None]] = []
        self.geloeschte_nutzer: list[str] = []
        self.gotrue_fehler: set[str] = set()
        self.auth = SimpleNamespace(admin=_Admin(self))

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _ctx() -> PlatformContext:
    return PlatformContext(
        user_id="admin-1", email="a@b.de", platform_role="platform_admin"
    )


def _db(**over: Any) -> _DB:
    basis: dict[str, list[dict]] = {
        "tenants": [{"id": TENANT, "name": "Testbetrieb", "deactivated_at": None}],
        "users": [{"id": "u-1"}, {"id": "u-2"}],
        "properties": [{"id": "p-1"}, {"id": "p-2"}],
        "reservations": [{"id": "r-1"}],
    }
    basis.update(over)
    return _DB(basis)


def _protokoll(*_a: Any, **_k: Any) -> None:
    """Protokoll-Ersatz: das Audit-Log ist hier nicht der Pruefgegenstand."""


# --------------------------------------------------------------------------
# Sperren
# --------------------------------------------------------------------------


def test_sperren_setzt_feld_und_bannt_alle_nutzer() -> None:
    """Riegel 1 (Feld) und Riegel 2 (GoTrue) greifen fuer JEDEN Nutzer.

    Ein Betrieb hat n Nutzer; bliebe einer ohne Bann, koennte er sich weiter
    direkt gegen GoTrue anmelden.
    """
    db = _db()
    ergebnis = betrieb_sperren(db, _ctx(), TENANT, protokoll=_protokoll, reason="Zahlungsverzug")

    assert ergebnis is not None
    assert ergebnis.betroffene_nutzer == 2
    assert ergebnis.login_gesperrt == 2
    assert ergebnis.deactivation_reason == "Zahlungsverzug"
    assert {u for u, _ in db.banns} == {"u-1", "u-2"}
    tenant_update = [w for t, w in db.updates if t == "tenants"][0]
    assert tenant_update["deactivated_at"] is not None
    assert tenant_update["deactivated_by"] == "admin-1"


def test_sperren_meldet_teilerfolg_wenn_gotrue_ausfaellt() -> None:
    """Faellt GoTrue fuer einen Nutzer aus, ist der Vorgang trotzdem wirksam —
    aber das Ergebnis sagt es (Wurzel 5: kein stilles „done").

    Das Feld steht, und das aktiv_gate haelt den Zugang dicht; offen bliebe
    allein der Direktpfad dieses einen Nutzers. Genau das muss sichtbar sein.
    """
    db = _db()
    db.gotrue_fehler = {"u-2"}
    ergebnis = betrieb_sperren(db, _ctx(), TENANT, protokoll=_protokoll, reason="Missbrauch")

    assert ergebnis is not None
    assert ergebnis.betroffene_nutzer == 2
    assert ergebnis.login_gesperrt == 1


def test_sperren_unbekannter_betrieb_gibt_none() -> None:
    """Kein Betrieb → None (der Router macht daraus 404)."""
    db = _db(tenants=[])
    assert betrieb_sperren(db, _ctx(), TENANT, protokoll=_protokoll, reason="egal") is None


def test_sperren_ist_idempotent() -> None:
    """Doppelklick/Retry aktualisiert, statt zu scheitern (Wurzel 2)."""
    db = _db(
        tenants=[
            {"id": TENANT, "name": "Testbetrieb", "deactivated_at": "2026-08-01"}
        ]
    )
    ergebnis = betrieb_sperren(db, _ctx(), TENANT, protokoll=_protokoll, reason="erneut")
    assert ergebnis is not None
    assert ergebnis.deactivation_reason == "erneut"


# --------------------------------------------------------------------------
# Entsperren
# --------------------------------------------------------------------------


def test_entsperren_raeumt_feld_und_hebt_bann_auf() -> None:
    """Entsperren macht beide Riegel rueckgaengig."""
    db = _db()
    ergebnis = betrieb_entsperren(db, _ctx(), TENANT, protokoll=_protokoll)

    assert ergebnis is not None
    assert ergebnis.deactivated_at is None
    assert ergebnis.login_gesperrt == 2
    assert all(dauer == "none" for _, dauer in db.banns)
    tenant_update = [w for t, w in db.updates if t == "tenants"][0]
    assert tenant_update["deactivated_at"] is None
    assert tenant_update["deactivation_reason"] is None


# --------------------------------------------------------------------------
# Loeschen
# --------------------------------------------------------------------------


def test_loeschen_haelt_die_reihenfolge_ein() -> None:
    """Reservierungen VOR Objekten VOR dem Betrieb.

    `reservations.property_id` ist ON DELETE RESTRICT (0004) — die einzige
    nicht-kaskadierende Kante der Kette. Andere Reihenfolge heisst: das
    Ergebnis haengt an Postgres' Aufloesungsreihenfolge.
    """
    db = _db()
    ergebnis = betrieb_loeschen(
        db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="Testbetrieb"
    )

    assert ergebnis is not None
    reihenfolge = [t for t, _ in db.deletes]
    assert reihenfolge.index("reservations") < reihenfolge.index("properties")
    assert reihenfolge.index("properties") < reihenfolge.index("tenants")


def test_loeschen_entfernt_auth_zugaenge() -> None:
    """`public.users` kaskadiert weg, der GoTrue-Zugang nicht — sonst bliebe
    ein anmeldbarer Login ohne jede Zeile dahinter zurueck."""
    db = _db()
    ergebnis = betrieb_loeschen(
        db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="Testbetrieb"
    )

    assert ergebnis is not None
    assert set(db.geloeschte_nutzer) == {"u-1", "u-2"}
    assert ergebnis.nutzer == 2


def test_loeschen_benennt_was_nicht_mitgeht() -> None:
    """Stripe-Abo und Portal-Waisen stehen im Ergebnis, nicht nur im Kommentar."""
    db = _db()
    ergebnis = betrieb_loeschen(
        db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="Testbetrieb"
    )

    assert ergebnis is not None
    hinweise = " ".join(ergebnis.hinweise).lower()
    assert "stripe" in hinweise
    assert "channex" in hinweise or "portal" in hinweise


def test_loeschen_verlangt_exakten_namen() -> None:
    """Falsch getippt → 422 statt Loeschung."""
    db = _db()
    with pytest.raises(BetriebNameFalsch):
        betrieb_loeschen(
            db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="Testbetrib"
        )
    assert db.deletes == []


def test_loeschen_toleriert_randleerraum() -> None:
    """Fuehrende/abschliessende Leerzeichen sind ein Tippfehler, kein Veto."""
    db = _db()
    ergebnis = betrieb_loeschen(
        db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="  Testbetrieb  "
    )
    assert ergebnis is not None


def test_loeschen_unbekannter_betrieb_gibt_none() -> None:
    db = _db(tenants=[])
    assert (
        betrieb_loeschen(
            db, _ctx(), TENANT, protokoll=_protokoll, name_bestaetigung="x"
        )
        is None
    )
