// Buchungsbedingungen (`booking_conditions`, Migration 0165) — Zahlungsplan,
// STORNIERUNG und Kaution als wiederverwendbare Vorlage des Betriebs.
//
// Sie ist die Antwort auf Airbnbs Panel-Zeile „Stornierungen": dort steht, was
// ein Gast zurückbekommt, wenn er absagt. Bei uns liegt das nicht am Objekt,
// sondern an einer Vorlage, die am PREISPLAN hängt
// (`rate_plans.booking_condition_id`); ohne eigene Zuordnung gilt die Vorlage
// des Betriebs mit `is_default`. Genau diese Auflösung macht `geltendeBedingung`
// — sie steht hier EINMAL, damit Kalender, Angebot und Buchungsstrecke nicht
// jeweils ihre eigene Antwort erfinden.
import { api } from "./api-server";

/** Eine Staffel: X % zurück, wenn mindestens Y Tage vor Anreise storniert wird. */
export interface Erstattungsregel {
  refund_percent: number;
  days_before_arrival: number;
}

export interface Buchungsbedingung {
  id: string;
  internal_name: string;
  is_default: boolean;
  /** `non_refundable` = keine Erstattung, `refundable` = volle, `partial` = Staffel. */
  cancellation_mode: "non_refundable" | "refundable" | "partial";
  refund_rules: Erstattungsregel[];
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_currency: string | null;
}

/** Alle Vorlagen des Betriebs. Leere Liste heißt: es gibt noch keine. */
export async function getBuchungsbedingungen(): Promise<Buchungsbedingung[]> {
  return api<Buchungsbedingung[]>("/booking-conditions", { cache: "no-store" });
}

/**
 * Die Bedingung, die für dieses Objekt WIRKLICH gilt.
 *
 * Reihenfolge wie im Backend (`booking_conditions/plan.py`): die am Preisplan
 * hinterlegte, sonst die Standard-Vorlage des Betriebs. Gibt es keine von
 * beiden, ist die Antwort `null` — und die Oberfläche sagt das, statt eine
 * Bedingung zu erfinden (Wurzel 4).
 */
export function geltendeBedingung(
  bedingungen: Buchungsbedingung[],
  zugeordneteId: string | null,
): Buchungsbedingung | null {
  if (zugeordneteId) {
    const eigene = bedingungen.find((b) => b.id === zugeordneteId);
    if (eigene) return eigene;
  }
  return bedingungen.find((b) => b.is_default) ?? null;
}
