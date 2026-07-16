"use client";

// „Aufgabe erstellen"-Popup (..): geöffnet über das „+" einer Kalender-
// Zelle ODER „Aufgabe erstellen" im Buchungs-Popup. Tag + Objekt sind
// vorbelegt. Felder wie ..: Was ist zu tun?, Beschreibung, Priorität,
// Anfangs-/Enddatum + Uhrzeit, Empfänger, Abschluss erfordert Inspektion.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { listTenantUsers } from "@/lib/account";
import { createTask } from "@/lib/tasks";

const PRIO_KEYS = ["low", "minor", "medium", "high", "urgent"] as const;

// Unterstrich-Feld wie .. (keine Box, nur untere Linie).
const LINE =
  "w-full border-0 border-b border-border bg-transparent px-0 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-0";

export function TaskCreatePopup({
  propertyId,
  reservationId,
  date,
  onClose,
  onCreated,
}: {
  propertyId: string | null;
  reservationId?: string | null;
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("reservations");
  const PRIO = PRIO_KEYS.map((key) => t(`taskCreatePopup.priorityLevels.${key}`));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [startDate, setStartDate] = useState(date);
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(date);
  const [endTime, setEndTime] = useState("23:59");
  const [assignee, setAssignee] = useState("");
  const [needsInspection, setNeedsInspection] = useState(false);
  const [users, setUsers] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listTenantUsers().then((r) => {
      if (r.ok) {
        setUsers(
          r.data.map((u) => ({
            value: u.user_id,
            label: u.full_name ?? u.email ?? u.user_id,
          })),
        );
      }
    });
  }, []);

  const save = async () => {
    if (!title.trim()) {
      toast.error(t("taskCreatePopup.titleRequired"));
      return;
    }
    setSaving(true);
    const res = await createTask({
      title,
      description: description || null,
      property_id: propertyId,
      reservation_id: reservationId ?? null,
      assignee_id: assignee || null,
      start_at: new Date(`${startDate}T${startTime}`).toISOString(),
      end_at: new Date(`${endDate}T${endTime}`).toISOString(),
      due_at: new Date(`${startDate}T${startTime}`).toISOString(),
      priority,
      needs_inspection: needsInspection,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskCreatePopup.taskCreated"));
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-(--radius) border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Kopf */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-lg font-bold">
            {t("taskCreatePopup.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label={t("taskCreatePopup.close")}
          >
            <Icon icon="ph:x" className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.whatToDoLabel")}
            </span>
            <input
              className={LINE}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("taskCreatePopup.whatToDoPlaceholder")}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.descriptionLabel")}
            </span>
            <textarea
              className={`${LINE} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("taskCreatePopup.descriptionPlaceholder")}
            />
          </label>

          {/* Priorität */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.priorityLabel")}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPriority((p) => Math.max(0, p - 1))}
                className="flex size-8 items-center justify-center rounded-full bg-foreground text-background"
                aria-label={t("taskCreatePopup.less")}
              >
                <Icon icon="ph:minus" className="size-4" />
              </button>
              <span className="min-w-16 text-center text-sm">
                {priority + 1} {PRIO[priority] ?? ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPriority((p) => Math.min(PRIO.length - 1, p + 1))
                }
                className="flex size-8 items-center justify-center rounded-full bg-foreground text-background"
                aria-label={t("taskCreatePopup.more")}
              >
                <Icon icon="ph:plus" className="size-4" />
              </button>
            </div>
          </div>

          {/* Anfangsdatum */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.startDateLabel")}
            </span>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 rounded-(--radius) border px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28 rounded-(--radius) border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Enddatum */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.endDateLabel")}
            </span>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 rounded-(--radius) border px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-28 rounded-(--radius) border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.assigneeLabel")}
            </span>
            <NativeSelect
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">{t("taskCreatePopup.assigneePlaceholder")}</option>
              {users.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </NativeSelect>
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {t("taskCreatePopup.needsInspectionLabel")}
            </span>
            <Switch
              checked={needsInspection}
              onCheckedChange={setNeedsInspection}
            />
          </div>
        </div>

        {/* Footer (..-Stil): eine Zeile — Vorlage links, Aktionen rechts. */}
        <div className="flex items-center gap-3 border-t px-5 py-4">
          <span className="inline-flex h-10 min-w-0 shrink items-center truncate rounded-full bg-foreground px-4 text-sm text-background opacity-60">
            {t("taskCreatePopup.addTemplate")}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? t("taskCreatePopup.saving") : t("taskCreatePopup.save")}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center text-sm font-medium hover:underline"
            >
              {t("taskCreatePopup.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
