"use client";

// Der INHALT einer Aufgabe: Kopf (Objekt, Zeitfenster, Buchungsbezug,
// Zuständige:r), Checkliste mit Foto-Pflicht, Foto direkt an der Aufgabe und
// der Abschließen-Knopf.
//
// EINE Quelle für ZWEI Rahmen:
//   * `TaskDetailModal` — der Klick aus Kalender/Team-/Meine-Liste (wie
//     Lodgify: die Aufgabe öffnet als Overlay über der Liste, ohne die
//     Ansicht zu verlassen).
//   * `/aufgaben/<id>` — der Deep-Link aus der Benachrichtigungs-Mail. Ein
//     Overlay lässt sich nicht verlinken; Lodgify hat für Aufgaben deshalb GAR
//     KEINE URL und verschickt auch keine Aufgaben-Links. Wir verschicken
//     welche (Hostaway macht es genauso), also braucht es eine Seite.
//
// Warum geteilt und nicht zweimal gebaut: sonst gäbe es zwei Fassungen
// derselben Aufgabe, die beim nächsten Feld auseinanderlaufen — die eine mit
// Foto-Pflicht, die andere ohne.
//
// Für cleaner zeigt der Kopf NUR Objekt und Zeitfenster, nie Gastname, Kontakt
// oder Beträge (Housekeeping-Masking, §4.3) — das Backend maskiert bereits,
// hier wird nichts nachgereicht.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
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

export function TaskDetailInhalt({
  taskId,
  onClose,
  onChanged,
  onNichtGefunden,
}: {
  taskId: string;
  /** Gesetzt = Modal-Rahmen: zeigt das Schließen-Kreuz und schließt nach dem
   *  Abschließen. Weggelassen = Seiten-Rahmen (Deep-Link). */
  onClose?: () => void;
  onChanged?: () => void;
  /** Ruft der Seiten-Rahmen auf, wenn die Aufgabe nicht (mehr) sichtbar ist —
   *  gelöscht, fremder Mandant oder außerhalb der eigenen Objekt-Freigabe.
   *  Alle drei enden serverseitig in einem 404 und dürfen sich für den
   *  Aufrufer NICHT unterscheiden (sonst verrät die Meldung, dass es die
   *  Aufgabe gibt). */
  onNichtGefunden?: () => void;
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
    else if (res.status === 404 && onNichtGefunden) onNichtGefunden();
    else toast.error(res.error);
    setLoading(false);
    // `onNichtGefunden` ist beim Seiten-Rahmen stabil (useCallback dort);
    // bewusst NICHT in den Deps, damit ein neu erzeugter Callback kein
    // erneutes Laden auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (onClose) onClose();
    // Seiten-Rahmen: nicht wegnavigieren. Der Erledigt-Zustand IST die
    // Rückmeldung — wer aus der Mail kommt, soll sehen, dass es gewirkt hat,
    // statt auf einer Liste zu landen und zu rätseln.
    else void load();
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
    void load();
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
    void load();
    onChanged?.();
  };

  // Das JAHR steht dabei, sobald es nicht das laufende ist. Ohne diese Regel
  // las sich eine Aufgabe zum 01.01.2027 als „1. Jan., 01:00" — also wie heute
  // in ein paar Tagen (live gesehen 11.08.2026). Innerhalb des laufenden Jahres
  // bleibt es kurz; das ist der Normalfall im Tagesgeschäft.
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() === new Date().getFullYear()
        ? {}
        : { year: "numeric" as const }),
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading || !detail) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("taskDetailModal.loading")}
      </p>
    );
  }

  return (
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
          {/* Buchungsbezug: ohne ihn weiß die Reinigungskraft nicht, zu
              welcher Anreise die Aufgabe gehört. Nur die Referenz, kein
              Gastname und kein Betrag (§4.3). */}
          {detail.reservation_id && detail.reservation_ref && (
            <Link
              href={`/reservierungen/${detail.reservation_id}`}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {t("taskDetailModal.inBooking", { ref: detail.reservation_ref })}
            </Link>
          )}
          {detail.assignee_name && (
            <p className="text-xs text-muted-foreground">
              {t("taskDetailModal.assignedTo", { name: detail.assignee_name })}
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
            aria-label={t("taskDetailModal.close")}
          >
            <Icon icon="ph:x" className="size-4" />
          </button>
        )}
      </div>

      {detail.checklist.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {detail.checklist.map((item) => {
            const needsPhoto = item.requires_photo && item.photos.length === 0;
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
                    <p className="text-xs text-muted-foreground">{item.room}</p>
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
                        uploadingItem === item.id ? "ph:spinner" : "ph:camera"
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
                      onChange={(e) => uploadPhoto(item.id, e.target.files?.[0])}
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
  );
}
