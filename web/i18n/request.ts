// next-intl Request-Konfiguration (App Router, ohne URL-Locale-Präfix).
//
// Hier wird pro Anfrage entschieden, in welcher Sprache gerendert wird — und
// zwar SERVERSEITIG, bevor die erste Komponente läuft. Deshalb blitzt nie eine
// falsche Sprache auf, und deshalb trägt `<html lang>` im Root-Layout
// (`getLocale()`) automatisch den richtigen Wert.
//
// Die Reihenfolge der Quellen und ihre Begründung stehen an EINER Stelle:
// `i18n/aufloesung.ts`. Hier wird sie nur angewendet, nicht neu erfunden.
//
// Bis 08/2026 stand hier `isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE`
// — ein stiller Rückfall auf Deutsch für JEDEN ohne Cookie. Ein dänischer
// Eigentümer bekam damit eine dänische Einladungsmail und eine deutsche Seite
// dahinter. Ersetzt durch die volle Kette (Cookie → Token → Accept-Language →
// Englisch).
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { SPRACHE_HEADER, aufloesen } from "./aufloesung";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "./locales";

async function load(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch {
    return {};
  }
}

export default getRequestConfig(async () => {
  const [jar, kopf] = await Promise.all([cookies(), headers()]);

  const locale = aufloesen(
    // 1. Die ausdrückliche Wahl des Betrachters gewinnt immer.
    jar.get(LOCALE_COOKIE)?.value,
    // 2. Die Sprache des Token-Empfängers (Einladung / Passwort neu), von der
    //    Middleware aufgelöst — dieselbe, in der die Mail verschickt wurde.
    kopf.get(SPRACHE_HEADER),
    // 3. Was der Browser des Betrachters angibt.
    kopf.get("accept-language"),
    // 4. Ohne jede Auskunft: Englisch (FALLBACK_LOCALE in aufloesung.ts).
  );

  // Basissprache (DE) als Grundlage, gewählte Sprache überschreibt vorhandene
  // Keys → eine unvollständige Sprache zeigt an der Lücke DE statt eines
  // leeren Strings. Das ist eine Anzeige-Absicherung gegen halb gepflegte
  // Kataloge, KEINE Sprachwahl: `locale` (und damit `<html lang>`) bleibt die
  // aufgelöste Sprache. Die 24 Kataloge sind strukturgleich, der Merge greift
  // im Normalbetrieb also gar nicht.
  const base = await load(DEFAULT_LOCALE);
  const chosen = locale === DEFAULT_LOCALE ? {} : await load(locale);

  return {
    locale,
    messages: { ...base, ...chosen },
  };
});
