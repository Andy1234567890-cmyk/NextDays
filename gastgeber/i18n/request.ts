// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
//
// Die Sprache kommt aus dem Cookie. Jede Datei in messages/ ist vollständig
// (Prüfung: scripts/i18n/pruefe-uebersetzungen.mjs), deshalb wird die
// Basissprache als Rückfallebene untergelegt statt Keys fehlen zu lassen —
// falls doch einmal ein Key nur in de.json existiert, zeigt die Oberfläche
// deutschen Text statt des rohen Key-Namens.
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";

async function load(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch (fehler) {
    // Eine Sprache steht in LOCALES, aber ihre Datei fehlt oder ist kaputt.
    // Still auf Deutsch zurückzufallen wäre genau die Attrappe, die wir
    // vermeiden: Der Nutzer wählt Japanisch und sieht Deutsch, ohne dass es
    // jemandem auffällt. Deshalb laut werden — im Betrieb sichtbar im Log,
    // in der Entwicklung sofort.
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

  // Flacher Merge genügt nicht: Die Nachrichten sind verschachtelt
  // (konto.*, objektEditor.*). Ein flaches { ...base, ...chosen } würde einen
  // ganzen Bereich der Zielsprache über den deutschen legen und dabei die
  // Keys verlieren, die nur im Deutschen existieren.
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
