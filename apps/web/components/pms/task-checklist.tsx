// Fachliche PMS-Komponente Aufgaben-Checkliste (Lastenheft §2.5, Tabelle task / checklist_item).
// Task-Kopf (Titel, Fälligkeit, task_status-Badge) + checklist_items (Checkbox + Raum-Label)
// mit Foto-Nachweis-Platzhalter je Item. Icons via Iconify — niemals lucide-react.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Echte Enum-Werte aus BUILD_REFERENCE (supabase/migrations).
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

// Ein Eintrag der Checkliste (entspricht checklist_item).
export type ChecklistItem = {
  id: string;
  /** Raum-Label, z. B. "Wohnzimmer". */
  room: string;
  /** Erledigt-Status der Position. */
  done: boolean;
  /** Foto-Nachweis vorhanden? (Platzhalter, bis Upload integriert ist.) */
  hasPhoto?: boolean;
};

export type TaskChecklistProps = {
  /** Aufgaben-Titel, z. B. "Endreinigung". */
  title: string;
  /** Fälligkeit als bereits formatierter, lesbarer Text. */
  dueLabel: string;
  /** Aufgaben-Status (task_status). */
  status: TaskStatus;
  /** Positionen der Checkliste. */
  items: ChecklistItem[];
  className?: string;
};

// Status-Label + Badge-Variante je task_status (Status-Farben gem. BUILD_REFERENCE).
const STATUS_META: Record<
  TaskStatus,
  { label: string; variant: "secondary" | "warning" | "success"; icon: string }
> = {
  open: { label: "Offen", variant: "secondary", icon: "ph:circle" },
  in_progress: { label: "In Arbeit", variant: "warning", icon: "ph:spinner-gap" },
  done: { label: "Erledigt", variant: "success", icon: "ph:check-circle" },
  cancelled: { label: "Storniert", variant: "secondary", icon: "ph:x-circle" },
};

export function TaskChecklist({
  title,
  dueLabel,
  status,
  items,
  className,
}: TaskChecklistProps) {
  // Lokaler Zustand für interaktive Demo (Checkbox umschalten).
  const [state, setState] = useState<ChecklistItem[]>(items);

  const doneCount = state.filter((i) => i.done).length;
  const statusMeta = STATUS_META[status];

  function toggle(id: string) {
    setState((prev) =>
      prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    );
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      {/* Task-Kopf: Titel, Fälligkeit, task_status-Badge */}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon icon="ph:calendar-blank" className="h-4 w-4" />
              Fällig: {dueLabel}
            </p>
          </div>
          <Badge variant={statusMeta.variant}>
            <Icon icon={statusMeta.icon} className="h-3.5 w-3.5" />
            {statusMeta.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {doneCount} von {state.length} Räumen erledigt
        </p>
      </CardHeader>

      <Separator />

      {/* Liste der checklist_items: Checkbox + Raum-Label + Foto-Nachweis */}
      <CardContent className="pt-6">
        <ul className="flex flex-col gap-1">
          {state.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-(--radius) px-2 py-2 transition-colors hover:bg-secondary"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`${item.room} als erledigt markieren`}
                />
                <span
                  className={cn(
                    "text-sm",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.room}
                </span>
              </label>

              {/* Foto-Nachweis-Platzhalter je Item */}
              <Button
                type="button"
                variant={item.hasPhoto ? "outline" : "ghost"}
                size="icon"
                aria-label={
                  item.hasPhoto
                    ? `Foto-Nachweis für ${item.room} ansehen`
                    : `Foto-Nachweis für ${item.room} hinzufügen`
                }
                title={item.hasPhoto ? "Foto-Nachweis vorhanden" : "Foto-Nachweis hinzufügen"}
              >
                <Icon
                  icon={item.hasPhoto ? "ph:image" : "ph:camera"}
                  className={cn(
                    "h-5 w-5",
                    item.hasPhoto ? "text-foreground" : "text-muted-foreground",
                  )}
                />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
