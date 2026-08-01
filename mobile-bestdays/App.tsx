// myBestDays — Einstiegspunkt der Marktplatz-App (bare React Native).
// EINE Auth-Welt: der Portal-Gast (portal_guests). Der Betriebsbereich lebt
// seit ADR-0019 in einer eigenen App (myNextDays) und wird nur noch per
// App-Wechsel erreicht (lib/appwechsel.ts).
// GestureHandler → SafeArea → Theme → GuestAuthProvider → NavigationContainer.
// Der Gast-Bereich ist offen: browsen und buchen geht auch ohne Konto.
import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Splash } from "@/components/Splash";
import { GuestAuthProvider, useGuestAuth } from "@/contexts/GuestAuthContext";
import { getGuestToken, onGuestTokenChange } from "@/lib/guestAuth";
import { realtimeTokenQuelleSetzen } from "@/lib/realtime";
import { GuestTabs } from "@/navigation/GuestTabs";
import type { RootStackParamList } from "@/navigation/types";
import Checkin from "@/screens/Checkin";
import Checkout from "@/screens/Checkout";
import GuestAccount from "@/screens/GuestAccount";
import GuestLogin from "@/screens/GuestLogin";
import ListingDetail from "@/screens/ListingDetail";
import TripDetail from "@/screens/TripDetail";
import WishlistDetail from "@/screens/WishlistDetail";
import { marke } from "@/theme/marke";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Genau EINE Auth-Welt bedient den Realtime-Client (ADR-0019). Auf Modulebene,
// damit sie steht, bevor der erste Screen einen Channel öffnet.
realtimeTokenQuelleSetzen({ holen: getGuestToken, abonnieren: onGuestTokenChange });

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-Links mybestdays:// — React Navigation deckt Kalt- UND Warmstart ab
// (getInitialURL beim Kaltstart, Linking-'url'-Event im Warmstart).
// Auth-Guard über BEDINGTE Screen-Registrierung (React-Navigation-Auth-Flow):
// Screens, die eine Gast-Session brauchen (Checkin/TripDetail/WishlistDetail/
// GuestAccount), existieren im Navigator NUR mit Session — ein Deep-Link darauf
// wird ausgeloggt ignoriert statt einen leeren geschützten Screen zu öffnen.
// Die Pfade sind so geschnitten, dass sie später 1:1 als Universal Links unter
// https://… weiterverwendet werden können.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["mybestdays://"],
  config: {
    screens: {
      GuestLogin: "anmelden",
      GuestAccount: "konto",
      ListingDetail: "unterkunft/:id",
      TripDetail: "reisen/:id",
      WishlistDetail: "merkliste/:id",
      Checkin: "checkin/:reservationId",
      GuestTabs: {
        screens: {
          Discover: "suche",
          Trips: "reisen",
          Wishlist: "merklisten",
        },
      },
    },
  },
};

function Root() {
  const { status } = useGuestAuth();

  // Token-Check läuft noch → Splash hält den Screen (kein Flackern).
  if (status === "loading") return <Splash />;

  const angemeldet = status === "signedIn";

  return (
    <NavigationContainer linking={linking} fallback={<Splash />}>
      <Stack.Navigator initialRouteName="GuestTabs" screenOptions={{ headerShown: false }}>
        {/* Immer verfügbar: der öffentliche Marktplatz. */}
        <Stack.Screen name="GuestTabs" component={GuestTabs} />
        <Stack.Screen name="ListingDetail" component={ListingDetail} />
        {/* Buchen geht auch ohne Gast-Konto (Kontaktdaten im Formular) — so
            arbeitet die öffentliche Buchungsstrecke des Backends. */}
        <Stack.Screen name="Checkout" component={Checkout} options={{ presentation: "card" }} />
        {angemeldet ? (
          <>
            {/* Nur mit Gast-Session: eigene Buchungen, Gastmappe, Merklisten.
                Ohne Session existieren diese Routen nicht (Deep-Link-Guard). */}
            <Stack.Screen name="Checkin" component={Checkin} options={{ presentation: "card" }} />
            <Stack.Screen name="TripDetail" component={TripDetail} />
            <Stack.Screen name="WishlistDetail" component={WishlistDetail} />
            <Stack.Screen name="GuestAccount" component={GuestAccount} />
          </>
        ) : (
          <Stack.Screen name="GuestLogin" component={GuestLogin} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider marke={marke}>
          <GuestAuthProvider>
            <Root />
          </GuestAuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
