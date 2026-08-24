// Welche Währung ein Besucher auf der Marketing-Seite sieht.
//
// Die Preisseite zeigte einem dänischen Besucher „19,90 €". Das ist keine
// Preisangabe, sondern eine Umrechnungsaufgabe: er muss selbst einen Kurs
// suchen, um zu wissen, was ihn das kostet. Deshalb hängt die Anzeigewährung
// jetzt an der gewählten Sprache.
//
// WARUM SPRACHE UND NICHT LAND:
// Diese Seite hat keine Landkennung — sie hat ein Sprach-Cookie (`nd_locale`,
// i18n/locales.ts) und kein URL-Präfix. Ein Land ließe sich nur aus der IP
// raten; das wäre eine zweite, widersprüchliche Quelle neben der Sprache, die
// der Besucher SELBST gewählt hat. Wer die Seite auf Dänisch liest, rechnet in
// Kronen — das ist die belastbarere Annahme.
//
// WO ES AUSEINANDERGEHT (bewusst, benannt statt versteckt):
// Stripe Checkout wählt die Währung nach IP, nicht nach Sprache (Stripe-Doku,
// „Preise in mehreren Währungen verwenden"). Ein dänischsprachiger Besucher in
// Deutschland sieht hier also DKK und zahlt im Checkout in EUR. Das ist kein
// Widerspruch in den Zahlen — es sind dieselben `currency_options` am selben
// Stripe-Preis, nur zwei verschiedene Auswahlkriterien. Wenn das später
// vereinheitlicht werden soll, ist die Stelle HIER (Landkennung ergänzen), nicht
// im Backend.
//
// KEINE UMRECHNUNG: hier steht nur, welche Währung ANGEFRAGT wird. Die Beträge
// kommen aus Stripe (`currency_options`, gesetzt von
// deploy/billing/seed_stripe_prices.py). Hat Stripe für eine Währung keine
// Beträge, antwortet das Backend in der Standardwährung und sagt im Feld
// `currency`, welche es wurde — die Seite zeigt dann EUR. Nie wird ein Betrag
// aus einem Kurs erzeugt (Wurzel 4).

import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

/**
 * Sprache → Währung, aber NUR für die Sprachen, deren Sprachraum eine eigene
 * Währung hat.
 *
 * Es sind genau sechs. Die EU hat 27 Mitglieder und 24 Amtssprachen, aber nur
 * noch sechs Nicht-Euro-Währungen: Bulgarien hat den Euro am 01.01.2026
 * eingeführt (Ratsbeschluss 08.07.2025, feste Umstellung 1 EUR = 1,95583 BGN),
 * Kroatien 2023. Für BGN und HRK gibt es hier deshalb bewusst keinen Eintrag.
 *
 * Alle übrigen Sprachen fehlen absichtlich: Deutsch, Französisch, Italienisch,
 * Spanisch, Niederländisch, Portugiesisch, Griechisch, Finnisch, Estnisch,
 * Lettisch, Litauisch, Slowakisch, Slowenisch, Irisch, Maltesisch, Kroatisch,
 * Bulgarisch und Englisch werden in Euro-Ländern gesprochen. Englisch ist der
 * Grenzfall — Irland und Malta sind Euro-Länder, das Vereinigte Königreich ist
 * nicht in der EU und wir spielen dort nicht aus; „en" bleibt daher Euro.
 */
const WAEHRUNG_JE_SPRACHE: Partial<Record<Locale, string>> = {
  da: "DKK", // Dänemark
  sv: "SEK", // Schweden
  pl: "PLN", // Polen
  cs: "CZK", // Tschechien
  hu: "HUF", // Ungarn
  ro: "RON", // Rumänien
};

/**
 * Die Währung, die für diese Sprache beim Backend angefragt wird.
 *
 * Rückgabe ist immer ein ISO-4217-Code — für alle Euro-Sprachen `"EUR"`. Kein
 * `null`: der Aufrufer soll die Währung nicht optional behandeln müssen, und
 * ein fehlender Wert hätte am Endpunkt dieselbe Wirkung wie „EUR".
 */
export function anzeigewaehrung(locale: string): string {
  const key = locale as Locale;
  return WAEHRUNG_JE_SPRACHE[key] ?? "EUR";
}

/**
 * Zeigt diese Sprache eine Währung, die NICHT der Euro ist?
 *
 * Braucht die Preisseite für den Wettbewerbsvergleich: die Preise der
 * Wettbewerber sind in Euro abgelesen (content/wettbewerb.ts) und dürfen nicht
 * gegen einen Kronen-Betrag gestellt werden, als wären es dieselben Einheiten.
 */
export function istFremdwaehrung(locale: string): boolean {
  return anzeigewaehrung(locale) !== "EUR";
}

/** Die Sprache, deren Währung gilt, wenn keine gesetzt ist. */
export const STANDARD_ANZEIGEWAEHRUNG = anzeigewaehrung(DEFAULT_LOCALE);
