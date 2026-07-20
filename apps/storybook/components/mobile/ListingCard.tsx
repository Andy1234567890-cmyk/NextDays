// Unterkunft-Karte (aus guest-app.jsx ListingCard): Foto mit Tag/Favorit-Button,
// Titel + Bewertung, Ort, Preis/Nacht.
import { View } from "react-native";

import { Icon } from "./Icon";
import { Chip, Col, Photo, Row, Star, Txt } from "./kit";
import { formatCurrency } from "./currency";
import { useTheme } from "./ThemeProvider";

export function ListingCard({
  photo,
  grad,
  place,
  title,
  rating,
  reviews,
  price,
  currency,
  tag,
  fav,
}: {
  photo?: string;
  grad?: "grad1" | "grad2" | "grad3";
  place: string;
  title: string;
  rating: string;
  reviews: number;
  price: number;
  // Währung MUSS aus den Daten kommen (property.currency) — kein €-Hardcode
  // (Wurzel 4). Fehlt sie, rendert formatCurrency die reine Zahl ohne Symbol.
  currency: string | null | undefined;
  tag?: string;
  fav?: boolean;
}) {
  const t = useTheme();
  return (
    <Col gap={10}>
      <Photo src={photo} grad={grad} h={200} r={t.radius.img}>
        <Row style={{ position: "absolute", top: 12, left: 12, right: 12, justifyContent: "space-between" }}>
          {tag ? (
            <Chip style={{ backgroundColor: "rgba(255,255,255,0.92)", paddingVertical: 6, paddingHorizontal: 11 }} textColor={t.palette.ink}>
              {tag}
            </Chip>
          ) : (
            <View />
          )}
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon n="heart" s={18} sw={2} c={fav ? t.palette.accent : t.palette.ink} />
          </View>
        </Row>
      </Photo>
      <Col gap={3}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Txt>
          <Row gap={4}>
            <Star />
            <Txt v="sm">{rating}</Txt>
          </Row>
        </Row>
        <Txt v="sm" soft>
          {place}
        </Txt>
        <Row gap={5} style={{ marginTop: 3 }}>
          <Txt v="title">{formatCurrency(price, currency)}</Txt>
          <Txt v="sm" soft>
            / Nacht · {reviews} Bew.
          </Txt>
        </Row>
      </Col>
    </Col>
  );
}
