// Die Tab-Leiste — fünf Einträge nach der Vorlage (Hostaway Owner App,
// 07.09.2026): Start · Abrechnungen · Aufenthalte · Kalender · Mehr. Struktur
// und Aussehen kommen aus `navigation/tab-style.tsx` (Schwesterdatei).
//
// Objekte hängen an der Startseite („Ihre Objekte ›"), Auszahlungen je Objekt
// und die Statistik an „Mehr" — ein sechster Tab würde die Leiste sprengen.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabIcon as icon, tabScreenOptions } from "@/navigation/tab-style";
import type { OwnerTabParamList } from "@/navigation/types";
import Abrechnungen from "@/screens/Abrechnungen";
import Aufenthalte from "@/screens/Aufenthalte";
import Kalender from "@/screens/Kalender";
import Mehr from "@/screens/Mehr";
import Start from "@/screens/Start";
import { useT } from "@/contexts/SprachContext";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function Tabs() {
  const t = useTheme();
  const txt = useT();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, insets.bottom)}>
      <Tab.Screen name="Start" component={Start} options={{ title: txt("tab.start"), tabBarIcon: icon("home") }} />
      <Tab.Screen
        name="Abrechnungen"
        component={Abrechnungen}
        options={{ title: txt("tab.abrechnung"), tabBarIcon: icon("chart") }}
      />
      <Tab.Screen
        name="Aufenthalte"
        component={Aufenthalte}
        options={{ title: txt("tab.aufenthalte"), tabBarIcon: icon("bed") }}
      />
      <Tab.Screen name="Kalender" component={Kalender} options={{ title: txt("tab.kalender"), tabBarIcon: icon("cal") }} />
      <Tab.Screen name="Mehr" component={Mehr} options={{ title: txt("tab.mehr"), tabBarIcon: icon("list") }} />
    </Tab.Navigator>
  );
}
