"""Tests des Bewertungs-Cockpits: Normalisierung über zwei Skalen, Objekt-Scope
des Eigentümers, Antwort-Routing, Idempotenz der Automatik.

Was hier geprüft wird, ist genau das, was ohne Test unbemerkt kaputtgeht:
* Booking-Zehntel und myBestDays-Sterne in EINER Liste — falsch normalisiert
  sieht eine 10/10 wie 10 Sterne aus.
* Der Eigentümer darf nur SEINE Objekte sehen — in Liste UND Detail (Wurzel 9).
* Die Automatik darf einen Gast nie zweimal bewerten (Wurzel 2).
"""
from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from src.core.security import AuthContext
from src.features.reviews.automation import ReviewAutomation
from src.features.reviews.common import mask_author, plaintext
from src.features.reviews.publication import publish_overdue, resolve_publication
from src.features.reviews.queue import ReviewQueue
from src.features.reviews.schemas import (
    GuestScores,
    QueueUpdateRequest,
    RateGuestRequest,
    ReviewScale,
    ReviewSource,
)
from src.features.reviews.service import (
    ReviewError,
    ReviewsService,
    _ota_categories,
    _score_5_from_ten,
)

from .fake_db import FakeDB

TENANT = "t-1"
PROP_A = "p-a"
PROP_B = "p-b"


def _ctx(role: str = "admin", user_id: str = "u-1") -> AuthContext:
    return AuthContext(user_id=user_id, tenant_id=TENANT, role=role)


def _db(**extra: list[dict]) -> FakeDB:
    tables: dict[str, list[dict]] = {
        "properties": [
            {"id": PROP_A, "tenant_id": TENANT, "title": "Haus A"},
            {"id": PROP_B, "tenant_id": TENANT, "title": "Haus B"},
        ],
        "reviews": [],
        "channex_review": [],
        "guest_reviews_by_host": [],
        "review_automation": [],
        "review_automation_log": [],
        "reservations": [],
        "portal_guests": [],
        "guest_review_queue": [],
    }
    tables.update(extra)
    return FakeDB(
        tables,
        unique={
            "guest_reviews_by_host": ("reservation_id",),
            "review_automation_log": ("reservation_id", "kind"),
            "review_automation": ("tenant_id",),
            "channex_review": ("channex_review_id",),
            # Bildet die zwei Teil-UNIQUE-Indizes ab (je Quelle trägt ein Feld).
            "guest_review_queue": ("source", "reservation_id", "review_id"),
        },
        defaults={
            # Spalten-Defaults aus Migration 0267 — Postgres setzt sie selbst.
            "guest_review_queue": {
                "status": "geplant", "recommended": True, "tags": [],
                "sent_at": None, "error": None, "expires_at": None,
                "reservation_id": None, "review_id": None, "guest_name": None,
                "text": None, "private_text": None,
            },
            "channex_review": {"is_archived": False, "is_expired": False},
        },
    )


def _markt(**over: object) -> dict:
    row = {
        "id": "r-1",
        "property_id": PROP_A,
        "reservation_id": "res-1",
        "rating": 5,
        "text": "Alles top",
        "host_reply": None,
        "host_reply_at": None,
        "published_at": "2026-07-01T10:00:00+00:00",
        "created_at": "2026-07-01T10:00:00+00:00",
        "updated_at": None,
        "score_cleanliness": 5,
        "score_communication": 4,
        "score_location": None,
        "score_value": None,
        "score_accuracy": None,
        "score_checkin": None,
        "portal_guests": {"name": "Erika Mustermann"},
        "properties": {"id": PROP_A, "title": "Haus A", "tenant_id": TENANT},
    }
    row.update(over)
    return row


def _ota(**over: object) -> dict:
    row = {
        "id": "o-1",
        "tenant_id": TENANT,
        "property_id": PROP_B,
        "channex_review_id": "cx-1",
        "ota": "BookingCom",
        "ota_reservation_id": "23284",
        "guest_name": "Jan Jansen",
        "content": "Sehr sauber",
        "overall_score": 9.0,
        "scores": [{"category": "clean", "score": 10}],
        "is_hidden": False,
        "is_replied": False,
        "is_expired": False,
        "is_archived": False,
        "reply": None,
        "reply_at": None,
        "guest_review_sent_at": None,
        "received_at": "2026-07-05T10:00:00+00:00",
        "created_at": "2026-07-05T10:00:00+00:00",
        "properties": {"id": PROP_B, "title": "Haus B"},
    }
    row.update(over)
    return row


# --- reine Funktionen --------------------------------------------------------

def test_portal_note_wird_halbiert() -> None:
    # 9/10 sind 4,5 Sterne — nicht 9. Ohne das steht eine Booking-Bewertung
    # in derselben Liste wie eine 5-Sterne-Bewertung „doppelt so gut" da.
    assert _score_5_from_ten(9.0) == 4.5
    assert _score_5_from_ten(None) is None
    assert _score_5_from_ten("keine Zahl") is None


def test_kategorien_ohne_note_werden_verworfen() -> None:
    roh = [
        {"category": "clean", "score": 10},
        {"category": "comfort"},          # ohne Note → raus, keine 0 erfinden
        {"score": 8},                     # ohne Kategorie → raus
        "kaputt",
    ]
    kategorien = _ota_categories(roh)
    assert [k.key for k in kategorien] == ["clean"]
    assert kategorien[0].scale is ReviewScale.ten


def test_autor_wird_maskiert() -> None:
    assert mask_author("Erika Mustermann") == "Erika"
    assert mask_author(None) == "Gast"


def test_text_wird_zu_plaintext() -> None:
    # Tags fallen weg, der Textinhalt bleibt — der Inhalt von <script> wird
    # mitsamt Tag verworfen (nh3), nicht als Text übernommen.
    assert plaintext("<b>super</b><script>alert(1)</script>") == "super"
    assert plaintext("   ") is None


# --- Liste über beide Quellen ------------------------------------------------

def test_liste_vereint_beide_quellen_neueste_zuerst() -> None:
    service = ReviewsService(service_client=_db(reviews=[_markt()], channex_review=[_ota()]))
    res = service.list_reviews(_ctx(), limit=25, offset=0)
    assert res.total == 2
    # Portal-Bewertung ist jünger (05.07. vs 01.07.) → steht vorn.
    assert [i.source for i in res.items] == [ReviewSource.ota, ReviewSource.marketplace]
    assert res.items[0].score_5 == 4.5
    assert res.items[0].channel_code == "BookingCom"
    assert res.items[1].channel_code == "myBestDays"
    assert res.items[1].score_5 == 5.0
    assert res.items[0].author == "Jan"


def test_filter_unbeantwortet_und_quelle() -> None:
    db = _db(
        reviews=[_markt(host_reply="Danke!")],
        channex_review=[_ota()],
    )
    service = ReviewsService(service_client=db)
    offen = service.list_reviews(_ctx(), unanswered=True, limit=25, offset=0)
    assert [i.source for i in offen.items] == [ReviewSource.ota]

    nur_markt = service.list_reviews(
        _ctx(), source=ReviewSource.marketplace, limit=25, offset=0
    )
    assert [i.source for i in nur_markt.items] == [ReviewSource.marketplace]
    assert nur_markt.items[0].is_replied is True


def test_abgelaufene_portal_bewertung_kann_nicht_antworten() -> None:
    service = ReviewsService(service_client=_db(channex_review=[_ota(is_expired=True)]))
    res = service.list_reviews(_ctx(), limit=25, offset=0)
    assert res.items[0].can_reply is False


# --- Eigentümer-Scope (Wurzel 9) ---------------------------------------------

def test_eigentuemer_sieht_nur_eigene_objekte(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "src.features.reviews.service.owner_property_ids", lambda _db, _ctx: {PROP_A}
    )
    db = _db(reviews=[_markt()], channex_review=[_ota()])
    service = ReviewsService(service_client=db)
    res = service.list_reviews(_ctx(role="owner"), limit=25, offset=0)
    # Die Portal-Bewertung hängt an PROP_B → für diesen Eigentümer unsichtbar.
    assert [i.property_id for i in res.items] == [PROP_A]


def test_eigentuemer_detail_prueft_denselben_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "src.features.reviews.service.owner_property_ids", lambda _db, _ctx: {PROP_A}
    )
    service = ReviewsService(service_client=_db(channex_review=[_ota()]))
    with pytest.raises(ReviewError) as exc:
        service.get_review(_ctx(role="owner"), ReviewSource.ota, "o-1")
    assert exc.value.status_code == 404


def test_eigentuemer_darf_nicht_antworten(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "src.features.reviews.service.owner_property_ids", lambda _db, _ctx: {PROP_A}
    )
    service = ReviewsService(service_client=_db(reviews=[_markt()]))
    with pytest.raises(ReviewError) as exc:
        service.reply(_ctx(role="owner"), ReviewSource.marketplace, "r-1", "Danke")
    assert exc.value.status_code == 403


# --- Antworten ---------------------------------------------------------------

def test_antwort_auf_marktplatz_wird_gespeichert() -> None:
    db = _db(reviews=[_markt()])
    service = ReviewsService(service_client=db)
    out = service.reply(_ctx(), ReviewSource.marketplace, "r-1", "<b>Danke!</b>")
    assert out.reply == "Danke!"          # HTML gestrippt (Wurzel 8)
    assert out.is_replied is True
    assert db.tables["reviews"][0]["host_reply_at"] is not None


def test_antwort_auf_abgelaufene_portal_bewertung_ist_konflikt() -> None:
    service = ReviewsService(service_client=_db(channex_review=[_ota(is_expired=True)]))
    with pytest.raises(ReviewError) as exc:
        service.reply(_ctx(), ReviewSource.ota, "o-1", "Danke")
    assert exc.value.status_code == 409


def test_portal_antwort_geht_erst_zum_portal() -> None:
    # Wurzel 1: erst das Portal, dann der eigene Bestand. Der Spiegel entsteht
    # im channel_manager — hier wird geprüft, dass wir wirklich dorthin gehen
    # und die Portal-Review-ID (nicht unsere UUID) übergeben.
    class _CM:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str]] = []

        def reply_review(self, _ctx: object, review_id: str, reply: str) -> dict:
            self.calls.append((review_id, reply))
            return {}

    cm = _CM()
    service = ReviewsService(
        service_client=_db(channex_review=[_ota()]), channel_manager=cm
    )
    service.reply(_ctx(), ReviewSource.ota, "o-1", "Vielen Dank")
    assert cm.calls == [("cx-1", "Vielen Dank")]


def test_portal_fehler_wird_nicht_roh_durchgereicht() -> None:
    # Live beobachtet: Channex antwortete mit „is invalid" und genau das stand in
    # der Oberfläche. Provider-Sprache hat im Kundentext nichts zu suchen — der
    # channel_manager übersetzt sie, hier wird der übersetzte Fehler geprüft.
    from src.features.channel_manager.service import ChannelManagerError

    class _CM:
        def reply_review(self, _ctx: object, _id: str, _reply: str) -> dict:
            raise ChannelManagerError(
                "Diese Bewertung ist beim Portal nicht mehr verfügbar.",
                status_code=404,
            )

    service = ReviewsService(
        service_client=_db(channex_review=[_ota()]), channel_manager=_CM()
    )
    with pytest.raises(ReviewError) as exc:
        service.reply(_ctx(), ReviewSource.ota, "o-1", "Danke")
    assert exc.value.status_code == 404
    assert "Portal" in exc.value.message


def test_antwort_darf_nicht_leer_sein() -> None:
    service = ReviewsService(service_client=_db(reviews=[_markt()]))
    with pytest.raises(ReviewError) as exc:
        service.reply(_ctx(), ReviewSource.marketplace, "r-1", "<i></i>")
    assert exc.value.status_code == 422


# --- Kennzahlen --------------------------------------------------------------

def test_kennzahlen_je_kanal() -> None:
    db = _db(
        reviews=[_markt(), _markt(id="r-2", rating=3, host_reply="ok")],
        channex_review=[_ota()],
    )
    zusammenfassung = ReviewsService(service_client=db).summary(_ctx())
    assert zusammenfassung.count == 3
    assert zusammenfassung.unanswered == 2
    kanaele = {c.channel_code: c for c in zusammenfassung.by_channel}
    assert kanaele["myBestDays"].average_5 == 4.0
    assert kanaele["BookingCom"].average_5 == 4.5
    # (5 + 3 + 4.5) / 3
    assert zusammenfassung.average_5 == 4.17
    assert zusammenfassung.response_rate == round(1 / 3, 4)


def test_kennzahlen_ohne_bewertungen_luegen_nicht() -> None:
    zusammenfassung = ReviewsService(service_client=_db()).summary(_ctx())
    assert zusammenfassung.count == 0
    assert zusammenfassung.average_5 is None
    assert zusammenfassung.response_rate is None


# --- Betrieb bewertet Gast ---------------------------------------------------

def test_gast_bewerten_loest_portal_konto_ueber_email_auf() -> None:
    # Der Bug: der Code las reservations.portal_guest_id — die Spalte gibt es
    # nicht (42703), jede Host→Gast-Bewertung lief in einen 500.
    db = _db(
        reservations=[
            {"id": "res-1", "tenant_id": TENANT, "property_id": PROP_A,
             "guest_email": "Erika@example.com"}
        ],
        portal_guests=[{"id": "pg-1", "email": "erika@example.com"}],
    )
    service = ReviewsService(service_client=db)
    out = service.rate_guest(
        _ctx(),
        RateGuestRequest(
            reservation_id="res-1", rating=5, text="Gerne wieder",
            scores=GuestScores(cleanliness=5),
        ),
    )
    assert out.rating == 5
    assert db.tables["guest_reviews_by_host"][0]["portal_guest_id"] == "pg-1"


def test_gast_ohne_portal_konto_bleibt_an_der_email() -> None:
    db = _db(
        reservations=[
            {"id": "res-1", "tenant_id": TENANT, "property_id": PROP_A,
             "guest_email": "ohne@example.com"}
        ],
    )
    ReviewsService(service_client=db).rate_guest(
        _ctx(), RateGuestRequest(reservation_id="res-1", rating=4)
    )
    zeile = db.tables["guest_reviews_by_host"][0]
    assert zeile["portal_guest_id"] is None
    assert zeile["guest_email"] == "ohne@example.com"


def test_gast_zweimal_bewerten_ist_konflikt() -> None:
    db = _db(
        reservations=[
            {"id": "res-1", "tenant_id": TENANT, "property_id": PROP_A,
             "guest_email": "a@example.com"}
        ],
    )
    service = ReviewsService(service_client=db)
    req = RateGuestRequest(reservation_id="res-1", rating=5)
    service.rate_guest(_ctx(), req)
    with pytest.raises(ReviewError) as exc:
        service.rate_guest(_ctx(), req)
    assert exc.value.status_code == 409


# --- Sichtbarkeit (double-blind) ---------------------------------------------

def test_beide_seiten_veroeffentlichen_gemeinsam() -> None:
    db = _db(
        reviews=[_markt(published_at=None)],
        guest_reviews_by_host=[{"id": "g-1", "reservation_id": "res-1",
                                "published_at": None}],
    )
    resolve_publication(db, "res-1")
    assert db.tables["reviews"][0]["published_at"] is not None
    assert db.tables["guest_reviews_by_host"][0]["published_at"] is not None


def test_einseitig_bleibt_verdeckt() -> None:
    db = _db(reviews=[_markt(published_at=None)])
    resolve_publication(db, "res-1")
    assert db.tables["reviews"][0]["published_at"] is None


def test_frist_veroeffentlicht_auch_einseitig() -> None:
    db = _db(
        reviews=[_markt(published_at=None, created_at="2026-01-01T00:00:00+00:00")]
    )
    assert publish_overdue(db) == 1
    assert db.tables["reviews"][0]["published_at"] is not None


# --- Automatik ---------------------------------------------------------------

def _automatik_db(**over: object) -> FakeDB:
    cfg = {
        "tenant_id": TENANT,
        "auto_review_active": True,
        "auto_review_after_days": 3,
        "auto_review_min_rating": None,
        "auto_review_rating": 5,
        "auto_review_public": "Danke für den Besuch!",
        "auto_review_private": None,
        "guest_reminder_active": False,
        "guest_reminder_after_days": 2,
    }
    cfg.update(over)
    return _db(
        review_automation=[cfg],
        reservations=[
            {"id": "res-1", "tenant_id": TENANT, "property_id": PROP_A,
             "guest_email": "a@example.com", "check_out": "2026-07-20",
             "status": "completed"}
        ],
    )


def test_automatik_plant_statt_zu_senden() -> None:
    # Kern der Warteschlange: die Automatik legt einen ENTWURF an. Direkt
    # abschicken wäre unumkehrbar und der Betrieb sähe die Bewertung nie vorher.
    db = _automatik_db()
    automatik = ReviewAutomation(service_client=db)
    assert automatik.run(today=date(2026, 7, 25)) == (1, 0)
    assert db.tables["guest_reviews_by_host"] == []
    eintrag = db.tables["guest_review_queue"][0]
    assert eintrag["status"] == "geplant"
    assert eintrag["source"] == "marketplace"
    assert eintrag["rating"] == 5
    assert eintrag["text"] == "Danke für den Besuch!"
    # Zweiter Lauf darf NICHTS nachlegen (Wurzel 2).
    assert automatik.run(today=date(2026, 7, 25)) == (0, 0)
    assert len(db.tables["guest_review_queue"]) == 1


def test_automatik_wartet_bis_die_frist_erreicht_ist() -> None:
    db = _automatik_db()
    # Abreise 20.07., Vorlauf 3 Tage → am 22.07. noch nicht fällig.
    assert ReviewAutomation(service_client=db).run(today=date(2026, 7, 22)) == (0, 0)


def test_automatik_regel_nur_ab_x_sternen() -> None:
    db = _automatik_db(auto_review_min_rating=4)
    db.tables["reviews"] = [_markt(rating=2)]
    assert ReviewAutomation(service_client=db).run(today=date(2026, 7, 25)) == (0, 0)

    db2 = _automatik_db(auto_review_min_rating=4)
    db2.tables["reviews"] = [_markt(rating=5)]
    assert ReviewAutomation(service_client=db2).run(today=date(2026, 7, 25)) == (1, 0)


# --- Warteschlange -----------------------------------------------------------

def test_warteschlange_zeigt_restfrist_und_faelligkeit() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    liste = ReviewsService(service_client=db).list_queue(
        _ctx(), status=None, limit=25, offset=0
    )
    assert liste.total == 1
    eintrag = liste.items[0]
    # Abreise 20.07. + 3 Tage Vorlauf = 23.07.; Frist 20.07. + 14 = 03.08.
    assert eintrag.send_at.date() == date(2026, 7, 23)
    assert eintrag.expires_at is not None
    assert eintrag.expires_at.date() == date(2026, 8, 3)
    assert eintrag.status.value == "geplant"


def test_warteschlange_eintrag_aendern() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    service = ReviewsService(service_client=db)
    eintrag_id = db.tables["guest_review_queue"][0]["id"]
    out = service.update_queue_entry(
        _ctx(), eintrag_id,
        QueueUpdateRequest(rating=4, text="<b>Vielen Dank!</b>", recommended=False),
    )
    assert out.rating == 4
    assert out.text == "Vielen Dank!"        # HTML gestrippt (Wurzel 8)
    assert out.recommended is False


def test_warteschlange_ueberspringen_bleibt_stehen() -> None:
    # Der übersprungene Eintrag MUSS bleiben — sonst legt ihn der nächste Tick
    # neu an und der Betrieb überspringt in Endlosschleife.
    db = _automatik_db()
    automatik = ReviewAutomation(service_client=db)
    automatik.run(today=date(2026, 7, 25))
    service = ReviewsService(service_client=db)
    eintrag_id = db.tables["guest_review_queue"][0]["id"]
    assert service.skip_queue_entry(_ctx(), eintrag_id).status.value == "uebersprungen"
    assert automatik.run(today=date(2026, 7, 25)) == (0, 0)
    assert len(db.tables["guest_review_queue"]) == 1


def test_gesendeter_eintrag_ist_nicht_mehr_aenderbar() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    db.tables["guest_review_queue"][0]["status"] = "gesendet"
    service = ReviewsService(service_client=db)
    eintrag_id = db.tables["guest_review_queue"][0]["id"]
    for aktion in (
        lambda: service.update_queue_entry(
            _ctx(), eintrag_id, QueueUpdateRequest(rating=1)
        ),
        lambda: service.skip_queue_entry(_ctx(), eintrag_id),
        lambda: service.send_queue_entry(_ctx(), eintrag_id),
    ):
        with pytest.raises(ReviewError) as exc:
            aktion()
        assert exc.value.status_code == 409


def test_faelliger_eintrag_wird_versendet() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    service = ReviewsService(service_client=db)
    # send_at liegt am 23.07., „jetzt" ist später → fällig.
    assert ReviewQueue(db).send_due(service) == 1
    assert db.tables["guest_review_queue"][0]["status"] == "gesendet"
    assert len(db.tables["guest_reviews_by_host"]) == 1
    # Zweiter Versandlauf darf nichts wiederholen (Wurzel 2).
    assert ReviewQueue(db).send_due(service) == 0


def test_noch_nicht_faelliger_eintrag_bleibt_liegen() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    service = ReviewsService(service_client=db)
    frueh = datetime(2026, 7, 22, tzinfo=UTC)
    assert ReviewQueue(db).send_due(service, now=frueh) == 0
    assert db.tables["guest_review_queue"][0]["status"] == "geplant"


def test_abgelaufener_eintrag_wird_markiert_und_nicht_versendet() -> None:
    db = _automatik_db()
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    service = ReviewsService(service_client=db)
    spaet = datetime(2026, 8, 20, tzinfo=UTC)   # nach der 14-Tage-Frist
    assert ReviewQueue(db).expire_overdue(now=spaet) == 1
    assert db.tables["guest_review_queue"][0]["status"] == "abgelaufen"
    assert ReviewQueue(db).send_due(service, now=spaet) == 0
    assert db.tables["guest_reviews_by_host"] == []


def test_portal_eintrag_nur_fuer_airbnb() -> None:
    # Booking.com und Expedia kennen keine Bewertung des Gasts — dafür darf
    # nichts in der Schlange stehen, das beim Absenden zwangsläufig scheitert.
    db = _automatik_db()
    db.tables["channex_review"] = [
        _ota(id="o-air", channex_review_id="cx-air", ota="AirBNB"),
        _ota(id="o-book", channex_review_id="cx-book", ota="BookingCom"),
    ]
    ReviewAutomation(service_client=db).run(today=date(2026, 7, 25))
    portal = [e for e in db.tables["guest_review_queue"] if e["source"] == "ota"]
    assert [e["review_id"] for e in portal] == ["o-air"]


def test_automatik_ohne_gast_bewertung_greift_die_regel_nicht() -> None:
    # Kein Rateschluss auf einen guten Aufenthalt: ohne Gast-Bewertung wird
    # bei gesetzter Schwelle NICHT bewertet.
    db = _automatik_db(auto_review_min_rating=4)
    assert ReviewAutomation(service_client=db).run(today=date(2026, 7, 25)) == (0, 0)


def test_automatik_ueberspringt_stornierte_reservierung() -> None:
    db = _automatik_db()
    db.tables["reservations"][0]["status"] = "cancelled"
    assert ReviewAutomation(service_client=db).run(today=date(2026, 7, 25)) == (0, 0)


# --- Qualitäts-Dashboard -----------------------------------------------------

def test_qualitaet_normalisiert_beide_skalen_und_laesst_luecken_leer() -> None:
    db = _db(
        reviews=[_markt(created_at="2026-07-02T10:00:00+00:00")],
        channex_review=[_ota(received_at="2026-07-04T10:00:00+00:00")],
    )
    q = ReviewsService(service_client=db).quality(
        _ctx(), von=date(2026, 7, 1), bis=date(2026, 7, 5)
    )
    assert q.count == 2
    # (5 + 4,5) / 2 — die Portal-Note wird halbiert, bevor sie eingeht.
    assert q.average_5 == 4.75
    assert q.five_star_rate == 0.5
    # Der Verlauf hat einen Punkt je Tag; Tage ohne Bewertung bleiben OHNE Wert
    # (eine 0 sähe aus wie ein Einbruch).
    assert len(q.series) == 5
    nach_tag = {p.date.isoformat(): p for p in q.series}
    assert nach_tag["2026-07-02"].average_5 == 5.0
    assert nach_tag["2026-07-03"].average_5 is None
    assert nach_tag["2026-07-03"].count == 0
    assert nach_tag["2026-07-04"].average_5 == 4.5


def test_qualitaet_rangliste_zeigt_das_schwaechste_objekt_zuerst() -> None:
    db = _db(
        reviews=[
            _markt(id="r-gut", rating=5),
            _markt(id="r-schwach", rating=2, property_id=PROP_B,
                   properties={"id": PROP_B, "title": "Haus B", "tenant_id": TENANT}),
        ],
    )
    q = ReviewsService(service_client=db).quality(
        _ctx(), von=date(2026, 6, 1), bis=date(2026, 8, 1)
    )
    assert [(o.title, o.average_5) for o in q.by_property] == [
        ("Haus B", 2.0), ("Haus A", 5.0),
    ]


def test_qualitaet_lehnt_zu_grossen_zeitraum_ab() -> None:
    service = ReviewsService(service_client=_db())
    with pytest.raises(ReviewError) as exc:
        service.quality(_ctx(), von=date(2020, 1, 1), bis=date(2026, 1, 1))
    assert exc.value.status_code == 422


def test_qualitaet_ohne_bewertungen_luegt_nicht() -> None:
    q = ReviewsService(service_client=_db()).quality(
        _ctx(), von=date(2026, 7, 1), bis=date(2026, 7, 5)
    )
    assert q.count == 0
    assert q.average_5 is None
    assert q.five_star_rate is None
    assert q.response_rate is None


def test_kein_entwurf_wenn_das_fenster_schon_zu_ist() -> None:
    # Live gesehen: eine Altbuchung (Abreise vor >14 Tagen) landete als Entwurf
    # in der Schlange, obwohl sie nie versendbar gewesen wäre.
    db = _automatik_db()
    db.tables["reservations"][0]["check_out"] = "2026-07-01"
    assert ReviewAutomation(service_client=db).run(today=date(2026, 7, 20)) == (0, 0)
    assert db.tables["guest_review_queue"] == []
