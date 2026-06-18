// Bestätigen & zahlen (aus guest-app.jsx GuestCheckout): Objekt-Zusammenfassung,
// Daten/Gäste, Preisübersicht, Zahlungsmethode, Sticky „Sicher zahlen".
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Flat, IconBtn, Photo, Row, Segmented, Star, Txt } from "@/components/ui/kit";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

export default function Checkout() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [pay, setPay] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Bestätigen & zahlen</Txt>
      </Row>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16 }}>
        <Card style={{ flexDirection: "row", padding: 12, gap: 12 }}>
          <Photo src={PH(P.villa, 200)} grad="grad1" h={70} w={84} r={14} />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              Villa Solnedgang
            </Txt>
            <Txt v="sm" soft>
              Ganzes Haus · Skagen
            </Txt>
            <Row gap={4}>
              <Star s={12} />
              <Txt v="xs">4,97 · 128</Txt>
            </Row>
          </Col>
        </Card>

        <Flat style={{ padding: 16, gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Col>
              <Txt v="xs" soft>
                DATEN
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                18.–22. Juni
              </Txt>
            </Col>
            <Icon n="cal" s={18} c={t.palette.accent} />
          </Row>
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <Col>
              <Txt v="xs" soft>
                GÄSTE
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                2 Erwachsene
              </Txt>
            </Col>
            <Icon n="users" s={18} c={t.palette.accent} />
          </Row>
        </Flat>

        <Col gap={10}>
          <Txt v="title">Preisübersicht</Txt>
          <PriceRow label="€189 × 4 Nächte" value="€756" />
          <PriceRow label="Reinigungsgebühr" value="€45" />
          <PriceRow label="NextDays-Servicegebühr" value="€38" />
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="title">Gesamt</Txt>
            <Txt v="h2" accent>
              €839
            </Txt>
          </Row>
        </Col>

        <Txt v="title">Zahlungsmethode</Txt>
        <Segmented options={["Karte", "PayPal", "Apple Pay"]} value={pay} onChange={setPay} />
        <Flat style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
          <Icon n="card" s={20} c={t.palette.accent} />
          <Txt v="sm" style={{ flex: 1, fontFamily: t.type.semibold.fontFamily }}>
            Visa ···· 4827
          </Txt>
          <Icon n="check" s={18} sw={2} c={t.palette.accent} />
        </Flat>
      </ScrollView>

      <Col style={{ padding: 20, paddingBottom: insets.bottom + 16, gap: 8, backgroundColor: t.palette.surface, borderTopWidth: 1, borderTopColor: t.palette.line }}>
        <Btn variant="primary" block icon="shield" onPress={() => navigation.navigate("GuestTabs", { screen: "Trips" })}>
          Sicher zahlen · €839
        </Btn>
        <Txt v="xs" soft style={{ textAlign: "center" }}>
          Kostenlose Stornierung bis 16. Juni
        </Txt>
      </Col>
    </View>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Txt v="body" soft>
        {label}
      </Txt>
      <Txt v="sm">{value}</Txt>
    </Row>
  );
}
