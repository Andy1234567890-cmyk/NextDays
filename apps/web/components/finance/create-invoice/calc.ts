// Pure Rechen- und Format-Helfer für die Rechnungserstellung (keine React-Abhängigkeiten)

import type { QuoteItem } from '@/services/quoteService';

// Nummernkreis-Vorschau generieren
export function generateNumberPreview(format: string, number: number): string {
  const now = new Date();
  return format
    .replace('%NUMBER', number.toString())
    .replace('%YYYY', now.getFullYear().toString())
    .replace('%YY', now.getFullYear().toString().slice(-2))
    .replace('%MM', (now.getMonth() + 1).toString().padStart(2, '0'))
    .replace('%M', (now.getMonth() + 1).toString())
    .replace('%DD', now.getDate().toString().padStart(2, '0'))
    .replace('%D', now.getDate().toString());
}

// Bruttopreis aus Nettopreis ableiten
export const syncGrossFromNet = (net: number, rate: number) =>
  Number.isFinite(net) ? net * (1 + Math.max(0, rate) / 100) : 0;

// Datum als dd.mm.yyyy formatieren
export function formatDateDE(d: Date | string | undefined): string {
  if (!d) return '';
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dateObj.getTime())) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dateObj.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  } catch {
    return '';
  }
}

// Einheiten-Auswahl (analog zur gewünschten Liste)
export const UNIT_OPTIONS = [
  { label: 'Stk', value: 'Stk' },
  { label: 'pauschal', value: 'pauschal' },
  { label: 'Std', value: 'Std' },
  { label: '%', value: '%' },
  { label: 'Tag(e)', value: 'Tag(e)' },
  // Hinweis: SelectItem darf keinen leeren value haben – 'none' dient als Platzhalter und wird auf '' gemappt
  { label: '—', value: 'none' },
  { label: 'm²', value: 'm²' },
  { label: 'm', value: 'm' },
  { label: 'kg', value: 'kg' },
  { label: 't', value: 't' },
  { label: 'lfm', value: 'lfm' },
  { label: 'm³', value: 'm³' },
  { label: 'km', value: 'km' },
  { label: 'L', value: 'L' },
];

// Netto-Zeilensumme aus Menge und Netto-Einzelpreis
export function computeItemTotalNet(qty: number, unitNet: number): number {
  const q = Number.isFinite(qty) ? Math.max(0, qty) : 0;
  const p = Number.isFinite(unitNet) ? Math.max(0, unitNet) : 0;
  return q * p;
}

// Summen berechnen (Rabatt-Positionen abziehen) inkl. Steuersatz-Gruppierung
export function computeTotals(
  items: QuoteItem[],
  taxRate: number,
): {
  subtotal: number;
  vat: number;
  grandTotal: number;
  taxGrouped: Array<{ rate: number; netAmount: number; taxAmount: number }>;
} {
  const subtotal = items.reduce((sum, it) => {
    const t = it.total || 0;
    if (it.category === 'discount') {
      return sum + -Math.abs(t);
    }
    const factor = 1 - Math.max(0, Math.min(100, it.discountPercent || 0)) / 100;
    return sum + t * factor;
  }, 0);
  // Steuer JE POSITION mit deren Satz (?? statt ||: 0 % ist ein gültiger
  // Satz — Kurtaxe/Abgaben aus Buchungsrechnungen dürfen NICHT auf den
  // Firmen-Standardsatz kippen). Positionen ohne eigenen Satz → globaler Satz.
  const vat = items.reduce((sum, it) => {
    if (it.category === 'discount') {
      // Rabatt mindert die Bemessungsgrundlage mit seinem eigenen Satz
      // (Rabatt-Positionen werden mit taxRate 0 angelegt → neutral).
      return sum - Math.abs(it.total || 0) * ((it.taxRate ?? taxRate) / 100);
    }
    const factor = 1 - Math.max(0, Math.min(100, it.discountPercent || 0)) / 100;
    return sum + (it.total || 0) * factor * ((it.taxRate ?? taxRate) / 100);
  }, 0);
  const grandTotal = subtotal + vat;

  // Positionen nach Steuersatz gruppieren (für Rechnungen mit mehreren Steuersätzen)
  const taxGroups: { [rate: number]: { netAmount: number; taxAmount: number } } = {};

  items.forEach(item => {
    if (item.category === 'discount') return; // Rabatt-Positionen überspringen

    const itemTaxRate = item.taxRate ?? taxRate;
    const t = item.total || 0;
    const factor = 1 - Math.max(0, Math.min(100, item.discountPercent || 0)) / 100;
    const netAmount = t * factor;
    const itemTaxAmount = netAmount * (itemTaxRate / 100);

    if (!taxGroups[itemTaxRate]) {
      taxGroups[itemTaxRate] = { netAmount: 0, taxAmount: 0 };
    }

    taxGroups[itemTaxRate].netAmount += netAmount;
    taxGroups[itemTaxRate].taxAmount += itemTaxAmount;
  });

  const taxGrouped = Object.entries(taxGroups)
    .map(([rate, amounts]) => ({
      rate: Number(rate),
      netAmount: Math.round(amounts.netAmount * 100) / 100,
      taxAmount: Math.round(amounts.taxAmount * 100) / 100,
    }))
    .sort((a, b) => b.rate - a.rate); // absteigend sortiert (19%, 7%, 0%)

  return { subtotal, vat, grandTotal, taxGrouped };
}
