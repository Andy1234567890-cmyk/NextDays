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
/** Die 24 in der Reihenfolge, in der sie ein Gast erwartet — alphabetisch nach
 *  ISO-Code, dieselbe wie im Dashboard (`web/i18n/locales.ts`). */
export const ALLE_SPRACHEN = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;

const ERLAUBT = new Set([
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
]);

export function istSprache(wert: unknown): wert is string {
  return typeof wert === "string" && ERLAUBT.has(wert);
}

/** Sprachen, die diese Website dem GAST anbietet.
 *
 *  Hat der Betrieb welche eingestellt, sind es genau die. Hat er KEINE
 *  eingestellt, sind es alle 24 EU-Amtssprachen.
 *
 *  Warum der zweite Fall so ausfällt: der Renderer hat für alle 24 einen
 *  vollständigen Textkatalog (`texte.ts`), und Kundeninhalte laufen über
 *  `pickText`, das auf den ersten vorhandenen Text zurückfällt. Eine Seite in
 *  Griechisch zeigt also griechische Bedienelemente und den gepflegten Text des
 *  Betriebs — sie ist nie leer.
 *
 *  Vorher war dieser Fall die leere Liste. Das klang vorsichtig, hieß aber:
 *  ein Betrieb, der nie etwas eingestellt hat (der Normalfall bei einer neuen
 *  Website), zeigte seinen Gästen GAR KEINEN Sprachwähler — der Renderer
 *  konnte 24 Sprachen und bot keine an. Gefunden am 26.08.2026: eine dänische
 *  Website servierte ihren Gästen deutsche Bedienelemente, ohne Weg zu etwas
 *  anderem. */
export function sprachenDerSite(
  branding: SiteBranding | null | undefined,
): string[] {
  const eigene = (branding?.languages ?? []).filter(istSprache);
  return eigene.length > 0 ? eigene : [...ALLE_SPRACHEN];
}

/** Die Sprache, in der gerendert wird. */
export function spracheWaehlen(
  branding: SiteBranding | null | undefined,
  wunsch?: string | null,
): string {
  // Die EINGESTELLTEN, nicht das Angebot aus `sprachenDerSite`.
  //
  // Der Unterschied ist der ganze Punkt: `sprachenDerSite` fällt bewusst auf
  // alle 24 zurück, damit der Gast eine Wahl HAT. Diese Liste hier entscheidet
  // aber, welche Sprache OHNE Wunsch herauskommt — und `gefuehrt[0]` von 24
  // wäre Bulgarisch. Genau das passierte: eine Website ohne Einstellung
  // begrüßte jeden Besucher auf Bulgarisch.
  const gefuehrt = (branding?.languages ?? []).filter(istSprache);
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

/** Eine seiteninterne Adresse mit der aktuellen Sprache versehen.
 *
 *  WARUM ES DIESEN HELFER GIBT
 *  Der Sprachwähler setzt `?lang=`, aber jeder Link, der die Sprache nicht
 *  weitergibt, verliert sie wieder — und zwar unsichtbar: die Seite erscheint,
 *  nur in der falschen Sprache. Live gefunden am 26.08.2026: Startseite auf
 *  Dänisch, Klick auf ein Objekt, und die Objektseite stand auf Deutsch.
 *
 *  Die Sprache wird NUR angehängt, wenn es etwas anzuhängen gibt. Ein
 *  `?lang=de` an jeder Adresse wäre eine zweite Fassung derselben Seite für
 *  Suchmaschinen (Duplicate Content), wo die Standardsprache ohnehin gilt.
 *
 *  `standard` ist die Sprache, die ohne Parameter herauskäme. Stimmt sie mit
 *  der gewünschten überein, bleibt die Adresse sauber. */
export function mitSprache(
  pfad: string,
  sprache: string | null | undefined,
  standard?: string | null,
): string {
  if (!istSprache(sprache)) return pfad;
  // Die Standardsprache bekommt kein Präfix.
  //
  // `standard ?? NOTNAGEL` und nicht nur `standard &&`: ohne gesetzte
  // `default_language` fiel der Vergleich sonst aus, und die Standardsprache
  // wurde präfixiert — der Canonical zeigte dann auf `/de/kontakt`, während
  // die verlinkte Adresse `/kontakt` ist. Zwei Adressen, von denen eine
  // niemand verlinkt. `spracheWaehlen` benutzt denselben Notnagel, wenn nichts
  // gesetzt ist; damit stimmen beide überein.
  if (sprache === (standard || NOTNAGEL)) return pfad;
  // PRÄFIX, nicht Parameter (0476).
  //
  // Hier stand `?lang=da`. Das funktionierte für den Besucher und war für
  // Suchmaschinen wertlos: Google listet URL-Parameter ausdrücklich als nicht
  // empfohlene Form für Sprachfassungen und indexiert sie nicht als eigene
  // Seite. Eine übersetzte Fassung ohne eigene Adresse rankt nicht — womit der
  // ganze Aufwand des Übersetzens für die Auffindbarkeit nichts brachte.
  //
  // Eine Adresse, die schon eine Sprache trägt, wird NICHT ein zweites Mal
  // versehen: `/da/da/kontakt` wäre ein 404, und der Fehler entstünde erst,
  // wenn zwei Helfer denselben Pfad anfassen.
  const [ohneQuery, query] = pfad.split("?", 2);
  const teile = ohneQuery.split("/").filter(Boolean);
  if (istSprache((teile[0] ?? "").toLowerCase())) return pfad;
  const rest = teile.join("/");
  const neu = rest ? `/${sprache}/${rest}` : `/${sprache}`;
  return query ? `${neu}?${query}` : neu;
}
