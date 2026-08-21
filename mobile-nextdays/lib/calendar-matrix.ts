// Matrix-Kalender: Objekte als Zeilen, Tage als Spalten (Referenz-Mockup
// „Calendar"-Grid). Reine Datenlogik — Tagesspalten für einen Zeitraum und, je
// Objekt, zusammenhängende Buchungs-Runs (kanalgefärbt wie die Monatsansicht).
// Preise/Belegung pro (Objekt,Tag) kommen aus dem Board-Contract. Kein
// Fallback-Wert: fehlt ein Preis, bleibt die Zelle leer (Wurzel 4).
import { channelMeta } from "@/lib/calendar-channels";
import type { DayAvailability } from "@/lib/calendar";
import { addDays, isoLocal, parseLocal } from "@/lib/calendar-grid";
import type { Reservation } from "@/lib/reservations";

export type MatrixDay = {
  iso: string; // YYYY-MM-DD
  dow: number; // 0=So … 6=Sa
  dom: number; // Tag im Monat
  isToday: boolean;
};

// Ein zusammenhängender Buchungs-Balken in EINER Objektzeile, in Spalten-Indizes
// des sichtbaren Fensters (start..end inklusive der letzten belegten Nacht).
export type MatrixBar = {
  reservationId: string;
  label: string;
  bar: string; // Balkenfarbe (Kanal)
  text: string; // Textfarbe
  startCol: number;
  endCol: number;
  clipStart: boolean; // Buchung beginnt vor dem Fenster
  clipEnd: boolean; // Buchung endet nach dem Fenster
  // Halbtags-Versatz wie im Web (`calendar-board.tsx`, HALF_DAY): der Balken
  // beginnt in der MITTE des Anreisetags und laeuft bis zur MITTE des
  // Abreisetags. Nur so teilen zwei Buchungen den Wechseltag sichtbar — ohne
  // das sass die Anreise auf einer ganzen Spalte, und ein Wechseltag sah aus
  // wie eine Doppelbelegung (live gesehen 20.08.2026).
  // Am Fensterrand bleibt der Balken bündig: ein Versatz ins Leere täuschte
  // eine Anreise vor, die ausserhalb liegt.
  halbStart: boolean; // Anreisetag liegt IM Fenster → ab Spaltenmitte
  halbEnde: boolean; // Abreisetag liegt IM Fenster → bis Spaltenmitte
};

/** Halbtags-Versatz in Spaltenbreiten. Eine Quelle, wie HALF_DAY im Web. */
export const HALBER_TAG = 0.5;

/** Tagesspalten für [start, end] (beide inklusive), heutiger Tag markiert. */
export function buildMatrixDays(start: string, end: string, todayIso: string): MatrixDay[] {
  const first = parseLocal(start);
  const last = parseLocal(end);
  const days: MatrixDay[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const iso = isoLocal(d);
    days.push({ iso, dow: d.getDay(), dom: d.getDate(), isToday: iso === todayIso });
  }
  return days;
}

/** Belegungs-Index (iso → DayAvailability) für schnellen Zellen-Zugriff. */
export function availIndex(days: DayAvailability[]): Map<string, DayAvailability> {
  const m = new Map<string, DayAvailability>();
  for (const d of days) m.set(d.date, d);
  return m;
}

/**
 * Buchungs-Balken einer Objektzeile im sichtbaren Fenster. Storno wird
 * ausgelassen; check_out ist exklusiv (letzte belegte Nacht = check_out − 1).
 */
export function buildRowBars(
  reservations: Reservation[],
  windowDays: MatrixDay[],
): MatrixBar[] {
  if (windowDays.length === 0) return [];
  const first = parseLocal(windowDays[0].iso);
  const last = parseLocal(windowDays[windowDays.length - 1].iso);
  const colOf = (d: Date) =>
    Math.round((d.getTime() - first.getTime()) / 86_400_000);

  const bars: MatrixBar[] = [];
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const inStart = parseLocal(r.check_in);
    const inEnd = addDays(parseLocal(r.check_out), -1); // letzte Nacht
    if (inEnd < first || inStart > last) continue;

    const from = inStart < first ? first : inStart;
    const to = inEnd > last ? last : inEnd;
    const meta = channelMeta(r.channel);
    // Der Abreisetag ist check_out (die Nacht davor ist die letzte belegte).
    // Er zaehlt nur, wenn er noch INS Fenster fällt — sonst laeuft der Balken
    // bis zum Rand durch.
    const abreise = parseLocal(r.check_out);
    bars.push({
      reservationId: r.id,
      label: r.guest_name,
      bar: meta.bar,
      text: meta.text,
      startCol: colOf(from),
      endCol: colOf(to),
      clipStart: inStart < first,
      clipEnd: inEnd > last,
      halbStart: inStart >= first,
      halbEnde: abreise <= last,
    });
  }
  return bars;
}
