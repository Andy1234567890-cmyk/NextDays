// Gäste · Suche. Zeigt AUSSCHLIESSLICH echte Inserate aus dem booking_engine-
// Slice (/api/v1/booking-engine/listings) — keine Demo-Objekte mehr. Suchtext,
// Gästezahl und Zeitraum gehen als Serverparameter mit; gefiltert wird
// serverseitig (die App filtert nichts nach).
// Preise/Währung kommen aus den Objektdaten; fehlt ein Preis, steht dort
// „Preis auf Anfrage" statt 0 (Wurzel 4).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Col, Spinner, Txt } from "@/components/ui/kit";
import { ListingCard } from "@/components/ListingCard";
import {
  listingOrt,
  listingTypeLabel,
  searchListings,
  type Listing,
} from "@/lib/listings";
import type { GuestTabParamList, RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

// Gäste-Schnellfilter (Serverparameter `guests`), keine erfundenen Kategorien.
const GAESTE: (number | null)[] = [null, 1, 2, 4, 6];

export default function GuestDiscover() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<GuestTabParamList, "Discover">>();

  const [suche, setSuche] = useState(route.params?.q ?? "");
  const [aktiveSuche, setAktiveSuche] = useState(route.params?.q ?? "");
  const [gaeste, setGaeste] = useState<number | null>(route.params?.guests ?? null);
  const start = route.params?.start;
  const ende = route.params?.end;

  const [items, setItems] = useState<Listing[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await searchListings({
      q: aktiveSuche || undefined,
      guests: gaeste ?? undefined,
      start,
      end: ende,
    });
    if (res.ok) {
      setItems(res.data.items);
      setFehler(null);
    } else {
      setItems(null);
      setFehler(res.error);
    }
  }, [aktiveSuche, gaeste, start, ende]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <Txt v="h1">Suche</Txt>

        <Card style={{ flexDirection: "row", alignItems: "center", padding: 6, paddingLeft: 16, gap: 10 }}>
          <Icon n="search" s={20} sw={2} c={t.palette.soft} />
          <TextInput
            value={suche}
            onChangeText={setSuche}
            onSubmitEditing={() => setAktiveSuche(suche.trim())}
            returnKeyType="search"
            placeholder="Ort oder Objekt"
            placeholderTextColor={t.palette.faint}
            style={{ flex: 1, color: t.palette.ink, fontFamily: t.type.medium.fontFamily, paddingVertical: 12 }}
          />
          <Pressable
            onPress={() => setAktiveSuche(suche.trim())}
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              backgroundColor: t.palette.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon n="search" s={20} sw={2} c="#fff" />
          </Pressable>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {GAESTE.map((g) => (
            <Pressable key={String(g)} onPress={() => setGaeste(g)}>
              <Chip variant={g === gaeste ? "on" : ""} icon="users">
                {g === null ? "Alle" : `ab ${g}`}
              </Chip>
            </Pressable>
          ))}
        </ScrollView>

        {(start || ende) && (
          <Txt v="xs" soft>
            Zeitraum: {start ?? "—"} bis {ende ?? "—"}
          </Txt>
        )}
      </Col>

      {!items && !fehler && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && items.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {fehler ?? "Keine Unterkünfte gefunden."}
          </Txt>
        )}
        {items?.map((l) => (
          <Pressable
            key={l.id}
            onPress={() =>
              navigation.navigate("ListingDetail", {
                id: l.id,
                start,
                end: ende,
                guests: gaeste ?? undefined,
              })
            }
          >
            <ListingCard
              photo={l.photos[0]}
              grad="grad1"
              tag={listingTypeLabel(l.property_type)}
              title={l.title}
              place={listingOrt(l) || "—"}
              rating={l.rating}
              reviews={l.rating_count}
              price={l.price_from}
              currency={l.currency}
              guests={l.max_guests}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
