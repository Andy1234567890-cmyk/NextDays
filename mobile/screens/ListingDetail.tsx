// Unterkunft-Detail. Lädt das echte Objekt über GET /api/v1/properties/{id}
// (die per Navigation übergebene id wird jetzt benutzt). Zeigt nur echte Felder
// (Titel, Ort, Gästezahl, Beschreibung, Fotos, Basispreis); keine erfundenen
// Werte. Preis symbollos aus den Daten (Währung aus type_attributes) — kein
// €-Hardcode (Wurzel 4). Lade-/Fehler-/Leerzustand getrennt.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Chip, Col, Divider, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { getProperty, type Property } from "@/lib/properties";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

type Pricing = { basePrice?: number; currency?: string };

function pricingOf(p: Property): Pricing {
  return (p.type_attributes?.pricing as Pricing | undefined) ?? {};
}

export default function ListingDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ListingDetail">>();
  const { id } = route.params;

  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProperty(id).then((res) => {
      if (!active) return;
      if (res.ok) {
        setProperty(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (!property) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.palette.bg,
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          gap: 16,
        }}
      >
        <IconBtn icon="back" onPress={() => navigation.goBack()} />
        <Txt v="sm" soft>
          {error ?? "Objekt nicht gefunden."}
        </Txt>
      </View>
    );
  }

  const pricing = pricingOf(property);
  const location = [property.city, property.country].filter(Boolean).join(", ");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Photo src={property.photos?.[0]} grad="grad1" h={340}>
          <Row
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 20,
              right: 20,
              justifyContent: "space-between",
            }}
          >
            <IconBtn icon="back" bg="rgba(255,255,255,0.92)" color={t.palette.ink} onPress={() => navigation.goBack()} />
            <Row gap={10}>
              <IconBtn icon="share" bg="rgba(255,255,255,0.92)" color={t.palette.ink} />
              <IconBtn icon="heart" bg="rgba(255,255,255,0.92)" color={t.palette.ink} />
            </Row>
          </Row>
          {property.photos && property.photos.length > 1 && (
            <Chip
              style={{ position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(0,0,0,0.5)" }}
              textColor="#fff"
            >
              1 / {property.photos.length}
            </Chip>
          )}
        </Photo>

        <Col style={{ padding: t.density.pad, gap: 16 }}>
          <Col gap={6}>
            <Txt v="h1">{property.title}</Txt>
            {location ? (
              <Txt v="sm" soft>
                {location}
              </Txt>
            ) : null}
          </Col>

          <Row gap={18}>
            <Row gap={7}>
              <Icon n="users" s={19} c={t.palette.soft} />
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                {property.max_guests} Gäste
              </Txt>
            </Row>
          </Row>

          {property.description ? (
            <>
              <Divider />
              <Txt v="body" soft>
                {property.description}
              </Txt>
            </>
          ) : null}
        </Col>
      </ScrollView>

      {/* Sticky-Footer: Preis nur wenn vorhanden (kein erfundener Wert). */}
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
          alignItems: "center",
        }}
      >
        <Col>
          {pricing.basePrice != null ? (
            <Row gap={4} style={{ alignItems: "baseline" }}>
              <Txt v="h2">{formatCurrency(pricing.basePrice, pricing.currency)}</Txt>
              <Txt v="sm" soft>
                / Nacht
              </Txt>
            </Row>
          ) : (
            <Txt v="sm" soft>
              Preis auf Anfrage
            </Txt>
          )}
        </Col>
        <Btn variant="primary" iconR="fwd" style={{ flex: 1 }} onPress={() => navigation.navigate("Checkout")}>
          Reservieren
        </Btn>
      </Row>
    </View>
  );
}
