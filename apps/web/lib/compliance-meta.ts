// Compliance-Daten eines Objekts (wie Lodgify „Compliance" → Website).
// Aktuell: Registrierungsnummer(n) für die eigene Website. Für Airbnb/
// Booking.com werden die Nummern direkt in deren Plattform gepflegt.
// Gespeichert im flexiblen Feld type_attributes.compliance.

export const REGISTRATION_MAX_LENGTH = 100;

export type Compliance = {
  // Komma-getrennte Registrierungsnummern (Roh-String, wie eingegeben).
  registrationNumbers: string;
};

export const DEFAULT_COMPLIANCE: Compliance = {
  registrationNumbers: "",
};

// Liest die Compliance-Daten robust aus type_attributes (unbekannte Form).
export function readCompliance(attrs: Record<string, unknown>): Compliance {
  const raw = attrs?.compliance;
  if (raw && typeof raw === "object") {
    const c = raw as Partial<Compliance>;
    return {
      registrationNumbers:
        typeof c.registrationNumbers === "string" ? c.registrationNumbers : "",
    };
  }
  return { ...DEFAULT_COMPLIANCE };
}

// Einzelne, getrimmte Nummern (leere Einträge entfernt) – für die Vorschau.
export function registrationList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
