// Gastgeber-Tab-Navigator: Übersicht · Kalender · Inbox · Inserate · Profil.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { Icon, type IconName } from "@/components/ui/Icon";
import HostCalendar from "@/screens/HostCalendar";
import HostDashboard from "@/screens/HostDashboard";
import HostInbox from "@/screens/HostInbox";
import HostListings from "@/screens/HostListings";
import HostProfile from "@/screens/HostProfile";
import type { HostTabParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<HostTabParamList>();

export function HostTabs() {
  const t = useTheme();
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
        tabBarStyle: { backgroundColor: t.palette.surface, borderTopColor: t.palette.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: t.fonts.semibold },
      }}
    >
      <Tab.Screen name="Dashboard" component={HostDashboard} options={{ title: "Übersicht", tabBarIcon: icon("chart") }} />
      <Tab.Screen name="Calendar" component={HostCalendar} options={{ title: "Kalender", tabBarIcon: icon("cal") }} />
      <Tab.Screen name="HostInbox" component={HostInbox} options={{ title: "Inbox", tabBarIcon: icon("chat") }} />
      <Tab.Screen name="Listings" component={HostListings} options={{ title: "Inserate", tabBarIcon: icon("grid") }} />
      <Tab.Screen name="HostProfile" component={HostProfile} options={{ title: "Profil", tabBarIcon: icon("user") }} />
    </Tab.Navigator>
  );
}
