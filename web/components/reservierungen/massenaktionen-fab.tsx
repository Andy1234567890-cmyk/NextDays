"use client";

// Massenaktionen des Aufgaben-Moduls: zwei schwebende Knöpfe unten rechts,
// sichtbar sobald Zeilen ausgewählt sind (✓ abschließen, 🗑 löschen).
//
// Der Server prüft jede Aufgabe EINZELN (Objekt-Scope, Foto-Pflicht) und meldet
// zurück, wie viele übersprungen wurden — diese Zahl wird hier auch angezeigt.
// „Alle erledigt" zu melden, obwohl drei am fehlenden Pflichtfoto hängen
// geblieben sind, wäre eine Lüge.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { bulkCompleteTasks, bulkDeleteTasks } from "@/lib/tasks";

export function MassenaktionenFab({
  ids,
  onDone,
  allowComplete = true,
  allowDelete = true,
}: {
  ids: string[];
  onDone: () => void;
  allowComplete?: boolean;
  allowDelete?: boolean;
}) {
  const t = useTranslations("reservations");
  const [busy, setBusy] = useState(false);

  if (ids.length === 0) return null;

  const complete = async () => {
    setBusy(true);
    const res = await bulkCompleteTasks(ids);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.skipped > 0
        ? t("massenaktionen.completedPartly", {
            done: res.data.completed,
            skipped: res.data.skipped,
          })
        : t("massenaktionen.completed", { done: res.data.completed }),
    );
    onDone();
  };

  const remove = async () => {
    setBusy(true);
    const res = await bulkDeleteTasks(ids);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.skipped > 0
        ? t("massenaktionen.deletedPartly", {
            done: res.data.deleted,
            skipped: res.data.skipped,
          })
        : t("massenaktionen.deleted", { done: res.data.deleted }),
    );
    onDone();
  };

  return (
    <div className="fixed bottom-24 right-6 z-40 flex items-center gap-3">
      <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg">
        {t("massenaktionen.selected", { count: ids.length })}
      </span>
      {allowComplete && (
        <button
          type="button"
          disabled={busy}
          onClick={complete}
          className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:scale-105 disabled:opacity-50"
          aria-label={t("massenaktionen.completeAria")}
        >
          <Icon icon="ph:check" className="size-6" />
        </button>
      )}
      {allowDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="flex size-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition hover:scale-105 disabled:opacity-50"
          aria-label={t("massenaktionen.deleteAria")}
        >
          <Icon icon="ph:trash" className="size-6" />
        </button>
      )}
    </div>
  );
}
