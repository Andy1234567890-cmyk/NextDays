// Gäste · Merklisten (/api/v1/guest-wishlist). Echte Listen des angemeldeten
// Portal-Gastes; ohne Gast-Konto führt der Screen zur Anmeldung (die Listen
// hängen serverseitig an der guest_id, ohne Session gäbe es nur 401).
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import {
  createWishlist,
  deleteWishlist,
  listWishlists,
  type WishlistSummary,
} from "@/lib/guestWishlist";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestWishlist() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status: gastStatus } = useGuestAuth();

  const [items, setItems] = useState<WishlistSummary[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (gastStatus !== "signedIn") return;
    const res = await listWishlists();
    if (res.ok) {
      setItems(res.data.items);
      setFehler(null);
    } else {
      setItems([]);
      setFehler(res.error);
    }
  }, [gastStatus]);

  // Beim Zurückkehren neu laden (z. B. nachdem im Detail ein Objekt gemerkt
  // wurde). Realtime scheidet hier aus: wishlists/wishlist_items sind NICHT in
  // der Realtime-Publication — es kämen schlicht keine Events.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const anlegen = async () => {
    const wert = name.trim();
    if (busy || !wert) return; // Wurzel 2: kein doppeltes Anlegen
    setBusy(true);
    const res = await createWishlist(wert);
    if (res.ok) {
      setName("");
      setNeuOffen(false);
      await load();
    } else {
      setFehler(res.error);
    }
    setBusy(false);
  };

  const loeschen = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const res = await deleteWishlist(id);
    if (!res.ok) setFehler(res.error);
    await load();
    setBusy(false);
  };

  if (gastStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (gastStatus !== "signedIn") {
    return (
      <GuestGate
        icon="heart"
        titel="Merkliste"
        hinweis="Mit einem Gast-Konto merkst du dir Unterkünfte und findest sie auf allen Geräten wieder."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row
        style={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Txt v="h1">Merklisten</Txt>
        <Pressable onPress={() => setNeuOffen((o) => !o)} hitSlop={10}>
          <Icon n={neuOffen ? "x" : "plus"} s={22} sw={2} c={t.palette.accent} />
        </Pressable>
      </Row>

      {neuOffen && (
        <Col style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
          <TextInput
            value={name}
            onChangeText={(v) => setName(v.slice(0, 120))}
            placeholder="Name der Liste (z. B. Sommer 2027)"
            placeholderTextColor={t.palette.faint}
            style={{
              borderWidth: 1,
              borderColor: t.palette.line,
              borderRadius: t.radius.btn,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.palette.ink,
              fontFamily: t.type.medium.fontFamily,
            }}
          />
          <Btn variant="primary" block onPress={anlegen}>
            {busy ? "Wird angelegt …" : "Liste anlegen"}
          </Btn>
        </Col>
      )}

      {!items && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && items.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {fehler ?? "Noch keine Merkliste. Tippe oben auf +, um eine anzulegen."}
          </Txt>
        )}
        {items && items.length > 0 && (
          <Card style={{ padding: 6 }}>
            {items.map((w, i) => (
              <View key={w.id}>
                {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                <Row style={{ padding: 14, gap: 12, alignItems: "center" }}>
                  <Icon n="heart" s={20} c={t.palette.accent} />
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => navigation.navigate("WishlistDetail", { id: w.id, name: w.name })}
                  >
                    <Col gap={2}>
                      <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                        {w.name}
                      </Txt>
                      <Txt v="xs" soft>
                        {w.item_count} {w.item_count === 1 ? "Objekt" : "Objekte"}
                      </Txt>
                    </Col>
                  </Pressable>
                  <Pressable onPress={() => loeschen(w.id)} hitSlop={10}>
                    <Icon n="x" s={18} c={t.palette.soft} />
                  </Pressable>
                </Row>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
