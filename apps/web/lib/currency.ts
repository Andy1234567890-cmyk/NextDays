// Währungs-Formatierung (Intl.NumberFormat). Zentral, damit Beträge überall
// gleich dargestellt werden (Owner-Statements, Berichte, Listen).
export function formatCurrency(
  amount: number,
  currency = "EUR",
  locale = "de-DE",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
