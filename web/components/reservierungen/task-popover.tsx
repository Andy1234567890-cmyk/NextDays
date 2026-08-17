"use client";

// Aufgaben-Popup im Kalender (Klick auf einen Aufgaben-Balken). Zeigt Titel,
// Objekt, Zeitfenster, Priorität und Status. Aktionen: Zuständige:n setzen,
// „Ansehen" (öffnet das Detail-Modal mit Checkliste) + „Löschen".
//
// Der Zuständigen-Selektor sitzt bewusst HIER: der Kalender färbt genau die
// unzugewiesenen Aufgaben rot an (`tasks-calendar.tsx`, „ph:warning-circle").
// Bis 17.08.2026 mahnte er damit etwas an, wogegen er keinen Weg anbot — der
// Klick auf den roten Balken führte in ein Popup, das den fehlenden
// Zuständigen nur bestätigte.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  deleteTask,
  setTaskAssignee,
  type TaskListItem,
  type TaskStatus,
} from "@/lib/tasks";
import { AUFGABEN_STATUS } from "@/lib/aufgaben-status";
import { ZustaendigAuswahl } from "./zustaendig-auswahl";

// Beschriftung aus der geteilten Zuordnung (lib/aufgaben-status). Vorher stand
// hier eine eigene switch-Kopie, die den vierten Zustand nicht gekannt hätte.
function statusLabel(t: ReturnType<typeof useTranslations>, status: string) {
  const d = AUFGABEN_STATUS[status as TaskStatus];
  return d ? t(`taskStatus.${d.key}`) : status;
}

export function TaskPopover({
  task,
  onClose,
  onDeleted,
  onPhotos,
  darfZuweisen = false,
}: {
  task: TaskListItem;
  onClose: () => void;
  onDeleted: () => void;
  onPhotos: () => void;

  /** Eigener Guard statt „der Kalender ist ohnehin MANAGE_TASKS-geschützt":
   *  diese Komponente kennt ihren Aufrufer nicht. Heute gibt es genau einen,
   *  morgen einen zweiten — und dann stünde die Auswahl ungeschützt da. */
  darfZuweisen?: boolean;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const zuweisen = async (neu: string | null) => {
    setBusy(true);
    const res = await setTaskAssignee(task.id, neu);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      neu === null ? t("zustaendig.abgezogen") : t("zustaendig.gesetzt"),
    );
    // KEIN manuelles Nachladen: der Kalender hört auf `tasks`
    // (`tasks-calendar.tsx`, Grant + Publikation live geprüft). Ein
    // zusätzliches `load()` liefe dasselbe zweimal — und weil `load` ein
    // `setLoading(true)` setzt, blitzte die ganze Timeline weg und käme neu,
    // obwohl sich EIN Balken geändert hat.
    onClose();
  };
  // „Ansehen" führt zum Objekt. Bei Zusatzleistungs-Aufgaben direkt zum
  // Zusatzleistungen-Reiter, sonst zur Objektübersicht. Ohne Objekt kein Link.
  const viewHref = task.property_id
    ? task.title.toLowerCase().startsWith("zusatzleistung")
      ? `/objekte/${task.property_id}/zusatzleistungen`
      : `/objekte/${task.property_id}`
    : null;
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : t("taskPopover.noValue");

  const remove = async () => {
    const res = await deleteTask(task.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskPopover.deleteSuccess"));
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} role="presentation">
      <div
        className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-(--radius) border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="mb-2 text-sm text-muted-foreground">{task.title}</p>
        <div className="flex flex-col gap-0.5 text-sm">
          {task.property_title && (
            <p className="font-semibold">{task.property_title}</p>
          )}

          <p>
            <span className="font-medium">{t("taskPopover.fromLabel")}</span>{" "}
            {fmt(task.start_at ?? task.due_at)}
          </p>
          {task.end_at && (
            <p>
              <span className="font-medium">{t("taskPopover.toLabel")}</span>{" "}
              {fmt(task.end_at)}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            {statusLabel(t, task.status)}
            {task.needs_inspection && (
              <Icon
                icon="ph:magnifying-glass"
                className="size-3.5 text-amber-500"
                aria-label={t("taskPopover.inspectionNeeded")}
              />
            )}
          </p>
        </div>

        {darfZuweisen ? (
          <div className="mt-3">
            <ZustaendigAuswahl
              wert={task.assignee_id}
              onWechsel={zuweisen}
              laedt={busy}
              propertyId={task.property_id}
            />
          </div>
        ) : (
          task.assignee_name && (
            <p className="mt-2 text-sm font-semibold">{task.assignee_name}</p>
          )
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onPhotos}>
            <Icon icon="ph:camera" className="size-4" />
            {t("taskPopover.photos")}
          </Button>
          {viewHref && (
            <Button variant="outline" size="sm" asChild>
              <Link href={viewHref}>{t("taskPopover.view")}</Link>
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={remove}>
            {t("taskPopover.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
