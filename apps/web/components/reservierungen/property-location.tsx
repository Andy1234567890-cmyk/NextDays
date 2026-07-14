"use client";

// Objekt-Standort im Buchungsdetail (..: Karte rechts oben). Zeigt die
// eingebettete OpenStreetMap-Karte mit Marker + die Adresse. Bewusst OHNE
// Google/Mapbox (kein API-Key, kein Fremd-Branding — passt zu white-label und
// dem self-hosted-Prinzip). Koordinaten kommen aus properties.lat/lng.
//
// Fehlen lat/lng, wird KEIN Punkt erfunden (Wurzel 4) — dann nur die Adresse als
// Text + „In Karte öffnen"-Link (öffnet die Standard-Karten-App per geo:/OSM).
import { Icon } from "@iconify/react";

import { Card } from "@/components/ui/card";

type LocationProps = {
  title: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

// Adresse als eine Zeile (nur vorhandene Teile, kein „null"/Leerzeichen-Salat).
function addressLine(p: LocationProps): string {
  const parts = [
    p.street,
    [p.postalCode, p.city].filter(Boolean).join(" ").trim() || null,
    p.country,
  ].filter((s): s is string => Boolean(s && s.trim()));
  return parts.join(", ");
}

export function PropertyLocation(p: LocationProps) {
  const address = addressLine(p);
  const hasCoords =
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng);

  // Kein Standort bekannt → Abschnitt weglassen (nichts Erfundenes zeigen).
  if (!hasCoords && !address) return null;

  // OSM-Embed: kleine BBox um den Punkt + Marker. Kein Key, kein Tracking-Skript.
  const lat = p.lat as number;
  const lng = p.lng as number;
  const d = 0.008; // ~800 m Kantenlänge → Straßen-Zoom wie bei ..
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  // „In Karte öffnen": vollständige OSM-Ansicht (öffnet extern in neuem Tab).
  const openHref = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      {hasCoords && (
        <iframe
          title={`Standort von ${p.title || "Objekt"}`}
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-44 w-full border-0"
        />
      )}
      <div className="flex items-start justify-between gap-3 p-4 pt-0">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">
            {p.title || "Objekt"}
          </p>
          {address ? (
            <p className="text-sm text-muted-foreground">{address}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Adresse hinterlegt.
            </p>
          )}
        </div>
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Icon icon="ph:map-pin" className="size-4" />
          In Karte öffnen
        </a>
      </div>
    </Card>
  );
}
