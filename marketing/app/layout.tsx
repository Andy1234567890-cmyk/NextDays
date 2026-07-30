// Root-Layout der Marketing-App: Schriften (lokal), globale Styles und
// next-intl-Provider. Die Sprache kommt aus dem nd_locale-Cookie
// (i18n/request.ts) und landet auch im lang-Attribut des <html>.
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import "./globals.css";

import type { Metadata } from "next";

// Schriften liegen LOKAL im Repo (marketing/fonts/) — kein Google-Download,
// garantiert verfügbar, DSGVO-konform. Beide sind SIL-OFL-lizenziert.
// Inter = UI/Text, Fraunces = Display/Überschriften.
const inter = localFont({
  src: "../fonts/Inter.ttf",
  variable: "--font-inter",
  display: "swap",
});

const fraunces = localFont({
  src: "../fonts/Fraunces.ttf",
  variable: "--font-fraunces",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
