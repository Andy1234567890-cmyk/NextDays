// Eigentümer-Tab-Navigator (Rolle owner). Eigenes, HERMETISCHES Erlebnis über
// /public-portal: Meine Objekte · Kalender · Auszahlungen · Anfragen. Ein Owner
// erreicht KEINE Agentur-Screens — die sind im Root-Navigator (App.tsx) unter
// HostTabs und werden hier nirgends verlinkt; das Routing landet einen owner
// ausschließlich hier (experienceFor). Getrennt, nicht nur versteckt.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
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
  const icon = (name: IconName) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <Icon n={name} s={23} sw={focused ? 2.1 : 1.7} c={color} />
    );
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.palette.accent,
        tabBarInactiveTintColor: t.palette.faint,
        tabBarStyle: {
          backgroundColor: t.palette.surface,
          borderTopColor: t.palette.line,
          // Inhaltshöhe + untere Safe-Area (Home-Indicator), sonst kleben die
          // Labels am Rand und der Indicator überlappt sie.
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: t.fonts.semibold },
      }}
    >
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
        options={{ title: "Auszahlungen", tabBarIcon: icon("card") }}
      />
      <Tab.Screen
        name="OwnerRequests"
        component={OwnerRequests}
        options={{ title: "Anfragen", tabBarIcon: icon("clock") }}
      />
    </Tab.Navigator>
  );
}
