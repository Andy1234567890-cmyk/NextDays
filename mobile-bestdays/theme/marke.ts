// Markenwerte dieser App — die EINZIGE Stelle, an der „myBestDays" als Name,
// Logo, Farbe oder Store-Adresse steht (ADR-0019). Kein Screen verzweigt nach
// Marke; alles kommt über den ThemeProvider aus dieser Datei.
//
// SCHWESTERDATEI: mobile-nextdays/theme/marke.ts — gleiche Struktur, andere
// Werte. Der Typ `Marke` liegt in theme/tokens.ts und wird per CI-diff
// identisch gehalten.
import type { Marke } from "@/theme/tokens";

export const marke: Marke = {
  id: "mybestdays",
  name: "myBestDays",
  // Das Rot stammt aus dem AirSmil-Schriftzug und steckt in BEIDEN Marken-Logos
  // — es ist die Hausfarbe, keine App-eigene Erfindung.
  akzent: "#C42B3A",
  logo: require("@/assets/img/mybestdays-logo.png"),
  logoHell: require("@/assets/img/mybestdays-logo-light.png"),
  // Seitenverhältnis der beiden Logo-Dateien. GEMESSEN (sips), nicht geschätzt:
  // beide sind 1461×403. Hier stand 1461/578 — das Logo wäre um 43 % gestaucht
  // erschienen, sobald jemand die Breite hieraus rechnet. Bis zum animierten
  // Splash (09.09.2026) las den Wert in dieser App niemand, der Fehler blieb
  // deshalb unsichtbar.
  logoRatio: 1461 / 403,
  // Der Marktplatz im Web.
  webUrl: "https://mybestdays.dk",
  andereApp: {
    name: "myNextDays",
    scheme: "mynextdays",
    // Store-Adressen der Schwester-App. Noch nicht veröffentlicht — sobald die
    // IDs feststehen, hier eintragen; bis dahin führt der Fallback auf die
    // Suchseite, statt einen erfundenen Link zu öffnen.
    appStoreUrl: "https://apps.apple.com/search?term=myNextDays",
    playStoreUrl: "https://play.google.com/store/search?q=myNextDays&c=apps",
  },
};
