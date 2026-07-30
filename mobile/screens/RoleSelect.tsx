// Start-/Rollen-Auswahl: NextDays-Mockup hat Gäste- und Gastgeber-App. Hier
// wählt man den Bereich (im echten Login käme die Rolle aus dem Konto).
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { experienceFor } from "@/lib/experience";
// (fail-closed: experienceFor kann null liefern → dann Logout + Login)
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function RoleSelect() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, me, logout } = useAuth();

  // „Verwalten & Arbeiten": angemeldet → direkt ins rollenbasierte Erlebnis
  // (experienceFor, zentrale Stelle); sonst zuerst der Login (dieselbe Auth wie
  // das Web-Dashboard).
  const goHost = async () => {
    if (status !== "signedIn") {
      navigation.navigate("HostLogin");
      return;
    }
    // Rollenbasiertes Erlebnis (zentrale Ableitung in experienceFor).
    const target = experienceFor(me);
    if (!target) {
      // Fail-closed (Wurzel 5): Konto ohne gültige Rolle → Session beenden,
      // zurück zum Login — NIE Default ins Agentur-Dashboard.
      await logout();
      navigation.navigate("HostLogin");
      return;
    }
    // Ziel + verschachtelte Tab-Auswahl kommen zentral aus experienceFor —
    // kein hartkodierter screen-Name hier (überlebt Tab-Umbenennungen).
    const nav = navigation.navigate as (route: string, params?: object) => void;
    nav(target.route, target.params);
  };
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
      <Col gap={12}>
        <Image
          source={require("@/assets/img/Logo_transparent.png")}
          style={{ height: 44, width: 160, resizeMode: "contain", alignSelf: "flex-start" }}
        />
        <Txt v="display">
          Buchen, verwalten,{"\n"}ankommen.
        </Txt>
        <Txt v="body" soft>
          Wähle deinen Bereich. Im echten Login bestimmt dies deine Konto-Rolle.
        </Txt>
      </Col>

      <Col gap={12}>
        <Btn variant="dark" block onPress={() => navigation.navigate("GuestTabs", { screen: "Home" })}>
          Als Gast entdecken
        </Btn>
        <Btn variant="outline" block onPress={goHost}>
          Als Gastgeber verwalten
        </Btn>
      </Col>
    </View>
  );
}
