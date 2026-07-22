// `cn` ist Single Source in @nextdays/ui — hier nur re-exportiert, damit
// bestehende `@/lib/utils`-Importe (Nicht-ui-Dateien) weiter funktionieren.
export { cn } from "@nextdays/ui/utils";

// --- Format-Helfer -----------------------------------------------------------

// Währungsformatierung: EINE Implementierung in lib/currency.ts (mit Locale +
// festen Nachkommastellen). Hier nur re-exportiert, damit bestehende Importe aus
// "@/lib/utils" weiterhin funktionieren — keine zweite Wahrheit mehr.
export { formatCurrency } from "./currency";

/**
 * Datum auf deutsches Locale formatieren.
 * Robust für YYYY-MM-DD (HTML date input) und DD.MM.YYYY.
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) {
    return new Date().toLocaleDateString("de-DE");
  }

  let date: Date;

  if (typeof dateString === "string" && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split("-");
    date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  } else if (
    typeof dateString === "string" &&
    dateString.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)
  ) {
    const [day, month, year] = dateString.split(".");
    date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  } else {
    date = new Date(dateString);
  }

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("de-DE");
  }

  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Datum + Uhrzeit auf deutsches Locale formatieren. */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
