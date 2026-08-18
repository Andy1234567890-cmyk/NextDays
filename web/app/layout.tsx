// Root-Layout: Schriften (lokal), Theme-Provider, i18n-Provider, globale Styles.
import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

// Schriften liegen LOKAL im Repo (apps/web/fonts/) — kein Google-Download,
// garantiert verfügbar, DSGVO-konform. Beide sind SIL-OFL-lizenziert.
// Inter = UI/Text, Fraunces = Display/Überschriften (humanistischer, freier
// Ersatz für die kommerzielle RL Aqva).
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

export const metadata: Metadata = {
  title: "myNextDays — Dashboard",
  description: "Vermieter-Dashboard für die myNextDays-Vacation-Rental-Plattform.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {/* Icons lokal registrieren, bevor das erste Icon rendert (0410). */}
        <IconsRegistrieren />
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
