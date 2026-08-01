// Gäste · Kontoeinstellungen. Zeigt die ECHTEN Stammdaten des Gast-Kontos
// (/api/v1/guest-auth/me) und speichert Änderungen über PATCH — kein
// hartkodierter Name, keine erfundene E-Mail.
//
// Die E-Mail lässt sich hier bewusst NICHT ändern: ein E-Mail-Wechsel braucht
// Re-Auth + Doppel-Opt-in an die neue Adresse (Wurzel 7) und ist ein eigener
// Flow im Backend.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestAccount() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, guest, updateProfile } = useGuestAuth();

  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    if (!guest) return;
    setName(guest.name ?? "");
    setTelefon(guest.phone ?? "");
  }, [guest]);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (status !== "signedIn" || !guest) {
    return (
      <GuestGate
        titel="Kontoeinstellungen"
        hinweis="Melde dich an, um deine Kontodaten zu verwalten."
      />
    );
  }

  const speichern = async () => {
    if (busy) return;
    setBusy(true);
    setMeldung(null);
    const res = await updateProfile({
      name: name.trim() || undefined,
      phone: telefon.trim() || undefined,
    });
    setMeldung(res.ok ? "Gespeichert." : res.error);
    setBusy(false);
  };

  const geaendert = name.trim() !== (guest.name ?? "") || telefon.trim() !== (guest.phone ?? "");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Row gap={4} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={22} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 8, paddingBottom: 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Txt v="display">Kontoeinstellungen</Txt>

        <Col gap={0}>
          <Feld label="Name" value={name} onChange={setName} autoCapitalize="words" position="oben" />
          <Feld label="Telefon" value={telefon} onChange={setTelefon} keyboardType="phone-pad" position="unten" />
        </Col>

        <Col gap={6}>
          <Txt v="xs" soft>
            E-MAIL-ADRESSE
          </Txt>
          <Txt v="body">{guest.email}</Txt>
          <Txt v="xs" soft>
            Die E-Mail-Adresse ändern wir aus Sicherheitsgründen nur über einen
            bestätigten Wechsel — melde dich dafür beim Support.
          </Txt>
        </Col>

        {meldung && (
          <Txt v="sm" soft>
            {meldung}
          </Txt>
        )}

        <Btn variant={geaendert && !busy ? "primary" : "ghost"} block onPress={speichern}>
          {busy ? "Wird gespeichert …" : "Speichern"}
        </Btn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Feld einer zusammenhängenden Gruppe: außen gerundet, innen geteilte Linie.
function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  position,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "phone-pad";
  autoCapitalize?: "none" | "words";
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
        style={{ color: t.palette.ink, fontFamily: t.fonts.regular, fontSize: 16, paddingVertical: 6 }}
      />
    </View>
  );
}
