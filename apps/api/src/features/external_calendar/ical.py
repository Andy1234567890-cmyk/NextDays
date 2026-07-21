"""iCalendar-Parser für externe Belegungs-Feeds (Airbnb/Booking/Vrbo/…).

Bewusst KEIN Fremdpaket: die Feeds sind simpel (VEVENT mit DTSTART/DTEND/UID/
SUMMARY, VALUE=DATE). Ein schmaler, getesteter Parser ist robuster als eine
schwergewichtige Lib mit eigenen Zeitzonen-Fallstricken. Wir lesen NUR die für
die Belegung nötigen Felder; alles andere wird ignoriert.

Wichtig: iCal-DTEND ist bei VALUE=DATE EXKLUSIV (der Abreisetag ist NICHT belegt)
— genau die Semantik, die wir für Nächte brauchen (check_out = frei).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass(frozen=True)
class IcalEvent:
    uid: str
    start: date          # erster belegter Tag (inklusiv)
    end: date            # Abreisetag (EXKLUSIV — nicht belegt)
    summary: str         # Gastname (oft maskiert) oder z.B. "Closed Period"

    def nights(self) -> list[date]:
        """Belegte Nächte: start (inkl.) bis end (exkl.). Leere Liste bei
        start >= end (defekter Event) — kein Rateschluss."""
        out: list[date] = []
        d = self.start
        while d < self.end:
            out.append(d)
            d += timedelta(days=1)
        return out


def _unfold(text: str) -> list[str]:
    """RFC 5545 line-unfolding: Fortsetzungszeilen (beginnen mit Space/Tab)
    an die vorige anhängen. Vereinheitlicht CRLF/CR/LF."""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = []
    for line in lines:
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def _parse_ical_date(value: str) -> date | None:
    """DATE (YYYYMMDD) oder DATE-TIME (YYYYMMDDTHHMMSSZ) → date. None bei Müll
    (kein Fallback-Datum erfinden — der Event wird dann verworfen)."""
    value = value.strip()
    if not value:
        return None
    # Nur der Datumsteil zählt (Belegung ist tagesgenau).
    head = value.split("T", 1)[0]
    if len(head) != 8 or not head.isdigit():
        return None
    try:
        return datetime.strptime(head, "%Y%m%d").date()
    except ValueError:
        return None


def _fold(line: str) -> str:
    """RFC 5545 line-folding: Zeilen >75 Oktetts an Zeichengrenzen umbrechen,
    Fortsetzungszeilen mit einem Leerzeichen einleiten. Wir falten grob nach
    Zeichen (unsere Werte sind ASCII-nah) — konservativ bei 73, um mit UTF-8
    Mehrbyte nicht über 75 Oktetts zu geraten."""
    if len(line) <= 75:
        return line
    out = [line[:73]]
    rest = line[73:]
    while rest:
        out.append(" " + rest[:72])
        rest = rest[72:]
    return "\r\n".join(out)


def _escape_text(value: str) -> str:
    """TEXT-Wert nach RFC 5545 escapen (Backslash, Komma, Semikolon, Zeilenumbruch)."""
    return (
        value.replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(";", "\\;")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


@dataclass(frozen=True)
class ExportEvent:
    """Ein belegter Zeitraum für den Export-Feed. `end` ist EXKLUSIV (Abreisetag,
    nicht belegt) — passend zur iCal-DATE-Semantik."""
    uid: str
    start: date
    end: date
    summary: str


def build_ical(
    *, prod_id: str, cal_name: str, events: list[ExportEvent], dtstamp: str
) -> str:
    """Belegungs-Events als iCal-Text (VALUE=DATE, ganztägig) rendern. Enthält
    NUR Zeitraum + neutralen Titel — keine Gast-/Preis-/Stammdaten. `dtstamp`
    wird übergeben (kein Date.now() im Modul), damit die Ausgabe testbar und
    deterministisch bleibt."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//{_escape_text(prod_id)}//iCal Export//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape_text(cal_name)}",
    ]
    for ev in events:
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{_escape_text(ev.uid)}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART;VALUE=DATE:{ev.start.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{ev.end.strftime('%Y%m%d')}",
            f"SUMMARY:{_escape_text(ev.summary)}",
            "TRANSP:OPAQUE",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def parse_ical(text: str) -> list[IcalEvent]:
    """Parst einen iCal-Text zu Belegungs-Events. Defekte/unvollständige VEVENTs
    (fehlendes DTSTART/DTEND/UID, ungültige Daten, start>=end) werden übersprungen
    — NICHT geraten. Duplikate (gleiche UID) werden dedupliziert (letzter gewinnt),
    damit ein Feed mit Wiederholungen keine Doppel-Sperren erzeugt."""
    events: dict[str, IcalEvent] = {}
    cur: dict[str, str] = {}
    in_event = False
    for raw in _unfold(text):
        line = raw.strip()
        if line == "BEGIN:VEVENT":
            in_event = True
            cur = {}
            continue
        if line == "END:VEVENT":
            in_event = False
            uid = cur.get("uid")
            start = _parse_ical_date(cur.get("dtstart", ""))
            end = _parse_ical_date(cur.get("dtend", ""))
            if uid and start and end and start < end:
                events[uid] = IcalEvent(
                    uid=uid, start=start, end=end,
                    summary=cur.get("summary", "").strip(),
                )
            cur = {}
            continue
        if not in_event or ":" not in line:
            continue
        # "NAME;PARAM=x:VALUE" → key vor ';'/':' , value nach dem ersten ':'
        name_part, value = line.split(":", 1)
        key = name_part.split(";", 1)[0].strip().lower()
        if key in ("uid", "dtstart", "dtend", "summary"):
            cur[key] = value
    return list(events.values())
