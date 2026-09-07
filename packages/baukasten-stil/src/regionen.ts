// Kopf- und Fußzeile als EBENEN (Etappe 2b, 05.09.2026).
//
// Kopf- und Fußzeile kommen aus dem Theme, nicht aus Blöcken: ihre Teile
// (Logo, Navigation, Buchen-Knopf …) sind fest programmiert und site-weit.
// Framer zeigt beide trotzdem als aufklappbare Ebenen mit Kindern, und genau
// das baut der Ebenen-Baum nach. Was sich je Teil einstellen lässt, steht in
// `branding.header_teile` / `branding.footer_teile` (Migration 0570):
//
//   { hidden_on: [geraet…], locked: bool,            ← die Region selbst
//     reihenfolge: [teil…],                          ← Reihenfolge der Kinder
//     teile: { <teil>: { hidden_on: [...], locked } } }
//
// Diese Datei ist die EINE Lesestelle dafür — Renderer (builder) und Editor
// (web) bekommen dieselbe Reihenfolge, dieselbe Sichtbarkeit und dieselben
// Tailwind-Klassen. Zwei Kopien liefen beim nächsten Teil auseinander.
//
// Alles wird beim Lesen erneut geprüft (Wurzel 8: jsonb aus der DB) und
// Unbekanntes verworfen, nicht geraten (Wurzel 4). Ein Teil ohne Eintrag ist
// sichtbar und nicht gesperrt — das ist der Zustand jeder bestehenden Site,
// und ein neues Feld darf ihn nicht verändern (Wurzel 1).

import { GERAETE, type Geraet } from "./index";

export type Region = "kopfzeile" | "fusszeile";

/** Die Teile der Kopfzeile in ihrer Standard-Reihenfolge.
 *
 *  Logo und Slogan stehen im Theme an fester Stelle (links bzw. mittig);
 *  UMSORTIERBAR sind nur die drei der rechten Gruppe. `reihenfolge` darf
 *  deshalb alle fünf nennen, gewirkt wird nur auf Navigation, Sprachwähler
 *  und Buchen-Knopf — siehe `teileReihenfolge`. */
export const KOPF_TEILE = [
  "logo",
  "slogan",
  "navigation",
  "sprachwaehler",
  "buchen",
] as const;
export type KopfTeil = (typeof KOPF_TEILE)[number];
/** Die drei Teile der rechten Gruppe, die sich umsortieren lassen. */
export const KOPF_GRUPPE: readonly KopfTeil[] = ["navigation", "sprachwaehler", "buchen"];

/** Die Teile der Fußzeile in ihrer Standard-Reihenfolge — alle umsortierbar. */
export const FUSS_TEILE = ["navigation", "social", "bildnachweise", "copyright"] as const;
export type FussTeil = (typeof FUSS_TEILE)[number];

export type TeilStand = { hidden_on: Geraet[]; locked: boolean };
export type RegionStand = TeilStand & {
  reihenfolge: string[];
  teile: Record<string, TeilStand>;
};

/** Welche Teile eine Region kennt. SCHWESTERWERT: `KopfTeil`/`FussTeil` in
 *  `apps/api/.../site_config/schemas_regionen.py`. */
export function teileVon(region: Region): readonly string[] {
  return region === "kopfzeile" ? KOPF_TEILE : FUSS_TEILE;
}

function geraeteLesen(v: unknown): Geraet[] {
  if (!Array.isArray(v)) return [];
  return GERAETE.filter((g) => v.includes(g));
}

function teilLesen(v: unknown): TeilStand {
  const o =
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  return { hidden_on: geraeteLesen(o.hidden_on), locked: o.locked === true };
}

/** Der geprüfte Stand einer Region aus dem rohen Branding-Wert. */
export function regionLesen(region: Region, roh: unknown): RegionStand {
  const erlaubt = teileVon(region);
  const o =
    roh !== null && typeof roh === "object" && !Array.isArray(roh)
      ? (roh as Record<string, unknown>)
      : {};
  const teileRoh =
    o.teile !== null && typeof o.teile === "object" && !Array.isArray(o.teile)
      ? (o.teile as Record<string, unknown>)
      : {};
  const teile: Record<string, TeilStand> = {};
  for (const name of erlaubt) {
    if (name in teileRoh) teile[name] = teilLesen(teileRoh[name]);
  }
  // Reihenfolge: nur bekannte Teile, jeder einmal; was fehlt, kommt in
  // Standardreihenfolge hinten dran — so bleibt die Liste immer vollständig.
  const genannt = Array.isArray(o.reihenfolge)
    ? o.reihenfolge.filter(
        (t, i, a): t is string =>
          typeof t === "string" && erlaubt.includes(t) && a.indexOf(t) === i,
      )
    : [];
  const reihenfolge = [...genannt, ...erlaubt.filter((t) => !genannt.includes(t))];
  return { ...teilLesen(o), reihenfolge, teile };
}

/** Sichtbarkeit und Sperre EINES Teils (fehlt der Eintrag: sichtbar, frei). */
export function teilStand(stand: RegionStand, teil: string): TeilStand {
  return stand.teile[teil] ?? { hidden_on: [], locked: false };
}

/** Die Teile einer Gruppe in der Reihenfolge, in der der Renderer sie zeichnet.
 *  `gruppe` schränkt auf die umsortierbaren Teile ein (Kopfzeile: rechte
 *  Gruppe); ohne Angabe gilt die ganze Region. */
export function teileReihenfolge(
  stand: RegionStand,
  gruppe?: readonly string[],
): string[] {
  return gruppe ? stand.reihenfolge.filter((t) => gruppe.includes(t)) : stand.reihenfolge;
}

/** Neuer Stand mit umgeschalteter Geräte-Menge eines Teils (`teil === null`
 *  = die Region selbst). Dieselbe Normalisierung wie `mitVersteckt` im
 *  Editor: feste Reihenfolge, leere Menge = Schlüssel bleibt, Liste leer. */
export function mitTeilVersteckt(
  stand: RegionStand,
  teil: string | null,
  geraete: Geraet[],
): RegionStand {
  const menge = GERAETE.filter((g) => geraete.includes(g));
  if (teil === null) return { ...stand, hidden_on: menge };
  return {
    ...stand,
    teile: { ...stand.teile, [teil]: { ...teilStand(stand, teil), hidden_on: menge } },
  };
}

export function mitTeilGesperrt(
  stand: RegionStand,
  teil: string | null,
  locked: boolean,
): RegionStand {
  if (teil === null) return { ...stand, locked };
  return {
    ...stand,
    teile: { ...stand.teile, [teil]: { ...teilStand(stand, teil), locked } },
  };
}

/** Ein Teil um eine Stelle innerhalb seiner Gruppe verschieben. Teile außerhalb
 *  der Gruppe behalten ihren Platz in der Liste. */
export function teilVerschoben(
  stand: RegionStand,
  teil: string,
  richtung: -1 | 1,
  gruppe?: readonly string[],
): RegionStand {
  const beweglich = teileReihenfolge(stand, gruppe);
  const i = beweglich.indexOf(teil);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= beweglich.length) return stand;
  const neu = [...beweglich];
  [neu[i], neu[j]] = [neu[j]!, neu[i]!];
  // Die bewegliche Teilfolge zurück in die Gesamtliste schreiben.
  let z = 0;
  const reihenfolge = stand.reihenfolge.map((t) =>
    beweglich.includes(t) ? neu[z++]! : t,
  );
  return { ...stand, reihenfolge };
}

/** Ein Teil per Ziehen VOR ein anderes Teil derselben Gruppe stellen. Teile
 *  außerhalb der Gruppe (Logo, Slogan in der Kopfzeile) bleiben, wo sie sind. */
export function teilVerschobenVor(
  stand: RegionStand,
  teil: string,
  vorTeil: string,
  gruppe?: readonly string[],
): RegionStand {
  const beweglich = teileReihenfolge(stand, gruppe);
  if (teil === vorTeil || !beweglich.includes(teil) || !beweglich.includes(vorTeil)) {
    return stand;
  }
  const ohne = beweglich.filter((t) => t !== teil);
  ohne.splice(ohne.indexOf(vorTeil), 0, teil);
  let z = 0;
  const reihenfolge = stand.reihenfolge.map((t) =>
    beweglich.includes(t) ? ohne[z++]! : t,
  );
  return { ...stand, reihenfolge };
}

/** Der Stand als Branding-Wert zum Speichern — nur, was vom Standard abweicht,
 *  damit eine unberührte Site `{}` schreibt statt einer ausgeschriebenen
 *  Standardliste (Wurzel 2: derselbe Zustand ist derselbe Wert). */
export function regionZumSpeichern(
  region: Region,
  stand: RegionStand,
): Record<string, unknown> {
  const aus: Record<string, unknown> = {};
  if (stand.hidden_on.length) aus.hidden_on = stand.hidden_on;
  if (stand.locked) aus.locked = true;
  const standard = teileVon(region);
  if (stand.reihenfolge.some((t, i) => t !== standard[i])) {
    aus.reihenfolge = stand.reihenfolge;
  }
  const teile: Record<string, TeilStand> = {};
  for (const [name, t] of Object.entries(stand.teile)) {
    if (t.hidden_on.length || t.locked) {
      teile[name] = {
        hidden_on: t.hidden_on,
        locked: t.locked,
      };
    }
  }
  if (Object.keys(teile).length) aus.teile = teile;
  return aus;
}

/** Tailwind-Klassen für „auf diesen Geräten weg" (0449) — dieselbe Regel wie
 *  für Blöcke: LIVE ausgeblendet, im EDITOR durchscheinend, damit der Rückweg
 *  sichtbar bleibt. Eine Stufe wird nur gesetzt, wenn sie sich von der
 *  darunter unterscheidet. Feste Klassennamen, weil Tailwind zur Laufzeit
 *  zusammengesetzte Klassen nicht findet. */
export function sichtbarkeitKlassen(aus: readonly Geraet[], editor: boolean): string {
  if (aus.length === 0) return "";
  const an = {
    mobil: !aus.includes("mobil"),
    tablet: !aus.includes("tablet"),
    desktop: !aus.includes("desktop"),
  };
  const klassen: string[] = [];
  if (editor) {
    klassen.push(an.mobil ? "opacity-100" : "opacity-40");
    if (an.tablet !== an.mobil) klassen.push(an.tablet ? "md:opacity-100" : "md:opacity-40");
    if (an.desktop !== an.tablet) klassen.push(an.desktop ? "lg:opacity-100" : "lg:opacity-40");
    return klassen.join(" ");
  }
  klassen.push(an.mobil ? "block" : "hidden");
  if (an.tablet !== an.mobil) klassen.push(an.tablet ? "md:block" : "md:hidden");
  if (an.desktop !== an.tablet) klassen.push(an.desktop ? "lg:block" : "lg:hidden");
  return klassen.join(" ");
}
