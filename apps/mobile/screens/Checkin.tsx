// Check-in (aus guest-app.jsx GuestCheckin): Türcode-Karte, Adresse, WLAN/
// Hausregeln/Gastgeber-Kacheln, Ankunfts-Fortschritt, „Ich bin angekommen".
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, Flat, IconBtn, Progress, Row, Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

const TILES: [IconName, string, string][] = [
  ["wifi", "WLAN", "Solnedgang_5G"],
  ["shield", "Hausregeln", "Rauchfrei"],
  ["chat", "Gastgeber", "Mette"],
];

export default function Checkin() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Check-in</Txt>
      </Row>

      <Col style={{ padding: 20, paddingTop: 6, gap: 16 }}>
        <Card style={{ padding: 22, gap: 10, alignItems: "center", backgroundColor: t.palette.ink }}>
          <Icon n="key" s={26} c={t.palette.bg} />
          <Txt v="xs" color={t.palette.bg} style={{ opacity: 0.7, letterSpacing: 1.4 }}>
            TÜRCODE
          </Txt>
          <Txt color={t.palette.bg} style={{ fontFamily: t.type.extrabold.fontFamily, fontSize: 44, letterSpacing: 6 }}>
            4729
          </Txt>
          <Txt v="xs" color={t.palette.bg} style={{ opacity: 0.6 }}>
            Aktiv ab 15:00 Uhr am 18. Juni
          </Txt>
        </Card>

        <Flat style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
          <Icon n="pin" s={22} c={t.palette.accent} />
          <Col style={{ flex: 1 }}>
            <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
              Fyrvej 12, 9990 Skagen
            </Txt>
            <Txt v="xs" soft>
              Schlüsselbox links neben der Tür
            </Txt>
          </Col>
          <Chip variant="ghost" icon="map">
            Route
          </Chip>
        </Flat>

        <Row gap={12}>
          {TILES.map((c) => (
            <Flat key={c[1]} style={{ flex: 1, padding: 14, gap: 7, alignItems: "center" }}>
              <Icon n={c[0]} s={22} c={t.palette.accent} />
              <Txt v="xs">{c[1]}</Txt>
              <Txt v="xs" soft>
                {c[2]}
              </Txt>
            </Flat>
          ))}
        </Row>

        <Card style={{ padding: 16, gap: 12 }}>
          <Txt v="title">Ankunft</Txt>
          <Progress pct={70} />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="xs" soft>
              Reise gebucht
            </Txt>
            <Txt v="xs" accent style={{ fontFamily: t.type.bold.fontFamily }}>
              Noch 3 Tage
            </Txt>
          </Row>
        </Card>

        <Btn variant="primary" block icon="check">
          Ich bin angekommen
        </Btn>
      </Col>
    </View>
  );
}
