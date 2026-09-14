// Anzeige-Helfer der Berichte: Decimal-Strings des Backends in Text.
// Kein Rechnen mit Geld im Client — nur Darstellung (Wurzel 4: formatCurrency
// aus lib/currency, symbollos bei leerer Währung).
import { formatCurrency } from "@/lib/currency";

export function geld(betrag: string | number, currency: string): string {
  const n = Number(betrag);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency);
}

export function zahl(betrag: string | number): number {
  const n = Number(betrag);
  return Number.isFinite(n) ? n : 0;
}

export function prozent(wert: string | null): string {
  if (wert === null) return "—";
  const n = Number(wert);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} %`;
}

export function datum(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale).format(new Date(iso));
}

/** Perioden-Schlüssel des Backends (`2026-03`, `2026-Q1`, `2026`) lesbar. */
export function periodeLabel(key: string, locale: string): string {
  const monat = /^(\d{4})-(\d{2})$/.exec(key);
  if (monat) {
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(
      new Date(Date.UTC(Number(monat[1]), Number(monat[2]) - 1, 1)),
    );
  }
  return key;
}
