// Unterkunft-Karte für die Gast-Suche. Zeigt NUR echte Daten aus dem
// booking_engine-Slice: Bewertung erscheint ausschließlich, wenn das Backend
// eine liefert (nie erfunden), und ein fehlender Preis wird als
// „Preis auf Anfrage" gerendert — nie als 0 (Wurzel 4). Die Währung kommt aus
// dem Objekt (kein €-Hardcode).
import { View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Chip, Col, Photo, Row, Star, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { useTheme } from "@/theme/ThemeProvider";

export function ListingCard({
  photo,
  grad,
  place,
  title,
  rating,
  reviews,
  price,
  currency,
  guests,
  tag,
  fav,
}: {
  photo?: string;
  grad?: "grad1" | "grad2" | "grad3";
  place: string;
  title: string;
  // Bewertung/Anzahl nur setzen, wenn echte Werte vorliegen.
  rating?: number | null;
  reviews?: number | null;
  // „ab"-Preis pro Nacht; null = kein Preis hinterlegt.
  price: number | null;
  // Währung MUSS aus den Daten kommen (listing.currency) — kein €-Hardcode
  // (Wurzel 4). Fehlt sie, rendert formatCurrency die reine Zahl ohne Symbol.
  currency: string | null | undefined;
  guests?: number;
  tag?: string;
  fav?: boolean;
}) {
  const t = useTheme();
  // Bewertung kommt als Zahl aus dem Backend; deutsche Schreibweise mit Komma.
  const bewertung = typeof rating === "number" ? rating.toFixed(2).replace(".", ",") : null;

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
          {fav !== undefined && (
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
          )}
        </Row>
      </Photo>
      <Col gap={3}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Txt>
          {bewertung && (
            <Row gap={4}>
              <Star />
              <Txt v="sm">{bewertung}</Txt>
            </Row>
          )}
        </Row>
        <Txt v="sm" soft numberOfLines={1}>
          {place}
        </Txt>
        <Row gap={5} style={{ marginTop: 3, alignItems: "baseline" }}>
          {price != null ? (
            <>
              <Txt v="title">{formatCurrency(price, currency)}</Txt>
              <Txt v="sm" soft>
                / Nacht
              </Txt>
            </>
          ) : (
            <Txt v="sm" soft>
              Preis auf Anfrage
            </Txt>
          )}
          {typeof guests === "number" && (
            <Txt v="sm" soft>
              · bis {guests} Gäste
            </Txt>
          )}
          {typeof reviews === "number" && reviews > 0 && (
            <Txt v="sm" soft>
              · {reviews} Bew.
            </Txt>
          )}
        </Row>
      </Col>
    </Col>
  );
}
