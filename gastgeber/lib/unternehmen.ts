// Unternehmensdaten des Betriebs (Airbnb „Business details").
//
// Quelle ist tenant_billing_profile — dieselben Daten, aus denen automatisch
// das Auszahlungskonto entsteht. Deshalb gibt es hier KEINE doppelten Felder:
// Was hier gepflegt wird, landet beim Speichern beim Zahlungsanbieter.
import { api } from "./api-server";

export interface Unternehmensprofil {
  id: string;
  /** Firmenname (Airbnb: „Legal business name"). */
  companyName: string;
  legalForm: string;
  /** Anschrift (Airbnb: „Registered business address"). */
  companyStreet: string;
  companyHouseNumber: string;
  companyPostalCode: string;
  companyCity: string;
  companyState: string;
  companyCountry: string;
  /** Geschäftliche Kontaktdaten. */
  email: string;
  phoneNumber: string;
  website: string;
  /** Register und Steuer (Airbnb: „Business registration details"). */
  companyRegister: string;
  districtCourt: string;
  vatId: string;
  taxNumber: string;
  /** Vertretungsberechtigte Person. */
  firstName: string;
  lastName: string;
  /** Kontotyp für die Zahlungsfreischaltung. */
  accountType: string;
  ownerDob: string;
  /** Letzter Sync-Fehler beim Zahlungsanbieter — sichtbar statt verschluckt. */
  stripeSyncError: string | null;
}

/**
 * Unternehmensprofil des eigenen Betriebs.
 *
 * `null` bei einem Ladefehler: Der Tab zeigt dann einen Hinweis, statt die
 * ganze Kontoseite scheitern zu lassen (Wurzel 5).
 */
export async function getUnternehmensprofil(): Promise<Unternehmensprofil | null> {
  try {
    // Der Scope kommt serverseitig aus dem Token — die ID im Pfad ist nur
    // Formsache, nie die Quelle der Autorisierung (Wurzel 3).
    return await api<Unternehmensprofil>("/buchhaltung/companies/self", {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
