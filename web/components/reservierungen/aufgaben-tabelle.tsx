"use client";

// Die Aufgaben-Tabelle des PM-Moduls — geteilt von „Meine Aufgaben" und
// „Teamaufgaben", weil beide bei Lodgify dieselbe Tabelle sind (Teamaufgaben hat
// nur eine Spalte mehr).
//
// Spalten: Auswahl · Aktionen · Titel · Unterkunft · Buchung · [Zugewiesen] ·
// Status · Start-/Endtermine. Überfällige offene Zeilen sind rot hinterlegt —
// das ist die eigentliche Information der Liste: was hätte längst getan sein
// müssen. Ohne die Einfärbung sieht eine seit Wochen offene Reinigung genauso
// aus wie eine von morgen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { Card } from "@nextdays/ui/card";
import { AUFGABEN_STATUS } from "@/lib/aufgaben-status";
import type { TaskListItem } from "@/lib/tasks";

export type TabellenAktion = {
  onOpen: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
};

function useTermin(): (iso: string | null) => string {
  const locale = useLocale();
  return (iso) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "–";
}

/** Offen UND der Endtermin (ersatzweise Start/Fälligkeit) liegt in der Vergangenheit. */
function istUeberfaellig(task: TaskListItem): boolean {
  if (task.status === "done" || task.status === "cancelled") return false;
  const ende = task.end_at ?? task.due_at ?? task.start_at;
  return Boolean(ende) && new Date(ende as string).getTime() < Date.now();
}

export function AufgabenTabelle({
  rows,
  selected,
  onSelectedChange,
  aktionen,
  showAssignee,
  emptyLabel,
}: {
  rows: TaskListItem[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  aktionen: TabellenAktion;
  showAssignee?: boolean;
  emptyLabel: string;
}) {
  const t = useTranslations("reservations");
  const termin = useTermin();

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </Card>
    );
  }

  const alleGewaehlt = rows.every((r) => selected.includes(r.id));
  const toggle = (id: string) =>
    onSelectedChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <th className="w-24 px-4 py-3 font-semibold">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={alleGewaehlt}
                  onChange={() =>
                    onSelectedChange(alleGewaehlt ? [] : rows.map((r) => r.id))
                  }
                  className="size-4 rounded-sm accent-primary"
                  aria-label={t("aufgabenTabelle.selectAll")}
                />
                {t("aufgabenTabelle.columnActions")}
              </span>
            </th>
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnTitle")}
            </th>
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnProperty")}
            </th>
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnBooking")}
            </th>
            {showAssignee && (
              <th className="px-4 py-3 font-semibold">
                {t("aufgabenTabelle.columnAssignee")}
              </th>
            )}
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnStatus")}
            </th>
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnDates")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ueberfaellig = istUeberfaellig(row);
            return (
              <tr
                key={row.id}
                className={`border-b last:border-b-0 ${
                  ueberfaellig ? "bg-destructive/10" : "hover:bg-secondary/40"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      className="mr-1 size-4 rounded-sm accent-primary"
                      aria-label={t("aufgabenTabelle.selectRow")}
                    />
                    <button
                      type="button"
                      onClick={() => aktionen.onOpen(row.id)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={t("aufgabenTabelle.open")}
                    >
                      <Icon icon="ph:eye" className="size-4" />
                    </button>
                    {aktionen.onComplete && row.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => aktionen.onComplete?.(row.id)}
                        className="flex size-7 items-center justify-center rounded-full text-success hover:bg-success/10"
                        aria-label={t("aufgabenTabelle.complete")}
                      >
                        <Icon icon="ph:check" className="size-4" />
                      </button>
                    )}
                    {aktionen.onDelete && (
                      <button
                        type="button"
                        onClick={() => aktionen.onDelete?.(row.id)}
                        className="flex size-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label={t("aufgabenTabelle.delete")}
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {row.needs_inspection && (
                      <Icon
                        icon="ph:magnifying-glass"
                        className="size-3.5 text-warning"
                        aria-label={t("aufgabenTabelle.inspectionNeeded")}
                      />
                    )}
                    {row.title}
                  </span>
                </td>
                <td className="px-4 py-3 uppercase text-muted-foreground">
                  {row.property_title || "–"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.reservation_id && row.reservation_ref ? (
                    <Link
                      href={`/reservierungen/${row.reservation_id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.reservation_ref}
                    </Link>
                  ) : (
                    "–"
                  )}
                </td>
                {showAssignee && (
                  <td className="px-4 py-3">
                    {row.assignee_name ?? (
                      <span className="text-muted-foreground">
                        {t("aufgabenTabelle.unassigned")}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusChip status={row.status} ueberfaellig={ueberfaellig} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  <div>{termin(row.start_at ?? row.due_at)}</div>
                  <div>{termin(row.end_at)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function StatusChip({
  status,
  ueberfaellig,
}: {
  status: TaskListItem["status"];
  ueberfaellig: boolean;
}) {
  const t = useTranslations("reservations");
  const d = AUFGABEN_STATUS[status];
  // Überfällig färbt NUR die noch offenen Zustände rot. Eine erledigte oder
  // abgesagte Aufgabe ist nicht überfällig — sie ist fertig bzw. weg.
  const offen = status !== "done" && status !== "cancelled";
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        ueberfaellig && offen ? "text-destructive" : d.farbe
      }`}
    >
      <Icon
        icon={ueberfaellig && offen ? "ph:warning-circle" : d.icon}
        className="size-4"
      />
      {t(`taskStatus.${d.key}`)}
    </span>
  );
}
