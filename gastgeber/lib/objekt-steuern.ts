// Steuern eines Objekts lesen (Server-Read).
//
// Das sind die Steuern, die der GASTGEBER festlegt und selbst abführt — nicht
// zu verwechseln mit `lib/steuern.ts` (Steuerzahler-Angaben des Betriebs für
// die Meldepflicht). Die Plattform behält von der Auszahlung nichts ein: die
// Steuer wird dem Gast zusätzlich berechnet und durchgereicht.
import { api } from "./api-server";

export type ChargeMode =
  | "percentage_per_booking"
  | "per_guest"
  | "per_night"
  | "per_guest_per_night";

export type TaxableBase =
  | "base_price"
  | "cleaning_fee"
  | "linen_fee"
  | "resort_fee"
  | "management_fee"
  | "community_fee";

export interface ObjektSteuer {
  id: string;
  property_id: string;
  tax_type: string;
  charge_mode: ChargeMode;
  /** Basispunkte (500 = 5 %). Nur bei percentage_per_booking. */
  rate_bps: number | null;
  /** Kleinste Währungseinheit. Nur bei Festbeträgen. */
  amount_minor: number | null;
  taxable_base: TaxableBase[];
  registration_number: string;
  long_stay_exempt_nights: number | null;
  taxable_first_nights: number | null;
  max_amount_minor: number | null;
  active: boolean;
}

export type ObjektSteuerInput = Omit<ObjektSteuer, "id" | "property_id">;

/** Vorschläge für die Steuerart.
 *
 *  Bewusst eine VORSCHLAGSLISTE und kein Enum: Airbnb nennt öffentlich nur
 *  vier Arten und schreibt ausdrücklich „and others", die verfügbaren Arten
 *  hängen zudem vom Land ab. Ein festes Enum hätte geraten werden müssen
 *  (Wurzel 4). Der Gastgeber kann eintragen, was seine Behörde verlangt. */
export const STEUERART_VORSCHLAEGE = [
  "Kurtaxe",
  "Tourismusabgabe",
  "Übernachtungssteuer",
  "Beherbergungssteuer",
  "Umsatzsteuer",
  "Gemeindeabgabe",
  "Kulturförderabgabe",
] as const;

export const ABRECHNUNGSART: Record<ChargeMode, string> = {
  percentage_per_booking: "Prozentsatz pro Buchung",
  per_guest: "Betrag pro Gast",
  per_night: "Betrag pro Nacht",
  per_guest_per_night: "Betrag pro Gast und Nacht",
};

/** Worauf ein Prozentsatz rechnet. Die Servicegebühr der Plattform fehlt
 *  bewusst und darf nie dazukommen — sie ist unser Entgelt, nicht die
 *  Leistung des Gastgebers. Airbnb schließt sie ebenso aus. */
export const BEMESSUNGSGRUNDLAGE: Record<TaxableBase, string> = {
  base_price: "Grundpreis",
  cleaning_fee: "Reinigungsgebühr",
  linen_fee: "Bettwäschegebühr",
  resort_fee: "Resortgebühr",
  management_fee: "Verwaltungsgebühr",
  community_fee: "Gemeinschaftsgebühr",
};

export async function getObjektSteuern(
  propertyId: string,
): Promise<ObjektSteuer[] | null> {
  try {
    return await api<ObjektSteuer[]>(`/properties/${propertyId}/taxes`);
  } catch {
    // Ein Ladefehler darf den Objekt-Editor nicht blockieren; das Panel zeigt
    // dann einen Hinweis statt einer leeren Liste, die „keine Steuern"
    // behaupten würde (Wurzel 5).
    return null;
  }
}
