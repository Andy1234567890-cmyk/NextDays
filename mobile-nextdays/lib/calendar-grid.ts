// Monats-Grid-Aufbereitung für den Kalender-Screen (Grid-Ansicht wie das
// Referenz-Mockup: 7 Spalten So–Sa, Tageszahl + Tagespreis je Zelle, Gäste-
// Namensbalken der Buchungen als farbige Pills über die Woche). Reine
// Datenlogik, kein UI — deterministisch, keine erfundenen Werte (Wurzel 4:
// Preis/Currency kommen 1:1 aus den Tagesdaten bzw. bleiben leer).
import { channelMeta } from "@/lib/calendar-channels";
import type { DayAvailability } from "@/lib/calendar";
import type { Reservation } from "@/lib/reservations";

// Lokales YYYY-MM-DD (nie toISOString → UTC-Versatz; P2.1-Fix). Als Schlüssel
// und für die Tageszuordnung; die Belegung eines Tages muss dem lokalen Tag
// entsprechen, sonst zeigt jede Zelle die Belegung des Vortags.
export function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function monthLabel(year: number, month0: number): string {
  const MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  return `${MONTHS[month0]} ${year}`;
}

export type GridCell = {
  iso: string; // YYYY-MM-DD des Tages
  day: number; // Tageszahl (1..31)
  inMonth: boolean; // false = Ausläufer des Vor-/Folgemonats (ausgegraut)
  avail?: DayAvailability; // Tagesdaten (Preis/Status), falls geladen
};

// Ein Belegungsbalken innerhalb EINER Grid-Woche: von Spalte startCol bis
// endCol (0..6, inklusiv), mit Gästename + Kanalfarbe. Buchungen, die über
// einen Wochenwechsel laufen, werden in mehrere Segmente aufgeteilt (jede
// Grid-Zeile bekommt ihr eigenes Segment).
export type BarSegment = {
  reservationId: string;
  label: string; // Gästename (schon maskiert vom Backend)
  bar: string; // Balkenfarbe (Kanal)
  text: string; // Textfarbe
  row: number; // Wochenindex im Grid (0-basiert)
  startCol: number;
  endCol: number;
  clipStart: boolean; // Buchung begann vor diesem Segment (linke Kante offen)
  clipEnd: boolean; // Buchung endet nach diesem Segment (rechte Kante offen)
};

// Baut die 6×7-Zellen eines Monats (immer volle Wochen, So=0-Start). weekStart
// legt fest, an welchem Wochentag die erste Zeile beginnt (0=Sonntag wie das
// Mockup „Sun Mon … Sat").
export function buildMonthCells(
  year: number,
  month0: number,
  availByIso: Map<string, DayAvailability>,
): GridCell[] {
  const first = new Date(year, month0, 1);
  const startOffset = first.getDay(); // 0=So
  const gridStart = addDays(first, -startOffset);

  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(gridStart, i);
    const iso = isoLocal(d);
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month0,
      avail: availByIso.get(iso),
    });
  }
  // Letzte Zeile weglassen, wenn sie komplett im Folgemonat liegt (max 6 Zeilen,
  // oft nur 5) — wie im Mockup, das keine leere Extrazeile zeigt.
  const rows = cells.length / 7;
  const trimmed: GridCell[] = [];
  for (let r = 0; r < rows; r += 1) {
    const rowCells = cells.slice(r * 7, r * 7 + 7);
    if (r >= 4 && rowCells.every((c) => !c.inMonth)) break;
    trimmed.push(...rowCells);
  }
  return trimmed;
}

// Zerlegt die Reservierungen des Objekts in wochen-lokale Balkensegmente für
// dieses Monatsgrid. check_out ist exklusiv (letzte belegte Nacht = check_out-1).
export function buildBarSegments(
  cells: GridCell[],
  reservations: Reservation[],
): BarSegment[] {
  if (cells.length === 0) return [];
  const gridFirst = parseLocal(cells[0].iso);
  const rows = cells.length / 7;
  const gridLast = parseLocal(cells[cells.length - 1].iso);

  const segs: BarSegment[] = [];
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const inStart = parseLocal(r.check_in);
    // letzte belegte Nacht (check_out exklusiv)
    const inEnd = addDays(parseLocal(r.check_out), -1);
    if (inEnd < gridFirst || inStart > gridLast) continue;

    // auf das sichtbare Grid clippen
    const from = inStart < gridFirst ? gridFirst : inStart;
    const to = inEnd > gridLast ? gridLast : inEnd;

    const meta = channelMeta(r.channel);
    const startIdx = dayIndex(gridFirst, from);
    const endIdx = dayIndex(gridFirst, to);

    // pro Grid-Woche ein Segment
    let idx = startIdx;
    while (idx <= endIdx) {
      const row = Math.floor(idx / 7);
      if (row >= rows) break;
      const rowStart = row * 7;
      const rowEnd = rowStart + 6;
      const segEnd = Math.min(endIdx, rowEnd);
      segs.push({
        reservationId: r.id,
        label: r.guest_name,
        bar: meta.bar,
        text: meta.text,
        row,
        startCol: idx - rowStart,
        endCol: segEnd - rowStart,
        clipStart: idx === startIdx ? inStart < gridFirst : true,
        clipEnd: segEnd === endIdx ? inEnd > gridLast : true,
      });
      idx = segEnd + 1;
    }
  }
  return segs;
}

function dayIndex(gridFirst: Date, d: Date): number {
  const ms = d.getTime() - gridFirst.getTime();
  return Math.round(ms / 86_400_000);
}
