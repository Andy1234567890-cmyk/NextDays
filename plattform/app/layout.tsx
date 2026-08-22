// Root-Layout der entkoppelten Plattform-App (myBestDays-Buchungsplattform).
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import "./globals.css";

import { DiagnoseStarter } from "@/components/diagnose-starter";
import { bcp47 } from "@/i18n/locales";
import { VOR_DEM_START } from "@/lib/vorstart";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

// Titel und Beschreibung sprachabhängig: sie stehen im Browser-Tab, im
// Lesezeichen und in der Google-Vorschau — ein fest deutscher Titel wäre auch
// für einen französischen Gast deutsch.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seite");
  // Vor dem Start trägt JEDE Seite `noindex, nofollow` — auch die, die das Tor
  // in der Middleware durchlässt, und auch dann, wenn das Tor umgangen wird
  // (Middleware-Bypass, ADR-0015). Das ist die Sperre, die zählt: sichtbar oder
  // nicht entscheidet das Tor, in den Index kommen entscheidet dieser Tag.
  const robots = VOR_DEM_START
    ? { index: false, follow: false, nocache: true }
    : undefined;
  return { title: t("titel"), description: t("beschreibung"), robots };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={bcp47(locale)}>
      <body className="font-sans antialiased">
        {/* Icons lokal registrieren, bevor das erste Icon rendert (0410). */}
        <IconsRegistrieren />
        {/* Technischer Fehler-Reporter (kein Verhaltens-Tracking). */}
        <DiagnoseStarter />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
