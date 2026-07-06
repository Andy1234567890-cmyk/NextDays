// Währungs-Formatierung (Intl.NumberFormat). Zentral, damit Beträge überall
// gleich dargestellt werden (Owner-Statements, Berichte, Listen).
//
// Robustheit: Ein fehlender oder ungültiger Währungscode (leer, null, kein
// 3-Buchstaben-ISO) darf NICHT die ganze Seite zum Absturz bringen
// (Intl.NumberFormat wirft sonst "Invalid currency code"). In dem Fall wird der
// Betrag OHNE Währungssymbol formatiert (reine Zahl) — kein erfundener Euro
// (Projektregel: keine Fallback-Ersatzwerte), aber auch kein Crash.
export function formatCurrency(
  amount: number,
  currency: string | null | undefined = "EUR",
  locale = "de-DE",
  // Nachkommastellen — Default 2 (Beträge). Kompakte Anzeigen (z. B. Kalender-/
  // Dynamic-Pricing-Raster) setzen 0 für ganze Preise.
  fractionDigits = 2,
): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const valid = /^[A-Z]{3}$/.test(code);
  if (!valid) {
    // Unbekannte Währung: Betrag als reine Zahl (deutsche Formatierung), ohne
    // ein falsches Symbol zu erfinden.
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
