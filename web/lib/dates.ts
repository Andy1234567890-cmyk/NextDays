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

/** ISO-8601-Kalenderwoche (1–53) eines Kalendertags.
 *
 *  ISO-8601 und nicht die US-Zählung: Woche 1 ist die Woche mit dem ersten
 *  Donnerstag des Jahres, die Woche beginnt am Montag. Das ist die Zählung, die
 *  in Dänemark, Deutschland und dem übrigen EU-Raum auf jedem Kalender steht —
 *  ein Eigentümer, der „Woche 27" sagt, meint diese. Die US-Variante (Woche 1 =
 *  die Woche mit dem 1. Januar, Sonntag als Wochenanfang) läge an
 *  Jahreswechseln um eine Woche daneben, und zwar nur dort: ein Fehler, der elf
 *  Monate im Jahr unsichtbar ist.
 *
 *  Der Donnerstags-Trick ist die übliche Umsetzung: vom gegebenen Tag auf den
 *  Donnerstag DERSELBEN ISO-Woche springen, dann zählen, der wievielte Sieben-
 *  Tage-Block seit dem 1. Januar das ist. Damit ist auch der Jahreswechsel
 *  richtig — der 31.12.2026 liegt in Woche 53, der 01.01.2027 ebenfalls.
 */
export function isoKalenderwoche(iso: string): number {
  const d = new Date(iso + "T00:00:00Z");
  // `getUTCDay()` gibt Sonntag als 0; ISO braucht ihn als 7.
  const wochentag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wochentag);
  const jahresanfang = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((d.getTime() - jahresanfang.getTime()) / 86_400_000 + 1) / 7,
  );
}

/** Lokaler Kalendertag als YYYY-MM-DD — OHNE `toISOString()`.
 *
 *  `new Date(jahr, monat, 1).toISOString()` gibt den Tag in UTC aus: lokale
 *  Mitternacht des 1. September in Kopenhagen (UTC+2) ist in UTC noch der
 *  31. August. Live am 07.09.2026: die Monatsvorbelegung der Eigentümer-
 *  Abrechnung stand auf 31.08.–29.09. statt 01.09.–30.09., und für ein Objekt
 *  ohne Anreise in diesen Tagen war die Abrechnung „alles leer". Für
 *  Kalendertage, die aus LOKALEN Bestandteilen gebaut werden, gilt darum
 *  dieser Formatierer; die UTC-Helfer oben bleiben für ISO-Strings. */
export function lokalIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/** Erster Tag des laufenden Monats (lokal). */
export function monatsAnfangIso(jetzt: Date = new Date()): string {
  return lokalIso(new Date(jetzt.getFullYear(), jetzt.getMonth(), 1));
}

/** Letzter Tag des laufenden Monats (lokal). */
export function monatsEndeIso(jetzt: Date = new Date()): string {
  return lokalIso(new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 0));
}
