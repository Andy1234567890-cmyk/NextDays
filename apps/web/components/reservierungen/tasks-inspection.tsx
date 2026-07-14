"use client";

// Inspektion (.. /tasks/inspection): QA-Workflow über abgeschlossenen
// Aufgaben mit needs_inspection. Tabs ZU ÜBERPRÜFEN/KOMMEND/ÜBERPRÜFT.
// Foto-Nachweise ansehen, Freigeben/Zurückweisen. Live via useRealtime.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type InspectionItem,
  inspectTask,
  listInspection,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const TABS: { tab: string; label: string }[] = [
  { tab: "to_review", label: "ZU ÜBERPRÜFEN" },
  { tab: "upcoming", label: "KOMMEND" },
  { tab: "reviewed", label: "ÜBERPRÜFT" },
];

export function TasksInspection() {
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
      toast.success(approved ? "Freigegeben." : "Zurückgewiesen.");
      load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Inspektion</h1>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            onClick={() => setTab(t.tab)}
            className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${tab === t.tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">Lädt…</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Keine Aufgaben mehr übrig.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.property_title ?? "–"}
                    {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                  </p>
                </div>
                {tab === "reviewed" && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Icon icon="ph:check-circle-fill" className="size-4" />
                    Geprüft
                  </span>
                )}
              </div>

              {t.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {t.photos.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1 rounded-(--radius) bg-secondary px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Icon icon="ph:image" className="size-3.5" />
                      Nachweis
                    </span>
                  ))}
                </div>
              )}

              {tab === "to_review" && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => decide(t.id, false)}>
                    Zurückweisen
                  </Button>
                  <Button onClick={() => decide(t.id, true)}>Freigeben</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
