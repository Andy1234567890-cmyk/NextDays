// Root-Layout des Plattform-Backoffice. Eigenständiges Projekt auf eigener
// Subdomain, strikt getrennt von gastgeber/ (Betriebe) und plattform/ (Gäste).
// Interner Bereich → niemals indexieren.
//
// Kein next-intl: das Backoffice ist ein internes Werkzeug für den
// Plattformbetreiber und bleibt bewusst einsprachig (deutsch) — jede
// Übersetzungsebene wäre Aufwand ohne Nutzen.
import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "myNextDays — Backoffice",
  description: "Plattform-Verwaltung.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
