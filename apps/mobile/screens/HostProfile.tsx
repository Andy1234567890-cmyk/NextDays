// Gastgeber · Profil. Zeigt das angemeldete Konto (aus /auth/me) und erlaubt
// Abmelden (Token löschen → zurück zur Rollen-Auswahl). Dieselbe Auth wie das
// Web-Dashboard.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Txt } from "@/components/ui/kit";
import { api } from "@/lib/api";
import { logout } from "@/lib/auth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

type Me = { email: string | null; role: string | null };

export default function HostProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const signOut = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        gap: 18,
      }}
    >
      <Txt v="h1">Profil</Txt>

      <Card style={{ padding: 18, gap: 6 }}>
        <Txt v="title">{me?.email ?? "—"}</Txt>
        {me?.role && (
          <Txt v="sm" soft>
            Rolle: {me.role}
          </Txt>
        )}
      </Card>

      <Btn variant="outline" block icon="back" onPress={signOut}>
        Abmelden
      </Btn>
    </View>
  );
}
