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

/** Kurzes deutsches Datum „Mi, 26. Jun" aus YYYY-MM-DD. */
export function fmtDayShort(k: string): string {
  return parseKey(k).toLocaleDateString("de-DE", {
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

  for (const res of reservations) {
    if (res.status === "cancelled") continue;
    if (!idSet.has(res.property_id)) continue;
    for (const k of dayKeys) {
      if (res.check_in <= k && k < res.check_out) markBooked(res.property_id, k);
    }
  }

  // Blocks/Stop-Sell/OTA-Belegung (availability=0) ebenfalls als belegt zählen —
  // sonst wirken gesperrte Tage in der Heatmap als „frei".
  for (const pid of propertyIds) {
    const blocked = blockedByProp[pid];
    if (!blocked) continue;
    for (const k of dayKeys) {
      if (blocked.has(k)) markBooked(pid, k);
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

/**
 * Token-Klasse für eine Auslastungszelle (Heatmap). Stufen statt Farbverlauf,
 * damit Tailwind die Klassen sicher kompiliert (keine arbitrary Werte). Nutzt
 * die Erfolg-/Warn-Tokens des Designsystems.
 */
export function occupancyClass(ratio: number): string {
  if (ratio <= 0) return "bg-secondary";
  if (ratio < 0.25) return "bg-success/20";
  if (ratio < 0.5) return "bg-success/40";
  if (ratio < 0.75) return "bg-success/60";
  if (ratio < 1) return "bg-success/80";
  return "bg-success";
}
