// Root-Layout des Gastgeber-Dashboards (Supply-Seite). Eigenständiges Projekt,
// eigene Subdomain host. — eingeloggter Bereich, daher noindex (ADR-0015).
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";

import { textrichtung } from "@/i18n/locales";

import "./globals.css";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

// Titel und Beschreibung sprachabhängig: Sie stehen im Browser-Tab und in der
// Lesezeichenliste — ein fest deutscher Titel wäre dort auch für einen
// japanischen Gastgeber deutsch.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("anmeldeseite");
  return {
    title: t("seitenTitel"),
    description: t("seitenBeschreibung"),
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // `dir` steuert die gesamte Leserichtung: Damit spiegeln die logischen
  // CSS-Eigenschaften (ms-/me-/text-start) das Layout für Arabisch und
  // Hebräisch von selbst. Ohne dieses Attribut bliebe alles links-nach-rechts.
  return (
    <html lang={locale} dir={textrichtung(locale)}>
      <body className="font-sans antialiased">
        {/* Icons lokal registrieren, bevor das erste Icon rendert (0410). */}
        <IconsRegistrieren />
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
