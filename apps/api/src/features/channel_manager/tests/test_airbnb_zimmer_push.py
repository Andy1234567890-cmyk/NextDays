"""Zimmer-Rückweg zu Airbnb: der Diff, der den gemeldeten Fehler verhindert.

Die Beispieldaten sind live gemessen (05.08.2026, „Holiday house Cornflower",
Listing 1675950565421151420). Der Fehler, den diese Tests festnageln:

  * Der Betrieb löschte in unserer Maske den Balkon → unsere DB 7 Zimmer ohne
    Balkon, Airbnb weiter 9 Räume MIT `balcony` (ID 792924440).
  * Er fügte ihn über unsere Maske wieder hinzu → unsere DB `balkon` um
    14:44:47, Airbnb unverändert 8 Räume OHNE `balcony`.

Beides ohne Fehlermeldung, weil nie etwas an Airbnb gesendet wurde.
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_listing_import import AIRBNB_RAUM_AUF_SLUG
from src.features.channel_manager.airbnb_zimmer_push import (
    SLUG_AUF_AIRBNB_RAUM,
    _ist_stand,
    zimmer_diff,
)

# Airbnbs Räume von Cornflower, wie `GET v2/listing_rooms` sie geliefert hat.
AIRBNB_RAEUME = [
    {"id": "792022805", "room_type": "bedroom", "is_private": True},
    {"id": "792022806", "room_type": "bedroom", "is_private": True},
    {"id": "792022808", "room_type": "full_bathroom", "is_private": True},
    {"id": "792924434", "room_type": "exterior", "is_private": True},
    {"id": "792924436", "room_type": "patio", "is_private": True},
    {"id": "792924437", "room_type": "dining_room", "is_private": True},
    {"id": "792924438", "room_type": "kitchen", "is_private": True},
    {"id": "792924439", "room_type": "living_room", "is_private": True},
    {"id": "792924440", "room_type": "balcony", "is_private": True},
]

# Unsere sieben Zimmer nach dem Löschen des Balkons.
UNSER_STAND_OHNE_BALKON = {
    "schlafzimmer": 2, "badezimmer": 1, "esszimmer": 1,
    "kueche": 1, "wohnzimmer": 1, "terrasse": 1,
}


def test_geloeschter_balkon_wird_bei_airbnb_geloescht() -> None:
    """DER gemeldete Fehler: die Löschung muss bei Airbnb ankommen.

    Ein Diff, der nur über unseren Soll-Stand läuft, sieht den Balkon gar nicht
    — er steht in keiner unserer Zeilen. Deshalb geht der Diff über die
    VEREINIGUNG beider Seiten.
    """
    anlegen, loeschen = zimmer_diff(
        UNSER_STAND_OHNE_BALKON, _ist_stand(AIRBNB_RAEUME)
    )
    assert loeschen == ["792924440"]
    assert anlegen == []


def test_hinzugefuegter_balkon_wird_bei_airbnb_angelegt() -> None:
    """Die zweite Richtung: der Betrieb hakt den Balkon an, Airbnb hat keinen."""
    ohne_balkon = [r for r in AIRBNB_RAEUME if r["room_type"] != "balcony"]
    soll = {**UNSER_STAND_OHNE_BALKON, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(ohne_balkon))
    assert anlegen == ["balkon"]
    assert loeschen == []


def test_gleichstand_sendet_nichts() -> None:
    """Kein Unterschied → kein Fremdaufruf (Wurzel 2)."""
    soll = {**UNSER_STAND_OHNE_BALKON, "balkon": 1}
    assert zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME)) == ([], [])


def test_fremde_raumarten_werden_nicht_geloescht() -> None:
    """`exterior` hat keinen Slug in unserer Liste und darf nicht verschwinden.

    Der Import überspringt ihn bewusst — der Gastgeber sieht ihn bei uns nie.
    Ihn zu löschen hieße, ihm ungefragt einen Raum aus der Anzeige zu nehmen.
    """
    ist = _ist_stand(AIRBNB_RAEUME)
    assert "792924434" not in [x for ids in ist.values() for x in ids]
    _anlegen, loeschen = zimmer_diff(
        {**UNSER_STAND_OHNE_BALKON, "balkon": 1}, ist
    )
    assert "792924434" not in loeschen


def test_mehrfaches_zimmer_zaehlt_stueckweise() -> None:
    """Aus zwei Schlafzimmern eines machen: genau EINES wird gelöscht."""
    soll = {**UNSER_STAND_OHNE_BALKON, "schlafzimmer": 1, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME))
    assert anlegen == []
    assert len(loeschen) == 1
    assert loeschen[0] in {"792022805", "792022806"}


def test_drittes_schlafzimmer_wird_angelegt() -> None:
    """Und die Gegenrichtung: eines mehr bei uns → eines anlegen."""
    soll = {**UNSER_STAND_OHNE_BALKON, "schlafzimmer": 3, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME))
    assert anlegen == ["schlafzimmer"]
    assert loeschen == []


def test_slug_ohne_airbnb_entsprechung_wird_nicht_geraten() -> None:
    """Ein Slug, den Airbnbs Vokabular nicht kennt, wird NICHT angelegt.

    Wurzel 4: lieber nichts senden als einen plausibel klingenden Raumtyp
    erfinden, den Airbnb dann ablehnt oder falsch einordnet.
    """
    anlegen, loeschen = zimmer_diff({"erfundenes_zimmer": 1}, {})
    assert anlegen == []
    assert loeschen == []


def test_jeder_airbnb_raumtyp_ist_ein_echter_wert() -> None:
    """Die Rückrichtung darf nur Werte senden, die der Import auch kennt.

    Beide Tabellen stammen aus Airbnbs Vokabular; ein Tippfehler hier würde
    live erst beim Schreibversuch auffallen.
    """
    for slug, airbnb_art in SLUG_AUF_AIRBNB_RAUM.items():
        assert AIRBNB_RAUM_AUF_SLUG.get(airbnb_art) == slug, (
            f"{slug} → {airbnb_art} ist keine saubere Umkehrung"
        )


# Airbnbs API-`room_type`-Werte, live gemessen über alle 18 Anzeigen des Kontos
# (`GET v2/listing_rooms`, 05.08.2026, 157 Räume). NICHT die UI-Labels aus
# „Choose a room or space" — die weichen für dieselben Räume ab (Dining area →
# dining_room, Full kitchen → kitchen, Laundry area → laundry_room).
API_RAUMARTEN_GEMESSEN = {
    "bedroom", "full_bathroom", "living_room", "exterior", "dining_room",
    "kitchen", "laundry_room", "patio", "deck", "garden", "sunroom",
    "game_room", "workspace",
}


def test_sendewerte_sind_gemessene_api_werte() -> None:
    """Jeder Sende-Wert muss aus der API-Messung stammen — oder aus Airbnbs
    Auswahlliste, wenn die Art im Konto (noch) nicht vorkommt.

    Der Test hält die Verwechslung fest, die hier fast passiert wäre: Airbnbs
    Extranet-Dropdown zeigt „Dining area"/„Full kitchen"/„Laundry area", die API
    liefert für DIESELBEN Raum-IDs `dining_room`/`kitchen`/`laundry_room`. Wer die
    Tabelle nach der UI-Liste umschreibt, sendet Werte, die der Import nicht
    zurücklesen kann — der nächste Abgleich hielte den Raum für unbekannt und
    legte ihn erneut an (Endlos-Duplikate).
    """
    # Im Konto nicht vorhanden, aber in Airbnbs Auswahlliste belegt.
    aus_auswahlliste = {"balcony", "half_bathroom"}
    erlaubt = API_RAUMARTEN_GEMESSEN | aus_auswahlliste
    for slug, art in SLUG_AUF_AIRBNB_RAUM.items():
        assert art in erlaubt, f"{slug} → {art} ist weder gemessen noch belegt"


def test_kein_unbelegter_sendewert() -> None:
    """`sleeping_area` darf NICHT zurück: 0× in der API-Messung und nicht in
    Airbnbs Auswahlliste (40 Einträge). Ein Sende-Wert ohne Beleg ist geraten
    (Wurzel 4) — im Import ist so ein Eintrag harmlos, beim Schreiben nicht.
    """
    assert "sleeping_area" not in SLUG_AUF_AIRBNB_RAUM.values()
    assert "schlafbereich" not in SLUG_AUF_AIRBNB_RAUM
