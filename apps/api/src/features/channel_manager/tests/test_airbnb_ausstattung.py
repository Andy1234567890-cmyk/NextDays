"""Airbnb-Ausstattung → unsere ZWEI Kataloge.

Der Fehler, den diese Tests festhalten: der Import machte aus Airbnbs Schlüsseln
stumpf Kleinschreibung (`COFFEE_MAKER` → `coffee_maker`) und legte ALLES in
`properties.amenities`. Beides war falsch:

  1. `coffee_maker` existiert in keinem unserer Kataloge — unser Slug heißt
     `coffee_machine`. Ein solcher Slug ist in der Maske unsichtbar und geht an
     kein Portal.
  2. Die Maske führt ZWEI Spalten (`amenities` = Objekt, `room_amenities` =
     Zimmer) und prüft je Merkmal genau eine (`property-overview.tsx`,
     `gewaehlt()`). Die meisten Merkmale liegen im Zimmer-Katalog — lagen sie in
     `amenities`, blieb jede Checkbox leer, obwohl die Werte in der DB standen.

Die Beispieldaten sind live gemessen (05.08.2026, Konto AirSmil, alle 18
Anzeigen, `GET v2/listings/{id}` → `amenities`): 57 verschiedene Schlüssel, davon
sieben bei allen 18 Objekten (`COFFEE_MAKER`, `COOKING_BASICS`, `FREE_PARKING`,
`HEATING`, `REFRIGERATOR`, `TV`, `WIRELESS_INTERNET`).
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from src.features.channel_manager.airbnb_direkt import (
    _AIRBNB_ZU_OBJEKT,
    _AIRBNB_ZU_ZIMMER,
    _airbnb_amenities,
    airbnb_amenities_payload,
)

# Die Kataloge liegen im Frontend, weil dort die Maske gebaut wird. Sie hier zu
# kopieren hieße, den Vergleich gegen die Kopie zu führen — genau daran ist die
# alte Zuordnung vorbeigelaufen. Deshalb wird die echte Datei gelesen.
_META = Path(__file__).resolve().parents[6] / "web" / "lib" / "property-meta.ts"


def _liste(quelle: str, name: str, klammer: str) -> set[str]:
    anfang = quelle.index(f"export const {name}")
    ende = quelle.index(f"\n{klammer}", anfang)
    return set(re.findall(r'"([a-z0-9_]+)"', quelle[anfang:ende]))


@lru_cache(maxsize=1)
def _frontend_slugs() -> dict[str, frozenset[str]]:
    """Die echten Katalog-Mengen aus `web/lib/property-meta.ts`."""
    quelle = _META.read_text(encoding="utf-8")
    zimmer = _liste(quelle, "ROOM_AMENITY_CATALOG", "];")
    objekt = _liste(quelle, "AMENITY_CATALOG", "];")
    eigene = _liste(quelle, "EIGENE_AUSSTATTUNG", "];")
    airbnb = _liste(quelle, "AIRBNB_MERKMALE", "]);")
    eigene_objekt = _liste(quelle, "EIGENE_AUSSTATTUNG_OBJEKT", "]);")
    return {
        "zimmer": frozenset(zimmer),
        "objekt": frozenset(objekt),
        "eigene": frozenset(eigene),
        "eigene_objekt": frozenset(eigene_objekt),
        "airbnb": frozenset(airbnb),
        "alle": frozenset(zimmer | objekt | eigene),
    }

# Die Ausstattung von Objekt 020, unverändert aus der Antwort gekürzt.
AUSSTATTUNG_020 = {
    "COFFEE_MAKER": {"is_present": True, "instruction": ""},
    "COOKING_BASICS": {"is_present": True, "instruction": ""},
    "FREE_PARKING": {"is_present": True, "instruction": ""},
    "HAIR_DRYER": {
        "is_present": True,
        "instruction": "Im Bad.",
        "room_attachment_infos": [{"is_attached": True, "room_id": "661696088"}],
    },
    "HEATING": {"is_present": True, "instruction": ""},
    "MICROWAVE": {"is_present": True, "instruction": ""},
    "REFRIGERATOR": {"is_present": True, "instruction": ""},
    "STREET_PARKING": {"is_present": True, "instruction": ""},
    "TOASTER": {"is_present": True, "instruction": ""},
    "TV": {"is_present": True, "instruction": ""},
    "WIRELESS_INTERNET": {"is_present": True, "instruction": ""},
    "POOL": {"is_present": False, "instruction": ""},
}


def test_zwei_listen_wie_die_maske_sie_liest():
    """Live gemessen an Objekt 020: 2 Objekt-Merkmale, 9 Zimmer-Merkmale."""
    objekt, zimmer = _airbnb_amenities(AUSSTATTUNG_020)
    assert objekt == ["nd_parking_included", "street_parking"]
    assert zimmer == [
        "coffee_machine",
        "hair_dryer",
        "heating",
        "kitchenware",
        "microwave",
        "refrigerator",
        "toaster",
        "tv",
        "wireless_internet",
    ]


def test_kein_stumpfes_kleinschreiben():
    """`COFFEE_MAKER` → `coffee_machine`, NICHT `coffee_maker`.

    Der alte Weg (`name.lower()`) erzeugte einen Slug, den kein Katalog kennt —
    unsichtbar in der Maske, unbrauchbar für die Portale.
    """
    _objekt, zimmer = _airbnb_amenities({"COFFEE_MAKER": {"is_present": True}})
    assert zimmer == ["coffee_machine"]
    assert "coffee_maker" not in zimmer


def test_nicht_vorhandenes_gilt_nicht():
    """`is_present: false` heißt „ausdrücklich NICHT vorhanden"."""
    objekt, zimmer = _airbnb_amenities({"POOL": {"is_present": False}})
    assert objekt == []
    assert zimmer == []


def test_unbekannter_schluessel_wird_nicht_geraten():
    """Wurzel 4: kein ähnlich klingender Slug für etwas, das wir nicht kennen.

    `SKI_IN_SKI_OUT` und `LAUNDROMAT_NEARBY` stehen in Airbnbs Katalog, haben bei
    uns aber kein Gegenstück. Sie werden protokolliert, nicht erfunden.
    """
    objekt, zimmer = _airbnb_amenities(
        {
            "SKI_IN_SKI_OUT": {"is_present": True},
            "LAUNDROMAT_NEARBY": {"is_present": True},
        }
    )
    assert objekt == []
    assert zimmer == []


def test_kleinschreibung_der_quelle_wird_erkannt():
    """Airbnb schreibt groß; ein klein geschriebener Schlüssel muss trotzdem
    treffen — sonst hinge die Zuordnung an der Laune der Gegenseite."""
    _objekt, zimmer = _airbnb_amenities({"refrigerator": {"is_present": True}})
    assert zimmer == ["refrigerator"]


def test_kaputte_eingabe():
    assert _airbnb_amenities(None) == ([], [])
    assert _airbnb_amenities([]) == ([], [])
    assert _airbnb_amenities({"TV": "ja"}) == ([], [])


def test_keine_dubletten():
    """Zwei Airbnb-Schlüssel dürfen nicht denselben Slug doppelt erzeugen."""
    objekt, zimmer = _airbnb_amenities(
        {"HEATING": {"is_present": True}, "heating": {"is_present": True}}
    )
    assert zimmer == ["heating"]
    assert objekt == []


def test_kein_slug_in_beiden_tabellen():
    """Ein Merkmal gehört in GENAU EINEN Katalog.

    Stünde es in beiden, entschiede die Aufzählungsreihenfolge darüber, welche
    Spalte es bekommt — und die Checkbox prüft nur eine davon.
    """
    doppelt = set(_AIRBNB_ZU_ZIMMER) & set(_AIRBNB_ZU_OBJEKT)
    assert not doppelt, f"Schlüssel in beiden Tabellen: {sorted(doppelt)}"


def test_jeder_zielslug_existiert_im_frontend_katalog():
    """Wurzel 4: ein Slug, den kein Katalog kennt, ist unsichtbar.

    Genau das war der Ausgangsfehler (`coffee_maker`). Die Tabellen wurden auf
    Airbnbs vollständigen Katalog (139 Merkmale, 05.08.2026) erweitert — dabei
    ist ein erfundener Slug die wahrscheinlichste Panne. Geprüft wird gegen die
    ECHTEN Frontend-Listen, nicht gegen eine Kopie hier im Test.
    """
    katalog = _frontend_slugs()
    zimmer_ziele = set(_AIRBNB_ZU_ZIMMER.values())
    objekt_ziele = set(_AIRBNB_ZU_OBJEKT.values())

    fehlend = sorted((zimmer_ziele | objekt_ziele) - katalog["alle"])
    assert not fehlend, f"Slugs ohne Katalogeintrag: {fehlend}"

    # Die Spalte muss zum Katalog passen: ein Zimmer-Slug in `amenities` bleibt
    # in der Maske ungeprüft (`gewaehlt()` sieht nur EINE Spalte).
    falsche_spalte = sorted(
        s for s in zimmer_ziele - katalog["eigene"] if s not in katalog["zimmer"]
    )
    assert not falsche_spalte, f"im Objekt-Katalog statt Zimmer: {falsche_spalte}"
    falsche_spalte = sorted(
        s for s in objekt_ziele - katalog["eigene"] if s not in katalog["objekt"]
    )
    assert not falsche_spalte, f"im Zimmer-Katalog statt Objekt: {falsche_spalte}"


def test_airbnb_merkmale_deckt_jeden_zielslug():
    """Die Airbnb-Markierung in der Maske muss an JEDEM gemappten Slug hängen.

    Ohne sie sieht der Nutzer nicht, dass das Merkmal von Airbnb kommt bzw.
    dorthin zurückgeht — die Zeile wirkt wie ein reines Hauslistenmerkmal.
    """
    markiert = _frontend_slugs()["airbnb"]
    ziele = set(_AIRBNB_ZU_ZIMMER.values()) | set(_AIRBNB_ZU_OBJEKT.values())
    fehlend = sorted(ziele - markiert)
    assert not fehlend, f"ohne Airbnb-Markierung: {fehlend}"


def test_maske_und_import_meinen_dieselbe_spalte():
    """Import-Spalte und Checkbox-Spalte müssen übereinstimmen.

    `properties` führt zwei Spalten; `gewaehlt()` prüft genau EINE. Schrieb der
    Import nach `amenities`, während die Maske das Merkmal als Zimmer-Merkmal
    führte, blieb die Checkbox leer, obwohl der Wert in der DB stand — genau so
    aufgefallen an „Parkmöglichkeit inklusive" (`nd_parking_included`).
    """
    objekt_spalte = _frontend_slugs()["eigene_objekt"]

    falsch = sorted(
        s for s in _AIRBNB_ZU_OBJEKT.values()
        if s.startswith("nd_") and s not in objekt_spalte
    )
    assert not falsch, f"Import schreibt nach amenities, Maske liest room: {falsch}"

    falsch = sorted(
        s for s in _AIRBNB_ZU_ZIMMER.values()
        if s.startswith("nd_") and s in objekt_spalte
    )
    assert not falsch, f"Import schreibt nach room_amenities, Maske liest amenities: {falsch}"


def test_eigene_slugs_tragen_das_praefix():
    """`nd_*` heißt: kein Channex-Feld, geht NICHT an die Portale.

    Ein Slug ohne Präfix, der in keinem Channex-Katalog steht, würde stillschweigend
    beim Rückweg verschwinden (keine Facility-UUID) — als „übertragen" erscheinen
    und nirgends ankommen.
    """
    katalog = _frontend_slugs()
    ziele = set(_AIRBNB_ZU_ZIMMER.values()) | set(_AIRBNB_ZU_OBJEKT.values())
    for slug in sorted(ziele):
        ist_channex = slug in katalog["zimmer"] or slug in katalog["objekt"]
        assert ist_channex != slug.startswith("nd_"), (
            f"{slug}: nd_-Präfix und Channex-Katalog müssen sich ausschließen"
        )


# --- Rückweg: unsere Auswahl zurück an Airbnb -------------------------------
#
# Über Channex geht das NICHT: Channex trägt nur seinen eigenen Facility-Katalog,
# und ein großer Teil der Airbnb-Merkmale hat dort kein Feld. Ohne Facility-UUID
# lässt `_channex_facility_ids` sie still weg — die Auswahl sähe gespeichert aus
# und käme bei Airbnb nie an. Deshalb schreibt `airbnb_ausstattung_schreiben`
# direkt gegen `api.airbnb.com`.


def test_rueckweg_setzt_alle_varianten_eines_slugs():
    """Airbnb trennt feiner als wir — ALLE zugehörigen Schlüssel müssen mit.

    `nd_parking_included` steht bei Airbnb für `FREE_PARKING_ON_PREMISES`,
    `FREE_PARKING_OFF_PREMISES` und `FREE_PARKING`. Ginge nur einer raus, bliebe
    der Rest auf dem alten Stand.
    """
    nutzlast = airbnb_amenities_payload(["nd_parking_included"], [], None)
    assert nutzlast == {
        "FREE_PARKING": {"is_present": True},
        "FREE_PARKING_OFF_PREMISES": {"is_present": True},
        "FREE_PARKING_ON_PREMISES": {"is_present": True},
    }


def test_rueckweg_entfernt_abgewaehltes_ausdruecklich():
    """Wurzel 1: der Gegenzustand muss mitgepflegt werden.

    Airbnb kennt drei Zustände — gesetzt, ausdrücklich nicht vorhanden und gar
    nicht erwähnt. Wer nur die angehakten Merkmale sendet, entfernt ein
    abgewähltes NIE: es bliebe bei Airbnb stehen.
    """
    bestand = {
        "REFRIGERATOR": {"is_present": True},
        "TOASTER": {"is_present": True},
    }
    nutzlast = airbnb_amenities_payload([], ["refrigerator"], bestand)
    assert nutzlast["REFRIGERATOR"] == {"is_present": True}
    assert nutzlast["TOASTER"] == {"is_present": False}


def test_rueckweg_fasst_fremdes_nicht_an():
    """Was Airbnb führt und wir nicht kennen, bleibt unberührt.

    `SKI_IN_SKI_OUT` hat bei uns kein Gegenstück. Es auf `false` zu setzen wäre
    Datenverlust an fremder Stelle — wir wüssten gar nicht, was wir löschen.
    """
    bestand = {
        "SKI_IN_SKI_OUT": {"is_present": True},
        "TOASTER": {"is_present": True},
    }
    nutzlast = airbnb_amenities_payload([], [], bestand)
    assert "SKI_IN_SKI_OUT" not in nutzlast
    assert nutzlast == {"TOASTER": {"is_present": False}}


def test_rueckweg_ohne_bestand_entfernt_nichts():
    """Ist der Bestand unlesbar, wird NICHT auf Verdacht gelöscht.

    Ein fehlgeschlagener Lese-Aufruf liefert `None`. Daraus „bei Airbnb ist
    nichts gesetzt" zu schließen und alles auf `false` zu schreiben, wäre der
    erfundene Ersatzwert aus Wurzel 4 — mit Datenverlust als Folge.
    """
    nutzlast = airbnb_amenities_payload([], ["toaster"], None)
    assert nutzlast == {"TOASTER": {"is_present": True}}


def test_rueckweg_leere_auswahl_ohne_bestand_schreibt_nicht():
    """Nichts ausgewählt und nichts bekannt → kein Aufruf.

    Eine leere Nutzlast an Airbnb zu senden wäre ein Aufruf ohne Aussage; der
    Service bricht davor ab (`if not nutzlast`).
    """
    assert airbnb_amenities_payload([], [], None) == {}


def test_rueckweg_kennt_jeden_importierten_schluessel():
    """Import und Rückweg müssen dieselbe Tabelle benutzen.

    Ein Merkmal, das hereinkommt aber nicht zurückgeht, wäre eine Einbahnstraße:
    der Nutzer hakt es ab, es verschwindet bei uns und bleibt bei Airbnb stehen.
    """
    alle = {**_AIRBNB_ZU_ZIMMER, **_AIRBNB_ZU_OBJEKT}
    for schluessel, slug in alle.items():
        nutzlast = airbnb_amenities_payload([slug], [slug], None)
        assert schluessel in nutzlast, f"{slug} geht nicht zurück nach {schluessel}"
        assert nutzlast[schluessel] == {"is_present": True}
