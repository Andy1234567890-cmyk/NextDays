"""Fläche und Kapazität müssen auch ZURÜCK an Airbnb.

DER GEMELDETE FEHLER (06.08.2026): Die Maske „Details zur Unterkunft" war eine
Einbahnstraße. Wir HOLTEN `property_details.listing_size` von Airbnb
(`airbnb_listing_import.gebaeudedaten_uebernehmen`), aber eine Korrektur bei uns
kam dort nie an — und das Feld trug obendrein die Kennzeichnung „Nur
myBestDays", obwohl Airbnb die Quelle ist.

Der Rückweg läuft NICHT über den Aggregator: dessen ausgehender Payload trägt
nur Verfügbarkeit, Preis und Restriktionen. Er geht direkt an
`PUT v2/listings/{id}` — mit FLACHEM Payload.

Das Flache ist der Kern. Live gemessen am Konto AirSmil, Objekt „Feriehus
Kornblomst" (`1675950565421151420`), Fläche 69 → 70 → zurück:

    {"listing": {"property_details": {...}}}  -> 200, size bleibt 69
    {"property_details": {...}}               -> 200, size wird 70

Ein 200 beweist hier also NICHTS: Airbnb quittiert die umhüllte Form und
verwirft sie stillschweigend. Kontrolltest daneben — ein erfundenes Feld allein
ändert nichts —, damit der Unterschied wirklich vom Payload kommt und nicht von
einem Seiteneffekt. `person_capacity` verhält sich gleich (4 → 5 → zurück).

Ausgangsstand desselben Listings:

    property_details: {"listing_size": {"size": 69, "size_unit":
                       "SQUARE_METERS"}, "year_built": 1986, ...}
    person_capacity: 4
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.airbnb_direkt import AirbnbDirektMixin


class _Dienst(AirbnbDirektMixin):
    """Fängt Schreib- UND Leseaufruf ab, statt Airbnb zu rufen.

    Das Lesen muss mit: seit der Rücklesung ruft der Schreibweg `_airbnb_get`,
    und ohne Attrappe ginge jeder Test echt ins Netz.
    """

    def __init__(self, stand: dict[str, Any] | None = None) -> None:
        self.gesendet: list[tuple[str, dict[str, Any]]] = []
        # Was Airbnb beim Zurücklesen meldet. Vorgabe: der Schreibwert kommt an.
        self._stand = stand
        self.gelesen = 0

    def _airbnb_put(  # type: ignore[override]  # noqa: D102
        self, token: str, pfad: str, nutzlast: dict[str, Any]
    ) -> dict[str, Any]:
        self.gesendet.append((pfad, nutzlast))
        return {}

    def _airbnb_get(  # type: ignore[override]  # noqa: D102
        self, token: str, pfad: str, params: dict | None = None
    ) -> dict | None:
        self.gelesen += 1
        if self._stand is not None:
            return self._stand
        # Ohne eigenen Stand: den zuletzt gesendeten Wert zurückspiegeln.
        letzte = self.gesendet[-1][1] if self.gesendet else {}
        groesse = (letzte.get("property_details") or {}).get("listing_size")
        return {"listing": {"property_details": {"listing_size": groesse or {}},
                            "person_capacity": letzte.get("person_capacity")}}


def test_flaeche_und_kapazitaet_gehen_raus() -> None:
    """Der gemessene Live-Stand, unverändert zurückgeschrieben.

    Die Nutzlast ist FLACH. Das ist keine Stilfrage: mit der Hülle
    `{"listing": {...}}` antwortet Airbnb 200 und ändert NICHTS (live gemessen,
    siehe Modul-Docstring). Dieser Test hält genau die Form fest, die wirkt.
    """
    dienst = _Dienst()
    gesendet = dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, "sqm", 4)
    pfad, nutzlast = dienst.gesendet[0]
    assert pfad == "v2/listings/l-1"
    assert nutzlast == {
        "property_details": {
            "listing_size": {"size": 69, "size_unit": "SQUARE_METERS"}
        },
        "person_capacity": 4,
    }
    assert "listing" not in nutzlast
    assert sorted(gesendet) == [
        "angekommen", "person_capacity", "property_details",
    ]


def test_ganze_zahl_statt_float() -> None:
    """Airbnb führt die Größe als Ganzzahl — „69.0" wäre ein anderer Wert."""
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, "sqm", None)
    groesse = dienst.gesendet[0][1]["property_details"]["listing_size"]
    assert groesse["size"] == 69
    assert isinstance(groesse["size"], int)


def test_quadratfuss_wird_nicht_zu_quadratmetern() -> None:
    """Der Unterschied ist Faktor 10 — eine Verwechslung ist kein Rundungsfehler."""
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben("tok", "l-1", 740.0, "sqft", None)
    groesse = dienst.gesendet[0][1]["property_details"]["listing_size"]
    assert groesse == {"size": 740, "size_unit": "SQUARE_FEET"}


def test_ohne_einheit_keine_flaeche() -> None:
    """„69" ohne Einheit ist keine Angabe, sondern eine Zahl (Wurzel 4).

    Lieber gar nichts senden als Airbnb eine geratene Einheit unterschieben.
    """
    dienst = _Dienst()
    gesendet = dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, None, None)
    assert gesendet == {}
    assert dienst.gesendet == []


def test_unbekannte_einheit_faellt_nicht_auf_quadratmeter() -> None:
    """Ein fremder Einheitenwert darf nicht stillschweigend m² werden."""
    dienst = _Dienst()
    assert dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, "tsubo", None) == {}
    assert dienst.gesendet == []


@pytest.mark.parametrize("flaeche", [None, 0, 0.0])
def test_fehlende_flaeche_ist_nicht_null(flaeche: float | None) -> None:
    """Keine Fläche heißt „unbekannt" — eine 0 bei Airbnb wäre eine Aussage."""
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben("tok", "l-1", flaeche, "sqm", 4)
    assert "property_details" not in dienst.gesendet[0][1]


def test_gar_nichts_zu_senden_ruft_airbnb_nicht() -> None:
    """Ein leerer PUT wäre ein Fremdaufruf ohne Inhalt (Wurzel 2)."""
    dienst = _Dienst()
    assert dienst.airbnb_stammdaten_schreiben("tok", "l-1", None, None, None) == {}
    assert dienst.gesendet == []


def test_kapazitaet_allein_geht_auch() -> None:
    """Die Felder sind unabhängig — eines fehlt, das andere geht trotzdem."""
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben("tok", "l-1", None, None, 4)
    assert dienst.gesendet[0][1] == {"person_capacity": 4}


def test_wird_zurueckgelesen() -> None:
    """Nach dem Schreiben MUSS der Ist-Stand geholt werden.

    Airbnb quittiert auch eine verworfene Nutzlast mit 200 — ohne Gegenprobe
    meldet der Job „geschrieben", während dort der alte Wert steht.
    """
    dienst = _Dienst()
    dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, "sqm", 4)
    # Einmal vorher (für das Vorher/Nachher im Log), einmal nachher.
    assert dienst.gelesen == 2


def test_verworfener_wert_wird_erkannt() -> None:
    """GENAU der Fall, der fast durchgerutscht wäre.

    Airbnb nimmt die Nutzlast nicht an und meldet trotzdem 200 — der Rückweg
    sähe erfolgreich aus. Hier bleibt der Ist-Stand auf 69, obwohl 80 gesendet
    wurde; das muss der Aufrufer erkennen können (Wurzel 5).

    Geprüft wird die RÜCKGABE, nicht die Log-Ausgabe: ob structlog gerade auf
    stdout schreibt, hängt davon ab, welcher Test vorher lief — ein Test, der
    von der Reihenfolge abhängt, taugt nichts.
    """
    dienst = _Dienst(stand={
        "listing": {
            "property_details": {
                "listing_size": {"size": 69, "size_unit": "SQUARE_METERS"}
            },
            "person_capacity": 4,
        }
    })
    erg = dienst.airbnb_stammdaten_schreiben("tok", "l-1", 80.0, "sqm", 4)
    assert erg["angekommen"] is False


def test_uebernommener_wert_gilt_als_angekommen() -> None:
    """Der Normalfall: Airbnb übernimmt, die Rückgabe sagt es."""
    dienst = _Dienst()
    erg = dienst.airbnb_stammdaten_schreiben("tok", "l-1", 69.0, "sqm", 4)
    assert erg["angekommen"] is True
