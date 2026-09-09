// Kein Eigentümer-Erlebnis mehr in dieser App (ADR-0022): Objekte, Kalender,
// Auszahlungen, Abrechnungen und Anfragen des Eigentümers liegen seit dem
// Ausbau in der eigenen App „myNextDays Eigentümer" (mobile-owner). Wer sich
// hier mit einem Konto der Rolle `owner` anmeldet, bekommt die Erklärung und
// den Weg dorthin — nicht eine leere Oberfläche und nicht ersatzweise das
// Agentur-Erlebnis (fail-closed, Wurzel 5).
//
// Das GEGENSTÜCK ist mobile-owner/screens/FalscheRolle.tsx: dort landet ein
// Verwaltungs-Konto, das die Eigentümer-App öffnet. Beide Richtungen sind
// bewusst gebaut, damit keine der Apps einen Fremdzustand stumm hält.
//
// Die Zieladresse steht hier und NICHT in `theme/marke.ts`: `marke.andereApp`
// zeigt auf myBestDays (die Marktplatz-App) und ist über `theme/tokens.ts`
// byte-identisch mit den Schwester-Apps CI-gehalten — ein zweites Feld dort
// würde den Typ in allen drei Apps ändern. Die Eigentümer-App ist zudem keine
// eigene Marke, sondern dieselbe (ADR-0022), also kein Markenwert.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { protokolliereAbsturz } from "@/lib/absturzmeldung";
import { zurAnderenApp } from "@/lib/appwechsel";
import { useTheme } from "@/theme/ThemeProvider";

// Die Eigentümer-App (ADR-0022). Store-IDs stehen noch nicht fest; bis dahin
// führt der Rückfall auf die Suchseite statt auf einen erfundenen Link
// (Wurzel 4) — dieselbe Linie wie in `theme/marke.ts`.
const EIGENTUEMER_APP = {
  name: "myNextDays Eigentümer",
  scheme: "mynextdaysowner",
  appStoreUrl: "https://apps.apple.com/search?term=myNextDays%20Eigent%C3%BCmer",
  playStoreUrl: "https://play.google.com/store/search?q=myNextDays%20Eigent%C3%BCmer&c=apps",
};

export default function OwnerAppHinweis() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, logout } = useAuth();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        justifyContent: "center",
        padding: 20,
        paddingTop: insets.top,
      }}
    >
      <Card style={{ padding: 20 }}>
        <Txt v="h2">Für Eigentümer gibt es eine eigene App</Txt>
        <Txt soft style={{ marginTop: 8 }}>
          Ihr Zugang{me?.email ? ` (${me.email})` : ""} ist ein
          Eigentümer-Zugang. Objekte, Kalender, Auszahlungen und Anfragen
          bedienen Sie in der App {EIGENTUEMER_APP.name} — mit denselben
          Zugangsdaten.
        </Txt>
        <Btn
          block
          style={{ marginTop: 16 }}
          onPress={() => {
            // Nicht installiert → Store. `zurAnderenApp` entscheidet das
            // selbst; hier bleibt nur der Fänger, damit ein Wurf beim Öffnen
            // keine unbehandelte Rejection wird (die beendet im Release den
            // Prozess).
            zurAnderenApp(EIGENTUEMER_APP, "").catch(protokolliereAbsturz);
          }}
        >
          {EIGENTUEMER_APP.name} öffnen
        </Btn>
        <Btn
          variant="outline"
          block
          style={{ marginTop: 8 }}
          onPress={() => logout().catch(protokolliereAbsturz)}
        >
          Mit anderem Zugang anmelden
        </Btn>
      </Card>
    </View>
  );
}
