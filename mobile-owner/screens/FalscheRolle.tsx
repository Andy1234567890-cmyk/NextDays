// Kein Eigentümer-Zugang. Diese App führt EIN Erlebnis; wer sich mit einem
// Verwaltungs- oder Mitarbeiter-Konto anmeldet, bekommt hier eine Erklärung
// und den Weg in die richtige App — nicht eine leere Oberfläche und nicht
// ersatzweise ein anderes Erlebnis (fail-closed, Wurzel 5).
//
// Der Zugang wird dabei GETRENNT: `logout` läuft sofort mit, damit kein
// angemeldeter Fremdzustand in einer App stehen bleibt, die ihn nicht bedienen
// kann.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Kachel, Txt } from "@/components/ui/kit";
import { LogoWortmarke } from "@/components/ui/LogoVektor";
import { useAuth } from "@/contexts/AuthContext";
import { zurAnderenApp } from "@/lib/appwechsel";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

export default function FalscheRolle() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, logout } = useAuth();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        justifyContent: "center",
        padding: t.density.pad,
        paddingTop: insets.top,
        gap: KARTE_ABSTAND,
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <LogoWortmarke hoehe={28} negativ={t.dark} />
      </View>

      <Kachel>
        <Txt v="title">Diese App ist für Eigentümer</Txt>
        <Txt v="sm" soft style={{ marginTop: 6 }}>
          Ihr Zugang{me?.email ? ` (${me.email})` : ""} gehört zur Verwaltung. Die
          Verwaltung, den Kalender und die Buchungen bedienen Sie in der App{" "}
          {t.marke.andereApp.name}.
        </Txt>
        <Btn
          onPress={() => void zurAnderenApp(t.marke.andereApp, "")}
          block
          style={{ marginTop: 14 }}
        >
          {t.marke.andereApp.name} öffnen
        </Btn>
        <Btn variant="outline" onPress={() => void logout()} block style={{ marginTop: 8 }}>
          Mit anderem Zugang anmelden
        </Btn>
      </Kachel>
    </View>
  );
}
