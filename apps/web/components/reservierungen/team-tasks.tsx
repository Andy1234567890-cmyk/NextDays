"use client";

// Teamaufgaben (Lodgify /tasks/team): alle Aufgaben des Tenants mit Assignee-
// und Objekt-Spalte. Tabs AKTUELL/BEVORSTEHENDE/ABGESCHLOSSEN. Live via
// useRealtime auf tasks. Klick öffnet das Detail-Modal.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { Card } from "@/components/ui/card";
import { type TaskListItem, listTeamTasks } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const TABS: { key: string; bucket: string; label: string }[] = [
  { key: "current", bucket: "current", label: "AKTUELL" },
  { key: "upcoming", bucket: "upcoming", label: "BEVORSTEHENDE" },
  { key: "done", bucket: "done", label: "ABGESCHLOSSEN" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

export function TeamTasks() {
  const [tab, setTab] = useState("current");
  const [rows, setRows] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listTeamTasks({ status_bucket: tab });
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "tasks", onChange: load });

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("de-DE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "–";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Teamaufgaben</h1>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.bucket)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
              tab === t.bucket
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Lädt…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Keine Aufgaben in dieser Ansicht.
          </p>
        ) : (
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Unterkunft</th>
                <th className="px-3 py-2 font-medium">Zugewiesen an</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Fällig</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b hover:bg-secondary/40">
                  <td className="px-3 py-2 font-medium">{t.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.property_title ?? "–"}
                  </td>
                  <td className="px-3 py-2">
                    {t.assignee_name ?? (
                      <span className="text-muted-foreground">Nicht zugewiesen</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {t.needs_inspection && (
                        <Icon
                          icon="ph:magnifying-glass"
                          className="size-3.5 text-amber-500"
                          aria-label="Inspektion nötig"
                        />
                      )}
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fmt(t.start_at ?? t.due_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(t.id)}
                      className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
                      aria-label="Details"
                    >
                      <Icon icon="ph:eye" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {openId && (
        <TaskDetailModal
          taskId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
