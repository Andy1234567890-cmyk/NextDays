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

import { Card, Chip, Col, Progress, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
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
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <Txt v="h1">Aufgaben</Txt>
        {tabs.length > 1 && <Segmented options={tabs} value={tab} onChange={setTab} />}
      </Col>

      {loading && <Spinner />}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
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
      return (
        <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
          Keine Aufgaben zugewiesen.
        </Txt>
      );
    }
    return list.map((task) => (
      <Pressable key={task.id} onPress={() => navigation.navigate("TaskDetail", { id: task.id })}>
        <Card style={{ padding: 16, gap: 8 }}>
          <Row style={{ justifyContent: "space-between", gap: 8 }}>
            <Txt v="title" numberOfLines={2} style={{ flex: 1 }}>
              {task.title}
            </Txt>
            <Chip variant={task.status === "done" ? "accent" : ""}>
              {STATUS_LABEL[task.status]}
            </Chip>
          </Row>
          {task.needs_inspection && <Chip variant="ghost">QA-Freigabe nötig</Chip>}
        </Card>
      </Pressable>
    ));
  }

  function renderTeam(list: TaskListItem[]) {
    if (list.length === 0) {
      return (
        <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
          Keine Team-Aufgaben.
        </Txt>
      );
    }
    return list.map((task) => {
      const pct = task.checklist_total
        ? Math.round((task.checklist_done / task.checklist_total) * 100)
        : 0;
      const next = nextStatus(task.status);
      return (
        <Card key={task.id} style={{ padding: 16, gap: 10 }}>
          <Pressable onPress={() => navigation.navigate("TaskDetail", { id: task.id })}>
            <Row style={{ justifyContent: "space-between", gap: 8 }}>
              <Txt v="title" numberOfLines={2} style={{ flex: 1 }}>
                {task.title}
              </Txt>
              <Chip variant={task.status === "done" ? "accent" : ""}>
                {STATUS_LABEL[task.status]}
              </Chip>
            </Row>
          </Pressable>
          <Txt v="xs" soft numberOfLines={1}>
            {task.property_title ?? "—"}
            {task.assignee_name ? ` · ${task.assignee_name}` : ""}
          </Txt>
          {task.checklist_total > 0 && (
            <Col gap={4}>
              <Progress pct={pct} />
              <Txt v="xs" faint>
                {task.checklist_done}/{task.checklist_total} erledigt
              </Txt>
            </Col>
          )}
          {next && (
            <Pressable
              onPress={() => advance(task)}
              disabled={busyId !== null}
              style={{
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: t.palette.line,
                alignItems: "center",
                opacity: busyId === task.id ? 0.5 : 1,
              }}
            >
              <Txt v="sm" accent>
                {busyId === task.id ? "…" : `→ ${STATUS_LABEL[next]}`}
              </Txt>
            </Pressable>
          )}
        </Card>
      );
    });
  }
}
