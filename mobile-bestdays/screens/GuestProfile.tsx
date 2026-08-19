// Gäste · Profil. Einstiegsliste des Gast-Kontos, aufgebaut wie die
// Profil-Seite der Referenz-Apps: Überschrift, Konto-Kopf bzw.
// Anmelde-Aufforderung, darunter Menüzeilen mit Icon und Chevron.
//
// Die Stammdaten selbst (/api/v1/guest-auth/me) liegen in einem eigenen
// Screen (GuestAccount) — hier steht nur, was ohne Nachladen sicher ist.
// Ohne Konto bleibt die Liste sichtbar, aber auf die kontofreien Punkte
// beschränkt: es wird nichts angeboten, das dann 401 liefert.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Avatar, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { ListRow } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { zurAnderenApp } from "@/lib/appwechsel";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, guest, logout } = useGuestAuth();

  // Der Betriebs-Zugang ist eine EIGENE App (myNextDays, ADR-0019) — von hier
  // geht es dorthin, nicht in einen eigenen Screen. Ist sie nicht installiert,
  // führt der Weg in den Store.
  const zumBetrieb = () => void zurAnderenApp(t.marke.andereApp, "login");

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  // Abgemeldet: Anmelde-Aufforderung plus die Punkte, die kein Konto brauchen.
  if (status !== "signedIn" || !guest) {
    return (
      <GuestGate
        titel="Profil"
        hinweis="Logge dich ein und beginne mit der Planung deiner nächsten Reise."
      >
        <Col style={{ marginTop: 8 }}>
          <ListRow icon="chart" label="Als Gastgeber verwalten" onPress={zumBetrieb} last />
        </Col>
      </GuestGate>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 24 }}>
        <Txt v="display">Profil</Txt>

        <Row gap={16}>
          <Avatar s={64} icon="user" />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="h2" numberOfLines={1}>
              {guest.name?.trim() || "Ohne Namen"}
            </Txt>
            <Txt v="sm" soft numberOfLines={1}>
              {guest.email}
            </Txt>
          </Col>
        </Row>

        <Col>
          <ListRow
            icon="cog"
            label="Kontoeinstellungen"
            hint="Name und Telefonnummer"
            onPress={() => navigation.navigate("GuestAccount")}
          />
          <ListRow icon="suitcase" label="Meine Reisen" onPress={() => navigation.navigate("GuestTabs", { screen: "Trips" })} />
          {/* Ohne diesen Weg findet man eine Antwort des Gastgebers nur, wenn
              man zufällig die richtige Buchung öffnet. */}
          <ListRow
            icon="chat"
            label="Nachrichten"
            hint="Verläufe mit deinen Gastgebern"
            onPress={() => navigation.navigate("GuestMessages")}
          />
          <ListRow
            icon="heart"
            label="Wunschlisten"
            onPress={() => navigation.navigate("GuestTabs", { screen: "Wishlist" })}
            last
          />
        </Col>

        <Col>
          <ListRow icon="chart" label="Als Gastgeber verwalten" hint="Eigener Zugang für Betriebe" onPress={zumBetrieb} last />
        </Col>

        <Col>
          <ListRow icon="logout" label="Abmelden" onPress={logout} danger last />
        </Col>
      </ScrollView>
    </View>
  );
}
