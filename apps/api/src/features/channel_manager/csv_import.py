"""CSV-Bestandsimport von Buchungen (Wechselkunde: Alt-/Direkt-/vergangene
Buchungen, die NICHT über die OTA-API kommen).

Belegter Branchen-Standard (Hostaway/Cloudbeds/Beds24/OwnerRez, recherchiert):
Vorlage mit festen Spalten, Datum YYYY-MM-DD, Dedup über eine eindeutige
externe ID, Storno/No-Show werden NICHT importiert, Betrag mit Punkt ODER Komma.

Mixin des ChannelManagerService (siehe service.py-Fassade). Projiziert jede
Zeile über die bestehende Reservierungs-Projektion (_project_booking_to_reservation)
mit direkt gemapptem lokalem Objekt — so gilt derselbe Kalender-Block +
Alt/Neu-Diff + Idempotenz-Pfad wie beim OTA-Import (kein zweiter Schreibweg).
"""
from __future__ import annotations

import csv
import difflib
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .common import ChannelManagerError, log
from .schemas import CsvBookingImportResponse

# Feste Vorlagen-Spalten (Header der herunterladbaren CSV). property/Gast/
# Zeitraum sind Pflicht; der Rest optional. Reihenfolge = Vorlagen-Reihenfolge.
CSV_COLUMNS: tuple[str, ...] = (
    "property",          # Objekt-Titel ODER Objekt-ID (exakter Treffer)
    "guest_first_name",
    "guest_last_name",
    "arrival",           # YYYY-MM-DD
    "departure",         # YYYY-MM-DD
    "guest_email",
    "guest_phone",
    "num_guests",
    "total_amount",      # Punkt oder Komma
    "currency",          # ISO-4217 (leer → Objektwährung)
    "source",            # OTA-Name/„Direkt" (Freitext)
    "external_id",       # eindeutige Quell-ID (Dedup); leer → aus Zeile abgeleitet
    "property_address",  # Adresse laut Portal — zweiter Weg zum Objekt
)
_REQUIRED = ("property", "guest_first_name", "guest_last_name", "arrival", "departure")
_MAX_ROWS = 1000  # Obergrenze je Upload (Wurzel 8: unbegrenzte Liste → 422)


def _adress_schluessel(text: str) -> str:
    """Adresse auf „strasse hausnummer ort" reduzieren — fuer den Abgleich.

    Der Portal-Export schreibt „Lærkevej 2, Bindslev, Denmark", wir fuehren
    Strasse, Hausnummer und Ort in eigenen Spalten. Beide Seiten laufen durch
    DIESE Funktion, damit sie vergleichbar werden.

    Das Land faellt weg (steht nur beim Portal), Zeichensetzung ebenso.
    Reihenfolge und Wortlaut bleiben — es wird nichts geraten.
    """
    ohne = "".join(z if (z.isalnum() or z.isspace()) else " " for z in text)
    teile = ohne.lower().split()
    # Landesnamen am Ende entfernen: sie stehen nur im Portal-Export und
    # wuerden jeden Vergleich scheitern lassen.
    while teile and teile[-1] in _LAENDER:
        teile.pop()
    return " ".join(teile)


# Landesbezeichnungen, die Portale an die Adresse haengen. Bewusst eine kurze,
# benannte Liste statt einer Bibliothek: es geht um das letzte Wort einer
# Adresszeile, nicht um Laendererkennung.
_LAENDER = frozenset({
    "denmark", "danmark", "dk", "germany", "deutschland", "de",
    "sweden", "sverige", "norway", "norge", "netherlands", "nederland",
})


def _ohne_hausnummer(adresse: str) -> str:
    """Portal-Adresse ohne Hausnummer: „Højenevej 2A links, Vidstrup" → „hojenevej vidstrup".

    Entfernt jedes Wort, das mit einer Ziffer beginnt, samt der Zusaetze, die
    das Portal daran haengt („links", „rechts"). Der Ortsname bleibt — ohne ihn
    traefe dieselbe Strasse in zwei Doerfern zusammen.
    """
    teile = _adress_schluessel(adresse).split()
    behalten = [
        t for t in teile
        if not t[:1].isdigit() and t not in ("links", "rechts", "left", "right")
    ]
    return " ".join(behalten)


def _normalisiert(titel: str) -> str:
    """Objekttitel auf seinen Wortlaut reduzieren — fuer den Abgleich.

    Entfernt AUSSCHLIESSLICH Zierzeichen und doppelten Leerraum und schreibt
    klein. Buchstaben bleiben unangetastet: „ae" wird NICHT zu „ä", „hus" nicht
    zu „hygge". Der Abgleich soll Schreibweisen desselben Namens
    zusammenfuehren, nicht verschiedene Namen.

    Danach gleich:  'FeWo *Stjerneskud*'         → 'fewo stjerneskud'
                    'Feriehus "Perlen" Tversted' → 'feriehus perlen tversted'
    Weiterhin verschieden: 'Odden-hygge-mygdal' ≠ 'Odden-hus-mygdal'
    """
    ohne = "".join(z for z in titel if z.isalnum() or z.isspace() or z == "-")
    # Bindestrich zu Leerzeichen: die Portale setzen ihn uneinheitlich
    # („Laerke-huset" vs. „Laerke huset"). Das aendert keinen Wortlaut.
    return " ".join(ohne.replace("-", " ").lower().split())


@dataclass(frozen=True, slots=True)
class _Objektregister:
    """Fuenf Wege, eine CSV-Zeile ihrem Objekt zuzuordnen.

    Herausgezogen am 10.09.2026 aus `import_bookings_csv`: der Aufbau der
    Register war ein 73-Zeilen-Block mit hoher Verzweigungsdichte mitten in
    einer 256-Zeilen-Funktion, und alle fuenf wurden ohnehin gebuendelt
    weitergereicht. Als eigene Struktur sind sie einzeln pruefbar — was
    zaehlt, denn eine falsche Zuordnung sperrt echte Naechte am falschen
    Objekt und verschiebt Umsatz auf den falschen Eigentuemer.

    Absteigend nach Verlaesslichkeit: ID, exakter Titel, normalisierter
    Titel, Adresse mit Hausnummer, Strasse ohne Nummer.
    """

    by_id: dict[str, str]
    by_title: dict[str, str]
    by_normal: dict[str, str]
    by_adresse: dict[str, str]
    by_strasse: dict[str, str]


def _objektregister(props: list[dict[str, Any]]) -> _Objektregister:
    """Die fuenf Register aus den Objekt-Stammdaten aufbauen.

    Mehrdeutige Schluessel werden durchgaengig VERWORFEN statt nach
    Ladereihenfolge aufgeloest (Wurzel 4): tragen zwei Objekte denselben
    Schluessel, darf nicht der Zufall entscheiden, welches gewinnt — dann
    muss die naechste Stufe greifen.
    """
    by_id = {p["id"]: p["id"] for p in props}
    by_title = {
        (p.get("title") or "").strip().lower(): p["id"]
        for p in props
        if p.get("title")
    }
    # ZWEITER Weg: normalisierter Titel. Die Portale geben denselben Namen
    # ohne Zierzeichen aus — live am 31.08.2026 fielen 111 von 252 Zeilen
    # eines Booking.com-Exports allein daran durch:
    #   Export „Feriehus Perlen Tversted" ≠ Titel „Feriehus \"Perlen\" Tversted"
    #   Export „FeWo Stjerneskud"         ≠ Titel „FeWo *Stjerneskud*"
    # Das ist DASSELBE Objekt, nur ohne die Anfuehrungszeichen bzw.
    # Sternchen, die der Betrieb in seinen Titel geschrieben hat.
    #
    # Normalisiert wird NUR Zeichensetzung und Leerraum — NICHT der
    # Wortlaut. „Odden-hus-mygdal" bleibt damit verschieden von
    # „Odden-hygge-mygdal", und „Holiday home Dora" trifft nicht auf
    # „Feriehus Dora". Solche Zeilen MUESSEN scheitern: eine Buchung dem
    # falschen Objekt zuzuordnen sperrt dort echte Naechte und verschiebt
    # Umsatz auf den falschen Eigentuemer — ein Fehler, den niemand sieht.
    # Kein Raten per Aehnlichkeit (Wurzel 4).
    #
    # Mehrdeutige Normalformen werden VERWORFEN statt zufaellig aufgeloest:
    # tragen zwei Objekte nach dem Entfernen der Zierzeichen denselben
    # Namen, entscheidet sonst die Ladereihenfolge, welches gewinnt.
    normal: dict[str, str | None] = {}
    for prop in props:
        schluessel = _normalisiert(prop.get("title") or "")
        if not schluessel:
            continue
        if schluessel in normal and normal[schluessel] != prop["id"]:
            normal[schluessel] = None  # mehrdeutig → nicht verwenden
        else:
            normal.setdefault(schluessel, prop["id"])
    by_normal = {k: v for k, v in normal.items() if v}

    # DRITTER Weg: die Adresse. Sie traegt weiter als der Name, weil der
    # Portal-Export KEINE Objektkennung enthaelt (gemessen am echten
    # Booking.com-Export vom 31.08.2026: zwoelf Spalten, darunter „Lage",
    # aber keine Unterkunfts-ID) und Namen auseinanderlaufen, sobald jemand
    # ein Inserat umbenennt:
    #   „Odden-hus-mygdal"  hier „Odden-hygge-mygdal"   — Oddenvej, Mygdal
    #   „Holiday home Dora" hier „Feriehus Dora"        — Doravej, Bindslev
    #   „Lærke-huset"       hier „Lærke-huset-Bindslev" — Lærkevej, Bindslev
    # Alle drei loesen ueber die Adresse eindeutig auf.
    #
    # Zwei Stufen, weil beide gebraucht werden: MIT Hausnummer trennt sie
    # Nachbarhaeuser (Iver Christensens Vej 11 vs. 13 — zwei verschiedene
    # Objekte). OHNE Hausnummer greift sie, wenn das Portal die Nummer
    # anders schreibt („2A links" statt „2A"). Mehrdeutige Schluessel
    # werden VERWORFEN, nicht nach Ladereihenfolge aufgeloest: am
    # Højenevej 2A liegen zwei Objekte, dort MUSS der Name entscheiden.
    mit_nr: dict[str, str | None] = {}
    ohne_nr: dict[str, str | None] = {}
    for prop in props:
        ort = prop.get("city") or ""
        strasse = prop.get("street") or ""
        nummer = prop.get("house_number") or ""
        for index, roh in (
            (mit_nr, f"{strasse} {nummer} {ort}"),
            (ohne_nr, f"{strasse} {ort}"),
        ):
            schluessel = _adress_schluessel(roh)
            # Ein Objekt ohne Strasse ergaebe den Schluessel des blossen
            # Ortes — daran haengen sonst alle Objekte desselben Ortes.
            if not schluessel or not strasse.strip():
                continue
            if index.get(schluessel, prop["id"]) != prop["id"]:
                index[schluessel] = None
            else:
                index.setdefault(schluessel, prop["id"])
    by_adresse = {k: v for k, v in mit_nr.items() if v}
    by_strasse = {k: v for k, v in ohne_nr.items() if v}
    return _Objektregister(
        by_id=by_id,
        by_title=by_title,
        by_normal=by_normal,
        by_adresse=by_adresse,
        by_strasse=by_strasse,
    )


class CsvImportMixin:
    """CSV-Bestandsimport von Buchungen."""

    def csv_booking_template(self) -> str:
        """Die leere Vorlagen-CSV (nur Kopfzeile) als Text — Download im UI."""
        buf = io.StringIO()
        csv.writer(buf).writerow(CSV_COLUMNS)
        return buf.getvalue()

    def import_bookings_csv(
        self,
        # `None` ist erlaubt, WENN `tenant_id` gesetzt ist — der Worker hat
        # keine Sitzung. Beides zugleich fehlen zu lassen faellt in
        # `_require_tenant` auf, nicht still.
        ctx: AuthContext | None,
        *,
        content: str,
        fortschritt: Callable[[int, int, str], None] | None = None,
        tenant_id: str | None = None,
    ) -> CsvBookingImportResponse:
        """CSV-Text parsen und als Reservierungen anlegen. Tenant-scoped; jede
        Zeile isoliert (eine Fehlerzeile kippt den Import nicht). Idempotent über
        die externe ID (erneuter Upload derselben Datei legt nichts doppelt an).

        `fortschritt(fertig, gesamt, bezeichnung)`: optionaler Rückruf nach jeder
        Zeile. Ihn hier hineinzureichen ist der Grund, warum der Worker die
        Schleife NICHT kopieren muss — zwei Schleifen über dieselbe Datei wären
        zwei Auslegungen davon, und die Anzeige zählte anderes als der Import
        schreibt.

        `tenant_id`: nur für den Worker-Weg, der keine Sitzung hat. Ist er
        gesetzt, gilt er; sonst kommt der Tenant wie immer aus dem Kontext. Er
        wird beim Einreihen aus dem `AuthContext` gesetzt, nie aus einer Anfrage
        (Wurzel 3).
        """
        tenant_id = tenant_id or self._require_tenant(ctx)
        db = self._require_db()

        # BOM strippen (Excel schreibt ﻿ an den Anfang → sonst kollidiert es
        # mit dem ersten Header „property"). Trennzeichen automatisch erkennen:
        # EU-Excel nutzt Semikolon (Komma ist dort Dezimaltrenner), US-Excel Komma.
        content = content.lstrip("﻿")
        sample = content[:2048]
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
        try:
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
        except csv.Error as exc:
            raise ChannelManagerError(
                f"CSV konnte nicht gelesen werden: {exc}", status_code=422
            ) from exc
        if reader.fieldnames is None:
            raise ChannelManagerError("Die CSV ist leer.", status_code=422)
        missing = [c for c in _REQUIRED if c not in reader.fieldnames]
        if missing:
            raise ChannelManagerError(
                "In der CSV fehlen Pflichtspalten: " + ", ".join(missing),
                status_code=422,
            )

        # Objekt-Auflösung: Titel ODER ID → property_id (tenant-scoped, kein
        # Fremdzugriff). Einmal laden, dann je Zeile nachschlagen.
        props = (
            db.table("properties")
            .select("id, title, street, house_number, city")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        # Die fuenf Zuordnungswege stehen als eigene Struktur daneben
        # (`_objektregister`) — samt der Live-Belege, die sie begruenden.
        register = _objektregister(props)
        by_id = register.by_id
        by_title = register.by_title
        by_normal = register.by_normal
        by_adresse = register.by_adresse
        by_strasse = register.by_strasse

        # Welche Buchungen aus frueheren Uploads liegen schon da? EINMAL laden,
        # nicht je Zeile — 252 zusaetzliche Selects waeren bei ~3,5 s/Zeile
        # spuerbar und wuerden nichts erklaeren, was hier nicht schon steht.
        #
        # WARUM DIE UNTERSCHEIDUNG NOETIG IST: `_project_booking_to_reservation`
        # gibt True zurueck, wenn sie geschrieben hat — egal ob angelegt ODER
        # aktualisiert. Der Import zaehlte beides als „imported", und nach dem
        # zweiten Upload derselben Datei stand im Fenster „251 angelegt,
        # 0 vorhanden". Das ist die Zahl, die belegen SOLL, dass nichts doppelt
        # entsteht — und sie behauptete das Gegenteil (live am 31.08.2026;
        # in der DB lagen korrekt 259 Zeilen mit 259 verschiedenen IDs, es war
        # nur die Anzeige). Wurzel 5: eine Kennzahl, die das Gegenteil ihrer
        # Lage meldet, ist so schlimm wie ein verschluckter Fehler.
        bekannt: set[str] = set()
        vorhanden = (
            db.table("reservations")
            .select("source_channex_booking_id")
            .eq("tenant_id", tenant_id)
            .like("source_channex_booking_id", "csv:%")
            .execute()
        ).data or []
        bekannt = {
            str(z["source_channex_booking_id"])
            for z in vorhanden
            if z.get("source_channex_booking_id")
        }
        # Buchungen, die der PORTAL-FEED bereits angelegt hat (Quelle ist die
        # Channex-ID, nicht `csv:`), am Bestaetigungscode erkannt. Solche Zeilen
        # werden NICHT projiziert: die Datei traegt zwoelf Spalten, der Feed
        # den ganzen Payload — Gebuehren-Aufstellung, Buchungszeitpunkt,
        # Gaestezahl. Live am 31.08.2026 ueberschrieb ein Upload 54 solcher
        # Zeilen, danach meldete die Abrechnung „Portal hat keine Gebuehren
        # gemeldet" (Details in bookings_sync, zweiter Suchweg). Die Projektion
        # hat denselben Riegel als Backstop; hier spart der Vorab-Blick die
        # ~3,5 s je Zeile UND macht die Zahl im Fenster sichtbar („bereits
        # ueber das Portal da"), statt sie unter „ohne Wirkung" zu verstecken.
        # Zwei Mengen, weil der Feed zwei Sorten kennt: LIVE-Buchungen tragen
        # den vollen Payload (Preis-Aufstellung) — die CSV aendert nichts an
        # ihnen. Channex-IMPORTE (`is_imported`, beim Verbinden nachgeholt)
        # tragen laut Channex „no extras and cleaning fees" — dort ist der
        # CSV-Gesamtpreis der bessere Betrag; die Projektion uebernimmt genau
        # ihn und sonst nichts, gezaehlt als „aktualisiert".
        portal_zeilen = (
            db.table("reservations")
            .select("external_ref, source_channex_booking_id, is_imported")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        feed_zeilen = [
            z for z in portal_zeilen
            if z.get("external_ref")
            and z.get("source_channex_booking_id")
            and not str(z["source_channex_booking_id"]).startswith("csv:")
        ]
        portal_codes = {
            str(z["external_ref"]) for z in feed_zeilen if not z.get("is_imported")
        }
        feed_import_codes = {
            str(z["external_ref"]) for z in feed_zeilen if z.get("is_imported")
        }

        # Zähler/Fehler lokal führen und am Ende einmalig zuweisen — Pylint
        # erkennt das Pydantic-Field .errors sonst statisch als FieldInfo (ohne
        # .append). Gleiches Muster wie in bookings_sync._sync_feed.
        total = imported = aktualisiert = skipped = portal = failed = 0
        errors: list[str] = []
        # Fuer den Balken: die Gesamtzahl MUSS vor der ersten Zeile feststehen,
        # sonst zeigt die Anzeige „7 von 7", waehrend noch 245 kommen. Der
        # DictReader ist ein Iterator ueber denselben Text — einmal
        # materialisieren, dann daraus zaehlen und arbeiten.
        alle_zeilen = list(reader)
        gesamt = len(alle_zeilen)
        for idx, raw in enumerate(alle_zeilen, start=2):  # Zeile 1 = Kopf
            if total >= _MAX_ROWS:
                raise ChannelManagerError(
                    f"Zu viele Zeilen (max. {_MAX_ROWS} je Upload).",
                    status_code=422,
                )
            total += 1
            try:
                outcome = self._import_csv_row(
                    db, tenant_id, raw, by_id, by_title, idx,
                    by_normal=by_normal, by_adresse=by_adresse,
                    by_strasse=by_strasse, portal_codes=portal_codes,
                )
            except _RowError as exc:
                failed += 1
                errors.append(str(exc))
                if fortschritt:
                    fortschritt(total, gesamt, self._zeilen_bezeichnung(raw))
                continue
            geschrieben, booking_id = outcome
            code = booking_id.removeprefix("csv:")
            if not geschrieben:
                # Steht der Code beim Feed, war die Zeile bereits ueber das
                # Portal da und wurde bewusst belassen.
                if code in portal_codes:
                    portal += 1
                else:
                    skipped += 1
            elif booking_id in bekannt or code in feed_import_codes:
                # Schon aus einem frueheren Upload da — die Zeile wurde
                # aktualisiert, nicht angelegt. Genau diese Unterscheidung
                # macht das Fortschritts-Fenster aussagekraeftig.
                aktualisiert += 1
            else:
                imported += 1
                # Innerhalb DIESES Laufs merken: enthaelt die Datei dieselbe
                # Buchung zweimal, ist die zweite Zeile eine Aktualisierung.
                bekannt.add(booking_id)
            if fortschritt:
                # NACH dem Schreiben melden: „Zeile 7 fertig" soll heissen, dass
                # sie in der DB steht, nicht dass sie gleich versucht wird.
                fortschritt(total, gesamt, self._zeilen_bezeichnung(raw))

        log.info(
            "csv_booking_import_done",
            tenant_id=tenant_id, total=total, imported=imported,
            aktualisiert=aktualisiert, skipped=skipped, portal=portal,
            failed=failed,
        )
        return CsvBookingImportResponse(
            total_rows=total, imported=imported, updated=aktualisiert,
            skipped=skipped, portal=portal, failed=failed, errors=errors,
        )

    def _import_csv_row(  # noqa: PLR0913 — feste Signatur, alle Argumente nötig
        self,
        db: Client,
        tenant_id: str,
        raw: dict[str, Any],
        by_id: dict[str, str],
        by_title: dict[str, str],
        line: int,
        *,
        by_normal: dict[str, str] | None = None,
        by_adresse: dict[str, str] | None = None,
        by_strasse: dict[str, str] | None = None,
        portal_codes: set[str] | None = None,
    ) -> tuple[bool, str]:
        """Eine CSV-Zeile → Reservierung.

        Wirft `_RowError` mit Zeilennummer bei Validierungsfehlern. Gibt
        `(geschrieben, booking_id)` zurueck: `geschrieben` ist True bei
        angelegt ODER aktualisiert, die `booking_id` ist der Dedup-Schluessel.
        Der Aufrufer entscheidet daran, ob die Zeile NEU war — die Projektion
        selbst unterscheidet das nicht (sie liefert nur True/False)."""
        def cell(key: str) -> str:
            return (raw.get(key) or "").strip()

        prop_ref = cell("property")
        # Auflösungskette, absteigend nach Verlaesslichkeit. Jede Stufe schliesst
        # die Luecke der vorigen; die erste, die trifft, gewinnt. Kein Raten per
        # Aehnlichkeit — falsch zugeordnet heisst: fremde Naechte gesperrt und
        # Umsatz beim falschen Eigentuemer (Wurzel 4).
        adresse = cell("property_address")
        property_id = (
            # 1. Unsere eigene ID, falls die Datei sie traegt.
            by_id.get(prop_ref)
            # 2. Titel exakt (Gross/Kleinschreibung egal).
            or by_title.get(prop_ref.lower())
            # 3. Titel ohne Zierzeichen: „FeWo *Stjerneskud*".
            or (by_normal or {}).get(_normalisiert(prop_ref))
            # 4. Adresse mit Hausnummer — trennt Nachbarhaeuser.
            or (by_adresse or {}).get(_adress_schluessel(adresse))
            # 5. Adresse ohne Hausnummer: das Portal schreibt sie abweichend
            #    („Højenevej 2A links"). Nur wenn die Strasse im Ort eindeutig
            #    EIN Objekt trifft — sonst steht hier None und die Zeile fällt
            #    auf, statt still beim Nachbarn zu landen.
            or (by_strasse or {}).get(_ohne_hausnummer(adresse))
        )
        if not property_id:
            # Den NAECHSTLIEGENDEN eigenen Titel mitnennen. „nicht gefunden"
            # allein laesst den Betrieb raten, WIE das Objekt bei ihm heisst —
            # bei 111 Fehlerzeilen ueber vier Objekte ist das der Unterschied
            # zwischen „unbrauchbar" und „drei Titel angleichen, fertig".
            # Bewusst nur ein HINWEIS, keine automatische Zuordnung: geraten
            # wird nicht (siehe `_normalisiert`).
            nahe = difflib.get_close_matches(
                prop_ref.lower(), list(by_title), n=1, cutoff=0.6
            )
            hinweis = f" Meintest du „{nahe[0]}“?" if nahe else ""
            raise _RowError(
                f"Zeile {line}: Objekt „{prop_ref}“ nicht gefunden.{hinweis}"
            )

        arrival = self._parse_iso_date(cell("arrival"))
        departure = self._parse_iso_date(cell("departure"))
        if not arrival or not departure:
            raise _RowError(
                f"Zeile {line}: Anreise/Abreise muss YYYY-MM-DD sein."
            )
        if departure <= arrival:
            raise _RowError(
                f"Zeile {line}: Abreise muss nach der Anreise liegen."
            )

        first = cell("guest_first_name")
        last = cell("guest_last_name")
        if not (first or last):
            raise _RowError(f"Zeile {line}: Gastname fehlt.")

        # external_id = Dedup-Schlüssel. Fehlt er, aus stabilen Feldern ableiten,
        # damit ein erneuter Upload derselben Zeile nichts doppelt anlegt.
        ext = cell("external_id") or (
            f"{property_id}:{arrival}:{departure}:{(first + last).lower()}"
        )
        booking_id = f"csv:{ext}"
        if cell("external_id") and cell("external_id") in (portal_codes or set()):
            # Bereits ueber den Portal-Feed da — die reichere Quelle bleibt
            # unangetastet (siehe import_bookings_csv). Der Aufrufer zaehlt
            # die Zeile als „portal", nicht als „ohne Wirkung".
            log.info(
                "csv_zeile_portalbuchung_belassen",
                tenant_id=tenant_id, zeile=line,
                ota_reservation_code=cell("external_id"),
            )
            return False, booking_id

        # attrs im OTA-Buchungs-Format bauen → dieselbe Projektion nutzen.
        attrs: dict[str, Any] = {
            "booking_id": booking_id,
            # Marker, damit _projection_precheck durchläuft; die echte Auflösung
            # überspringt local_property_id.
            "property_id": property_id,
            "arrival_date": str(arrival),
            "departure_date": str(departure),
            "status": "new",
            "ota_name": cell("source") or "Direkt",
            "ota_reservation_code": cell("external_id") or None,
            "amount": self._parse_amount(cell("total_amount")),
            "currency": cell("currency") or None,
            "customer": {
                "name": first,
                "surname": last,
                "mail": cell("guest_email") or None,
                "phone": cell("guest_phone") or None,
            },
            "occupancy": self._parse_int(cell("num_guests")),
        }
        geschrieben = self._project_booking_to_reservation(
            db, tenant_id, attrs, local_property_id=property_id,
            # Bestand nachtragen, kein frisches Ereignis: keine Mail/Glocke an
            # Eigentuemer und Betrieb, keine Aufgaben fuer abgereiste Gaeste.
            bestandsimport=True,
        )
        return geschrieben, booking_id

    @staticmethod
    def _zeilen_bezeichnung(raw: dict[str, Any]) -> str:
        """Was unter dem Fortschrittsbalken steht: Objekt und Gast dieser Zeile.

        Bewusst kurz und ohne Kontaktdaten — die Anzeige laeuft im Browser des
        Betriebs, und eine Mailadresse gehoert nicht in eine Laufzeile, die
        nebenbei durchrauscht. Fehlt beides, bleibt es leer statt einen
        Platzhalter zu erfinden (Wurzel 4).
        """
        def zelle(key: str) -> str:
            return (raw.get(key) or "").strip()

        objekt = zelle("property")
        gast = " ".join(
            t for t in (zelle("guest_first_name"), zelle("guest_last_name")) if t
        )
        return " · ".join(t for t in (objekt, gast) if t)

    @staticmethod
    def _parse_iso_date(value: str) -> date | None:
        try:
            return date.fromisoformat(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_amount(value: str) -> float | None:
        """Betrag mit Punkt ODER Komma als Dezimaltrenner (belegt: Hostaway/
        Beds24). Leer → None (kein erfundener 0-Preis)."""
        if not value:
            return None
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None

    @staticmethod
    def _parse_int(value: str) -> int | None:
        try:
            return int(value)
        except (ValueError, TypeError):
            return None


class _RowError(Exception):
    """Validierungsfehler einer einzelnen CSV-Zeile (mit Zeilennummer)."""
