"use client";

// Start- und Endzeitpunkt EINER Aufgabe ändern — als Popover an Ort und Stelle.
//
// WARUM EIGENES BAUTEIL: Dieselbe Bearbeitung wird an mehreren Stellen
// gebraucht — im Kalender-Popup, in der Aufgabenliste und (künftig) im
// Detail-Modal. Dreimal dasselbe zu bauen wäre dreimal dieselbe
// Nächte-Rechnung, dreimal dieselbe Prüfung „Ende nicht vor Start" und beim
// nächsten Feature drei Stellen, die auseinanderlaufen.
//
// Gemeldet am 31.08.2026 („ich kann hier immer noch nicht Uhrzeit ändern"):
// Das Popup im Kalender konnte es bereits, die LISTE nicht — dort standen die
// Termine als toter Text, obwohl genau dort geplant wird.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { fehlerMelden } from "@/lib/fehler-melden";

import { Button } from "@nextdays/ui/button";
import { DateTimePicker } from "@nextdays/ui/date-time-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import { setTaskZeitfenster } from "@/lib/tasks";

/**
 * Ein ISO-Zeitstempel als LOKALER Wert `YYYY-MM-DDTHH:MM`.
 *
 * Nicht über `toISOString()`: das liefert UTC, und in einem dänischen Sommer
 * stünde dann 08:00 im Feld, während die Aufgabe um 10:00 stattfindet.
 */
export function alsLokal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** Umgekehrter Weg: lokaler Wert → ISO-Zeitstempel für den Server. */
export function alsIso(lokal: string): string | null {
  if (!lokal) return null;
  const d = new Date(lokal);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ZeitfensterBearbeiten({
  taskId,
  startAt,
  endAt,
  trigger,
  onSaved,
}: {
  taskId: string;
  startAt: string | null;
  endAt: string | null;
  /** Das anklickbare Element (in der Liste die Termin-Zelle selbst). */
  trigger: React.ReactNode;
  onSaved?: () => void;
}) {
  const t = useTranslations("reservations");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [von, setVon] = useState(() => alsLokal(startAt));
  const [bis, setBis] = useState(() => alsLokal(endAt));

  const speichern = async () => {
    const startIso = alsIso(von);
    const endeIso = alsIso(bis);
    // Der Server lehnt ein Ende vor dem Start mit 422 ab; diese Vorprüfung
    // erspart nur den Fehlversuch und nennt den Grund in derselben Sprache.
    if (startIso && endeIso && endeIso < startIso) {
      toast.error(t("taskPopover.endBeforeStart"));
      return;
    }
    setBusy(true);
    const res = await setTaskZeitfenster(taskId, startIso, endeIso);
    setBusy(false);
    if (!res.ok) {
      fehlerMelden(res);
      return;
    }
    toast.success(t("taskPopover.timesSaved"));
    setOpen(false);
    onSaved?.();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Beim Schließen ohne Speichern zurück auf den Stand der Aufgabe —
        // sonst zeigte ein erneutes Öffnen eine Änderung, die nie ankam.
        if (!o) {
          setVon(alsLokal(startAt));
          setBis(alsLokal(endAt));
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("taskPopover.timesLabel")}
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
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
          </label>
          <label className="flex flex-col gap-1">
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
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("taskPopover.close")}
          </Button>
          <Button size="sm" disabled={busy} onClick={speichern}>
            <Icon icon="ph:clock" className="size-4" />
            {t("taskPopover.saveTimes")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
