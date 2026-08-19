"""Airbnb-Anfragen beantworten: die Formen sind NICHT gleich.

Warum diese Tests: Airbnb verlangt für die drei Anfragearten drei verschiedene
Formen. Bei Reservation Request ist `accept` ein BOOLEAN, bei Alteration ein
STRING. Wer beides über eine Funktion schickt, sendet `true` statt `"accept"` —
Airbnb antwortet 422, die 24-Stunden-Frist läuft weiter und der Auto-Decline
schlägt zu. Diese Tests halten die Formen getrennt.

Quellen: `docs/OTA/Airbnb/Airbnb Reservation Request.pdf`,
`Airbnb Alteration Request.pdf`, `Airbnb Inquiry.pdf`.
"""
from __future__ import annotations

import pytest

from src.features.channel_manager import airbnb_anfragen as aa

# --- Reservation Request: accept ist ein BOOLEAN ---------------------------


def test_annehmen_ist_boolean_true():
    resolution = aa.reservation_request_annehmen()
    assert resolution == {"accept": True}
    # Ausdrücklich: KEIN String. Das ist der Unterschied zur Alteration.
    assert resolution["accept"] is True
    assert not isinstance(resolution["accept"], str)


def test_ablehnen_mit_grund_und_nachrichten():
    assert aa.reservation_request_ablehnen(
        grund=aa.ABLEHNUNG_DATEN_BELEGT,
        nachricht_an_gast="Leider belegt.",
        nachricht_an_airbnb="Kalender war nicht aktuell.",
    ) == {
        "accept": False,
        "reason": "dates_not_available",
        "decline_message_to_guest": "Leider belegt.",
        "decline_message_to_airbnb": "Kalender war nicht aktuell.",
    }


def test_ablehnen_ohne_nachrichten():
    """Beide Nachrichten sind optional — leere Felder werden weggelassen."""
    assert aa.reservation_request_ablehnen(grund=aa.ABLEHNUNG_UNPASSEND) == {
        "accept": False,
        "reason": "not_a_good_fit",
    }
    assert aa.reservation_request_ablehnen(
        grund=aa.ABLEHNUNG_UNPASSEND, nachricht_an_gast="   "
    ) == {"accept": False, "reason": "not_a_good_fit"}


def test_alle_vier_gruende_erlaubt():
    assert len(aa.ABLEHNUNGSGRUENDE) == 4
    for grund in aa.ABLEHNUNGSGRUENDE:
        assert aa.reservation_request_ablehnen(grund=grund)["reason"] == grund


def test_eigener_grund_wird_abgewiesen():
    """Wurzel 5: fail-closed. Ein Freitext-Grund wäre ein 422 — und die Anfrage
    bliebe offen, bis Airbnb sie selbst ablehnt."""
    with pytest.raises(aa.AnfrageFehler, match="unbekannt"):
        aa.reservation_request_ablehnen(grund="passt_mir_nicht")


def test_zu_lange_nachricht_wird_nicht_still_gekappt():
    """Abschneiden würde die Aussage des Gastgebers verfälschen."""
    with pytest.raises(aa.AnfrageFehler, match="höchstens"):
        aa.reservation_request_ablehnen(
            grund=aa.ABLEHNUNG_UNWOHL, nachricht_an_gast="x" * 2001
        )


# --- Alteration: accept ist ein STRING ------------------------------------


def test_alteration_ist_string_nicht_boolean():
    """Die zentrale Falle. `true` statt `"accept"` ist ein 422."""
    for entscheidung in ("accept", "decline", "cancel"):
        resolution = aa.alteration_entscheiden(entscheidung)
        assert resolution == {"accept": entscheidung}
        assert isinstance(resolution["accept"], str)
        assert resolution["accept"] is not True


def test_alteration_boolean_wird_abgewiesen():
    with pytest.raises(aa.AnfrageFehler):
        aa.alteration_entscheiden("true")


def test_alle_drei_alteration_entscheidungen():
    assert aa.ALTERATION_ENTSCHEIDUNGEN == frozenset({"accept", "decline", "cancel"})


def test_zuruecknehmen_ist_nicht_ablehnen():
    """`cancel` zieht den EIGENEN Änderungswunsch zurück, `decline` weist den des
    Gastes ab. Zwei verschiedene Vorgänge, gleiche Form."""
    assert aa.alteration_entscheiden(aa.ALTERATION_ZURUECKZIEHEN) == {"accept": "cancel"}
    assert aa.alteration_entscheiden(aa.ALTERATION_ABLEHNEN) == {"accept": "decline"}


# --- Inquiry: type-basiert ------------------------------------------------


def test_vorab_genehmigen():
    assert aa.inquiry_vorab_genehmigen(sofortbuchung_sperren=True) == {
        "type": "preapproval",
        "block_instant_booking": True,
    }
    assert aa.inquiry_vorab_genehmigen(sofortbuchung_sperren=False) == {
        "type": "preapproval",
        "block_instant_booking": False,
    }


def test_sonderpreis_in_minor_units():
    """Airbnb: „10000 for 100.00 USD" — Ganzzahl in der kleinsten Einheit."""
    assert aa.inquiry_sonderpreis(gesamtpreis_minor=10000) == {
        "type": "special_offer",
        "total_price": 10000,
    }


def test_sonderpreis_weist_haupteinheiten_ab():
    """100.00 statt 10000 wäre ein Faktor-100-Fehler zu Lasten des Betriebs."""
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=100.0)
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor="10000")


def test_sonderpreis_weist_bool_ab():
    """`True` ist in Python ein int — hier aber kein Betrag."""
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=True)


@pytest.mark.parametrize("betrag", [0, -1, -10000])
def test_sonderpreis_muss_positiv_sein(betrag):
    with pytest.raises(aa.AnfrageFehler, match="größer als 0"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=betrag)


def test_aufloesbare_events():
    """Genau die drei Anfragearten — nichts anderes darf hier landen."""
    assert aa.AUFLOESBARE_EVENTS == frozenset(
        {"reservation_request", "inquiry", "alteration_request"}
    )


# --- Änderung schon direkt bei Airbnb bestätigt (19.08.2026) ----------------
# Der `resolved`-Guard kennt nur UNSERE Quittung. Bestätigt der Betrieb die
# Änderung in der Airbnb-App (weil er sie im Posteingang nicht fand), ist sie
# beim Portal erledigt und hier weiter offen — ein Klick auf „annehmen" schickte
# dieselbe Entscheidung ein zweites Mal raus.
#
# Die Formen unten sind die live gemessenen (HMDPNRZJAN, 19.08.2026), die Werte
# gekürzt.
_CODE = "HMDPNRZJAN"

_ANFRAGE_PAYLOAD = {
    "bms": {
        "raw_message": {
            "reservation": {
                "confirmation_code": _CODE,
                # ACHTUNG: Diese beiden stehen schon beim EINGANG so da.
                "status": "modified",
                "status_type": "accept",
            }
        }
    },
}


class _DbAttrappe:
    """Minimaler Supabase-Ersatz: merkt sich den Filter, gibt feste Zeilen."""

    def __init__(self, zeilen: list[dict[str, object]]) -> None:
        self._zeilen = zeilen
        self.filter: dict[str, object] = {}

    def table(self, _name: str) -> _DbAttrappe:
        return self

    def select(self, *_a: object, **_k: object) -> _DbAttrappe:
        return self

    def eq(self, spalte: str, wert: object) -> _DbAttrappe:
        self.filter[spalte] = wert
        return self

    def limit(self, _n: int) -> _DbAttrappe:
        return self

    def execute(self) -> object:
        return type("Res", (), {"data": self._zeilen})()


def _dienst(zeilen: list[dict[str, object]]):
    from src.features.channel_manager.service import ChannelManagerService

    return ChannelManagerService(service_client=_DbAttrappe(zeilen))  # type: ignore[arg-type]


def test_payload_status_ist_kein_beleg_fuer_bestaetigung():
    """DER KERN: `status`/`status_type` tragen schon beim Eingang
    „modified"/„accept". Als Guard genommen hätten sie JEDEN Änderungswunsch
    sofort abgewiesen und den Antwort-Knopf totgelegt."""
    # Buchung vorhanden, aber OHNE Bestätigungsmeldung → die Anfrage ist offen.
    dienst = _dienst([{"raw": {"raw_message": '{"action":"reservation","x":1}'}}])
    assert (
        dienst._alteration_schon_beim_portal_bestaetigt("t1", _ANFRAGE_PAYLOAD)
        is False
    )


def test_bestaetigungsmeldung_wird_erkannt():
    roh = '{"action":"reservation_alteration_confirmation","provider":"airbnb"}'
    dienst = _dienst([{"raw": {"raw_message": roh}}])
    assert (
        dienst._alteration_schon_beim_portal_bestaetigt("t1", _ANFRAGE_PAYLOAD)
        is True
    )


def test_beide_payload_formen_finden_den_code():
    """Webhook verpackt eine Ebene tiefer als der Live-Feed-Tick."""
    roh = '{"action":"reservation_alteration_confirmation"}'
    webhook = {"event": "alteration_request", "payload": _ANFRAGE_PAYLOAD}
    dienst = _dienst([{"raw": {"raw_message": roh}}])
    assert dienst._alteration_schon_beim_portal_bestaetigt("t1", webhook) is True


def test_pruefung_ist_tenant_gescopt():
    """Wurzel 3: Airbnb-Codes sind nicht global eindeutig gegen fremde
    Mandanten — der Scope MUSS im Query stehen."""
    db = _DbAttrappe([{"raw": {"raw_message": "{}"}}])
    from src.features.channel_manager.service import ChannelManagerService

    dienst = ChannelManagerService(service_client=db)  # type: ignore[arg-type]
    dienst._alteration_schon_beim_portal_bestaetigt("t-42", _ANFRAGE_PAYLOAD)
    assert db.filter["tenant_id"] == "t-42"
    assert db.filter["ota_reservation_code"] == _CODE


def test_ohne_buchung_bleibt_der_weg_offen():
    """Fail-OPEN mit Absicht: eine offene Anfrage läuft bei Airbnb nach ~24 h
    in die automatische Ablehnung. Ein Guard, der bei Unklarheit sperrt, kostet
    dem Betrieb die Buchung."""
    assert _dienst([])._alteration_schon_beim_portal_bestaetigt(
        "t1", _ANFRAGE_PAYLOAD
    ) is False


def test_ohne_bestaetigungscode_keine_pruefung():
    dienst = _dienst([{"raw": {"raw_message": "{}"}}])
    for payload in (None, {}, {"bms": {}}, {"bms": {"raw_message": {}}}):
        assert (
            dienst._alteration_schon_beim_portal_bestaetigt("t1", payload) is False
        )


def test_db_fehler_blockiert_den_antwortweg_nicht():
    class _Kaputt(_DbAttrappe):
        def execute(self):
            raise RuntimeError("DB weg")

    from src.features.channel_manager.service import ChannelManagerService

    dienst = ChannelManagerService(service_client=_Kaputt([]))  # type: ignore[arg-type]
    assert (
        dienst._alteration_schon_beim_portal_bestaetigt("t1", _ANFRAGE_PAYLOAD)
        is False
    )


def test_bestaetigungsmeldung_heisst_wie_bei_airbnb():
    """Der Name ist Airbnbs, nicht unserer — er darf nicht umbenannt werden."""
    assert aa.ALTERATION_BESTAETIGT_MELDUNG == "reservation_alteration_confirmation"


def test_bestaetigte_aenderung_geht_nicht_zweimal_an_airbnb(monkeypatch):
    """Der ganze Weg: schon bei Airbnb bestätigt → 409, und NICHTS gesendet.

    Das ist die Prüfung, auf die es ankommt — die Einzelteile können stimmen und
    der Guard trotzdem nicht eingehängt sein (er hing zuerst an einem `payload`,
    das die Select-Liste nicht mitlas, und griff deshalb nie).
    """
    from src.core.security import AuthContext
    from src.features.channel_manager.schemas import AirbnbAnfrageAntwort
    from src.features.channel_manager.service import (
        ChannelManagerError,
        ChannelManagerService,
    )

    dienst = ChannelManagerService(service_client=_DbAttrappe([]))  # type: ignore[arg-type]
    monkeypatch.setattr(
        ChannelManagerService,
        "_require_airbnb_anfrage",
        lambda _s, _c, _e: (
            "t1",
            {
                "id": "ev-1",
                "event": "alteration_request",
                "resolved": False,
                "live_feed_event_id": "live-1",
                "payload": _ANFRAGE_PAYLOAD,
            },
        ),
    )
    monkeypatch.setattr(
        ChannelManagerService,
        "_alteration_schon_beim_portal_bestaetigt",
        lambda _s, _t, _p: True,
    )

    gesendet: list[object] = []
    monkeypatch.setattr(
        ChannelManagerService,
        "airbnb_anfrage_aufloesen",
        lambda _s, _c, _e, r: gesendet.append(r),
    )

    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin", permissions=frozenset())
    with pytest.raises(ChannelManagerError) as fehler:
        dienst.airbnb_anfrage_beantworten(
            ctx, "ev-1", AirbnbAnfrageAntwort(aktion="alteration_annehmen")
        )
    assert fehler.value.status_code == 409
    assert "bereits direkt bei Airbnb" in fehler.value.message
    # Der Kern: kein zweiter Aufruf ans Portal.
    assert gesendet == []


def test_offene_aenderung_wird_normal_gesendet(monkeypatch):
    """Gegenprobe: ist beim Portal nichts bestätigt, läuft der Weg wie bisher."""
    from src.core.security import AuthContext
    from src.features.channel_manager.schemas import AirbnbAnfrageAntwort
    from src.features.channel_manager.service import ChannelManagerService

    dienst = ChannelManagerService(service_client=_DbAttrappe([]))  # type: ignore[arg-type]
    monkeypatch.setattr(
        ChannelManagerService,
        "_require_airbnb_anfrage",
        lambda _s, _c, _e: (
            "t1",
            {
                "id": "ev-1",
                "event": "alteration_request",
                "resolved": False,
                "live_feed_event_id": "live-1",
                "payload": _ANFRAGE_PAYLOAD,
            },
        ),
    )
    monkeypatch.setattr(
        ChannelManagerService,
        "_alteration_schon_beim_portal_bestaetigt",
        lambda _s, _t, _p: False,
    )
    gesendet: list[object] = []
    monkeypatch.setattr(
        ChannelManagerService,
        "airbnb_anfrage_aufloesen",
        lambda _s, _c, _e, r: gesendet.append(r) or {"ok": True},
    )

    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin", permissions=frozenset())
    dienst.airbnb_anfrage_beantworten(
        ctx, "ev-1", AirbnbAnfrageAntwort(aktion="alteration_annehmen")
    )
    # Die Form ist Airbnbs: Schluessel `accept`, Wert der STRING (bei Reservation
    # Request waere es ein Boolean) — s. die Tests oben in dieser Datei.
    assert gesendet == [{"accept": "accept"}]
