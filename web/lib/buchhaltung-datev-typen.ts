// Typen des Bereichs DATEV (Buchhaltung) — Spiegel der Pydantic-Schemas in
// apps/api/src/features/buchhaltung/bereiche/datev/schemas.py (camelCase).
// Ohne "use server", damit Werte und Typen hier stehen dürfen.

export type Kontenrahmen = "SKR03" | "SKR04";
export type ExportTyp = "buchungsstapel" | "stammdaten";
export type Belegart = "ausgangsrechnungen" | "gutschriften" | "ausgaben" | "zahlungen";
export const BELEGARTEN: readonly Belegart[] = [
  "ausgangsrechnungen",
  "gutschriften",
  "ausgaben",
  "zahlungen",
];

export type DatevSettings = {
  beraterNummer: number | null;
  mandantenNummer: number | null;
  kontenrahmen: Kontenrahmen | null;
  sachkontenlaenge: number | null;
  wirtschaftsjahrBeginnMonat: number | null;
  standardErloeskonto: string | null;
  standardAufwandskonto: string | null;
  standardFinanzkonto: string | null;
  debitorKontoStart: number | null;
  kreditorKontoStart: number | null;
  buSchluesselErloes: Record<string, string> | null;
  buSchluesselAufwand: Record<string, string> | null;
  finanzkonten: Record<string, string>;
  festschreibung: boolean | null;
  configured: boolean;
  fehlendeFelder: string[];
  updatedAt: string | null;
};

export type DatevSettingsInput = {
  beraterNummer: number;
  mandantenNummer: number;
  kontenrahmen: Kontenrahmen;
  sachkontenlaenge: number;
  wirtschaftsjahrBeginnMonat: number;
  standardErloeskonto: string;
  standardAufwandskonto: string;
  standardFinanzkonto: string;
  debitorKontoStart: number;
  kreditorKontoStart: number;
  buSchluesselErloes: Record<string, string>;
  buSchluesselAufwand: Record<string, string>;
  finanzkonten: Record<string, string>;
  festschreibung: boolean;
};

export type ExportAnfrage = {
  exportType: ExportTyp;
  dateFrom: string; // ISO yyyy-mm-dd
  dateTo: string;
  belegarten: Belegart[];
};

export type Vorschau = {
  exportType: ExportTyp;
  dateFrom: string;
  dateTo: string;
  anzahlGesamt: number;
  anzahlJeBelegart: Record<string, number>;
  probleme: string[];
  warnungen: string[];
};

export type ExportLauf = {
  id: string;
  tenantId: string;
  exportType: ExportTyp;
  dateFrom: string;
  dateTo: string;
  belegarten: string[];
  anzahl: number;
  contentHash: string;
  dateiname: string;
  groesse: number;
  status: "erstellt" | "fehlgeschlagen";
  kontenrahmen: Kontenrahmen;
  warnungen: string[];
  wiederverwendet: boolean;
  createdBy: string | null;
  createdAt: string;
};

/** Strukturierter 422-Rumpf des Backends (`{message, fehlendeFelder?|probleme?}`). */
export type DatevFehlerDetails = {
  fehlende_felder?: string[];
  probleme?: string[];
};
