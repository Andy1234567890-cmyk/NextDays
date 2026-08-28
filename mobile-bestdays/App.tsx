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
import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useEffect } from "react";
import { Linking } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Fehlergrenze } from "@/components/Fehlergrenze";
import { Splash } from "@/components/Splash";
import { GuestAuthProvider, useGuestAuth } from "@/contexts/GuestAuthContext";
import { protokolliereAbsturz } from "@/lib/absturzmeldung";
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
import GuestMessages from "@/screens/GuestMessages";
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
      // Ohne Parameter die Liste, mit Buchung direkt der Verlauf. Der Pfad ist
      // so geschnitten, dass er später 1:1 als Universal Link taugt.
      GuestMessages: "nachrichten",
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
            <Stack.Screen name="GuestMessages" component={GuestMessages} />
          </>
        ) : (
          <Stack.Screen name="GuestLogin" component={GuestLogin} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Rückweg aus 3-D Secure zurück in die App.
 *
 * Führt eine Zahlung den Gast aus der App heraus (Bank-App, Safari), kommt er
 * über `mybestdays://stripe-redirect` zurück. Diese URL MUSS an das Stripe-SDK
 * gehen, sonst hängt das PaymentSheet: React Navigation würde sie nur als
 * unbekannten Deep-Link verwerfen. Von Stripe ausdrücklich verlangt
 * (docs.stripe.com, „Rückgabe-URL einrichten").
 *
 * Kein eigener Screen für den Pfad: die URL ist ein Signal an das SDK, kein
 * Ziel in der App.
 */
function useStripeRueckweg(): void {
  const { handleURLCallback } = useStripe();

  const behandle = useCallback(
    async (url: string | null) => {
      if (!url) return;
      // `handleURLCallback` rejectet (Stripe nicht initialisiert, unpassende
      // URL). Ungefangen war das eine unbehandelte Rejection GENAU im Moment
      // der Rückkehr von der Zahlung — der teuerste denkbare Zeitpunkt für
      // einen Absturz (28.08.2026).
      //
      // Das SDK entscheidet selbst, ob die URL zu ihm gehört; ein Fehlschlag
      // heißt nur, dass dieser Rückweg nicht griff. Die Buchung selbst hängt
      // nicht daran — sie steht serverseitig, und der Bildschirm zieht beim
      // nächsten Laden nach. Ein Absturz hier wäre also der Schaden, nicht
      // der geschluckte Fehler (Wurzel 5: der Hauptpfad kippt nicht).
      try {
        await handleURLCallback(url);
      } catch (e) {
        protokolliereAbsturz(e);
      }
    },
    [handleURLCallback],
  );

  useEffect(() => {
    // Kaltstart: die App wurde DURCH die Rückkehr gestartet.
    //
    // `getInitialURL()` selbst kann ebenfalls rejecten — deshalb hängt das
    // `catch` an der KETTE, nicht nur im Handler.
    void Linking.getInitialURL().then(behandle).catch(protokolliereAbsturz);
    const abo = Linking.addEventListener("url", (e: { url: string }) => {
      void behandle(e.url);
    });
    return () => abo.remove();
  }, [behandle]);
}

function StripeRueckweg({ children }: { children: React.ReactNode }) {
  useStripeRueckweg();
  return <>{children}</>;
}

export default function App() {
  // Die Fehlergrenze steht GANZ AUSSEN, nicht um `<Root />`: ein Wurf in
  // `ThemeProvider` oder `GuestAuthProvider` (beide holen beim Mount Daten)
  // waere sonst ausserhalb des Netzes und damit weiterhin ein Absturz.
  return (
    <Fehlergrenze>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider marke={marke}>
            <GuestAuthProvider>
              {/* Kein StripeProvider mit festem Schlüssel: der Publishable Key
                  kommt pro Zahlung vom Server (`lib/zahlung.ts` ruft initStripe).
                  Ein Schlüssel in der App könnte zum Intent unpassend sein. */}
              <StripeRueckweg>
                <Root />
              </StripeRueckweg>
            </GuestAuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Fehlergrenze>
  );
}
