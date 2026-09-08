// Zeiträume und Datumsformate der Eigentümer-App — EINE Stelle.
//
// Alles LOKAL gerechnet, nie über `toISOString()`: das liefert UTC, und in
// Kopenhagen kippt damit jeder Tag nach 22/23 Uhr auf den nächsten (die CI
// läuft in UTC, der Betrieb nicht — Datumslogik wird in beiden Zonen geprüft).
//
// Die Datumsformate nehmen die Übersetzungsfunktion als ERSTEN Parameter statt
// sie aus einem Hook zu holen: dieselben Formate laufen in Screens, in
// `lib/abrechnung.ts` und in Tests, und ein Hook wäre außerhalb von React tot.
import type { TextSchluessel } from "@/lib/sprache";

/** Die Übersetzungsfunktion, wie `useT()` sie liefert. */
export type Uebersetzer = (schluessel: TextSchluessel, werte?: Record<string, string | number>) => string;

/** Die Zeiträume der Finanzübersicht (Vorlage: Current month · Last month · Past 12 months). */
export type ZeitraumWahl =
  | "aktueller_monat"
  | "letzter_monat"
  | "letzte_12_monate"
  | "dieses_jahr"
  | "letztes_jahr";

/**
 * Der Textschlüssel je Zeitraum — NICHT die Beschriftung selbst.
 *
 * WARUM: der Zeitraum wird gespeichert (Finanz-Einstellungen) und gerechnet.
 * Stünde hier deutscher Text, hinge beides an der Sprache der Oberfläche, und
 * ein auf Dänisch gespeicherter Zeitraum wäre auf Deutsch unbekannt.
 */
export const ZEITRAUM_SCHLUESSEL: Record<ZeitraumWahl, TextSchluessel> = {
  aktueller_monat: "zeitraum.aktuellerMonat",
  letzter_monat: "zeitraum.letzterMonat",
  letzte_12_monate: "zeitraum.zwoelfMonate",
  dieses_jahr: "zeitraum.diesesJahr",
  letztes_jahr: "zeitraum.letztesJahr",
};

/** Die drei Schnellwahl-Chips der Startseite; die übrigen nur im Blatt. */
export const ZEITRAUM_CHIPS: ZeitraumWahl[] = ["aktueller_monat", "letzter_monat", "letzte_12_monate"];

/**
 * Monatsname aus dem Katalog. `monat` ist 0-basiert wie `Date.getMonth()`;
 * die Schlüssel sind 1-basiert, weil ein Schlüssel „monat.0" beim Lesen der
 * Sprachdatei niemand als Januar erkennt.
 */
export function monatName(txt: Uebersetzer, monat: number): string {
  return txt(`monat.${monat + 1}` as TextSchluessel);
}

/** Kurzer Monatsname („Aug") für Achsen und Spannen über Monatsgrenzen. */
export function monatKurz(txt: Uebersetzer, monat: number): string {
  return txt(`monatKurz.${monat + 1}` as TextSchluessel);
}

/**
 * Wochentag aus dem Katalog. `tag` kommt von `Date.getDay()` (Sonntag = 0),
 * die Schlüssel zählen ab Montag = 1 und führen Sonntag als 7 — so steht das
 * Raster im Katalog in der Reihenfolge, in der es gezeichnet wird.
 */
export function wochentag(txt: Uebersetzer, tag: number): string {
  return txt(`wtag.${tag === 0 ? 7 : tag}` as TextSchluessel);
}

/** Kurzer Wochentag („Sa"), gleiche Zählung wie `wochentag`. */
export function wochentagKurz(txt: Uebersetzer, tag: number): string {
  return txt(`wtagKurz.${tag === 0 ? 7 : tag}` as TextSchluessel);
}


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
export function datumLang(txt: Uebersetzer, d: Date): string {
  return `${wochentag(txt, d.getDay())}, ${d.getDate()}. ${monatName(txt, d.getMonth())}`;
}

/** „Sa, 22. Aug" */
export function datumKurz(txt: Uebersetzer, iso: string): string {
  const d = ausIso(iso);
  return `${wochentagKurz(txt, d.getDay())}, ${d.getDate()}. ${monatKurz(txt, d.getMonth())}`;
}

/** „22.–26. August 2026" bzw. „28. Aug – 3. Sep 2026" bei Monatswechsel. */
export function spanneLesbar(txt: Uebersetzer, vonIso: string, bisIso: string): string {
  const a = ausIso(vonIso);
  const b = ausIso(bisIso);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const monat = monatName(txt, a.getMonth());
    if (a.getDate() === b.getDate()) return `${a.getDate()}. ${monat} ${a.getFullYear()}`;
    return `${a.getDate()}.–${b.getDate()}. ${monat} ${a.getFullYear()}`;
  }
  const jahrA = a.getFullYear() === b.getFullYear() ? "" : ` ${a.getFullYear()}`;
  return `${a.getDate()}. ${monatKurz(txt, a.getMonth())}${jahrA} – ${b.getDate()}. ${monatKurz(txt, b.getMonth())} ${b.getFullYear()}`;
}

/** „Jul 2026" oder „Jul 2025 – Jul 2026" für die Diagramm-Legende. */
export function zeitraumLegende(txt: Uebersetzer, vonIso: string, bisIso: string): string {
  const a = ausIso(vonIso);
  const b = ausIso(bisIso);
  const ma = `${monatKurz(txt, a.getMonth())} ${a.getFullYear()}`;
  const mb = `${monatKurz(txt, b.getMonth())} ${b.getFullYear()}`;
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

/**
 * Der Dezimaltrenner der Sprache.
 *
 * Hermes bringt kein vollständiges `Intl` mit (React Native ohne
 * `intl`-Variante), `toLocaleString` liefert dort also immer den Punkt.
 * Deshalb die Liste von Hand: Komma ist in der EU der Regelfall, Punkt die
 * Ausnahme — Irland und Malta rechnen englisch.
 */
const PUNKT_SPRACHEN = new Set(["en", "ga", "mt"]);

export function dezimalTrenner(sprache: string): "," | "." {
  return PUNKT_SPRACHEN.has(sprache) ? "." : ",";
}

/** Zahl mit dem Dezimaltrenner der Sprache. */
export function zahl(sprache: string, wert: number, stellen = 1): string {
  return wert.toFixed(stellen).replace(".", dezimalTrenner(sprache));
}

/** Prozent im Format der Sprache, „46,8 %" bzw. „46.8 %" — null → „—". */
export function prozent(sprache: string, wert: number | null, stellen = 1): string {
  if (wert === null) return "—";
  return `${zahl(sprache, wert, stellen)} %`;
}
