// myNextDays — Einstiegspunkt der PMS-/Channel-Manager-App (bare React Native).
// EINE Auth-Welt: das Betriebskonto (Tenant). Welches Erlebnis ein Nutzer sieht,
// kommt aus seiner Rolle (experienceFor(me)) — Agentur, Eigentümer oder
// Mitarbeiter —, nicht aus einer manuellen Auswahl. Der Marktplatz lebt seit
// ADR-0019 in einer eigenen App (myBestDays).
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
import { protokolliereAbsturz } from "@/lib/absturzmeldung";
import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getToken, onTokenChange } from "@/lib/auth";
import { experienceFor } from "@/lib/experience";
import { realtimeTokenQuelleSetzen } from "@/lib/realtime";
import { HostTabs } from "@/navigation/HostTabs";
import { OwnerTabs } from "@/navigation/OwnerTabs";
import type { RootStackParamList } from "@/navigation/types";
import HostLogin from "@/screens/HostLogin";
import HostPasswortVergessen from "@/screens/HostPasswortVergessen";
import OwnerPhotoAlbum from "@/screens/OwnerPhotoAlbum";
import OwnerPropertyDetail from "@/screens/OwnerPropertyDetail";
import PropertyCustomFields from "@/screens/PropertyCustomFields";
import PropertyGuestGuide from "@/screens/PropertyGuestGuide";
import PropertyGuestGuideText from "@/screens/PropertyGuestGuideText";
import PropertyDescription from "@/screens/PropertyDescription";
import PropertyDetail from "@/screens/PropertyDetail";
import ReservationDetail from "@/screens/ReservationDetail";
import TaskDetail from "@/screens/TaskDetail";
import { marke } from "@/theme/marke";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Genau EINE Auth-Welt bedient den Realtime-Client (ADR-0019). Auf Modulebene,
// damit sie steht, bevor der erste Screen einen Channel öffnet.
realtimeTokenQuelleSetzen({ holen: getToken, abonnieren: onTokenChange });

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-Links mynextdays:// — React Navigation deckt Kalt- UND Warmstart ab
// (getInitialURL beim Kaltstart, Linking-'url'-Event im Warmstart).
// Auth-Guard über BEDINGTE Screen-Registrierung (React-Navigation-Auth-Flow):
// geschützte Screens (HostTabs/OwnerTabs/ReservationDetail/TaskDetail) existieren
// im Navigator NUR mit Session — ein Deep-Link darauf wird ausgeloggt ignoriert
// statt einen leeren geschützten Screen zu öffnen. Login/Signup existieren
// umgekehrt nur OHNE Session. Die Pfade sind so geschnitten, dass sie später
// 1:1 als Universal Links unter https://… weiterverwendet werden können.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["mynextdays://"],
  config: {
    screens: {
      HostLogin: "login",
      HostPasswortVergessen: "passwort-vergessen",
      ReservationDetail: "reservierungen/:id",
      TaskDetail: "aufgaben/:id",
      PropertyDetail: "objekte/:id",
      PropertyDescription: "objekte/:id/beschreibung",
      PropertyCustomFields: "objekte/:id/zusatzfelder",
      PropertyGuestGuide: "objekte/:id/gaestemappe",
      PropertyGuestGuideText: "objekte/:id/gaestemappe/:feld",
      HostTabs: {
        screens: {
          Dashboard: "uebersicht",
          Calendar: "kalender",
          Reservations: "buchungen",
          Tasks: "aufgabenliste",
          // Eigenes Segment, KEIN „aufgaben/kalender": das kollidierte mit
          // `TaskDetail: "aufgaben/:id"` — der Link landete im Detail einer
          // Aufgabe namens „kalender".
          TaskCalendar: "aufgabenkalender",
          Listings: "inserate",
          HostInbox: "inbox/:threadId?",
          HostProfile: "profil",
        },
      },
      OwnerTabs: {
        screens: {
          OwnerProperties: "eigentuemer/objekte",
          OwnerEarnings: "eigentuemer/auszahlungen",
        },
      },
    },
  },
};

function Root() {
  const { status, me, logout } = useAuth();

  // Fail-closed (Wurzel 5): angemeldet, aber keine/unbekannte Rolle → das
  // Konto bekommt KEIN Erlebnis (nie Default ins Agentur-Dashboard). Die
  // Session wird beendet; der Nutzer landet im Login mit sauberem Zustand.
  const target = status === "signedIn" ? experienceFor(me) : null;
  const invalidRole = status === "signedIn" && target === null;
  useEffect(() => {
    // `void` unterdrückt nur die Lint-Warnung, es fängt nichts. Ohne den
    // Fänger wäre ein Wurf im Logout (er räumt Push und Token ab) eine
    // unbehandelte Rejection — und die beendet im Release-Build den Prozess.
    // Die App bliebe hier zudem auf dem Splash stehen, weil `status` dann nie
    // umgesetzt wird.
    if (invalidRole) logout().catch(protokolliereAbsturz);
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
  // Ohne Session → Login.
  const initial = target ? target.route : "HostLogin";
  const signedIn = status === "signedIn";

  return (
    <NavigationContainer ref={navRef} linking={linking} fallback={<Splash />}>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <>
            {/* Geschützt: nur mit Tenant-Session registriert (Auth-Guard für
                Deep-Links — ausgeloggt existieren diese Routen nicht). */}
            <Stack.Screen name="HostTabs" component={HostTabs} />
            <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
            <Stack.Screen name="ReservationDetail" component={ReservationDetail} />
            <Stack.Screen name="TaskDetail" component={TaskDetail} />
            <Stack.Screen name="PropertyDetail" component={PropertyDetail} />
            <Stack.Screen name="PropertyDescription" component={PropertyDescription} />
            <Stack.Screen name="PropertyCustomFields" component={PropertyCustomFields} />
            <Stack.Screen name="PropertyGuestGuide" component={PropertyGuestGuide} />
            <Stack.Screen name="PropertyGuestGuideText" component={PropertyGuestGuideText} />
            {/* Eigentümer-Zweig: die beiden lesenden Portal-Screens existieren
                NUR im Eigentümer-Erlebnis. Getrennt statt versteckt — dieselbe
                Linie, mit der OwnerTabs keine Agentur-Screens verlinkt. Sie
                tragen bewusst KEINEN Deep-Link: erreichbar sind sie über die
                Objektliste, nicht über eine URL, die auch in der Agentur-Welt
                gälte. */}
            {target?.route === "OwnerTabs" && (
              <>
                <Stack.Screen name="OwnerPropertyDetail" component={OwnerPropertyDetail} />
                <Stack.Screen name="OwnerPhotoAlbum" component={OwnerPhotoAlbum} />
              </>
            )}
          </>
        ) : (
          <>
            {/* Nur ohne Session: Login/Registrierung. Nach dem Login flippt
                status → Navigator tauscht die Gruppen automatisch. */}
            <Stack.Screen name="HostLogin" component={HostLogin} />
            <Stack.Screen
              name="HostPasswortVergessen"
              component={HostPasswortVergessen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // Die Fehlergrenze steht GANZ AUSSEN, nicht um `<Root />`: ein Wurf in
  // `ThemeProvider` oder `AuthProvider` (beide holen beim Mount Daten) waere
  // sonst ausserhalb des Netzes und damit weiterhin ein Absturz.
  return (
    <Fehlergrenze>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider marke={marke}>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Fehlergrenze>
  );
}
