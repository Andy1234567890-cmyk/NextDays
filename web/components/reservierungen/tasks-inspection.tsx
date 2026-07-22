"use client";

// Inspektion (.. /tasks/inspection): QA-Workflow über abgeschlossenen
// Aufgaben mit needs_inspection. Tabs ZU ÜBERPRÜFEN/KOMMEND/ÜBERPRÜFT.
// Foto-Nachweise ansehen, Freigeben/Zurückweisen. Live via useRealtime.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  type InspectionItem,
  inspectTask,
  listInspection,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function TasksInspection() {
  const t = useTranslations("reservations");
  const TABS: { tab: string; label: string }[] = [
    { tab: "to_review", label: t("tasksInspection.tabToReview") },
    { tab: "upcoming", label: t("tasksInspection.tabUpcoming") },
    { tab: "reviewed", label: t("tasksInspection.tabReviewed") },
  ];
  const [tab, setTab] = useState("to_review");
  const [rows, setRows] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listInspection(tab);
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "tasks", onChange: load });

  const decide = async (id: string, approved: boolean) => {
    const res = await inspectTask(id, approved);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(
        approved
          ? t("tasksInspection.toastApproved")
          : t("tasksInspection.toastRejected"),
      );
      load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">
        {t("tasksInspection.title")}
      </h1>

      <div className="flex gap-1 border-b">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.tab}
            type="button"
            onClick={() => setTab(tabItem.tab)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${tab === tabItem.tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("tasksInspection.loading")}
        </p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("tasksInspection.emptyState")}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.property_title ?? "–"}
                    {item.assignee_name ? ` · ${item.assignee_name}` : ""}
                  </p>
                </div>
                {tab === "reviewed" && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Icon icon="ph:check-circle-fill" className="size-4" />
                    {t("tasksInspection.reviewedBadge")}
                  </span>
                )}
              </div>

              {item.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.photos.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1 rounded-(--radius) bg-secondary px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Icon icon="ph:image" className="size-3.5" />
                      {t("tasksInspection.photoProof")}
                    </span>
                  ))}
                </div>
              )}

              {tab === "to_review" && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => decide(item.id, false)}
                  >
                    {t("tasksInspection.reject")}
                  </Button>
                  <Button onClick={() => decide(item.id, true)}>
                    {t("tasksInspection.approve")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
