"""Airbnb-Anfragen als Posteingang-Threads (0398).

Geprüft wird vor allem das, was live schiefging oder schiefgehen KANN:

* Dieselbe Anfrage kommt zweimal herein (Webhook + Live-Feed-Tick) und stand
  ungefiltert zweimal im Posteingang.
* Die Webhook-Zeile lässt die Spalte `live_feed_event_id` leer, obwohl der Wert
  in ihrem Payload steht — ohne Rückgriff wäre der Antwort-Knopf tot.
* Die beiden Eingangswege verpacken die Payload UNTERSCHIEDLICH tief.
* Die Frist darf nur aus Airbnbs `non_response_at` kommen, nie aus unserer Uhr.
* Die angebotenen Aktionen müssen zu dem passen, was der channel_manager
  tatsächlich annimmt — sonst zeigt die Oberfläche Knöpfe, die 422 werfen.

Die Beispielwerte sind erfunden; die FORMEN stammen aus der live gemessenen
Payload vom 18.08.2026 (keine echten Gastdaten im Quellcode).
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_anfragen import (
    AKTION_ZU_EVENT,
    AUFLOESBARE_EVENTS,
)
from src.features.inbox import anfragen

# --- Payload-Formen, wie sie live in der Tabelle liegen ---------------------
# Der Live-Feed-Tick legt `booking_details` FLACH ab.
_DETAILS = {
    "nights": 2,
    "currency": "DKK",
    "guest_name": "Testgast",
    "listing_name": "Testobjekt",
    "checkin_date": "2026-08-26",
    "checkout_date": "2026-08-28",
    "payout_amount": "2906.80",
    "number_of_pets": 1,
    "non_response_at": "2026-08-18T18:57:40.719Z",
    "number_of_adults": 2,
    "number_of_guests": 4,
    "number_of_infants": 1,
    "number_of_children": 2,
}

PAYLOAD_LIVE_FEED = {
    "status": "active",
    "booking_details": _DETAILS,
    "message_thread_id": "thread-abc",
}

# Der Webhook verpackt dasselbe eine Ebene tiefer.
PAYLOAD_WEBHOOK = {
    "event": "inquiry",
    "payload": {
        "status": "active",
        "booking_details": _DETAILS,
        "message_thread_id": "thread-abc",
        "live_feed_event_id": "live-1",
    },
    "property_id": "prop-1",
}


def test_beide_payload_formen_liefern_dieselben_details() -> None:
    """Webhook und Live-Feed verpacken verschieden — der Zugriff ist EINER."""
    assert anfragen.details_aus(PAYLOAD_WEBHOOK) == _DETAILS
    assert anfragen.details_aus(PAYLOAD_LIVE_FEED) == _DETAILS


def test_thread_ref_aus_beiden_formen() -> None:
    """Die Klammer zum Chat muss auf beiden Wegen gefunden werden."""
    assert anfragen.thread_ref_aus(PAYLOAD_WEBHOOK) == "thread-abc"
    assert anfragen.thread_ref_aus(PAYLOAD_LIVE_FEED) == "thread-abc"


def test_frist_kommt_aus_non_response_at() -> None:
    assert anfragen.frist_aus(PAYLOAD_WEBHOOK) == "2026-08-18T18:57:40.719Z"


def test_ohne_non_response_at_keine_frist() -> None:
    """Kein Ersatzwert (Wurzel 4): lieber gar kein Countdown als ein geratener.

    „created_at + 24 h" wäre unsere Uhr plus Faustregel — plausibel und falsch,
    sobald Airbnb die Frist einmal anders setzt.
    """
    ohne = {"booking_details": {k: v for k, v in _DETAILS.items() if k != "non_response_at"}}
    assert anfragen.frist_aus(ohne) is None


def test_live_feed_id_faellt_auf_payload_zurueck() -> None:
    """Die Webhook-Zeile hat die SPALTE leer — der Wert steht im Payload.

    Genau so lag die Lisa-Anfrage live in der Tabelle. Ohne diesen Rückgriff
    wäre eine von zwei Zeilen derselben Anfrage nicht beantwortbar gewesen.
    """
    assert anfragen.live_feed_id_aus(PAYLOAD_WEBHOOK, None) == "live-1"
    assert anfragen.live_feed_id_aus(PAYLOAD_WEBHOOK, "  ") == "live-1"


def test_live_feed_id_bevorzugt_die_spalte() -> None:
    assert anfragen.live_feed_id_aus(PAYLOAD_WEBHOOK, "live-spalte") == "live-spalte"


def test_ohne_jede_id_kein_ersatzwert() -> None:
    assert anfragen.live_feed_id_aus(PAYLOAD_LIVE_FEED, None) is None


def test_entdoppelt_fasst_webhook_und_live_feed_zusammen() -> None:
    """Dieselbe Anfrage zweimal in der Tabelle → EIN Thread (Wurzel 2).

    Der UNIQUE-Index greift hier nicht: er liegt auf `live_feed_event_id`, und
    die Webhook-Zeile lässt die Spalte leer. Ungefiltert stünde die Anfrage
    zweimal im Posteingang, mit zwei Knöpfen, von denen einer 409 wirft.
    """
    zeilen = [
        {"id": "row-webhook", "payload": PAYLOAD_WEBHOOK, "live_feed_event_id": None},
        {
            "id": "row-feed",
            "payload": PAYLOAD_LIVE_FEED,
            "live_feed_event_id": "live-1",
        },
    ]
    uebrig = anfragen._entdoppelt(zeilen)
    assert len(uebrig) == 1
    # Die Zeile mit gefüllter SPALTE gewinnt — nur sie besteht die Prüfung in
    # `_require_airbnb_anfrage`.
    assert uebrig[0]["id"] == "row-feed"


def test_entdoppelt_behaelt_verschiedene_anfragen() -> None:
    zeilen = [
        {"id": "a", "payload": {"live_feed_event_id": "live-1"}, "live_feed_event_id": "live-1"},
        {"id": "b", "payload": {"live_feed_event_id": "live-2"}, "live_feed_event_id": "live-2"},
    ]
    assert len(anfragen._entdoppelt(zeilen)) == 2


def test_entdoppelt_behaelt_zeilen_ohne_channex_id_einzeln() -> None:
    """Altbestand vor 0284 hat keinen gemeinsamen Schlüssel — nie zusammenwerfen."""
    zeilen = [
        {"id": "a", "payload": {}, "live_feed_event_id": None},
        {"id": "b", "payload": {}, "live_feed_event_id": None},
    ]
    assert len(anfragen._entdoppelt(zeilen)) == 2


def test_thread_id_rundlauf() -> None:
    tid = anfragen.thread_id_fuer("event-1")
    assert anfragen.ist_anfrage(tid)
    assert anfragen.event_id_aus(tid) == "event-1"


def test_fremde_thread_ids_sind_keine_anfragen() -> None:
    """Die anderen Nebenquellen dürfen nicht in diesen Lesepfad geraten."""
    assert not anfragen.ist_anfrage("mb:123")
    assert not anfragen.ist_anfrage("ue:123")
    assert not anfragen.ist_anfrage("8f0c-uuid-einer-buchung")


def test_zahl_weist_bool_ab() -> None:
    """`bool` ist ein `int` — ungeprüft würde aus True eine „1 Kinder"-Zeile."""
    assert anfragen._zahl(True) is None
    assert anfragen._zahl(0) == "0"
    assert anfragen._zahl(3) == "3"
    assert anfragen._zahl(None) is None


def test_fakten_tragen_die_waehrung_aus_den_daten() -> None:
    """Kein €-Hardcode (Wurzel 4): DKK muss durchkommen."""
    fakten = anfragen._fakten("inquiry", _DETAILS, "2026-08-18T18:57:40.719Z")
    werte = {f.label: f.value for f in fakten}
    assert werte["anfrageWaehrung"] == "DKK"
    assert werte["anfragePayout"] == "2906.80"
    assert werte["anfrageArt"] == "inquiry"
    assert werte["anfrageFrist"] == "2026-08-18T18:57:40.719Z"


def test_fakten_lassen_fehlende_werte_weg() -> None:
    fakten = anfragen._fakten("inquiry", {}, None)
    assert [f.label for f in fakten] == ["anfrageArt"]


# --- Gleichlauf mit dem channel_manager ------------------------------------
def test_anfragearten_decken_sich_mit_dem_sendeweg() -> None:
    """Was der Posteingang zeigt, muss der Sendeweg auch auflösen können."""
    assert anfragen.ANFRAGE_EVENTS == AUFLOESBARE_EVENTS


def test_angebotene_aktionen_sind_genau_die_erlaubten() -> None:
    """Kein Knopf, den der Service mit 422 abweist — und keiner fehlt.

    `AKTIONEN_JE_ART` (Leseseite) und `AKTION_ZU_EVENT` (Sendeseite) sind zwei
    Tabellen für dieselbe Sache. Liefen sie auseinander, böte die Oberfläche
    einer Voranfrage ein „annehmen" an, das Airbnb gar nicht kennt.
    """
    erwartet: dict[str, set[str]] = {}
    for aktion, event in AKTION_ZU_EVENT.items():
        erwartet.setdefault(event, set()).add(aktion)
    tatsaechlich = {k: set(v) for k, v in anfragen.AKTIONEN_JE_ART.items()}
    assert tatsaechlich == erwartet


# --- Portal-Status aus der System-Nachricht (Channex Messages Collection) ----
# Die Channex-Doku sagt: „Inside Messages you will see special message with
# information about Inquiry" — mit `meta.status`. Das ist die EINZIGE Quelle,
# die den Vorgang fortschreibt; `live_feed.payload.status` bleibt auf dem Stand
# des Eingangs stehen (live nachgemessen: einen Tag nach der Antwort noch
# „active").


def _msg(status: str | None, zeit: str) -> dict:
    meta: dict[str, object] = {"name": "Test"}
    if status is not None:
        meta["status"] = status
    return {"attributes": {"meta": meta, "inserted_at": zeit}}


def test_ohne_systemnachricht_kein_status() -> None:
    """Der Normalfall, solange der Vorgang laeuft — dann sagt das Portal nichts.

    Wichtig, dass hier `None` steht und nicht `active`: der Aufrufer muss
    unterscheiden koennen zwischen „Portal sagt: offen" und „Portal sagt
    nichts" (Wurzel 4: keine erfundene Auskunft).
    """
    assert anfragen.portal_status_aus([]) is None
    assert anfragen.portal_status_aus(None) is None
    assert anfragen.portal_status_aus([_msg(None, "2026-08-17T18:57:41")]) is None


def test_status_aus_der_systemnachricht() -> None:
    assert anfragen.portal_status_aus([_msg("accepted", "2026-08-18T10:00:00")]) == "accepted"


def test_juengste_systemnachricht_gewinnt() -> None:
    """Der Vorgang wird fortgeschrieben (aktiv → angenommen) — die letzte gilt."""
    roh = [
        _msg("active", "2026-08-17T18:57:41"),
        _msg("accepted", "2026-08-18T10:00:00"),
    ]
    assert anfragen.portal_status_aus(roh) == "accepted"
    # Reihenfolge der Liste darf egal sein — sortiert wird ueber die Zeit.
    assert anfragen.portal_status_aus(list(reversed(roh))) == "accepted"


def test_unbekannter_status_wird_nicht_geraten() -> None:
    """Ein neuer Portal-Wert wird gemeldet, nicht als „erledigt" gedeutet.

    Ihn stillschweigend als Abschluss zu werten, schaltete eine womoeglich
    noch offene Anfrage stumm (Wurzel 4/5).
    """
    assert anfragen.portal_status_aus([_msg("voellig_neu_zzz", "2026-08-18T10:00:00")]) is None


def test_status_ist_case_unabhaengig() -> None:
    assert anfragen.portal_status_aus([_msg("ACCEPTED", "2026-08-18T10:00:00")]) == "accepted"


def test_aktiv_ist_kein_abschluss() -> None:
    """`active` ist der einzige Zustand, in dem noch etwas zu entscheiden ist."""
    assert anfragen.STATUS_AKTIV == "active"
    assert anfragen.STATUS_AKTIV in anfragen.BEKANNTE_STATUS
    assert anfragen.portal_status_aus([_msg("active", "2026-08-18T10:00:00")]) == "active"


def test_bekannte_status_geschlossen() -> None:
    """Die Menge ist bewusst geschlossen — sonst raet die Anzeige."""
    assert anfragen.BEKANNTE_STATUS == frozenset(
        {"active", "accepted", "declined", "expired", "withdrawn", "cancelled"}
    )
