// Buchungs-Widget der Inserat-Seite — Datum/Gäste-Auswahl, Preis-Aufschlüsselung
// und Reservieren-Aktion (führt zum Checkout). Eigenes myNextDays-Design.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { type Listing, formatEuro } from "@/lib/listings";

const NAECHTE = 2;
const STEUER_SATZ = 0.0866; // ~ Platzhalter, bis Backend die echten Werte liefert

export function BuchungsWidget({ listing }: { listing: Listing }) {
  const zwischensumme = listing.preisProNacht * NAECHTE;
  const steuern = Math.round(zwischensumme * STEUER_SATZ * 100) / 100;
  const gesamt = Math.round((zwischensumme + steuern) * 100) / 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
      <p className="mb-4">
        <span className="text-xl font-semibold">
          {formatEuro(listing.preisProNacht)}
        </span>{" "}
        <span className="text-muted-foreground">Nacht</span>
      </p>

      {/* Datum / Gäste */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-3">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide">
              Check-in
            </p>
            <p className="text-sm text-foreground">03.07.2026</p>
          </div>
          <div className="p-3">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide">
              Check-out
            </p>
            <p className="text-sm text-foreground">05.07.2026</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide">
              Gäste
            </p>
            <p className="text-sm text-foreground">1 Gast</p>
          </div>
          <Icon icon="ph:caret-down" className="size-4 text-muted-foreground" />
        </div>
      </div>

      <Link
        href={`/checkout/${listing.id}`}
        className="mt-4 flex w-full items-center justify-center rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Reservieren
      </Link>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Du musst noch nichts bezahlen
      </p>

      {/* Preis-Aufschlüsselung */}
      <div className="mt-6 flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <span className="underline">
            {formatEuro(listing.preisProNacht)} × {NAECHTE} Nächte
          </span>
          <span>{formatEuro(zwischensumme)}</span>
        </div>
        <div className="flex justify-between">
          <span className="underline">Steuern</span>
          <span>{formatEuro(steuern)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
          <span>Gesamt</span>
          <span>{formatEuro(gesamt)}</span>
        </div>
      </div>
    </div>
  );
}
