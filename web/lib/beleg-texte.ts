"use server";

// Die Texte des Eigentümer-Belegs in der Sprache DES BELEGS (0604).
//
// WARUM EIN EIGENER LADER: `useTranslations` liefert die Sprache des
// BETRACHTERS. Der Beleg ist aber das Dokument des Eigentümers — René Dahl
// Nielsen (`da`) bekommt seinen Beleg auf Dänisch, auch wenn die Mitarbeiterin,
// die ihn erzeugt, auf Deutsch arbeitet. Die Sprache steht am Statement
// (`statement.language`, Snapshot), und dieser Lader holt genau den
// Namensraum `statementPdf` aus der passenden Sprachdatei.
//
// Serverseitig, weil die Sprachdateien dort liegen und ~1 MB je Sprache wiegen:
// ein dynamischer Import im Browser lüde die ganze Datei für 60 Schlüssel.
// Hier wird nur der Namensraum zurückgegeben.
//
// Kein stiller Rückfall auf eine andere Sprache (Wurzel 4): der Server hat die
// Sprache bereits über `core.mail_sprache` auf einen unterstützten Code
// aufgelöst. Kommt trotzdem ein unbekannter Code an, ist das ein Datenfehler
// und wird laut — ein deutscher Beleg für einen dänischen Eigentümer sähe
// „richtig" aus und wäre genau die Falschaussage, die 0604 beendet.
import { LOCALES, type Locale } from "@/i18n/locales";

export type StatementPdfTexte = Record<string, string>;

function istLocale(wert: string): wert is Locale {
  return (LOCALES as readonly string[]).includes(wert);
}

/** Der Namensraum `statementPdf` der Sprachdatei `<lang>.json` — flach. */
export async function belegTexte(lang: string): Promise<StatementPdfTexte> {
  if (!istLocale(lang)) {
    throw new Error(`Beleg-Sprache ${JSON.stringify(lang)} wird nicht unterstützt.`);
  }
  const messages = (await import(`../messages/${lang}.json`)).default as Record<
    string,
    unknown
  >;
  const block = messages.statementPdf;
  if (!block || typeof block !== "object") {
    // Ein Gate-Fehler, kein Laufzeitfall: `pruefe-uebersetzungen.mjs web`
    // hält alle 24 Dateien strukturgleich. Steht der Block trotzdem nicht da,
    // ist die Datei beschädigt — nicht mit Deutsch übertünchen.
    throw new Error(`Sprachdatei ${lang}.json hat keinen Block "statementPdf".`);
  }
  const out: StatementPdfTexte = {};
  for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
