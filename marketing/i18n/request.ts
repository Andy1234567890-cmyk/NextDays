// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
// Liest die Sprache aus dem nd_locale-Cookie; unbekannte Werte (z. B. eine
// Sprache, die nur die web-App kennt) fallen auf die Basissprache zurück.
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./locales";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  // Kein Merge mit der Basissprache: in LOCALES stehen nur vollständig
  // übersetzte Sprachen, ein fehlender Key ist also ein Fehler und soll
  // auffallen statt still deutschen Text zu zeigen.
  const messages = (await import(`../messages/${locale}.json`)).default;

  return { locale, messages };
});
