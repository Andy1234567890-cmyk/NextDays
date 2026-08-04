"""Die Firmenadresse darf nicht zur Hausadresse werden.

DER ECHTE SCHADEN, live am Beta-Betrieb gefunden (04.08.2026): zwei von 18
Objekten trugen „Hirtshalsvej 21, 9881 Bindslev" als Adresse — die
Geschäftsadresse des Betriebs aus den AGB. Das eine Haus steht tatsächlich in
9800 Hjørring. Niemand hatte das eingetippt; ein Kreislauf hatte es erzeugt:

  1. Objekt ohne eigene Adresse → `_billing_property_attrs` schickt die
     FIRMENADRESSE an Channex (nötig: Booking & Co. verlangen eine
     Property-Adresse zur Aktivierung)
  2. Channex speichert sie an der Property
  3. Reconcile liest sie zurück → wurde als HAUSADRESSE in die DB geschrieben

Ab dann ging die Geschäftsadresse als Adresse des Ferienhauses an alle Portale.
Wurzel 4 in Reinform: ein Rückfallwert, der zur Tatsache wird.
"""
from __future__ import annotations

from src.features.channel_manager.property_mapping import PropertyMappingMixin

FIRMA = {"address": "Hirtshalsvej 21", "zip_code": "9881", "city": "Bindslev"}


def _row(attrs: dict, firma: dict | None = FIRMA) -> dict:
    ergebnis = PropertyMappingMixin._channex_attrs_to_property_row(  # noqa: SLF001
        attrs, firma
    )
    assert ergebnis is not None
    return ergebnis


def test_firmenadresse_wird_nicht_zur_hausadresse() -> None:
    """Der Kern: kommt die Firmenadresse von Channex zurück, wird sie verworfen."""
    row = _row({
        "title": "020 Lille Lægehus",
        "address": "Hirtshalsvej 21",
        "zip_code": "9881",
        "city": "Hjørring",
        "latitude": 57.4756,
        "longitude": 9.9899,
    })
    assert "address" not in row
    assert "postal_code" not in row
    # Die Koordinaten gehören zur Adresse — sonst zeigte die Karte auf das Büro.
    assert "lat" not in row
    assert "lng" not in row
    # Der ORT kommt echt von Airbnb (`city` ist eines der sieben gelieferten
    # Felder) und bleibt.
    assert row["city"] == "Hjørring"


def test_echte_hausadresse_bleibt() -> None:
    """Die Gegenprobe — sonst hätte der Fix echte Daten gelöscht."""
    row = _row({
        "title": "Ferienhaus Skagen",
        "address": "Skagen Landevej 772",
        "zip_code": "9800",
        "city": "Hjørring",
        "latitude": 57.4,
        "longitude": 10.4,
    })
    assert row["address"] == "Skagen Landevej 772"
    assert row["postal_code"] == "9800"
    assert row["lat"] == 57.4


def test_gleiche_plz_allein_ist_kein_grund() -> None:
    """Ein regionaler Vermieter hat seine Häuser im eigenen Ort. Gleiche PLZ
    bei ANDERER Straße ist eine echte Adresse, keine Firmenadresse."""
    row = _row({
        "title": "Haus am Weg",
        "address": "Doravej 4",
        "zip_code": "9881",
        "city": "Bindslev",
    })
    assert row["address"] == "Doravej 4"
    assert row["postal_code"] == "9881"


def test_gleiche_strasse_andere_plz_ist_kein_grund() -> None:
    """Straßennamen wiederholen sich zwischen Orten."""
    row = _row({
        "title": "Haus zwei",
        "address": "Hirtshalsvej 21",
        "zip_code": "9800",
        "city": "Hjørring",
    })
    assert row["address"] == "Hirtshalsvej 21"


def test_schreibweise_egal() -> None:
    """Channex normiert Adressen nicht — Groß/Klein und Leerraum dürfen den
    Vergleich nicht aushebeln, sonst greift der Schutz zufällig nicht."""
    row = _row({
        "title": "X",
        "address": "  hirtshalsvej   21 ",
        "zip_code": " 9881 ",
        "city": "Bindslev",
    })
    assert "address" not in row


def test_ohne_firmenprofil_wird_uebernommen() -> None:
    """Bewusst NICHT fail-closed: ohne Firmenadresse ist nichts zu vergleichen,
    und eine Adresse zu verwerfen, die wir nicht als Firmenadresse belegen
    können, würde echte Daten löschen."""
    row = _row({"title": "Y", "address": "Egal 1", "zip_code": "1234"}, None)
    assert row["address"] == "Egal 1"


def test_unvollstaendiges_firmenprofil_wird_uebernommen() -> None:
    """Nur PLZ ohne Straße reicht als Vergleichsgrundlage nicht."""
    row = _row(
        {"title": "Z", "address": "Egal 2", "zip_code": "9881"},
        {"zip_code": "9881"},
    )
    assert row["address"] == "Egal 2"
