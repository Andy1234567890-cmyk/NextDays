// Die Tab-Leiste — fünf Einträge, das Maximum (mehr wird auf einem Telefon zur
// Symbolreihe). Struktur und Aussehen kommen aus `navigation/tab-style.tsx`
// (Schwesterdatei, für alle Apps gleich).
//
// „Auslastung"/Statistik ist KEIN eigener Tab: die Kennzahl steht im Überblick,
// und ein sechster Eintrag würde die Leiste sprengen. Fotoalbum, Abrechnungen
// und Sperrantrag hängen an „Mehr" bzw. an ihren Listen.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabIcon as icon, tabScreenOptions } from "@/navigation/tab-style";
import type { OwnerTabParamList } from "@/navigation/types";
import Auszahlungen from "@/screens/Auszahlungen";
import Kalender from "@/screens/Kalender";
import Mehr from "@/screens/Mehr";
import Objekte from "@/screens/Objekte";
import Ueberblick from "@/screens/Ueberblick";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function Tabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, insets.bottom)}>
      <Tab.Screen
        name="Ueberblick"
        component={Ueberblick}
        options={{ title: "Überblick", tabBarIcon: icon("chart") }}
      />
      <Tab.Screen
        name="Objekte"
        component={Objekte}
        options={{ title: "Objekte", tabBarIcon: icon("home") }}
      />
      <Tab.Screen
        name="Kalender"
        component={Kalender}
        options={{ title: "Kalender", tabBarIcon: icon("cal") }}
      />
      <Tab.Screen
        name="Auszahlungen"
        component={Auszahlungen}
        options={{ title: "Auszahlungen", tabBarIcon: icon("card") }}
      />
      <Tab.Screen
        name="Mehr"
        component={Mehr}
        options={{ title: "Mehr", tabBarIcon: icon("more") }}
      />
    </Tab.Navigator>
  );
}
