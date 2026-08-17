// Aufgaben-Detail. Zeigt die Checkliste (Räume, Foto-Pflicht-Marker, erledigt).
// Der Zuständige kann die Aufgabe abschließen (/complete); Foto-Pflicht wird
// serverseitig erzwungen (422). KEINE Gast-PII/Beträge (§4.3). Abschluss-Button
// gegen Doppel-Tap gesperrt (Wurzel 2).
//
// Wer VERTEILT (manage_tasks), kann den Zuständigen hier auch wechseln. Für
// die Reinigungskraft bleibt die Zeile reine Anzeige: ihr Weg aus einer
// Aufgabe ist die Vertretungsanfrage, nicht das Umhängen an einen Kollegen.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Chip, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import {
  completeTask,
  getTaskDetail,
  listTaskAssignees,
  mitarbeiterOptionen,
  setTaskAssignee,
  type TaskDetail as Detail,
} from "@/lib/tasks";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function TaskDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TaskDetail">>();
  const { id } = route.params;

  const { me } = useAuth();
  const darfZuweisen = can(me, "manage_tasks");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leute, setLeute] = useState<{ value: string; label: string }[]>([]);
  const [auswahlOffen, setAuswahlOffen] = useState(false);

  const load = useCallback(async () => {
    const res = await getTaskDetail(id);
    if (res.ok) setDetail(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Die Auswahlliste holt nur, wer sie braucht: ohne `manage_tasks` wäre es
  // eine Namensliste des Betriebs ohne Zweck (§4.3).
  useEffect(() => {
    if (!darfZuweisen) return;
    listTaskAssignees().then((r) => {
      if (r.ok) setLeute(mitarbeiterOptionen(r.data));
    });
  }, [darfZuweisen]);

  // Genau diese Aufgabe: ändert ein Kollege Status oder Zuweisung, zieht die
  // Ansicht nach, ohne dass der Nutzer zurück und wieder hinein muss.
  useRealtime({ table: "tasks", filter: `id=eq.${id}`, onChange: load });

  // Ein Sheet, KEIN `Alert.alert` mit einem Button je Person: die
  // React-Native-Bridge unterstützt auf Android nur drei Buttons
  // (neutral/negative/positive) und verwirft alles darüber stillschweigend.
  // Bei 25 Mitarbeitern sähe ein Android-Nutzer drei Namen und weder
  // „Niemand" noch „Abbrechen" — auf iOS stapelt der Alert bei so vielen
  // Einträgen zwar, wird aber unbedienbar. Das Sheet gibt es bereits
  // (`components/ui/patterns`), es scrollt und trägt beliebig viele Zeilen.
  const setzeZustaendigen = async (neu: string | null) => {
    setAuswahlOffen(false);
    setSaving(true);
    const res = await setTaskAssignee(id, neu);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Zuweisung nicht möglich", res.error);
      return;
    }
    setDetail(res.data);
  };

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
          {darfZuweisen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zuständige Person ändern"
              onPress={() => setAuswahlOffen(true)}
              disabled={saving}
              style={({ pressed }) => ({
                marginTop: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.palette.line,
                alignSelf: "flex-start",
                opacity: pressed || saving ? 0.6 : 1,
              })}
            >
              <Row gap={8} style={{ alignItems: "center" }}>
                <Icon n="user" s={16} sw={2} c={t.palette.ink} />
                <Txt v="sm">{detail.assignee_name ?? "Niemand zugewiesen"}</Txt>
              </Row>
            </Pressable>
          ) : (
            detail.assignee_name && (
              <Txt v="sm" soft>
                Zuständig: {detail.assignee_name}
              </Txt>
            )
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

      <Sheet
        open={auswahlOffen}
        onClose={() => setAuswahlOffen(false)}
        header={<Txt v="h2">Zuständig</Txt>}
      >
        <Col gap={0}>
          {leute.map((u) => (
            <Pressable
              key={u.value}
              accessibilityRole="button"
              onPress={() => setzeZustaendigen(u.value)}
              style={({ pressed }) => ({
                paddingVertical: 15,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Row gap={10} style={{ alignItems: "center" }}>
                <Icon
                  n={detail.assignee_id === u.value ? "check" : "dot"}
                  s={18}
                  sw={2}
                  c={
                    detail.assignee_id === u.value
                      ? t.palette.ink
                      : t.palette.faint
                  }
                />
                <Txt v="title">{u.label}</Txt>
              </Row>
            </Pressable>
          ))}
          <View style={{ height: 1, backgroundColor: t.palette.line }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setzeZustaendigen(null)}
            style={({ pressed }) => ({
              paddingVertical: 15,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt v="title" soft>
              Niemand zuweisen
            </Txt>
          </Pressable>
        </Col>
      </Sheet>

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
