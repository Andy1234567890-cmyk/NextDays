"use client";

// Wiederverwendbarer Google-Places-Adress-Autocomplete. Liefert die Adresse
// STRUKTURIERT zurück (Straße, Hausnummer, PLZ, Stadt, Bundesland, Land, lat/lng)
// — kein Freitext-Raten/Regex (das war der Hausnummer-/Bundesland-Bug). Bringt
// den APIProvider selbst mit, damit die Komponente überall (Onboarding, /konto,
// Objekt-Standort) ohne zusätzliches Setup einsetzbar ist.
import {
  APIProvider,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

import { Input } from "@nextdays/ui/input";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export type PlacesAddress = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  state: string;
  country: string; // ISO-2 (short_name)
  lat: number | null;
  lng: number | null;
};

function Inner({
  id,
  value,
  onChange,
  onPick,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (addr: PlacesAddress) => void;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  // onPick in einer Ref halten: der Parent gibt bei jedem Render eine neue
  // Funktion; ohne Ref würde der place_changed-Listener am toten Objekt hängen
  // und die Auswahl NICHTS befüllen (Muster aus location-form.tsx).
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["address_components", "geometry"],
      types: ["address"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const comps = place.address_components ?? [];
      const get = (type: string, short = false) => {
        const c = comps.find((x: (typeof comps)[number]) => x.types.includes(type));
        return c ? (short ? c.short_name : c.long_name) : "";
      };
      onPickRef.current({
        street: get("route"),
        houseNumber: get("street_number"),
        postalCode: get("postal_code"),
        city:
          get("locality") ||
          get("postal_town") ||
          get("sublocality") ||
          get("administrative_area_level_2"),
        state: get("administrative_area_level_1"),
        country: get("country", true), // ISO-2 (Backend normalisiert ohnehin)
        lat: place.geometry?.location?.lat() ?? null,
        lng: place.geometry?.location?.lng() ?? null,
      });
    });
    return () => listener.remove();
  }, [places]);

  // Das ist DAS Straße-Feld selbst: manuell tippbar UND Autocomplete. Kein
  // zusätzliches Suchfeld (Nutzer-Vorgabe: hinter/aus den bestehenden Inputs).
  return (
    <Input
      id={id}
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Macht ein Straße-Input zum Places-Autocomplete: manuell editierbar (value/
// onChange) und befüllt bei Auswahl die gesamte Adresse strukturiert (onPick).
// Ohne API-Key Fallback auf ein normales Input (manuelle Eingabe bleibt möglich).
// `id` wird durchgereicht, damit das zugehörige <Label htmlFor> greift und die
// Zahlungen-Karte per document.getElementById auf das Straßenfeld springen kann
// (ohne id war beides eine Attrappe).
export function AddressPlacesSearch({
  id,
  value,
  onChange,
  onPick,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (addr: PlacesAddress) => void;
}) {
  if (!API_KEY) {
    return (
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <APIProvider apiKey={API_KEY}>
      <Inner id={id} value={value} onChange={onChange} onPick={onPick} />
    </APIProvider>
  );
}
