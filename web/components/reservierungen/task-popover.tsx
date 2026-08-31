"use client";

// Aufgaben-Popup im Kalender (Klick auf einen Aufgaben-Balken).
//
// UMGEBAUT AM 31.08.2026. Vorher war es eine Anzeige mit vier Knöpfen: Titel,
// Objekt, zwei Datumszeilen als toter Text, das Wort „Offen" als toter Text,
// darunter Zuständige — und ganz unten Fotos, Ansehen, Löschen. Es zeigte also
// genau die drei Dinge, die man im Tagesbetrieb ÄNDERN will (Status, Zeiten,
// Zuständige), und ließ zwei davon nicht anfassen. Gemeldet als „Das Popup muss
// nutzerfreundlicher gestaltet werden und den Status Offen, erledigt, Prüfen
// muss ein Dropdown werden" und „Zeiten kann man immer noch nicht anpassen".
//
// Jetzt: drei beschriftete Felder untereinander (Status · Zeitfenster ·
// Zuständige), jedes sofort wirksam, darunter die selteneren Aktionen. Die
// Reihenfolge folgt der Häufigkeit im Betrieb, nicht der Datenstruktur.
//
// WARUM DAS ZEITFENSTER HIER SITZT UND NICHT NUR IM DETAIL-MODAL: Der Kalender
// IST die Planungsfläche. Wer dort sieht, dass eine Reinigung um 10 statt um 2
// Uhr nachts stattfinden soll, will sie an Ort und Stelle richtigstellen — ein
// Umweg über eine zweite Ansicht bedeutet, den Kalender zu verlassen und die
// Übersicht zu verlieren.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DateTimePicker } from "@nextdays/ui/date-time-picker";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  completeTask,
  deleteTask,
  setTaskAssignee,
  setTaskStatus,
  setTaskZeitfenster,
  type TaskListItem,
  type TaskStatus,
} from "@/lib/tasks";
import { AUFGABEN_STATUS, naechsteZustaende } from "@/lib/aufgaben-status";
import { ZustaendigAuswahl } from "./zustaendig-auswahl";

/**
 * Ein ISO-Zeitstempel als LOKALER Wert `YYYY-MM-DDTHH:MM` für den
 * `DateTimePicker`.
 *
 * Nicht über `toISOString()`: das liefert UTC, und in einem dänischen Sommer
 * stünde dann 08:00 im Feld, während die Aufgabe um 10:00 stattfindet.
 */
function alsLokal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** Umgekehrter Weg: lokaler Wert → ISO-Zeitstempel für den Server. */
function alsIso(lokal: string): string | null {
  if (!lokal) return null;
  const d = new Date(lokal);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
  const [busy, setBusy] = useState(false);
  // Der angezeigte Status wird lokal mitgeführt: nach einem Wechsel soll das
  // Dropdown sofort den neuen Wert zeigen, ohne dass der Kalender das Popup
  // neu aufbauen muss (das schlösse es).
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [von, setVon] = useState(() => alsLokal(task.start_at ?? task.due_at));
  const [bis, setBis] = useState(() => alsLokal(task.end_at));

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

  /** Status wechseln. `done` läuft über `completeTask` — dort hängen die
   *  Foto-Pflicht und die Inspektions-Folge; ein direkter Statusschreiber
   *  liefe daran vorbei (derselbe Grund wie im Service, 0360). */
  const statusWechseln = async (neu: TaskStatus) => {
    if (neu === status) return;
    setBusy(true);
    const res =
      neu === "done"
        ? await completeTask(task.id)
        : await setTaskStatus(task.id, neu);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStatus(neu);
    toast.success(t("taskPopover.statusSaved"));
  };

  /** Zeitfenster speichern. Der Server lehnt ein Ende vor dem Start mit 422 ab;
   *  die Vorprüfung hier erspart nur den Fehlversuch und nennt den Grund in
   *  derselben Sprache. */
  const zeitenSpeichern = async () => {
    const startIso = alsIso(von);
    const endeIso = alsIso(bis);
    if (startIso && endeIso && endeIso < startIso) {
      toast.error(t("taskPopover.endBeforeStart"));
      return;
    }
    setBusy(true);
    const res = await setTaskZeitfenster(task.id, startIso, endeIso);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskPopover.timesSaved"));
  };

  // Hat der Nutzer an den Zeiten etwas geändert? Nur dann steht „Speichern" da —
  // ein dauerhaft sichtbarer Knopf ohne Wirkung lädt zum Blindklicken ein.
  const zeitenGeaendert =
    von !== alsLokal(task.start_at ?? task.due_at) ||
    bis !== alsLokal(task.end_at);

  // „Ansehen" führt zum Objekt. Bei Zusatzleistungs-Aufgaben direkt zum
  // Zusatzleistungen-Reiter, sonst zur Objektübersicht. Ohne Objekt kein Link.
  const viewHref = task.property_id
    ? task.title.toLowerCase().startsWith("zusatzleistung")
      ? `/objekte/${task.property_id}/zusatzleistungen`
      : `/objekte/${task.property_id}`
    : null;

  const remove = async () => {
    const res = await deleteTask(task.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("taskPopover.deleteSuccess"));
    onDeleted();
  };

  // Auswahl: der aktuelle Zustand plus alles, was von hier aus erreichbar ist.
  // Die Liste spiegelt die Wechselmatrix des Servers (`naechsteZustaende`) —
  // ein Eintrag, den der Server mit 422 ablehnt, gehört nicht ins Dropdown.
  const statusOptionen: TaskStatus[] = [status, ...naechsteZustaende(status)];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20"
      onClick={onClose}
      role="presentation"
    >
      <div
        // Breit genug für ZWEI `datetime-local`-Felder nebeneinander: die
        // zeigen „03.09.2026, 02:00" plus Aufklapp-Symbol, und in 20 rem war
        // der Text rechts abgeschnitten. `max-w` gegen den Fensterrand auf
        // schmalen Geräten.
        className="absolute left-1/2 top-1/2 max-h-[85vh] w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-(--radius) border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Kopf: Objekt zuerst (danach sucht man im Kalender), Aufgabenart
            darunter — vorher stand die Art oben und grau, das Objekt fett
            darunter, was die Rangfolge umkehrte. */}
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            {task.property_title && (
              <p className="truncate font-display text-base font-bold">
                {task.property_title}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {task.title}
              {task.needs_inspection && (
                <Icon
                  icon="ph:magnifying-glass"
                  className="size-3.5 shrink-0 text-amber-500"
                  aria-label={t("taskPopover.inspectionNeeded")}
                />
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("taskPopover.close")}
            className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Status als Auswahl statt als Wort. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("taskPopover.statusLabel")}
            </span>
            <NativeSelect
              value={status}
              disabled={busy}
              onChange={(e) =>
                void statusWechseln(e.target.value as TaskStatus)
              }
            >
              {statusOptionen.map((s) => (
                <option key={s} value={s}>
                  {t(`taskStatus.${AUFGABEN_STATUS[s].key}`)}
                </option>
              ))}
            </NativeSelect>
          </label>

          {/* Zeitfenster — beide Enden auf Minute genau, damit „28.8. von 10
              bis 16 Uhr" eintragbar ist. `datetime-local` bringt Datum UND
              Uhrzeit in einem Feld mit; zwei getrennte Felder je Ende wären
              vier Eingaben für dieselbe Angabe. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("taskPopover.timesLabel")}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("taskPopover.fromField")}
                </span>
                <DateTimePicker
                  value={von}
                  onChange={setVon}
                  disabled={busy}
                  placeholder={t("taskPopover.pickDateTime")}
                  timeLabel={t("taskPopover.timeLabelShort")}
                  clearLabel={t("taskPopover.clear")}
                  doneLabel={t("taskPopover.done")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("taskPopover.toField")}
                </span>
                <DateTimePicker
                  value={bis}
                  onChange={setBis}
                  disabled={busy}
                  placeholder={t("taskPopover.pickDateTime")}
                  timeLabel={t("taskPopover.timeLabelShort")}
                  clearLabel={t("taskPopover.clear")}
                  doneLabel={t("taskPopover.done")}
                />
              </div>
            </div>
            {zeitenGeaendert && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={zeitenSpeichern}
                className="self-start"
              >
                <Icon icon="ph:clock" className="size-4" />
                {t("taskPopover.saveTimes")}
              </Button>
            )}
          </div>

          {/* Zuständige. KEINE eigene Überschrift hier: `ZustaendigAuswahl`
              bringt ihre Beschriftung selbst mit, und mit einer zweiten stand
              „Zuständig" doppelt untereinander. Der `kompakt`-Modus waere der
              andere Weg gewesen, macht das Feld aber zu einer kleinen Pille
              (text-xs, rounded-full) — die passt neben Status und Zeitfenster
              nicht. */}
          <div className="flex flex-col gap-1.5">
            {darfZuweisen ? (
              <ZustaendigAuswahl
                wert={task.assignee_id}
                onWechsel={zuweisen}
                laedt={busy}
                propertyId={task.property_id}
              />
            ) : (
              <>
                <span className="text-sm font-semibold">
                  {t("zustaendig.label")}
                </span>
                <p className="text-sm">
                  {task.assignee_name ?? t("taskPopover.noValue")}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Fuß: die selteneren Wege. Abgesetzt, damit „Löschen" nicht neben
            den Eingabefeldern liegt, in denen man gerade gearbeitet hat. */}
        {/* Fuß: drei gleich breite Spalten. Vorher lagen die Knöpfe im
            Fließsatz — „Löschen" rutschte mit `ml-auto` in die zweite Zeile,
            sobald die Sprache längere Wörter hat. Ein festes Raster hält die
            Anordnung in allen 24 Sprachen gleich. Die Objekt-Spalte bleibt
            leer, wenn es kein Objekt gibt, statt die anderen zu verschieben. */}
        <div className="grid grid-cols-3 gap-2 border-t bg-muted/30 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onPhotos}>
            <Icon icon="ph:camera" className="size-4" />
            {t("taskPopover.photos")}
          </Button>
          {viewHref ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={viewHref}>{t("taskPopover.view")}</Link>
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={remove}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Icon icon="ph:trash" className="size-4" />
            {t("taskPopover.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
