// Zentrale Länderliste (alle 27 EU-Staaten + CH/UK als häufige Inhaber-Standorte)
// und die landesspezifische Bezeichnung der Kleinunternehmer-/Steuerbefreiungs-
// Regelung. Wird überall genutzt (Konto/Firmenprofil, Eigentümer-Stammdaten,
// Objekt-Land), damit es nur EINE Quelle gibt.
//
// Steuer-Labels: Seit 1.1.2025 gilt die harmonisierte EU-SME-Regelung; jedes Land
// hat jedoch weiterhin seinen eigenen nationalen Begriff. Die hier hinterlegten
// Begriffe sind recherchiert (FR franchise en base de TVA, IT regime forfettario,
// PL zwolnienie podmiotowe, NL KOR, DE §19 UStG, AT §6 Abs. 1 Z 27 UStG …). Wo
// kein eindeutiger nationaler Kurzbegriff verifiziert war, steht der in der EU
// gebräuchliche Begriff der jeweiligen Landessprache. Beträge/Schwellen sind
// bewusst NICHT hier — die ändern sich und gehören in die Steuerlogik/Konfig.

export type Country = {
  code: string; // ISO-3166-1 alpha-2
  name: string; // deutscher Anzeigename
  dialCode: string; // internationale Telefonvorwahl (E.164), inkl. „+"
  smallBusinessLabel: string; // landesspezifische Kleinunternehmer-Bezeichnung
  // Manche Länder haben KEINE Kleinunternehmerregelung (z. B. Spanien): dann
  // darf die Befreiungs-Option nicht wählbar sein.
  noSmallBusinessScheme?: boolean;
};

export const COUNTRIES: Country[] = [
  { code: "BE", name: "Belgien", dialCode: "+32", smallBusinessLabel: "Régime de la franchise / Vrijstellingsregeling" },
  { code: "BG", name: "Bulgarien", dialCode: "+359", smallBusinessLabel: "Режим за малки предприятия (ЗДДС)" },
  { code: "DK", name: "Dänemark", dialCode: "+45", smallBusinessLabel: "Momsfritagelse for små virksomheder" },
  { code: "DE", name: "Deutschland", dialCode: "+49", smallBusinessLabel: "Kleinunternehmer (§19 UStG)" },
  { code: "EE", name: "Estland", dialCode: "+372", smallBusinessLabel: "Väikeettevõtja käibemaksuvabastus" },
  { code: "FI", name: "Finnland", dialCode: "+358", smallBusinessLabel: "Arvonlisäveroton vähäinen toiminta" },
  { code: "FR", name: "Frankreich", dialCode: "+33", smallBusinessLabel: "Franchise en base de TVA" },
  { code: "GR", name: "Griechenland", dialCode: "+30", smallBusinessLabel: "Ειδικό καθεστώς απαλλαγής ΦΠΑ μικρών επιχειρήσεων" },
  { code: "IE", name: "Irland", dialCode: "+353", smallBusinessLabel: "VAT-exempt small business" },
  { code: "IT", name: "Italien", dialCode: "+39", smallBusinessLabel: "Regime forfettario" },
  { code: "HR", name: "Kroatien", dialCode: "+385", smallBusinessLabel: "Oslobođenje za male porezne obveznike (PDV)" },
  { code: "LV", name: "Lettland", dialCode: "+371", smallBusinessLabel: "Mazo uzņēmumu PVN atbrīvojums" },
  { code: "LT", name: "Litauen", dialCode: "+370", smallBusinessLabel: "PVM lengvata (speciali schema mažoms įmonėms)" },
  { code: "LU", name: "Luxemburg", dialCode: "+352", smallBusinessLabel: "Franchise de TVA (petites entreprises)" },
  { code: "MT", name: "Malta", dialCode: "+356", smallBusinessLabel: "Small undertaking VAT exemption" },
  { code: "NL", name: "Niederlande", dialCode: "+31", smallBusinessLabel: "Kleineondernemersregeling (KOR)" },
  { code: "AT", name: "Österreich", dialCode: "+43", smallBusinessLabel: "Kleinunternehmer (§6 Abs. 1 Z 27 UStG)" },
  { code: "PL", name: "Polen", dialCode: "+48", smallBusinessLabel: "Zwolnienie podmiotowe z VAT" },
  { code: "PT", name: "Portugal", dialCode: "+351", smallBusinessLabel: "Regime de isenção (art. 53.º CIVA)" },
  { code: "RO", name: "Rumänien", dialCode: "+40", smallBusinessLabel: "Regimul special de scutire (TVA)" },
  { code: "SE", name: "Schweden", dialCode: "+46", smallBusinessLabel: "Momsbefrielse för små företag" },
  { code: "SK", name: "Slowakei", dialCode: "+421", smallBusinessLabel: "Oslobodenie pre malé podniky (DPH)" },
  { code: "SI", name: "Slowenien", dialCode: "+386", smallBusinessLabel: "Oprostitev za male davčne zavezance (DDV)" },
  // Spanien hat die EU-Kleinunternehmerregelung NICHT umgesetzt (Stand 2025):
  // es gibt dort kein nationales Befreiungs-Regime → Hinweis statt falschem Begriff.
  { code: "ES", name: "Spanien", dialCode: "+34", smallBusinessLabel: "Keine Kleinunternehmerregelung (in ES nicht umgesetzt)", noSmallBusinessScheme: true },
  { code: "CZ", name: "Tschechien", dialCode: "+420", smallBusinessLabel: "Osvobození od DPH (malý podnik)" },
  { code: "HU", name: "Ungarn", dialCode: "+36", smallBusinessLabel: "Alanyi adómentesség (áfa)" },
  { code: "CY", name: "Zypern", dialCode: "+357", smallBusinessLabel: "Καθεστώς μικρών επιχειρήσεων (ΦΠΑ)" },
  // Nicht-EU, häufige Inhaber-Standorte.
  { code: "CH", name: "Schweiz", dialCode: "+41", smallBusinessLabel: "Von der MWST-Pflicht befreit" },
  { code: "GB", name: "Vereinigtes Königreich", dialCode: "+44", smallBusinessLabel: "VAT exemption (below registration threshold)" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Landesspezifische Kleinunternehmer-Bezeichnung; Fallback: neutraler EU-Begriff. */
export function smallBusinessLabel(country: string | undefined | null): string {
  const c = BY_CODE.get((country || "").toUpperCase());
  return c?.smallBusinessLabel ?? "Steuerbefreit (EU-Kleinunternehmerregelung)";
}

export function countryName(country: string | undefined | null): string {
  return BY_CODE.get((country || "").toUpperCase())?.name ?? (country || "");
}

/** Hat das Land überhaupt eine Kleinunternehmer-/Befreiungsregelung? */
export function hasSmallBusinessScheme(country: string | undefined | null): boolean {
  return !BY_CODE.get((country || "").toUpperCase())?.noSmallBusinessScheme;
}

// Landesspezifische Bezeichnung der Umsatzsteuer-Identifikationsnummer.
// DE: USt-IdNr., AT: UID-Nr., CH: MWST-Nr. (UID); übrige EU einheitlich „VAT ID"
// (die ID selbst ist EU-weit harmonisiert, nur der nationale Name unterscheidet).
const VAT_ID_LABELS: Record<string, string> = {
  DE: "USt-IdNr.",
  AT: "UID-Nr.",
  CH: "MWST-Nr. (UID)",
};

export function vatIdLabel(country: string | undefined | null): string {
  return VAT_ID_LABELS[(country || "").toUpperCase()] ?? "VAT ID";
}

// --- Telefon-Vorwahl --------------------------------------------------------

// Vorwahlen nach Länge absteigend: längere zuerst, damit „+359" nicht
// fälschlich als „+35" (gibt es nicht) bzw. „+3"… zerlegt wird.
const DIAL_CODES_DESC = [...new Set(COUNTRIES.map((c) => c.dialCode))].sort(
  (a, b) => b.length - a.length,
);

/** Internationale Vorwahl eines Landes (z. B. DE → „+49"). */
export function dialCode(country: string | undefined | null): string | null {
  return BY_CODE.get((country || "").toUpperCase())?.dialCode ?? null;
}

/** Zerlegt eine gespeicherte Nummer in {Vorwahl, Rest}. Erkennt die Vorwahl
 *  anhand der bekannten EU-/CH/UK-Codes (längste zuerst). Ohne erkennbare
 *  Vorwahl bleibt sie leer und die ganze Eingabe steht im Rest-Teil (kein
 *  Raten/Erfinden einer Vorwahl). */
export function splitPhone(value: string | undefined | null): {
  dial: string;
  rest: string;
} {
  const v = (value || "").trim();
  if (!v) return { dial: "", rest: "" };
  const compact = v.replace(/\s+/g, "");
  for (const code of DIAL_CODES_DESC) {
    if (compact.startsWith(code)) {
      return { dial: code, rest: compact.slice(code.length) };
    }
  }
  return { dial: "", rest: v };
}

/** Setzt Vorwahl + Rest zu einer E.164-nahen Nummer zusammen („+49 15251…").
 *  Leerer Rest → leere Nummer (kein „nur Vorwahl" speichern). */
export function joinPhone(dial: string, rest: string): string {
  const r = rest.replace(/\s+/g, "").replace(/^0+/, ""); // führende 0 entfällt intl.
  if (!r) return "";
  return dial ? `${dial} ${r}` : r;
}
