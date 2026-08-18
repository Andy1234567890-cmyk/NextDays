// Root-Layout der white-label Builder-App (gebrandete Agentur-Buchungs-Sites).
//
// Pro Custom-Domain liefert die Middleware Tenant + Branding (lib/site-context).
// Die Markenfarben/Schrift der Agentur werden als CSS-Variablen (--primary/
// --secondary/--font-sans) auf <html> gesetzt — das vorhandene Tailwind-Theme
// zieht sie automatisch. Ohne Branding bleiben die Default-Werte aus globals.css
// (kein erfundener Ersatz).
import type { CSSProperties, ReactNode } from "react";

import type { Metadata } from "next";

import { getSiteContext } from "@/lib/site-context";

import "./globals.css";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

const DEFAULT_TITLE = "myNextDays — Unterkünfte finden & buchen";
const DEFAULT_DESCRIPTION =
  "Finde und buche Ferienunterkünfte direkt beim Gastgeber.";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteContext();
  if (!branding) {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
  return {
    title: branding.site_name ?? DEFAULT_TITLE,
    description: branding.tagline ?? DEFAULT_DESCRIPTION,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { branding } = await getSiteContext();

  // Nur gesetzte Branding-Werte überschreiben den Default. Hex stammt aus der DB
  // → Inline-CSS-Variable, NICHT in Tailwind-Klassen (Repo-Regel).
  const brandStyle: Record<string, string> = {};
  if (branding?.primary_color) {
    brandStyle["--primary"] = branding.primary_color;
    brandStyle["--ring"] = branding.primary_color;
  }
  if (branding?.secondary_color) {
    brandStyle["--secondary"] = branding.secondary_color;
  }
  if (branding?.font_family) {
    brandStyle["--font-sans"] = branding.font_family;
  }

  return (
    <html lang="de" style={brandStyle as CSSProperties}>
      <body className="font-sans antialiased">
        {/* Icons lokal registrieren, bevor das erste Icon rendert (0410). */}
        <IconsRegistrieren />{children}</body>
    </html>
  );
}
