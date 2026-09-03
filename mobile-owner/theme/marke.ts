// Markenwerte dieser App — die EINZIGE Stelle, an der Name, Logo, Farbe oder
// Store-Adresse steht (ADR-0019/ADR-0022). Kein Screen verzweigt nach Marke;
// alles kommt über den ThemeProvider aus dieser Datei.
//
// Diese App ist die Eigentümer-Sicht von myNextDays — eine eigene App, aber
// KEINE eigene Marke: sie trägt Namen, Wortmarke und Akzent von myNextDays
// (Ansage vom 02.09.2026: „unsere Farben sollten schon erhalten bleiben").
// Übernommen wurde von Smoobu die STRUKTUR (Kennzahl-Widgets, gerahmte Karten,
// Aktionsknopf), nicht die Farbe — Smoobus `#0F62FE` steht bewusst nirgends.
//
// SCHWESTERDATEI-Struktur wie mobile-nextdays/theme/marke.ts und
// mobile-bestdays/theme/marke.ts — gleiche Felder, eigene Werte. Der Typ
// `Marke` liegt in theme/tokens.ts und wird per CI-diff identisch gehalten.
import type { Marke } from "@/theme/tokens";

export const marke: Marke = {
  id: "mynextdays",
  // Der Store-Name lautet „myNextDays Eigentümer" (app.json/displayName). In
  // der Oberfläche steht die Marke, nicht der Zusatz: der Eigentümer weiß, in
  // welcher App er ist, und „myNextDays Eigentümer" in jeder Kopfzeile wäre
  // eine Rollenzuschreibung an jemanden, der sich nicht dafür anmelden musste.
  name: "myNextDays",
  // Identisch zu mobile-nextdays: die Oberflächen-Akzentfarbe der Marke, nicht
  // die Logofarbe (die exakten Logo-Rots #B82028/#E24B4A stecken in den
  // Vektorvorlagen unter assets/img und werden nicht hiervon abgeleitet).
  akzent: "#C42B3A",
  logo: require("@/assets/img/mynextdays-logo.png"),
  logoHell: require("@/assets/img/mynextdays-logo-light.png"),
  logoRatio: 1960 / 352,
  // Das Eigentümer-Portal im Web — dieselbe Rolle, dasselbe Backend.
  webUrl: "https://app.mynextdays.com",
  // Die Schwester-App für den BETRIEB. Ein Eigentümer, der auch verwaltet
  // (eigene Objekte selbst vermietet), springt hierhin; der Sprung ist ein
  // App-Wechsel, keine Navigation (lib/appwechsel.ts).
  andereApp: {
    name: "myNextDays",
    scheme: "mynextdays",
    // Store-Adressen der PMS-App. `com.mynextdays.app` liegt seit dem
    // 31.08.2026 in der Play-Prüfung; solange keine ID feststeht, führt der
    // Fallback auf die Suchseite statt auf einen erfundenen Link (Wurzel 4).
    appStoreUrl: "https://apps.apple.com/search?term=myNextDays",
    playStoreUrl: "https://play.google.com/store/search?q=myNextDays&c=apps",
  },
};
