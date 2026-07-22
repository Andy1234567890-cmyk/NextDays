// Gastgeber · Mehr. Bündelt die selteneren Verwalter-Bereiche (Inbox, Inserate,
// Profil), damit die untere Tab-Leiste bei max. 5 Einträgen bleibt. Nur für
// admin/co_admin sichtbar (staff/cleaner haben eine eigene, reduzierte Struktur).
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Card, Divider, Row, Txt } from "@/components/ui/kit";
import { Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Entry = { icon: IconName; label: string; tab: string };

const ENTRIES: Entry[] = [
  { icon: "chat", label: "Inbox", tab: "HostInbox" },
  { icon: "grid", label: "Inserate", tab: "Listings" },
  { icon: "user", label: "Profil", tab: "HostProfile" },
];

export default function HostMore({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 8, paddingHorizontal: 20, gap: 16 }}>
      <Txt v="h1">Mehr</Txt>
      <Card style={{ padding: 4 }}>
        {ENTRIES.map((e, i) => (
          <View key={e.tab}>
            {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
            <Pressable onPress={() => navigation.navigate(e.tab)}>
              <Row style={{ padding: 14, gap: 12, alignItems: "center" }}>
                <Icon n={e.icon} s={20} c={t.palette.soft} />
                <Txt v="sm" style={{ flex: 1, fontWeight: "600" }}>
                  {e.label}
                </Txt>
                <Icon n="fwd" s={16} c={t.palette.faint} />
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
  );
}
