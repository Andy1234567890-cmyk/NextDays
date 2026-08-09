// Eigentümer · Meine Objekte. Zeigt AUSSCHLIESSLICH die diesem Owner
// zugeordneten Objekte (Server erzwingt den Scope über
// owner_property_assignments; die App zeigt nur, was sie bekommt). Realtime nur
// noch auf `properties` (Stammdaten) — RLS filtert die Events serverseitig auf
// den Owner. Die Zuordnungsänderung selbst läuft seit Migration 0337 nicht mehr
// live; Begründung an der Stelle des ehemaligen Abos.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { getOwnerProperties, type PortalProperty } from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

export default function OwnerProperties() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        <Txt v="display">Meine Objekte</Txt>
      </Col>

      {!items && !error && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
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
            </Row>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
