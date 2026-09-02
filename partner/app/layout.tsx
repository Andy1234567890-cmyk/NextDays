// Root-Layout des Partner-Dashboards (Affiliate-Programm, 0517). Marke:
// myNextDays — der Partner wirbt für das PMS, der Betrieb ist unser Kunde.
// Eingeloggter Bereich → nie indexieren.
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";

import "./globals.css";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("titel"),
    description: t("beschreibung"),
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <IconsRegistrieren />
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
