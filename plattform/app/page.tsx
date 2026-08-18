// Suche / Startseite — Inserate-Übersicht (Karten-Grid). Eigenes myBestDays-
// Design; Daten kommen aus dem Backend (booking_engine, nur active Objekte).
import { getTranslations } from "next-intl/server";

import { KontoMenu } from "@/components/konto-menu";
import { ListingReihe } from "@/components/listing-reihe";
import { TabLeisteMobil } from "@/components/mobil/tab-leiste-mobil";
import { PlattformNav } from "@/components/plattform-nav";
import { SiteFooter } from "@/components/site-footer";
import { ladeReihen } from "@/lib/inserate";
import { reihenSchluessel } from "@/lib/listings";

export default async function SuchePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; guests?: string }>;
}) {
  const sp = await searchParams;
  const guests = sp.guests ? Number(sp.guests) : undefined;
  // Themen-Reihen aus echten active-Objekten (leer, wenn keine veröffentlicht).
  // Suchbegriff (q) / Gäste werden an den booking_engine-Endpoint durchgereicht.
  const [reihen, t] = await Promise.all([
    ladeReihen({ q: sp.q, guests }),
    getTranslations("suche"),
  ]);

  return (
    <div className="tabbar-abstand flex min-h-screen flex-col">
      <PlattformNav kontoSlot={<KontoMenu />} />

      <main className="flex-1">
        <div className="w-full px-4 py-3 sm:px-6 sm:py-4 md:px-10 2xl:px-20">
          {reihen.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="font-display text-xl font-semibold">
                {t("leerTitel")}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {t("leerText")}
              </p>
            </div>
          ) : (
            reihen.map((reihe) => (
              <ListingReihe key={reihenSchluessel(reihe.titel)} reihe={reihe} />
            ))
          )}
        </div>
      </main>

      <SiteFooter />
      <TabLeisteMobil />
    </div>
  );
}
