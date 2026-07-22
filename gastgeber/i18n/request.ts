// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
// Liest die Sprache aus dem Cookie, DE ist Basis-Merge → fehlende Keys zeigen DE.
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

  const base = await load(DEFAULT_LOCALE);
  const chosen = locale === DEFAULT_LOCALE ? {} : await load(locale);

  return { locale, messages: { ...base, ...chosen } };
});
