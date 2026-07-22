"use client";

// Wiederverwendbare Airbnb-Wizard-Bausteine (verbindliche UX-Referenz, Memory
// onboarding-airbnb-wizard-referenz). Diese Muster tauchen über die Schritte
// wiederholt auf: Stepper-Zähler, große Auswahlkarte, Karten-Grid-Kachel.
import { Icon } from "@iconify/react";

/** Plus/Minus-Zähler (Gäste, Zimmer, Betten, Bäder). */
export function StepperRow({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 50,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-5 last:border-0">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="minus"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex size-8 items-center justify-center rounded-full border border-border text-lg disabled:opacity-30"
        >
          <Icon icon="solar:minus-square-linear" className="size-5" />
        </button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <button
          type="button"
          aria-label="plus"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-8 items-center justify-center rounded-full border border-border text-lg disabled:opacity-30"
        >
          <Icon icon="solar:add-square-linear" className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** Große Auswahlkarte mit Icon (Privacy-Type, Occupancy). Rahmen bei Auswahl. */
export function ChoiceCard({
  title,
  description,
  icon,
  selected,
  onClick,
}: {
  title: string;
  description?: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-5 text-left transition-colors ${
        selected
          ? "border-foreground ring-1 ring-foreground"
          : "border-border hover:border-foreground/40"
      }`}
    >
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Icon icon={icon} className="size-6 shrink-0" />
    </button>
  );
}

/** Kachel im Karten-Grid (Objekttyp, Ausstattung). Icon oben, Label unten. */
export function GridTile({
  label,
  description,
  icon,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition-colors ${
        selected
          ? "border-foreground ring-1 ring-foreground"
          : "border-border hover:border-foreground/40"
      }`}
    >
      <Icon icon={icon} className="size-7" />
      <div>
        <p className="font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </button>
  );
}
