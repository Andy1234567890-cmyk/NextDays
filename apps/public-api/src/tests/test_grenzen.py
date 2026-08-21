"""Grenzen, Fehlerformat, Idempotenz und Webhook-Signatur.

Das sind die Zusagen, die eine öffentliche API einhalten muss, damit ein fremder
Entwickler sie überhaupt anbinden kann — und gleichzeitig die Stellen, an denen
sie sich gegen Missbrauch wehrt.
"""
from __future__ import annotations

from datetime import date

import pytest

from src.core import errors, idempotency, pagination
from src.zusteller.dispatcher import _naechster_abstand, signatur

from .fake_db import FakeDB


# ---------------------------------------------------------------------------
# Blättern und Zeiträume
# ---------------------------------------------------------------------------
def test_limit_obergrenze_ist_hart() -> None:
    """Ein zu großes `limit` ist ein 422, kein stilles Kürzen.

    Stilles Kürzen wäre schlimmer als der Fehler: der Client hielte die
    gekürzte Seite für das vollständige Ergebnis.
    """
    with pytest.raises(errors.ApiFehler) as exc:
        pagination.blaettern_pruefen(5000, 0, False)
    assert exc.value.status == 422
    assert exc.value.extra["max_limit"] == 200


def test_negativer_offset_ist_422() -> None:
    with pytest.raises(errors.ApiFehler):
        pagination.blaettern_pruefen(50, -1, False)


def test_has_more_ohne_zweiten_aufruf() -> None:
    """Der +1-Trick: eine Zeile mehr holen, als ausgeliefert wird."""
    blatt = pagination.blaettern_pruefen(2, 0, False)
    seite = pagination.seite_bauen([{"id": 1}, {"id": 2}, {"id": 3}], blatt)
    assert len(seite["data"]) == 2
    assert seite["pagination"]["has_more"] is True

    seite2 = pagination.seite_bauen([{"id": 1}], blatt)
    assert seite2["pagination"]["has_more"] is False


def test_total_erscheint_nur_wenn_bestellt() -> None:
    """`total: null` wäre irreführend — es liest sich wie „null Treffer"."""
    blatt = pagination.blaettern_pruefen(10, 0, False)
    assert "total" not in pagination.seite_bauen([], blatt)["pagination"]
    assert pagination.seite_bauen([], blatt, total=7)["pagination"]["total"] == 7


def test_verdrehter_zeitraum_ist_422() -> None:
    with pytest.raises(errors.ApiFehler):
        pagination.zeitraum_pruefen(date(2026, 5, 10), date(2026, 5, 1))


def test_zu_langer_zeitraum_ist_422() -> None:
    """Ohne Obergrenze wäre `von=2000&bis=2100` ein Ein-Zeilen-Angriff."""
    with pytest.raises(errors.ApiFehler) as exc:
        pagination.zeitraum_pruefen(date(2000, 1, 1), date(2100, 1, 1))
    assert exc.value.status == 422
    assert exc.value.extra["max_tage"] == 730


# ---------------------------------------------------------------------------
# Fehlerformat
# ---------------------------------------------------------------------------
def test_fehler_traegt_stabilen_code_und_uri() -> None:
    """Clients verzweigen auf `code`, nicht auf deutschen Text."""
    fehler = errors.scope_fehlt("rates:write")
    assert fehler.status == 403
    assert fehler.code == "scope_fehlt"
    assert fehler.extra["erforderlicher_scope"] == "rates:write"


def test_rate_limit_fehler_nennt_die_zahlen() -> None:
    fehler = errors.zu_viele_anfragen(30, 600, 60)
    assert fehler.status == 429
    assert fehler.extra == {"retry_after": 30, "limit": 600, "fenster_sekunden": 60}


# ---------------------------------------------------------------------------
# Idempotenz
# ---------------------------------------------------------------------------
def test_schluessel_ist_pflicht_wo_es_zaehlt() -> None:
    with pytest.raises(errors.ApiFehler) as exc:
        idempotency.schluessel_pruefen(None, pflicht=True)
    assert exc.value.status == 422
    assert idempotency.schluessel_pruefen(None, pflicht=False) is None


def test_zu_kurzer_schluessel_wird_abgelehnt() -> None:
    """„1" als Schlüssel kollidiert bei jedem zweiten Client."""
    with pytest.raises(errors.ApiFehler):
        idempotency.schluessel_pruefen("1", pflicht=True)


def test_erster_anspruch_ist_frei_zweiter_bekommt_die_antwort() -> None:
    db = FakeDB()
    args = {
        "tenant_id": "t1",
        "client_pk": "c1",
        "key": "schluessel-1234",
        "pfad": "/v1/reservations",
        "koerper": {"a": 1},
    }
    assert idempotency.beanspruchen(db, **args) is None  # type: ignore[arg-type]

    # Antwort des ersten Aufrufs ablegen.
    idempotency.antwort_festhalten(
        db, tenant_id="t1", client_pk="c1", key="schluessel-1234", status=201,
        body={"id": "r1"},
    )
    # Der zweite Aufruf verliert das Rennen: die Nachbildung kennt keine
    # Unique-Indizes, deshalb wird der Konflikt so nachgestellt, wie PostgREST
    # ihn meldet.
    db.insert_fehler["public_api_idempotency"] = RuntimeError(
        'duplicate key value violates unique constraint '
        '"public_api_idempotency_uq" (23505)'
    )
    vorhanden = idempotency.beanspruchen(db, **args)  # type: ignore[arg-type]
    assert vorhanden == {"status": 201, "body": {"id": "r1"}}


def test_gleicher_schluessel_andere_nutzlast_ist_422() -> None:
    """Ein wiederverwendeter Schlüssel für einen NEUEN Vorgang ist ein Fehler
    im Client — und darf nicht als „schon erledigt" quittiert werden."""
    speicher = {
        "public_api_idempotency": [
            {
                "id": "i1",
                "tenant_id": "t1",
                "api_client_id": "c1",
                "idempotency_key": "schluessel-1234",
                "request_fingerprint": "ein-anderer-abdruck",
                "response_status": 201,
                "response_body": {"id": "r1"},
            }
        ]
    }

    with pytest.raises(errors.ApiFehler) as exc:
        idempotency._vorhandenen_anspruch_lesen(
            FakeDB(speicher),  # type: ignore[arg-type]
            tenant_id="t1",
            client_pk="c1",
            key="schluessel-1234",
            abdruck="mein-abdruck",
        )
    assert exc.value.status == 422


def test_laufender_anspruch_ist_409() -> None:
    speicher = {
        "public_api_idempotency": [
            {
                "id": "i1",
                "tenant_id": "t1",
                "api_client_id": "c1",
                "idempotency_key": "schluessel-1234",
                "request_fingerprint": "abdruck",
                "response_status": None,
            }
        ]
    }
    with pytest.raises(errors.ApiFehler) as exc:
        idempotency._vorhandenen_anspruch_lesen(
            FakeDB(speicher),  # type: ignore[arg-type]
            tenant_id="t1",
            client_pk="c1",
            key="schluessel-1234",
            abdruck="abdruck",
        )
    assert exc.value.status == 409
    assert exc.value.code == "idempotenz_in_arbeit"


def test_feldreihenfolge_aendert_den_abdruck_nicht() -> None:
    """Sonst verliert ein Client seinen Wiederholschutz, sobald er sein dict
    neu serialisiert."""
    a = idempotency._anfrage_fingerabdruck("/v1/x", {"a": 1, "b": 2})
    b = idempotency._anfrage_fingerabdruck("/v1/x", {"b": 2, "a": 1})
    assert a == b


# ---------------------------------------------------------------------------
# Webhook-Signatur
# ---------------------------------------------------------------------------
def test_signatur_form_und_zeitstempel() -> None:
    sig = signatur("whsec_test", 1755770000, b'{"event":"x"}')
    assert sig.startswith("t=1755770000,v1=")
    # Hex-SHA256 = 64 Zeichen.
    assert len(sig.split("v1=")[1]) == 64


def test_signatur_haengt_am_zeitstempel() -> None:
    """Der Zeitstempel ist MITSIGNIERT — das unterscheidet dieses Verfahren von
    einem reinen Body-HMAC und macht Wiedereinspielungen erkennbar."""
    koerper = b'{"event":"x"}'
    assert signatur("s", 1, koerper) != signatur("s", 2, koerper)


def test_signatur_haengt_am_secret() -> None:
    assert signatur("a" * 16, 1, b"x") != signatur("b" * 16, 1, b"x")


def test_wiederholabstaende_wachsen_und_enden_bei_einer_stunde() -> None:
    assert _naechster_abstand(1) == 60
    assert _naechster_abstand(3) == 900
    # Ab dem fünften Versuch bleibt es bei einer Stunde: häufiger zu klopfen
    # hilft nicht, wenn ein Server seit Stunden weg ist.
    assert _naechster_abstand(5) == 3600
    assert _naechster_abstand(99) == 3600
