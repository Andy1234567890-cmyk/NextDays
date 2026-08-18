// Plattform-Kopfzeile für Detail-, Checkout- und Konto-Seiten. Schlanke Leiste
// mit Logo-Wortmarke, Such-Pille und Konto-Aktion.
//
// Mobil war hier nichts außer Logo und Konto: die Such-Pille ist `hidden md:flex`,
// „für Gastgeber" `hidden sm:block`, das Wort „Anmelden" `hidden sm:block`. Jetzt
// trägt die Zeile mobil eine echte Such-Pille (führt auf die Suche) und optional
// einen Zurück-Pfeil.
//
// kontoSlot: der Konto-Button wird serverseitig gerendert (liest die HttpOnly-
// Session) und als Slot übergeben. So bleibt SiteHeader synchron und lässt sich
// auch aus Client-Seiten (z. B. Checkout-Rückkehr) verwenden. Ohne Slot fällt
// die Kopfzeile auf einen einfachen „Anmelden"-Link zurück.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { gastgeberRegistrierungUrl } from "@/lib/gastgeber-link";

import { Logo } from "./logo";
import { SprachWaehrungModal } from "./sprach-waehrung-modal";

export function SiteHeader({
  compact = false,
  kontoSlot,
  zurueck,
}: {
  compact?: boolean;
  kontoSlot?: React.ReactNode;
  /** Ziel des Zurück-Pfeils. Ohne Wert kein Pfeil. */
  zurueck?: string;
}) {
  const t = useTranslations("nav");
  const tm = useTranslations("mobil");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 md:h-20 md:gap-4 md:px-10 2xl:px-20">
        <div className="flex min-w-0 items-center gap-1">
          {zurueck && (
            <Link
              href={zurueck}
              aria-label={tm("zurueck")}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
            >
              <Icon icon="ph:arrow-left" className="size-5" />
            </Link>
          )}
          <Link href="/" className="flex min-h-11 shrink-0 items-center">
            <Logo />
          </Link>
        </div>

        {/* Such-Pille — führt auf die Suche. Vorher war das ein `<button>` ohne
            onClick, also eine Attrappe; mobil war sie zusätzlich versteckt. */}
        {!compact && (
          <Link
            href="/"
            className="hidden items-center gap-3 rounded-full border border-border bg-card py-2 pl-5 pr-2 text-sm shadow-sm transition-shadow hover:shadow md:flex"
          >
            <span className="font-medium">{tm("sucheZiel")}</span>
            <span className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">{tm("sucheDatum")}</span>
            <span className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">{tm("sucheGaeste")}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon icon="ph:magnifying-glass" className="size-4" />
            </span>
          </Link>
        )}

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {/* Mobile Kurzform der Such-Pille: nur das Symbol, aber ein echter Weg
              zurück in die Suche. */}
          {!compact && (
            <Link
              href="/"
              aria-label={tm("suchen")}
              className="flex size-11 items-center justify-center rounded-full border border-border md:hidden"
            >
              <Icon icon="ph:magnifying-glass" className="size-5" />
            </Link>
          )}
          {/* Sprachwahl gehört auf JEDE Seite: die Inserat- und Checkout-Seiten
              nutzen diese Kopfzeile, und dort hatte der Gast bisher keinen Weg,
              die Sprache zu wechseln (das Globus-Menü hing nur an der
              Startseiten-Navigation). */}
          <SprachWaehrungModal />
          <Link
            href={gastgeberRegistrierungUrl()}
            className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary lg:block"
          >
            {t("gastgeber")}
          </Link>
          {kontoSlot ?? (
            <Link
              href="/anmelden"
              className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
            >
              <span className="hidden text-sm font-medium sm:block">
                {t("anmelden")}
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
