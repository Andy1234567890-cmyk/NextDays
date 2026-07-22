"use client";

// Aufgaben-Box der PM-Buchungsdetailseite (.. „Aufgaben"). Listet die
// Aufgaben zu genau dieser Buchung, erlaubt Status-Umschalten (erledigt/offen)
// und das Erzeugen der Standard-Aufgaben (Anreise-Check + Endreinigung). Live
// über useRealtime auf der tasks-Tabelle (Pflicht, kein Polling). Zeigt echte
// Daten oder einen ehrlichen Leerzustand — kein Fake.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  type Task,
  type TaskStatus,
  generateBookingTasks,
  listBookingTasks,
  setTaskStatus,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

function useStatusLabels(): Record<TaskStatus, string> {
  const t = useTranslations("reservations");
  return {
    open: t("bookingTasksSection.statusOpen"),
    in_progress: t("bookingTasksSection.statusInProgress"),
    done: t("bookingTasksSection.statusDone"),
    cancelled: t("bookingTasksSection.statusCancelled"),
  };
}

export function BookingTasksSection({
  reservationId,
  propertyId,
  checkIn,
  checkOut,
}: {
  reservationId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
}) {
  const t = useTranslations("reservations");
  const statusLabel = useStatusLabels();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await listBookingTasks(reservationId);
    if (res.ok) setTasks(res.data);
    setLoading(false);
  }, [reservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "tasks",
    filter: `reservation_id=eq.${reservationId}`,
    onChange: load,
  });

  const toggle = async (task: Task) => {
    const next: TaskStatus = task.status === "done" ? "open" : "done";
    const res = await setTaskStatus(task.id, next);
    if (!res.ok) toast.error(res.error);
    else load();
  };

  const generate = async () => {
    setBusy(true);
    const res = await generateBookingTasks({
      reservation_id: reservationId,
      property_id: propertyId,
      check_in: checkIn,
      check_out: checkOut,
    });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(t("bookingTasksSection.defaultTasksCreated"));
      load();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{t("bookingTasksSection.title")}</h2>
        {tasks.length > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {t("bookingTasksSection.doneCount", {
              done: tasks.filter((task) => task.status === "done").length,
              total: tasks.length,
            })}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("bookingTasksSection.loading")}</p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {t("bookingTasksSection.emptyState")}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={generate}>
            <Icon
              icon={busy ? "ph:spinner" : "ph:plus"}
              className={"size-4 " + (busy ? "animate-spin" : "")}
            />
            {t("bookingTasksSection.createDefaultTasks")}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((task) => {
            const done = task.status === "done";
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => toggle(task)}
                  className="flex w-full items-center gap-2.5 rounded-(--radius) border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/40"
                >
                  <Icon
                    icon={done ? "ph:check-circle-fill" : "ph:circle"}
                    className={"size-5 shrink-0 " + (done ? "text-success" : "text-muted-foreground")}
                  />
                  <span className={"min-w-0 flex-1 truncate " + (done ? "text-muted-foreground line-through" : "")}>
                    {task.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {statusLabel[task.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
