// Gäste-Tab-Navigator: Entdecken · Merkliste · Reisen · Inbox · Profil.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { Icon, type IconName } from "@/components/ui/Icon";
import GuestDiscover from "@/screens/GuestDiscover";
import GuestHome from "@/screens/GuestHome";
import GuestProfile from "@/screens/GuestProfile";
import GuestTrips from "@/screens/GuestTrips";
import GuestWishlist from "@/screens/GuestWishlist";
import type { GuestTabParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<GuestTabParamList>();

export function GuestTabs() {
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
      <Tab.Screen name="Home" component={GuestHome} options={{ title: "Erkunden", tabBarIcon: icon("home") }} />
      <Tab.Screen name="Discover" component={GuestDiscover} options={{ title: "Suche", tabBarIcon: icon("search") }} />
      <Tab.Screen name="Wishlist" component={GuestWishlist} options={{ title: "Merkliste", tabBarIcon: icon("heart") }} />
      <Tab.Screen name="Trips" component={GuestTrips} options={{ title: "Reisen", tabBarIcon: icon("key") }} />
      <Tab.Screen name="GuestProfile" component={GuestProfile} options={{ title: "Profil", tabBarIcon: icon("user") }} />
    </Tab.Navigator>
  );
}
