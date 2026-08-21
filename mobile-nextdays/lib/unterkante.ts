// Wie viel Platz ein Bildschirm unten freihalten muss.
//
// Der Grund: In einem Tab-Erlebnis endet die Fläche NICHT am Bildschirmrand,
// sondern über der Tab-Leiste. Ein `paddingBottom: insets.bottom` reicht dafür
// nicht — es lässt genau die Systemleiste frei und schiebt den letzten Inhalt
// unter die Tab-Leiste. Live gesehen am 21.08.2026 im Belegungskalender: die
// unterste Objektzeile lag hinter „Übersicht · Kalender · …" und war nicht
// erreichbar.
//
// `useBottomTabBarHeight()` liefert die WIRKLICHE Höhe der Leiste samt Inset
// (React Navigation misst sie und stellt sie über einen Context bereit). Der
// Hook WIRFT aber, wenn der Bildschirm nicht in einem Tab-Navigator liegt
// (Detailseiten im Root-Stack) — deshalb wird der Context hier direkt gelesen
// und der Fehlerfall als „kein Tab" behandelt, statt jeden Aufrufer zu einer
// eigenen Fallunterscheidung zu zwingen.
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Der Abstand, den ein Bildschirm unten freihalten muss:
 * Tab-Leisten-Höhe (im Tab-Erlebnis) oder die untere Safe-Area (sonst).
 *
 * Bewusst NICHT beides addiert: die Leistenhöhe ENTHÄLT den Inset bereits
 * (`getTabBarHeight`: `TABBAR_HEIGHT + inset`, bzw. unsere eigene Höhe in
 * `navigation/tab-style.tsx`). Eine Summe wäre ein zweiter leerer Streifen.
 */
export function useUnterkante(): number {
  const tabHoehe = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return tabHoehe ?? insets.bottom;
}
