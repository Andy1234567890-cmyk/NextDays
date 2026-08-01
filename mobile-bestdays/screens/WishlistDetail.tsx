// Gäste · eine Wunschliste mit ihren Objekten (/api/v1/guest-wishlist/{id}).
// `bookable=false` heißt: das Objekt ist derzeit nicht buchbar (inaktiv oder
// nicht mehr auf dem Marktplatz) — das wird ausgewiesen statt verschwiegen.
// Preise bleiben leer, wenn keiner hinterlegt ist (Wurzel 4).
//
// Aufbau wie in den Marktplatz-Apps: Überschrift mit Anzahl, darunter die
// gemerkten Objekte als Karten mit Bild, Herz zum Entfernen und Textblock.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { Icon } from "@/components/ui/Icon";
import { Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { getWishlist, removeWishlistItem, type WishlistDetail as Detail } from "@/lib/guestWishlist";
import { useRealtime } from "@/lib/realtime";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function WishlistDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "WishlistDetail">>();
  const { id } = route.params;

  const [liste, setListe] = useState<Detail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await getWishlist(id);
    if (res.ok) {
      setListe(res.data);
      setFehler(null);
    } else {
      setFehler(res.error);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime mit dem GAST-JWT (Migration 0235: Grant + Publikation). Beide
  // speisenden Tabellen: die Liste selbst (Name, Löschung) und ihre Einträge,
  // serverseitig auf DIESE Liste gefiltert.
  useRealtime({ table: "wishlists", filter: `id=eq.${id}`, onChange: load });
  useRealtime({
    table: "wishlist_items",
    filter: `wishlist_id=eq.${id}`,
    onChange: load,
  });

  const entfernen = async (propertyId: string) => {
    if (busy) return;
    setBusy(true);
    const res = await removeWishlistItem(id, propertyId);
    if (!res.ok) setFehler(res.error);
    // KEIN load(): das DELETE-Event auf wishlist_items zieht die Liste nach —
    // zwei Reload-Pfade nebeneinander erzeugen Doppel-Zustände.
    setBusy(false);
  };

  const anzahl = liste?.items.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={22} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      {!liste && !fehler && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Col gap={6}>
          <Txt v="display" numberOfLines={2}>
            {liste?.name ?? route.params.name ?? "Wunschliste"}
          </Txt>
          {liste && (
            <Txt v="body" soft>
              {anzahl} {anzahl === 1 ? "gespeicherte Unterkunft" : "gespeicherte Unterkünfte"}
            </Txt>
          )}
        </Col>

        {fehler && <EmptyState icon="info" titel="Nicht geladen" text={fehler} />}

        {liste && anzahl === 0 && !fehler && (
          <EmptyState
            icon="heart"
            titel="Noch leer"
            text="Tippe auf das Herz einer Unterkunft, um sie hier zu speichern."
          />
        )}

        {liste?.items.map((item) => {
          const ort = [item.city, item.country].filter(Boolean).join(", ");
          return (
            <ListingCard
              key={item.property_id}
              photo={item.photo ?? undefined}
              grad="grad2"
              // Ein gelöschtes Objekt liefert keinen Titel mehr.
              title={item.title ?? "Objekt nicht mehr verfügbar"}
              place={ort || null}
              meta={item.note || null}
              // Nicht buchbar wird ausgewiesen, nicht verschwiegen.
              tag={item.bookable ? null : "nicht buchbar"}
              price={item.price_from}
              currency={item.currency}
              priceLabel="pro Nacht"
              rating={null}
              // Das gefüllte Herz entfernt den Eintrag (wie in der Referenz).
              fav
              onToggleFav={() => entfernen(item.property_id)}
              onPress={
                item.bookable
                  ? () => navigation.navigate("ListingDetail", { id: item.property_id })
                  : undefined
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
