// Zeilenweise Zusammenführung von laufendem Zeitraum und Vorzeitraum.
//
// DAS PROBLEM, das sie löst: eine Tabelle hat je Zeitraum eine ANDERE
// Zeilenmenge. Ein Kanal, über den 2025 verkauft wurde und heute nicht mehr,
// steht nur im Vorjahr; ein Objekt, das erst dieses Jahr dazukam, nur in der
// Gegenwart. Ein naives `map` über die aktuellen Zeilen ließe die erste
// Gruppe stillschweigend verschwinden — der Betrieb sähe nicht, dass ein
// Kanal weggefallen ist, und genau das ist die Frage, die ein
// Vorjahresvergleich beantworten soll.
//
// Deshalb: Vereinigungsmenge über den Schlüssel, jede Seite darf `null` sein.
//
// Eigene Datei ohne `"use server"`: `lib/auswertung.ts` ist ein
// Server-Actions-Modul und darf ausschließlich async functions exportieren.

/** Eine Zeile, die es in einem der beiden Zeiträume geben kann. */
export type VergleichsZeile<T> = {
  key: string;
  /** `null`, wenn es diese Zeile im laufenden Zeitraum nicht (mehr) gibt. */
  jetzt: T | null;
  /** `null`, wenn es sie im Vorzeitraum noch nicht gab. */
  vorher: T | null;
};

/**
 * Zwei Zeilenmengen über einen Schlüssel zusammenführen.
 *
 * Die Reihenfolge folgt `jetzt` — die Gegenwart ist die Hauptaussage. Zeilen,
 * die es nur im Vorzeitraum gibt, hängen hinten an, damit sie sichtbar sind,
 * ohne die gewohnte Sortierung der aktuellen Tabelle zu stören.
 */
export function zeilenVereinen<T>(
  jetzt: readonly T[],
  vorher: readonly T[] | undefined | null,
  schluessel: (zeile: T) => string,
): VergleichsZeile<T>[] {
  const vorherNachKey = new Map<string, T>();
  for (const z of vorher ?? []) vorherNachKey.set(schluessel(z), z);

  const zeilen: VergleichsZeile<T>[] = jetzt.map((z) => {
    const key = schluessel(z);
    const gegen = vorherNachKey.get(key) ?? null;
    vorherNachKey.delete(key);
    return { key, jetzt: z, vorher: gegen };
  });

  // Was übrig bleibt, gab es NUR früher.
  for (const [key, z] of vorherNachKey) {
    zeilen.push({ key, jetzt: null, vorher: z });
  }
  return zeilen;
}


/**
 * Derselbe Kalendertag, `jahre` Jahre früher — SCHWESTERFUNKTION zu
 * `core.zeitraum.jahre_datumsgleich` (apps/api).
 *
 * Nur zur ANZEIGE („Vergleich mit 31.08.–29.09.2025"): gerechnet wird immer
 * im Backend. Sie muss trotzdem dieselbe Regel tragen, sonst nennt die
 * Überschrift ein anderes Datum als das, worüber gerechnet wurde — und
 * niemand käme auf die Idee, das zu prüfen.
 *
 * Der 29.02. wird auf den 28.02. gelegt (nicht 01.03.), damit er im selben
 * Monat bleibt. `Date` in JS rollt von sich aus auf den 01.03. über, deshalb
 * die ausdrückliche Prüfung.
 *
 * `iso` ist ein Datum als `YYYY-MM-DD`; das Ergebnis ebenso.
 */
export function jahreZurueck(iso: string, jahre: number): string {
  if (!jahre) return iso;
  const [j, m, tag] = iso.split("-").map(Number);
  if (!j || !m || !tag) return iso;
  const zielJahr = j - jahre;
  // Monat ist 1-basiert im ISO-String, `Date` erwartet 0-basiert.
  const letzterTag = new Date(Date.UTC(zielJahr, m, 0)).getUTCDate();
  const zielTag = Math.min(tag, letzterTag);
  const zz = (n: number) => String(n).padStart(2, "0");
  return `${zielJahr}-${zz(m)}-${zz(zielTag)}`;
}
