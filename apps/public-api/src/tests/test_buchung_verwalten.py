"""Die Endpunkte rund um eine bestehende Buchung.

Geprüft wird, was leicht falsch gebaut wird und dann teuer ist:

* **Storno legt einen Auftrag an, statt selbst zu stornieren.** Würde dieser
  Dienst die Kette nachbauen, gäbe es zwei Wege zu freigegebenen Nächten — und
  einer davon meldet es keinem Portal (Wurzel 1). Der Test sieht deshalb auf die
  eingereihte Job-Zeile, nicht auf ein Statusfeld.
* **Zweimal derselbe Aufruf richtet keinen zweiten Schaden an** — Ablage,
  Anreise und Storno sind idempotent (Wurzel 2).
* **Objekt-Beschränkung gilt auf JEDEM dieser Pfade**, nicht nur in der Liste
  (Wurzel 9).
* **Kein Betrag ohne Währung** verlässt den Dienst (Wurzel 4).
"""
from __future__ import annotations

from datetime import date

import pytest

from src.core import errors
from src.core.auth import ApiKontext
from src.v1 import reservations_verwalten as buchungen
from src.v1.schemas_verwalten import (
    BuchungAenderung,
    NachrichtSenden,
    StornoAnfrage,
    VerschiebeAnfrage,
)

from .fake_db import FakeDB

_CTX = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["reservations:read", "reservations:write"],
    property_ids=[],
)
_CTX_FREMD = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["reservations:read", "reservations:write"],
    # Zugang nur für p9 — die Testbuchung hängt an p1.
    property_ids=["p9"],
)


def _db() -> FakeDB:
    return FakeDB(
        {
            "reservations": [
                {
                    "id": "r1",
                    "tenant_id": "t1",
                    "property_id": "p1",
                    "unit_id": None,
                    "rate_plan_id": None,
                    "guest_id": "g1",
                    "status": "confirmed",
                    "channel": "direct",
                    "ota_name": None,
                    "check_in": "2026-09-10",
                    "check_out": "2026-09-14",
                    "total_amount": 4800,
                    "paid_amount": 1200,
                    "currency": "DKK",
                    "payment_status": "partial",
                    "adults": 2,
                    "children": 0,
                    "infants": 0,
                    "pets": 0,
                    "booked_at": "2026-08-01T10:00:00+00:00",
                    "created_at": "2026-08-01T10:00:00+00:00",
                    "updated_at": "2026-08-01T10:00:00+00:00",
                    "cancelled_at": None,
                    "cancelled_by_party": None,
                    "external_ref": None,
                    "note": None,
                    "guest_email": "gast@example.com",
                    "guest_phone": None,
                    "guest_language": "da",
                    "guest_country": "DK",
                    "archived_at": None,
                    "checked_in_at": None,
                    "checked_out_at": None,
                    "quote_items": [
                        {"kind": "lodging", "label": "Übernachtung", "amount": 4400},
                        {"kind": "fee", "label": "Endreinigung", "amount": 400},
                    ],
                }
            ],
            "guests": [
                {"id": "g1", "tenant_id": "t1", "first_name": "Ida", "last_name": "Poulsen"}
            ],
            "guest_message_threads": [
                {
                    "id": "th1",
                    "tenant_id": "t1",
                    "reservation_id": "r1",
                    "property_id": "p1",
                    "host_read_at": None,
                    "host_archived": False,
                    "last_message_at": "2026-08-02T08:00:00+00:00",
                }
            ],
            "guest_messages": [
                {
                    "id": "m1",
                    "thread_id": "th1",
                    "sender": "guest",
                    "body": "Kommen wir später an?",
                    "read_at": None,
                    "created_at": "2026-08-02T08:00:00+00:00",
                }
            ],
            "payments": [
                {
                    "id": "z1",
                    "reservation_id": "r1",
                    "amount": 1200,
                    "currency": "DKK",
                    "type": "deposit",
                    "status": "paid",
                    "gateway": "stripe",
                    "due_at": None,
                    "created_at": "2026-08-01T11:00:00+00:00",
                }
            ],
        }
    )


# -- Preisaufstellung --------------------------------------------------------
def test_quote_gibt_positionen_und_offenen_betrag(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    q = buchungen.quote_lesen("r1", _CTX)

    assert q.currency == "DKK"
    assert float(q.total_amount) == 4800
    assert float(q.due_amount) == 3600
    assert [p.label for p in q.items] == ["Übernachtung", "Endreinigung"]


def test_quote_ohne_waehrung_schlaegt_fehl(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ein Betrag ohne Währung ist keine Auskunft — 1200 kann DKK oder EUR sein."""
    db = _db()
    db.speicher["reservations"][0]["currency"] = None
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.quote_lesen("r1", _CTX)
    assert fehler.value.status == 422


# -- Ändern ------------------------------------------------------------------
def test_aendern_schreibt_nur_mitgeschickte_felder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ein nicht mitgeschicktes Feld darf nicht geleert werden."""
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    buchungen.aendern("r1", BuchungAenderung(note="Späte Anreise"), _CTX)

    zeile = db.speicher["reservations"][0]
    assert zeile["note"] == "Späte Anreise"
    # Nicht mitgeschickt → unverändert, nicht null.
    assert zeile["adults"] == 2
    assert zeile["guest_email"] == "gast@example.com"


def test_aendern_ohne_felder_ist_422(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.aendern("r1", BuchungAenderung(), _CTX)
    assert fehler.value.status == 422


def test_aendern_prueft_die_objektbeschraenkung(monkeypatch: pytest.MonkeyPatch) -> None:
    """Derselbe Scope wie die Liste — sonst IDOR über die bekannte ID."""
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.aendern("r1", BuchungAenderung(note="x"), _CTX_FREMD)
    assert fehler.value.status == 403
    assert fehler.value.code == "objekt_nicht_erlaubt"


def test_uhrzeit_wird_geprueft() -> None:
    with pytest.raises(ValueError, match="HH:MM"):
        BuchungAenderung(checkin_time="16-00")
    with pytest.raises(ValueError, match="außerhalb"):
        BuchungAenderung(checkin_time="25:00")
    assert BuchungAenderung(checkin_time="9:5").checkin_time == "09:05"


# -- An- und Abreise ---------------------------------------------------------
def test_check_in_ist_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Zweimal getippt heißt nicht zweimal angereist — der ERSTE Zeitpunkt gilt."""
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    erste = buchungen.check_in("r1", _CTX)
    zweite = buchungen.check_in("r1", _CTX)

    assert erste.checked_in_at is not None
    assert zweite.checked_in_at == erste.checked_in_at


# -- Ablage ------------------------------------------------------------------
def test_ablegen_und_zurueckholen(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    abgelegt = buchungen.ablegen("r1", _CTX)
    assert abgelegt.archived_at is not None
    # Ablage ist KEIN Storno: Status und Belegung bleiben, wie sie waren.
    assert db.speicher["reservations"][0]["status"] == "confirmed"

    nochmal = buchungen.ablegen("r1", _CTX)
    assert nochmal.archived_at == abgelegt.archived_at

    zurueck = buchungen.zurueckholen("r1", _CTX)
    assert zurueck.archived_at is None


# -- Nachrichten -------------------------------------------------------------
def test_nachrichten_lesen_und_senden(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    vorher = buchungen.nachrichten("r1", _CTX)
    assert [n.body for n in vorher] == ["Kommen wir später an?"]

    gesendet = buchungen.nachricht_senden("r1", NachrichtSenden(body="Ja, gerne."), _CTX)
    assert gesendet.sender == "host"
    assert len(db.speicher["guest_messages"]) == 2
    # Gegenzustand: das Gespräch steht danach oben in der Liste.
    assert db.speicher["guest_message_threads"][0]["last_message_at"] == (
        gesendet.created_at.isoformat()
    )


def test_senden_ohne_gespraech_ist_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """Diese API eröffnet kein Gespräch — sie hängt an ein vorhandenes an."""
    db = _db()
    db.speicher["guest_message_threads"] = []
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.nachricht_senden("r1", NachrichtSenden(body="Hallo"), _CTX)
    assert fehler.value.status == 404


def test_gelesen_melden_zaehlt_richtig(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    assert buchungen.ungelesen(_CTX).unread_messages == 1

    danach = buchungen.gelesen_melden("r1", _CTX)
    assert danach.unread_messages == 0
    assert danach.unread_threads == 0


# -- Zahlungen ---------------------------------------------------------------
def test_zahlungen_lesen(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    zahlungen = buchungen.zahlungen("r1", _CTX)
    assert len(zahlungen) == 1
    assert zahlungen[0].currency == "DKK"
    assert zahlungen[0].gateway == "stripe"


def test_zahlung_ohne_waehrung_schlaegt_fehl(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    db.speicher["payments"][0]["currency"] = None
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.zahlungen("r1", _CTX)
    assert fehler.value.status == 422


# -- Storno ------------------------------------------------------------------
def test_storno_reiht_einen_auftrag_ein_statt_selbst_zu_stornieren(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Der Kern dieser Datei.

    Der Endpunkt darf die Buchung NICHT selbst auf `cancelled` setzen. Täte er
    das, wären die Nächte weiterhin belegt, kein Portal informiert und keine
    Storno-Gebühr gerechnet — eine Buchung, die aussieht wie storniert und es
    nicht ist.
    """
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    antwort = buchungen.stornieren(
        "r1", StornoAnfrage(reason="Gast abgesagt", party="gast"), _CTX
    )

    assert antwort.status == "accepted"
    # Nichts an der Buchung verändert.
    assert db.speicher["reservations"][0]["status"] == "confirmed"
    assert db.speicher["reservations"][0]["cancelled_at"] is None

    assert len(db.rpc_aufrufe) == 1
    name, parameter = db.rpc_aufrufe[0]
    assert name == "enqueue_job"
    assert parameter["p_job_type"] == "public_api_cancel_reservation"
    assert parameter["p_dedup_key"] == "public_api_cancel:r1"
    # `run_after` MUSS ein Zeitstempel sein: bei NULL fände der Claim-Loop den
    # Auftrag nie (`run_after <= now()` vergleicht NULL zu nichts).
    assert parameter["p_run_after"]
    nutzlast = parameter["p_payload"]
    assert nutzlast["partei"] == "gast"
    assert nutzlast["reservation_id"] == "r1"
    # Der Zugang steht im Grund — sonst weiß niemand, wer storniert hat.
    assert "mnd_live_id_abc" in nutzlast["reason"]


def test_storno_zweimal_ergibt_einen_vorgang(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)
    anfrage = StornoAnfrage(reason="Gast abgesagt", party="gast")

    buchungen.stornieren("r1", anfrage, _CTX)
    buchungen.stornieren("r1", anfrage, _CTX)

    schluessel = {p["p_dedup_key"] for _, p in db.rpc_aufrufe}
    assert schluessel == {"public_api_cancel:r1"}


def test_storno_einer_stornierten_buchung_tut_nichts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _db()
    db.speicher["reservations"][0]["status"] = "cancelled"
    db.speicher["reservations"][0]["cancelled_at"] = "2026-08-05T09:00:00+00:00"
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    antwort = buchungen.stornieren(
        "r1", StornoAnfrage(reason="nochmal", party="betrieb"), _CTX
    )

    assert antwort.status == "already_cancelled"
    assert antwort.cancelled_at is not None
    assert db.rpc_aufrufe == []


def test_storno_prueft_die_objektbeschraenkung(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.stornieren(
            "r1", StornoAnfrage(reason="Gast abgesagt", party="gast"), _CTX_FREMD
        )
    assert fehler.value.status == 403
    assert db.rpc_aufrufe == []


# -- Verschieben -------------------------------------------------------------
def _mit_kalender(db: FakeDB) -> FakeDB:
    """Kalender und Einheit ergänzen, damit die Zieltage prüfbar sind."""
    db.speicher["property_units"] = [
        {"id": "u1", "tenant_id": "t1", "property_id": "p1", "active": True}
    ]
    db.speicher["availability"] = []
    db.speicher["property_sales_stop"] = []
    return db


def test_verschieben_reiht_auftrag_ein(monkeypatch: pytest.MonkeyPatch) -> None:
    """Der Endpunkt verschiebt NICHT selbst — er beauftragt."""
    db = _mit_kalender(_db())
    monkeypatch.setattr(buchungen, "service_db", lambda: db)
    monkeypatch.setattr(
        buchungen, "freie_einheiten_spannen",
        lambda *a, **k: [(date(2026, 9, 17), date(2026, 9, 21), 1)],
    )

    antwort = buchungen.verschieben(
        "r1",
        VerschiebeAnfrage(
            property_id="p1", check_in=date(2026, 9, 17), check_out=date(2026, 9, 21)
        ),
        _CTX,
    )

    assert antwort.status == "accepted"
    # Die Buchung liegt weiterhin im alten Zeitraum.
    assert db.speicher["reservations"][0]["check_in"] == "2026-09-10"

    name, parameter = db.rpc_aufrufe[0]
    assert name == "enqueue_job"
    assert parameter["p_job_type"] == "public_api_move_reservation"
    assert parameter["p_dedup_key"] == "public_api_move:r1"
    assert parameter["p_payload"]["check_in"] == "2026-09-17"
    assert parameter["p_run_after"]


def test_verschieben_belegter_zieltag_ist_409(monkeypatch: pytest.MonkeyPatch) -> None:
    """Der häufigste Fehlerfall wird SOFORT beantwortet, nicht per Ereignis."""
    db = _mit_kalender(_db())
    monkeypatch.setattr(buchungen, "service_db", lambda: db)
    monkeypatch.setattr(
        buchungen, "freie_einheiten_spannen",
        lambda *a, **k: [(date(2026, 9, 17), date(2026, 9, 21), 0)],
    )

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.verschieben(
            "r1",
            VerschiebeAnfrage(
                property_id="p1", check_in=date(2026, 9, 17), check_out=date(2026, 9, 21)
            ),
            _CTX,
        )
    assert fehler.value.status == 409
    assert fehler.value.code == "zeitraum_nicht_verfuegbar"
    assert db.rpc_aufrufe == []


def test_verlaengerung_blockiert_sich_nicht_selbst(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Die eigenen Nächte entlasten um EINE Einheit.

    Ohne diese Rechnung wäre eine Verlängerung um einen Tag unmöglich: die
    Nächte, die die Buchung selbst hält, stehen im Kalender als belegt.
    """
    db = _mit_kalender(_db())
    monkeypatch.setattr(buchungen, "service_db", lambda: db)
    # 10.–13. sind die eigenen Nächte (frei = 0), der 14. ist frei.
    monkeypatch.setattr(
        buchungen, "freie_einheiten_spannen",
        lambda *a, **k: [
            (date(2026, 9, 10), date(2026, 9, 13), 0),
            (date(2026, 9, 14), date(2026, 9, 14), 1),
        ],
    )

    antwort = buchungen.verschieben(
        "r1",
        VerschiebeAnfrage(
            property_id="p1", check_in=date(2026, 9, 10), check_out=date(2026, 9, 15)
        ),
        _CTX,
    )
    assert antwort.status == "accepted"


def test_eigene_naechte_entlasten_nur_im_zielobjekt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Bei einem Objektwechsel entlastet nichts — dort hält die Buchung nichts."""
    db = _mit_kalender(_db())
    monkeypatch.setattr(buchungen, "service_db", lambda: db)
    monkeypatch.setattr(
        buchungen, "freie_einheiten_spannen",
        lambda *a, **k: [(date(2026, 9, 10), date(2026, 9, 13), 0)],
    )

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.verschieben(
            "r1",
            VerschiebeAnfrage(
                property_id="p2", check_in=date(2026, 9, 10), check_out=date(2026, 9, 14)
            ),
            _CTX,
        )
    assert fehler.value.status == 409


def test_verschieben_einer_portalbuchung_ist_409(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sonst verkauft das Portal die freigegebenen Nächte weiter."""
    db = _mit_kalender(_db())
    db.speicher["reservations"][0]["source_channex_booking_id"] = "chx-1"
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.verschieben(
            "r1",
            VerschiebeAnfrage(
                property_id="p1", check_in=date(2026, 9, 17), check_out=date(2026, 9, 21)
            ),
            _CTX,
        )
    assert fehler.value.status == 409
    assert fehler.value.code == "portalbuchung"
    assert db.rpc_aufrufe == []


def test_eingecheckter_gast_wird_nicht_verschoben(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _mit_kalender(_db())
    db.speicher["reservations"][0]["checked_in_at"] = "2026-09-10T15:00:00+00:00"
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.verschieben(
            "r1",
            VerschiebeAnfrage(
                property_id="p1", check_in=date(2026, 9, 17), check_out=date(2026, 9, 21)
            ),
            _CTX,
        )
    assert fehler.value.code == "gast_eingecheckt"


def test_verschieben_prueft_auch_das_zielobjekt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ein beschränkter Zugang darf keine Buchung in ein fremdes Objekt legen."""
    db = _mit_kalender(_db())
    db.speicher["reservations"][0]["property_id"] = "p9"
    ctx = ApiKontext(
        tenant_id="t1",
        client_pk="c1",
        client_id="mnd_live_id_abc",
        scopes=["reservations:write"],
        property_ids=["p9"],
    )
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.verschieben(
            "r1",
            VerschiebeAnfrage(
                property_id="p1", check_in=date(2026, 9, 17), check_out=date(2026, 9, 21)
            ),
            ctx,
        )
    assert fehler.value.status == 403
    assert db.rpc_aufrufe == []
