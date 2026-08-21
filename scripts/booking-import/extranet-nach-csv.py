#!/usr/bin/env python3
"""Booking.com-Extranet-Export → unsere Buchungs-Import-CSV.

WARUM DIESES SKRIPT: Buchungen mit Anreise VOR dem Channex-Connect
(10.08.2026) sind ueber keine API erreichbar — die Booking-Reservations-API
liefert ausdruecklich nur Abreisen ab morgen, und Channex kennt nur, was es
selbst als Revision gesehen hat. Der Extranet-Export ist der einzige Weg an
Januar–Juli 2026.

Das Skript LIEST nur und schreibt eine CSV. Es spricht weder Booking noch
unsere API an — der Import laeuft danach bewusst als eigener, freigegebener
Schritt ueber POST /channel-manager/bookings/csv-import.

Aufruf:
    python3 extranet-nach-csv.py <export.csv|export.xlsx> [--jahr 2026] \
        [--objekte objekte.txt] [--ziel import.csv]

Booking benennt die Spalten je Export/Sprache anders; die Zuordnung unten
deckt die belegten Varianten ab und meldet, was sie NICHT zuordnen konnte,
statt zu raten (Wurzel 4: kein erfundener Ersatzwert).
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

# Unsere Zielspalten (csv_import.CSV_COLUMNS — Reihenfolge identisch halten).
ZIEL = (
    "property", "guest_first_name", "guest_last_name", "arrival", "departure",
    "guest_email", "guest_phone", "num_guests", "total_amount", "currency",
    "source", "external_id",
)

# Booking-Spaltennamen → unsere Felder. Mehrere Varianten je Feld, weil der
# Export je Sprache/Ansicht abweicht (DE/EN/DK belegt).
SPALTEN: dict[str, tuple[str, ...]] = {
    # „unterkunftsname" und „name des buchers" sind die echten Koepfe des
    # deutschen Extranet-Exports (geprueft am 21.08.2026). Exakte Treffer
    # stehen zuerst, damit „name des buchers" nicht vom kurzen „name"
    # ueberstimmt wird.
    "objekt":     ("unterkunftsname", "property", "property name", "hotel",
                   "unterkunft", "objekt", "accommodation"),
    "gast":       ("name des buchers", "guest name", "gastname", "booker name",
                   "guest", "gast", "name"),
    "anreise":    ("anreise", "check-in", "checkin", "arrival", "ankomst"),
    "abreise":    ("abreise", "check-out", "checkout", "departure", "afrejse"),
    "gebucht":    ("gebucht am", "booked on", "booked at", "buchungsdatum"),
    "betrag":     ("gesamtbetrag", "total price", "price", "amount",
                   "gesamtpreis", "betrag", "total"),
    "kommission": ("kommission", "commission", "provision"),
    "waehrung":   ("waehrung", "währung", "currency", "valuta"),
    "nummer":     ("buchungsnummer", "book number", "booking number",
                   "reservation number", "reservierungsnummer", "res. id", "id"),
    "personen":   ("persons", "guests", "people", "personen", "gaeste", "gäste"),
    "status":     ("status", "booking status", "buchungsstatus"),
    "zimmer":     ("unit type", "room", "zimmer", "einheit"),
}

# Stornierte/No-Show NICHT importieren (csv_import-Doku: Branchenstandard).
# „storniert" ist der Wert im deutschen Export; „ok" ist die Gegenseite.
RAUS = ("cancel", "storn", "annull", "no-show", "no show", "afvist")

# Deutsche Monatsnamen: der Export schreibt „9. Mai 2024", kein ISO-Datum.
MONATE = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "marz": 3, "april": 4,
    "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
    "oktober": 10, "november": 11, "dezember": 12,
}


def norm(s: str) -> str:
    """Spaltenkopf vergleichbar machen: klein, ohne Diakritika/Sonderzeichen."""
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def finde(kopf: list[str], feld: str) -> int | None:
    kandidaten = [norm(k) for k in SPALTEN[feld]]
    normiert = [norm(k) for k in kopf]
    for k in kandidaten:                      # exakter Treffer zuerst
        if k in normiert:
            return normiert.index(k)
    for i, h in enumerate(normiert):          # dann Teilstring
        if any(k and k in h for k in kandidaten):
            return i
    return None


def datum(wert: str) -> date | None:
    wert = (wert or "").strip()
    if not wert:
        return None
    # Deutsches Langformat zuerst: „9. Mai 2024" — so schreibt es der Export.
    # strptime scheitert daran, weil es die Sprache des Systems nutzt.
    m = re.match(r"(\d{1,2})\.\s*([^\s.]+)\s*(\d{4})", wert)
    if m:
        monat = MONATE.get(m.group(2).strip().lower())
        if monat:
            try:
                return date(int(m.group(3)), monat, int(m.group(1)))
            except ValueError:
                return None
    for f in ("%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y", "%m/%d/%Y", "%d/%m/%Y",
              "%Y/%m/%d", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(wert[:20], f).date()
        except ValueError:
            continue
    return None


def betrag(wert: str) -> str:
    """Zahl aus '1.234,50 DKK' / 'DKK 1234.50' loesen. Leer bleibt leer —
    ein erfundener 0-Preis waere schlimmer als kein Preis."""
    if not wert:
        return ""
    t = re.sub(r"[^\d,.\-]", "", str(wert))
    if not t:
        return ""
    if "," in t and "." in t:                 # 1.234,50 → 1234.50
        t = t.replace(".", "").replace(",", ".")
    elif "," in t:
        t = t.replace(",", ".")
    return t


def waehrung_aus(wert: str) -> str:
    m = re.search(r"\b([A-Z]{3})\b", (wert or "").upper())
    return m.group(1) if m else ""


def nummer_saeubern(wert: str) -> str:
    """Buchungsnummer als reine Ziffernfolge — der Dedup-Schluessel.

    WARUM NOETIG: Excel fuehrt die Nummer als ZAHL, nicht als Text. xlrd gibt
    sie deshalb als Fliesskommazahl zurueck und `str()` macht daraus
    ``5535387537.0``. Die Datenbank fuehrt ``5535387537``.

    Ein einziges angehaengtes ``.0`` verhindert damit JEDEN Treffer beim
    Abgleich: der Import findet die vorhandene Zeile nicht und legt sie ein
    zweites Mal an. Gegen den echten Bestand gemessen (21.08.2026) waren das
    54 Doubletten, jede mit eigener Kalender-Belegung — der Fehler ist in der
    CSV unsichtbar und faellt erst im Kalender auf.

    Deshalb bleibt hier NUR die Ziffernfolge stehen: kein ``.0``, keine
    Tausendertrenner, keine Leerzeichen. Ist gar keine Ziffer da, wird ""
    zurueckgegeben — dann leitet der Import den Schluessel aus Objekt + Datum +
    Name ab, statt auf eine erfundene Nummer zu bauen (Wurzel 4).
    """
    t = (wert or "").strip()
    if not t:
        return ""
    # Fliesskomma-Schreibweise (5535387537.0) auf den Ganzzahlteil kuerzen.
    # Nur bei rein numerischem Wert — eine echte alphanumerische Kennung wie
    # `HM25DQQ525` darf nicht angetastet werden.
    m = re.fullmatch(r"(\d+)\.0+", t)
    if m:
        return m.group(1)
    try:
        # 5.535387537e+09 (Excel-Exponentialschreibweise) ebenfalls auflösen.
        f = float(t)
    except ValueError:
        return t
    return str(int(f)) if f.is_integer() else t


def name_teilen(voll: str) -> tuple[str, str]:
    """'Hansen, Ole' und 'Ole Hansen' → ('Ole', 'Hansen')."""
    v = " ".join((voll or "").split())
    if not v:
        return "", ""
    if "," in v:
        nach, _, vor = v.partition(",")
        return vor.strip(), nach.strip()
    t = v.split()
    return (t[0], " ".join(t[1:])) if len(t) > 1 else ("", t[0])


def zeilen_lesen(pfad: Path) -> list[list[str]]:
    if pfad.suffix.lower() == ".xls":
        # Das Extranet liefert echtes altes Excel (CDFV2) — openpyxl kann das
        # NICHT, dafuer braucht es xlrd.
        try:
            import xlrd  # noqa: PLC0415
        except ImportError:
            sys.exit("Diese .xls braucht xlrd (pip install xlrd).")
        blatt = xlrd.open_workbook(pfad).sheet_by_index(0)
        return [["" if c is None else str(c) for c in blatt.row_values(i)]
                for i in range(blatt.nrows)]
    if pfad.suffix.lower() == ".xlsx":
        try:
            import openpyxl  # noqa: PLC0415
        except ImportError:
            sys.exit("XLSX braucht openpyxl (pip install openpyxl).")
        wb = openpyxl.load_workbook(pfad, read_only=True, data_only=True)
        return [["" if c is None else str(c) for c in r]
                for r in wb[wb.sheetnames[0]].iter_rows(values_only=True)]
    roh = pfad.read_text(encoding="utf-8-sig", errors="replace")
    trenner = ";" if roh.count(";") > roh.count(",") else ","
    return [r for r in csv.reader(io.StringIO(roh), delimiter=trenner)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("quelle", type=Path)
    ap.add_argument("--jahr", type=int, default=2026)
    ap.add_argument("--ziel", type=Path, default=Path("booking-import.csv"))
    ap.add_argument("--objekte", type=Path,
                    help="Datei mit den exakten Objekttiteln (einer je Zeile) "
                         "zur Vorabpruefung der Zuordnung")
    ap.add_argument("--bis", default="",
                    help="nur Anreisen VOR diesem Datum (z. B. 2026-08-01), um "
                         "die schon per Channex vorhandenen auszulassen")
    # WARUM: der Import trifft den Objekttitel EXAKT (csv_import.by_title,
    # kleingeschrieben/getrimmt). Portal und PMS fuehren dasselbe Haus aber oft
    # unter verschiedenen Namen — live belegt: Booking schreibt
    # „Laerke-huset" und „Holiday home Dora", im PMS heissen sie
    # „Laerke-huset-Bindslev" und „Feriehus Dora". Ohne Umbenennung laehmt das
    # jede betroffene Zeile still (der Import zaehlt sie als „uebersprungen").
    #
    # Die Zuordnung ist je Betrieb anders und wird deshalb UEBERGEBEN, nicht im
    # Skript hinterlegt (Wurzel 4: kein erfundener Ersatzwert).
    ap.add_argument("--umbenennen", action="append", default=[],
                    metavar="PORTALNAME=PMS-TITEL",
                    help="Objektnamen des Portals auf den PMS-Titel abbilden, "
                         "z. B. --umbenennen 'Holiday home Dora=Feriehus Dora'. "
                         "Mehrfach angebbar.")
    a = ap.parse_args()

    # Abbildung einlesen. Ein fehlendes „=" ist ein Aufrufsfehler und bricht ab,
    # statt die Angabe stillschweigend zu verwerfen (Wurzel 5).
    umbenennung: dict[str, str] = {}
    for eintrag in a.umbenennen:
        if "=" not in eintrag:
            sys.exit(f"--umbenennen braucht PORTALNAME=PMS-TITEL, war: {eintrag!r}")
        alt, neu = eintrag.split("=", 1)
        if not alt.strip() or not neu.strip():
            sys.exit(f"--umbenennen: beide Seiten muessen gefuellt sein: {eintrag!r}")
        umbenennung[alt.strip().lower()] = neu.strip()

    zeilen = [z for z in zeilen_lesen(a.quelle) if any(str(c).strip() for c in z)]
    if not zeilen:
        sys.exit("Die Datei enthaelt keine Daten.")

    # Kopfzeile suchen: die erste Zeile, in der Anreise UND Gast auftauchen.
    kopf_idx = next((i for i, z in enumerate(zeilen[:20])
                     if finde(list(z), "anreise") is not None
                     and finde(list(z), "gast") is not None), None)
    if kopf_idx is None:
        sys.exit("Kopfzeile nicht erkannt (keine Anreise-/Gast-Spalte gefunden).\n"
                 f"Erste Zeile war: {zeilen[0][:8]}")
    kopf = [str(c) for c in zeilen[kopf_idx]]
    sp = {f: finde(kopf, f) for f in SPALTEN}

    fehlend = [f for f in ("objekt", "gast", "anreise", "abreise") if sp[f] is None]
    if fehlend:
        sys.exit(f"Pflichtspalten fehlen im Export: {', '.join(fehlend)}\n"
                 f"Gefundene Spalten: {kopf}")

    bekannt = set()
    if a.objekte and a.objekte.exists():
        bekannt = {z.strip().lower() for z in
                   a.objekte.read_text(encoding="utf-8").splitlines() if z.strip()}

    grenze = datum(a.bis) if a.bis else None
    raus_ziel: list[dict[str, str]] = []
    uebersprungen: dict[str, int] = {}
    unbekannte_objekte: dict[str, int] = {}
    # Was tatsaechlich umbenannt wurde — wird am Ende ausgegeben, damit
    # eine falsch geschriebene Abbildung auffaellt (0 Treffer = Tippfehler).
    umbenannt: dict[str, str] = {}

    def zaehl(d: dict[str, int], k: str) -> None:
        d[k] = d.get(k, 0) + 1

    for z in zeilen[kopf_idx + 1:]:
        hole = lambda f: (str(z[sp[f]]).strip()                      # noqa: E731
                          if sp[f] is not None and sp[f] < len(z) else "")
        an, ab = datum(hole("anreise")), datum(hole("abreise"))
        if not an or not ab or ab <= an:
            zaehl(uebersprungen, "Datum fehlt/unplausibel"); continue
        if an.year != a.jahr:
            zaehl(uebersprungen, f"nicht {a.jahr}"); continue
        if grenze and an >= grenze:
            zaehl(uebersprungen, f"Anreise ab {grenze} (kommt per Channex)"); continue
        if any(r in hole("status").lower() for r in RAUS):
            zaehl(uebersprungen, "storniert/No-Show"); continue

        objekt = hole("objekt")
        # Erst umbenennen, DANN pruefen: sonst meldete die Pruefung den
        # Portal-Namen als unbekannt, obwohl die Abbildung ihn aufloest.
        if objekt.lower() in umbenennung:
            umbenannt[objekt] = umbenennung[objekt.lower()]
            objekt = umbenennung[objekt.lower()]
        if bekannt and objekt.lower() not in bekannt:
            zaehl(unbekannte_objekte, objekt)

        vor, nach = name_teilen(hole("gast"))
        if not (vor or nach):
            zaehl(uebersprungen, "Gastname fehlt"); continue

        nummer = nummer_saeubern(hole("nummer"))
        raus_ziel.append({
            "property": objekt,
            "guest_first_name": vor,
            "guest_last_name": nach,
            "arrival": an.isoformat(),
            "departure": ab.isoformat(),
            "guest_email": "",   # Statements tragen keine Kontaktdaten
            "guest_phone": "",
            "num_guests": re.sub(r"\D", "", hole("personen")),
            "total_amount": betrag(hole("betrag")),
            # Waehrung aus eigener Spalte ODER aus dem Betragstext; leer =>
            # der Import nimmt die Objektwaehrung (kein EUR-Fallback).
            "currency": (hole("waehrung").strip().upper()[:3]
                         or waehrung_aus(hole("betrag"))),
            "source": "Booking.com",
            # Die Buchungsnummer des Portals, NACKT und ohne Praefix.
            #
            # Sie landet im Import als `ota_reservation_code` und wird gegen
            # `reservations.external_ref` geprueft — und genau dort steht bei den
            # ueber die Schnittstelle gekommenen Buchungen die nackte Nummer
            # (live gemessen 21.08.2026: `ota_name='BookingCom'` fuehrt
            # `5008485743`, 10-stellig, kein Praefix).
            #
            # Ein eigenes Praefix (hier stand `bookingcom:<nummer>`) waere
            # deshalb ein DOPPLER-GENERATOR: der Abgleich findet die vorhandene
            # Zeile nicht und legt sie ein zweites Mal an. Gegen den echten
            # Bestand geprueft betraf das 54 der 252 aktiven Export-Zeilen —
            # 54 Doubletten im Kalender, jede mit eigener Belegung.
            #
            # Das Praefix gehoert also NICHT hierher: die Portal-Nummer ist
            # bereits die Identitaet der Buchung beim Portal und damit der
            # Schluessel, den beide Wege teilen (Wurzel 2).
            "external_id": nummer,
        })

    with a.ziel.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(ZIEL))
        w.writeheader()
        w.writerows(raus_ziel)

    print(f"Gelesen: {len(zeilen) - kopf_idx - 1} Zeilen aus {a.quelle.name}")
    print(f"Geschrieben: {len(raus_ziel)} Buchungen → {a.ziel}")
    if raus_ziel:
        d = sorted(r["arrival"] for r in raus_ziel)
        print(f"Anreisen von {d[0]} bis {d[-1]}")
        ohne = sum(1 for r in raus_ziel if not r["total_amount"])
        if ohne:
            print(f"  ohne Betrag: {ohne} (bleibt leer, kein erfundener Preis)")
        ohne_id = sum(1 for r in raus_ziel if not r["external_id"])
        if ohne_id:
            print(f"  ACHTUNG ohne Buchungsnummer: {ohne_id} — Dedup laeuft dann "
                  f"ueber Objekt+Datum+Name, ein zweiter Upload mit anderer "
                  f"Schreibweise koennte doppelt anlegen")
    if uebersprungen:
        print("Uebersprungen:")
        for k, v in sorted(uebersprungen.items(), key=lambda x: -x[1]):
            print(f"  {v:5}  {k}")
    if umbenennung:
        print("Objektnamen umbenannt (Portal → PMS):")
        for alt, neu in sorted(umbenennung.items()):
            treffer = sum(1 for k in umbenannt if k.lower() == alt)
            # 0 Treffer heisst: die Abbildung greift nicht. Fast immer ein
            # Tippfehler im Portal-Namen — ohne diese Zeile faellt das erst
            # auf, wenn der Import die Buchungen still uebersprungen hat.
            print(f"  {neu!r} ← {alt!r}"
                  + ("" if treffer else "   KEIN TREFFER — Schreibweise pruefen"))
    if unbekannte_objekte:
        print("NICHT zuordenbare Objektnamen (Import wuerde diese Zeilen ablehnen):")
        for k, v in sorted(unbekannte_objekte.items(), key=lambda x: -x[1]):
            print(f"  {v:5}  {k!r}")
        print("  → im Export umbenennen oder --objekte anpassen, DANN importieren")
    if len(raus_ziel) > 1000:
        print(f"HINWEIS: {len(raus_ziel)} Zeilen — der Import nimmt max. 1000 "
              f"je Upload. Datei aufteilen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
