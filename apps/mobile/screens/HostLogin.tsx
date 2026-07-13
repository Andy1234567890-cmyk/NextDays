// Gastgeber-Login. E-Mail + Passwort gegen den FastAPI-auth-Slice (/auth/login)
// — DIESELBE Auth wie das Web-Dashboard, KEINE eigene App-Registrierung. Bei
// Erfolg wird das Token im Schlüsselbund gespeichert und in die Gastgeber-Tabs
// navigiert. Kein Fallback: Fehler werden klar angezeigt.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Txt } from "@/components/ui/kit";
import { login } from "@/lib/auth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostLogin() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Login-Screen aus dem Stack ersetzen → kein Zurück auf den Login.
    navigation.reset({
      index: 0,
      routes: [{ name: "HostTabs", params: { screen: "Dashboard" } }],
    });
  };

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
      <Col gap={10}>
        <Image
          source={require("@/assets/img/Logo_transparent.png")}
          style={{
            height: 32,
            resizeMode: "contain",
            alignSelf: "flex-start",
            tintColor: t.palette.accent,
          }}
        />
        <Txt v="display">Gastgeber-Login</Txt>
        <Txt v="body" soft>
          Melde dich mit deinem myNextDays-Konto an — dasselbe wie im Dashboard.
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
          <Txt v="sm" color={t.palette.accent}>
            {error}
          </Txt>
        )}
        <Btn variant="primary" block icon="key" onPress={busy ? undefined : submit}>
          {busy ? "Anmeldung läuft …" : "Anmelden"}
        </Btn>
      </Col>
    </View>
  );
}
