// Abrechnungsbasis einer Beleg-Position (0698) — pure Helfer, keine React-Abhängigkeit.
//
// Übernachtungsbetriebe rechnen Positionen nicht in „Stück", sondern je Nacht,
// je Person, je Person und Nacht oder pauschal (Recherche 13.09.2026 über
// Smoobu, Hostaway, Guesty, Beds24, Cloudbeds, Mews, apaleo, Newbook, Campspot,
// igumbi: überall dieselbe feste Menge). Die MENGE einer Position folgt aus der
// Basis und den Kopfdaten des Belegs (Nächte aus Aufenthalt, Personenzahl) und
// bleibt danach überschreibbar. Die Werte spiegeln `addons.schemas.AddonBasis`
// des Backends plus `per_guest_night`.

export const POSITIONS_BASEN = [
  'per_stay',
  'per_night',
  'per_guest',
  'per_guest_night',
  'per_unit',
] as const;

export type PositionsBasis = (typeof POSITIONS_BASEN)[number];

export function istPositionsBasis(wert: unknown): wert is PositionsBasis {
  return typeof wert === 'string' && (POSITIONS_BASEN as readonly string[]).includes(wert);
}

/** Nächte zwischen zwei Daten (Anreise/Abreise); 0, wenn unvollständig oder verkehrt. */
export function naechteAus(von?: Date | string | null, bis?: Date | string | null): number {
  if (!von || !bis) return 0;
  const a = typeof von === 'string' ? new Date(`${von}T00:00:00`) : von;
  const b = typeof bis === 'string' ? new Date(`${bis}T00:00:00`) : bis;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const tage = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return tage > 0 ? tage : 0;
}

/**
 * Menge einer Position aus Basis und Kopfdaten. `null`, wenn die Basis keine
 * Menge vorgibt (Stück) oder die Kopfdaten fehlen — dann bleibt die Menge, wie
 * sie ist, statt dass eine 0 oder 1 erfunden wird.
 */
export function mengeAusBasis(
  basis: PositionsBasis,
  naechte: number,
  personen: number,
): number | null {
  switch (basis) {
    case 'per_stay':
      return 1;
    case 'per_night':
      return naechte > 0 ? naechte : null;
    case 'per_guest':
      return personen > 0 ? personen : null;
    case 'per_guest_night':
      return naechte > 0 && personen > 0 ? naechte * personen : null;
    default:
      return null;
  }
}

/** Steuerliche Kategorie einer Position — bestimmt die Vorbelegung des Satzes. */
export type PositionsKategorie = 'lodging' | 'service' | 'levy';

/**
 * Vorbelegter Steuersatz je Kategorie aus den Stammdaten des Betriebs.
 * Übernachtung → Übernachtungssatz, Leistung → Regelsatz, Abgabe (Kurtaxe) → 0
 * als durchlaufender Posten. `null`, wenn der Betrieb den Satz nicht hinterlegt
 * hat — das Feld bleibt dann leer und Pflicht (Wurzel 4: kein Ersatzwert).
 */
export function steuersatzFuer(
  kategorie: PositionsKategorie,
  saetze: { lodging: number | null; standard: number | null },
): number | null {
  if (kategorie === 'levy') return 0;
  if (kategorie === 'lodging') return saetze.lodging;
  return saetze.standard;
}

/** Basis, wenn ein alter Beleg nur eine Freitext-Einheit trägt. */
export function basisAusEinheit(einheit: string | undefined): PositionsBasis {
  const e = (einheit || '').trim().toLowerCase();
  if (!e) return 'per_unit';
  if (['pauschal', 'pauschale', 'flat', 'fast beløb', 'forfettario'].includes(e)) return 'per_stay';
  if (['nacht', 'nächte', 'night', 'nights', 'nat', 'notte', 'nuit'].includes(e)) return 'per_night';
  if (['person', 'pers.', 'gast', 'guest'].includes(e)) return 'per_guest';
  return 'per_unit';
}
