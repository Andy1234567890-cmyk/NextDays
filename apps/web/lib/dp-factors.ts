// Bewusst OHNE "use server" (anders als lib/dynamic-pricing.ts): Konstante +
// Sync-Funktion dürfen aus einem Server-Actions-Modul nicht exportiert werden.

// Deutsche Labels für die Dynamic-Pricing-Faktoren („Warum dieser Preis?").
export const FACTOR_LABELS: Record<string, string> = {
  season: "Saison",
  event: "Event",
  weekend: "Wochenende",
  occupancy: "Auslastung",
  last_minute: "Last-Minute",
  orphan: "Lückenfüllung",
  market: "Markt",
};

// factors (Multiplikatoren, 1.0 = neutral) → lesbare Erklärzeilen mit %-Beitrag.
// Nur Faktoren ≠ neutral werden gezeigt; leere Erklärung, wenn alles neutral.
export function explainFactors(
  factors: Record<string, number> | null | undefined,
): string {
  if (!factors) return "";
  const lines: string[] = [];
  for (const [key, mult] of Object.entries(factors)) {
    if (mult == null || Math.abs(mult - 1) < 0.001) continue;
    const pct = Math.round((mult - 1) * 100);
    lines.push(`${FACTOR_LABELS[key] ?? key} ${pct >= 0 ? "+" : ""}${pct} %`);
  }
  return lines.length ? `Warum dieser Preis?\n${lines.join("\n")}` : "";
}
