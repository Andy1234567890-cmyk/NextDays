// Root-Layout der Kunden-Sites (gebrandete Buchungs-Websites eines Betriebs).
//
// Pro Custom-Domain liefert die Middleware Tenant + Branding (lib/site-context).
// Die Design-Tokens des Kunden (Farben, drei Schriften, Button-Eckenform) werden
// als CSS-Variablen auf <html> gesetzt — das vorhandene Tailwind-Theme zieht sie
// automatisch. Die Umrechnung Branding → Variablen liegt vollständig in
// lib/theme (eine Wahrheit).
//
// Ohne Branding bleiben die Defaults aus globals.css stehen: „nicht gesetzt" ist
// ein gültiger Zustand, kein erfundener Ersatzwert (Wurzel 4).
import type { ReactNode } from "react";

import type { Metadata } from "next";

import { STANDARD_SPRACHE } from "@/lib/i18n";
import { getSiteContext } from "@/lib/site-context";
import { brandStyle, siteFontsHref } from "@/lib/theme";

import "./globals.css";

// Titel für den Fall, dass eine Adresse keinem Betrieb gehört oder der Betrieb
// noch keinen Namen gesetzt hat.
//
// BEWUSST OHNE unsere Marke: diese App liefert Gast-Seiten von Betrieben aus.
// Vorher stand hier „myNextDays — Unterkünfte finden & buchen", und jeder Kunde
// ohne gesetzten `site_name` schickte seinen Gästen einen Browser-Tab mit
// UNSEREM PMS-Namen (Zwei-Marken-Regel verletzt).
const DEFAULT_TITLE = "Unterkünfte finden & buchen";
const DEFAULT_DESCRIPTION =
  "Ferienunterkünfte direkt beim Gastgeber buchen.";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSiteContext();
  if (!branding) {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
  return {
    title: branding.site_name ?? DEFAULT_TITLE,
    description: branding.tagline ?? DEFAULT_DESCRIPTION,
    // Nur setzen, wenn der Kunde ein Favicon hochgeladen hat — sonst greift die
    // Standard-Auflösung von Next (kein Verweis auf eine leere Datei).
    ...(branding.favicon_url ? { icons: { icon: branding.favicon_url } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { branding } = await getSiteContext();
  const fontsHref = siteFontsHref(branding);

  return (
    // `lang` folgt der Standardsprache des Renderers, nicht einem festen „de":
    // eine dänische oder englische Kundenseite mit lang="de" ist für
    // Screenreader und Suchmaschinen eine Falschaussage.
    <html
      lang={STANDARD_SPRACHE}
      style={brandStyle(branding)}
      // Button-Füllung als Attribut, nicht als Variable: „umrandet" ändert
      // mehrere Eigenschaften gleichzeitig (Hintergrund, Rand, Schatten) —
      // das ist eine CSS-Regel in globals.css, kein einzelner Wert.
      data-button-style={branding?.button_style ?? undefined}
    >
      <head>
        {/* Die gewählten Schriften laden — nur wenn es echte Google-Familien
            sind; System-Fonts brauchen keinen Request. */}
        {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
