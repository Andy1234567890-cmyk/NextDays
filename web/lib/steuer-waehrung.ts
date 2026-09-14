// EINE Quelle für Steuersatz und Belegwährung in `web/`.
//
// Warum es diese Datei gibt (Wurzel 4, Bestandsaufnahme 10.09.2026):
// Steuersatz und Währung wurden an JEDER Stelle einzeln geraten. Das Ergebnis
// waren fünf unabhängige `19`-Vorbelegungen (NewProductModal, container,
// items-card, line-items-editor, invoiceTypes), mehrere `|| 19` (quoteService,
// eInvoiceService, xrechnungParser, useCompanySettings) und vier parallele
// Währungslisten (pricing-meta CURRENCY_OPTIONS, NewCustomerModal, booking-
// conditions, data/currencies). Jede Stelle war für sich plausibel und
// zusammen erzeugten sie falsche Beträge in echten Dokumenten: ein dänischer
// Betrieb rechnet 25 % in DKK, bekam aber 19 % und €.
//
// Wer nur die Fundstellen ersetzt, hat in drei Monaten die zehnte. Deshalb:
// Steuersatz und Währung werden AUSSCHLIESSLICH hier bezogen. Neue Aufrufer
// importieren aus diesem Modul, statt sich einen Wert auszudenken.
//
// Zwei unverhandelbare Eigenschaften:
//  1. KEIN erfundener Default. Fehlt der Satz oder die Währung in den
//     Stammdaten, ist das ein Datenfehler → `null` bzw. Ausnahme, nie 19 und
//     nie EUR. Der Aufrufer entscheidet, ob er leer rendert (Anzeige) oder
//     hart fehlschlägt (Beleg/E-Rechnung).
//  2. `??` statt `||` überall, damit der fachlich legitime Wert 0
//     (Steuerbefreiung, Kleinunternehmer, Reverse Charge) nicht verschluckt
//     wird. Genau dieser Bug steckte in jedem `item.taxRate || 19`: eine
//     0-%-Position wurde still mit 19 % ausgewiesen.
//
// Die Länderliste und die Währung je Land stehen weiterhin in `lib/laender.ts`
// (LAENDER, currencyForCountry) — diese Datei LEITET daraus ab und kopiert
// nichts. Formatierung von Beträgen bleibt `lib/currency`
// (formatCurrency/currencySymbol aus @nextdays/currency).

import { LAENDER, currencyForCountry } from "@/lib/laender";

// --- Währung ---------------------------------------------------------------

// Zusätzlich zu den EU/CH-Währungen aus laender.ts real vorkommende Codes:
// Betriebe rechnen mit Gästen und Eigentümern auch außerhalb der EU ab.
// Bewusst kurz gehalten — jede Zeile hier ist eine Behauptung, dass dieser Code
// gebraucht wird, keine Vollständigkeits-Sammlung (die steht in
// `data/currencies.ts` für den Fall, dass wirklich alle ISO-4217-Codes zur
// Auswahl stehen müssen).
const ZUSATZ_WAEHRUNGEN: readonly string[] = ["USD", "GBP", "NOK"];

// Alle wählbaren Währungscodes: die tatsächlich in den Betriebsländern
// gültigen (aus LAENDER abgeleitet, daher automatisch mitgepflegt, wenn dort
// ein Land dazukommt) plus die Zusatzcodes. EUR steht zuerst, danach
// alphabetisch — eine Auswahlreihenfolge, keine Wertung.
export const WAEHRUNGS_CODES: readonly string[] = (() => {
  const ausLaendern = LAENDER.map((l) => l.currency);
  const alle = Array.from(new Set([...ausLaendern, ...ZUSATZ_WAEHRUNGEN]));
  const ohneEuro = alle.filter((c) => c !== "EUR").sort((a, b) => a.localeCompare(b));
  return alle.includes("EUR") ? ["EUR", ...ohneEuro] : ohneEuro;
})();

/**
 * Ist das ein gültiger ISO-4217-Code (3 Großbuchstaben)? Reine Formprüfung —
 * sagt NICHT, ob die Währung in unserer Auswahlliste steht (Bestandsbelege
 * dürfen jede Währung tragen, die einmal gespeichert wurde).
 */
export function istWaehrungsCode(wert: unknown): wert is string {
  return typeof wert === "string" && /^[A-Z]{3}$/.test(wert.trim().toUpperCase());
}

/**
 * Belegwährung aus mehreren möglichen Quellen ermitteln, in der Reihenfolge
 * der Verlässlichkeit: was am Beleg steht, schlägt die Stammdaten; ein
 * Ländercode wird über `currencyForCountry` aufgelöst.
 *
 * Gibt `null` zurück, wenn KEINE Quelle eine gültige Währung liefert — das ist
 * ein Datenfehler, kein Anlass für ein erfundenes EUR (Wurzel 4). Anzeigen
 * rendern damit symbollos (`formatCurrency(betrag, null)`), Belege müssen
 * `belegWaehrungErzwingen` benutzen und fehlschlagen.
 */
export function belegWaehrung(
  ...quellen: readonly (string | null | undefined)[]
): string | null {
  for (const quelle of quellen) {
    if (typeof quelle !== "string") continue;
    const wert = quelle.trim().toUpperCase();
    if (!wert) continue;
    if (istWaehrungsCode(wert)) return wert;
    // Kein Währungscode → als Ländercode deuten (DE → EUR, DK → DKK).
    // currencyForCountry gibt bei unbekanntem Land "" zurück, nie ein
    // erfundenes EUR — dann geht die Suche mit der nächsten Quelle weiter.
    const ausLand = currencyForCountry(wert);
    if (istWaehrungsCode(ausLand)) return ausLand;
  }
  return null;
}

/**
 * Wie `belegWaehrung`, aber fail-closed: wirft, statt `null` zu liefern. Für
 * rechtsverbindliche Ausgaben (E-Rechnung, gespeicherte Belegsumme), wo ein
 * fehlender Wert nicht stillschweigend zu einem falschen Betrag werden darf.
 */
export function belegWaehrungErzwingen(
  kontext: string,
  ...quellen: readonly (string | null | undefined)[]
): string {
  const waehrung = belegWaehrung(...quellen);
  if (!waehrung) {
    throw new Error(
      `Belegwährung fehlt oder ist ungültig (${kontext}) — ohne gültigen ` +
        "ISO-4217-Code kann kein Beleg erzeugt werden. Währung in den " +
        "Stammdaten des Betriebs bzw. am Beleg hinterlegen.",
    );
  }
  return waehrung;
}

// --- Steuersatz ------------------------------------------------------------

// Der Steuersatz ist in der EU KEIN Katalog, den wir führen könnten: 27 Staaten
// mit je eigenem Regel- und ermäßigten Satz, dazu Nachkommasätze (LU 13,5 %/
// 5,5 %) und laufende Gesetzesänderungen. Eine hier gepflegte Satz-Tabelle wäre
// die nächste Fehlerquelle — sie wäre nach der ersten Steuerreform falsch, und
// zwar still. Deshalb führen wir NUR die Grenzen und beziehen den Wert selbst
// aus den Stammdaten des Betriebs (tenant_billing_profile.default_tax_rate,
// lodging_tax_rate) bzw. aus der Eingabe des Betriebs an der Position.
export const STEUERSATZ_MIN = 0;
export const STEUERSATZ_MAX = 100;

/**
 * Einen Steuersatz aus beliebiger Quelle (Zahl, String aus einem Formular oder
 * der API, `null`) in eine gültige Prozentzahl überführen.
 *
 * Gibt `null` zurück, wenn der Wert fehlt oder außerhalb 0–100 liegt. KEIN
 * Ersatzwert: ein fehlender Steuersatz ist ein Datenfehler, kein Anlass, den
 * deutschen Regelsatz zu erfinden.
 *
 * Die 0 ist ein GÜLTIGER Wert (Kleinunternehmer, Steuerbefreiung, Reverse
 * Charge) und kommt als 0 zurück — nicht als `null`. Das ist der Grund, warum
 * Aufrufer `??` und nicht `||` verwenden müssen.
 */
export function steuersatz(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === "") return null;
  const zahl = typeof wert === "number" ? wert : Number.parseFloat(String(wert));
  if (!Number.isFinite(zahl)) return null;
  if (zahl < STEUERSATZ_MIN || zahl > STEUERSATZ_MAX) return null;
  return zahl;
}

/**
 * Ersten verwertbaren Steuersatz aus mehreren Quellen nehmen (Position vor
 * Beleg vor Stammdaten). Bricht bei der ersten Quelle ab, die einen gültigen
 * Satz liefert — die 0 einer steuerbefreiten Position beendet die Suche
 * korrekt, statt auf den Regelsatz weiterzulaufen.
 */
export function ersterSteuersatz(...quellen: readonly unknown[]): number | null {
  for (const quelle of quellen) {
    const satz = steuersatz(quelle);
    if (satz !== null) return satz;
  }
  return null;
}

/**
 * Wie `ersterSteuersatz`, aber fail-closed für rechtsverbindliche Ausgaben
 * (E-Rechnung). Ein Beleg ohne ausgewiesenen Satz darf nicht mit einem
 * geratenen Satz hinausgehen.
 */
export function steuersatzErzwingen(
  kontext: string,
  ...quellen: readonly unknown[]
): number {
  const satz = ersterSteuersatz(...quellen);
  if (satz === null) {
    throw new Error(
      `Steuersatz fehlt oder ist ungültig (${kontext}) — ein Beleg darf keinen ` +
        "geratenen Satz ausweisen. Satz an der Position bzw. in den Stammdaten " +
        "des Betriebs hinterlegen.",
    );
  }
  return satz;
}

/**
 * Steuersatz einer Rechnungs-/Angebotsposition: Positionssatz vor Belegsatz.
 * `??`-Kette statt `||`, damit eine 0-%-Position nicht auf den Belegsatz
 * hochspringt.
 */
export function positionsSteuersatz(
  position: { taxRate?: unknown; vatRate?: unknown } | null | undefined,
  belegSatz?: unknown,
): number | null {
  return ersterSteuersatz(position?.taxRate, position?.vatRate, belegSatz);
}
