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
import {
  type RegelDeckung,
  type RuleListItem,
  listRules,
  ruleCoverage,
} from "@/lib/tasks";
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
  // Nur bei den PLANMÄSSIGEN Regeln: sie sind die, die an einer Buchung
  // hängen. Ein Objekt, das keine erreicht, bekommt nie eine Anreise- oder
  // Reinigungsaufgabe — und genau das war bisher ein stiller Zustand.
  const [deckung, setDeckung] = useState<RegelDeckung | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRules(kind);
    if (res.ok) setRows(res.data);
    if (kind === "auto") {
      const cov = await ruleCoverage();
      setDeckung(cov.ok ? cov.data : null);
    }
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

      {deckung && deckung.betroffen.length > 0 && (
        <div className="rounded-(--radius) border border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
            {t("ruleList.deckung.titel")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ruleList.deckung.text", {
              count: deckung.betroffen.length,
              total: deckung.objekte,
            })}
          </p>
          {/* Die Objekte einzeln nur dann, wenn es die AUSNAHMEN sind. Sind
              alle betroffen (ein neu angelegter Betrieb hat noch keine Regel),
              ist die Botschaft „lege eine Regel an" — dann wäre eine Liste
              aller Objekte nur Lärm. Ansonsten höchstens zehn Zeilen, damit
              der Hinweis ein Hinweis bleibt. */}
          {deckung.betroffen.length < deckung.objekte && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {deckung.betroffen.slice(0, 10).map((b) => (
                <li key={b.property_id} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{b.property_title}</span>
                  <span className="text-muted-foreground">
                    {b.ohne_anreise && b.ohne_abreise
                      ? t("ruleList.deckung.keine")
                      : b.ohne_anreise
                        ? t("ruleList.deckung.nurAnreise")
                        : t("ruleList.deckung.nurAbreise")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {t("ruleList.deckung.hinweis")}
          </p>
        </div>
      )}

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
