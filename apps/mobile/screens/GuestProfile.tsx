// Gäste · Profil: Konto-Kopf, Modus-Wechsel zu Gastgeber (führt zur
// Rollen-Auswahl / Gastgeber-Tabs) und Konto-Einstellungen.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const ITEMS: { icon: IconName; label: string }[] = [
  { icon: "user", label: "Persönliche Daten" },
  { icon: "card", label: "Zahlungsmethoden" },
  { icon: "shield", label: "Sicherheit & Datenschutz" },
  { icon: "bell", label: "Benachrichtigungen" },
  { icon: "cog", label: "Einstellungen" },
];

export default function GuestProfile() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Screen contentStyle={{ gap: 18 }}>
      <Txt v="h1">Profil</Txt>

      {/* Konto-Kopf */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
        <Avatar s={58} src={PH(P.bright, 120)} />
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="title">Andy Staudinger</Txt>
          <Txt v="sm" soft>
            a.staudinger32@gmail.com
          </Txt>
        </Col>
        <Icon n="fwd" s={18} sw={2} c={t.palette.soft} />
      </Card>

      {/* Modus-Wechsel zu Gastgeber (wie Airbnb „Hosting-Modus") */}
      <Pressable onPress={() => navigation.navigate("RoleSelect")}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: t.palette.ink }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
            <Icon n="chart" s={20} sw={1.9} c="#fff" />
          </View>
          <Col gap={2} style={{ flex: 1 }}>
            <Txt v="title" color="#fff">
              Als Gastgeber verwalten
            </Txt>
            <Txt v="sm" color="rgba(255,255,255,0.7)">
              Objekte, Kalender & Buchungen
            </Txt>
          </Col>
          <Icon n="fwd" s={18} sw={2} c="rgba(255,255,255,0.7)" />
        </Card>
      </Pressable>

      {/* Konto-Einträge */}
      <Card style={{ padding: 4 }}>
        {ITEMS.map((it, i) => (
          <View key={it.label}>
            {i > 0 && <Divider style={{ marginHorizontal: 14 }} />}
            <Row gap={14} style={{ paddingVertical: 15, paddingHorizontal: 14 }}>
              <Icon n={it.icon} s={20} sw={1.8} c={t.palette.soft} />
              <Txt v="sm" style={{ flex: 1, fontFamily: t.type.medium.fontFamily }}>
                {it.label}
              </Txt>
              <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
            </Row>
          </View>
        ))}
      </Card>

      <Pressable>
        <Txt v="sm" accent style={{ textAlign: "center", paddingVertical: 6 }}>
          Abmelden
        </Txt>
      </Pressable>
    </Screen>
  );
}
