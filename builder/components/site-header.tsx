// White-Label-Kopfzeile einer Agentur-Site. Bewusst KEINE Marktplatz-Elemente
// (keine globale Suchpille, kein „myNextDays für Gastgeber") — die Seite gehört
// der Agentur. Zeigt nur das Agentur-Logo/den Namen und eine dezente CTA.
import Link from "next/link";

import { Logo } from "./logo";

export function SiteHeader({
  logoSrc,
  logoAlt,
  siteName,
}: {
  // White-Label: Agentur-Logo + Name aus dem Branding.
  logoSrc?: string | null;
  logoAlt?: string | null;
  siteName?: string | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo src={logoSrc} alt={logoAlt} />
          {!logoSrc && siteName ? (
            <span className="font-display text-lg font-semibold tracking-tight">
              {siteName}
            </span>
          ) : null}
        </Link>

        <Link
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Jetzt buchen
        </Link>
      </div>
    </header>
  );
}
