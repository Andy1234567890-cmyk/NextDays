// Inserat-Karte für das Suche-Grid — eigenes myNextDays-Design.
// Zeigt echte Backend-Daten: Foto (oder Platzhalter), „ab"-Preis (oder „auf
// Anfrage"), Bewertung nur wenn vorhanden (keine erfundenen Werte).
import { Icon } from "@iconify/react";
import Link from "next/link";

import { type Listing, formatCurrency } from "@/lib/listings";
import { texte } from "@/lib/texte";

import { PhotoPlaceholder } from "./photo-placeholder";

export function ListingCard({
  listing,
  sprache,
  preisZeigen = true,
}: {
  listing: Listing;
  /** Sprache der Website — für die festen Texte der Karte. */
  sprache: string;
  /** false = Preis erst nach der Datumswahl zeigen (`show_base_prices`, 0426).
   *
   *  Der Grund für die Einstellung: ein „ab 89 €" ohne Zeitraum ist für viele
   *  Betriebe eine Zahl, die in der Hauptsaison niemand mehr wiederfindet. Wer
   *  das nicht will, schaltet es ab — dann steht dort nichts statt eines
   *  Preises, der nicht gilt. */
  preisZeigen?: boolean;
}) {
  const txt = texte(sprache);
  const foto = listing.fotos[0];
  return (
    <Link href={`/inserat/${listing.id}`} className="group flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt={listing.titel}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <PhotoPlaceholder
            hue={listing.hue}
            className="size-full transition-transform group-hover:scale-105"
          />
        )}
        {listing.istFavorit && (
          <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold">
            {txt.gaesteFavorit}
          </span>
        )}
        <span aria-hidden className="absolute right-3 top-3 text-white drop-shadow">
          <Icon icon="ph:heart" className="size-6" />
        </span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{listing.titel}</p>
        {listing.bewertung != null && (
          <span className="flex shrink-0 items-center gap-1 text-sm">
            <Icon icon="ph:star-fill" className="size-3.5" />
            {listing.bewertung.toLocaleString(sprache)}
          </span>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{listing.ort}</p>
      {/* Ist die Preisanzeige abgeschaltet, entfällt die ZEILE — nicht nur der
          Betrag. Ein leerer Absatz hinterließe eine Lücke, die aussieht, als
          wäre der Preis nicht geladen. */}
      {preisZeigen ? (
        <p className="-mt-1 text-sm">
          {listing.preisProNacht != null ? (
            <>
              <span className="font-semibold">
                {formatCurrency(listing.preisProNacht, listing.currency)}
              </span>{" "}
              <span className="text-muted-foreground">{txt.preisNacht}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{txt.preisAufAnfrage}</span>
          )}
        </p>
      ) : null}
    </Link>
  );
}
