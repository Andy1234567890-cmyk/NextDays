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
  // Das Rot der Wortmarke: „Next" und der vordere Chevron stehen in den
  // freigegebenen Figma-Assets auf #B82028 (helle Flächen) bzw. #E24B4A
  // (dunkle Flächen, Negativ-Fassung). Dieser Wert hier ist die Akzentfarbe der
  // OBERFLÄCHE (Knöpfe, Aktivzustände), nicht die Logofarbe — er liegt bewusst
  // zwischen beiden Logo-Rots, damit ein Knopf auf hellem und auf dunklem Grund
  // dieselbe Farbe tragen kann. Die exakten Logofarben stecken in den beiden
  // Vektorvorlagen unter assets/img/ und dürfen nicht von hier abgeleitet werden.
  akzent: "#C42B3A",
  // Die Wortmarke, erzeugt aus den Vektor-Vorlagen assets/img/mnd_lockup.svg
  // (dunkle Schrift, für HELLE Flächen) bzw. mnd_lockup_negativ.svg (weiße
  // Schrift, für DUNKLE Flächen), beide 1960×352.
  logo: require("@/assets/img/mynextdays-logo.png"),
  logoHell: require("@/assets/img/mynextdays-logo-light.png"),
  // Seitenverhältnis der beiden Logo-Dateien (Breite ÷ Höhe). Wer das Logo
  // rendert, rechnet die Breite hieraus statt sie zu schätzen: die Zahl stand
  // früher als „3.87" in zwei Screens und war nach dem Logo-Tausch (245∶44
  // statt 1443∶373) in beiden falsch — das Logo wäre gestaucht erschienen.
  logoRatio: 1960 / 352,
  // Das Betriebs-Dashboard (siehe marketing/README.md).
  webUrl: "https://app.mynextdays.com",
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
