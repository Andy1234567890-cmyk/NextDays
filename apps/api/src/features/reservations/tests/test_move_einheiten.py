"""Move eines Objekts mit MEHREREN Einheiten (0265/0266/0315).

Ein Objekt ist ein Einheiten-TYP mit n ≥ 1 Einheiten; `availability` trägt seit
0266 eine Zeile je (Objekt, Einheit, Tag). Der Move muss deshalb drei Dinge
einheiten-genau tun, die er objektweit alle falsch machte:

1. VORCHECK: „bleibt eine Einheit im ganzen Zeitraum frei?" statt „ist irgendein
   Tag irgendeiner Einheit belegt?" — sonst ist ein Typ mit zwei Einheiten ab
   der ersten Buchung nicht mehr umbuchbar.
2. ZUWEISUNG: die Ziel-Einheit neu bestimmen. Ohne sie behielte die Buchung ihre
   alte `unit_id` und zeigte nach einem Objektwechsel auf eine Einheit eines
   FREMDEN Objekts — der EXCLUDE-Constraint (0315) prüfte dann gegen die falsche.
3. BELEGUNG: nur die eigene Einheit sperren. `je_einheit` ohne `unit_id` fächert
   auf ALLE Einheiten auf (die Semantik für Sperren/Freigaben) — ein Move hätte
   damit den ganzen Typ totalgesperrt.

Jeder Test hier bricht, wenn die zugehörige Änderung zurückgenommen wird.
"""
from datetime import date, timedelta

import pytest

from src.core.security import AuthContext
from src.features.reservations._base import ReservationError
from src.features.reservations.schemas import (
    CancelParty,
    ReservationCreate,
    ReservationMove,
)

from .test_reservations import (
    RID,
    _move_db,
    _move_store,
    _service_for_create,
)


def _naechte(check_in: str, check_out: str) -> list[date]:
    """Die Nächte eines Aufenthalts — Anreise inklusive, Abreise exklusiv."""
    von, bis = date.fromisoformat(check_in), date.fromisoformat(check_out)
    return [von + timedelta(days=i) for i in range((bis - von).days)]


def _store_mit_einheiten(
    *, p2_belegt: list[tuple[str, str]] | None = None,
    p1_belegt: list[tuple[str, str]] | None = None,
    check_in: str = "2026-07-01",
    check_out: str = "2026-07-03",
) -> dict:
    """Move-Store, in dem BEIDE Objekte je zwei Einheiten führen.

    `p2_belegt` sind (unit_id, datum)-Paare, die am Ziel-Objekt p2 durch eine
    FREMDE Buchung belegt sind; `p1_belegt` dieselben für p1 — für Moves auf
    DASSELBE Objekt, bei denen die alte Einheit im Zielzeitraum fremdbelegt ist
    und `freie_einheit` deshalb auf die Schwestereinheit ausweichen muss.
    """
    store = _move_store(check_in=check_in, check_out=check_out)
    store["property_units"] = [
        {"id": "u-p1-a", "property_id": "p1", "tenant_id": "t1", "position": 1},
        {"id": "u-p1-b", "property_id": "p1", "tenant_id": "t1", "position": 2},
        {"id": "u-p2-a", "property_id": "p2", "tenant_id": "t1", "position": 1},
        {"id": "u-p2-b", "property_id": "p2", "tenant_id": "t1", "position": 2},
    ]
    # Die bestehende Buchung liegt auf der ersten Einheit von p1. Der Kalender
    # wird aus check_in/check_out aufgebaut, damit ein abweichender Alt-Zeitraum
    # nicht auf den festen Zeilen von `_move_store` sitzen bleibt.
    store["reservations"][0]["unit_id"] = "u-p1-a"
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u-p1-a", "date": tag.isoformat(),
         "status": "booked", "source": "booking"}
        for tag in _naechte(check_in, check_out)
    ]
    for property_id, paare in (("p1", p1_belegt), ("p2", p2_belegt)):
        for unit_id, tag in paare or []:
            store["availability"].append(
                {"property_id": property_id, "unit_id": unit_id, "date": tag,
                 "status": "booked", "source": "airbnb"}
            )
    return store


def _belegt(store: dict) -> set[tuple[str, str]]:
    return {
        (z.get("unit_id"), z["date"])
        for z in store["availability"]
        if z.get("status") == "booked"
    }


def _pushes_abfangen(svc: object, monkeypatch: pytest.MonkeyPatch) -> list[tuple]:
    """Ersetzt `_push_channex_availability` durch einen Rekorder.

    Der Push an die Portale ist die Systemgrenze, an der die Multi-Unit-Bugs
    unbemerkt blieben: der lokale Kalender war korrekt, gemeldet wurde trotzdem
    „ausverkauft". Abgefangen wird die Methode selbst (nicht der Job-Enqueue
    dahinter), damit der Test nur die FACHLICHE Aussage prüft — welche Zahl
    freier Einheiten für welchen Zeitraum rausgeht — und nicht daran hängt, ob
    der Wert über `freie_einheiten_spannen` oder inline ermittelt wird.

    Liefert eine Liste von (property_id, date_from, date_to_exkl, availability).
    """
    calls: list[tuple] = []

    def rekorder(
        _tenant_id: str, property_id: str, check_in: date, check_out: date,
        availability: int, outbox_id: str | None = None,  # noqa: ARG001
    ) -> None:
        calls.append((property_id, check_in, check_out, availability))

    monkeypatch.setattr(svc, "_push_channex_availability", rekorder)
    return calls


def _belegt_pushes(calls: list[tuple], property_id: str) -> list[tuple]:
    """Nur die Pushes für EIN Objekt — Move/Storno pushen für zwei."""
    return [c for c in calls if c[0] == property_id]


def _move(
    svc: object, ziel: str = "p2",
    check_in: str = "2026-07-10", check_out: str = "2026-07-12",
) -> None:
    svc.move(  # type: ignore[attr-defined]
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id=ziel,
            check_in=date.fromisoformat(check_in),
            check_out=date.fromisoformat(check_out),
        ),
    )


def test_move_geht_wenn_eine_schwestereinheit_frei_ist() -> None:
    """Ziel-Einheit A ist fremdbelegt, B ist frei → der Move MUSS durchgehen.

    Der objektweite Vorcheck warf hier 409, obwohl eine Einheit frei war (und
    obwohl der EXCLUDE-Constraint seit 0315 je Einheit prüft). Nimmt man den
    einheiten-genauen Vorcheck zurück, schlägt dieser Test mit 409 fehl.
    """
    store = _store_mit_einheiten(
        p2_belegt=[("u-p2-a", "2026-07-10"), ("u-p2-a", "2026-07-11")]
    )
    _move(_move_db(store))
    assert store["reservations"][0]["property_id"] == "p2"
    # Die freie Schwestereinheit hat die Buchung bekommen (Zuweisung).
    assert store["reservations"][0]["unit_id"] == "u-p2-b"


def test_move_belegt_nur_die_eigene_einheit() -> None:
    """Die Belegung darf NUR die zugewiesene Einheit treffen.

    Ohne `unit_id` fächert `je_einheit` auf alle Einheiten des Typs auf — der
    Move sperrte damit auch die fremde Einheit u-p2-a mit. Nimmt man das
    `unit_id`-Argument zurück, enthält `belegt` zusätzlich u-p2-a und der
    Vergleich bricht.
    """
    store = _store_mit_einheiten()
    _move(_move_db(store))
    ziel = {z for z in _belegt(store) if z[1].startswith("2026-07-1")}
    assert ziel == {("u-p2-a", "2026-07-10"), ("u-p2-a", "2026-07-11")}


def test_move_ohne_freie_einheit_wirft_409() -> None:
    """Beide Ziel-Einheiten belegt → 409, und die Buchung bleibt, wo sie war.

    Die alte Einheit als Ersatz zu nehmen wäre eine Doppelbelegung — sie ist
    gerade als belegt erkannt worden (Wurzel 5: fail-closed statt Ersatzwert).
    """
    store = _store_mit_einheiten(
        p2_belegt=[
            ("u-p2-a", "2026-07-10"), ("u-p2-a", "2026-07-11"),
            ("u-p2-b", "2026-07-10"), ("u-p2-b", "2026-07-11"),
        ]
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        _move(svc)
    assert exc.value.status_code == 409
    assert store["reservations"][0]["property_id"] == "p1"


def test_move_gibt_nur_die_eigene_einheit_frei() -> None:
    """Die Freigabe der Alt-Nächte darf die Schwestereinheit nicht aufreißen.

    `_release_nights` ohne `unit_id` öffnet die Nacht auf ALLEN Einheiten und
    nimmt einer fremden Buchung ihre Sperre (im Schwesterpfad live passiert).
    Hier liegt auf u-p1-b eine fremde Belegung am selben Tag: sie muss stehen
    bleiben. Ohne die `unit_id`-Weitergabe wird sie mit geöffnet.
    """
    store = _store_mit_einheiten()
    store["availability"].append(
        {"property_id": "p1", "unit_id": "u-p1-b", "date": "2026-07-01",
         "status": "booked", "source": "airbnb"}
    )
    _move(_move_db(store))
    assert ("u-p1-b", "2026-07-01") in _belegt(store)


# --- Move am GLEICHEN Objekt MIT Einheitenwechsel ----------------------------
#
# Die Lücke, die alle Tests darüber offen ließen: sie verschieben entweder auf
# ein anderes Objekt (p1→p2, dort werden ohnehin ALLE Alt-Nächte freigegeben)
# oder sie resizen auf DERSELBEN Einheit. Bleibt das Objekt gleich, kann
# `freie_einheit` aber trotzdem die Einheit wechseln — nämlich wenn die alte
# Einheit im Zielzeitraum fremdbelegt ist und auf die Schwestereinheit
# ausgewichen wird. Dann ist `old_nights - new_keys` die falsche Freigabemenge:
# überlappende Tage bleiben nur belegt, solange die Buchung ihre Einheit BEHÄLT.
# Der Gegenzustand hängt an der Einheit, nicht am Zeitraum (Wurzel 1).


def test_move_gleiches_objekt_einheitenwechsel_gibt_alt_naechte_frei() -> None:
    """Einheitenwechsel OHNE Überlappung → die ALTEN Tage müssen frei werden.

    Alt 1.–3.7. auf u-p1-a, Ziel 5.–7.7., wo u-p1-a fremdbelegt ist → die
    Buchung landet auf u-p1-b. Ohne die einheiten-bewusste Freigabe blieb
    u-p1-a am 1./2.7. für immer `booked`, obwohl dort keine Buchung mehr liegt:
    eine dauerhaft unverkäufliche Einheit, und der Push meldet für diese Tage
    dauerhaft 1 statt 2 freie Einheiten.
    """
    store = _store_mit_einheiten(
        check_in="2026-07-01", check_out="2026-07-03",
        p1_belegt=[("u-p1-a", "2026-07-05"), ("u-p1-a", "2026-07-06")],
    )
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        _move(svc, ziel="p1", check_in="2026-07-05", check_out="2026-07-07")
    assert store["reservations"][0]["unit_id"] == "u-p1-b", (
        "Vorbedingung: die Buchung muss auf die Schwestereinheit ausweichen"
    )
    # Die alte Einheit ist an ihren Alt-Tagen wieder verkäuflich.
    assert _status(store, "u-p1-a", "2026-07-01") == "open"
    assert _status(store, "u-p1-a", "2026-07-02") == "open"
    # … und die Portale erfahren das: an den Alt-Tagen sind BEIDE Einheiten frei.
    frei_am_alt_tag = [
        c[3] for c in _belegt_pushes(calls, "p1")
        if c[1] <= date(2026, 7, 1) < c[2]
    ]
    assert frei_am_alt_tag == [2], (
        f"erwartet 2 freie Einheiten am 1.7., gepusht wurde {frei_am_alt_tag}"
    )


def test_move_gleiches_objekt_einheitenwechsel_ohne_doppelbelegung() -> None:
    """Einheitenwechsel MIT Überlappung → keine Buchung auf ZWEI Einheiten.

    Alt 1.–5.7. auf u-p1-a, Ziel 3.–7.7., wo u-p1-a am 6./7.7. fremdbelegt ist
    → die Buchung zieht auf u-p1-b. Blieben die überlappenden Tage 3./4.7. auf
    u-p1-a stehen, belegte DIESELBE Reservierung danach beide Einheiten: das
    Objekt meldete an fünf Tagen `availability=0`, obwohl real nur eine Einheit
    belegt ist. Kein Cron repariert das — `freie_einheiten_spannen` liest genau
    diesen Kalender.
    """
    store = _store_mit_einheiten(
        check_in="2026-07-01", check_out="2026-07-06",
        p1_belegt=[("u-p1-a", "2026-07-06")],
    )
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        _move(svc, ziel="p1", check_in="2026-07-03", check_out="2026-07-07")
    assert store["reservations"][0]["unit_id"] == "u-p1-b", (
        "Vorbedingung: die Buchung muss auf die Schwestereinheit ausweichen"
    )
    # Die Buchung belegt GENAU ihre neue Einheit — u-p1-a trägt an den
    # überlappenden Tagen keine Belegung dieser Reservierung mehr.
    belegt_a = {tag for unit, tag in _belegt(store) if unit == "u-p1-a"}
    assert belegt_a == {"2026-07-06"}, (
        f"u-p1-a trägt Reste der verschobenen Buchung: {sorted(belegt_a)}"
    )
    # Und kein Tag meldet fälschlich „ausverkauft": am 3./4.7. ist u-p1-a frei.
    ausverkauft = [
        (c[1], c[2]) for c in _belegt_pushes(calls, "p1")
        if c[3] == 0 and c[1] < date(2026, 7, 6)
    ]
    assert not ausverkauft, (
        f"availability=0 gemeldet, obwohl eine Einheit frei ist: {ausverkauft}"
    )


# --- Der Push an die Portale (die Systemgrenze) ------------------------------
#
# Die vier Tests oben prüfen den LOKALEN Kalender und hören genau dort auf, wo
# der Schaden entstand: an der Grenze zu Booking/Airbnb. Ein Objekt mit zwei
# Einheiten meldete nach der ersten Buchung `availability=0` — für die Portale
# ist der Typ damit ausverkauft, die zweite Einheit blieb unverkauft, ohne dass
# irgendwo eine Fehlermeldung stand. Verfügbarkeit an die Portale ist eine ZAHL
# (freie Einheiten), nie 0/1.


def test_move_pusht_echte_zahl_freier_einheiten() -> None:
    """Beim Belegen muss die ECHTE Zahl freier Einheiten rausgehen, nicht 0.

    Ziel-Objekt p2 hat zwei Einheiten; nach dem Move ist genau eine belegt (die
    unsere), die Schwestereinheit u-p2-b bleibt verkäuflich. Ein fester 0-Push
    nähme sie bei allen Portalen aus dem Verkauf — Umsatzverlust, den niemand
    bemerkt, weil der lokale Kalender korrekt aussieht.
    """
    store = _store_mit_einheiten()
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        _move(svc)
    ziel = _belegt_pushes(calls, "p2")
    assert ziel, "kein Push für das Ziel-Objekt"
    assert [c[3] for c in ziel] == [1], (
        f"erwartet 1 freie Einheit, gepusht wurde {[c[3] for c in ziel]}"
    )


def test_move_pusht_null_wenn_wirklich_alles_belegt() -> None:
    """Gegenprobe: ist die letzte Einheit weg, MUSS 0 rausgehen.

    Sonst hätte der Fix die Überbuchung nur in die andere Richtung verschoben —
    ein Objekt, das voll ist, aber den Portalen freie Einheiten meldet, erzeugt
    genau die Doppelbuchung, die der Push verhindern soll (Wurzel 1).
    """
    store = _store_mit_einheiten(
        p2_belegt=[("u-p2-a", "2026-07-10"), ("u-p2-a", "2026-07-11")]
    )
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        _move(svc)
    ziel = _belegt_pushes(calls, "p2")
    assert ziel, "kein Push für das Ziel-Objekt"
    assert [c[3] for c in ziel] == [0], (
        f"erwartet 0 freie Einheiten, gepusht wurde {[c[3] for c in ziel]}"
    )


# --- create() mit mehreren Einheiten ----------------------------------------
#
# Der einheiten-genaue Vorcheck steht in create() UND in move(); getestet war
# bislang nur move(). Ohne eigenen Test bliebe unbemerkt, wenn create() wieder
# objektweit prüft — dann wäre ein Typ mit zwei Einheiten ab der ersten Buchung
# an der Rezeption komplett dicht, obwohl die zweite Einheit frei ist.

_CREATE_UNITS = [{"id": "u-a"}, {"id": "u-b"}]


def _create(svc: object) -> None:
    svc.create(  # type: ignore[attr-defined]
        AuthContext(user_id="u1", tenant_id="t1"),
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3),
        ),
    )


def test_create_geht_wenn_eine_schwestereinheit_frei_ist() -> None:
    """Einheit A belegt, B frei → der Vorcheck darf NICHT mit 409 abweisen.

    Der Ablauf läuft danach in die RPC (0275), die die freie Einheit sucht; ein
    Mock-Fehler dort ist hier egal. Entscheidend ist allein: kein
    „belegte/gesperrte Tage"-409 mehr aus dem Vorcheck.
    """
    svc = _service_for_create(
        property_found=True,
        taken_days=[
            {"date": "2026-05-01", "status": "booked", "source": "direct",
             "unit_id": "u-a"},
            {"date": "2026-05-02", "status": "booked", "source": "direct",
             "unit_id": "u-a"},
        ],
        units=_CREATE_UNITS,
    )
    try:
        _create(svc)
    except ReservationError as exc:
        assert not (
            exc.status_code == 409 and "belegte/gesperrte" in exc.message
        ), "Vorcheck weist ab, obwohl Einheit u-b im ganzen Zeitraum frei ist"
    except Exception:  # noqa: BLE001,S110 — Quote/RPC-Mock unvollständig
        pass


def test_create_wirft_409_wenn_alle_einheiten_belegt() -> None:
    """Beide Einheiten belegt → 409 (fail-closed, Wurzel 5).

    Die Gegenprobe zum Test darüber: der einheiten-genaue Vorcheck darf nicht
    zu einem „lass alles durch" verkommen. Sonst landete jede Buchung im
    RPC-Backstop, und ein voll belegter Typ würde an der Rezeption angenommen.
    """
    svc = _service_for_create(
        property_found=True,
        taken_days=[
            {"date": "2026-05-01", "status": "booked", "source": "direct",
             "unit_id": "u-a"},
            {"date": "2026-05-01", "status": "booked", "source": "direct",
             "unit_id": "u-b"},
        ],
        units=_CREATE_UNITS,
    )
    with pytest.raises(ReservationError) as exc:
        _create(svc)
    assert exc.value.status_code == 409
    assert "belegte/gesperrte" in exc.value.message


# --- Freigabe: Storno einer von zwei parallelen Buchungen --------------------


def _zwei_buchungen_store() -> dict:
    """Zwei Buchungen desselben Objekts, verschiedene Einheiten, gleicher Tag.

    Der reale Multi-Unit-Alltag: zwei identische Studios unter einem Typ, beide
    über dieselbe Nacht verkauft.
    """
    store = _store_mit_einheiten()
    store["reservations"].append(
        {
            "id": "22222222-2222-4222-8222-222222222222", "tenant_id": "t1",
            "property_id": "p1", "guest_id": "g2", "unit_id": "u-p1-b",
            "channel": "direct", "check_in": "2026-07-01",
            "check_out": "2026-07-03", "status": "confirmed",
            "total_amount": 200, "currency": "EUR", "ota_name": None,
            "guests": {"name": "Bert"}, "checked_in_at": None,
            "checked_out_at": None, "source_channex_booking_id": None,
        }
    )
    for tag in ("2026-07-01", "2026-07-02"):
        store["availability"].append(
            {"property_id": "p1", "unit_id": "u-p1-b", "date": tag,
             "status": "booked", "source": "direct"}
        )
    return store


def _status(store: dict, unit_id: str, tag: str) -> str | None:
    for z in store["availability"]:
        if z.get("unit_id") == unit_id and z["date"] == tag:
            return z.get("status")
    return None


def test_storno_gibt_die_eigene_einheit_frei_trotz_schwesterbuchung() -> None:
    """Die Schwesterbuchung darf die Freigabe NICHT objektweit blockieren.

    `_days_still_booked_by_others` fragte objektweit „ist der Tag noch durch
    eine andere Buchung belegt?" — bei zwei Einheiten lautet die Antwort bei
    jeder Parallelbuchung „ja", und die stornierte Einheit blieb für immer
    gesperrt: lokal unverkäuflich UND an den Portalen nie zurückgemeldet. Der
    Schaden ist stiller Leerstand, den kein Fehlerbild anzeigt (Wurzel 1).
    """
    store = _zwei_buchungen_store()
    svc = _move_db(store)
    svc.cancel(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID, "Gast hat abgesagt", partei=CancelParty.betrieb,
    )
    # Eigene Einheit frei …
    assert _status(store, "u-p1-a", "2026-07-01") == "open"
    assert _status(store, "u-p1-a", "2026-07-02") == "open"
    # … die der Schwesterbuchung bleibt belegt (kein Aufreißen, Wurzel 1).
    assert _status(store, "u-p1-b", "2026-07-01") == "booked"


def test_storno_pusht_freie_einheit_trotz_schwesterbuchung() -> None:
    """Und die Freigabe muss auch bei den Portalen ankommen: 1 statt 0.

    Von zwei Einheiten wird eine frei — an Booking/Airbnb gehört deshalb `1`.
    Blockiert der objektweite Belegt-Check die Freigabe, geht GAR KEIN Push
    raus und die Nacht bleibt bei allen Portalen verkauft-gesperrt.
    """
    store = _zwei_buchungen_store()
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        svc.cancel(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID, "Gast hat abgesagt", partei=CancelParty.betrieb,
        )
    frei = _belegt_pushes(calls, "p1")
    assert frei, "keine Freigabe an die Portale gemeldet"
    assert {c[3] for c in frei} == {1}, (
        f"erwartet 1 freie Einheit, gepusht wurde {[c[3] for c in frei]}"
    )


# --- Freigabe darf fremde Sperren nicht öffnen ------------------------------


@pytest.mark.parametrize("quelle", ["ical", "manual"])
def test_storno_laesst_sperre_auf_der_eigenen_einheit_stehen(quelle: str) -> None:
    """Eine `ical`-/`manual`-Sperre auf der eigenen Einheit überlebt den Storno.

    Der Kalender einer Einheit trägt mehr als Buchungen: ein externer
    iCal-Kalender (Airbnb-Import, Wartung) oder eine Handsperre der Rezeption
    schließen den Tag ebenfalls. Öffnet die Freigabe blind auf 'open', verkauft
    das Objekt eine Nacht, die real nicht verfügbar ist — Überbuchung, die erst
    beim Anreisen auffällt.
    """
    store = _store_mit_einheiten()
    # Ein zweiter Tag der eigenen Einheit trägt eine Sperr-Quelle, KEINE Buchung.
    store["availability"].append(
        {"property_id": "p1", "unit_id": "u-p1-a", "date": "2026-07-02",
         "status": "blocked", "source": quelle}
    )
    store["availability"] = [
        z for z in store["availability"]
        if not (
            z.get("unit_id") == "u-p1-a"
            and z["date"] == "2026-07-02"
            and z.get("status") == "booked"
        )
    ]
    svc = _move_db(store)
    svc.cancel(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID, "Gast hat abgesagt", partei=CancelParty.betrieb,
    )
    assert _status(store, "u-p1-a", "2026-07-01") == "open"
    assert _status(store, "u-p1-a", "2026-07-02") == "blocked", (
        f"{quelle}-Sperre wurde von der Freigabe aufgerissen"
    )


# --- accept_request mit mehreren Einheiten ----------------------------------


def test_accept_request_pusht_echte_zahl_freier_einheiten() -> None:
    """Auch das Annehmen einer Anfrage meldet die freie Stückzahl, nicht 0.

    accept_request ist der dritte Belege-Pfad neben create und move. Er pushte
    ebenfalls hart 0 — eine angenommene Anfrage nahm damit ein Objekt mit zwei
    Einheiten komplett vom Markt, obwohl nur eine Einheit vergeben wurde.

    Der Kalender ist im Anfrage-Zustand BEREITS belegt: die Anfrage lief über
    denselben atomaren create-RPC und hält ihre Einheit (u-p1-a), damit sie
    niemand anders wegbucht. Frei ist also die Schwestereinheit u-p1-b → 1.
    """
    store = _store_mit_einheiten()
    res = store["reservations"][0]
    res["status"] = "requested"
    svc = _move_db(store)
    with pytest.MonkeyPatch.context() as mp:
        calls = _pushes_abfangen(svc, mp)
        svc.accept_request(
            AuthContext(user_id="u", tenant_id="t1", role="admin"), RID
        )
    eigen = _belegt_pushes(calls, "p1")
    assert eigen, "kein Push nach dem Annehmen"
    assert [c[3] for c in eigen] == [1], (
        f"erwartet 1 freie Einheit, gepusht wurde {[c[3] for c in eigen]}"
    )
