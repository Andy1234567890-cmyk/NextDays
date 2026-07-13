"use client";

// Aufgabenvorlagen-Liste (Lodgify): Tabelle Titel · Anzahl Der Aufgaben ·
// Aktualisiert am · Details (grüner Button). Schwebender „+" unten rechts,
// Lernen-Dialog, Breadcrumb. Editor ist eine eigene Seite (/vorlagen/[id]).
// Live via useRealtime auf task_rules.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { type RuleListItem, listRules } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

const BASE = "/reservierungen/aufgaben/vorlagen";

export function TemplateList() {
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
      ? new Date(iso).toLocaleDateString("de-DE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "–";

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Startseite</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span>Aufgaben</span>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">Aufgabenvorlagen</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">Aufgabenvorlagen</h1>
        <LearnButton title="Aufgabenvorlagen">
          <p className="text-sm text-muted-foreground">
            Aufgabenvorlagen sind die tatsächlichen Aufgaben, die von Ihrem
            Personal ausgeführt werden sollen. Vorlagen können zu einer geplanten
            Aufgabe oder einer manuell erstellten Aufgabe hinzugefügt werden. Auf
            diese Weise müssen Sie nicht jedes Mal, wenn Sie eine Aufgabe
            erstellen, eingeben, was getan werden muss.
          </p>
        </LearnButton>
      </div>

      <div className="overflow-x-auto rounded-(--radius) border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Lädt…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Noch keine Aufgabenvorlagen angelegt.
          </p>
        ) : (
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Titel</th>
                <th className="px-4 py-3 font-semibold">Anzahl Der Aufgaben</th>
                <th className="px-4 py-3 font-semibold">Aktualisiert am</th>
                <th className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 font-medium">
                    {r.item_count} Aufgaben
                  </td>
                  <td className="px-4 py-3 font-medium">{fmt(r.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${BASE}/${r.id}`}
                      className="inline-flex items-center rounded-(--radius) bg-emerald-400 px-4 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-500"
                    >
                      Details
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
        aria-label="Neue Aufgabenvorlage"
      >
        <Icon icon="ph:plus" className="size-6" />
      </Link>
    </div>
  );
}
