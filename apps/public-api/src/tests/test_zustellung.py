"""Zustellung, Abo-Abschaltung und die Freigabe eines Idempotenz-Anspruchs.

Drei Verhalten, die eine öffentliche API von einer halben unterscheiden — und
alle drei sind erst nach dem Abgleich mit den geschriebenen Konventionen
entstanden: der Anspruch wurde nicht freigegeben (der Schlüssel war nach einem
409 verbrannt), das Abo wurde nie abgeschaltet, und Ereignisse waren nicht
abrufbar.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from src.core import errors, idempotency
from src.core.auth import ApiKontext
from src.v1 import events
from src.zusteller import dispatcher

from .fake_db import FakeDB

_CTX = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["webhooks:read"],
    property_ids=[],
)


# ---------------------------------------------------------------------------
# Idempotenz: der Schlüssel darf nach einem gescheiterten Versuch wieder frei sein
# ---------------------------------------------------------------------------
def _anspruch(db: FakeDB, *, mit_antwort: bool) -> None:
    zeile = {
        "id": "i1",
        "tenant_id": "t1",
        "api_client_id": "c1",
        "idempotency_key": "schluessel-1234",
        "request_fingerprint": "abdruck",
        "pfad": "/v1/reservations",
        "response_status": 201 if mit_antwort else None,
    }
    db.speicher.setdefault("public_api_idempotency", []).append(zeile)


def test_freigabe_loescht_den_offenen_anspruch() -> None:
    """Nach einem Fehlversuch ohne Wirkung ist derselbe Schlüssel wieder nutzbar.

    Ohne die Freigabe bliebe die Zeile ohne Antwort stehen und jede Wiederholung
    bekäme dauerhaft 409 „läuft noch" — der Schlüssel wäre verbrannt, obwohl
    nichts passiert ist. „Zeitraum belegt" ist der häufigste Fehler beim Buchen.
    """
    db = FakeDB()
    _anspruch(db, mit_antwort=False)
    idempotency.freigeben(
        db, tenant_id="t1", client_pk="c1", key="schluessel-1234"  # type: ignore[arg-type]
    )
    assert db.speicher["public_api_idempotency"] == []


def test_freigabe_laesst_abgeschlossene_vorgaenge_stehen() -> None:
    """Ein Anspruch MIT Antwort wird nie freigeräumt — auch nicht, wenn die
    Freigabe an der falschen Stelle gerufen würde. Sonst öffnete sie genau die
    Doppelbuchung, die der Schlüssel verhindern soll."""
    db = FakeDB()
    _anspruch(db, mit_antwort=True)
    idempotency.freigeben(
        db, tenant_id="t1", client_pk="c1", key="schluessel-1234"  # type: ignore[arg-type]
    )
    assert len(db.speicher["public_api_idempotency"]) == 1


# ---------------------------------------------------------------------------
# Webhook-Signatur und Zustellverhalten
# ---------------------------------------------------------------------------
def _zustellung(versuche: int = 0) -> dict:
    return {"id": "d1", "webhook_id": "w1", "event_id": "e1", "attempts": versuche}


def _db_mit_abo(failure_count: int = 0) -> FakeDB:
    return FakeDB(
        {
            "public_api_webhooks": [
                {
                    "id": "w1",
                    "tenant_id": "t1",
                    "url": "https://partner.example/haken",
                    "secret": "whsec_test",
                    "revoked_at": None,
                    "failure_count": failure_count,
                }
            ],
            "public_api_deliveries": [_zustellung()],
        }
    )


def test_erfolg_setzt_den_fehlerzaehler_zurueck() -> None:
    """Gezählt werden AUFEINANDERFOLGENDE Fehlschläge. Ohne Rücksetzen würde ein
    Abo, das einmal im Monat scheitert, irgendwann als dauerhaft kaputt gelten
    und abgeschaltet."""
    db = _db_mit_abo(failure_count=7)
    dispatcher._erfolg_vermerken(db, _zustellung(), 200)  # type: ignore[arg-type]
    abo = db.speicher["public_api_webhooks"][0]
    assert abo["failure_count"] == 0
    assert abo["last_error"] is None
    zustellung = db.speicher["public_api_deliveries"][0]
    assert zustellung["status"] == "delivered"
    assert zustellung["attempts"] == 1


def test_fehler_zaehlt_und_terminiert_neu() -> None:
    db = _db_mit_abo()
    dispatcher._fehler_vermerken(
        db, _zustellung(versuche=1), 500, "HTTP 500", 10, 50  # type: ignore[arg-type]
    )
    zustellung = db.speicher["public_api_deliveries"][0]
    assert zustellung["status"] == "pending"
    assert zustellung["attempts"] == 2
    assert zustellung["next_attempt_at"] is not None
    assert db.speicher["public_api_webhooks"][0]["failure_count"] == 1


def test_letzter_versuch_endet_endgueltig() -> None:
    """Nach dem letzten Versuch gibt es keinen neuen Termin — eine Zustellung,
    die für immer `pending` bleibt, würde der Zusteller ewig aufgreifen."""
    db = _db_mit_abo()
    dispatcher._fehler_vermerken(
        db, _zustellung(versuche=9), None, "Timeout", 10, 50  # type: ignore[arg-type]
    )
    zustellung = db.speicher["public_api_deliveries"][0]
    assert zustellung["status"] == "failed"
    assert zustellung["next_attempt_at"] is None


def test_abo_wird_mit_grund_abgeschaltet() -> None:
    """Ein Abo, das stumm nichts mehr bekommt, ist der schlimmste Zustand: der
    Partner sucht den Fehler bei sich, während wir längst aufgegeben haben."""
    db = _db_mit_abo(failure_count=49)
    dispatcher._fehler_vermerken(
        db, _zustellung(versuche=9), None, "Connection refused", 10, 50  # type: ignore[arg-type]
    )
    abo = db.speicher["public_api_webhooks"][0]
    assert abo["revoked_at"] is not None
    assert "50 aufeinanderfolgenden Fehlversuchen" in abo["last_error"]
    assert "Connection refused" in abo["last_error"]


def test_abo_bleibt_unter_der_schwelle_aktiv() -> None:
    """Eine halbe Stunde Wartung beim Partner darf ein Abo nicht kosten."""
    db = _db_mit_abo(failure_count=10)
    dispatcher._fehler_vermerken(
        db, _zustellung(versuche=1), 502, "HTTP 502", 10, 50  # type: ignore[arg-type]
    )
    assert db.speicher["public_api_webhooks"][0].get("revoked_at") is None


# ---------------------------------------------------------------------------
# Ereignisse abrufen (der Nachhol-Weg)
# ---------------------------------------------------------------------------
def _db_mit_ereignissen(monkeypatch: pytest.MonkeyPatch) -> FakeDB:
    jetzt = datetime.now(UTC)
    db = FakeDB(
        {
            "public_api_events": [
                {
                    "id": "e1",
                    "tenant_id": "t1",
                    "event": "reservation.created",
                    "property_id": "p1",
                    "payload": {"reservation_id": "r1"},
                    "created_at": (jetzt - timedelta(hours=2)).isoformat(),
                },
                {
                    "id": "e2",
                    "tenant_id": "t1",
                    "event": "availability.changed",
                    "property_id": "p1",
                    "payload": {"date": "2026-09-01"},
                    "created_at": (jetzt - timedelta(hours=1)).isoformat(),
                },
            ]
        }
    )
    monkeypatch.setattr(events, "service_db", lambda: db)
    return db


def test_ereignisse_werden_ausgeliefert(monkeypatch: pytest.MonkeyPatch) -> None:
    """Der Abhol-Weg: ein Partner, der wieder online ist, holt nach, was die
    Push-Zustellung nicht losbekommen hat."""
    _db_mit_ereignissen(monkeypatch)
    antwort = events.liste(_CTX)
    ids = [e["id"] for e in antwort["data"]]
    assert ids == ["e1", "e2"]
    assert antwort["data"][0]["data"] == {"reservation_id": "r1"}


def test_unbekannter_ereignistyp_ist_422(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Tippfehler im Filter darf nicht als „keine Ereignisse" durchgehen —
    das ließe den Partner glauben, es sei nichts passiert."""
    _db_mit_ereignissen(monkeypatch)
    with pytest.raises(errors.ApiFehler) as exc:
        events.liste(_CTX, event="reservation.erstellt")
    assert exc.value.status == 422
    assert "reservation.erstellt" in exc.value.extra["unbekannt"]


def test_since_ohne_zeitzone_ist_422(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Zeitstempel ohne Zone ist nicht eindeutig. UTC zu unterstellen wäre
    ein stiller Ersatzwert, der Ereignisse verschluckt oder doppelt liefert."""
    _db_mit_ereignissen(monkeypatch)
    with pytest.raises(errors.ApiFehler) as exc:
        events.liste(_CTX, since=datetime(2026, 8, 21, 9, 0))  # noqa: DTZ001
    assert exc.value.status == 422


def test_zu_weiter_rueckblick_ist_422(monkeypatch: pytest.MonkeyPatch) -> None:
    _db_mit_ereignissen(monkeypatch)
    with pytest.raises(errors.ApiFehler) as exc:
        events.liste(_CTX, since=datetime.now(UTC) - timedelta(days=90))
    assert exc.value.status == 422
    assert exc.value.extra["max_rueckblick_tage"] == 30
