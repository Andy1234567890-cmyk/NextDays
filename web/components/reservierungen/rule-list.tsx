"use client";

// Liste der Planmäßigen bzw. Regelmäßigen Aufgaben (task_rules kind=auto|
// recurring). Aufgabenvorlagen haben eine eigene Liste (`template-list.tsx`),
// weil sie andere Spalten brauchen.
//
// Spalten wie bei Lodgify: Titel · Aktiv · Zugewiesen · [Planen] · Braucht eine
// Inspektion? · Priorität · Details. Anlegen über den schwebenden „+" unten
// rechts, Bearbeiten über den grünen „Details"-Knopf — beides führt auf eine
// eigene Seite, nicht in ein Modal (der Editor hat dafür zu viele Felder).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { type RuleListItem, listRules } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

type Kind = "auto" | "recurring";

const BASE: Record<Kind, string> = {
  auto: "/reservierungen/aufgaben/planmaessig",
  recurring: "/reservierungen/aufgaben/regelmaessig",
};

export function RuleList({ kind }: { kind: Kind }) {
  const t = useTranslations("reservations");
  const [rows, setRows] = useState<RuleListItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const title = t(`ruleList.kindTitle.${kind}`);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("templateList.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span>{t("templateList.breadcrumbTasks")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        <LearnButton title={title}>
          <p className="text-sm text-muted-foreground">
            {t(`ruleList.learnBody.${kind}`)}
          </p>
        </LearnButton>
      </div>

      <div className="overflow-x-auto rounded-(--radius) border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("ruleList.loading")}
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("ruleList.empty", { title: title.toLowerCase() })}
          </p>
        ) : (
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-semibold">
                  {t("ruleList.columnTitle")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("ruleList.columnActive")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("ruleList.columnAssignee")}
                </th>
                {kind === "recurring" && (
                  <th className="px-4 py-3 font-semibold">
                    {t("ruleList.scheduleLabel")}
                  </th>
                )}
                <th className="px-4 py-3 font-semibold">
                  {t("ruleList.columnInspection")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("ruleList.columnPriority")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("ruleList.columnDetails")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 font-medium">
                    {r.active ? (
                      <span className="text-success">{t("ruleList.yes")}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("ruleList.no")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.assignee_name ?? (
                      <span className="text-muted-foreground">
                        {t("ruleList.emptyValue")}
                      </span>
                    )}
                  </td>
                  {kind === "recurring" && (
                    <td className="px-4 py-3 font-medium">
                      {r.schedule_label ?? t("ruleList.emptyValue")}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">
                    {r.needs_inspection ? t("ruleList.yes") : t("ruleList.no")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {r.priority || t("ruleList.emptyValue")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${BASE[kind]}/${r.id}`}
                      className="inline-flex items-center rounded-(--radius) bg-emerald-400 px-4 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-500"
                    >
                      {t("ruleList.columnDetails")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schwebender „+" unten rechts (neue Regel). Über dem Andy-Button. */}
      <Link
        href={`${BASE[kind]}/neu`}
        className="fixed bottom-24 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105"
        aria-label={t("ruleList.new")}
      >
        <Icon icon="ph:plus" className="size-6" />
      </Link>
    </div>
  );
}
