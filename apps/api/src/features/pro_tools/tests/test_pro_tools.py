"""Tests der professionellen Tools und der Massenbearbeitung.

Die teuerste Verwechslung an dieser Stelle wäre eine Erfolgsmeldung, die nicht
stimmt. Eine Massenänderung, die 20 Objekte melden soll und 12 geschrieben hat,
sieht in der Oberfläche genauso aus wie eine, die alles erledigt hat — deshalb
prüfen die Tests nicht nur, DASS geschrieben wird, sondern auch, was in
`geaendert`, `unveraendert` und `fehlgeschlagen` landet.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.features.pro_tools.schemas import (
    MAX_OBJEKTE,
    Massenaenderung,
    Massenfeld,
)
from src.features.pro_tools.service import ProToolsError, ProToolsService

from ._fake import FakeDB, FakeProperties, FakeRates, ctx


def _dienst(
    *,
    aktiv: bool = True,
    objekte: int = 2,
    attrs: dict | None = None,
    plaene: list[dict] | None = None,
    properties_wirft: set[str] | None = None,
    rates_wirft: set[str] | None = None,
) -> tuple[ProToolsService, FakeProperties, FakeRates, FakeDB]:
    db = FakeDB(
        tenants=[{"id": "t-1", "professional_tools": aktiv}],
        properties=[
            {"id": f"p-{i}", "tenant_id": "t-1", "type_attributes": attrs or {}}
            for i in range(1, objekte + 1)
        ]
        + [{"id": "p-fremd", "tenant_id": "t-2", "type_attributes": {}}],
        rate_plans=plaene
        if plaene is not None
        else [
            {
                "id": f"rp-{i}",
                "property_id": f"p-{i}",
                "min_stay": 1,
                "booking_condition_id": None,
                "derived_from_rate_plan_id": None,
            }
            for i in range(1, objekte + 1)
        ],
    )
    props = FakeProperties(db, wirft=properties_wirft)
    rates = FakeRates(db, wirft=rates_wirft)
    return ProToolsService(db, properties=props, rates=rates), props, rates, db


def _aenderung(**kwargs: object) -> Massenaenderung:
    basis: dict = {
        "feld": Massenfeld.hoechstaufenthalt,
        "zahl": 14,
        "property_ids": ["p-1", "p-2"],
    }
    basis.update(kwargs)
    return Massenaenderung(**basis)  # type: ignore[arg-type]


# --- Der Schalter -----------------------------------------------------------


def test_schalter_lesen() -> None:
    svc, _, _, _ = _dienst(aktiv=False, objekte=3)
    stand = svc.stand(ctx())
    assert stand.aktiv is False
    # Das fremde Objekt zählt nicht mit (Wurzel 3).
    assert stand.objekte == 3
    assert stand.mindest_objekte == 2


def test_einschalten_braucht_mehr_als_ein_objekt() -> None:
    """Bookings Kriterium, wörtlich: „Sie müssen mehr als eine Unterkunft
    verwalten." Ein Schalter, der nichts zu bearbeiten hätte, ist eine
    Attrappe."""
    svc, _, _, db = _dienst(aktiv=False, objekte=1)
    with pytest.raises(ProToolsError) as exc:
        svc.setzen(ctx(), True)
    assert exc.value.status_code == 422
    assert db.tables["tenants"][0]["professional_tools"] is False


def test_ausschalten_geht_immer() -> None:
    """Der Weg zurück darf nie an einer Bedingung hängen — sonst sitzt ein
    Betrieb, der auf ein Objekt schrumpft, im eingeschalteten Zustand fest."""
    svc, _, _, db = _dienst(aktiv=True, objekte=1)
    assert svc.setzen(ctx(), False).aktiv is False
    assert db.tables["tenants"][0]["professional_tools"] is False


def test_ausschalten_loescht_nichts() -> None:
    """Airbnb löscht beim Abschalten Regelsätze und Standardgebühren. Bei uns
    IST ein Regelsatz eine Saison, die jeder benutzt — hier darf deshalb kein
    einziger Datensatz fallen (bewusste Abweichung, siehe Migration 0720)."""
    svc, _, _, db = _dienst(aktiv=True, objekte=2)
    vorher = [dict(p) for p in db.tables["properties"]]
    svc.setzen(ctx(), False)
    assert db.tables["properties"] == vorher
    assert db.schreibzugriffe == ["tenants"]


def test_ohne_betrieb_kein_zugriff() -> None:
    svc, _, _, _ = _dienst()
    with pytest.raises(ProToolsError) as exc:
        svc.stand(ctx(tenant_id=None))
    assert exc.value.status_code == 403


def test_unbekannter_betrieb_ist_404() -> None:
    svc, _, _, db = _dienst()
    db.tables["tenants"] = []
    with pytest.raises(ProToolsError) as exc:
        svc.stand(ctx())
    assert exc.value.status_code == 404


# --- Der Riegel -------------------------------------------------------------


def test_massenbearbeitung_ohne_schalter_ist_verboten() -> None:
    """Fail-closed (Wurzel 5): der Riegel sitzt im Dienst, nicht in der
    Oberfläche. Wer den Endpunkt direkt aufruft, kommt nicht durch."""
    svc, props, _, _ = _dienst(aktiv=False)
    with pytest.raises(ProToolsError) as exc:
        svc.massenbearbeiten(ctx(), _aenderung())
    assert exc.value.status_code == 403
    assert props.aufrufe == []


def test_fremdes_objekt_wird_nicht_angefasst() -> None:
    """Wurzel 3: die Kennungen kommen aus dem Aufruf, der Mandant aus dem
    Kontext. Ein fremdes Objekt wird gemeldet, nicht bearbeitet — und auch
    nicht still verschwiegen."""
    svc, props, _, _ = _dienst()
    ergebnis = svc.massenbearbeiten(
        ctx(), _aenderung(property_ids=["p-1", "p-fremd"])
    )
    assert ergebnis.geaendert == ["p-1"]
    assert [f.property_id for f in ergebnis.fehlgeschlagen] == ["p-fremd"]
    assert [pid for pid, _ in props.aufrufe] == ["p-1"]


# --- Objektfelder -----------------------------------------------------------


def test_hoechstaufenthalt_wird_gesetzt() -> None:
    svc, props, _, _ = _dienst()
    ergebnis = svc.massenbearbeiten(ctx(), _aenderung(zahl=14))
    assert ergebnis.geaendert == ["p-1", "p-2"]
    assert ergebnis.unveraendert == []
    for _, changes in props.aufrufe:
        assert changes["type_attributes"]["availability"]["maxStay"] == 14


def test_der_blob_behaelt_seine_uebrigen_werte() -> None:
    """Wurzel 1: der `availability`-Blob wird ERGÄNZT, nicht ersetzt. Ihn neu
    aufzubauen würde Mindestaufenthalts-Typ und Vorlaufzeit löschen, ohne dass
    jemand sie angefasst hätte."""
    svc, props, _, _ = _dienst(
        attrs={
            "availability": {"minStayType": "arrival", "cutOffDays": 3},
            "pricing": {"basePrice": 90},
        }
    )
    svc.massenbearbeiten(ctx(), _aenderung(zahl=21))
    _, changes = props.aufrufe[0]
    verf = changes["type_attributes"]["availability"]
    assert verf == {"minStayType": "arrival", "cutOffDays": 3, "maxStay": 21}
    assert changes["type_attributes"]["pricing"] == {"basePrice": 90}


def test_gleicher_wert_gilt_als_unveraendert() -> None:
    """Zweimal dasselbe zu senden darf nicht zweimal schreiben (Wurzel 2) —
    sonst löst jeder Doppelklick einen Portal-Sync je Objekt aus."""
    svc, props, _, _ = _dienst()
    svc.massenbearbeiten(ctx(), _aenderung(zahl=14))
    zweiter = svc.massenbearbeiten(ctx(), _aenderung(zahl=14))
    assert zweiter.geaendert == []
    assert zweiter.unveraendert == ["p-1", "p-2"]
    assert len(props.aufrufe) == 2  # nur die des ersten Laufs


@pytest.mark.parametrize(
    ("feld", "schluessel"),
    [
        (Massenfeld.hoechstaufenthalt, "maxStay"),
        (Massenfeld.vorlaufzeit, "cutOffDays"),
        (Massenfeld.buchungsfenster, "maxDayAdvance"),
    ],
)
def test_jedes_objektfeld_trifft_seinen_schluessel(
    feld: Massenfeld, schluessel: str
) -> None:
    """Die Schlüssel sind von Channex vorgegeben. Ein eigener Name wäre ein
    Wert, der gespeichert wird und bei keinem Portal ankommt."""
    svc, props, _, _ = _dienst()
    svc.massenbearbeiten(ctx(), _aenderung(feld=feld, zahl=7))
    _, changes = props.aufrufe[0]
    assert changes["type_attributes"]["availability"] == {schluessel: 7}


# --- Preisplan-Felder -------------------------------------------------------


def test_mindestaufenthalt_geht_an_den_preisplan() -> None:
    svc, props, rates, _ = _dienst()
    ergebnis = svc.massenbearbeiten(
        ctx(), _aenderung(feld=Massenfeld.mindestaufenthalt, zahl=3)
    )
    assert ergebnis.geaendert == ["p-1", "p-2"]
    assert rates.aufrufe == [("rp-1", {"min_stay": 3}), ("rp-2", {"min_stay": 3})]
    # Das Objekt selbst wird dabei nicht angefasst.
    assert props.aufrufe == []


def test_stornobedingung_geht_an_den_preisplan() -> None:
    svc, _, rates, _ = _dienst()
    svc.massenbearbeiten(
        ctx(),
        _aenderung(feld=Massenfeld.stornobedingung, zahl=None, auswahl="bc-1"),
    )
    assert rates.aufrufe == [
        ("rp-1", {"booking_condition_id": "bc-1"}),
        ("rp-2", {"booking_condition_id": "bc-1"}),
    ]


def test_abgeleiteter_plan_wird_uebergangen() -> None:
    """Ein abgeleiteter Plan übernimmt seine Werte vom Eltern-Plan. Ihn zu
    beschreiben wäre eine Änderung, die beim nächsten Ableiten verschwindet —
    derselbe Fehler wie eine Anzeige ohne Speicherung."""
    svc, _, rates, _ = _dienst(
        objekte=1,
        plaene=[
            {
                "id": "rp-abgeleitet",
                "property_id": "p-1",
                "min_stay": 1,
                "booking_condition_id": None,
                "derived_from_rate_plan_id": "rp-basis",
            },
            {
                "id": "rp-basis",
                "property_id": "p-1",
                "min_stay": 1,
                "booking_condition_id": None,
                "derived_from_rate_plan_id": None,
            },
        ],
    )
    svc.massenbearbeiten(
        ctx(),
        _aenderung(
            feld=Massenfeld.mindestaufenthalt, zahl=2, property_ids=["p-1"]
        ),
    )
    assert [pid for pid, _ in rates.aufrufe] == ["rp-basis"]


def test_objekt_ohne_preisplan_wird_gemeldet() -> None:
    """Ein Entwurf hat keinen Preisplan. Das ist kein Absturz, aber auch kein
    Erfolg — es gehört in die Fehlschlag-Liste, sonst zählt der Gastgeber
    hinterher nach und findet eine Lücke ohne Erklärung."""
    svc, _, rates, _ = _dienst(plaene=[])
    ergebnis = svc.massenbearbeiten(
        ctx(), _aenderung(feld=Massenfeld.mindestaufenthalt, zahl=2)
    )
    assert ergebnis.geaendert == []
    assert [f.property_id for f in ergebnis.fehlgeschlagen] == ["p-1", "p-2"]
    assert "Preisplan" in ergebnis.fehlgeschlagen[0].grund
    assert rates.aufrufe == []


# --- Teilerfolg -------------------------------------------------------------


def test_ein_fehlschlag_reisst_die_uebrigen_nicht_mit() -> None:
    """Der Kern der Massenbearbeitung: 20 Objekte, eines scheitert, 19 sind
    trotzdem umgestellt — und der Gastgeber erfährt, welches nicht."""
    svc, props, _, _ = _dienst(objekte=3, properties_wirft={"p-2"})
    ergebnis = svc.massenbearbeiten(
        ctx(), _aenderung(property_ids=["p-1", "p-2", "p-3"])
    )
    assert ergebnis.geaendert == ["p-1", "p-3"]
    assert [f.property_id for f in ergebnis.fehlgeschlagen] == ["p-2"]
    assert ergebnis.fehlgeschlagen[0].grund == "Objekt ist gesperrt."
    assert [pid for pid, _ in props.aufrufe] == ["p-1", "p-3"]


# --- Eingangsprüfung (Wurzel 8) ---------------------------------------------


def test_zu_viele_objekte_werden_abgewiesen() -> None:
    with pytest.raises(ValidationError):
        _aenderung(property_ids=[f"p-{i}" for i in range(MAX_OBJEKTE + 1)])


def test_leere_auswahl_wird_abgewiesen() -> None:
    with pytest.raises(ValidationError):
        _aenderung(property_ids=[])


def test_doppelte_kennung_wird_abgewiesen() -> None:
    """Sonst stünde „2 geändert" für ein Objekt."""
    with pytest.raises(ValidationError):
        _aenderung(property_ids=["p-1", "p-1"])


@pytest.mark.parametrize(
    ("feld", "zahl"),
    [
        (Massenfeld.mindestaufenthalt, 0),  # mindestens eine Nacht
        (Massenfeld.mindestaufenthalt, 366),
        (Massenfeld.hoechstaufenthalt, -1),
        (Massenfeld.buchungsfenster, 1096),
    ],
)
def test_zahlen_ausserhalb_der_grenzen(feld: Massenfeld, zahl: int) -> None:
    with pytest.raises(ValidationError):
        _aenderung(feld=feld, zahl=zahl)


def test_null_heisst_keine_grenze_und_ist_erlaubt() -> None:
    """0 ist bei Höchstaufenthalt und Buchungsfenster eine ECHTE Angabe
    („kein Limit") — sie darf nicht an derselben Prüfung scheitern wie ein
    Mindestaufenthalt von 0 Nächten."""
    assert _aenderung(feld=Massenfeld.hoechstaufenthalt, zahl=0).zahl == 0
    assert _aenderung(feld=Massenfeld.buchungsfenster, zahl=0).zahl == 0


def test_stornobedingung_ohne_auswahl_wird_abgewiesen() -> None:
    with pytest.raises(ValidationError):
        _aenderung(feld=Massenfeld.stornobedingung, zahl=None, auswahl="  ")


def test_zahlenfeld_mit_auswahl_wird_abgewiesen() -> None:
    """Beides zu senden ist eine Aussage, die zwei Dinge gleichzeitig meint —
    der Dienst würde eines davon stillschweigend verwerfen."""
    with pytest.raises(ValidationError):
        _aenderung(feld=Massenfeld.hoechstaufenthalt, zahl=5, auswahl="bc-1")
