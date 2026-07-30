// Aufgaben. Zwei Sichten je nach Berechtigung (lib/permissions.can):
//   - VIEW_OWN_TASKS (staff/cleaner): „Meine Aufgaben" (/tasks/mine)
//   - MANAGE_TASKS  (admin/co_admin): zusätzlich „Team" (/tasks/team) mit
//     Status-Wechsel (PATCH). Der cleaner sieht den Status-Wechsler NICHT —
//     Status ändern erfordert MANAGE_TASKS; eigene Aufgaben schließt er im
//     Detail ab (/complete).
// TaskListItem trägt KEINE Gast-PII/Beträge (§4.3). Statuswechsel ist gegen
// Doppel-Tap gesperrt (Wurzel 2).
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, Col, Progress, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import {
  listMyTasks,
  listTeamTasks,
  setTaskStatus,
  type Task,
  type TaskListItem,
  type TaskStatus,
} from "@/lib/tasks";
import { useTheme } from "@/theme/ThemeProvider";

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

// Nächster Status im Lebenszyklus (nur MANAGE_TASKS). null = kein Weiter.
function nextStatus(s: TaskStatus): TaskStatus | null {
  if (s === "open") return "in_progress";
  if (s === "in_progress") return "done";
  return null;
}

export default function HostTasks({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const canManage = can(me, "manage_tasks");

  // Nur Verwalter sehen den „Team"-Tab.
  const tabs = canManage ? ["Meine", "Team"] : ["Meine"];
  const [tab, setTab] = useState(0);
  const [mine, setMine] = useState<Task[] | null>(null);
  const [team, setTeam] = useState<TaskListItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const my = await listMyTasks();
    setMine(my.ok ? my.data : []);
    if (canManage) {
      const tm = await listTeamTasks();
      setTeam(tm.ok ? tm.data : []);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // tasks speist beide Listen (eigene + Team). RLS begrenzt auf den Tenant und
  // — für Mitarbeiter — auf die eigenen Zuweisungen.
  useRealtime({ table: "tasks", onChange: load });

  const advance = async (task: TaskListItem) => {
    const next = nextStatus(task.status);
    if (!next || busyId) return; // Doppel-Tap-Sperre (Wurzel 2)
    setBusyId(task.id);
    const res = await setTaskStatus(task.id, next);
    setBusyId(null);
    if (res.ok) load();
  };

  const showTeam = canManage && tab === 1;
  const loading = showTeam ? team === null : mine === null;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 16 }}>
        <Txt v="display">Aufgaben</Txt>
        {tabs.length > 1 && (
          <Row gap={8}>
            {tabs.map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: i === tab }}
                onPress={() => setTab(i)}
              >
                <Chip variant={i === tab ? "on" : ""}>{label}</Chip>
              </Pressable>
            ))}
          </Row>
        )}
      </Col>

      {loading && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 0 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {showTeam
          ? renderTeam(team ?? [])
          : renderMine(mine ?? [])}
      </ScrollView>
    </View>
  );

  function renderMine(list: Task[]) {
    if (list.length === 0) {
      return <EmptyState icon="check" titel="Nichts offen" text="Dir ist gerade keine Aufgabe zugewiesen." />;
    }
    return list.map((task, i) => (
      <Pressable
        key={task.id}
        accessibilityRole="button"
        onPress={() => navigation.navigate("TaskDetail", { id: task.id })}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
        <Row style={{ paddingVertical: 16, gap: 12, alignItems: "flex-start" }}>
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={2}>
              {task.title}
            </Txt>
            {task.needs_inspection && (
              <Txt v="sm" soft>
                QA-Freigabe nötig
              </Txt>
            )}
          </Col>
          <Chip variant={task.status === "done" ? "on" : ""}>{STATUS_LABEL[task.status]}</Chip>
        </Row>
      </Pressable>
    ));
  }

  function renderTeam(list: TaskListItem[]) {
    if (list.length === 0) {
      return <EmptyState icon="list" titel="Keine Team-Aufgaben" text="Es liegt gerade nichts an." />;
    }
    return list.map((task, i) => {
      const pct = task.checklist_total
        ? Math.round((task.checklist_done / task.checklist_total) * 100)
        : 0;
      const next = nextStatus(task.status);
      return (
        <View key={task.id}>
          {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
          <Col gap={10} style={{ paddingVertical: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("TaskDetail", { id: task.id })}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Row style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <Col gap={3} style={{ flex: 1 }}>
                  <Txt v="title" numberOfLines={2}>
                    {task.title}
                  </Txt>
                  <Txt v="sm" soft numberOfLines={1}>
                    {task.property_title ?? "—"}
                    {task.assignee_name ? ` · ${task.assignee_name}` : ""}
                  </Txt>
                </Col>
                <Chip variant={task.status === "done" ? "on" : ""}>
                  {STATUS_LABEL[task.status]}
                </Chip>
              </Row>
            </Pressable>

            {task.checklist_total > 0 && (
              <Col gap={5}>
                <Progress pct={pct} />
                <Txt v="xs" soft>
                  {task.checklist_done}/{task.checklist_total} erledigt
                </Txt>
              </Col>
            )}

            {next && (
              <Pressable
                accessibilityRole="button"
                onPress={() => advance(task)}
                disabled={busyId !== null}
                style={{
                  paddingVertical: 11,
                  borderRadius: t.radius.pill,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  alignItems: "center",
                  opacity: busyId === task.id ? 0.5 : 1,
                }}
              >
                <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                  {busyId === task.id ? "…" : `Weiter zu „${STATUS_LABEL[next]}“`}
                </Txt>
              </Pressable>
            )}
          </Col>
        </View>
      );
    });
  }
}
