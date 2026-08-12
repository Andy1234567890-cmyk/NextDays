"""Tests für die Kopplung Abrechnungsvertrag → Vermarktungsende (0378).

Der Fehler, den diese Kopplung schließt, war live zu sehen (12.08.2026): ein
„Gültig bis" im Vertrag-Panel sperrte den Kalender nicht, das Objekt blieb bei
Booking und Airbnb verkäuflich. Umgekehrt trugen vier Objekte ein
Vermarktungsende ohne jede Vertragszeile.

Die zwei Fälle, in denen eine naive Umsetzung Geld kostet, stehen zuerst:
  * Ein SATZWECHSEL (20 % bis 31.12., 18 % ab 01.01.) darf NICHTS sperren —
    sonst nimmt eine Preisanpassung das Objekt ab Silvester aus dem Verkauf.
  * Ein Objekt OHNE Vertragszeile darf sein Vermarktungsende nicht verlieren —
    es kommt dort aus dem Kündigungsantrag oder von Hand.

Der Store filtert echt (eq/gte/lt/in_), damit ein kaputter Scope auffällt.
Wiederverwendet aus `properties.tests.test_vertragsende`: derselbe Kalender, und
ein zweiter Doppelgänger daneben würde mit der Zeit anders antworten als der
erste.
"""
from datetime import date

from src.features.properties.tests.test_vertragsende import _Store
from src.features.properties.vertragsende import QUELLE

from ..vertragsende_kopplung import (
    betroffene_objekte,
    ende_bestimmen,
    nachziehen,
)

HEUTE = date(2026, 8, 12)
ENDE = date(2026, 10, 10)


def _store(
    terms: list[dict] | None = None,
    properties: list[dict] | None = None,
    owner_properties: list[dict] | None = None,
) -> _Store:
    return _Store(
        {
            "owner_billing_terms": terms or [],
            "properties": properties
            or [{"id": "p-1", "tenant_id": "t-1", "title": "Villa"}],
            "owner_properties": owner_properties
            or [{"owner_id": "o-1", "property_id": "p-1"}],
            "availability": [],
            "reservations": [],
            "property_units": [
                {
                    "id": "u-1",
                    "property_id": "p-1",
                    "tenant_id": "t-1",
                    "position": 1,
                }
            ],
            "jobs": [],
        }
    )


def _vertrag(
    ab: str,
    bis: str | None,
    *,
    property_id: str | None = None,
    terms_id: str = "v-1",
) -> dict:
    return {
        "id": terms_id,
        "tenant_id": "t-1",
        "owner_id": "o-1",
        "property_id": property_id,
        "gueltig_ab": ab,
        "gueltig_bis": bis,
        "provisions_pct": 20,
    }


def _ende_am_objekt(store: _Store, property_id: str = "p-1") -> str | None:
    zeile = next(
        r for r in store.tabellen["properties"] if r["id"] == property_id
    )
    return zeile.get("contract_end_date")


def _sperrtage(store: _Store) -> list[str]:
    return sorted(
        r["date"]
        for r in store.tabellen["availability"]
        if r["status"] == "blocked" and r["source"] == QUELLE
    )


# --------------------------------------------------------------------------
# Die Regel: wann endet die GELTUNG (nicht: wann endet eine Zeile)
# --------------------------------------------------------------------------


def test_satzwechsel_mit_unbefristetem_nachfolger_sperrt_nichts() -> None:
    """20 % bis 01.01.2027, dann 18 % unbefristet — der Vertrag läuft weiter.

    Der teuerste denkbare Fehler dieser Kopplung: eine Preisanpassung nimmt das
    Objekt ab Silvester bei Booking und Airbnb aus dem Verkauf, obwohl der
    Eigentümer nie gekündigt hat.
    """
    assert (
        ende_bestimmen(
            [
                _vertrag("2025-03-29", "2027-01-01"),
                _vertrag("2027-01-01", None, terms_id="v-2"),
            ]
        )
        is None
    )


def test_satzwechsel_mit_befristetem_nachfolger_endet_am_spaetesten_tag() -> None:
    """Zwei befristete Zeilen hintereinander: das Ende ist das des LETZTEN."""
    assert ende_bestimmen(
        [
            _vertrag("2025-03-29", "2027-01-01"),
            _vertrag("2027-01-01", "2027-06-01", terms_id="v-2"),
        ]
    ) == date(2027, 6, 1)


def test_ein_befristeter_vertrag_ist_das_vertragsende() -> None:
    assert ende_bestimmen([_vertrag("2025-03-29", ENDE.isoformat())]) == ENDE


def test_unbefristet_hat_kein_ende() -> None:
    assert ende_bestimmen([_vertrag("2025-02-18", None)]) is None


def test_ohne_zeile_gibt_es_kein_ende() -> None:
    assert ende_bestimmen([]) is None


def test_luecke_zwischen_zwei_vertraegen_ist_kein_anschluss() -> None:
    """Alter endet 01.10., neuer beginnt erst 01.12. — das Ende richtet sich
    nach der letzten Zeile, nicht nach der Lücke.

    Die Lücke selbst wird NICHT gesperrt: sie liegt mitten in einer Zeitreihe,
    in der beide Seiten einen Vertrag haben, und ein Kalender-Loch von zwei
    Monaten wäre eine schärfere Aussage als „der Vertrag endet".
    """
    assert ende_bestimmen(
        [
            _vertrag("2025-01-01", "2026-10-01"),
            _vertrag("2026-12-01", "2027-03-01", terms_id="v-2"),
        ]
    ) == date(2027, 3, 1)


def test_zeile_ohne_beginn_erfindet_kein_ende() -> None:
    """`gueltig_ab` ist NOT NULL — ein Datenfehler darf trotzdem kein
    Vertragsende erzeugen (Wurzel 4/5)."""
    assert ende_bestimmen([{"gueltig_ab": None, "gueltig_bis": "2026-10-10"}]) is None


# --------------------------------------------------------------------------
# Reichweite: Objekt schlägt Eigentümer
# --------------------------------------------------------------------------


def test_vertrag_ohne_objekt_faechert_auf_alle_objekte_auf() -> None:
    """Eine eigentümerweite Zeile betrifft ALLE Objekte des Eigentümers — sein
    Vertrag endet, nicht der eines einzelnen Hauses."""
    store = _store(
        properties=[
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
            {"id": "p-2", "tenant_id": "t-1", "title": "Hütte"},
        ],
        owner_properties=[
            {"owner_id": "o-1", "property_id": "p-1"},
            {"owner_id": "o-1", "property_id": "p-2"},
        ],
    )
    assert sorted(betroffene_objekte(store, "t-1", "o-1", None)) == ["p-1", "p-2"]


def test_vertrag_mit_objekt_betrifft_nur_dieses() -> None:
    store = _store(
        owner_properties=[
            {"owner_id": "o-1", "property_id": "p-1"},
            {"owner_id": "o-1", "property_id": "p-2"},
        ]
    )
    assert betroffene_objekte(store, "t-1", "o-1", "p-2") == ["p-2"]


def test_fremdes_objekt_wird_nicht_mitgenommen() -> None:
    """Wurzel 3: `owner_properties` allein ist nicht tenant-gescopet. Ohne den
    Filter über `properties.tenant_id` sperrte ein Vertrag das Objekt eines
    FREMDEN Betriebs."""
    store = _store(
        properties=[
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
            {"id": "p-fremd", "tenant_id": "t-ANDERS", "title": "Fremd"},
        ],
        owner_properties=[
            {"owner_id": "o-1", "property_id": "p-1"},
            {"owner_id": "o-1", "property_id": "p-fremd"},
        ],
    )
    assert betroffene_objekte(store, "t-1", "o-1", None) == ["p-1"]


def test_objektvertrag_schlaegt_eigentuemervertrag() -> None:
    """Für ein Objekt mit eigener Zeile entscheidet allein sie.

    Sonst könnte eine eigentümerweite Befristung ein Objekt sperren, für das
    ausdrücklich ein unbefristeter Einzelvertrag geschlossen wurde.
    """
    store = _store(
        terms=[
            _vertrag("2025-01-01", ENDE.isoformat()),
            _vertrag("2025-01-01", None, property_id="p-1", terms_id="v-2"),
        ]
    )
    nachziehen(store, "t-1", "o-1", ["p-1"])
    assert _ende_am_objekt(store) is None


# --------------------------------------------------------------------------
# Durchsetzen: Kalender und Portale
# --------------------------------------------------------------------------


def test_befristung_setzt_ende_und_sperrt_naechte() -> None:
    store = _store(terms=[_vertrag("2025-03-29", ENDE.isoformat())])
    protokoll = nachziehen(store, "t-1", "o-1", ["p-1"])

    assert _ende_am_objekt(store) == ENDE.isoformat()
    tage = _sperrtage(store)
    assert tage, "die Nächte ab dem Endtag müssen gesperrt sein"
    assert tage[0] == ENDE.isoformat()
    assert protokoll[0]["ende"] == ENDE.isoformat()
    assert protokoll[0]["gesperrte_naechte"] == len(tage)


def test_verlaengerung_gibt_naechte_wieder_frei() -> None:
    """Wurzel 1 — der Gegenzustand. Wird die Befristung nach hinten geschoben,
    müssen die dazwischen liegenden Nächte wieder verkäuflich werden."""
    store = _store(terms=[_vertrag("2025-03-29", ENDE.isoformat())])
    nachziehen(store, "t-1", "o-1", ["p-1"])
    vorher = _sperrtage(store)

    store.tabellen["owner_billing_terms"][0]["gueltig_bis"] = "2027-06-01"
    nachziehen(store, "t-1", "o-1", ["p-1"])

    nachher = _sperrtage(store)
    assert _ende_am_objekt(store) == "2027-06-01"
    assert nachher[0] == "2027-06-01"
    assert len(nachher) < len(vorher)


def test_unbefristet_hebt_die_sperre_ganz_auf() -> None:
    store = _store(terms=[_vertrag("2025-03-29", ENDE.isoformat())])
    nachziehen(store, "t-1", "o-1", ["p-1"])
    assert _sperrtage(store)

    store.tabellen["owner_billing_terms"][0]["gueltig_bis"] = None
    nachziehen(store, "t-1", "o-1", ["p-1"])

    assert _ende_am_objekt(store) is None
    assert _sperrtage(store) == []


def test_anschlussvertrag_hebt_das_ende_des_vorgaengers_auf() -> None:
    """Der Vorgänger ist befristet, dann kommt der Anschluss — das Objekt muss
    wieder verkäuflich werden."""
    store = _store(terms=[_vertrag("2025-03-29", "2027-01-01")])
    nachziehen(store, "t-1", "o-1", ["p-1"])
    assert _sperrtage(store)

    store.tabellen["owner_billing_terms"].append(
        _vertrag("2027-01-01", None, terms_id="v-2")
    )
    nachziehen(store, "t-1", "o-1", ["p-1"])

    assert _ende_am_objekt(store) is None
    assert _sperrtage(store) == []


def test_objekt_ohne_vertragszeile_behaelt_sein_ende() -> None:
    """Wurzel 4: vier Objekte tragen live ein Vermarktungsende OHNE
    Abrechnungsvertrag — aus dem Kündigungsantrag. Die Kopplung darf diese
    Entscheidung nicht stumm löschen, nur weil sie keinen Vertrag findet."""
    store = _store(
        terms=[],
        properties=[
            {
                "id": "p-1",
                "tenant_id": "t-1",
                "title": "Villa",
                "contract_end_date": "2027-01-01",
            }
        ],
    )
    protokoll = nachziehen(store, "t-1", "o-1", ["p-1"])

    assert _ende_am_objekt(store) == "2027-01-01"
    assert protokoll[0]["uebersprungen"] == "keine_vertragszeile"


def test_unveraenderter_wert_schreibt_nicht_neu() -> None:
    """Steht das Ende schon richtig, ist der Lauf ein No-op — sonst pusht jedes
    Speichern am Vertrag Hunderte Nächte an die Portale."""
    store = _store(
        terms=[_vertrag("2025-03-29", ENDE.isoformat())],
        properties=[
            {
                "id": "p-1",
                "tenant_id": "t-1",
                "title": "Villa",
                "contract_end_date": ENDE.isoformat(),
            }
        ],
    )
    protokoll = nachziehen(store, "t-1", "o-1", ["p-1"])

    assert protokoll[0]["unveraendert"] is True
    assert _sperrtage(store) == []


def test_fremdes_objekt_wird_nicht_geschrieben() -> None:
    """Der UPDATE ist tenant-gescopet (Wurzel 3). Ein Treffer-loser Lauf meldet
    das im Protokoll, statt „erledigt" zu behaupten."""
    store = _store(
        terms=[_vertrag("2025-03-29", ENDE.isoformat())],
        properties=[{"id": "p-1", "tenant_id": "t-ANDERS", "title": "Fremd"}],
    )
    protokoll = nachziehen(store, "t-1", "o-1", ["p-1"])

    assert protokoll[0]["fehler"] == "objekt_nicht_gefunden"
    assert _ende_am_objekt(store) is None
