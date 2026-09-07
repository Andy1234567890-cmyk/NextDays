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
