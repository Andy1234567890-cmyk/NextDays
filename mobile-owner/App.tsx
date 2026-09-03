// myNextDays Eigentümer — Einstiegspunkt der Eigentümer-App (bare React
// Native). EINE Auth-Welt (Tenant-Konto) und EIN Erlebnis: der Eigentümer.
// Verwaltung und Mitarbeiter bedienen die Schwester-App `mobile-nextdays`, der
// Gast den Marktplatz `mobile-bestdays` (ADR-0019/ADR-0022).
// GestureHandler → SafeArea → Theme → AuthProvider → NavigationContainer.
import {
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Fehlergrenze } from "@/components/Fehlergrenze";
import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getToken, onTokenChange } from "@/lib/auth";
import { realtimeTokenQuelleSetzen } from "@/lib/realtime";
import { Tabs } from "@/navigation/Tabs";
import type { RootStackParamList } from "@/navigation/types";
import Abrechnungen from "@/screens/Abrechnungen";
import Anmelden from "@/screens/Anmelden";
import FalscheRolle from "@/screens/FalscheRolle";
import Fotoalbum from "@/screens/Fotoalbum";
import ObjektDetail from "@/screens/ObjektDetail";
import Sperrantrag from "@/screens/Sperrantrag";
import Zaehlerstand from "@/screens/Zaehlerstand";
import { marke } from "@/theme/marke";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Genau EINE Realtime-Tokenquelle (ADR-0019) — auf Modulebene, damit sie steht,
// bevor der erste Screen einen Channel öffnet. Ein zweiter Aufruf wirft; einen
// Gast-Token-Pfad gibt es hier bewusst nicht.
realtimeTokenQuelleSetzen({ holen: getToken, abonnieren: onTokenChange });

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-Links mynextdaysowner:// — eigenes Scheme, NICHT `mynextdays://`: zwei
// Apps mit demselben Scheme sind auf Android ein Auswahldialog und auf iOS
// undefiniert (wer zuerst installiert war, gewinnt).
//
// Auth-Guard über BEDINGTE Screen-Registrierung (React-Navigation-Auth-Flow):
// geschützte Routen existieren im Navigator NUR mit Session — ein Deep-Link
// darauf wird ausgeloggt ignoriert, statt einen leeren geschützten Screen zu
// öffnen. `Anmelden` existiert umgekehrt nur OHNE Session.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["mynextdaysowner://"],
  config: {
    screens: {
      Anmelden: "anmelden",
      ObjektDetail: "objekte/:id",
      Zaehlerstand: "objekte/:propertyId/zaehler",
      Fotoalbum: "fotoalbum",
      Abrechnungen: "abrechnungen",
      SperrAntrag: "eigennutzung",
      Tabs: {
        screens: {
          Ueberblick: "ueberblick",
          Objekte: "objekte",
          Kalender: "kalender",
          Auszahlungen: "auszahlungen",
          Mehr: "mehr",
        },
      },
    },
  },
};

function Root() {
  const { status, me } = useAuth();

  // Fail-closed (Wurzel 5): Diese App bedient AUSSCHLIESSLICH die Rolle
  // `owner`. Jede andere Rolle bekommt KEIN Erlebnis — aber auch keinen
  // stillen Logout: sie sieht eine Erklärung und den Weg in die richtige App
  // (screens/FalscheRolle.tsx). Ein sofortiger Rauswurf im Login-Screen wäre
  // von einem falschen Passwort nicht zu unterscheiden.
  const angemeldet = status === "signedIn";
  const istEigentuemer = angemeldet && me?.role === "owner";

  // Nach dem LOGIN deterministisch in die Tabs springen — nicht auf das
  // Prune-Verhalten des Navigators verlassen. BEWUSST nur beim Übergang
  // signedOut→signedIn: beim Kaltstart (loading→signedIn) würde ein reset()
  // einen initialen Deep-Link überschreiben.
  // WICHTIG: alle Hooks stehen VOR den early returns (Rules of Hooks).
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const vorherStatus = useRef(status);
  useEffect(() => {
    const war = vorherStatus.current;
    vorherStatus.current = status;
    if (war === "signedOut" && istEigentuemer && navRef.isReady()) {
      navRef.reset({ index: 0, routes: [{ name: "Tabs" }] });
    }
  }, [status, istEigentuemer, navRef]);

  // Token-Check läuft noch → Splash hält den Screen (kein Flackern).
  if (status === "loading") return <Splash />;

  const initial: keyof RootStackParamList = istEigentuemer
    ? "Tabs"
    : angemeldet
      ? "FalscheRolle"
      : "Anmelden";

  return (
    <NavigationContainer ref={navRef} linking={linking} fallback={<Splash />}>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
        {istEigentuemer ? (
          <>
            {/* Geschützt: nur mit Eigentümer-Session registriert. */}
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen
              name="ObjektDetail"
              component={ObjektDetail}
              options={{ headerShown: true, title: "" }}
            />
            <Stack.Screen
              name="Zaehlerstand"
              component={Zaehlerstand}
              options={{ headerShown: true, title: "Zählerstände" }}
            />
            <Stack.Screen
              name="Fotoalbum"
              component={Fotoalbum}
              options={{ headerShown: true, title: "Fotoalbum" }}
            />
            <Stack.Screen
              name="Abrechnungen"
              component={Abrechnungen}
              options={{ headerShown: true, title: "Abrechnungen" }}
            />
            <Stack.Screen
              name="SperrAntrag"
              component={Sperrantrag}
              options={{ headerShown: true, title: "Eigennutzung" }}
            />
          </>
        ) : angemeldet ? (
          // Angemeldet, aber keine Eigentümer-Rolle. Nur DIESE Route — die
          // geschützten Screens existieren hier nicht, auch nicht per
          // Deep-Link.
          <Stack.Screen name="FalscheRolle" component={FalscheRolle} />
        ) : (
          <Stack.Screen name="Anmelden" component={Anmelden} />
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
          {/* Fängt Render-Abstürze ab: im Release eine ruhige Meldung, KEIN
              Stacktrace (components/Fehlergrenze.tsx). */}
          <Fehlergrenze>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </Fehlergrenze>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
