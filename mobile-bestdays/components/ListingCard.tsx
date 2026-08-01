// Unterkunft-Kachel für die Gast-Suche. Aufbau nach dem Airbnb-Kartenmuster:
// quadratisches Bild mit Badge links und Herz rechts, darunter drei Zeilen
// (Titel · Meta · Preis mit Bewertung).
//
// Es werden NUR echte Daten gezeigt: eine Bewertung erscheint ausschließlich,
// wenn das Backend eine liefert (nie erfunden), und ein fehlender Preis wird
// als „Preis auf Anfrage" gerendert — nie als 0 (Wurzel 4). Die Währung kommt
// aus dem Objekt (kein €-Hardcode).
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Col, Photo, Row, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { useTheme } from "@/theme/ThemeProvider";

export function ListingCard({
  photo,
  grad,
  place,
  title,
  rating,
  price,
  currency,
  // Meta-Zeile unter dem Titel (z. B. Zeitraum oder Gastgeber-Art). Es wird
  // nur gezeigt, was der Aufrufer wirklich hat — hier wird nichts ergänzt.
  meta,
  tag,
  fav,
  onToggleFav,
  onPress,
  // Kachelbreite: undefined = volle Spaltenbreite (Ergebnisliste),
  // Zahl = feste Breite im Karussell.
  width,
  // Preisbezug, den der Aufrufer setzt („Gesamtpreis" vs. „/ Nacht").
  priceLabel,
}: {
  photo?: string;
  grad?: "grad1" | "grad2" | "grad3";
  place?: string | null;
  title: string;
  rating?: number | null;
  price: number | null;
  currency: string | null | undefined;
  meta?: string | null;
  tag?: string | null;
  fav?: boolean;
  onToggleFav?: () => void;
  onPress?: () => void;
  width?: number;
  priceLabel?: string;
}) {
  const t = useTheme();
  // Bewertung kommt als Zahl aus dem Backend; deutsche Schreibweise mit Komma.
  const bewertung = typeof rating === "number" ? rating.toFixed(2).replace(".", ",") : null;
  const metaZeile = [place, meta].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [{ width, opacity: pressed && onPress ? 0.85 : 1 }]}
    >
      <Col gap={10}>
        <Photo src={photo} grad={grad} r={t.radius.img} style={{ aspectRatio: 1 }}>
          <Row
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              right: 10,
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            {tag ? (
              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.pill,
                  backgroundColor: "rgba(255,255,255,0.95)",
                }}
              >
                <Txt v="xs" color="#181614" style={{ fontFamily: t.fonts.semibold }}>
                  {tag}
                </Txt>
              </View>
            ) : (
              <View />
            )}
            {fav !== undefined && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fav ? "Aus Merkliste entfernen" : "Zur Merkliste hinzufügen"}
                onPress={onToggleFav}
                hitSlop={8}
                disabled={!onToggleFav}
              >
                <Icon
                  n="heart"
                  s={26}
                  sw={1.8}
                  c="#FFFFFF"
                  fill={fav ? t.palette.accent : "rgba(0,0,0,0.28)"}
                />
              </Pressable>
            )}
          </Row>
        </Photo>

        <Col gap={2}>
          <Txt v="title" numberOfLines={1}>
            {title}
          </Txt>
          {metaZeile ? (
            <Txt v="sm" soft numberOfLines={1}>
              {metaZeile}
            </Txt>
          ) : null}
          <Row gap={6} style={{ alignItems: "center" }}>
            <Txt v="sm" soft numberOfLines={1} style={{ flexShrink: 1 }}>
              {price != null ? (
                <>
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                    {formatCurrency(price, currency)}
                  </Txt>
                  {priceLabel ? ` ${priceLabel}` : ""}
                </>
              ) : (
                "Preis auf Anfrage"
              )}
            </Txt>
            {bewertung && (
              <Row gap={3}>
                <Txt v="sm" soft>
                  ·
                </Txt>
                <Icon n="star" s={12} sw={0} c={t.palette.ink} fill={t.palette.ink} />
                <Txt v="sm" soft>
                  {bewertung}
                </Txt>
              </Row>
            )}
          </Row>
        </Col>
      </Col>
    </Pressable>
  );
}
