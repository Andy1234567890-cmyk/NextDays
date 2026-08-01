// Aufgaben-Detail. Zeigt die Checkliste (Räume, Foto-Pflicht-Marker, erledigt).
// Der Zuständige kann die Aufgabe abschließen (/complete); Foto-Pflicht wird
// serverseitig erzwungen (422). KEINE Gast-PII/Beträge (§4.3). Abschluss-Button
// gegen Doppel-Tap gesperrt (Wurzel 2).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Chip, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
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
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        <EmptyState icon="info" titel="Nicht gefunden" text="Diese Aufgabe gibt es nicht (mehr)." />
      </View>
    );
  }

  const done = detail.status === "done";

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8, justifyContent: "space-between" }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
        <Chip variant={done ? "on" : ""}>{done ? "Erledigt" : "Offen"}</Chip>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, gap: 22 }}>
        <Col gap={6}>
          <Txt v="display">{detail.title}</Txt>
          {detail.property_title && (
            <Txt v="body" soft>
              {detail.property_title}
            </Txt>
          )}
          {detail.needs_inspection && (
            <Txt v="sm" soft>
              Nach Abschluss ist eine QA-Freigabe nötig.
            </Txt>
          )}
        </Col>

        {detail.checklist.length > 0 && (
          <>
            <View style={{ height: 1, backgroundColor: t.palette.line }} />
            <Col gap={12}>
              <Txt v="h2">Checkliste</Txt>
              <Col gap={0}>
                {detail.checklist.map((item, i) => (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
                    <Row gap={12} style={{ paddingVertical: 14, alignItems: "center" }}>
                      <Icon
                        n={item.done ? "check" : "dot"}
                        s={19}
                        sw={2}
                        c={item.done ? t.palette.ink : t.palette.faint}
                      />
                      <Col gap={2} style={{ flex: 1 }}>
                        <Txt v="title">{item.label}</Txt>
                        {item.room && (
                          <Txt v="sm" soft>
                            {item.room}
                          </Txt>
                        )}
                      </Col>
                      {item.requires_photo && (
                        <Chip>{item.photos.length > 0 ? `${item.photos.length} Fotos` : "Foto nötig"}</Chip>
                      )}
                    </Row>
                  </View>
                ))}
              </Col>
            </Col>
          </>
        )}
      </ScrollView>

      {!done && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: t.palette.surface,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
          }}
        >
          <Btn variant="dark" block onPress={saving ? undefined : complete}>
            {saving ? "Wird abgeschlossen …" : "Aufgabe abschließen"}
          </Btn>
        </View>
      )}
    </View>
  );
}

function ZurueckKnopf({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon n="back" s={22} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}
