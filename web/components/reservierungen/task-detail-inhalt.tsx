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
import { fehlerMelden } from "@/lib/fehler-melden";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type TaskDetail,
  type TaskStatus,
  addTaskCost,
  completeTask,
  deleteTaskCost,
  getTaskDetail,
  setTaskAssignee,
  setTaskResolution,
  setTaskStatus,
  toggleChecklistItem,
  uploadChecklistPhoto,
  uploadTaskPhoto,
} from "@/lib/tasks";
import { AUFGABEN_STATUS, naechsteZustaende } from "@/lib/aufgaben-status";
import { ZustaendigAuswahl } from "./zustaendig-auswahl";
import { formatCurrency } from "@/lib/currency";

export function TaskDetailInhalt({
  taskId,
  onClose,
  onChanged,
  onNichtGefunden,
  darfZuweisen = false,
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
  /** Darf der Betrachter Aufgaben VERTEILEN (`manage_tasks`)?
   *
   *  Bewusst eine Prop und keine Prüfung hier drin: dieselbe Komponente zeigt
   *  die Aufgabe der Reinigungskraft, die ihre eigene Arbeit meldet, aber
   *  nichts umverteilt. Wer das Recht hat, weiß der Aufrufer — der Server
   *  prüft es ohnehin erneut (`MANAGE_TASKS`). */
  darfZuweisen?: boolean;
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
    else fehlerMelden(res);
    setLoading(false);
    // `onNichtGefunden` ist beim Seiten-Rahmen stabil (useCallback dort);
    // bewusst NICHT in den Deps, damit ein neu erzeugter Callback kein
    // erneutes Laden auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [betrag, setBetrag] = useState("");
  const [kostenNotiz, setKostenNotiz] = useState("");
  const [rueckmeldung, setRueckmeldung] = useState("");
  const [note, setNote] = useState<number | null>(null);

  const missingPhotos =
    detail?.checklist.filter((i) => i.requires_photo && i.photos.length === 0) ??
    [];
  // `cancelled` gehört mit in die Sperre: aus einer abgesagten Aufgabe führt
  // serverseitig nur `open` zurück (`_STATUS_WECHSEL`). Der Knopf bot einen
  // Weg an, den `POST /{id}/complete` inzwischen mit 422 ablehnt.
  const canComplete =
    detail !== null &&
    detail.status !== "done" &&
    detail.status !== "cancelled" &&
    missingPhotos.length === 0;

  /** Jede schreibende Aktion liefert die Aufgabe frisch zurück — der Zustand
   *  kommt vom Server, nicht aus einer lokalen Annahme darüber, was passiert
   *  sein müsste. */
  const uebernehmen = (
    res: Awaited<ReturnType<typeof setTaskStatus>>,
    erfolg?: string,
  ) => {
    if (!res.ok) {
      fehlerMelden(res);
      return false;
    }
    setDetail(res.data);
    onChanged?.();
    if (erfolg) toast.success(erfolg);
    return true;
  };

  const statusSetzen = async (next: TaskStatus) => {
    setSaving(true);
    const res = await setTaskStatus(taskId, next);
    setSaving(false);
    uebernehmen(res, t(`taskStatusChanged.${next}`));
  };

  const zustaendigenSetzen = async (neu: string | null) => {
    setSaving(true);
    const res = await setTaskAssignee(taskId, neu);
    setSaving(false);
    uebernehmen(
      res,
      neu === null
        ? t("zustaendig.abgezogen")
        : t("zustaendig.gesetzt"),
    );
  };

  const punktUmschalten = async (itemId: string, done: boolean) => {
    setUploadingItem(itemId);
    const res = await toggleChecklistItem(itemId, done);
    setUploadingItem(null);
    uebernehmen(res);
  };

  const kostenErfassen = async () => {
    // Komma ODER Punkt: auf dem Telefon tippt niemand nach Gebietsschema.
    const wert = betrag.replace(",", ".").trim();
    const zahl = Number(wert);
    if (!wert || Number.isNaN(zahl) || zahl < 0) {
      toast.error(t("taskCosts.invalidAmount"));
      return;
    }
    setSaving(true);
    const res = await addTaskCost(taskId, {
      amount: zahl.toFixed(2),
      note: kostenNotiz.trim() || null,
    });
    setSaving(false);
    if (uebernehmen(res, t("taskCosts.saved"))) {
      setBetrag("");
      setKostenNotiz("");
    }
  };

  const kostenLoeschen = async (costId: string) => {
    setSaving(true);
    const res = await deleteTaskCost(costId);
    setSaving(false);
    uebernehmen(res, t("taskCosts.removed"));
  };

  const rueckmeldungSpeichern = async () => {
    setSaving(true);
    const res = await setTaskResolution(taskId, {
      note: rueckmeldung.trim() || null,
      score: note,
    });
    setSaving(false);
    uebernehmen(res, t("taskResolution.saved"));
  };

  const complete = async () => {
    setSaving(true);
    const res = await completeTask(taskId);
    setSaving(false);
    if (!res.ok) {
      fehlerMelden(res);
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
      fehlerMelden(res);
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
      fehlerMelden(res);
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
          {darfZuweisen ? (
            <div className="pt-1">
              <ZustaendigAuswahl
                wert={detail.assignee_id}
                onWechsel={zustaendigenSetzen}
                laedt={saving}
                propertyId={detail.property_id}
              />
            </div>
          ) : (
            detail.assignee_name && (
              <p className="text-xs text-muted-foreground">
                {t("taskDetailModal.assignedTo", { name: detail.assignee_name })}
              </p>
            )
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

      {/* Statusleiste: annehmen · anfangen · zurücklegen. Der Abschluss hat
          seinen eigenen Knopf unten, weil an ihm die Foto-Pflicht hängt.
          Auch bei `cancelled` sichtbar: `naechsteZustaende` bietet dort genau
          „wieder öffnen" an, und das war der einzige Weg zurück — die Leiste
          auszublenden machte die Absage zur Sackgasse. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-sm ${
            AUFGABEN_STATUS[detail.status].farbe
          }`}
        >
          <Icon
            icon={AUFGABEN_STATUS[detail.status].icon}
            className="size-4"
          />
          {t(`taskStatus.${detail.status}`)}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {naechsteZustaende(detail.status)
            // „Erledigt" fehlt hier bewusst: der Abschluss läuft über den
            // Knopf unten, damit die Foto-Pflicht davor steht.
            .filter((s) => s !== "done")
            .map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => void statusSetzen(s)}
                className="rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {/* Aus einem Endzustand heißt „open" nicht zurücklegen,
                    sondern wieder öffnen — dieselbe Aktion, andere Bedeutung. */}
                {s === "open" &&
                (detail.status === "done" || detail.status === "cancelled")
                  ? t("taskStatusAction.reopen")
                  : t(`taskStatusAction.${s}`)}
              </button>
            ))}
        </span>
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
                {/* Anklickbar seit 0360. Die Spalte `done` gab es vorher schon,
                    aber keinen Weg dorthin — die Punkte standen da und ließen
                    sich nicht anfassen. */}
                <button
                  type="button"
                  disabled={uploadingItem !== null}
                  aria-pressed={item.done}
                  aria-label={item.label}
                  onClick={() => void punktUmschalten(item.id, !item.done)}
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

      {/* --- Auslagen ---------------------------------------------------
          Hostaway-Gleichzug: wer die Aufgabe macht, kauft manchmal etwas ein.
          Die WÄHRUNG kommt vom Server (Objekt-, sonst Betriebswährung); fehlt
          sie, gibt es hier gar kein Eingabefeld statt eines, dessen Speichern
          in 422 endet (Wurzel 4). Eine Reinigungskraft sieht nur ihre eigenen
          Auslagen — der Server filtert (§4.3). */}
      <section className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
        <h3 className="text-sm font-medium">{t("taskCosts.title")}</h3>
        {detail.costs.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {detail.costs.map((k) => (
              <li key={k.id} className="flex items-center gap-2 py-1.5">
                <span className="tabular-nums text-sm">
                  {formatCurrency(Number(k.amount), k.currency, locale)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {[k.note, k.created_by_name].filter(Boolean).join(" · ")}
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void kostenLoeschen(k.id)}
                  aria-label={t("taskCosts.remove")}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {detail.cost_currency ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              // inputMode="decimal" statt type="number": auf dem Telefon
              // erscheint der Ziffernblock, ohne dass der Browser Komma-
              // Eingaben verwirft.
              inputMode="decimal"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              placeholder={detail.cost_currency}
              className="w-28"
              aria-label={t("taskCosts.amount")}
            />
            <Input
              value={kostenNotiz}
              onChange={(e) => setKostenNotiz(e.target.value)}
              placeholder={t("taskCosts.notePlaceholder")}
              className="min-w-40 flex-1"
              aria-label={t("taskCosts.note")}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={saving || !betrag.trim()}
              onClick={() => void kostenErfassen()}
            >
              {t("taskCosts.add")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("taskCosts.noCurrency")}
          </p>
        )}
      </section>

      {/* --- Rückmeldung zum Ergebnis -------------------------------------
          Text darf die zuständige Person schreiben, die BEWERTUNG nur die
          Konto-Führung — der Server lehnt einen Score ohne diese Berechtigung
          mit 403 ab. Die Sterne stehen trotzdem für alle sichtbar: die
          Rückmeldung ist AN die zuständige Person gerichtet. */}
      <section className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
        <h3 className="text-sm font-medium">{t("taskResolution.title")}</h3>
        {detail.resolution && (
          <div className="flex flex-col gap-1">
            {detail.resolution.score !== null && (
              <span className="flex items-center gap-0.5" aria-label={t("taskResolution.score")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon
                    key={n}
                    icon={
                      n <= (detail.resolution?.score ?? 0)
                        ? "ph:star-fill"
                        : "ph:star"
                    }
                    className="size-4 text-amber-500"
                  />
                ))}
              </span>
            )}
            {detail.resolution.note && (
              <p className="text-sm">{detail.resolution.note}</p>
            )}
            {detail.resolution.created_by_name && (
              <p className="text-xs text-muted-foreground">
                {detail.resolution.created_by_name}
              </p>
            )}
          </div>
        )}
        <Textarea
          rows={2}
          value={rueckmeldung}
          onChange={(e) => setRueckmeldung(e.target.value)}
          placeholder={t("taskResolution.placeholder")}
          aria-label={t("taskResolution.title")}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(note === n ? null : n)}
                aria-label={t("taskResolution.giveScore", { score: n })}
                aria-pressed={note === n}
                className="text-amber-500 transition-transform hover:scale-110"
              >
                <Icon
                  icon={note !== null && n <= note ? "ph:star-fill" : "ph:star"}
                  className="size-5"
                />
              </button>
            ))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={saving || (!rueckmeldung.trim() && note === null)}
            onClick={() => void rueckmeldungSpeichern()}
          >
            {t("taskResolution.save")}
          </Button>
        </div>
      </section>

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
