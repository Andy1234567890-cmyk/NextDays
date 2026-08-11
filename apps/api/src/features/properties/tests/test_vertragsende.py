"""Tests für das Vertragsende eines Objekts (0355).

Der Kunde kündigt zum 02.01.2027 — ab dem Tag darf das Objekt auf KEINEM Kanal
mehr verkauft werden. Die Gefahr liegt nicht im Setzen, sondern in den beiden
Rändern: ein Tag ohne `availability`-Zeile geht überall als OFFEN an die Portale
(Wurzel 1), und ein zurückgenommenes Enddatum muss die Nächte wieder freigeben.

Der Fake unten filtert ECHT (eq/gte/lt auf den Zeilen), nicht bloß fließend.
Ein Doppelgänger, der jede Kette akzeptiert und immer dieselbe Liste liefert,
bestätigt auch einen kaputten Filter — genau daran ist hier im Bestand schon ein
Stop-Sell-Test wirkungslos geworden.
"""
from datetime import date

import pytest

from src.features.properties.errors import PropertyError
from src.features.properties.vertragsende import (
    QUELLE,
    SPERR_HORIZONT_TAGE,
    _gemeldete_bereiche,
    _sperr_fenster,
    als_datum,
    buchungen_nach_ende,
    vertragsende_aus_update,
    vertragsende_durchsetzen,
    vertragsende_info,
    vertragsenden_nachziehen,
)

HEUTE = date(2026, 8, 10)
ENDE = date(2027, 1, 2)


# --------------------------------------------------------------------------
# Fake mit echter Filterwirkung
# --------------------------------------------------------------------------

class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimal-PostgREST, das eq/gte/gt/lt/neq wirklich anwendet."""

    def __init__(self, store: "_Store", table: str) -> None:
        self._store = store
        self._table = table
        self._filter: list[tuple[str, str, object]] = []
        self._modus = "select"
        self._payload: dict | list | None = None

    # --- Builder ---
    def select(self, *_a: object, **_k: object) -> "_Query":
        self._modus = "select"
        return self

    def update(self, payload: dict) -> "_Query":
        self._modus = "update"
        self._payload = payload
        return self

    def upsert(self, payload: list[dict], **_k: object) -> "_Query":
        self._modus = "upsert"
        self._payload = payload
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "eq", val))
        return self

    def neq(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "neq", val))
        return self

    def gte(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "gte", val))
        return self

    def gt(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "gt", val))
        return self

    def lt(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "lt", val))
        return self

    def lte(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "lte", val))
        return self

    def is_(self, col: str, val: object) -> "_Query":
        self._filter.append((col, "isnull" if str(val) == "null" else "is", val))
        return self

    @property
    def not_(self) -> "_NichtQuery":
        # PostgREST-`.not_.is_(col, "null")` — negiert den NÄCHSTEN Operator.
        return _NichtQuery(self)

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Query":
        return self

    # --- Ausführung ---
    def _passt(self, row: dict) -> bool:
        for col, op, val in self._filter:
            ist = row.get(col)
            if op == "eq" and ist != val:
                return False
            if op == "neq" and ist == val:
                return False
            if op == "gte" and not (ist is not None and str(ist) >= str(val)):
                return False
            if op == "gt" and not (ist is not None and str(ist) > str(val)):
                return False
            if op == "lt" and not (ist is not None and str(ist) < str(val)):
                return False
            if op == "lte" and not (ist is not None and str(ist) <= str(val)):
                return False
            if op == "isnull" and ist is not None:
                return False
            if op == "notnull" and ist is None:
                return False
        return True

    def execute(self) -> _Result:
        rows = self._store.tabellen.setdefault(self._table, [])
        if self._modus == "select":
            return _Result([dict(r) for r in rows if self._passt(r)])
        if self._modus == "update":
            getroffen = [r for r in rows if self._passt(r)]
            assert isinstance(self._payload, dict)
            for r in getroffen:
                r.update(self._payload)
            return _Result([dict(r) for r in getroffen])
        # upsert
        assert isinstance(self._payload, list)
        for neu in self._payload:
            schluessel = (neu["property_id"], neu.get("unit_id"), neu["date"])
            vorhanden = next(
                (
                    r
                    for r in rows
                    if (r["property_id"], r.get("unit_id"), r["date"]) == schluessel
                ),
                None,
            )
            if vorhanden is None:
                rows.append(dict(neu))
            else:
                vorhanden.update(neu)
        return _Result([dict(r) for r in self._payload])


class _NichtQuery:
    """Negations-Zwischenstufe für `.not_.is_(…)` — genau der PostgREST-Aufbau.

    Muss echt negieren: `vertragsenden_nachziehen` holt damit die Objekte MIT
    Enddatum. Winkte die Attrappe die Negation durch, liefe der Test über alle
    Objekte und der Filter bliebe ungeprüft.
    """

    def __init__(self, q: _Query) -> None:
        self._q = q

    def is_(self, col: str, val: object) -> _Query:
        self._q._filter.append(  # noqa: SLF001 — dieselbe Test-Attrappe
            (col, "notnull" if str(val) == "null" else "isnot", val)
        )
        return self._q


class _Store:
    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen
        self.jobs: list[dict] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, *_a: object, **_k: object) -> _Query:  # pragma: no cover
        return _Query(self, "_rpc")


def _store(availability: list[dict] | None = None,
           reservations: list[dict] | None = None) -> _Store:
    return _Store(
        {
            "availability": availability or [],
            "reservations": reservations or [],
            "property_units": [
                {"id": "u-1", "property_id": "p-1", "tenant_id": "t-1", "position": 1}
            ],
            "jobs": [],
            "properties": [],
        }
    )


def _sperrtage(store: _Store) -> list[str]:
    return sorted(
        r["date"]
        for r in store.tabellen["availability"]
        if r["status"] == "blocked" and r["source"] == QUELLE
    )


# --------------------------------------------------------------------------
# Fenster-Rechnung: die Ränder
# --------------------------------------------------------------------------

def test_fenster_beginnt_am_endtag_selbst() -> None:
    """Das Enddatum ist der ERSTE gesperrte Tag, nicht der letzte offene.

    02.01.2027 heißt: die Nacht 01.→02.01. wird noch verkauft, die Nacht
    02.→03.01. nicht mehr. Ein Off-by-one hier verkauft entweder eine Nacht
    ohne Vertrag oder verschenkt die letzte vertragliche.
    """
    fenster = _sperr_fenster(ENDE, heute=HEUTE)
    assert fenster is not None
    assert fenster[0] == ENDE


def test_fenster_deckt_den_horizont_ab_heute() -> None:
    """Gesperrt wird ab HEUTE + Horizont, nicht ab dem Enddatum + Horizont.

    Sonst wüchse das Fenster mit jedem weiter entfernten Enddatum ins
    Unbegrenzte, und ein Enddatum in fünf Jahren schriebe heute Millionen
    Zeilen.
    """
    fenster = _sperr_fenster(ENDE, heute=HEUTE)
    assert fenster is not None
    assert fenster[1] == HEUTE.fromordinal(HEUTE.toordinal() + SPERR_HORIZONT_TAGE)


def test_vergangenes_ende_sperrt_ab_heute_nicht_rueckwirkend() -> None:
    """Ein Vertrag, der letztes Jahr endete, sperrt ab HEUTE.

    Vergangenheit wird nicht angefasst: dort liegen abgerechnete Buchungen und
    Statements. Sie nachträglich auf 'blocked' zu setzen wäre eine
    Falschaussage über einen bereits stattgefundenen Aufenthalt.
    """
    fenster = _sperr_fenster(date(2025, 5, 1), heute=HEUTE)
    assert fenster is not None
    assert fenster[0] == HEUTE


def test_ende_jenseits_des_horizonts_sperrt_nichts() -> None:
    """Endet der Vertrag erst nach dem Horizont, gibt es heute nichts zu
    sperren — und `None` sagt das, statt ein leeres Fenster zu erfinden.

    Der DB-Trigger aus 0355 ist für diese Zeit der Riegel; der Horizont wandert
    bei jedem Lauf nach und holt die Tage ein, sobald sie in Sicht kommen.
    """
    weit = date(HEUTE.year + 5, 1, 1)
    assert _sperr_fenster(weit, heute=HEUTE) is None


# --------------------------------------------------------------------------
# Sperren setzen
# --------------------------------------------------------------------------

def test_setzen_sperrt_ab_dem_endtag_und_laesst_davor_offen() -> None:
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    tage = _sperrtage(store)
    assert tage[0] == ENDE.isoformat()
    # Der Tag VOR dem Ende bleibt verkäuflich.
    assert date(2027, 1, 1).isoformat() not in tage


def test_setzen_traegt_die_eigene_quelle_nicht_manual() -> None:
    """`source='contract_end'` ist der Schutz davor, dass „Sperre aufheben" im
    Kalender ein Objekt ohne Vertrag wieder verkäuflich macht — `_unblock`
    fasst nur manual/portal an."""
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    quellen = {r["source"] for r in store.tabellen["availability"]}
    assert quellen == {QUELLE}


def test_setzen_faechert_auf_alle_einheiten_auf() -> None:
    """Der Vertrag endet für den ganzen Typ, nie für eine einzelne Einheit."""
    store = _store()
    store.tabellen["property_units"].append(
        {"id": "u-2", "property_id": "p-1", "tenant_id": "t-1", "position": 2}
    )
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    einheiten = {r["unit_id"] for r in store.tabellen["availability"]}
    assert einheiten == {"u-1", "u-2"}


def test_gebuchte_nacht_bleibt_gebucht() -> None:
    """Eine `booked`-Zeile darf die Sperre nicht überschreiben.

    Sonst verlöre die Buchung ihre Kalenderspur — der Gast stünde vor der Tür
    und das Objekt zeigte 'blocked' ohne Bezug zu ihm.
    """
    tag = date(2027, 1, 5).isoformat()
    store = _store(
        availability=[
            {
                "property_id": "p-1", "unit_id": "u-1", "date": tag,
                "status": "booked", "source": "airbnb",
            }
        ]
    )
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    zeile = next(r for r in store.tabellen["availability"] if r["date"] == tag)
    assert zeile["status"] == "booked"
    assert zeile["source"] == "airbnb"


# --------------------------------------------------------------------------
# Wurzel 1 — der Gegenzustand
# --------------------------------------------------------------------------

def test_entfernen_gibt_die_naechte_wieder_frei() -> None:
    """Vertrag verlängert → das Objekt MUSS wieder verkäuflich sein.

    Bliebe die Sperre stehen, wäre das Objekt nach der Verlängerung für zwei
    Jahre unverkäuflich, ohne dass im Kalender ein Grund sichtbar ist.
    """
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    assert _sperrtage(store)

    vertragsende_durchsetzen(store, "t-1", "p-1", None, heute=HEUTE)
    assert _sperrtage(store) == []
    # Die Zeilen bleiben stehen und stehen auf 'open' — nicht gelöscht: ein
    # gelöschter Tag ist für Board und Full-Sync offen, aber eine Zeile mit
    # anderem Grund darauf wäre mit weg (der Loch-Bug aus 0354).
    assert all(r["status"] == "open" for r in store.tabellen["availability"])


def test_nach_hinten_verschieben_oeffnet_nur_die_neuen_freien_tage() -> None:
    """02.01. → 01.06.: Januar bis Mai wird frei, ab Juni bleibt zu."""
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    spaeter = date(2027, 6, 1)
    vertragsende_durchsetzen(store, "t-1", "p-1", spaeter, heute=HEUTE)

    tage = _sperrtage(store)
    assert date(2027, 3, 15).isoformat() not in tage
    assert spaeter.isoformat() in tage
    assert tage[0] == spaeter.isoformat()


def test_aufheben_laesst_eine_fremde_sperre_stehen() -> None:
    """Eine Handsperre (Renovierung) im selben Zeitraum hat einen ANDEREN
    Grund und einen anderen Gegenzustand — sie darf nicht mitfallen."""
    tag = date(2027, 2, 1).isoformat()
    store = _store(
        availability=[
            {
                "property_id": "p-1", "unit_id": "u-1", "date": tag,
                "status": "blocked", "source": "manual",
            }
        ]
    )
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    vertragsende_durchsetzen(store, "t-1", "p-1", None, heute=HEUTE)

    zeile = next(r for r in store.tabellen["availability"] if r["date"] == tag)
    assert zeile["status"] == "blocked"
    assert zeile["source"] == "manual"


def test_aufheben_faellt_nicht_in_die_vergangenheit() -> None:
    """Was gestern zu war, bleibt zu — auch beim Entfernen des Enddatums."""
    gestern = date(2026, 8, 9).isoformat()
    store = _store(
        availability=[
            {
                "property_id": "p-1", "unit_id": "u-1", "date": gestern,
                "status": "blocked", "source": QUELLE,
            }
        ]
    )
    vertragsende_durchsetzen(store, "t-1", "p-1", None, heute=HEUTE)
    zeile = next(r for r in store.tabellen["availability"] if r["date"] == gestern)
    assert zeile["status"] == "blocked"


def test_setzen_ist_idempotent() -> None:
    """Zweimal Speichern darf keine Doppelzeilen und keinen anderen Stand
    ergeben (Wurzel 2 — im Frontend reicht ein Doppelklick)."""
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    erst = len(store.tabellen["availability"])
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    assert len(store.tabellen["availability"]) == erst


# --------------------------------------------------------------------------
# Portale bekommen den Stand
# --------------------------------------------------------------------------

def test_gemeldete_bereiche_deckt_sperrfenster_und_freigabe_ab() -> None:
    """Beides muss an die Portale: das neu Gesperrte UND das Freigewordene.

    Fehlte das Zweite, blieben die Tage bei Booking/Airbnb gesperrt, obwohl der
    Vertrag verlängert wurde — verschenkter Verkauf, den niemand sieht.
    """
    fenster = (date(2027, 6, 1), date(2028, 8, 9))
    geoeffnet = ["2027-01-02", "2027-01-03", "2027-05-31"]
    bereiche = _gemeldete_bereiche(fenster, geoeffnet)
    assert fenster in bereiche
    assert (date(2027, 1, 2), date(2027, 6, 1)) in bereiche


def test_gemeldete_bereiche_ohne_aenderung_ist_leer() -> None:
    assert _gemeldete_bereiche(None, []) == []


# --------------------------------------------------------------------------
# Bestandsbuchungen
# --------------------------------------------------------------------------

def test_buchung_die_hinausreicht_wird_gefunden() -> None:
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2026-12-28", "check_out": "2027-01-10",
                "guests": {"name": "Ursula Ecclesia"},
            }
        ]
    )
    treffer = buchungen_nach_ende(store, "p-1", ENDE)
    assert len(treffer) == 1
    assert treffer[0]["gast"] == "Ursula Ecclesia"


def test_abreise_am_endtag_steht_nicht_im_weg() -> None:
    """`check_out` ist die Abreise (ausschließlich): wer am 02.01. abreist,
    belegt nur Nächte davor und hat für jede einen Vertrag."""
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2026-12-28", "check_out": "2027-01-02",
                "guests": {"name": "André Palme"},
            }
        ]
    )
    assert buchungen_nach_ende(store, "p-1", ENDE) == []


def test_storniertes_steht_nicht_im_weg() -> None:
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "cancelled",
                "check_in": "2027-02-01", "check_out": "2027-02-08",
                "guests": {"name": "Storniert"},
            }
        ]
    )
    assert buchungen_nach_ende(store, "p-1", ENDE) == []


def test_fremdes_objekt_zaehlt_nicht(  # Wurzel 3: Scope auf property_id
) -> None:
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-2", "status": "confirmed",
                "check_in": "2027-02-01", "check_out": "2027-02-08",
                "guests": {"name": "Anderes Objekt"},
            }
        ]
    )
    assert buchungen_nach_ende(store, "p-1", ENDE) == []


def test_ota_buchung_ist_nicht_lokal_stornierbar() -> None:
    """Der Grund, warum das Enddatum NICHT blockiert (0359).

    `ReservationsService.cancel` lehnt jede Buchung mit
    `source_channex_booking_id` ab (409): der lokale Storno gäbe die Nächte frei
    und meldete sie den Portalen als verfügbar, während der Gast bei
    Booking.com weiter gebucht ist — eine Überbuchung. Forderte die Oberfläche
    hier zum Stornieren auf, schickte sie den Nutzer in eine Sackgasse (live
    waren 66 von 93 künftigen Buchungen genau solche).
    """
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2027-06-02", "check_out": "2027-06-04",
                "source_channex_booking_id": "94fb69a9-1ee6-42c2-a3ef-c47b68bdb530",
                "guests": {"name": "Klaus Froeber"},
            }
        ]
    )
    treffer = buchungen_nach_ende(store, "p-1", ENDE)
    assert treffer[0]["lokal_stornierbar"] is False


def test_eigene_buchung_ist_lokal_stornierbar() -> None:
    """Eine Direktbuchung kann der Betrieb selbst aufheben — die Oberfläche
    darf das anbieten."""
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2027-06-02", "check_out": "2027-06-04",
                "source_channex_booking_id": None,
                "guests": {"name": "Direktgast"},
            }
        ]
    )
    treffer = buchungen_nach_ende(store, "p-1", ENDE)
    assert treffer[0]["lokal_stornierbar"] is True


def test_buchung_dahinter_verhindert_die_sperre_nicht() -> None:
    """Kern von 0359: Das Enddatum wird gesetzt, auch wenn eine Buchung
    dahinter liegt.

    Eine bestätigte Portal-Buchung verschwindet nicht dadurch, dass der Vertrag
    endet — sie wird bedient, der Vertrag läuft für sie aus. Gesperrt werden die
    FREIEN Tage. Vorher scheiterte das Setzen mit 409 und der Aufforderung,
    etwas zu stornieren, was gar nicht stornierbar war.
    """
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2027-06-02", "check_out": "2027-06-04",
                "source_channex_booking_id": "x",
                "guests": {"name": "Klaus Froeber"},
            }
        ]
    )
    vertragsende_aus_update(
        store, "t-1", "p-1", {"contract_end_date": ENDE.isoformat()}
    )
    assert _sperrtage(store), "Das Enddatum muss die freien Tage sperren."


def test_gebuchte_naechte_dahinter_bleiben_gebucht() -> None:
    """Die Sperre darf die Nächte der Buchung nicht übernehmen — sonst verlöre
    der Gast seine Kalenderspur, obwohl seine Buchung gilt."""
    tag = date(2027, 6, 2).isoformat()
    store = _store(
        availability=[
            {
                "property_id": "p-1", "unit_id": "u-1", "date": tag,
                "status": "booked", "source": "booking",
            }
        ]
    )
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    zeile = next(r for r in store.tabellen["availability"] if r["date"] == tag)
    assert zeile["status"] == "booked"


def test_update_ohne_das_feld_ruehrt_die_sperre_nicht_an() -> None:
    """Ein Titel-Update darf die Vertragssperre weder setzen noch aufheben.

    Sonst würde ein beliebiges Speichern die Sperre wegräumen — das Objekt wäre
    ohne Vertrag verkäuflich.
    """
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    vorher = _sperrtage(store)

    vertragsende_aus_update(store, "t-1", "p-1", {"title": "Neuer Name"})
    assert _sperrtage(store) == vorher


def test_update_mit_null_hebt_die_sperre_auf() -> None:
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    vertragsende_aus_update(store, "t-1", "p-1", {"contract_end_date": None})
    assert _sperrtage(store) == []


def test_horizont_wandert_beim_nachzug_mit() -> None:
    """Der entscheidende Wartungsfall (Worker-Tick): ein Lauf ein Jahr später
    muss das nächste Jahr NACHSCHREIBEN.

    Ohne diesen Nachzug wäre die Sperre eines heute gesetzten Enddatums nach
    zwei Jahren erschöpft — und ein Tag ohne `availability`-Zeile geht als
    OFFEN an die Portale. Das Objekt wäre bei Booking und Airbnb wieder
    verkäuflich, obwohl es keinen Vertrag mehr gibt; auffallen würde es erst
    mit der ersten unvertraglichen Buchung.
    """
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    weit_hinten = _sperrtage(store)[-1]

    spaeter = date(2027, 8, 10)
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=spaeter)
    assert _sperrtage(store)[-1] > weit_hinten


def test_nachzug_haelt_die_alten_tage_gesperrt() -> None:
    """Der Nachzug darf den bereits gesperrten Bereich nicht öffnen — er
    schiebt nur das Ende weiter."""
    store = _store()
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=HEUTE)
    vertragsende_durchsetzen(store, "t-1", "p-1", ENDE, heute=date(2027, 8, 10))
    assert date(2027, 9, 1).isoformat() in _sperrtage(store)


def test_nachzug_sperrt_ein_objekt_mit_enddatum() -> None:
    store = _store()
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "contract_end_date": ENDE.isoformat()}
    ]
    vertragsenden_nachziehen(store, 50)
    assert _sperrtage(store)


def test_nachzug_ignoriert_objekte_ohne_enddatum() -> None:
    """Ein Objekt ohne Enddatum darf der Wartungslauf nicht sperren."""
    store = _store()
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "contract_end_date": None}
    ]
    vertragsenden_nachziehen(store, 50)
    assert _sperrtage(store) == []


def test_nachzug_holt_nur_objekte_mit_enddatum_aus_der_db() -> None:
    """Die Auswahl passiert in der ABFRAGE, nicht erst in der Schleife.

    Das Ergebnis wäre auch ohne den Filter richtig — die Schleife überspringt
    ein leeres Datum ohnehin. Falsch wäre nur die Menge: ohne
    `.not_.is_(…, "null")` füllt das `limit` von 50 der Betrieb mit seinen
    normalen Objekten, und die tatsächlich gekündigten fallen hinten heraus.
    Ihr Horizont würde nie nachgezogen — der Fehler, den dieser Lauf gerade
    verhindern soll. Deshalb wird hier die Abfrage geprüft, nicht die Wirkung.
    """
    gesehen: list[list[tuple[str, str, object]]] = []
    store = _store()
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "contract_end_date": ENDE.isoformat()}
    ]
    echtes_table = store.table

    def _mitschreiben(name: str) -> _Query:
        q = echtes_table(name)
        if name == "properties":
            echtes_execute = q.execute

            def _execute() -> _Result:
                gesehen.append(list(q._filter))  # noqa: SLF001 — Test-Attrappe
                return echtes_execute()

            q.execute = _execute  # type: ignore[method-assign]
        return q

    store.table = _mitschreiben  # type: ignore[method-assign]
    vertragsenden_nachziehen(store, 50)
    assert any(
        ("contract_end_date", "notnull", "null") in f for f in gesehen
    ), "Der Wartungslauf muss serverseitig auf gesetzte Enddaten filtern."


def test_info_ist_tenant_gescopt() -> None:
    """Wurzel 3: Der Service umgeht RLS. Ein ungescopter Load per ID gäbe die
    Vertragsdaten eines FREMDEN Betriebs heraus."""
    store = _store()
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-FREMD", "contract_end_date": ENDE.isoformat()}
    ]
    ende, buchungen = vertragsende_info(store, "t-1", "p-1")
    assert ende is None
    assert buchungen == []


def test_info_liefert_ende_und_offene_buchungen() -> None:
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2027-06-02", "check_out": "2027-06-04",
                "source_channex_booking_id": "x",
                "guests": {"name": "Klaus Froeber"},
            }
        ]
    )
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "contract_end_date": ENDE.isoformat()}
    ]
    ende, buchungen = vertragsende_info(store, "t-1", "p-1")
    assert ende == ENDE
    assert len(buchungen) == 1
    assert buchungen[0]["gast"] == "Klaus Froeber"


def test_info_ohne_enddatum_meldet_keine_buchungen() -> None:
    """Ohne Vertragsende gibt es nichts abzuwickeln — die Liste bleibt leer,
    statt ALLE künftigen Buchungen des Objekts zu melden."""
    store = _store(
        reservations=[
            {
                "id": "r-1", "property_id": "p-1", "status": "confirmed",
                "check_in": "2027-06-02", "check_out": "2027-06-04",
                "guests": {"name": "Egal"},
            }
        ]
    )
    store.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "contract_end_date": None}
    ]
    ende, buchungen = vertragsende_info(store, "t-1", "p-1")
    assert ende is None
    assert buchungen == []


def test_als_datum_nimmt_iso_und_date_und_none() -> None:
    """`model_dump(mode="json")` liefert einen String, Tests ein `date` — beide
    Formen müssen dasselbe ergeben, `None` bleibt `None` (Wurzel 4)."""
    assert als_datum("2027-01-02") == ENDE
    assert als_datum(ENDE) == ENDE
    assert als_datum(None) is None


def test_fehler_ohne_details_bleibt_bei_none() -> None:
    """Kein leeres Dict (Wurzel 4) — das sähe im JSON aus wie „geprüft,
    nichts gefunden"."""
    assert PropertyError("x").details is None


# --------------------------------------------------------------------------
# Schema
# --------------------------------------------------------------------------

def test_update_unterscheidet_nicht_gesendet_von_null() -> None:
    """PATCH-Semantik: nur `null` hebt die Sperre auf, ein Update anderer
    Felder darf sie nicht anfassen."""
    from src.features.properties.schemas import PropertyUpdate

    ohne = PropertyUpdate(title="Neu")
    assert "contract_end_date" not in ohne.model_dump(exclude_unset=True)

    mit_null = PropertyUpdate.model_validate({"contract_end_date": None})
    assert "contract_end_date" in mit_null.model_dump(exclude_unset=True)


def test_schema_nimmt_ein_datum_an() -> None:
    from src.features.properties.schemas import PropertyUpdate

    req = PropertyUpdate.model_validate({"contract_end_date": "2027-01-02"})
    assert req.contract_end_date == ENDE


def test_schema_lehnt_unsinn_ab() -> None:
    from pydantic import ValidationError

    from src.features.properties.schemas import PropertyUpdate

    with pytest.raises(ValidationError):
        PropertyUpdate.model_validate({"contract_end_date": "kein-datum"})
