// Suche / Startseite — Inserate-Übersicht (Karten-Grid). Eigenes myNextDays-
// Design; Daten kommen aus dem Backend (booking_engine, nur active Objekte).
import { ListingReihe } from "@/components/listing-reihe";
import { PlattformNav } from "@/components/plattform-nav";
import { SiteFooter } from "@/components/site-footer";
import { ladeReihen } from "@/lib/inserate";

export default async function SuchePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; guests?: string }>;
}) {
  const sp = await searchParams;
  const guests = sp.guests ? Number(sp.guests) : undefined;
  // Themen-Reihen aus echten active-Objekten (leer, wenn keine veröffentlicht).
  // Suchbegriff (q) / Gäste werden an den booking_engine-Endpoint durchgereicht.
  const reihen = await ladeReihen({ q: sp.q, guests });

  return (
    <div className="flex min-h-screen flex-col">
      <PlattformNav />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-4">
          {reihen.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="font-display text-xl font-semibold">
                Noch keine Unterkünfte verfügbar
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Sobald Gastgeber Objekte veröffentlichen, erscheinen sie hier.
              </p>
            </div>
          ) : (
            reihen.map((reihe) => (
              <ListingReihe key={reihe.titel} reihe={reihe} />
            ))
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
