// Inserat-Karte für das Suche-Grid der Plattform. Portiert aus plattform/.
// Zeigt Foto (oder Platzhalter), „ab"-Preis (oder „auf Anfrage"), Bewertung
// nur wenn vorhanden (keine erfundenen Werte).
import { Icon } from "@iconify/react";
import Link from "next/link";

import { type Listing, formatEuro } from "./_fixtures";
import { PhotoPlaceholder } from "./photo-placeholder";

export function ListingCard({ listing }: { listing: Listing }) {
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
            Gäste-Favorit
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
            {listing.bewertung.toLocaleString("de-DE")}
          </span>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{listing.ort}</p>
      <p className="-mt-1 text-sm">
        {listing.preisProNacht != null ? (
          <>
            <span className="font-semibold">
              {formatEuro(listing.preisProNacht, listing.currency)}
            </span>{" "}
            <span className="text-muted-foreground">Nacht</span>
          </>
        ) : (
          <span className="text-muted-foreground">Preis auf Anfrage</span>
        )}
      </p>
    </Link>
  );
}
