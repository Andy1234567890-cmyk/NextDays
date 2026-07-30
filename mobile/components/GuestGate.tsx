// Einheitlicher Leerzustand für Gast-Bereiche, die ein Gast-Konto brauchen
// (Reisen, Merkliste, Profil). Kein Screen „öffnet" sich clientseitig: die
// Daten hängen serverseitig an der guest_id — ohne Session gäbe es nur 401.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Col, Txt } from "@/components/ui/kit";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export function GuestGate({
  icon,
  titel,
  hinweis,
}: {
  icon: IconName;
  titel: string;
  hinweis: string;
}) {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <Col gap={14} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Icon n={icon} s={40} c={t.palette.faint} />
        <Txt v="h2" style={{ textAlign: "center" }}>
          {titel}
        </Txt>
        <Txt v="sm" soft style={{ textAlign: "center" }}>
          {hinweis}
        </Txt>
        <Col gap={10} style={{ alignSelf: "stretch", marginTop: 8 }}>
          <Btn
            variant="primary"
            block
            onPress={() => navigation.navigate("GuestLogin", { modus: "login" })}
          >
            Anmelden
          </Btn>
          <Btn
            variant="ghost"
            block
            onPress={() => navigation.navigate("GuestLogin", { modus: "registrieren" })}
          >
            Konto erstellen
          </Btn>
        </Col>
      </Col>
    </View>
  );
}
