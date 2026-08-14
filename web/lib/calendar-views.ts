// Gemeinsame, reine Helfer für die zusätzlichen Kalender-Ansichten
// (Liste, An-/Abreisen, Monatsgitter, Auslastung). Hält die Views frei von
// Duplikat-Logik und nutzt EINE Wahrheit für Status- und Kanal-Darstellung
// (calendar-status / calendar-channels). Keine €-Hardcodes — Beträge formatiert
// jede View über formatCurrency mit der Währung aus den Buchungsdaten.
import type { AvailabilitySource } from "@/lib/calendar";
import { type DisplayStatus, reservationStatus } from "@/lib/calendar-status";
import type { Reservation } from "@/lib/reservations";

// Reservation.channel ist eine Teilmenge von AvailabilitySource (ohne "manual")
// → direkt als Kanal-Quelle für channelMeta() verwendbar.
export function channelSource(res: Reservation): AvailabilitySource {
  return res.channel;
}

// --- Datum (lokal, ohne Zeitzonen-Drift) ------------------------------------
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** YYYY-MM-DD eines Date in lokaler Zeit (wie im Board: kein toISOString-UTC). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** YYYY-MM-DD → Date (lokale Mitternacht, nicht UTC). */
export function parseKey(k: string): Date {
  return new Date(`${k}T00:00:00`);
}

/** Nächte zwischen check_in (inkl.) und check_out (exkl.). Min. 0. */
export function nights(checkIn: string, checkOut: string): number {
  const ms = parseKey(checkOut).getTime() - parseKey(checkIn).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Kurzes Datum „Mi, 26. Jun" aus YYYY-MM-DD, in der Oberflächensprache. */
export function fmtDayShort(k: string, locale: string): string {
  return parseKey(k).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// --- Status-Filter (wiederverwendet die abgeleitete in_house-Logik) ---------
export function displayStatusOf(res: Reservation, todayKey: string): DisplayStatus {
  return reservationStatus(res, todayKey);
}

/** Aktive (nicht stornierte) Reservierung, die [check_in, check_out) den Tag
 *  `dayKey` als Übernachtung enthält (Belegung). Check-out-Tag zählt nicht. */
export function occupiesNight(res: Reservation, dayKey: string): boolean {
  if (res.status === "cancelled") return false;
  return res.check_in <= dayKey && dayKey < res.check_out;
}

// --- Monatsgitter-Balken ----------------------------------------------------
/** Ein Balkenstück in EINER Gitterwoche. Eine Buchung über einen Wochenwechsel
 *  ergibt mehrere Stücke — ein CSS-Grid-Kind kann keine Zeile umbrechen. */
export type BarSegment = {
  res: Reservation;
  /** Spalte 0–6 (Mo–So) innerhalb der Woche. */
  col: number;
  /** Belegte Spalten in dieser Woche (≥ 1). */
  span: number;
  /** Woche 0-basiert ab Gitterstart. */
  week: number;
  /** Anreisetag liegt in diesem Stück → linke Kante abgerundet. */
  startsHere: boolean;
  /** Letzte Nacht liegt in diesem Stück → rechte Kante abgerundet. */
  endsHere: boolean;
};

/**
 * Schneidet Buchungen auf die Wochenzeilen eines Monatsgitters zu.
 *
 * Gezeichnet werden NÄCHTE, nicht Kalendertage: der Abreisetag ist frei
 * (`check_out` exklusiv, wie `occupiesNight`), sonst sähe ein am selben Tag
 * anschließender Gast wie eine Doppelbuchung aus. Buchungen, die komplett
 * ausserhalb des Gitters liegen, fallen raus; überlappende werden gekappt —
 * ein Balken endet an der Gitterkante, statt sie zu überzeichnen.
 */
export function barSegments(
  reservations: Reservation[],
  gridStart: Date,
  weeks: number,
): BarSegment[] {
  const out: BarSegment[] = [];
  const total = weeks * 7;
  const startMs = gridStart.getTime();

  for (const res of reservations) {
    if (res.status === "cancelled") continue;
    const firstNight = parseKey(res.check_in);
    // Letzte Nacht = check_out - 1 Tag. Bei check_in == check_out (0 Nächte)
    // bleibt der Anreisetag als ein Feld sichtbar, statt zu verschwinden.
    const lastNight = addDays(parseKey(res.check_out), -1);
    if (lastNight.getTime() < firstNight.getTime()) continue;

    const from = Math.round((firstNight.getTime() - startMs) / 86_400_000);
    const to = Math.round((lastNight.getTime() - startMs) / 86_400_000);
    if (to < 0 || from >= total) continue;

    const clampedFrom = Math.max(0, from);
    const clampedTo = Math.min(total - 1, to);

    for (let i = clampedFrom; i <= clampedTo; ) {
      const week = Math.floor(i / 7);
      const col = i % 7;
      const weekEnd = week * 7 + 6;
      const segEnd = Math.min(clampedTo, weekEnd);
      out.push({
        res,
        col,
        span: segEnd - i + 1,
        week,
        startsHere: i === from,
        endsHere: segEnd === to,
      });
      i = segEnd + 1;
    }
  }
  return out;
}

// --- Auslastungs-Aggregat (frontend, kein neuer Endpunkt) -------------------
export type OccupancyCell = {
  /** belegte Objekt-Nächte an diesem Tag (0..propertyCount). */
  booked: number;
  /** Auslastung 0..1 = booked / propertyCount. */
  ratio: number;
};

/**
 * Belegung je (Objekt × Tag) und je Tag (Summe über alle Objekte) für das
 * Fenster [start, start+days). Storno wird ignoriert; Check-out-Tag ist frei.
 * Reine Funktion über bereits geladene Reservierungen — keine zusätzlichen
 * Calls, damit die Heatmap aus demselben listReservations()-Resultat lebt.
 */
export function occupancyMatrix(
  reservations: Reservation[],
  propertyIds: string[],
  start: Date,
  days: number,
  // Zusätzlich belegte/gesperrte Tage je Objekt, die NICHT als reservations-Zeile
  // erscheinen (manueller Block, Stop-Sell, OTA-Import über availability). Ohne
  // sie zählte die Heatmap gesperrte Tage fälschlich als „frei" und wies eine zu
  // niedrige Auslastung aus. Map propertyId → Menge belegter ISO-Tage.
  blockedByProp: Record<string, Set<string>> = {},
): {
  /** Tagesschlüssel der Spalten (YYYY-MM-DD), Länge = days. */
  dayKeys: string[];
  /** perProperty[propertyId][dayKey] = true, wenn an dem Tag belegt. */
  perProperty: Record<string, Record<string, boolean>>;
  /** perDay[dayKey] = Anzahl belegter Objekte / Gesamtzahl. */
  perDay: Record<string, OccupancyCell>;
} {
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i += 1) dayKeys.push(dateKey(addDays(start, i)));

  const idSet = new Set(propertyIds);
  const perProperty: Record<string, Record<string, boolean>> = {};
  for (const pid of propertyIds) perProperty[pid] = {};

  const perDayCount: Record<string, number> = {};
  for (const k of dayKeys) perDayCount[k] = 0;

  const markBooked = (pid: string, k: string): void => {
    if (!perProperty[pid][k]) {
      perProperty[pid][k] = true;
      perDayCount[k] += 1;
    }
  };

  // Index-Arithmetik statt Scan über alle Tage: der Zeitraum kann über zwei
  // Jahre laufen (endlos scrollende Auslastung), da wäre res × days zu teuer.
  const startMs = start.getTime();
  const idx = (k: string): number =>
    Math.round((parseKey(k).getTime() - startMs) / 86_400_000);

  for (const res of reservations) {
    if (res.status === "cancelled") continue;
    if (!idSet.has(res.property_id)) continue;
    const from = Math.max(0, idx(res.check_in));
    const to = Math.min(days, idx(res.check_out)); // check_out exklusiv
    for (let i = from; i < to; i += 1) markBooked(res.property_id, dayKeys[i]);
  }

  // Blocks/Stop-Sell/OTA-Belegung (availability=0) ebenfalls als belegt zählen —
  // sonst wirken gesperrte Tage in der Heatmap als „frei".
  for (const pid of propertyIds) {
    const blocked = blockedByProp[pid];
    if (!blocked) continue;
    for (const k of blocked) {
      const i = idx(k);
      if (i >= 0 && i < days) markBooked(pid, dayKeys[i]);
    }
  }

  const total = propertyIds.length;
  const perDay: Record<string, OccupancyCell> = {};
  for (const k of dayKeys) {
    const booked = perDayCount[k];
    perDay[k] = { booked, ratio: total > 0 ? booked / total : 0 };
  }

  return { dayKeys, perProperty, perDay };
}
