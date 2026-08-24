// Anmeldung/Registrierung des PORTAL-GASTES (guest_auth-Slice). Das ist NICHT
// der Betriebs-Login (HostLogin): hier entsteht ein Kundenkonto ohne Tenant und
// ohne Rolle. Beide Sessions liegen getrennt im Schlüsselbund und können
// nebeneinander bestehen.
//
// Aufbau wie die Anmeldemaske der Referenz-Apps: Logo mittig, ruhige
// Feldliste, breite Pill als Hauptaktion, sekundäre Wege darunter. Es gibt
// bewusst KEINE Google-/Apple-Kacheln — dafür existiert serverseitig kein
// Anmeldeweg, ein Knopf dafür wäre eine Attrappe.
//
// Der Passwort-Reset antwortet serverseitig IMMER 200 (kein Existenz-Leak) —
// die App zeigt deshalb dieselbe neutrale Meldung, egal ob die Adresse existiert.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { zurAnderenApp } from "@/lib/appwechsel";
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

  const [registrieren, setRegistrieren] = useState(route.params?.modus === "registrieren");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

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

  const modusWechseln = () => {
    setRegistrieren((v) => !v);
    setFehler(null);
    setHinweis(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Kopf: nur das Schließen-Kreuz, wie beim Anmelde-Sheet der Referenz. */}
      <Row style={{ paddingHorizontal: 16, paddingVertical: 10, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="x" s={22} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Col gap={10} style={{ alignItems: "center", paddingTop: 24, paddingBottom: 6 }}>
          {/* Breite folgt dem Seitenverhältnis des Logos (1461:403 ≈ 3.63). Mit den
              alten 168 blieb das Bild bei `contain` nur ~46 px hoch statt 62 —
              nicht verzerrt, aber kleiner als gedacht. */}
          <Image source={t.marke.logo} style={{ width: 225, height: 62 }} resizeMode="contain" />
          <Txt v="h1" style={{ textAlign: "center" }}>
            {registrieren ? "Konto erstellen" : "Einloggen oder registrieren"}
          </Txt>
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            {registrieren
              ? "Mit einem Gast-Konto verwaltest du Buchungen, Wunschlisten und den Check-in."
              : "Melde dich an und plane deine nächste Reise."}
          </Txt>
        </Col>

        {/* Feldgruppe mit gemeinsamer Umrandung (Referenz-Muster). */}
        <Col gap={0}>
          {registrieren && (
            <Feld
              label="Name"
              value={name}
              onChange={setName}
              autoCapitalize="words"
              position="oben"
            />
          )}
          <Feld
            label="E-Mail-Adresse"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
            position={registrieren ? "mitte" : "oben"}
          />
          <Feld
            label="Passwort"
            value={passwort}
            onChange={setPasswort}
            secure
            position={registrieren ? "mitte" : "unten"}
          />
          {registrieren && (
            <Feld
              label="Telefon (optional)"
              value={telefon}
              onChange={setTelefon}
              keyboardType="phone-pad"
              position="unten"
            />
          )}
        </Col>

        {registrieren && passwort.length > 0 && passwort.length < 8 && (
          <Txt v="xs" soft>
            Das Passwort braucht mindestens 8 Zeichen.
          </Txt>
        )}

        {fehler && (
          <Row gap={8} style={{ alignItems: "flex-start" }}>
            <Icon n="info" s={17} sw={1.9} c={t.palette.accent} />
            <Txt v="sm" accent style={{ flex: 1 }}>
              {fehler}
            </Txt>
          </Row>
        )}
        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        <Btn variant={formularOk && !busy ? "primary" : "ghost"} block onPress={absenden}>
          {busy ? "Bitte warten …" : "Weiter"}
        </Btn>

        {!registrieren && (
          <Pressable onPress={passwortVergessen} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Txt v="sm" style={{ textAlign: "center", textDecorationLine: "underline" }}>
              Passwort vergessen
            </Txt>
          </Pressable>
        )}

        <Trenner label="oder" />

        <Btn variant="outline" block onPress={modusWechseln}>
          {registrieren ? "Ich habe schon ein Konto" : "Neues Gast-Konto erstellen"}
        </Btn>

        <Col gap={8} style={{ marginTop: 6 }}>
          <Txt v="xs" soft style={{ textAlign: "center" }}>
            Du verwaltest Objekte? Der Betriebs-Zugang läuft über die eigene App{" "}
            {t.marke.andereApp.name}.
          </Txt>
          <Pressable
            onPress={() => void zurAnderenApp(t.marke.andereApp, "login")}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="sm" style={{ textAlign: "center", textDecorationLine: "underline" }}>
              Zu {t.marke.andereApp.name}
            </Txt>
          </Pressable>
        </Col>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Bausteine --------------------------------------------------------------

function Trenner({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Row gap={14}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.palette.line }} />
      <Txt v="xs" soft>
        {label}
      </Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: t.palette.line }} />
    </Row>
  );
}

// Feld einer zusammenhängenden Gruppe: die Ecken werden nur außen gerundet,
// innen teilen sich benachbarte Felder eine Linie.
function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  secure,
  position,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  secure?: boolean;
  position: "oben" | "mitte" | "unten";
}) {
  const t = useTheme();
  const r = 14;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.palette.line,
        borderTopWidth: position === "oben" ? 1 : 0,
        borderTopLeftRadius: position === "oben" ? r : 0,
        borderTopRightRadius: position === "oben" ? r : 0,
        borderBottomLeftRadius: position === "unten" ? r : 0,
        borderBottomRightRadius: position === "unten" ? r : 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        backgroundColor: t.palette.surface,
      }}
    >
      <Txt v="xs" soft>
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        secureTextEntry={secure}
        style={{
          color: t.palette.ink,
          fontFamily: t.fonts.regular,
          fontSize: 16,
          paddingVertical: 6,
        }}
      />
    </View>
  );
}
