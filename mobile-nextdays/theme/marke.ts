// Markenwerte dieser App — die EINZIGE Stelle, an der „myNextDays" als Name,
// Logo, Farbe oder Store-Adresse steht (ADR-0019). Kein Screen verzweigt nach
// Marke; alles kommt über den ThemeProvider aus dieser Datei.
//
// SCHWESTERDATEI: mobile-bestdays/theme/marke.ts — gleiche Struktur, andere
// Werte. Der Typ `Marke` liegt in theme/tokens.ts und wird per CI-diff
// identisch gehalten.
import type { Marke } from "@/theme/tokens";

export const marke: Marke = {
  id: "mynextdays",
  name: "myNextDays",
  // Das Rot stammt aus dem AirSmil-Schriftzug und steckt in BEIDEN Marken-Logos
  // — es ist die Hausfarbe, keine App-eigene Erfindung.
  akzent: "#C42B3A",
  logo: require("@/assets/img/mynextdays-logo.png"),
  logoHell: require("@/assets/img/mynextdays-logo-light.png"),
  andereApp: {
    name: "myBestDays",
    scheme: "mybestdays",
    // Store-Adressen der Schwester-App. Noch nicht veröffentlicht — sobald die
    // IDs feststehen, hier eintragen; bis dahin führt der Fallback auf die
    // Suchseite, statt einen erfundenen Link zu öffnen.
    appStoreUrl: "https://apps.apple.com/search?term=myBestDays",
    playStoreUrl: "https://play.google.com/store/search?q=myBestDays&c=apps",
  },
};
