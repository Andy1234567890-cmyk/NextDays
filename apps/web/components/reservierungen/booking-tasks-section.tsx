"use client";

// Aufgaben-Box der PM-Buchungsdetailseite (Lodgify „Aufgaben"). Listet die
// Aufgaben zu genau dieser Buchung, erlaubt Status-Umschalten (erledigt/offen)
// und das Erzeugen der Standard-Aufgaben (Anreise-Check + Endreinigung). Live
// über useRealtime auf der tasks-Tabelle (Pflicht, kein Polling). Zeigt echte
// Daten oder einen ehrlichen Leerzustand — kein Fake.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  type Task,
  type TaskStatus,
  generateBookingTasks,
  listBookingTasks,
  setTaskStatus,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

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

  const toggle = async (t: Task) => {
    const next: TaskStatus = t.status === "done" ? "open" : "done";
    const res = await setTaskStatus(t.id, next);
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
      toast.success("Standard-Aufgaben erstellt.");
      load();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Aufgaben</h2>
        {tasks.length > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {tasks.filter((t) => t.status === "done").length}/{tasks.length} erledigt
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Noch keine Aufgaben zu dieser Buchung.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={generate}>
            <Icon
              icon={busy ? "ph:spinner" : "ph:plus"}
              className={"size-4 " + (busy ? "animate-spin" : "")}
            />
            Standard-Aufgaben erstellen
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex w-full items-center gap-2.5 rounded-(--radius) border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/40"
                >
                  <Icon
                    icon={done ? "ph:check-circle-fill" : "ph:circle"}
                    className={"size-5 shrink-0 " + (done ? "text-success" : "text-muted-foreground")}
                  />
                  <span className={"min-w-0 flex-1 truncate " + (done ? "text-muted-foreground line-through" : "")}>
                    {t.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {STATUS_LABEL[t.status]}
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
