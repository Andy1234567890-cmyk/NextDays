"use client";

// Teamaufgaben: alle Aufgaben des Betriebs in der geteilten Tabelle, mit
// Zuweisungs-Spalte und der vollen Filterleiste (Aufgabe · Benutzer ·
// Unterkünfte). Live via useRealtime auf tasks.
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fehlerMelden } from "@/lib/fehler-melden";

import { AufgabenFilter } from "@/components/reservierungen/aufgaben-filter";
import { AufgabenReiter } from "@/components/reservierungen/aufgaben-reiter";
import { AufgabenTabelle } from "@/components/reservierungen/aufgaben-tabelle";
import { MassenaktionenFab } from "@/components/reservierungen/massenaktionen-fab";
import { TaskDetailModal } from "@/components/reservierungen/task-detail-modal";
import { mitarbeiterOptionen } from "@/lib/mitarbeiter-optionen";
import {
  LEERER_ZEITRAUM,
  UNASSIGNED,
  type Zeitraum,
  tagesendeIso,
  zeitraumGrenzen,
} from "@/lib/aufgaben-konstanten";
import { listProperties } from "@/lib/properties";
import { NativeSelect } from "@nextdays/ui/native-select";
import { STATUS_REIHENFOLGE } from "@/lib/aufgaben-status";
import {
  type TaskListItem,
  type TaskStatus,
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
  // Datumsfilter „von–bis". Anders als der Statusfilter wirkt er SERVERSEITIG:
  // er grenzt die Menge wirklich ein, statt geladene Zeilen zu verbergen —
  // sonst zeigte der Reiter „Aktuell" weiter alle Aufgaben und nur die Tabelle
  // darunter wäre gefiltert.
  const [zeitraum, setZeitraum] = useState<Zeitraum>(LEERER_ZEITRAUM);
  // Filter nach ARBEITSZUSTAND (offen · angenommen · in Arbeit · erledigt ·
  // abgesagt). Er ergaenzt die Reiter, ersetzt sie NICHT: die Reiter teilen
  // zeitlich (aktuell/bevorstehend/abgeschlossen), dieser Filter nach dem
  // Zustand der Arbeit. „Was ist heute noch offen?" braucht beides — Reiter
  // „Aktuell" plus Status „Offen".
  //
  // Clientseitig, weil der Server nur `status_bucket` kennt und die Zeilen
  // ohnehin schon geladen sind: ein zusaetzlicher Abruf fuer eine Auswahl,
  // die auf vorhandenen Daten stattfinden kann, waere Last ohne Gewinn.
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // `stillLaden`: eine Aktualisierung durch Realtime tauscht nur die Zeilen
  // aus, sie zeigt KEINEN Ladezustand. Sonst ersetzte jedes Ereignis — auch
  // die eigene Zuweisung — die ganze Tabelle durch „Lade…" und baute sie neu
  // auf: die Seite wirkt wie neu geladen, obwohl sich eine Zelle geändert
  // hat. Der Ladezustand gehört zur ERSTEN Anzeige, nicht zur Pflege.
  const load = useCallback(
    async (stillLaden = false) => {
      if (!stillLaden) setLoading(true);
      const res = await listTeamTasks({
        status_bucket: tab,
        property_ids: propFilter,
        assignee_ids: userFilter,
        rule_ids: ruleFilter,
        ...zeitraumGrenzen(zeitraum),
        tagesende: tagesendeIso(),
      });
      if (res.ok) setRows(res.data);
      else fehlerMelden(res);
      setLoading(false);
    },
    [tab, propFilter, userFilter, ruleFilter, zeitraum],
  );

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

  const sichtbareZeilen = useMemo(
    () =>
      statusFilter === "all"
        ? rows
        : rows.filter((r) => r.status === statusFilter),
    [rows, statusFilter],
  );

  const complete = async (taskId: string) => {
    const res = await completeTask(taskId);
    if (!res.ok) fehlerMelden(res);
    else {
      toast.success(t("teamTasks.completed"));
      stillNachladen();
    }
  };

  const remove = async (taskId: string) => {
    const res = await deleteTask(taskId);
    if (!res.ok) fehlerMelden(res);
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
        {/* EINE Filterzeile, nicht zwei. Der Statusfilter stand kurzzeitig als
            eigene Leiste unter den Reitern — zwei Filterreihen auf einer Seite,
            genau das als „durcheinander" Gemeldete. Er ist ein Filter wie die
            anderen und steht bei ihnen; nur seine Auswahl ist kurz genug für
            ein Dropdown statt eines Dialogs. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status zuerst, dann die drei Auswahldialoge: von der groben zur
              feinen Eingrenzung. */}
          <NativeSelect
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TaskStatus | "all")
            }
            className="h-9 w-auto"
            aria-label={t("teamTasks.statusFilter")}
          >
            <option value="all">{t("teamTasks.statusAll")}</option>
            {STATUS_REIHENFOLGE.map((s) => (
              <option key={s} value={s}>
                {t(`taskStatus.${s}`)}
              </option>
            ))}
            <option value="cancelled">{t("taskStatus.cancelled")}</option>
          </NativeSelect>
          {statusFilter !== "all" && (
            <span className="text-xs text-muted-foreground">
              {t("teamTasks.statusCount", {
                gezeigt: sichtbareZeilen.length,
                gesamt: rows.length,
              })}
            </span>
          )}
          <AufgabenFilter
            zeitraum={{ wert: zeitraum, onChange: setZeitraum }}
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
      </div>

      <AufgabenReiter value={tab} onChange={setTab} />

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("teamTasks.loading")}
        </p>
      ) : (
        <AufgabenTabelle
          rows={sichtbareZeilen}
          selected={selected}
          onSelectedChange={setSelected}
          showAssignee
          emptyLabel={t("teamTasks.empty")}
          aktionen={{
            onOpen: setOpenId,
            onComplete: complete,
            onDelete: remove,
            onChanged: stillNachladen,
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
