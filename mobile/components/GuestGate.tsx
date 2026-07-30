// Einheitlicher Leerzustand für Gast-Bereiche, die ein Gast-Konto brauchen
// (Reisen, Wunschlisten, Profil). Kein Screen „öffnet" sich clientseitig: die
// Daten hängen serverseitig an der guest_id — ohne Session gäbe es nur 401.
//
// Aufbau wie die abgemeldeten Bereiche der Referenz-Apps: linksbündige
// Überschrift, ein erklärender Satz, eine breite dunkle Hauptaktion.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Txt } from "@/components/ui/kit";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export function GuestGate({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis: string;
  // Optionaler Inhalt unter der Anmelde-Aufforderung (z. B. die Menüliste
  // des Profils, die auch ohne Konto sichtbar bleibt).
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 22 }}>
        <Col gap={10}>
          <Txt v="display">{titel}</Txt>
          <Txt v="body" soft>
            {hinweis}
          </Txt>
        </Col>

        <Btn
          variant="dark"
          block
          onPress={() => navigation.navigate("GuestLogin", { modus: "login" })}
        >
          Einloggen oder registrieren
        </Btn>

        {children}
      </ScrollView>
    </View>
  );
}
