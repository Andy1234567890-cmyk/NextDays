// NextDays Mobile — Einstiegspunkt (bare React Native). Eine App, vier
// Erlebnisse (Gast · Agentur · Owner · Mitarbeiter); das Erlebnis kommt aus dem
// Konto (experienceFor(me)), nicht aus manueller Auswahl.
// GestureHandler → SafeArea → Theme → AuthProvider → NavigationContainer.
// Der Gast-Bereich ist offen (anonym browsen); der Verwalter-/Owner-/
// Mitarbeiter-Bereich hängt an der Tenant-Auth.
import {
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GuestAuthProvider, useGuestAuth } from "@/contexts/GuestAuthContext";
import { experienceFor } from "@/lib/experience";
import { GuestTabs } from "@/navigation/GuestTabs";
import { HostTabs } from "@/navigation/HostTabs";
import { OwnerTabs } from "@/navigation/OwnerTabs";
import type { RootStackParamList } from "@/navigation/types";
import Checkin from "@/screens/Checkin";
import Checkout from "@/screens/Checkout";
import GuestAccount from "@/screens/GuestAccount";
import GuestLogin from "@/screens/GuestLogin";
import HostLogin from "@/screens/HostLogin";
import HostSignup from "@/screens/HostSignup";
import ListingDetail from "@/screens/ListingDetail";
import ReservationDetail from "@/screens/ReservationDetail";
import RoleSelect from "@/screens/RoleSelect";
import TaskDetail from "@/screens/TaskDetail";
import TripDetail from "@/screens/TripDetail";
import WishlistDetail from "@/screens/WishlistDetail";
import { ThemeProvider } from "@/theme/ThemeProvider";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-Links nextdays:// — React Navigation deckt Kalt- UND Warmstart ab
// (getInitialURL beim Kaltstart, Linking-'url'-Event im Warmstart).
// Auth-Guard über BEDINGTE Screen-Registrierung (React-Navigation-Auth-Flow):
// geschützte Screens (HostTabs/OwnerTabs/ReservationDetail/TaskDetail)
// existieren im Navigator NUR mit Session — ein Deep-Link darauf wird
// ausgeloggt ignoriert statt einen leeren geschützten Screen zu öffnen.
// Login/Signup existieren umgekehrt nur OHNE Session.
// nextdays://host/inbox/:threadId öffnet den Inbox-Tab mit vorausgewähltem
// Thread (HostInbox liest den threadId-Param).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["nextdays://"],
  config: {
    screens: {
      HostLogin: "login",
      HostSignup: "registrieren",
      GuestLogin: "gast/anmelden",
      ListingDetail: "unterkunft/:id",
      ReservationDetail: "host/reservierungen/:id",
      TripDetail: "reisen/:id",
      HostTabs: {
        screens: {
          HostInbox: "host/inbox/:threadId",
        },
      },
    },
  },
};

function Root() {
  const { status, me, logout } = useAuth();
  // Zweite, unabhängige Auth-Welt: der Portal-Gast. Sie entscheidet NICHT über
  // das Erlebnis (das kommt aus der Tenant-Rolle), sondern nur darüber, welche
  // Gast-Routen überhaupt existieren (Deep-Link-Guard wie beim Betriebskonto).
  const { status: gastStatus } = useGuestAuth();
  const gastAngemeldet = gastStatus === "signedIn";

  // Fail-closed (Wurzel 5): angemeldet, aber keine/unbekannte Rolle → das
  // Konto bekommt KEIN Erlebnis (nie Default ins Agentur-Dashboard). Die
  // Session wird beendet; der Nutzer landet im Login mit sauberem Zustand.
  const target = status === "signedIn" ? experienceFor(me) : null;
  const invalidRole = status === "signedIn" && target === null;
  useEffect(() => {
    if (invalidRole) void logout();
  }, [invalidRole, logout]);

  // Nach einem LOGIN (Übergang signedOut→signedIn) deterministisch ins
  // Rollen-Erlebnis springen — nicht auf das Prune-Verhalten des Navigators
  // verlassen. BEWUSST nur bei diesem Übergang: beim Kaltstart (loading→
  // signedIn) würde ein reset() einen initialen Deep-Link überschreiben.
  // WICHTIG: alle Hooks stehen VOR den early returns (Rules of Hooks).
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was === "signedOut" && status === "signedIn" && target && navRef.isReady()) {
      navRef.reset({
        index: 0,
        routes: [{ name: target.route, params: target.params as never }],
      });
    }
  }, [status, target, navRef]);

  // Token-Check läuft noch → Splash hält den Screen (kein Flackern). Der
  // invalidRole-Fall bleibt auf Splash, bis logout() den Status umsetzt.
  if (status === "loading" || invalidRole) return <Splash />;

  // Kaltstart mit gültiger Session → direkt ins rollenbasierte Erlebnis.
  // Ohne Session → Gast-Bereich (anonym browsen); „Verwalten" führt über
  // RoleSelect → HostLogin in den geschützten Teil.
  const initial = target ? target.route : "GuestTabs";

  const signedIn = status === "signedIn";

  return (
    <NavigationContainer ref={navRef} linking={linking} fallback={<Splash />}>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
        {/* Immer verfügbar (öffentlicher Gast-Bereich + Einstieg). */}
        <Stack.Screen name="GuestTabs" component={GuestTabs} />
        <Stack.Screen name="RoleSelect" component={RoleSelect} />
        <Stack.Screen name="ListingDetail" component={ListingDetail} />
        {/* Buchen geht auch ohne Gast-Konto (Kontaktdaten im Formular) — so
            arbeitet die öffentliche Buchungsstrecke des Backends. */}
        <Stack.Screen name="Checkout" component={Checkout} options={{ presentation: "card" }} />
        {gastAngemeldet ? (
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
        {signedIn ? (
          <>
            {/* Geschützt: nur mit Tenant-Session registriert (Auth-Guard für
                Deep-Links — ausgeloggt existieren diese Routen nicht). */}
            <Stack.Screen name="HostTabs" component={HostTabs} />
            <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
            <Stack.Screen name="ReservationDetail" component={ReservationDetail} />
            <Stack.Screen name="TaskDetail" component={TaskDetail} />
          </>
        ) : (
          <>
            {/* Nur ohne Session: Login/Registrierung. Nach dem Login flippt
                status → Navigator tauscht die Gruppen automatisch. */}
            <Stack.Screen name="HostLogin" component={HostLogin} />
            <Stack.Screen name="HostSignup" component={HostSignup} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            {/* Zwei getrennte Auth-Welten laufen parallel: Betrieb (AuthProvider)
                und Portal-Gast (GuestAuthProvider). Sie teilen sich nichts —
                weder Token noch HTTP-Client. */}
            <GuestAuthProvider>
              <Root />
            </GuestAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
