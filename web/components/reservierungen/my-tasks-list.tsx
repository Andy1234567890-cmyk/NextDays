"use client";

// „Meine Aufgaben"-Reiter der PM-Fläche: die dem angemeldeten Nutzer
// zugewiesenen Aufgaben (echte Daten, live über useRealtime auf tasks).
// Status umschaltbar; ehrlicher Leerzustand statt Fake.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@nextdays/ui/card";
import {
  type Task,
  type TaskStatus,
  listMyTasks,
  setTaskStatus,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function MyTasksList() {
  const t = useTranslations("reservations");
  const STATUS_LABEL: Record<TaskStatus, string> = {
    open: t("myTasksList.statusOpen"),
    in_progress: t("myTasksList.statusInProgress"),
    done: t("myTasksList.statusDone"),
    cancelled: t("myTasksList.statusCancelled"),
  };
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

  const toggle = async (task: Task) => {
    const next: TaskStatus = task.status === "done" ? "open" : "done";
    const res = await setTaskStatus(task.id, next);
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
        <h1 className="font-display text-2xl font-extrabold">{t("myTasksList.title")}</h1>
        {tasks.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("myTasksList.doneCount", {
              done: tasks.filter((task) => task.status === "done").length,
              total: tasks.length,
            })}
          </span>
        )}
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("myTasksList.loading")}</p>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("myTasksList.emptyState")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => {
              const done = task.status === "done";
              const due = fmtDue(task.due_at);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => toggle(task)}
                    className="flex w-full items-center gap-2.5 rounded-(--radius) border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40"
                  >
                    <Icon
                      icon={done ? "ph:check-circle-fill" : "ph:circle"}
                      className={"size-5 shrink-0 " + (done ? "text-success" : "text-muted-foreground")}
                    />
                    <span className={"min-w-0 flex-1 truncate " + (done ? "text-muted-foreground line-through" : "")}>
                      {task.title}
                    </span>
                    {due && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("myTasksList.dueOn", { date: due })}
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[task.status]}
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
