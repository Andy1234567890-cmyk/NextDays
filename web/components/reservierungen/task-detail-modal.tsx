"use client";

// Aufgaben-Detail-Modal: Checkliste mit Abhaken + Foto-Pflicht-Hinweis,
// Abschließen-Button (erst aktiv, wenn alle Pflicht-Fotos vorliegen — sonst
// serverseitig 422). Für cleaner: Kopf zeigt nur Objekt + Zeitfenster, KEINE
// Gast-PII/Beträge (Housekeeping-Masking, §4.3).
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  type TaskDetail,
  completeTask,
  getTaskDetail,
  uploadChecklistPhoto,
  uploadTaskPhoto,
} from "@/lib/tasks";

export function TaskDetailModal({
  taskId,
  onClose,
  onChanged,
}: {
  taskId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getTaskDetail(taskId);
    if (res.ok) setDetail(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingPhotos =
    detail?.checklist.filter((i) => i.requires_photo && i.photos.length === 0) ??
    [];
  const canComplete =
    detail !== null && detail.status !== "done" && missingPhotos.length === 0;

  const complete = async () => {
    setSaving(true);
    const res = await completeTask(taskId);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskDetailModal.taskCompleted"));
    onChanged?.();
    onClose();
  };

  const uploadPhoto = async (itemId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingItem(itemId);
    const res = await uploadChecklistPhoto(itemId, file);
    setUploadingItem(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskDetailModal.photoUploaded"));
    load();
    onChanged?.();
  };

  // Foto direkt an der Aufgabe (ohne Item) — immer möglich, auch ohne Checkliste.
  const uploadTask = async (file: File | undefined) => {
    if (!file) return;
    setUploadingItem("_task");
    const res = await uploadTaskPhoto(taskId, file);
    setUploadingItem(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskDetailModal.photoUploaded"));
    load();
    onChanged?.();
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-(--radius) border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {loading || !detail ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("taskDetailModal.loading")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">
                  {detail.title}
                </h2>
                {detail.property_title && (
                  <p className="text-sm text-muted-foreground">
                    {detail.property_title}
                  </p>
                )}
                {fmt(detail.start_at ?? detail.due_at) && (
                  <p className="text-xs text-muted-foreground">
                    {fmt(detail.start_at ?? detail.due_at)}
                    {detail.end_at ? ` – ${fmt(detail.end_at)}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
                aria-label={t("taskDetailModal.close")}
              >
                <Icon icon="ph:x" className="size-4" />
              </button>
            </div>

            {detail.checklist.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {detail.checklist.map((item) => {
                  const needsPhoto =
                    item.requires_photo && item.photos.length === 0;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 rounded-(--radius) border p-2.5 ${
                        needsPhoto ? "border-amber-500" : ""
                      }`}
                    >
                      <Icon
                        icon={item.done ? "ph:check-circle-fill" : "ph:circle"}
                        className={`size-5 shrink-0 ${
                          item.done ? "text-emerald-500" : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.label}</p>
                        {item.room && (
                          <p className="text-xs text-muted-foreground">
                            {item.room}
                          </p>
                        )}
                      </div>
                      {item.requires_photo && (
                        <label
                          className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            needsPhoto
                              ? "border-amber-500 text-amber-600 hover:bg-amber-500/10"
                              : "border-emerald-500 text-emerald-600 hover:bg-emerald-500/10"
                          }`}
                        >
                          <Icon
                            icon={
                              uploadingItem === item.id
                                ? "ph:spinner"
                                : "ph:camera"
                            }
                            className="size-4"
                          />
                          {uploadingItem === item.id
                            ? t("taskDetailModal.loading")
                            : item.photos.length > 0
                              ? t("taskDetailModal.photoCount", {
                                  count: item.photos.length,
                                })
                              : t("taskDetailModal.takePhoto")}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="hidden"
                            disabled={uploadingItem !== null}
                            onChange={(e) =>
                              uploadPhoto(item.id, e.target.files?.[0])
                            }
                          />
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {missingPhotos.length > 0 && (
              <p className="rounded-(--radius) bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                {t("taskDetailModal.missingPhotosNotice", {
                  count: missingPhotos.length,
                })}
              </p>
            )}

            {/* Foto direkt an der Aufgabe (ohne Checklisten-Item) → Buchungsbild. */}
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-(--radius) border border-dashed p-2.5 text-sm text-muted-foreground hover:bg-secondary">
              <Icon
                icon={uploadingItem === "_task" ? "ph:spinner" : "ph:camera"}
                className="size-4"
              />
              {uploadingItem === "_task"
                ? t("taskDetailModal.loading")
                : t("taskDetailModal.addPhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                disabled={uploadingItem !== null}
                onChange={(e) => uploadTask(e.target.files?.[0])}
              />
            </label>

            <div className="flex justify-end gap-2">
              {detail.status === "done" ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <Icon icon="ph:check-circle-fill" className="size-4" />
                  {t("taskDetailModal.done")}
                </span>
              ) : (
                <Button onClick={complete} disabled={!canComplete || saving}>
                  {saving
                    ? t("taskDetailModal.saving")
                    : t("taskDetailModal.completeButton")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
