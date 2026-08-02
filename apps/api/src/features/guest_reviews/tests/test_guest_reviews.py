"""Tests der Gast-Seite (myBestDays-Marktplatz).

Der Slice hatte bislang keine Tests — genau deshalb blieb ein Fehler im
Zwei-Wege-Pfad lange unentdeckt. Geprüft wird das, was Geld und Vertrauen
kostet, wenn es kippt: der „echter Gast"-Nachweis, die Maskierung im
öffentlichen Pfad, die Idempotenz der Abgabe und das Aggregat für die
Trefferliste.
"""
from __future__ import annotations

from datetime import date

import pytest

from src.features.guest_reviews.schemas import (
    CategoryScores,
    CreateReviewRequest,
    UpdateReviewRequest,
)
from src.features.guest_reviews.service import GuestReviewError, GuestReviewsService
from src.features.reviews.tests.fake_db import FakeDB

GAST = "pg-1"
MAIL = "erika@example.com"
PROP = "p-a"


def _db(**extra: list[dict]) -> FakeDB:
    tables: dict[str, list[dict]] = {
        "reviews": [],
        "guest_reviews_by_host": [],
        "reservations": [
            {
                "id": "res-1",
                "property_id": PROP,
                "guest_email": "Erika@Example.com",
                "status": "completed",
                "check_out": "2026-07-20",
            }
        ],
        "portal_guests": [{"id": GAST, "name": "Erika Mustermann"}],
    }
    tables.update(extra)
    return FakeDB(
        tables,
        unique={"reviews": ("reservation_id", "portal_guest_id")},
    )


def _service(db: FakeDB) -> GuestReviewsService:
    return GuestReviewsService(service_client=db)


HEUTE = date(2026, 7, 25)


# --- Abgabe ------------------------------------------------------------------

def test_bewertung_leitet_objekt_aus_der_reservierung_ab() -> None:
    db = _db()
    out = _service(db).create_review(
        GAST,
        MAIL,
        CreateReviewRequest(
            reservation_id="res-1",
            rating=5,
            text="Alles super",
            scores=CategoryScores(cleanliness=5, location=4),
        ),
        today=HEUTE,
    )
    # property_id kommt NIE aus dem Request (Wurzel 3).
    assert out.property_id == PROP
    zeile = db.tables["reviews"][0]
    assert zeile["score_cleanliness"] == 5
    assert zeile["score_location"] == 4


def test_fremde_reservierung_ist_nicht_gefunden() -> None:
    service = _service(_db())
    with pytest.raises(GuestReviewError) as exc:
        service.create_review(
            GAST, "fremd@example.com",
            CreateReviewRequest(reservation_id="res-1", rating=5), today=HEUTE,
        )
    # 404, nicht 403 — sonst verrät die Antwort, dass die Reservierung existiert.
    assert exc.value.status_code == 404


def test_laufender_aufenthalt_kann_nicht_bewertet_werden() -> None:
    db = _db()
    db.tables["reservations"][0]["status"] = "confirmed"
    db.tables["reservations"][0]["check_out"] = "2026-08-10"
    with pytest.raises(GuestReviewError) as exc:
        _service(db).create_review(
            GAST, MAIL, CreateReviewRequest(reservation_id="res-1", rating=5),
            today=HEUTE,
        )
    assert exc.value.status_code == 409


def test_zweite_abgabe_derselben_reservierung_ist_konflikt() -> None:
    db = _db()
    service = _service(db)
    req = CreateReviewRequest(reservation_id="res-1", rating=5)
    service.create_review(GAST, MAIL, req, today=HEUTE)
    with pytest.raises(GuestReviewError) as exc:
        service.create_review(GAST, MAIL, req, today=HEUTE)
    assert exc.value.status_code == 409


def test_fremde_bewertung_aendern_ist_nicht_gefunden() -> None:
    db = _db()
    _service(db).create_review(
        GAST, MAIL, CreateReviewRequest(reservation_id="res-1", rating=5), today=HEUTE
    )
    review_id = db.tables["reviews"][0]["id"]
    with pytest.raises(GuestReviewError) as exc:
        _service(db).update_review("pg-fremd", review_id, UpdateReviewRequest(rating=1))
    assert exc.value.status_code == 404


def test_aenderung_ohne_inhalt_ist_ungueltig() -> None:
    with pytest.raises(GuestReviewError) as exc:
        _service(_db()).update_review(GAST, "r-1", UpdateReviewRequest())
    assert exc.value.status_code == 422


# --- öffentlicher Lesepfad ---------------------------------------------------

def _veroeffentlicht(**over: object) -> dict:
    row = {
        "id": "r-1",
        "property_id": PROP,
        "reservation_id": "res-1",
        "portal_guest_id": GAST,
        "rating": 4,
        "text": "Schön",
        "host_reply": None,
        "host_reply_at": None,
        "published_at": "2026-07-21T00:00:00+00:00",
        "created_at": "2026-07-21T00:00:00+00:00",
        "updated_at": None,
        "score_cleanliness": 4,
        "score_communication": None,
        "score_location": None,
        "score_value": None,
        "score_accuracy": None,
        "score_checkin": None,
        "portal_guests": {"name": "Erika Mustermann"},
    }
    row.update(over)
    return row


def test_oeffentlich_maskiert_und_zaehlt_nur_veroeffentlichte() -> None:
    db = _db(
        reviews=[
            _veroeffentlicht(),
            _veroeffentlicht(id="r-2", rating=2, published_at=None),  # verdeckt
        ]
    )
    res = _service(db).public_reviews(PROP, limit=20, offset=0)
    assert res.count == 1
    assert res.average == 4.0
    assert res.reviews[0].author == "Erika"          # nur Vorname (Wurzel 9)
    assert res.category_averages is not None
    assert res.category_averages.cleanliness == 4.0
    assert res.category_averages.location is None    # kein erfundener Wert


def test_objekt_ohne_bewertung_hat_keinen_durchschnitt() -> None:
    res = _service(_db()).public_reviews(PROP, limit=20, offset=0)
    assert res.count == 0
    assert res.average is None
    assert res.category_averages is None


def test_aggregat_fuer_die_trefferliste() -> None:
    # Speist die Sterne auf Listing-Karten (booking_engine). Objekte ohne
    # veröffentlichte Bewertung fehlen bewusst — keine 0,0 erfinden.
    db = _db(
        reviews=[
            _veroeffentlicht(),
            _veroeffentlicht(id="r-2", rating=2),
            _veroeffentlicht(id="r-3", property_id="p-b", published_at=None),
        ]
    )
    aggregat = _service(db).property_aggregates([PROP, "p-b"])
    assert aggregat == {PROP: (3.0, 2)}


def test_eigene_bewertung_bleibt_auch_verdeckt_sichtbar() -> None:
    db = _db(reviews=[_veroeffentlicht(published_at=None)])
    meine = _service(db).my_reviews(GAST)
    assert len(meine.reviews) == 1
    assert meine.reviews[0].published_at is None
