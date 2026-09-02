// Formatierung im Partner-Dashboard. Beträge IMMER mit ihrer Währung — sie
// kommen als Paar vom Server, es gibt keinen Ersatzwert (Wurzel 4).
import type { Betrag } from "./partner";

export function betrag(b: Betrag, locale: string): string {
  const n = Number(b.amount);
  if (!Number.isFinite(n)) return `${b.amount} ${b.currency}`;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: b.currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${b.currency}`;
  }
}

/** Mehrere Währungen nebeneinander, nie summiert. */
export function betraege(liste: Betrag[], locale: string, leer: string): string {
  if (liste.length === 0) return leer;
  return liste.map((b) => betrag(b, locale)).join(" · ");
}

export function prozent(rate: string, locale: string): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(n);
}

export function datum(wert: string | null | undefined, locale: string): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { timeZone: "Europe/Copenhagen" });
}

export function datumZeit(wert: string | null | undefined, locale: string): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });
}
