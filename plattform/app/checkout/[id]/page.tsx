// Checkout — dreistufiger Buchungsabschluss (Zahlungszeitpunkt → Zahlungsart →
// Prüfen) mit Buchungs-Zusammenfassung seitlich. Eigenes myNextDays-Design;
// Daten sind Platzhalter bis zur Backend-Anbindung.
import { notFound } from "next/navigation";

import { CheckoutSteps } from "@/components/checkout-steps";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@iconify/react";
import { getListing, formatEuro } from "@/lib/listings";

const NAECHTE = 2;
const STEUER_SATZ = 0.0866;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  const zwischensumme = listing.preisProNacht * NAECHTE;
  const steuern = Math.round(zwischensumme * STEUER_SATZ * 100) / 100;
  const gesamt = Math.round((zwischensumme + steuern) * 100) / 100;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            aria-label="Zurück"
            className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <Icon icon="ph:arrow-left" className="size-5" />
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Bestätigen und bezahlen
          </h1>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
          {/* Linke Spalte: Schritte */}
          <CheckoutSteps gesamt={formatEuro(gesamt)} />

          {/* Rechte Spalte: Buchungs-Zusammenfassung */}
          <div className="lg:relative">
            <div className="lg:sticky lg:top-28">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex gap-4 border-b border-border pb-5">
                  <PhotoPlaceholder
                    hue={listing.hue}
                    className="size-24 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium leading-snug">
                      {listing.titel}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm">
                      <Icon icon="ph:star-fill" className="size-3.5" />
                      {listing.bewertung.toLocaleString("de-DE")} (
                      {listing.anzahlBewertungen})
                      {listing.istFavorit && (
                        <span className="ml-1 text-muted-foreground">
                          · Gäste-Favorit
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="border-b border-border py-5">
                  <p className="text-sm font-semibold">Kostenlose Stornierung</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Wenn du vor dem 1. Juli stornierst, erhältst du eine
                    vollständige Rückerstattung.
                  </p>
                </div>

                <div className="flex items-start justify-between border-b border-border py-5">
                  <div>
                    <p className="text-sm font-semibold">Datum</p>
                    <p className="text-sm text-muted-foreground">3.–5. Juli 2026</p>
                  </div>
                  <button type="button" className="text-sm font-medium underline">
                    Ändern
                  </button>
                </div>

                <div className="flex items-start justify-between border-b border-border py-5">
                  <div>
                    <p className="text-sm font-semibold">Gäste</p>
                    <p className="text-sm text-muted-foreground">1 Gast</p>
                  </div>
                  <button type="button" className="text-sm font-medium underline">
                    Ändern
                  </button>
                </div>

                <div className="pt-5">
                  <p className="text-sm font-semibold">Preisdetails</p>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {formatEuro(listing.preisProNacht)} × {NAECHTE} Nächte
                      </span>
                      <span>{formatEuro(zwischensumme)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Steuern</span>
                      <span>{formatEuro(steuern)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
                      <span>Gesamt (EUR)</span>
                      <span>{formatEuro(gesamt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent/10 p-4">
                <Icon icon="ph:sparkle" className="size-6 shrink-0 text-accent" />
                <p className="text-sm">
                  Seltenes Fundstück – diese Unterkunft ist normalerweise
                  ausgebucht.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
