// Aufgaben-Detail. Zeigt die Checkliste (Räume, Foto-Pflicht-Marker, erledigt).
// Der Zuständige kann die Aufgabe abschließen (/complete); Foto-Pflicht wird
// serverseitig erzwungen (422). KEINE Gast-PII/Beträge (§4.3). Abschluss-Button
// gegen Doppel-Tap gesperrt (Wurzel 2).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, Divider, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
import { useRealtime } from "@/lib/realtime";
import { completeTask, getTaskDetail, type TaskDetail as Detail } from "@/lib/tasks";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function TaskDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TaskDetail">>();
  const { id } = route.params;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await getTaskDetail(id);
    if (res.ok) setDetail(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Genau diese Aufgabe: ändert ein Kollege Status oder Zuweisung, zieht die
  // Ansicht nach, ohne dass der Nutzer zurück und wieder hinein muss.
  useRealtime({ table: "tasks", filter: `id=eq.${id}`, onChange: load });

  const complete = async () => {
    if (saving) return; // Doppel-Tap-Sperre
    setSaving(true);
    const res = await completeTask(id);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Abschluss nicht möglich", res.error);
      return;
    }
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 20, paddingHorizontal: 20, gap: 16 }}>
        <IconBtn icon="back" onPress={() => navigation.goBack()} />
        <Txt v="sm" soft>
          Aufgabe nicht gefunden.
        </Txt>
      </View>
    );
  }

  const done = detail.status === "done";

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <IconBtn icon="back" onPress={() => navigation.goBack()} />
          <Chip variant={done ? "accent" : ""}>{done ? "Erledigt" : "Offen"}</Chip>
        </Row>

        <Col gap={4}>
          <Txt v="h1">{detail.title}</Txt>
          {detail.property_title && (
            <Txt v="sm" soft>
              {detail.property_title}
            </Txt>
          )}
        </Col>

        {detail.needs_inspection && <Chip variant="ghost">Nach Abschluss QA-Freigabe nötig</Chip>}

        {detail.checklist.length > 0 && (
          <Card style={{ padding: 4 }}>
            {detail.checklist.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                <Row style={{ padding: 12, gap: 10, alignItems: "center" }}>
                  <Icon
                    n={item.done ? "check" : "dot"}
                    s={18}
                    c={item.done ? t.palette.accent : t.palette.faint}
                  />
                  <Col gap={1} style={{ flex: 1 }}>
                    <Txt v="sm" style={{ fontWeight: "600" }}>
                      {item.label}
                    </Txt>
                    {item.room && (
                      <Txt v="xs" soft>
                        {item.room}
                      </Txt>
                    )}
                  </Col>
                  {item.requires_photo && (
                    <Chip variant="ghost" icon="sparkle">
                      {item.photos.length > 0 ? `${item.photos.length}` : "Foto"}
                    </Chip>
                  )}
                </Row>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {!done && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 20,
            paddingBottom: insets.bottom + 16,
            backgroundColor: t.palette.surface,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
          }}
        >
          <Btn variant="primary" block icon="check" onPress={saving ? undefined : complete}>
            {saving ? "Wird abgeschlossen …" : "Aufgabe abschließen"}
          </Btn>
        </View>
      )}
    </View>
  );
}
