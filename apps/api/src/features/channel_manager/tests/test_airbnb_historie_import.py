"""Airbnb-Buchungen in unsere Tabellen übernehmen.

Die Risiken, die hier abgesichert werden, sind andere als beim Lesen: dort geht
es um Vollständigkeit, hier um FALSCHE Wirkung auf den laufenden Betrieb —
eine Historie, die Nächte auf allen Einheiten sperrt, macht ein Fünf-Studio-
Objekt unverkäuflich; ein geratener Status macht aus einer Anfrage eine
Belegung; eine fremde Währung macht aus 8907 DKK 8907 EUR.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from src.features.channel_manager.airbnb_historie_import import (
    AirbnbHistorieImportMixin,
    gast_aus_thread,
    status_uebersetzen,
)

HEUTE = date(2026, 8, 6)


def _res(**kwargs: Any) -> dict[str, Any]:
    """Eine Airbnb-Reservierung im ECHTEN Format (live abgelesen)."""
    return {
        "confirmation_code": "HMYMXFEKQR",
        "listing_id": "1599942894708700158",
        "start_date": "2026-07-02",
        "end_date": "2026-07-07",
        "status_type": "accept",
        "host_currency": "DKK",
        "base_price": "8911.00",
        "payout_amount": "8607.17",
        "guest_id": "49244333",
        "thread_id": "2431176788",
        "guest_details": {
            "number_of_adults": 4, "number_of_children": 1,
            "number_of_infants": 1, "number_of_pets": 0,
        },
        **kwargs,
    }


# --------------------------------------------------------------------------
# Status — hier entsteht aus einer Anfrage sonst eine echte Belegung.
# --------------------------------------------------------------------------

def test_bestaetigt_und_vergangen_wird_abgeschlossen() -> None:
    """Ein gelaufener Aufenthalt ist nicht „bestätigt", sondern vorbei.

    Ohne das stünde die halbe importierte Historie als laufende Buchung in der
    Übersicht des Betriebs.
    """
    alt = _res(start_date="2024-05-01", end_date="2024-05-08")
    assert status_uebersetzen(alt, heute=HEUTE) == "completed"


def test_bestaetigt_und_kuenftig_bleibt_bestaetigt() -> None:
    """Eine Buchung, deren Abreise noch bevorsteht, bleibt bestätigt."""
    kuenftig = _res(start_date="2026-09-01", end_date="2026-09-08")
    assert status_uebersetzen(kuenftig, heute=HEUTE) == "confirmed"


def test_storniert_bleibt_storniert() -> None:
    """Auch eine alte Stornierung wird nicht zu „abgeschlossen"."""
    storno = _res(status_type="cancelled", start_date="2023-01-01",
                  end_date="2023-01-05")
    assert status_uebersetzen(storno, heute=HEUTE) == "cancelled"


def test_unbekannter_status_wird_nicht_geraten() -> None:
    """Wurzel 4: lieber überspringen als eine Anfrage zur Belegung machen."""
    assert status_uebersetzen(_res(status_type="irgendwas_neues"), heute=HEUTE) is None


# --------------------------------------------------------------------------
# Gastname — Airbnb liefert ihn NICHT in der Reservierung.
# --------------------------------------------------------------------------

def test_gastname_kommt_aus_dem_thread() -> None:
    """Der Reservierungs-Payload trägt nur `guest_id`, keinen Namen.

    Im Thread stehen beide Beteiligten; der Gast ist der, der nicht der
    Gastgeber ist (live: Nicolette, id 6776750, Gastgeber 529591717).
    """
    thread = {"users": [
        {"id": "529591717", "first_name": "Jeanine"},
        {"id": "6776750", "first_name": "Nicolette", "preferred_locale": "nl"},
    ]}
    kontakt = gast_aus_thread(thread, host_id="529591717")
    assert kontakt is not None
    assert kontakt.first_name == "Nicolette"
    assert kontakt.stable_external_ref == "6776750"
    assert kontakt.language == "nl"


def test_ohne_thread_wird_kein_name_erfunden() -> None:
    """Wurzel 4: kein „Gast von Airbnb"."""
    assert gast_aus_thread({"users": [{"id": "529591717"}]}, host_id="529591717") is None


# --------------------------------------------------------------------------
# Schreiben — Attrappe zeichnet auf, was in die DB ginge.
# --------------------------------------------------------------------------

class _Tabelle:
    def __init__(self, db: _DB, name: str) -> None:
        self._db, self._name = db, name
        self._filter: dict[str, Any] = {}

    def select(self, *_a: object) -> _Tabelle:
        return self

    def eq(self, spalte: str, wert: object) -> _Tabelle:
        self._filter[spalte] = wert
        return self

    def gte(self, *_a: object) -> _Tabelle:
        return self

    def lte(self, *_a: object) -> _Tabelle:
        return self

    def lt(self, *_a: object) -> _Tabelle:
        return self

    def limit(self, _n: int) -> _Tabelle:
        return self

    def order(self, *_a: object, **_k: object) -> _Tabelle:
        return self

    def upsert(self, rows: Any, **_k: object) -> _Tabelle:
        self._db.upserts.append((self._name, rows))
        return self

    def insert(self, rows: Any, **_k: object) -> _Tabelle:
        # Reservierungen werden per insert/update geschrieben, NICHT per
        # upsert: der Unique-Index ist partiell, darauf lässt PostgREST kein
        # ON CONFLICT zu (live 42P10). Für die Tests zählt beides als
        # „geschrieben", deshalb dieselbe Liste.
        self._db.upserts.append((self._name, rows))
        return self

    def update(self, patch: dict[str, Any]) -> _Tabelle:
        # Der Filter wird bei Supabase NACH update() angehängt
        # (`.update(...).eq(...)`), deshalb die Referenz aufs Dict merken und
        # erst beim Aufzeichnen kopieren — sonst stünde hier immer {}.
        self._db.updates.append((self._name, patch, self._filter))
        return self

    def execute(self) -> Any:
        if self._name == "reservations" and "source_channex_booking_id" in self._filter:
            treffer = self._db.bestand.get(
                self._filter["source_channex_booking_id"]
            )
            return type("R", (), {"data": [treffer] if treffer else []})()
        return type("R", (), {"data": self._db.zeilen.get(self._name, [])})()


class _DB:
    def __init__(self, bestand: dict[str, dict[str, Any]] | None = None) -> None:
        self.bestand = bestand or {}
        self.upserts: list[tuple[str, Any]] = []
        self.updates: list[tuple[str, dict, dict]] = []
        self.zeilen: dict[str, list[dict[str, Any]]] = {
            "property_units": [{"id": "u-1"}, {"id": "u-2"}],
        }

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


class _Dienst(AirbnbHistorieImportMixin):
    """Der Gast-Resolver ist ein eigener, getesteter Slice — hier festgelegt."""

    def _gast_der_buchung(
        self, db: Any, tenant_id: str, res: dict[str, Any], bestand: bool
    ) -> str:
        _ = (db, tenant_id, res, bestand)
        return "gast-1"


def _reservierung(db: _DB) -> dict[str, Any]:
    return next(r for name, r in db.upserts if name == "reservations")


def test_waehrung_kommt_vom_objekt_nicht_aus_der_buchung() -> None:
    """Wurzel 4: keine geratene Währung, und kein stiller Mix.

    Passt Airbnbs `host_currency` nicht zur Objektwährung, wird übersprungen —
    8911 DKK als 8911 EUR zu buchen wäre ein Faktor 7.
    """
    db = _DB()
    erg = _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="EUR", heute=HEUTE
    )
    assert erg.uebersprungen == 1
    assert erg.angelegt == 0
    assert not db.upserts, "Bei Währungs-Konflikt darf NICHTS geschrieben werden"


def test_passende_waehrung_wird_uebernommen() -> None:
    db = _DB()
    erg = _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    assert erg.angelegt == 1
    zeile = _reservierung(db)
    assert zeile["currency"] == "DKK"
    assert zeile["total_amount"] == 8911.0
    assert zeile["channel"] == "airbnb"
    assert zeile["source_channex_booking_id"] == "HMYMXFEKQR"


def test_personenzahlen_sind_nie_null() -> None:
    """Live gescheitert (23502): `children`/`infants`/`pets`/`adults` sind in
    der DB NOT NULL. Ein `or None` bei „0 Kinder" kippte den ganzen Import —
    die Null IST hier die Aussage, nicht das Fehlen einer Angabe.
    """
    db = _DB()
    ohne = _res(guest_details={"number_of_adults": 2, "number_of_children": 0,
                               "number_of_infants": 0, "number_of_pets": 0})
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [ohne], waehrung="DKK", heute=HEUTE
    )
    zeile = _reservierung(db)
    for spalte in ("adults", "children", "infants", "pets", "num_guests",
                   "total_amount", "paid_amount"):
        assert zeile[spalte] is not None, f"{spalte} darf nie None sein"
    assert zeile["children"] == 0
    assert zeile["num_guests"] == 2


def test_ohne_personenangabe_mindestens_ein_gast() -> None:
    """Eine Buchung über null Personen gibt es nicht — 1 ist die untere
    Schranke, kein geratener Wert."""
    db = _DB()
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res(guest_details={})], waehrung="DKK", heute=HEUTE
    )
    zeile = _reservierung(db)
    assert zeile["num_guests"] == 1
    assert zeile["adults"] == 1


def test_belegt_genau_eine_einheit() -> None:
    """Das Datenmodell: 1 Objekt = 1 Typ mit n Einheiten.

    Ohne unit_id fächerte `je_einheit` den Tag auf ALLE Einheiten auf — bei
    fünf gleichen Studios wären vier fälschlich dicht.
    """
    db = _DB()
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    kalender = [r for name, r in db.upserts if name == "availability"]
    assert kalender, "Die Nächte müssen gesperrt werden"
    einheiten = {z["unit_id"] for z in kalender[0]}
    assert len(einheiten) == 1, f"Nur EINE Einheit belegen, nicht {einheiten}"


def test_naechte_ohne_abreisetag() -> None:
    """Der Abreisetag ist frei — sonst blockiert jede Buchung eine Nacht zu viel."""
    db = _DB()
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    kalender = [r for name, r in db.upserts if name == "availability"][0]
    tage = sorted({z["date"] for z in kalender})
    assert tage == ["2026-07-02", "2026-07-03", "2026-07-04",
                    "2026-07-05", "2026-07-06"]


def test_erneuter_import_legt_nicht_doppelt_an() -> None:
    """Wurzel 2: Doppelklick, Wiederholung, Überlappung — alles kommt doppelt."""
    db = _DB(bestand={"HMYMXFEKQR": {
        "id": "r-1", "status": "confirmed", "unit_id": "u-1",
        "check_in": "2026-07-02", "check_out": "2026-07-07",
    }})
    erg = _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    assert (erg.angelegt, erg.aktualisiert) == (0, 1)


def test_verschobene_buchung_gibt_alte_naechte_frei() -> None:
    """Wurzel 1: der Gegenzustand.

    Ohne Freigabe bliebe der alte Zeitraum als Phantom-Belegung gesperrt —
    das Objekt wäre für Tage dicht, an denen niemand da ist.
    """
    db = _DB(bestand={"HMYMXFEKQR": {
        "id": "r-1", "status": "confirmed", "unit_id": "u-1",
        "check_in": "2026-06-01", "check_out": "2026-06-05",
    }})
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    freigaben = [u for u in db.updates if u[0] == "availability"]
    assert freigaben, "Der alte Zeitraum muss freigegeben werden"
    assert freigaben[0][1]["status"] == "open"


def test_freigabe_faesst_nur_gebuchte_naechte_an() -> None:
    """Eine manuelle Sperre (`blocked`) darf ein Import nicht aufreißen."""
    db = _DB(bestand={"HMYMXFEKQR": {
        "id": "r-1", "status": "confirmed", "unit_id": "u-1",
        "check_in": "2026-06-01", "check_out": "2026-06-05",
    }})
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res()], waehrung="DKK", heute=HEUTE
    )
    _, _, filter_ = [u for u in db.updates if u[0] == "availability"][0]
    assert filter_.get("status") == "booked"


def test_stornierte_buchung_belegt_nichts() -> None:
    """Eine Stornierung darf keine Nacht sperren."""
    db = _DB()
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res(status_type="cancelled")],
        waehrung="DKK", heute=HEUTE,
    )
    assert not [r for name, r in db.upserts if name == "availability"]
    assert _reservierung(db)["status"] == "cancelled"


def test_historie_bucht_keine_provision_nach() -> None:
    """Bewusste Festlegung: kein rückwirkender Eingriff in die Buchhaltung."""
    db = _DB()
    _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", [_res(start_date="2023-05-01", end_date="2023-05-08")],
        waehrung="DKK", heute=HEUTE,
    )
    zeile = _reservierung(db)
    assert "ota_commission" not in zeile
    assert "channel_fee" not in zeile
    assert zeile["status"] == "completed"


def test_gruende_werden_entdoppelt() -> None:
    """Bei 400 Buchungen will niemand 400-mal denselben Grund lesen —
    aber DASS es vorkam, muss sichtbar bleiben."""
    db = _DB()
    kaputt = [_res(confirmation_code=f"X{i}", status_type="unbekannt")
              for i in range(5)]
    erg = _Dienst().airbnb_buchungen_uebernehmen(
        db, "t-1", "p-1", kaputt, waehrung="DKK", heute=HEUTE
    )
    assert erg.uebersprungen == 5
    assert len(erg.gruende) == 1
