// Inserat-Detailseite — Galerie, Eckdaten, Beschreibung, Ausstattung, Lage
// und seitliches Buchungs-Widget. Daten aus dem Backend (booking_engine,
// nur active Objekte). Keine erfundenen Bewertungen/Texte.
//
// Texte laufen über next-intl (Sprache aus dem Gast-Cookie), Ausstattungs-
// Merkmale über die Kataloge (lib/ausstattung.ts) — vorher standen hier rohe
// Slugs wie „nd_sun_loungers" (live 11.08.2026).
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { AusstattungListe } from "@/components/ausstattung-liste";
import { BuchungsWidget } from "@/components/buchungs-widget";
import { ObjektBewertungen } from "@/components/objekt-bewertungen";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ladeInserat } from "@/lib/inserate";
import { ladeOeffentlicheBewertungen } from "@/lib/objekt-bewertungen";

// Suchmaschinen-Indexierung pro Objekt (Airbnb „Objekte in Suchmaschinen
// aufnehmen"). Ist der Schalter AUS (Default), rendert Next den robots-Meta-Tag
//   <meta name="robots" content="noindex, nofollow, noimageindex">
// — exakt Airbnbs Mechanik. Der Konto-Schalter setzt das Flag für alle Objekte.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await ladeInserat(id);
  const indexierbar = listing?.suchmaschinenIndex === true;
  return {
    title: listing?.titel,
    robots: indexierbar
      ? { index: true, follow: true }
      : { index: false, follow: false, noimageindex: true },
  };
}

export default async function InseratPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [listing, bewertungen, t, format] = await Promise.all([
    ladeInserat(id),
    // Bewertungen sind Beiwerk: fehlen sie, entfällt nur der Abschnitt.
    ladeOeffentlicheBewertungen(id),
    getTranslations("inserat"),
    getFormatter(),
  ]);
  if (!listing) notFound();

  const galerieHues = [0, 20, 40, 60, 80].map((d) => (listing.hue + d) % 360);
  // Eckdaten-Zeile: nur Zahlen, die wirklich hinterlegt sind (kein „0 Bäder").
  const eckdaten = [
    t("gaesteZahl", { count: listing.gaeste }),
    listing.schlafzimmer != null
      ? t("schlafzimmerZahl", { count: listing.schlafzimmer })
      : null,
    listing.baeder != null ? t("baederZahl", { count: listing.baeder }) : null,
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {/* Titelzeile */}
        <div className="mb-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {listing.titel}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {listing.bewertung != null && (
              <>
                <span className="flex items-center gap-1 font-medium">
                  <Icon icon="ph:star-fill" className="size-3.5" />
                  {format.number(listing.bewertung, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {listing.anzahlBewertungen != null && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="underline">
                      {t("bewertungenZahl", { count: listing.anzahlBewertungen })}
                    </span>
                  </>
                )}
                <span aria-hidden>·</span>
              </>
            )}
            <span className="text-muted-foreground underline">{listing.ort}</span>
          </div>
        </div>

        {/* Galerie: echte Fotos, sonst Platzhalter */}
        <div
          className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl"
          style={{ height: "26rem" }}
        >
          {listing.fotos.length > 0
            ? listing.fotos.slice(0, 5).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={t("fotoAlt", { titel: listing.titel, nummer: i + 1 })}
                  className={`size-full object-cover ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                />
              ))
            : galerieHues.map((hue, i) => (
                <PhotoPlaceholder
                  key={hue}
                  hue={hue}
                  className={i === 0 ? "col-span-2 row-span-2" : "size-full"}
                />
              ))}
        </div>

        {/* Zweispaltig: Inhalt + Buchungs-Widget */}
        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0">
            {/* Eckdaten */}
            <div className="border-b border-border pb-6">
              <h2 className="font-display text-xl font-semibold">
                {t("unterkunftIn", { ort: listing.ort })}
              </h2>
              <p className="mt-1 text-muted-foreground">
                {eckdaten.join(" · ")}
              </p>
            </div>

            {/* Beschreibung — nur wenn vorhanden */}
            {listing.beschreibung && (
              <div className="border-b border-border py-6">
                <p className="whitespace-pre-line leading-relaxed text-foreground">
                  {listing.beschreibung}
                </p>
              </div>
            )}

            {/* Ausstattung — übersetzte Merkmale, ohne Label kein Eintrag */}
            <AusstattungListe slugs={listing.ausstattung} />

            {bewertungen && <ObjektBewertungen daten={bewertungen} />}

            {/* Lage (ungefähr) */}
            <div className="border-t border-border py-6">
              <h2 className="font-display text-xl font-semibold">
                {t("lageTitel")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{listing.ort}</p>
              <div className="mt-4 flex h-72 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Icon icon="ph:map-trifold" className="size-10" />
              </div>
            </div>
          </div>

          {/* Buchungs-Widget */}
          <div className="lg:relative">
            <div className="lg:sticky lg:top-28">
              <BuchungsWidget listing={listing} />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
