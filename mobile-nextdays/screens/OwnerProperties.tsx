// Eigentümer · Meine Objekte. Zeigt AUSSCHLIESSLICH die diesem Owner
// zugeordneten Objekte (Server erzwingt den Scope über
// owner_property_assignments; die App zeigt nur, was sie bekommt). Realtime nur
// noch auf `properties` (Stammdaten) — RLS filtert die Events serverseitig auf
// den Owner. Die Zuordnungsänderung selbst läuft seit Migration 0337 nicht mehr
// live; Begründung an der Stelle des ehemaligen Abos.
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Avatar, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { ownerFlaechenFor } from "@/lib/owner-flaechen";
import { getOwnerProperties, type PortalProperty } from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

export default function OwnerProperties({ navigation }: { navigation: any }) {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  // Objektbereich und Fotoalbum sind zwei EIGENE Rechte: ohne
  // `pm_property_area` bleibt die Zeile eine reine Anzeige (kein toter Tipp
  // auf einen Screen, den der Server mit 403 beantwortet), ohne
  // `pm_photo_album` fehlt der Album-Knopf.
  const flaechen = ownerFlaechenFor(me);
  const [items, setItems] = useState<PortalProperty[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getOwnerProperties();
    if (res.ok) {
      setItems(res.data.items);
      setError(null);
    } else {
      setItems(null);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // `owner_properties` (die Zuordnung Eigentümer→Objekt) ist seit Migration 0337
  // für `authenticated` gesperrt (Wurzel 6: revoke + raus aus der Publikation
  // supabase_realtime) — das Abo verband sauber und bekam nie ein Event. Eine
  // Ersatzquelle gibt es nicht: die Zuordnung ändert allein eine
  // Verwaltungs-Aktion, und `properties` unten deckt nur die STAMMDATEN der
  // bereits zugeordneten Objekte ab, nicht die Zuordnung selbst. Ehrlich: wird
  // dem Eigentümer ein Objekt neu zugeordnet oder entzogen, ändert sich diese
  // Liste nicht mehr von selbst — sichtbar erst beim Öffnen des Tabs oder per
  // Zug-zum-Aktualisieren.
  useRealtime({ table: "properties", onChange: load });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row
        gap={12}
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 16,
          alignItems: "center",
        }}
      >
        <Txt v="display" style={{ flex: 1 }}>
          Meine Objekte
        </Txt>
        {flaechen.fotoalbum && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotoalbum öffnen"
            onPress={() => navigation.navigate("OwnerPhotoAlbum")}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.palette.surface2,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon n="cam" s={19} sw={1.8} c={t.palette.ink} />
          </Pressable>
        )}
      </Row>

      {!items && !error && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: unterkante + 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && items.length === 0 && (
          <EmptyState
            icon={error ? "info" : "home"}
            titel={error ? "Nicht geladen" : "Keine Objekte"}
            text={error ?? "Dir sind noch keine Objekte zugeordnet."}
          />
        )}
        {items?.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
            <Pressable
              accessibilityRole={flaechen.objektbereich ? "button" : "text"}
              accessibilityLabel={flaechen.objektbereich ? `${p.title} öffnen` : p.title}
              disabled={!flaechen.objektbereich}
              onPress={() => navigation.navigate("OwnerPropertyDetail", { id: p.id })}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Row gap={14} style={{ paddingVertical: 14 }}>
                <Avatar s={56} src={p.photo ?? undefined} icon="home" />
                <Col gap={3} style={{ flex: 1, justifyContent: "center" }}>
                  <Txt v="title" numberOfLines={1}>
                    {p.title}
                  </Txt>
                  {p.city && (
                    <Txt v="sm" soft numberOfLines={1}>
                      {p.city}
                    </Txt>
                  )}
                </Col>
                {flaechen.objektbereich && (
                  <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
                )}
              </Row>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
