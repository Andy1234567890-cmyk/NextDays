// SCHWESTERDATEI: mobile-bestdays/lib/rechtliches.ts — muss byte-identisch
// bleiben (CI-Job `mobile-konsistenz`). Die Rechtsdokumente gelten für BEIDE
// Marken, weil dahinter EIN Anbieter steht; eine App-eigene Kopie würde
// auseinanderlaufen, und ein Impressum, das an einer Stelle veraltet ist, ist
// ein Rechtsmangel.
//
// WARUM DAS IN DER APP SEIN MUSS:
//   * Apple App Review 5.1.1(i): Link zur Datenschutzerklärung „within the app
//     in an easily accessible manner" — nicht nur in den Store-Metadaten.
//   * Dänisches E-handelslov §§ 7–12: Firmenname, CVR-Nummer, Adresse, E-Mail
//     und Telefon müssen erreichbar sein, BEVOR ein Vertrag zustande kommt.
//
// Die Texte selbst liegen im Web (`marketing/app/...`) und werden dort gepflegt.
// Sie in die App zu kopieren hieße, dieselben Dokumente an zwei Stellen aktuell
// zu halten — genau die Doppelpflege, an der Rechtstexte veralten. Die App
// verweist deshalb, statt zu duplizieren.

/** Basis der Marketing-Domain. Hier liegen alle Rechtsdokumente. */
const BASIS = "https://www.mynextdays.com";

/**
 * Anbieterdaten — gespiegelt aus `marketing/content/legal/anbieter.ts`, geprüft
 * gegen das dänische Zentralregister (CVR 46615182).
 *
 * Bewusst in der App vorhanden und nicht nur verlinkt: die Pflichtangaben müssen
 * auch OHNE Netz lesbar sein. Ein Impressum, das nur ein Link ist, fehlt genau
 * dann, wenn jemand es braucht.
 *
 * `ustId` fehlt absichtlich: die Momsregistrierung liegt noch nicht vor, und
 * § 7 E-handelslov verlangt die Nummer nur, wenn sie existiert. Eine erfundene
 * Nummer wäre schlimmer als keine (Wurzel 4).
 */
export const ANBIETER = {
  firma: "myNextDays ApS",
  strasse: "Hirtshalsvej 21",
  ort: "9881 Bindslev",
  land: "Dänemark",
  cvr: "46615182",
  email: "info@mynextdays.dk",
  telefon: "+45 43 16 70 40",
  telefonE164: "+4543167040",
} as const;

export type RechtsDokument = {
  /** Kurzer Titel für die Zeile. */
  titel: string;
  /** Ein Satz, was drinsteht — damit man nicht raten muss, was man öffnet. */
  hinweis: string;
  url: string;
};

/**
 * Die Dokumente in der Reihenfolge, in der sie gebraucht werden: erst was mit
 * den eigenen Daten passiert, dann die Vertragsbedingungen, dann die
 * Anbieterkennzeichnung.
 */
export const RECHTSDOKUMENTE: RechtsDokument[] = [
  {
    titel: "Datenschutzerklärung",
    hinweis: "Welche Daten wir verarbeiten, wozu und wie lange",
    url: `${BASIS}/datenschutz`,
  },
  {
    titel: "Nutzungsbedingungen",
    hinweis: "Die Bedingungen, unter denen der Dienst bereitgestellt wird",
    url: `${BASIS}/agb`,
  },
  {
    titel: "Auftragsverarbeitung",
    hinweis: "Vereinbarung für Gastdaten, die wir im Auftrag verarbeiten",
    url: `${BASIS}/auftragsverarbeitung`,
  },
  {
    titel: "Cookie-Richtlinie",
    hinweis: "Was auf der Website gesetzt wird",
    url: `${BASIS}/cookie-richtlinie`,
  },
  {
    titel: "Impressum",
    hinweis: "Anbieter, Register und Kontakt",
    url: `${BASIS}/impressum`,
  },
];

/** Die Anbieterzeilen für die Anzeige in der App (Pflichtangaben, offline). */
export function anbieterZeilen(): string[] {
  return [
    ANBIETER.firma,
    `${ANBIETER.strasse}, ${ANBIETER.ort}`,
    ANBIETER.land,
    `CVR-nr. ${ANBIETER.cvr}`,
  ];
}
