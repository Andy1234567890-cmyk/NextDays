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
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Chip, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
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
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 14,
          justifyContent: "space-between",
        }}
      >
        <Col gap={2}>
          <Txt v="h1">Inserate</Txt>
          <Txt v="sm" soft>
            {untertitel}
          </Txt>
        </Col>
        <Btn variant="primary" icon="plus" style={{ paddingVertical: 11, paddingHorizontal: 15 }}>
          Neu
        </Btn>
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {!items && !error && <Spinner />}

        {error && (
          <Card style={{ padding: 16, gap: 12 }}>
            <Txt v="title">Objekte nicht geladen</Txt>
            <Txt v="sm" soft>
              {error}
            </Txt>
            <Btn variant="outline" onPress={load}>
              Erneut versuchen
            </Btn>
          </Card>
        )}

        {items?.length === 0 && (
          <Card style={{ padding: 16, gap: 6 }}>
            <Txt v="title">Noch kein Objekt</Txt>
            <Txt v="sm" soft>
              Lege dein erstes Objekt an — eine buchbare Einheit, also ein Zimmer oder ein
              Ferienobjekt.
            </Txt>
          </Card>
        )}

        {items?.map((p) => (
          <Card key={p.id} style={{ overflow: "hidden" }}>
            <Photo src={p.photos?.[0]} grad="grad1" h={130}>
              <Chip
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  backgroundColor: p.status === "active" ? t.palette.accent : "rgba(0,0,0,0.55)",
                }}
                textColor="#fff"
              >
                {p.status === "active" ? "● Live" : p.status === "draft" ? "Entwurf" : "Inaktiv"}
              </Chip>
            </Photo>
            <Col style={{ padding: 16, gap: 12 }}>
              <Col gap={2}>
                <Txt v="title" numberOfLines={1}>
                  {p.title}
                </Txt>
                <Txt v="xs" soft numberOfLines={1}>
                  {[propertyTypeLabel(p.property_type), p.city].filter(Boolean).join(" · ")}
                </Txt>
              </Col>

              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                {p.channels ? (
                  <Row gap={8}>
                    {(["website", "marketplace", "portals"] as ChannelKey[]).map((k) => (
                      <ChannelDot key={k} label={CHANNEL_LABEL[k]} state={p.channels![k]} />
                    ))}
                  </Row>
                ) : (
                  <View />
                )}
                <Btn variant="ghost" iconR="fwd" style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
                  Verwalten
                </Btn>
              </Row>
            </Col>
          </Card>
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
