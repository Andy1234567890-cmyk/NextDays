// Formensprache der Eigentümer-App — die Struktur, die `theme/tokens.ts` NICHT
// hergibt.
//
// WARUM EINE EIGENE DATEI: `theme/tokens.ts` ist SCHWESTERDATEI und wird von
// der CI byte-identisch zu mobile-bestdays/mobile-nextdays gehalten. Dort etwas
// zu ergänzen, hieße es in drei Apps zu ergänzen — auch in zweien, die diese
// Formensprache nicht führen. Die Tokens dort bleiben also unangetastet
// (Palette, Radien, Typo, Schatten); hier steht ausschließlich, was für das
// Karten- und Widget-Muster dieser App hinzukommt.
//
// HERKUNFT: Struktur nach Smoobu (docs/SMOOBU-UI-ANALYSE.md) — gerahmte Karten
// mit weichem Schatten, Kennzahl-Widgets, runder Aktionsknopf. FARBEN kommen
// unverändert aus unserer Marke (`theme/marke.ts`, Akzent #C42B3A). Smoobus
// Blau #0F62FE wird NICHT übernommen (Ansage 02.09.2026).
import type { TextStyle, ViewStyle } from "react-native";

import type { Palette } from "@/theme/tokens";

/**
 * Die Karte. Smoobu rahmt jede Kachel sichtbar ein und legt einen weichen,
 * breiten Schatten darunter — das ist der auffälligste Unterschied zum
 * randlosen Airbnb-Muster der beiden anderen Apps.
 *
 * Gemessen an der Vorlage: Radius 12 px, Schatten
 * `rgba(52,58,63,0.13) 0 0 16px`. Der Rahmen nimmt die Palette-Linie, damit er
 * im Dark Mode mitgeht.
 */
export function karte(p: Palette): ViewStyle {
  return {
    backgroundColor: p.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.line,
    // Der gemessene Smoobu-Schatten. `shadowColor` ist dessen Grundton
    // (#343A3F) — nicht Schwarz, das wirkt auf Weiß härter.
    shadowColor: "#343A3F",
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  };
}

/** Innenabstand einer Karte — 16 px, wie in der Vorlage. */
export const KARTE_PAD = 16;

/** Abstand zwischen zwei Karten. */
export const KARTE_ABSTAND = 12;

/**
 * Kartenkopf: kleine, kräftige Überschrift über dem Inhalt. In der Vorlage
 * steht sie in Halbfett und normaler Textgröße, NICHT als Eyebrow in
 * Großbuchstaben — deshalb hier eigene Werte statt `type.eyebrow`.
 */
export function kartenTitel(p: Palette, fontFamily: string): TextStyle {
  return { fontSize: 15, fontFamily, color: p.ink, letterSpacing: -0.1 };
}

/**
 * Der runde Aktionsknopf unten rechts (Smoobus grüner Kreis mit Kalendersymbol).
 * Farbe kommt aus dem Akzent der Marke, NICHT aus Smoobus Grün — ein zweiter
 * Signalton neben unserem Rot wäre eine erfundene Markenfarbe (Wurzel 4).
 *
 * `unten` ist der Abstand zur Unterkante des Inhalts; der Aufrufer addiert die
 * Höhe der Tab-Leiste bzw. die Safe-Area selbst dazu (`lib/unterkante.ts`).
 */
export const AKTION_KNOPF = 56;

export function aktionKnopf(akzent: string): ViewStyle {
  return {
    width: AKTION_KNOPF,
    height: AKTION_KNOPF,
    borderRadius: AKTION_KNOPF / 2,
    backgroundColor: akzent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  };
}

/**
 * Sanfte Füllfläche für Segmentleisten und inaktive Pillen. Smoobu nutzt dafür
 * ein sehr helles Blaugrau (#F2F5FA gemessen); übernommen wird die HELLIGKEIT,
 * der Ton kommt aus unserer Palette (`surface2`), damit Light und Dark stimmen.
 */
export function fuellung(p: Palette): ViewStyle {
  return { backgroundColor: p.surface2, borderRadius: 999 };
}
