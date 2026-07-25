"use server";

// Schreib-Action für den Verfügbarkeits-Editor: objektweiter Mindestaufenthalt →
// PATCH /rates/{rate_plan_id} (rate_plans.min_stay). Die übrigen Verfügbarkeits-
// werte (max_stay, Vorlaufzeit, Buchungsfenster, min-stay-Typ) liegen im
// type_attributes.availability-Blob und werden über die generische
// updateProperty-Action gespeichert (der Editor merged den Blob, Wurzel 1).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Objektweiten Mindestaufenthalt setzen (rate_plans.min_stay, min. 1 Nacht). */
export async function setMinStay(
  ratePlanId: string,
  propertyId: string,
  minStay: number,
): Promise<Result<{ min_stay: number }>> {
  try {
    const data = await api<{ min_stay: number }>(`/rates/${ratePlanId}`, {
      method: "PATCH",
      body: { min_stay: Math.max(1, Math.round(minStay)) },
    });
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Mindestaufenthalt konnte nicht gespeichert werden.",
    };
  }
}
