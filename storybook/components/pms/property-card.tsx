// Fachliche PMS-Komponente: Objekt-Karte (property-card).
// Lastenheft §2.2 (Objekt-Stammdaten) / §6 (Eigentümer-Sicht).
// Tabelle: properties (+ reservations für nächste Buchung).
// Stil-Standard exakt wie components/ui/button.tsx: CVA, named export,
// nur semantische Token-Klassen, Icons NUR via @iconify/react (ph:*).
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Echte Enum-Werte (BUILD_REFERENCE / supabase-migrations).
export type PropertyType =
  | "ferienhaus"
  | "appartement"
  | "glamping"
  | "tiny_house"
  | "stellplatz"
  | "hausboot";

export type PropertyStatus = "draft" | "active" | "inactive";

export type ReservationChannel =
  | "direct"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  // Sammelkanal für Portale ohne eigenen Wert (Expedia, Agoda …).
  | "ota_other";

// Anzeige-Labels (Deutsch) für property_type.
const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  ferienhaus: "Ferienhaus",
  appartement: "Appartement",
  glamping: "Glamping",
  tiny_house: "Tiny House",
  stellplatz: "Stellplatz",
  hausboot: "Hausboot",
};

// Iconify-Symbol (ph:*) je property_type für das Thumbnail.
const PROPERTY_TYPE_ICON: Record<PropertyType, string> = {
  ferienhaus: "ph:house",
  appartement: "ph:buildings",
  glamping: "ph:tent",
  tiny_house: "ph:house-line",
  stellplatz: "ph:caravan",
  hausboot: "ph:sailboat",
};

// property_status → Label + Badge-Variante (Status-Farben gem. BUILD_REFERENCE).
const PROPERTY_STATUS_META: Record<
  PropertyStatus,
  { label: string; variant: ComponentProps<typeof Badge>["variant"] }
> = {
  active: { label: "Aktiv", variant: "success" },
  draft: { label: "Entwurf", variant: "warning" },
  inactive: { label: "Inaktiv", variant: "secondary" },
};

// reservation_channel → Label + Iconify-Symbol (ph:*).
const CHANNEL_META: Record<
  ReservationChannel,
  { label: string; icon: string }
> = {
  direct: { label: "Direktbuchung", icon: "ph:link" },
  portal: { label: "Portal", icon: "ph:globe" },
  booking: { label: "Booking.com", icon: "ph:bed" },
  airbnb: { label: "Airbnb", icon: "ph:house-simple" },
  vrbo: { label: "Vrbo", icon: "ph:buildings" },
  ota_other: { label: "Anderes Portal", icon: "ph:globe-hemisphere-east" },
};

// Nächste Buchung: Eigentümer sieht nur Vorname + Channel (Lastenheft §6).
export type NextBooking = {
  firstName: string;
  channel: ReservationChannel;
  // Anzeigedatum (vorformatiert, z.B. "20. Jun"), optional.
  date?: string;
};

export type PropertyCardProps = ComponentProps<typeof Card> & {
  title: string;
  location: string;
  maxGuests: number;
  propertyType: PropertyType;
  propertyStatus: PropertyStatus;
  // Netto-Preis pro Nacht (glatt, ohne Cent) + Währungssymbol.
  netPricePerNight: number;
  currencySymbol?: string;
  // Optionale Thumbnail-URL; ohne URL → Icon-Platzhalter.
  thumbnailUrl?: string;
  nextBooking?: NextBooking;
  // Ladezustand: zeigt Skeletons statt Inhalt.
  loading?: boolean;
};

// Preis-Anzeige (Netto/Nacht) — glatte Beträge gem. Lastenheft.
function PriceDisplay({
  amount,
  currencySymbol = "€",
}: {
  amount: number;
  currencySymbol?: string;
}) {
  return (
    <p className="flex items-baseline gap-1">
      <span className="text-lg font-semibold text-foreground tabular-nums">
        {amount.toLocaleString("de-DE")} {currencySymbol}
      </span>
      <span className="text-xs text-muted-foreground">netto/Nacht</span>
    </p>
  );
}

export function PropertyCard({
  className,
  title,
  location,
  maxGuests,
  propertyType,
  propertyStatus,
  netPricePerNight,
  currencySymbol = "€",
  thumbnailUrl,
  nextBooking,
  loading = false,
  ...props
}: PropertyCardProps) {
  const statusMeta = PROPERTY_STATUS_META[propertyStatus];
  const typeLabel = PROPERTY_TYPE_LABEL[propertyType];
  const typeIcon = PROPERTY_TYPE_ICON[propertyType];

  if (loading) {
    return (
      <Card className={cn("w-80 overflow-hidden", className)} {...props}>
        <Skeleton className="h-40 w-full rounded-none" />
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn("w-80 overflow-hidden", className)} {...props}>
        {/* Thumbnail: Bild oder Icon-Platzhalter; Status-Badge oben rechts. */}
        <div className="relative h-40 w-full bg-secondary">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Icon icon={typeIcon} className="size-12" />
            </div>
          )}
          <span className="absolute right-3 top-3">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          </span>
        </div>

        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{title}</CardTitle>
            <Badge variant="outline" className="shrink-0">
              <Icon icon={typeIcon} className="size-3.5" />
              {typeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon icon="ph:map-pin" className="size-4" />
              <span className="truncate">{location}</span>
            </span>
            <span className="flex items-center gap-1">
              <Icon icon="ph:users" className="size-4" />
              {maxGuests} Gäste
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* Netto/Nacht via Preis-Anzeige. */}
          <PriceDisplay amount={netPricePerNight} currencySymbol={currencySymbol} />

          {/* Nächste Buchung: nur Vorname + Channel-Icon (Eigentümer-Sicht §6). */}
          <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
            <Icon icon="ph:calendar-check" className="size-4 text-muted-foreground" />
            {nextBooking ? (
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="font-medium">{nextBooking.firstName}</span>
                {nextBooking.date ? (
                  <span className="text-muted-foreground">
                    · {nextBooking.date}
                  </span>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground">
                      <Icon
                        icon={CHANNEL_META[nextBooking.channel].icon}
                        className="size-4"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {CHANNEL_META[nextBooking.channel].label}
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : (
              <span className="text-muted-foreground">Keine nächste Buchung</span>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
