"use client";

// Position-Bausteine: Pin-Kreuz (T/L/R/B + Constraint-Widget) und die
// Ausrichtungs-Leiste (6 Align-Buttons, aktives blau umrandet) wie Framer.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FIELD_H } from "./ui";

// Ein Pin-Feld — randlose graue Pille (wie Framer): Wert links, Achsen-Kürzel
// klein grau rechts. Keine sichtbaren Stepper; Verstellen per Pfeiltasten
// (↑/↓, Shift = 10) und Ziehen am Kürzel (Scrub). `muted` = heller (nicht gepinnt).
export function PinField({
  value,
  axis,
  muted,
  onChange,
}: {
  value: number;
  axis: string;
  muted?: boolean;
  onChange?: (v: number) => void;
}) {
  const t = useTranslations("website");
  const editable = !!onChange;
  function startScrub(e: React.MouseEvent) {
    if (!editable) return;
    e.preventDefault();
    const sx = e.clientX;
    const start = value;
    const onMove = (ev: MouseEvent) => onChange?.(Math.round(start + (ev.clientX - sx)));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  return (
    <div className={`flex ${FIELD_H} w-full min-w-0 items-center rounded-md bg-secondary`}>
      <input
        value={value}
        readOnly={!editable}
        onChange={(e) => { const nn = Number(e.target.value); if (!Number.isNaN(nn)) onChange?.(Math.round(nn)); }}
        onKeyDown={(e) => {
          if (!editable) return;
          if (e.key === "ArrowUp") { e.preventDefault(); onChange?.(value + (e.shiftKey ? 10 : 1)); }
          if (e.key === "ArrowDown") { e.preventDefault(); onChange?.(value - (e.shiftKey ? 10 : 1)); }
        }}
        className={`w-full min-w-0 bg-transparent pl-2 pr-0.5 text-xs outline-none ${muted ? "text-muted-foreground" : "text-foreground"}`}
      />
      <span
        onMouseDown={startScrub}
        title={editable ? t("editor.dragToChange") : undefined}
        className={`pr-1 text-[0.625rem] uppercase text-muted-foreground ${editable ? "cursor-ew-resize select-none" : ""}`}
      >
        {axis}
      </span>
      {/* Sichtbare ↑↓-Stepper (wie Framer). Nur wenn editierbar. */}
      {editable ? (
        <div className="flex h-full flex-col border-l border-border/60">
          <button type="button" tabIndex={-1} aria-label={t("editor.increase")} onClick={() => onChange?.(value + 1)} className="flex w-4 flex-1 items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon icon="ph:caret-up" className="size-2.5" />
          </button>
          <button type="button" tabIndex={-1} aria-label="verringern" onClick={() => onChange?.(value - 1)} className="flex w-4 flex-1 items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon icon="ph:caret-down" className="size-2.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Constraint-Widget (Framer „Toggle Pins"): mittiges Quadrat, umgeben von 4
// klickbaren Pin-Linien (Left/Right/Top/Bottom). Aktive Pins ausgefüllt (tint).
export function PinConstraint({
  pins,
  onToggle,
}: {
  pins: { t: boolean; l: boolean; r: boolean; b: boolean };
  onToggle: (k: "t" | "l" | "r" | "b") => void;
}) {
  const t = useTranslations("website");
  const on = "bg-primary";
  const off = "bg-muted-foreground/30 hover:bg-muted-foreground/60";
  return (
    <div className="relative flex size-9 items-center justify-center">
      {/* Pin Top */}
      <button type="button" title={t("editor.pinTopEn")} aria-label={t("editor.pinTop")} aria-pressed={pins.t}
        onClick={() => onToggle("t")}
        className="absolute left-1/2 top-0 flex h-2.5 w-3 -translate-x-1/2 items-center justify-center">
        <span className={`block h-2 w-[0.1875rem] rounded-full ${pins.t ? on : off}`} />
      </button>
      {/* Pin Bottom */}
      <button type="button" title={t("editor.pinBottomEn")} aria-label={t("editor.pinBottom")} aria-pressed={pins.b}
        onClick={() => onToggle("b")}
        className="absolute bottom-0 left-1/2 flex h-2.5 w-3 -translate-x-1/2 items-center justify-center">
        <span className={`block h-2 w-[0.1875rem] rounded-full ${pins.b ? on : off}`} />
      </button>
      {/* Pin Left */}
      <button type="button" title={t("editor.pinLeftEn")} aria-label={t("editor.pinLeft")} aria-pressed={pins.l}
        onClick={() => onToggle("l")}
        className="absolute left-0 top-1/2 flex h-3 w-2.5 -translate-y-1/2 items-center justify-center">
        <span className={`block h-[0.1875rem] w-2 rounded-full ${pins.l ? on : off}`} />
      </button>
      {/* Pin Right */}
      <button type="button" title={t("editor.pinRightEn")} aria-label={t("editor.pinRight")} aria-pressed={pins.r}
        onClick={() => onToggle("r")}
        className="absolute right-0 top-1/2 flex h-3 w-2.5 -translate-y-1/2 items-center justify-center">
        <span className={`block h-[0.1875rem] w-2 rounded-full ${pins.r ? on : off}`} />
      </button>
      {/* Weißes Toggle-Quadrat (Mitte) — größer, klar gerundet (wie Framer). */}
      <button
        type="button"
        title={t("editor.togglePinsEn")}
        aria-label={t("editor.togglePins")}
        className="size-4 rounded-[4px] border border-border bg-background shadow-sm"
      />
    </div>
  );
}

// Pin-Kreuz (Framer Position): T oben · L | Constraint | R · B unten. JEDE
// AKTIVE (gepinnte) Kante ist editierbar (pin unten → B bearbeitbar); nicht
// gepinnte Kanten sind gemutet und read-only. Pins kommen als Prop (persistiert
// in den Frame-Props), Umschalten über onTogglePin.
export function PinCross({
  top,
  left,
  right,
  bottom,
  pins,
  onTogglePin,
  onTop,
  onLeft,
  onRight,
  onBottom,
}: {
  top: number;
  left: number;
  right: number;
  bottom: number;
  pins: { t: boolean; l: boolean; r: boolean; b: boolean };
  onTogglePin: (k: "t" | "l" | "r" | "b") => void;
  onTop: (v: number) => void;
  onLeft: (v: number) => void;
  onRight: (v: number) => void;
  onBottom: (v: number) => void;
}) {
  // Kompaktes Kreuz mit schmalen Feldern (feste Breite, wie Framer).
  const FELD = "w-16";
  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      {/* T */}
      <div className={FELD}><PinField value={top} axis="T" muted={!pins.t} onChange={pins.t ? onTop : undefined} /></div>
      {/* L · Widget · R */}
      <div className="flex items-center gap-1.5">
        <div className={FELD}><PinField value={left} axis="L" muted={!pins.l} onChange={pins.l ? onLeft : undefined} /></div>
        <PinConstraint pins={pins} onToggle={onTogglePin} />
        <div className={FELD}><PinField value={right} axis="R" muted={!pins.r} onChange={pins.r ? onRight : undefined} /></div>
      </div>
      {/* B */}
      <div className={FELD}><PinField value={bottom} axis="B" muted={!pins.b} onChange={pins.b ? onBottom : undefined} /></div>
    </div>
  );
}

// Ausrichtungs-Leiste wie Framer: genau 6 Align-Buttons (Links/Horizontal/Rechts
// + Oben/Vertikal/Unten). Das zuletzt genutzte ist blau UMRANDET (kein Füll-
// Hintergrund) — exakt wie Framer. `onAlign` richtet das Element im Elternteil
// aus; `active` markiert die zuletzt gewählte Achse.
export type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

export function AlignBar({ onAlign }: { onAlign?: (k: AlignKind) => void } = {}) {
  const [active, setActive] = useState<AlignKind | null>(null);
  const items: { kind: AlignKind; icon: string; title: string }[] = [
    { kind: "left", icon: "ph:align-left-simple", title: "Links ausrichten  ⌥A" },
    { kind: "hcenter", icon: "ph:align-center-horizontal-simple", title: "Horizontal ausrichten  ⌥H" },
    { kind: "right", icon: "ph:align-right-simple", title: "Rechts ausrichten  ⌥D" },
    { kind: "top", icon: "ph:align-top-simple", title: "Oben ausrichten  ⌥W" },
    { kind: "vcenter", icon: "ph:align-center-vertical-simple", title: "Vertikal ausrichten  ⌥V" },
    { kind: "bottom", icon: "ph:align-bottom-simple", title: "Unten ausrichten  ⌥S" },
  ];
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      {items.map((it) => {
        const on = active === it.kind;
        return (
          <button
            key={it.kind}
            type="button"
            title={it.title}
            aria-label={it.title}
            aria-pressed={on}
            onClick={() => { setActive(it.kind); onAlign?.(it.kind); }}
            className={
              "flex size-8 items-center justify-center rounded-md transition " +
              (on
                ? "text-primary ring-1 ring-inset ring-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground")
            }
          >
            <Icon icon={it.icon} className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
