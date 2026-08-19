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
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { deleteGuestAccount } from "@/lib/guestAuth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestAccount() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, guest, updateProfile, logout } = useGuestAuth();

  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  // Löschen ist zweistufig: der Weg muss auffindbar sein, aber ein einzelner
  // Fehlgriff darf kein Konto vernichten. Erst aufklappen, dann Passwort.
  const [loeschOffen, setLoeschOffen] = useState(false);
  const [loeschPasswort, setLoeschPasswort] = useState("");
  const [loeschLaeuft, setLoeschLaeuft] = useState(false);

  useEffect(() => {
    if (!guest) return;
    setName(guest.name ?? "");
    setTelefon(guest.phone ?? "");
  }, [guest]);

  /**
   * Konto endgültig löschen. Danach ist die Sitzung wertlos — deshalb IMMER
   * abmelden, statt in einer Oberfläche zu bleiben, deren Aufrufe ab jetzt 401
   * liefern. Was aufbewahrt wird, sagt der Server (`hinweis`): bereits
   * getätigte Buchungen bleiben beim Gastgeber, und das muss der Gast erfahren,
   * sonst steht er vor verschlossener Tür.
   */
  const loeschen = async () => {
    setLoeschLaeuft(true);
    const res = await deleteGuestAccount(loeschPasswort);
    setLoeschLaeuft(false);
    setLoeschPasswort("");
    if (!res.ok) {
      Alert.alert("Nicht gelöscht", res.error);
      return;
    }
    Alert.alert(
      "Konto gelöscht",
      [res.data.detail, res.data.hinweis].filter(Boolean).join("\n\n"),
      [{ text: "OK", onPress: () => logout() }],
    );
  };

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

        {/* Konto löschen — Pflichtweg IN der App (Apple 5.1.1(v)); Google
            verlangt zusätzlich den Web-Weg für Leute, die die App schon
            deinstalliert haben.
            Ganz unten und ohne Farbe: er muss auffindbar sein, aber niemand soll
            ihn versehentlich treffen. */}
        <Col gap={8} style={{ marginTop: 12 }}>
          <Divider />
          {loeschOffen ? (
            <>
              <Txt v="sm" soft>
                Dein Konto und deine Anmeldedaten werden gelöscht. Bereits
                getätigte Buchungen bleiben beim Gastgeber — er braucht sie für
                deinen Aufenthalt und seine Buchhaltung.
              </Txt>
              <TextInput
                value={loeschPasswort}
                onChangeText={setLoeschPasswort}
                secureTextEntry
                placeholder="Passwort bestätigen"
                placeholderTextColor={t.palette.faint}
                style={{
                  backgroundColor: t.palette.surface,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: t.palette.ink,
                }}
              />
              <Row gap={8}>
                <Btn
                  variant="ghost"
                  onPress={
                    loeschLaeuft
                      ? undefined
                      : () => {
                          setLoeschOffen(false);
                          setLoeschPasswort("");
                        }
                  }
                >
                  Abbrechen
                </Btn>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="outline"
                    block
                    onPress={
                      loeschLaeuft || !loeschPasswort ? undefined : loeschen
                    }
                  >
                    {loeschLaeuft ? "Wird gelöscht …" : "Endgültig löschen"}
                  </Btn>
                </View>
              </Row>
            </>
          ) : (
            <Pressable
              onPress={() => setLoeschOffen(true)}
              style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Txt v="sm" accent>
                Konto löschen
              </Txt>
            </Pressable>
          )}
        </Col>
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
