// Gäste · Meine Reisen (aus guest-app.jsx GuestTrips): anstehende Reise mit
// Check-in/out + Check-in-Button; abgeschlossene Reise.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import { useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, Flat, Photo, Row, Segmented, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestTrips() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [seg, setSeg] = useState(0);
  return (
    <Screen contentStyle={{ gap: 18 }}>
      <Txt v="h1">Meine Reisen</Txt>
      <Segmented options={["Anstehend", "Vergangen"]} value={seg} onChange={setSeg} style={{ maxWidth: 240 }} />

      <Card style={{ overflow: "hidden" }}>
        <Photo src={PH(P.villa, 700)} grad="grad1" h={150}>
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.28)" }} />
          <Chip variant="accent" style={{ position: "absolute", top: 12, left: 12 }}>
            In 3 Tagen
          </Chip>
          <Col style={{ position: "absolute", bottom: 12, left: 14 }}>
            <Txt v="title" color="#fff">
              Villa Solnedgang
            </Txt>
            <Txt v="xs" color="rgba(255,255,255,0.85)">
              Skagen, Dänemark
            </Txt>
          </Col>
        </Photo>
        <Col style={{ padding: 16, gap: 14 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Col>
              <Txt v="xs" soft>
                CHECK-IN
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                Di · 18. Juni
              </Txt>
            </Col>
            <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
            <Col style={{ alignItems: "flex-end" }}>
              <Txt v="xs" soft>
                CHECK-OUT
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                Sa · 22. Juni
              </Txt>
            </Col>
          </Row>
          <Btn variant="dark" block icon="key" onPress={() => navigation.navigate("Checkin")}>
            Check-in-Infos ansehen
          </Btn>
        </Col>
      </Card>

      <Flat style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 12, opacity: 0.85 }}>
        <Photo src={PH(P.loft, 200)} grad="grad3" h={56} w={64} r={12} />
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
            Lys Loft Apartment
          </Txt>
          <Txt v="xs" soft>
            12.–15. Mai · abgeschlossen
          </Txt>
        </Col>
        <Chip variant="ghost">Bewerten</Chip>
      </Flat>
    </Screen>
  );
}
