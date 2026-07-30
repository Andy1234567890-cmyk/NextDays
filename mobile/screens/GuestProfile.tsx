// Gäste · Profil. Zeigt die ECHTEN Stammdaten des Gast-Kontos
// (/api/v1/guest-auth/me) und speichert Änderungen über PATCH — kein
// hartkodierter Name, keine erfundene E-Mail.
//
// Die E-Mail lässt sich hier bewusst NICHT ändern: ein E-Mail-Wechsel braucht
// Re-Auth + Doppel-Opt-in an die neue Adresse (Wurzel 7) und ist ein eigener
// Flow im Backend.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Btn, Card, Col, Divider, Spinner, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, guest, logout, updateProfile } = useGuestAuth();
  // Der Betriebs-Login ist eine EIGENE Welt; hier wird nur darauf verwiesen.
  const { status: tenantStatus } = useAuth();

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
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (status !== "signedIn" || !guest) {
    return (
      <GuestGate
        icon="user"
        titel="Dein Konto"
        hinweis="Melde dich an, um Profil, Buchungen und Merklisten zu verwalten."
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
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <Txt v="h1">Profil</Txt>

        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
          <Avatar s={58} icon="user" />
          <Col gap={2} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              {guest.name?.trim() || "Ohne Namen"}
            </Txt>
            <Txt v="sm" soft numberOfLines={1}>
              {guest.email}
            </Txt>
          </Col>
        </Card>

        <Col gap={10}>
          <Txt v="title">Persönliche Daten</Txt>
          <Feld label="Name" value={name} onChange={setName} autoCapitalize="words" />
          <Feld label="Telefon" value={telefon} onChange={setTelefon} keyboardType="phone-pad" />
          <Txt v="xs" soft>
            Die E-Mail-Adresse ändern wir aus Sicherheitsgründen nur über einen
            bestätigten Wechsel — melde dich dafür beim Support.
          </Txt>
          {meldung && (
            <Txt v="sm" soft>
              {meldung}
            </Txt>
          )}
          <Btn variant={geaendert && !busy ? "primary" : "ghost"} block onPress={speichern}>
            {busy ? "Wird gespeichert …" : "Speichern"}
          </Btn>
        </Col>

        <Divider />

        {/* Wechsel in die Betriebs-Welt: eigene Anmeldung, eigenes Konto. */}
        <Pressable onPress={() => navigation.navigate(tenantStatus === "signedIn" ? "RoleSelect" : "HostLogin")}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: t.palette.ink }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon n="chart" s={20} sw={1.9} c="#fff" />
            </View>
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="title" color="#fff">
                Als Gastgeber verwalten
              </Txt>
              <Txt v="sm" color="rgba(255,255,255,0.7)">
                Objekte, Kalender & Buchungen — eigener Zugang
              </Txt>
            </Col>
            <Icon n="fwd" s={18} sw={2} c="rgba(255,255,255,0.7)" />
          </Card>
        </Pressable>

        <Pressable onPress={logout}>
          <Txt v="sm" accent style={{ textAlign: "center", paddingVertical: 6 }}>
            Abmelden
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "phone-pad";
  autoCapitalize?: "none" | "words";
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
