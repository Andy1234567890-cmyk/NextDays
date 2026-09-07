"use server";

// Schreib-Action für die Stornobedingung eines Objekts.
//
// Sie hängt am PREISPLAN (`rate_plans.booking_condition_id`, 0165), nicht am
// Objekt — deshalb geht der PATCH an `/rates/{id}` und nicht an `/properties`.
// `null` ist dabei eine ECHTE Angabe: „keine eigene Bedingung, es gilt der
// Standard des Betriebs". Ohne diesen Weg ließe sich eine einmal gesetzte
// Zuordnung nie wieder lösen (Gegenzustand, Wurzel 1).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

export async function setzeBuchungsbedingung(
  ratePlanId: string,
  propertyId: string,
  bedingungId: string | null,
  /** Für welchen Fall — kurze Aufenthalte oder lange (ab 28 Nächten, 0579). */
  ziel: "kurz" | "lang" = "kurz",
): Promise<Ergebnis<{ booking_condition_id: string | null }>> {
  const feld = ziel === "lang" ? "booking_condition_long_id" : "booking_condition_id";
  try {
    const data = await api<{ booking_condition_id: string | null }>(
      `/rates/${encodeURIComponent(ratePlanId)}`,
      { method: "PATCH", body: { [feld]: bedingungId } },
    );
    revalidatePath(`/kalender/${propertyId}`);
    revalidatePath(`/objekte/${propertyId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Stornobedingung konnte nicht gespeichert werden.",
    };
  }
}

/**
 * Eine neue Buchungsbedingung anlegen — im Kalender-Panel, nicht im Konto.
 *
 * Der leere Zustand sagte „Lege eine an" und bot keinen Weg dorthin; eine
 * Aufforderung ohne Knopf ist eine Sackgasse. Angelegt wird das Nötigste:
 * Name, Storno-Modus und (bei gestaffelter Erstattung) die Staffel. Alles
 * Weitere — Zahlungsplan, Kaution — bleibt der vollen Maske im Konto
 * vorbehalten; die Vorgaben des Backends greifen dafür.
 */
export async function legeBuchungsbedingungAn(
  eingabe: {
    internal_name: string;
    cancellation_mode: "non_refundable" | "refundable" | "partial";
    refund_rules: { refund_percent: number; days_before_arrival: number }[];
    is_default: boolean;
  },
): Promise<Ergebnis<{ id: string }>> {
  try {
    const data = await api<{ id: string }>("/booking-conditions", {
      method: "POST",
      body: eingabe,
    });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Bedingung konnte nicht angelegt werden.",
    };
  }
}
