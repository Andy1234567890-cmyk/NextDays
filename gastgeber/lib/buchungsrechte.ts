// Data-Layer Buchungsberechtigungen (Server Component) über den DAL.
//
// Airbnb führt das als EIN Feld am Inserat (`instant_booking_allowed_category`,
// Hilfe-Artikel 484 · 1170 · 1237): Sofortbuchung an oder aus, und wenn an, für
// wen. Bei uns sind es zwei Felder, die zusammen dieselben Zustände ergeben —
// siehe Migration 0718.
import { api, ApiError } from "./api-server";

/** Airbnb: Sofortbuchung (`everyone` …) oder Anfrage (`off`). */
export type Buchungsmodus = "instant" | "request";

/** Airbnbs vier „an"-Kategorien. */
export type Zielgruppe =
  | "everyone"
  | "guests_with_verified_identity"
  | "well_reviewed_guests"
  | "well_reviewed_guests_with_verified_identity";

export interface Buchungsberechtigung {
  modus: Buchungsmodus;
  zielgruppe: Zielgruppe;
  /** Airbnb „Nachricht vor der Buchung": null/leer = keine Frage. */
  vorab_frage: string | null;
  objekte_gesamt: number;
  /** Objekte, die anders eingestellt sind als die Entscheidung des Betriebs —
   *  etwa weil sie im Objekt-Assistenten abweichend angelegt wurden. */
  objekte_abweichend: number;
}

/** Die beiden Voraussetzungen als Schalter — so zeigt Airbnb sie auch. */
export interface Voraussetzungen {
  identitaet: boolean;
  vorgeschichte: boolean;
}

/** Enum → zwei Schalter. */
export function ausZielgruppe(z: Zielgruppe): Voraussetzungen {
  return {
    identitaet: z.includes("verified_identity"),
    vorgeschichte: z.startsWith("well_reviewed"),
  };
}

/** Zwei Schalter → Enum. Die vier Werte sind genau die vier Kombinationen. */
export function zuZielgruppe(v: Voraussetzungen): Zielgruppe {
  if (v.identitaet && v.vorgeschichte) {
    return "well_reviewed_guests_with_verified_identity";
  }
  if (v.identitaet) return "guests_with_verified_identity";
  if (v.vorgeschichte) return "well_reviewed_guests";
  return "everyone";
}

/**
 * Die Buchungsberechtigung des Betriebs.
 *
 * null bei fehlendem Zugriff — die Oberfläche sagt das dann, statt eine
 * Einstellung zu zeigen, die sie nicht kennt (Wurzel 4/5).
 */
export async function getBuchungsberechtigung(): Promise<Buchungsberechtigung | null> {
  try {
    return await api<Buchungsberechtigung>("/booking-access", {
      cache: "no-store",
    });
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
