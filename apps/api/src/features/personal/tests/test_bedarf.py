"""Bedarf, Produktivität, Budget, Umsatzbuch (0545, §2.2) gegen das DB-Doppel."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from src.features.personal._base import PersonalError
from src.features.personal.bedarf import BedarfService
from src.features.personal.bedarf_schemas import (
    BedarfZeile,
    BudgetZeile,
    ProduktivitaetZeile,
    UmsatzbuchSchreiben,
)

from ._fake import FakeDB, basis_tabellen, ctx

MONTAG = date(2026, 9, 7)
SONNTAG = MONTAG + timedelta(days=6)


def _tabellen() -> dict[str, list[dict]]:
    t = basis_tabellen()
    t["property_units"] = [
        {"id": "pu-1", "tenant_id": "t-1", "property_id": "p-1", "name": "Haus", "position": 0}
    ]
    t["personal_arbeitsbereiche"] = [
        {
            "id": "ab-1",
            "tenant_id": "t-1",
            "name": "Housekeeping",
            "kurz": "HK",
            "farbe": "#112233",
            "sort": 0,
            "archived_at": None,
        },
        {
            "id": "ab-2",
            "tenant_id": "t-1",
            "name": "Rezeption",
            "kurz": "REZ",
            "farbe": "#334455",
            "sort": 1,
            "archived_at": None,
        },
        {
            "id": "ab-fremd",
            "tenant_id": "t-2",
            "name": "Fremd",
            "kurz": "F",
            "farbe": "#000000",
            "sort": 0,
            "archived_at": None,
        },
    ]
    t["reservations"] = []
    t["personal_schichten"] = []
    t["personal_zeiterfassung"] = []
    t["personal_bedarf"] = []
    t["personal_budget"] = []
    t["personal_produktivitaet"] = []
    t["personal_umsatzbuch"] = []
    t["personal_fremdfirmen"] = []
    return t


@pytest.fixture
def db() -> FakeDB:
    return FakeDB(_tabellen())


def _zeile(
    *, wochentag: int | None = None, datum: date | None = None, anzahl: int = 2
) -> BedarfZeile:
    return BedarfZeile(
        arbeitsbereich_id="ab-1",
        wochentag=wochentag,
        datum=datum,
        zeit_von="08:00",
        zeit_bis="12:00",
        anzahl=anzahl,
    )


# --- Bedarf -------------------------------------------------------------------


def test_vorlagen_put_ersetzt_alle_vorlagen(db: FakeDB) -> None:
    svc = BedarfService(db)
    svc.bedarf_vorlagen_setzen(ctx(), [_zeile(wochentag=0), _zeile(wochentag=1)])
    assert len(db.tables["personal_bedarf"]) == 2
    # Ersetzen, nicht einfügen (Wurzel 1): sonst stünden hier drei Zeilen.
    svc.bedarf_vorlagen_setzen(ctx(), [_zeile(wochentag=2, anzahl=1)])
    assert len(db.tables["personal_bedarf"]) == 1
    assert db.tables["personal_bedarf"][0]["wochentag"] == 2
    assert db.tables["personal_bedarf"][0]["quelle"] == "vorlage"


def test_tage_put_ersetzt_nur_manuelle_zeilen(db: FakeDB) -> None:
    """Eine übernommene Prognose bleibt stehen — sie ist keine Handeingabe."""
    db.tables["personal_bedarf"] = [
        {
            "id": "b-prognose",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": None,
            "datum": MONTAG.isoformat(),
            "zeit_von": "08:00:00",
            "zeit_bis": "16:00:00",
            "anzahl": 3,
            "quelle": "prognose",
            "prognose_id": "pr-1",
        },
        {
            "id": "b-manuell",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": None,
            "datum": MONTAG.isoformat(),
            "zeit_von": "08:00:00",
            "zeit_bis": "12:00:00",
            "anzahl": 1,
            "quelle": "manuell",
        },
    ]
    BedarfService(db).bedarf_tage_setzen(
        ctx(), MONTAG, SONNTAG, [_zeile(datum=MONTAG + timedelta(days=1), anzahl=4)]
    )
    quellen = sorted(r["quelle"] for r in db.tables["personal_bedarf"])
    assert quellen == ["manuell", "prognose"]
    ids = {r["id"] for r in db.tables["personal_bedarf"]}
    assert "b-prognose" in ids
    assert "b-manuell" not in ids


def test_tageszeile_ausserhalb_des_fensters_ist_422(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        BedarfService(db).bedarf_tage_setzen(
            ctx(), MONTAG, SONNTAG, [_zeile(datum=SONNTAG + timedelta(days=1))]
        )
    assert exc.value.status_code == 422
    assert (exc.value.details or {}).get("code") == "datum_ausserhalb"


def test_fremder_arbeitsbereich_ist_404(db: FakeDB) -> None:
    """Wurzel 3: ein Bereich eines anderen Betriebs darf nicht durchgehen."""
    zeile = BedarfZeile(
        arbeitsbereich_id="ab-fremd",
        wochentag=0,
        zeit_von="08:00",
        zeit_bis="12:00",
        anzahl=1,
    )
    with pytest.raises(PersonalError) as exc:
        BedarfService(db).bedarf_vorlagen_setzen(ctx(), [zeile])
    assert exc.value.status_code == 404


def test_bedarf_lesen_trennt_vorlagen_und_tage(db: FakeDB) -> None:
    svc = BedarfService(db)
    svc.bedarf_vorlagen_setzen(ctx(), [_zeile(wochentag=0)])
    svc.bedarf_tage_setzen(ctx(), MONTAG, SONNTAG, [_zeile(datum=MONTAG)])
    antwort = svc.bedarf(ctx(), MONTAG, SONNTAG)
    assert len(antwort.vorlagen) == 1
    assert len(antwort.tage) == 1
    assert antwort.tage[0].datum == MONTAG


def test_bedarf_loeschen_nur_im_eigenen_betrieb(db: FakeDB) -> None:
    db.tables["personal_bedarf"] = [
        {
            "id": "b-fremd",
            "tenant_id": "t-2",
            "arbeitsbereich_id": "ab-fremd",
            "wochentag": 0,
            "datum": None,
            "zeit_von": "08:00:00",
            "zeit_bis": "12:00:00",
            "anzahl": 1,
            "quelle": "manuell",
        }
    ]
    with pytest.raises(PersonalError) as exc:
        BedarfService(db).bedarf_loeschen(ctx(), "b-fremd")
    assert exc.value.status_code == 404
    assert len(db.tables["personal_bedarf"]) == 1


# --- Produktivität ------------------------------------------------------------


def test_produktivitaet_put_ersetzt_und_verbietet_doppelten_bereich(db: FakeDB) -> None:
    svc = BedarfService(db)
    svc.produktivitaet_setzen(
        ctx(),
        [
            ProduktivitaetZeile(arbeitsbereich_id="ab-1", basis="abreisen", wert=2.5),
            ProduktivitaetZeile(arbeitsbereich_id="ab-2", basis="anreisen", wert=8),
        ],
    )
    assert len(svc.produktivitaet(ctx())) == 2
    svc.produktivitaet_setzen(
        ctx(), [ProduktivitaetZeile(arbeitsbereich_id="ab-1", basis="fest", wert=6)]
    )
    zeilen = svc.produktivitaet(ctx())
    assert len(zeilen) == 1
    assert zeilen[0].basis == "fest"
    with pytest.raises(PersonalError) as exc:
        svc.produktivitaet_setzen(
            ctx(),
            [
                ProduktivitaetZeile(arbeitsbereich_id="ab-1", basis="fest", wert=6),
                ProduktivitaetZeile(arbeitsbereich_id="ab-1", basis="gaeste", wert=9),
            ],
        )
    assert (exc.value.details or {}).get("code") == "bereich_doppelt"


# --- Budget -------------------------------------------------------------------


def test_budget_betrag_ohne_waehrung_wird_abgelehnt() -> None:
    """Wurzel 4: kein stiller EUR-Ersatz — das Schema weist es ab."""
    with pytest.raises(ValueError, match="Währung"):
        BudgetZeile(wochentag=0, betrag_minor=1000)


def test_budget_tage_put_ersetzt_im_fenster(db: FakeDB) -> None:
    svc = BedarfService(db)
    svc.budget_tage_setzen(
        ctx(), MONTAG, SONNTAG, [BudgetZeile(datum=MONTAG, stunden=10)]
    )
    svc.budget_tage_setzen(
        ctx(), MONTAG, SONNTAG, [BudgetZeile(datum=MONTAG + timedelta(days=1), stunden=8)]
    )
    antwort = svc.budget(ctx(), MONTAG, SONNTAG)
    assert len(antwort.tage) == 1
    assert antwort.tage[0].datum == MONTAG + timedelta(days=1)


# --- Umsatzbuch ---------------------------------------------------------------


def test_umsatzbuch_liefert_jeden_tag_auch_ohne_zeile(db: FakeDB) -> None:
    zeilen = BedarfService(db).umsatzbuch(ctx(), MONTAG, MONTAG + timedelta(days=2))
    assert [z.datum for z in zeilen] == [
        MONTAG,
        MONTAG + timedelta(days=1),
        MONTAG + timedelta(days=2),
    ]
    assert all(z.quelle is None for z in zeilen)


def test_umsatzbuch_upsert_und_loeschen(db: FakeDB) -> None:
    """Select-then-write statt on_conflict (partielle Indizes, 42P10)."""
    svc = BedarfService(db)
    svc.umsatzbuch_setzen(
        ctx(),
        [UmsatzbuchSchreiben(datum=MONTAG, plan_minor=100_000, currency="DKK")],
    )
    assert len(db.tables["personal_umsatzbuch"]) == 1
    # Zweiter Aufruf ändert dieselbe Zeile, legt keine zweite an (Wurzel 2).
    svc.umsatzbuch_setzen(
        ctx(),
        [UmsatzbuchSchreiben(datum=MONTAG, plan_minor=200_000, currency="DKK")],
    )
    assert len(db.tables["personal_umsatzbuch"]) == 1
    assert db.tables["personal_umsatzbuch"][0]["plan_minor"] == 200_000
    # Beide Beträge leer löscht die Zeile.
    svc.umsatzbuch_setzen(ctx(), [UmsatzbuchSchreiben(datum=MONTAG)])
    assert not db.tables["personal_umsatzbuch"]


def test_umsatzbuch_je_bereich_neben_der_betriebszeile(db: FakeDB) -> None:
    svc = BedarfService(db)
    svc.umsatzbuch_setzen(
        ctx(),
        [
            UmsatzbuchSchreiben(datum=MONTAG, plan_minor=100_000, currency="DKK"),
            UmsatzbuchSchreiben(
                datum=MONTAG, arbeitsbereich_id="ab-1", plan_minor=40_000, currency="DKK"
            ),
        ],
    )
    assert len(db.tables["personal_umsatzbuch"]) == 2
    zeilen = svc.umsatzbuch(ctx(), MONTAG, MONTAG)
    bereiche = {z.arbeitsbereich_id for z in zeilen}
    assert bereiche == {None, "ab-1"}


def test_umsatzbuch_betrag_ohne_waehrung_wird_abgelehnt() -> None:
    with pytest.raises(ValueError, match="Währung"):
        UmsatzbuchSchreiben(datum=MONTAG, ist_minor=5000)
