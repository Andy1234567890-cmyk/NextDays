// Währungs-Formatierung (Intl.NumberFormat). Zentral, damit Beträge überall
// gleich dargestellt werden (Owner-Statements, Berichte, Listen).
//
// Robustheit: Ein fehlender oder ungültiger Währungscode (leer, null, kein
// 3-Buchstaben-ISO) darf NICHT die ganze Seite zum Absturz bringen
// (Intl.NumberFormat wirft sonst "Invalid currency code"). In dem Fall wird der
// Betrag OHNE Währungssymbol formatiert (reine Zahl) — kein erfundener Euro
// (Projektregel: keine Fallback-Ersatzwerte), aber auch kein Crash.
// Der Währungsparameter hat BEWUSST keinen Default: ein `= "EUR"` hätte jeden
// Aufrufer, der die Währung schlicht vergisst, still auf Euro gesetzt — genau
// der erfundene Ersatzwert, den Wurzel 4 verbietet. Ohne Default muss die
// Währung übergeben werden; ist sie in den Daten nicht vorhanden, übergibt man
// `null` und der Betrag erscheint symbollos.
export function formatCurrency(
  amount: number,
  currency: string | null | undefined,
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

// Reines Währungssymbol für Feld-Labels/Hilfetexte ('€', '$', 'CHF', …) — statt
// eines hartkodierten €. Leitet das Symbol über Intl aus dem ISO-Code ab; bei
// ungültigem/fehlendem Code den (getrimmten) Code selbst, sonst leer (kein
// erfundenes €). Für Beträge weiterhin formatCurrency nutzen.
export function currencySymbol(
  currency: string | null | undefined,
  locale = "de-DE",
): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(code)) return code;
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? code;
}
