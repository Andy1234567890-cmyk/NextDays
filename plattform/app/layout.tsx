// Root-Layout der entkoppelten Plattform-App (myBestDays-Buchungsplattform).
import type { Metadata } from "next";

import "./globals.css";

import { DiagnoseStarter } from "@/components/diagnose-starter";

export const metadata: Metadata = {
  title: "myBestDays — Unterkünfte finden & buchen",
  description:
    "Finde und buche Ferienunterkünfte direkt bei den Gastgebern — die Buchungsplattform von myBestDays.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">
        {/* Technischer Fehler-Reporter (kein Verhaltens-Tracking). */}
        <DiagnoseStarter />
        {children}
      </body>
    </html>
  );
}
