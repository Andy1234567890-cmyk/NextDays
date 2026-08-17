"use client";

// „Meine Aufgaben": die dem angemeldeten Nutzer zugewiesenen Aufgaben in
// derselben Tabelle wie die Teamaufgaben — nur ohne Zuweisungs-Spalte, die hier
// nichts sagen würde.
//
// Vorher war das eine reine Abhak-Liste ohne Reiter, ohne Unterkunft, ohne
// Buchungsbezug und ohne Termine. Eine Reinigungskraft konnte daraus nicht
// ablesen, WO und BIS WANN etwas zu tun ist — genau die zwei Angaben, auf die
// es ankommt.
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { AufgabenReiter } from "@/components/reservierungen/aufgaben-reiter";
import { AufgabenTabelle } from "@/components/reservierungen/aufgaben-tabelle";
import { MassenaktionenFab } from "@/components/reservierungen/massenaktionen-fab";
import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { listProperties } from "@/lib/properties";
import { type TaskListItem, completeTask, listMyTasks } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function MyTasksList() {
  const t = useTranslations("reservations");
  const [tab, setTab] = useState("current");
  const [rows, setRows] = useState<TaskListItem[]>([]);
  const [properties, setProperties] = useState<
    { value: string; label: string }[]
  >([]);
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Realtime aktualisiert still (siehe team-tasks): kein Ladezustand über
  // einer Liste, die schon dasteht.
  const load = useCallback(async (stillLaden = false) => {
    if (!stillLaden) setLoading(true);
    const res = await listMyTasks({
      status_bucket: tab,
      property_ids: propFilter,
    });
    if (res.ok) setRows(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [tab, propFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      if (res.ok) {
        setProperties(
          res.data.items.map((p) => ({ value: p.id, label: p.title })),
        );
      }
    })();
  }, []);

  const stillNachladen = useCallback(() => {
    void load(true);
  }, [load]);

  useRealtime({ table: "tasks", onChange: stillNachladen });

  const complete = async (taskId: string) => {
    const res = await completeTask(taskId);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(t("myTasksList.completed"));
      stillNachladen();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("myTasksList.title")}
        </h1>
        <AufgabenFilter
          filters={[
            {
              key: "property",
              caption: t("aufgabenFilter.propertiesCaption"),
              allLabel: t("aufgabenFilter.allProperties"),
              dialogTitle: t("aufgabenFilter.propertiesDialog"),
              searchPlaceholder: t("aufgabenFilter.propertiesSearch"),
              options: properties,
              selected: propFilter,
              onChange: setPropFilter,
            },
          ]}
        />
      </div>

      <AufgabenReiter value={tab} onChange={setTab} />

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("myTasksList.loading")}
        </p>
      ) : (
        <AufgabenTabelle
          rows={rows}
          selected={selected}
          onSelectedChange={setSelected}
          emptyLabel={t("myTasksList.emptyState")}
          aktionen={{ onOpen: setOpenId, onComplete: complete }}
        />
      )}

      <MassenaktionenFab
        ids={selected}
        allowDelete={false}
        onDone={() => {
          setSelected([]);
          stillNachladen();
        }}
      />

      {openId && (
        <TaskDetailModal
          taskId={openId}
          onClose={() => setOpenId(null)}
          onChanged={stillNachladen}
        />
      )}
    </div>
  );
}
