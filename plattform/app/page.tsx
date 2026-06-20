// Suche / Startseite — Inserate-Übersicht (Karten-Grid). Eigenes myNextDays-
// Design; Daten sind Platzhalter bis zur Backend-Anbindung.
import { ListingReihe } from "@/components/listing-reihe";
import { PlattformNav } from "@/components/plattform-nav";
import { SiteFooter } from "@/components/site-footer";
import { ladeReihen } from "@/lib/inserate";

export default async function SuchePage() {
  // Reihen über das Domänen-Modul laden (zentrale Listing-Quelle; Platzhalter
  // bis zur Backend-Anbindung, danach FastAPI ohne UI-Änderung).
  const reihen = await ladeReihen();

  return (
    <div className="flex min-h-screen flex-col">
      <PlattformNav />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-4">
          {reihen.map((reihe) => (
            <ListingReihe key={reihe.titel} reihe={reihe} />
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
