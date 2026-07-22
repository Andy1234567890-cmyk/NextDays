// Root-Layout des Gastgeber-Dashboards (Supply-Seite). Eigenständiges Projekt,
// eigene Subdomain host. — eingeloggter Bereich, daher noindex (ADR-0015).
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "myNextDays — Gastgeber",
  description: "Verwalte deine Objekte, Kalender, Preise und Buchungen.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
