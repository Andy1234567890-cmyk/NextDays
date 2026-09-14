"""CSV-Kontoauszug lesen: Bytes → Zeilen → Umsatz-Felder.

Reine Funktionen ohne DB, damit sie sich ohne Fake-DB testen lassen. Was hier
gilt (Wurzel 8 — der Upload ist Angreifer-Input):

  * Größen-Cap (MAX_CSV_BYTES) und Zeilen-Cap (MAX_CSV_ROWS) → 413/422.
  * „Magic-Byte"-Prüfung in Gegenrichtung: CSV hat keine Signatur, also
    werden die bekannten Binärsignaturen (PDF, ZIP/XLSX, XLS, PNG, JPEG) und
    NUL-Bytes abgewiesen — ein umbenanntes Excel ist keine CSV.
  * Zeichensatz: `auto` versucht UTF-8 (mit BOM) strikt, danach cp1252 —
    deutsche Bank-Exporte (Sparkasse, VR) kommen fast alle in cp1252. Das ist
    Dekodierung, kein erfundener Fachwert.
  * Betrag: `1.234,56`, `1,234.56`, `-12,00`, `12,00-`, `12,00 S`/`H`,
    Währungszeichen und geschützte Leerzeichen; getrennte Soll/Haben-Spalten.
  * Datum: `dd.mm.yyyy`, `yyyy-mm-dd`, `dd/mm/yyyy`, `dd.mm.yy`, oder ein
    explizites strftime-Format aus dem Request.
Jeder Zeilenfehler wird mit Zeilennummer gemeldet, nie still übersprungen.
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from .schemas import MAX_CSV_BYTES, MAX_CSV_ROWS, CsvMapping

_BINAER_SIGNATUREN: tuple[bytes, ...] = (
    b"%PDF-",
    b"PK\x03\x04",  # ZIP/XLSX/DOCX
    b"\xd0\xcf\x11\xe0",  # XLS/DOC (OLE)
    b"\x89PNG",
    b"\xff\xd8\xff",  # JPEG
    b"GIF8",
    b"\x1f\x8b",  # gzip
)
_DELIMITER_KANDIDATEN = ";,\t|"
_DATUMSFORMATE = ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y", "%d-%m-%Y", "%Y/%m/%d")
_BETRAG_ERLAUBT = re.compile(r"[^0-9,.\-+]")
_SOLL_KENNUNG = re.compile(r"\b(S|SOLL|D|DEBIT)\b", re.IGNORECASE)
_HABEN_KENNUNG = re.compile(r"\b(H|HABEN|C|CREDIT)\b", re.IGNORECASE)
_ZWEI_STELLEN = Decimal("0.01")

# Kopfzeilen-Wörter → Mapping-Feld (Vorschlag für die Oberfläche).
_KOPF_HINWEISE: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("value_date", ("valuta", "wertstellung", "value date", "valutadatum")),
    ("date", ("buchungstag", "buchungsdatum", "datum", "date", "booking date", "dato")),
    ("credit", ("haben", "credit", "gutschrift", "eingang")),
    ("debit", ("soll", "debit", "lastschrift", "ausgang")),
    ("amount", ("betrag", "amount", "umsatz", "beløb", "belopp")),
    (
        "purpose",
        (
            "verwendungszweck",
            "buchungstext",
            "purpose",
            "beschreibung",
            "description",
            "text",
            "tekst",
        ),
    ),
    (
        "name",
        (
            "beguenstigter",
            "begünstigter",
            "zahlungspflichtiger",
            "auftraggeber",
            "empfänger",
            "empfaenger",
            "name",
            "counterpart",
            "gegenkonto",
            "modpart",
        ),
    ),
    ("reference", ("referenz", "reference", "end-to-end", "mandatsreferenz", "kundenreferenz")),
    ("iban", ("iban", "kontonummer")),
    ("currency", ("waehrung", "währung", "currency", "valuta-waehrung")),
)


class CsvFehler(Exception):
    def __init__(self, message: str, *, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class GeleseneZeile:
    """Eine Umsatzzeile nach dem Lesen — noch ohne Konto/Tenant."""

    booking_date: date
    value_date: date | None
    amount: Decimal
    counterpart_name: str | None
    purpose: str | None
    reference: str | None
    counterpart_iban: str | None
    currency: str | None


@dataclass(frozen=True)
class GeleseneDatei:
    delimiter: str
    encoding: str
    header: list[str]
    rows: list[list[str]]


def bytes_pruefen(daten: bytes) -> None:
    if len(daten) > MAX_CSV_BYTES:
        raise CsvFehler("Datei ist größer als 5 MB.", status_code=413)
    if not daten.strip():
        raise CsvFehler("Datei ist leer.")
    kopf = daten[:8192]
    if any(kopf.startswith(sig) for sig in _BINAER_SIGNATUREN) or b"\x00" in kopf:
        raise CsvFehler("Datei ist keine CSV-Datei (Binärinhalt erkannt).")


def dekodieren(daten: bytes, encoding: str) -> tuple[str, str]:
    """→ (Text, verwendeter Zeichensatz)."""
    if encoding != "auto":
        try:
            return daten.decode(encoding), encoding
        except (UnicodeDecodeError, LookupError) as exc:
            raise CsvFehler(f"Datei lässt sich nicht als {encoding} lesen.") from exc
    try:
        return daten.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        return daten.decode("cp1252", errors="strict"), "cp1252"


def trennzeichen_raten(text: str) -> str:
    probe = text[:20000]
    try:
        return csv.Sniffer().sniff(probe, delimiters=_DELIMITER_KANDIDATEN).delimiter
    except csv.Error:
        erste = probe.splitlines()[0] if probe.splitlines() else ""
        zaehlung = {d: erste.count(d) for d in _DELIMITER_KANDIDATEN}
        bestes = max(zaehlung, key=zaehlung.get)  # type: ignore[arg-type]
        return bestes if zaehlung[bestes] > 0 else ";"


def datei_lesen(
    daten: bytes, *, delimiter: str | None, has_header: bool, encoding: str
) -> GeleseneDatei:
    bytes_pruefen(daten)
    text, zeichensatz = dekodieren(daten, encoding)
    trenner = delimiter or trennzeichen_raten(text)
    leser = csv.reader(io.StringIO(text), delimiter=trenner)
    zeilen: list[list[str]] = []
    for zeile in leser:
        if not any(z.strip() for z in zeile):
            continue
        zeilen.append([z.strip() for z in zeile])
        if len(zeilen) > MAX_CSV_ROWS + 1:
            raise CsvFehler(f"Mehr als {MAX_CSV_ROWS} Zeilen — bitte Auszug aufteilen.")
    if not zeilen:
        raise CsvFehler("Keine Datenzeilen gefunden.")
    if has_header:
        header, rows = zeilen[0], zeilen[1:]
    else:
        header = [f"Spalte {i + 1}" for i in range(len(zeilen[0]))]
        rows = zeilen
    return GeleseneDatei(delimiter=trenner, encoding=zeichensatz, header=header, rows=rows)


def mapping_raten(header: list[str]) -> CsvMapping | None:
    gefunden: dict[str, int] = {}
    for idx, name in enumerate(header):
        norm = name.strip().lower()
        if not norm:
            continue
        for feld, hinweise in _KOPF_HINWEISE:
            if feld in gefunden:
                continue
            if any(h in norm for h in hinweise):
                gefunden[feld] = idx
                break
    if "date" not in gefunden:
        return None
    if "amount" not in gefunden and "debit" not in gefunden and "credit" not in gefunden:
        return None
    return CsvMapping(**gefunden)


def betrag_lesen(roh: str, decimal_separator: str) -> Decimal:
    text = roh.replace(" ", " ").strip()
    if not text:
        raise CsvFehler("Betrag fehlt.")
    negativ = False
    if _SOLL_KENNUNG.search(text) and not _HABEN_KENNUNG.search(text):
        negativ = True
    if text.endswith("-"):
        negativ = True
    if text.startswith("(") and text.endswith(")"):
        negativ = True
    ziffern = _BETRAG_ERLAUBT.sub("", text)
    if ziffern.startswith("-"):
        negativ = True
    ziffern = ziffern.strip("+-")
    if not ziffern:
        raise CsvFehler(f"Betrag '{roh}' nicht lesbar.")
    trenner = decimal_separator
    if trenner == "auto":
        if "," in ziffern and "." in ziffern:
            trenner = "," if ziffern.rfind(",") > ziffern.rfind(".") else "."
        elif "," in ziffern:
            trenner = ","
        else:
            trenner = "."
    tausender = "." if trenner == "," else ","
    normal = ziffern.replace(tausender, "").replace(trenner, ".")
    try:
        wert = Decimal(normal)
    except InvalidOperation as exc:
        raise CsvFehler(f"Betrag '{roh}' nicht lesbar.") from exc
    wert = wert.quantize(_ZWEI_STELLEN)
    return -abs(wert) if negativ else wert


def datum_lesen(roh: str, date_format: str | None) -> date:
    text = roh.strip()
    if not text:
        raise CsvFehler("Datum fehlt.")
    formate = (date_format,) if date_format else _DATUMSFORMATE
    for fmt in formate:
        try:
            return datetime.strptime(text[:10] if fmt in _DATUMSFORMATE else text, fmt).date()
        except ValueError:
            continue
    raise CsvFehler(f"Datum '{roh}' nicht lesbar.")


def _spalte(zeile: list[str], idx: int | None) -> str:
    if idx is None:
        return ""
    return zeile[idx] if idx < len(zeile) else ""


def _text(wert: str, maxlen: int = 1000) -> str | None:
    wert = " ".join(wert.split())
    return wert[:maxlen] or None


def zeile_lesen(
    zeile: list[str], mapping: CsvMapping, *, date_format: str | None, decimal_separator: str
) -> GeleseneZeile:
    """Eine Datenzeile → Felder. Wirft CsvFehler mit klarem Text."""
    if mapping.amount is not None:
        betrag = betrag_lesen(_spalte(zeile, mapping.amount), decimal_separator)
    else:
        soll_roh, haben_roh = _spalte(zeile, mapping.debit), _spalte(zeile, mapping.credit)
        soll = -abs(betrag_lesen(soll_roh, decimal_separator)) if soll_roh.strip() else Decimal("0")
        haben = (
            abs(betrag_lesen(haben_roh, decimal_separator)) if haben_roh.strip() else Decimal("0")
        )
        if soll == 0 and haben == 0:
            raise CsvFehler("Weder Soll noch Haben belegt.")
        betrag = soll + haben
    if betrag == 0:
        raise CsvFehler("Betrag ist 0.")
    valuta_roh = _spalte(zeile, mapping.value_date)
    waehrung = _text(_spalte(zeile, mapping.currency), 3)
    return GeleseneZeile(
        booking_date=datum_lesen(_spalte(zeile, mapping.date), date_format),
        value_date=datum_lesen(valuta_roh, date_format) if valuta_roh.strip() else None,
        amount=betrag,
        counterpart_name=_text(_spalte(zeile, mapping.name), 200),
        purpose=_text(_spalte(zeile, mapping.purpose)),
        reference=_text(_spalte(zeile, mapping.reference), 200),
        counterpart_iban=_text(_spalte(zeile, mapping.iban), 34),
        currency=waehrung.upper() if waehrung else None,
    )


def import_hash(
    payment_account_id: str,
    booking_date: date,
    amount: Decimal,
    currency: str,
    counterpart_name: str | None,
    purpose: str | None,
    reference: str | None,
) -> str:
    """sha256 über die Identität eines Umsatzes (0643): derselbe Auszug zweimal
    hochgeladen ergibt denselben Hash → Dublette, keine zweite Buchung."""
    teile = (
        payment_account_id,
        booking_date.isoformat(),
        str(amount.quantize(_ZWEI_STELLEN)),
        currency.upper(),
        " ".join((counterpart_name or "").lower().split()),
        " ".join((purpose or "").lower().split()),
        " ".join((reference or "").lower().split()),
    )
    return hashlib.sha256("|".join(teile).encode("utf-8")).hexdigest()
