"use client";

// Teamaufgaben (.. /tasks/team): alle Aufgaben des Tenants mit Assignee-
// und Objekt-Spalte. Tabs AKTUELL/BEVORSTEHENDE/ABGESCHLOSSEN. Live via
// useRealtime auf tasks. Klick öffnet das Detail-Modal.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { Card } from "@nextdays/ui/card";
import { type TaskListItem, listTeamTasks } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function TeamTasks() {
  const t = useTranslations("reservations");
  const locale = useLocale();

  const TABS: { key: string; bucket: string; label: string }[] = [
    { key: "current", bucket: "current", label: t("teamTasks.tabs.current") },
    { key: "upcoming", bucket: "upcoming", label: t("teamTasks.tabs.upcoming") },
    { key: "done", bucket: "done", label: t("teamTasks.tabs.done") },
  ];

  const STATUS_LABEL: Record<string, string> = {
    open: t("teamTasks.status.open"),
    in_progress: t("teamTasks.status.inProgress"),
    done: t("teamTasks.status.done"),
    cancelled: t("teamTasks.status.cancelled"),
  };

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
      ? new Date(iso).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      : "–";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">{t("teamTasks.title")}</h1>

      <div className="flex gap-1 border-b">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.bucket)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${tab === tabItem.bucket
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("teamTasks.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("teamTasks.empty")}
          </p>
        ) : (
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("teamTasks.columns.title")}</th>
                <th className="px-3 py-2 font-medium">{t("teamTasks.columns.property")}</th>
                <th className="px-3 py-2 font-medium">{t("teamTasks.columns.assignee")}</th>
                <th className="px-3 py-2 font-medium">{t("teamTasks.columns.status")}</th>
                <th className="px-3 py-2 font-medium">{t("teamTasks.columns.due")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-secondary/40">
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.property_title ?? "–"}
                  </td>
                  <td className="px-3 py-2">
                    {row.assignee_name ?? (
                      <span className="text-muted-foreground">
                        {t("teamTasks.unassigned")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {row.needs_inspection && (
                        <Icon
                          icon="ph:magnifying-glass"
                          className="size-3.5 text-amber-500"
                          aria-label={t("teamTasks.inspectionNeeded")}
                        />
                      )}
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fmt(row.start_at ?? row.due_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(row.id)}
                      className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
                      aria-label={t("teamTasks.details")}
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
