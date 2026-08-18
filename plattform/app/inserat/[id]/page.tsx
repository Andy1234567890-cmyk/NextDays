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
import { KontoMenu } from "@/components/konto-menu";
import { ListingHerz } from "@/components/listing-herz";
import { BuchungBlatt } from "@/components/mobil/buchung-blatt";
import { TabLeisteMobil } from "@/components/mobil/tab-leiste-mobil";
import { TeilenKnopf } from "@/components/mobil/teilen-knopf";
import { WischGalerie } from "@/components/mobil/wisch-galerie";
import { ObjektBewertungen } from "@/components/objekt-bewertungen";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isGuestLoggedIn } from "@/lib/guest-session";
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
  const [listing, bewertungen, t, format, eingeloggt] = await Promise.all([
    ladeInserat(id),
    // Bewertungen sind Beiwerk: fehlen sie, entfällt nur der Abschnitt.
    ladeOeffentlicheBewertungen(id),
    getTranslations("inserat"),
    getFormatter(),
    // Für das Merken-Herz über der mobilen Galerie: ohne Session führt es auf
    // /anmelden statt still ins Leere.
    isGuestLoggedIn(),
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
    <div className="aktionsleiste-abstand flex min-h-screen flex-col">
      <SiteHeader compact zurueck="/" kontoSlot={<KontoMenu />} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {/* Titel und Galerie in einem Ordnungs-Container: mobil kommt die
            Galerie zuerst (das Bild ist die Entscheidungsgrundlage, der Titel
            steht danach im Textblock), ab md wieder Titel über Galerie. */}
        <div className="flex flex-col">
        {/* Titelzeile */}
        <div className="order-2 mb-4 mt-4 md:order-1 md:mt-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
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

        {/* Galerie mobil: randlose Wisch-Galerie mit Zähler, darüber Zurück,
            Teilen und Merken als Kreise. Das Desktop-Mosaik schrumpfte hier auf
            vier ~90-px-Kacheln, die kein Bild mehr zeigten. */}
        <div className="relative order-1 -mx-4 md:hidden">
          <WischGalerie
            fotos={listing.fotos}
            hues={galerieHues}
            altTexte={listing.fotos.map((_, i) =>
              t("fotoAlt", { titel: listing.titel, nummer: i + 1 }),
            )}
          />
          <TeilenKnopf titel={listing.titel} className="absolute right-16 top-3" />
          <ListingHerz propertyId={listing.id} eingeloggt={eingeloggt} />
        </div>

        {/* Galerie ab md: das bekannte Mosaik (großes Bild + vier Kacheln) */}
        <div
          className="order-2 hidden grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:grid"
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
        </div>

        {/* Zweispaltig: Inhalt + Buchungs-Widget */}
        <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[1fr_24rem]">
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
              <div className="mt-4 flex h-56 items-center justify-center rounded-2xl bg-secondary text-muted-foreground sm:h-72">
                <Icon icon="ph:map-trifold" className="size-10" />
              </div>
            </div>
          </div>

          {/* Buchungs-Widget als Spalte — erst ab lg, wo es tatsächlich neben
              dem Text steht. Darunter wäre es der letzte Block der Seite, weit
              hinter Karte und Bewertungen; dort übernimmt BuchungBlatt. */}
          <div className="hidden lg:relative lg:block">
            <div className="lg:sticky lg:top-28">
              <BuchungsWidget listing={listing} />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
      <BuchungBlatt listing={listing} />
      <TabLeisteMobil />
    </div>
  );
}
