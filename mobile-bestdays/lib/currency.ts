// Währungs-Formatierung für die Mobile-App. BEWUSST ohne Intl.NumberFormat mit
// style:"currency": die vorgebaute Hermes-Engine (iOS) liefert kein
// vollständiges Intl — ein solcher Aufruf würde je nach Build werfen oder das
// Symbol still verschlucken. Darum eigene, deterministische Formatierung.
//
// Regeln (CLAUDE.md Wurzel 4): fehlende/ungültige Währung → Betrag als reine
// Zahl OHNE erfundenes Symbol; NIE ein hartkodiertes €. Kein Crash.

// Symbole nur für belegte ISO-Codes; unbekannte Codes werden als Suffix
// angehängt (z. B. „1.200 PLN"), NICHT durch ein falsches Symbol ersetzt.
const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  DKK: "kr",
  SEK: "kr",
  NOK: "kr",
  PLN: "zł",
  CZK: "Kč",
};

function groupThousands(intPart: string): string {
  const neg = intPart.startsWith("-");
  const digits = neg ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg ? `-${grouped}` : grouped;
}

function plainNumber(amount: number, fractionDigits: number): string {
  const fixed = amount.toFixed(fractionDigits); // "1200.00" | "1200"
  const [int, frac] = fixed.split(".");
  const body = groupThousands(int);
  return frac ? `${body},${frac}` : body;
}

/**
 * Betrag mit Währung formatieren. `currency` MUSS aus den Daten kommen
 * (row/property). Fehlt/ungültig → reine Zahl ohne Symbol (kein erfundenes €).
 */
export function formatCurrency(
  amount: number,
  currency: string | null | undefined,
  fractionDigits = 0,
): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const num = plainNumber(amount, fractionDigits);
  if (!/^[A-Z]{3}$/.test(code)) return num; // kein erfundenes Symbol
  const sym = SYMBOLS[code];
  if (!sym) return `${num} ${code}`; // gültiger, nicht kuratierter Code als Suffix
  return `${num} ${sym}`;
}

// Reines Währungssymbol; unbekannter/fehlender Code → der Code selbst (getrimmt),
// nie ein erfundenes €.
export function currencySymbol(currency: string | null | undefined): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(code)) return code;
  return SYMBOLS[code] ?? code;
}
