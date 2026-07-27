// Data-Layer Steuerzahler-Angaben (Server Component) über den DAL.
// GET /taxpayer liefert die Einträge je Land, die noch fehlenden Länder (vom
// Server aus den Objekten abgeleitet) und die USt-IdNr. aus dem Rechnungsprofil.
//
// Hintergrund: Als Plattform müssen wir nach DAC7/PStTG Angaben über unsere
// Anbieter erheben und jährlich melden — je Land, in dem der Betrieb ansässig
// ist oder Objekte hat.
import { api, ApiError } from "./api-server";

export type TaxpayerKind = "individual" | "entity";

export interface TaxpayerEntry {
  id: string;
  country: string;
  kind: TaxpayerKind;
  tin: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  birth_place_city: string | null;
  birth_place_country: string | null;
  legal_name: string | null;
  business_registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  confirmed_at: string | null;
  updated_at: string | null;
}

export interface TaxpayerOverview {
  eintraege: TaxpayerEntry[];
  /** Länder mit Objekten, für die noch keine Steuerangaben vorliegen. */
  fehlende_laender: string[];
  /** Nur zur Anzeige — gespeichert wird sie im Rechnungsprofil, nicht hier. */
  vat_id: string | null;
}

/** Steuerangaben des Betriebs (oder null bei fehlendem Zugriff/Rolle —
 *  die UI zeigt dann eine Meldung, keinen Fantasie-Default). */
export async function getTaxpayerOverview(): Promise<TaxpayerOverview | null> {
  try {
    return await api<TaxpayerOverview>("/taxpayer");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Eingabedaten des Wizards. Welche Felder Pflicht sind, prüft der Server
 *  (und zusätzlich ein DB-Constraint) — die UI führt nur durch die Schritte. */
export interface TaxpayerInput {
  country: string;
  kind: TaxpayerKind;
  tin?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  birth_place_city?: string | null;
  birth_place_country?: string | null;
  legal_name?: string | null;
  business_registration_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
}
