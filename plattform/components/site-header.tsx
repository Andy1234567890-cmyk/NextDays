// Plattform-Kopfzeile (myNextDays-Buchungsplattform). Eigenes Design —
// schlanke Leiste mit Logo-Wortmarke, Such-Pille und Konto-Aktion.
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";

// Ziel des "myNextDays für Gastgeber"-Buttons: die Marketing-/Gastgeber-Seite.
const GASTGEBER_URL =
  process.env.NEXT_PUBLIC_GASTGEBER_URL ??
  "https://y13cm245vlmvq3yv38gdbtat.65.21.144.136.sslip.io";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/mynextdays-logo.png"
            alt="myNextDays"
            width={1470}
            height={399}
            priority
            className="h-9 w-auto"
          />
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
            myNextDays für Gastgeber
          </Link>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
          >
            <Icon icon="ph:list" className="size-4" />
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon icon="ph:user" className="size-4" />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
