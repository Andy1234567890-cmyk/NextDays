// Gemeinsames Aussehen der unteren Tab-Leiste für alle drei Erlebnisse
// (Gast · Agentur · Eigentümer). Struktur nach dem Airbnb-Muster: weiße Leiste
// mit haarfeiner Oberkante, dünne Outline-Icons, aktiver Tab im Akzent, Label
// klein unter dem Icon. Nur Darstellung — welche Tabs jemand sieht, entscheidet
// weiterhin die Rolle im jeweiligen Navigator (§4.3).
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { PixelRatio } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import type { useTheme } from "@/theme/ThemeProvider";

type Theme = ReturnType<typeof useTheme>;

// Tab-Icon-Fabrik: der aktive Zustand wird über die Strichstärke mitgezeichnet,
// nicht nur über die Farbe.
export function tabIcon(name: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Icon n={name} s={24} sw={focused ? 2 : 1.6} c={color} />
  );
}

// Höhe eines Tabs OHNE die Safe-Area: Icon + Abstand + Label. Das Label wächst
// mit der Systemschriftgröße mit (Barrierefreiheit), die Leistenhöhe war aber
// fest — bei „große Schrift" wurde die Beschriftung deshalb unten
// abgeschnitten („Übersicht" ohne Unterlängen, gemeldet 21.08.2026 auf einem
// Gerät mit Drei-Tasten-Navigation). `getFontScale` ist derselbe Faktor, mit
// dem RN den Text skaliert; die Leiste rechnet ihn jetzt mit.
//
// Bewusst NICHT `tabBarAllowFontScaling: false`: das würde die Leiste hübsch
// halten und die Barrierefreiheit brechen — wer große Schrift braucht, braucht
// sie auch hier.
const ICON = 24;
const LABEL_ABSTAND = 3;
const LABEL_ZEILE = 14;
const OBEN = 8;
// Luft unter dem Label. Ohne sie sitzt die Unterlänge auf der Kante.
const UNTEN = 6;

export function tabScreenOptions(t: Theme, bottomInset: number): BottomTabNavigationOptions {
  const skala = PixelRatio.getFontScale();
  const inhalt = OBEN + ICON + LABEL_ABSTAND + LABEL_ZEILE * skala + UNTEN;
  return {
    headerShown: false,
    tabBarActiveTintColor: t.palette.accent,
    tabBarInactiveTintColor: t.palette.soft,
    tabBarStyle: {
      backgroundColor: t.palette.surface,
      borderTopColor: t.palette.line,
      borderTopWidth: 1,
      elevation: 0,
      // Inhaltshöhe + untere Safe-Area (Home-Indicator ODER
      // Navigationsleiste), sonst kleben die Labels am Rand und der Indicator
      // überlappt sie. Die Inhaltshöhe wächst mit der Systemschrift.
      //
      // `paddingBottom` ist GENAU der Inset — die Luft unter dem Label (`UNTEN`)
      // steckt schon in `inhalt`. Sie hier ein zweites Mal zu addieren nahm dem
      // Label denselben Platz wieder weg, den die höhere Leiste ihm gerade
      // gegeben hatte. Dass wir es überhaupt selbst setzen müssen: die
      // Bibliothek legt `paddingBottom: insets.bottom` VOR `tabBarStyle` ins
      // Style-Array (BottomTabBar.tsx), unser Wert gewinnt also — und eine
      // eigene `height` übernimmt `getTabBarHeight` unverändert, statt selbst
      // `TABBAR_HEIGHT_UIKIT + inset` zu rechnen. Beides zusammen heißt: wer
      // die Höhe anfasst, muss auch das Padding vollständig führen.
      height: inhalt + bottomInset,
      paddingTop: OBEN,
      paddingBottom: bottomInset,
    },
    tabBarLabelStyle: {
      fontSize: 10,
      lineHeight: LABEL_ZEILE,
      fontFamily: t.fonts.medium,
      marginTop: 3,
    },
  };
}
