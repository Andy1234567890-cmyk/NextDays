"use client";

// Gemeinsame Liste für Aufgabenvorlagen / Planmäßige / Regelmäßige Aufgaben
// (task_rules kind=template|auto|recurring). Live via useRealtime auf
// task_rules. Anlegen/Bearbeiten über das Regel-Editor-Modal.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { RuleEditor } from "@/components/reservierungen/rule-editor";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  type RuleKind,
  type RuleListItem,
  deleteRule,
  listRules,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function RuleList({ kind }: { kind: RuleKind }) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const CONFIG: Record<
    RuleKind,
    { title: string; scheduleCol: boolean; scheduleLabel: string }
  > = {
    template: {
      title: t("ruleList.kindTitle.template"),
      scheduleCol: false,
      scheduleLabel: "",
    },
    auto: {
      title: t("ruleList.kindTitle.auto"),
      scheduleCol: false,
      scheduleLabel: "",
    },
    recurring: {
      title: t("ruleList.kindTitle.recurring"),
      scheduleCol: true,
      scheduleLabel: t("ruleList.scheduleLabel"),
    },
  };
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
      toast.success(t("ruleList.deleted"));
      load();
    }
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : t("ruleList.emptyValue");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">{cfg.title}</h1>
        <Button onClick={() => setCreating(true)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("ruleList.new")}
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("ruleList.loading")}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("ruleList.empty", { title: cfg.title.toLowerCase() })}
          </p>
        ) : (
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("ruleList.columnTitle")}</th>
                {kind !== "template" && (
                  <th className="px-3 py-2 font-medium">{t("ruleList.columnActive")}</th>
                )}
                {kind !== "template" && (
                  <th className="px-3 py-2 font-medium">{t("ruleList.columnAssignee")}</th>
                )}
                {cfg.scheduleCol && (
                  <th className="px-3 py-2 font-medium">{cfg.scheduleLabel}</th>
                )}
                <th className="px-3 py-2 font-medium">{t("ruleList.columnPoints")}</th>
                {kind === "template" && (
                  <th className="px-3 py-2 font-medium">{t("ruleList.columnUpdated")}</th>
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
                          aria-label={t("ruleList.inspectionNeeded")}
                        />
                      )}
                      {r.name}
                    </span>
                  </td>
                  {kind !== "template" && (
                    <td className="px-3 py-2">
                      {r.active ? (
                        <span className="text-emerald-600">{t("ruleList.yes")}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("ruleList.no")}</span>
                      )}
                    </td>
                  )}
                  {kind !== "template" && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.assignee_name ?? t("ruleList.emptyValue")}
                    </td>
                  )}
                  {cfg.scheduleCol && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.schedule_label ?? t("ruleList.emptyValue")}
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
                        aria-label={t("ruleList.edit")}
                      >
                        <Icon icon="ph:pencil-simple" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="flex size-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label={t("ruleList.delete")}
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
