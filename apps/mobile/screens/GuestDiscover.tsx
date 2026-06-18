// Gäste · Entdecken (aus guest-app.jsx GuestDiscover): Suchleiste, Kategorien,
// beliebte Unterkünfte.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";

import { ListingCard } from "@/components/ListingCard";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Card, Chip, Col, Row, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import type { RootStackParamList } from "@/navigation/types";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

const CATS: [string, string][] = [
  ["globe", "Alle"],
  ["beach", "Strand"],
  ["cabin", "Natur"],
  ["city", "Stadt"],
  ["pool", "Pool"],
];

export default function GuestDiscover() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen contentStyle={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h2" accent>
          NextDays
        </Txt>
        <Avatar s={38} src={PH(P.bright, 100)} />
      </Row>

      <Txt v="display">Finde dein{"\n"}nächstes Zuhause.</Txt>

      <Card style={{ flexDirection: "row", alignItems: "center", padding: 6, paddingLeft: 16, gap: 10 }}>
        <Icon n="search" s={20} sw={2} c={t.palette.soft} />
        <Col gap={1} style={{ flex: 1 }}>
          <Txt v="sm" style={{ fontFamily: t.type.title.fontFamily }}>
            Wohin geht's?
          </Txt>
          <Txt v="xs" soft>
            Beliebige Daten · 2 Gäste
          </Txt>
        </Col>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            backgroundColor: t.palette.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon n="filter" s={20} sw={2} c="#fff" />
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={10}>
          {CATS.map((c, i) => (
            <Chip key={c[1]} variant={i === 1 ? "on" : ""} icon={c[0]}>
              {c[1]}
            </Chip>
          ))}
        </Row>
      </ScrollView>

      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h2">Beliebt gerade</Txt>
        <Txt v="sm" accent>
          Alle ansehen
        </Txt>
      </Row>

      <Pressable onPress={() => navigation.navigate("ListingDetail", { id: "villa" })}>
        <ListingCard
          photo={PH(P.villa)}
          grad="grad1"
          tag="★ Gastgeber-Favorit"
          fav
          title="Villa Solnedgang"
          place="Skagen, Dänemark"
          rating="4,97"
          reviews={128}
          price={189}
        />
      </Pressable>
      <Pressable onPress={() => navigation.navigate("ListingDetail", { id: "cabin" })}>
        <ListingCard
          photo={PH(P.cabin)}
          grad="grad2"
          title="Hytte ved Skoven"
          place="Silkeborg · Seeblick"
          rating="4,89"
          reviews={74}
          price={132}
        />
      </Pressable>
    </Screen>
  );
}
