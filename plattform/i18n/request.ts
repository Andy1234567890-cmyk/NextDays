// next-intl Request-Konfiguration der Gast-Seite (App Router, ohne URL-Präfix).
//
// Die Sprache kommt aus dem Cookie (Auswahl im Globus-Menü der Kopfzeile). Die
// Basissprache wird untergelegt, damit ein Key, der nur in de.json existiert,
// deutschen Text zeigt statt des rohen Key-Namens — dasselbe Muster wie im
// Gastgeber-Dashboard (gastgeber/i18n/request.ts).
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";

/** Eine Sprachdatei laden.
 *
 *  Exportiert, weil die Vorab-Seite (app/demnaechst) sie ebenfalls braucht: sie
 *  wird per `rewrite` ausgeliefert und waehlt ihre Sprache aus `Accept-Language`
 *  statt aus dem Cookie, kann also nicht ueber `getTranslations` gehen. Ein
 *  zweiter, eigener `import()`-Pfad dort hat den Docker-Build zerrissen — der
 *  relative Pfad stimmte aus einer anderen Verzeichnistiefe nicht mehr, und
 *  `tsc` sieht das bei einem dynamischen Template-Import nicht. Deshalb EINE
 *  Ladefunktion an EINER Stelle. */
export async function load(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch (fehler) {
    // Eine Sprache steht in LOCALES, ihre Datei fehlt oder ist kaputt. Still auf
    // Deutsch zurückzufallen wäre die Attrappe: der Gast wählt Polnisch und
    // sieht Deutsch, ohne dass es auffällt. Deshalb laut werden.
    console.error(`[i18n] Sprachdatei ${locale}.json nicht ladbar:`, fehler);
    return {};
  }
}

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const base = await load(DEFAULT_LOCALE);
  const chosen = locale === DEFAULT_LOCALE ? {} : await load(locale);

  // Tiefer Merge: die Nachrichten sind verschachtelt (inserat.*, checkout.*,
  // amenities.*). Ein flaches Überschreiben würde einen ganzen Bereich der
  // Zielsprache über den deutschen legen und dabei Keys verlieren.
  return { locale, messages: mischeTief(base, chosen) };
});

/** Verschachtelte Nachrichten zusammenführen: Zielsprache gewinnt, Deutsch
 *  füllt Lücken. */
function mischeTief(
  basis: Record<string, unknown>,
  oben: Record<string, unknown>,
): Record<string, unknown> {
  const raus: Record<string, unknown> = { ...basis };
  for (const [schluessel, wert] of Object.entries(oben)) {
    const vorhanden = raus[schluessel];
    raus[schluessel] =
      istObjekt(vorhanden) && istObjekt(wert)
        ? mischeTief(vorhanden, wert)
        : wert;
  }
  return raus;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}
