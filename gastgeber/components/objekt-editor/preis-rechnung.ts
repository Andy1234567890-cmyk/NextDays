// Preis-Ableitungen (Airbnb-Pricing-Modell), rein funktional & testbar.
// KEINE erfundenen Ersatzwerte (Wurzel 4): fehlt der Grundpreis, gibt es keine
// Ableitung. Die Marktplatz-Provision (myNextDays-Modell, 0182) ist ein fester
// Systemwert von 8 % — NICHT Airbnbs 15,5 %. Sie steckt hart im Buchungsengine
// (payments, 800 bps); hier als benannte Konstante gespiegelt, nicht geraten.
export const MARKTPLATZ_FEE_PCT = 8;

/** Wochenendpreis (Fr+Sa) aus Grundpreis + Prozentaufschlag. Gerundet auf ganze
 *  Einheiten, wie Airbnb es anzeigt (59 × 1,01 = 59,59 → 60). */
export function wochenendPreis(basePrice: number, weekendPct: number): number {
  return Math.round(basePrice * (1 + weekendPct / 100));
}

/** Provision des Marktplatz-Kanals auf den Grundpreis (ganze Einheiten). */
export function marktplatzProvision(basePrice: number): number {
  return Math.round((basePrice * MARKTPLATZ_FEE_PCT) / 100);
}

/** Auszahlung an den Gastgeber = Grundpreis − Provision. */
export function auszahlung(basePrice: number): number {
  return basePrice - marktplatzProvision(basePrice);
}
