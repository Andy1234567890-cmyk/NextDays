"use server";

// Schreib-Actions für die Objektsteuern des Gastgebers.
//
// Wichtig: Diese Steuern bewegen kein Geld von der Auszahlung — sie werden dem
// Gast zusätzlich berechnet und an den Gastgeber durchgereicht, der sie selbst
// abführt. Sie sind ein durchlaufender Posten und nie Provisionsbasis.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { ObjektSteuer, ObjektSteuerInput } from "./objekt-steuern";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fehler(exc: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: exc instanceof ApiError ? exc.message : fallback };
}

export async function legeSteuerAn(
  propertyId: string,
  daten: ObjektSteuerInput,
): Promise<Result<ObjektSteuer>> {
  try {
    const data = await api<ObjektSteuer>(`/properties/${propertyId}/taxes`, {
      method: "POST",
      body: daten,
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return fehler(exc, "Die Steuer konnte nicht angelegt werden.");
  }
}

export async function aendereSteuer(
  propertyId: string,
  taxId: string,
  daten: ObjektSteuerInput,
): Promise<Result<ObjektSteuer>> {
  try {
    const data = await api<ObjektSteuer>(`/properties/taxes/${taxId}`, {
      method: "PUT",
      body: daten,
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return fehler(exc, "Die Steuer konnte nicht geändert werden.");
  }
}

export async function loescheSteuer(
  propertyId: string,
  taxId: string,
): Promise<Result<null>> {
  try {
    await api(`/properties/taxes/${taxId}`, { method: "DELETE" });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data: null };
  } catch (exc) {
    return fehler(exc, "Die Steuer konnte nicht entfernt werden.");
  }
}
