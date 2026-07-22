// Root-Layout des Gastgeber-Dashboards (Supply-Seite). Eigenständiges Projekt,
// eigene Subdomain host. — eingeloggter Bereich, daher noindex (ADR-0015).
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "myNextDays — Gastgeber",
  description: "Verwalte deine Objekte, Kalender, Preise und Buchungen.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
