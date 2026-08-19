// Die Telefon-Aufnahmen der myNextDays-App — EINE Liste, aus der alles folgt.
//
// Quelle sind echte Aufnahmen aus der Vorführ-Ansicht der App
// (`mobile-nextdays/assets/Bilder_APP`, iPhone 16 Pro, 1206 × 2622). Sie liegen
// als WebP unter `public/marketing/app-mobil/<motiv>@2x.webp`, auf 860 px
// Breite gerechnet — mehr braucht kein Telefon-Rahmen auf einer Webseite, und
// die PNG-Originale wären zusammen über 6 MB.
//
// Warum eine Liste und kein freier String: ein Tippfehler im Motivnamen soll
// `tsc` brechen, nicht still ein 404-Bild in die Seite stellen (Wurzel 4 —
// kein plausibler Ersatz für fehlende Daten).
//
// Anders als bei den Browser-Aufnahmen (`lib/app-aufnahmen.json`) gibt es hier
// KEINE Sprach- und Themavarianten: es existiert genau eine Aufnahmereihe
// (deutsch, hell). Eine erfundene Variante wäre ein fehlendes Bild.

export const APP_MOTIVE_MOBIL = [
  "uebersicht",
  "kalender",
  "kalender-mehrere",
  "buchungen",
  // Dateiname der Quelle war „Objekt_übersicht.png", die Aufnahme zeigt aber
  // die Buchungsliste — benannt ist hier, was zu sehen ist.
  "buchung-detail",
  "posteingang",
  "nachricht",
  "inserate",
  "login",
] as const;

export type AppMotivMobil = (typeof APP_MOTIVE_MOBIL)[number];

/** Aufnahmemaß der WebP-Dateien (Original 1206 × 2622, auf 860 gerechnet). */
export const APP_MOBIL_BREITE = 860;
export const APP_MOBIL_HOEHE = 1870;

export function appMobilPfad(motiv: AppMotivMobil): string {
  return `/marketing/app-mobil/${motiv}@2x.webp`;
}
