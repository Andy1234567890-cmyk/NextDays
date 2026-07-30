// Gemeinsames Aussehen der unteren Tab-Leiste für alle drei Erlebnisse
// (Gast · Agentur · Eigentümer). Struktur nach dem Airbnb-Muster: weiße Leiste
// mit haarfeiner Oberkante, dünne Outline-Icons, aktiver Tab im Akzent, Label
// klein unter dem Icon. Nur Darstellung — welche Tabs jemand sieht, entscheidet
// weiterhin die Rolle im jeweiligen Navigator (§4.3).
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

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

export function tabScreenOptions(t: Theme, bottomInset: number): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: t.palette.accent,
    tabBarInactiveTintColor: t.palette.soft,
    tabBarStyle: {
      backgroundColor: t.palette.surface,
      borderTopColor: t.palette.line,
      borderTopWidth: 1,
      elevation: 0,
      // Inhaltshöhe + untere Safe-Area (Home-Indicator), sonst kleben die
      // Labels am Rand und der Indicator überlappt sie.
      height: 56 + bottomInset,
      paddingTop: 8,
      paddingBottom: bottomInset,
    },
    tabBarLabelStyle: {
      fontSize: 10,
      lineHeight: 14,
      fontFamily: t.fonts.medium,
      marginTop: 3,
    },
  };
}
