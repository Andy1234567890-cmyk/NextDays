// Datums-Rechnen des Multi-Kalenders — bewusst OHNE Server-Abhängigkeit,
// damit Server- und Client-Teile dieselben Funktionen benutzen (`lib/kalender.ts`
// zieht `next/headers` nach und ist im Browser nicht importierbar).
//
// Gerechnet wird auf LOKALEN Kalendertagen, nicht auf UTC: `toISOString()` würde
// in Europa/Kopenhagen den 1. um 00:30 als „31." ausgeben — ein Kalender, der
// den heutigen Tag falsch markiert, ist wertlos.

/** `Date` → `YYYY-MM-DD` in der Zeitzone des Betrachters. */
export function isoTag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` plus n Tage (n darf negativ sein). */
export function tagPlus(iso: string, tage: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoTag(new Date(y, m - 1, d + tage));
}

/** `YYYY-MM-DD` als lokales `Date` (Mitternacht). */
export function alsDatum(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Ganze Tage von `von` bis `bis` (beide `YYYY-MM-DD`), Ergebnis kann negativ sein. */
export function tageZwischen(von: string, bis: string): number {
  const ms = alsDatum(bis).getTime() - alsDatum(von).getTime();
  // Über einen Zeitumstellungs-Tag sind es 23 oder 25 Stunden — runden, sonst
  // fehlt oder doppelt sich im Frühjahr/Herbst genau ein Kalendertag.
  return Math.round(ms / 86_400_000);
}

/** Alle Tage von `start` bis `ende` (exklusiv) als `YYYY-MM-DD`. */
export function tagesReihe(start: string, ende: string): string[] {
  const aus: string[] = [];
  for (let t = start; t < ende; t = tagPlus(t, 1)) aus.push(t);
  return aus;
}

/** Erster Tag des Monats, in dem `iso` liegt. */
export function monatsAnfang(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
