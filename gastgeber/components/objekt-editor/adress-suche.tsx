"use client";

// Google-Places-Adress-Autocomplete (portiert aus web/components/address-places-
// search.tsx). Liefert die Adresse STRUKTURIERT zurück (Straße, Hausnummer, PLZ,
// Stadt, Bundesland, Land ISO-2, lat/lng) — kein Freitext-Regex-Raten. Bringt den
// APIProvider selbst mit. Ohne API-Key Fallback auf ein normales Input.
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
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
  value,
  onChange,
  onPick,
  placeholder,
  cityOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (addr: PlacesAddress) => void;
  placeholder?: string;
  // Nur Städte statt voller Adressen (Airbnb „Wo ich wohne / Suche nach deiner
  // Stadt"). Ergebnis trägt city/state/country, keine Straße/Hausnummer.
  cityOnly?: boolean;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  // onPick in Ref halten: der Parent gibt bei jedem Render eine neue Funktion;
  // ohne Ref hinge der place_changed-Listener am toten Objekt.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!places || !inputRef.current) return;
    // Kein `types`-Filter im cityOnly-Modus: `["(cities)"]` ist eine restriktive
    // Google-Collection, die weltweit lückenhaft ist (viele Orte werden NICHT
    // vorgeschlagen). Ohne Filter liefert Places alle Ergebnistypen weltweit
    // (Städte, Regionen, Orte) — die city/country-Komponenten ziehen wir unten
    // heraus. Für die volle Adresssuche bleibt `["address"]`.
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["address_components", "geometry"],
      ...(cityOnly ? {} : { types: ["address"] }),
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
        country: get("country", true),
        lat: place.geometry?.location?.lat() ?? null,
        lng: place.geometry?.location?.lng() ?? null,
      });
    });
    return () => listener.remove();
  }, [places, cityOnly]);

  return (
    <Input
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function AdressSuche({
  value,
  onChange,
  onPick,
  placeholder,
  cityOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (addr: PlacesAddress) => void;
  placeholder?: string;
  cityOnly?: boolean;
}) {
  if (!API_KEY) {
    return (
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <APIProvider apiKey={API_KEY}>
      <Inner
        value={value}
        onChange={onChange}
        onPick={onPick}
        placeholder={placeholder}
        cityOnly={cityOnly}
      />
    </APIProvider>
  );
}
