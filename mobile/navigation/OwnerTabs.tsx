// Eigentümer-Tab-Navigator (Rolle owner). Eigenes, HERMETISCHES Erlebnis über
// /public-portal: Meine Objekte · Kalender · Auszahlungen · Anfragen. Ein Owner
// erreicht KEINE Agentur-Screens — die sind im Root-Navigator (App.tsx) unter
// HostTabs und werden hier nirgends verlinkt; das Routing landet einen owner
// ausschließlich hier (experienceFor). Getrennt, nicht nur versteckt.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabIcon as icon, tabScreenOptions } from "@/navigation/tab-style";
import type { OwnerTabParamList } from "@/navigation/types";
import OwnerCalendar from "@/screens/OwnerCalendar";
import OwnerEarnings from "@/screens/OwnerEarnings";
import OwnerProperties from "@/screens/OwnerProperties";
import OwnerRequests from "@/screens/OwnerRequests";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function OwnerTabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, insets.bottom)}>
      <Tab.Screen
        name="OwnerProperties"
        component={OwnerProperties}
        options={{ title: "Objekte", tabBarIcon: icon("home") }}
      />
      <Tab.Screen
        name="OwnerCalendar"
        component={OwnerCalendar}
        options={{ title: "Kalender", tabBarIcon: icon("cal") }}
      />
      <Tab.Screen
        name="OwnerEarnings"
        component={OwnerEarnings}
        options={{ title: "Auszahlungen", tabBarIcon: icon("euro") }}
      />
      <Tab.Screen
        name="OwnerRequests"
        component={OwnerRequests}
        options={{ title: "Anfragen", tabBarIcon: icon("clock") }}
      />
    </Tab.Navigator>
  );
}
