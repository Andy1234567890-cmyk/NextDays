// Plattform-Kopfzeile (myBestDays-Buchungsplattform). Eigenes Design —
// schlanke Leiste mit Logo-Wortmarke, Such-Pille und Konto-Aktion.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { Logo } from "./logo";

// Ziel des "myBestDays für Gastgeber"-Buttons: die Marketing-/Gastgeber-Seite.
const GASTGEBER_URL =
  process.env.NEXT_PUBLIC_GASTGEBER_URL ??
  "https://mynextdays.com";

// kontoSlot: der Konto-Button wird serverseitig gerendert (liest die HttpOnly-
// Session) und als Slot übergeben. So bleibt SiteHeader synchron und lässt sich
// auch aus Client-Seiten (z. B. Checkout-Rückkehr) verwenden. Ohne Slot fällt
// die Kopfzeile auf einen einfachen „Anmelden"-Link zurück.
export function SiteHeader({
  compact = false,
  kontoSlot,
}: {
  compact?: boolean;
  kontoSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-20 w-full items-center justify-between gap-4 px-6 md:px-10 2xl:px-20">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>

        {!compact && (
          <button
            type="button"
            className="hidden items-center gap-3 rounded-full border border-border bg-card py-2 pl-5 pr-2 text-sm shadow-sm transition-shadow hover:shadow md:flex"
          >
            <span className="font-medium">Reiseziel</span>
            <span className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">Datum</span>
            <span className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">Gäste</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon icon="ph:magnifying-glass" className="size-4" />
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={GASTGEBER_URL}
            className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary sm:block"
          >
            myBestDays für Gastgeber
          </Link>
          {kontoSlot ?? (
            <Link
              href="/anmelden"
              className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
            >
              <span className="hidden text-sm font-medium sm:block">
                Anmelden
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon icon="ph:user" className="size-4" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
