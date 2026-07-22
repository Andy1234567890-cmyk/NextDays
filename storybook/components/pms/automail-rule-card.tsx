// PMS-Baustein: Automail-Regel-Karte (Posteingang → Automatisierungen).
// Reine Präsentation — zeigt eine planbare Auto-Nachricht mit Zeitplan
// (Anker + Offset + Uhrzeit) und Zuweisung (Unterkünfte UND Kanäle, leer = alle).
import { Icon } from "@iconify/react";

export type AutomailRule = {
  name: string;
  trigger: "booking_new" | "before_checkin" | "after_checkout";
  anchor: "arrival" | "departure" | "booking";
  offsetDays: number; // <0 vor, >0 nach
  sendTime: string | null; // "HH:MM"
  propertyTitles: string[]; // leer = alle
  channels: string[]; // leer = alle
  active: boolean;
};

const TRIGGER_LABEL: Record<AutomailRule["trigger"], string> = {
  booking_new: "Bei neuer Buchung",
  before_checkin: "Vor Anreise",
  after_checkout: "Nach Abreise",
};
const ANCHOR_LABEL: Record<AutomailRule["anchor"], string> = {
  arrival: "Anreise",
  departure: "Abreise",
  booking: "Buchung",
};

function schedule(r: AutomailRule): string {
  const abs = Math.abs(r.offsetDays);
  const dir = r.offsetDays < 0 ? "vor" : "nach";
  const time = r.sendTime ? ` · ${r.sendTime}` : "";
  if (abs === 0) return `${ANCHOR_LABEL[r.anchor]}${time}`;
  return `${abs} Tage ${dir} ${ANCHOR_LABEL[r.anchor]}${time}`;
}

export function AutomailRuleCard({ rule }: { rule: AutomailRule }) {
  const houses =
    rule.propertyTitles.length === 0
      ? "Alle Unterkünfte"
      : rule.propertyTitles.join(", ");
  const chans =
    rule.channels.length === 0 ? "Alle Kanäle" : rule.channels.join(", ");
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{rule.name}</span>
        <span className="text-sm text-muted-foreground">
          {TRIGGER_LABEL[rule.trigger]} · {schedule(rule)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon icon="ph:house" className="size-3" /> {houses}
          <span className="mx-1">·</span>
          <Icon icon="ph:plugs-connected" className="size-3" /> {chans}
        </span>
      </div>
      <span
        className={
          "rounded-full px-2.5 py-1 text-xs font-medium " +
          (rule.active
            ? "bg-emerald-100 text-emerald-700"
            : "bg-muted text-muted-foreground")
        }
      >
        {rule.active ? "Aktiv" : "Pausiert"}
      </span>
    </div>
  );
}
