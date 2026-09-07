// Zeiträume und Datumsformate der Eigentümer-App — EINE Stelle.
//
// Alles LOKAL gerechnet, nie über `toISOString()`: das liefert UTC, und in
// Kopenhagen kippt damit jeder Tag nach 22/23 Uhr auf den nächsten (die CI
// läuft in UTC, der Betrieb nicht — Datumslogik wird in beiden Zonen geprüft).

/** Die Zeiträume der Finanzübersicht (Vorlage: Current month · Last month · Past 12 months). */
export type ZeitraumWahl =
  | "aktueller_monat"
  | "letzter_monat"
  | "letzte_12_monate"
  | "dieses_jahr"
  | "letztes_jahr";

export const ZEITRAUM_LABEL: Record<ZeitraumWahl, string> = {
  aktueller_monat: "Aktueller Monat",
  letzter_monat: "Letzter Monat",
  letzte_12_monate: "12 Monate",
  dieses_jahr: "Dieses Jahr",
  letztes_jahr: "Letztes Jahr",
};

/** Die drei Schnellwahl-Chips der Startseite; die übrigen nur im Blatt. */
export const ZEITRAUM_CHIPS: ZeitraumWahl[] = ["aktueller_monat", "letzter_monat", "letzte_12_monate"];

export const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
export const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WOCHENTAGE_LANG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

/** Lokales Kalenderdatum als YYYY-MM-DD. */
export function isoLokal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/** YYYY-MM-DD → lokales Date (Mittag, damit keine DST-Kante den Tag kippt). */
export function ausIso(iso: string): Date {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(j, (m || 1) - 1, t || 1, 12);
}

/** Letzter Tag eines Monats (monat 0-basiert). */
export function monatsEnde(jahr: number, monat: number): Date {
  return new Date(jahr, monat + 1, 0, 12);
}

/** Grenzen eines gewählten Zeitraums, beide Tage inklusiv. */
export function zeitraumGrenzen(wahl: ZeitraumWahl, heute: Date): { von: string; bis: string } {
  const j = heute.getFullYear();
  const m = heute.getMonth();
  switch (wahl) {
    case "aktueller_monat":
      return { von: isoLokal(new Date(j, m, 1, 12)), bis: isoLokal(monatsEnde(j, m)) };
    case "letzter_monat": {
      const d = new Date(j, m - 1, 1, 12);
      return {
        von: isoLokal(d),
        bis: isoLokal(monatsEnde(d.getFullYear(), d.getMonth())),
      };
    }
    case "letzte_12_monate": {
      // Zwölf VOLLE Monate bis einschließlich des laufenden (Vorlage:
      // „Jul 2025 – Jul 2026").
      const start = new Date(j, m - 11, 1, 12);
      return { von: isoLokal(start), bis: isoLokal(monatsEnde(j, m)) };
    }
    case "dieses_jahr":
      return { von: `${j}-01-01`, bis: `${j}-12-31` };
    case "letztes_jahr":
      return { von: `${j - 1}-01-01`, bis: `${j - 1}-12-31` };
  }
}

/** „Mittwoch, 8. Juli" */
export function datumLang(d: Date): string {
  return `${WOCHENTAGE_LANG[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
}

/** „Sa, 22. Aug" */
export function datumKurz(iso: string): string {
  const d = ausIso(iso);
  return `${WOCHENTAGE_KURZ[d.getDay()]}, ${d.getDate()}. ${MONATE_KURZ[d.getMonth()]}`;
}

/** „22.–26. August 2026" bzw. „28. Aug – 3. Sep 2026" bei Monatswechsel. */
export function spanneLesbar(vonIso: string, bisIso: string): string {
  const a = ausIso(vonIso);
  const b = ausIso(bisIso);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    if (a.getDate() === b.getDate()) return `${a.getDate()}. ${MONATE[a.getMonth()]} ${a.getFullYear()}`;
    return `${a.getDate()}.–${b.getDate()}. ${MONATE[a.getMonth()]} ${a.getFullYear()}`;
  }
  const jahrA = a.getFullYear() === b.getFullYear() ? "" : ` ${a.getFullYear()}`;
  return `${a.getDate()}. ${MONATE_KURZ[a.getMonth()]}${jahrA} – ${b.getDate()}. ${MONATE_KURZ[b.getMonth()]} ${b.getFullYear()}`;
}

/** „Jul 2026" oder „Jul 2025 – Jul 2026" für die Diagramm-Legende. */
export function zeitraumLegende(vonIso: string, bisIso: string): string {
  const a = ausIso(vonIso);
  const b = ausIso(bisIso);
  const ma = `${MONATE_KURZ[a.getMonth()]} ${a.getFullYear()}`;
  const mb = `${MONATE_KURZ[b.getMonth()]} ${b.getFullYear()}`;
  return ma === mb ? ma : `${ma} – ${mb}`;
}

/** Nächte zwischen zwei Kalendertagen (Abreise exklusiv). */
export function naechte(vonIso: string, bisIso: string): number {
  const ms = ausIso(bisIso).getTime() - ausIso(vonIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Tag um n Tage verschoben, als ISO. */
export function tagPlus(iso: string, n: number): string {
  const d = ausIso(iso);
  d.setDate(d.getDate() + n);
  return isoLokal(d);
}

/**
 * Veränderung in Prozent gegen den Vergleichswert — `null`, wenn sie nicht
 * berechenbar ist (kein Vergleich, Vergleich 0, einer der Werte fehlt).
 * Aus 0 → 500 „unendlich" zu machen wäre eine erfundene Zahl (Wurzel 4).
 */
export function veraenderungPct(aktuell: number | null, vergleich: number | null): number | null {
  if (aktuell === null || vergleich === null || vergleich === 0) return null;
  return Math.round(((aktuell - vergleich) / Math.abs(vergleich)) * 100);
}

/** Prozent mit deutschem Komma, „46,8 %" — null → „—". */
export function prozent(wert: number | null, stellen = 1): string {
  if (wert === null) return "—";
  return `${wert.toFixed(stellen).replace(".", ",")} %`;
}
