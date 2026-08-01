"use client";

// Aufgabenvorlagen-Liste (..): Tabelle Titel · Anzahl Der Aufgaben ·
// Aktualisiert am · Details (grüner Button). Schwebender „+" unten rechts,
// Lernen-Dialog, Breadcrumb. Editor ist eine eigene Seite (/vorlagen/[id]).
// Live via useRealtime auf task_rules.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { type RuleListItem, listRules } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const BASE = "/reservierungen/aufgaben/vorlagen";

export function TemplateList() {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [rows, setRows] = useState<RuleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRules("template");
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "task_rules", onChange: load });

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
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("templateList.breadcrumbHome")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span>{t("templateList.breadcrumbTasks")}</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">{t("templateList.breadcrumbTemplates")}</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">{t("templateList.heading")}</h1>
        <LearnButton title={t("templateList.heading")}>
          <p className="text-sm text-muted-foreground">
            {t("templateList.learnBody")}
          </p>
        </LearnButton>
      </div>

      <div className="overflow-x-auto rounded-(--radius) border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("templateList.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("templateList.empty")}
          </p>
        ) : (
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t("templateList.columnTitle")}</th>
                <th className="px-4 py-3 font-semibold">{t("templateList.columnTaskCount")}</th>
                <th className="px-4 py-3 font-semibold">{t("templateList.columnUpdatedAt")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("templateList.columnDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 font-medium">
                    {t("templateList.taskCount", { count: r.item_count })}
                  </td>
                  <td className="px-4 py-3 font-medium">{fmt(r.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${BASE}/${r.id}`}
                      className="inline-flex items-center rounded-(--radius) bg-emerald-400 px-4 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-500"
                    >
                      {t("templateList.columnDetails")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schwebender „+" unten rechts (neue Vorlage). Über dem Andy-Button. */}
      <Link
        href={`${BASE}/neu`}
        className="fixed bottom-24 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105"
        aria-label={t("templateList.newTemplateAriaLabel")}
      >
        <Icon icon="ph:plus" className="size-6" />
      </Link>
    </div>
  );
}
