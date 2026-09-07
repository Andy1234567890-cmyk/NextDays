"use server";

// Unternehmensdaten ändern (Airbnb „Business details").
//
// WICHTIG: Diese Daten gehen beim Speichern automatisch an den
// Zahlungsanbieter — daraus entsteht das Auszahlungskonto. Deshalb wird hier
// immer der VOLLSTÄNDIGE Stand gesendet, nicht nur das geänderte Feld: Ein
// Teil-Update würde die übrigen Angaben beim Anbieter leeren und das Konto
// dauerhaft unvollständig lassen.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Unternehmensprofil } from "./unternehmen";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/** Felder, die der Nutzer in diesem Tab ändern darf. */
export type UnternehmensFeld =
  | "companyName"
  | "legalForm"
  | "companyStreet"
  | "companyHouseNumber"
  | "companyPostalCode"
  | "companyCity"
  | "companyState"
  | "companyCountry"
  | "email"
  | "phoneNumber"
  | "website"
  | "companyRegister"
  | "districtCourt"
  | "vatId"
  | "taxNumber"
  | "firstName"
  | "lastName"
  // Kontotyp beim Zahlungsanbieter ("individual" | "company") — der Gastgeber
  // legt ihn SELBST fest (Airbnb: „Vermietest du als Unternehmen?"), wir
  // dürfen ihn nicht für ihn bestimmen.
  | "accountType"
  // Geburtsdatum (ISO yyyy-mm-dd) — KYC-Pflicht für die Person, bei Firmen
  // für die vertretungsberechtigte Person.
  | "ownerDob";

export async function speichereUnternehmensdaten(
  bestand: Unternehmensprofil,
  aenderungen: Partial<Record<UnternehmensFeld, string>>,
): Promise<Ergebnis<Unternehmensprofil>> {
  try {
    const data = await api<Unternehmensprofil>(
      "/buchhaltung/companies/self",
      {
        method: "PATCH",
        // Vollständiger Stand plus Änderung — siehe Kommentar oben.
        body: { ...bestand, ...aenderungen },
      },
    );
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Daten konnten nicht gespeichert werden.",
    };
  }
}
