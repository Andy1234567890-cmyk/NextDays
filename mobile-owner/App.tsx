// myNextDays Eigentümer — Einstiegspunkt der Eigentümer-App (bare React
// Native). EINE Auth-Welt (Tenant-Konto) und EIN Erlebnis: der Eigentümer.
// Verwaltung und Mitarbeiter bedienen die Schwester-App `mobile-nextdays`, der
// Gast den Marktplatz `mobile-bestdays` (ADR-0019/ADR-0022).
// GestureHandler → SafeArea → Theme → AuthProvider → NavigationContainer.
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Fehlergrenze } from "@/components/Fehlergrenze";
import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SprachProvider } from "@/contexts/SprachContext";
import { getToken, onTokenChange } from "@/lib/auth";
import { realtimeTokenQuelleSetzen } from "@/lib/realtime";
import { Tabs } from "@/navigation/Tabs";
import type { RootStackParamList } from "@/navigation/types";
import AbrechnungDetail from "@/screens/AbrechnungDetail";
import AufenthaltBestaetigt from "@/screens/AufenthaltBestaetigt";
import AufenthaltBuchen from "@/screens/AufenthaltBuchen";
import Aufgaben from "@/screens/Aufgaben";
import Anmelden from "@/screens/Anmelden";
import Chat from "@/screens/Chat";
import ChatGeraete from "@/screens/ChatGeraete";
import Nachrichten from "@/screens/Nachrichten";
import Auszahlungen from "@/screens/Auszahlungen";
import FalscheRolle from "@/screens/FalscheRolle";
import Fotoalbum from "@/screens/Fotoalbum";
import Objekte from "@/screens/Objekte";
import ObjektDetail from "@/screens/ObjektDetail";
import Ueberblick from "@/screens/Ueberblick";
import Zaehlerstand from "@/screens/Zaehlerstand";
import { marke } from "@/theme/marke";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

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
      Objekte: "objekte",
      ObjektDetail: "objekte/:id",
      Zaehlerstand: "objekte/:propertyId/zaehler",
      Fotoalbum: "fotoalbum",
      AbrechnungDetail: "abrechnungen/:id",
      Auszahlungen: "auszahlungen",
      Statistik: "statistik",
      SperrAntrag: "eigennutzung",
      Aufgaben: "aufgaben",
      Tabs: {
        screens: {
          Start: "start",
          Abrechnungen: "abrechnungen",
          Aufenthalte: "aufenthalte",
          Kalender: "kalender",
          Mehr: "mehr",
        },
      },
    },
  },
};

function Root() {
  const { status, me } = useAuth();
  // Hält den Splash, bis SEINE Bewegung durch ist — unabhängig davon, wie
  // schnell der Auth-Status steht. WICHTIG: wie alle Hooks vor den frühen
  // Abbrüchen (Rules of Hooks).
  const [splashFertig, setSplashFertig] = useState(false);

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
  const t = useTheme();
  const vorherStatus = useRef(status);
  useEffect(() => {
    const war = vorherStatus.current;
    vorherStatus.current = status;
    if (war === "signedOut" && istEigentuemer && navRef.isReady()) {
      navRef.reset({ index: 0, routes: [{ name: "Tabs" }] });
    }
  }, [status, istEigentuemer, navRef]);

  const initial: keyof RootStackParamList = istEigentuemer
    ? "Tabs"
    : angemeldet
      ? "FalscheRolle"
      : "Anmelden";

  // React Navigation färbt Kopfzeilen und Screen-Grund aus SEINEM EIGENEN
  // Theme, nicht aus unserer Palette. Ohne dieses Prop galt `DefaultTheme` —
  // also hell, immer. Im Dunkelmodus bekamen damit zwölf Stack-Routen eine
  // WEISSE Kopfzeile über `bg: #141210`, und die beiden Screens ohne eigenen
  // Grund (`Nachrichten`, `ChatGeraete`) fielen ganz auf `#F2F2F2` — dort
  // stand die Fehlermeldung mit 1,01:1, also unsichtbar (gemessen 15.09.2026).
  //
  // Es sind zwei Farbsysteme nebeneinander, und dieses hier war nie
  // angeschlossen. Die Brücke gehört an die EINE Stelle, an der der Container
  // steht — nicht in jeden Screen, der sonst seinen Grund selbst setzen müsste.
  const navThema = {
    ...(t.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.dark ? DarkTheme : DefaultTheme).colors,
      background: t.palette.bg,
      card: t.palette.surface,
      text: t.palette.ink,
      border: t.palette.line,
      primary: t.palette.accentText,
      notification: t.palette.accent,
    },
  };

  // Token-Check läuft noch → nur der Splash steht.
  const bereit = status !== "loading";

  // Der Splash liegt als Overlay ÜBER der Navigation und wird NICHT vom
  // Auth-Status ausgehängt, sondern von seiner eigenen Meldung (`onFertig`).
  // Erst beides zusammen ergibt den gewollten Ablauf: das Logo fliegt ein,
  // steht, blendet aus — und darunter liegt schon der fertige Screen.
  return (
    <View style={{ flex: 1 }}>
      {bereit && (
        <NavigationContainer
          ref={navRef}
          linking={linking}
          fallback={<Splash />}
          theme={navThema}
        >
          <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, headerBackButtonDisplayMode: "minimal" }}>
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
                  name="Objekte"
                  component={Objekte}
                  options={{ headerShown: true, title: "Meine Objekte" }}
                />
                <Stack.Screen
                  name="AbrechnungDetail"
                  component={AbrechnungDetail}
                  options={({ route }) => ({ headerShown: true, title: route.params.titel })}
                />
                <Stack.Screen
                  name="Auszahlungen"
                  component={Auszahlungen}
                  options={{ headerShown: true, title: "Auszahlungen je Objekt" }}
                />
                <Stack.Screen
                  name="Statistik"
                  component={Ueberblick}
                  options={{ headerShown: true, title: "Auslastung & Kanäle" }}
                />
                <Stack.Screen
                  name="Aufgaben"
                  component={Aufgaben}
                  options={{ headerShown: true, title: "Meine Aufgaben" }}
                />
                <Stack.Screen
                  name="Nachrichten"
                  component={Nachrichten}
                  options={{ headerShown: true, title: "Nachrichten" }}
                />
                <Stack.Screen
                  name="Chat"
                  component={Chat}
                  options={{ headerShown: true, title: "Nachrichten" }}
                />
                <Stack.Screen
                  name="ChatGeraete"
                  component={ChatGeraete}
                  options={{ headerShown: true, title: "Meine Geräte" }}
                />
                <Stack.Screen
                  name="SperrAntrag"
                  component={AufenthaltBuchen}
                  options={{ headerShown: true, title: "Aufenthalt buchen" }}
                />
                <Stack.Screen
                  name="AufenthaltBestaetigt"
                  component={AufenthaltBestaetigt}
                  options={{ headerShown: false, gestureEnabled: false }}
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
      )}
      {!splashFertig && <Splash onFertig={() => setSplashFertig(true)} />}
    </View>
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
              {/* Die Sprache hängt am Profil (`preferred_language`), also
                  INNERHALB von AuthProvider. */}
              <SprachProvider>
                <Root />
              </SprachProvider>
            </AuthProvider>
          </Fehlergrenze>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
