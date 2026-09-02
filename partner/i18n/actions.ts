"use server";

// Sprachwahl: setzt das nd_locale-Cookie (ein Jahr). Der Aufrufer lädt danach
// per router.refresh() neu, damit next-intl die Sprache anwendet.
import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale } from "./locales";

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
