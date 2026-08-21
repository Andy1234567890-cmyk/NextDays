// „Passwort vergessen": Reset-Link anfordern. Öffentlich, ohne Session.
//
// UNVERHANDELBAR — die Oberfläche darf NICHT verraten, ob es zu einer Adresse
// ein Konto gibt (User-Enumeration). Konkret heißt das hier:
//   - Es gibt genau EINEN Ausgang: die neutrale Bestätigung. Kein Fehlerpfad,
//     kein „unbekannte Adresse", kein abweichender Text. Deshalb wird das
//     Result von `call` bewusst NICHT ausgewertet — ein sichtbarer Fehler wäre
//     bereits das Signal, das der Endpunkt vermeidet.
//   - Auch die WARTEZEIT darf nicht unterscheiden: eine existierende Adresse
//     kostet den Server einen Mailversand, eine unbekannte nicht. Ohne
//     Gegenmaßnahme wäre der Unterschied messbar. Deshalb läuft der Aufruf
//     gegen eine feste Mindestdauer.
// Das Backend (`/auth/passwort-vergessen`) hält dieselbe Regel ein und
// antwortet immer neutral; die Oberfläche darf sie nicht unterlaufen.
//
// Der Reset selbst wird im BROWSER abgeschlossen, nicht hier: die Mail enthält
// den Web-Link auf `/passwort-neu`. Ein zweiter Weg zum Setzen desselben
// Passworts in der App wäre ein zweiter Pfad in dieselbe Tabelle, der stiller
// veraltet als der gepflegte (dieselbe Begründung wie bei der Registrierung
// in HostLogin).
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Txt } from "@/components/ui/kit";
import { call } from "@/lib/api";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

/** Feste Mindestdauer des Vorgangs (Timing-Angleich, s. o.). Großzügig genug,
 *  dass Mailversand vs. kein Versand darin verschwindet. Derselbe Wert wie im
 *  Web (`passwort-vergessen-formular.tsx`). */
const MINDESTDAUER_MS = 1200;

export default function HostPasswortVergessen() {
  // NICHT `goBack()`: per Deep-Link (`mynextdays://passwort-vergessen`) liegt
  // KEIN Screen darunter, und React Navigation quittiert das mit „The action
  // 'GO_BACK' was not handled by any navigator" — der Nutzer sitzt fest
  // (live gesehen am 20.08.2026). `navigate` auf den Login funktioniert in
  // beiden Fällen: es geht zurück, wenn der Screen im Stack liegt, und öffnet
  // ihn, wenn nicht.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const zumLogin = () => navigation.navigate("HostLogin");
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gesendet, setGesendet] = useState(false);

  const feld = {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  const anfordern = async () => {
    const adresse = email.trim();
    if (!adresse) return;
    setLaeuft(true);
    // Beide Versprechen parallel: der Aufruf UND die Mindestdauer. Erst wenn
    // BEIDE durch sind, wird umgeschaltet — die sichtbare Dauer ist damit
    // unabhängig davon, ob der Server eine Mail verschickt hat.
    await Promise.all([
      call("/auth/passwort-vergessen", { method: "POST", body: { email: adresse } }),
      new Promise<void>((r) => {
        setTimeout(r, MINDESTDAUER_MS);
      }),
    ]);
    setLaeuft(false);
    setGesendet(true);
  };

  const rahmen = {
    flex: 1,
    backgroundColor: t.palette.bg,
    paddingTop: insets.top + 40,
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 28,
  } as const;

  if (gesendet) {
    return (
      <View style={rahmen}>
        <Col gap={12} style={{ alignItems: "center" }}>
          <Icon n="check" s={40} c={t.palette.accent} />
          <Txt v="display" style={{ textAlign: "center" }}>
            E-Mail unterwegs
          </Txt>
          {/* Neutral formuliert („Falls zu dieser Adresse ein Konto besteht") —
              der Text ist für eine bekannte und eine unbekannte Adresse
              wortgleich. Wortlaut identisch zum Web, damit App und Browser
              nicht unterschiedlich klingen. */}
          <Txt v="body" soft style={{ textAlign: "center" }}>
            Falls zu dieser Adresse ein Konto besteht, haben wir einen Link zum
            Zurücksetzen verschickt. Er ist eine Stunde gültig.
          </Txt>
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            Nichts angekommen? Sieh bitte auch im Spam-Ordner nach.
          </Txt>
        </Col>
        <Col gap={12}>
          <Btn variant="dark" block onPress={() => zumLogin()}>
            Zur Anmeldung
          </Btn>
          {/* Erneut anfordern: zurück ins Formular. Wie oft das wirklich eine
              Mail auslöst, entscheidet die Sperrfrist im Server (1 Minute). */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setGesendet(false)}
            hitSlop={8}
          >
            <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
              Erneut anfordern
            </Txt>
          </Pressable>
        </Col>
      </View>
    );
  }

  return (
    <View style={rahmen}>
      <Col gap={10} style={{ alignItems: "center" }}>
        <Txt v="display" style={{ textAlign: "center" }}>
          Passwort vergessen
        </Txt>
        <Txt v="body" soft style={{ textAlign: "center" }}>
          Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du
          ein neues Passwort setzen kannst.
        </Txt>
      </Col>

      <Col gap={12}>
        <TextInput
          style={feld}
          placeholder="E-Mail"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!laeuft}
          onSubmitEditing={laeuft ? undefined : anfordern}
          returnKeyType="go"
        />
        <Btn variant="dark" block onPress={laeuft ? undefined : anfordern}>
          {laeuft ? "Wird gesendet …" : "Link anfordern"}
        </Btn>
        <Pressable
          accessibilityRole="button"
          onPress={laeuft ? undefined : () => zumLogin()}
          hitSlop={8}
        >
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            Zurück zur Anmeldung
          </Txt>
        </Pressable>
      </Col>
    </View>
  );
}
