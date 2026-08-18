// Inserat-Karte für das Suche-Grid — eigenes myBestDays-Design im Booking/Airbnb-
// Stil: Foto (oder Platzhalter), funktionales Merken-Herz, Score-Badge NUR bei
// echter Bewertung (nie erfunden), „ab"-Preis (oder „auf Anfrage").
import Link from "next/link";

import { type Listing, formatCurrency } from "@/lib/listings";

import { ListingHerz } from "./listing-herz";
import { PhotoPlaceholder } from "./photo-placeholder";

// Booking-artiges Score-Wort (rein aus dem echten Wert abgeleitet, nichts erfunden).
function scoreWort(wert: number): string {
  if (wert >= 4.7) return "Hervorragend";
  if (wert >= 4.3) return "Sehr gut";
  if (wert >= 3.8) return "Gut";
  return "Ordentlich";
}

export function ListingCard({
  listing,
  eingeloggt = false,
}: {
  listing: Listing;
  eingeloggt?: boolean;
}) {
  const foto = listing.fotos[0];
  return (
    <Link href={`/inserat/${listing.id}`} className="group flex flex-col gap-2 sm:gap-3">
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
          <span className="absolute left-2 top-2 rounded-full bg-card/95 px-2 py-0.5 text-[0.625rem] font-semibold sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-xs">
            Gäste-Favorit
          </span>
        )}
        <ListingHerz propertyId={listing.id} eingeloggt={eingeloggt} />
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug sm:text-base">{listing.titel}</p>
        {listing.bewertung != null && (
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
            {listing.bewertung.toLocaleString("de-DE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
        )}
      </div>

      {listing.bewertung != null && (
        <p className="-mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground sm:-mt-2 sm:text-xs">
          <span className="font-medium text-foreground">
            {scoreWort(listing.bewertung)}
          </span>
          {listing.anzahlBewertungen != null && (
            <span>· {listing.anzahlBewertungen} Bewertungen</span>
          )}
        </p>
      )}

      <p
        className={
          "text-xs text-muted-foreground sm:text-sm " +
          (listing.bewertung != null ? "-mt-1" : "-mt-1 sm:-mt-2")
        }
      >
        {listing.ort}
      </p>
      <p className="-mt-0.5 text-xs sm:-mt-1 sm:text-sm">
        {listing.preisProNacht != null ? (
          <>
            <span className="font-semibold">
              {formatCurrency(listing.preisProNacht, listing.currency)}
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
