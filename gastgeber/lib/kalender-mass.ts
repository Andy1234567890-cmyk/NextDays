// Maße und Muster des Multi-Kalenders — EINE Quelle für Raster, Balken und
// Panel. Die Werte sind am Vorbild (Airbnb-Multikalender) ausgemessen, nicht
// geschätzt: Spalte 80 px, Zeile 48 px, Seitenleiste 280 px, Balken 24 px hoch.
// In rem geführt (Projektregel), damit die Größe der Textgröße folgt.

/** Breite einer Tagesspalte. */
export const SPALTE_REM = 5;
/** Höhe einer Objektzeile. */
export const ZEILE_REM = 3;
/** Breite der Inserate-Spalte links. */
export const SEITE_REM = 17.5;
/** Höhe eines Buchungsbalkens. */
export const BALKEN_REM = 1.5;
/** Breite des rechten Panels — gemessen: 368 px inkl. 24 px Innenabstand. */
export const PANEL_REM = 23;
// Die drei Kopfhöhen rechts MÜSSEN zusammen so hoch sein wie der Kopf der
// Inserate-Spalte links — sonst stehen Zeile und Objekt um ein paar Pixel
// versetzt, und im Raster liest man die Buchung des Nachbarn.
/** Werkzeugleiste (Monat · Heute · Ebenen). */
export const LEISTE_REM = 3.5;
/** Zeile mit Monatstitel und den Wochen-Pfeilen. */
export const NAV_REM = 2.5;
/** Tageskopf (Wochentag + Tageszahl). */
export const TAGKOPF_REM = 3.75;
/** Gesamthöhe über dem Raster — die Inserate-Spalte übernimmt sie. */
export const KOPF_REM = LEISTE_REM + NAV_REM + TAGKOPF_REM;

/**
 * Ein Buchungsbalken beginnt in der MITTE des Anreisetages und endet in der
 * Mitte des Abreisetages — so bleibt der Abreisetag sichtbar für eine neue
 * Anreise buchbar, genau wie im Vorbild. Der Balken ist beidseitig 2 px
 * eingerückt, damit zwei aneinandergrenzende Buchungen nicht verschmelzen.
 */
export function balkenGeometrie(startIndex: number, naechte: number) {
  return {
    left: `calc(${startIndex * SPALTE_REM + SPALTE_REM / 2}rem + 0.125rem)`,
    width: `calc(${naechte * SPALTE_REM}rem - 0.25rem)`,
  };
}

/**
 * Diagonale Schraffur für gesperrte Nächte — dieselbe Machart wie im Vorbild
 * (ein Farbverlauf mit einer 1-px-Linie über die Diagonale), damit ein
 * gesperrter Tag auch ohne Farbe erkennbar bleibt.
 */
export const SCHRAFFUR = {
  backgroundImage:
    "linear-gradient(to left top, transparent 0%, transparent calc(50% - 1px), rgb(176,176,176) 50%, transparent calc(50% + 1px), transparent 100%)",
} as const;

// --- Objekt-Kalender (Monatsansicht) --------------------------------------
// Am 06.09.2026 an Airbnbs `/multicalendar/{listing_id}` GEMESSEN, nicht
// geschätzt. Die Werte stehen hier als eine Quelle, damit sie nicht in drei
// Komponenten auseinanderlaufen:
//
//   Monatstitel im Kopf      40 px / 44 px, Gewicht 500, Laufweite −1,2 px
//   Monatsüberschrift Raster 40 px / 44 px, Gewicht 600, Laufweite −1,2 px
//   Wochentagskopf           14 px / 18 px, Gewicht 400, grau, zentriert
//   Tageskachel              169 × 132 px, Inhalt ZENTRIERT
//   Tageszahl                18 px / 32 px, Gewicht 500, grau, Kreis 32 px
//   Heute                    derselbe Kreis, gefüllt, Text weiß
//   Preis in der Kachel      18 px / 26 px, Gewicht 400, grau
//   Panel-Zeile              364 × 72 px; Titel 16/20 Gewicht 500,
//                            Wert 16/20 Gewicht 400 grau
//   Panel-Unterseite         Titel 16/20 Gewicht 600 ZENTRIERT,
//                            Betrag 48 px / 62 px Gewicht 700 zentriert,
//                            Zurück-Knopf 40 px rund, gefüllt (kein Rahmen)

/** Höhe einer Tageskachel in der Monatsansicht (132 px). */
export const KACHEL_REM = 8.25;
/** Durchmesser des Tageszahl-Kreises (32 px). */
export const TAGESZAHL_REM = 2;
