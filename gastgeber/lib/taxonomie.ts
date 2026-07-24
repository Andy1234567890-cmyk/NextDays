"use client";

// Client-Zugriff auf die Objekt-Taxonomie (Kategorien + Immobilientypen) über den
// eigenen BFF-Route-Handler. Kein direkter Backend-Zugriff aus dem Browser.
import type { ListingType } from "./properties";

export interface PropertyCategory {
  slug: string;
  label_de: string;
  sort_order: number;
}

export interface PropertySubtype {
  slug: string;
  label_de: string;
  category_slug: string;
  listing_types: ListingType[];
  sort_order: number;
}

export interface Taxonomy {
  categories: PropertyCategory[];
  subtypes: PropertySubtype[];
}

/** Kategorien + Immobilientypen laden (Referenzkatalog, selten geändert). */
export async function getTaxonomy(): Promise<Taxonomy> {
  const res = await fetch("/api/objekte/taxonomie");
  if (!res.ok) throw new Error(`Taxonomie laden fehlgeschlagen (${res.status})`);
  return (await res.json()) as Taxonomy;
}
