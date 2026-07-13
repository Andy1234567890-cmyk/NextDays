"use client";

// Gemeinsame Liste für Aufgabenvorlagen / Planmäßige / Regelmäßige Aufgaben
// (task_rules kind=template|auto|recurring). Live via useRealtime auf
// task_rules. Anlegen/Bearbeiten über das Regel-Editor-Modal.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { RuleEditor } from "@/components/reservierungen/rule-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type RuleKind,
  type RuleListItem,
  deleteRule,
  listRules,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const CONFIG: Record<
  RuleKind,
  { title: string; scheduleCol: boolean; scheduleLabel: string }
> = {
  template: { title: "Aufgabenvorlagen", scheduleCol: false, scheduleLabel: "" },
  auto: {
    title: "Planmäßige Aufgaben",
    scheduleCol: false,
    scheduleLabel: "",
  },
  recurring: {
    title: "Regelmäßige Aufgaben",
    scheduleCol: true,
    scheduleLabel: "Zeitplan",
  },
};

export function RuleList({ kind }: { kind: RuleKind }) {
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<RuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRules(kind);
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "task_rules", onChange: load });

  const remove = async (id: string) => {
    const res = await deleteRule(id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Gelöscht.");
      load();
    }
  };

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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">{cfg.title}</h1>
        <Button onClick={() => setCreating(true)}>
          <Icon icon="ph:plus" className="size-4" />
          Neu
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Lädt…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Noch keine {cfg.title.toLowerCase()} angelegt.
          </p>
        ) : (
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Titel</th>
                {kind !== "template" && (
                  <th className="px-3 py-2 font-medium">Aktiv</th>
                )}
                {kind !== "template" && (
                  <th className="px-3 py-2 font-medium">Zugewiesen</th>
                )}
                {cfg.scheduleCol && (
                  <th className="px-3 py-2 font-medium">{cfg.scheduleLabel}</th>
                )}
                <th className="px-3 py-2 font-medium">Punkte</th>
                {kind === "template" && (
                  <th className="px-3 py-2 font-medium">Aktualisiert</th>
                )}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/40">
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {r.needs_inspection && (
                        <Icon
                          icon="ph:magnifying-glass"
                          className="size-3.5 text-amber-500"
                          aria-label="Inspektion nötig"
                        />
                      )}
                      {r.name}
                    </span>
                  </td>
                  {kind !== "template" && (
                    <td className="px-3 py-2">
                      {r.active ? (
                        <span className="text-emerald-600">Ja</span>
                      ) : (
                        <span className="text-muted-foreground">Nein</span>
                      )}
                    </td>
                  )}
                  {kind !== "template" && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.assignee_name ?? "–"}
                    </td>
                  )}
                  {cfg.scheduleCol && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.schedule_label ?? "–"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.item_count}
                  </td>
                  {kind === "template" && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {fmt(r.updated_at)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditId(r.id)}
                        className="flex size-8 items-center justify-center rounded-full hover:bg-secondary"
                        aria-label="Bearbeiten"
                      >
                        <Icon icon="ph:pencil-simple" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="flex size-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label="Löschen"
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(creating || editId) && (
        <RuleEditor
          kind={kind}
          ruleId={editId}
          onClose={() => {
            setCreating(false);
            setEditId(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
