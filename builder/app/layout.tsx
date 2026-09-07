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
import { Effekte } from "@/components/blocks/effekte";
import type { ReactNode } from "react";

import type { Metadata } from "next";

import { getSiteContext } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";
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
    // `lang` folgt der Standardsprache DIESER SITE, nicht einem festen „de":
    // eine dänische oder englische Kundenseite mit lang="de" ist für
    // Screenreader und Suchmaschinen eine Falschaussage.
    //
    // Hier stand `STANDARD_SPRACHE`, und das IST `"de"` (lib/i18n.ts) — der
    // Kommentar beschrieb also genau den Fehler, den die Zeile begangen hat.
    // Jede dänische Kundenseite deklarierte sich als deutsch; Screenreader
    // lasen sie mit deutscher Aussprache vor.
    //
    // Das Layout kennt keine `?lang=`-Wahl (es sieht die Suchparameter nicht),
    // deshalb die Standardsprache der Site und nicht die des Besuchs. Sie ist
    // die richtige Vorgabe für das Dokument; die Seiten darunter setzen ihren
    // Inhalt über `modus.locale`.
    <html
      lang={spracheWaehlen(branding)}
      style={brandStyle(branding)}
      // Button-Füllung als Attribut, nicht als Variable: „umrandet" ändert
      // mehrere Eigenschaften gleichzeitig (Hintergrund, Rand, Schatten) —
      // das ist eine CSS-Regel in globals.css, kein einzelner Wert.
      data-button-style={branding?.button_style ?? undefined}
      // NUR fuer die Attribute DIESES Elements — Kinder sind nicht betroffen.
      //
      // Browser-Erweiterungen schreiben ihre Merker an das `<html>`, nachdem
      // die Server-Antwort da ist und bevor React hydriert. Gemessen am
      // 28.08.2026: die Antwort trug `lang`, `style`, `data-button-style` —
      // im Browser stand zusaetzlich
      // `data-tag-assistant-prod-present="pending:…"`, gesetzt vom Google Tag
      // Assistant. React meldet das als Hydration-Mismatch, obwohl im Code
      // nichts abweicht.
      //
      // Die Warnung ist nicht harmlos, weil sie falsch ist, sondern weil sie
      // bei JEDEM Aufruf erscheint: eine Meldung, die immer da ist, verdeckt
      // die eine, die zaehlt (Wurzel 5 — ein Kontrollsignal, das im Rauschen
      // untergeht, ist keines mehr).
      //
      // `web/app/layout.tsx` traegt dieselbe Zeile seit jeher; hier fehlte sie.
      // Sie deckt AUSSCHLIESSLICH die Attribute des `<html>` ab — ein echter
      // Unterschied im Seiteninhalt wird weiterhin gemeldet.
      suppressHydrationWarning
    >
      <head>
        {/* Die gewählten Schriften laden — nur wenn es echte Google-Familien
            sind; System-Fonts brauchen keinen Request. */}
        {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      </head>
      <body className="font-sans antialiased">{/* Effekte-Skript (Erscheinen, Parallax) EINMAL je Seite — im
            Editor-iframe fehlen die Marker, dort tut es nichts. */}
        <Effekte />
        {children}</body>
    </html>
  );
}
