"""Ein OTA-Fremdstorno vermerkt die Partei `portal` (0410).

WARUM DAS EIN EIGENER TEST IST: `reservations.cancelled_by_party` wird über
`ReservationsService.cancel()` als Pflichtparameter erzwungen — dieser Pfad hier
ruft `cancel()` bewusst NICHT auf. Eine OTA-Buchung ist lokal gar nicht
stornierbar (writes.py wirft 409); der Storno kommt ausschliesslich aus dem
Portal-Feed und wird per direktem UPDATE nachgezogen. Genau deshalb greift die
Pflicht-Prüfung des Services hier nicht, und genau deshalb kann diese Stelle die
Spalte stillschweigend leer lassen, ohne dass irgendein Test rot wird.

Ohne den Eintrag wäre jeder LAUFENDE OTA-Storno von einem Altbestands-Storno
(„nicht erfasst") nicht zu unterscheiden — und `portal`/`portal_storno` wären
Enum-Werte, die nie jemand schreibt.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.bookings_sync import BookingsSyncMixin

_TENANT = "22222222-2222-4222-8222-222222222222"
_PROPERTY = "33333333-3333-4333-8333-333333333333"
_RESERVATION = "44444444-4444-4444-8444-444444444444"


class _Query:
    """PostgREST-Stub: liefert je Tabelle feste Zeilen, merkt Updates/Inserts."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        self._store["updates"].append((self._tabelle, payload))
        return self

    def insert(self, payload: dict[str, Any]) -> _Query:
        self._store["inserts"].append((self._tabelle, payload))
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._store["rows"].get(self._tabelle, [])})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {"rows": rows, "updates": [], "inserts": []}

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _Sync(BookingsSyncMixin):
    """Nur die Projektion — die Umgebung des Mixins wird nicht gebraucht.

    `_as_int` liegt in einem SCHWESTER-Mixin (`channels.py`), das der echte
    `ChannelManagerService` mit erbt. Die Storno-Tests erreichen die Stelle nie
    (sie kehren vorher zurueck); die Modifikations-Tests laufen bis ans Ende
    von `_nachlauf` durch und brauchen sie.
    """

    @staticmethod
    def _as_int(value: object) -> int | None:
        try:
            return int(str(value))
        except (TypeError, ValueError):
            return None


def _attrs(**over: Any) -> dict[str, Any]:
    basis = {
        "booking_id": "CHX-999",
        "status": "cancelled",
        "arrival_date": "2026-09-01",
        "departure_date": "2026-09-04",
        "ota_name": "Booking.com",
        "ota_reservation_code": "BK-4711",
        "amount": 1200.0,
        "currency": "DKK",
        "customer": {"name": "Test Gast", "mail": "gast@example.com"},
    }
    basis.update(over)
    return basis


def _storno_payload(store: dict[str, Any]) -> dict[str, Any]:
    return next(p for t, p in store["updates"] if t == "reservations")


def _stumm(
    monkeypatch: Any, _sync: Any, freigaben: list[list[str]] | None
) -> None:
    """Alles ausser dem Gegenzustand stummschalten.

    Der MODIFIKATIONS-Pfad laeuft bis ans Ende von `_nachlauf` durch: Kalender
    sperren, Verfuegbarkeit pushen, Portal-Finanzen, Provision, Dynamic
    Pricing, Aufgaben. Jedes davon hat eigene Tests; hier interessiert
    ausschliesslich, WELCHE Naechte freigegeben werden.
    """
    for name in (
        "sync_nach_id",
        "try_enqueue_recompute",
        "melde_buchungs_ereignis",
        "recompute_guest_aggregates",
    ):
        monkeypatch.setattr(
            f"src.features.channel_manager.bookings_sync.{name}",
            lambda *_a, **_k: None,
            raising=False,
        )
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.freie_einheiten_spannen",
        lambda *_a, **_k: [],
    )
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.freie_einheit",
        lambda *_a, **_k: None,
    )
    for meth in (
        "_projection_precheck",
        "_set_availability",
        "push_availability_for_property",
        "_record_portal_finanzen_safe",
        "_record_commission_safe",
        "_cancel_commission_safe",
        "_cancel_dynpricing_safe",
        "_addon_links_bei_ota_storno",
    ):
        monkeypatch.setattr(
            _Sync,
            meth,
            (lambda *_a, **_k: True) if meth == "_projection_precheck"
            else (lambda *_a, **_k: None),
            raising=False,
        )
    monkeypatch.setattr(
        _Sync, "_gast_name", staticmethod(lambda *_a, **_k: "Test"), raising=False
    )
    if freigaben is not None:
        monkeypatch.setattr(
            _Sync,
            "_free_ota_nights",
            lambda self, _db, _t, _p, _k, naechte, unit_id=None: freigaben.append(
                naechte
            ),
            raising=False,
        )


def test_bekannte_buchung_wird_als_portal_storno_vermerkt(monkeypatch) -> None:
    """Der Regelfall: die Buchung kennen wir, das Portal meldet den Storno."""
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": _PROPERTY,
                    "payment_collect": "ota",
                    "unit_id": None,
                }
            ]
        }
    )
    sync = _Sync()
    # Die Gegenzustände (Nächte, Aufgaben) haben eigene Tests — hier interessiert
    # ausschliesslich, WAS in die Storno-Zeile geschrieben wird.
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    payload = _storno_payload(db.store)
    assert payload["status"] == "cancelled"
    assert payload["cancelled_by_party"] == "portal"
    assert payload["cancel_reason_code"] == "portal_storno"


def test_storno_partei_ist_nicht_leer_und_nicht_geraten(monkeypatch) -> None:
    """`null` wäre hier die falsche Angabe: wir WISSEN, woher der Storno kam.

    Gleichzeitig darf nichts Genaueres behauptet werden — der Channex-Feed
    nennt keinen Auslöser, deshalb steht dort `portal` (über das Portal
    eingegangen) und NICHT `gast` oder `betrieb` (Wurzel 4).
    """
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": _PROPERTY,
                    "payment_collect": None,
                    "unit_id": None,
                }
            ]
        }
    )
    sync = _Sync()
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    payload = _storno_payload(db.store)
    assert payload["cancelled_by_party"] not in (None, "", "gast", "betrieb")


def test_storno_meldet_und_protokolliert(monkeypatch) -> None:
    """Der Betrieb MUSS von einem Portal-Storno erfahren.

    Gemeldet wurde bisher ausschliesslich `kind="created"` (im Neuanlage-Zweig
    weiter unten in derselben Methode). Der Storno-Zweig kehrt vorher zurueck —
    die Glocke behielt damit dauerhaft ihre „Neue Buchung"-Zeile, waehrend die
    Buchung schon storniert war.

    Live gemessen am 21.08.2026 (Buchung 5135385573, Raevlingehuset): drei
    „New booking"-Meldungen um 10:11, Storno um 10:22, danach KEINE weitere
    Meldung. Kalender und Aufgaben waren korrekt aufgeraeumt — nur der Betrieb
    erfuhr es nicht.

    Geprueft wird beides: der Zeitleisten-Eintrag und die Meldung.
    """
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": _PROPERTY,
                    "payment_collect": "ota",
                    "unit_id": None,
                    "guest_id": "g-1",
                }
            ]
        }
    )
    sync = _Sync()
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )
    monkeypatch.setattr(
        _Sync, "_gast_name", staticmethod(lambda *_a, **_k: "Rainer"), raising=False
    )
    gemeldet: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.melde_buchungs_ereignis",
        lambda _db, **kw: gemeldet.append(kw),
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    # Zeitleiste: der Storno ist ein Ereignis der Buchung, nicht nur ein
    # geaenderter Status — ohne den Eintrag fehlt er im Verlauf.
    ereignisse = [p for t, p in db.store["inserts"] if t == "reservation_events"]
    assert len(ereignisse) == 1
    assert ereignisse[0]["kind"] == "cancelled"
    assert ereignisse[0]["reservation_id"] == _RESERVATION

    # Meldung an Eigentuemer UND Betrieb.
    assert len(gemeldet) == 1
    assert gemeldet[0]["kind"] == "cancelled"
    assert gemeldet[0]["reservation_id"] == _RESERVATION
    assert gemeldet[0]["property_id"] == _PROPERTY
    # Der Vorname macht die Meldung erst brauchbar — „Storno" allein sagt
    # nicht, WESSEN Aufenthalt entfaellt.
    assert gemeldet[0]["gast_vorname"] == "Rainer"
    assert gemeldet[0]["quelle"] == "Booking.com"


def test_unbekannte_buchung_meldet_keinen_storno(monkeypatch) -> None:
    """Eine Storno-Revision zu einer Buchung, die wir nie hatten, meldet nichts.

    Der Bestandsimport legt sie als storniert an (Historie), aber beim Betrieb
    hat dieser Storno nie stattgefunden — eine Meldung darueber waere eine
    Aussage ueber ein Ereignis, das es fuer ihn nicht gab (Wurzel 4).
    """
    db = _Db({"reservations": []})
    sync = _Sync()
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )
    monkeypatch.setattr(
        _Sync, "_insert_cancelled_reservation", lambda *_a, **_k: None, raising=False
    )
    gemeldet: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.melde_buchungs_ereignis",
        lambda _db, **kw: gemeldet.append(kw),
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    assert gemeldet == []


def test_storno_gibt_den_LOKALEN_alt_zeitraum_frei_nicht_den_aus_der_payload(
    monkeypatch,
) -> None:
    """Wurzel 1: freigegeben wird, was LOKAL gebucht war.

    Weicht die Storno-Revision vom Bestand ab — anderer Zeitraum, anderes
    Objekt, andere Einheit —, dann stehen im Payload die NEUEN Werte, gesperrt
    sind aber die ALTEN. Wer die Payload freigibt, laesst die echten
    Alt-Naechte gesperrt: das Portal verkauft sie wieder, unser Kalender haelt
    sie zu.

    Dieser Fall war bis 10.09.2026 ungetestet, obwohl der Code ihn ausdruecklich
    behandelt. Beim Herausziehen von `_storno_projizieren` haengt der ganze
    Gegenzustand jetzt an `_AltZustand` — genau deshalb wird er hier
    festgenagelt.
    """
    alt_property = "55555555-5555-4555-8555-555555555555"
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    # LOKAL gebucht: 01.-04.09. auf dem ALTEN Objekt, Einheit u-9
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": alt_property,
                    "unit_id": "u-9",
                    "payment_collect": "ota",
                }
            ]
        }
    )
    sync = _Sync()
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )
    freigaben: list[dict[str, Any]] = []
    monkeypatch.setattr(
        _Sync,
        "_free_ota_nights",
        lambda self, _db, _t, pid, kanal, naechte, unit_id=None: freigaben.append(
            {"property_id": pid, "naechte": naechte, "unit_id": unit_id}
        ),
        raising=False,
    )

    # Die Storno-Meldung nennt einen ANDEREN Zeitraum und ein anderes Objekt.
    sync._project_booking_to_reservation(  # noqa: SLF001
        db,
        _TENANT,
        _attrs(arrival_date="2026-12-24", departure_date="2026-12-27"),
        guest_id="g-1",
        local_property_id=_PROPERTY,
    )

    assert len(freigaben) == 1, "genau eine Freigabe je Storno"
    frei = freigaben[0]
    # Das ALTE Objekt, nicht das aus der Payload.
    assert frei["property_id"] == alt_property
    # Die ALTE Einheit — sonst bleibt u-9 gesperrt.
    assert frei["unit_id"] == "u-9"
    # Die ALTEN Naechte (01.-03.09., Abreisetag zaehlt nicht).
    assert frei["naechte"] == ["2026-09-01", "2026-09-02", "2026-09-03"]
    # Und ausdruecklich NICHT der Dezember aus der Payload.
    assert not any(n.startswith("2026-12") for n in frei["naechte"])


def test_verkuerzung_gibt_nur_die_herausfallenden_naechte_frei(monkeypatch) -> None:
    """Wurzel 1: eine Modifikation raeumt Naechte — die muessen frei werden.

    Verkuerzt das Portal eine Buchung, sind die neuen Naechte gesperrt, die
    weggefallenen blieben ohne Gegenzustand dauerhaft 'booked': eine
    Phantom-Belegung, auf allen Kanaelen unverkaeuflich. Freizugeben sind
    GENAU die Tage, die aus dem alten Zeitraum herausfallen — nicht der ganze
    alte Zeitraum, sonst gaebe man die weiter gebuchten Naechte mit frei.
    """
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    # Alt: 01.-06.09. (5 Naechte)
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-06",
                    "property_id": _PROPERTY,
                    "unit_id": None,
                    "payment_collect": "ota",
                }
            ]
        }
    )
    sync = _Sync()
    freigaben: list[list[str]] = []
    _stumm(monkeypatch, sync, freigaben)

    # Neu: 01.-04.09. — der 04. und 05. fallen heraus.
    sync._project_booking_to_reservation(  # noqa: SLF001
        db,
        _TENANT,
        _attrs(status="confirmed", arrival_date="2026-09-01",
               departure_date="2026-09-04"),
        guest_id="g-1",
        local_property_id=_PROPERTY,
    )

    assert freigaben, "die geraeumten Naechte muessen freigegeben werden"
    assert freigaben[0] == ["2026-09-04", "2026-09-05"]


def test_objektwechsel_gibt_den_GANZEN_alt_zeitraum_am_alten_objekt_frei(
    monkeypatch,
) -> None:
    """Wurzel 1: beim Objektwechsel trifft der Datums-Diff das alte Objekt nie.

    Bucht der Gast bei der OTA von Objekt A auf B um, wird die Reservierung auf
    B umgehaengt. Auf A ist dann der KOMPLETTE alte Zeitraum freizugeben — ein
    Diff der Daten (der auf B rechnet) laesst A dauerhaft phantombelegt, selbst
    wenn die Daten gleich bleiben.
    """
    alt_property = "55555555-5555-4555-8555-555555555555"
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": alt_property,
                    "unit_id": "u-3",
                    "payment_collect": "ota",
                }
            ]
        }
    )
    sync = _Sync()
    ziele: list[tuple[str, list[str], str | None]] = []
    monkeypatch.setattr(
        _Sync,
        "_free_ota_nights",
        lambda self, _db, _t, pid, _k, naechte, unit_id=None: ziele.append(
            (pid, naechte, unit_id)
        ),
        raising=False,
    )
    _stumm(monkeypatch, sync, None)

    # Gleiche Daten, aber ANDERES Objekt.
    sync._project_booking_to_reservation(  # noqa: SLF001
        db,
        _TENANT,
        _attrs(status="confirmed", arrival_date="2026-09-01",
               departure_date="2026-09-04"),
        guest_id="g-1",
        local_property_id=_PROPERTY,
    )

    assert ziele, "das ALTE Objekt braucht seine Freigabe"
    pid, naechte, unit_id = ziele[0]
    assert pid == alt_property, "freigegeben wird auf dem ALTEN Objekt"
    assert naechte == ["2026-09-01", "2026-09-02", "2026-09-03"]
    assert unit_id == "u-3", "und auf der ALTEN Einheit"
