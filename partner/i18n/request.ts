// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
// Sprache aus dem nd_locale-Cookie; sonst aus Accept-Language; sonst Englisch.
// Kein Merge mit einer Basissprache: ein fehlender Key soll auffallen.
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, isLocale } from "./locales";

function ausAcceptLanguage(kopf: string | null): Locale | null {
  if (!kopf) return null;
  for (const teil of kopf.split(",")) {
    const code = teil.trim().split(";")[0]?.toLowerCase().split("-")[0];
    if (isLocale(code)) return code;
  }
  return null;
}

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : (ausAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
