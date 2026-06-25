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
  smallBusinessLabel: string; // landesspezifische Kleinunternehmer-Bezeichnung
  // Manche Länder haben KEINE Kleinunternehmerregelung (z. B. Spanien): dann
  // darf die Befreiungs-Option nicht wählbar sein.
  noSmallBusinessScheme?: boolean;
};

export const COUNTRIES: Country[] = [
  { code: "BE", name: "Belgien", smallBusinessLabel: "Régime de la franchise / Vrijstellingsregeling" },
  { code: "BG", name: "Bulgarien", smallBusinessLabel: "Режим за малки предприятия (ЗДДС)" },
  { code: "DK", name: "Dänemark", smallBusinessLabel: "Momsfritagelse for små virksomheder" },
  { code: "DE", name: "Deutschland", smallBusinessLabel: "Kleinunternehmer (§19 UStG)" },
  { code: "EE", name: "Estland", smallBusinessLabel: "Väikeettevõtja käibemaksuvabastus" },
  { code: "FI", name: "Finnland", smallBusinessLabel: "Arvonlisäveroton vähäinen toiminta" },
  { code: "FR", name: "Frankreich", smallBusinessLabel: "Franchise en base de TVA" },
  { code: "GR", name: "Griechenland", smallBusinessLabel: "Ειδικό καθεστώς απαλλαγής ΦΠΑ μικρών επιχειρήσεων" },
  { code: "IE", name: "Irland", smallBusinessLabel: "VAT-exempt small business" },
  { code: "IT", name: "Italien", smallBusinessLabel: "Regime forfettario" },
  { code: "HR", name: "Kroatien", smallBusinessLabel: "Oslobođenje za male porezne obveznike (PDV)" },
  { code: "LV", name: "Lettland", smallBusinessLabel: "Mazo uzņēmumu PVN atbrīvojums" },
  { code: "LT", name: "Litauen", smallBusinessLabel: "PVM lengvata (speciali schema mažoms įmonėms)" },
  { code: "LU", name: "Luxemburg", smallBusinessLabel: "Franchise de TVA (petites entreprises)" },
  { code: "MT", name: "Malta", smallBusinessLabel: "Small undertaking VAT exemption" },
  { code: "NL", name: "Niederlande", smallBusinessLabel: "Kleineondernemersregeling (KOR)" },
  { code: "AT", name: "Österreich", smallBusinessLabel: "Kleinunternehmer (§6 Abs. 1 Z 27 UStG)" },
  { code: "PL", name: "Polen", smallBusinessLabel: "Zwolnienie podmiotowe z VAT" },
  { code: "PT", name: "Portugal", smallBusinessLabel: "Regime de isenção (art. 53.º CIVA)" },
  { code: "RO", name: "Rumänien", smallBusinessLabel: "Regimul special de scutire (TVA)" },
  { code: "SE", name: "Schweden", smallBusinessLabel: "Momsbefrielse för små företag" },
  { code: "SK", name: "Slowakei", smallBusinessLabel: "Oslobodenie pre malé podniky (DPH)" },
  { code: "SI", name: "Slowenien", smallBusinessLabel: "Oprostitev za male davčne zavezance (DDV)" },
  // Spanien hat die EU-Kleinunternehmerregelung NICHT umgesetzt (Stand 2025):
  // es gibt dort kein nationales Befreiungs-Regime → Hinweis statt falschem Begriff.
  { code: "ES", name: "Spanien", smallBusinessLabel: "Keine Kleinunternehmerregelung (in ES nicht umgesetzt)", noSmallBusinessScheme: true },
  { code: "CZ", name: "Tschechien", smallBusinessLabel: "Osvobození od DPH (malý podnik)" },
  { code: "HU", name: "Ungarn", smallBusinessLabel: "Alanyi adómentesség (áfa)" },
  { code: "CY", name: "Zypern", smallBusinessLabel: "Καθεστώς μικρών επιχειρήσεων (ΦΠΑ)" },
  // Nicht-EU, häufige Inhaber-Standorte.
  { code: "CH", name: "Schweiz", smallBusinessLabel: "Von der MWST-Pflicht befreit" },
  { code: "GB", name: "Vereinigtes Königreich", smallBusinessLabel: "VAT exemption (below registration threshold)" },
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
