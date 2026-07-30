// Anmeldung/Registrierung des PORTAL-GASTES (guest_auth-Slice). Das ist NICHT
// der Betriebs-Login (HostLogin): hier entsteht ein Kundenkonto ohne Tenant und
// ohne Rolle. Beide Sessions liegen getrennt im Schlüsselbund und können
// nebeneinander bestehen.
//
// Der Passwort-Reset antwortet serverseitig IMMER 200 (kein Existenz-Leak) —
// die App zeigt deshalb dieselbe neutrale Meldung, egal ob die Adresse existiert.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, IconBtn, Row, Segmented, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { guestPasswordReset } from "@/lib/guestAuth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert.trim());
}

export default function GuestLogin() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "GuestLogin">>();
  const { login, register } = useGuestAuth();

  const [modus, setModus] = useState(route.params?.modus === "registrieren" ? 1 : 0);
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const registrieren = modus === 1;
  // Serverseitige Mindestlänge (8) hier spiegeln, damit der Nutzer nicht erst
  // ein 422 kassiert. Die verbindliche Prüfung bleibt im Backend.
  const formularOk =
    istEmail(email) && passwort.length >= 8 && (!registrieren || name.trim().length > 0);

  const absenden = async () => {
    if (busy || !formularOk) return; // Wurzel 2: kein doppelter Auth-Request
    setBusy(true);
    setFehler(null);
    setHinweis(null);
    const res = registrieren
      ? await register({
          email: email.trim(),
          password: passwort,
          name: name.trim(),
          phone: telefon.trim() || undefined,
        })
      : await login(email.trim(), passwort);
    if (res.ok) {
      // Nach Erfolg zurück in den Gast-Bereich; der Context hält die Session.
      navigation.navigate("GuestTabs", { screen: "Trips" });
    } else {
      setFehler(res.error);
    }
    setBusy(false);
  };

  const passwortVergessen = async () => {
    if (busy || !istEmail(email)) {
      setHinweis("Bitte zuerst deine E-Mail-Adresse eintragen.");
      return;
    }
    setBusy(true);
    await guestPasswordReset(email.trim());
    setHinweis("Falls ein Konto existiert, ist eine E-Mail zum Zurücksetzen unterwegs.");
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Gast-Konto</Txt>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Segmented
          options={["Anmelden", "Registrieren"]}
          value={modus}
          onChange={(i) => {
            setModus(i);
            setFehler(null);
            setHinweis(null);
          }}
        />

        <Txt v="sm" soft>
          {registrieren
            ? "Mit einem Gast-Konto verwaltest du Buchungen, Merklisten und den Check-in."
            : "Melde dich mit deinem Gast-Konto an."}
        </Txt>

        {registrieren && (
          <Feld label="Name" value={name} onChange={setName} autoCapitalize="words" />
        )}
        <Feld
          label="E-Mail"
          value={email}
          onChange={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Feld label="Passwort" value={passwort} onChange={setPasswort} secure />
        {registrieren && (
          <Feld
            label="Telefon (optional)"
            value={telefon}
            onChange={setTelefon}
            keyboardType="phone-pad"
          />
        )}

        {registrieren && passwort.length > 0 && passwort.length < 8 && (
          <Txt v="xs" soft>
            Das Passwort braucht mindestens 8 Zeichen.
          </Txt>
        )}

        {fehler && (
          <Txt v="sm" style={{ color: "#B02A2A" }}>
            {fehler}
          </Txt>
        )}
        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        <Btn variant={formularOk && !busy ? "primary" : "ghost"} block onPress={absenden}>
          {busy ? "Bitte warten …" : registrieren ? "Konto erstellen" : "Anmelden"}
        </Btn>

        {!registrieren && (
          <Btn variant="ghost" block onPress={passwortVergessen}>
            Passwort vergessen
          </Btn>
        )}

        <Col gap={6} style={{ marginTop: 10 }}>
          <Txt v="xs" soft style={{ textAlign: "center" }}>
            Du verwaltest Objekte? Der Betriebs-Zugang läuft über ein eigenes Konto.
          </Txt>
          <Btn variant="ghost" block onPress={() => navigation.navigate("HostLogin")}>
            Zum Gastgeber-Login
          </Btn>
        </Col>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  secure?: boolean;
}) {
  const t = useTheme();
  return (
    <Col gap={4}>
      <Txt v="xs" soft>
        {label.toUpperCase()}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        secureTextEntry={secure}
        style={{
          borderWidth: 1,
          borderColor: t.palette.line,
          borderRadius: t.radius.btn,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: t.palette.ink,
          fontFamily: t.type.medium.fontFamily,
          backgroundColor: t.palette.surface,
        }}
      />
    </Col>
  );
}
