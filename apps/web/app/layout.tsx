// Root-Layout: Schriften (lokal), Theme-Provider, globale Styles.
import type { Metadata } from "next";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

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
  title: "NextDays — Dashboard",
  description: "Vermieter-Dashboard für die NextDays-Vacation-Rental-Plattform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
