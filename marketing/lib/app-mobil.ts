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
// KEINE Sprach- und Themavarianten: es existiert je Motiv genau eine Aufnahme
// (deutsch, hell). Eine erfundene Variante wäre ein fehlendes Bild.
//
// Die Liste führt ZWEI Apps (ADR-0019/0022): die PMS-App `mobile-nextdays`
// (Betrieb) und die Eigentümer-App `mobile-owner` — Motive mit `owner-`.
// Sie stehen bewusst in EINER Liste, weil beide denselben Telefon-Rahmen und
// dieselbe Anzeigelogik nutzen; getrennt wird über den Namen, nicht über eine
// zweite Datei mit denselben drei Funktionen. Wer ein Motiv der falschen App
// auf eine Seite setzt, sieht es sofort — die Oberflächen sind verschieden.

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
  // --- Eigentümer-App (`mobile-owner`, iPhone 17, 09.09.2026) ---------------
  // Die Chat-Ansicht der App liegt als Aufnahme vor, steht hier aber NICHT:
  // sie trägt noch die Zeile „Ende-zu-Ende verschlüsselt", während der Chat
  // seit dem Umbau serverseitig verschlüsselt. Ein überholtes
  // Sicherheitsversprechen auf einer Marketingseite ist teurer als ein Bild
  // weniger — sie kommt zurück, sobald die App neu aufgenommen ist.
  "owner-finanzen",
  "owner-abrechnungen",
  "owner-beleg",
  "owner-kalender",
  "owner-buchen",
  "owner-auslastung",
  "owner-objekte",
  "owner-objekt",
] as const;

export type AppMotivMobil = (typeof APP_MOTIVE_MOBIL)[number];

/** Aufnahmemaß der WebP-Dateien (Original 1206 × 2622, auf 860 gerechnet). */
export const APP_MOBIL_BREITE = 860;
export const APP_MOBIL_HOEHE = 1870;

export function appMobilPfad(motiv: AppMotivMobil): string {
  return `/marketing/app-mobil/${motiv}@2x.webp`;
}

// --- Store-Links -------------------------------------------------------------
//
// EINE Quelle für beide Anzeigestellen (Footer und Funktions-Held). Vorher
// standen die Knöpfe zweimal als `<span>` ohne Link im Code, mit dem Vermerk
// „die Apps stehen noch nicht in den Stores" — seit dem 08.09.2026 stimmt das
// für Android nicht mehr.
//
// `null` heißt: die App ist in diesem Store NICHT verfügbar, der Knopf bleibt
// ein `<span>` ohne Link. Ein toter Store-Link wäre ein Versprechen, das die
// Seite nicht hält (Wurzel 4 — kein plausibler Ersatz für etwas, das fehlt).
// Die Kennung ist die `applicationId` aus
// `mobile-nextdays/android/app/build.gradle`.
export const APP_STORE_LINKS = {
  google: "https://play.google.com/store/apps/details?id=com.mynextdays.app",
  // iOS liegt noch in der Prüfung — hier die Adresse eintragen, sobald die
  // App im App Store steht, dann verlinkt der Knopf von selbst.
  apple: null,
} as const satisfies Record<"google" | "apple", string | null>;

/** Store-Links der EIGENTÜMER-App (`mobile-owner`, `com.mynextdays.owner`).
 *
 *  Eine eigene App mit eigener Kennung (ADR-0022), also eigene Adressen —
 *  nicht dieselben wie oben. Beide stehen auf `null`: die App ist in keinem
 *  Store veröffentlicht. Sobald sie es ist, hier eintragen; bis dahin zeigt
 *  die Eigentümer-Seite die Knöpfe ohne Link, statt auf eine fremde App zu
 *  verweisen (Wurzel 4). */
export const OWNER_STORE_LINKS = {
  google: null,
  apple: null,
} as const satisfies Record<"google" | "apple", string | null>;

/** Die beiden Store-Knöpfe in Anzeigereihenfolge — Symbol und Beschriftung
 *  gehören zur Marke des Stores und werden NICHT übersetzt. Eine Liste, damit
 *  Footer und Funktions-Held nicht auseinanderlaufen. */
export const STORE_KNOEPFE = [
  { store: "apple", icon: "ph:apple-logo-fill", label: "App Store" },
  { store: "google", icon: "ph:google-play-logo-fill", label: "Google Play" },
] as const satisfies readonly {
  store: keyof typeof APP_STORE_LINKS;
  icon: string;
  label: string;
}[];
