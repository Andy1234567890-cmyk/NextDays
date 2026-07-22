// Währungsformatierung — Single Source im geteilten Paket (@nextdays/currency).
// Re-Export, damit die bestehenden Importe aus "@/lib/currency" unverändert
// bleiben (kein €-Hardcode, symbollos bei fehlender Währung, Wurzel 4; ADR-0016).
export { formatCurrency, currencySymbol } from "@nextdays/currency";
