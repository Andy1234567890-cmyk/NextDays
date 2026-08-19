// Gastgeber-Login. E-Mail + Passwort gegen den FastAPI-auth-Slice (/auth/login)
// — DIESELBE Auth wie das Web-Dashboard, KEINE eigene App-Registrierung. Bei
// Erfolg wird das Token im Schlüsselbund gespeichert und in die Gastgeber-Tabs
// navigiert. Kein Fallback: Fehler werden klar angezeigt.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostLogin() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kein manuelles Navigieren: nach erfolgreichem Login wechselt der Auth-Status
  // auf "signedIn", und die Root-Navigation (App.tsx) rendert automatisch das
  // rollenbasierte Erlebnis (experienceFor). Eine zentrale Stelle, kein
  // verstreutes reset() in Screens.
  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  // Der Text IN den Feldern bleibt linksbündig, obwohl der Screen mittig
  // ausgerichtet ist: zentrierter Eingabetext wandert beim Tippen mit jedem
  // Zeichen, und die Einfügemarke sitzt nie da, wo man sie erwartet. Die Felder
  // selbst laufen über die volle Breite und stehen damit ohnehin auf der Mitte.
  const field = {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 28,
      }}
    >
      <Col gap={10} style={{ alignItems: "center" }}>
        <Image
          source={t.marke.logo}
          style={{ height: 44, width: 160, resizeMode: "contain", alignSelf: "center" }}
        />
        <Txt v="display" style={{ textAlign: "center" }}>
          Gastgeber-Login
        </Txt>
        <Txt v="body" soft style={{ textAlign: "center" }}>
          Melde dich mit deinem Betriebskonto an — dasselbe wie im Dashboard.
        </Txt>
      </Col>

      <Col gap={12}>
        <TextInput
          style={field}
          placeholder="E-Mail"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        <TextInput
          style={field}
          placeholder="Passwort"
          placeholderTextColor={t.palette.faint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        {error && (
          <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
            {error}
          </Txt>
        )}
        <Btn variant="dark" block onPress={busy ? undefined : submit}>
          {busy ? "Anmeldung läuft …" : "Weiter"}
        </Btn>

        <Row style={{ justifyContent: "center", gap: 6, marginTop: 4 }}>
          <Txt v="sm" soft>
            Noch kein Konto?
          </Txt>
          <Pressable
            accessibilityRole="button"
            onPress={busy ? undefined : () => navigation.navigate("HostSignup")}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold, textDecorationLine: "underline" }}>
              Unternehmen anlegen
            </Txt>
          </Pressable>
        </Row>
      </Col>
    </View>
  );
}
