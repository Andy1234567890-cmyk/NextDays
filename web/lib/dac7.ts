// Data-Layer des DAC7-Moduls (Server Components) gegen den taxpayer-Slice.
//
// DAC7 (EU-Richtlinie 2021/514) verpflichtet Plattformbetreiber, einmal
// jaehrlich zu melden, welche Verkaeufer ueber sie welche Vermietungsumsaetze
// erzielt haben. Meldepflichtig ist der BETRIEB — deshalb liegt das Modul im
// PMS und nicht im Marktplatz-Dashboard.
//
// Warum die Betraege Zeichenketten sind: JSON kennt nur `double`. Ein Cent,
// der beim Serialisieren verlorengeht, ist in einer Steuermeldung ein
// Fehler — deshalb kommen sie als Text und werden nur zur Anzeige
// formatiert, nie gerechnet.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Ein Grund, warum etwas nicht gemeldet werden kann. */
export interface Befund {
  /** Die Stelle in den Daten — ohne sie ist der Befund nicht auffindbar. */
  betrifft: string;
  /** Das betroffene Feld der Meldung. */
  feld: string;
  grund: string;
}

export interface Pruefbericht {
  /** Verhindert die Datei. */
  fehler: Befund[];
  /** Verhindert sie nicht, verdient aber einen Blick. */
  hinweise: Befund[];
  einbezogene_buchungen: number;
  /** Grund → Anzahl. Erklärt die Differenz zum Gesamtbestand. */
  ausgeschlossene_buchungen: Record<string, number>;
  darf_melden: boolean;
}

export interface Quartalswerte {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  summe: string;
}

/**
 * EIN OBJEKT — genau eine Zeile der Meldedatei.
 *
 * Die amtliche Vorlage verlangt für Immobilien eine Zeile je Objekt
 * („Gentages for hver ejendom"). Was hier steht, ist deshalb der Inhalt
 * genau einer `ACT_Immovable_Property`-Zeile.
 */
export interface Taetigkeit {
  anschrift: string;
  land: string;
  /** OECD-Code der Objektart (DPI902 Hotelzimmer, DPI904 Haus …). */
  objektart: string | null;
  vermietete_tage: number | null;
  /** Matrikelnummer — Text, bis zu 4 Ziffern und 3 Buchstaben. */
  grundbuchnummer: string | null;
  /** BFE-Nummer — die Kennung der Immobilie in Dänemark, eine Ganzzahl. */
  bfe_nummer: string | null;
  /** Bruttomieteinnahme des Jahres, dänische Zusatzangabe. */
  brutto_mieteinnahme: string | null;
  brutto_waehrung: string | null;
  waehrung: string;
  verguetung: Quartalswerte;
  gebuehren: Quartalswerte;
  steuern: Quartalswerte;
  anzahl_buchungen: number;
  /** Welche Objekte in dieser Meldeeinheit aufgehen. */
  property_ids: string[];
}

/** Ein Regelverstoß in der fertigen Datei, mit Fundort. */
export interface Dateibefund {
  zeile: number;
  zeilentyp: string;
  spalte: string;
  regel: string;
  grund: string;
  wert: string;
}

/**
 * Was die Prüfung der FERTIGEN Datei ergeben hat.
 *
 * Getrennt vom Prüfbericht: Jener prüft die Daten, bevor die Datei
 * entsteht. Diese hier liest die fertige Datei zurück und misst sie an den
 * Regeln der Vorlage — so, wie die Behörde es tun würde.
 */
export interface Dateipruefung {
  besteht: boolean;
  zeilen: number;
  zeilentypen: Record<string, number>;
  fehler: Dateibefund[];
  hinweise: Dateibefund[];
}

export interface GemeldeterAnbieter {
  /** Die Kennung, auf die eine spätere Korrektur verweist. */
  doc_ref_id: string;
  ist_person: boolean;
  anzeigename: string;
  ansaessig_in: string[];
  /** Maskiert — die Vorschau dient der Kontrolle, nicht der Weitergabe. */
  steuernummer_maskiert: string | null;
  taetigkeiten: Taetigkeit[];
}

export interface MeldungVorschau {
  jahr: number;
  /** DPI401 neu, DPI402 Korrektur, DPI403 Nullmeldung. */
  meldeart: string;
  melde_ref_id: string;
  betreiber_name: string;
  anbieter: GemeldeterAnbieter[];
  bericht: Pruefbericht;
  lauf_id: string | null;
  datei_verfuegbar: boolean;
  /** True, wenn nichts abgelegt wurde. */
  probelauf: boolean;
  /** Die ersten Zeilen der Datei — nur beim Probelauf. */
  datei_anfang: string | null;
  datei_zeilen: number | null;
  /** Die vollständige Datei im Klartext — nur beim Probelauf. */
  datei_inhalt: string | null;
  /** Das Ergebnis der Prüfung der fertigen Datei. */
  dateipruefung: Dateipruefung | null;
}

export type LaufStatus = "entwurf" | "abgegeben" | "ersetzt";

export interface Meldelauf {
  id: string;
  jahr: number;
  art: string;
  status: LaufStatus;
  meldeart: string;
  melde_ref_id: string;
  behoerde_land: string;
  anzahl_anbieter: number;
  anzahl_einheiten: number;
  anzahl_buchungen: number;
  datei_name: string | null;
  datei_pruefsumme: string | null;
  abgegeben_am: string | null;
  created_at: string;
}

/** Die gespeicherten Meldeläufe (oder null bei fehlendem Zugriff/Rolle —
 *  die UI zeigt dann eine Meldung, keinen Fantasie-Default). */
export async function getMeldelaeufe(
  jahr?: number,
): Promise<Meldelauf[] | null> {
  const pfad =
    jahr === undefined
      ? "/taxpayer/dac7/laeufe"
      : `/taxpayer/dac7/laeufe?jahr=${jahr}`;
  try {
    return await api<Meldelauf[]>(pfad, {
      token: (await currentToken()) ?? undefined,
    });
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Die Meldejahre, die zur Auswahl stehen.
 *
 *  DAC7 gilt ab dem Meldezeitraum 2023. Das laufende Jahr steht zur
 *  Verfügung, weil ein Betrieb den Stand vorab sehen können soll — gemeldet
 *  wird es erst nach seinem Ablauf. */
export function meldejahre(heute: Date = new Date()): number[] {
  const jahre: number[] = [];
  for (let jahr = heute.getFullYear(); jahr >= 2023; jahr -= 1) {
    jahre.push(jahr);
  }
  return jahre;
}

/** Die Abgabefrist eines Meldejahres.
 *
 *  Gemeldet wird bis zum 31. Januar des Folgejahres. Fällt er auf ein
 *  Wochenende, verschiebt sich die Frist auf den nächsten Werktag —
 *  deshalb wird sie gerechnet und nicht als Text hinterlegt. */
export function abgabefrist(jahr: number): Date {
  const frist = new Date(Date.UTC(jahr + 1, 0, 31));
  const wochentag = frist.getUTCDay();
  if (wochentag === 6) frist.setUTCDate(frist.getUTCDate() + 2); // Samstag
  if (wochentag === 0) frist.setUTCDate(frist.getUTCDate() + 1); // Sonntag
  return frist;
}

/** Klartext für die OECD-Objektart-Codes.
 *
 *  Der Code allein sagt niemandem etwas; in der Datei steht er trotzdem so.
 *  Ein unbekannter Code wird unverändert gezeigt statt durch einen
 *  geratenen Text ersetzt. */
export function objektartName(code: string | null): string | null {
  if (!code) return null;
  const namen: Record<string, string> = {
    DPI901: "Büro",
    DPI902: "Hotelzimmer",
    DPI903: "B&B-Zimmer",
    DPI904: "Haus",
    DPI905: "Wohnung",
    DPI906: "Mobilheim",
    DPI907: "Campingplatz",
    DPI908: "Boot",
    DPI909: "Parkplatz",
    DPI910: "Sonstiges",
  };
  return namen[code] ?? code;
}

