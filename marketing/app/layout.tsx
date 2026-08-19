// Root-Layout der Marketing-App: Schriften (lokal), globale Styles und
// next-intl-Provider. Die Sprache kommt aus dem nd_locale-Cookie
// (i18n/request.ts) und landet auch im lang-Attribut des <html>.
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import "./globals.css";

import { SupportChat } from "@/components/support-chat";
import { VoranmeldungPopup } from "@/components/voranmeldung-popup";
import { SITE_URL } from "@/lib/site-url";

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
  return {
    // `metadataBase` macht relative Metadaten-Pfade absolut (Open-Graph-Bilder,
    // kanonische Links). Ohne sie warnt Next beim Bauen und setzt localhost ein —
    // eine Vorschau-Karte auf einer fremden Plattform zeigte dann ins Nichts.
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
  };
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
          {/* Auf JEDER Seite erreichbar, auch in den Rechtsdokumenten. */}
          <SupportChat />
          {/* Fängt vor dem Start die Klicks auf „Anmelden"/„Kostenlos starten"
              ab und sammelt stattdessen Voranmeldungen. */}
          <VoranmeldungPopup />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
