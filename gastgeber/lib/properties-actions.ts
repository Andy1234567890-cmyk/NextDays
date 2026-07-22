"use server";

// Schreib-Actions für Objekte (Server Actions — Mutationen laufen server-zu-
// server über den Host-Cookie-DAL). Getrennt vom Read-Layer (properties.ts),
// weil Server Actions "use server" brauchen.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Property } from "./properties";

export interface CreatePropertyInput {
  title: string;
  property_type: string;
  max_guests: number;
  currency: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Neues Objekt als Entwurf anlegen (draft). Veröffentlicht wird erst nach
 *  hinterlegtem Preis (publishProperty). */
export async function createProperty(
  input: CreatePropertyInput,
): Promise<Result<Property>> {
  try {
    const data = await api<Property>("/properties", {
      method: "POST",
      body: input,
    });
    revalidatePath("/objekte");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError ? exc.message : "Objekt konnte nicht angelegt werden.",
    };
  }
}

/** Objekt veröffentlichen (draft→active). Backend verlangt einen hinterlegten
 *  Preis — ohne Preis gibt es einen sprechenden Fehler zurück. */
export async function publishProperty(id: string): Promise<Result<Property>> {
  try {
    const data = await api<Property>(`/properties/${id}/publish`, {
      method: "POST",
    });
    revalidatePath("/objekte");
    revalidatePath(`/objekte/${id}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError ? exc.message : "Veröffentlichen fehlgeschlagen.",
    };
  }
}
