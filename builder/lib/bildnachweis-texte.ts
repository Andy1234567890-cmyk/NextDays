// Die Beschriftungen rund um die Bildnachweise, in den 24 EU-Amtssprachen.
//
// WARUM EIN EIGENER KATALOG UND NICHT `lib/texte.ts`:
// `texte.ts` wird ERZEUGT (scripts/i18n/renderer-texte-erzeugen.py) und ordnet
// Schlüssel und Werte über die POSITION zu. Wer dort von Hand einen Schlüssel
// ergänzt, verliert ihn beim nächsten Lauf des Generators wieder — und wer ihn
// im Generator in der Mitte ergänzt, verschiebt jeden Text dahinter (genau das
// ist am 25.08.2026 passiert, der Generator bricht seither dagegen ab).
// Der Nachweis ist der eine Text, der NICHT still verschwinden darf: fehlt er,
// verstößt die Kundenseite gegen die Unsplash-API-Bedingungen. Deshalb steht er
// in einer Datei, die kein Generator anfasst.
// Der Mechanismus bleibt derselbe wie in `texte.ts`: ein Objekt je Sprache,
// eine Funktion, die dazu nachschlägt, und Englisch als letzter Halt.
//
// WARUM NUR DER RAHMEN ÜBERSETZT IST:
// Unsplash schreibt für die Nennung den Wortlaut `Photo by <Name> on Unsplash`
// vor (Guideline „Attribution"). Ob eine Übersetzung dieses Satzes die
// Bedingungen ebenso erfüllt, steht dort NICHT — die Seite äußert sich zu
// Übersetzungen überhaupt nicht. Eine unbelegte Annahme über eine
// Vertragspflicht ist genau die Sorte erfundener Ersatzwert, die diese
// Codebasis nicht will (Wurzel 4). Also bleibt der Satz selbst englisch
// (`components/blocks/bildnachweis.tsx` setzt ihn aus den Datenfeldern
// zusammen), und übersetzt wird nur, was WIR beisteuern: die Überschrift über
// der Liste am Seitenfuß. Kommt eine belastbare Quelle dazu, ist der Satz hier
// nachzuziehen — nicht vorher.

/** Was der Renderer rund um die Bildnachweise selbst beisteuert. */
export type BildnachweisTexte = {
  /** Überschrift über der Nachweis-Liste in der Fußzeile. */
  ueberschrift: string;
};

const KATALOG: Record<string, BildnachweisTexte> = {
  bg: { ueberschrift: "Фото кредити" },
  cs: { ueberschrift: "Zdroje obrázků" },
  da: { ueberschrift: "Fotokreditering" },
  de: { ueberschrift: "Bildnachweise" },
  el: { ueberschrift: "Πηγές εικόνων" },
  en: { ueberschrift: "Image credits" },
  es: { ueberschrift: "Créditos de imágenes" },
  et: { ueberschrift: "Fotode autorid" },
  fi: { ueberschrift: "Kuvalähteet" },
  fr: { ueberschrift: "Crédits photos" },
  ga: { ueberschrift: "Creidiúintí íomhánna" },
  hr: { ueberschrift: "Izvori fotografija" },
  hu: { ueberschrift: "Képek forrása" },
  it: { ueberschrift: "Crediti fotografici" },
  lt: { ueberschrift: "Nuotraukų autoriai" },
  lv: { ueberschrift: "Attēlu autori" },
  mt: { ueberschrift: "Krediti tar-ritratti" },
  nl: { ueberschrift: "Beeldverantwoording" },
  pl: { ueberschrift: "Autorzy zdjęć" },
  pt: { ueberschrift: "Créditos das imagens" },
  ro: { ueberschrift: "Credite foto" },
  sk: { ueberschrift: "Zdroje obrázkov" },
  sl: { ueberschrift: "Viri slik" },
  sv: { ueberschrift: "Bildkällor" },
};

/** Beschriftungen für eine Sprache. Unbekannte Sprache → Englisch, aus
 *  demselben Grund wie in `lib/texte.ts`: der Fall tritt nur ein, wenn eine
 *  Sprache hinzukommt, für die dieser Katalog noch keinen Eintrag hat. */
export function bildnachweisTexte(sprache: string): BildnachweisTexte {
  return KATALOG[sprache] ?? KATALOG.en!;
}
