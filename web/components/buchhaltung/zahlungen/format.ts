// Anzeige-Helfer des Bereichs Zahlungen — reine Funktionen, server- und
// clientseitig nutzbar. Beträge kommen als Decimal-String vom Backend; hier
// wird nur für die Anzeige gewandelt (Wurzel 4: Währung immer aus der Zeile,
// leere Währung rendert symbollos über lib/currency).
import { formatCurrency } from "@/lib/currency";

export function formatBetrag(amount: string | number, currency: string, locale?: string): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency, locale);
}

export function formatDatum(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

export function heuteIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monatIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monatVerschieben(monat: string, delta: number): string {
  const [j, m] = monat.split("-").map(Number);
  const d = new Date(j, (m ?? 1) - 1 + delta, 1);
  return monatIso(d);
}

export function istNegativ(amount: string): boolean {
  return amount.trim().startsWith("-");
}
