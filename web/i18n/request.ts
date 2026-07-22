// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
// Liest die gewählte Sprache aus dem Cookie, fällt auf die Basissprache zurück.
// Fehlende Keys einer Sprache fallen über `messages`-Merge implizit auf DE
// zurück (DE ist immer vollständig geladen und untergemischt).
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";

async function load(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch {
    return {};
  }
}

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  // Basissprache (DE) als Grundlage, gewählte Sprache überschreibt vorhandene
  // Keys → unvollständige Sprachen zeigen DE statt leerer Strings.
  const base = await load(DEFAULT_LOCALE);
  const chosen = locale === DEFAULT_LOCALE ? {} : await load(locale);

  return {
    locale,
    messages: { ...base, ...chosen },
  };
});
