// Start-/Rollen-Auswahl: NextDays-Mockup hat Gäste- und Gastgeber-App. Hier
// wählt man den Bereich (im echten Login käme die Rolle aus dem Konto).
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Txt } from "@/components/ui/kit";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function RoleSelect() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 28,
      }}
    >
      <Col gap={10}>
        <Txt v="eyebrow" accent>
          NextDays
        </Txt>
        <Txt v="display">
          Buchen, verwalten,{"\n"}ankommen.
        </Txt>
        <Txt v="body" soft>
          Wähle deinen Bereich. Im echten Login bestimmt dies deine Konto-Rolle.
        </Txt>
      </Col>

      <Col gap={12}>
        <Btn variant="primary" block icon="home" iconR="fwd" onPress={() => navigation.navigate("GuestTabs", { screen: "Discover" })}>
          Als Gast entdecken
        </Btn>
        <Btn variant="dark" block icon="chart" iconR="fwd" onPress={() => navigation.navigate("HostTabs", { screen: "Dashboard" })}>
          Als Gastgeber verwalten
        </Btn>
      </Col>
    </View>
  );
}
