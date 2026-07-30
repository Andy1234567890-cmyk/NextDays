// Gäste-Tab-Navigator: Erkunden · Wunschlisten · Reisen · Suche · Profil.
// Aufbau und Beschriftung folgen dem Airbnb-Muster; „Suche" bleibt eine eigene
// Route, weil die Startseite ihre Ergebnisliste dorthin schickt.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabIcon, tabScreenOptions } from "@/navigation/tab-style";
import type { GuestTabParamList } from "@/navigation/types";
import GuestDiscover from "@/screens/GuestDiscover";
import GuestHome from "@/screens/GuestHome";
import GuestProfile from "@/screens/GuestProfile";
import GuestTrips from "@/screens/GuestTrips";
import GuestWishlist from "@/screens/GuestWishlist";
import { useTheme } from "@/theme/ThemeProvider";

const Tab = createBottomTabNavigator<GuestTabParamList>();

export function GuestTabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(t, insets.bottom)}>
      <Tab.Screen name="Home" component={GuestHome} options={{ title: "Erkunden", tabBarIcon: tabIcon("search") }} />
      <Tab.Screen
        name="Wishlist"
        component={GuestWishlist}
        options={{ title: "Wunschlisten", tabBarIcon: tabIcon("heart") }}
      />
      <Tab.Screen name="Trips" component={GuestTrips} options={{ title: "Reisen", tabBarIcon: tabIcon("suitcase") }} />
      <Tab.Screen
        name="Discover"
        component={GuestDiscover}
        options={{ title: "Suche", tabBarIcon: tabIcon("compass") }}
      />
      <Tab.Screen
        name="GuestProfile"
        component={GuestProfile}
        options={{ title: "Profil", tabBarIcon: tabIcon("user") }}
      />
    </Tab.Navigator>
  );
}
