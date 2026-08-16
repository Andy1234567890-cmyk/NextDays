// Kurzdatum der Startseiten-Listen. Eigenes Modul, weil es Server- (Karten der
// Startseite) UND Client-Bausteine (die nachladenden Listen) brauchen: eine
// Funktion aus einem `"use client"`-Modul lässt sich serverseitig nicht
// aufrufen, und eine zweite Kopie driftet.
export function fmtDate(iso: string): string {
  // 2026-07-01 → 01.07.26
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}
