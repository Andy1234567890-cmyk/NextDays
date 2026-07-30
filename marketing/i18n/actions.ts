"use server";

// Server-Action: gewählte Sprache im Cookie speichern. next-intl liest das
// Cookie in i18n/request.ts; ein router.refresh() im Client übernimmt die
// Sprache serverseitig. Gleiches Cookie wie die web-App (nd_locale).
import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale } from "./locales";

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 Jahr
    sameSite: "lax",
  });
}
