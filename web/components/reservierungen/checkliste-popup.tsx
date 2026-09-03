"use client";

// Checkliste einer Aufgabe als EIGENES Popup über der Detailansicht.
//
// WARUM (03.09.2026): Die Punkte standen bis dahin als Liste mitten in der
// Detailansicht. Eine Vorlage mit 16 Punkten samt Fotoknöpfen machte den
// Dialog bildschirmhoch — Auslagen, Rückmeldung und „Abschließen" lagen
// unerreichbar darunter. Gemeldet als „wir müssen die Checkliste in einem
// separaten Popup sehen, nicht in einer ewig langen Liste".
//
// Die Handler (Abhaken, Foto) bleiben in `TaskDetailInhalt`: dort liegt der
// geladene Zustand, und dort wird nach jedem Schreiben neu geladen. Dieses
// Popup zeigt nur an und reicht Klicks durch.
//
// Escape schließt NUR dieses Popup, nicht die Detailansicht darunter: der
// Listener läuft in der Capture-Phase und stoppt die Weitergabe, sonst
// bekäme das Modal darunter denselben Tastendruck und ginge mit zu.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type { ChecklistItem } from "@/lib/tasks";

export function ChecklistePopup({
  titel,
  punkte,
  uploadingItem,
  onToggle,
  onPhoto,
  onClose,
}: {
  titel: string;
  punkte: ChecklistItem[];
  /** Punkt, dessen Foto gerade hochlädt (`"_task"` = Aufgabenfoto), sonst null. */
  uploadingItem: string | null;
  onToggle: (itemId: string, done: boolean) => Promise<void> | void;
  onPhoto: (itemId: string, file: File | undefined) => Promise<void> | void;
  onClose: () => void;
}) {
  const t = useTranslations("reservations");

  useEffect(() => {
    const zu = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Beides: `stopPropagation` hält die Bubble-Phase zum Modal auf,
      // `stopImmediatePropagation` auch Geschwister-Listener am selben Ziel
      // (window), falls das Ereignis direkt dort ankommt.
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", zu, { capture: true });
    return () => window.removeEventListener("keydown", zu, { capture: true });
  }, [onClose]);

  const erledigt = punkte.filter((i) => i.done).length;

  return (
    // z-[60]: über dem Detail-Modal (z-50), das dieses Popup öffnet.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-(--radius) border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("taskDetailModal.checklistTitle")}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold">
              {t("taskDetailModal.checklistTitle")}
            </h3>
            <p className="truncate text-sm text-muted-foreground">{titel}</p>
            <p className="text-xs text-muted-foreground">
              {t("taskDetailModal.checklistProgress", {
                done: erledigt,
                total: punkte.length,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("taskDetailModal.close")}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        {/* Die Liste scrollt in sich — der Kopf mit Fortschritt bleibt stehen. */}
        <div className="scrollbar-thin overflow-y-auto p-4">
    <ul className="flex flex-col gap-1.5">
      {punkte.map((item) => {
        const needsPhoto = item.requires_photo && item.photos.length === 0;
        return (
          <li
            key={item.id}
            className={`flex items-center gap-2 rounded-(--radius) border p-2.5 ${
              needsPhoto ? "border-amber-500" : ""
            }`}
          >
            {/* Anklickbar seit 0360. Die Spalte `done` gab es vorher schon,
                aber keinen Weg dorthin — die Punkte standen da und ließen
                sich nicht anfassen. */}
            <button
              type="button"
              disabled={uploadingItem !== null}
              aria-pressed={item.done}
              aria-label={item.label}
              onClick={() => void onToggle(item.id, !item.done)}
              className="shrink-0 disabled:opacity-50"
            >
              <Icon
                icon={item.done ? "ph:check-circle-fill" : "ph:circle"}
                className={`size-5 ${
                  item.done ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm ${
                  item.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {item.label}
              </p>
              {item.room && (
                <p className="text-xs text-muted-foreground">{item.room}</p>
              )}
              {/* Wer abgehakt hat — beim Reinigungsnachweis ist genau das
                  die Frage. Fehlt der Name (Altbestand), steht nichts da
                  statt einer erfundenen Person. */}
              {item.done && item.done_by_name && (
                <p className="text-xs text-muted-foreground">
                  {t("taskDetailModal.doneBy", { name: item.done_by_name })}
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
                  onChange={(e) => onPhoto(item.id, e.target.files?.[0])}
                />
              </label>
            )}
          </li>
        );
      })}
    </ul>
        </div>
      </div>
    </div>
  );
}
