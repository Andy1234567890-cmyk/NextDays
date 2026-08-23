// Welche Sprache eine Kunden-Website zeigt (0426).
//
// Vorher stand hier ein hartes „de": `NICHT_EDITIERBAR.locale` war der Wert, mit
// dem JEDE veröffentlichte Seite gerendert wurde. Eine dänische Website, deren
// Texte in `da` UND `de` gepflegt waren, zeigte ihren Gästen also Deutsch — und
// weil `pickText` bei fehlendem Treffer die erste vorhandene Sprache nimmt, fiel
// es nur dort auf, wo beide Fassungen existierten. Ein Fehler, der wie eine
// Laune aussieht.
//
// Die Reihenfolge der Entscheidung:
//   1. `?lang=xx` — die ausdrückliche Wahl des Besuchers (Sprachwähler in der
//      Kopfzeile). Als Query und nicht als Cookie, damit die Wahl in einem Link
//      weitergegeben werden kann und ohne JavaScript funktioniert.
//   2. `default_language` der Website — was der Betrieb eingestellt hat.
//   3. Die erste Sprache seiner Liste.
//   4. `de` als letzter Halt. Das ist KEIN erfundener Datenwert, sondern die
//      Sprache, in der `pickText` sucht, wenn sonst nichts bekannt ist — und
//      `pickText` fällt seinerseits auf den ersten nicht-leeren Text zurück.
//      Eine Seite bleibt also lesbar, egal was eingestellt ist.

import type { SiteBranding } from "./site-context";

const NOTNAGEL = "de";

/** Nur diese Sprachen sind gültig — dieselbe Liste wie im Backend
 *  (`_SITE_LOCALES`) und im Dashboard (`web/i18n/locales.ts`). Ohne die Prüfung
 *  landete ein beliebiger Wert aus der Adresszeile als Schlüssel in einer
 *  Locale-Map und im `lang`-Attribut des Dokuments (Wurzel 3). */
const ERLAUBT = new Set([
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
]);

export function istSprache(wert: unknown): wert is string {
  return typeof wert === "string" && ERLAUBT.has(wert);
}

/** Sprachen, die diese Website führt. Leer, solange nichts eingestellt ist —
 *  dann zeigt die Kopfzeile keinen Wähler, statt einen mit einem Eintrag. */
export function sprachenDerSite(
  branding: SiteBranding | null | undefined,
): string[] {
  return (branding?.languages ?? []).filter(istSprache);
}

/** Die Sprache, in der gerendert wird. */
export function spracheWaehlen(
  branding: SiteBranding | null | undefined,
  wunsch?: string | null,
): string {
  const gefuehrt = sprachenDerSite(branding);
  // Der Wunsch des Besuchers gilt nur, wenn die Website diese Sprache auch
  // führt. Sonst käme über `?lang=fi` eine Seite heraus, für die es keine Texte
  // gibt — leer, ohne Hinweis, und in der Adresszeile sieht alles richtig aus.
  if (istSprache(wunsch) && (gefuehrt.length === 0 || gefuehrt.includes(wunsch))) {
    return wunsch;
  }
  const standard = branding?.default_language;
  if (istSprache(standard)) return standard;
  return gefuehrt[0] ?? NOTNAGEL;
}
