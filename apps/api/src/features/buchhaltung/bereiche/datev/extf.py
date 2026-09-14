"""EXTF-Format (DATEV-Format, Version 700) — reine Formatierung, keine DB.

Zwei Dateiarten:
  * Buchungsstapel (Formatkategorie 21, Formatversion 13, 125 Felder),
  * Debitoren/Kreditoren (Formatkategorie 16, Formatversion 5) — hier die
    ersten 51 Felder bis einschließlich Bankverbindung 1; DATEV erlaubt es,
    Felder AM ENDE des Datensatzes wegzulassen, solange die Reihenfolge stimmt.

Aufbau jeder Datei:
  Zeile 1  Header (31 Felder): Kennzeichen, Version, Kategorie, Name,
           Formatversion, Erzeugt-am, …, Berater, Mandant, WJ-Beginn,
           Sachkontenlänge, Datum von/bis, Bezeichnung, …, SKR.
  Zeile 2  Feldnamen.
  ab 3     Datensätze.
Trennzeichen `;`, Textfelder in doppelten Anführungszeichen (ein `"` im Text
wird verdoppelt), Zahlen ohne Anführungszeichen mit Dezimal-KOMMA und ohne
Tausenderpunkt, Zeilenende CRLF, Kodierung Windows-1252.

Warum hier alles in EINER Datei und ohne DB: das Format ist der Teil, den ein
Test byteweise prüfen muss (Zeile 1/2 exakt, Dezimalkomma, Soll/Haben,
Kodierung). Der Service sammelt nur die Buchungen und reicht sie hier durch.

Was vom alten KI-Backend (`taskilo-platform/apps/backend/ki/src/integrations/
datev.py`) blieb: die Idee, sonst nichts — dort standen `"EUR"` fest, ein
leerer Header ohne Berater/Mandant/SKR, das Datum wurde aus einem String
geschnitten, und die Kodierung war UTF-8 (DATEV liest Windows-1252).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256

KODIERUNG = "cp1252"
ZEILENENDE = "\r\n"
TRENNER = ";"
VERSION = 700
# Herkunft-Kennzeichen des Stapels (2 Zeichen, Header-Feld 8). Kein Datenwert,
# sondern UNSERE Kennung als erzeugendes System.
HERKUNFT = "MN"

MAX_BUCHUNGSTEXT = 60
MAX_BELEGFELD1 = 36
MAX_BELEGFELD2 = 12
MAX_BEZEICHNUNG = 30
MAX_NAME = 50
MAX_STRASSE = 36
MAX_ORT = 30
MAX_PLZ = 10
MAX_KURZBEZEICHNUNG = 15

# --- Feldlisten ---------------------------------------------------------------

FELDER_BUCHUNGSSTAPEL: tuple[str, ...] = (
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "WKZ Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Skonto",
    "Buchungstext",
    "Postensperre",
    "Diverse Adressnummer",
    "Geschäftspartnerbank",
    "Sachverhalt",
    "Zinssperre",
    "Beleglink",
    *(name for i in range(1, 9) for name in (f"Beleginfo - Art {i}", f"Beleginfo - Inhalt {i}")),
    "KOST1 - Kostenstelle",
    "KOST2 - Kostenstelle",
    "Kost-Menge",
    "EU-Land u. UStID (Bestimmung)",
    "EU-Steuersatz (Bestimmung)",
    "Abw. Versteuerungsart",
    "Sachverhalt L+L",
    "Funktionsergänzung L+L",
    "BU 49 Hauptfunktionstyp",
    "BU 49 Hauptfunktionsnummer",
    "BU 49 Funktionsergänzung",
    *(
        name
        for i in range(1, 21)
        for name in (f"Zusatzinformation - Art {i}", f"Zusatzinformation- Inhalt {i}")
    ),
    "Stück",
    "Gewicht",
    "Zahlweise",
    "Forderungsart",
    "Veranlagungsjahr",
    "Zugeordnete Fälligkeit",
    "Skontotyp",
    "Auftragsnummer",
    "Buchungstyp",
    "USt-Schlüssel (Anzahlungen)",
    "EU-Land (Anzahlungen)",
    "Sachverhalt L+L (Anzahlungen)",
    "EU-Steuersatz (Anzahlungen)",
    "Erlöskonto (Anzahlungen)",
    "Herkunft-Kz",
    "Buchungs GUID",
    "KOST-Datum",
    "SEPA-Mandatsreferenz",
    "Skontosperre",
    "Gesellschaftername",
    "Beteiligtennummer",
    "Identifikationsnummer",
    "Zeichnernummer",
    "Postensperre bis",
    "Bezeichnung SoBil-Sachverhalt",
    "Kennzeichen SoBil-Buchung",
    "Festschreibung",
    "Leistungsdatum",
    "Datum Zuord. Steuerperiode",
    "Fälligkeit",
    "Generalumkehr (GU)",
    "Steuersatz",
    "Land",
    "Abrechnungsreferenz",
    "BVV-Position",
    "EU-Land u. UStID (Ursprung)",
    "EU-Steuersatz (Ursprung)",
    "Abw. Skontokonto",
)
assert len(FELDER_BUCHUNGSSTAPEL) == 125  # noqa: S101 — Formatversion 13

# Index (0-basiert) der Felder, die wir befüllen.
_F_FESTSCHREIBUNG = FELDER_BUCHUNGSSTAPEL.index("Festschreibung")
_F_FAELLIGKEIT = FELDER_BUCHUNGSSTAPEL.index("Fälligkeit")
_F_GUID = FELDER_BUCHUNGSSTAPEL.index("Buchungs GUID")
_F_HERKUNFT_KZ = FELDER_BUCHUNGSSTAPEL.index("Herkunft-Kz")

FELDER_STAMMDATEN: tuple[str, ...] = (
    "Konto",
    "Name (Adressattyp Unternehmen)",
    "Unternehmensgegenstand",
    "Name (Adressattyp natürl. Person)",
    "Vorname (Adressattyp natürl. Person)",
    "Name (Adressattyp keine Angabe)",
    "Adressattyp",
    "Kurzbezeichnung",
    "EU-Land",
    "EU-UStID",
    "Anrede",
    "Titel/Akad. Grad",
    "Adelstitel",
    "Namensvorsatz",
    "Adressart",
    "Straße",
    "Postfach",
    "Postleitzahl",
    "Ort",
    "Land",
    "Versandzusatz",
    "Adresszusatz",
    "Abweichende Anrede",
    "Abw. Zustellbezeichnung 1",
    "Abw. Zustellbezeichnung 2",
    "Kennz. Korrespondenzadresse",
    "Adresse Gültig von",
    "Adresse Gültig bis",
    "Telefon",
    "Bemerkung (Telefon)",
    "Telefon GL",
    "Bemerkung (Telefon GL)",
    "E-Mail",
    "Bemerkung (E-Mail)",
    "Internet",
    "Bemerkung (Internet)",
    "Fax",
    "Bemerkung (Fax)",
    "Sonstige",
    "Bemerkung (Sonstige)",
    "Bankleitzahl 1",
    "Bankbezeichnung 1",
    "Bank-Kontonummer 1",
    "Länderkennzeichen 1",
    "IBAN-Nr. 1",
    "Leerfeld",
    "SWIFT-Code 1",
    "Abw. Kontoinhaber 1",
    "Kennz. Hauptbankverb. 1",
    "Bankverb 1 Gültig von",
    "Bankverb 1 Gültig bis",
)
assert len(FELDER_STAMMDATEN) == 51  # noqa: S101


# --- Datentypen ---------------------------------------------------------------


@dataclass(frozen=True)
class Kopf:
    """Was in Zeile 1 steht — kommt aus `datev_settings` + Anfrage."""

    berater_nummer: int
    mandanten_nummer: int
    wirtschaftsjahr_beginn: date
    sachkontenlaenge: int
    datum_von: date
    datum_bis: date
    bezeichnung: str
    waehrung: str
    kontenrahmen: str  # SKR03 | SKR04
    festschreibung: bool
    erzeugt_am: datetime
    exportiert_von: str = ""


@dataclass(frozen=True)
class Buchung:
    """Eine Zeile des Buchungsstapels. `umsatz` ist immer POSITIV; die Richtung
    steht in `soll_haben` (S = `konto` im Soll, H = `konto` im Haben)."""

    umsatz: Decimal
    soll_haben: str
    waehrung: str
    konto: str
    gegenkonto: str
    bu_schluessel: str
    belegdatum: date
    belegfeld1: str
    buchungstext: str
    belegfeld2: str = ""
    faelligkeit: date | None = None
    festschreibung: bool = False
    guid: str = ""


@dataclass(frozen=True)
class Personenkonto:
    """Eine Zeile Debitoren/Kreditoren."""

    konto: str
    name: str
    ist_unternehmen: bool
    kurzbezeichnung: str = ""
    eu_land: str = ""
    eu_ustid: str = ""
    strasse: str = ""
    plz: str = ""
    ort: str = ""
    land: str = ""
    telefon: str = ""
    email: str = ""


@dataclass
class Ergebnis:
    """Fertige Datei + Hash über die DATENZEILEN (Zeile 3 ff.) — die Kopfzeile
    trägt den Erzeugungszeitpunkt und darf die Idempotenz nicht brechen."""

    inhalt: bytes
    content_hash: str
    anzahl: int
    warnungen: list[str] = field(default_factory=list)


# --- Formatierung -------------------------------------------------------------


def betrag(wert: Decimal) -> str:
    """`1234.5` → `1234,50` — Dezimalkomma, zwei Stellen, kein Tausenderpunkt."""
    return f"{abs(wert):.2f}".replace(".", ",")


def datum_ttmm(wert: date) -> str:
    return wert.strftime("%d%m")


def datum_ttmmjjjj(wert: date) -> str:
    return wert.strftime("%d%m%Y")


def datum_jjjjmmtt(wert: date) -> str:
    return wert.strftime("%Y%m%d")


def _text(wert: str) -> str:
    """Textfeld in Anführungszeichen; ein `"` im Wert wird verdoppelt."""
    return '"' + str(wert).replace('"', '""') + '"'


def _zeile(felder: list[str]) -> str:
    return TRENNER.join(felder) + ZEILENENDE


class _Kuerzer:
    """Kürzt Texte auf die DATEV-Länge und ersetzt Zeichen, die Windows-1252
    nicht kennt — beides nicht still, jede Änderung wird als Warnung notiert."""

    def __init__(self) -> None:
        self.warnungen: list[str] = []

    def __call__(self, wert: str | None, maximum: int, feld: str, kontext: str) -> str:
        text = " ".join(str(wert or "").split())  # Zeilenumbrüche/Mehrfach-Leerzeichen raus
        sauber = text.encode(KODIERUNG, errors="replace").decode(KODIERUNG)
        if sauber != text:
            self.warnungen.append(
                f"{kontext}: Zeichen in '{feld}' sind in Windows-1252 nicht darstellbar "
                "und wurden durch '?' ersetzt."
            )
        if len(sauber) > maximum:
            self.warnungen.append(
                f"{kontext}: '{feld}' wurde von {len(sauber)} auf {maximum} Zeichen gekürzt."
            )
            sauber = sauber[:maximum]
        return sauber


def header(kopf: Kopf, *, kategorie: int, formatname: str, formatversion: int) -> str:
    """Zeile 1 (31 Felder). Für Stammdaten bleiben Buchungstyp,
    Rechnungslegungszweck, Festschreibung und WKZ leer."""
    ist_stapel = kategorie == 21
    skr = kopf.kontenrahmen.removeprefix("SKR")
    felder = [
        _text("EXTF"),  # 1 Kennzeichen
        str(VERSION),  # 2 Versionsnummer
        str(kategorie),  # 3 Formatkategorie
        _text(formatname),  # 4 Formatname
        str(formatversion),  # 5 Formatversion
        kopf.erzeugt_am.strftime("%Y%m%d%H%M%S")
        + f"{kopf.erzeugt_am.microsecond // 1000:03d}",  # 6
        "",  # 7 Importiert
        _text(HERKUNFT),  # 8 Herkunft
        _text(kopf.exportiert_von[:25]),  # 9 Exportiert von
        _text(""),  # 10 Importiert von
        str(kopf.berater_nummer),  # 11
        str(kopf.mandanten_nummer),  # 12
        datum_jjjjmmtt(kopf.wirtschaftsjahr_beginn),  # 13 WJ-Beginn
        str(kopf.sachkontenlaenge),  # 14
        datum_jjjjmmtt(kopf.datum_von) if ist_stapel else "",  # 15
        datum_jjjjmmtt(kopf.datum_bis) if ist_stapel else "",  # 16
        _text(kopf.bezeichnung[:MAX_BEZEICHNUNG]),  # 17
        _text(""),  # 18 Diktatkürzel
        "1" if ist_stapel else "",  # 19 Buchungstyp (1 = Finanzbuchführung)
        "0" if ist_stapel else "",  # 20 Rechnungslegungszweck
        ("1" if kopf.festschreibung else "0") if ist_stapel else "",  # 21 Festschreibung
        _text(kopf.waehrung) if ist_stapel else _text(""),  # 22 WKZ
        "",  # 23 reserviert
        _text(""),  # 24 Derivatskennzeichen
        "",  # 25 reserviert
        "",  # 26 reserviert
        skr,  # 27 Sachkontenrahmen
        "",  # 28 ID der Branchenlösung
        "",  # 29 reserviert
        _text(""),  # 30 reserviert
        _text(""),  # 31 Anwendungsinformation
    ]
    assert len(felder) == 31  # noqa: S101
    return _zeile(felder)


def _buchung_zeile(b: Buchung, k: _Kuerzer) -> str:
    if b.soll_haben not in ("S", "H"):
        raise ValueError(f"Soll/Haben-Kennzeichen '{b.soll_haben}' ist ungültig.")
    if b.umsatz == 0:
        raise ValueError(f"Buchung {b.belegfeld1}: Umsatz 0 ist in DATEV nicht zulässig.")
    kontext = f"Beleg {b.belegfeld1}"
    felder = [""] * len(FELDER_BUCHUNGSSTAPEL)
    felder[0] = betrag(b.umsatz)
    felder[1] = _text(b.soll_haben)
    felder[2] = _text(b.waehrung)
    felder[6] = b.konto
    felder[7] = b.gegenkonto
    felder[8] = _text(b.bu_schluessel)
    felder[9] = datum_ttmm(b.belegdatum)
    felder[10] = _text(k(b.belegfeld1, MAX_BELEGFELD1, "Belegfeld 1", kontext))
    felder[11] = _text(k(b.belegfeld2, MAX_BELEGFELD2, "Belegfeld 2", kontext))
    felder[13] = _text(k(b.buchungstext, MAX_BUCHUNGSTEXT, "Buchungstext", kontext))
    felder[_F_HERKUNFT_KZ] = _text(HERKUNFT)
    felder[_F_GUID] = _text(b.guid)
    felder[_F_FESTSCHREIBUNG] = "1" if b.festschreibung else "0"
    felder[_F_FAELLIGKEIT] = datum_ttmmjjjj(b.faelligkeit) if b.faelligkeit else ""
    return _zeile(felder)


def _hash(datenzeilen: list[str]) -> str:
    h = sha256()
    for z in datenzeilen:
        h.update(z.encode(KODIERUNG, errors="replace"))
    return h.hexdigest()


def buchungsstapel(kopf: Kopf, buchungen: list[Buchung]) -> Ergebnis:
    """Die komplette Buchungsstapel-Datei als Windows-1252-Bytes."""
    k = _Kuerzer()
    datenzeilen = [_buchung_zeile(b, k) for b in buchungen]
    text = (
        header(kopf, kategorie=21, formatname="Buchungsstapel", formatversion=13)
        + _zeile([_text(n) for n in FELDER_BUCHUNGSSTAPEL])
        + "".join(datenzeilen)
    )
    return Ergebnis(
        inhalt=text.encode(KODIERUNG, errors="replace"),
        content_hash=_hash(datenzeilen),
        anzahl=len(buchungen),
        warnungen=k.warnungen,
    )


def _personenkonto_zeile(p: Personenkonto, k: _Kuerzer) -> str:
    kontext = f"Konto {p.konto}"
    felder = [""] * len(FELDER_STAMMDATEN)
    felder[0] = p.konto
    name = k(p.name, MAX_NAME, "Name", kontext)
    if p.ist_unternehmen:
        felder[1] = _text(name)
        felder[6] = "2"  # Adressattyp 2 = Unternehmen
    else:
        felder[3] = _text(name)
        felder[6] = "1"  # 1 = natürliche Person
    felder[7] = _text(
        k(p.kurzbezeichnung or p.name, MAX_KURZBEZEICHNUNG, "Kurzbezeichnung", kontext)
    )
    felder[8] = _text(p.eu_land)
    felder[9] = _text(k(p.eu_ustid, 15, "EU-UStID", kontext))
    felder[14] = _text("STR") if p.strasse else _text("")
    felder[15] = _text(k(p.strasse, MAX_STRASSE, "Straße", kontext))
    felder[17] = _text(k(p.plz, MAX_PLZ, "Postleitzahl", kontext))
    felder[18] = _text(k(p.ort, MAX_ORT, "Ort", kontext))
    felder[19] = _text(p.land)
    felder[28] = _text(k(p.telefon, 60, "Telefon", kontext))
    felder[32] = _text(k(p.email, 60, "E-Mail", kontext))
    return _zeile(felder)


def stammdaten(kopf: Kopf, konten: list[Personenkonto]) -> Ergebnis:
    """Die Debitoren/Kreditoren-Datei als Windows-1252-Bytes."""
    k = _Kuerzer()
    datenzeilen = [_personenkonto_zeile(p, k) for p in konten]
    text = (
        header(kopf, kategorie=16, formatname="Debitoren/Kreditoren", formatversion=5)
        + _zeile([_text(n) for n in FELDER_STAMMDATEN])
        + "".join(datenzeilen)
    )
    return Ergebnis(
        inhalt=text.encode(KODIERUNG, errors="replace"),
        content_hash=_hash(datenzeilen),
        anzahl=len(konten),
        warnungen=k.warnungen,
    )
