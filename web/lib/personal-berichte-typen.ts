// Typen des Berichts- und Lohnlauf-Bereichs (Paket F3) — gespiegelt aus
// docs/PERSONAL-AUSBAU-VERTRAG.md §4 (Backend B4:
// apps/api/src/features/personal/berichte_schemas.py).
//
// Eigene Datei OHNE "use server": ein Server-Action-Modul darf nur async
// functions exportieren (sonst 500 in „Collecting page data"); Typen,
// Konstanten und reine Helfer liegen deshalb hier daneben.

// --- Katalog (§4.1) ----------------------------------------------------------

export type BerichtGruppe = "zeit" | "abwesenheit" | "finanzen" | "personal" | "plan";

export type BerichtFilterName =
  | "zeitraum"
  | "arbeitsbereich"
  | "objekt"
  | "person"
  | "beschaeftigungsart";

export type BerichtFormat = "json" | "csv";

export type BerichtKatalogEintrag = {
  name: string;
  gruppe: BerichtGruppe;
  filter: BerichtFilterName[];
  capability: "view_team_schedule" | "export_lohn";
  formate: BerichtFormat[];
};

/** Reihenfolge der Gruppen auf der Katalogseite — nicht alphabetisch, sondern
 *  nach Arbeitsablauf: Zeit zuerst, Plan am Ende. */
export const BERICHT_GRUPPEN: readonly BerichtGruppe[] = [
  "zeit",
  "abwesenheit",
  "finanzen",
  "personal",
  "plan",
];

/** Phosphor-Symbol je Gruppe (nur Optik, keine Fachlogik). */
export const GRUPPEN_ICON: Record<BerichtGruppe, string> = {
  zeit: "ph:clock-counter-clockwise",
  abwesenheit: "ph:umbrella-simple",
  finanzen: "ph:chart-line-up",
  personal: "ph:users-three",
  plan: "ph:calendar-check",
};

// --- Bericht (§4.2) ----------------------------------------------------------

export type SpaltenTyp =
  | "text"
  | "zahl"
  | "minuten"
  | "geld"
  | "prozent"
  | "datum"
  | "tage"
  | "status";

export type BerichtSpalte = {
  key: string;
  typ: SpaltenTyp;
  summe: boolean;
};

/** Eine Zelle. Der Server liefert je Typ: `minuten`/`geld` als ganze Zahl
 *  (Minuten bzw. Minor-Einheiten), `prozent`/`tage`/`zahl` als Zahl,
 *  `datum`/`text`/`status` als String. `null` heisst „nicht vorhanden" — nie
 *  eine erfundene 0 (Wurzel 4). Booleans kommen bei `fehlt` im Bericht
 *  `monatsabschluesse` vor, Listen bei `hinweise` in `lohnvorschau`. */
export type BerichtZelle = string | number | boolean | string[] | null;

export type BerichtZeile = Record<string, BerichtZelle>;

export type BerichtResponse = {
  name: string;
  von: string;
  bis: string;
  currency: string | null;
  hinweise: string[];
  erzeugt_am: string;
  spalten: BerichtSpalte[];
  zeilen: BerichtZeile[];
  summen: BerichtZeile | null;
  anzahl: number;
};

/** Die Filterwerte einer Berichtsseite. Genau diese Schlüssel stehen in der
 *  URL, damit ein Link teilbar ist. */
export type BerichtFilterWerte = {
  von: string;
  bis: string;
  arbeitsbereich_id: string;
  property_id: string;
  user_id: string;
  beschaeftigungsart: string;
};

// --- Lohnlauf (§4.3) ---------------------------------------------------------

export type LohnlaufStatus = "entwurf" | "geprueft" | "freigegeben" | "exportiert";

/** Die Statuskette als Fortschritt — die Reihenfolge ist Teil des Vertrags. */
export const LOHNLAUF_KETTE: readonly LohnlaufStatus[] = [
  "entwurf",
  "geprueft",
  "freigegeben",
  "exportiert",
];

export type PruefArt =
  // Fehler
  | "zeit_unbestaetigt"
  | "stempelung_offen"
  | "monatsabschluss_fehlt"
  | "lohn_fehlt"
  | "waehrung_fehlt"
  | "lohnart_fehlt"
  | "verdienstgrenze_ueberschritten"
  // Warnungen
  | "schicht_ohne_zeit"
  | "zeit_ohne_schicht"
  | "ueberstunden_offen";

export type Pruefung = {
  art: PruefArt;
  user_id: string | null;
  name: string | null;
  werte: Record<string, unknown>;
};

export type LohnPruefungen = {
  geprueft_am: string | null;
  personen: number;
  zeiten: number;
  fehler: Pruefung[];
  warnungen: Pruefung[];
};

export type LohnExportFormat = "csv" | "datev_lodas";

export type Lohnlauf = {
  id: string;
  jahr: number;
  monat: number;
  status: LohnlaufStatus;
  pruefungen: LohnPruefungen | null;
  geprueft_am: string | null;
  freigegeben_am: string | null;
  exportiert_am: string | null;
  export_format: LohnExportFormat | null;
  export_name: string | null;
  notiz: string | null;
  created_at: string;
};

export type LohnExportDatei = { inhalt_base64: string; mime: string; name: string };

/** Sprungziel je Prüfart — der Vertrag nennt sie ausdrücklich (§7). Ohne
 *  Personen-ID fällt ein personenbezogenes Ziel auf die Listenseite zurück,
 *  statt einen kaputten Link zu bauen. */
export function pruefungZiel(p: Pruefung): string | null {
  switch (p.art) {
    case "zeit_unbestaetigt":
    case "stempelung_offen":
      return p.user_id
        ? `/hr/zeiterfassung?user_id=${encodeURIComponent(p.user_id)}`
        : "/hr/zeiterfassung";
    case "monatsabschluss_fehlt":
      return "/hr/zeiterfassung";
    case "lohn_fehlt":
    case "waehrung_fehlt":
    case "verdienstgrenze_ueberschritten":
      return p.user_id ? `/hr/mitarbeiter/${encodeURIComponent(p.user_id)}` : "/hr/mitarbeiter";
    case "lohnart_fehlt":
      return "/hr/einstellungen";
    default:
      // schicht_ohne_zeit / zeit_ohne_schicht / ueberstunden_offen: kein
      // eindeutiges Ziel — bewusst kein erfundener Link.
      return p.user_id ? `/hr/zeiterfassung?user_id=${encodeURIComponent(p.user_id)}` : null;
  }
}

// --- Formatierung ------------------------------------------------------------

/** Minuten als `h:mm`, negative Werte mit Minuszeichen. Gleiche Form wie
 *  `personal-typen.stunden`, hier aber mit Vorzeichen-Auskunft für die Farbe. */
export function minutenText(minuten: number): string {
  const vorzeichen = minuten < 0 ? "−" : "";
  const abs = Math.abs(Math.round(minuten));
  return `${vorzeichen}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Prozent mit genau EINER Nachkommastelle (Vertrag §7). */
export function prozentText(wert: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(wert)} %`;
}

/** Tage/Zahlen: höchstens zwei Nachkommastellen, keine erfundene Genauigkeit. */
export function zahlText(wert: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(wert);
}

/** Farbklassen der Status-Pille. Unbekannte Status bleiben neutral — der
 *  Server darf einen neuen Wert liefern, ohne dass die Tabelle bricht. */
export function statusFarbe(status: string): string {
  switch (status) {
    case "ok":
    case "gueltig":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "knapp":
    case "bald":
    case "abweichung":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "ueberschritten":
    case "abgelaufen":
    case "fehlt":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      // ohne_plan und alles Unbekannte
      return "border-border bg-secondary text-muted-foreground";
  }
}

/** Sortierschlüssel einer Zelle: Zahlen bleiben Zahlen (damit −90 vor 5
 *  steht), alles andere wird kleingeschriebener Text. `null` sortiert immer
 *  ans Ende, unabhängig von der Richtung. */
export function sortWert(zelle: BerichtZelle): number | string | null {
  if (zelle === null || zelle === undefined) return null;
  if (typeof zelle === "number") return zelle;
  if (typeof zelle === "boolean") return zelle ? 1 : 0;
  if (Array.isArray(zelle)) return zelle.join(" ").toLowerCase();
  return zelle.toLowerCase();
}

/** Schnellwahl-Zeiträume (rein kalendarisch, UTC — kein Zeitzonen-Anteil, weil
 *  `von`/`bis` reine Kalendertage sind). */
export function zeitraumSchnellwahl(
  art: "dieserMonat" | "vormonat" | "diesesJahr",
  heute: string,
): { von: string; bis: string } {
  const d = new Date(`${heute}T00:00:00Z`);
  const j = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (art === "diesesJahr") {
    return { von: iso(new Date(Date.UTC(j, 0, 1))), bis: iso(new Date(Date.UTC(j, 11, 31))) };
  }
  const versatz = art === "vormonat" ? -1 : 0;
  const start = new Date(Date.UTC(j, m + versatz, 1));
  const ende = new Date(Date.UTC(j, m + versatz + 1, 0));
  return { von: iso(start), bis: iso(ende) };
}

export const MONATE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
