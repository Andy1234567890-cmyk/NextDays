"use server";

// Schreib-Actions des Airbnb-Pricing-Editors → an die ECHTE Preis-Wahrheit, nicht
// in den type_attributes.pricing-Blob (den der Resolver ignoriert):
//   • Grundpreis   → PUT /rates/base-price      (rate_plans.base_price, Upsert)
//   • Smart Pricing → PUT /pricing/settings/{id} (dp_settings, PATCH-Semantik)
//   • Rabatte      → POST/PATCH/DELETE /pricing/discounts/{id} (property_discounts)
//
// Rabatt-Prozente kommen als Basispunkte in die DB (bps = pct·100). Ein leerer
// Prozentwert bedeutet „Rabatt löschen" (Wurzel 1: Gegenzustand mitpflegen —
// nicht eine tote 0-%-Regel stehen lassen).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import {
  getMarktVergleich,
  type Discount,
  type DpSettings,
  type MarktVergleich,
  type SmartVorschlag,
} from "./preise";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fehler(exc: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: exc instanceof ApiError ? exc.message : fallback };
}

/** Marktvergleich laden (Client-Action, lazy bei Klick auf „Ähnliche ansehen").
 *  Reicht den Server-Read durch — echte Marktplatz-Preise, kein Fake. Fehler
 *  werden hier abgefangen (Best-effort-Read, Wurzel 5): ein Throw würde im Client
 *  als „unexpected response" ankommen, statt als leerer Vergleich. */
export async function ladeMarktVergleich(
  propertyId: string,
  eigeneKoords: { lat: number; lng: number } | null,
  guests: number,
): Promise<MarktVergleich> {
  try {
    return await getMarktVergleich(propertyId, eigeneKoords, guests);
  } catch {
    return { anzahl: 0, min: null, max: null, currency: null, eigenesTyp: null, punkte: [] };
  }
}

/** Grundpreis setzen (rate_plans.base_price, Upsert). currency ist Pflicht —
 *  die Objektwährung ist die Wahrheit (kein €-Default, Wurzel 4). */
export async function setBasePrice(
  propertyId: string,
  basePrice: number,
  currency: string,
): Promise<Result<{ base_price: number }>> {
  try {
    const data = await api<{ base_price: number }>("/rates/base-price", {
      method: "PUT",
      body: { property_id: propertyId, base_price: basePrice, currency },
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return fehler(exc, "Grundpreis konnte nicht gespeichert werden.");
  }
}

/** Empfohlene Smart-Pricing-Spanne aus der ECHTEN Dynamic-Pricing-Engine
 *  (nachfrage-/saison-/wochenend-getriebene Tagespreis-Extrema über 120 Tage) —
 *  kein geratener Multiplikator. Fehler/fehlende Datengrundlage → available:false
 *  (Best-effort-Read, kein „unexpected response"). */
export async function ladeSmartVorschlag(propertyId: string): Promise<SmartVorschlag> {
  try {
    const d = await api<{
      available: boolean;
      min_price: number | null;
      max_price: number | null;
    }>(`/pricing/settings/${propertyId}/suggest`);
    return { available: d.available, min_price: d.min_price, max_price: d.max_price };
  } catch {
    return { available: false, min_price: null, max_price: null };
  }
}

/** Smart-Pricing / dp_settings patchen (nur gesendete Felder). Reicht das
 *  Wochenend-Uplift mit durch, da es dieselbe Tabelle ist. */
export async function updateSmartPricing(
  propertyId: string,
  fields: Partial<Pick<DpSettings, "enabled" | "min_price" | "max_price" | "weekend_uplift_pct">>,
): Promise<Result<DpSettings>> {
  try {
    const data = await api<DpSettings>(`/pricing/settings/${propertyId}`, {
      method: "PUT",
      body: fields,
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return fehler(exc, "Smart Pricing konnte nicht gespeichert werden.");
  }
}

/** Längen-Rabatt (Wochen-/Monatsrabatt) setzen/aktualisieren/löschen.
 *  pct=undefined → Rabatt löschen (falls vorhanden). minNights 7 = Woche, 28 =
 *  Monat. bps = round(pct·100). Vorhandene Regel wird gepatcht (idempotent). */
export async function setLengthDiscount(
  propertyId: string,
  minNights: number,
  pct: number | undefined,
  existing: Discount | null,
): Promise<Result<Discount | null>> {
  try {
    // Löschen: Prozent leer, aber es gibt eine Regel.
    if (pct == null || pct <= 0) {
      if (existing) {
        await api<void>(`/pricing/discounts/${propertyId}/${existing.id}`, {
          method: "DELETE",
        });
        revalidatePath(`/objekte/${propertyId}`);
      }
      return { ok: true, data: null };
    }

    const bps = Math.round(pct * 100);
    if (existing) {
      // Bestehende Regel: nur die Höhe patchen (Typ/min_nights bleiben).
      const data = await api<Discount>(
        `/pricing/discounts/${propertyId}/${existing.id}`,
        { method: "PATCH", body: { discount_bps: bps, active: true } },
      );
      revalidatePath(`/objekte/${propertyId}`);
      return { ok: true, data };
    }

    // Neue Regel anlegen.
    const data = await api<Discount>(`/pricing/discounts/${propertyId}`, {
      method: "POST",
      body: {
        discount_type: "length_of_stay",
        discount_bps: bps,
        min_nights: minNights,
      },
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return fehler(exc, "Rabatt konnte nicht gespeichert werden.");
  }
}
