"""Tests des Portal-Bewertungs-Spiegels (channex_review).

Der Channex-Account ist KONTOWEIT (white-label, ein Konto für alle Mandanten).
Eine Bewertung ohne belegbare Objekt-Zuordnung darf deshalb bei keinem Betrieb
landen — das ist der Kern hier. Dazu die Zeitstempel-Behandlung: Channex
liefert UTC ohne Zonen-Suffix, ungeprüft übernommen verschiebt sich jede
Bewertung um Stunden.
"""
from __future__ import annotations

from src.features.channel_manager.common import nur_uuids
from src.features.channel_manager.reviews_sync import (
    ReviewsSyncMixin,
    _as_float,
    _as_utc,
    _booking_ref,
)
from src.features.reviews.tests.fake_db import FakeDB

TENANT_A = "t-a"
TENANT_B = "t-b"
# Echte UUIDs: `nur_uuids` sortiert alles andere aus, bevor es an Channex geht.
CX_A = "030dcf25-2c39-4833-aecd-d49b77037c19"
CX_B = "15451b8b-7f74-41a7-bae2-d03205e4fe1a"
CX_FREMD = "30ff2257-47e3-42c4-8180-da56f8d0f56d"


class _Channex:
    """Nur die zwei Aufrufe, die der Spiegel macht."""

    def __init__(self, seiten: list[list[dict]], einzeln: dict | None = None) -> None:
        self._seiten = seiten
        self._einzeln = einzeln or {}
        self.calls = 0

    def list_reviews(self, **_k: object) -> dict:
        seite = self._seiten[self.calls] if self.calls < len(self._seiten) else []
        self.calls += 1
        return {"data": seite}

    def get_review(self, review_id: str) -> dict:
        return {"data": self._einzeln.get(review_id, {})}


class _Sync(ReviewsSyncMixin):
    """Der Mixin ohne die Fassade — nur State und die zwei Basis-Helfer."""

    def __init__(self, db: FakeDB, channex: _Channex) -> None:
        self._db = db
        self._channex = channex

    def _require_db(self) -> FakeDB:
        return self._db

    @staticmethod
    def _wrap_channex(exc: Exception) -> Exception:
        return exc


def _db() -> FakeDB:
    return FakeDB(
        {
            "channex_property_map": [
                {"id": "map-a", "tenant_id": TENANT_A, "property_id": "p-a",
                 "channex_property_id": CX_A, "deleted_at": None},
                {"id": "map-b", "tenant_id": TENANT_B, "property_id": "p-b",
                 "channex_property_id": CX_B, "deleted_at": None},
            ],
            "channex_review": [],
        },
        unique={"channex_review": ("channex_review_id",)},
    )


def _review(rid: str, cx_property: str | None, **attrs: object) -> dict:
    row: dict = {
        "id": rid,
        "attributes": {
            "content": "Sehr gut",
            "guest_name": "Jan Jansen",
            "ota": "BookingCom",
            "ota_reservation_id": "999",
            "overall_score": 9.5,
            "received_at": "2026-07-05T05:45:23.000000",
            "updated_at": "2026-07-05T06:00:00.000000",
            "is_hidden": False,
            "is_replied": False,
            "scores": [{"category": "clean", "score": 10}],
            "tags": [],
            **attrs,
        },
    }
    if cx_property:
        row["relationships"] = {"property": {"data": {"id": cx_property}}}
    return row


# --- reine Helfer ------------------------------------------------------------

def test_zeitstempel_bekommt_utc() -> None:
    # Channex liefert ohne Zonen-Suffix; ohne das explizite +00:00 liest
    # Postgres den Wert als Serverzeit.
    assert _as_utc("2026-07-05T05:45:23.000000") == "2026-07-05T05:45:23+00:00"
    assert _as_utc("2026-07-05T05:45:23Z") == "2026-07-05T05:45:23+00:00"
    assert _as_utc("") is None
    assert _as_utc("kein Datum") is None


def test_zahl_ohne_ersatzwert() -> None:
    assert _as_float(9.5) == 9.5
    assert _as_float("8") == 8.0
    assert _as_float(None) is None
    assert _as_float(True) is None      # bool ist keine Note
    assert _as_float("keine Zahl") is None


def test_buchungsbezug_aus_attribut_oder_relationship() -> None:
    assert _booking_ref({}, {"booking_id": " b-1 "}) == "b-1"
    assert (
        _booking_ref({"relationships": {"booking": {"data": {"id": "b-2"}}}}, {})
        == "b-2"
    )
    assert _booking_ref({}, {}) is None


def test_ohne_gueltige_property_kein_portal_call() -> None:
    # Nur synthetische Demo-Zuordnungen → kein Request, keine Spiegelung.
    db = FakeDB(
        {
            "channex_property_map": [
                {"id": "map-x", "tenant_id": TENANT_A, "property_id": "p-x",
                 "channex_property_id": "demo-0bca947c-d382-595d", "deleted_at": None},
            ],
            "channex_review": [],
        },
        unique={"channex_review": ("channex_review_id",)},
    )
    channex = _Channex([[_review("r-1", "demo-0bca947c-d382-595d")]])
    assert _Sync(db, channex)._pull_reviews(db) == 0
    assert channex.calls == 0


def test_synthetische_demo_ids_werden_ausgesortiert() -> None:
    # Live beobachtet: Channex lehnt den GANZEN Request mit 422
    # `filter is_invalid` ab, wenn EINE property_id keine UUID ist — dann kommt
    # keine Bewertung mehr durch.
    assert nur_uuids(
        ["demo-0bca947c-d382-595d", "030dcf25-2c39-4833-aecd-d49b77037c19", "", None]
    ) == ["030dcf25-2c39-4833-aecd-d49b77037c19"]
    assert nur_uuids([]) == []


# --- Spiegel ----------------------------------------------------------------

def test_bewertung_ohne_zuordnung_landet_bei_niemandem() -> None:
    db = _db()
    channex = _Channex([[_review("r-1", None), _review("r-2", CX_FREMD)]])
    assert _Sync(db, channex)._pull_reviews(db) == 0
    assert db.tables["channex_review"] == []


def test_bewertung_wird_dem_richtigen_betrieb_zugeordnet() -> None:
    db = _db()
    channex = _Channex([[_review("r-1", CX_A), _review("r-2", CX_B)]])
    assert _Sync(db, channex)._pull_reviews(db) == 2
    nach_tenant = {r["channex_review_id"]: r["tenant_id"]
                   for r in db.tables["channex_review"]}
    assert nach_tenant == {"r-1": TENANT_A, "r-2": TENANT_B}
    zeile = db.tables["channex_review"][0]
    assert zeile["property_id"] == "p-a"
    assert zeile["property_map_id"] == "map-a"
    assert zeile["overall_score"] == 9.5
    assert zeile["received_at"] == "2026-07-05T05:45:23+00:00"


def test_sync_eines_betriebs_laesst_fremde_aus() -> None:
    db = _db()
    channex = _Channex([[_review("r-1", CX_A), _review("r-2", CX_B)]])
    assert _Sync(db, channex)._pull_reviews(db, only_tenant=TENANT_A) == 1
    assert [r["channex_review_id"] for r in db.tables["channex_review"]] == ["r-1"]


def test_zweiter_lauf_erzeugt_keine_dublette() -> None:
    db = _db()
    sync = _Sync(db, _Channex([[_review("r-1", CX_A)]] * 2))
    sync._pull_reviews(db)
    sync._channex.calls = 0
    sync._pull_reviews(db)
    assert len(db.tables["channex_review"]) == 1


def test_eigene_arbeitsfelder_bleiben_beim_sync_erhalten() -> None:
    # Wurzel 1: gelesen/zugewiesen ist UNSER Zustand, kein Portal-Feld. Ein
    # erneuter Abgleich darf ihn nicht auf den Default zurücksetzen.
    db = _db()
    sync = _Sync(db, _Channex([[_review("r-1", CX_A)]] * 2))
    sync._pull_reviews(db)
    db.tables["channex_review"][0]["is_read"] = True
    db.tables["channex_review"][0]["assigned_user_id"] = "u-9"
    sync._channex.calls = 0
    sync._pull_reviews(db)
    zeile = db.tables["channex_review"][0]
    assert zeile["is_read"] is True
    assert zeile["assigned_user_id"] == "u-9"


def test_einzelabruf_ueber_den_webhook() -> None:
    db = _db()
    channex = _Channex([], einzeln={"r-1": _review("r-1", CX_A)})
    assert _Sync(db, channex).sync_single_review("r-1") is True
    assert db.tables["channex_review"][0]["tenant_id"] == TENANT_A


def test_einzelabruf_ohne_aktives_mapping_spiegelt_nicht() -> None:
    db = _db()
    channex = _Channex([], einzeln={"r-1": _review("r-1", CX_FREMD)})
    assert _Sync(db, channex).sync_single_review("r-1") is False
    assert db.tables["channex_review"] == []


def test_antwort_als_objekt_wird_gelesen_und_gilt_als_beantwortet() -> None:
    # Channex liefert `reply` als Objekt {"reply": "…"}; vorher fiel es still
    # auf None und die Bewertung galt als unbeantwortet.
    db = _db()
    sync = _Sync(db, _Channex([[_review("r-1", CX_A, reply={"reply": "Danke!"})]]))
    sync._pull_reviews(db)
    zeile = db.tables["channex_review"][0]
    assert zeile["reply"] == "Danke!"
    assert zeile["is_replied"] is True


def test_abgleich_setzt_eigene_antwort_nicht_zurueck() -> None:
    # Wurzel 1/2: nach unserem Reply meldet Channex die Antwort erst verzögert.
    # Ein Abgleich dazwischen darf „beantwortet" nicht auf „offen" drehen —
    # sonst wäre eine zweite Antwort möglich (live 05.09.2026, vier Fälle).
    db = _db()
    sync = _Sync(db, _Channex([[_review("r-1", CX_A)]] * 2))
    sync._pull_reviews(db)
    zeile = db.tables["channex_review"][0]
    zeile["reply"] = "Unsere Antwort"
    zeile["is_replied"] = True
    sync._channex.calls = 0
    sync._pull_reviews(db)
    zeile = db.tables["channex_review"][0]
    assert zeile["reply"] == "Unsere Antwort"
    assert zeile["is_replied"] is True
