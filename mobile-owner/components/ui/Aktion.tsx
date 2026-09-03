// Der runde Aktionsknopf unten rechts (Vorlage: grüner Kreis mit
// Kalendersymbol). Farbe ist unser Marken-Akzent, nicht Smoobus Grün — eine
// zweite Signalfarbe wäre eine erfundene Markenfarbe (Wurzel 4).
//
// Er schwebt über der Liste und muss die Tab-Leiste freihalten, sonst liegt er
// auf ihr. Der Abstand kommt deshalb aus `useBottomTabBarHeight`, nicht aus
// einer geschätzten Zahl.
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { aktionKnopf } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

export function Aktion({
  icon = "plus",
  label,
  auf,
}: {
  icon?: IconName;
  /** Vorlesetext — PFLICHT: ein Knopf, der nur ein Symbol trägt, ist ohne ihn stumm. */
  label: string;
  auf: () => void;
}) {
  const t = useTheme();
  const tabHoehe = useBottomTabBarHeight();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", right: t.density.pad, bottom: tabHoehe + 16 }}
    >
      <Pressable
        onPress={auf}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [aktionKnopf(t.palette.accent), { opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon n={icon} s={26} sw={2} c={t.palette.accentInk} />
      </Pressable>
    </View>
  );
}
