// ISO-Datums-Helfer (YYYY-MM-DD), bewusst UTC-fixiert: Kalendertage sind
// zeitzonenlos, lokale Zeitzonen dürfen den Tag nicht verschieben.

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoPlus(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO-Wochentag (0=Montag … 6=Sonntag). */
export function isoWeekday(iso: string): number {
  return (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
}
