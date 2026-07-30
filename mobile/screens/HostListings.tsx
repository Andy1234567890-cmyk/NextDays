// Gastgeber · Inserate: die echten Objekte des Betriebs aus dem FastAPI-
// properties-Slice. Lade-/Fehler-/Leerzustand getrennt — KEINE Demo-Objekte:
// ein „0 %"-Wert oder ein Beispielobjekt ist von echten Daten nicht zu
// unterscheiden (Wurzel 4).
//
// Angezeigt wird nur, was der Server wirklich liefert: Lebenszyklus-Status,
// Objekttyp, Ort und die drei Vertriebskanal-Chips (Ebene B) — dieselbe
// Aufteilung wie die Objektliste im Web (web/components/objekte/objects-list.tsx).
// Bewertung und Belegung gibt es auf dem Host-Pfad NICHT, also stehen sie hier
// auch nicht als Strich oder Null — sie fehlen einfach.
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import {
  listProperties,
  propertyTypeLabel,
  type ChannelState,
  type Property,
} from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

type ChannelKey = "website" | "marketplace" | "portals";

// Kundentext: nie „Channex" — die OTAs heißen „Portale".
const CHANNEL_LABEL: Record<ChannelKey, string> = {
  website: "Website",
  marketplace: "Plattform",
  portals: "Portale",
};

export default function Listings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listProperties();
    if (res.ok) {
      setItems(res.data.items);
      setError(null);
    } else {
      // Fehler bleibt Fehler: keine Ersatzliste, die wie echter Bestand aussieht.
      setItems(null);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // properties speist diese Liste (Status, Kanal-Sichtbarkeit, Fotos).
  useRealtime({ table: "properties", onChange: load });

  const untertitel = error
    ? "nicht geladen"
    : items
      ? `${items.length} ${items.length === 1 ? "Objekt" : "Objekte"}`
      : "lädt …";

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 16,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Col gap={4} style={{ flex: 1 }}>
          <Txt v="display">Inserate</Txt>
          <Txt v="body" soft>
            {untertitel}
          </Txt>
        </Col>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Neues Objekt"
          hitSlop={10}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="plus" s={24} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {!items && !error && <Spinner />}

        {error && (
          <EmptyState icon="info" titel="Objekte nicht geladen" text={error}>
            <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
              Erneut versuchen
            </Btn>
          </EmptyState>
        )}

        {items?.length === 0 && (
          <EmptyState
            icon="home"
            titel="Noch kein Objekt"
            text="Lege dein erstes Objekt an — eine buchbare Einheit, also ein Zimmer oder ein Ferienobjekt."
          />
        )}

        {items?.map((p) => (
          <Col key={p.id} gap={12}>
            <Photo src={p.photos?.[0]} grad="grad1" r={t.radius.img} style={{ aspectRatio: 16 / 10 }}>
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.pill,
                  backgroundColor: "rgba(255,255,255,0.95)",
                }}
              >
                <Txt v="xs" color="#181614" style={{ fontFamily: t.fonts.semibold }}>
                  {p.status === "active" ? "Live" : p.status === "draft" ? "Entwurf" : "Inaktiv"}
                </Txt>
              </View>
            </Photo>

            <Col gap={3}>
              <Txt v="title" numberOfLines={1}>
                {p.title}
              </Txt>
              <Txt v="sm" soft numberOfLines={1}>
                {[propertyTypeLabel(p.property_type), p.city].filter(Boolean).join(" · ")}
              </Txt>
            </Col>

            {p.channels && (
              <Row gap={14}>
                {(["website", "marketplace", "portals"] as ChannelKey[]).map((k) => (
                  <ChannelDot key={k} label={CHANNEL_LABEL[k]} state={p.channels![k]} />
                ))}
              </Row>
            )}
          </Col>
        ))}
      </ScrollView>
    </View>
  );
}

// Ampel je Kanal. paused/not_connected sind neutral (kein Alarm, Nutzer-Wille
// bzw. schlicht nicht eingerichtet), nur error ist rot — bewusst getrennt.
function ChannelDot({ label, state }: { label: string; state: ChannelState }) {
  const t = useTheme();
  const farbe: Record<ChannelState, string> = {
    active: "#10B981",
    paused: t.palette.soft,
    not_connected: t.palette.faint,
    error: "#DC2626",
  };
  return (
    <Row gap={4} style={{ alignItems: "center" }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: farbe[state] }}
      />
      <Txt v="xs" soft>
        {label}
      </Txt>
    </Row>
  );
}
