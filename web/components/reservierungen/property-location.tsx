"use client";

// Objekt-Standort im Buchungsdetail (Karte rechts oben): Google-Maps-Karte mit
// Marker + die Adresse. Koordinaten kommen aus properties.lat/lng.
//
// WARUM GOOGLE MAPS UND NICHT MEHR OSM (12.08.2026):
// Hier stand ein OpenStreetMap-iframe, und der war LIVE BLOCKIERT — die Karte
// zeigte „Dieser Inhalt ist blockiert". Ursache: unsere CSP
// (`packages/security-headers`) hat kein `frame-src`, also greift
// `default-src 'self'` und ein fremder iframe fliegt raus. Nicht OSM war schuld
// (der Embed antwortet 200 ohne Frame-Sperre), sondern die eigene Policy.
//
// Die CSP dafür aufzuweichen wäre der falsche Weg gewesen: das Projekt hat die
// Google-Maps-JS-API längst verdrahtet (`@vis.gl/react-google-maps`, Key in
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, `googleMaps: true` in web/next.config.ts) und
// rendert damit schon die Objekt-Standortkarte. Dieselbe Bibliothek hier
// bedeutet: keine neue CSP-Freigabe, kein iframe, eine Karten-Technik im
// Projekt statt zwei.
//
// Fehlen lat/lng, wird KEIN Punkt erfunden (Wurzel 4) — dann nur die Adresse als
// Text + „In Karte öffnen"-Link. Fehlt der API-Key, wird das BENANNT statt eine
// leere graue Fläche zu zeigen, die wie ein Defekt aussieht.
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { useTranslations } from "next-intl";

import { Icon } from "@iconify/react";

import { Card } from "@nextdays/ui/card";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
  const t = useTranslations("reservations");
  const address = addressLine(p);
  const hasCoords =
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng);

  // Kein Standort bekannt → Abschnitt weglassen (nichts Erfundenes zeigen).
  if (!hasCoords && !address) return null;

  const lat = p.lat as number;
  const lng = p.lng as number;
  // „In Karte öffnen": Google Maps in neuem Tab. Mit Koordinaten der exakte
  // Punkt, sonst die Adresssuche — nie ein geratener Ort (Wurzel 4).
  const openHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const propertyTitle = p.title || t("propertyLocation.defaultTitle");

  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      {hasCoords &&
        (API_KEY ? (
          <div className="h-44 w-full shrink-0">
            <APIProvider apiKey={API_KEY}>
              <Map
                defaultCenter={{ lat, lng }}
                defaultZoom={15}
                // Nur ansehen, nicht bearbeiten: im Buchungsdetail soll ein
                // Scrollen durch die Seite nicht in der Karte hängenbleiben.
                gestureHandling="cooperative"
                disableDefaultUI
                mapId="nextdays-location"
                style={{ width: "100%", height: "100%" }}
              >
                <Marker position={{ lat, lng }} />
              </Map>
            </APIProvider>
          </div>
        ) : (
          // Kein Key → sagen, was fehlt. Eine leere graue Fläche sähe wie ein
          // Defekt aus, und die Adresse darunter steht ohnehin (Wurzel 4/5).
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            {t("propertyLocation.missingMapsKey")}
          </p>
        ))}
      <div className="flex items-start justify-between gap-3 p-4 pt-0">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">{propertyTitle}</p>
          {address ? (
            <p className="text-sm text-muted-foreground">{address}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("propertyLocation.noAddress")}
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
          {t("propertyLocation.openInMap")}
        </a>
      </div>
    </Card>
  );
}
