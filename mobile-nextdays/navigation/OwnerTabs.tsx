// Eigentümer-Tab-Navigator (Rolle owner). Eigenes, HERMETISCHES Erlebnis über
// /public-portal: Meine Objekte · Kalender · Auszahlungen · Anfragen. Ein Owner
// erreicht KEINE Agentur-Screens — die sind im Root-Navigator (App.tsx) unter
// HostTabs und werden hier nirgends verlinkt; das Routing landet einen owner
// ausschließlich hier (experienceFor). Getrennt, nicht nur versteckt.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { ownerFlaechenFor } from "@/lib/owner-flaechen";
import { tabIcon as icon, tabScreenOptions } from "@/navigation/tab-style";
import type { OwnerTabParamList } from "@/navigation/types";
import OwnerCalendar from "@/screens/OwnerCalendar";
import OwnerEarnings from "@/screens/OwnerEarnings";
import OwnerProperties from "@/screens/OwnerProperties";
import OwnerRequests from "@/screens/OwnerRequests";
import OwnerStatistics from "@/screens/OwnerStatistics";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function OwnerTabs() {
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  // „Auslastung" hängt am granularen Recht `pm_nonrevenue_charts`. Ohne das
  // Recht wird der Screen NICHT registriert — es gibt ihn dann nicht, statt
  // ihn nur aus der Leiste zu nehmen (dieselbe Linie wie bei den Rollen-Tabs
  // in HostTabs). Damit bleibt die Leiste bei vier oder fünf Einträgen; das
  // Fotoalbum ist deshalb bewusst KEIN Tab, sondern hängt am Kopf der
  // Objektliste (Regel „max 5 Tabs").
  const flaechen = ownerFlaechenFor(me);
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
      {flaechen.statistiken && (
        <Tab.Screen
          name="OwnerStatistics"
          component={OwnerStatistics}
          options={{ title: "Statistiken", tabBarIcon: icon("chart") }}
        />
      )}
      <Tab.Screen
        name="OwnerRequests"
        component={OwnerRequests}
        options={{ title: "Anfragen", tabBarIcon: icon("clock") }}
      />
    </Tab.Navigator>
  );
}
