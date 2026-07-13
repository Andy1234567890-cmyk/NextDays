// Eigentümer · Meine Objekte. Zeigt AUSSCHLIESSLICH die diesem Owner
// zugeordneten Objekte (Server erzwingt den Scope über
// owner_property_assignments; die App zeigt nur, was sie bekommt). Realtime:
// owner_properties (Zuordnungsänderung) + properties (Stammdaten) — RLS filtert
// die Events serverseitig auf den Owner (Migration 0059 + Publication).
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
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
      setItems([]);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({ table: "owner_properties", onChange: load });
  useRealtime({ table: "properties", onChange: load });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Txt v="h1">Meine Objekte</Txt>
      </Col>

      {!items && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && items.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {error ?? "Dir sind noch keine Objekte zugeordnet."}
          </Txt>
        )}
        {items && items.length > 0 && (
          <Card style={{ padding: 6 }}>
            {items.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
                  <Avatar s={48} src={p.photo ?? undefined} icon="home" />
                  <Col gap={2} style={{ flex: 1 }}>
                    <Txt v="sm" numberOfLines={1} style={{ fontWeight: "600" }}>
                      {p.title}
                    </Txt>
                    {p.city && (
                      <Txt v="xs" soft numberOfLines={1}>
                        {p.city}
                      </Txt>
                    )}
                  </Col>
                </Row>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
