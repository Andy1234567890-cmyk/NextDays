// Gastgeber · Inserate (aus host-app.jsx HostListings): Objektkarten mit Status,
// Bewertung, Preis, Belegung. Bindet echte Objekte aus dem FastAPI-Backend ein
// (Fallback auf Demo-Daten, solange nicht angemeldet / kein Backend).
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Chip, Col, Photo, Row, Spinner, Star, Txt } from "@/components/ui/kit";
import { listProperties, type Property } from "@/lib/properties";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

type Item = {
  name: string;
  photo?: string;
  grad: "grad1" | "grad2" | "grad3";
  status: "Live" | "Entwurf";
  rating: string;
  price: number;
  occ: number;
};

const DEMO: Item[] = [
  { name: "Villa Solnedgang", photo: PH(P.villa, 600), grad: "grad1", status: "Live", rating: "4,97", price: 189, occ: 84 },
  { name: "Lys Loft Apartment", photo: PH(P.loft, 600), grad: "grad3", status: "Live", rating: "4,81", price: 158, occ: 71 },
  { name: "Hytte ved Skoven", photo: PH(P.cabin, 600), grad: "grad2", status: "Entwurf", rating: "–", price: 132, occ: 0 },
];

function fromProperty(p: Property): Item {
  const price = Number((p.type_attributes?.pricing as { basePrice?: number } | undefined)?.basePrice) || 0;
  return {
    name: p.title,
    photo: p.photos?.[0],
    grad: "grad1",
    status: p.status === "active" ? "Live" : "Entwurf",
    rating: "–",
    price,
    occ: 0,
  };
}

export default function Listings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[] | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    let active = true;
    listProperties().then((res) => {
      if (!active) return;
      if (res.ok && res.data.items.length > 0) {
        setItems(res.data.items.map(fromProperty));
        setUsingDemo(false);
      } else {
        setItems(DEMO);
        setUsingDemo(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, justifyContent: "space-between" }}>
        <Col gap={2}>
          <Txt v="h1">Inserate</Txt>
          <Txt v="sm" soft>
            {items ? `${items.length} Objekte${usingDemo ? " · Demo" : ""}` : "lädt …"}
          </Txt>
        </Col>
        <Btn variant="primary" icon="plus" style={{ paddingVertical: 11, paddingHorizontal: 15 }}>
          Neu
        </Btn>
      </Row>

      <Col style={{ paddingHorizontal: 20, paddingTop: 4, gap: 16 }}>
        {!items && <Spinner />}
        {items?.map((it, i) => (
          <Card key={`${it.name}-${i}`} style={{ overflow: "hidden" }}>
            <Photo src={it.photo} grad={it.grad} h={130}>
              <Chip
                style={{ position: "absolute", top: 12, left: 12, backgroundColor: it.status === "Live" ? t.palette.accent : "rgba(0,0,0,0.55)" }}
                textColor="#fff"
              >
                {it.status === "Live" ? "● Live" : "Entwurf"}
              </Chip>
            </Photo>
            <Col style={{ padding: 16, gap: 12 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                  {it.name}
                </Txt>
                <Row gap={4}>
                  {it.rating !== "–" && <Star s={13} />}
                  <Txt v="sm">{it.rating}</Txt>
                </Row>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Row gap={16}>
                  <Col>
                    <Txt v="xs" soft>
                      PREIS
                    </Txt>
                    <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                      €{it.price}
                    </Txt>
                  </Col>
                  <Col>
                    <Txt v="xs" soft>
                      BELEGUNG
                    </Txt>
                    <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                      {it.occ}%
                    </Txt>
                  </Col>
                </Row>
                <Btn variant="ghost" iconR="fwd" style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
                  Verwalten
                </Btn>
              </Row>
            </Col>
          </Card>
        ))}
      </Col>
    </View>
  );
}
