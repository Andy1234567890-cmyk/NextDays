"use client";

// Client-Zugriff auf Objekt-Fotos über die eigenen BFF-Route-Handler
// (app/api/objekte/[id]/fotos). Kein direkter Backend-/Supabase-Zugriff aus dem
// Browser — der Route-Handler hängt den Host-Cookie-Bearer an (BFF).
import { fuerUploadVorbereiten } from "./foto-konvertierung";

export interface PropertyPhoto {
  id: string;
  property_id: string;
  url: string;
  sort_order: number;
  is_cover: boolean;
  caption: Record<string, string>;
  author: string | null;
}

interface PhotoList {
  items: PropertyPhoto[];
  total: number;
}

/** Alle Fotos eines Objekts. */
export async function listPhotos(propertyId: string): Promise<PropertyPhoto[]> {
  const res = await fetch(`/api/objekte/${propertyId}/fotos`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fotos laden fehlgeschlagen (${res.status})`);
  const data = (await res.json()) as PhotoList;
  return data.items;
}

/** Ein Foto hochladen. Moderne Formate (AVIF/WebP/HEIC/HEIF) werden vorher
 *  client-seitig zu JPEG konvertiert (Backend nimmt nur JPEG/PNG). Gibt das
 *  angelegte Foto zurück. */
export async function uploadPhoto(
  propertyId: string,
  datei: File,
): Promise<PropertyPhoto> {
  const vorbereitet = await fuerUploadVorbereiten(datei);
  const form = new FormData();
  form.append("file", vorbereitet);
  const res = await fetch(`/api/objekte/${propertyId}/fotos`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload fehlgeschlagen (${res.status})`);
  }
  return (await res.json()) as PropertyPhoto;
}

/** Ein Foto löschen. */
export async function deletePhoto(
  propertyId: string,
  fotoId: string,
): Promise<void> {
  const res = await fetch(`/api/objekte/${propertyId}/fotos/${fotoId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Löschen fehlgeschlagen (${res.status})`);
  }
}
