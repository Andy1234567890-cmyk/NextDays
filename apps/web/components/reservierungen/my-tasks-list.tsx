"use client";

// „Meine Aufgaben"-Reiter der PM-Fläche: die dem angemeldeten Nutzer
// zugewiesenen Aufgaben (echte Daten, live über useRealtime auf tasks).
// Status umschaltbar; ehrlicher Leerzustand statt Fake.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import {
  type Task,
  type TaskStatus,
  listMyTasks,
  setTaskStatus,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

export function MyTasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await listMyTasks();
    if (res.ok) setTasks(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "tasks", onChange: load });

  const toggle = async (t: Task) => {
    const next: TaskStatus = t.status === "done" ? "open" : "done";
    const res = await setTaskStatus(t.id, next);
    if (!res.ok) toast.error(res.error);
    else load();
  };

  const fmtDue = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("de-DE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Aufgaben</h1>
        {tasks.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {tasks.filter((t) => t.status === "done").length}/{tasks.length} erledigt
          </span>
        )}
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt…</p>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ihnen sind aktuell keine Aufgaben zugewiesen.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => {
              const done = t.status === "done";
              const due = fmtDue(t.due_at);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="flex w-full items-center gap-2.5 rounded-(--radius) border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40"
                  >
                    <Icon
                      icon={done ? "ph:check-circle-fill" : "ph:circle"}
                      className={"size-5 shrink-0 " + (done ? "text-success" : "text-muted-foreground")}
                    />
                    <span className={"min-w-0 flex-1 truncate " + (done ? "text-muted-foreground line-through" : "")}>
                      {t.title}
                    </span>
                    {due && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        fällig {due}
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[t.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
