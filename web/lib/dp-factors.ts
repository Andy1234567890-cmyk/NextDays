// Bewusst OHNE "use server" (anders als lib/dynamic-pricing.ts): Konstante +
// Sync-Funktion dürfen aus einem Server-Actions-Modul nicht exportiert werden.

// Deutsche Labels für die Dynamic-Pricing-Faktoren („Warum dieser Preis?").
// Jeder Schlüssel, den die Engine schreibt (engine.compute_day + Tagesmodus),
// steht hier — ein fehlender erschien als Rohschlüssel („far_future +10 %")
// in der Erklärung. Prüfung: apps/api/.../tests/test_pricing.py.
export const FACTOR_LABELS: Record<string, string> = {
  marktbasis: "Marktbasis",
  season: "Saison",
  event: "Event",
  weekend: "Wochenende",
  occupancy: "Auslastung",
  pickup: "Buchungstempo",
  last_minute: "Last-Minute",
  far_future: "Frühbucher-Aufschlag",
  orphan: "Lückenfüllung",
  market: "Markt",
  weather: "Wetter",
  feiertag: "Feiertag",
  ferien: "Schulferien",
  rate_rules: "Eigene Regeln",
  anker: "Vorjahresanker",
  saison_untergrenze: "Saison-Untergrenze",
  tagesanpassung: "Tagesanpassung",
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
