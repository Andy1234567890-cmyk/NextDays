"""Bestandsimport: keine Meldungen, keine Aufgaben fuer Abgereiste, Fortschritt.

WARUM ES DIESE TESTS GIBT: Fuer den CSV-Import gab es KEINEN Test — deshalb ist
nie aufgefallen, dass er bei realer Menge nie durchlief. Live gemessen am
31.08.2026 an einem Booking.com-Export mit 252 Zeilen: 3,6 s je Zeile (~15 min
in einer HTTP-Anfrage), und jede nachgetragene Zeile verschickte Mails ueber
Aufenthalte aus 2024 samt Reinigungsaufgaben fuer abgereiste Gaeste.

Geprueft wird die WIRKUNG (was der Import ausloest), nicht die Verdrahtung.
"""
from __future__ import annotations

import inspect
from pathlib import Path

import pytest

_SLICE = Path(__file__).resolve().parent.parent


def _quelle(modul: str) -> str:
    return (_SLICE / modul).read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "modul", ["csv_import.py", "lodgify_import.py"]
)
def test_bestandsimport_setzt_das_kennzeichen(modul: str) -> None:
    """Beide Datei-/Uebernahme-Wege markieren ihre Zeilen als Bestand.

    Ohne das Kennzeichen laeuft der volle Nachlauf einer FRISCHEN Buchung:
    Mail + Glocke an Eigentuemer und Betrieb, dazu Aufgaben.
    """
    quelle = _quelle(modul)
    assert "bestandsimport=True" in quelle, (
        f"{modul} projiziert ohne `bestandsimport=True` — jede nachgetragene "
        "Buchung loest Mails und Aufgaben aus (live am 31.08.2026 passiert)."
    )


def test_projektion_kennt_den_schalter() -> None:
    """Die Projektion nimmt `bestandsimport` als benanntes Argument."""
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    sig = inspect.signature(
        BookingsSyncMixin._project_booking_to_reservation  # noqa: SLF001
    )
    p = sig.parameters.get("bestandsimport")
    assert p is not None, "Parameter `bestandsimport` fehlt"
    assert p.default is False, (
        "Vorgabe MUSS False sein — sonst verstummen auch die Live-Buchungen "
        "vom Portal, und niemand erfaehrt mehr von einer neuen Reservierung."
    )


def test_meldung_haengt_am_schalter() -> None:
    """`melde_buchungs_ereignis` (created) steht hinter `if not bestandsimport`."""
    quelle = _quelle("bookings_sync.py")
    assert "if not bestandsimport:\n                    melde_buchungs_ereignis(" in quelle, (
        "Die created-Meldung ist nicht mehr an den Schalter gebunden — ein "
        "Import von 252 Zeilen verschickt dann wieder hunderte Mails."
    )


def test_aufgaben_nur_fuer_kuenftige_aufenthalte() -> None:
    """Fuer einen abgereisten Gast entsteht keine Reinigungsaufgabe.

    Die Grenze ist die ABREISE, nicht die Anreise: ein laufender Aufenthalt
    braucht seine Endreinigung noch.
    """
    quelle = _quelle("bookings_sync.py")
    assert "nachtrag_vergangen" in quelle
    assert "departure" in quelle.split("nachtrag_vergangen")[1][:400], (
        "Die Grenze muss an der Abreise haengen, nicht an der Anreise."
    )
    assert "if reservation_id and not nachtrag_vergangen:" in quelle


def test_datumsvergleich_ohne_typfehler() -> None:
    """`departure` ist ein ISO-String; ein Vergleich mit `date` wuerfe TypeError.

    Der Fehler waere besonders heimtueckisch: er traefe NUR den Bestandsimport
    und nur dort, wo `bestandsimport=True` gesetzt ist — also genau im neuen
    Pfad, den kein Live-Verkehr abdeckt.
    """
    quelle = _quelle("bookings_sync.py")
    block = quelle.split("nachtrag_vergangen = ")[1][:300]
    assert "date.today().isoformat()" in block, (
        "Vergleich muss textuell gegen einen ISO-String laufen."
    )


def test_zeilen_zaehlen_trifft_den_parser() -> None:
    """Die Gesamtzahl fuer den Balken nutzt dieselbe Trennzeichen-Erkennung.

    Zwei Auslegungen derselben Datei hiessen: der Balken zaehlt anderes als der
    Import schreibt.
    """
    from src.features.channel_manager.bestandsimport_dienst import (
        BestandsimportDienstMixin as M,
    )

    kopf = "property,guest_first_name,guest_last_name,arrival,departure"
    zeile = "Haus,Max,Muster,2026-01-02,2026-01-09"
    assert M._bestandsimport_zeilen_zaehlen(f"{kopf}\n{zeile}\n{zeile}") == 2  # noqa: SLF001
    # EU-Excel: Semikolon
    kopf_semi = kopf.replace(",", ";")
    zeile_semi = zeile.replace(",", ";")
    assert M._bestandsimport_zeilen_zaehlen(  # noqa: SLF001
        f"{kopf_semi}\n{zeile_semi}"
    ) == 1
    # BOM (Excel schreibt ihn an den Anfang)
    assert M._bestandsimport_zeilen_zaehlen(f"﻿{kopf}\n{zeile}") == 1  # noqa: SLF001
    # Leer bleibt leer — kein erfundener Wert
    assert M._bestandsimport_zeilen_zaehlen("") == 0  # noqa: SLF001


def test_zeilenbezeichnung_ohne_kontaktdaten() -> None:
    """Unter dem Balken stehen Objekt und Gast — keine Mailadresse."""
    from src.features.channel_manager.csv_import import CsvImportMixin as M

    raw = {
        "property": "Feriehus Perlen",
        "guest_first_name": "Max",
        "guest_last_name": "Muster",
        "guest_email": "max@example.com",
    }
    text = M._zeilen_bezeichnung(raw)  # noqa: SLF001
    assert text == "Feriehus Perlen · Max Muster"
    assert "@" not in text, "Kontaktdaten gehoeren nicht in die Laufanzeige."
    # Leere Zeile erfindet keinen Platzhalter (Wurzel 4)
    assert M._zeilen_bezeichnung({}) == ""  # noqa: SLF001


def test_lauf_tabelle_ist_gegen_direktzugriff_gesperrt() -> None:
    """Wurzel 6: der Client darf die Lauf-Zeile lesen, nie schreiben.

    Ohne `revoke` koennte ein eingeloggter Nutzer per anon-Key-curl einen Lauf
    als „fertig" markieren, den es nie gab.
    """
    sql = (
        _SLICE.parents[4] / "supabase" / "migrations"
        / "0507_bestandsimport_lauf.sql"
    ).read_text(encoding="utf-8")
    assert "enable row level security" in sql
    assert "revoke insert, update, delete on public.bestandsimport_lauf" in sql
    assert "grant select on public.bestandsimport_lauf to authenticated" in sql
    # Realtime: ohne Publikation waere das Abo eine stumme Attrappe.
    assert "add table public.bestandsimport_lauf" in sql
    # Nur EIN offener Lauf je Betrieb (Wurzel 2).
    assert "bestandsimport_lauf_offen_uq" in sql


# --- Objekt-Auflösung: Schreibweise ja, Wortlaut nein ----------------------
#
# Live am 31.08.2026 fielen 111 von 252 Zeilen eines Booking.com-Exports durch,
# weil der Abgleich exakte Titelgleichheit verlangte. Die Faelle stammen alle
# aus diesem einen Export.


def test_zierzeichen_werden_zusammengefuehrt() -> None:
    """Derselbe Name ohne Anfuehrungszeichen/Sternchen trifft sein Objekt."""
    from src.features.channel_manager.csv_import import _normalisiert

    assert _normalisiert('Feriehus "Perlen" Tversted') == _normalisiert(
        "Feriehus Perlen Tversted"
    )
    assert _normalisiert("FeWo *Stjerneskud*") == _normalisiert("FeWo Stjerneskud")
    # Bindestrich vs. Leerzeichen setzen die Portale uneinheitlich.
    assert _normalisiert("Lærke-huset") == _normalisiert("Lærke huset")


def test_verschiedene_namen_bleiben_verschieden() -> None:
    """Ein anderer WORTLAUT darf nie zusammenfallen.

    Das ist die wichtigere Haelfte: eine Buchung dem falschen Objekt
    zuzuordnen sperrt dort echte Naechte und verschiebt Umsatz auf den
    falschen Eigentuemer — ein Fehler, den niemand sieht (Wurzel 4).
    """
    from src.features.channel_manager.csv_import import _normalisiert

    assert _normalisiert("Odden-hus-mygdal") != _normalisiert("Odden-hygge-mygdal")
    assert _normalisiert("Holiday home Dora") != _normalisiert("Feriehus Dora")
    assert _normalisiert("Lærke-huset") != _normalisiert("Lærke-huset-Bindslev")
    # Umlaute NICHT auf ae/oe abbilden — sonst faellt „Lægehus" mit einem
    # hypothetischen „Laegehus" zusammen, und das ist eine Namensaenderung.
    assert _normalisiert("Lægehus") != _normalisiert("Laegehus")


def test_normalisierung_liefert_leeren_schluessel_nie_als_treffer() -> None:
    """Ein Titel aus reiner Zeichensetzung darf kein Sammelbecken werden."""
    from src.features.channel_manager.csv_import import _normalisiert

    assert _normalisiert("***") == ""
    assert _normalisiert("   ") == ""


# --- Adresse als zweiter Weg zum Objekt ------------------------------------
#
# Der Booking.com-Reservierungs-Export traegt KEINE Unterkunfts-ID (gemessen an
# der echten Datei vom 31.08.2026: zwoelf Spalten, darunter „Lage", aber keine
# Objektkennung). Der Name allein reicht nicht — er weicht bei vier von 18
# Objekten ab. Die Adresse traegt weiter.


def test_adresse_gleicht_portal_und_eigene_felder_ab() -> None:
    """Portal-Adresse („Lærkevej 2, Bindslev, Denmark") trifft unsere Felder."""
    from src.features.channel_manager.csv_import import _adress_schluessel

    for portal, strasse, nummer, ort in [
        ("Lærkevej 2, Bindslev, Denmark", "Lærkevej", "2", "Bindslev"),
        ("Oddenvej 3, Mygdal, Denmark", "Oddenvej", "3", "Mygdal"),
        ("Doravej 5, Bindslev, Denmark", "Doravej", "5", "Bindslev"),
    ]:
        assert _adress_schluessel(portal) == _adress_schluessel(
            f"{strasse} {nummer} {ort}"
        ), portal


def test_adresse_trennt_verschiedene_orte() -> None:
    """Dieselbe Strasse in zwei Doerfern ist NICHT dasselbe Objekt.

    Live relevant: „Hirtshalsvej 195, Ålbæk" (im Export, bei uns nicht
    vorhanden) darf niemals auf „Hirtshalsvej 21, Bindslev" verfallen.
    """
    from src.features.channel_manager.csv_import import (
        _adress_schluessel,
        _ohne_hausnummer,
    )

    fremd = "Hirtshalsvej 195, Ålbæk, Denmark"
    eigen = "Hirtshalsvej 21 Bindslev"
    assert _adress_schluessel(fremd) != _adress_schluessel(eigen)
    # Auch ohne Hausnummer muss der Ort die Trennung halten.
    assert _ohne_hausnummer(fremd) != _adress_schluessel("Hirtshalsvej Bindslev")


def test_hausnummer_zusatz_des_portals_faellt_weg() -> None:
    """„Højenevej 2A links" trifft die Strassen-Stufe, nicht die Nummern-Stufe."""
    from src.features.channel_manager.csv_import import (
        _adress_schluessel,
        _ohne_hausnummer,
    )

    portal = "Højenevej 2A links, Vidstrup, Denmark"
    # Mit Hausnummer trifft es NICHT (das Portal schreibt sie anders) …
    assert _adress_schluessel(portal) != _adress_schluessel("Højenevej 2A Vidstrup")
    # … ohne Hausnummer schon.
    assert _ohne_hausnummer(portal) == _adress_schluessel("Højenevej Vidstrup")


def test_land_wird_entfernt_aber_nur_am_ende() -> None:
    """Das Land steht nur beim Portal — ein Ortsname bleibt aber erhalten."""
    from src.features.channel_manager.csv_import import _adress_schluessel

    assert _adress_schluessel("Doravej 5, Bindslev, Denmark") == "doravej 5 bindslev"
    # „Denmark" mitten im Namen ist kein Land am Ende und bleibt.
    assert "denmark" in _adress_schluessel("Denmarkvej 3, Skagen")


def test_adressspalte_steht_in_der_vorlage() -> None:
    """Ohne die Spalte in CSV_COLUMNS kaeme die Adresse nie beim Import an."""
    from src.features.channel_manager.csv_import import CSV_COLUMNS

    assert "property_address" in CSV_COLUMNS


def test_export_parser_schreibt_die_adresse() -> None:
    """Der Browser-Parser muss „Lage" lesen und als Spalte weitergeben."""
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[6] / "web" / "lib" / "portal-export.ts"
    ).read_text(encoding="utf-8")
    assert '"property_address"' in quelle, "Zielspalte fehlt"
    assert '"lage"' in quelle, "Booking schreibt die Spalte „Lage“"
