// Gäste · Wunschlisten (/api/v1/guest-wishlist). Echte Listen des angemeldeten
// Portal-Gastes; ohne Gast-Konto führt der Screen zur Anmeldung (die Listen
// hängen serverseitig an der guest_id, ohne Session gäbe es nur 401).
//
// Aufbau wie in den Marktplatz-Apps: große Überschrift, darunter die Listen
// als Zeilen mit Vorschau-Kachel; das Anlegen läuft über ein kleines Sheet
// statt über ein aufklappendes Feld mitten in der Seite.
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import {
  createWishlist,
  deleteWishlist,
  listWishlists,
  type WishlistSummary,
} from "@/lib/guestWishlist";
import { useRealtime } from "@/lib/realtime";
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
      // null, NICHT [] — eine leere Liste liest sich wie „keine Wunschlisten"
      // und wäre von echtem Leerstand nicht zu unterscheiden (Wurzel 4).
      setItems(null);
      setFehler(res.error);
    }
  }, [gastStatus]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Echtes Realtime mit dem GAST-JWT: die Policy wishlists_self
  // (portal_guest_id = auth.uid()) greift nur mit dem portal_guest-Token. Diese
  // App kennt seit ADR-0019 nur noch diese eine Auth-Welt — die Tokenquelle ist
  // in App.tsx registriert. Grant + Publikation kamen mit Migration 0235.
  useRealtime({
    table: "wishlists",
    enabled: gastStatus === "signedIn",
    onChange: load,
  });

  const anlegen = async () => {
    const wert = name.trim();
    if (busy || !wert) return; // Wurzel 2: kein doppeltes Anlegen
    setBusy(true);
    const res = await createWishlist(wert);
    if (res.ok) {
      setName("");
      setNeuOffen(false);
      // KEIN load(): das Realtime-Event auf wishlists zieht die Liste nach.
      // Zwei Reload-Pfade nebeneinander erzeugen Doppel-Zustände.
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
    // Erfolgsfall ohne load(): das DELETE-Event auf wishlists aktualisiert.
    setBusy(false);
  };

  if (gastStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (gastStatus !== "signedIn") {
    return (
      <GuestGate
        titel="Wunschlisten"
        hinweis="Mit einem Gast-Konto merkst du dir Unterkünfte und findest sie auf allen Geräten wieder."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 16,
          justifyContent: "space-between",
        }}
      >
        <Txt v="display">Wunschlisten</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Neue Wunschliste"
          onPress={() => setNeuOffen(true)}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="plus" s={24} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      {!items && !fehler && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {fehler && <EmptyState icon="info" titel="Nicht geladen" text={fehler} />}

        {items && items.length === 0 && !fehler && (
          <EmptyState
            icon="heart"
            titel="Noch keine Wunschliste"
            text="Tippe auf das Herz einer Unterkunft, um sie zu merken."
          >
            <Btn variant="dark" onPress={() => setNeuOffen(true)} style={{ marginTop: 6 }}>
              Liste anlegen
            </Btn>
          </EmptyState>
        )}

        {items?.map((w, i) => (
          <View key={w.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
            <Row gap={16} style={{ paddingVertical: 16 }}>
              <Pressable
                style={{ flex: 1 }}
                accessibilityRole="button"
                onPress={() => navigation.navigate("WishlistDetail", { id: w.id, name: w.name })}
              >
                <Row gap={16}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: t.radius.img,
                      backgroundColor: t.palette.surface2,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon n="heart" s={24} sw={1.8} c={t.palette.soft} />
                  </View>
                  <Col gap={3} style={{ flex: 1 }}>
                    <Txt v="title" numberOfLines={1}>
                      {w.name}
                    </Txt>
                    <Txt v="sm" soft>
                      {w.item_count} {w.item_count === 1 ? "gespeicherte Unterkunft" : "gespeicherte Unterkünfte"}
                    </Txt>
                  </Col>
                </Row>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${w.name} löschen`}
                onPress={() => loeschen(w.id)}
                hitSlop={10}
                style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon n="x" s={18} sw={1.9} c={t.palette.soft} />
              </Pressable>
            </Row>
          </View>
        ))}
      </ScrollView>

      <Sheet
        open={neuOffen}
        onClose={() => setNeuOffen(false)}
        header={<Txt v="h2">Neue Wunschliste</Txt>}
      >
        <Col gap={16} style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <TextInput
            value={name}
            onChangeText={(v) => setName(v.slice(0, 120))}
            placeholder="Name der Liste (z. B. Sommer 2027)"
            placeholderTextColor={t.palette.faint}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={anlegen}
            style={{
              borderWidth: 1,
              borderColor: t.palette.line,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 16,
              color: t.palette.ink,
              fontFamily: t.fonts.regular,
              fontSize: 16,
            }}
          />
          <Btn variant={name.trim() && !busy ? "primary" : "ghost"} block onPress={anlegen}>
            {busy ? "Wird angelegt …" : "Liste anlegen"}
          </Btn>
        </Col>
      </Sheet>
    </View>
  );
}
