// NextDays Mobile — Einstiegspunkt (bare React Native).
// GestureHandler → SafeArea → Theme → NavigationContainer mit Root-Stack.
// Start direkt in den Gäste-Tabs (Erkunden, wie Booking/Airbnb); die
// Rollen-Auswahl ist über Profil → „Als Gastgeber" erreichbar.
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Splash } from "@/components/Splash";
import { GuestTabs } from "@/navigation/GuestTabs";
import { HostTabs } from "@/navigation/HostTabs";
import type { RootStackParamList } from "@/navigation/types";
import Checkin from "@/screens/Checkin";
import Checkout from "@/screens/Checkout";
import ListingDetail from "@/screens/ListingDetail";
import RoleSelect from "@/screens/RoleSelect";
import { ThemeProvider } from "@/theme/ThemeProvider";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="GuestTabs" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="GuestTabs" component={GuestTabs} />
              <Stack.Screen name="RoleSelect" component={RoleSelect} />
              <Stack.Screen name="HostTabs" component={HostTabs} />
              <Stack.Screen name="ListingDetail" component={ListingDetail} />
              <Stack.Screen name="Checkout" component={Checkout} options={{ presentation: "card" }} />
              <Stack.Screen name="Checkin" component={Checkin} options={{ presentation: "card" }} />
            </Stack.Navigator>
          </NavigationContainer>
          <Splash />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
