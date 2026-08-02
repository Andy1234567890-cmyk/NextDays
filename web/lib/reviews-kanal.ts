// Kanal-Code der eigenen Marktplatz-Bewertungen (deckungsgleich mit ota_name).
//
// Eigene Datei, weil `lib/reviews.ts` eine "use server"-Datei ist: dort darf
// NUR Asynchrones exportiert werden. Eine exportierte Konstante bricht dort den
// Build ("Only async functions are allowed to be exported in a 'use server'
// file") — und zwar den ganzen, nicht nur die Bewertungen.
export const MARKETPLACE_CHANNEL = "myBestDays";
