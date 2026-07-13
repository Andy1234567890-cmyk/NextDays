"use client";

// Aufgaben-Popup im Kalender (Klick auf einen Aufgaben-Balken). Zeigt Titel,
// Objekt, Assignee, Zeitfenster, Priorität und Status. Aktionen: „Ansehen"
// (öffnet das Detail-Modal mit Checkliste) + „Löschen".
import { Icon } from "@iconify/react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteTask, type TaskListItem } from "@/lib/tasks";

const STATUS_LABEL: Record<string, string> = {
  open: "Unvollständig",
  in_progress: "In Arbeit",
  done: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

export function TaskPopover({
  task,
  onClose,
  onDeleted,
  onPhotos,
}: {
  task: TaskListItem;
  onClose: () => void;
  onDeleted: () => void;
  onPhotos: () => void;
}) {
  // „Ansehen" führt zum Objekt. Bei Zusatzleistungs-Aufgaben direkt zum
  // Zusatzleistungen-Reiter, sonst zur Objektübersicht. Ohne Objekt kein Link.
  const viewHref = task.property_id
    ? task.title.toLowerCase().startsWith("zusatzleistung")
      ? `/objekte/${task.property_id}/zusatzleistungen`
      : `/objekte/${task.property_id}`
    : null;
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("de-DE", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "–";

  const remove = async () => {
    const res = await deleteTask(task.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Aufgabe gelöscht.");
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
          {task.assignee_name && (
            <p className="font-semibold">{task.assignee_name}</p>
          )}
          <p>
            <span className="font-medium">Von:</span>{" "}
            {fmt(task.start_at ?? task.due_at)}
          </p>
          {task.end_at && (
            <p>
              <span className="font-medium">Bis:</span> {fmt(task.end_at)}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            {STATUS_LABEL[task.status] ?? task.status}
            {task.needs_inspection && (
              <Icon
                icon="ph:magnifying-glass"
                className="size-3.5 text-amber-500"
                aria-label="Inspektion nötig"
              />
            )}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onPhotos}>
            <Icon icon="ph:camera" className="size-4" />
            Fotos
          </Button>
          {viewHref && (
            <Button variant="outline" size="sm" asChild>
              <Link href={viewHref}>Ansehen</Link>
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={remove}>
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}
