// Die Vorlagen-Kacheln für eine neue Regel (0440).
//
// Hostaway/Duda zeigt beim Anlegen neun Kacheln: Build your own · Popup ·
// Top bar message · Festive effects · 1st visit popup · Newsletter popup ·
// Campaign URL · Off Hours · Return visit popup (live abgelesen aus Dudas
// Produktankündigung, 24.08.2026).
//
// Zwei davon übernehmen wir NICHT unverändert:
//   · „Newsletter popup" setzt einen Newsletter voraus. Wir haben statt dessen
//     „Anfrage-Formular" — das ist der Baustein, den es bei uns wirklich gibt.
//   · „Off Hours" heißt bei Duda „ausserhalb der Geschäftszeiten". Für eine
//     Unterkunft ist das die Zeit, in der niemand ans Telefon geht — deshalb
//     bei uns „Abends und nachts" mit einem Zeitfenster statt einer
//     Geschäftszeiten-Tabelle, die wir nicht führen.
//
// Eine Vorlage ist NUR eine Vorbelegung. Sie legt Auslöser und Aktionsart fest
// und öffnet denselben Assistenten wie „Selbst bauen" — es gibt keinen zweiten
// Weg, auf dem eine Regel entstehen kann.
import type { AktionsArt, Ausloeser } from "@/lib/site-regeln";

export type VorlagenId =
  | "selbst"
  | "popup"
  | "leiste"
  | "effekt"
  | "erstbesuch"
  | "anfrage"
  | "kampagne"
  | "abends"
  | "wiederkehr";

export type Vorlage = {
  id: VorlagenId;
  symbol: string;
  /** Vorbelegte Bedingungen. */
  triggers: Ausloeser;
  /** Vorbelegte Aktionsart. `null` = der Assistent fragt. */
  art: AktionsArt | null;
};

export const VORLAGEN: Vorlage[] = [
  { id: "selbst", symbol: "ph:sliders-horizontal", triggers: {}, art: null },
  { id: "popup", symbol: "ph:browser", triggers: {}, art: "popup" },
  { id: "leiste", symbol: "ph:bell-simple", triggers: {}, art: "top_bar" },
  { id: "effekt", symbol: "ph:sparkle", triggers: {}, art: "effect" },
  {
    id: "erstbesuch",
    symbol: "ph:user-circle-plus",
    triggers: { besuche: { modus: "first" } },
    art: "popup",
  },
  {
    id: "anfrage",
    symbol: "ph:envelope-simple-open",
    triggers: {},
    art: "popup",
  },
  { id: "kampagne", symbol: "ph:link-simple", triggers: {}, art: "popup" },
  {
    id: "abends",
    symbol: "ph:moon",
    // 18:00–08:00 in der Zeitzone des Betriebs. Die Spanne geht über
    // Mitternacht — genau der Fall, den die Auswertung im Renderer eigens
    // behandelt (siehe `lib/regeln.ts`).
    triggers: {
      zeit: {
        ganztags: false,
        von: "18:00",
        bis: "08:00",
        wiederholung: "taeglich",
      },
    },
    art: "top_bar",
  },
  {
    id: "wiederkehr",
    symbol: "ph:arrow-u-up-left",
    triggers: { besuche: { modus: "min", anzahl: 2 } },
    art: "popup",
  },
];

/** Die neun Effekte in der Reihenfolge, in der Duda sie zeigt. */
export const EFFEKTE = [
  "schnee",
  "feuerwerk",
  "blaetter",
  "herzen",
  "sterne",
  "fledermaeuse",
  "ballons",
  "pride",
  "kleeblaetter",
] as const;

/** Die neun Positionen des Pop-up-Rasters, zeilenweise von oben links.
 *
 *  Als 3×3-Gitter wie bei Duda und nicht als Auswahlliste: „unten rechts" ist
 *  eine Stelle im Fenster, und eine Stelle zeigt man, statt sie zu benennen. */
export const POSITIONEN = [
  "oben-links", "oben-mitte", "oben-rechts",
  "mitte-links", "mitte", "mitte-rechts",
  "unten-links", "unten-mitte", "unten-rechts",
] as const;
