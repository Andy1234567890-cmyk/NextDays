"""Tests der Schloss-Gebühr (0574).

Der Schwerpunkt liegt auf den Fehlern, die BEIM KUNDEN AUF DER RECHNUNG
landen — dort merkt er sie vor uns:

* Ein zweiter Lauf darf keine zweite Gebühr erzeugen (Wurzel 2). Ohne den
  UNIQUE-Backstop belastet ein Retry den Betrieb doppelt.
* Ohne bekannte Währung oder ohne Preis in dieser Währung entsteht KEINE
  Zeile — lieber eine Gebühr verlieren als einen geschätzten Betrag stellen
  (Wurzel 4).
* Geräte an einer getrennten Verbindung kosten nichts: sie kosten uns bei
  Seam auch nichts mehr.
"""
from __future__ import annotations

import pathlib
from datetime import date

from src.features.affiliates.tests.fakedb import FakeDb
from src.features.subscriptions.schemas import SCHLOSS_PREIS_JE_GERAET
from src.features.subscriptions.schloesser_gebuehr import (
    SchloesserGebuehrMixin,
    _monatsanfang,
)

_TENANT = "t1"
_MONAT = date(2026, 9, 1)


class _Dienst(SchloesserGebuehrMixin):
    """Nur das Mixin, ohne Stripe — die Erfassung braucht es nicht."""

    def __init__(self, db: FakeDb) -> None:
        self._db = db


def _daten(db: FakeDb, *, waehrung: str | None = "EUR", verbunden: bool = True) -> None:
    db.rows.setdefault("seam_connection", []).extend([
        {
            "id": "c1",
            "tenant_id": _TENANT,
            "status": "connected" if verbunden else "disconnected",
        },
    ])
    db.rows.setdefault("seam_device", []).extend([
        {
            "id": "d1",
            "tenant_id": _TENANT,
            "seam_device_id": "seam-d1",
            "connection_id": "c1",
        },
    ])
    if waehrung is not None:
        # `tenants`, nicht `tenant_billing_profile`: dort gibt es die Spalte
        # `currency` nicht. Die FakeDb nahm den erfundenen Namen an, der echte
        # Aufruf warf 42703 (10.09.2026, db-spalten-pruefen.py).
        db.rows.setdefault("tenants", []).extend([
            {"id": _TENANT, "currency": waehrung},
        ])


def test_gebuehr_wird_erfasst() -> None:
    db = FakeDb()
    _daten(db)
    bilanz = _Dienst(db).erfasse_schloss_gebuehren(_MONAT)
    assert bilanz == {"geraete": 1, "erfasst": 1, "uebersprungen": 0}
    zeile = db.rows["schloesser_ledger"][0]
    assert zeile["betrag"] == SCHLOSS_PREIS_JE_GERAET["EUR"]
    assert zeile["currency"] == "EUR"
    assert zeile["status"] == "pending"
    assert zeile["monat"] == "2026-09-01"


def test_zweiter_lauf_erzeugt_keine_zweite_gebuehr() -> None:
    """Der teuerste denkbare Fehler: doppelte Belastung des Kunden.

    Die FakeDb bildet die UNIQUE-Bedingung aus 0574 nach; der Insert läuft in
    den Konflikt und wird als „gab es schon" gewertet.
    """
    db = FakeDb()
    _daten(db)
    dienst = _Dienst(db)
    dienst.erfasse_schloss_gebuehren(_MONAT)
    zweite = dienst.erfasse_schloss_gebuehren(_MONAT)
    assert zweite["erfasst"] == 0
    assert len(db.rows["schloesser_ledger"]) == 1


def test_getrenntes_konto_kostet_nichts() -> None:
    """Ein Gerät an einer getrennten Verbindung kostet uns bei Seam nichts."""
    db = FakeDb()
    _daten(db, verbunden=False)
    bilanz = _Dienst(db).erfasse_schloss_gebuehren(_MONAT)
    assert bilanz["erfasst"] == 0
    assert db.rows.get("schloesser_ledger", []) == []


def test_ohne_waehrung_keine_gebuehr() -> None:
    """Kein Betrag ohne Währung, kein angenommener Kurs (Wurzel 4)."""
    db = FakeDb()
    _daten(db, waehrung=None)
    bilanz = _Dienst(db).erfasse_schloss_gebuehren(_MONAT)
    assert bilanz["erfasst"] == 0
    assert db.rows.get("schloesser_ledger", []) == []


def test_unbekannte_waehrung_keine_gebuehr() -> None:
    """Eine Währung ohne festgelegten Preis wird NICHT umgerechnet."""
    db = FakeDb()
    _daten(db, waehrung="JPY")
    bilanz = _Dienst(db).erfasse_schloss_gebuehren(_MONAT)
    assert bilanz["erfasst"] == 0
    assert db.rows.get("schloesser_ledger", []) == []


def test_storno_nimmt_nur_offene_zeilen_zurueck() -> None:
    """Eine fakturierte Zeile bleibt — sie steht auf einer echten Rechnung."""
    db = FakeDb()
    _daten(db)
    dienst = _Dienst(db)
    dienst.erfasse_schloss_gebuehren(_MONAT)
    db.rows["schloesser_ledger"][0]["status"] = "invoiced"
    dienst.storniere_schloss_gebuehr(
        _TENANT, seam_device_id="seam-d1", monat=_MONAT
    )
    assert db.rows["schloesser_ledger"][0]["status"] == "invoiced"


def test_storno_offener_zeile() -> None:
    db = FakeDb()
    _daten(db)
    dienst = _Dienst(db)
    dienst.erfasse_schloss_gebuehren(_MONAT)
    dienst.storniere_schloss_gebuehr(
        _TENANT, seam_device_id="seam-d1", monat=_MONAT
    )
    assert db.rows["schloesser_ledger"][0]["status"] == "cancelled"


def test_monatsanfang_normalisiert() -> None:
    assert _monatsanfang(date(2026, 9, 17)) == date(2026, 9, 1)


def test_preis_ist_in_allen_waehrungen_positiv() -> None:
    """Ein Preis von 0 wäre eine stille Gratisleistung."""
    assert SCHLOSS_PREIS_JE_GERAET
    for waehrung, betrag in SCHLOSS_PREIS_JE_GERAET.items():
        assert len(waehrung) == 3, waehrung
        assert betrag > 0, waehrung


# =========================================================================
# Der Tick: Wiederholung nach Fehlschlag
# =========================================================================
def test_fehlgeschlagener_zugang_wird_wiederholt() -> None:
    """Der Zweck des 72-Stunden-Vorlaufs ist das Wiederholfenster.

    Die erste Fassung filterte nur auf `status = geplant`. Ein Zugang, dessen
    erster Versuch scheiterte (Schloss offline, Speicher voll), wurde damit
    NIE wieder versucht — der Gast reiste ohne Code an. Gefunden im Review,
    nicht vom Test: deshalb steht der Test jetzt hier.
    """
    from datetime import UTC, datetime, timedelta

    from src.jobs.schloesser_tick import SchloesserTick

    db = FakeDb()
    bald = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    db.rows.setdefault("reservations", []).extend([
        {"id": "r1", "tenant_id": _TENANT, "property_id": "p1"},
    ])
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": None,
            "status": "fehlgeschlagen",
            "status_grund": "Schloss war offline",
            "starts_at": bald,
            "ends_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        },
    ])
    tick = SchloesserTick(db)
    # Nur die Auswahl prüfen — der Anlegepfad braucht Seam und ist in
    # test_schloesser.py abgedeckt.
    offen = (
        db.table("seam_zugang")
        .select("id, status")
        .in_("status", ["geplant", "fehlgeschlagen"])
        .execute()
    ).data
    assert [z["id"] for z in offen] == ["zg1"]
    # Und er ist fällig: Vorlauf 72 h, Beginn in 2 Stunden.
    assert tick._ist_faellig(  # noqa: SLF001
        {"starts_at": bald, "reservation_id": "r1"}, datetime.now(UTC)
    )


def test_nicht_faellige_zeilen_verbrauchen_keine_plaetze() -> None:
    """Starvation-Schutz: die Obergrenze zählt ANGELEGTE, nicht geprüfte.

    Würde `limit(25)` vor der Fälligkeitsprüfung greifen, könnten 25
    noch-nicht-fällige Zeilen alle Plätze belegen — der Lauf legte dauerhaft
    nichts an, obwohl fällige Zugänge warten.
    """
    from src.jobs import schloesser_tick

    quelle = pathlib.Path(schloesser_tick.__file__).read_text()
    # Die Grenze steht NACH der Schleifen-Eröffnung, nicht in der Query.
    assert "_MAX_JE_LAUF * 8" in quelle
    assert "if gezaehlt >= _MAX_JE_LAUF:" in quelle
