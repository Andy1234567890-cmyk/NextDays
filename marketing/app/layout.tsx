// Root-Layout der Marketing-App: Schriften (lokal) + globale Styles.
import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

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

export const metadata: Metadata = {
  title: "myNextDays — Eine Plattform für kleine Unterkünfte",
  description:
    "Steigere deine Buchungen, vereinfache deinen Betrieb und biete unvergessliche Gästeerlebnisse – alles an einem Ort. 30 Tage kostenlos testen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
