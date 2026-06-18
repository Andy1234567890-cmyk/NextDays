// Unterkunft-Detail (aus guest-app.jsx GuestDetail): großes Foto mit Aktionen,
// Eckdaten, Gastgeber, Beschreibung, Ausstattung; Sticky-Footer mit Preis + CTA.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Avatar, Btn, Chip, Col, Divider, IconBtn, Photo, Row, Star, Txt } from "@/components/ui/kit";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

const META: [string, string][] = [
  ["users", "6 Gäste"],
  ["bed", "3 Zimmer"],
  ["bath", "2 Bäder"],
];
const AMEN: [string, string][] = [
  ["wifi", "Schnelles WLAN"],
  ["coffee", "Küche"],
  ["tv", "Smart-TV"],
  ["bath", "Sauna"],
];

export default function ListingDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useRoute<RouteProp<RootStackParamList, "ListingDetail">>(); // id verfügbar (Demo nutzt feste Daten)

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Photo src={PH(P.villa, 900)} grad="grad1" h={340}>
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "transparent",
            }}
          />
          <Row style={{ position: "absolute", top: insets.top + 8, left: 20, right: 20, justifyContent: "space-between" }}>
            <IconBtn icon="back" bg="rgba(255,255,255,0.92)" color={t.palette.ink} onPress={() => navigation.goBack()} />
            <Row gap={10}>
              <IconBtn icon="share" bg="rgba(255,255,255,0.92)" color={t.palette.ink} />
              <IconBtn icon="heart" bg="rgba(255,255,255,0.92)" color={t.palette.ink} />
            </Row>
          </Row>
          <Chip
            style={{ position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(0,0,0,0.5)" }}
            textColor="#fff"
          >
            1 / 12
          </Chip>
        </Photo>

        <Col style={{ padding: t.density.pad, gap: 16 }}>
          <Col gap={6}>
            <Txt v="eyebrow" accent>
              Ganzes Ferienhaus
            </Txt>
            <Txt v="h1">Villa Solnedgang</Txt>
            <Row gap={8}>
              <Row gap={4}>
                <Star s={15} />
                <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                  4,97
                </Txt>
              </Row>
              <Txt v="sm" soft>
                · 128 Bewertungen · Skagen, DK
              </Txt>
            </Row>
          </Col>

          <Row gap={18}>
            {META.map((m) => (
              <Row key={m[1]} gap={7}>
                <Icon n={m[0]} s={19} c={t.palette.soft} />
                <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                  {m[1]}
                </Txt>
              </Row>
            ))}
          </Row>

          <Divider />

          <Row gap={12}>
            <Avatar s={48} src={PH(P.bright, 100)} />
            <Col style={{ flex: 1 }}>
              <Txt v="title">Gastgeber: Mette</Txt>
              <Txt v="sm" soft>
                Superhost · antwortet in ~1 Std
              </Txt>
            </Col>
            <Icon n="shield" s={22} c={t.palette.accent} />
          </Row>

          <Divider />

          <Txt v="body" soft>
            Helles Holzhaus mit Panoramablick auf die Dünen. Kaminofen, große Terrasse und nur wenige Schritte zum
            Sandstrand von Skagen.
          </Txt>

          <Txt v="title">Das bietet die Unterkunft</Txt>
          <Row gap={10} style={{ flexWrap: "wrap" }}>
            {AMEN.map((a) => (
              <Chip key={a[1]} variant="ghost" icon={a[0]} style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
                {a[1]}
              </Chip>
            ))}
          </Row>
        </Col>
      </ScrollView>

      {/* Sticky-Footer */}
      <Row
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: insets.bottom + 16,
          backgroundColor: t.palette.surface,
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
          gap: 14,
          justifyContent: "space-between",
        }}
      >
        <Col>
          <Row gap={4}>
            <Txt v="h2">€189</Txt>
            <Txt v="sm" soft>
              / Nacht
            </Txt>
          </Row>
          <Txt v="xs" soft>
            18.–22. Juni · 4 Nächte
          </Txt>
        </Col>
        <Btn variant="primary" iconR="fwd" style={{ flex: 1 }} onPress={() => navigation.navigate("Checkout")}>
          Reservieren
        </Btn>
      </Row>
    </View>
  );
}
