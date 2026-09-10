"""Bestandsimport: keine Meldungen, keine Aufgaben fuer Abgereiste, Fortschritt.

WARUM ES DIESE TESTS GIBT: Fuer den CSV-Import gab es KEINEN Test — deshalb ist
nie aufgefallen, dass er bei realer Menge nie durchlief. Live gemessen am
31.08.2026 an einem Booking.com-Export mit 252 Zeilen: 3,6 s je Zeile (~15 min
in einer HTTP-Anfrage), und jede nachgetragene Zeile verschickte Mails ueber
Aufenthalte aus 2024 samt Reinigungsaufgaben fuer abgereiste Gaeste.

Geprueft wird die WIRKUNG (was der Import ausloest), nicht die Verdrahtung.
"""
from __future__ import annotations

import ast
import contextlib
import inspect
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

_SLICE = Path(__file__).resolve().parent.parent
# Die Wurzel ALLER Slices: der Aufrufer-Test unten darf nicht am eigenen
# Ordner enden (die Projektion ist ueber die Service-Fassade erreichbar).
_FEATURES = _SLICE.parent


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


# Der EINZIGE Aufrufer, der `bestandsimport` weglassen darf: der Live-Feed
# (`_sync_feed`, der Rumpf von `sync_bookings_all`). Dort ist jede Revision per
# Definition ein frisches Ereignis, und die Vorgabe `False` ist genau richtig.
_LIVE_FEED = "_sync_feed"


def test_jeder_aufrufer_der_projektion_entscheidet_bewusst() -> None:
    """Jede Projektions-Aufrufstelle setzt `bestandsimport` — ausser dem Feed.

    WARUM DIESER TEST DEN VORGAENGER ERSETZT: Der zaehlte eine BEKANNTE Liste
    von Modulen auf (`csv_import`, `lodgify_import`). Damit prueft er die
    Stellen, an die man beim Schreiben gedacht hat — und genau daran lief der
    Fehler vom 09.09.2026 vorbei: `import_bookings_for_property`
    (Bestandsimport!) und `feed_buchungen_abgleichen` riefen die Projektion
    ohne bewusste Entscheidung auf, und in der Glocke standen dutzende
    Altbuchungen als frische Ereignisse, mitsamt Mails.

    Ein Test, der eine Liste aufzaehlt, findet nur, was schon bekannt ist.
    Dieser hier geht ueber den AST ALLER Slices und findet JEDE Aufrufstelle,
    auch die von morgen.

    WARUM `src/features` UND NICHT NUR `channel_manager`: Die Projektion ist
    ueber die Service-Fassade nach aussen erreichbar (`service.py` reicht sie
    per Mixin heraus). Ein flacher Glob auf den eigenen Ordner haette also
    genau das nicht gesehen, was der Docstring verspricht — ein Aufruf aus
    einem anderen Slice oder einem Unterordner waere unsichtbar geblieben.
    """
    fehlend: list[str] = []
    for pfad in sorted(_FEATURES.rglob("*.py")):
        if "tests" in pfad.parts:
            continue  # Tests rufen die Projektion absichtlich direkt auf.
        baum = ast.parse(pfad.read_text(encoding="utf-8"))
        # Welche Funktion umschliesst den Aufruf? Ueber die Elternkette, damit
        # der Feed-Pfad ausgenommen werden kann, ohne die Datei auszunehmen.
        for eltern in ast.walk(baum):
            for kind in ast.iter_child_nodes(eltern):
                kind.parent = eltern  # type: ignore[attr-defined]
        for knoten in ast.walk(baum):
            if not isinstance(knoten, ast.Call):
                continue
            ziel = knoten.func
            if not isinstance(ziel, ast.Attribute):
                continue
            if ziel.attr != "_project_booking_to_reservation":
                continue
            if any(k.arg == "bestandsimport" for k in knoten.keywords):
                continue
            umgebung = _umgebende_funktion(knoten)
            if umgebung == _LIVE_FEED:
                continue
            ort = pfad.relative_to(_FEATURES)
            fehlend.append(f"{ort}:{knoten.lineno} (in {umgebung})")

    assert not fehlend, (
        "Diese Aufrufe der Projektion entscheiden nicht ueber "
        "`bestandsimport` und melden damit stumm jede Altbuchung als neu:\n  "
        + "\n  ".join(fehlend)
    )


def _umgebende_funktion(knoten: ast.AST) -> str:
    """Name der Funktion, in der dieser Knoten steht (oder '?')."""
    aktuell = getattr(knoten, "parent", None)
    while aktuell is not None:
        if isinstance(aktuell, ast.FunctionDef | ast.AsyncFunctionDef):
            return aktuell.name
        aktuell = getattr(aktuell, "parent", None)
    return "?"


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


# --- Angelegt vs. aktualisiert ---------------------------------------------


def test_zaehler_sind_getrennt() -> None:
    """Die Antwort fuehrt `imported` UND `updated` — nicht einen Sammelwert.

    Beides in einem Zaehler hiess: nach dem zweiten Upload derselben Datei
    stand „251 angelegt, 0 vorhanden", obwohl nichts angelegt wurde. Genau an
    dieser Zahl liest ein Betrieb ab, ob ein Wiederholungs-Upload etwas
    verdoppelt hat (live am 31.08.2026, Wurzel 5).
    """
    from src.features.channel_manager.schemas import CsvBookingImportResponse

    felder = CsvBookingImportResponse.model_fields
    assert "imported" in felder and "updated" in felder


def test_lauf_zeile_fuehrt_aktualisiert() -> None:
    """Ohne die Spalte kaeme der Zaehler nie im Fenster an."""
    from src.features.channel_manager.schemas import BestandsimportLauf

    assert "aktualisiert" in BestandsimportLauf.model_fields
    sql = (
        _SLICE.parents[4] / "supabase" / "migrations"
        / "0508_bestandsimport_aktualisiert.sql"
    ).read_text(encoding="utf-8")
    assert "add column if not exists aktualisiert" in sql


def test_popup_zeigt_fuenf_zaehler() -> None:
    """Fuenf Kacheln, und „neu" darf nicht wie „aktualisiert" heissen."""
    import json

    wurzel = _SLICE.parents[4]
    tsx = (
        wurzel / "web" / "components" / "channel-manager" / "import-fortschritt.tsx"
    ).read_text(encoding="utf-8")
    assert "importProgress.updated" in tsx
    assert "importProgress.portal" in tsx, (
        "Die Kachel „schon vom Portal da“ fehlt — 54 belassene Zeilen "
        "wuerden sonst als „ohne Wirkung“ erscheinen (31.08.2026)."
    )
    assert "grid-cols-5" in tsx, "fuenf Zaehler brauchen fuenf Spalten"

    # In JEDER Sprache muessen sich die beiden Kacheln unterscheiden — sonst
    # steht dort zweimal dasselbe Wort nebeneinander.
    for datei in sorted((wurzel / "web" / "messages").glob("*.json")):
        ip = json.loads(datei.read_text(encoding="utf-8"))["channels"][
            "importProgress"
        ]
        assert {"created", "updated", "portal", "skipped", "failedRows"} <= set(ip), (
            datei.stem
        )
        assert ip["created"].lower() != ip["updated"].lower(), datei.stem


# --- Aermere Quelle ueberschreibt keine reichere (31.08.2026) -----------------


class _Query:
    """PostgREST-Stub: feste Zeilen je Tabelle, merkt Updates/Inserts."""

    def __init__(self, tabelle: str, store: dict) -> None:
        self._tabelle = tabelle
        self._store = store

    def select(self, *_a, **_k):
        return self

    def update(self, payload):
        self._store["updates"].append((self._tabelle, payload))
        return self

    def insert(self, payload):
        self._store["inserts"].append((self._tabelle, payload))
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def __getattr__(self, name: str):
        # order/in_/is_/neq/gte/... — alle weiteren PostgREST-Filter sind fuer
        # diesen Stub Durchreicher; nur select/update/insert/execute zaehlen.
        if name.startswith("_"):
            raise AttributeError(name)
        return lambda *_a, **_k: self

    def execute(self):
        return type("R", (), {"data": self._store["rows"].get(self._tabelle, [])})()


class _Db:
    def __init__(self, rows: dict) -> None:
        self.store = {"rows": rows, "updates": [], "inserts": []}

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


_FEED_ZEILE = {
    "id": "res-1",
    "checked_out_at": None,
    "check_in": "2026-09-09",
    "check_out": "2026-09-13",
    "property_id": "prop-1",
    "payment_collect": "ota",
    "unit_id": None,
    "guest_id": "g-1",
    "adults": 2,
    "children": 0,
    # Der Feed hat die Zeile angelegt: Quelle ist die Channex-ID.
    "source_channex_booking_id": "46461f73-89eb-4724-918e-ce67172470fb",
}


def test_csv_zeile_laesst_feed_buchung_unangetastet(monkeypatch) -> None:
    """Der zweite Suchweg (Bestaetigungscode) darf nicht rueckwaerts laufen.

    Live am 31.08.2026: ein CSV-Upload fand ueber `external_ref` 54 Buchungen,
    die der Portal-Feed laengst angelegt hatte, und schrieb sie um — Quelle
    `csv:`, `booked_at` leer, die Gebuehren-Aufstellung weg. Die Abrechnung
    sagte danach „Portal hat keine Gebuehren gemeldet".
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    class _Sync(BookingsSyncMixin):
        pass

    db = _Db({"reservations": [dict(_FEED_ZEILE)]})
    sync = _Sync()
    monkeypatch.setattr(_Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False)

    geschrieben = sync._project_booking_to_reservation(  # noqa: SLF001
        db,
        "tenant-1",
        {
            "booking_id": "csv:5344520509",
            "property_id": "prop-1",
            "arrival_date": "2026-09-09",
            "departure_date": "2026-09-13",
            "status": "new",
            "ota_name": "Booking.com",
            "ota_reservation_code": "5344520509",
            "amount": 4415.0,
            "currency": "DKK",
            "customer": {"name": "Eugénie", "surname": "Kluczka"},
            "occupancy": 1,
        },
        local_property_id="prop-1",
        bestandsimport=True,
    )

    assert geschrieben is False
    assert db.store["updates"] == [], "die Feed-Zeile wurde umgeschrieben"
    assert db.store["inserts"] == []


def test_import_kennt_die_portal_zeilen_vorab() -> None:
    """Der Import fragt die Feed-Buchungen EINMAL ab und zaehlt sie getrennt.

    Der Riegel in der Projektion allein liesse die Zeile unter „ohne Wirkung"
    verschwinden — und kostete trotzdem die ~3,5 s Aufloesung je Zeile.
    """
    from src.features.channel_manager.schemas import (
        BestandsimportLauf,
        CsvBookingImportResponse,
    )

    quelle = _quelle("csv_import.py")
    assert "portal_codes" in quelle
    assert "csv_zeile_portalbuchung_belassen" in quelle
    assert "portal" in CsvBookingImportResponse.model_fields
    assert "portal" in BestandsimportLauf.model_fields
    sql = (
        _SLICE.parents[4] / "supabase" / "migrations" / "0530_bestandsimport_portal.sql"
    ).read_text(encoding="utf-8")
    assert "add column if not exists portal" in sql


def test_csv_betrag_ergaenzt_channex_import(monkeypatch) -> None:
    """Channex-IMPORT (`is_imported`) trifft CSV: NUR der Betrag wandert.

    Channex dokumentiert fuer nachgeholte Buchungen „will not include extras
    and cleaning fees" — `amount` ist der Zimmerpreis. Der Portal-Export des
    Betriebs traegt den Gesamtpreis (LUDO 01.–05.09.: 3.528 vs. 4.583 DKK).
    Identitaet, Buchungszeit und Payload bleiben vom Feed.
    """
    from src.features.channel_manager.bookings_sync import BookingsSyncMixin

    class _Sync(BookingsSyncMixin):
        pass

    zeile = dict(_FEED_ZEILE, is_imported=True, total_amount=3528.0)
    db = _Db({"reservations": [zeile]})
    sync = _Sync()
    monkeypatch.setattr(_Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False)

    geschrieben = sync._project_booking_to_reservation(  # noqa: SLF001
        db,
        "tenant-1",
        {
            "booking_id": "csv:6575553495",
            "property_id": "prop-1",
            "arrival_date": "2026-09-01",
            "departure_date": "2026-09-05",
            "status": "new",
            "ota_name": "Booking.com",
            "ota_reservation_code": "6575553495",
            "amount": 4583.0,
            "currency": "DKK",
            "customer": {"name": "Ludo", "surname": "Van Imschoot"},
        },
        local_property_id="prop-1",
        bestandsimport=True,
    )

    assert geschrieben is True
    assert db.store["updates"] == [
        ("reservations", {"total_amount": 4583.0, "paid_amount": 4583.0})
    ], "es darf NUR der Betrag geschrieben werden — keine Quelle, kein booked_at"


def test_channex_import_laesst_csv_gesamtpreis_stehen(monkeypatch) -> None:
    """Gegenrichtung: der Channex-IMPORT trifft eine CSV-Zeile.

    Er bringt Identitaet, Buchungszeit und Payload — aber nur den Zimmerpreis.
    Der Gesamtpreis aus dem Portal-Export bleibt stehen.
    """
    from src.features.channel_manager.service import ChannelManagerService as _Sync

    csv_zeile = dict(
        _FEED_ZEILE, source_channex_booking_id="csv:6575553495", total_amount=4583.0
    )
    db = _Db({"reservations": [csv_zeile], "guests": [], "reservation_events": []})
    sync = _Sync.__new__(_Sync)
    monkeypatch.setattr(_Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False)
    monkeypatch.setattr(
        _Sync, "_rate_plan_der_buchung", lambda *_a, **_k: (None, None), raising=False
    )
    monkeypatch.setattr(_Sync, "_booking_quote_items", lambda *_a, **_k: [], raising=False)
    monkeypatch.setattr(_Sync, "_reservierte_einheit", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(_Sync, "_property_currency", lambda *_a, **_k: "DKK", raising=False)
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(_Sync, "_reserve_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(_Sync, "_push_einheiten_stand", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id", lambda *_a, **_k: None
    )
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.recompute_guest_aggregates",
        lambda *_a, **_k: None,
    )

    # Der Nachlauf (Channex-Push, Aufgaben) ist hier nicht aufgebaut und darf
    # scheitern; geprueft wird allein das Update davor.
    with contextlib.suppress(Exception):
        sync._project_booking_to_reservation(  # noqa: SLF001
            db,
            "tenant-1",
            {
                "booking_id": "59bcdbd2-6df5-4ae5-bbee-ef2d1d71fbce",
                "property_id": "chx-prop",
                "arrival_date": "2026-09-01",
                "departure_date": "2026-09-05",
                "status": "new",
                "ota_name": "BookingCom",
                "ota_reservation_code": "6575553495",
                "amount": 3528.0,
                "currency": "DKK",
                "meta": {"is_imported": True},
                "customer": {"name": "Ludo", "surname": "Van Imschoot"},
                "rooms": [],
            },
            "g-1",
            local_property_id="prop-1",
        )

    updates = [p for t, p in db.store["updates"] if t == "reservations"]
    assert updates, "die CSV-Zeile muss ueber den Bestaetigungscode getroffen werden"
    zeile = updates[0]
    assert zeile["source_channex_booking_id"] == "59bcdbd2-6df5-4ae5-bbee-ef2d1d71fbce"
    assert "total_amount" not in zeile and "paid_amount" not in zeile, (
        "der Zimmerpreis des Imports darf den Gesamtpreis der CSV nicht ersetzen"
    )


# ── Das Melde-Fenster des Recovery-Laufs ──────────────────────────────────────


def test_recovery_meldet_nur_innerhalb_des_fensters() -> None:
    """Die Grenze von `_frisch_gebucht` selbst — beidseitig, aus der Konstante.

    Fuenf Minuten neben der Grenze, nicht Jahre davon entfernt: ein Test mit
    `now()` gegen ein Datum von 2020 bleibt gruen, egal wie breit das Fenster
    ist. Er prueft dann den Codepfad, nicht die Grenze — und eine verschobene
    Grenze ist genau der stille Rueckfall, um den es hier geht.
    """
    from src.features.channel_manager.bookings_sync import (
        RECOVERY_FRISCH_STUNDEN,
        _frisch_gebucht,
    )

    fenster = timedelta(hours=RECOVERY_FRISCH_STUNDEN)
    jetzt = datetime.now(UTC)
    drinnen = (jetzt - fenster + timedelta(minutes=5)).isoformat()
    draussen = (jetzt - fenster - timedelta(minutes=5)).isoformat()

    assert _frisch_gebucht({"booked_at": drinnen}) is True
    assert _frisch_gebucht({"booked_at": draussen}) is False


def test_recovery_faellt_fail_closed_auf_bestand() -> None:
    """Kein klares „frisch" → keine Meldung (Wurzel 5).

    Deckt alle drei Faelle ab, in denen `ist_frisch` `None` gibt: kein
    Zeitstempel, unlesbarer Zeitstempel, Zeitstempel in der Zukunft. Der
    letzte ist der interessante — einseitig verglichen galt er DAUERHAFT als
    frisch und meldete bei jedem Lauf erneut.
    """
    from src.features.channel_manager.bookings_sync import _frisch_gebucht

    voraus = (datetime.now(UTC) + timedelta(days=30)).isoformat()

    assert _frisch_gebucht({}) is False
    assert _frisch_gebucht({"booked_at": "kaputt"}) is False
    assert _frisch_gebucht({"booked_at": voraus}) is False


def test_recovery_holt_und_meldet_dasselbe_fenster() -> None:
    """Abruf-Fenster und Melde-Fenster sind EINE Zahl, nicht zwei.

    DIE STILLE LUECKE, DIE DAS SCHLIESST: `full_sync` holte
    `timedelta(days=3)` = 72 Stunden nach, gemeldet wurden aber nur 48. Eine
    echte Feed-Luecken-Buchung aus Stunde 48–72 kam damit durch den Abruf,
    landete korrekt im Kalender — und wurde stillschweigend NICHT gemeldet,
    obwohl sie genau der Fall ist, fuer den dieser Lauf existiert.

    Geprueft wird die ABLEITUNG, nicht der Wert: wer das Fenster kuenftig auf
    fuenf Tage stellt, soll das Melden mitziehen, ohne diesen Test anzufassen.
    Zusaetzlich steht in `full_sync` keine eigene Tageszahl mehr — sonst waere
    die Kopplung hier gruen und dort wirkungslos.
    """
    from src.features.channel_manager.bookings_sync import (
        RECOVERY_FENSTER_TAGE,
        RECOVERY_FRISCH_STUNDEN,
    )

    assert RECOVERY_FRISCH_STUNDEN == RECOVERY_FENSTER_TAGE * 24
    quelle = _quelle("full_sync.py")
    assert "timedelta(days=RECOVERY_FENSTER_TAGE)" in quelle
    assert "timedelta(days=3)" not in quelle
