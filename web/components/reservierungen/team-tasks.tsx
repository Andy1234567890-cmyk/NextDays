"use client";

// Teamaufgaben: alle Aufgaben des Betriebs in der geteilten Tabelle, mit
// Zuweisungs-Spalte und der vollen Filterleiste (Aufgabe · Benutzer ·
// Unterkünfte). Live via useRealtime auf tasks.
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { AufgabenReiter } from "@/components/reservierungen/aufgaben-reiter";
import { AufgabenTabelle } from "@/components/reservierungen/aufgaben-tabelle";
import { MassenaktionenFab } from "@/components/reservierungen/massenaktionen-fab";
import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { mitarbeiterOptionen } from "@/lib/mitarbeiter-optionen";
import { UNASSIGNED } from "@/lib/aufgaben-konstanten";
import { listProperties } from "@/lib/properties";
import {
  type TaskListItem,
  completeTask,
  deleteTask,
  listRules,
  listTeamTasks,
  listTaskAssignees,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

type Opt = { value: string; label: string };

export function TeamTasks() {
  const t = useTranslations("reservations");
  const [tab, setTab] = useState("current");
  const [rows, setRows] = useState<TaskListItem[]>([]);
  const [properties, setProperties] = useState<Opt[]>([]);
  const [users, setUsers] = useState<Opt[]>([]);
  const [rules, setRules] = useState<Opt[]>([]);
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [ruleFilter, setRuleFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // `stillLaden`: eine Aktualisierung durch Realtime tauscht nur die Zeilen
  // aus, sie zeigt KEINEN Ladezustand. Sonst ersetzte jedes Ereignis — auch
  // die eigene Zuweisung — die ganze Tabelle durch „Lade…" und baute sie neu
  // auf: die Seite wirkt wie neu geladen, obwohl sich eine Zelle geändert
  // hat. Der Ladezustand gehört zur ERSTEN Anzeige, nicht zur Pflege.
  const load = useCallback(async (stillLaden = false) => {
    if (!stillLaden) setLoading(true);
    const res = await listTeamTasks({
      status_bucket: tab,
      property_ids: propFilter,
      assignee_ids: userFilter,
      rule_ids: ruleFilter,
    });
    if (res.ok) setRows(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [tab, propFilter, userFilter, ruleFilter]);

  const stillNachladen = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filter-Optionen einmalig laden. „Nicht zugeordnet" ist ein eigener Eintrag
  // im Nutzerfilter — sonst ließe sich genau der Fall nicht finden, der am
  // meisten drängt: eine Aufgabe, die niemand erledigen kann.
  useEffect(() => {
    void (async () => {
      const [props, tenantUsers, autoRules] = await Promise.all([
        listProperties(),
        listTaskAssignees(),
        listRules("auto"),
      ]);
      if (props.ok) {
        setProperties(
          props.data.items.map((p) => ({ value: p.id, label: p.title })),
        );
      }
      if (tenantUsers.ok) {
        setUsers([
          ...mitarbeiterOptionen(tenantUsers.data),
          { value: UNASSIGNED, label: t("aufgabenFilter.unassignedOption") },
        ]);
      }
      if (autoRules.ok) {
        setRules(autoRules.data.map((r) => ({ value: r.id, label: r.name })));
      }
    })();
  }, [t]);

  useRealtime({ table: "tasks", onChange: stillNachladen });

  const complete = async (taskId: string) => {
    const res = await completeTask(taskId);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(t("teamTasks.completed"));
      stillNachladen();
    }
  };

  const remove = async (taskId: string) => {
    const res = await deleteTask(taskId);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(t("teamTasks.deleted"));
      stillNachladen();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("teamTasks.title")}
        </h1>
        <AufgabenFilter
          filters={[
            {
              key: "rule",
              caption: t("aufgabenFilter.taskCaption"),
              allLabel: t("aufgabenFilter.allTasks"),
              dialogTitle: t("aufgabenFilter.taskDialog"),
              searchPlaceholder: t("aufgabenFilter.taskSearch"),
              options: rules,
              selected: ruleFilter,
              onChange: setRuleFilter,
            },
            {
              key: "user",
              caption: t("aufgabenFilter.usersCaption"),
              allLabel: t("aufgabenFilter.allUsers"),
              dialogTitle: t("aufgabenFilter.usersDialog"),
              searchPlaceholder: t("aufgabenFilter.usersSearch"),
              options: users,
              selected: userFilter,
              onChange: setUserFilter,
            },
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
          {t("teamTasks.loading")}
        </p>
      ) : (
        <AufgabenTabelle
          rows={rows}
          selected={selected}
          onSelectedChange={setSelected}
          showAssignee
          emptyLabel={t("teamTasks.empty")}
          aktionen={{
            onOpen: setOpenId,
            onComplete: complete,
            onDelete: remove,
          }}
        />
      )}

      <MassenaktionenFab
        allowAssign
        ids={selected}
        onDone={() => {
          // Nur die Auswahl leeren — die Zeilen zieht das Realtime-Abo nach.
          setSelected([]);
        }}
      />

      {openId && (
        <TaskDetailModal
          darfZuweisen
          taskId={openId}
          onClose={() => setOpenId(null)}
          onChanged={stillNachladen}
        />
      )}
    </div>
  );
}
