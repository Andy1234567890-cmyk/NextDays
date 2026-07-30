// Gäste · eine Merkliste mit ihren Objekten (/api/v1/guest-wishlist/{id}).
// `bookable=false` heißt: das Objekt ist derzeit nicht buchbar (inaktiv oder
// nicht mehr auf dem Marktplatz) — das wird ausgewiesen statt verschwiegen.
// Preise bleiben leer, wenn keiner hinterlegt ist (Wurzel 4).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Col, Divider, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { getWishlist, removeWishlistItem, type WishlistDetail as Detail } from "@/lib/guestWishlist";
import type { RootStackParamList } from "@/navigation/types";
import { useRealtime } from "@/lib/realtime";
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
  useRealtime({ table: "wishlists", filter: `id=eq.${id}`, tokenSource: "guest", onChange: load });
  useRealtime({
    table: "wishlist_items",
    filter: `wishlist_id=eq.${id}`,
    tokenSource: "guest",
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

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14, alignItems: "center" }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2" numberOfLines={1} style={{ flex: 1 }}>
          {liste?.name ?? route.params.name ?? "Merkliste"}
        </Txt>
      </Row>

      {!liste && !fehler && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {fehler && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {fehler}
          </Txt>
        )}
        {liste && liste.items.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            Diese Liste ist noch leer. Merke dir Unterkünfte über das Herz-Symbol.
          </Txt>
        )}
        {liste && liste.items.length > 0 && (
          <Card style={{ padding: 6 }}>
            {liste.items.map((item, i) => {
              const ort = [item.city, item.country].filter(Boolean).join(", ");
              return (
                <View key={item.property_id}>
                  {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                  <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
                    <Pressable
                      style={{ flex: 1, flexDirection: "row", gap: 12, alignItems: "center" }}
                      onPress={() =>
                        item.bookable
                          ? navigation.navigate("ListingDetail", { id: item.property_id })
                          : undefined
                      }
                    >
                      <Photo src={item.photo ?? undefined} grad="grad2" h={56} w={64} r={12} />
                      <Col gap={3} style={{ flex: 1 }}>
                        <Txt v="sm" numberOfLines={1} style={{ fontFamily: t.type.semibold.fontFamily }}>
                          {/* Gelöschtes Objekt liefert keinen Titel mehr. */}
                          {item.title ?? "Objekt nicht mehr verfügbar"}
                        </Txt>
                        {ort ? (
                          <Txt v="xs" soft numberOfLines={1}>
                            {ort}
                          </Txt>
                        ) : null}
                        <Row gap={8} style={{ alignItems: "center" }}>
                          {item.price_from != null && (
                            <Txt v="xs">
                              ab {formatCurrency(item.price_from, item.currency)} / Nacht
                            </Txt>
                          )}
                          {!item.bookable && <Chip variant="ghost">nicht buchbar</Chip>}
                        </Row>
                        {item.note ? (
                          <Txt v="xs" soft numberOfLines={2}>
                            {item.note}
                          </Txt>
                        ) : null}
                      </Col>
                    </Pressable>
                    <Pressable onPress={() => entfernen(item.property_id)} hitSlop={10}>
                      <Icon n="x" s={18} c={t.palette.soft} />
                    </Pressable>
                  </Row>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
