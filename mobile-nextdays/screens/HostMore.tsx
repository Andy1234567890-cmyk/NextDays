// Gastgeber · Mehr. Bündelt die selteneren Verwalter-Bereiche (Aufgaben,
// Inserate, Profil), damit die untere Tab-Leiste bei max. 5 Einträgen bleibt.
// Nur für admin/co_admin sichtbar — staff/cleaner haben eine eigene, reduzierte
// Struktur, in der Aufgaben ihr HAUPT-Tab bleiben (dort nichts wegnehmen).
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type IconName } from "@/components/ui/Icon";
import { Col, Txt } from "@/components/ui/kit";
import { ListRow } from "@/components/ui/patterns";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

type Entry = { icon: IconName; label: string; tab: string };

const ENTRIES: Entry[] = [
  { icon: "list", label: "Aufgaben", tab: "Tasks" },
  { icon: "grid", label: "Inserate", tab: "Listings" },
  { icon: "star", label: "Bewertungen", tab: "Reviews" },
  { icon: "user", label: "Profil", tab: "HostProfile" },
];

export default function HostMore({ navigation }: { navigation: any }) {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: unterkante + 24,
          gap: 20,
        }}
      >
        <Txt v="display">Mehr</Txt>
        <Col>
          {ENTRIES.map((e, i) => (
            <ListRow
              key={e.tab}
              icon={e.icon}
              label={e.label}
              onPress={() => navigation.navigate(e.tab)}
              last={i === ENTRIES.length - 1}
            />
          ))}
        </Col>
      </ScrollView>
    </View>
  );
}
